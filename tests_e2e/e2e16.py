"""Double click = new spectrum with its RT in the title; up/down arrows and sliding panels; the Metodo button stands out."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:220]))
r = Run(port=8816, wd="/tmp/wd16")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in FILES[:3]]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4000)
        def dbl():
            n0 = pg.evaluate("E.panels.filter(p=>p.type==='spec').length")
            for rt in (10.0, 14.3):
                c = pg.evaluate("""(x)=>{const p=E.panels[0],r=p.cv.getBoundingClientRect();return {px:r.left+p._a.X(x),py:r.top+r.height/2}}""", rt)
                pg.mouse.dblclick(c["px"], c["py"]); pg.wait_for_timeout(1200)
            n1 = pg.evaluate("E.panels.filter(p=>p.type==='spec').length"); assert n1 == n0 + 2, (n0, n1)
            t = [x.strip() for x in pg.locator(".pnl.spec .rtl").all_inner_texts()]
            assert any(x.startswith("RT 10.0") for x in t) and any(x.startswith("RT 14.2") or x.startswith("RT 14.3") for x in t), t
            hd = pg.evaluate("[...document.querySelectorAll('.pnl.spec')].pop().querySelector('.hd').innerText"); assert "Spettro di massa" in hd and "RT" in hd, hd
        step("each double click opens a new spectrum, RT next to the title", dbl)
        pg.screenshot(path=SH + "161_dbl.png")
        def arrows():
            S = "E.panels.slice().sort((a,b)=>a.y-b.y)"
            order = lambda: pg.evaluate(S + ".map(p=>p.id)")
            dis = lambda i, a: pg.evaluate(f"{S}[{i}].el.querySelector('[data-a={a}]').disabled")
            n = pg.evaluate("E.panels.length")
            assert dis(0, "up") and not dis(1, "up") and dis(n - 1, "down") and not dis(0, "down")
            o0 = order(); pg.evaluate(f"{S}[0].el.querySelector('[data-a=down]').click()"); pg.wait_for_timeout(120)
            y_mid = pg.evaluate("E.panels.find(p=>p.id==%d).el.getBoundingClientRect().top" % o0[1]); y_end = pg.evaluate("E.panels.find(p=>p.id==%d).y" % o0[1])
            pg.wait_for_timeout(700); o1 = order()
            assert o1[0] == o0[1] and o1[1] == o0[0], (o0, o1)
            assert dis(0, "up") and not dis(1, "up")
            pg.evaluate(f"{S}[1].el.querySelector('[data-a=up]').click()"); pg.wait_for_timeout(700); assert order() == o0
        step("arrows swap panels (first has no up, last no down)", arrows)
        def method():
            b = pg.locator("#np-method"); assert "imp" in b.get_attribute("class")
            pg.screenshot(path=SH + "162_method.png", clip={"x": 0, "y": 40, "width": 1500, "height": 120})
        step("Metodo button is distinct", method)
finally:
    r.close()
print("\nSTEPS"); [print(" ", s) for s in steps]
print([e for e in r.errs if "ERR_ABORTED" not in str(e)])
