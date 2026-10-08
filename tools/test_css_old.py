from playwright.sync_api import sync_playwright

css_injection = """
[data-testid="select-drop-down-button"] { width: 28px !important; max-width: 28px !important; height: 28px !important; overflow: hidden !important; border-radius: 4px; align-self: center; padding: 0 !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; }
[data-testid="select-drop-down-button"] svg { width: 16px !important; height: 16px !important; margin: 0 0 0 6px !important; flex-shrink: 0 !important; }
[data-testid="select-drop-down-button"] svg:nth-of-type(n+2), [data-testid="select-drop-down-button"] svg ~ svg { display: none !important; }
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    import subprocess, time
    srv = subprocess.Popen(["python3", "-m", "http.server", "8004"])
    time.sleep(1)
    
    page.goto("http://localhost:8004/mzlab/web/vendor/ketcher/index.html")
    page.wait_for_selector("[data-testid='left-toolbar-buttons'] [data-testid='select-drop-down-button']")
    
    # Inject our new CSS
    page.evaluate(f"""() => {{
        const st = document.createElement('style');
        st.textContent = `{css_injection}`;
        document.head.appendChild(st);
    }}""")
    
    # Take screenshot of the button
    loc = page.locator("[data-testid='left-toolbar-buttons'] [data-testid='select-drop-down-button']")
    loc.screenshot(path="tools/button_broken.png")
    
    srv.terminate()
    browser.close()
