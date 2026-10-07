# TPMINE-PRIVATE
"""Score of a candidate: independent criteria, each with its reason (no hidden numbers), and the Schymanski confidence level."""
from __future__ import annotations

import numpy as np

R_CL, R_BR = 0.2423 / 0.7577, 0.4931 / 0.5069       # (M+2)/M of one Cl and one Br
M2_SHIFT = 1.998

DEFAULT_THRESHOLDS = {
    "peak": {"snr_min": 3.0, "min_points": 5, "smooth_points": 3},
    "blank": {"ratio_max": 0.20},
    "t0": {"ratio_max": 0.20},
    "growth": {"rising_fraction_min": 0.75},
    "halogen": {"tolerance": 0.40},
    "labels": {"strong": 75, "possible": 50},
}


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
    crit.append(_crit("picco nei campioni trattati", "pass" if ok else "fail",
                      (f"S/N {best['snr']:.1f} in {best['label']}" if best else "nessun campione trattato") + f" (richiesto {thr['peak']['snr_min']:g})"))
    if blanks and ok:
        ratio = max(b["area"] for b in blanks) / amax if amax > 0 else 1.0
        crit.append(_crit("assente nel bianco", "pass" if ratio <= thr["blank"]["ratio_max"] else "fail",
                          f"bianco / trattato = {ratio:.2f} (max {thr['blank']['ratio_max']:g})"))
    else:
        crit.append(_crit("assente nel bianco", "n/a", "nessun bianco nell'esperimento" if not blanks else "nessun picco"))
    if t0 and ok:
        ratio = max(r["area"] for r in t0) / amax if amax > 0 else 1.0
        crit.append(_crit("assente al tempo zero", "pass" if ratio <= thr["t0"]["ratio_max"] else "fail",
                          f"t0 / trattato = {ratio:.2f} (max {thr['t0']['ratio_max']:g})"))
    else:
        crit.append(_crit("assente al tempo zero", "n/a", "nessun campione a tempo zero" if not t0 else "nessun picco"))
    timed = sorted([r for r in rows if r["type"] == "sample" and r["time"] is not None], key=lambda r: r["time"])
    if len(timed) >= 3 and ok:
        a = np.array([r["area"] if r["detected"] else 0.0 for r in timed])
        imax = int(np.argmax(a))
        steps = np.diff(a[:imax + 1])
        frac = float((steps > 0).mean()) if len(steps) else 0.0
        good = imax > 0 and frac >= thr["growth"]["rising_fraction_min"]
        crit.append(_crit("cresce nel tempo", "pass" if good else "fail",
                          f"massimo a {timed[imax]['time']:g} min; {frac:.0%} dei passi fino ad esso sale (minimo {thr['growth']['rising_fraction_min']:.0%})"))
    else:
        crit.append(_crit("cresce nel tempo", "n/a", "servono almeno tre campioni con il tempo e un picco"))
    if halogen_expected is not None:
        if halogen_observed is None:
            crit.append(_crit("pattern Cl/Br (M+2)", "fail", f"M+2 non visto (atteso {halogen_expected:.2f} di M)"))
        else:
            d = abs(halogen_observed - halogen_expected) / halogen_expected
            crit.append(_crit("pattern Cl/Br (M+2)", "pass" if d <= thr["halogen"]["tolerance"] else "fail",
                              f"(M+2)/M = {halogen_observed:.2f}, atteso {halogen_expected:.2f}"))
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
    5: "Livello 5: massa di interesse. Ione con andamento nel tempo compatibile, nient'altro.",
    4: "Livello 4: formula ipotizzata. Deriva da una trasformazione nota del progenitore e supera i criteri; a risoluzione unitaria la formula non è dimostrata.",
    3: "Livello 3: candidato tentativo. In più, gli ioni prodotto (MS2) sono coerenti con il progenitore (frammenti condivisi o spostati di Δ).",
}


def confidence(has_formula: bool, label: str, ms2: dict | None) -> tuple[int | None, str]:
    """Schymanski level 5/4/3 as far as unit-resolution data allow. Levels 2 and 1 need a library spectrum or a standard: never assigned here."""
    if label not in ("forte", "possibile"):
        return None, "Nessun livello: i criteri non sono soddisfatti."
    if has_formula and label == "forte":
        if ms2 and ms2.get("scans") and (ms2.get("shared") or ms2.get("shifted")):
            return 3, LEVEL_TEXT[3]
        return 4, LEVEL_TEXT[4]
    return 5, LEVEL_TEXT[5]
