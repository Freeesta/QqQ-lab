# TPMINE-PRIVATE
"""SMILES -> heavy-atom graph and the substructures reachable by cutting up to a few bonds, as uint64 atom bitmasks (WP3).

The tokenizer is the one of tpmine.chem.smiles_formula (organic subset, brackets, aromatic atoms). The enumeration state is (atom mask, cut
bonds inside the mask), not the mask alone: opening a ring is a cut that does not separate the molecule, and a fragment that needs two cuts in
the same ring is reached only through that intermediate state. numpy only."""
from __future__ import annotations

import re

import numpy as np

from mzlab.chem import elements as E

from .formula import VALENCE, element_order

MAX_ATOMS = 64
_ATOM = re.compile(r"\[([^\]]+)\]|(Cl|Br|[BCNOPSFI]|[bcnops])|(=|#|:|-|/|\\|\.|\(|\)|%\d\d|\d|\$)")
_BRACKET = re.compile(r"(?:\d+)?([A-Z][a-z]?|[a-z]{1,2})(?:@+)?(?:H(\d*))?([+-]+\d*)?(?::\d+)?$")
_NORMAL = {"B": 3, "C": 4, "N": 3, "O": 2, "P": 3, "S": 2, "F": 1, "Cl": 1, "Br": 1, "I": 1}


class Mol:
    """Heavy-atom graph: atoms (element symbols), bonds (i, j, order; 1.5 = aromatic), implicit/explicit hydrogens per atom."""

    def __init__(self, atoms, bonds, hyd):
        self.atoms, self.bonds, self.H = atoms, bonds, np.asarray(hyd, dtype=np.int64)
        self.n = len(atoms)
        self.adj = [[] for _ in range(self.n)]
        for k, (a, b, _) in enumerate(bonds):
            self.adj[a].append((b, k))
            self.adj[b].append((a, k))

    def formula(self) -> dict:
        f: dict = {}
        for a in self.atoms:
            f[a] = f.get(a, 0) + 1
        if self.H.sum():
            f["H"] = int(self.H.sum())
        return f

    def ring_bonds(self) -> np.ndarray:
        """Bonds that lie on a ring (cutting one does not disconnect the molecule)."""
        out = np.zeros(len(self.bonds), bool)
        for k, (a, b, _) in enumerate(self.bonds):
            seen, st = {a}, [a]
            while st and b not in seen:
                u = st.pop()
                for v, kk in self.adj[u]:
                    if kk != k and v not in seen:
                        seen.add(v)
                        st.append(v)
            out[k] = b in seen
        return out

    def rings(self) -> list[list[int]]:
        """Atom lists of the smallest rings (one per independent cycle found with a BFS from each ring bond; duplicates removed)."""
        found, seen = [], set()
        for k, (a, b, _) in enumerate(self.bonds):
            prev, q, hit = {a: None}, [a], False
            while q and not hit:
                nq = []
                for u in q:
                    for v, kk in self.adj[u]:
                        if kk == k or v in prev:
                            continue
                        prev[v] = u
                        if v == b:
                            hit = True
                            break
                        nq.append(v)
                    if hit:
                        break
                q = nq
            if hit:
                ring, u = [], b
                while u is not None:
                    ring.append(u)
                    u = prev[u]
                key = frozenset(ring)
                if key not in seen:
                    seen.add(key)
                    found.append(sorted(ring))
        return found


def parse_smiles(smiles: str) -> Mol:
    """SMILES -> Mol. Salts and disconnected parts are rejected (a fragmentation graph needs one molecule)."""
    s = smiles.strip()
    atoms: list[dict] = []
    bonds: list[tuple] = []
    stack: list[int] = []
    prev = None
    order, explicit = 1.0, False
    rings: dict = {}
    pos = 0
    while pos < len(s):
        m = _ATOM.match(s, pos)
        if not m:
            raise ValueError(f"SMILES not recognised near «{s[pos:pos + 6]}»")
        pos = m.end()
        br, org, tok = m.groups()
        if br or org:
            if br:
                mm = _BRACKET.match(br)
                if not mm:
                    raise ValueError(f"bracket atom not recognised: [{br}]")
                el = mm.group(1)
                h = 0 if mm.group(2) is None else (int(mm.group(2)) if mm.group(2) else 1)
                atoms.append({"el": el.capitalize(), "arom": el.islower(), "h": h})
            else:
                atoms.append({"el": org.capitalize(), "arom": org.islower(), "h": None})
            i = len(atoms) - 1
            if prev is not None:
                bonds.append([prev, i, order, explicit])
            prev, order, explicit = i, 1.0, False
        elif tok == "(":
            stack.append(prev)
        elif tok == ")":
            prev = stack.pop()
        elif tok == ".":
            raise ValueError("the SMILES contains several separate molecules (salt or mixture): a single molecule is required")
        elif tok in ("=", "#", "-", ":"):
            order, explicit = {"=": 2.0, "#": 3.0, "-": 1.0, ":": 1.5}[tok], True
        elif tok in ("/", "\\"):
            pass
        elif tok.lstrip("%").isdigit():
            if tok in rings:
                j, o, ex = rings.pop(tok)
                bonds.append([j, prev, max(o, order), ex or explicit])
            else:
                rings[tok] = (prev, order, explicit)
            order, explicit = 1.0, False
    if rings:
        raise ValueError("unclosed ring in the SMILES")
    if len(atoms) > MAX_ATOMS:
        raise ValueError(f"localisation accepts at most {MAX_ATOMS} heavy atoms (the SMILES has {len(atoms)})")
    for el in {a["el"] for a in atoms}:
        if el not in E.MASS or el not in VALENCE:
            raise ValueError(f"element not supported: {el}")
    for b in bonds:                                           # aromatic bond: both atoms aromatic and no explicit bond symbol
        if b[2] == 1.0 and not b[3] and atoms[b[0]]["arom"] and atoms[b[1]]["arom"]:
            b[2] = 1.5
    n = len(atoms)
    used = np.zeros(n)
    for a, b, o, _ in bonds:
        used[a] += 1.0 if o == 1.5 else o
        used[b] += 1.0 if o == 1.5 else o
    hyd = []
    for i, a in enumerate(atoms):
        if a["h"] is not None:
            hyd.append(a["h"])
            continue
        extra = 1.0 if (a["arom"] and a["el"] in ("C", "N")) else 0.0         # the pi electron of an aromatic C or pyridine-type N
        val = _NORMAL.get(a["el"], 0)
        free = val - used[i] - extra
        if free < 0 and a["el"] in ("N", "P", "S"):                            # hypervalent N, P, S: the next normal valence
            free = next((v - used[i] - extra for v in {"N": (5,), "P": (5,), "S": (4, 6)}[a["el"]] if v >= used[i] + extra), 0)
        hyd.append(max(0, int(round(free))))
    return Mol([a["el"] for a in atoms], [(int(a), int(b), float(o)) for a, b, o, _ in bonds], hyd)


def _components(mol: Mol, mask: int, cut: int) -> list[int]:
    seen, out = 0, []
    for s in range(mol.n):
        if not (mask >> s) & 1 or (seen >> s) & 1:
            continue
        c, st = 1 << s, [s]
        while st:
            u = st.pop()
            for v, k in mol.adj[u]:
                if (mask >> v) & 1 and not (c >> v) & 1 and not (cut >> k) & 1:
                    c |= 1 << v
                    st.append(v)
        seen |= c
        out.append(c)
    return out


def substructures(mol: Mol, max_cuts: int = 4, max_states: int = 400_000) -> "SubStructures":
    """Every connected set of heavy atoms reachable from the whole molecule by cutting at most `max_cuts` bonds (a cut inside a ring counts,
    and keeps the molecule in one piece). Returns masks (uint64), the fewest cuts that give each mask, and the per-atom bit matrix."""
    bonds = mol.bonds
    inside = [(1 << a) | (1 << b) for a, b, _ in bonds]
    full = (1 << mol.n) - 1
    best = {full: 0}
    state0 = (full, 0)
    seen = {state0}
    frontier = [state0]
    for depth in range(1, max_cuts + 1):
        nxt = []
        for mask, cut in frontier:
            for k, (a, b, _) in enumerate(bonds):
                if (cut >> k) & 1 or not ((mask >> a) & 1 and (mask >> b) & 1):
                    continue
                c2 = cut | (1 << k)
                for comp in _components(mol, mask, c2):
                    internal = sum(1 << kk for kk in range(len(bonds)) if (c2 >> kk) & 1 and (comp & inside[kk]) == inside[kk])
                    st = (comp, internal)
                    if st in seen:
                        continue
                    seen.add(st)
                    nxt.append(st)
                    best.setdefault(comp, depth)
                    if len(seen) > max_states:
                        raise ValueError("too many substructures: reduce the cuts or the molecule")
        frontier = nxt
    masks = np.array(list(best.keys()), dtype=np.uint64)
    cuts = np.array(list(best.values()), dtype=np.int64)
    return SubStructures(mol, masks, cuts)


class SubStructures:
    """Masks of the substructures with their neutral formulas (heavy atoms + the hydrogens they carry) and the fewest cuts needed."""

    def __init__(self, mol: Mol, masks: np.ndarray, cuts: np.ndarray):
        self.mol, self.masks, self.cuts = mol, masks, cuts
        self.els = element_order(mol.formula())
        self.bits = ((masks[:, None] >> np.arange(mol.n, dtype=np.uint64)) & np.uint64(1)).astype(np.int64)         # (F, n)
        onehot = np.array([[a == e for e in self.els] for a in mol.atoms], dtype=np.int64)
        F = self.bits @ onehot
        F[:, self.els.index("H")] = self.bits @ mol.H
        self.F = F                                                                  # (F, n_elements) formulas of the neutral substructures

    def __len__(self):
        return len(self.masks)

    def candidates(self, ion, lam_cut: float = 3.0, lam_h: float = 1.0, h_flex: int = 3):
        """Substructures that can be the ion with this element vector (same heavy atoms; |H_sub + 1 - H_ion| <= h_flex) and their weights
        w = exp(-lam_cut (cuts - cuts_min) - lam_h |dH|), normalised to sum 1. lam_cut = 3, lam_h = 1 were measured on real spectra (with
        lam_cut = 1 the localisation of hydroxylated products goes wrong)."""
        ion = np.asarray(ion, dtype=np.int64)
        iH = self.els.index("H")
        heavy = [i for i in range(len(self.els)) if i != iH]
        ok = np.all(self.F[:, heavy] == ion[heavy], axis=1) & (np.abs(self.F[:, iH] + 1 - ion[iH]) <= h_flex)
        idx = np.flatnonzero(ok)
        if len(idx) == 0:
            return idx, np.zeros(0)
        dh = np.abs(self.F[idx, iH] + 1 - ion[iH])
        w = np.exp(-lam_cut * (self.cuts[idx] - self.cuts[idx].min()) - lam_h * dh)
        return idx, w / w.sum()

    def describe(self, i: int) -> str:
        return "".join(f"{a}{j}" for j, a in enumerate(self.mol.atoms) if (int(self.masks[i]) >> j) & 1)
