"""Addotti tab: nominal column, common adducts first, the rest folded, no pair tool, lists aligned with the Python ones, one rounding rule (JS rh = Python round_half_up). No data files needed."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from lib import *
from mzlab.chem.elements import ADDUCT_SHIFT, MASS, ELECTRON, round_half_up
from mzlab import ionfamily
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e28.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8828 + 100, wd="/tmp/wd28")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        def table():
            pg.click("#np-ad"); pg.wait_for_timeout(500)
            t = pg.inner_text("#refbody"); assert "nominale" in t and "1 decimale" not in t and "Altri addotti (meno comuni)" in t and "Un addotto è lo ione che la molecola M forma" not in t, t[:600]
            assert "Due picchi" not in t and "m/z osservati" not in t and "scheda Isotopi" not in t and "Cl-35" not in t
            pg.fill("#ad-in", "363.0665"); pg.wait_for_timeout(400)
            rows = pg.evaluate("[...document.querySelectorAll('#ad-tbl .ad-card table tr')].map(tr=>[tr.className,...[...tr.children].map(c=>c.textContent)])")
            hrow = [x for x in rows if len(x) > 1 and x[1].startswith("[M+H]")][0]; assert hrow[0] == "exp" and hrow[4] == "364", hrow          # nominal, expected row
            na = [x for x in rows if len(x) > 1 and x[1].startswith("[M+Na]+")][0]; assert na[0] == "exp" and na[4] == "386", na
            k = [x for x in rows if len(x) > 1 and x[1].startswith("[M+K]+")][0]; assert k[0] == "exp", k
            shown = [x[1] for x in rows if len(x) > 1 and x[1].startswith("[")]; assert shown == ["[M+H]+", "[M+NH4]+", "[M+Na]+", "[M+K]+", "[M-H]-", "[M+HCOO]-", "[M+Cl]-"], shown      # only the common ones until the fold is opened
            pg.locator("#ad-tbl .adtog").first.click(); pg.wait_for_timeout(200)
            more = pg.evaluate("[...document.querySelectorAll('#ad-tbl .ad-card table tr')].map(tr=>tr.children[0].textContent).filter(t=>t.startsWith('['))"); assert "[2M+H]+" in more and "[M+H-H2O]+" in more, more
            pg.fill("#ad-in", "363.0665"); pg.wait_for_timeout(300)
            assert pg.evaluate("[...document.querySelectorAll('#ad-tbl .ad-card table tr')].some(tr=>tr.children[0]?.textContent?.includes('[2M+H]+'))"), "the fold stays open while typing"
            pg.locator("#ad-tbl .adtog").first.click(); pg.wait_for_timeout(200)
            assert not pg.evaluate("[...document.querySelectorAll('#ad-tbl .ad-card table tr')].some(tr=>tr.children[0]?.textContent?.includes('[2M+H]+'))")
        step("table: nominal column, expected adducts first, drift and monoisotopic notes", table)
        def aligned():
            qa = pg.evaluate("QADD.map(a=>[a.n,a.shift,a.k,a.z])")
            for n, shift, k, z in qa:
                if k == 1 and abs(z) == 1 and n in ADDUCT_SHIFT: assert abs(shift - ADDUCT_SHIFT[n]) < 2e-5, (n, shift, ADDUCT_SHIFT[n])
            for n, shift, mult in ionfamily.ADDUCTS:
                if mult == 1:
                    q = [a for a in qa if a[0] == n]; assert q and abs(q[0][1] - shift) < 2e-4, (n, shift, q)
        step("the lists (tables.js, draw.js, elements.py, ionfamily.py) agree on every shared adduct", aligned)
        def rounding():
            vals = [364.15, 0.25, 1.005, 2.675, 200.5, 363.0735, 364.05, 100.45, 99.95, 0.35]
            for d in (0, 1, 2):
                js = pg.evaluate("v=>v.map(x=>rh(x,%d))" % d, vals); py = [round_half_up(x, d) for x in vals]
                assert js == py, (d, js, py)
        step("JS rh and Python round_half_up give the same digits", rounding)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
