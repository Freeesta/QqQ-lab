"""H6: the isotope simulation of a high-resolution spectrum takes the resolving power into account: the fine structure of M+2 is ONE peak at R 27 000 (m/z 319) and separates at high R;
the M+1/M ratio of the formula; the menu entry sets R."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib_hr import synth, load
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_hr_isotopi.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
D = synth("hriso")
r = Run(port=8972, wd="/tmp/wd_hriso")
try:
    with sync_playwright() as p:
        pg = r.page(p); pg.set_viewport_size({"width": 1500, "height": 1400})
        load(pg, [D / "HR_DDA-Exploris-t30.mzML"], 4000, 2)
        PAT = "(()=>{const i=QQQRef.ionCounts('C13H24N4O3S','[M+H]+');return HR.isoFine(i.n,i.z)})()"
        def counts():
            n = lambda R, lo, hi: pg.evaluate(f"HR.mergeRes({PAT},{R}).filter(r=>r.mz>{lo}&&r.mz<{hi}).length")
            fine = pg.evaluate(f"{PAT}.filter(r=>r.mz>318.6&&r.mz<319.4).length")
            assert fine >= 3, fine                                    # M+2 has 34S, 13C2, 18O (and more): several exact masses
            a = n(35000, 318.6, 319.4); assert a == 1, a             # R200 35000 -> about 27 700 at m/z 319: one peak
            b = n(300000, 318.6, 319.4); assert b >= 3, b            # at R 240 000 and more they separate
            assert pg.evaluate("HR.mergeRes(" + PAT + ", 0).length") == pg.evaluate(PAT + ".length")      # R = 0: whole fine structure
        step("M+2 of C13H25N4O3S: one peak at R 27 000 (m/z 319), separated at high resolution", counts)
        def ratio():
            v = pg.evaluate(f"(()=>{{const m=HR.mergeRes({PAT},35000);return m[1].rel/m[0].rel}})()")
            assert abs(v - 0.167) < 0.01, v
        step("M+1/M of the simulated ion is 0.167", ratio)
        def menu():
            sp = pg.evaluate("(()=>{const s=E.panels.find(q=>q.type==='spec'&&q._a&&q._a.hrp);return s?s.id:null})()"); assert sp is not None
            pg.evaluate(f"(()=>{{const s=E.panels.find(q=>q.id=={sp});s.iso={{formula:'C13H24N4O3S',ad:'[M+H]+'}};s.zoom=[314,325];s._isoKey=JSON.stringify(s.zoom);draw(s)}})()"); pg.wait_for_timeout(500)
            pg.evaluate(f"E.panels.find(q=>q.id=={sp}).el.scrollIntoView({{block:'center'}})"); pg.wait_for_timeout(300)
            leg = pg.evaluate(f"E.panels.find(q=>q.id=={sp}).el.innerText"); assert "profilo teorico" in leg and "R " in leg, leg[-300:]
        step("the legend of the simulation says the resolving power used", menu)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300]))
    try: r.close()
    except Exception: pass
for n, s in steps: print(s.split(" ")[0].upper(), n, s if s != "ok" else "")
