"""Formula -> combined XIC (high resolution): sub-formulas, exact masses, measures per sub-formula, refusal in low resolution."""
import io
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import dati_sintetici as ds  # noqa: E402
from mzlab.app import App  # noqa: E402
from mzlab.chem.elements import ion_mz, mass, parse_formula  # noqa: E402
from mzlab.chem.subformulas import ELECTRON, subformulas  # noqa: E402
from mzlab.i18n import UserError  # noqa: E402

ION = "C14H14F4N3O2S"      # the [M+H]+ ion of the synthetic parent (the formula is read as the formula of the ion)


def test_enumeration_and_masses():
    f, subs = subformulas("C2H4O", z=1, min_mz=0)
    assert len(subs) == 3 * 5 * 2 - 1                                  # every combination except the empty one
    d = dict(subs)
    assert abs(d["C2H4O"] - (mass(parse_formula("C2H4O")) - ELECTRON)) < 1e-9
    assert abs(dict(subformulas("C2H4O", z=-1)[1])["C2H4O"] - (mass(parse_formula("C2H4O")) + ELECTRON)) < 1e-9
    assert [m for _, m in subs] == sorted(m for _, m in subs)


def test_lower_limit_leaves_out_the_small_ones():
    _, subs = subformulas("C10H12N2O3", min_mz=100)
    assert subs and all(m >= 100 for _, m in subs)
    assert "C2H4" not in dict(subs) and "C10H12N2O3" in dict(subs)


def test_too_many_combinations():
    with pytest.raises(UserError) as e:
        subformulas("C60H120N30O30")
    assert e.value.key == "err.subxic.many"


@pytest.fixture(scope="module")
def hr_app(tmp_path_factory):
    p = tmp_path_factory.mktemp("sx")
    ds.hr_dda(p / "e.mzML", np.random.default_rng(31), "exploris")
    app = App(p / "w")
    app.save_upload("e.mzML", io.BytesIO((p / "e.mzML").read_bytes()), (p / "e.mzML").stat().st_size)
    app.open_session({"samples": [{"file": "e.mzML"}]})
    return app


def test_combined_xic_on_hr_file(hr_app):
    out = hr_app.subxic(0, ION, ppm=5, min_mz=100)
    assert len(out["rt"]) == len(out["y"]) == len(out["full"]) and max(out["y"]) > 0 and max(out["full"]) > 0
    top = out["rows"][0]
    assert set(top) == {"formula", "mz", "ppm", "int", "rt", "r"}                # measures only: no label of any kind
    whole = next(r for r in out["rows"] if r["formula"] == ION)
    assert abs(whole["mz"] - (mass(parse_formula(ION)) - ELECTRON)) < 1e-4 and abs(whole["ppm"]) < 5 and whole["r"] is None
    assert all(abs(r["ppm"]) <= 5 for r in out["rows"] if r["ppm"] is not None)
    assert max(out["y"]) >= max(out["full"])                                      # the sum contains the whole formula
    wide = hr_app.subxic(0, ION, ppm=20, min_mz=100)
    assert wide["n_hit"] >= out["n_hit"]
    high = hr_app.subxic(0, ION, ppm=5, min_mz=300)
    assert all(r["mz"] >= 300 for r in high["rows"])


def test_refused_in_low_resolution(tmp_path):
    ds.full_scan(tmp_path / "lr.mzML", 15, np.random.default_rng(3))
    app = App(tmp_path / "w")
    app.save_upload("lr.mzML", io.BytesIO((tmp_path / "lr.mzML").read_bytes()), (tmp_path / "lr.mzML").stat().st_size)
    app.open_session({"samples": [{"file": "lr.mzML"}]})
    with pytest.raises(UserError) as e:
        app.subxic(0, "C10H12N2O3")
    assert e.value.key == "err.subxic.lr"
