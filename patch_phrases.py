import sys

fpath = "mzlab/web/index.html"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

new_phrases = """const PHRASES = [
  "Ignorando i warning", "Schivando gli ftalati", "Minando crypto di nascosto", "Litigando coi raw",
  "Aggiornando Matrix", "Riavviando l'universo", "Ansia da separazione", "Contaminando la sorgente",
  "Accecando l'elettromoltiplicatore", "Maledicendo la matrice", "Cuocendo i quadrupoli",
  "Contando fino a 6,022 × 10²³", "Non accettando Δx · Δp ≥ ℏ/2", "Iniettando H₂O nel GC",
  "Contaminando con PEG", "Sporcando la sorgente"
];"""

# Replace the existing PHRASES array
pattern = re.compile(r"const PHRASES = \[[^;]+\];", re.MULTILINE | re.DOTALL)
if pattern.search(content):
    content = pattern.sub(new_phrases, content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced!")
else:
    print("Not found.")
