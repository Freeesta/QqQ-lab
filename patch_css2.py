import sys

fpath = "qqq_lab/web/draw.js"
with open(fpath, "r") as f:
    content = f.read()

# We fix the Select dropdown button wrapper so it doesn't stretch downwards
# We also ensure Hand, Erase, Text look perfect. 
# 28px is standard Ketcher button size.
fix_css = r"""'[class*="App-module_top"] [data-testid="select-drop-down-button"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; align-self: center; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > div { display: none !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] svg { margin: auto; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; } ';
      """

target = """'[class*="App-module_app"] [class*="BottomToolbar-module_group"]{flex-direction:column!important;height:auto!important;width:auto!important}';"""
if target in content:
    # Notice we change the semicolon at the end of the original to a plus, because we are concatenating
    content = content.replace(target, target[:-1] + " +\n      " + fix_css)
    with open(fpath, "w") as f:
        f.write(content)
    print("Patched draw.js!")
else:
    print("Not found.")
