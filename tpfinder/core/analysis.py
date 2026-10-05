"""The analysis of an experiment: candidates, extracted ion chromatograms, peaks, scores, MS/MS."""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from .. import __version__
from ..chem import elements as E
from ..chem.transformations import generate
from ..convert import to_mzml
from ..project import Project
from ..reader.mzml import Run
from .peaks import find_peak, smooth
from .score import M2_SHIFT, halogen_expectation, score_candidate


class Analysis:
    def __init__(self, project: Project):
        self.p = project
        s = project.settings
        self.tol = float(s["tol_da"])
        self.rt_tol = float(s["rt_tol_min"])
        self.rt_min = float(s.get("rt_min", 0.0))
        self.pol = 1 if project.parent.get("polarity", "positive") == "positive" else -1
        self.runs: list[Run] = []
        self.tables = []
        for smp in project.samples:
            mz_path = to_mzml(smp.path, s.get("convert_args"))
            r = Run(mz_path)
            self.runs.append(r)
            self.tables.append(r.table(1, self.pol))
        self.candidates = generate(project.parent, project.transformations, int(s["max_steps"]), self.tol)
        self._final = {}
        self._cache: dict[int, dict] = {}
        self._parent_rt: float | None = None

    # ------------------------------------------------------------------ chromatograms
    def trace(self, k: int, mz: float):
        """(rt, y) of sample k, with everything before rt_min removed."""
        t = self.tables[k]
        y = t.xic(mz, self.tol)
        keep = t.rt >= self.rt_min
        return t.rt[keep], y[keep]

    def _peaks_for(self, mz: float, ref_rt: float | None = None):
        """Peak of every sample at the same reference RT (that of the strongest treated sample)."""
        thr = self.p.thresholds["peak"]
        sk = int(thr.get("smooth_points", 3))
        traces = [self.trace(k, mz) for k in range(len(self.runs))]
        if ref_rt is None:
            best = None
            for k, smp in enumerate(self.p.samples):
                if smp.type != "sample":
                    continue
                pk = find_peak(*traces[k], rt_center=None, smooth_k=sk, min_points=int(thr["min_points"]))
                if pk and (best is None or pk["height"] > best["height"]):
                    best = pk
            ref_rt = best["apex_rt"] if best else None
        peaks = [find_peak(rt, y, rt_center=ref_rt, rt_tol=self.rt_tol, smooth_k=sk, min_points=int(thr["min_points"]))
                 if ref_rt is not None else None for rt, y in traces]
        return ref_rt, traces, peaks

    # ------------------------------------------------------------------ one candidate
    def analyse(self, cid: int) -> dict:
        """Base analysis plus the isotope check against the other ions of the experiment."""
        if cid in self._final:
            return self._final[cid]
        out = dict(self._analyse_base(cid))
        c = self.candidates[cid]
        if c["steps"] > 0 and out.get("score") is not None:
            hit = self._isotope_of(cid, out)
            crit = list(out["criteria"])
            if hit:
                crit.append({"name": "non è un picco isotopico", "status": "fail",
                             "text": f"sembra il picco {hit[1]} di m/z {hit[0]['mz']:.4f} ({hit[0]['name']})"})
                out["score"] = min(out["score"], 40)
                out["label"] = "weak"
            else:
                crit.append({"name": "non è un picco isotopico", "status": "pass", "text": "nessuno ione più intenso a M-1 o M-2 nello stesso picco"})
            out["criteria"] = crit
            out["isotope_of"] = hit[0]["id"] if hit else None
        self._final[cid] = out
        return out

    ISOTOPE_SHIFTS = ((1.00335, "13C (M+1)"), (2.0067, "M+2"), (1.99580, "34S (M+2)"))

    def _isotope_of(self, cid: int, a: dict):
        """A candidate is an isotope peak if a stronger ion sits one isotope step below in the same peak.
        At unit resolution (window of a few tenths of Da) this is the main false-positive source."""
        c = self.candidates[cid]
        area = max([r["area"] for r in a["rows"] if r["detected"]] or [0.0])
        if area <= 0 or a["ref_rt"] is None:
            return None
        for d in self.candidates:
            if d["id"] == cid:
                continue
            for shift, name in self.ISOTOPE_SHIFTS:
                if abs(d["mz"] + shift - c["mz"]) > self.tol:
                    continue
                b = self._analyse_base(d["id"])
                if b["ref_rt"] is None or abs(b["ref_rt"] - a["ref_rt"]) > self.rt_tol:
                    continue
                barea = max([r["area"] for r in b["rows"] if r["detected"]] or [0.0])
                if barea > 0 and area <= 0.5 * barea:
                    return d, name
        return None

    def _analyse_base(self, cid: int) -> dict:
        if cid in self._cache:
            return self._cache[cid]
        c = self.candidates[cid]
        thr = self.p.thresholds
        ref_rt, traces, peaks = self._peaks_for(c["mz"])
        rows = []
        for smp, pk in zip(self.p.samples, peaks):
            det = bool(pk and pk["ok"] and pk["snr"] >= thr["peak"]["snr_min"])
            rows.append({"label": smp.label, "time": smp.time, "type": smp.type,
                         "area": float(pk["area"]) if pk else 0.0, "height": float(pk["height"]) if pk else 0.0,
                         "snr": float(pk["snr"]) if pk else 0.0, "points": int(pk["points"]) if pk else 0,
                         "apex_rt": float(pk["apex_rt"]) if pk else None, "detected": det})
        # chlorine / bromine pattern in the strongest sample
        exp = halogen_expectation(c.get("formula_dict"))
        obs = None
        if exp is not None and ref_rt is not None:
            kbest = max(range(len(rows)), key=lambda k: rows[k]["area"])
            _, _, pk2 = self._peaks_for(c["mz"] + M2_SHIFT, ref_rt)
            if pk2[kbest] and pk2[kbest]["ok"] and rows[kbest]["area"] > 0:
                obs = pk2[kbest]["area"] / rows[kbest]["area"]
        sc = ({"score": None, "label": "parent", "criteria": []} if c["steps"] == 0
              else score_candidate(rows, thr, exp, obs))
        out = {"id": cid, "ref_rt": ref_rt, "rows": rows, "peaks": peaks, "traces": traces, **sc}
        self._cache[cid] = out
        return out

    def summary(self) -> list[dict]:
        """One row per candidate for the table."""
        out = []
        for c in self.candidates:
            a = self.analyse(c["id"])
            timed = sorted([r for r in a["rows"] if r["type"] == "sample" and r["time"] is not None],
                           key=lambda r: r["time"])
            out.append({"id": c["id"], "name": c["name"], "alternatives": c["alternatives"], "formula": c["formula"],
                        "delta": c["delta"], "mz": round(c["mz"], 4), "steps": c["steps"],
                        "isobaric_with": c["isobaric_with"], "score": a["score"], "label": a["label"],
                        "ref_rt": a["ref_rt"],
                        "kinetics": [{"time": r["time"], "area": r["area"] if r["detected"] else 0.0} for r in timed],
                        "max_area": max([r["area"] for r in a["rows"] if r["detected"]] or [0.0])})
        return out

    # ------------------------------------------------------------------ MS/MS and transitions
    def ms2(self, cid: int, top: int = 5, min_rel: float = 0.05) -> dict:
        """Product-ion scans whose precursor is the candidate, inside its peak: pooled fragments."""
        c, a = self.candidates[cid], self.analyse(cid)
        pks = [pk for pk in a["peaks"] if pk]
        if not pks or a["ref_rt"] is None:
            return {"scans": 0, "fragments": []}
        lo = min(pk["left"] for pk in pks) - 0.05
        hi = max(pk["right"] for pk in pks) + 0.05
        frags: dict[float, list[float]] = {}
        ces, n = [], 0
        for run, smp in zip(self.runs, self.p.samples):
            if smp.type == "blank":
                continue
            for s in run.scans:
                if s.level != 2 or s.precursor is None or abs(s.precursor - c["mz"]) > self.tol or not lo <= s.rt <= hi:
                    continue
                mz, it = run.read(s.index)
                n += 1
                if s.collision_energy:
                    ces.append(s.collision_energy)
                for m, i in zip(mz, it):
                    if abs(m - s.precursor) < 1.5:
                        continue
                    key = round(m / 0.3) * 0.3                   # unit resolution: merge within ~0.3 Da
                    frags.setdefault(key, []).append((m, i))
        if not n:
            return {"scans": 0, "fragments": []}
        pooled = [(float(np.average([m for m, _ in v], weights=[i for _, i in v])), sum(i for _, i in v) / n)
                  for v in frags.values()]
        mx = max(i for _, i in pooled)
        pooled = sorted([p for p in pooled if p[1] >= min_rel * mx], key=lambda p: -p[1])[:top]
        return {"scans": n, "collision_energy": float(np.median(ces)) if ces else None,
                "fragments": [{"mz": round(m, 2), "rel": round(100 * i / mx, 1)} for m, i in pooled]}

    def transitions(self, cids: list[int]) -> list[dict]:
        rows = []
        for cid in cids:
            c, a = self.candidates[cid], self.analyse(cid)
            m = self.ms2(cid)
            rt = a["ref_rt"]
            for f in m["fragments"]:
                rows.append({"compound": c["name"], "Q1": round(c["mz"], 2), "Q3": f["mz"],
                             "CE": m["collision_energy"] if m["collision_energy"] is not None else "",
                             "expected_RT_min": round(rt, 2) if rt is not None else "",
                             "RT_window_min": round(2 * self.rt_tol, 2),
                             "relative_intensity_pct": f["rel"], "ms2_scans": m["scans"],
                             "note": "candidate, to be optimised on the instrument"})
        return rows

    # ------------------------------------------------------------------ provenance
    def provenance(self) -> dict:
        def sha(p: Path) -> str:
            h = hashlib.sha256()
            with open(p, "rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 20), b""):
                    h.update(chunk)
            return h.hexdigest()[:16]
        return {"tpfinder": __version__, "parent": self.p.parent, "settings": self.p.settings,
                "thresholds": self.p.thresholds, "config_files": self.p.config_files,
                "samples": [{"label": s.label, "time": s.time, "type": s.type, "file": r.path.name,
                             "sha256_16": sha(r.path)} for s, r in zip(self.p.samples, self.runs)]}
