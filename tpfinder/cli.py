"""Command line: tpfinder app | convert | metodo."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="tpfinder", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("convert", help="convert .wiff files to mzML with msconvert")
    c.add_argument("files", nargs="+")
    am = sub.add_parser("metodo", help="read the source/compound parameters of an Analyst .dam or .wiff and write them as JSON")
    am.add_argument("file")
    am.add_argument("-o", "--out", default="-")
    ap_ = sub.add_parser("app", help="open the program: drop files in the page and start the analysis")
    ap_.add_argument("--workdir", help="folder where the dropped files are kept (default: ~/TPFinder_lavoro/sessione_...)")
    ap_.add_argument("--port", type=int, default=8790)
    ap_.add_argument("--no-open", action="store_true")
    ap_.add_argument("--exit-on-close", action="store_true", help="stop the program when the browser page is closed (used by the launchers)")
    a = ap.parse_args(argv)

    if a.cmd == "convert":
        from .convert import ConversionError, to_mzml
        for f in a.files:
            try:
                print(to_mzml(Path(f)))
            except ConversionError as e:
                print(e, file=sys.stderr)
                return 1
    elif a.cmd == "metodo":
        import json
        from .reader.methodinfo import read_methods
        txt = json.dumps(read_methods(a.file), indent=1, ensure_ascii=False)
        print(txt) if a.out == "-" else Path(a.out).write_text(txt, encoding="utf-8")
    elif a.cmd == "app":
        from .server import default_workdir, serve
        wd = Path(a.workdir) if a.workdir else default_workdir()
        serve(wd, a.port, not a.no_open, exit_on_close=a.exit_on_close)
    return 0


if __name__ == "__main__":
    sys.exit(main())
