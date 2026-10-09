# TPMINE-PRIVATE
"""ISF classifier of TP Mine: for every candidate ion, the probability that it is an in-source fragment / isotope / adduct of the
parent or a real transformation product, with the evidence and the doubtful cases with their reason.

The PUBLIC module `mzlab.ionfamily` measures (profile similarity, F/P ratio, kinetics, MCR-ALS, ...) and never concludes; the verdict
lives only here. Model: a regularised logistic regression (IRLS, L2) on standardised, independent-ish evidence features, calibrated
(`calibrate`) on synthetic scenes with known truth (hard negatives: a product that co-elutes with another shape) and, when the real mzML
are available, on the real flufenacet series (positives = ions at the parent's peak at t0, easy negatives = formed ions at other RT).
The fitted parameters are stored in `isf_model.MODEL` (re-run `calibrate()` to refresh them). Features that are missing (e.g. fewer
than 3 samples: no kinetics) contribute nothing (mean imputation after standardisation). Physics enters as hard constraints: an ion
heavier than the parent cannot be an in-source *fragment*; roles by m/z difference (isotope, adduct, loss with formula subset) split the
"inherited from P" probability among isf / isotope / adduct / other. Criteria that are known to be dependent (profile correlations)
are represented by ONE feature each; the rest are weighed together by the logistic model, not multiplied as if independent
(this is why a naive Bayes product was not used). MS2 and DP-ramp evidence are added as log-odds with heuristic, UNcalibrated weights
(flagged `calibrated: False`): no real data exist to tune them (no MS2 of the parent, no DP ramp in the lab files).
Everything returned is plain JSON-serialisable data (use `F.to_jsonable`)."""
from __future__ import annotations

import math

import numpy as np

from mzlab import ionfamily as F

try:
    from .isf_model import MODEL
except Exception:  # noqa: BLE001 -- not calibrated yet: calibrate() builds it
    MODEL = None

FEATURES = ["pearson_w", "apex_z", "fwhm_log", "cv_ratio", "const_logp", "const_cv", "kin_sp", "shift_logp", "has_peak"]
TEXT = {
    "pearson_w": "profilo cromatografico (correlazione nella finestra del picco)",
    "apex_z": "apice rispetto al progenitore",
    "fwhm_log": "larghezza del picco rispetto al progenitore",
    "cv_ratio": "costanza del rapporto F/P dentro il picco",
    "const_logp": "costanza del rapporto F/P fra i campioni",
    "const_cv": "variazione del rapporto F/P fra i campioni",
    "kin_sp": "cinetica fra i campioni rispetto al progenitore",
    "shift_logp": "specificità dell'allineamento (traslazioni casuali)",
    "has_peak": "lo ione ha un picco proprio",
}


def _f(v, default=float("nan")):
    return float(v) if isinstance(v, (int, float)) and math.isfinite(v) else default


def features(rep: dict) -> dict:
    """The evidence features of an `ionfamily.origin_report` (NaN = not available)."""
    pr = rep.get("profile") or {}
    rf = rep.get("ratio") or {}
    rc = rep.get("ratio_constancy") or {}
    kin = rep.get("kinetics") or {}
    has = bool(pr.get("x_has_peak"))
    d, s = _f(pr.get("apex_diff_s")), _f(pr.get("apex_diff_sigma_s"))
    apex_z = min(abs(d) / max(s, 0.5), 20.0) if has and math.isfinite(d) and math.isfinite(s) else 20.0
    fr = _f(pr.get("fwhm_ratio"))
    fwhm = min(abs(math.log(max(fr, 1e-2))), 3.0) if math.isfinite(fr) else 1.5
    pw = _f(pr.get("pearson_w"), _f(pr.get("pearson")))
    cv = _f(rf.get("cv_ratio_mad")) if rf.get("ok") else float("nan")
    p_sh = _f(pr.get("p_shift"))
    p_c = _f(rc.get("p"))
    return {"pearson_w": pw if math.isfinite(pw) else -0.2,
            "apex_z": apex_z, "fwhm_log": fwhm, "cv_ratio": min(cv, 3.0) if math.isfinite(cv) else 1.5,
            "const_logp": max(math.log10(max(p_c, 1e-12)), -12.0) if math.isfinite(p_c) else float("nan"),
            "const_cv": min(_f(rc.get("cv")), 3.0) if math.isfinite(_f(rc.get("cv"))) else float("nan"),
            "kin_sp": _f(kin.get("spearman_parent")),
            "shift_logp": max(math.log10(max(p_sh, 1e-3)), -3.0) if math.isfinite(p_sh) else 0.0,
            "has_peak": 1.0 if has else 0.0}


# ---------------------------------------------------------------------------------------------------------------- the model
def fit_logistic(X: np.ndarray, y: np.ndarray, lam: float = 2.0, w: np.ndarray | None = None, n_iter: int = 60):
    """L2-regularised logistic regression by IRLS on standardised features. Returns (mean, std, coef, intercept). NaN -> mean."""
    X = np.asarray(X, float)
    mu = np.nanmean(X, 0)
    sd = np.nanstd(X, 0)
    sd[sd < 1e-9] = 1.0
    Z = np.nan_to_num((X - mu) / sd, nan=0.0)
    n, m = Z.shape
    A = np.column_stack([np.ones(n), Z])
    w = np.ones(n) if w is None else np.asarray(w, float)
    beta = np.zeros(m + 1)
    R = lam * np.eye(m + 1)
    R[0, 0] = 0.0
    for _ in range(n_iter):
        p = 1 / (1 + np.exp(-np.clip(A @ beta, -30, 30)))
        W = w * p * (1 - p) + 1e-9
        g = A.T @ (w * (y - p)) - R @ beta
        H = A.T @ (A * W[:, None]) + R
        step = np.linalg.solve(H, g)
        beta = beta + step
        if np.abs(step).max() < 1e-8:
            break
    return mu, sd, beta[1:], float(beta[0])


def predict_logit(feat: dict, model: dict | None = None):
    """(log-odds that the ion is inherited from the parent, per-feature contributions)."""
    model = model or MODEL
    if model is None:
        raise RuntimeError("isf_model.MODEL missing: run tpmine.isf.calibrate() first")
    x = np.array([feat.get(k, float("nan")) for k in model["features"]], float)
    z = np.nan_to_num((x - np.array(model["mean"])) / np.array(model["std"]), nan=0.0)
    contrib = z * np.array(model["coef"])
    return float(model["intercept"] + contrib.sum()), {k: float(c) for k, c in zip(model["features"], contrib)}


def _sigmoid(x):
    return 1 / (1 + math.exp(-max(min(x, 30), -30)))


# ---------------------------------------------------------------------------------------------------------------- role split
def _split_inherited(rep: dict, formula_p: str | None):
    """Weights of the hypotheses *given* that the ion is inherited from P. Physics: heavier than P -> not a fragment."""
    mz, pmz = rep["mz"], rep["parent_mz"]
    d = mz - pmz
    roles = rep.get("roles") or []
    kinds = {r["role"] for r in roles}
    w = {"isf": 0.0, "isotope": 0.0, "adduct": 0.0, "other": 0.0}
    notes = []
    if d <= -0.5:
        frag = [r for r in roles if r["role"] == "fragment_candidate"]
        ok_f = [r for r in frag if r.get("formula_ok", True)]
        w["isf"] = 1.0
        if ok_f:
            w["isf"] = 3.0
            notes.append("perdita neutra nota: %s" % ", ".join(sorted({r["label"] for r in ok_f})[:3]))
        elif frag and formula_p:
            w["isf"] = 0.3
            notes.append("la perdita neutra non è compatibile con la formula del progenitore")
        elif not frag:
            w["isf"] = 0.7
            notes.append("nessuna perdita neutra della tabella spiega Δm")
        # isotope of a fragment: a lighter ion 1 or 2 Da below with the same profile and a plausible M+1 / M+2 ratio
        for nb in rep.get("neighbors", []):
            if _f(nb.get("pearson"), 0) > 0.9 and _f(nb.get("area_ratio"), 9) <= 0.9:
                w["isotope"] = 2.5
                notes.append("possibile isotopo M+%d dello ione a m/z %.1f" % (nb["delta"], nb["mz"]))
                break
    else:
        notes.append("più pesante del progenitore: non può essere un frammento in sorgente")
        if "isotope" in kinds:
            w["isotope"] = 5.0
        if kinds & {"adduct", "dimer"}:
            w["adduct"] = 5.0
        if not (kinds & {"isotope", "adduct", "dimer"}):
            w["other"] = 1.0
    s = sum(w.values()) or 1.0
    return {k: v / s for k, v in w.items()}, notes


# ---------------------------------------------------------------------------------------------------------------- classify
def classify_report(rep: dict, formula_p: str | None = None, fam: dict | None = None, ramp: dict | None = None,
                    model: dict | None = None) -> dict:
    """Probabilities and evidence for the ion of one `origin_report`. Returns
    {mz, probs: {isf, isotope, adduct, other_from_parent, tp}, p_inherited, isf_ness (0-100), evidence [..., sorted by weight],
     doubtful (bool), reasons [..], explanation (readable text), warnings, calibrated}.
    `fam`: result of `families()` (MCR-ALS) to detect an ion split between the parent's component and another one;
    `ramp`: {"dp": [...], "f": [...], "p": [...]} breakdown data (heuristic weight, calibrated False)."""
    feat = features(rep)
    logit, contrib = predict_logit(feat, model)
    extra = []
    ms2 = rep.get("ms2")
    if ms2 and ms2.get("x_in_p") is not None:
        v = 1.0 if ms2["x_in_p"] else -0.5
        if ms2.get("modified_cosine") is not None and math.isfinite(ms2["modified_cosine"]):
            v += 2.0 * (ms2["modified_cosine"] - 0.5)
        extra.append(("ms2", v, "MS2: %s tra i prodotti del progenitore%s" % ("presente" if ms2["x_in_p"] else "assente",
                      (", cosseno modificato %.2f" % ms2["modified_cosine"]) if ms2.get("modified_cosine") is not None and math.isfinite(ms2["modified_cosine"]) else "")))
    if ramp:
        rr = F.source_ramp(ramp["dp"], ramp["f"], ramp["p"])
        if rr.get("spearman") is not None and math.isfinite(rr["spearman"]):
            extra.append(("ramp", 3.0 * rr["spearman"], "rampa del DP: Spearman %.2f del rapporto F/(F+P) con il DP" % rr["spearman"]))
    for _, v, _ in extra:
        logit += v
    p_inh = _sigmoid(logit)
    split, notes = _split_inherited(rep, formula_p)
    heavy = rep["mz"] - rep["parent_mz"] > -0.5
    probs = {k: p_inh * split[k] for k in ("isf", "isotope", "adduct", "other")}
    probs["tp"] = 1.0 - p_inh
    probs["other_from_parent"] = probs.pop("other")
    # evidence list
    ev = []
    pr, rf, rc, kin = (rep.get(k) or {} for k in ("profile", "ratio", "ratio_constancy", "kinetics"))
    def val(name):
        if name == "pearson_w":
            return "r = %.2f" % feat["pearson_w"] if math.isfinite(feat["pearson_w"]) else "n/d"
        if name == "apex_z":
            return ("Δapice %+.1f ± %.1f s" % (pr["apex_diff_s"], pr["apex_diff_sigma_s"])) if pr.get("x_has_peak") and pr.get("apex_diff_s") is not None else "nessun picco proprio"
        if name == "fwhm_log":
            return "FWHM X/P = %.2f" % pr["fwhm_ratio"] if pr.get("fwhm_ratio") is not None else "n/d"
        if name == "cv_ratio":
            return "CV (MAD) = %.0f%%" % (100 * rf["cv_ratio_mad"]) if rf.get("ok") and rf.get("cv_ratio_mad") is not None else "n/d"
        if name == "const_logp":
            return "p (Cochran) = %.2g su %d campioni" % (rc["p"], rc["k"]) if rc.get("p") is not None else "meno di 2 campioni"
        if name == "const_cv":
            return "CV fra campioni = %.0f%%" % (100 * rc["cv"]) if rc.get("cv") is not None else "n/d"
        if name == "kin_sp":
            return "ρ = %.2f" % kin["spearman_parent"] if kin.get("spearman_parent") is not None else "meno di 3 campioni con tempo"
        if name == "shift_logp":
            return "p traslazioni = %.2g" % pr["p_shift"] if pr.get("p_shift") is not None else "n/d"
        return "sì" if feat["has_peak"] else "no"
    for k, c in contrib.items():
        if abs(c) < 0.05 and not math.isfinite(feat.get(k, float("nan"))):
            continue
        ev.append({"name": k, "label": TEXT[k], "value": val(k), "log_odds": c,
                   "toward": "parent" if c > 0 else "tp", "calibrated": True})
    for k, v, t in extra:
        ev.append({"name": k, "label": t, "value": "", "log_odds": v, "toward": "parent" if v > 0 else "tp", "calibrated": False})
    ev.sort(key=lambda e: -abs(e["log_odds"]))
    # doubtful cases and their reasons
    reasons = []
    if 0.25 <= p_inh <= 0.75:
        reasons.append("probabilità intermedia (%.0f%% di essere ereditato dal progenitore)" % (100 * p_inh))
    prof_good = math.isfinite(feat["pearson_w"]) and feat["pearson_w"] >= 0.9
    if prof_good and math.isfinite(feat["const_logp"]) and feat["const_logp"] < -2:
        reasons.append("profilo identico a quello del progenitore ma rapporto F/P non costante fra i campioni: possibile miscela con un "
                       "prodotto isobarico che co-eluisce, oppure saturazione del progenitore (guarda le famiglie MCR)")
    if not pr.get("reliable", False):
        reasons.append("misura poco affidabile (poche scansioni, picco assente o ione debole)")
    for w_ in rep.get("warnings", []):
        if "oincidenza" in w_ or "satura" in w_.lower():
            reasons.append(w_)
    if fam and fam.get("ok"):
        share = fam["ion_share"].get(round(rep["mz"], 1))
        if share and len([s for s in share["components"] if s >= 0.2]) >= 2 and share["parent_component"] is not None and share["components"][share["parent_component"]] < 0.8:
            reasons.append("l'MCR-ALS divide questo ione fra più componenti (parte del segnale non è del progenitore)")
    if heavy and p_inh >= 0.5 and split["other"] > 0.5:
        reasons.append("più pesante del progenitore e non spiegato da isotopo o addotto noto")
    doubtful = bool(reasons)
    top = [e for e in ev if abs(e["log_odds"]) >= 0.3][:4]
    isf_ness = 100.0 * probs["isf"]
    lead = max(probs, key=probs.get)
    names = {"isf": "frammento in sorgente (ISF)", "isotope": "isotopo del progenitore o di un suo frammento", "adduct": "addotto/dimero del progenitore",
             "other_from_parent": "ione derivato dal progenitore (non classificato)", "tp": "prodotto di trasformazione vero"}
    expl = "%s: %.0f%% %s. " % ("Dubbio" if doubtful else "Esito", 100 * probs[lead], names[lead])
    if top:
        expl += "Prove principali: " + "; ".join("%s (%s) %s" % (e["label"], e["value"] or "", "→ progenitore" if e["toward"] == "parent" else "→ TP vero") for e in top) + ". "
    if notes:
        expl += "Note: " + "; ".join(notes) + ". "
    if reasons:
        expl += "Motivi del dubbio: " + "; ".join(reasons) + ". "
    expl += "Risoluzione unitaria: è una probabilità, non un'identificazione."
    return F.to_jsonable({"mz": rep["mz"], "parent_mz": rep["parent_mz"], "probs": probs, "p_inherited": p_inh, "isf_ness": isf_ness,
                          "evidence": ev, "doubtful": doubtful, "reasons": reasons, "explanation": expl, "notes": notes,
                          "warnings": rep.get("warnings", []), "features": feat, "calibrated": MODEL is not None if model is None else True})


# ---------------------------------------------------------------------------------------------------------------- MCR families
def families(samples, parent_mz: float, ref: int | None = None, k: int | None = None, tol: float = F.TOL_MZ, min_snr: float = 8.0) -> dict:
    """MCR-ALS on the parent's peak window of the reference sample: every component = an elution profile + a clean spectrum. The
    component that carries the parent holds its in-source fragments; the others are co-eluting species (candidate products). Returns
    {ok, components: [{apex_rt, fwhm_s, area_share, top_ions}], parent_component, ion_share: {mz1: {components: [share per comp],
    parent_component}}, stability, lof}. `stability.cos_min` low (< 0.9) = ambiguous decomposition: do not trust the spectra."""
    if ref is None:
        ref = int(np.argmax([float(s["table"].xic(parent_mz, 0.5).max()) if len(s["table"].rt) else 0.0 for s in samples]))
    tb = samples[ref]["table"]
    rt, P = F.extract_trace(tb, parent_mz, tol)
    det = F.detect_peaks(rt, P)
    if not det["peaks"]:
        return {"ok": False, "reason": "il progenitore non ha picco nel campione di riferimento"}
    pk = det["peaks"][0]
    pad = max(2, int(0.3 * pk["n_scans"]))
    lo, hi = max(pk["lo"] - pad, 0), min(pk["hi"] + pad, len(rt) - 1)
    w = F.build_rois(tb, float(rt[lo]) - 0.3, float(rt[hi]) + 0.3, tol, key=samples[ref].get("key"))
    i0 = int(np.searchsorted(w.rt, rt[lo]))
    i1 = int(np.searchsorted(w.rt, rt[hi], side="right")) - 1
    res = F.deconvolve_window(w, i0, i1, k=k, min_snr=min_snr)
    if not res.get("ok"):
        return {"ok": False, "reason": "finestra troppo povera per l'MCR-ALS"}
    S, C, mz = np.array(res["S"]), np.array(res["C"]), np.array(res["mz"])
    rtw = np.array(res["rt"])
    area = np.array([float(np.trapz(c, rtw)) if hasattr(np, "trapz") else float(np.trapezoid(c, rtw)) for c in C])
    comps = []
    for j in range(S.shape[0]):
        pkj = F.detect_peaks(rtw, C[j], snr=3.0, min_scans=3)["peaks"]
        top = np.argsort(-S[j])[:10]
        comps.append({"apex_rt": float(pkj[0]["apex_rt"]) if pkj else float(rtw[int(np.argmax(C[j]))]),
                      "fwhm_s": float(pkj[0]["fwhm_min"] * 60) if pkj else float("nan"),
                      "area_share": float(area[j] / max(area.sum(), 1e-12)),
                      "top_ions": [{"mz": float(mz[i]), "rel": float(S[j][i])} for i in top if S[j][i] > 0.02]})
    jp = int(np.argmin(np.abs(mz - parent_mz)))
    parent_comp = int(np.argmax(S[:, jp] * area)) if abs(mz[jp] - parent_mz) <= tol else None
    share = {}
    for i in range(len(mz)):
        wgt = S[:, i] * area
        t = wgt.sum()
        if t > 0:
            share[round(float(mz[i]), 1)] = {"components": (wgt / t).tolist(), "parent_component": parent_comp}
    return F.to_jsonable({"ok": True, "k": res["k"], "lof": res["lof"], "components": comps, "parent_component": parent_comp,
                          "ion_share": share, "stability": res.get("stability"),
                          "window": [float(w.rt[i0]), float(w.rt[i1])]})


# ---------------------------------------------------------------------------------------------------------------- batch + export
def classify_ions(samples, parent_mz: float, mzs, formula_p: str | None = None, ref: int | None = None, fam: bool = True,
                  ramp: dict | None = None, ms2: dict | None = None, model: dict | None = None) -> dict:
    """Classify a list of candidate ions against the parent. Returns {"items": [classify_report ... sorted by ISF-ness desc],
    "doubtful": [short list with the reason], "families": ..., "model": meta}."""
    famres = families(samples, parent_mz, ref) if fam else None
    items = []
    for mz in mzs:
        rep = F.origin_report(samples, float(mz), float(parent_mz), ref=ref, formula_p=formula_p, ms2=ms2, top=0)
        if "profile" not in rep:
            items.append({"mz": float(mz), "error": "; ".join(rep.get("warnings", [])) or "nessun picco", "doubtful": True,
                          "reasons": ["analisi impossibile"], "probs": {}, "isf_ness": None})
            continue
        items.append(classify_report(rep, formula_p, famres, ramp, model))
    items.sort(key=lambda d: -(d.get("isf_ness") or -1))
    return {"items": items, "doubtful": [{"mz": i["mz"], "reason": "; ".join(i["reasons"])} for i in items if i.get("doubtful")],
            "families": famres, "model": (MODEL or {}).get("meta"), "note": "Risoluzione unitaria: probabilità, non identificazioni."}


def to_sheets(result: dict) -> list[dict]:
    """The result as xlsx sheets for the front end's `dlx(name, sheets)` ({name, head, rows, widths}; numbers stay numbers)."""
    head = ["m/z", "ISF-ness (0-100)", "P(ISF)", "P(isotopo)", "P(addotto)", "P(altro da P)", "P(TP vero)", "Dubbio", "Motivo / spiegazione"]
    rows = []
    for i in result["items"]:
        p = i.get("probs") or {}
        rows.append([i["mz"], i.get("isf_ness"), p.get("isf"), p.get("isotope"), p.get("adduct"), p.get("other_from_parent"), p.get("tp"),
                     "sì" if i.get("doubtful") else "no", "; ".join(i.get("reasons", [])) or i.get("explanation", "")])
    sheets = [{"name": "Candidati", "head": head, "rows": rows, "widths": [10, 14, 10, 10, 10, 12, 10, 8, 90]}]
    ev = []
    for i in result["items"]:
        for e in i.get("evidence", []):
            ev.append([i["mz"], e["label"], e.get("value", ""), e["log_odds"], "progenitore" if e["toward"] == "parent" else "TP vero",
                       "sì" if e.get("calibrated") else "no (euristico)"])
    sheets.append({"name": "Prove", "head": ["m/z", "Criterio", "Valore", "Peso (log-odds)", "A favore di", "Tarato"], "rows": ev,
                   "widths": [10, 60, 36, 14, 14, 16]})
    fam = result.get("families")
    if fam and fam.get("ok"):
        fr = []
        for j, c in enumerate(fam["components"]):
            fr.append([j + 1, "sì" if j == fam["parent_component"] else "no", c["apex_rt"], c["fwhm_s"], c["area_share"],
                       ", ".join("%.1f (%.2f)" % (t["mz"], t["rel"]) for t in c["top_ions"])])
        sheets.append({"name": "Famiglie MCR", "head": ["Componente", "Contiene il progenitore", "Apice RT (min)", "FWHM (s)", "Quota area",
                                                           "Spettro pulito: m/z (rel.)"], "rows": fr, "widths": [12, 20, 14, 10, 10, 90]})
    return sheets


# ---------------------------------------------------------------------------------------------------------------- calibration
POS_ROLES = {"isf", "isotope", "adduct"}
NEG_ROLES = {"tp", "tp_coelute"}               # tp_isobaric is reserved for the hard test (never trained on)


def _synthetic_rows(n_series: int = 8, seed0: int = 4000):
    """Feature rows of synthetic series with known truth: noise 0.7-1.6, scan interval 0.7/1/1.5 s, random detector saturation."""
    from mzlab import demo
    rng = np.random.default_rng(seed0)
    rows, y, grp = [], [], []
    for s in range(n_series):
        dt = [0.7, 1.0, 1.5][s % 3]
        kw = {"dt_s": dt, "noise": float(rng.uniform(0.7, 1.6)), "saturate": float(rng.choice([6e7, 2e8, 1e9])) if s % 2 else None}
        ser = demo.isf_series(times=(5, 10, 15, 30, 45, 60), seed=seed0 + 100 * s, **kw)
        samples = [{"label": "t%g" % t, "time": float(t), "table": tb, "key": "syn%d_%g" % (s, t)} for t, tb, _ in ser]
        truth = {x["name"]: x for x in ser[0][2]}
        pmz = truth["P"]["mz"] + demo.ISF_OFFSET
        for name, ion in truth.items():
            if ion["role"] in POS_ROLES | NEG_ROLES:
                rep = F.origin_report(samples, ion["mz"] + demo.ISF_OFFSET, pmz, top=0)
                if "profile" not in rep:
                    continue
                rows.append(features(rep)); y.append(1 if ion["role"] in POS_ROLES else 0); grp.append("syn%d" % s)
    return rows, y, grp


def _real_rows(real_dir, parent: float = 364.35):
    """Real flufenacet series B: samples with t >= 5 min (t0 is the stand-in standard, left out); positives = ions that are at the parent's
    peak already at t0, easy negatives = formed ions 5-60 s away from the parent's apex."""
    import importlib.util
    from pathlib import Path
    from mzlab.project import guess_sample
    from mzlab.reader.mzml import Run
    vp = Path(F.__file__).resolve().parents[1] / "tools" / "validate_ionfamily.py"
    spec = importlib.util.spec_from_file_location("validate_ionfamily", vp)
    V = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(V)
    runs = {}
    for p in sorted(Path(real_dir).glob("B_FullMass-t*.mzML")):
        _, t, _ = guess_sample(p.name)
        runs[t] = Run(p).table(1, 1)
    if 0.0 not in runs or len(runs) < 3:
        return [], [], []
    t0 = runs[0.0]
    rt0, P0 = F.extract_trace(t0, parent, 0.5)
    pk = F.detect_peaks(rt0, P0)["peaks"]
    if not pk:
        return [], [], []
    ap = pk[0]["apex_rt"]
    tr = runs[min(t for t in runs if t >= 5.0)]
    near0, near5 = V._peaks_near(t0, "t0", ap, 5), V._peaks_near(tr, "t5", ap, 5)
    wide0, wide5 = V._peaks_near(t0, "t0", ap, 60, 1e5, 8.0, 1.5), V._peaks_near(tr, "t5", ap, 60, 1e5, 8.0, 1.5)
    labels = {}
    for k, v in near5.items():
        if abs(v[0] - parent) >= 0.6 and k in near0:
            labels[k] = 1
    for k, v in wide5.items():
        if k not in labels and k not in wide0 and abs(v[1]) > 5 and abs(v[0] - parent) >= 0.6:
            labels[k] = 0
    near5 = {**wide5, **near5}
    samples = [{"label": "t%g" % t, "time": float(t), "table": runs[t], "key": "real_t%g" % t} for t in sorted(runs) if t >= 5.0]
    rows, y, grp = [], [], []
    for k, lab in labels.items():
        rep = F.origin_report(samples, near5[k][0], parent, top=0)
        if "profile" not in rep:
            continue
        rows.append(features(rep)); y.append(lab); grp.append("real")
    return rows, y, grp


def _auc_cv(X, y, grp, lam, folds: int = 5, seed: int = 0):
    """Cross-validated AUC and Brier score; folds are formed per group (series) when there are several groups, so that the same series is
    never in training and test together."""
    X, y = np.asarray(X, float), np.asarray(y, float)
    g = np.asarray(grp)
    ug = list(dict.fromkeys(g))
    rng = np.random.default_rng(seed)
    if len(ug) >= folds:
        order = rng.permutation(len(ug))
        fold_of = {ug[i]: j % folds for j, i in enumerate(order)}
        fid = np.array([fold_of[v] for v in g])
    else:
        fid = rng.permutation(len(y)) % folds
    pred = np.full(len(y), np.nan)
    for f in range(folds):
        te = fid == f
        if te.sum() == 0 or (y[~te].min() == y[~te].max()):
            continue
        mu, sd, coef, b = fit_logistic(X[~te], y[~te], lam)
        z = np.nan_to_num((X[te] - mu) / sd, nan=0.0)
        pred[te] = 1 / (1 + np.exp(-np.clip(b + z @ coef, -30, 30)))
    ok = np.isfinite(pred)
    return F.auc(pred[ok], y[ok]), float(np.mean((pred[ok] - y[ok]) ** 2))


def calibrate(n_series: int = 8, real_dir=None, lam: float = 2.0, write: bool = True) -> dict:
    """Fit the logistic model and (optionally) write `isf_model.py` next to this file. Returns the MODEL dict."""
    import datetime
    from pathlib import Path
    rows, y, grp = _synthetic_rows(n_series)
    n_syn = len(y)
    n_real = 0
    if real_dir is not None and Path(real_dir).exists():
        r2, y2, g2 = _real_rows(real_dir)
        rows += r2; y += y2; grp += g2; n_real = len(y2)
    X = np.array([[r[k] for k in FEATURES] for r in rows], float)
    y = np.array(y, float)
    # the real rows are few and easy: weight so that they count as much as ~1/3 of the synthetic ones, not more
    w = np.ones(len(y))
    if n_real:
        w[n_syn:] = min(1.0, (n_syn / 3) / n_real)
    mu, sd, coef, b = fit_logistic(X, y, lam, w)
    z = np.nan_to_num((X - mu) / sd, nan=0.0)
    p_in = 1 / (1 + np.exp(-np.clip(b + z @ coef, -30, 30)))
    auc_in = F.auc(p_in, y)
    auc_cv, brier_cv = _auc_cv(X, y, grp, lam)
    model = {"features": FEATURES, "mean": mu.tolist(), "std": sd.tolist(), "coef": coef.tolist(), "intercept": b,
             "meta": {"n_rows": int(len(y)), "n_synthetic": int(n_syn), "n_real": int(n_real), "n_pos": int(y.sum()), "lambda": lam,
                      "auc_in_sample": float(auc_in), "auc_cv": float(auc_cv), "brier_cv": float(brier_cv),
                      "date": datetime.date.today().isoformat(),
                      "note": "synthetic scenes (known truth) + real series B; isobaric hard case and MS2/DP ramp are NOT in the training"}}
    if write:
        out = Path(__file__).with_name("isf_model.py")
        out.write_text("# TPMINE-PRIVATE\n\"\"\"Parameters of the ISF logistic model, written by tpmine.isf.calibrate(). Do not edit by hand.\"\"\"\nMODEL = "
                       + repr(model) + "\n", encoding="utf-8")
    return model


if __name__ == "__main__":
    import sys
    m = calibrate(real_dir=sys.argv[1] if len(sys.argv) > 1 else None)
    print(m["meta"])
    for k, c in zip(m["features"], m["coef"]):
        print("%-12s %+.3f" % (k, c))
