# PROSSIMA CHAT 2 (QqQ lab): spettro e menu, intestazioni compatte, finestra XIC, perdite neutre

> **Come si usa questo file**: contiene SOLO il lavoro da fare. Quando un punto è fatto e verificato, **cancellalo da qui** (niente «fatto», niente cronaca); ciò che resta utile (nomi di funzioni, decisioni) va in `AGENTS.md`. Se alla fine il file è vuoto, spostalo in `_cestino/<data>_prompt_completati/`.
> Il lavoro dei prompt precedenti (blocchi A, S, G, B, C, F, H, I, D, E) è già in `main` (pull request #2 e #3). Alcuni punti qui sotto ritoccano cose fatte lì: parti dal codice attuale e adatta, non rifare.

Lavori in `~/QqQ_lab/QqQ_lab` (Mac) o nel clone GitHub (cloud, con il repository `QqQ-lab-dati` per i dati veri). Leggi `AGENTS.md` sez. 1-2, 5 e le ultime sezioni (16-17 e seguenti); poi SOLO il codice che serve, con `grep -n` (i nomi di funzione qui sotto sono indicativi: cercali). Non leggere `vendor/`.

## Regole fisse
- Interfaccia in italiano; codice e commenti in inglese; sempre «m/z». Non cancellare file (`_cestino/`). Il programma non dà risposte agli studenti.
- Interfaccia **pulita e semplice**: di default poco, i dettagli per chi li vuole (tendine, «Dettagli»). Icone con etichetta breve (1-2 righe) al passaggio del mouse.
- **Risparmio token**: un blocco alla volta; file toccati letti una volta sola; prove mirate; screenshot salvati in `tests_e2e/shots/` e **guardane al massimo uno per punto** (gli altri sono per Federico).
- **Verifica**: `python3 tools/verifica.py --solo <e2e che tocchi>` durante il lavoro, completa alla fine. **Non lanciare** e2e13, e2e_tpmine1, e2e_tpmine2, `tools/build_site.py` né nulla che scarichi Pyodide (decisione di Federico).
- Un commit per blocco (titolo in italiano, righe Co-Authored-By e Claude-Session del messaggio di sistema); sul Mac su `main`, nel cloud sul ramo della sessione e **una sola pull request alla fine** (Federico la unisce solo quando hai finito).
- **Aggiorna Federico** alla fine di ogni blocco con 3-5 righe: fatto, non fatto, cosa provare a mano.
- Se il budget sta finendo: fermati dopo un commit pulito e aggiorna questo file.

## Ordine di lavoro (i blocchi sono raggruppati per file, così leggi ogni file una volta)
4. **Perdite neutre** (`web/tables.js`, Teoria cap. 8)

---

## BLOCCO 4: perdite neutre (scheda «Perdite neutre» in `web/tables.js`)

**Fonti.** Federico ha fatto fare una ricerca con fonti secondarie deboli e alcuni errori (es. «probabilità > 95%» per la perdita di 32 Da e «circa il 7%» di perdite radicaliche: non verificati; «H₂S = idrossido solforato»: sbagliato, è solfuro di idrogeno). Usa SOLO le fonti primarie e verifica ogni riga; masse esatte calcolate con `qqq_lab/chem/elements.py`, mai copiate:
- K. Levsen et al., *J. Mass Spectrom.* 42 (2007) 1024-1044, «Even-electron ions: a systematic study of the neutral species lost…» (PubMed 17605143);
- M. Holčapek, R. Jirásko, M. Lísa, *J. Chromatogr. A* 1217 (2010) 3908-3921, «Basic rules for the interpretation of atmospheric pressure ionization mass spectra of small molecules» (PubMed 20303090);
- L. Demarque et al., *Nat. Prod. Rep.* 33 (2016) 432-455, «Fragmentation reactions using electrospray ionization mass spectrometry…»;
- T. De Vijlder et al., *Mass Spectrom. Rev.* 37 (2018) 607-629, «A tutorial in small molecule identification via electrospray ionization-mass spectrometry…» (PubMed 29120505).
Un dato non verificabile → fuori, o «da verificare» nel messaggio. Niente percentuali non verificate nell'interfaccia.

**4.1 Vista semplice di default.** Una riga per perdita (circa 20, per Δm crescente): **Δm** intero grande, **formula**, **nome**, **«si vede in…»** (una riga), **polarità tipica** (icone +/−). Elenco da verificare: •CH₃ 15, NH₃ 17, H₂O 18, HF 20, HCN 27, CO 28, C₂H₄ 28, CH₂O 30, CH₃OH 32, H₂S 34, HCl 36, CH₂CO 42, C₃H₆ 42, CO₂ 44, HCOOH 46, •NO₂ 46, SO₂ 64, C₆H₆ 78, HBr 80, SO₃ 80 (più altre ben documentate utili per inquinanti/pesticidi; niente perdite tipiche solo di peptidi o lipidi).

**4.2 «Dettagli».** Pulsante o clic sulla riga: massa esatta (4 decimali, calcolata), meccanismo in 1-2 righe, riferimento (autore anno). Chiuso di default.

**4.3 Stessa massa nominale.** 28 (CO / C₂H₄), 42 (chetene / propene), 46 (HCOOH / •NO₂), 80 (HBr / SO₃) in un blocco con bordo e una riga: «a risoluzione unitaria non si distinguono: servono altri indizi». Per 80: «guarda M+2 nella scheda Isotopi (Br: M e M+2 quasi uguali)», con link alla scheda.

**4.4 Radicali.** •CH₃ e •NO₂ con «•» ed etichetta: «perdita di un radicale: rara in ESI (eccezione alla regola degli elettroni pari), di solito anelli aromatici o gruppi nitro».

**4.5 «Cerca Δm».** Campo in cima: un numero (es. 62) evidenzia le righe con quel Δm (±0.5) e mostra sotto le **coppie** che lo sommano (62 = H₂O + CO₂) e le **ripetizioni** (72 = 2 × HCl), sotto il titolo «Possibili perdite (da verificare sullo spettro)». Elenco di candidati, non attribuzione.

**4.6 Polarità.** Pulsanti «+ / − / tutte», impostati all'apertura sulla polarità dei file caricati.

**4.7 Dal righello.** Nel menu del clic destro di una misura del righello: «Cerca 170.0 nelle perdite neutre» → apre la scheda con 4.5 compilato. Il righello da solo mostra solo il numero.

**4.8 Teoria cap. 8.** Mezza pagina: regola degli elettroni pari ed eccezioni radicaliche; perdite isobare a risoluzione unitaria (come distinguerle: isotopi, altre perdite); perdite in cascata (−18 poi −44 = −62); cenno alla Neutral Loss Scan (Q1 e Q3 con Δm fisso, collegata al cap. 9). Esempi solo su composti NON dei metodi del laboratorio. Bibliografia con le 4 fonti. Nessun disclaimer ripetuto.

**4.9 Test.** pytest: masse esatte = `elements.py`; 62 → H₂O + CO₂; 72 → 2 × HCl. e2e: vista semplice, «Dettagli», gruppo 28, ricerca 62, filtro di polarità, voce dal righello.

---

## Chiusura
`python3 tools/verifica.py` completo (i test Pyodide li salta da solo). Messaggio finale a Federico: una riga per punto (fatto / non fatto e perché), cosa provare a mano con Cmd+Shift+R, dati della ricerca rimasti «da verificare». Aggiorna `AGENTS.md` (picco del clic destro, spettro vivo/congelato, lucchetto, tooltip, annotazioni, intestazioni in una riga, zoom sugli assi, finestra XIC, perdite neutre) e cancella da questo file ciò che è fatto.
