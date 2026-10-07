# PROSSIMA CHAT (QqQ lab): grafici più puliti, strumenti per lo spettro, meno aiuti invadenti, calcolatrice, licenze

> **Come si usa e si mantiene questo file.** Contiene SOLO il lavoro ancora da fare. Quando un punto è fatto e verificato, **cancellalo da questo file** (niente «fatto», niente cronaca: la storia sta in `git log` e in `AGENTS.md`); le conoscenze utili (regole, nomi di funzioni, decisioni) vanno in `AGENTS.md`. Una parte fatta a metà si riscrive come ciò che manca. Rinumera. L'aggiornamento di questo file è nello stesso commit del lavoro.

Lavori in `~/QqQ_lab/QqQ_lab` (sul Mac) oppure nel clone GitHub (cloud). Leggi `AGENTS.md` (sez. 1-2, 5, 16 e le righe di sez. 3 sui file che tocchi), poi solo i punti di codice indicati qui con `grep -n` (i numeri di riga sono indicativi). Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z».
- Non cancellare file: `_cestino/` (nel cloud: `git mv` in `_cestino/<data>/`).
- Il programma mostra i dati, non dà risposte agli studenti.
- Lavora su `main` (sul Mac) o sul ramo della sessione (cloud, poi pull request). Un commit per blocco concluso (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema). Il push lo fa Federico (sul Mac).
- **Verifica con `python3 tools/verifica.py`** (AGENTS.md sez. 5): `--solo e2eN,...` durante il lavoro, completa alla fine; leggi `.verifica/ultimo.md` e i log SOLO dei FAIL. Dati veri: `QQQ_MZML`/`QQQ_DAM` o il repository privato `Freeesta/QqQ-lab-dati`.
- Risparmio token: un blocco alla volta, `grep -n`, non rileggere file già letti, prove mirate.
- Federico vuole un'interfaccia **pulita**: meno testi di avviso, meno «?», meno pulsanti. Nel dubbio, togli.
- **Semplice prima di tutto**: dai precedenza a ciò che serve di più agli studenti nell'esperienza (spettri, XIC, integrazione); le funzioni avanzate devono restare nascoste finché non servono (menu, pannello «Parametri»), mai aggiungere righe di controlli fisse. Preferisci **icone** (SVG nello stile di `QICON`, con `currentColor`) con un'**etichetta breve** che compare restando fermi ~1.5 s (1-2 righe, cosa fa e come si usa), non testi fissi.
- **Aggiorna Federico**: alla fine di OGNI blocco scrivigli un messaggio breve (3-5 righe): cosa hai fatto, cosa non hai potuto fare, cosa provare a mano. Se un punto richiede una scelta che cambia l'interfaccia in modo non descritto qui, fai la versione più semplice e segnalalo nel messaggio.

## Ordine di lavoro (per importanza)
(I blocchi A, S, G, B, C, F e H sono fatti: vedi `AGENTS.md` sez. 17. Restano da rifinire: nel menu «Correzione» le voci non hanno ancora l'icona con etichetta (è un menu a tendina con `title`).)
1. **Blocco I** file misti (DDA, Full Scan + MS2, MRM + EPI, polarità alternate): non urgente, solo dopo gli altri
2. **Blocco D** licenze
3. **Blocco E** residui
Un commit per blocco e un messaggio a Federico per blocco. Se il tempo o i token finiscono, fermati dopo un commit pulito: è meglio finire bene i blocchi 1-2 che iniziare tutto.

---

## BLOCCO I: file «misti» (più tipi di esperimento nello stesso file) — non urgente
**Perché**: nei dati del laboratorio oggi ogni file ha un solo tipo di esperimento, ma il 3200 QTRAP può acquisire nello stesso file: (a) **IDA/DDA** a bassa risoluzione (survey EMS o Q1 + EPI/product ion sui precursori più intensi, precursori diversi a ogni ciclo); (b) Full Scan + MS2 su precursori fissi; (c) MRM + EPI (MRM-IDA-EPI, molto comune sui QTRAP); (d) polarità positiva e negativa alternate. **Oggi** `Item.kind()` (`explore.py` ~r.55) sceglie un solo tipo: se c'è anche una sola scansione MS2 il file diventa «ms2» (il Full Scan sparisce dalla scheda Full Scan); scansioni + cromatogrammi SRM diventano «full» (l'MRM si perde). `AGENTS.md` lo segna come limite noto.
**Proposta da realizzare (dividere il file per esperimento, senza duplicare i dati)**:
1. **Un file, più «parti»**: in `explore.py` un file misto produce più voci logiche con lo stesso percorso e un filtro: Full Scan (scansioni di livello 1, per polarità), MS2 (scansioni di livello 2, raggruppate per precursore come già fa `_ms2_exps`), MRM (cromatogrammi SRM). Ogni parte va nella sua scheda (Full Scan / MS² / MRM) con il nome del file e un suffisso breve («· MS1», «· MS2», «· MRM», «· neg»); tempo, tipo di campione e colore sono gli stessi del file. `Item.total`, `spectrum`, `xic`, `mrm` ricevono già livello/precursore: usa quelli, non leggere il file due volte (stessa `Run` in cache).
2. **Schermata di caricamento**: nella colonna Esperimento il file misto mostra «misto: Full Scan + MS2 (12 precursori)» ecc.; il tempo si scrive una volta per tutte le parti.
3. **DDA**: nella scheda MS² i precursori di un DDA sono molti e con poche scansioni: raggruppali per m/z (tolleranza ±0.5) nella lista, ordinati per numero di scansioni. Nella scheda Full Scan, sul cromatogramma della parte MS1, piccoli **triangoli** sopra la traccia nei tempi in cui è partita una MS2 (interruttore «mostra le MS2», spento di default); clic su un triangolo = apre lo spettro MS2 di quella scansione nella scheda MS². È una vista dei dati acquisiti, non una risposta.
4. **Polarità**: se il file alterna positivo e negativo, due parti separate («· pos», «· neg»), mai sommate nello stesso TIC.
5. **Test**: nei dati veri non c'è un file misto: aggiungi a `tools/dati_sintetici.py` un file IDA sintetico (survey + EPI con precursori variabili), un MRM+EPI e uno a polarità alternata, e pytest per la divisione in parti + un e2e. Chiedi a Federico (nel messaggio di fine blocco) se può acquisire un vero file IDA/MRM-IDA-EPI al 3200 QTRAP per confermare il formato dell'mzML (ProteoWizard: livelli, `precursor`, filtri).

---

## BLOCCO D: licenze nel README (fallo per bene)
1. Elenca TUTTO il materiale di terzi presente nel repository e nel sito: Ketcher (`vendor/ketcher`, licenza in `vendor/ketcher/LICENSE.txt`), OpenChemLib (`vendor/openchemlib.LICENSE`), Pyodide (scaricato da `tools/build_site.py`), numpy, eventuali font, dati di masse/abbondanze (`tools/genera_elementi.py`: masse da OpenChemLib, pesi da Ketcher, abbondanze IUPAC), immagini della Teoria, **il logo** (`tools/logo_sorgente.jpg`: secondo `AGENTS.md` sez. 3 deriva da `QuadrupoleContour.svg` di **Wikimedia Commons**, passato in un generatore di immagini Gemini). Leggi le licenze dai file in `vendor/` (solo il file di licenza, non il codice).
2. Per il logo: verifica la licenza della pagina Commons di `QuadrupoleContour.svg` (WebFetch su `commons.wikimedia.org/wiki/File:QuadrupoleContour.svg`). Se è CC BY-SA o simile: attribuzione (autore, link, licenza) nel README e in `qqq_lab/web/teoria` o nel «?» generale, e nota sul fatto che il logo derivato va distribuito con la stessa licenza; se il sito non è raggiungibile, scrivilo e lascia il punto aperto qui. Non decidere tu di cambiare logo: segnalalo a Federico se la licenza è un problema.
3. Nel `README.md` una sezione **«Licenze e crediti»**: licenza del programma (MIT, `LICENSE`), poi una riga per componente (nome, versione se nota, licenza, link, dove si trova). Se serve, un file `LICENZE-TERZI.md` con i testi o i link completi. Controlla che `tools/build_site.py` copi nel sito i file di licenza di Ketcher/OpenChemLib/Pyodide richiesti dalle loro licenze; se no, aggiungilo.

---

## BLOCCO E: residui da verificare
1. **Finestra XIC [n-0.2, n+0.8]** (`XIC_BELOW`, `XIC_DRIFT` in `explore.js`): misura con i dati veri la parte frazionaria (centroide osservato meno nominale del calcolato) sugli ioni forti di TUTTI i file Full Scan; conferma o cambia le costanti e scrivi i numeri in `AGENTS.md` sez. 12.
2. **e2e con i dati veri**: `python3 tools/verifica.py` completo; correggi ciò che fallisce (in particolare e2e12, che non trovava `#pick`, ed e2e13, 17, 19, 20, 21, 23 non eseguiti dopo la finestra XIC nuova).
3. **e2e26 (limiti RT)**: la selezione non si crea, la prova non prova nulla: rendila effettiva o testa direttamente la funzione di limite.

---

## Lavori in coda (NON farli senza il via libera di Federico)
1. **Dati dello studente**: `navigator.storage.persist()` + spazio usato; Esporta/Importa sessione (.zip con file, `taccuino.json`, `LEGGIMI.txt`; la scrittura zip c'è in `xlsx.js`). Dove mettere i pulsanti: da decidere con Federico (l'ingranaggio ha 3 controlli).
2. **Origine degli ioni**: Pyodide lento (`/api/origin` 19-38 s, obiettivo < 10 s); standard puro = t0 (eccesso F_t - r0*P_t); TP Mine: `isf.isf_classify` → flag `insource` (verifica se già fatto).
3. **Da provare a mano (Federico)**: Windows, Safari, file grandi, retta di taratura contro Analyst.
4. **Limiti noti** (non nasconderli): PDA solo TWC (niente spettri UV); file misti finché il Blocco I non è fatto.

## Chiusura
- `python3 tools/verifica.py` completo; ultimo messaggio a Federico (report breve): riassunto prima/dopo, una riga per punto (fatto / proposta / non fatto e perché), elenco dei testi tolti (B2), cosa provare a mano con Cmd+Shift+R.
- Aggiorna `AGENTS.md` (decisioni cambiate: Excel sul TIC, niente «?» sparsi, principio 4, zoom e scorciatoie, lucchetto solo y, calcolatrice, % negli MS2, menu più corti, un solo profilo isotopico, «Correzione» al posto dei tre bianchi, scheda MS² con una coppia di pannelli, retta di taratura tolta, «Da dove viene?» nascosto, righello, tabella dei picchi, assi collegati, S/N e parametri del picco, cascata) e cancella da questo file ciò che è fatto.
