# TPMINE-PRIVATE
"""Where on the molecule did the transformation happen (WP9)? Maximum likelihood on the shifts of formula between the MS2 of a product and the
fragment library of its reference (the parent, or the predecessor of a multi-step product).

Each fragment of the product, with its formula, is either
  U  unshifted: the same formula is a fragment of the reference, so the fragment does not contain the modification, or
  S  shifted:   it is a fragment of the reference plus the change (or plus the change minus water: a hydroxylated product loses water at once),
                so it contains the modification.
For every candidate site R (a set of atoms of the molecular graph) the evidence is the probability that R lies inside the fragment (S) or outside
it (U), under the atom sets that the library gives to that fragment (weighted: fewest cuts first). The likelihood is a soft one (a floor of
EPS) because the spectra are mixtures: noise, co-isolation, co-eluting isomers. The region is the union of the sites within 0.25 of the best.
numpy only."""
from __future__ import annotations

import numpy as np

from . import formula as F
from .iimn import FragmentLibrary

EPS = 0.1                 # floor of the per-fragment probability (noise, co-isolation, co-eluting isomers)
MIN_REL = 2.0             # % of the base peak: weaker fragments are not evidence
REGION_WINDOW = 0.25      # log-likelihood units below the best site
H2O = {"H": 2, "O": 1}


# ---------------------------------------------------------------------------------------------------------------------- groups of atoms
def default_groups(mol) -> dict:
    """Names for the atoms of the graph: every ring system (fused rings joined) 'anello A', 'anello B'..., and every connected set of the atoms that
    are on no ring 'catena X'. A caller that knows the chemistry passes its own {name: set of atom indices}."""
    n = mol.n
    ring_atoms = set()
    systems: list[set] = []
    for ring in mol.rings():
        r = set(ring)
        ring_atoms |= r
        merged = [s for s in systems if len(s & r) >= 2]                   # fused: share a bond
        for s in merged:
            systems.remove(s)
            r |= s
        systems.append(r)
    groups = {}
    for k, s in enumerate(sorted(systems, key=min)):
        groups[f"anello {chr(65 + k)}"] = set(s)
    seen = set(ring_atoms)
    k = 0
    for a in range(n):
        if a in seen:
            continue
        comp, st = {a}, [a]
        while st:
            u = st.pop()
            for v, _ in mol.adj[u]:
                if v not in ring_atoms and v not in comp:
                    comp.add(v)
                    st.append(v)
        seen |= comp
        groups[f"catena {chr(65 + k)}"] = comp
        k += 1
    return groups


def describe(atoms: set, groups: dict) -> str:
    """'name (k/n)' for every group that has atoms in the set, largest share first."""
    parts = [(len(atoms & g) / len(g), name, len(atoms & g), len(g)) for name, g in groups.items() if atoms & g]
    parts.sort(key=lambda t: (-t[0], -t[2]))
    return ", ".join(f"{name} ({k}/{n})" for _, name, k, n in parts) or "-"


# ---------------------------------------------------------------------------------------------------------------------- sites
def change_type(delta: np.ndarray, els: list[str]) -> str:
    """'loss' (only heavy atoms lost), 'oxygen' (O or S gained, maybe with other changes), 'dehydro' (hydrogens lost, heavy atoms unchanged), or 'other'."""
    heavy = [i for i, e in enumerate(els) if e != "H"]
    d = delta[heavy]
    if np.all(d <= 0) and np.any(d < 0):
        return "loss"
    if delta[els.index("O")] > 0 or delta[els.index("S")] > 0:
        return "oxygen"
    if delta[els.index("H")] < 0 and not np.any(d != 0):
        return "dehydro"
    return "other"


def candidate_sites(delta: np.ndarray, els: list[str], subs):
    """(masks uint64, names) of the places where `delta` can have happened, by type of change: the connected substructures that hold the lost heavy
    atoms (loss); every C, N or S atom (oxygen gained, also with -2H or a lost carbon); every bond between two atoms that carry hydrogen (-2H)."""
    mol = subs.mol
    kind = change_type(delta, els)
    if kind == "loss":
        heavy = [i for i, e in enumerate(els) if e != "H"]
        lost = -delta[heavy]
        sel = np.flatnonzero(np.all(subs.F[:, heavy] == lost, axis=1))
        return subs.masks[sel], [subs.describe(int(i)) for i in sel], kind
    if kind == "oxygen":
        at = [j for j, a in enumerate(mol.atoms) if a in ("C", "N", "S")]
        return np.array([1 << j for j in at], dtype=np.uint64), [f"{mol.atoms[j]}{j}" for j in at], kind
    if kind == "dehydro":
        bd = [(a, b) for a, b, _ in mol.bonds if mol.H[a] > 0 and mol.H[b] > 0]
        return np.array([(1 << a) | (1 << b) for a, b in bd], dtype=np.uint64), [f"{mol.atoms[a]}{a}-{mol.atoms[b]}{b}" for a, b in bd], kind
    return np.zeros(0, np.uint64), [], kind


# ---------------------------------------------------------------------------------------------------------------------- evidence
def classify_fragments(tp_vec: np.ndarray, mz, rel, lib: FragmentLibrary, space: F.FormulaSpace, delta: np.ndarray, ppm: float = 5.0, abs_da: float = 0.002,
                       min_rel: float = MIN_REL, precursor_mz: float | None = None, prefer_library: bool = True) -> list[dict]:
    """U / S evidence from the MS2 of the product. mz, rel: consensus peaks (rel in %, base peak 100). Fragments heavier than the precursor - 1.5, weaker
    than `min_rel`, without a formula that is a sub-formula of the product's, or in neither relation to the library are not evidence."""
    els = space.els
    shifts = [delta]
    if delta[els.index("O")] > 0:
        shifts.append(delta - F.vec(H2O, els))                    # a hydroxylated product loses water: its fragments are shifted by the change minus water
    lib_index = {tuple(e["vec"].tolist()): f for f, e in lib.entries.items()}
    out = []
    for m, r in zip(np.asarray(mz, float), np.asarray(rel, float)):
        if r < min_rel or (precursor_mz is not None and m > precursor_mz - 1.5):
            continue
        c = space.candidates(float(m), ppm, abs_da, within=tp_vec)
        if len(c) == 0:
            continue
        # among the formulas within tolerance prefer one the library knows (unshifted or shifted), then the smallest error
        best, best_rank = None, None
        for ci in (c[:8] if prefer_library else c[:1]):
            v = space.G[int(ci)]
            k0 = lib_index.get(tuple(v.tolist()))
            k1 = [lib_index.get(tuple((v - d).tolist())) for d in shifts]
            k1 = next((k for k in k1 if k is not None), None)
            kind = "U" if (k0 is not None and k1 is None) else "S" if (k1 is not None and k0 is None) else None
            rank = (0 if kind else 1, abs(space.mass[int(ci)] - m))
            if best_rank is None or rank < best_rank:
                best, best_rank = (int(ci), kind, k0, k1), rank
        ci, kind, k0, k1 = best
        if kind is None:
            continue
        out.append({"mz": float(m), "rel": float(r), "formula": F.fmt(space.G[ci], els), "kind": kind, "library": k0 if kind == "U" else k1,
                    "ppm": float((m - space.mass[ci]) / space.mass[ci] * 1e6)})
    return out


def site_log_likelihood(R: np.ndarray, evidence: list[dict], lib: FragmentLibrary, eps: float = EPS) -> np.ndarray:
    """LL of every site (masks R, uint64) given the evidence: sum over fragments of sqrt(relative intensity) x log(eps + (1 - 2 eps) p), with p the
    probability, under the atom sets of the library fragment, that the site is inside it (S) or outside it (U)."""
    LL = np.zeros(len(R))
    for ev in evidence:
        e = lib.entries[ev["library"]]
        if e["idx"] is None or len(e["idx"]) == 0:
            continue
        fm = lib.subs.masks[e["idx"]]
        cw = e["w"]
        if ev["kind"] == "S":
            p = ((R[:, None] & ~fm[None, :]) == 0) @ cw                  # the site is inside the fragment
        else:
            p = ((R[:, None] & fm[None, :]) == 0) @ cw                   # the site is disjoint from the fragment
        LL += np.sqrt(ev["rel"] / 100.0) * np.log(eps + (1 - 2 * eps) * p)
    return LL


def localize(tp_formula, ref_formula, mz, rel, lib: FragmentLibrary, space: F.FormulaSpace, *, groups: dict | None = None, eps: float = EPS,
             min_rel: float = MIN_REL, window: float = REGION_WINDOW, tp_mz: float | None = None, prefer_library: bool = True) -> dict:
    """Localisation of the change from `ref_formula` (ion formula of the reference: the parent, or the predecessor) to `tp_formula` (ion), from the
    consensus MS2 (mz, rel in %) of the product and the library of the reference.

    Returns {"ok", "type", "delta", "n_sites", "evidence": [...], "region_atoms", "retained_atoms", "region", "top_sites", "margin", "ll_best", "note"}.
    `margin` = best LL inside the region minus best LL outside it (0 when every site is inside): a large margin = a sure site."""
    els = space.els
    subs = lib.subs
    tp_vec, ref_vec = F.vec(tp_formula, els), F.vec(ref_formula, els)
    delta = tp_vec - ref_vec
    out = {"ok": False, "type": None, "delta": F.fmt(np.abs(delta), els), "delta_sign": "-" if delta.sum() < 0 else "+", "evidence": [], "n_sites": 0, "note": ""}
    if subs is None:
        out["note"] = "the structure (SMILES) of the parent is required"
        return out
    R, names, kind = candidate_sites(delta, els, subs)
    out["type"], out["n_sites"] = kind, int(len(R))
    if len(R) == 0:
        out["note"] = {"other": "modification type not covered by the site model"}.get(kind, "no candidate site in the graph")
        return out
    ev = classify_fragments(tp_vec, mz, rel, lib, space, delta, min_rel=min_rel, precursor_mz=tp_mz, prefer_library=prefer_library)
    out["evidence"] = ev
    if not ev:
        out["note"] = "no fragment with a known relation to the library: the region cannot be determined"
        return out
    LL = site_log_likelihood(R, ev, lib, eps)
    best = float(LL.max())
    inside = LL >= best - window
    region = 0
    for m in R[inside]:
        region |= int(m)
    atoms = {j for j in range(subs.mol.n) if (region >> j) & 1}
    groups = groups if groups is not None else default_groups(subs.mol)
    o = np.argsort(-LL, kind="stable")[:6]
    out.update(ok=True, region_atoms=sorted(atoms), region=describe(atoms, groups), ll_best=best, n_inside=int(inside.sum()),
               top_sites=[{"site": names[i], "ll": float(LL[i]), "atoms": [j for j in range(subs.mol.n) if (int(R[i]) >> j) & 1]} for i in o],
               margin=float(best - LL[~inside].max()) if (~inside).any() else 0.0,
               fraction_explained=float(sum(e["rel"] for e in ev) / max(float(np.sum(np.asarray(rel)[np.asarray(rel) >= min_rel])), 1e-12)))
    if kind == "loss":
        out["retained_atoms"] = sorted(set(range(subs.mol.n)) - atoms)
        out["retained"] = describe(set(range(subs.mol.n)) - atoms, groups)
    counts = {"S": sum(1 for e in ev if e["kind"] == "S"), "U": sum(1 for e in ev if e["kind"] == "U")}
    out["n_shifted"], out["n_unshifted"] = counts["S"], counts["U"]
    return out


def derive_library(lib: FragmentLibrary, space: F.FormulaSpace, evidence: list[dict]) -> FragmentLibrary:
    """Library of a product, to be the reference of a second modification: its fragments, each with the atom sets of the parent fragment it comes from
    (a shifted fragment keeps the atoms of f - change, a fragment that is unshifted keeps its own), plus the entries of the parent that the product
    does not contradict. Used for multi-step products: the second change is localised against what the first one left."""
    new = FragmentLibrary(lib.els, lib.subs)
    for ev in evidence:
        e = lib.entries[ev["library"]]
        new.add(ev["formula"], ev["mz"], "ms2", ev["rel"], e["idx"], e["w"])
    return new


# ---------------------------------------------------------------------------------------------------------------------- cleavage
def cleavage_parts(tp_formula, lib: FragmentLibrary, tree=None, space: F.FormulaSpace | None = None) -> dict:
    """Cleavage product (the heavy atoms of the formula are a part of the parent): which parts of the parent can have this formula (substructures with
    the same heavy atoms, hydrogens within 3), their weights, the atoms present in all of them ('certain') or in some ('possible'), and the nodes of
    the MSn tree that have the same formula ('the product keeps this part')."""
    subs = lib.subs
    vec = F.vec(tp_formula, lib.els)
    idx, w = subs.candidates(vec)
    out = {"n_candidates": int(len(idx)), "certain": [], "possible": [], "nodes": []}
    if len(idx):
        bits = subs.bits[idx]
        out["certain"] = np.flatnonzero(bits.all(0)).tolist()
        out["possible"] = np.flatnonzero(bits.any(0)).tolist()
        out["probability"] = (bits * w[:, None]).sum(0).tolist()
    if tree is not None:
        out["nodes"] = [n["id"] for n in tree.nodes if n["formula"] == tp_formula or any(p["formula"] == tp_formula for p in n["peaks"])]
    return out
