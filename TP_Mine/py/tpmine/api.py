# TPMINE-PRIVATE
"""Entry points called by the Web Worker (everything in and out is JSON text). One experiment at a time lives in memory."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np

from qqq_lab.chem import elements as E

from . import chem
from .demo import make_demo
from .engine import Experiment, Sample, guess_sample

DATA = Path("/tp_data")
_ex: Experiment | None = None
_progress = None          # set by the worker: callable(text, frac)


def _enc(o):
    if isinstance(o, np.generic):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))


def _out(o) -> str:
    return json.dumps(o, default=_enc, ensure_ascii=False)


def classify(names_json: str) -> str:
    """Kind, type, time of each file already written in DATA (the worker stores the bytes first)."""
    out = []
    for n in json.loads(names_json):
        try:
            x = Sample({"name": n, "path": str(DATA / n)})
            out.append({"name": n, "kind": x.kind, "type": x.type, "time": x.time, "label": x.label, "scans": len(x.run.scans)})
        except Exception as e:      # noqa: BLE001
            out.append({"name": n, "kind": "error", "error": str(e)[:160], "type": "sample", "time": None, "label": n})
    return _out(out)


def formula_info(text: str, adduct: str = "[M+H]+") -> str:
    """Preview of the parent: molecular formula (from a formula or a SMILES), neutral mass, ion m/z."""
    try:
        f = chem.neutral_formula(text)
        m = E.mass(f)
        return _out({"ok": True, "formula": E.fmt(f), "neutral": round(m, 4), "mz": round(E.ion_mz(m, adduct), 4),
                     "from": "formula" if text.strip().replace(" ", "").isalnum() and text.strip()[0].isupper() and "(" not in text else "SMILES"})
    except Exception as e:      # noqa: BLE001
        return _out({"ok": False, "error": str(e)})


def default_transformations() -> str:
    return chem.transformations_text()


def demo() -> str:
    """Writes the synthetic bentazone files in DATA and returns what the UI needs to fill the form."""
    DATA.mkdir(parents=True, exist_ok=True)
    files = make_demo(DATA)
    return _out({"files": [{"name": f["name"], "time": f["time"], "type": f["type"]} for f in files],
                 "parent": {"name": "Bentazone", "neutral": "CC(C)N1C(=O)C2=CC=CC=C2NS1(=O)=O", "adduct": "[M+H]+"}})


def run(files_json: str, parent_json: str, settings_json: str, transf_text: str) -> str:
    global _ex
    files = json.loads(files_json)
    for f in files:
        f["path"] = str(DATA / f["name"])
    transf = chem.parse_transformations(transf_text) if transf_text.strip() else None
    _ex = Experiment(files, json.loads(parent_json), json.loads(settings_json), None, transf, progress=_progress)
    return _out(_ex.run())


def detail(cid: int) -> str:
    return _out(_ex.detail(int(cid)))


def transitions(ids_json: str) -> str:
    return _out(_ex.transitions(json.loads(ids_json)))


def isf_classify(mzs_json: str, formula_p: str = "") -> str:
    """In-source-fragment classification (tpmine.isf) of candidate ions against the parent of the running experiment: uses the full-scan
    samples (not blanks), the parent m/z of the experiment and the ions given. Returns JSON {items, doubtful, families, model, note}
    plus `sheets` (for the front end's dlx). Not part of the student UI of the public repo: it is the private verdict (probabilities)."""
    from . import isf
    if _ex is None:
        raise ValueError("nessun esperimento in memoria: esegui prima l'analisi")
    samples = [{"label": x.label, "time": x.time, "table": _ex._table(x), "key": x.path}
               for x in _ex.full if x.type != "blank"]
    res = isf.classify_ions(samples, float(_ex.entries[0]["mz_x"]), [float(v) for v in json.loads(mzs_json)], formula_p or (chem.fmt(_ex.neutral) if _ex.neutral else None))
    res["sheets"] = isf.to_sheets(res)
    return _out(res)
