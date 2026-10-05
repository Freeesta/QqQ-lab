#!/usr/bin/env python3
"""Launcher for QqQ lab, used by 'Avvia QqQ lab.command' (Mac) and 'Avvia QqQ lab.bat' (Windows).

It keeps a private environment (.venv-tpfinder) built with the NEWEST Python (>= 3.11) installed on
this computer, then opens the app. This script itself runs with any Python >= 3.8.
- No environment, or a broken one: it is built (needs internet once).
- A newer Python has been installed: the environment is rebuilt with it. The old environment is never
  deleted: it is moved to ../_cestino/ (or next to the project) and put back if the rebuild fails.
- A Python version whose install fails (e.g. numpy not released for it yet) is skipped for 7 days
  (list in .venv-tpfinder.salta), so the app still opens quickly with the previous environment.
  Without a working environment every version is tried again (e.g. the first attempt was offline).
Extra arguments are passed to the app: `python3 scripts/avvia.py app --port 8811`.
"""
from __future__ import annotations

import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".venv-tpfinder"
SKIP = ROOT / ".venv-tpfinder.salta"
MIN = (3, 11)
SKIP_DAYS = 7
WIN = os.name == "nt"
PY_NAME = re.compile(r"python(3(\.\d+)?)?(\.exe)?", re.IGNORECASE)


def say(msg: str) -> None:
    print(msg, flush=True)


def env_python(env: Path = ENV) -> Path:
    return env / ("Scripts/python.exe" if WIN else "bin/python")


def version_of(exe) -> tuple | None:
    """(major, minor) of a Python executable, or None if it does not run."""
    try:
        out = subprocess.run([str(exe), "-c", "import sys; print('%d.%d' % sys.version_info[:2])"],
                             capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    m = re.fullmatch(r"(\d+)\.(\d+)", out.stdout.strip())
    return (int(m[1]), int(m[2])) if out.returncode == 0 and m else None


def _found_executables() -> list[str]:
    names = [f"python3.{m}" for m in range(30, 10, -1)] + ["python3", "python"]
    found = [p for p in (shutil.which(n) for n in names) if p]
    if WIN:
        try:  # the 'py' launcher lists every installed Python with its path
            out = subprocess.run(["py", "-0p"], capture_output=True, text=True, timeout=30).stdout
            found += re.findall(r"([A-Za-z]:\\[^\r\n]*?python\.exe)", out, re.IGNORECASE)
        except (OSError, subprocess.SubprocessError):
            pass
        found += glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python3*\python.exe"))
    else:
        home = str(Path.home())
        for pat in ("/Library/Frameworks/Python.framework/Versions/3.*/bin/python3",
                    "/opt/homebrew/bin/python3*", "/usr/local/bin/python3*",
                    home + "/.pyenv/versions/3.*/bin/python", home + "/.local/bin/python3*",
                    home + "/anaconda3/bin/python", home + "/miniconda3/bin/python",
                    home + "/miniforge3/bin/python", home + "/mambaforge/bin/python"):
            found += glob.glob(pat)
    # keep real interpreters only (not python3.14-config, python3-intel64, ...)
    return [p for p in found if PY_NAME.fullmatch(Path(p).name)]


def _skipped() -> set:
    """Versions whose install failed less than SKIP_DAYS ago."""
    out = set()
    try:
        for line in SKIP.read_text(encoding="utf-8").splitlines():
            ver, _, day = line.partition(" ")
            if date.fromisoformat(day) > date.today() - timedelta(days=SKIP_DAYS):
                out.add(ver)
    except (OSError, ValueError):
        pass
    return out


def _skip(ver: tuple) -> None:
    with SKIP.open("a", encoding="utf-8") as fh:
        fh.write(f"{ver[0]}.{ver[1]} {date.today().isoformat()}\n")


def pythons(use_skip: bool = True) -> list[tuple]:
    """Usable Pythons, newest first: [(version, path), ...]. One path per version. Versions that failed
    recently are left out only when a working environment exists (otherwise everything is retried)."""
    best, skip = {}, (_skipped() if use_skip else set())
    for p in _found_executables():
        real = os.path.realpath(p)
        if ENV.resolve() in Path(real).parents:  # never use our own environment as the base
            continue
        v = version_of(real)
        if v and v >= MIN and f"{v[0]}.{v[1]}" not in skip:
            best.setdefault(v, real)
    return sorted(best.items(), reverse=True)


def env_version() -> tuple | None:
    """Version of the private environment if it works (numpy and tpfinder importable), else None."""
    py = env_python()
    if not py.exists():
        return None
    try:
        ok = subprocess.run([str(py), "-c", "import numpy, tpfinder"], capture_output=True, timeout=60,
                            cwd=tempfile.gettempdir()).returncode == 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    return version_of(py) if ok else None


def archive(path: Path, label: str) -> Path:
    """Move a folder out of the way without deleting it (project rule: never delete files)."""
    base = ROOT.parent / "_cestino" if (ROOT.parent / "_cestino").is_dir() else ROOT
    dest = base / f"{datetime.now():%Y-%m-%d_%H%M%S}_{label}"
    shutil.move(str(path), str(dest))
    return dest


def run(cmd: list) -> bool:
    say("  > " + " ".join(str(c) for c in cmd))
    return subprocess.run([str(c) for c in cmd], cwd=str(ROOT)).returncode == 0


def build(ver: tuple, py: str, old: tuple | None) -> bool:
    """Build the environment with `py`. The previous one is set aside and restored on failure."""
    tag = f"{ver[0]}.{ver[1]}"
    say(f"\nPreparo l'ambiente con Python {tag} ({py}).\nServe internet; ci vuole qualche minuto, solo questa volta.")
    aside = None
    if ENV.exists():
        aside = ROOT / ".venv-tpfinder-precedente"
        if aside.exists():
            archive(aside, "venv-precedente")
        ENV.rename(aside)
    envpy = env_python()
    ok = (run([py, "-m", "venv", ENV])
          and run([envpy, "-m", "pip", "install", "--quiet", "--upgrade", "pip"])
          and run([envpy, "-m", "pip", "install", "--quiet", "-e", "."])
          and env_version() == ver)
    if ok:
        if aside:
            old_tag = f"py{old[0]}.{old[1]}" if old else "non-funzionante"
            say(f"Ambiente precedente spostato in {archive(aside, '.venv-tpfinder-' + old_tag)}")
        return True
    say(f"Installazione con Python {tag} non riuscita: la riprovo tra {SKIP_DAYS} giorni.")
    _skip(ver)
    if ENV.exists():
        archive(ENV, f".venv-tpfinder-py{tag}-fallito")
    if aside:
        aside.rename(ENV)
    return False


def main() -> int:
    os.chdir(ROOT)
    current = env_version()
    for ver, py in pythons(use_skip=current is not None):
        if current and ver <= current:
            break  # the environment already uses the newest Python available
        if build(ver, py, current):
            current = ver
            break
        current = env_version()
    if not current:
        say("\nServe Python 3.11 o piu' recente (consigliato l'ultimo): https://www.python.org/downloads/\n"
            "Installalo e rifai doppio clic. Se Python c'e' gia', controlla la connessione a internet.")
        return 1
    say(f"\nQqQ lab (Python {current[0]}.{current[1]}) si apre nel browser. Per chiuderlo, chiudi questa finestra.")
    cmd = [str(env_python()), "-m", "tpfinder", *(sys.argv[1:] or ["app"])]
    if WIN:
        return subprocess.call(cmd)
    os.execv(cmd[0], cmd)  # replaces this process: closing the window stops the app


if __name__ == "__main__":
    sys.exit(main())
