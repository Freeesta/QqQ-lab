"""Acquisition parameters stored in Analyst .dam (method) and .wiff (data) files.

Decoded from the binary streams of the OLE2 container (checked on files from Analyst 1.6.3, 3200 QTRAP):
ion source parameters (CUR, GS1, GS2, CAD, IS, TEM, ihe) and compound parameters (DP, EP, CEP, CE, ...).
Values are 32-bit floats stored after the UTF-16 parameter name. Anything not recognised is left out.
"""
from __future__ import annotations

import re
import struct
import xml.etree.ElementTree as ET
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


def _lc(ole: Ole, base: str) -> dict | None:
    """LC method (pump gradient, flow, PDA, oven) from the XML stored by Analyst in DeviceMethod1/VendorAppMethod.

    Returns {"gradient": [{"t", "b", "flow"}], "flow", "b0", "run_time", "pda": {...}, "oven", "pda_channels": [...]} or None.
    """
    key = base + "DeviceMethod1/VendorAppMethod"
    if key not in ole.streams:
        return None
    raw = ole.read(key)
    a = raw.find(b"<SCIEX_ANALYST_ACQUISITION_METHOD")
    b = raw.find(b"</SCIEX_ANALYST_ACQUISITION_METHOD>")
    if a < 0 or b < 0:
        return None
    try:
        root = ET.fromstring(raw[a:b + len(b"</SCIEX_ANALYST_ACQUISITION_METHOD>")].decode("utf-8", "replace"))
    except ET.ParseError:
        return None
    cats = {}
    for c in root.iter("Category"):
        title = (c.findtext("Title") or "").strip()
        par = {(p.findtext("Name") or "").strip(): ((p.findtext("Value") or "").strip(), (p.findtext("Unit") or "").strip()) for p in c.findall("Parameter")}
        tabs = {}
        for t in c.findall("Table"):
            rows = [[(r.findtext(f"Field{i}") or "").strip() for i in range(1, 9) if r.find(f"Field{i}") is not None] for r in t.findall("row")]
            tabs[(t.findtext("Name") or "").strip()] = [r for r in rows[2:] if r]    # skip header and dashes
        cats[title] = (par, tabs)

    def num(x):
        try:
            return float(x)
        except (TypeError, ValueError):
            return None
    pumps, ctl = cats.get("Pumps", ({}, {}))[0], cats.get("System Controller", ({}, {}))[1]
    flow0, b0 = num(pumps.get("Total Flow", ("", ""))[0]), num(pumps.get("B Concentration", ("", ""))[0])
    events = sorted(((num(r[0]), r[3], num(r[4])) for r in ctl.get("Time Program", []) if len(r) >= 5 and num(r[0]) is not None), key=lambda e: e[0])
    grad, flow, bconc, stop = [], flow0, b0, None
    if b0 is not None:
        grad.append({"t": 0.0, "b": b0, "flow": flow})
    for t, name, val in events:
        if name == "Pump B Conc." and val is not None:
            bconc = val
        elif name == "Total Flow" and val is not None:
            flow = val
        elif name == "Stop":
            stop = t
            continue
        else:
            continue
        if grad and grad[-1]["t"] == t:
            grad[-1].update(b=bconc, flow=flow)
        else:
            grad.append({"t": t, "b": bconc, "flow": flow})
    pda, pt = cats.get("PDA Detector", ({}, {}))
    pdav = lambda k: pda.get(k, ("", ""))[0]
    out = {"gradient": grad, "flow": flow0, "b0": b0, "run_time": stop if stop is not None else num(pdav("Run Time")),
           "pda": {"start": num(pdav("Start WL")), "stop": num(pdav("Stop WL")), "step": num(pdav("Wave Step")), "freq": num(pdav("Sampling Frequency")),
                   "lamp": pdav("Lamp"), "cell": num(pdav("Cell Temperature")), "slit": num(pdav("Slit Width"))},
           "pda_channels": [{"wl": num(r[0]), "bw": num(r[1])} for r in pt.get("DA Channel Array", []) if len(r) >= 2 and num(r[0]) is not None],
           "oven": num(cats.get("Oven", ({}, {}))[0].get("Temperature", ("", ""))[0])}
    return out


def _method(ole: Ole, base: str) -> dict:
    """Decode one method whose streams live under `base` ('' for .dam, 'MethodSubtree/Method3/' for .wiff)."""
    out: dict = {"source": [], "compound": [], "file": {}}
    lc = _lc(ole, base)
    if lc:
        out["lc"] = lc
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
