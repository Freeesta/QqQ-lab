# TPMINE-PRIVATE
"""Score of a candidate: independent criteria, each with its reason (no hidden numbers), and the Schymanski confidence level."""
from __future__ import annotations

import math

import numpy as np

R_CL, R_BR = 0.2423 / 0.7577, 0.4931 / 0.5069       # (M+2)/M of one Cl and one Br
M2_SHIFT = 1.998

DEFAULT_THRESHOLDS = {
    "peak": {"snr_min": 3.0, "min_points": 5, "smooth_points": 3},
    "blank": {"ratio_max": 0.20},
    "t0": {"ratio_max": 0.20},
    "growth": {"spearman_min": 0.8, "rise_min": 2.0},
    "isomer": {"area_frac_min": 0.10, "valley_max": 0.5, "max_peaks": 4},
    "halogen": {"tolerance": 0.40},
    "labels": {"strong": 75, "possible": 50},
}


def spearman(x, y) -> float | None:
    """Spearman rank correlation (average ranks for ties); None when one of the series is constant."""
    def rank(v):
        _, inv, cnt = np.unique(np.asarray(v, float), return_inverse=True, return_counts=True)
        return (np.cumsum(cnt) - cnt + (cnt + 1) / 2.0)[inv]
    rx, ry = rank(x), rank(y)
    if rx.std() == 0 or ry.std() == 0:
        return None
    return float(np.corrcoef(rx, ry)[0, 1])


def halogen_expectation(formula: dict | None):
    """Expected (M+2)/M from Cl and Br atoms, None when there is none."""
    if not formula:
        return None
    n_cl, n_br = formula.get("Cl", 0), formula.get("Br", 0)
    return n_cl * R_CL + n_br * R_BR if (n_cl or n_br) else None


def _crit(name, status, text):
    return {"name": name, "status": status, "text": text}      # status: pass | fail | n/a


def score_candidate(rows: list[dict], thr: dict, halogen_expected=None, halogen_observed=None) -> dict:
    """rows: one per sample (label, time, type, area, snr, detected). Returns score (0-100 or None), label, criteria."""
    treated = [r for r in rows if r["type"] == "sample" and (r["time"] is None or r["time"] > 0)]
    t0 = [r for r in rows if r["type"] == "sample" and r["time"] == 0]
    blanks = [r for r in rows if r["type"] in ("blank", "control")]
    crit = []
    amax = max([r["area"] for r in treated if r["detected"]] or [0.0])
    best = max(treated, key=lambda r: r["area"] * r["detected"], default=None)
    ok = bool(best and best["detected"] and best["snr"] >= thr["peak"]["snr_min"])
    crit.append(_crit("peak in the treated samples", "pass" if ok else "fail",
                      (f"S/N {best['snr']:.1f} in {best['label']}" if best else "no treated sample") + f" (required {thr['peak']['snr_min']:g})"))
    if blanks and ok:
        ratio = max(b["area"] for b in blanks) / amax if amax > 0 else 1.0
        crit.append(_crit("absent in the blank", "pass" if ratio <= thr["blank"]["ratio_max"] else "fail",
                          f"blank / treated = {ratio:.2f} (max {thr['blank']['ratio_max']:g})"))
    else:
        crit.append(_crit("absent in the blank", "n/a", "no blank in the experiment" if not blanks else "no peak"))
    if t0 and ok:
        ratio = max(r["area"] for r in t0) / amax if amax > 0 else 1.0
        crit.append(_crit("absent at time zero", "pass" if ratio <= thr["t0"]["ratio_max"] else "fail",
                          f"t0 / trattato = {ratio:.2f} (max {thr['t0']['ratio_max']:g})"))
    else:
        crit.append(_crit("absent at time zero", "n/a", "no sample at time zero" if not t0 else "no peak"))
    timed = sorted([r for r in rows if r["type"] == "sample" and r["time"] is not None], key=lambda r: r["time"])
    if len(timed) >= 3 and ok:
        a = np.array([r["area"] if r["detected"] else 0.0 for r in timed])
        imax = int(np.argmax(a))
        g = thr["growth"]
        t_up, a_up = np.array([r["time"] for r in timed[:imax + 1]], float), a[:imax + 1]
        rho = (1.0 if a_up[-1] > a_up[0] else 0.0) if len(a_up) == 2 else spearman(t_up, a_up) if len(a_up) > 2 else None
        rise = float(a[imax] / a[:imax].min()) if imax > 0 and a[:imax].min() > 0 else math.inf
        good = imax > 0 and rho is not None and rho >= g["spearman_min"] and rise >= g["rise_min"]
        crit.append(_crit("grows over time", "pass" if good else "fail",
                          f"maximum at {timed[imax]['time']:g} min; Spearman rho = " + (f"{rho:.2f}" if rho is not None else "n/a") + f" up to it (minimum {g['spearman_min']:g}), "
                          + ("rise from nothing" if math.isinf(rise) else f"rise x{rise:.1f}") + f" (minimum x{g['rise_min']:g})"))
    else:
        crit.append(_crit("grows over time", "n/a", "at least three samples with a time and a peak are required"))
    if halogen_expected is not None:
        if halogen_observed is None:
            crit.append(_crit("pattern Cl/Br (M+2)", "fail", f"M+2 not seen (expected {halogen_expected:.2f} of M)"))
        else:
            d = abs(halogen_observed - halogen_expected) / halogen_expected
            crit.append(_crit("pattern Cl/Br (M+2)", "pass" if d <= thr["halogen"]["tolerance"] else "fail",
                              f"(M+2)/M = {halogen_observed:.2f}, expected {halogen_expected:.2f}"))
    ev = [c for c in crit if c["status"] != "n/a"]
    if not ev:
        return {"score": None, "label": "n/a", "criteria": crit}
    sc = 100.0 * sum(c["status"] == "pass" for c in ev) / len(ev)
    if not ok:
        sc = min(sc, 20.0)                      # without a peak nothing else matters
    lab = thr["labels"]
    label = "forte" if sc >= lab["strong"] else "possibile" if sc >= lab["possible"] else "debole"
    return {"score": round(sc), "label": label, "criteria": crit}


LEVEL_TEXT = {
    5: "Level 5: mass of interest. Ion with a compatible time course, nothing more.",
    4: "Level 4: proposed formula. Derives from a known transformation of the parent and passes the criteria; at unit resolution the formula is not proven.",
    3: "Level 3: tentative candidate. In addition, the product ions (MS2) are consistent with the parent (shared fragments or fragments shifted by Δ).",
}


def confidence(has_formula: bool, label: str, ms2: dict | None) -> tuple[int | None, str]:
    """Schymanski level 5/4/3 as far as unit-resolution data allow. Levels 2 and 1 need a library spectrum or a standard: never assigned here."""
    if label not in ("forte", "possibile"):
        return None, "No level: the criteria are not met."
    if has_formula and label == "forte":
        if ms2 and ms2.get("scans") and (ms2.get("shared") or ms2.get("shifted")):
            return 3, LEVEL_TEXT[3]
        return 4, LEVEL_TEXT[4]
    return 5, LEVEL_TEXT[5]
