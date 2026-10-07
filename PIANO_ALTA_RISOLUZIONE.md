# PIANO: modalità «alta risoluzione» (Orbitrap, Q-TOF)

> **Stato**: piano da approvare con Federico (7/10/2026). NON eseguire prima delle sue decisioni (in fondo) e prima che i prompt 3 e 4 siano uniti in `main`. Quando parte, diventa un `PROMPT_PROSSIMA_CHAT_<n>.md` con le stesse regole fisse del prompt 4.
> **Principio**: il comportamento per il 3200 QTRAP non cambia. La modalità alta risoluzione (HR) si accende da sola leggendo il file, **scansione per scansione** (un Orbitrap Fusion può fare la MS2 nella trappola ionica a bassa risoluzione: filter string «ITMS»).

## Cosa è stato provato (7/10, con il lettore `qqq_lab/reader/mzml.py` sul Mac)
Due file Thermo di Federico (dati di ricerca: **mai nel repository pubblico**), convertiti con msconvert 3.0.24288, peak picking del vendor, centroidi, zlib, 64 bit:
| | Orbitrap Fusion (DDA, CID 30) | Orbitrap Exploris 120 (DDA, HCD 30) |
|---|---|---|
| file | 134 MB, 19 808 scansioni (4 301 MS1 + 15 507 MS2) | 443 MB, 41 986 scansioni (21 085 MS1 + 20 901 MS2) |
| risoluzione (MS:1000800) | MS1 60 000, MS2 60 000 | MS1 45 000, MS2 22 500 |
| isolamento | ±1,5 m/z | ±0,75 m/z |
| indicizzazione | 0,5 s | 1,2 s |
| tabella dei picchi MS1 | 2,0 M picchi, 39 MB, 0,6 s | **22,8 M picchi, 455 MB, 8 s, 1,8 GB di RAM in Python** |
| gruppi di precursori MS2 (`experiments`) | 358 | 761 |
| errore di massa su ioni noti ([M+H]+) | +2…+4 ppm (scostamento sistematico) | ±0,6 ppm |
| cromatogrammi | TIC + pressione della pompa | TIC + pressione della pompa |

Funziona già: lettura, TIC, scansioni MS1/MS2, file misto (survey + MS2), centroidi, energia di collisione, precursore.
Non va (o va solo in apparenza):
1. **Modello dello strumento sbagliato**: `metadata()` restituisce «electrospray ionization» perché il modello sta in `referenceableParamGroup` (`<referenceableParamGroupRef ref="CommonInstrumentParams"/>`), non dentro `instrumentConfiguration`.
2. **Spettri raggruppati a 0,1 Da** (`Item._binned`, `bin_da=0.1`, `api.py` r.72/77): in una sola scansione MS1 dell'Exploris 243 intervalli da 0,1 Da contengono più di un centroide distinto → ioni diversi vengono fusi. E l'API arrotonda le m/z a **3 decimali** (`app.py` r.264).
3. **XIC a finestra unitaria** [n−0,2; n+0,8] (`XIC_BELOW`, `XIC_DRIFT`, `xicNominal` in `explore.js` ~r.927-945): con l'HR butta via la selettività. Con 5 ppm il rapporto picco/fondo migliora fino a 10-30 volte su ioni in matrice complessa.
4. **DDA**: centinaia di gruppi di precursori → il menu del precursore è inutilizzabile; `ms2_events` è tagliato a 20 000 (l'Exploris ne ha 20 901: gli ultimi spariscono).
5. **«CE … eV»**: nei file Thermo l'energia è **NCE** (normalizzata, %), non eV. Il filter string dice anche HCD («hcd30.00») o CID («cid30.00»).
6. **Memoria nel browser**: `browser-worker.js` r.36 copia l'intero file nel filesystem di Pyodide (`FS.writeFile`) e poi costruisce la tabella in float64: con l'Exploris si superano facilmente i limiti di memoria di WebAssembly.
7. Masse teoriche già corrette (protone 1,00727646688, massa dell'elettrone sottratta: `ionfamily.py` r.47-60, `draw.js` r.170): niente da cambiare.

Nel file Thermo ci sono, per ogni scansione: filter string (MS:1000512), potere risolutivo (MS:1000800), tempo di iniezione (MS:1000927), finestra di isolamento (MS:1000827/828/829), tipo di attivazione (MS:1000133 CID, MS:1000422 HCD), carica e intensità del precursore. **Il metodo strumentale completo (gradiente, sorgente) non c'è.**

---

## BLOCCO HR0: dati di prova (prima di tutto)
- **Sintetici** per CI e cloud: `tools/dati_sintetici.py --hr OUT` scrive 2 file piccoli (< 15 MB) con la struttura dei file Thermo (filter string, MS:1000800, isolamento, HCD/CID, NCE, DDA con precursori diversi a ogni ciclo, `referenceableParamGroup` con «Orbitrap Exploris 120»), masse esatte ±1 ppm, due ioni isobari a 0,03 Da (per provare che lo spettro non li fonde), uno scostamento sistematico di +3 ppm in un file. Ancora flufenacet: madre e prodotti con le formule vere.
- **Veri** (decisione di Federico, vedi sotto): ritagli di pochi minuti dei file veri (`msconvert --filter "scanTime [600,900]"`) nel repository **privato** `QqQ-lab-dati/HRMS/` (GitHub rifiuta file > 100 MB: i file interi non ci stanno). `tools/verifica.py` li cerca come gli altri dati veri.

## BLOCCO HR1: lettura e riconoscimento (`reader/mzml.py`, `explore.py`)
- `metadata()`: risolvi `referenceableParamGroupRef` → modello vero («Orbitrap Exploris 120», «Orbitrap Fusion»); lista degli analizzatori.
- `Scan`: nuovi campi `res` (MS:1000800), `analyzer` («FTMS»/«ITMS»/«TOF» dal filter string o dall'`instrumentConfigurationRef` della scansione), `activation` (HCD/CID), `nce` (bool: Thermo = normalizzata), `iso` (finestra di isolamento), `inj` (ms). `Scan.hr = res >= 10000 or analyzer in (FTMS, TOF)`.
- `Item.info()`: `hr` (MS1 ad alta risoluzione), `hr2` (MS2 ad alta risoluzione), `instrument`, `res1`, `res2`. Niente più taglio a 20 000 eventi MS2 (o tetto molto più alto, con avviso).
- Tabella dei picchi: `inten` in float32, `pos` int32 (le m/z restano float64: sono già valori float32 nel file, ma servono per i ppm). Da 20 a 16 byte per picco: poco, ma gratis.
- pytest: modello letto, `hr` vero/falso sui sintetici HR e sui file del 3200.

## BLOCCO HR2: file grandi e memoria (`browser-worker.js`, impostazioni)
Da provare nell'ordine, misurando la memoria (Chrome, Task Manager) con il file Exploris intero e con un ritaglio:
1. **Niente copia del file**: montare il `File` con `WORKERFS` di Pyodide invece di `FS.writeFile` (verificare che `mmap` funzioni; se no, lettura a blocchi con `seek/read`).
2. **Soglia di intensità** facoltativa nell'ingranaggio («Ignora i centroidi sotto … counts», spenta di default; proposta automatica se il file supera ~300 MB, con il conteggio dei picchi che restano). Sull'Exploris il 13% dei centroidi è sotto 1e4: la soglia da sola serve poco; meglio
3. **Ricetta msconvert** nella schermata di carico per i file HR troppo grandi: `peakPicking vendor`, `threshold count 300 most-intense`, `scanTime [inizio,fine]`; spiegata in una riga, il resto in Teoria.
Se nemmeno così il file entra: messaggio chiaro («file troppo grande per il browser: …»), mai un blocco silenzioso.

## BLOCCO HR3: XIC e spettri in ppm (`explore.js`, `spettro.js`, `explore.py`, `app.py`)
- **XIC**: con `hr` la finestra è **m/z ± ppm** (predefinito: vedi decisioni), campo nella finestra XIC («± 5 ppm»), nome del pannello «m/z 195.0877 ± 5 ppm». La logica unitaria (`XIC_BELOW`, `XIC_DRIFT`, `xicNominal`, `xicWin`) resta solo per i file del QqQ. Clic su un centroide → XIC centrato sul centroide (niente correzione di deriva).
- **Spettri**: con `hr` niente raggruppamento a 0,1 Da: una scansione = i suoi centroidi; media di più scansioni = raggruppamento in ppm (es. 3 ppm, centroide pesato). API: m/z a 5 decimali con `hr`.
- **Numeri**: etichette, cursore, righello con 4 decimali; righello: Δm in Da (4 decimali) + mDa; accanto a una m/z teorica (calcolatrice, profilo isotopico) l'**errore in ppm**.
- e2e: due ioni isobari a 0,03 Da distinti nello spettro; XIC a 5 ppm che esclude l'isobaro.

## BLOCCO HR4: DDA = Full Scan + MS2 nello stesso pannello (`explore.js`, `spettro.js`, `explore.py`)
Idea di Federico (7/10): nel DDA la MS2 si guarda **sempre insieme alla Full Scan**, perché spesso c'è una sola MS2 per picco cromatografico; vicine come in Xcalibur/FreeStyle (celle impilate). Niente menu del precursore.
- **Collegamento**: ogni MS2 ha `<precursor spectrumRef="… scan=N">` = la Full Scan da cui è stato scelto il precursore (presente in entrambi i file provati). Leggerlo in `Scan.parent`; in mancanza, la MS1 precedente.
- **Pannello «DDA»** (un solo pannello, tre righe, stessa larghezza):
  1. **cromatogramma** (TIC o XIC in ppm dello ione scelto) con i punti delle scansioni MS1 e un triangolino ▼ dove è partita una MS2 di quello ione (o di tutti, se nessuno ione è scelto): lo studente vede **dove** sul picco è stata presa la MS2 (salita, apice, coda) e quante volte;
  2. **Full Scan** della scansione madre, con la **finestra di isolamento** disegnata come banda attorno al precursore (larghezza dal file: ±0,75 o ±1,5) e uno zoom automatico lì attorno: se dentro la banda ci sono altri ioni, lo spettro MS2 sarà chimerico (lo si vede, non lo si dice);
  3. **MS2**, con il precursore segnato sull'asse (linea tratteggiata) e intestazione «MS2 di 195.0877 · HCD · NCE 30 · isolamento ±0,75 · RT 12.77 (madre: scansione 568)».
- **Navigazione**: ← → passa alla MS2 successiva/precedente **dello stesso ione** (le tre righe si aggiornano insieme); clic su un triangolino = quella MS2; clic destro su un picco della Full Scan = «MS2 di questo ione» (precursore entro ±10 ppm o dentro la finestra di isolamento; se non ce ne sono: «nessuna MS2: il DDA non l'ha scelto», dato didattico anch'esso).
- Le altre righe: con un solo picco cromatografico, nessuna media di scansioni MS2 (sono spettri singoli); media solo se lo studente seleziona più triangolini dello stesso ione.
- Intestazioni: mai «eV» per Thermo (NCE). `ms2_events` senza tetto di 20 000.
- Da studiare prima di scrivere: Xcalibur Qual Browser (celle cromatogramma/spettro collegate, filtro di scansione, frecce per scorrere le scansioni) e FreeStyle; MS-DIAL e MZmine mostrano MS1 e MS2 affiancati per ogni feature. Prendere l'idea, non la complessità.
- **Spunto didattico** (Teoria, non risposta): spettri chimerici (nel file del Fusion lo spettro MS2 di un precursore debole ha come picchi più intensi ioni co-isolati) e campionamento DDA (una sola MS2 per picco, a volte sul fianco).
- e2e (sintetico HR): pannello DDA con 3 righe; ← → cambia la MS2 e la Full Scan madre insieme; la banda di isolamento contiene il precursore; un ione senza MS2 dà il messaggio.

## BLOCCO HR5: calcolatrice, perdite neutre, isotopi
- Calcolatrice: massa esatta a 4-5 decimali con `hr`, errore in ppm rispetto a un valore incollato o cliccato.
- Perdite neutre: con `hr` colonna «Δm esatta» (4 decimali); il testo su «28 = CO oppure C2H4» diventa una domanda risolvibile (27,9949 contro 28,0313).
- Profilo isotopico: posizioni esatte; nessuna struttura fine isotopica (a 45-60 000 non si risolve).
- **Da decidere**: generatore di formule dalla massa esatta (vedi sotto).

## BLOCCO HR6: interfaccia e Teoria
- Lista dei file: badge «HR» con etichetta «Orbitrap Exploris 120 · R 45 000 (MS1) / 22 500 (MS2)»; finestra Metodo: i parametri per scansione letti dal file (non c'è il metodo completo).
- Teoria: capitolo breve «QqQ e alta risoluzione»: potere risolutivo, ppm, difetto di massa, DDA, NCE, spettri chimerici. Simulazione esistente (`teoria/sim-misc.js`) riusabile per «stessa m/z nominale, masse esatte diverse».
- `AGENTS.md`: nuova sezione «Alta risoluzione».

---

## Decisioni di Federico (prima di partire)
1. **Priorità**: dopo il prompt 4? Tutti i blocchi o solo HR1-HR3 (lettura, ppm, spettri) per ora?
2. **Tolleranza XIC predefinita**: 5 ppm (file ben calibrati) o 10 ppm (copre lo scostamento di +3 ppm del Fusion)?
3. **Generatore di formule** dalla massa esatta: utile ma dà una risposta allo studente. Sì / no / solo con una lista di formule candidate che lo studente deve scegliere e motivare.
4. **Dati veri per i test**: ritagli dei due file nel repository privato? (Sono dati di ricerca: solo privato.) Oppure solo sintetici.
5. **File grandi**: soglia nell'ingranaggio, ricetta msconvert, o entrambe.
6. Gli studenti useranno davvero file HR (altro corso, tesi) o è per te? Cambia quanta Teoria scrivere.
