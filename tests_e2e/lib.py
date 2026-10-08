import os, subprocess, time, sys, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
# The page has a CSP without unsafe-eval: Playwright's wait_for_function evaluates strings with eval, so it is replaced by a polling version that
# goes through page.evaluate (CDP, not blocked). Same signature for the cases used in the tests (expression string, timeout).
def _wff(self, expression, arg=None, polling=None, timeout=30000):
    import time
    t0 = time.time()
    while True:
        try:
            v = self.evaluate("(() => { return (" + expression + "); })()") if isinstance(expression, str) and not expression.strip().startswith(("()", "function")) else self.evaluate(expression, arg)
            if v: return v
        except Exception as e:
            if "Execution context was destroyed" not in str(e) and "Target" not in str(e): last = e
        if (time.time() - t0) * 1000 > timeout: raise TimeoutError("wait_for_function: " + str(expression)[:120])
        self.wait_for_timeout(100)
from playwright.sync_api import Page as _Page
_Page.wait_for_function = _wff
# Browser of the tests: QQQ_BROWSER=chromium (default) | firefox | webkit (the engine of Safari); tools/verifica.py --browser sets it.
# Every script asks for `p.chromium`: here it is pointed at the chosen browser, so no test has to change.
BROWSER = os.environ.get("QQQ_BROWSER", "chromium")
if BROWSER != "chromium":
    from playwright.sync_api import Playwright as _PW
    _PW.chromium = property(lambda self: getattr(self, BROWSER))
FILES = ["B_FullMass-t0", "B_FullMass-t15", "B_FullMass-t60", "B_MS2-t15", "B_MRM-t0"]
# Paths are relative to this folder: code = parent of tests_e2e, mzML = ../esempio_conversione/mzml (or $QQQ_MZML)
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MZ = Path(os.environ.get("QQQ_MZML", ROOT.parent / "esempio_conversione" / "mzml"))
DAM = Path(os.environ.get("QQQ_DAM", ROOT.parent / "QqQ" / "Metodi inquinanti" / "Lab_inq_FullMass_pos_max480.dam"))   # a lab method (not in git)
SH = str(HERE / "shots") + "/"
os.makedirs(SH, exist_ok=True)
def mz(f): return str(MZ / f"{f}.mzML")
def free_port() -> int:
    import socket
    with socket.socket() as so:
        so.bind(("127.0.0.1", 0)); return so.getsockname()[1]
# tools/verifica.py runs several tests at once (QQQ_E2E_PARALLEL=1): then every Run takes a free port and its own work folder,
# because a few tests share the fixed ones (they were written to run one after the other)
PARALLEL = os.environ.get("QQQ_E2E_PARALLEL") == "1"
class Run:
    def __init__(s, port=8811, wd="/tmp/wd1", fresh=True, extra=()):
        if PARALLEL:
            port = free_port(); wd = f"{wd}_{port}"
        s.port, s.wd, s.errs = port, wd, []
        if fresh: shutil.rmtree(wd, ignore_errors=True)
        s.srv = subprocess.Popen([sys.executable, str(ROOT / "tools" / "dev_server.py"), "--workdir", wd, "--port", str(port), *extra],
                                 cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        # ready as soon as the server answers (it was a fixed 2 s wait)
        import urllib.request
        t0 = time.time()
        while time.time() - t0 < 15:
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1).read(); break
            except Exception:
                time.sleep(0.1)
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
    def teoria(s, pg, name="00-uso.html", wait=800):
        """Text of a Teoria chapter, opened in a second tab of the same browser."""
        q = s.b.new_page(); q.goto(f"http://127.0.0.1:{s.port}/static/teoria/{name}"); q.wait_for_timeout(wait)
        t = q.inner_text("body"); q.close(); return t
    def close(s):
        try: s.b.close()
        except Exception: pass
        s.srv.terminate()
        s.log = s.srv.stdout.read()
    def report(s):
        print("--- SERVER LOG (tail)\n", s.log[-1500:])
        print("--- BROWSER ERRORS", len(s.errs))
        for e in s.errs: print(e)

# ---- .xlsx reading without libraries (zip + XML), plus openpyxl as a second opinion when it is installed
def xlsx_rows(path, n=1):
    """Rows of worksheet n as lists of ('n', float) | ('s', text) | None, read straight from xl/worksheets/sheetN.xml."""
    import zipfile, re
    import xml.etree.ElementTree as ET
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    z = zipfile.ZipFile(path); assert z.testzip() is None
    root = ET.fromstring(z.read(f"xl/worksheets/sheet{n}.xml")); rows = []
    for r in root.iter("{%s}row" % ns["m"]):
        row = {}
        for c in r.findall("m:c", ns):
            col = 0
            for ch in re.match(r"[A-Z]+", c.get("r")).group(): col = col * 26 + ord(ch) - 64
            if c.get("t") == "inlineStr": row[col - 1] = ("s", "".join(t.text or "" for t in c.iter("{%s}t" % ns["m"])))
            else:
                v = c.find("m:v", ns); row[col - 1] = ("n", float(v.text)) if v is not None else None
        rows.append([row.get(i) for i in range(max(row) + 1)] if row else [])
    return rows
def xlsx_sheets(path):
    import zipfile, re
    z = zipfile.ZipFile(path); return re.findall(r'<sheet name="([^"]*)"', z.read("xl/workbook.xml").decode("utf-8"))
def xlsx_openpyxl(path):
    try: import openpyxl
    except ImportError: return None
    import shutil, tempfile
    tmp = os.path.join(tempfile.mkdtemp(), "t.xlsx"); shutil.copy(path, tmp)      # downloads have no extension, openpyxl wants one
    return openpyxl.load_workbook(tmp, data_only=True)
