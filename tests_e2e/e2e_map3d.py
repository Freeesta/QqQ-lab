"""3D view of the RT-m/z map, 2D/3D switch, difference between two full scans with normalisation."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_map3d.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8831, wd="/tmp/wd_m3d")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in ["B_FullMass-t0", "B_FullMass-t15", "B_FullMass-t60"]]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4500)
        pg.evaluate("setTab('full',true)"); pg.wait_for_timeout(600)
        def add():
            pg.click("#np-map"); pg.wait_for_timeout(2500)
            assert pg.evaluate("E.panels.some(q=>q.type==='map')")
        step("map panel opens (2D)", add)
        mid = lambda: pg.evaluate("E.panels.find(q=>q.type==='map').id")
        def three():
            pg.evaluate("id=>{const q=E.panels.find(x=>x.id===id);q.el.scrollIntoView({block:'center'});}", mid())
            pg.locator("[data-o=view][data-v='3d']").first.click(); pg.wait_for_timeout(2500)
            assert pg.evaluate("E.panels.find(q=>q.type==='map')._a.is3d") is True
            px = pg.evaluate("(()=>{const c=E.panels.find(q=>q.type==='map').cv.getBoundingClientRect();return [c.left+c.width/2,c.top+c.height/2]})()")
            pg.screenshot(path=SH + "m3d_0.png", full_page=True)
            n0 = pg.evaluate("E.panels.find(q=>q.type==='map').az")
            pg.mouse.move(px[0], px[1]); pg.mouse.down(); pg.mouse.move(px[0] + 80, px[1] + 30, steps=6); pg.mouse.up(); pg.wait_for_timeout(1200)
            assert pg.evaluate("E.panels.find(q=>q.type==='map').az") != n0
            pg.screenshot(path=SH + "m3d_a.png", full_page=True)
        step("3D view draws and rotates by dragging", three)
        def diff():
            pg.evaluate("(()=>{const q=E.panels.find(x=>x.type==='map');q.ref=E.files.filter(f=>f.kind==='full')[1].k;q.norm='max';ctl(q);draw(q)})()"); pg.wait_for_timeout(2500)
            assert "normalizzata" in pg.evaluate("E.panels.find(q=>q.type==='map').leg.textContent")
            pg.screenshot(path=SH + "m3d_b.png", full_page=True)
        step("difference between two files, normalised, in 3D", diff)
        def back():
            pg.locator("[data-o=view][data-v='2d']").first.click(); pg.wait_for_timeout(1500)
            assert pg.evaluate("E.panels.find(q=>q.type==='map')._a.is3d") is not True
            pg.screenshot(path=SH + "m3d_c.png", full_page=True)
        step("back to 2D keeps the difference", back)
        def saved():
            pg.evaluate("E.panels.find(q=>q.type==='map').view='3d';uiSave()"); pg.wait_for_timeout(800)
            assert '"view":"3d"' in pg.evaluate("JSON.stringify(NB.ui.panels||NB.ui)")
        step("view saved in the notebook", saved)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
