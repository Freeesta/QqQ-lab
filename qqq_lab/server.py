"""Local server (127.0.0.1 only): JSON API for the page and the session export."""
from __future__ import annotations

import base64
import json
import os
import re
import shutil
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from urllib.parse import parse_qs, urlparse

import numpy as np

from .api import dispatch
from .explore import Session, sniff
from .reader.methodinfo import check_against, read_methods
from .project import guess_conc, guess_sample


UPLOAD_SUFFIXES = (".mzml", ".wiff", ".scan", ".dam")
# "close the browser = close the program" (only with --exit-on-close): every open page pings the server; when no page is left
# (after a short grace period that survives a reload) or none ever connected, the server stops
EXIT_GRACE, EXIT_FIRST, EXIT_STALE = 2.5, 120.0, 150.0


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


MAX_UPLOAD = 4 << 30  # bytes: one mzML/wiff upload


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

    # ------------------------------------------------------------------ app mode: files and start
    # ------------------------------------------------------------------ browser presence (close the browser -> stop the program)
    def _presence(self):
        if not hasattr(self, "_tabs"):
            self._tabs, self._live, self._plock, self._deadline = {}, set(), threading.Lock(), time.time() + EXIT_FIRST
        return self._plock

    def ping(self, tab: str):
        with self._presence():
            self._tabs[tab] = time.time()
            self._deadline = None

    def bye(self, tab: str):
        with self._presence():
            self._tabs.pop(tab, None)
            self._live.discard(tab)
            if not self._tabs:
                self._deadline = time.time() + EXIT_GRACE

    def live_open(self, tab: str):
        """A page holds an open connection (/api/live): it is there as long as the connection lives, however long its timers are throttled."""
        with self._presence():
            self._live.add(tab)
            self._tabs[tab] = time.time()
            self._deadline = None

    def live_close(self, tab: str):
        """The connection dropped: the tab or the whole browser was closed (a reload opens a new one within the grace period)."""
        self.bye(tab)

    def should_exit(self) -> bool:
        with self._presence():
            now = time.time()
            for t in [t for t, seen in self._tabs.items() if t not in self._live and now - seen > EXIT_STALE]:
                del self._tabs[t]
            if not self._tabs and self._deadline is None:
                self._deadline = now + EXIT_GRACE
            return not self._tabs and self._deadline is not None and now > self._deadline

    def files(self) -> list[dict]:
        if not self.workdir:
            return []
        out = []
        for p in sorted(self.workdir.iterdir()):
            if p.suffix.lower() in (".mzml", ".wiff") and p.is_file():
                label, t, typ = guess_sample(p.name)
                c = guess_conc(p.name) if typ == "standard" else None
                out.append({"name": p.name, "size": p.stat().st_size, "time": t, "type": typ, "conc": c[0] if c else None, "cunit": c[1] if c else None, **self._sniff(p),
                            "scan": (p.parent / (p.name + ".scan")).exists() if p.suffix.lower() == ".wiff" else None})
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
            raise ValueError(f"file type not accepted: {name!r} (use .mzML, or .wiff together with its .wiff.scan, or a method .dam)")
        return re.sub(r"[\x00-\x1f<>:\"|?*]", "_", n)

    def save_upload(self, name: str, stream, length: int) -> str:
        if not self.workdir:
            raise ValueError("uploads are only available in app mode")
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
        for f in (src, self.workdir / (n + ".scan")):
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
            self.session = None

    def state(self):
        return {"error": None, "phase": "start", "app": bool(self.workdir), "workdir": str(self.workdir) if self.workdir else None,
                "files": self.files(), "methods": self.methods(), "version": __import__("qqq_lab").__version__}


STATIC_TYPES = {".html": "text/html", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
                ".wasm": "application/wasm", ".ico": "image/x-icon", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain"}


def _static(rel: str):
    """A file under qqq_lab/web (never outside it)."""
    base = resources.files("qqq_lab") / "web"
    parts = [p for p in rel.split("/") if p]
    if not parts or any(p in (".", "..") or "\\" in p for p in parts):
        return None
    f = base.joinpath(*parts)
    suffix = "." + parts[-1].rsplit(".", 1)[-1].lower() if "." in parts[-1] else ""
    if suffix not in STATIC_TYPES or not f.is_file():
        return None
    return f.read_bytes(), STATIC_TYPES[suffix]


def _page() -> bytes:
    return (resources.files("qqq_lab") / "web" / "index.html").read_bytes()


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

        def _answer(self, res):
            code, ctype, body, extra = res
            self._send(code, body, ctype, extra)

        def do_POST(self):
            u = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            if not self._local_only():
                return self._json({"error": "forbidden"}, 403)
            return self._answer(dispatch(app, "POST", u.path, q, self.rfile, int(self.headers.get("Content-Length") or 0)))

        def do_GET(self):
            u = urlparse(self.path)
            if not self._local_only():
                return self._json({"error": "forbidden"}, 403)
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            if u.path in ("/", "/index.html"):
                return self._send(200, _page(), "text/html")
            if u.path == "/api/live":                       # presence by an open connection: when the page goes, the connection drops
                tab = q.get("tab", "")
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "close")
                self.end_headers()
                self.close_connection = True
                app.live_open(tab)
                try:
                    while True:
                        self.wfile.write(b": alive\n\n")
                        self.wfile.flush()
                        time.sleep(0.5)
                except OSError:                              # BrokenPipe / ConnectionReset: the page is gone
                    pass
                finally:
                    app.live_close(tab)
                return
            if u.path.startswith("/static/"):
                got = _static(u.path[len("/static/"):])
                if got is None:
                    return self._json({"error": "not found"}, 404)
                return self._send(200, got[0], got[1], {"Cache-Control": "no-cache"})
            return self._answer(dispatch(app, "GET", u.path, q))

    return H


def default_workdir(new: bool = False) -> Path:
    """The most recent work folder (so closing and reopening the program resumes), or a new one."""
    root = Path.home() / "QqQ_lab_lavoro"
    if not new and root.is_dir():
        old = sorted(p for p in root.glob("sessione_*") if p.is_dir())
        if old:
            return old[-1]
    return root / datetime.now().strftime("sessione_%Y%m%d_%H%M%S")


def serve(workdir, port: int = 8790, open_browser: bool = True, exit_on_close: bool = False):
    from . import __version__, console as C
    if not os.environ.get("QQQ_HEADER"):        # the launcher (scripts/avvia.py) has already printed the header
        C.header(__version__)
    app = App(workdir)
    httpd = None
    for p in range(port, port + 20):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", p), make_handler(app))
            break
        except OSError:
            continue
    if httpd is None:
        C.fail("Nessuna porta libera", f"provate {port}-{port + 19}")
        raise SystemExit(1)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    C.link(url, "pronto" + (f" · sessione precedente riaperta ({len(app.session.items)} file)" if app.session and app.session.items else ""))
    C.say("  " + C.dim("Per uscire chiudi la pagina del browser (o premi Ctrl+C)." if exit_on_close else "Per uscire chiudi questa finestra (o premi Ctrl+C)."))
    if exit_on_close:
        app._presence()            # starts the clock: if no page ever connects (EXIT_FIRST), the program stops by itself

        def watch():
            while not app.should_exit():
                time.sleep(0.3)
            httpd.shutdown()
        threading.Thread(target=watch, daemon=True).start()
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        C.say("  " + C.dim("QqQ lab chiuso. Il lavoro è salvato."))
    else:
        if exit_on_close:
            C.say("  " + C.dim("Pagina chiusa: QqQ lab si ferma. Il lavoro è salvato."))
    finally:
        httpd.server_close()
