# PROMPT PROSSIMA CHAT: Impostazioni, Disegno e Dati (QqQ lab)

Lavori nella cartella `~/QqQ_lab/QqQ_lab`. Leggi prima `AGENTS.md`. Una sola chat alla volta sulla cartella. Prima di modificare `index.html`, `AGENTS.md`, `explore.js` o `draw.js`, ri-leggi la versione sul Mac, perché un'altra chat può averli cambiati. Non sovrascrivere con copie vecchie.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese.
- "m/z" sempre in forma inglese.
- Nei testi pubblicati niente apici o pedici unicode e niente trattini lunghi.
- Non cancellare file: spostali in `_cestino`.
- Il programma non deve dare agli studenti le risposte.
- Un commit solo, con titolo in italiano e le righe di attribuzione richieste. Il push lo fa Federico.
- Testa con Playwright (e2e e pytest, lanciati separatamente con timeout lunghi), poi fai un report breve.

---

## SEZIONE 1: Impostazioni (semplificazione)

Nelle impostazioni devono restare **solo due controlli**: la dimensione del testo e il tema.

1. **Togli** il tutorial.
2. **Togli** «Installare QqQ come app».
3. **Togli** la scritta «Vale per menu, elenco file e barre; il testo dentro i grafici si ingrandisce con lo zoom del browser (Ctrl o Cmd e +).».
4. **Rinomina** «Dimensione del testo dell'interfaccia» in **«Dimensione testo»**.
5. **Togli** le spunte «Numera i pannelli» e «Mostra suggerimenti». Rimuovi anche la logica collegata, non solo i checkbox: chiavi salvate, valori predefiniti e punti del codice che le leggono. Decidi quale comportamento resta fisso e dillo nel report.
6. **Nuova sessione:**
   - deve cancellare la cache del browser usata dall'app (localStorage, IndexedDB, cache dei file, quaderno e impostazioni);
   - deve mostrare **prima** un avviso di conferma: «il lavoro salvato sarà perso (i file sul tuo computer non vengono toccati)»;
   - se l'utente annulla, non deve cancellare nulla.
7. Aggiorna le pagine della Teoria e i testi dell'aiuto che citano le opzioni tolte, e i test e2e che le usano.
8. `README.md` riga 54 («didascalia per la relazione», testo vecchio): aggiornala o segnalala.

## SEZIONE 2: scheda Disegno (bug da verificare e correggere)

Federico dice che queste cose **non funzionano per lui**, anche se i test e2e passano. Prima di tutto cerca la causa: cache del browser (prova Cmd+Shift+R), versione vecchia in esecuzione, errore di console solo nel suo browser, problema che i test non coprono. Riproduci con Playwright in un contesto più vicino al suo e guarda la console.

1. **Selezione → SMILES a destra.** Se seleziono una molecola (o un pezzo), a destra deve comparire subito lo SMILES della selezione, con Copia. Verifica con tutti i metodi di selezione (rettangolo, lazo, Maiusc+clic, clic su un atomo, seleziona tutto) e che si aggiorni al cambio di selezione.
2. **Calcolo del logP mancante.** Federico non vede il logP della molecola selezionata. Il box «Proprietà previste» (logP, Δ logP rispetto al riferimento, logS, TPSA, D/A) deve apparire con i valori, sia con la selezione sia senza (tutte le strutture). Controlla se OpenChemLib (`vendor/openchemlib.js`) si carica davvero nel suo ambiente (percorso, offline, wasm o worker, console). Se il calcolo fallisce, mostra un messaggio chiaro invece del box vuoto o assente.
3. **Esportazione della tela non possibile.** Federico non riesce a esportare e non sa perché. Riproduci PNG, JPEG, SVG e «Salva .ket». Controlla console, download bloccati, blob, iframe, dimensioni. Aggiungi un messaggio d'errore visibile se l'export fallisce.
4. **Sfondo trasparente.**
   - Rinomina «Senza sfondo (trasparente)» in **«Sfondo trasparente»**.
   - Quando è spuntato, il bottone **JPEG** deve essere non cliccabile e **visibilmente spento** (disabled, grigio, tooltip che spiega il motivo).
   - PNG e SVG devono scaricarsi **davvero senza sfondo**: verifica il canale alfa del PNG (pixel d'angolo con alfa 0) e l'assenza del rettangolo di sfondo nell'SVG. Tolta la spunta, JPEG torna attivo e lo sfondo è bianco.
5. Estendi `e2e6` (e simili) per coprire ciò che non avevano visto: la causa trovata, SMILES su ogni tipo di selezione, presenza e valori del logP, i quattro export e lo stato di JPEG.

## SEZIONE 3: scheda Dati (pannelli e grafici)

1. **Schermo intero su ogni pannello.** Ogni pannello (cromatogramma, mappa, spettro, PDA, ecc.) deve avere il suo bottone per andare a schermo intero. Oggi **dal secondo pannello in poi non funziona**: trova la causa (probabilmente id duplicati, un riferimento al primo pannello o un handler legato solo al primo) e correggila per tutti i pannelli, compresi quelli aggiunti dopo (XIC, ecc.). Deve esserci anche un modo chiaro per uscire (bottone e Esc), e il grafico deve ridisegnarsi alla nuova dimensione, sia in ingresso sia in uscita.
2. **Limiti di RT nel cromatogramma.** Oggi si possono selezionare per errore valori **negativi** di RT e valori **oltre il tempo massimo** di ritenzione. La selezione (integrazione, finestre, zoom, scelta dei punti) va limitata all'intervallo reale dei dati, [RT minimo, RT massimo] del file. Controlla anche gli input numerici (da/a) e i trascinamenti, e verifica il comportamento con più file di lunghezze diverse.
3. **PDA: estratto di lunghezze d'onda (XIC del PDA).** La vista PDA deve permettere di scegliere un estratto di lunghezze d'onda, cioè l'equivalente di uno XIC sul PDA: un intervallo di lunghezza d'onda (da/a, oppure una singola λ con una semiampiezza) da cui ricavare il cromatogramma ad assorbimento. Verifica la fattibilità sui dati (struttura del PDA negli mzML o negli altri file del laboratorio), integra la scelta nel flusso dei pannelli come per lo XIC, rispetta i limiti di λ dei dati, e spiega il risultato nel testo di Teoria dedicato. Se qualcosa non è fattibile, dillo chiaramente nel report.
4. **Mini-legenda sui bottoni dei grafici.** Sopra i bottoni dei pannelli (smoothing, scala log e tutti gli altri), se il puntatore resta fermo sul bottone per un paio di secondi deve comparire una **piccolissima legenda** (tooltip) che dice cosa fa. Ritardo circa 1,5-2 s, testo breve, stile discreto coerente col tema, che scompare all'uscita del puntatore. Applicala a tutti i bottoni della barra dei pannelli, non solo ai due citati. Può essere l'attributo `title` se il ritardo nativo è accettabile, altrimenti un tooltip proprio. Verifica che la scelta «Mostra suggerimenti», tolta nella Sezione 1, non interferisca.
5. Aggiungi test e2e per: schermo intero su almeno tre pannelli, RT fuori intervallo (negativo e sopra il massimo), estratto PDA, comparsa del tooltip dopo il ritardo.

## SEZIONE 4: chiusura
- `node --check` su `draw.js`, `explore.js` e lo script inline di `index.html` prima dei test.
- Esegui e2e e pytest, ciascuno separatamente.
- Aggiorna `AGENTS.md` (impostazioni ridotte, nuova sessione con pulizia cache e avviso, causa del problema del Disegno, schermo intero, limiti RT, estratto PDA, tooltip) e `PROMPT_PROSSIMA_CHAT.md`.
- Prima di copiare i file sul Mac, confronta gli md5 dei file condivisi (`index.html`, `AGENTS.md`, `explore.js`).
- Un commit solo e un report breve, con cosa Federico deve controllare a mano (Cmd+Shift+R): impostazioni, nuova sessione con avviso, SMILES alla selezione, logP, export con e senza sfondo trasparente, schermo intero su ogni pannello, limiti RT, estratto PDA, tooltip.
