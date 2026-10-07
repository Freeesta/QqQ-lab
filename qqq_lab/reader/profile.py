"""Mass profile of a group of scans: how precisely m/z values are read and compared (pure functions, no I/O).

Thermo FreeStyle ("Default Mass Precision") and Xcalibur ("Global Mass Options") use one setting per analyzer:
decimals FTMS 4, ITMS 2, TQMS 2, SQMS 1; tolerance FTMS 5 ppm, ITMS and TQMS 0.5 u, SQMS 1 u. We take the same idea.

The 3200 QTRAP of the laboratory (unit resolution, no filter string, no resolving power in the file) must keep today's behaviour:
for it (and for everything unknown with a low resolving power) the profile is `LOW`: 1 decimal and the unit window of the XIC.
"""
from __future__ import annotations

from collections import Counter

# Today's behaviour: unit resolution. `dec` is the decimals shown for m/z, `tol` the half width of a "same ion" comparison in Da
# (the XIC itself uses the unit window [n-0.2, n+0.8], see peaks.py / explore.js, not this number).
LOW = {"hr": False, "an": "?", "dec": 1, "tol": 0.5, "unit": "Da"}

# analyzer -> (high resolution, decimals, tolerance, unit)
_TABLE = {
    "FTMS": (True, 4, 5.0, "ppm"),
    "TOFMS": (True, 4, 10.0, "ppm"),
    "ITMS": (False, 2, 0.5, "Da"),
}
RES_HR = 10000          # an unknown analyzer with at least this resolving power is treated as high resolution


def analyzer_from_components(names: list[str]) -> str:
    """Thermo-style analyzer code from the names of the analyzer components of an instrumentConfiguration.

    Two quadrupoles (the QTRAP: Q1, q2 and Q3 as a trap) are a triple quadrupole whatever else is there: it keeps today's behaviour."""
    low = " ".join(n.lower() for n in names)
    n_q = low.count("quadrupole")
    if "orbitrap" in low:
        return "FTMS"
    if "time-of-flight" in low or "time of flight" in low:
        return "TOFMS"
    if n_q >= 2:
        return "TQMS"
    if "ion trap" in low:
        return "ITMS"
    return "SQMS" if n_q else "?"


def mass_profile(scans, min_res: float = RES_HR) -> dict:
    """{"hr", "an", "dec", "tol", "unit"} of a group of scans (objects with `.an` and `.res`; anything missing counts as unknown).

    The analyzer is the most frequent one in the group. Unknown analyzer with a median resolving power >= 10000 -> high resolution
    (4 decimals, 10 ppm). Everything else -> `LOW` (the behaviour of the 3200 QTRAP)."""
    scans = list(scans)
    if not scans:
        return dict(LOW)
    an = Counter(getattr(s, "an", None) or "?" for s in scans).most_common(1)[0][0]
    if an in _TABLE:
        hr, dec, tol, unit = _TABLE[an]
        return {"hr": hr, "an": an, "dec": dec, "tol": tol, "unit": unit}
    res = sorted(r for r in (getattr(s, "res", None) for s in scans) if r)
    if an == "?" and res and res[len(res) // 2] >= min_res:
        return {"hr": True, "an": "?", "dec": 4, "tol": 10.0, "unit": "ppm"}
    return {**LOW, "an": an}


def decimals(profile: dict) -> int:
    return int(profile.get("dec", 1))
