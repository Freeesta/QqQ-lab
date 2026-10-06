"""PDA trace, no CSV on chromatograms, fixed panel slots (drag = swap), LC method in the Metodo window, trace not over the y axis."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:200]))
r = Run(port=8819, wd="/tmp/wd9")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in FILES]); pg.wait_for_timeout(1000)
        pg.set_input_files("#pickdam", str(DAM)); pg.wait_for_timeout(800)
        assert DAM.name in pg.inner_text("#mlist"), "the .dam is listed on the start screen"
        pg.click("text=Apri i dati"); pg.wait_for_timeout(4000)
        def pda():
            pg.locator('.pnl.chrom [data-o="kind"]').first.select_option("pda"); pg.wait_for_timeout(2500)
            n = pg.evaluate("E.panels[0]._a.sr.length"); assert n >= 4, n          # one trace per file (MRM files included)
            apex = pg.evaluate("(()=>{const s=E.panels[0]._a.sr[0];let m=0;s.ys.forEach((v,i)=>{if(v>s.ys[m])m=i});return s.x[m]})()")
            print("PDA apex of first file", apex); assert 13 < apex < 19
            assert "PDA" in pg.evaluate("plotName(E.panels[0])")
            pg.screenshot(path=SH + "90_pda.png")
        step("PDA kind: one trace per file incl. MRM", pda)
        def nocsv():
            assert pg.locator(".pnl.chrom [data-a=csv]").count() == 0
            assert pg.locator(".pnl.spec [data-a=csv]").count() >= 1
        step("no CSV button on the chromatogram, still on the spectrum", nocsv)
        def edge():
            # no coloured pixel of the trace in the 1.5 px left of the plot area except the axis itself
            n = pg.evaluate("""()=>{const p=E.panels[0],c=p.cv,g=c.getContext('2d'),d=window.devicePixelRatio||1;
              const x=Math.round((M.l-2)*d),w=3*d; const im=g.getImageData(x,Math.round(M.t*d),w,Math.round((p._a.H-M.t-M.b)*d)).data;let colored=0;
              for(let i=0;i<im.length;i+=4){const a=im[i+3]; if(a>200 && (im[i+2]-im[i]>40)) colored++} return colored}""")
            print("blue pixels near axis", n); assert n == 0, n
        step("trace stays off the y axis", edge)
        def slots():
            pg.evaluate("tile()"); pg.wait_for_timeout(600)
            before = pg.evaluate("E.panels.map(p=>p.type)"); ys = pg.evaluate("E.panels.map(p=>p.y)")
            assert before[0] == "chrom" and len(before) >= 3, before
            # drag the LAST panel's header above the first one
            last = pg.evaluate("E.panels.length - 1")
            hd = pg.evaluate(f"(()=>{{const r=E.panels[{last}].el.querySelector('.hd').getBoundingClientRect();return [r.left+60,r.top+8]}})()")
            top = pg.evaluate("(()=>{const r=E.panels[0].el.getBoundingClientRect();return r.top+4})()")
            pg.mouse.move(hd[0], hd[1]); pg.mouse.down(); pg.mouse.move(hd[0], (hd[1] + top) / 2, steps=6); pg.mouse.move(hd[0], top, steps=6)
            pg.screenshot(path=SH + "91_dragging.png"); pg.mouse.up(); pg.wait_for_timeout(500)
            after = pg.evaluate("E.panels.map(p=>p.type)"); ys2 = pg.evaluate("E.panels.map(p=>p.y)")
            print(before, "->", after, ys2)
            assert after[0] == before[last] and after[1] == before[0], after
            assert ys2[0] == 0 and all(ys2[i] < ys2[i + 1] for i in range(len(ys2) - 1)), ys2
            hs = pg.evaluate("E.panels.map(p=>p.h)"); assert all(abs(ys2[i + 1] - (ys2[i] + hs[i] + 10)) < 1 for i in range(len(ys2) - 1)), "gaps"
        step("fixed slots: dragging a panel up swaps the others down", slots)
        pg.screenshot(path=SH + "92_after_swap.png")
        def metodo():
            pg.click("#np-method"); pg.wait_for_timeout(1200)
            t = pg.inner_text("body")
            assert "Metodo cromatografico (LC) e PDA" in t and "% A" in t and "Flusso iniziale" not in t and "PDA: canali" not in t
            assert pg.locator("svg polyline").count() >= 1
            pg.screenshot(path=SH + "93_metodo.png")
        step("Metodo window shows gradient, flow, PDA", metodo)
finally:
    r.close()
r.report()
for s in steps: print(" ", s)
