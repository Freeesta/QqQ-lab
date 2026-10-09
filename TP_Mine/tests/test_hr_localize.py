# TPMINE-PRIVATE
"""WP9 (public, synthetic): site models, evidence (shifted / unshifted), likelihood of the sites, region and groups."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mzlab.chem import elements as E  # noqa: E402
from tpmine.hr import formula as F  # noqa: E402
from tpmine.hr import iimn  # noqa: E402
from tpmine.hr import localize as LZ  # noqa: E402
from tpmine.hr import molgraph as MG  # noqa: E402
import msn_synth as S  # noqa: E402

SMI = S.CAFFEINE_SMILES                                  # C8H10N4O2: 14 heavy atoms
ION = "C8H11N4O2"


@pytest.fixture(scope="module")
def world():
    mol = MG.parse_smiles(SMI)
    subs = MG.substructures(mol)
    els = subs.els
    return mol, subs, els


def mask_index(subs, atoms):
    m = sum(1 << a for a in atoms)
    hit = np.flatnonzero(subs.masks == np.uint64(m))
    return int(hit[0]) if len(hit) else None


def test_change_type_and_sites(world):
    mol, subs, els = world
    v = lambda f: F.vec(f, els)
    assert LZ.change_type(v("C7H10N4O2") - v(ION), els) == "loss"                  # -CH
    assert LZ.change_type(v("C8H11N4O3") - v(ION), els) == "oxygen"
    assert LZ.change_type(v("C8H9N4O2") - v(ION), els) == "dehydro"
    assert LZ.change_type(v("C9H13N4O2") - v(ION), els) == "other"
    R, names, kind = LZ.candidate_sites(v("C8H11N4O3") - v(ION), els, subs)
    assert kind == "oxygen" and len(R) == sum(1 for a in mol.atoms if a in ("C", "N", "S")) == 12 and all(bin(int(m)).count("1") == 1 for m in R)
    R, names, kind = LZ.candidate_sites(v("C8H9N4O2") - v(ION), els, subs)            # caffeine has no bond between two atoms that carry hydrogen
    assert kind == "dehydro" and len(R) == 0
    prop = MG.substructures(MG.parse_smiles("CCCO"))
    R, names, kind = LZ.candidate_sites(F.vec("C3H5O", prop.els) - F.vec("C3H7O", prop.els), prop.els, prop)
    assert kind == "dehydro" and len(R) == 3 and names == ["C0-C1", "C1-C2", "C2-O3"]
    R, names, kind = LZ.candidate_sites(v("C7H10N4O2") - v(ION), els, subs)           # the carbon atoms, one at a time (+- the hydrogens): connected 1-atom pieces
    assert kind == "loss" and len(R) >= 1 and all(bin(int(m)).count("1") == 1 for m in R)
    assert LZ.candidate_sites(v("C9H13N4O2") - v(ION), els, subs)[2] == "other"


def build_world(world):
    mol, subs, els = world
    lib = iimn.FragmentLibrary(els, subs)
    return mol, subs, els, lib


def test_likelihood_matches_a_brute_force_calculation_and_finds_the_site(world):
    mol, subs, els, lib = build_world(world)
    # a site: the nitrogen with index j. Fragment A (shifted) contains it, fragment B (unshifted) does not.
    j = next(i for i, a in enumerate(mol.atoms) if a == "N")
    cont = [i for i in range(len(subs)) if (int(subs.masks[i]) >> j) & 1 and 4 <= bin(int(subs.masks[i])).count("1") <= 8]
    away = [i for i in range(len(subs)) if not (int(subs.masks[i]) >> j) & 1 and 3 <= bin(int(subs.masks[i])).count("1") <= 6]
    iA, iB = cont[0], away[0]
    fA, fB = "C5H8N3", "C3H5N2"
    lib.add(fA, float(F.ion_mass(F.vec(fA, els), els)), "msn", 100.0, np.array([iA]), np.array([1.0]))
    lib.add(fB, float(F.ion_mass(F.vec(fB, els), els)), "msn", 100.0, np.array([iB]), np.array([1.0]))
    tp = "C8H11N4O3"
    shifted = F.vec(fA, els) + F.vec({"O": 1}, els)                                # fA + O
    peaks = [(float(F.ion_mass(shifted, els)), 100.0), (float(F.ion_mass(F.vec(fB, els), els)), 60.0), (150.0123, 40.0)]
    mz, rel = (np.array(x) for x in zip(*peaks))
    space = F.FormulaSpace(F.vec(tp, els), els)
    r = LZ.localize(tp, ION, mz, rel, lib, space, tp_mz=float(F.ion_mass(F.vec(tp, els), els)))
    assert r["ok"] and r["type"] == "oxygen" and r["n_shifted"] == 1 and r["n_unshifted"] == 1 and len(r["evidence"]) == 2
    mA, mB = int(subs.masks[iA]), int(subs.masks[iB])
    inside = {a for a in range(mol.n) if (mA >> a) & 1} - {a for a in range(mol.n) if (mB >> a) & 1}
    sites = {int(m).bit_length() - 1 for m in LZ.candidate_sites(F.vec(tp, els) - F.vec(ION, els), els, subs)[0]}
    expected = sites & inside                                                        # the single-atom sites that are inside A and outside B
    assert set(r["region_atoms"]) == expected and expected
    # brute force LL of every site
    R = LZ.candidate_sites(F.vec(tp, els) - F.vec(ION, els), els, subs)[0]
    brute = []
    for m in R:
        m = int(m)
        ll = 0.0
        ll += np.sqrt(1.0) * np.log(LZ.EPS + (1 - 2 * LZ.EPS) * (1.0 if (m & ~mA) == 0 else 0.0))
        ll += np.sqrt(0.6) * np.log(LZ.EPS + (1 - 2 * LZ.EPS) * (1.0 if (m & mB) == 0 else 0.0))
        brute.append(ll)
    assert LZ.site_log_likelihood(R, r["evidence"], lib) == pytest.approx(brute)
    assert r["margin"] > 1.0 and r["top_sites"][0]["ll"] == pytest.approx(max(brute))


def test_water_shift_for_a_hydroxylated_product(world):
    mol, subs, els, lib = build_world(world)
    iA = [i for i in range(len(subs)) if bin(int(subs.masks[i])).count("1") == 6][0]
    lib.add("C5H8N3", 110.0713, "msn", 100.0, np.array([iA]), np.array([1.0]))
    tp = "C8H11N4O3"
    v = F.vec("C5H8N3", els) + F.vec({"O": 1}, els) - F.vec({"H": 2, "O": 1}, els)          # f + O - H2O = f - H2: the shifted fragment of a product that lost water
    mz = np.array([float(F.ion_mass(v, els))])
    ev = LZ.classify_fragments(F.vec(tp, els), mz, np.array([100.0]), lib, F.FormulaSpace(F.vec(tp, els), els), F.vec(tp, els) - F.vec(ION, els))
    assert len(ev) == 1 and ev[0]["kind"] == "S" and ev[0]["library"] == "C5H8N3"
    # a fragment in both relations (f and f - delta in the library) is ambiguous: no evidence
    lib.add("C5H8N3", 110.0713, "msn", 100.0, np.array([iA]), np.array([1.0]))
    both = F.vec("C5H8N3", els)
    lib.add(F.fmt(both + F.vec({"O": 1}, els), els), 126.0, "msn", 50.0, np.array([iA]), np.array([1.0]))
    ev2 = LZ.classify_fragments(F.vec(tp, els), np.array([float(F.ion_mass(both + F.vec({"O": 1}, els), els))]), np.array([100.0]), lib,
                                F.FormulaSpace(F.vec(tp, els), els), F.vec(tp, els) - F.vec(ION, els))
    assert ev2 == []


def test_weak_heavy_and_unknown_fragments_are_not_evidence(world):
    mol, subs, els, lib = build_world(world)
    iA = [i for i in range(len(subs)) if bin(int(subs.masks[i])).count("1") == 6][0]
    lib.add("C5H8N3", 110.0713, "msn", 100.0, np.array([iA]), np.array([1.0]))
    tp = "C8H11N4O3"
    space = F.FormulaSpace(F.vec(tp, els), els)
    d = F.vec(tp, els) - F.vec(ION, els)
    m_ok = float(F.ion_mass(F.vec("C5H8N3", els), els))
    mz = np.array([m_ok, m_ok, 150.0123, 211.0713])
    rel = np.array([100.0, 1.0, 60.0, 80.0])
    ev = LZ.classify_fragments(F.vec(tp, els), mz[:3], rel[:3], lib, space, d)
    assert len(ev) == 1 and ev[0]["kind"] == "U"                                      # the 1 % copy is too weak, 150.01 has no formula in the library
    precursor = float(F.ion_mass(F.vec(tp, els), els))
    assert LZ.classify_fragments(F.vec(tp, els), np.array([precursor - 1.0]), np.array([100.0]), lib, space, d, precursor_mz=precursor) == []


def test_localize_refuses_what_it_cannot_do(world):
    mol, subs, els, lib = build_world(world)
    space = F.FormulaSpace(F.vec("C9H13N4O2", els), els)
    r = LZ.localize("C9H13N4O2", ION, np.array([110.07]), np.array([100.0]), lib, space)
    assert not r["ok"] and r["type"] == "other" and r["note"]
    r = LZ.localize("C8H11N4O3", ION, np.array([110.07]), np.array([100.0]), lib, F.FormulaSpace(F.vec("C8H11N4O3", els), els))
    assert not r["ok"] and "libreria" in r["note"]
    nolib = iimn.FragmentLibrary(els, None)
    assert not LZ.localize("C8H11N4O3", ION, np.array([110.07]), np.array([100.0]), nolib, F.FormulaSpace(F.vec("C8H11N4O3", els), els))["ok"]


def test_groups_and_description(world):
    mol, subs, els = world
    g = LZ.default_groups(mol)
    assert sum(len(v) for v in g.values()) == mol.n and len(g) >= 4
    ring = max(g.values(), key=len)
    assert len(ring) == 9                                                              # the two fused rings of the xanthine skeleton are one system
    d = LZ.describe(set(list(ring)[:3]), g)
    assert d.startswith("anello A (3/9)")
    assert LZ.describe(set(), g) == "-"
    assert LZ.describe({0}, {"x": {0, 1}}) == "x (1/2)"


def test_loss_returns_the_retained_atoms_and_derived_library(world):
    mol, subs, els, lib = build_world(world)
    iA = [i for i in range(len(subs)) if bin(int(subs.masks[i])).count("1") == 6][0]
    lib.add("C5H8N3", 110.0713, "msn", 100.0, np.array([iA]), np.array([1.0]))
    tp = "C7H10N4O2"                                                                   # -CH: a 'loss' of one carbon
    space = F.FormulaSpace(F.vec(tp, els), els)
    mz = np.array([float(F.ion_mass(F.vec("C5H8N3", els), els))])
    r = LZ.localize(tp, ION, mz, np.array([100.0]), lib, space)
    assert r["ok"] and r["type"] == "loss" and set(r["retained_atoms"]) | set(r["region_atoms"]) == set(range(mol.n)) and not set(r["retained_atoms"]) & set(r["region_atoms"])
    d = LZ.derive_library(lib, space, r["evidence"])
    assert "C5H8N3" in d.entries and d.entries["C5H8N3"]["source"] == {"ms2"} and np.array_equal(d.entries["C5H8N3"]["idx"], [iA])


def test_cleavage_parts(world):
    mol, subs, els, lib = build_world(world)
    out = LZ.cleavage_parts("C5H8N3O", lib)                         # heavy atoms C5 N3 O: a part of the molecule
    assert out["n_candidates"] > 0 and set(out["certain"]) <= set(out["possible"]) and max(out["probability"]) <= 1.0 + 1e-9
    assert LZ.cleavage_parts("C20H8N3O", lib)["n_candidates"] == 0
