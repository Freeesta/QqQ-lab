import sys

fpath_js = "mzlab/web/explore.js"
with open(fpath_js, "r", encoding="utf-8") as f:
    js_content = f.read()

toast_func = """
window.toast = function(msg) {
  let t = document.getElementById("toast-container");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-container";
    t.className = "toast-container";
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  const el = document.createElement("div");
  el.className = "toast-msg";
  el.textContent = msg;
  t.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 400);
  }, 3000);
};
"""

if "window.toast =" not in js_content:
    with open(fpath_js, "w", encoding="utf-8") as f:
        f.write(toast_func + "\n" + js_content)
    print("Added toast to explore.js")

fpath_html = "mzlab/web/index.html"
with open(fpath_html, "r", encoding="utf-8") as f:
    html_content = f.read()

css = """.toast-container{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast-msg{background:var(--ink);color:var(--bg);padding:8px 16px;border-radius:6px;font-size:13px;opacity:0;transform:translateY(10px);transition:all 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.15)}
.toast-msg.show{opacity:1;transform:translateY(0)}
@media (prefers-reduced-motion: reduce) { .toast-msg { transition:none; transform:none; } }"""

if ".toast-container" not in html_content:
    # insert before @media (prefers-color-scheme:dark)
    html_content = html_content.replace("@media (prefers-color-scheme:dark)", css + "\n@media (prefers-color-scheme:dark)")
    with open(fpath_html, "w", encoding="utf-8") as f:
        f.write(html_content)
    print("Added toast CSS to index.html")

