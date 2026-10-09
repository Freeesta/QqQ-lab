"""Known contaminants: the built-in list (contaminants.json) expanded into ions with exact m/z computed from the formulas (elements.py).

The result is a flat list of ions {list, id, name, cls, formula, adduct, z, mz, pol, series, source}; the matching, the series and the lists of the user are
done in the browser by web/liste.js (one engine for every list of reference). A coincidence of m/z is a compatibility, never an identification.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .elements import ADDUCT_SHIFT, ELECTRON, MASS, mass, parse_formula
from ..i18n import UserError

# adducts that elements.py does not have: ions of this list only. shift = mass added to the neutral, z = charge; mz = (M + shift) / z
_NH4 = ADDUCT_SHIFT["[M+NH4]+"]
_CH3COO = mass(parse_formula("C2H3O2")) + ELECTRON
_NA2H = mass(parse_formula("Na")) - 2 * mass(parse_formula("H")) + ELECTRON
_CF3COO = mass(parse_formula("C2F3O2")) + ELECTRON
_ACN = mass(parse_formula("C2H3N"))
_CH4 = mass(parse_formula("CH4"))
EXTRA = {
    "[M+CH3CN+H]+": (ADDUCT_SHIFT["[M+H]+"] + _ACN, 1), "[M+CH3CN+NH4]+": (_NH4 + _ACN, 1), "[M+CH3CN+Na]+": (ADDUCT_SHIFT["[M+Na]+"] + _ACN, 1),
    "[M+H-CH4]+": (ADDUCT_SHIFT["[M+H]+"] - _CH4, 1),
    "[M]+": (-ELECTRON, 1), "[M]-": (ELECTRON, 1),
    "[M+2H]2+": (2 * ADDUCT_SHIFT["[M+H]+"], 2), "[M+2NH4]2+": (2 * _NH4, 2), "[M+2Na]2+": (2 * ADDUCT_SHIFT["[M+Na]+"], 2),
    "[M+H+NH4]2+": (ADDUCT_SHIFT["[M+H]+"] + _NH4, 2),
    "[M+CH3COO]-": (_CH3COO, 1),
    "[M+Na-2H]-": (_NA2H, 1),
    "[M+CF3COO]-": (_CF3COO, 1),
}
PATH = Path(__file__).with_name("contaminants.json")
PATH_EN = Path(__file__).with_name("contaminants_en.json")       # English names and classes, same ids (the page shows them when it is in English)


def ion_shift(adduct: str) -> tuple[float, int]:
    if adduct in ADDUCT_SHIFT:
        return ADDUCT_SHIFT[adduct], 1
    if adduct in EXTRA:
        return EXTRA[adduct]
    raise UserError("err.adduct.unknown", {"adduct": adduct}, f"unknown adduct: {adduct}")


def _mass(formula: str) -> float:
    return mass(parse_formula(formula)) if formula else 0.0


def expand(entry: dict, list_id: str = "keller", en: dict | None = None) -> list[dict]:
    """The ions of one entry of the list (a polymer gives one set of ions for each n)."""
    out = []
    base = {"list": list_id, "id": entry["id"], "cls": entry.get("class", ""), "source": entry.get("source", ""), "note": entry.get("note")}
    name_en = (en or {}).get("names", {}).get(entry["id"])
    if en:
        base["cls_en"] = en["classes"].get(entry.get("class", ""))
    pol_of = lambda ad, p: 1 if ad.endswith("+") else -1                         # noqa: E731
    if entry.get("formula") is None:                                             # only an m/z (no formula): lower reliability
        mz = float(entry["mz"]); pol = {"positive": 1, "negative": -1}.get(entry.get("polarity"), 1)
        return [{**base, "name": entry["name"], "name_en": name_en, "formula": None, "adduct": None, "z": 1, "mz": mz, "pol": pol, "series": None, "mzonly": True}]
    ser = entry.get("series")
    units = [(n, n * _mass(ser["unit"]) + _mass(ser.get("end", "")), f"{ser['unit']}x{n}") for n in range(ser["n"][0], ser["n"][1] + 1)] if ser else [(None, _mass(entry["formula"]), entry["formula"])]
    for n, m, fm in units:
        for ad in entry["ions"]:
            sh, z = ion_shift(ad)
            out.append({**base, "name": entry["name"] + (f" n={n}" if n is not None else ""), "name_en": name_en and name_en + (f" n={n}" if n is not None else ""), "formula": fm, "adduct": ad, "z": z, "mz": round((m + sh) / z, 5), "pol": pol_of(ad, 0),
                        "series": {"id": entry["id"] + "|" + ad, "n": n} if ser else None, "mzonly": False})
    return out


@lru_cache(maxsize=1)
def builtin() -> dict:
    d = json.loads(PATH.read_text(encoding="utf-8"))
    en = json.loads(PATH_EN.read_text(encoding="utf-8"))
    items = [i for e in d["entries"] for i in expand(e, d["id"], en)]
    return {"id": d["id"], "name": d["name"], "name_en": en["list"]["name"], "source": d["source"], "license": d["license"], "license_en": en["list"]["license"], "builtin": True, "items": items}
