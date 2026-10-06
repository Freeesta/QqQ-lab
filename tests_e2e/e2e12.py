# e2e12: experiment type column, sidebar, no Esporta/Integrazioni buttons, integration icons, MS2 chromatogram, PNG without cursor, Metodo layout, italic m/z
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:300]))
r = Run(port=8822, wd="/tmp/wd12")
F = FILES + ["scansione-15"]
with sync_playwright() as p:
    pg = r.page(p)
    pg.set_input_files("#pick", [mz(f) for f in F]); pg.wait_for_timeout(2500)
    pg.screenshot(path=SH + "120_start.png")
    def column():
        rows = pg.evaluate("ST.files.map(f=>[f.name,f.kind,f.mode])")
        d = {n: (k, m) for n, k, m in rows}
        assert d["B_MRM-t0.mzML"][0] == "mrm" and d["B_MS2-t15.mzML"][0] == "ms2" and d["B_FullMass-t0.mzML"] == ("full", "q1"), d
        assert "Esperimento" in pg.inner_text("#flist") and "MS2" in pg.inner_text("#flist") and "MRM" in pg.inner_text("#flist")
    step("start screen detects the experiment from the content", column)
    pg.locator('#flist select[data-k=mode]').first.select_option("ems")
    pg.click("text=Apri i dati"); pg.wait_for_timeout(5000)
    pg.screenshot(path=SH + "121_data.png")
    def side():
        t = pg.inner_text("#flst"); assert "scan MS1" not in t and "RT 0.5" not in t and "Doppio clic" not in pg.inner_text("#dfiles"), t
        assert "FULL SCAN (EMS)" in t.upper() and "MS2" in t and "MRM" in t, t
        assert pg.locator("#np-export, #np-ints, #kindinfo").count() == 0
    step("sidebar slim, EMS chosen at start, no Esporta/Integrazioni/Rilevato", side)
    def integ():
        c = pg.locator('.pnl.chrom').first
        c.locator('[data-a=iauto]').click()
        a = pg.evaluate("E.panels[0]._a"); box = c.locator("canvas").bounding_box()
        x = pg.evaluate("E.panels[0]._a.X(14.33)"); pg.mouse.click(box["x"] + x, box["y"] + 120); pg.wait_for_timeout(600)
        n1 = pg.evaluate("E.panels[0].ints.length"); assert n1 == 1, n1
        c.locator('[data-a=iauto]').click()      # off
        c.locator('[data-a=iman]').click()
        pg.mouse.move(box["x"] + pg.evaluate("E.panels[0]._a.X(5)"), box["y"] + 100); pg.mouse.down(); pg.mouse.move(box["x"] + pg.evaluate("E.panels[0]._a.X(6)"), box["y"] + 100, steps=5); pg.mouse.up(); pg.wait_for_timeout(500)
        assert pg.evaluate("E.panels[0].ints.length") == 2
        assert c.locator('[data-a=itab]').is_visible()
        pg.screenshot(path=SH + "122_integr.png")
        c.locator('[data-a=iman]').click()
    step("integration: auto click + manual drag + table icon", integ)
    def ms2():
        pg.evaluate("E.files.forEach(f=>f.vis=f.kind==='ms2');renderFileList();redrawAll()"); pg.wait_for_timeout(1500)
        sel = pg.locator('.pnl.chrom [data-o=prec]').first; assert sel.count() == 1
        n0 = pg.evaluate("E.panels[0]._a.sr[0].x.length"); sel.select_option("305"); pg.wait_for_timeout(1500)
        n1 = pg.evaluate("E.panels[0]._a.sr[0].x.length"); assert 0 < n1 < n0, (n0, n1)
        pg.screenshot(path=SH + "123_ms2.png")
    step("MS2 chromatogram: choose the precursor", ms2)
    def png():
        pg.evaluate("E.files.forEach(f=>f.vis=true);redrawAll()"); pg.wait_for_timeout(800)
        assert pg.evaluate("E.panels[0].cur") is not None
        with pg.expect_download() as d: pg.locator('.pnl.chrom [data-a=png]').first.click()
        pg.wait_for_timeout(500); print("PNG", d.value.suggested_filename); d.value.save_as("/tmp/chrom.png")
        with pg.expect_download() as d2: pg.locator('.pnl.spec [data-a=png]').first.click()
        d2.value.save_as("/tmp/spec.png")
        assert pg.evaluate("E.panels[0]._exp") in (False, None)
    step("PNG downloads", png)
    def method():
        pg.evaluate("E.cur=1;E.browse=true;renderFileList();renderNav()")
        pg.set_input_files("input[type=file][accept*='.dam']", []) if False else None
        pg.click("#np-method"); pg.wait_for_timeout(1500); t = pg.inner_text("#bigdlg"); assert "MRM" in t and "transizione" in t.lower(), t[:300]
        pg.screenshot(path=SH + "124_method_mrm.png"); pg.click("#bigx")
        pg.evaluate("E.cur=3;renderFileList();renderNav()"); pg.click("#np-method"); pg.wait_for_timeout(1500)
        assert "ioni prodotto" in pg.inner_text("#bigdlg"); pg.screenshot(path=SH + "125_method_ms2.png"); pg.click("#bigx")
    step("Metodo: MRM and MS2 explained", method)
    def ital():
        n = pg.evaluate("[...document.querySelectorAll('#v-data *')].filter(e=>e.children.length==0&&e.tagName!=='I'&&e.tagName!=='OPTION'&&e.tagName!=='SCRIPT'&&/m\\/z/.test(e.textContent)).map(e=>e.outerHTML.slice(0,100))")
        assert not n, n
    step("m/z always italic in the page", ital)
    pg.wait_for_timeout(500)
    r.errs = [e for e in r.errs if "openchemlib" not in str(e) and "404" not in str(e)]
    r.close()
for s in steps: print(" ", s)
print(r.errs[:6])
