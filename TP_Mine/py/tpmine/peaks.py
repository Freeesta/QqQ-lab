# TPMINE-PRIVATE
"""Smoothing, peak detection and integration of an ion chromatogram. Only numpy."""
from __future__ import annotations

import numpy as np

_trapz = getattr(np, "trapezoid", None) or np.trapz


def smooth(y: np.ndarray, k: int = 3) -> np.ndarray:
    """Light smoothing: 1-2-1 (k=3) or 1-4-6-4-1 (k=5); edges keep their own value weight."""
    if k <= 1 or len(y) < k:
        return np.asarray(y, float)
    w = np.array([1, 2, 1], float) if k == 3 else np.array([1, 4, 6, 4, 1], float)
    num = np.convolve(y, w, mode="same")
    den = np.convolve(np.ones(len(y)), w, mode="same")
    return num / den


def find_peak(rt: np.ndarray, y: np.ndarray, rt_center: float | None = None, rt_tol: float = 0.25,
              smooth_k: int = 3, min_points: int = 5) -> dict | None:
    """The peak of y around rt_center (+- rt_tol minutes), or the highest one when rt_center is None.
    Returns apex_rt, height, area (counts x s, linear baseline removed), fwhm (s), snr, points, left,
    right (rt), or None when the trace is empty."""
    rt, y = np.asarray(rt, float), np.asarray(y, float)
    if len(rt) < 3 or y.max() <= 0:
        return None
    ys = smooth(y, smooth_k)
    lo, hi = (rt[0], rt[-1]) if rt_center is None else (rt_center - rt_tol, rt_center + rt_tol)
    inside = np.flatnonzero((rt >= lo) & (rt <= hi))
    if len(inside) == 0:
        return None
    ia = inside[np.argmax(ys[inside])]
    apex = ys[ia]
    if apex <= 0:
        return None
    # noise from the points far from the peak: median and MAD
    far = np.abs(rt - rt[ia]) > max(rt_tol, 0.3)
    ref = ys[far] if far.sum() >= 10 else ys
    base = float(np.median(ref))
    noise = float(1.4826 * np.median(np.abs(ref - base))) or float(np.std(ref)) or 1.0
    height = apex - base
    # edges: walk down until the signal is below 1 % of the height (or the noise), or goes up again.
    # Ripples in the upper half of the peak (a spray dip of one scan) are not valleys: ignored there.
    thr = base + max(0.01 * height, noise)
    top = base + 0.5 * height
    l = ia
    while l > 0 and ys[l - 1] > thr and (ys[l - 1] <= ys[l] * 1.05 + noise or ys[l] > top):
        l -= 1
    r = ia
    while r < len(ys) - 1 and ys[r + 1] > thr and (ys[r + 1] <= ys[r] * 1.05 + noise or ys[r] > top):
        r += 1
    seg = slice(l, r + 1)
    # points across the peak: contiguous RAW scans around the apex above 5 % of the height. Isolated
    # noise spikes (even two close ones) give 1-2 points; a real chromatographic peak gives many more.
    lim = base + 0.05 * height
    ia_raw = int(np.clip(ia - 1 + np.argmax(y[max(ia - 1, 0):ia + 2]), 0, len(y) - 1))
    a_, b_ = ia_raw, ia_raw
    while a_ > 0 and y[a_ - 1] >= lim:
        a_ -= 1
    while b_ < len(y) - 1 and y[b_ + 1] >= lim:
        b_ += 1
    n_pts = b_ - a_ + 1
    if r - l + 1 >= 2:
        yb = y[l] + (y[r] - y[l]) * (rt[seg] - rt[l]) / max(rt[r] - rt[l], 1e-9)
        area = float(_trapz(np.clip(y[seg] - yb, 0, None), rt[seg]) * 60.0)
    else:
        area = 0.0
    half = base + height / 2
    above = np.flatnonzero(ys[seg] >= half)
    fwhm = float((rt[seg][above[-1]] - rt[seg][above[0]]) * 60.0) if len(above) >= 2 else 0.0
    return {"apex_rt": float(rt[ia]), "height": float(height), "area": area, "fwhm": fwhm,
            "snr": float(height / noise), "points": int(n_pts), "left": float(rt[l]), "right": float(rt[r]),
            "ok": bool(n_pts >= min_points)}


def find_peaks(rt: np.ndarray, y: np.ndarray, rt_tol: float = 0.25, smooth_k: int = 3, min_points: int = 5, snr_min: float = 3.0,
               valley_max: float = 0.5, max_peaks: int = 8) -> list[dict]:
    """Every chromatographic peak of y above the noise, strongest first (same dict as find_peak, only the valid ones: ok and S/N >= snr_min).
    Two maxima are one peak unless the valley between them drops below valley_max x the lower of the two (heights above the baseline)."""
    rt, y = np.asarray(rt, float), np.asarray(y, float)
    if len(rt) < 3 or y.max() <= 0:
        return []
    ys = smooth(y, smooth_k)
    base = float(np.median(ys))
    noise = float(1.4826 * np.median(np.abs(ys - base))) or float(np.std(ys[ys <= np.percentile(ys, 90)])) or 1.0
    thr = max(base + 3.0 * noise, base + 0.05 * (float(ys.max()) - base))       # a peak under 5 % of the strongest one is not worth a candidate
    mid = ys[1:-1]
    idx = [int(i) + 1 for i in np.flatnonzero((mid >= ys[:-2]) & (mid > ys[2:]) & (mid > thr))]
    if ys[0] > thr and ys[0] > ys[1]:
        idx.insert(0, 0)
    if ys[-1] > thr and ys[-1] >= ys[-2] and (not idx or idx[-1] != len(ys) - 1):
        idx.append(len(ys) - 1)
    while len(idx) > 1:                       # drop the lower side of the pair whose valley is shallowest, until every valley is deep enough
        worst, drop = valley_max, None
        for a, b in zip(idx[:-1], idx[1:]):
            lo = min(ys[a], ys[b]) - base
            ratio = (float(ys[a:b + 1].min()) - base) / lo if lo > 0 else 1.0
            if ratio > worst:
                worst, drop = ratio, (a if ys[a] < ys[b] else b)
        if drop is None:
            break
        idx.remove(drop)
    idx = sorted(idx, key=lambda i: -ys[i])[:max_peaks]
    dt = float(np.median(np.diff(rt))) if len(rt) > 1 else 0.0
    out = []
    for i in idx:
        gap = min([abs(rt[i] - rt[j]) for j in idx if j != i] or [rt_tol])
        pk = find_peak(rt, y, rt_center=float(rt[i]), rt_tol=max(min(rt_tol, 0.5 * gap), 2 * dt), smooth_k=smooth_k, min_points=min_points)
        if pk and pk["ok"] and pk["snr"] >= snr_min:
            out.append(pk)
    out.sort(key=lambda pk: -pk["height"])
    return out
