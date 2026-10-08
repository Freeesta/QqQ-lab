import sys

fpath = "mzlab/web/draw.js"
with open(fpath, "r") as f:
    content = f.read()

# We want to add a CSS rule to fix the alignment of moved tools
fix_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"], ' +
      '[class*="App-module_top"] [data-testid="hand"], ' +
      '[class*="App-module_top"] [data-testid="erase"], ' +
      '[class*="App-module_top"] [data-testid="text"] { display: flex; align-items: center; justify-content: center; height: 24px; width: 24px; padding: 0; box-sizing: border-box; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > button, ' +
      '[class*="App-module_top"] [data-testid="hand"] > button, ' +
      '[class*="App-module_top"] [data-testid="erase"] > button, ' +
      '[class*="App-module_top"] [data-testid="text"] > button { height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; } ' +
      """

target = """'[class*="App-module_app"] [class*="BottomToolbar-module_group"]{flex-direction:column!important;height:auto!important;width:auto!important}';"""
if target in content:
    content = content.replace(target, target + "\n      " + fix_css)
    with open(fpath, "w") as f:
        f.write(content)
    print("Patched!")
else:
    print("Not found.")
