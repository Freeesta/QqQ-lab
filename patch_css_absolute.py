import sys

fpath = "qqq_lab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re
pattern = re.compile(r"""'\[class\*="App-module_top"\] \[data-testid="select-drop-down-button"\].*?'\s*\+\s*'\[class\*="App-module_top"\] \[data-testid="select-drop-down-button"\] svg:nth-of-type\(n\+2\).*?';""", re.DOTALL)

absolute_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { height: 28px !important; width: 28px !important; overflow: hidden !important; border-radius: 4px; align-self: center; display: block !important; position: relative !important; padding: 0 !important; margin: 0 !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] * { display: block !important; position: static !important; width: 100% !important; height: 100% !important; padding: 0 !important; margin: 0 !important; background: transparent !important; border: none !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] svg { position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 16px !important; height: 16px !important; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';"""

if pattern.search(content):
    content = pattern.sub(absolute_css, content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced with absolute!")
else:
    print("Not found.")
