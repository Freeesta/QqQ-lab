import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

# xicDirect patch
old_xicdirect = r"""  if (after && E.panels.includes(after)) { stackAfter(np, after); relayout(); fitHost(); }
  reveal(np); return np;"""

new_xicdirect = r"""  if (after && E.panels.includes(after)) {
    np.el.classList.add("drag"); np.y = after.y + after.h; np.el.style.top = np.y + "px"; void np.el.offsetHeight; np.el.classList.remove("drag");
    stackAfter(np, after); relayout(); fitHost(); 
  } else reveal(np);
  return np;"""

content = content.replace(old_xicdirect, new_xicdirect)

# openXic patch
old_openxic = r"""      np = addPanel("xic", { traces });
      if (pre.after && E.panels.includes(pre.after)) { stackAfter(np, pre.after); relayout(); fitHost(); }   // from a spectrum: the new XIC sits right under it
    }
    // the file: the one chosen in the window; with more than 3 ions and several files the panel starts on the selected file only (otherwise it is a tangle of lines)
    const keep = fsel.value !== "" ? E.files[+fsel.value] : traces.length > 3 && ff.length > 1 && ff.includes(E.files[E.cur]) ? E.files[E.cur] : null;
    if (keep) ff.forEach(f => { if (f !== keep) traces.forEach(t => { np.hid["x|" + f.k + "|" + t.mz] = true; }); });
    if (np === panel) draw(np); else reveal(np);"""

new_openxic = r"""      np = addPanel("xic", { traces });
      if (pre.after && E.panels.includes(pre.after)) { 
        np.el.classList.add("drag"); np.y = pre.after.y + pre.after.h; np.el.style.top = np.y + "px"; void np.el.offsetHeight; np.el.classList.remove("drag");
        stackAfter(np, pre.after); relayout(); fitHost(); 
      }
    }
    // the file: the one chosen in the window; with more than 3 ions and several files the panel starts on the selected file only (otherwise it is a tangle of lines)
    const keep = fsel.value !== "" ? E.files[+fsel.value] : traces.length > 3 && ff.length > 1 && ff.includes(E.files[E.cur]) ? E.files[E.cur] : null;
    if (keep) ff.forEach(f => { if (f !== keep) traces.forEach(t => { np.hid["x|" + f.k + "|" + t.mz] = true; }); });
    if (np === panel) draw(np); else if (!(pre.after && E.panels.includes(pre.after))) reveal(np);"""

content = content.replace(old_openxic, new_openxic)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)

