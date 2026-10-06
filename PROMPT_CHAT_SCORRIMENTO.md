# PROSSIMA CHAT (QqQ lab): scorrimento fluido fra le scansioni (Parte A) e migliorie per gli studenti (Parte B)

Lavori in `~/QqQ_lab/QqQ_lab`. Leggi prima `AGENTS.md` (regole, sez. 2 risparmio token, sez. 3 mappa di `explore.js`, sez. 12 «Frecce sul cromatogramma» con le misure). Poi solo i punti indicati qui, con `grep -n`: non leggere `vendor/`, non rileggere interi file.

> **Questo file si cancella da solo**: quando un punto è fatto e verificato, toglilo da qui. A lavoro finito sposta il file in `_cestino/<data>_prompt_completati/` e riporta in `AGENTS.md` (sez. 12) solo ciò che resta utile (nomi delle funzioni, decisioni, misure).

## Se sei Claude Code in una sessione cloud (Federico dorme: non fare domande)
Questa parte prevale sulle regole qui sotto e su `AGENTS.md` quando non sei sul Mac di Federico.
1. **Niente Mac**: ignora device_bash/device_stage_files/device_commit_files, i permessi di cancellazione, GitHub Desktop, `_cestino` del Mac. Non cancellare file del repository; se il prompt chiede di spostarne uno, `git mv` in `_cestino/<data>/` dentro il repo.
2. **Prima cosa**: `python3 tools/verifica.py --setup --rapida`. Installa pytest, Playwright e Chromium e dice subito se tutto parte. Se Chromium non si installa (rete), continua con `--senza-e2e` e scrivilo chiaramente nel report.
3. **Dati veri**: la sessione dovrebbe avere anche il repository PRIVATO `Freeesta/QqQ-lab-dati` (mzML veri della serie B: Full Scan, MS2, MRM con standard; metodi `.dam`). `tools/verifica.py` lo trova da solo; se non lo trova, cercalo (`find / -maxdepth 4 -type d -name QqQ-lab-dati 2>/dev/null`) ed esporta `QQQ_DATI=<percorso>`. Per gli script e2e lanciati a mano: `QQQ_MZML=$QQQ_DATI/mzML QQQ_DAM=$QQQ_DATI/dam/Lab_inq_FullMass_pos_max480.dam`. Solo se il repository dei dati non c'è, usa i dati sintetici (lo fa `verifica.py` da sola) e scrivilo nel report. **Mai copiare i dati nel repository del programma** (è pubblico) e non modificare il repository dei dati.
4. **Verifica = `tools/verifica.py`**: all'inizio una volta COMPLETA (`python3 tools/verifica.py`, può durare 30-40 min: lanciala in background e intanto leggi il codice) per sapere cosa fallisce GIÀ prima delle tue modifiche (scrivi la lista nel report: non sono colpa tua); durante il lavoro `--solo <e2e toccati>`; alla fine di nuovo completa. Leggi `.verifica/ultimo.md` e i log solo dei FAIL. Aggiungi i tuoi e2e nuovi (`e2e_scroll.py`, `e2e_studenti.py`) in modo che `verifica.py` li esegua (stessi nomi `e2e*.py`, stampa dei passi come gli altri: `('nome', 'ok')` / `('nome', 'FAIL ...')`, `r.report()` alla fine).
5. **CI rossa su GitHub**: il 6/10 sera il test `test_mac_app_bundle_and_vector_logo` falliva perché l'app Mac era stata tolta; è stato sostituito da `test_vector_logo`. Se la CI (`gh run list -R Freeesta/QqQ-lab`) è ancora rossa per altri motivi legati ai launcher tolti, correggi i test (non rimettere i launcher).
6. **Git**: lavora sul ramo che ti dà la sessione (non su `main`). Commit e push dopo OGNI blocco concluso e verificato (B-1+B-2; Parte A; poi gruppi di 4-5 punti della Parte B), così se la sessione si ferma il lavoro resta. Titoli in italiano. Alla fine apri una pull request verso `main` con il report nella descrizione (Federico la unisce al mattino).
7. **Budget**: se stai per finire tempo o token, fermati dopo un commit pulito, aggiorna questo file (togli solo ciò che è fatto e verificato) e scrivi nel report cosa resta.
8. **Report finale** (anche nella pull request): riassunto di `verifica.py` prima e dopo; una riga per punto (fatto / proposta / non fatto e perché); cosa Federico deve provare a mano sul sito (Cmd+Shift+R).

## Regole fisse
- **Una sola chat alla volta**: se `git status` mostra modifiche non tue o `git log -1` è di pochi minuti fa, chiedi a Federico se un'altra chat è ancora al lavoro prima di toccare file. Ri-leggi `explore.js`/`index.html`/`api.py` sul Mac prima di modificarli.
- Si lavora e si committa su `main` (niente rami). Un solo commit a fine lavoro (AGENTS.md sez. 2: permesso di cancellazione per `.git/index.lock`, `git -c user.name=... commit`, righe Co-Authored-By e Claude-Session del messaggio di sistema). Il push lo fa Federico.
- Interfaccia in italiano, codice e commenti in inglese, «m/z» sempre così. Non cancellare file: `_cestino/`.
- **Pedagogia**: il programma mostra i dati, non dà risposte. Niente evidenziazione automatica dei picchi «che cambiano» o dei possibili TP.
- Endpoint nuovi solo in `qqq_lab/api.py` (vale per server locale e sito Pyodide), errori in JSON, con un test pytest.
- Prova con `python3 tools/verifica.py` (vedi `AGENTS.md` sez. 5): `--solo` durante il lavoro, completa alla fine. Un front end non provato nel browser è rotto.

## Come leggere questo prompt
È scritto per essere eseguito da un modello che non ha visto la conversazione con Federico: ogni punto dice **perché** (cosa succede oggi a uno studente), **dove** (file e funzione, da trovare con `grep -n`: i numeri di riga sono indicativi) e **come verificare**. Ordine: Parte B punto 1-2 (bug che producono numeri sbagliati) → Parte A → resto della Parte B. Se un punto si rivela più costoso del previsto o tocca una decisione didattica, NON improvvisare: fai il resto e scrivi nel report costo e proposta.
**Prima di iniziare: c'è un'altra chat (prompt `PROMPT_PROSSIMA_CHAT.md`, «chat G»).** Il 6/10 sera stava lavorando sulle stesse aree (non aveva ancora scritto nulla sul Mac). Questo prompt va eseguito **DOPO** che la chat G ha fatto il suo commit (cerca in `git log` un commit su Impostazioni/Disegno/XIC/Addotti successivo al 6/10 sera). Sul Mac: se non c'è, o `git status` mostra file modificati non committati, FERMATI e chiedi a Federico. In una sessione cloud: procedi, ma non toccare le aree elencate qui sotto e scrivilo nel report. Poi rileggi `PROMPT_PROSSIMA_CHAT.md` (ciò che è stato fatto ne è stato cancellato) e adatta così:
- **Frecce ← →** (sua Sezione 8 punto 1, «da decidere»): è sostituito da questa Parte A. Se la voce è ancora lì, cancellala da `PROMPT_PROSSIMA_CHAT.md` nel tuo commit.
- **Colori per tempo** (sua Sezione 3 punto 7) e **«Colori dei grafici»** nell'ingranaggio (Sezione 1 punto 9): se fatti, B-16 usa le stesse funzioni (scala per concentrazione accanto a quella per tempo); se non fatti, B-16 solo una tinta distinta per gli standard MRM.
- **Pulsanti dell'header** (Isotopi, Perdite neutre: Sezione 3 punto 6; pulizia dell'header: punto 9): B-18 mette la Calcolatrice nello stesso gruppo e con lo stesso stile.
- **Tooltip sui bottoni** (Sezione 3 punto 4): il lucchetto (A.2) e «y ×10» (B-7) usano lo stesso meccanismo.
- **Schermo intero** e **limiti di RT** (Sezione 3 punti 1-2): A.4 (livello del cursore) e B-6/B-7/B-8 devono funzionare anche a schermo intero e rispettare i limiti di RT.
- **Finestra XIC nuova** (Sezione 4: un solo decimale, niente «+ XIC», finestra unitaria): B-13 (legenda) e il punto «ultimo XIC ricordato» di A.7 si adattano alla finestra nuova.
- **Impostazioni ridotte** (Sezione 1): niente nuove opzioni nell'ingranaggio; le opzioni di questo prompt stanno nei pannelli.
Se la chat G NON ha fatto uno di questi punti, non farlo tu: lascialo a lei e scrivilo nel report.

## Obiettivo della Parte A (parole di Federico)
Lo studente si mette a un RT prima di un picco e con ← → va avanti e indietro una scansione alla volta guardando lo spettro Full Scan, per vedere quali ioni salgono e scendono (anche TP nascosti sotto un picco). Il passaggio fra scansioni deve essere **il più fluido possibile**: assi e numeri fermi, niente lampeggi, niente ritardi. Il primo approccio al programma è difficile: non deve frustrare.

## Stato attuale (verificato il 6/10 sul codice)
- Tasti: `document.addEventListener("keydown", ...)` in `explore.js` (circa riga 292): con un pannello attivo con cursore chiama `stepScan(p, dir)`, altrimenti `goFile`. `stepScan` (circa 591; ramo MS2 con `ms2Near`) sposta `p.cur`, chiama `draw(p)` (ridisegna TUTTO il cromatogramma) e `pushLinked(p, r0, r1, k, true)`.
- `pushLinked` (circa 1562) per ogni spettro collegato fa `ctl(s)` (ricostruisce i controlli) e `draw(s)` a ogni passo.
- `drawSpec` (circa 1407): chiama `setup(p.cv)` (svuota il canvas) PRIMA di `await getSpec(...)` → un frame vuoto per ogni scansione non in cache (17% dei frame a tasto premuto). Asse x: se non c'è zoom `x0/x1` = min/max degli m/z della scansione → cambia a ogni scansione; asse y: `ymax` = massimo della scansione × 1.12 → cambia sempre (lo stesso picco sembra cambiare altezza anche se non cambia). Nessun «ultimo vince»: richieste accodate.
- `getSpec` (circa 109) è memoizzato per intervallo RT; lato server `Item.spectrum` → `_binned` filtra tutta la tabella per una sola scansione (costo ∝ dimensione del file). Misure: `api/spectrum` 4.2 ms (locale), disegno spettro 10-14 ms; su Pyodide ~10 volte più lento (non misurato per gli spettri).
- Script di misura già pronto: `tests_e2e/lat_arrows.py`. Lancialo PRIMA delle modifiche e DOPO, e riporta i numeri.

# PARTE A: scorrimento fluido

## Lavoro da fare (in quest'ordine)

### A.1 Niente lampeggio, «ultimo vince», un disegno per frame
- `drawSpec`: prima ottieni i dati, POI `setup()` e disegna tutto in modo sincrono. Il canvas mostra lo spettro vecchio finché il nuovo non è pronto.
- Token per pannello (`p._tok`): ogni richiesta incrementa il token; alla risposta, se il token non è più l'ultimo, scarta.
- `drawSoon(p)`: raccoglie più richieste di disegno nello stesso frame (`requestAnimationFrame`), un solo disegno per frame per pannello.
- In `pushLinked` durante lo scorrimento NON chiamare `ctl(s)` (solo quando cambia qualcosa nei controlli, es. lucchetto).
- Il messaggio di stato (`p.rd`: «scansione 812/1100 · RT 14.320 min») in posizione fissa, `font-variant-numeric: tabular-nums` e larghezza minima, così il testo non balla.

### A.2 Assi fermi durante lo scorrimento (lucchetto)
- Stato dello spettro collegato `s.lock = {x0, x1, ymax}` (o `null`). Al **primo** passo con ← → si blocca da solo:
  - **asse x** = l'intervallo m/z visibile in quel momento (`s._a.x0/x1`, anche senza zoom); da quel momento i numeri dell'asse x non cambiano più;
  - **asse y** = massimo delle intensità nell'intervallo x bloccato sulle scansioni vicine (±20, dalla cache del punto 3) × 1.12. Se durante lo scorrimento una scansione supera `ymax`, l'asse cresce (mai si restringe durante lo scorrimento): niente picchi tagliati.
- Pulsante **lucchetto** nell'intestazione dello spettro (gruppo zoom, accanto a lente e reset; icona SVG nello stile di `IC_FIT`, `title` «Assi bloccati durante lo scorrimento: clic per sbloccare»). Chiuso = assi fermi; aperto = assi automatici come oggi.
- Si sblocca: clic sul lucchetto, doppio clic sullo spettro, «Vista intera»/reset zoom, nuovo clic o trascinamento sul cromatogramma (non le frecce), cambio di file o di scheda. Uno zoom fatto dallo studente mentre è bloccato ridefinisce `x0/x1` e ricalcola `ymax`.
- `ymax` bloccato vale anche con la scala log e con più file sovrapposti (`p.all`). Salva il lucchetto nello stato del pannello (`uiSave`/`restoreUi`) solo come «aperto/chiuso», non i valori.
- `drawSpec`: se `p.lock` c'è usa `x0, x1, ymax` del lucchetto invece di ricalcolarli; numero di tacche fisso (`xn`) così le etichette restano le stesse.

### A.3 Precaricamento delle scansioni vicine
- Nuovo endpoint in `api.py`: `GET /api/spectra?k=<file>&i0=<scan>&i1=<scan>[&level&prec]` → lista `[{i, rt, mz:[...], y:[...]}, ...]` per scansione (massimo 60 per richiesta). Nuovo metodo in `explore.py` (es. `Item.scans(i0, i1, level, precursor)`) che legge DIRETTAMENTE gli array di quelle scansioni dal lettore (`reader/mzml.py`), senza passare da `_binned` sull'intera tabella. Il risultato di una scansione deve essere **identico** a quello di `api/spectrum` sullo stesso intervallo (stesso raggruppamento in bin da 0.1 Da e stessi m/z): test pytest che lo confronta su `demo.py` e sui file veri se presenti (`QQQ_MZML`).
- JS: cache per `(k, livello, precursore, indice scansione)` con limite (circa 400 scansioni, la più vecchia esce). Al primo passo e poi ogni volta che il cursore si avvicina al bordo, precarica ±20 scansioni nella direzione di movimento (una richiesta a blocco). `stepScan` legge dalla cache; se manca, ripiega su `getSpec` come oggi.
- Con sottrazione del fondo (`p.bg`) o del bianco attiva usa il percorso di oggi (`getSpec`): non duplicare la logica di sottrazione.
- MS2: stessa cache per precursore; `ms2Near` continua a saltare le scansioni vuote.

### A.4 Ridisegnare solo ciò che cambia sul cromatogramma
- Durante le frecce il cromatogramma non va ridisegnato tutto: aggiungi un canvas sovrapposto (livello cursore) e ridisegna solo la linea verticale e il valore del cursore. Il ridisegno completo resta quando cambia lo zoom (il cursore esce dalla vista, come oggi con `clampView`).
- L'esportazione PNG (`p._exp`) deve continuare a funzionare (il livello cursore non entra nell'immagine).

### A.5 Velocità e tasti
- Freccia tenuta premuta: scorrimento continuo con un limite di circa 15 scansioni al secondo (un passo ogni ~66 ms, ciclo con `requestAnimationFrame` finché il tasto è giù; ignora la ripetizione automatica del sistema), così l'occhio segue.
- **Maiusc + freccia**: salto di 5 scansioni.
- **Barra spaziatrice**: play/pausa. Se c'è una selezione di RT sul cromatogramma (`p.sel`) scorre avanti e indietro dentro di essa, altrimenti dal cursore fino alla fine; si ferma con Spazio, Esc o un clic. Velocità del play ~10 scansioni/s. Spazio e frecce agiscono solo nella vista Dati con un pannello attivo e il fuoco NON su input/select/textarea/dialog (stessa guardia di oggi); `preventDefault` per non scorrere la pagina.
- Aggiorna `HELP` (chiave nuova `scorrimento`, «?» nel pannello cromatogramma) con i tasti.

### A.6 Sagoma della scansione precedente (opzionale, spenta di default)
- Voce nel menu del clic destro sullo spettro: «Mostra la scansione precedente (sagoma)» (spunta). Disegna la scansione precedente in grigio chiaro sottile DIETRO le barre attuali, stesso asse; voce in legenda «scansione precedente». Salvata nel pannello (`p.ghost`). Non entra nei PNG (come il cursore). È solo un dato, non un giudizio: niente colori «sale/scende».

### A.7 Piccole comodità (fai solo quelle semplici; per le altre scrivi nel report costo e proposta)
- Cambiando file nello stesso pannello (frecce senza cursore, selettore file) restano zoom e RT: si confronta lo stesso punto in t0, t15, t60 senza rifare lo zoom. Verifica che oggi non si perdano; se si perdono, correggi.
- Tasto `?` (fuori dagli input) o voce «Scorciatoie» nell'aiuto: finestrella con tutte le scorciatoie (← →, Maiusc, Spazio, Esc, doppio clic, Ctrl/Cmd+rotella, Maiusc+trascina, clic sulla legenda).
- Pannello spettro vuoto: frase che dice cosa fare (oggi «Clicca o trascina sul cromatogramma…»: aggiungi «oppure usa ← → dopo aver messo il cursore»).
- La finestra XIC ricorda l'ultimo ione inserito (precompilato, modificabile).
- Annulla (Ctrl/Cmd+Z) per chiudere un pannello, togliere un'integrazione, zoom: SOLO proposta nel report (stima del costo), non implementare.


# PARTE B: migliorie per gli studenti (trovate provando il programma, 6 ottobre 2026)
Come sono state trovate: serie B vera (7 Full Scan B_FullMass-t0…t60, B_MS2-t15, 3 campioni MRM e 3 standard MRM, 2 `.dam`) caricata nel programma locale con Playwright, finestra 1440×900 e 1280×720 (portatili del laboratorio), percorso tipico di uno studente: caricamento → TIC → spettro → XIC → MS² → MRM → retta. Riproduci tu lo stesso percorso (screenshot prima/dopo) per ogni punto di interfaccia.
Principio sempre valido: aiutare a USARE il programma (vedere, trovare, non perdersi) sì; dire allo studente cosa c'è nei dati no.

## B-1. Bug: concentrazioni degli standard lette male dal nome (PRIORITÀ MASSIMA)
**Perché**: i file del laboratorio scrivono i decimali con il trattino basso: `B_MRM-STD_7_2ppm` = 7.2 ppm, `STD_0_6ppm` = 0.6, `STD_0_06ppm` = 0.06, `STD_2_4ppm` = 2.4. Oggi `qqq_lab/project.py` `guess_conc` dà 2, 6, 6, 4 (verificato). La colonna «Conc.» si precompila con questi valori, la retta di taratura parte sbagliata e lo studente non se ne accorge.
**Come**: in `guess_conc` (e nell'equivalente JavaScript `concFrom` dentro `qqq_lab/web/index.html`, schermata di caricamento: cerca `concFrom`) riconosci il formato `<intero>_<cifre><unità>` (es. `7_2ppm`, `0_06ppm`, `2_4mgL`) come numero decimale SOLO quando subito dopo le cifre c'è un'unità (ppm, ppb, mg/L, ug/L, …). `std_5` o `STD10mgL` devono continuare a funzionare come oggi. Preferisci che JS e Python usino la STESSA regola (se il JS non chiama il server per questo, scrivi la regola in entrambi e un test che li confronta, come per l'arrotondamento in `PROMPT_PROSSIMA_CHAT.md` Sezione 5).
**Test** (pytest in `tests/test_pipeline.py`): `STD_7_2ppm`→7.2, `STD_0_6ppm`→0.6, `STD_0_06ppm`→0.06, `STD_2_4ppm`→2.4, `STD_18ppm`→18, `std_0.5ppm`→0.5, `STD10mgL`→10, `std_5`→5 (unità None), `B_FullMass-t30 (2)`→None; e2e: la colonna Conc. della schermata di caricamento mostra 7.2, 0.6, 18.

## B-2. Bug: tempo con il punto decimale letto male
**Perché**: `guess_sample("mrm-t7.5")` dà 7 min (verificato; `scansione-7,5` invece dà 7.5). Un tempo sbagliato sposta il punto nella cinetica.
**Dove**: `qqq_lab/project.py` `guess_sample` (regex del tempo) e l'eventuale equivalente JS in `index.html` (cerca dove si precompila la colonna Tempo). **Test**: `mrm-t7.5`→7.5, `t7,5`→7.5, `t30`→30, `B_FullMass-t30 (2)`→30 (il «(2)» non è un tempo), `2h`→120.

## B-3. Schermata di caricamento: tabella ordinata
**Perché**: con 20 file le righe sono mischiate (t0 Full Scan, t0 MRM, t5 Full Scan, …) e lo studente non trova un file.
**Come**: ordina per Esperimento (Full Scan, MS², MRM) e dentro per tipo (bianco, standard per concentrazione crescente, campioni per tempo crescente), poi per nome. Una riga di intestazione sottile per gruppo come nella lista file a sinistra. L'ordine si aggiorna quando lo studente cambia tipo o tempo, senza perdere il fuoco del campo che sta scrivendo (riordina al `change`/blur, non a ogni tasto).

## B-4. Schermata di caricamento: valori indovinati da controllare
**Perché**: tempo e concentrazione precompilati dal nome sembrano dati certi.
**Come**: le celle Tempo e Conc. precompilate dal nome hanno uno sfondo giallo chiaro e il `title` «letto dal nome del file: controlla»; diventano normali appena lo studente le modifica o conferma (clic nel campo e Invio). Una riga sopra il pulsante Carica dati: «Controlla i valori in giallo (letti dal nome dei file).» solo se ce ne sono.

## B-5. Unità della concentrazione
**Come**: accanto al campo Conc. di ogni riga l'unità scelta (testo grigio piccolo, es. «mg/L»), e nel `title` del selettore: «1 ppm = 1 mg/L in acqua». Se il nome dice `ppm` e l'unità scelta è mg/L non serve conversione; con `ppb` precompila µg/L (o converti, coerente con `UNITS_MGL` in `project.py`).

## B-6. Cromatogramma e spettro visibili insieme su un portatile
**Perché**: a 1280×720 lo spettro collegato finisce sotto la piega: per lavorare con le frecce (Parte A) lo studente deve scorrere la pagina avanti e indietro.
**Come** (scegli e motiva nel report): (a) altezza predefinita più bassa del cromatogramma quando sotto c'è uno spettro collegato, calcolata dall'altezza della finestra in modo che i due pannelli stiano nello schermo (`defaultLayout`, `fitHost`, `p.h`); oppure (b) opzione «tieni in vista il cromatogramma» (`position: sticky` del pannello cromatogramma mentre si scorre lo spettro). Verifica a 1280×720, 1440×900, 1920×1080: cromatogramma + spettro interi nella finestra senza scorrere.

## B-7. Il picco del progenitore schiaccia i picchi piccoli
**Perché**: TIC a t0 = 1.2e9 cps, i picchi a 13 e 18 min (dove possono esserci TP) sono invisibili; la scala log c'è ma gli studenti non la usano.
**Come**: (a) Ctrl/Cmd+rotella con il mouse SOPRA L'ASSE Y (margine sinistro) = zoom solo sull'asse y, da 0 verso l'alto (lo zero resta in basso); (b) pulsante piccolo «y ×10» nel gruppo zoom (ogni clic moltiplica per 10 l'ingrandimento verticale, il reset zoom lo annulla); i picchi più alti escono dal grafico in alto con un segno (freccina o tratto) per dire che sono tagliati. Vale per cromatogramma, XIC, MRM e spettro. Il PNG esporta ciò che si vede. Aggiorna `HELP` del pannello.

## B-8. I pannelli nuovi compaiono fuori dalla vista
**Perché**: un nuovo XIC o spettro (da pulsante o menu) va in fondo alla pagina; lo studente non vede che è comparso e ripete l'azione.
**Come**: dopo `addPanel`/`newSpec` creati da un'azione dello studente (non al ripristino della sessione) scorri la pagina fino al pannello nuovo (`scrollIntoView({behavior:"smooth", block:"nearest"})`) e fallo lampeggiare per ~1 s (bordo evidenziato che sfuma, CSS). Rispetta `prefers-reduced-motion` (niente animazione, solo scorrimento).

## B-9. Scritte rimaste dopo il passaggio del mouse
**Perché**: in basso a destra dei pannelli restano «m/z 289.2» o «RT 9.53 min» (testo di `p.rd`, scritto in `explore.js` dove si gestisce il movimento del mouse, circa riga 1499) anche quando il mouse è altrove: sembra un risultato.
**Come**: al `mouseleave` del canvas svuota il testo di passaggio (ma NON i messaggi utili scritti da `stepScan`, es. «scansione 812/1100 · RT …», che restano finché c'è il cursore). Distingui i due usi (es. due elementi o una classe).

## B-10. Clic destro sul vuoto dello spettro
**Perché**: cliccando dove non c'è un picco il menu propone «Da dove viene m/z 289.2?» ed «Estrai l'XIC di m/z 289.2» su un punto vuoto.
**Come**: aggancia il clic al picco più vicino entro ~10 px (come il tooltip `p._a.hov`); se non ce n'è, le voci che riguardano un m/z sono grigie (`dim`) con la scritta «nessun picco qui: clic destro su un picco».

## B-11. Titolo doppio degli spettri congelati
**Perché**: il titolo è «Spettro a 14.33 min RT 14.33 min».
**Come**: titolo «Spettro di massa» + RT una sola volta (`.rtl`), come lo spettro collegato; cerca `"Spettro a "` / `rtText` / `freezeSpec` in `explore.js`.

## B-12. Spettro e scelta «Tutti sovrapposti»
**Perché**: in alto è scelto «Tutti sovrapposti» (vale per i cromatogrammi) ma lo spettro mostra un solo file finché non si spunta «sovrapponi i file»: due interruttori che sembrano dire cose diverse.
**Come**: NON cambiare il comportamento senza decisione (due spettri sovrapposti sono illeggibili con 7 file). Nella riga del pannello spettro accanto al selettore del file scrivi in grigio «(uno spettro alla volta: spunta “sovrapponi i file” per vederli insieme)» quando in alto è scelto «Tutti sovrapposti», e spiegalo nel «?» del pannello. Se ritieni migliore un'altra soluzione, proponila nel report.

## B-13. Legenda dello XIC
**Perché**: nome della traccia (formula, addotto, finestra m/z) e nomi dei file sono nella stessa riga di legenda: non si capisce cosa è cosa.
**Come**: con una sola traccia, la traccia va nel titolo del pannello (es. «XIC · C14H13F4N3O2S [M+H]+ · m/z 363.6-364.6») e la legenda elenca solo i file; con più tracce, legenda a due livelli (traccia in grassetto, poi i file). Nessun cambiamento ai dati esportati.

## B-14. Smoothing con default diversi
**Perché**: acceso di default nel Full Scan, spento nell'MRM (`explore.js` circa riga 476: `smooth: false` per `mrm`), senza spiegazione.
**Come**: lascia i default (l'MRM si integra: meglio il dato grezzo) ma spiegalo nel «?» del pannello MRM e nel `title` della spunta («spento: le aree si calcolano sul segnale grezzo»). Verifica che le aree NON dipendano dallo smoothing (se dipendono, scrivilo nel report: è importante).

## B-15. MRM: vista iniziale sul picco
**Perché**: il picco MRM è largo ~0.5 min su 20 min di corsa: lo studente deve zoomare ogni volta prima di integrare.
**Come**: nella vista iniziale MRM (`defaultLayoutTab`/`defaultLayout`, pannelli Quantificatore/Qualificatore) zoom su ±1.5 min attorno al massimo delle transizioni (massimo di tutti i file visibili), con la barra dello zoom e «Vista intera» a un clic. È il segnale del metodo scelto dallo studente, non una risposta. Se nessun file ha un picco chiaro (massimo < 10× il rumore), resta la vista intera.

## B-16. Colori degli standard MRM
**Perché**: standard 18 ppm e campione t0 hanno due rossi quasi uguali.
**Come**: standard con una scala sequenziale per concentrazione (dal chiaro allo scuro, una tinta), campioni con la scala per tempo (`PROMPT_PROSSIMA_CHAT.md` Sezione 3 punto 7, se già fatta; altrimenti solo una tinta diversa per gli standard). Colore manuale dello studente sempre prioritario.

## B-17. Finestra «Retta di taratura» vuota
**Perché**: prima di integrare mostra un grande riquadro vuoto con «Nessuno standard ha ancora un'area.» in piccolo.
**Come**: al posto del grafico vuoto, i 3 passi (gli stessi della striscia `#calbar`) in grande e un pulsante «Chiudi e vai al grafico MRM» che chiude la finestra e attiva il pannello Quantificatore con lo strumento di integrazione manuale.

## B-18. Calcolatrice m/z più facile da trovare
**Perché**: è nascosta nel menu «Altro» della barra della scheda (`#np-calc`, `index.html` circa riga 108; `explore.js` circa righe 303 e 313): nessuno la trova.
**Come**: pulsante nell'header accanto ad Addotti (stessa icona/stile delle altre, `QICON`), aperto da tutte le schede; togli la voce da «Altro» se resta vuoto. Coordinati con i nuovi pulsanti Isotopi/Perdite neutre se esistono (vedi «Sovrapposizioni» sopra). Verifica la barra a 1280 e 1440 px.

## B-19. Tornare a Dati dove si era
**Perché**: passando a Disegno o Teoria e tornando, lo studente deve ritrovare posizione e pannello.
**Come**: verifica (e correggi se serve) che al ritorno su Dati restino scroll della pagina, pannello attivo, zoom e cursore; idem cambiando scheda Full Scan/MS²/MRM e tornando. Test e2e.

## B-20. Avviso di sicurezza dell'iframe di Ketcher
**Perché**: la console dice «An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing» (iframe `#kframe`). Non tocca gli studenti ma annulla la protezione del sandbox (AGENTS.md sez. 11, «Sicurezza»).
**Come**: SOLO analisi: serve davvero `allow-same-origin` (Ketcher usa storage/fetch dello stesso sito? `draw.js` legge il suo DOM?). Scrivi nel report se si può togliere e cosa si rompe; non cambiarlo senza il via libera di Federico.

# TEST E CHIUSURA (Parte A + Parte B)

## Test
- Nuovo `tests_e2e/e2e_scroll.py` (stile di `e2e18.py`, `lib.py`, file veri B_FullMass via `QQQ_MZML`): metti il cursore prima del picco a ~14.3 min, 30 passi →: (a) `x0, x1, ymax` dello spettro collegato invariati (leggi lo stato dal pannello) e testi delle tacche uguali; (b) nessun frame vuoto (contatore nel codice, solo per i test, o `lat_arrows.py`); (c) pressioni rapide (20 in fila): l'ultima scansione mostrata è quella attesa (ultimo vince); (d) lucchetto: si chiude con le frecce, si apre con clic, doppio clic, «Vista intera», nuovo clic sul cromatogramma; (e) Maiusc+→ = +5 scansioni; (f) Spazio avvia e ferma il play; (g) sagoma on/off e assente nel PNG; (h) MS2: le frecce saltano le scansioni vuote anche con la cache.
- pytest: `api/spectra` uguale a `api/spectrum` per ogni scansione, limiti (`i0 > i1`, oltre la fine, più di 60 → errore JSON 400), file MRM → errore chiaro.
- Rilancia e2e3, e2e4, e2e16, e2e18 (toccano cursore, spettro vivo, pannelli) e `lat_arrows.py` prima/dopo.
- Parte B: pytest per B-1 e B-2; e2e nuovo `tests_e2e/e2e_studenti.py` (serie B vera, 1280×720) per B-3, B-4, B-6, B-7, B-8, B-9, B-10, B-11, B-13, B-15, B-17, B-18, B-19, con screenshot in `tests_e2e/shots/`.
- Se la rete lo permette: `tools/build_site.py` + `e2e13.py` e una misura della latenza delle frecce nel sito (Pyodide). Se non si può, scrivilo.

## Chiusura
- Aggiorna `AGENTS.md` sez. 12 (sostituisci «Frecce sul cromatogramma (solo analisi, NON implementato)» con ciò che c'è ora: funzioni, `/api/spectra`, lucchetto, tasti, misure prima/dopo) e sez. 3 (`explore.js`, `api.py`), Teoria se cita le frecce.
- Report breve per Federico: per la Parte B una riga per punto (fatto / proposta / non fatto e perché); misure prima/dopo (frame vuoti, ms per passo, locale e sito), cosa ha fatto dei punti del 7, cosa deve provare a mano (Cmd+Shift+R sul sito): tenere premuta →, Maiusc, Spazio, lucchetto, sagoma.
- Un commit su `main` con titolo in italiano (es. «Scorrimento fluido fra le scansioni e migliorie per gli studenti»; se il lavoro è lungo, due commit: uno per la Parte A, uno per la Parte B) e il messaggio di commit riportato nel report.
