# TPMINE-PRIVATE
"""A synthetic direct-infusion MSn mzML (any small molecule; the tests use caffeine) written the way a Thermo converter does: nominal precursor
values, a <precursor> list that is incomplete, the whole path only in the filter string, every path repeated for many scans. A calibration
offset in ppm is applied to every m/z. Used by the tests of the high-resolution TP Mine modules."""
from __future__ import annotations

import base64
from pathlib import Path

import numpy as np

from mzlab.chem import elements as E


def mass_of(formula: str) -> float:
    return E.mass(E.parse_formula(formula)) - E.ELECTRON


def _arr(name, acc, v):
    b = base64.b64encode(np.asarray(v, "<f8").tobytes()).decode()
    return (f'<binaryDataArray encodedLength="{len(b)}"><cvParam cvRef="MS" accession="MS:1000523" name="64-bit float"/>'
            f'<cvParam cvRef="MS" accession="MS:1000576" name="no compression"/><cvParam cvRef="MS" accession="{acc}" name="{name}"/>'
            f'<binary>{b}</binary></binaryDataArray>')


def _prec(nominal, ce, ref=None):
    r = f' spectrumRef="{ref}"' if ref else ""
    return (f'<precursor{r}><isolationWindow><cvParam cvRef="MS" accession="MS:1000827" value="{nominal}" name="isolation window target m/z"/>'
            f'<cvParam cvRef="MS" accession="MS:1000828" value="2.5" name="lower"/><cvParam cvRef="MS" accession="MS:1000829" value="2.5" name="upper"/></isolationWindow>'
            f'<selectedIonList count="1"><selectedIon><cvParam cvRef="MS" accession="MS:1000744" value="{nominal}" name="selected ion m/z"/></selectedIon></selectedIonList>'
            f'<activation><cvParam cvRef="MS" accession="MS:1000045" value="{ce}" name="collision energy"/><cvParam cvRef="MS" accession="MS:1000133" name="cid"/></activation></precursor>')


def write_msn(path, nodes: dict, ppm_offset: float = -3.0, n_scans: int = 12, seed: int = 3) -> Path:
    """nodes: {path: [(formula_or_mz, relative intensity), ...]} with path = ((nominal, ce), ...) (all CID), level 1 = ().
    A peak given as a float is an m/z (artefact, no calibration offset); a string is the ion formula of the peak."""
    rng = np.random.default_rng(seed)
    specs, idx, rt = [], 0, 0.0
    for key, peaks in nodes.items():
        for _ in range(n_scans):
            idx += 1
            rt += 0.01
            mz, it = [], []
            for p, rel in peaks:
                m = p if isinstance(p, float) else mass_of(p) * (1 + ppm_offset * 1e-6) * (1 + rng.normal(0, 0.4e-6))
                mz.append(m)
                it.append(1e6 * rel * rng.uniform(0.9, 1.1))
            for _ in range(2):                                           # noise peaks that appear in a single scan only
                mz.append(float(rng.uniform(60, 400)))
                it.append(1e6 * rng.uniform(0.01, 0.03))
            o = np.argsort(mz)
            mz, it = np.asarray(mz)[o], np.asarray(it)[o]
            level = len(key) + 1
            filt = "FTMS + p ESI Full ms%s %s [50.0000-400.0000]" % ("" if level == 1 else level, " ".join(f"{m}.0000@cid{ce}.00" for m, ce in key)) if key else "FTMS + p ESI Full ms [50.0000-400.0000]"
            # incomplete list, nearest generation first, only the last two generations: the first with a spectrumRef, the last without
            precs = [_prec(m, ce, f"scan={idx - 1}" if j == 0 else None) for j, (m, ce) in enumerate(list(reversed(key))[:2])]
            pl = f'<precursorList count="{len(precs)}">{"".join(precs)}</precursorList>' if precs else ""
            specs.append(
                f'<spectrum id="scan={idx}" index="{idx - 1}" defaultArrayLength="{len(mz)}"><cvParam cvRef="MS" accession="MS:1000511" value="{level}" name="ms level"/>'
                f'<cvParam cvRef="MS" accession="MS:1000130" name="positive scan"/><cvParam cvRef="MS" accession="MS:1000127" name="centroid spectrum"/>'
                f'<cvParam cvRef="MS" accession="MS:1000285" value="{it.sum():.0f}" name="total ion current"/>'
                f'<scanList count="1"><scan><cvParam cvRef="MS" accession="MS:1000016" value="{rt:.4f}" name="scan start time" unitName="minute"/>'
                f'<cvParam cvRef="MS" accession="MS:1000512" value="{filt}" name="filter string"/></scan></scanList>{pl}'
                f'<binaryDataArrayList count="2">{_arr("m/z array", "MS:1000514", mz)}{_arr("intensity array", "MS:1000515", it)}</binaryDataArrayList></spectrum>')
    p = Path(path)
    p.write_text('<?xml version="1.0"?><mzML><run id="r"><spectrumList count="%d">%s</spectrumList></run></mzML>' % (len(specs), "".join(specs)), encoding="utf-8")
    return p


CAFFEINE_SMILES = "CN1C=NC2=C1C(=O)N(C)C(=O)N2C"            # C8H10N4O2, [M+H]+ = C8H11N4O2
CAFFEINE_ION = "C8H11N4O2"


def caffeine_nodes() -> dict:
    """An MSn experiment on caffeine-like ions (formulas chosen as sub-formulas of C8H11N4O2)."""
    ms2 = [("C8H11N4O2", 100), ("C6H8N3O", 55), ("C5H8N3", 12), ("C6H10N3O2", 1.5), ("C5H6N3O", 8)]
    p30 = lambda *x: tuple((m, 30) for m in x)
    return {
        (): [("C8H11N4O2", 100), (301.0, 3.0)],
        p30(195): ms2,
        p30(195, 138): [("C6H8N3O", 40), ("C5H8N3", 100), ("C5H5N2O", 14), ("C4H7N2", 9), ("C8H11N4O2", 30), (173.497, 20.0)],       # contamination + artefact
        p30(195, 156): ms2,                                                                   # ghost: a copy of the MS2 spectrum (the precursor is not isolated)
        ((195, 30), (138, 30), (110, 35)): [("C5H8N3", 100), ("C4H7N2", 21), ("C3H5N2", 6), ("C2H4N", 11)],
        ((195, 30), (156, 30), (138, 30), (110, 35)): [("C5H8N3", 100), ("C4H7N2", 30), ("C3H5N2", 5)],      # the MS4 generation (195>156>138) has no spectrum: via the ghost
        ((195, 30), (138, 45)): [("C6H8N3O", 20), ("C5H8N3", 100), ("C4H7N2", 20), ("C5H5N2O", 10)],         # another CE of the same nominal path
    }
