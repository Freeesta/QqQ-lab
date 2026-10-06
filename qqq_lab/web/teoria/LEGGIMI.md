# Come modificare la Teoria

Tutto il testo sta in questa cartella, un file per capitolo. Non c'è niente da compilare: modifichi, salvi, ricarichi la pagina nel browser.

## Quale file aprire

| Che cosa | File |
|---|---|
| Introduzione e mappa | `index.html` |
| Capitoli 1–12 | `01-tp.html` … `12-disegno.html` (il numero è nel nome) |
| Elenco dei capitoli nel menu laterale | `teoria.js`, in alto: lista `CHAPTERS` |
| Colori, caratteri, aspetto dei riquadri | `teoria.css` |
| Figure interattive (calcoli e grafici) | `sim-quad.js`, `sim-esi.js`, `sim-qqq.js`, `sim-frag.js`, `sim-misc.js` |

Per il testo servono solo i file `.html`. I `.js` vanno toccati solo per cambiare le figure interattive.

## Con che cosa

Un editor di testo semplice: Visual Studio Code (consigliato, colora i tag e segnala gli errori), BBEdit, oppure TextEdit **in modalità testo semplice** (Formato > Converti in testo normale; in Preferenze, "Apri file HTML come codice HTML"). Non Word.

Per vedere la modifica: apri il file con doppio clic (o `Teoria QqQ lab.html` nella cartella `qqq_lab`) e ricarica con Cmd+R. Nell'app, scheda Teoria, ricarica la pagina.

## Dove sta il testo

Il testo è tra i "tag" `<…>`. Si cambia il testo, si lasciano i tag. Ogni tag aperto va chiuso: `<p>` … `</p>`.

```html
<h2>Titolo di sezione</h2>          compare anche nell'indice "In questa pagina"
<h3>Sottotitolo</h3>
<p>Un paragrafo con <b>grassetto</b>, <i>corsivo</i>, H<sub>2</sub>O, 10<sup>−5</sup>.</p>
<ul><li>punto elenco</li><li>altro punto</li></ul>       (<ol> per l'elenco numerato)
<a href="06-quadrupolo.html">link a un capitolo</a>
<a href="https://doi.org/..." target="_blank" rel="noopener">link esterno</a>
```

Caratteri speciali: si possono scrivere direttamente (à è ≈ → Δ λ ±), il file è UTF-8. Gli unici da evitare nel testo sono `<` e `&`: scrivi `&lt;` e `&amp;`.

## I blocchi già pronti (copia e incolla)

```html
<div class="box key"><b>Concetto chiave</b><p>Testo.</p></div>        riquadro blu
<div class="box warn"><b>Errore frequente</b><p>Testo.</p></div>      riquadro arancione
<div class="box lab"><b>In laboratorio</b><p>Testo.</p></div>         riquadro verde
<div class="box math"><b>Derivazione</b><p>Testo.</p></div>           riquadro viola

<span class="eq">a = b + c<span class="no">(6.1)</span></span>         equazione centrata con numero
<span class="frac"><span>numeratore</span><span>denominatore</span></span>   frazione

<table>
<tr><th>Colonna 1</th><th class="n">Numeri</th></tr>
<tr><td>testo</td><td class="n">1,23</td></tr>
</table>                                         class="n" allinea i numeri a destra

<details class="q"><summary>Domanda di verifica?</summary>
<p>Risposta, nascosta finché lo studente non clicca.</p></details>

<li><span class="tag">articolo</span>Autore A. (anno) Titolo. <i>Rivista</i> vol, pagine. <a href="https://doi.org/..." target="_blank" rel="noopener">doi:...</a></li>
```

## Figure

- Gli schemi disegnati (`<svg>` … `</svg>`) sono dentro i capitoli. Le scritte sono nei `<text …>testo</text>`: si possono correggere; le coordinate (`x=`, `y=`) spostano le scritte.
- Le figure interattive sono i riquadri `<div class="sim" id="sim-...">`: nel capitolo si cambiano titolo (`<h4>`) e nota; il calcolo sta nel file `sim-*.js` indicato in fondo al capitolo (`<script src="sim-....js">`).
- Per aggiungere un'immagine: metti il file (`.png` o `.svg`) in questa cartella e scrivi
  `<figure><img src="nome.png" alt="descrizione" style="max-width:100%"><figcaption><b>Figura X</b> Didascalia.</figcaption></figure>`

## Aggiungere o togliere un capitolo

1. Copia un capitolo esistente, rinominalo (es. `12-nuovo.html`), cambia `kicker`, `<h1>` e testo.
2. In `teoria.js` aggiungi una riga alla lista `CHAPTERS`: `["12-nuovo.html", "12", "Titolo nel menu"],`
3. Se vuoi, aggiungi una scheda in `index.html` (sezione "I capitoli").

Menu laterale, indice della pagina e pulsanti avanti/indietro si aggiornano da soli.

## Da non cambiare

- Le prime righe (`<!doctype …>` … `<main>`) e le ultime (`</main>` … `</html>`) di ogni capitolo.
- Gli `id="sim-..."` delle figure interattive: li usano i file `.js`.

## Se qualcosa si rompe

- Pagina vuota o figure sparite: di solito un tag non chiuso o un `"` mancante vicino all'ultima modifica.
- In Visual Studio Code i tag non chiusi sono evidenziati.
- Prima di modifiche grosse, fai un commit git (o copia il file): così puoi sempre tornare indietro.
- Controllo automatico (opzionale): `python3 -m pytest -q tests` dalla cartella `qqq_lab` verifica che link, script e capitoli esistano.
