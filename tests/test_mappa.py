"""RT x m/z map: the true zoom (a region on new bins) and, in mappa_calc, the comparison of two maps and the marked points (mzlab/explore.py)."""
import pytest

from test_pipeline import _mzml, _scan_xml


def _session(tmp_path, scans, name="full.mzML"):
    from mzlab.explore import Session
    f = tmp_path / name
    f.write_text(_mzml(f'<spectrumList count="{len(scans)}">{"".join(scans)}</spectrumList>'), encoding="utf-8")
    return Session([{"file": name}], tmp_path)


def test_region_is_mean_per_scan_on_its_own_bins(tmp_path):
    """The zoomed region has its own finer bins; values stay the mean per scan, peaks outside the region are left out."""
    scans = [_scan_xml(0, 1.00, [150.2, 150.7, 400.0], [100.0, 40.0, 9.0]), _scan_xml(1, 1.01, [150.4], [300.0]), _scan_xml(2, 3.00, [250.7], [50.0])]
    it = _session(tmp_path, scans).items[0]
    m = it.ionmap_region(1, 0.95, 1.15, 2, 150.0, 151.0, 4)             # RT bins of 0.1 min, m/z bins of 0.25
    assert m.shape == (2, 4)
    assert m[0, 0] == pytest.approx(50.0) and m[0, 1] == pytest.approx(150.0) and m[0, 2] == pytest.approx(20.0)   # two scans in the bin: means
    assert m.sum() == pytest.approx(220.0)                                  # 400.0 and the scan at 3.00 min are outside
    assert it.ionmap_region(1, 2.0, 1.0, 5, 150, 151, 5).sum() == 0          # empty or reversed region: zeros, no error


def test_region_endpoint(tmp_path):
    from mzlab.api import dispatch
    from mzlab.app import App
    import base64
    import numpy as np
    app = App(tmp_path)
    app.session = _session(tmp_path, [_scan_xml(0, 1.00, [150.2], [100.0]), _scan_xml(1, 2.00, [150.6], [60.0])])
    code, _, body = dispatch(app, "GET", "/api/map", {"k": "0", "rt0": "0.5", "rt1": "2.5", "mz0": "150", "mz1": "151", "nrt": "4", "nmz": "2000"})[:3]
    assert code == 200
    import json
    j = json.loads(body)
    assert j["region"] and j["nmz"] == 1000 and j["nrt"] == 4                # at most 1000 bins per axis
    m = np.frombuffer(base64.b64decode(j["data"]), "<f4").reshape(4, 1000)
    assert m.sum() == pytest.approx(160.0)


def test_difference_with_itself_is_zero_and_tolerates_drift():
    """A - A = 0; a peak that moved by one RT bin in the reference cancels with the tolerance (local maximum of B) and not without it."""
    import numpy as np
    from mzlab.explore import diff_tolerant
    rng = np.random.default_rng(0)
    a = rng.random((40, 30)).astype(np.float32)
    assert not diff_tolerant(a, a, 0).any() and (diff_tolerant(a, a, 3) <= 0).all()      # with the tolerance B only grows: A - B <= 0
    a, b = np.zeros((20, 5), np.float32), np.zeros((20, 5), np.float32)
    a[10, 2], b[11, 2] = 100.0, 100.0                                                     # same peak, one bin later in the reference
    assert diff_tolerant(a, b, 0)[10, 2] == 100.0 and diff_tolerant(a, b, 2)[10, 2] == 0.0
    a[5, 1] = 50.0                                                                        # a real increase stays
    assert diff_tolerant(a, b, 2)[5, 1] == 50.0


def test_snap_to_the_local_maximum(tmp_path):
    """A click near a peak goes to its apex (scan with the highest intensity within +-0.2 min and +-1 bin), with the m/z of the file."""
    scans = [_scan_xml(i, 1.0 + 0.05 * i, [150.25, 160.4], [h, 10.0]) for i, h in enumerate([10.0, 40.0, 90.0, 60.0, 20.0])]
    it = _session(tmp_path, scans).items[0]
    s = it.map_snap(1, 1.02, 151.1)                                                       # one bin above, before the apex
    assert s["rt"] == pytest.approx(1.10) and s["mz"] == pytest.approx(150.25)
    assert it.map_snap(1, 3.0, 150.2) is None                                             # nothing within 0.2 min


def test_rt_groups_and_delta_m():
    """Two points at the same RT form one group, an isolated one its own; delta m is from the most intense point of the group."""
    from mzlab.explore import rt_groups
    rows = rt_groups([{"rt": 5.00, "mz": 300.2, "ia": 1000}, {"rt": 5.03, "mz": 282.2, "ia": 300}, {"rt": 8.0, "mz": 250.1, "ia": 50}], 0.05)
    assert [r["g"] for r in rows] == [1, 1, 2]
    assert rows[0]["dm"] == 0 and rows[1]["dm"] == pytest.approx(-18.0) and rows[2]["dm"] == 0
    assert [r["g"] for r in rt_groups([{"rt": 5.0, "mz": 1, "ia": 1}, {"rt": 5.04, "mz": 2, "ia": 1}, {"rt": 5.08, "mz": 3, "ia": 1}], 0.05)] == [1, 1, 1]   # chained


def test_points_endpoint(tmp_path):
    """/api/mappunti: intensity in A at the apex, local maximum in B within 0.1 min, A - B, A/B and the groups."""
    import json
    from mzlab.api import dispatch
    from mzlab.app import App
    from mzlab.explore import Session
    def write(name, scans):
        (tmp_path / name).write_text(_mzml(f'<spectrumList count="{len(scans)}">{"".join(scans)}</spectrumList>'), encoding="utf-8")
    write("a.mzML", [_scan_xml(i, 1.0 + 0.05 * i, [150.25, 132.3], [h, h / 2]) for i, h in enumerate([0.0, 40.0, 90.0, 60.0, 0.0])])
    write("b.mzML", [_scan_xml(i, 1.0 + 0.05 * i, [150.25], [h]) for i, h in enumerate([0.0, 0.0, 10.0, 30.0, 0.0])])
    app = App(tmp_path)
    app.session = Session([{"file": "a.mzML"}, {"file": "b.mzML"}], tmp_path)
    code, _, body = dispatch(app, "GET", "/api/mappunti", {"k": "0", "ref": "1", "pts": "1.10,150.25;1.10,132.3"})[:3]
    assert code == 200
    rows = json.loads(body)["rows"]
    assert rows[0]["ia"] == pytest.approx(90.0) and rows[0]["ib"] == pytest.approx(30.0) and rows[0]["d"] == pytest.approx(60.0) and rows[0]["ratio"] == pytest.approx(3.0)
    assert rows[0]["g"] == rows[1]["g"] == 1 and rows[1]["dm"] == pytest.approx(132.3 - 150.25)
