# TPMINE-PRIVATE
"""WP3 (public, synthetic): formulas, molecular graph and MSn tree of the high-resolution path. Run: PYTHONPATH=<repo>:<TP_Mine>/py python3 -m pytest -q TP_Mine/tests"""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import msn_synth as S  # noqa: E402
from mzlab.chem import elements as E  # noqa: E402
from mzlab.reader.mzml import Run  # noqa: E402
from tpmine.hr import formula as F  # noqa: E402
from tpmine.hr import molgraph as MG  # noqa: E402
from tpmine.hr import msn  # noqa: E402

ELS = F.element_order({"C": 8, "H": 11, "N": 4, "O": 2})


# ------------------------------------------------------------------------------------------------------------------------ formula
def test_ion_mass_rdbe_parity():
    v = F.vec("C8H11N4O2", ELS)
    assert F.fmt(v, ELS) == "C8H11N4O2"
    assert F.ion_mass(v, ELS) == pytest.approx(195.087651, abs=1e-5)            # [M+H]+ of C8H10N4O2 minus the electron
    assert F.rdbe(v, ELS) == pytest.approx(5.5) and bool(F.closed_shell(v, ELS))
    r = F.vec("C4H7N2", ELS)
    assert bool(F.closed_shell(r, ELS)) and not bool(F.closed_shell(F.vec("C4H6N2", ELS), ELS))      # the radical cation has an even H + N


def test_space_sorted_and_assignment_is_unique_where_it_should():
    top = F.vec("C8H11N4O2", ELS)
    sp = F.FormulaSpace(top, ELS)
    assert np.all(np.diff(sp.mass) >= 0) and np.all(sp.rdbe >= -0.5) and np.all(sp.G <= top)
    m = S.mass_of("C6H8N3O")
    c = sp.candidates(m, 5.0)
    assert F.fmt(sp.G[c[0]], ELS) == "C6H8N3O"
    assert sp.count([m, 1.0], 5.0).tolist()[1] == 0
    # sub-formula constraint: C6H8N3O is not a sub-formula of C5H8N3
    assert len(sp.candidates(m, 5.0, within=F.vec("C5H8N3", ELS))) == 0
    n_all = sp.count(np.array([m]), 5.0)[0]
    n_sub = sp.count(np.array([m]), 5.0, within=top)[0]
    assert n_sub == n_all >= 1


def test_tp_space_rules():
    parent = F.vec("C8H11N4O2", ELS)
    upper = parent.copy()
    upper[ELS.index("O")] += 6
    upper[ELS.index("H")] = 2 * parent[0] + parent[ELS.index("N")] + 3
    sp = F.FormulaSpace(upper, ELS, h_rule=True)
    iC, iH, iN = ELS.index("C"), ELS.index("H"), ELS.index("N")
    assert np.all(sp.G[:, iH] <= 2 * sp.G[:, iC] + sp.G[:, iN] + 3)
    assert F.vec("C8H11N4O3", ELS).tolist() in sp.G.tolist()                                  # + O is inside the TP limits


def test_calibration_constant_and_linear():
    top = F.vec("C8H11N4O2", ELS)
    sp = F.FormulaSpace(top, ELS)
    rng = np.random.default_rng(1)
    pick = rng.choice(len(sp), 300, replace=False)
    ok = sp.count(sp.mass[pick], 10.0) == 1
    th = sp.mass[pick][ok][:40]
    obs = th * (1 + (-3.0 + 0.0 * th) * 1e-6)
    cal = F.fit_calibration(obs, sp, window_ppm=10.0)
    assert cal.a == pytest.approx(-3.0, abs=0.3) and abs(cal.b) < 1e-3
    assert np.allclose(cal.apply(obs), th, rtol=2e-7)
    obs2 = th * (1 + (-1.0 - 0.02 * (th - 100)) * 1e-6)
    cal2 = F.fit_calibration(obs2, sp, window_ppm=10.0, mode="linear")
    assert cal2.b == pytest.approx(-0.02, abs=0.01)
    assert F.fit_calibration(np.array([1.0, 2.0]), sp).n == 0           # nothing assignable: no correction


# ------------------------------------------------------------------------------------------------------------------------ molgraph
@pytest.mark.parametrize("smi,formula", [(S.CAFFEINE_SMILES, "C8H10N4O2"), ("c1ccccc1", "C6H6"), ("c1ccncc1", "C5H5N"), ("c1ccsc1", "C4H4S"),
                                         ("CC(C)(C)NCC(O)COC1=NSN=C1N1CCOCC1", "C13H24N4O3S"), ("OC(=O)c1ccccc1", "C7H6O2"), ("c1cc[nH]c1", "C4H5N")])
def test_smiles_formula_agrees_with_the_public_parser(smi, formula):
    mol = MG.parse_smiles(smi)
    assert E.fmt(mol.formula()) == formula
    from tpmine import chem
    assert mol.formula() == chem.smiles_formula(smi)


def test_substructures_include_ring_openings_with_two_cuts():
    mol = MG.parse_smiles("C1CCCCC1")
    subs = MG.substructures(mol, max_cuts=4)
    assert subs.cuts[subs.masks == np.uint64(2 ** 6 - 1)][0] == 0
    four = [i for i in range(len(subs)) if bin(int(subs.masks[i])).count("1") == 4]
    assert four and min(subs.cuts[four]) == 2               # a 4-atom chain needs two ring bonds cut: reached only through the state "ring opened"
    big = MG.parse_smiles(S.CAFFEINE_SMILES)
    s2 = MG.substructures(big)
    assert 50 < len(s2) < 5000 and s2.cuts.min() == 0 and s2.cuts.max() <= 4


def test_candidate_weights():
    subs = MG.substructures(MG.parse_smiles(S.CAFFEINE_SMILES))
    idx, w = subs.candidates(F.vec("C8H11N4O2", subs.els))
    assert len(idx) >= 1 and w.sum() == pytest.approx(1.0) and subs.cuts[idx[np.argmax(w)]] == 0           # the whole molecule: the fewest cuts wins
    idx2, w2 = subs.candidates(F.vec("C6H8N3O", subs.els))
    assert len(idx2) > 1 and w2.sum() == pytest.approx(1.0) and len(set(np.round(w2, 6))) > 1
    assert len(subs.candidates(F.vec("C9H11N4O2", subs.els))[0]) == 0
    with pytest.raises(ValueError):
        MG.parse_smiles("CC.CC")
    with pytest.raises(ValueError):
        MG.parse_smiles("C1CC")


# ------------------------------------------------------------------------------------------------------------------------ MSn tree
@pytest.fixture(scope="module")
def tree(tmp_path_factory):
    p = S.write_msn(tmp_path_factory.mktemp("msn") / "msn.mzML", S.caffeine_nodes(), ppm_offset=-3.0)
    return msn.build_tree(Run(p), S.CAFFEINE_ION, S.CAFFEINE_SMILES)


def test_tree_formulas_calibration_and_ppm(tree):
    assert tree.cal.a == pytest.approx(-3.0, abs=0.6)
    f = {n["id"]: n["formula"] for n in tree.nodes}
    assert f["MS1"] == "C8H11N4O2" and f["195@cid30"] == "C8H11N4O2"
    assert f["195@cid30>138@cid30"] == f["195@cid30>138@cid45"] == "C6H8N3O"
    assert f["195@cid30>138@cid30>110@cid35"] == "C5H8N3"
    for n in tree.nodes:
        if n["ppm"] is not None:
            assert abs(n["ppm"]) < 1.5, n["id"]


def test_tree_cleaning_contamination_artefact_and_ghost(tree):
    n = tree.node("195@cid30>138@cid30")
    assert n["removed"]["heavy"] == 2 and not n["ghost"]               # the 195 peak (and the 301 / 173.497 are gone from the consensus or removed)
    mzs = [p["mz"] for p in n["peaks"]]
    assert all(m < 138.0662 + 1.5 for m in mzs) and not any(abs(m - 173.497) < 0.01 for m in mzs)
    assert {p["formula"] for p in n["peaks"]} == {"C6H8N3O", "C5H8N3", "C5H5N2O", "C4H7N2"}
    assert max(p["rel"] for p in n["peaks"]) == pytest.approx(100.0)
    g = tree.node("195@cid30>156@cid30")
    assert g["ghost"] and g["base_peak_removed"]                       # a copy of the MS2 spectrum: its base peak (195) is heavier than the precursor
    assert not tree.node("195@cid30")["ghost"]
    assert len(tree.node("195@cid30")["peaks"]) == 5 and max(p["mz"] for p in tree.node("195@cid30")["peaks"]) < 195.1


def test_tree_noise_peaks_do_not_survive_the_consensus(tree):
    for n in tree.nodes:
        for p in n["peaks"]:
            assert p["n_scans"] >= 6
            assert p["formula"]


def test_tree_parent_choice_other_ce_and_missing_generation(tree):
    assert tree.node("195@cid30>138@cid45")["parent"] == "195@cid30" and tree.node("195@cid30>138@cid45")["via"] == 0
    assert tree.node("195@cid30>138@cid30>110@cid35")["parent"] == "195@cid30>138@cid30"
    m = tree.node("195@cid30>156@cid30>138@cid30>110@cid35")
    assert m["parent"] == "195@cid30>156@cid30" and m["via"] == 1 and m["formula"] == "C5H8N3"          # the MS4 generation has no spectrum: nearest ancestor


def test_tree_atom_sets_follow_the_hierarchy(tree):
    subs = tree.subs
    n = tree.node("195@cid30>138@cid30>110@cid35")
    pidx = tree.cand["195@cid30>138@cid30"][0]
    cidx = tree.cand[n["id"]][0]
    pm, cm = subs.masks[pidx], subs.masks[cidx]
    assert len(cidx) >= 1 and ((cm[:, None] & ~pm[None, :]) == 0).any(1).all()              # every child candidate sits inside a parent candidate
    assert n["atom_candidates"]["n"] <= tree.node("195@cid30>138@cid30")["atom_candidates"]["n"] * 2
    ac = tree.node("195@cid30>138@cid30")["atom_candidates"]
    assert set(ac["certain"]) <= set(ac["possible"])


def test_tree_without_smiles_and_json(tmp_path):
    import json
    p = S.write_msn(tmp_path / "m.mzML", S.caffeine_nodes())
    t = msn.build_tree(Run(p), S.CAFFEINE_ION)
    assert t.subs is None and t.nodes[1]["atom_candidates"] is None
    json.dumps(t.summary())                                                                  # JSON-ready
    assert t.timing["total"] < 5
