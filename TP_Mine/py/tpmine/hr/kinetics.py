# TPMINE-PRIVATE
"""Kinetics of the products (WP10): chain models solved with a Pade matrix exponential, AICc, robust descriptors, detection of a parent that
saturates the ionisation, and the measurement sessions. numpy only.

Do not use np.linalg.eig for the rate matrices: with equal rate constants the matrix is defective and eig returns zeros without an error
(measured). Do not use R^2 as a criterion: with 6-12 points of real data it does not discriminate. The generation (first or second) is a hint,
never a deciding criterion: with a parent that cannot be followed the models for early products are not separable."""
from __future__ import annotations

import itertools
import math
import re
from functools import lru_cache

import numpy as np

from qqq_lab import ionfamily

_PADE = [1.0, 1 / 2, 5 / 44, 1 / 66, 1 / 792, 1 / 15840, 1 / 665280]            # Pade (6,6)
GRID = np.geomspace(0.003, 3.0, 28)                                                # rate constants, 1/min


def expm_batch(A: np.ndarray) -> np.ndarray:
    """Matrix exponential of every matrix in A (..., n, n): Pade (6, 6) with scaling and squaring. Robust for repeated eigenvalues."""
    A = np.asarray(A, float)
    nrm = np.abs(A).sum(-2).max(-1)                                                # 1-norm of every matrix
    s = np.maximum(0, np.ceil(np.log2(np.maximum(nrm, 1e-300))).astype(int) + 1)
    smax = int(s.max()) if s.size else 0
    X = A / (2.0 ** s)[..., None, None]
    n = A.shape[-1]
    I = np.broadcast_to(np.eye(n), A.shape)
    N, D, P = I.copy(), I.copy(), I
    for k in range(1, 7):
        P = P @ X
        N = N + _PADE[k] * P
        D = D + (-1) ** k * _PADE[k] * P
    E = np.linalg.solve(D, N)
    for i in range(smax):
        sq = (s > i)[..., None, None]
        E = np.where(sq, E @ E, E)
    return E


def chain_matrix(ks) -> np.ndarray:
    """Rate matrix of A -> S1 -> ... -> sink with the rates ks (ks[0]: decay of the parent, ks[-1]: decay of the last species)."""
    ks = np.asarray(ks, float)
    n = ks.shape[-1] + 1
    K = np.zeros(ks.shape[:-1] + (n, n))
    for i in range(ks.shape[-1]):
        K[..., i, i] -= ks[..., i]
        K[..., i + 1, i] += ks[..., i]
    return K


def chain_curve(times, ks) -> np.ndarray:
    """Concentration of the last species before the sink (the product) at `times` for a chain with rates ks; the parent starts at 1. ks: (..., m)."""
    t = np.asarray(times, float)
    K = chain_matrix(ks)                                                          # (..., m+1, m+1)
    E = expm_batch(K[..., None, :, :] * t[:, None, None])                         # (..., T, m+1, m+1)
    return E[..., K.shape[-1] - 2, 0]


@lru_cache(maxsize=8)
def _curves(times_key: tuple, n_rates: int, k_parent_min: float, chunk: int = 4000):
    """All curves of the chain with `n_rates` rates on GRID (parent rate >= k_parent_min), as an array (N, T), and the rates (N, n_rates)."""
    t = np.array(times_key)
    grids = [GRID[GRID >= k_parent_min]] + [GRID] * (n_rates - 1)
    ks = np.array(list(itertools.product(*grids)))
    out = np.zeros((len(ks), len(t)))
    for s in range(0, len(ks), chunk):
        out[s:s + chunk] = chain_curve(t, ks[s:s + chunk])
    return out, ks


def aicc(sse: float, n: int, k: int) -> float:
    return n * math.log(max(sse, 1e-300) / n) + 2 * k + 2 * k * (k + 1) / max(n - k - 1, 1)


def fit_chain(times, y, n_rates: int, k_parent_min: float = 0.0) -> dict:
    """Best chain model with `n_rates` rate constants (1: A->B; 2: A->B->; 3: A->I->B->) on square-root normalised areas (variance stabilising):
    the scale is solved in closed form for every curve of the grid and the smallest sum of squares wins. Returns AICc, rates, scale, curve."""
    t = np.asarray(times, float)
    y = np.asarray(y, float)
    yt = np.sqrt(np.clip(y / max(y.max(), 1e-300), 0, None))
    C, ks = _curves(tuple(t.tolist()), n_rates, float(k_parent_min))
    G = np.sqrt(np.clip(C / np.maximum(C.max(1, keepdims=True), 1e-300), 0, None))
    gg = np.maximum((G * G).sum(1), 1e-300)
    gy = G @ yt
    sse = (yt * yt).sum() - gy * gy / gg
    i = int(np.argmin(sse))
    s = gy[i] / gg[i]
    return {"aicc": aicc(float(sse[i]), len(t), n_rates + 1), "rates": ks[i].tolist(), "scale": float(s), "sse": float(sse[i]), "curve": (s * G[i]).tolist()}


def generation(times, y, k_parent_min: float = 0.02, margin: float = 2.0) -> dict:
    """First or second generation? AICc of A->B-> against A->I->B-> (the intermediate is unseen). A hint: with a parent that cannot be followed
    and 6-12 points the two are often not separable, then 'non decidibile'."""
    first = fit_chain(times, y, 2)
    second = fit_chain(times, y, 3, k_parent_min)
    d = second["aicc"] - first["aicc"]
    verdict = "seconda" if d < -margin else "prima" if d > margin else "non decidibile"
    return {"verdict": verdict, "aicc_first": first["aicc"], "aicc_second": second["aicc"], "delta": float(d), "first": first, "second": second}


# ---------------------------------------------------------------------------------------------------------------------- descriptors
def descriptors(times, y, onset_frac: float = 0.10, persistent: float = 0.5) -> dict:
    """Robust descriptors of a profile (areas vs time, time of the treatment in minutes): onset (first time above 10 % of the maximum), tmax, fraction
    left at the last time, unimodal fit and its residual, and the class in Italian: 'precoce' (tmax <= 20 min or onset <= 5 min) or 'tardivo',
    plus 'persistente' when at least half of the maximum is still there at the last time."""
    t = np.asarray(times, float)
    y = np.asarray(y, float)
    ok = t >= 0
    t, y = t[ok], y[ok]
    if len(y) == 0 or y.max() <= 0:
        return {"ok": False}
    o = np.argsort(t)
    t, y = t[o], y[o]
    yn = y / y.max()
    onset = float(t[np.argmax(yn > onset_frac)]) if (yn > onset_frac).any() else float("nan")
    tmax = float(t[int(np.argmax(y))])
    last = float(yn[-1])
    uni = ionfamily._isotonic_up_down(yn)
    resid = float(np.sqrt(np.mean((yn - uni) ** 2)))
    klass = ["precoce" if (tmax <= 20 or onset <= 5) else "tardivo"]
    if last >= persistent:
        klass.append("persistente")
    return {"ok": True, "onset": onset, "tmax": tmax, "residual_fraction": last, "unimodal": bool(resid < 0.15), "unimodal_residual": resid, "class": klass,
            "class_text": " e ".join(klass), "profile": yn.tolist(), "times": t.tolist()}


def not_in_reference(times, y, ref_max: float, ratio: float = 5.0) -> bool:
    """Coherent with a product: absent or tiny in dark / t0 (max of those <= max of the profile / ratio)."""
    return ref_max * ratio <= float(np.max(y))


# ---------------------------------------------------------------------------------------------------------------------- parent saturation
def parent_saturation(times, areas, flat: float = 0.25, drop: float = 10.0, min_flat: int = 3) -> dict:
    """Does the area of the parent stay within +-`flat` of its median over at least `min_flat` consecutive times and then fall by more than `drop`
    times? That is a response that is not linear (ionisation saturation of the source), not a rate: the decay constant of the parent cannot be
    estimated from these areas and must not enter the models of the products. Times in increasing order, dark / t0 included."""
    t = np.asarray(times, float)
    a = np.asarray(areas, float)
    o = np.argsort(t)
    t, a = t[o], a[o]
    for i in range(len(a) - min_flat + 1):
        for j in range(len(a), i + min_flat - 1, -1):
            seg = a[i:j]
            med = np.median(seg)
            if med > 0 and np.all(np.abs(seg / med - 1) <= flat):
                tail = a[j:]
                if len(tail) and med / max(tail.min(), 1e-300) > drop:
                    return {"saturated": True, "plateau": [float(t[i]), float(t[j - 1])], "level": float(med), "drop": float(med / max(tail.min(), 1e-300)),
                            "note": "risposta non lineare (saturazione ESI): k del progenitore non stimabile"}
                break
    return {"saturated": False, "note": ""}


# ---------------------------------------------------------------------------------------------------------------------- sessions
_RX_START = re.compile(r'startTimeStamp="([^"]*)"')


def run_start(path, head_bytes: int = 400_000) -> str | None:
    """Start time of the run (the 'startTimeStamp' of <run>), read from the head of the file; None when it is not there."""
    with open(path, "rb") as fh:
        m = _RX_START.search(fh.read(head_bytes).decode("utf-8", "replace"))
    return m.group(1) if m else None


def sessions(stamps, gap_hours: float = 12.0) -> list[str]:
    """Label the files by measurement session: stamps (ISO strings, None allowed) sorted in time are split where the gap is above `gap_hours`.
    Returns 'S1', 'S2'... per file in the input order ('?' where the time is unknown)."""
    from datetime import datetime
    t = []
    for s in stamps:
        try:
            t.append(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() if s else None)
        except ValueError:
            t.append(None)
    known = sorted((v, i) for i, v in enumerate(t) if v is not None)
    lab = ["?"] * len(t)
    k = 0
    prev = None
    for v, i in known:
        if prev is None or (v - prev) / 3600.0 > gap_hours:
            k += 1
        lab[i] = f"S{k}"
        prev = v
    return lab


def session_factors(areas: np.ndarray, labels: list[str], threshold: float = 0.3) -> dict:
    """Scale factor of every session from the features present in ALL the files: the reference is the session with most files (its factor is 1);
    each file's log-ratio to the median of the reference files is taken per feature, the median over the features, then over the files of the
    session. The factor is applied only if it is far from 1 (|ln f| > ln(1 + threshold) for some session): in the measured series the factor on
    the features present everywhere is ~1.0 although the TIC of one session is double, so the TIC is not a normaliser.
    Returns {"factors": per file, "applied": bool, "per_session": {...}, "n_features": n, "reference": label}."""
    A = np.asarray(areas, float)
    full = (A > 0).all(1)
    n = int(full.sum())
    out = {"n_features": n, "applied": False, "factors": np.ones(A.shape[1]).tolist(), "per_session": {}, "reference": None}
    labs = np.array(labels)
    names = sorted(set(labels) - {"?"})
    if n < 20 or len(names) < 2:
        return out
    ref = max(names, key=lambda s: int((labs == s).sum()))
    L = np.log(A[full])
    row_ref = np.median(L[:, labs == ref], axis=1, keepdims=True)
    per_file = np.median(L - row_ref, axis=0)
    f = np.ones(A.shape[1])
    for s in names:
        f[labs == s] = math.exp(float(np.median(per_file[labs == s])))
    out["per_session"] = {s: float(f[labs == s][0]) for s in names}
    out["reference"] = ref
    if np.any(np.abs(np.log(f)) > math.log(1 + threshold)):
        out["applied"] = True
        out["factors"] = (1.0 / f).tolist()                      # multiply the areas of a file by this to bring it to the reference session
    return out
