"use strict";
// Esplorazione dei dati: si parte dal cromatogramma totale, lo studente decide cosa estrarre.
// Script classico (usa gli helper di index.html: S, setup, nice, fmt, css, esc, smooth, M, setView, applyView).
const E = { files: [], panels: [], seq: 1, key: "", cur: 0, browse: false, z: 10, fold: false, tab: "full" };
const NB = { ui: null, session: null };   // taccuino: stato dell'interfaccia (+ disegno, vedi draw.js)
// user preferences (settings gear): text size, theme, chart colours. Filled from localStorage by uipLoad() (settings.js).
const UIP = { font: 100, theme: "auto", pal: "time", merge: true };      // merge = join the centroids of the same nominal mass (centroid files only)
// areas: at least 3 decimals in the label (2.243e+6), whole number with thousands separated by a thin space in the tooltip
const fmtA = v => !Number.isFinite(v) || v === 0 ? "0" : Math.abs(v) >= 1e4 || Math.abs(v) < 0.01 ? v.toExponential(3) : (+v.toPrecision(4)).toString();
const fmtFull = v => Number.isFinite(v) ? Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009") : "";
// ---- chart colours (settings: "Colori dei grafici"). PAL = categorical colours of the current palette (filled in place by setPal, so every user of PAL follows it);
// files of the Full Scan tab that have a time get a SEQUENTIAL scale ordered by time (seqColor), see paintFiles.
const VIRIDIS = ["#440154", "#472d7b", "#3b528b", "#2c728e", "#21918c", "#28ae80", "#5ec962", "#addc30", "#fde725"];
const CIVIDIS = ["#00204d", "#00336f", "#39486b", "#575c6d", "#707173", "#8a8779", "#a69d75", "#c4b56c", "#e4cf5b", "#ffea46"];
const OKABE = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000", "#7a3b9b", "#8a8a8a"];
const PALS = {
  // viridis cut at 72% (the yellow end is almost invisible on white): dark purple (t0) to green; neighbours stay >= 8 in CIE Lab even for n = 7 and with CVD
  time: { name: "Per tempo (predefinito)", seq: VIRIDIS, a: 0, b: 0.72, cat: ["#1f77b4", "#e6550d", "#2ca02c", "#9467bd", "#d62728", "#17becf", "#bcbd22", "#e377c2", "#8c564b", "#0b6e4f", "#f2a900", "#5b5fc7"], blank: "#8a8a8a", std: "#4d4d4d" },
  // CVD-safe: cividis (varies in lightness, not in hue) + line style as a second code; Okabe-Ito for files without time
  cb: { name: "Accessibili", seq: CIVIDIS, a: 0, b: 0.75, cat: OKABE, dash: true, blank: "#8a8a8a", std: "#4d4d4d" },
  // every colour >= 4.5:1 on white (cividis dark half, dark saturated categorical), +1 px lines, line style as a second code, black text and axes
  hc: { name: "Alto contrasto", seq: CIVIDIS, a: 0, b: 0.45, cat: ["#003f9e", "#b30000", "#006b2e", "#6a1b9a", "#8a4b00", "#00727f", "#a1006b", "#000000"], dash: true, lw: 1, blank: "#6e6e6e", std: "#333333" },
  // well separated hues; on time series the hue order still follows the time
  rainbow: { name: "Arcobaleno", hue: u => `hsl(${Math.round(265 - 250 * u)} 80% 40%)`, cat: ["#d62728", "#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf", "#e377c2", "#bcbd22", "#8c564b", "#0b6e4f", "#f2a900", "#5b5fc7"], blank: "#8a8a8a", std: "#4d4d4d" },
};
const PAL = [];
function setPal(mode) {
  UIP.pal = PALS[mode] ? mode : "time";
  PAL.length = 0; PAL.push(...PALS[UIP.pal].cat);
  document.documentElement.dataset.pal = UIP.pal;
}
setPal(UIP.pal);
function seqColor(u) {                                       // u in 0..1 -> colour of the current palette's sequential scale
  const P = PALS[UIP.pal]; if (P.hue) return P.hue(u);
  const x = (P.a + (P.b - P.a) * u) * (P.seq.length - 1), i = Math.min(Math.floor(x), P.seq.length - 2), f = x - i;
  const c = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)), A = c(P.seq[i]), B = c(P.seq[i + 1]);
  return "#" + A.map((v, k) => Math.round(v + (B[k] - v) * f).toString(16).padStart(2, "0")).join("");
}
const DASHES = [[], [6, 3], [2, 3], [10, 3, 2, 3]];
const LWX = () => PALS[UIP.pal].lw || 0;                      // extra line width (px) of the high contrast palette
// line style of a file: blank dashed, Full Scan standard dash-dot (both neutral grey); with the colour-blind / high-contrast palettes the files of the
// time scale are also told apart by line style (second code besides the colour)
function fdash(f) {
  if (f.type === "blank") return [4, 3];
  if (f.kind === "full" && f.type === "standard") return [10, 4];
  return PALS[UIP.pal].dash && f.rank != null ? DASHES[f.rank % 4] : [];
}
const Q = s => document.querySelector(s);
const EH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtFormula = f => !f ? "" : EH(f).replace(/([A-Z][a-z]?|\))(\d+)/g, "$1<sub>$2</sub>");
const fmtAdduct = a => !a ? "" : fmtFormula(a).replace(/([+-]+)$/, "<sup>$1</sup>");
window.fmtFormula = fmtFormula; window.fmtAdduct = fmtAdduct;
const KIND = { full: "Full Scan", ms2: "MS\u00b2 (Product Ion)", mrm: "MRM", empty: "vuoto" };
const kindOf = f => KIND[f.kind] || f.kind;
// the three kinds of experiment never share a graph: Dati has one sub-tab for each (Full Scan, MS2, MRM); panels and files belong to one
const TABS = [["full", "Full Scan"], ["ms2", "MS\u00b2 (Product Ion)"], ["mrm", "MRM"]];
const tabFiles = (t = E.tab) => E.files.filter(f => f.kind === t && !f.gone);   // f.gone = removed from the session (the file on disk is untouched)
const tabPanels = (t = E.tab) => E.panels.filter(p => p.tab === t);
const grpOf = f => E.tab === "mrm" ? ({ standard: "Standard", sample: "Campioni", blank: "Bianchi" }[f.type] || "Campioni") : kindOf(f);
const TOL0 = 1.0;                                   // strumento datato: finestra XIC di +-1 Da

// ------------------------------------------------------------------ schermata di caricamento
// small inline icons (no external files): download arrow and "fit to window" corners
const IC_DL = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M6 1v7M3 5.5 6 8.5 9 5.5M1.5 11h9"/></svg>';
const IC_AUTO = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M1 14h14"/><path d="M3 14C5 14 6 4.5 8 4.5S11 14 13 14z" fill="currentColor" fill-opacity=".3"/><path d="M13 1.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none"/></svg>';   // peak with its area + sparkle = automatic
const IC_MAN = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M1 14h14"/><path d="M4.5 14C6 14 6.5 5 8 5s2 9 3.5 9" /><path d="M4 2.5v11.5M12 2.5v11.5" stroke-dasharray="2 1.6"/></svg>';   // peak between two edge bars = manual
const IC_ZOOM = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4.6"/><path d="M10 10l4.6 4.6M4.4 6.5h4.2M6.5 4.4v4.2"/></svg>';   // magnifier = zoom tool
const IC_TAB = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2" width="11" height="10" rx="1.2"/><path d="M1.5 5.5h11M1.5 8.7h11M6 5.5V12"/></svg>';
const IC_FS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M8.5 1.5h4v4M12.5 1.5 8 6M5.5 12.5h-4v-4M1.5 12.5 6 8"/></svg>';   // full screen: arrows pointing out
const IC_FSX = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 5.5H8.5V2M8.5 5.5 13 1M2 8.5h3.5V12M5.5 8.5 1 13"/></svg>';  // leave full screen: arrows pointing in
const IC_FIT = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>';
const IC_LOCK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2.5" y="6.2" width="9" height="6.3" rx="1.2"/><path d="M4.5 6.2V4.3a2.5 2.5 0 0 1 5 0v1.9"/></svg>';
const IC_UNLOCK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2.5" y="6.2" width="9" height="6.3" rx="1.2"/><path d="M4.5 6.2V4.3a2.5 2.5 0 0 1 4.8-1"/></svg>';
const PHRASES = [
  "Ignorando i warning", "Schivando gli ftalati", "Minando crypto di nascosto", "Litigando coi file", "Allineando i quadrupoli",
  "Compilando preghiere", "Aggiornando Matrix", "Cercando il segnale perduto", "Riavviando l'universo", "Ansia da separazione",
  "Contaminando la sorgente", "Accecando l'elettromoltiplicatore", "Maledicendo la matrice", "Cuocendo sui quadrupoli"];
// loading screen: one phrase every 5 s, in random order without repeats; the three dots appear one after the other
let ldTimer = null, ldDotTimer = null, ldSince = 0, ldBag = [], ldLast = -1;
function ldNext() {
  if (window.qqFailed) return;                                    // a failed start keeps its error message on screen
  if (!ldBag.length) {                                            // refill with a fresh shuffle, never starting with the phrase just shown
    ldBag = PHRASES.map((_, i) => i).sort(() => Math.random() - 0.5);
    if (ldBag[ldBag.length - 1] === ldLast) ldBag.unshift(ldBag.pop());
  }
  ldLast = ldBag.pop();
  const el = Q("#ldmsg"); el.textContent = PHRASES[ldLast];
  const dots = document.createElement("span");
  for (let i = 0; i < 3; i++) { const d = document.createElement("span"); d.textContent = "."; dots.appendChild(d); }   // the phrase appears at once with its three dots (a fast load must still show them)
  el.appendChild(dots);
  let n = 3; clearInterval(ldDotTimer);
  ldDotTimer = setInterval(() => { n = (n + 1) % 4; [...dots.children].forEach((d, i) => { d.style.visibility = i < n ? "visible" : "hidden"; }); }, 450);
}
let ldSlow = 0;
function loading(on, msg) {
  const L = Q("#loading");
  if (on) {
    ldSince = Date.now(); Q("#ldsub").textContent = msg || "";
    clearTimeout(ldSlow); ldSlow = setTimeout(() => { if (!window.qqFailed && !Q("#loading").hidden && !Q("#ldsub").textContent) Q("#ldsub").textContent = "La prima apertura scarica circa 15 MB: può volerci un minuto."; }, 20000);
    clearInterval(ldTimer); ldNext(); ldTimer = setInterval(ldNext, 5000); L.hidden = false;
  } else {
    const wait = Math.max(0, 900 - (Date.now() - ldSince));
    clearTimeout(ldSlow); setTimeout(() => { L.hidden = true; clearInterval(ldTimer); clearInterval(ldDotTimer); }, wait);
  }
}

// ------------------------------------------------------------------ taccuino (salvato accanto ai dati)
let nbTimer = null, nbLast = "";
function nbSave(now = false) {
  clearTimeout(nbTimer);
  const go = () => {
    const body = JSON.stringify(NB); if (body === nbLast) return;      // nothing changed: no request (fewer aborted saves on reload)
    nbLast = body; fetch("api/notebook", { method: "POST", body, keepalive: true }).catch(() => { nbLast = ""; });
  };
  if (now) go(); else nbTimer = setTimeout(go, 500);
}
let nbEverLoaded = false;
async function nbLoad() {
  try { Object.assign(NB, await (await fetch("api/notebook")).json()); } catch (_) { /* prima volta */ }
  nbEverLoaded = true;
  document.dispatchEvent(new Event("nbloaded"));
}
// the Disegno tab can be opened before any data file is loaded: the notebook (with the drawing) must be read first, otherwise the first save
// would overwrite the saved drawing with an empty one
window.nbEnsure = async () => { if (!nbEverLoaded) await nbLoad(); };
let uiTimer = null;
function uiSave(now = false) {
  clearTimeout(uiTimer);
  const run = () => {
    if (!E.files.length) return;
    NB.session = E.files.filter(f => !f.gone).map(f => ({ file: f.file, label: f.label, time: f.time, type: f.type, conc: f.conc ?? null, cunit: f.cunit ?? null }));
    NB.ui = {
      tab: E.tab, cur: E.cur, browse: E._forced ? E._prev : E.browse, fold: E.fold, files: E.files.map(f => ({ file: f.file, label: f.label, vis: f.vis, color: f.colorSet ? f.color : undefined, gone: f.gone || undefined })),
      panels: E.panels.map(p => ({
        type: p.type, tab: p.tab, title: p.title, x: p.x, y: p.y, w: p.w, h: p.h, full: !!p.full, kind: p.kind, smooth: p.smooth, tol: p.tol,
        traces: (p.traces || []).map(t => ({ mz: t.mz, w: t.w, label: t.label })),
        k: E.files[p.k]?.file ?? null, r0: p.r0, r1: p.r1, level: p.level, prec: p.prec, all: p.all, zoom: p.zoom, anns: p.anns, ints: p.ints, tr: p.tr,
        link: p.link ? E.panels.findIndex(q => q.id === p.link) : -1, src: p.src ? E.panels.findIndex(q => q.id === p.src) : -1, imode: p.imode || null, intf: p.intf || "",
        lock: p.type === "spec" ? !!p.lock : undefined, rel: p.type === "spec" && typeof p.rel === "boolean" ? p.rel : undefined, sticks: p.type === "spec" && p.sticks ? true : undefined, thr: p.type === "spec" ? p.thr : undefined, nlab: p.type === "spec" ? p.nlab : undefined, dec: p.type === "spec" ? p.dec : undefined, meas: p.type === "spec" && p.meas ? p.meas : undefined, tl: p.tl || undefined, ms2tri: p.ms2tri || undefined, iso: p.iso || null, ibk: p.ibk || null, mz0: p.mz0 ?? null, mz1: p.mz1 ?? null, mode: p.mode, log: p.log, hid: p.hid, bk: p.bk === "" || p.bk == null ? "" : E.files[+p.bk]?.file ?? "", snip: p.snip, snipw: p.snipw, adduct: p.adduct, bg: p.bg === "" || p.bg == null ? "" : p.bg === "w" ? "w" : E.files[+p.bg]?.file ?? "", bw0: p.bw0, bw1: p.bw1, scale: p.scale, view: p.view, norm: p.norm, az: p.az, elv: p.elv, zoomY: p.zoomY, ref: p.ref === "" || p.ref == null ? "" : E.files[+p.ref]?.file ?? ""
      }))
    };
    nbSave(now);
  };
  if (now) run(); else uiTimer = setTimeout(run, 800);
}
// alla chiusura della pagina (o quando la scheda va in secondo piano) si salva subito: l'ultima modifica non va persa
addEventListener("pagehide", () => uiSave(true));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") uiSave(true); });

// ------------------------------------------------------------------ dati (con cache)
const CACHE = new Map();
const memo = (key, fn) => { if (!CACHE.has(key)) CACHE.set(key, fn().catch(e => { CACHE.delete(key); throw e; })); return CACHE.get(key); };
const J = u => fetch(u).then(async r => { const j = await r.json(); if (j.error) throw new Error(j.error); return j; });
const getChrom = (k, kind, lv, mz0, mz1, prec) => memo(`c${k}|${kind}|${lv}|${mz0 ?? ""}|${mz1 ?? ""}|${prec ?? ""}`, () => J(`api/chrom?k=${k}&kind=${kind}&level=${lv}` + (mz0 != null ? `&mz0=${mz0}` : "") + (mz1 != null ? `&mz1=${mz1}` : "") + (prec ? `&prec=${prec}` : "")));
const getXic = (k, mz, tol, lv) => memo(`x${k}|${mz}|${tol}|${lv}`, () => J(`api/xic?k=${k}&mz=${mz}&tol=${tol}&level=${lv}`).then(j => j.traces[0]));
const MERGE = () => UIP.merge ? "&merge=1" : "";
const getSpec = (k, a, b, lv, pr, bg) => memo(`s${k}|${a}|${b}|${lv}|${pr}|${bg ? bg.join(",") : ""}|${UIP.merge ? 1 : 0}`, () => J(`api/spectrum?k=${k}&rt0=${a}&rt1=${b}&level=${lv}&precursor=${pr ?? ""}` + (bg ? `&bgk=${bg[0]}&bgrt0=${bg[1]}&bgrt1=${bg[2]}` : "") + MERGE()));
const getFormula = (f, ad) => J(`api/formula?f=${encodeURIComponent(f)}&adduct=${encodeURIComponent(ad || "")}`);
// default adduct from the polarity of the visible files
// polarity of the files (read from the mzML): a small sign next to the name, the default adduct of a graph follows ITS files
const POLS = { positive: ["+", "ESI positivo"], negative: ["−", "ESI negativo"], mixed: ["±", "ESI positivo e negativo nello stesso file"], unknown: ["?", "polarità non indicata nel file"] };
const polSign = f => { const q = POLS[f && f.polarity] || POLS.unknown; return `<span class="pol" title="${q[1]}">${q[0]}</span>`; };
const polMixed = () => new Set(shown().map(f => f.polarity).filter(x => x && x !== "unknown")).size > 1;
const legPol = f => polMixed() && f ? " " + polSign(f) : "";                      // the legend shows the sign only when positive and negative files are drawn together
const defAdduct = fs => { const l = fs || (shown().length ? shown() : E.files.filter(f => f.vis)); return l.some(f => f.polarity === "negative") && !l.some(f => f.polarity === "positive") ? "[M-H]-" : "[M+H]+"; };
const getMrm = k => memo(`m${k}`, () => J(`api/mrm?k=${k}`).then(j => j.files[0].transitions));

async function bootSession() {
  const j = await J("api/session");
  S.sess = j.session;
  if (!j.session) { E.files = []; E.key = ""; return; }
  const key = JSON.stringify(j.session.map(s => s.file));
  if (key === E.key) return;
  const oldNames = E.files.map(f => f.file), oldVis = Object.fromEntries(E.files.map(f => [f.file, f]));
  E.key = key;
  CACHE.clear(); if (typeof SC !== "undefined") { SC.m.clear(); SC.n.clear(); }
  E.files = j.session.map((s, k) => ({ ...s, k, vis: oldVis[s.file] ? oldVis[s.file].vis : true, label: oldVis[s.file] ? oldVis[s.file].label : s.label, lv: s.kind === "ms2" ? 2 : 1 }));
  paintFiles();
  const idx = n => { const i = E.files.findIndex(f => f.file === n); return i < 0 ? 0 : i; };
  if (E.panels.length && oldNames.length) {                // caricamento successivo: i pannelli restano
    E.panels.forEach(p => { if (p.k != null) p.k = idx(oldNames[p.k]); if (p.ref !== "" && p.ref != null) p.ref = idx(oldNames[+p.ref]); });
    E.cur = Math.min(E.cur, E.files.length - 1);
    renderFileList(); toolbar(); E.panels.forEach(ctl); redrawAll();
    const added = E.files.filter(f => !oldNames.includes(f.file)); if (added.length && window.setTab && added[0].kind !== E.tab) setTab(added[0].kind); else if (added.length) { ensureLayout(); }
    return;
  }
  renderFileList();
  E.panels = []; Q("#dpanels").innerHTML = "";
  await nbLoad();
  if (!restoreUi()) E.tab = pickTab(E.tab);
  ensureLayout(); toolbar(); uiSave();
}
// the spectrum starts at the retention time with the highest intensity (of all the visible full-scan/MS2 files)
async function apexSpectrum(c, sp) {
  try {
    const all = (await rawSeries(c)).filter(s => E.files[s.k] && E.files[s.k].kind !== "mrm");
    let best = null;
    for (const s of all) for (let i = 0; i < s.y.length; i++) if (!best || s.y[i] > best.v) best = { v: s.y[i], rt: s.x[i], k: s.k };
    if (!best) return;
    const f = E.files[best.k], dt = Math.max((f.rt_max - f.rt_min) / Math.max(f.ms1 + f.ms2 - 1, 1), 0.005);
    c.cur = best.rt; Object.assign(sp, { k: best.k, level: f.lv, r0: best.rt - dt / 2, r1: best.rt + dt / 2, zoom: null });
    ctl(sp); draw(c); draw(sp); uiSave();
  } catch (_) { /* the spectrum simply waits for a click */ }
}
// width available for the panels (the panel area may still be hidden while the files are being opened)
function hostWidth() {
  const w = Q("#dpanels").clientWidth;
  return w > 100 ? w : Math.max(600, innerWidth - 28 - (E.fold ? 0 : 240));
}
// full-width panels follow the page: when the window or the file list changes size
function fitWidth() {
  const w = Q("#dpanels").clientWidth; if (w < 100) return;
  E.panels.forEach(p => { if (p.full && Math.abs(p.w - w) > 1) { p.x = 0; p.w = w; apply(p); } });
}
function setFold(on) {
  E.fold = on; Q("#v-data").classList.toggle("fold", on); Q("#funfold").hidden = !on;
  requestAnimationFrame(() => { fitWidth(); redrawAll(); });
}
Q("#ffold").onclick = () => { setFold(true); uiSave(); };
Q("#funfold").onclick = () => { setFold(false); uiSave(); };
function restoreUi() {
  const u = NB.ui;
  if (!u || !u.panels || !u.panels.length) return false;
  const names = new Set(E.files.map(f => f.file));
  if (!u.files.every(f => names.has(f.file))) return false;
  u.files.forEach(sf => { const f = E.files.find(x => x.file === sf.file); f.label = sf.label || f.label; f.vis = sf.vis !== false; if (sf.color) { f.color = sf.color; f.colorSet = true; } if (sf.gone) { f.gone = true; f.vis = false; } });
  E.cur = Math.min(u.cur || 0, E.files.length - 1); E.browse = !!u.browse; setFold(!!u.fold); E.tab = pickTab(u.tab);
  const kof = n => { const i = E.files.findIndex(f => f.file === n); return i < 0 ? 0 : i; };
  const made = u.panels.map(sp => addPanel(sp.type, {
    ...sp, tab: sp.tab || (sp.type === "mrm" ? "mrm" : E.files[kof(sp.k)]?.kind === "ms2" ? "ms2" : "full"), k: sp.k ? kof(sp.k) : undefined, ref: sp.ref ? kof(sp.ref) : "", bk: sp.bk ? kof(sp.bk) : "", bg: sp.bg === "w" ? "w" : sp.bg ? kof(sp.bg) : "", traces: (sp.traces || []).map(t => ({ id: E.seq++, ...t })), link: null, ints: sp.ints || [], anns: sp.anns || []
  }));
  u.panels.forEach((sp, i) => { if (sp.link >= 0 && made[sp.link]) made[i].link = made[sp.link].id; if (sp.src >= 0 && made[sp.src]) made[i].src = made[sp.src].id; });
  made.forEach(q => { if (q.type === "spec" && q.link) ctl(q); });     // one live spectrum per chromatogram, even in an old notebook
  if (E.files[E.cur]?.kind !== E.tab) E.cur = (tabFiles()[0] || { k: 0 }).k;
  renderFileList(); return true;
}

// File colours. Full Scan files of type sample WITH a time: one sequential scale ordered by time, spread over the n files of the tab (rank, not the real
// time, so 7 files at 0-5-10-15-30-45-60 min are as far apart as 3 files; hiding a file does not change any colour, removing one does). Blank and
// Full Scan standards are outside the scale (neutral grey, dashed); Full Scan samples without a time use the categorical colours. MS2 and MRM files keep
// the categorical colours (MRM: transition, not time). A colour chosen by the student (colorSet) is never overwritten.
const STD_SEQ = ["#fdae6b", "#e6550d", "#a63603", "#5a1d02"];     // one orange hue, light (low concentration) to dark (high): MRM standards never look like the time scale of the samples
function stdColor(u) {                                       // u in 0..1; the high-contrast palette keeps to the dark half (>= 4.5:1 on white)
  const P = PALS[UIP.pal], x = (P.hc ? 0.45 + 0.55 * u : u) * (STD_SEQ.length - 1), i = Math.min(Math.floor(x), STD_SEQ.length - 2), f = x - i;
  const c = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)), A = c(STD_SEQ[i]), B = c(STD_SEQ[i + 1]);
  return "#" + A.map((v, k) => Math.round(v + (B[k] - v) * f).toString(16).padStart(2, "0")).join("");
}
function paintFiles() {
  const P = PALS[UIP.pal], byTime = kind => E.files.filter(f => !f.gone && f.kind === kind && f.type === "sample" && f.time != null).sort((a, b) => a.time - b.time || a.k - b.k);
  const scales = [byTime("full"), byTime("mrm")], inScale = new Set(scales.flat());
  E.files.forEach(f => { f.rank = null; });
  scales.forEach(scale => scale.forEach((f, i) => { f.rank = i; if (!f.colorSet) f.color = seqColor(scale.length > 1 ? i / (scale.length - 1) : 0.5); }));
  const cal = E.files.filter(f => !f.gone && f.kind === "mrm" && f.type === "standard" && f.conc != null).sort((a, b) => a.conc - b.conc || a.k - b.k), inCal = new Set(cal);
  cal.forEach((f, i) => { if (!f.colorSet) f.color = stdColor(cal.length > 1 ? i / (cal.length - 1) : 0.6); });
  let n = 0;
  E.files.forEach(f => {
    if (inScale.has(f) || inCal.has(f)) return;
    const own = f.colorSet;
    if (f.type === "blank") { if (!own) f.color = P.blank; }
    else if (f.type === "standard") { if (f.kind === "full") { if (!own) f.color = P.std; } else if (!own) f.color = PAL[(n++ + 3) % PAL.length]; }
    else if (!own) f.color = PAL[n++ % PAL.length]; else n++;
  });
}
// back to the automatic colours of the current palette (the student's own colours are dropped)
function resetColors() { E.files.forEach(f => { f.colorSet = false; }); paintFiles(); renderFileList(); redrawAll(); uiSave(); }
const modeIcon = () => "";       // the little icons of the three experiments are gone from the tabs and the file list (7 Oct 2026, Federico): they stay only in Teoria, where they are big enough to read
// go to the tab of a file that is not usable in the current one, with a one-line message
function goToFileTab(f) {
  setTab(f.kind); E.cur = f.k; renderFileList(); renderNav(); redrawAll(); uiSave();
  const n = Q("#fnote"); if (n) { n.textContent = `«${f.label}» è un file ${kindOf(f)}: ho aperto la scheda ${TABS.find(x => x[0] === f.kind)[1]}.`; clearTimeout(n._t); n._t = setTimeout(() => { n.textContent = ""; }, 7000); }
}
function renderFileList() {
  // files grouped by experiment type (Full scan, MS2, MRM...): the type is written once per group, not per file. ALL the files are listed:
  // those of the other tabs are greyed and a click takes you to their tab
  const groups = [];
  tabFiles().forEach(f => { const g = grpOf(f); let G = groups.find(x => x.g === g); if (!G) groups.push(G = { g, fs: [] }); G.fs.push(f); });
  if (E.tab === "mrm") groups.sort((a, b) => ["Standard", "Campioni", "Bianchi"].indexOf(a.g) - ["Standard", "Campioni", "Bianchi"].indexOf(b.g));
  const sub = f => f.type === "sample" ? (f.time != null ? f.time + " min" : "") : (f.type === "blank" ? "bianco" : "standard" + (f.conc != null && f.kind === "mrm" ? " " + f.conc + " " + (f.cunit || "") : ""));
  const row = f => `<div class="fl ${f.k === E.cur ? "cur" : ""}"><input type="checkbox" data-k="${f.k}" ${f.vis ? "checked" : ""} title="Mostra o nascondi">
    <i style="background:${f.color}"></i><div class="fi"><b class="nm" data-k="${f.k}" title="Clic sulla riga per scegliere il file corrente, doppio clic sul nome per rinominare">${EH(f.label)}</b>${polSign(f)}
    <small>${sub(f)}</small>
</div></div>`;
  const ghost = f => `<div class="fl ghost" data-go="${f.k}" title="Questo file è ${EH(kindOf(f))}: non si usa in questa scheda. Clic per aprire la scheda ${EH(TABS.find(x => x[0] === f.kind)[1])}."><input type="checkbox" disabled><i style="background:${f.color}"></i><div class="fi"><b class="nm">${EH(f.label)}</b><small>${sub(f)}</small></div></div>`;
  const pre = E.tab === "ms2" && window.ms2Exps && ms2Exps().length ? `<div class="fgh"><span>Precursori</span><em>${ms2Exps().length}</em></div>` + ms2Exps().map(x => `<div class="fl pr"><input type="checkbox" data-pr="${x.prec}" ${ms2PairOf(x.prec) ? "checked" : ""} title="Aggiunge (o chiude) una seconda coppia di grafici per confrontare questo precursore con quello mostrato"><div class="fi"><b class="pn" data-pg="${x.prec}" title="Clic: i grafici passano a questo precursore. Presente in ${x.files.size} file">${x.prec != null ? "<span style=\"font-style:italic\">m/z</span> " + EH(x.prec) : "?"}</b><small>${x.ce.size ? "CE " + [...x.ce].join(", ") + " V · " : ""}${x.n} scan</small></div></div>`).join("") : "";
  const others = TABS.filter(([t]) => t !== E.tab && tabFiles(t).length).map(([t, n]) => `<div class="fgh sep">${modeIcon(t, 18)}<span>${EH(n)}</span><em>${tabFiles(t).length}</em></div>` + tabFiles(t).map(ghost).join("")).join("");
  const gh = (G, label, cls = "") => `<div class="fgh ${cls}"><input type="checkbox" class="gall" data-g="${EH(G.g)}" ${G.fs.every(f => f.vis) ? "checked" : ""} title="Mostra o nascondi tutto il gruppo">${cls ? "" : modeIcon(E.tab, 18)}<span>${EH(label)}</span><em>${G.fs.length}</em></div>`;
  // MRM tab: like the other tabs the header is the type of experiment («MRM»); standard / campioni / bianchi are smaller sub-groups, written only when there is more than one
  const body = E.tab === "mrm" && groups.length
    ? gh({ g: "__all", fs: tabFiles() }, "MRM") + groups.map(G => (groups.length > 1 ? gh(G, G.g.toLowerCase(), "sub") : "") + G.fs.map(row).join("")).join("")
    : groups.map(G => gh(G, G.g) + G.fs.map(row).join("")).join("");
  Q("#flst").innerHTML = pre + body + others;
  Q("#flst").querySelectorAll("input[data-pr]").forEach(x => x.onchange = () => ms2Toggle(x.dataset.pr, x.checked));
  Q("#flst").querySelectorAll("[data-pg]").forEach(x => x.onclick = () => ms2Goto(x.dataset.pg));
  Q("#flst").querySelectorAll("[data-go]").forEach(x => x.onclick = () => goToFileTab(E.files[+x.dataset.go]));
  Q("#flst").querySelectorAll(".gall").forEach(x => x.onchange = () => { tabFiles().filter(f => x.dataset.g === "__all" || grpOf(f) === x.dataset.g).forEach(f => f.vis = x.checked); renderFileList(); redrawAll(); uiSave(); });
  Q("#flst").querySelectorAll("input[data-k]").forEach(x => x.onchange = () => { E.files[+x.dataset.k].vis = x.checked; redrawAll(); uiSave(); });
  Q("#flst").querySelectorAll(".fl:not(.ghost)").forEach(el => { const nm = el.querySelector(".nm"); if (nm) el.oncontextmenu = e => fileCtx(e, E.files[+nm.dataset.k]); });
  // the WHOLE row selects the file (colour square, time, empty space); only the check box shows / hides. The list is not rebuilt on a click (only the classes change), so a double click on the name still reaches it.
  Q("#flst").querySelectorAll(".fl:not(.ghost):not(.pr)").forEach(row => {
    const nm = row.querySelector(".nm"); if (!nm) return;
    row.onclick = e => {
      if (e.target.closest("input")) return;
      E.cur = +nm.dataset.k; Q("#flst").querySelectorAll(".fl").forEach(r => r.classList.toggle("cur", r === row)); renderNav(); if (E.browse) redrawAll();
    };
    nm.ondblclick = () => renameFile(E.files[+nm.dataset.k]);
  });
  renderNav();
}
// right click on a file of the list: rename (only a label, the file on disk is not touched), colour, remove from the session
const FILE_COLORS = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000", "#7a3b9b", "#8a8a8a"];   // Okabe-Ito + 2: distinguishable with colour-blindness
async function renameFile(f) { const v = await ask("Nome del campione <span class='muted sm'>(è solo un'etichetta: il file sul disco non cambia)</span>", f.label); if (v) { f.label = v; renderFileList(); renderNav(); redrawAll(); uiSave(); } }
function colorFile(f, ev) {
  Q("#colpop")?.remove();
  const d = document.createElement("div"); d.id = "colpop";
  d.innerHTML = `<div class="sm" style="margin-bottom:4px">Colore di ${EH(f.label)}</div><div class="sw">${FILE_COLORS.map(c => `<button data-c="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div><label class="sm">Personalizzato <input type="color" value="${/^#[0-9a-f]{6}$/i.test(f.color) ? f.color : "#1f77b4"}"></label>`;
  const set = c => { f.color = c; f.colorSet = true; d.remove(); renderFileList(); redrawAll(); uiSave(); };
  d.querySelectorAll("[data-c]").forEach(b => b.onclick = () => set(b.dataset.c));
  d.querySelector("input").onchange = e => set(e.target.value);
  document.body.appendChild(d); d.style.left = Math.min(ev.clientX, innerWidth - 200) + "px"; d.style.top = Math.min(ev.clientY, innerHeight - 150) + "px";
  setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!d.contains(e.target)) { d.remove(); document.removeEventListener("mousedown", h); } }), 0);
}
async function removeFile(f) {
  if (!await yesno(`Togliere <b>${EH(f.label)}</b> dalla sessione? Il file sul tuo computer non viene toccato; per riaverlo devi caricarlo di nuovo.`)) return;
  f.gone = true; f.vis = false; paintFiles();
  E.panels.filter(q => q.k === f.k && q.type !== "xic").forEach(q => { const o = tabFiles(q.tab).find(x => x.k !== f.k); if (o) q.k = o.k; });
  if (E.cur === f.k) E.cur = (tabFiles()[0] || { k: 0 }).k;
  renderTabs(); renderFileList(); renderNav(); toolbar(); E.panels.forEach(ctl); redrawAll(); uiSave();
}
function fileCtx(e, f) {
  if (!f) return; e.stopPropagation();
  menu(e, [{ label: "Rinomina…", fn: () => renameFile(f) }, { label: "Cambia colore…", fn: () => colorFile(f, e) }, { label: "Ripristina i colori automatici (per tempo)", fn: resetColors }, "-", { label: "Rimuovi dalla sessione…", fn: () => removeFile(f) }]);
}
// quick file chooser opened from a graph header: tick/untick files (same switch as the list on the left), click a name to show only that file
function fileMenu(btn) {
  Q("#fpop")?.remove();
  const d = document.createElement("div"); d.id = "fpop";
  const paint = () => {
    const gs = []; tabFiles().forEach(f => { const g = grpOf(f); let G = gs.find(x => x.g === g); if (!G) gs.push(G = { g, fs: [] }); G.fs.push(f); });
    d.innerHTML = `<div class="fpb"><button data-all="1">Tutti</button><button data-all="0">Nessuno</button></div>` + gs.map(G => `<div class="fgh"><span>${EH(G.g)}</span></div>` + G.fs.map(f => `<label><input type="checkbox" data-k="${f.k}" ${f.vis ? "checked" : ""}><i style="background:${f.color}"></i><span class="fn" data-k="${f.k}" title="Clic: mostra solo questo file">${EH(f.label)}</span></label>`).join("")).join("");
    const done = () => { renderFileList(); redrawAll(); uiSave(); };
    d.querySelectorAll("[data-all]").forEach(b => b.onclick = () => { tabFiles().forEach(f => f.vis = b.dataset.all === "1"); paint(); done(); });
    d.querySelectorAll("input").forEach(i => i.onchange = () => { E.files[+i.dataset.k].vis = i.checked; done(); });
    d.querySelectorAll(".fn").forEach(n => n.onclick = e => { e.preventDefault(); tabFiles().forEach(f => f.vis = f.k === +n.dataset.k); paint(); done(); });
  };
  paint(); document.body.appendChild(d);
  const r = btn.getBoundingClientRect(); d.style.left = Math.min(r.left, innerWidth - 240) + "px"; d.style.top = r.bottom + 4 + "px";
  setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!d.contains(e.target)) { d.remove(); document.removeEventListener("mousedown", h); } }), 0);
}
const vis = () => tabFiles().filter(f => f.vis);
// "Solo il selezionato": every graph follows the file chosen in the toolbar, so the controls that choose a file inside a graph are switched off
const follow = tab => !!(E.browse && E.files[E.cur] && E.files[E.cur].kind === tab);
const shown = () => E.browse && E.files[E.cur] && E.files[E.cur].kind === E.tab ? [E.files[E.cur]] : vis();
const scanFiles = l => l.filter(f => f.kind !== "mrm");

// ------------------------------------------------------------------ barra: frecce tra i file, metodo, esporta
function renderNav() {
  const s = Q("#fsel"); if (!s) return;
  s.innerHTML = tabFiles().map(f => `<option value="${f.k}" ${f.k === E.cur ? "selected" : ""}>${EH(f.label)}</option>`).join("");
  const tf = tabFiles(), one = tf.length <= 1, why = "Serve più di un file in questa scheda: ne hai caricato uno solo.";   // with a single file nothing here has a meaning
  // a single file: "Solo il selezionato" is on and "Tutti sovrapposti" is off; with two or more files the choice the student had made comes back
  if (one && tf.length) { if (!E._forced) { E._forced = true; E._prev = !!E.browse; } E.browse = true; E.cur = tf[0].k; }
  else if (E._forced) { E._forced = false; E.browse = !!E._prev; }
  Q("#fmode").querySelectorAll("button").forEach(b => b.classList.toggle("on", (b.dataset.m === "sel") === !!E.browse));
  const nowhy = "Si usa con «Solo il selezionato»: con «Tutti sovrapposti» i grafici mostrano tutti i file spuntati.";
  [Q("#fprev"), Q("#fnext"), Q("#fsel"), ...Q("#fmode").querySelectorAll("button")].forEach(b => { if (b.dataset.t0 == null) b.dataset.t0 = b.title; const nav = !b.closest("#fmode"), all = b.dataset.m === "all"; b.disabled = nav ? one || !E.browse : one && all; b.title = one ? (all ? "C'è un solo file" : nav ? why : b.dataset.t0) : nav && !E.browse ? nowhy : b.dataset.t0; });
  const sig = [E.browse, E.cur, tabFiles().length, E.tab].join("|"); if (renderNav._sig !== sig) { renderNav._sig = sig; E.panels.forEach(q => q.el && ctl(q)); }      // the graphs' own file choosers depend on the mode
  Q("#fmode").classList.toggle("dis", one);
}
function goFile(d) {
  const tf = tabFiles(); if (tf.length < 2 || !E.browse) return;
  E.cur = tf[(Math.max(0, tf.findIndex(f => f.k === E.cur)) + d + tf.length) % tf.length].k; renderNav();
  renderFileList(); redrawAll(); uiSave();
}
Q("#fprev").onclick = () => goFile(-1); Q("#fnext").onclick = () => goFile(1);
Q("#fsel").onchange = e => { E.cur = +e.target.value; renderFileList(); renderNav(); if (E.browse) redrawAll(); uiSave(); };
Q("#fmode").querySelectorAll("button").forEach(b => b.onclick = () => { E.browse = b.dataset.m === "sel"; renderNav(); redrawAll(); uiSave(); });
// ← → (scan by scan or file by file), Maiusc + ← →, Spazio and Esc: see scroll.js (scrollKeys)
document.addEventListener("mousedown", e => { if (E.active && e.target.closest("#dpanels") && !e.target.closest(".pnl")) setActive(null); });
function toolbar() {
  if (window.renderTabs) renderTabs();
  const t = E.tab, empty = !tabFiles().length, scan = t !== "mrm", mrm = t === "mrm";
  Q("#np-chrom").hidden = !scan; Q("#np-spec").hidden = !scan; Q("#np-map").hidden = t !== "full"; Q("#np-xic").hidden = !scan; Q("#np-merge").hidden = !scan;
  Q("#np-mrm").hidden = !mrm; 
  Q("#g-add").hidden = empty; Q("#g-tools").hidden = empty; Q("#g-file").hidden = empty; Q("#dpanels").hidden = empty; Q("#tools .sp").hidden = empty; Q("#np-method").hidden = empty;
  if (window.emptyTab) emptyTab();
  fitTools(); requestAnimationFrame(fitTools); setTimeout(fitTools, 400);
}
// the least used buttons go into "Altro" only when the row would wrap
function fitTools() {
  const bar = Q("#tools"), more = Q("#np-more"); if (!bar || !more || !bar.offsetParent) return;
  const cand = ["np-tile", "np-merge"].map(id => Q("#" + id));
  cand.forEach(b => { b._mv = false; b.classList.remove("ov"); }); more.hidden = true;
  const vis = () => [...bar.children].filter(c => c.offsetParent && c.id !== "np-more" || (c.id === "np-more" && !c.hidden));
  const wrapped = () => { const ks = vis(); const t0 = ks[0] ? ks[0].offsetTop : 0; return ks.some(c => c.offsetTop > t0 + 8); };
  for (const b of cand) { if (!wrapped()) break; if (b.hidden) continue; b._mv = true; b.classList.add("ov"); more.hidden = false; }
  more._items = cand.filter(b => b._mv);
}
Q("#np-more").onclick = e => {
  e.stopPropagation(); Q("#morepop")?.remove();
  const d = document.createElement("div"); d.id = "morepop";
  (Q("#np-more")._items || []).forEach(b => { const c = document.createElement("button"); c.textContent = b.textContent; c.title = b.title; c.onclick = () => { d.remove(); b.click(); }; d.appendChild(c); });
  document.body.appendChild(d); const r = Q("#np-more").getBoundingClientRect(); d.style.left = Math.min(r.left, innerWidth - 200) + "px"; d.style.top = r.bottom + 4 + "px";
  setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!d.contains(ev.target)) { d.remove(); document.removeEventListener("mousedown", h); } }), 0);
};
addEventListener("resize", () => fitTools());

// ------------------------------------------------------------------ piccole finestre e menu
function ask(title, def = "") {
  return new Promise(res => {
    const d = Q("#askdlg"), i = Q("#askin");
    i.hidden = false; Q("#askno").hidden = false;
    Q("#asktxt").innerHTML = title; i.value = def;
    const done = v => { d.close(); Q("#askok").onclick = Q("#askno").onclick = i.onkeydown = null; res(v); };
    Q("#askok").onclick = () => done(i.value.trim() || null);
    Q("#askno").onclick = () => done(null);
    i.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); done(i.value.trim() || null); } };
    d.oncancel = () => done(null);
    d.showModal(); i.focus(); i.select();
  });
}
function yesno(html) {
  return new Promise(res => {
    const d = Q("#askdlg"); Q("#asktxt").innerHTML = html; Q("#askin").hidden = true; Q("#askno").hidden = false;
    const done = v => { d.close(); Q("#askin").hidden = false; Q("#askok").onclick = Q("#askno").onclick = null; res(v); };
    Q("#askok").onclick = () => done(true); Q("#askno").onclick = () => done(false); d.oncancel = () => done(false); d.showModal();
  });
}
function info(html) {
  const d = Q("#askdlg");
  Q("#asktxt").innerHTML = html; Q("#askin").hidden = true; Q("#askno").hidden = true;
  Q("#askok").onclick = () => { d.close(); Q("#askin").hidden = false; Q("#askno").hidden = false; };
  d.showModal();
}
function big(title, html, onopen) {
  Q("#bigtt").textContent = title; Q("#bigbody").innerHTML = html;
  const d = Q("#bigdlg"); Q("#bigx").onclick = () => d.close(); d.showModal(); if (onopen) onopen();
}
function menu(ev, items) {
  ev.preventDefault();
  const m = Q("#ctx");
  m.innerHTML = "";
  items.forEach(it => {
    if (it === "-") { m.appendChild(document.createElement("hr")); return; }
    const d = document.createElement("div");
    d.textContent = it.label; if (it.tip) d.title = it.tip;
    if (it.dim) d.className = "dim"; else d.onclick = () => { m.hidden = true; it.fn(); };
    m.appendChild(d);
  });
  m.hidden = false;
  m.style.left = Math.min(ev.clientX, innerWidth - 270) + "px";
  m.style.top = Math.max(4, Math.min(ev.clientY, innerHeight - m.offsetHeight - 8)) + "px";
}
document.addEventListener("click", () => { Q("#ctx").hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") Q("#ctx").hidden = true; });
function dl(name, text, type = "application/octet-stream") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const INT_COLS = ["panel", "ion", "file", "time", "conc", "cunit", "a", "b", "rt", "area", "height", "ibk"];
const INT_HEADS = ["Pannello", "Traccia", "Campione", "Tempo di trattamento (min)", "Concentrazione (standard)", "Unità", "RT inizio (min)", "RT fine (min)", "RT apice (min)", "Area (conteggi*s)", "Altezza (cps)", "Bianco interno applicato"];
// data of a plot as columns side by side (each trace has its own x), one sheet with the units in the headers: for graphs and tables made in Excel
function plotSheets(p) {
  const a = p._a; if (!a) return null;
  const cols = [], yt = p.kind === "pda" ? "Segnale PDA (unità del file)" : "Intensità (cps)";
  if (p.type === "spec") a.data.forEach(x => { cols.push([`m/z - ${x.f.label}`, x.d.mz], [`Intensità (cps) - ${x.f.label}`, x.d.y0 || x.d.y]); });
  else if (a.sr) {
    const same = p.type === "chrom" && a.sr.length > 1 && a.sr.every(q => q.x.length === a.sr[0].x.length && q.x.every((v, i) => v === a.sr[0].x[i]));   // total chromatograms of one run type share the time axis: one RT column
    if (same) { cols.push(["RT (min)", a.sr[0].x]); a.sr.forEach(sr => cols.push([`${yt} - ${sr.name}`, sr.y])); }
    else a.sr.forEach(sr => { cols.push([`RT (min) - ${sr.name}`, sr.x], [`${yt} - ${sr.name}`, sr.y]); });
  }
  if (!cols.length) return null;
  const n = Math.max(...cols.map(c => c[1].length)), rows = [];
  for (let i = 0; i < n; i++) rows.push(cols.map(c => (i < c[1].length ? c[1][i] : null)));
  const out = [{ name: p.title || "Dati", head: cols.map(c => c[0]), rows, widths: cols.map(c => Math.min(44, Math.max(14, c[0].length + 2))) }];
  if (p.ibk) out.push({ name: "Note", rows: [[{ v: "Bianco interno applicato", b: true }, ibkText(p.ibk)], ["Le intensità di questo foglio sono già sottratte del livello di fondo (un numero o una retta preso da un tratto del cromatogramma); non è la sottrazione di un file bianco."]], widths: [28, 60] });
  return out;
}

// ------------------------------------------------------------------ pannelli mobili
function place(w, h) {
  // a new panel goes under the existing ones, as wide as the page
  const W = w || hostWidth(), H = h || 300;
  const tp = tabPanels(), y = tp.length ? Math.max(...tp.map(p => p.y + p.h)) + 10 : 0;
  return { x: 0, y, w: W, h: H, full: !w };
}
// fixed slots: full-width panels sit one under the other; dragging one up or down makes the others change place
// (final = false: the dragged panel follows the mouse; final = true: it drops into its slot)
// spectra made from a chromatogram (double click, or linked) travel with it when it is dragged
const followers = p => tabPanels().filter(q => q !== p && q.full && q.el && q.type === "spec" && (q.link === p.id || q.src === p.id));
function restack(drag, final, grp = []) {
  const st = tabPanels().filter(q => q.full && q.el);
  const others = st.filter(q => q !== drag && !grp.includes(q)).sort((a, b) => a.y - b.y), c = drag.y + drag.h / 2;
  const idx = others.filter(q => q.y + q.h / 2 < c).length;
  const order = others.slice(); order.splice(idx, 0, drag, ...grp);      // the group stays together, in its own order
  let y = 0;
  order.forEach(q => {
    const mine = q === drag, moving = grp.includes(q);
    if (!mine && !moving) { q.y = y; apply(q); }                         // the others close the gap
    else if (final) { q.y = y; apply(q); }                                // the dragged ones: placed at the drop
    y += q.h + 10;
  });
  E.panels.sort((a, b) => a.y - b.y || a.id - b.id);
}
function relayout() {      // after a panel changes height: keep the order, close or open the gap
  let y = 0; tabPanels().filter(q => q.full && q.el).sort((a, b) => a.y - b.y || a.id - b.id).forEach(q => { q.y = y; apply(q); y += q.h + 10; });
}
// small grey number in the title of every panel of the tab, in order from the top (follows moves); keys 1-9 activate the panel
function numberPanels() {
  const st = tabPanels().filter(q => q.el).sort((a, b) => a.y - b.y || a.id - b.id);
  E.panels.forEach(q => { const n = q.el && q.el.querySelector(".pnum"); if (n) n.hidden = true; });
  st.forEach((q, i) => { const n = q.el.querySelector(".pnum"); q.num = i + 1; n.textContent = i + 1; n.hidden = false; n.title = "Pannello " + (i + 1) + ": premi il tasto " + (i + 1) + " per attivarlo"; });
}
document.addEventListener("keydown", e => {
  if (S.view !== "data" || e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key) || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "") || Q("dialog[open]")) return;
  const q = tabPanels().filter(x => x.el).sort((a, b) => a.y - b.y || a.id - b.id)[+e.key - 1]; if (!q) return;
  setActive(q); front(q.el); window.scrollTo({ top: Q("#dpanels").getBoundingClientRect().top + scrollY + q.y - 70, behavior: "smooth" });
});
function fitHost() { numberPanels(); Q("#dpanels").style.height = Math.max(520, ...tabPanels().map(p => p.y + p.h + 16)) + "px"; arrows(); pairArrows(); }
// MS2 tab: a short arrow between the precursor chromatogram (above) and the product-ion spectrum it feeds (below)
function pairArrows() {
  const host = Q("#dpanels"); host.querySelectorAll(".parr").forEach(e => e.remove());
  tabPanels().filter(s => s.type === "spec" && s.tab === "ms2" && s.link != null && s.el && s.full).forEach(s => {
    const c = E.panels.find(q => q.id === s.link && q.type === "chrom"); if (!c || !c.el) return;
    const gap = s.y - (c.y + c.h); if (gap < 0 || gap > 24) return;
    const a = document.createElement("div"); a.className = "parr"; a.title = "Lo spettro sotto mostra gli ioni prodotto del precursore scelto nel cromatogramma sopra";
    a.style.top = (c.y + c.h - 3) + "px"; a.style.height = (gap + 6) + "px";
    a.innerHTML = `<svg width="14" height="${gap + 6}" viewBox="0 0 14 16" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1v12M3 9.5l4 4 4-4"/></svg>`;
    host.appendChild(a);
  });
}
// up / down buttons: swap a full-width panel with its neighbour (the panels slide); inactive for the first and the last
function stackOrder() { return tabPanels().filter(q => q.full && q.el).sort((a, b) => a.y - b.y || a.id - b.id); }
// block that moves together: a chromatogram with its child spectra; the others, in order
function blockOf(p) { const grp = [p, ...(p.type === "chrom" || p.type === "xic" || p.type === "mrm" ? followers(p).sort((a, b) => a.y - b.y) : [])], st = stackOrder(), others = st.filter(q => !grp.includes(q)); return { grp, others, at: others.filter(q => q.y < p.y).length }; }
function arrows() {
  E.panels.forEach(q => { const u = q.el?.querySelector('[data-a="up"]'), d = q.el?.querySelector('[data-a="down"]'); if (!u) return; if (!q.full) { u.disabled = d.disabled = true; return; } const b = blockOf(q); u.disabled = b.at <= 0; d.disabled = b.at >= b.others.length; });
}
function movePanel(p, dir) {
  if (!p.full) return;
  const b = blockOf(p), j = b.at + dir; if (j < 0 || j > b.others.length) return;
  const order = b.others.slice(); order.splice(j, 0, ...b.grp);
  let y = 0; order.forEach(q => { q.y = y; apply(q); y += q.h + 10; });
  E.panels.sort((a, b2) => a.y - b2.y || a.id - b2.id); front(p.el); arrows(); uiSave();
}
function tile() {
  const w = hostWidth(); let y = 0;
  tabPanels().forEach(p => { Object.assign(p, { x: 0, y, w, h: p.h || 310, full: true }); y += p.h + 10; apply(p); draw(p); });
  fitHost(); uiSave();
}
const apply = p => { p.el.style.left = p.x + "px"; p.el.style.top = p.y + "px"; p.el.style.width = p.w + "px"; p.el.style.height = p.h + "px"; };

// a panel the student has just asked for may be below the fold: the page scrolls to it and its border flashes for a second (only a scroll if the system asks for less motion)
function reveal(p) {
  if (!p || !p.el) return p;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    p.el.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    if (!calm) { p.el.classList.remove("flash"); void p.el.offsetWidth; p.el.classList.add("flash"); setTimeout(() => p.el.classList.remove("flash"), 1100); }
  }));
  return p;
}
function addPanel(type, o, after) {
  const p = { id: E.seq++, type, anns: [], ints: [], ...o };
  if (!p.tab) { p.tab = type === "mrm" ? "mrm" : E.tab === "mrm" ? (tabFiles("full").length || !tabFiles("ms2").length ? "full" : "ms2") : E.tab; if (p.tab !== E.tab && window.setTab) window.setTab(p.tab, true); }
  const lv0 = (E.files[o?.k ?? 0] || {}).lv || 1;
  if (type === "chrom") Object.assign(p, { prec: o.prec ?? null, kind: o.kind || "tic", sel: null, cur: null, smooth: o.smooth ?? true, zoom: o.zoom || null, title: o.title || "Cromatogramma" });
  if (type === "spec") Object.assign(p, { k: o.k ?? 0, all: !!o.all, r0: o.r0 ?? null, r1: o.r1 ?? null, level: o.level ?? lv0, prec: o.prec ?? null, zoom: o.zoom || null, title: o.title || "Spettro di massa" });
  if (type === "xic") Object.assign(p, { traces: o.traces || [], tol: o.tol ?? TOL0, smooth: o.smooth ?? true, sel: null, cur: null, zoom: o.zoom || null, title: o.title || "Ione estratto (XIC)" });
  if (type === "mrm") Object.assign(p, { tr: o.tr ?? "", smooth: false, sel: null, cur: null, zoom: o.zoom || null, title: o.title || "Transizioni MRM", _trs: [] });
  if (type === "map") Object.assign(p, { k: o.k ?? 0, scale: o.scale || "sqrt", ref: o.ref ?? "", view: o.view || "2d", norm: o.norm || "abs", az: o.az ?? 25, elv: o.elv ?? 38, zoom: o.zoom || null, zoomY: o.zoomY || null, sel: null, cur: null, title: o.title || "Mappa RT-m/z" });
  if (type !== "map") p.zoomY = Array.isArray(o.zoomY) && o.zoomY.length === 2 ? o.zoomY : null;   // y zoom of the plot (an old notebook's "yz" is simply ignored)
  if (type !== "spec" && type !== "map") Object.assign(p, { mode: o.mode || "ovl", log: !!o.log, hid: o.hid || {} });
  if (type !== "spec" && type !== "map") Object.assign(p, { bk: o.bk ?? "", snip: !!o.snip, snipw: o.snipw ?? 1 });
  if (type !== "spec" && type !== "map") p.tl = !!o.tl;                 // linked time axis
  if (type === "chrom") p.ms2tri = !!o.ms2tri;                          // triangles of the MS2 scans on the survey chromatogram
  if (type === "xic") p.adduct = o.adduct || defAdduct();
  if (type === "spec") Object.assign(p, { bg: o.bg ?? "", bw0: o.bw0 ?? null, bw1: o.bw1 ?? null, lock: o.lock ? { pending: true } : null, si: null,
    rel: typeof o.rel === "boolean" ? o.rel : null, sticks: !!o.sticks, thr: o.thr ?? 5, nlab: o.nlab ?? 10, dec: o.dec ?? 1, meas: o.meas && Array.isArray(o.meas.list) ? o.meas : null, rul: false });   // lock: only open/closed is saved, the values are measured again
  if (type !== "xic") p.traces = p.traces || [];
  const g = (p.w && p.h) ? { x: p.x ?? 0, y: p.y ?? 0, w: p.w, h: p.h } : place();
  Object.assign(p, g);
  const el = document.createElement("div");
  el.className = "card pnl " + type;
  el.innerHTML = `<div class="hd"><span class="pnum" hidden></span><b class="ttl" title="${EH(shortHelp("pnl-" + type))} Doppio clic per rinominare."></b>${type === "spec" ? '<span class="rtl"></span>' : ""}<span class="ctl"></span><span class="rd"></span>${(() => {
    // button groups, separated by a vertical bar: [zoom + reset] | [integration] | [XIC] ▲▼ | [PNG / Excel] □ ×
    const lens = type === "chrom" || type === "xic" || type === "mrm";
    const fit = `<button class="bt" data-a="fit" disabled title="Torna a vedere tutto il grafico (attivo solo quando è ingrandito). Da tastiera: Backspace = vista intera, Ctrl/Cmd+Z = zoom precedente">${IC_FIT}</button>`;
    const gv = `<span class="tbg">${lens ? `<button class="bt" data-a="izoom" title="Zoom: attivalo e trascina sul grafico l'intervallo di tempo da ingrandire; il pulsante accanto torna alla vista intera. Ctrl o Cmd + rotella ingrandisce anche senza attivarlo">${IC_ZOOM}</button>` : ""}${fit}</span>`;
    const gs = type === "spec" ? `<span class="tbg"><button class="bt" data-a="rul" title="Righello: clic su un picco (riferimento) e poi su un altro: mostra la differenza di m/z. Si può anche usare il clic destro su un picco, «Misura da questo picco». Esc toglie le misure">${IC_RULER}</button><button class="bt" data-a="par" title="Parametri dello spettro: asse in % o in cps, quante etichette m/z, decimali">${IC_PARAM}</button><button class="bt" data-a="ptab" title="Tabella dei picchi di questa scansione, pronta da copiare in Excel">${IC_TAB}</button></span>` : "";
    const gl = lens ? `<span class="tbg"><button class="bt${o.tl ? " on" : ""}" data-a="tlink" title="Collega l'asse del tempo: ingrandendo un grafico collegato, gli altri collegati mostrano lo stesso intervallo di tempo">${IC_LINK}</button></span>` : "";
    const gi = lens ? `<span class="tbg"><button class="bt" data-a="iauto" title="Integrazione automatica: clicca su un picco e il programma trova i bordi e ne mostra l'area (poi puoi trascinare le barre)">${IC_AUTO}</button><button class="bt" data-a="iman" title="Integrazione manuale: trascina sul grafico l'intervallo da integrare">${IC_MAN}</button><select class="bt" data-a="intf" hidden title="Quale traccia integrare: quella su cui clicchi, tutte le visibili oppure un file preciso"></select><button class="bt" data-a="iclr" hidden title="Cancella tutte le integrazioni di questo grafico">Pulisci integrazioni</button><button class="bt" data-a="itab" hidden title="Tabella delle aree integrate e cinetica">${IC_TAB}</button></span>` : "";
    const gx = type === "chrom" ? '<span class="tbg"><button class="bt" data-a="xic" title="Estrai uno ione (XIC): scegli la finestra di m/z. Si integra solo dagli XIC">XIC</button></span>' : "";
    const gm = '<span class="tbg mv"><button class="bt" data-a="up" title="Sposta questo grafico in su">&#9650;</button><button class="bt" data-a="down" title="Sposta questo grafico in giù">&#9660;</button></span>';
    const go = `<span class="tbg"><button class="bt" data-a="png" title="Salva il grafico come immagine PNG">${IC_DL}PNG</button>${type === "map" ? "" : '<button class="bt" data-a="xlsx" title="Salva i dati del grafico (le tracce visibili) in un file Excel (.xlsx): numeri veri, un foglio, intestazioni con le unità">' + IC_DL + 'Excel</button>'}</span>`;
    return `<span class="tbs">${gv + gl + gs + gi + gx + gm + go}<button class="bt fsb" data-a="max" title="Schermo intero: ingrandisce questo pannello (Esc per uscire)">${IC_FS}</button><button class="x" title="Chiudi il pannello">&times;</button></span>`;
  })()}</div><canvas></canvas>${type === "spec" ? `<button class="bt lkb" data-a="lock">${IC_UNLOCK}</button>` : ""}<div class="vl" hidden></div><div class="cl" hidden></div><div class="tip" hidden></div><div class="leg"></div>${type === "spec" ? '<div class="leg2"></div>' : ""}`;
  p.el = el; p.vl = el.querySelector(".vl"); p.cl = el.querySelector(".cl"); p.tip = el.querySelector(".tip"); p.cv = el.querySelector("canvas"); p.rd = el.querySelector(".rd"); p.leg = el.querySelector(".leg"); p.leg2 = el.querySelector(".leg2");
  Q("#dpanels").appendChild(el);
  E.panels.push(p); apply(p); if (p.tab !== E.tab) el.style.display = "none"; fitHost();
  // sposta (trascina l'intestazione), porta davanti, ridimensiona (maniglia in basso a destra), ingrandisci
  el.addEventListener("mousedown", () => { front(el); setActive(p); });
  el.querySelector(".hd").addEventListener("mousedown", e => {
    if (e.target.closest("input,select,button,label,option") || el.classList.contains("max")) return;
    const sx = e.clientX - p.x, sy = e.clientY - p.y;
    const grp = p.full ? followers(p).sort((a, b) => a.y - b.y) : [], off = new Map(grp.map(q => [q, q.y - p.y]));
    if (p.full) { el.classList.add("drag"); grp.forEach(q => q.el.classList.add("drag")); }
    const mv = ev => {
      p.y = Math.max(0, ev.clientY - sy);
      if (p.full) { p.x = 0; grp.forEach(q => { q.y = Math.max(0, p.y + off.get(q)); q.x = 0; apply(q); }); restack(p, false, grp); } else p.x = Math.max(0, ev.clientX - sx);
      apply(p); fitHost();
    };
    const up = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); if (p.full) { el.classList.remove("drag"); grp.forEach(q => q.el.classList.remove("drag")); restack(p, true, grp); fitHost(); } uiSave(); };
    addEventListener("mousemove", mv); addEventListener("mouseup", up); e.preventDefault();
  });
  let first = true;
  p._ro = new ResizeObserver(() => {
    if (first) { first = false; return; }
    if (!el.classList.contains("max") && el.offsetWidth > 60) { p.w = el.offsetWidth; p.h = el.offsetHeight; if (p.full && Math.abs(p.w - Q("#dpanels").clientWidth) > 8) p.full = false; if (p.full) relayout(); fitHost(); uiSave(); }
    cancelAnimationFrame(p._raf); p._raf = requestAnimationFrame(() => draw(p));
  });
  p._ro.observe(el); p._ro.observe(p.cv);   // the canvas too: it shrinks when the legend or the controls wrap to more lines
  el.querySelector('[data-a="up"]').onclick = () => movePanel(p, -1); el.querySelector('[data-a="down"]').onclick = () => movePanel(p, 1);
  // full screen of THIS panel (any panel, also the ones added later): the button, Esc, and the graph is redrawn at the new size on the way in and out
  const fsB = el.querySelector('[data-a="max"]');
  p._setMax = on => {
    el.classList.toggle("max", on); fsB.innerHTML = on ? IC_FSX : IC_FS;
    fsB.title = on ? "Esci dallo schermo intero (Esc)" : "Schermo intero: ingrandisce questo pannello (Esc per uscire)";
    if (on) front(el);
    cancelAnimationFrame(p._raf); p._raf = requestAnimationFrame(() => { draw(p); setTimeout(() => draw(p), 120); });
  };
  fsB.onclick = () => p._setMax(!el.classList.contains("max"));
  const xlsB = el.querySelector('[data-a="xlsx"]');
  if (xlsB) xlsB.onclick = () => { const t = plotSheets(p); if (t) dlx(plotName(p) + ".xlsx", t); else info("Nessun dato da salvare in questo grafico."); };
  el.querySelector('[data-a="fit"]').onclick = () => { pushZh(p); p.zoom = null; p.zoomY = null; if (p.type === "spec") p.lock = null; draw(p); uiSave(); };
  const lkB = el.querySelector('[data-a="lock"]'); if (lkB) lkB.onclick = () => toggleLock(p);
  const rulB = el.querySelector('[data-a="rul"]'); if (rulB) rulB.onclick = () => { p.rul = !p.rul; rulB.classList.toggle("on", p.rul); if (!p.rul && p.meas && p.meas.ref != null && !p.meas.list.length) { p.meas = null; draw(p); } };
  const parB = el.querySelector('[data-a="par"]'); if (parB) parB.onclick = () => specParams(p, parB);
  const ptB = el.querySelector('[data-a="ptab"]'); if (ptB) ptB.onclick = () => peakTable(p);
  const tlB = el.querySelector('[data-a="tlink"]'); if (tlB) tlB.onclick = () => toggleTl(p);
  el.querySelector('[data-a="png"]').onclick = async () => {
    let cvs; p._exp = true;                             // the picture has no cursor line, no selection and no zoom bar; the spectrum says where it comes from
    try { await draw(p); cvs = whiteCanvas(p.cv, p.type === "spec" ? specCaption(p) : ""); } finally { p._exp = false; draw(p); }
    cvs.toBlob(async b => {
      let out = b; try { out = await pngWithMeta(b, plotMeta(p)); } catch (e) { /* the image is saved anyway, only without metadata */ }
      const a = document.createElement("a"); a.href = URL.createObjectURL(out); a.download = plotName(p) + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  };
  const bZ = el.querySelector('[data-a="izoom"]'), bA = el.querySelector('[data-a="iauto"]'), bM = el.querySelector('[data-a="iman"]'), bT = el.querySelector('[data-a="itab"]'), bX = el.querySelector('[data-a="xic"]');
  if (bA) {                                             // tools (one at a time): zoom (drag an interval), automatic integration (click a peak), manual integration (drag an interval)
    const btns = { zoom: bZ, auto: bA, man: bM };
    const setMode = m => { p.imode = p.imode === m ? null : m; Object.entries(btns).forEach(([k, b]) => b.classList.toggle("on", p.imode === k)); p.cv.style.cursor = p.imode === "zoom" ? "zoom-in" : p.imode ? "cell" : "crosshair"; refreshIntf(p); };
    if (p.imode && btns[p.imode]) { btns[p.imode].classList.add("on"); p.cv.style.cursor = "cell"; }      // MRM panels open with the manual integration tool ready
    bZ.onclick = () => setMode("zoom"); bA.onclick = () => setMode("auto"); bM.onclick = () => setMode("man"); bT.onclick = showInts;
    el.querySelector('[data-a="iclr"]').onclick = () => { if (p.ints.length) delInts(p, [...p.ints]); };
    el.querySelector('[data-a="intf"]').onchange = e => { p.intf = e.target.value; };
  }
  if (bX) bX.onclick = () => openXic(null);
  el.querySelector(".x").onclick = () => { p._ro.disconnect(); if (p._up) removeEventListener("mouseup", p._up); el.remove(); E.panels = E.panels.filter(x => x !== p); relayout(); fitHost(); uiSave(); if (E.tab === "ms2") renderFileList(); };
  el.querySelector(".ttl").ondblclick = async () => { const v = await ask("Nome del pannello", p.title); if (v) { p.title = v; ctl(p); uiSave(); } };
  attach(p); ctl(p); p.ready = draw(p);
  return p;
}
const redrawAll = () => tabPanels().forEach(draw);
// Esc leaves the full screen of a panel (not when a dialog, a menu or a help box is open: they use Esc themselves)
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || Q("dialog[open]") || Q("#helppop:not([hidden])") || (Q("#ctx") && !Q("#ctx").hidden) || Q("#uipset")) return;
  const m = E.panels.find(q => q.el && q.el.classList.contains("max")); if (m && m._setMax) m._setMax(false);
});
// copy of a plot on a white background (for PNG files and the report: a transparent PNG looks black in some viewers)
function whiteCanvas(cv, caption = "") {
  const sc = cv.width / Math.max(cv.clientWidth, 1), top = caption ? Math.round(24 * sc) : 0;
  const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height + top;
  const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, top);
  if (caption) { g.fillStyle = "#222"; g.font = `${Math.round(12 * sc)}px system-ui`; g.textBaseline = "middle"; g.fillText(caption, Math.round(14 * sc), top / 2); }
  return c;
}
// line written on the saved image of a mass spectrum: file, MS level, retention time and number of scans
function specCaption(p) {
  const parts = [...p.leg.children, ...(p.leg2 ? p.leg2.children : [])].map(x => x.textContent.trim()).filter(Boolean), f = E.files[p.k];
  return (p.all || !f ? "" : f.label + " · ") + parts.slice(0, 1).join("") + (parts.length > 1 ? " · " + parts.slice(1).join(", ") : "");
}

// bring a panel to the front (z-index is renumbered before it can reach the menus, which sit above 10000)
function front(el) {
  el.style.zIndex = ++E.z;
  if (E.z > 5000) { E.panels.slice().sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0)).forEach((q, i) => { q.el.style.zIndex = 10 + i; }); E.z = 10 + E.panels.length; el.style.zIndex = ++E.z; }
}
// active panel (outlined): its cursor can be moved scan by scan with the arrow keys
function setActive(p) { E.active = p; E.panels.forEach(q => q.el.classList.toggle("act", q === p)); }
// MS2 precursor chromatograms: scans are sparse (one every few cycles) and many are empty. Nearest scan WITH data, either around x (d = 0)
// or strictly beyond x in the direction d; g = half the smaller gap to its neighbours, so the spectrum window holds that scan and no other.
function ms2Near(p, x, d) {
  let best = null;
  for (const s of p._a.sr) {
    if (E.files[s.k]?.kind === "mrm") continue;
    const xs = s.x, yy = s.y, e = 1e-6;
    for (let i = 0; i < xs.length; i++) {
      if (!(yy[i] > 0) || (d > 0 && xs[i] <= x + e) || (d < 0 && xs[i] >= x - e)) continue;
      const dist = Math.abs(xs[i] - x); if (best && dist >= best.dist) { if (d > 0) break; continue; }
      best = { dist, rt: xs[i], k: s.k, i, s };
      if (d > 0) break;                                   // first scan beyond x going right
    }
  }
  if (!best) return null;
  const xs = best.s.x, i = best.i, gaps = [xs[i] - xs[i - 1], xs[i + 1] - xs[i]].filter(v => v > 0);
  return { ...best, g: (gaps.length ? Math.min(...gaps) : scanStep()) * 0.9 };
}
// One step along the scans of the active chromatogram (d = +-1, or +-5 with Maiusc). The cursor line moves by itself (no redraw of the whole chromatogram
// unless the view or the selection changes) and the linked spectra are asked to redraw once per frame. Returns false at the first/last scan.
function stepScan(p, d, o = {}) {
  const sg = Math.sign(d), n = Math.abs(d);
  let rt, i, k, lo, hi, tot;
  if (p.tab === "ms2") {                                  // jump straight to the nearest scan with data in the direction pressed
    let b = null, x = p.cur;
    for (let j = 0; j < n; j++) { const q = ms2Near(p, x, sg); if (!q) break; b = q; x = q.rt; }
    if (!b) { stepMsg(p, sg > 0 ? "ultimo scan con dati" : "primo scan con dati"); return false; }
    rt = b.rt; i = b.i; k = b.k; lo = rt - b.g / 2; hi = rt + b.g / 2; tot = b.s.x.length;
  } else {
    const a = p._a, ok = s => E.files[s.k]?.kind !== "mrm";
    const k0 = p._sk != null && a.sr.some(x => x.k === p._sk && ok(x)) ? p._sk : nearestFile(p, p.cur);      // the same file all along, even if another one becomes the highest
    const s = a.sr.find(x => x.k === k0 && ok(x)) || a.sr.find(ok) || a.sr[0]; if (!s || !s.x.length) return false;
    const yy = s.y || s.ys, i0 = nearIdx(s.x, p.cur); i = i0;
    for (let j = 0; j < n; j++) {
      let t = i + sg;
      while (t >= 0 && t < s.x.length && !(yy[t] > 0)) t += sg;             // empty scans (MS2 files have many) are skipped: the cursor jumps to the nearest scan with data
      if (t < 0 || t >= s.x.length) break;
      i = t;
    }
    if (i === i0) { stepMsg(p, sg > 0 ? "ultimo scan con dati" : "primo scan con dati"); return false; }
    rt = s.x[i]; k = s.k; tot = s.x.length;
    const dt = Math.abs(s.x[Math.min(i + 1, s.x.length - 1)] - s.x[Math.max(i - 1, 0)]) / 2 || scanStep();
    lo = rt - dt / 2; hi = rt + dt / 2;
  }
  const a = p._a; let full = false;
  p.cur = rt; if (p.sel && !o.keepSel) { p.sel = null; full = true; }
  if (p.zoom && (rt < p.zoom[0] || rt > p.zoom[1])) { const w = p.zoom[1] - p.zoom[0]; p.zoom = clampView(rt - w / 2, rt + w / 2, a.full[0], a.full[1]); full = true; }
  p._sk = k;
  if (!o.noLock) lockStart(p, k);
  if (full) draw(p); else { cursorLine(p); uiSave(); }
  pushLinked(p, lo, hi, k, true, { step: true, i, dir: sg });
  stepMsg(p, `scansione ${i + 1}/${tot} · RT ${rt.toFixed(2)} min`, true);
  return true;
}
function stepMsg(p, t, keep) { p.rd.textContent = t; p.rd.classList.toggle("show", /più vicina/.test(t)); if (keep) p._msg = t; }   // the line under the graph is gone: only the "nearest scan with data" notice of MS2 still shows
// the legend lives INSIDE the graph (top right) for chromatograms, XIC and MRM; for the spectrum the scan line sits on the row of the x axis title and the file legend inside the graph
function placeLeg(p) {
  if (!p.cv || p.type === "map") return;
  const right = p.el.clientWidth - p.cv.offsetLeft - p.cv.offsetWidth + M.r + 6;
  if (p.type === "spec") {
    p.leg.style.right = right + "px"; p.leg.style.top = p.cv.offsetTop + p.cv.offsetHeight - 17 + "px";
    if (p.leg2) { p.leg2.style.right = right + "px"; p.leg2.style.top = p.cv.offsetTop + M.t + 5 + "px"; }
  } else { p.leg.style.right = right + "px"; p.leg.style.top = p.cv.offsetTop + M.t + 5 + "px"; }
}
// "zoom bar" in the top margin: where the visible window sits in the whole axis, plus the visible range in words; "Vista intera" button
function afterDraw(p) {
  const rl = p.el.querySelector(".rtl");           // retention time of the spectrum, next to the title
  if (rl) { if (p.r0 == null) rl.textContent = ""; else { const m = (p.r0 + p.r1) / 2, wide = p.r1 - p.r0 > 1.6 * scanStep(); const rt = wide ? `RT ${p.r0.toFixed(2)}-${p.r1.toFixed(2)} min` : `RT ${m.toFixed(2)} min`; rl.textContent = p.src != null && !p.link && p.type === "spec" ? "fermo a " + rt : rt; } }
  const btn = p.el.querySelector('[data-a="fit"]'), z = !!(p._a && (p.zoom || p.zoomY));
  if (btn) btn.disabled = !z;                      // always there (the layout does not jump), active only when zoomed
  lockButton(p); cursorLine(p);
  placeLeg(p);
  const tb = p.el.querySelector('[data-a="itab"]'); if (tb) tb.hidden = !p.ints.length;
  const cb = p.el.querySelector('[data-a="iclr"]'); if (cb) cb.hidden = !p.ints.length;
  refreshIntf(p);
  if (!(p._a && (p.zoom || p.zoomY)) || p._exp) return;
  const a = p._a, g = p.cv.getContext("2d"), bw = 90, x = a.W - M.r - bw, y = 3, f0 = a.full[0], f1 = a.full[1], u = p.type === "spec" ? "m/z" : "RT";
  const txt = `${u} ${a.x0.toFixed(p.type === "spec" ? 1 : 2)}-${a.x1.toFixed(p.type === "spec" ? 1 : 2)}` + (p.type === "spec" ? "" : " min") + (a.map && p.zoomY ? ` · m/z ${a.y0.toFixed(0)}-${a.y1.toFixed(0)}` : "");
  g.save(); g.font = "10px system-ui"; g.textAlign = "right"; g.fillStyle = css("--muted"); g.fillText("ingrandito: " + txt, x - 6, y + 7);
  g.fillStyle = "rgba(120,120,120,.25)"; g.fillRect(x, y, bw, 6);
  g.fillStyle = css("--accent"); const l = x + (a.x0 - f0) / (f1 - f0) * bw, r = x + (a.x1 - f0) / (f1 - f0) * bw; g.fillRect(l, y, Math.max(2, r - l), 6);
  g.restore();
}
// ---- names and metadata of the saved images / Excel files
const DEF_TITLES = ["Cromatogramma", "Spettro di massa", "Ione estratto (XIC)", "Transizioni MRM", "Mappa RT-m/z"];
const fname = t => String(t).replace(/[^\w.+\-]+/g, "_").replace(/^_+|_+$/g, "");
function plotFiles(p) {
  const a = p._a, seen = new Map();
  (a && a.sr ? a.sr.map(s => E.files[s.k]) : a && a.data ? a.data.map(x => x.f) : a && a.f ? [a.f] : []).forEach(f => { if (f) seen.set(f.k, f); });
  return [...seen.values()];
}
function plotName(p) {
  const fs = plotFiles(p), a = p._a;
  const ft = fs.length === 1 ? (fs[0].type === "sample" && fs[0].time != null ? "t" + fs[0].time : fname(fs[0].label).slice(0, 18)) : fs.length ? fs.length + "file" : "";
  const mzs = a && a.sr ? [...new Set(a.sr.map(s => s.mz).filter(v => v != null))] : [];
  const trs = a && a.sr && p.type === "mrm" ? [...new Set(a.sr.map(s => s.ion))] : [];
  const lst = (arr, f) => arr.length <= 3 ? arr.map(f).join("+") : arr.length + "ioni";
  const rtm = p.r0 != null ? "RT" + ((p.r0 + p.r1) / 2).toFixed(1) : "";
  let parts;
  if (p.type === "chrom") parts = [p.kind.toUpperCase(), ft];
  else if (p.type === "xic") parts = ["XIC", mzs.length ? "m-z" + lst(mzs, v => +v.toFixed(1)) : "", ft];
  else if (p.type === "mrm") parts = ["MRM", trs.length ? lst(trs, v => String(v).replace(">", "-")) : "", ft];
  else if (p.type === "spec") parts = [p.level === 2 ? "spettroMS2" : "spettro", fs.length > 1 ? "sovrapposti_" + ft : ft, rtm];
  else parts = ["mappa", ft];
  if (!DEF_TITLES.includes(p.title) && p.title) parts = [p.title, ft];
  return fname(parts.filter(Boolean).join("_")).slice(0, 60) || "grafico";
}
function plotMeta(p) {
  const a = p._a || {}, fs = plotFiles(p), d = [];
  d.push({ chrom: "cromatogramma " + (p.kind || "").toUpperCase(), xic: "XIC (" + p.traces.map(t => t.w == null ? t.mz + " +-" + p.tol : (t.mz - t.w).toFixed(1) + "-" + (t.mz + t.w).toFixed(1)).join("; ") + ")", mrm: "transizioni MRM", spec: "spettro di massa " + (p.level === 2 ? "MS2" : "MS1"), map: "mappa RT-m/z" }[p.type] || p.type);
  const mzs = a.sr ? [...new Set(a.sr.map(s => s.mz).filter(v => v != null))] : [];
  if (mzs.length) d.push("m/z " + mzs.map(v => v.toFixed(1)).join(", "));
  if (p.type === "spec" && p.r0 != null) d.push(`RT ${p.r0.toFixed(2)}-${p.r1.toFixed(2)} min`);
  if (p.ibk) d.push("bianco interno applicato: " + ibkText(p.ibk) + " (livello di fondo tolto a tutta la traccia, non è la sottrazione di un file bianco)");
  if (a.x0 != null) d.push(`asse visibile ${a.x0.toFixed(p.type === "spec" ? 1 : 2)}-${a.x1.toFixed(p.type === "spec" ? 1 : 2)}`);
  return [["Title", p.title || "Grafico"], ["Description", d.join("; ")], ["Source", fs.map(f => f.label).join(", ")], ["Software", "QqQ lab"], ["Creation Time", new Date().toISOString()]];
}
// writes tEXt chunks (Latin-1) right after the IHDR of a PNG
const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = 0xffffffff; for (const b of u) c = CRCT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
async function pngWithMeta(blob, fields) {
  const src = new Uint8Array(await blob.arrayBuffer()), l1 = t => Uint8Array.from(String(t).replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?"), c => c.charCodeAt(0));
  const parts = [src.slice(0, 33)];
  fields.forEach(([k, v]) => {
    const kb = l1(k), vb = l1(v), body = new Uint8Array(4 + kb.length + 1 + vb.length);
    body.set([116, 69, 88, 116], 0); body.set(kb, 4); body.set(vb, 5 + kb.length);       // "tEXt" + keyword + 0 + text
    const ch = new Uint8Array(12 + body.length - 4), dv = new DataView(ch.buffer);
    dv.setUint32(0, body.length - 4); ch.set(body, 4); dv.setUint32(ch.length - 4, crc32(body)); parts.push(ch);
  });
  parts.push(src.slice(33)); return new Blob(parts, { type: "image/png" });
}

function ctl(p) {
  const c = p.el.querySelector(".ctl"), t = p.el.querySelector(".ttl");
  t.textContent = p.type === "xic" && p.traces.length === 1 && p.title === "Ione estratto (XIC)" ? "XIC · " + p.traces[0].label : p.title;      // a single trace is named in the title
  t.style.display = p.type === "chrom" && p.title === "Cromatogramma" ? "none" : "";          // the menu of the kind (TIC / BPC / PDA) is the title
  if (p.type === "spec" && p.link && (!E.panels.some(q => q.id === p.link) || E.panels.some(q => q !== p && q.type === "spec" && q.link === p.link && q.id > p.id))) { p.src = p.src || p.link; p.link = null; }   // only the newest spectrum of a chromatogram is live; a link to a closed chromatogram is dropped
  if (p.type === "spec" && p.link) t.insertAdjacentHTML("beforeend", ` <span class="lk" title="Questo spettro segue il cromatogramma: un clic, il cursore, le frecce o una selezione lo aggiornano. Gli altri spettri aperti da quel cromatogramma restano fermi al loro tempo.">&#128279; segue il cursore</span>`);
  const T0 = p.tab || E.tab, ms2c = p.type === "chrom" && T0 === "ms2", mrmP = p.type === "mrm";
  if (ms2c) { p.kind = "tic"; p.mz0 = p.mz1 = null; p.bk = ""; p.snip = false; p.log = false; }      // precursor chromatogram: only the MS2 scans of the precursor
  if (mrmP) { p.bk = ""; p.snip = false; }
  if (p.type === "spec" && T0 === "ms2") p.level = 2;
  const NOMS2 = "Non si applica al cromatogramma dei precursori MS²: contiene solo gli scan MS² del precursore scelto.", NOMRM = "Non si applica agli MRM: ogni transizione è già selettiva.";
  const off = (on, why) => on ? ` disabled title="${why}"` : "";
  const chk = (k, lab, dis, why, tip) => `<label class="muted${dis ? " dis" : ""}"${dis ? ` title="${why}"` : tip ? ` title="${tip}"` : ""}><input type="checkbox" data-o="${k}" ${p[k] ? "checked" : ""}${dis ? " disabled" : ""}> ${lab}</label>`;
  const ONEF = tabFiles(p.tab || E.tab).length <= 1, ONEWHY = "Con un solo file non c'è nulla da sovrapporre o impilare.";
  const view = `<select data-o="mode"${p.type === "chrom" || (p.type === "xic" && p.traces.length <= 1) ? off(ONEF, ONEWHY) : ""} title="Come disegnare più tracce: una sopra l'altra; una per riga (come in FreeStyle); a cascata, in ordine di tempo, la prima davanti (solo per guardare: senza integrazione né lettura dei valori)"><option value="ovl" ${p.mode !== "stk" && p.mode !== "cas" ? "selected" : ""}>sovrapposti</option><option value="stk" ${p.mode === "stk" ? "selected" : ""}>impilati</option><option value="cas" ${p.mode === "cas" ? "selected" : ""}>a cascata</option></select>`;
  const logChk = chk("log", "scala log", ms2c, NOMS2);
  const T = p.tab || E.tab, TF = tabFiles(T), sfl = scanFiles(TF), mlo = Math.min(...sfl.map(x => x.mz_min ?? Infinity)), mhi = Math.max(...sfl.map(x => x.mz_max ?? -Infinity));
  const mzbar = `<label class="muted" title="Mostra il cromatogramma costruito solo con gli ioni in questo intervallo di m/z. Vuoto = tutti gli ioni. Serve per togliere dal TIC gli m/z che non ti interessano (solvente, fondo)"><i>m/z</i> da <input data-o="mz0" class="mzf" inputmode="decimal" autocomplete="off"${ms2c ? " disabled" : ""} value="${p.mz0 != null ? fmz(p.mz0) : ""}" placeholder="${isFinite(mlo) ? mlo.toFixed(1) : ""}"> a <input data-o="mz1" class="mzf" inputmode="decimal" autocomplete="off"${ms2c ? " disabled" : ""} value="${p.mz1 != null ? fmz(p.mz1) : ""}" placeholder="${isFinite(mhi) ? mhi.toFixed(1) : ""}"></label>`;
  const hasScan = sfl.length > 0, ms2s = TF.filter(x => x.kind === "ms2"), hasPda = TF.some(x => x.pda);
  if (p.type === "chrom" && ((!hasScan && p.kind === "bpc") || (!hasPda && p.kind === "pda"))) p.kind = "tic";      // options that make no sense for these files are switched off
  const precs = [...new Set(ms2s.flatMap(x => x.precursors))].sort((a, b) => a - b);
  const precSel = precs.length && p.kind !== "pda" ? `<select data-o="prec" style="flex:none;min-width:11em" title="File MS2 (ioni prodotto): somma di tutti i precursori oppure solo gli scan di un precursore"><option value="">tutti i prec.</option>${precs.map(v => `<option value="${v}" ${String(p.prec) === String(v) ? "selected" : ""}>prec. ${v}</option>`).join("")}</select>` : "";
    const blanks = TF.filter(x => x.type === "blank"), bkOn = p.bk !== "" && p.bk != null && E.files[+p.bk];
  const bkList = blanks.concat(bkOn && !blanks.includes(E.files[+p.bk]) ? [E.files[+p.bk]] : []);          // an old notebook may point to a file that is not marked as blank: keep it
  const cval = bkOn ? "f" + p.bk : p.ibk || p._pickIbk ? "tract" : p.snip ? "snip" : "";
  const corr = `<select data-o="corr"${off(ms2c || mrmP, ms2c ? NOMS2 : NOMRM)} title="Correzione del fondo (una sola alla volta). Nessuna: i dati come sono. File bianco: toglie il segnale del file bianco (utile se il fondo cambia nel tempo come nel campione). Fondo di un tratto: trascini un tratto senza picchi e se ne toglie la media (fondo piatto). Linea di base automatica: toglie la base che sale sotto i picchi (algoritmo SNIP)."><option value="" ${cval === "" ? "selected" : ""}>Correzione: nessuna</option><optgroup label="Sottrai un file bianco">${bkList.length ? bkList.map(x => `<option value="f${x.k}" ${cval === "f" + x.k ? "selected" : ""}>${EH(x.label)}</option>`).join("") : '<option disabled>nessun file indicato come bianco</option>'}</optgroup><option value="tract" ${cval === "tract" ? "selected" : ""}>Sottrai il fondo di un tratto</option><option value="snip" ${cval === "snip" ? "selected" : ""}>Linea di base automatica</option></select>${p.snip && !bkOn ? `<label class="muted" title="Larghezza della finestra: deve essere più larga dei picchi">&le;<input data-o="snipw" type="number" step="0.5" min="0.2" value="${p.snipw}" style="width:50px"> min</label>` : ""}`;
  const fsel = `<button data-o="fpop" class="fcount"${off(ONEF, "Hai caricato un solo file in questa scheda.")} title="Scegli al volo quali file mostrare (vale per tutti i grafici, come la lista a sinistra)">File ${TF.filter(f => f.vis).length}/${TF.length} &#9662;</button>`;
  // "Parametri": the controls used less often live in a small popover (same look as the one of the spectrum); a chip next to the icon says what is not at its default value
  const chips = [];
  if (p.type !== "mrm" && !(p.type === "chrom" && p.kind === "pda") && (p.mz0 != null || p.mz1 != null)) chips.push(`m/z ${p.mz0 != null ? fmz(p.mz0) : "…"}–${p.mz1 != null ? fmz(p.mz1) : "…"}`);
  if (p.type === "chrom" && p.prec != null && p.prec !== "" && !ms2c) chips.push("prec. " + p.prec);
  if (p.log) chips.push("log");
  if (bkOn) chips.push("bianco: " + E.files[+p.bk].label); else if (p.ibk || p._pickIbk) chips.push("fondo di un tratto"); else if (p.snip) chips.push("linea di base");
  const parBox = inner => `<span class="cpar"><button class="bt" type="button" data-a="cpar" title="Parametri: intervallo di m/z, scala log, correzione del fondo${p.type === "chrom" ? ", precursore" : ""}">${IC_PARAM}</button>${chips.map(t => `<button class="chip" type="button" data-a="cparchip" title="Cambia questo parametro">${EH(t)}</button>`).join("")}<span class="sp-pop cpop" ${p._parOpen ? "" : "hidden"}>${inner}</span></span>`;
  const kindSel = ms2c ? `<select disabled title="${NOMS2}"><option>scan MS² dei precursori</option></select>` : null;
  if (p.type === "chrom") c.innerHTML = `${kindSel || `<select data-o="kind" class="ttlsel" title="Tipo di cromatogramma"><option value="tic" ${p.kind === "tic" ? "selected" : ""}>TIC (somma)</option><option value="bpc" ${p.kind === "bpc" ? "selected" : ""} ${hasScan ? "" : "disabled"} title="Picco base: lo ione più intenso di ogni scan. Non esiste nei file MRM (si registrano solo le transizioni scelte)">BPC (picco base)</option><option value="pda" ${p.kind === "pda" ? "selected" : ""} ${hasPda ? "" : "disabled"} title="Segnale del rivelatore a serie di diodi (PDA/UV): non dipende dallo spettrometro di massa">PDA (UV, totale)</option></select>`}${chk("smooth", "smoothing")}${view}${parBox(`${p.kind === "pda" ? "" : precSel + (hasScan ? mzbar : "")}${logChk}${corr}${p.type === "chrom" && p.tab === "full" && E.files.some(x => x.ms2_events) ? chk("ms2tri", "mostra le MS2", false, "", "Un triangolino in alto ogni volta che è partita una scansione MS2 (file con survey e MS2 insieme). Clic su un triangolino: apre quello spettro MS2 nella scheda MS²") : ""}`)}`;
  if (p.type === "xic") {
    p._xt = Math.min(p._xt || 0, Math.max(0, p.traces.length - 1));
    const xt = p.traces[p._xt], xw1 = xt ? (xt.w ?? p.tol) : 0;
    const xsel = p.traces.length > 1 ? `<select data-o="xt" title="Quale XIC modificare">${p.traces.map((t, i) => `<option value="${i}" ${i === p._xt ? "selected" : ""}>XIC ${i + 1}</option>`).join("")}</select>` : "";
    const xr = xt ? `${xsel}<label class="muted" title="Intervallo di m/z estratto (XIC). Scrivi i due estremi e premi Invio"><i>m/z</i> da <input data-o="xlo" class="mzf" inputmode="decimal" autocomplete="off" value="${fmz(xt.mz - xw1)}"> a <input data-o="xhi" class="mzf" inputmode="decimal" autocomplete="off" value="${fmz(xt.mz + xw1)}"></label>` : "";
    c.innerHTML = `${xr}${fsel}${chk("smooth", "smoothing")}${view}${parBox(logChk + corr)}${p.traces.length > 1 ? '<button data-o="split" title="Un pannello per ogni ione">Separa</button>' : ""}`;
  }
  if (p.type === "mrm") c.innerHTML = `<select data-o="tr" title="Transizione"><option value="">tutte le transizioni</option>${p._trs.map(t => `<option value="${EH(t.key)}" ${p.tr === t.key ? "selected" : ""}>${EH(t.key)} ${EH(t.name)}</option>`).join("")}</select>${fsel}${chk("smooth", "smoothing", false, "", "Spento: le aree si calcolano sul segnale grezzo. Lo smoothing cambia solo il disegno, mai le aree integrate (nell'MRM si integra, per questo parte spento)")}${view}${parBox(logChk + corr)}`;
  if (p.type === "map") {
    const rf0 = p.ref !== "" && p.ref != null, sf = TF, opt = (v, cur, lab) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${EH(lab)}</option>`;
    c.innerHTML = `<span class="tbg" role="group" title="Vista della mappa: 2D = colori sul piano RT-m/z; 3D = superficie con l'intensità in altezza (trascina per ruotarla)"><button data-o="view" data-v="2d" class="${p.view !== "3d" ? "on" : ""}">2D</button><button data-o="view" data-v="3d" class="${p.view === "3d" ? "on" : ""}">3D</button></span>` +
      `<select data-o="k"${follow(p.tab || E.tab) ? ' disabled title="Hai scelto «Solo il selezionato» nella barra: la mappa segue il file scelto lì."' : ' title="File da mostrare"'}>${sf.map(x => opt(x.k, follow(p.tab || E.tab) ? E.cur : p.k, x.label)).join("")}</select>` +
      `<select data-o="scale" title="Scala dei colori: la radice quadrata fa emergere i segnali deboli">${opt("sqrt", p.scale, "colori: radice")}${opt("lin", p.scale, "colori: lineare")}${opt("log", p.scale, "colori: log")}</select>` +
      `<label class="muted" title="Sottrae un altro file: in rosso ciò che è più intenso nel file mostrato, in blu ciò che è più intenso nel riferimento">differenza con <select data-o="ref"${off(sf.length <= 1, "Serve un secondo file full scan da sottrarre.")}><option value="">nessuno</option>${sf.map(x => opt(x.k, p.ref, x.label)).join("")}</select></label>` +
      `<select data-o="norm"${rf0 ? "" : ' disabled'} title="${rf0 ? "" : "Serve solo per la differenza: scegli prima il file da sottrarre. "}Prima di sottrarre due esperimenti diversi conviene renderli confrontabili: «al massimo» divide ogni mappa per il suo punto più intenso; «al totale» per la somma di tutte le intensità (in per mille). Con «assoluta» si sottraggono i conteggi così come sono.">${opt("abs", p.norm, "intensità assoluta")}${opt("max", p.norm, "normalizza al massimo")}${opt("tic", p.norm, "normalizza al totale")}</select>`;
  }
  if (p.type === "spec") {
    const f = TF, hasMs2 = f.some(x => x.ms2);
    const fol = follow(T0), FW = "Hai scelto «Solo il selezionato» nella barra: questo grafico segue il file scelto lì. Con «Tutti sovrapposti» scegli qui il file.";
    c.innerHTML = `<select data-o="k"${off(fol, FW)}>${f.map(x => `<option value="${x.k}" ${x.k === (fol ? E.cur : p.k) ? "selected" : ""}>${EH(x.label)}</option>`).join("")}</select>${chk("all", "sovrapponi i file", fol || ONEF, fol ? FW : "Hai caricato un solo file in questa scheda.")}` +
            (hasMs2 ? `<select data-o="level"${off(T0 === "ms2", "Nella scheda MS² lo spettro è sempre quello degli ioni prodotto (livello MS2).")}><option value="1" ${p.level === 1 ? "selected" : ""}>MS1</option><option value="2" ${p.level === 2 ? "selected" : ""}>MS2</option></select>` : "") +
      `<select data-o="bg" title="Sottrai lo spettro di fondo (come «Subtract spectrum» di Xcalibur): lo spettro medio di un tratto di tempo dello stesso file, oppure lo stesso intervallo in un file bianco. I valori negativi diventano zero">` +
      `<option value="">Fondo: nessuno</option><option value="w" ${p.bg === "w" ? "selected" : ""}>Fondo: un tratto di tempo</option><optgroup label="Fondo: un file bianco">${(() => { const bl = f.filter(x => x.kind !== "mrm" && (x.type === "blank" || String(p.bg) === String(x.k))); return bl.length ? bl.map(x => `<option value="${x.k}" ${String(p.bg) === String(x.k) ? "selected" : ""}>${EH(x.label)}</option>`).join("") : "<option disabled>nessun file indicato come bianco</option>"; })()}</optgroup></select>` +
      (p.bg === "w" ? `<label class="muted">da <input data-o="bw0" type="number" step="0.1" value="${p.bw0 ?? ""}" style="width:56px"> a <input data-o="bw1" type="number" step="0.1" value="${p.bw1 ?? ""}" style="width:56px"> min</label>` : "") +
      (p.level === 2 ? `<select data-o="prec" style="min-width:11em"><option value="">tutti i prec.</option>${[...new Set(f.flatMap(x => x.precursors))].sort((a, b) => a - b).map(v => `<option value="${v}" ${String(p.prec) === String(v) ? "selected" : ""}>prec. ${v}</option>`).join("")}</select>` : "");
  }
  const cpB = c.querySelector('[data-a="cpar"]'), cpP = c.querySelector(".cpop");
  const parPlace = () => { if (!cpB || !cpP || cpP.hidden) return; const pr = p.el.getBoundingClientRect(), br = cpB.getBoundingClientRect(); cpP.style.left = Math.max(4, Math.min(br.left - pr.left, p.el.clientWidth - cpP.offsetWidth - 6)) + "px"; cpP.style.top = br.bottom - pr.top + 4 + "px"; };
  const parToggle = on => { p._parOpen = on; if (cpP) { cpP.hidden = !on; parPlace(); } };
  if (cpB) { cpB.onclick = () => parToggle(!p._parOpen); c.querySelectorAll('[data-a="cparchip"]').forEach(b => { b.onclick = () => parToggle(true); }); parPlace();
    if (!p._parAway) { p._parAway = e => { if (p._parOpen && p.el.isConnected && !e.target.closest(".cpop") && !e.target.closest('[data-a="cpar"],[data-a="cparchip"]')) { p._parOpen = false; const q = p.el.querySelector(".cpop"); if (q) q.hidden = true; } }; document.addEventListener("mousedown", p._parAway, true); } }
  c.querySelectorAll("[data-o]").forEach(x => {
    const k = x.dataset.o;
    if (k === "fpop") x.onclick = e => { e.stopPropagation(); fileMenu(x); };
    else if (k === "xt") x.onchange = () => { p._xt = +x.value; ctl(p); };
    else if (k === "xlo" || k === "xhi") x.onchange = () => {
      const t = p.traces[p._xt], lo = numMz1(c.querySelector('[data-o="xlo"]').value), hi = numMz1(c.querySelector('[data-o="xhi"]').value);
      if (t && lo != null && hi != null && hi > lo) { t.mz = rh((lo + hi) / 2, 2); t.w = rh((hi - lo) / 2, 2); t.label = `m/z ${fmz(lo)}-${fmz(hi)}`; }
      ctl(p); draw(p);
    };
    else if (k === "view") x.onclick = () => { setMapView(p, x.dataset.v); };
    else if (k === "split") x.onclick = () => splitPanel(p);
    else if (k === "corr") x.onchange = () => setCorr(p, x.value);
        else x.onchange = () => {
      p[k] = (k === "mz0" || k === "mz1") ? numMz(x.value) : x.type === "checkbox" ? x.checked : x.type === "number" ? +x.value : (k === "k" || k === "level") ? +x.value : x.value === "" ? (k === "fk" || k === "tr" ? "" : null) : x.value;
      if (k === "bk" || k === "bg") p[k] = x.value === "" ? "" : x.value === "w" ? "w" : +x.value;
      if (p.type === "spec" && ["k", "level", "prec", "all"].includes(k)) p.meas = null;      // the measures belong to the spectrum they were made on
      if (["level", "all", "snip", "bg", "kind", "mz0", "mz1"].includes(k)) ctl(p);
      draw(p);
    };
  });
}
// the 3D view needs more height than the 2D map: the panel grows while it is in 3D and goes back afterwards
function setMapView(p, v) {
  p.view = v;
  if (v === "3d" && p.h < 470) { p.h0v = p.h; p.h = 470; apply(p); relayout(); fitHost(); }
  else if (v !== "3d" && p.h0v) { p.h = p.h0v; p.h0v = null; apply(p); relayout(); fitHost(); }
  ctl(p); draw(p); uiSave();
}
function addTrace(p, mz, label, w) {
  mz = rh(mz, w != null ? 2 : 1);       // (a window centre is half of two 0.1 values: two decimals, the edges stay at one) unit-resolution instrument: one decimal is all that means anything
  p.traces.push({ id: E.seq++, mz, w: w ?? null, label: label || "m/z " + mz.toFixed(1) });
  ctl(p); draw(p);
}
const numMz = t => { const v = parseFloat(String(t).replace(",", ".")); return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null; };
// ONE rounding rule everywhere (half up on the decimal text, like qqq_lab.chem round_half_up): 364.15 gives 364.2 although 364.15*10 is 3641.4999... in binary
const rh = (v, d = 1) => { const n = Number(v); if (!isFinite(n)) return n; const sg = n < 0 ? -1 : 1; return sg * Number(Math.round(Number(Number(Math.abs(n).toFixed(9)) + "e" + d)) + "e-" + d); };   // the 9-digit prefilter is the same as round_half_up in elements.py
window.rh = rh;
const numMz1 = t => { const v = parseFloat(String(t).replace(",", ".")); return isFinite(v) && v > 0 ? rh(v, 1) : null; };   // XIC fields: one decimal only
const fmz = v => String(rh(v, 1));                   // 363.8, 364 (no trailing zeros)
// THE tool that extracts an ion (XIC). The student gives ONE m/z value, or the NEUTRAL formula plus the adduct; the window is always a unit window (1 Da, unit resolution)
// anchored to the nominal mass n of the calculated value: [n - XIC_BELOW, n + 1 - XIC_BELOW]. Every way to create an XIC (XIC button, warning when integrating from a TIC,
// right click on a chromatogram, on a spectrum, on the RT-m/z map, Calcolatrice m/z, Disegno) opens this window, possibly pre-filled:
//   pre = { mz, obs }   one m/z value (obs = it is an OBSERVED centroid, so the calibration drift is taken off before the nominal mass is found)   pre = { formula, adduct }
const TIP_DELAY = 1250;   // ms before the label of a button appears (one value for the whole program; 1500 before 7 Oct 2026)
const XIC_BELOW = 0.2;   // the unit window starts 0.2 Da under the nominal mass n and ends 0.8 Da over it: [n-0.2, n+0.8]. The centroids of the lab files sit +0.14..+0.37 Da over the calculated m/z (AGENTS.md, 6 Oct 2026), so a window [n-0.5, n+0.5] would lose every ion whose mass defect plus drift passes +0.5 (e.g. calc n+0.2 observed up to n+0.57), while [n-0.2, n+0.8] keeps them with 0.13+ Da of margin and still leaves out the neighbours (n-1 observed <= n-0.3, n+1 observed >= n+1.04)
const XIC_DRIFT = 0.25;  // mean offset (Da) of the observed centroids over the calculated m/z, used only to go from a CLICKED centroid back to the calculated nominal mass (364.37 -> 364.12 -> n = 364, not 365)
const xicNominal = (v, obs) => Math.round(obs ? v - XIC_DRIFT : v);
const xicWin = (v, obs) => { const n = xicNominal(v, obs); return [rh(n - XIC_BELOW, 1), rh(n + 1 - XIC_BELOW, 1)]; };
let XIC_LAST = null;       // the last ion the student asked for ({mz} or {formula, adduct}): the window opens with it, still editable
// Right click on a peak of the spectrum: the XIC appears at once, with the default unit window and no dialog; the window is changed afterwards from the header of the XIC panel.
function xicDirect(mz, after, panel) {
  const [a, b] = xicWin(mz, true), c = rh((a + b) / 2, 2), w = rh((b - a) / 2, 2), lab = `m/z ${fmz(a)}-${fmz(b)}`;
  XIC_LAST = { mz };
  if (panel && E.panels.includes(panel)) { addTrace(panel, c, lab, w); reveal(panel); return panel; }
  const np = addPanel("xic", { traces: [{ id: E.seq++, mz: c, w, label: lab }] });
  if (after && E.panels.includes(after)) { stackAfter(np, after); relayout(); fitHost(); }
  reveal(np); return np;
}
const xicName = q => { const t = q.traces[0]; return t ? "m/z " + (t.w != null ? Math.round(t.mz - (0.5 - XIC_BELOW)) : fmz(t.mz)) + (q.traces.length > 1 ? " +" + (q.traces.length - 1) : "") : "vuoto"; };
// Estrai ioni (XIC): a list of rows (2 at the start, up to 10), each one an m/z or a neutral formula (+ adduct); all the ions go into the SAME panel, one trace per ion.
const XIC_MAXROWS = 10, XIC_ADDUCTS = ["[M+H]+", "[M+NH4]+", "[M+Na]+", "[M+K]+", "[M-H]-", "[M+Cl]-", "[M+HCOO]-"];
function openXic(panel, pre = {}) {
  if (!pre.formula && pre.mz == null && XIC_LAST) pre = { ...XIC_LAST, ...pre };
  const d = Q("#xicdlg"), host = Q("#xic-rows"), err = Q("#xic-err"), fsel = Q("#xic-file"), addB = Q("#xic-add");
  const dAd = pre.adduct || defAdduct(panel && E.panels.includes(panel) ? scanFiles(shown()) : undefined);
  const rows = [];
  const isNum = t => /^[\d.,\s]+$/.test(t);
  const renumber = () => {
    rows.forEach((r, i) => { r.lab.textContent = i === 0 ? "Ione 1" : `Ione ${i + 1} (facoltativo)`; r.x.hidden = rows.length < 2; r.inp.placeholder = i === 0 ? "m/z (es. 364.1) o formula (es. C9H10Cl2N2O)" : "facoltativo"; r.inp.id = i === 0 ? "xic-mz" : ""; r.ad.id = i === 0 ? "xic-ad" : ""; r.sum.id = i === 0 ? "xic-sum" : ""; });
    addB.disabled = rows.length >= XIC_MAXROWS;
  };
  const evalRow = r => {
    const t = r.inp.value.trim(), ed = ++r.edits; err.textContent = "";
    r.ad.hidden = !t || isNum(t);
    if (!t) { r.win = null; r.label = ""; r.sum.textContent = ""; r.pending = Promise.resolve(); return; }
    if (isNum(t)) { const v = numMz1(t); r.win = v != null ? xicWin(v, r.obs) : null; r.label = ""; r.sum.innerHTML = r.win ? `<i>m/z</i> ${fmz(r.win[0])} - ${fmz(r.win[1])}` : ""; r.pending = Promise.resolve(); return; }
    r.win = null; r.sum.textContent = "";
    r.pending = (async () => {
      try {
        const f = await getFormula(t, r.ad.value);
        if (ed !== r.edits) return;
        r.label = `${f.formula} ${f.adduct}`; r.win = xicWin(f.mz, false);
        r.sum.innerHTML = (t.replace(/\s+/g, "") !== f.formula ? `interpretata come <b>${fmtFormula(f.formula)}</b>: ` : "") + `<i>m/z</i> ${fmz(r.win[0])} - ${fmz(r.win[1])}`;
      } catch (e) { if (ed === r.edits) r.sum.innerHTML = `<span class="fail">formula non valida</span>`; }
    })();
  };
  const addRow = (init = {}) => {
    const el = document.createElement("div"); el.className = "xrw";
    el.innerHTML = `<label></label><div class="xin"><input class="mzf" autocomplete="off" inputmode="decimal" style="width:auto"><select hidden title="L'addotto trasforma la formula neutra nell'm/z dello ione: [M+H]+ aggiunge un protone">${XIC_ADDUCTS.map(a => `<option ${a === (init.adduct || dAd) ? "selected" : ""}>${a}</option>`).join("")}</select><button class="xr-x" type="button" title="Togli questo ione">&times;</button></div><div class="xr-sum"></div>`;
    const r = { el, lab: el.querySelector("label"), inp: el.querySelector("input"), ad: el.querySelector("select"), x: el.querySelector(".xr-x"), sum: el.querySelector(".xr-sum"), win: null, label: "", obs: !!init.obs, edits: 0, pending: Promise.resolve(), tq: 0 };
    r.inp.value = init.text || "";
    r.inp.oninput = () => { r.obs = false; clearTimeout(r.tq); const t = r.inp.value.trim(); if (!t || isNum(t)) evalRow(r); else { r.ad.hidden = false; r.tq = setTimeout(() => evalRow(r), 500); } };
    r.ad.onchange = () => evalRow(r);
    r.inp.onkeydown = e => { if (e.key !== "Enter") return; e.preventDefault(); const i = rows.indexOf(r); if (i < rows.length - 1) rows[i + 1].inp.focus(); else Q("#xic-go").click(); };
    r.x.onclick = () => { if (rows.length < 2) return; rows.splice(rows.indexOf(r), 1); el.remove(); renumber(); };
    rows.push(r); host.appendChild(el); renumber(); evalRow(r);
    return r;
  };
  host.innerHTML = ""; err.textContent = "";
  const first = pre.formula ? { text: pre.formula, adduct: pre.adduct } : pre.mz != null ? { text: fmz(pre.mz), obs: !!pre.obs } : {};
  addRow(first); addRow();
  addB.onclick = () => { if (rows.length < XIC_MAXROWS) addRow().inp.focus(); };
  const ff = scanFiles(tabFiles(panel && E.panels.includes(panel) ? panel.tab || E.tab : E.tab));
  fsel.innerHTML = `<option value="">i file mostrati</option>` + ff.map(f => `<option value="${f.k}">${EH(f.label)}</option>`).join("");
  Q("#xic-no").onclick = () => d.close();
  Q("#xic-go").onclick = async () => {
    await Promise.all(rows.map(r => r.pending));
    const used = rows.filter(r => r.inp.value.trim());
    if (!used.length) { err.textContent = "Scrivi un valore di m/z oppure la formula neutra."; return; }
    const bad = used.find(r => !r.win); if (bad) { err.textContent = "Una riga non è valida: scrivi un m/z oppure una formula neutra."; bad.inp.focus(); return; }
    const seen = new Set(), traces = [];
    used.forEach(r => {
      const [a, b] = r.win, mz = rh((a + b) / 2, 2), w = rh((b - a) / 2, 2), key = mz + "|" + w; if (seen.has(key)) return; seen.add(key);
      traces.push({ id: E.seq++, mz, w, label: (r.label ? r.label + " · " : "") + `m/z ${fmz(a)}-${fmz(b)}` });
    });
    d.close();
    const r0 = used[0]; XIC_LAST = isNum(r0.inp.value.trim()) ? { mz: numMz1(r0.inp.value) ?? (r0.win[0] + r0.win[1]) / 2 } : { formula: r0.inp.value.trim(), adduct: r0.ad.value };
    let np;
    if (panel && E.panels.includes(panel)) { traces.forEach(t => panel.traces.push(t)); np = panel; ctl(np); }
    else {
      np = addPanel("xic", { traces });
      if (pre.after && E.panels.includes(pre.after)) { stackAfter(np, pre.after); relayout(); fitHost(); }   // from a spectrum: the new XIC sits right under it
    }
    // the file: the one chosen in the window; with more than 3 ions and several files the panel starts on the selected file only (otherwise it is a tangle of lines)
    const keep = fsel.value !== "" ? E.files[+fsel.value] : traces.length > 3 && ff.length > 1 && ff.includes(E.files[E.cur]) ? E.files[E.cur] : null;
    if (keep) ff.forEach(f => { if (f !== keep) traces.forEach(t => { np.hid["x|" + f.k + "|" + t.mz] = true; }); });
    if (np === panel) draw(np); else reveal(np);
  };
  d.showModal();
  rows[0].inp.focus();
}
function splitPanel(p) {
  const rest = p.traces.slice(1); p.traces = p.traces.slice(0, 1); ctl(p); draw(p);
  rest.forEach(t => reveal(addPanel("xic", { traces: [t], tol: p.tol, smooth: p.smooth, mode: p.mode, log: p.log })));
}
function mergeXics() {
  const xs = tabPanels().filter(p => p.type === "xic");
  if (xs.length < 2) return info("Servono almeno due pannelli XIC.");
  const [a, ...rest] = xs;
  rest.forEach(q => { q.traces.forEach(t => a.traces.push(t)); q.el.querySelector(".x").click(); });
  ctl(a); draw(a);
}

// ------------------------------------------------------------------ disegno dei grafici
// ---- corrections applied to the traces: blank subtraction and SNIP baseline (both optional, shown in the legend)
function interp(xs, ys, x) {                                // linear interpolation, 0 outside the blank's time range
  if (!xs.length || x < xs[0] || x > xs[xs.length - 1]) return 0;
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  const dx = xs[hi] - xs[lo]; return dx > 0 ? ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / dx : ys[lo];
}
// SNIP (Morhac 1997; Ryan 1988) with the LLS transform: the baseline is clipped iteratively by the mean of its two neighbours
function snipBaseline(y, w) {
  const n = y.length; if (n < 2 * w + 3) return new Array(n).fill(0);
  let v = y.map(a => Math.log(Math.log(Math.sqrt(Math.max(a, 0) + 1) + 1) + 1));
  for (let m = 1; m <= w; m++) { const t = v.slice(); for (let i = m; i < n - m; i++) { const a = (v[i - m] + v[i + m]) / 2; if (a < t[i]) t[i] = a; } v = t; }
  return v.map(a => { const e = Math.exp(Math.exp(a) - 1) - 1; return e * e - 1; });
}
async function blankTrace(p, s) {
  const b = E.files[+p.bk]; if (!b) return null;
  if (p.type === "xic") { const d = await getXic(b.k, s.mz, (p.traces.find(t => t.id === s.tid) || {}).w ?? p.tol, b.lv); return d && { x: d.rt, y: d.y }; }
  if (p.type === "chrom") { const d = await getChrom(b.k, p.kind, b.lv); return { x: d.rt, y: d.y }; }
  const tr = (await getMrm(b.k)).find(t => `${t.q1}>${t.q3}` === s.ion); return tr && { x: tr.rt, y: tr.y };
}
// ---- internal blank: a stretch of the trace chosen by the student (for example 0-2 min, where nothing elutes) gives the background level, which is
// subtracted from the whole trace. p.ibk = { mode: "mean" | "median" | "line", a: [t0, t1], b: [t0, t1] (line only: second stretch), clip: bool }.
// Not a blank-file subtraction: one number (or a straight line), not a profile in time. The level is computed on each trace (each file) on its own.
const ibkRange = (a, d = 1) => `${+a[0].toFixed(d)}-${+a[1].toFixed(d)} min`;
const ibkText = ib => !ib ? "no" : `sì, ${ibkRange(ib.a)}${ib.mode === "line" && ib.b ? " e " + ibkRange(ib.b) : ""}, ${{ mean: "media", median: "mediana", line: "retta" }[ib.mode]}${ib.clip ? ", negativi a 0" : ""}`;
function ibkFn(s, ib) {
  const stat = (r, med) => { const v = []; s.x.forEach((t, i) => { if (t >= r[0] && t <= r[1]) v.push(s.y[i]); }); if (!v.length) return 0; if (med) { v.sort((p, q) => p - q); return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; } return v.reduce((p, q) => p + q, 0) / v.length; };
  if (ib.mode === "line" && ib.b) {
    const xa = (ib.a[0] + ib.a[1]) / 2, xb = (ib.b[0] + ib.b[1]) / 2, ya = stat(ib.a), yb = stat(ib.b), m = (yb - ya) / ((xb - xa) || 1);
    return { f: x => ya + m * (x - xa), lvl: ya, lvl2: yb };
  }
  const L = stat(ib.a, ib.mode === "median"); return { f: () => L, lvl: L };
}
async function corrected(p, all) {
  const hasBk = p.bk !== "" && p.bk != null && E.files[+p.bk];
  if (!hasBk && !p.snip && !p.ibk) return all;
  const out = [];
  for (const s of all) {
    if (hasBk && s.k === +p.bk) continue;                   // the blank itself is the thing being subtracted
    let y = s.y.slice(), note = [], ibl = null;
    if (p.ibk) { ibl = ibkFn(s, p.ibk); y = y.map((v, i) => { const r = v - ibl.f(s.x[i]); return p.ibk.clip ? Math.max(0, r) : r; }); note.push("- bianco interno"); }
    if (hasBk) { const b = await blankTrace(p, s); if (b) { y = y.map((v, i) => Math.max(0, v - interp(b.x, b.y, s.x[i]))); note.push("- bianco"); } }
    if (p.snip && s.x.length > 5) {
      const dts = s.x.slice(1).map((v, i) => v - s.x[i]).sort((a, b) => a - b), dt = dts[dts.length >> 1] || 0.01;
      const w = Math.max(2, Math.round((p.snipw || 1) / dt / 2)), bl = snipBaseline(y, w);
      y = y.map((v, i) => Math.max(0, v - bl[i])); note.push("- baseline");
    }
    out.push({ ...s, y, corr: note.join(" "), ibl });
  }
  return out;
}
async function seriesOf(p) { return corrected(p, await rawSeries(p)); }
async function rawSeries(p) {
  if (p.type === "chrom") {
    let fl = shown();
    if (p.kind !== "pda" && p.prec != null) fl = fl.filter(f => f.kind !== "ms2" || (f.precursors || []).some(v => Math.abs(v - p.prec) < 0.6));   // an MS2 experiment is a precursor: only the files that have it
    const r = await Promise.all(fl.map(f => getChrom(f.k, p.kind, f.lv, p.kind === "pda" ? null : p.mz0, p.kind === "pda" ? null : p.mz1, p.kind !== "pda" && f.kind === "ms2" ? p.prec : null).then(d => ({ x: d.rt, y: d.y, color: f.color, dash: fdash(f), name: f.label, k: f.k, key: `c|${f.k}|${p.kind}`, ion: p.kind.toUpperCase(), time: f.time }))));
    return r.filter(s => s.x.length);
  }
  const files = shown();
  if (p.type === "xic") {
    const ts = p.traces, out = [];
    scanFiles(files).forEach((f, fi) => ts.forEach((t, ti) => out.push(getXic(f.k, t.mz, t.w ?? p.tol, f.lv).then(d => ({
      x: d.rt, y: d.y, k: f.k, mz: t.mz, tid: t.id, key: `x|${f.k}|${t.mz}`, ion: t.label, time: f.time,
      color: ts.length === 1 ? f.color : PAL[ti % PAL.length], dash: f.type === "blank" ? [4, 3] : ts.length > 1 ? (fi > 0 ? DASHES[fi % 4] : []) : fdash(f),
      name: ts.length === 1 ? f.label : `${t.label} · ${f.label}`, tid_label: t.label })))));
    return Promise.all(out);
  }
  // MRM
  const mf = files.filter(f => f.kind === "mrm"), out = [], seen = new Map();
  const data = await Promise.all(mf.map(f => getMrm(f.k).then(tr => ({ f, tr }))));
  data.forEach(({ tr }) => tr.forEach(t => { const key = `${t.q1}>${t.q3}`; if (!seen.has(key)) seen.set(key, { key, name: t.name || "" }); }));
  const list = [...seen.values()];
  if (JSON.stringify(list) !== JSON.stringify(p._trs)) { p._trs = list; ctl(p); }
  data.forEach(({ f, tr }, fi) => tr.forEach(t => {
    const key = `${t.q1}>${t.q3}`; if (p.tr && p.tr !== key) return;
    const ti = list.findIndex(l => l.key === key), single = !!p.tr;
    out.push({ x: t.rt, y: t.y, k: f.k, key: `m|${f.k}|${t.id}`, ion: key, time: f.time, color: single && mf.length > 1 ? f.color : PAL[ti % PAL.length],
      dash: f.type === "blank" ? [4, 3] : !single && fi > 0 ? DASHES[fi % 4] : single && mf.length > 1 ? fdash(f) : [], name: mf.length > 1 ? `${key} · ${f.label}` : `${key} ${t.name || ""}`.trim(), tid_label: `${key} ${t.name || ""}`.trim() });
  }));
  return out;
}
function axes(g, W, H, x0, x1, ymax, yfmt, o = {}) {
  // o.log: logarithmic y axis from o.lo to ymax; o.stack: no numeric y axis (each trace has its own baseline)
  // o.xt / o.yt: axis titles. No horizontal grid: only the two axes with their ticks (cleaner figures for the report)
  const X = v => M.l + (v - x0) / (x1 - x0) * (W - M.l - M.r), ph = H - M.t - M.b, y0 = o.ymin || 0;   // y0 < 0: signals that go below zero (PDA baseline)
  const Y = o.log ? v => H - M.b - (Math.log10(Math.max(v, o.lo)) - Math.log10(o.lo)) / (Math.log10(ymax) - Math.log10(o.lo)) * ph : v => H - M.b - (v - y0) / (ymax - y0) * ph;
  g.clearRect(0, 0, W, H);
  const yt = o.stack ? [] : o.log ? Array.from({ length: Math.max(0, Math.floor(Math.log10(ymax)) - Math.ceil(Math.log10(o.lo)) + 1) }, (_, i) => Math.pow(10, Math.ceil(Math.log10(o.lo)) + i)) : nice(y0, ymax, Math.max(5, Math.round(ph / 32)));
  frame(g, W, H, nice(x0, x1, o.xn || Math.max(8, Math.round((W - M.l - M.r) / 75))).map(t => [X(t), +t.toFixed(2)]), yt.map(t => [Y(t), yfmt(t)]), o.xt, o.yt);
  if (y0 < 0) { g.save(); g.strokeStyle = css("--line"); g.setLineDash([4, 3]); g.beginPath(); g.moveTo(M.l, Math.round(Y(0)) + .5); g.lineTo(W - M.r, Math.round(Y(0)) + .5); g.stroke(); g.restore(); }   // zero line
  return { X, Y };
}
// axis lines, tick marks, tick labels and titles (shared by all the plots)
function frame(g, W, H, xt, yt, xtitle, ytitle) {
  const ink = css("--muted"); g.save(); g.lineWidth = 1; g.strokeStyle = ink; g.fillStyle = ink; g.font = "11px system-ui";
  g.beginPath(); g.moveTo(M.l + .5, M.t); g.lineTo(M.l + .5, H - M.b + .5); g.lineTo(W - M.r, H - M.b + .5); g.stroke();
  g.textAlign = "right"; for (const [y, lab] of yt) { g.beginPath(); g.moveTo(M.l - 4, Math.round(y) + .5); g.lineTo(M.l, Math.round(y) + .5); g.stroke(); g.fillText(lab, M.l - 6, y + 3.5); }
  g.textAlign = "center"; for (const [x, lab] of xt) { if (x < M.l - 1 || x > W - M.r + 1) continue; g.beginPath(); g.moveTo(Math.round(x) + .5, H - M.b); g.lineTo(Math.round(x) + .5, H - M.b + 4); g.stroke(); g.fillText(lab, x, H - M.b + 15); }
  g.fillStyle = css("--ink"); g.font = "12px system-ui";
  const fnt = t => t === "m/z" ? "italic 12px system-ui" : "12px system-ui";           // m/z is always in italics
  if (xtitle) { g.font = fnt(xtitle); g.fillText(xtitle, (M.l + W - M.r) / 2, H - 6); }
  if (ytitle) { g.font = fnt(ytitle); g.translate(13, (M.t + H - M.b) / 2); g.rotate(-Math.PI / 2); g.fillText(ytitle, 0, 0); }
  g.restore(); g.font = "11px system-ui"; g.lineWidth = 1;
}
// an annotation: a small framed label (panel background, accent border, 12 px text) joined to its point by a thin line; it stays inside the plot and goes to the side when there is no room above
function drawAnn(p, g, a, px, py, W, gap) {
  if (a.x < p._a.x0 || a.x > p._a.x1) return;                       // the annotated point is outside the zoomed range: neither label nor line (they come back when it is in view)
  g.save(); g.font = "12px system-ui"; const tw = g.measureText(a.text).width, w = tw + 12, h = 20;
  let bx = px - w / 2, by = py - gap - h;
  if (by < M.t + 1) { by = Math.max(M.t + 1, Math.min(py - h / 2, p._a.H - M.b - h - 1)); bx = px + 14; if (bx + w > W - M.r) bx = px - 14 - w; }       // no room above: to the side
  bx = Math.max(M.l + 2, Math.min(W - M.r - w - 2, bx));
  const ex = Math.max(bx, Math.min(bx + w, px)), ey = by + h < py ? by + h : (by > py ? by : by + h / 2);                       // where the thin line meets the box
  g.strokeStyle = css("--muted"); g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, py - 4); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);       // thin, grey, dashed, 4 px above the tip: never the colour of the trace (it would look like a taller peak)
  const r = 4; g.beginPath(); g.moveTo(bx + r, by); g.lineTo(bx + w - r, by); g.quadraticCurveTo(bx + w, by, bx + w, by + r); g.lineTo(bx + w, by + h - r); g.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h); g.lineTo(bx + r, by + h); g.quadraticCurveTo(bx, by + h, bx, by + h - r); g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by); g.closePath();
  g.fillStyle = css("--panel"); g.fill(); g.strokeStyle = css("--muted"); g.stroke();
  g.fillStyle = css("--ink"); g.textAlign = "left"; g.fillText(a.text, bx + 6, by + 14);
  g.restore();
  (p._a.lbls = p._a.lbls || []).push({ x: bx, y: by, w, h, ann: a, tip: `<b>${EH(a.text)}</b><div class="sm">Doppio clic: modifica · tasto destro: azioni</div>` });
}
const XT_RT = "Tempo di ritenzione (min)", YT_I = "Intensità (cps)";
async function draw(p) {
  if (!p.cv.clientWidth || p.cv.clientWidth < 30) return;
  try { const r = p.type === "spec" ? await drawSpec(p) : p.type === "map" ? await drawMap(p) : await drawLines(p); if (r === false) return; afterDraw(p); if (p.tl) syncT(p); uiSave(); } catch (e) { p.rd.textContent = "errore: " + e.message; }
}
const MSG = { xic: "Scrivi un m/z qui sopra, oppure clic destro su un picco dello spettro.", chrom: "Nessun file visibile (o nessun cromatogramma in questo tipo di file).", mrm: "Nessun file MRM visibile." };
const isHid = (p, s) => !!(p.hid && (p.hid[s.key] || (s.mz != null && p.hid["t" + s.mz])));

// the one "Correzione" menu of a chromatogram / XIC / MRM panel: none | a blank file | the background of a stretch (mean) | automatic baseline. One at a time.
function setCorr(p, v) {
  p.bk = ""; p.snip = false; p._pickIbk = false;
  if (v !== "tract") p.ibk = null;
  if (v[0] === "f") p.bk = +v.slice(1);
  else if (v === "snip") p.snip = true;
  else if (v === "tract" && !p.ibk) {
    if (p.sel && p.sel[1] > p.sel[0]) { ibkSet(p, "mean", [...p.sel]); p.sel = null; }
    else { p._pickIbk = true; info("Trascina sul grafico un tratto senza picchi: se ne sottrae la media."); }
  }
  ctl(p); draw(p); uiSave();
}
function ibkChip(p) {
  if (!p.ibk) return;
  const ib = p.ibk, sr = p._a && p._a.sr, l0 = sr && sr[0] && sr[0].ibl;
  const chip = document.createElement("span"); chip.className = "ibk";
  chip.title = ("Fondo di un tratto: un solo numero (la media del tratto scelto) tolto a tutta la traccia. Non è la sottrazione di un file bianco, che segue il tempo. Vale se il fondo è piatto e il tratto non contiene l'analita; se il fondo sale, usa la linea di base automatica.");
  chip.innerHTML = `<b>fondo del tratto</b> ${ibkRange(ib.a)}${ib.mode === "line" && ib.b ? " e " + ibkRange(ib.b) : ""}: ${l0 ? fmtA(l0.lvl) + (l0.lvl2 != null ? " e " + fmtA(l0.lvl2) : "") + " cps" : ""} (${{ mean: "media", median: "mediana", line: "retta" }[ib.mode]}) <label><input type="checkbox" data-ib="clip" ${ib.clip ? "checked" : ""}> negativi a 0</label> <button data-ib="spec" title="Sottrae lo spettro medio dello stesso tratto dagli spettri di questo cromatogramma">sottrai lo spettro</button> <button data-ib="off">Rimuovi</button>`;
  chip.querySelector("[data-ib=clip]").onchange = e => { ib.clip = e.target.checked; draw(p); uiSave(); };
  chip.querySelector("[data-ib=spec]").onclick = () => ibkSpectra(p);
  chip.querySelector("[data-ib=off]").onclick = () => { p.ibk = null; draw(p); uiSave(); };
  p.leg.appendChild(chip);
}
// the spectra of this chromatogram: subtract the mean spectrum of the blank stretch (same file), as Analyst/MassLynx do
function ibkSpectra(p) {
  const ib = p.ibk; if (!ib) return;
  const sp = E.panels.filter(q => q.type === "spec" && (q.link === p.id || q.src === p.id));
  if (!sp.length) return info("Nessuno spettro collegato a questo cromatogramma: fai prima un doppio clic sul picco.");
  sp.forEach(q => { q.bg = "w"; q.bw0 = ib.a[0]; q.bw1 = ib.a[1]; ctl(q); draw(q); }); uiSave();
}
function ibkSet(p, mode, a, b) {
  if (!(a && a[1] > a[0])) return info("L'intervallo del bianco deve avere un inizio minore della fine.");
  p.ibk = { mode, a: [a[0], a[1]], b: b ? [b[0], b[1]] : null, clip: p.type === "chrom" && p.kind === "tic" };
  p._ibkA = null; draw(p); uiSave();
}
function ibkPick(p, mode, iv) {
  if (mode === "line") { if (!p._ibkA) { p._ibkA = iv; info(`Primo tratto: ${ibkRange(iv, 2)}. Ora scegli il secondo tratto con lo stesso comando (clic destro, «Bianco interno: retta»).`); return; } ibkSet(p, "line", p._ibkA, iv); }
  else ibkSet(p, mode, iv);
}
function ibkMenuItems(p) {
  const it = [], iv = p.sel && p.sel[1] > p.sel[0] ? p.sel : null;
  if (iv && !p.ibk) it.push({ label: "Sottrai il fondo di questo tratto", fn: () => { p.bk = ""; p.snip = false; ibkSet(p, "mean", [...iv]); p.sel = null; ctl(p); draw(p); } });
  if (p.ibk) it.push({ label: "Togli il fondo del tratto", fn: () => { p.ibk = null; ctl(p); draw(p); uiSave(); } });
  return it;
}
function legend(p, all, note = "") {
  const sw = c => `<i style="background:${c}"></i>`, off = h => (h ? " off" : "");
  if (p.type === "xic") {
    // one trace: the trace is in the title of the panel and the legend lists only the files; several traces: two levels, the traces in bold, then the files
    const files = scanFiles(shown()), one = p.traces.length === 1;
    const dsw = (c, d) => d && d.length ? `<i style="background:repeating-linear-gradient(90deg,${c} 0 4px,transparent 4px 7px)"></i>` : sw(c);
    const trs = one ? "" : `<span class="lvl">` + p.traces.map(t => `<span class="tr${off(p.hid["t" + t.mz])}"><span class="tg" data-h="t${t.mz}" title="Clic: mostra o nascondi">${sw(PAL[p.traces.indexOf(t) % PAL.length])}</span><b data-t="${t.id}" title="Doppio clic per rinominare">${fmtFormula(t.label)}</b> ${t.w == null ? `<span>(${t.mz} ±${p.tol})</span>` : ""}<button data-r="${t.id}" title="Togli questo ione">&times;</button></span>`).join("") + `</span>`;
    const fl = files.map((f, fi) => one ? `<span class="tg${off(p.hid["x|" + f.k + "|" + p.traces[0].mz])}" data-h="x|${f.k}|${p.traces[0].mz}" title="Clic: mostra o nascondi">${sw(f.color)}${EH(f.label)}${legPol(f)}</span>`
      : `<span class="tg${off(p.hid["x|" + f.k + "|" + p.traces[0].mz] && p.traces.every(t => p.hid["x|" + f.k + "|" + t.mz]))}" data-hf="${f.k}" title="Clic: mostra o nascondi questo file in tutte le tracce. Il tratto distingue i file (il colore distingue gli ioni)">${dsw("var(--muted)", fi > 0 ? DASHES[fi % 4] : [])}${EH(f.label)}</span>`).join("");
    p.leg.innerHTML = trs + (one ? fl : `<span class="lvl sm">file:</span>${fl}`);
    p.leg.querySelectorAll("[data-hf]").forEach(b => b.onclick = () => { const k = b.dataset.hf, on = p.traces.every(t => p.hid["x|" + k + "|" + t.mz]); p.traces.forEach(t => { if (on) delete p.hid["x|" + k + "|" + t.mz]; else p.hid["x|" + k + "|" + t.mz] = true; }); draw(p); });
  } else p.leg.innerHTML = all.map(s => `<span class="tg${off(isHid(p, s))}" data-h="${s.key}" title="Clic: mostra o nascondi">${sw(s.color)}${EH(s.name)}${legPol(E.files[s.k])}</span>`).join("");
  if (!note && (p.type === "xic" ? p.traces.length <= 1 && scanFiles(shown()).length <= 1 : all.length <= 1)) p.leg.innerHTML = "";      // one file / one trace: the name is already in the header and in the mouse box
  if (note) p.leg.insertAdjacentHTML("beforeend", `<span class="sm">${EH(note)}</span>`);
  p.leg.querySelectorAll("[data-t]").forEach(b => b.ondblclick = async () => { const t = p.traces.find(x => x.id == b.dataset.t), v = await ask("Nome dell'ione", t.label); if (v) { t.label = v; draw(p); } });
  p.leg.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { p.traces = p.traces.filter(x => x.id != b.dataset.r); ctl(p); draw(p); });
  p.leg.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { const k = b.dataset.h; if (p.hid[k]) delete p.hid[k]; else p.hid[k] = true; draw(p); });
  legCollapse(p);
  ibkChip(p);
}
// with many traces the legend would cover the graph: a small chip («7 tracce») and the list when the pointer rests on it
function legCollapse(p) {
  const L = p.leg, n = L.querySelectorAll(".tg").length; if (n <= 4) return;
  const lst = document.createElement("div"); lst.className = "lgl"; [...L.children].forEach(el => lst.appendChild(el));
  const chip = document.createElement("span"); chip.className = "lgc"; chip.textContent = n + " tracce \u25BE";
  L.appendChild(chip); L.appendChild(lst);
}

async function drawLines(p) {
  const all = await seriesOf(p);
  const { g, W, H } = setup(p.cv);
  const sr = all.filter(s => !isHid(p, s));
  if (!sr.length) {
    g.clearRect(0, 0, W, H); g.fillStyle = css("--muted"); g.fillText(all.length ? "Tutte le tracce sono nascoste: clicca la legenda per mostrarle." : MSG[p.type], M.l, 30);
    p._a = null; if (all.length) legend(p, all); else p.leg.innerHTML = ""; return;
  }
  let lo = Infinity, hi = -Infinity;
  for (const s of sr) { lo = Math.min(lo, s.x[0]); hi = Math.max(hi, s.x[s.x.length - 1]); }
  const x0 = p.zoom ? p.zoom[0] : lo, x1 = p.zoom ? p.zoom[1] : hi;
  sr.forEach(s => { s.ys = smooth(s.y, p.smooth ? 3 : 0); let m = 1e-9; for (let i = 0; i < s.x.length; i++) if (s.x[i] >= x0 && s.x[i] <= x1 && s.ys[i] > m) m = s.ys[i]; s.mx = m; });
  const stk = p.mode === "stk", cas = p.mode === "cas" && sr.length > 1 && !p.log, logy = !!p.log && !stk && !cas && p.kind !== "pda", G = Math.max(...sr.map(s => s.mx));
  // unità del grafico: sovrapposti = intensità; impilati = riga i + frazione dell'altezza (scala comune)
  sr.forEach((s, i) => { s.off = stk ? i : 0; s.sc = stk ? G / 0.92 : 1; });
  const U = (s, v) => s.off + v / s.sc;
  const yzf = !!p.zoomY && !stk && !logy;                       // y zoom (box, or drag on the numbers at the left of the axis): tall peaks are cut at the top
  let ymax = stk ? sr.length : G * (p.ints.length ? 1.2 : 1.08);   // room above the peaks for the area labels
  const ymaxAuto = ymax;
  let ymin = 0;                                          // PDA and baseline-corrected traces can be negative: extend the axis instead of drawing outside it
  if (!stk && !logy) for (const s of sr) for (let i = 0; i < s.x.length; i++) if (s.x[i] >= x0 && s.x[i] <= x1 && s.ys[i] < ymin) ymin = s.ys[i];
  if (ymin < 0) ymin *= 1.08;
  const yfull = [ymin, ymaxAuto];
  if (yzf) { ymin = p.zoomY[0]; ymax = p.zoomY[1]; }
  const lo10 = Math.pow(10, Math.max(0, Math.floor(Math.log10(ymax)) - 4));
  const yt = stk ? "Intensità (righe separate)" : logy ? YT_I + ", scala log" : p.kind === "pda" && p.type === "chrom" ? "Segnale PDA (unità del file)" : YT_I;
  // waterfall: the traces are ordered by time (the first one in front), each moved up and a little to the right; the room is taken from the axes
  const pw0 = W - M.l - M.r, ph0 = H - M.t - M.b;
  const cs = cas ? sr.slice().sort((a, b) => ((E.files[a.k] || {}).time ?? 1e9) - ((E.files[b.k] || {}).time ?? 1e9) || a.k - b.k) : null;
  const dxs = cas ? Math.min(16, pw0 * 0.22 / cs.length) : 0, dys = cas ? Math.min(28, ph0 * 0.5 / cs.length) : 0;
  const x1v = cas ? x0 + (x1 - x0) * pw0 / (pw0 - dxs * (cs.length - 1)) : x1;
  if (cas) ymax = ymax * ph0 / (ph0 - dys * (cs.length - 1));
  const { X, Y } = axes(g, W, H, x0, x1v, ymax, fmt, { log: logy, lo: lo10, stack: stk, xt: XT_RT, yt, ymin });
  const ph = H - M.t - M.b;
  p._a = { x0, x1: x1v, cas, X, Y, W, H, sr, ymax, ymin, yfull, U, stk, logy, full: [lo, hi], yinv: py => ymin + (H - M.b - py) / ph * (ymax - ymin) };
  if (p.ibk && !p._exp) {                                    // grey band(s) of the internal blank, always visible
    const ib = p.ibk, bands = [ib.a].concat(ib.mode === "line" && ib.b ? [ib.b] : []), s0 = sr[0], l0 = s0 && s0.ibl;
    g.fillStyle = "rgba(120,120,120,.22)"; bands.forEach(b => { const xa = Math.max(X(b[0]), M.l), xb = Math.min(X(b[1]), W - M.r); if (xb > xa) g.fillRect(xa, M.t, xb - xa, H - M.t - M.b); });
    g.font = "11px system-ui"; g.textAlign = "left"; g.fillStyle = css("--muted");
    g.fillText(`bianco interno ${ibkRange(ib.a)}${ib.mode === "line" && ib.b ? " e " + ibkRange(ib.b) : ""}: ${l0 ? fmtA(l0.lvl) + (l0.lvl2 != null ? " e " + fmtA(l0.lvl2) : "") + " cps" : ""}${sr.length > 1 ? " (prima traccia)" : ""}`, Math.max(M.l + 6, X(ib.a[0]) + 4), H - M.b - 6);
  }
  if (p.sel && !p._exp) { g.fillStyle = "rgba(43,92,138,.10)"; g.fillRect(X(p.sel[0]), M.t, X(p.sel[1]) - X(p.sel[0]), H - M.t - M.b); }
  if (stk) {
    g.font = "11px system-ui"; g.textAlign = "left";
    sr.forEach(s => { const y = Y(s.off); g.strokeStyle = css("--line"); g.beginPath(); g.moveTo(M.l, y); g.lineTo(W - M.r, y); g.stroke(); const t = s.name.length > 34 ? s.name.slice(0, 33) + "…" : s.name; g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = css("--panel"); g.strokeText(t, M.l + 4, y - 4); g.fillStyle = s.color; g.fillText(t, M.l + 4, y - 4); g.lineWidth = 1; });
  }
  g.save(); g.beginPath(); g.rect(M.l + 1.5, M.t - 1, W - M.l - M.r - 1.5, H - M.t - M.b + 2); g.clip();   // the line (1.8 px wide) must not overdraw the y axis
  if (cas) {                                                     // back to front: white under every trace, so the ones behind are covered
    for (let k = cs.length - 1; k >= 0; k--) {
      const s = cs[k], sx = k * dxs, sy = -k * dys, f = E.files[s.k] || {}; let first = null, last = null;
      g.beginPath();
      s.x.forEach((r, i) => { if (r < x0 || r > x1) return; const px = X(r) + sx, py = Y(U(s, s.ys[i])) + sy; if (!first) { first = px; g.moveTo(px, Y(0) + sy); } g.lineTo(px, py); last = px; });
      if (first == null) continue;
      g.lineTo(last, Y(0) + sy); g.closePath(); g.fillStyle = css("--panel"); g.fill();
      g.strokeStyle = s.color; g.lineWidth = 1.6 + LWX(); g.setLineDash(s.dash); g.stroke(); g.setLineDash([]);
      g.fillStyle = s.color; g.font = "bold 11px system-ui"; g.textAlign = "left"; g.fillText(f.time != null ? `t = ${f.time} min` : s.name, first + 4, Y(0) + sy - 4);       // the time next to each trace
    }
    g.font = "11px system-ui";
  } else for (const s of sr) {
    g.strokeStyle = s.color; g.lineWidth = (s.dash.length ? 1.5 : 1.8) + LWX(); g.setLineDash(s.dash); g.beginPath(); let st = false;
    s.x.forEach((r, i) => { if (r < x0 || r > x1) return; const px = X(r), py = Y(U(s, s.ys[i])); st ? g.lineTo(px, py) : g.moveTo(px, py); st = true; });
    g.stroke();
  }
  g.restore(); g.setLineDash([]);
  p._a.tri = [];
  if (p.ms2tri && p.tab === "full") for (const s of sr) {              // MS2 events of the same physical file: a small triangle at the top at every MS2 scan
    const base = (E.files[s.k] || {}).file; if (!base) continue;
    const sib = E.files.find(x => x.ms2_events && x.file.split("#")[0] === base.split("#")[0]); if (!sib) continue;
    g.fillStyle = s.color; let last = -9;
    for (const [rt, prec] of sib.ms2_events) {
      if (rt < x0 || rt > x1) continue; const px = X(rt); if (px - last < 3) continue; last = px;
      g.beginPath(); g.moveTo(px - 3, M.t + 1); g.lineTo(px + 3, M.t + 1); g.lineTo(px, M.t + 8); g.closePath(); g.fill();
      p._a.tri.push({ px, rt, prec, k2: sib.k });
    }
  }
  if (yzf) for (const s of sr) {                                  // a small triangle at the top says: this peak goes on above the graph
    let seg = null; const tri = x => { g.fillStyle = s.color; g.beginPath(); g.moveTo(X(x) - 4, M.t + 7); g.lineTo(X(x) + 4, M.t + 7); g.lineTo(X(x), M.t); g.closePath(); g.fill(); };
    s.x.forEach((r, i) => { if (r < x0 || r > x1) return; const v = U(s, s.ys[i]); if (v > ymax) { if (!seg || v > seg.v) seg = { v, x: r }; } else if (seg) { tri(seg.x); seg = null; } });
    if (seg) tri(seg.x);
  }
  for (const it of cas ? [] : p.ints) {                          // integrazioni: area colorata + barre trascinabili ai bordi (not in the waterfall view)
    const s = sr.find(q => q.key === it.key); if (!s) continue;
    if (it.noise && !p._exp) { g.fillStyle = "rgba(120,120,120,.18)"; const xa = Math.max(X(it.noise[0]), M.l), xb = Math.min(X(it.noise[1]), W - M.r); if (xb > xa) g.fillRect(xa, M.t, xb - xa, H - M.t - M.b); }       // noise stretch (for S/N)
    const r = integ(s, it.a, it.b); Object.assign(it, { area: r.area, height: r.height, rt: r.rt, ibk: ibkText(p.ibk) });
    const i0 = nearIdx(s.x, Math.min(it.a, it.b)), i1 = nearIdx(s.x, Math.max(it.a, it.b));
    if (i1 > i0) {
      const chosen = it.id === p.isel && !p._exp;                      // the selected peak: stronger fill and outline
      g.globalAlpha = chosen ? 0.5 : 0.28; g.fillStyle = s.color; g.beginPath(); g.moveTo(X(s.x[i0]), Y(U(s, s.ys[i0])));
      for (let j = i0; j <= i1; j++) g.lineTo(X(s.x[j]), Y(U(s, s.ys[j])));
      g.lineTo(X(s.x[i1]), Y(U(s, s.ys[i1]))); g.closePath(); g.fill(); g.globalAlpha = 1;
      if (chosen) { g.strokeStyle = s.color; g.lineWidth = 2.5; g.stroke(); }
      g.strokeStyle = s.color; g.lineWidth = 1; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(X(s.x[i0]), Y(U(s, s.ys[i0]))); g.lineTo(X(s.x[i1]), Y(U(s, s.ys[i1]))); g.stroke(); g.setLineDash([]);
    }
    g.strokeStyle = s.color; g.lineWidth = 2.2;
    for (const e of ["a", "b"]) { const px = X(it[e]); g.beginPath(); g.moveTo(px, M.t + 10); g.lineTo(px, H - M.b); g.stroke(); g.fillStyle = s.color; g.fillRect(px - 4, M.t, 8, 12); }
    const ay = Math.max(M.t + 28, Y(U(s, s.ys[nearIdx(s.x, r.rt)])) - 20), lab = "A = " + fmtA(r.area) + (sr.length > 1 ? " · " + s.name : "");   // clearly above the apex, never on the peak
    g.font = "bold 11px system-ui"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = css("--panel"); g.strokeText(lab, X(r.rt), ay); g.fillStyle = css("--ink"); g.fillText(lab, X(r.rt), ay); g.lineWidth = 1;
    const lw = g.measureText(lab).width; (p._a.lbls = p._a.lbls || []).push({ x: X(r.rt) - lw / 2 - 3, y: ay - 13, w: lw + 6, h: 16, tip: `<b>Area</b> ${fmtFull(r.area)} <span class="sm">conteggi·s</span><div class="sm">Tasto destro: azioni</div>` }); g.font = "11px system-ui";
  }
  // the cursor line is not part of the canvas: it is a thin overlay (cursorLine), so the arrows move it without redrawing the chromatogram (and it never enters a PNG)
  for (const a of p.anns) {
    let top = 0; sr.forEach(s => { const i = nearIdx(s.x, a.x); top = Math.max(top, U(s, s.ys[i])); });
    drawAnn(p, g, a, X(a.x), Math.max(M.t + 1, Math.min(H - M.b, Y(top))), W, 26);
  }
  // cosa mostrare quando il mouse passa sul grafico: RT e intensità di ogni traccia visibile in quel punto
  p._a.hov = (px, py) => {
    const x = xOf(p, px), rows = sr.map(s => ({ s, v: s.ys[nearIdx(s.x, x)] })).sort((a, b) => b.v - a.v);
    return { px, rt: x, html: `<b>RT ${x.toFixed(2)} min</b>` + rows.slice(0, 8).map(r => `<div><i style="background:${r.s.color}"></i>${EH(r.s.name.length > 30 ? r.s.name.slice(0, 29) + "…" : r.s.name)} <b>${fmt(r.v)}</b></div>`).join("") + (rows.length > 8 ? `<div class="sm">... e altre ${rows.length - 8}</div>` : "") };
  };
  legend(p, all, (p.type === "chrom" && p.kind !== "pda" && (p.mz0 != null || p.mz1 != null) ? `solo ioni con m/z ${p.mz0 ?? "min"}-${p.mz1 ?? "max"}. ` : "") + (p.type === "chrom" && p.kind !== "pda" && p.prec && shown().some(f => f.kind === "ms2") ? `MS2: solo precursore ${p.prec}. ` : "") + (all.some(x => x.corr) ? "tracce corrette: " + all.find(x => x.corr).corr + ". " : "") + (stk ? (p.norm ? "ogni riga è normalizzata sul proprio massimo" : "altezza di una riga = " + fmt(G / 0.92) + " (scala comune a tutte le righe)") : ""));
}

// ---- mouse sul grafico: linea verticale + riquadro con i valori; la linea compare anche negli altri pannelli con l'asse RT
const xOf = (p, px) => { const a = p._a; return a.x0 + (px - M.l) / (a.W - M.l - M.r) * (a.x1 - a.x0); };
function hideHover(p) {
  if (p.tip) p.tip.hidden = true; if (p.vl) p.vl.hidden = true;
  E.panels.forEach(q => { if (q.vl && q !== p) q.vl.hidden = true; });
}
function showHover(p, px, py) {
  const a = p._a; if (!a || !a.hov || a.cas || px < M.l || px > a.W - M.r || py < M.t || py > a.H - M.b) return hideHover(p);
  const h = a.hov(px, py); if (!h) return hideHover(p);
  const cv = p.cv, el = p.el;
  p.vl.hidden = !!h.novl; p.vl.style.left = cv.offsetLeft + h.px + "px"; p.vl.style.top = cv.offsetTop + M.t + "px"; p.vl.style.height = a.H - M.t - M.b + "px";
  p.tip.hidden = false; p.tip.innerHTML = h.html;
  const tw = p.tip.offsetWidth, th = p.tip.offsetHeight;
  let l = cv.offsetLeft + px + 14; if (l + tw > el.clientWidth - 4) l = cv.offsetLeft + px - tw - 14;
  let t = cv.offsetTop + py + 12; if (t + th > el.clientHeight - 4) t = Math.max(4, el.clientHeight - th - 4);
  p.tip.style.left = Math.max(2, l) + "px"; p.tip.style.top = t + "px";
  if (h.rt != null) E.panels.forEach(q => {
    if (q === p || q.type === "spec" || !q._a || !q.vl) return;
    const b = q._a;
    if (h.rt < b.x0 || h.rt > b.x1) { q.vl.hidden = true; return; }
    q.vl.hidden = false; q.vl.style.left = q.cv.offsetLeft + b.X(h.rt) + "px"; q.vl.style.top = q.cv.offsetTop + M.t + "px"; q.vl.style.height = b.H - M.t - M.b + "px";
  });
}
// ---- zoom: Ctrl/Cmd + rotella (o pizzico sul trackpad) attorno al cursore; Maiusc + trascina sposta
function clampView(z0, z1, f0, f1) {
  let span = z1 - z0; const full = f1 - f0;
  if (span >= full * 0.999) return null;
  span = Math.max(span, full * 0.002);
  if (z0 < f0) { z1 += f0 - z0; z0 = f0; } if (z1 > f1) { z0 -= z1 - f1; z1 = f1; }
  return [Math.max(f0, z0), Math.min(f1, z1)];
}
// y zoom in data units (bottom, top); back to the whole axis (null) when it covers everything. quiet = no redraw (a box zoom redraws once, with the x zoom)
function zoomYTo(p, lo, hi, quiet) {
  const a = p._a, f = a.yfull;
  lo = Math.max(lo, f[0]); hi = Math.min(hi, f[1]);
  p.zoomY = hi - lo < (f[1] - f[0]) * 1e-4 ? p.zoomY : lo <= f[0] + 1e-9 && hi >= f[1] - 1e-9 ? null : [lo, hi];
  if (p.type === "spec") p.lock = null;
  if (!quiet) draw(p);
}
function zoomTo(p, z0, z1) { const [f0, f1] = p._a.full; p.zoom = clampView(z0, z1, f0, f1); draw(p); }

// ---- mappa RT-m/z (come "Ion Map" di Xcalibur e il visualizzatore 2D di MZmine): ogni pixel è l'intensità media di uno ione in un istante
const RAMP = [[0, [250, 250, 246]], [0.12, [214, 234, 236]], [0.4, [120, 190, 205]], [0.7, [22, 120, 160]], [1, [28, 36, 110]]];
const DIV = [[0, [190, 60, 40]], [0.5, [250, 250, 246]], [1, [30, 90, 190]]];
function lut(stops) {
  const out = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    for (let c = 0; c < 3; c++) out[i * 4 + c] = c0[c] + (c1[c] - c0[c]) * f; out[i * 4 + 3] = 255;
  }
  return out;
}
const LUT_SEQ = lut(RAMP), LUT_DIV = lut(DIV);
const getMap = (k, lv) => memo(`g${k}|${lv}`, () => J(`api/map?k=${k}&level=${lv}`).then(j => {
  const bin = atob(j.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return { ...j, m: new Float32Array(u.buffer) };
}));
// Optional normalisation before the comparison of two experiments: "max" divides each map by its own most intense point, "tic" by the sum of all its intensities
// (shown in parts per thousand). Without it two files acquired with different methods or injected amounts are subtracted in raw counts.
function mapNorm(m, norm) {
  if (norm !== "max" && norm !== "tic") return m;
  let t = 0; for (let i = 0; i < m.length; i++) t = norm === "max" ? Math.max(t, m[i]) : t + m[i];
  const f = t > 0 ? (norm === "max" ? 1 : 1000) / t : 1, o = new Float32Array(m.length); for (let i = 0; i < m.length; i++) o[i] = m[i] * f; return o;
}
function mapImage(p, A, B, scale, norm = "abs") {
  const key = `${A.k}|${B ? B.k : ""}|${scale}|${norm}`;
  if (p._img && p._img.key === key && p._img.a === A.m && p._img.b === (B ? B.m : null)) return p._img;
  const n = A.m.length, v = new Float32Array(n), mA = mapNorm(A.m, norm), mB = B ? mapNorm(B.m, norm) : null;
  for (let i = 0; i < n; i++) v[i] = mB ? mA[i] - mB[i] : mA[i];
  const nz = []; for (let i = 0; i < n; i++) { const a = Math.abs(v[i]); if (a > 0) nz.push(a); }
  nz.sort((a, b) => a - b);
  const ref = nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * 0.995))] : 1;        // 99.5° percentile: un solo picco enorme non appiattisce il resto
  const floor = B ? 0.02 : 0.004;                                                // sotto questa frazione è rumore: resta bianco
  const T = x => { const r = Math.min(1, Math.abs(x) / ref); if (r < floor) return 0; return scale === "lin" ? r : scale === "log" ? Math.log10(1 + 1000 * r) / 3 : Math.sqrt(r); };
  const { nrt, nmz } = A, off = document.createElement("canvas"); off.width = nrt; off.height = nmz;
  const ctx = off.getContext("2d"), im = ctx.createImageData(nrt, nmz), tab = B ? LUT_DIV : LUT_SEQ;
  for (let i = 0; i < nrt; i++) for (let j = 0; j < nmz; j++) {
    const x = v[i * nmz + j], t = T(x), q = B ? Math.round(127.5 + Math.sign(-x) * t * 127.5) : Math.round(t * 255), o = ((nmz - 1 - j) * nrt + i) * 4;
    im.data[o] = tab[q * 4]; im.data[o + 1] = tab[q * 4 + 1]; im.data[o + 2] = tab[q * 4 + 2]; im.data[o + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return (p._img = { key, off, v, ref, T, a: A.m, b: B ? B.m : null });
}
// ---- 3D view of the same map: a surface (RT on one axis, m/z on the other, intensity as height) drawn with the painter's algorithm on the 2D canvas
// (no WebGL, so it works with the strict CSP and everywhere). Each cell is the MAXIMUM of the bins it covers, so no peak disappears when the window is
// coarser than the data. Colours are the same as the 2D map; for a difference the height is signed and the floor is the zero level.
function draw3d(p, g, W, H, A, B, im, f, rf, x0, x1, y0, y1, scaleTxt) {
  const rt0 = A.rt0, rt1 = A.rt1, mzA = A.mz0, dmz = A.dmz, nrt = A.nrt, nmz = A.nmz;
  const ia = Math.max(0, Math.floor((x0 - rt0) / (rt1 - rt0) * nrt)), ib = Math.min(nrt, Math.max(ia + 1, Math.ceil((x1 - rt0) / (rt1 - rt0) * nrt)));
  const ja = Math.max(0, Math.floor((y0 - mzA) / dmz)), jb = Math.min(nmz, Math.max(ja + 1, Math.ceil((y1 - mzA) / dmz)));
  const MAXC = p._rot ? 48 : 96, sx = Math.max(1, Math.ceil((ib - ia) / MAXC)), sy = Math.max(1, Math.ceil((jb - ja) / MAXC));
  const nx = Math.ceil((ib - ia) / sx), ny = Math.ceil((jb - ja) / sy), v = im.v, T = im.T;
  const Z = new Float32Array(nx * ny), C = new Float32Array(nx * ny);          // Z: signed height in [-1, 1] (or 0..1); C: raw value for the colour
  let zmin = 0, zmax = 0;
  for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
    let best = 0;
    for (let i = ia + a * sx; i < Math.min(ib, ia + (a + 1) * sx); i++) for (let j = ja + b * sy; j < Math.min(jb, ja + (b + 1) * sy); j++) { const q = v[i * nmz + j]; if (Math.abs(q) > Math.abs(best)) best = q; }
    const z = best === 0 ? 0 : Math.sign(best) * T(best); Z[a * ny + b] = z; C[a * ny + b] = best; if (z < zmin) zmin = z; if (z > zmax) zmax = z;
  }
  if (!B) zmin = 0; if (zmax === zmin) zmax = zmin + 1;
  const az = (p.az ?? 25) * Math.PI / 180, el = (p.elv ?? 38) * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const zs = 0.55 / Math.max(zmax - Math.min(zmin, 0), 1e-9) * (B ? 1 : 1);       // height of the box about 0.55 of its footprint
  const asp = Math.min(3, Math.max(1, (W - M.l - M.r) / Math.max(1, H - M.t - M.b) * 1.1));       // the floor follows the shape of the panel (wide panel = wide floor)
  const pr = (u, w, z) => { u *= asp; const xr = u * ca - w * sa, d = u * sa + w * ca; return [xr, z * zs * ce + d * se, d * ce - z * zs * se]; };   // [screen x, screen y (up), depth (larger = farther)]
  const corners = []; for (const u of [-.5, .5]) for (const w of [-.5, .5]) for (const z of [zmin, zmax]) corners.push(pr(u, w, z));
  const bx0 = Math.min(...corners.map(c => c[0])), bx1 = Math.max(...corners.map(c => c[0])), by0 = Math.min(...corners.map(c => c[1])), by1 = Math.max(...corners.map(c => c[1]));
  const pw = W - M.l - M.r - 30, ph = H - M.t - M.b - 24, sc = Math.min(pw / (bx1 - bx0), ph / (by1 - by0));
  const ox = M.l + 14 + (pw - (bx1 - bx0) * sc) / 2 - bx0 * sc, oy = M.t + 6 + (ph - (by1 - by0) * sc) / 2 + by1 * sc;
  const P = (u, w, z) => { const r = pr(u, w, z); return [ox + r[0] * sc, oy - r[1] * sc, r[2]]; };
  g.clearRect(0, 0, W, H);
  const ink = css("--muted"); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1; g.font = "11px system-ui";
  // floor
  const fl = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([u, w]) => P(u, w, 0));
  g.fillStyle = "rgba(120,120,120,.07)"; g.beginPath(); fl.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); g.stroke();
  // surface, far cells first
  const cells = []; for (let a = 0; a < nx - 1; a++) for (let b = 0; b < ny - 1; b++) {
    const z = (Z[a * ny + b] + Z[(a + 1) * ny + b] + Z[a * ny + b + 1] + Z[(a + 1) * ny + b + 1]) / 4, u = (a + .5) / (nx - 1) - .5, w = (b + .5) / (ny - 1) - .5;
    cells.push([a, b, pr(u, w, z)[2]]);
  }
  cells.sort((p1, p2) => p2[2] - p1[2]);
  const tab = B ? LUT_DIV : LUT_SEQ, up = (a, b) => P(a / (nx - 1) - .5, b / (ny - 1) - .5, Z[a * ny + b]);
  g.lineWidth = .6;
  for (const [a, b] of cells) {
    const z = (Z[a * ny + b] + Z[(a + 1) * ny + b] + Z[a * ny + b + 1] + Z[(a + 1) * ny + b + 1]) / 4;
    const q = B ? Math.round(127.5 - Math.sign(z) * Math.abs(z) * 127.5) : Math.round(Math.min(1, Math.max(0, z)) * 255);
    const lit = Math.min(1.18, Math.max(0.78, 1 + 2.2 * ((Z[a * ny + b] + Z[a * ny + b + 1]) - (Z[(a + 1) * ny + b] + Z[(a + 1) * ny + b + 1])) / 2)), sh = k => Math.min(255, Math.round(k * lit));     // light from the low-RT side: slopes facing it are brighter
    const col = `rgb(${sh(tab[q * 4])},${sh(tab[q * 4 + 1])},${sh(tab[q * 4 + 2])})`, c0 = up(a, b), c1 = up(a + 1, b), c2 = up(a + 1, b + 1), c3 = up(a, b + 1);
    g.fillStyle = col; g.strokeStyle = col; g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c3[0], c3[1]); g.closePath(); g.fill(); g.stroke();
  }
  // axes: ticks on the two floor edges nearest to the viewer
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1; g.textAlign = "center";
  const wn = pr(0, -.5, 0)[2] < pr(0, .5, 0)[2] ? -.5 : .5, un = pr(-.5, 0, 0)[2] < pr(.5, 0, 0)[2] ? -.5 : .5;
  const r0 = nice(x0, x1, 5).filter(t => t >= x0 && t <= x1), m0 = nice(y0, y1, 5).filter(t => t >= y0 && t <= y1);
  g.beginPath(); fl.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke();
  for (const t of r0) { const u = (t - x0) / (x1 - x0) - .5, q = P(u, wn, 0), o = P(u, wn * 1.08, 0); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(o[0], o[1]); g.stroke(); g.fillText(String(+t.toFixed(2)), o[0], o[1] + (wn < 0 ? 12 : -4)); }
  for (const t of m0) { const w = (t - y0) / (y1 - y0) - .5, q = P(un, w, 0), o = P(un * 1.06, w, 0); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(o[0], o[1]); g.stroke(); g.textAlign = un < 0 ? "right" : "left"; g.fillText(String(Math.round(t)), o[0] + (un < 0 ? -3 : 3), o[1] + 4); g.textAlign = "center"; }
  const tm = P(0, wn * 1.32, 0), ym = P(un * 1.3, 0, 0), zt = P(-.5, -.5, zmax), zb = P(-.5, -.5, B ? zmin : 0);
  g.fillText("RT (min)", tm[0], tm[1] + (wn < 0 ? 18 : -14)); g.save(); g.translate(ym[0], ym[1]); g.fillText("m/z", 0, 4); g.restore();
  g.beginPath(); g.moveTo(zb[0], zb[1]); g.lineTo(zt[0], zt[1]); g.stroke(); g.textAlign = "left"; g.fillStyle = css("--ink"); g.fillText(`altezza e colore = intensità (${scaleTxt})`, M.l, M.t + 8); g.fillStyle = ink;
  const mzAtC = () => (y0 + y1) / 2, centres = [];
  for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) { const q = P(a / (nx - 1) - .5, b / (ny - 1) - .5, Z[a * ny + b]); centres.push({ x: q[0], y: q[1], depth: q[2], v: C[a * ny + b], rt: rt0 + (ia + (a + .5) * sx) / nrt * (rt1 - rt0), mz: mzA + (ja + (b + .5) * sy) * dmz }); }
  p._a = { x0, x1, y0, y1, X: v2 => M.l + (v2 - x0) / (x1 - x0) * (W - M.l - M.r), Y: () => 0, W, H, full: [rt0, rt1], fullY: [mzA, mzA + nmz * dmz], f, mzAt: mzAtC, map: true, is3d: true, hov: (px, py) => {
    let best = null, bd = 18 * 18;                                  // nearest projected cell centre (the one nearer the viewer wins a tie)
    for (const c of centres) { const d = (c.x - px) ** 2 + (c.y - py) ** 2; if (d < bd || (best && d < bd + 40 && c.depth < best.depth)) { bd = Math.min(bd, d); best = c; } }
    if (!best) return null;
    return { px: best.x, rt: null, novl: true, html: `<b>RT ${best.rt.toFixed(2)} min · m/z ${best.mz.toFixed(1)}</b><div>${B ? "differenza" : "intensità media"}: <b>${B && best.v > 0 ? "+" : ""}${fmt(best.v)}</b></div>` };
  } };
}
async function drawMap(p) {
  const { g, W, H } = setup(p.cv);
  const say = t => { g.clearRect(0, 0, W, H); g.fillStyle = css("--muted"); g.fillText(t, M.l, 30); p.leg.innerHTML = ""; p._a = null; };
  const sf = scanFiles(tabFiles(p.tab)); if (!sf.length) return say("Servono file full scan o MS2: i file MRM non hanno scan.");
  let f = E.browse && E.files[E.cur] && E.files[E.cur].kind === p.tab ? E.files[E.cur] : E.files[p.k];
  if (!f || f.kind === "mrm") f = sf[0];
  const lv = f.lv, rf = p.ref !== "" && p.ref != null && E.files[+p.ref] && E.files[+p.ref].kind !== "mrm" && E.files[+p.ref].lv === lv && +p.ref !== f.k ? E.files[+p.ref] : null;
  const A = { ...(await getMap(f.k, lv)), k: f.k }, B = rf ? { ...(await getMap(rf.k, lv)), k: rf.k } : null;
  const im = mapImage(p, A, B, p.scale, p.norm || "abs");
  const rt0 = A.rt0, rt1 = A.rt1, mzA = A.mz0, mzB = A.mz0 + A.nmz * A.dmz;
  const x0 = p.zoom ? p.zoom[0] : rt0, x1 = p.zoom ? p.zoom[1] : rt1, y0 = p.zoomY ? p.zoomY[0] : mzA, y1 = p.zoomY ? p.zoomY[1] : mzB;
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
  const nTxt = { abs: "", max: ", normalizzata al massimo", tic: ", normalizzata al totale (per mille)" }[p.norm || "abs"], scTxt = { sqrt: "radice", lin: "lineare", log: "log" }[p.scale];
  if (p.view === "3d") {
    draw3d(p, g, W, H, A, B, im, f, rf, x0, x1, y0, y1, scTxt);
    const bar3 = B ? "linear-gradient(90deg,rgb(190,60,40),#fafaf6,rgb(30,90,190))" : "linear-gradient(90deg,#fafaf6,rgb(120,190,205),rgb(22,120,160),rgb(28,36,110))";
    p.leg.innerHTML = `<span><i style="background:${f.color}"></i>${EH(f.label)}${B ? " meno " + EH(rf.label) : ""}</span><span class="cbar" style="background:${bar3}"></span><span class="sm">${B ? "differenza: rosso = più intenso nel file mostrato, blu = nel riferimento" : "altezza e colore = intensità media"} (scala ${scTxt}${nTxt})</span><span class="sm">trascina: ruota · Maiusc+trascina: sposta · Ctrl/Cmd+rotella: ingrandisci · per scegliere la zona usa la vista 2D, l'intervallo resta lo stesso</span>`;
    return;
  }
  g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false;
  g.drawImage(im.off, (x0 - rt0) / (rt1 - rt0) * A.nrt, (mzB - y1) / A.dmz, (x1 - x0) / (rt1 - rt0) * A.nrt, (y1 - y0) / A.dmz, M.l, M.t, pw, ph);
  const X = v => M.l + (v - x0) / (x1 - x0) * pw, Yv = v => H - M.b - (v - y0) / (y1 - y0) * ph;
  frame(g, W, H, nice(x0, x1, 8).map(t => [X(t), +t.toFixed(2)]), nice(y0, y1, 6).map(t => [Yv(t), Math.round(t)]), XT_RT, "m/z");
  if (p.sel && !p._exp) { g.fillStyle = "rgba(43,92,138,.16)"; g.fillRect(X(p.sel[0]), M.t, X(p.sel[1]) - X(p.sel[0]), ph); }
  if (p.cur != null && !p._exp) { g.strokeStyle = css("--muted"); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(p.cur), M.t); g.lineTo(X(p.cur), H - M.b); g.stroke(); g.setLineDash([]); }
  const mzAt = py => y1 - (py - M.t) / ph * (y1 - y0);
  p._a = { x0, x1, y0, y1, X, Y: Yv, W, H, full: [rt0, rt1], fullY: [mzA, mzB], f, mzAt, map: true };
  p._a.hov = (px, py) => {
    const rt = xOf(p, px), mz = mzAt(py), i = Math.min(A.nrt - 1, Math.max(0, Math.floor((rt - rt0) / (rt1 - rt0) * A.nrt))), j = Math.min(A.nmz - 1, Math.max(0, Math.floor((mz - A.mz0) / A.dmz)));
    const v = im.v[i * A.nmz + j];
    return { px, rt, html: `<b>RT ${rt.toFixed(2)} min · m/z ${mz.toFixed(1)}</b><div>${B ? "differenza" : "intensità media"}: <b>${B && v > 0 ? "+" : ""}${fmt(v)}</b></div><div class="sm">bin m/z ${(A.mz0 + j * A.dmz).toFixed(0)}-${(A.mz0 + (j + 1) * A.dmz).toFixed(0)}</div>` };
  };
  const bar = B ? "linear-gradient(90deg,rgb(190,60,40),#fafaf6,rgb(30,90,190))" : "linear-gradient(90deg,#fafaf6,rgb(120,190,205),rgb(22,120,160),rgb(28,36,110))";
  p.leg.innerHTML = `<span><i style="background:${f.color}"></i>${EH(f.label)}${B ? " meno " + EH(rf.label) : ""}</span><span class="cbar" style="background:${bar}"></span><span class="sm">${B ? "rosso: più intenso qui · blu: più intenso nel riferimento" : "colore = intensità media (scala " + scTxt + ")"}${nTxt}</span><span class="sm">trascina: spettro su quell'intervallo · clic destro: XIC dell'm/z</span>`;
}

function nearIdx(xs, v) { let lo = 0, hi = xs.length - 1; if (hi < 1) return 0; while (hi - lo > 1) { const m = (lo + hi) >> 1; xs[m] < v ? lo = m : hi = m; } return Math.abs(xs[lo] - v) < Math.abs(xs[hi] - v) ? lo : hi; }

// ------------------------------------------------------------------ integrazione dei picchi
function integ(s, a, b) {
  const xs = s.x, ys = s.y;
  let i0 = nearIdx(xs, Math.min(a, b)), i1 = nearIdx(xs, Math.max(a, b));
  if (i1 - i0 < 1) return { area: 0, height: 0, rt: xs[i0] };
  let ar = 0, mx = -Infinity, at = i0;
  for (let j = i0 + 1; j <= i1; j++) ar += (ys[j] + ys[j - 1]) / 2 * (xs[j] - xs[j - 1]) * 60;
  for (let j = i0; j <= i1; j++) if (ys[j] > mx) { mx = ys[j]; at = j; }
  const e3 = i => { let t = 0, c = 0; for (let j = i - 1; j <= i + 1; j++) if (j >= 0 && j < ys.length) { t += ys[j]; c++; } return t / c; };   // end points of the baseline: mean of 3 points
  const ya = e3(i0), yb = e3(i1), base = (ya + yb) / 2 * (xs[i1] - xs[i0]) * 60;
  const hb = ya + (yb - ya) * (xs[at] - xs[i0]) / ((xs[i1] - xs[i0]) || 1);
  return { area: Math.max(ar - base, 0), height: Math.max(mx - hb, 0), rt: xs[at] };       // conteggi x s, baseline lineare
}
// Automatic peak edges. Savitzky-Golay smoothing (quadratic polynomial fitted in a sliding window: keeps height and width of the peak, unlike a
// moving average) and its first derivative (slope of the same polynomial). The window follows the peak: about 60% of its width at half height
// (found with a coarse smoothing first), so noisy MRM traces sampled every 0.05 s and sparse TIC traces both work. The apex is where the derivative
// goes from + to -. Each edge is where the signal falls below (local baseline + 3% of the peak height, and at least 3 times the noise), or where
// the derivative changes sign again (a valley before the next peak) for a sustained stretch. Baseline = straight line between the two edges (integ()).
function sgFilter(y, m, deriv) {                         // half window m (window 2m+1), edges replicated
  const n = y.length, out = new Array(n), mm = m * (m + 1) * (2 * m + 1) / 3;
  const w = []; for (let j = -m; j <= m; j++) w.push(deriv ? j / mm : 3 * (3 * m * m + 3 * m - 1 - 5 * j * j) / ((2 * m - 1) * (2 * m + 1) * (2 * m + 3)));
  for (let i = 0; i < n; i++) { let v = 0; for (let j = -m; j <= m; j++) v += w[j + m] * y[Math.min(n - 1, Math.max(0, i + j))]; out[i] = v; }
  return out;
}
function autoEdges(s, x) {
  const xs = s.x, n = xs.length, ic = nearIdx(xs, x);
  if (n < 9) return [xs[ic], xs[ic]];
  const dt = (xs[Math.min(n - 1, ic + 50)] - xs[Math.max(0, ic - 50)]) / (Math.min(n - 1, ic + 50) - Math.max(0, ic - 50) || 1) || 0.01;
  const a0 = Math.max(0, nearIdx(xs, x - 2)), a1 = Math.min(n - 1, nearIdx(xs, x + 2)), y = s.y.slice(a0, a1 + 1), N = y.length, c0 = ic - a0;
  const mCoarse = Math.max(2, Math.round(0.03 / dt / 2)), co = sgFilter(y, mCoarse, false);
  const lo = Math.max(0, nearIdx(xs, x - 0.25) - a0), hi = Math.min(N - 1, nearIdx(xs, x + 0.25) - a0);
  let m0 = lo; for (let j = lo; j <= hi; j++) if (co[j] > co[m0]) m0 = j;
  const cmin = Math.min(...co), half = cmin + (co[m0] - cmin) / 2;
  let hl = m0, hr = m0; while (hl > 0 && co[hl] > half) hl--; while (hr < N - 1 && co[hr] > half) hr++;
  const m = Math.max(2, Math.min(60, Math.round((hr - hl) * 0.3)));                         // half window = 30% of FWHM -> window about 60% of FWHM
  const sm = sgFilter(y, m, false), d = sgFilter(y, m, true);
  let k = Math.max(0, m0 - m); const k1 = Math.min(N - 1, m0 + m); for (let j = k; j <= k1; j++) if (sm[j] > sm[k]) k = j;   // apex of the smoothed trace
  const w0 = Math.max(0, k - Math.round(1.2 / dt)), w1 = Math.min(N - 1, k + Math.round(1.2 / dt));
  const res = []; for (let j = w0; j <= w1; j++) res.push(Math.abs(y[j] - sm[j])); res.sort((p, q) => p - q);
  const noise = Math.max(1.4826 * res[res.length >> 1], 1e-12);                             // MAD of the residual = noise sigma
  const low = []; for (let j = w0; j <= w1; j++) low.push(sm[j]); low.sort((p, q) => p - q);
  const base = low[Math.floor(low.length * 0.1)], H = Math.max(sm[k] - base, 0), lim = base + Math.max(0.03 * H, 3 * noise);
  const need = Math.max(2, Math.round(m / 2)), dth = noise / Math.max(m, 1) * 0.3, maxw = Math.round(1.5 / dt);
  const walk = dir => {
    let j = k, bad = 0;
    while (j + dir >= 0 && j + dir < N && Math.abs(j - k) < maxw) {
      const nx = j + dir; j = nx;
      if (sm[nx] <= lim) break;
      bad = (dir < 0 ? d[nx] < -dth : d[nx] > dth) ? bad + 1 : 0;                         // rising again while moving away from the apex
      if (bad >= need) { j = nx - dir * need; break; }
    }
    return j;
  };
  return [xs[a0 + Math.min(walk(-1), k)], xs[a0 + Math.max(walk(1), k)]];
}
// trace to integrate at time x: the clicked row when stacked, otherwise the most intense one
function intSeries(p, x, py) {
  const a = p._a; if (!a || !a.sr || !a.sr.length) return null;
  if (a.stk && py != null) return a.sr[Math.max(0, Math.min(a.sr.length - 1, Math.floor(a.yinv(py))))];
  let best = null;                                       // the trace closest to the click (or the most intense one when the click position is unknown)
  a.sr.forEach(s => { const v = a.U(s, s.ys[nearIdx(s.x, x)]), d = py != null && a.Y ? Math.abs(py - a.Y(v)) : -v; if (!best || d < best.d) best = { d, s }; });
  return best && best.s;
}
// traces to integrate: the one under the click, all the visible ones, or the file chosen in the panel
function intTargets(p, x, py) {
  const a = p._a; if (!a || !a.sr || !a.sr.length) return [];
  if (p.intf === "all") return a.sr.filter(s => !isHid(p, s));
  if (p.intf) { const s = a.sr.find(q => q.key === p.intf); if (s) return [s]; }
  return [intSeries(p, x, py)].filter(Boolean);
}
function refreshIntf(p) {
  const sel = p.el.querySelector('[data-a="intf"]'); if (!sel) return;
  const on = (p.imode === "auto" || p.imode === "man") && p.type !== "chrom" && p._a && p._a.sr && p._a.sr.length > 1;
  sel.hidden = !on; if (!on) return;
  const opts = [["", "traccia cliccata"], ["all", "tutte le tracce"], ...p._a.sr.map(s => [s.key, s.name])], sig = JSON.stringify(opts);
  if (sel._sig !== sig) { sel._sig = sig; sel.innerHTML = opts.map(o => `<option value="${EH(o[0])}">${EH(o[1])}</option>`).join(""); }
  sel.value = p.intf || "";
}
// students integrate only from an XIC (or an MRM transition): the total chromatograms add up every ion, so their area belongs to no compound
function guardInt(p) {
  if (p.type !== "chrom") return true;
  yesno("<b>Da questo cromatogramma non si integra.</b><br>Il TIC, il BPC e il PDA sommano tutti gli ioni: l'area che ne esce non appartiene a nessun composto. Estrai prima lo ione che ti interessa (XIC) con una finestra di <i>m/z</i> stretta attorno all'analita, poi integra il picco nell'XIC.<br><br>Vuoi estrarre un XIC adesso?").then(v => { if (v) openXic(null); });
  return false;
}
// integrations never overlap (same trace and file): at most two peaks touch and share the border (drop line)
const INT_EPS = 1e-6;
let HSEQ = 0;                                                             // order of the undoable actions (zoom and integrations) of the session
const iLo = it => Math.min(it.a, it.b), iHi = it => Math.max(it.a, it.b);
const intClash = (p, key, a, b, skip) => p.ints.find(i => i !== skip && i.key === key && iLo(i) < b - INT_EPS && iHi(i) > a + INT_EPS) || null;
function nearMsg(t) {                                                     // short notice next to the mouse
  let d = Q("#qnote"); if (!d) { d = document.createElement("div"); d.id = "qnote"; d.style.cssText = "position:fixed;z-index:20000;max-width:300px;padding:6px 10px;border-radius:6px;background:#333;color:#fff;font:13px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none"; document.body.appendChild(d); }
  const m = window._mxy || { x: 200, y: 200 }; d.textContent = t; d.hidden = false;
  d.style.left = Math.max(6, Math.min(innerWidth - 310, m.x + 14)) + "px"; d.style.top = Math.max(6, Math.min(innerHeight - 60, m.y + 18)) + "px";
  clearTimeout(d._t); d._t = setTimeout(() => { d.hidden = true; }, 3200);
}
document.addEventListener("mousemove", e => { window._mxy = { x: e.clientX, y: e.clientY }; }, true);
const intSnap = p => JSON.stringify(p.ints);
function pushIh(p, snap) { const h = p.ih = p.ih || []; h.push({ n: ++HSEQ, s: snap || intSnap(p) }); if (h.length > 20) h.shift(); }
function undoInt(p) { const e = p.ih && p.ih.pop(); if (!e) return; p.ints = JSON.parse(e.s); p.isel = null; draw(p); uiSave(); }
function delInts(p, list) { pushIh(p); p.ints = p.ints.filter(i => !list.includes(i)); if (list.some(i => i.id === p.isel)) p.isel = null; draw(p); uiSave(); }
function addInt(p, s, a, b, mirror = true) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (p.type === "mrm") { if (p.ints.some(i => i.key === s.key)) pushIh(p); p.ints = p.ints.filter(i => i.key !== s.key); }       // calibration: one peak per transition and file, a new window replaces the old one
  else {
    if (p.ints.some(i => i.key === s.key && Math.abs(i.a - lo) < 1e-6 && Math.abs(i.b - hi) < 1e-6)) return false;     // same peak clicked twice
    if (intClash(p, s.key, lo, hi)) { nearMsg("Qui c'è già un picco integrato: toglilo prima (clic destro → Elimina)"); return false; }
  }
  if (p.type !== "mrm") pushIh(p);
  const f = E.files[s.k];
  p.ints.push({ id: E.seq++, k: s.k, key: s.key, a: lo, b: hi, name: s.name, ion: s.ion || s.name, file: f ? f.label : "", time: f ? f.time : null, panel: p.title });
  draw(p);
  // MRM: the same window goes to the other transition panels (quantifier and qualifier), where it can still be moved on its own
  if (p.type === "mrm" && mirror) tabPanels().filter(q => q !== p && q.type === "mrm" && q._a && q._a.sr).forEach(q => { const s2 = q._a.sr.find(x => x.k === s.k && x.ion !== s.ion); if (s2) addInt(q, s2, a, b, false); });
  return true;
}
// automatic integration at time x: refused on an integrated peak; next to one it stops at its border (the two peaks touch)
function autoInt(p, s, x) {
  let [l, r] = autoEdges(s, x);
  if (p.type !== "mrm") {
    const c = p.ints.filter(i => i.key === s.key);
    if (c.some(i => iLo(i) + INT_EPS < x && x < iHi(i) - INT_EPS)) { nearMsg("Qui c'è già un picco integrato: toglilo prima (clic destro → Elimina)"); return; }
    c.forEach(i => { if (iHi(i) <= x + INT_EPS) l = Math.max(l, iHi(i)); if (iLo(i) >= x - INT_EPS) r = Math.min(r, iLo(i)); });
    if (r - l < 1e-6) return;
  }
  addInt(p, s, l, r);
}
// integration whose filled area contains the pixel (used to select it with a click)
function intAt(p, px, py) {
  const a = p._a; if (!a || !a.sr || a.stk || a.cas || !a.Y || p.type === "spec" || p.type === "map") return null;
  const x = a.x0 + (px - M.l) / (a.W - M.l - M.r) * (a.x1 - a.x0);
  for (const it of [...p.ints].reverse()) {
    if (x < iLo(it) || x > iHi(it)) continue; const s = a.sr.find(q => q.key === it.key); if (!s) continue;
    if (py >= a.Y(a.U(s, s.ys[nearIdx(s.x, x)])) - 4 && py <= a.H - M.b + 3) return it;
  }
  return null;
}
function intMenuItems(p, x, near, py) {
  const items = [], a = p._a;
  const nearInt = p.ints.find(it => x >= iLo(it) && x <= iHi(it));
  if (nearInt) items.push({ label: "Elimina questa integrazione", fn: () => delInts(p, [nearInt]) });
  if (p.ints.length) items.push({ label: "Elimina tutte le integrazioni di questo pannello", fn: async () => { if (await yesno(`Eliminare le ${p.ints.length} integrazioni di questo pannello?`)) delInts(p, [...p.ints]); } });
  if (nearInt || p.ints.length) items.push("-");
  items.push({ label: "Integra il picco qui", fn: () => { if (!guardInt(p)) return; intTargets(p, x, py).forEach(s => autoInt(p, s, x)); } });
  if (p.sel) items.push({ label: "Integra l'intervallo selezionato", fn: () => { if (guardInt(p)) a.sr.forEach(s => addInt(p, s, p.sel[0], p.sel[1])); } });
  if (p.sel && p.sel[1] > p.sel[0]) items.push({ label: "Ingrandisci l'intervallo selezionato", fn: () => { const [s0, s1] = p.sel; const w = (s1 - s0) * 0.1; zoomTo(p, s0 - w, s1 + w); } });
  return items;
}
function allInts() {
  return E.panels.flatMap(p => p.ints.map(i => { const f = E.files[i.k], std = f && f.type === "standard" && f.conc != null; return { ...i, _p: p, _it: i, panel: p.title, conc: std ? f.conc : null, cunit: std ? f.cunit || "" : "" }; }));      // the concentration is only for standards: the calibration line is made by the student in Excel
}
// optional columns of the integration table (off by default): S/N and the figures of the peak (width at half height, plates, tailing)
const INTOPT = { sn: false, par: false };
function intExtra(r) {
  const p = r._p, it = r._it, s = p && p._a && p._a.sr && p._a.sr.find(q => q.key === it.key);
  const pk = s ? chromPeak(s.x, s.y, r.a, r.b) : null, sd = s && it.noise ? noiseSD(s.x, s.y, it.noise[0], it.noise[1]) : null;
  return { sn: pk && sd ? pk.height / sd : null, noise: !!it.noise, w50: pk ? pk.w50 : null, N: pk ? pk.N : null, T: pk ? pk.tailing : null };
}
function showInts() {
  const rows = allInts().map(r => ({ ...r, ...intExtra(r) }));
  const fx = (v, d) => v == null || !isFinite(v) ? "" : String(+v.toFixed(d));
  const head = ["Pannello", "Traccia", "Campione", "Tempo (min)", "Conc.", "RT inizio", "RT fine", "RT apice", "Area (conteggi·s)", "Altezza"], num = [0, 0, 0, 1, 1, 1, 1, 1, 1, 1];
  const th = (t, n) => `<th${n ? ' class="num"' : ""}>${t}</th>`;
  const hx = (INTOPT.sn ? th("S/N", 1) : "") + (INTOPT.par ? th("w<sub>½</sub> (min)", 1) + th("N (piatti)", 1) + th("Coda (USP, 5%)", 1) : "");
  big("Integrazioni dei picchi", rows.length ? `<div class="bar"><button id="ig-xlsx">${IC_DL}Excel</button>
    <label title="Altezza del picco (sopra la linea di base) diviso la deviazione standard del rumore, misurata in una zona senza picchi che scegli tu"><input type="checkbox" id="ig-sn" ${INTOPT.sn ? "checked" : ""}> S/N</label>
    <label title="Larghezza a metà altezza, numero di piatti teorici N = 5.54 (tR / w½)² e fattore di coda USP a 5% dell'altezza (T = W₀.₀₅ / 2f)"><input type="checkbox" id="ig-par" ${INTOPT.par ? "checked" : ""}> Mostra parametri cromatografici</label></div>
    <table><tr>${head.map((t, i) => th(t, num[i])).join("")}${hx}<th>Bianco interno applicato</th><th></th></tr>` +
    rows.map((r, i) => `<tr><td>${EH(r.panel)}</td><td>${EH(r.ion)}</td><td>${EH(r.file)}</td><td class="num">${r.time ?? ""}</td><td class="num">${r.conc != null ? r.conc + " " + EH(r.cunit) : ""}</td><td class="num">${r.a.toFixed(2)}</td><td class="num">${r.b.toFixed(2)}</td><td class="num">${(r.rt ?? 0).toFixed(2)}</td><td class="num" title="${fmtFull(r.area ?? 0)}">${fmtA(r.area ?? 0)}</td><td class="num">${fmt(r.height ?? 0)}</td>` +
      (INTOPT.sn ? `<td class="num">${r.sn != null ? fx(r.sn, 1) : `<button data-nz="${i}" title="Trascina sul grafico una zona senza picchi vicino al picco: il rumore è la deviazione standard del segnale in quella zona (tolta la deriva)">scegli la zona di rumore</button>`}</td>` : "") +
      (INTOPT.par ? `<td class="num">${fx(r.w50, 3)}</td><td class="num">${r.N != null ? Math.round(r.N) : ""}</td><td class="num">${fx(r.T, 2)}</td>` : "") + `<td>${EH(r.ibk || "no")}</td><td>${intClash(r._p, r.key, r.a, r.b, r._it) ? '<span class="warn" title="Quest\'integrazione si sovrappone a un\'altra della stessa traccia (taccuino vecchio): eliminane una">⚠ sovrapposto</span> ' : ""}<button data-del="${i}" title="Elimina questa integrazione (anche dal grafico)">×</button></td></tr>`).join("") +
    `</table><div class="muted sm">Area: regola dei trapezi con baseline lineare tra i due bordi. Trascina le barre nel pannello per correggere i bordi.</div>`
    : `<div class="muted">Nessuna integrazione. Clic destro su un picco di un cromatogramma, di un XIC o di una transizione MRM e scegli «Integra».</div>`, () => {
    if (!rows.length) return;
    Q("#ig-sn").onchange = e => { INTOPT.sn = e.target.checked; showInts(); };
    Q("#ig-par").onchange = e => { INTOPT.par = e.target.checked; showInts(); };
    Q("#bigbody").querySelectorAll("button[data-del]").forEach(b => b.onclick = () => { const r = rows[+b.dataset.del]; delInts(r._p, [r._it]); showInts(); });
    Q("#bigbody").querySelectorAll("button[data-nz]").forEach(b => b.onclick = () => {
      const r = rows[+b.dataset.nz]; r._p._pickNoise = r._it; Q("#bigdlg").close(); reveal(r._p);
      stepMsg(r._p, "Trascina sul grafico una zona senza picchi, vicino al picco: ne uso la deviazione standard come rumore", true);
    });
    Q("#ig-xlsx").onclick = () => dlx("integrazioni.xlsx", [{ name: "Integrazioni", head: [...INT_HEADS, ...(INTOPT.sn ? ["S/N (altezza / dev. st. del rumore)"] : []), ...(INTOPT.par ? ["w½ (min)", "N (piatti teorici)", "Coda USP (5%)"] : [])],
      rows: rows.map(r => [...INT_COLS.map(c => r[c]), ...(INTOPT.sn ? [r.sn] : []), ...(INTOPT.par ? [r.w50, r.N, r.T] : [])]), widths: [16, 18, 22, 14, 16, 8, 14, 14, 14, 18, 14, 34, 18, 12, 14, 14] }]);
  });
}

// ------------------------------------------------------------------ spettri
async function drawSpec(p) {
  const tok = p._tok = (p._tok || 0) + 1;                // "last one wins": a slower, older request never paints over a newer one
  const say = t => { const { g, W, H: HF } = setup(p.cv); g.clearRect(0, 0, W, HF); g.fillStyle = css("--muted"); g.fillText(t, M.l, 30); p.leg.innerHTML = ""; if (p.leg2) p.leg2.innerHTML = ""; p._a = null; };
  const base = p.all ? shown() : [E.files[E.browse ? E.cur : p.k]];
  const files = scanFiles(base.filter(Boolean));
  if (!files.length) return say("Questo file è MRM: contiene solo cromatogrammi di transizioni, non spettri.");
  if (p.r0 == null) return say("Clicca o trascina sul cromatogramma per scegliere l'intervallo di tempo, oppure usa ← → dopo aver messo il cursore.");
  const bgOf = f => p.bg === "w" ? (p.bw0 != null && p.bw1 != null && p.bw1 > p.bw0 ? [f.k, p.bw0, p.bw1] : null)
    : (p.bg !== "" && p.bg != null && +p.bg !== f.k ? [+p.bg, p.r0, p.r1] : null);
  // scan-by-scan walk (arrows): one file, no background subtraction -> the scan comes from the cache of neighbouring scans, not from a window request
  const one = files.length === 1 && p.si != null && !bgOf(files[0]) && !p._exp;
  if (one && p.lock && p.lock.fresh) await scFetch(files[0].k, p.level, p.prec, p.si - SC_AHEAD, p.si + SC_AHEAD).catch(() => {});   // the axes of the walk look at +-20 scans
  const rel = specRel(p);                                // y axis in % of the highest peak of each scan (default for MS2) or in cps
  const relScale = d => { let mx = 1e-9; for (const v of d.y) if (v > mx) mx = v; const k = 100 / mx; return { ...d, y0: d.y, y: d.y.map(v => v * k), py: d.py ? d.py.map(v => v * k) : d.py }; };
  const data = await Promise.all(files.map(f => (one ? scData(p, f.k) : getSpec(f.k, p.r0, p.r1, p.level, p.prec, bgOf(f))).then(d => ({ f, d: rel ? relScale(d) : d }))));
  if (tok !== p._tok) return false;                      // a newer request is on its way: this one is dropped
  const mzs = data.flatMap(x => x.d.mz);
  if (!mzs.length) return say("Nessuno scan in questo intervallo (per MS2: scegli il precursore e il livello giusto).");
  // everything is known: only now the canvas is cleared and drawn again, in one go (until then the previous spectrum stays on the screen)
  const { g, W, H: HF } = setup(p.cv);
  const H = HF;
  const lineOf = x => x.d.pmz && !p.sticks;                  // a profile file is drawn as a line (the peaks are drawn as bars only if the student asks)
  const inRange = (lo, hi) => Math.max(1e-9, ...data.flatMap(x => { let m = 0; const [mz, y] = lineOf(x) ? [x.d.pmz, x.d.py] : [x.d.mz, x.d.y]; y.forEach((v, i) => { if (mz[i] >= lo && mz[i] <= hi && v > m) m = v; }); return [m]; }));
  // the m/z axis is always the widest range of all the scans of the file(s) (level / precursor of the panel): it only changes with a zoom, another file or another precursor
  const wide = files.reduce((r, f) => { const a = p.level === 2 ? f.mz2_min : f.mz_min, b = p.level === 2 ? f.mz2_max : f.mz_max; return a != null && b != null ? [Math.min(r[0], a), Math.max(r[1], b)] : r; }, [Infinity, -Infinity]);
  const full = wide[0] < wide[1] ? [Math.max(0, wide[0] - 1), wide[1] + 1] : [Math.min(...mzs) - 2, Math.max(...mzs) + 2];
  const x0 = p.zoom ? p.zoom[0] : full[0], x1 = p.zoom ? p.zoom[1] : full[1];
  let ymax = inRange(x0, x1) * 1.12;
  const yfull = ymax;                                     // automatic top of the intensity axis (y zoom is relative to it)
  const lk = p.zoomY ? null : lockSync(p, files[0].k, x0, x1, ymax, inRange, one);   // the lock freezes ONLY the intensity axis while walking over the scans
  if (lk) ymax = lk.ymax;
  let ymin = 0;
  if (p.zoomY) { ymin = p.zoomY[0]; ymax = p.zoomY[1]; }   // zoom of the intensity axis (drag on the numbers at the left of the axis, or box)
  const { X, Y } = axes(g, W, H, x0, x1, ymax, fmt, { xt: "m/z", yt: rel ? "Intensità relativa (%)" : YT_I, xn: Math.max(10, Math.round((W - M.l - M.r) / 48)), ymin });
  const ph = H - M.t - M.b;
  p._a = { x0, x1, X, Y, W, H, data, ymax, ymin, yfull: [0, yfull], yinv: py => ymin + (H - M.b - py) / ph * (ymax - ymin), full };
  p._a.snap = px => {                                      // the peak nearest to a pixel: the top bin around it and the centroid (intensity weighted) of that peak
    let best = null;
    data.forEach(x => x.d.mz.forEach((m, j) => { if (m < x0 || m > x1 || x.d.y[j] <= 0) return; const dd = Math.abs(X(m) - px); if (dd < 14 && (!best || dd < best.dd)) best = { dd, m, j, x }; }));
    if (!best) return null;
    const { mz, y } = best.x.d; let jb = best.j;
    for (let j = 0; j < mz.length; j++) if (Math.abs(mz[j] - best.m) <= 0.35 && y[j] > y[jb]) jb = j;
    let sw = 0, sm = 0; for (let j = 0; j < mz.length; j++) if (Math.abs(mz[j] - mz[jb]) <= 0.5 && y[j] > 0) { sw += y[j]; sm += mz[j] * y[j]; }
    return { m: sw > 0 ? sm / sw : mz[jb], y: y[jb], y0: (best.x.d.y0 || y)[jb], f: best.x.f };
  };
  p._a.hov = px => {                                       // peak nearest to the mouse
    const b = p._a.snap(px); if (!b) return null;
    const rf = p.meas && p.meas.ref != null ? `<div>Δ<i>m/z</i> <b>${Math.abs(b.m - p.meas.ref).toFixed(1)}</b> <span class="sm">da ${p.meas.ref.toFixed(1)}</span></div>` : "";
    return { px: X(b.m), html: `<b>m/z ${b.m.toFixed(2)}</b><div>intensità <b>${rel ? b.y.toFixed(1) + " %" : fmt(b.y)}</b>${rel ? ` <span class="sm">(${fmt(b.y0)} cps)</span>` : ""}</div>${data.length > 1 ? `<div class="sm">${EH(b.f.label)}</div>` : ""}${rf}` };
  };
  g.save(); g.beginPath(); g.rect(M.l, M.t - 1, W - M.l - M.r, H - M.t - M.b + 1); g.clip();     // bars taller than the (magnified) graph end at the top edge
  data.forEach(x => {
    g.strokeStyle = x.f.color; g.lineWidth = 1.4 + LWX(); g.beginPath();
    if (lineOf(x)) {                                                     // profile: continuous line with a light fill under it
      const pm = x.d.pmz, py = x.d.py; let on = false;
      pm.forEach((m, j) => { if (m < x0 - 0.5 || m > x1 + 0.5) return; if (!on) { g.moveTo(X(m), Y(py[j])); on = true; } else g.lineTo(X(m), Y(py[j])); });
      g.stroke(); if (on) { g.save(); g.lineTo(X(Math.min(x1 + 0.5, pm[pm.length - 1])), Y(0)); g.lineTo(X(Math.max(x0 - 0.5, pm[0])), Y(0)); g.closePath(); g.globalAlpha = 0.12; g.fillStyle = x.f.color; g.fill(); g.restore(); }
      g.beginPath();
    } else x.d.mz.forEach((m, j) => { if (m < x0 || m > x1) return; g.moveTo(X(m), Y(0)); g.lineTo(X(m), Y(x.d.y[j])); }); g.stroke();
    g.fillStyle = x.f.color;                                          // a small triangle on every cut bar
    x.d.mz.forEach((m, j) => { if (m < x0 || m > x1 || x.d.y[j] <= ymax) return; g.beginPath(); g.moveTo(X(m) - 4, M.t + 7); g.lineTo(X(m) + 4, M.t + 7); g.lineTo(X(m), M.t); g.closePath(); g.fill(); });
  });
  g.restore();
  const d0 = data[0].d, pk = [];
  const top0 = Math.max(...d0.y, 1e-9), thr = (p.thr ?? 5) / 100 * top0, NL = p.nlab ?? 10, DEC = p.dec ?? 1;       // labels: only the peaks above the threshold, at most NL
  d0.mz.forEach((m, j) => { if (m >= x0 && m <= x1 && d0.y[j] >= thr && d0.y[j] <= ymax) pk.push([m, d0.y[j]]); });
  pk.sort((a, b) => b[1] - a[1]); const used = [];
  g.fillStyle = css("--ink"); g.textAlign = "center"; g.font = "10.5px system-ui";
  const lbls = []; p._a.lbls = lbls;                      // clickable labels: hover draws a small box, right click opens the menu
  for (const [m, y] of pk.slice(0, 40)) { const px = X(m); if (used.some(u => Math.abs(u - px) < 26) || used.length >= NL) continue; used.push(px); const t = m.toFixed(DEC), w = g.measureText(t).width; g.fillText(t, px, Y(y) - 4); lbls.push({ m, x: px - w / 2 - 3, y: Y(y) - 16, w: w + 6, h: 15, tip: `<b>m/z ${m.toFixed(2)}</b><div class="sm">Tasto destro: azioni</div>` }); }
  g.font = "11px system-ui";
  for (const a of p.anns) {                                        // the point is the top of the nearest observed peak
    let ay = 0, bd = 0.7; d0.mz.forEach((m, j) => { const dd = Math.abs(m - a.x); if (dd < bd) { bd = dd; ay = d0.y[j]; } });
    drawAnn(p, g, a, X(a.x), Math.max(M.t + 1, Math.min(H - M.b, Y(Math.min(ay, ymax)))), W, 28);
  }
  g.font = "11px system-ui";
  drawMeas(p, g, X, Y, W);                                 // ruler: reference and measured differences
  // theoretical isotope pattern of a formula chosen by the student (red circles), aligned on the nearest observed peak
  let isoNote = "";
  if (p.iso && window.QQQRef) {
    try {
      const ion = QQQRef.ionCounts(p.iso.formula, p.iso.ad), pat = QQQRef.isoPattern(ion.n, ion.z), top = pat.reduce((a, b) => (b.rel > a.rel ? b : a));
      let obs = null; d0.mz.forEach((m, j) => { if (Math.abs(m - top.mz) <= 1.5 && d0.y[j] > 0 && (!obs || d0.y[j] > obs.y)) obs = { m, y: d0.y[j] }; });
      if (obs) {                                         // profile data: several points per peak -> use the centroid of the peak (+-0.5 Da)
        let sw = 0, sm = 0; d0.mz.forEach((m, j) => { if (Math.abs(m - obs.m) <= 0.5 && d0.y[j] > 0) { sw += d0.y[j]; sm += m * d0.y[j]; } });
        if (sw > 0) obs.c = sm / sw;
      }
      const shift = obs ? (obs.c ?? obs.m) - top.mz : 0, h = obs ? obs.y : ymax / 1.12 * 0.9;
      g.save(); g.strokeStyle = g.fillStyle = "#d62728"; g.lineWidth = 1.5;
      for (const r of pat) {
        const px = X(r.mz + shift) + 3, py = Y(h * r.rel / 100); if (px < M.l || px > W - M.r) continue;
        g.setLineDash([3, 2]); g.beginPath(); g.moveTo(px, Y(0)); g.lineTo(px, py); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(px, py, 3.5, 0, 7); g.stroke();
        if (r.rel >= 1) { g.font = "10px system-ui"; g.textAlign = "left"; g.fillText((r.off ? "M+" + r.off : "M") + " " + (r.rel < 10 ? r.rel.toFixed(1) : Math.round(r.rel)) + "%", px + 5, py - 4); }
      }
      g.restore(); g.font = "11px system-ui";
      isoNote = `<span><i style="background:#d62728"></i>profilo teorico ${fmtFormula(p.iso.formula)} ${fmtAdduct(p.iso.ad)}${obs ? ` (allineato al picco a m/z ${(obs.c ?? obs.m).toFixed(1)}${Math.abs(shift) >= 0.05 ? `, spostato di ${shift > 0 ? "+" : ""}${shift.toFixed(1)}` : ""})` : ` (nessun picco osservato vicino a m/z ${top.mz.toFixed(1)})`}</span>`;
    } catch (e) { isoNote = `<span class="sm">profilo isotopico: ${EH(e.message)}</span>`; }
  }
  p.leg.innerHTML = `<span style="font-variant-numeric:tabular-nums">${scanLine(p, data, d0)}${bgOf(files[0]) ? " · fondo sottratto" : ""}</span>`;       // on the row of the x axis title, to the right
  p.leg.title = p.leg.textContent;
  if (p.leg2) p.leg2.innerHTML = (data.length > 1 ? data.map(x => `<span><i style="background:${x.f.color}"></i>${EH(x.f.label)}${legPol(x.f)}</span>`).join("") : "") + isoNote;   // inside the graph, top right; one file = no legend
}

// ------------------------------------------------------------------ mouse
function attach(p) {
  const cv = p.cv;
  let drag = null;
  // pixel -> axis value, always inside the real range of the data (no negative RT, nothing beyond the last scan): selection, zoom, integration, cursor
  const xd = px => { const a = p._a; if (!a) return null; const x = a.x0 + (px - M.l) / (a.W - M.l - M.r) * (a.x1 - a.x0); return a.full ? Math.max(a.full[0], Math.min(a.full[1], x)) : x; };
  const rect = e => { const r = cv.getBoundingClientRect(); return e.clientX - r.left; };
  const recty = e => e.clientY - cv.getBoundingClientRect().top;
  const canYZ = a => a && !a.map && !a.stk && !a.logy && !a.cas && a.yinv;                      // y zoom exists for chromatograms, XIC, MRM and spectra (not stacked / log views)
  const inPlotY = py => py >= M.t && py <= p._a.H - M.b, inPlotX = px => px >= M.l && px <= p._a.W - M.r;
  const yAxisZone = (px, py) => canYZ(p._a) && px < M.l && inPlotY(py);               // the numbers at the left of the y axis
  const xAxisZone = (px, py) => p._a && !p._a.map && px >= M.l && px <= p._a.W - M.r && py > p._a.H - M.b;   // the numbers under the x axis
  const onCur = px => p.type !== "spec" && p.type !== "map" && p.cur != null && p._a && Math.abs(p._a.X(p.cur) - px) < 6;
  const edgeAt = px => {
    if (!p._a || p.type === "spec") return null;
    for (const it of p.ints) for (const e of ["a", "b"]) if (Math.abs(p._a.X(it[e]) - px) < 6) {
      let mate = null; for (const o of p.ints) if (o !== it && o.key === it.key) for (const f of ["a", "b"]) if (Math.abs(o[f] - it[e]) < INT_EPS) mate = { it: o, e: f };      // a border shared with the next peak moves both
      return { it, e, mate, snap: intSnap(p) };
    }
    return null;
  };
  const edgeMove = (ed, x) => {                                              // the border stops at the neighbouring peak (touching is fine, overlapping is not)
    const { it, e, mate } = ed, o = e === "a" ? it.b : it.a, v = it[e], oth = p.ints.filter(i => i !== it && (!mate || i !== mate.it) && i.key === it.key);
    const mo = mate ? (mate.e === "a" ? mate.it.b : mate.it.a) : null;     // far border of the peak that shares this one
    let nx;
    if (v >= o) { let u = mo != null ? Math.max(mo, v) : Infinity; oth.forEach(i => { if (iLo(i) >= v - INT_EPS) u = Math.min(u, iLo(i)); }); nx = Math.max(o, Math.min(u, x)); }
    else { let l = mo != null ? Math.min(mo, v) : -Infinity; oth.forEach(i => { if (iHi(i) <= v + INT_EPS) l = Math.max(l, iHi(i)); }); nx = Math.min(o, Math.max(l, x)); }
    it[e] = nx; if (mate) mate.it[mate.e] = nx;
  };
  cv.onmousemove = e => {
    const a = p._a; if (!a) return; const px = rect(e), py = recty(e), x = xd(px);
    if (drag && drag.rot) {                                   // 3D view: drag rotates (azimuth with x, elevation with y)
      p.az = drag.az + (px - drag.x0) * 0.6; p.elv = Math.max(5, Math.min(85, drag.elv + (py - drag.y0) * 0.4)); p._rot = true;
      if (!p._rf) { p._rf = true; requestAnimationFrame(() => { p._rf = false; draw(p); }); }
      return;
    }
    if (drag && drag.pan) {                                   // Maiusc + trascina: sposta la vista
      const pw = a.W - M.l - M.r, span = drag.z[1] - drag.z[0], dx = (px - drag.x0) / pw * span;
      p.zoom = clampView(drag.z[0] - dx, drag.z[1] - dx, a.full[0], a.full[1]);
      if (a.map && drag.zy) { const sy = drag.zy[1] - drag.zy[0], dy = (py - drag.y0) / (a.H - M.t - M.b) * sy; p.zoomY = clampView(drag.zy[0] + dy, drag.zy[1] + dy, a.fullY[0], a.fullY[1]); }
      draw(p);
    } else if (drag && drag.cursor) {                         // dragging the vertical line: the linked spectrum follows
      p.cur = Math.max(a.full[0], Math.min(a.full[1], x)); p.sel = null; draw(p);
      if (!p._lm) { p._lm = true; requestAnimationFrame(() => { p._lm = false; const sn = p.tab === "ms2" && p.type === "chrom" ? ms2Near(p, p.cur, 0) : null, dt = scanStep(); if (sn) pushLinked(p, sn.rt - sn.g / 2, sn.rt + sn.g / 2, sn.k, true); else pushLinked(p, p.cur - dt / 2, p.cur + dt / 2, nearestFile(p, p.cur), true); }); }
    } else if (drag && drag.edge) { edgeMove(drag.edge, x); draw(p); }
    else if (drag && drag.ya) {                               // line along the y axis: only the intensity axis is zoomed
      drag.y = Math.max(M.t, Math.min(a.H - M.b, py)); zl.hidden = false; zl.className = "zl v";
      zl.style.left = cv.offsetLeft + M.l - 20 + "px"; zl.style.width = ""; zl.style.top = cv.offsetTop + Math.min(drag.y, drag.y0) + "px"; zl.style.height = Math.abs(drag.y - drag.y0) + "px";
      zl.dataset.v = `${fmt(a.yinv(Math.max(drag.y, drag.y0)))} – ${fmt(a.yinv(Math.min(drag.y, drag.y0)))}`;
    } else if (drag && drag.xa) {                             // line along the x axis: only the x axis is zoomed
      drag.x = Math.max(M.l, Math.min(a.W - M.r, px)); zl.hidden = false; zl.className = "zl h";
      zl.style.top = cv.offsetTop + a.H - M.b + 6 + "px"; zl.style.height = ""; zl.style.left = cv.offsetLeft + Math.min(drag.x, drag.x0) + "px"; zl.style.width = Math.abs(drag.x - drag.x0) + "px";
      const u = xd(drag.x0), v = xd(drag.x), lo = Math.min(u, v), hi = Math.max(u, v);
      zl.dataset.v = p.type === "spec" ? `m/z ${lo.toFixed(1)}–${hi.toFixed(1)}` : `RT ${lo.toFixed(2)}–${hi.toFixed(2)} min`;
    }
    else if (drag) { drag.x = px; drag.y = py; if (p.type === "spec" || (p.imode === "zoom" && p.type !== "map")) {      // zoom box (x and y together)
      if (Math.abs(px - drag.x0) > 4) { zr.hidden = false; const yy = canYZ(a) ? [Math.min(py, drag.y0), Math.abs(py - drag.y0)] : [M.t, a.H - M.t - M.b]; zr.style.left = cv.offsetLeft + Math.min(px, drag.x0) + "px"; zr.style.width = Math.abs(px - drag.x0) + "px"; zr.style.top = cv.offsetTop + yy[0] + "px"; zr.style.height = yy[1] + "px"; }
    } else { p.sel = [Math.min(xd(drag.x0), x), Math.max(xd(drag.x0), x)]; draw(p); } }
    else axisHint(yAxisZone(px, py) ? "v" : xAxisZone(px, py) ? "h" : null, e);
    if (!drag) cv.style.cursor = e.shiftKey ? "grab" : yAxisZone(px, py) ? "ns-resize" : xAxisZone(px, py) ? "ew-resize" : edgeAt(px) ? "col-resize" : onCur(px) ? "ew-resize" : p.imode === "zoom" ? "zoom-in" : p.imode ? "cell" : "crosshair";
    const lh = !drag && (a.lbls || []).find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
    if (lh) { cv.style.cursor = "pointer"; lb.hidden = false; lb.style.left = cv.offsetLeft + lh.x + "px"; lb.style.top = cv.offsetTop + lh.y + "px"; lb.style.width = lh.w + "px"; lb.style.height = lh.h + "px"; } else lb.hidden = true;
    p.rd.textContent = p.type === "spec" ? "m/z " + x.toFixed(1) : "RT " + x.toFixed(2) + " min" + (a.map && !a.is3d ? " · m/z " + a.mzAt(py).toFixed(1) : "");   // pass-over text: it goes away when the mouse leaves (see onmouseleave)
    showHover(p, px, py); if (drag) p.tip.hidden = true;
    if (lh) { p.tip.hidden = false; p.tip.innerHTML = lh.tip; p.vl.hidden = true; const tw = p.tip.offsetWidth; let l = cv.offsetLeft + px + 14; if (l + tw > p.el.clientWidth - 4) l = cv.offsetLeft + px - tw - 14; p.tip.style.left = Math.max(2, l) + "px"; p.tip.style.top = cv.offsetTop + py + 14 + "px"; }
  };
  const lb = document.createElement("div"); lb.className = "lbbox"; lb.hidden = true; p.el.appendChild(lb);   // box around the label under the mouse
  const zr = document.createElement("div"); zr.className = "zr"; zr.hidden = true; p.el.appendChild(zr);   // area being zoomed (box)
  const zl = document.createElement("div"); zl.className = "zl"; zl.hidden = true; p.el.appendChild(zl);
  // over the numbers of an axis: a faint strip and the cursor say that a drag there zooms only that axis (the program's own label appears after TIP_DELAY)
  let hintT = null;
  const axisHint = (z, e) => {
    if (z === p._hz) return; p._hz = z; clearTimeout(hintT); const q = Q("#qtip"); if (q && q._ax) { q.hidden = true; q._ax = false; }
    const a = p._a; if (!z || !a) { zl.hidden = true; return; }
    zl.hidden = false; zl.className = "zl hint " + z; zl.dataset.v = "";
    if (z === "v") { zl.style.left = cv.offsetLeft + "px"; zl.style.width = M.l - 2 + "px"; zl.style.top = cv.offsetTop + M.t + "px"; zl.style.height = a.H - M.t - M.b + "px"; }
    else { zl.style.top = cv.offsetTop + a.H - M.b + 1 + "px"; zl.style.height = M.b - 2 + "px"; zl.style.left = cv.offsetLeft + M.l + "px"; zl.style.width = a.W - M.l - M.r + "px"; }
    const cx = e.clientX, cy = e.clientY;
    hintT = setTimeout(() => { if (!q) return; q.textContent = "Trascina qui per ingrandire solo quest'asse"; q.hidden = false; q._ax = true; q.style.left = Math.max(6, Math.min(innerWidth - q.offsetWidth - 6, cx + 12)) + "px"; q.style.top = Math.min(innerHeight - q.offsetHeight - 6, cy + 16) + "px"; }, TIP_DELAY);
  };   // line being dragged on an axis (zooms that axis only)
  cv.onmouseleave = () => { axisHint(null, {}); hideHover(p); lb.hidden = true; p.rd.textContent = p._msg && p.cur != null ? p._msg : ""; };   // no leftover "m/z 289.2": only the useful scan message stays while the cursor is there
  cv.onmousedown = e => {
    if (e.button !== 0 || !p._a) return; const px = rect(e), py = recty(e), a = p._a;
    if (e.shiftKey) { e.preventDefault(); drag = { pan: true, x0: px, y0: py, z: [a.x0, a.x1], zy: a.map ? [a.y0, a.y1] : null }; return; }
    if (a.is3d) { drag = { rot: true, x0: px, y0: py, az: p.az ?? 25, elv: p.elv ?? 38 }; e.preventDefault(); return; }
    if (yAxisZone(px, py)) { drag = { ya: true, y0: Math.max(M.t, Math.min(a.H - M.b, py)), y: py }; e.preventDefault(); return; }
    if (xAxisZone(px, py)) { drag = { xa: true, x0: px, x: px }; e.preventDefault(); return; }
    const ed = edgeAt(px); drag = ed ? { edge: ed } : onCur(px) && !p.imode ? { cursor: true } : { x0: px, x: px, y0: py };
  };
  p._up = e => {
    if (!drag) return; const d = drag; drag = null; zr.hidden = true;
    if (d.rot) { p._rot = false; draw(p); return; }
    zl.hidden = true; p._hz = null;
    if (d.pan) { uiSave(); return; }
    if (d.edge) { if (intSnap(p) !== d.edge.snap) pushIh(p, d.edge.snap); uiSave(); return; }
    if (d.cursor) { uiSave(); return; }
    const a = p._a;
    if (a && (d.ya || d.xa) && Math.abs((d.ya ? d.y - d.y0 : d.x - d.x0)) > 4) pushZh(p);
    if (d.ya) { if (a && Math.abs(d.y - d.y0) > 4) zoomYTo(p, a.yinv(Math.max(d.y, d.y0)), a.yinv(Math.min(d.y, d.y0))); return; }
    if (d.xa) { if (a && Math.abs(d.x - d.x0) > 4) { const u = xd(d.x0), v = xd(d.x); zoomTo(p, Math.min(u, v), Math.max(u, v)); } return; }
    const x0 = xd(d.x0), x1 = xd(d.x);
    if (!a || x0 == null) return;
    if (p._pickNoise && p.type !== "spec" && p.type !== "map" && Math.abs(d.x - d.x0) > 4) {          // the noise stretch for S/N of an integration
      const it = p._pickNoise; p._pickNoise = null; p.sel = null; it.noise = [Math.min(x0, x1), Math.max(x0, x1)]; draw(p); uiSave(); showInts(); return;
    }
    if (p._pickIbk && p.type !== "spec" && p.type !== "map" && Math.abs(d.x - d.x0) > 4) {            // "Sottrai il fondo di un tratto": the stretch the student just dragged
      p._pickIbk = false; p.sel = null; p.bk = ""; p.snip = false; ibkSet(p, "mean", [Math.min(x0, x1), Math.max(x0, x1)]); ctl(p); return;
    }
    if (p.type !== "spec" && p.type !== "map" && Math.abs(d.x - d.x0) <= 4 && p.imode !== "auto") {      // a click on a filled peak selects it; elsewhere it deselects
      const hit = intAt(p, d.x0, d.y0);
      if (hit) { p.isel = hit.id; draw(p); return; }
      if (p.isel != null) { p.isel = null; draw(p); }
    }
    if (p.imode && p.type !== "spec" && p.type !== "map") {          // zoom and integration tools
      if (p.imode === "zoom") {                                        // box: x and y together
        p.sel = null; if (Math.abs(d.x - d.x0) > 4) pushZh(p);
        if (Math.abs(d.x - d.x0) > 4) { if (canYZ(a) && Math.abs(d.y - d.y0) > 4) zoomYTo(p, a.yinv(Math.max(d.y, d.y0)), a.yinv(Math.min(d.y, d.y0)), true); zoomTo(p, Math.min(x0, x1), Math.max(x0, x1)); } else draw(p);
        return;
      }
      if (p.imode === "auto" && Math.abs(d.x - d.x0) <= 4) { if (guardInt(p)) intTargets(p, x0, d.y0).forEach(s => autoInt(p, s, x0)); return; }
      if (p.imode === "man" && Math.abs(d.x - d.x0) > 4) { p.sel = null; if (!guardInt(p)) { draw(p); return; } const t = intTargets(p, (x0 + x1) / 2, d.y0); if (t.length) t.forEach(s => addInt(p, s, x0, x1)); else draw(p); return; }
    }
    if (Math.abs(d.x - d.x0) > 4) {
      if (p.type === "spec") { pushZh(p); if (Math.abs(d.y - d.y0) > 4) zoomYTo(p, a.yinv(Math.max(d.y, d.y0)), a.yinv(Math.min(d.y, d.y0)), true); p.zoom = [Math.min(x0, x1), Math.max(x0, x1)]; draw(p); }
      else { p.sel = [Math.min(x0, x1), Math.max(x0, x1)]; draw(p); pushLinked(p, p.sel[0], p.sel[1], nearestFile(p, (x0 + x1) / 2)); }
    } else if (p.type === "spec") { specClick(p, d.x0); }
    else if (p.type !== "spec") {
      const tt = p.ms2tri && p._a.tri && d.y0 < M.t + 14 ? p._a.tri.reduce((b, q) => (Math.abs(q.px - d.x0) < 6 && (!b || Math.abs(q.px - d.x0) < Math.abs(b.px - d.x0)) ? q : b), null) : null;
      if (tt) { goMs2(tt); return; }                         // a triangle: that MS2 scan in the MS² tab
      p.sel = null; p.cur = x0; const sn = p.tab === "ms2" && p.type === "chrom" && p._a.sr ? ms2Near(p, x0, 0) : null; if (sn) { p.cur = sn.rt; stepMsg(p, `scansione più vicina con dati · RT ${sn.rt.toFixed(2)} min`, true); } draw(p); const dt = scanStep(); if (sn) pushLinked(p, sn.rt - sn.g / 2, sn.rt + sn.g / 2, sn.k); else pushLinked(p, x0 - dt / 2, x0 + dt / 2, nearestFile(p, x0));
    }
  };
  addEventListener("mouseup", p._up);
  // Ctrl/Cmd + rotella (o pizzico sul trackpad): zoom attorno al cursore. La rotella da sola continua a far scorrere la pagina.
  cv.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey) || !p._a) return;
    e.preventDefault();
    const a = p._a, f = Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004), x = xd(rect(e));
    if (!p._wz || Date.now() - p._wz > 600) pushZh(p); p._wz = Date.now();                // a burst of wheel steps is one zoom for the history
    if (rect(e) < M.l && canYZ(a)) { const v = a.yinv(recty(e)); zoomYTo(p, v - (v - a.ymin) * f, v + (a.ymax - v) * f); uiSave(); return; }      // over the y axis: only the vertical scale changes
    if (a.is3d) { const cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2; p.zoomY = clampView(cy - (cy - a.y0) * f, cy + (a.y1 - cy) * f, a.fullY[0], a.fullY[1]); zoomTo(p, cx - (cx - a.x0) * f, cx + (a.x1 - cx) * f); return; }
    if (a.map) { const y = a.mzAt(recty(e)); p.zoomY = clampView(y - (y - a.y0) * f, y + (a.y1 - y) * f, a.fullY[0], a.fullY[1]); }
    zoomTo(p, x - (x - a.x0) * f, x + (a.x1 - x) * f);
  }, { passive: false });
  cv.ondblclick = async e => {
    const hit = (p._a?.lbls || []).find(b => b.ann && rect(e) >= b.x && rect(e) <= b.x + b.w && recty(e) >= b.y && recty(e) <= b.y + b.h);
    if (hit) { const v = await ask("Annotazione", hit.ann.text); if (v) { hit.ann.text = v; draw(p); } return; }      // double click on a label: edit it
    if (p.type === "chrom" || p.type === "xic" || p.type === "mrm") {      // double click = mass spectrum at that retention time (also on the PDA trace)
      const x = xd(rect(e)), k = nearestFile(p, x), f = E.files[k];
      if (!p._a || !f || f.kind === "mrm") return;
      let dt = scanStep(), r0 = x - dt / 2, r1 = x + dt / 2, kk = k;
      const sn = p.tab === "ms2" && p.type === "chrom" ? ms2Near(p, x, 0) : null; if (sn) { r0 = sn.rt - sn.g / 2; r1 = sn.rt + sn.g / 2; kk = sn.k; }
      p.sel = null; p.cur = sn ? sn.rt : x;
      newSpec(p, r0, r1, kk);          // every double click makes a new LIVE spectrum right under the chromatogram; the previous ones freeze
      draw(p); return;
    }
    if (p.type === "spec") { p.lock = null; if (p.meas || p.rul) { p.meas = null; p.rul = false; const rb = p.el.querySelector('[data-a="rul"]'); if (rb) rb.classList.remove("on"); } }                     // double click on a spectrum: whole spectrum, free axes, no measures
    p.zoom = null; p.zoomY = null; p.sel = null; draw(p);
  };
  cv.oncontextmenu = e => { hideHover(p); ctxFor(p, e, xd(rect(e)), rect(e), recty(e)); };
}
const scanStep = () => { const f = scanFiles(tabFiles())[0]; return f ? Math.max((f.rt_max - f.rt_min) / Math.max(f.ms1 + f.ms2 - 1, 1), 0.005) : 0.02; };
function nearestFile(p, x) {
  const a = p._a; if (a && a.map) return a.f.k; if (!a || !a.sr) return scanFiles(shown())[0]?.k ?? 0;
  let best = null;
  a.sr.forEach(s => { if (E.files[s.k]?.kind === "mrm") return; const v = s.ys[nearIdx(s.x, x)]; if (!best || v > best.v) best = { v, k: s.k }; });
  return best ? best.k : (scanFiles(tabFiles())[0]?.k ?? 0);
}
function pushLinked(p, r0, r1, k, keepZoom, o = {}) {
  if (!o.step) { p._msg = null; p._sk = null; }              // a click or a drag starts a new walk: the axes of the spectrum are free again
  E.panels.filter(s => s.type === "spec" && s.link === p.id).forEach(s => {
    s.r0 = r0; s.r1 = r1; s.k = k; s.si = o.i ?? null; if (o.dir) s._dir = o.dir;
    if (!keepZoom) s.zoom = null;
    if (!o.step) { s.lock = null; ctl(s); }                  // no rebuilding of the controls while scrolling
    if (o.step) scAhead(s);
    drawSoon(s);
  });
}
// A new spectrum from a chromatogram (double click, right click) is the "live" one: it sits right under the chromatogram (the older ones slide down),
// and only it follows clicks, cursor, arrows and selections. The older ones are frozen: they keep their time in the title and stay children of the
// chromatogram (src) so they travel with it. Closing the live one promotes nobody; "Ricollega al cromatogramma" in a spectrum's menu makes it live again.
function stackAfter(p, anchor) {
  if (!p.full || !anchor.full || !p.el || !anchor.el) return;
  const st = stackOrder().filter(q => q !== p); st.splice(st.indexOf(anchor) + 1, 0, p);
  let y = 0; st.forEach(q => { q.y = y; apply(q); y += q.h + 10; });
  E.panels.sort((a, b) => a.y - b.y || a.id - b.id);
}
function freezeSpec(s) {
  if (!s.link) return;
  s.src = s.src || s.link; s.link = null;
  if (/^Spettro/.test(s.title) && s.r0 != null) s.title = s.level === 2 ? `Spettro degli ioni prodotto${s.prec != null ? " · " + s.prec : ""}` : "Spettro di massa";   // the time is written once, next to the title (.rtl)
  ctl(s);
}
function liveSpec(s, from) {
  E.panels.filter(q => q !== s && q.type === "spec" && q.link === from.id).forEach(freezeSpec);
  s.link = from.id; s.src = from.id; ctl(s);
  if (from.cur != null && s.r0 == null) { const dt = scanStep(); s.r0 = from.cur - dt / 2; s.r1 = from.cur + dt / 2; }
  draw(s); uiSave();
}
function newSpec(from, r0, r1, k, link = from.id) {
  if (link) E.panels.filter(q => q.type === "spec" && q.link === from.id).forEach(freezeSpec);
  const s = addPanel("spec", { link, src: from.id, k, r0, r1, level: E.files[k]?.lv || 1, prec: from.tab === "ms2" ? from.prec : null, title: from.tab === "ms2" ? `Spettro degli ioni prodotto${from.prec != null ? " · " + from.prec : ""}` : "Spettro di massa" });
  stackAfter(s, from); relayout(); fitHost();
  reveal(s);
  return s;
}

// The peak a click on the spectrum means: a click inside the box of a peak label gives exactly that peak; otherwise the peak the mouse box highlights (p._a.snap).
// Hover, right-click menu, ruler and XIC all use it, so the m/z they show is always the same.
function specPick(p, px, py) {
  const a = p._a; if (!a) return null;
  const lb = (a.lbls || []).find(l => l.m != null && px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h);
  if (lb) return lb.m;
  const s = a.snap && a.snap(px); return s ? s.m : null;
}
function ctxFor(p, e, x, px, py) {
  if (!p._a) return e.preventDefault();
  const items = [];
  const inLbl = a => (p._a.lbls || []).some(l => l.ann === a && px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h);
  const near = p.anns.find(a => a.x >= p._a.x0 && a.x <= p._a.x1 && (inLbl(a) || Math.abs(p._a.X(a.x) - px) < 14));
  if (p.type === "map" && p._a.is3d) {
    items.push({ label: "Vista 3D: per estrarre un XIC o uno spettro passa alla vista 2D", dim: true }, { label: "Passa alla vista 2D", fn: () => setMapView(p, "2d") }, { label: "Riporta la prospettiva iniziale", fn: () => { p.az = 25; p.elv = 38; draw(p); uiSave(); } });
  } else if (p.type === "map") {
    const a = p._a, mz = a.mzAt(py), lab = mz.toFixed(1), f = a.f, dt = scanStep();
    items.push({ label: `RT ${x.toFixed(2)} min · m/z ${lab} · ${f.label}`, dim: true }, "-");
    items.push({ label: `Estrai l'XIC di m/z ${lab} (scegli la finestra)...`, fn: () => openXic(null, { mz, obs: true }) });
    tabPanels().filter(q => q.type === "xic").forEach(q => items.push({ label: `Aggiungi m/z ${lab} al pannello «${q.title}»...`, fn: () => openXic(q, { mz, obs: true }) }));
    items.push("-");
    if (p.sel) items.push({ label: "Spettro medio dell'intervallo selezionato", fn: () => newSpec(p, p.sel[0], p.sel[1], f.k) });
    items.push({ label: "Spettro a questo RT", fn: () => newSpec(p, x - dt / 2, x + dt / 2, f.k) });
  } else if (p.type === "spec") {
    const a = p._a, d0 = a.data[0].d;
    const m = specPick(p, px, py);                          // the SAME peak that the label and the mouse box show; on empty space the m/z entries are grey
    const has = m != null, lab = has ? m.toFixed(1) : "…", mi = o => has ? o : { label: o.label, dim: true };
    items.push({ label: has ? `m/z ${lab}` : "nessun picco qui: clic destro su un picco", dim: true }, "-");
    items.push(mi({ label: `Estrai l'XIC di m/z ${lab}`, fn: () => xicDirect(m, p) }));
    const xs = tabPanels().filter(q => q.type === "xic"), TIPX = "Aggiunge questo ione nello stesso grafico: per vedere se due ioni escono allo stesso tempo";
    const ov = q => ({ label: `Sovrapponi all'XIC di ${xicName(q)} (pannello ${q.num || "?"})`, tip: TIPX, fn: () => xicDirect(m, p, q) });
    if (xs.length > 3) items.push(mi({ label: "Sovrapponi a un XIC…", tip: TIPX, fn: () => menu({ preventDefault() {}, clientX: e.clientX, clientY: e.clientY }, xs.map(ov)) }));
    else xs.forEach(q => items.push(mi(ov(q))));
    items.push("-", ...measMenu(p, m).map((o, i) => i === 0 ? mi(o) : o));
    items.push(mi({ label: "Annota questo picco…", fn: async () => { const v = await ask("Annotazione per m/z " + lab, ""); if (v) { p.anns.push({ x: m, text: v }); draw(p); } } }));
    items.push({ label: "Profilo isotopico di una formula…", fn: async () => {
      const v = await ask("Formula della molecola neutra (es. C9H10Cl2N2O). Facoltativo l'addotto dopo uno spazio, es. <b>C9H10Cl2N2O [M+Na]+</b>; senza addotto: " + EH(defAdduct(a.data.map(x => x.f))), p.iso ? p.iso.formula + " " + p.iso.ad : "");
      if (!v) return;
      const mm = v.match(/^\s*(\S+)\s*(\[.*\].*)?$/); if (!mm) return;
      try { const r = await getFormula(mm[1], ""); p.iso = { formula: r.formula, ad: (mm[2] || defAdduct(a.data.map(x => x.f))).trim() };
        const ion = QQQRef.ionCounts(p.iso.formula, p.iso.ad), pat = QQQRef.isoPattern(ion.n, ion.z);
        p.zoom = [pat[0].mz - 4, pat[pat.length - 1].mz + 4]; draw(p); }   // zoom on the pattern (double click: whole spectrum)
      catch (e) { info("Non riesco a calcolare il profilo: " + EH(e.message)); }
    } });
    if (p.iso) items.push({ label: "Togli il profilo isotopico", fn: () => { p.iso = null; draw(p); } });
    const srcP = p.src && E.panels.find(q => q.id === p.src && q.el);
    if (p.link) items.push("-", { label: "Congela lo spettro", fn: () => { freezeSpec(p); uiSave(); } });
    else if (srcP) items.push("-", { label: "Ricollega al cromatogramma", fn: () => liveSpec(p, srcP) });
  } else {
    const k = nearestFile(p, x);
    items.push({ label: `RT ${x.toFixed(2)} min · ${E.files[k]?.label || ""}`, dim: true }, "-");
    const dt = scanStep();
    if (p.type !== "mrm") {
      if (p.sel) items.push({ label: "Spettro medio dell'intervallo selezionato", fn: () => newSpec(p, p.sel[0], p.sel[1], k) });
      items.push({ label: "Spettro a questo RT", fn: () => { const sn = p.tab === "ms2" && p.type === "chrom" ? ms2Near(p, x, 0) : null; if (sn) { p.cur = sn.rt; newSpec(p, sn.rt - sn.g / 2, sn.rt + sn.g / 2, sn.k); } else newSpec(p, x - dt / 2, x + dt / 2, k); } });
    }
    if (p.type === "chrom") items.push({ label: "Estrai uno ione (XIC)…", fn: () => openXic(null) });
    if (p.type === "xic") {
      items.push({ label: "Aggiungi un altro ione…", fn: () => openXic(p) });
    }
    items.push("-", ...intMenuItems(p, x, near, py));
    { const ib = ibkMenuItems(p); if (ib.length) items.push("-", ...ib); }
    items.push("-", { label: "Annota questo punto…", fn: async () => { const v = await ask("Annotazione a RT " + x.toFixed(2), ""); if (v) { p.anns.push({ x, text: v }); draw(p); } } });
  }
  if (near) items.push("-", { label: `Modifica «${near.text}»`, fn: async () => { const v = await ask("Annotazione", near.text); if (v) { near.text = v; draw(p); } } },
    { label: `Elimina «${near.text}»`, fn: () => { p.anns = p.anns.filter(a => a !== near); draw(p); } });
  if (!(p.type === "map" && p._a.is3d) && (p.zoom || p.zoomY)) items.unshift({ label: "Ripristina zoom", fn: () => { p.zoom = null; p.zoomY = null; draw(p); } }, "-");     // with a zoom active it is always the first entry
  menu(e, items);
}

// LC method of the laboratory (gradient, flow, PDA, oven): it is stored in the .wiff/.dam files, not in the mzML
function lcHtml(lc, row) {
  const g = lc.gradient || [], T = lc.run_time || (g.length ? g[g.length - 1].t : 22), RH = 27;       // the figure is as tall as the table (rows of 27 px)
  const w = 440, hh = Math.max(160, (g.length + 1) * RH), l = 40, r = 10, t = 10, b = 34, X = v => l + v / T * (w - l - r), Y = v => t + (100 - v) / 100 * (hh - t - b);
  const pts = g.map(q => [q.t, q.b]), ink = css("--muted"), acc = css("--accent");
  let svg = `<svg viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" style="background:#fff;border:1px solid ${css("--line")};border-radius:6px;flex:none;max-width:100%" font-family="system-ui" font-size="11"><path d="M${l} ${t}V${hh - b}H${w - r}" fill="none" stroke="${ink}"/>`;
  for (const v of [0, 25, 50, 75, 100]) svg += `<path d="M${l - 3} ${Y(v)}H${l}" stroke="${ink}"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" fill="${ink}">${v}</text>`;
  for (let v = 0; v <= T; v += 5) svg += `<path d="M${X(v)} ${hh - b}v3" stroke="${ink}"/><text x="${X(v)}" y="${hh - b + 15}" text-anchor="middle" fill="${ink}">${v}</text>`;
  svg += `<polyline fill="none" stroke="${acc}" stroke-width="2" points="${pts.map(q => X(q[0]) + "," + Y(q[1])).join(" ")}"/>${pts.map(q => `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="2.6" fill="${acc}"/>`).join("")}`;
  svg += `<text x="${(l + w - r) / 2}" y="${hh - 4}" text-anchor="middle" fill="${css("--ink")}">Tempo (min)</text><text transform="translate(11 ${(t + hh - b) / 2}) rotate(-90)" text-anchor="middle" fill="${css("--ink")}">% B</text></svg>`;
  const pda = lc.pda || {};
  const tbl = `<table class="lct"><tr><th class="num">Tempo (min)</th><th class="num">% A</th><th class="num">% B</th><th class="num">Flusso (mL/min)</th></tr>${g.map(q => `<tr><td class="num">${q.t}</td><td class="num">${+(100 - q.b).toFixed(1)}</td><td class="num">${q.b}</td><td class="num">${q.flow}</td></tr>`).join("")}</table>`;
  const chips = [lc.run_time != null ? ["Durata della corsa", lc.run_time + " min"] : null, lc.oven != null ? ["Temperatura del forno", lc.oven + " °C"] : null].filter(Boolean);
  return `<section class="msec"><h4>Metodo cromatografico (LC)</h4>
   <div class="sm" style="margin:0 0 8px">A = H<sub>2</sub>O + 0.1% FA &nbsp;&middot;&nbsp; B = ACN + 0.1% FA</div>
   <div style="display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap">${svg}<div style="flex:1 1 300px;max-width:520px">${tbl}</div></div>
   ${chips.length ? `<div class="mchips">${chips.map(c => `<span><span class="muted">${c[0]}</span> <b>${c[1]}</b></span>`).join("")}</div>` : ""}</section>
   ${pda.start != null ? `<section class="msec"><h4>Rivelatore PDA (UV)</h4><table>${row("Intervallo di lunghezze d'onda", `${pda.start}-${pda.stop} nm (passo ${pda.step} nm)`)}</table></section>` : ""}`;
}

// ------------------------------------------------------------------ metodo di acquisizione (letto dagli mzML)
async function showMethod(sel) {
  const f = E.files[E.cur]; if (!f) return info("Apri prima almeno un file.");
  let m; try { m = await J("api/method?k=" + f.k); } catch (e) { return info("Errore: " + EH(e.message)); }
  const row = (a, b) => b == null || b === "" ? "" : `<tr><td class="muted">${EH(a)}</td><td>${EH(String(b))}</td></tr>`;   // values come from the file: always escaped here
  const pol = { positive: "positivo (ESI+)", negative: "negativo (ESI-)", mixed: "misto", unknown: "non indicata" }[m.polarity] || m.polarity;
  const labs = m.lab || [], li = labs.length ? Math.min(Math.max(sel ?? m.lab_pick ?? 0, 0), labs.length - 1) : -1, lab = labs[li];
  let h = labs.length ? "" : `<div style="background:#fff4e0;border-left:4px solid #e08a00;border-radius:6px;padding:8px 12px;margin-bottom:8px"><b>Manca il metodo di acquisizione.</b> Gli mzML non contengono i parametri della sorgente, le energie di collisione e il gradiente: li leggo dal file <b>.dam</b> del metodo (quello di Analyst).<div style="margin-top:6px"><button class="go" id="m-load">Carica il metodo (.dam)</button></div></div>`;
  const sec = (title, body, extra = "") => `<section class="msec"><h4>${title}${extra}</h4>${body}</section>`;
  const HOW = {
    q1: "<b>Scansione Q1</b>: il primo quadrupolo (Q1) scansiona l'intervallo di <i>m/z</i> e la cella di collisione non frammenta (nessuna energia di collisione): si registra lo spettro di tutti gli ioni intatti.",
    ems: "<b>Enhanced MS (EMS)</b>: gli ioni attraversano Q1 e la cella senza frammentarsi e sono accumulati nella trappola lineare (Q3), che li scansiona: più sensibilità dello scan Q1, stesso tipo di spettro (ioni intatti).",
    ms2: "<b>MS2 (ioni prodotto)</b>: Q1 seleziona lo ione precursore, la cella di collisione lo frammenta (energia di collisione, CE) e Q3 scansiona i frammenti: si ottiene uno spettro per ogni precursore scelto.",
    mrm: "<b>MRM</b>: Q1 seleziona il precursore, la cella lo frammenta e Q3 lascia passare solo un frammento scelto (transizione Q1&gt;Q3). Si registra una traccia per ogni transizione: non ci sono spettri."
  };
  const scanLike = m.kind === "full" || m.kind === "ms2";
  const expTbl = `<table>${row("Polarità", pol)}${scanLike ? row("Intervallo di massa", m.scan_window ? `m/z ${m.scan_window[0]}-${m.scan_window[1]}` : "") : ""}${row("Durata", m.rt_max > 0 ? `${m.rt_min.toFixed(2)}-${m.rt_max.toFixed(2)} min` : "")}${scanLike ? row("Scan", m.scans || "") + row("Tempo di ciclo", m.cycle_s ? m.cycle_s.toFixed(2) + " s" : "") : ""}${m.kind === "ms2" ? row("Precursori (Q1)", m.precursors.join(", ")) + row("Energia di collisione", m.ce.length ? m.ce.join(", ") + " eV" : "") : ""}</table>`;
  const trTbl = m.transitions.length ? `<table><tr><th>Nome</th><th class="num">Q1 (m/z)</th><th class="num">Q3 (m/z)</th><th class="num">CE (eV)</th><th class="num">Dwell (ms)</th></tr>${m.transitions.map(t => `<tr><td>${EH(t.name || "")}</td><td class="num">${EH(String(t.q1))}</td><td class="num">${EH(String(t.q3))}</td><td class="num">${EH(String(t.ce ?? ""))}</td><td class="num">${t.dwell != null ? Math.round(t.dwell * 1000) : ""}</td></tr>`).join("")}</table>` : "";
  h += `<div class="msub"><span class="tag">${kindOf(f)}</span> <b>${EH(f.label)}</b> <span class="muted">· ${EH(m.instrument)} (${EH(m.serial)})</span></div><div class="mgrid">`;
  h += sec("Esperimento", `<div class="sm hw">${HOW[m.kind === "full" ? (f.mode === "ems" ? "ems" : "q1") : m.kind] || ""}</div>${expTbl}${trTbl}`);
  if (lab && lab.check && lab.check.length) {
    const ic = { ok: '<span style="color:var(--ok)">\u2713 coincide</span>', diff: '<span style="color:var(--bad)">\u2717 diverso</span>', na: '<span class="muted">non verificabile</span>' };
    const bad = lab.check.filter(r => r.status === "diff").length;
    h += sec("Il metodo corrisponde ai dati?", `<table><tr><th>Cosa</th><th>Metodo (.dam)</th><th>File (mzML)</th><th></th></tr>${lab.check.map(r => `<tr><td>${EH(r.what)}</td><td>${EH(r.method)}</td><td>${EH(r.data)}</td><td>${ic[r.status] || ""}</td></tr>`).join("")}</table>
      ${bad ? `<div class="sm" style="margin-top:4px;color:var(--bad)">${bad} differenz${bad === 1 ? "a" : "e"}: controlla di aver caricato il metodo giusto per questo file${labs.length > 1 ? " (puoi sceglierne un altro)" : ""}.</div>` : ""}`);
  }
  if (lab) {
    const pr = a => a.map(s => `<tr><td class="muted">${EH(s.label)}</td><td>${s.id === "ihe" ? (s.value ? "acceso" : "spento") : s.value + " " + s.unit}</td></tr>`).join("");
    const pick = labs.length > 1 ? `<div class="sm" style="margin:2px 0 6px">Metodo: <select id="m-sel">${labs.map((x, i) => `<option value="${i}" ${i === li ? "selected" : ""}>${EH(x.name)}</option>`).join("")}</select> <button id="m-load">Carica un altro .dam</button></div>` : `<div class="muted sm" style="margin:2px 0 6px">Dal file <b>${EH(lab.name)}</b>. <button id="m-load">Carica un altro .dam</button></div>`;
    h += sec("Sorgente e composto (.dam)", pick + (lab.error ? `<div class="fail">${EH(lab.error)}</div>` : lab.source.length || lab.compound.length ? `<table>${pr(lab.source)}${pr(lab.compound)}</table>` : `<div class="muted sm">In questo file non ho trovato parametri della sorgente.</div>`));
  }
  h += "</div>";
  if (lab) {
    if (lab.lc) h += lcHtml(lab.lc, row);
    else if (!lab.error) h += `<div class="muted sm" style="margin-top:6px">Questo .dam non contiene il metodo cromatografico (gradiente) né le impostazioni del PDA.</div>`;
  }
  h = h.replace(/m\/z/g, "<i>m/z</i>");   // m/z is always in italics
  const d = Q("#bigdlg"); if (d.open) d.close();
  big("Metodo di acquisizione", h, () => {
    const sl = Q("#m-sel"); if (sl) sl.onchange = () => showMethod(+sl.value);
    const ld = Q("#m-load"); if (ld) ld.onclick = loadDam;
  });
}
// the method (.dam) can also be loaded here, without going back to the start screen
function loadDam() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".dam,.DAM";
  inp.onchange = async () => {
    const fl = inp.files[0]; if (!fl) return;
    try {
      const j = await (await fetch("api/upload?name=" + encodeURIComponent(fl.name), { method: "POST", body: fl })).json();
      if (j.error) throw new Error(j.error);
      if (typeof ST !== "undefined") { ST.methods = j.methods || ST.methods; renderMethods(); }
      showMethod();
    } catch (e) { info("Errore: " + EH(e.message)); }
  };
  inp.click();
}
Q("#np-method").onclick = () => showMethod();

// ------------------------------------------------------------------ BioTransformer
function openBT() {
  window.open("https://biotransformer.ca/new", "_blank", "noopener");
  Q("#bt").hidden = false;
  try { if (window.TPDraw) window.TPDraw.smiles().then(s => { if (s) { navigator.clipboard.writeText(s); Q("#btcopy").textContent = "Copiato: " + (s.length > 40 ? s.slice(0, 40) + "…" : s); } }).catch(() => {}); } catch (_) { /* appunti non disponibili */ }
}
Q("#np-bt").onclick = openBT; Q("#bt-open").onclick = openBT; Q("#btx").onclick = () => { Q("#bt").hidden = true; };

// ------------------------------------------------------------------ barra strumenti
Q("#np-chrom").onclick = () => reveal(addPanel("chrom", {}));
Q("#np-spec").onclick = () => { const f = scanFiles(vis())[0] || scanFiles(tabFiles())[0]; reveal(addPanel("spec", { k: f?.k ?? 0, level: f?.lv || 1 })); };
Q("#np-xic").onclick = () => openXic(null);
Q("#np-map").onclick = () => { const f = scanFiles(vis())[0] || scanFiles(tabFiles())[0]; reveal(addPanel("map", { k: f?.k ?? 0 })); };
Q("#np-mrm").onclick = () => reveal(addPanel("mrm", { imode: "man", intf: "all" }));
Q("#np-tile").onclick = tile;
Q("#np-merge").onclick = mergeXics;
Q("#addf").onclick = async () => { S.adding = true; try { const d = await J("api/state"); if (d.methods) { ST.methods = d.methods; renderMethods(); } } catch (_) { /* the list stays as it was */ } applyView(); };
addEventListener("resize", () => { fitWidth(); redrawAll(); });
document.addEventListener("tpview", e => { if (e.detail.view === "data") setTimeout(() => { fitWidth(); redrawAll(); }, 0); });

// ------------------------------------------------------------------ calcolatrice formula -> m/z (come «mass from formula» di Xcalibur)
// the calculator is a drop-down under its button (no dark backdrop): the graphs stay visible and usable; it closes with the button, Esc or the ×
const calcBox = Q("#calcdlg");
Object.defineProperty(calcBox, "open", { get: () => !calcBox.hidden });
calcBox.close = () => { calcBox.hidden = true; };
function calcPlace() {
  const r = Q("#np-calc2").getBoundingClientRect(), w = Math.min(560, innerWidth - 16);
  calcBox.style.top = Math.round(r.bottom + 6) + "px"; calcBox.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + "px";
}
Q("#np-calc2").onclick = () => { if (!calcBox.hidden) return calcBox.close(); calcBox.hidden = false; calcPlace(); Q("#calcin").focus(); };
Q("#calcx").onclick = () => calcBox.close();
addEventListener("resize", () => { if (!calcBox.hidden) calcPlace(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !calcBox.hidden) calcBox.close(); });
let CALC_MORE = false;       // the calculator shows the adducts of the other polarity too
async function calcRun() {
  const t = Q("#calcin").value.trim(), out = Q("#calcout"), sum = Q("#calcsum");
  if (!t) { out.innerHTML = ""; sum.innerHTML = ""; return; }
  try {
    const r = await getFormula(t, "");
    const want = defAdduct();
    sum.innerHTML = t.replace(/\s+/g, "") !== r.formula ? `interpretata come <b>${fmtFormula(r.formula)}</b>` : "";      // what was calculated, when the capitals were fixed
    // only the adducts of the polarity of the files shown (positive files: [M+H]+, [M+Na]+...; negative: [M-H]-...); no files or mixed: both, under ESI+ / ESI-; a small link shows the other polarity
    const fl = shown().length ? shown() : E.files.filter(f => f.vis), pos = fl.some(f => f.polarity === "positive"), neg = fl.some(f => f.polarity === "negative");
    const mine = pos && !neg ? "+" : neg && !pos ? "-" : "", both = !mine || CALC_MORE;
    const ent = Object.entries(r.adducts), isPos = a => a.endsWith("+");
    const rowOf = ([a, v]) => `<tr${a === want ? ' style="font-weight:600"' : ""}><td>${fmtAdduct(a)}</td><td>${v.mz.toFixed(4)}</td><td>${v.nominal}</td><td><button data-a="${EH(a)}" data-m="${v.mz1}" title="Apre la finestra per estrarre questo ione (XIC)">XIC</button></td></tr>`;
    const grp = (lab, rows) => rows.length ? `<tr class="pg"><td colspan="4"><b>${lab}</b></td></tr>` + rows.map(rowOf).join("") : "";
    const P = ent.filter(([a]) => isPos(a)), N = ent.filter(([a]) => !isPos(a));
    const body = !both ? (mine === "+" ? P : N).map(rowOf).join("") : !mine ? grp("ESI+", P) + grp("ESI\u2212", N) : mine === "+" ? grp("ESI+", P) + grp("ESI\u2212", N) : grp("ESI\u2212", N) + grp("ESI+", P);
    const more = mine ? `<p class="sm"><a href="#" id="calcmore">${CALC_MORE ? "mostra solo " + (mine === "+" ? "ESI+" : "ESI\u2212") : "mostra anche " + (mine === "+" ? "ESI\u2212" : "ESI+")}</a></p>` : "";
    out.innerHTML = `<p><b>${fmtFormula(r.formula)}</b> · massa esatta neutra <b>${r.neutral.toFixed(4)}</b> · intera <b>${r.nominal_neutral}</b></p>
      <table><tr><th>addotto</th><th>m/z esatto</th><th>all'unità</th><th></th></tr>${body}</table>${more}`;
    const mo = out.querySelector("#calcmore"); if (mo) mo.onclick = e => { e.preventDefault(); CALC_MORE = !CALC_MORE; calcRun(); };
    out.querySelectorAll("button[data-m]").forEach(b => b.onclick = () => {
      Q("#calcdlg").close();
      openXic([...tabPanels()].reverse().find(q => q.type === "xic") || null, { formula: r.formula, adduct: b.dataset.a });
    });
  } catch (e) { sum.innerHTML = ""; out.innerHTML = `<p class="muted">${EH(e.message)}</p>`; }
}
Q("#calcin").oninput = calcRun;

// ---- discreet tooltip on every button and control (the program's own, not the browser's): it appears when the pointer rests on one for TIP_DELAY (1.25 s; it was 1.5 s until 7 Oct 2026) and goes away when the pointer leaves.
// The text is the element's title; the title is moved to data-tip on the first hover so the browser's own (earlier, fixed-style) tooltip does not also show up.
(function () {
  const tip = document.createElement("div"); tip.id = "qtip"; tip.hidden = true; document.body.appendChild(tip);
  const SEL = "[title], [data-tip], [data-tiph]", DELAY = TIP_DELAY;
  let timer = null, cur = null;
  const hide = () => { clearTimeout(timer); timer = null; tip.hidden = true; cur = null; };
  document.addEventListener("mouseover", e => {
    const t = e.target.closest && e.target.closest(SEL);
    if (t === cur) return;
    hide();
    if (!t || t.closest("dialog[open]")) return;
    if (t.hasAttribute("title")) { t.dataset.tip = t.getAttribute("title"); t.removeAttribute("title"); }
    const txt = t.dataset.tip, html = t.dataset.tiph; if (!txt && !html) return;
    cur = t;
    timer = setTimeout(() => {
      if (html) tip.innerHTML = html; else tip.textContent = txt;
      tip.hidden = false;
      const r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + "px";
      tip.style.top = (r.bottom + h + 10 < innerHeight ? r.bottom + 6 : Math.max(6, r.top - h - 6)) + "px";
    }, DELAY);
  });
  document.addEventListener("mouseout", e => { if (cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) hide(); });
  ["mousedown", "keydown", "wheel"].forEach(ev => document.addEventListener(ev, hide, true));
  addEventListener("scroll", hide, true);
})();
