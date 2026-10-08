import sys

fpath = "qqq_lab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

# Let's completely replace the select-drop-down-button CSS with something minimalist.
import re

# Match the old CSS block we added
pattern = re.compile(r"""'\[class\*="App-module_top"\] \[data-testid="select-drop-down-button"\].*?'\s*\+\s*'\[class\*="App-module_top"\] \[data-testid="hand"\].*?';""", re.DOTALL)

# Minimalist fix:
# 1. Force the wrapper to 28x28 and overflow: hidden
# 2. Make the child button 28x28
# 3. If there is a chevron, it is naturally pushed outside by width constraints or we can target it.
minimal_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { height: 28px !important; width: 28px !important; overflow: hidden !important; border-radius: 4px; align-self: center; display: block !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] * { box-sizing: border-box; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > div, [class*="App-module_top"] [data-testid="select-drop-down-button"] > button { width: 28px !important; height: 28px !important; padding: 0 !important; margin: 0 !important; min-width: 0 !important; display: flex !important; align-items: center; justify-content: center; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';"""

if pattern.search(content):
    content = pattern.sub(minimal_css, content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced!")
else:
    print("Not found.")
