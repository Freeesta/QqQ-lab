"""Validation of mzlab.ionfamily on the real flufenacet series (B_FullMass-t*.mzML), with the best truth the data allow.

No full-scan file of the pure standard exists, so t0 (before irradiation: only the parent is in the vial) plays its role:
  positive (parent-derived: ISF / isotope / adduct / detector artefact of the strong parent) = ion with its own peak (SNR >= 10,
            height >= 2e5 cps) within +-5 s of the parent apex both at t0 and at t5;
  negative (formed during the treatment, EASY) = peak at t5 5-60 s away from the parent apex and no peak at t0 within +-60 s.
  A hard negative (a product co-eluting within +-5 s that is absent at t0) does not exist in this series: every ion that is at the
  parent's peak at t5 is also there at t0 in a similar ratio. So the thresholds below are NOT calibrated on real hard cases.
The metrics are measured on t5 (parent still 1/3, products already formed) and, for kinetics, on t5..t60 WITHOUT t0 (so the label
does not leak into the feature). Prints AUC per metric, the Youden threshold and its cross-validated stability. The labels are a
weak truth (a pure-standard full-scan file would be better): the numbers are indications for the thresholds, not a proof.
Usage: python3 tools/validate_ionfamily.py [folder with the mzML] [parent m/z, default 364.35]"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mzlab import ionfamily as f  # noqa: E402
from mzlab.project import guess_sample  # noqa: E402
from mzlab.reader.mzml import Run  # noqa: E402


def _peaks_near(tb, key, ap, half_s, hmin=2e5, snr=10.0, span=1.0):
    """{rounded m/z: (apex offset s, height, area)} of the ROIs with a peak within +-half_s of ap."""
    w = f.build_rois(tb, ap - span, ap + span, key=key)
    out = {}
    for j in range(len(w.mz)):
        if w.X[j].max() < hmin or (w.X[j] > 0).sum() < 5:
            continue
        for p in f.detect_peaks(w.rt, w.X[j])["peaks"]:
            if abs(p["apex_rt"] - ap) * 60 <= half_s and p["height"] >= hmin and p["snr"] >= snr:
                out[round(float(w.mz[j]), 1)] = (float(w.mz[j]), (p["apex_rt"] - ap) * 60, p["height"], p["area"])
                break
    return out


def main(folder: Path, parent: float = 364.35):
    runs = {}
    for p in sorted(folder.glob("B_FullMass-t*.mzML")):
        lab, t, _ = guess_sample(p.name)
        runs[t] = Run(p).table(1, 1)
    t0, tr = runs[0.0], runs[5.0]
    rt0, P0 = f.extract_trace(t0, parent, 0.5)
    pk = f.detect_peaks(rt0, P0)["peaks"][0]
    ap = pk["apex_rt"]
    a0, a1 = float(rt0[pk["lo"]]), float(rt0[pk["hi"]])
    w0, w1 = ap - 0.7, ap + 0.7
    area = lambda tb, mz: f._area_in(*f.extract_trace(tb, mz, 0.35, w0, w1), a0, a1)
    P_area0, P_area5 = area(t0, parent), area(tr, parent)
    near0, near5 = _peaks_near(t0, "t0", ap, 5), _peaks_near(tr, "t5", ap, 5)
    wide0, wide5 = _peaks_near(t0, "t0", ap, 60, 1e5, 8.0, 1.5), _peaks_near(tr, "t5", ap, 60, 1e5, 8.0, 1.5)   # easy negatives: formed ions 5-60 s away
    labels = {}
    for k, v in near5.items():
        if abs(v[0] - parent) < 0.6:
            continue
        if k in near0:
            labels[k] = 1
    for k, v in wide5.items():
        if k not in labels and k not in wide0 and abs(v[1]) > 5 and abs(v[0] - parent) >= 0.6:
            labels[k] = 0
    near5 = {**wide5, **near5}
    rtw, Pw = f.extract_trace(tr, parent, 0.35, w0, w1)
    pkr = f.detect_peaks(rtw, Pw)["peaks"][0]
    rows = []
    for k, lab in labels.items():
        mz = near5[k][0]
        _, X = f.extract_trace(tr, mz, 0.35, w0, w1)
        s = f.profile_similarity(rtw, X, Pw, p_apex_rt=pkr["apex_rt"], n_boot=0, n_shift=100)
        if not s.get("n_scans"):
            continue
        rf = f.ratio_fit(rtw, X, Pw, (pkr["lo"], pkr["hi"]), n_boot=0)
        ts = [t for t in sorted(runs) if t >= 5.0]
        kn = f.kinetics(ts, [area(runs[t], parent) for t in ts], [area(runs[t], mz) for t in ts])
        nz = lambda v, d: d if v is None or not math.isfinite(v) else v
        rows.append({"mz": mz, "lab": lab, "pearson": nz(s.get("pearson"), -1), "spearman": nz(s.get("spearman"), -1),
                     "deriv": nz(s.get("deriv_corr"), -1), "cosine": nz(s.get("cosine"), -1), "apex": -abs(nz(s.get("apex_diff_s"), 60)),
                     "fwhm": -abs(math.log(max(nz(s.get("fwhm_ratio"), 0.01), 0.01))), "pshift": -nz(s.get("p_shift"), 1.0),
                     "cv": -nz(rf.get("cv_ratio") if rf.get("ok") else None, 5), "r2": nz(rf.get("r2") if rf.get("ok") else None, -1),
                     "kin_sp": nz(kn.get("spearman_parent"), -1), "kin_tau": nz(kn.get("kendall_parent"), -1)})
    y = np.array([r["lab"] for r in rows])
    print("ions evaluated: %d (positive %d, negative %d); parent area t0/t5 = %.3g / %.3g" % (len(y), y.sum(), (1 - y).sum(), P_area0, P_area5))
    if y.sum() < 3 or (1 - y).sum() < 3:
        print("too few ions in one class")
        return rows
    print("%-10s %6s  %-11s %-10s %s" % ("metric", "AUC", "thr(Youden)", "cv balAcc", "thr sd"))
    for k in ("pearson", "spearman", "deriv", "cosine", "apex", "fwhm", "pshift", "cv", "r2", "kin_sp", "kin_tau"):
        sc = np.array([r[k] for r in rows])
        yt = f.youden_threshold(sc, y)
        cv = f.cv_threshold(sc, y)
        print("%-10s %6.3f  %-11.3f %-10.3f %.3f" % (k, f.auc(sc, y), yt["thr"], cv["balanced_accuracy"], cv["thr_sd"]))
    return rows


def synthetic(n_seeds: int = 12):
    """Same table on synthetic truth (demo.isf_scene): positives = ISF/isotope/adduct, negatives = the three products
    (one of them co-eluting 6 s after the parent with another shape)."""
    from mzlab import demo
    sc, lab = {k: [] for k in ("pearson", "spearman", "deriv", "cosine", "apex", "fwhm", "pshift", "cv")}, []
    pos = {"ISF_H2O", "ISF_big", "ISF_small", "M+1", "M+Na"}
    neg = {"TP_early", "TP_late", "TP_coelute"}
    nz = lambda v, d: d if v is None or not math.isfinite(v) else v
    for i in range(n_seeds):
        t = [5, 10, 15, 20, 30, 45][i % 6]
        tb, ions = demo.isf_scene(t, 1000 + i)
        ions = {x["name"]: x for x in ions}
        rt, P = f.extract_trace(tb, ions["P"]["mz"] + demo.ISF_OFFSET, 0.35, 7.0, 9.0)
        for name in pos | neg:
            _, X = f.extract_trace(tb, ions[name]["mz"] + demo.ISF_OFFSET, 0.35, 7.0, 9.0)
            s = f.profile_similarity(rt, X, P, n_boot=0, n_shift=100)
            pk = s.get("p_peak")
            rf = f.ratio_fit(rt, X, P, (pk["lo"], pk["hi"]), n_boot=0) if pk else {"ok": False}
            lab.append(int(name in pos))
            sc["pearson"].append(nz(s.get("pearson"), -1)); sc["spearman"].append(nz(s.get("spearman"), -1))
            sc["deriv"].append(nz(s.get("deriv_corr"), -1)); sc["cosine"].append(nz(s.get("cosine"), -1))
            sc["apex"].append(-abs(nz(s.get("apex_diff_s"), 60))); sc["fwhm"].append(-abs(math.log(max(nz(s.get("fwhm_ratio"), 0.01), 0.01))))
            sc["pshift"].append(-nz(s.get("p_shift"), 1.0)); sc["cv"].append(-nz(rf.get("cv_ratio") if rf.get("ok") else None, 5))
    res = f.calibrate_thresholds({k: np.array(v) for k, v in sc.items()}, lab)
    print("synthetic: %d ions (positive %d)" % (len(lab), sum(lab)))
    for k, v in res.items():
        print("%-10s AUC %.3f  thr %.3f  cv balAcc %.3f  thr sd %.3f" % (k, v["auc"], v["thr"], v["cv"]["balanced_accuracy"], v["cv"]["thr_sd"]))


if __name__ == "__main__":
    if "--synthetic" in sys.argv:
        synthetic()
        sys.exit(0)
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "Data" / "mzML"
    main(folder, float(sys.argv[2]) if len(sys.argv) > 2 else 364.35)
