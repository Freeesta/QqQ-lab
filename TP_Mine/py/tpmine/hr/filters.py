# TPMINE-PRIVATE
"""Candidate filters of the high-resolution path (WP5): what appears with the treatment, is not an isotopologue, can be a transformation product
of the parent, is not flat; and the products hidden under an in-source fragment of the parent. numpy only, no loops over features."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from qqq_lab import ionfamily

from . import formula as F
from .features import Alignment, Features

EPS_FACTOR = 0.3          # eps = EPS_FACTOR x min_height (counts x s): the area of a minimal peak; 6e4 for the Orbitrap floor, as in the measured funnel
ISOTOPE_DELTAS = (1.003355, 1.99580, 2.00671)       # 13C, 34S, 18O: distance of the isotopologue below the monoisotopic ion
ISOTOPE_MAX_RATIO = (0.35, 0.15, 0.10)              # the isotopologue cannot exceed this fraction of the light ion (C up to 30, one S, three O)


@dataclass
class Funnel:
    """Result of `run_filters`: the surviving rows of the alignment and the count after every step (for the interface)."""
    idx: np.ndarray                                      # rows of the Alignment that survived all the steps
    steps: list = field(default_factory=list)            # [{"name", "text", "n"}]
    fold: np.ndarray | None = None                       # per row of the Alignment: treated maximum / (reference + eps)
    reference: np.ndarray | None = None
    n_treated: np.ndarray | None = None
    isotopologue: np.ndarray | None = None               # rows removed as isotopologues (bool over the Alignment)


def split_columns(times, types=None) -> tuple[np.ndarray, np.ndarray]:
    """(reference, treated) column indices: reference = dark / t0 (time <= 0) and blanks / controls; treated = time > 0 of a sample."""
    times = np.asarray(times, float)
    types = ["sample"] * len(times) if types is None else list(types)
    ref = np.array([t <= 0 or ty in ("blank", "control") for t, ty in zip(times, types)])
    tr = np.array([t > 0 and ty in ("sample", None) for t, ty in zip(times, types)]) & ~ref
    return np.flatnonzero(ref), np.flatnonzero(tr)


def reference_area(al: Alignment, ref_feats: list[Features], ppm: float = 5.0, rt_tol: float = 0.15) -> np.ndarray:
    """For every group, the largest area of a feature of the reference files within `ppm` and `rt_tol` minutes of the group (artefacts excluded).
    Independent of how the groups were cut: a feature of the dark file that sits beside the group counts as 'already there'."""
    out = np.zeros(len(al))
    for f in ref_feats:
        o = np.argsort(f.mz, kind="stable")
        mz = f.mz[o]
        lo = np.searchsorted(mz, al.mz * (1 - ppm * 1e-6), "left")
        hi = np.searchsorted(mz, al.mz * (1 + ppm * 1e-6), "right")
        n = hi - lo
        g = np.repeat(np.arange(len(al)), n)
        j = o[np.arange(int(n.sum())) - np.repeat(np.cumsum(n) - n, n) + np.repeat(lo, n)]
        ok = (np.abs(f.rt[j] - al.rt[g]) <= rt_tol) & ~f.artefact[j]
        np.maximum.at(out, g[ok], f.area[j][ok])
    return out


def isotopologue_mask(al: Alignment, idx: np.ndarray, strength: np.ndarray, rt_tol: float = 0.05, tol_da: float = 0.003, ratio: float = 1.5,
                      deltas=ISOTOPE_DELTAS, max_ratios=ISOTOPE_MAX_RATIO) -> np.ndarray:
    """True for the rows idx that are an isotopologue: a group `ratio` times stronger lies at -1.003355, -1.99580 or -2.00671 with the apex within
    `rt_tol` minutes, and the area ratio is one natural abundance allows (13C: up to 0.35 of the light ion, 34S: 0.15, 18O: 0.10). Without that
    second condition a product that merely sits one mass unit above a stronger ion (a hydroxylated product 15.995 above ... or a product of the
    same chain) is lost. `strength` = largest treated area of every group."""
    o = np.argsort(al.mz, kind="stable")
    mz, rt, st = al.mz[o], al.rt[o], strength[o]
    out = np.zeros(len(idx), bool)
    for d, mr in zip(deltas, max_ratios):
        lo = np.searchsorted(mz, al.mz[idx] - d - tol_da, "left")
        hi = np.searchsorted(mz, al.mz[idx] - d + tol_da, "right")
        n = hi - lo
        g = np.repeat(np.arange(len(idx)), n)
        j = np.arange(int(n.sum())) - np.repeat(np.cumsum(n) - n, n) + np.repeat(lo, n)
        ok = (np.abs(rt[j] - al.rt[idx][g]) <= rt_tol) & (st[j] > ratio * strength[idx][g]) & (strength[idx][g] <= mr * st[j])
        out[np.unique(g[ok])] = True
    return out


def tp_space(parent_ion: dict, extra_o: int = 6, max_rdbe_over: float = 1.0) -> tuple[F.FormulaSpace, list[str]]:
    """Formulas a transformation product of the parent can have: C, N, S, halogens <= parent; O <= parent + extra_o; H <= 2C + N + 3; closed-shell
    cation with -0.5 <= RDBE <= RDBE(parent) + 1."""
    els = F.element_order(parent_ion)
    top = F.vec(parent_ion, els)
    upper = top.copy()
    upper[els.index("O")] += extra_o
    upper[els.index("H")] = 2 * top[els.index("C")] + top[els.index("N")] + 3 + (sum(top[i] for i, e in enumerate(els) if e in F.HALOGENS))
    return F.FormulaSpace(upper, els, h_rule=True, min_rdbe=-0.5, max_rdbe=float(F.rdbe(top, els)) + max_rdbe_over, closed_only=True), els


def formula_feasible(mz: np.ndarray, space: F.FormulaSpace, ppm: float = 3.0) -> np.ndarray:
    return space.count(np.asarray(mz, float), ppm) > 0


def flat_mask(treated_area: np.ndarray, ratio: float = 3.0, min_present: int = 4) -> np.ndarray:
    """True where max / min over the treated samples that have the feature is below `ratio` AND the feature is present in at least `min_coverage` of
    the treated samples: a profile that does not change with the treatment. A product seen in 2-3 samples only, with similar areas, is a transient,
    not a flat profile (with max/min alone, 4 of the 17 reference products were lost)."""
    a = np.where(treated_area > 0, treated_area, np.inf)
    mn = a.min(1)
    mx = treated_area.max(1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return ((mx / mn) < ratio) & ((treated_area > 0).sum(1) >= min_present)


def run_filters(al: Alignment, feats: list[Features], times, types=None, parent_ion: dict | None = None, *, fold: float = 5.0, min_treated: int = 2,
                rt_min: float = 0.7, min_height: float = 2e5, ppm: float = 5.0, rt_tol: float = 0.15, feasible_ppm: float = 3.0, flat_ratio: float = 3.0) -> Funnel:
    """Steps (the count after each is in `Funnel.steps`):
    1. fold = largest treated area / (largest reference area + eps) > `fold`, in at least `min_treated` treated samples, RT after `rt_min`;
    2. isotopologues (13C, 34S, 18O of a stronger feature with the same apex) removed;
    3. formula feasibility against the parent (if a parent ion is given): a formula within 3 ppm that a product can have;
    4. flat profiles (max / min over the treated < `flat_ratio`) removed."""
    ref_c, tr_c = split_columns(times, types)
    if len(tr_c) == 0:
        raise ValueError("servono campioni trattati (tempo > 0) per cercare ciò che compare con il trattamento")
    ref = reference_area(al, [feats[k] for k in ref_c], ppm, rt_tol) if len(ref_c) else np.zeros(len(al))
    eps = EPS_FACTOR * min_height
    amax = al.area[:, tr_c].max(1)
    fl = amax / (ref + eps)
    ntr = (al.area[:, tr_c] > 0).sum(1)
    steps = [{"name": "gruppi", "text": "gruppi (m/z, RT) di tutti i file", "n": int(len(al))}]
    sel = (fl > fold) & (ntr >= min_treated) & (al.rt > rt_min)
    idx = np.flatnonzero(sel)
    steps.append({"name": "compare", "text": f"compaiono con il trattamento (> {fold:g} volte il buio/t0, in ≥ {min_treated} campioni)", "n": int(len(idx))})
    iso = isotopologue_mask(al, idx, amax)
    isomask = np.zeros(len(al), bool)
    isomask[idx[iso]] = True
    idx = idx[~iso]
    steps.append({"name": "isotopologhi", "text": "senza isotopologhi di un segnale più forte", "n": int(len(idx))})
    if parent_ion:
        space, _ = tp_space(parent_ion)
        idx = idx[formula_feasible(al.mz[idx], space, feasible_ppm)]
        steps.append({"name": "formula", "text": f"con una formula possibile derivata dal progenitore ({feasible_ppm:g} ppm)", "n": int(len(idx))})
    idx = idx[~flat_mask(al.area[idx][:, tr_c], flat_ratio)]
    steps.append({"name": "piatti", "text": f"senza profili piatti (massimo/minimo < {flat_ratio:g})", "n": int(len(idx))})
    return Funnel(idx=idx, steps=steps, fold=fl, reference=ref, n_treated=ntr, isotopologue=isomask)


# ---------------------------------------------------------------------------------------------------------------------- hidden under an ISF
def _smooth3(y: np.ndarray) -> np.ndarray:
    return np.convolve(y, np.array([1.0, 2.0, 1.0]) / 4.0, mode="same")


def parent_window(table, parent_mz: float, ppm: float = 5.0, floor_rel: float = 0.05, max_min: float = 2.0, rt_hint: float | None = None,
                  rt_tol: float = 0.5) -> dict | None:
    """Peak of the parent in the MS1 table of one file, from its XIC: apex (within `rt_tol` of `rt_hint` when given: after the treatment the
    parent can be gone and the strongest trace of that m/z belongs to something else), and the scans around it where the trace stays above
    `floor_rel` of the apex (at most `max_min` minutes each side). None when the parent is not there."""
    y = table.xic(parent_mz, parent_mz * ppm * 1e-6)
    if len(y) < 5 or y.max() <= 0:
        return None
    ys = _smooth3(y)
    if rt_hint is not None:
        ok = np.abs(table.rt - rt_hint) <= rt_tol
        if not ok.any() or ys[ok].max() <= 0:
            return None
        ys = np.where(ok, ys, 0.0)
    a = int(np.argmax(ys))
    thr = floor_rel * ys[a]
    below = ys < thr
    left = np.flatnonzero(below[:a])
    right = np.flatnonzero(below[a:])
    i0 = int(left[-1]) + 1 if len(left) else 0
    i1 = a + int(right[0]) - 1 if len(right) else len(y) - 1
    lim = max_min
    i0 = max(i0, int(np.searchsorted(table.rt, table.rt[a] - lim)))
    i1 = min(i1, int(np.searchsorted(table.rt, table.rt[a] + lim, "right")) - 1)
    return {"apex": a, "i0": i0, "i1": max(i1, i0), "rt": float(table.rt[a])}


def isf_measure(table, masses, parent_mz: float, ppm: float = 5.0, rt_hint: float | None = None) -> dict | None:
    """Area (counts x s) of the parent and of every mass in `masses` inside the window of the parent's peak, and the apex of each relative to the
    parent's (in scans), for ONE file. XIC at `ppm` of the exact m/z, not features: an ion that sits under the parent's tail is below the
    feature threshold but its trace is there."""
    w = parent_window(table, parent_mz, ppm, rt_hint=rt_hint)
    if w is None:
        return None
    sl = slice(w["i0"], w["i1"] + 1)
    rt = table.rt[sl] * 60.0
    area = lambda y: float(np.trapezoid(y[sl], rt)) if len(rt) > 1 else float(y[sl].sum())
    yp = table.xic(parent_mz, parent_mz * ppm * 1e-6)
    areas, shifts, heights = [], [], []
    ap_p = int(np.argmax(_smooth3(yp[sl])))
    for m in masses:
        y = table.xic(float(m), float(m) * ppm * 1e-6)
        areas.append(area(y))
        ys = _smooth3(y[sl])
        heights.append(float(y[sl].max()) if len(rt) else 0.0)
        shifts.append(int(np.argmax(ys)) - ap_p if ys.max() > 0 else 0)
    return {"parent_area": area(yp), "parent_rt": w["rt"], "areas": np.array(areas), "apex_shift": np.array(shifts), "heights": np.array(heights), "n_scans": int(w["i1"] - w["i0"] + 1),
            "ion_rt": [float(table.rt[w["i0"] + int(np.argmax(_smooth3(table.xic(float(m), float(m) * ppm * 1e-6)[sl])))]) for m in masses]}


def isf_hidden(measures: list, times, types=None, masses=None, sessions=None, *, min_parent_area: float = 1e7, rel_se: float = 0.05, z_min: float = 3.0,
               min_samples: int = 2, shift_scans: int = 10, floor_area: float = 3e5, min_ion_area: float = 2e5, min_ion_height: float = 5e4) -> list[dict]:
    """Candidates 'possible product co-eluting with an in-source fragment (ISF)': for each mass, the ratio r = area(ion) / area(parent) in the window
    of the parent's peak of every sample. In dark / t0 the ratio is the fragmentation in the source alone; it can differ between measurement
    sessions (pass `sessions`, one label per file: a treated sample is then compared with the references of its own session when there are any).
    A mass is a candidate when, in at least `min_samples` treated samples, r exceeds the reference ratio by `z_min` standard errors (se =
    sqrt((rel_se r)^2 + (floor_area / A_parent)^2); the ion area must be above `min_ion_area`), or the ion has a peak of its own (height above
    `min_ion_height`) whose apex is `shift_scans` scans or more away from the parent's apex than in the reference (an ion made during the
    treatment elutes at its own time, a fragment of the parent cannot; measured: the apex of a pure fragment moves by up to 7 scans with the
    flat top of a saturated parent). The constancy
    of r across all samples is reported with `ionfamily.ratio_constancy`. `measures[k]` = `isf_measure` of file k, or None."""
    ref_c, tr_c = split_columns(times, types)
    masses = np.asarray(masses, float)
    sess = list(sessions) if sessions is not None else [None] * len(measures)
    out = []
    for j, m in enumerate(masses):
        r = np.full(len(measures), np.nan)
        se = np.full(len(measures), np.nan)
        sh = np.full(len(measures), np.nan)
        ia = np.zeros(len(measures))
        ih = np.zeros(len(measures))
        for k, ms in enumerate(measures):
            if ms is None or ms["parent_area"] < min_parent_area:
                continue
            r[k] = ms["areas"][j] / ms["parent_area"]
            se[k] = np.hypot(rel_se * r[k], floor_area / ms["parent_area"])
            sh[k] = ms["apex_shift"][j]
            ia[k] = ms["areas"][j]
            ih[k] = ms["heights"][j]
        rr_all = [k for k in ref_c if np.isfinite(r[k])]
        tt = [k for k in tr_c if np.isfinite(r[k])]
        if not rr_all or len(tt) < 1:
            continue
        z, d_shift, used, own = [], [], [], []
        for k in tt:
            rr = [q for q in rr_all if sess[q] == sess[k]] or rr_all
            w = 1.0 / se[rr] ** 2
            r0 = float((w * r[rr]).sum() / w.sum())
            se0 = float(np.sqrt(1.0 / w.sum()))
            z.append((r[k] - r0) / np.hypot(se[k], se0))
            d_shift.append(sh[k] - float(np.nanmedian(sh[rr])))
            used.append(ia[k] >= min_ion_area)
            own.append(ih[k] >= min_ion_height)
        z, d_shift, used, own = np.array(z), np.array(d_shift), np.array(used), np.array(own)
        n_up = int(((z > z_min) & used).sum())
        n_shift = int(((np.abs(d_shift) >= shift_scans) & own).sum())
        w = 1.0 / se[rr_all] ** 2
        r0 = float((w * r[rr_all]).sum() / w.sum())
        cons = ionfamily.ratio_constancy(r[[*rr_all, *tt]], se[[*rr_all, *tt]])
        out.append({"mz": float(m), "ratio_reference": r0, "ratio_treated_median": float(np.median(r[tt])), "n_up": n_up, "n_shift": n_shift,
                    "apex_shift_treated_median": float(np.median(d_shift)), "q": cons.get("q"), "p_constant": cons.get("p"),
                    "candidate": bool(n_up >= min_samples or n_shift >= min_samples), "z_max": float(z.max())})
    return out


def isf_coincident(al: Alignment, idx: np.ndarray, library_mz, parent_rt: float, ppm: float = 5.0, rt_window: float = 0.5) -> np.ndarray:
    """True for the candidates (rows idx) whose m/z is one of the parent's fragment masses (`library_mz`) and that elute within `rt_window` of the
    parent: the mass could also be an in-source fragment, so the candidate is shown as 'possible product co-eluting with an ISF'."""
    lib = np.sort(np.asarray(library_mz, float))
    if len(lib) == 0 or len(idx) == 0:
        return np.zeros(len(idx), bool)
    m = al.mz[idx]
    j = np.clip(np.searchsorted(lib, m), 1, len(lib) - 1) if len(lib) > 1 else np.zeros(len(idx), int)
    near = np.minimum(np.abs(lib[np.maximum(j - 1, 0)] - m), np.abs(lib[np.minimum(j, len(lib) - 1)] - m))
    return (near <= m * ppm * 1e-6) & (np.abs(al.rt[idx] - parent_rt) <= rt_window)
