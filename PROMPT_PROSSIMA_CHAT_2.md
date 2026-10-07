# PROSSIMA CHAT 2 (QqQ lab): perdite neutre, ritocchi a spettro/menu/zoom, test rossi

> **Quando usarlo**: DOPO che il lavoro di `PROMPT_PROSSIMA_CHAT.md` (pull request #2, blocchi A, S, G, B, C, F, …) è stato unito in `main`. Prima di toccare un punto, controlla nel codice se l'altra chat l'ha già fatto o cambiato (molti punti toccano lucchetto, menu, annotazioni, etichette): adatta, non rifare. Quando un punto è fatto e verificato, **cancellalo da questo file**; ciò che resta utile va in `AGENTS.md`. A lavoro finito, se il file è vuoto, spostalo in `_cestino/<data>_prompt_completati/`.

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con il repository `QqQ-lab-dati` per i dati veri). Leggi `AGENTS.md` (sez. 1-2, 5 e le sezioni recenti 16-17+), poi solo i punti di codice che servono, con `grep -n`. Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti.
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole (pulsante «Dettagli», menu, tendine). Icone con etichetta breve (1-2 righe) al passaggio del mouse.
- Un commit per blocco (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema); sul Mac su `main`, nel cloud sul ramo della sessione + pull request.
- **Verifica**: `python3 tools/verifica.py --solo <e2e che tocchi>` durante il lavoro, completa alla fine. **NON lanciare** e2e13, e2e_tpmine1, e2e_tpmine2, `tools/build_site.py` né niente che scarichi Pyodide (decisione di Federico: risparmio di token e tempo; il sito lo costruisce GitHub).
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe (fatto, non fatto, cosa provare a mano).

## Ordine di lavoro
1. Blocco T (test rossi, breve) → 2. Blocco R (ritocchi a spettro, menu, zoom, etichette) → 3. Blocco N (perdite neutre). Se il budget finisce, fermati dopo un commit pulito.

---

## BLOCCO T: test rossi «noti»
Un test che resta rosso a lungo nasconde i guasti nuovi. Alla fine di questo blocco non devono restare test rossi «noti».
1. **e2e6** (fallisce dal 6/10, vista iniziale + Disegno) ed **e2e24** (nuovo, sospetto problema di tempi): trova la causa leggendo SOLO `.verifica/log/e2e6.log` e `e2e24.log` e la parte del test che fallisce.
   - Se il test controlla cose cambiate apposta (testi, pulsanti, valori predefiniti, decimali): aggiorna il test.
   - Se è un problema di tempi: fai aspettare la condizione giusta (un elemento visibile, un valore in `E`/`NB`) invece di un tempo fisso.
   - Se è un difetto del programma: correggilo.
2. **e2e12** usava `scansione-15.mzML`, che non è nel repository dei dati: se non è già stato fatto, adattalo ai file della serie B.
3. Riporta nel messaggio a Federico la causa di ciascuno in una riga.

---

## BLOCCO R: ritocchi chiesti da Federico il 7/10 (spettro, menu, zoom, etichette)

### R1. Lucchetto dell'asse y aperto di default (deciso da Federico)
In tutti gli spettri (Full Scan e MS2) il lucchetto parte **aperto** e **non si chiude mai da solo** (nemmeno con le frecce ← →): lo chiude lo studente quando decide di confrontare le scansioni, e resta chiuso finché non lo riapre (o fino a «Vista intera»/doppio clic). Aggiorna i test che si aspettavano la chiusura automatica.

### R2. Clic destro su un picco dello spettro → XIC diretto, senza finestra
«Estrai l'XIC di m/z …» dal clic destro sullo spettro apre **subito** il pannello XIC (sotto lo spettro, come già fa) con la finestra predefinita (la regola unitaria attuale: `XIC_BELOW`/`XIC_DRIFT` o quella in uso), **senza** il dialogo `#xicdlg`. La finestra si cambia poi dall'intestazione del pannello XIC («m/z da … a …»). Il dialogo resta per il pulsante XIC (valore o formula + addotto).

### R3. «Aggiungi a «Ione estratto (XIC)»» non si capisce
Nel menu dello spettro la voce che aggiunge l'ione a un pannello XIC esistente diventa **«Sovrapponi all'XIC di m/z 194.2 (pannello 3)»** (m/z e numero del pannello di destinazione), con etichetta «Aggiunge questo ione nello stesso grafico: utile per vedere se due ioni escono allo stesso tempo». Una voce per ogni pannello XIC della scheda (massimo 3; se sono di più, un sottomenu «Sovrapponi a un XIC…»).

### R4. Annotazioni: non devono sembrare un picco più alto, e spariscono fuori dallo zoom
(Vedi le immagini di Federico: l'etichetta «sdfa» è collegata al picco con una linea dello stesso colore della traccia, quindi il picco sembra più alto; con lo zoom su una zona senza il picco annotato l'etichetta resta visibile sul bordo e sembra puntare fuori.)
- Linea di collegamento **grigia, sottile e tratteggiata**, che parte **poco sopra** la punta del picco (spazio di 3-4 px) e arriva all'etichetta.
- Etichetta: testo nero/grigio scuro (`--ink`), bordo grigio sottile, sfondo del pannello: mai nel colore della traccia.
- Se il punto annotato è **fuori dall'intervallo visibile** (zoom x), l'etichetta e la linea **non si disegnano**; ricompaiono quando il punto torna in vista. Vale per spettri e cromatogrammi, e per il PNG.
- e2e: annotazione presente in vista, assente dopo uno zoom che la esclude, colore della linea diverso da quello della traccia.

### R5. Clic destro con zoom attivo: «Ripristina zoom» in cima
In **tutti** i grafici (spettro compreso), se c'è uno zoom (x o y), la prima voce del menu del clic destro è «Ripristina zoom» (oggi nel cromatogramma è in fondo e grigia, nello spettro manca). Senza zoom la voce non c'è.

### R6. Etichette dei pulsanti: un quarto di secondo prima (deciso da Federico)
Le etichette al passaggio del mouse devono comparire **250 ms prima di adesso**: trova il ritardo attuale del tooltip (Blocco B, cerca la costante del ritardo in `explore.js`/`index.html`/`help.js`) e riducilo di 250 ms (es. da 1.5 s a 1.25 s), usando una **costante unica** (`TIP_DELAY`) valida ovunque. Le etichette spariscono appena il mouse esce o si clicca. Usa il tooltip disegnato dal programma, non il `title` nativo del browser (non se ne controlla il ritardo): sposta i testi da `title` a `data-tip` dove serve, lasciando `aria-label` per l'accessibilità. Scrivi nel messaggio il valore vecchio e quello nuovo.

### R7. Zoom trascinando sui numeri degli assi: linea più gentile e più chiara
La linea che compare trascinando a sinistra dell'asse y o sotto l'asse x è troppo spessa e aggressiva. Nuovo aspetto:
- linea **sottile (1 px)** nel colore d'accento, con **due piccole tacche** alle estremità e una **fascia semitrasparente** (accento al ~15%) lungo l'asse sull'intervallo scelto;
- durante il trascinamento, accanto alla fascia, i valori in piccolo («m/z 350.0–362.0» o «RT 13.80–14.60 min», o le intensità per y);
- passando con il mouse sulla zona dei numeri, una **leggera evidenziazione** della striscia dell'asse e il cursore `ew-resize`/`ns-resize`, così si capisce che lì si può trascinare (etichetta: «Trascina qui per ingrandire solo quest'asse»).
- Screenshot prima/dopo nel messaggio.

### R8. Finestra XIC: più ioni in una volta
La finestra «Estrai uno ione (XIC)» (`openXic`, `#xicdlg` in `explore.js`/`index.html`, già rifatta dalla chat del 6/10: un valore oppure formula + addotto) diventa una **lista di righe**:
- **2 righe di default** («Ione 1», «Ione 2 (facoltativo)»); un pulsante **«+»** aggiunge righe fino a **10**; ogni riga ha una × per toglierla. Se la riga 2 resta vuota si estrae solo lo ione 1.
- Ogni riga accetta **o un m/z o una formula neutra**: se il testo è un numero è un m/z, altrimenti è una formula e accanto compare il menu dell'addotto (stessa lettura in minuscolo del Blocco C). Sotto ogni riga, piccola, la finestra che verrà estratta («m/z 363.8–364.8»), con la regola unitaria in uso.
- Tutti gli ioni finiscono **nello stesso pannello XIC** (una traccia per ione, come oggi «Aggiungi un altro ione»), con legenda per ione. Con più ioni **e** più file la legenda resta leggibile: colore per ione, tratteggio per file (o viceversa: scegli e motiva); con più di 3 ioni il pannello parte in «Solo il selezionato» per non avere decine di linee.
- Invio nell'ultima riga = «Estrai». e2e: due ioni → un pannello con due tracce; riga 2 vuota → una traccia; limite 10; formula in una riga e m/z nell'altra.

### R9. Finestra XIC: scegliere da quale file
Nella stessa finestra un menu **«File»**: «i file mostrati» (predefinito: segue la modalità della barra, «Solo il selezionato» / «Tutti sovrapposti») oppure un file preciso della scheda. È solo il valore iniziale del pannello: dopo si cambia dal selettore «File n/N» dell'intestazione del pannello XIC, come oggi. Il clic destro sullo spettro (R2, XIC diretto senza finestra) usa il file dello spettro da cui parte. e2e: scelta di un file → il pannello mostra solo quello.

---

## BLOCCO N: perdite neutre (scheda «Perdite neutre» della finestra Tavola/Addotti/Isotopi, `web/tables.js`)

**Materiale di partenza**: una ricerca di Federico (testo in `_cestino` o nella chat; il contenuto utile è riassunto qui). **Attenzione**: la ricerca contiene fonti secondarie deboli e alcune affermazioni non verificate (es. «probabilità > 95%» per la perdita di 32 Da, «circa il 7%» di perdite radicaliche in ESI, «H₂S = idrossido solforato» che è sbagliato: è acido solfidrico/solfuro di idrogeno). **Usa come riferimenti le fonti primarie** e verifica su di esse ogni riga (masse esatte: calcolale con `qqq_lab/chem/elements.py`, non copiarle):
- K. Levsen et al., «Even-electron ions: a systematic study of the neutral species lost in the dissociation of quasi-molecular ions», *J. Mass Spectrom.* 42 (2007) 1024-1044 (PubMed 17605143).
- M. Holčapek, R. Jirásko, M. Lísa, «Basic rules for the interpretation of atmospheric pressure ionization mass spectra of small molecules», *J. Chromatogr. A* 1217 (2010) 3908-3921 (PubMed 20303090).
- L. Demarque et al., «Fragmentation reactions using electrospray ionization mass spectrometry: an important tool for the structural elucidation and characterization of synthetic and natural products», *Nat. Prod. Rep.* 33 (2016) 432-455.
- T. De Vijlder et al., «A tutorial in small molecule identification via electrospray ionization-mass spectrometry: the practical art of structural elucidation», *Mass Spectrom. Rev.* 37 (2018) 607-629 (PubMed 29120505).
Se non riesci a verificare un dato (rete), tienilo fuori o segnalo «da verificare» nel messaggio: niente percentuali non verificate nell'interfaccia.

### N1. Vista semplice di default
Una riga per perdita (circa 20, ordinate per Δm): **Δm** (intero, grande), **formula**, **nome**, **«si vede in…»** (una riga: es. «alcoli, fenoli, acidi carbossilici»), **polarità tipica** (icone «+», «−» o entrambe). Elenco di partenza da verificare: •CH₃ 15, NH₃ 17, H₂O 18, HF 20, HCN 27, CO 28, C₂H₄ 28, CH₂O 30, CH₃OH 32, H₂S 34, HCl 36, CH₂CO (chetene) 42, C₃H₆ 42, CO₂ 44, HCOOH 46, •NO₂ 46, SO₂ 64, C₆H₆ 78, HBr 80, SO₃ 80 (più eventuali altre ben documentate nelle fonti e utili per inquinanti/pesticidi; niente perdite tipiche solo di peptidi/lipidi).

### N2. «Dettagli» per chi vuole di più
Un pulsante «Dettagli» (o clic sulla riga) espande: **massa esatta** (4 decimali, calcolata), **meccanismo** in 1-2 righe, **riferimento** (autore anno). Chiuso di default.

### N3. Perdite con la stessa massa nominale raggruppate
Le righe con lo stesso Δm (28: CO / C₂H₄; 42: chetene / propene; 46: HCOOH / •NO₂; 80: HBr / SO₃) stanno in un blocco con un bordo e una nota di una riga: «a risoluzione unitaria non si distinguono: servono altri indizi». Per 80 aggiungi «guarda M+2 nella scheda Isotopi (Br: M e M+2 quasi uguali)» con link che apre la scheda Isotopi.

### N4. Perdite radicaliche
•CH₃ e •NO₂ con il segno «•» e un'etichetta breve: «perdita di un radicale: rara in ESI (eccezione alla regola degli elettroni pari), indica di solito anelli aromatici o gruppi nitro».

### N5. «Cerca Δm» e combinazioni
In cima alla scheda un campo «Cerca Δm»: scrivendo un numero (es. 62) evidenzia le righe con quel Δm (tolleranza ±0.5) e mostra sotto le **coppie di perdite** che sommano quel valore (es. 62 = H₂O + CO₂) e le **ripetizioni** (es. 72 = 2 × HCl). Titolo del riquadro: «Possibili perdite (da verificare sullo spettro)». È un elenco di candidati da consultare, non un'attribuzione.

### N6. Filtro di polarità
Tre pulsanti «+ / − / tutte»; all'apertura si imposta da solo sulla polarità dei file caricati (vedi segni +/− del Blocco S9), lo studente può cambiarlo.

### N7. Dal righello alla tabella
Nel menu del clic destro di una misura del righello (Blocco G1) una voce «Cerca 170.0 nelle perdite neutre»: apre la scheda con il campo N5 già compilato. Il righello da solo continua a mostrare solo il numero (nessun nome proposto).

### N8. Teoria (cap. 8, frammentazione)
Una sezione breve (mezza pagina) con: regola degli elettroni pari ed eccezioni radicaliche; perdite isobare a risoluzione unitaria e come distinguerle (isotopi, altre perdite); perdite in cascata (es. −18 poi −44 = −62); cenno alla **Neutral Loss Scan** del triplo quadrupolo (Q1 e Q3 scansionano con un Δm fisso: collegala al cap. 9 sui modi di scansione). Esempi **solo** su composti che NON sono quelli dei metodi del laboratorio (regola di `AGENTS.md`). Bibliografia con le 4 fonti primarie sopra. Nessun disclaimer ripetuto.

### N9. Test
pytest: masse esatte della tabella uguali a quelle calcolate da `elements.py`; combinazioni di N5 (62 → H₂O + CO₂; 72 → 2 × HCl). e2e: vista semplice, «Dettagli», gruppo isobaro 28, ricerca 62, filtro di polarità, voce «Cerca … nelle perdite neutre» dal righello.

---

## Chiusura
- `python3 tools/verifica.py` completo (senza i test Pyodide, che salta da solo); messaggio finale a Federico: una riga per punto (fatto / non fatto e perché), cosa provare a mano con Cmd+Shift+R, eventuali dati della ricerca rimasti «da verificare».
- Aggiorna `AGENTS.md` (perdite neutre, lucchetto, tooltip, annotazioni, zoom sugli assi) e cancella da questo file ciò che è fatto.
