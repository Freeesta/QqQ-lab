# PROSSIMA CHAT 3 (QqQ lab): integrazione dei picchi, schermo intero, testo dei grafici, strumenti dell'header

> **Quando usarlo**: DOPO che il lavoro di `PROMPT_PROSSIMA_CHAT_2.md` (pull request #5) è stato unito in `main`. Alcuni punti toccano cose cambiate da quella chat (calcolatrice, Addotti, intestazioni, tooltip): parti dal codice attuale e adatta, non rifare.
> **Come si usa questo file**: contiene SOLO il lavoro da fare. Quando un punto è fatto e verificato, **cancellalo da qui**; ciò che resta utile (nomi di funzioni, decisioni) va in `AGENTS.md`. Se alla fine il file è vuoto, spostalo in `_cestino/<data>_prompt_completati/`.

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con il repository `QqQ-lab-dati` per i dati veri). Leggi `AGENTS.md` sez. 1-2, 5 e le ultime sezioni; poi SOLO il codice che serve, con `grep -n` (i nomi qui sotto sono indicativi: cercali). Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti.
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole. Icone con etichetta breve al passaggio del mouse.
- **Risparmio token**: un blocco alla volta; file letti una volta; prove mirate; screenshot in `tests_e2e/shots/`, guardane al massimo uno per punto.
- **Verifica**: `python3 tools/verifica.py --solo <e2e che tocchi>` durante il lavoro, completa alla fine. **Non lanciare** nulla che usi Pyodide (e2e13, e2e_tpmine*, `tools/build_site.py`).
- Un commit per blocco (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema). Sul Mac: su `main`. **Nel cloud** (decisione di Federico, 7/10): lavora sul ramo della sessione, push dopo ogni blocco; **alla fine, se la verifica completa è verde, unisci tu la pull request in `main`** senza aspettare Federico (`gh pr create` se non c'è ancora, poi `gh pr merge <numero> --merge --delete-branch`), e cancella anche gli altri rami `claude/...` già uniti in `main` (`git branch -r --merged origin/main`). Se qualcosa è rosso, se c'è un conflitto o una decisione da prendere, **non unire**: lascia la PR aperta e spiega a Federico perché. Se `gh` non ha il permesso di unire, scrivilo e lascia la PR aperta. Riporta questa regola in `AGENTS.md` sez. 2 (al posto di «il push lo fa Federico» per le sessioni cloud).
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano. Se il budget sta finendo: fermati dopo un commit pulito e aggiorna questo file.

## Ordine di lavoro (per importanza)
1. ~~Integrazione dei picchi e file in profilo~~ (fatto il 7/10, vedi `AGENTS.md` sez. 19)
2. ~~Schermo intero~~ (fatto il 7/10, `AGENTS.md` sez. 19)
3. ~~Dimensione del testo anche dentro i grafici~~ (fatto il 7/10, `AGENTS.md` sez. 19)
4. ~~Strumenti dell'header e schermata di caricamento~~ (fatto il 7/10, `AGENTS.md` sez. 19)
5. ~~Rifiniture~~ (fatto il 7/10)
6. ~~Disegno~~ (fatto il 7/10)
7. ~~Simboli~~ (fatto il 7/10)
8. **Ordine di cartelle e file** (inventario, cartelle vuote, cestino fuori da git, test obsoleti): per ultimo

---

## BLOCCO 8: ordine di cartelle e file (fallo per ultimo)
Federico vede cartelle vuote o che non hanno più senso. Fai un **inventario completo** e lascia una struttura pulita. Regole: nessuna cancellazione definitiva (sposta in `_cestino/<data>_pulizia/`), niente dati di laboratorio nel repository (salvo i 4 file di esempio, se Federico li conferma), un file che è ancora usato da codice, test, CI o sito NON si sposta.

**8.1 Cosa ho già visto (7/10, da verificare e sistemare):**
- `QqQ_lab_privato/` nella radice: è **vuota** (solo `.DS_Store`), resto del vecchio nome di `TP_Mine/`. Toglila (e la riga in `.gitignore` se non serve più).
- `_cestino/` è **tracciato da git** (nel repository pubblico ci sono `PROMPT_CHAT_SCORRIMENTO.md`, `PROMPT_PROSSIMA_CHAT_1.md`, `Teoria QqQ lab.html`, `calib.js`), e sul Mac quei file sono già stati tolti a mano. Il cestino è locale, non deve andare su GitHub: aggiungi `_cestino/` a `.gitignore` e `git rm -r --cached _cestino` (i file restano dove sono sul disco). Aggiorna la regola in `AGENTS.md` sez. 2 («il cestino è locale e non è nel repository»).
- Cartelle e file solo locali e già ignorati, da non toccare nel repository ma da segnalare a Federico se occupano spazio: `qqq_lab.egg-info/`, `.pytest_cache/`, `__pycache__/`, `.vscode/`, `.DS_Store`.

**8.2 Inventario da fare** (una tabella nel messaggio a Federico: file o cartella → a cosa serve → chi lo usa → tenere / spostare / unire). Cerca gli usi con `grep -rn` (codice, test, `.github/workflows`, `tools/build_site.py`, `index.html`):
- `qqq_lab/` (moduli Python: c'è ancora qualcosa che nessuno importa? es. resti della versione da computer accanto a `app.py`);
- `qqq_lab/web/` (script, immagini, icone: ognuno è caricato da `index.html`, dal worker o dal sito? `origine.js` è senza ingressi dal 7/10 ma serve a TP Mine? icone `app-icon*`/`apple-touch-icon` servono ancora senza installazione come app?), `web/esempi/` (nomi neutri, vedi 4.4), `web/teoria/` (capitoli tutti nel menu? il cap. 13 resta);
- `tools/` (ogni script è ancora usato o documentato? es. `validate_ionfamily.py`, `genera_glossario.py`, `dev_server.py`);
- `tests/` e `tests_e2e/` (46 file): test di funzioni tolte (retta di taratura, «Da dove viene?», menu Ione, Isotopi nell'header…) da adattare o spostare; aiuti che non sono test (`lib.py`, `synth.py`, `make_examples.py`, `lat_arrows.py`) messi in chiaro (es. sottocartella `tests_e2e/tools/` o almeno elencati in `verifica.py` `NOT_TESTS`); e2e con lo stesso scopo da unire. Ogni e2e rimasto deve passare con `tools/verifica.py`;
- radice: solo ciò che serve (`AGENTS.md`, `README.md`, `LICENSE`, `LICENZE-TERZI.md`, `pyproject.toml`, i prompt aperti, cartelle del codice). `pyproject.toml`: dipendenze e voci ancora coerenti con un programma che vive solo nel browser e con il server di sviluppo dei test.
**8.3** Aggiorna `AGENTS.md` sez. 3 (mappa del codice) in modo che corrisponda esattamente a ciò che resta, e `README.md` se cita file spostati. e2e/pytest completi alla fine.

---

## Lavori in coda (NON farli senza il via libera di Federico)
1. **Dati dello studente**: `navigator.storage.persist()` + spazio usato; Esporta/Importa sessione (.zip con file, `taccuino.json`, `LEGGIMI.txt`; la scrittura zip c'è in `xlsx.js`). Dove mettere i pulsanti: da decidere con Federico (l'ingranaggio ha 3 controlli).
2. **Origine degli ioni / frammenti in sorgente**: la finestra «Da dove viene?» è nascosta; proposta di Claude in attesa di risposta di Federico: (a) «impronta del t0» (ioni presenti all'apice del progenitore nel t0 segnati negli altri spettri), (b) XIC normalizzati sovrapposti con Δ apice, (c) colonna «rapporto con una traccia di riferimento» nella tabella delle integrazioni, (d) eventuale prova in laboratorio con il t0 a due DP diversi. TP Mine: `isf.isf_classify` → flag `insource` (verifica se già fatto); `/api/origin` lento in Pyodide (19-38 s).
3. **Conversione e dati (Federico)**: decisione del 7/10: **profilo** come formato consigliato (MSConvert senza filtro peakPicking; MRM invariato, mai «SRM as spectra»), centroidi ancora accettati. Da fare: riconvertire in profilo i file che si danno agli studenti e i 4 file di esempio del sito (con nomi neutri, punto 4.4); aggiornare le istruzioni di conversione nella schermata di caricamento (`#wiffhelp`) e nel README dopo che il punto 1.3 è fatto. Nota: MSConvert ha scritto il campione t30 come `FullMass-t30` **senza estensione `.mzML`**: un file così non si può scegliere nella schermata di caricamento (`accept=".mzML"`); valuta di accettare anche i file senza estensione riconoscendo l'mzML dal contenuto.
4. **Da provare a mano (Federico, non la chat)**: Windows, Safari, file grandi; un vero file IDA / MRM-IDA-EPI del 3200 QTRAP (il Blocco I è provato solo su dati sintetici); la vista a cascata con 7 file; S/N con la zona di rumore su un picco vero.

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Messaggio finale a Federico: una riga per punto (fatto / non fatto e perché), cosa provare a mano con Cmd+Shift+R. Aggiorna `AGENTS.md` (integrazione senza sovrapposizioni e annulla, schermo intero, testo dei grafici, header senza Isotopi, calcolatrice, Addotti) e cancella da questo file ciò che è fatto.
