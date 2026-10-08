import sys

fpath = "mzlab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re
pattern = re.compile(r"""'\[class\*="App-module_top"\] \[data-testid="select-drop-down-button"\].*?'\s*\+\s*'\[class\*="App-module_top"\] \[data-testid="hand"\].*?';""", re.DOTALL)

# Extremely safe and non-invasive CSS for the button.
# - Just limit the size of the container.
# - Center its content.
ultra_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { width: 28px !important; max-width: 28px !important; height: 28px !important; overflow: hidden !important; border-radius: 4px; align-self: center; padding: 0 !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] svg { width: 16px !important; height: 16px !important; margin: 0 0 0 6px !important; flex-shrink: 0 !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] svg:nth-of-type(n+2), [class*="App-module_top"] [data-testid="select-drop-down-button"] svg ~ svg { display: none !important; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';"""

if pattern.search(content):
    content = pattern.sub(ultra_css, content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced with ultra2!")
else:
    print("Not found.")
