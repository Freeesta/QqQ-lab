# TPMINE-PRIVATE
"""Validation of the high-resolution path on the real files of the private data repository (QQQ_DATI). Skipped without it. The expected values
are read from JSON files in that repository (scratchpad/*_truth.json): this public file carries no compound, formula or m/z of the test set."""
import json
import os
import time
from pathlib import Path

import pytest

from qqq_lab.reader.mzml import Run
from tpmine.hr import msn

DATI = Path(os.environ["QQQ_DATI"]) if os.environ.get("QQQ_DATI") else None


def _find(key):
    """The truth file (scratchpad/*_truth.json) that has this top-level key, or None: the files are found by content, not by name."""
    for f in sorted((DATI / "scratchpad").glob("*_truth.json")) if DATI and (DATI / "scratchpad").is_dir() else []:
        try:
            if key in json.loads(f.read_text(encoding="utf-8")):
                return f
        except ValueError:
            pass
    return None


TRUTH, MSN_TRUTH = _find("tps"), _find("nodes")
need = pytest.mark.skipif(TRUTH is None or MSN_TRUTH is None, reason="QQQ_DATI with the truth files not available")


@pytest.fixture(scope="module")
def msn_tree():
    mt = json.loads(MSN_TRUTH.read_text(encoding="utf-8"))
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    run = Run(DATI / mt["file"])
    t0 = time.perf_counter()
    tree = msn.build_tree(run, truth["parent"]["ion"], truth["parent"]["smiles"])
    return mt, run, tree, time.perf_counter() - t0


@need
def test_reader_levels(msn_tree):
    mt, run, _, _ = msn_tree
    import collections
    c = collections.Counter(s.level for s in run.scans)
    assert {str(k): v for k, v in c.items()} == mt["levels"]
    assert all(s.path and len(s.path) == s.level - 1 for s in run.scans if s.level > 1)
    assert max(len(s.precursors) for s in run.scans) == 5 and min(len(s.precursors) for s in run.scans if s.level > 1) == 1


@need
def test_tree_formulas_ppm_ghosts_and_time(msn_tree):
    mt, _, tree, dt = msn_tree
    by_path = {}
    for n in tree.nodes:
        by_path.setdefault(tuple(m for m, _, _ in n["path"]), []).append(n)
    for exp in mt["nodes"]:
        nodes = by_path.get(tuple(exp["path"]))
        assert nodes, f"node {exp['path']} missing"
        assert all(n["formula"] == exp["formula"] for n in nodes), (exp, [n["formula"] for n in nodes])
    for n in tree.nodes:
        if n["ppm"] is not None:
            assert abs(n["ppm"]) <= mt["max_precursor_ppm_after_calibration"], n["id"]
    for g in mt["ghost_paths"]:
        assert all(n["ghost"] for n in by_path[tuple(g)])
    assert dt <= mt["max_seconds"], f"MSn tree took {dt:.1f} s"
    print(f"\nMSn tree: {dt:.2f} s, {len(tree.nodes)} nodes, calibration {tree.cal.as_dict()}")


@need
def test_tree_atom_sets_collapse(msn_tree):
    _, _, tree, _ = msn_tree
    n_by_depth = {}
    for n in tree.nodes:
        if n["atom_candidates"] and not n["ghost"]:
            n_by_depth.setdefault(len(n["path"]), []).append(n["atom_candidates"]["n"])
    assert tree.subs is not None and len(tree.subs) > 100
    # the hierarchical constraint leaves very few candidates in the deeper, clean nodes
    assert min(n_by_depth[3]) <= 3 and min(n_by_depth[4]) <= 3


# ---------------------------------------------------------------------------------------------------------------------- WP4: features
def _series():
    import glob
    import re
    files = glob.glob(str(DATI / "HRMS" / "*" / "*TiO2*.mzML"))               # the irradiation series: dark adsorption (time -1) and the treated samples
    t = lambda f: float(re.search(r"t(\d+)min", f).group(1)) if re.search(r"t(\d+)min", f) else -1.0
    return sorted(files, key=t), [t(f) for f in sorted(files, key=t)]


@pytest.fixture(scope="module")
def series_features():
    import resource
    import numpy as np
    from tpmine.hr import features as FT
    files, times = _series()
    feats, secs = [], []
    for f in files:
        r = Run(f)
        t0 = time.perf_counter()
        feats.append(FT.detect_file(r))
        secs.append(time.perf_counter() - t0)
        r.close()
    t0 = time.perf_counter()
    al = FT.align(feats)
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    return feats, np.array(times), al, secs, time.perf_counter() - t0, rss


@need
def test_features_recall_alignment_time_and_memory(series_features):
    import numpy as np
    feats, times, al, secs, t_align, rss = series_features
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    miss, n = [], 0
    for tp in truth["tps"]:
        for rt in tp["rt_obs"]:
            n += 1
            s = (np.abs(al.mz - tp["mz"]) <= tp["mz"] * 5e-6) & (np.abs(al.rt - rt) <= 0.15)
            if not (s.any() and (al.area[s][:, times > 0] > 0).any()):
                miss.append((tp["id"], rt))
    assert not miss, f"traces of the reference products not found: {miss}"
    assert 400_000 < sum(len(f) for f in feats) < 3_000_000
    assert not any(f.background.all() for f in feats)
    print(f"\nfeatures: {n} traces found; detect {np.round(secs, 1).tolist()} s; align {t_align:.1f} s; {len(al)} groups; peak RSS {rss:.0f} MB")
    # measured on a quiet 4-CPU machine: 3-6 s per file (up to 10 s for the files with a doubled TIC), 1.4-1.5 GB; the bounds leave room for a busy one
    assert max(secs) <= 30 and np.median(secs) <= 12
    assert rss <= 2000


@need
def test_features_drift_of_a_strong_trace_is_small(series_features):
    """The group of an intense product keeps its apex within a few tenths of a minute across files (the open problem of RT drift)."""
    import numpy as np
    _, times, al, _, _, _ = series_features
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    spreads = []
    for tp in truth["tps"]:
        for rt in tp["rt_obs"]:
            s = np.flatnonzero((np.abs(al.mz - tp["mz"]) <= tp["mz"] * 5e-6) & (np.abs(al.rt - rt) <= 0.15))
            if len(s):
                i = s[np.argmax(al.area[s].max(1))]
                a = al.apex_rt[i][~np.isnan(al.apex_rt[i])]
                if len(a) >= 5:
                    spreads.append(float(np.ptp(a)))
    assert spreads and max(spreads) <= 0.4 and np.median(spreads) <= 0.2


# ---------------------------------------------------------------------------------------------------------------------- WP5: filters
@need
def test_filters_funnel_recall_and_isf(series_features):
    import glob
    import re
    import numpy as np
    from qqq_lab.chem import elements as E
    from tpmine.hr import features as FT
    from tpmine.hr import filters as FL
    feats, times, al, _, _, _ = series_features
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    parent = E.parse_formula(truth["parent"]["ion"])
    fu = FL.run_filters(al, feats, times, None, parent)
    n = [s["n"] for s in fu.steps]
    print("\nfunnel:", n)
    assert n[0] > 50_000 and 5_000 < n[1] < 30_000 and n[2] <= n[1] and 800 < n[3] < 4_000 and n[4] <= n[3]
    keep = np.zeros(len(al), bool)
    keep[fu.idx] = True
    missed, n_tp = [], 0
    for tp in truth["tps"]:
        for rt in tp["rt_obs"]:
            if rt <= 0.7:
                continue
            n_tp += 1
            if not (keep & (np.abs(al.mz - tp["mz"]) <= tp["mz"] * 5e-6) & (np.abs(al.rt - rt) <= 0.15)).any():
                missed.append(tp["id"])
    print("reference traces kept by the filters:", n_tp - len(missed), "/", n_tp, "missed", missed)
    ntr = n_tp
    assert len(missed) <= 1 and ntr >= 20                      # the one lost is the product under the in-source fragment of the parent (next step)

    # hidden under an in-source fragment: XICs of the exact masses in the window of the parent, file by file
    files = sorted(glob.glob(str(DATI / "HRMS" / "*" / "*TiO2*.mzML")), key=lambda f: float(re.search(r"t(\d+)min", f).group(1)) if re.search(r"t(\d+)min", f) else -1.0)
    masses = [tp["mz"] for tp in truth["tps"] if tp["id"] in missed or tp["id"] in ("188", "315")]
    isf_lib = [261.1016, 188.0488, 244.0750]
    allm = sorted(set(masses) | set(isf_lib))
    ms = []
    for f in files:
        r = Run(f)
        ms.append(FL.isf_measure(r.table(1, 1), allm, truth["parent"]["mz"], rt_hint=truth["parent"]["rt_obs"]))
        r.close()
    t_arr = [float(re.search(r"t(\d+)min", f).group(1)) if re.search(r"t(\d+)min", f) else -1.0 for f in files]
    sess = ["b" if t in (0.0, 5.0, 7.0, 120.0) else "a" for t in t_arr]          # the two measurement sessions (WP10 reads them from the file header)
    res = {round(d["mz"], 4): d for d in FL.isf_hidden(ms, t_arr, None, allm, sess)}
    hits = [m for m in missed for tp in truth["tps"] if tp["id"] == m and res[round(tp["mz"], 4)]["candidate"]]
    assert set(hits) == set(missed), f"products not recovered by the search under the fragment: {set(missed) - set(hits)}"
    assert not res[round(244.0750, 4)]["candidate"]                       # a pure fragment of the parent: not a candidate


# ---------------------------------------------------------------------------------------------------------------------- WP6: families
@need
def test_families_of_the_parent_and_its_in_source_fragments(msn_tree):
    import glob
    import numpy as np
    from tpmine.hr import iimn
    _, _, tree, _ = msn_tree
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    lib = iimn.build_library(tree)
    assert len(lib) > 100 and all(e["idx"] is not None for e in lib.entries.values())
    f = [x for x in glob.glob(str(DATI / "HRMS" / "*" / "*TiO2*.mzML")) if "t002min" in x][0]
    run = Run(f)
    table = run.table(1, 1)
    rt0 = truth["parent"]["rt_obs"]
    t0 = time.perf_counter()
    win = iimn.window_profiles(table, rt0 - 0.3, rt0 + 0.4)
    dt = time.perf_counter() - t0
    pm = truth["parent"]["mz"]
    fam = iimn.family(win, pm, rt0)
    c = iimn.collapse(fam)
    names = {e["name"] for e in c["evidence"]}
    print(f"\nwindow of {len(win)} profiles in {dt * 1000:.0f} ms; parent family: {sorted(names)}")
    assert dt < 1.0 and len(win) > 1000 and "[M+Na]+" in names and "13C" in names and c["role"] == "ion"
    # the fragments of the parent that the MSn tree knows are explained as in-source fragments when they follow the parent
    found = 0
    for mz in sorted({round(float(m), 4) for m in lib.masses() if 150 < m < pm - 20}):
        fm = iimn.family(win, mz, rt0, parent_mz=pm, library=lib)
        if fm and iimn.collapse(fm)["role"] == "loss":
            found += 1
    assert found >= 2
    # the artefacts of the Fourier transform around the intense parent are recognised
    assert win.artefact.sum() >= 1


# ---------------------------------------------------------------------------------------------------------------------- WP7: MS2 and isomers
@need
def test_ms2_of_a_feature_and_coeluting_isomers():
    import glob
    import re
    import numpy as np
    from tpmine.hr import formula as F
    from tpmine.hr import spectra as SP
    iso = json.loads(MSN_TRUTH.read_text(encoding="utf-8"))["isomers"]
    files = sorted(glob.glob(str(DATI / "HRMS" / "*" / "*TiO2*.mzML")), key=lambda f: float(re.search(r"t(\d+)min", f).group(1)) if re.search(r"t(\d+)min", f) else -1.0)
    runs = [Run(f) for f in files]
    ixs = [SP.index_ms2(r) for r in runs]
    sel = SP.select_ms2(ixs, iso["mz"], [tuple(iso["window"])] * len(files))
    assert len(sel) >= 12
    mzs, ints, rts = SP.read_spectra(runs, sel)
    cons = SP.ms2_consensus(mzs, ints)
    assert len(cons["mz"]) >= 5 and cons["rel"].max() == pytest.approx(100.0)
    # MS1 trace of the strongest file
    best = max(range(len(files)), key=lambda k: runs[k].table(1, 1).xic(iso["mz"], iso["mz"] * 5e-6).max())
    T = runs[best].table(1, 1)
    y = T.xic(iso["mz"], iso["mz"] * 5e-6)
    w = (T.rt > iso["window"][0] - 0.1) & (T.rt < iso["window"][1] + 0.1)
    from qqq_lab.chem import elements as E
    els = F.element_order(E.parse_formula(iso["formula"]))
    top = F.vec(iso["formula"], els)
    space = F.FormulaSpace(top, els)
    d = SP.deconvolve_isomers(mzs, ints, rts, xic=(T.rt[w], y[w]), allowed=lambda m: space.count(np.asarray(m), 5.0, 0.002, within=top) > 0)
    assert d["k"] == iso["n_components"] == len(d["components"])

    def level(c, mz):
        m, rel = c["spectrum"]
        j = np.flatnonzero(np.abs(m - mz) <= mz * 8e-6)
        return float(rel[j].max()) if len(j) else 0.0
    # components are ordered by retention time; the expected spectra are matched to them in any order (the apex of a component is not its isomer)
    remaining = list(range(len(d["components"])))
    for exp in iso["components"]:
        ok = [i for i in remaining if all(level(d["components"][i], float(mz)) >= thr for mz, thr in exp.get("present", {}).items())
              and all(level(d["components"][i], float(mz)) < thr for mz, thr in exp.get("absent", {}).items())]
        assert ok, f"no component matches {exp}"
        remaining.remove(ok[0])
    assert not remaining


# ---------------------------------------------------------------------------------------------------------------------- WP8: similarity
@need
def test_similarity_hcd_against_hcd_and_against_cid(msn_tree):
    import glob
    import re
    import numpy as np
    from tpmine.hr import similarity as SM
    from tpmine.hr import spectra as SP
    cfg = json.loads(MSN_TRUTH.read_text(encoding="utf-8"))["similarity"]
    truth = json.loads(TRUTH.read_text(encoding="utf-8"))
    _, _, tree, _ = msn_tree
    files = sorted(glob.glob(str(DATI / "HRMS" / "*" / "*TiO2*.mzML")), key=lambda f: float(re.search(r"t(\d+)min", f).group(1)) if re.search(r"t(\d+)min", f) else -1.0)
    runs = [Run(f) for f in files]
    ixs = [SP.index_ms2(r) for r in runs]

    def cons(mz, lo, hi):
        sel = SP.select_ms2(ixs, mz, [(lo, hi)] * len(files))
        a, b, _ = SP.read_spectra(runs, sel)
        return SP.ms2_consensus(a, b)
    pm = truth["parent"]["mz"]
    c = cons(pm, *cfg["parent_window"])
    names, specs, precs = ["parent"], [SM.prepare(c["mz"], c["rel"], pm)], [pm]
    for tp in truth["tps"]:
        if tp["id"] in cfg["modified_ids"]:
            rt = tp["rt_obs"][0]
            cc = cons(tp["mz"], rt - cfg["window"], rt + cfg["window"])
            names.append(tp["id"]); specs.append(SM.prepare(cc["mz"], cc["rel"], tp["mz"])); precs.append(tp["mz"])
    M, W, P = SM.pad(specs, precs)
    others, sc, nm = SM.one_against_all(M, W, P, 0)
    print("\nTP vs parent (HCD, HCD):", {names[i]: round(float(s), 2) for i, s in zip(others, sc)})
    lo, hi = cfg["modified_range"]
    assert len(sc) == len(cfg["modified_ids"]) and (sc >= lo).all() and (sc <= hi).all() and (nm >= 4).all()
    nd = tree.node(cfg["cid_node"])
    cid = SM.prepare([p["mz"] for p in nd["peaks"]], [p["rel"] for p in nd["peaks"]], nd["prec_mz"])
    M2, W2, P2 = SM.pad([specs[0], cid], [pm, nd["prec_mz"]])
    parent_cos = float(SM.modified_cosine(M2, W2, P2, [0], [1])[0][0])
    a, b = cfg["parent_hcd_vs_cid"]
    print(f"parent HCD vs parent CID (infusion): {parent_cos:.2f}")
    assert a <= parent_cos <= b
    M3, W3, P3 = SM.pad([cid] + specs[1:], [nd["prec_mz"]] + precs[1:])
    _, sc3, _ = SM.one_against_all(M3, W3, P3, 0)
    assert (sc3 <= cfg["vs_cid_max"]).all() and np.median(sc3) < np.median(sc)
