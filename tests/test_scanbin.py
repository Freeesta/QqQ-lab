"""/api/scanbin: the same scans as /api/spectra, as a binary block (header length + JSON header + float64 m/z and float32 intensities)."""
import json, shutil, struct, sys
from pathlib import Path
import numpy as np
import pytest
from mzlab.app import App
from mzlab.api import dispatch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import dati_sintetici as ds  # noqa: E402


def decode(blob: bytes):
    hl = struct.unpack_from("<I", blob, 0)[0]
    head = json.loads(blob[4:4 + hl]); off = 4 + hl; out = []
    for s in head["scans"]:
        n, npf = s["n"], s["np"]
        mz = np.frombuffer(blob, "<f8", n, off); off += 8 * n
        y = np.frombuffer(blob, "<f4", n, off); off += 4 * n
        pmz = py = None
        if npf:
            pmz = np.frombuffer(blob, "<f8", npf, off); off += 8 * npf
            py = np.frombuffer(blob, "<f4", npf, off); off += 4 * npf
        out.append({**s, "mz_a": mz, "y_a": y, "pmz_a": pmz, "py_a": py})
    assert off == len(blob), "the block has no trailing bytes"
    return head, out


@pytest.fixture(scope="module")
def apps(tmp_path_factory):
    d = tmp_path_factory.mktemp("sb")
    for w in ("hr", "lr"):
        (d / w).mkdir()
    ds.hr_dda(d / "hr" / "e.mzML", np.random.default_rng(5), "exploris")
    ds.full_scan(d / "lr" / "q.mzML", 0, np.random.default_rng(6))
    a = App(d / "hr"); a.open_session({"samples": [{"file": "e.mzML"}]})
    b = App(d / "lr"); b.open_session({"samples": [{"file": "q.mzML"}]})
    return a, b


def get(app, **q):
    return dispatch(app, "GET", "/api/scanbin", {k: str(v) for k, v in q.items()})


@pytest.mark.parametrize("which,level", [(0, 1), (0, 2), (1, 1)])
def test_scanbin_equals_spectra(apps, which, level):
    app = apps[which]
    k = [i for i, it in enumerate(app.session.items) if it.kind() == ("ms2" if level == 2 else "full") or which == 1][0]
    code, ct, blob, _ = get(app, k=k, i0=0, i1=4, level=level)
    assert code == 200 and ct == "application/octet-stream"
    head, scans = decode(blob)
    ref = app.spectra(k, 0, 4, level, None, 0.1)
    assert head["n"] == ref["n"] and len(scans) == len(ref["scans"])
    for s, r in zip(scans, ref["scans"]):
        assert s["i"] == r["i"] and s["sid"] == r["sid"] and abs(s["rt"] - r["rt"]) < 1e-9 and s["mode"] == r["mode"]
        assert np.allclose(s["mz_a"], r["mz"], atol=2e-3) and np.allclose(s["y_a"], r["y"], rtol=1e-4, atol=0.2)
        if r["mode"] == "profile":
            assert np.allclose(s["pmz_a"], r["pmz"], atol=2e-3)


def test_scanbin_is_smaller_than_json(apps):
    app = apps[0]
    k = [i for i, it in enumerate(app.session.items) if it.kind() == "full"][0]
    blob = get(app, k=k, i0=0, i1=19, level=1)[2]
    js = json.dumps(app.spectra(k, 0, 19, 1, None, 0.1)).encode()
    assert len(blob) < len(js) * 0.75, (len(blob), len(js))        # the synthetic scans are tiny (the header weighs): real HR scans have tens of thousands of points


def test_scanbin_filter_and_limits(apps):
    app = apps[0]
    k = [i for i, it in enumerate(app.session.items) if it.kind() == "ms2"][0]
    fl = app.session.items[k].run.scans[int(app.session.items[k]._scan_ids(2, None, 0.6)[0][0])].filter
    head, scans = decode(get(app, k=k, i0=0, i1=2, level=2, filter=fl)[2])
    assert all(s["filter"] == fl for s in scans)
    assert get(app, k=k, i0=0, i1=99, level=2)[0] == 400                       # at most 60 scans per request
    assert get(app, k=k, i0=10 ** 6, i1=10 ** 6 + 1, level=2)[0] == 400
