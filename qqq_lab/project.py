"""Guess label, treatment time, type (sample | blank | standard) and concentration from a file name."""
from __future__ import annotations

import re
from pathlib import Path

# concentration units found in file names (separators removed, lower case) -> factor that converts them to mg/L
UNITS_MGL = {"mgl": 1.0, "ppm": 1.0, "gl": 1000.0, "ugl": 1e-3, "ppb": 1e-3, "ngml": 1e-3, "ngl": 1e-6, "ppt": 1e-6}
_NUM = r"\d+(?:[.,p]\d+)?"
_UNIT = r"(ppm|ppb|ppt|[mun]?g[/_.\- ]?(?:m?l)(?:-1)?)"
_STD = r"(^|[_\-\s])(std|stds|standard|stand|cal|calib|calibr|calibrazione|taratura|curva)(?=[_\-\s\d]|$)"


def _num(s: str) -> float:
    return float(s.replace("p", ".").replace(",", "."))


def guess_conc(name: str) -> tuple[float, str | None] | None:
    """(value, unit key of UNITS_MGL) read from a file name such as 'std_0.5ppm', 'STD10mgL', '5_ug-L'; the unit is None
    when only a number follows a standard word ('std_5'). None when no concentration is written."""
    low = Path(name).stem.lower().replace("\u00b5", "u").replace("\u03bc", "u")
    m = re.search(r"(?<![\d.])(" + _NUM + r")\s*[_\-]?\s*" + _UNIT + r"(?![a-z])", low)
    if m:
        u = re.sub(r"[/_.\- ]|-1$", "", m.group(2))
        if u in UNITS_MGL:
            return _num(m.group(1)), u
    m = re.search(_STD + r"[_\-\s]*(" + _NUM + r")(?!\d)", low)
    if m:
        return _num(m.group(3)), None
    return None


def guess_sample(name: str) -> tuple[str, float | None, str]:
    """(label, time in minutes, type) guessed from a file name: 'blank', 'std_5', 't30', '120min', '2h'."""
    base = Path(name).stem
    low = base.lower()
    if re.search(r"(^|[_\-\s])(blank|blk|bianco)([_\-\s\d]|$)", low):
        return base, None, "blank"
    if re.search(_STD, low) or (guess_conc(name) and not re.search(r"(^|[_\-\s])t\d", low)):
        return base, None, "standard"
    m = re.search(r"(?:^|[_\-\s])t?(\d+(?:[.,]\d+)?)\s*(min|m|h|ore)?(?:[_\-\s]|$)", low)
    if m:
        v = float(m.group(1).replace(",", "."))
        if m.group(2) in ("h", "ore"):
            v *= 60
        return base, v, "sample"
    return base, None, "sample"
