"""Very large and high-resolution profile files: how to recognise them and what to tell the user.

The recipe is the one for Thermo .raw files (ProteoWizard MSConvert); the same text is in the loading screen and in the guide
(web/help.js, key "filegrandi") and, shortened, in web/browser-worker.js.
"""
from __future__ import annotations

import re

from .reader.mzml import Run, _cv, _float

RECIPE = ('msconvert file.raw --mzML --zlib --filter "peakPicking vendor msLevel=1-"  '
          '(per alleggerire: --filter "scanTime [600,1500]" in secondi, --filter "threshold count 300 most-intense")')

TOO_BIG = ("Questo file è troppo grande per la memoria del browser. Riducilo con MSConvert: " + RECIPE)

_HR_MODEL = re.compile(r"orbitrap|exploris|exactive|astral|tof|ft-icr|ltq ft", re.I)


def hr_profile(run: Run) -> bool:
    """True when the first MS1 scan is a PROFILE spectrum of a high-resolution analyzer (Orbitrap, TOF): the heaviest kind of mzML."""
    s = next((x for x in run.scans if x.level == 1), None)
    if s is None or not s.profile:
        return False
    if s.filter.upper().startswith(("FTMS", "TOFMS")):
        return True
    head = run._mm[s.start:s.end].decode("utf-8", "replace")
    head = head[:head.find("<binaryDataArrayList")] if "<binaryDataArrayList" in head else head
    res = _float(_cv(head, "MS:1000800"))
    if res is not None and res >= 10000:
        return True
    try:
        return bool(_HR_MODEL.search(run.metadata().get("instrument", "")))
    except Exception:  # noqa: BLE001 -- an odd header only means "not recognised"
        return False
