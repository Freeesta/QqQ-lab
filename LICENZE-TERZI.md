# Licenze del materiale di terzi

QqQ lab (codice del programma) è sotto licenza MIT (`LICENSE`). Il sito e il repository contengono o scaricano anche il materiale seguente, ciascuno con la propria licenza.

| Componente | Versione | Licenza | Dove si trova |
|---|---|---|---|
| Ketcher (EPAM Systems) con Indigo e React | 3.18.0 | Apache-2.0 (React: MIT) | `qqq_lab/web/vendor/ketcher/` (testo completo: `LICENSE.txt` nella stessa cartella). Sorgente: https://github.com/epam/ketcher |
| OpenChemLib JS (Zakodium / Actelion / cheminfo) | 9.25.1 | BSD-3-Clause | `qqq_lab/web/vendor/openchemlib.js` (testo: `vendor/openchemlib.LICENSE`). Sorgente: https://github.com/cheminfo/openchemlib-js |
| Pyodide (Python in WebAssembly) | 314.0.7 | MPL-2.0 (Python: PSF License) | Scaricato da `tools/build_site.py` da https://cdn.jsdelivr.net/pyodide/ e messo nel sito in `static/pyodide/`. Sorgente e licenza: https://github.com/pyodide/pyodide (MPL-2.0: https://www.mozilla.org/MPL/2.0/) |
| NumPy | 2.4 (quello incluso in Pyodide) | BSD-3-Clause | Dentro Pyodide. https://numpy.org/doc/stable/license.html |
| Masse isotopiche degli elementi | - | BSD-3-Clause (da OpenChemLib) | `qqq_lab/web/elements.js` (generato da `tools/genera_elementi.py`) |
| Pesi atomici medi | - | Apache-2.0 (da Ketcher) | stesso file |
| Abbondanze isotopiche naturali | - | dati IUPAC (fatti pubblici, senza copyright) | scritte in `tools/genera_elementi.py` |
| Logo (figura del campo di un quadrupolo) | - | **CC BY-SA 4.0** | `qqq_lab/web/logo*.png/svg`, icone e favicon (vedi sotto) |
| Caratteri | - | nessuno incluso | la pagina usa i caratteri di sistema (`system-ui`) |

## Logo

Il logo deriva da `QuadrupoleContour.svg` di **Geek3** (Wikimedia Commons, https://commons.wikimedia.org/wiki/File:QuadrupoleContour.svg),
pubblicato con licenza **Creative Commons Attribution-ShareAlike 4.0** (https://creativecommons.org/licenses/by-sa/4.0/), poi rielaborato con un generatore di immagini
(sorgente `tools/logo_sorgente.jpg`, script `tools/genera_icone.py`). Per la licenza ShareAlike, il logo e le icone che ne derivano si distribuiscono con la stessa licenza (CC BY-SA 4.0), con attribuzione a Geek3. Il resto del programma resta MIT.

## Figure della Teoria

Le figure dei capitoli di Teoria sono disegnate dal programma stesso (SVG e simulazioni in JavaScript): non contengono immagini di terzi.

## Spettri EI della Teoria e della Pratica

Gli spettri di ionizzazione elettronica in `qqq_lab/web/teoria/pratica/ei-dati.js` vengono da **MassBank Europe** (https://massbank.eu), ognuno con il proprio codice di record, autori e licenza indicati nel file e sotto ogni grafico; tutti con licenza **Creative Commons Attribution-NonCommercial-ShareAlike** (CC BY-NC-SA). Per questa licenza gli spettri si usano solo a scopo didattico e non commerciale, con attribuzione, e chi li redistribuisce modificati deve usare la stessa licenza. Le note didattiche sugli ioni sono originali. Nessuno spettro proviene dalla libreria NIST.
