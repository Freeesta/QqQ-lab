# TPMINE-PRIVATE
"""WP6 (public, synthetic): ion identity families in a retention-time window, collapse to a neutral mass, the NH4/NH3 ambiguity, and the fragment
library of the parent."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import msn_synth as S  # noqa: E402
from mzlab.reader.mzml import PeakTable, Run  # noqa: E402
from tpmine.hr import iimn, msn  # noqa: E402

NS = 600


def table(ions, seed=3, noise=2000):
    """ions: (mz, apex_rt_min, sigma_min, height). 600 scans of 0.01 min."""
    rng = np.random.default_rng(seed)
    rt = np.arange(NS) * 0.01
    mzs, its, pos = [], [], []
    for mz, r0, sg, h in ions:
        y = h * np.exp(-0.5 * ((rt - r0) / sg) ** 2)
        k = np.flatnonzero(y > 2e4)
        mzs.append(mz * (1 + rng.normal(0, 0.3e-6, len(k)))); its.append(y[k] * rng.uniform(0.95, 1.05, len(k))); pos.append(k)
    mzs.append(rng.uniform(100, 600, noise)); its.append(rng.uniform(2e4, 9e4, noise)); pos.append(rng.integers(0, NS, noise))
    mz, it, p = np.concatenate(mzs), np.concatenate(its), np.concatenate(pos).astype(np.int32)
    o = np.argsort(mz)
    return PeakTable(rt=rt, scan_ids=np.arange(NS), mz=mz[o].astype(np.float32), inten=it[o].astype(np.float32), pos=p[o], tic=np.zeros(NS))


M = 300.1500                                              # an [M+H]+
NA, K, NH4, ISO = M + 21.98194, M + 37.95588, M + 17.02655, M + 1.003355


@pytest.fixture(scope="module")
def win():
    ions = [(M, 3.0, 0.05, 2e8), (NA, 3.0, 0.05, 2e7), (ISO, 3.0, 0.05, 3e7),                   # parent, sodium adduct, 13C
            (M - 56.0626, 3.0, 0.05, 5e6),                                                         # in-source fragment (-C4H8)
            (M * 2 - iimn.PROTON, 3.0, 0.05, 6e6),                                                 # dimer
            (450.2000, 3.0, 0.05, 4e7),                                                            # unrelated ion with the same elution
            (380.1000, 3.02, 0.05, 4e7),                                                           # unrelated, other mass relation
            (M + 0.03, 3.0, 0.05, 2e6),                                                            # Fourier side lobe (same apex, 100 times weaker than the parent)
            (500.0, 1.0, 0.05, 1e7)]                                                               # eluting elsewhere
    t = table(ions)
    return iimn.window_profiles(t, 2.7, 3.3)


def test_window_profiles(win):
    assert len(win) >= 8 and win.Y.shape == (len(win), len(win.rt)) and np.allclose(np.linalg.norm(win.Yn, axis=1), 1.0)
    assert not np.any(np.abs(win.mz - 500.0) < 0.1)                   # outside the window
    side = np.flatnonzero(np.abs(win.mz - (M + 0.03)) < 0.001)
    assert win.artefact[side].all() and not win.artefact[np.abs(win.mz - M) < 0.001].any()
    assert len(iimn.window_profiles(table([(M, 3.0, 0.05, 2e8)]), 8.0, 8.01)) == 0


def test_family_of_the_parent(win):
    fam = iimn.family(win, M, 3.0)
    names = {r["name"] for m in fam["members"] for r in m["relations"]}
    assert {"[M+Na]+", "13C"} <= names and any(m["dimer_of_x"] for m in fam["members"])
    assert not any(abs(m["mz"] - 450.2) < 0.01 or abs(m["mz"] - (M + 0.03)) < 0.01 for m in fam["members"])          # unrelated and side lobe: not members
    c = iimn.collapse(fam)
    assert c["role"] == "ion" and c["representative_mz"] == pytest.approx(M, abs=1e-3) and c["neutral_mass"] == pytest.approx(M - iimn.PROTON, abs=1e-3)
    assert {e["name"] for e in c["evidence"]} >= {"[M+Na]+", "13C", "[2M+H]+"}


@pytest.mark.parametrize("mz,role", [(NA, "adduct"), (ISO, "isotope"), (M - 56.0626, "loss"), (M * 2 - iimn.PROTON, "dimer")])
def test_the_derived_ions_are_explained_by_the_parent(win, mz, role):
    c = iimn.collapse(iimn.family(win, mz, 3.0))
    assert c["role"] == role and c["explained_by"] == pytest.approx(M, abs=1e-3) and c["representative_mz"] == pytest.approx(M, abs=1e-3)
    assert c["explained_text"]


def test_unrelated_ion_stays_alone(win):
    c = iimn.collapse(iimn.family(win, 450.2, 3.0))
    assert c["role"] == "ion" and c["explained_by"] is None and not c["evidence"]
    assert iimn.family(win, 123.4567, 3.0) is None


def test_ammonium_or_ammonia_is_ambiguous_until_sodium_decides():
    # X = M; Y = X + 17.02655: [M+NH4]+ of X, or X is [M+H-NH3]+ of Y
    t = table([(M, 3.0, 0.05, 2e8), (NH4, 3.0, 0.05, 5e7)])
    w = iimn.window_profiles(t, 2.7, 3.3)
    c = iimn.collapse(iimn.family(w, M, 3.0))
    assert c["ambiguous"] and c["ambiguous"]["decided"] is None and len(c["ambiguous"]["readings"]) == 2
    assert c["role"] == "ion"                                         # neither reading explains X away until something decides
    t2 = table([(M, 3.0, 0.05, 2e8), (NH4, 3.0, 0.05, 5e7), (NA, 3.0, 0.05, 2e7)])
    c2 = iimn.collapse(iimn.family(iimn.window_profiles(t2, 2.7, 3.3), M, 3.0))
    assert c2["ambiguous"]["decided"] == "ammonium" and {"[M+NH4]+", "[M+Na]+"} <= {e["name"] for e in c2["evidence"]}


def test_chunks_cover_every_candidate_with_its_margin():
    rts = [1.0, 1.1, 1.2, 3.0, 3.05, 5.0]
    ch = iimn.chunks(rts, span=0.3, margin=0.15)
    seen = sorted(i for _, _, idx in ch for i in idx.tolist())
    assert seen == list(range(6))
    for lo, hi, idx in ch:
        assert all(lo <= rts[i] - 0.15 + 1e-9 and rts[i] + 0.15 <= hi + 1e-9 for i in idx)
    assert len(ch) == 3


# ------------------------------------------------------------------------------------------------------------------ library
@pytest.fixture(scope="module")
def tree(tmp_path_factory):
    p = S.write_msn(tmp_path_factory.mktemp("lib") / "m.mzML", S.caffeine_nodes())
    return msn.build_tree(Run(p), S.CAFFEINE_ION, S.CAFFEINE_SMILES)


def test_library_from_the_msn_tree(tree):
    lib = iimn.build_library(tree, node_peak_rel=0.0)                          # all the clean peaks of the nodes
    fs = set(lib.formulas())
    assert {"C8H11N4O2", "C6H8N3O", "C5H8N3", "C5H5N2O", "C4H7N2", "C3H5N2", "C2H4N"} <= fs
    small = iimn.build_library(tree)                                           # default: the precursors of the nodes only
    assert {"C8H11N4O2", "C6H8N3O", "C5H8N3", "C6H10N3O2"} <= set(small.formulas()) and "C2H4N" not in small.formulas() and len(small) < len(lib)
    assert len(iimn.build_library(tree, node_peak_rel=50.0)) <= len(lib)
    assert "C6H10N3O2" in fs                                              # the precursor of the ghost node is a real ion of the tree
    e = lib.entries["C5H8N3"]
    assert e["source"] == {"msn"} and e["idx"] is not None and e["w"].sum() == pytest.approx(1.0) and len(e["idx"]) < 10
    assert lib.contains(e["vec"]) == "C5H8N3" and lib.contains(np.zeros(len(lib.els), int)) is None
    assert len(lib.masses()) == len(lib)


def test_library_adds_dda_peaks_without_constraint(tree):
    from tpmine.hr import formula as F
    top = F.vec("C8H11N4O2", tree.els)
    m_new = float(F.ion_mass(F.vec("C4H6N2O", tree.els), tree.els))                        # not in the tree
    lib = iimn.build_library(tree, dda_peaks=(np.array([m_new, m_new + 0.5, 150.0123]), np.array([20.0, 50.0, 0.5])))
    assert "C4H6N2O" in lib.entries and lib.entries["C4H6N2O"]["source"] == {"dda"}
    assert len(lib.entries["C4H6N2O"]["idx"]) >= 1
    assert all(abs(e["mz"] - (m_new + 0.5)) > 0.01 for e in lib.entries.values())          # no formula for that m/z: not added
    assert len(iimn.build_library(tree, dda_peaks=(np.array([m_new]), np.array([0.5])))) == len(iimn.build_library(tree))      # below 1 %


def test_library_merges_the_same_formula_seen_twice(tree):
    lib = iimn.FragmentLibrary(tree.els, tree.subs)
    from tpmine.hr import formula as F
    v = F.vec("C5H8N3", tree.els)
    idx, w = tree.subs.candidates(v)
    lib.add("C5H8N3", 110.0713, "msn", 100.0, idx[:3], w[:3] / w[:3].sum())
    lib.add("C5H8N3", 110.0713, "dda", 5.0, idx[1:5], w[1:5] / w[1:5].sum())
    e = lib.entries["C5H8N3"]
    assert e["source"] == {"msn", "dda"} and e["rel"] == 100.0 and set(e["idx"].tolist()) == set(idx[1:3].tolist()) and e["w"].sum() == pytest.approx(1.0)
    lib.add("C5H8N3", 110.0713, "dda", 1.0, idx[-1:], np.ones(1))                             # disjoint from the rest: the more constrained set stays
    assert 1 <= len(lib.entries["C5H8N3"]["idx"]) <= 2


def test_family_uses_the_library_for_in_source_fragments(tree):
    lib = iimn.build_library(tree)
    from tpmine.hr import formula as F
    m_frag = float(F.ion_mass(F.vec("C5H8N3", tree.els), tree.els))                          # 110.0713, in the library
    parent = float(F.ion_mass(F.vec("C8H11N4O2", tree.els), tree.els))
    t = table([(parent, 3.0, 0.05, 2e8), (m_frag, 3.0, 0.05, 6e6), (parent - 21.0, 3.0, 0.05, 6e6)])
    w = iimn.window_profiles(t, 2.7, 3.3)
    c = iimn.collapse(iimn.family(w, m_frag, 3.0, parent_mz=parent, library=lib))
    assert c["role"] == "loss" and c["explained_by"] == pytest.approx(parent, abs=1e-3) and "C5H8N3" in c["explained_text"]
    other = iimn.collapse(iimn.family(w, parent - 21.0, 3.0, parent_mz=parent, library=lib))
    assert other["role"] == "ion"                                                              # not in the library, not a known loss
