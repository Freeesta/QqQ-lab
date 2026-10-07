# PROSSIMA CHAT 4 (QqQ lab): barra dei file, perdite neutre

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

---

## BLOCCO 1: barra sopra i pannelli (`#tools`)

**1.1 Il nome del file selezionato si deve leggere.** Nella barra (`#g-file`: ◀ `#fsel` ▶, poi «Solo il selezionato / Tutti sovrapposti») il menu `#fsel` è troppo stretto: si vede solo «Flufenacet_Fu…». Deve mostrare il **nome intero** del file visualizzato: larghezza automatica sul nome più lungo dei file della scheda, minimo ~220 px, massimo ~40% della barra; se il nome è ancora più lungo si accorcia **al centro** («B_FullMa…t30 (2)», così il tempo finale resta visibile) con il nome intero nell'etichetta al passaggio del mouse. A schermo stretto la barra va a capo invece di schiacciare il menu. e2e: a 1280 px il testo visibile di `#fsel` contiene il nome intero di «B_FullMass-t30 (2)».

**1.2 Via «Altro ▾» e «Unisci gli XIC».** Il menu «Altro» (`#np-more`, che raccoglie `#np-tile` «Ordina» e `#np-merge` «Unisci gli XIC» quando la barra è stretta: `explore.js` ~r.381-400) non serve:
- **togli «Unisci gli XIC»** (pulsante, codice e test: con la finestra XIC a più ioni e «Sovrapponi all'XIC…» non serve più);
- **togli «Ordina»** se i pannelli sono già sempre impilati a tutta larghezza (controlla `defaultLayout`/`relayout`/`fitHost`: se «Ordina» non cambia più niente, toglilo; se serve ancora, diventa un'icona piccola con etichetta, non una voce di menu);
- **togli il menu «Altro»** e la logica che sposta i pulsanti dentro (`np-more`).
Aggiorna `AGENTS.md` sez. 3 e gli e2e che usano `#np-merge`, `#np-tile`, `#np-more`.

---

## BLOCCO 2: scheda «Perdite neutre» (`web/tables.js`)

**2.1 Breve spiegazione in cima.** Sopra la tabella un testo breve, **esattamente questo** (scritto da Claude con Federico, non riscriverlo; apici e pedici con `<sup>`/`<sub>`):
> «Nella cella di collisione (q2) lo ione selezionato urta le molecole del gas: parte della sua energia di movimento diventa energia interna (vibrazioni). Lo ione la scarica **rompendo un legame**, spesso dopo un **riarrangiamento** in cui un atomo di idrogeno si sposta: si stacca una piccola molecola stabile e **neutra** (H<sub>2</sub>O, CO, NH<sub>3</sub>, CO<sub>2</sub>…), che il rivelatore non vede, mentre la carica resta sul frammento. Per questo nello spettro MS<sup>2</sup> si legge la perdita come differenza: **Δm = m/z del precursore − m/z del frammento**.»
Sotto, una riga **«▸ Più dettagli»** che si espande (chiusa di default) con:
> «Gli ioni dell'electrospray hanno quasi sempre un numero pari di elettroni ([M+H]<sup>+</sup>, [M−H]<sup>−</sup>) e tendono a perdere molecole intere a guscio chiuso, non radicali (regola degli elettroni pari): le perdite di radicali come •CH<sub>3</sub>, •NO<sub>2</sub> o •Cl sono eccezioni, possibili quando il frammento è stabilizzato da un anello aromatico (gruppi metossilici, nitro o atomi di cloro legati all'anello). Le perdite più comuni passano per stati di transizione ciclici a quattro o sei atomi, che costano poca energia; aumentando l'energia di collisione (CE) compaiono rotture più difficili e **perdite in cascata** (per esempio −18 e poi −44, cioè −62 in totale). A risoluzione unitaria alcune perdite hanno la stessa massa nominale (28 = CO oppure C<sub>2</sub>H<sub>4</sub>): servono altri indizi, come il profilo isotopico o le altre perdite dello stesso ione.»
Nessun altro testo introduttivo; il paragrafo su perdite isobare/cascate già in Teoria cap. 8 resta lì.

**2.2 «ESI+» e «ESI−» invece di «+» e «−».** Nella colonna della polarità tipica e nei pulsanti del filtro scrivi **«ESI+»**, **«ESI−»**, **«entrambe»** (filtro: «ESI+ / ESI− / tutte»), non i segni da soli. Stesso stile dei badge di polarità della lista dei file (prompt 3, punto 7.1), se già esistono.

**2.3 Via «Cerca Δm».** Togli il campo «Cerca Δm» con il riquadro «Possibili perdite (da verificare sullo spettro)» (coppie e ripetizioni) e la voce del menu del righello «Cerca … nelle perdite neutre» che lo usava. Il righello mostra solo la misura. Aggiorna pytest/e2e che li provano (`62 → H2O + CO2`, `72 → 2 × HCl`) e `AGENTS.md` sez. 18.

**2.4 Aggiungi la perdita del radicale •Cl.** Nuova riga nella tabella (con il pallino dei radicali, come •CH<sub>3</sub> e •NO<sub>2</sub>): **•Cl**, Δm **35** (e **37** per il precursore che contiene <sup>37</sup>Cl: scrivilo nei «Dettagli»), «si vede in»: «composti con cloro legato a un anello aromatico (es. pesticidi clorurati)», polarità tipica come da fonti (verifica; se incerta, «entrambe»). Nei «Dettagli» una riga che la distingue da **HCl (36)**, già in tabella: «•Cl (35): perdita del solo atomo, rara (radicale); HCl (36): perdita della molecola, più comune». Massa esatta calcolata da `elements.py`. Solo il cloro: niente •Br o •I (decisione di Federico).

e2e del blocco: riga •Cl presente con il pallino; testo introduttivo presente, «Più dettagli» chiuso e apribile, «ESI+»/«ESI−» nella tabella e nel filtro, nessun campo «Cerca Δm», nessuna voce nel menu del righello.

---

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Messaggio finale a Federico: una riga per punto, cosa provare a mano con Cmd+Shift+R. Aggiorna `AGENTS.md` e cancella da questo file ciò che è fatto.
