# PROSSIMA CHAT 4 (QqQ lab): barra dei file, perdite neutre, header, spettri

> **Quando usarlo**: DOPO che il lavoro di `PROMPT_PROSSIMA_CHAT_3.md` è stato unito in `main`. Alcuni punti toccano cose cambiate da quella chat: parti dal codice attuale e adatta, non rifare.
> **Come si usa questo file**: contiene SOLO il lavoro da fare. Quando un punto è fatto e verificato, **cancellalo da qui**; ciò che resta utile va in `AGENTS.md`. Se alla fine il file è vuoto, spostalo in `_cestino/<data>_prompt_completati/` (il cestino è locale, non in git, se il prompt 3 l'ha già tolto da git).

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con il repository `QqQ-lab-dati` per i dati veri). Leggi `AGENTS.md` sez. 1-2, 5 e le ultime sezioni; poi SOLO il codice che serve, con `grep -n`. Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti.
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole. Icone con etichetta breve al passaggio del mouse.
- **Risparmio token**: un blocco alla volta; file letti una volta; prove mirate; screenshot in `tests_e2e/shots/`, guardane al massimo uno per punto.
- **Verifica**: `python3 tools/verifica.py --solo <e2e che tocchi>` durante il lavoro, completa alla fine. **Non lanciare** nulla che usi Pyodide (e2e13, e2e_tpmine*, `tools/build_site.py`).
- Un commit per blocco (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema). Sul Mac: su `main`. **Nel cloud** (decisione di Federico, 7/10): lavora sul ramo della sessione, push dopo ogni blocco; **alla fine, se la verifica completa è verde, unisci tu la pull request in `main`** senza aspettare Federico (`gh pr create` se non c'è ancora, poi `gh pr merge <numero> --merge --delete-branch`), e cancella anche gli altri rami `claude/...` già uniti in `main` (`git branch -r --merged origin/main`). Se qualcosa è rosso, se c'è un conflitto o una decisione da prendere, **non unire**: lascia la PR aperta e spiega a Federico perché. Se `gh` non ha il permesso di unire, scrivilo e lascia la PR aperta. Riporta questa regola in `AGENTS.md` sez. 2 (al posto di «il push lo fa Federico» per le sessioni cloud).
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano. Se il budget sta finendo: fermati dopo un commit pulito e aggiorna questo file.

## Ordine di lavoro
1. **Barra dei file** (`index.html` `#tools`, `explore.js`)
2. **Perdite neutre** (`web/tables.js`)
3. **Header sempre visibile, niente scorrimento su «Dati»** (`index.html`, `tabs.js`)
4. **Spettri e pannelli** (`explore.js`, `spettro.js`)

---

## BLOCCO 1: barra sopra i pannelli (`#tools`)

**1.1 Il nome del file selezionato si deve leggere.** Nella barra (`#g-file`: ◀ `#fsel` ▶, poi «Solo il selezionato / Tutti sovrapposti») il menu `#fsel` è troppo stretto: si vede solo «Flufenacet_Fu…». Deve mostrare il **nome intero** del file visualizzato: larghezza automatica sul nome più lungo dei file della scheda, minimo ~220 px, massimo ~40% della barra; se il nome è ancora più lungo si accorcia **al centro** («B_FullMa…t30 (2)», così il tempo finale resta visibile) con il nome intero nell'etichetta al passaggio del mouse. A schermo stretto la barra va a capo invece di schiacciare il menu. e2e: a 1280 px il testo visibile di `#fsel` contiene il nome intero di «B_FullMass-t30 (2)».

**1.2 Via «Altro ▾» e «Unisci gli XIC».** Il menu «Altro» (`#np-more`, che raccoglie `#np-tile` «Ordina» e `#np-merge` «Unisci gli XIC» quando la barra è stretta: `explore.js` ~r.381-400) non serve:
- **togli «Unisci gli XIC»** (pulsante, codice e test: con la finestra XIC a più ioni e «Sovrapponi all'XIC…» non serve più);
- **togli «Ordina»** se i pannelli sono già sempre impilati a tutta larghezza (controlla `defaultLayout`/`relayout`/`fitHost`: se «Ordina» non cambia più niente, toglilo; se serve ancora, diventa un'icona piccola con etichetta, non una voce di menu);
- **togli il menu «Altro»** e la logica che sposta i pulsanti dentro (`np-more`).
Aggiorna `AGENTS.md` sez. 3 e gli e2e che usano `#np-merge`, `#np-tile`, `#np-more`.

**1.3 Icona diversa per «Nascondi l'elenco dei file».** Il pulsante `#ffold` (◀ nella testata della lista dei file, `index.html` ~r.117) è identico alle frecce ◀ ▶ che passano da un file all'altro (`#g-file`): si confondono. Usa un'**icona da pannello laterale** (rettangolo con la colonna di sinistra e una freccetta «chiudi», SVG piccolo nello stile delle altre icone; quando la lista è nascosta, l'icona per riaprirla è la stessa con la freccetta verso destra). Etichetta: «Nascondi l'elenco dei file» / «Mostra l'elenco dei file». Nessuna freccia ◀ ▶ da sola fuori da `#g-file`.

---

## BLOCCO 2: scheda «Perdite neutre» (`web/tables.js`)

**2.1 Breve spiegazione in cima.** Sopra la tabella un testo breve, **esattamente questo** (scritto da Claude con Federico, non riscriverlo; apici e pedici con `<sup>`/`<sub>`):
> «Nella cella di collisione (q2) lo ione selezionato urta le molecole del gas: parte della sua energia di movimento diventa energia interna (vibrazioni). Lo ione la scarica **rompendo un legame**, spesso dopo un **riarrangiamento** in cui un atomo di idrogeno si sposta: si stacca una piccola molecola stabile e **neutra** (H<sub>2</sub>O, CO, NH<sub>3</sub>, CO<sub>2</sub>…), che il rivelatore non vede, mentre la carica resta sul frammento. Per questo nello spettro MS<sup>2</sup> si legge la perdita come differenza: **Δm = m/z del precursore − m/z del frammento**.»
Sotto, una riga **«▸ Più dettagli»** che si espande (chiusa di default) con:
> «Gli ioni dell'electrospray hanno quasi sempre un numero pari di elettroni ([M+H]<sup>+</sup>, [M−H]<sup>−</sup>) e tendono a perdere molecole intere a guscio chiuso, non radicali (regola degli elettroni pari): le perdite di radicali come •CH<sub>3</sub>, •NO<sub>2</sub> o •Cl sono eccezioni, possibili quando il frammento è stabilizzato da un anello aromatico (gruppi metossilici, nitro o atomi di cloro legati all'anello). Le perdite più comuni passano per stati di transizione ciclici a quattro o sei atomi, che costano poca energia; aumentando l'energia di collisione (CE) compaiono rotture più difficili e **perdite in cascata** (per esempio −18 e poi −44, cioè −62 in totale). A risoluzione unitaria alcune perdite hanno la stessa massa nominale (28 = CO oppure C<sub>2</sub>H<sub>4</sub>): servono altri indizi, come il profilo isotopico o le altre perdite dello stesso ione.»
Nessun altro testo introduttivo; il paragrafo su perdite isobare/cascate già in Teoria cap. 8 resta lì.

**2.2 «ESI+» e «ESI−» invece di «+» e «−».** Nella colonna della polarità tipica e nei pulsanti del filtro scrivi **«ESI+»**, **«ESI−»**, **«entrambe»** (filtro: «ESI+ / ESI− / tutte»), non i segni da soli. Stesso stile dei badge di polarità della lista dei file (prompt 3, punto 7.1), se già esistono.

**2.3 «Cerca Δm» resta** (Federico ha cambiato idea, 7/10): non toccare il campo «Cerca Δm», il riquadro delle possibili perdite e la voce del righello «Cerca … nelle perdite neutre». Se una chat precedente li ha già tolti, rimettili com'erano.

**2.4 Aggiungi la perdita del radicale •Cl.** Nuova riga nella tabella (con il pallino dei radicali, come •CH<sub>3</sub> e •NO<sub>2</sub>): **•Cl**, Δm **35** (e **37** per il precursore che contiene <sup>37</sup>Cl: scrivilo nei «Dettagli»), «si vede in»: «composti con cloro legato a un anello aromatico (es. pesticidi clorurati)», polarità tipica come da fonti (verifica; se incerta, «entrambe»). Nei «Dettagli» una riga che la distingue da **HCl (36)**, già in tabella: «•Cl (35): perdita del solo atomo, rara (radicale); HCl (36): perdita della molecola, più comune». Massa esatta calcolata da `elements.py`. Solo il cloro: niente •Br o •I (decisione di Federico).

e2e del blocco: riga •Cl presente con il pallino; testo introduttivo presente, «Più dettagli» chiuso e apribile, «ESI+»/«ESI−» nella tabella e nel filtro; «Cerca Δm» ancora funzionante (`62 → H2O + CO2`).

---

## BLOCCO 3: header sempre visibile, niente scorrimento cliccando «Dati»

**3.1 Header fisso in alto.** L'header (logo, Dati / Disegno / Teoria, ingranaggio, pulsanti a destra) deve restare **sempre visibile** mentre si scorre la pagina: `position: sticky; top: 0`, sfondo pieno (stesso colore di oggi), una leggera ombra solo quando la pagina è scorsa, `z-index` sopra pannelli e lista dei file ma **sotto** menu, tendine, finestre e tooltip (che stanno sopra 10000: controlla che non finiscano dietro l'header). Correggi gli elementi che calcolano posizioni rispetto alla cima della pagina e ora devono tenere conto dell'altezza dell'header: la lista dei file a sinistra (`#dfiles{position:sticky;top:8px}` → sotto l'header), gli scorrimenti verso un pannello (`window.scrollTo(... - 70)` in `explore.js` ~r.514 e `tabs.js` ~r.175, `scrollIntoView` ~r.555: usa `scroll-margin-top` o l'altezza reale dell'header), i menu del clic destro vicino al bordo alto. A schermo intero (pannello ⤢) l'header non deve coprire il pannello.

**3.2 Cliccando «Dati» la pagina non deve scorrere.** Oggi tornando a «Dati» da Disegno o Teoria la pagina salta al punto dove si lavorava (spesso il primo cromatogramma) e l'header sparisce: lo fa `setView` in `index.html` (~r.232-233: `S.dataWork`/`S.dataScroll` e `scrollTo(0, S.dataScroll)`), introdotto per «tornare a Dati dove si era». Decisione di Federico: **nessuno scorrimento automatico** cambiando vista. Togli il ripristino dello scorrimento in `setView` (i pannelli, lo zoom, il cursore e il pannello attivo restano: sono stato del programma, non scorrimento). Fai lo stesso per il cambio di scheda Full Scan / MS² / MRM (`tabs.js` ~r.43-58: `E.workY`, `E.scrollBy`, `scrollTo(0, E.scrollBy[t])`) se produce lo stesso salto. Lo scorrimento automatico resta solo quando lo studente crea un pannello nuovo (per mostrarglielo) o usa un comando che porta a un pannello.
e2e: da Disegno clic su «Dati» → `scrollY` invariato (0 se la pagina era in cima) e header visibile; pagina scorsa in basso → header ancora visibile (`getBoundingClientRect().top == 0`); un menu del clic destro aperto vicino al bordo alto sta sopra l'header.

---

## BLOCCO 4: spettri e pannelli

**4.1 L'XIC estratto da un cromatogramma va subito sotto quel cromatogramma.** Con il pulsante «XIC» del cromatogramma (`explore.js` ~r.590) o il clic destro «Estrai uno ione (XIC)…» (~r.2010) il pannello nuovo deve nascere **subito sotto il cromatogramma da cui viene**; i pannelli che stavano sotto scorrono più in basso. Oggi finisce altrove. Usa lo stesso meccanismo dell'XIC estratto da uno spettro (`stackAfter(nuovo, origine)` + `relayout` + `fitHost`), poi porta il pannello nuovo in vista (scorrimento solo se è fuori schermo, tenendo conto dell'header fisso del blocco 3). Con più m/z nella finestra XIC: i pannelli nuovi tutti sotto il cromatogramma, nell'ordine scelto. e2e: TIC + 2 pannelli sotto → XIC dal TIC → il nuovo pannello è il secondo dall'alto.

**4.2 Via la «Tabella dei picchi» dagli spettri.** Togli il pulsante `data-a="ptab"` dall'intestazione dello spettro (`explore.js` ~r.587, ~r.636), la funzione `peakTable` se non la usa nessun altro, la sua voce nei menu, i test e le righe in `AGENTS.md`. Restano righello e parametri. (La tabella dei picchi del **cromatogramma**, se esiste, resta.)

**4.3 Didascalia in basso a destra dello spettro: solo l'essenziale.** In `spettro.js` `scanLine` (~r.160-172) togli **TIC / TIC medio**, **«picco base m/z … (…)»** e **RT** (il tempo è già scritto grande accanto al titolo, `.rtl`). Resta: «scansione i/n» o «media di N scansioni» e, per le MS2, «precursore … · CE … eV». Se rimane vuota, nessuna riga. Aggiorna i test che cercano «TIC» o «picco base» nella didascalia.

**4.4 Il tempo grande accanto al titolo non deve far ballare i pulsanti.** Muovendo il cursore sul cromatogramma il testo «RT 8.04 min» (`.rtl`, `index.html` ~r.63, `explore.js` ~r.754) cambia larghezza e sposta i pulsanti dell'intestazione. Dagli una **larghezza fissa**: `display:inline-block; font-variant-numeric: tabular-nums; min-width` pari a «RT 88.88 min» (misurala, non indovinarla) e testo allineato a sinistra; per un intervallo («RT 8.04-8.21 min») va bene che sia più largo. e2e: larghezza di `.rtl` e posizione del primo pulsante identiche con RT 1.05 e RT 14.30.

---

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Messaggio finale a Federico: una riga per punto, cosa provare a mano con Cmd+Shift+R. Aggiorna `AGENTS.md` e cancella da questo file ciò che è fatto.

---

## Lavori in coda (NON fare: idee da valutare con Federico)

**Q1. Modalità «alta risoluzione» (Orbitrap, Q-TOF).** Piano completo, con le prove sui file di Federico, in `PIANO_ALTA_RISOLUZIONE.md`: non eseguirlo da qui.
