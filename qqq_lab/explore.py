"""Exploration of mzML files: chromatograms, mass spectra and ion chromatograms on demand.

Nothing is computed that the user did not ask for: the page starts from the total ion chromatogram and the
students choose what to extract. Unit resolution data: windows are in Da.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .project import guess_sample
from .reader.mzml import Run


class Item:
    def __init__(self, file: str, label: str | None, time, typ: str, path: Path, conc: float | None = None, cunit: str | None = None,
                 part: dict | None = None, run: Run | None = None):
        # part = {"mode": "ms1" | "ms2" | "mrm", "pol": 1 | -1 | None, "tag": "MS2"}: one experiment of a MIXED file (survey + product ions, MRM + EPI, + and - polarity).
        # The parts of a file share one Run (the file is read once); `file` is then "name.mzML#tag", the name of the physical file is `path.name`.
        self.file, self.time, self.type, self.path, self.conc, self.cunit = file, time, typ, path, conc, cunit
        self.part = part
        base = label or Path(path).stem
        self.label = base + (f" · {part['tag']}" if part and not base.endswith(part["tag"]) else "")
        self.run = run or Run(path)
        self.pol = part.get("pol") if part else None
        self.sc = [s for s in self.run.scans if self._match(s)]
        self._bpc: dict = {}
        self._tabs: dict = {}

    def _match(self, s) -> bool:
        p = self.part
        if not p:
            return True
        if p["mode"] == "mrm" or (p.get("pol") not in (None, 0) and s.polarity not in (p["pol"], 0)):
            return False
        return s.level == 1 if p["mode"] == "ms1" else s.level >= 2

    def _tbl(self, level: int):
        """Peak table of this experiment (level and, for a part of a file with both polarities, the polarity)."""
        return self.run.table(level, self.pol)

    def info(self) -> dict:
        r = self.run
        ms1 = [s for s in self.sc if s.level == 1]
        ms2 = [s for s in self.sc if s.level >= 2]
        t1 = self._tbl(1) if ms1 else None
        t2 = self._tbl(2) if ms2 else None
        pol = sorted({s.polarity for s in self.sc if s.polarity})
        out = {"file": self.file, "label": self.label, "time": self.time, "type": self.type, "conc": self.conc, "cunit": self.cunit,
                "scans": len(self.sc), "ms1": len(ms1), "ms2": len(ms2),
                "rt_min": float(min((s.rt for s in self.sc), default=0.0)),
                "rt_max": float(max((s.rt for s in self.sc), default=0.0)),
                "mz_min": float(t1.mz[0]) if t1 is not None and len(t1.mz) else None,
                "mz_max": float(t1.mz[-1]) if t1 is not None and len(t1.mz) else None,
                "mz2_min": float(t2.mz[0]) if t2 is not None and len(t2.mz) else None,
                "mz2_max": float(t2.mz[-1]) if t2 is not None and len(t2.mz) else None,
                "polarity": "positive" if pol == [1] else "negative" if pol == [-1] else "mixed" if pol else "unknown",
                "precursors": sorted({round(s.precursor, 1) for s in ms2 if s.precursor}),
                "ms2_exps": self._ms2_exps(ms2), "chromatograms": r.n_chromatograms, "kind": self.kind(),
                "srm": sum(1 for c in r.chromatograms() if c["kind"] == "srm"), "pda": self.has_pda()}
        if self.part:
            out["part"] = self.part["tag"]
            if self.part["mode"] == "ms2":                # when each product-ion scan started and from which precursor (the triangles on the survey chromatogram)
                out["ms2_events"] = [[round(float(s.rt), 4), round(float(s.precursor), 1) if s.precursor else None] for s in ms2[:20000]]
        if not self.sc:                                # MRM file: no scans, take times and polarity from the chromatograms
            rng = self._srm_rt_range()
            if rng:
                out["rt_min"], out["rt_max"] = rng
            out["polarity"] = self._header_polarity()
        return out

    @staticmethod
    def _ms2_exps(ms2) -> list[dict]:
        """The MS2 experiments of a file: one per precursor (and collision energy), with the number of scans.

        A data-dependent file (IDA/DDA) has a different precursor at every cycle: precursors closer than 0.5 are one group
        (at most 1 m/z wide), named by their most frequent value.
        """
        cnt: dict = {}
        for s in ms2:
            k = (round(s.precursor, 1) if s.precursor else None, s.collision_energy)
            cnt[k] = cnt.get(k, 0) + 1
        rows = sorted(cnt.items(), key=lambda kv: (kv[0][0] or 0, kv[0][1] or 0))
        if len({k[0] for k in cnt}) <= 8:
            return [{"prec": k[0], "ce": k[1], "n": n} for k, n in rows]
        groups: list[dict] = []
        for (pr, ce), n in rows:
            g = groups[-1] if groups else None
            if pr is not None and g and g["lo"] is not None and pr - g["lo"] <= 0.5 and g["ce"] == ce:
                g["n"] += n; g["votes"][pr] = g["votes"].get(pr, 0) + n
            else:
                groups.append({"lo": pr, "ce": ce, "n": n, "votes": {pr: n}})
        return [{"prec": max(g["votes"], key=g["votes"].get), "ce": g["ce"], "n": g["n"]} for g in groups]

    def kind(self) -> str:
        """Experiment type: 'full' (Q1 scan), 'ms2' (product ion scans) or 'mrm' (SRM chromatograms only)."""
        r = self.run
        if self.part:
            return {"ms1": "full", "ms2": "ms2", "mrm": "mrm"}[self.part["mode"]]
        n1 = sum(1 for s in r.scans if s.level == 1)
        n2 = len(r.scans) - n1
        if n2:
            return "ms2"
        if n1:
            return "full"
        return "mrm" if any(c["kind"] == "srm" for c in r.chromatograms()) else "empty"

    def _header_polarity(self) -> str:
        """Polarity from the mzML header (used when there are no scans, e.g. MRM files)."""
        r = self.run
        head = r._mm[:r._mm.find(b"</run>")]
        pos, neg = b'accession="MS:1000130"' in head, b'accession="MS:1000129"' in head
        return "positive" if pos and not neg else "negative" if neg and not pos else "mixed" if pos and neg else "unknown"

    def _srm_rt_range(self):
        """(min, max) retention time in minutes over the SRM chromatograms, or None."""
        r, lo, hi = self.run, None, None
        for c in r.chromatograms():
            if c["kind"] != "srm":
                continue
            t, _ = r.chromatogram(c["index"])
            if len(t):
                lo = float(t.min()) if lo is None else min(lo, float(t.min()))
                hi = float(t.max()) if hi is None else max(hi, float(t.max()))
        return None if lo is None else (lo, hi)

    def mrm(self) -> list[dict]:
        out = []
        for c in self.run.chromatograms():
            if c["kind"] != "srm":
                continue
            t, y = self.run.chromatogram(c["index"])
            out.append({"id": c["index"], "q1": c.get("q1"), "q3": c.get("q3"), "ce": c.get("ce"), "name": c.get("name", ""),
                        "dwell": c.get("dwell"), "rt": [round(float(v), 4) for v in t], "y": [round(float(v), 1) for v in y]})
        return out

    def method(self) -> dict:
        """What the mzML says about how the data were acquired (the source parameters are not stored in mzML)."""
        r, md = self.run, self.run.metadata()
        kind = self.kind()
        ms2 = [s for s in self.sc if s.level >= 2]
        rts = np.array([s.rt for s in self.sc if s.level == (1 if kind == "full" else 2)])
        cycle = float(np.median(np.diff(rts)) * 60) if len(rts) > 2 else None
        win = r.scan_window()
        res = {"file": self.file, "kind": kind, **md, "polarity": self.info()["polarity"] if kind != "mrm" else self._header_polarity(), "scans": len(self.sc),
               "rt_min": float(min((s.rt for s in self.sc), default=0.0)), "rt_max": float(max((s.rt for s in self.sc), default=0.0)),
               "pda": self.has_pda(), "cycle_s": cycle, "scan_window": list(win) if win else None,
               "filters": sorted({s.filter for s in self.sc if s.filter})[:6],
               "precursors": sorted({round(s.precursor, 2) for s in ms2 if s.precursor}),
               "ce": sorted({s.collision_energy for s in ms2 if s.collision_energy is not None}),
               "transitions": [{"q1": c.get("q1"), "q3": c.get("q3"), "ce": c.get("ce"), "name": c.get("name", ""), "dwell": c.get("dwell")}
                               for c in r.chromatograms() if c["kind"] == "srm"]}
        return res

    # ------------------------------------------------------------------ chromatograms
    def has_pda(self) -> bool:
        return any(c["kind"] == "pda" for c in self.run.chromatograms())

    def total(self, kind: str = "tic", level: int = 1, mz0: float | None = None, mz1: float | None = None,
              prec: float | None = None):
        """Chromatogram of the whole file. prec (MS2 files): only the scans of that precursor ion (None = all the precursors)."""
        rt, y = self._total(kind, level, mz0, mz1)
        if prec is not None and level > 1 and len(rt):
            t = self._tbl(level)
            pr = np.array([self.run.scans[i].precursor or -1.0 for i in t.scan_ids])
            sm = np.abs(pr - prec) <= 0.6
            if len(sm) == len(rt):
                return rt[sm], y[sm]
        return rt, y

    def _total(self, kind: str, level: int, mz0, mz1):
        if kind == "pda":                       # UV trace recorded by the PDA/DAD (own time axis, not tied to the MS scans)
            for c in self.run.chromatograms():
                if c["kind"] == "pda":
                    return self.run.chromatogram(c["index"])
            return np.zeros(0), np.zeros(0)
        if self.kind() == "mrm":
            for c in self.run.chromatograms():
                if c["kind"] == kind or (kind == "tic" and c["kind"] == "tic"):
                    t, y = self.run.chromatogram(c["index"])
                    return t, y
            return np.zeros(0), np.zeros(0)
        t = self._tbl(level)
        if len(t.rt) == 0:
            return np.zeros(0), np.zeros(0)
        if mz0 is not None or mz1 is not None:          # only the ions inside [mz0, mz1] (None = open end)
            keep = np.ones(len(t.mz), dtype=bool)
            if mz0 is not None:
                keep &= t.mz >= mz0
            if mz1 is not None:
                keep &= t.mz <= mz1
            pos, inten = t.pos[keep], t.inten[keep]
            if kind == "tic":
                return t.rt, np.bincount(pos, weights=inten, minlength=len(t.rt))
            out = np.zeros(len(t.rt))
            if len(pos):
                order = np.argsort(pos, kind="stable")
                ps, ys = pos[order], inten[order]
                starts = np.flatnonzero(np.r_[True, ps[1:] != ps[:-1]])
                out[ps[starts]] = np.maximum.reduceat(ys, starts)
            return t.rt, out
        if kind == "tic":
            return t.rt, np.bincount(t.pos, weights=t.inten, minlength=len(t.rt))
        key = level
        if key not in self._bpc:
            order = np.argsort(t.pos, kind="stable")
            ps, ys = t.pos[order], t.inten[order]
            out = np.zeros(len(t.rt))
            if len(ps):
                starts = np.flatnonzero(np.r_[True, ps[1:] != ps[:-1]])
                out[ps[starts]] = np.maximum.reduceat(ys, starts)
            self._bpc[key] = out
        return t.rt, self._bpc[key]

    def xic(self, mz: float, tol: float, level: int = 1):
        t = self._tbl(level)
        return t.rt, t.xic(mz, tol)

    # ------------------------------------------------------------------ ion map (RT x m/z)
    def ionmap(self, level: int, grid: dict) -> np.ndarray:
        """Mean intensity per scan on a common RT x m/z grid, shape (nrt, nmz), float32.

        The grid (rt0, rt1, nrt, mz0, dmz, nmz) is shared by all files of a session, so maps can be compared
        or subtracted bin by bin. Intensities are averaged over the scans that fall in the same RT bin.
        """
        key = (level, grid["rt0"], grid["rt1"], grid["nrt"], grid["mz0"], grid["dmz"], grid["nmz"])
        cache = self.__dict__.setdefault("_maps", {})
        if key in cache:
            return cache[key]
        nrt, nmz = grid["nrt"], grid["nmz"]
        t = self._tbl(level)
        out = np.zeros((nrt, nmz), dtype=np.float32)
        if len(t.rt) and len(t.mz):
            span = max(grid["rt1"] - grid["rt0"], 1e-9)
            scan_bin = np.clip(np.floor((t.rt - grid["rt0"]) / span * nrt).astype(np.int64), 0, nrt - 1)
            n_scans = np.bincount(scan_bin, minlength=nrt)
            i = scan_bin[t.pos]
            j = np.floor((t.mz - grid["mz0"]) / grid["dmz"]).astype(np.int64)
            ok = (j >= 0) & (j < nmz)
            acc = np.bincount(i[ok] * nmz + j[ok], weights=t.inten[ok], minlength=nrt * nmz).reshape(nrt, nmz)
            out = (acc / np.maximum(n_scans, 1)[:, None]).astype(np.float32)
        cache[key] = out
        return out

    # ------------------------------------------------------------------ spectra
    def _binned(self, rt0, rt1, level=1, precursor=None, prec_tol=0.6, bin_da=0.1):
        """Mean spectrum in [rt0, rt1] on a fixed bin grid: (bin ids, centroid m/z, mean intensity, n scans)."""
        e = (np.zeros(0, dtype=np.int64), np.zeros(0), np.zeros(0))
        t = self._tbl(level)
        if len(t.rt) == 0:
            return (*e, 0)
        ok = (t.rt >= min(rt0, rt1)) & (t.rt <= max(rt0, rt1))
        if level > 1 and precursor is not None:
            prec = np.array([self.run.scans[i].precursor or -1.0 for i in t.scan_ids])
            ok &= np.abs(prec - precursor) <= prec_tol
        n = int(ok.sum())
        if n == 0:
            return (*e, 0)
        m = ok[t.pos]
        mz, y = t.mz[m], t.inten[m]
        if len(mz) == 0:
            return (*e, n)
        b = np.floor(mz / bin_da).astype(np.int64)
        u, inv = np.unique(b, return_inverse=True)
        sy = np.bincount(inv, weights=y)
        smz = np.bincount(inv, weights=y * mz) / np.maximum(sy, 1e-12)
        return u, smz, sy / n, n

    def scan_count(self, level: int = 1, precursor: float | None = None, prec_tol: float = 0.6) -> int:
        """Number of scans of that level (and precursor) = the length of the chromatogram of the same selection."""
        return len(self._scan_ids(level, precursor, prec_tol)[0])

    def _scan_ids(self, level, precursor, prec_tol):
        t = self._tbl(level)
        ids, rt = t.scan_ids, t.rt
        if level > 1 and precursor is not None and len(ids):
            pr = np.array([self.run.scans[i].precursor or -1.0 for i in ids])
            sm = np.abs(pr - precursor) <= prec_tol
            ids, rt = ids[sm], rt[sm]
        return ids, rt

    def window_scans(self, rt0: float, rt1: float, level: int = 1, precursor: float | None = None, prec_tol: float = 0.6) -> dict:
        """Which scans a time window holds: positions (in the chromatogram of the same level / precursor) of the first and the last one, and the total."""
        ids, rt = self._scan_ids(level, precursor, prec_tol)
        ok = np.where((rt >= min(rt0, rt1)) & (rt <= max(rt0, rt1)))[0]
        return {"i0": int(ok[0]) if len(ok) else None, "i1": int(ok[-1]) if len(ok) else None, "n": int(len(ids))}

    def scans(self, i0: int, i1: int, level: int = 1, precursor: float | None = None, prec_tol: float = 0.6, bin_da: float = 0.1) -> list[dict]:
        """Binned spectra of scans i0..i1 (inclusive; position in the chromatogram of the same level/precursor), one by one.

        Reads the arrays of those scans straight from the file (no filtering of the whole peak table) and bins them exactly as `spectrum`
        does for a window holding that single scan: same bins of bin_da Da, same intensity-weighted m/z.
        """
        ids, rt = self._scan_ids(level, precursor, prec_tol)
        out = []
        for i in range(max(i0, 0), min(i1, len(ids) - 1) + 1):
            mz, y = self.run.read(int(ids[i]))
            if len(mz):
                b = np.floor(mz / bin_da).astype(np.int64)
                u, inv = np.unique(b, return_inverse=True)
                sy = np.bincount(inv, weights=y)
                mz, y = np.bincount(inv, weights=y * mz) / np.maximum(sy, 1e-12), sy
            out.append({"i": i, "rt": float(rt[i]), "mz": mz, "y": y})
        return out

    def spectrum(self, rt0: float, rt1: float, level: int = 1, precursor: float | None = None,
                 prec_tol: float = 0.6, bin_da: float = 0.1, min_rel: float = 0.0, bg: dict | None = None):
        """Mean spectrum of the scans in [rt0, rt1], peaks merged within bin_da.

        bg = {"item": Item, "rt0": .., "rt1": .., "factor": 1.0} subtracts a background spectrum
        (another time window, or the blank file) bin by bin and clips at zero, like Xcalibur's
        "subtract spectrum". Both spectra are mean intensity per scan, so windows of different length are comparable.
        """
        u, smz, sy, n = self._binned(rt0, rt1, level, precursor, prec_tol, bin_da)
        if bg is not None and len(u):
            bu, _, by, bn = bg["item"]._binned(bg["rt0"], bg["rt1"], level, precursor, prec_tol, bin_da)
            if bn and len(bu):
                idx = np.searchsorted(bu, u)
                idx[idx >= len(bu)] = len(bu) - 1
                hit = bu[idx] == u
                sy = np.maximum(sy - np.where(hit, by[idx], 0.0) * float(bg.get("factor", 1.0)), 0.0)
                keep = sy > 0
                smz, sy = smz[keep], sy[keep]
        if min_rel > 0 and len(sy):
            keep = sy >= min_rel * sy.max()
            smz, sy = smz[keep], sy[keep]
        return smz, sy, n


def file_parts(run) -> list[dict]:
    """The experiments of a MIXED file (survey + product ions, MRM + EPI, positive + negative polarity), or [] when the file has only one.

    Each part is {"mode": "ms1" | "ms2" | "mrm", "pol": 1 | -1 | None, "tag": "MS1" | "MS2" | "MRM" (+ " pos" / " neg" when both polarities are there)}.
    """
    sc = run.scans
    split = len({s.polarity for s in sc if s.polarity in (1, -1)}) > 1
    parts = []
    for mode, name, test in (("ms1", "MS1", lambda s: s.level == 1), ("ms2", "MS2", lambda s: s.level >= 2)):
        sel = [s for s in sc if test(s)]
        if not sel:
            continue
        for pol in (sorted({s.polarity for s in sel if s.polarity in (1, -1)}, reverse=True) if split else [None]):
            parts.append({"mode": mode, "pol": pol, "tag": name + ((" pos" if pol == 1 else " neg") if split else "")})
    if any(c["kind"] == "srm" for c in run.chromatograms()):
        parts.append({"mode": "mrm", "pol": None, "tag": "MRM"})
    return parts if len(parts) > 1 else []


def mixed_text(run) -> str:
    """One line for the loading table: what a mixed file holds ('' for a file with a single experiment)."""
    parts = file_parts(run)
    if not parts:
        return ""
    n_prec = len({round(s.precursor) for s in run.scans if s.level >= 2 and s.precursor})
    names = {"ms1": "Full Scan", "ms2": "MS2", "mrm": "MRM"}
    out = []
    for p in parts:
        t = names[p["mode"]] + ((" pos" if p["pol"] == 1 else " neg") if p["pol"] else "")
        if p["mode"] == "ms2" and n_prec:
            t += f" ({n_prec} precursor{'i' if n_prec != 1 else 'e'})"
        out.append(t)
    return " + ".join(out)


class Session:
    def __init__(self, samples: list[dict], root: Path):
        self.items: list[Item] = []
        for s in samples:
            name, _, tag = str(s["file"]).partition("#")      # "x.mzML#MS2" = the MS2 part of a mixed file (as saved in the notebook)
            f = Path(name)
            label, t, typ = guess_sample(f.name)
            path = f if f.is_absolute() else root / f
            run = Run(path)
            parts = file_parts(run)
            common = (s.get("label") or label, s["time"] if s.get("time") is not None else t, s.get("type") or typ)
            if not parts:
                self.items.append(Item(name, *common[:1], common[1], common[2], path, s.get("conc"), s.get("cunit"), run=run))
                continue
            for p in ([q for q in parts if q["tag"] == tag] if tag else parts):
                self.items.append(Item(f"{name}#{p['tag']}", common[0], common[1], common[2], path, s.get("conc"), s.get("cunit"), part=p, run=run))

    def info(self) -> list[dict]:
        return [it.info() for it in self.items]

    def grid(self, level: int = 1, rt_bin: float = 0.04, dmz: float = 1.0) -> dict:
        """Common RT x m/z grid for the ion maps of every file that has scans of this level."""
        rts, mzs = [], []
        for it in self.items:
            sc = [x for x in it.sc if x.level == level]
            if not sc:
                continue
            rts += [min(x.rt for x in sc), max(x.rt for x in sc)]
            t = it._tbl(level)
            if len(t.mz):
                mzs += [float(t.mz[0]), float(t.mz[-1])]
        if not rts or not mzs:
            return {"rt0": 0.0, "rt1": 1.0, "nrt": 1, "mz0": 0.0, "dmz": dmz, "nmz": 1}
        rt0, rt1 = float(np.floor(min(rts))), float(np.ceil(max(rts)))
        nrt = int(min(600, max(50, round((rt1 - rt0) / rt_bin))))
        mz0, mz1 = float(np.floor(min(mzs))), float(np.ceil(max(mzs)))
        return {"rt0": rt0, "rt1": rt1, "nrt": nrt, "mz0": mz0, "dmz": dmz, "nmz": int(max(1, round((mz1 - mz0) / dmz)))}


def sniff(path: Path) -> dict:
    """What an mzML contains, read from the file itself (not from its name): {kind, scans, srm, polarity}."""
    it = Item(path.name, None, None, "sample", path)
    try:
        i = it.info()
        return {"kind": i["kind"], "scans": i["scans"], "srm": i["srm"], "polarity": i["polarity"], "mixed": mixed_text(it.run)}
    finally:
        it.run.close()
