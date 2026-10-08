from playwright.sync_api import sync_playwright
import time
import subprocess

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    time.sleep(2)
    
    page.goto("http://localhost:8790/mzlab/web/index.html#disegno")
    page.wait_for_selector("#kframe")
    time.sleep(4)
    
    # Click select button
    frame = page.frame_locator("#kframe")
    select_btn = frame.locator('[class*="App-module_top"] [data-testid="select-drop-down-button"]')
    select_btn.click()
    time.sleep(1)
    
    select_btn.screenshot(path="tools/final_button.png")
    browser.close()
