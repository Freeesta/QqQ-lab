"""B0: the synthetic high-resolution DDA files (tools/dati_sintetici.hr_dda) are well formed and have what the HR tests expect."""
import re
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import dati_sintetici as ds  # noqa: E402
from mzlab.reader.mzml import Run  # noqa: E402


@pytest.fixture(scope="module")
def d(tmp_path_factory):
    p = tmp_path_factory.mktemp("hr")
    rng = np.random.default_rng(31)
    ds.hr_dda(p / "e.mzML", rng, "exploris"); ds.hr_dda(p / "f.mzML", rng, "fusion"); ds.hr_dda(p / "b.mzML", rng, "exploris", broken=True)
    return p


def test_files_open_and_are_small(d):
    for n in "efb":
        f = d / f"{n}.mzML"
        assert f.stat().st_size < 15e6
        r = Run(f)
        lv = [s.level for s in r.scans]
        assert lv.count(1) > 300 and lv.count(2) > 50
        assert r.scans[0].native == "controllerType=0 controllerNumber=1 scan=1"


def test_exploris_structure(d):
    r = Run(d / "e.mzML")
    s2 = next(s for s in r.scans if s.level == 2)
    h = r._mm[s2.start:s2.end].decode()
    assert "hcd30.00" in s2.filter and 'accession="MS:1000422"' in h and 'value="0.75"' in h and "spectrumRef=" in h
    assert 'name="mass resolving power" value="15000"' in h
    m1 = r._mm[r.scans[0].start:r.scans[0].end].decode()
    assert 'name="mass resolving power" value="45000"' in m1 and "FTMS + p ESI Full ms" in m1
    assert "Orbitrap Exploris 120" in r._mm[:6000].decode()


def test_fusion_structure(d):
    r = Run(d / "f.mzML")
    s2 = next(s for s in r.scans if s.level == 2)
    h = r._mm[s2.start:s2.end].decode()
    assert s2.filter.startswith("ITMS + c ESI d Full ms2") and "cid35.00" in s2.filter
    assert 'instrumentConfigurationRef="IC2"' in h and "MS:1000800" not in h and 'value="1.5"' in h and 'accession="MS:1000133"' in h
    assert "Orbitrap Fusion" in r._mm[:6000].decode() and 'id="IC2"' in r._mm[:12000].decode()


def test_parent_links_point_to_a_full_scan(d):
    r = Run(d / "e.mzML")
    by = {s.native: s for s in r.scans}
    for s in r.scans:
        if s.level == 2:
            ref = re.search(r'spectrumRef="([^"]*)"', r._mm[s.start:s.end].decode()).group(1)
            assert by[ref].level == 1 and by[ref].rt <= s.rt


def test_ground_truth_ions_in_the_ms1(d):
    r = Run(d / "e.mzML")
    t = r.table(1)
    def at(mz, rt):
        i = int(np.argmin(abs(t.rt - rt)))
        a, b = np.searchsorted(t.mz, mz * (1 - 3e-6)), np.searchsorted(t.mz, mz * (1 + 3e-6))
        sel = (t.pos[a:b] == i)
        return float(t.inten[a:b][sel].sum())
    assert at(305.0702, 9.0) > 1e6 and at(305.0702, 12.0) < 1e4          # isobars at different RT
    assert at(305.1066, 12.0) > 1e6 and at(305.1066, 9.0) < 1e4
    assert at(412.1000, 16.0) > 1e5 and at(412.1364, 16.0) > 1e5          # isobars at the same RT
    assert at(229.05, 7.07) > 1e4 and at(229.60, 7.07) > 5 * at(229.05, 7.07) * 0.8       # co-isolation: weak beside strong (5x)
    assert 1e4 < at(250.1234, 11.0) < 5e4                                  # never fragmented
    ms2prec = [s.precursor for s in r.scans if s.level == 2]
    assert not any(abs(p - 250.1234) < 0.01 for p in ms2prec) and not any(abs(p - 229.05) < 0.01 for p in ms2prec)
    assert any(abs(p - 229.60) < 0.01 for p in ms2prec)


def test_broken_file_has_nothing_to_rely_on(d):
    r = Run(d / "b.mzML")
    s2 = next(s for s in r.scans if s.level == 2)
    h = r._mm[s2.start:s2.end].decode()
    assert "spectrumRef" not in h and "isolationWindow" not in h and "MS:1000800" not in h
    assert "{1,2}" in s2.filter and "Modello sconosciuto" in r._mm[:6000].decode()
