"""Guess label, treatment time and type (sample | blank | control) from a file name."""
from __future__ import annotations

import re
from pathlib import Path


def guess_sample(name: str) -> tuple[str, float | None, str]:
    """(label, time in minutes, type) guessed from a file name: 'blank', 't30', '120min', '2h'."""
    base = Path(name).stem
    low = base.lower()
    if re.search(r"(^|[_\-\s])(blank|blk|bianco)([_\-\s\d]|$)", low):
        return base, None, "blank"
    if re.search(r"(^|[_\-\s])(control|ctrl|dark|buio)([_\-\s\d]|$)", low):
        return base, None, "control"
    m = re.search(r"(?:^|[_\-\s])t?(\d+(?:[.,]\d+)?)\s*(min|m|h|ore)?(?:[_\-\s]|$)", low)
    if m:
        v = float(m.group(1).replace(",", "."))
        if m.group(2) in ("h", "ore"):
            v *= 60
        return base, v, "sample"
    return base, None, "sample"
