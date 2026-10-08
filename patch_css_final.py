import sys

fpath = "qqq_lab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re
pattern = re.compile(r"""'\[class\*="App-module_top"\] \[data-testid="select-drop-down-button"\].*?'\s*\+\s*'\[class\*="App-module_top"\] \[data-testid="hand"\].*?';""", re.DOTALL)

final_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { height: 28px !important; width: 28px !important; overflow: hidden !important; border-radius: 4px; align-self: center; display: flex !important; justify-content: flex-start !important; align-items: center !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] * { flex-shrink: 0 !important; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';"""

if pattern.search(content):
    content = pattern.sub(final_css, content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced with final!")
else:
    print("Not found.")
