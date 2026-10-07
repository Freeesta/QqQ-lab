# PROSSIMA CHAT (QqQ lab): grafici più puliti, strumenti per lo spettro, meno aiuti invadenti, calcolatrice, licenze

> **Come si usa e si mantiene questo file.** Contiene SOLO il lavoro ancora da fare. Quando un punto è fatto e verificato, **cancellalo da questo file** (niente «fatto», niente cronaca: la storia sta in `git log` e in `AGENTS.md`); le conoscenze utili (regole, nomi di funzioni, decisioni) vanno in `AGENTS.md`. Una parte fatta a metà si riscrive come ciò che manca. Rinumera. L'aggiornamento di questo file è nello stesso commit del lavoro.

Lavori in `~/QqQ_lab/QqQ_lab` (sul Mac) oppure nel clone GitHub (cloud). Leggi `AGENTS.md` (sez. 1-2, 5, 16 e le righe di sez. 3 sui file che tocchi), poi solo i punti di codice indicati qui con `grep -n` (i numeri di riga sono indicativi). Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z».
- Non cancellare file: `_cestino/` (nel cloud: `git mv` in `_cestino/<data>/`).
- Il programma mostra i dati, non dà risposte agli studenti.
- Lavora su `main` (sul Mac) o sul ramo della sessione (cloud, poi pull request). Un commit per blocco concluso (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema). Il push lo fa Federico (sul Mac).
- **Verifica con `python3 tools/verifica.py`** (AGENTS.md sez. 5): `--solo e2eN,...` durante il lavoro, completa alla fine; leggi `.verifica/ultimo.md` e i log SOLO dei FAIL. Dati veri: `QQQ_MZML`/`QQQ_DAM` o il repository privato `Freeesta/QqQ-lab-dati`.
- Risparmio token: un blocco alla volta, `grep -n`, non rileggere file già letti, prove mirate.
- Federico vuole un'interfaccia **pulita**: meno testi di avviso, meno «?», meno pulsanti. Nel dubbio, togli.
- **Semplice prima di tutto**: dai precedenza a ciò che serve di più agli studenti nell'esperienza (spettri, XIC, integrazione); le funzioni avanzate devono restare nascoste finché non servono (menu, pannello «Parametri»), mai aggiungere righe di controlli fisse. Preferisci **icone** (SVG nello stile di `QICON`, con `currentColor`) con un'**etichetta breve** che compare restando fermi ~1.5 s (1-2 righe, cosa fa e come si usa), non testi fissi.
- **Aggiorna Federico**: alla fine di OGNI blocco scrivigli un messaggio breve (3-5 righe): cosa hai fatto, cosa non hai potuto fare, cosa provare a mano. Se un punto richiede una scelta che cambia l'interfaccia in modo non descritto qui, fai la versione più semplice e segnalalo nel messaggio.

## Ordine di lavoro (per importanza)
1. **Blocco A** grafici (`explore.js` + CSS in `index.html`)
2. **Blocco G** strumenti per lo spettro (misura Δm/z, %, parametri, tabella dei picchi, zoom e assi collegati)
3. **Blocco B** aiuti e testi
4. **Blocco C** calcolatrice + **Blocco F** Disegno (piccoli, insieme)
5. **Blocco H** strumenti per la cromatografia (più avanzati: S/N, parametri del picco, vista a cascata)
6. **Blocco D** licenze
7. **Blocco E** residui
Un commit per blocco e un messaggio a Federico per blocco. Se il tempo o i token finiscono, fermati dopo un commit pulito: è meglio finire bene i blocchi 1-3 che iniziare tutto.

---

## BLOCCO A: grafici (spettro, cromatogramma, XIC, MRM)

### A1. Spettro: asse x fisso di default, lucchetto solo per l'asse y
**Oggi**: scorrendo le scansioni l'asse x dello spettro cambia (fa «stacchetti») a meno di bloccarlo; il lucchetto (`p.lock`, cerca `lock` in `explore.js`: salvataggio ~r.136, creazione ~r.548, reset ~r.602, `scFetch` ~r.1535, ~r.1685, ~r.1702) blocca x e y insieme.
**Da fare**:
1. **Asse x sempre fisso** sull'intervallo m/z MASSIMO di tutte le scansioni del file (o dei file mostrati): usa la finestra di scansione del metodo se nota (`info().scan_window`), altrimenti min/max degli m/z su tutte le scansioni del livello/precursore (calcolalo una volta e tienilo in cache). Cambia solo se lo studente fa zoom o cambia file/precursore. Nessun lucchetto per x.
2. **Il lucchetto blocca solo l'asse y** (il massimo dell'intensità), per vedere le variazioni fra scansioni. Spostalo **vicino all'asse y** (in alto a sinistra del grafico, accanto all'etichetta dell'asse, piccolo), non nella barra dei pulsanti; `title`: «Blocca l'asse delle intensità: così vedi crescere e calare i picchi fra una scansione e l'altra». Con le frecce si chiude da solo come oggi (mantieni la logica di crescita di `ymax` se un picco supera il massimo).
3. Aggiorna `HELP`/tooltip, `AGENTS.md` (sez. 12 o 16) e gli e2e che controllano il lucchetto (cerca `lock` in `tests_e2e/`).

### A2. Zoom: riquadro nel grafico, linea fuori dagli assi
**Regola unica per cromatogramma, XIC, MRM e spettro** (la mappa RT-m/z ha già il suo zoom 2D: non toccarla):
1. **Trascinando DENTRO l'area del grafico** (con lo strumento lente attivo, come oggi): **riquadro** che ingrandisce **x e y insieme** (oggi nel cromatogramma il riquadro agisce solo sul tempo: cerca `izoom`, `p.zoom`, `p.zoomY`).
2. **Trascinando nella zona dei numeri a SINISTRA dell'asse y** (margine sinistro `M.l`): compare una **linea verticale** (non un riquadro) e si ingrandisce **solo y** (`p.zoomY`). Funziona sempre, anche senza la lente.
3. **Trascinando nella zona dei numeri SOTTO l'asse x** (margine inferiore `M.b`): **linea orizzontale**, si ingrandisce **solo x** (`p.zoom`).
4. Cursore del mouse coerente (`ns-resize` a sinistra, `ew-resize` sotto, `crosshair` dentro con la lente). Reset zoom e doppio clic come oggi; Ctrl/Cmd+rotella resta.
5. **Togli il pulsante «y ×10»** (`data-a="yz"`, ~r.603, e `p.yz`: ~r.136, ~r.602, ~r.714, ~r.1113): lo sostituisce il punto 2. Ripulisci salvataggio/ripristino del taccuino (un vecchio `yz` nel taccuino va ignorato senza errori).
6. Aggiorna il tooltip della lente e la Teoria/aiuto dove citano «y ×10». e2e: riquadro xy, linea solo y, linea solo x, assenza di «y ×10».

### A3. Excel anche sul cromatogramma totale
Oggi il pulsante Excel manca su TIC/BPC/PDA (decisione vecchia in `AGENTS.md`: «niente pulsante Excel sui cromatogrammi totali»): **aggiungilo** come negli altri pannelli (`plotSheets`, ~r.441, ~r.562, ~r.600). Colonne: «RT (min)» + una colonna per file visibile (unità: «Intensità (cps)» o «Segnale PDA (unità del file)»). Aggiorna la riga di `AGENTS.md` (sez. 3 e 12) e un e2e (download con `xlsx_rows` di `tests_e2e/lib.py`).

### A4. XIC dal clic destro sullo spettro: il pannello nasce SOTTO quello spettro
Clic destro su un picco dello spettro → «Estrai l'XIC…» (~r.1745, ~r.1761, `openXic(null, {mz, obs:true})`): il nuovo pannello XIC va **subito sotto lo spettro da cui è partito**, e gli altri scorrono in giù (usa `stackAfter(nuovo, spettro)` + `relayout()` + `fitHost()` come fa `newSpec`, ~r.1710-1731; passa a `openXic` il pannello di origine). Poi scorri la vista sul pannello nuovo (come già fa per i pannelli nuovi). e2e: l'XIC ha `y` = y dello spettro + altezza + margine.

### A5. Un solo file nella scheda: «Solo il selezionato»
Con un solo file nella scheda, oggi la modalità resta «Tutti sovrapposti» (solo disattivata visivamente: `renderNav`, `#fmode` ~r.340-354, `E.browse`). Deve essere **«Solo il selezionato» attivo** e **«Tutti sovrapposti» disattivato** (grigio, `title` «C'è un solo file»). Quando i file diventano 2 o più, ripristina la scelta precedente dello studente (non forzarla). e2e: `tests_e2e/e2e_unfile.py` (estendilo).

### A6. Pulsante attivo: icona sempre visibile
Quando uno strumento è attivo (lente, integrazione automatica/manuale, lucchetto, ecc.) il pulsante diventa blu e l'icona sparisce (stesso colore). Regola CSS unica in `index.html` (gruppi `.tbg`, `.bt.on`/`aria-pressed`): con lo sfondo pieno dell'accento, icona e testo **in bianco** (`color:#fff`; negli SVG usa `currentColor` per `stroke`/`fill`: correggi le icone che hanno colori fissi). Vale in tema chiaro e scuro e con le palette di accessibilità. Controlla con uno screenshot di ogni pulsante attivo.

---

## BLOCCO G: strumenti per lo spettro di massa (Full Scan e MS2)
Nella scheda MRM non ci sono spettri: questo blocco riguarda gli spettri di Full Scan e MS2. Tutti i controlli nuovi stanno in UN'icona «Parametri dello spettro» (G2) o nel menu del clic destro, non in righe nuove.

### G1. Misura Δm/z fra due picchi (righello)
Serve per perdite neutre e differenze fra ioni: il programma fa solo la sottrazione, l'interpretazione resta allo studente (niente nomi di perdite proposti).
- **Come si usa** (una sola logica, semplice): clic destro su un picco → «Misura da questo picco»: il picco diventa il **riferimento** (segno verticale tratteggiato e etichetta «rif.»). Da quel momento, passando sugli altri picchi, l'etichetta di passaggio mostra anche «Δm/z = +42.0» rispetto al riferimento; **clic su un secondo picco** fissa la misura: una parentesi orizzontale fra i due picchi con il valore Δm/z sopra (1 decimale, coerente con la risoluzione unitaria; segno + verso destra). Si possono fissare più misure dallo stesso riferimento. Esc, doppio clic o clic destro → «Togli le misure» le cancella.
- Aggancio al centroide del picco più vicino (come il tooltip `p._a.hov` di `drawSpec`), mai a un punto vuoto.
- Icona righello anche nell'intestazione dello spettro (stesso comportamento: attiva → clic sul primo picco = riferimento, clic sul secondo = misura), con etichetta breve.
- Le misure restano con lo zoom, entrano nel PNG, si salvano nel pannello (`p.meas`), si tolgono cambiando file o precursore. e2e: riferimento, misura fissata con il valore giusto (es. 364.4 → 194.2 = 170.2), Esc la toglie.

### G2. Icona «Parametri dello spettro» (soglia, %, decimali, etichette)
Un'icona (ingranaggio piccolo o «sliders») nell'intestazione di ogni spettro apre un riquadro a tendina sotto l'icona (stile della calcolatrice nuova del Blocco C: niente sfondo scuro), con pochi controlli:
- **Asse y: assoluto (cps) / % del picco più alto**. Predefinito: **% negli spettri MS2** (prodotto: si confrontano le intensità relative dei frammenti), **assoluto negli spettri Full Scan**. Lo studente può cambiarlo in ogni pannello; la scelta resta nel pannello (`p.rel`, taccuino). In % l'etichetta dell'asse è «Intensità relativa (%)»; il cursore e la tabella dei picchi mostrano sia % sia cps. Con il lucchetto (Blocco A1) in %, si blocca la scala % (100 = massimo della scansione del blocco).
- **Soglia per le etichette dei picchi**: etichetta solo i picchi sopra X% del picco più alto (predefinito 5%) e al massimo N etichette (predefinito 10); i picchi sotto soglia restano disegnati.
- **Decimali delle etichette m/z**: 0, 1 (predefinito), 2.
- Ripristina predefiniti. Tutti i valori nel pannello e nel taccuino. e2e: MS2 parte in %, Full Scan in assoluto, soglia cambia il numero di etichette.

### G3. Tabella dei picchi dello spettro, pronta per Excel
- Pulsante con icona «tabella» nell'intestazione dello spettro → tabella dei picchi della scansione/intervallo mostrato: **m/z**, **intensità (cps)**, **% del picco più alto**; ordinabile per colonna (clic sull'intestazione); filtri sopra la tabella: **soglia minima %** (predefinito quella del G2), **intervallo m/z da/a** (predefinito quello visibile), **numero massimo di righe**.
- **Copia per Excel**: pulsante «Copia» che mette negli appunti la tabella come testo separato da TAB con intestazione, numeri con il **punto** decimale o con la **virgola** a scelta (Excel italiano vuole la virgola: predefinito virgola se `navigator.language` inizia con «it»), niente separatori delle migliaia; incollata in una cella di Excel deve riempire righe e colonne giuste con numeri veri. Scrivi anche `text/html` (una `<table>`) negli appunti con `ClipboardItem` se disponibile, così Excel/Numbers/Word la incollano già formattata; ripiego `navigator.clipboard.writeText`. Più il pulsante Excel (`.xlsx`, come gli altri, `dlx`).
- Intestazione con il contesto: file, RT o intervallo, scansione, precursore (MS2). e2e: copia (leggi gli appunti nel test con i permessi di Playwright), numero di righe con la soglia, xlsx.

### G4. Zoom: annulla e vista intera da tastiera
- **Backspace** (fuori dai campi di testo) = vista intera del pannello attivo; **Ctrl/Cmd+Z** = zoom precedente (storia degli ultimi 15 zoom per pannello, `p.zh`); se nella pagina c'è già un Ctrl+Z (Disegno/Ketcher) non interferire: vale solo nella vista Dati con un pannello attivo.
- Aggiungi le due scorciatoie all'elenco delle scorciatoie e alle etichette dei pulsanti di zoom. e2e.

### G5. Assi del tempo collegati
Interruttore (icona «catena») nell'intestazione dei pannelli cromatogramma/XIC/MRM: i pannelli collegati della stessa scheda condividono l'intervallo di tempo (zoom su uno = zoom su tutti, anche il reset). Spento di default; la scelta resta nel taccuino. Non collegare l'asse y. e2e: zoom sul TIC → XIC collegato con lo stesso intervallo.

### G6. Intestazione della scansione mostrata
Sotto ogni spettro una sola riga fissa (estendi `specCaption`, ~r.643): «scansione 812/1100 · RT 14.320 min · TIC 2.1e8 · picco base m/z 194.2 (4.2e6)»; per MS2 anche precursore e CE. Cifre a larghezza fissa (`tabular-nums`). Per un intervallo: «media di N scansioni, RT 14.27-14.34 min».

---

## BLOCCO B: aiuti e testi (interfaccia più pulita)

### B1. Via i «?»: etichette al passaggio del mouse
Ci sono troppi pulsanti «?» (`.hq`, `helpBtn(...)` in `explore.js`, `index.html`, `tabs.js`, `origine.js`; testi in `HELP` di `help.js`). Federico preferisce: **resti fermo ~1.5 s su un controllo e compare una piccola etichetta** che spiega cosa fa (esiste già un tooltip ritardato dalla chat del 6/10: cerca in `explore.js`/`index.html` il ritardo ~1.7 s e riusalo, uniformandolo a ~1.5 s).
1. **Togli tutti i «?»** dei pannelli, delle barre, delle schede Full Scan/MS2/MRM e della schermata di caricamento. Resta SOLO il «?» generale in alto a destra nell'header.
2. Il testo breve di ogni «?» tolto diventa l'etichetta (`title` o tooltip proprio) del controllo o del titolo del pannello corrispondente: 1-2 frasi, niente paragrafi.
3. I testi lunghi di `HELP` che servono ancora (spiegazioni di metodo) vanno nel «?» generale, organizzati per voce (Dati, XIC, Integrazione, Taratura, Disegno, ...), oppure in Teoria se lì c'è già il capitolo: non perderli, ma non lasciarli sparsi nell'interfaccia.
4. Ogni pulsante con sola icona deve avere un'etichetta. Controllo: uno script e2e conta i `.hq` visibili (= 1) e verifica che ogni `button` visibile senza testo abbia `title` o `aria-label`.

### B2. Meno avvisi e disclaimer
Federico: «ci sono troppi disclaimer ovunque, danno fastidio».
1. Fai l'elenco (`grep -n` su `qqq_lab/web/*.js` e `index.html`: frasi tipo «può essere», «attenzione», «ricorda», «nota», «non è un'identificazione», testi in `class="muted"` sotto tabelle e finestre).
2. Togli dall'interfaccia quelli ripetuti o ovvi; tieni solo gli avvisi che impediscono un errore concreto in quel momento (es. «servono almeno due standard»). Il concetto scientifico (risoluzione unitaria: un m/z è un candidato) resta UNA volta in Teoria e nel «?» generale, non in ogni finestra.
3. Aggiorna `AGENTS.md` sez. 1 principio 4 di conseguenza («mostrarlo sempre» diventa «spiegarlo in Teoria e nel ? generale, senza avvisi ripetuti»). Nel report elenca cosa hai tolto (una riga per testo).

### B3. Icone delle schede Full Scan / MS2 / MRM
Le icone nelle schede (`tabs.js` ~r.12: `QICON.get(TABICON[t], 16)`) e nelle intestazioni della lista file sono troppo piccole e confuse. Portale a ~22-24 px con un disegno più semplice (meno linee, tratto più spesso: `icons-modi.js`), e controlla con uno screenshot a 1280 e 1440 px. Se anche ingrandite restano poco leggibili, toglile dalle schede e dalla lista file (resta il testo) e tienile solo dove spiegano i modi (Teoria cap. 9, aiuto). Scegli e motiva nel report con lo screenshot.

---

## BLOCCO C: calcolatrice m/z

1. **Non più finestra modale al centro** (`<dialog id="calcdlg">` in `index.html` ~r.148 aperta con `showModal()`, `explore.js` ~r.1902-1915): oggi è piccola, oscura tutto e copre i grafici. Deve diventare un **riquadro a tendina che si apre subito sotto il suo pulsante** nell'header (`#np-calc2`), **senza sfondo scuro**, lasciando visibili e usabili cromatogramma e pannelli; si chiude con lo stesso pulsante, con Esc o con la ×; resta aperta mentre lo studente lavora sui grafici. Più larga di oggi (almeno 520 px, testo leggibile). Su schermo stretto si allarga a tutta la larghezza sotto l'header.
2. **Formula in minuscolo**: deve funzionare anche con `c9h10cl2n2o`, `C9h10Cl2n2O`, ecc. Regola: leggi da sinistra; una lettera seguita da una minuscola forma un simbolo di due lettere SOLO se esiste ed è un elemento comune in chimica organica/ambientale (Cl, Br, Si, Na, Se, ...); altrimenti sono due elementi (es. `co` = C + O, non Co; `cl` = Cl). Mostra sempre sotto il campo la formula interpretata in forma corretta («interpretata come C9H10Cl2N2O»), così lo studente vede cosa è stato calcolato. Stessa funzione anche nella finestra XIC (formula neutra) e negli altri campi formula (Addotti, Isotopi): una sola funzione condivisa, con test (pytest se il parsing è in Python `parse_formula`; altrimenti test JS in e2e).
3. **Togli la colonna «1 decimale»** (calcolatrice ~r.1911 e tabella Isotopi in `tables.js` ~r.224) e **togli la frase** «L'asse m/z di questo strumento può essere spostato di qualche decimo di Da…» (~r.1913).
4. e2e: apertura sotto il pulsante senza sfondo scuro, grafico cliccabile con la calcolatrice aperta, formula minuscola, assenza della colonna e della frase.

---

## BLOCCO F: scheda Disegno

### F1. Decimali della massa fino a 5
Il menu «decimali» delle scritte sotto le strutture (`<select id="lb-dec">` in `index.html` ~r.124, opzioni 0-4; letto in `draw.js` ~r.240-290, salvato in `NB.labDec`) deve arrivare a **5**. Controlla che: la massa sotto le strutture, l'm/z degli ioni (menu «Ione») e le esportazioni PNG/SVG mostrino i decimali scelti; l'arrotondamento sia half-up anche con i decimali (oggi `toFixed(dec)` per dec > 0 e `roundHalfUp` solo per 0, ~r.248: usa la stessa funzione half-up dell'Addotti/`elements.py`, AGENTS.md sez. 16); un taccuino vecchio con `labDec` da 0 a 4 si ripristina senza errori. e2e: scelta 5 → scritta con 5 decimali (es. paracetamolo M = 151.06333).

---

## BLOCCO H: strumenti per la cromatografia (più avanzati: fai dopo i blocchi A, G, B, C, F)
Tutto opzionale nell'interfaccia: colonne o voci che compaiono solo se lo studente le chiede, con un'etichetta breve. Il programma calcola, lo studente interpreta.

### H1. Rapporto segnale/rumore (S/N) di un picco integrato
Nella tabella delle integrazioni (`explore.js` ~r.1463, `INT_COLS`/`INT_HEADS`) una colonna facoltativa **S/N**: altezza del picco (sopra la linea di base) diviso il rumore, con il rumore = deviazione standard (o picco-picco/5: scegli e scrivilo nell'etichetta) in una **zona di rumore scelta dallo studente** (trascinamento con un tasto «Scegli la zona di rumore» vicino al picco). Senza zona scelta: cella vuota con etichetta «scegli la zona di rumore». Utile per LOD/LOQ (collega la spiegazione in Teoria e la retta di `calib.js`). Esporta anche in xlsx.

### H2. Parametri del picco (parte di cromatografia LC)
Colonne facoltative nella stessa tabella: **larghezza a metà altezza (min)**, **piatti teorici N** (= 5.54 · (tR / w½)²), **fattore di coda** (USP, a 5% dell'altezza) o **asimmetria** (a 10%: scegli uno dei due e scrivilo). Interruttore «Mostra parametri cromatografici» sopra la tabella (spento di default). Formule nel «?» generale / Teoria cap. LC, una riga ciascuna. Test pytest/e2e con un picco gaussiano sintetico (N e coda noti).

### H3. Vista «a cascata» dei cromatogrammi nel tempo
Nel menu della vista dei cromatogrammi (oggi `select data-o="mode"`, ~r.789: sovrapposti / impilati) una voce **«a cascata»**: i file della scheda ordinati per tempo (t0 davanti), ognuno spostato in alto e un po' a destra, con i colori per tempo (sez. 16 di `AGENTS.md`), riempimento bianco sotto ogni traccia così le tracce dietro sono coperte. Asse x reale sotto la traccia di t0; etichetta del tempo accanto a ogni traccia. Zoom e PNG funzionano. Niente cursore di lettura dei valori in questa vista (dirlo nell'etichetta). e2e + screenshot con 7 file.

---

## BLOCCO D: licenze nel README (fallo per bene)
1. Elenca TUTTO il materiale di terzi presente nel repository e nel sito: Ketcher (`vendor/ketcher`, licenza in `vendor/ketcher/LICENSE.txt`), OpenChemLib (`vendor/openchemlib.LICENSE`), Pyodide (scaricato da `tools/build_site.py`), numpy, eventuali font, dati di masse/abbondanze (`tools/genera_elementi.py`: masse da OpenChemLib, pesi da Ketcher, abbondanze IUPAC), immagini della Teoria, **il logo** (`tools/logo_sorgente.jpg`: secondo `AGENTS.md` sez. 3 deriva da `QuadrupoleContour.svg` di **Wikimedia Commons**, passato in un generatore di immagini Gemini). Leggi le licenze dai file in `vendor/` (solo il file di licenza, non il codice).
2. Per il logo: verifica la licenza della pagina Commons di `QuadrupoleContour.svg` (WebFetch su `commons.wikimedia.org/wiki/File:QuadrupoleContour.svg`). Se è CC BY-SA o simile: attribuzione (autore, link, licenza) nel README e in `qqq_lab/web/teoria` o nel «?» generale, e nota sul fatto che il logo derivato va distribuito con la stessa licenza; se il sito non è raggiungibile, scrivilo e lascia il punto aperto qui. Non decidere tu di cambiare logo: segnalalo a Federico se la licenza è un problema.
3. Nel `README.md` una sezione **«Licenze e crediti»**: licenza del programma (MIT, `LICENSE`), poi una riga per componente (nome, versione se nota, licenza, link, dove si trova). Se serve, un file `LICENZE-TERZI.md` con i testi o i link completi. Controlla che `tools/build_site.py` copi nel sito i file di licenza di Ketcher/OpenChemLib/Pyodide richiesti dalle loro licenze; se no, aggiungilo.

---

## BLOCCO E: residui da verificare
1. **Finestra XIC [n-0.2, n+0.8]** (`XIC_BELOW`, `XIC_DRIFT` in `explore.js`): misura con i dati veri la parte frazionaria (centroide osservato meno nominale del calcolato) sugli ioni forti di TUTTI i file Full Scan; conferma o cambia le costanti e scrivi i numeri in `AGENTS.md` sez. 12.
2. **e2e con i dati veri**: `python3 tools/verifica.py` completo; correggi ciò che fallisce (in particolare e2e12, che non trovava `#pick`, ed e2e13, 17, 19, 20, 21, 23 non eseguiti dopo la finestra XIC nuova).
3. **e2e26 (limiti RT)**: la selezione non si crea, la prova non prova nulla: rendila effettiva o testa direttamente la funzione di limite.

---

## Lavori in coda (NON farli senza il via libera di Federico)
1. **Dati dello studente**: `navigator.storage.persist()` + spazio usato; Esporta/Importa sessione (.zip con file, `taccuino.json`, `LEGGIMI.txt`; la scrittura zip c'è in `xlsx.js`). Dove mettere i pulsanti: da decidere con Federico (l'ingranaggio ha 3 controlli).
2. **Origine degli ioni**: Pyodide lento (`/api/origin` 19-38 s, obiettivo < 10 s); standard puro = t0 (eccesso F_t - r0*P_t); TP Mine: `isf.isf_classify` → flag `insource` (verifica se già fatto).
3. **Da provare a mano (Federico)**: Windows, Safari, file grandi, retta di taratura contro Analyst.
4. **Limiti noti** (non nasconderli): file MS1+MS2 insieme trattati come MS2; PDA solo TWC (niente spettri UV).

## Chiusura
- `python3 tools/verifica.py` completo; ultimo messaggio a Federico (report breve): riassunto prima/dopo, una riga per punto (fatto / proposta / non fatto e perché), elenco dei testi tolti (B2), cosa provare a mano con Cmd+Shift+R.
- Aggiorna `AGENTS.md` (decisioni cambiate: Excel sul TIC, niente «?» sparsi, principio 4, zoom e scorciatoie, lucchetto solo y, calcolatrice, % negli MS2, righello, tabella dei picchi, assi collegati, S/N e parametri del picco, cascata) e cancella da questo file ciò che è fatto.
