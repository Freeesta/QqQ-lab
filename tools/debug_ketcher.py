from playwright.sync_api import sync_playwright
import time
import subprocess

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    srv = subprocess.Popen(["python3", "-m", "http.server", "8005"])
    time.sleep(1)
    
    page.goto("http://localhost:8005/mzlab/web/vendor/ketcher/index.html")
    page.wait_for_selector("[data-testid='left-toolbar-buttons'] [data-testid='select-drop-down-button']")
    
    # We want to run the exact logic from draw.js to see what happens
    js_code = """
    () => {
        const d = document;
        const st = d.createElement("style");
        st.textContent = '[data-testid="help-button"],[data-testid="about-button"]{display:none!important}' +
      '[class*="App-module_top"]{zoom:var(--ktz,1.1);flex-wrap:nowrap!important}' +
      '[class*="App-module_top"] kbd{display:none!important}' +
      '[class*="LeftToolbar-module_root"],[class*="RightToolbar-module_root"],[class*="BottomToolbar-module_root"]{zoom:var(--ksz,1.3)}' +
      '[class*="App-module_app"]{grid-template-columns:auto auto minmax(0,1fr) auto!important;grid-template-rows:auto minmax(0,1fr)!important;' +
      'grid-template-areas:"toolbar-top toolbar-top toolbar-top toolbar-top" "toolbar-bottom toolbar-left canvas toolbar-right"!important}' +
      '[class*="App-module_app"] [class*="BottomToolbar-module_root"]{flex-direction:column!important;flex-wrap:nowrap!important;align-self:start;height:auto!important;width:auto!important;padding:8px 0 8px 8px!important;margin:0!important}' +
      '[class*="App-module_app"] [class*="BottomToolbar-module_group"]{flex-direction:column!important;height:auto!important;width:auto!important}' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] { width: 28px !important; max-width: 28px !important; height: 28px !important; overflow: hidden !important; border-radius: 4px; align-self: center; padding: 0 !important; margin: 0 !important; display: block !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > button { width: 28px !important; height: 28px !important; padding: 0 !important; margin: 0 !important; border-radius: 4px; display: flex !important; align-items: center !important; justify-content: center !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > button svg { width: 16px !important; height: 16px !important; margin: 0 !important; flex-shrink: 0 !important; } ' +
      '[class*="App-module_top"] [data-testid="select-drop-down-button"] > svg { display: none !important; } ' +
      '[class*="App-module_top"] [data-testid="hand"], [class*="App-module_top"] [data-testid="erase"], [class*="App-module_top"] [data-testid="text"] { height: 28px !important; width: 28px !important; display: flex; align-items: center; justify-content: center; align-self: center; border-radius: 4px; padding: 0 !important; } ';
        d.head.appendChild(st);

        const cutBtn = d.querySelector('[class*="App-module_top"] [data-testid="cut-button"]');
        const hrCut = cutBtn ? cutBtn.nextElementSibling : null;
        const hand = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="hand"]');
        const selectDrop = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="select-drop-down-button"]');
        const erase = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="erase"]');
        const text = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="text"]');

        if (hrCut && hand && selectDrop && erase && text) {
          const hrNew = d.createElement("hr"); hrNew.className = hrCut.className;
          hrCut.after(hrNew);
          hrCut.after(text);
          hrCut.after(erase);
          hrCut.after(selectDrop);
          hrCut.after(hand);
        }
    }
    """
    page.evaluate(js_code)
    time.sleep(1) # wait for render
    
    # Let's inspect the button sizes and positions
    info = page.evaluate("""() => {
        const sel = document.querySelector('[class*="App-module_top"] [data-testid="select-drop-down-button"]');
        if(!sel) return "No sel";
        const btn = sel.querySelector('button');
        const svg = btn ? btn.querySelector('svg') : null;
        
        return {
            wrapper: sel.getBoundingClientRect(),
            button: btn ? btn.getBoundingClientRect() : null,
            svg: svg ? svg.getBoundingClientRect() : null,
            svgPath: svg ? svg.innerHTML : null,
            cssText: sel.style.cssText
        };
    }""")
    import json
    print(json.dumps(info, indent=2))

    srv.terminate()
    browser.close()
