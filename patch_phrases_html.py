import sys

fpath = "qqq_lab/web/index.html"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re

# 1. Replace the phrases array
old_phrases = """const PHRASES = [
  "Ignorando i warning", "Schivando gli ftalati", "Minando crypto di nascosto", "Litigando coi raw",
  "Aggiornando Matrix", "Riavviando l'Universo", "Ansia da separazione", "Contaminando la sorgente",
  "Accecando l'elettromoltiplicatore", "Maledicendo la matrice", "Cuocendo i quadrupoli",
  "Contando fino a 6,022 × 10²³", "Non accettando Δx · Δp ≥ ℏ/2", "Iniettando H₂O nel GC",
  "Contaminando con PEG", "Niente panico", "Sporcando la sorgente"
];"""

new_phrases = """const PHRASES = [
  "Ignorando i warning", "Schivando gli ftalati", "Minando crypto di nascosto", "Litigando coi raw",
  "Aggiornando Matrix", "Riavviando l'Universo", "Ansia da separazione", "Contaminando la sorgente",
  "Accecando l'elettromoltiplicatore", "Maledicendo la matrice", "Cuocendo i quadrupoli",
  "Contando fino a 6,022 &times; 10<sup>23</sup>", "Non accettando &Delta;x &middot; &Delta;p &ge; ℏ/2", "Iniettando H<sub>2</sub>O nel GC",
  "Contaminando con PEG", "Niente panico", "Sporcando la sorgente"
];"""

if old_phrases in content:
    content = content.replace(old_phrases, new_phrases)
    print("Replaced PHRASES array!")
else:
    print("PHRASES array not found.")

# 2. Replace textContent with innerHTML
old_assignment = """const el = document.getElementById("ldmsg"); el.textContent = PHRASES[ldLast];"""
new_assignment = """const el = document.getElementById("ldmsg"); el.innerHTML = PHRASES[ldLast];"""

if old_assignment in content:
    content = content.replace(old_assignment, new_assignment)
    print("Replaced textContent with innerHTML!")
else:
    print("Assignment not found.")

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
