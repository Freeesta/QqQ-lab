from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    import subprocess, time
    srv = subprocess.Popen(["python3", "-m", "http.server", "8001"])
    time.sleep(1)
    
    page.goto("http://localhost:8001/mzlab/web/vendor/ketcher/index.html")
    page.wait_for_selector("[data-testid='left-toolbar-buttons'] [data-testid='select-drop-down-button']")
    html = page.locator("[data-testid='left-toolbar-buttons'] [data-testid='select-drop-down-button']").evaluate("el => el.outerHTML")
    print("DOM:\n" + html)
    
    srv.terminate()
    browser.close()
