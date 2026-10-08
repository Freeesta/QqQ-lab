import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_hov = r"""         let val = im.v[idxSpec + k] || 0;
         gs.lineTo((k - j0)/(j1 - j0)*440, 200 - val*180);"""
new_hov = r"""         let val = im.v[idxSpec + k] || 0;
         let scaled = im.T(val);
         gs.lineTo((k - j0)/(j1 - j0)*440, 200 - scaled*180);"""
content = content.replace(old_hov, new_hov)

old_hov_xic = r"""         let val = im.v[k * A.nmz + j] || 0;
         gx.lineTo((k - i0)/(i1 - i0)*440, 200 - val*180);"""
new_hov_xic = r"""         let val = im.v[k * A.nmz + j] || 0;
         let scaled = im.T(val);
         gx.lineTo((k - i0)/(i1 - i0)*440, 200 - scaled*180);"""
content = content.replace(old_hov_xic, new_hov_xic)

# Also fix the Ridge Plot scaling!
old_ridge = r"""        let v = im.v[i * A.nmz + j] || 0;
        let px = pad + (j - j0) * dx;
        let py = baseY - Math.min(v * Z, Z * 1.5); // cap at 1.5x"""
new_ridge = r"""        let v = im.v[i * A.nmz + j] || 0;
        let scaled = im.T(v);
        let px = pad + (j - j0) * dx;
        let py = baseY - scaled * Z;"""
content = content.replace(old_ridge, new_ridge)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched scale")
