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
import re
import shutil
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYODIDE = "314.0.7"                                   # Python 3.14 + numpy 2.4 in WebAssembly
CDN = f"https://cdn.jsdelivr.net/pyodide/v{PYODIDE}/full/"
CORE = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]
# SHA-256 of the files of this Pyodide version (computed from the jsDelivr release when the version was pinned). A different hash stops the build:
# a tampered CDN file would otherwise run inside every student's browser. When PYODIDE is updated, recompute them. numpy is checked against
# the sha256 written in pyodide-lock.json (which is itself pinned here).
SHA256 = {
    "pyodide.mjs": "6f1d60f7bf529beb300f0f47983c921d3982363640ba20af0e38efdddbc66109",
    "pyodide.asm.mjs": "f7cdc8ece80678ceb712f8e65ebe6d3a83203a180c399865f49612a051693635",
    "pyodide.asm.wasm": "cc36e3cab04fdfc9a63ff13eb52eae2b911bf46c025cc7b281f394bd3de1d5e6",
    "python_stdlib.zip": "fa1957e5777068fc4f7437f96d860ae2fbe9c19732ba06c84e004ec16dd7dd7a",
    "pyodide-lock.json": "5dc2fc119108bc148c7457dc86e7675b5c87e1cafd420b9c34c1eaef7b36c010",
}


def check_sha256(path: Path, want: str) -> None:
    got = hashlib.sha256(path.read_bytes()).hexdigest()
    if got != want:
        raise SystemExit(f"{path.name}: SHA-256 {got} is not the expected {want}: build stopped")


# The visible name of the program lives only in qqq_lab/web/appname.js
APP_NAME = re.search(r'APP_NAME\s*=\s*"([^"]+)"', (ROOT / "qqq_lab" / "web" / "appname.js").read_text(encoding="utf-8")).group(1)

# Address of the published site (GitHub Pages): link previews (WhatsApp, Telegram, Slack...) need ABSOLUTE addresses for the page and the picture
SITE_URL = "https://freeesta.github.io/QqQ-lab/"
TAGLINE = "Analisi di dati LC-MS/MS direttamente nel browser"
DESCRIPTION = "Esplora cromatogrammi, spettri, XIC e MRM dei tuoi file LC-MS/MS nel browser. Nessuna installazione: i dati restano sul tuo computer."


def preview_tags() -> str:
    """Open Graph + Twitter card + description: what a chat app reads (without running any JavaScript) to build the preview of a shared link."""
    a = lambda t: t.replace("&", "&amp;").replace('"', "&quot;")
    title = f"{APP_NAME} · {TAGLINE}"
    img = SITE_URL + "static/anteprima.png"
    meta = [("name", "description", DESCRIPTION), ("property", "og:type", "website"), ("property", "og:site_name", APP_NAME), ("property", "og:locale", "it_IT"), ("property", "og:url", SITE_URL),
            ("property", "og:title", title), ("property", "og:description", DESCRIPTION), ("property", "og:image", img), ("property", "og:image:type", "image/png"),
            ("property", "og:image:width", "1200"), ("property", "og:image:height", "630"), ("property", "og:image:alt", f"{APP_NAME}: un cromatogramma e uno spettro di massa"),
            ("name", "twitter:card", "summary_large_image"), ("name", "twitter:title", title), ("name", "twitter:description", DESCRIPTION), ("name", "twitter:image", img)]
    return "\n".join(f'<meta {k}="{n}" content="{a(v)}">' for k, n, v in meta) + f'\n<link rel="canonical" href="{SITE_URL}">'


# Web app manifest (PWA). Paths are relative to the manifest, which sits in the site root, so it works under /QqQ-lab/.
MANIFEST = {
    "name": APP_NAME, "short_name": APP_NAME, "lang": "it", "dir": "ltr",
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


def check_no_private(out: Path) -> None:
    """Of TP Mine only the encrypted tpmine.enc and the public loader may be in the site; no private source in plain text."""
    for f in out.rglob("*"):
        if not f.is_file() or "vendor" in f.parts or "pyodide" in f.parts:
            continue
        if f.name.startswith("tpmine") and f.name not in ("tpmine-loader.js", "tpmine.enc"):
            raise SystemExit(f"{f}: a TP Mine file that must not be published")
        if f.suffix in (".js", ".py", ".html", ".json", ".txt", ".css", ".mjs", ".toml") and b"TPMINE-PRIVATE" in f.read_bytes():
            raise SystemExit(f"{f}: contains private TP Mine source in plain text")


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
    for lic in ("LICENSE", "LICENZE-TERZI.md"):            # the licences travel with the site (Apache-2.0, BSD-3, MPL-2.0 ask for the notices)
        if (ROOT / lic).exists():
            shutil.copy2(ROOT / lic, out / lic)
    # the page: same index.html, plus the bridge that answers api/... without a server
    html = (static / "index.html").read_text(encoding="utf-8")
    html = html.replace("<head>", '<head>\n<script src="static/browser.js"></script>', 1)
    # the name in the title is written here, not by appname.js: the apps that build link previews do not run JavaScript
    html = html.replace("<title>{APP}</title>", f"<title>{APP_NAME} · {TAGLINE}</title>", 1)
    html = html.replace("</head>", preview_tags() + "\n</head>", 1)
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
        check_sha256(py / n, SHA256[n])
    lock = json.loads((py / "pyodide-lock.json").read_text(encoding="utf-8"))
    fetch(lock["packages"]["numpy"]["file_name"], py, a.pyodide_dir)
    check_sha256(py / lock["packages"]["numpy"]["file_name"], lock["packages"]["numpy"]["sha256"])
    # service worker at the site root (scope = the whole site): offline use after the first visit
    sw = (static / "sw.js").read_text(encoding="utf-8")
    (static / "sw.js").unlink()
    h = hashlib.sha1()
    for f in sorted(out.rglob("*")):
        if f.is_file() and "pyodide" not in f.parts and "vendor" not in f.parts:
            h.update(f.relative_to(out).as_posix().encode() + f.read_bytes())
    big = PYODIDE + "-" + hashlib.sha1("".join(f"{f.name}{f.stat().st_size}" for f in sorted((static / "vendor").rglob("*")) if f.is_file()).encode()).hexdigest()[:8]
    (out / "sw.js").write_text(sw.replace("__APP__", h.hexdigest()[:10]).replace("__BIG__", big), encoding="utf-8")
    check_no_private(out)
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"site/ ready: {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
