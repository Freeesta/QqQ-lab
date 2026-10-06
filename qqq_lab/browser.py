"""Entry point of the browser version: this module runs inside Pyodide (see web/browser-worker.js).

The files the student opens live in the memory of the page (Pyodide's file system); nothing is sent anywhere.
"""
from __future__ import annotations

import json
import shutil
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .api import dispatch
from .server import App

WORK = Path("/work/sessione")
app: App | None = None


def start() -> None:
    global app
    WORK.mkdir(parents=True, exist_ok=True)
    app = App(WORK)


def handle(method: str, url: str, body=None):
    """(status, JSON text) for one request coming from the page. body: bytes (JS Uint8Array) or None."""
    u = urlparse(url)
    path = "/" + u.path.lstrip("./")
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    if path == "/api/upload" and q.get("name", "").lower().endswith((".wiff", ".scan")):
        return 400, json.dumps({"error": "nel browser si aprono solo file .mzML: converti prima il .wiff (guida nella pagina) oppure usa il programma sul computer"})
    data = body.to_bytes() if hasattr(body, "to_bytes") else b""
    code, _ctype, out, _hdr = dispatch(app, method, path, q, BytesIO(data), len(data))
    if path == "/api/remove":                     # nothing to recover in a page: free the memory the removed file used
        shutil.rmtree(app.workdir / "_cestino", ignore_errors=True)
    return code, out.decode("utf-8")
