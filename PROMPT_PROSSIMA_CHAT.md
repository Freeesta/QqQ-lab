# Prompt per la prossima chat (copia e incolla)

Sono Federico, dottorando in Chimica e Tecnologie Chimiche (UniTO). Continuiamo QqQ lab, programma didattico offline per il laboratorio inquinanti (QqQ SCIEX 3200 QTRAP, ESI+, Analyst 1.6.3): gli studenti esplorano mzML, scelgono XIC, integrano, attribuiscono, disegnano TP. NON dà risposte. Conciso e critico, non cancellare file (usa `QqQ_lab/_cestino/`).

## Leggi prima
1. `QqQ_lab/tpfinder/AGENTS.md`: obiettivi, convenzioni, mappa del codice, fatti sui dati, come eseguire test ed e2e (tutto il "come" sta lì).
2. Questo file: stato e cose da fare.
3. Se serve: `README.md` (guida utente), `docs/PROGETTO_TP_FINDER.md` (progetto originale), `tpfinder/web/vendor/README.md`.

Se la cartella `QqQ_lab` non è collegata, chiedila con device_request_folder_access.

## Stato (fine sessione 2026-10-05, sera)
Funziona ed è verificato (18 pytest, e2e3/e2e4/e2e5 senza errori JS):
- caricamento mzML, rilevamento full/ms2/mrm, cromatogramma totale -> spettro (trascina), XIC (clic destro, campo "m/z o formula", m/z a 1 decimale), Separa/Unisci, integrazione automatica + barre trascinabili, tabella integrazioni + CSV, popup Metodo e BioTransformer, frecce tra file, ripristino della sessione dopo reload;
- visualizzazione ispirata a Xcalibur/FreeStyle/MZmine: cursore con valori, linea sincronizzata, etichette RT dei picchi, vista impilata, scala log, zoom/sposta, legenda cliccabile, mappa RT-m/z con differenza tra file;
- sottrazione del bianco e baseline SNIP (cromatogrammi/XIC/MRM), sottrazione dello spettro di fondo, Calcolatrice m/z, didascalia della struttura nel Disegno;
- logo e favicon integrati;
- e2e portabili (percorsi relativi, mzML da `../esempio_conversione/mzml` o `QQQ_MZML`).

**Bug corretto (2026-10-05, dopo la pulizia)**: una modifica successiva all'ultimo e2e (probabilmente Qwen: formule con pedici `fmtFormula`/`fmtAdduct`) aveva rotto `index.html`, la pagina non partiva: (1) backtick di troppo nel template di `renderDetail` ("Stessa massa nella finestra"); (2) `fmtFormula`/`fmtAdduct` dichiarati con `const` sia in `explore.js` sia nello script inline ("Identifier already declared"). Tolte le copie inline (restano in `explore.js`). Riverificato: 18 test, e2e3/e2e4/e2e5 tutti ok; schermate di ripristino e Disegno controllate.

Pulizia 2026-10-05: spostati in `QqQ_lab/_cestino/2026-10-05_pulizia/` i file creati da Qwen nella radice (`cli.py`, `session.py`, `session_manager.py`, `server.py` Flask), i vecchi avviatori "TP Finder", 88 file `.!NNNNN!.DS_Store` (artefatti di sincronizzazione), il file vuoto `{}` e `MAP.md` (accorpato in AGENTS.md). Un solo cestino: `QqQ_lab/_cestino/`. Federico può svuotarlo.

**Avvio e git (2026-10-05, sera)**: nuovo `scripts/avvia.py` (gli avviatori `.command`/`.bat` lo chiamano; vecchie versioni in `_cestino/2026-10-05_avviatori_vecchi/`): usa il Python più recente installato, ricostruisce `.venv-tpfinder` quando ne compare uno più nuovo, non cancella mai il vecchio. Provato nel container (3.11 -> 3.14, ambiente rotto, offline, ritorno online). Il venv del Mac è ancora quello di Python 3.12.3: Federico deve installare Python 3.14.8 da python.org e fare doppio clic sull'avviatore (l'agente non può digitare nel Terminale). Preparato git: `git init` (ramo `main`, nessun commit, nessun remote), `.gitignore` (esclusi dati, venv, cache), `.gitattributes`, `LICENSE` MIT, CI `.github/workflows/test.yml`, `pyproject` con `[test]`. 18 test verdi, controllo JS ok.

**Pubblicazione web (decisione presa, non ancora fatta)**: opzione 1 ibrida = sito statico su GitHub Pages con Python nel browser (Pyodide, numpy, Web Worker) + PWA offline; se c'è il server locale l'interfaccia usa quello, altrimenti Pyodide. Gli mzML li sceglie lo studente dal suo PC e non lasciano il computer; copia in OPFS, taccuino in IndexedDB a ogni modifica, `navigator.storage.persist()`, pulsante "Esporta sessione". Punti tecnici: 6 `fetch` da sostituire con una funzione `api()`; `mmap` in Pyodide da verificare (in alternativa leggere il file in memoria); Ketcher 29 MB (no Cloudflare Pages, limite 25 MiB); prima apertura ~20-25 MB; Safari cancella i dati dopo 7 giorni senza uso se il sito non è installato. Scartati: server gratuiti (HF Docker ora a pagamento, Render 0,1 CPU/512 MB), riscrittura in JS. Per ora tutto resta in locale (scelta di Federico).

## Da fare (priorità)
1. Verificare `draw.js` e la scheda Attribuzioni (screenshot `tests_e2e/shots/21_attr.png`): stringhe inglesi residue, `S.adding`/`#cancadd`, caricamento di nuovi file in una sessione aperta (pannelli mantenuti).
2. Interfaccia: barra dei controlli dei pannelli troppo alta (va a capo su 3 righe); sfondo ancora crema (Federico lo vuole più chiaro); titoli degli assi nella mappa; etichette sovrapposte nella vista impilata.
3. Decidere se togliere dalla modalità esplora `/export/session.json` e gli endpoint dei candidati (oggi rispondono 400 con messaggio chiaro).
4. Versione web (vedi sopra): prototipo Pyodide (carica un mzML, mostra il cromatogramma, misura avvio e velocità), poi `api()`, salvataggio nel browser, PWA. Quando Federico lo decide: repository GitHub (pubblico o GitHub Education), primo commit, Pages. Da chiedere al titolare del corso: si possono pubblicare dati di esempio?
5. Nome definitivo del programma (pacchetto e cartella di lavoro si chiamano ancora `tpfinder`/`TPFinder_lavoro`).
6. Test su Mac/Parallels reali; conversione diretta dei wiff (msconvert mai provato da `convert.py`).
7. Icona 1024 px nitida: serve il logo vettoriale.

Idee non fatte: mappa con soglia regolabile, XIC con finestra in ppm per dati HRMS, minimappa del cromatogramma.

## Note
- Modifiche non committate di attributio (altro progetto): da riprendere a parte.
- In `esempio_conversione/mzml/` il t30 del full scan si chiama `B_FullMass-t30 (2).mzML` (manca la versione senza "(2)"): dato grezzo, non rinominato.
