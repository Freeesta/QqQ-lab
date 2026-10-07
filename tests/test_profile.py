"""B1: mass profile (decimals, tolerance, high resolution or not) of a group of scans, and the fallback to today's behaviour."""
import sys
from pathlib import Path
from types import SimpleNamespace as NS

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import dati_sintetici as ds  # noqa: E402
from qqq_lab import explore  # noqa: E402
from qqq_lab.explore import Item  # noqa: E402
from qqq_lab.reader.mzml import Run  # noqa: E402
from qqq_lab.reader.profile import LOW, analyzer_from_components, mass_profile  # noqa: E402

sc = lambda an, res=None, n=3: [NS(an=an, res=res) for _ in range(n)]


def test_profile_table():
    assert mass_profile(sc("FTMS", 60000)) == {"hr": True, "an": "FTMS", "dec": 4, "tol": 5.0, "unit": "ppm"}
    assert mass_profile(sc("TOFMS")) == {"hr": True, "an": "TOFMS", "dec": 4, "tol": 10.0, "unit": "ppm"}
    assert mass_profile(sc("ITMS")) == {"hr": False, "an": "ITMS", "dec": 2, "tol": 0.5, "unit": "Da"}
    for an in ("TQMS", "SQMS"):                                   # unit resolution: exactly today's profile (apart from the analyzer code)
        p = mass_profile(sc(an))
        assert not p["hr"] and p["dec"] == LOW["dec"] and p["tol"] == LOW["tol"] and p["unit"] == "Da"


def test_unknown_analyzer_follows_the_resolving_power():
    assert mass_profile(sc("?", 70000)) == {"hr": True, "an": "?", "dec": 4, "tol": 10.0, "unit": "ppm"}
    assert not mass_profile(sc("?", 2000))["hr"] and not mass_profile(sc("?"))["hr"]
    assert mass_profile([]) == LOW and mass_profile(sc(None)) == LOW


def test_most_frequent_analyzer_wins():
    mixed = sc("FTMS", n=5) + sc("ITMS", n=2)
    assert mass_profile(mixed)["an"] == "FTMS"


def test_analyzer_from_instrument_components():
    assert analyzer_from_components(["quadrupole", "orbitrap"]) == "FTMS"
    assert analyzer_from_components(["quadrupole", "radial ejection linear ion trap"]) == "ITMS"
    assert analyzer_from_components(["quadrupole", "time-of-flight"]) == "TOFMS"
    # the 3200 QTRAP: two quadrupoles and an axial ejection ion trap = triple quadrupole, NOT an ion trap
    assert analyzer_from_components(["quadrupole", "quadrupole", "axial ejection linear ion trap"]) == "TQMS"
    assert analyzer_from_components(["quadrupole"]) == "SQMS" and analyzer_from_components([]) == "?"


@pytest.fixture(scope="module")
def d(tmp_path_factory):
    p = tmp_path_factory.mktemp("prof")
    rng = np.random.default_rng(31)
    ds.hr_dda(p / "e.mzML", rng, "exploris"); ds.hr_dda(p / "f.mzML", rng, "fusion"); ds.hr_dda(p / "b.mzML", rng, "exploris", broken=True)
    ds.full_scan(p / "q.mzML", 0, np.random.default_rng(1)); ds.mixed_ida(p / "ida.mzML", np.random.default_rng(2))
    return p


def test_qqq_files_keep_todays_profile(d):
    for name in ("q.mzML", "ida.mzML"):                           # Full Scan and an IDA file of the unit-resolution instrument
        info = Item(name, None, None, "sample", d / name).info()
        assert not info["prof1"]["hr"] and info["prof1"]["dec"] == 1 and info["prof2"]["dec"] == 1 and not info["prof2"]["hr"]
        assert info["nce"] is False and "hr_err" not in info
    assert Run(d / "q.mzML").hr1 is False


def test_orbitrap_files(d):
    e = Item("e.mzML", None, None, "sample", d / "e.mzML").info()
    assert e["prof1"]["hr"] and e["prof1"]["dec"] == 4 and e["prof2"]["hr"] and e["instrument"] == "Orbitrap Exploris 120"
    assert e["res1"] == 45000 and e["res2"] == 15000 and e["nce"] and e["dda"]
    f = Item("f.mzML", None, None, "sample", d / "f.mzML").info()
    assert f["prof1"]["hr"] and not f["prof2"]["hr"] and f["prof2"]["an"] == "ITMS" and f["prof2"]["dec"] == 2 and f["res2"] is None
    assert Run(d / "e.mzML").hr1 is True


def test_broken_file_opens_and_has_a_profile(d):
    b = Item("b.mzML", None, None, "sample", d / "b.mzML").info()
    assert b["scans"] > 100 and b["prof1"]["dec"] in (1, 4) and "hr_err" not in b and b["instrument"] == "Modello sconosciuto"


def test_a_failure_falls_back_to_todays_behaviour(d, monkeypatch):
    def boom(_):
        raise RuntimeError("prova")
    monkeypatch.setattr(explore, "mass_profile", boom)
    info = Item("e.mzML", None, None, "sample", d / "e.mzML").info()
    assert info["prof1"] == LOW and info["prof2"] == LOW and "prova" in info["hr_err"] and info["dda"] is False and info["scans"] > 100
