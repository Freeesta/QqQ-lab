# TPMINE-PRIVATE
"""WP7 (public, synthetic): MS2 of a feature, consensus spectrum and separation of co-eluting isomers."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "tools"))
import dati_sintetici as ds  # noqa: E402
from mzlab.reader.mzml import Run  # noqa: E402
from tpmine.hr import spectra as SP  # noqa: E402


def spec(peaks, rng, noise=3):
    """peaks: {mz: relative intensity}; adds a little jitter and a few random peaks."""
    mz = [m * (1 + rng.normal(0, 0.5e-6)) for m in peaks]
    it = [v * rng.uniform(0.9, 1.1) for v in peaks.values()]
    for _ in range(noise):
        mz.append(float(rng.uniform(50, 300))); it.append(float(rng.uniform(0.2, 1.5)))
    o = np.argsort(mz)
    return np.array(mz)[o], np.array(it)[o]


def test_consensus_keeps_the_peaks_found_in_enough_scans():
    rng = np.random.default_rng(1)
    sp = [spec({100.0500: 100, 150.0800: 40, 200.1000: 3.0, 220.0: 80 if i < 2 else 0}, rng) for i in range(10)]
    c = SP.ms2_consensus([a for a, _ in sp], [b for _, b in sp])
    mz = c["mz"]
    assert any(abs(mz - 100.05) < 0.001) and any(abs(mz - 150.08) < 0.001) and any(abs(mz - 200.1) < 0.001)
    assert not any(abs(mz - 220.0) < 0.001)                       # only 2 of 10 scans
    assert c["rel"].max() == pytest.approx(100.0) and c["n_scans"] == 10 and c["n_found"].max() == 10
    weak = SP.ms2_consensus([a for a, _ in sp], [b for _, b in sp], min_rel=0.5)
    assert len(weak["mz"]) < len(c["mz"])                          # the random single peaks are gone at 0.5 %


def test_consensus_arrays_equals_the_msn_consensus(tmp_path):
    import msn_synth as S
    from tpmine.hr import msn
    r = Run(S.write_msn(tmp_path / "m.mzML", S.caffeine_nodes()))
    idx = [s.index for s in r.scans if s.level == 2][:6]
    a = msn.consensus(r, idx)
    reads = [r.read(i) for i in idx]
    b = SP.consensus_arrays([x[0] for x in reads], [x[1] for x in reads], 5.0, 0.5, 0.0, n_total=len(idx))
    assert all(np.array_equal(x, y) for x, y in zip(a, b))


def test_index_and_select_ms2(tmp_path):
    rng = np.random.default_rng(31)
    ds.hr_dda(tmp_path / "e.mzML", rng, "exploris")
    r = Run(tmp_path / "e.mzML")
    ix = SP.index_ms2(r)
    assert len(ix) == sum(1 for s in r.scans if s.level == 2) > 10 and np.all(np.diff(ix.rt) >= 0)
    assert np.allclose(ix.center, [(s.iso[0] + s.iso[1]) / 2 for s in r.scans if s.level == 2 and s.iso])
    mz0 = float(ix.center[len(ix) // 2])
    rt0 = float(ix.rt[len(ix) // 2])
    sel = SP.select_ms2([ix, ix], mz0, [(rt0 - 0.05, rt0 + 0.05), (np.nan, np.nan)])
    assert sel and all(k == 0 and abs(rt - rt0) <= 0.05 for k, _, rt in sel)                  # the second file has no peak: nothing from it
    assert SP.select_ms2([ix], mz0 + 1.0, [(0, 100)]) == []
    assert SP.select_ms2([ix], mz0, [(0, 100)], act="ETD") == []
    both = SP.select_ms2([ix], mz0, [(0, 100)], ppm=10)
    assert len(both) >= 1
    mzs, ints, rts = SP.read_spectra([r], both)
    assert len(mzs) == len(both) and all(len(a) for a in mzs) and list(rts) == [x[2] for x in both]


def three_isomers(rng):
    """MS2 scans across 5.0-5.6 min of m/z 333: A (no 144) at 5.1, B (144 only) at 5.28, C (144 + 261 + 146) at 5.45; a contaminant in one scan."""
    base = {186.03: 100, 259.08: 70, 74.06: 40}
    sets = {"A": dict(base), "B": {**base, 144.02: 20}, "C": {**base, 144.02: 25, 261.10: 90, 146.12: 40, 186.03: 30, 259.08: 20}}
    mzs, ints, rts, lab = [], [], [], []
    for rt0, key in ((5.1, "A"), (5.28, "B"), (5.45, "C")):
        for dt in (-0.03, 0.0, 0.03, 0.05):
            m, i = spec(sets[key], rng)
            # the neighbours share a little of each other (partial co-elution)
            mzs.append(m); ints.append(i); rts.append(rt0 + dt + rng.normal(0, 0.003)); lab.append(key)
    return mzs, ints, np.array(rts), lab, sets


def xic():
    rt = np.arange(4.9, 5.7, 0.004)
    y = sum(h * np.exp(-0.5 * ((rt - r0) / 0.035) ** 2) for r0, h in ((5.1, 5e6), (5.28, 6e6), (5.45, 4e6)))
    return rt, y


def test_subpeaks_of_the_trace():
    rt, y = xic()
    assert np.allclose(SP.subpeaks(rt, y), [5.1, 5.28, 5.45], atol=0.02)
    assert len(SP.subpeaks(rt, y * np.random.default_rng(0).uniform(0.9, 1.1, len(y)))) == 3
    assert SP.subpeaks(rt[:3], y[:3]) == [pytest.approx(rt[int(np.argmax(y[:3]))])]
    assert SP.subpeaks(rt, y, min_sep=0.4) != SP.subpeaks(rt, y)


def test_three_coeluting_isomers_are_separated_with_the_trace():
    rng = np.random.default_rng(5)
    mzs, ints, rts, lab, sets = three_isomers(rng)
    d = SP.deconvolve_isomers(mzs, ints, rts, xic=xic())
    assert d["k"] == 3 and len(d["components"]) == 3
    apexes = [c["rt_apex"] for c in d["components"]]
    assert apexes == sorted(apexes) and np.allclose(apexes, [5.1, 5.28, 5.45], atol=0.08)

    def g(c, mz):
        m, rel = c["spectrum"]
        j = np.flatnonzero(np.abs(m - mz) <= mz * 8e-6)
        return float(rel[j].max()) if len(j) else 0.0
    a, b, c = d["components"]
    assert g(a, 144.02) < 5 and g(a, 261.10) < 5
    assert g(b, 144.02) > 8 and g(b, 261.10) < 5
    assert g(c, 261.10) > 40 and g(c, 146.12) > 15
    only = SP.match_peaks(c["spectrum"], a["spectrum"])
    assert any(abs(m - 261.10) < 0.01 for m in only["only_a"]) and any(abs(m - 186.03) < 0.01 for m in only["both"])


def test_without_a_trace_the_number_of_components_comes_from_the_matrix():
    rng = np.random.default_rng(6)
    mzs, ints, rts, _, _ = three_isomers(rng)
    d = SP.deconvolve_isomers(mzs, ints, rts)
    assert d["k"] >= 2 and d["components"]
    one = [spec({186.03: 100, 259.08: 70, 74.06: 40}, rng) for _ in range(8)]
    d1 = SP.deconvolve_isomers([a for a, _ in one], [b for _, b in one], np.linspace(5.0, 5.2, 8))
    assert d1["k"] == 1 and len(d1["components"]) == 1 and d1["components"][0]["spectrum"][0].size >= 3


def test_few_scans_give_the_consensus_and_a_contaminant_is_kept_out_by_the_filter():
    rng = np.random.default_rng(7)
    sp = [spec({186.03: 100, 259.08: 70, 74.06: 40}, rng) for _ in range(3)]
    d = SP.deconvolve_isomers([a for a, _ in sp], [b for _, b in sp], [5.1, 5.2, 5.3])
    assert d["k"] == 1 and len(d["components"]) == 1
    mzs, ints, rts, _, _ = three_isomers(rng)
    mzs[5], ints[5] = np.append(mzs[5], [292.93, 322.93, 336.92]), np.append(ints[5], [100, 90, 80])                  # one scan with a co-isolated contaminant
    ok = lambda m: np.abs(m - 292.93) > 0.02
    d2 = SP.deconvolve_isomers(mzs, ints, rts, xic=xic(), allowed=lambda m: (np.abs(m - 292.93) > 0.02) & (np.abs(m - 322.93) > 0.02) & (np.abs(m - 336.92) > 0.02))
    assert d2["k"] == 3 and all(not np.any(np.abs(c["spectrum"][0] - 292.93) < 0.02) for c in d2["components"])
    del ok
