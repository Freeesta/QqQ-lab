# Prompt per la prossima chat (copia e incolla)

Sono Federico, dottorando in Chimica e Tecnologie Chimiche (UniTO). Continuiamo QqQ lab, programma didattico offline per il laboratorio inquinanti (QqQ SCIEX 3200 QTRAP, ESI+, Analyst 1.6.3): gli studenti esplorano gli mzML, scelgono gli XIC, integrano, disegnano TP e frammenti. NON dà risposte: il lavoro manuale e il ragionamento sono lo scopo. Conciso e critico, non cancellare file (usa `QqQ_lab/_cestino/`). Una sola chat alla volta su questa cartella.

## Leggi prima
1. `QqQ_lab/QqQ_lab/AGENTS.md`: obiettivi, convenzioni, mappa del codice, fatti sui dati, test ed e2e (tutto il "come" sta lì).
2. Questo file: stato, decisioni prese, prossimi passi.
3. Se serve: `README.md` (guida utente), `docs/PROGETTO_TP_FINDER.md` (progetto originale, in parte superato).

Se la cartella `QqQ_lab` non è collegata, chiedila con device_request_folder_access.

## Stato (2026-10-06, pomeriggio)
- **Ultimo lavoro**: schermata Dati rifatta (Carica dati, tipi Full Scan / MS² / MRM letti dal contenuto, Tipo campione/bianco/standard con concentrazione indovinata, smistamento .dam/mzML, tabella metodi) e flusso MRM con retta di taratura (`web/calib.js`, e2e15). Vedi AGENTS.md sez. 10. Da verificare da Federico con file veri: nomi degli standard e finestra di integrazione comune.

- **Git**: ramo `main`, 6 commit, HEAD `c713624`, albero di lavoro pulito, 1 commit avanti a `origin`: Federico deve premere **Push origin** (GitHub Desktop). Il commit lo fa la chat a fine lavoro (AGENTS.md, sezione 2 "Git"). Attenzione: ogni `git status`/`git` dalla VM senza permesso di cancellazione lascia un `.git/index.lock` vuoto: spostarlo in `_cestino/` (successo anche il 2026-10-06, vedi `_cestino/2026-10-06_git-lock/`).
- **Verifiche**: 25 pytest, e2e3-e2e10 presenti. Ultima esecuzione dichiarata: pytest-sostituto e e2e3-10 senza errori JS nuovi (restano le `api/notebook` ERR_ABORTED dei salvataggi keepalive interrotti dalla chiusura/ricarica, e il 400 voluto di e2e5). Rieseguiti in questa revisione: solo `node --check` su explore/draw/help/tables.js (ok). Prima di dichiarare "funziona" rifare e2e nel container (AGENTS.md sezione 5).
- **Dati**: TIC di tutti i file in alto, spettro sotto al picco più intenso, MRM sotto, pannelli a tutta larghezza con posti fissi (trascinando un'intestazione gli altri si scambiano), elenco file richiudibile; XIC (anche da formula), MRM, mappa RT-m/z, vista impilata, log, zoom con rettangolo e "Vista intera", cursore sincronizzato, bianco e baseline SNIP, sottrazione di fondo, integrazione con tabella e cinetica, caricamento di altri file a sessione aperta. Frecce scan per scan sul pannello attivo (senza cursore cambiano file). Cromatogramma PDA = `TWC` degli mzML (solo segnale totale).
- **Metodo**: nessun metodo predefinito; i parametri (sorgente, composti, LC/PDA) vengono solo dai `.dam` caricati dallo studente (card 2 della schermata di carico o pulsante nella scheda Metodo). Gradiente e PDA ricavati dai .wiff servono solo al docente (`python -m qqq_lab metodo`).
- **Verifica metodo/dati** (2026-10-06): dal .dam si leggono transizioni MRM e intervallo m/z; la scheda Metodo mostra "Il metodo corrisponde ai dati?" (tipo, intervallo m/z, CE, precursori, transizioni, durata, PDA). Provato su dati reali: B_FullMass-t0 coincide con max480 e diverge da max350; B_MRM-t0 con Flufe e non con Imida. Non decodificati: polarità e gli esperimenti MS2 con layout da 628 byte (senza intervallo). Schermata di carico: mzML in evidenza, .dam come zona di trascinamento, evidenza al passaggio dei file.
- **Esportazioni**: PNG su sfondo bianco con metadati tEXt, nomi file parlanti (`TIC_t0`, `XIC_m-z194_t15`...), pulsante CSV in ogni grafico (non sui cromatogrammi totali) e CSV per Excel in italiano (punto e virgola, virgola decimale, BOM), relazione HTML.
- **Disegno** (Ketcher offline): formula + massa intera sotto ogni struttura (m/z se carica), differenza sulle frecce, riquadro "Selezione (frammento)" con ipotesi di ione e pulsante XIC, gomma per rompere legami, didascalia (spenta di default), esportazione PNG/JPEG/SVG.
- **Tabelle**: Tavola periodica (isotopi, abbondanze), Addotti, Isotopi (spettro a barre + profilo calcolato in casa, sovrapponibile allo spettro con clic destro), Perdite neutre (massa intera; 4 riferimenti con link). Pulsanti PubChem e BioTransformer (link esterni). Pulsanti **?** di aiuto (`help.js`).
- **Teoria**: 11 capitoli con simulazioni (quadrupolo, ESI, QqQ, frammentazione CID, cinetica...), apribile anche da disco (`Teoria QqQ lab.html`). Esempio svolto: atrazina.
- **Avvio e aspetto**: `QqQ lab.app` (Mac), `Avvia QqQ lab.command`/`.bat` -> `scripts/avvia.py` (ambiente col Python più recente, Terminale con spunte); chiusura del browser = si ferma il programma (`--exit-on-close`). Logo vettoriale (`tools/genera_logo.py`, `genera_icone.py`). Interfaccia su sfondo chiaro neutro. Schede Attribuzioni e Suggerimenti tolte per scelta: non reintrodurle.

## Non ancora verificato
- **Mac reale**: `QqQ lab.app` (permesso Terminale, icona, Gatekeeper), icona del `.command`, chiusura della finestra del Terminale con osascript: mai provati. Se il doppio clic dice "privilegi di accesso": `chmod +x "Avvia QqQ lab.command"` (vale anche per `QqQ lab.app/Contents/MacOS/QqQ lab`).
- Windows con Python appena installato e prima apertura senza internet.
- Colori dei file quando sono più di 12.
- Perdite neutre: le colonne "tipica di" sono sintesi mie; Federico deve controllare i riferimenti (Levsen 2007, De Vijlder 2018, Demarque 2016, Holcapek 2010; pagine di Demarque non verificate).
- Spettri UV del PDA: non decodificati (`DADRealTimeData` dei .wiff); negli mzML c'è solo `TWC`.
- Da chiedere a Federico: nella sessione serale del 6 ottobre il suo messaggio si era interrotto dopo "Inoltre".
- Modifiche non committate di attributio (altro progetto, non in questa cartella): da riprendere a parte.

## Decisioni già prese
- **Excel**: tabelle e grafici per la relazione (cinetica C/C0, ln(C/C0), k; retta di taratura MRM; quantificazione) li costruiscono gli studenti in Excel dai CSV esportati. Il programma non li calcola.
- **Tablet: rinviato.** Strada scelta (2026-10-06): app web autonoma in JavaScript (mzML e calcoli nel browser, sito statico/PWA, interfaccia touch), NON ancora da implementare; forse tutto in JS anche per il computer, con Python solo come avviatore, per non avere due copie dei calcoli. Da tenere a mente: test che confronta i numeri JS con quelli Python sugli stessi mzML; DecompressionStream per lo zlib; tocco (pressione lunga = clic destro, pizzica = zoom, maniglie, bersagli >= 44 px); Safari cancella i dati dopo 7 giorni senza uso (Esporta sessione, PWA sulla Home); hosting https (GitHub Pages) o PC del laboratorio; Ketcher ~29 MB e scomodo col dito; `metodo` resta in Python. Pyodide e server gratuiti scartati.
- Niente strumenti che danno le risposte (frammentatori automatici tipo MetFrag/CFM-ID: solo citati nella Teoria). Ciò che si calcola parte sempre da un'ipotesi dello studente (formula, struttura, selezione).
- Nessun download di librerie: profilo isotopico e masse fatti in casa; Ketcher e OpenChemLib sono già in `vendor/`.

## Prossimi passi (proposta, in ordine)
1. **Push** del commit locale (Federico) e abitudine di commit a fine lavoro.
2. **Collaudo reale**: Mac (doppio clic, icona, Terminale), PC Windows nuovo, apertura senza internet, un giro completo dell'esperienza 3 fatto da Federico come studente.
3. **Validazione numerica contro Analyst** (2-3 file): RT, aree di XIC e MRM, rapporto Quant/Qual. Se le aree differiscono, capire perché (smoothing, baseline, integrazione) e scriverlo nella guida.
4. **Dati per gli studenti**: convertire in mzML tutti i .wiff dell'esperienza (`converti.bat` su Windows), cartelle per gruppo, controllare che tempi e tipi vengano indovinati dal nome (`guess_sample`).
5. **CSV delle integrazioni**: controllare che contenga quanto serve per taratura e cinetica in Excel (nome dello standard, concentrazione ricavata dal nome del file?).
6. **G3 MS2 e Disegno**: dal picco di uno spettro di ioni prodotto mandare l'm/z al Disegno (e viceversa evidenziare nello spettro gli m/z della selezione), senza proporre strutture.
7. **Guida breve per lo studente** (1-2 pagine, anche dentro la Teoria) e scheda per il docente allineata a G1/G2/G3 e alla relazione.
8. **Distribuzione**: nome definitivo del programma.
9. **Pulizia codice**: endpoint dei candidati (`/api/build`, `/api/candidate`, `/export/*.csv`, `/export/session.json`) da togliere o tenere per `candidates` e i test; e2e nella CI (Playwright su GitHub Actions; oggi la CI esegue solo pytest e il controllo di sintassi JS).

Idee non fatte: mappa con soglia regolabile, XIC in ppm per dati HRMS, minimappa del cromatogramma.

## Note
- Il `_cestino` è stato svuotato il 2026-10-05 alle 23:01 (per tornare indietro c'è solo git); da allora contiene: `2026-10-06_prompt_precedente.md` (cronologia dettagliata delle sessioni del 5-6 ottobre), `2026-10-06_sessione_e2e`, `2026-10-06_teoria_rinumerazione`, `git-index.lock-vuoto-creato-da-claude`, `2026-10-06_git-lock`.
- In `esempio_conversione/mzml/` il t30 del full scan si chiama `B_FullMass-t30 (2).mzML` (dato grezzo, non rinominato).


## Aggiunte del 2026-10-06 (da collaudare a mano)
- Cursore RT trascinabile nel cromatogramma (lo spettro sotto segue), barra m/z da…a… su TIC/BPC, icone (adatta alla vista, download), x più fitti, PDA sotto zero, spettro isotopico simulato (clic destro sullo spettro). Verificati in container con Playwright; da provare a mano su Mac/Windows.
- Test pytest: 26 (in container ne passa 25: manca il `.app`).

- Aggiunte (stessa sessione, da collaudare a mano): colonna Esperimento nella schermata di carico (tipo letto dal contenuto; Q1/EMS scelto dallo studente), lista file snella, icone di integrazione automatica/manuale nei grafici, select del precursore per MS2, PNG senza cursore e spettro con RT/scan, Metodo riorganizzato, `m/z` in corsivo ovunque, frasi di caricamento con i tre puntini subito. Test: 27 pytest + e2e12.
