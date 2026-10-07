"""B3: high-resolution spectra keep their own centroids (no bins of 0.1 Da); averages group at 3 ppm; low resolution and the 'off' switch are unchanged."""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import dati_sintetici as ds  # noqa: E402
from qqq_lab import api  # noqa: E402
from qqq_lab.app import App  # noqa: E402


def get(app, path, **q):
    code, _, body, _ = api.dispatch(app, "GET", path, {k: str(v) for k, v in q.items()})
    return code, json.loads(body)


@pytest.fixture(scope="module")
def app(tmp_path_factory):
    p = tmp_path_factory.mktemp("hrs")
    rng = np.random.default_rng(31)
    ds.hr_dda(p / "e.mzML", rng, "exploris"); ds.hr_dda(p / "f.mzML", rng, "fusion")
    ds.full_scan(p / "q.mzML", 0, np.random.default_rng(1))
    a = App(p / "wd")
    for n in ("e", "f", "q"):
        shutil.copy(p / f"{n}.mzML", p / "wd" / f"{n}.mzML")
    a.open_session({"samples": [{"file": f"{n}.mzML"} for n in ("e", "f", "q")]})
    return a


def k_of(app, name):
    return [i for i, it in enumerate(app.session.items) if it.file == name][0]


def rt_at(app, k, rt):
    j = get(app, "/api/dda", k=k)[1]["ms1"]
    i = min(range(len(j["rt"])), key=lambda i: abs(j["rt"][i] - rt))
    return j["rt"][i], j["sid"][i]


def test_one_scan_is_its_own_centroids(app):
    k = k_of(app, "e.mzML#MS1")
    rt, sid = rt_at(app, k, 16.0)
    code, s = get(app, "/api/spectrum", k=k, rt0=rt - 1e-4, rt1=rt + 1e-4, level=1)
    assert code == 200 and s["scans"] == 1 and s["sid"] == sid
    raw = get(app, "/api/scan", k=k, sid=sid)[1]
    assert s["mz"] == raw["mz"] and s["y"] == raw["y"]                           # exactly the centroids of the file
    mz = np.array(s["mz"])
    assert (abs(mz - 412.1000) < 0.002).any() and (abs(mz - 412.1364) < 0.002).any()
    near = mz[(mz > 412.0) & (mz < 412.2)]
    assert len(near) >= 2 and np.min(np.diff(near)) < 0.05                       # the two isobars are two peaks, 0.0364 Da apart
    assert max(len(str(v).split(".")[1]) for v in s["mz"]) <= 5                  # decimals of the profile (4) + 1


def test_average_groups_at_3_ppm(app):
    k = k_of(app, "e.mzML#MS1")
    rt, sid = rt_at(app, k, 16.0)
    code, s = get(app, "/api/spectrum", k=k, rt0=rt - 0.045, rt1=rt + 0.045, level=1)
    assert s["scans"] >= 3
    mz = np.array(s["mz"])
    assert (abs(mz - 412.1000) < 0.002).any() and (abs(mz - 412.1364) < 0.002).any()
    # the same ion measured in several scans is ONE peak (m/z noise is 0.8 ppm, cells are 3 ppm)
    close = mz[(abs(mz - 412.1000) < 0.003)]
    assert len(close) <= 2


def test_switch_off_is_todays_behaviour(app):
    k = k_of(app, "e.mzML#MS1")
    rt, sid = rt_at(app, k, 16.0)
    s = get(app, "/api/spectrum", k=k, rt0=rt - 1e-4, rt1=rt + 1e-4, level=1, hr=0)[1]
    mz = np.array(s["mz"])
    hrs = get(app, "/api/spectrum", k=k, rt0=rt - 1e-4, rt1=rt + 1e-4, level=1)[1]
    assert len(s["mz"]) < len(hrs["mz"])                                                         # the high-resolution scan has more peaks than bins
    assert max(len(str(v).split(".")[1]) for v in s["mz"]) <= 3
    # and with the merge of the nominal mass (the gear option) nothing is merged in high resolution
    a = get(app, "/api/spectrum", k=k, rt0=rt - 1e-4, rt1=rt + 1e-4, level=1, merge=1)[1]
    b = get(app, "/api/spectrum", k=k, rt0=rt - 1e-4, rt1=rt + 1e-4, level=1)[1]
    assert a["mz"] == b["mz"]


def test_spectra_blocks_match_single_windows(app):
    k = k_of(app, "e.mzML#MS1")
    blk = get(app, "/api/spectra", k=k, i0=100, i1=102, level=1)[1]["scans"]
    for sc in blk:
        one = get(app, "/api/spectrum", k=k, rt0=sc["rt"] - 1e-4, rt1=sc["rt"] + 1e-4, level=1)[1]
        assert one["mz"] == sc["mz"] and one["y"] == sc["y"] and one["sid"] == sc["sid"]


def test_ion_trap_ms2_is_low_resolution_with_two_decimals(app):
    k = k_of(app, "f.mzML#MS2")
    j = get(app, "/api/dda", k=k)[1]
    sid = j["sid"][3]
    s = get(app, "/api/scan", k=k, sid=sid)[1]
    assert s["an"] == "ITMS" and max(len(str(v).split(".")[1]) for v in s["mz"]) <= 3        # 2 decimals + 1
    blk = get(app, "/api/spectra", k=k, i0=3, i1=3, level=2)[1]["scans"][0]
    assert blk["sid"] == sid and max(len(str(v).split(".")[1]) for v in blk["mz"]) <= 3


def test_qqq_file_does_not_change_with_the_switch(app):
    k = k_of(app, "q.mzML")
    for rt0, rt1 in ((5.0, 5.05), (14.2, 14.4), (14.3, 14.3001)):
        a = get(app, "/api/spectrum", k=k, rt0=rt0, rt1=rt1, level=1)[1]
        b = get(app, "/api/spectrum", k=k, rt0=rt0, rt1=rt1, level=1, hr=0)[1]
        assert a == b
    a = get(app, "/api/spectra", k=k, i0=10, i1=15, level=1)[1]
    b = get(app, "/api/spectra", k=k, i0=10, i1=15, level=1, hr=0)[1]
    assert a == b
