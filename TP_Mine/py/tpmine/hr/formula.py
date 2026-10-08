# TPMINE-PRIVATE
"""Vectorised molecular-formula assignment for high-resolution MS (WP3): enumeration of the formulas below a limit vector, ion masses,
RDBE, electron parity, assignment with searchsorted, sub-formula constraint, ppm recalibration. numpy only; no Python loops on peaks."""
from __future__ import annotations

import re

import numpy as np

from qqq_lab.chem import elements as E

# valences used for the RDBE (C4 H1 N3 O2 S2; halogens 1; P3)
VALENCE = {"C": 4, "H": 1, "N": 3, "O": 2, "S": 2, "P": 3, "F": 1, "Cl": 1, "Br": 1, "I": 1}
HALOGENS = ("F", "Cl", "Br", "I")
ELECTRON = E.ELECTRON


def element_order(*formulas: dict) -> list[str]:
    """C, H first, then the other elements present (N, O, S, P, halogens in a fixed order); at least C, H, N, O, S."""
    present = {"C", "H", "N", "O", "S"}
    for f in formulas:
        present |= set(f)
    for el in present:
        if el not in VALENCE or el not in E.MASS:
            raise ValueError(f"elemento non supportato nella modalità alta risoluzione: {el}")
    return [e for e in ("C", "H", "N", "O", "S", "P", "F", "Cl", "Br", "I") if e in present]


def vec(f: dict | str, els: list[str]) -> np.ndarray:
    """Element-count vector (int) of a formula given as a dict or a string."""
    if isinstance(f, str):
        f = E.parse_formula(f)
    return np.array([int(f.get(e, 0)) for e in els], dtype=np.int64)


def fmt(v, els: list[str]) -> str:
    return "".join(f"{e}{n if n != 1 else ''}" for e, n in zip(els, np.asarray(v).tolist()) if n)


def ion_mass(G, els: list[str]):
    """m/z of the singly charged cation(s) with this element composition (the formula is the ion's, H included)."""
    m = np.array([E.MASS[e] for e in els])
    return np.asarray(G) @ m - ELECTRON


def rdbe(G, els: list[str]):
    """Rings plus double bonds of the ion formula, 1 + sum n(v - 2)/2: half-integer for an even-electron cation, integer for a radical cation."""
    v = np.array([VALENCE[e] for e in els])
    return 1.0 + 0.5 * (np.asarray(G) * (v - 2)).sum(-1)


def closed_shell(G, els: list[str]):
    """True when the ion has an even number of electrons: (H + N + P + halogens) odd for a cation."""
    G = np.asarray(G)
    odd = [i for i, e in enumerate(els) if e in ("H", "N", "P") or e in HALOGENS]
    return (G[..., odd].sum(-1) % 2) == 1


class FormulaSpace:
    """All formulas with 0 <= n_i <= upper_i (and the chemical filters below), sorted by ion m/z.

    upper: element-count vector. h_rule: H + halogens <= 2C + N + 3 (formulas of a transformation product; not for fragments, whose
    limit is the precursor itself). min_rdbe: lowest RDBE kept (-0.5 keeps the even-electron cations); closed_only keeps only those."""

    def __init__(self, upper, els: list[str], h_rule: bool = False, min_rdbe: float = -0.5, max_rdbe: float | None = None, need_carbon: bool = True,
                 closed_only: bool = False):
        self.els = list(els)
        upper = np.asarray(upper, dtype=np.int64)
        grids = np.meshgrid(*[np.arange(u + 1) for u in upper], indexing="ij")
        G = np.stack([g.ravel() for g in grids], axis=1).astype(np.int64)
        iC, iH = self.els.index("C"), self.els.index("H")
        ok = np.ones(len(G), bool)
        if need_carbon:
            ok &= G[:, iC] > 0
        if h_rule:
            hal = [i for i, e in enumerate(self.els) if e in HALOGENS]
            iN = self.els.index("N")
            ok &= G[:, iH] + (G[:, hal].sum(1) if hal else 0) <= 2 * G[:, iC] + G[:, iN] + 3
        r = rdbe(G, self.els)
        ok &= r >= min_rdbe
        if max_rdbe is not None:
            ok &= r <= max_rdbe
        if closed_only:
            ok &= closed_shell(G, self.els)
        G = G[ok]
        mass = ion_mass(G, self.els)
        o = np.argsort(mass, kind="stable")
        self.G, self.mass = G[o], mass[o]
        self.rdbe = rdbe(self.G, self.els)
        self.closed = closed_shell(self.G, self.els)

    def __len__(self):
        return len(self.mass)

    def window(self, mz, ppm: float = 5.0, abs_da: float = 0.0):
        """(start, stop) of the sorted formulas within max(ppm, abs_da) of every m/z (arrays)."""
        mz = np.atleast_1d(np.asarray(mz, float))
        tol = np.maximum(mz * ppm * 1e-6, abs_da)
        return np.searchsorted(self.mass, mz - tol, "left"), np.searchsorted(self.mass, mz + tol, "right")

    def candidates(self, mz: float, ppm: float = 5.0, abs_da: float = 0.0, within=None) -> np.ndarray:
        """Indices of the formulas within tolerance of one m/z, best (smallest |error|) first; `within` = element vector they must be a sub-formula of."""
        a, b = self.window(mz, ppm, abs_da)
        idx = np.arange(a[0], b[0])
        if within is not None and len(idx):
            idx = idx[np.all(self.G[idx] <= np.asarray(within), axis=1)]
        return idx[np.argsort(np.abs(self.mass[idx] - mz), kind="stable")]

    def count(self, mz, ppm: float = 5.0, abs_da: float = 0.0, within=None) -> np.ndarray:
        """Number of candidate formulas for each m/z (vectorised; `within` filters by sub-formula for a whole batch)."""
        a, b = self.window(mz, ppm, abs_da)
        if within is None:
            return b - a
        n = b - a
        flat = np.repeat(np.arange(len(a)), n)
        pos = np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n) + np.repeat(a, n)
        ok = np.all(self.G[pos] <= np.asarray(within), axis=1)
        return np.bincount(flat[ok], minlength=len(a))

    def error_ppm(self, mz, idx) -> np.ndarray:
        return (np.asarray(mz, float) - self.mass[idx]) / self.mass[idx] * 1e6


def tolerance(mz, ppm: float = 5.0, abs_da: float = 0.002):
    """Fragment tolerance: max(ppm, abs_da) (criterion of the reference paper: 5 ppm or 2 mDa, the larger)."""
    return np.maximum(np.asarray(mz, float) * ppm * 1e-6, abs_da)


class Calibration:
    """Systematic m/z error in ppm as a line of m/z: err(mz) = a + b (mz - mz0). `apply` removes it."""

    def __init__(self, a: float = 0.0, b: float = 0.0, mz0: float = 200.0, n: int = 0):
        self.a, self.b, self.mz0, self.n = float(a), float(b), float(mz0), int(n)

    def error(self, mz):
        return self.a + self.b * (np.asarray(mz, float) - self.mz0)

    def apply(self, mz):
        mz = np.asarray(mz, float)
        return mz / (1.0 + self.error(mz) * 1e-6)

    def as_dict(self):
        return {"a_ppm": self.a, "b_ppm_per_mz": self.b, "mz0": self.mz0, "n": self.n}


def fit_calibration(mz, space: FormulaSpace, within=None, window_ppm: float = 15.0, min_points: int = 8, mode: str = "auto") -> Calibration:
    """Calibration from the peaks that have exactly one formula within `window_ppm`: the median ppm error (constant), or a line of m/z when
    there are at least `min_points` such peaks over a range wider than 60 and the line removes more than 20% of the spread (robust: two passes
    that drop residuals > 3 MAD). One iteration: callers re-assign after applying it."""
    mz = np.asarray(mz, float)
    n = space.count(mz, window_ppm, 0.0, within)
    sel = np.flatnonzero(n == 1)
    if len(sel) == 0:
        return Calibration()
    a, b = space.window(mz[sel], window_ppm, 0.0)
    if within is not None:                     # the only formula that passes the sub-formula test is not always the first of the window
        idx = np.array([space.candidates(m, window_ppm, 0.0, within)[0] for m in mz[sel]])
    else:
        idx = a
    err = space.error_ppm(mz[sel], idx)
    mz0 = float(np.median(mz[sel]))
    const = Calibration(float(np.median(err)), 0.0, mz0, len(sel))
    if mode == "constant" or len(sel) < min_points or np.ptp(mz[sel]) < 60:
        return const
    x, y = mz[sel] - mz0, err
    keep = np.ones(len(x), bool)
    for _ in range(2):
        A = np.stack([np.ones(keep.sum()), x[keep]], 1)
        coef = np.linalg.lstsq(A, y[keep], rcond=None)[0]
        res = y - (coef[0] + coef[1] * x)
        mad = 1.4826 * np.median(np.abs(res[keep] - np.median(res[keep]))) + 1e-9
        keep = np.abs(res) <= 3 * mad
        if keep.sum() < min_points:
            return const
    line = Calibration(coef[0], coef[1], mz0, int(keep.sum()))
    spread_const = np.median(np.abs(y - const.a))
    spread_line = np.median(np.abs(y - (coef[0] + coef[1] * x)))
    return line if (mode == "linear" or spread_line < 0.8 * spread_const) else const
