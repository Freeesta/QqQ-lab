"""The score of a candidate: independent criteria, each with its reason. No hidden numbers."""
from __future__ import annotations

import numpy as np

# (M+2)/M of one Cl and one Br: 37Cl/35Cl and 81Br/79Br
R_CL, R_BR = 0.2423 / 0.7577, 0.4931 / 0.5069
M2_SHIFT = 1.998


def halogen_expectation(formula: dict | None) -> float | None:
    """Expected (M+2)/M from the Cl and Br atoms, None when there is none (or no formula)."""
    if not formula:
        return None
    n_cl, n_br = formula.get("Cl", 0), formula.get("Br", 0)
    if not (n_cl or n_br):
        return None
    return n_cl * R_CL + n_br * R_BR


def _crit(name: str, status: str, text: str) -> dict:
    return {"name": name, "status": status, "text": text}      # status: pass | fail | n/a


def score_candidate(rows: list[dict], thr: dict, halogen_expected: float | None = None,
                    halogen_observed: float | None = None) -> dict:
    """rows: one dict per sample: label, time, type, area, snr, points, detected (bool).
    Returns score (0-100 or None), label and the list of criteria."""
    treated = [r for r in rows if r["type"] == "sample" and (r["time"] is None or r["time"] > 0)]
    t0 = [r for r in rows if r["type"] == "sample" and r["time"] == 0]
    blanks = [r for r in rows if r["type"] == "blank"]
    crit = []
    amax = max([r["area"] for r in treated if r["detected"]] or [0.0])
    best = max(treated, key=lambda r: r["area"] * r["detected"], default=None)

    # 1. a picco nei campioni trattati
    ok = bool(best and best["detected"] and best["snr"] >= thr["peak"]["snr_min"])
    crit.append(_crit("picco nei campioni trattati", "pass" if ok else "fail",
                      (f"S/N {best['snr']:.1f} in {best['label']}" if best else "nessun campione trattato") +
                      f" (richiesto {thr['peak']['snr_min']:g})"))
    # 2. blank
    if blanks and ok:
        ratio = max(b["area"] for b in blanks) / amax if amax > 0 else 1.0
        crit.append(_crit("assente nel bianco", "pass" if ratio <= thr["blank"]["ratio_max"] else "fail",
                          f"bianco / trattato = {ratio:.2f} (max {thr['blank']['ratio_max']:g})"))
    else:
        crit.append(_crit("assente nel bianco", "n/a", "nessun bianco nell'esperimento" if not blanks else "nessun picco"))
    # 3. time zero
    if t0 and ok:
        ratio = max(r["area"] for r in t0) / amax if amax > 0 else 1.0
        crit.append(_crit("assente al tempo zero", "pass" if ratio <= thr["t0"]["ratio_max"] else "fail",
                          f"t0 / trattato = {ratio:.2f} (max {thr['t0']['ratio_max']:g})"))
    else:
        crit.append(_crit("assente al tempo zero", "n/a", "nessun campione a tempo zero" if not t0 else "nessun picco"))
    # 4. growth over time
    timed = sorted([r for r in rows if r["type"] == "sample" and r["time"] is not None], key=lambda r: r["time"])
    if len(timed) >= 3 and ok:
        a = np.array([r["area"] if r["detected"] else 0.0 for r in timed])
        imax = int(np.argmax(a))
        steps = np.diff(a[:imax + 1])
        frac = float((steps > 0).mean()) if len(steps) else 0.0
        good = imax > 0 and frac >= thr["growth"]["rising_fraction_min"]
        crit.append(_crit("cresce nel tempo", "pass" if good else "fail",
                          f"massimo a {timed[imax]['time']:g} min; {frac:.0%} dei passi fino ad esso sale "
                          f"(minimo {thr['growth']['rising_fraction_min']:.0%})"))
    else:
        crit.append(_crit("cresce nel tempo", "n/a", "servono almeno tre campioni con il tempo e un picco"))
    # 5. chlorine / bromine pattern
    if halogen_expected is not None:
        if halogen_observed is None:
            crit.append(_crit("Cl/Br pattern (M+2)", "fail", f"M+2 non visto (atteso {halogen_expected:.2f} di M)"))
        else:
            d = abs(halogen_observed - halogen_expected) / halogen_expected
            crit.append(_crit("Cl/Br pattern (M+2)", "pass" if d <= thr["halogen"]["tolerance"] else "fail",
                              f"(M+2)/M = {halogen_observed:.2f}, atteso {halogen_expected:.2f}"))
    evaluable = [c for c in crit if c["status"] != "n/a"]
    if not evaluable:
        return {"score": None, "label": "n/a", "criteria": crit}
    sc = 100.0 * sum(c["status"] == "pass" for c in evaluable) / len(evaluable)
    if not ok:
        sc = min(sc, 20.0)                      # without a peak nothing else matters
    lab = thr["labels"]
    label = "strong candidate" if sc >= lab["strong"] else "possible candidate" if sc >= lab["possible"] else "weak"
    return {"score": round(sc), "label": label, "criteria": crit}
