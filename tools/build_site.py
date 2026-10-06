"""Builds the static site (the whole program running in the browser) into site/.

    python tools/build_site.py                      # downloads Pyodide from the jsDelivr CDN (needs internet)
    python tools/build_site.py --pyodide-dir DIR    # uses an already downloaded copy (tests)

site/index.html + site/static/ (the web folder as is) + site/static/qqq_lab.zip (the Python code) + site/static/pyodide/
(Python + numpy compiled to WebAssembly). GitHub Pages serves it as it is (.github/workflows/pages.yml).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYODIDE = "314.0.7"                                   # Python 3.14 + numpy 2.4 in WebAssembly
CDN = f"https://cdn.jsdelivr.net/pyodide/v{PYODIDE}/full/"
CORE = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]


# Web app manifest (PWA). Paths are relative to the manifest, which sits in the site root, so it works under /QqQ-lab/.
MANIFEST = {
    "name": "QqQ lab", "short_name": "QqQ lab", "lang": "it", "dir": "ltr",
    "description": "Esplora i dati LC-MS/MS del triplo quadrupolo (Full Scan, Product ion, MRM) direttamente nel browser.",
    "start_url": "./", "scope": "./", "id": "./", "display": "standalone",
    "background_color": "#ffffff", "theme_color": "#ffffff", "categories": ["education", "science"],
    "icons": [
        {"src": "static/app-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "static/app-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "static/app-icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}


def fetch(name: str, dest: Path, src_dir: Path | None) -> None:
    if src_dir is not None:
        shutil.copy2(src_dir / name, dest / name)
        return
    with urllib.request.urlopen(CDN + name, timeout=300) as r, open(dest / name, "wb") as fh:
        shutil.copyfileobj(r, fh)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pyodide-dir", type=Path)
    ap.add_argument("--out", type=Path, default=ROOT / "site")
    a = ap.parse_args()
    out = a.out
    if out.exists():
        shutil.rmtree(out)
    static = out / "static"
    shutil.copytree(ROOT / "qqq_lab" / "web", static)
    # the page: same index.html, plus the bridge that answers api/... without a server
    html = (static / "index.html").read_text(encoding="utf-8")
    html = html.replace("<head>", '<head>\n<script src="static/browser.js"></script>', 1)
    # installable app (PWA): manifest at the site root + theme colour; the local program does not use it
    html = html.replace("</head>", '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#ffffff"></head>', 1)
    (out / "manifest.webmanifest").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "index.html").write_text(html, encoding="utf-8")
    (static / "index.html").unlink()
    (out / ".nojekyll").write_text("", encoding="utf-8")
    # the Python code (everything but the web folder and the pieces that need a real computer)
    with zipfile.ZipFile(static / "qqq_lab.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted((ROOT / "qqq_lab").rglob("*.py")):
            rel = f.relative_to(ROOT)
            if "web" in rel.parts or "__pycache__" in rel.parts:
                continue
            z.write(f, rel.as_posix())
    # Pyodide: core + numpy
    py = static / "pyodide"
    py.mkdir()
    for n in CORE:
        fetch(n, py, a.pyodide_dir)
    lock = json.loads((py / "pyodide-lock.json").read_text(encoding="utf-8"))
    fetch(lock["packages"]["numpy"]["file_name"], py, a.pyodide_dir)
    # service worker at the site root (scope = the whole site): offline use after the first visit
    sw = (static / "sw.js").read_text(encoding="utf-8")
    (static / "sw.js").unlink()
    h = hashlib.sha1()
    for f in sorted(out.rglob("*")):
        if f.is_file() and "pyodide" not in f.parts and "vendor" not in f.parts:
            h.update(f.relative_to(out).as_posix().encode() + f.read_bytes())
    big = PYODIDE + "-" + hashlib.sha1("".join(f"{f.name}{f.stat().st_size}" for f in sorted((static / "vendor").rglob("*")) if f.is_file()).encode()).hexdigest()[:8]
    (out / "sw.js").write_text(sw.replace("__APP__", h.hexdigest()[:10]).replace("__BIG__", big), encoding="utf-8")
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"site/ ready: {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
