# AGENTS.md - QqQ_lab / tpfinder

Guida per qualsiasi agente (anche un modello piccolo) che lavora in questa cartella. Leggila tutta prima di toccare codice. Stato corrente e cose da fare: `PROMPT_PROSSIMA_CHAT.md`.

> **Regola anti-spreco token**: NON leggere né scansionare `tpfinder/web/vendor/` (Ketcher, ~31 MB), `.venv-tpfinder/` (e `.venv-tpfinder-*`), `.git/`, `tpfinder.egg-info/`, `__pycache__/`, `.pytest_cache/`, `../_cestino/` o i dati grezzi in `../QqQ/`.

## 1. Obiettivo del progetto (il perché)
QqQ lab è un programma DIDATTICO per il laboratorio di inquinanti del corso (UniTO, titolare del progetto: Federico Cristaudo, dottorando). Gli studenti lavorano con dati LC-MS di un triplo quadrupolo SCIEX 3200 QTRAP (risoluzione unitaria, ESI positivo, Analyst 1.6.3) per studiare i prodotti di trasformazione (TP) di un inquinante degradato in fotocatalisi (TiO2, esperienza 3 del corso, tempi 0-60 min).

Principi che NON vanno violati:
1. **Pedagogico: il programma NON dà le risposte.** Non propone automaticamente "ecco i TP". Lo studente parte dal full scan, sceglie lui quali m/z estrarre (XIC), sovrappone cromatogrammi, rinomina tracce, integra i picchi, fa le attribuzioni, disegna molecole, frammenti e vie di trasformazione. Il programma è uno strumento di esplorazione, non un oracolo. Suggerimenti e strumenti esterni (es. BioTransformer) sono opzionali e separati.
2. **Leggero, offline, modificabile dagli studenti.** Solo Python >= 3.11 + numpy, interfaccia web locale in HTML/JS semplice senza build, nessun servizio in rete. Codice leggibile e commentato. Non aggiungere dipendenze pesanti.
3. **Interfaccia e testi per l'utente in italiano.** Codice e commenti in inglese.
4. **Onestà scientifica.** Risoluzione unitaria: un m/z è un candidato, non un'identificazione. Mostrarlo sempre così.

Flusso dello studente (esperienza 3): G1 fotocatalisi + standard dell'inquinante incognito, ricerca transizioni; G2 retta di taratura MRM, quantificazione, scan dei campioni per gli intermedi; G3 Product Ion Scan (MS2) sui tempi con più intermedi. Relazione finale: tabella m/z intermedi con ioni prodotto + grafici di scomparsa dell'inquinante ed evoluzione degli intermedi vs tempo (la tabella integrazioni con cinetica serve a questo).

Dettagli dell'esperienza: TiO2 400 mg/L; cuvetta 2.5 mL inquinante + 2.5 mL TiO2; t = 0, 5, 10, 15, 30, 45, 60 min; filtrazione 0.45 um; C18, inquinante 15 mg/L, HCOOH 0.05% / ACN gradiente, QqQ ESI+.

## 2. Convenzioni (obbligatorie)
- Codice e commenti in inglese; testi per l'utente e documenti in italiano.
- **Mai cancellare file**: spostali nell'unico cestino `QqQ_lab/_cestino/` (sottocartella con data, es. `_cestino/2026-10-05_pulizia/`) e lascia decidere a Federico. Vale anche per i file temporanei.
- **Dati grezzi in sola lettura** (`../QqQ/`, `../esempio_conversione/`). Gli mzML convertiti vanno in una cartella cache (`.tpfinder-cache`), mai accanto agli originali.
- Ogni risultato registra versione, parametri e SHA-256 dei file di input (provenienza).
- Nei testi da pubblicare (articoli, slide) niente apici/pedici unicode e niente trattini lunghi; in chat e nell'interfaccia vanno bene.
- **Git** (repository locale in questa cartella, ramo `main`, ancora senza remote né commit). Cosa entra lo decidono `.gitignore` (mai dati di laboratorio: mzML, wiff, dam, taccuino) e `.gitattributes` (`.bat` CRLF, `.command` LF, `vendor/` senza diff). Commit solo quando Federico lo chiede; messaggi in italiano, brevi. NON usare git dalla VM di device_bash: lì i file non si cancellano, git lascia `.git/index.lock` e blocca il repository (se succede, sposta il lock nel cestino). Git si usa sul Mac (GitHub Desktop o Terminale) oppure, quando ci sarà il remote, da un clone nel container cloud.
- Documenti di supporto per agenti: questo file e `PROMPT_PROSSIMA_CHAT.md`. Non creare altre mappe o cheat-sheet paralleli: aggiorna questi.
- Dopo ogni modifica: `python3 -m pytest -q tests` deve restare verde (18 test; su GitHub li esegue `.github/workflows/test.yml` con Python 3.11 e 3.14 su Linux/Mac/Windows, più il controllo di sintassi JS). Per modifiche al front end esegui anche l'e2e (sezione 5).

## 3. Mappa del codice
Radice: `QqQ_lab/tpfinder/` (il pacchetto Python è la sottocartella `tpfinder/`; nella radice non ci sono moduli Python).
- `tpfinder/cli.py`: comandi (`app`, `demo`, `draft`, `convert`, `candidates`, `serve`, `metodo`). Entry: `python -m tpfinder app` (cartella di lavoro predefinita `~/TPFinder_lavoro/sessione_...`).
- `tpfinder/server.py`: server HTTP locale (solo 127.0.0.1), classe `App` + handler. GET: `/api/session`, `/api/chrom`, `/api/xic`, `/api/mrm`, `/api/method`, `/api/map` (mappa RT x m/z, float32 base64), `/api/spectrum` (anche `bgk`, `bgrt0`, `bgrt1` per lo spettro di fondo), `/api/formula?f=...&adduct=[M+H]+` (formula errata = HTTP 400), `/api/notebook`, `/export/*`; POST: `/api/upload`, `/api/explore`, `/api/notebook`, `/api/new`, `/api/remove`, `/api/build`. Errori sempre come JSON `{"error": ...}`. In modalità esplora `/export/session.json` e gli endpoint dei candidati rispondono 400 con testo italiano.
- `tpfinder/explore.py`: sessione di esplorazione (`Session`, `Item`). `Item.kind()` = `full` | `ms2` | `mrm`, `total()` (TIC/BPC), `xic()`, `spectrum(..., bg={item, rt0, rt1, factor})` (sottrazione di fondo bin per bin con taglio a zero, via `_binned`), `mrm()`, `method()`, `ionmap()`; `Session.grid()` (griglia comune per la mappa). File MRM: RT e polarità dai cromatogrammi SRM (`_srm_rt_range`, `_header_polarity`).
- `tpfinder/reader/mzml.py`: lettore mzML con mmap (nessuna libreria esterna): scan, array base64/zlib, cromatogrammi SRM, metadati.
- `tpfinder/reader/ole.py` + `methodinfo.py`: decodifica dei parametri del metodo da .dam/.wiff (CUR, GS1, GS2, IS, DP, EP, CE). Serve SOLO al docente (`python -m tpfinder metodo FILE -o out.json`); il risultato è `tpfinder/config/metodo_laboratorio.json`, letto dal popup "Metodo". Gli studenti non hanno i wiff: non farne dipendere l'app.
- `tpfinder/core/`: `analysis.py`, `score.py`, `peaks.py` (candidati TP, punteggi, picchi; modalità "suggerimenti", opzionale, e comandi `serve`/`candidates`/`demo`).
- `tpfinder/chem/elements.py`: masse monoisotopiche, `parse_formula` (accetta parentesi), `formula_mz(formula, adduct)` (massa neutra, m/z esatto, `mz1` a 1 decimale, `nominal`; arrotondamento half-up `round_half_up`, non "del banchiere"), addotti (`ADDUCT_SHIFT`). `chem/transformations.py`: candidati dalle reazioni di `config/trasformazioni.csv`.
- `tpfinder/project.py`: file `esperimento.toml`, `guess_sample()` indovina tipo e tempo dal nome file (`t15`, `blank`...).
- `tpfinder/convert.py`: wiff -> mzML con msconvert (non testato: non c'è msconvert sul Mac di sviluppo).
- `tpfinder/demo.py`: dati sintetici per demo e test.
- `tpfinder/config/`: `testi.toml` (messaggi), `soglie.toml`, `trasformazioni.csv`, `metodo_laboratorio.json`.
- `tpfinder/web/`: front end statico.
  - `index.html`: struttura, CSS, schede Dati/Disegno/Attribuzioni/Suggerimenti, caricamento file, popup Calcolatrice m/z (`#np-calc`) e BioTransformer; logo e favicon (`logo.png`, `favicon*.png/ico`, `apple-touch-icon.png`, `app-icon-256/512.png`; concept originale in `docs/logo_concept.jpg`, raster ~450 px).
  - `explore.js`: scheda Dati. Pannelli mobili cromatogramma/spettro/XIC/MRM/mappa RT-m/z; cursore con valori e linea sincronizzata; etichette RT dei picchi (`pickPeaks`, spente di default); vista impilata e scala log; Ctrl/Cmd+rotella = zoom, Maiusc+trascina = sposta, doppio clic = vista intera, clic sulla legenda = nascondi traccia; integrazione; sottrazione del bianco e baseline SNIP su chrom/xic/mrm (`corrected`, `snipBaseline`; opzioni `p.bk`, `p.snip`, `p.snipw`; spettri `p.bg`, `p.bw0`, `p.bw1`); m/z inseriti arrotondati a 1 decimale (`addTrace`), campo "m/z o formula" (`addFromText`); popup Metodo/BioTransformer; esportazioni; salvataggio sessione (`uiSave`, anche su `pagehide` con fetch keepalive).
  - `draw.js`: scheda Disegno con Ketcher; formula/massa/addotti delle strutture; card "Didascalia per la relazione" (`addCaption`, testo copiabile e scritta sotto la struttura in PNG/JPEG/SVG, salvata in `NB.cap`).
  - `vendor/`: Ketcher e OpenChemLib offline (vedi `vendor/README.md`). Non modificare, non leggere.
- `tests/test_pipeline.py`: 18 test pytest.
- `tests_e2e/`: script Playwright (`lib.py` comune, `e2e3.py` flusso base, `e2e4.py` visualizzazione, `e2e5.py` bianco/baseline/formula/didascalia). Screenshot in `tests_e2e/shots/`.
- `docs/PROGETTO_TP_FINDER.md`: documento di progetto originale (v0.1, in parte superato: vedi nota in testa).
- `Avvia QqQ lab.command` (Mac) / `Avvia QqQ lab.bat` (Windows): avvio con doppio clic; trovano un Python qualsiasi (>= 3.8) e lanciano `scripts/avvia.py`.
- `scripts/avvia.py`: gestisce `.venv-tpfinder` con il Python PIÙ RECENTE installato (>= 3.11): lo crea, lo ricostruisce se compare un Python più nuovo o se è rotto (verifica `import numpy, tpfinder`), sposta il vecchio in `../_cestino/` (o accanto, sui PC degli studenti) e lo rimette al suo posto se l'installazione fallisce; una versione che fallisce viene saltata per 7 giorni (`.venv-tpfinder.salta`), ma solo se esiste già un ambiente funzionante. Argomenti extra passano all'app (`python3 scripts/avvia.py app --port 8811`).
- `LICENSE` (MIT, Federico Cristaudo), `.gitignore`, `.gitattributes`, `.github/workflows/test.yml` (CI).
- Dati (sola lettura): `../QqQ/Data Inquinanti/` (217 wiff + wiff.scan, 6 GB), `../QqQ/Metodi inquinanti/` (.dam), `../esempio_conversione/wiff/` + `converti.bat` (msconvert su Windows), `../esempio_conversione/mzml/` (43 mzML di esempio).

Stato lato front end: variabile globale `E` (file, pannelli), `S` (stato pagina), `NB` (taccuino: attribuzioni, layout, didascalia; salvato in `taccuino.json` nella cartella di lavoro tramite `/api/notebook`; così la sessione si ripristina alla riapertura). Stato dei pannelli salvato: mode, log, peaks, hid, scale, ref, zoomY, bk, snip.

## 4. Fatti sui dati (verificati)
- File: Analyst 1.6.3 classico (OLE2), non wiff2. Ogni .wiff richiede il suo .wiff.scan. Il programma legge solo mzML (conversione con ProteoWizard msconvert, fatta su Windows/Parallels con MSConvertGUI o `converti.bat`).
- Offset asse m/z di circa +0.3 Da (flufenacet a ~364.4 invece di 364.07); strumento datato: finestra XIC consigliata +-1 Da.
- I file MRM hanno solo cromatogrammi (non scan); i B_MRM hanno 2 transizioni: 364.1>194.1 (Quant), 364.1>152.1 (Qual). I file MS2 (product ion) hanno solo scan di livello 2 e molti scan sono vuoti (630/1005 in B_MS2-t15: array vuoti con flag zlib; già gestito, non rompere `if raw and ...` in `mzml.py`, test `test_empty_zlib_array_does_not_crash`).
- Inquinante di esempio: precursore m/z 364 (flufenacet), picco a ~14.3 min, ione base 194.2 nel full scan.

## 5. Come lavorare ed eseguire i test
- Python >= 3.11 richiesto (`tomllib`); l'ambiente del Mac usa il più recente installato (vedi `scripts/avvia.py`; a ottobre 2026: 3.14.x stabile, 3.15.0 previsto il 9/10). La shell vista da device_bash è una VM Linux con Python 3.10 e senza Chromium (il `.venv-tpfinder` del Mac punta a un Python macOS e lì non funziona). Quindi: staging dei file con device_stage_files nel container cloud (Python 3.13, numpy, Playwright, Chromium), `pip install --break-system-packages pytest`, test lì, e i file modificati tornano sul Mac con device_commit_files. Escludi dallo staging venv, cache e `.DS_Store`.
- Test unitari: `python3 -m pytest -q tests`. Se nel container PyPI è bloccato (pip dà "No matching distribution"), basta un piccolo sostituto di pytest (`approx`, `raises`, `fixture`, `tmp_path`, `tmp_path_factory`) che esegue le funzioni `test_*` di `tests/test_pipeline.py`.
- Prima dell'e2e controlla la sintassi JS: `node --check` su `explore.js`/`draw.js` e sullo script inline di `index.html` (estratto in un file). Attenzione: gli script classici condividono i `const` globali, non ridichiarare nell'inline ciò che è già in `explore.js`.
- App: `python -m tpfinder app --workdir /tmp/wd1 --port 8811 --no-open`, poi apri `http://127.0.0.1:8811/`.
- E2E: dalla radice `tpfinder/`, `python3 tests_e2e/e2e3.py` (poi `e2e4.py`, `e2e5.py`). I percorsi sono relativi: codice = cartella padre di `tests_e2e`, mzML = `../esempio_conversione/mzml` (oppure variabile d'ambiente `QQQ_MZML`), screenshot in `tests_e2e/shots/`. Caricano 5 mzML (B_FullMass-t0/t15/t60, B_MS2-t15, B_MRM-t0) con `set_input_files("#pick", ...)`, clic "Apri i dati". Controlla SEMPRE gli errori JS/HTTP stampati a fine esecuzione e guarda gli screenshot.
- Un front end non provato nel browser è considerato rotto: non dichiarare "funziona" senza e2e.

## 6. Regole pratiche per agenti
- Leggi il file prima di modificarlo; modifiche piccole e mirate; non riscrivere interi file senza motivo (in passato una riscrittura grande non è stata salvata sul disco e si è persa: scrivi sempre su disco nella cartella del progetto e verifica con `ls`/`grep`).
- Non cambiare il comportamento pedagogico (sez. 1) per "essere utile": niente risposte automatiche.
- Se aggiungi un testo visibile, in italiano. Se aggiungi un endpoint, restituisci errori in JSON e aggiungi un test.
- Se una cosa è incerta (formato dati, strumenti), segnalalo a Federico invece di inventare.
- Modelli locali piccoli (es. Qwen2.5 Coder 14B via Cline): NON affidabili in modalità agente (JSON dei tool non valido, loop, file inventati come `server.py`/`session_manager.py` con Flask nella radice, finiti nel cestino). Usarli solo per singole funzioni da incollare a mano, con "Auto-approve Edit" spento.
- Alla fine di ogni sessione aggiorna `PROMPT_PROSSIMA_CHAT.md` con stato, bug aperti e prossimi passi (sostituisci, non accodare all'infinito).
