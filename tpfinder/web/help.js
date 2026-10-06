"use strict";
// Context help: every <button class="hq" data-help="key"> opens a short explanation (HELP[key]) next to it.
// Texts for students, in Italian. To add one: a key here and a "?" button where it is needed. Classic script.
const HELP = {
  "start": ["Caricare i dati", `Trascina qui i file <b>.mzML</b> (o clicca per sceglierli). Puoi caricarne molti insieme: un file per ogni tempo di trattamento, il bianco, gli standard.
    <br>Il programma indovina dal nome il <b>tempo</b> (es. <i>t15</i> = 15 min) e il <b>tipo</b> (campione, bianco): controllali nella tabella prima di premere <b>Apri i dati</b>.
    <br>I file <b>.wiff</b> dello strumento vanno prima convertiti in .mzML con MSConvert (vedi il riquadro qui sotto).`],
  "files": ["Elenco dei file", `Ogni riga è un file aperto, con il suo colore nei grafici. La <b>casella</b> mostra o nasconde la traccia; <b>clic sul nome</b> = file corrente (quello usato da spettro e mappa), <b>doppio clic</b> = rinomina.
    <br>Sotto il nome: tipo di esperimento (full scan Q1 o EMS, MS2, MRM) e tempo.
    <br><b>+</b> carica altri file senza perdere i pannelli; <b>◀</b> nasconde l'elenco per dare più spazio ai grafici.`],
  "toolbar": ["Aggiungere pannelli", `<b>Cromatogramma</b>: TIC (somma di tutti gli ioni) o BPC (ione più intenso) di ogni file.
    <br><b>Spettro</b>: lo spettro di massa in un intervallo di tempo. <b>Mappa RT-m/z</b>: tutti gli ioni nel tempo, come un'immagine.
    <br><b>XIC</b>: cromatogramma di uno ione estratto (scrivi un m/z o una formula). <b>Transizioni MRM</b>: le tracce dei file MRM.
    <br><b>Calcolatrice m/z</b>: dalla formula agli m/z degli addotti. <b>Unisci gli XIC</b> porta tutti gli ioni in un pannello; <b>Ordina</b> mette i pannelli uno sotto l'altro.`],
  "nav": ["Scorrere i file", `Le frecce (o i tasti ← →) cambiano file corrente; con <b>un file alla volta</b> i grafici mostrano solo quello: utile per guardare i campioni uno per uno senza perdere gli XIC che hai estratto.`],
  "tools": ["Metodo e immagini", `<b>Metodo</b>: tipo di esperimento (Q1, EMS, MS2, MRM), strumento, polarità, intervallo di massa, transizioni MRM e parametri del metodo di laboratorio (.dam), con il confronto con i dati.
    <br><b>Integrazione</b> (si integra <b>solo da un XIC</b>: TIC, BPC e PDA non lo permettono; usa il pulsante XIC per scegliere la finestra, es. da 100 a 100,5): nei grafici di cromatogrammi, XIC e MRM ci sono le icone dell'integrazione <b>automatica</b> (clic su un picco) e <b>manuale</b> (trascini l'intervallo); la tabella delle aree si apre dall'icona a tabella del grafico.
    <br>Ogni grafico ha il pulsante <b>PNG</b> (immagine; senza la linea del cursore, e lo spettro porta scritto RT e numero di scan); XIC, MRM e spettri hanno anche <b>CSV</b> (dati per Excel).`],
  "pnl-chrom": ["Cromatogramma", `Asse x: tempo di ritenzione; asse y: intensità (cps). <b>Trascina</b> sul grafico per scegliere un intervallo: lo spettro sotto mostra la media di quegli scan; un <b>clic</b> mostra lo spettro di un solo scan.
    <br><b>Clic destro</b>: spettro in un nuovo pannello, estrarre uno ione, <b>integrare</b> il picco, annotare.
    <br>Opzioni: <b>smoothing</b>, <b>impilati</b> (una riga per file), <b>picchi</b> (etichette con l'RT: solo dove sono, non cosa sono), <b>scala log</b> (vedi i segnali deboli), <b>bianco</b> (sottrae il file bianco), <b>baseline</b> (toglie la linea di base con l'algoritmo SNIP).
    <br>Zoom: icona <b>lente</b> (poi trascini un intervallo), oppure Ctrl + rotella; Maiusc + trascina sposta; il pulsante con i quattro angoli (appare dopo uno zoom) torna alla vista intera; doppio clic su un cromatogramma apre lo spettro a quel tempo e puoi trascinare la linea verticale per spostarlo. Clic sulla legenda nasconde una traccia.
    <br><b>PDA (UV, totale)</b>: segnale del rivelatore a serie di diodi, registrato insieme al massa; serve a confrontare ciò che assorbe nell'UV con ciò che vede lo spettrometro.
    <br>I pannelli stanno in posti fissi, uno sotto l'altro: trascina l'intestazione in su o in giù e gli altri si spostano.`],
  "pnl-spec": ["Spettro di massa", `Mostra gli ioni presenti nell'intervallo di tempo scelto sul cromatogramma. <b>Trascina</b> per ingrandire un intervallo di m/z, doppio clic per tornare indietro.
    <br><b>Clic destro su un picco</b>: estrai il suo XIC, aggiungilo a un pannello, annotalo, oppure <b>confronta con il profilo isotopico</b> di una formula che proponi tu (cerchi rossi: M, M+1, M+2...).
    <br><b>sovrapponi i file</b>: gli spettri di tutti i file visibili; <b>MS1 / MS2</b> e <b>precursore</b> per i file di ioni prodotto; <b>fondo</b>: sottrae uno spettro di fondo (un altro intervallo, o il bianco).
    <br>Ricorda: a risoluzione unitaria un m/z è un candidato, non un'identificazione; su questo strumento l'asse m/z è spostato di circa +0.3.`],
  "pnl-xic": ["Ione estratto (XIC)", `Il cromatogramma di un solo m/z (± la finestra, di solito 1 Da su questo strumento) in tutti i file. Scrivi un <b>m/z</b> o una <b>formula</b> (con l'addotto scelto) e premi + ione.
    <br>Più ioni nello stesso pannello: linea piena per il primo file, tratteggi per gli altri; <b>Separa</b> li divide in pannelli diversi.
    <br><b>Icona dell'integrazione automatica (o clic destro → Integra)</b>: scegli prima il file (traccia cliccata, tutte, o uno specifico) dal menu accanto alle icone; il programma propone i bordi, tu li sposti trascinando le barre. Le aree finiscono nella tabella Integrazioni (per la cinetica in Excel).`],
  "pnl-mrm": ["Transizioni MRM", `Le tracce precursore > frammento dei file MRM (es. 364.1>194.1 quantificatore, 364.1>152.1 qualificatore). Si integrano come gli XIC: le aree servono per la retta di taratura e la quantificazione, che costruisci tu in Excel.`],
  "pnl-map": ["Mappa RT-m/z", `Ogni pixel è l'intensità di un m/z (in verticale) a un certo tempo (in orizzontale): i composti sono macchie. Con <b>differenza con</b> un altro file, in rosso ciò che è più intenso nel file mostrato, in blu ciò che è più intenso nell'altro: utile per vedere cosa compare con il trattamento.
    <br><b>Trascina</b>: spettro mediato; <b>clic destro</b>: XIC di quell'm/z. La mappa mostra, non identifica.`],
  "draw-labels": ["Formula e massa sotto le strutture", `Sotto ogni molecola compaiono la formula bruta e la massa esatta all'unità (<b>M</b> se neutra, <b>m/z</b> se ha una carica). Sopra una freccia compare la differenza fra la struttura prima e quella dopo (es. +O Δm +16).
    <br>Le scritte non fanno parte del disegno (non cambiano annulla/salva) ma compaiono nelle immagini esportate.`],
  "draw-sel": ["Selezione = frammento", `Seleziona solo gli atomi di un pezzo della molecola: qui vedi la sua formula (con gli H che ha nella molecola), quanti legami hai tagliato e gli m/z possibili dello ione. Sono <b>ipotesi</b>: confrontale con lo spettro di ioni prodotto (MS/MS). In ESI i frammenti sono quasi sempre ioni a numero pari di elettroni.`],
  "draw-structs": ["Strutture sulla tela", `Per ogni struttura disegnata: formula, massa esatta e m/z degli addotti principali; <b>XIC</b> apre il cromatogramma di quell'm/z nella scheda Dati, per controllare se lo ione c'è nei tuoi campioni.`],
  "draw-caption": ["Didascalia", `Facoltativa: aggiunge sotto l'immagine esportata nome, formula, massa e m/z della struttura scelta, per la relazione. Il testo si può anche copiare.`],
  "draw-export": ["Esportare il disegno", `PNG e JPEG (immagini ad alta risoluzione), SVG (vettoriale, per Word o PowerPoint senza perdere qualità), .ket (il disegno riapribile in Ketcher). Puoi anche incollare uno SMILES per disegnare una molecola nota.`],
  "header": ["Strumenti", `<b>Tavola periodica</b>: masse esatte e abbondanze degli isotopi. <b>Addotti</b>: tabella degli addotti ESI, profilo isotopico di una formula, perdite neutre comuni. <b>PubChem</b> e <b>BioTransformer</b>: siti esterni (serve internet), da usare per verificare le tue ipotesi.`],
};
(() => {
  const pop = document.createElement("div"); pop.id = "helppop"; pop.hidden = true; document.body.appendChild(pop);
  let cur = null;
  const close = () => { pop.hidden = true; cur = null; };
  document.addEventListener("click", e => {
    const b = e.target.closest(".hq[data-help]");
    if (!b) { if (!pop.contains(e.target)) close(); return; }
    e.preventDefault(); e.stopPropagation();
    if (cur === b) return close();
    const h = HELP[b.dataset.help]; if (!h) return;
    pop.innerHTML = `<div class="hp-t"><b>${h[0]}</b><button class="x" title="Chiudi">&times;</button></div><div>${h[1]}</div>`;
    pop.querySelector(".x").onclick = close;
    pop.hidden = false; cur = b;
    const r = b.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    let left = Math.min(innerWidth - w - 8, Math.max(8, r.left - 12)), top = r.bottom + 6;
    if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  addEventListener("scroll", close, true);
})();
const helpBtn = key => `<button class="hq" data-help="${key}" title="Che cos'è?">?</button>`;
