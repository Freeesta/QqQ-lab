"""The «Dimensione testo» setting was removed (9/10): the browser zoom (Ctrl/Cmd + and −) is the way; an old saved value is ignored."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_testo.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
SPEC = "E.panels.find(p=>p.type==='spec'&&p.tab==='full')"
r = Run(port=8886, wd="/tmp/wd86")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz("B_FullMass-t0"), mz("B_FullMass-t15")]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); ready(pg)
        def gone():
            pg.evaluate("localStorage.setItem('qqq.prefs', JSON.stringify({font:130}))"); pg.reload(); pg.wait_for_timeout(2500)   # an old saved value is ignored
            assert pg.evaluate("UIP.font") is None and pg.evaluate("fz()") == 1
            pg.click("#np-set"); pg.wait_for_timeout(300)
            t = pg.inner_text("#uipset"); assert "Dimensione testo" not in t and pg.locator("#uipset [data-f]").count() == 0, t
            pg.keyboard.press("Escape")
        step("the text size setting is gone; an old saved value is ignored; the browser zoom is the way", gone)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for nme, st in steps: print(("OK   " if st == "ok" else "FAIL ") + nme + ("" if st == "ok" else "  " + st))
r.report()
sys.exit(0 if all(s == "ok" for _, s in steps) else 1)
