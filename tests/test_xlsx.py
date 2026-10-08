"""The home-made .xlsx writer (mzlab/web/xlsx.js): build a workbook with node, read it back with zipfile + XML (and openpyxl if installed)."""
import re
import shutil
import subprocess
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parent.parent / "mzlab" / "web" / "xlsx.js"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def build(tmp_path):
    out = tmp_path / "t.xlsx"
    code = f"""const x=require({str(JS)!r});
const u8=x.xlsxBuild([{{name:"Dati: 1/2 [prova]",head:["RT (min)","Intensità (cps)","Nome"],rows:[[1.5,3400.25,"a & b <c>"],[2,null,"  spazi  "],[NaN,1e-7,{{v:"grassetto",b:true}}]]}},
 {{name:"Dati: 1/2 [prova]",rows:[[{{v:"Pendenza",b:true}},123456789.123]]}}]);
require("fs").writeFileSync({str(out)!r},u8);"""
    subprocess.run(["node", "-e", code], check=True)
    return out


def test_xlsx_zip_and_cells(tmp_path):
    f = build(tmp_path)
    z = zipfile.ZipFile(f)
    assert z.testzip() is None                                   # CRC32 of every stored file is right
    assert all(i.compress_type == zipfile.ZIP_STORED for i in z.infolist())
    assert {"[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"} <= set(z.namelist())
    names = re.findall(r'<sheet name="([^"]*)"', z.read("xl/workbook.xml").decode())
    assert names == ["Dati- 1-2 -prova-", "Dati- 1-2 -prova-_2"]      # forbidden characters replaced, names unique
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    cells = {c.get("r"): c for c in root.iter("{%s}c" % NS["m"])}
    assert cells["A2"].find("m:v", NS).text == "1.5" and cells["A2"].get("t") is None   # number, not text
    assert cells["B2"].find("m:v", NS).text == "3400.25"
    assert "".join(cells["C2"].itertext()) == "a & b <c>"           # escaped in the XML, intact when read
    assert "B3" not in cells and "A4" not in cells                  # null and NaN: empty cells
    assert cells["B4"].find("m:v", NS).text == "1e-7"
    assert cells["A1"].get("s") == "1" and cells["C4"].get("s") == "1"   # bold header and bold cell


def test_xlsx_openpyxl_reads_it(tmp_path):
    openpyxl = pytest.importorskip("openpyxl")
    ws = openpyxl.load_workbook(build(tmp_path)).worksheets[0]
    assert ws["A1"].value == "RT (min)" and ws["A1"].font.b and ws["A2"].value == 1.5 and ws["B2"].value == 3400.25
    assert ws["C3"].value == "  spazi  " and ws["B4"].value == pytest.approx(1e-7)
    assert openpyxl.load_workbook(build(tmp_path)).worksheets[1]["B1"].value == pytest.approx(123456789.123)
