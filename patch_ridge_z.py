import sys

fpath = "mzlab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_ridge_z = r"""    const dx = pw_r / (j1 - j0 + 1);
    const Z = 0.8 * ph_r; // max height of a peak"""
new_ridge_z = r"""    const dx = pw_r / (j1 - j0 + 1);
    const Z = 0.45 * ph_r; // max height of a peak"""
content = content.replace(old_ridge_z, new_ridge_z)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched Ridge Z")
