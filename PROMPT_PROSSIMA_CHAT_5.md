# PROSSIMA CHAT 5 (mzLab / QqQ lab): Teoria riorganizzata (bassa e alta risoluzione, EI) + Palestra con giochi didattici

> **Quando usarlo**: può partire anche se il prompt 4 non è chiuso (parti C e D6): i file di questo prompt sono quasi tutti nuovi o della Teoria, quelli del prompt 4 no. Se un file serve a entrambi, prima `git fetch origin && git merge origin/main`.
> **Se questo file non è ancora nel repository**: la prima cosa che fai è salvarlo nella radice come `PROMPT_PROSSIMA_CHAT_5.md`, commit «Prompt 5: Teoria e Palestra» e push (lo legge anche chi lavora in parallelo).
> **Come si usa**: contiene SOLO il lavoro da fare. Punto fatto e verificato → **cancellalo da qui**; ciò che resta utile va in `AGENTS.md`. File vuoto → spostalo in `_cestino/<data>_prompt_completati/`. Riferimenti per **nome di funzione** (le righe cambiano): cerca con `grep -n`.
> Scritto il 7/10/2026 da una chat di sola ricerca (letteratura di didattica della chimica e della spettrometria di massa, libro di McLafferty e Tureček, banche dati di spettri EI, codice attuale). Le scelte di progetto sono fatte; se il codice non torna con quanto scritto, scegli la soluzione più semplice coerente con lo scopo e scrivilo a Federico. La sintesi della ricerca e la bibliografia **verificata** (DOI controllati su Crossref) sono negli **Allegati A-C** in fondo: usale per i testi, non inventare riferimenti.

## Esecuzione (7/10/2026 sera, una sola sessione: queste decisioni valgono più del resto del file)
Federico ha chiesto di fare tutto in una sessione, toccando **solo Teoria e Pratica** (altre chat lavorano sul resto) e aggiungendo **GC e LC**, perché all'orale gli studenti portano tutta la spettrometria di massa (bassa e alta risoluzione), GC e LC, e risolvono uno spettro EI.
- **La Pratica (la «Palestra» di questo file) sta dentro il modulo Teoria**: pagine `teoria/pratica*.html` con lo stesso menu laterale (parte «Pratica»), codice e dati in `teoria/pratica/`. Niente pulsante nuovo in `index.html` e nessun file fuori da `teoria/` (salvo test, `tools/genera_*.py`, README/AGENTS).
- **Numerazione definitiva** (sostituisce la tabella di T0): A uso · 0 introduzione · 1 TP · 2 fotocatalisi · **3 fondamenti di cromatografia (nuovo)** · 4 LC · **5 GC (nuovo)** · 6 ESI e sorgenti API · **7 EI e CI (nuovo)** · 8 vuoto · 9 quadrupolo · 10 triplo quadrupolo e CID · **11 risoluzione e analizzatori ad alta risoluzione (nuovo)** · 12 dati · **13 formula (nuovo)** · 14 frammentazione CID · **15 EI: il metodo (nuovo)** · **16 EI: le famiglie (nuovo)** · 17 origine degli ioni · 18 strategia · 19 alta risoluzione e DDA nel programma · 20 disegno · 21 glossario e bibliografia · Pratica. I nomi vecchi dei file restano come rimandi (`<meta refresh>`).

## Contesto (per chi parte da zero: le chat non hanno memoria, conta solo ciò che è scritto qui e in `AGENTS.md`)
- **mzLab** (nome interno QqQ lab) è il programma didattico di Federico Cristaudo (dottorando, Università di Torino) per il laboratorio di inquinanti della magistrale in Chimica dell'ambiente: gli studenti cercano i prodotti di trasformazione (TP) di un contaminante incognito (**non nominarlo mai nell'interfaccia**) nei dati LC-MS di un triplo quadrupolo 3200 QTRAP (risoluzione unitaria). Gira solo nel browser (GitHub Pages, Pyodide). Dal prompt 4 legge anche file ad alta risoluzione (Orbitrap, DDA).
- Repository: `Freeesta/QqQ-lab` (**pubblico**) e `Freeesta/QqQ-lab-dati` (**privato**, dati veri per i test).
- **Che cosa chiede Federico con questo prompt** (7/10/2026):
  0. **Obiettivo d'esame, la priorità di tutto il prompt**: all'orale ogni studente deve **risolvere da solo uno spettro EI** (dallo spettro alla struttura, spiegando il ragionamento a voce). La teoria EI (capp. 13-14) e il gioco EI devono portare all'**autonomia**: un metodo sempre uguale, tanta pratica su spettri veri con riscontro, e alla fine prove senza aiuti nelle stesse condizioni dell'esame (vedi T2 e G2, «Modalità orale»).
  1. **Riorganizzare tutta la Teoria** in un percorso chiaro, con la **bassa e l'alta risoluzione trattate in parallelo** (oggi l'alta risoluzione è solo un capitolo pratico corto, il 14) e con i modi di spiegare che la letteratura indica come efficaci (Allegato A).
  2. **Un capitolo nuovo sulla ionizzazione elettronica (EI, GC-MS)** e sulla lettura degli spettri EI alla McLafferty (oggi l'EI non c'è: solo un cenno in `04-esi.html`).
  3. **Una «Palestra»**: una vista nuova con **giochi didattici**. Il gioco principale: **«Dallo spettro alla struttura»**, lo studente ricostruisce la **formula di struttura** di un composto a partire dal suo **spettro EI** (sorgente hard, GC), seguendo il procedimento di McLafferty, con suggerimenti a pagamento e correzione immediata. Poi giochi brevi e mirati (perdite neutre, isotopi, formula esatta in alta risoluzione, carte dello strumento, pilota il quadrupolo, caccia alla transizione MRM).
  4. **Collegare tutto all'esperienza 3** (prima, durante e dopo il laboratorio).

## Prima di iniziare (ogni sessione)
1. `git fetch origin`; lavora sopra `origin/main` aggiornato.
2. Leggi «Stato e ripresa» qui sotto: se la tua sessione ha già lavoro fatto, riparti da lì.
3. Di questo file leggi: Contesto, Prima di iniziare, Regole fisse, Stato e ripresa, Sessioni, **le parti della tua sessione**, Decisioni, Chiusura e gli Allegati che la tua parte cita. Di `AGENTS.md` leggi sez. 1-2, 3 (solo le righe di `teoria/`, `draw.js`, `tables.js`), 5, 9, 18 (perdite neutre), 21 (alta risoluzione) e 23 (librerie). Poi SOLO il codice che serve, con `grep -n`. **Non leggere `vendor/`** (per controllare che una funzione di OpenChemLib o Ketcher esista basta `grep -o "nomeFunzione" qqq_lab/web/vendor/openchemlib.js | head -1`).

## Regole fisse
- Interfaccia e testi in italiano; codice e commenti in inglese; sempre «m/z», «MS2» (l'osservatore lo trasforma in MS<sup>2</sup>), RT, XIC. Non cancellare file (`_cestino/`). Interfaccia pulita: di default poco, i dettagli per chi li vuole.
- **Principio 1 di `AGENTS.md` (il programma non dà risposte) resta valido per i dati dell'esperienza.** La Palestra è un luogo separato di esercizio su composti **di libreria** con soluzione nota: lì la correzione immediata è il punto (pratica di recupero con feedback, Allegato A). Regole precise in «Decisioni». Mai un gioco che corregge o suggerisce qualcosa sui file caricati dallo studente.
- **Composti vietati negli esempi e nei giochi**: gli inquinanti dei metodi del laboratorio (i 7 nomi dei file `.dam` in `QqQ-lab-dati/dam/`: escludili per InChIKey nello strumento che costruisce i dati; nel repository pubblico NON scrivere i loro nomi in elenchi nuovi, scrivi solo le prime 14 lettere dell'InChIKey con il commento «inquinanti dei metodi del laboratorio»). L'esempio svolto della Teoria resta l'atrazina.
- **Dati di terzi**: solo dati con licenza che ne permette la ridistribuzione (Allegato C). **Niente spettri NIST** nel repository (NIST SRD 69 è protetto dallo Standard Reference Data Act: il sito si può solo linkare).
- **Leggero e offline**: niente librerie nuove (Ketcher e OpenChemLib ci sono già; i grafici si disegnano su canvas come in Teoria con `TP.axes`/`TP.line`). La Palestra e la Teoria devono funzionare anche offline. **Nessun servizio in rete, nessuna classifica online**: i progressi stanno nel browser dello studente.
- **Onestà scientifica**: a risoluzione unitaria un m/z è un candidato; i numeri dei testi (masse, differenze, risoluzioni necessarie) si calcolano con `qqq_lab/chem/elements.py` e un test li controlla, non si copiano da qui senza verifica. Le frasi «da manuale» sui meccanismi EI vanno marcate nel codice con `// da verificare sul McLafferty` finché Federico non le controlla sul libro (ce l'ha nel materiale del corso, cartella «Spettro di Massa»).
- **Verifica**: `python3 tools/verifica.py --solo <test che tocchi>` durante il lavoro, completa alla fine di ogni blocco. Non lanciare ciò che usa Pyodide (e2e13, e2e_tpmine*, `tools/build_site.py`). Un front end non provato nel browser è rotto: ogni gioco ha il suo e2e. Aggiorna la tabella `NEEDS` di `tools/verifica.py` per gli e2e nuovi.
- **Commit e push dopo ogni punto** (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema; commit intermedi «[in corso] …» ogni ~30 minuti se un punto è lungo). Nel cloud: ramo della sessione; **alla fine di ogni blocco, se la verifica completa è verde, unisci la PR in `main`** (`git fetch origin && git merge origin/main`, nuova verifica, PR, merge commit); per il blocco dopo un ramo nuovo da `main`. Rosso, conflitto o decisione da prendere: non unire, PR aperta, spiega a Federico. Il proxy rifiuta cancellazioni di rami e push forzati: non insistere.
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano.

## Stato e ripresa
**Stato** (aggiornalo e fai push a ogni punto finito). Ogni sessione cambia **solo la riga sotto il suo titolo** (le righe vuote fra le sessioni evitano i conflitti: non toglierle). Formato: punti fatti · punto in corso · ramo non ancora in `main`.

**T**
- sessione unica (T, G, H insieme): fatti B1 struttura (22 capitoli in sei parti, rimandi dai vecchi nomi), B2 cromatografia (3-5), B3 EI e CI (7), B4 risoluzione e formula (11, 13), B5 spettri EI MassBank e capitoli 15-16, B6 gioco EI, B7 formulario (22), domande dell'orale e cinque giochi brevi, B8 obiettivi nei capitoli vecchi, indice, glossario, bibliografia, documenti, test e2e_pratica · nessun punto in corso · ramo `claude/ms-teaching-gamification-joek2s` (PR verso `main`). Nota: i dati EI stanno in `teoria/pratica/` (non `palestra/`), la Pratica è dentro il modulo Teoria.

**G**
- svolta dalla sessione T (vedi sopra)

**H**
- svolta dalla sessione T (vedi sopra)

**Se riprendi dopo un'interruzione**: `git fetch origin`; leggi «Stato»; guarda le PR aperte e i rami `claude/...` non uniti con commit «[in corso]» (`git branch -r --no-merged origin/main`); porta il lavoro non unito nel tuo ramo (`git merge origin/<ramo>`), rilancia `python3 tools/verifica.py --solo <test del punto>` e riparti dal punto in corso.

## Sessioni (Federico ne lancia fino a tre insieme: «Esegui `PROMPT_PROSSIMA_CHAT_5.md`, sessione T»)
| Sessione | Blocchi, in ordine | File principali |
|---|---|---|
| **T** (Teoria) | T0 → **T2** (EI, priorità) → T1 → T3 → T4 → T5 → T6 | `qqq_lab/web/teoria/*`, `tools/genera_glossario.py`, `teoria/LEGGIMI.md`, test della Teoria (e2e7, pytest dei link) |
| **G** (Palestra + gioco EI) | G0 → G1 → G2 → G3 | `qqq_lab/web/palestra/*` (nuova), `tools/genera_ei.py` (nuovo), agganci minimi in `index.html` |
| **H** (altri giochi) | H0 (subito, non dipende da G0) → poi, quando G0 è in `main`, H1 → H2 → H3 → H4 → H5 | `tools/dati_sintetici.py` (H0), `qqq_lab/web/palestra/giochi-*.js` (nuovi) |
Con una sola sessione: T0, T2, G0, G1, G2, G3, T1, H1, T3, H2, H3, T4, H4, H5, T5, T6, H0 (tutto ciò che serve all'orale di EI per primo).
Regole per il lavoro in parallelo: tocca solo i file del tuo blocco. **G0 definisce l'interfaccia comune dei giochi** (`PAL.register`, punteggio, Elo, suggerimenti): H non la cambia, al massimo aggiunge. T e G si toccano solo nei link fra Teoria e Palestra (T crea le ancore, G le usa: vedi T0.4).
**`AGENTS.md`**: G aggiunge la sezione «Palestra» (struttura, interfaccia `PAL`, dati EI e licenze, come si aggiunge un gioco), T aggiorna le righe di `teoria/` (sez. 3) e la regola dei composti degli esempi, H aggiunge i suoi giochi alla sezione di G. Frasi brevi, con nomi di file e funzioni, per chi non sa niente.

---

# PARTE T: la Teoria riorganizzata (sessione T)

## Perché e come (sintesi dell'Allegato A, per orientare ogni scelta)
- **Percorso a spirale** (Worrall 2024; Joyner 2022): gli stessi concetti tornano a livelli crescenti; ogni capitolo dice all'inizio *che cosa saprai fare* e alla fine *dove si usa nel programma e nella Palestra*.
- **Aprire la scatola nera** (Do 2026; Henchman & Steel 1998; Diao 2025): lo strumento si capisce guardando gli ioni muoversi. Le simulazioni in stile PhET (Wieman 2008): pochi controlli, risposta immediata, più rappresentazioni collegate (strumento, ione, spettro: il triangolo di Johnstone 1991).
- **Prevedi, osserva, spiega**: prima di ogni figura interattiva una domanda «Prima di muovere il cursore: che cosa ti aspetti?» (in `<details>`).
- **Esempi svolti che sfumano** (Renkl & Atkinson): un esempio svolto completo, poi uno a metà, poi il problema; le domande di verifica esistenti restano.
- **Errori frequenti espliciti** (riquadro `box warn`): elenco nell'Allegato A.4.
- **Bassa e alta risoluzione in parallelo**: dove un concetto cambia con la risoluzione, due riquadri affiancati «A risoluzione unitaria (il vostro QqQ)» / «Ad alta risoluzione (Orbitrap, Q-TOF)».

## T0: struttura, menu a parti e nuovi blocchi
1. **Nuovo ordine dei capitoli** (rinomina i file con `git mv` e aggiorna TUTTI i link con uno script; poi `grep -rn "teoria/\|cap\. [0-9]\|Teoria cap" qqq_lab/web tests tests_e2e` per i riferimenti nel programma, in `help.js` e nei test):

| Parte (nel menu) | N. | File nuovo | Da dove viene |
|---|---|---|---|
| Guida | A | `00-uso.html` | invariato |
| | 0 | `index.html` | + mappa nuova e «Percorso dell'esperienza» (T5) |
| I. Il problema | 1 | `01-tp.html` | invariato (+ livelli di confidenza in bassa e alta risoluzione) |
| | 2 | `02-fotocatalisi.html` | invariato |
| II. Separare e ionizzare | 3 | `03-lc.html` | invariato |
| | 4 | `04-esi.html` | + confronto delle sorgenti ESI/APCI/EI (tabella) |
| | 5 | `05-gc-ei.html` | **nuovo** (T2): GC e ionizzazione elettronica |
| | 6 | `06-vuoto.html` | era `05-vuoto.html` |
| III. Analizzare gli ioni | 7 | `07-quadrupolo.html` | era `06-quadrupolo.html` |
| | 8 | `08-qqq.html` | era `07-qqq.html` |
| | 9 | `09-risoluzione.html` | **nuovo** (T1): risoluzione, TOF, Orbitrap |
| IV. Leggere gli spettri | 10 | `10-dati.html` | era `09-dati.html` (la parte «Spettri a risoluzione unitaria» va nell'11) |
| | 11 | `11-formula.html` | **nuovo** (T1): isotopi, massa nominale e massa esatta, formula |
| | 12 | `12-frammentazione-cid.html` | era `08-frammentazione.html` |
| | 13 | `13-ei-metodo.html` | **nuovo** (T2): risolvere uno spettro EI, il metodo (McLafferty) |
| | 14 | `14-ei-famiglie.html` | **nuovo** (T2): le famiglie di composti in EI e i loro ioni diagnostici |
| | 15 | `15-origine.html` | era `13-origine.html` |
| V. Dal dato al risultato | 16 | `16-strategia.html` | era `10-strategia.html` (+ flusso in bassa e in alta risoluzione) |
| | 17 | `17-hr-dda.html` | era `14-alta-risoluzione.html` (resta la parte pratica: DDA, NCE, file) |
| | 18 | `18-disegno.html` | era `12-disegno.html` |
| Appendice | 19 | `19-glossario.html` | era `11-glossario.html` |
   - `teoria.js`: `CHAPTERS` con un quarto campo «parte»; il menu laterale mostra i titoli delle parti (piccoli, non cliccabili). `00-uso.html` resta il primo. Avanti/indietro seguono l'ordine nuovo.
   - Un vecchio indirizzo (es. `13-origine.html`, ora `15-origine.html`) aperto da un segnalibro: per ogni nome vecchio lascia nella cartella `teoria/` un file minuscolo con il nome vecchio, `<meta http-equiv="refresh" content="0; url=15-origine.html">` e una riga «Il capitolo si è spostato» (non in una sottocartella: i link relativi si romperebbero). Non vanno in `CHAPTERS`; il test dei link li ignora. Con la tabella sopra nessun nome vecchio coincide con un nome nuovo (controllalo con uno script prima di creare i rimandi).
2. **Blocchi nuovi in `teoria.css`** (e in `LEGGIMI.md`, con il copia-incolla come gli altri):
   - `<div class="obj"><b>In questo capitolo impari a</b><ul>…</ul></div>` in cima a ogni capitolo (3-5 verbi operativi: «calcolare», «riconoscere», «scegliere»).
   - `<div class="duo"><div class="box lr"><b>A risoluzione unitaria (il vostro QqQ)</b>…</div><div class="box hr"><b>Ad alta risoluzione</b>…</div></div>`: due colonne sopra 900 px, una sotto l'altra sotto; colori distinti ma accessibili (controlla il contrasto anche nel tema scuro).
   - `<details class="poe"><summary>Prima di provare: che cosa ti aspetti?</summary><p>…</p></details>` sopra le figure interattive.
   - `<div class="box gym"><b>Allenati nella Palestra</b><p><a class="pal" data-game="ei" href="#">Dallo spettro alla struttura</a></p></div>`: il link apre la Palestra nel programma (`parent.postMessage({palestra: "ei"}, "*")` se la Teoria è dentro l'iframe; da `file://` il link mostra «apri il programma per giocare»). Il ricevitore lo scrive G in G0.
   - `<div class="box app"><b>Nel programma</b>…</div>`: dove si fa la cosa nel programma (sostituisce frasi sparse).
3. **Ancore stabili**: ogni `h2`/`h3` ha già un `id` da `slug()` di `teoria.js`; la Palestra le usa nei suggerimenti («Rileggi: …»). Non cambiare `slug()`. Scrivi in `LEGGIMI.md` che cambiare il titolo di una sezione cambia l'ancora e che `tests/` controlla le ancore usate dalla Palestra (test in G0).
4. Test: pytest dei link (esiste: `grep -n teoria tests/test_pipeline.py`) esteso a ancore e capitoli nuovi; `e2e7` aggiornato all'elenco nuovo (anche da `file://`); un test che controlla che ogni capitolo abbia `.obj`.

## T1: capitoli 9 (risoluzione e analizzatori ad alta risoluzione) e 11 (formula)
**Cap. 9 `09-risoluzione.html`** (figure in `sim-hr.js`, nuovo, stile di `sim-frag.js`):
- Risoluzione e potere risolutivo (definizioni IUPAC, Murray 2013: FWHM e valle al 10%); larghezza di un picco del QqQ (~0,7 a ogni m/z, quindi R cresce con m/z) contro R quasi costante del TOF e R ∝ (m/z)^-1/2 dell'Orbitrap (valori dichiarati «a m/z 200»). Accuratezza contro precisione; ppm e mDa (Brenton & Godfrey 2010); errore sistematico (taratura) contro casuale.
- **TOF**: tempo di volo t ∝ √(m/z), reflectron, accelerazione ortogonale. **Orbitrap** (Makarov 2000; Zubarev & Makarov 2013): oscillazione assiale ω = √(k·z/m), corrente immagine, trasformata di Fourier, risoluzione ∝ durata del transiente (quindi più risoluzione = meno scansioni al secondo: il compromesso con i punti per picco del cap. 10). FT-ICR solo un cenno (Marshall & Hendrickson 2008).
- Figure interattive (POE prima di ognuna):
  1. **Due picchi e la risoluzione** (`sim-res2`): due ioni a distanza Δm (menu: CO/N2/C2H4 a 28; C3H7+/C2H3O+ a 43; 13C contro 15N; 13C2 contro 34S; 18O contro 13C2), cursore R e cursore m/z: somma dei due profili gaussiani, centroide misurato (che a bassa R cade nel mezzo: errore di massa «finto»), R minima per separarli. Tutte le masse da `elements.js` (`QQQRef` non è caricato in Teoria: usa `elements.js` con uno `<script>` come fa `glossario-dati.js`, o copia le poche masse nel file con un test che le confronta con `elements.py`).
  2. **Orbitrap** (`sim-orbi`): due o tre ioni nella trappola (puntini che oscillano), transiente (somma di sinusoidi smorzate), spettro dalla FFT; cursore «durata del transiente» → righe più strette. Ispirato ai notebook di Do 2026, ma in JS semplice.
  3. **TOF** (`sim-tof`): ioni che partono insieme e arrivano in tempi diversi; cursore dispersione dell'energia iniziale con e senza reflectron.
- Domande di verifica come negli altri capitoli.
**Cap. 11 `11-formula.html`** (bassa e alta risoluzione in parallelo, riquadri `duo` ovunque serva):
- Massa nominale, monoisotopica, media; difetto di massa (H positivo, Cl/Br/O negativi); regola dell'azoto per M+• (EI) e per [M+H]+ (ESI): **la parità si inverte** (errore frequente!). Anelli + doppi legami (RDB = C − H/2 + N/2 + 1; alogeni come H, Si come C; RDB intero = ione a elettroni dispari, semintero = pari). Regola del 13 (Bright & Chen 1983) come esercizio storico per elencare formule da una massa nominale.
- Isotopi: elementi A, A+1, A+2 (C 1,1% per C; N 0,37%; S 4,4% a +2; Si; Cl 3:1; Br 1:1; Cl2 9:6:1; Br2 1:2:1; ClBr ~3:4:1); stimare il numero di C dal rapporto M+1/M e i suoi limiti a risoluzione unitaria (fondo, saturazione, H mancanti). Riusa la figura degli isotopi di `sim-misc.js` (spostala qui se è più chiara qui; aggiorna i link).
- Alta risoluzione: struttura fine isotopica (13C2 contro 34S contro 18O a M+2: R necessaria calcolata, non scritta a mano), errore in ppm e numero di formule compatibili, le «sette regole d'oro» (Kind & Fiehn 2007), diagramma di Kendrick (Kendrick 1963; Hughey 2001) con una serie omologa.
- Figura `sim-formule` (in `sim-hr.js`): **quante formule** (C, H, N, O, S, Cl entro limiti ragionevoli, valenze rispettate) cadono entro ±tolleranza attorno a una m/z scelta con il cursore: istogramma o nuvola difetto di massa contro m/z, con il **numero** in evidenza, per tolleranza «unitaria (±0,5)», 10, 5, 2, 1 ppm. **Mostra solo quante sono e dove stanno, mai l'elenco delle formule** (vedi Decisioni: non è un generatore di formule). Funzione pura `countFormulas(mz, tolDa, limits)` provata da node (pochi casi controllati a mano con `elements.py`).
- Test: pytest che ricalcola con `elements.py` ogni numero scritto nei due capitoli (le masse e le R minime stanno in un piccolo `data-*` o in una tabella con classe `chk` che il test legge).

## T2: capitoli 5 (GC e EI) e 13 (frammentazione EI alla McLafferty)
Fonte principale: McLafferty F.W., Tureček F., *Interpretation of Mass Spectra*, 4ª ed. (1993), capitoli 1-5 e 9 (struttura riassunta nell'Allegato B). Esempi solo su composti semplici di libro (2-esanone, butirrofenone, toluene, clorobenzene, 1-butanolo, trietilammina…) e sull'atrazina; mai sugli inquinanti dei metodi.
**Cap. 5 `05-gc-ei.html`** (corto: lo strumento):
- Perché in GC si può usare l'EI (fase gas, vuoto, molecole volatili e termostabili) e in LC no (rimando al cap. 4); la sorgente EI (filamento, 70 eV, trappola, repeller); perché 70 eV: lunghezza d'onda di de Broglie dell'elettrone confrontabile con i legami, efficienza di ionizzazione sul plateau, spettri riproducibili fra strumenti → **librerie** (NIST, Wiley, MassBank: Stein 1994) e ricerca per somiglianza; ionizzazione chimica (CI) come sorgente soffice per vedere M. Il GC-MS/MS su triplo quadrupolo come ponte con l'esperienza.
- Figura `sim-ei` (in `sim-ei.js`, nuovo): distribuzione dell'energia interna depositata P(E) per elettroni da 12 a 70 eV sopra le soglie di tre canali di un modello (M+•, α-scissione, McLafferty), con k(E) del modello RRK di `sim-frag.js` (riusa la funzione); barre dello spettro che cambiano con l'energia degli elettroni. Etichetta «modello illustrativo».
- Tabella ESI contro EI: ioni a elettroni pari ([M+H]+) contro dispari (M+•); energia interna bassa e controllata (CID) contro alta e larga (EI); frammentazione scelta dallo sperimentatore (MS2) contro sempre presente; librerie universali (EI) contro dipendenti dallo strumento e dalla CE (MS2).
**Obiettivo dei capp. 13 e 14: che lo studente, all'orale, risolva da solo uno spettro EI.** Quindi: un metodo unico e sempre uguale (lo stesso nei capitoli, nel gioco, nel foglio di lavoro e all'esame), regole scritte come strumenti da usare (con il «come si controlla»), tanti esempi veri per famiglia, e un passaggio esplicito dall'esempio svolto al problema da solo. Fonti: McLafferty & Tureček capp. 1-5 e 9 (Federico ha il libro: le frasi marcate vanno controllate lì), le lezioni CHEM-5181 di J.-L. Jimenez (Colorado) che seguono il libro passo per passo, il protocollo NIST di Mikaia (2022) per gli ioni diagnostici delle famiglie (Allegato B). **Non copiare testo né spettri del libro** (diritto d'autore): testi nostri, spettri da MassBank.

**Cap. 13 `13-ei-metodo.html`: risolvere uno spettro EI, il metodo**
1. **Il procedimento standard di interpretazione** (Allegato B.1, con i sottopassi numerati 1.1-4.2 come nelle lezioni di Jimenez) è il filo del capitolo e del gioco: stessi nomi e stessi numeri dei passi in capitolo, gioco, foglio di lavoro e «Modalità orale». Regola d'oro da scrivere in un riquadro: **ogni affermazione sullo spettro si scrive con il numero del passo che la giustifica** («2.3 regola dell'azoto: M = 101 dispari → N dispari»).
2. **Leggere lo spettro prima di interpretarlo**: intensità relative al picco base (100% o 999‰), tabella dei picchi principali (le dieci più intense, come nelle librerie), rumore e picchi di fondo (aria 28, 32, 40, 44; colonna/silossani 73, 207, 281; ftalati 149), spettri della stessa sostanza da strumenti diversi non identici (lo mostra il gioco con i doppioni di MassBank). Perché si parte **dall'alto delle m/z** e dal picco più alto di ogni gruppo.
3. **Composizione elementare** (passi 1.x): elementi A, A+1, A+2 (Allegato B.4); il rapporto (M+1)/M per il numero di C e i suoi limiti; «se (X+2)/X < 3% nessun Si, S, Cl, Br» (informazione negativa); picchi a −1/−2 (perdite di H) che sporcano i rapporti; regola del 13 con le correzioni per O, N, Cl (Bright & Chen 1983; Mikaia 2022); RDB e parità degli elettroni.
4. **Lo ione molecolare** (passi 2.x): i tre test (massa più alta del gruppo, elettroni dispari, perdite logiche: improbabili da 4 a 14 e da 21 a 25), regola dell'azoto per ioni OE e EE, abbondanza di M e struttura (cresce con anelli e insaturazioni, cala con le ramificazioni; tabella dell'abbondanza di M per famiglia), quando M non si vede (alcoli terziari, alcani molto ramificati, CCl4) e che cosa dire allora all'orale; errori frequenti (picco di fondo, M−1, picco base).
5. **Ioni importanti**: a elettroni dispari (da segnare **sempre** sullo spettro: nascono da riarrangiamenti o da rotture di anelli), più intensi, a massa più alta, più alti del loro gruppo; gli ioni OE importanti a bassa m/z sono rari: un picco pari intenso a bassa massa di solito contiene un N.
6. **Meccanismi** (frecce in svg semplici, freccia a mezza punta per un elettrone): sito della carica dopo la ionizzazione (n > π > σ), stabilità dello ione prodotto come fattore principale (condivisione di elettroni, risonanza, ioni distonici), **regola di Stevenson(-Audier)** e perdita del radicale alchilico più grande, prodotti neutri stabili (H2, CH4, H2O, C2H4, CO, NO, CH3OH, H2S, HCl, CH2=C=O, CO2), ionizzazione σ, **scissione α (sito radicalico)** con l'ordine di tendenza N > S, O, π, R• > Cl, Br > H, **scissione induttiva (sito di carica)**, regole sul numero di legami rotti (una rottura da OE → EE + radicale; due rotture → OE + molecola: riarrangiamenti e anelli), **regola degli elettroni pari**, **McLafferty** (γ-H, sei atomi, distanze e geometria), **retro-Diels-Alder**, eliminazioni di H2O/HCl/H2S, rottura con formazione di un nuovo legame (alogenuri e tioli: ioni ciclici), **tropilio**, effetto orto. Ogni meccanismo: un disegno, un esempio con lo spettro vero, «come lo riconosci» (quale picco, quale Δm, OE o EE).
7. **Serie di ioni e perdite piccole**: la serie alchilica come «righello» (15, 29, 43… e poi 113, 127, 141… e 211, 225, 239…), la stima «m/z / 14 ≈ numero di C+N+O» (aggiungendo 2×RDB), le serie dell'Allegato B.2, la serie aromatica e quella «alta» degli eterociclici (40, 53, 66, 79), effetto degli alogeni sulle serie; il caso **43 = C3H7+ oppure C2H3O+** (a risoluzione unitaria si decide dal contesto e da (44)/(43); ad alta risoluzione Δ = 0,0364: rimando al cap. 9). Perdite dallo ione molecolare: tabella dell'Allegato B.3, collegata alla scheda «Perdite neutre» del programma (`perdite.js`).
8. **Proporre e verificare la struttura** (passi 3-4): aspetto generale dello spettro (molecola stabile e pochi picchi, «staccionata» degli alcani), ioni caratteristici (30 ammine, 77 fenile, 91 benzile/tropilio, 105 benzoile, 149 ftalati), confronto con lo spettro di riferimento e con isomeri; **i limiti dell'EI** (orto/meta/para quasi uguali, stereoisomeri indistinguibili: Mikaia 2022, «blind spots» di McLafferty) e quindi che cosa si può dire con certezza e che cosa no.
9. **Due esempi svolti e uno a metà**: 2-esanone (svolto, ogni passo con il numero), trietilammina o dietil etere (svolto, eteroatomo e α), butirrofenone (a metà: passi 1-2 svolti, 3-4 come domande con risposta nascosta). Spettri dai dati del gioco (`palestra/ei-dati.js`, G1) disegnati con la funzione del gioco; se G1 non è ancora in `main`, segnaposto e TODO nello Stato.
10. **«All'orale»** (riquadro finale e pagina stampabile): il copione per risolvere uno spettro a voce in 10-15 minuti, cioè l'ordine delle cose da dire (ione molecolare e perché; isotopi ed elementi; formula, RDB, regola dell'azoto; ioni importanti e serie; perdite da M; due o tre meccanismi con le frecce; struttura proposta; che cosa la conferma e che cosa resta incerto), i 10 errori più frequenti (Allegato A.4 + quelli del passo 4) e una lista di controllo da tenere accanto quando si fa pratica. **Chiedi a Federico** (nel messaggio di fine blocco) come si svolge esattamente l'orale (spettro su carta o a schermo? tabella dei picchi o solo grafico? con la formula data o no? quanto tempo?) e adatta il copione, il foglio di lavoro e la «Modalità orale» del gioco (G2).

**Cap. 14 `14-ei-famiglie.html`: le famiglie di composti in EI**
Una sezione per famiglia, sempre con la stessa struttura: **firma** (abbondanza di M, ioni diagnostici e perdite tipiche, con il meccanismo che li genera), **uno spettro vero** (MassBank, da `ei-dati.js`), **come la riconosci in 10 secondi**, **trappole** (con chi si confonde), link alla Palestra filtrata su quella famiglia. Ordine (lo stesso di McLafferty cap. 3 e di Mikaia 2022): alcani lineari e ramificati; alcheni e cicloalcani; aromatici (alchilbenzeni, tropilio); alcoli; eteri; aldeidi e chetoni (α e McLafferty); acidi ed esteri (McLafferty 60/74/88, perdite di OR); ammine e ammidi (α, iminio 30/44/58, regola dell'azoto); tioli e solfuri (34S); alogenuri (cluster, perdita di X e HX, ioni ciclici); nitrili e nitrocomposti (M−NO, M−NO2); fenoli e aniline (M−CO, M−HCN); composti di interesse ambientale (clorobenzeni e clorofenoli, IPA, ftalati, organoclorurati: il ponte con il corso di inquinanti). In fondo una **tabella riassuntiva** famiglia → ioni diagnostici (da stampare) e le **coppie di isomeri** che insegnano a guardare i dettagli: 3-pentanone / 3-metil-2-butanone, butilammina / sec-butilammina / terz-butilammina / isobutilammina / dietilammina (C4H11N), 1-propanolo / 2-propanolo, 1,2- / 1,3- / 1,4-diclorobenzene (quasi uguali: il limite dell'EI), 2-metilpentano / 2,2-dimetilbutano / esano.
- Test: pytest che controlla con `elements.py` le masse nominali e la parità (OE/EE) di ogni ione scritto nelle tabelle dei capp. 13-14 (stesso meccanismo di T1) e che ogni spettro citato esista in `ei-dati.js`.

## T3: i capitoli esistenti con bassa e alta risoluzione
Interventi mirati, non riscritture:
- `01-tp.html`: livelli di Schymanski (2014) letti con i due tipi di dato (a risoluzione unitaria si arriva di solito a «candidato», livello 4-5, salvo standard; con HRMS e MS2 a 3-2); un riquadro `duo`.
- `08-qqq.html`, `12-frammentazione-cid.html`: un riquadro `duo` su MS2 (CE in eV contro NCE; frammenti con formula in alta risoluzione); in `12` il richiamo «EI: vedi capp. 13-14» e la tabella ioni a elettroni pari contro dispari.
- `10-dati.html`: XIC a finestra unitaria contro XIC in ppm (con i numeri di `AGENTS.md` sez. 12 e 21); punti per picco contro risoluzione (Orbitrap).
- `15-origine.html`: che cosa aggiunge l'alta risoluzione al riconoscimento dei frammenti in sorgente (formula del frammento compatibile con la madre).
- `16-strategia.html`: il flusso in due colonne (suspect/non-target in alta risoluzione: Krauss 2010, Hollender 2017; la vostra strategia a risoluzione unitaria).
- Ogni capitolo: blocco `.obj` in cima, almeno un `poe` prima delle figure interattive esistenti, `box gym` dove c'è un gioco collegato, `box app` per il «nel programma».

## T4: glossario e bibliografia
- Glossario: voci nuove (EI, CI, ione a elettroni pari/dispari, scissione α, scissione induttiva, regola di Stevenson, riarrangiamento di McLafferty, retro-Diels-Alder, tropilio, serie di ioni, RDB, regola dell'azoto, potere risolutivo, FWHM, accuratezza di massa, ppm, difetto di massa, Kendrick, struttura fine isotopica, transiente, TOF, Orbitrap, NCE, DDA, DIA, libreria di spettri). Prima leggi come `tools/genera_glossario.py` costruisce `glossario-dati.js` e segui quello.
- Bibliografia: aggiungi i riferimenti dell'Allegato A/B **solo quelli con DOI** (sono verificati), divisi in «Didattica della spettrometria di massa» (sezione nuova), «Alta risoluzione», «Ionizzazione elettronica». Il materiale del corso resta in fondo.

## T5: il percorso dell'esperienza 3 (prima, durante, dopo)
Nella pagina `index.html` della Teoria, sezione nuova «Il percorso dell'esperienza» (e un riquadro nel capitolo «Come si usa»): una tabella in tre colonne, con link a capitoli, figure e giochi.
- **Prima del laboratorio** (aula capovolta): capp. 1, 2, 4, 7, 8 + Palestra: «Carte dello strumento», «Pilota il quadrupolo», «Isotopi» (livello 1). Domanda guida: «Che cosa vedrà il QqQ del nostro inquinante e dei suoi TP?».
- **G1** (fotocatalisi e standard; scelta delle transizioni): cap. 8 «MRM in dettaglio» + gioco «Caccia alla transizione» su un composto di libreria (mai il composto dell'esperienza).
- **G2** (taratura MRM, quantificazione, full scan dei campioni): capp. 10, 11, 16; nel programma XIC, integrazioni, Excel.
- **G3** (MS2 sugli intermedi): capp. 12, 15; Palestra «Perdite neutre».
- **Dopo** (relazione): checklist del cap. 16; due domande di confronto: «Che cosa cambierebbe con un Orbitrap?» (file di esempio ad alta risoluzione, H0) e «E se l'analisi fosse in GC-EI?» (capp. 5, 13 e 14, gioco EI).
Testo breve: è una mappa, non un nuovo capitolo.

## T6: chiusura della Teoria
`LEGGIMI.md` aggiornato (tabella dei file nuova, blocchi nuovi, parti del menu, ancore usate dalla Palestra); `AGENTS.md` sez. 3 righe di `teoria/`; verifica completa; screenshot di un capitolo per tipo nel messaggio a Federico.

---

# PARTE G: la Palestra e il gioco «Dallo spettro alla struttura» (sessione G)

## G0: la Palestra (vista, motore comune, progressi)
- **Vista**: quarto pulsante nella barra `#nav` di `index.html` («Palestra», `data-v="gym"`), `<section id="v-gym" hidden>`; caricata alla prima apertura come la Teoria (`applyView`). Codice in `qqq_lab/web/palestra/` (nuova): `palestra.js` (modulo ES, `import * as OCL from "../vendor/openchemlib.js"` come `draw.js`), `palestra.css`, un file per gioco `giochi-<id>.js`, dati in file `.js` (come `glossario-dati.js`: funzionano anche da `file://`). Il sito copia la cartella da solo? Controlla `tools/build_site.py` (che cosa copia di `web/`) e aggiungi ciò che serve; `sw.js`: i file nuovi entrano nella cache dell'app.
- **Pagina iniziale della Palestra**: schede dei giochi (icona, titolo, una riga, livello consigliato, collegamento al capitolo), la **mappa delle competenze** (sotto) e «Riprendi». Niente classifica.
- **Interfaccia comune** `window.PAL`:
  - `PAL.register({id, title, icon, skills:[…], chapter:"13-ei-metodo.html#…", open(el, ctx)})`; `ctx` offre `score`, `hint`, `done`, `rng` (casuale con seme), `spec` (disegno di uno spettro a bastoncini su canvas, nitido con `devicePixelRatio`, con clic sui picchi), `ketcher()` (vedi G2), `iso(formula)` (profilo isotopico: riusa `QQQRef.isoPattern`, che sta in `tables.js`), `mass(formula)`.
  - **Punteggio per problema**: si parte da 100 «punti risorsa»; ogni suggerimento e ogni dato in più si «compra» (idea di iSpec, Vosegaard 2018); un errore costa poco (5), l'abbandono mostra la soluzione e vale 0. Il punteggio è informazione per lo studente, non un voto.
  - **Suggerimenti a tre livelli** (come Hydragen, Windle et al. 2025): 1 = dove guardare («guarda la differenza fra i due picchi più a destra»), 2 = il concetto con link all'ancora della Teoria, 3 = il passo svolto. Costi 5/10/20.
  - **Livello per competenza (Elo, Pelánek 2016)**: per ogni competenza θ (iniziale 0) e per ogni problema una difficoltà d (iniziale dal livello 1-4 scritto nei dati: −1, 0, 1, 2); p = 1/(1+e^(−(θ−d))); dopo il problema, con s = punteggio/100: θ += K·(s − p), d −= K·(s − p) (d solo in locale), K = 0,4/(1 + 0,05·n) con n = problemi già fatti in quella competenza. **Scelta del problema successivo**: quello con p più vicino a 0,7 fra i non fatti (né troppo facile né impossibile), con i problemi sbagliati che tornano dopo 1, 3 e 7 giorni (ripetizione distanziata: Kang 2016; Roediger & Karpicke 2006). Funzioni pure in `palestra/motore.js` (script classico con `module.exports` in fondo, come `calcola.js`) provate da node in `tests/test_palestra.py`.
  - **Competenze** (le stesse dei passi di McLafferty, più quelle degli altri giochi): `M` (ione molecolare), `iso` (isotopi), `formula` (formula, RDB, regola dell'azoto), `serie` (serie di ioni), `perdite`, `meccanismi`, `struttura`, `hr` (massa esatta, ppm), `strumento`, `quad`, `mrm`.
  - **Mappa delle competenze**: una barra per competenza (livello come aggettivo: «da scoprire», «in crescita», «solida», «esperta»), non numeri Elo. Distintivi solo di padronanza (es. «Cinque McLafferty riconosciute»), mai di velocità o di presenza quotidiana (la letteratura su classifiche e confronto sociale è negativa: Hanus & Fox 2015; Sailer & Homner 2020 trovano effetti positivi ma moderati e dipendenti dal disegno).
  - **Progressi** in `localStorage` chiave `qqq.palestra` (try/catch, come `qqq.prefs`), **«Copia i miei progressi»** (testo JSON breve, per chi vuole mandarlo al docente) e «Azzera». Nessun invio in rete.
  - **Sfida di classe senza server**: «Codice sfida» (es. `EI-4F7K`) = seme → stessi 5 problemi per tutti; alla fine un riassunto da copiare. Utile in aula, nessuna classifica automatica.
- Ricevitore dei link della Teoria: `message` con `{palestra: id}` dall'iframe `#tframe` → `setView("gym")` e apre quel gioco. Test che ogni `data-game` della Teoria esista in `PAL`.
- **Accessibilità**: tutto da tastiera (frecce sui picchi, Invio), colori dalla tavolozza dell'ingranaggio, testo con `fz()` se possibile.
- Test: `tests/test_palestra.py` (motore), `tests_e2e/e2e_palestra.py` (apre la vista, un gioco finto registrato dal test, punteggio, suggerimento, progressi salvati e ricaricati, codice sfida riproducibile, link dalla Teoria).

## G1: i dati EI (`tools/genera_ei.py` → `qqq_lab/web/palestra/ei-dati.js`)
- **Fonte**: MassBank Europe (Allegato C, verificata il 7/10/2026: API pubblica raggiungibile dal container). `GET https://massbank.eu/MassBank-api/records/search?compound_name=<NOME>&instrument_type=EI-B&limit=50` (la ricerca è per sottostringa e la ricerca per InChIKey nell'API non funziona: per ogni composto la lista dello strumento ha il nome inglese e qualche sinonimo nello stile di MassBank, es. «1-BROMOBUTANE» non c'è ma «BUTYL BROMIDE» sì, e l'InChIKey atteso; tieni solo i record in cui uno dei `compound.names` è uguale a un sinonimo, senza maiuscole, **e** l'InChIKey del record coincide) e `GET https://massbank.eu/MassBank-api/records/<ACCESSION>` (JSON: `compound.formula`, `compound.smiles`, `compound.inchi`, `compound.link` con `INCHIKEY`, `license`, `authors`, `acquisition.instrument`, `peak.peak.values[{mz, intensity, rel}]`). Lo strumento lo lancia lo sviluppatore (serve la rete); il risultato si committa; il programma non chiama mai MassBank.
- **Più spettri per composto** (il set EI-B ne ha spesso 3-10, da strumenti diversi: per il 2-esanone M+• va da 2% a 14%): scegli lo spettro **più rappresentativo** = quello con il coseno medio più alto verso gli altri dello stesso composto (intensità alla radice, m/z intere); salva anche quanti erano e il coseno minimo/medio (un dato didattico: «gli spettri EI sono riproducibili ma non identici»; si può mostrare nel gioco come curiosità).
- **Formato** (`window.EI_DATA = {version, source, license_note, items:[…]}`), per voce: `id`, `name` (italiano, scritto a mano nella lista dello strumento), `name_en`, `smiles`, `inchikey`, `formula`, `M` (massa nominale), `peaks` ([[m/z intera, intensità relativa ‰]], tolti i picchi < 0,5% e accorpati quelli con la stessa m/z intera), `level` (1-4), `concepts` (es. `["mclafferty","alpha","acilio"]`), `keys` (vedi sotto), `src` (`accession`, `authors`, `license`, `instrument`, `n_spectra`, `cos_mean`).
- **`keys`** = le «chiavi» didattiche del composto, scritte da te nella lista dello strumento (non scaricate): 3-6 ioni con `mz`, `ion` (formula dello ione con la carica, es. `"C3H6O+."` per un radicale catione, `"C2H3O+"`), `type` (`M`, `alpha`, `i`, `mclafferty`, `rda`, `tropilio`, `serie`, `perdita`, `isotopo`), `text` (una frase italiana) e `anchor` (ancora dei capp. 13-14). **Controllo automatico in pytest** (obbligatorio, è la difesa contro errori di chimica): per ogni chiave la massa nominale dello ione (da `elements.py`, togliendo la massa dell'elettrone non serve a risoluzione unitaria) = `mz`; la parità dell'ione (RDB intero ↔ `+.`) coerente con il tipo (M e McLafferty e RDA = elettroni dispari; alpha, i, tropilio, acilio = pari); il picco esiste nello spettro sopra l'1%; la formula dello ione è un sottoinsieme della formula del composto (più al massimo un H per i riarrangiamenti con trasferimento di idrogeno). Le frasi `text` con `// da verificare sul McLafferty` finché Federico non le controlla.
- **Lista iniziale** (Allegato C.2): **circa 90 composti**, organizzati per famiglia (le stesse del cap. 14) e per livello, **almeno 4 per famiglia** (servono per la pratica alternata e perché all'orale arriva una famiglia qualsiasi), più le coppie e i gruppi di isomeri. Se un composto non c'è o ha spettri pessimi, sostituiscilo con uno della stessa famiglia e scrivilo nel messaggio.
- **Alta risoluzione (facoltativo, dopo il resto)**: la libreria RECETOX Exposome HR-[EI+]-MS (Price et al. 2021: oltre 350 contaminanti ambientali, GC-Orbitrap a 60 000, formule dei frammenti annotate; Zenodo doi:10.5281/zenodo.4471217; licenza dichiarata CC BY-NC, **da verificare** sul record Zenodo prima di usarla) permette un livello 5 «EI ad alta risoluzione»: stesso gioco, ma i frammenti hanno massa esatta e lo studente controlla le formule in ppm. Stesse esclusioni (inquinanti dei metodi).
- **Esclusioni**: inquinanti dei metodi del laboratorio (per InChIKey, vedi Regole fisse); derivati TMS/TBDMS (il gioco riguarda molecole come sono).
- **Licenze**: il set EI-B di MassBank è quasi tutto **CC BY-NC-SA** (autori: Univ. Tokyo / UOEH): va bene per un sito didattico non commerciale, a patto di (1) citare autori e numero di accesso per ogni spettro (visibile nel gioco: «Spettro: MassBank MSBNK-…, autori, licenza»), (2) dire che il file `ei-dati.js` è sotto CC BY-NC-SA 4.0 (non MIT), con una riga in testa al file, in `LICENZE-TERZI.md` e nel README, (3) non usarlo per scopi commerciali. Se un record ha una licenza diversa, lo strumento la copia; se non ha licenza, lo scarta.
- **Libreria di confronto** (per il passo 8 di McLafferty, «confronta con uno spettro di riferimento»): con l'opzione `--riferimenti` lo strumento scrive anche `palestra/ei-rif.js` con lo spettro rappresentativo (solo m/z e intensità ≥ 1%, `name_en`, `inchikey`, `formula`, `src`) di un insieme più ampio di composti semplici (C ≤ 12, solo C H N O S Cl Br F, senza derivati; tetto 3 MB): così, quando lo studente propone un isomero, il gioco può mostrargli lo spettro **della sua proposta** se esiste. Se la dimensione esplode, tieni solo gli isomeri (stessa formula) dei composti del gioco.
- Test: `tests/test_ei_dati.py` (formato, chiavi come sopra, licenze presenti, nessun InChIKey escluso, nessun riferimento a NIST, dimensione dei file).

## G2: il gioco «Dallo spettro alla struttura» (`giochi-ei.js`)
**Idea**: lo studente ha davanti uno spettro EI vero e ricostruisce la struttura seguendo i passi del procedimento di McLafferty (cap. 13). Nei livelli bassi i passi sono guidati e obbligatori (esempio svolto che sfuma); nei livelli alti si può andare dritti alla struttura. Il gioco controlla le risposte (sono composti di libreria) e spiega.
**Schermo**: a sinistra lo spettro (bastoncini, etichette m/z sui picchi principali, clic = seleziona un picco, Maiusc+clic = secondo picco → mostra la differenza Δm), sotto la «scheda di lavoro» con i passi; a destra l'editor di strutture (Ketcher) nei passi che lo usano. In alto: nome del livello, punti risorsa, suggerimenti, «Abbandona».
**Passi** (ogni passo dà punti alla sua competenza; nei livelli 1-2 sono in sequenza, nel 3 facoltativi, nel 4 nascosti):
1. **Ione molecolare** (`M`): clic sul picco che lo studente crede M, oppure «M non è visibile». Correzione con i tre test: se sceglie un picco con una perdita impossibile verso un picco più alto, o un picco di fondo, il messaggio dice quale test fallisce (testi in `palestra/testi-ei.js`). Dato acquistabile: «spettro CI» (simulato: solo [M+H]+ ≈ M+1 e un addotto, scritto dai dati), costo 15.
2. **Isotopi ed elementi** (`iso`): tre contatori (Cl, Br, S; Si nei livelli alti) e il numero di C stimato da M+1; il gioco disegna sopra lo spettro il profilo isotopico della proposta (cerchi, come il profilo isotopico del programma) e dice quanto si accorda (scarto medio sui picchi M, M+1, M+2). Dato acquistabile: «massa esatta di M» (alta risoluzione simulata: massa vera + errore casuale entro ±2 ppm, mostrata con 4 decimali), costo 20: è il ponte con il cap. 11.
3. **Formula e RDB** (`formula`): lo studente scrive la formula (stesso parser delle formule del programma: `/api/formula` non c'è in Palestra senza dati aperti; usa `QQQRef`/`elements.js` lato JS o un piccolo parser in `motore.js` provato contro `elements.py`) e il valore di RDB; il gioco controlla massa nominale = M, regola dell'azoto, RDB, accordo isotopico; se la formula è giusta ma l'RDB è sbagliato lo dice.
4. **Ioni importanti e serie** (`serie`): lo studente segna i picchi importanti e assegna a ciascuno un'etichetta da una tavolozza (serie alchilica, alchenilica, acilio, aromatica, iminio, ossonio, perdita da M, isotopo). Il gioco confronta con le `keys` e con regole generali sui dati (es. serie aromatica: 39, 51, 65, 77 tutti sopra soglia). Le etichette giuste restano disegnate sullo spettro.
5. **Perdite neutre** (`perdite`): per una o due coppie (M e un frammento) lo studente sceglie la perdita da un menu (dati di `perdite.js` dove coincidono; perdite da M+• dell'Allegato B.3 per le altre); errore = spiegazione con la massa.
6. **Proponi la struttura** (`struttura`): disegno in Ketcher (iframe proprio della Palestra: stesso `vendor/ketcher/index.html` con `sandbox` come in `draw.js`; si prende il molfile con `getMolfile()` e si legge con `OCL.Molecule.fromMolfile`). Confronto con la soluzione: **identica** (idcode OpenChemLib senza stereochimica: `stripStereoInformation()` poi `getIDCode()`) → vittoria; **stessa formula, isomero diverso** → «È un isomero: la formula è giusta», somiglianza (Tanimoto degli indici di sottostruttura di OpenChemLib, se `SSSearcherWithIndex` lo offre: controlla con grep) come «fuoco/acqua» e, se la proposta è in `ei-rif.js`, **lo spettro della tua proposta a specchio sopra quello del problema** (il passo 8 di McLafferty: confronto con un riferimento); **formula diversa** → torna al passo 3.
7. **Spiega un frammento** (`meccanismi`, facoltativo, punti bonus): lo studente seleziona una parte della propria struttura in Ketcher (come la selezione del Disegno: pezzi connessi) e la assegna a un picco; il gioco calcola formula e massa del pezzo come catione (pari) e come radicale catione, con ±1 H per i riarrangiamenti, e dice se torna con il picco e con quale tipo di ione. È un controllo di coerenza dell'ipotesi dello studente, non una risposta.
**Fine del problema**: riepilogo con le `keys` (frase + link alla sezione dei capp. 13-14), punti per passo, fonte dello spettro con licenza, «Problema simile» (stesso concetto) e «Problema nuovo» (scelta Elo).
**Livelli**: 1 «Guidato» (composti con un solo concetto, passi obbligatori, primo problema = esempio svolto da leggere e ripetere), 2 «Con l'aiuto» (passi in sequenza, suggerimenti più cari), 3 «Da solo» (passi facoltativi, si può proporre subito la struttura), 4 «Esperto» (solo spettro ed editor; la massa esatta non si compra). **Sfida a tempo** facoltativa (solo dal livello 3, un orologio visibile ma nessuna penalità oltre ai punti).
**Verso l'orale: dall'aiuto all'autonomia** (è lo scopo principale del gioco):
- **«Modalità orale»** (dal livello 3, sbloccata dopo almeno 10 problemi): niente suggerimenti, niente dati da comprare, niente correzione passo per passo. Lo spettro si presenta **come all'esame** (grafico + tabella dei picchi principali, stesse convenzioni del foglio d'esame che Federico indicherà: vedi T2 punto 10). Lo studente compila la scheda di lavoro **scrivendo il ragionamento** in un campo di testo per passo (numero del passo + affermazione, come nel copione del cap. 13: «spiegalo come lo diresti all'orale») e propone la struttura; un orologio facoltativo (15 minuti, modificabile). Solo alla fine il gioco mostra la soluzione commentata passo per passo accanto a ciò che ha scritto lo studente, e una **autovalutazione guidata** (per ogni passo: «l'avevo detto / in parte / no»): la scrittura del ragionamento e il confronto con l'esempio esperto sono l'auto-spiegazione che la letteratura indica come efficace (Allegato A.3).
- **Foglio di lavoro stampabile** (`@media print`): lo spettro con la tabella dei picchi e la scheda dei passi in una pagina A4, per esercitarsi su carta come all'esame; pulsante «Stampa questo problema» (senza soluzione) e «Stampa la soluzione».
- **Pratica alternata e distanziata**: dopo i primi due livelli il problema successivo viene da una famiglia diversa da quella appena fatta (salvo «Allenati su una famiglia»); le famiglie sbagliate tornano più spesso.
- **Indicatore «Pronto per l'orale»** (non è un voto, è un'indicazione per lo studente): almeno 3 problemi di fila risolti in Modalità orale, di famiglie diverse, con struttura giusta e passi 1-3 corretti, e almeno una volta ogni famiglia del cap. 14 risolta nei livelli 2-3. La mappa delle competenze mostra che cosa manca («ti mancano: ammine, alogenuri»).
- **Errori tipici riconosciuti** (messaggi specifici, `palestra/testi-ei.js`): M scelto su un picco di fondo, su M−1 o sul picco base; Cl/Br scambiati; regola dell'azoto applicata al contrario; formula con RDB non intero per M; ione OE assegnato a una semplice scissione; frammento con formula non contenuta in M.
- **Allenati su una famiglia**: dalla pagina del gioco e da ogni sezione del cap. 14 (link `box gym` con `data-game="ei"` e `data-family`).

Test: node per le funzioni pure (accordo isotopico, controllo della formula, RDB, regola dell'azoto, punteggio, frammento → massa); `tests_e2e/e2e_palestra_ei.py`: un problema di livello 1 giocato tutto con le risposte giuste (la struttura si carica in Ketcher con lo SMILES della soluzione) e uno con un isomero (messaggio «isomero» e specchio se il riferimento c'è).

## G3: chiusura della parte G
`AGENTS.md` sezione «Palestra» (vista, `PAL`, motore Elo e ripetizione distanziata, dati EI e licenze, come rigenerare i dati, come aggiungere un gioco o un composto); README: riga «Palestra» nell'elenco delle schede e licenza dei dati EI; `LICENZE-TERZI.md`; verifica completa; screenshot del gioco EI per Federico.

---

# PARTE H: gli altri giochi e i file di esempio ad alta risoluzione (sessione H)

## H0: file di esempio «gemelli» a bassa e alta risoluzione (subito)
Per far vedere la differenza sullo **stesso campione**: un esperimento sintetico di degradazione **dell'atrazina** (esempio della Teoria; mai un inquinante dei metodi) scritto **due volte** dalla stessa «verità»: (a) come il QqQ del laboratorio (risoluzione unitaria, scostamento +0,3, centroidi), (b) come un Orbitrap (5 ppm, DDA). TP veri e noti dell'atrazina (desetil-, desisopropil-, idrossi-atrazina; formule e masse da `formula_mz`), più una **coppia isobara** costruita apposta (stessa massa nominale, formule diverse, tempi di ritenzione vicini) e un frammento in sorgente. Usa i generatori che ci sono (`tools/dati_sintetici.py`: `full_scan`, `hr_dda`) senza cambiarne il comportamento per i test esistenti. File in `qqq_lab/web/esempi/` con nomi `Simulato_Atrazina_QqQ_t*.mzML` e `Simulato_Atrazina_Orbitrap_t*.mzML` (piccoli: < 2 MB l'uno) e un `LEGGIMI.txt` che dice che sono **simulati**. Nella schermata di caricamento, sotto «Prova con i file di esempio», un secondo pulsante «Confronta bassa e alta risoluzione (dati simulati)». Test: pytest (i file si aprono, profilo `LOW` e `hr`, la coppia isobara è un picco solo in bassa risoluzione e due in alta) + `e2e_esempi.py` esteso. **Attenzione**: questo è l'unico punto di H che tocca la schermata di caricamento; se S4 del prompt 4 ci sta lavorando, `git merge origin/main` prima.

## H1: «Che cosa ha perso?» (perdite neutre, `giochi-perdite.js`; competenza `perdite`)
Domande rapide (10 per partita): due picchi (da spettri EI di `ei-dati.js` o da MS2 sintetiche a elettroni pari), scegli la perdita fra 4. Modalità «risoluzione unitaria» (28 = CO o C2H4 o N2: tutte giuste se coerenti con la formula del composto, il gioco lo spiega) e «alta risoluzione» (Δm con 4 decimali: una sola giusta). Dati da `perdite.js` (`LOSSES`) e dall'Allegato B.3. Ripetizione distanziata delle perdite sbagliate.

## H2: «Indovina gli alogeni» e «Formula esatta» (`giochi-isotopi.js`, `giochi-formula.js`; competenze `iso`, `hr`)
- **Isotopi**: un gruppo isotopico (vero, da `ei-dati.js`, o calcolato con `isoPattern` con un po' di rumore) → quanti Cl, Br, S? Livello alto: anche il numero di C da M+1, e la versione ad alta risoluzione con la struttura fine (34S separato da 13C2).
- **Formula esatta** (alta risoluzione): m/z misurata (con errore in ppm noto), rapporto M+1/M, polarità e addotto → scegli la formula fra 3-5 candidate (le candidate le prepara il gioco da composti di libreria, non da un generatore aperto); dopo la risposta il gioco mostra l'errore in ppm di ogni candidata e quante formule ci sarebbero entro 5 ppm e a risoluzione unitaria (stessa funzione `countFormulas` di T1). Collegamento: cap. 11.

## H3: «Carte dello strumento» (`giochi-carte.js`; competenza `strumento`)
Ispirato a **MS Cards** (Salvador, Masclaux, Danjou 2026, preprint ChemRxiv: un gioco di carte che collega componenti dello strumento, proprietà, tipi di molecole e modi di acquisizione). Qui: un **compito** (es. «quantificare un pesticida a ng/L in acqua», «identificare un TP sconosciuto», «un solvente volatile nell'aria», «una proteina intera», «il nostro esperimento G1») e un mazzo di carte in quattro colori: sorgente (EI, CI, ESI, APCI, MALDI), analizzatore (Q, QqQ, trappola, TOF, Q-TOF, Orbitrap), modo (full scan, SIM, MRM, product ion, precursor ion, neutral loss, DDA, DIA), introduzione (GC, LC, infusione). Lo studente compone la combinazione; ogni scelta ha un commento (perché sì, perché no); più combinazioni possono essere valide (punteggio pieno a tutte quelle accettabili, scritte nei dati). Ogni carta, girata, mostra una frase e il link al capitolo («apri la scatola nera»).

## H4: «Pilota il quadrupolo» (`giochi-quad.js`; competenza `quad`)
Usa la matematica di `teoria/sim-quad.js` (diagramma di stabilità di Mathieu; **riusa** le sue funzioni: se non sono esportabili, spostale in un file comune `teoria/mathieu.js` caricato da entrambi, con un test che le prove danno lo stesso risultato). Compito: far passare un bersaglio (es. m/z 216) e respingere i vicini (215, 217 o un interferente) scegliendo U e V (o la retta di scansione); punteggio = trasmissione del bersaglio × reiezione dei vicini; vista del diagramma con i tre ioni come punti e le traiettorie. Livello 2: «solo RF» (cella di collisione: perché trasmette tutto). Collegamento: cap. 7 (ispirazione: Henchman & Steel 1998; Do 2026).

## H5: «Caccia alla transizione» (`giochi-mrm.js`; competenza `mrm`)
Da uno spettro MS2 sintetico di un composto **di libreria** (atrazina e 3-4 altri, MS2 inventate ma coerenti, frammenti con formula controllata da pytest) a tre energie di collisione: scegli quantificatore, qualificatore e CE; punteggio su intensità, specificità (un frammento troppo comune come 43 o una perdita d'acqua vale meno; un interferente co-eluente con gli stessi ioni fa perdere punti) e rapporto ionico. Collegamento: cap. 8 «MRM in dettaglio» e G1 dell'esperienza (Betts & Palkendo 2018 come esempio di esercitazione sullo sviluppo di un metodo MRM).

Chiusura di H: giochi in `AGENTS.md` (sezione Palestra), un e2e per gioco (`e2e_palestra_<id>.py`, o uno solo con più parti), verifica completa.

---

## Decisioni (prese in questa ricerca; Federico può cambiarle prima di lanciare)
- **La Palestra corregge, il programma no.** I giochi lavorano solo su composti di libreria con soluzione nota e non leggono mai i file caricati. Nessun gioco usa i composti dei metodi del laboratorio.
- **Niente generatore di formule.** La figura `sim-formule` e la «Formula esatta» mostrano *quante* formule cadono in una tolleranza (il punto didattico), mai l'elenco per una massa scritta dallo studente; le candidate della «Formula esatta» vengono dai dati del gioco.
- **Niente classifiche, niente rete.** Progressi locali; sfide di classe con un codice; «Copia i miei progressi» per chi vuole.
- **Dati EI**: MassBank Europe (CC BY-NC-SA per il set EI-B), uno spettro rappresentativo per composto, citato con accesso, autori e licenza; niente NIST.
- **Spettri EI a risoluzione unitaria** (sono così nelle librerie): l'alta risoluzione entra nel gioco EI solo come «massa esatta di M» acquistabile (simulata dalla formula vera).
- **Nomi dei capitoli e file rinominati** come nella tabella di T0, con i file vecchi lasciati come rimando.

## Chiusura (ogni sessione, alla fine dei suoi blocchi)
`python3 tools/verifica.py` completo. Messaggio finale a Federico: una riga per blocco e **prove a mano** con Cmd+Shift+R sul sito: Teoria (menu a parti, un capitolo nuovo per tipo, riquadri bassa/alta risoluzione nel tema chiaro e scuro, figure nuove, link vecchi che rimandano), Palestra (un problema EI per livello, suggerimenti, «isomero» con lo specchio, progressi dopo il ricaricamento, codice sfida su due browser), file gemelli ad alta e bassa risoluzione, ogni gioco di H. Per Federico, a mano: **controllare sul McLafferty le frasi marcate `da verificare`** (meccanismi, ordini di tendenza) e i nomi italiani dei composti. Aggiorna `AGENTS.md` e cancella da questo file ciò che è fatto.

## Lavori in coda (NON fare: decisioni di Federico)
- **Valutazione per una pubblicazione** (J. Chem. Educ. pubblica lavori come questo: Hydragen, MS Cards, iSpec): test breve prima/dopo (10 domande di concetto, una per competenza) e questionario sulla motivazione (IMI, autodeterminazione: Ryan & Deci) somministrati in aula, anonimi, con consenso; i dati della Palestra restano dello studente («Copia i miei progressi» volontario). Serve il parere del comitato etico dell'ateneo prima di raccogliere dati.
- **Escape room dell'esperienza** (ispirata a Vergne 2019, Mahomed 2024): una storia che collega i giochi (strumento → isotopi → EI → MRM) con un codice finale; dopo che i giochi singoli sono provati in aula.
- **Missioni durante il laboratorio dentro la vista Dati** (domande guida per G1-G3 senza soluzioni, con risposta libera salvata nel taccuino); eventuale sblocco delle soluzioni da parte del docente con un codice: va contro il principio 1 se fatto male, decide Federico.
- Gioco «Dallo spettro alla struttura» anche in **ESI-MS2** (ioni a elettroni pari, cap. 12) quando ci saranno MS2 libere di buona qualità (MassBank ha record LC-ESI-MS2 con licenze CC BY): stesso motore.
- **Spettri degli orali degli anni passati** (Federico): se esistono, metterli nel repository **privato** `QqQ-lab-dati/EI_orale/` (spettro + soluzione) per tarare livelli e Modalità orale sugli spettri veri dell'esame; nel sito pubblico solo se Federico li ha acquisiti lui o ne ha i diritti.
- Spettri EI acquisiti da Federico sul GC-MS del dipartimento (nessun problema di licenza): da aggiungere a `ei-dati.js` con `src.accession = "UniTO-…"`.

---

# Allegato A: sintesi della ricerca sulla didattica (per chi scrive testi e giochi)

## A.1 Il problema
La spettrometria di massa è multidisciplinare e lo strumento è una «scatola nera»: gli studenti imparano a usare il software senza capire la fisica, e l'interpretazione degli spettri richiede tanta pratica con riscontro, difficile da dare a una classe intera (Frański 2024, rassegna su European Journal of Mass Spectrometry; Joyner 2022, JASMS: distinguere *abilità* e *concetti* da insegnare; Worrall et al. 2024: insegnamento a spirale nei tre anni). Gli errori degli studenti sono documentati: per esempio scambiare il picco di fondo a m/z più alta per lo ione molecolare, o un M−1 intenso per M (lavoro di laboratorio «Finding the molecular ion», J. Chem. Educ., citato dalla ricerca: non verificato per esteso).

## A.2 Quattro approcci con riscontro in letteratura (verificati sulle fonti: titoli e abstract)
1. **Modelli interattivi della dinamica degli ioni.** Do (2026, J. Chem. Educ. 103, 4989-4997): tre notebook Colab nel browser (filtro a quadrupolo, guide di ioni multipolari RF, analizzatore di tipo Orbitrap) che collegano le equazioni al moto osservabile degli ioni, per passare da una competenza procedurale a una comprensione fisica; usati in un corso *di dottorato/laurea magistrale* (graduate) a Knoxville. Nota: il lavoro descrive il materiale e la sua adozione; **non riporta un confronto controllato dell'apprendimento**. Precedenti: Henchman & Steel 1998 (simulazione del filtro a quadrupolo), Leary & Schmidt 1996, Marty 2013 e Fulmer 2024 (TOF in LabVIEW, TOFSim).
2. **Strumentazione modulare.** Diao et al. 2025 (J. Chem. Educ. 102, 2137-2143): uno spettrometro modulare per esperimenti progettati dagli studenti; Diao et al. 2026 (103, 1013-1021): energia di legame con uno strumento didattico. Senza hardware, l'equivalente per noi è virtuale: lo strumento «esploso» nelle figure e nelle «Carte dello strumento».
3. **Piattaforme adattive.** Hydragen (Windle, Kim, Han, Ong, Fung 2025, J. Chem. Educ. 102, 4479-4488): domande a scelta multipla personalizzate, difficoltà adattata con il sistema **Elo**, suggerimenti interattivi in tempo reale e riscontro mirato sull'interpretazione degli spettri e sui frammenti caratteristici; usata con universitari e studenti delle superiori. Risultato dichiarato: **migliore preparazione e coinvolgimento percepiti** (non misure di apprendimento). Base teorica dell'Elo in educazione: Pelánek 2016 (Computers & Education 98, 169-179).
4. **Gioco.** **MS Cards** (Salvador, Masclaux, Danjou 2026, preprint ChemRxiv, doi:10.26434/chemrxiv.15005751/v1): gioco di carte per **la strumentazione** (componenti, proprietà, molecole bersaglio, modi di acquisizione); provato in due università; questionari con alta approvazione. **Correzione rispetto al testo che circolava**: MS Cards non riguarda le regole di frammentazione. Per la struttura dagli spettri i modelli più vicini sono NMR-Challenge.com (Socha et al. 2023: spettri veri, disegno della struttura, riscontro immediato), iSpec (Vosegaard 2018: ogni dato costa «punti risorsa»), The Spectral Game (Bradley et al. 2009: dati aperti, difficoltà crescente), il torneo di spettroscopia (Hapiot et al. 2025) e le escape room (Vergne 2019; Mahomed 2024 con una stazione di MS). Non ho trovato studi controllati che misurino l'effetto di un gioco sulla frammentazione: c'è spazio per un contributo originale (vedi «Lavori in coda»).
Il consenso, in sintesi: meno addestramento procedurale, più modello fisico (scomporre lo strumento, anche virtualmente) e pratica iterativa con riscontro personalizzato per l'interpretazione.

## A.3 Principi dalla psicologia dell'apprendimento usati nel progetto
- **Pratica di recupero con riscontro** (Roediger & Karpicke 2006) e **ripetizione distanziata** (Kang 2016) → giochi brevi ripetuti, problemi sbagliati che tornano dopo 1-3-7 giorni.
- **Pratica alternata** (Rohrer; Taylor & Rohrer 2010) → dopo i primi livelli i problemi mescolano classi di composti e concetti.
- **Esempi svolti e dissolvenza** (Atkinson, Renkl, Merrill 2003) → livelli 1-2 del gioco EI; esempio svolto e a metà nel cap. 13.
- **Fallimento produttivo** (Kapur 2016) → nel livello 3 si può tentare subito la struttura; l'errore apre la spiegazione.
- **Autodeterminazione** (Ryan & Deci): autonomia (scelta del gioco e del livello), competenza (difficoltà adatta, riscontro immediato, mappa delle competenze), relazione (sfide di classe) → niente classifiche: Hanus & Fox 2015 trovano meno motivazione intrinseca con classifiche e distintivi in aula; la meta-analisi di Sailer & Homner 2020 trova effetti positivi piccoli-medi, che dipendono dal disegno (meglio con finzione e collaborazione).
- **Simulazioni efficaci** (Wieman, Adams, Perkins 2008, PhET): impalcatura implicita, poche parole, risposta immediata, rappresentazioni collegate; **triangolo di Johnstone** (1991): macroscopico (strumento), submicroscopico (ioni), simbolico (spettro, equazioni).
- **Risolvere problemi di spettroscopia** (Cartrette & Bodner 2010; Topczewski et al. 2017, occhi degli studenti sugli spettri NMR; Winschel et al. 2015, spettroscopia a puzzle in gruppo): i principianti saltano i passi sistematici → il gioco EI rende visibili i passi di McLafferty.

## A.4 Errori frequenti da affrontare (riquadri `box warn` e messaggi dei giochi)
- Il picco a m/z più alta è sempre M (no: fondo, M non visibile, M−1).
- Il picco base è lo ione molecolare.
- m/z = massa (dimenticando z; ESI: [M+H]+ è M+1).
- Regola dell'azoto applicata a [M+H]+ come a M+• (la parità si inverte).
- Il picco M+1 è un'impurezza (è il 13C: ~1,1% per atomo di C).
- Risoluzione e accuratezza sono la stessa cosa.
- A risoluzione unitaria 28 «è» CO (può essere C2H4 o N2); 43 «è» acetile (può essere propile).
- I frammenti «sommano» a M (la parte neutra non si vede).
- Un'intensità più alta vuol dire più sostanza, anche fra composti diversi (l'efficienza di ionizzazione cambia).
- Un MS2 che somiglia identifica il composto (livelli di confidenza di Schymanski).
- NCE 30 = 30 eV.
- Il quadrupolo «pesa» gli ioni (è un filtro: cap. 7).

---

# Allegato B: l'EI secondo McLafferty e Tureček (traccia per i capp. 13-14 e il gioco)
Fonti lette il 7/10/2026 (il libro stesso non è consultabile legalmente online: su Internet Archive c'è solo la 3ª ed. del 1980 in prestito controllato; Federico ha la 4ª ed. nel materiale del corso): (1) le lezioni pubbliche CHEM-5181 di J.-L. Jimenez (University of Colorado Boulder, 2013, https://cires1.colorado.edu/jimenez/CHEM-5181/Lect/: `Interp1_Intro_Elem.pdf`, `Interp3_Molec_Ion.pdf`, `Interp4_Frag_Mech.pdf`, `Interp5_Molec_Struct.pdf`, `Ioniz1_EI.pdf`), che seguono il McLafferty capitolo per capitolo («Adapted from McLafferty & Tureček»), con i loro esercizi di gruppo; (2) il protocollo NIST di A. Mikaia (2022, J. Phys. Chem. Ref. Data 51, 031501), sezioni 1-2 (concetti generali) e indice delle famiglie. Ciò che segue è una sintesi con parole nostre: **numeri di pagina, tabelle A.4-A.7 del libro e frasi marcate vanno controllati sul libro**.

## B.1 Il procedimento standard di interpretazione (passi del gioco)
1. Raccogli tutte le informazioni (origine del campione, altri spettri); controlla le m/z.
2. Dagli isotopi deduci la composizione elementare dove si può: elementi «A+2» (O, Si, S, Cl, Br), «A+1» (C, N), «A» (H, F, P, I).
3. Calcola anelli + doppi legami.
4. Verifica lo ione molecolare: deve essere lo ione a massa più alta (del gruppo), a elettroni dispari, e dare perdite neutre logiche verso gli ioni importanti; se possibile conferma con una ionizzazione soffice (CI).
5. Segna gli ioni importanti: a elettroni dispari, i più abbondanti, quelli a massa più alta, i più alti di ogni gruppo.
6. Guarda l'aspetto generale dello spettro: stabilità della molecola (M intenso: aromatici, sistemi coniugati), legami deboli.
7. Proponi e assegna: (a) serie di ioni a bassa massa; (b) piccole perdite neutre da M+• e dagli ioni importanti; (c) ioni caratteristici; (d) ioni a elettroni dispari (riarrangiamenti).
8. Proponi la struttura e mettila alla prova: spettro di riferimento, spettri di composti simili, meccanismi attesi.

## B.2 Serie di ioni a bassa massa (risoluzione unitaria)
| Serie | Formula | m/z |
|---|---|---|
| alchilica | CnH2n+1+ | 15, 29, 43, 57, 71, 85, 99 |
| alchenilica / cicloalchilica | CnH2n−1+ | 27, 41, 55, 69, 83 |
| acilio | CnH2n−1O+ | 29 (CHO+), 43, 57, 71, 85 (stesse m/z della serie alchilica: a risoluzione unitaria si distingue solo dal contesto) |
| iminio (ammine) | CnH2n+2N+ | 30, 44, 58, 72, 86 |
| ossonio (alcoli, eteri) | CnH2n+1O+ | 31, 45, 59, 73, 87 |
| solfonio | CnH2n+1S+ | 47, 61, 75 |
| aromatica | | 39, 50-52, 63-65, 76-78; 77 (C6H5+), 91 (C7H7+, tropilio), 105 (C6H5CO+ o C8H9+) |
| ioni di McLafferty (elettroni dispari) | | 44 aldeidi, 58 2-alcanoni, 59 ammidi primarie, 60 acidi carbossilici, 74 esteri metilici, 88 esteri etilici |

## B.3 Perdite dallo ione molecolare (EI)
M−1 (H•), M−15 (CH3•), M−16 (O, NH2•), M−17 (OH•, NH3), M−18 (H2O), M−19 (F•), M−20 (HF), M−26 (C2H2), M−27 (HCN), M−28 (CO, C2H4, N2), M−29 (CHO•, C2H5•), M−30 (CH2O, NO), M−31 (CH3O•), M−32 (CH3OH, S), M−35/37 (Cl•), M−36 (HCl), M−42 (CH2=C=O, C3H6), M−43 (CH3CO•, C3H7•), M−44 (CO2), M−45 (C2H5O•, COOH•), M−46 (NO2•, C2H5OH), M−79/81 (Br•). Perdite **improbabili** (indicano che il candidato M è sbagliato): da 3 a 14 e da 21 a 25.

## B.4 Isotopi utili a risoluzione unitaria
13C 1,1% per atomo di C (M+1); 15N 0,37%; 33S 0,8% e 34S 4,4% (M+2); 29Si 5,1% e 30Si 3,4%; 18O 0,2%; Cl 100:32 (3:1); Br 100:97 (1:1); Cl2 ≈ 100:64:10; Br2 ≈ 1:2:1; ClBr ≈ 77:100:24. Ricalcola tutto con `elements.py`/`isoPattern` prima di scriverlo.

## B.5 Meccanismi (nomi da usare in testi, dati e giochi: `type`)
`sigma` (ionizzazione di un legame σ, alcani), `alpha` (scissione α iniziata dal sito radicalico), `i` (scissione induttiva iniziata dalla carica), `mclafferty` (trasferimento di γ-H con stato di transizione a sei atomi e scissione β: ione a elettroni dispari), `rda` (retro-Diels-Alder), `tropilio`, `orto` (effetto orto), `perdita`, `isotopo`, `serie`, `M`. Regola di Stevenson: la carica resta sul frammento con energia di ionizzazione più bassa; fra radicali, si perde di preferenza il più grande. Ioni a elettroni pari tendono a perdere molecole neutre, non radicali (regola degli elettroni pari: Karni & Mandelbaum 1980, già nella bibliografia).

## B.6 I sottopassi del procedimento (numerazione delle lezioni di Jimenez, da usare in capitolo, gioco e foglio di lavoro)
1. **Composizione elementare**: 1.1 scegli il gruppo (o i gruppi) di picchi, partendo dall'alto; 1.2 costruisci la tabella dei rapporti isotopici; 1.3 elementi A+2 (Cl, Br, S, Si; O per ultimo); 1.4 elementi A+1 (numero di C da (M+1)/M, N dalla regola dell'azoto); 1.5 ossigeno; 1.6 perdite di H (i picchi −1, −2 sporcano i rapporti; se mancano del tutto, forse non ci sono H); 1.7 elementi A (H, F, P, I) a completare la massa, con valenze sensate; 1.8 elementi insoliti (Mikaia: Te, B, Sn… solo se gli isotopi lo chiedono); 1.9 anelli + doppi legami; 1.10 livello del rumore (che cosa è un picco vero).
2. **Ione molecolare**: 2.1 candidato M; 2.2 è OE?; 2.3 regola dell'azoto su M e sui frammenti; 2.4 la maggior parte dei frammenti è EE?; 2.5 segna gli ioni OE importanti; 2.6 ioni pari o dispari a bassa m/z (azoto?); 2.7 spiega i frammenti importanti; 2.8 perdite neutre logiche; 2.9 M contiene il numero massimo di atomi di ogni elemento visto nei frammenti; 2.10 abbondanza di M e tipo di struttura.
3. **Aspetto generale**: 3.1 stabilità della molecola; 3.2 serie di ioni a bassa massa; 3.3 ioni caratteristici importanti.
4. **Verifica**: 4.1 confronto con spettri di composti simili; 4.2 confronto con una banca dati (o con lo spettro di riferimento della struttura proposta).

## B.7 Regole generali (Mikaia 2022, sez. 2; Jimenez, Interp3-4)
- Criteri per M (Mikaia): massa più alta riferita all'isotopo più abbondante; carica singola; regola dell'azoto; differenze di 4-14 e 21-25 Da improbabili; profilo isotopico ragionevole.
- Regola dell'azoto estesa: un OE con N pari (o zero) ha massa nominale pari; un EE con N pari (o zero) ha massa dispari; con N dispari il contrario.
- Regola degli elettroni pari: un OE può perdere un radicale (→ EE) o una molecola (→ OE); un EE perde di solito solo molecole (→ EE); perdite successive di radicali sono sfavorite.
- Stevenson-Audier: fra due frammenti la carica resta su quello con energia di ionizzazione più bassa.
- Scissione omolitica (sito radicalico, freccia a mezza punta; la carica non si sposta; si perde di preferenza il radicale più grande: 3-metil-3-esanolo dà 73 > 87 > 101) e eterolitica (sito di carica, doppia freccia; tendenza secondo l'elettronegatività: F > O > Cl > N > Br > I > S > C).
- Due rotture senza nuovi legami: retro-Diels-Alder (cicloeseni; la carica va al frammento con IE più bassa; solo isomeri cis nei biciclici), scissione simmetrica dei ciclobutani; eliminazioni di H2O (alcoli primari: 1,4, stato di transizione a sei atomi), HCl (1,3), H2S.
- Rottura con nuovo legame: alogenuri, tioli, ammine primarie a catena lunga danno ioni ciclici (es. [C4H8X]+ a cinque atomi).
- McLafferty: γ-H rispetto al doppio legame, stato di transizione a sei atomi, scissione β, ione distonico intermedio; un H secondario si trasferisce più facilmente di uno primario; può ripetersi.
- Ordine di tendenza della scissione α (sito radicalico): N > S, O, π, R• > Cl, Br > H (Jimenez, Interp4, dal McLafferty).
- Abbondanza di M: cresce con insaturazioni e anelli, cala con le ramificazioni; più alta se la molecola si ionizza più facilmente (ammine e tioli rispetto agli alcoli).

## B.8 Ioni diagnostici per famiglia (scheletro per il cap. 14; completare con Mikaia 2022 e controllare sul McLafferty, cap. 9)
| Famiglia | M | Ioni e perdite tipiche |
|---|---|---|
| alcani lineari | debole | «staccionata» CnH2n+1+ (43, 57 più alti), CnH2n−1+ minori |
| alcani ramificati | debole o assente | rottura al carbonio ramificato, perdita del ramo più grande |
| alcheni | medio | CnH2n−1+ (41, 55, 69), ioni OE CnH2n+• |
| cicloalcheni | medio | retro-Diels-Alder |
| alchilbenzeni | forte | 91 (tropilio), 65, 39; 92 (McLafferty) con catena ≥ propile; serie aromatica 39/51/65/77 |
| alcoli | debole/assente | M−18, α → CnH2n+1O+ (31, 45, 59); alcoli primari 31 |
| eteri | debole | α → 45, 59, 73; i → CnH2n+1+ |
| aldeidi | medio/debole | M−1, 29 (CHO+), McLafferty 44 |
| chetoni | medio | α → acilio (43, 57, 71…), McLafferty 58 (metilchetoni), 72, 86 |
| acidi carbossilici | debole | 45 (COOH+), McLafferty 60, M−17, M−45 |
| esteri metilici / etilici | debole | M−31 / M−45, McLafferty 74 / 88, acilio |
| ammine | debole, M dispari | α → iminio 30, 44, 58, 72, 86 (pari!) |
| ammidi | medio | 44 (CONH2+), McLafferty 59 |
| tioli e solfuri | medio | 34S a M+2 (4,4%), α → 47, 61, 75; M−34 (H2S) |
| cloro- e bromoalcani | debole | cluster, M−X, M−HX, ioni ciclici [C4H8X]+ |
| clorobenzeni, clorofenoli | forte | cluster Cln, M−Cl, M−HCl; fenoli M−CO, M−CHO |
| nitroareni | forte | M−NO2 (77 per il nitrobenzene), M−NO, 30 (NO+) |
| aniline, piridine | forte, M dispari | M−HCN, serie «alta» 40/53/66/79 |
| ftalati | debole | 149 (picco base nei dialchilftalati) |

---

# Allegato C: dati e fonti verificate

## C.1 Banche dati di spettri EI (verifiche del 7/10/2026)
- **MassBank Europe**: 139 006 record in totale. EI-B: 11 810 record (11 545 Univ. Tokyo, autori Koga M. / UOEH; 174 GL Sciences, quasi tutti derivati TMS; 75 Nihon Univ.). Licenze: Univ. Tokyo e Nihon **CC BY-NC-SA**; GL Sciences, Tottori, UOEH **CC BY-SA**. GC-EI-TOF: 1 298 (MSSJ **CC BY**, ma soprattutto molecole di sintesi poco didattiche e derivati; Osaka, Kazusa, RIKEN CC BY-SA, derivati TMS). La licenza è **per record**: lo strumento la legge da ogni record. Esempi controllati: 2-esanone (4 spettri EI-B, picco base 43, poi 58; M 100 fra 2% e 14%), butirrofenone (105/77, M 148, McLafferty 120 visibile in alcuni), toluene, clorobenzene, bromobenzene, benzoato di etile, 1-butanolo, trietilammina, acido pentanoico, 4-eptanone, cicloesene, limonene, fenolo, naftalene, dietil etere, benzaldeide, acetofenone, decano, dibutilftalato, 2,4-diclorofenolo, nitrobenzene, anilina, caffeina, salicilato di metile, tiofene, dimetildisolfuro: **tutti presenti** in EI-B. Assenti con quel nome: butanoato di metile, 1-bromopropano, ibuprofene.
- Copertura delle famiglie su MassBank EI-B verificata per: butilammina, sec-butilammina, terz-butilammina, isobutilammina, dietilammina, 3-pentanone, 3-metil-2-butanone, 1,2-/1,3-/1,4-diclorobenzene, 1-propanolo, 2-propanolo, esadecano, 2-metilpentano, 2,2-dimetilbutano, cicloesano, 1-esene, butanale, propiofenone, acido esanoico, esanoato di metile, acetato di etile, acetato di butile, N,N-dimetilacetammide, dietilsolfuro, 1-clorobutano, nitrometano, piridina, furano, fenantrene, pentaclorofenolo, 2-metil-2-propanolo, tetracloruro di carbonio, dibutil etere, alcol benzilico, benzoato di metile, etilbenzene, anisolo, propilbenzene, butilbenzene, chinolina, cloroformio, diclorometano, tricloroetilene, tetracloroetilene (tutti con almeno un record con il nome esatto); con altri nomi: 1-bromobutano («BUTYL BROMIDE»); da cercare con sinonimi o più avanti nei risultati: acido acetico, acido benzoico, lindano (es. «gamma-BHC»), 1-dodecene, butanammide, 1-butantiolo, butanenitrile, 1-nitropropano.
- **RECETOX Exposome HR-[EI+]-MS** (Price et al. 2021, Front. Public Health 9, 622558, doi:10.3389/fpubh.2021.622558; dati Zenodo doi:10.5281/zenodo.4471217): oltre 350 contaminanti, GC-Orbitrap a 60 000, formule dei frammenti annotate, MSP + SDF; licenza dichiarata CC BY-NC (da verificare sul record). Per il livello EI ad alta risoluzione.
- **MoNA** (MassBank of North America): licenze non verificate qui; usarla solo dopo aver letto le condizioni per record.
- **NIST WebBook (SRD 69)**: consultabile e citabile, **non ridistribuibile** in blocco (Standard Reference Data Act): solo link esterno.
- **SDBS** (AIST): vieta la ridistribuzione: niente.

## C.2 Lista iniziale dei composti del gioco EI (circa 90; famiglia · livello · concetto)
Il livello va da 1 (un solo concetto) a 4 (molecola più grande o più concetti insieme). Almeno 4 composti per famiglia; ⇄ = gruppo di isomeri da usare anche come «trova la differenza».
- **Alcani**: decano (1, staccionata), esadecano (2), 2-metilpentano ⇄ 2,2-dimetilbutano ⇄ esano (2-3, ramificazioni), 2,2,4-trimetilpentano (3, M assente).
- **Alcheni e cicloalcani**: 1-esene (2), cicloesano (2), cicloesene (2, RDA 54), limonene (3, RDA 68 e 93).
- **Aromatici**: benzene (1), toluene (1, tropilio 91), etilbenzene (2, 91/106), propilbenzene (3, 91 + McLafferty 92), butilbenzene (3), naftalene (1, M forte), fenantrene (4).
- **Alcoli**: 1-propanolo ⇄ 2-propanolo (2, 31 contro 45), 1-butanolo (1, M−18, 31), 2-butanolo (3, 45 contro 59), 2-metil-2-propanolo (3, M assente, 59), alcol benzilico (3).
- **Eteri**: dietil etere (2), dibutil etere (3), anisolo (2, 108/78/65).
- **Aldeidi e chetoni**: butanale (3, McLafferty 44), benzaldeide (1, M−1, 105→77), 3-pentanone ⇄ 3-metil-2-butanone (2-3, α e i), 2-esanone (2, 43 + McLafferty 58), 4-eptanone (2, 71 + McLafferty 86), acetofenone (1, 105/77), propiofenone (2), butirrofenone (3, 105 + McLafferty 120).
- **Acidi ed esteri**: acido acetico (1), acido pentanoico (2, McLafferty 60), acido esanoico (3), acido benzoico (2, 122/105/77), acetato di etile (3), acetato di butile (3), esanoato di metile (3, McLafferty 74), benzoato di metile (2, M−31), benzoato di etile (3), salicilato di metile (3, effetto orto 120), dibutilftalato (4, 149).
- **Ammine e ammidi**: C4H11N ⇄ butilammina, sec-butilammina, terz-butilammina, isobutilammina, dietilammina (2-3, α e iminio), trietilammina (1, 86), anilina (2, M−HCN 66), piridina (2), N,N-dimetilacetammide (3), butanammide (3, 44 e McLafferty 59; la propanammide non ha γ-H e non lo dà: buona domanda trabocchetto).
- **Composti dello zolfo**: tiofene (2, 34S), dimetildisolfuro (3), dietilsolfuro (3), 1-butantiolo (3).
- **Alogenuri**: clorobenzene (1, Cl), bromobenzene (1, Br), 1,2- ⇄ 1,3- ⇄ 1,4-diclorobenzene (2, Cl2; isomeri indistinguibili: il limite dell'EI), 1-clorobutano (3), 1-bromobutano (3), diclorometano e cloroformio (2, cluster), tetracloruro di carbonio (3, M assente), tricloroetilene e tetracloroetilene (2-3).
- **Azoto ossidato e nitrili**: nitrobenzene (2, M−NO2 77, M−NO 93), nitrometano (3), butanenitrile (3).
- **Fenoli**: fenolo (2, M−CO 66), 2,4-diclorofenolo (2, Cl2), pentaclorofenolo (4, Cl5).
- **Ambientali e «ponte»**: caffeina (4, 194/109), lindano o un altro organoclorurato (4, Cl6), atrazina (4, 215/200, la stessa molecola dell'esempio della Teoria).
Nomi italiani IUPAC o d'uso (scrivili nella lista dello strumento; Federico li rivede). Escludi gli inquinanti dei metodi del laboratorio.

## C.3 Bibliografia verificata (DOI controllati su Crossref il 7/10/2026)
**Didattica della MS e della spettroscopia**
- Windle C.J., Kim Y., Han J.Y., Ong J.S.H., Fung F.M. (2025) Hydragen: An Open-Accessed, Personalized Learning Platform for Mass Spectrometry. *J. Chem. Educ.* 102, 4479-4488. doi:10.1021/acs.jchemed.5c00722
- Do (2026) From Equations to Intuition: Interactive Modeling for Teaching Ion Dynamics in Mass Spectrometry. *J. Chem. Educ.* 103, 4989-4997. doi:10.1021/acs.jchemed.6c00822
- Salvador, Masclaux, Danjou (2026) Playing to Learn: MS Cards, an Educational Card Game for Teaching Mass Spectrometry Instrumentation. *ChemRxiv* (preprint). doi:10.26434/chemrxiv.15005751/v1
- Diao et al. (2025) A Modular Mass Spectrometer for Undergraduate-Designed Chemical Analysis Experiments. *J. Chem. Educ.* 102, 2137-2143. doi:10.1021/acs.jchemed.5c00148
- Diao et al. (2026) Probing Chemical Bond Energy Using an Instructional Mass Spectrometer for Undergraduate Experiments. *J. Chem. Educ.* 103, 1013-1021. doi:10.1021/acs.jchemed.5c01100
- Frański R. (2024) Teaching mass spectrometry: A compilation of approaches to teaching theory and practice of mass spectrometry. *Eur. J. Mass Spectrom.* 30, 87-102. doi:10.1177/14690667241237431
- Joyner (2022) What Are Essential Skills and Concepts for Teaching Mass Spectrometry to Undergraduates? *J. Am. Soc. Mass Spectrom.* 33, 1581-1585. doi:10.1021/jasms.2c00100
- Worrall A.F., Campbell C.D., Midson M.O., Stewart M.I. (2024) University teaching of mass spectrometry as a key practical technique within the context of a fully integrated, spiral curriculum. *Rapid Commun. Mass Spectrom.* doi:10.1002/rcm.9851
- Frański R., Bańczyk I., Gierczyk B. (2025) Development of Mass Spectrometry Skills through Instrumental Activities for Second-Year Students of Medicinal Chemistry (EI diretta e GC-EI). *J. Chem. Educ.* 102, 2221-2229. doi:10.1021/acs.jchemed.5c00154
- Henchman M., Steel C. (1998) Understanding the Quadrupole Mass Filter through Computer Simulation. *J. Chem. Educ.* 75, 1049. doi:10.1021/ed075p1049
- Leary J.J., Schmidt R.L. (1996) Quadrupole Mass Spectrometers: An Intuitive Look at the Math. *J. Chem. Educ.* 73, 1142. doi:10.1021/ed073p1142
- Marty et al. (2013) Simulating a Time-of-Flight Mass Spectrometer: A LabView Exercise. *J. Chem. Educ.* 90, 239-243. doi:10.1021/ed200158q
- Fulmer, Duong, Palmer, Owens (2024) TOFSim: A LabView Based Time-of-Flight Mass Spectrometer Simulation. *J. Chem. Educ.* 101, 1507-1513. doi:10.1021/acs.jchemed.3c00885
- Betts, Palkendo (2018) Teaching Undergraduates LC–MS/MS Theory and Operation via MRM Method Development. *J. Chem. Educ.* 95, 1035-1039. doi:10.1021/acs.jchemed.7b00914
- Tanaka, Shibue (2023) High-Resolution Mass Spectrometry for Beginners: A Laboratory Experiment for Organic Chemistry Students. *J. Chem. Educ.* 100, 4734-4740. doi:10.1021/acs.jchemed.3c00330
- Stock (2017) Introducing Graduate Students to High-Resolution Mass Spectrometry (HRMS) Using a Hands-On Approach. *J. Chem. Educ.* 94, 1978-1982. doi:10.1021/acs.jchemed.7b00569
- Bright, Chen (1983) Mass spectral interpretation using the "rule of '13'". *J. Chem. Educ.* 60, 557. doi:10.1021/ed060p557
- Socha O., Osifová Z., Dračínský M. (2023) NMR-Challenge.com: An Interactive Website with Exercises in Solving Structures from NMR Spectra. *J. Chem. Educ.* 100, 962-968. doi:10.1021/acs.jchemed.2c01067
- Vosegaard T. (2018) iSpec: A Web-Based Activity for Spectroscopy Teaching. *J. Chem. Educ.* 95, 97-103. doi:10.1021/acs.jchemed.7b00482
- Bradley J.-C., Lancashire R.J., Lang A.S.I.D., Williams A.J. (2009) The Spectral Game: leveraging Open Data and crowdsourcing for education. *J. Cheminform.* 1, 9. doi:10.1186/1758-2946-1-9
- Hapiot et al. (2025) Engaging Students in Spectroscopic Analysis of Organic Compounds: A Collaborative Tournament Approach. *J. Chem. Educ.* 102, 722-728. doi:10.1021/acs.jchemed.4c01440
- Vergne et al. (2019) Escape the Lab: An Interactive Escape-Room Game as a Laboratory Experiment (con GC-MS). *J. Chem. Educ.* 96, 985-991. doi:10.1021/acs.jchemed.8b01023
- Mahomed, Sisodia, Williams, Villa-Marcos (2024) Spectroscopy Unlocked: An Escape Room Activity for Introductory Chemistry Courses. *J. Chem. Educ.* 101, 2570-2575. doi:10.1021/acs.jchemed.3c01320
- Winschel et al. (2015) Using Jigsaw-Style Spectroscopy Problem-Solving To Elucidate Molecular Structure through Online Cooperative Learning. *J. Chem. Educ.* 92, 1188-1193. doi:10.1021/acs.jchemed.5b00114
- Topczewski et al. (2017) NMR Spectra through the Eyes of a Student: Eye Tracking Applied to NMR Items. *J. Chem. Educ.* 94, 29-37. doi:10.1021/acs.jchemed.6b00528
- Cartrette D.P., Bodner G.M. (2010) Non-mathematical problem solving in organic chemistry. *J. Res. Sci. Teach.* 47, 643-660. doi:10.1002/tea.20306
- Clark H., Patrick A.L. (2026) Teaching Chemical Concepts Through the Lens of Mass Spectrometry. *LCGC International* (rubrica, 28/9/2026; senza DOI: non in bibliografia, solo spunti).
**Apprendimento e gioco**
- Pelánek R. (2016) Applications of the Elo rating system in adaptive educational systems. *Comput. Educ.* 98, 169-179. doi:10.1016/j.compedu.2016.03.017
- Sailer M., Homner L. (2020) The Gamification of Learning: a Meta-analysis. *Educ. Psychol. Rev.* 32, 77-112. doi:10.1007/s10648-019-09498-w
- Hanus M.D., Fox J. (2015) Assessing the effects of gamification in the classroom. *Comput. Educ.* 80, 152-161. doi:10.1016/j.compedu.2014.08.019
- Roediger H.L., Karpicke J.D. (2006) Test-Enhanced Learning. *Psychol. Sci.* 17, 249-255. doi:10.1111/j.1467-9280.2006.01693.x
- Taylor K., Rohrer D. (2010) The effects of interleaved practice. *Appl. Cogn. Psychol.* 24, 837-848. doi:10.1002/acp.1598
- Atkinson R.K., Renkl A., Merrill M.M. (2003) Transitioning From Studying Examples to Solving Problems. *J. Educ. Psychol.* 95, 774-783. doi:10.1037/0022-0663.95.4.774
- Kapur M. (2016) Examining Productive Failure, Productive Success, Unproductive Failure, and Unproductive Success in Learning. *Educ. Psychol.* 51, 289-299. doi:10.1080/00461520.2016.1155457
- Wieman C.E., Adams W.K., Perkins K.K. (2008) PhET: Simulations That Enhance Learning. *Science* 322, 682-683. doi:10.1126/science.1161948
- Johnstone A.H. (1991) Why is science difficult to learn? Things are seldom what they seem. *J. Comput. Assist. Learn.* 7, 75-83. doi:10.1111/j.1365-2729.1991.tb00230.x
- Kang S.H.K. (2016) Spaced Repetition Promotes Efficient and Effective Learning. *Policy Insights Behav. Brain Sci.* 3, 12-19. doi:10.1177/2372732215624708
**Alta risoluzione**
- Makarov A. (2000) Electrostatic Axially Harmonic Orbital Trapping: A High-Performance Technique of Mass Analysis. *Anal. Chem.* 72, 1156-1162. doi:10.1021/ac991131p
- Zubarev R.A., Makarov A. (2013) Orbitrap Mass Spectrometry. *Anal. Chem.* 85, 5288-5296. doi:10.1021/ac4001223
- Marshall A.G., Hendrickson C.L. (2008) High-Resolution Mass Spectrometers. *Annu. Rev. Anal. Chem.* 1, 579-599. doi:10.1146/annurev.anchem.1.031207.112945
- Xian F., Hendrickson C.L., Marshall A.G. (2012) High Resolution Mass Spectrometry. *Anal. Chem.* 84, 708-719. doi:10.1021/ac203191t
- Brenton A.G., Godfrey A.R. (2010) Accurate mass measurement: Terminology and treatment of data. *J. Am. Soc. Mass Spectrom.* 21, 1821-1835. doi:10.1016/j.jasms.2010.06.006
- Kind T., Fiehn O. (2007) Seven Golden Rules for heuristic filtering of molecular formulas obtained by accurate mass spectrometry. *BMC Bioinformatics* 8, 105. doi:10.1186/1471-2105-8-105
- Kendrick E. (1963) A Mass Scale Based on CH2 = 14.0000 for High Resolution Mass Spectrometry of Organic Compounds. *Anal. Chem.* 35, 2146-2154. doi:10.1021/ac60206a048
- Hughey C.A. et al. (2001) Kendrick Mass Defect Spectrum: A Compact Visual Analysis for Ultrahigh-Resolution Broadband Mass Spectra. *Anal. Chem.* 73, 4676-4681. doi:10.1021/ac010560w
- Krauss M., Singer H., Hollender J. (2010) LC–high resolution MS in environmental analysis: from target screening to the identification of unknowns. *Anal. Bioanal. Chem.* 397, 943-951. doi:10.1007/s00216-010-3608-9
- Hollender J., Schymanski E.L. et al. (2017) Nontarget Screening with High Resolution Mass Spectrometry in the Environment: Ready to Go? *Environ. Sci. Technol.* 51, 11505-11512. doi:10.1021/acs.est.7b02184
**Ionizzazione elettronica**
- Mikaia A. (2022) Protocol for Structure Determination of Unknowns by EI Mass Spectrometry. I. Diagnostic Ions for Acyclic Compounds with up to One Functional Group. *J. Phys. Chem. Ref. Data* 51, 031501. doi:10.1063/5.0091956 (PDF gratuito dal sito NIST)
- Smith R.M. (2004) *Understanding Mass Spectra: A Basic Approach*, 2ª ed., Wiley. doi:10.1002/0471479357 (più facile del McLafferty: consigliato agli studenti come prima lettura)
- Stevenson D.P. (1951) Ionization and dissociation by electronic impact. *Discuss. Faraday Soc.* 10, 35. doi:10.1039/df9511000035
- Price E.J. et al. (2021) Open, High-Resolution EI+ Spectral Library of Anthropogenic Compounds. *Front. Public Health* 9, 622558. doi:10.3389/fpubh.2021.622558
- Matyushin D.D., Sholokhova A.Yu. (2026) Interactive Software for Interpreting and Curating High-Resolution Electron Ionization Mass Spectra. *J. Mass Spectrom.* 61. doi:10.1002/jms.70096 (software libero «gchrmsexplain»: esempio di come si annotano i frammenti EI ad alta risoluzione)
- Jimenez J.-L. (2013) Lezioni CHEM-5181 «MS Interpretation» 1-5, University of Colorado Boulder (materiale didattico pubblico, adattato dal McLafferty; non in bibliografia del sito, solo come traccia).
- McLafferty F.W., Tureček F. (1993) *Interpretation of Mass Spectra*, 4ª ed., University Science Books (già in bibliografia).
- McLafferty F.W. (1959) Mass Spectrometric Analysis. Molecular Rearrangements. *Anal. Chem.* 31, 82-87. doi:10.1021/ac60145a015
- Stein S.E. (1994) Estimating probabilities of correct identification from results of mass spectral library searches. *J. Am. Soc. Mass Spectrom.* 5, 316-323. doi:10.1016/1044-0305(94)85022-4
- Horai H. et al. (2010) MassBank: a public repository for sharing mass spectral data for life sciences. *J. Mass Spectrom.* 45, 703-714. doi:10.1002/jms.1777 (fonte dei dati EI)
