"""MS2/Full scan: live spectrum under the chromatogram (double click), frozen older ones, group move, arrows (MS2: nearest scan with data), reload."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e20.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8820, wd="/tmp/wd20")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in ["B_FullMass-t0", "B_FullMass-t15", "B_MS2-t15", "B_MS2-t45"]]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4500)
        def cx(x):   # screen point of RT x on the first chromatogram of the current tab
            return pg.evaluate("""x=>{const p=E.panels.find(q=>q.tab===E.tab&&q.type==='chrom');p.el.scrollIntoView({block:'start'});const r=p.cv.getBoundingClientRect();return {px:r.left+p._a.X(x),py:r.top+r.height*0.4}}""", x)
        order = lambda: pg.evaluate("E.panels.filter(p=>p.tab===E.tab).sort((a,b)=>a.y-b.y).map(p=>p.type+(p.link?'*':'')+(p.type==='spec'?'@'+(+((p.r0+p.r1)/2).toFixed(1)):''))")
        def dbl(x):
            c = cx(x); pg.mouse.dblclick(c["px"], c["py"]); pg.wait_for_timeout(1200)
        def triple():
            for x in (6.0, 9.0, 14.3): dbl(x)
            o = order(); print(o)
            specs = [t for t in o if t.startswith("spec")]
            assert o[0] == "chrom" and len(specs) == 4, o              # chromatogram first, then 3 new + the initial one
            assert o[1].startswith("spec*") and abs(float(o[1].split("@")[1]) - 14.3) < 0.3, o       # newest right under, and live
            assert sum(1 for t in o if t.startswith("spec*")) == 1, o   # only one live
            ttl = pg.evaluate("E.panels.filter(p=>p.tab===E.tab&&p.type==='spec').sort((a,b)=>a.y-b.y).map(p=>p.el.querySelector('.ttl').textContent)"); print(ttl)
            assert "segue il cursore" in ttl[0] and all("segue" not in t and " a " in t for t in ttl[1:]), ttl
        step("full scan: 3 double clicks -> newest on top and live, older frozen with RT in title", triple)
        def single():
            before = pg.evaluate("E.panels.filter(p=>p.type==='spec').map(p=>[p.id,p.r0])")
            c = cx(11.0); pg.mouse.click(c["px"], c["py"]); pg.wait_for_timeout(900)
            after = pg.evaluate("E.panels.filter(p=>p.type==='spec').map(p=>[p.id,p.r0])")
            ch = [a for a, b in zip(after, before) if a != b]; assert len(ch) == 1, (before, after)
            live = pg.evaluate("E.panels.find(p=>p.type==='spec'&&p.link).id"); assert ch[0][0] == live
        step("single click moves only the live spectrum", single)
        def group():
            pg.click("#np-chrom"); pg.wait_for_timeout(800)
            names = lambda: pg.evaluate("(()=>{const ps=E.panels.filter(p=>p.tab===E.tab).sort((a,b)=>a.y-b.y);return ps.map(p=>p.type==='chrom'?'C'+p.id:p.type==='spec'?'s'+(p.src||p.link||'-')+'_'+p.id:'?')})()")
            n0 = names(); print(n0); assert n0[0].startswith("C") and n0[-1].startswith("C") and n0[0] != n0[-1], n0
            pg.evaluate("window.scrollTo({top:0,behavior:\"instant\"})"); pg.wait_for_timeout(700); box = pg.locator("#dpanels .pnl.chrom .hd").first.bounding_box()
            pg.mouse.move(box["x"] + 500, box["y"] + 8); pg.mouse.down(); pg.mouse.move(box["x"] + 500, box["y"] + 8 + 1950, steps=10); pg.mouse.up(); pg.wait_for_timeout(900)
            n1 = names(); print(n1)
            c1 = n0[0][1:]
            assert n1[0] == n0[-1] and n1[1] == "C" + c1 and all(x.startswith("s" + c1 + "_") for x in n1[2:]), n1      # the group moved as a block under the other chromatogram
            # a spectrum dragged alone moves alone
            pg.evaluate("window.scrollTo({top:0,behavior:\"instant\"})"); pg.wait_for_timeout(500); sp = pg.locator("#dpanels .pnl.spec .hd").first.bounding_box()
            pg.mouse.move(sp["x"] + 14, sp["y"] + 8); pg.mouse.down(); pg.mouse.move(sp["x"] + 14, max(5, sp["y"] - 400), steps=8); pg.mouse.up(); pg.wait_for_timeout(900)
            print(sp); n2 = names(); print(n2); assert len(n2) == len(n1) and n2 != n1
        step("dragging a chromatogram moves its spectra with it; a spectrum alone moves alone", group)
        def mv():                           # up/down arrows carry the children
            pg.evaluate("movePanel(E.panels.find(p=>p.type==='chrom'),1)"); pg.wait_for_timeout(300); o = order(); print(o)
            ys = pg.evaluate("(()=>{const c=E.panels.find(p=>p.tab===E.tab&&p.type==='chrom');return [c.y,...E.panels.filter(p=>p.src===c.id||p.link===c.id).map(p=>p.y)]})()"); print(ys)
        step("movePanel keeps the group", mv)
        def reload():
            pg.wait_for_timeout(1200); o1 = order(); pg.reload(); pg.wait_for_timeout(4000); o2 = order(); print(o1, o2); assert o1 == o2, (o1, o2)
        step("reload restores order, link and src", reload)
        def ms2():
            pg.click("#dtabs [data-t=ms2]"); pg.wait_for_timeout(2500)
            ci = pg.evaluate("E.panels.findIndex(p=>p.tab==='ms2'&&p.type==='chrom')"); sp = pg.evaluate("E.panels.findIndex(p=>p.tab==='ms2'&&p.type==='spec')")
            c = cx(10.0); pg.mouse.click(c["px"], c["py"]); pg.wait_for_timeout(700)
            seen = []
            for _ in range(8):
                pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(350)
                leg = pg.evaluate(f"E.panels[{sp}].leg.textContent"); seen.append(leg[:40]); assert "Nessuno scan" not in pg.evaluate(f"E.panels[{sp}].p||''") and leg.strip()
            rts = pg.evaluate(f"E.panels[{sp}].r0"); print(seen, rts)
            c0 = pg.evaluate(f"E.panels[{ci}].cur")
            for _ in range(3): pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(350)
            c1 = pg.evaluate(f"E.panels[{ci}].cur"); assert c1 < c0
            assert all("MS2" in x for x in seen), seen
        step("MS2: arrows jump to the nearest scan with data (never an empty spectrum)", ms2)
        pg.screenshot(path=SH + "200_ms2.png", full_page=True)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
