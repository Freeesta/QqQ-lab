"""The example files published with the site: one button (inside box 1, under the drop zone) loads the five example Full Scan files, with neutral names: the unknown pollutant is never named (t0, t5, t10, t15, t30) and they open."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
r = Run(port=8883, wd="/tmp/wd83")
steps = []
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.click("#demobtn"); pg.wait_for_function("document.querySelectorAll('#flist [data-k=time]').length===5", timeout=30000); pg.wait_for_timeout(500)
        t = pg.inner_text("#flist"); assert t.count("Full Scan") >= 1 and "Esempio_FullScan_t30" in t, t
        tm = pg.evaluate("[...document.querySelectorAll('#flist [data-k=time]')].map(x=>+x.value)"); assert sorted(tm) == [0, 5, 10, 15, 30], tm
        assert pg.locator("#demo a").count() == 0, "no download links any more"
        assert pg.evaluate("(()=>{const b=document.querySelector('#demobtn').getBoundingClientRect(),d=document.querySelector('#drop').getBoundingClientRect(),c=document.querySelector('#drop').closest('.card').getBoundingClientRect();return b.top>=d.bottom&&b.bottom<=c.bottom&&b.left>=c.left})()"), "button inside box 1, under the drop zone"
        assert "flufenacet" not in pg.inner_text("body").lower() and "flufenacet" not in (pg.get_attribute("#demobtn", "title") or "").lower()
        pg.click("text=Carica dati"); pg.wait_for_timeout(5000)
        assert pg.evaluate("tabFiles('full').length") == 5 and pg.evaluate("E.panels.some(p=>p.type==='spec'&&p._a)")
        assert "flufenacet" not in pg.inner_text("body").lower(), "the compound is never named after the files are open"
        steps.append(("demo button loads 5 files with times 0/5/10/15/30, no links, button in box 1, no compound name, data open", "ok"))
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
