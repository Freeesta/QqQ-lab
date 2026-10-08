import sys

fpath = "mzlab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

old_logic = """    d.querySelectorAll('[class*="LeftToolbar-module_buttons"] > *, [class*="RightToolbar-module_buttons"] > *').forEach(g => {
      g.style.display = "";
      const bs = [...g.querySelectorAll("[data-testid]")];
      if (bs.length && bs.every(b => w.getComputedStyle(b).display === "none" || b.closest('[style*="display: none"]'))) g.style.display = "none";
    });"""

new_logic = """    d.querySelectorAll('[class*="LeftToolbar-module_buttons"] > *, [class*="RightToolbar-module_buttons"] > *').forEach(g => {
      g.style.display = "";
      const bs = [...g.querySelectorAll("[data-testid]")];
      if (bs.length === 0 || bs.every(b => w.getComputedStyle(b).display === "none" || b.closest('[style*="display: none"]'))) g.style.display = "none";
    });"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched separator logic in toolsOn()")
else:
    print("Failed to find logic in toolsOn()")

