# Disegno (`draw.js`, Ketcher in `vendor/ketcher`)
Stato attuale; aggiornalo riscrivendo le righe. Il nucleo è in AGENTS.md.

- Ketcher si carica solo aprendo la scheda; OpenChemLib al primo calcolo delle proprietà. Lo `<style>` iniettato da `hideMacro` adatta le barre e nasconde aiuto e informazioni di Ketcher; zoom iniziale 100% (`fitZoom`). Tasto destro: «Copia SMILES», «Centra disegno».
- **Strumenti dell'editor** (`TOOLS`; scelta in `qqq.disegno.strumenti`): accesi anelli, frecce, catene, riordino, file; forme e immagini sempre; spenti aromaticità, stereochimica, gruppi S/R, verifica/3D, mappatura, atomi generici, biologia. Gruppo nuovo = una riga di `TOOLS` con i `data-testid`.
- **Riquadri a destra** nascondibili (`qqq.disegno.riquadri`); scheda «Scorciatoie»; tasto destro sull'etichetta di una molecola = «Copia la formula» (con carica) e «Copia la massa»; `overscroll-behavior-x` e `wheel` orizzontale bloccati nell'editor.
- Scritte automatiche sotto le strutture (formula, massa, «m/z» se c'è carica) e sopra le frecce (perdita neutra e Δm: FACOLTATIVE, spente di base, `#lb-a`; gli studenti fanno il calcolo da soli), in un gruppo SVG sopra il disegno. Nome e «TP m/z» li scrive lo studente. SMILES e proprietà stimate (logP, TPSA…) come stime. Esportazione PNG/JPEG/SVG/.ket. Il menu «Ione» non c'è (decisione di Federico).
- **«Spezza il legame»** (`breakBonds`, clic destro su un legame selezionato): invia Canc a Ketcher con i soli legami selezionati; test `e2e_spezza`.
- **Trappole**: `zoomAccordingContent` riduce lo zoom dopo ogni incolla; l'etichetta dello zoom visibile è il secondo `[data-testid=zoom-selector]` (il primo è della modalità macromolecole, nascosta).
