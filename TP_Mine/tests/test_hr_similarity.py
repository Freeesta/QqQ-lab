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
