import os, subprocess, time, sys, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
FILES = ["B_FullMass-t0", "B_FullMass-t15", "B_FullMass-t60", "B_MS2-t15", "B_MRM-t0"]
# Paths are relative to this folder: code = parent of tests_e2e, mzML = ../esempio_conversione/mzml (or $QQQ_MZML)
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MZ = Path(os.environ.get("QQQ_MZML", ROOT.parent / "esempio_conversione" / "mzml"))
SH = str(HERE / "shots") + "/"
os.makedirs(SH, exist_ok=True)
def mz(f): return str(MZ / f"{f}.mzML")
class Run:
    def __init__(s, port=8811, wd="/tmp/wd1", fresh=True):
        s.port, s.wd, s.errs = port, wd, []
        if fresh: shutil.rmtree(wd, ignore_errors=True)
        s.srv = subprocess.Popen([sys.executable, "-m", "tpfinder", "app", "--workdir", wd, "--port", str(port), "--no-open"],
                                 cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        time.sleep(2)
    def page(s, p):
        s.b = p.chromium.launch()
        pg = s.b.new_page(viewport={"width": 1500, "height": 2200})
        pg.on("pageerror", lambda e: s.errs.append(("pageerror", str(e))))
        pg.on("console", lambda m: s.errs.append(("console." + m.type, m.text)) if m.type in ("error", "warning") else None)
        pg.on("requestfailed", lambda r: s.errs.append(("reqfail", r.url, r.failure)))
        pg.on("response", lambda r: s.errs.append(("http%d" % r.status, r.url)) if r.status >= 400 else None)
        pg.goto(f"http://127.0.0.1:{s.port}/")
        pg.wait_for_timeout(800)
        return pg
    def close(s):
        try: s.b.close()
        except Exception: pass
        s.srv.terminate()
        s.log = s.srv.stdout.read()
    def report(s):
        print("--- SERVER LOG (tail)\n", s.log[-1500:])
        print("--- BROWSER ERRORS", len(s.errs))
        for e in s.errs: print(e)
