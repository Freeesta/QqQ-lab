"""The Python engine against the golden data of tests/golden/ (see tools/golden.py)."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_golden_controlla():
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "golden.py"), "--controlla"], capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr
