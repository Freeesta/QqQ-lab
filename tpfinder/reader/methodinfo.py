"""Acquisition parameters stored in Analyst .dam (method) and .wiff (data) files.

Decoded from the binary streams of the OLE2 container (checked on files from Analyst 1.6.3, 3200 QTRAP):
ion source parameters (CUR, GS1, GS2, CAD, IS, TEM, ihe) and compound parameters (DP, EP, CEP, CE, ...).
Values are 32-bit floats stored after the UTF-16 parameter name. Anything not recognised is left out.
"""
from __future__ import annotations

import re
import struct
from pathlib import Path

from .ole import Ole

NAMES = {
    "CUR": ("Gas tenda (CUR)", "psi"), "GS1": ("Gas di nebulizzazione (GS1)", "psi"), "GS2": ("Gas di desolvatazione (GS2)", "psi"),
    "CAD": ("Gas di collisione (CAD), valore grezzo", ""), "IS": ("Tensione dello spray (IS)", "V"),
    "TEM": ("Temperatura della sorgente (TEM)", "°C"), "ihe": ("Interface heater (ihe), 1 = acceso", ""),
    "DP": ("Declustering potential (DP)", "V"), "EP": ("Entrance potential (EP)", "V"), "CEP": ("Collision cell entrance potential (CEP)", "V"),
    "CE": ("Energia di collisione (CE)", "eV"), "CXP": ("Collision cell exit potential (CXP)", "V"), "CES": ("Collision energy spread (CES)", "eV"),
}
_SRC = re.compile(rb"((?:[A-Za-z0-9]\x00){2,6})")
_CMP = re.compile(rb"[\x02-\x0c]\x00((?:[A-Za-z0-9]\x00){2,4})")


def _num(v: float) -> float:
    return round(v, 3) if abs(v) < 1e5 else v


def _strings(data: bytes, minlen: int = 4) -> list[str]:
    return [m.decode("utf-16le") for m in re.findall(rb"(?:[\x20-\x7e]\x00){%d,}" % minlen, data)]


def _method(ole: Ole, base: str) -> dict:
    """Decode one method whose streams live under `base` ('' for .dam, 'MethodSubtree/Method3/' for .wiff)."""
    out: dict = {"source": [], "compound": [], "file": {}}
    tab = base + "DeviceMethod0/Period0/Experiment0/IonSourceParamsTable/"
    for i in range(24):
        key = f"{tab}Parameter{i}/ParameterData"
        if key not in ole.streams:
            break
        d = ole.read(key)
        m = _SRC.search(d[16:])
        if not m:
            continue
        name = m.group(1).decode("utf-16le")
        end = 16 + m.end()
        if end + 4 <= len(d) and name in NAMES:
            v = struct.unpack_from("<f", d, end)[0]
            lab, unit = NAMES[name]
            out["source"].append({"id": name, "label": lab, "value": _num(v), "unit": unit})
    key = base + "DeviceMethod0/Period0/Experiment0/MassRangeEx/MassRangeEx"
    if key in ole.streams:
        d = ole.read(key)
        seen = set()
        for m in _CMP.finditer(d):
            name = m.group(1).decode("utf-16le")
            if name in NAMES and name not in seen and m.end() + 4 <= len(d):
                seen.add(name)
                v = struct.unpack_from("<f", d, m.end())[0]
                lab, unit = NAMES[name]
                out["compound"].append({"id": name, "label": lab, "value": _num(v), "unit": unit})
    for fname in (base + "AcqMethodFileInfoStm", "FileRec_Str"):
        if fname in ole.streams:
            s = _strings(ole.read(fname))
            for t in s:
                tl = t.lower()
                if ".dam" in tl and "metodo" not in out["file"]:
                    mm = re.search(r"[A-Z]:\\.*?\.dam", t)
                    out["file"]["metodo"] = mm.group(0) if mm else t
                elif re.search(r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", tl):
                    mm = re.search(r"[A-Z][a-z]+day .*?[AP]M", t)
                    out["file"].setdefault("data", mm.group(0).replace(": ", ":") if mm else t)
                elif tl.startswith("analyst"):
                    out["file"].setdefault("software", re.sub(r"[^\x20-\x7e]", " ", t).strip())
                elif t.startswith("LAB_") or t.endswith("-PC"):
                    out["file"].setdefault("computer", t)
            if out["file"]:
                break
    return out


def read_methods(path) -> list[dict]:
    """[{name, source, compound, file}] for a .dam (one method) or a .wiff (one per sample)."""
    path = Path(path)
    ole = Ole(path)
    try:
        subs = sorted({k.split("/")[1] for k in ole.streams if k.startswith("MethodSubtree/Method")},
                      key=lambda s: int(re.sub(r"\D", "", s) or 0))
        if subs:
            res = []
            for s in subs:
                m = _method(ole, f"MethodSubtree/{s}/")
                m["name"] = s.replace("Method", "Metodo ")
                m["sample"] = int(re.sub(r"\D", "", s) or 0)
                res.append(m)
            return res
        m = _method(ole, "")
        m["name"] = path.name
        m["sample"] = None
        return [m]
    finally:
        ole.close()
