import sys

fpath_js = "mzlab/web/explore.js"
with open(fpath_js, "r", encoding="utf-8") as f:
    js_content = f.read()

old_js = """    clearTimeout(ldSlow); setTimeout(() => { L.hidden = true; clearInterval(ldTimer); clearInterval(ldDotTimer); ldTimer = null; }, wait);"""
new_js = """    clearTimeout(ldSlow); setTimeout(() => {
      L.classList.add("fade-out");
      setTimeout(() => { L.hidden = true; L.classList.remove("fade-out"); clearInterval(ldTimer); clearInterval(ldDotTimer); ldTimer = null; }, 400);
    }, wait);"""

if old_js in js_content:
    with open(fpath_js, "w", encoding="utf-8") as f:
        f.write(js_content.replace(old_js, new_js))
    print("Patched explore.js loading()")
else:
    print("Could not patch explore.js loading()")

fpath_html = "mzlab/web/index.html"
with open(fpath_html, "r", encoding="utf-8") as f:
    html_content = f.read()

old_css = """#loading{position:fixed;inset:0;z-index:10010;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:20px}"""
new_css = """#loading{position:fixed;inset:0;z-index:10010;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:20px;transition:opacity 0.4s ease}
#loading.fade-out{opacity:0;pointer-events:none}
@media (prefers-reduced-motion: reduce) { #loading { transition:none; } }"""

if old_css in html_content:
    with open(fpath_html, "w", encoding="utf-8") as f:
        f.write(html_content.replace(old_css, new_css))
    print("Patched index.html CSS")
else:
    print("Could not patch index.html CSS")
