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
