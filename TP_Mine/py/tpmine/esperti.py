# TPMINE-PRIVATE
"""mzFinder M2: expert tools on the difference map (A - B). Only numpy; the page gathers the numbers (difference grid, XICs of every file)
and this module decides what to look at. Everything it returns is a CANDIDATE with the numeric proof next to it, never a certainty:

- find_points   local maxima of A - B above thresholds (S/N in A, ratio A/B, minimum width);
- group_points  co-elution groups: apexes close in time AND Pearson r of the XIC shapes (+-0.3 min) at least r_min;
- assign_roles  inside a group: isotope / adduct / in-source fragment of another member, with the numbers that support it;
- trend_shape   area over the time of the experiment: grows | grows then falls | falls | constant;
- analyse       all of the above for a list of points, one row per point (the table of mzFinder).
The in-source-fragment filter (ratio of the areas constant in time, RSD < 15 %) is applied ONLY to ions that co-elute (apexes within 0.05 min)
and gives «possible in-source fragment», nothing more."""
from __future__ import annotations

import base64
import math

import numpy as np

from mzlab.chem import elements as EL

ISO_LR = 1.0                 # nominal spacing of the isotope peak
ISO_HR = 1.00336             # 13C - 12C
ADDUCTS = {"Na-H": 21.9819, "NH4-H": 17.0265, "K-H": 37.9559}      # [M+X]+ - [M+H]+
PROTON = 1.00728
LR_TOL = 0.35                # |delta m/z| tolerance of the relations at unit resolution (the map bins are 0.1-1 Da wide)
SOGLIE = {"min_sn": 5.0, "min_ratio": 3.0, "min_width": 0.03, "max_points": 60, "apex_tol": 0.05, "r_min": 0.9, "rsd_max": 0.15, "ppm": 5.0}


def soglie(user: dict | None = None) -> dict:
    out = dict(SOGLIE)
    for k, v in (user or {}).items():
        if k in out and v is not None and math.isfinite(float(v)):
            out[k] = float(v)
    return out


def _grid(b64: str, nrt: int, nmz: int) -> np.ndarray:
    return np.frombuffer(base64.b64decode(b64), dtype="<f4").reshape(nrt, nmz).astype(np.float64)


def build_grid(t, rt0: float, drt: float, nrt: int, mz0: float, dmz: float, nmz: int, win: int = 0, block: int = 128) -> np.ndarray:
    """The map grid of a PeakTable (same layout as the page's: rows = RT bins, columns = m/z bins) as float32: the intensity summed in each cell, averaged
    over the scans that fall in the RT bin; win > 0 smooths the columns with a triangular kernel of radius ~win bins (two boxes of win // 2) (an XIC-like window whose maximum sits
    on the centroid of an ion, not on a plateau). A map of more than 6 million cells is filled `block` rows at a time."""
    out = np.zeros((nrt, nmz), np.float32)
    if not len(t.rt) or not len(t.mz):
        return out
    sbin = np.floor((np.asarray(t.rt, float) - rt0) / drt).astype(np.int64)         # RT bin of every scan (-1: outside the map)
    sbin[(sbin < 0) | (sbin >= nrt)] = -1
    scans = np.bincount(sbin[sbin >= 0], minlength=nrt).astype(np.float64)
    rb = sbin[t.pos]
    jb = np.clip(((np.asarray(t.mz) - mz0) * (1.0 / dmz)).astype(np.int64), 0, nmz - 1)
    w = np.asarray(t.inten)
    if (rb < 0).any():
        keep = rb >= 0
        rb, jb, w = rb[keep], jb[keep], w[keep]
    small = nrt * nmz <= 6_000_000
    if not small:
        o = np.argsort(rb, kind="stable")
        rb, jb, w = rb[o], jb[o], w[o]
    for r0 in range(0, nrt, nrt if small else block):
        r1 = min(r0 + (nrt if small else block), nrt)
        if small:
            idx, ww = rb * nmz + jb, w
        else:
            a, b = np.searchsorted(rb, r0), np.searchsorted(rb, r1)
            if b <= a:
                continue
            idx, ww = (rb[a:b] - r0) * nmz + jb[a:b], w[a:b]
        g = np.bincount(idx, weights=ww, minlength=(r1 - r0) * nmz).reshape(r1 - r0, nmz)
        g = (g / np.maximum(scans[r0:r1], 1.0)[:, None]).astype(np.float32)
        for _ in range(2 if win > 0 else 0):          # two boxes of radius win // 2 = one triangle of radius ~win
            h, acc = max(win // 2, 1), g.copy()
            for d in range(1, h + 1):
                acc[:, d:] += g[:, :-d]
                acc[:, :-d] += g[:, d:]
            g = acc
        out[r0:r1] = g
    return out


# ---------------------------------------------------------------------------------------------------------------- 1. points
def find_points(diff: np.ndarray, a: np.ndarray, rt0: float, rt1: float, mz0: float, dmz: float, th: dict | None = None) -> list[dict]:
    """Local maxima of the difference (3 x 3 neighbourhood, strictly above its neighbours on the right/below to give one point per plateau).
    diff, a: arrays (nrt, nmz) = A - B and A. S/N of A: (A - median) / (1.4826 x MAD) over the cells that hold signal; ratio = A / (A - diff);
    width = minutes where the difference stays above half of the maximum along RT."""
    th = soglie(th)
    nrt, nmz = diff.shape
    if nrt < 3 or nmz < 3:
        return []
    drt = (rt1 - rt0) / nrt
    pos = a[a > 0]
    med = float(np.median(pos)) if pos.size else 0.0
    mad = float(np.median(np.abs(pos - med))) * 1.4826 if pos.size else 0.0
    p = np.pad(diff, 1, constant_values=-np.inf)
    cen = p[1:-1, 1:-1]
    ok = cen > 0
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            if di == dj == 0:
                continue
            nb = p[1 + di:1 + di + nrt, 1 + dj:1 + dj + nmz]
            ok &= (cen > nb) if (di, dj) > (0, 0) else (cen >= nb)
    ii, jj = np.nonzero(ok)
    ia_v, d_v = a[ii, jj], diff[ii, jj]
    b_v = ia_v - d_v
    with np.errstate(divide="ignore", invalid="ignore"):
        keep = np.where(b_v > 0, ia_v / b_v, np.inf) >= th["min_ratio"]
        if mad > 0:
            keep &= (ia_v - med) / mad >= th["min_sn"]
    out = []
    for i, j in zip(ii[keep], jj[keep]):
        ia, d = float(a[i, j]), float(diff[i, j])
        b = ia - d
        ratio = ia / b if b > 0 else math.inf
        sn = (ia - med) / mad if mad > 0 else None
        lo = hi = i
        while lo > 0 and diff[lo - 1, j] >= d / 2:
            lo -= 1
        while hi < nrt - 1 and diff[hi + 1, j] >= d / 2:
            hi += 1
        width = (hi - lo + 1) * drt
        if width < th["min_width"]:
            continue
        out.append({"rt": rt0 + (i + 0.5) * drt, "mz": mz0 + (j + 0.5) * dmz, "diff": d, "ia": ia, "ratio": None if math.isinf(ratio) else ratio, "sn": sn, "width": width})
    out.sort(key=lambda r: -r["diff"])
    return out[: int(th["max_points"])]


# ---------------------------------------------------------------------------------------------------------------- 2. groups
def _shape(rt: np.ndarray, y: np.ndarray, centre: float, half: float, step: float = 0.01) -> np.ndarray:
    g = np.arange(centre - half, centre + half + step / 2, step)
    if len(rt) < 2:
        return np.zeros_like(g)
    return np.interp(g, rt, y, left=0.0, right=0.0)


def pearson(rt_a, y_a, rt_b, y_b, centre: float, half: float = 0.3) -> float | None:
    """Pearson r of two XICs on a common grid of +-half minutes around `centre` (None when one of them is flat)."""
    u, v = _shape(np.asarray(rt_a, float), np.asarray(y_a, float), centre, half), _shape(np.asarray(rt_b, float), np.asarray(y_b, float), centre, half)
    if u.std() <= 0 or v.std() <= 0:
        return None
    return float(np.corrcoef(u, v)[0, 1])


def group_points(points: list[dict], th: dict | None = None) -> list[dict]:
    """points: [{rt, mz, ia, trace: {rt: [...], y: [...]}}] (the XIC of the file with the most intense apex). Adds g (1, 2, ... by RT), r (Pearson r with
    the most intense member of the group, 1 for that member, None when a shape is flat). Two points are joined when their apexes are within apex_tol
    AND r >= r_min (chained, union-find)."""
    th = soglie(th)
    n = len(points)
    par = list(range(n))

    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]
            i = par[i]
        return i
    for i in range(n):
        for j in range(i + 1, n):
            if abs(points[i]["rt"] - points[j]["rt"]) > th["apex_tol"]:
                continue
            ti, tj = points[i].get("trace"), points[j].get("trace")
            if not ti or not tj:
                continue
            r = pearson(ti["rt"], ti["y"], tj["rt"], tj["y"], (points[i]["rt"] + points[j]["rt"]) / 2)
            if r is not None and r >= th["r_min"]:
                par[find(i)] = find(j)
    roots: dict[int, list[int]] = {}
    for i in range(n):
        roots.setdefault(find(i), []).append(i)
    order = sorted(roots.values(), key=lambda m: min(points[i]["rt"] for i in m))
    out = [dict(p) for p in points]
    for g, mem in enumerate(order, 1):
        top = max(mem, key=lambda i: points[i].get("ia") or 0)
        for i in mem:
            out[i]["g"] = g
            out[i]["top"] = (i == top)
            if i == top:
                out[i]["r"] = 1.0
            else:
                ti, tt = points[i].get("trace"), points[top].get("trace")
                out[i]["r"] = pearson(ti["rt"], ti["y"], tt["rt"], tt["y"], points[top]["rt"]) if ti and tt else None
    return out


# ---------------------------------------------------------------------------------------------------------------- 3. relations
def loss_masses(formulas: list[str]) -> list[tuple[str, float]]:
    out = []
    for f in formulas:
        try:
            out.append((f, EL.mass(EL.parse_formula(f))))
        except Exception:  # noqa: BLE001 -- a formula we cannot read is simply not a candidate loss
            pass
    return out


def _tol(mz: float, hr: bool, ppm: float) -> float:
    return mz * ppm * 1e-6 + 0.0005 if hr else LR_TOL


def _expected_m1(mz: float) -> float:
    """M+1/M expected from the number of carbons guessed from the mass (about one C every 13.5 Da for organic ions), 1.08 % of 13C each."""
    return min(1.2, 0.0108 * max(1.0, round(mz / 13.5)))


def relation(m: dict, n: dict, hr: bool, ppm: float, losses: list[tuple[str, float]], rsd_ok: tuple[bool, float | None] | None = None) -> dict | None:
    """Is `m` an isotope / adduct / in-source fragment of `n`? -> {role, of, proof} or None. Both are dicts with mz and ia (area)."""
    dm = m["mz"] - n["mz"]
    tol = _tol(m["mz"], hr, ppm)
    ppm_of = (lambda err: f"{err / m['mz'] * 1e6:+.1f} ppm") if hr else (lambda err: "")
    # isotope: +1 (LR) / +1.00336 (HR), with M+1/M of the right size
    iso = ISO_HR if hr else ISO_LR
    if abs(dm - iso) <= tol and n.get("ia"):
        ratio, exp = (m.get("ia") or 0) / n["ia"], _expected_m1(n["mz"])
        if 0.2 * exp <= ratio <= 4 * exp:
            return {"role": "isotopo", "of": n, "proof": f"Δ m/z {dm:+.4f}" + (f" ({ppm_of(dm - iso)})" if hr else "") + f"; M+1/M observed {ratio:.2f}, expected ≈ {exp:.2f}"}
    # adducts and dimer
    for name, d in ADDUCTS.items():
        if abs(dm - d) <= tol:
            return {"role": "addotto", "of": n, "proof": f"Δ m/z {dm:+.4f} = {name} ({d:.4f})" + (f", {ppm_of(dm - d)}" if hr else "")}
    dimer = 2 * n["mz"] - PROTON
    if abs(m["mz"] - dimer) <= tol * 2:
        return {"role": "addotto", "of": n, "proof": f"m/z {m['mz']:.4f} = [2M+H]+ of {n['mz']:.4f} (expected {dimer:.4f})"}
    # in-source fragment: n - m is a neutral loss of the table (co-elution is already required by the group)
    if dm < 0:
        for f, mass in losses:
            if abs(-dm - mass) <= tol:
                if rsd_ok is not None and not rsd_ok[0]:
                    continue
                extra = f"; constant area ratio (RSD {rsd_ok[1] * 100:.0f} %)" if rsd_ok and rsd_ok[1] is not None else ""
                return {"role": "frammento", "of": n, "loss": f, "proof": f"loss of {f} ({mass:.4f}): Δ m/z {dm:+.4f}" + (f", {ppm_of(dm + mass)}" if hr else "") + extra}
    return None


def area_ratio_rsd(sa: list[float], sb: list[float]) -> float | None:
    """RSD (std / mean) of the ratio of two area series over the files where both are present; None with fewer than 3 files."""
    a, b = np.asarray(sa, float), np.asarray(sb, float)
    ok = (a > 0) & (b > 0)
    if ok.sum() < 3:
        return None
    r = a[ok] / b[ok]
    return float(r.std() / r.mean())


def assign_roles(group: list[dict], hr: bool, ppm: float, losses: list[tuple[str, float]], th: dict | None = None) -> None:
    """Writes role / of / proof on every member of ONE group (modifies the dicts). Roles: main ion | isotope of n | adduct of n |
    in-source fragment of n | isolated (a group of one). Members are tried against the others from the most intense to the least."""
    th = soglie(th)
    if len(group) == 1:
        group[0].update(role="isolated", of=None, proof="")
        return
    order = sorted(group, key=lambda p: -(p.get("ia") or 0))
    top = order[0]
    top.update(role="main ion", of=None, proof="")
    for m in order[1:]:
        found = None
        for n in order:
            if n is m:
                continue
            rsd = None
            if m.get("series") and n.get("series"):
                v = area_ratio_rsd(m["series"], n["series"])
                rsd = (v is None or v < th["rsd_max"], v)
            found = relation(m, n, hr, ppm, losses, rsd)
            if found:
                break
        if found:
            lab = {"isotopo": "isotope of", "addotto": "adduct of", "frammento": "possible in-source fragment of"}[found["role"]]
            m.update(role=f"{lab} {found['of']['n']}", of=found["of"]["n"], proof=found["proof"], loss=found.get("loss"))
        else:
            m.update(role="main ion", of=None, proof="co-elutes but no relation found")


def subformula_proof(parent_forms: list[str], frag_forms: list[str], loss: str) -> str:
    """High resolution: does some formula of the parent minus the neutral loss equal some formula of the fragment? -> text of the proof or ''."""
    try:
        lo = EL.parse_formula(loss)
    except Exception:  # noqa: BLE001
        return ""
    for pf in parent_forms:
        try:
            d = dict(EL.parse_formula(pf))
        except Exception:  # noqa: BLE001
            continue
        for k, v in lo.items():
            d[k] = d.get(k, 0) - v
        if any(v < 0 for v in d.values()):
            continue
        d = {k: v for k, v in d.items() if v}
        for ff in frag_forms:
            try:
                if EL.parse_formula(ff) == d:
                    return f"sottoformula coerente: {pf} − {loss} = {ff}"
            except Exception:  # noqa: BLE001
                continue
    return ""


# ---------------------------------------------------------------------------------------------------------------- 4. time course
def trend_shape(times: list[float], areas: list[float]) -> str:
    """«rises» | «rises then falls» | «falls» | «constant» from the areas over the time of the experiment (steps of 20 % of the maximum)."""
    pairs = sorted((t, a) for t, a in zip(times, areas) if t is not None and a is not None)
    if len(pairs) < 3:
        return ""
    a = np.array([p[1] for p in pairs], float)
    mx = a.max()
    if mx <= 0 or (mx - a.min()) / mx < 0.2:
        return "constant"
    a = a / mx
    i = int(a.argmax())
    rise, fall = a[i] - a[0], a[i] - a[-1]
    if i == 0 or (rise < 0.2 and fall >= 0.2):
        return "falls"
    if i == len(a) - 1 or (fall < 0.2 and rise >= 0.2):
        return "rises"
    return "rises then falls" if rise >= 0.2 and fall >= 0.2 else "constant"


def window_area(rt, y, centre: float, half: float = 0.15) -> float:
    """Area of an XIC around `centre` (+-half min), above the lowest point of the window (trapezoids; intensity x minutes)."""
    rt, y = np.asarray(rt, float), np.asarray(y, float)
    w = (rt >= centre - half) & (rt <= centre + half)
    if w.sum() < 2:
        return 0.0
    yy = y[w] - y[w].min()
    return float(np.trapz(yy, rt[w])) if hasattr(np, "trapz") else float(np.trapezoid(yy, rt[w]))


_W_ROLE = {"main ion": 1.0, "isolated": 0.6}
_W_TREND = {"rises then falls": 1.0, "rises": 0.9, "falls": 0.5, "constant": 0.1, "": 0.5}


def priority(row: dict) -> float:
    """0-100 for ordering the table: intensity of the difference (log), role (frammenti, isotopi and addotti are not new molecules) and trend."""
    role = row.get("role", "")
    w_role = _W_ROLE.get(role, 0.15)
    w_trend = _W_TREND.get(row.get("trend", ""), 0.5)
    inten = min(1.0, math.log10(1 + max(row.get("diff") or 0, 0)) / 7)
    return round(100 * inten * w_role * w_trend, 1)


# ---------------------------------------------------------------------------------------------------------------- everything
def analyse(points: list[dict], files: list[dict], hr: bool, ppm: float = 5.0, loss_formulas: list[str] | None = None, th: dict | None = None) -> list[dict]:
    """points: [{rt, mz, diff, ia, traces: {file k: {rt, y}}}] (what find_points found, plus the XIC of every file at the point).
    files: [{k, time, label}] in the order of the experiment. -> one row per point: the input plus n, g, r, role, proof, areas (per file), trend, score."""
    th = soglie(th)
    ks = [f["k"] for f in files]
    times = [f.get("time") for f in files]
    rows = []
    for i, p in enumerate(points, 1):
        areas = []
        for k in ks:
            tr = (p.get("traces") or {}).get(str(k)) or (p.get("traces") or {}).get(k)
            areas.append(window_area(tr["rt"], tr["y"], p["rt"]) if tr else 0.0)
        best = int(np.argmax(areas)) if areas and max(areas) > 0 else 0
        tr = (p.get("traces") or {}).get(str(ks[best])) if ks else None
        rows.append({"n": i, "rt": p["rt"], "mz": p["mz"], "diff": p.get("diff"), "ia": p.get("ia") or 0.0, "areas": areas, "series": areas, "trace": tr,
                     "forms": p.get("forms") or []})
    rows = group_points(rows, th)
    losses = loss_masses(loss_formulas or [])
    by_g: dict[int, list[dict]] = {}
    for r in rows:
        by_g.setdefault(r["g"], []).append(r)
    for mem in by_g.values():
        assign_roles(mem, hr, ppm, losses, th)
    if hr:
        num = {r["n"]: r for r in rows}
        for r in rows:
            if r.get("loss") and r.get("of") in num:
                extra = subformula_proof(num[r["of"]]["forms"], r["forms"], r["loss"])
                if extra:
                    r["proof"] += "; " + extra
    for r in rows:
        r["trend"] = trend_shape(times, r["areas"])
        r["score"] = priority(r)
        r.pop("trace", None)
        r.pop("series", None)
        r.pop("top", None)
    return rows
