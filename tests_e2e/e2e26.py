"""Data tab: full screen on every panel (also added later), RT selection clamped to the chromatogram range, delayed tooltip, header buttons Isotopi / Perdite neutre, no 'QqQ lab' text in the header. Synthetic data."""
import sys, os, shutil; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import synth
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e26.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8826 + 100, wd="/tmp/wd26")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        shutil.rmtree("/tmp/s26", ignore_errors=True)
        pg.set_input_files("#pick", synth.make_series("/tmp/s26", [0, 15, 60])); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4000)
        def header():
            assert "QqQ lab" not in pg.inner_text("header").replace("\n", " ").split("Dati")[0]
            assert pg.get_attribute("header .logo", "alt") == "QqQ lab"
            for w in (360, 768, 1500):
                pg.set_viewport_size({"width": w, "height": 900}); pg.wait_for_timeout(200)
                for b, t in (("#np-iso", "is"), ("#np-nl", "ls")):
                    assert pg.is_visible(b), (w, b)
                    pg.click(b); pg.wait_for_timeout(300)
                    assert pg.evaluate("document.querySelector('#reftabs button[data-t=%s]').classList.contains('on')" % t) or pg.evaluate("[...document.querySelectorAll('#reftabs .on')].some(e=>e.dataset.t=='%s')" % t), (w, t)
                    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
                    if pg.evaluate("!!document.querySelector('dialog[open]')"): pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
            pg.set_viewport_size({"width": 1400, "height": 900})
        step("header: Isotopi and Perdite neutre open their tab at 360/768/1500 px, no title text", header)
        pg.click("#np-chrom"); pg.wait_for_timeout(800); pg.click("#np-spec"); pg.wait_for_timeout(800)
        def fs():
            n = pg.evaluate("document.querySelectorAll('.pnl').length"); assert n >= 2, n
            pg.click("#np-xic"); pg.wait_for_timeout(600); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
            n = pg.evaluate("document.querySelectorAll('.pnl').length"); assert n >= 3, n
            for i in range(n):
                pg.evaluate("document.querySelectorAll('.pnl .fsb')[%d].click()" % i); pg.wait_for_timeout(400)
                box = pg.evaluate("(()=>{const e=document.querySelectorAll('.pnl')[%d];const r=e.getBoundingClientRect();return [r.width,r.height,e.classList.contains('max')]})()" % i)
                assert box[2] and box[0] > 1000 * 0.9 and box[1] > 600, (i, box)
                pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
                assert pg.evaluate("!document.querySelector('.pnl.max')"), (i, pg.evaluate("[!!document.querySelector('dialog[open]'), !!document.querySelector('#helppop:not([hidden])'), !!document.querySelector('#ctx:not([hidden])')]"))
        step("full screen on every panel (incl. XIC added later), Esc leaves it", fs)
        def tip():
            btn = pg.locator(".pnl .fsb").first; btn.hover(); pg.wait_for_timeout(1000)
            assert pg.evaluate("document.querySelector('#qtip').hidden"), "too early"
            pg.wait_for_timeout(1100)
            assert not pg.evaluate("document.querySelector('#qtip').hidden") and "Schermo intero" in pg.inner_text("#qtip")
            pg.mouse.move(5, 5); pg.wait_for_timeout(200); assert pg.evaluate("document.querySelector('#qtip').hidden")
        step("tooltip after ~1.7 s, not before, gone when the pointer leaves", tip)
        def rt():
            c = pg.locator(".pnl canvas").first; b = c.bounding_box()
            y = b["y"] + b["height"] / 2
            pg.mouse.move(b["x"] + b["width"] * .5, y); pg.mouse.down(); pg.mouse.move(b["x"] - 200, y, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
            v = pg.evaluate("(()=>{const q=E.panels[0];return [q.r0,q.r1,q._a&&q._a.full]})()")
            print("rt", v)
            if v[0] is not None and v[2]: assert v[0] >= v[2][0] - 1e-9 and v[1] <= v[2][1] + 1e-9, v
            pg.mouse.move(b["x"] + b["width"] * .5, y); pg.mouse.down(); pg.mouse.move(b["x"] + b["width"] + 300, y, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
            v = pg.evaluate("(()=>{const q=E.panels[0];return [q.r0,q.r1,q._a&&q._a.full]})()")
            if v[0] is not None and v[2]: assert v[0] >= v[2][0] - 1e-9 and v[1] <= v[2][1] + 1e-9, v
        step("RT selection dragged outside the chromatogram stays inside its range", rt)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
