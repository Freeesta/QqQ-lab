import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_leg2 = r"""  if (p.leg2) p.leg2.innerHTML = (data.length > 1 ? data.map(x => `<span><i style="background:${x.f.color}"></i>${EH(x.f.label)}${legPol(x.f)}</span>`).join("") : "") + isoNote;   // inside the graph, top right; one file = no legend"""

new_leg2 = r"""  const multiFiles = scanFiles(tabFiles(p.tab)).length > 1;
  const showLabel = data.length > 1 || multiFiles;
  if (p.leg2) p.leg2.innerHTML = (showLabel ? data.map(x => { const lab = x.f.label.length > 25 ? x.f.label.slice(0, 24) + "…" : x.f.label; return `<span><i style="background:${x.f.color}"></i>${EH(lab)}${legPol(x.f)}</span>`; }).join("") : "") + isoNote;"""

if old_leg2 in content:
    content = content.replace(old_leg2, new_leg2)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched drawSpec legend!")
else:
    print("drawSpec legend not found.")
