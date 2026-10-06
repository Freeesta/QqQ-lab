"""Exploration of mzML files: chromatograms, mass spectra and ion chromatograms on demand.

Nothing is computed that the user did not ask for: the page starts from the total ion chromatogram and the
students choose what to extract. Unit resolution data: windows are in Da.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .convert import to_mzml
from .project import guess_sample
from .reader.mzml import Run


class Item:
    def __init__(self, file: str, label: str | None, time, typ: str, path: Path, mode: str | None = None):
        self.file, self.time, self.type, self.path = file, time, typ, path
        self.mode = mode if mode in ("q1", "ems") else None        # full scan flavour; the mzML does not say it (chosen by the user or hinted by the name)
        self.label = label or Path(file).stem
        self.run = Run(to_mzml(path))
        self._bpc: dict = {}

    def info(self) -> dict:
        r = self.run
        ms1 = [s for s in r.scans if s.level == 1]
        ms2 = [s for s in r.scans if s.level >= 2]
        t1 = r.table(1) if ms1 else None
        pol = sorted({s.polarity for s in r.scans if s.polarity})
        out = {"file": self.file, "label": self.label, "time": self.time, "type": self.type,
                "scans": len(r.scans), "ms1": len(ms1), "ms2": len(ms2),
                "rt_min": float(min((s.rt for s in r.scans), default=0.0)),
                "rt_max": float(max((s.rt for s in r.scans), default=0.0)),
                "mz_min": float(t1.mz[0]) if t1 is not None and len(t1.mz) else None,
                "mz_max": float(t1.mz[-1]) if t1 is not None and len(t1.mz) else None,
                "polarity": "positive" if pol == [1] else "negative" if pol == [-1] else "mixed" if pol else "unknown",
                "precursors": sorted({round(s.precursor, 1) for s in ms2 if s.precursor}),
                "chromatograms": r.n_chromatograms, "kind": self.kind(), "mode": (self.mode or "q1") if self.kind() == "full" else None,
                "srm": sum(1 for c in r.chromatograms() if c["kind"] == "srm"), "pda": self.has_pda()}
        if not r.scans:                                   # MRM file: no scans, take times and polarity from the chromatograms
            rng = self._srm_rt_range()
            if rng:
                out["rt_min"], out["rt_max"] = rng
            out["polarity"] = self._header_polarity()
        return out

    def kind(self) -> str:
        """Experiment type: 'full' (Q1 scan), 'ms2' (product ion scans) or 'mrm' (SRM chromatograms only)."""
        r = self.run
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
        ms2 = [s for s in r.scans if s.level >= 2]
        rts = np.array([s.rt for s in r.scans if s.level == (1 if kind == "full" else 2)])
        cycle = float(np.median(np.diff(rts)) * 60) if len(rts) > 2 else None
        win = r.scan_window()
        res = {"file": self.file, "kind": kind, **md, "polarity": self.info()["polarity"] if kind != "mrm" else self._header_polarity(), "scans": len(r.scans),
               "rt_min": float(min((s.rt for s in r.scans), default=0.0)), "rt_max": float(max((s.rt for s in r.scans), default=0.0)),
               "pda": self.has_pda(), "cycle_s": cycle, "scan_window": list(win) if win else None,
               "filters": sorted({s.filter for s in r.scans if s.filter})[:6],
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
            t = self.run.table(level)
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
        t = self.run.table(level)
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
        t = self.run.table(level)
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
        t = self.run.table(level)
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
        t = self.run.table(level)
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


class Session:
    def __init__(self, samples: list[dict], root: Path):
        self.items: list[Item] = []
        for s in samples:
            f = Path(s["file"])
            label, t, typ = guess_sample(f.name)
            self.items.append(Item(s["file"], s.get("label") or label,
                                   s["time"] if s.get("time") is not None else t,
                                   s.get("type") or typ, f if f.is_absolute() else root / f, s.get("mode")))

    def info(self) -> list[dict]:
        return [it.info() for it in self.items]

    def grid(self, level: int = 1, rt_bin: float = 0.04, dmz: float = 1.0) -> dict:
        """Common RT x m/z grid for the ion maps of every file that has scans of this level."""
        rts, mzs = [], []
        for it in self.items:
            sc = [x for x in it.run.scans if x.level == level]
            if not sc:
                continue
            rts += [min(x.rt for x in sc), max(x.rt for x in sc)]
            t = it.run.table(level)
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
        return {"kind": i["kind"], "scans": i["scans"], "srm": i["srm"], "polarity": i["polarity"]}
    finally:
        it.run.close()
