# Prompt per la prossima chat (copia e incolla)

Sono Federico, dottorando in Chimica e Tecnologie Chimiche (UniTO). Continuiamo QqQ lab, programma didattico per il laboratorio inquinanti (QqQ SCIEX 3200 QTRAP, ESI+, Analyst 1.6.3): gli studenti esplorano gli mzML, scelgono gli XIC, integrano, fanno la retta di taratura, disegnano TP e frammenti. NON dà risposte: il lavoro manuale e il ragionamento sono lo scopo. Interfaccia in italiano, codice e commenti in inglese. Conciso e critico. Non cancellare file (spostali in `QqQ_lab/_cestino/`). Una sola chat alla volta su questa cartella.

## Leggi prima
1. `QqQ_lab/QqQ_lab/AGENTS.md`: obiettivi, convenzioni, mappa del codice, fatti sui dati, test ed e2e. Sezioni 8-12 = lavoro recente (memoria, versione browser, schermata Dati e MRM, schede, xlsx / finestra XIC / gruppi di pulsanti / concentrazione / frecce).
2. Questo file: stato e lavoro da fare.
Se la cartella `QqQ_lab` non è collegata, chiedila con device_request_folder_access.

## Stato (2026-10-06, sera)
- Due versioni dello stesso codice: locale (`python -m qqq_lab app`, Python + numpy) e browser (Pyodide, GitHub Pages https://freeesta.github.io/QqQ-lab/; si ricostruisce con `tools/build_site.py`). Il front end (`qqq_lab/web/*.js`, script classici) usa URL relativi e funziona in entrambe. Memoria dello studente: IndexedDB nel browser (archivi `files` e `kv`).
- Git: ultimo commit = `git log -1` (titolo "Excel vero (xlsx), finestra XIC unica, ..."). Ci sono commit locali avanti a `origin`: Federico preme **Push origin**. Il commit lo fa la chat a fine lavoro, titolo in italiano e righe Co-Authored-By / Claude-Session del messaggio di sistema; dalla VM `git -c user.name="Federico Cristaudo" -c user.email=fedecrista@gmail.com commit`; aggiungere solo cartelle di codice (`git add AGENTS.md README.md PROMPT_PROSSIMA_CHAT.md qqq_lab tests tests_e2e tools .github`), NON `_cestino/`.
- Già fatto (dettagli in AGENTS.md sezioni 8-12 e `git log`): xlsx veri, finestra XIC unica, gruppi di pulsanti, icone dei modi, PWA installabile, modulo cifrato TP Mine (`tpmine-loader.js`, `tools/build_tpmine.py`), Teoria con glossario al passaggio del mouse (cap. 12 Disegno), scheda Disegno semplificata e etichette corrette nell'esportazione.
- Prompt completati e spostati in `_cestino/2026-10-06_prompt_completati/`: B (interfaccia MS², bianco interno, schede, impostazioni), C (TP Mine cifrato, AGENTS sez. 13), E ed E2 (origine degli ioni: `ionfamily`, AGENTS sez. 14 e 15; mappa 3D e finestra «Da dove viene questo ione?», commit 21594b7).
- **Da fare, in ordine**: (1) `PROMPT_CHAT_F_disegno_esempi.md` (scheda Disegno: togliere i 3 box, scelta dello ione, nuovo esempio; NON ancora iniziato); (2) `PROPOSTA_sessione_e_dati.md` (esporta/importa sessione .zip, `storage.persist()`, cancella dati: da approvare); (3) frecce ← → (vedi sotto); (4) residui di E2, qui sotto.
- Test: `python3 -m pytest -q tests` (21) ed e2e Playwright `tests_e2e/e2e{3,4,5,6,8,9,10,12,13,14,15,16,17,18}.py` (e2e13 richiede prima `python3 tools/build_site.py --pyodide-dir /tmp/pyo`; in questa sessione la rete del container bloccava jsDelivr, quindi **e2e13 e le misure Pyodide NON sono state eseguite**). Gli mzML veri sono in `Data/mzML/` (variabile `QQQ_MZML`), i .dam in `Data/dam - Metodi/` (`QQQ_DAM`). `tests_e2e/lat_arrows.py` = misura (non test) della latenza delle frecce.
- Limiti noti: file con MS1 e MS² insieme (data-dependent) trattati come MS²; etichette dell'asse x dello spettro affollate se l'intervallo MS² è stretto; con il pannello a 1500 px i controlli del cromatogramma TIC vanno su una seconda riga (voluto: i pulsanti restano su una riga sola).

## DA DECIDERE CON FEDERICO (prima di altro lavoro)
1. **Frecce ← → sul cromatogramma**: consiglio b (niente svuotamento dello spettro + "ultimo vince" + un draw per frame + niente `ctl()` a ogni passo) -> c (asse y bloccato sul massimo delle ±20 scansioni, lucchetto) con a (`api/spectra` a blocco, cache per scansione) -> d (sagoma della scansione precedente, opzionale, spenta di default); sconsigliata l'evidenziazione automatica dei picchi che cambiano. Misure e motivi: AGENTS.md sezione 12. Attendo il via libera.
2. **Semiampiezza della finestra da formula**: messa a ±0.5 Da (`XIC_HALF` in `explore.js`) perché i centroidi sono spostati di circa +0.30 Da (364.0737 calcolato, 364.37 osservato): con ±0.25 il picco vero resterebbe fuori. Da confermare o cambiare in un punto solo.
3. Da misurare sul Mac con la versione pubblicata (Pyodide): latenza di `api/spectrum` per scansione e e2e13.

## Non ancora verificato (da Federico a mano)
- Mac reale: `QqQ lab.app` (permesso Terminale, icona nuova, Gatekeeper), `Avvia QqQ lab.command` (se "privilegi di accesso": `chmod +x`), Windows con Python appena installato e prima apertura offline.
- Nomi veri degli standard (concentrazione indovinata), finestra di integrazione comune tra Quantificatore e Qualificatore, retta di taratura contro Analyst (RT, aree, rapporto Quant/Qual).
- Colori dei file quando sono più di 12; spettri UV del PDA non decodificati (negli mzML c'è solo `TWC`).

## Decisioni già prese (non rimetterle in discussione)
- Nessun metodo predefinito: i parametri vengono solo dai `.dam` caricati dallo studente.
- Niente strumenti che danno le risposte (frammentatori automatici): ciò che si calcola parte sempre da un'ipotesi dello studente.
- Nessun download di librerie esterne: profilo isotopico, masse, ora anche xlsx, sono fatti in casa (Ketcher e OpenChemLib sono già in `vendor/`).
- Schede Attribuzioni e Suggerimenti tolte per scelta. Pyodide su GitHub Pages è la strada per tablet/senza installazione (la riscrittura tutta in JS è scartata).
- Eventuali elementi che spostano o eliminano file: usa `_cestino/`.

## Residui di E2 (origine degli ioni)
- Pyodide: risolto (1.9 s a freddo, 1.3 s a caldo su 5 file; AGENTS sez. 15). Da rimisurare solo sul Mac vero.
- TP Mine: collegare `isf.isf_classify` al flag `insource` di `engine.py` (privato, non fatto).
- **Standard puro = t0** (deciso da Federico, 6 ott): il campione a tempo zero e' lo standard del solo flufenacet, quindi e' il riferimento ufficiale dell'ISF (non piu' un sostituto). Il flufenacet frammenta SEMPRE in sorgente: la domanda non e' se, ma quanto e quali ioni. Conseguenze da implementare in `ionfamily`/finestra origine: (a) ogni ione che ha un picco all'apice del progenitore in t0 e' per costruzione ISF/isotopo/addotto/impurezza del progenitore (evidenza forte, da mostrare come tale); (b) il rapporto r0 = F/P misurato in t0 e' l'atteso negli altri campioni: l'ECCESSO F_t - r0*P_t e' il contributo di un eventuale TP isobaro co-eluente (sostituisce in parte `ratio_constancy`); (c) il prior dell'ISF per ioni piu' leggeri co-eluenti e' alto. Sui negativi reali restano solo quelli facili (nessun TP formato co-eluisce nei dati attuali). Ancora da decidere: MS² del progenitore 364 e acquisizioni a piu' DP (la rampa DP resta solo sintetica).
- Non verificato: Safari/Mac, file molto grandi. La cartella `QqQ_lab_privato` non e' un repo git: valutare un backup.
- Git: commit 21594b7 su `main` (ramo `origine` ancora presente, da cancellare dopo il push). Premere Push origin.
