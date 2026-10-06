"""TP Mine (b)+(c): the engine in Pyodide and the TP Mine tab. Synthetic bentazone + the real B_ series (flufenacet) if the mzML are there.
Throw-away random password. Run from the repo root: python3 tests_e2e/e2e_tpmine2.py   (env: TPMINE_SRC, QQQ_MZML, PYODIDE_DIR)"""
import os, secrets, shutil, subprocess, sys, time, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent; ROOT = HERE.parent
SRC = Path(os.environ.get("TPMINE_SRC", ROOT.parent / "QqQ_lab_privato" / "tpmine"))
MZ = Path(os.environ.get("QQQ_MZML", ROOT.parent / "Data" / "mzML"))
PORT = 8842
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e)[:400]))
pw = secrets.token_urlsafe(12); tmp = Path(tempfile.mkdtemp()); enc = ROOT / "qqq_lab" / "web" / "tpmine.enc"
subprocess.run([sys.executable, str(ROOT / "tools" / "build_tpmine.py"), "--src", str(SRC), "--out", str(enc), "--iterations", "310000"], check=True, env=dict(os.environ, TPMINE_PASSWORD=pw))
cmd = [sys.executable, str(ROOT / "tools" / "build_site.py"), "--out", str(tmp / "site")]
if os.environ.get("PYODIDE_DIR"): cmd += ["--pyodide-dir", os.environ["PYODIDE_DIR"]]
subprocess.run(cmd, check=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "-d", str(tmp / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(viewport={"width": 1500, "height": 1400}).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("response", lambda r: errs.append(("http%d" % r.status, r.url)) if r.status >= 400 and "logo.svg" not in r.url and "/vendor/" not in r.url else None)   # logo and vendor are not in the cloud copy
        pg.goto(f"http://127.0.0.1:{PORT}/"); pg.wait_for_selector("#drop", timeout=120000)
        for _ in range(5): pg.click('button.hq[data-help="header"]')
        pg.wait_for_selector("#qt-dlg[open]"); pg.fill("#qt-pw", pw); pg.click("#qt-go"); pg.wait_for_selector('#nav button[data-v="tpmine"]', timeout=30000)
        pg.click('#nav button[data-v="tpmine"]'); pg.wait_for_selector("#tp-go")
        def demo():
            pg.click("#tp-demo"); pg.wait_for_function("document.querySelector('#tp-files table') && document.querySelectorAll('#tp-files tr').length >= 9", timeout=240000)
            pg.wait_for_function("document.querySelector('#tp-prev').textContent.includes('241.0641')", timeout=60000)
            assert "C10H12N2O3S" in pg.inner_text("#tp-prev")
            assert "idrossilazione" in pg.input_value("#tp-tr")
            pg.click("#tp-go"); pg.wait_for_selector("#tp-view .gem", timeout=300000)
            assert pg.evaluate("document.querySelectorAll('.gem.forte').length") == 3
            pg.wait_for_timeout(1300)
            assert pg.inner_text(".stat.g b").strip() == "3" and "Filone trovato" in pg.inner_text(".hero")
            assert pg.evaluate("document.querySelector('#tp-struct svg') !== null")          # parent structure drawn from the SMILES (needs vendor/openchemlib.js)
            pg.click('.vt[data-v="tab"]'); pg.wait_for_selector("#tp-t tr.clk")
            t = pg.inner_text("#tp-t")
            for need in ("idrossilazione", "perdita di propene", "deidrogenazione"): assert need in t, need
            pg.click('.vt[data-v="map"]'); pg.wait_for_selector(".mnode"); assert pg.evaluate("document.querySelectorAll('.mnode').length") >= 4
            pg.click('.vt[data-v="kin"]'); pg.wait_for_selector("#tp-c-all"); assert pg.evaluate("document.getElementById('tp-c-all').width") > 0
            pg.click('.vt[data-v="film"]'); pg.wait_for_selector(".frow"); pg.click("#tp-play"); pg.wait_for_timeout(2200)
            assert "t = 5" in pg.inner_text("#tp-tl") or "t = 10" in pg.inner_text("#tp-tl"), pg.inner_text("#tp-tl")
            pg.click('.vt[data-v="gems"]'); pg.click(".gem:has-text('idrossilazione')"); pg.wait_for_selector("#tp-c-xic", timeout=60000); pg.wait_for_timeout(500)
            d = pg.inner_text("#tp-det")
            assert "In parole" in d and "frammento del progenitore" in d and "Livello 3" in d and "257.1" in d, d[:700]
            pg.screenshot(path=str(HERE / "shots" / "tpmine2_demo.png"), full_page=True)
        step("bentazone (synthetic): files, formula from SMILES, search, ranking, detail with MS2 and level 3", demo)
        def xl():
            with pg.expect_download(timeout=120000) as dl: pg.click("#tp-x-xlsx")
            path = dl.value.path(); import zipfile; z = zipfile.ZipFile(path); assert z.testzip() is None; names = z.namelist(); assert any("sheet" in n for n in names), names
        step("xlsx export", xl)
        if MZ.exists() and (MZ / "B_FullMass-t0.mzML").exists():
            def real():
                pg.reload(); pg.wait_for_selector("#drop", timeout=120000)
                for _ in range(5): pg.click('button.hq[data-help="header"]')
                pg.wait_for_selector("#qt-dlg[open]"); pg.fill("#qt-pw", pw); pg.click("#qt-go"); pg.wait_for_selector('#nav button[data-v="tpmine"]', timeout=30000)
                pg.click('#nav button[data-v="tpmine"]'); pg.wait_for_selector("#tp-go")
                names = ["B_FullMass-t0", "B_FullMass-t5", "B_FullMass-t10", "B_FullMass-t15", "B_FullMass-t30 (2)", "B_FullMass-t45", "B_FullMass-t60", "B_MS2-t15", "B_MS2-t45", "B_MS2-t60", "B_MRM-t0", "B_MRM-t5", "B_MRM-t10", "B_MRM-t15", "B_MRM-t30", "B_MRM-t45", "B_MRM-t60", "B_MRM-STD_0_06ppm", "B_MRM-STD_0_6ppm", "B_MRM-STD_2_4ppm", "B_MRM-STD_7_2ppm", "B_MRM-STD_12ppm", "B_MRM-STD_18ppm"]
                pg.set_input_files("#tp-in", [str(MZ / (n + ".mzML")) for n in names])
                pg.wait_for_function("document.querySelectorAll('#tp-files tr').length >= 24", timeout=300000)
                pg.fill("#tp-mol", "CC(C)N(C(=O)COc1nnc(s1)C(F)(F)F)c1ccc(F)cc1"); pg.wait_for_function("document.querySelector('#tp-prev').textContent.includes('364.0737')", timeout=60000)
                pg.click("#tp-go"); pg.wait_for_selector("#tp-view .gem", timeout=600000); pg.wait_for_timeout(1300)
                head = pg.inner_text(".hero")
                assert "t½" in head and "offset" in head
                vals = pg.evaluate("[...document.querySelectorAll('.stat b')].map(b=>parseFloat(b.textContent))")
                assert 0.25 <= vals[4] <= 0.35 and 2.0 < vals[3] < 4.0 and vals[0] >= 3, vals
                m = pg.inner_text("#tp-right")
                assert "MRM: integrazione automatica" in m and "Retta: area" in m and "364.1>194.1" in m, m[:400]
                assert pg.evaluate("document.getElementById('tp-c-cal').width") > 0
                pg.screenshot(path=str(HERE / "shots" / "tpmine2_real.png"), full_page=True)
            step("real series (flufenacet): offset +0.3 Da, decay, strong candidates", real)
        b.close()
finally:
    srv.terminate(); enc.unlink(missing_ok=True); shutil.rmtree(tmp, ignore_errors=True)
for s_ in steps: print(s_)
print("page errors:", errs)
sys.exit(1 if any(s_[1] != "ok" for s_ in steps) or errs else 0)
