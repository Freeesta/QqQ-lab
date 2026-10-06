# PROSSIMA CHAT (QqQ lab): da misurare e lavori in coda

> **Come si usa e si mantiene questo file.** Contiene SOLO il lavoro ancora da fare. Quando una sezione, un punto o una sotto-voce è fatta e verificata, **cancellala da questo file** (non segnarla «fatta», non lasciare cronaca: la storia sta in `git log` e in `AGENTS.md`); le conoscenze che restano utili (nuove regole, nomi di funzioni, decisioni) vanno in `AGENTS.md`. Se resta una parte fatta a metà, riscrivila come ciò che manca. Rinumera i punti e le sezioni rimaste. Se tutto è fatto, il file deve ridursi a poche righe («niente in coda») più le Regole fisse. L'aggiornamento di questo file fa parte dello stesso commit del lavoro.

Lavori nella cartella `~/QqQ_lab/QqQ_lab`. Leggi prima `AGENTS.md`. Una sola chat alla volta sulla cartella. Prima di modificare `index.html`, `AGENTS.md`, `explore.js` o `draw.js`, ri-leggi la versione sul Mac, perché un'altra chat può averli cambiati. Non sovrascrivere con copie vecchie.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese.
- "m/z" sempre in forma inglese.
- Nei testi pubblicati niente apici o pedici unicode e niente trattini lunghi.
- Non cancellare file: spostali in `_cestino`.
- Il programma non deve dare agli studenti le risposte.
- Un commit solo, con titolo in italiano e le righe di attribuzione richieste. Il push lo fa Federico.
- Testa con Playwright (e2e e pytest, lanciati separatamente con timeout lunghi), poi fai un report breve.
- Lavora direttamente su `main` (una sola chat alla volta), senza creare rami.
- Risparmio token (AGENTS.md sez. 2): un solo lotto di modifiche, `grep -n` per trovare i punti, non rileggere file già letti, prova UNA volta alla fine, un solo commit.

---

## SEZIONE 1: da fare e da verificare (residui della chat del 6-7 ottobre 2026)
1. **Finestra XIC: misura con i dati veri.** La finestra è [n-0.2, n+0.8] (`XIC_BELOW`, `XIC_DRIFT` in `explore.js`), scelta con i numeri di `AGENTS.md` (centroidi +0.14..+0.37 Da sopra il calcolato) perché i mzML veri non erano disponibili. Misura la parte frazionaria (osservato meno nominale del calcolato) dei centroidi sugli ioni forti di TUTTI i file full scan (`tools/verifica.py` trova i dati), conferma o cambia le due costanti e scrivi i numeri in `AGENTS.md` sez. 12.
2. **Esegui gli e2e con i dati veri** (`python3 tools/verifica.py`): e2e13, 17, 19, 20, 21, 23 e le parti di e2e3, 5, 12, 18 sull'XIC sono stati adattati alla nuova finestra ma non eseguiti. Correggi ciò che fallisce.
3. **Test limiti RT**: in `e2e26.py` il trascinamento fuori dal cromatogramma non crea una selezione (`r0` resta null), quindi la prova è debole; rendila effettiva (selezione con lo strumento giusto) o testa `xd()` direttamente.
4. **`Teoria QqQ lab.html` nella radice**: chiedi a Federico se serve ancora; se no spostala in `_cestino/` (e correggi `web/teoria/LEGGIMI.md` riga 21).
5. **Verifica a mano di Federico** (Cmd+Shift+R): vedi l'elenco nel report del commit; segnala ciò che non va.

---

## SEZIONE 2: lavori in coda (NON farli senza il via libera di Federico)
1. **Salvataggio e sicurezza dei dati dello studente** (proposta, da approvare). Oggi nel browser file e taccuino stanno in IndexedDB (si perdono in finestra privata o cancellando i dati del sito).
   - «Cancella dati» visibile: già fatto con «Nuova sessione» (ingranaggio); non duplicarlo.
   - `navigator.storage.persist()` al primo caricamento, e in Impostazioni se è concesso e quanto spazio usa la sessione (`navigator.storage.estimate()`); poche righe.
   - Esporta/Importa sessione (.zip): file caricati, `taccuino.json` (pannelli, integrazioni, etichette, colori, bianco interno), `LEGGIMI.txt`; importa ricrea la sessione su un altro computer (salvataggio di sicurezza e consegna del lavoro). La scrittura zip esiste già in `xlsx.js`, serve un lettore zip o `DecompressionStream`. Nota: le Impostazioni ora hanno solo 3 controlli (`AGENTS.md` sez. 16): se si fa, decidi con Federico dove mettere il pulsante.
   - Versione locale: niente `.exe` PyInstaller (antivirus). Cartella di lavoro `QqQ_lab_lavoro/sessione_AAAA-MM-GG_hhmm` con percorso mostrato in un punto fisso e pulsante «Apri cartella».
   Ordine consigliato: cancella dati, persist, esporta/importa, cartella locale.
2. **Origine degli ioni (residui, verifica lo stato nel codice e con `git log` prima di fare qualcosa: i commit 0b7be1b e de38aca ne hanno già toccati alcuni).** (a) Pyodide: `/api/origin` su 5 file reali era 19 s a caldo e 38 s a freddo (1.6 s in locale), obiettivo < 10 s; tagli: solutore a banda per `asls_baseline`, meno ROI, bootstrap più corto; poi rimisurare con `tools/build_site.py` + `e2e13.py`. (b) Standard puro = t0 (deciso da Federico): ogni ione con picco all'apice del progenitore in t0 è per costruzione ISF/isotopo/addotto/impurezza (evidenza forte da mostrare come tale); r0 = F/P misurato in t0 è l'atteso negli altri campioni e l'ECCESSO F_t - r0*P_t è il contributo di un eventuale TP isobaro co-eluente; prior alto di ISF per ioni più leggeri co-eluenti. Da decidere: MS2 del progenitore 364 e acquisizioni a più DP (rampa DP solo sintetica). (c) TP Mine (privato): collegare `isf.isf_classify` al flag `insource` di `engine.py` (verifica se già fatto).
3. **Da verificare a mano da Federico** (non farlo fare alla chat): Windows e prima apertura offline del sito, Safari, file molto grandi; nomi veri degli standard (concentrazione indovinata), finestra di integrazione comune Quant/Qual, retta di taratura contro Analyst (RT, aree, rapporto Quant/Qual); misura su Pyodide della latenza di `api/spectrum` per scansione.
4. **Limiti noti** (non nasconderli): file con MS1 e MS2 insieme (data-dependent) trattati come MS2; etichette dell'asse x dello spettro affollate con intervallo MS2 stretto; i controlli del cromatogramma TIC a 1500 px vanno su una seconda riga (voluto); spettri UV del PDA non decodificati (negli mzML c'è solo `TWC`; vedi `AGENTS.md` sez. 16).
