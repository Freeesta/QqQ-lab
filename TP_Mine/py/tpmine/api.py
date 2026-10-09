# TPMINE-PRIVATE
"""Entry points called by the Web Worker (everything in and out is JSON text). One experiment at a time lives in memory."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np

from mzlab.chem import elements as E
from mzlab.reader.mzml import Run

from . import chem
from .demo import make_demo
from .engine import Experiment, Sample, guess_sample
from .hr import engine as hr_engine

DATA = Path("/tp_data")
_ex: Experiment | None = None
_hr: hr_engine.ExperimentHR | None = None
_kinds: dict = {}         # name -> 'hr' | 'msn' | 'other' (filled by classify)
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
            hk = hr_engine.classify(x.run)
            _kinds[n] = hk
            out.append({"name": n, "kind": x.kind, "hr_kind": hk, "type": x.type, "time": x.time, "label": x.label, "scans": len(x.run.scans)})
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


def is_hr(files: list[dict]) -> bool:
    """High-resolution path when the series is high resolution (LC files) or a direct-infusion MSn file is among the files."""
    for f in files:
        if f["name"] not in _kinds:
            r = Run(f["path"])
            _kinds[f["name"]] = hr_engine.classify(r)
            r.close()
    k = [_kinds[f["name"]] for f in files if f.get("type", "sample") in ("sample", "blank", "control")]
    return any(v == "hr" for v in k) and all(v in ("hr", "msn") for v in k)


def run(files_json: str, parent_json: str, settings_json: str, transf_text: str) -> str:
    global _ex, _hr
    files = json.loads(files_json)
    for f in files:
        f["path"] = str(DATA / f["name"])
    if is_hr(files):
        for f in files:
            f["kind"] = _kinds[f["name"]]
        _ex = None
        _hr = hr_engine.ExperimentHR(files, json.loads(parent_json), json.loads(settings_json) or None, progress=_progress)
        return _out(_hr.run())
    _hr = None
    transf = chem.parse_transformations(transf_text) if transf_text.strip() else None
    _ex = Experiment(files, json.loads(parent_json), json.loads(settings_json), None, transf, progress=_progress)
    return _out(_ex.run())


def detail(cid: int) -> str:
    return _out((_hr or _ex).detail(int(cid)))


def msn_tree() -> str:
    if _hr is None:
        raise ValueError("nessun esperimento ad alta risoluzione in memoria")
    return _out(_hr.msn_tree())


def inclusion_csv(n: int = 50) -> str:
    if _hr is None:
        raise ValueError("nessun esperimento ad alta risoluzione in memoria")
    return _hr.inclusion_csv(int(n))


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
