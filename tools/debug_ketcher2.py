from playwright.sync_api import sync_playwright
import time
import subprocess

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    srv = subprocess.Popen(["python3", "-m", "http.server", "8011"])
    time.sleep(1)
    
    page.goto("http://localhost:8011/mzlab/web/vendor/ketcher/index.html")
    page.wait_for_selector('[class*="App-module_top"]')
    
    html = page.evaluate("""() => {
        const top = document.querySelector('[class*="App-module_top"]');
        return top ? top.outerHTML : "NO TOP";
    }""")
    print("TOP DOM:\n" + html)

    srv.terminate()
    browser.close()
