"""The endpoints of the program, independent of the transport.

`dispatch` is used by the test server (tools/dev_server.py) and by the browser version (Pyodide, web/browser-worker.js):
same routes, same answers, one implementation.
"""
from __future__ import annotations

import json

from .bigfiles import too_big
from .i18n import UserError
from .chem.elements import formula_mz


def _json(obj, code=200):
    return code, "application/json", json.dumps(obj).encode("utf-8"), {}


def _fail(e, code=400):
    """The answer for an exception: a UserError carries its message key and parameters; the text is for developers (the page translates the key)."""
    if isinstance(e, UserError):
        return _json(e.to_json(), code)
    return _json({"error": str(e) if isinstance(e, ValueError) else f"missing or invalid parameter: {e}"}, code)


MAX_BODY = 8 << 20  # bytes accepted for a JSON request


def dispatch(app, method: str, path: str, q: dict, stream=None, length: int = 0):
    """(status, content type, body bytes, extra headers) for one request. stream/length: body of a POST."""
    if method == "POST":
        try:
            if path == "/api/upload":
                app.save_upload(q.get("name", ""), stream, length)
                return _json({"files": app.files(), "methods": app.methods()})
            if length > MAX_BODY:  # a JSON body is small; refuse anything huge instead of reading it into memory
                raise UserError("err.request.tooLarge", text="request too large")
            body = json.loads((stream.read(length) if stream is not None else b"") or b"{}")
            if path == "/api/explore":
                app.open_session(body)
                return _json(app.session_state())
            if path == "/api/remove":
                app.remove_file(body.get("name", ""))
                return _json({"files": app.files(), "methods": app.methods()})
            if path == "/api/notebook":
                app.save_notebook(body)
                return _json({"ok": True})
            if path == "/api/new":
                app.reset(bool(body.get("fresh")))
                return _json(app.state())
            return _json({"error": "unknown endpoint"}, 404)
        except MemoryError:
            return _json(too_big(), 507)
        except Exception as e:  # noqa: BLE001
            return _fail(e) if isinstance(e, ValueError) else _json({"error": f"{type(e).__name__}: {e}"}, 400)
    try:
        if path == "/api/state":
            return _json(app.state())
        if path == "/api/notebook":
            return _json(app.notebook())
        if path == "/api/perf":
            return _json(app.perf())
        if path == "/api/session":
            return _json(app.session_state())
        if path == "/api/chrom":
            return _json(app.chrom(int(q["k"]), q.get("kind", "tic"), int(q.get("level", 1)),
                                   float(q["mz0"]) if q.get("mz0") else None, float(q["mz1"]) if q.get("mz1") else None,
                                   float(q["prec"]) if q.get("prec") else None, q.get("filt") or None))
        if path == "/api/filters":       # the scan types of a file (scan filters) with their counts: what the filter menu of a cell lists
            return _json(app.filters(int(q["k"])))
        if path == "/api/scaninfo":      # every name / value pair of the header of a scan, as the file has it
            try:
                return _json(app.scaninfo(int(q["k"]), int(q["sid"])))
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path == "/api/scanlist":      # the scans of a level / scan type in columns (the list of scans of the bench)
            try:
                return _json(app.scanlist(int(q["k"]), int(q.get("level", 1)), q.get("filt") or None))
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path == "/api/fileinfo":      # what the mzML says about the file and the instrument
            try:
                return _json(app.fileinfo(int(q["k"])))
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path == "/api/xic":
            return _json(app.xic([int(x) for x in q["k"].split(",") if x], float(q["mz"]),
                                 float(q.get("tol", 0.35)), int(q.get("level", 1))))
        if path == "/api/origin":        # evidence on where an ion comes from (ionfamily); never a verdict
            return _json(app.origin(int(q.get("k", -1)), float(q["mz"]), float(q["parent"]),
                                    float(q["rt0"]) if q.get("rt0") else None, float(q["rt1"]) if q.get("rt1") else None, q.get("formula")))
        if path == "/api/mrm":
            return _json(app.mrm([int(x) for x in q["k"].split(",") if x]))
        if path == "/api/method_warnings":
            return _json(app.method_warnings())
        if path == "/api/method":
            return _json(app.method(int(q["k"])))
        if path == "/api/nearest_scan":
            return _json(app.nearest_scan(
                int(q["k"]), float(q["rt"]),
                filter=q.get("filter"), level=int(q.get("level", 1)),
                precursor=float(q["precursor"]) if q.get("precursor") else None
            ))
        if path == "/api/spectrum":
            pr = q.get("precursor")
            bg = None
            if q.get("bgk") not in (None, ""):
                bg = {"k": int(q["bgk"]), "rt0": float(q["bgrt0"]), "rt1": float(q["bgrt1"]), "factor": float(q.get("bgf", 1.0))}
            return _json(app.spectrum(int(q["k"]), float(q["rt0"]), float(q["rt1"]), int(q.get("level", 1)),
                                      float(pr) if pr not in (None, "") else None, float(q.get("bin", 0.1)), bg, q.get("merge") == "1", q.get("hr") != "0", q.get("filt") or None))
        if path == "/api/spectra":       # single scans i0..i1 (at most 60), for scan-by-scan navigation
            pr = q.get("prec", q.get("precursor"))
            try:
                return _json(app.spectra(int(q["k"]), int(q["i0"]), int(q["i1"]), int(q.get("level", 1)),
                                         float(pr) if pr not in (None, "") else None, float(q.get("bin", 0.1)), q.get("merge") == "1", q.get("hr") != "0", q.get("filt") or None))
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path == "/api/scanbin":       # the same scans as /api/spectra, as a binary block (no JSON, no decimals): see App.scanbin
            pr = q.get("prec", q.get("precursor"))
            try:
                body = app.scanbin(int(q["k"]), int(q["i0"]), int(q["i1"]), int(q.get("level", 1)), float(pr) if pr not in (None, "") else None,
                                   q.get("filt") or q.get("filter") or None, q.get("hr") != "0", q.get("merge") == "1")
                return 200, "application/octet-stream", body, {}
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path in ("/api/dda", "/api/scan", "/api/scanavg"):       # DDA and single scans as stored in the file (high resolution, B2)
            try:
                if path == "/api/dda":
                    return _json(app.dda(int(q["k"]), q.get("hr") != "0"))
                if path == "/api/scan":
                    return _json(app.scan(int(q["k"]), int(q["sid"]), q.get("hr") != "0"))
                return _json(app.scanavg(int(q["k"]), [int(x) for x in q["sids"].split(",") if x], q.get("hr") != "0"))
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path == "/api/formula":
            try:
                return _json(formula_mz(q.get("f", ""), q.get("adduct") or None))
            except ValueError as e:      # a typo in the formula is the user's, not a server fault
                return _fail(e)
        if path == "/api/composition":    # formulas that fit an exact m/z (mzlab.chem.composition): candidates, never a verdict
            try:
                from .chem.composition import compose, parse_elements
                rdb = [float(x) for x in (q.get("rdb") or "-1,100").split(",")]
                el = parse_elements(q["elements"]) if q.get("elements") else None
                return _json(compose(float(q["mz"]), elements=el, ion=q.get("ion") or "[M+H]+", z=int(q["z"]) if q.get("z") else None,
                                     tol=float(q.get("tol", 5)), unit=q.get("unit", "ppm"), rdb=(rdb[0], rdb[1]), nitrogen=q.get("n", "none"),
                                     rules=[x for x in (q.get("rules") or "").split(",") if x], max_results=min(int(q.get("max", 10)), 200),
                                     parent=q.get("parent") or None, m1=float(q["m1"]) if q.get("m1") else None, m2=float(q["m2"]) if q.get("m2") else None,
                                     iso_tol=float(q.get("isotol", 0.2))))
            except (ValueError, KeyError, IndexError) as e:
                return _fail(e)
        if path == "/api/contaminants":   # built-in list of known contaminants, expanded into ions (mzlab.chem.contaminants); matching is done in the browser (web/liste.js)
            from .chem.contaminants import builtin
            return _json({"lists": [builtin()]})
        if path == "/api/msntree":      # tree of the fragmentation paths of an MSn file (consensus spectra and formulas): candidates, not identifications
            try:
                return _json(app.msn_tree(int(q["k"]), q.get("formula") or None, float(q.get("ppm", 5))))
            except (ValueError, KeyError) as e:
                return _fail(e)
        if path == "/api/map":
            if q.get("rt0") not in (None, ""):      # true zoom: one region on new bins
                try:
                    return _json(app.ionmap_region(int(q["k"]), int(q.get("level", 1)), float(q["rt0"]), float(q["rt1"]), float(q["mz0"]), float(q["mz1"]),
                                                   int(q.get("nrt", 400)), int(q.get("nmz", 400))))
                except (ValueError, KeyError) as e:
                    return _fail(e)
            return _json(app.ionmap(int(q["k"]), int(q.get("level", 1))))
        return _json({"error": "unknown endpoint"}, 404)
    except MemoryError:   # a file too big for the browser's memory: say what to do, not a bare exception name
        return _json(too_big(), 507)
    except Exception as e:  # noqa: BLE001
        return _fail(e, 500) if isinstance(e, UserError) else _json({"error": f"{type(e).__name__}: {e}"}, 500)
