import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

old_newspec = r"""function newSpec(from, r0, r1, k, link = from.id) {
  if (link) E.panels.filter(q => q.type === "spec" && q.link === from.id).forEach(freezeSpec);
  const s = addPanel("spec", { link, src: from.id, k, r0, r1, level: E.files[k]?.lv || 1, prec: from.tab === "ms2" ? from.prec : null, title: from.tab === "ms2" ? `Spettro degli ioni prodotto${from.prec != null ? " · " + from.prec : ""}` : "Spettro di massa" });
  stackAfter(s, from); relayout(); fitHost();
  reveal(s);
  return s;
}"""

new_newspec = r"""function newSpec(from, r0, r1, k, link = from.id) {
  if (link) E.panels.filter(q => q.type === "spec" && q.link === from.id).forEach(freezeSpec);
  const s = addPanel("spec", { link, src: from.id, k, r0, r1, level: E.files[k]?.lv || 1, prec: from.tab === "ms2" ? from.prec : null, title: from.tab === "ms2" ? `Spettro degli ioni prodotto${from.prec != null ? " · " + from.prec : ""}` : "Spettro di massa" });
  
  // Disable transition temporarily so it doesn't fly from the bottom
  s.el.classList.add("drag");
  s.y = from.y + from.h;
  s.el.style.top = s.y + "px";
  void s.el.offsetHeight; // force reflow
  s.el.classList.remove("drag");
  
  stackAfter(s, from); relayout(); fitHost();
  // Do NOT reveal(s) so the viewport does not shift randomly
  return s;
}"""

if old_newspec in content:
    content = content.replace(old_newspec, new_newspec)
    print("Patched newSpec!")
else:
    print("newSpec not found.")

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
