"""A small reader for mzML files (ProteoWizard / msconvert output, indexed or not).

The file is memory-mapped. One pass finds every <spectrum> and reads the header values (MS level,
retention time, polarity, precursor, collision energy, filter string). The m/z and intensity arrays
(base64, zlib or none, 32 or 64 bit) are decoded when needed. Chromatograms (MRM traces) are
counted but not read: this tool works on full-scan and product-ion scans.
"""
from __future__ import annotations

import base64
import mmap
import os
import re
import time
import zlib
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .profile import analyzer_from_components, mass_profile

_CV = {}
_ANALYZERS = ("FTMS", "ITMS", "TOFMS", "TQMS", "SQMS")      # first token of a Thermo filter string
_RX_REF = re.compile(r'<precursor\b[^>]*?spectrumRef="([^"]*)"')
_RX_ICREF = re.compile(r'<scan\b[^>]*?instrumentConfigurationRef="([^"]*)"')
_RX_ACT = re.compile(r"@(hcd|cid|etd|ecd|pqd|uvpd)", re.I)


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


# Files above this size, or mounted from a browser Blob (WORKERFS, which cannot be memory-mapped), are read with _FileBuf
FILE_MODE_BYTES = 300 << 20
WORKERFS_ROOT = "/big"


class _FileBuf:
    """The small part of the mmap interface the reader uses (find, slicing, len, close), over a plain file.

    A Blob mounted with WORKERFS in the browser cannot be mapped, and a very large file is better not mapped at all.
    Searches run inside a read-ahead window (CACHE bytes), so walking through the spectra reads the file about once.
    """
    CACHE = 16 << 20

    def __init__(self, path):
        self._fh = open(path, "rb")
        self._fh.seek(0, os.SEEK_END)
        self._n = self._fh.tell()
        self._off, self._buf = 0, b""

    def __len__(self):
        return self._n

    def _read(self, a, b):
        self._fh.seek(a)
        return self._fh.read(b - a)

    def _window(self, pos, need):
        """Make the read-ahead window cover [pos, pos + need) (or reach the end of the file)."""
        end = self._off + len(self._buf)
        if self._off <= pos and (pos + need <= end or end >= self._n):
            return
        self._off = pos
        self._buf = self._read(pos, min(self._n, pos + max(self.CACHE, need)))

    def find(self, pat, start=0, end=None):
        end = self._n if end is None else min(end, self._n)
        pos, keep = max(start, 0), len(pat) - 1
        while pos + len(pat) <= end:
            self._window(pos, len(pat))
            stop = self._off + len(self._buf)
            i = self._buf.find(pat, pos - self._off, min(end, stop) - self._off)
            if i >= 0:
                return self._off + i
            if stop >= end or stop >= self._n:
                return -1
            pos = stop - keep            # overlap, so a pattern across two windows is found
        return -1

    def __getitem__(self, key):
        if not isinstance(key, slice):
            return self._read(key, key + 1)[0]
        a, b, _ = key.indices(self._n)
        if b <= a:
            return b""
        end = self._off + len(self._buf)
        if self._off <= a and b <= end:
            return self._buf[a - self._off:b - self._off]
        return self._read(a, b)

    def close(self):
        self._fh.close()
        self._buf = b""


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
    profile: bool = False  # the scan is a profile spectrum (MS:1000128), not centroids (MS:1000127)
    # --- fields for high resolution / DDA (None = the file does not say) ---
    parent: int | None = None          # index of the Full Scan the MS2 was triggered from (spectrumRef; otherwise the previous MS1 of the same polarity)
    iso: tuple | None = None           # isolation window (low, high) in m/z, absolute
    act: str | None = None             # activation: "HCD", "CID", "ETD"...
    res: float | None = None           # mass resolving power of the scan (MS:1000800)
    an: str | None = None              # analyzer: FTMS / ITMS / TOFMS / TQMS / SQMS, or "?" (see Run._analyzer)
    pint: float | None = None          # intensity of the selected ion in the survey scan (MS:1000042)


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
        lo, hi = mz - tol_da, mz + tol_da
        if self.mz.dtype == np.float32:      # keep the limits float32 too, otherwise numpy would convert the whole table to float64
            lo, hi = np.float32(lo), np.float32(hi)
        a = np.searchsorted(self.mz, lo, side="left")
        b = np.searchsorted(self.mz, hi, side="right")
        if b <= a:
            return np.zeros(len(self.rt))
        return np.bincount(self.pos[a:b], weights=self.inten[a:b], minlength=len(self.rt))


class Run:
    def __init__(self, path, mode="auto"):
        """mode: "mmap", "file" (plain reads: Blobs mounted in the browser, very large files) or "auto"."""
        self.path = Path(path)
        if mode == "auto":
            big = self.path.stat().st_size > FILE_MODE_BYTES or os.path.realpath(self.path).startswith(WORKERFS_ROOT + "/")
            mode = "file" if big else "mmap"
        self.mode = mode
        if mode == "file":
            self._mm = _FileBuf(self.path)
        else:
            with open(self.path, "rb") as fh:
                self._mm = mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ)
        head = self._mm[:4096]
        if b"mzML" not in head:
            raise ValueError(f"{self.path.name} does not look like an mzML file")
        self.scans: list[Scan] = []
        self._read_header()
        self.timing: dict = {}                       # seconds spent reading the file ("indice", "tabella MS1"...), shown by the ?perf meter
        t0 = time.perf_counter()
        self._index()
        self.timing["indice"] = round(time.perf_counter() - t0, 3)
        self.n_chromatograms = self._count(b"<chromatogram ")
        self._tables: dict = {}

    def _read_header(self):
        """Instrument configurations (analyzers of each), the default one, and whether the file comes from Thermo (relative collision energy)."""
        head = self._mm[:max(self._mm.find(b"<run "), 0) or 200000].decode("utf-8", "replace")
        self.nce = 'accession="MS:1000768"' in head                       # Thermo nativeID format: the "collision energy" is relative (NCE), not eV
        self._ic: dict = {}
        for m in re.finditer(r'<instrumentConfiguration\s+id="([^"]*)"(.*?)</instrumentConfiguration>', head, re.S):
            names = []
            for blk in re.findall(r"<analyzer\b.*?</analyzer>", m.group(2), re.S):
                names += re.findall(r'<cvParam [^>]*name="([^"]*)"', blk)
            self._ic[m.group(1)] = analyzer_from_components(names)
        mm = re.search(r'<run\b[^>]*defaultInstrumentConfigurationRef="([^"]*)"', self._mm[:self._mm.find(b"<run ") + 2000].decode("utf-8", "replace"))
        self._ic_default = (mm.group(1) if mm and mm.group(1) in self._ic else next(iter(self._ic), None))

    def _analyzer(self, filt: str, ic_ref: str | None) -> str:
        """Analyzer code of a scan: the first token of a Thermo filter string; else the analyzer of its (or the default) instrumentConfiguration; else "?"."""
        tok = filt.split(" ", 1)[0].upper() if filt else ""
        if tok in _ANALYZERS:
            return tok
        return self._ic.get(ic_ref or "", self._ic.get(self._ic_default or "", "?"))

    def _link_parents(self, refs: dict):
        """Parent of every MS2: the Full Scan its spectrumRef names; when that is missing, the last MS1 before it with the same polarity."""
        by_native = {s.native: s.index for s in self.scans}
        last: dict = {}
        for s in self.scans:
            if s.level == 1:
                last[s.polarity] = s.index
            elif s.level > 1:
                ref = refs.get(s.index)
                s.parent = by_native.get(ref) if ref else None
                if s.parent is None:
                    s.parent = last.get(s.polarity, last.get(0))
        self.hr1 = bool(mass_profile([s for s in self.scans if s.level == 1])["hr"])        # high-resolution survey scans (used to size the peak table)

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
        mm, pos, refs = self._mm, 0, {}
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
            lvl_i = int(float(lvl)) if lvl else 1
            hs = h.split("<precursorList", 1)[0]                   # what belongs to the scan itself, not to its precursor (a "ms level" there is the parent's)
            filt = _cv(hs, "MS:1000512") or ""
            iso = act = pint = None
            if lvl_i > 1:
                tgt = _float(_cv(h, "MS:1000827"))
                tgt = prec if tgt is None else tgt
                if tgt is not None:
                    lo, hi = _float(_cv(h, "MS:1000828")), _float(_cv(h, "MS:1000829"))
                    iso = (tgt - (0.5 if lo is None else lo), tgt + (0.5 if hi is None else hi))
                act = "HCD" if 'accession="MS:1000422"' in h else "CID" if 'accession="MS:1000133"' in h else "ETD" if 'accession="MS:1000598"' in h else None
                if act is None:
                    ma = _RX_ACT.search(filt)
                    act = ma.group(1).upper() if ma else None
                pint = _float(_cv(h, "MS:1000042"))
                mr = _RX_REF.search(h)
                if mr:
                    refs[len(self.scans)] = mr.group(1)
            mi = _RX_ICREF.search(hs)
            self.scans.append(Scan(
                index=len(self.scans), native=m.group(1) if m else "", start=a, end=b,
                level=lvl_i, rt=rt, polarity=pol,
                tic=_float(_cv(h, "MS:1000285")) or 0.0, precursor=prec,
                collision_energy=_float(_cv(h, "MS:1000045")), filter=filt,
                profile='accession="MS:1000128"' in h, iso=iso, act=act, res=_float(_cv(hs, "MS:1000800")), pint=pint,
                an=self._analyzer(filt, mi.group(1) if mi else None)))
            pos = b
        self._link_parents(refs)

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
        """Header of every <chromatogram>: id, kind (tic/bpc/pda/srm/other), Q1, Q3, collision energy, dwell time."""
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
            elif cid == "TWC":                  # total wavelength chromatogram = PDA/DAD signal summed over wavelengths
                d["kind"] = "pda"
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
        # the model: the first cvParam of the instrumentConfiguration (or of the referenceableParamGroup it points to) that is not the serial number
        # nor a component (Thermo files keep it in a referenceableParamGroup; the 3200 QTRAP writes it directly)
        own = ic.group(0).split("<componentList", 1)[0] if ic else ""
        pool = names(own)
        for ref in re.findall(r'<referenceableParamGroupRef\s+ref="([^"]*)"', own):
            g = re.search(r'<referenceableParamGroup\s+id="%s"(.*?)</referenceableParamGroup>' % re.escape(ref), head, re.S)
            if g:
                pool += names(g.group(1))
        pool = [n for n in pool if n != "instrument serial number"]
        src = re.findall(r'<sourceFile id="[^"]*" name="([^"]*)"', head)
        soft = re.findall(r'<software id="[^"]*" version="([^"]*)">\s*<cvParam [^>]*name="([^"]*)"', head)
        comp = []
        if ic:
            for kind in ("source", "analyzer", "detector"):
                for blk in re.findall(r"<%s .*?</%s>" % (kind, kind), ic.group(0), re.S):
                    comp.extend(names(blk))
        model = pool[0] if pool else ""
        return {"instrument": model, "serial": ser.group(1) if ser else "", "components": comp, "analyzers": sorted(set(self._ic.values())),
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
        t0 = time.perf_counter()
        ids = [s.index for s in self.scans if s.level == level and (polarity in (None, 0) or s.polarity in (polarity, 0))]
        rt = np.array([self.scans[i].rt for i in ids])
        tic = np.array([self.scans[i].tic for i in ids])
        # high-resolution MS1 (Run.hr1): float32 is enough for m/z (0.06 ppm at m/z 500) and intensity, and takes 12 bytes per peak instead of 20
        f32 = level == 1 and bool(getattr(self, "hr1", False))
        dt = np.float32 if f32 else np.float64
        mzs, its, poss = [], [], []
        for p, i in enumerate(ids):
            mz, it = self.read(i)
            mzs.append(mz.astype(dt, copy=False))
            its.append(it.astype(dt, copy=False))
            poss.append(np.full(len(mz), p, dtype=np.int32))
        mz = np.concatenate(mzs) if mzs else np.zeros(0, dtype=dt)
        del mzs
        order = np.argsort(mz, kind="stable")
        mz = mz[order]
        inten = (np.concatenate(its) if its else np.zeros(0, dtype=dt))[order]
        del its
        pos = (np.concatenate(poss) if poss else np.zeros(0, dtype=np.int32))[order]
        del order, poss
        t = PeakTable(rt=rt, scan_ids=np.array(ids), mz=mz, inten=inten, pos=pos, tic=tic)
        self._tables[key] = t
        self.timing[f"tabella MS{level}" + (f" ({'pos' if polarity == 1 else 'neg'})" if polarity in (1, -1) else "")] = round(time.perf_counter() - t0, 3)
        return t
