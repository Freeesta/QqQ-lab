# TPMINE-PRIVATE
"""WP8 (public, synthetic): batched modified cosine, prefilter and network edges."""
import time

import numpy as np
import pytest

from tpmine.hr import similarity as SM


def greedy_ref(a, wa, pa, b, wb, pb, tol):
    """Plain Python global greedy (the definition), for checks."""
    d = pb - pa
    pr = sorted(((wa[i] * wb[j], -i, -j) for i in range(len(a)) for j in range(len(b)) if abs(b[j] - a[i]) <= tol or abs(b[j] - a[i] - d) <= tol), reverse=True)
    ua, ub, tot, n = set(), set(), 0.0, 0
    for v, i, j in pr:
        if -i not in ua and -j not in ub:
            ua.add(-i); ub.add(-j); tot += v; n += 1
    return tot, n


def family(rng, n=60, shift_frac=0.5):
    """Spectra of a parent and of products that keep part of its fragments (same m/z) and part shifted by the precursor difference."""
    pp = 400.0
    frag = np.sort(rng.uniform(60, 380, 24))
    spectra, precs = [], []
    for k in range(n):
        d = float(rng.choice([0, 0, 15.9949, -14.0157, -18.0106, 2.0157]))
        keep = rng.random(len(frag)) < 0.7
        sh = rng.random(len(frag)) < shift_frac
        mz = np.where(sh, frag + d, frag)[keep] + rng.normal(0, 0.0008, keep.sum())
        it = rng.uniform(1, 100, keep.sum()) ** 1.5
        extra = rng.uniform(60, 380, 3)
        mz = np.append(mz, extra); it = np.append(it, rng.uniform(1, 30, 3))
        pm = pp + d
        spectra.append(SM.prepare(mz, it, pm)); precs.append(pm)
    return spectra, np.array(precs)


def test_prepare():
    mz = np.array([50.0, 100.0, 150.0, 200.0, 399.0, 400.0, 401.0])
    it = np.array([1000.0, 500.0, 300.0, 5.0, 900.0, 800.0, 700.0])
    m, w = SM.prepare(mz, it, 400.0)
    assert m.tolist() == [50.0, 100.0, 150.0] and np.linalg.norm(w) == pytest.approx(1.0)       # precursor region and the 0.5 % peak (below 1 %) out
    assert w[0] > w[1] > w[2] and np.allclose(w ** 2, np.array([1000, 500, 300]) ** 1 / np.linalg.norm(np.sqrt([1000, 500, 300])) ** 2)
    assert SM.prepare([], [], 300.0)[0].size == 0 and SM.prepare([310.0], [5.0], 300.0)[0].size == 0
    big = SM.prepare(np.arange(100.0, 160.0), np.arange(1.0, 61.0) + 40, 400.0, k=10)
    assert len(big[0]) == 10 and np.all(np.diff(big[0]) > 0)


def test_pad_and_the_cosine_of_identical_spectra():
    rng = np.random.default_rng(1)
    sp, pr = family(rng, 5)
    M, W, P = SM.pad(sp, pr)
    assert M.shape == (5, SM.K) and (M == SM.PAD).any()
    sc, nm = SM.modified_cosine(M, W, P, [0, 1, 2], [0, 1, 2])
    assert sc == pytest.approx([1.0, 1.0, 1.0], abs=1e-9) and (nm == [len(sp[0][0]), len(sp[1][0]), len(sp[2][0])]).all()
    z = SM.pad([(np.zeros(0), np.zeros(0)), sp[0]], [300.0, pr[0]])
    assert SM.modified_cosine(*z, [0], [1])[0][0] == 0.0 and SM.modified_cosine(*z, [0], [0])[0][0] == 0.0


def test_batched_equals_the_python_greedy():
    rng = np.random.default_rng(2)
    sp, pr = family(rng, 40)
    M, W, P = SM.pad(sp, pr)
    ia, ib = np.triu_indices(40, 1)
    pick = rng.choice(len(ia), 250, replace=False)
    sc, nm = SM.modified_cosine(M, W, P, ia[pick], ib[pick], batch=64)
    for j, k in enumerate(pick):
        a, b = int(ia[k]), int(ib[k])
        t, n = greedy_ref(sp[a][0], sp[a][1], pr[a], sp[b][0], sp[b][1], pr[b], SM.TOL_HR)
        assert sc[j] == pytest.approx(t, abs=1e-9) and nm[j] == n
    assert (sc >= 0).all() and (sc <= 1 + 1e-9).all()


def test_a_shifted_fragment_ladder_is_found_by_the_modified_cosine_only():
    frag = np.array([80.0, 95.0, 110.0, 125.0, 140.0, 155.0])
    a = SM.prepare(frag, [100, 80, 60, 40, 30, 20], 300.0)
    b = SM.prepare(frag + 16.0, [100, 80, 60, 40, 30, 20], 316.0)             # same chemistry, +O everywhere
    M, W, P = SM.pad([a, b], [300.0, 316.0])
    assert SM.modified_cosine(M, W, P, [0], [1])[0][0] == pytest.approx(1.0, abs=1e-9)
    assert SM.plain_cosine(M, W, [0], [1])[0] < 0.1


def test_prefilter_loses_no_pair_with_a_good_score():
    rng = np.random.default_rng(3)
    sp, pr = family(rng, 80)
    M, W, P = SM.pad(sp, pr)
    ia, ib = np.triu_indices(80, 1)
    exact, _ = SM.modified_cosine(M, W, P, ia, ib)
    F, L, Fs, Ls = SM.bin_matrices(M, W, P)
    U = SM.upper_bound(F, L, Fs, Ls)[ia, ib]
    assert ((exact >= 0.5) & (U < 0.3)).sum() == 0 and (exact >= 0.5).sum() > 20
    rnd = [SM.prepare(rng.uniform(60, 380, 20), rng.uniform(1, 100, 20), 400.0) for _ in range(60)]        # unrelated spectra: the bound removes most pairs
    Mr, Wr, Pr = SM.pad(rnd, np.full(60, 400.0))
    Ur = SM.upper_bound(*SM.bin_matrices(Mr, Wr, Pr))
    assert (np.triu(Ur, 1)[np.triu_indices(60, 1)] >= 0.3).mean() < 0.5
    i2, j2, s2, n2 = SM.all_pairs(M, W, P, threshold=0.3)
    got = {(a, b): s for a, b, s in zip(i2.tolist(), j2.tolist(), s2)}
    for a, b, e in zip(ia.tolist(), ib.tolist(), exact):
        if e >= 0.5:
            assert got[(a, b)] == pytest.approx(e, abs=1e-9)
    sub = SM.upper_bound(F, L, Fs, Ls, rows=[0, 1], cols=[2, 3, 4])
    assert sub.shape == (2, 3)


def test_one_against_all_and_neighbours():
    rng = np.random.default_rng(4)
    sp, pr = family(rng, 30)
    M, W, P = SM.pad(sp, pr)
    others, sc, nm = SM.one_against_all(M, W, P, 0)
    assert 0 not in others and len(others) == 29
    o2, sc2, _ = SM.one_against_all(M, W, P, 0, others=[5, 7])
    assert list(o2) == [5, 7] and sc2 == pytest.approx(sc[[4, 6]])
    ia, ib, s, n = SM.all_pairs(M, W, P, threshold=0.0)
    edges = SM.neighbours(ia, ib, s, n, 30, min_cos=0.5, min_peaks=4, max_neighbours=3)
    deg = np.zeros(30, int)
    for i, j, sc_, nn in edges:
        deg[i] += 1; deg[j] += 1
        assert i < j and sc_ >= 0.5 and nn >= 4
    assert deg.max() <= 3 and len(edges) > 0
    assert SM.neighbours(ia, ib, s, n, 30, min_cos=2.0) == []


def test_speed_of_a_few_hundred_spectra():
    rng = np.random.default_rng(5)
    sp, pr = family(rng, 300)
    M, W, P = SM.pad(sp, pr)
    t0 = time.perf_counter()
    ia, ib, s, n = SM.all_pairs(M, W, P, threshold=0.3)
    dt = time.perf_counter() - t0
    assert len(ia) > 0 and dt < 60                       # 44 850 pairs; ~50 us per exact pair, most pairs removed by the prefilter


# ---------------------------------------------------------------------------------------------------------------------- spectral entropy
def _entropy_ref(a, b):
    """The definition, on dicts {key: intensity} of already matched peaks: weight transform, merged spectrum, 1 - (2 S_AB - S_A - S_B) / ln 4."""
    import math

    def prob(d):
        t = sum(d.values())
        p = {k: v / t for k, v in d.items()}
        s = -sum(v * math.log(v) for v in p.values())
        if s < 3:
            p = {k: v ** (0.25 + 0.25 * s) for k, v in p.items()}
            t = sum(p.values())
            p = {k: v / t for k, v in p.items()}
        return p

    pa, pb = prob(a), prob(b)
    ent = lambda p: -sum(v * math.log(v) for v in p.values() if v > 0)
    mix = {k: (pa.get(k, 0) + pb.get(k, 0)) / 2 for k in set(pa) | set(pb)}
    return 1 - (2 * ent(mix) - ent(pa) - ent(pb)) / math.log(4)


def _padded(spectra, precursors):
    """Spectra as (mz, intensity) lists straight into the padded matrices (W = sqrt of the intensities, no unit norm: the entropy only needs ratios)."""
    return SM.pad([(np.array(m, float), np.sqrt(np.array(i, float))) for m, i in spectra], precursors)


def test_entropy_hand_written_values():
    # identical spectra: 1; no common peak: 0
    M, W, P = _padded([([100, 200], [1, 1]), ([100, 200], [1, 1]), ([300, 400], [1, 1])], [500, 500, 500])
    sc, nm = SM.entropy_similarity(M, W, P, [0, 0], [1, 2])
    assert sc == pytest.approx([1.0, 0.0], abs=1e-9) and list(nm) == [2, 0]
    # A = {100: 1, 200: 1}, B = {100: 1}: p_A = (.5, .5) -> S = ln 2 < 3, flattened with the exponent 0.25 + 0.25 ln 2: still (.5, .5); p_B = (1)
    # sim = [1.5 ln 1.5 - .5 ln .5 - 1 ln 1] / (2 ln 2) = 0.6887218755...
    M, W, P = _padded([([100, 200], [1, 1]), ([100], [5])], [500, 500])
    sc, nm = SM.entropy_similarity(M, W, P, [0], [1])
    assert sc[0] == pytest.approx(0.6887218755408671, abs=1e-9) and nm[0] == 1
    # A = {100: 3, 200: 1}, B = {100: 1, 200: 3}: p = (.75, .25), S = 0.5623351446, exponent 0.3905837862 -> q = (0.6165..., 0.3835...)
    # literal from the definition (independent routine above): each of the two matched pairs adds -.6165 ln .6165 - .3835 ln .3835, over 2 ln 2
    M, W, P = _padded([([100, 200], [3, 1]), ([100, 200], [1, 3])], [500, 500])
    sc, _ = SM.entropy_similarity(M, W, P, [0], [1])
    assert sc[0] == pytest.approx(_entropy_ref({1: 3, 2: 1}, {1: 1, 2: 3}), abs=1e-9)
    assert sc[0] == pytest.approx(0.9675440267, abs=1e-9)


def test_entropy_matches_the_definition_on_random_pairs():
    rng = np.random.default_rng(3)
    for _ in range(20):
        n = int(rng.integers(3, 12))
        mz = np.sort(rng.uniform(60, 380, n))
        ia = rng.uniform(1, 100, n)
        keep = rng.random(n) < 0.7
        keep[0] = True
        ib = rng.uniform(1, 100, n)
        a = {i: ia[i] for i in range(n)}
        b = {i: ib[i] for i in range(n) if keep[i]}
        M, W, P = _padded([(mz, ia), (mz[keep], ib[keep])], [400, 400])
        sc, nm = SM.entropy_similarity(M, W, P, [0], [1])
        assert sc[0] == pytest.approx(_entropy_ref(a, b), abs=1e-9) and nm[0] == keep.sum()


def test_entropy_hybrid_pairs_shifted_peaks_and_is_symmetric():
    # the product keeps the fragments of the parent shifted by +15.9949 (precursor 400 -> 415.9949): hybrid sees them, the plain variant does not
    M, W, P = _padded([([100, 150, 200], [1, 2, 3]), ([115.9949, 165.9949, 215.9949], [1, 2, 3])], [400, 415.9949])
    assert SM.entropy_similarity(M, W, P, [0], [1], hybrid=True)[0][0] == pytest.approx(1.0, abs=1e-9)
    assert SM.entropy_similarity(M, W, P, [0], [1], hybrid=False)[0][0] == pytest.approx(0.0, abs=1e-9)
    M, W, P = _padded([([100, 150, 200], [1, 2, 3]), ([100, 150, 230], [3, 1, 2])], [400, 400])
    ab = SM.entropy_similarity(M, W, P, [0], [1])[0][0]
    ba = SM.entropy_similarity(M, W, P, [1], [0])[0][0]
    assert ab == pytest.approx(ba, abs=1e-9) and 0 < ab < 1
    _, sc, _ = SM.entropy_one_against_all(M, W, P, 0)
    assert sc[0] == pytest.approx(ab, abs=1e-9)
