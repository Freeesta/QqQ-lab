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
