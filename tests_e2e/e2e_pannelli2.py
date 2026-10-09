"""Panels of the Data view (9/10): Correzione outside the popover and with any file, RT interval, ruler anchored to labels and cancelled by zoom, isotope simulation off with the zoom, no Mirino/Ridge."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_pannelli2.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
CH = "E.panels.find(p=>p.type==='chrom'&&p.tab==='full')"
SPEC = "E.panels.find(p=>p.type==='spec'&&p.tab==='full')"
r = Run(port=8957, wd="/tmp/wd_pan2")
try:
    with sync_playwright() as p:
        pg = r.page(p); pg.set_viewport_size({"width": 1280, "height": 1000})
        stage(pg, [mz("B_FullMass-t0"), mz("B_FullMass-t15"), mz("B_FullMass-t60")])
        pg.click("text=Carica dati"); ready(pg)
        def corr_out():
            assert pg.is_visible(".pnl.chrom .corrb"), "Correzione is in the header, not hidden in the popover"
            assert pg.evaluate(f"!{CH}.el.querySelector('.cpop').contains({CH}.el.querySelector('.corrb'))")
            pg.click(".pnl.chrom .corrb"); pg.wait_for_timeout(200)
            t = pg.inner_text(".pnl.chrom .corrm"); print(t)
            assert t.count("Sottrai il file:") == 3, t                   # any file, not only the one marked as blank
            pg.keyboard.press("Escape")
        step("Correzione: in the header, any of the 3 files can be subtracted", corr_out)
        def subtract():
            pg.click(".pnl.chrom .corrb"); pg.wait_for_timeout(200)
            pg.locator(".pnl.chrom .corri", has_text="Sottrai il file").first.click(); pg.wait_for_timeout(1500)
            assert pg.evaluate(f"{CH}.bk") not in ("", None), "a file was chosen"
            pg.click(".pnl.chrom .corrb"); pg.wait_for_timeout(200); pg.locator(".pnl.chrom .corri", has_text="Nessuna").first.click(); pg.wait_for_timeout(800)
        step("a non-blank file is subtracted from the chromatogram", subtract)
        def rt():
            pg.click(".pnl.chrom [data-a=cpar]"); pg.wait_for_timeout(200)
            pg.fill(".pnl.chrom [data-o=rt0]", "13"); pg.press(".pnl.chrom [data-o=rt0]", "Tab"); pg.fill(".pnl.chrom [data-o=rt1]", "16"); pg.press(".pnl.chrom [data-o=rt1]", "Tab"); pg.wait_for_timeout(800)
            z = pg.evaluate(f"{CH}.zoom"); assert z and abs(z[0] - 13) < 1e-6 and abs(z[1] - 16) < 1e-6, z
            pg.fill(".pnl.chrom [data-o=rt0]", ""); pg.fill(".pnl.chrom [data-o=rt1]", ""); pg.press(".pnl.chrom [data-o=rt1]", "Tab"); pg.wait_for_timeout(500)
            assert pg.evaluate(f"{CH}.zoom") is None
            pg.keyboard.press("Escape"); pg.mouse.click(5, 5)
        step("RT from ... to ... sets the visible interval; empty = whole run", rt)
        def popover_out():
            pg.evaluate(f"(()=>{{const p={CH};p._parOpen=true;ctl(p)}})()"); pg.wait_for_timeout(300)
            pg.evaluate("document.querySelector('.pnl.chrom .cpop').style.minHeight='700px'"); pg.wait_for_timeout(200)
            r = pg.evaluate("(()=>{const pn=document.querySelector('.pnl.chrom'),c=document.querySelector('.pnl.chrom .cpop');return [getComputedStyle(pn).overflow,c.getBoundingClientRect().bottom,pn.getBoundingClientRect().bottom]})()"); print(r)
            assert r[0] == "visible" and r[1] > r[2], r
            pg.evaluate("document.querySelector('.pnl.chrom .cpop').style.minHeight=''"); pg.evaluate(f"(()=>{{const p={CH};p._parOpen=false;ctl(p)}})()")
        step("a tall popover goes beyond the panel (not cut)", popover_out)
        def ruler():
            pg.evaluate(f"(()=>{{const p={SPEC};p.rul=true;measClick(p,152.2);measClick(p,364.4)}})()"); pg.wait_for_timeout(300)
            assert pg.evaluate(f"{SPEC}.meas.list.length") == 1
            pg.evaluate(f"(()=>{{const p={SPEC};p.zoom=[100,300];draw(p)}})()"); pg.wait_for_timeout(500)
            assert pg.evaluate(f"{SPEC}.meas") is None, "the zoom cancels the measure"
            pg.evaluate(f"(()=>{{const p={SPEC};p.zoom=null;p.rul=false;draw(p)}})()")
        step("ruler: a new zoom cancels the measure", ruler)
        def iso():
            pg.evaluate(f"(()=>{{const p={SPEC};p.iso={{formula:'C8H10NO2',ad:'[M]+'}};p.zoom=[145,165];p._isoKey=JSON.stringify(p.zoom);draw(p)}})()"); pg.wait_for_timeout(500)
            assert pg.evaluate(f"!!{SPEC}.iso")
            pg.evaluate(f"(()=>{{const p={SPEC};p.zoom=[140,170];draw(p)}})()"); pg.wait_for_timeout(500)
            assert pg.evaluate(f"{SPEC}.iso") is None, "zoom changed: the simulation is off"
            assert pg.evaluate("QADD.some(a=>a.n==='[M]-')")
        step("isotope simulation switches off when the zoom changes; [M]- exists", iso)
        def map_views():
            pg.click("#np-map"); pg.wait_for_timeout(1500)
            v = pg.evaluate("[...document.querySelectorAll('[data-o=view]')].map(b=>b.dataset.v)"); assert v == ["2d", "3d"], v
        step("map: only 2D and 3D (no Mirino, no Ridge)", map_views)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300]))
    try: r.close()
    except Exception: pass
for n, s in steps: print(s.split(" ")[0].upper(), n, s if s != "ok" else "")
