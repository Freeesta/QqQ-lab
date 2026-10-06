# TPMINE-PRIVATE
"""Formulas, SMILES -> formula, transformations and candidate generation. Uses qqq_lab.chem.elements for masses (no duplicate table)."""
from __future__ import annotations

import itertools
import re

from qqq_lab.chem import elements as E
from qqq_lab.chem.elements import ADDUCT_SHIFT, DEFAULT_ADDUCT, fmt, ion_mz, mass, parse_formula


def add(a: dict, b: dict) -> dict:
    out = dict(a)
    for e, n in b.items():
        out[e] = out.get(e, 0) + n
    return {k: v for k, v in out.items() if v}


def parse_delta(s: str) -> dict:
    """'+O', '-H2', '-Cl+H', '+C2H4O' -> signed counts."""
    s = s.replace(" ", "")
    if s and s[0] not in "+-":
        s = "+" + s
    out: dict = {}
    for sign, body in re.findall(r"([+-])([A-Za-z0-9]+)", s):
        for el, n in parse_formula(body).items():
            out[el] = out.get(el, 0) + (n if sign == "+" else -n)
    return {k: v for k, v in out.items() if v}


def fmt_delta(f: dict) -> str:
    return "".join(("+" if n > 0 else "-") + e + (str(abs(n)) if abs(n) != 1 else "") for e, n in sorted(f.items()))


# ---------------------------------------------------------------------------------------------- SMILES -> molecular formula
_ORGANIC = {"B": (3,), "C": (4,), "N": (3, 5), "O": (2,), "P": (3, 5), "S": (2, 4, 6), "F": (1,), "Cl": (1,), "Br": (1,), "I": (1,)}
_ATOM = re.compile(r"\[([^\]]+)\]|(Cl|Br|[BCNOPSFI]|[bcnops])|(=|#|:|-|/|\\|\.|\(|\)|%\d\d|\d|\$)")


def smiles_formula(smiles: str) -> dict:
    """Molecular formula of a SMILES (organic subset, brackets, aromatic atoms, charges ignored for the count of H).
    Implicit hydrogens come from the normal valences; aromatic atoms count one bond as double. Not a cheminformatics toolkit:
    stereo and isotopes are ignored; salts ('.') are summed."""
    atoms: list[dict] = []          # {el, bonds (sum of bond orders), arom, explicit_h or None}
    stack: list[int] = []
    prev = None
    order = 1.0
    rings: dict[str, tuple[int, float]] = {}
    pos = 0
    s = smiles.strip()
    while pos < len(s):
        m = _ATOM.match(s, pos)
        if not m:
            raise ValueError(f"SMILES non riconosciuto vicino a «{s[pos:pos + 6]}»")
        pos = m.end()
        br, org, tok = m.groups()
        if br or org:
            if br:
                mm = re.match(r"(?:\d+)?([A-Z][a-z]?|[a-z]{1,2})(?:@+)?(?:H(\d*))?([+-]+\d*)?(?::\d+)?$", br)
                if not mm:
                    raise ValueError(f"atomo tra parentesi non riconosciuto: [{br}]")
                el = mm.group(1)
                h = 0 if mm.group(2) is None else (int(mm.group(2)) if mm.group(2) else 1)
                charge = mm.group(3) or ""
                atom = {"el": el.capitalize(), "bonds": 0.0, "arom": el.islower(), "h": h, "charge": charge, "br": True}
            else:
                atom = {"el": org.capitalize(), "bonds": 0.0, "arom": org.islower(), "h": None, "charge": "", "br": False}
            atoms.append(atom)
            i = len(atoms) - 1
            if prev is not None:
                atoms[prev]["bonds"] += order
                atom["bonds"] += order
            stack_top = i
            prev, order = stack_top, 1.0
        elif tok:
            if tok == "(":
                stack.append(prev)
            elif tok == ")":
                prev = stack.pop()
            elif tok == ".":
                prev = None
            elif tok == "=":
                order = 2.0
            elif tok == "#":
                order = 3.0
            elif tok in "-:/\\":
                order = 1.0
            elif tok.lstrip("%").isdigit():
                key = tok
                if key in rings:
                    j, o = rings.pop(key)
                    o = max(o, order)
                    atoms[prev]["bonds"] += o
                    atoms[j]["bonds"] += o
                else:
                    rings[key] = (prev, order)
                order = 1.0
    if rings:
        raise ValueError("anello non chiuso nello SMILES")
    f: dict = {}
    for a in atoms:
        f[a["el"]] = f.get(a["el"], 0) + 1
        if a["h"] is not None:
            h = a["h"]
        else:
            if a["arom"] and a["el"] != "C":
                h = 0                                       # aromatic N, O, S, P without brackets carry no H ([nH] is written in brackets)
            else:
                bonds = a["bonds"] + (1 if a["arom"] else 0)    # aromatic C: one of its ring bonds is double in the Kekule form
                vals = _ORGANIC.get(a["el"], (0,))
                h = max(0, int(round(next((v - bonds for v in vals if v >= bonds), 0))))
        if h:
            f["H"] = f.get("H", 0) + h
    for el in f:
        if el not in E.MASS:
            raise ValueError(f"elemento non supportato: {el}")
    return f


def neutral_formula(text: str) -> dict:
    """The user may type a molecular formula (C10H12N2O3S) or a SMILES. A SMILES contains lower-case atoms, '(' , '=' etc."""
    t = text.strip()
    if not t:
        raise ValueError("serve una formula bruta neutra o uno SMILES")
    if re.fullmatch(r"(?:[A-Z][a-z]?\d*)+", t):
        return parse_formula(t)
    return smiles_formula(t)


# ---------------------------------------------------------------------------------------------- transformations
# (name, delta, comment). Editable in the UI (one per line: name;delta). Names in Italian.
DEFAULT_TRANSFORMATIONS = [
    ("idrossilazione", "+O", "un ossigeno in più (OH aromatico o alifatico)"),
    ("diidrossilazione", "+O2", "due ossigeni in più"),
    ("deidrogenazione", "-H2", "perdita di H2 (doppio legame, chiusura di anello)"),
    ("ossidazione a carbonile", "+O-H2", "alcol -> chetone o aldeide"),
    ("demetilazione", "-CH2", "N- o O-demetilazione"),
    ("metilazione", "+CH2", ""),
    ("perdita di propene (N-deisopropilazione)", "-C3H6", "perdita del gruppo isopropile"),
    ("decarbossilazione", "-CO2", ""),
    ("carbossilazione", "+CO2", ""),
    ("idratazione", "+H2O", "addizione di acqua, idrolisi senza rottura"),
    ("disidratazione", "-H2O", ""),
    ("perdita di SO2", "-SO2", "estrusione di SO2 (solfonammidi, solfoni)"),
    ("perdita di CO", "-CO", ""),
    ("deamminazione ossidativa", "-NH+O-H2", ""),
    ("declorurazione riduttiva", "-Cl+H", ""),
    ("declorurazione idrolitica", "-Cl+OH", ""),
    ("debromurazione riduttiva", "-Br+H", ""),
    ("defluorurazione idrolitica", "-F+OH", ""),
    ("idrolisi ammide", "+H2O", "taglio del legame ammidico/estere (stessa massa dell'idratazione)"),
]


def parse_transformations(text: str) -> list[dict]:
    """One per line: 'name;delta' (comments after a second ';' are kept). Empty lines and lines starting with # are ignored."""
    rows = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#"):
            continue
        parts = [p.strip() for p in ln.split(";")]
        if len(parts) < 2 or not parts[1]:
            raise ValueError(f"riga non valida (serve «nome;variazione»): {ln}")
        rows.append({"name": parts[0], "delta": parse_delta(parts[1]), "comment": parts[2] if len(parts) > 2 else ""})
    return rows


def default_transformations() -> list[dict]:
    return [{"name": n, "delta": parse_delta(d), "comment": c} for n, d, c in DEFAULT_TRANSFORMATIONS]


def transformations_text(rows=DEFAULT_TRANSFORMATIONS) -> str:
    return "\n".join(f"{n};{d};{c}" if c else f"{n};{d}" for n, d, c in rows)


def generate(neutral: dict, adduct: str, transformations: list[dict], max_steps: int = 2, tol_da: float = 0.35,
             min_mz: float = 50.0) -> list[dict]:
    """Parent (id 0) + every combination of up to max_steps reactions, one row per distinct net change. At unit resolution
    candidates closer than tol_da (m/z) are the same trace: the one with fewest reactions stays, the others become alternatives."""
    seen: dict[tuple, dict] = {(): {"steps": [], "delta": {}}}
    for k in range(1, max_steps + 1):
        for combo in itertools.combinations_with_replacement(range(len(transformations)), k):
            delta: dict = {}
            for i in combo:
                delta = add(delta, transformations[i]["delta"])
            if not delta:
                continue
            key = tuple(sorted(delta.items()))
            names = [transformations[i]["name"] for i in combo]
            if key in seen:
                v = seen[key]
                if len(combo) == len(v["steps"]) and names != v["steps"] and names not in v.setdefault("alts", []):
                    v["alts"].append(names)
                continue
            seen[key] = {"steps": names, "delta": delta}
    out = []
    for v in seen.values():
        f = add(neutral, v["delta"])
        if any(n < 0 for n in f.values()):
            continue
        m = mass(f)
        mz = ion_mz(m, adduct)
        if mz < min_mz:
            continue
        out.append({"name": "progenitore" if not v["steps"] else " + ".join(v["steps"]),
                    "alternatives": [" + ".join(a) for a in v.get("alts", [])], "delta": fmt_delta(v["delta"]) if v["delta"] else "",
                    "delta_dict": v["delta"], "formula": fmt(f), "neutral_mass": m, "mz": mz, "adduct": adduct,
                    "steps": len(v["steps"]), "formula_dict": f})
    out.sort(key=lambda r: (r["steps"], r["mz"]))
    reps: list[dict] = []
    for r in out:
        host = next((h for h in reps if abs(h["mz"] - r["mz"]) <= tol_da), None)
        if host is None:
            reps.append(r)
        else:
            host["alternatives"].append(f"{r['name']} ({r['formula']}, m/z {r['mz']:.4f})")
    for i, r in enumerate(reps):
        r["id"] = i
    return reps
