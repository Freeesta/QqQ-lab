"""Dati sub-tabs: Full Scan / MS2 / MRM never share a graph; MS2 strip + panel per precursor; MRM Quant/Qual; overview matrix."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e: steps.append((name, "FAIL " + str(e).split("\n")[0][:220]))
r = Run(port=8817, wd="/tmp/wd17")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        pg.set_input_files("#pick", [mz(f) for f in FILES]); pg.wait_for_timeout(1500)
        pg.click("text=Carica dati"); pg.wait_for_timeout(5000)
        tabs = lambda: pg.evaluate("[...document.querySelectorAll('#dtabs [data-t]')].map(b=>b.dataset.t+':'+b.querySelector('i').innerText)")
        def t1(): assert tabs() == ["full:3", "ms2:1", "mrm:1"], tabs()
        step("tab bar with per-type counts", t1)
        def t2():
            assert pg.evaluate("E.tab") == "full"
            assert pg.evaluate("E.panels.filter(p=>p.tab==='full'&&p.el.style.display!=='none').length") >= 2
            assert pg.evaluate("E.panels.every(p=>p.tab==='full'||p.el.style.display==='none')")
        step("Full Scan tab: chromatogram + spectrum, nothing else", t2)
        def t3():
            pg.click("#dtabs [data-t=ms2]"); pg.wait_for_timeout(2500)
            assert pg.evaluate("E.tab") == "ms2"
            n = pg.evaluate("E.panels.filter(p=>p.tab==='ms2').length"); assert n >= 2 and n % 2 == 0, n
            assert pg.locator("#expbar").count() == 0                       # the experiments strip was removed (precursors live in the file list)
            assert pg.evaluate("E.panels.filter(p=>p.tab==='full').every(p=>p.el.style.display==='none')")
        step("MS2 tab: one chromatogram+spectrum per precursor", t3)
        def t4():
            pg.click("#dtabs [data-t=mrm]"); pg.wait_for_timeout(3000)
            m = pg.evaluate("E.panels.filter(p=>p.tab==='mrm').map(p=>p.title||'')"); assert len(m) >= 2, m
            assert any("Quantificatore" in x for x in m) and any("Qualificatore" in x for x in m), m
        step("MRM tab: Quantificatore and Qualificatore panels", t4)
        def t5():
            pg.click("#ovbtn"); pg.wait_for_timeout(500)
            assert pg.locator("#ovw").is_visible()
            hs = pg.locator("#ovw th").all_inner_texts(); assert len(hs) == 4, hs
            pg.locator("#ovw button.fc", has_text="MS2").first.click(); pg.wait_for_timeout(1500)
            assert pg.evaluate("E.tab") == "ms2"
        step("overview matrix: click opens the file in its tab", t5)
        def t6():
            pg.evaluate("setTab('full')"); pg.wait_for_timeout(500)
            pg.reload(); pg.wait_for_timeout(1500)
        step("tab switch back works", t6)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300])); r.close()
for s in steps: print(" ", s)
r.report()
