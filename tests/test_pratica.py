"""Pratica (qqq_lab/web/teoria/pratica/motore.js): pure functions run with node, compared with qqq_lab.chem.elements."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from qqq_lab.chem.elements import parse_formula, mass

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "qqq_lab" / "web"
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node non installato")


def run(js: str):
    prog = ("const fs=require('fs');global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};"
            f"eval(fs.readFileSync({json.dumps(str(WEB / 'elements.js'))},'utf8').replace('const ELEMENTS','global.ELEMENTS'));"
            f"const PAL=require({json.dumps(str(WEB / 'teoria' / 'pratica' / 'motore.js'))});"
            f"console.log(JSON.stringify((()=>{{{js}}})()));")
    out = subprocess.run(["node", "-e", prog], capture_output=True, encoding="utf-8", timeout=60)
    assert out.returncode == 0, out.stderr
    return json.loads(out.stdout)


def test_formula_helpers_agree_with_python():
    fs = ["C6H5Cl", "C8H14ClN5", "C2H6S2", "C16H22O4", "CCl4", "C6H6"]
    r = run(f"return {json.dumps(fs)}.map(f=>{{const p=PAL.parse(f);return [PAL.nominal(p),PAL.rdb(p),PAL.exact(p),PAL.fstr(p)]}})")
    for f, (nom, rdb, ex, s) in zip(fs, r):
        assert abs(ex - mass(parse_formula(f))) < 1e-4, f
        assert nom == round(mass(parse_formula(f))) and s == f
    assert r[0][1] == 4 and r[1][1] == 4 and r[4][1] == 0
    assert run("return [PAL.parse('C6h6'), PAL.parse('Xy2'), PAL.parse('C₆H₆')]") == [None, None, {"C": 6, "H": 6}]


def test_isotope_patterns():
    r = run("return [PAL.isoPattern(PAL.parse('C6H5Cl')), PAL.isoPattern(PAL.parse('CH2Cl2')), PAL.isoPattern(PAL.parse('C6H5Br')), PAL.isoPattern(PAL.parse('C10H8'))]")
    cl, cl2, br, naph = r
    assert abs(cl[2] - 32.6) < 1.0 and abs(cl[1] - 6.6) < 0.4          # 35/37Cl + 6 C
    assert abs(cl2[2] - 64) < 1.5 and abs(cl2[4] - 10.2) < 0.8
    assert abs(br[2] - 97.9) < 1.5
    assert abs(naph[1] - 10.9) < 0.4


def test_engine_elo_spacing_and_codes():
    r = run("""
      const a = PAL.record('t','x',0,{M:1},100), s1 = PAL.skill('M');
      PAL.record('t','y',0,{M:0},0); const s2 = PAL.skill('M');
      const r1 = PAL.rng(42), r2 = PAL.rng(42);
      const items=[{id:'a',d0:-1,skills:['M']},{id:'b',d0:2,skills:['M']}];
      return {th1:s1.th, th2:s2.th, box:a.box, code:PAL.code(123456789), back:PAL.seedOf(PAL.code(123456789)), same:r1()===r2(), pick:PAL.pick('t2',items,{rng:()=>0.5}).id};
    """)
    assert r["th1"] > 0 and r["th2"] < r["th1"] and r["box"] == 1
    assert r["back"] == 123456789 % (32 ** 5) and len(r["code"]) == 5 and r["same"]
    assert r["pick"] == "a"           # with theta = 0 the easier item has p closer to 0.7


def run_games(js: str):
    """Like run(), with the short games (pratica/giochi.js) and the question bank (pratica/domande.js) loaded."""
    pre = (f"global.PAL=PAL;const GIOCHI=require({json.dumps(str(WEB / 'teoria' / 'pratica' / 'giochi.js'))});"
           f"const DOMANDE=require({json.dumps(str(WEB / 'teoria' / 'pratica' / 'domande.js'))});")
    return run(pre + js)


def test_question_bank_of_the_oral():
    r = run_games("return {d: DOMANDE.map(d=>({id:d.id,area:d.area,skill:d.skill,cap:d.cap,n:d.p.length})), skills: Object.keys(PAL.SKILLS)}")
    ids = [d["id"] for d in r["d"]]
    assert len(ids) == len(set(ids)) and len(ids) >= 35
    for d in r["d"]:
        assert d["area"] in {"sep", "ion", "anal", "hr", "dati", "ei"}, d
        assert d["skill"] in r["skills"], d
        assert (WEB / "teoria" / d["cap"]).is_file(), d
        assert 3 <= d["n"] <= 7, d
    for area in ("sep", "ion", "anal", "hr", "dati", "ei"):     # the oral simulation draws one question from each group
        assert sum(d["area"] == area for d in r["d"]) >= 4, area


def test_neutral_losses_and_formula_enumeration():
    r = run_games("""
      const L = GIOCHI.LOSSES.map(l => [l.f, l.nom, l.ex, !!l.r]);
      const m = PAL.exact(PAL.parse('C10H14NO2')) - 0.00054858;           // an [M+H]+ ion
      const c = GIOCHI.enumerate(m, 5).map(x => PAL.fstr(x.f));
      return {L, c};
    """)
    for f, nom, ex, rad in r["L"]:
        assert nom == round(mass(parse_formula(f))) and abs(ex - mass(parse_formula(f))) < 1e-4, f
        assert (sum(n for e, n in dict(parse_formula(f)).items() if e in ("H", "Cl", "Br", "F", "N")) % 2 == 1) == rad, f   # radicals: odd count of odd-valence atoms
    assert "C10H14NO2" in r["c"]


def test_quadrupole_stability_boundaries():
    r = run_games("""
      const apex = [0.706, GIOCHI.aTop(0.706)], edge = GIOCHI.aTop(0.908);
      return {apex, edge, k: GIOCHI.KQ, s1: GIOCHI.stable(0.1, 0.5), s2: GIOCHI.stable(0.25, 0.706), w: GIOCHI.windowQ(0)};
    """)
    assert abs(r["apex"][1] - 0.237) < 0.002 and abs(r["edge"]) < 0.002
    assert abs(r["k"] - 0.611) < 0.002                 # r0 = 4 mm, 1 MHz: q = 0.611 V/(m/z)
    assert r["s1"] and not r["s2"]
    assert abs(r["w"][1] - 0.908) < 0.002              # RF only: everything up to q = 0.908
