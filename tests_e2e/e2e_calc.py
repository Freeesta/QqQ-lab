"""Block C: the m/z calculator is a drop-down under its button (no dark backdrop, graphs stay usable); lower-case formulas; no '1 decimale' column or offset sentence."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_calc.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8879, wd="/tmp/wd79")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz("B_FullMass-t0"), mz("B_FullMass-t15")]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4500)
        def open_below():
            pg.click("#np-calc2"); pg.wait_for_timeout(300)
            b = pg.evaluate("(()=>{const a=document.querySelector('#np-calc2').getBoundingClientRect(),c=document.querySelector('#calcdlg');const r=c.getBoundingClientRect();return {ab:a.bottom,ct:r.top,w:r.width,vis:!c.hidden,modal:c.matches(':modal')}})()")
            assert b["vis"] and not b["modal"] and 0 < b["ct"] - b["ab"] < 20 and b["w"] >= 520, b
        step("opens right under its button, not modal, at least 520 px wide", open_below)
        def usable():
            c = pg.evaluate("(()=>{const p=E.panels.find(q=>q.type==='chrom'&&q.tab==='full'),r=p.cv.getBoundingClientRect();return {x:r.left+p._a.X(14.3),y:r.bottom-60}})()")
            pg.evaluate("window.scrollTo(0,0)")
            pg.mouse.click(c["x"], c["y"] if c["y"] < 700 else 400); pg.wait_for_timeout(500)
            assert pg.evaluate("document.querySelector('#calcdlg').hidden") is False, "stays open while the student works on the graphs"
            assert pg.evaluate("E.panels.find(q=>q.type==='chrom'&&q.tab==='full').cur") is not None
        step("the graphs stay usable with the calculator open", usable)
        def lower():
            pg.fill("#calcin", "c14h13f4n3o2s"); pg.wait_for_timeout(900)
            assert "interpretata come" in pg.inner_text("#calcsum") and "C14H13F4N3O2S" in pg.inner_text("#calcsum").replace(" ", "")
            t = pg.inner_text("#calcout"); assert "364.07" in t and "1 decimale" not in t and "spostato di qualche decimo" not in t, t
            pg.fill("#calcin", "C9h10Cl2n2O"); pg.wait_for_timeout(900); assert "C9H10Cl2N2O" in pg.inner_text("#calcsum").replace(" ", "")
            pg.fill("#calcin", "co"); pg.wait_for_timeout(900); assert "CO" in pg.inner_text("#calcsum"), pg.inner_text("#calcsum")
        step("lower-case formula: interpreted line, no extra column / sentence", lower)
        def isotopes():
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200); assert pg.evaluate("document.querySelector('#calcdlg').hidden")
            pg.click("#np-iso"); pg.wait_for_timeout(500); pg.fill("#is-f", "c14h13f4n3o2s"); pg.wait_for_timeout(900)
            t = pg.inner_text("#refbody"); assert "1 decimale" not in t and "C14H13F4N3O2S" in t.replace(" ", ""), t[:300]
            pg.keyboard.press("Escape")
        step("Isotopi tab: same function (lower case), no '1 decimale' column; Esc closes the calculator", isotopes)
        def xic_dlg():
            pg.evaluate("openXic(null,{})"); pg.wait_for_timeout(300); pg.fill("#xic-q", "c14h13f4n3o2s"); pg.wait_for_timeout(1200)
            assert "interpretata come" in pg.inner_text("#xic-sum"), pg.inner_text("#xic-sum"); pg.click("#xic-no")
        step("XIC window too", xic_dlg)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
