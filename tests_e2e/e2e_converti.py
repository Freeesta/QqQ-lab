"""A .raw, .wiff or .d dropped in the start page: a message with the right recipe, nothing is uploaded and there is no generic error."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_converti.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
r = Run(port=8991, wd="/tmp/wd_converti")
try:
    with sync_playwright() as p:
        pg = r.page(p)
        def drop():
            pg.set_input_files("#pick", [{"name": "campione1.raw", "mimeType": "application/octet-stream", "buffer": b"RAW"}, {"name": "x.wiff", "mimeType": "application/octet-stream", "buffer": b"W"},
                                         {"name": "x.wiff.scan", "mimeType": "application/octet-stream", "buffer": b"S"}, {"name": "run.d", "mimeType": "application/octet-stream", "buffer": b"D"}])
            pg.wait_for_function("document.querySelectorAll('#up .recipe').length==4", timeout=10000)
            t = pg.inner_text("#up")
            assert "ThermoRawFileParser" in t and "MSConvert" in t and "wiff.scan" in t and "pwiz" in t.lower(), t
            assert pg.locator("#up .fail").count() == 0 and pg.locator("#flist input[data-k=use]").count() == 0
        step("the recipes for .raw, .wiff, its .scan and .d; nothing uploaded, no error", drop)
        def close():
            pg.locator("#up .recipe button").first.click(); assert pg.locator("#up .recipe").count() == 3
        step("a message can be closed", close)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300]))
    try: r.close()
    except Exception: pass
for n, s in steps: print(s.split(" ")[0].upper(), n, s if s != "ok" else "")
