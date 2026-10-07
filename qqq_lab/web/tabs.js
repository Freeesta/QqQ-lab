// Sub-tabs of the Dati view: Full Scan, MS2 (Product Ion) and MRM never share a graph. Classic script, loaded after explore.js
// (uses E, TABS, tabFiles, tabPanels, addPanel, ... from there). Each tab has its own file list, panels and starting layout.

const firstTab = () => (TABS.find(([t]) => tabFiles(t).length) || ["full"])[0];
const pickTab = want => (want && tabFiles(want).length ? want : firstTab());
E.curBy = {};

const TABICON = { full: "full", ms2: "prod", mrm: "mrm" }, TABHELP = { full: "modo-full", ms2: "modo-ms2", mrm: "modo-mrm" };
// short label of the tab (what the experiment is and what it is for), from the text of the three modes
function modeTip(t) {
  try { const m = QMODI.M[QMODI.tab2key[t]]; return [m.what, m.use].filter(Boolean).join(". ").replace(/<[^>]+>/g, "").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); } catch (e) { return ""; }
}
// the label of a tab: the scheme Q1 -> q2 -> Q3 in big, with the words (texts from modi.js)
function modeSchema(t) {
  try {
    const m = QMODI.M[QMODI.tab2key[t]], st = ["Q1", "q2", "Q3"].map((n, i) => `<div class="qb"><b>${n}</b><span>${m.q[i].replace(/^Q[123] /, "")}</span></div>`);
    return `<div class="qs"><b>${m.name}</b><div class="qr">${st.join('<span class="qa">&rarr;</span>')}</div><div class="qw"><b>${m.what}.</b> ${m.use}</div></div>`;
  } catch (e) { return ""; }
}
function renderTabs() {
  const el = Q("#dtabs"); if (!el) return;
  el.innerHTML = TABS.map(([t, n]) => {
    const c = tabFiles(t).length;
    return `<span class="tw"><button data-t="${t}" data-tiph="${EH(modeSchema(t))}" class="${t === E.tab ? "on" : ""}${c ? "" : " off"}">${EH(n)}<i>${c}</i></button></span>`;
  }).join("") + `<span class="sp"></span><button id="ovbtn" title="Quali file ci sono per ogni tempo e per ogni tipo di esperimento">Tempi ed esperimenti</button>`;
  el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => setTab(b.dataset.t));
  Q("#ovbtn").onclick = openOverview;
}

// an empty tab stays reachable: it says where the files are instead of showing blank graphs
function emptyTab() {
  const el = Q("#tabempty"); if (!el) return;
  const t = E.tab, name = (TABS.find(x => x[0] === t) || [, t])[1];
  if (tabFiles(t).length) { el.hidden = true; return; }
  const other = TABS.filter(([k]) => k !== t && tabFiles(k).length);
  el.hidden = false;
  el.innerHTML = `<b>Qui non ci sono file ${EH(name)}.</b> ` + (other.length ? "I tuoi file sono nella scheda: " + other.map(([k, n]) => `<button class="go" data-go="${k}">${EH(n)} (${tabFiles(k).length})</button>`).join(" ") : "Non hai ancora caricato nulla.") + ` <button data-load="1" title="Apre la pagina di caricamento: i file già caricati restano nella sessione">+ Carica file ${EH(name)}</button>`;
  el.querySelectorAll("[data-load]").forEach(b => b.onclick = () => Q("#addf").click());
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => setTab(b.dataset.go));
}
window.emptyTab = emptyTab;

function setTab(t, quiet) {
  if (t === E.tab && !quiet) return;
  E.curBy[E.tab] = E.cur;
  E.activeBy = E.activeBy || {};      // coming back to a tab: same active graph as when the student left it (no automatic scroll)
  E.activeBy[E.tab] = E.active; E.tab = t;
  E.panels.forEach(p => { if (p.el) p.el.style.display = p.tab === t ? "" : "none"; });
  const back = E.curBy[t]; E.cur = E.files[back]?.kind === t ? back : (tabFiles()[0] || { k: E.cur }).k;
  setActive(E.activeBy[t] && E.panels.includes(E.activeBy[t]) ? E.activeBy[t] : null); playStop();
  E.panels.forEach(q => { if (q.type === "spec") q.lock = null; });      // changing tab: the axes of the spectra are free again
  const firstLayout = tabFiles().length && !tabPanels().length;
  if (firstLayout) loading(true);                       // same funny loading screen as everywhere else
  ensureLayout();
  if (firstLayout) Promise.all(tabPanels().map(p => p.ready).filter(Boolean)).catch(() => {}).then(() => loading(false));
  renderTabs(); fitWidth(); relayout(); fitHost(); renderFileList(); renderNav(); toolbar();
  requestAnimationFrame(() => redrawAll());
  uiSave();
}

// first time a tab is shown (or after all its panels were closed and the page reloaded): its starting layout
function ensureLayout() {
  if (!tabFiles().length || tabPanels().length) return;
  defaultLayoutTab(E.tab);
}

// transitions of the MRM files and which one is the quantifier / qualifier (by the name in the method: Quant, Qual; otherwise the first and the second).
// The calibration line itself is NOT made by the program: the students do it in Excel from the integration table.
const CAL = { quant: null, qual: null, trs: [] };
function calPick() {
  const t = CAL.trs;
  if (!t.some(x => x.key === CAL.quant)) CAL.quant = (t.find(x => /quant/i.test(x.name)) || t[0] || {}).key || null;
  if (!t.some(x => x.key === CAL.qual) || CAL.qual === CAL.quant) CAL.qual = (t.find(x => /qual/i.test(x.name) && x.key !== CAL.quant) || t.find(x => x.key !== CAL.quant) || {}).key || null;
}
async function calLoad() {
  const mf = E.files.filter(f => f.kind === "mrm"), seen = new Map();
  (await Promise.all(mf.map(f => getMrm(f.k)))).forEach(tr => tr.forEach(t => { const key = `${t.q1}>${t.q3}`; if (!seen.has(key)) seen.set(key, { key, name: t.name || "" }); }));
  CAL.trs = [...seen.values()]; calPick();
}

// MS2 experiments = one per precursor, over all the MS2 files: [{prec, ce: [..], n scans, files: n}]
function ms2Exps() {
  const m = new Map();
  tabFiles("ms2").forEach(f => (f.ms2_exps || []).forEach(x => {
    const e = m.get(x.prec) || { prec: x.prec, ce: new Set(), n: 0, files: new Set(), k: f.k };
    if (x.ce != null) e.ce.add(x.ce); e.n += x.n; e.files.add(f.k); m.set(x.prec, e);
  }));
  const l = [...m.values()];
  return l.length > 8 ? l.sort((a, b) => b.n - a.n) : l.sort((a, b) => (a.prec ?? 0) - (b.prec ?? 0));      // a data-dependent file has many precursors with few scans: the most scanned first
}
// a triangle on the survey chromatogram: open that product-ion scan in the MS2 tab
async function goMs2(t) {
  setTab("ms2", true);
  await new Promise(r => setTimeout(r, 700));
  await ms2Switch(t.prec);
  const c = tabPanels("ms2").filter(q => q.type === "chrom").sort((a, b) => a.y - b.y)[0]; if (!c) return;
  E.cur = t.k2; c.cur = t.rt; c.sel = null; const dt = 0.01;
  pushLinked(c, t.rt - dt / 2, t.rt + dt / 2, t.k2); draw(c); uiSave();
}

function defaultLayoutTab(t) {
  const w = hostWidth();
  if (t === "full") {
    const f0 = tabFiles("full")[0];
    // chromatogram + linked spectrum must both fit in the window (a laptop at 1280x720 would push the spectrum below the fold and the arrows need both in view):
    // the usual 330 + 310 px when there is room, otherwise the height left in the window shared 50/50 (never below 190 px each)
    const dp = Q("#dpanels"), top = dp.offsetParent ? dp.getBoundingClientRect().top + scrollY : Q("header").getBoundingClientRect().height + 126, avail = innerHeight - top - 42;   // (not laid out yet while the loading screen is up: header + tabs + toolbar)
    let hc = 330, hs = 310; if (avail < hc + hs + 10) { hc = Math.max(190, Math.round((avail - 10) * 0.5)); hs = Math.max(190, Math.round(avail - 10 - hc)); }
    const c = addPanel("chrom", { tab: "full", x: 0, y: 0, w, h: hc, full: true });
    const sp = addPanel("spec", { tab: "full", link: c.id, k: f0.k, level: 1, x: 0, y: hc + 10, w, h: hs, full: true });
    if (window.DDA && f0.dda) DDA.make(c, sp);                 // a data-dependent file: the MS2 scans sit to the right of the Full Scan
    apexSpectrum(c, sp);
    let tries = 0, h0 = [c.h, sp.h];       // once the graphs are on screen the real top of the page is known (a wrapped toolbar moves it): correct the heights then
    const fix = () => {
      if (!E.panels.includes(c) || !E.panels.includes(sp) || c.h !== h0[0] || sp.h !== h0[1]) return;      // the student already resized them
      if (!dp.offsetParent) { if (++tries < 60) requestAnimationFrame(fix); return; }
      const av = innerHeight - (dp.getBoundingClientRect().top + scrollY) - 14;
      if (c.h + sp.h + 10 <= av) return;
      c.h = Math.max(190, Math.round((av - 10) * 0.5)); sp.h = Math.max(190, Math.round(av - 10 - c.h)); sp.y = c.y + c.h + 10; apply(c); apply(sp); fitHost(); draw(c); draw(sp);
    };
    requestAnimationFrame(fix);
  } else if (t === "ms2") {
    const exps = ms2Exps(), f0 = tabFiles("ms2")[0]; let y = 0;
    const list = exps.length ? exps.slice(0, 1) : [{ prec: null, k: f0.k }];       // ONE pair (chromatogram + spectrum) for the first precursor; the list on the left switches it
    list.forEach(e => { addMs2Pair(e, y); y += 550; });
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
      relayout(); fitHost(); uiSave();
      const made = tabPanels("mrm"); Promise.all(made.map(q => q.ready).filter(Boolean)).catch(() => {}).then(() => mrmFocus(made));
    });
  }
}

// First view of the MRM graphs: the peak is ~0.5 min wide in a 20 min run, so the student would zoom every time. All graphs zoom on +-1.5 min around the
// highest transition of all the visible files, only if that peak is clear (>= 10x the noise); otherwise the whole run stays. "Vista intera" is one click.
function mrmFocus(ps) {
  let best = null;
  for (const q of ps) for (const s of (q._a && q._a.sr) || []) {
    if (!s.y.length) continue;
    let mx = -1, at = 0; s.y.forEach((v, i) => { if (v > mx) { mx = v; at = i; } });
    const ys = Float64Array.from(s.y).sort(), med = ys[ys.length >> 1], dev = Float64Array.from(ys, v => Math.abs(v - med)).sort(), noise = 1.4826 * dev[dev.length >> 1];
    if (mx >= 10 * Math.max(med + 3 * noise, 1) && (!best || mx > best.mx)) best = { mx, rt: s.x[at] };
  }
  if (!best) return;
  ps.forEach(q => { const a = q._a; if (a && a.full && !q.zoom) { q.zoom = clampView(best.rt - 1.5, best.rt + 1.5, a.full[0], a.full[1]); draw(q); } });
  uiSave();
}

// one MS2 experiment = precursor chromatogram (above) + product-ion spectrum (below, linked)
function addMs2Pair(e, y) {
  const w = hostWidth(), f0 = tabFiles("ms2")[0], k = e.k ?? f0.k, label = e.prec != null ? `MS2 · precursore ${e.prec}` : "MS2";
  const c = addPanel("chrom", { tab: "ms2", prec: e.prec, title: label, x: 0, y, w, h: 250, full: true });
  const sp = addPanel("spec", { tab: "ms2", link: c.id, k, level: 2, prec: e.prec, title: `Spettro degli ioni prodotto${e.prec != null ? " · " + e.prec : ""}`, x: 0, y: y + 260, w, h: 280, full: true });
  apexSpectrum(c, sp); return c;
}
const ms2PairOf = prec => E.panels.find(p => p.tab === "ms2" && p.type === "chrom" && String(p.prec) === String(prec));
// sidebar of the MS2 tab: tick a precursor to show its two graphs (they are created if missing), untick to close them, click the name to go to them
function ms2Toggle(prec, on) {
  const c = ms2PairOf(prec);
  if (on && !c) { const e = ms2Exps().find(x => String(x.prec) === String(prec)); if (e) { addMs2Pair(e, tabPanels().reduce((m, q) => Math.max(m, q.y + q.h + 10), 0)); relayout(); fitHost(); } }
  if (!on && c) { [...E.panels.filter(q => q.link === c.id || q.src === c.id), c].forEach(q => q.el.querySelector(".x").click()); }
  renderFileList(); uiSave();
}
// click on a precursor in the list: if it already has its graphs, go there; otherwise the main pair (the top one) switches to it: no new panels
function ms2Goto(prec) {
  const c = ms2PairOf(prec); if (!c) return ms2Switch(prec);
  setActive(c); front(c.el); window.scrollTo({ top: Q("#dpanels").getBoundingClientRect().top + scrollY + c.y - hdrH() - 12, behavior: "smooth" });
}
function ms2Switch(prec) {
  const c = tabPanels("ms2").filter(q => q.type === "chrom").sort((a, b) => a.y - b.y)[0];
  if (!c) return ms2Toggle(prec, true);
  c.prec = prec; c.title = prec != null ? `MS2 · precursore ${prec}` : "MS2"; c.sel = null;
  const live = E.panels.filter(q => q.type === "spec" && q.link === c.id);
  live.forEach(sp => { sp.prec = prec; sp.zoom = null; sp.zoomY = null; sp.lock = null; sp.title = `Spettro degli ioni prodotto${prec != null ? " · " + prec : ""}`; });
  ctl(c); live.forEach(ctl);
  renderFileList(); uiSave();
  return Promise.resolve(draw(c)).then(() => live[0] ? apexSpectrum(c, live[0]) : null);       // the spectrum of the highest scan of the new precursor
}

// which files exist for each time and each kind of experiment; a click opens the file in its tab
function openOverview() {
  const kinds = TABS.filter(([t]) => tabFiles(t).length);
  const key = f => f.type === "sample" ? `0|${(f.time ?? 1e9).toString().padStart(9, "0")}` : f.type === "standard" ? `1|${(f.conc ?? 1e9).toString().padStart(9, "0")}` : "2|";
  const lab = f => f.type === "sample" ? (f.time != null ? `t = ${f.time} min` : "campione") : f.type === "standard" ? `standard${f.conc != null ? " " + f.conc + " " + (f.cunit || "") : ""}` : "bianco";
  const rows = new Map();
  E.files.forEach(f => { const k = key(f) + "|" + lab(f); if (!rows.has(k)) rows.set(k, { lab: lab(f), by: {} }); (rows.get(k).by[f.kind] = rows.get(k).by[f.kind] || []).push(f); });
  const body = [...rows.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([, r]) => `<tr><td><b>${EH(r.lab)}</b></td>` + kinds.map(([t]) => `<td>${(r.by[t] || []).map(f => `<button class="fc" data-k="${f.k}" title="Apri nella scheda ${EH(TABS.find(x => x[0] === t)[1])}">${EH(f.label)}</button>`).join("") || '<span class="muted">-</span>'}</td>`).join("") + "</tr>").join("");
  big("Tempi ed esperimenti", `<div class="muted sm" style="margin-bottom:6px">Una riga per tempo (o standard, o bianco), una colonna per tipo di esperimento. Clic su un file: si apre nella sua scheda.</div><table id="ovw"><tr><th></th>${kinds.map(([, n]) => `<th>${EH(n)}</th>`).join("")}</tr>${body}</table>`, () => {
    Q("#bigbody").querySelectorAll("button.fc").forEach(b => b.onclick = () => {
      const f = E.files[+b.dataset.k]; Q("#bigdlg").close();
      setTab(f.kind, true); E.cur = f.k; E.browse = true; renderFileList(); renderNav(); redrawAll(); uiSave();
    });
  });
}
