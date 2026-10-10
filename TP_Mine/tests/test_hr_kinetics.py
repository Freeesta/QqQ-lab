# TPMINE-PRIVATE
"""WP10 (public, synthetic): matrix exponential, chain models, AICc, descriptors, saturation of the parent, sessions."""
import math

import numpy as np
import pytest

from tpmine.hr import kinetics as K

T = np.array([0, 2, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120.0])


def test_expm_is_exact_where_eig_fails():
    k = 0.05
    assert np.abs(K.chain_curve(T, np.array([k, k])) - k * T * np.exp(-k * T)).max() < 1e-12              # equal rates: x e^{-kx}
    k1, k2 = 0.05, 0.03
    assert np.abs(K.chain_curve(T, np.array([k1, k2])) - k1 / (k2 - k1) * (np.exp(-k1 * T) - np.exp(-k2 * T))).max() < 1e-12
    # a defective matrix: numpy's eig returns eigenvectors that are (numerically) parallel, so V exp(L t) V^-1 loses the answer; expm does not
    Km = K.chain_matrix(np.array([k, k]))
    E = K.expm_batch(Km * 10.0)
    assert E[1, 0] == pytest.approx(0.5 * math.exp(-0.5), rel=1e-12) and E[0, 0] == pytest.approx(math.exp(-0.5), rel=1e-12)
    assert E.sum(0) == pytest.approx([1, 1, 1], abs=1e-12)                                                   # mass is conserved: columns sum to 1
    big = K.expm_batch(K.chain_matrix(np.array([3.0, 2.9])) * 1000.0)                                        # large norm: scaling and squaring
    assert np.isfinite(big).all() and big[2, 0] == pytest.approx(1.0, abs=1e-9)


def test_batch_equals_single():
    ks = np.array([[0.1, 0.03], [0.5, 0.5], [0.02, 1.0]])
    batch = K.chain_curve(T, ks)
    for i in range(3):
        assert batch[i] == pytest.approx(K.chain_curve(T, ks[i]), abs=1e-14)
    assert K.chain_curve(T, np.array([0.1, 0.03, 0.01])).shape == (len(T),)


def test_fit_recovers_the_chain_and_aicc_prefers_the_right_generation():
    rng = np.random.default_rng(1)
    first = K.chain_curve(T, np.array([0.08, 0.02]))
    second = K.chain_curve(T, np.array([0.2, 0.04, 0.02]))
    g1 = K.generation(T, first * (1 + 0.03 * rng.standard_normal(len(T))) * 1e6)
    g2 = K.generation(T, second * (1 + 0.03 * rng.standard_normal(len(T))) * 1e6)
    assert g2["verdict"] == "second" and g2["delta"] < -2
    assert g1["verdict"] in ("first", "undecidable") and g1["delta"] > -2
    f = K.fit_chain(T, second * 1e6, 3, 0.02)
    assert f["sse"] < 5e-3 and len(f["rates"]) == 3 and len(f["curve"]) == len(T)
    assert K.aicc(0.1, 12, 3) > K.aicc(0.1, 12, 2) and math.isfinite(K.aicc(0.0, 6, 3))


def test_descriptors_and_classes():
    early = K.chain_curve(T, np.array([0.2, 0.003]))
    d = K.descriptors(T, early * 1e7)
    assert d["ok"] and d["tmax"] <= 20 and d["class"][0] == "early" and "persistent" in d["class"] and d["unimodal"]
    late = K.chain_curve(T, np.array([0.03, 0.03, 0.1]))
    dl = K.descriptors(T, late * 1e7)
    assert dl["class"] == ["late"] and dl["residual_fraction"] < 0.5 and dl["onset"] > 5
    noisy = np.array([1, 5, 1, 6, 1, 5, 1, 6, 1, 5, 1, 6.0])
    assert not K.descriptors(T, noisy)["unimodal"]
    assert not K.descriptors(T, np.zeros(len(T)))["ok"]
    assert K.descriptors([-1.0, 0.0, 5.0], [0, 0, 1e6])["times"] == [0.0, 5.0]                  # dark (time -1) is not part of the profile
    assert K.not_in_reference(T, early * 1e7, ref_max=1e5) and not K.not_in_reference(T, early * 1e7, ref_max=5e7)


def test_parent_saturation():
    t = [-1, 0, 2, 5, 10, 15, 20, 30, 45, 60]
    sat = [5e9, 4.8e9, 5.2e9, 5.0e9, 4.9e9, 5.1e9, 5.0e9, 8e7, 7e7, 6e7]            # constant (saturated) then a 60-fold drop
    r = K.parent_saturation(t, sat)
    assert r["saturated"] and r["plateau"][0] <= 0 and r["plateau"][1] >= 15 and r["drop"] > 50 and "saturation" in r["note"]
    decay = [5e9 * math.exp(-0.15 * x) for x in [0, 0, 2, 5, 10, 15, 20, 30, 45, 60]]
    assert not K.parent_saturation(t, decay)["saturated"]
    assert not K.parent_saturation(t, [5e9] * 10)["saturated"]                     # constant forever: no drop
    assert not K.parent_saturation([0, 1], [5e9, 1e5])["saturated"]                # too few points on the plateau


def test_sessions_and_factors(tmp_path):
    stamps = ["2022-12-07T15:05:01Z", "2022-11-26T07:09:21Z", "2022-12-07T14:48:51Z", None, "2022-11-26T06:04:38Z", "2022-12-07T18:00:00Z"]
    lab = K.sessions(stamps)
    assert lab == ["S2", "S1", "S2", "?", "S1", "S2"]
    f = tmp_path / "x.mzML"
    f.write_text('<mzML><run id="r" startTimeStamp="2022-12-07T15:05:01Z" defaultInstrumentConfigurationRef="IC1">')
    assert K.run_start(f) == "2022-12-07T15:05:01Z"
    g = tmp_path / "y.mzML"
    g.write_text("<mzML><run id='r'>")
    assert K.run_start(g) is None
    rng = np.random.default_rng(2)
    A = np.exp(rng.normal(15, 1, (300, 1)) + rng.normal(0, 0.1, (300, 6)))                 # features keep their intensity across files, +-10 %
    labs = ["S1", "S1", "S2", "S2", "S2", "S1"]
    same = K.session_factors(A, labs)
    assert same["n_features"] == 300 and not same["applied"] and np.allclose(same["factors"], 1.0)
    B = A.copy()
    B[:, [0, 1, 5]] *= 2.0                                                          # one session twice as intense
    far = K.session_factors(B, labs)
    assert far["applied"] and far["per_session"]["S1"] / far["per_session"]["S2"] == pytest.approx(2.0, rel=0.05) and far["reference"] in ("S1", "S2")
    fixed = B * np.array(far["factors"])
    assert np.median(np.log(fixed[:, 0] / fixed[:, 2])) == pytest.approx(0.0, abs=0.05)                      # the sessions agree after the correction
    assert not K.session_factors(A[:5], labs)["applied"]                           # too few common features
