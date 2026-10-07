"""Block 3 (prompt 3): "Dimensione testo" also inside the graphs; exported PNGs stay at the standard size."""
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
        pg.click("text=Carica dati"); pg.wait_for_timeout(4500)
        pg.evaluate(f"{SPEC}.el.scrollIntoView({{block:'center'}})")
        fonts = lambda: pg.evaluate("""(()=>{const g=CanvasRenderingContext2D.prototype,f=Object.getOwnPropertyDescriptor(g,'font'),s=new Set();Object.defineProperty(g,'font',{configurable:true,get(){return f.get.call(this)},set(v){s.add(v);f.set.call(this,v)}});window._fs=s;window._fsr=()=>{Object.defineProperty(g,'font',f)};return 1})()""")
        def sizes():
            pg.evaluate("window._fs.clear()"); pg.evaluate(f"draw({SPEC})"); pg.wait_for_timeout(1500)
            return pg.evaluate("[...window._fs].map(x=>parseFloat(x.match(/([0-9.]+)px/)[1]))")
        fonts(); base = sizes(); print("100%", sorted(set(base)))
        def bigger():
            pg.evaluate("UIP.font=130;uipApply&&uipApply()"); pg.wait_for_timeout(1500)
            big = sizes(); print("130%", sorted(set(big)))
            assert max(big) >= max(base) * 1.25 and min(big) > min(base) * 1.2, (base, big)
            a = pg.evaluate(f"(()=>{{const a={SPEC}._a;return {{l:M.l,b:M.b,W:a.W}}}})()"); assert a["l"] > 80, a
            pg.evaluate(f"{SPEC}.el.scrollIntoView({{block:'center'}})"); pg.wait_for_timeout(300)
            box = pg.evaluate(f"(()=>{{const q={SPEC}.cv.getBoundingClientRect();return {{x:q.left,y:q.top,width:q.width,height:q.height}}}})()")
            pg.screenshot(path=SH + "testo130.png", clip=box)
        step("at 130% the font in the canvas is bigger and the margins follow", bigger)
        def png():
            pg.evaluate("window._fs.clear()")
            pg.evaluate(f"(async()=>{{const p={SPEC};EXPORTING=true;p._exp=true;await draw(p);EXPORTING=false;p._exp=false}})()"); pg.wait_for_timeout(800)
            fs = pg.evaluate("[...window._fs].map(x=>parseFloat(x.match(/([0-9.]+)px/)[1]))"); print("export", sorted(set(fs)))
            assert max(fs) <= max(base) + 0.01, (fs, base)
            pg.evaluate(f"draw({SPEC})")
        step("exported images keep the standard size", png)
        def label():
            t = pg.inner_text("#uipset") if pg.locator("#uipset").count() else ""
            pg.click("#np-set"); pg.wait_for_timeout(300)
            assert "restano alla dimensione standard" in pg.inner_text("#uipset"), pg.inner_text("#uipset")[:200]
        step("the setting says it also works inside the graphs", label)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for nme, st in steps: print(("OK   " if st == "ok" else "FAIL ") + nme + ("" if st == "ok" else "  " + st))
r.report()
sys.exit(0 if all(s == "ok" for _, s in steps) else 1)
