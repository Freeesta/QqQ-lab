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
