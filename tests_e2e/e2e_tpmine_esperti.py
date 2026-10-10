"""mzFinder M2 (expert tools on the difference map): with mzFinder off the button «Trova i punti» does not exist; on, on the example files
(Full Scan t0..t30) it finds points on A - B and the table has rows with group, proposed role, proof and time course.
Run from the repo root: python3 tests_e2e/e2e_tpmine_esperti.py   (needs Playwright and a built Pyodide dir or internet)"""
import os, subprocess, sys, time, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent
sys.path.insert(0, str(HERE)); import lib  # noqa: F401,E402  (patches wait_for_function for the CSP)
from lib import ready  # noqa: E402
EX = ROOT / "mzlab" / "web" / "esempi"
PORT = 8843
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e)[:400]))
tmp = Path(tempfile.mkdtemp())
cmd = [sys.executable, str(ROOT / "tools" / "build_site.py"), "--out", str(tmp / "site")]
if os.environ.get("PYODIDE_DIR"): cmd += ["--pyodide-dir", os.environ["PYODIDE_DIR"]]
subprocess.run(cmd, check=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "-d", str(tmp / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errs = []
BAR = "document.querySelector('#qt-bar') && !document.querySelector('#qt-bar').hidden && [...document.querySelectorAll('#qt-bar button')].some(b => b.textContent.includes('Trova i punti'))"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(locale="it-IT", viewport={"width": 1500, "height": 1400}).new_page()
        pg.add_init_script("try{localStorage.setItem('qqq.tour.lr',JSON.stringify({stato:'saltato'}));}catch(_){}")
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/"); pg.wait_for_selector("#drop", timeout=120000)
        pg.wait_for_timeout(1500)
        files = sorted(str(f) for f in EX.glob("FullScan_t*.mzML"))
        pg.set_input_files("#pick", files); pg.wait_for_timeout(800)
        pg.click("#opbtn"); ready(pg, timeout=240000)
        def off():
            pg.wait_for_timeout(500)
            assert not pg.evaluate(BAR), "the button exists with mzFinder off"
            assert pg.evaluate("!window.QTOOLS || QTOOLS.list().length === 0")
        step("mzFinder off: no «Trova i punti» button", off)
        pg.wait_for_timeout(3200)
        for _ in range(5): pg.click("header img.logo")
        pg.wait_for_function(BAR, timeout=120000)
        pg.click("#np-map"); ready(pg, timeout=240000); pg.wait_for_timeout(600)
        def go():
            pg.evaluate("(()=>{const q=E.panels.find(q=>q.type==='map');const fs=tabFiles('full').sort((a,b)=>a.time-b.time);q.k=fs[fs.length-1].k;q.ref=fs[0].k;ctl(q);draw(q)})()")
            ready(pg, timeout=240000); pg.wait_for_function("E.panels.some(q=>q.type==='map'&&q._a&&q._a.ref)", timeout=60000)
            pg.click("#qt-bar button:has-text('Trova i punti')"); pg.wait_for_selector("#esp-go")
            pg.click("#esp-go"); pg.wait_for_selector("#esp-out tbody tr", timeout=600000)
            n = pg.evaluate("document.querySelectorAll('#esp-out tbody tr').length"); assert n >= 1, n
            t = pg.inner_text("#esp-out"); assert "Ruolo proposto" in t and "Andamento" in t and "Priorità" in t, t[:300]
            assert pg.evaluate("document.querySelectorAll('#esp-out tbody svg').length") == n
            tr = pg.evaluate("[...document.querySelectorAll('#esp-out tbody tr')].map(r => r.children[9].textContent)")
            assert all(x in ("cresce", "cala", "costante", "cresce e poi cala") for x in tr), tr[:5]          # five files: every point has a shape of its time course
            print(pg.evaluate("[...document.querySelectorAll('#esp-out tbody tr')].slice(0,12).map(r=>[...r.children].map((c,i)=>i==8?'':c.textContent).join(' | ')).join('\\n')"))
        step("mzFinder on: «Trova i punti» on A − B gives a table with rows, roles and time course", go)
        def thresholds():
            pg.evaluate("document.querySelector('#esp-th').closest('details').open = true")
            pg.fill('#esp-th input[data-k="min_sn"]', "1000000000"); pg.dispatch_event('#esp-th input[data-k="min_sn"]', "change")
            assert pg.evaluate("JSON.parse(localStorage.getItem('qqq.mzfinder.soglie')).min_sn") == 1000000000
            pg.click("#esp-go"); pg.wait_for_function("document.querySelector('#esp-st').textContent.includes('Nessun punto')", timeout=300000)
            pg.click("#esp-def"); pg.wait_for_function("JSON.parse(localStorage.getItem('qqq.mzfinder.soglie')).min_sn === 5", timeout=10000)
        step("thresholds are saved in qqq.mzfinder.soglie and can be reset", thresholds)
        def mark():
            pg.click("#esp-go"); pg.wait_for_selector("#esp-out tbody tr", timeout=600000)
            n = pg.evaluate("document.querySelectorAll('#esp-out tbody tr').length")
            pg.click("#esp-mk"); pg.wait_for_function("document.querySelector('#esp-mk').textContent.startsWith('Segnati')")
            assert pg.evaluate("MAPPA.pts(E.panels.find(q=>q.type==='map')).length") == n
        step("«Segna sulla mappa» puts the points in the table of marked points", mark)
        b.close()
finally:
    srv.terminate()
bad = [s for s in steps if s[1] != "ok"]
for n_, r_ in steps: print(("OK  " if r_ == "ok" else "FAIL ") + n_ + ("" if r_ == "ok" else "  " + r_))
if errs: print("page errors:", errs[:3])
sys.exit(1 if bad or errs else 0)
