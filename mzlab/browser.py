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
from .app import App
from .bigfiles import TOO_BIG

WORK = Path("/work/sessione")
app: App | None = None


def start() -> None:
    global app
    WORK.mkdir(parents=True, exist_ok=True)
    app = App(WORK)


def link_big(name: str, target: str):
    """(status, JSON text) after the worker mounted a big file (WORKERFS, no copy in memory) at `target`: link it into the work folder like an upload."""
    try:
        dest = WORK / app.safe_name(name)
        if dest.is_symlink() or dest.exists():
            dest.unlink()
        dest.symlink_to(target)
        return 200, json.dumps({"files": app.files(), "methods": app.methods()})
    except MemoryError:
        return 507, json.dumps({"error": TOO_BIG})
    except Exception as e:  # noqa: BLE001
        return 400, json.dumps({"error": str(e) if isinstance(e, ValueError) else f"{type(e).__name__}: {e}"})


def handle(method: str, url: str, body=None):
    """(status, JSON text) for one request coming from the page, or (status, bytes, content type) for a binary block. body: bytes (JS Uint8Array) or None."""
    u = urlparse(url)
    path = "/" + u.path.lstrip("./")
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    data = body.to_bytes() if hasattr(body, "to_bytes") else b""
    code, _ctype, out, _hdr = dispatch(app, method, path, q, BytesIO(data), len(data))
    if path == "/api/remove":                     # nothing to recover in a page: free the memory the removed file used
        shutil.rmtree(app.workdir / "_cestino", ignore_errors=True)
    if _ctype.startswith("application/octet-stream"):          # a binary block (api/scanbin): bytes, not text (they become a Uint8Array in the worker)
        return code, out, _ctype
    return code, out.decode("utf-8")
