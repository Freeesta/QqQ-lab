# Licenze del materiale di terzi

mzLab (codice del programma) è sotto licenza MIT (`LICENSE`). Il sito e il repository contengono o scaricano anche il materiale seguente, ciascuno con la propria licenza.

| Componente | Versione | Licenza | Dove si trova |
|---|---|---|---|
| Ketcher (EPAM Systems) con Indigo e React | 3.18.0 | Apache-2.0 (React: MIT) | `mzlab/web/vendor/ketcher/` (testo completo: `LICENSE.txt` nella stessa cartella). Sorgente: https://github.com/epam/ketcher |
| OpenChemLib JS (Zakodium / Actelion / cheminfo) | 9.25.1 | BSD-3-Clause | `mzlab/web/vendor/openchemlib.js` (testo: `vendor/openchemlib.LICENSE`). Sorgente: https://github.com/cheminfo/openchemlib-js |
| Pyodide (Python in WebAssembly) | 314.0.7 | MPL-2.0 (Python: PSF License) | Scaricato da `tools/build_site.py` da https://cdn.jsdelivr.net/pyodide/ e messo nel sito in `static/pyodide/`. Sorgente e licenza: https://github.com/pyodide/pyodide (MPL-2.0: https://www.mozilla.org/MPL/2.0/) |
| NumPy | 2.4 (quello incluso in Pyodide) | BSD-3-Clause | Dentro Pyodide. https://numpy.org/doc/stable/license.html |
| Masse isotopiche degli elementi | - | BSD-3-Clause (da OpenChemLib) | `mzlab/web/elements.js` (generato da `tools/genera_elementi.py`) |
| Pesi atomici medi | - | Apache-2.0 (da Ketcher) | stesso file |
| Abbondanze isotopiche naturali | - | dati IUPAC (fatti pubblici, senza copyright) | scritte in `tools/genera_elementi.py` |
| Caratteri | - | nessuno incluso | la pagina usa i caratteri di sistema (`system-ui`) |

## Figure della Teoria

Le figure dei capitoli di Teoria sono disegnate dal programma stesso (SVG e simulazioni in JavaScript): non contengono immagini di terzi.

## Spettri EI della Teoria e della Pratica

Gli spettri di ionizzazione elettronica in `mzlab/web/teoria/pratica/ei-dati.js` vengono da **MassBank Europe** (https://massbank.eu), ognuno con il proprio codice di record, autori e licenza indicati nel file e sotto ogni grafico; tutti con licenza **Creative Commons Attribution-NonCommercial-ShareAlike** (CC BY-NC-SA). Per questa licenza gli spettri si usano solo a scopo didattico e non commerciale, con attribuzione, e chi li redistribuisce modificati deve usare la stessa licenza. Le note didattiche sugli ioni sono originali. Nessuno spettro proviene dalla libreria NIST.
