# TPMINE-PRIVATE
"""mzFinder M2 (public, synthetic): points on the difference map, co-elution groups, roles with proof, time course."""
import base64

import numpy as np

from tpmine import esperti as X

LOSSES = ["H2O", "NH3", "CO2"]
TIMES = [0, 5, 10, 30, 60]


def gauss(rt0, h, sd=0.04, lo=0.0, hi=4.0, step=0.01):
    rt = np.arange(lo, hi, step)
    return {"rt": rt.tolist(), "y": (h * np.exp(-0.5 * ((rt - rt0) / sd) ** 2)).tolist()}


def point(mz, ia, rt=2.0, factor=None):
    """A point with its XIC in every file; `factor` = intensity of this ion in each file (default: the same course as the main ion)."""
    f = factor if factor is not None else [0.2, 0.6, 1.0, 0.7, 0.3]
    return {"rt": rt, "mz": mz, "diff": ia, "ia": ia, "traces": {str(k): gauss(rt, ia * v) for k, v in enumerate(f)}}


FILES = [{"k": k, "time": t, "label": f"t{t}"} for k, t in enumerate(TIMES)]


def roles(rows):
    return {round(r["mz"], 2): r["role"] for r in rows}


def test_isotope_adduct_fragment_roles_lr():
    pts = [point(300.0, 1e6), point(301.0, 2e5), point(321.98, 3e5), point(282.0, 4e5)]
    rows = X.analyse(pts, FILES, hr=False, loss_formulas=LOSSES)
    assert len({r["g"] for r in rows}) == 1                                       # one co-elution group
    r = roles(rows)
    assert r[300.0] == "main ion"
    assert r[301.0].startswith("isotope of") and r[321.98].startswith("adduct of") and r[282.0].startswith("possible in-source fragment of")
    fr = next(x for x in rows if round(x["mz"]) == 282)
    assert "H2O" in fr["proof"] and fr["of"] == 1 and all(x["r"] >= 0.9 for x in rows)


def test_roles_hr_use_ppm():
    mz = 300.1234
    pts = [point(mz, 1e6), point(mz + X.ISO_HR + mz * 1e-6, 2e5), point(mz + X.ADDUCTS["Na-H"] - mz * 2e-6, 3e5)]
    r = roles(X.analyse(pts, FILES, hr=True, ppm=5.0, loss_formulas=LOSSES))
    vals = list(r.values())
    assert vals[0] == "main ion" and vals[1].startswith("isotope of") and vals[2].startswith("adduct of")
    far = X.analyse([point(mz, 1e6), point(mz + 1.0200, 2e5)], FILES, hr=True, ppm=5.0, loss_formulas=LOSSES)          # +1.02 is not the 13C spacing
    assert not far[1]["role"].startswith("isotope")


def test_fragment_needs_constant_ratio():
    # a product forming over time shares the loss mass with the main ion but its area does not follow it: no «frammento»
    pts = [point(300.0, 1e6), point(282.0, 4e5, factor=[0.0, 0.1, 0.5, 1.0, 1.0])]
    rows = X.analyse(pts, FILES, hr=False, loss_formulas=LOSSES)
    assert not rows[1]["role"].startswith("possible in-source fragment")


def test_no_group_without_coelution_or_shape():
    far = X.analyse([point(300.0, 1e6, rt=2.0), point(301.0, 2e5, rt=2.5)], FILES, hr=False, loss_formulas=LOSSES)
    assert [r["role"] for r in far] == ["isolated", "isolated"] and far[0]["g"] != far[1]["g"]
    other = point(301.0, 2e5)
    other["traces"] = {k: gauss(2.03, 2e5 * 0.5, sd=0.15) for k in other["traces"]}                      # close apex, very different shape
    rows = X.analyse([point(300.0, 1e6), other], FILES, hr=False, loss_formulas=LOSSES, th={"r_min": 0.99})
    assert rows[0]["g"] != rows[1]["g"]


def test_trend_shapes():
    assert X.trend_shape(TIMES, [10, 50, 100, 60, 20]) == "rises then falls"
    assert X.trend_shape(TIMES, [5, 20, 50, 80, 100]) == "rises"
    assert X.trend_shape(TIMES, [100, 70, 40, 20, 5]) == "falls"
    assert X.trend_shape(TIMES, [100, 95, 105, 98, 100]) == "constant"
    assert X.trend_shape([0, 5], [1, 2]) == ""                                                             # too few files for a shape
    rows = X.analyse([point(300.0, 1e6)], FILES, hr=False)
    assert rows[0]["trend"] == "rises then falls" and rows[0]["role"] == "isolated" and 0 < rows[0]["score"] <= 100


def test_find_points_on_a_difference_map():
    nrt, nmz = 200, 120
    rt0, rt1, mz0, dmz = 0.0, 10.0, 200.0, 1.0
    rng = np.random.default_rng(1)
    b = rng.uniform(0, 50, (nrt, nmz))
    a = b.copy()
    i, j = 80, 40                                                                                           # one real new peak: A >> B
    for di, w in zip(range(-2, 3), [0.3, 0.8, 1.0, 0.8, 0.3]):
        a[i + di, j] += 5e4 * w
    a[150, 90] += 5e4
    b[150, 90] += 4.5e4                                                                                     # present in both: ratio A/B too small
    pts = X.find_points(a - b, a, rt0, rt1, mz0, dmz)
    assert len(pts) == 1 and abs(pts[0]["rt"] - 4.025) < 0.06 and abs(pts[0]["mz"] - 240.5) < 0.6
    assert pts[0]["ratio"] > 100 and pts[0]["width"] >= 0.1
    assert X.find_points(a - b, a, rt0, rt1, mz0, dmz, {"min_ratio": 1.05})[0]["rt"] != 0                  # a looser threshold lets more through
    assert len(X.find_points(a - b, a, rt0, rt1, mz0, dmz, {"min_ratio": 1.05})) == 2
    assert X.find_points(np.zeros((2, 2)), np.zeros((2, 2)), 0, 1, 0, 1) == []


def test_grid_decoding_and_thresholds():
    g = np.arange(6, dtype="<f4").reshape(2, 3)
    assert np.array_equal(X._grid(base64.b64encode(g.tobytes()).decode(), 2, 3), g)
    assert X.soglie({"r_min": 0.8, "zzz": 1})["r_min"] == 0.8 and "zzz" not in X.soglie({"zzz": 1})


def test_hr_subformula_coherence():
    mz = 300.1234
    a, b = point(mz, 1e6), point(mz - 18.010565, 4e5)
    a["forms"], b["forms"] = ["C15H18NO5"], ["C15H16NO4"]
    rows = X.analyse([a, b], FILES, hr=True, ppm=5.0, loss_formulas=LOSSES)
    assert rows[1]["role"].startswith("possible in-source fragment") and "C15H18NO5 − H2O = C15H16NO4" in rows[1]["proof"]
    b["forms"] = ["C14H20N2O4"]
    assert "sottoformula" not in X.analyse([a, b], FILES, hr=True, ppm=5.0, loss_formulas=LOSSES)[1]["proof"]


def test_feature_card_edges_areas_and_peaks():
    f = X.feature({"rt": 2.0, "mz": 300.0}, FILES, point(300.0, 1e6)["traces"], members=[{"n": 2, "rt": 2.0, "mz": 301.0}],
                  spectrum={"mz": [250.0, 300.0, 301.0, 320.0], "y": [5.0, 100.0, 20.0, 7.0]}, hr=False)
    assert [o["label"] for o in f["files"]] == [x["label"] for x in FILES]
    big = f["files"][2]                                                          # t10: factor 1.0, gaussian sd 0.04
    assert abs(big["apex"] - 2.0) < 0.02 and 1.7 < big["a"] < 1.95 and 2.05 < big["b"] < 2.3
    assert abs(big["area"] - 1e6 * 0.04 * (2 * np.pi) ** 0.5) / big["area"] < 0.1  # area of a gaussian h * sd * sqrt(2 pi)
    assert f["trend"] == "rises then falls" and f["areas"][2] == max(f["areas"])
    marks = {round(p["mz"]): p["mark"] for p in f["peaks"]}
    assert marks[300] == 0 and marks[301] == 2 and marks[250] is None and marks[320] is None


def test_feature_without_trace_is_zero():
    f = X.feature({"rt": 2.0, "mz": 300.0}, FILES[:2], {"0": gauss(2.0, 10)})
    assert f["files"][1]["area"] == 0.0 and f["files"][0]["area"] > 0
