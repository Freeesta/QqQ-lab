from mzlab.chem.elements import normalize_formula, parse_formula, formula_mz


def test_lower_case_formula():
    assert normalize_formula("c9h10cl2n2o") == "C9H10Cl2N2O"
    assert normalize_formula("C9h10Cl2n2O") == "C9H10Cl2N2O"
    assert normalize_formula("co") == "CO" and parse_formula("co") == {"C": 1, "O": 1}      # not cobalt
    assert parse_formula("Cl") == {"Cl": 1}                                              # a correct two-letter symbol is kept
    assert normalize_formula("nacl") == "NaCl" and normalize_formula("hbr") == "HBr"
    assert normalize_formula("ch3(oh)2") == "CH3(OH)2" and normalize_formula(" c2 h6 o ") == "C2H6O"
    assert formula_mz("c9h10cl2n2o")["formula"] == formula_mz("C9H10Cl2N2O")["formula"]


def test_case_already_right_is_unchanged():
    for f in ["C14H13F4N3O2S", "C(OH)2", "NaCl", "C9H10Cl2N2O"]:
        assert normalize_formula(f) == f
