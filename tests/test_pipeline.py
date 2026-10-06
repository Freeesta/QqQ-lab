import numpy as np
import pytest

from tpfinder.chem import elements as E
from tpfinder.chem.transformations import generate
from tpfinder.core.analysis import Analysis
from tpfinder.core.peaks import find_peak
from tpfinder.demo import make_demo
from tpfinder.project import guess_sample, load_project


def test_formula_and_mass():
    f = E.parse_formula("C15H12N2O")
    assert f == {"C": 15, "H": 12, "N": 2, "O": 1}
    assert E.ion_mz(E.mass(f), "[M+H]+") == pytest.approx(237.1022, abs=2e-4)
    assert E.parse_delta("-Cl+H") == {"Cl": -1, "H": 1}
    assert E.fmt(E.add(f, E.parse_delta("+O"))) == "C15H12N2O2"


def test_guess_sample():
    assert guess_sample("run_blank_01.mzML")[2] == "blank"
    assert guess_sample("CBZ_t30.mzML")[1] == 30
    assert guess_sample("CBZ_2h.mzML")[1] == 120
    assert guess_sample("CBZ_dark.mzML")[2] == "control"


def test_generate_dedupes_and_flags():
    from tpfinder.project import _packaged
    from tpfinder.chem.transformations import load_transformations
    tr = load_transformations(_packaged("trasformazioni.csv"))
    c = generate({"formula": "C15H12N2O", "polarity": "positive"}, tr, 2, 0.35)
    assert c[0]["name"] == "parent" and c[0]["mz"] == pytest.approx(237.1022, abs=2e-4)
    masses = [round(r["neutral_mass"], 4) for r in c]
    assert len(masses) == len(set(masses))                       # one row per distinct mass
    oh = next(r for r in c if r["delta"] == "+O")
    assert oh["mz"] == pytest.approx(253.0972, abs=2e-4)


def test_find_peak_on_synthetic():
    rt = np.arange(0, 10, 0.05)
    y = 1e5 * np.exp(-0.5 * ((rt - 5) / 0.07) ** 2) + np.random.default_rng(1).normal(0, 300, len(rt)).clip(0)
    pk = find_peak(rt, y, rt_center=5.0)
    assert pk["apex_rt"] == pytest.approx(5.0, abs=0.06)
    assert pk["snr"] > 20 and pk["ok"]
    assert pk["area"] == pytest.approx(1e5 * 0.07 * np.sqrt(2 * np.pi) * 60, rel=0.15)


@pytest.fixture(scope="module")
def analysis(tmp_path_factory):
    cfg = make_demo(tmp_path_factory.mktemp("demo"))
    return Analysis(load_project(cfg))


def test_demo_ranking(analysis):
    by_mz = {round(r["mz"], 1): r for r in analysis.summary()}
    oh = by_mz[253.1]
    assert oh["score"] >= 75 and oh["label"] == "strong candidate"
    oh2 = by_mz[269.1]
    assert oh2["score"] >= 75
    contaminant = by_mz[223.1]                                   # -CH2: present in the blank and at t0
    assert contaminant["score"] < 50


def test_parent_decays_and_candidate_rises(analysis):
    s = {round(r["mz"], 1): r for r in analysis.summary()}
    parent = [k["area"] for k in s[237.1]["kinetics"]]
    assert parent[0] > parent[-1] * 5
    oh = [k["area"] for k in s[253.1]["kinetics"]]
    assert oh[0] == 0 and max(oh) > 0


def test_ms2_and_transitions(analysis):
    oh = next(r for r in analysis.summary() if round(r["mz"], 1) == 253.1)
    m = analysis.ms2(oh["id"])
    assert m["scans"] > 0 and m["collision_energy"] == 30.0
    assert 235.1 in [round(f["mz"], 1) for f in m["fragments"]]
    t = analysis.transitions([oh["id"]])
    assert t and t[0]["Q1"] == 253.1


def test_provenance(analysis):
    p = analysis.provenance()
    assert p["tpfinder"] and all(len(s["sha256_16"]) == 16 for s in p["samples"])


def test_server_exports(analysis):
    from tpfinder.server import App
    app = App(analysis.p.config_files["project"])
    assert app.error is None
    text = app.candidates_csv()
    assert text.startswith("sep=;\n") and "hydroxylation" in text
    oh = next(r for r in app.summary if round(r["mz"], 1) == 253.1)
    t = app.transitions_csv([oh["id"]])
    assert "253.1" in t and "relative_intensity_pct" in t
    d = app.candidate(oh["id"])
    assert len(d["traces"]) == len(app.analysis.p.samples) and d["ms2"]["scans"] > 0


def test_project_errors(tmp_path):
    from tpfinder.project import load_project
    (tmp_path / "esperimento.toml").write_text('[parent]\nname = "x"\n[[samples]]\nfile = "a.mzML"\n')
    with pytest.raises(ValueError, match="formula or an mz"):
        load_project(tmp_path)


def test_peak_with_one_scan_dip_keeps_its_area():
    """A one-scan dip in the upper half of a peak (spray instability) must not cut the integration."""
    import numpy as np
    from tpfinder.core.peaks import find_peak
    rt = np.arange(0, 20, 0.0176)
    y = 6e7 * np.exp(-0.5 * ((rt - 14.35) / 0.08) ** 2)
    clean = find_peak(rt, y)["area"]
    k = int(np.argmin(np.abs(rt - 14.33)))
    y2 = y.copy()
    y2[k] *= 0.5
    dipped = find_peak(rt, y2)["area"]
    assert abs(dipped - clean) / clean < 0.08


def test_explore_session(analysis):
    """Chromatograms, spectra and ion chromatograms on demand, with no compound given."""
    import numpy as np
    from tpfinder.explore import Session
    p = analysis.p
    s = Session([{"file": str(x.path), "time": x.time, "type": x.type} for x in p.samples], p.root)
    it = s.items[0]
    rt, tic = it.total("tic")
    _, bpc = it.total("bpc")
    assert len(rt) == len(tic) == len(bpc) and np.all(bpc <= tic + 1e-6)
    parent_mz = analysis.candidates[0]["mz"]
    _, y = it.xic(parent_mz, 0.35)
    k = int(np.argmax(y))
    mz, sy, n = it.spectrum(rt[k] - 0.02, rt[k] + 0.02)
    assert n >= 1 and abs(mz[np.argmax(sy)] - parent_mz) < 0.5
    assert it.info()["polarity"] == "positive"


def test_app_mode_upload_and_open(tmp_path, analysis):
    import io
    import shutil

    from tpfinder.server import App
    app = App(None, tmp_path / "w")
    src = analysis.p.samples[0].path
    app.save_upload("../evil/" + src.name, io.BytesIO(src.read_bytes()), src.stat().st_size)   # path parts are dropped
    assert [f["name"] for f in app.files()] == [src.name]
    try:
        app.save_upload("x.exe", io.BytesIO(b"x"), 1)
        raise AssertionError("must refuse")
    except ValueError:
        pass
    app.open_session({"samples": [{"file": src.name}]})
    st = app.session_state()
    assert st["session"][0]["ms1"] > 0
    assert len(app.chrom(0, "tic", 1)["rt"]) == st["session"][0]["ms1"]
    app.remove_file(src.name)
    assert app.files() == [] and (tmp_path / "w" / "_cestino" / src.name).exists()


# ---------------------------------------------------------------- synthetic mzML (reader regressions)
import base64
import struct


def _b64(values) -> str:
    return base64.b64encode(struct.pack(f"<{len(values)}d", *values)).decode()


def _array(acc: str, name: str, values, zlib_flag: bool = False) -> str:
    comp = ('<cvParam cvRef="MS" accession="MS:1000574" name="zlib compression" value=""/>' if zlib_flag
            else '<cvParam cvRef="MS" accession="MS:1000576" name="no compression" value=""/>')
    data = "" if not len(values) else _b64(values)
    return (f'<binaryDataArray encodedLength="{len(data)}"><cvParam cvRef="MS" accession="MS:1000523" name="64-bit float" value=""/>'
            f'{comp}<cvParam cvRef="MS" accession="{acc}" name="{name}" value=""/><binary>{data}</binary></binaryDataArray>')


def _mzml(body: str) -> str:
    return f'<?xml version="1.0"?><mzML><run id="r">{body}</run></mzML>'


def test_empty_zlib_array_does_not_crash(tmp_path):
    """MS2 scans without peaks carry zlib-flagged but empty arrays: reading them must give empty arrays, not an error."""
    from tpfinder.reader.mzml import Run
    spec = ('<spectrum index="0" id="scan=1" defaultArrayLength="0"><cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="2"/>'
            '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
            '<cvParam cvRef="MS" accession="MS:1000016" name="scan start time" value="0.5" unitName="minute"/>'
            f'<binaryDataArrayList count="2">{_array("MS:1000514", "m/z array", [], True)}{_array("MS:1000515", "intensity array", [], True)}</binaryDataArrayList></spectrum>')
    f = tmp_path / "empty.mzML"
    f.write_text(_mzml(f'<spectrumList count="1">{spec}</spectrumList>'), encoding="utf-8")
    mz, it = Run(f).read(0)
    assert len(mz) == 0 and len(it) == 0


def test_mrm_file_gets_rt_range_and_polarity(tmp_path):
    """An MRM-only file has no scans: RT range and polarity must come from the SRM chromatograms."""
    from tpfinder.explore import Item
    chrom = ('<chromatogram index="0" id="SRM SIC Q1=364.1 Q3=194.1 sample=1 period=1 experiment=1 transition=0 ce=20 name=Quant" defaultArrayLength="3">'
             '<cvParam cvRef="MS" accession="MS:1001473" name="selected reaction monitoring chromatogram" value=""/>'
             '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
             f'<binaryDataArrayList count="2">{_array("MS:1000595", "time array", [1.0, 2.0, 3.5])}{_array("MS:1000515", "intensity array", [10.0, 50.0, 20.0])}</binaryDataArrayList></chromatogram>')
    f = tmp_path / "mrm.mzML"
    f.write_text(_mzml(f'<chromatogramList count="1">{chrom}</chromatogramList>'), encoding="utf-8")
    info = Item("mrm.mzML", None, 0, "sample", f).info()
    assert info["kind"] == "mrm"
    assert info["polarity"] == "positive"
    assert info["rt_min"] == pytest.approx(1.0) and info["rt_max"] == pytest.approx(3.5)


def _scan_xml(i: int, rt: float, mz, inten, level: int = 1) -> str:
    return (f'<spectrum index="{i}" id="scan={i + 1}" defaultArrayLength="{len(mz)}">'
            f'<cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="{level}"/>'
            '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000016" name="scan start time" value="{rt}" unitName="minute"/>'
            f'<binaryDataArrayList count="2">{_array("MS:1000514", "m/z array", mz)}{_array("MS:1000515", "intensity array", inten)}</binaryDataArrayList></spectrum>')


def test_ionmap_is_mean_per_scan_on_common_grid(tmp_path):
    """Two scans in the same RT bin are averaged (not summed); a later scan lands in its own bin."""
    from tpfinder.explore import Session
    scans = [_scan_xml(0, 1.00, [150.2], [100.0]), _scan_xml(1, 1.01, [150.4], [300.0]), _scan_xml(2, 3.00, [250.7], [50.0])]
    f = tmp_path / "full.mzML"
    f.write_text(_mzml(f'<spectrumList count="3">{"".join(scans)}</spectrumList>'), encoding="utf-8")
    sess = Session([{"file": "full.mzML"}], tmp_path)
    g = sess.grid(1)
    m = sess.items[0].ionmap(1, g)
    assert m.shape == (g["nrt"], g["nmz"])
    rt_bin = lambda rt: min(int((rt - g["rt0"]) / (g["rt1"] - g["rt0"]) * g["nrt"]), g["nrt"] - 1)   # last edge falls in the last bin
    assert m[rt_bin(1.0), int(150.2 - g["mz0"])] == pytest.approx(200.0)      # mean of 100 and 300
    assert m[rt_bin(3.0), int(250.7 - g["mz0"])] == pytest.approx(50.0)
    assert m.sum() == pytest.approx(250.0)                                      # nothing else anywhere


def test_formula_mz_one_decimal_and_nominal():
    r = E.formula_mz("C9H10N2O", "[M+H]+")            # neutral 162.0793
    assert r["neutral"] == pytest.approx(162.0793, abs=1e-3)
    assert r["mz"] == pytest.approx(163.0866, abs=1e-3)
    assert r["mz1"] == 163.1 and r["nominal"] == 163
    assert E.formula_mz("C2H6O", "[M-H]-")["mz1"] == 45.0   # 45.0340 -> 45.0
    assert E.parse_formula("C(OH)2") == {"C": 1, "O": 2, "H": 2}
    assert E.round_half_up(364.05, 1) == 364.1 and E.round_half_up(200.5) == 201.0
    with pytest.raises(ValueError):
        E.parse_formula("C2H6Qq")
    with pytest.raises(ValueError):
        E.parse_formula("")


def test_spectrum_background_subtraction(tmp_path):
    """Same file, two windows: signal minus background per bin, clipped at zero."""
    from tpfinder.explore import Session
    scans = [_scan_xml(0, 1.0, [100.2, 200.2], [500.0, 80.0]), _scan_xml(1, 5.0, [100.2, 200.2], [100.0, 200.0])]
    f = tmp_path / "x.mzML"
    f.write_text(_mzml(f'<spectrumList count="2">{"".join(scans)}</spectrumList>'), encoding="utf-8")
    it = Session([{"file": "x.mzML"}], tmp_path).items[0]
    mz, y, n = it.spectrum(0.5, 1.5, bg={"item": it, "rt0": 4.5, "rt1": 5.5})
    assert n == 1 and len(mz) == 1                      # 200.2 is 80-200 < 0 -> dropped
    assert mz[0] == pytest.approx(100.2, abs=0.01) and y[0] == pytest.approx(400.0)


def test_theory_module_is_served_and_self_contained():
    """The Teoria pages are static: every local link, script and stylesheet must exist, no external scripts."""
    import re
    from importlib import resources
    from tpfinder.server import _static
    base = resources.files("tpfinder") / "web" / "teoria"
    pages = sorted(p.name for p in base.iterdir() if p.name.endswith(".html"))
    assert "index.html" in pages and len(pages) >= 10
    body, ctype = _static("teoria/index.html")
    assert ctype == "text/html" and b"QqQ lab" in body
    for name in pages:
        html = (base / name).read_text(encoding="utf-8")
        assert not re.search(r'<script[^>]+src="https?:', html), name
        for ref in re.findall(r'(?:src|href)="([^"#:]+)"', html):
            target = "teoria/" + ref if not ref.startswith("../") else ref[3:]
            assert _static(target) is not None, (name, ref)


def test_mac_app_bundle_and_vector_logo():
    """The Mac launcher app is complete (plist, executable, icon) and the logo exists as SVG."""
    import plistlib
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    app = root / "QqQ lab.app" / "Contents"
    info = plistlib.loads((app / "Info.plist").read_bytes())
    exe = app / "MacOS" / info["CFBundleExecutable"]
    text = exe.read_text(encoding="utf-8")
    assert text.startswith("#!/bin/bash") and "lab.command" in text and "osascript" in text
    assert (app / "Resources" / (info["CFBundleIconFile"] + ".icns")).read_bytes()[:4] == b"icns"
    svg = (root / "tpfinder" / "web" / "logo.svg").read_text(encoding="utf-8")
    assert svg.lstrip().startswith("<svg") and "linearGradient" in svg


def test_pda_chromatogram_is_read_as_kind_pda(tmp_path):
    """The mzML 'TWC' chromatogram (total wavelength, PDA/UV) is exposed as kind 'pda' and served by Item.total('pda')."""
    from tpfinder.explore import Item
    chrom = ('<chromatogram index="0" id="TWC" defaultArrayLength="3"><cvParam cvRef="MS" accession="MS:1000813" name="emission chromatogram" value=""/>'
             f'<binaryDataArrayList count="2">{_array("MS:1000595", "time array", [0.0, 0.004, 0.008])}{_array("MS:1000515", "intensity array", [5.0, -2.0, 9.0])}</binaryDataArrayList></chromatogram>')
    f = tmp_path / "uv.mzML"
    f.write_text(_mzml(f'<chromatogramList count="1">{chrom}</chromatogramList>'), encoding="utf-8")
    it = Item("uv.mzML", None, 0, "sample", f)
    assert it.has_pda()
    t, y = it.total("pda")
    assert list(y) == [5.0, -2.0, 9.0] and t[2] == pytest.approx(0.008)


def test_lc_method_xml_is_decoded():
    """The Shimadzu/Analyst LC method (VendorAppMethod XML) gives the gradient, flow changes, PDA settings and oven."""
    from tpfinder.reader.methodinfo import _lc

    def row(*f):
        return "<row>" + "".join(f"<Field{i + 1}>{v}</Field{i + 1}>" for i, v in enumerate(f)) + "</row>"
    xml = ('<SCIEX_ANALYST_ACQUISITION_METHOD><version_1>'
           '<Category><Title>System Controller</Title><Table><Name>Time Program</Name>'
           + row("Time", "Module", "Event", "Event String", "Parameter") + row("---", "---", "---", "---", "---")
           + row("2", "Pumps", "7", "Pump B Conc.", "50") + row("5", "Pumps", "6", "Total Flow", "0.50") + row("8", "System Controller", "3", "Stop", "")
           + '</Table></Category><Category><Title>Pumps</Title><Parameter><Name>Total Flow</Name><Value>0.25</Value><Unit>mL/min</Unit></Parameter>'
           '<Parameter><Name>B Concentration</Name><Value>5</Value><Unit>%</Unit></Parameter></Category>'
           '<Category><Title>PDA Detector</Title><Parameter><Name>Start WL</Name><Value>200</Value></Parameter><Parameter><Name>Stop WL</Name><Value>400</Value></Parameter>'
           '<Table><Name>DA Channel Array</Name>' + row("Wavelength", "BandWidth") + row("---", "---") + row("254", "4") + '</Table></Category>'
           '<Category><Title>Oven</Title><Parameter><Name>Temperature</Name><Value>40</Value></Parameter></Category></version_1></SCIEX_ANALYST_ACQUISITION_METHOD>')

    class FakeOle:
        streams = {"DeviceMethod1/VendorAppMethod": 1}

        def read(self, key):
            return b"\x00\x01junk<?xml version='1.0'?>" + xml.encode()
    lc = _lc(FakeOle(), "")
    assert [(g["t"], g["b"], g["flow"]) for g in lc["gradient"]] == [(0.0, 5.0, 0.25), (2.0, 50.0, 0.25), (5.0, 50.0, 0.5)]
    assert lc["run_time"] == 8.0 and lc["oven"] == 40.0
    assert lc["pda"]["start"] == 200.0 and lc["pda_channels"] == [{"wl": 254.0, "bw": 4.0}]


def test_browser_presence_stops_the_program(tmp_path, monkeypatch):
    """--exit-on-close: the program stops when no page is left (after a grace period), not before; a reload (bye then ping) is tolerated."""
    from tpfinder import server
    app = server.App(None, tmp_path / "w")
    monkeypatch.setattr(server, "EXIT_GRACE", 0.2)
    monkeypatch.setattr(server, "EXIT_FIRST", 0.5)
    import time
    assert not app.should_exit()                    # nobody yet, but the first-connection time has not passed
    app.ping("a")
    time.sleep(0.3)
    assert not app.should_exit()                    # a page is open
    app.bye("a")                                    # reload: the page leaves...
    app.ping("b")                                   # ...and the new one arrives within the grace period
    time.sleep(0.3)
    assert not app.should_exit()
    app.bye("b")
    assert not app.should_exit()                    # grace period not over
    time.sleep(0.3)
    assert app.should_exit()


def test_method_dam_upload_is_listed_and_unknown_is_empty(tmp_path):
    """A .dam is accepted as an upload, listed as a method and never replaced by a built-in method; with none, the list is empty."""
    from tpfinder import server
    app = server.App(None, tmp_path / "w")
    (tmp_path / "w").mkdir(exist_ok=True)
    assert app.methods() == [] and app.lab_methods() == []
    import io
    app.save_upload("Lab_x.dam", io.BytesIO(b"not an OLE file"), 15)
    assert [m["name"] for m in app.methods()] == ["Lab_x.dam"]
    lab = app.lab_methods()
    assert lab[0]["name"] == "Lab_x.dam" and "error" in lab[0]       # a broken file is reported, it does not crash
    assert app.files() == []                                        # a method is not a data file


def test_method_experiments_are_decoded_and_checked_against_the_data():
    """MRM transitions and scan ranges are read from MassRangeEx and compared with what the mzML says."""
    import struct
    from tpfinder.reader.methodinfo import _experiments, check_against

    def mrm_entry(q1, q3, dwell, name, ce):
        nm = name.encode("utf-16le")
        return (struct.pack("<f", q1) + b"\0" * 4 + struct.pack("<ff", q3, dwell) + b"\0" * 4
                + struct.pack("<H", len(nm)) + nm + b"\x04\x00D\x00P\x00" + struct.pack("<ff", 50, 50) + b"\0" * 4
                + b"\x04\x00C\x00E\x00" + struct.pack("<ff", ce, ce) + b"\0" * 4)
    mrm = b"\0" * 40 + mrm_entry(364.1, 194.1, 25.0, "Quant", 20.0) + mrm_entry(364.1, 152.1, 25.0, "Qual", 20.0)
    scan = bytearray(432)
    struct.pack_into("<f", scan, 40, 120.0)
    struct.pack_into("<f", scan, 240, 480.0)

    class FakeOle:
        streams = {"DeviceMethod0/Period0/Experiment0/MassRangeEx/MassRangeEx": 1, "DeviceMethod0/Period0/Experiment1/MassRangeEx/MassRangeEx": 1}
        data = [mrm, bytes(scan)]

        def read(self, key):
            return self.data[int(key.split("Experiment")[1][0])]
    ex = _experiments(FakeOle(), "")
    assert ex[0]["kind"] == "mrm" and [(t["q1"], t["q3"], t["ce"], t["dwell"], t["name"]) for t in ex[0]["transitions"]] == \
        [(364.1, 194.1, 20.0, 25.0, "Quant"), (364.1, 152.1, 20.0, 25.0, "Qual")]
    assert ex[1] == {"index": 1, "kind": "scan", "range": [120.0, 480.0], "ce": []}
    # same transitions in the file: all rows agree; a different Q3 or a full-scan file is flagged
    tr = [{"q1": 364.1, "q3": 194.1, "ce": 20.0, "dwell": 0.025}, {"q1": 364.1, "q3": 152.1, "ce": 20.0, "dwell": 0.025}]
    rows = check_against({"kind": "mrm", "transitions": tr}, {"experiments": ex[:1]})
    assert {r["status"] for r in rows} == {"ok"}
    rows = check_against({"kind": "mrm", "transitions": [tr[0], {"q1": 364.1, "q3": 100.0, "ce": 20.0, "dwell": 0.025}]}, {"experiments": ex[:1]})
    assert [r["status"] for r in rows].count("diff") == 2          # missing 152.1 in the file, extra 100.0 in the file
    rows = check_against({"kind": "full", "scan_window": [120.0, 480.0], "rt_max": 21.9}, {"experiments": ex[1:], "lc": {"run_time": 22.0}})
    assert {r["status"] for r in rows} == {"ok"}
    assert [r for r in check_against({"kind": "full", "scan_window": [100.0, 300.0]}, {"experiments": ex[1:]}) if r["what"].startswith("Intervallo")][0]["status"] == "diff"
    assert check_against({"kind": "mrm"}, {"experiments": ex[1:]})[0]["status"] == "diff"


def test_tic_and_bpc_can_be_restricted_to_an_mz_range(tmp_path):
    """TIC/BPC with mz0/mz1 only use ions inside the range (None = open end); no ions -> zeros."""
    from tpfinder.explore import Session
    scans = [_scan_xml(0, 1.0, [100.0, 200.0, 300.0], [10.0, 20.0, 40.0]), _scan_xml(1, 2.0, [100.0, 200.0, 300.0], [1.0, 2.0, 4.0])]
    (tmp_path / "f.mzML").write_text(_mzml(f'<spectrumList count="2">{"".join(scans)}</spectrumList>'), encoding="utf-8")
    it = Session([{"file": "f.mzML"}], tmp_path).items[0]
    assert it.total("tic")[1].tolist() == [70.0, 7.0]
    assert it.total("tic", 1, 150.0, 250.0)[1].tolist() == [20.0, 2.0]
    assert it.total("tic", 1, 250.0, None)[1].tolist() == [40.0, 4.0]
    assert it.total("bpc", 1, None, 250.0)[1].tolist() == [20.0, 2.0]
    assert it.total("bpc", 1, 400.0, 500.0)[1].tolist() == [0.0, 0.0]


def _ms2_scan(i: int, rt: float, prec: float, mz, inten) -> str:
    return (f'<spectrum index="{i}" id="scan={i + 1}" defaultArrayLength="{len(mz)}">'
            '<cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="2"/>'
            '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
            f'<scanList count="1"><scan><cvParam cvRef="MS" accession="MS:1000016" name="scan start time" value="{rt}" unitName="minute"/></scan></scanList>'
            f'<precursorList count="1"><precursor><isolationWindow><cvParam cvRef="MS" accession="MS:1000827" name="isolation window target m/z" value="{prec}"/></isolationWindow>'
            f'<selectedIonList count="1"><selectedIon><cvParam cvRef="MS" accession="MS:1000744" name="selected ion m/z" value="{prec}"/></selectedIon></selectedIonList></precursor></precursorList>'
            f'<binaryDataArrayList count="2">{_array("MS:1000514", "m/z array", mz)}{_array("MS:1000515", "intensity array", inten)}</binaryDataArrayList></spectrum>')


def test_experiment_type_is_read_from_the_file_and_ms2_can_be_filtered_by_precursor(tmp_path):
    """The start screen gets the experiment (full / ms2 / mrm) from the content, whatever the name says; MS2 chromatograms can be limited to one precursor."""
    from tpfinder.explore import Session, sniff
    (tmp_path / "enhanced_mrm_like_name.mzML").write_text(_mzml(f'<spectrumList count="2">{_scan_xml(0, 1.0, [100.0], [5.0])}{_scan_xml(1, 2.0, [100.0], [5.0])}</spectrumList>'), encoding="utf-8")
    sc = [_ms2_scan(0, 1.0, 229.1, [90.0], [10.0]), _ms2_scan(1, 1.1, 305.0, [90.0], [3.0]), _ms2_scan(2, 1.2, 229.1, [90.0], [20.0])]
    (tmp_path / "x.mzML").write_text(_mzml(f'<spectrumList count="3">{"".join(sc)}</spectrumList>'), encoding="utf-8")
    assert sniff(tmp_path / "enhanced_mrm_like_name.mzML")["kind"] == "full"
    assert sniff(tmp_path / "x.mzML")["kind"] == "ms2"
    it = Session([{"file": "x.mzML"}], tmp_path).items[0]
    assert it.info()["precursors"] == [229.1, 305.0] and it.info()["mode"] is None
    assert it.total("tic", 2)[1].tolist() == [10.0, 3.0, 20.0]
    rt, y = it.total("tic", 2, None, None, 229.1)
    assert rt.tolist() == [1.0, 1.2] and y.tolist() == [10.0, 20.0]
    it.run.close()
