"""Adduct shifts: the Python table (elements.ADDUCT_SHIFT) against values worked out by hand, and the same rounding rule used everywhere."""
import pytest
from qqq_lab.chem.elements import ADDUCT_SHIFT, MASS, ELECTRON, formula_mz, round_half_up
from qqq_lab import ionfamily

HAND = {   # exact shifts, worked out by hand from the monoisotopic masses (adduct mass minus charge x electron)
    "[M+H]+": 1.00782503 - 0.00054858, "[M+Na]+": 22.98976928 - 0.00054858, "[M+K]+": 38.9637064 - 0.00054858,
    "[M+NH4]+": 14.00307401 + 4 * 1.00782503 - 0.00054858, "[M-H]-": -1.00782503 + 0.00054858,
    "[M+Cl]-": 34.96885268 + 0.00054858, "[M+HCOO]-": 12 + 1.00782503 + 2 * 15.99491462 + 0.00054858,
}


@pytest.mark.parametrize("a,v", HAND.items())
def test_shift_by_hand(a, v):
    assert ADDUCT_SHIFT[a] == pytest.approx(v, abs=2e-6)


def test_xic_menu_adducts_are_all_known():
    for a in ["[M+H]+", "[M+NH4]+", "[M+Na]+", "[M+K]+", "[M-H]-", "[M+Cl]-", "[M+HCOO]-"]:
        assert a in ADDUCT_SHIFT


def test_same_shift_in_ionfamily():
    """Positive adducts shared with ionfamily.ADDUCTS (shift per M, charge 1) agree with elements.ADDUCT_SHIFT to 1e-4 (the two lists are kept aligned)."""
    for name, shift, mult in ionfamily.ADDUCTS:
        if mult == 1 and name in ADDUCT_SHIFT:
            assert shift == pytest.approx(ADDUCT_SHIFT[name], abs=1e-4), name


def test_nominal_and_half_up():
    assert round_half_up(364.15, 1) == 364.2 and round_half_up(0.25, 1) == 0.3 and round_half_up(200.5, 0) == 201.0 and round_half_up(2.675, 2) == 2.68
    r = formula_mz("C14H13F4N3O2S", "[M+H]+")
    assert r["adducts"]["[M+H]+"]["nominal"] == 364 and r["adducts"]["[M+Na]+"]["nominal"] == 386
