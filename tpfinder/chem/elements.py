"""Monoisotopic masses, formulas and adducts. Plain Python, no dependencies."""
from __future__ import annotations

import re

MASS = {
    "H": 1.00782503223, "C": 12.0, "N": 14.00307400443, "O": 15.99491461957, "F": 18.99840316273,
    "P": 30.97376199842, "S": 31.9720711744, "Cl": 34.968852682, "Br": 78.9183376, "I": 126.9044719,
    "Na": 22.989769282, "K": 38.9637064, "Si": 27.9769265350, "Se": 79.9165218,
}
ELECTRON = 0.000548579909
PROTON = MASS["H"] - ELECTRON

# ion m/z = neutral mass + ADDUCT_SHIFT[adduct]; the sign of the charge follows the adduct
ADDUCT_SHIFT = {
    "[M+H]+": MASS["H"] - ELECTRON,
    "[M+Na]+": MASS["Na"] - ELECTRON,
    "[M+NH4]+": MASS["N"] + 4 * MASS["H"] - ELECTRON,
    "[M-H]-": -MASS["H"] + ELECTRON,
    "[M+Cl]-": MASS["Cl"] + ELECTRON,
    "[M+HCOO]-": MASS["C"] + MASS["H"] + 2 * MASS["O"] + ELECTRON,
}
POLARITY_OF = {a: (1 if a.endswith("+") else -1) for a in ADDUCT_SHIFT}
DEFAULT_ADDUCT = {"positive": "[M+H]+", "negative": "[M-H]-"}

_TOKEN = re.compile(r"([A-Z][a-z]?)(\d*)")


def parse_formula(s: str) -> dict[str, int]:
    """'C15H12N2O' -> {'C': 15, 'H': 12, 'N': 2, 'O': 1}. Parentheses are allowed: 'C(OH)2'."""
    s = re.sub(r"\s+", "", s or "")
    if not s:
        raise ValueError("empty formula")
    stack: list[dict[str, int]] = [{}]
    pos = 0
    tok = re.compile(r"([A-Z][a-z]?)(\d*)|(\()|\)(\d*)")
    while pos < len(s):
        m = tok.match(s, pos)
        if not m:
            raise ValueError(f"cannot read the formula {s!r}")
        if m.group(1):
            el = m.group(1)
            if el not in MASS:
                raise ValueError(f"unknown element {el!r} in {s!r}")
            stack[-1][el] = stack[-1].get(el, 0) + (int(m.group(2)) if m.group(2) else 1)
        elif m.group(3):
            stack.append({})
        else:
            if len(stack) < 2:
                raise ValueError(f"unbalanced parentheses in {s!r}")
            inner = stack.pop()
            k = int(m.group(4)) if m.group(4) else 1
            for el, n in inner.items():
                stack[-1][el] = stack[-1].get(el, 0) + n * k
        pos = m.end()
    if len(stack) != 1 or not stack[0]:
        raise ValueError(f"cannot read the formula {s!r}")
    return stack[0]


def round_half_up(x: float, digits: int = 0) -> float:
    """Round half up (not banker's rounding): 364.05 -> 364.1, 200.5 -> 201."""
    from decimal import Decimal, ROUND_HALF_UP
    q = Decimal(1).scaleb(-digits)
    return float(Decimal(repr(round(x, 9))).quantize(q, rounding=ROUND_HALF_UP))


def formula_mz(formula: str, adduct: str | None = None) -> dict:
    """Formula -> neutral mass and ion m/z, exact, at 1 decimal (unit-resolution instrument) and nominal (integer)."""
    f = parse_formula(formula)
    m = mass(f)
    rows = {}
    for a in ADDUCT_SHIFT:
        z = ion_mz(m, a)
        rows[a] = {"mz": round(z, 4), "mz1": round_half_up(z, 1), "nominal": int(round_half_up(z, 0))}
    out = {"formula": fmt(f), "neutral": round(m, 4), "nominal_neutral": int(round_half_up(m, 0)), "adducts": rows}
    if adduct:
        if adduct not in ADDUCT_SHIFT:
            raise ValueError(f"unknown adduct {adduct!r}")
        out["adduct"] = adduct
        out.update(rows[adduct])
    return out


def parse_delta(s: str) -> dict[str, int]:
    """A formula change: '+O', '-H2', '-Cl+H', '+C2H4O'. Returns signed counts (zeros removed)."""
    s = s.replace(" ", "")
    if not s or s[0] not in "+-":
        s = "+" + s
    out: dict[str, int] = {}
    for sign, body in re.findall(r"([+-])([A-Za-z0-9]+)", s):
        for el, n in parse_formula(body).items():
            out[el] = out.get(el, 0) + (n if sign == "+" else -n)
    return {k: v for k, v in out.items() if v}


def mass(f: dict[str, int]) -> float:
    return sum(MASS[e] * n for e, n in f.items())


def add(a: dict[str, int], b: dict[str, int]) -> dict[str, int]:
    out = dict(a)
    for e, n in b.items():
        out[e] = out.get(e, 0) + n
    return {k: v for k, v in out.items() if v}


def fmt(f: dict[str, int]) -> str:
    """Hill order: C, H, then alphabetical."""
    order = [e for e in ("C", "H") if e in f] + sorted(e for e in f if e not in ("C", "H"))
    return "".join(e + (str(f[e]) if f[e] != 1 else "") for e in order if f[e])


def fmt_delta(f: dict[str, int]) -> str:
    return "".join(("+" if n > 0 else "-") + e + (str(abs(n)) if abs(n) != 1 else "") for e, n in sorted(f.items()))


def ion_mz(neutral: float, adduct: str) -> float:
    return neutral + ADDUCT_SHIFT[adduct]
