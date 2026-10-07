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
            assert pg.locator(".hq:visible").count() == 1, "only the general ? is left"
            pg.locator('button.hq[data-help=header]').click(); pg.wait_for_timeout(300)
            tx = pg.inner_text("#helppop"); assert pg.is_visible("#helppop") and "Cromatogramma" in tx and "Spettro" in tx and "Full Scan" in tx, tx[:200]
            pg.screenshot(path=SH + "71_help.png")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200); assert not pg.is_visible("#helppop")
            assert "Doppio clic per rinominare" in pg.evaluate("document.querySelector('.pnl.chrom .ttl').title")
        step("only the general ? is left: it opens the guide; panel titles carry the short explanation", helpq)
        def xlsxexcel():
            pg.click("#dtabs [data-t=mrm]"); pg.wait_for_timeout(2500)
            with pg.expect_download() as d: pg.locator(".pnl.mrm [data-a=xlsx]").first.click()
            f = d.value; assert f.suggested_filename.endswith(".xlsx"), f.suggested_filename
            rows = xlsx_rows(f.path()); head = [c[1] for c in rows[0] if c]
            print("XLSX:", f.suggested_filename, head[:2], rows[1][:2])
            assert any("RT (min)" in h for h in head) and any("Intensità (cps)" in h for h in head), head
            assert all(c[0] == "n" for c in rows[1][:2] if c), rows[1][:2]                    # real numbers, not text
            assert 0 <= rows[1][0][1] < 40 and rows[5][0][1] > rows[1][0][1], (rows[1][0], rows[5][0])
            wb = xlsx_openpyxl(f.path())
            if wb: assert isinstance(wb.active.cell(2, 1).value, (int, float)) and wb.active.cell(1, 1).font.b
        step("plot Excel (.xlsx: numeric cells, units in headers)", lambda: (xlsxexcel(), pg.evaluate("setTab('full')"), pg.wait_for_timeout(800)))
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
            t = pg.evaluate(LBL); assert t == ["C8H9NO2", "M = 151"], t            # one text per line: formula, then mass
        step("label under the molecule (formula, nominal mass)", labels)
        def ion():
            pg.evaluate(KQ + ".setMolecule('CC(=O)[NH2+]c1ccc(O)cc1')"); pg.wait_for_timeout(1500)
            t = pg.evaluate(LBL); assert t == ["C8H10NO2+", "m/z 152"], t
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
            t = sorted(pg.evaluate(LBL)); assert t == sorted(["C2H4O", "M = 44", "C6H7NO", "M = 109"]), t
            pg.screenshot(path=SH + "63_broken.png")
            pg.evaluate(KQ + ".editor.undo()"); pg.wait_for_timeout(1000); assert pg.evaluate(LBL) == ["C8H9NO2", "M = 151"]
        step("erasing a bond gives two labels; undo restores", breakbond)
        def no_boxes():
            # the boxes that did the student's work are gone for good; the cream background option too
            assert pg.evaluate("['selcard','selbody','dcard','dcomp','cap-name','cap-on','ex-bg'].every(i=>!document.getElementById(i))")
        step("caption / adduct table / fragment-calculation boxes and cream option removed", no_boxes)
        def sel_smiles():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1')"); pg.wait_for_timeout(1200)
            assert not pg.is_visible("#sel-card")
            # whole drawing: properties table without selection
            assert pg.is_visible("#prop-card"); t = pg.inner_text("#prop-body"); print("PROP:", t.replace("\n", " | ")[:200])
            lp = float(pg.inner_text("#prop-body tr:nth-child(2) td:nth-child(2)")); assert 0.3 < lp < 1.8, lp
            # select the 4-aminophenol part (N, ring, OH), acetyl C(=O)CH3 stays out: a PIECE, 1 cut bond
            pg.evaluate("""(()=>{const k=%s,st=k.editor.struct(),acyl=new Set(),keep=[];
               st.bonds.forEach(b=>{const a=st.atoms.get(b.begin),c=st.atoms.get(b.end);if(b.type===2&&(a.label==='O'||c.label==='O')){acyl.add(b.begin);acyl.add(b.end)}});
               const co=[...acyl].find(i=>st.atoms.get(i).label==='C');st.bonds.forEach(b=>{if(b.begin===co&&st.atoms.get(b.end).label==='C')acyl.add(b.end);if(b.end===co&&st.atoms.get(b.begin).label==='C')acyl.add(b.begin)});
               st.atoms.forEach((a,i)=>{if(!acyl.has(i))keep.push(i)});k.editor.selection({atoms:keep})})()""" % KQ)
            pg.wait_for_timeout(700)
            assert pg.is_visible("#sel-card"); t = pg.inner_text("#sel-body"); print("SEL:", t.replace("\n", " | "))
            assert "Nc1ccc(O)cc1" in t or "Oc1ccc(N)cc1" in t, t
            assert "1 legame tagliato" in t, t
            assert pg.is_visible("#prop-card") and "Selezione" in pg.inner_text("#prop-body")
            pg.screenshot(path=SH + "66_sel_smiles.png")
            # whole molecule selected: its full SMILES; the copy button works on the text
            pg.evaluate("(()=>{const k=%s;k.editor.selection({atoms:[...k.editor.struct().atoms.keys()]})})()" % KQ); pg.wait_for_timeout(700)
            whole = pg.evaluate("(async()=>%s.getSmiles())()" % KQ)      # the selection of everything = the SMILES Ketcher gives for the canvas
            t = pg.inner_text("#sel-body"); assert whole in t and "legam" not in t, (whole, t)
            assert pg.get_attribute("#sel-body [data-cp]", "data-cp") == whole
            pg.evaluate(KQ + ".editor.selection(null)"); pg.wait_for_timeout(500); assert not pg.is_visible("#sel-card")
        step("selection shows its SMILES (also a piece); properties table (logP...)", sel_smiles)
        def props_ion():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1.Oc1ccc([NH3+])cc1')"); pg.wait_for_timeout(1500)
            rows = pg.evaluate("[...document.querySelectorAll('#prop-body tr')].slice(1).map(r=>[...r.cells].map(c=>c.textContent))"); print("PROPS:", rows)
            assert len(rows) == 2 and rows[1][1] == "\u2013" and rows[0][1] != "\u2013", rows     # the ion has no logP
        step("properties: ions are excluded (no logP for a charged species)", props_ion)
        def hires():
            w = pg.evaluate("""async()=>{const b=await TPDraw.image('png');const i=await createImageBitmap(b);return [i.width,i.height]}"""); print("PNG px:", w)
            assert w[0] >= 3000, w
        step("PNG export is high resolution (>= 3000 px wide)", hires)
        def nobg():
            corner = """async()=>{const b=await TPDraw.image('png');const i=await createImageBitmap(b);const c=document.createElement('canvas');c.width=i.width;c.height=i.height;
                const g=c.getContext('2d');g.drawImage(i,0,0);return Array.from(g.getImageData(2,2,1,1).data)}"""
            assert pg.evaluate(corner) == [255, 255, 255, 255], "default: white background"
            assert pg.is_enabled("#ex-jpg")
            pg.check("#ex-nobg"); pg.wait_for_timeout(200)
            assert not pg.is_enabled("#ex-jpg"), "JPEG must be off without background"
            assert pg.evaluate(corner)[3] == 0, "transparent PNG"
            with pg.expect_download() as d: pg.click("#ex-svg")
            svg = open(d.value.path(), encoding="utf-8").read()
            assert "rgb(100%, 100%, 100%)" not in svg and "<text" in svg, "SVG: no background rectangle, labels kept"
            pg.uncheck("#ex-nobg"); pg.wait_for_timeout(200)
            assert pg.is_enabled("#ex-jpg") and pg.evaluate(corner) == [255, 255, 255, 255]
        step("\"senza sfondo\": transparent PNG and SVG, JPEG disabled; off = white", nobg)
        def ion_choice():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1')"); pg.wait_for_timeout(1200)
            for ad, want in [("[M+H]+", ["C8H10NO2+  m/z 152"]), ("[M-H]-", ["C8H8NO2\u2212  m/z 150"]), ("[M+Na]+", ["C8H9NNaO2+  m/z 174"]), ("[M+NH4]+", ["C8H13N2O2+  m/z 169"])]:
                pg.select_option("#lb-ion", ad); pg.wait_for_timeout(400)
                t = pg.evaluate(LBL); assert [x for x in [" ".join(t)]] == [w.replace("  ", " ") for w in want], (ad, t)
            # a structure drawn with its own charge keeps it: the ion menu adds nothing
            pg.select_option("#lb-ion", "[M+Na]+")
            pg.evaluate(KQ + ".setMolecule('CC(=O)[NH2+]c1ccc(O)cc1')"); pg.wait_for_timeout(1200)
            t = pg.evaluate(LBL); assert " ".join(t) == "C8H10NO2+ m/z 152", t
            pg.select_option("#lb-ion", ""); pg.wait_for_timeout(300)
            pg.screenshot(path=SH + "67_ion_choice.png")
        step("ion menu: [M+H]+ 152, [M-H]- 150, [M+Na]+ 174, [M+NH4]+ 169; drawn charge wins", ion_choice)
        def nh3():
            pg.evaluate(KQ + ".setMolecule('Oc1ccc([NH3+])cc1>>Oc1cc[c+]cc1')"); pg.wait_for_timeout(1500)
            t = pg.evaluate(LBL); print("NH3:", t)
            assert any(x.startswith("\u2212NH3") and x.endswith("\u0394m \u221217") for x in t), t
        step("neutral loss written NH3 (not H3N) on the arrow", nh3)
        def arrow():
            pg.evaluate(KQ + ".setMolecule('CC(=O)Nc1ccc(O)cc1>>CC(=O)Nc1ccc(O)c(O)c1')"); pg.wait_for_timeout(1500)
            t = pg.evaluate(LBL); print("ARROW:", t)
            assert any(x.startswith("+O") and x.endswith("\u0394m +16") for x in t), t
            pg.screenshot(path=SH + "68_arrow.png")
            ket = pg.evaluate("(async()=>{const k=%s;return k.getKet()})()" % KQ); assert "\u0394m" not in ket and "+16" not in ket
        step("arrow label shows the change (+O, +16)", arrow)
        def smiles_and_examples():
            pg.fill("#ex-smi", "not a smiles((("); pg.click("#ex-load"); pg.wait_for_timeout(1200)
            assert pg.is_visible("#smi-warn") and "SMILES" in pg.inner_text("#smi-warn"), "warning line missing"
            pg.fill("#ex-smi", "Nc1ccc(O)cc1"); pg.click("#ex-load"); pg.wait_for_timeout(1200)
            assert not pg.is_visible("#smi-warn"), "warning should disappear after a valid SMILES"
            pg.click("#ex-link"); pg.wait_for_timeout(800)
            w = pg.evaluate("[...document.querySelectorAll('#bigbody img')].map(i=>[i.getAttribute('src'),i.naturalWidth])")
            assert [x[0] for x in w] == ["static/esempio-trasformazione.png", "static/esempio-frammentazione.png"] and all(x[1] > 500 for x in w), w
            pg.screenshot(path=SH + "69_examples.png"); pg.click("#bigx"); pg.wait_for_timeout(300)
        step("invalid SMILES warning line; example link shows the two schemes", smiles_and_examples)
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
            pg.uncheck("#lb-f"); pg.uncheck("#lb-m"); pg.wait_for_timeout(300); assert pg.evaluate(LBL) == []
            pg.check("#lb-f"); pg.check("#lb-m"); pg.wait_for_timeout(300); assert len(pg.evaluate(LBL)) == n0
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
