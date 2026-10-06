"""Start screen (button, types, standards with concentration, method routing) and the MRM calibration flow."""
import sys, os, shutil; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:220]))
tmp = Path("/tmp/e15"); shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
for n, src in [("Std_1ppm", "B_MRM-t0"), ("Std_5", "B_MRM-t0"), ("std_10mgL", "B_MRM-t0"), ("blank_MRM", "B_MRM-t0"), ("B_MRM-t15", "B_MRM-t0"), ("B_FullMass-t0", "B_FullMass-t0")]:
    shutil.copy(mz(src), tmp / f"{n}.mzML")
MDAM = DAM.parent / "Lab_inq_MRM_Flufe.dam"
r = Run(port=8815, wd="/tmp/wd15")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        def empty():
            b = pg.locator("#opbtn"); assert b.inner_text().strip() == "Carica dati" and b.is_disabled()
            assert "Carica almeno" not in pg.inner_text("#start")
        step("button 'Carica dati' disabled with no file, no message", empty)
        pg.set_input_files("#pick", [str(MDAM)] + [str(tmp / f) for f in sorted(os.listdir(tmp))]); pg.wait_for_timeout(1800)
        pg.screenshot(path=SH + "151_start.png")
        def layout():
            t = pg.inner_text("#flist")
            assert "Tipo" in t and "Ruolo" not in t and "controllo" not in t and "EMS" not in t and "Q1" not in t, t
            assert "Full Scan" in t and "MRM" in t
            ty = pg.evaluate("ST.files.map(f=>[f.name,f.type,f.conc,f.time])"); d = {n: (a, b, c) for n, a, b, c in ty}
            assert d["Std_1ppm.mzML"][:2] == ("standard", 0.001) or d["Std_1ppm.mzML"][:2] == ("standard", 1), d   # ppm -> mg/L (default unit)
            assert d["Std_5.mzML"][:2] == ("standard", 5) and d["std_10mgL.mzML"][:2] == ("standard", 10), d
            assert d["blank_MRM.mzML"][0] == "blank" and d["B_MRM-t15.mzML"][:1] == ("sample",) and d["B_MRM-t15.mzML"][2] == 15, d
            en = pg.evaluate("[...document.querySelectorAll('#flist input[data-k=conc]')].map(x=>[x.disabled,x.value])")
            assert any(not e[0] and e[1] == "5" for e in en), en
        step("columns, types and concentrations guessed from the name", layout)
        def routing():
            assert MDAM.name in pg.inner_text("#mlist") and "MRM, 2 transizioni" in pg.inner_text("#mlist"), pg.inner_text("#mlist")
            assert "riquadro 2" in pg.inner_text("#up") and MDAM.name not in pg.inner_text("#flist")
            pg.set_input_files("#pickdam", [str(tmp / "B_FullMass-t0.mzML")]); pg.wait_for_timeout(800)
            assert "riquadro 1" in pg.inner_text("#up")
            assert pg.locator("#mlist table").count() == 1 and pg.locator("#flist table").count() == 1
        step("a .dam dropped in box 1 goes to box 2 (and the other way round), method table", routing)
        def size():
            fs = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('#start')).fontSize)"); assert fs >= 15, fs
            w = pg.evaluate("[document.querySelector('#opbtn').getBoundingClientRect().width, document.querySelector('#drop').getBoundingClientRect().width]"); assert abs(w[0] - w[1]) < 40, w
        step("font +2pt and button as wide as the boxes", size)
        def unit_change():
            pg.select_option("#cunit", "ugl"); pg.wait_for_timeout(200)
            v = pg.evaluate("ST.files.find(f=>f.name==='Std_5.mzML').conc"); assert v == 5000, v
            pg.select_option("#cunit", "mgl")
        step("unit selector converts the concentrations", unit_change)
        def standard_off():
            pg.locator('#flist tr', has_text="B_MRM-t15").locator("select[data-k=type]").select_option("blank"); pg.wait_for_timeout(100)
            assert pg.evaluate("ST.files.find(f=>f.name==='B_MRM-t15.mzML').type") == "blank"
            pg.locator('#flist tr', has_text="B_MRM-t15").locator("select[data-k=type]").select_option("sample")
        step("type is editable", standard_off)
        pg.click("text=Carica dati"); pg.wait_for_timeout(3500)
        pg.click("#dtabs [data-t=mrm]"); pg.wait_for_timeout(3500)
        pg.screenshot(path=SH + "152_mrm.png")
        def mrm_ui():
            assert pg.locator("#calbar").is_visible() and pg.locator("#np-cal").is_visible()
            assert pg.evaluate("E.panels.some(p=>p.type==='mrm'&&p.imode==='man'&&p.intf==='all')")
            assert "standard" in pg.inner_text("#flst")
        step("MRM session: calibration strip, integration tool ready", mrm_ui)
        def integrate():
            i = pg.evaluate("E.panels.findIndex(p=>p.type==='mrm'&&p.tr===CAL.quant)")
            ap = pg.evaluate("""(i)=>{const p=E.panels[i],s=p._a.sr[0];let m=0;s.y.forEach((v,j)=>{if(v>s.y[m])m=j});return s.x[m]}""", i)
            def pt(x): return pg.evaluate("""([i,x])=>{const p=E.panels[i],r=p.cv.getBoundingClientRect();return {px:r.left+p._a.X(x),py:r.top+r.height/2}}""", [i, x])
            a, b = pt(ap - 0.3), pt(ap + 0.3)
            pg.mouse.move(a["px"], a["py"]); pg.mouse.down(); pg.mouse.move(b["px"], b["py"], steps=8); pg.mouse.up(); pg.wait_for_timeout(1500)
            n = pg.evaluate("tabPanels().filter(p=>p.type==='mrm').map(p=>p.ints.length)"); assert n == [5, 5], n          # 5 MRM files; the window goes to the quantifier and the qualifier
            # same drag again: replaced, not doubled
            pg.mouse.move(a["px"], a["py"]); pg.mouse.down(); pg.mouse.move(b["px"], b["py"], steps=8); pg.mouse.up(); pg.wait_for_timeout(800)
            assert pg.evaluate("tabPanels().filter(p=>p.type==='mrm').map(p=>p.ints.length)") == [5, 5]
            # make the areas differ (as real standards do): the window of each standard scales with its concentration
            pg.evaluate(f"""()=>{{tabPanels().filter(p=>p.type==='mrm').forEach(p=>{{p.ints.forEach(it=>{{const f=E.files[it.k],c=f.type==='standard'?f.conc:3,h=0.12*Math.min(c,10)/10+0.03,ap={ap};it.a=ap-h;it.b=ap+h}});draw(p)}})}}""")
            pg.wait_for_timeout(1200)
            assert "3/3 standard integrati" in pg.inner_text("#calbar"), pg.inner_text("#calbar").replace("\n", " | ")
        step("drag integrates every file in one window; a new drag replaces", integrate)
        def calib():
            pg.click("#calopen"); pg.wait_for_timeout(1500)
            pg.screenshot(path=SH + "153_cal.png")
            eq = pg.inner_text("#cal-eq"); assert "R²" in eq and "n = 3" in eq, eq
            assert pg.locator(".cal-t tr").count() == 1 + 5, pg.locator(".cal-t tr").count()
            pg.locator('[data-use]').first.uncheck(); pg.wait_for_timeout(300)
            assert "n = 2" in pg.inner_text("#cal-eq"); pg.locator('[data-use]').first.check()
            pg.select_option("#cal-w", "x"); pg.wait_for_timeout(300); assert "R²" in pg.inner_text("#cal-eq")
            with pg.expect_download() as d: pg.click("#cal-csv")
            txt = open(d.value.path(), encoding="utf-8-sig").read(); assert "Pendenza" in txt and "Std_5" in txt, txt[:300]
            pg.click("#bigx")
        step("calibration window: fit, exclude a point, weights, CSV", calib)
        def reopen():
            pg.locator('.pnl.mrm [data-o=cal]').first.click(); pg.wait_for_timeout(800); assert pg.locator("#cal-cv").is_visible(); pg.click("#bigx")
        step("panel button opens it too", reopen)
finally:
    r.close()
print("\nSTEPS"); [print(" ", s) for s in steps]
print([e for e in r.errs if "ERR_ABORTED" not in str(e)])
