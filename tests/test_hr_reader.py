"""B2: what the reader takes from a high-resolution DDA file (model, analyzer, parent, isolation window, activation, NCE) and the three DDA routes."""
import json
import re
import shutil
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import dati_sintetici as ds  # noqa: E402
from mzlab import api  # noqa: E402
from mzlab.app import App  # noqa: E402
from mzlab.reader.mzml import Run  # noqa: E402


@pytest.fixture(scope="module")
def d(tmp_path_factory):
    p = tmp_path_factory.mktemp("hrr")
    rng = np.random.default_rng(31)
    ds.hr_dda(p / "e.mzML", rng, "exploris"); ds.hr_dda(p / "f.mzML", rng, "fusion"); ds.hr_dda(p / "b.mzML", rng, "exploris", broken=True)
    ds.full_scan(p / "q.mzML", 0, np.random.default_rng(1)); ds.mixed_ida(p / "ida.mzML", np.random.default_rng(2))
    return p


def get(app, path, **q):
    code, _, body, _ = api.dispatch(app, "GET", path, {k: str(v) for k, v in q.items()})
    return code, json.loads(body)


@pytest.fixture(scope="module")
def app_hr(d):
    a = App(d / "wd_hr")
    for n in ("e", "f", "b"):
        shutil.copy(d / f"{n}.mzML", d / "wd_hr" / f"{n}.mzML")
    a.open_session({"samples": [{"file": f"{n}.mzML"} for n in ("e", "f", "b")]})
    return a

@pytest.fixture(scope="module")
def app_lr(d):
    a = App(d / "wd_lr")
    for n in ("q", "ida"):
        shutil.copy(d / f"{n}.mzML", d / "wd_lr" / f"{n}.mzML")
    a.open_session({"samples": [{"file": f"{n}.mzML"} for n in ("q", "ida")]})
    return a


def test_model_is_read_through_the_parameter_group(d):
    assert Run(d / "e.mzML").metadata()["instrument"] == "Orbitrap Exploris 120"
    assert Run(d / "f.mzML").metadata()["instrument"] == "Orbitrap Fusion"
    md = Run(d / "f.mzML").metadata()
    assert md["analyzers"] == ["FTMS", "ITMS"] and md["serial"] == "SINTETICO"
    assert Run(d / "q.mzML").metadata()["instrument"] == "3200 QTRAP"          # the lab instrument writes it directly: unchanged


def test_analyzer_per_scan(d):
    e, f = Run(d / "e.mzML"), Run(d / "f.mzML")
    assert {s.an for s in e.scans} == {"FTMS"}
    assert {s.an for s in f.scans if s.level == 1} == {"FTMS"} and {s.an for s in f.scans if s.level == 2} == {"ITMS"}      # MS2 of the Fusion: ion trap (IC2 and filter string)
    assert {s.an for s in Run(d / "q.mzML").scans} <= {"TQMS", "?"}                      # the synthetic QqQ file has no components: unknown; the real one is TQMS
    assert {s.an for s in Run(d / "b.mzML").scans} == {"FTMS"}                                                          # the first token of the odd filter string is still FTMS


def test_parent_isolation_activation(d):
    r = Run(d / "e.mzML")
    for s in r.scans:
        if s.level == 2:
            p = r.scans[s.parent]
            assert p.level == 1 and p.rt <= s.rt and s.rt - p.rt < 0.05
            lo, hi = s.iso
            assert abs((hi - lo) - 1.5) < 1e-9 and lo < s.precursor < hi and s.act == "HCD" and s.res == 15000 and s.pint > 5e4
        else:
            assert s.parent is None and s.iso is None and s.res == 45000
    f = Run(d / "f.mzML")
    s2 = next(s for s in f.scans if s.level == 2)
    assert abs(s2.iso[1] - s2.iso[0] - 3.0) < 1e-9 and s2.act == "CID" and s2.res is None
    assert f.nce is True and Run(d / "q.mzML").nce is False


def test_broken_file_still_gets_a_parent_and_a_window(d):
    r = Run(d / "b.mzML")
    s2 = [s for s in r.scans if s.level == 2]
    assert all(s.parent is not None and r.scans[s.parent].level == 1 for s in s2)       # the last survey scan before it
    assert all(abs(s.iso[1] - s.iso[0] - 1.0) < 1e-9 for s in s2)                        # no window in the file: precursor +-0.5
    assert {s.act for s in s2} == {"HCD"}                                                 # from the activation cvParam (the filter string is odd, still has @hcd)
    assert all(s.res is None for s in r.scans)


def test_precursor_cvparams_do_not_leak_into_the_scan(tmp_path):
    """A 'ms level' or 'mass resolving power' written inside the <precursor> is the parent's, not the scan's."""
    r = Run(tmp_path.parent / "x.mzML") if False else None
    ds.hr_dda(tmp_path / "x.mzML", np.random.default_rng(1), "exploris")
    txt = (tmp_path / "x.mzML").read_text()
    txt = txt.replace('<isolationWindow>', '<isolationWindow><cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="1"/><cvParam cvRef="MS" accession="MS:1000800" name="mass resolving power" value="999"/>', 1)
    (tmp_path / "y.mzML").write_text(txt)
    y = Run(tmp_path / "y.mzML")
    s2 = next(s for s in y.scans if s.level == 2)
    assert s2.level == 2 and s2.res == 15000


def test_old_files_are_unchanged(d):
    q = Run(d / "q.mzML")
    assert all(s.parent is None and s.iso is None and s.act is None and s.res is None and s.pint is None for s in q.scans)
    ida = Run(d / "ida.mzML")                                                              # QTRAP IDA: parent derived (last survey scan), window +-0.5
    s2 = [s for s in ida.scans if s.level == 2]
    assert s2 and all(ida.scans[s.parent].level == 1 for s in s2) and all(abs(s.iso[1] - s.iso[0] - 1.0) < 1e-9 for s in s2)


def test_item_info_hr_block(app_hr, app_lr):
    inf = {i["file"]: i for i in app_hr.session.info()}
    inf.update({i["file"]: i for i in app_lr.session.info()})
    e = inf["e.mzML#MS2"]
    assert e["dda"] and e["nce"] and e["res1"] == 45000 and e["res2"] == 15000 and e["prof2"]["dec"] == 4
    assert not inf["q.mzML"]["dda"] and inf["ida.mzML#MS2"]["dda"]                          # an IDA file of the QTRAP is also DDA
    assert len(e["ms2_events"]) == e["ms2"]                                                  # no cap


def test_api_dda(app_hr):
    k = [i for i, it in enumerate(app_hr.session.items) if it.file == "e.mzML#MS2"][0]
    code, j = get(app_hr, "/api/dda", k=k)
    assert code == 200 and len(j["sid"]) == len(j["rt"]) == len(j["prec"]) == len(j["parent"]) == len(j["lo"]) == len(j["act"]) == 142
    assert j["nce"] and set(j["act"]) == {"HCD"} and all(p is not None for p in j["parent"])
    assert len(j["ms1"]["sid"]) == 650 and j["ms1"]["sid"][0] == 0
    assert all(abs(p - round(p, 5)) < 1e-9 for p in j["prec"]) and max(len(str(x).split(".")[1]) for x in j["prec"]) <= 5      # decimals of the profile + 1
    assert all(m == j["prt"][i] for i, m in enumerate(j["prt"])) and all(j["prt"][i] <= j["rt"][i] for i in range(len(j["rt"])))


def test_api_scan_is_the_scan_as_stored(app_hr, d):
    k = [i for i, it in enumerate(app_hr.session.items) if it.file == "e.mzML#MS2"][0]
    j = get(app_hr, "/api/dda", k=k)[1]
    sid = j["sid"][3]
    code, s = get(app_hr, "/api/scan", k=k, sid=sid)
    r = Run(d / "e.mzML")
    mz, y = r.read(sid)
    assert code == 200 and len(s["mz"]) == len(mz) and np.allclose(s["mz"], mz, atol=1e-5) and s["level"] == 2
    assert s["nce"] and s["res"] == 15000 and s["an"] == "FTMS" and s["parent"] == j["parent"][3] and "hcd30.00" in s["filter"] and s["act"] == "HCD"
    assert get(app_hr, "/api/scan", k=k, sid=999999)[0] == 400


def test_api_scan_keeps_close_centroids_apart(app_hr):
    k = [i for i, it in enumerate(app_hr.session.items) if it.file == "e.mzML#MS1"][0]
    j = get(app_hr, "/api/dda", k=k)[1]
    # the survey scan at RT 16.0 holds 412.1000 and 412.1364 as two peaks (they are 0.0364 Da apart: no merging into bins of 0.1 Da)
    sid = min(j["ms1"]["sid"], key=lambda i: abs(j["ms1"]["rt"][j["ms1"]["sid"].index(i)] - 16.0))
    s = get(app_hr, "/api/scan", k=k, sid=sid)[1]
    mz = np.array(s["mz"])
    assert (abs(mz - 412.1000) < 0.002).any() and (abs(mz - 412.1364) < 0.002).any()


def test_api_scanavg(app_hr):
    k = [i for i, it in enumerate(app_hr.session.items) if it.file == "e.mzML#MS1"][0]
    code, a = get(app_hr, "/api/scanavg", k=k, sids="0,1,2")
    assert code == 200 and a["n"] == 3 and a["level"] == 1 and len(a["mz"]) == len(a["y"]) > 100
    tot = sum(sum(get(app_hr, "/api/scan", k=k, sid=i)[1]["y"]) for i in (0, 1, 2)) / 3
    assert abs(sum(a["y"]) - tot) < 1e-3 * tot + 5                                          # mean per scan
    assert get(app_hr, "/api/scanavg", k=k, sids="")[0] == 400


def test_sid_in_spectrum_and_spectra(app_hr):
    k = [i for i, it in enumerate(app_hr.session.items) if it.file == "e.mzML#MS1"][0]
    j = get(app_hr, "/api/dda", k=k)[1]
    rt = j["ms1"]["rt"][5]
    code, s = get(app_hr, "/api/spectrum", k=k, rt0=rt - 1e-4, rt1=rt + 1e-4, level=1)
    assert code == 200 and s["scans"] == 1 and s["sid"] == j["ms1"]["sid"][5]
    code, many = get(app_hr, "/api/spectra", k=k, i0=2, i1=4, level=1)
    assert [x["sid"] for x in many["scans"]] == j["ms1"]["sid"][2:5]
    code, s = get(app_hr, "/api/spectrum", k=k, rt0=rt - 0.5, rt1=rt + 0.5, level=1)
    assert "sid" not in s


def test_method_has_the_scan_parameters_only_for_high_resolution(app_hr, app_lr):
    ke = [i for i, it in enumerate(app_hr.session.items) if it.file == "e.mzML#MS1"][0]
    kq = [i for i, it in enumerate(app_lr.session.items) if it.file == "q.mzML"][0]
    m = get(app_hr, "/api/method", k=ke)[1]["scan_params"]
    assert m["ms1"]["res"] == 45000 and m["ms1"]["window"] == [50.0, 900.0] and m["ms1"]["an"] == "FTMS" and m["ms1"]["inject"] is None
    assert m["ms2"]["act"] == ["HCD"] and m["ms2"]["nce"] is True and m["ms2"]["ce"] == [30.0] and m["ms2"]["iso"] == [0.75] and m["ms2"]["res"] == 15000
    assert m["instrument"] == "Orbitrap Exploris 120" and 0.1 < m["ms2"]["per_cycle"] < 1
    assert "scan_params" not in get(app_lr, "/api/method", k=kq)[1]


def test_formula_has_five_decimals(app_hr):
    code, j = get(app_hr, "/api/formula", f="C14H13F4N3O2S", adduct="[M+H]+")
    assert code == 200 and j["mz"] == round(j["mz5"], 4) and len(str(j["mz5"]).split(".")[1]) == 5

def test_nearest_scan_gets_the_closest_scan_in_time(app):
    k = [i for i, it in enumerate(app.session.items) if it.file == "e.mzML#MS2"][0]
    # In 'e.mzML', MS2 scans are DDA. Let's find one.
    code, j = get(app, "/api/dda", k=k)
    rts = j["rt"]
    rt0 = rts[0]
    rt1 = rts[1]
    mid = (rt0 + rt1) / 2
    # test closer to rt0
    code, r = get(app, "/api/nearest_scan", k=k, rt=mid - 0.001, level=2)
    print("THIS IS R:", r); assert r["rt"] == rt0
    # test closer to rt1
    code, r = get(app, "/api/nearest_scan", k=k, rt=mid + 0.001, level=2)
    assert r["rt"] == rt1
