from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    import subprocess, time
    srv = subprocess.Popen(["python3", "-m", "http.server", "8006"])
    time.sleep(1)
    
    page.goto("http://localhost:8006/mzlab/web/vendor/ketcher/index.html")
    page.wait_for_selector("[data-testid='left-toolbar-buttons'] [data-testid='select-drop-down-button']")
    
    # Do NOT inject anything, just take screenshot of default Ketcher left toolbar
    loc = page.locator("[data-testid='left-toolbar-buttons']")
    loc.screenshot(path="tools/ketcher_default.png")
    
    # Now click the select button to make it active
    page.click("[data-testid='select-drop-down-button']")
    time.sleep(0.5)
    loc.screenshot(path="tools/ketcher_active.png")

    srv.terminate()
    browser.close()
