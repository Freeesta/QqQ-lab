// Sub-tabs of the Dati view: Full Scan, MS2 (Product Ion) and MRM never share a graph. Classic script, loaded after explore.js
// (uses E, TABS, tabFiles, tabPanels, addPanel, ... from there). Each tab has its own file list, panels and starting layout.

const firstTab = () => (TABS.find(([t]) => tabFiles(t).length) || ["full"])[0];
const pickTab = want => (want && tabFiles(want).length ? want : firstTab());
E.curBy = {};

function renderTabs() {
  const el = Q("#dtabs"); if (!el) return;
  if (!tabFiles().length && E.files.length) { E.tab = firstTab(); }
  el.innerHTML = TABS.filter(([t]) => tabFiles(t).length).map(([t, n]) => `<button data-t="${t}" class="${t === E.tab ? "on" : ""}">${EH(n)}<i>${tabFiles(t).length}</i></button>`).join("") +
    `<span class="sp"></span><button id="ovbtn" title="Quali file ci sono per ogni tempo e per ogni tipo di esperimento">Tempi ed esperimenti</button>`;
  el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => setTab(b.dataset.t));
  Q("#ovbtn").onclick = openOverview;
}

function setTab(t, quiet) {
  if (!tabFiles(t).length) return;
  if (t === E.tab && !quiet) return;
  E.curBy[E.tab] = E.cur; E.tab = t;
  E.panels.forEach(p => { if (p.el) p.el.style.display = p.tab === t ? "" : "none"; });
  const back = E.curBy[t]; E.cur = E.files[back]?.kind === t ? back : (tabFiles()[0] || { k: 0 }).k;
  setActive(null);
  ensureLayout();
  fitWidth(); relayout(); fitHost(); renderFileList(); renderNav(); toolbar();
  requestAnimationFrame(() => redrawAll());
  uiSave();
}

// first time a tab is shown (or after all its panels were closed and the page reloaded): its starting layout
function ensureLayout() {
  if (!tabFiles().length || tabPanels().length) return;
  defaultLayoutTab(E.tab);
}

// MS2 experiments = one per precursor, over all the MS2 files: [{prec, ce: [..], n scans, files: n}]
function ms2Exps() {
  const m = new Map();
  tabFiles("ms2").forEach(f => (f.ms2_exps || []).forEach(x => {
    const e = m.get(x.prec) || { prec: x.prec, ce: new Set(), n: 0, files: new Set(), k: f.k };
    if (x.ce != null) e.ce.add(x.ce); e.n += x.n; e.files.add(f.k); m.set(x.prec, e);
  }));
  return [...m.values()].sort((a, b) => (a.prec ?? 0) - (b.prec ?? 0));
}

function defaultLayoutTab(t) {
  const w = hostWidth();
  if (t === "full") {
    const f0 = tabFiles("full")[0];
    const c = addPanel("chrom", { tab: "full", x: 0, y: 0, w, h: 330, full: true });
    const sp = addPanel("spec", { tab: "full", link: c.id, k: f0.k, level: 1, x: 0, y: 340, w, h: 310, full: true });
    apexSpectrum(c, sp);
  } else if (t === "ms2") {
    const exps = ms2Exps(), f0 = tabFiles("ms2")[0]; let y = 0;
    const list = exps.length ? exps.slice(0, 4) : [{ prec: null, k: f0.k }];
    list.forEach(e => {
      const k = e.k ?? f0.k, label = e.prec != null ? `MS² · precursore ${e.prec}` : "MS²";
      const c = addPanel("chrom", { tab: "ms2", prec: e.prec, title: label, x: 0, y, w, h: 250, full: true });
      const sp = addPanel("spec", { tab: "ms2", link: c.id, k, level: 2, prec: e.prec, title: `Spettro degli ioni prodotto${e.prec != null ? " · " + e.prec : ""}`, x: 0, y: y + 260, w, h: 280, full: true });
      apexSpectrum(c, sp); y += 550;
    });
  } else if (t === "mrm") {
    if (E._mrmLoading) return; E._mrmLoading = true;
    calLoad().catch(() => {}).then(() => {
      E._mrmLoading = false; if (tabPanels("mrm").length) return;
      const w2 = hostWidth(), keys = [CAL.quant, CAL.qual, ...CAL.trs.map(x => x.key)].filter((k, i, a) => k && a.indexOf(k) === i).slice(0, 3); let y = 0;
      (keys.length ? keys : [""]).forEach(key => {
        const tr = CAL.trs.find(x => x.key === key), role = key === CAL.quant ? "Quantificatore" : key === CAL.qual ? "Qualificatore" : "Transizione";
        addPanel("mrm", { tab: "mrm", tr: key, title: key ? `${role} · ${key}${tr && tr.name ? " (" + tr.name + ")" : ""}` : "Transizioni MRM", x: 0, y, w: w2, h: keys.length > 1 ? 300 : 420, full: true, imode: "man", intf: "all" });
        y += 310;
      });
      relayout(); fitHost(); calbar(); uiSave();
    });
  }
}

// strip of the MS2 tab: how many experiments there are and what each one is
function expbar() {
  const bar = Q("#expbar"); if (!bar || bar.hidden) return;
  const ex = ms2Exps(), nf = tabFiles("ms2").length;
  bar.innerHTML = ex.length ? `<b>${ex.length} esperiment${ex.length === 1 ? "o" : "i"} MS&sup2;</b> (uno per precursore) in ${nf} file: ` + ex.map(e => `<span class="ex">precursore <b>${e.prec ?? "?"}</b>${e.ce.size ? ` &middot; CE ${[...e.ce].join(", ")} V` : ""} &middot; ${e.n} scansioni${e.files.size < nf ? ` (in ${e.files.size} file su ${nf})` : ""}</span>`).join("") +
    (ex.length > 4 ? `<span class="muted"> I primi 4 hanno già il loro grafico; per gli altri usa + Cromatogramma e scegli il precursore.</span>` : "") : "Nessun esperimento MS² riconosciuto.";
}

// which files exist for each time and each kind of experiment; a click opens the file in its tab
function openOverview() {
  const kinds = TABS.filter(([t]) => tabFiles(t).length);
  const key = f => f.type === "sample" ? `0|${(f.time ?? 1e9).toString().padStart(9, "0")}` : f.type === "standard" ? `1|${(f.conc ?? 1e9).toString().padStart(9, "0")}` : "2|";
  const lab = f => f.type === "sample" ? (f.time != null ? `t = ${f.time} min` : "campione") : f.type === "standard" ? `standard${f.conc != null ? " " + f.conc + " " + (f.cunit || "") : ""}` : "bianco";
  const rows = new Map();
  E.files.forEach(f => { const k = key(f) + "|" + lab(f); if (!rows.has(k)) rows.set(k, { lab: lab(f), by: {} }); (rows.get(k).by[f.kind] = rows.get(k).by[f.kind] || []).push(f); });
  const body = [...rows.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([, r]) => `<tr><td><b>${EH(r.lab)}</b></td>` + kinds.map(([t]) => `<td>${(r.by[t] || []).map(f => `<button class="fc" data-k="${f.k}" title="Apri nella scheda ${EH(TABS.find(x => x[0] === t)[1])}">${EH(f.label)}</button>`).join("") || '<span class="muted">-</span>'}</td>`).join("") + "</tr>").join("");
  big("Tempi ed esperimenti", `<div class="muted sm" style="margin-bottom:6px">Una riga per tempo di trattamento (o standard, o bianco), una colonna per tipo di esperimento. Clic su un file: si apre nella sua scheda, un file alla volta.</div><table id="ovw"><tr><th></th>${kinds.map(([, n]) => `<th>${EH(n)}</th>`).join("")}</tr>${body}</table>`, () => {
    Q("#bigbody").querySelectorAll("button.fc").forEach(b => b.onclick = () => {
      const f = E.files[+b.dataset.k]; Q("#bigdlg").close();
      setTab(f.kind, true); E.cur = f.k; E.browse = true; renderFileList(); renderNav(); redrawAll(); uiSave();
    });
  });
}
