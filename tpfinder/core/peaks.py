"""Smoothing, peak detection and integration of an ion chromatogram. Only numpy."""
from __future__ import annotations

import numpy as np


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
        area = float(np.trapezoid(np.clip(y[seg] - yb, 0, None), rt[seg]) * 60.0)
    else:
        area = 0.0
    half = base + height / 2
    above = np.flatnonzero(ys[seg] >= half)
    fwhm = float((rt[seg][above[-1]] - rt[seg][above[0]]) * 60.0) if len(above) >= 2 else 0.0
    return {"apex_rt": float(rt[ia]), "height": float(height), "area": area, "fwhm": fwhm,
            "snr": float(height / noise), "points": int(n_pts), "left": float(rt[l]), "right": float(rt[r]),
            "ok": bool(n_pts >= min_points)}
