# TPMINE-PRIVATE
"""WP5 (public, synthetic): the candidate filters and the search for products hidden under an in-source fragment of the parent."""
import numpy as np
import pytest

from mzlab.chem import elements as E
from mzlab.reader.mzml import PeakTable
from tpmine.hr import features as FT
from tpmine.hr import filters as FL

PARENT = E.parse_formula("C8H11N4O2")                      # [M+H]+ of a small molecule, 195.0877


def feats(rows, dt=0.2):
    mz, rt, h = (np.array(v, float) for v in zip(*rows)) if rows else (np.zeros(0),) * 3
    n = len(mz)
    return FT.Features(mz=mz, rt=rt, apex=(rt * 100).astype(int), area=h * 10, height=h, npts=np.full(n, 20), left=rt - 0.05, right=rt + 0.05,
                       background=np.zeros(n, bool), artefact=np.zeros(n, bool), dt=dt)


def test_split_columns():
    ref, tr = FL.split_columns([-1, 0, 5, 10, 20], ["sample", "sample", "sample", "sample", "blank"])
    assert ref.tolist() == [0, 1, 4] and tr.tolist() == [2, 3]
    with pytest.raises(ValueError):
        FL.run_filters(FT.align([feats([(300.0, 5.0, 1e6)])]), [feats([(300.0, 5.0, 1e6)])], [0], None, None)


def test_reference_area_uses_the_features_beside_the_group_not_the_group_cut():
    f_ref = feats([(300.1000, 5.00, 1e6), (300.1002, 5.12, 5e6)])
    f_tr = feats([(300.1001, 5.05, 4e6)])
    al = FT.align([f_ref, f_tr])
    r = FL.reference_area(al, [f_ref])
    assert r.max() == pytest.approx(5e7)                                  # the 5e6 feature, 0.07 min from the group, is "already there"
    far = feats([(300.1000, 5.5, 9e6)])
    assert FL.reference_area(al, [far]).max() == 0                         # 0.45 min away: another compound
    ar = f_ref.select(np.array([True, True]))
    ar.artefact[1] = True
    assert FL.reference_area(al, [ar]).max() == pytest.approx(1e7)         # Fourier artefacts do not count as a reference


def test_isotopologue_needs_a_compatible_ratio():
    mono = feats([(300.1000, 5.0, 1e7), (301.1034, 5.0, 1e6), (301.1034, 6.0, 1e6), (300.5, 5.0, 4e6)])         # 13C at -1.00336 of the next
    f2 = feats([(300.1000, 5.0, 1e7), (301.1034, 5.0, 1.2e6), (301.1034, 7.0, 3e6), (301.1034, 8.0, 6e6)])
    al = FT.align([f2, f2])
    idx = np.arange(len(al))
    strength = al.area.max(1)
    out = FL.isotopologue_mask(al, idx, strength)
    by = {(round(al.mz[i], 2), round(al.rt[i], 0)): out[i] for i in idx}
    assert by[(301.10, 5.0)] and not by[(300.10, 5.0)]                      # 12 % of the light ion, same apex: an isotopologue
    assert not by[(301.10, 7.0)] and not by[(301.10, 8.0)]                  # no stronger ion at the same time; and a ratio 0.3 / 0.6 of nothing
    big = feats([(300.1000, 5.0, 1e7), (301.1034, 5.0, 6e6)])               # 60 % of the light ion: not what 13C can give -> a product
    al2 = FT.align([big])
    assert not FL.isotopologue_mask(al2, np.arange(len(al2)), al2.area.max(1)).any()


def test_formula_feasibility_follows_the_parent():
    space, els = FL.tp_space(PARENT)
    from tpmine.hr import formula as F
    mz = lambda f: float(F.ion_mass(F.vec(f, els), els))
    assert FL.formula_feasible([mz("C8H11N4O2"), mz("C8H11N4O3"), mz("C7H9N4O3"), 100.5, mz("C9H11N4O2")], space).tolist() == [True, True, True, False, False]
    assert not FL.formula_feasible([mz("C8H12N4O2")], space)[0]                                 # radical cation: not a closed-shell ion


def test_flat_mask_keeps_consecutive_transients():
    a = np.array([[1, 2, 1.5, 2, 1],            # similar areas in every treated sample: flat
                  [1, 40, 5, 0, 0],             # varies by more than 3: not flat
                  [0, 1, 1.5, 2, 0],            # three CONSECUTIVE samples: formed and consumed, a transient
                  [1, 0, 2, 0, 1.5],            # three scattered samples with similar areas: noise, flat
                  [0, 0, 0, 3, 4],              # two samples: the reference rule calls it flat
                  [0, 0, 0, 0, 3]]) * 1e6       # a single sample is never flat
    assert FL.flat_mask(a).tolist() == [True, False, False, True, True, False]
    assert FL.flat_mask(a, min_present=4).tolist() == [True, False, False, False, False, False]
    assert FL.flat_mask(a, transient=(9, 9)).tolist() == [True, False, True, True, True, False]


def test_run_filters_funnel():
    """Files: dark, t0 and five treated. A product that grows, its 13C isotopologue, a flat ion that is only in the treated files, an ion with no
    formula, and a background ion everywhere."""
    from tpmine.hr import formula as F
    els = F.element_order(PARENT)
    mz = lambda f: float(F.ion_mass(F.vec(f, els), els))
    prod, flat = mz("C8H11N4O3"), mz("C7H9N4O2")
    times = [-1, 0, 2, 5, 10, 20, 30]
    grow = [0, 0, 8e5, 4e6, 2e6, 1e6, 6e5]
    f = []
    for k, t in enumerate(times):
        rows = [(300.0, 2.0, 5e6)]                                                 # background ion
        if grow[k]:
            rows += [(prod, 4.0, grow[k]), (prod + 1.003355, 4.0, grow[k] * 0.1)]  # product and its 13C
        if t > 0:
            rows += [(flat, 3.0, 1e6 * (1 + 0.1 * k)), (222.2222, 3.0, 4e5)]
        f.append(feats(rows))
    al = FT.align(f)
    fu = FL.run_filters(al, f, times, None, PARENT)
    assert [s["name"] for s in fu.steps] == ["gruppi", "compare", "isotopologhi", "formula", "piatti"]
    n = [s["n"] for s in fu.steps]
    assert n[0] == len(al) and n[1] == 4 and n[2] == 3 and n[3] == 2 and n[4] == 1          # prod + 13C + flat + no-formula | -13C | -no-formula | -flat
    assert al.mz[fu.idx[0]] == pytest.approx(prod, abs=1e-4)
    assert fu.isotopologue.sum() == 1 and fu.fold[fu.idx[0]] > 5
    fu2 = FL.run_filters(al, f, times, None, None)                                    # without a parent: no feasibility step
    assert [s["name"] for s in fu2.steps] == ["gruppi", "compare", "isotopologhi", "piatti"] and fu2.steps[-1]["n"] == 1


# ------------------------------------------------------------------------------------------------------------------ hidden under an ISF
NS = 1200


def ms1_table(parent_height, isf_ratio, product=None, seed=1):
    """MS1 of a parent (m/z 300.15, apex 5.0 min) with an ISF at 261.1 (constant ratio) and, if asked, a product at 261.1 that elutes later."""
    rng = np.random.default_rng(seed)
    rt = np.arange(NS) * 0.01
    ions = [(300.15, 5.0, 0.06, parent_height), (261.1, 5.0, 0.06, parent_height * isf_ratio)]
    if product:
        ions.append((261.1, product[0], 0.05, product[1]))
    mzs, its, pos = [], [], []
    for mz, r0, sg, h in ions:
        y = h * np.exp(-0.5 * ((rt - r0) / sg) ** 2)
        k = np.flatnonzero(y > 2e4)
        mzs.append(mz * (1 + rng.normal(0, 0.3e-6, len(k)))); its.append(y[k] * rng.uniform(0.97, 1.03, len(k))); pos.append(k)
    bg = np.flatnonzero(np.ones(NS, bool))
    mzs.append(np.full(NS, 450.0) * (1 + rng.normal(0, 0.3e-6, NS))); its.append(np.full(NS, 3e5)); pos.append(bg)        # a stable background ion elsewhere
    mz, it, p = np.concatenate(mzs), np.concatenate(its), np.concatenate(pos).astype(np.int32)
    o = np.argsort(mz)
    return PeakTable(rt=rt, scan_ids=np.arange(NS), mz=mz[o].astype(np.float32), inten=it[o].astype(np.float32), pos=p[o], tic=np.zeros(NS))


def test_parent_window_follows_the_hint():
    t = ms1_table(2e8, 0.01)
    w = FL.parent_window(t, 300.15)
    assert abs(w["rt"] - 5.0) < 0.02 and w["i1"] - w["i0"] > 20
    assert FL.parent_window(t, 300.15, rt_hint=9.0, rt_tol=0.5) is None or FL.parent_window(t, 300.15, rt_hint=9.0, rt_tol=0.5)["rt"] > 8   # nothing near 9 min
    assert FL.parent_window(t, 123.4567) is None


def test_isf_hidden_flags_the_late_product_and_not_the_fragment():
    times = [-1, 0, 5, 10, 20, 40]
    # the parent decays with the treatment; the ISF follows it at 1 %; from t10 a product of the same mass elutes 0.15 min later
    parent = [2e8, 2e8, 1.5e8, 1e8, 5e7, 2e7]
    prod = [None, None, None, (5.15, 6e5), (5.15, 8e5), (5.15, 5e5)]
    ms = [FL.isf_measure(ms1_table(h, 0.01, p, seed=k), [261.1, 450.0], 300.15, rt_hint=5.0) for k, (h, p) in enumerate(zip(parent, prod))]
    assert all(m is not None for m in ms)
    res = {round(d["mz"], 1): d for d in FL.isf_hidden(ms, times, None, [261.1, 450.0], min_parent_area=1e6, floor_area=1e4, min_ion_area=1e4, min_ion_height=1e4)}
    assert res[261.1]["candidate"] and res[261.1]["n_shift"] >= 2 and res[261.1]["ratio_reference"] == pytest.approx(0.01, rel=0.2)
    pure = [FL.isf_measure(ms1_table(h, 0.01, None, seed=10 + k), [261.1], 300.15, rt_hint=5.0) for k, h in enumerate(parent)]
    r2 = FL.isf_hidden(pure, times, None, [261.1], min_parent_area=1e6, floor_area=1e4, min_ion_area=1e4, min_ion_height=1e4)[0]
    assert not r2["candidate"] and r2["n_up"] == 0 and r2["p_constant"] > 0.01               # a pure fragment: constant ratio, no peak of its own


def test_isf_hidden_uses_the_session_of_the_sample():
    times = [-1, 0, 5, 10]
    parent = [1e8, 1e8, 1e8, 1e8]
    ratios = [0.010, 0.020, 0.020, 0.010]                       # the second session fragments twice as much, treated or not
    ms = [FL.isf_measure(ms1_table(h, r, None, seed=k), [261.1], 300.15, rt_hint=5.0) for k, (h, r) in enumerate(zip(parent, ratios))]
    kw = dict(min_parent_area=1e6, floor_area=1e4, min_ion_area=1e4, min_ion_height=1e4)
    assert FL.isf_hidden(ms, times, None, [261.1], ["a", "b", "b", "a"], **kw)[0]["n_up"] == 0
    assert FL.isf_hidden(ms, times, None, [261.1], None, **kw)[0]["n_up"] >= 1                   # without sessions the comparison is unfair


def test_isf_coincident():
    al = FT.align([feats([(261.1016, 5.7, 1e6), (261.1016, 9.0, 1e6), (300.0, 5.7, 1e6)])])
    out = FL.isf_coincident(al, np.arange(len(al)), [188.0488, 261.1016], parent_rt=5.66)
    assert out.sum() == 1 and out[np.argmin(np.abs(al.rt - 5.7) + np.abs(al.mz - 261.1016))]
    assert not FL.isf_coincident(al, np.arange(len(al)), [], 5.66).any()
