"""The example files published with the site: one button loads the five Flufenacet Full Scan files (t0, t5, t10, t15, t30) and they open."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
r = Run(port=8883, wd="/tmp/wd83")
steps = []
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.click("#demobtn"); pg.wait_for_function("document.querySelectorAll('#flist [data-k=time]').length===5", timeout=30000); pg.wait_for_timeout(500)
        t = pg.inner_text("#flist"); assert t.count("Full Scan") >= 1 and "Flufenacet_FullScan_t30" in t, t
        tm = pg.evaluate("[...document.querySelectorAll('#flist [data-k=time]')].map(x=>+x.value)"); assert sorted(tm) == [0, 5, 10, 15, 30], tm
        links = pg.evaluate("[...document.querySelectorAll('#demo a[download]')].map(a=>a.getAttribute('href'))"); assert len(links) == 5, links
        for l in links:
            assert pg.evaluate("(u)=>fetch(u).then(r=>r.status)", l) == 200, l
        pg.click("text=Carica dati"); pg.wait_for_timeout(5000)
        assert pg.evaluate("tabFiles('full').length") == 5 and pg.evaluate("E.panels.some(p=>p.type==='spec'&&p._a)")
        steps.append(("demo button loads 5 files with times 0/5/10/15/30, links download, data open", "ok"))
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
