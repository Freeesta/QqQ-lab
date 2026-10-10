#!/usr/bin/env python3
"""Measures the two engines of the built site in Chromium: Python (Pyodide) and Rust (?motore=rust), on the same files.

For each engine: time to open the files (upload + first TIC drawn), time for the TIC and five XIC of every file (what the
page asks while a student works) and the resident memory of the whole browser (Linux: sum of /proc RSS of the Chromium processes).
It does not interpret the numbers: AGENTS.md / ARCHITETTURA.md decide what they mean. Needs the site (python3 tools/build_site.py)
and, for Rust, site/static/wasm (see .github/workflows/pages.yml). Usage: python3 tools/bench.py [--files N] [--json]
Files: MZLAB_MZML or the usual data folders (tests_e2e/lib.py); Chromium: MZLAB_CHROMIUM = path of an executable, if needed."""
import argparse, json, os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests_e2e"))
from lib import MZ  # noqa: E402

MZS = [200, 250, 300, 364, 400]
GET = """async u => { const t = performance.now(); const r = await fetch(u); await r.json(); return performance.now() - t; }"""


def rss_mb() -> float:
    """Resident memory (MB) of every Chromium process (Linux: /proc; 0 elsewhere). Only the benchmark's browser is running."""
    total = 0
    try:
        for d in Path("/proc").iterdir():
            if d.name.isdigit():
                try:
                    if b"chrom" not in (d / "cmdline").read_bytes()[:400].lower():
                        continue
                    total += int((d / "statm").read_text().split()[1]) * 4096
                except OSError:
                    pass
    except OSError:
        return 0.0
    return round(total / 2**20, 1)


def run(engine: str, files: list[str], port: int) -> dict:
    from playwright.sync_api import sync_playwright
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(ROOT / "site")],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=os.environ.get("MZLAB_CHROMIUM") or None)
            pg = b.new_page()
            t0 = time.perf_counter()
            pg.goto(f"http://127.0.0.1:{port}/?motore={engine}")
            pg.wait_for_selector("#drop", timeout=180000)
            out = {"engine": engine, "start_s": round(time.perf_counter() - t0, 2)}
            t1 = time.perf_counter()
            pg.set_input_files("#pick", files)
            pg.wait_for_function(f"document.querySelectorAll('#flist input[data-k=use]').length >= {len(files)}", timeout=300000)
            pg.click("#opbtn")
            pg.wait_for_selector(".pnl.chrom canvas", timeout=300000)
            if engine == "rust":
                pg.wait_for_function("window.MZLAB_RUST.stats.rust > 0", timeout=120000)
            out["open_s"] = round(time.perf_counter() - t1, 2)
            n = pg.evaluate("E.files.length")
            t2 = time.perf_counter()
            for k in range(n):
                pg.evaluate(GET, f"api/chrom?k={k}&kind=tic&level=1")
                for mz in MZS:
                    pg.evaluate(GET, f"api/xic?k={k}&mz={mz}&tol=0.35&level=1")
            out["tic_xic_s"] = round(time.perf_counter() - t2, 2)
            out["requests"] = n * (1 + len(MZS))
            if engine == "rust":
                out["served_by_rust"] = pg.evaluate("window.MZLAB_RUST.stats.rust")
            out["browser_rss_mb"] = rss_mb()
            b.close()
            return out
    finally:
        srv.terminate()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--files", type=int, default=4, help="how many Full Scan files to open")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if not (ROOT / "site" / "index.html").exists():
        sys.exit("site/ missing: python3 tools/build_site.py")
    names = sorted(p for p in Path(MZ).glob("*FullMass*.mzML"))[:a.files]
    if not names:
        sys.exit("no Full Scan files found (MZLAB_MZML)")
    rows = [run(e, [str(x) for x in names], 8840 + i) for i, e in enumerate(("python", "rust"))]
    if a.json:
        print(json.dumps(rows))
        return
    keys = ["engine", "start_s", "open_s", "tic_xic_s", "requests", "browser_rss_mb"]
    print(f"{len(names)} files, MB total: {sum(x.stat().st_size for x in names) / 2**20:.1f}")
    print("| " + " | ".join(keys) + " |\n|" + "---|" * len(keys))
    for r in rows:
        print("| " + " | ".join(str(r.get(k, "")) for k in keys) + " |")


if __name__ == "__main__":
    main()
