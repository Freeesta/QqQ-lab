# TPMINE-PRIVATE
"""Tests of the private TP Mine engine. Run: PYTHONPATH=<repo>:<this folder>/py python3 -m pytest -q <this folder>/tests
(the repo folder gives mzlab: reader and masses). Real-data tests need QQQ_MZML (the Data/mzML folder) and are skipped otherwise."""
import json, os, sys
from pathlib import Path
import pytest
from mzlab.chem.elements import fmt, mass
from tpmine import api, chem, mrm
from tpmine.demo import make_demo
from tpmine.engine import Experiment, guess_sample

BENTA = "CC(C)N1C(=O)C2=CC=CC=C2NS1(=O)=O"


def test_smiles_formulas():
    cases = {BENTA: "C10H12N2O3S", "CC(C)N(C(=O)COc1nnc(s1)C(F)(F)F)c1ccc(F)cc1": "C14H13F4N3O2S", "Cn1cnc2c1c(=O)n(C)c(=O)n2C": "C8H10N4O2",
             "NC(=O)N1c2ccccc2C=Cc2ccccc12": "C15H12N2O", "c1ccccc1": "C6H6", "[O-][N+](=O)N=C1NCCN1Cc1ccc(Cl)nc1": "C9H10ClN5O2"}
    for smi, f in cases.items():
        assert fmt(chem.smiles_formula(smi)) == f, smi
    assert fmt(chem.neutral_formula("C10H12N2O3S")) == "C10H12N2O3S"
    with pytest.raises(ValueError):
        chem.neutral_formula("zzz(")


def test_candidates():
    c = chem.generate(chem.neutral_formula("C10H12N2O3S"), "[M+H]+", chem.default_transformations(), 2, 0.35)
    assert c[0]["name"] == "parent" and abs(c[0]["mz"] - 241.0641) < 1e-3
    oh = next(x for x in c if x["name"] == "hydroxylation")
    assert abs(oh["mz"] - 257.0590) < 2e-3 and oh["formula"] == "C10H12N2O4S"
    assert all(min(abs(a["mz"] - b["mz"]) for b in c if b is not a) > 0.35 for a in c)         # unit resolution: one row per trace


def test_guess_sample():
    assert guess_sample("B_FullMass-t30 (2).mzML")["time"] == 30
    assert guess_sample("x_t7.5.mzML")["time"] == 7.5
    assert guess_sample("blank_1.mzML")["type"] == "blank"
    assert guess_sample("B_MRM-STD_12ppm.mzML")["type"] == "standard"
    assert mrm.conc_from_name("B_MRM-STD_0_06ppm.mzML") == pytest.approx(0.06) and mrm.conc_from_name("std 12 ppb") == pytest.approx(0.012)


@pytest.fixture(scope="module")
def demo_summary(tmp_path_factory):
    files = make_demo(tmp_path_factory.mktemp("d"))
    ex = Experiment(files, {"name": "Bentazone", "neutral": BENTA})
    return ex, ex.run()


def test_bentazone_pipeline(demo_summary):
    ex, s = demo_summary
    assert s["offset"]["applied"] and abs(s["offset"]["offset"] - 0.31) < 0.05
    assert abs(s["decay"]["k_per_min"] - 0.05) < 0.005
    strong = {r["name"] for r in s["rows"] if r["kind"] == "candidate" and r["label"] == "forte"}
    assert strong == {"hydroxylation", "loss of propene (N-deisopropylation)", "dehydrogenation"}
    weak = {r["name"]: r for r in s["rows"] if r["label"] == "debole"}
    assert "dihydroxylation" in weak            # the contaminant present in the blank is rejected
    oh = next(r for r in s["rows"] if r["name"] == "hydroxylation")
    assert abs(oh["ref_rt"] - 7.4) < 0.1          # not the interference of the same mass at RT 4.1
    d = ex.detail(oh["id"])
    assert d["level"] == 3 and d["ms2"]["shifted"] == 1
    assert any(abs(t["Q3_consigliato"] - 215.0) < 0.15 for t in d["transitions"])
    json.dumps(s)                                 # everything is JSON-serialisable


def test_api_roundtrip(tmp_path):
    api.DATA = tmp_path
    d = json.loads(api.demo())
    out = json.loads(api.run(json.dumps(d["files"]), json.dumps(d["parent"]), "{}", ""))
    assert out["rows"][0]["label"] in ("forte", "progenitore")
    assert json.loads(api.detail(out["rows"][0]["id"]))["criteria"] is not None
    assert json.loads(api.formula_info(BENTA))["formula"] == "C10H12N2O3S"
    assert chem.parse_transformations(api.default_transformations())


MZ = os.environ.get("QQQ_MZML")


@pytest.mark.skipif(not MZ, reason="real mzML not available")
def test_real_flufenacet_series():
    D = Path(MZ)
    names = [f"B_FullMass-t{t}" for t in (0, 5, 10, 15, "30 (2)", 45, 60)] + ["B_MS2-t15", "B_MRM-t0", "B_MRM-STD_0_6ppm", "B_MRM-STD_2_4ppm", "B_MRM-STD_7_2ppm", "B_MRM-STD_12ppm"]
    ex = Experiment([{"name": n + ".mzML", "path": str(D / (n + ".mzML"))} for n in names], {"neutral": "CC(C)N(C(=O)COc1nnc(s1)C(F)(F)F)c1ccc(F)cc1"})
    s = ex.run()
    assert abs(s["offset"]["offset"] - 0.295) < 0.03
    assert 2.0 < s["decay"]["half_life_min"] < 4.0
    assert sum(1 for r in s["rows"] if r["kind"] == "candidate" and r["label"] == "forte") >= 3
    assert s["mrm"]["calibration"]["r2"] > 0.9 and s["mrm"]["transitions"][0]["name"] == "364.1>194.1"


@pytest.mark.skipif(not MZ, reason="real mzML not available")
def test_insource_flag_uses_isf_evidence():
    """The `insource` flag comes from tpmine.isf (measured evidence) for the ions that co-elute with the parent; the heuristic is only the fallback."""
    D = Path(MZ)
    names = [f"B_FullMass-t{t}" for t in (0, 5, 10, 15, "30 (2)", 45, 60)]
    ex = Experiment([{"name": n + ".mzML", "path": str(D / (n + ".mzML"))} for n in names], {"neutral": "CC(C)N(C(=O)COc1nnc(s1)C(F)(F)F)c1ccc(F)cc1"})
    s = ex.run(); json.dumps(s)
    with_isf = [r for r in s["rows"] if r.get("isf")]
    assert with_isf, "no co-eluting ion was evaluated"
    for r in with_isf:
        assert 0 <= r["isf"]["probs"]["isf"] <= 1 and "reasons" in r["isf"]
        if r["delta_mz"] > 0:
            assert not r["insource"]                                   # heavier than the parent can never be an in-source fragment
    flagged = {round(r["mz"]) for r in s["rows"] if r["insource"]}
    print("insource:", sorted(flagged), [(round(r["mz"]), round(r["isf"]["probs"]["isf"], 2), r["isf"]["doubtful"]) for r in with_isf])
    assert flagged & {194, 152, 124}, flagged                          # the known in-source fragments of the lab compound


def test_demo_summary_has_isf_key(demo_summary):
    _, s = demo_summary
    assert all("isf" in r for r in s["rows"])                          # None when no ion was evaluated, never missing
    json.dumps(s)
