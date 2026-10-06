# Prompt per la prossima chat (copia e incolla)

Sono Federico, dottorando in Chimica e Tecnologie Chimiche (UniTO). Continuiamo QqQ lab, programma didattico offline per il laboratorio inquinanti (QqQ SCIEX 3200 QTRAP, ESI+, Analyst 1.6.3): gli studenti esplorano gli mzML, scelgono gli XIC, integrano, disegnano TP e frammenti. NON dà risposte: il lavoro manuale e il ragionamento sono lo scopo. Conciso e critico, non cancellare file (usa `QqQ_lab/_cestino/`). Una sola chat alla volta su questa cartella.

## Leggi prima
1. `QqQ_lab/tpfinder/AGENTS.md`: obiettivi, convenzioni, mappa del codice, fatti sui dati, test ed e2e (tutto il "come" sta lì).
2. Questo file: stato, decisioni prese, prossimi passi.
3. Se serve: `README.md` (guida utente), `docs/PROGETTO_TP_FINDER.md` (progetto originale, in parte superato).

Se la cartella `QqQ_lab` non è collegata, chiedila con device_request_folder_access.

## Stato (2026-10-06, mattina)
Verificato: 20 pytest, e2e3/4/5/6/7 senza errori JS (le `api/notebook` ERR_ABORTED rimaste sono salvataggi keepalive interrotti dalla chiusura/ricarica della pagina: il ripristino della sessione funziona; il taccuino ora si salva solo se cambia). Ultimo commit git: solo il primo (`c7b2904`); tutto il resto è da committare.
- **Dati**: TIC di tutti i file in alto, spettro sotto al picco più intenso, pannelli a tutta larghezza, elenco file richiudibile; XIC (anche da formula), MRM, mappa RT-m/z, vista impilata, log, zoom, cursore, bianco e baseline SNIP, sottrazione di fondo, integrazione con tabella e cinetica, Metodo, Calcolatrice m/z, assi con titoli, niente griglia, PNG bianchi, esportazioni e relazione HTML; caricamento di altri file a sessione aperta (pannelli mantenuti, provato).
- **Profilo isotopico**: calcolato dal programma (nessuna libreria): scheda Isotopi nella finestra Addotti e sovrapposizione sullo spettro (clic destro), allineata al picco osservato.
- **Disegno** (Ketcher offline): formula + massa intera sotto ogni struttura (m/z se carica), differenza sulle frecce (+O Δm +16), riquadro "Selezione (frammento)" con le ipotesi di ione, gomma per rompere legami, guida "Come fare in Ketcher", didascalia (spenta di default), esportazione PNG/JPEG/SVG su sfondo bianco (crema facoltativo).
- **Tabelle**: Tavola periodica (isotopi, abbondanze; dimensione fissa), Addotti, Isotopi, Perdite neutre (massa intera). Pulsanti PubChem e BioTransformer (link esterni).
- **Teoria**: scheda con 11 capitoli e simulazioni (quadrupolo, ESI, QqQ, frammentazione CID, cinetica...), apribile anche da disco (`Teoria QqQ lab.html`). Esempio svolto: atrazina.
- **Avvio**: `Avvia QqQ lab.command`/`.bat` -> `scripts/avvia.py` (ambiente con il Python più recente, Terminale con spunte, icona del .command impostata al primo avvio: da verificare su Mac). Se il doppio clic dice "privilegi di accesso": `chmod +x "Avvia QqQ lab.command"`.
- **Interfaccia**: sfondo chiaro neutro (non più crema). Tolte per scelta le schede Attribuzioni e Suggerimenti (non reintrodurle).

**Aggiornamento 2026-10-06 (tarda mattina)**: logo vettoriale (`tools/genera_logo.py`, icone rigenerate da `tools/genera_icone.py`, header e favicon in SVG); `QqQ lab.app` per il Mac (una sola finestra del Terminale, icona nel pacchetto: da provare su Mac); pulsanti **?** di aiuto (`help.js`); pulsante CSV in ogni grafico e CSV per Excel in italiano (punto e virgola, virgola decimale, BOM). Verificato: 20 pytest, e2e3-7 ok.

## Decisioni già prese
- **Excel**: le tabelle e i grafici per la relazione (cinetica, retta di taratura, quantificazione) li costruiscono gli studenti in Excel. Il programma esporta i dati (CSV in italiano), non fa la taratura.
- **Tablet: rinviato.** Federico ha scelto (2026-10-06) che la strada giusta è un'app web autonoma in JavaScript (lettura mzML e calcoli nel browser, dati sul tablet, sito statico/PWA, interfaccia touch), ma per ora NON va implementata. Promemoria per quando si farà: forse si convertirà tutto in JS (anche la versione per computer, con Python solo come avviatore), per non avere due copie degli stessi calcoli. Cosa tenere a mente: test che confronta i numeri JS con quelli Python sugli stessi mzML; DecompressionStream per lo zlib; tocco (pressione lunga = clic destro, pizzica = zoom, maniglie, bersagli >= 44 px); Safari cancella i dati dopo 7 giorni senza uso (Esporta sessione, PWA sulla Home); hosting https (GitHub Pages) o PC del laboratorio; Ketcher ~29 MB e scomodo col dito; strumenti del docente (`metodo`) restano in Python.
- Niente strumenti che danno le risposte (frammentatori automatici tipo mass-fragmentation/MetFrag/CFM-ID: solo citati nella Teoria). Ciò che si calcola parte sempre da un'ipotesi dello studente (formula, struttura, selezione).
- Nessun download di librerie: profilo isotopico e masse fatti in casa; Ketcher e OpenChemLib sono già in `vendor/`.
- (Superato dalla decisione sul tablet qui sopra) Prima ipotesi di versione web: Pyodide + PWA. sito statico con Pyodide + PWA offline (dati che non lasciano il computer), progettata anche per tablet (iPad/Android: tocco, pressione lunga al posto del clic destro, pizzica per lo zoom, maniglie, bersagli >= 44 px, "Esporta sessione"). Punti tecnici già visti: sostituire i `fetch` con una funzione `api()`; `mmap` in Pyodide da verificare (in alternativa file in memoria); Ketcher ~29 MB (niente Cloudflare Pages, limite 25 MiB; GitHub Pages va bene); prima apertura ~20-25 MB; Safari cancella i dati dopo 7 giorni senza uso se il sito non è aggiunto alla Home. Scartati: server gratuiti, riscrittura in JS. Per ora resta tutto in locale. La versione precedente di questo file (cronologia dettagliata delle sessioni del 5-6 ottobre) è in `QqQ_lab/_cestino/2026-10-06_prompt_precedente.md`.

## Prossimi passi (proposta, in ordine)
1. **Git (fatto, da tenere come abitudine)**: secondo commit fatto da Federico (`4469cde`) e repository pubblicato su GitHub (privato, `Freeesta/QqQ-lab`). D'ora in poi il commit lo fa la chat stessa alla fine di ogni lavoro verificato (procedura in AGENTS.md, sezione 2 "Git": prima chiedere il permesso di cancellazione per la cartella, poi `git add -A` e `git commit`); il push lo fa Federico con "Push origin" in GitHub Desktop.
2. **Collaudo reale**: doppio clic su Mac (icona, Terminale), un PC Windows con Python appena installato, prima apertura senza internet dopo l'installazione; un giro completo dell'esperienza 3 fatto da Federico come se fosse uno studente.
3. **Validazione numerica contro Analyst** (2-3 file): RT, aree degli XIC e delle MRM, rapporto Quant/Qual. Se le aree differiscono, capire perché (smoothing, baseline, integrazione) e scriverlo nella guida.
4. **Dati per gli studenti**: convertire in mzML tutti i .wiff dell'esperienza (`converti.bat` su Windows), cartelle per gruppo, controllare che tempi e tipi vengano indovinati dal nome (`guess_sample`).
5. **G2 taratura MRM**: deciso, la fanno gli studenti in Excel con le aree esportate. Eventualmente controllare che il CSV delle integrazioni contenga tutto ciò che serve (nome dello standard, concentrazione ricavata dal nome del file?).
6. **G3 MS2 ↔ Disegno**: dal picco di uno spettro di ioni prodotto mandare l'm/z al Disegno (e viceversa evidenziare nello spettro gli m/z della selezione), senza proporre strutture.
7. **Cinetica**: la fanno gli studenti in Excel (C/C0, ln(C/C0), k) dalla tabella Integrazioni.
8. **Guida breve per lo studente** (1-2 pagine, anche dentro la Teoria) e scheda per il docente allineata a G1/G2/G3 e alla relazione.
9. **Distribuzione**: nome definitivo del programma; provare `QqQ lab.app` su Mac (permesso Terminale, icona, Gatekeeper); versione tablet rinviata (vedi Decisioni).
10. **Pulizia codice**: endpoint dei candidati (`/api/build`, `/api/candidate`, `/export/*.csv`, `/export/session.json`) da togliere o tenere per `candidates` e i test; e2e nella CI (Playwright su GitHub Actions).

## Fatto il 2026-10-06 (sera): gradiente, PDA, posti fissi
- Gradiente e metodo LC: ricavati dai .wiff/.dam (non dagli mzML) e messi in `metodo_laboratorio.json` (`lc`); la scheda Metodo mostra grafico %B, tabella, flusso, PDA, forno.
- PDA: cromatogramma `TWC` degli mzML come tipo "PDA (UV, totale)" nel pannello Cromatogramma (anche per i file MRM). Spettri UV e canali singoli NON ci sono negli mzML: servirebbe decodificare `DADRealTimeData` dei .wiff (non fatto) o un altro export.
- Asse y: la linea non copre più l'asse. Tolto il CSV dai cromatogrammi totali (TIC/BPC/PDA); resta su XIC, MRM, spettri. Posti fissi: trascinando un pannello gli altri si scambiano. Regola m/z in inglese scritta in AGENTS.md.
- Verificato: e2e3-9 senza errori JS nuovi, 2 nuovi test Python (PDA, LC). Da decidere con Federico: il messaggio si era interrotto dopo "Inoltre".

## Fatto il 2026-10-06 (pomeriggio) dagli appunti di Federico
1. Frecce = scan per scan: il clic su un pannello lo rende attivo (contorno blu); se ha un cursore le frecce spostano di una scansione e lo spettro collegato segue (mantiene lo zoom); senza cursore o senza pannello attivo cambiano file. Clic sullo sfondo vuoto disattiva.
2. Zoom: rettangolo durante il trascinamento nello spettro, barra in alto a destra con la finestra visibile, pulsante "Vista intera", voce di menu per ingrandire l'intervallo selezionato nei cromatogrammi.
3. Nomi dei PNG e CSV (`TIC_t0`, `XIC_m-z194_t15`, `spettro_t0_RT14.3`, `MRM_364.1-194.1_t0`, `5file`...) e metadati tEXt nei PNG (Title, Description, Source, Software, Creation Time). Un pannello rinominato dallo studente usa il suo nome. I CSV non hanno metadati.
4. Bug del menu sotto i pannelli risolto (z-index dei menu 10000+, `front()` rinumera).
5. Colori con > 12 file: NON ancora controllato.
Verificato: e2e3-8 senza errori JS (restano solo le `api/notebook` ERR_ABORTED note e il 400 voluto di e2e5). pytest non rieseguito (nessuna modifica Python; nel container pip non trova pytest).

Idee non fatte: mappa con soglia regolabile, XIC in ppm per dati HRMS, minimappa del cromatogramma.

## Note
- Il `_cestino` è stato svuotato il 2026-10-05 alle 23:01: per tornare indietro c'è solo git.
- In `esempio_conversione/mzml/` il t30 del full scan si chiama `B_FullMass-t30 (2).mzML` (dato grezzo, non rinominato).
- Modifiche non committate di attributio (altro progetto): da riprendere a parte.
