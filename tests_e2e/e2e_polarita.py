"""Polarity made visible: sign next to the file names (list and loading table), default adduct from the panel's own files, sign in the legend when + and - are overlaid, polarity first in the Addotti table."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import pathlib
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_polarita.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
NEG = pathlib.Path(__file__).resolve().parent / "shots" / "neg_tmp"
sys.path.insert(0, str(ROOT / "tools"))
import dati_sintetici, numpy as np
NEG.mkdir(parents=True, exist_ok=True); NEGF = NEG / "B_FullMass-neg-t0.mzML"
dati_sintetici.full_scan(NEGF, 0, np.random.default_rng(7), neg=True)       # synthetic negative Full Scan (the lab has none: all ESI+)
r = Run(port=8875, wd="/tmp/wd75")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz("B_FullMass-t0"), str(NEGF)]); pg.wait_for_timeout(1500)
        def load_signs():
            t = pg.inner_text("#flist"); assert "+" in t and "−" in t, t
            assert pg.evaluate("[...document.querySelectorAll('#flist .pol')].map(x=>x.title)") == ["ESI negativo", "ESI positivo"] or set(pg.evaluate("[...document.querySelectorAll('#flist .pol')].map(x=>x.title)")) == {"ESI positivo", "ESI negativo"}
        step("loading table: + and − next to the names", load_signs)
        pg.click("text=Carica dati"); pg.wait_for_timeout(4500)
        def list_signs():
            assert pg.evaluate("[...document.querySelectorAll('#flst .fl:not(.ghost) .pol')].map(x=>x.textContent).sort().join('')") == "+−"
        step("file list: signs", list_signs)
        def legend():
            pg.evaluate("E.files.forEach(f=>f.vis=true)"); pg.evaluate("redrawAll()"); pg.wait_for_timeout(1500)
            leg = pg.inner_text(".pnl.chrom .leg"); assert "+" in leg and "−" in leg, leg                            # both polarities overlaid: the sign is in the legend
        step("legend: sign when positive and negative are overlaid", legend)
        def adduct():
            neg = pg.evaluate("E.files.findIndex(f=>f.polarity==='negative')")
            pg.evaluate("(k)=>{E.files.forEach((f,i)=>f.vis=i===k);E.browse=false}", neg) if False else None
            pg.evaluate(f"E.files.forEach((f,i)=>f.vis=i==={neg})")
            assert pg.evaluate("defAdduct()") == "[M-H]-"
            pg.evaluate(f"E.files.forEach((f,i)=>f.vis=i!=={neg})"); assert pg.evaluate("defAdduct()") == "[M+H]+"
            pg.evaluate("E.files.forEach(f=>f.vis=true)"); assert pg.evaluate("defAdduct()") == "[M+H]+", "mixed: positive"
            pg.evaluate(f"E.files.forEach((f,i)=>f.vis=i==={neg})"); pg.evaluate("openXic(null,{})"); pg.wait_for_timeout(300)
            assert pg.input_value("#xic-ad") == "[M-H]-"; pg.click("#xic-no")
        step("default adduct follows the panel's files ([M-H]- for a negative file)", adduct)
        def addotti():
            pg.evaluate("E.files.forEach(f=>f.vis=true)")
            pg.click("#np-ad"); pg.wait_for_timeout(500)
            h = pg.evaluate("[...document.querySelectorAll('#bigbody h4, dialog[open] h4')].map(x=>x.textContent)"); print(h)
            pg.keyboard.press("Escape")
        step("Addotti table opens", addotti)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
