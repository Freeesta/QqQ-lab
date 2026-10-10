# TPMINE-PRIVATE
"""Low-resolution engine: isomers (one row per chromatographic peak), vectorised search of unexpected ions, growth by Spearman rank correlation,
kinetic generation as evidence. Synthetic data of lr_synth.py (truth in its docstring)."""
import time

import numpy as np
import pytest

import lr_synth
from legacy_discover import legacy_discover
from tpmine.engine import Experiment
from tpmine.peaks import find_peaks
from tpmine.score import DEFAULT_THRESHOLDS, score_candidate, spearman

PARENT = {"name": "Parent", "neutral": "CC(C)N1C(=O)C2=CC=CC=C2NS1(=O)=O"}


@pytest.fixture(scope="module")
def series(tmp_path_factory):
    return lr_synth.write_series(tmp_path_factory.mktemp("lr"))


@pytest.fixture(scope="module")
def result(series):
    ex = Experiment(series, PARENT, {})
    return ex, ex.run()


def _trace(centres, heights=None, sigma=0.07, step=0.04, seed=1):
    rt = np.arange(0.5, 12, step)
    y = sum(h * np.exp(-0.5 * ((rt - c) / sigma) ** 2) for c, h in zip(centres, heights or [1e6] * len(centres)))
    return rt, y + np.random.default_rng(seed).uniform(0, 2e3, len(rt))


def test_find_peaks_valley():
    assert [round(p["apex_rt"], 1) for p in find_peaks(*_trace([5.0, 5.4]))] == [5.0, 5.4] or len(find_peaks(*_trace([5.0, 5.4]))) == 2
    assert len(find_peaks(*_trace([5.0, 5.18], sigma=0.12))) == 1               # a shallow valley: one peak
    assert len(find_peaks(*_trace([5.0]))) == 1 and find_peaks(rt=np.arange(5), y=np.zeros(5)) == []
    lone = find_peaks(*_trace([4.0, 8.0], [1e6, 3e5]))
    assert [round(p["apex_rt"]) for p in lone] == [4, 8]                         # strongest first


def test_spearman():
    assert spearman([1, 2, 3, 4], [1, 5, 9, 20]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)
    assert spearman([1, 2, 3], [5, 5, 5]) is None
    assert spearman([1, 2, 3, 4], [0, 0, 1, 2]) > 0.9                            # ties are ranked together


def _rows(times, areas):
    return [{"label": f"t{t}", "time": t, "type": "sample", "area": a, "snr": 50.0, "detected": a > 0} for t, a in zip(times, areas)]


def _growth(areas, times=(0, 5, 10, 15, 30, 45, 60)):
    sc = score_candidate(_rows(times, areas), DEFAULT_THRESHOLDS)
    return next(c for c in sc["criteria"] if c["name"] == "grows over time")["status"]


def test_growth_criterion():
    assert _growth([0, 2, 5, 8, 9, 9.5, 10]) == "pass"
    assert _growth([0, 3, 7, 9, 6, 3, 1]) == "pass"                              # grows, then falls (a product of a product)
    assert _growth([5, 5.2, 4.9, 5.1, 5.0, 5.1, 4.95]) == "fail"                 # flat
    assert _growth([0, 5, 5, 5, 5, 5, 5]) == "pass"                              # appears at the first treated point and stays: it did rise
    assert _growth([9, 7, 4, 2, 1, 0.5, 0]) == "fail"                            # decays
    assert _growth([0, 6, 5, 3, 2, 1, 0.5]) == "pass"                            # maximum at the second point: a fast product


def test_isomers_and_timing(result):
    ex, s = result
    oh = sorted((r for r in s["rows"] if r["name"].startswith("hydroxylation @")), key=lambda r: r["ref_rt"])
    assert [r["name"] for r in oh] == ["hydroxylation @ 7.40 min", "hydroxylation @ 8.30 min"]
    assert len({r["id"] for r in s["rows"]}) == len(s["rows"])
    assert oh[0]["id"] != oh[1]["id"] and all(r["label"] == "forte" for r in oh)
    assert not any(r["name"] == "hydroxylation" for r in s["rows"])        # every isomer carries its RT
    assert sum(r["name"] == "parent" for r in s["rows"]) == 1                  # the parent is never split
    d = ex.detail(oh[1]["id"])
    assert abs(d["ref_rt"] - 8.3) < 0.1 and d["traces"]
    assert set(s["timing"]) == {"calibration", "candidates", "xic", "unexpected", "ms2", "summary", "total"}


def test_unexpected_vectorised(result):
    ex, s = result
    un = {round(r["mz"], 1): r for r in s["rows"] if r["kind"] == "unexpected"}
    assert set(un) == {333.2, 355.1}, un.keys()                                   # 334.2 is the 13C peak, 289.1 is flat, 311.1 is in the blank
    assert abs(un[355.1]["ref_rt"] - 5.2) < 0.1 and abs(un[333.2]["ref_rt"] - 6.8) < 0.1
    crit = {c["name"]: c for c in ex.detail(un[355.1]["id"])["criteria"]}
    assert crit["grows over time"]["status"] == "pass" and "kinetic generation" in crit and crit["kinetic generation"]["status"] == "n/a"
    assert un[355.1]["generation"] in ("first", "second", "undecidable")


def test_same_ions_as_the_window_search(series):
    def ions(ex):
        return sorted((e["mz"], ex._base[e["id"]]["ref_rt"]) for e in ex.entries if e["kind"] == "unexpected")

    def fresh():
        ex = Experiment(series, PARENT, {"discover": False})
        ex.run()
        return ex
    new, old = fresh(), fresh()
    t = time.perf_counter()
    new.discover()
    t_new = time.perf_counter() - t
    t = time.perf_counter()
    legacy_discover(old)
    t_old = time.perf_counter() - t
    a, b = ions(new), ions(old)
    assert len(a) == len(b) == 2
    assert all(abs(x[0] - y[0]) <= 0.1 and abs(x[1] - y[1]) <= 0.1 for x, y in zip(a, b))
    assert t_old > 2 * t_new, (t_old, t_new)
