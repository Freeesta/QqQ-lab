"""The experiment: parent compound, samples (file, label, time, type), settings, thresholds.

esperimento.toml (edit with any text editor):

    [parent]
    name = "Carbamazepine"
    formula = "C15H12N2O"          # or: mz = 237.1022
    polarity = "positive"          # positive | negative
    adduct = "[M+H]+"              # optional

    [settings]
    tol_da = 0.35                  # window of the ion chromatogram (unit resolution: dalton, not ppm)
    rt_tol_min = 0.25              # peaks of one candidate must fall within this of its reference RT
    max_steps = 2                  # reactions combined in one candidate
    rt_min = 0.5                   # ignore everything before this (solvent front), minutes

    [[samples]]
    file = "t0.mzML"               # .mzML, or .wiff (converted with msconvert when it is installed)
    label = "t0"
    time = 0                       # minutes of treatment
    type = "sample"                # sample | blank | control
"""
from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path

from .chem.transformations import load_transformations

SAMPLE_TYPES = ("sample", "blank", "control")


@dataclass
class Sample:
    file: str
    label: str
    time: float | None
    type: str
    path: Path


@dataclass
class Project:
    root: Path
    parent: dict
    settings: dict
    samples: list[Sample]
    thresholds: dict
    transformations: list[dict]
    texts: dict
    config_files: dict = field(default_factory=dict)   # where each configuration came from


DEFAULT_SETTINGS = {"tol_da": 0.35, "rt_tol_min": 0.25, "max_steps": 2, "rt_min": 0.5, "convert_args": []}


def _packaged(name: str) -> Path:
    return Path(str(resources.files("tpfinder") / "config" / name))


def _pick(root: Path, name: str) -> Path:
    """A file in the experiment folder wins over the packaged default."""
    p = root / name
    return p if p.exists() else _packaged(name)


def guess_sample(name: str) -> tuple[str, float | None, str]:
    """(label, time in minutes, type) guessed from a file name: 'blank', 't30', '120min', '2h'."""
    base = Path(name).stem
    low = base.lower()
    if re.search(r"(^|[_\-\s])(blank|blk|bianco)([_\-\s\d]|$)", low):
        return base, None, "blank"
    if re.search(r"(^|[_\-\s])(control|ctrl|dark|buio)([_\-\s\d]|$)", low):
        return base, None, "control"
    m = re.search(r"(?:^|[_\-\s])t?(\d+(?:[.,]\d+)?)\s*(min|m|h|ore)?(?:[_\-\s]|$)", low)
    if m:
        v = float(m.group(1).replace(",", "."))
        if m.group(2) in ("h", "ore"):
            v *= 60
        return base, v, "sample"
    return base, None, "sample"


def load_project(path) -> Project:
    path = Path(path)
    if path.is_dir():
        path = path / "esperimento.toml"
    root = path.parent
    cfg = tomllib.loads(path.read_text(encoding="utf-8"))
    parent = cfg.get("parent") or {}
    if not (parent.get("formula") or parent.get("mz")):
        raise ValueError(f"{path.name}: [parent] needs a formula or an mz")
    if parent.get("polarity", "positive") not in ("positive", "negative"):
        raise ValueError(f"{path.name}: polarity must be positive or negative")
    settings = {**DEFAULT_SETTINGS, **(cfg.get("settings") or {})}
    samples = []
    for s in cfg.get("samples") or []:
        typ = s.get("type", "sample")
        if typ not in SAMPLE_TYPES:
            raise ValueError(f"{path.name}: sample type {typ!r} not in {SAMPLE_TYPES}")
        f = Path(s["file"])
        samples.append(Sample(file=s["file"], label=s.get("label") or f.stem,
                              time=(float(s["time"]) if s.get("time") is not None else None), type=typ,
                              path=f if f.is_absolute() else root / f))
    if not samples:
        raise ValueError(f"{path.name}: no [[samples]]")
    thr_path, tr_path, tx_path = _pick(root, "soglie.toml"), _pick(root, "trasformazioni.csv"), _pick(root, "testi.toml")
    return Project(root=root, parent=parent, settings=settings, samples=samples,
                   thresholds=tomllib.loads(thr_path.read_text(encoding="utf-8")),
                   transformations=load_transformations(tr_path),
                   texts=tomllib.loads(tx_path.read_text(encoding="utf-8")),
                   config_files={"soglie": str(thr_path), "trasformazioni": str(tr_path), "testi": str(tx_path),
                                 "project": str(path)})


def draft_project(folder, name: str, formula: str | None = None, mz: float | None = None,
                  polarity: str = "positive") -> str:
    """Text of an esperimento.toml for the .mzML / .wiff files of a folder (to be checked by hand)."""
    folder = Path(folder)
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".mzml", ".wiff"))
    out = ["[parent]", f'name = "{name}"']
    out.append(f'formula = "{formula}"' if formula else f"mz = {mz}")
    out += [f'polarity = "{polarity}"', "", "[settings]", "tol_da = 0.35", "rt_tol_min = 0.25", "max_steps = 2",
            "rt_min = 0.5", ""]
    rows = []
    for p in files:
        label, t, typ = guess_sample(p.name)
        rows.append((t if t is not None else 1e9, p, label, t, typ))
    for _, p, label, t, typ in sorted(rows, key=lambda r: (r[4] != "sample", r[0])):
        out += ["[[samples]]", f'file = "{p.name}"', f'label = "{label}"']
        if t is not None:
            out.append(f"time = {t:g}")
        out += [f'type = "{typ}"', ""]
    return "\n".join(out)


def write_project(path, parent: dict, samples: list[dict], settings: dict | None = None) -> Path:
    """Write an esperimento.toml. samples: [{file, time (minutes or None), type}]; paths relative to the file."""
    import json as _json
    q = _json.dumps                                    # JSON strings are valid TOML basic strings
    out = ["[parent]", f"name = {q(parent.get('name') or 'parent')}"]
    out.append(f"formula = {q(parent['formula'])}" if parent.get("formula") else f"mz = {float(parent['mz'])}")
    out += [f"polarity = {q(parent.get('polarity', 'positive'))}", "", "[settings]"]
    st = {**{"tol_da": 0.35, "rt_tol_min": 0.25, "max_steps": 2, "rt_min": 0.5}, **(settings or {})}
    out += [f"{k} = {v}" for k, v in st.items() if k in ("tol_da", "rt_tol_min", "max_steps", "rt_min")]
    out.append("")
    for smp in samples:
        label = Path(smp["file"]).stem
        out += ["[[samples]]", f"file = {q(smp['file'])}", f"label = {q(label)}"]
        if smp.get("time") is not None:
            out.append(f"time = {float(smp['time']):g}")
        out += [f"type = {q(smp.get('type', 'sample'))}", ""]
    path = Path(path)
    path.write_text("\n".join(out), encoding="utf-8")
    return path
