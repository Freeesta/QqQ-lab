"""A synthetic experiment (carbamazepine, five times, a blank) to try the program and to test it.

Truth built into the data: the parent decays; hydroxylation (+O) and dihydroxylation (+O2) are
formed, with a clear rise over time; demethylation (-CH2) is a contaminant present everywhere,
blank included; an interfering ion near the +O mass sits at another retention time."""
from __future__ import annotations

import base64
import zlib
from pathlib import Path

import numpy as np

PARENT_MZ = 237.1022
TIMES = [0, 15, 30, 60, 120]


def _gauss(rt, c, s):
    return np.exp(-0.5 * ((rt - c) / s) ** 2)


def _profile(t: float | None, blank: bool) -> list[tuple[float, float, float, float]]:
    """(m/z, RT centre, sigma, amplitude) of the compounds present, for a treatment time t."""
    out = [(223.0866, 6.4, 0.07, 2.0e5), (253.20, 2.0, 0.08, 3.0e5), (269.09, 3.0, 0.08, 1.5e5)]   # in every file
    if blank or t is None:
        return out
    k = 0.03
    out.append((PARENT_MZ, 6.0, 0.07, 2.0e6 * np.exp(-k * t)))
    out.append((253.0972, 5.2, 0.07, 9.0e5 * (1 - np.exp(-0.04 * t)) * np.exp(-0.004 * t)))
    out.append((269.0921, 4.6, 0.07, 5.0e5 * (1 - np.exp(-0.02 * t)) ** 2))
    return out


def _b64(a: np.ndarray) -> bytes:
    z = zlib.compress(np.asarray(a, "<f8").tobytes())
    return base64.b64encode(z)


def _spectrum(i: int, level: int, rt: float, mz: np.ndarray, it: np.ndarray, prec: float | None = None, ce: float | None = None) -> str:
    prec_xml = ""
    if prec is not None:
        prec_xml = (f'<precursorList count="1"><precursor><selectedIonList count="1"><selectedIon>'
                    f'<cvParam cvRef="MS" accession="MS:1000744" name="selected ion m/z" value="{prec}"/></selectedIon>'
                    f'</selectedIonList><activation><cvParam cvRef="MS" accession="MS:1000045" name="collision energy" '
                    f'value="{ce}"/></activation></precursor></precursorList>')
    flt = f"+ p ESI Q1MS [100.000-400.000]" if level == 1 else f"+ p ESI Product ion ({prec}) CE{ce}"
    m, a = _b64(mz), _b64(it)
    return (f'<spectrum index="{i}" id="sample=1 period=1 cycle={i + 1} experiment={level}" defaultArrayLength="{len(mz)}">'
            f'<cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="{level}"/>'
            f'<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000285" name="total ion current" value="{float(it.sum()):.6g}"/>'
            f'<scanList count="1"><scan><cvParam cvRef="MS" accession="MS:1000016" name="scan start time" value="{rt:.5f}" '
            f'unitCvRef="UO" unitAccession="UO:0000031" unitName="minute"/>'
            f'<cvParam cvRef="MS" accession="MS:1000512" name="filter string" value="{flt}"/></scan></scanList>'
            f'{prec_xml}<binaryDataArrayList count="2">'
            f'<binaryDataArray encodedLength="{len(m)}"><cvParam cvRef="MS" accession="MS:1000523" name="64-bit float" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000574" name="zlib compression" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000514" name="m/z array" value=""/><binary>{m.decode()}</binary></binaryDataArray>'
            f'<binaryDataArray encodedLength="{len(a)}"><cvParam cvRef="MS" accession="MS:1000523" name="64-bit float" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000574" name="zlib compression" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000515" name="intensity array" value=""/><binary>{a.decode()}</binary></binaryDataArray>'
            f'</binaryDataArrayList></spectrum>')


def write_mzml(path: Path, t: float | None, blank: bool, rng: np.random.Generator) -> None:
    comps = _profile(t, blank)
    specs, i = [], 0
    for n, rt in enumerate(np.arange(0.5, 10.0, 0.05)):
        mz = list(rng.uniform(100, 400, 40))                                   # chemical noise
        it = list(rng.lognormal(np.log(3e3), 0.8, 40))
        for m, c, s, a in comps:
            v = a * _gauss(rt, c, s) * rng.normal(1, 0.04)
            if v > 100:
                mz.append(m + rng.normal(0, 0.03))
                it.append(v)
        o = np.argsort(mz)
        specs.append(_spectrum(i, 1, float(rt), np.array(mz)[o], np.array(it)[o]))
        i += 1
        if n % 4 == 0 and not blank and t is not None:                          # product-ion scans of the +O ion
            sig = 9.0e5 * (1 - np.exp(-0.04 * t)) * np.exp(-0.004 * t) * _gauss(rt, 5.2, 0.07)
            f_mz = np.array([180.08, 208.07, 235.09, 253.10])
            f_it = np.array([0.35, 0.6, 1.0, 0.1]) * sig * 0.05 + rng.uniform(50, 200, 4)
            specs.append(_spectrum(i, 2, float(rt) + 0.01, f_mz, f_it, prec=253.097, ce=30.0))
            i += 1
    head = ('<?xml version="1.0" encoding="utf-8"?><mzML xmlns="http://psi.hupo.org/ms/mzml" version="1.1.0">'
            f'<run id="{path.stem}"><spectrumList count="{len(specs)}">')
    path.write_text(head + "".join(specs) + "</spectrumList></run></mzML>", encoding="utf-8")


def make_demo(folder: Path) -> Path:
    """Synthetic carbamazepine time course (t0..t60 + blank) as mzML files; used by the tests. Returns the folder."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    for t in TIMES:
        write_mzml(folder / f"demo_t{t}min.mzML", t, False, rng)
    write_mzml(folder / "demo_blank.mzML", None, True, rng)
    return folder


# ----------------------------------------------------------------------------------------------------------------------
# Synthetic in-source-fragmentation scene with known truth (for tests/test_ionfamily.py and for calibrating qqq_lab/ionfamily.py)
# ----------------------------------------------------------------------------------------------------------------------
ISF_PARENT_MZ = 364.0          # nominal; centroids are written at nominal + ISF_OFFSET (the real instrument is ~ +0.3 Da off)
ISF_OFFSET = 0.3


def _egauss(rt, c, sigma, tau=0.0):
    """Gaussian (tau = 0) or exponentially modified Gaussian elution profile with unit height, evaluated on the array rt."""
    rt = np.asarray(rt, float)
    if tau <= 0:
        return np.exp(-0.5 * ((rt - c) / sigma) ** 2)
    from math import erfc, exp

    def emg(r):
        return exp(sigma ** 2 / (2 * tau ** 2) - (r - c) / tau) * erfc((c + sigma ** 2 / tau - r) / (sigma * 2 ** 0.5)) / (2 * tau)
    grid = np.linspace(c - 5 * sigma, c + 5 * sigma + 5 * tau, 400)
    top = max(emg(float(r)) for r in grid)
    return np.array([emg(float(r)) for r in rt]) / top


def isf_ions(t: float, k1: float = 0.04, k2: float = 0.02, rt_parent: float = 8.0) -> list[dict]:
    """Truth of the scene at treatment time t (minutes): parent, in-source fragments with a constant ratio, isotope, adduct,
    a product at another RT, a product that co-elutes with the parent (other shape), and an ISOBARIC pair (an in-source fragment and
    a coeluting product with the same m/z)."""
    A = 2.0e6 * np.exp(-k1 * t)
    tpa = 6.0e5 * k1 / (k2 - k1) * (np.exp(-k1 * t) - np.exp(-k2 * t)) * 1.0
    growth = 1.0 - np.exp(-0.05 * t)
    return [
        {"name": "P", "mz": ISF_PARENT_MZ, "rt": rt_parent, "sigma": 0.045, "tau": 0.03, "amp": A, "role": "parent"},
        {"name": "ISF_H2O", "mz": 346.0, "rt": rt_parent, "sigma": 0.045, "tau": 0.03, "amp": 0.12 * A, "role": "isf", "ratio": 0.12},
        {"name": "ISF_big", "mz": 194.0, "rt": rt_parent, "sigma": 0.045, "tau": 0.03, "amp": 0.80 * A, "role": "isf", "ratio": 0.80},
        {"name": "ISF_small", "mz": 152.0, "rt": rt_parent, "sigma": 0.045, "tau": 0.03, "amp": 0.03 * A, "role": "isf", "ratio": 0.03},
        {"name": "M+1", "mz": 365.0, "rt": rt_parent, "sigma": 0.045, "tau": 0.03, "amp": 0.22 * A, "role": "isotope", "ratio": 0.22},
        {"name": "M+Na", "mz": 386.0, "rt": rt_parent, "sigma": 0.045, "tau": 0.03, "amp": 0.05 * A, "role": "adduct", "ratio": 0.05},
        {"name": "TP_early", "mz": 380.0, "rt": rt_parent - 1.1, "sigma": 0.05, "tau": 0.0, "amp": tpa * 1.0, "role": "tp"},
        {"name": "TP_late", "mz": 322.0, "rt": rt_parent + 0.6, "sigma": 0.05, "tau": 0.0, "amp": 3.0e5 * growth, "role": "tp"},
        {"name": "TP_coelute", "mz": 280.0, "rt": rt_parent + 0.10, "sigma": 0.07, "tau": 0.0, "amp": 4.0e5 * growth, "role": "tp_coelute"},
        {"name": "TP_isobaric", "mz": 346.0, "rt": rt_parent + 0.09, "sigma": 0.07, "tau": 0.0, "amp": 3.5e5 * growth, "role": "tp_isobaric"},
    ]


def isf_scene(t: float = 0.0, seed: int = 0, dt_s: float = 1.0, rt_range=(6.0, 10.0), saturate: float | None = None,
              noise: float = 1.0, drift: float = 1.0, rt_parent: float = 8.0, ions: list[dict] | None = None):
    """One synthetic full-scan run as a reader.PeakTable plus its truth. Centroids: signal ions (Gaussian/EMG elution, jitter of
    the centroid m/z 0.04 Da, multiplicative noise 4%, plus Poisson-like noise), a drifting chemical background ion, ~80 random
    chemical-noise centroids per scan. dt_s = scan interval in seconds (0.5-2 s), saturate = detector ceiling per ion (cps)."""
    from .reader.mzml import PeakTable
    rng = np.random.default_rng(seed)
    dt = dt_s / 60.0
    rt = np.arange(rt_range[0], rt_range[1], dt)
    ions = isf_ions(t, rt_parent=rt_parent) if ions is None else ions
    prof = [ion["amp"] * _egauss(rt, ion["rt"], ion["sigma"], ion.get("tau", 0.0)) for ion in ions]
    mzs, its, poss = [], [], []
    for p, r in enumerate(rt):
        mz = list(rng.uniform(100, 480, 80))
        it = list(rng.lognormal(np.log(2500), 0.7, 80) * noise)
        mz.append(301.0 + ISF_OFFSET + rng.normal(0, 0.04))
        it.append(8000 * (1 + drift * (r - rt_range[0]) / (rt_range[1] - rt_range[0])) * rng.normal(1, 0.1))
        for ion, pr in zip(ions, prof):
            v = float(pr[p])
            if v <= 0:
                continue
            v = v * rng.normal(1, 0.04) + rng.normal(0, np.sqrt(max(v, 1.0)) * 0.3 * noise)
            if saturate is not None:
                v = min(v, saturate)
            if v > 400:
                mz.append(ion["mz"] + ISF_OFFSET + rng.normal(0, 0.04))
                it.append(v)
        mz, it = np.array(mz), np.array(it)
        o = np.argsort(mz)
        mzs.append(mz[o])
        its.append(it[o])
        poss.append(np.full(len(mz), p, dtype=np.int32))
    mz, it, pos = np.concatenate(mzs), np.concatenate(its), np.concatenate(poss)
    order = np.argsort(mz, kind="stable")
    tb = PeakTable(rt=rt, scan_ids=np.arange(len(rt)), mz=mz[order], inten=it[order], pos=pos[order], tic=np.array([a.sum() for a in its]))
    return tb, ions


def isf_series(times=(0, 5, 10, 15, 30, 45, 60), seed: int = 0, **kw):
    """The scene at several treatment times: list of (time, PeakTable, truth)."""
    return [(t, *isf_scene(t, seed + i, **kw)) for i, t in enumerate(times)]
