"""Tree of the fragmentation paths of an MSn file (typically a direct infusion): one node per path (m/z@activation+energy, ...), its consensus
spectrum, the exact precursor read from the parent node and the formulas (a node is a sub-formula of its parent). Candidates, never a verdict."""
from __future__ import annotations

import re

import numpy as np

from .composition import MASS, compose
from ..i18n import UserError

_RX = re.compile(r"([A-Z][a-z]?)(\d*)")
MAX_SCANS = 60          # scans averaged per node (the first ones: enough for a stable consensus)
MAX_PEAKS = 120         # peaks per node sent to the page


def _parse(f: str) -> dict[str, int]:
    d: dict[str, int] = {}
    for el, n in _RX.findall(f or ""):
        if el:
            d[el] = d.get(el, 0) + int(n or 1)
    return d


def _key(path) -> tuple:
    return tuple((round(m), a, ce) for m, a, ce in path)


def consensus(run, idx: list[int], ppm: float = 5.0, min_frac: float = 0.5):
    """Peaks present in at least `min_frac` of the scans (max-normalised per scan), merged within `ppm`: (mz, mean relative intensity, n scans)."""
    ms, its, sid = [], [], []
    for k, i in enumerate(idx):
        mz, it = run.read(i)
        if len(mz) == 0 or float(np.max(it)) <= 0:
            continue
        ms.append(np.asarray(mz, float)); its.append(np.asarray(it, float) / float(np.max(it))); sid.append(np.full(len(mz), k))
    if not ms:
        return np.zeros(0), np.zeros(0), np.zeros(0, int)
    mz = np.concatenate(ms); it = np.concatenate(its); sd = np.concatenate(sid)
    o = np.argsort(mz); mz, it, sd = mz[o], it[o], sd[o]
    lab = np.zeros(len(mz), int)
    lab[np.flatnonzero(np.diff(mz) > mz[1:] * ppm * 1e-6) + 1] = 1
    lab = np.cumsum(lab)
    w = np.bincount(lab, it)
    cm = np.bincount(lab, it * mz) / np.maximum(w, 1e-12)
    nsc = np.bincount(lab[np.unique(lab * (len(idx) + 1) + sd, return_index=True)[1]], minlength=len(w))
    keep = nsc >= max(1, min_frac * len(idx))
    return cm[keep], w[keep] / len(idx), nsc[keep]


ROOT_ELEMENTS = {"C": (0, 60), "H": (0, 120), "N": (0, 10), "O": (0, 12), "S": (0, 3)}
ROOT_RULES = ["HC", "NC", "OC", "SC", "LEWIS", "SENIOR"]


def _best(mz: float, ion: str, parent: str | None, elements, tol: float, rules=None) -> dict | None:
    try:
        r = compose(mz, elements=elements, ion=ion, tol=tol, unit="ppm", rdb=(-0.5, 100.0), parent=parent, rules=rules, max_results=1)
    except ValueError:
        return None
    return r["results"][0] if r["results"] else None


def msn_tree(run, formula: str | None = None, ppm: float = 5.0, elements: dict | None = None) -> dict:
    """{nodes: [...], root: {...}}. `formula` = formula of the ION at the root of the tree (the precursor of the first stage), if known: the formulas of
    the nodes are then sub-formulas of it; without it the root is the best candidate of the default elements for its exact m/z."""
    if formula and (not re.fullmatch(r"([A-Z][a-z]?\d*)+", formula) or any(e not in MASS for e in _parse(formula))):
        raise UserError("err.tree.formula", {"formula": formula}, f"invalid formula: {formula}")
    groups: dict[tuple, list[int]] = {}
    paths: dict[tuple, tuple] = {}
    for s in run.scans:
        if s.level >= 2 and s.path:
            k = _key(s.path)
            groups.setdefault(k, []).append(s.index)
            paths.setdefault(k, s.path)
    if not groups:
        raise UserError("err.tree.noPath", text="the file has no MSn scans with the fragmentation path in the filter (an MS3 or higher file is needed)")
    if max(len(k) for k in groups) < 2:
        raise UserError("err.tree.needStages", text="the tree needs MSn files with at least two fragmentation stages (MS3 or higher)")
    if len(groups) > 400:
        raise UserError("err.tree.tooMany", {"n": len(groups)}, f"{len(groups)} fragmentation paths: too many for a tree")
    pol = next((s.polarity for s in run.scans if s.polarity), 1)
    ion1 = "[M]+" if pol >= 0 else "[M]-"
    ms1 = [s.index for s in run.scans if s.level == 1][:MAX_SCANS]
    cons = {k: consensus(run, idx[:MAX_SCANS]) for k, idx in groups.items()}
    ms1c = consensus(run, ms1) if ms1 else None
    order = sorted(groups, key=lambda k: (len(k), k))
    nodes: list[dict] = []
    pos: dict[tuple, int] = {}
    for k in order:
        nom = k[-1][0]
        par = k[:-1]
        pk = next((q for q in pos if q == par), None)
        if pk is None and par:    # same nominal masses, other energy
            pk = next((q for q in pos if len(q) == len(par) and all(a[0] == b[0] for a, b in zip(q, par))), None)
        src = cons[pk] if pk is not None else ms1c
        prec = None
        if src is not None and len(src[0]):
            sel = np.abs(src[0] - nom) <= 0.5
            if sel.any():
                prec = float(src[0][sel][np.argmax(src[1][sel])])
        pnode = nodes[pos[pk]] if pk is not None else None
        ptxt = pnode["formula"] if pnode else (formula or None)
        els = elements or (None if ptxt else ROOT_ELEMENTS)
        if ptxt and not els:
            els = {e: (0, n) for e, n in _parse(ptxt).items()}
        best = _best(prec, ion1, ptxt if pnode else (formula or None), els, ppm, None if ptxt else ROOT_RULES) if prec else None
        form = best["formula"] if best else None
        mz, it, nsc = cons[k]
        top = np.argsort(-it)[:MAX_PEAKS]
        top = top[np.argsort(mz[top])]
        mx = float(it.max()) if len(it) else 1.0
        peaks = []
        for j in top:
            c = None
            if form and it[j] >= 0.02 * mx:
                c = _best(float(mz[j]), ion1, form, {e: (0, n) for e, n in _parse(form).items()}, ppm)
            heavy = prec is not None and mz[j] > prec + 1.5
            peaks.append({"mz": round(float(mz[j]), 5), "rel": round(float(it[j] / mx * 100), 1), "formula": c["formula"] if c else None,
                          "ppm": c["delta_ppm"] if c else None, "contam": bool(heavy or (form and it[j] >= 0.05 * mx and not c))})
        real = [p for p in peaks if p["formula"] and p["rel"] >= 5 and (prec is None or p["mz"] < prec - 0.5)]   # fragments that are sub-formulas of the node
        node = {"id": len(nodes), "parent": pos[pk] if pk is not None else None, "path": [[m, a, ce] for m, a, ce in paths[k]],
                "label": " > ".join(f"{m:g}@{a.lower()}{ce:g}" for m, a, ce in paths[k]), "level": len(k) + 1, "scans": len(groups[k]),
                "prec": None if prec is None else round(prec, 5), "formula": form, "ppm": best["delta_ppm"] if best else None,
                "n_peaks": len(mz), "empty": len(real) < 2, "peaks": peaks}
        pos[k] = len(nodes)
        nodes.append(node)
    cands: list[str] = []
    if not formula and nodes and nodes[0]["prec"]:      # the first stage is only a guess without the formula: offer the alternatives
        try:
            r = compose(nodes[0]["prec"], elements=ROOT_ELEMENTS, ion=ion1, tol=ppm, rules=ROOT_RULES, rdb=(-0.5, 100.0), max_results=8)
            cands = [x["formula"] for x in r["results"]]
        except ValueError:
            pass
    return {"ion": ion1, "n_nodes": len(nodes), "nodes": nodes, "formula_given": bool(formula), "root_candidates": cands}
