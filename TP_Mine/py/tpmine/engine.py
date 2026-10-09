# TPMINE-PRIVATE
"""TP Mine engine: parent -> candidate transformation products -> XIC, peaks, kinetics, isotopes, MS2, confidence, and an untargeted
search of unexpected ions. Runs in Pyodide (numpy only) and on a normal Python; the reader is the one of mzlab."""
from __future__ import annotations

import copy
import math
import re
from pathlib import Path

import numpy as np

from mzlab.chem import elements as E
from mzlab.reader.mzml import Run

from . import chem, mrm
from .peaks import find_peak
from .score import DEFAULT_THRESHOLDS, M2_SHIFT, confidence, halogen_expectation, score_candidate

DEFAULT_SETTINGS = {"tol_da": 0.35, "rt_tol_min": 0.25, "max_steps": 2, "rt_min": 0.5, "discover": True, "max_unexpected": 40,
                    "auto_offset": True}
ISOTOPE_SHIFTS = ((1.00335, "13C (M+1)"), (2.0067, "M+2"), (1.99580, "34S (M+2)"))


def guess_sample(name: str) -> dict:
    """label, time (min) and type guessed from a file name: 'blank', 't30', 'STD_12ppm', '120min'."""
    base = Path(name).stem
    low = base.lower()
    if re.search(r"(^|[_\-\s])(blank|blk|bianco)([_\-\s\d]|$)", low):
        return {"label": base, "time": None, "type": "blank"}
    if re.search(r"(^|[_\-\s])(std|standard|taratura|cal)([_\-\s\d]|$)", low):
        return {"label": base, "time": None, "type": "standard"}
    if re.search(r"(^|[_\-\s])(control|ctrl|dark|buio)([_\-\s\d]|$)", low):
        return {"label": base, "time": None, "type": "control"}
    m = re.search(r"(?:^|[_\-\s])t(\d+(?:[.,]\d+)?)\s*(min|m|h|ore)?(?:[_\-\s(]|$)", low) or \
        re.search(r"(?:^|[_\-\s])(\d+(?:[.,]\d+)?)\s*(min|h|ore)(?:[_\-\s(]|$)", low)
    if m:
        v = float(m.group(1).replace(",", "."))
        if (m.group(2) or "") in ("h", "ore"):
            v *= 60
        return {"label": base, "time": v, "type": "sample"}
    return {"label": base, "time": None, "type": "sample"}


def file_kind(run: Run) -> str:
    """'full' (MS1 scans), 'ms2' (product-ion scans), 'mrm' (chromatograms only), 'empty'."""
    n1 = sum(1 for s in run.scans if s.level == 1)
    n2 = sum(1 for s in run.scans if s.level == 2)
    if n1 >= 20 and n1 >= n2:
        return "full"
    if n2 >= 5:
        return "ms2"
    try:
        if any("SRM" in (c.get("id") or "") for c in run.chromatograms()):
            return "mrm"
    except Exception:       # noqa: BLE001
        pass
    return "empty"


class Sample:
    def __init__(self, d: dict):
        self.name = d["name"]
        self.path = d["path"]
        g = guess_sample(self.name)
        self.label = d.get("label") or g["label"]
        self.time = d["time"] if "time" in d else g["time"]
        self.type = d.get("type") or g["type"]
        self.run = Run(self.path)
        self.kind = file_kind(self.run)
        self._table = None

    @property
    def table(self):
        if self._table is None:
            self._table = self.run.table(1, None)
        return self._table


class Experiment:
    def __init__(self, files: list[dict], parent: dict, settings: dict | None = None, thresholds: dict | None = None,
                 transformations: list[dict] | None = None, progress=None):
        self.progress = progress or (lambda text, frac=None: None)
        self.s = {**DEFAULT_SETTINGS, **(settings or {})}
        self.thr = copy.deepcopy(DEFAULT_THRESHOLDS)
        for k, v in (thresholds or {}).items():
            self.thr.setdefault(k, {}).update(v)
        self.tol, self.rt_tol, self.rt_min = float(self.s["tol_da"]), float(self.s["rt_tol_min"]), float(self.s["rt_min"])
        self.samples = [Sample(f) for f in files]
        self.full = [x for x in self.samples if x.kind == "full" and x.type in ("sample", "blank", "control")]
        self.ms2files = [x for x in self.samples if x.kind == "ms2"]
        self.mrmfiles = [x for x in self.samples if x.kind == "mrm"]
        if not self.full:
            raise ValueError("servono file di full scan (MS1) del campione: nessuno trovato")
        # parent
        self.parent = parent
        self.adduct = parent.get("adduct") or E.DEFAULT_ADDUCT[parent.get("polarity", "positive")]
        if parent.get("neutral"):
            self.neutral = chem.neutral_formula(parent["neutral"])
            self.parent_neutral_mass = E.mass(self.neutral)
        elif parent.get("mz"):
            self.neutral = None
            self.parent_neutral_mass = float(parent["mz"]) - E.ADDUCT_SHIFT[self.adduct]
        else:
            raise ValueError("serve la formula bruta neutra, lo SMILES o l'm/z dello ione del progenitore")
        self.pol = 1 if self.adduct.endswith("+") else -1
        self.transformations = transformations or chem.default_transformations()
        self.offset = 0.0
        self.offset_info = None
        self.entries: list[dict] = []
        self._base: dict = {}
        self._final: dict = {}
        self._ms2cache: dict = {}

    # ------------------------------------------------------------------ chromatograms
    def _table(self, x: Sample):
        if x._table is None:
            x._table = x.run.table(1, self.pol)
        return x._table

    def trace(self, k: int, mz: float):
        t = self._table(self.full[k])
        y = t.xic(mz, self.tol)
        keep = t.rt >= self.rt_min
        return t.rt[keep], y[keep]

    def _peaks_for(self, mz: float, ref_rt: float | None = None):
        """Peak of every sample at one reference RT (that of the strongest treated sample)."""
        thr = self.thr["peak"]
        sk, mp = int(thr.get("smooth_points", 3)), int(thr["min_points"])
        traces = [self.trace(k, mz) for k in range(len(self.full))]
        if ref_rt is None:
            best = None
            for k, x in enumerate(self.full):
                if x.type != "sample":
                    continue
                pk = find_peak(*traces[k], rt_center=None, smooth_k=sk, min_points=mp)
                if pk and (best is None or pk["height"] > best["height"]):
                    best = pk
            ref_rt = best["apex_rt"] if best else None
        peaks = [find_peak(rt, y, rt_center=ref_rt, rt_tol=self.rt_tol, smooth_k=sk, min_points=mp) if ref_rt is not None else None
                 for rt, y in traces]
        return ref_rt, traces, peaks

    # ------------------------------------------------------------------ mass offset
    def calibrate(self):
        """Centroids of a unit-resolution QqQ are often shifted by a few tenths of a Da. The offset is measured on the parent
        (observed apex m/z - calculated) and applied to every extraction window and to the suggested Q1/Q3."""
        mz0 = E.ion_mz(self.parent_neutral_mass, self.adduct)
        self.offset, self.offset_info = 0.0, None
        old_tol = self.tol
        self.tol = 0.8
        try:
            best = None
            for k, x in enumerate(self.full):
                if x.type != "sample":
                    continue
                rt, y = self.trace(k, mz0)
                pk = find_peak(rt, y, smooth_k=3, min_points=5)
                if pk and pk["ok"] and (best is None or pk["area"] > best[1]["area"]):
                    best = (k, pk)
        finally:
            self.tol = old_tol
        if best is None:
            return None
        k, pk = best
        t = self._table(self.full[k])
        sel = (t.rt[t.pos] >= pk["left"]) & (t.rt[t.pos] <= pk["right"]) & (np.abs(t.mz - mz0) <= 0.8)
        if not sel.any():
            return None
        w, m = t.inten[sel], t.mz[sel]
        # intensity-weighted histogram (0.02 Da) -> the mode, then the mean inside +-0.15 Da of the mode
        hist, edges = np.histogram(m, bins=np.arange(m.min(), m.max() + 0.02, 0.02), weights=w)
        mode = float(edges[int(np.argmax(hist))] + 0.01)
        near = np.abs(m - mode) <= 0.15
        obs = float(np.average(m[near], weights=w[near]))
        off = obs - mz0
        self.offset_info = {"calc": round(mz0, 4), "observed": round(obs, 3), "offset": round(off, 3), "sample": self.full[k].label,
                            "applied": bool(self.s.get("auto_offset", True) and abs(off) <= 0.6)}
        if self.offset_info["applied"]:
            self.offset = off
        return self.offset_info

    # ------------------------------------------------------------------ candidates
    def build_candidates(self):
        if self.neutral is not None:
            cands = chem.generate(self.neutral, self.adduct, self.transformations, int(self.s["max_steps"]), self.tol)
        else:   # only an m/z is known: no formula, masses from the delta of each transformation
            cands = []
            seen = {(): []}
            import itertools
            for kk in range(0, int(self.s["max_steps"]) + 1):
                for combo in itertools.combinations_with_replacement(range(len(self.transformations)), kk):
                    d: dict = {}
                    for i in combo:
                        d = chem.add(d, self.transformations[i]["delta"])
                    key = tuple(sorted(d.items()))
                    if (kk and not d) or key in seen and kk:
                        continue
                    seen[key] = combo
                    m = self.parent_neutral_mass + E.mass(d)
                    names = [self.transformations[i]["name"] for i in combo]
                    cands.append({"name": "progenitore" if not combo else " + ".join(names), "alternatives": [], "delta": chem.fmt_delta(d) if d else "",
                                  "delta_dict": d, "formula": "", "neutral_mass": m, "mz": E.ion_mz(m, self.adduct), "adduct": self.adduct,
                                  "steps": len(combo), "formula_dict": None})
            cands.sort(key=lambda r: (r["steps"], r["mz"]))
            for i, c in enumerate(cands):
                c["id"] = i
        for c in cands:
            c["kind"] = "candidate"
            c["mz_x"] = c["mz"] + self.offset
        self.entries = cands
        return cands

    # ------------------------------------------------------------------ one entry
    def _analyse_base(self, e: dict) -> dict:
        if e["id"] in self._base:
            return self._base[e["id"]]
        ref_rt, traces, peaks = self._peaks_for(e["mz_x"])
        rows = []
        for x, pk in zip(self.full, peaks):
            det = bool(pk and pk["ok"] and pk["snr"] >= self.thr["peak"]["snr_min"])
            rows.append({"label": x.label, "time": x.time, "type": x.type, "area": float(pk["area"]) if pk else 0.0,
                         "height": float(pk["height"]) if pk else 0.0, "snr": float(pk["snr"]) if pk else 0.0,
                         "points": int(pk["points"]) if pk else 0, "apex_rt": float(pk["apex_rt"]) if pk else None, "detected": det})
        exp = halogen_expectation(e.get("formula_dict"))
        obs = None
        if exp is not None and ref_rt is not None:
            kb = max(range(len(rows)), key=lambda k: rows[k]["area"])
            _, _, pk2 = self._peaks_for(e["mz_x"] + M2_SHIFT, ref_rt)
            if pk2[kb] and pk2[kb]["ok"] and rows[kb]["area"] > 0:
                obs = pk2[kb]["area"] / rows[kb]["area"]
        sc = ({"score": None, "label": "progenitore", "criteria": []} if e["steps"] == 0 and e["kind"] == "candidate"
              else score_candidate(rows, self.thr, exp, obs))
        out = {"ref_rt": ref_rt, "rows": rows, "peaks": peaks, "traces": traces, **sc}
        self._base[e["id"]] = out
        return out

    def _isotope_of(self, e: dict, a: dict):
        """An ion is an isotope peak when a stronger ion sits one isotope step below in the same peak (the main false positive at unit resolution)."""
        area = max([r["area"] for r in a["rows"] if r["detected"]] or [0.0])
        if area <= 0 or a["ref_rt"] is None:
            return None
        for d in self.entries:
            if d["id"] == e["id"]:
                continue
            for shift, name in ISOTOPE_SHIFTS:
                if abs(d["mz_x"] + shift - e["mz_x"]) > self.tol:
                    continue
                b = self._analyse_base(d)
                if b["ref_rt"] is None or abs(b["ref_rt"] - a["ref_rt"]) > self.rt_tol:
                    continue
                barea = max([r["area"] for r in b["rows"] if r["detected"]] or [0.0])
                if barea > 0 and area <= 0.5 * barea:
                    return d, name
        return None

    def analyse(self, e: dict) -> dict:
        if e["id"] in self._final:
            return self._final[e["id"]]
        out = dict(self._analyse_base(e))
        if (e["steps"] > 0 or e["kind"] != "candidate") and out.get("score") is not None:
            hit = self._isotope_of(e, out)
            crit = list(out["criteria"])
            if hit:
                crit.append({"name": "non è un picco isotopico", "status": "fail",
                             "text": f"sembra il picco {hit[1]} di m/z {hit[0]['mz']:.4f} ({hit[0]['name']})"})
                out["score"], out["label"] = min(out["score"], 40), "debole"
            else:
                crit.append({"name": "non è un picco isotopico", "status": "pass", "text": "nessuno ione più intenso a M-1 o M-2 nello stesso picco"})
            out["criteria"] = crit
            out["isotope_of"] = hit[0]["id"] if hit else None
        self._final[e["id"]] = out
        return out

    # ------------------------------------------------------------------ kinetics
    @staticmethod
    def _kinetics(rows: list[dict]) -> list[dict]:
        timed = sorted([r for r in rows if r["type"] == "sample" and r["time"] is not None], key=lambda r: r["time"])
        return [{"time": r["time"], "area": r["area"] if r["detected"] else 0.0, "height": r["height"] if r["detected"] else 0.0} for r in timed]

    def parent_decay(self) -> dict | None:
        """First-order decay of the parent: k (1/min), t1/2 (min), R2, from ln(area) vs time on the detected points."""
        p = self.entries[0]
        a = self.analyse(p)
        pts = [(k["time"], k["area"]) for k in self._kinetics(a["rows"]) if k["area"] > 0]
        if len(pts) < 3:
            return None
        t, y = np.array([p_[0] for p_ in pts]), np.log([p_[1] for p_ in pts])
        slope, icpt = np.polyfit(t, y, 1)
        pred = slope * t + icpt
        ss_res, ss_tot = float(((y - pred) ** 2).sum()), float(((y - y.mean()) ** 2).sum())
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
        k = -float(slope)
        return {"k_per_min": round(k, 5), "half_life_min": round(math.log(2) / k, 2) if k > 0 else None, "r2": round(r2, 3), "points": len(pts)}

    # ------------------------------------------------------------------ untargeted search
    def discover(self):
        """Ions that rise in time, are absent at t0 / in the blank, and do not correspond to any candidate: 'ioni non previsti'."""
        t = self._table(self.full[0])
        lo, hi = float(t.mz.min()), float(t.mz.max())
        step = self.tol
        centers = np.arange(lo + step, hi - step, step)
        known = [c["mz_x"] for c in self.entries]
        n0 = len(self.entries)
        found: list[dict] = []
        uid = 100000
        sk, mp = int(self.thr["peak"].get("smooth_points", 3)), int(self.thr["peak"]["min_points"])
        for i, mz in enumerate(centers):
            if i % 50 == 0:
                self.progress("Cerco ioni non previsti...", i / len(centers))
            if any(abs(mz - m) <= self.tol for m in known):
                continue
            hit = False
            for k, x in enumerate(self.full):
                if x.type != "sample" or not x.time:
                    continue
                rt, y = self.trace(k, mz)
                if len(y) < 10 or y.max() <= 0:
                    continue
                nz = y[y > 0]
                if y.max() < 8 * float(np.median(nz)) if len(nz) else True:
                    continue
                hit = True
                break
            if not hit:
                continue
            uid += 1
            e = {"id": uid, "kind": "unexpected", "name": f"ione non previsto m/z {mz - self.offset:.2f}", "alternatives": [],
                 "delta": "", "formula": "", "formula_dict": None, "neutral_mass": None, "mz": mz - self.offset, "mz_x": float(mz),
                 "steps": 1, "adduct": self.adduct, "delta_dict": None}
            a = self._analyse_base(e)
            if a["label"] in ("forte", "possibile") and a["ref_rt"] is not None:
                e["_area"] = max([r["area"] for r in a["rows"] if r["detected"]] or [0.0])
                found.append(e)
                self.entries.append(e)       # temporary: lets the isotope check see them
        # keep the best of neighbouring windows (same peak seen by two windows) and drop isotope peaks
        found.sort(key=lambda e: -e["_area"])
        kept: list[dict] = []
        for e in found:
            a = self._analyse_base(e)
            if any(abs(e["mz_x"] - f["mz_x"]) <= 1.2 * self.tol and abs(a["ref_rt"] - self._base[f["id"]]["ref_rt"]) <= self.rt_tol for f in kept):
                continue
            kept.append(e)
        self.entries = self.entries[:n0] + kept
        for e in kept:                     # the grid centre is arbitrary: report the observed centroid of the ion
            obs = self.refine(e)
            if obs is not None:
                e["mz_x"], e["mz"] = obs, obs - self.offset
                e["name"] = f"ione non previsto m/z {e['mz']:.1f}"
        good = []
        for e in kept:
            a = self.analyse(e)
            if a["label"] in ("forte", "possibile"):
                good.append(e)
        good.sort(key=lambda e: (-(self._final[e["id"]]["score"] or 0), -e["_area"]))
        self.entries = self.entries[:n0] + good[:int(self.s["max_unexpected"])]
        return len(self.entries) - n0

    def refine(self, e: dict) -> float | None:
        """Observed centroid m/z of the ion: intensity-weighted mean of the peaks in the window, inside the chromatographic peak of the strongest sample."""
        a = self._analyse_base(e)
        if a["ref_rt"] is None:
            return None
        k = max(range(len(a["rows"])), key=lambda i: a["rows"][i]["area"])
        pk = a["peaks"][k]
        if not pk:
            return None
        t = self._table(self.full[k])
        r = t.rt[t.pos]
        a_, b_ = np.searchsorted(t.mz, e["mz_x"] - self.tol), np.searchsorted(t.mz, e["mz_x"] + self.tol)
        sel = (r[a_:b_] >= pk["left"]) & (r[a_:b_] <= pk["right"])
        if not sel.any():
            return None
        w = t.inten[a_:b_][sel]
        obs = float(np.average(t.mz[a_:b_][sel], weights=w))
        e["mz_obs"] = round(obs, 3)
        return obs

    # ------------------------------------------------------------------ MS2
    def _ms2_scans(self, mz_x: float, mz_calc: float):
        out = []
        for x in self.ms2files:
            for s in x.run.scans:
                if s.level == 2 and s.precursor is not None and (abs(s.precursor - mz_x) <= self.tol or abs(s.precursor - mz_calc) <= self.tol):
                    out.append((x, s))
        return out

    def ms2(self, e: dict, top: int = 6, min_rel: float = 0.05) -> dict:
        """Product-ion scans whose precursor is the ion, inside its chromatographic peak: pooled fragments, compared with the parent."""
        key = ("ms2", e["id"])
        if key in self._ms2cache:
            return self._ms2cache[key]
        a = self.analyse(e)
        pks = [pk for pk in a["peaks"] if pk]
        res = {"scans": 0, "fragments": [], "precursor": None}
        if pks and a["ref_rt"] is not None and self.ms2files:
            lo, hi = min(pk["left"] for pk in pks) - 0.05, max(pk["right"] for pk in pks) + 0.05
            frags: dict[float, list] = {}
            ces, n, precs = [], 0, []
            for x, s in self._ms2_scans(e["mz_x"], e["mz"]):
                if not lo <= s.rt <= hi:
                    continue
                mz, it = x.run.read(s.index)
                n += 1
                precs.append(s.precursor)
                if s.collision_energy:
                    ces.append(s.collision_energy)
                for m, i in zip(mz, it):
                    if abs(m - s.precursor) < 1.5:
                        continue
                    frags.setdefault(round(m / 0.3) * 0.3, []).append((m, i))
            if n:
                pooled = [(float(np.average([m for m, _ in v], weights=[i for _, i in v])), sum(i for _, i in v) / n) for v in frags.values()]
                mx = max(i for _, i in pooled)
                pooled = sorted([p for p in pooled if p[1] >= min_rel * mx], key=lambda p: -p[1])[:top]
                res = {"scans": n, "precursor": round(float(np.median(precs)), 2), "collision_energy": float(np.median(ces)) if ces else None,
                       "fragments": [{"mz": round(m, 2), "rel": round(100 * i / mx, 1)} for m, i in pooled]}
        # annotate against the parent
        if e["id"] != self.entries[0]["id"] and res["fragments"]:
            par = self.ms2(self.entries[0], top=10)
            dm = (e["neutral_mass"] - self.entries[0]["neutral_mass"]) if e.get("neutral_mass") and self.entries[0].get("neutral_mass") else None
            shared = shifted = 0
            for f in res["fragments"]:
                f["loss"] = round(res["precursor"] - f["mz"], 2) if res["precursor"] else None
                f["note"] = ""
                for pf in par["fragments"]:
                    if abs(pf["mz"] - f["mz"]) <= 0.5:
                        f["note"], shared = "condiviso col progenitore", shared + 1
                        break
                    if dm is not None and abs(pf["mz"] + dm - f["mz"]) <= 0.5:
                        f["note"], shifted = f"frammento del progenitore {pf['mz']:g} + Δ ({dm:+.2f})", shifted + 1
                        break
            res["shared"], res["shifted"] = shared, shifted
        self._ms2cache[key] = res
        return res

    def transitions(self, ids: list[int]) -> list[dict]:
        rows = []
        for e in self.entries:
            if e["id"] not in ids:
                continue
            a, m = self.analyse(e), self.ms2(e)
            for f in m["fragments"]:
                rows.append({"compound": e["name"], "formula": e["formula"], "Q1": round(e["mz"], 1), "Q3_osservato": f["mz"],
                             "Q3_consigliato": round(f["mz"] - self.offset, 1), "CE": m.get("collision_energy") or "",
                             "RT_attesa_min": round(a["ref_rt"], 2) if a["ref_rt"] else "", "finestra_RT_min": round(2 * self.rt_tol, 2),
                             "intensita_rel_%": f["rel"], "scansioni_ms2": m["scans"], "nota": "candidato: da ottimizzare sullo strumento"})
        return rows

    # ------------------------------------------------------------------ outputs
    def run(self) -> dict:
        self.progress("Calibro l'm/z sul progenitore...", 0.02)
        self.calibrate()
        self.progress("Genero i candidati...", 0.05)
        self.build_candidates()
        n = len(self.entries)
        for i, e in enumerate(self.entries):
            if i % 10 == 0:
                self.progress("Estraggo gli XIC e cerco i picchi...", 0.05 + 0.6 * i / n)
            self.analyse(e)
        if self.s.get("discover", True):
            self.discover()
        self.mrm = None
        if self.mrmfiles:
            self.progress("Integro gli MRM...", 0.93)
            self.mrm = mrm.analyse(self.mrmfiles, self.rt_tol)
        self.progress("Calcolo le tabelle...", 0.97)
        return self.summary()

    def level(self, e: dict, a: dict) -> tuple[int | None, str]:
        if e["kind"] == "candidate" and e["steps"] == 0:
            return None, ""
        ms2 = self.ms2(e) if self.ms2files else None
        return confidence(bool(e.get("formula")), a["label"], ms2)

    def _isf_eval(self, p_rt: float | None, max_ions: int = 30) -> dict:
        """In-source-fragment evidence for the ions that co-elute with the parent (tpmine.isf over mzlab.ionfamily): {entry id: compact result}.
        Never raises: on any failure the caller falls back to the plain "lighter and co-eluting" heuristic."""
        if not p_rt or not self.full:
            return {}
        try:
            from . import isf
            par = self.entries[0]
            cand = [e for e in self.entries[1:] if self.analyse(e)["ref_rt"] and abs(self.analyse(e)["ref_rt"] - p_rt) <= 2 * self.rt_tol
                    and e["mz"] < par["mz"] + 4][:max_ions]          # an ion heavier by more than 4 Da can only be an adduct (kept for the isotope/adduct split)
            if not cand:
                return {}
            samples = [{"label": x.label, "time": x.time, "table": self._table(x), "key": x.path} for x in self.full if x.type != "blank"]
            res = isf.classify_ions(samples, float(par["mz_x"]), [float(e["mz_x"]) for e in cand], chem.fmt(self.neutral) if self.neutral else None, fam=False)
            by = {round(float(i["mz"]), 4): i for i in res["items"]}
            out = {}
            for e in cand:
                i = by.get(round(float(e["mz_x"]), 4))
                if i and i.get("probs"):
                    out[e["id"]] = {"p_inherited": i.get("p_inherited"), "isf_ness": i.get("isf_ness"), "probs": i["probs"], "doubtful": bool(i.get("doubtful")),
                                    "reasons": i.get("reasons", []), "explanation": i.get("explanation", ""), "calibrated": i.get("calibrated")}
            return out
        except Exception:                                              # the private classifier is optional evidence: never break the table
            return {}

    def summary(self) -> dict:
        rows = []
        p_a = self.analyse(self.entries[0])
        p_rt, p_mz = p_a["ref_rt"], self.entries[0]["mz"]
        isf_ev = self._isf_eval(p_rt)
        for e in self.entries:
            a = self.analyse(e)
            kin = self._kinetics(a["rows"])
            lev, ltxt = self.level(e, a)
            rows.append({"id": e["id"], "kind": e["kind"], "name": e["name"], "alternatives": e["alternatives"], "formula": e["formula"],
                         "delta": e["delta"], "mz": round(e["mz"], 4), "steps": e["steps"], "score": a["score"], "label": a["label"],
                         "level": lev, "level_text": ltxt, "ref_rt": round(a["ref_rt"], 2) if a["ref_rt"] else None, "kinetics": kin,
                         "max_area": max([k["area"] for k in kin] or [0.0]),
                         "tmax": max(kin, key=lambda k: k["area"])["time"] if kin and max(k["area"] for k in kin) > 0 else None,
                         "isotope_of": a.get("isotope_of"), "delta_mz": round(e["mz"] - p_mz, 2),
                         # an unexpected ion that co-elutes with the parent and is lighter is most likely an in-source fragment of it
                         "isf": isf_ev.get(e["id"]),
                         # measured evidence (tpmine.isf) when available; otherwise the plain heuristic
                         "insource": bool(isf_ev[e["id"]]["probs"]["isf"] >= 0.5) if e["id"] in isf_ev and e["mz"] < p_mz else
                                     bool(e["id"] not in isf_ev and e["kind"] == "unexpected" and p_rt and a["ref_rt"] and abs(a["ref_rt"] - p_rt) <= 0.5 * self.rt_tol and e["mz"] < p_mz)})
        order = {"progenitore": 0, "forte": 1, "possibile": 2, "debole": 3}
        rows.sort(key=lambda r: (order.get(r["label"], 4), 2 if r["insource"] else (1 if r["kind"] == "unexpected" else 0), -(r["score"] or 0), -r["max_area"]))
        return {"offset": self.offset_info, "decay": self.parent_decay(), "parent": {"formula": chem.fmt(self.neutral) if self.neutral else "",
                "neutral_mass": round(self.parent_neutral_mass, 4), "adduct": self.adduct, "mz": round(self.entries[0]["mz"], 4)},
                "times": sorted({x.time for x in self.full if x.time is not None}), "n_samples": len(self.full),
                "files": [{"name": x.name, "label": x.label, "time": x.time, "type": x.type, "kind": x.kind} for x in self.samples],
                "rows": rows, "settings": self.s, "mrm": getattr(self, "mrm", None)}

    def detail(self, cid: int, max_points: int = 700) -> dict:
        e = next(x for x in self.entries if x["id"] == cid)
        a = self.analyse(e)
        traces = []
        for x, (rt, y), pk in zip(self.full, a["traces"], a["peaks"]):
            step = max(1, len(rt) // max_points)
            traces.append({"label": x.label, "time": x.time, "type": x.type, "rt": [round(float(v), 3) for v in rt[::step]],
                           "y": [round(float(v)) for v in y[::step]],
                           "peak": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in pk.items()} if pk else None})
        lev, ltxt = self.level(e, a)
        return {"id": cid, "name": e["name"], "formula": e["formula"], "mz": round(e["mz"], 4), "mz_extracted": round(e["mz_x"], 3), "mz_observed": e.get("mz_obs") or self.refine(e),
                "delta": e["delta"], "alternatives": e["alternatives"], "score": a["score"], "label": a["label"], "criteria": a["criteria"],
                "level": lev, "level_text": ltxt, "ref_rt": a["ref_rt"], "rows": a["rows"], "traces": traces, "ms2": self.ms2(e),
                "transitions": self.transitions([cid]) if e["kind"] != "candidate" or e["steps"] else []}
