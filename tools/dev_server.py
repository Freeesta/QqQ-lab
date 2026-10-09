"""Local server FOR THE TESTS ONLY (tests_e2e/lib.py starts it): it serves the page (mzlab/web) and the same API the site answers
with Pyodide (mzlab/api.py). The students never use it: they open the site (GitHub Pages).

    python3 tools/dev_server.py --workdir /tmp/wd --port 8790
"""
from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from mzlab.api import dispatch  # noqa: E402
from mzlab.app import App  # noqa: E402

STATIC_TYPES = {".html": "text/html", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
                ".wasm": "application/wasm", ".ico": "image/x-icon", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain", ".mzml": "application/octet-stream"}


def _static(rel: str):
    """A file under mzlab/web (never outside it)."""
    base = resources.files("mzlab") / "web"
    parts = [p for p in rel.split("/") if p]
    if not parts or any(p in (".", "..") or "\\" in p for p in parts):
        return None
    f = base.joinpath(*parts)
    suffix = "." + parts[-1].rsplit(".", 1)[-1].lower() if "." in parts[-1] else ""
    if suffix not in STATIC_TYPES or not f.is_file():
        return None
    return f.read_bytes(), STATIC_TYPES[suffix]


def _page() -> bytes:
    return (resources.files("mzlab") / "web" / "index.html").read_bytes()


def make_handler(app: App):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, body: bytes, ctype="application/json", extra=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype if ctype.startswith("application/octet-stream") else ctype + "; charset=utf-8")
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
            if u.path.startswith("/static/"):
                got = _static(u.path[len("/static/"):])
                if got is None:
                    return self._json({"error": "not found"}, 404)
                return self._send(200, got[0], got[1], {"Cache-Control": "no-cache"})
            return self._answer(dispatch(app, "GET", u.path, q))

    return H


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--port", type=int, default=8790)
    a = ap.parse_args()
    httpd = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(App(Path(a.workdir))))
    print(f"QqQ lab (test server)  http://127.0.0.1:{a.port}/  ready", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
