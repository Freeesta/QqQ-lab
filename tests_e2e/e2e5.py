import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:300]))
r = Run(port=8815, wd="/tmp/wd5")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in FILES])
        pg.wait_for_timeout(1000); pg.click("text=Carica dati"); pg.wait_for_timeout(4000)
        def addion(t, ok=True):                       # t: neutral formula (the adduct comes from the selector)
            pg.locator('.pnl.xic [data-o="addb"]').click() if pg.locator('.pnl.xic').count() else pg.click("#np-xic")
            pg.fill("#xic-q", t); pg.press("#xic-q", "Enter"); pg.wait_for_timeout(1000)
            if ok: pg.click("#xic-go"); pg.wait_for_timeout(1200)
        def addwin(lo, hi=None):                      # write the window: "a" fills itself with da + 0.5 unless it is written
            pg.locator('.pnl.xic [data-o="addb"]').click() if pg.locator('.pnl.xic').count() else pg.click("#np-xic")
            pg.fill("#xic-lo", lo)
            if hi: pg.fill("#xic-hi", hi)
            pg.click("#xic-go"); pg.wait_for_timeout(1200)
        addion("C14H13F4N3O2S")
        xi = pg.evaluate("E.panels.findIndex(p=>p.type==='xic')")
        sel = lambda o: f'.pnl.xic [data-o="{o}"]'
        def formula_in_xic():
            t = pg.evaluate(f"E.panels[{xi}].traces.map(t=>[t.mz,t.w,t.label])"); print("traces:", t)
            # the neutral formula gives the calculated m/z of the adduct (364.0737 for [M+H]+) and a window of +-0.5 Da around it
            assert t and abs(t[0][0] - 364.07) < 1e-6 and t[0][1] == 0.5 and "C14H13F4N3O2S" in t[0][2] and "363.57-364.57" in t[0][2], t
            addwin("163.27")                                      # "a" fills itself: 163.77
            tr = pg.evaluate(f"E.panels[{xi}].traces[1]"); assert abs(tr["mz"] - 163.52) < 1e-6 and abs(tr["w"] - 0.25) < 1e-6, tr
            addion("C2H6Qq", ok=False)
            assert "non valida" in pg.inner_text("#xic-err"); pg.click("#xic-no")
            # "a" follows "da" + 0.5 until the student writes it; after that it is left alone; commas are accepted
            pg.locator('.pnl.xic [data-o="addb"]').click(); pg.fill("#xic-lo", "100"); assert pg.input_value("#xic-hi") == "100.5"
            pg.fill("#xic-lo", "100,2"); assert pg.input_value("#xic-hi") == "100.7"
            pg.fill("#xic-hi", "100,9"); pg.fill("#xic-lo", "100.3"); assert pg.input_value("#xic-hi") == "100,9", pg.input_value("#xic-hi")      # written by the student: left as it is
            pg.click("#xic-go"); pg.wait_for_timeout(1200)
            tr = pg.evaluate(f"E.panels[{xi}].traces[2]"); assert abs(tr["mz"] - 100.6) < 1e-6 and abs(tr["w"] - 0.3) < 1e-6, tr
            pg.evaluate(f"E.panels[{xi}].traces.pop()"); pg.evaluate(f"E.panels[{xi}].traces.pop()")
        step("XIC window: formula (neutral) and da/a with automatic a", formula_in_xic)
        def xicdlg_layout():
            pg.locator('.pnl.xic [data-o="addb"]').click()
            ys = pg.evaluate("['#xic-lo','.xor','#xic-q'].map(s=>document.querySelector(s).getBoundingClientRect().top)"); assert ys[0] < ys[1] < ys[2], ys
            t = pg.inner_text("#xicdlg"); assert "oppure" in t and "neutra" in t and "una cifra decimale" not in t and "m/z o formula" not in t, t
            pg.click("#xic-go"); err = pg.inner_text("#xic-err"); assert "«da» deve essere minore di «a»" in err and "cifra" not in err, err      # empty window
            pg.click("#xic-no")
        step("XIC window layout: window first, oppure, neutral formula; no 'una cifra decimale'", xicdlg_layout)
        def blank():
            pg.evaluate(f"(()=>{{const p=E.panels[{xi}]; p.traces=p.traces.slice(0,1); p.fk=''}})()"); pg.wait_for_timeout(100)
            base = pg.evaluate(f"seriesOf(E.panels[{xi}]).then(a=>a.map(s=>[s.name,Math.max(...s.y)]))"); print("before:", base)
            pg.select_option(sel("bk"), index=3)   # third file = t60 as the 'blank'
            pg.wait_for_timeout(1500)
            after = pg.evaluate(f"seriesOf(E.panels[{xi}]).then(a=>a.map(s=>[s.name,Math.max(...s.y),s.corr]))"); print("after:", after)
            assert len(after) == len(base) - 1 and all(a[2] == "- bianco" for a in after)
            assert all(min(a[1] for a in after) >= 0 for _ in [0])
            pg.screenshot(path=SH + "50_blank.png")
            pg.locator(sel("snip")).check(); pg.wait_for_timeout(1200)
            sn = pg.evaluate(f"seriesOf(E.panels[{xi}]).then(a=>a.map(s=>[s.corr,Math.max(...s.y)]))"); print("snip:", sn)
            assert all("baseline" in x[0] for x in sn)
            pg.screenshot(path=SH + "51_snip.png")
        step("blank subtraction + SNIP", blank)
        def snip_unit():
            v = pg.evaluate("(()=>{const y=Array.from({length:200},(_, i)=>100+50*Math.exp(-Math.pow((i-100)/4,2)/2)); const b=snipBaseline(y,20); return [Math.max(...b), Math.min(...b), Math.max(...y)]})()")
            print("snip unit:", v); assert 95 < v[1] and v[0] < 112 and v[2] > 140
        step("SNIP keeps the peak out of the baseline", snip_unit)
        def spec_bg():
            pg.evaluate("setView('data')")
            si = pg.evaluate("E.panels.findIndex(p=>p.type==='spec')")
            pg.evaluate(f"(()=>{{const p=E.panels[{si}]; p.r0=14.0; p.r1=14.6; p.k=0; p.bg=''; draw(p)}})()"); pg.wait_for_timeout(800)
            sm = lambda: pg.evaluate(f"E.panels[{si}]._a.data[0].d.y.reduce((a,b)=>a+b,0)")
            raw = sm()
            pg.evaluate(f"(()=>{{const p=E.panels[{si}]; p.bg='w'; p.bw0=13.0; p.bw1=14.2; ctl(p); draw(p)}})()"); pg.wait_for_timeout(1000)
            sub = sm(); print("sum raw/sub:", raw, sub, pg.evaluate(f"[E.browse,E.cur,E.panels[{si}].k,E.panels[{si}].bg,E.panels[{si}].p_all,E.panels[{si}]._a.data.length, E.panels[{si}]._a.data[0].f.k]"))
            assert "fondo sottratto" in pg.inner_text(f".pnl.spec .leg") and sub < raw
            pg.screenshot(path=SH + "52_specbg.png")
        step("spectrum background subtraction", spec_bg)
        def calc():
            pg.evaluate("document.querySelector('#np-calc').click()"); pg.fill("#calcin", "C14H13F4N3O2S"); pg.wait_for_timeout(800)
            t = pg.inner_text("#calcout"); print(t.replace("\n", " | ")[:300]); assert "364.1" in t and "364" in t and "363.0665" in t
            pg.screenshot(path=SH + "53_calc.png")
            pg.locator("#calcout button[data-m]").first.click(); pg.wait_for_timeout(800)          # the XIC button opens THE XIC window, formula and window already filled in
            assert pg.evaluate("document.querySelector('#xicdlg').open") and pg.input_value("#xic-q") == "C14H13F4N3O2S" and pg.input_value("#xic-lo") == "363.57", (pg.input_value("#xic-q"), pg.input_value("#xic-lo"))
            n0 = pg.evaluate("E.panels.filter(p=>p.type==='xic').reduce((a,p)=>a+p.traces.length,0)"); pg.click("#xic-go"); pg.wait_for_timeout(1200)
            assert pg.evaluate("E.panels.filter(p=>p.type==='xic').reduce((a,p)=>a+p.traces.length,0)") == n0 + 1
        step("calculator", calc)
        def draw_ion():
            pg.evaluate("setView('draw')"); pg.wait_for_function("TPDraw.ready()", timeout=60000); pg.wait_for_timeout(1500)
            pg.fill("#ex-smi", "Oc1ccc(cc1)C(=O)N"); pg.click("#ex-load"); pg.wait_for_timeout(2500)
            # the boxes that did the student's work (caption, formula/adduct table, fragment selection) no longer exist
            assert pg.evaluate("['selcard','selbody','dcard','dcomp','cap-name','cap-part','cap-ad','cap-on','cap-txt','cap-copy'].every(i=>!document.getElementById(i))")
            LB = "[...document.getElementById('kframe').contentWindow.ketcher.editor.render.paper.canvas.querySelectorAll('#qqq-labels text')].map(t=>t.textContent)"
            assert pg.evaluate(LB) == ["C7H7NO2", "M = 137"], pg.evaluate(LB)
            pg.select_option("#lb-ion", "[M+H]+"); pg.wait_for_timeout(500)
            t = pg.evaluate(LB); print("ION:", t); assert t == ["C7H8NO2+", "m/z 138"], t
            pg.screenshot(path=SH + "54_ion.png")
            with pg.expect_download() as d: pg.click("#ex-svg")
            svg = open(d.value.path(), encoding="utf-8").read()
            assert "m/z" in svg and "138" in svg and 'font-style="italic"' in svg and "<tspan" in svg and "TP1" not in svg, svg[-500:]
            with pg.expect_download() as d: pg.click("#ex-png")
            import os; sz = os.path.getsize(d.value.path()); print("png bytes", sz); assert sz > 5000
            open(SH + "55_ion.png", "wb").write(open(d.value.path(), "rb").read())
            pg.select_option("#lb-ion", ""); pg.wait_for_timeout(300)
            with pg.expect_download() as d: pg.click("#ex-svg")
            assert "m/z" not in open(d.value.path(), encoding="utf-8").read()
        step("drawing: no helper boxes, ion choice in the label (canvas, svg, png)", draw_ion)
        pg.wait_for_timeout(500)
finally:
    r.close()
for s in steps: print(s)
r.report()
