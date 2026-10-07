"""B1: mass profile of each file (decimals, tolerance), the switch «Alta risoluzione» and the fallback to low resolution."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib_hr import synth, real_cuttings, load
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_hr_base.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
D = synth("hrbase")
r = Run(port=8890, wd="/tmp/wdhr1")
FILES = lambda: "E.files.map(f=>[f.file,f.kind,f.prof1.hr,f.prof1.an,f.prof1.dec,f.prof2.hr,f.prof2.an,f.prof2.dec,f.instrument,f.dda,f.nce,f.hr_err||null])"
try:
    with sync_playwright() as p:
        pg = r.page(p)
        load(pg, [D / "HR_DDA-Exploris-t30.mzML", D / "HR_DDA-Fusion-t30.mzML", D / "HR_rotto-t30.mzML", D / "B_FullMass-t0.mzML"], 4000, 7)
        def profiles():
            fl = {f[0]: f for f in pg.evaluate(FILES())}; print(sorted(fl))
            ex, fu, br, qq = fl["HR_DDA-Exploris-t30.mzML#MS1"], fl["HR_DDA-Fusion-t30.mzML#MS2"], fl["HR_rotto-t30.mzML#MS1"], fl["B_FullMass-t0.mzML"]
            assert ex[2] and ex[3] == "FTMS" and ex[4] == 4 and ex[5] and ex[7] == 4 and "Exploris" in ex[8] and ex[9] and ex[10], ex
            assert fu[2] and fu[3] == "FTMS" and (not fu[5]) and fu[6] == "ITMS" and fu[7] == 2 and "Fusion" in fu[8], fu
            assert br[2] and br[4] == 4 and br[11] is None, br                 # the broken file opens, with a profile, without error
            assert (not qq[2]) and qq[4] == 1 and (not qq[5]) and qq[7] == 1 and not qq[9] and not qq[10], qq     # the QqQ file: today's profile
        step("profiles: Exploris 4 decimals, Fusion MS2 in the ion trap 2, QqQ as before, broken file opens", profiles)
        def hrjs():
            v = pg.evaluate("(()=>{const ex=E.files.find(f=>f.file.includes('Exploris')&&f.lv===1),qq=E.files.find(f=>f.file.startsWith('B_Full')),fu=E.files.find(f=>f.file.includes('Fusion')&&f.lv===2);return [HR.prof(ex,1),HR.prof(qq,1),HR.prof(fu,2),HR.tolDa(ex,300,1),HR.tolDa(qq,300,1),HR.dec([ex,qq],1),HR.label(ex)]})()"); print(v)
            assert v[0]["hr"] and v[0]["dec"] == 4 and v[0]["tol"] == 5 and v[0]["unit"] == "ppm"
            assert not v[1]["hr"] and v[1]["dec"] == 1 and v[3] is not None and abs(v[3] - 300 * 5e-6) < 1e-9 and v[4] is None
            assert v[2]["dec"] == 2 and not v[2]["hr"] and v[5] == 4 and "Exploris" in v[6] and "R 45" in v[6] and "DDA" in v[6], v
        step("HR.prof / tolDa / dec / label", hrjs)
        def gear():
            pg.click("#np-set"); pg.wait_for_timeout(300)
            assert pg.is_visible("#uip-hr") and "automatica" in pg.inner_text("#uipset") and "ppm" in pg.inner_text("#uipset")
            pg.fill("#uip-ppm", "8"); pg.dispatch_event("#uip-ppm", "change"); pg.fill("#uip-hdec", "5"); pg.dispatch_event("#uip-hdec", "change"); pg.wait_for_timeout(300)
            v = pg.evaluate("(()=>{const ex=E.files.find(f=>f.file.includes('Exploris')&&f.lv===1);return [HR.prof(ex,1),JSON.parse(localStorage.getItem('qqq.prefs'))]})()"); print(v)
            assert v[0]["tol"] == 8 and v[0]["dec"] == 5 and v[1]["hrPpm"] == 8 and v[1]["hrDec"] == 5
            pg.select_option("#uip-hr", "0"); pg.wait_for_timeout(300)
            v = pg.evaluate("(()=>{const ex=E.files.find(f=>f.file.includes('Exploris')&&f.lv===1),qq=E.files.find(f=>f.file.startsWith('B_Full'));return [HR.prof(ex,1),HR.prof(qq,1),HR.q(),HR.label(ex)!=='']})()"); print(v)
            assert v[0]["hr"] is False and v[0]["dec"] == 1 and v[0]["unit"] == "Da" and v[2] == "&hr=0", v          # switched off: the Exploris behaves as a QqQ file
            pg.select_option("#uip-hr", "1"); pg.fill("#uip-ppm", "5"); pg.dispatch_event("#uip-ppm", "change"); pg.fill("#uip-hdec", "4"); pg.dispatch_event("#uip-hdec", "change"); pg.wait_for_timeout(200)
        step("gear: «Masse» row (switch, ppm, decimals) changes the profile and is saved", gear)
        def notice():
            pg.evaluate("HR.notice([{file:'prova.mzML',label:'prova',hr_err:'ValueError: prova'}])"); pg.wait_for_timeout(200)
            t = pg.inner_text("#hrnote"); print(t)
            assert "Alta risoluzione non disponibile per prova: aperto come bassa risoluzione" in t
        step("fallback notice (once per file)", notice)
        def reload():
            pg.evaluate("uiSave(true)"); pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(6000)
            v = pg.evaluate("[E.files.length,HR.prof(E.files.find(f=>f.file.includes('Exploris')),1).dec]"); assert v[0] >= 6 and v[1] == 4, v
        step("after a reload the profiles are back", reload)
    r.close()
    cuts = real_cuttings()
    if cuts:                                                  # the real Orbitrap cuttings (private data repository), in a clean session
        r = Run(port=8891, wd="/tmp/wdhr2")
        with sync_playwright() as p:
            pg = r.page(p)
            def real():
                load(pg, cuts, 4000, 2 * len(cuts), settle=6000)
                fl = pg.evaluate(FILES()); print([(x[0], x[2], x[4], x[6], x[7]) for x in fl])
                assert len(fl) == 2 * len(cuts) and all(x[2] and x[4] == 4 and x[11] is None for x in fl if x[1] == "full"), fl        # generic properties only: opens, high resolution, 4 decimals
                assert any(x[6] == "FTMS" for x in fl)
            step("the real Orbitrap cuttings (if present): open, high resolution, 4 decimals", real)
        r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300]))
    try: r.close()
    except Exception: pass
for n, s in steps: print(s.split(" ")[0].upper(), n, s if s != "ok" else "")
r.report()
