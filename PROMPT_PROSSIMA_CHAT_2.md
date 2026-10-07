# PROSSIMA CHAT 2 (QqQ lab): spettro e menu, intestazioni compatte, finestra XIC, perdite neutre

> **Come si usa questo file**: contiene SOLO il lavoro da fare. Quando un punto è fatto e verificato, **cancellalo da qui** (niente «fatto», niente cronaca); ciò che resta utile (nomi di funzioni, decisioni) va in `AGENTS.md`. Se alla fine il file è vuoto, spostalo in `_cestino/<data>_prompt_completati/`.
> Il lavoro dei prompt precedenti (blocchi A, S, G, B, C, F, H, I, D, E) è già in `main` (pull request #2 e #3). Alcuni punti qui sotto ritoccano cose fatte lì: parti dal codice attuale e adatta, non rifare.

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con il repository `QqQ-lab-dati` per i dati veri). Leggi `AGENTS.md` sez. 1-2, 5 e le ultime sezioni (16-17 e seguenti); poi SOLO il codice che serve, con `grep -n` (i nomi di funzione qui sotto sono indicativi: cercali). Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti.
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole (tendine, «Dettagli»). Icone con etichetta breve (1-2 righe) al passaggio del mouse.
- **Risparmio token**: un blocco alla volta; file toccati letti una volta sola; prove mirate; screenshot salvati in `tests_e2e/shots/` e **guardane al massimo uno per punto** (gli altri sono per Federico).
- **Verifica**: `python3 tools/verifica.py --solo <e2e che tocchi>` durante il lavoro, completa alla fine. **Non lanciare** e2e13, e2e_tpmine1, e2e_tpmine2, `tools/build_site.py` né nulla che scarichi Pyodide (decisione di Federico).
- Un commit per blocco (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema); sul Mac su `main`, nel cloud sul ramo della sessione e **una sola pull request alla fine** (Federico la unisce solo quando hai finito).
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano.
- Se il budget sta finendo: fermati dopo un commit pulito e aggiorna questo file.

## Ordine di lavoro (i blocchi sono raggruppati per file, così leggi ogni file una volta)
2. **Intestazioni, zoom sugli assi, etichette** (`explore.js` `addPanel`/`ctl`/assi + CSS in `index.html`)
3. **Finestra XIC e calcolatrice** (`openXic`, `#xicdlg`, `#calcdlg`)
4. **Perdite neutre** (`web/tables.js`, Teoria cap. 8)

---

## BLOCCO 2: intestazioni, zoom sugli assi, etichette

**2.1 Intestazione dei pannelli in UNA riga.** Oggi cromatogramma/XIC/MRM usano tre fasce oltre al grafico: titolo (con molto spazio vuoto in mezzo), riga dei controlli (TIC/BPC, «m/z da … a …», smoothing, sovrapposti, scala log, Correzione) e, sotto il grafico, legenda + «RT …». Obiettivo: **una riga sopra il grafico**, senza schiacciarlo e senza perdere funzioni.
- Il menu del tipo diventa il titolo («TIC ▾» al posto di «Cromatogramma»), seguito da due controlli compatti usati spesso: sovrapposti/impilati (icona) e smoothing (icona on/off).
- Un'icona **«Parametri»** (stesso aspetto della tendina dei parametri dello spettro) con i controlli usati meno spesso: intervallo m/z, scala log, Correzione. Se un parametro non è al valore predefinito, accanto all'icona un piccolo **chip** lo dice («m/z 150–300», «log», «bianco: t0»); clic sul chip = apre la tendina.
- **Legenda dentro il grafico**, in alto a destra, riquadro semitrasparente compatto (se copre i dati, in alto a sinistra; con molti file più colonne o «7 file» con elenco al passaggio del mouse). Clic su una voce = nascondi/mostra come oggi.
- **Togli la riga sotto il cromatogramma** («RT 1.13 min», «scansione …»): l'informazione è nel riquadro che segue il mouse (per lo spettro la riga della scansione resta, è utile).
- Sotto 900 px la riga può andare a capo, pulsanti allineati a destra. Controlla anche spettro e mappa (non sprecare spazio). Aggiorna gli e2e che cercano i controlli nella seconda riga (`.ctl`). Screenshot prima/dopo a 1280, 1440, 1680 px per Federico.

**2.2 Zoom trascinando sui numeri degli assi: linea più gentile.** Oggi la linea è spessa e aggressiva. Nuovo aspetto: linea **1 px** nel colore d'accento con **due piccole tacche** alle estremità e **fascia semitrasparente** (accento ~15%) lungo l'asse sull'intervallo scelto; durante il trascinamento i valori in piccolo accanto («m/z 350.0–362.0», «RT 13.80–14.60 min»); passando sopra la zona dei numeri, leggera evidenziazione della striscia e cursore `ew-resize`/`ns-resize` (etichetta: «Trascina qui per ingrandire solo quest'asse»).

**2.3 Etichette dei pulsanti 250 ms prima (deciso da Federico).** Trova il ritardo attuale del tooltip (cerca la costante del ritardo), riducilo di 250 ms (es. 1.5 s → 1.25 s) con una **costante unica** `TIP_DELAY` valida ovunque; sparisce appena il mouse esce o si clicca. Usa il tooltip del programma, non il `title` nativo (ritardo non controllabile): testi in `data-tip`, `aria-label` per l'accessibilità. Scrivi nel messaggio valore vecchio e nuovo.

**2.4 Meno spazio sotto l'asse x, grafico più alto.** Sotto l'asse x oggi ci sono due righe: titolo dell'asse («m/z» / «Tempo di ritenzione (min)») e, sotto, la legenda (cromatogrammi) o la riga della scansione (spettri: «scansione 127/1111 · RT 2.66 min · TIC 4.0e7 · picco base m/z 141.2 (3.0e6)»). Con un solo file (o tracce non sovrapposte) la legenda non serve e resta quasi solo spazio bianco.
- **Un solo file / una sola traccia → nessuna legenda** (il nome del file è già nell'intestazione e nel riquadro del mouse); con più file la legenda va dentro il grafico (2.1).
- **Spettri**: la riga della scansione va sulla **stessa riga del titolo dell'asse x**, allineata a destra (piccola, grigia), invece che su una riga a parte.
- Il margine inferiore (`M.b`) si adatta: niente spazio riservato a ciò che non c'è. Lo spazio guadagnato va al grafico (stessa altezza del pannello, area del grafico più alta).
- Controlla con 1 file e con 7 file sovrapposti (cromatogramma, XIC, spettro) che niente si sovrapponga; vale anche nel PNG esportato (lì la riga della scansione può restare sotto, se serve per leggibilità).

**2.5 Via le icone dei tre esperimenti dalle schede e dalla lista dei file (deciso da Federico).** Le piccole icone accanto a «Full Scan», «MS² (Product Ion)», «MRM» (`QICON`/`TABICON` in `tabs.js`, `icons-modi.js`; anche nelle intestazioni dei gruppi della lista file) restano incomprensibili anche dopo l'ingrandimento. **Toglile** da schede e lista: resta il testo con il numero di file. Al loro posto, **nell'etichetta che compare restando sulla scheda** (tooltip del programma, 2.3), mostra lo schema **in grande e con le parole**: tre riquadri «Q1 → q2 → Q3» con sotto cosa fa ciascuno (es. Full Scan: «Q1 scansiona tutti gli m/z · q2 lascia passare · Q3 lascia passare»; MS²: «Q1 fisso sul precursore · q2 frammenta · Q3 scansiona i frammenti»; MRM: «Q1 fisso · q2 frammenta · Q3 fisso su un frammento»), presi dai testi già in `modi.js` (`QMODI`). Le icone restano solo dove sono abbastanza grandi da leggersi (Teoria cap. 9). e2e: nessuna icona nelle schede; il tooltip della scheda contiene «Q1».

**2.6 Lista dei file: tutta la riga si clicca.** In «Solo il selezionato» il clic su un file della lista a volte non lo seleziona. Causa (verificata il 7/10): in `renderFileList` (`explore.js`, `Q("#flst").querySelectorAll(".fl:not(.ghost) .nm")`) il clic è collegato **solo al nome** (`.nm`), non al resto della riga (quadratino del colore, tempo a destra, spazio vuoto). Correggi: **tutta la riga `.fl`** seleziona il file con un clic singolo (cursore `pointer`, leggero sfondo al passaggio del mouse); la **casella di spunta** resta separata (mostra/nascondi, non seleziona); il doppio clic sul nome rinomina come oggi; il clic destro resta il menu del file. Il clic non deve perdersi se la lista si ridisegna (aggiorna solo le classi della riga attiva invece di ricostruire tutta la lista, se serve). e2e: clic sul tempo a destra e sullo spazio vuoto della riga → il file diventa quello selezionato.

---

## BLOCCO 3: finestra «Estrai uno ione (XIC)» (`openXic`, `#xicdlg`)

**3.1 Più ioni in una volta.** La finestra diventa una lista di righe: **2 righe di default** («Ione 1», «Ione 2 (facoltativo)»), **«+»** per aggiungerne fino a **10**, × per toglierle; riga 2 vuota → si estrae solo lo ione 1. Ogni riga accetta **un m/z o una formula neutra** (numero = m/z; altrimenti formula, con accanto il menu dell'addotto e la lettura in minuscolo già esistente). Sotto ogni riga, in piccolo, la finestra che verrà estratta («m/z 363.8–364.8»). Tutti gli ioni nello **stesso pannello** (una traccia per ione, legenda per ione); con più ioni e più file: colore per ione e tratteggio per file (o viceversa: scegli e motiva); con più di 3 ioni il pannello parte in «Solo il selezionato». Invio nell'ultima riga = «Estrai».

**3.2 Scegliere il file.** Nella stessa finestra un menu **«File»**: «i file mostrati» (predefinito, segue «Solo il selezionato»/«Tutti sovrapposti» della barra) oppure un file preciso della scheda. È solo il valore iniziale: dopo si cambia dal selettore «File n/N» del pannello.

**3.3 e2e**: due ioni → un pannello con due tracce; riga 2 vuota → una traccia; limite 10; formula + m/z; scelta di un file → il pannello mostra solo quello; XIC dal clic destro (1.3) senza finestra.

**3.4 Calcolatrice m/z: solo gli addotti della polarità dei file.** Oggi la calcolatrice (tendina dell'header, `#calcdlg`/`#calcin`) elenca sempre addotti positivi e negativi insieme. Deve mostrare **solo quelli della polarità dei file mostrati** nella scheda attiva (segni +/− del Blocco S9, `info().polarity`): file positivi → solo [M+H]+, [M+NH4]+, [M+Na]+, [M+K]+…; negativi → solo [M-H]-, [M+Cl]-, [M+HCOO]-…; nessun file caricato, polarità mista o sconosciuta → entrambi, separati da una riga «ESI+» / «ESI−». Sotto la tabella un collegamento piccolo «mostra anche ESI−» (o ESI+) per chi vuole l'altra polarità. Stessa regola per l'ordine degli addotti nella scheda Addotti (già prevista: prima quelli della polarità dei file). e2e: con i file della serie B (ESI+) la calcolatrice non mostra [M-H]-; con un file negativo sintetico mostra solo i negativi.

---

## BLOCCO 4: perdite neutre (scheda «Perdite neutre» in `web/tables.js`)

**Fonti.** Federico ha fatto fare una ricerca con fonti secondarie deboli e alcuni errori (es. «probabilità > 95%» per la perdita di 32 Da e «circa il 7%» di perdite radicaliche: non verificati; «H₂S = idrossido solforato»: sbagliato, è solfuro di idrogeno). Usa SOLO le fonti primarie e verifica ogni riga; masse esatte calcolate con `qqq_lab/chem/elements.py`, mai copiate:
- K. Levsen et al., *J. Mass Spectrom.* 42 (2007) 1024-1044, «Even-electron ions: a systematic study of the neutral species lost…» (PubMed 17605143);
- M. Holčapek, R. Jirásko, M. Lísa, *J. Chromatogr. A* 1217 (2010) 3908-3921, «Basic rules for the interpretation of atmospheric pressure ionization mass spectra of small molecules» (PubMed 20303090);
- L. Demarque et al., *Nat. Prod. Rep.* 33 (2016) 432-455, «Fragmentation reactions using electrospray ionization mass spectrometry…»;
- T. De Vijlder et al., *Mass Spectrom. Rev.* 37 (2018) 607-629, «A tutorial in small molecule identification via electrospray ionization-mass spectrometry…» (PubMed 29120505).
Un dato non verificabile → fuori, o «da verificare» nel messaggio. Niente percentuali non verificate nell'interfaccia.

**4.1 Vista semplice di default.** Una riga per perdita (circa 20, per Δm crescente): **Δm** intero grande, **formula**, **nome**, **«si vede in…»** (una riga), **polarità tipica** (icone +/−). Elenco da verificare: •CH₃ 15, NH₃ 17, H₂O 18, HF 20, HCN 27, CO 28, C₂H₄ 28, CH₂O 30, CH₃OH 32, H₂S 34, HCl 36, CH₂CO 42, C₃H₆ 42, CO₂ 44, HCOOH 46, •NO₂ 46, SO₂ 64, C₆H₆ 78, HBr 80, SO₃ 80 (più altre ben documentate utili per inquinanti/pesticidi; niente perdite tipiche solo di peptidi o lipidi).

**4.2 «Dettagli».** Pulsante o clic sulla riga: massa esatta (4 decimali, calcolata), meccanismo in 1-2 righe, riferimento (autore anno). Chiuso di default.

**4.3 Stessa massa nominale.** 28 (CO / C₂H₄), 42 (chetene / propene), 46 (HCOOH / •NO₂), 80 (HBr / SO₃) in un blocco con bordo e una riga: «a risoluzione unitaria non si distinguono: servono altri indizi». Per 80: «guarda M+2 nella scheda Isotopi (Br: M e M+2 quasi uguali)», con link alla scheda.

**4.4 Radicali.** •CH₃ e •NO₂ con «•» ed etichetta: «perdita di un radicale: rara in ESI (eccezione alla regola degli elettroni pari), di solito anelli aromatici o gruppi nitro».

**4.5 «Cerca Δm».** Campo in cima: un numero (es. 62) evidenzia le righe con quel Δm (±0.5) e mostra sotto le **coppie** che lo sommano (62 = H₂O + CO₂) e le **ripetizioni** (72 = 2 × HCl), sotto il titolo «Possibili perdite (da verificare sullo spettro)». Elenco di candidati, non attribuzione.

**4.6 Polarità.** Pulsanti «+ / − / tutte», impostati all'apertura sulla polarità dei file caricati.

**4.7 Dal righello.** Nel menu del clic destro di una misura del righello: «Cerca 170.0 nelle perdite neutre» → apre la scheda con 4.5 compilato. Il righello da solo mostra solo il numero.

**4.8 Teoria cap. 8.** Mezza pagina: regola degli elettroni pari ed eccezioni radicaliche; perdite isobare a risoluzione unitaria (come distinguerle: isotopi, altre perdite); perdite in cascata (−18 poi −44 = −62); cenno alla Neutral Loss Scan (Q1 e Q3 con Δm fisso, collegata al cap. 9). Esempi solo su composti NON dei metodi del laboratorio. Bibliografia con le 4 fonti. Nessun disclaimer ripetuto.

**4.9 Test.** pytest: masse esatte = `elements.py`; 62 → H₂O + CO₂; 72 → 2 × HCl. e2e: vista semplice, «Dettagli», gruppo 28, ricerca 62, filtro di polarità, voce dal righello.

---

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Messaggio finale a Federico: una riga per punto (fatto / non fatto e perché), cosa provare a mano con Cmd+Shift+R, dati della ricerca rimasti «da verificare». Aggiorna `AGENTS.md` (picco del clic destro, spettro vivo/congelato, lucchetto, tooltip, annotazioni, intestazioni in una riga, zoom sugli assi, finestra XIC, perdite neutre) e cancella da questo file ciò che è fatto.
