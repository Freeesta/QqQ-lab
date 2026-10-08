import sys

fpath = "qqq_lab/web/appname.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

# Add synchronous title replacement
new_content = content.replace(
    'window.APP_NAME = "mzLab";\ndocument.addEventListener("DOMContentLoaded", () => {',
    'window.APP_NAME = "mzLab";\ndocument.title = document.title.split("{APP}").join(APP_NAME);\ndocument.addEventListener("DOMContentLoaded", () => {'
)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("appname.js patched!")
