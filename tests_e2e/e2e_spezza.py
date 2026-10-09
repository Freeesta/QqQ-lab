"""Disegno: «Spezza il legame» in the context menu of a selected bond deletes the bond (the atoms stay) and the drawing then has two pieces, each with its own formula."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:220]))
r = Run(port=8992, wd="/tmp/wd_spezza")
try:
    with sync_playwright() as p:
        pg = r.page(p); pg.set_viewport_size({"width": 1440, "height": 900})
        pg.click("#nav [data-v=draw]")
        pg.wait_for_function("!!(window.TPDraw && TPDraw.ready())", timeout=60000); pg.wait_for_timeout(800)
        KJ = "document.querySelector('#kframe').contentWindow.ketcher"
        pg.evaluate(f"{KJ}.addFragment('CCO')"); pg.wait_for_timeout(800)
        def menu():
            n = pg.evaluate(f"(()=>{{const K={KJ};const ids=[...K.editor.struct().bonds.keys()];K.editor.selection({{bonds:[ids[0]]}});return ids.length}})()"); assert n == 2, n
            for _ in range(20):                                           # under load Ketcher may need a moment before the menu answers
                pg.evaluate("""(()=>{const d=document.querySelector('#kframe').contentDocument;d.body.dispatchEvent(new d.defaultView.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:200}))})()""")
                if pg.locator("#ctx div", has_text="Spezza il legame").count(): break
                pg.evaluate(f"(()=>{{const K={KJ};const ids=[...K.editor.struct().bonds.keys()];K.editor.selection({{bonds:[ids[0]]}})}})()"); pg.wait_for_timeout(500)
            pg.wait_for_selector("#ctx div:has-text('Spezza il legame')", timeout=5000)
        step("the context menu of a selected bond offers «Spezza il legame»", menu)
        def cut():
            pg.locator("#ctx div", has_text="Spezza il legame").first.click(); pg.wait_for_timeout(1200)
            o = pg.evaluate(f"(()=>{{const st={KJ}.editor.struct();return [st.bonds.size,st.atoms.size]}})()"); assert o == [1, 3], o        # one bond left, the three atoms stay
            smi = pg.evaluate(f"{KJ}.getSmiles()"); assert len(smi.split(".")) == 2, smi             # two pieces now ("C.CO" in some order)
        step("the bond is deleted, the atoms stay, the drawing has two pieces", cut)
finally:
    r.close()
r.report()
for s in steps: print(" ", s)
