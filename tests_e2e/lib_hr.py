"""Helpers of the high-resolution e2e tests (e2e_hr_*): synthetic Orbitrap DDA files and, when they are there, the two real cuttings of the private data repository."""
import sys
from pathlib import Path
import numpy as np
from lib import ROOT, HERE

sys.path.insert(0, str(ROOT / "tools"))
import dati_sintetici as ds  # noqa: E402


def synth(name="hr"):
    """Folder with the three synthetic HR files (Exploris, Fusion, broken) and one Full Scan of the 3200 QTRAP look-alike."""
    d = HERE / "shots" / f"{name}_tmp"; d.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(31)
    ds.hr_dda(d / ds.HR_NAMES["exploris"], rng, "exploris"); ds.hr_dda(d / ds.HR_NAMES["fusion"], rng, "fusion"); ds.hr_dda(d / ds.HR_NAMES["broken"], rng, "exploris", broken=True)
    ds.full_scan(d / "B_FullMass-t0.mzML", 0, np.random.default_rng(2026))
    return d


def real_cuttings():
    """The two real Orbitrap cuttings of QqQ-lab-dati/HRMS (private repository), or []."""
    import verifica
    out = []
    for d in verifica.hrms_dirs():
        out += sorted(d.glob("*.mzML"))
    return [p for p in out if p.stat().st_size < 100e6]


def load(pg, files, wait=6000, n=None, settle=1500):
    """Open files in the start screen of the page and press «Carica dati»; n = number of entries E.files must reach (a DDA file gives two: MS1 and MS2)."""
    pg.set_input_files("#pick", [str(f) for f in files])
    pg.wait_for_function(f"document.querySelectorAll('#flist input[data-k=use]').length>={len(files)}", timeout=180000); pg.wait_for_timeout(300)
    pg.click("text=Carica dati"); pg.wait_for_timeout(wait)
    if n:
        pg.wait_for_function(f"E.files.length>={n}", timeout=90000); pg.wait_for_timeout(1500)
