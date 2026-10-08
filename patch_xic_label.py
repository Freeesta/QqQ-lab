import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

# In xicDirect:
old_xicdirect = r"""const [a, b] = xicWin(mz, true), c = rh((a + b) / 2, 2), w = rh((b - a) / 2, 2), lab = `m/z ${fmz(a)}-${fmz(b)}`;"""
new_xicdirect = r"""const [a, b] = xicWin(mz, true), c = rh((a + b) / 2, 2), w = rh((b - a) / 2, 2), lab = `m/z ${c.toFixed(1)}`;"""

if old_xicdirect in content:
    content = content.replace(old_xicdirect, new_xicdirect)
    print("Patched xicDirect label!")
else:
    print("xicDirect not found.")

# Also in the regular "openXic" dialog if the user clicks XIC button and types a mass:
# In openXic:
old_openxic = r"""traces.push({ id: E.seq++, mz, w, label: (r.label ? r.label + " · " : "") + `m/z ${fmz(a)}-${fmz(b)}` });"""
new_openxic = r"""traces.push({ id: E.seq++, mz, w, label: (r.label ? r.label + " · " : "") + `m/z ${mz.toFixed(1)}` });"""

if old_openxic in content:
    content = content.replace(old_openxic, new_openxic)
    print("Patched openXic label!")
else:
    print("openXic not found.")


with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
