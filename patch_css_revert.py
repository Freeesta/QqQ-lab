import sys

fpath = "qqq_lab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re
pattern = re.compile(r"""'\[class\*="App-module_top"\] \[data-testid="select-drop-down-button"\].*?'\s*\+\s*'\[class\*="App-module_top"\] \[data-testid="hand"\].*?';""", re.DOTALL)

# Revert to a super simple height constrainer that doesn't mess with internal layout at all,
# EXCEPT setting max-width to 28px to prevent horizontal elongation, and centering the inner elements.
simple_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"], [class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; max-width: 28px !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; overflow: hidden !important; border-radius: 4px !important; align-self: center !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > * { flex-shrink: 0 !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] svg:nth-of-type(n+2) { display: none !important; } ';"""

if pattern.search(content):
    content = pattern.sub(simple_css, content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced with simple!")
else:
    print("Not found.")
