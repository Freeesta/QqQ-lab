# QqQ lab

Programma didattico per esplorare dati LC-MS di un triplo quadrupolo (risoluzione unitaria) e cercare
i **prodotti di trasformazione (TP)** di un inquinante degradato nel tempo. Lo studente sceglie cosa
estrarre, integra, attribuisce e disegna: il programma mostra i dati, **non dà le risposte**.
Si usa **online, senza installare nulla** (https://freeesta.github.io/QqQ-lab/). I dati restano sul tuo computer.

*(English: a light teaching tool that runs in the browser to explore unit-resolution LC-MS data and look for
transformation products. It shows the data; the student does the reasoning.)*

## Versione online (nessuna installazione)

Apri https://freeesta.github.io/QqQ-lab/ in un browser recente (Chrome o Edge 90+, Firefox 114+, Safari 16+; pensato per computer con mouse, non per il telefono): Python e numpy girano
**dentro il tuo browser** (Pyodide, WebAssembly). La prima volta si scaricano circa 15 MB (mezzo minuto), poi la
pagina parte subito. I file mzML non vengono caricati su nessun server: restano nella memoria della pagina e nello
spazio del browser, così alla riapertura la sessione riprende da dove l'avevi lasciata (sullo stesso computer e
browser). Dopo la prima visita funziona anche senza internet (copia nel browser). Non c'è la conversione dei `.wiff` (serve msconvert): converti prima in mzML.
**I tuoi file non lasciano il tuo computer**: la pagina non li invia a nessun server (la pagina stessa limita per regola le connessioni a se stessa).
**Installare come app** (versione online): Chrome/Edge, icona "Installa" nella barra degli indirizzi; Safari su Mac, File → Aggiungi al Dock; iPhone/iPad, Condividi → Aggiungi alla schermata Home. Dopo la prima visita funziona anche offline (controllato con Chrome: nessun errore di installabilità, service worker attivo, test offline in `tests_e2e/e2e13.py`).
Come si pubblica: vedi `AGENTS.md`, sezione "Versione nel browser".

## Uso

Apri il sito, trascina i file `.mzML` (o "clicca per sceglierli"), controlla tempi e tipi, premi **Carica dati**.
Il taccuino (pannelli, XIC, integrazioni, annotazioni, disegni) si salva da solo nel browser e si ripristina alla riapertura.

## Sviluppo (solo per chi modifica il programma)

`pip install -e .` una volta, poi `python -m qqq_lab app` (opzioni `--workdir CARTELLA`, `--port`): server locale usato per i test e2e. Gli studenti usano solo il sito.

## Le schede

- **Dati**: in alto il cromatogramma totale (TIC) di tutti i file sovrapposti, sotto lo spettro di massa
  al tempo di ritenzione con l'intensità più alta; l'elenco dei file si chiude (&#9664;) per dare più spazio
  ai grafici. Trascina sul cromatogramma per lo spettro di un altro intervallo; clic destro per estrarre uno ione (XIC) o aggiungerlo a un pannello; il campo
  "m/z o formula" accetta anche una formula bruta. Pannelli spettro, XIC, MRM e mappa RT-m/z;
  vista impilata, scala log, zoom, cursore con i valori, sottrazione del bianco e linea di base,
  integrazione con tabella delle aree nel tempo (per le cinetiche) esportabile in Excel (.xlsx).
  Popup "Metodo" (parametri dello strumento) e "Calcolatrice m/z".
- **Tavola periodica** e **Addotti** (pulsanti in alto a destra): masse esatte e abbondanze isotopiche passando sopra gli elementi; tabella degli addotti ESI con l'm/z calcolato da una massa o una formula; profilo isotopico di una formula (M, M+1, M+2..., calcolato dal programma), che si può anche sovrapporre a uno spettro con il clic destro; perdite neutre più comuni.
- **Teoria**: dodici capitoli sulla teoria dell'esperienza (prodotti di trasformazione, fotocatalisi TiO2, LC in fase inversa, elettrospray, vuoto, teoria del quadrupolo, triplo quadrupolo e CID, come si frammentano gli ioni, full scan/MS2/MRM, strategia per i TP, glossario e bibliografia), con figure interattive calcolate nel browser. Si apre anche **senza il programma**, con doppio clic su `Teoria QqQ lab.html` (o `qqq_lab/web/teoria/index.html`), in qualsiasi browser e offline.
- **Disegno**: editor chimico (Ketcher) per molecole, frammenti e vie di trasformazione. Sotto ogni
  struttura compaiono da sole formula bruta e massa intera (m/z se c'è una carica), sopra ogni freccia la
  differenza fra le due strutture (es. +O). Selezionando una parte della molecola si vedono la sua formula
  e gli m/z possibili del frammento; con la gomma si rompe un legame. A destra: m/z degli addotti con
  pulsante XIC, didascalia per la relazione, guida rapida. Esporta PNG, JPEG, SVG e .ket.

I pulsanti **?** accanto alle funzioni spiegano a cosa servono. Ogni grafico ha i pulsanti **PNG** (immagine) ed **Excel** (dati); le esportazioni sono veri file .xlsx (numeri come numeri, intestazioni con le unità, un foglio per esportazione; la retta di taratura ha il foglio dei dati e il foglio «Retta» con pendenza, intercetta, R², LOD e LOQ): le tabelle e i grafici della relazione (cinetica, retta di taratura) si costruiscono lì.

Con risoluzione unitaria **un m/z è un candidato, non un'identificazione**. Sullo strumento del
laboratorio l'asse m/z è spostato di circa +0.3 Da: usa una finestra XIC di +-1 Da.

## File .wiff

Il programma legge solo mzML. I `.wiff` (con il loro `.wiff.scan`) si convertono con ProteoWizard
msconvert su Windows: vedi `../esempio_conversione/converti.bat`, oppure `python -m qqq_lab convert file.wiff`
se msconvert è installato (l'mzML va in `.qqq_lab-cache/`).

Solo per il docente: `python -m qqq_lab metodo FILE.dam -o metodo.json` legge i parametri del metodo
(sorgente e composto) per il popup "Metodo".

## Cosa puoi modificare, dal più semplice al più profondo

| Cosa | File | Serve programmare? |
|---|---|---|
| Interfaccia | `qqq_lab/web/` (`index.html`, `explore.js`, `draw.js`: JavaScript semplice, nessuna compilazione) | un po' |
| Calcoli | `qqq_lab/explore.py` | sì |
| Chimica | `qqq_lab/chem/` | sì |

Ketcher (Apache-2.0) e OpenChemLib (BSD-3) sono inclusi in `qqq_lab/web/vendor` (vedi il suo README).

## Altri comandi

`metodo` (solo per il docente, vedi sopra). Test: `python3 -m pytest -q tests`; prove nel browser in
`tests_e2e/` (vedi `AGENTS.md`).

## Limiti noti

- non ancora validato contro il software dello strumento su più composti;
- una sola polarità per file; nessuna normalizzazione con standard interno;
- Numpress non supportato (convertire con zlib).
