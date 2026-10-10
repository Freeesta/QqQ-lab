"""manifest.json of the site (tools/build_site.py) and the matching edits of the desktop folder (crates/mzlab-desktop)."""
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_manifest_lists_every_file_with_sha256_and_size(tmp_path):
    bs = _load(ROOT / "tools" / "build_site.py", "build_site_m")
    (tmp_path / "static" / "pyodide").mkdir(parents=True)
    (tmp_path / "index.html").write_text("<html>é</html>", encoding="utf-8")
    (tmp_path / "static" / "a.js").write_bytes(b"abc")
    (tmp_path / "static" / "pyodide" / "x.wasm").write_bytes(bytes(range(256)))
    (tmp_path / "static" / "manifest.json").write_text("old")
    bs.write_manifest(tmp_path, "abc1234")
    m = json.loads((tmp_path / "static" / "manifest.json").read_text())
    assert m["version"] == "abc1234" and m["desktop_min"] == bs.DESKTOP_MIN
    assert sorted(m["files"]) == ["index.html", "static/a.js", "static/pyodide/x.wasm"]   # not the manifest itself
    for rel, e in m["files"].items():
        data = (tmp_path / rel).read_bytes()
        assert e == {"sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}


def test_desktop_min_is_not_newer_than_the_native_app():
    bs = _load(ROOT / "tools" / "build_site.py", "build_site_m2")
    ver = re.search(r'(?m)^version = "([^"]+)"', (ROOT / "Cargo.toml").read_text()).group(1)
    as_tuple = lambda v: tuple(int(x) for x in v.split("."))
    assert as_tuple(bs.DESKTOP_MIN) <= as_tuple(ver)


def test_rust_and_python_make_the_same_edits_to_the_desktop_page():
    """update.rs (new index.html of an update) and prepare.py (index.html of the installer) must agree on the three constants."""
    prep = (ROOT / "crates" / "mzlab-desktop" / "prepare.py").read_text()
    rs = (ROOT / "crates" / "mzlab-desktop" / "src" / "update.rs").read_text()
    csp = re.search(r'CSP_EXTRA = "([^"]+)"', prep).group(1)
    assert f'pub const CSP_EXTRA: &str = "{csp}";' in rs
    assert '<script src="static/desktop-shim.js"></script>' in prep and 'r#"<script src="static/desktop-shim.js"></script>"#' in rs
    assert '<script src="static/browser.js"></script>' in prep and 'r#"<script src="static/browser.js"></script>"#' in rs
