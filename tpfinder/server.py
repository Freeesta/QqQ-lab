"""Local server (127.0.0.1 only): JSON API for the page, CSV and JSON exports."""
from __future__ import annotations

import base64
import csv
import io
import json
import os
import re
import threading
import webbrowser
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from urllib.parse import parse_qs, urlparse

import numpy as np

from .chem.elements import formula_mz
from .core.analysis import Analysis
from .explore import Session
from .project import SAMPLE_TYPES, guess_sample, load_project, write_project


UPLOAD_SUFFIXES = (".mzml", ".wiff", ".scan")


class App:
    """With a project path: opens that experiment. With only a workdir: 'app mode', the page lets the user
    drop files, describe the experiment and start the analysis."""

    def __init__(self, project_path=None, workdir=None):
        self.path = project_path
        self.workdir = Path(workdir) if workdir else None
        if self.workdir:
            self.workdir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.analysis: Analysis | None = None
        self.summary: list = []
        self.error: str | None = None
        self.session: Session | None = None
        if self.path:
            self.load()
        elif self.workdir:
            self._resume()

    def _resume(self):
        """Reopen the files that were open when the program was closed (list stored in taccuino.json)."""
        try:
            nb = self.notebook()
            smp = [x for x in nb.get("session", []) if (self.workdir / x["file"]).exists()]
            if smp:
                self.open_session({"samples": smp})
        except Exception:  # noqa: BLE001 -- a broken notebook must never stop the program
            self.session = None

    # ------------------------------------------------------------------ app mode: files and start
    def files(self) -> list[dict]:
        if not self.workdir:
            return []
        out = []
        for p in sorted(self.workdir.iterdir()):
            if p.suffix.lower() in (".mzml", ".wiff") and p.is_file():
                label, t, typ = guess_sample(p.name)
                out.append({"name": p.name, "size": p.stat().st_size, "time": t, "type": typ,
                            "scan": (p.parent / (p.name + ".scan")).exists() if p.suffix.lower() == ".wiff" else None})
        return out

    @staticmethod
    def safe_name(name: str) -> str:
        n = Path(name.replace("\\", "/")).name.strip()
        if not n or n.startswith(".") or Path(n).suffix.lower() not in UPLOAD_SUFFIXES:
            raise ValueError(f"file type not accepted: {name!r} (use .mzML, or .wiff together with its .wiff.scan)")
        return re.sub(r"[\x00-\x1f<>:\"|?*]", "_", n)

    def save_upload(self, name: str, stream, length: int) -> str:
        if not self.workdir:
            raise ValueError("uploads are only available in app mode")
        n = self.safe_name(name)
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
        for f in (src, self.workdir / (n + ".scan")):
            if f.exists():
                os.replace(f, trash / f.name)

    def build(self, payload: dict):
        """Write esperimento.toml from the form and run the analysis."""
        parent = {"name": (payload.get("name") or "").strip() or "parent",
                  "polarity": payload.get("polarity", "positive")}
        f = (payload.get("formula") or "").strip()
        if re.fullmatch(r"\d+(\.\d+)?", f):
            parent["mz"] = float(f)
        elif f:
            parent["formula"] = f
        else:
            raise ValueError("enter the formula of the parent compound (or its m/z)")
        samples = []
        for s in payload.get("samples", []):
            typ = s.get("type", "sample")
            if typ not in SAMPLE_TYPES:
                raise ValueError(f"unknown type {typ!r}")
            n = self.safe_name(s["file"])
            if not (self.workdir / n).exists():
                raise ValueError(f"file not found: {n}")
            t = s.get("time")
            samples.append({"file": n, "type": typ, "time": None if t in (None, "") else float(t)})
        if not samples:
            raise ValueError("add at least one file")
        self.path = write_project(self.workdir / "esperimento.toml", parent, samples,
                                  {k: payload[k] for k in ("tol_da", "max_steps") if payload.get(k) not in (None, "")})
        self.load()
        if self.error:
            raise ValueError(self.error)

    def notebook_path(self) -> Path | None:
        if self.workdir:
            return self.workdir / "taccuino.json"
        return Path(self.path).parent / "taccuino.json" if self.path else None

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
            samples.append({"file": n, "label": s_.get("label"), "type": s_.get("type", "sample"),
                            "time": None if t in (None, "") else float(t)})
        if not samples:
            raise ValueError("add at least one file")
        self.session = Session(samples, self.workdir)

    def session_state(self) -> dict:
        return {"session": self.session.info() if self.session else None, "app": bool(self.workdir),
                "workdir": str(self.workdir) if self.workdir else None, "files": self.files(),
                "has_analysis": self.analysis is not None, "version": __import__("tpfinder").__version__}

    def _item(self, k: int):
        if not self.session or not 0 <= k < len(self.session.items):
            raise ValueError("no such file in the session")
        return self.session.items[k]

    def chrom(self, k: int, kind: str, level: int) -> dict:
        rt, y = self._item(k).total(kind, level)
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
        lab = resources.files("tpfinder").joinpath("config/metodo_laboratorio.json")
        try:
            m["lab"] = json.loads(lab.read_text(encoding="utf-8")) if lab.is_file() else None
        except (OSError, ValueError):
            m["lab"] = None
        return m

    def spectrum(self, k: int, rt0: float, rt1: float, level: int, precursor, bin_da: float, bg=None) -> dict:
        if bg is not None:
            bg = {**bg, "item": self._item(bg["k"])}
        mz, y, n = self._item(k).spectrum(rt0, rt1, level, precursor, bin_da=bin_da, bg=bg)
        return {"mz": [round(float(v), 3) for v in mz], "y": [round(float(v), 1) for v in y], "scans": n}

    def ionmap(self, k: int, level: int) -> dict:
        """RT x m/z intensity matrix (float32, row = RT bin, column = m/z bin, base64) on the session-wide grid."""
        item = self._item(k)
        grid = self.session.grid(level)
        m = item.ionmap(level, grid)
        return {**grid, "level": level, "data": base64.b64encode(np.ascontiguousarray(m, dtype="<f4").tobytes()).decode("ascii")}

    def reset(self, fresh: bool = False):
        with self.lock:
            if fresh and self.workdir:
                self.workdir = default_workdir(new=True)
                self.workdir.mkdir(parents=True, exist_ok=True)
            self.analysis, self.summary, self.error, self.path, self.session = None, [], None, None, None

    def load(self):
        with self.lock:
            try:
                self.analysis = Analysis(load_project(self.path))
                self.summary = self.analysis.summary()
                if self.session is None:
                    self.session = Session([{"file": str(x.path), "label": x.label, "time": x.time, "type": x.type}
                                            for x in self.analysis.p.samples], Path(self.path).parent)
                self.error = None
            except Exception as e:  # noqa: BLE001 -- shown in the page, never kills the server
                self.analysis, self.summary, self.error = None, [], f"{type(e).__name__}: {e}"

    def state(self):
        if self.analysis is None:
            if self.workdir and not self.path:
                return {"error": None, "phase": "start", "app": True, "workdir": str(self.workdir),
                        "files": self.files(), "version": __import__("tpfinder").__version__}
            return {"error": self.error}
        a = self.analysis
        return {"error": None, "phase": "analysis", "app": bool(self.workdir),
                "version": __import__("tpfinder").__version__, "parent": a.p.parent,
                "settings": a.p.settings, "texts": a.p.texts, "config_files": a.p.config_files,
                "samples": [{"label": s.label, "time": s.time, "type": s.type, "file": s.path.name} for s in a.p.samples],
                "candidates": self.summary}

    def candidate(self, cid: int):
        a = self.analysis
        r, c = a.analyse(cid), a.candidates[cid]
        peaks = []
        for pk in r["peaks"]:
            peaks.append({"left": pk["left"], "right": pk["right"], "apex": pk["apex_rt"]} if pk else None)
        return {"id": cid, "name": c["name"], "alternatives": c["alternatives"], "formula": c["formula"], "mz": c["mz"],
                "adduct": c["adduct"], "delta": c["delta"], "score": r["score"], "label": r["label"],
                "criteria": r["criteria"], "ref_rt": r["ref_rt"], "rows": r["rows"], "peaks": peaks,
                "traces": [{"rt": [round(float(v), 4) for v in rt], "y": [round(float(v), 1) for v in y]}
                           for rt, y in r["traces"]], "ms2": a.ms2(cid)}

    def candidates_csv(self) -> str:
        out = io.StringIO()
        out.write("sep=;\n")                      # tells Excel the separator
        w = csv.writer(out, delimiter=";", lineterminator="\n")
        times = [(s.label, s.time) for s in self.analysis.p.samples]
        w.writerow(["id", "name", "alternatives", "formula", "delta", "mz", "score", "label", "ref_rt_min"] +
                   [f"area_{l}" for l, _ in times])
        for c in self.summary:
            rows = self.analysis.analyse(c["id"])["rows"]
            w.writerow([c["id"], c["name"], " | ".join(c["alternatives"]), c["formula"], c["delta"], c["mz"],
                        "" if c["score"] is None else c["score"], c["label"],
                        "" if c["ref_rt"] is None else round(c["ref_rt"], 3)] +
                       [round(r["area"]) if r["detected"] else 0 for r in rows])
        return out.getvalue()

    def transitions_csv(self, ids: list[int]) -> str:
        rows = self.analysis.transitions(ids)
        out = io.StringIO()
        out.write("sep=;\n")
        w = csv.writer(out, delimiter=";", lineterminator="\n")
        cols = ["compound", "Q1", "Q3", "CE", "expected_RT_min", "RT_window_min", "relative_intensity_pct", "ms2_scans", "note"]
        w.writerow(cols)
        for r in rows:
            w.writerow([r[c] for c in cols])
        return out.getvalue()


STATIC_TYPES = {".html": "text/html", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
                ".wasm": "application/wasm", ".ico": "image/x-icon", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain"}


def _static(rel: str):
    """A file under tpfinder/web (never outside it)."""
    base = resources.files("tpfinder") / "web"
    parts = [p for p in rel.split("/") if p]
    if not parts or any(p in (".", "..") or "\\" in p for p in parts):
        return None
    f = base.joinpath(*parts)
    suffix = "." + parts[-1].rsplit(".", 1)[-1].lower() if "." in parts[-1] else ""
    if suffix not in STATIC_TYPES or not f.is_file():
        return None
    return f.read_bytes(), STATIC_TYPES[suffix]


def _page() -> bytes:
    return (resources.files("tpfinder") / "web" / "index.html").read_bytes()


def make_handler(app: App):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, body: bytes, ctype="application/json", extra=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype + "; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj, code=200):
            self._send(code, json.dumps(obj).encode("utf-8"))

        def _local_only(self) -> bool:
            """Refuse requests that do not come from a page served by this very server."""
            host = (self.headers.get("Host") or "").split(":")[0]
            if host not in ("127.0.0.1", "localhost"):
                return False
            origin = self.headers.get("Origin")
            return not origin or urlparse(origin).hostname in ("127.0.0.1", "localhost")

        def do_POST(self):
            u = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            try:
                if not self._local_only():
                    return self._json({"error": "forbidden"}, 403)
                n = int(self.headers.get("Content-Length") or 0)
                if u.path == "/api/upload":
                    app.save_upload(q.get("name", ""), self.rfile, n)
                    return self._json({"files": app.files()})
                body = json.loads(self.rfile.read(n) or b"{}")
                if u.path == "/api/explore":
                    app.open_session(body)
                    return self._json(app.session_state())
                if u.path == "/api/build":
                    app.build(body)
                    return self._json(app.state())
                if u.path == "/api/remove":
                    app.remove_file(body.get("name", ""))
                    return self._json({"files": app.files()})
                if u.path == "/api/notebook":
                    app.save_notebook(body)
                    return self._json({"ok": True})
                if u.path == "/api/new":
                    app.reset(bool(body.get("fresh")))
                    return self._json(app.state())
                return self._json({"error": "unknown endpoint"}, 404)
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}" if not isinstance(e, ValueError) else str(e)}, 400)

        def do_GET(self):
            u = urlparse(self.path)
            if not self._local_only():
                return self._json({"error": "forbidden"}, 403)
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            try:
                if u.path in ("/", "/index.html"):
                    return self._send(200, _page(), "text/html")
                if u.path == "/api/reload":
                    app.load()
                    return self._json(app.state())
                if u.path == "/api/state":
                    return self._json(app.state())
                if u.path.startswith("/static/"):
                    got = _static(u.path[len("/static/"):])
                    if got is None:
                        return self._json({"error": "not found"}, 404)
                    return self._send(200, got[0], got[1], {"Cache-Control": "no-cache"})
                if u.path == "/api/notebook":
                    return self._json(app.notebook())
                if u.path == "/api/session":
                    return self._json(app.session_state())
                if u.path == "/api/chrom":
                    return self._json(app.chrom(int(q["k"]), q.get("kind", "tic"), int(q.get("level", 1))))
                if u.path == "/api/xic":
                    return self._json(app.xic([int(x) for x in q["k"].split(",") if x], float(q["mz"]),
                                              float(q.get("tol", 0.35)), int(q.get("level", 1))))
                if u.path == "/api/mrm":
                    return self._json(app.mrm([int(x) for x in q["k"].split(",") if x]))
                if u.path == "/api/method":
                    return self._json(app.method(int(q["k"])))
                if u.path == "/api/spectrum":
                    pr = q.get("precursor")
                    bg = None
                    if q.get("bgk") not in (None, ""):
                        bg = {"k": int(q["bgk"]), "rt0": float(q["bgrt0"]), "rt1": float(q["bgrt1"]),
                              "factor": float(q.get("bgf", 1.0))}
                    return self._json(app.spectrum(int(q["k"]), float(q["rt0"]), float(q["rt1"]), int(q.get("level", 1)),
                                                   float(pr) if pr not in (None, "") else None, float(q.get("bin", 0.1)), bg))
                if u.path == "/api/formula":
                    try:
                        return self._json(formula_mz(q.get("f", ""), q.get("adduct") or None))
                    except ValueError as e:      # a typo in the formula is the user's, not a server fault
                        return self._json({"error": str(e)}, 400)
                if u.path == "/api/map":
                    return self._json(app.ionmap(int(q["k"]), int(q.get("level", 1))))
                if app.analysis is None:
                    return self._json({"error": app.error or "Questa funzione serve solo nella scheda Suggerimenti: apri prima un esperimento con il composto."}, 400)
                if u.path == "/api/candidate":
                    return self._json(app.candidate(int(q["id"])))
                if u.path == "/export/candidates.csv":
                    return self._send(200, app.candidates_csv().encode("utf-8"), "text/csv",
                                      {"Content-Disposition": 'attachment; filename="candidates.csv"'})
                if u.path == "/export/transitions.csv":
                    ids = [int(x) for x in q.get("ids", "").split(",") if x]
                    return self._send(200, app.transitions_csv(ids).encode("utf-8"), "text/csv",
                                      {"Content-Disposition": 'attachment; filename="transitions.csv"'})
                if u.path == "/export/session.json":
                    return self._send(200, json.dumps({"provenance": app.analysis.provenance(),
                                                       "candidates": app.summary}, indent=1).encode("utf-8"),
                                      "application/json", {"Content-Disposition": 'attachment; filename="session.json"'})
                return self._json({"error": "unknown endpoint"}, 404)
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}"}, 500)

    return H


def default_workdir(new: bool = False) -> Path:
    """The most recent work folder (so closing and reopening the program resumes), or a new one."""
    root = Path.home() / "TPFinder_lavoro"
    if not new and root.is_dir():
        old = sorted(p for p in root.glob("sessione_*") if p.is_dir())
        if old:
            return old[-1]
    return root / datetime.now().strftime("sessione_%Y%m%d_%H%M%S")


def serve(project_path, port: int = 8790, open_browser: bool = True, workdir=None):
    app = App(project_path, workdir)
    if app.error:
        print(f"[tpfinder] {app.error}")
    httpd = None
    for p in range(port, port + 20):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", p), make_handler(app))
            break
        except OSError:
            continue
    if httpd is None:
        raise SystemExit("no free port")
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    print(f"[tpfinder] {url}   (Ctrl+C to stop)")
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("[tpfinder] stopped")
    finally:
        httpd.server_close()
