# PROSSIMA CHAT 3 (QqQ lab): integrazione dei picchi, schermo intero, testo dei grafici, strumenti dell'header

> **Quando usarlo**: DOPO che il lavoro di `PROMPT_PROSSIMA_CHAT_2.md` è stato unito in `main` (una chat lo sta eseguendo ora). Alcuni punti toccano cose cambiate da quella chat (calcolatrice, Addotti, intestazioni, tooltip): parti dal codice attuale e adatta, non rifare.
> **Come si usa questo file**: contiene SOLO il lavoro da fare. Quando un punto è fatto e verificato, **cancellalo da qui**; ciò che resta utile (nomi di funzioni, decisioni) va in `AGENTS.md`. Se alla fine il file è vuoto, spostalo in `_cestino/<data>_prompt_completati/`.

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con il repository `QqQ-lab-dati` per i dati veri). Leggi `AGENTS.md` sez. 1-2, 5 e le ultime sezioni; poi SOLO il codice che serve, con `grep -n` (i nomi qui sotto sono indicativi: cercali). Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti.
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole. Icone con etichetta breve al passaggio del mouse.
- **Risparmio token**: un blocco alla volta; file letti una volta; prove mirate; screenshot in `tests_e2e/shots/`, guardane al massimo uno per punto.
- **Verifica**: `python3 tools/verifica.py --solo <e2e che tocchi>` durante il lavoro, completa alla fine. **Non lanciare** nulla che usi Pyodide (e2e13, e2e_tpmine*, `tools/build_site.py`).
- Un commit per blocco (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema); sul Mac su `main`, nel cloud sul ramo della sessione e **una sola pull request alla fine**.
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano. Se il budget sta finendo: fermati dopo un commit pulito e aggiorna questo file.

## Ordine di lavoro (per importanza)
1. **Integrazione dei picchi** (dati corretti prima di tutto)
2. **Schermo intero**
3. **Dimensione del testo anche dentro i grafici**
4. **Strumenti dell'header**: via Isotopi, calcolatrice vera, Addotti più semplici
5. **Rifiniture** (menu «Correzione» con icone, documenti per gli agenti)

---

## BLOCCO 1: integrazione dei picchi (`explore.js`: `addInt`, `intSeries`, `p.ints`, `showInts`, barre trascinabili)

**Problema**: oggi si può integrare un picco sopra un altro già integrato (stessa traccia, stesso file), con aree sovrapposte e una tabella sbagliata; e cancellare un singolo picco integrato non è immediato.

**Come fanno gli altri programmi** (MultiQuant/Analyst, Chromeleon, OpenLab): ogni picco integrato è una zona riempita con la sua linea di base; i picchi **non si sovrappongono** (al massimo si **toccano**: due picchi vicini condividono il bordo con una «linea di caduta» verticale); si **seleziona** un picco cliccandolo e lo si cancella con il tasto Canc o dal menu; c'è sempre un «annulla» per l'ultima modifica.

**1.1 Niente sovrapposizioni.** Per la stessa traccia e lo stesso file un intervallo già integrato **non si può integrare di nuovo**:
- integrazione automatica o manuale che cade (anche in parte) su un picco già integrato → non viene creata e compare un messaggio breve vicino al cursore: «Qui c'è già un picco integrato: toglilo prima (clic destro → Elimina)»;
- trascinando i bordi di un picco, la barra **si ferma** al bordo del picco vicino (i due picchi possono toccarsi, non sovrapporsi);
- con «tutti i file» (MRM, una finestra per tutti i file) la regola vale file per file; con Quantificatore/Qualificatore a specchio vale per entrambe le tracce;
- i taccuini vecchi con picchi sovrapposti: si caricano lo stesso e nella tabella le righe sovrapposte hanno un segno «⚠ sovrapposto» (non cancellarle da solo).

**1.2 Selezionare e cancellare un picco alla volta.**
- **Clic sulla zona riempita** di un picco integrato = lo seleziona (bordo più marcato, area evidenziata); clic fuori = deseleziona.
- Con un picco selezionato: tasto **Canc/Backspace** lo cancella (Backspace qui ha la precedenza sulla «vista intera» solo se c'è un picco selezionato).
- **Clic destro** su un picco integrato: in cima «Elimina questa integrazione» (già esiste: verificala), poi «Elimina tutte le integrazioni di questo pannello» (con conferma).
- Nella tabella delle integrazioni: una **×** per riga, che cancella quel picco anche dal grafico.
- **Annulla**: Ctrl/Cmd+Z annulla l'ultima integrazione aggiunta, cancellata o spostata (pila delle ultime 20 modifiche delle integrazioni per pannello; se c'è già un Ctrl+Z per lo zoom, l'annulla vale per l'ultima azione fatta, qualunque sia).
- e2e: integra A, prova a integrare B sopra A → rifiutato; B adiacente → accettato e bordo condiviso; trascina il bordo di B dentro A → si ferma; seleziona B + Canc → sparisce dal grafico e dalla tabella; Ctrl+Z → ritorna.

---

## BLOCCO 2: schermo intero (pulsante ⤢ dei pannelli)

**Problema**: a schermo intero alcune cose non funzionano (es. il doppio clic non riporta lo zoom alla vista intera) e intanto **cambiano cose nei pannelli sotto**. A schermo intero deve esistere solo quel pannello.
- Quando un pannello è a schermo intero, **tutto il resto è inerte**: niente eventi (clic, doppio clic, rotella, tasti) arrivano agli altri pannelli, alla lista dei file o alla barra; le frecce ← → e le scorciatoie agiscono **solo** sul pannello a schermo intero. Usa `inert` sugli altri elementi (o un velo che intercetta gli eventi) e controlla i gestori globali (`document.addEventListener("keydown"…)`, `E.active`).
- **Tutti gli strumenti funzionano** dentro: doppio clic = vista intera, zoom (riquadro e assi), lucchetto, menu del clic destro e tendine (posizionati dentro il pannello, sopra di esso), tooltip, integrazione, righello, annotazioni, esportazioni.
- Il grafico si ridisegna alla nuova dimensione entrando e uscendo; uscita con il pulsante e con Esc; all'uscita i pannelli sotto sono esattamente come prima (stesso zoom, stesso cursore).
- e2e: a schermo intero il doppio clic resetta lo zoom; un tasto freccia cambia la scansione solo nel pannello a schermo intero; dopo l'uscita lo stato degli altri pannelli è invariato.

---

## BLOCCO 3: «Dimensione testo» anche dentro i grafici

**Problema**: l'impostazione «Dimensione testo» (ingranaggio, `settings.js`: `UIP.font` = 90/100/115/130, applicata come variabile CSS `--z`) ingrandisce menu e liste ma non i testi dentro cromatogrammi e spettri, perché il canvas usa dimensioni fisse (circa 20 punti con `"…px system-ui"` nei file di `web/`).
- Una funzione unica (es. `fpx(n)` = `n * UIP.font / 100`) per **tutti** i testi disegnati nei canvas: numeri e titoli degli assi, etichette dei picchi, legenda, riquadro del mouse, annotazioni, righello, intestazioni dei pannelli disegnate.
- I **margini** dei grafici (`M.l`, `M.b`, …) e la distanza fra le tacche degli assi si adattano alla dimensione del testo (niente numeri tagliati o sovrapposti a 130%).
- Cambiando la dimensione nell'ingranaggio, i grafici si ridisegnano subito.
- **PNG esportati**: usano la dimensione standard (100%), così le immagini per la relazione sono sempre uguali (scrivilo nell'etichetta dell'impostazione: «vale anche dentro i grafici; le immagini esportate restano alla dimensione standard»).
- e2e: a 130% il font del canvas è più grande (leggi il valore usato) e i numeri dell'asse y non escono dal margine (screenshot).

---

## BLOCCO 4: strumenti dell'header

**4.1 Via «Isotopi» dall'header.** Togli il pulsante Isotopi dall'header e la scheda Isotopi dalla finestra Tavola/Addotti (semplificazione decisa da Federico). Il profilo isotopico si usa **solo dentro i grafici**: clic destro sullo spettro → «Profilo isotopico di una formula…» (già esiste, `p.iso`). Aggiorna i rimandi alla «scheda Isotopi» (es. nelle Perdite neutre: «guarda M+2 nella scheda Isotopi» diventa «controlla M+2 con il profilo isotopico nello spettro (clic destro)»), Teoria, aiuto, `AGENTS.md` ed e2e.

**4.2 Calcolatrice vera (oltre alla calcolatrice m/z).** La calcolatrice dell'header serve anche per **semplici addizioni e sottrazioni** (es. capire le perdite: 364.4 − 194.2). Deve essere **grande e facile**:
- **un solo campo**: se lo studente scrive un'**espressione con numeri** (`364.4-194.2`, `305+18`, `(229.1-171.2)*2`) la calcolatrice fa il **conto**; se scrive una **formula chimica** (`C9H10Cl2N2O`, anche in minuscolo) fa come oggi (m/z degli addotti). Riconoscimento: solo cifre, punto/virgola decimale, spazi, `+ − * / ( )` → conto; altrimenti formula. Accetta la virgola decimale e il segno «−»/«x»/«×»/«÷» scritti in modo italiano.
- **tastierino** sotto il campo con tasti grandi: 0-9, «,» (punto decimale), + − × ÷, ( ), «←» (cancella un carattere), «C» (azzera), «=». Funziona anche dalla **tastiera** del computer (cifre, + − * /, Invio = risultato, Esc = azzera, Backspace).
- **Risultato grande** sotto il campo, con 4 decimali al massimo (zeri finali tolti); niente notazione scientifica per i numeri normali.
- **Nastro** (storico) delle ultime 10 operazioni sotto il risultato («364.4 − 194.2 = 170.2»); clic su una riga = rimette il risultato nel campo per continuare il conto; «Ans» = ultimo risultato.
- Il tastierino resta nascosto quando nel campo c'è una formula (lì serve la tabella degli addotti).
- e2e: `364.4-194.2` → 170.2; `364,4 − 194,2` → 170.2; tastierino 1 + 2 = → 3; Invio dalla tastiera; formula → tabella addotti come prima; nastro con 2 righe dopo due conti.

**4.3 Scheda Addotti più semplice.**
- Mostra subito solo gli **addotti comuni** in ESI con acido formico: positivo [M+H]+, [M+Na]+, [M+NH4]+, [M+K]+; negativo [M−H]−, [M+HCOO]−, [M+Cl]− (con la regola di polarità già prevista: prima o solo quelli della polarità dei file). Tutti gli altri (dimeri, doppie cariche, perdite d'acqua, [M]+, ecc.) sotto una riga **«▸ Altri addotti (meno comuni)»** che si espande con un clic e si richiude.
- **Togli** lo strumento «Due picchi: sono addotti dello stesso composto?» e il campo degli «m/z osservati» (codice, testi, test).
- **Togli** il testo «M è la massa esatta monoisotopica della molecola neutra (Cl-35, Br-79, C-12): per composti con Cl o Br il picco più alto può essere M+2 (vedi la scheda Isotopi). La colonna Δ aiuta a riconoscere gli addotti nello spettro: per esempio un picco 21.98 sopra [M+H]+ è quasi sempre [M+Na]+.» e mettilo al suo posto **esattamente** questo testo (scritto da Federico/Claude, non cambiarlo):
  > «Un **addotto** è lo ione che la molecola M forma nella sorgente legandosi a un piccolo ione presente in soluzione (H⁺, Na⁺, NH₄⁺, K⁺ in positivo; HCOO⁻ o Cl⁻ in negativo) o cedendo un protone ([M−H]⁻). Nello spettro non si vede M, ma l'm/z dei suoi addotti: per questo lo stesso composto può dare più picchi, sempre alla stessa distanza fra loro (per esempio circa 22 tra [M+H]⁺ e [M+Na]⁺).»
- e2e: righe comuni visibili, altri nascosti finché non si apre la riga; strumento «Due picchi» assente; testo nuovo presente.

---

## BLOCCO 5: rifiniture rimaste dai prompt precedenti (piccolo)
**5.1 Menu «Correzione» con icone.** Il menu unico «Correzione» (`data-o="corr"`, `setCorr`, `AGENTS.md` sez. 17) è un `<select>` con `title`: trasformalo in una tendina come quella dei «Parametri», con una piccola icona e un'etichetta di 1-2 righe per ogni voce (nessuna / file bianco / fondo di un tratto / linea di base automatica). Se l'intestazione in una riga del prompt 2 l'ha già spostato nei «Parametri», basta aggiungere icone ed etichette lì.

**5.2 Documenti per gli agenti.** `AGENTS.md` (riga «Documenti di supporto per agenti» e «Alla fine di ogni sessione aggiorna `PROMPT_PROSSIMA_CHAT.md`») cita ancora un solo prompt. Aggiornalo alla regola attuale: i prompt sono file numerati `PROMPT_PROSSIMA_CHAT_N.md`, uno per chat; ognuno si ripulisce da solo e, quando è vuoto, va in `_cestino/<data>_prompt_completati/`; i lavori in coda che aspettano il via libera di Federico stanno nell'ultimo prompt aperto (sezione «Lavori in coda»).

---

## Lavori in coda (NON farli senza il via libera di Federico)
1. **Dati dello studente**: `navigator.storage.persist()` + spazio usato; Esporta/Importa sessione (.zip con file, `taccuino.json`, `LEGGIMI.txt`; la scrittura zip c'è in `xlsx.js`). Dove mettere i pulsanti: da decidere con Federico (l'ingranaggio ha 3 controlli).
2. **Origine degli ioni / frammenti in sorgente**: la finestra «Da dove viene?» è nascosta; proposta di Claude in attesa di risposta di Federico: (a) «impronta del t0» (ioni presenti all'apice del progenitore nel t0 segnati negli altri spettri), (b) XIC normalizzati sovrapposti con Δ apice, (c) colonna «rapporto con una traccia di riferimento» nella tabella delle integrazioni, (d) eventuale prova in laboratorio con il t0 a due DP diversi. TP Mine: `isf.isf_classify` → flag `insource` (verifica se già fatto); `/api/origin` lento in Pyodide (19-38 s).
3. **Da provare a mano (Federico, non la chat)**: Windows, Safari, file grandi; un vero file IDA / MRM-IDA-EPI del 3200 QTRAP (il Blocco I è provato solo su dati sintetici); la vista a cascata con 7 file; S/N con la zona di rumore su un picco vero.

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Messaggio finale a Federico: una riga per punto (fatto / non fatto e perché), cosa provare a mano con Cmd+Shift+R. Aggiorna `AGENTS.md` (integrazione senza sovrapposizioni e annulla, schermo intero, testo dei grafici, header senza Isotopi, calcolatrice, Addotti) e cancella da questo file ciò che è fatto.
