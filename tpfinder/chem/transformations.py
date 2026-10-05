"""Candidate transformation products: the parent compound plus combinations of known reactions."""
from __future__ import annotations

import csv
import itertools
from pathlib import Path

from . import elements as E


def load_transformations(path: Path) -> list[dict]:
    """trasformazioni.csv: 'sep=;' first line (optional), then name;delta;comment."""
    rows = []
    text = Path(path).read_text(encoding="utf-8-sig").splitlines()
    if text and text[0].lower().startswith("sep="):
        text = text[1:]
    for r in csv.DictReader(text, delimiter=";"):
        name, delta = (r.get("name") or "").strip(), (r.get("delta") or "").strip()
        if not name or not delta or name.startswith("#"):
            continue
        rows.append({"name": name, "delta": E.parse_delta(delta), "comment": (r.get("comment") or "").strip()})
    return rows


def parent_neutral(parent: dict) -> tuple[dict | None, float]:
    """(formula or None, neutral monoisotopic mass) from the [parent] table of the project."""
    if parent.get("formula"):
        f = E.parse_formula(parent["formula"])
        return f, E.mass(f)
    if parent.get("mz"):
        adduct = parent.get("adduct") or E.DEFAULT_ADDUCT[parent.get("polarity", "positive")]
        return None, float(parent["mz"]) - E.ADDUCT_SHIFT[adduct]
    raise ValueError("the [parent] table needs a formula or an mz")


def generate(parent: dict, transformations: list[dict], max_steps: int = 2, tol_da: float = 0.35,
             min_mz: float = 50.0) -> list[dict]:
    """The parent (id 0) and every combination of up to max_steps reactions, one row per distinct
    net change. Rows closer than tol_da (in m/z) to another row are flagged 'isobaric'."""
    formula, neutral = parent_neutral(parent)
    adduct = parent.get("adduct") or E.DEFAULT_ADDUCT[parent.get("polarity", "positive")]
    seen: dict[tuple, dict] = {(): {"steps": [], "delta": {}}}
    # combinations with repetition, order does not matter
    for k in range(1, max_steps + 1):
        for combo in itertools.combinations_with_replacement(range(len(transformations)), k):
            delta: dict[str, int] = {}
            for i in combo:
                delta = E.add(delta, transformations[i]["delta"])
            key = tuple(sorted(delta.items()))
            if not delta:
                continue
            names = [transformations[i]["name"] for i in combo]
            if key in seen:
                if len(combo) == len(seen[key]["steps"]) and names not in seen[key].get("alts", []) \
                        and names != seen[key]["steps"]:
                    seen[key].setdefault("alts", []).append(names)
                continue
            seen[key] = {"steps": names, "delta": delta}
    out = []
    for key, v in seen.items():
        delta = v["delta"]
        if formula is not None:
            f = E.add(formula, delta)
            if any(n < 0 for n in f.values()):
                continue                              # more atoms removed than the parent has
            neutral_c = E.mass(f)
            fstr = E.fmt(f)
        else:
            f, neutral_c, fstr = None, neutral + E.mass(delta), ""
        mz = E.ion_mz(neutral_c, adduct)
        if mz < min_mz:
            continue
        name = "parent" if not v["steps"] else " + ".join(v["steps"])
        alts = [" + ".join(a) for a in v.get("alts", [])]
        out.append({"name": name, "alternatives": alts, "delta": E.fmt_delta(delta) if delta else "", "formula": fstr,
                    "neutral_mass": neutral_c, "mz": mz, "adduct": adduct, "steps": len(v["steps"]),
                    "formula_dict": f})
    out.sort(key=lambda r: (r["steps"], r["mz"]))
    # At unit resolution, candidates closer than the extraction window are the same trace: keep the
    # one with the fewest reactions and list the others as alternatives of the same mass.
    reps: list[dict] = []
    for r in out:
        host = next((h for h in reps if abs(h["mz"] - r["mz"]) <= tol_da), None)
        if host is None:
            reps.append(r)
        else:
            alt = r["name"] + (f" ({r['formula']}, m/z {r['mz']:.4f})" if r["formula"] else f" (m/z {r['mz']:.4f})")
            host["alternatives"].append(alt)
    reps.sort(key=lambda r: (r["steps"], r["mz"]))
    for i, r in enumerate(reps):
        r["id"] = i
        r["isobaric_with"] = []
    return reps
