"""One command that checks the whole program and prints a SHORT summary (made to save the reader's time and tokens).

    python3 tools/verifica.py                 # everything: JS syntax, pytest, every e2e that can run here
    python3 tools/verifica.py --rapida        # JS syntax + pytest + the e2e smoke test (e2e3): ~2 minutes
    python3 tools/verifica.py --solo e2e6,e2e18
    python3 tools/verifica.py --setup         # first install what is missing (pytest, playwright + chromium), then check

Data, in this order: QQQ_MZML; the PRIVATE data repository "QqQ-lab-dati" (Freeesta/QqQ-lab-dati: mzML/ + dam/, real lab
files; found by itself next to this repository, in a parent folder, in the home or in /workspace, or with QQQ_DATI=<path>);
Federico's Mac folders (../Data/mzML); otherwise synthetic look-alikes written by tools/dati_sintetici.py into
.verifica/dati_sintetici/ (then the summary says "sintetici": a pass on synthetic data is weaker than on real data).
Some e2e only make sense with the real data or with a .dam method (QQQ_DAM): they are reported as SKIP, with why.

Output: one line per check on stdout (OK / FAIL / SKIP, seconds, first error lines), the same summary in
.verifica/ultimo.md, and the full output of every check in .verifica/log/<name>.log. Read the logs only for a FAIL.
Exit code 0 only if nothing failed. `.verifica/` is not committed (.gitignore).
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".verifica"
LOG = OUT / "log"
E2E = ROOT / "tests_e2e"

# What each e2e needs besides a browser. "veri" = the asserts depend on the real lab data (skipped with synthetic data);
# "dam" = needs a .dam method file (QQQ_DAM); "sito" = builds the static site with Pyodide (network to jsDelivr or PYODIDE_DIR);
# "crypto" = needs the 'cryptography' package. Keep this table up to date when you add an e2e (default: no needs).
NEEDS: dict[str, set[str]] = {
    "e2e9": {"dam"}, "e2e10": {"dam"}, "e2e15": {"dam"},
    "e2e13": {"sito"}, "e2e_tpmine1": {"sito", "crypto"}, "e2e_tpmine2": {"sito", "crypto"},
}
NOT_TESTS = {"lib", "lat_arrows", "make_examples"}          # helpers and measurements, not tests
SMOKE = ["e2e3"]
# Console messages that are known and harmless (not counted as browser errors).
BENIGN = [r"allow-scripts and allow-same-origin", r"/api/(ping|bye|live)", r"ERR_ABORTED"]   # aborted requests = page reloaded or closed by the test


def sh(cmd, log: Path, timeout: int, env=None, cwd=ROOT) -> tuple[int, str, float]:
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
        out, rc = (p.stdout or "") + (p.stderr or ""), p.returncode
    except subprocess.TimeoutExpired as e:
        out, rc = f"{(e.stdout or b'').decode('utf-8', 'replace') if isinstance(e.stdout, bytes) else (e.stdout or '')}\nTIMEOUT dopo {timeout} s", 124
    except FileNotFoundError as e:
        out, rc = f"comando non trovato: {e}", 127
    log.write_text(out, encoding="utf-8")
    return rc, out, time.time() - t0


def has(mod: str) -> bool:
    return subprocess.run([sys.executable, "-c", f"import {mod}"], capture_output=True).returncode == 0


def setup() -> None:
    pip = [sys.executable, "-m", "pip", "install", "-q"]
    for extra in ([], ["--break-system-packages"]):
        if subprocess.run(pip + extra + ["pytest", "playwright", "numpy"], capture_output=True).returncode == 0:
            break
    if has("playwright"):
        subprocess.run([sys.executable, "-m", "playwright", "install", "--with-deps", "chromium"], capture_output=True)
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], capture_output=True)


def browser_ok() -> bool:
    if not has("playwright"):
        return False
    code = "from playwright.sync_api import sync_playwright\nwith sync_playwright() as p: p.chromium.launch().close()"
    return subprocess.run([sys.executable, "-c", code], capture_output=True, timeout=120).returncode == 0


def js_syntax(results) -> None:
    web = ROOT / "qqq_lab" / "web"
    tmp = OUT / "js"; tmp.mkdir(parents=True, exist_ok=True)
    if not shutil.which("node"):
        results.append(("sintassi JS", "SKIP", 0, ["node non installato"])); return
    t0, errs = time.time(), []
    files = [f for f in web.glob("*.js") if f.name not in ("elements.js",)] + list((web / "teoria").glob("*.js"))
    for f in files:
        src = f
        if f.name in ("browser-worker.js", "draw.js", "sw.js"):        # module-style files: checked as .mjs (as the CI does)
            src = tmp / (f.stem + ".mjs"); shutil.copy(f, src)
        p = subprocess.run(["node", "--check", str(src)], capture_output=True, text=True)
        if p.returncode:
            errs.append(f"{f.relative_to(ROOT)}: " + (p.stderr.strip().splitlines() or ["?"])[-1])
    html = (web / "index.html").read_text(encoding="utf-8")
    inline = "\n".join(re.findall(r"<script>(.*?)</script>", html, re.S))
    page = tmp / "page.js"; page.write_text((web / "explore.js").read_text(encoding="utf-8") + "\n" + inline, encoding="utf-8")
    p = subprocess.run(["node", "--check", str(page)], capture_output=True, text=True)
    if p.returncode:
        errs.append("explore.js + script inline di index.html: " + (p.stderr.strip().splitlines() or ["?"])[-1])
    (LOG / "sintassi_js.log").write_text("\n".join(errs) or "ok", encoding="utf-8")
    results.append(("sintassi JS", "FAIL" if errs else "OK", time.time() - t0, errs[:5]))


def pytest(results, timeout) -> None:
    if not has("pytest"):
        results.append(("pytest", "SKIP", 0, ["pytest non installato: python3 tools/verifica.py --setup"])); return
    rc, out, dt = sh([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests"], LOG / "pytest.log", timeout)
    last = [l for l in out.strip().splitlines() if re.search(r"passed|failed|error", l)][-1:] or out.strip().splitlines()[-1:]
    fails = [l for l in out.splitlines() if l.startswith(("FAILED", "ERROR"))][:6]
    results.append(("pytest", "OK" if rc == 0 else "FAIL", dt, (fails or []) + last if rc else last))
    priv = ROOT / "QqQ_lab_privato" / "tpmine"
    if (priv / "tests").is_dir():
        env = dict(os.environ, PYTHONPATH=f"{ROOT}{os.pathsep}{priv / 'py'}")
        rc, out, dt = sh([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", str(priv / "tests")], LOG / "pytest_tpmine.log", timeout, env=env)
        last = out.strip().splitlines()[-1:] if out.strip() else []
        fails = [l for l in out.splitlines() if l.startswith(("FAILED", "ERROR"))][:4]
        results.append(("pytest TP Mine", "OK" if rc == 0 else "FAIL", dt, fails + last if rc else last))


def dati_repo() -> Path | None:
    """The private data repository QqQ-lab-dati (real lab files: mzML/ and dam/), wherever it was cloned."""
    env = os.environ.get("QQQ_DATI")
    cands = [Path(env)] if env else []
    for base in (ROOT.parent, ROOT.parent.parent, Path.home(), Path("/workspace"), Path("/workspaces"), Path("/repos"), Path("/tmp")):
        cands += [base / "QqQ-lab-dati", base / "Data" / "QqQ-lab-dati"]
        try:
            cands += sorted(base.glob("*/QqQ-lab-dati"))
        except OSError:
            pass
    return next((c for c in cands if (c / "mzML" / "B_FullMass-t0.mzML").exists()), None)


def data_dir() -> tuple[Path, str]:
    """Real lab mzML if found (QQQ_MZML, the data repository, the Mac folders), otherwise synthetic look-alikes."""
    repo = dati_repo()
    for cand in (os.environ.get("QQQ_MZML"), repo / "mzML" if repo else None, ROOT.parent / "Data" / "mzML",
                 ROOT.parent / "esempio_conversione" / "mzml"):
        if cand and (Path(cand) / "B_FullMass-t0.mzML").exists():
            return Path(cand), "veri"
    syn = OUT / "dati_sintetici"
    if not (syn / "B_FullMass-t0.mzML").exists():
        sys.path.insert(0, str(ROOT / "tools"))
        import dati_sintetici
        dati_sintetici.make(syn)
    return syn, "sintetici"


def dam_file() -> Path | None:
    repo = dati_repo()
    name = "Lab_inq_FullMass_pos_max480.dam"            # e2e15 also wants Lab_inq_MRM_Flufe.dam in the same folder
    for cand in (os.environ.get("QQQ_DAM"), repo / "dam" / name if repo else None, ROOT.parent / "Data" / "dam - Metodi" / name,
                 ROOT.parent / "QqQ" / "Metodi inquinanti" / name):
        if cand and Path(cand).exists():
            return Path(cand)
    return None


def judge(out: str, rc: int) -> list[str]:
    """Problems found in an e2e output: failed steps, Python errors, real browser errors."""
    probs = []
    for l in out.splitlines():
        s = l.strip()
        if re.search(r"['\"]FAIL|^FAIL\b|\bFAIL ", s) or s.startswith(("Traceback", "AssertionError", "TimeoutError", "TIMEOUT")):
            probs.append(s[:220])
    m = re.search(r"BROWSER ERRORS (\d+)\n(.*?)(?:\n\S|\Z)", out, re.S)
    if m and int(m.group(1)):
        errs = [e for e in out[m.end(1):].splitlines()[1:int(m.group(1)) + 1] if e.strip() and not any(re.search(b, e) for b in BENIGN)]
        probs += ["errore del browser: " + e.strip()[:200] for e in errs]
    if rc and not probs:
        probs.append(f"uscita con codice {rc}: " + (out.strip().splitlines() or [""])[-1][:200])
    return probs


def e2e(results, only, timeout, kind) -> None:
    names = sorted(p.stem for p in E2E.glob("e2e*.py") if p.stem not in NOT_TESTS)
    if only:
        names = [n for n in names if n in only]
    if not browser_ok():
        results.append(("e2e", "SKIP", 0, ["Playwright/Chromium non disponibili: python3 tools/verifica.py --setup"])); return
    mz, src = data_dir()
    dam = dam_file()
    env = dict(os.environ, QQQ_MZML=str(mz), PYTHONUNBUFFERED="1")
    if dam:
        env["QQQ_DAM"] = str(dam)
    crypto = has("cryptography")
    for n in names:
        need = NEEDS.get(n, set())
        why = ("serve un file .dam (QQQ_DAM)" if "dam" in need and not dam else
               "solo con i dati veri del laboratorio" if "veri" in need and src != "veri" else
               "serve il pacchetto cryptography" if "crypto" in need and not crypto else
               "costruisce il sito con Pyodide: lancialo a parte (--solo)" if "sito" in need and not only else "")
        if why:
            results.append((n, "SKIP", 0, [why])); continue
        rc, out, dt = sh([sys.executable, str(E2E / f"{n}.py")], LOG / f"{n}.log", timeout, env=env, cwd=ROOT)
        probs = judge(out, rc)
        results.append((n, "FAIL" if probs else "OK", dt, probs[:4]))
    results.append(("dati usati per gli e2e", "INFO", 0, [f"{src}: {mz}" + (f" · .dam: {dam.name}" if dam else " · nessun .dam")]))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rapida", action="store_true", help="sintassi + pytest + e2e3")
    ap.add_argument("--solo", default="", help="solo questi e2e, separati da virgola (es. e2e6,e2e18)")
    ap.add_argument("--senza-e2e", action="store_true")
    ap.add_argument("--setup", action="store_true", help="installa pytest, playwright e chromium se mancano")
    ap.add_argument("--timeout", type=int, default=600, help="secondi per ogni e2e (predefinito 600)")
    a = ap.parse_args()
    LOG.mkdir(parents=True, exist_ok=True)
    if a.setup:
        setup()
    results: list = []
    t0 = time.time()
    js_syntax(results)
    pytest(results, 1200)
    if not a.senza_e2e:
        only = {s.strip().removesuffix(".py") for s in a.solo.split(",") if s.strip()} or (set(SMOKE) if a.rapida else set())
        e2e(results, only, a.timeout, "")
    fails = [r for r in results if r[1] == "FAIL"]
    lines = [f"# Verifica QqQ lab ({time.strftime('%Y-%m-%d %H:%M')}, {time.time() - t0:.0f} s): "
             + ("TUTTO OK" if not fails else f"{len(fails)} FAIL"), ""]
    for name, st, dt, notes in results:
        lines.append(f"- {st:4} {name}" + (f" ({dt:.0f} s)" if dt else "") + (": " + " | ".join(notes) if notes and st != "OK" else ""))
    lines += ["", "Log completi: .verifica/log/<nome>.log (leggili solo per i FAIL)."]
    text = "\n".join(lines)
    (OUT / "ultimo.md").write_text(text + "\n", encoding="utf-8")
    print(text)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
