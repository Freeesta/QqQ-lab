import sys

fpath = "mzlab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_drawmap = r"""  if (p.view === "ridge") {"""

new_drawmap = r"""  if (p.view === "cross") {
    if (!p._cspec) {
      p._cspec = document.createElement("canvas"); p._cspec.style.cssText = "position:absolute; top:40px; right:20px; width:220px; height:100px; background:rgba(255,255,255,0.85); border:1px solid var(--line); border-radius:4px; pointer-events:none; z-index:10; box-shadow:0 2px 6px rgba(0,0,0,0.15);"; p._cspec.width = 440; p._cspec.height = 200;
      p._cxic = document.createElement("canvas"); p._cxic.style.cssText = "position:absolute; bottom:40px; right:20px; width:220px; height:100px; background:rgba(255,255,255,0.85); border:1px solid var(--line); border-radius:4px; pointer-events:none; z-index:10; box-shadow:0 2px 6px rgba(0,0,0,0.15);"; p._cxic.width = 440; p._cxic.height = 200;
      p.el.appendChild(p._cspec); p.el.appendChild(p._cxic);
    }
  } else {
    if (p._cspec) { p._cspec.remove(); p._cspec = null; }
    if (p._cxic) { p._cxic.remove(); p._cxic = null; }
  }

  if (p.view === "ridge") {"""

content = content.replace(old_drawmap, new_drawmap)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched robustness")
