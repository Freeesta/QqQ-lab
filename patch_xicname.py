import sys

fpath = "mzlab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

old_xicname = r"""const xicName = q => { const t = q.traces[0]; return t && t.ion ? t.label + (q.traces.length > 1 ? " +" + (q.traces.length - 1) : "") : t ? "m/z " + (t.w != null ? Math.round(t.mz - (0.5 - XIC_BELOW)) : fmz(t.mz)) + (q.traces.length > 1 ? " +" + (q.traces.length - 1) : "") : "vuoto"; };"""
new_xicname = r"""const xicName = q => { const t = q.traces[0]; return t && t.ion ? t.label + (q.traces.length > 1 ? " +" + (q.traces.length - 1) : "") : t ? "m/z " + t.mz.toFixed(1) + (q.traces.length > 1 ? " +" + (q.traces.length - 1) : "") : "vuoto"; };"""

if old_xicname in content:
    content = content.replace(old_xicname, new_xicname)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched xicName!")
else:
    print("Not found xicName.")
