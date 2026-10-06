# Prompt per la prossima chat (copia e incolla)

Sono Federico, dottorando in Chimica e Tecnologie Chimiche (UniTO). Continuiamo QqQ lab, programma didattico per il laboratorio inquinanti (QqQ SCIEX 3200 QTRAP, ESI+, Analyst 1.6.3): gli studenti esplorano gli mzML, scelgono gli XIC, integrano, fanno la retta di taratura, disegnano TP e frammenti. NON dà risposte: il lavoro manuale e il ragionamento sono lo scopo. Interfaccia in italiano, codice e commenti in inglese. Conciso e critico. Non cancellare file (spostali in `QqQ_lab/_cestino/`). Una sola chat alla volta su questa cartella.

## Leggi prima
1. `QqQ_lab/QqQ_lab/AGENTS.md`: obiettivi, convenzioni, mappa del codice, fatti sui dati, test ed e2e. Sezioni 8-11 = lavoro recente (memoria, versione browser, schermata Dati e MRM, schede).
2. Questo file: stato e lavoro da fare.
Se la cartella `QqQ_lab` non è collegata, chiedila con device_request_folder_access.

## Stato (2026-10-06, 15:40)
- Due versioni dello stesso codice: locale (`python -m qqq_lab app`, Python + numpy) e browser (Pyodide, GitHub Pages https://freeesta.github.io/QqQ-lab/, già pubblicata; si ricostruisce con `tools/build_site.py`). Il front end (`qqq_lab/web/*.js`, script classici) usa URL relativi e funziona in entrambe. Memoria dello studente: IndexedDB nel browser (archivi `files` e `kv`).
- Ultimo commit: `9baff43` "Dati: schede Full Scan / MS² / MRM...". Ci sono più commit locali avanti a `origin`: Federico preme **Push origin** (se non l'ha già fatto). Il commit lo fa la chat a fine lavoro, con titolo in italiano e le righe Co-Authored-By / Claude-Session del messaggio di sistema. Dalla VM serve `git -c user.name="Federico Cristaudo" -c user.email=fedecrista@gmail.com commit`. Aggiungi solo cartelle di codice (`git add AGENTS.md qqq_lab tests tests_e2e tools ...`), NON `_cestino/`.
- Fatto oggi (tutto verificato con test): pulizia output del terminale, schermata Dati rifatta (Carica dati, Tipo campione/bianco/standard, concentrazione dal nome, unità), MRM con retta di taratura (`web/calib.js`), doppio clic = nuovo spettro con RT, frecce su/giù dei pannelli con animazione, nuovo logo a quadrupolo e icone, **schede Full Scan / MS² / MRM** (`web/tabs.js`, `E.tab`, `p.tab`): striscia esperimenti MS² (un cromatogramma + spettro per precursore), pannelli Quantificatore e Qualificatore con integrazione specchiata, matrice "Tempi ed esperimenti".
- Test: `python3 -m pytest -q tests` (19) ed e2e Playwright `tests_e2e/e2e{3,4,5,6,9,10,12,13,14,15,16,17}.py` (e2e13 richiede prima `python3 tools/build_site.py --pyodide-dir /tmp/pyo`). Dopo ogni modifica: `node --check` sui js, pytest, e2e pertinenti, poi sincronizzazione sul Mac (tar -> device_commit_files -> tar xzf in `~/QqQ_lab/QqQ_lab`) e commit.
- Limiti noti: file con MS1 e MS² insieme (data-dependent) trattati come MS²; etichette dell'asse x dello spettro affollate se l'intervallo MS² è stretto.

## DA FARE ORA (richieste di Federico, 6 ottobre, 15:34)
Lavora in quest'ordine, aggiornandomi man mano. Il punto 1 NON va implementato: prima proponi e discutiamo.

### 0. Dati su cui decidere (guarda i file veri in `esempio_conversione/mzml/`)
Per le finestre XIC (punto 5) misura sui dati la larghezza a metà altezza (FWHM) di 2-3 picchi isolati negli spettri full scan (es. ioni delle B_FullMass) e proponi la semiampiezza migliore (ipotesi: ±0.25 Da, cioè 0.5 Da totali, coerente con la regola "a = da + 0.5"; con picchi larghi ~0.7 Da potrebbe servire ±0.35). Scrivi i numeri nella risposta.

### 1. Frecce destra/sinistra sul cromatogramma (SOLO discussione + verifica, nessuna nuova funzione)
Scenario: lo studente mette il cursore su un punto del cromatogramma, preme freccia destra/sinistra e guarda quali picchi dello spettro salgono e scendono. Il passaggio da una scansione all'altra deve essere il più immediato possibile.
Oggi: `stepScan` (explore.js ~455) sposta `p.cur` e chiama `pushLinked` -> `getSpec` (`api/spectrum`, memoizzato con `memo`) per ogni scansione. Prima di proporre, FAI:
- misura la latenza reale per scansione (server locale e Pyodide: `api/spectrum` per un singolo scan, tempo di disegno, ripetizione del tasto tenuto premuto = ~30 eventi/s);
- verifica se ci sono sfarfallii (lo spettro viene svuotato prima che arrivi il nuovo?), richieste in coda non annullate, ridisegni inutili dei pannelli collegati.
Poi proponi (non implementare) e discuti con me, con pro e contro, almeno queste idee: (a) prefetch delle N scansioni vicine (±20) con una sola chiamata a blocco e cache lato client; (b) tenere disegnato lo spettro precedente finché non arriva il nuovo (nessun flash) e scartare le richieste obsolete quando il tasto è tenuto premuto; (c) asse y dello spettro BLOCCATO durante la navigazione con le frecce (l'autoscala nasconde il salire e scendere dei picchi); (d) sagoma tenue della scansione precedente sovrapposta, o evidenziazione dei picchi che cambiano tra scan e scan; (e) per la versione browser: stessa cosa con decodifica già fatta in memoria. Dimmi quale consiglieresti.

### 2. Esportazioni in Excel vero (xlsx), non CSV
Tutte le esportazioni dati devono produrre un file Excel aperto (.xlsx): pulsante "CSV" di ogni grafico (`data-a="csv"`, explore.js ~380 e ~407), retta di taratura (`calib.js`, esporta CSV), tabella integrazioni/cinetica, eventuali altri CSV (cerca `csv`/`.csv`/`BOM`/`;` in explore.js, calib.js, tables.js, server.py `/export/*.csv`). Niente librerie scaricate: scrivi in casa un piccolo writer xlsx in JS (file OOXML minimale in uno zip senza compressione con CRC32; numeri come celle numeriche vere, intestazioni con unità, un foglio per esportazione, per la retta: foglio dati + foglio "Retta" con pendenza, intercetta, R², LOD/LOQ). Etichette dei pulsanti "Excel" (o "XLSX") con l'icona di download. Aggiorna help.js, README e i test (e2e6 verifica oggi BOM e punto e virgola: sostituirlo con apertura dello zip, lettura di `xl/worksheets/sheet1.xml` e controllo dei numeri; in tests/ si può verificare con openpyxl se presente). Funziona anche nella versione browser (download da Blob).

### 3. Icona del pulsante Metodo
L'icona attuale (tre cursori, `#np-method` in index.html ~105) sembra quella delle impostazioni. Sostituiscila con qualcosa che dica "come sono stati acquisiti i dati": proposta, una cartellina/scheda tecnica (clipboard con righe e un piccolo picco cromatografico), oppure una provetta. Mostrami la scelta. Il pulsante resta evidenziato (classe `imp`).

### 4. Concentrazione solo dove ha senso
Nella schermata Dati (tabella file, card 1) la colonna e il campo Conc. e il selettore di unità non devono comparire per i file Full Scan. Interpretazione da applicare (confermala in una riga nella risposta): la concentrazione si vede e si modifica solo per Tipo = standard di un esperimento MRM (serve alla retta di taratura); per Full Scan e MS² la cella è vuota/assente; il selettore unità `#cunit` si mostra solo se tra i file scelti c'è almeno uno standard MRM. Rivedi anche `ms2`: standard MS² non hanno concentrazione utile. Aggiorna e2e15.

### 5. Finestra "Estrai uno ione (XIC)" (`<dialog id="xicdlg">`, index.html ~156; logica `openXic`)
- Ordine: PRIMA "Finestra di estrazione (m/z): da [ ] a [ ]", POI tra le due righe la parola "oppure", POI "Formula neutra" con il selettore dell'addotto. Togli la riga "m/z o formula": l'm/z è già la finestra. Specifica nell'etichetta che la formula è quella NEUTRA (es. C9H10Cl2N2O, senza carica; l'addotto la trasforma in m/z).
- Quando lo studente scrive il valore "da", il campo "a" si compila da solo con da + 0.5; lo studente può comunque cambiarlo (anche più largo) e da quel momento non va più sovrascritto. Se invece scrive la formula, la finestra ricavata (m/z calcolato del singolo addotto ± semiampiezza scelta al punto 0) appare nei due campi.
- Cancella "(una cifra decimale)" (anche nel messaggio d'errore del filtro m/z della barra TIC, explore.js ~536 e ~616, e nel title).
- UN SOLO strumento per estrarre lo ione: la stessa finestra deve aprirsi (a) dal pulsante XIC, (b) dall'avviso che appare quando si prova a integrare dal TIC/BPC/PDA (explore.js ~967: già usa `openXic(null)`, tenerla), (c) dal tasto destro sul cromatogramma, che oggi usa invece una domanda separata `ask("m/z dello ione da estrarre")` (explore.js ~1241): sostituirla con `openXic`. Cerca altri punti che creano un XIC con scorciatoie diverse (clic destro sullo spettro, Disegno, Tabelle): possono prerompilare la finestra ma devono passare dalla stessa. Nessun tool duplicato.

### 6. Barra dei pulsanti dei grafici e tasto destro
Nell'intestazione dei pannelli cromatogramma/XIC/MRM (explore.js ~380):
- Gruppi separati da una barra verticale "|": [zoom (lente) + reset zoom] | [integrazione automatica + manuale] | [XIC] | [PNG / Excel]. Le frecce su/giù, ingrandisci e chiudi restano dove sono.
- Il pulsante "reset zoom" (oggi `data-a="fit"`, nascosto finché non c'è zoom e messo dopo le frecce) deve stare subito accanto alla lente; meglio sempre visibile ma disattivato quando non c'è zoom, così il layout non salta.
- Tasto destro sul cromatogramma (`ctxFor`, explore.js ~1186-1241): aggiungere "Ripristina zoom" (attivo solo se c'è zoom), oltre a "Estrai uno ione (XIC)..." che apre la finestra unica del punto 5.
- Verifica che le intestazioni non vadano a capo con 1500 px e con finestre strette (select integrazione, Pulisci, tabella restano nascosti finché non servono).

### Alla fine
Aggiorna AGENTS.md (nuova sezione 12: xlsx, finestra XIC unica, gruppi pulsanti, regole su concentrazione, esito della discussione sulle frecce), help.js, README, questo file; nuovi test (e2e18: finestra XIC con compilazione automatica di "a", "oppure", tasto destro con reset zoom, esportazione xlsx valida; adatta e2e6, e2e15, e2e16). Rilancia tutta la suite (compreso e2e13 dopo build_site), sincronizza sul Mac, committa e dimmi di premere Push origin. Un messaggio di avanzamento dopo ogni punto concluso.

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
