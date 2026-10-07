"use strict";
// Context help: every <button class="hq" data-help="key"> opens a short explanation (HELP[key]) next to it.
// Texts for students, in Italian. To add one: a key here and a "?" button where it is needed. Classic script.
const HELP = {
  "start": ["Caricare i dati", `Trascina qui i file <b>.mzML</b> (o clicca per sceglierli). Puoi caricarne molti insieme: un file per ogni tempo di trattamento, il bianco, gli standard.
    <br>Il tipo di esperimento (Full Scan, MS<sup>2</sup> Product Ion, MRM) è letto dal contenuto del file. Dal nome il programma indovina il <b>tipo</b> (campione, bianco, standard), il <b>tempo</b> (es. <i>t15</i> = 15 min) e, per gli standard, la <b>concentrazione</b> (es. <i>std_0.5ppm</i>): controllali nella tabella prima di premere <b>Carica dati</b>. Il metodo <b>.dam</b> va nel secondo riquadro (se lo trascini nel primo, ci pensa il programma).
    <br>I file <b>.wiff</b> dello strumento vanno prima convertiti in .mzML con MSConvert (vedi il riquadro qui sotto).`],
  "files": ["Elenco dei file", `Ogni riga è un file aperto, con il suo colore nei grafici. La <b>casella</b> mostra o nasconde la traccia; <b>clic sul nome</b> = file corrente (quello usato da spettro e mappa), <b>doppio clic</b> = rinomina.
    <br>Sotto il nome: tipo di esperimento (Full Scan, MS<sup>2</sup>, MRM) e tempo.
    <br>In <b>Dati</b> ci sono tre schede, una per tipo di esperimento (Full Scan, MS<sup>2</sup>, MRM): non si mescolano mai nello stesso grafico. <b>Tempi ed esperimenti</b> mostra quali file hai per ogni tempo e tipo.
    <br><b>+</b> carica altri file senza perdere i pannelli; <b>◀</b> nasconde l'elenco per dare più spazio ai grafici.`],
  "toolbar": ["Aggiungere pannelli", `<b>Cromatogramma</b>: TIC (somma di tutti gli ioni) o BPC (ione più intenso) di ogni file.
    <br><b>Spettro</b>: lo spettro di massa in un intervallo di tempo. <b>Mappa RT-m/z</b>: tutti gli ioni nel tempo, come un'immagine.
    <br><b>XIC</b>: cromatogramma di uno ione estratto: scrivi la finestra di m/z (da ... a ...) oppure la formula neutra del composto e scegli l'addotto. La finestra è sempre la stessa, da qualsiasi punto la apri (pulsante XIC, clic destro, calcolatrice, Disegno). <b>Transizioni MRM</b>: le tracce dei file MRM.
    <br><b>Calcolatrice m/z</b>: dalla formula agli m/z degli addotti. <b>Unisci gli XIC</b> porta tutti gli ioni in un pannello; <b>Ordina</b> mette i pannelli uno sotto l'altro.`],
  "nav": ["Scorrere i file", `Le frecce (o i tasti ← →) cambiano il file selezionato; con <b>Solo il file selezionato</b> i grafici mostrano solo quello (con <b>Tutti i file sovrapposti</b> li vedi insieme): utile per guardare i campioni uno per uno senza perdere gli XIC che hai estratto.`],
  "tools": ["Metodo e immagini", `<b>Metodo</b>: tipo di esperimento (Q1, EMS, MS2, MRM), strumento, polarità, intervallo di massa, transizioni MRM e parametri del metodo di laboratorio (.dam), con il confronto con i dati.
    <br><b>Integrazione</b> (si integra <b>solo da un XIC</b>: TIC, BPC e PDA non lo permettono; usa il pulsante XIC per scegliere la finestra, es. da 100 a 100.5; scrivendo «da», «a» si compila da solo con da + 0.5 e puoi cambiarlo): nei grafici di cromatogrammi, XIC e MRM ci sono le icone dell'integrazione <b>automatica</b> (clic su un picco) e <b>manuale</b> (trascini l'intervallo); la tabella delle aree si apre dall'icona a tabella del grafico.
    <br>Nell'intestazione dei grafici i pulsanti sono in gruppi separati da una barra: <b>lente</b> (zoom: trascina sull'intervallo) con accanto il pulsante per <b>tornare alla vista intera</b> (grigio finché non ingrandisci; si può anche usare il clic destro, «Ripristina zoom») | integrazione <b>automatica</b> e <b>manuale</b> | <b>XIC</b> | <b>PNG</b> ed <b>Excel</b>.
    <br>Ogni grafico ha il pulsante <b>PNG</b> (immagine; senza la linea del cursore, e lo spettro porta scritto RT e numero di scan); XIC, MRM e spettri hanno anche <b>Excel</b>: un file .xlsx con i numeri veri (non testo), un foglio e le unità nelle intestazioni, da aprire con Excel o LibreOffice e da cui costruire tabelle e grafici. Anche la tabella delle integrazioni e la retta di taratura si esportano in Excel (la retta ha due fogli: i dati e la retta con pendenza, intercetta, R<sup>2</sup>, LOD e LOQ).`],
  "prop": ["Proprietà previste", `Stime di OpenChemLib per la forma <b>neutra</b> (logS in log mol/L, TPSA in &Aring;<sup>2</sup>; se c'è una carica, il calcolo la esclude: spunta «Escludi la carica»). L'errore tipico del logP è di circa 0.5 unità, a volte 1.
    <br>In LC (C18, acqua/ACN con HCOOH) la ritenzione dipende anche da pKa e carica (logD): usa il logP per confrontare composti simili, non come valore assoluto.`],
  "scorrimento": ["Scorciatoie e scorrimento fra le scansioni", `Metti il cursore sul cromatogramma (un clic) e <b>guarda lo spettro Full Scan scansione per scansione</b>: quali ioni salgono e quali scendono mentre passi sul picco.
    <br><b>← →</b> una scansione indietro / avanti (se non c'è il cursore cambiano file). <b>Tenuti premuti</b>: scorrimento continuo (circa 15 scansioni al secondo). <b>Maiusc + ← →</b>: salti di 5 scansioni.
    <br><b>Spazio</b>: avvia e ferma lo scorrimento automatico (dal cursore alla fine; se hai selezionato un intervallo sul cromatogramma, avanti e indietro dentro quell'intervallo). <b>Esc</b> o un clic lo fermano.
    <br><b>Lucchetto</b> nello spettro (piccolo, in alto a sinistra, accanto all'asse delle intensità): blocca <b>solo l'asse delle intensità</b> mentre scorri, così lo stesso picco ha sempre la stessa altezza (può solo crescere se una scansione supera il massimo). L'asse <i>m/z</i> è sempre fisso sull'intervallo di tutte le scansioni e cambia solo se ingrandisci. Si sblocca con un clic sul lucchetto, doppio clic sullo spettro, «Vista intera» o un nuovo clic sul cromatogramma.
    <br><b>Strumenti dello spettro</b> (icone nell'intestazione): <b>righello</b> (clic su un picco = riferimento, clic su un altro = differenza di <i>m/z</i>; anche clic destro, «Misura da questo picco»; Esc le toglie), <b>parametri</b> (asse in % del picco più alto o in cps, soglia e numero delle etichette, decimali) e <b>tabella dei picchi</b> (si copia o si esporta per Excel). La <b>catena</b> sui cromatogrammi collega l'asse del tempo dei grafici che l'hanno attivata.
    <br><b>Altre scorciatoie</b>: <b>Backspace</b> = vista intera del grafico attivo; <b>Ctrl/Cmd + Z</b> = zoom precedente (gli ultimi 15); doppio clic sul cromatogramma = nuovo spettro a quel tempo; doppio clic sullo spettro = vista intera; Ctrl/Cmd + rotella = zoom; trascina sui numeri a sinistra dell'asse y = ingrandisce solo le intensità, sui numeri sotto l'asse x = solo il tempo (o <i>m/z</i>); Maiusc + trascina = sposta la vista; clic sul nome nella legenda = nascondi/mostra la traccia; <b>?</b> = questa finestra.`],
  "pnl-chrom": ["Cromatogramma", `Asse x: tempo di ritenzione; asse y: intensità (cps). <b>Trascina</b> sul grafico per scegliere un intervallo: lo spettro sotto mostra la media di quegli scan; un <b>clic</b> mostra lo spettro di un solo scan.
    <br><b>Clic destro</b>: spettro in un nuovo pannello, estrarre uno ione, <b>integrare</b> il picco, annotare.
    <br>Opzioni: <b>smoothing</b>, <b>impilati</b> (una riga per file), <b>picchi</b> (etichette con l'RT: solo dove sono, non cosa sono), <b>scala log</b> (vedi i segnali deboli), <b>Correzione</b> (una sola alla volta: <i>nessuna</i>; <i>sottrai un file bianco</i>, utile se il fondo cambia nel tempo come nel campione; <i>sottrai il fondo di un tratto</i>, trascini un tratto senza picchi e se ne toglie la media, utile se il fondo è piatto; <i>linea di base automatica</i>, toglie la base che sale sotto i picchi con l'algoritmo SNIP). Negli spettri lo stesso schema vale per il <b>fondo</b>: un tratto di tempo o un file bianco.
    <br>Zoom: icona <b>lente</b> (poi trascini un riquadro: ingrandisce x e y insieme), oppure trascina sui numeri a sinistra (solo y) o sotto l'asse (solo x), oppure Ctrl + rotella; Maiusc + trascina sposta; il pulsante con i quattro angoli (appare dopo uno zoom) torna alla vista intera; doppio clic su un cromatogramma apre lo spettro a quel tempo e puoi trascinare la linea verticale per spostarlo. Clic sulla legenda nasconde una traccia.
    <br><b>Scorrere le scansioni</b>: con il cursore sul grafico, ← → (Maiusc = 5 scansioni, Spazio = avvio/pausa) fanno scorrere lo spettro collegato; premi <b>?</b> per tutte le scorciatoie.
    <br><b>PDA (UV, totale)</b>: segnale del rivelatore a serie di diodi, registrato insieme al massa; serve a confrontare ciò che assorbe nell'UV con ciò che vede lo spettrometro.
    <br>I pannelli stanno in posti fissi, uno sotto l'altro: trascina l'intestazione in su o in giù e gli altri si spostano.`],
  "pnl-spec": ["Spettro di massa", `Mostra gli ioni presenti nell'intervallo di tempo scelto sul cromatogramma. <b>Trascina</b> per ingrandire un intervallo di m/z, doppio clic per tornare indietro.
    <br><b>Clic destro su un picco</b>: estrai il suo XIC, aggiungilo a un pannello, annotalo, oppure <b>confronta con il profilo isotopico</b> di una formula che proponi tu (cerchi rossi: M, M+1, M+2...).
    <br><b>sovrapponi i file</b>: gli spettri di tutti i file visibili (se in alto è scelto «Tutti sovrapposti», che vale per i cromatogrammi, lo spettro mostra comunque <b>un file alla volta</b>: due spettri sovrapposti sono illeggibili con molti file, per questo li sovrapponi solo se lo chiedi qui); <b>MS1 / MS2</b> e <b>precursore</b> per i file di ioni prodotto; <b>fondo</b>: sottrae uno spettro di fondo (un altro intervallo, o il bianco).
    <br>Ricorda: a risoluzione unitaria un m/z è un candidato, non un'identificazione; su questo strumento l'asse m/z è spostato di circa +0.3.`],
  "pnl-xic": ["Ione estratto (XIC)", `Il cromatogramma di un solo m/z (± la finestra, di solito 1 Da su questo strumento) in tutti i file. Premi <b>+ XIC</b>: nella finestra scrivi la finestra di <b>m/z</b> oppure una <b>formula neutra</b> (senza carica) con l'addotto: dalla formula esce l'm/z calcolato dell'addotto e la finestra attorno ad esso (±0.5 Da), che puoi correggere.
    <br>Più ioni nello stesso pannello: linea piena per il primo file, tratteggi per gli altri; <b>Separa</b> li divide in pannelli diversi.
    <br><b>Icona dell'integrazione automatica (o clic destro → Integra)</b>: scegli prima il file (traccia cliccata, tutte, o uno specifico) dal menu accanto alle icone; il programma propone i bordi, tu li sposti trascinando le barre. Le aree finiscono nella tabella Integrazioni (per la cinetica in Excel).`],
  "pnl-mrm": ["Transizioni MRM", `Le tracce precursore > frammento dei file MRM (es. 364.1>194.1 quantificatore, 364.1>152.1 qualificatore). Si integrano trascinando sul picco: tutti i file vengono integrati nella stessa finestra. Poi apri la <b>tabella delle integrazioni</b> (icona tabella nell'intestazione) con le aree e le concentrazioni degli standard: esportala in Excel e fai lì la retta di taratura.
    <br><b>Smoothing</b>: nell'MRM parte <b>spento</b> (nel Full Scan è acceso) perché l'MRM si integra: le aree si calcolano <b>sempre sul segnale grezzo</b>, lo smoothing cambia solo il disegno. Con molti punti sul picco lo smoothing è inutile; con pochi può arrotondarlo troppo.`],
  "pnl-map": ["Mappa RT-m/z", `Ogni pixel è l'intensità di un m/z (in verticale) a un certo tempo (in orizzontale): i composti sono macchie. Con <b>differenza con</b> un altro file, in rosso ciò che è più intenso nel file mostrato, in blu ciò che è più intenso nell'altro: utile per vedere cosa compare con il trattamento.
    <br><b>Trascina</b>: spettro mediato; <b>clic destro</b>: apre la finestra dell'XIC già compilata con quell'm/z. La mappa mostra, non identifica.
    <br><b>2D / 3D</b>: la vista 3D disegna una superficie (altezza = intensità) che si ruota trascinando; per scegliere una zona o estrarre un XIC si usa la vista 2D (l'intervallo è lo stesso). <b>Sottrazione fra esperimenti</b>: scegli un secondo file in «differenza con»; se i due file hanno intensità molto diverse, «normalizza al massimo» (o al totale) li rende confrontabili prima della sottrazione.`],
  "origine": ["Da dove viene questo ione?", `Nel 3200 QTRAP molti ioni si rompono già nella <b>sorgente</b>, prima del primo quadrupolo (<i>in-source fragmentation</i>, ISF): nel full scan compaiono come picchi di ioni più leggeri che sembrano prodotti di trasformazione, ma sono frammenti del composto di partenza. Questa finestra ti dà le <b>misure</b> per ragionarci: i profili cromatografici dei due ioni (devono coincidere), la proporzionalità fra le loro aree scansione per scansione (F contro P), il comportamento nei campioni (cinetica).
    <br>Scegli tu lo ione da studiare e il candidato progenitore; il programma <b>non</b> dice «è un frammento» o «è un prodotto»: è compatibile, o no, con ciascuna ipotesi, e la conclusione la scrivi tu nel riquadro finale. Se l'evidenza è ambigua (picchi isobari, saturazione, pochi punti) compaiono degli avvisi: leggili.
    <br>Per una prova decisiva servono dati in più (standard del solo composto di partenza, MS<sup>2</sup> del candidato): il programma non li inventa.`],
  "header": ["", `<p style="margin:0 0 8px">QqQ lab è il programma didattico per il laboratorio di inquinanti della laurea magistrale in Chimica dell'ambiente.</p><p style="margin:0">Suggerimenti e correzioni: <a href="mailto:federico.cristaudo@unito.it">federico.cristaudo@unito.it</a> (Federico Cristaudo, Università di Torino).</p>`],
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
    const key = b.dataset.help, mk = /^modo-(full|ms2|mrm)$/.exec(key);
    const h = mk && typeof QMODI !== "undefined" ? [QMODI.M[QMODI.tab2key[mk[1]]].name, QMODI.html(QMODI.tab2key[mk[1]])] : HELP[key]; if (!h) return;
    pop.classList.toggle("wide", !!mk); pop.classList.remove("guide");
    pop.innerHTML = `<div class="hp-t"><b>${h[0]}</b><button class="x" title="Chiudi">&times;</button></div><div>${h[1]}</div>`;      // no title for the "Informazioni" box (key header)
    pop.querySelector(".x").onclick = close;
    pop.hidden = false; cur = b;
    const r = b.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    let left = Math.min(innerWidth - w - 8, Math.max(8, r.left - 12)), top = r.bottom + 6;
    if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  addEventListener("scroll", e => { if (!pop.contains(e.target)) close(); }, true);
})();
// the "?" buttons are gone (7/10): the short text of each one is now the label of its control (hover ~1.5 s); the only "?" is the general one in the header
const helpBtn = () => "";
const shortHelp = key => { const h = HELP[key]; if (!h) return ""; const t = h[1].replace(/<br>.*/s, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim(); return t.length > 190 ? t.slice(0, t.lastIndexOf(" ", 187)) + "…" : t; };
// the general guide, now the first chapter of the Teoria ("Come si usa QqQ lab", teoria/00-uso.html): all the explanations in one place, by topic
function guideHtml() {
  const sec = (title, keys) => `<details open><summary><b>${title}</b></summary>${keys.filter(k => HELP[k]).map(k => `<div class="hp-s"><b>${HELP[k][0]}</b><div>${HELP[k][1]}</div></div>`).join("")}</details>`;
  let modes = "";
  try { modes = `<details><summary><b>I tre tipi di esperimento (Full Scan, MS<sup>2</sup>, MRM)</b></summary>${["full", "ms2", "mrm"].map(t => QMODI.html(QMODI.tab2key[t])).join("")}</details>`; } catch (e) { /* the modes text is optional */ }
  const credits = `<details><summary><b>Crediti e licenze</b></summary><div class="hp-s">Ketcher (EPAM, Apache-2.0), OpenChemLib (BSD-3), Pyodide (MPL-2.0) e NumPy (BSD-3); il logo deriva da <i>QuadrupoleContour.svg</i> di Geek3 (Wikimedia Commons, CC BY-SA 4.0). I file mzML restano sul tuo computer. Dettagli in <code>LICENZE-TERZI.md</code>.</div></details>`;
  return sec("Aprire i dati", ["start", "files"]) + sec("Lavorare con i grafici", ["toolbar", "nav", "scorrimento", "pnl-chrom", "pnl-spec", "pnl-xic", "pnl-mrm", "pnl-map"]) + sec("Metodo, immagini e proprietà", ["tools", "prop"]) + modes + credits;
}
