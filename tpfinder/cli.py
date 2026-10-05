"""Command line: tpfinder app | demo | draft | convert | candidates | serve."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="tpfinder", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("demo", help="write a synthetic experiment and open it")
    d.add_argument("folder", nargs="?", default="tpfinder_demo")
    d.add_argument("--no-open", action="store_true")
    d.add_argument("--port", type=int, default=8790)
    dr = sub.add_parser("draft", help="write an esperimento.toml for the files of a folder")
    dr.add_argument("folder")
    dr.add_argument("--name", required=True)
    g = dr.add_mutually_exclusive_group(required=True)
    g.add_argument("--formula")
    g.add_argument("--mz", type=float)
    dr.add_argument("--polarity", default="positive", choices=["positive", "negative"])
    c = sub.add_parser("convert", help="convert .wiff files to mzML with msconvert")
    c.add_argument("files", nargs="+")
    ca = sub.add_parser("candidates", help="print the candidates of an experiment (and write a CSV)")
    ca.add_argument("project")
    ca.add_argument("--csv")
    s = sub.add_parser("serve", help="open an experiment in the browser")
    s.add_argument("project")
    s.add_argument("--port", type=int, default=8790)
    s.add_argument("--no-open", action="store_true")
    am = sub.add_parser("metodo", help="read the source/compound parameters of an Analyst .dam or .wiff and write them as JSON")
    am.add_argument("file")
    am.add_argument("-o", "--out", default="-")
    ap_ = sub.add_parser("app", help="open the program: drop files in the page and start the analysis")
    ap_.add_argument("--workdir", help="folder where the dropped files are kept (default: ~/TPFinder_lavoro/sessione_...)")
    ap_.add_argument("--port", type=int, default=8790)
    ap_.add_argument("--no-open", action="store_true")
    a = ap.parse_args(argv)

    if a.cmd == "demo":
        from .demo import make_demo
        from .server import serve
        cfg = make_demo(Path(a.folder))
        print(f"demo experiment in {cfg.parent}")
        serve(cfg, a.port, not a.no_open)
    elif a.cmd == "draft":
        from .project import draft_project
        text = draft_project(a.folder, a.name, a.formula, a.mz, a.polarity)
        out = Path(a.folder) / "esperimento.toml"
        if out.exists():
            print(f"{out} exists: not overwritten (printed below)\n\n{text}")
            return 1
        out.write_text(text, encoding="utf-8")
        print(f"written {out}: check the times and types of the samples")
    elif a.cmd == "convert":
        from .convert import ConversionError, to_mzml
        for f in a.files:
            try:
                print(to_mzml(Path(f)))
            except ConversionError as e:
                print(e, file=sys.stderr)
                return 1
    elif a.cmd == "candidates":
        from .core.analysis import Analysis
        from .project import load_project
        from .server import App
        app = App(a.project)
        if app.error:
            print(app.error, file=sys.stderr)
            return 1
        for r in sorted(app.summary, key=lambda r: (-(r["score"] if r["score"] is not None else -1), -r["max_area"]))[:25]:
            print(f"{r['mz']:9.4f}  {str(r['score'] if r['score'] is not None else '-'):>4}  {r['label']:<20} {r['name']}")
        if a.csv:
            Path(a.csv).write_text(app.candidates_csv(), encoding="utf-8")
            print(f"table written to {a.csv}")
    elif a.cmd == "metodo":
        import json
        from .reader.methodinfo import read_methods
        txt = json.dumps(read_methods(a.file), indent=1, ensure_ascii=False)
        print(txt) if a.out == "-" else Path(a.out).write_text(txt, encoding="utf-8")
    elif a.cmd == "app":
        from .server import default_workdir, serve
        wd = Path(a.workdir) if a.workdir else default_workdir()
        print(f"[tpfinder] work folder: {wd}")
        serve(None, a.port, not a.no_open, workdir=wd)
    elif a.cmd == "serve":
        from .server import serve
        serve(a.project, a.port, not a.no_open)
    return 0


if __name__ == "__main__":
    sys.exit(main())
