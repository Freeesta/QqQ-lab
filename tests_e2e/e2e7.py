"""Teoria tab: the module opens inside the app, every chapter loads from /static/teoria/ without JS errors,
and the interactive figures draw something. Also opens index.html directly from disk (file://)."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import re
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:200]))
# every page of the menu (chapters and Pratica), read from the CHAPTERS list of teoria.js: a new chapter is tested by itself
PAGES = re.findall(r'^\s*\["([\w.-]+\.html)"', (ROOT / "mzlab" / "web" / "teoria" / "teoria.js").read_text(encoding="utf-8"), re.M)
assert len(PAGES) >= 14, PAGES
r = Run(port=8817, wd="/tmp/wd7")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        def tab():
            pg.click("#nav button[data-v=theory]"); pg.wait_for_timeout(1500)
            assert pg.evaluate("!document.querySelector('#v-theory').hidden")
            fr = pg.frame_locator("#tframe")
            assert "Dalla cuvetta allo spettro" in fr.locator("h1").inner_text()
        step("Teoria tab shows the module in an iframe", tab)
        pg.screenshot(path=SH + "70_teoria_tab.png")
        def back():
            pg.click("#nav button[data-v=data]"); pg.wait_for_timeout(300)
            assert pg.evaluate("document.querySelector('#v-theory').hidden")
        step("back to Dati hides it", back)
        base = f"http://127.0.0.1:{r.port}/static/teoria/"
        for name in PAGES:
            def visit(name=name):
                n0 = len(r.errs)
                pg.goto(base + name); pg.wait_for_timeout(1500)
                assert pg.locator("#side a.on").count() >= 1, "chapter list"
                bad = [e for e in r.errs[n0:] if e[0] in ("pageerror", "console.error") or e[0].startswith("http")]
                assert not bad, bad
                # every canvas of an interactive figure has non-white pixels
                blank = pg.evaluate("""()=>[...document.querySelectorAll('.sim canvas')].filter(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=16)if(d[i]<235||d[i+1]<235||d[i+2]<235)return false;return true}).length""")
                assert blank == 0, f"{blank} blank canvas"
            step("chapter " + name, visit)
            pg.screenshot(path=SH + "71_" + name.replace(".html", "") + ".png", full_page=True)
        def filemode():
            n0 = len(r.errs)
            pg.goto("file://" + str(ROOT / "mzlab" / "web" / "teoria" / "09-quadrupolo.html")); pg.wait_for_timeout(1500)
            assert pg.locator("#sim-stab canvas").count() == 2
            bad = [e for e in r.errs[n0:] if e[0] in ("pageerror", "console.error")]
            assert not bad, bad
        step("opens from disk without the server (file://)", filemode)
finally:
    r.close()
r.report()
for s in steps: print(" ", s)
