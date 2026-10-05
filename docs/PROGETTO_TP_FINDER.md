# QqQ lab: un programma leggero per cercare prodotti di trasformazione e preparare gli MRM

> **Nota (5 ottobre 2026)**: questo è il documento di progetto originale della v0.1. Il flusso descritto
> nelle sezioni 4 e 6 (candidati e punteggio come percorso principale) è stato superato: oggi il programma
> è uno strumento di esplorazione didattico che non propone i TP (vedi `AGENTS.md`, sezione 1); punteggio e
> candidati restano solo nella scheda facoltativa "Suggerimenti". Restano valide le parti su risoluzione
> unitaria, file .wiff, alternative e rischi.

Documento di progetto, versione 0.1 (5 ottobre 2026). Scritto per essere discusso e poi modificato
da chi lo userà: studenti del laboratorio inquinanti e Federico.

## 1. Il problema

Il flusso di lavoro del laboratorio è questo:

1. si acquisisce in **full scan** (triplo quadrupolo, risoluzione di massa unitaria) un esperimento
   di degradazione di un composto noto, a diversi tempi di trattamento, più bianchi e controlli;
2. si cerca nei dati quali **prodotti di trasformazione (TP)** compaiono e come evolvono nel tempo;
3. in base a questo si decide **quali esperimenti MRM fare**, cioè quali transizioni precursore
   verso frammento acquisire per quantificarli.

Oggi tutto questo si fa con il software del produttore, giudicato difficile e poco adatto a confrontare
molti campioni. Il programma proposto copre i punti 2 e 3 e prepara i dati del punto 3.

Non vuole sostituire il software dello strumento per l'acquisizione, né fare quantificazione
validata (quella resta nel software ufficiale o in Skyline, vedi sezione 11).

## 2. Obiettivi e non obiettivi

Obiettivi:

- si installa senza privilegi di amministratore e senza configurazioni: si scompatta e si avvia;
- è **leggero**: pochi MB, nessun database, nessuna rete, i dati non escono dal computer;
- accetta in ingresso **file `.wiff`** (con conversione automatica quando possibile) **oppure
  `.mzML`** già convertiti;
- **gli studenti possono modificarlo** senza saper programmare in profondità: le regole di
  chimica (trasformazioni attese, soglie, testi) stanno in file di testo che si modificano con un
  editor; chi sa programmare può estendere la logica;
- ogni risultato esportato riporta **parametri, versione del programma e impronta dei file di
  partenza**, così che un'analisi si possa ripetere.

Non obiettivi (per ora): quantificazione con curve di calibrazione, identificazione certa dei TP,
gestione di batch di centinaia di campioni, controllo dello strumento, uso su telefono.

## 3. Cosa significa "risoluzione unitaria" per il progetto

Il triplo quadrupolo distingue le masse solo a circa 0.7 Da di larghezza di picco. Conseguenze di
progetto:

- la finestra di estrazione degli ioni (XIC) è in **dalton** (default ±0.35, modificabile), non in
  ppm;
- ioni diversi con la stessa massa nominale non si separano: ogni candidato è solo un **candidato**.
  L'interfaccia lo dice sempre; non esiste una colonna "identificato";
- il pattern isotopico è poco informativo, tranne il rapporto M e M+2 per cloro e bromo, che si può
  usare come controllo di coerenza;
- l'identificazione richiede almeno uno standard, o dati ad alta risoluzione (HRMS), o un
  ragionamento sui frammenti, e questo si scrive nel rapporto come limite.

## 4. Flusso dell'utente (quattro schermate)

1. **Esperimento**. Si trascinano i file. Per ogni file il programma propone il tipo (campione,
   bianco, controllo, QC), il tempo di trattamento letto dal nome se possibile, e lo si corregge a
   mano in una tabella. Si inserisce il composto madre (formula o massa), la polarità, la finestra in
   Da. Tutto si salva in un file di progetto (`esperimento.toml`) che si può aprire con un editor.
2. **Candidati**. Tabella ordinata per punteggio: massa attesa, trasformazione proposta, area al
   tempo massimo, rapporto rispetto al bianco e a t0, piccola curva dell'andamento nel tempo,
   avvisi (per esempio "possibile interferenza isobarica con la madre"). Si può nascondere o
   promuovere un candidato a mano.
3. **Dettaglio del candidato**. Griglia degli XIC di tutti i campioni sulla stessa scala, grafico
   area contro tempo, spettro MS/MS se acquisito (scansioni di ioni prodotto), frammenti suggeriti.
4. **Esporta**. Tabella delle transizioni per il metodo MRM, tabella dei candidati, figure PNG, e il
   file di sessione con tutti i parametri.

Una quinta vista facoltativa, "Cosa cresce" (sezione 6.4), cerca segnali nuovi senza partire da una
lista.

## 5. Dati in ingresso

### 5.1 File `.mzML`

Il programma legge mzML indicizzati (come quelli prodotti da ProteoWizard `msconvert`). Il lettore
esiste già nel prototipo `mzview` (v0.1): file mappato in memoria, intestazioni lette subito, array
decodificati su richiesta. Un file di full scan a risoluzione unitaria è piccolo, di norma decine di
MB, quindi anche un laptop datato lo gestisce senza problemi.

### 5.2 File `.wiff` (SCIEX)

Il formato è proprietario. I lettori ufficiali sono librerie del produttore, per quanto ne so solo per
Windows, usate da `msconvert`. Il piano:

- il programma **non incorpora** quelle librerie (licenze da verificare e probabilmente non
  ridistribuibili);
- se trova `msconvert` installato (ProteoWizard, installato una volta sul PC Windows dello
  strumento o del laboratorio), lo lancia da solo e salva l'mzML in una cartella di cache accanto al
  file originale (`.tpfinder-cache/`); altrimenti mostra un messaggio chiaro con le istruzioni;
- Federico può anche convertire lui i file e dare direttamente gli mzML agli studenti, e il programma
  funziona identico.

Punti da verificare su un file vero, prima di fidarsi:

- un `.wiff` può contenere **più esperimenti** (full scan Q1, ioni prodotto, MRM) nello stesso
  campione. In mzML finiscono come scansioni intercalate: il programma deve separarle leggendo
  filtro di scansione, livello MS e precursore, e mostrarle come "esperimenti" distinti;
- le impostazioni migliori di conversione per dati a risoluzione unitaria (profilo o centroide)
  vanno testate, perché cambiano le aree;
- come le tracce MRM compaiono in mzML (come cromatogrammi, non come spettri) serve per una fase
  successiva, non per questa.

## 6. Cosa fa il motore

### 6.1 Candidati dal composto madre

- Il composto madre si dà come formula (preferibile) o come massa. Dalla formula si calcola lo ione
  atteso ([M+H]+ in positivo, [M-H]- in negativo, altri addotti a scelta) con una tabella delle masse
  monoisotopiche.
- Le trasformazioni stanno in un file di testo `trasformazioni.csv`, una riga per reazione, con
  nome, variazione di formula (per esempio `+O`, `-H2`, `-CH2`, `-Cl+H`, `+O2`) e un commento. Il file
  parte con le reazioni più comuni (ossidazione, idrossilazione, demetilazione, declorurazione,
  idrolisi...) e **gli studenti lo ampliano**.
- Il programma combina fino a N passaggi (default 2), toglie i duplicati, calcola la massa e la
  segnala se coincide con un'altra entro la finestra (isobare nella lista).

### 6.2 Estrazione e integrazione

- XIC per ogni candidato e ogni campione, somma delle intensità nella finestra, solo sulle scansioni
  del giusto esperimento.
- Lisciatura leggera (come nel prototipo), rilevamento del picco più vicino al tempo di ritenzione
  atteso o più intenso, area con linea di base, S/N, ampiezza a metà altezza.
- Il bianco serve per la sottrazione: un candidato presente nel bianco con intensità simile non è un
  TP.

### 6.3 Punteggio

Un punteggio semplice e **leggibile**, somma di criteri indipendenti che si possono accendere o
spegnere dal file di configurazione:

- c'è un picco con S/N sopra soglia nei campioni trattati;
- non c'è nel bianco né a t0 (rapporto oltre soglia);
- l'andamento nel tempo è plausibile per un prodotto (sale e poi eventualmente cala);
- il tempo di ritenzione è coerente con la polarità attesa rispetto alla madre (avviso, non
  regola: per cromatografia in fase inversa un prodotto più polare di solito esce prima);
- se il candidato contiene Cl o Br, il rapporto M e M+2 è coerente;
- se ci sono repliche, sono riproducibili.

Ogni criterio mostra perché è passato o no. Nessun numero opaco.

### 6.4 "Cosa cresce" (senza lista)

Per catturare TP non previsti: i dati si riassumono in una matrice tempo di ritenzione per
massa, con classi di massa da 0.5 Da, per ogni campione. Si confronta l'ultimo tempo con t0 e con il
bianco e si elencano le zone che crescono di più. È una vista di esplorazione, ordinata per
crescita, che alimenta la tabella dei candidati quando lo studente ne promuove una.

### 6.5 MS/MS e transizioni

Se nei dati ci sono scansioni di ioni prodotto per un precursore, il programma le raccoglie nella
finestra del picco, mostra i frammenti più intensi e propone transizioni (precursore, frammento).
L'energia di collisione si legge dai metadati se presente, altrimenti si lascia vuota: si ottimizza
sullo strumento. L'esportazione è un CSV con le colonne Q1, Q3, energia di collisione, tempo di
ritenzione atteso con finestra, e una colonna di nota. Il formato esatto richiesto dal software del
produttore per importare un metodo va **verificato con Federico**: per ora si esporta in tabella
generica.

## 7. Architettura e linguaggio (la scelta da discutere)

I dati di un triplo quadrupolo a risoluzione unitaria sono piccoli. Questo cambia il peso dei
criteri rispetto all'HRMS.

| | A: Python | B: Rust (come il prototipo) |
|---|---|---|
| Chi lo può modificare | quasi tutti gli studenti di chimica | pochi |
| Velocità su questi dati | più che sufficiente | non serve |
| Installazione | impacchettato con PyInstaller, circa 60 80 MB, avvio un po' lento | un solo file di pochi MB |
| Distribuzione e firma | stessi problemi di firma su Mac e Windows | idem |
| Librerie per la spettrometria di massa | molte pronte | poche, si scrivono |
| Mia capacità di mantenerlo | ottima | ottima |

**Raccomandazione:** per questo strumento, che gli studenti devono poter modificare e che lavora su
file piccoli, scegliere **Python** per motore e interfaccia, con un'interfaccia web a pagina
singola (come il prototipo, senza passaggi di compilazione) servita in locale. Il prototipo Rust
`mzview` resta il lettore veloce per i file HRMS grandi (ITA, THAI) e un riferimento per
confrontare i risultati. I due condividono lo stesso schema di API, quindi sono intercambiabili.

Se invece la priorità diventa un singolo file piccolo da copiare ovunque, la strada B vale lo sforzo
di scrivere nel tempo un pezzo di motore. Conviene decidere dopo aver visto come lo usano gli
studenti per un mese.

### 7.1 Livelli di modifica (cosa possono toccare)

1. **Senza codice**: `trasformazioni.csv`, `soglie.toml`, `testi.toml` (messaggi e avvisi),
   `esperimento.toml`.
2. **Script Python**: il motore espone funzioni semplici (`carica`, `xic`, `candidati`, `punteggio`)
   e un'API locale; si scrivono analisi proprie in un notebook.
3. **Interfaccia**: una pagina HTML con JavaScript senza framework, nessuna compilazione.
4. **Motore**: moduli piccoli e commentati, con test.

### 7.2 Struttura proposta del codice (Python)

```
tpfinder/
  reader/      mzML (e conversione wiff tramite msconvert)
  chem/        masse, formule, trasformazioni
  core/        xic, picchi, punteggio, cosa cresce, transizioni
  web/         una pagina HTML + JS (nessuna build)
  config/      trasformazioni.csv, soglie.toml, testi.toml
  tests/       dati sintetici e confronti con riferimenti
  docs/        guida studenti, guida sviluppatori
```

## 8. Installazione e uso (obiettivo "leggero")

- una cartella da scaricare e scompattare, un doppio clic per avviare, si apre il browser sulla
  macchina locale; nessun account, nessuna rete richiesta;
- nessuna scrittura fuori dalla cartella del progetto e dalla cartella di cache;
- Windows e macOS: i programmi non firmati mostrano avvisi (SmartScreen, Gatekeeper). Le istruzioni
  per aggirarli vanno nella guida; la firma si valuta dopo;
- istruzioni per installare una volta `msconvert` sul PC dove si convertono i `.wiff`.

## 9. Qualità e validazione

Un programma che aiuta a decidere gli esperimenti deve essere controllato:

- test automatici su file mzML **sintetici** con picchi noti (area attesa, interferenza, bianco);
- confronto con il software dello strumento su 3 composti: stesso picco, stesse aree entro una
  tolleranza concordata, per almeno due file veri;
- ogni esportazione contiene versione del programma, parametri, e SHA delle sorgenti (stessa
  logica di provenienza di attributio);
- un elenco pubblico dei **limiti noti** nella guida.

## 10. Tappe

| Tappa | Contenuto | Dimensione |
|---|---|---|
| 0 | Raccogliere un esperimento vero convertito (3 tempi, bianco), conoscere strumento e polarità | piccola |
| 1 | Lettore mzML con esperimenti separati, XIC in Da, sovrapposizione di più file | media |
| 2 | Candidati da formula e `trasformazioni.csv`, griglia di XIC, cinetica | media |
| 3 | Punteggio, bianco e t0, avvisi di isobari | media |
| 4 | Ioni prodotto, transizioni, esportazione | media |
| 5 | Conversione automatica `.wiff`, impacchettamento, guida studenti | media |
| 6 | Validazione contro il software dello strumento, test, primo uso con gli studenti | grande |
| 7 | "Cosa cresce" e rifiniture | media |

## 11. Alternative da considerare prima di investire

- **Skyline** (open source) legge direttamente i `.wiff` su Windows e fa bene la quantificazione
  MRM e le curve di calibrazione. Non è pensato per la ricerca di TP da un elenco di trasformazioni
  né per esportare transizioni a partire da candidati, ma per la quantificazione successiva è il
  riferimento. Vale la pena di fargli provare i vostri file prima di costruire qualcosa di
  sovrapposto.
- **MZmine** gestisce bene dati ad alta risoluzione; per risoluzione unitaria è meno adatto.
- Software del produttore: resta necessario per l'acquisizione e per metodi validati.

## 12. Cosa serve da voi per partire

- un esperimento vero in `.wiff` e il suo mzML convertito (anche piccolo): composto madre, almeno tre
  tempi, un bianco;
- modello di strumento, polarità, gradiente cromatografico approssimativo, e quali esperimenti sono
  nel `.wiff` (full scan, ioni prodotto, MRM);
- qualche schermata di ciò che trovano "terrificante" e due o tre esempi di TP già noti per quel
  composto, da usare come verifica;
- il formato in cui il software dello strumento importa i metodi MRM;
- chi sono gli studenti che metteranno mano al codice e quanto Python conoscono.

## 13. Rischi

- **Conversione `.wiff`**: dipende da componenti di terzi e Windows; piano B: Federico converte.
- **Risoluzione unitaria**: la lista dei candidati può essere lunga e piena di falsi positivi;
  mitigazione con bianchi, t0, repliche e un linguaggio prudente.
- **Fiducia eccessiva**: gli studenti potrebbero leggere il punteggio come identificazione;
  mitigazione con avvisi e formazione.
- **Manutenzione**: un programma modificabile da molti rischia di divergere; serve un repository, una
  persona che revisiona i cambiamenti e i test.
