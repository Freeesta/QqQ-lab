# TPMINE-PRIVATE
"""Modified cosine between MS2 spectra, in batches (WP8): all pairs of a few hundred candidates, or one reference against all of them, without a
Python loop over pairs or peaks. The matching is the one of `ionfamily.ms2_similarity`: a peak of one spectrum pairs with a peak of the other at the
same m/z or shifted by the difference of the precursors, heaviest pairs first, each peak used once (`ionfamily.greedy_match`, locally dominant
rounds = global greedy). numpy only.

Compare HCD with HCD of the same series. The CID spectrum of the direct infusion is a reference for formulas and genealogy, never for this
similarity (measured: the same parent gives a cosine of 0.52 between HCD and CID)."""
from __future__ import annotations

import numpy as np

from mzlab import ionfamily

K = 32                      # peaks kept per spectrum
TOL_HR = 0.005              # Da, high resolution (0.5 at unit resolution)
PAD = -1e9


def prepare(mz, inten, precursor: float, k: int = K, min_rel: float = 0.01, mz_cut: float = 1.5):
    """Peaks of a spectrum ready for comparison: the precursor and everything above `precursor - mz_cut` removed, peaks below `min_rel` of the
    strongest left out, the `k` strongest kept, sqrt of the intensities, unit L2 norm. Returns (mz sorted ascending, weights)."""
    mz, inten = np.asarray(mz, float), np.asarray(inten, float)
    keep = (mz < precursor - mz_cut) & (inten > 0)
    mz, inten = mz[keep], inten[keep]
    if len(mz) == 0:
        return mz, inten
    keep = inten >= min_rel * inten.max()
    mz, inten = mz[keep], inten[keep]
    o = np.argsort(-inten, kind="stable")[:k]
    mz, w = mz[o], np.sqrt(inten[o])
    w = w / np.linalg.norm(w)
    s = np.argsort(mz, kind="stable")
    return mz[s], w[s]


def pad(spectra, precursors, k: int = K):
    """Matrices M (N, k) of m/z (padded with a huge negative number: it never matches) and W (N, k) of weights, and the precursors P (N,)."""
    n = len(spectra)
    M = np.full((n, k), PAD)
    W = np.zeros((n, k))
    for i, (m, w) in enumerate(spectra):
        M[i, :len(m)] = m[:k]
        W[i, :len(w)] = w[:k]
    return M, W, np.asarray(precursors, float)


def modified_cosine(M, W, P, ia, ib, tol: float = TOL_HR, batch: int = 1000):
    """Modified cosine and number of matched peaks of the pairs (ia[j], ib[j]). Matrices from `pad`. Pairs are processed in batches of `batch`
    (memory ~ batch x k x k x 8 bytes x 4)."""
    ia, ib = np.asarray(ia, int), np.asarray(ib, int)
    score = np.zeros(len(ia))
    nmat = np.zeros(len(ia), int)
    for s in range(0, len(ia), batch):
        a, b = ia[s:s + batch], ib[s:s + batch]
        d = (P[b] - P[a])[:, None, None]
        diff = M[b][:, None, :] - M[a][:, :, None]
        S = np.where((np.abs(diff) <= tol) | (np.abs(diff - d) <= tol), W[a][:, :, None] * W[b][:, None, :], 0.0)
        score[s:s + batch], nmat[s:s + batch] = ionfamily.greedy_match(S)
    return score, nmat


def plain_cosine(M, W, ia, ib, tol: float = TOL_HR, batch: int = 1000):
    """Cosine with no precursor shift (peaks at the same m/z only), same matching."""
    ia, ib = np.asarray(ia, int), np.asarray(ib, int)
    score = np.zeros(len(ia))
    for s in range(0, len(ia), batch):
        a, b = ia[s:s + batch], ib[s:s + batch]
        diff = M[b][:, None, :] - M[a][:, :, None]
        S = np.where(np.abs(diff) <= tol, W[a][:, :, None] * W[b][:, None, :], 0.0)
        score[s:s + batch] = ionfamily.greedy_match(S)[0]
    return score


def bin_matrices(M, W, P, binw: float = 1.0, mmax: float = 1500.0):
    """Dense matrices F (fragments) and L (neutral losses = precursor - fragment) on `binw` bins, float32, each peak 'smeared' by +-1 bin so that a
    pair of peaks on either side of a bin edge still meets. Returns (F, L, Fs, Ls): products F @ Fs.T + L @ Ls.T bound the modified cosine."""
    n, k = M.shape
    nb = int(mmax / binw) + 2
    F = np.zeros((n, nb), np.float32)
    L = np.zeros((n, nb), np.float32)
    rows = np.repeat(np.arange(n), k)
    ok = M.ravel() > 0
    fb = np.clip((M.ravel() / binw + 0.5).astype(int), 0, nb - 1)
    lb = np.clip(((P[rows] - M.ravel()) / binw + 0.5).astype(int), 0, nb - 1)
    w = W.ravel().astype(np.float32)
    np.maximum.at(F, (rows[ok], fb[ok]), w[ok])
    np.maximum.at(L, (rows[ok], lb[ok]), w[ok])

    def smear(X):
        return np.maximum(X, np.maximum(np.roll(X, 1, 1), np.roll(X, -1, 1)))
    return F, L, smear(F), smear(L)


def upper_bound(F, L, Fs, Ls, rows=None, cols=None):
    """Prefilter score (two matrix products): >= 0.3 loses no pair whose modified cosine is >= 0.5 (measured on two real files). rows / cols:
    index arrays to compare a subset (reference spectra against candidates) instead of everything against everything."""
    r = np.arange(len(F)) if rows is None else np.asarray(rows)
    c = np.arange(len(F)) if cols is None else np.asarray(cols)
    return F[r] @ Fs[c].T + L[r] @ Ls[c].T


def pairs_above(U: np.ndarray, threshold: float = 0.3, upper_triangle: bool = True):
    """Index pairs (i, j) with U >= threshold (i < j for a square all-against-all matrix)."""
    ok = U >= threshold
    if upper_triangle:
        ok = np.triu(ok, 1)
    return np.nonzero(ok)


def one_against_all(M, W, P, ref: int, others=None, tol: float = TOL_HR, batch: int = 1000):
    """Modified cosine and matched peaks of spectrum `ref` against `others` (default: all, itself excluded). Returns (others, score, n_matched)."""
    others = np.array([i for i in range(len(M)) if i != ref]) if others is None else np.asarray(others, int)
    sc, nm = modified_cosine(M, W, P, np.full(len(others), ref), others, tol, batch)
    return others, sc, nm


def all_pairs(M, W, P, tol: float = TOL_HR, threshold: float = 0.3, batch: int = 1000, binw: float = 1.0):
    """All pairs of N spectra: prefilter with the two matrix products, exact modified cosine only where the bound reaches `threshold`.
    Returns (ia, ib, score, n_matched) of the pairs computed (i < j); pairs left out have a modified cosine below the bound's threshold."""
    F, L, Fs, Ls = bin_matrices(M, W, P, binw)
    ia, ib = pairs_above(upper_bound(F, L, Fs, Ls), threshold)
    sc, nm = modified_cosine(M, W, P, ia, ib, tol, batch)
    return ia, ib, sc, nm


def neighbours(ia, ib, score, n_matched, n: int, min_cos: float = 0.6, min_peaks: int = 4, max_neighbours: int = 10):
    """Edges of the network: modified cosine >= `min_cos` with at least `min_peaks` matched peaks, at most `max_neighbours` per node (the best).
    Returns a list of (i, j, score, n_matched) with i < j."""
    ok = (score >= min_cos) & (n_matched >= min_peaks)
    a, b, s, m = ia[ok], ib[ok], score[ok], n_matched[ok]
    if len(a) == 0:
        return []
    o = np.argsort(-s, kind="stable")
    a, b, s, m = a[o], b[o], s[o], m[o]
    count = np.zeros(n, int)
    out = []
    for i, j, sc, mm in zip(a.tolist(), b.tolist(), s.tolist(), m.tolist()):          # <= a few thousand edges
        if count[i] < max_neighbours and count[j] < max_neighbours:
            count[i] += 1
            count[j] += 1
            out.append((i, j, sc, mm))
    return out
