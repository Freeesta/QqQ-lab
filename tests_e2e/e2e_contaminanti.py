"""WP-H11: known contaminants only in the box that opens on a peak (high resolution): nothing drawn on the spectrum (same pixels with the switch on and off), the line on a peak that
matches (279.1591 = dibutyl phthalate, 391.2843 = DEHP, in the synthetic file), no line on another peak, no line with the switch off or in a low-resolution file, the series of a polymer,
the contaminants of the laboratory (add, see in the box, export/import)."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib_hr import synth, load
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_contaminanti.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
D = synth("hrcont")
r = Run(port=8993, wd="/tmp/wd_cont")
SP = "E.panels.find(p=>p.type==='spec'&&p._a&&p._a.hrp)"
def hov(pg, m):
    return pg.evaluate(f"(()=>{{const p={SP};const a=p._a;const h=a.hov(a.X({m}));return h?h.html:null}})()")
try:
    with sync_playwright() as p:
        pg = r.page(p); pg.set_viewport_size({"width": 1500, "height": 1400})
        load(pg, [D / "HR_DDA-Exploris-t30.mzML"], 4000, 2)
        pg.evaluate("localStorage.removeItem('qqq.contaminanti');localStorage.removeItem('qqq.contaminanti.on')")
        pg.evaluate("LISTE.ensure()"); pg.wait_for_function("LISTE.find&&true", timeout=5000); pg.wait_for_timeout(1500)
        sp = pg.evaluate(f"(()=>{{const p={SP};p.zoom=[270,400];draw(p);return p.id}})()"); pg.wait_for_timeout(1500)
        def known():
            h = hov(pg, 279.1591); assert h and "Compatibile con un contaminante noto" in h and "dibutilftalato" in h and "Keller 2008" in h, h
            h2 = hov(pg, 391.2843); assert h2 and "DEHP" in h2, h2
        step("279.1591 and 391.2843: the line of the contaminant in the box of the peak", known)
        def other():
            ms = pg.evaluate(f"(()=>{{const p={SP};const d=p._a.data[0].d;return d.mz.filter(m=>m>272&&m<398&&Math.abs(m-279.1591)>0.5&&Math.abs(m-391.2843)>0.5).slice(0,12)}})()")
            assert ms, "no other peak in the window"
            n = 0
            for m in ms:
                h = hov(pg, m)
                if h and "contaminante" in h: n += 1
            assert n < len(ms), "not every random peak can be a contaminant"
            assert any(hov(pg, m) and "contaminante" not in hov(pg, m) for m in ms)
        step("a peak that does not match has no line", other)
        def pixels():
            pg.evaluate("LISTE.setOn(true)"); pg.wait_for_timeout(1200)
            a = pg.evaluate(f"{SP}.cv.toDataURL()")
            pg.evaluate("LISTE.setOn(false)"); pg.wait_for_timeout(1200)
            b = pg.evaluate(f"{SP}.cv.toDataURL()")
            assert a == b, "the spectrum is drawn the same with the switch on and off"
            h = hov(pg, 279.1591); assert h and "contaminante" not in h, h
            pg.evaluate("LISTE.setOn(true)"); pg.wait_for_timeout(1000)
            assert "contaminante" in hov(pg, 279.1591)
        step("same pixels on and off; off = the box of before", pixels)
        def gear():
            pg.click("#np-set"); pg.wait_for_selector("#uip-cont", timeout=5000)
            assert pg.is_checked("#uip-cont"); pg.uncheck("#uip-cont"); pg.wait_for_timeout(400)
            assert pg.evaluate("LISTE.isOn()") is False and pg.evaluate("localStorage.getItem('qqq.contaminanti.on')") == "false"
            pg.check("#uip-cont"); pg.wait_for_timeout(300); assert pg.evaluate("LISTE.isOn()") is True
            pg.click("#np-set")
        step("gear switch: on by default, kept in qqq.contaminanti.on", gear)
        def series():
            o = pg.evaluate("""(async()=>{const j=await J('api/contaminants');const idx=LISTE.buildIndex(j.lists);
              const peg=j.lists[0].items.filter(x=>x.id==='peg'&&x.adduct==='[M+NH4]+'&&x.series.n>=7&&x.series.n<=11).map(x=>x.mz);
              const f=LISTE.forSpec(peg.concat([500.5]), peg.map(()=>1e5).concat([1e5]), 'positive', 5); return f.tip(peg[2])})()""")
            assert "serie PEG (n = 7-11)" in o, o
            o2 = pg.evaluate("""(async()=>{const j=await J('api/contaminants');const peg=j.lists[0].items.filter(x=>x.id==='peg'&&x.adduct==='[M+NH4]+'&&(x.series.n===7||x.series.n===9)).map(x=>x.mz);
              return LISTE.forSpec(peg, peg.map(()=>1e5), 'positive', 5).tip(peg[0])})()""")
            assert "PEG" in o2 and "serie" not in o2, o2                         # two members are not a series
        step("PEG: three consecutive members = «serie PEG (n = 7-11)»; two are not", series)
        def lab():
            pg.evaluate("LISTE.askAdd(250.1234, 'positive')"); pg.wait_for_selector("#askok", timeout=5000); pg.fill("#askin", "mio fondo"); pg.click("#askok"); pg.wait_for_timeout(800)
            pg.evaluate(f"(()=>{{const p={SP};p.zoom=[240,260];draw(p)}})()"); pg.wait_for_timeout(1500)
            h = hov(pg, 250.1234); assert h and "mio fondo" in h and "Contaminanti del laboratorio" in h, h
            assert pg.evaluate("JSON.parse(localStorage.getItem('qqq.contaminanti')).length") == 1
            csv = pg.evaluate("LISTE.csvOut(LISTE.labRows())"); assert csv.startswith("mz,name,formula,polarity,note") and "mio fondo" in csv
        step("laboratory contaminants: added from the menu, seen in the box, saved as CSV", lab)
        def win():
            pg.evaluate("LISTE.openLab()"); pg.wait_for_selector("#lab-xl", timeout=5000)
            assert pg.locator("#bigbody [data-c=name]").count() == 1
            pg.evaluate("document.querySelector('#bigdlg').close()")
        step("window of the laboratory contaminants", win)
        pg.evaluate("localStorage.removeItem('qqq.contaminanti')")
    r.close()
    r2 = Run(port=8994, wd="/tmp/wd_cont2")
    with sync_playwright() as p:
        pg = r2.page(p); pg.set_viewport_size({"width": 1400, "height": 1000})
        pg.set_input_files("#pick", [mz("B_FullMass-t15")]); pg.wait_for_function("document.querySelectorAll('#flist input[data-k=use]').length>=1", timeout=30000)
        pg.click("text=Carica dati"); ready(pg)
        def lr():
            pg.wait_for_function("E.panels.some(p=>p.type==='spec'&&p._a)", timeout=30000)
            assert pg.evaluate("E.panels.filter(p=>p.type==='spec'&&p._a).every(p=>p._a.cont==null)"), "unit resolution: no contaminant data at all"
            h = pg.evaluate("(()=>{const p=E.panels.find(p=>p.type==='spec'&&p._a);const a=p._a;const m=a.data[0].d.mz[0];const h=a.hov(a.X(m));return h?h.html:''})()")
            assert "contaminante" not in h, h
        step("low resolution: nothing", lr)
    r2.close()
except Exception as e:
    import traceback; traceback.print_exc(); steps.append(("run", "FAIL " + str(e)[:300]))
    try: r.close()
    except Exception: pass
print(len(steps), "steps"); import traceback
for n, s in steps: print(s.split(" ")[0].upper(), n, s if s != "ok" else "")
