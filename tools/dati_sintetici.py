"""Synthetic look-alikes of the lab's "B" series (flufenacet), for tests where the real mzML are not available
(cloud sessions, CI). The real data never go into the repository: this script WRITES files with the same names and
the same structure as the lab files, but every number is invented.

    python3 tools/dati_sintetici.py OUT_DIR            # writes B_FullMass-t0..t60, B_FullMass-neg-t0 (ESI-), C_IDA / C_MRM-EPI / C_POLALT (mixed files), B_MS2-t15, B_MRM-*, B_MRM-STD_*

What is built in (so the e2e tests find what they expect):
- Full Scan (7 times, RT 0.5-20 min, ~1100 scans, m/z 120-480, +0.3 Da offset like the instrument): parent 364.4 at
  14.3 min decaying with time, its isotopes (365.4, 366.4), in-source fragments 194.2, 152.2, 124.3 at the same RT and
  constant ratio, Na adduct 386.3, products 305.3 (14.7 min) and 229.1 (7.07 min) rising then falling, 224.2 (13.0 min),
  a contaminant 391.3 at 18.3 min in every file, chemical noise; TIC, BPC and a PDA "TWC" chromatogram.
- MS2 (B_MS2-t15, t45, t60): product-ion scans of precursors 229.1 and 305.0 (CE 10), many empty scans (as in the real files).
- MRM (7 samples + standards 0.06, 0.6, 2.4, 7.2, 12, 18 ppm, names with "_" as decimal separator like the lab files):
  SRM chromatograms 364.1>194.1 (Quant) and 364.1>152.1 (Qual), peak at 14.3 min, area proportional to concentration.
No .dam files: tests that need a method file are skipped by tools/verifica.py.
"""
from __future__ import annotations

import base64
import sys
import zlib
from pathlib import Path

import numpy as np

OFF = 0.3                       # instrument m/z offset seen in the lab files
TIMES = [0, 5, 10, 15, 30, 45, 60]
STANDARDS = {"0_06": 0.06, "0_6": 0.6, "2_4": 2.4, "7_2": 7.2, "12": 12.0, "18": 18.0}


def _b64(a, f4=False) -> str:
    return base64.b64encode(zlib.compress(np.asarray(a, "<f4" if f4 else "<f8").tobytes())).decode()


def _arr(acc, name, data, unit="") -> str:
    return (f'<binaryDataArray encodedLength="0"><cvParam cvRef="MS" accession="MS:1000523" name="64-bit float" value=""/>'
            f'<cvParam cvRef="MS" accession="MS:1000574" name="zlib compression" value=""/>'
            f'<cvParam cvRef="MS" accession="{acc}" name="{name}" value=""{unit}/><binary>{_b64(data) if len(data) else ""}</binary></binaryDataArray>')


def _spec(i, rt, mz, it, level=1, prec=None, ce=None, neg=False) -> str:
    p = ""
    if prec is not None:
        p = (f'<precursorList count="1"><precursor><selectedIonList count="1"><selectedIon>'
             f'<cvParam cvRef="MS" accession="MS:1000744" name="selected ion m/z" value="{prec}"/></selectedIon></selectedIonList>'
             f'<activation><cvParam cvRef="MS" accession="MS:1000045" name="collision energy" value="{ce}"/></activation></precursor></precursorList>')
    return (f'<spectrum index="{i}" id="sample=1 period=1 cycle={i + 1} experiment=1" defaultArrayLength="{len(mz)}">'
            f'<cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="{level}"/>'
            + ('<cvParam cvRef="MS" accession="MS:1000129" name="negative scan" value=""/>' if neg else '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>') +
            f'<cvParam cvRef="MS" accession="MS:1000285" name="total ion current" value="{float(np.sum(it)):.6g}"/>'
            f'<scanList count="1"><scan><cvParam cvRef="MS" accession="MS:1000016" name="scan start time" value="{rt:.6f}" '
            f'unitCvRef="UO" unitAccession="UO:0000031" unitName="minute"/></scan></scanList>{p}<binaryDataArrayList count="2">'
            + _arr("MS:1000514", "m/z array", mz) + _arr("MS:1000515", "intensity array", it) + "</binaryDataArrayList></spectrum>")


def _chrom(i, cid, t, y, extra="") -> str:
    return (f'<chromatogram index="{i}" id="{cid}" defaultArrayLength="{len(t)}">{extra}<binaryDataArrayList count="2">'
            + _arr("MS:1000595", "time array", t, ' unitCvRef="UO" unitAccession="UO:0000031" unitName="minute"')
            + _arr("MS:1000515", "intensity array", y) + "</binaryDataArrayList></chromatogram>")


def _write(path: Path, specs: list[str], chroms: list[str]) -> None:
    head = ('<?xml version="1.0" encoding="utf-8"?><mzML xmlns="http://psi.hupo.org/ms/mzml" version="1.1.0">'
            '<instrumentConfigurationList count="1"><instrumentConfiguration id="IC1">'
            '<cvParam cvRef="MS" accession="MS:1000651" name="3200 QTRAP" value=""/></instrumentConfiguration></instrumentConfigurationList>'
            f'<run id="{path.stem}">')
    body = (f'<spectrumList count="{len(specs)}">' + "".join(specs) + "</spectrumList>") if specs else ""
    path.write_text(head + body + f'<chromatogramList count="{len(chroms)}">' + "".join(chroms) + "</chromatogramList></run></mzML>",
                    encoding="utf-8")


def _g(rt, c, s, tau=0.04):
    """Slightly tailed Gaussian (exponential tail on the right), max ~1."""
    x = np.asarray(rt, float) - c
    return np.exp(-0.5 * (x / s) ** 2) * np.where(x > 0, np.exp(-x / max(tau, 1e-6) * 0.15), 1.0)


def _pda(rng, total, rt_end=22.0):
    t = np.arange(0, rt_end, 0.004)
    y = 2.0e3 + 1.5e2 * np.sin(t / 3) + rng.normal(0, 30, t.size)
    for c, a in ((14.3, 2.2e4 * total), (7.07, 3e3), (18.3, 4e3), (2.1, 6e3)):
        y += a * _g(t, c, 0.07)
    return t, y


def full_scan(path: Path, t: float, rng, neg: bool = False) -> None:
    k = 0.035
    P = 2.0e7 * np.exp(-k * t)
    comps = [  # (m/z observed, RT, sigma, amplitude)
        (364.07 + OFF, 14.3, 0.06, P), (365.07 + OFF, 14.3, 0.06, 0.16 * P), (366.07 + OFF, 14.3, 0.06, 0.055 * P),
        (194.0 + 0.2, 14.3, 0.06, 0.8 * P), (152.0 + 0.2, 14.3, 0.06, 0.95 * P), (124.0 + 0.3, 14.3, 0.06, 0.3 * P),
        (386.05 + OFF, 14.3, 0.06, 0.03 * P),
        (305.0 + 0.3, 14.7, 0.06, 2.5e6 * (1 - np.exp(-0.06 * t)) * np.exp(-0.01 * t)),
        (229.1, 7.07, 0.06, 1.2e6 * (1 - np.exp(-0.04 * t))),
        (224.2, 13.0, 0.06, 8e5 * (1 - np.exp(-0.03 * t)) ** 2),
        (391.3, 18.3, 0.08, 6e5), (279.2, 2.1, 0.1, 3e5),
    ]
    if neg:                                           # negative mode: [M-H]- is 2.0146 lighter than [M+H]+ (everything else the same, only to test the sign and the default adduct)
        comps = [(m - 2.0146, c, s, a) for m, c, s, a in comps]
    rts = np.linspace(0.5087, 20.0076, 1111)
    specs, tic, bpc = [], [], []
    for i, rt in enumerate(rts):
        mz = list(rng.uniform(120, 480, 45)); it = list(rng.lognormal(np.log(4e3), 0.9, 45))
        for m, c, s, a in comps:
            v = a * _g(rt, c, s) * rng.normal(1, 0.03)
            if v > 200:
                mz.append(m + rng.normal(0, 0.03)); it.append(v)
        o = np.argsort(mz); mz = np.array(mz)[o]; it = np.array(it)[o]
        specs.append(_spec(i, rt, mz, it, neg=neg)); tic.append(it.sum()); bpc.append(it.max())
    tp, yp = _pda(rng, np.exp(-k * t))
    _write(path, specs, [_chrom(0, "TIC", rts, tic), _chrom(1, "BPC", rts, bpc), _chrom(2, "TWC", tp, yp)])


def ms2(path: Path, rng, t: float = 15) -> None:
    f = (1 - np.exp(-0.04 * t)) / (1 - np.exp(-0.6))                 # products grow with the treatment time
    prods = {229.1: ([123.1, 171.2, 211.1, 229.1], [0.05, 0.8, 0.25, 1.0], 7.07, 9e5 * f),
             305.0: ([152.2, 194.2, 263.1, 305.2], [0.3, 1.0, 0.2, 0.6], 14.7, 7e5 * f)}
    rts = np.linspace(0.0197, 20.0009, 1005)
    specs, tic, bpc = [], [], []
    for i, rt in enumerate(rts):
        prec = 229.1 if i % 2 == 0 else 305.0
        mzs, rel, c, a = prods[prec]
        sig = a * _g(rt, c, 0.06)
        if sig < 300 and rng.random() < 0.75:                       # empty scans, as in the lab files
            mz = it = np.zeros(0)
        else:
            mz = np.array(mzs) + rng.normal(0, 0.03, len(mzs)); it = np.array(rel) * max(sig, 300) * rng.normal(1, 0.05, len(mzs))
            noise_mz = rng.uniform(60, prec, 6); noise = rng.lognormal(np.log(150), 0.6, 6)
            mz = np.concatenate([mz, noise_mz]); it = np.concatenate([it, noise]); o = np.argsort(mz); mz, it = mz[o], it[o]
        specs.append(_spec(i, rt, mz, it, level=2, prec=prec, ce=10.0)); tic.append(float(np.sum(it))); bpc.append(float(np.max(it)) if len(it) else 0.0)
    tp, yp = _pda(rng, 0.6, 20.0)
    _write(path, specs, [_chrom(0, "TIC", rts, tic), _chrom(1, "BPC", rts, bpc), _chrom(2, "TWC", tp, yp)])


def mrm(path: Path, amount: float, rng, sample: int) -> None:
    t = np.linspace(0, 20.0034, 19995)
    q = amount * _g(t, 14.3, 0.05) + rng.normal(0, 150, t.size).clip(0) + 200
    ql = 1.7 * amount * _g(t, 14.3, 0.05) + rng.normal(0, 150, t.size).clip(0) + 200
    pol = '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
    srm = lambda n, q3, name: f"SRM SIC Q1=364.1 Q3={q3} sample={sample} period=1 experiment=1 transition={n} ce=20 name={name}"
    tp, yp = _pda(rng, amount / 1.3e5, 20.0)
    _write(path, [], [_chrom(0, "TIC", t, q + ql), _chrom(1, "BPC", t, np.maximum(q, ql)),
                      _chrom(2, srm(0, "194.1", "Quant"), t, q, pol), _chrom(3, srm(1, "152.1", "Qual"), t, ql, pol),
                      _chrom(4, "TWC", tp, yp)])


def _scan_ions(rt, rng, ions, neg=False):
    mz = list(rng.uniform(120, 480, 12)); it = list(rng.lognormal(np.log(3e3), 0.8, 12))
    for m, c, sg, a in ions:
        v = a * _g(rt, c, sg) * rng.normal(1, 0.03)
        if v > 200:
            mz.append(m + rng.normal(0, 0.03)); it.append(v)
    o = np.argsort(mz); return np.array(mz)[o], np.array(it)[o]


def mixed_ida(path: Path, rng) -> None:
    """IDA / DDA look-alike: a survey scan (level 1) and two product-ion scans (level 2) at every cycle, the precursors change from cycle to cycle."""
    ions = [(364.4, 14.3, 0.06, 2e7), (305.3, 14.7, 0.06, 2e6), (229.1, 7.07, 0.06, 1e6), (224.2, 13.0, 0.06, 6e5), (391.3, 18.3, 0.08, 6e5)]
    rts = np.linspace(0.5, 20.0, 160); specs, tic, i = [], [], 0
    for c, rt in enumerate(rts):
        mz, it = _scan_ions(rt, rng, ions); specs.append(_spec(i, rt, mz, it)); tic.append(it.sum()); i += 1
        for k in range(2):
            top = sorted(ions, key=lambda x: -x[3] * _g(rt, x[1], x[2]))[k]
            prec = round(top[0] + rng.normal(0, 0.15), 1) if c % 3 else round(top[0] + 0.0, 1)
            frag = np.sort(rng.uniform(60, prec - 10, 5)); it2 = rng.lognormal(np.log(2e3), 0.6, 5) * (1 + 3 * _g(rt, top[1], top[2]))
            specs.append(_spec(i, rt + 0.004 * (k + 1), frag, it2, level=2, prec=prec, ce=25.0)); i += 1
    _write(path, specs, [_chrom(0, "TIC", rts, tic)])


def mixed_mrm_epi(path: Path, rng) -> None:
    """MRM + EPI look-alike: SRM chromatograms of two transitions plus product-ion scans (level 2) triggered on the MRM peak."""
    t = np.linspace(0, 20.0, 4000)
    q = 1e5 * _g(t, 14.3, 0.05) + rng.normal(0, 150, t.size).clip(0) + 200
    ql = 1.7e5 * _g(t, 14.3, 0.05) + rng.normal(0, 150, t.size).clip(0) + 200
    pol = '<cvParam cvRef="MS" accession="MS:1000130" name="positive scan" value=""/>'
    srm = lambda n, q3, name: f"SRM SIC Q1=364.1 Q3={q3} sample=1 period=1 experiment=1 transition={n} ce=20 name={name}"
    specs = []
    for i, rt in enumerate(np.linspace(14.0, 14.7, 20)):
        frag = np.array([152.2, 194.2, 224.1, 305.2]); it = np.array([0.5, 1.0, 0.2, 0.3]) * 1e5 * _g(rt, 14.3, 0.1) * rng.normal(1, 0.05, 4)
        specs.append(_spec(i, rt, frag, it, level=2, prec=364.1, ce=30.0))
    _write(path, specs, [_chrom(0, "TIC", t, q + ql), _chrom(1, srm(0, "194.1", "Quant"), t, q, pol), _chrom(2, srm(1, "152.1", "Qual"), t, ql, pol)])


def mixed_polarity(path: Path, rng) -> None:
    """Positive and negative scans alternate at every cycle (Full Scan only)."""
    ions = [(364.4, 14.3, 0.06, 2e7), (362.4, 14.3, 0.06, 1e7)]
    rts = np.linspace(0.5, 20.0, 200); specs, i = [], 0
    for rt in rts:
        for neg in (False, True):
            mz, it = _scan_ions(rt, rng, [ions[1] if neg else ions[0]]); specs.append(_spec(i, rt + (0.003 if neg else 0), mz, it, neg=neg)); i += 1
    _write(path, specs, [])


def make(out: Path) -> Path:
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(2026)
    for t in TIMES:                                   # the lab's t30 file is called "B_FullMass-t30 (2)": same name here
        full_scan(out / (f"B_FullMass-t{t}.mzML" if t != 30 else "B_FullMass-t30 (2).mzML"), t, rng)
    for t in (15, 45, 60):
        ms2(out / f"B_MS2-t{t}.mzML", rng, t)
    for i, t in enumerate((0, 5, 10, 15, 30, 45, 60)):
        mrm(out / f"B_MRM-t{t}.mzML", 1.3e5 * np.exp(-0.035 * t), rng, 6 + i)
    for i, (name, c) in enumerate(STANDARDS.items()):
        mrm(out / f"B_MRM-STD_{name}ppm.mzML", 1.0e4 * c, rng, 1 + i)
    full_scan(out / "B_FullMass-neg-t0.mzML", 0, np.random.default_rng(7), neg=True)      # one NEGATIVE Full Scan (written last: the other files do not change)
    rng2 = np.random.default_rng(11)                  # mixed files (several experiments in ONE file), written last: nothing else changes
    mixed_ida(out / "C_IDA-t0.mzML", rng2); mixed_mrm_epi(out / "C_MRM-EPI-t0.mzML", rng2); mixed_polarity(out / "C_POLALT-t0.mzML", rng2)
    (out / "SINTETICI.txt").write_text("Dati sintetici scritti da tools/dati_sintetici.py: NON sono misure del laboratorio.\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(make(Path(sys.argv[1])))
