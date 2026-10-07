"""TP Mine step (a): encryption, unlock, registry. Uses a throw-away random password (never the real one) and the demo private sources.
Run from the repo root: python3 tests_e2e/e2e_tpmine1.py   (needs `cryptography`, Playwright, and a built Pyodide dir or internet)"""
import os, secrets, shutil, subprocess, sys, time, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(HERE)); import lib  # noqa: F401  (patches wait_for_function for the CSP)
SRC = Path(os.environ.get("TPMINE_SRC", ROOT / "TP_Mine"))
PORT = 8841
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e)[:300]))

pw = secrets.token_urlsafe(12)
tmp = Path(tempfile.mkdtemp())
enc = ROOT / "qqq_lab" / "web" / "tpmine.enc"
import atexit; _orig_enc = enc.read_bytes() if enc.exists() else None
atexit.register(lambda: enc.write_bytes(_orig_enc) if _orig_enc is not None else enc.unlink(missing_ok=True))   # the real tpmine.enc is tracked: put it back
env = dict(os.environ, TPMINE_PASSWORD=pw)
subprocess.run([sys.executable, str(ROOT / "tools" / "build_tpmine.py"), "--src", str(SRC), "--out", str(enc), "--iterations", "310000"], check=True, env=env)
cmd = [sys.executable, str(ROOT / "tools" / "build_site.py"), "--out", str(tmp / "site")]
if os.environ.get("PYODIDE_DIR"): cmd += ["--pyodide-dir", os.environ["PYODIDE_DIR"]]
subprocess.run(cmd, check=True)
site = tmp / "site"
marker = b"Elenco delle trasformazioni (nome;variazione)"
def no_plain():
    for f in site.rglob("*"):
        if f.is_file() and "pyodide" not in f.parts and "vendor" not in f.parts:
            b = f.read_bytes()
            assert marker not in b and b"TPMINE-PRIVATE" not in b, f
    assert (site / "static" / "tpmine.enc").exists() and (site / "static" / "tpmine-loader.js").exists()
    assert not any(f.name.startswith("tpmine") and f.name not in ("tpmine.enc", "tpmine-loader.js") for f in site.rglob("*"))
step("built site has no plain-text private source", no_plain)

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "-d", str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(viewport={"width": 1400, "height": 900}).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/"); pg.wait_for_selector("#drop", timeout=120000)
        def hidden():
            assert pg.evaluate("!document.getElementById('qt-bar') || document.getElementById('qt-bar').hidden")
            assert pg.evaluate("window.QTOOLS.list().length") == 0
            pg.click('button.hq[data-help="header"]'); assert pg.evaluate("!document.getElementById('qt-dlg')")        # one click: only the help
        step("before the unlock nothing is visible", hidden)
        def wrong():
            pg.wait_for_timeout(3200)
            for _ in range(5): pg.click('button.hq[data-help="header"]')
            pg.wait_for_selector("#qt-dlg[open]"); pg.fill("#qt-pw", "parola-sbagliata"); pg.click("#qt-go")
            pg.wait_for_function("document.getElementById('qt-msg').textContent.includes('vuoto')", timeout=30000)
            assert pg.evaluate("window.QTOOLS.list().length") == 0 and not pg.query_selector('#nav button[data-v="tpmine"]')
            assert marker.decode() not in pg.content()
        step("wrong password: ironic message, nothing unlocked", wrong)
        def right():
            pg.fill("#qt-pw", pw); pg.click("#qt-go")
            pg.wait_for_selector('#nav button[data-v="tpmine"]', timeout=30000)
            assert pg.evaluate("window.QTOOLS.list().map(t=>t.id)") == ["tpmine"]
            assert not pg.evaluate("document.getElementById('qt-dlg').open")
            pg.click('#nav button[data-v="tpmine"]'); pg.wait_for_selector("#tp-go")
            assert marker.decode() in pg.inner_text("#v-tpmine") and not pg.evaluate("document.getElementById('v-draw').offsetParent")
            pg.click('#nav button[data-v="theory"]'); assert pg.evaluate("document.getElementById('v-tpmine').hidden")
            pg.screenshot(path=str(HERE / "shots" / "tpmine1.png")) if (HERE / "shots").exists() else None
        step("right password: tool registered and opened", right)
        def nostore():
            r = pg.evaluate("""async()=>{const out=[];for(const k of await caches.keys()){const c=await caches.open(k);for(const q of await c.keys()){const t=q.url;if(/blob:/.test(t))out.push(t)}}
              return {cache:out,ls:Object.keys(localStorage),ss:Object.keys(sessionStorage),dbs:(await indexedDB.databases()).map(d=>d.name)}}""")
            assert not r["cache"] and not any("tp" in k.lower() for k in r["ls"] + r["ss"]), r
            assert pw not in pg.evaluate("JSON.stringify([localStorage,sessionStorage])")
        step("nothing decrypted or the password stored", nostore)
        def again():
            pg.reload(); pg.wait_for_selector("#drop", timeout=120000)
            assert pg.evaluate("window.QTOOLS.list().length") == 0        # locked again after a reload (password not kept)
        step("after a reload it is locked again", again)
        b.close()
finally:
    srv.terminate(); enc.unlink(missing_ok=True); shutil.rmtree(tmp, ignore_errors=True)
for s in steps: print(s)
print("page errors:", errs)
sys.exit(1 if any(s[1] != "ok" for s in steps) or errs else 0)
