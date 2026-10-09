"""Checks the two interface languages (Italian and English) of mzLab. Part of `python3 tools/verifica.py --rapida`.

    python3 tools/controlla_i18n.py            # checks; exit code 1 if something is wrong
    python3 tools/controlla_i18n.py --elenco   # also lists, file by file, Italian words still outside the catalogs

What is checked (specification: PROMPT_INGLESE.md of the data repository, section 4):
 1. every key used (`t("..")`, `data-i18n*="..")`, keys of Python messages) exists in lang/it.js and lang/en.js; no orphan key;
 2. placeholders and ICU structure are the same in the two languages; ICU braces are balanced;
 3. the Italian text written in the static HTML (elements with data-i18n*) equals lang/it.js;
 4. no Italian outside the catalogs: in the string literals of the files already migrated (MIGRATED) no frequent Italian word;
    the other files are only listed with --elenco (they become mandatory one by one as parts B-E migrate them);
    motivated exceptions are in tools/i18n_eccezioni.txt;
 5. the glossary (lang/glossario.json): if the Italian text contains an Italian form of an entry, the English text must contain an
    English form and none of the forms to avoid;
 6. lang/contesto.json describes every key that has parameters.
The catalogs are plain JSON inside `I18N.add("xx", { ... });`: the first and the last line are cut off and the rest is parsed as JSON.
"""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "mzlab" / "web"
LANG = WEB / "lang"
ECCEZIONI = ROOT / "tools" / "i18n_eccezioni.txt"

# JS files whose strings must already be free of Italian (grows as the parts of the work migrate files)
MIGRATED = {"mzlab/web/i18n.js"}
# not checked for Italian words: third-party code, the Teoria (Italian only, by decision), TP Mine, the catalogs themselves
SKIP_DIRS = ("mzlab/web/vendor/", "mzlab/web/teoria/", "mzlab/web/lang/", "mzlab/web/esempi/", "TP_Mine/")
SKIP_FILES = {"mzlab/web/elements.js", "mzlab/web/tpmine.enc"}

# frequent Italian words (those that are also English words are left out: a, e, per, in, ...)
ITALIAN_WORDS = set("""il lo la le gli dei del della delle degli dello nel nella nelle nei negli sul sulla sulle sui con una uno
che non sono è più può puoi hai hanno ogni tutti tutto tutte nessun nessuna nessuno questo questa questi queste quello quella
carica caricare scegli scegliere apri aprire chiudi chiudere annulla salva salvare scarica scaricare elimina cancella
mostra nascondi seleziona trascina rilascia aggiungi rimuovi copia incolla nuovo nuova nuovi vecchio file-non
dati spettro spettri picco picchi errore errori attendi attendere caricamento prova esempio esempi aiuto
perché quando dove come anche ancora già ora poi solo senza dopo prima fra tra dalla dallo dalle dagli sia siamo
""".split())

PARAM_RE = re.compile(r"\{([A-Za-z_][\w]*)")


# ---------------------------------------------------------------- catalogs
def load_catalog(lang: str) -> dict[str, str]:
    p = LANG / f"{lang}.js"
    lines = p.read_text(encoding="utf-8").strip().splitlines()
    if not lines[0].startswith(f'I18N.add("{lang}", {{') or lines[-1].strip() != "});":
        raise ValueError(f"{p.name}: the first line must be `I18N.add(\"{lang}\", {{` and the last `}});`")
    return json.loads("{" + "\n".join(lines[1:-1]) + "}")


def icu_signature(msg: str) -> tuple[list, list]:
    """(sorted (name, type) of the arguments, sorted plural categories) of a message; raises on unbalanced braces."""
    depth = 0
    for ch in msg:
        depth += (ch == "{") - (ch == "}")
        if depth < 0:
            raise ValueError("unbalanced }")
    if depth:
        raise ValueError("unbalanced {")
    args, cats = [], []

    def walk(s: str) -> None:
        i = 0
        while i < len(s):
            if s[i] != "{":
                i += 1
                continue
            d, j = 0, i
            while j < len(s):
                d += (s[j] == "{") - (s[j] == "}")
                if d == 0:
                    break
                j += 1
            inner = s[i + 1:j]
            parts = [x.strip() for x in inner.split(",", 2)]
            kind = parts[1] if len(parts) > 1 else "plain"
            if re.fullmatch(r"[A-Za-z_]\w*", parts[0]):
                args.append((parts[0], kind))
            if kind == "plural" and len(parts) > 2:
                rest = parts[2]
                for m in re.finditer(r"(=\d+|zero|one|two|few|many|other)\s*\{", rest):
                    cats.append(m.group(1))
                for m in re.finditer(r"\{((?:[^{}]|\{[^{}]*\})*)\}", rest):
                    walk(m.group(1))
            i = j + 1

    walk(msg)
    return sorted(set(args)), sorted(set(cats))


# ---------------------------------------------------------------- usage in the sources
def source_files(exts: tuple[str, ...]) -> list[Path]:
    out = []
    for p in sorted(list((ROOT / "mzlab").rglob("*")) + list((ROOT / "tools").glob("*"))):
        if not p.is_file() or p.suffix not in exts:
            continue
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(SKIP_DIRS) or rel in SKIP_FILES or "__pycache__" in rel or rel.startswith("mzlab/web/lang/"):
            continue
        out.append(p)
    return out


T_CALL = re.compile(r"""(?<![\w$.])(?:I18N\.)?t\(\s*(["'`])([A-Za-z][\w]*(?:\.[\w]+)+)\1""")
T_DYN = re.compile(r"""(?<![\w$.])(?:I18N\.)?t\(\s*`([A-Za-z][\w]*(?:\.[\w]+)*\.)\$\{""")     # t(`prefix.${x}`): keeps every key with that prefix
DATA_ATTR = re.compile(r"""data-i18n(?:-[a-z-]+)?=["']([A-Za-z][\w]*(?:\.[\w]+)+)["']""")
PY_KEY = re.compile(r"""(?:UserError\(\s*|["']error_key["']\s*:\s*|["']key["']\s*:\s*|message\(\s*)["']([a-z][\w]*(?:\.[\w]+)+)["']""")


def used_keys() -> tuple[dict[str, set[str]], set[str]]:
    keys: dict[str, set[str]] = {}
    prefixes: set[str] = set()
    for p in source_files((".js", ".html", ".py")):
        rel = p.relative_to(ROOT).as_posix()
        text = p.read_text(encoding="utf-8", errors="replace")
        found = set()
        if p.suffix == ".py":
            if rel.startswith("tools/"):
                continue
            found |= set(PY_KEY.findall(text))
        else:
            found |= {m.group(2) for m in T_CALL.finditer(text)} | set(DATA_ATTR.findall(text))
            prefixes |= set(T_DYN.findall(text))
        for k in found:
            keys.setdefault(k, set()).add(rel)
    return keys, prefixes


# ---------------------------------------------------------------- static HTML = it.js
class _Static(HTMLParser):
    """Collects (key, attribute or None, text) for each element with data-i18n*."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[list] = []
        self.found: list[tuple[str, str | None, str]] = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        for a, target in (("data-i18n-title", "title"), ("data-i18n-placeholder", "placeholder"), ("data-i18n-aria-label", "aria-label")):
            if a in d:
                self.found.append((d[a], target, d.get(target, "")))
        if tag in ("br", "img", "input", "meta", "link", "hr"):
            return
        self.stack.append([tag, d.get("data-i18n"), []])

    def handle_data(self, data):
        for fr in self.stack:
            if fr[1]:
                fr[2].append(data)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                fr = self.stack[i]
                del self.stack[i:]
                if fr[1]:
                    self.found.append((fr[1], None, "".join(fr[2])))
                return


def check_static_html(it: dict, errs: list) -> None:
    for p in source_files((".html",)):
        ps = _Static()
        ps.feed(p.read_text(encoding="utf-8"))
        for key, attr, text in ps.found:
            if key in it and re.sub(r"\s+", " ", text).strip() != it[key]:
                errs.append(f"HTML {p.name}: «{key}»{' (' + attr + ')' if attr else ''} shows «{text.strip()[:50]}» but it.js has «{it[key][:50]}»")


# ---------------------------------------------------------------- Italian outside the catalogs
def js_strings(src: str):
    """Yields (line, text) for every string literal outside comments (tolerant: regex literals can confuse it, see the exceptions file)."""
    i, n, line = 0, len(src), 1
    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            line += src.count("\n", i, j)
            i = j
            continue
        if c in "\"'`":
            j, q = i + 1, c
            while j < n and src[j] != q:
                if src[j] == "\\":
                    j += 1
                elif src[j] == "\n" and q != "`":
                    break
                j += 1
            yield line, src[i + 1:j]
            line += src.count("\n", i, j)
            i = j + 1
            continue
        i += 1


def load_exceptions() -> set[tuple[str, str]]:
    out = set()
    if ECCEZIONI.exists():
        for ln in ECCEZIONI.read_text(encoding="utf-8").splitlines():
            ln = ln.strip()
            if ln and not ln.startswith("#"):
                f, _, snippet = ln.partition("\t")
                out.add((f.strip(), snippet.strip()))
    return out


def italian_in(text: str) -> list[str]:
    words = re.findall(r"[A-Za-zÀ-ÿ]+", text)
    return [w for w in words if w.lower() in ITALIAN_WORDS]


def check_italian(errs: list, listing: bool) -> None:
    exc = load_exceptions()
    summary = []
    for p in source_files((".js", ".py")):
        rel = p.relative_to(ROOT).as_posix()
        if p.suffix == ".py" and not rel.startswith("mzlab/"):
            continue
        strict = rel in MIGRATED
        if not strict and not listing:
            continue
        hits = []
        if p.suffix == ".js":
            for ln, s in js_strings(p.read_text(encoding="utf-8", errors="replace")):
                w = italian_in(s)
                if w and not any(f == rel and sn in s for f, sn in exc):
                    hits.append((ln, w[0], s[:60]))
        if hits and strict:
            for ln, w, s in hits[:8]:
                errs.append(f"Italian outside the catalogs: {rel}:{ln} «{w}» in «{s}»")
        elif hits:
            summary.append((len(hits), rel))
    if listing:
        print("Files not yet migrated (strings with Italian words):")
        for n, rel in sorted(summary, reverse=True):
            print(f"  {n:5d}  {rel}")


# ---------------------------------------------------------------- glossary
def has_form(text: str, forms: list[str]) -> bool:
    for f in forms:
        if re.search(r"(?<![\wÀ-ÿ])" + re.escape(f) + r"(?![\wÀ-ÿ])", text, re.I):
            return True
    return False


def check_glossary(it: dict, en: dict, errs: list) -> None:
    g = json.loads((LANG / "glossario.json").read_text(encoding="utf-8"))
    fonti = g.get("fonti", {})
    for v in g["voci"]:
        if v.get("fonte") not in fonti:
            errs.append(f"glossary: entry «{v['id']}» without a known source")
        for k, itxt in it.items():
            if k not in en or not has_form(itxt, v["it"]):
                continue
            etxt = en[k]
            if not has_form(etxt, v["en"]):
                errs.append(f"glossary «{v['id']}»: {k}: Italian has «{v['it'][0]}», English must use one of {v['en']}  (en: «{etxt[:60]}»)")
            if has_form(etxt, v.get("evita_en", [])):
                errs.append(f"glossary «{v['id']}»: {k}: English uses a form to avoid {v['evita_en']}  (en: «{etxt[:60]}»)")


# ---------------------------------------------------------------- main
def run(listing: bool = False) -> list[str]:
    errs: list[str] = []
    try:
        it, en = load_catalog("it"), load_catalog("en")
    except Exception as e:  # noqa: BLE001
        return [f"catalogs: {e}"]
    for k in sorted(set(it) - set(en)):
        errs.append(f"missing in en.js: {k}")
    for k in sorted(set(en) - set(it)):
        errs.append(f"missing in it.js: {k}")
    for k in sorted(set(it) & set(en)):
        try:
            si, se = icu_signature(it[k]), icu_signature(en[k])
        except ValueError as e:
            errs.append(f"{k}: {e}")
            continue
        if si[0] != se[0]:
            errs.append(f"{k}: different placeholders (it {si[0]} / en {se[0]})")
    used, prefixes = used_keys()
    for k, files in sorted(used.items()):
        if k not in it or k not in en:
            errs.append(f"key used but not in the catalogs: {k}  ({', '.join(sorted(files))})")
    for k in sorted(set(it) | set(en)):
        if k not in used and not any(k.startswith(p) for p in prefixes):
            errs.append(f"orphan key (nobody uses it): {k}")
    check_static_html(it, errs)
    check_italian(errs, listing)
    check_glossary(it, en, errs)
    ctx = json.loads((LANG / "contesto.json").read_text(encoding="utf-8"))
    for k in sorted(it):
        if PARAM_RE.search(it[k]) and k not in ctx:
            errs.append(f"contesto.json: missing description for the key with parameters: {k}")
    return errs


def main() -> None:
    errs = run("--elenco" in sys.argv)
    if errs:
        print(f"i18n: {len(errs)} problems")
        for e in errs[:60]:
            print("  -", e)
        sys.exit(1)
    print("i18n: OK (catalogs, keys, HTML, glossary)")


if __name__ == "__main__":
    main()
