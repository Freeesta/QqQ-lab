"""The engine behind the page: the files the student opened, the session and the notebook. Runs inside Pyodide in the browser (see browser.py)."""
from __future__ import annotations

import base64
import json
import os
import re
import shutil
import threading
import time
from pathlib import Path

import numpy as np

from .explore import Session, sniff
from .reader.methodinfo import check_against, read_methods
from .project import guess_conc, guess_sample


UPLOAD_SUFFIXES = (".mzml", ".dam")


def _method_summary(m: dict | None) -> str:
    """One line for the list of methods: what the .dam says it acquires."""
    if not m or m.get("error"):
        return "non leggibile" if m else ""
    ex = m.get("experiments") or []
    if not ex:
        return ""
    if all(e["kind"] == "mrm" for e in ex):
        n = sum(len(e["transitions"]) for e in ex)
        return f"MRM, {n} transizion{'e' if n == 1 else 'i'}"
    rng = [e["range"] for e in ex if e.get("range")]
    txt = "scansione" if len(ex) == 1 else f"{len(ex)} scansioni"
    return txt + (f", m/z {rng[0][0]:g}-{rng[0][1]:g}" if rng and len(ex) == 1 else "")


MAX_UPLOAD = 4 << 30  # bytes: one mzML upload


class App:
    """The page lets the user drop files and open them for exploration; the work folder keeps the files and the notebook."""

    def __init__(self, workdir=None):
        self.workdir = Path(workdir) if workdir else None
        if self.workdir:
            self.workdir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.session: Session | None = None
        if self.workdir:
            self._resume()

    def _resume(self):
        """Reopen the files that were open when the program was closed (list stored in taccuino.json)."""
        try:
            nb = self.notebook()
            smp = [x for x in nb.get("session", []) if (self.workdir / self.safe_name(x["file"])).exists()]
            if smp:
                self.open_session({"samples": smp})
        except Exception:  # noqa: BLE001 -- a broken notebook must never stop the program
            self.session = None

    # ------------------------------------------------------------------ files and start
    def files(self) -> list[dict]:
        if not self.workdir:
            return []
        out = []
        for p in sorted(self.workdir.iterdir()):
            if p.suffix.lower() == ".mzml" and p.is_file():
                label, t, typ = guess_sample(p.name)
                c = guess_conc(p.name) if typ == "standard" else None
                out.append({"name": p.name, "size": p.stat().st_size, "time": t, "type": typ, "conc": c[0] if c else None, "cunit": c[1] if c else None, **self._sniff(p)})
        return out

    def _sniff(self, p: Path) -> dict:
        """Experiment type read from the file content (cached by path and modification time); the name only gives a hint."""
        if p.suffix.lower() != ".mzml":
            return {"kind": None, "hint": None}
        key = (str(p), p.stat().st_mtime)
        cache = self.__dict__.setdefault("_sniff_cache", {})
        if key not in cache:
            try:
                r = sniff(p)
            except Exception:  # noqa: BLE001 -- an unreadable file is reported when it is opened
                r = {"kind": None}
            n = p.stem.lower()
            r["hint"] = next((h for h, rx in (("mrm", r"mrm|srm"), ("ms2", r"ms2|msms|ms-ms|product|epi"), ("full", r"full|q1|ems|scan")) if re.search(rx, n)), None)
            cache[key] = r
        return cache[key]

    def methods(self) -> list[dict]:
        """Acquisition methods (.dam) uploaded in the work folder, oldest first (name, size, one-line content)."""
        if not self.workdir:
            return []
        ps = sorted((p for p in self.workdir.iterdir() if p.suffix.lower() == ".dam" and p.is_file()), key=lambda p: p.stat().st_mtime)
        info = {m["name"]: m for m in self.lab_methods(ps)}
        return [{"name": p.name, "size": p.stat().st_size, "info": _method_summary(info.get(p.name))} for p in ps]

    def lab_methods(self, paths=None) -> list[dict]:
        """The parameters read from every uploaded .dam: [{name, source, compound, lc, file}]. Nothing is assumed when none is loaded."""
        out = []
        for p in (paths if paths is not None else [self.workdir / m["name"] for m in self.methods()]):
            key = (str(p), p.stat().st_mtime)
            cache = self.__dict__.setdefault("_dam_cache", {})
            if key not in cache:
                try:
                    r = read_methods(p)[0]
                    r["name"] = p.name
                    cache[key] = r
                except Exception as e:  # noqa: BLE001 -- a broken file must not break the page
                    cache[key] = {"name": p.name, "error": f"non riesco a leggere questo file ({e})", "source": [], "compound": [], "file": {}}
            out.append(cache[key])
        return out

    @staticmethod
    def safe_name(name: str) -> str:
        n = Path(name.replace("\\", "/")).name.strip()
        if not n or n.startswith(".") or Path(n).suffix.lower() not in UPLOAD_SUFFIXES:
            raise ValueError(f"file type not accepted: {name!r} (use .mzML, or a method .dam; convert a .wiff to .mzML first)")
        return re.sub(r"[\x00-\x1f<>:\"|?*]", "_", n)

    def save_upload(self, name: str, stream, length: int) -> str:
        if not self.workdir:
            raise ValueError("no work folder")
        n = self.safe_name(name)
        if length > MAX_UPLOAD:
            raise ValueError("file too large")
        if length > shutil.disk_usage(self.workdir).free - (200 << 20):
            raise ValueError("not enough free disk space")
        dest = self.workdir / n
        tmp = dest.with_name(dest.name + ".part")
        left = length
        with open(tmp, "wb") as fh:
            while left > 0:
                chunk = stream.read(min(1 << 20, left))
                if not chunk:
                    break
                fh.write(chunk)
                left -= len(chunk)
        if left:
            tmp.unlink(missing_ok=True)
            raise ValueError("upload interrupted")
        os.replace(tmp, dest)
        return n

    def remove_file(self, name: str):
        """Never deleted: moved to _cestino inside the work folder."""
        n = self.safe_name(name)
        src = self.workdir / n
        trash = self.workdir / "_cestino"
        trash.mkdir(exist_ok=True)
        # an open session keeps the file memory-mapped: on Windows a mapped file cannot be moved, so release it first
        # (the file leaves the session too: it is gone from the work folder)
        if self.session:
            for it in list(self.session.items):
                if Path(it.file).name == n:
                    try:
                        it.run.close()
                    except Exception:  # noqa: BLE001 -- already closed or never opened
                        pass
                    self.session.items.remove(it)
        for f in (src,):
            if f.exists():
                os.replace(f, trash / f.name)

    def notebook_path(self) -> Path | None:
        return self.workdir / "taccuino.json" if self.workdir else None

    def notebook(self) -> dict:
        p = self.notebook_path()
        if p and p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
        return {}

    def save_notebook(self, data: dict):
        p = self.notebook_path()
        if not p:
            raise ValueError("no work folder: use the download button")
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(data), encoding="utf-8")
        os.replace(tmp, p)

    def open_session(self, payload: dict):
        """Open the files for exploration: no compound, no candidates, just the data."""
        samples = []
        for s_ in payload.get("samples", []):
            n = self.safe_name(s_["file"])
            if not (self.workdir / n).exists():
                raise ValueError(f"file not found: {n}")
            t = s_.get("time")
            c = s_.get("conc")
            samples.append({"file": n, "label": s_.get("label"), "type": s_.get("type", "sample"),
                            "time": None if t in (None, "") else float(t), "conc": None if c in (None, "") else float(c), "cunit": s_.get("cunit")})
        if not samples:
            raise ValueError("add at least one file")
        self.session = Session(samples, self.workdir)

    def session_state(self) -> dict:
        return {"session": self.session.info() if self.session else None, "app": bool(self.workdir),
                "workdir": str(self.workdir) if self.workdir else None, "files": self.files(), "methods": self.methods(),
                "version": __import__("qqq_lab").__version__}

    def _item(self, k: int):
        if not self.session or not 0 <= k < len(self.session.items):
            raise ValueError("no such file in the session")
        return self.session.items[k]

    def chrom(self, k: int, kind: str, level: int, mz0: float | None = None, mz1: float | None = None, prec: float | None = None) -> dict:
        rt, y = self._item(k).total(kind, level, mz0, mz1, prec)
        return {"rt": [round(float(v), 4) for v in rt], "y": [round(float(v), 1) for v in y]}

    def xic(self, ks: list[int], mz: float, tol: float, level: int) -> dict:
        out = []
        for k in ks:
            rt, y = self._item(k).xic(mz, tol, level)
            out.append({"k": k, "rt": [round(float(v), 4) for v in rt], "y": [round(float(v), 1) for v in y]})
        return {"mz": mz, "tol": tol, "traces": out}

    def mrm(self, ks: list[int]) -> dict:
        return {"files": [{"k": k, "transitions": self._item(k).mrm()} for k in ks]}

    def method(self, k: int) -> dict:
        m = self._item(k).method()
        m["lab"] = [{**x, "check": check_against(m, x)} for x in self.lab_methods()]   # only what the user uploaded as .dam: no built-in method is assumed
        pick = {"full": "full", "ms2": "ms2", "mrm": "mrm"}.get(m.get("kind"), "")
        names = [x["name"].lower() for x in m["lab"]]
        hit = [i for i, n in enumerate(names) if pick and pick in n] or [i for i, n in enumerate(names) if m.get("kind") == "ms2" and "ms2" in n]
        m["lab_pick"] = hit[-1] if hit else (len(names) - 1 if names else None)
        # several .dam loaded: preselect the one that agrees best with this file (fewest differences), name as tie-break
        if len(m["lab"]) > 1:
            diffs = [sum(r["status"] == "diff" for r in x["check"]) for x in m["lab"]]
            best = min(diffs)
            if diffs[m["lab_pick"]] > best:
                m["lab_pick"] = [i for i, d in enumerate(diffs) if d == best][-1]
        return m

    def origin(self, k: int, mz: float, parent: float, rt0: float | None = None, rt1: float | None = None, formula: str | None = None) -> dict:
        """"Da dove viene questo ione?": the evidence of qqq_lab.ionfamily for the ion at mz against the candidate precursor `parent`,
        over every full-scan file of the session (k = the file the student is looking at, used as the reference). No verdict."""
        from . import ionfamily
        if not self.session:
            raise ValueError("nessuna sessione aperta")
        full = [(i, it) for i, it in enumerate(self.session.items) if it.kind() != "mrm" and it.type != "blank" and len(it.run.table(1).rt)]
        if not full:
            raise ValueError("servono file full scan")
        samples = [{"label": it.label, "time": it.time, "table": it.run.table(1), "key": str(it.path)} for _, it in full]
        ref = next((j for j, (i, _) in enumerate(full) if i == k), None)
        ms2 = None
        for it in self.session.items:                  # product-ion spectra of X and of P, if the student loaded an MS2 file
            if not any(x.level == 2 for x in it.run.scans):
                continue
            lo, hi = it.info()["rt_min"], it.info()["rt_max"]
            sx, sp = it.spectrum(lo, hi, 2, mz), it.spectrum(lo, hi, 2, parent)
            if sp[2]:
                ms2 = {"x": (sx[0], sx[1]) if sx[2] else None, "p": (sp[0], sp[1])}
                break
        return ionfamily.origin_report(samples, mz, parent, rt0, rt1, ref, formula_p=formula or None, top=25, ms2=ms2)   # 25 co-eluting ions are plenty to read (and the browser version is ~10x slower)

    def spectrum(self, k: int, rt0: float, rt1: float, level: int, precursor, bin_da: float, bg=None) -> dict:
        if bg is not None:
            bg = {**bg, "item": self._item(bg["k"])}
        mz, y, n = self._item(k).spectrum(rt0, rt1, level, precursor, bin_da=bin_da, bg=bg)
        return {"mz": [round(float(v), 3) for v in mz], "y": [round(float(v), 1) for v in y], "scans": n}

    MAX_SPECTRA = 60       # scans per /api/spectra request

    def spectra(self, k: int, i0: int, i1: int, level: int, precursor, bin_da: float) -> dict:
        """Single scans i0..i1 of file k (for scan-by-scan navigation); each one equals /api/spectrum on a window holding only that scan."""
        item = self._item(k)
        if item.kind() == "mrm":
            raise ValueError("Questo file è MRM: contiene solo cromatogrammi di transizioni, non scansioni.")
        if i0 > i1:
            raise ValueError("intervallo di scansioni non valido: i0 è maggiore di i1")
        if i1 - i0 + 1 > self.MAX_SPECTRA:
            raise ValueError(f"al massimo {self.MAX_SPECTRA} scansioni per richiesta")
        n = item.scan_count(level, precursor)
        if i0 < 0 or i0 >= n:
            raise ValueError(f"scansione fuori dal file (il file ne ha {n})")
        return {"n": n, "scans": [{"i": s["i"], "rt": round(s["rt"], 4), "mz": [round(float(v), 3) for v in s["mz"]], "y": [round(float(v), 1) for v in s["y"]]}
                                  for s in item.scans(i0, i1, level, precursor, bin_da=bin_da)]}

    def ionmap(self, k: int, level: int) -> dict:
        """RT x m/z intensity matrix (float32, row = RT bin, column = m/z bin, base64) on the session-wide grid."""
        item = self._item(k)
        grid = self.session.grid(level)
        m = item.ionmap(level, grid)
        return {**grid, "level": level, "data": base64.b64encode(np.ascontiguousarray(m, dtype="<f4").tobytes()).decode("ascii")}

    def reset(self, fresh: bool = False):
        with self.lock:
            if self.session:
                for it in list(self.session.items):      # release the memory-mapped files before they go
                    try:
                        it.run.close()
                    except Exception:  # noqa: BLE001
                        pass
            if fresh and self.workdir:                   # "Nuova sessione": the files and the notebook of the page are dropped
                for f in self.workdir.iterdir():
                    if f.is_file():
                        f.unlink(missing_ok=True)
            self.session = None

    def state(self):
        return {"error": None, "phase": "start", "app": bool(self.workdir), "workdir": str(self.workdir) if self.workdir else None,
                "files": self.files(), "methods": self.methods(), "version": __import__("qqq_lab").__version__}
