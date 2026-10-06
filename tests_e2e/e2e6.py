# e2e6: default view (TIC on top, spectrum at the apex), collapsible file list, white PNG, formula+mass labels in Disegno
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:300]))
r = Run(port=8816, wd="/tmp/wd6")
KQ = "document.getElementById('kframe').contentWindow.ketcher"
LBL = "[...document.getElementById('kframe').contentWindow.ketcher.editor.render.paper.canvas.querySelectorAll('#qqq-labels text')].map(t=>t.textContent)"
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in FILES])
        pg.wait_for_timeout(1000); pg.click("text=Carica dati"); pg.wait_for_timeout(5000)
        pg.screenshot(path=SH + "60_default.png")
        def layout():
            P = pg.evaluate("E.panels.map(p=>({t:p.type,x:p.x,y:p.y,w:p.w,full:p.full,r0:p.r0,k:p.k,cur:p.cur}))"); W = pg.evaluate("Q('#dpanels').clientWidth")
            assert P[0]["t"] == "chrom" and P[1]["t"] == "spec", P
            assert P[0]["w"] == W and P[1]["w"] == W and P[1]["y"] > P[0]["y"], (P, W)
            assert P[1]["r0"] is not None and abs(P[1]["r0"] - P[0]["cur"]) < 0.05, P
            assert 13.5 < P[0]["cur"] < 15, P   # flufenacet apex ~14.3 min
            assert pg.evaluate("E.panels[0]._a.sr.every(s=>E.files[s.k].kind!=='mrm')"), "MRM TIC in the chromatogram"
        step("TIC on top, spectrum below at the apex, full width", layout)
        def helpq():
            pg.locator('.pnl.chrom .hq').first.click(); pg.wait_for_timeout(300)
            assert pg.is_visible("#helppop") and "Cromatogramma" in pg.inner_text("#helppop")
            pg.screenshot(path=SH + "71_help.png")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200); assert not pg.is_visible("#helppop")
            n = pg.locator(".hq:visible").count(); assert n >= 5, n
        step("? buttons open the explanation", helpq)
        def csvexcel():
            pg.click("#dtabs [data-t=mrm]"); pg.wait_for_timeout(2500)
            with pg.expect_download() as d: pg.locator(".pnl.mrm [data-a=csv]").first.click()
            raw = open(d.value.path(), "rb").read(); t = raw.decode("utf-8-sig"); first = t.split("\r\n")[:3]
            print("CSV:", first[0][:120], "|", first[1][:80])
            assert raw[:3] == b"\xef\xbb\xbf" and "RT min" in first[0] and ";" in first[1] and "," in "".join(first[1:]) and "." not in "".join(first[1:]).replace('"', ''), first
        step("plot CSV for Excel (semicolon, decimal comma, BOM)", lambda: (csvexcel(), pg.evaluate("setTab('full')"), pg.wait_for_timeout(800)))
        def fold():
            w0 = pg.evaluate("E.panels[0].w"); pg.click("#ffold"); pg.wait_for_timeout(600)
            w1 = pg.evaluate("E.panels[0].w"); assert w1 > w0 + 150 and pg.is_visible("#funfold") and not pg.is_visible("#dfiles"), (w0, w1)
            pg.screenshot(path=SH + "61_folded.png")
            pg.click("#funfold"); pg.wait_for_timeout(600); assert pg.evaluate("E.panels[0].w") == w0 and pg.is_visible("#dfiles")
        step("file list collapses and the panels widen", fold)
        def png():
            with pg.expect_download() as d: pg.locator(".pnl.chrom [data-a=png]").first.click()
            path = "/tmp/wd6_chrom.png"; d.value.save_as(path)
            px = pg.evaluate("""async p=>{const i=new Image();i.src=p;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);return [...g.getImageData(2,2,1,1).data]}""",
                             "data:image/png;base64," + __import__("base64").b64encode(open(path, "rb").read()).decode())
            assert px == [255, 255, 255, 255], px
        step("PNG of a plot has a white background", png)
        def restore():
            pg.click("#ffold"); pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(4000)
            assert pg.evaluate("E.fold") and not pg.is_visible("#dfiles"); pg.click("#funfold"); pg.wait_for_timeout(800)
        step("collapsed file list is restored after reload", restore)
        def periodic():
            pg.click("#np-pt"); pg.wait_for_timeout(500)
            assert pg.locator(".pt-c").count() == 118
            pg.hover('.pt-c[data-s="Cl"]'); pg.wait_for_timeout(200)
            t = pg.inner_text("#pt-info"); assert "Cloro" in t and "34.96885" in t and "75.76" in t and "24.24" in t, t
            pg.click('.pt-c[data-s="Br"]'); pg.hover('.pt-c[data-s="C"]'); pg.wait_for_timeout(200)
            assert "Bromo" in pg.inner_text("#pt-info"), "click should pin the element"
            pg.screenshot(path=SH + "65_periodic.png")
        step("periodic table: hover shows masses and isotopes, click pins", periodic)
        def adducts():
            pg.click('#reftabs button[data-t="ad"]'); pg.fill("#ad-in", "C14H13F4N3O2S"); pg.wait_for_timeout(700)
            t = pg.inner_text("#ad-tbl"); assert "364.0737" in t and "386.0557" in t, t[:400]   # flufenacet [M+H]+ and [M+Na]+
            pg.fill("#ad-in", "100"); pg.wait_for_timeout(300); assert "101.0073" in pg.inner_text("#ad-tbl")
            pg.screenshot(path=SH + "66_adducts.png")
            pg.click('#reftabs button[data-t="ls"]'); pg.wait_for_timeout(200); t = pg.inner_text("#refbody"); assert "H2O\t18" in t and "C2H2O\t42" in t, t[:300]
            pg.click("#refx")
        step("adducts and neutral losses tables", adducts); print(steps[-2:])
        if pg.evaluate("Q(\"#refdlg\").open"): pg.evaluate("Q(\"#refdlg\").close()")
        def isotopes():
            pg.click("#np-ad"); pg.wait_for_timeout(400); pg.click('#reftabs button[data-t="is"]')
            pg.fill("#is-f", "C9H10Cl2N2O"); pg.wait_for_timeout(700)
            t = pg.inner_text("#is-out"); print("ISO:", t.replace("\n", " | ")[:200])
            assert "233.0243" in t and "64.7" in t and "10.7" in t, t      # diuron [M+H]+: Cl2 pattern 100 : 65 : 11
            pg.screenshot(path=SH + "69_isotopes.png")
            # periodic table keeps the same size whatever element is shown
            pg.click('#reftabs button[data-t="pt"]'); pg.wait_for_timeout(300)
            hs = []
            for el in ["F", "Sn", "C", "Hg"]:
                pg.hover(f'.pt-c[data-s="{el}"]'); pg.wait_for_timeout(150); hs.append(pg.evaluate("Q('.pt').getBoundingClientRect().height"))
            assert max(hs) - min(hs) < 1, hs
            pg.click("#refx")
        step("isotope pattern tab (diuron Cl2) and fixed-size periodic table", isotopes)
        def overlay():
            sp = pg.evaluate("E.panels.findIndex(p=>p.type==='spec')")
            pg.evaluate(f"(()=>{{const p=E.panels[{sp}];p.iso={{formula:'C14H13F4N3O2S',ad:'[M+H]+'}};p.zoom=[360,372];draw(p)}})()"); pg.wait_for_timeout(1500)
            leg = pg.inner_text(".pnl.spec .leg"); print("ISO LEG:", leg.replace("\n", " | "))
            assert "profilo teorico" in leg and "allineato al picco" in leg, leg
            pg.screenshot(path=SH + "70_iso_overlay.png")
            pg.evaluate(f"(()=>{{const p=E.panels[{sp}];p.iso=null;draw(p)}})()")
        step("isotope overlay on the spectrum, aligned to the observed peak", overlay)
        pg.click("#nav button[data-v=draw]"); pg.wait_for_function("window.TPDraw && TPDraw.ready()", timeout=60000)
        def labels():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1')"); pg.wait_for_timeout(1500)
            t = pg.evaluate(LBL); assert t == ["C8H9NO2  M = 151"], t
        step("label under the molecule (formula, nominal mass)", labels)
        def ion():
            pg.evaluate(KQ + ".setMolecule('CC(=O)[NH2+]c1ccc(O)cc1')"); pg.wait_for_timeout(1500)
            t = pg.evaluate(LBL); assert t == ["C8H10NO2+  m/z 152"], t
            pg.screenshot(path=SH + "62_ion.png")
        step("charged structure shows m/z", ion)
        def breakbond():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1')"); pg.wait_for_timeout(1200)
            # erase the amide C-N bond with Ketcher's own eraser tool (as a student would)
            pos = pg.evaluate("""(()=>{const k=%s, st=k.editor.struct();let bid=null;st.bonds.forEach((b,id)=>{const a=st.atoms.get(b.begin).label,c=st.atoms.get(b.end).label;
               if((a==='N'&&c==='C'||a==='C'&&c==='N')&&bid===null){const o=[...st.bonds.values()].some(x=>(x.begin===(a==='C'?b.begin:b.end)||x.end===(a==='C'?b.begin:b.end))&&x.type===2);if(o)bid=id}});
               const b=st.bonds.get(bid),p1=st.atoms.get(b.begin).pp,p2=st.atoms.get(b.end).pp;
               const c=k.editor.render.paper.canvas, r=c.getBoundingClientRect(), vb=c.viewBox.baseVal, f=document.getElementById('kframe').getBoundingClientRect();
               const ux=(p1.x+p2.x)/2*40, uy=(p1.y+p2.y)/2*40; return {x:f.left+r.left+(ux-vb.x)*r.width/vb.width, y:f.top+r.top+(uy-vb.y)*r.height/vb.height}})()""" % KQ)
            pg.frame_locator("#kframe").locator("[data-testid=erase]:visible").first.click(); pg.wait_for_timeout(300)
            pg.mouse.click(pos["x"], pos["y"]); pg.wait_for_timeout(1200)
            t = sorted(pg.evaluate(LBL)); assert t == sorted(["C2H4O  M = 44", "C6H7NO  M = 109"]), t
            pg.screenshot(path=SH + "63_broken.png")
            pg.evaluate(KQ + ".editor.undo()"); pg.wait_for_timeout(1000); assert pg.evaluate(LBL) == ["C8H9NO2  M = 151"]
        step("erasing a bond gives two labels; undo restores", breakbond)
        def selection():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1')"); pg.wait_for_timeout(1200)
            # select the 4-aminophenol part (N, ring, OH): the acetyl C(=O)CH3 stays out -> 1 cut bond
            pg.evaluate("""(()=>{const k=%s,st=k.editor.struct(),keep=[];const acyl=new Set();
               st.bonds.forEach(b=>{const a=st.atoms.get(b.begin),c=st.atoms.get(b.end);if(b.type===2&&(a.label==='O'||c.label==='O')){acyl.add(b.begin);acyl.add(b.end)}});
               const co=[...acyl].find(i=>st.atoms.get(i).label==='C');st.bonds.forEach(b=>{if(b.begin===co&&st.atoms.get(b.end).label==='C')acyl.add(b.end);if(b.end===co&&st.atoms.get(b.begin).label==='C')acyl.add(b.begin)});
               st.atoms.forEach((a,i)=>{if(!acyl.has(i))keep.push(i)});k.editor.selection({atoms:keep})})()""" % KQ)
            pg.wait_for_timeout(600)
            t = pg.inner_text("#selbody"); print("SEL:", t.replace("\n", " | ")[:300])
            assert pg.is_visible("#selcard") and "C6H6NO" in t.replace("\n", "") and "110.0600" in t and "1 legame tagliato" in t, t
            pg.screenshot(path=SH + "67_selection.png")
            pg.evaluate(KQ + ".editor.selection(null)"); pg.wait_for_timeout(400); assert not pg.is_visible("#selcard")
        step("selected atoms: fragment formula and ion m/z (110 for paracetamol)", selection)
        def arrow():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1>>CC(=O)Nc1ccc(O)c(O)c1')"); pg.wait_for_timeout(1500)
            t = pg.evaluate(LBL); print("ARROW:", t)
            assert any(x.startswith("+O") and x.endswith("\u0394m +16") for x in t), t
            pg.screenshot(path=SH + "68_arrow.png")
            ket = pg.evaluate("(async()=>{const k=%s;return k.getKet()})()" % KQ); assert "\u0394m" not in ket and "+16" not in ket
        step("arrow label shows the change (+O, +16)", arrow)
        def macro():
            n = pg.evaluate("[...document.getElementById('kframe').contentDocument.querySelectorAll('[data-testid=polymer-toggler]')].filter(e=>e.getBoundingClientRect().width>0).length")
            assert n == 0, n
        step("macromolecule mode switch hidden", macro)
        def zoom():
            b0 = pg.evaluate("document.getElementById('kframe').contentWindow.document.querySelector('#qqq-labels text').getBoundingClientRect().width")
            pg.evaluate(KQ + ".editor.zoom(2)"); pg.wait_for_timeout(600)
            b1 = pg.evaluate("document.getElementById('kframe').contentWindow.document.querySelector('#qqq-labels text').getBoundingClientRect().width")
            assert b1 > b0 * 1.6, (b0, b1); pg.evaluate(KQ + ".editor.zoom(1)")
        step("label follows the zoom", zoom)
        def off():
            n0 = len(pg.evaluate(LBL)); assert n0 >= 1
            pg.uncheck("#lb-on"); pg.wait_for_timeout(300); assert pg.evaluate(LBL) == []
            pg.check("#lb-on"); pg.wait_for_timeout(300); assert len(pg.evaluate(LBL)) == n0
        step("labels can be switched off", off)
        def export():
            ket = pg.evaluate("(async()=>{const k=%s;return k.getKet()})()" % KQ)
            assert '"text"' not in ket, "label leaked into the drawing"
            with pg.expect_download() as d: pg.click("#ex-png")
            d.value.save_as(SH + "64_export.png")
        step("labels exported but not stored in the drawing", export)
finally:
    r.close(); r.report()
print("\nSTEPS"); [print(" ", s) for s in steps]
