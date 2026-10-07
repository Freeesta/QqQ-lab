# PROSSIMA CHAT 4 (QqQ lab): ritocchi dell'interfaccia + alta risoluzione e DDA

> **Quando usarlo**: DOPO che il lavoro di `PROMPT_PROSSIMA_CHAT_3.md` è unito in `main`. Riferimenti per **nome di funzione** (le righe cambiano): cerca con `grep -n`; parti dal codice attuale e adatta, non rifare.
> **Come si usa**: contiene SOLO il lavoro da fare. Punto fatto e verificato → **cancellalo da qui**; ciò che resta utile va in `AGENTS.md`. File vuoto → spostalo in `_cestino/<data>_prompt_completati/`.
> **Parte B scritta da Claude Opus** dopo prove sui file Orbitrap di Federico e lettura dei manuali FreeStyle e Xcalibur: le scelte di progetto sono fatte. Tu esegui; se il codice non torna con quanto scritto, scegli la soluzione più semplice coerente con lo scopo e scrivilo a Federico.

## Contesto (per chi parte da zero: le chat non hanno memoria, conta solo ciò che è scritto qui e in `AGENTS.md`)
- **QqQ lab** è il programma didattico di Federico Cristaudo (dottorando, Università di Torino) per il laboratorio di inquinanti della laurea magistrale in Chimica dell'ambiente: gli studenti cercano i prodotti di trasformazione di un contaminante (l'incognita: **non nominarla mai nell'interfaccia**) nei dati LC-MS di un triplo quadrupolo **3200 QTRAP**. Gli studenti usano solo il sito (GitHub Pages, Pyodide nel browser).
- Repository: `Freeesta/QqQ-lab` (**pubblico**: codice, prompt, `AGENTS.md`) e `Freeesta/QqQ-lab-dati` (**privato**: mzML e .dam veri del laboratorio e, in `HRMS/`, due ritagli Orbitrap di Federico, per i test; `tools/verifica.py` lo trova da solo). Sul Mac di Federico il repository è in `~/QqQ_lab/QqQ_lab`, i dati in `~/QqQ_lab/Data`, il cestino in `~/QqQ_lab/QqQ_lab/_cestino/` (solo locale, ignorato da git).
- La parte B aggiunge l'alta risoluzione (Orbitrap) per il lavoro di ricerca di Federico: gli studenti non hanno file ad alta risoluzione.
- Chi scrive i prompt è Claude Opus in una chat con Federico; chi li esegue è Sonnet nel cloud, **senza memoria**: tutto ciò che la chat successiva deve sapere (decisioni, stato, trappole trovate) va in `AGENTS.md` o in questo file, non solo nel messaggio a Federico.

## Prima di iniziare (ogni sessione)
1. `git fetch origin`; lavora sopra `origin/main` aggiornato.
2. Se in `main` esiste ancora `PROMPT_PROSSIMA_CHAT_3.md` o c'è una pull request aperta del prompt 3 (`gh pr list`): **fermati** e scrivi a Federico che il prompt 3 non è ancora unito (questo prompt parte dal suo lavoro).
3. Leggi «Stato e ripresa» qui sotto: se la tua sessione ha già lavoro fatto, riparti da lì.

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con `QqQ-lab-dati` per i dati del laboratorio). **Di questo file leggi solo**: Contesto, Prima di iniziare, Regole fisse, Stato e ripresa, Ordine di lavoro e sessioni, **le parti della tua sessione** e la Chiusura; salta le altre (sono di altre sessioni). Di `AGENTS.md` leggi sez. 1-2, 5, 12, la sezione dei file misti e le ultime sezioni; poi SOLO il codice che serve, con `grep -n`. Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti (niente generatore di formule, niente identificazioni).
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole. Icone con etichetta breve al passaggio del mouse.
- **Il comportamento per i file del 3200 QTRAP non cambia** con la parte B: tutto ciò che è nuovo si accende solo per profili ad alta risoluzione o file DDA. Ogni blocco termina con la verifica completa verde anche sui file del QqQ.
- **Dati di ricerca di Federico** (Orbitrap): i file interi solo sul Mac (`~/QqQ_lab/Data/HRMS`, 134 e 443 MB); **due ritagli** (45 e 33 MB) sono nel repository **privato** `QqQ-lab-dati/HRMS/` (vedi il suo `LEGGIMI.md`). Mai nel repository pubblico, mai nomi dei campioni o dei composti trovati in codice, test, commit o `AGENTS.md`: i test sui ritagli controllano solo proprietà generiche (si apre, profilo, DDA, tolleranze).
- **Risparmio token**: un blocco alla volta; file letti una volta; prove mirate; screenshot in `tests_e2e/shots/`, al massimo uno per punto.
- **Verifica**: `python3 tools/verifica.py --solo <test che tocchi>` durante il lavoro, completa alla fine di ogni blocco. **Non lanciare** nulla che usi Pyodide (e2e13, e2e_tpmine*, `tools/build_site.py`): le prove nel browser le fa Federico a mano.
- **Commit e push spesso** (i limiti di utilizzo possono interrompere la chat in qualsiasi momento): un commit con push **dopo ogni punto** finito (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema); se un punto è lungo, commit intermedi «[in corso] …» con push ogni ~30 minuti di lavoro. Sul Mac: su `main`. **Nel cloud** (decisione di Federico, 7/10): ramo della sessione; **alla fine di ogni blocco, se la verifica completa è verde, unisci la pull request in `main`** (`gh pr create` se manca, poi `gh pr merge <n> --merge --delete-branch`; per il blocco dopo crea un ramo nuovo da `main` aggiornato: `git fetch origin && git checkout -b claude/<nome>-<blocco> origin/main`) (il proxy GitHub delle sessioni cloud **rifiuta le cancellazioni di rami**: se `--delete-branch` o la cancellazione dei rami già uniti falliscono, non insistere; su GitHub è attiva la cancellazione automatica dei rami dopo l'unione). Così, se la chat si ferma, in `main` c'è tutto il lavoro finito. Se qualcosa è rosso, c'è un conflitto o una decisione da prendere: **non unire**, lascia la PR aperta e spiega a Federico. Se `gh` non può unire, scrivilo. Riporta questa regola in `AGENTS.md` sez. 2.
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano. Budget in esaurimento: fermati dopo un commit pulito e aggiorna questo file.

## Stato e ripresa
**Stato** (aggiornalo e fai push a ogni punto finito: è quello che legge la chat successiva). Ogni sessione cambia **solo la riga sotto il suo titolo** (le righe vuote fra una sessione e l'altra evitano i conflitti di git: non toglierle). Formato: punti fatti · punto in corso · ramo non ancora in `main`.

**S1**
- A0-A7 e D1-D5 fatti e uniti in main (PR 8 e 10). Restano: D6 (serve `/api/dda` di S3); rossi su Windows `tests/test_filebuf.py` e nei job browser Firefox / WebKit-macOS (sono di S4) · nessun punto in corso · nessun ramo da unire

**S3**
- B0-B6, B8, B9 fatti e uniti in `main` (verifica completa verde, 7/10 17:10; ripetuta sui test toccati dopo l'ultima modifica) · nessun punto in corso · restano da Federico le prove a mano (HR sul sito con Pyodide, file Exploris/Fusion interi)

**S4**
- B7 fatto e unito in `main` · C1 (`perf.js`, `/api/perf`) fatto · C2 job CI e `--browser`/`--fumo` scritti, da provare su Firefox e WebKit (installati nel container) · in corso: C2 poi C3/C4

**Se riprendi dopo un'interruzione** (nuova sessione, stesso prompt): 1) `git fetch origin`; 2) guarda «Stato» qui sopra e le PR aperte (`gh pr list`) o i rami `claude/...` non uniti con commit «[in corso]» (`git branch -r --no-merged origin/main`); 3) se c'è lavoro non unito, portalo nel tuo ramo (`git merge origin/<quel ramo>`), lancia `python3 tools/verifica.py --solo <test del punto>` e **riparti dal punto in corso**, senza rifare ciò che è già fatto; 4) chiudi la vecchia PR dopo aver unito la tua. Non rileggere i blocchi già fatti.

## Ordine di lavoro e sessioni
**Parte A** (ritocchi): A0 test su Windows · A1 barra dei file · A2 perdite neutre · A3 header fisso e niente scorrimento su «Dati» · A4 spettri e pannelli · A5 grafici nitidi e scritta dell'area · A6 pulsanti attivi · A7 nome nuovo.
**Parte B** (alta risoluzione e DDA): nell'ordine della **scaletta di priorità** più sotto (B0 → B9).
**Parte C** (scattante e compatibile con ogni browser, Windows e Mac) e **parte D** (confronto delle MS2 con le librerie): dopo, nelle sessioni indicate. La notte è lunga: finito il proprio elenco, una sessione **non** prende blocchi di un'altra; aggiorna «Stato», `AGENTS.md` e si ferma.
**Sessioni** (stasera Federico ne lancia **tre insieme** nel cloud; ognuna fa SOLO i suoi blocchi, scritti nel primo messaggio, es. «Esegui `PROMPT_PROSSIMA_CHAT_4.md`, sessione S1»):
| Sessione | Blocchi, in ordine | File principali |
|---|---|---|
| **S1** | A0 (CI su Windows), A1-A7, poi **parte D** (librerie) | `tests/`, `index.html`, `explore.js`, `tables.js`, `spettro.js`; poi `web/libreria*.js` (nuovi) |
| **S3** | B0 → B1 → B2 → B3 → B4 → B5 → B6, poi B8 e B9 se c'è budget | `dati_sintetici.py`, `reader/`, `explore.py`, `app.py`, `api.py`, `web/hr.js` e `web/dda.js` (nuovi), agganci in `explore.js` |
| **S4** | B7 (file grandi), poi **parte C** (scattante e compatibile) | `reader/mzml.py` (solo la parte indicata in B7), `browser-worker.js`, schermata di carico; poi `web/perf.js` (nuovo), `tests_e2e/lib.py`, `.github/workflows/test.yml`, correzioni puntuali |
Regole per lavorare in parallelo:
- Tocca solo i file del tuo blocco (se serve altro, il minimo indispensabile). Unisci in `main` alla fine di ogni blocco verde, dopo `git fetch origin && git merge origin/main` e una nuova verifica; conflitto non ovvio → non unire e scrivi a Federico.
- **S3, prima di B3** (il primo blocco che tocca `explore.js` e `spettro.js`): `git fetch origin && git merge origin/main`, così lavori sopra la parte A di S1 (A4.1 e B5 toccano le stesse funzioni di impilamento: `relayout`, `stackAfter`).
- **S4** non tocca `Run._index` né i campi di `Scan` (li cambia S3 in B2): vedi B7. In C3/C4 le correzioni a `explore.js` sono puntuali: prima di ognuna `git fetch origin && git merge origin/main`.
- **S1** nella parte D non tocca `drawSpec`: lo specchio sta nella finestra dei risultati. La voce «Cerca nelle librerie» va nel menu del clic destro degli spettri di livello 2 (una riga in `ctxFor`).
- In «Stato» ogni sessione aggiorna solo la sua riga.
- **`AGENTS.md`** (letto da chat senza memoria; S1 aggiunge anche la sezione «Librerie», S4 «Prestazioni e compatibilità»: scrivi per chi non sa niente, frasi brevi, con nomi di file e funzioni): ognuna aggiorna solo la sua parte. **S1**: sez. 2 (regole di lavoro: push a ogni punto, unione in `main` a ogni blocco verde, sessioni parallele con un file di prompt condiviso e la sezione «Stato», ripresa dopo un'interruzione, causa e rimedio del guasto dei test su Windows) e le sezioni dei file della parte A. **S3**: nuova sezione «Alta risoluzione e DDA» (B9). **S4**: in quella sezione, un paragrafo «File grandi» (`_FileBuf`, WORKERFS, soglie 50/300 MB, ricetta msconvert). Se due sessioni toccano `AGENTS.md`, il merge di righe diverse va da sé; in caso di conflitto tieni entrambe le versioni.

---

# PARTE A: ritocchi dell'interfaccia

## A0: test su Windows (sessione S1, per primo)
Da quando è entrato `tests/test_perdite.py` (PR #5, 7/10) la CI fallisce **solo su Windows** (`pytest (windows-latest, 3.11 e 3.14)`); Linux e macOS sono verdi. Causa probabile (i log non li ha visti nessuno): `subprocess.run([...node...], capture_output=True, text=True)` su Windows decodifica l'output di node con cp1252 e i caratteri Δ • − si rompono. Prima leggi il log (`gh run list -R Freeesta/QqQ-lab`, `gh run view <id> --log-failed`; serve `add_repo` in lettura). Se è questo: in `tests/test_perdite.py`, `test_calcola.py`, `test_cromato.py` (e ogni altro test che legge l'output di node) sostituisci `text=True` con `encoding="utf-8"`. Push e controlla che la CI sia verde anche su Windows (`gh run watch`). Se la causa è un'altra, correggi quella e scrivila in `AGENTS.md` (sez. 2, accanto alla nota sui file mmap su Windows).

---

# PARTE B: alta risoluzione (HR) e DDA

**Idea** (Federico, 7/10): il programma riconosce da solo che file ha davanti e **si mette nella modalità giusta**: bassa risoluzione (il 3200 QTRAP del laboratorio, come oggi) o alta risoluzione (Orbitrap, Q-TOF), con il DDA dentro il pacchetto HR. Nella stessa sessione possono stare file dei due tipi: ogni file (e ogni scansione) usa il suo profilo. **Se qualcosa dell'HR non funziona, il programma non si rompe**: il file si apre come oggi (bassa risoluzione) e un avviso breve lo dice.

## Cosa sappiamo già
**File di Federico** (misure del 7/10 con il lettore attuale; dati di ricerca, mai nel repository):
| | Orbitrap Fusion (DDA, CID 30, MS2 in Orbitrap) | Orbitrap Exploris 120 (DDA, HCD 30) |
|---|---|---|
| file / scansioni | 134 MB · 4 301 MS1 + 15 507 MS2 (≈3,6 MS2 per ciclo) | 443 MB · 21 085 MS1 + 20 901 MS2 (≈1 per ciclo) |
| risoluzione (MS:1000800) | 60 000 / 60 000 | 45 000 / 22 500 |
| isolamento (MS:1000828/829) | ±1,5 | ±0,75 |
| tabella dei picchi MS1 | 2,0 M picchi, 0,6 s | 22,8 M picchi, 8 s, 455 MB (1,8 GB di RAM in Python) |
| errore di massa su ioni noti | +2…+4 ppm sistematico | ±0,6 ppm |
| MS2 per picco cromatografico | 0-20 | 1-5 |
Ogni MS2 ha `<precursor spectrumRef="controllerType=0 controllerNumber=1 scan=N">` = la Full Scan madre. Centroidi (peak picking del vendor), zlib, 64 bit; m/z già rappresentabili in float32 (errore 0,0 ppm). Cromatogrammi nel file: solo TIC e «Pump Pressure» (da ignorare).
**Problemi nel codice di oggi**: modello dello strumento letto male (`metadata()` non segue `referenceableParamGroupRef`); spettri raggruppati a 0,1 Da (`Item._binned`, `Item.scans`, `bin` 0.1 in `api.py`) e m/z arrotondate a 3 decimali (`App.spectrum`, `App.spectra`): in una scansione Exploris 243 intervalli da 0,1 Da hanno più centroidi diversi; XIC unitaria (`XIC_BELOW`, `XIC_DRIFT`, `xicNominal`, `xicWin`, `TOL0`); `ms2_events` tagliato a 20 000; «CE … eV» mentre per Thermo l'energia è relativa (NCE, «no units» nel manuale); il browser copia tutto il file nella memoria di Pyodide (`FS.writeFile`) e anche in IndexedDB.
**Dai manuali Thermo** (FreeStyle 1.8 e Xcalibur Qual Browser 4.1, letti da Claude Opus; non serve rileggerli):
- *Profilo per analizzatore* (FreeStyle, «Default Mass Precision», p. 344): decimali FTMS 4, ITMS 2, TQMS 2, SQMS 1; tolleranza FTMS **5 ppm**, ITMS e TQMS 0,50 u, SQMS 1,00 u. Xcalibur ha le stesse due impostazioni globali («Global Mass Options»: tolleranza in mmu o ppm, numero di decimali).
- *Viste collegate*: cromatogramma in alto, spettri sotto; clic sul cromatogramma = lo spettro di quel tempo; **← → = scansione successiva/precedente; con un filtro di scansione attivo, la successiva che soddisfa il filtro** (FreeStyle p. 152).
- *Precursor Flag* (FreeStyle p. 164-166): nella Full Scan un triangolino sopra ogni picco che ha fatto partire una MS2; doppio clic = la MS2 in un'altra vista. Nella figura del manuale Full Scan e MS2 stanno **affiancate**, sotto il cromatogramma.
- *Nearby Precursors* (p. 167-169, 353): segna i picchi della scansione corrente che sono stati frammentati in **questa o in un'altra scansione entro ±1,00 min** (predefinito), al massimo **5** MS2 (le più vicine nel tempo), tolleranza = quella dello strumento; doppio clic = **media** di quelle MS2 (o le singole una sotto l'altra).
- *MSn Browser* (p. 170-174; Xcalibur p. 191-194): elenco dei precursori MS2 in ordine di m/z, raggruppati con una tolleranza (predefinita 0,50), filtrabile per intervallo di tempo; per ogni precursore: media e scansioni singole.
- *Intestazione dello spettro*: `nome #scansione RT: AV: NL:` e `T: filter string`; la MS2 dipendente riporta il numero della scansione madre («Master Scan Number»). Nel filter string `ms2 195.0877@hcd30.00` = precursore@energia relativa; i genitori delle scansioni dipendenti si confrontano con tolleranza m/z 1,0 (Xcalibur, tab. 9).
Prendiamo queste idee, senza la loro complessità: niente celle configurabili, niente albero MSn a più livelli, niente MS3.

## Scaletta di priorità (dall'inizio alla fine)
| # | Cosa | Perché in questo ordine |
|---|---|---|
| B0 | Dati sintetici HR (+ uno «rotto») | servono a tutti i test che seguono, anche nel cloud |
| B1 | **Profilo di massa automatico + interruttore + ripiego sicuro** | fondamenta: da qui passa ogni scelta HR; garantisce che nulla si rompa |
| B2 | Lettura HR (campi della scansione, madre, modello) | senza questi dati non c'è DDA |
| B3 | Spettri HR giusti (niente intervalli da 0,1 Da, decimali del profilo) | oggi gli spettri HR sono sbagliati: è l'errore più grave |
| B4 | XIC con la tolleranza del profilo (5 ppm) e impostazioni «Masse» nell'ingranaggio | è lo strumento principale per cercare i prodotti |
| B5 | **DDA base**: Full Scan e MS2 affiancate, bandierine dei precursori, ← → sulla MS2 | il cuore della richiesta di Federico |
| B6 | DDA completo: precursori vicini e media, «Segui questo ione», banda di isolamento, co-isolamento, elenco dei precursori | rende il DDA didattico |
| B7 | File grandi (float32, lettura a blocchi, WORKERFS, ricetta msconvert) | l'Exploris intero oggi non entra nel browser |
| B8 | Calcolatrice e perdite neutre con masse esatte e ppm | rifiniture utili |
| B9 | Interfaccia e didattica: badge, Metodo dal file, Teoria, `AGENTS.md` | chiusura |
Se il budget finisce, fermati dopo un blocco completo: B0-B5 da soli sono già un pacchetto utilizzabile.

**Fatto da S3** (B0-B6, B8, B9, 7/10): il lavoro e le sue trappole sono in `AGENTS.md` sez. 21; qui restano solo B7 (S4) e le parti C e D.

## B7: file grandi (`reader/mzml.py`, `browser-worker.js`, schermata di carico)
1. Tabella dei picchi **float32 solo per i profili hr** (`Run.table`): `mz` e `inten` float32, `pos` int32 (da 20 a 12 byte per picco; Exploris ~275 MB invece di 455); nella `xic` converti i limiti in float32. Il QqQ resta float64. Per sapere se il file è hr usa `getattr(self, "hr1", False)`: l'attributo `Run.hr1` (MS1 ad alta risoluzione) lo aggiunge S3 in B1; finché non c'è vale falso e non cambia niente. Se lavori in parallelo a S3 non toccare `profile.py`.
2. `Run(path, mode="file")`, usata per file su WORKERFS o > 300 MB (altrimenti mmap come oggi). **Senza toccare `_index`, `read` e i campi di `Scan`** (li cambia S3): scrivi una piccola classe `_FileBuf` che imita l'interfaccia di mmap usata dal lettore (`find(pat, start, end)` cercando a blocchi di 16 MB con sovrapposizione di `len(pat)`, `__getitem__(slice)` con `seek/read`, `__len__`, `close`) e in `Run.__init__` assegna `self._mm = _FileBuf(path)` invece di `mmap.mmap(...)`. pytest: stessi risultati nelle due modalità sui sintetici e su un file del QqQ.
3. `browser-worker.js`: file > 50 MB → niente `FS.writeFile`: `py.FS.mount(py.FS.filesystems.WORKERFS, { blobs: [{ name, data: blob }] }, "/big")` e `mode="file"`; file > 300 MB non in IndexedDB («file grande: dopo aver ricaricato la pagina va ricaricato»).
4. Profilo hr in **profilo** (MS1 con `MS:1000128`): avviso nella schermata di carico «File in profilo ad alta risoluzione: molto pesante, convertilo con il peak picking del vendor» + ricetta. Ricetta (anche in Teoria): `msconvert file.raw --mzML --zlib --filter "peakPicking vendor msLevel=1-"`; per alleggerire `--filter "scanTime [600,1500]"` (secondi) e `--filter "threshold count 300 most-intense"`.
5. File che non entra comunque: messaggio chiaro con la ricetta, mai un blocco silenzioso.
**Prova a mano per Federico** (scrivila nel messaggio di fine blocco): sito, file Exploris intero → si apre? tempo? memoria della scheda (Chrome, Gestione attività).

## Decisioni già prese (Federico può cambiarle prima di lanciare)
Tolleranza HR 5 ppm (predefinito di FreeStyle; copre anche lo scostamento del Fusion) · Full Scan e MS2 affiancate sopra 1100 px · un clic (non doppio) per aprire le MS2 · niente generatore di formule · test sui sintetici e sui due ritagli Orbitrap del repository privato · file grandi: WORKERFS + float32 + ricetta, niente soglia nell'ingranaggio · trio DDA anche per l'IDA del QTRAP.

---

# PARTE C: scattante e compatibile (sessione S4, dopo B7)
**Obiettivo di Federico**: il programma deve essere **il più scattante possibile** e funzionare con **qualsiasi browser recente** (Chrome, Edge, Firefox, Safari) su **Windows e Mac**. Prima si misura, poi si corregge ciò che le misure indicano; niente ottimizzazioni alla cieca.
- **C1. Misure** (`web/perf.js`, nuovo, classico): con `?perf` nell'indirizzo (o Ctrl+Alt+P) un riquadro piccolo in basso a sinistra mostra i tempi: avvio (download e avvio di Pyodide, primo disegno), carico di ogni file (lettura, indice, tabella dei picchi), ogni richiesta `/api/*` (ms) e ogni `draw` di pannello (ms, con il tipo); pulsante «Copia» che copia tutto come testo per Federico. Gli agganci in `explore.js` sono una riga (`window.PERF && PERF.t(...)`). Senza `?perf` non costa niente. Federico lo usa sul sito vero, su Safari e su Windows.
- **C2. Prove su più browser**: `tests_e2e/lib.py` sceglie il browser con `QQQ_BROWSER=chromium|firefox|webkit` (webkit = il motore di Safari); `tools/verifica.py --browser <nome>`. Nel cloud c'è solo Chromium: le prove su Firefox e WebKit le fa la **CI**: nuovo job `browser` in `.github/workflows/test.yml` con matrice `ubuntu-latest × {chromium, firefox, webkit}`, `windows-latest × chromium`, `macos-latest × webkit` (`python -m playwright install --with-deps <browser>`), che lancia solo gli e2e di fumo (`SMOKE` in `verifica.py`: `e2e3` + un e2e per scheda + `e2e_hr_base` se esiste) contro il server locale Python (niente Pyodide). Risultati con `gh run view`. Ogni guasto trovato → C3.
- **C3. Correzioni di compatibilità**: quelle trovate in C2, più i controlli noti: tasti scritti giusti per sistema (⌘ sul Mac, Ctrl su Windows/Linux: una funzione `MODK` usata in tutte le etichette e nella Teoria), canvas nitidi con `devicePixelRatio` non intero (1,25 e 1,5 sono comuni su Windows), font di ripiego per Windows (`Segoe UI`), nomi di file con `\` o caratteri accentati, trascinamento dei file su Windows, funzioni JavaScript non disponibili su Safari 16.4 (sostituiscile o aggiungi un controllo). Browser minimi dichiarati in README e in un avviso discreto se il browser è più vecchio: Chrome/Edge 110, Firefox 115, Safari 16.4.
- **C4. Più scattante** (incluso il caso dei **file in profilo**, formato consigliato dal prompt 3: nel container XIC dei 7 Full Scan 0,58 s in centroidi contro 2,94 s in profilo; guarda prima `Run.table`; caricamento, XIC e mappa in profilo li misura poi Federico in Pyodide con `?perf`) (solo dopo C1-C3, partendo dai tempi più lunghi misurati con il server locale e con i file veri del laboratorio): obiettivi indicativi, da scrivere in `AGENTS.md` con i valori misurati prima e dopo: un passo ← → nello spettro < 30 ms (15 scansioni al secondo senza scatti), XIC su un file del laboratorio < 300 ms, cambio di scheda < 100 ms. Tecniche ammesse: evitare ridisegni di pannelli non cambiati, raggruppare richieste uguali, spostare calcoli ripetuti fuori dai cicli, cache per file. Ogni ottimizzazione con il suo test che dimostra che il risultato non cambia. Non cambiare l'architettura (Pyodide resta).
- `AGENTS.md`: paragrafo «Prestazioni e compatibilità» (come si misura, browser provati, obiettivi e valori).

# PARTE D: confronto delle MS2 con le librerie (S1)
D1-D5 fatti (vedi `AGENTS.md` sez. 23). **D6** (solo se avanza tempo): «Cerca tutte le MS2 del file» (nel worker, comando `searchAll` già pronto; manca l'interfaccia e un modo di leggere tutte le MS2 del file: dopo B2/B5 di S3 si può usare `/api/dda` e `/api/scan`) → tabella precursore · RT · miglior risultato · punteggio, con barra di avanzamento.
- Idea per dopo (NON ora): **coseno modificato** fra la MS2 di un candidato prodotto di trasformazione e quella della madre (frammenti spostati del Δm fra i precursori) → piccola rete dei prodotti simili alla madre (molecular networking di GNPS).

---

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Sul Mac anche `python3 tools/prova_hr.py ../Data/HRMS` (solo numeri tecnici nel messaggio). Messaggio finale a Federico: una riga per blocco e **prove a mano** con Cmd+Shift+R: parte A punto per punto; file Exploris e Fusion veri sul sito; trio DDA (triangolino → MS2, ← → nella MS2, bandierine ▼ e ▽, media, «Segui questo ione»); XIC a 5 ppm contro interruttore «spenta»; un file del QqQ per controllare che nulla sia cambiato; `?perf` sul sito con Chrome, Safari e (se possibile) un PC Windows, e «Copia» dei tempi (anche con i 7 Full Scan in profilo); un vero file IDA / MRM-IDA-EPI; vista a cascata con 7 file; S/N su un picco vero; ingranaggio → Librerie → carica un MSP vero (es. MassBank o MoNA) → clic destro su una MS2 → «Cerca nelle librerie». Aggiorna `AGENTS.md` e cancella da questo file ciò che è fatto.

---

## Lavori in coda (NON fare: decisioni di Federico)
- Rinominare anche repository, pacchetto e indirizzo del sito con il nome nuovo (passo separato, da decidere con Federico: GitHub fa il redirect dei repository, ma l'indirizzo del sito cambia).
- Coseno modificato e rete dei prodotti di trasformazione simili alla madre (vedi fine della parte D).
- **Resti del prompt 3** (7/10; dettagli in `AGENTS.md` sez. 19). *Per Federico, a mano*: riconvertire in profilo i file per gli studenti e i 5 file di esempio del sito (nomi neutri `Esempio_FullScan_t*`), poi aggiornare le istruzioni di conversione (`#wiffhelp`) e il README; decidere sui file mzML senza estensione (MSConvert ha scritto `FullMass-t30`). Nel profilo l'Excel dello spettro ha solo le cime (il profilo intero solo se Federico lo chiede); in una scansione rumorosa una spalla di M può battere M+1 (prominenza minima, se serve).
