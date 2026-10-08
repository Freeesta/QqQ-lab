# TPMINE-PRIVATE
"""MS2 of the features (WP7): the DDA scans that fragmented a feature, pooled over files, their consensus spectrum, and the separation of
co-eluting isomers from the way the fragments rise and fall across consecutive MS2 scans. numpy only."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from qqq_lab import ionfamily


def consensus_arrays(mzs, ints, ppm: float = 8.0, min_frac: float = 0.4, min_rel: float = 0.0, n_total: int | None = None):
    """Consensus of centroid spectra given as lists of arrays: each spectrum normalised to its maximum, peaks within `ppm` of the next merged
    (sort, diff, cumsum of the breaks), kept when present in at least `min_frac` of the spectra and with a mean relative intensity of at least
    `min_rel` (1 = 100 %). `n_total` = number of spectra counted in the fractions (default: the number given). Returns (mz, mean relative
    intensity over n_total, number of spectra that have the peak)."""
    keep_s = [i for i in range(len(mzs)) if len(mzs[i]) and np.max(ints[i]) > 0]
    n = len(mzs) if n_total is None else n_total
    if not keep_s:
        return np.zeros(0), np.zeros(0), np.zeros(0, int)
    mz = np.concatenate([np.asarray(mzs[i], float) for i in keep_s])
    it = np.concatenate([np.asarray(ints[i], float) / np.max(ints[i]) for i in keep_s])
    sid = np.concatenate([np.full(len(mzs[i]), i) for i in keep_s])
    pos = it > 0                                                   # a zero is not a peak (some converters write them)
    mz, it, sid = mz[pos], it[pos], sid[pos]
    o = np.argsort(mz, kind="stable")
    mz, it, sid = mz[o], it[o], sid[o]
    lab = np.zeros(len(mz), np.int64)
    lab[1:] = np.cumsum(np.diff(mz) > mz[1:] * ppm * 1e-6)
    w = np.bincount(lab, it)
    cm = np.bincount(lab, it * mz) / w
    key = lab * (len(mzs) + 1) + sid
    nsc = np.bincount(lab[np.unique(key, return_index=True)[1]], minlength=len(w))
    mean = w / n
    keep = (nsc >= max(1, min_frac * n)) & (mean >= min_rel)
    return cm[keep], mean[keep], nsc[keep]


@dataclass
class Ms2Index:
    """The level-2 scans of one file, as arrays (no peaks): enough to find the MS2 of a feature without keeping the file open."""
    path: str
    scan: np.ndarray                # index in the file
    rt: np.ndarray                  # minutes
    center: np.ndarray              # centre of the isolation window (not the 'selected ion': it can be off by up to 3 Da)
    act: np.ndarray                 # "HCD" / "CID" / ...
    ce: np.ndarray

    def __len__(self):
        return len(self.scan)


def index_ms2(run, path: str | None = None) -> Ms2Index:
    ms = [s for s in run.scans if s.level == 2 and s.iso is not None]
    return Ms2Index(path=str(path if path is not None else run.path), scan=np.array([s.index for s in ms], int), rt=np.array([s.rt for s in ms]),
                    center=np.array([(s.iso[0] + s.iso[1]) / 2 for s in ms]), act=np.array([s.act or "" for s in ms]),
                    ce=np.array([s.collision_energy if s.collision_energy is not None else np.nan for s in ms]))


def select_ms2(indexes: list[Ms2Index], mz: float, limits, ppm: float = 10.0, act: str | None = None) -> list[tuple[int, int, float]]:
    """(file position, scan index, rt) of the MS2 of `mz`: isolation centre within `ppm`, retention time inside the limits of the peak in that file.
    limits: [(left, right)] per file (NaN where the feature is not in the file); act: keep only this activation (HCD / CID)."""
    out = []
    for k, ix in enumerate(indexes):
        lo, hi = limits[k]
        if not (np.isfinite(lo) and np.isfinite(hi)) or len(ix) == 0:
            continue
        ok = (np.abs(ix.center - mz) <= mz * ppm * 1e-6) & (ix.rt >= lo) & (ix.rt <= hi)
        if act:
            ok &= ix.act == act
        for i in np.flatnonzero(ok):
            out.append((k, int(ix.scan[i]), float(ix.rt[i])))
    return out


def read_spectra(runs, selection):
    """Peaks of the selected scans: runs[k] = an open Run for the file at position k (or a callable returning it). Returns lists (mz, intensity, rt)."""
    mzs, ints, rts = [], [], []
    for k, i, rt in selection:
        r = runs[k]() if callable(runs[k]) else runs[k]
        a, b = r.read(i)
        mzs.append(a)
        ints.append(b)
        rts.append(rt)
    return mzs, ints, np.array(rts)


def ms2_consensus(mzs, ints, ppm: float = 8.0, min_frac: float = 0.4, min_rel: float = 0.005) -> dict:
    """Consensus MS2 of a feature: peaks in at least 40 % of the scans and at least 0.5 % of the base peak, relative to the strongest (= 100)."""
    mz, rel, n = consensus_arrays(mzs, ints, ppm, min_frac, min_rel)
    if len(mz):
        rel = 100.0 * rel / rel.max()
    return {"mz": mz, "rel": rel, "n_found": n, "n_scans": len(mzs)}


# ---------------------------------------------------------------------------------------------------------------------- isomers
def fragment_matrix(mzs, ints, ppm: float = 8.0, min_scans: int = 2, row_norm: bool = True):
    """D (scans x fragments): each column a fragment that appears in at least `min_scans` scans (peaks merged within `ppm`), each row a scan
    normalised to its maximum. Returns (D, fragment m/z)."""
    n = len(mzs)
    ks = [i for i in range(n) if len(mzs[i])]
    if not ks:
        return np.zeros((n, 0)), np.zeros(0)
    mz = np.concatenate([np.asarray(mzs[i], float) for i in ks])
    it = np.concatenate([np.asarray(ints[i], float) / max(np.max(ints[i]), 1e-12) for i in ks])
    sid = np.concatenate([np.full(len(mzs[i]), i) for i in ks])
    o = np.argsort(mz, kind="stable")
    mz, it, sid = mz[o], it[o], sid[o]
    lab = np.zeros(len(mz), np.int64)
    lab[1:] = np.cumsum(np.diff(mz) > mz[1:] * ppm * 1e-6)
    ncol = lab[-1] + 1
    D = np.zeros((n, ncol))
    np.add.at(D, (sid, lab), it)
    cm = np.bincount(lab, it * mz) / np.maximum(np.bincount(lab, it), 1e-12)
    cnt = (D > 0).sum(0)
    keep = cnt >= min_scans
    D, cm = D[:, keep], cm[keep]
    if row_norm and D.size:
        D = D / np.maximum(D.max(1, keepdims=True), 1e-12)
    return D, cm


def deconvolve_isomers(mzs, ints, rts, xic=None, min_scans: int = 4, max_components: int = 3, ppm: float = 8.0, min_frac_sig: float = 0.02, allowed=None, subpeak_tol: float = 0.07) -> dict:
    """Is the MS2 of a feature a mixture of co-eluting isomers? With at least `min_scans` MS2 scans across the peak, the matrix D (scans x
    fragments) is analysed by `ionfamily.estimate_components`; when two or more components are found, `ionfamily.mcr_als` (unimodal elution
    profiles) gives their spectra, and each component is tied to a sub-peak of the MS1 trace by correlation of the profiles.

    xic = (rt, intensity) of the MS1 trace of the feature (optional). allowed = function m/z array -> bool array: the fragments that may enter the
    matrix (e.g. those with a formula that is a sub-formula of the precursor: a contaminant co-isolated in one scan would otherwise become a
    'component'). Returns {"k", "components": [{"rt_apex", "spectrum": (mz, rel), "profile",
    "xic_corr", "n_scans_main"}], "scans", "lof"}; with a single component the one consensus spectrum is returned as component 0."""
    rts = np.asarray(rts, float)
    o = np.argsort(rts, kind="stable")
    rts = rts[o]
    mzs = [mzs[i] for i in o]
    ints = [ints[i] for i in o]
    D, cm = fragment_matrix(mzs, ints, ppm)
    if allowed is not None and len(cm):
        ok = np.asarray(allowed(cm), bool)
        D, cm = D[:, ok], cm[ok]
        if D.size:
            D = D / np.maximum(D.max(1, keepdims=True), 1e-12)
    out = {"k": 1, "components": [], "scans": len(rts), "fragments": len(cm)}
    if len(rts) < min_scans or D.shape[1] < 3:
        cons = ms2_consensus(mzs, ints, ppm)
        out["components"] = [{"rt_apex": float(rts[np.argmax([np.sum(i) for i in ints])]) if len(rts) else None, "spectrum": (cons["mz"], cons["rel"]), "profile": None, "xic_corr": None}]
        return out
    est = ionfamily.estimate_components(D, max_k=max_components)
    k = int(est["k"])
    S0 = None
    seeds = []
    if xic is not None and len(xic[0]) > 3:
        # the MS1 trace shows how many isomers there are and when each elutes: seed one component per sub-peak that has MS2 scans near its apex
        xr, xy = np.asarray(xic[0], float), np.asarray(xic[1], float)
        peaks = subpeaks(xr, xy)
        near = [np.flatnonzero(np.abs(rts - p) <= subpeak_tol) for p in peaks]
        seeds = [(p, ix) for p, ix in zip(peaks, near) if len(ix)]
        if len(seeds) >= 2:
            k = min(len(seeds), max_components)
            seeds = sorted(sorted(seeds, key=lambda t: -len(t[1]))[:k], key=lambda t: t[0])
            S0 = np.column_stack([D[ix].mean(0) for _, ix in seeds])
    out["k"] = k
    if k < 2:
        cons = ms2_consensus(mzs, ints, ppm)
        out["components"] = [{"rt_apex": float(rts[int(np.argmax(D.sum(1)))]), "spectrum": (cons["mz"], cons["rel"]), "profile": None, "xic_corr": None}]
        return out
    res = ionfamily.mcr_als(D, k=k, unimodal=True, S0=S0)
    C, S = res["C"], res["S"]
    out["lof"] = float(res["lof"])
    comps = []
    for j in range(S.shape[1]):
        s = S[:, j]
        keep = s >= min_frac_sig * s.max()
        rel = 100.0 * s[keep] / s.max()
        prof = C[:, j] / max(C[:, j].max(), 1e-12)
        corr = None
        if xic is not None and len(xic[0]) > 3:
            xr, xy = np.asarray(xic[0], float), np.asarray(xic[1], float)
            yi = np.interp(rts, xr, xy)
            corr = float(np.corrcoef(prof, yi)[0, 1]) if np.std(prof) > 0 and np.std(yi) > 0 else None
        comps.append({"rt_apex": float(rts[int(np.argmax(C[:, j]))]), "spectrum": (cm[keep], rel), "profile": prof.tolist(), "xic_corr": corr,
                      "n_scans_main": int((prof >= 0.5).sum())})
    comps.sort(key=lambda c: c["rt_apex"])
    out["components"] = comps
    return out


def subpeaks(rt: np.ndarray, y: np.ndarray, min_rel: float = 0.15, smooth_min: float = 0.03, min_sep: float = 0.08) -> list[float]:
    """Retention times of the apexes of the sub-peaks of an MS1 trace: Savitzky-Golay smoothing over `smooth_min` minutes, local maxima above
    `min_rel` of the highest, and at least `min_sep` minutes apart (the higher one of two close maxima stays)."""
    rt, y = np.asarray(rt, float), np.asarray(y, float)
    if len(y) < 5:
        return [float(rt[int(np.argmax(y))])] if len(y) else []
    dt = float(np.median(np.diff(rt)))
    w = max(5, int(round(smooth_min / max(dt, 1e-9))) | 1)
    w = min(w, len(y) - (1 - len(y) % 2))
    ys = ionfamily.savgol(y, w, 2) if w >= 5 else y
    pk = np.flatnonzero((ys[1:-1] >= ys[:-2]) & (ys[1:-1] > ys[2:]) & (ys[1:-1] >= min_rel * ys.max())) + 1
    pk = pk[np.argsort(-ys[pk])]
    kept: list[int] = []
    for i in pk:
        if all(abs(rt[i] - rt[j]) >= min_sep for j in kept):
            kept.append(int(i))
    return sorted(float(rt[i]) for i in kept)


def match_peaks(spec_a, spec_b, ppm: float = 8.0, min_rel: float = 5.0) -> dict:
    """Which strong fragments (>= min_rel %) of spectrum A are absent from spectrum B and vice versa: {'only_a': [...], 'only_b': [...], 'both': [...]}.
    Used to describe isomers ('without the fragment at ...')."""
    ma, ra = spec_a
    mb, rb = spec_b
    sa, sb = ma[ra >= min_rel], mb[rb >= min_rel]
    in_b = np.array([np.any(np.abs(mb - m) <= m * ppm * 1e-6) for m in sa]) if len(sa) else np.zeros(0, bool)
    in_a = np.array([np.any(np.abs(ma - m) <= m * ppm * 1e-6) for m in sb]) if len(sb) else np.zeros(0, bool)
    return {"only_a": sa[~in_b].tolist(), "only_b": sb[~in_a].tolist(), "both": sa[in_b].tolist()}
