# QqQ lab

Programma didattico per esplorare dati LC-MS di un triplo quadrupolo (risoluzione unitaria) e cercare
i **prodotti di trasformazione (TP)** di un inquinante degradato nel tempo. Lo studente sceglie cosa
estrarre, integra, attribuisce e disegna: il programma mostra i dati, **non dà le risposte**.
Funziona offline, i dati restano sul tuo computer.

*(English: a light, offline teaching tool to explore unit-resolution LC-MS data and look for
transformation products. It shows the data; the student does the reasoning.)*

## Avvio

- **Doppio clic**: Mac `Avvia QqQ lab.command`, Windows `Avvia QqQ lab.bat`. La prima volta crea un
  ambiente Python privato (`.venv-tpfinder`) e installa numpy: serve internet e Python 3.11 o più recente
  (consigliato l'ultimo, da https://www.python.org/downloads/). Se in seguito installi un Python più nuovo,
  l'ambiente si aggiorna da solo al doppio clic successivo; quello vecchio non viene cancellato.
- **Da terminale**: `pip install -e .` una volta, poi `python -m tpfinder app` (opzioni `--workdir CARTELLA`, `--port`).

Si apre il browser: trascina i file `.mzML` (o "clicca per sceglierli"), controlla tempi e tipi, premi
**Apri i dati**. I file sono copiati in `~/TPFinder_lavoro/sessione_...`: gli originali non vengono
toccati. Il taccuino (pannelli, XIC, integrazioni, attribuzioni, disegni) si salva da solo
(`taccuino.json`) e si ripristina alla riapertura.

## Le schede

- **Dati**: cromatogramma totale (TIC o picco base) di tutti i file sovrapposti. Trascina per vedere lo
  spettro di massa; clic destro per estrarre uno ione (XIC) o aggiungerlo a un pannello; il campo
  "m/z o formula" accetta anche una formula bruta. Pannelli spettro, XIC, MRM e mappa RT-m/z;
  vista impilata, scala log, zoom, cursore con i valori, sottrazione del bianco e linea di base,
  integrazione con tabella delle aree nel tempo (per le cinetiche) esportabile in CSV.
  Popup "Metodo" (parametri dello strumento) e "Calcolatrice m/z".
- **Disegno**: editor chimico (Ketcher) per molecole, frammenti e vie di trasformazione. Per ogni
  struttura mostra formula, massa esatta e m/z degli addotti, con pulsante XIC e didascalia per la
  relazione. Esporta PNG, JPEG, SVG e .ket.
- **Attribuzioni**: le ipotesi dello studente (m/z, RT, nome, trasformazione, SMILES, confidenza, note), in CSV.
- **Suggerimenti** (facoltativo): m/z attesi dalle reazioni di `trasformazioni.csv` e criteri (picco,
  bianco, t0, andamento, isotopi). Sono ipotesi, non risposte.

Con risoluzione unitaria **un m/z è un candidato, non un'identificazione**. Sullo strumento del
laboratorio l'asse m/z è spostato di circa +0.3 Da: usa una finestra XIC di +-1 Da.

## File .wiff

Il programma legge solo mzML. I `.wiff` (con il loro `.wiff.scan`) si convertono con ProteoWizard
msconvert su Windows: vedi `../esempio_conversione/converti.bat`, oppure `python -m tpfinder convert file.wiff`
se msconvert è installato (l'mzML va in `.tpfinder-cache/`).

Solo per il docente: `python -m tpfinder metodo FILE.dam -o metodo.json` legge i parametri del metodo
(sorgente e composto) per il popup "Metodo" (`tpfinder/config/metodo_laboratorio.json`).

## Cosa puoi modificare, dal più semplice al più profondo

| Cosa | File | Serve programmare? |
|---|---|---|
| Reazioni attese | `tpfinder/config/trasformazioni.csv` (nome; variazione di formula, es. `-Cl+H`) | no |
| Soglie dei suggerimenti | `tpfinder/config/soglie.toml` | no |
| Testi e avvisi | `tpfinder/config/testi.toml` | no |
| Interfaccia | `tpfinder/web/` (`index.html`, `explore.js`, `draw.js`: JavaScript semplice, nessuna compilazione) | un po' |
| Calcoli | `tpfinder/explore.py`, `tpfinder/core/` | sì |
| Chimica | `tpfinder/chem/` | sì |

Ketcher (Apache-2.0) e OpenChemLib (BSD-3) sono inclusi in `tpfinder/web/vendor` (vedi il suo README).

## Altri comandi

`python -m tpfinder demo` (esperimento sintetico), `draft` / `serve` / `candidates` (vecchio flusso con
`esperimento.toml` e punteggio dei candidati). Test: `python3 -m pytest -q tests`; prove nel browser in
`tests_e2e/` (vedi `AGENTS.md`).

## Limiti noti

- non ancora validato contro il software dello strumento su più composti;
- una sola polarità per file; nessuna normalizzazione con standard interno;
- Numpress non supportato (convertire con zlib).
