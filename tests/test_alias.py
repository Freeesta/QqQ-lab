"""Test the transition alias qqq_lab -> mzlab."""
import mzlab.chem.elements
import mzlab.ionfamily
import mzlab.reader.mzml
import qqq_lab.chem.elements
import qqq_lab.ionfamily
import qqq_lab.reader.mzml


def test_alias_identity():
    assert qqq_lab.reader.mzml is mzlab.reader.mzml
    assert qqq_lab.ionfamily is mzlab.ionfamily
    assert qqq_lab.chem.elements is mzlab.chem.elements
    assert qqq_lab.reader.mzml.Run is mzlab.reader.mzml.Run
