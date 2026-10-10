# TPMINE-PRIVATE
"""Tests of the ISF classifier (tpmine.isf). Run: PYTHONPATH=<repo>:TP_Mine/py QQQ_MZML=<Data/mzML> python3 -m pytest -q TP_Mine/tests
Synthetic scenes with known truth (mzlab.demo.isf_series); the real-data test is skipped without QQQ_MZML."""
import json, os
from pathlib import Path
import numpy as np
import pytest
from mzlab import demo, ionfamily as F
from tpmine import isf

OFF = demo.ISF_OFFSET
PMZ = demo.ISF_PARENT_MZ + OFF


@pytest.fixture(scope="module")
def series():
    ser = demo.isf_series(times=(5, 10, 15, 30, 45, 60), seed=777)
    return [{"label": "t%g" % t, "time": float(t), "table": tb, "key": "tisf_%g" % t} for t, tb, _ in ser]


def cls(samples, mz, **kw):
    rep = F.origin_report(samples, mz + OFF, PMZ, top=0)
    return isf.classify_report(rep, **kw)


def test_model_present():
    assert isf.MODEL is not None and isf.MODEL["meta"]["auc_cv"] > 0.85


def test_isf_inherited(series):
    r = cls(series, 194.0, formula_p="C14H13F4N3O2S")
    assert r["p_inherited"] > 0.7 and r["probs"]["isf"] > 0.5, r["explanation"]


def test_tp_are_low(series):
    for mz in (380.0, 322.0, 280.0):               # TP_early, TP_late, TP_coelute
        r = cls(series, mz)
        assert r["p_inherited"] < 0.4, (mz, r["p_inherited"], r["explanation"])


def test_heavier_than_parent_is_never_isf(series):
    for mz in (365.0, 386.0, 380.0, 400.0):
        r = cls(series, mz)
        assert r["probs"]["isf"] < 1e-9, (mz, r["probs"])


def test_isotope_and_adduct_roles(series):
    assert cls(series, 365.0)["probs"]["isotope"] > 0.3
    assert cls(series, 386.0)["probs"]["adduct"] > 0.2


def test_isobaric_hard_case_is_doubtful_with_reason(series):
    r = cls(series, 346.0)                           # ISF (water loss) + co-eluting product with the same m/z
    assert r["doubtful"] and r["reasons"], r["explanation"]
    fam = isf.families(series, PMZ)
    if fam.get("ok") and fam["ion_share"].get(round(346.0 + OFF, 1)):
        comps = fam["ion_share"][round(346.0 + OFF, 1)]["components"]
        assert len([c for c in comps if c >= 0.15]) >= 2, comps       # the ion is split between two components


def test_json_and_sheets(series):
    res = isf.classify_ions(series, PMZ, [194.0 + OFF, 380.0 + OFF, 346.0 + OFF], formula_p="C14H13F4N3O2S")
    json.dumps(res)
    assert res["items"][0]["isf_ness"] >= res["items"][-1]["isf_ness"]
    sh = isf.to_sheets(res)
    assert sh[0]["name"] == "Candidates" and all(len(r) == len(sh[0]["head"]) for r in sh[0]["rows"])
    assert all(len(r) == len(sh[1]["head"]) for r in sh[1]["rows"])


def test_single_sample_does_not_crash(series):
    r = cls(series[:1], 194.0)
    assert 0 <= r["p_inherited"] <= 1
    assert not any(e["name"] == "kin_sp" and abs(e["log_odds"]) > 1e-9 for e in r["evidence"])     # no kinetics with one sample: no weight


def test_ms2_and_ramp_flagged_uncalibrated(series):
    rep = F.origin_report(series, 194.0 + OFF, PMZ, top=0)
    rep["ms2"] = {"x_in_p": True, "modified_cosine": 0.8}
    r = isf.classify_report(rep)
    assert any(e["name"] == "ms2" and not e["calibrated"] for e in r["evidence"])


MZML = os.environ.get("QQQ_MZML")


@pytest.mark.skipif(not MZML or not Path(MZML).exists(), reason="real mzML not available")
def test_real_flufenacet_isf():
    from mzlab.project import guess_sample
    from mzlab.reader.mzml import Run
    samples = []
    for p in sorted(Path(MZML).glob("B_FullMass-t*.mzML")):
        _, t, _ = guess_sample(p.name)
        if t >= 5:
            samples.append({"label": "t%g" % t, "time": float(t), "table": Run(p).table(1, 1), "key": "r%g" % t})
    res = isf.classify_ions(samples, 364.35, [194.3, 152.3, 124.3, 154.3, 126.1, 386.3, 305.3], formula_p="C14H13F4N3O2S", fam=False)
    got = {round(i["mz"], 1): i for i in res["items"]}
    print({k: (round(v.get("p_inherited", -1), 2), v.get("doubtful")) for k, v in got.items()})
    assert got[194.3]["p_inherited"] > 0.5
