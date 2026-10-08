"""Encrypts the private TP Mine sources into mzlab/web/tpmine.enc (the only thing of TP Mine that is published).

    TPMINE_PASSWORD=... python tools/build_tpmine.py [--src DIR] [--out FILE]      # or type the password when asked

Sources (plain text, in this repository under TP_Mine/; never copied into the site):
    js/*.js        run in file-name order after the unlock; they register their tools with window.QTOOLS.register(...)
    files/*        extra text files given to the scripts as QTOOLS.ctx.files[name] (the Web Worker source)
    py/**/*.py     the Python of the tools, zipped and handed to Pyodide at run time (any other file in py/ is included as is)
Every .js and .py source must carry the marker TPMINE-PRIVATE (a comment): build_site.py refuses to publish a site in which the
marker appears in plain text. The password is never written anywhere (not in files, not in the output).
Format: see the header of mzlab/web/tpmine-loader.js. Needs the 'cryptography' package (pip install cryptography).
"""
from __future__ import annotations

import argparse
import base64
import getpass
import io
import json
import os
import secrets
import struct
import sys
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKER = "TPMINE-PRIVATE"
ITER = 600_000                      # >= 310 000 asked; the browser derives the key in ~0.3 s


def pack(src: Path) -> dict:
    js = []
    for f in sorted((src / "js").glob("*.js")):
        code = f.read_text(encoding="utf-8")
        if MARKER not in code:
            sys.exit(f"{f.name}: missing the marker {MARKER} (add a comment with it)")
        js.append({"name": f.name, "code": code})
    files = {}
    for f in sorted((src / "files").glob("*")) if (src / "files").is_dir() else []:       # extra text files (e.g. the Web Worker source)
        code = f.read_text(encoding="utf-8")
        if MARKER not in code:
            sys.exit(f"files/{f.name}: missing the marker {MARKER}")
        files[f.name] = code
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for f in sorted((src / "py").rglob("*")):
            if f.is_file() and "__pycache__" not in f.parts and f.suffix != ".pyc":
                if f.suffix == ".py" and MARKER not in f.read_text(encoding="utf-8"):
                    sys.exit(f"{f.relative_to(src)}: missing the marker {MARKER}")
                z.write(f, f.relative_to(src / "py").as_posix())
    return {"v": 1, "js": js, "py_zip_b64": base64.b64encode(buf.getvalue()).decode(), "files": files, "meta": {}}


def encrypt(payload: dict, password: str, iterations: int = ITER) -> bytes:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    salt, iv = secrets.token_bytes(16), secrets.token_bytes(12)
    head = b"TPMN" + b"\x01" + struct.pack(">I", iterations) + salt + iv          # 37 bytes, also the GCM additional data
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(password.encode("utf-8"))
    plain = zlib.compress(json.dumps(payload, ensure_ascii=False).encode("utf-8"), 9)
    return head + AESGCM(key).encrypt(iv, plain, head)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=ROOT / "TP_Mine")
    ap.add_argument("--out", type=Path, default=ROOT / "mzlab" / "web" / "tpmine.enc")
    ap.add_argument("--iterations", type=int, default=ITER)
    a = ap.parse_args()
    if not (a.src / "js").is_dir():
        sys.exit(f"no private sources in {a.src}")
    pw = os.environ.get("TPMINE_PASSWORD")
    if not pw:
        pw = getpass.getpass("Parola d'ordine: ")
        if getpass.getpass("Ripetila: ") != pw:
            sys.exit("le due parole non coincidono")
    if len(pw) < 6:
        sys.exit("parola d'ordine troppo corta")
    data = encrypt(pack(a.src), pw, a.iterations)
    a.out.write_bytes(data)
    print(f"{a.out} scritto ({len(data) / 1024:.0f} kB)")


if __name__ == "__main__":
    main()
