"use strict";
// Lists of reference m/z (known contaminants: Keller 2008, LC-MS solvents/background Guo 2006, laboratory contaminants, user suspect lists).
// ONE engine for every list of reference: unit resolution (nominal m/z ±0.5 Da, ordered by proximity) and high resolution (ppm tolerance).
// Pure functions first (also run by node in tests/test_liste.py); page UI (mount, dialogs, IndexedDB storage) below.
// Principle 1 of AGENTS.md: in low resolution, coincidences are often accidental. The program NEVER shows automatic annotations on LR spectra.
const LISTE = (() => {
  // ---------------------------------------------------------------- pure part
  const tolDa = (mz, ppm) => Math.max(mz * ppm * 1e-6, mz < 200 ? 0.001 : 0);

  // index: the active lists, one array per polarity sorted by m/z (a list item with pol 0 goes in both)
  function buildIndex(lists, active) {
    const pos = [], neg = [];
    (lists || []).forEach(L => {
      if (!L) return;
      if (active && active[L.id] === false) return;
      (L.items || []).forEach(it => {
        const x = { ...it, list: L.id, listName: L.name || L.id };
        if (it.pol !== -1) pos.push(x);
        if (it.pol !== 1) neg.push(x);
      });
    });
    const by = (a, b) => a.mz - b.mz;
    pos.sort(by);
    neg.sort(by);
    return { pos, neg };
  }

  const lower = (a, v) => {
    let lo = 0, hi = a.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (a[m].mz < v) lo = m + 1;
      else hi = m;
    }
    return lo;
  };

  // polarity of a file/search: "positive" / 1, "negative" / -1, anything else = both
  const arrays = (idx, pol) => (pol === "positive" || pol === 1 ? [idx.pos] : pol === "negative" || pol === -1 ? [idx.neg] : [idx.pos, idx.neg]);

  // High-resolution search by ppm, or nominal search by Da if isNominal / da tolerance is passed
  function find(idx, pol, mz, tol, isNominal = false) {
    if (!idx) return [];
    const nominal = isNominal || (typeof tol === "object" && tol && tol.nominal);
    const t = nominal ? (typeof tol === "number" ? tol : (tol && tol.da) || 0.5) : tolDa(mz, typeof tol === "number" ? tol : (tol && tol.ppm) || 5);
    const out = [], seen = new Set();
    arrays(idx, pol).forEach(a => {
      for (let i = lower(a, mz - t); i < a.length && a[i].mz <= mz + t; i++) {
        const k = a[i].list + ":" + a[i].id + ":" + a[i].adduct + ":" + a[i].mz;
        if (!seen.has(k)) {
          seen.add(k);
          const diff = mz - a[i].mz;
          out.push({ ...a[i], diffDa: diff, err: (diff / a[i].mz) * 1e6 });
        }
      }
    });
    return nominal ? out.sort((p, q) => Math.abs(p.diffDa) - Math.abs(q.diffDa)) : out.sort((p, q) => Math.abs(p.err) - Math.abs(q.err));
  }

  // Nominal search at unit resolution (default ±0.5 Da, ordered by proximity |Δ m/z|)
  function findNominal(idx, pol, mz, tolDaVal = 0.5) {
    return find(idx, pol, mz, tolDaVal, true);
  }

  // series: three or more consecutive members (n, n+1, n+2...) of the same polymer and adduct among the peaks of the spectrum.
  function seriesRuns(idx, pol, mzs, ppm, minRun = 3) {
    const found = new Map();
    mzs.forEach(m => find(idx, pol, m, ppm).forEach(it => {
      if (it.series && it.series.n != null) {
        const k = it.list + ":" + it.series.id;
        if (!found.has(k)) found.set(k, new Map());
        found.get(k).set(it.series.n, it);
      }
    }));
    const out = new Map();
    found.forEach((byN, k) => {
      const ns = [...byN.keys()].sort((a, b) => a - b);
      let i = 0;
      while (i < ns.length) {
        let j = i;
        while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
        if (j - i + 1 >= minRun) {
          const nm = byN.get(ns[i]).name.replace(/ n=\d+$/, "").split(" (")[0];
          const txt = `serie ${nm} (n = ${ns[i]}-${ns[j]})`;
          for (let q = i; q <= j; q++) out.set(k + "#" + ns[q], txt);
        }
        i = j + 1;
      }
    });
    return out;
  }

  const MAXROWS = 3;
  // the lines of the box that opens on the peak (HR only): nothing when nothing matches
  function tipHtml(matches, runs, esc) {
    if (!matches || !matches.length) return "";
    const e = esc || (s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
    const row = it => {
      const ser = it.series && runs && runs.get(it.list + ":" + it.series.id + "#" + it.series.n);
      return `<div class="cont-row"><b>${e(it.name)}</b>${it.mzonly ? ` <span class="sm">solo m/z</span>` : ` <span class="sm">${e(it.adduct || "")}${it.formula ? ", " + e(it.formula.replace(/x(\d+)$/, " ×$1")) : ""}</span>`}<div class="sm">m/z teorica ${it.mz.toFixed(4)} · ${it.err >= 0 ? "+" : ""}${it.err.toFixed(1)} ppm · ${e(it.list === "keller" ? (it.source ? it.source.split(",")[0] : it.listName) : it.listName || it.list)}${ser ? ` · <b>${e(ser)}</b>` : ""}</div></div>`;
    };
    const shown = matches.slice(0, MAXROWS), more = matches.length - shown.length;
    return `<div class="cont"><div class="sm cont-h">Compatibile con un contaminante noto:</div>${shown.map(row).join("")}${more > 0 ? `<div class="sm">altre ${more}</div>` : ""}</div>`;
  }

  // CSV parsing: supports comma or semicolon, double quotes, Italian decimal comma (e.g. 150,5), NORMAN suspect lists
  function csvSplit(line, sep) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  const polOf = s => {
    s = String(s || "").trim().toLowerCase();
    return /^(\+|pos)/.test(s) ? 1 : /^(-|neg)/.test(s) ? -1 : 0;
  };

  // Find column index matching any of the candidate names (case-insensitive, normalized)
  function matchCol(head, candidates) {
    const clean = s => s.toLowerCase().replace(/[\s_\-\/]/g, "");
    const clHead = head.map(clean);
    for (const cand of candidates) {
      const idx = clHead.indexOf(clean(cand));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function csvParse(text) {
    const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
    const head = csvSplit(lines[0], sep);

    const cMz = matchCol(head, ["mz", "m/z", "monoisotopic_mass", "monoisotopicmass", "exact_mass", "exactmass", "mass", "massa"]);
    const cName = matchCol(head, ["name", "compound_name", "compoundname", "preferred_name", "nome", "substance", "title"]);
    const cForm = matchCol(head, ["formula", "molecular_formula", "molecularformula", "mol_formula", "molformula"]);
    const cPol = matchCol(head, ["polarity", "ion_mode", "ionization_mode", "polarita", "mode"]);
    const cSmiles = matchCol(head, ["smiles", "canonical_smiles", "structure"]);
    const cAdduct = matchCol(head, ["adduct", "ion", "ione", "addotto"]);
    const cNote = matchCol(head, ["note", "source", "cas_rn", "cas", "comment", "description", "id"]);

    const hasHead = cMz >= 0 || cName >= 0 || cForm >= 0 || cSmiles >= 0;
    const c = hasHead ? { mz: cMz, name: cName, formula: cForm, polarity: cPol, smiles: cSmiles, adduct: cAdduct, note: cNote }
                      : { mz: 0, name: 1, formula: 2, polarity: 3, smiles: -1, adduct: -1, note: 4 };

    const rows = [];
    lines.slice(hasHead ? 1 : 0).forEach(l => {
      const f = csvSplit(l, sep);
      const mzRaw = c.mz >= 0 ? String(f[c.mz] || "").replace(",", ".") : "";
      const mz = parseFloat(mzRaw);
      const name = c.name >= 0 ? f[c.name] || "" : "";
      const formula = c.formula >= 0 ? f[c.formula] || "" : "";
      const smiles = c.smiles >= 0 ? f[c.smiles] || "" : "";
      const adduct = c.adduct >= 0 ? f[c.adduct] || "" : "";
      const note = c.note >= 0 ? f[c.note] || "" : "";
      const polarity = c.polarity >= 0 ? polOf(f[c.polarity]) : 0;

      if (!(mz > 0) && !smiles && !formula) return;
      const obj = { mz: mz > 0 ? mz : null, name, formula, polarity, note };
      if (smiles) obj.smiles = smiles;
      if (adduct) obj.adduct = adduct;
      rows.push(obj);
    });
    return rows;
  }

  const csvCell = s => (/[",;\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
  const csvOut = rows => "mz,name,formula,polarity,note\n" + rows.map(r => [r.mz, r.name, r.formula, r.polarity === 1 ? "positive" : r.polarity === -1 ? "negative" : "both", r.note].map(csvCell).join(",")).join("\n") + "\n";

  // Creates the list object for laboratory contaminants
  const labList = rows => ({
    id: "laboratorio",
    name: "Contaminanti del laboratorio",
    source: "dell'utente",
    license: "dell'utente",
    builtin: false,
    items: (rows || []).map((r, i) => ({
      id: "lab" + i,
      name: r.name || `m/z ${r.mz}`,
      cls: "laboratorio",
      formula: r.formula || null,
      adduct: r.adduct || "ione osservato",
      z: 1,
      mz: +r.mz,
      pol: r.polarity || 0,
      series: null,
      source: r.note || "laboratorio",
      mzonly: !r.formula
    }))
  });

  // Creates the list object for an uploaded user suspect list
  function userList(id, name, filename, rows) {
    const items = (rows || []).map((r, i) => {
      let mz = r.mz;
      // Default to [M+H]+ for positive or [M-H]- for negative if formula is known and adduct is not
      let adduct = r.adduct;
      if (!adduct) adduct = r.formula ? (r.polarity === -1 ? "[M-H]-" : "[M+H]+") : "m/z osservata";
      return {
        id: (id || "usr") + "_" + i,
        name: r.name || (r.formula ? r.formula : `m/z ${mz}`),
        cls: "lista utente",
        formula: r.formula || null,
        adduct,
        z: 1,
        mz: mz ? +mz : 0,
        pol: r.polarity || 0,
        series: null,
        source: name || filename || "lista utente",
        mzonly: !r.formula
      };
    }).filter(x => x.mz > 0);

    return {
      id: id || ("usr_" + Date.now()),
      name: name || filename || "Lista utente",
      filename: filename || "",
      source: "lista utente",
      license: "dell'utente",
      builtin: false,
      items
    };
  }

  // ---------------------------------------------------------------- page & storage (IndexedDB "qqq_lab", store "liste_utente")
  const KEY_ROWS = "qqq.contaminanti", KEY_ON = "qqq.contaminanti.on", KEY_LISTS = "qqq.liste.attive";
  const IDB_NAME = "qqq_lab", IDB_VER = 2, IDB_STORE = "liste_utente";

  const ST = {
    lists: [],           // built-in lists (/api/contaminants: Keller 2008 + Guo 2006)
    userLists: [],       // lists uploaded by the user from CSV, persisted in IndexedDB
    idx: null,
    loading: null,
    err: null,
    runs: new WeakMap()
  };

  const rd = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode / quota */ } };
  const isOn = () => rd(KEY_ON, true) !== false;
  function setOn(v) { wr(KEY_ON, !!v); if (typeof redrawAll === "function") redrawAll(); }
  const labRows = () => { const r = rd(KEY_ROWS, []); return Array.isArray(r) ? r.filter(x => x && x.mz > 0) : []; };
  const saveRows = rows => { wr(KEY_ROWS, rows); reindex(); if (typeof redrawAll === "function") redrawAll(); };

  function idbOpen() {
    return new Promise(res => {
      if (typeof indexedDB === "undefined") return res(null);
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VER);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
          if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "id" });
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      } catch (_) { res(null); }
    });
  }

  async function idbGetUserLists() {
    const db = await idbOpen();
    if (!db) return [];
    return new Promise(res => {
      try {
        const t = db.transaction(IDB_STORE, "readonly");
        const req = t.objectStore(IDB_STORE).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      } catch (_) { res([]); }
    });
  }

  async function idbSaveUserList(list) {
    const db = await idbOpen();
    if (!db) return;
    return new Promise(res => {
      try {
        const t = db.transaction(IDB_STORE, "readwrite");
        t.objectStore(IDB_STORE).put(list);
        t.oncomplete = () => res();
        t.onerror = () => res();
      } catch (_) { res(); }
    });
  }

  async function idbDeleteUserList(id) {
    const db = await idbOpen();
    if (!db) return;
    return new Promise(res => {
      try {
        const t = db.transaction(IDB_STORE, "readwrite");
        t.objectStore(IDB_STORE).delete(id);
        t.oncomplete = () => res();
        t.onerror = () => res();
      } catch (_) { res(); }
    });
  }

  function reindex() {
    const act = rd(KEY_LISTS, {});
    const all = [...ST.lists, labList(labRows()), ...ST.userLists];
    ST.idx = buildIndex(all, act);
    ST.runs = new WeakMap();
  }

  // loads the built-in lists once; also loads persisted user suspect lists from IndexedDB
  function ensure() {
    if (ST.idx || ST.loading) return ST.idx;
    const p1 = (typeof J === "function") ? J("api/contaminants").then(j => { ST.lists = j.lists || []; }).catch(e => { ST.err = e; }) : Promise.resolve();
    const p2 = idbGetUserLists().then(u => { ST.userLists = u || []; }).catch(() => {});
    ST.loading = Promise.all([p1, p2]).then(() => { reindex(); ST.loading = null; });
    return null;
  }

  const ready = () => { ensure(); return ST.idx ? Promise.resolve() : (ST.loading || Promise.resolve()); };

  // For high resolution spectra only: tooltip box on hover. null if switch is off or NOT high resolution.
  function forSpec(mzs, ys, polarity, ppm) {
    if (!isOn()) return null;
    return {
      tip(m) {
        const idx = ensure(); if (!idx) return "";
        let runs = ST.runs.get(mzs);
        if (!runs || runs.ppm !== ppm) {
          const top = Math.max(0, ...ys), sel = [];
          mzs.forEach((x, i) => { if (ys[i] >= top * 0.01) sel.push(x); });
          runs = { ppm, map: seriesRuns(idx, polarity, sel, ppm) };
          ST.runs.set(mzs, runs);
        }
        return tipHtml(find(idx, polarity, m, ppm), runs.map);
      },
      match: m => (ST.idx ? find(ST.idx, polarity, m, ppm) : [])
    };
  }

  // Summary text for formulas / library matches: "name (adduct, ±ppm)"
  function textFor(mz, polarity, ppm) {
    const idx = ST.idx || ensure(); if (!idx || !isOn()) return "";
    const m = find(idx, polarity, mz, ppm); if (!m.length) return "";
    return m.slice(0, 2).map(x => `${x.name} (${x.adduct || "solo m/z"}${x.formula ? ", " + x.formula.replace(/x(\d+)$/, " ×$1") : ""}; ${x.err >= 0 ? "+" : ""}${x.err.toFixed(1)} ppm)`).join("; ") + (m.length > 2 ? ` e altre ${m.length - 2}` : "");
  }

  function addLab(mz, o = {}) {
    const rows = labRows();
    rows.push({ mz: +mz, name: o.name || "", formula: o.formula || "", polarity: o.polarity || 0, note: o.note || "" });
    saveRows(rows);
  }

  // Quick dialog to add peak to laboratory contaminants
  async function askAdd(mz, polarity) {
    const name = typeof ask === "function" ? await ask(`Aggiungi m/z ${(+mz).toFixed(4)} ai contaminanti del laboratorio. Nome (facoltativo)`, `m/z ${(+mz).toFixed(4)}`) : "";
    if (name === null || name === undefined) return;
    addLab(mz, { name, polarity: polarity === "positive" ? 1 : polarity === "negative" ? -1 : 0 });
    if (typeof toast === "function") toast("Aggiunto ai contaminanti del laboratorio");
  }

  // Dialog for laboratory contaminants
  function openLab() {
    const EHt = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const draw = () => {
      const rows = labRows();
      if (typeof big === "function") {
        big("Contaminanti del laboratorio", `<div class="muted sm" style="margin-bottom:6px">Le tue sostanze di fondo (es. dai bianchi dello strumento): salvate in questo browser.</div>
          <div class="bar"><button id="lab-xl" type="button">Esporta CSV</button><button id="lab-im" type="button">Importa CSV…</button><button id="lab-add" type="button" class="go">Aggiungi</button><input type="file" id="lab-f" accept=".csv,.txt" hidden></div>
          <table class="lct"><tr><th class="num"><i>m/z</i></th><th>Nome</th><th>Formula</th><th>Polarità</th><th>Nota</th><th></th></tr>
          ${rows.map((r, i) => `<tr><td><input data-i="${i}" data-c="mz" value="${r.mz}" style="width:84px"></td><td><input data-i="${i}" data-c="name" value="${EHt(r.name)}"></td><td><input data-i="${i}" data-c="formula" value="${EHt(r.formula)}" style="width:110px"></td>
            <td><select data-i="${i}" data-c="polarity"><option value="0"${!r.polarity ? " selected" : ""}>entrambe</option><option value="1"${r.polarity === 1 ? " selected" : ""}>positiva</option><option value="-1"${r.polarity === -1 ? " selected" : ""}>negativa</option></select></td>
            <td><input data-i="${i}" data-c="note" value="${EHt(r.note)}"></td><td><button data-del="${i}" type="button" title="Toglie questa riga">×</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nessuna sostanza. Clic destro su un picco → «Aggiungi ai contaminanti del laboratorio…», oppure «Aggiungi».</td></tr>`}</table>`, () => {
          document.querySelectorAll("#bigbody [data-c]").forEach(inp => inp.onchange = () => {
            const r = labRows(), x = r[+inp.dataset.i]; if (!x) return;
            const c = inp.dataset.c; x[c] = c === "mz" ? parseFloat(String(inp.value).replace(",", ".")) || x.mz : c === "polarity" ? +inp.value : inp.value; saveRows(r);
          });
          document.querySelectorAll("#bigbody [data-del]").forEach(b => b.onclick = () => { const r = labRows(); r.splice(+b.dataset.del, 1); saveRows(r); draw(); });
          const bAdd = document.querySelector("#lab-add"); if (bAdd) bAdd.onclick = () => { addLab(100.0, { name: "nuovo fondo" }); draw(); };
          const bXl = document.querySelector("#lab-xl"); if (bXl) bXl.onclick = () => { if (typeof dl === "function") dl("contaminanti_laboratorio.csv", csvOut(labRows()), "text/csv"); };
          const bIm = document.querySelector("#lab-im"); const fIm = document.querySelector("#lab-f");
          if (bIm && fIm) {
            bIm.onclick = () => fIm.click();
            fIm.onchange = async e => { const f = e.target.files[0]; if (!f) return; const n = csvParse(await f.text()); saveRows([...labRows(), ...n]); draw(); if (typeof toast === "function") toast(`${n.length} righe importate`); };
          }
        });
      }
    };
    draw();
  }

  // Load OpenChemLib dynamically if needed to calculate formula from SMILES
  async function ensureOCL() {
    if (typeof window !== "undefined" && window.OCL) return window.OCL;
    try {
      const mod = await import("./vendor/openchemlib.js");
      if (typeof window !== "undefined") window.OCL = mod.default || mod;
      return window.OCL;
    } catch (_) { return null; }
  }

  // Process rows from CSV: derive formula and exact mass from SMILES via OpenChemLib when missing
  async function enrichRowsWithOcl(rows) {
    let ocl = null;
    for (const r of rows) {
      if (r.smiles && (!r.formula || !(r.mz > 0))) {
        if (!ocl) ocl = await ensureOCL();
        if (ocl && ocl.Molecule) {
          try {
            const m = ocl.Molecule.fromSmiles(r.smiles);
            const mf = m.getMolecularFormula();
            if (!r.formula) r.formula = mf.formula;
            if (!(r.mz > 0)) {
              const exactM = mf.absoluteWeight;
              r.mz = r.polarity === -1 ? exactM - 1.007276 : exactM + 1.007276;
            }
          } catch (_) { /* invalid smiles */ }
        }
      }
    }
    return rows;
  }

  // Add user list from CSV text
  async function addUserListFromCsv(filename, text, customName) {
    const rawRows = csvParse(text);
    const rows = await enrichRowsWithOcl(rawRows);
    const base = filename ? filename.replace(/\.[^/.]+$/, "") : "Lista sospetti";
    const name = customName || base;
    const id = "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const uList = userList(id, name, filename, rows);
    ST.userLists.push(uList);
    await idbSaveUserList(uList);
    reindex();
    if (typeof toast === "function") toast(`Lista «${name}» caricata (${uList.items.length} sostanze)`);
    return uList;
  }

  // Delete user list
  async function deleteUserList(id) {
    ST.userLists = ST.userLists.filter(x => x.id !== id);
    await idbDeleteUserList(id);
    reindex();
    if (typeof toast === "function") toast("Lista eliminata");
  }

  // Toggle active list
  function toggleListActive(id, active) {
    const act = rd(KEY_LISTS, {});
    act[id] = active;
    wr(KEY_LISTS, act);
    reindex();
    if (typeof redrawAll === "function") redrawAll();
  }

  // ---------------------------------------------------------------- UI component: mount(container, opt) & open(opt)
  const EH = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtSub = f => EH(f).replace(/([A-Z][a-z]?|\))(\d+)/g, "$1<sub>$2</sub>").replace(/(\d?[+-])$/, "<sup>$1</sup>");

  function mount(container, opt = {}) {
    if (!container) return;
    ensure();

    // Initial state of controls
    const state = {
      mz: opt.mz != null ? String(opt.mz) : "",
      mode: opt.hr ? "ppm" : (opt.mz != null ? "da" : (window.HR && typeof E !== "undefined" && E.files.some(f => !f.gone && (HR.isHr(f, 1) || HR.isHr(f, 2))) ? "ppm" : "da")),
      tolDa: 0.5,
      tolPpm: typeof UIP !== "undefined" && UIP.hrPpm ? UIP.hrPpm : 5,
      text: "",
      pol: opt.polarity === "positive" || opt.polarity === 1 ? 1 : opt.polarity === "negative" || opt.polarity === -1 ? -1 : 0
    };

    container.innerHTML = `
      <div class="liste-panel" style="display:flex;flex-direction:column;gap:10px;padding:8px 12px;height:100%;box-sizing:border-box;overflow:auto">
        <div class="card" style="padding:10px 12px;background:var(--soft,#f8fafc);border:1px solid var(--line,#e2e8f0);border-radius:8px">
          <div style="font-size:12.5px;line-height:1.45;color:var(--ink,#1e293b)">
            <b>Risoluzione unitaria (LR):</b> le coincidenze casuali sono frequenti e la corrispondenza nominale è solo un indizio, non un'identificazione (principio didattico 1).
            Cerca sempre la serie omologa (<b>PEG: &Delta;44 Da</b>, <b>silossani: &Delta;74 Da</b>, cluster dei solventi LC-MS) o verifica la massa esatta e gli addotti a risoluzione più alta.
          </div>
        </div>

        <div class="liste-bar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <label style="display:inline-flex;align-items:center;gap:4px">
            <span><i>m/z</i></span>
            <input type="text" id="lst-mz" value="${EH(state.mz)}" placeholder="es. 445.1 o 279" style="width:110px;padding:3px 6px">
          </label>
          <span class="seg" id="lst-mode-seg" title="Modalità tolleranza: Da nominale (risoluzione unitaria) o ppm (alta risoluzione)">
            <button type="button" data-m="da" class="${state.mode === "da" ? "on" : ""}">Nominale (&plusmn; Da)</button>
            <button type="button" data-m="ppm" class="${state.mode === "ppm" ? "on" : ""}">Alta ris. (ppm)</button>
          </span>
          <label style="display:inline-flex;align-items:center;gap:4px" id="lst-tol-wrap">
            <span id="lst-tol-lbl">${state.mode === "da" ? "&plusmn; Da" : "&plusmn; ppm"}</span>
            <input type="number" id="lst-tol" value="${state.mode === "da" ? state.tolDa : state.tolPpm}" step="${state.mode === "da" ? "0.1" : "1"}" min="0.001" style="width:64px;padding:3px 6px">
          </label>
          <label style="display:inline-flex;align-items:center;gap:4px">
            <span>Cerca</span>
            <input type="text" id="lst-txt" value="${EH(state.text)}" placeholder="nome, formula o classe…" style="width:150px;padding:3px 6px">
          </label>
          <span class="seg" id="lst-pol-seg" title="Filtro polarità">
            <button type="button" data-p="1" class="${state.pol === 1 ? "on" : ""}">ESI+</button>
            <button type="button" data-p="-1" class="${state.pol === -1 ? "on" : ""}">ESI&minus;</button>
            <button type="button" data-p="0" class="${state.pol === 0 ? "on" : ""}">Tutte</button>
          </span>
        </div>

        <div style="display:flex;align-items:center;gap:12px;font-size:12px;flex-wrap:wrap">
          <span class="muted">Liste attive:</span>
          <span id="lst-src-checks" style="display:inline-flex;gap:10px;flex-wrap:wrap"></span>
          <span style="flex:1"></span>
          <button type="button" id="lst-btn-lab" style="font-size:11.5px;padding:2px 8px">Fondo laboratorio…</button>
          <button type="button" id="lst-btn-upload" style="font-size:11.5px;padding:2px 8px" class="go">+ Carica CSV sospetti…</button>
          <input type="file" id="lst-file-in" accept=".csv,.txt" hidden>
        </div>

        <div id="lst-userlists-bar" style="font-size:12px;padding:4px 8px;background:var(--panel,#fff);border:1px dashed var(--line,#cbd5e1);border-radius:6px" hidden></div>

        <div style="display:flex;align-items:baseline;justify-content:space-between">
          <span id="lst-count" class="muted sm">Caricamento…</span>
        </div>

        <div id="lst-table-wrap" style="flex:1;min-height:220px;overflow:auto;border:1px solid var(--line,#e2e8f0);border-radius:6px;background:var(--panel,#fff)">
          <table class="lct" style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="position:sticky;top:0;background:var(--soft,#f1f5f9);z-index:2">
                <th class="num" style="width:84px"><i>m/z</i> teorica</th>
                <th class="num" style="width:70px">&Delta;</th>
                <th>Nome</th>
                <th>Serie / Unità</th>
                <th>Ione</th>
                <th>Formula</th>
                <th>Pol.</th>
                <th>Classe</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody id="lst-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    const elMz = container.querySelector("#lst-mz");
    const elTol = container.querySelector("#lst-tol");
    const elTolLbl = container.querySelector("#lst-tol-lbl");
    const elTxt = container.querySelector("#lst-txt");
    const elTbody = container.querySelector("#lst-tbody");
    const elCount = container.querySelector("#lst-count");
    const elChecks = container.querySelector("#lst-src-checks");
    const elUListBar = container.querySelector("#lst-userlists-bar");
    const elFileIn = container.querySelector("#lst-file-in");

    function renderSourceChecks() {
      const act = rd(KEY_LISTS, {});
      const allLists = [...ST.lists, labList(labRows()), ...ST.userLists];
      elChecks.innerHTML = allLists.map(L => {
        const on = act[L.id] !== false;
        return `<label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer">
          <input type="checkbox" data-lid="${EH(L.id)}" ${on ? "checked" : ""}> <span>${EH(L.name)}</span>
        </label>`;
      }).join("");
      elChecks.querySelectorAll("input[data-lid]").forEach(chk => {
        chk.onchange = () => { toggleListActive(chk.dataset.lid, chk.checked); render(); };
      });

      if (ST.userLists.length) {
        elUListBar.hidden = false;
        elUListBar.innerHTML = `<span class="muted">Liste utente caricate:</span> ` + ST.userLists.map(u => `
          <span style="display:inline-flex;align-items:center;gap:4px;background:var(--soft,#f1f5f9);padding:2px 6px;border-radius:4px;margin-right:6px">
            <b>${EH(u.name)}</b> <span class="muted">(${u.items.length})</span>
            <button type="button" data-del-ul="${EH(u.id)}" title="Elimina questa lista" style="border:none;background:none;cursor:pointer;color:var(--muted);padding:0 2px">&times;</button>
          </span>`).join("");
        elUListBar.querySelectorAll("[data-del-ul]").forEach(b => {
          b.onclick = async () => { await deleteUserList(b.dataset.del-ul); renderSourceChecks(); render(); };
        });
      } else {
        elUListBar.hidden = true;
      }
    }

    function render() {
      const idx = ST.idx;
      if (!idx) {
        elCount.textContent = "Caricamento liste in corso…";
        return;
      }

      const qMz = parseFloat(String(state.mz).replace(",", "."));
      const hasMz = isFinite(qMz) && qMz > 0;
      const qTxt = state.text.trim().toLowerCase();
      const isNom = state.mode === "da";
      const tolVal = parseFloat(String(state.tol).replace(",", ".")) || (isNom ? 0.5 : 5);

      let items = [];
      if (hasMz) {
        items = isNom ? findNominal(idx, state.pol, qMz, tolVal) : find(idx, state.pol, qMz, tolVal, false);
      } else {
        // Collect all items from active lists for browsing
        const act = rd(KEY_LISTS, {});
        const pool = arrays(idx, state.pol);
        const seen = new Set();
        pool.forEach(arr => {
          arr.forEach(it => {
            const k = it.list + ":" + it.id + ":" + it.adduct + ":" + it.mz;
            if (!seen.has(k)) { seen.add(k); items.push(it); }
          });
        });
        items.sort((a, b) => a.mz - b.mz);
      }

      if (qTxt) {
        items = items.filter(it => {
          const t = ((it.name || "") + " " + (it.formula || "") + " " + (it.cls || "") + " " + (it.source || "")).toLowerCase();
          return t.includes(qTxt);
        });
      }

      const limit = 400;
      const shown = items.slice(0, limit);
      elCount.innerHTML = `Trovati <b>${items.length}</b> ioni${items.length > limit ? ` (mostrati i primi ${limit})` : ""}${hasMz ? (isNom ? ` entro &plusmn;${tolVal} Da nominale da m/z ${qMz}` : ` entro &plusmn;${tolVal} ppm da m/z ${qMz}`) : ""}`;

      if (!shown.length) {
        elTbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;padding:16px">Nessuna sostanza corrisponde ai criteri impostati.</td></tr>`;
        return;
      }

      elTbody.innerHTML = shown.map(it => {
        const delta = hasMz ? (isNom ? (it.diffDa != null ? (it.diffDa >= 0 ? "+" : "") + it.diffDa.toFixed(3) + " Da" : "")
                                    : (it.err != null ? (it.err >= 0 ? "+" : "") + it.err.toFixed(1) + " ppm" : "")) : "";
        const polBadge = it.pol === 1 ? `<span class="pol pos" style="font-size:10px">ESI+</span>` : it.pol === -1 ? `<span class="pol neg" style="font-size:10px">ESI&minus;</span>` : `<span class="pol both" style="font-size:10px">&plusmn;</span>`;
        const seriesInfo = it.series ? `<span class="sm" title="Membro n=${it.series.n}">n=${it.series.n}</span>` : "";
        return `<tr>
          <td class="num font-mono"><b>${it.mz.toFixed(4)}</b></td>
          <td class="num sm muted">${delta}</td>
          <td><b>${EH(it.name)}</b></td>
          <td>${seriesInfo}</td>
          <td>${EH(it.adduct || "solo m/z")}</td>
          <td>${it.formula ? fmtSub(it.formula) : "<span class='muted'>&ndash;</span>"}</td>
          <td>${polBadge}</td>
          <td class="sm muted">${EH(it.cls || "")}</td>
          <td class="sm">${EH(it.listName || it.source || it.list)}</td>
        </tr>`;
      }).join("");
    }

    // Bind event listeners
    elMz.oninput = e => { state.mz = e.target.value; render(); };
    elTxt.oninput = e => { state.text = e.target.value; render(); };
    elTol.oninput = e => {
      const v = parseFloat(e.target.value);
      if (state.mode === "da") state.tolDa = v || 0.5;
      else state.tolPpm = v || 5;
      render();
    };

    container.querySelectorAll("#lst-mode-seg button").forEach(b => {
      b.onclick = () => {
        state.mode = b.dataset.m;
        container.querySelectorAll("#lst-mode-seg button").forEach(x => x.classList.toggle("on", x === b));
        const isNom = state.mode === "da";
        elTolLbl.innerHTML = isNom ? "&plusmn; Da" : "&plusmn; ppm";
        elTol.value = isNom ? state.tolDa : state.tolPpm;
        elTol.step = isNom ? "0.1" : "1";
        render();
      };
    });

    container.querySelectorAll("#lst-pol-seg button").forEach(b => {
      b.onclick = () => {
        state.pol = +b.dataset.p;
        container.querySelectorAll("#lst-pol-seg button").forEach(x => x.classList.toggle("on", x === b));
        render();
      };
    });

    const bUpload = container.querySelector("#lst-btn-upload");
    if (bUpload && elFileIn) {
      bUpload.onclick = () => elFileIn.click();
      elFileIn.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          await addUserListFromCsv(file.name, text);
          renderSourceChecks();
          render();
        } catch (err) {
          if (typeof toast === "function") toast("Errore nel caricamento CSV: " + err.message);
        }
      };
    }

    const bLab = container.querySelector("#lst-btn-lab");
    if (bLab) bLab.onclick = () => openLab();

    ready().then(() => {
      renderSourceChecks();
      render();
    });

    return { render, state };
  }

  // Opens the reference list panel: switches tab in sidebar if available, or opens modal dialog #listedlg
  function open(opt = {}) {
    ensure();
    // 1. Check if sidebar tab for lists exists in DOM (e.g. from Binario A)
    const asideTabBtn = document.querySelector("#tab-btn-liste, [data-tab='liste']");
    const asidePanel = document.querySelector("#aside-panel-liste, [data-panel='liste']");
    if (asideTabBtn && asidePanel) {
      if (typeof asideTabBtn.click === "function") asideTabBtn.click();
      mount(asidePanel, opt);
      return;
    }

    // 2. Otherwise open in a dedicated modal dialog
    let dlg = document.querySelector("#listedlg");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "listedlg";
      dlg.style.cssText = "max-width:min(1100px,96vw);width:96vw;max-height:92vh;border:1px solid var(--line,#cbd5e1);border-radius:10px;padding:12px;background:var(--panel,#fff);box-shadow:0 12px 36px rgba(0,0,0,.28);box-sizing:border-box";
      dlg.innerHTML = `<div class="top" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <h3 style="margin:0;flex:1">Liste di riferimento e contaminanti</h3>
        <button id="listex" class="x" title="Chiudi">&times;</button>
      </div><div id="listebody" style="max-height:80vh;overflow:auto"></div>`;
      document.body.appendChild(dlg);
      dlg.querySelector("#listex").onclick = () => dlg.close();
    }
    const body = dlg.querySelector("#listebody");
    mount(body, opt);
    if (!dlg.open) dlg.showModal();
  }

  return {
    tolDa,
    buildIndex,
    find,
    findNominal,
    seriesRuns,
    tipHtml,
    csvSplit,
    csvParse,
    csvOut,
    labList,
    userList,
    addUserListFromCsv,
    deleteUserList,
    toggleListActive,
    forSpec,
    textFor,
    ensure,
    ready,
    isOn,
    setOn,
    openLab,
    askAdd,
    addLab,
    labRows,
    mount,
    open,
    openSearch: open
  };
})();

if (typeof document !== "undefined") {
  const bindListeBtn = () => {
    const b = document.querySelector("#np-liste");
    if (b) b.onclick = () => LISTE.open();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindListeBtn);
  else bindListeBtn();
}

if (typeof module !== "undefined") module.exports = LISTE;
if (typeof window !== "undefined") window.LISTE = LISTE;
