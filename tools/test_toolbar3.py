from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    import subprocess, time
    srv = subprocess.Popen(["python3", "-m", "http.server", "8010"])
    time.sleep(1)
    
    page.goto("http://localhost:8010/mzlab/web/vendor/ketcher/index.html")
    # Wait for Ketcher to load
    page.wait_for_selector("[data-testid='left-toolbar-buttons']")
    time.sleep(1)
    
    # Run draw.js's hideMacro equivalent logic with my NEW CSS (which is currently in draw.js!)
    with open("mzlab/web/draw.js") as f:
        draw_js = f.read()
        import re
        # extract the st.textContent assignment
        match = re.search(r'st\.textContent = (\[.*?\';)', draw_js, re.DOTALL)
        css_code = match.group(1) if match else "''"
        
    js_code = f"""
    () => {{
        const d = document;
        const st = d.createElement("style");
        st.textContent = {css_code}
        d.head.appendChild(st);

        const cutBtn = d.querySelector('[class*="App-module_top"] [data-testid="cut-button"]');
        const hrCut = cutBtn ? cutBtn.nextElementSibling : null;
        const hand = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="hand"]');
        const selectDrop = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="select-drop-down-button"]');
        const erase = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="erase"]');
        const text = d.querySelector('[data-testid="left-toolbar-buttons"] [data-testid="text"]');

        if (hrCut && hand && selectDrop && erase && text) {{
          const hrNew = d.createElement("hr"); hrNew.className = hrCut.className;
          hrCut.after(hrNew);
          hrCut.after(text);
          hrCut.after(erase);
          hrCut.after(selectDrop);
          hrCut.after(hand);
        }}
    }}
    """
    page.evaluate(js_code)
    time.sleep(1)
    # Click the select button now in the top toolbar
    page.click('[class*="App-module_top"] [data-testid="select-drop-down-button"]')
    time.sleep(0.5)
    page.locator('[class*="App-module_top"] [data-testid="select-drop-down-button"]').screenshot(path="tools/sim_top_toolbar_fixed.png")

    srv.terminate()
    browser.close()
