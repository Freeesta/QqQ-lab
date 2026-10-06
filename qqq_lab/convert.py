"""Conversion of vendor files to mzML with ProteoWizard msconvert, when it is installed.

The SCIEX readers are vendor libraries (Windows) used by msconvert; this program does not contain
them. Without msconvert, give .mzML files or convert them yourself."""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
from pathlib import Path


class ConversionError(RuntimeError):
    pass


def find_msconvert() -> str | None:
    env = os.environ.get("TPFINDER_MSCONVERT")
    if env and Path(env).exists():
        return env
    exe = shutil.which("msconvert")
    if exe:
        return exe
    for pat in (r"C:\Program Files\ProteoWizard\*\msconvert.exe", r"C:\Program Files (x86)\ProteoWizard\*\msconvert.exe",
                os.path.expandvars(r"%LOCALAPPDATA%\Apps\ProteoWizard*\msconvert.exe")):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


def to_mzml(path: Path, extra_args: list[str] | None = None) -> Path:
    """The mzML of a .wiff (or other vendor file), converted once into .qqq_lab-cache next to it."""
    path = Path(path)
    if path.suffix.lower() == ".mzml":
        return path
    out_dir = path.parent / ".qqq_lab-cache"
    out = out_dir / (path.stem + ".mzML")
    if out.exists() and out.stat().st_mtime >= path.stat().st_mtime:
        return out
    exe = find_msconvert()
    if not exe:
        raise ConversionError(
            f"{path.name} needs msconvert (ProteoWizard) to be converted, and it was not found. Install "
            "ProteoWizard once (set TPFINDER_MSCONVERT to msconvert.exe if it is somewhere else), or give "
            "the .mzML file.")
    out_dir.mkdir(exist_ok=True)
    cmd = [exe, str(path), "--mzML", "--zlib", "--64", "-o", str(out_dir), *(extra_args or [])]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not out.exists():
        raise ConversionError(f"msconvert failed for {path.name}: {(r.stderr or r.stdout)[-400:]}")
    return out
