"""Every entry of the built-in contaminants list has an English name and class (contaminants_en.json): a new entry without them fails here."""
import json
from pathlib import Path

D = Path(__file__).resolve().parent.parent / "mzlab" / "chem"


def test_every_entry_has_english_name_and_class():
    d = json.loads((D / "contaminants.json").read_text(encoding="utf-8"))
    en = json.loads((D / "contaminants_en.json").read_text(encoding="utf-8"))
    ids = [e["id"] for e in d["entries"]]
    assert not [i for i in ids if not en["names"].get(i)], "entries without an English name"
    assert not [e["class"] for e in d["entries"] if e["class"] not in en["classes"]], "classes without an English name"
    assert not set(en["names"]) - set(ids), "English names of entries that do not exist"
    assert en["list"]["name"] and en["list"]["license"]


def test_builtin_carries_english_fields():
    import sys
    sys.path.insert(0, str(D.parent.parent))
    from mzlab.chem.contaminants import builtin
    b = builtin()
    assert b["name_en"] and all(i["name_en"] for i in b["items"] if not i.get("mzonly")) and all(i["cls_en"] for i in b["items"])
