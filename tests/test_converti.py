"""tools/converti.py: .raw -> ThermoRawFileParser (command and skipping what is converted), .wiff / .d -> the MSConvert command in Docker."""
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import converti  # noqa: E402


def test_prova_stampa_i_comandi(tmp_path):
    (tmp_path / "a.raw").write_bytes(b"x"); (tmp_path / "b.wiff").write_bytes(b"x"); (tmp_path / "b.wiff.scan").write_bytes(b"x"); (tmp_path / "c.d").mkdir()
    righe = []
    r = converti.converti(tmp_path, tmp_path / "mzML", None, True, righe.append)
    t = "\n".join(righe)
    assert "-f 2" in t and "-z" in t and "a.raw" in t
    assert "docker run" in t and "b.wiff" in t and "c.d" in t and converti.PWIZ in t and "peakPicking vendor msLevel=1-" in t
    assert len(r["da_fare"]) == 3 and not r["errori"]
    assert not (tmp_path / "mzML").exists()                      # --prova writes nothing


def test_converte_con_un_programma_finto(tmp_path):
    prog = tmp_path / "TRFP"                                      # a fake ThermoRawFileParser: writes the mzML named after the input
    prog.write_text("#!/bin/sh\nwhile [ $# -gt 0 ]; do case $1 in -i) i=$2;; -o) o=$2;; esac; shift; done\nb=$(basename \"$i\" .raw)\necho '<mzML/>' > \"$o/$b.mzML\"\n")
    prog.chmod(prog.stat().st_mode | stat.S_IEXEC)
    (tmp_path / "a.raw").write_bytes(b"x"); (tmp_path / "b.raw").write_bytes(b"x"); (tmp_path / "mzML").mkdir(); (tmp_path / "mzML" / "b.mzML").write_text("old")
    righe = []
    r = converti.converti(tmp_path, tmp_path / "mzML", str(prog), False, righe.append)
    assert r["fatti"] == ["a.raw"] and r["saltati"] == ["b.raw"] and not r["errori"]
    assert (tmp_path / "mzML" / "a.mzML").read_text().startswith("<mzML") and (tmp_path / "mzML" / "b.mzML").read_text() == "old"


def test_senza_programma_lo_dice(tmp_path, monkeypatch):
    monkeypatch.delenv("THERMORAWFILEPARSER", raising=False); monkeypatch.setenv("PATH", str(tmp_path))
    (tmp_path / "a.raw").write_bytes(b"x")
    righe = []
    r = converti.converti(tmp_path, tmp_path / "o", None, False, righe.append)
    assert r["errori"] == ["trfp"] and "ThermoRawFileParser non trovato" in "\n".join(righe)


def test_cartella_senza_file(tmp_path):
    righe = []
    converti.converti(tmp_path, tmp_path / "o", None, False, righe.append)
    assert "Nessun file" in righe[0]
