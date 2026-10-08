from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    import subprocess, time
    srv = subprocess.Popen(["python3", "-m", "http.server", "8007"])
    time.sleep(1)
    
    # Load the actual app interface
    page.goto("http://localhost:8007/mzlab/web/index.html")
    # Wait for Ketcher to load inside iframe
    page.wait_for_selector("#kframe")
    
    # We need to switch to draw mode to see the toolbar
    # Wait for the button or click it
    page.evaluate("() => { window.location.hash = '#disegno'; }")
    time.sleep(3)
    
    # Now grab a screenshot of the top toolbar inside the iframe
    frame = page.frame_locator("#kframe")
    top_toolbar = frame.locator('[class*="App-module_top"]')
    top_toolbar.screenshot(path="tools/app_toolbar.png")

    srv.terminate()
    browser.close()
