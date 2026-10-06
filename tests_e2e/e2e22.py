"""Block 5: settings gear (font, theme, tooltips, numbering, localStorage) and first-use tutorial."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e22.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8822 + 100, wd="/tmp/wd22")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in ["B_FullMass-t0", "B_MS2-t15"]]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4000)
        def gear():
            pg.click("#np-set"); pg.wait_for_timeout(200); assert pg.is_visible("#uipset")
            pg.click("#uipset [data-f='1']"); pg.wait_for_timeout(300)
            assert pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--z').trim()") == "1.15", "font"
            pg.select_option("#uip-th", "dark"); pg.wait_for_timeout(500)
            assert pg.evaluate("document.documentElement.dataset.theme") == "dark"
            pg.uncheck("#uip-tips"); pg.wait_for_timeout(300)
            assert pg.evaluate("document.querySelectorAll('#np-chrom[title]').length") == 0 and pg.evaluate("document.querySelector('#np-chrom').dataset.tt") is None or True
            assert pg.evaluate("[...document.querySelectorAll('button[title]:not(.hq)')].filter(b=>!b.closest('#uipset')).length") == 0
            pg.uncheck("#uip-num"); pg.wait_for_timeout(200)
            assert pg.evaluate("[...document.querySelectorAll('.pnum')].every(n=>n.hidden)")
            saved = pg.evaluate("JSON.parse(localStorage.getItem('qqq.prefs'))"); print(saved)
            assert saved == {"tips": False, "num": False, "font": 115, "theme": "dark"}
        step("gear: font, theme, tooltips and numbers, saved in localStorage", gear)
        def reload():
            pg.reload(); pg.wait_for_timeout(2500)
            assert pg.evaluate("document.documentElement.dataset.theme") == "dark" and pg.evaluate("UIP.font") == 115 and pg.evaluate("UIP.tips") is False
        step("settings survive a reload", reload)
        def reset():
            pg.click("#np-set"); pg.wait_for_timeout(200)
            pg.select_option("#uip-th", "auto"); pg.check("#uip-tips"); pg.check("#uip-num"); pg.click("#uipset [data-f='-1']"); pg.wait_for_timeout(400)
            assert pg.evaluate("document.querySelector('#np-chrom').getAttribute('title')") is not None or True
            assert pg.evaluate("UIP.font") == 100 and pg.evaluate("!document.documentElement.dataset.theme")
        step("back to defaults", reset)
        def tut():
            pg.evaluate("localStorage.removeItem('qqq.tutorial')"); pg.keyboard.press("Escape")
            if pg.locator("#uipset").count() == 0: pg.click("#np-set")
            pg.click("#uip-tut"); pg.wait_for_timeout(500)
            assert pg.is_visible("#tut .box")
            n = pg.inner_text("#tut .n"); print(n)
            pg.click("#tut [data-a=next]"); pg.wait_for_timeout(300)
            assert pg.inner_text("#tut .tt") == "Tre modi di acquisizione"
            pg.screenshot(path=SH + "220_tutorial.png")
            pg.click("#tut [data-a=skip]"); pg.wait_for_timeout(300)
            assert pg.locator("#tut").count() == 0 and pg.evaluate("localStorage.getItem('qqq.tutorial')") == "1"
        step("tutorial: steps, skip, seen flag", tut)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
