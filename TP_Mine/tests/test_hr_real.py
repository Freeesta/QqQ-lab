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
