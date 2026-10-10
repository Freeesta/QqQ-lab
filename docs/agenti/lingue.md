# Due lingue (italiano e inglese)
Stato attuale; aggiornalo riscrivendo le righe. Il nucleo è in AGENTS.md.

- **Inglese prima** (decisione di Federico): codice, commenti, messaggi d'errore e ogni testo nuovo nascono in inglese; si scrive prima la voce in `lang/en.js`, poi la traduzione in `lang/it.js`. La lingua predefinita dell'interfaccia resta quella del browser; la Teoria resta in italiano.
- `i18n.js` (caricato per primo) + `lang/it.js` (sempre, lingua di riserva) + `lang/en.js`, JSON puro con chiavi `area.componente.voce`. `I18N.t(chiave, parametri)` con ICU ridotto ({nome}, plural); `data-i18n`, `data-i18n-html`, `data-i18n-title`… per l'HTML statico (nell'HTML resta il testo italiano); `I18N.num/fix/err` per numeri ed errori.
- Lingua = `?lang=`, poi `qqq.lang` (scelta dall'ingranaggio), poi la lingua del browser (italiano → it, altro → en). Si salvano codici, mai testi tradotti (titoli dei pannelli `@chrom`…, tipi `blank`/`sample`); il testo scritto dall'utente non si traduce.
- Un termine tecnico di spettrometria entra in `lang/glossario.json` con la fonte; un messaggio con parametri ha la descrizione in `lang/contesto.json`. Python restituisce chiavi e parametri (`UserError`, `message()`), non frasi; il server risponde `{error, error_key, params}`.
- `python3 tools/controlla_i18n.py` rifiuta italiano fuori dai cataloghi, chiavi mancanti o orfane, segnaposto diversi e glossario violato.
- Nomi e classi dei contaminanti in inglese: `chem/contaminants_en.json` (un test impone la voce per ogni id). Il riconoscimento dei nomi dei file resta italiano (`project.py`).
- Test: `e2e_inglese_*` aprono il browser in `en-US` e leggono tutto il testo visibile.
- **Trappole**: una chiave letterale in `t("…")` o `data-i18n` deve esistere nei due cataloghi (il controllo non vede chiavi costruite a pezzi: usa `t(`prefisso.${x}`)`); `t()` non compone mai una frase da pezzi; un attributo HTML (`title`) non può contenere `"` né entità (`&Delta;` si scrive `Δ`).
