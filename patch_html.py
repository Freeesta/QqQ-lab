import sys
import re

fpath = "qqq_lab/web/index.html"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

# Update title
content = content.replace("<title>{APP}</title>", "<title>{APP} • Analisi dati MS</title>")

# Update PHRASES
old_phrase1 = '"Riavviando l\'universo"'
new_phrase1 = '"Riavviando l\'Universo"'
content = content.replace(old_phrase1, new_phrase1)

if '"Niente panico"' not in content:
    # insert before "Sporcando la sorgente"
    content = content.replace('"Sporcando la sorgente"', '"Niente panico", "Sporcando la sorgente"')

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)

print("index.html patched!")
