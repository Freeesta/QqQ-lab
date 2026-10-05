"""A small reader for mzML files (ProteoWizard / msconvert output, indexed or not).

The file is memory-mapped. One pass finds every <spectrum> and reads the header values (MS level,
retention time, polarity, precursor, collision energy, filter string). The m/z and intensity arrays
(base64, zlib or none, 32 or 64 bit) are decoded when needed. Chromatograms (MRM traces) are
counted but not read: this tool works on full-scan and product-ion scans.
"""
from __future__ import annotations

import base64
import mmap
import re
import zlib
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

_CV = {}


def _cv(header: str, accession: str):
    """The value of the cvParam with this accession, or None."""
    rx = _CV.get(accession)
    if rx is None:
        rx = _CV[accession] = re.compile(r'accession="%s"[^>]*?value="([^"]*)"' % re.escape(accession))
    m = rx.search(header)
    return m.group(1) if m else None


def _float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


@dataclass
class Scan:
    index: int
    native: str
    start: int
    end: int
    level: int
    rt: float              # minutes
    polarity: int          # +1, -1, 0
    tic: float
    precursor: float | None
    collision_energy: float | None
    filter: str


@dataclass
class PeakTable:
    """Peaks of a set of scans, sorted by m/z, for fast extraction of ion chromatograms."""
    rt: np.ndarray                 # retention time of each scan (minutes), in scan order
    scan_ids: np.ndarray           # file index of each scan
    mz: np.ndarray                 # all peaks, sorted by m/z
    inten: np.ndarray
    pos: np.ndarray                # position (in rt) of the scan each peak belongs to
    tic: np.ndarray = field(default=None)

    def xic(self, mz: float, tol_da: float) -> np.ndarray:
        """Summed intensity within mz +- tol_da in every scan (zeros where nothing is there)."""
        a = np.searchsorted(self.mz, mz - tol_da, side="left")
        b = np.searchsorted(self.mz, mz + tol_da, side="right")
        if b <= a:
            return np.zeros(len(self.rt))
        return np.bincount(self.pos[a:b], weights=self.inten[a:b], minlength=len(self.rt))


class Run:
    def __init__(self, path):
        self.path = Path(path)
        with open(self.path, "rb") as fh:
            self._mm = mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ)
        head = self._mm[:4096]
        if b"mzML" not in head:
            raise ValueError(f"{self.path.name} does not look like an mzML file")
        self.scans: list[Scan] = []
        self._index()
        self.n_chromatograms = self._count(b"<chromatogram ")
        self._tables: dict = {}

    def _count(self, pat: bytes) -> int:
        n, pos = 0, 0
        while True:
            pos = self._mm.find(pat, pos)
            if pos < 0:
                return n
            n, pos = n + 1, pos + 1

    def close(self):
        self._mm.close()

    # ------------------------------------------------------------------ index
    def _index(self):
        mm, pos = self._mm, 0
        while True:
            a = mm.find(b"<spectrum ", pos)
            if a < 0:
                break
            b = mm.find(b"</spectrum>", a)
            if b < 0:
                break
            b += len(b"</spectrum>")
            c = mm.find(b"<binaryDataArrayList", a, b)
            h = mm[a:(c if c > 0 else b)].decode("utf-8", "replace")
            m = re.search(r'\sid="([^"]*)"', h)
            lvl = _cv(h, "MS:1000511")
            pol = 1 if 'accession="MS:1000130"' in h else -1 if 'accession="MS:1000129"' in h else 0
            rt = _float(_cv(h, "MS:1000016")) or 0.0
            # retention time unit: minutes unless the cvParam says seconds
            m_rt = re.search(r'accession="MS:1000016"[^>]*unitName="([^"]*)"', h)
            if m_rt and m_rt.group(1).startswith("second"):
                rt /= 60.0
            prec = _float(_cv(h, "MS:1000744"))
            if prec is None:
                prec = _float(_cv(h, "MS:1000827"))
            self.scans.append(Scan(
                index=len(self.scans), native=m.group(1) if m else "", start=a, end=b,
                level=int(float(lvl)) if lvl else 1, rt=rt, polarity=pol,
                tic=_float(_cv(h, "MS:1000285")) or 0.0, precursor=prec,
                collision_energy=_float(_cv(h, "MS:1000045")), filter=_cv(h, "MS:1000512") or ""))
            pos = b

    # ------------------------------------------------------------------ arrays
    def read(self, i: int):
        """(m/z, intensity) arrays of scan i."""
        s = self.scans[i]
        chunk = self._mm[s.start:s.end]
        mz = it = np.zeros(0)
        for blk in re.finditer(rb"<binaryDataArray .*?</binaryDataArray>", chunk, re.S):
            t = blk.group(0)
            k = t.find(b"<binary>")
            head = t[:k].decode("utf-8", "replace")
            if any(x in head for x in ("MS:1002312", "MS:1002313", "MS:1002314")):
                raise ValueError("Numpress compression is not supported: convert with zlib or none")
            data = t[k + 8:t.find(b"</binary>")]
            raw = base64.b64decode(data) if data else b""
            if raw and 'accession="MS:1000574"' in head:   # empty arrays (scans without peaks) carry the flag but no data
                raw = zlib.decompress(raw)
            arr = np.frombuffer(raw, dtype="<f4" if 'accession="MS:1000521"' in head else "<f8").astype(float)
            if 'accession="MS:1000514"' in head:
                mz = arr
            elif 'accession="MS:1000515"' in head:
                it = arr
        n = min(len(mz), len(it))
        return mz[:n], it[:n]

    # ------------------------------------------------------------------ chromatograms (TIC/BPC/SRM)
    def chromatograms(self) -> list[dict]:
        """Header of every <chromatogram>: id, kind (tic/bpc/srm/other), Q1, Q3, collision energy, dwell time."""
        if getattr(self, "_chroms", None) is not None:
            return self._chroms
        out, mm, pos = [], self._mm, 0
        while True:
            a = mm.find(b"<chromatogram ", pos)
            if a < 0:
                break
            b = mm.find(b"</chromatogram>", a)
            if b < 0:
                break
            c = mm.find(b"<binaryDataArrayList", a, b)
            h = mm[a:(c if c > 0 else b)].decode("utf-8", "replace")
            cid = (re.search(r'\sid="([^"]*)"', h) or [None, ""])[1]
            d = {"index": len(out), "id": cid, "start": a, "end": b + len(b"</chromatogram>"), "kind": "other"}
            if cid == "TIC":
                d["kind"] = "tic"
            elif cid == "BPC":
                d["kind"] = "bpc"
            elif cid.startswith("SRM"):
                d["kind"] = "srm"
                for key, rx in (("q1", r"Q1=([0-9.]+)"), ("q3", r"Q3=([0-9.]+)"), ("ce", r"ce=([0-9.]+)")):
                    m = re.search(rx, cid)
                    d[key] = float(m.group(1)) if m else None
                m = re.search(r"name=(.*)$", cid)
                d["name"] = m.group(1).strip() if m else ""
                dw = re.search(r'name="?MS_dwell_time"?\s+value="([^"]*)"', h)
                d["dwell"] = _float(dw.group(1)) if dw else None
            out.append(d)
            pos = b + 1
        self._chroms = out
        return out

    def chromatogram(self, i: int):
        """(rt in minutes, intensity) of chromatogram i."""
        d = self.chromatograms()[i]
        chunk = self._mm[d["start"]:d["end"]]
        arrs = []
        for blk in re.finditer(rb"<binaryDataArray .*?</binaryDataArray>", chunk, re.S):
            t = blk.group(0)
            k = t.find(b"<binary>")
            head = t[:k].decode("utf-8", "replace")
            raw = base64.b64decode(t[k + 8:t.find(b"</binary>")] or b"")
            if raw and 'accession="MS:1000574"' in head:   # empty arrays (scans without peaks) carry the flag but no data
                raw = zlib.decompress(raw)
            a = np.frombuffer(raw, dtype="<f4" if 'accession="MS:1000521"' in head else "<f8").astype(float)
            arrs.append((("MS:1000595" in head), a))
        t = next((a for is_t, a in arrs if is_t), np.zeros(0))
        y = next((a for is_t, a in arrs if not is_t), np.zeros(0))
        n = min(len(t), len(y))
        if 'unitName="second"' in chunk[:chunk.find(b"<binaryDataArrayList")].decode("utf-8", "replace") or b'name="time array" value="" unitCvRef="UO" unitAccession="UO:0000010"' in chunk:
            t = t / 60.0
        return t[:n], y[:n]

    def metadata(self) -> dict:
        """Instrument, software and source file names from the mzML header."""
        head = self._mm[:self._mm.find(b"<run ")].decode("utf-8", "replace")
        def names(block):
            return re.findall(r'<cvParam [^>]*name="([^"]*)"', block)
        ic = re.search(r"<instrumentConfiguration.*?</instrumentConfiguration>", head, re.S)
        ser = re.search(r'name="instrument serial number" value="([^"]*)"', head)
        src = re.findall(r'<sourceFile id="[^"]*" name="([^"]*)"', head)
        soft = re.findall(r'<software id="[^"]*" version="([^"]*)">\s*<cvParam [^>]*name="([^"]*)"', head)
        comp = []
        if ic:
            for kind in ("source", "analyzer", "detector"):
                for blk in re.findall(r"<%s .*?</%s>" % (kind, kind), ic.group(0), re.S):
                    comp.extend(names(blk))
        model = names(ic.group(0))[0] if ic and names(ic.group(0)) else ""
        return {"instrument": model, "serial": ser.group(1) if ser else "", "components": comp,
                "source_files": src, "software": [f"{n} {v}".strip() for v, n in soft]}

    def scan_window(self):
        """(lowest, highest) m/z of the scan windows, or None."""
        lo = hi = None
        for s in self.scans[:50]:
            h = self._mm[s.start:s.end].decode("utf-8", "replace")
            a, b = _cv(h, "MS:1000501"), _cv(h, "MS:1000500")
            if a and b:
                lo = _float(a) if lo is None else min(lo, _float(a))
                hi = _float(b) if hi is None else max(hi, _float(b))
        return (lo, hi) if lo is not None else None

    # ------------------------------------------------------------------ experiments
    def experiments(self) -> list[dict]:
        """Groups of scans: (level, polarity), and for MS2 also the precursor (rounded)."""
        groups: dict = {}
        for s in self.scans:
            key = (s.level, s.polarity, round(s.precursor) if (s.level > 1 and s.precursor) else None)
            g = groups.setdefault(key, {"level": s.level, "polarity": s.polarity, "precursor": key[2], "n": 0,
                                        "rt_min": s.rt, "rt_max": s.rt})
            g["n"] += 1
            g["rt_min"], g["rt_max"] = min(g["rt_min"], s.rt), max(g["rt_max"], s.rt)
        return sorted(groups.values(), key=lambda g: (g["level"], g["polarity"], g["precursor"] or 0))

    def table(self, level: int = 1, polarity: int | None = None) -> PeakTable:
        """Peak table of the scans of one level (and polarity, when the file has both)."""
        key = (level, polarity)
        if key in self._tables:
            return self._tables[key]
        ids = [s.index for s in self.scans if s.level == level and (polarity in (None, 0) or s.polarity in (polarity, 0))]
        rt = np.array([self.scans[i].rt for i in ids])
        tic = np.array([self.scans[i].tic for i in ids])
        mzs, its, poss = [], [], []
        for p, i in enumerate(ids):
            mz, it = self.read(i)
            mzs.append(mz)
            its.append(it)
            poss.append(np.full(len(mz), p, dtype=np.int32))
        mz = np.concatenate(mzs) if mzs else np.zeros(0)
        order = np.argsort(mz, kind="stable")
        t = PeakTable(rt=rt, scan_ids=np.array(ids), mz=mz[order],
                      inten=(np.concatenate(its) if its else np.zeros(0))[order],
                      pos=(np.concatenate(poss) if poss else np.zeros(0, dtype=np.int32))[order], tic=tic)
        self._tables[key] = t
        return t
