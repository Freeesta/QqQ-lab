"use strict";
// Lists of reference m/z (known contaminants today; background of the solvents and lists of suspects later): ONE engine for every list, so a new list is only data.
// Pure functions first (also run by node in tests/test_liste.py); the part that talks to the page (load, switch, the list of the laboratory) is at the end.
// A list = { id, name, source, license, builtin, items: [{ id, name, cls, formula, adduct, z, mz, pol (1 / -1), series: {id, n} | null, source, mzonly }] }.
// The built-in list comes from /api/contaminants (mzlab/chem/contaminants.py computes the m/z from the formulas); the lists of the user are made here from CSV.
// A coincidence of m/z is a compatibility with a known substance, never an identification (same rule as the libraries).
const LISTE = (() => {
  // ---------------------------------------------------------------- pure part
  const tolDa = (mz, ppm) => Math.max(mz * ppm * 1e-6, mz < 200 ? 0.001 : 0);        // the tolerance of the file, at least 1 mDa under m/z 200
  // index: the active lists, one array per polarity sorted by m/z (a list item with pol 0 goes in both)
  function buildIndex(lists, active) {
    const pos = [], neg = [];
    (lists || []).forEach(L => {
      if (active && active[L.id] === false) return;
      (L.items || []).forEach(it => { const x = { ...it, list: L.id, listName: L.name }; if (it.pol !== -1) pos.push(x); if (it.pol !== 1) neg.push(x); });
    });
    const by = (a, b) => a.mz - b.mz; pos.sort(by); neg.sort(by);
    return { pos, neg };
  }
  const lower = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].mz < v) lo = m + 1; else hi = m; } return lo; };
  // the polarity of a file: "positive" / "negative" / anything else = unknown (both are searched)
  const arrays = (idx, pol) => (pol === "positive" || pol === 1 ? [idx.pos] : pol === "negative" || pol === -1 ? [idx.neg] : [idx.pos, idx.neg]);
  function find(idx, pol, mz, ppm) {
    const t = tolDa(mz, ppm), out = [], seen = new Set();
    arrays(idx, pol).forEach(a => { for (let i = lower(a, mz - t); i < a.length && a[i].mz <= mz + t; i++) { const k = a[i].list + a[i].id + a[i].adduct + a[i].mz; if (!seen.has(k)) { seen.add(k); out.push({ ...a[i], err: (mz - a[i].mz) / a[i].mz * 1e6 }); } } });
    return out.sort((p, q) => Math.abs(p.err) - Math.abs(q.err));
  }
  // series: three or more consecutive members (n, n+1, n+2...) of the same polymer and adduct among the peaks of the spectrum. Returns Map "seriesId#n" -> "serie PEG (n = 7-12)"
  function seriesRuns(idx, pol, mzs, ppm, minRun = 3) {
    const found = new Map();                                                          // series id -> Map n -> item
    mzs.forEach(m => find(idx, pol, m, ppm).forEach(it => { if (it.series && it.series.n != null) { const k = it.list + ":" + it.series.id; if (!found.has(k)) found.set(k, new Map()); found.get(k).set(it.series.n, it); } }));
    const out = new Map();
    found.forEach((byN, k) => {
      const ns = [...byN.keys()].sort((a, b) => a - b); let i = 0;
      while (i < ns.length) {
        let j = i; while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
        if (j - i + 1 >= minRun) { const nm = byN.get(ns[i]).name.replace(/ n=\d+$/, "").split(" (")[0], txt = `serie ${nm} (n = ${ns[i]}-${ns[j]})`; for (let q = i; q <= j; q++) out.set(k + "#" + ns[q], txt); }
        i = j + 1;
      }
    });
    return out;
  }
  const MAXROWS = 3;
  // the lines of the box that opens on the peak: nothing when nothing matches
  function tipHtml(matches, runs, esc) {
    if (!matches.length) return "";
    const e = esc || (s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
    const row = it => {
      const ser = it.series && runs && runs.get(it.list + ":" + it.series.id + "#" + it.series.n);
      return `<div class="cont-row"><b>${e(it.name)}</b>${it.mzonly ? ` <span class="sm">solo m/z</span>` : ` <span class="sm">${e(it.adduct)}${it.formula ? ", " + e(it.formula.replace(/x(\d+)$/, " ×$1")) : ""}</span>`}<div class="sm">m/z teorica ${it.mz.toFixed(4)} · ${it.err >= 0 ? "+" : ""}${it.err.toFixed(1)} ppm · ${e(it.list === "keller" ? it.source.split(",")[0] : it.listName || it.list)}${ser ? ` · <b>${e(ser)}</b>` : ""}</div></div>`;
    };
    const shown = matches.slice(0, MAXROWS), more = matches.length - shown.length;
    return `<div class="cont"><div class="sm cont-h">Compatibile con un contaminante noto:</div>${shown.map(row).join("")}${more > 0 ? `<div class="sm">altre ${more}</div>` : ""}</div>`;
  }
  // CSV of the laboratory: mz,name,formula,polarity,note (comma or semicolon; text between quotes)
  function csvSplit(line, sep) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ""; } else cur += c; }
    out.push(cur); return out.map(s => s.trim());
  }
  const polOf = s => { s = String(s || "").trim().toLowerCase(); return /^(\+|pos)/.test(s) ? 1 : /^(-|neg)/.test(s) ? -1 : 0; };
  function csvParse(text) {
    const lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim()); if (!lines.length) return [];
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",", head = csvSplit(lines[0], sep).map(s => s.toLowerCase());
    const col = n => head.indexOf(n), hasHead = col("mz") >= 0, c = hasHead ? { mz: col("mz"), name: col("name"), formula: col("formula"), polarity: col("polarity"), note: col("note") } : { mz: 0, name: 1, formula: 2, polarity: 3, note: 4 };
    const rows = [];
    lines.slice(hasHead ? 1 : 0).forEach(l => { const f = csvSplit(l, sep), mz = parseFloat(String(f[c.mz] || "").replace(",", ".")); if (!(mz > 0)) return;
      rows.push({ mz, name: f[c.name] || "", formula: f[c.formula] || "", polarity: polOf(f[c.polarity]), note: f[c.note] || "" }); });
    return rows;
  }
  const csvCell = s => (/[",;\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
  const csvOut = rows => "mz,name,formula,polarity,note\n" + rows.map(r => [r.mz, r.name, r.formula, r.polarity === 1 ? "positive" : r.polarity === -1 ? "negative" : "both", r.note].map(csvCell).join(",")).join("\n") + "\n";
  // the contaminants of the laboratory as a list of the engine (the m/z is the one the user measured, as an ion)
  const labList = rows => ({ id: "laboratorio", name: "Contaminanti del laboratorio", source: "dell'utente", license: "dell'utente", builtin: false,
    items: (rows || []).map((r, i) => ({ id: "lab" + i, name: r.name || `m/z ${r.mz}`, cls: "laboratorio", formula: r.formula || null, adduct: "ione osservato", z: 1, mz: +r.mz, pol: r.polarity || 0, series: null, source: r.note || "laboratorio", mzonly: !r.formula })) });

  // ---------------------------------------------------------------- the page
  const KEY_ROWS = "qqq.contaminanti", KEY_ON = "qqq.contaminanti.on", KEY_LISTS = "qqq.liste.attive";
  const ST = { lists: [], idx: null, loading: null, err: null, runs: new WeakMap() };
  const rd = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage: lasts until the page is closed */ } };
  const isOn = () => rd(KEY_ON, true) !== false;
  function setOn(v) { wr(KEY_ON, !!v); if (typeof redrawAll === "function") redrawAll(); }
  const labRows = () => { const r = rd(KEY_ROWS, []); return Array.isArray(r) ? r.filter(x => x && x.mz > 0) : []; };
  const saveRows = rows => { wr(KEY_ROWS, rows); reindex(); if (typeof redrawAll === "function") redrawAll(); };
  function reindex() { const act = rd(KEY_LISTS, {}); ST.idx = buildIndex([...ST.lists, labList(labRows())], act); ST.runs = new WeakMap(); }
  // loads the built-in list once (the server computes the m/z); the lab list is always there
  function ensure() {
    if (ST.idx || ST.loading) return ST.idx;
    if (typeof J !== "function") return null;
    ST.loading = J("api/contaminants").then(j => { ST.lists = j.lists || []; }).catch(e => { ST.err = e; }).then(() => { reindex(); ST.loading = null; });
    return null;
  }
  const ready = () => { ensure(); return ST.idx ? Promise.resolve() : (ST.loading || Promise.resolve()); };
  // for one spectrum: tip(mz) = the HTML for the box of the peak (series computed once per spectrum). null if off or not high resolution.
  function forSpec(mzs, ys, polarity, ppm) {
    if (!isOn()) return null;
    return { tip(m) {
      const idx = ensure(); if (!idx) return "";
      let runs = ST.runs.get(mzs);
      if (!runs || runs.ppm !== ppm) {                                                // once per spectrum: the peaks above 1 % of the highest
        const top = Math.max(0, ...ys), sel = []; mzs.forEach((x, i) => { if (ys[i] >= top * 0.01) sel.push(x); });
        runs = { ppm, map: seriesRuns(idx, polarity, sel, ppm) }; ST.runs.set(mzs, runs);
      }
      return tipHtml(find(idx, polarity, m, ppm), runs.map);
    }, match: m => (ST.idx ? find(ST.idx, polarity, m, ppm) : []) };
  }
  // one line of text for the other places (formulas window, MS2 table, menu): "name (adduct, ±ppm)" or ""
  function textFor(mz, polarity, ppm) {
    const idx = ST.idx || ensure(); if (!idx || !isOn()) return "";
    const m = find(idx, polarity, mz, ppm); if (!m.length) return "";
    return m.slice(0, 2).map(x => `${x.name} (${x.adduct}${x.formula ? ", " + x.formula.replace(/x(\d+)$/, " ×$1") : ""}; ${x.err >= 0 ? "+" : ""}${x.err.toFixed(1)} ppm)`).join("; ") + (m.length > 2 ? ` e altre ${m.length - 2}` : "");
  }
  function addLab(mz, o = {}) { const rows = labRows(); rows.push({ mz: +mz, name: o.name || "", formula: o.formula || "", polarity: o.polarity || 0, note: o.note || "" }); saveRows(rows); }
  // window of the contaminants of the laboratory: see, edit, export and import
  function openLab() {
    const EHt = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const draw = () => {
      const rows = labRows();
      big("Contaminanti del laboratorio", `<div class="muted sm" style="margin-bottom:6px">Le tue sostanze di fondo (per esempio dai bianchi del tuo strumento): al passaggio del mouse sul picco compare «Compatibile con un contaminante noto». Restano in questo browser.</div>
        <div class="bar"><button id="lab-xl" type="button">Esporta CSV</button><button id="lab-im" type="button">Importa CSV…</button><button id="lab-add" type="button" class="go">Aggiungi</button><input type="file" id="lab-f" accept=".csv,.txt" hidden></div>
        <table class="lct"><tr><th class="num"><i>m/z</i></th><th>Nome</th><th>Formula</th><th>Polarità</th><th>Nota</th><th></th></tr>
        ${rows.map((r, i) => `<tr><td><input data-i="${i}" data-c="mz" value="${r.mz}" style="width:84px"></td><td><input data-i="${i}" data-c="name" value="${EHt(r.name)}"></td><td><input data-i="${i}" data-c="formula" value="${EHt(r.formula)}" style="width:110px"></td>
          <td><select data-i="${i}" data-c="polarity"><option value="0"${!r.polarity ? " selected" : ""}>entrambe</option><option value="1"${r.polarity === 1 ? " selected" : ""}>positiva</option><option value="-1"${r.polarity === -1 ? " selected" : ""}>negativa</option></select></td>
          <td><input data-i="${i}" data-c="note" value="${EHt(r.note)}"></td><td><button data-del="${i}" type="button" title="Toglie questa riga">×</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nessuna sostanza. Clic destro su un picco → «Aggiungi ai contaminanti del laboratorio…», oppure «Aggiungi».</td></tr>`}</table>`, () => {
        document.querySelectorAll("#bigbody [data-c]").forEach(inp => inp.onchange = () => { const r = labRows(), x = r[+inp.dataset.i]; if (!x) return; const c = inp.dataset.c; x[c] = c === "mz" ? parseFloat(String(inp.value).replace(",", ".")) || x.mz : c === "polarity" ? +inp.value : inp.value; saveRows(r); });
        document.querySelectorAll("#bigbody [data-del]").forEach(b => b.onclick = () => { const r = labRows(); r.splice(+b.dataset.del, 1); saveRows(r); draw(); });
        Q("#lab-add").onclick = () => { addLab(0.0001, { name: "nuova" }); const r = labRows(); r[r.length - 1].mz = 100; saveRows(r); draw(); };
        Q("#lab-xl").onclick = () => { if (typeof dl === "function") dl("contaminanti_laboratorio.csv", csvOut(labRows()), "text/csv"); };
        Q("#lab-im").onclick = () => Q("#lab-f").click();
        Q("#lab-f").onchange = async e => { const f = e.target.files[0]; if (!f) return; const n = csvParse(await f.text()); saveRows([...labRows(), ...n]); draw(); if (typeof toast === "function") toast(`${n.length} righe importate`); };
      });
    };
    draw();
  }
  // asks the data of a contaminant of the laboratory for the peak at m/z
  async function askAdd(mz, polarity) {
    const name = typeof ask === "function" ? await ask(`Aggiungi m/z ${(+mz).toFixed(4)} ai contaminanti del laboratorio. Nome (facoltativo)`, `m/z ${(+mz).toFixed(4)}`) : "";
    if (name === null || name === undefined) return;
    addLab(mz, { name, polarity: polarity === "positive" ? 1 : polarity === "negative" ? -1 : 0 });
    if (typeof toast === "function") toast("Aggiunto ai contaminanti del laboratorio");
  }
  return { tolDa, buildIndex, find, seriesRuns, tipHtml, csvParse, csvOut, labList, forSpec, textFor, ensure, ready, isOn, setOn, openLab, askAdd, addLab, labRows };
})();
if (typeof module !== "undefined") module.exports = LISTE;
if (typeof window !== "undefined") window.LISTE = LISTE;
