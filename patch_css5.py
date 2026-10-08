import sys

fpath = "mzlab/web/draw.js"
with open(fpath, "r") as f:
    content = f.read()

old_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: flex-start; overflow: hidden; border-radius: 4px; align-self: center; padding: 0 !important; position: relative; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] button { height: 28px !important; width: 28px !important; min-width: 28px !important; padding: 0 !important; margin: 0 !important; flex: none !important; border: none !important; display: flex; justify-content: center; align-items: center; background: transparent; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] svg { width: 18px !important; height: 18px !important; display: block !important; margin: auto !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > *:not(button):not(svg) { display: none !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] button svg:nth-of-type(n+2) { display: none !important; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';"""

new_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: flex-start; overflow: hidden !important; border-radius: 4px; align-self: center; padding: 0 !important; position: relative; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] button { height: 28px !important; width: 28px !important; min-width: 28px !important; padding: 0 !important; margin: 0 !important; flex: none !important; border: none !important; background: transparent; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';"""

if old_css in content:
    content = content.replace(old_css, new_css)
    with open(fpath, "w") as f:
        f.write(content)
    print("Replaced draw.js!")
else:
    print("Not found draw.js.")
