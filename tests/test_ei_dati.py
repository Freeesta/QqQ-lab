"""The EI spectra of the Teoria and of the Pratica (qqq_lab/web/teoria/pratica/ei-dati.js, built by tools/genera_ei.py).

The teaching notes ("keys") are written by hand: these checks are the guard against chemistry mistakes. For every key ion:
nominal mass of its formula (+ delta for an isotope peak) = its m/z; odd/even electrons from the rings-plus-double-bonds value
agree with the charge notation ('+.' radical cation, '+' cation) and with the mechanism; the ion is a sub-formula of the
compound (one extra H allowed for hydrogen-transfer rearrangements); the peak is really in the chosen spectrum.
"""
import json
import re
from pathlib import Path

import pytest

from qqq_lab.chem.elements import parse_formula, mass

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "qqq_lab" / "web" / "teoria" / "pratica" / "ei-dati.js"
NOMINAL = {"H": 1, "C": 12, "N": 14, "O": 16, "F": 19, "Si": 28, "P": 31, "S": 32, "Cl": 35, "Br": 79, "I": 127}
ODD = {"M", "mclafferty", "rda", "orto"}                 # mechanisms that give odd-electron ions
EVEN = {"alpha", "i", "sigma", "tropilio", "serie"}      # simple cleavages: even-electron ions
TYPES = ODD | EVEN | {"perdita", "riarr", "isotopo"}


def load():
    txt = DATA.read_text(encoding="utf-8")
    body = txt[txt.index("const EI_DATA = ") + len("const EI_DATA = "):].rstrip().rstrip(";")
    return json.loads(body)


def split_ion(ion: str):
    m = re.fullmatch(r"([A-Za-z0-9]+)(\+\.?)", ion)
    assert m, ion
    return dict(parse_formula(m.group(1))), m.group(2) == "+."


def rdb(f: dict) -> float:
    c = f.get("C", 0) + f.get("Si", 0)
    x = f.get("H", 0) + f.get("F", 0) + f.get("Cl", 0) + f.get("Br", 0) + f.get("I", 0)
    n = f.get("N", 0) + f.get("P", 0)
    return c - x / 2 + n / 2 + 1


def test_file_and_sources():
    d = load()
    items = d["items"]
    assert len(items) >= 60 and sum(i["play"] for i in items) >= 50
    assert DATA.stat().st_size < 700_000
    assert "NIST" not in DATA.read_text(encoding="utf-8").upper().replace("NIST SPECTRA", "")
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids))
    for it in items:
        f = dict(parse_formula(it["formula"]))
        assert it["M"] == sum(NOMINAL[e] * n for e, n in f.items()), it["id"]
        assert abs(mass(parse_formula(it["formula"])) - it["M"]) < 0.5
        assert it["src"]["accession"].startswith("MSBNK-") and it["src"]["license"], it["id"]
        mzs = [p[0] for p in it["peaks"]]
        assert mzs == sorted(mzs) and max(p[1] for p in it["peaks"]) == 999, it["id"]
        assert max(mzs) <= it["M"] + 12, it["id"]                     # nothing far above the molecular ion cluster
        assert it["play"] is False or it["keys"], it["id"]


def test_keys_are_chemically_consistent():
    for it in load()["items"]:
        comp = dict(parse_formula(it["formula"]))
        peaks = dict((m, v) for m, v in it["peaks"])
        for k in it["keys"]:
            assert k["type"] in TYPES, (it["id"], k)
            f, odd = split_ion(k["ion"])
            nominal = sum(NOMINAL[e] * n for e, n in f.items())
            assert nominal + k.get("delta", 0) == k["mz"], (it["id"], k["mz"], k["ion"], nominal)
            r = rdb(f)
            assert r >= 0, (it["id"], k)
            assert (r == int(r)) == odd, (it["id"], k["ion"], "RDB", r)
            if k["type"] in ODD:
                assert odd, (it["id"], k)
            if k["type"] in EVEN:
                assert not odd, (it["id"], k)
            for e, n in f.items():
                assert n <= comp.get(e, 0) + (1 if e == "H" else 0), (it["id"], k["ion"], e)
            need = 2 if k["type"] == "M" else 10
            assert peaks.get(k["mz"], 0) >= need, (it["id"], k["mz"], peaks.get(k["mz"]))
            assert k["text"] and len(k["text"]) < 260


def test_no_compound_of_the_lab_methods():
    """The pollutants of the lab methods must not appear (their names are read from the private data repository, if present)."""
    dam = None
    for base in (ROOT.parent / "QqQ-lab-dati" / "dam", ROOT.parent / "Data" / "dam - Metodi"):
        if base.is_dir():
            dam = base
    if dam is None:
        pytest.skip("repository privato dei dati non presente")
    names = {m.group(1).lower() for p in dam.glob("*.dam") if (m := re.match(r"Lab_inq_MS2_([A-Za-z]+)\.dam$", p.name))}
    assert names
    text = json.dumps(load(), ensure_ascii=False).lower()
    for n in names:
        assert n[:7] not in text, n[:3] + "…"


def test_every_spectrum_cited_in_the_theory_exists():
    import re as _re
    ids = {i["id"] for i in load()["items"]}
    for page in (ROOT / "qqq_lab" / "web" / "teoria").glob("*.html"):
        for ref in _re.findall(r'data-ei="([^"]+)"', page.read_text(encoding="utf-8")):
            assert ref in ids, (page.name, ref)
