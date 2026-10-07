# TPMINE-PRIVATE
"""Automatic MRM integration: area, RT, S/N of every transition in every MRM file, quantifier/qualifier ion ratio checked against the standards,
and a calibration line (quantifier area vs concentration from the standard names) used to quantify the other files."""
from __future__ import annotations

import re

import numpy as np

from .peaks import find_peak

CU = {"ppm": 1.0, "mgl": 1.0, "ppb": 1e-3, "ugl": 1e-3, "ppt": 1e-6, "ngl": 1e-6, "gl": 1e3}


def conc_from_name(name: str):
    """Concentration in mg/L from names like 'STD_0_6ppm', 'std12ppb', '2.4 ppm'; None when there is none."""
    low = name.lower().replace(" ", "")
    m = re.search(r"(\d+(?:[._,]\d+)?)(ppm|ppb|ppt|mg/?l|ug/?l|ng/?l|g/?l)", low)
    if not m:
        return None
    v = float(m.group(1).replace("_", ".").replace(",", "."))
    u = m.group(2).replace("/", "")
    return v * CU.get(u, 1.0)


def _srm(run):
    return [c for c in run.chromatograms() if c["kind"] == "srm"]


def analyse(samples, rt_tol: float = 0.25, smooth_k: int = 5, min_points: int = 5, ratio_tol: float = 0.30) -> dict | None:
    """samples: Sample objects of kind 'mrm' (name, label, time, type, run). Returns the tables or None when there is nothing to integrate."""
    data = []                       # per file: {sample, traces:{tid: (rt, y)}}
    tids: dict[tuple, dict] = {}
    for x in samples:
        tr = {}
        for c in _srm(x.run):
            key = (c["q1"], c["q3"])
            tids.setdefault(key, {"q1": c["q1"], "q3": c["q3"], "ce": c.get("ce"), "role": (c.get("name") or "").strip() or ""})
            tr[key] = x.run.chromatogram(c["index"])
        if tr:
            data.append((x, tr))
    if not data:
        return None
    keys = sorted(tids, key=lambda k: (0 if tids[k]["role"].lower().startswith("quant") else 1, k))
    quant = keys[0]
    # reference RT of the analyte: the apex of the quantifier in the strongest file, then every trace is integrated around it
    best = None
    for x, tr in data:
        if quant in tr:
            pk = find_peak(*tr[quant], rt_center=None, smooth_k=smooth_k, min_points=min_points)
            if pk and (best is None or pk["height"] > best["height"]):
                best = pk
    ref = best["apex_rt"] if best else None
    rows = []
    for x, tr in data:
        row = {"file": x.name, "label": x.label, "type": x.type, "time": x.time, "conc": conc_from_name(x.name), "ion": {}}
        for k in keys:
            pk = find_peak(*tr[k], rt_center=ref, rt_tol=rt_tol, smooth_k=smooth_k, min_points=min_points) if k in tr and ref is not None else None
            det = bool(pk and pk["ok"] and pk["snr"] >= 3)
            row["ion"][f"{k[0]:g}>{k[1]:g}"] = {"area": float(pk["area"]) if det else 0.0, "height": float(pk["height"]) if det else 0.0,
                                                "rt": float(pk["apex_rt"]) if det else None, "snr": float(pk["snr"]) if pk else 0.0, "detected": det,
                                                "left": float(pk["left"]) if pk else None, "right": float(pk["right"]) if pk else None}
        rows.append(row)
    names = [f"{k[0]:g}>{k[1]:g}" for k in keys]
    qn = names[0]
    for r in rows:        # ion ratios: every qualifier / quantifier
        a0 = r["ion"][qn]["area"]
        r["ratios"] = {n: (r["ion"][n]["area"] / a0 if a0 > 0 and r["ion"][n]["detected"] else None) for n in names[1:]}
    stds = [r for r in rows if r["type"] == "standard" and r["ion"][qn]["detected"]]
    ratio_ref = {n: (float(np.median([r["ratios"][n] for r in stds if r["ratios"][n] is not None])) if any(r["ratios"][n] is not None for r in stds) else None) for n in names[1:]}
    for r in rows:
        ok = []
        for n in names[1:]:
            ref_r, v = ratio_ref[n], r["ratios"][n]
            ok.append(None if (ref_r is None or v is None) else abs(v - ref_r) / ref_r <= ratio_tol)
        r["ratio_ok"] = None if not ok or any(o is None for o in ok) else all(ok)
    # calibration (quantifier area vs concentration), ordinary least squares
    pts = [(r["conc"], r["ion"][qn]["area"]) for r in rows if r["type"] == "standard" and r["conc"] is not None and r["ion"][qn]["detected"]]
    cal = None
    if len(pts) >= 3:
        x_, y_ = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
        a, b = np.polyfit(x_, y_, 1, w=1.0 / x_)          # 1/x^2 weighting (polyfit squares w): the usual choice over a wide range of concentrations
        pred = a * x_ + b
        ss_tot = float(((y_ - y_.mean()) ** 2).sum())
        cal = {"slope": float(a), "intercept": float(b), "weighting": "1/x²", "r2": float(1 - ((y_ - pred) ** 2).sum() / ss_tot) if ss_tot > 0 else 0.0,
               "points": [{"conc": float(c), "area": float(ar)} for c, ar in pts], "unit": "mg/L", "lo": float(x_.min()), "hi": float(x_.max())}
        for r in rows:
            ar = r["ion"][qn]["area"]
            r["quant"] = float((ar - b) / a) if a > 0 and r["type"] != "standard" and r["ion"][qn]["detected"] else None
            r["in_range"] = None if r["quant"] is None else bool(cal["lo"] <= r["quant"] <= cal["hi"])
    else:
        for r in rows:
            r["quant"], r["in_range"] = None, None
    rows.sort(key=lambda r: (r["type"] != "standard", r["conc"] if r["type"] == "standard" and r["conc"] is not None else (r["time"] if r["time"] is not None else 1e9)))
    return {"transitions": [{**tids[k], "name": names[i]} for i, k in enumerate(keys)], "quantifier": qn, "ref_rt": ref, "rows": rows, "ratio_ref": ratio_ref,
            "ratio_tol": ratio_tol, "calibration": cal}
