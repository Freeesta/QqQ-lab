"""Block 1 (MS2 tab): one loading screen only, arrows jump to the nearest scan with data, precursor chromatogram + spectrum coupled
with an arrow, controls that make no sense are grey (not removed), time next to the file name, precursor list in the sidebar."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:240]))
r = Run(port=8819, wd="/tmp/wd19")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        def load():
            assert pg.locator("#qq-load").count() == 0, "second loading screen still there"
            assert pg.locator("#ldmsg").count() == 1
        step("only the loading screen with the funny phrases exists", load)
        pg.set_input_files("#pick", [mz(f) for f in FILES]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(5000)
        pg.click("#dtabs [data-t=ms2]"); pg.wait_for_timeout(2500)
        def pair():
            n = pg.locator("#dpanels .parr").count(); assert n >= 1, n
            c = pg.evaluate("E.panels.find(p=>p.tab==='ms2'&&p.type==='chrom')"); 
            order = pg.evaluate("E.panels.filter(p=>p.tab==='ms2').sort((a,b)=>a.y-b.y).map(p=>p.type)"); assert order[:2] == ["chrom", "spec"], order
        step("MS2: precursor chromatogram above, spectrum below, arrow between", pair)
        def dis():
            h = pg.evaluate("""()=>{const p=E.panels.find(q=>q.tab==='ms2'&&q.type==='chrom');const c=p.el.querySelector('.ctl');
              const d=[...c.querySelectorAll(':disabled')].map(x=>x.dataset.o||x.tagName);
              return {d, kinds:[...c.querySelectorAll('option')].map(o=>o.textContent).join('|'), tips:[...c.querySelectorAll('[title]')].filter(x=>x.disabled||x.closest('label.dis')).length}}""")
            assert "mz0" in h["d"] and "bk" in h["d"] and "log" in h["d"] and "snip" in h["d"], h
            assert "TIC" not in h["kinds"] and "BPC" not in h["kinds"], h
            assert h["tips"] >= 3, h
            pg.screenshot(path=SH + "19_ms2.png")
        step("precursor chromatogram: kind/m-z/blank/baseline/log grey with tooltips, no TIC/BPC", dis)
        def side():
            t = pg.inner_text("#flst"); assert "PRECURSORI" in t.upper() and "CE" in t, t
            r = pg.evaluate("""()=>{const f=document.querySelector('#flst .fl:not(.pr) .fi');const b=f.querySelector('.nm').getBoundingClientRect(),s=f.querySelector('small').getBoundingClientRect();return [b.top,s.top,b.right,s.left]}""")
            assert abs(r[0] - r[1]) < 12 and r[3] >= r[2] - 1, r
        step("sidebar: precursors first, time to the right of the file name", side)
        def steps_():
            pg.evaluate("setActive(null)")
            res = pg.evaluate("""async ()=>{
              const c=E.panels.find(q=>q.tab==='ms2'&&q.type==='chrom'), sp=E.panels.find(q=>q.link===c.id);
              await draw(c); const s=c._a.sr[0]; let m=0; s.ys.forEach((v,i)=>{if(v>s.ys[m])m=i});
              c.cur=s.x[m]; setActive(c); const out=[], seen=new Set();
              for(let n=0;n<40;n++){ const before=c.cur; stepScan(c,1); await new Promise(r=>setTimeout(r,250));
                const msg=sp.cv.parentElement.innerText; out.push([before,c.cur,s.y[nearIdx(s.x,c.cur)]]); if(c.cur===before) break; }
              return {out, sp: sp._a? 'ok':'none'};}""")
            ys = [o[2] for o in res["out"]]; assert all(y > 0 for y in ys), res
            assert res["sp"] == "ok", res
        step("arrows on MS2 land only on scans with data and the spectrum is never empty", steps_)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
