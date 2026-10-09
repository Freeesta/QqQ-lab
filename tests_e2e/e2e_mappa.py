"""RT x m/z map (mappa.js) on the example files t0 and t30, English and dark theme: true zoom (wheel, Shift/Alt, box, Backspace, whole view),
full screen with the sight and the two margin plots, arrow keys, lock with the right button and with L, Shift + right click = XIC."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
EX = ROOT / "mzlab" / "web" / "esempi"
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_mappa.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8896, wd="/tmp/wd_mappa")
M = "E.panels.find(q=>q.type==='map')"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); r.b = b
        pg = b.new_context(locale="en-US", color_scheme="dark", viewport={"width": 1440, "height": 950}).new_page()
        pg.on("pageerror", lambda e: r.errs.append(("pageerror", str(e))))
        pg.goto(f"http://127.0.0.1:{r.port}/"); pg.wait_for_timeout(800)
        pg.set_input_files("#pick", [str(EX / "Esempio_FullScan_t0.mzML"), str(EX / "Esempio_FullScan_t30.mzML")]); pg.wait_for_timeout(800)
        pg.click("#opbtn"); ready(pg)
        pg.click("#np-map"); ready(pg); pg.wait_for_timeout(600)
        pg.evaluate(M + ".el.scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
        box = lambda: pg.evaluate(f"(()=>{{const c={M}.cv.getBoundingClientRect();return [c.left,c.top,c.width,c.height]}})()")
        at = lambda fx, fy: (lambda c: (c[0] + c[2] * fx, c[1] + c[3] * fy))(box())
        z = lambda: pg.evaluate(f"[{M}.zoom,{M}.zoomY]")
        def dark():
            assert pg.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")
            assert pg.inner_text(f"{M}.el .mzbt".replace(f"{M}.el ", ".pnl.map ")).strip().startswith("sight"), pg.inner_text(".pnl.map .mzbt")
        step("dark theme, English: the sight button", dark)
        def wheel():
            x, y = at(.5, .45); pg.mouse.move(x, y)
            for _ in range(3): pg.mouse.wheel(0, -200); pg.wait_for_timeout(60)
            zz = z(); assert zz[0] and zz[1], zz
            pg.wait_for_function(f"!!({M}._mz.reg && {M}._mz.reg.nrt > 1)", timeout=15000)     # true zoom: the region on new bins
            reg = pg.evaluate(f"[{M}._mz.reg.nrt,{M}._mz.reg.nmz,{M}._mz.reg.dmz]"); assert reg[2] < 1 and reg[1] <= 1000 and reg[0] <= 1000, reg     # finer than the 1 Da of the whole map
            zy = z()[1]; pg.keyboard.down("Shift"); pg.mouse.wheel(0, -200); pg.keyboard.up("Shift"); pg.wait_for_timeout(200)
            z2 = z(); assert z2[0] == zz[0] and z2[1] != zy, (zz, z2)                           # Shift: m/z only
            pg.keyboard.down("Alt"); pg.mouse.wheel(0, -200); pg.keyboard.up("Alt"); pg.wait_for_timeout(200)
            z3 = z(); assert z3[1] == z2[1] and z3[0] != z2[0], (z2, z3)                        # Alt: RT only
        step("wheel: zoom on both axes, Shift = m/z only, Alt = RT only, true zoom on finer bins", wheel)
        def boxz():
            before = z(); (x0, y0), (x1, y1) = at(.3, .3), at(.6, .6)
            pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x1, y1, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
            after = z(); assert after[0][1] - after[0][0] < before[0][1] - before[0][0] and after[1][1] - after[1][0] < before[1][1] - before[1][0], (before, after)
            pg.evaluate(M + ".cv.focus()"); pg.keyboard.press("Backspace"); pg.wait_for_timeout(200)
            assert z() == before, (z(), before)                                                 # Backspace = previous zoom
            pg.keyboard.press("0"); pg.wait_for_timeout(200); assert z() == [None, None], z()
            pg.mouse.move(*at(.5, .5)); pg.mouse.wheel(0, -300); pg.wait_for_timeout(200); assert z()[0]
            pg.click(".pnl.map [data-mz=all]"); pg.wait_for_timeout(200); assert z() == [None, None], z()
        step("box zoom, Backspace = previous zoom, 0 and the button = whole view", boxz)
        def full():
            pg.evaluate(M + ".cv.focus()"); pg.keyboard.press("f"); pg.wait_for_timeout(900)
            assert pg.evaluate(f"{M}.el.classList.contains('max') && {M}.el.classList.contains('mzmir')")
            x, y = at(.5, .5); pg.mouse.move(x, y); pg.mouse.move(x + 3, y + 2)
            pg.wait_for_function(f"!!({M}._mz.spec && {M}._mz.xic)", timeout=15000); pg.wait_for_timeout(300)
            sz = pg.evaluate(f"[{M}._mz.sp.clientWidth,{M}._mz.sp.clientHeight,{M}._mz.xc.clientWidth,{M}._mz.xc.clientHeight,{M}.cv.clientHeight]")
            assert all(v > 100 for v in sz), sz
            ali = pg.evaluate(f"(()=>{{const s={M}._mz;return [s.sp.getBoundingClientRect().top-{M}.cv.getBoundingClientRect().top, s.xc.getBoundingClientRect().left-{M}.cv.getBoundingClientRect().left]}})()")
            assert abs(ali[0]) < 1 and abs(ali[1]) < 1, ali                                      # same m/z axis (side) and same RT axis (bottom)
            rd = pg.inner_text(f".pnl.map .rd"); assert "scan" in rd and "RT" in rd and "intensity" in rd, rd
            pg.screenshot(path=SH + "mappa_fs.png")
        step("full screen (F): sight on, spectrum at the side and XIC below, aligned; readout", full)
        def keys():
            pt = lambda: pg.evaluate(f"MAPPA.point({M})")
            p0 = pt(); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(400); p1 = pt()
            rts = pg.evaluate(f"{M}._mz.xic.tr[0].rt"); i = rts.index(p1["rt"]) if p1["rt"] in rts else -1
            assert p1["rt"] > p0["rt"] and i >= 0 and (i == 0 or rts[i - 1] <= p0["rt"] + 1e-6), (p0, p1)       # the next scan
            pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(200); p2 = pt(); assert abs(p2["mz"] - p1["mz"] - 1) < 1e-6, (p1, p2)   # one bin (1 Da, whole map)
            pg.keyboard.press("Shift+ArrowRight"); pg.wait_for_timeout(700); p3 = pt()
            y = pg.evaluate(f"{M}._mz.xic.tr[0].y"); rts = pg.evaluate(f"{M}._mz.xic.tr[0].rt"); k = rts.index(p3["rt"])
            assert p3["rt"] > p2["rt"] and y[k] >= y[k - 1] and y[k] >= y[k + 1], (p2, p3)         # an apex of the XIC
            up, dn = pg.evaluate(f"[MAPPA.peakStep({M}._mz.spec,{p3['mz']},1),MAPPA.peakStep({M}._mz.spec,{p3['mz']},-1)]")
            want = up if up is not None else dn; assert want is not None, (up, dn)
            pg.keyboard.press("Shift+ArrowUp" if up is not None else "Shift+ArrowDown")              # next peak of the spectrum (above 3 x the MAD noise)
            pg.wait_for_function(f"Math.abs(MAPPA.point({M}).mz - {want}) < 1e-6", timeout=8000)
        step("arrows: next scan, one bin, Shift = apex of the XIC / next peak of the spectrum", keys)
        def lock():
            x, y = at(.4, .5); pg.mouse.click(x, y, button="right"); pg.wait_for_timeout(300)
            lk = pg.evaluate(f"{M}._mz.lock"); assert lk, lk
            pg.mouse.move(x + 80, y + 40); pg.wait_for_timeout(200); assert pg.evaluate(f"MAPPA.point({M})") == lk          # the mouse is free, the point stays
            assert "locked" in pg.inner_text(".pnl.map .rd")
            pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(200); lk2 = pg.evaluate(f"{M}._mz.lock"); assert lk2["mz"] > lk["mz"], (lk, lk2)   # arrows move the locked point
            pg.keyboard.press("l"); pg.wait_for_timeout(200); assert pg.evaluate(f"{M}._mz.lock") is None
            pg.mouse.click(x, y, button="right"); pg.wait_for_timeout(200); pg.mouse.click(x, y, button="right"); pg.wait_for_timeout(200)
            assert pg.evaluate(f"{M}._mz.lock") is None                                          # right click again = unlock
            pg.keyboard.down("Shift"); pg.mouse.click(x, y, button="right"); pg.keyboard.up("Shift"); pg.wait_for_timeout(500)
            assert pg.evaluate("!!document.querySelector('dialog[open]')"), "Shift + right click = the XIC dialog"
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        step("lock: right click and L, arrows move it, the mouse is free; Shift + right click = XIC", lock)
        def leave():
            pg.evaluate(M + ".cv.focus()"); pg.keyboard.press("f"); pg.wait_for_timeout(500)
            assert not pg.evaluate(f"{M}.el.classList.contains('max')") and not pg.evaluate(f"{M}.el.classList.contains('mzmir')")
        step("F again: back in the page, sight off", leave)
        b.close()
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
