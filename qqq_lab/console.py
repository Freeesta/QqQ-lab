"""Terminal output for the launcher (scripts/avvia.py) and the local server: a small header, steps with
a check mark, a spinner while something slow runs.

Standard library only and Python >= 3.8, because the launcher may run on an old system Python.
Colours only on a real terminal and never with NO_COLOR set; plain ASCII where the console cannot
print the symbols (old Windows console, redirected output with a limited encoding).
"""
from __future__ import annotations

import os
import shutil
import sys
import threading
import time


def _enable_vt() -> bool:
    """Windows 10+ consoles understand ANSI colours only after this call."""
    if os.name != "nt":
        return True
    try:
        import ctypes
        k = ctypes.windll.kernel32
        h = k.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        if not k.GetConsoleMode(h, ctypes.byref(mode)):
            return False
        return bool(k.SetConsoleMode(h, mode.value | 0x0004))  # ENABLE_VIRTUAL_TERMINAL_PROCESSING
    except Exception:  # noqa: BLE001 -- no colours is fine
        return False


def _can_print(text: str) -> bool:
    try:
        text.encode(sys.stdout.encoding or "ascii")
        return True
    except (UnicodeEncodeError, LookupError):
        return False


TTY = sys.stdout.isatty()
COLOR = TTY and not os.environ.get("NO_COLOR") and _enable_vt()
FANCY = _can_print("✓✗➜▁▂▃▅▆█⠋") and (os.name != "nt" or bool(os.environ.get("WT_SESSION")))

ACCENT, GREEN, RED, YELLOW = "38;5;32", "38;5;35", "38;5;167", "38;5;178"   # blue like the logo, then states
OK, BAD, WARN, ARROW = ("✓", "✗", "!", "➜") if FANCY else ("ok", "x", "!", "->")


def paint(text: str, *codes: str) -> str:
    if not COLOR or not codes:
        return text
    return "\033[" + ";".join(codes) + "m" + text + "\033[0m"


def bold(t: str) -> str:
    return paint(t, "1")


def dim(t: str) -> str:
    return paint(t, "2")


def say(line: str = "") -> None:
    print(line, flush=True)


def header(version: str = "") -> None:
    """Logo line (a tiny mass spectrum) + name + one line of description."""
    bars = "▁▃▆█▂▅▃▁" if FANCY else ""
    pad = " " * (len(bars) + 2) if bars else ""
    say()
    say("  " + (paint(bars, ACCENT) + "  " if bars else "") + bold("QqQ lab") + ("  " + dim("v" + version) if version else ""))
    say("  " + pad + dim("esplorazione di dati LC-MS al triplo quadrupolo"))
    say()


def ok(text: str, detail: str = "") -> None:
    say("  " + paint(OK, GREEN) + " " + text + ("  " + dim(detail) if detail else ""))


def fail(text: str, detail: str = "") -> None:
    say("  " + paint(BAD, RED) + " " + text + ("  " + dim(detail) if detail else ""))


def warn(text: str) -> None:
    say("  " + paint(WARN, YELLOW) + " " + text)


def note(text: str) -> None:
    """A secondary line, indented under the previous step."""
    say("    " + dim(text))


def link(url: str, detail: str = "") -> None:
    say("  " + paint(ARROW, ACCENT) + " " + paint(url, "1", ACCENT, "4") + ("  " + dim(detail) if detail else ""))


def home(path) -> str:
    """Path with the home folder written as ~ (shorter, and does not show the user name twice)."""
    p, h = str(path), os.path.expanduser("~")
    return "~" + p[len(h):] if h and p.startswith(h) else p


class Spinner:
    """with Spinner("Installo") as sp: sp.update("numpy"); ...; sp.done("Installato")

    On a terminal one line turns with the elapsed seconds; elsewhere (logs, tests) a single plain line.
    Leaving the block with an exception, or without done(), prints a failure mark."""

    FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏" if FANCY else "|/-\\"

    def __init__(self, text: str):
        self.text, self.sub, self.t0 = text, "", time.time()
        self._stop = threading.Event()
        self._th = None
        self._width = 0
        self._closed = False

    def __enter__(self):
        if TTY:
            self._th = threading.Thread(target=self._spin, daemon=True)
            self._th.start()
        else:
            say("  ... " + self.text)
        return self

    def _line(self, frame: str) -> str:
        """One line that never wraps (a wrapped line would be repeated at every turn of the spinner)."""
        s = int(time.time() - self.t0)
        tail = f"  {s} s" if s >= 3 else ""
        room = max(10, shutil.get_terminal_size((80, 24)).columns - 6 - len(tail))
        text = self.text + (" · " + self.sub if self.sub else "")
        if len(text) > room:
            text = text[:room - 1] + "…" if FANCY else text[:room - 3] + "..."
        head, rest = text[:len(self.text)], text[len(self.text):]
        return "  " + paint(frame, ACCENT) + " " + head + dim(rest) + (dim(tail) if tail else "")

    def _spin(self):
        i = 0
        while not self._stop.is_set():
            self._write(self._line(self.FRAMES[i % len(self.FRAMES)]))
            i += 1
            self._stop.wait(0.1)

    def _write(self, line: str):
        if COLOR:   # ANSI terminal: clear the line, then write
            sys.stdout.write("\r\033[K" + line)
        else:       # no ANSI: overwrite the previous text with spaces
            sys.stdout.write("\r" + line + " " * max(0, self._width - len(line)))
            self._width = len(line)
        sys.stdout.flush()

    def update(self, sub: str):
        self.sub = sub
        if not TTY:
            note(sub)

    def _end(self, line: str):
        if self._closed:
            return
        self._closed = True
        self._stop.set()
        if self._th:
            self._th.join()
            self._write("")
            sys.stdout.write("\r")
        say(line)

    def done(self, text: str = "", detail: str = ""):
        self._end("  " + paint(OK, GREEN) + " " + (text or self.text) + ("  " + dim(detail) if detail else ""))

    def failed(self, text: str = "", detail: str = ""):
        self._end("  " + paint(BAD, RED) + " " + (text or self.text) + ("  " + dim(detail) if detail else ""))

    def __exit__(self, exc_type, exc, tb):
        if not self._closed:
            self.failed()
        return False
