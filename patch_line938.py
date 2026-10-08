import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

old_line = r"""        t.mz = rh((lo + hi) / 2, hrE ? 5 : 2); t.w = rh((hi - lo) / 2, hrE ? 5 : 2); t.label = `m/z ${hrE ? lo.toFixed(d) + "-" + hi.toFixed(d) : fmz(lo) + "-" + fmz(hi)}`; delete t.ion; delete t.obs;"""
new_line = r"""        t.mz = rh((lo + hi) / 2, hrE ? 5 : 2); t.w = rh((hi - lo) / 2, hrE ? 5 : 2); t.label = `m/z ${hrE ? t.mz.toFixed(4) : t.mz.toFixed(1)}`; delete t.ion; delete t.obs;"""

if old_line in content:
    content = content.replace(old_line, new_line)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched line 938!")
else:
    print("Not found line 938.")

