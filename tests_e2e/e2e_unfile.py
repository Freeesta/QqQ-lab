"""With a single file in the tab, every control about showing several files is disabled; with two it is enabled again."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_unfile.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8832, wd="/tmp/wd_unf")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz("B_FullMass-t15")]); pg.wait_for_timeout(1000)
        pg.click("text=Carica dati"); pg.wait_for_timeout(3500)
        pg.evaluate("setTab('full',true)"); pg.wait_for_timeout(600)
        for sel in ["#np-chrom", "#np-spec", "#np-map"]: pg.click(sel); pg.wait_for_timeout(1200)
        dis = lambda s: pg.evaluate("s=>[...document.querySelectorAll(s)].map(x=>x.disabled)", s)
        def toolbar():
            assert all(dis("#fprev,#fnext,#fsel,#fmode button")) and len(dis("#fmode button")) == 2
        step("toolbar: arrows, selector, solo/tutti disabled", toolbar)
        def panels():
            assert all(dis("[data-o=mode]")) and dis("[data-o=mode]"), dis("[data-o=mode]")
            assert all(pg.evaluate("[...document.querySelectorAll('[data-o=all]')].map(x=>x.disabled)")) 
            assert all(dis("[data-o=ref]"))
        step("panels: overlay/stack, overlay files, difference disabled", panels)
        def two():
            pg.click("#addf"); pg.wait_for_timeout(500)
            pg.set_input_files("#pick", [mz("B_FullMass-t60")]); pg.wait_for_timeout(800)
            pg.click("#opbtn"); pg.wait_for_function("tabFiles('full').length===2", timeout=60000); pg.wait_for_timeout(1500)
            assert not any(dis("#fprev,#fnext,#fsel,#fmode button")) and not any(dis("[data-o=mode],[data-o=ref]"))
        step("two files: everything enabled again", two)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
