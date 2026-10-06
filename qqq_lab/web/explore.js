"use strict";
// Esplorazione dei dati: si parte dal cromatogramma totale, lo studente decide cosa estrarre.
// Script classico (usa gli helper di index.html: S, setup, nice, fmt, css, esc, smooth, M, setView, applyView).
const E = { files: [], panels: [], seq: 1, key: "", cur: 0, browse: false, z: 10, fold: false };
const NB = { ui: null, session: null };   // taccuino: stato dell'interfaccia (+ disegno, vedi draw.js)
const PAL = ["#1f77b4", "#e6550d", "#2ca02c", "#9467bd", "#d62728", "#17becf", "#bcbd22", "#e377c2", "#8c564b", "#0b6e4f", "#f2a900", "#5b5fc7"];
const Q = s => document.querySelector(s);
const EH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtFormula = f => !f ? "" : EH(f).replace(/([A-Z][a-z]?|\))(\d+)/g, "$1<sub>$2</sub>");
const fmtAdduct = a => !a ? "" : fmtFormula(a).replace(/([+-]+)$/, "<sup>$1</sup>");
window.fmtFormula = fmtFormula; window.fmtAdduct = fmtAdduct;
const KIND = { full: "Full Scan", ms2: "MS\u00b2 (Product Ion)", mrm: "MRM", empty: "vuoto" };
const kindOf = f => KIND[f.kind] || f.kind;
const TOL0 = 1.0;                                   // strumento datato: finestra XIC di +-1 Da

// ------------------------------------------------------------------ schermata di caricamento
// small inline icons (no external files): download arrow and "fit to window" corners
const IC_DL = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M6 1v7M3 5.5 6 8.5 9 5.5M1.5 11h9"/></svg>';
const IC_AUTO = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M1 14h14"/><path d="M3 14C5 14 6 4.5 8 4.5S11 14 13 14z" fill="currentColor" fill-opacity=".3"/><path d="M13 1.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none"/></svg>';   // peak with its area + sparkle = automatic
const IC_MAN = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M1 14h14"/><path d="M4.5 14C6 14 6.5 5 8 5s2 9 3.5 9" /><path d="M4 2.5v11.5M12 2.5v11.5" stroke-dasharray="2 1.6"/></svg>';   // peak between two edge bars = manual
const IC_ZOOM = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4.6"/><path d="M10 10l4.6 4.6M4.4 6.5h4.2M6.5 4.4v4.2"/></svg>';   // magnifier = zoom tool
const IC_TAB = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2" width="11" height="10" rx="1.2"/><path d="M1.5 5.5h11M1.5 8.7h11M6 5.5V12"/></svg>';
const IC_FIT = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>';
const PHRASES = [
  "Ignorando i warning", "Schivando gli ftalati", "Minando crypto di nascosto", "Litigando coi file", "Allineando i quadrupoli",
  "Compilando preghiere", "Aggiornando Matrix", "Cercando il segnale perduto", "Riavviando l'universo", "Ansia da separazione",
  "Contaminando la sorgente", "Accecando l'elettromoltiplicatore", "Maledicendo la matrice", "Cuocendo sui quadrupoli"];
// loading screen: one phrase every 5 s, in random order without repeats; the three dots appear one after the other
let ldTimer = null, ldDotTimer = null, ldSince = 0, ldBag = [], ldLast = -1;
function ldNext() {
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
function loading(on, msg) {
  const L = Q("#loading");
  if (on) {
    ldSince = Date.now(); Q("#ldsub").textContent = msg || "";
    clearInterval(ldTimer); ldNext(); ldTimer = setInterval(ldNext, 5000); L.hidden = false;
  } else {
    const wait = Math.max(0, 900 - (Date.now() - ldSince));
    setTimeout(() => { L.hidden = true; clearInterval(ldTimer); clearInterval(ldDotTimer); }, wait);
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
async function nbLoad() {
  try { Object.assign(NB, await (await fetch("api/notebook")).json()); } catch (_) { /* prima volta */ }
  document.dispatchEvent(new Event("nbloaded"));
}
let uiTimer = null;
function uiSave(now = false) {
  clearTimeout(uiTimer);
  const run = () => {
    if (!E.files.length) return;
    NB.session = E.files.map(f => ({ file: f.file, label: f.label, time: f.time, type: f.type, conc: f.conc ?? null, cunit: f.cunit ?? null }));
    NB.ui = {
      cur: E.cur, browse: E.browse, fold: E.fold, files: E.files.map(f => ({ file: f.file, label: f.label, vis: f.vis })),
      panels: E.panels.map(p => ({
        type: p.type, title: p.title, x: p.x, y: p.y, w: p.w, h: p.h, full: !!p.full, kind: p.kind, smooth: p.smooth, tol: p.tol,
        traces: (p.traces || []).map(t => ({ mz: t.mz, w: t.w, label: t.label })),
        k: E.files[p.k]?.file ?? null, r0: p.r0, r1: p.r1, level: p.level, prec: p.prec, all: p.all, zoom: p.zoom, anns: p.anns, ints: p.ints, tr: p.tr,
        link: p.link ? E.panels.findIndex(q => q.id === p.link) : -1, imode: p.imode || null, intf: p.intf || "",
        iso: p.iso || null, sim: p.sim || null, mz0: p.mz0 ?? null, mz1: p.mz1 ?? null, mode: p.mode, log: p.log, hid: p.hid, bk: p.bk === "" || p.bk == null ? "" : E.files[+p.bk]?.file ?? "", snip: p.snip, snipw: p.snipw, adduct: p.adduct, bg: p.bg === "" || p.bg == null ? "" : p.bg === "w" ? "w" : E.files[+p.bg]?.file ?? "", bw0: p.bw0, bw1: p.bw1, scale: p.scale, zoomY: p.zoomY, ref: p.ref === "" || p.ref == null ? "" : E.files[+p.ref]?.file ?? ""
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
const getSpec = (k, a, b, lv, pr, bg) => memo(`s${k}|${a}|${b}|${lv}|${pr}|${bg ? bg.join(",") : ""}`, () => J(`api/spectrum?k=${k}&rt0=${a}&rt1=${b}&level=${lv}&precursor=${pr ?? ""}` + (bg ? `&bgk=${bg[0]}&bgrt0=${bg[1]}&bgrt1=${bg[2]}` : "")));
const getFormula = (f, ad) => J(`api/formula?f=${encodeURIComponent(f)}&adduct=${encodeURIComponent(ad || "")}`);
// default adduct from the polarity of the visible files
const defAdduct = () => (E.files.find(f => f.vis && f.polarity === "negative") && !E.files.find(f => f.vis && f.polarity === "positive")) ? "[M-H]-" : "[M+H]+";
const getMrm = k => memo(`m${k}`, () => J(`api/mrm?k=${k}`).then(j => j.files[0].transitions));

async function bootSession() {
  const j = await J("api/session");
  S.sess = j.session;
  if (!j.session) { E.files = []; E.key = ""; return; }
  const key = JSON.stringify(j.session.map(s => s.file));
  if (key === E.key) return;
  const oldNames = E.files.map(f => f.file), oldVis = Object.fromEntries(E.files.map(f => [f.file, f]));
  E.key = key;
  CACHE.clear();
  E.files = j.session.map((s, k) => ({ ...s, k, vis: oldVis[s.file] ? oldVis[s.file].vis : true, label: oldVis[s.file] ? oldVis[s.file].label : s.label, lv: s.kind === "ms2" ? 2 : 1 }));
  paintFiles();
  const idx = n => { const i = E.files.findIndex(f => f.file === n); return i < 0 ? 0 : i; };
  if (E.panels.length && oldNames.length) {                // caricamento successivo: i pannelli restano
    E.panels.forEach(p => { if (p.k != null) p.k = idx(oldNames[p.k]); if (p.ref !== "" && p.ref != null) p.ref = idx(oldNames[+p.ref]); });
    E.cur = Math.min(E.cur, E.files.length - 1);
    renderFileList(); toolbar(); E.panels.forEach(ctl); redrawAll(); return;
  }
  renderFileList();
  E.panels = []; Q("#dpanels").innerHTML = "";
  await nbLoad();
  if (!restoreUi()) defaultLayout();
  toolbar(); uiSave();
}
function defaultLayout() {
  // TIC of all the files on top, the spectrum below (both as wide as the page), MRM transitions under them if there are MRM files
  const scan = E.files.some(f => f.kind === "full" || f.kind === "ms2"), mrm = E.files.some(f => f.kind === "mrm");
  const w = hostWidth(); let y = 0;
  if (scan) {
    const f0 = E.files.find(f => f.kind !== "mrm");
    const c = addPanel("chrom", { x: 0, y: 0, w, h: 330, full: true });
    const sp = addPanel("spec", { link: c.id, k: f0.k, level: f0.lv, x: 0, y: 340, w, h: 310, full: true });
    y = 660; apexSpectrum(c, sp);
  }
  if (mrm) addPanel("mrm", { x: 0, y, w, h: scan ? 310 : 420, full: true, imode: "man", intf: "all" });     // drag over a peak: every file is integrated in the same window
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
  u.files.forEach(sf => { const f = E.files.find(x => x.file === sf.file); f.label = sf.label || f.label; f.vis = sf.vis !== false; });
  E.cur = Math.min(u.cur || 0, E.files.length - 1); E.browse = !!u.browse; setFold(!!u.fold);
  const kof = n => { const i = E.files.findIndex(f => f.file === n); return i < 0 ? 0 : i; };
  const made = u.panels.map(sp => addPanel(sp.type, {
    ...sp, k: sp.k ? kof(sp.k) : undefined, ref: sp.ref ? kof(sp.ref) : "", bk: sp.bk ? kof(sp.bk) : "", bg: sp.bg === "w" ? "w" : sp.bg ? kof(sp.bg) : "", traces: (sp.traces || []).map(t => ({ id: E.seq++, ...t })), link: null, ints: sp.ints || [], anns: sp.anns || []
  }));
  u.panels.forEach((sp, i) => { if (sp.link >= 0 && made[sp.link]) made[i].link = made[sp.link].id; });
  renderFileList(); return true;
}

function paintFiles() {
  let n = 0;
  E.files.forEach(f => {
    if (f.type === "blank") f.color = "#8a8a8a";
    else if (f.type === "standard") f.color = PAL[(n++ + 3) % PAL.length];
    else f.color = PAL[n++ % PAL.length];
  });
}
function renderFileList() {
  // files grouped by experiment type (Full scan, MS2, MRM...): the type is written once per group, not per file
  const groups = [];
  E.files.forEach(f => { const g = kindOf(f); let G = groups.find(x => x.g === g); if (!G) groups.push(G = { g, fs: [] }); G.fs.push(f); });
  const row = f => `<div class="fl ${f.k === E.cur ? "cur" : ""}"><input type="checkbox" data-k="${f.k}" ${f.vis ? "checked" : ""} title="Mostra o nascondi">
    <i style="background:${f.color}"></i><div><b class="nm" data-k="${f.k}" title="Clic per scegliere il file corrente, doppio clic per rinominare">${EH(f.label)}</b>
    <small>${f.type === "sample" ? (f.time != null ? f.time + " min" : "") : (f.type === "blank" ? "bianco" : "standard" + (f.conc != null ? " " + f.conc + " " + (f.cunit || "") : ""))}</small>
</div></div>`;
  Q("#flst").innerHTML = groups.map(G => `<div class="fgh"><input type="checkbox" class="gall" data-g="${EH(G.g)}" ${G.fs.every(f => f.vis) ? "checked" : ""} title="Mostra o nascondi tutto il gruppo"><span>${EH(G.g)}</span><em>${G.fs.length}</em></div>` + G.fs.map(row).join("")).join("");
  Q("#flst").querySelectorAll(".gall").forEach(x => x.onchange = () => { E.files.filter(f => kindOf(f) === x.dataset.g).forEach(f => f.vis = x.checked); renderFileList(); redrawAll(); uiSave(); });
  Q("#flst").querySelectorAll("input[data-k]").forEach(x => x.onchange = () => { E.files[+x.dataset.k].vis = x.checked; redrawAll(); uiSave(); });
  Q("#flst").querySelectorAll(".nm").forEach(x => {
    x.onclick = () => { E.cur = +x.dataset.k; renderFileList(); renderNav(); if (E.browse) redrawAll(); };
    x.ondblclick = async () => { const f = E.files[+x.dataset.k], v = await ask("Nome del campione", f.label); if (v) { f.label = v; renderFileList(); renderNav(); redrawAll(); uiSave(); } };
  });
  renderNav();
}
// quick file chooser opened from a graph header: tick/untick files (same switch as the list on the left), click a name to show only that file
function fileMenu(btn) {
  Q("#fpop")?.remove();
  const d = document.createElement("div"); d.id = "fpop";
  const paint = () => {
    const gs = []; E.files.forEach(f => { const g = kindOf(f); let G = gs.find(x => x.g === g); if (!G) gs.push(G = { g, fs: [] }); G.fs.push(f); });
    d.innerHTML = `<div class="fpb"><button data-all="1">Tutti</button><button data-all="0">Nessuno</button></div>` + gs.map(G => `<div class="fgh"><span>${EH(G.g)}</span></div>` + G.fs.map(f => `<label><input type="checkbox" data-k="${f.k}" ${f.vis ? "checked" : ""}><i style="background:${f.color}"></i><span class="fn" data-k="${f.k}" title="Clic: mostra solo questo file">${EH(f.label)}</span></label>`).join("")).join("");
    const done = () => { renderFileList(); redrawAll(); uiSave(); };
    d.querySelectorAll("[data-all]").forEach(b => b.onclick = () => { E.files.forEach(f => f.vis = b.dataset.all === "1"); paint(); done(); });
    d.querySelectorAll("input").forEach(i => i.onchange = () => { E.files[+i.dataset.k].vis = i.checked; done(); });
    d.querySelectorAll(".fn").forEach(n => n.onclick = e => { e.preventDefault(); E.files.forEach(f => f.vis = f.k === +n.dataset.k); paint(); done(); });
  };
  paint(); document.body.appendChild(d);
  const r = btn.getBoundingClientRect(); d.style.left = Math.min(r.left, innerWidth - 240) + "px"; d.style.top = r.bottom + 4 + "px";
  setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!d.contains(e.target)) { d.remove(); document.removeEventListener("mousedown", h); } }), 0);
}
const vis = () => E.files.filter(f => f.vis);
const shown = () => E.browse && E.files[E.cur] ? [E.files[E.cur]] : vis();
const scanFiles = l => l.filter(f => f.kind !== "mrm");

// ------------------------------------------------------------------ barra: frecce tra i file, metodo, esporta
function renderNav() {
  const s = Q("#fsel"); if (!s) return;
  s.innerHTML = E.files.map(f => `<option value="${f.k}" ${f.k === E.cur ? "selected" : ""}>${EH(f.label)}</option>`).join("");
  Q("#fbrowse").checked = E.browse;
}
function goFile(d) {
  if (!E.files.length) return;
  E.cur = (E.cur + d + E.files.length) % E.files.length; E.browse = true;
  renderFileList(); redrawAll(); uiSave();
}
Q("#fprev").onclick = () => goFile(-1); Q("#fnext").onclick = () => goFile(1);
Q("#fsel").onchange = e => { E.cur = +e.target.value; renderFileList(); if (E.browse) redrawAll(); uiSave(); };
Q("#fbrowse").onchange = e => { E.browse = e.target.checked; redrawAll(); uiSave(); };
document.addEventListener("keydown", e => {
  if (S.view !== "data" || !E.files.length || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "") || Q("dialog[open]")) return;
  const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!dir) return;
  e.preventDefault();
  const ap = E.active;                       // active panel with a cursor: arrows = previous/next scan; otherwise arrows change file
  if (ap && E.panels.includes(ap) && ap.cur != null && ap._a && ap._a.sr) stepScan(ap, dir); else goFile(dir);
});
document.addEventListener("mousedown", e => { if (E.active && e.target.closest("#dpanels") && !e.target.closest(".pnl")) setActive(null); });
function toolbar() {
  const scan = E.files.some(f => f.kind !== "mrm"), mrm = E.files.some(f => f.kind === "mrm");
  Q("#np-spec").hidden = !scan; Q("#np-map").hidden = !scan; Q("#np-xic").hidden = !scan; Q("#np-mrm").hidden = !mrm; Q("#np-cal").hidden = !mrm; Q("#calbar").hidden = !mrm; if (mrm && window.calbar) calbar();
}

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
    d.textContent = it.label;
    if (it.dim) d.className = "dim"; else d.onclick = () => { m.hidden = true; it.fn(); };
    m.appendChild(d);
  });
  m.hidden = false;
  m.style.left = Math.min(ev.clientX, innerWidth - 270) + "px";
  m.style.top = Math.max(4, Math.min(ev.clientY, innerHeight - m.offsetHeight - 8)) + "px";
}
document.addEventListener("click", () => { Q("#ctx").hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") Q("#ctx").hidden = true; });
function dl(name, text, type = "text/csv") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// CSV for Excel in Italian: ";" between columns, decimal comma, UTF-8 with BOM (accents), headers in Italian
const cell = v => typeof v === "number" ? (Number.isFinite(v) ? String(+v.toPrecision(10)).replace(".", ",") : "") : `"${String(v ?? "").replace(/"/g, '""')}"`;
const csvOf = (cols, rows, heads) => "\ufeff" + (heads || cols).map(cell).join(";") + "\r\n" + rows.map(r => cols.map(c => cell(r[c])).join(";")).join("\r\n") + "\r\n";
const INT_COLS = ["panel", "ion", "file", "time", "a", "b", "rt", "area", "height"];
const INT_HEADS = ["Pannello", "Traccia", "Campione", "Tempo di trattamento (min)", "RT inizio (min)", "RT fine (min)", "RT apice (min)", "Area (conteggi*s)", "Altezza (cps)"];
// data of a plot as columns side by side (each trace has its own x): for graphs and tables made in Excel
function plotCsv(p) {
  const a = p._a; if (!a) return null;
  const cols = [];
  if (p.type === "spec") a.data.forEach(x => { cols.push([`m/z (${x.f.label})`, x.d.mz], [`Intensità cps (${x.f.label})`, x.d.y]); });
  else if (a.sr) a.sr.forEach(sr => { cols.push([`RT min (${sr.name})`, sr.x], [`Intensità cps (${sr.name})`, sr.y]); });
  if (!cols.length) return null;
  const n = Math.max(...cols.map(c => c[1].length)), rows = [];
  for (let i = 0; i < n; i++) rows.push(cols.map(c => (i < c[1].length ? cell(c[1][i]) : "")).join(";"));
  return "\ufeff" + cols.map(c => cell(c[0])).join(";") + "\r\n" + rows.join("\r\n") + "\r\n";
}

// ------------------------------------------------------------------ pannelli mobili
function place(w, h) {
  // a new panel goes under the existing ones, as wide as the page
  const W = w || hostWidth(), H = h || 300;
  const y = E.panels.length ? Math.max(...E.panels.map(p => p.y + p.h)) + 10 : 0;
  return { x: 0, y, w: W, h: H, full: !w };
}
// fixed slots: full-width panels sit one under the other; dragging one up or down makes the others change place
// (final = false: the dragged panel follows the mouse; final = true: it drops into its slot)
function restack(drag, final) {
  const st = E.panels.filter(q => q.full && q.el);
  const others = st.filter(q => q !== drag).sort((a, b) => a.y - b.y), c = drag.y + drag.h / 2;
  const idx = others.filter(q => q.y + q.h / 2 < c).length;
  const order = others.slice(); order.splice(idx, 0, drag);
  let y = 0;
  order.forEach(q => { if (q !== drag || final) q.y = y; if (q !== drag) apply(q); y += q.h + 10; });
  if (final) apply(drag);
  E.panels.sort((a, b) => a.y - b.y || a.id - b.id);
}
function relayout() {      // after a panel changes height: keep the order, close or open the gap
  let y = 0; E.panels.filter(q => q.full && q.el).sort((a, b) => a.y - b.y || a.id - b.id).forEach(q => { q.y = y; apply(q); y += q.h + 10; });
}
function fitHost() { Q("#dpanels").style.height = Math.max(520, ...E.panels.map(p => p.y + p.h + 16)) + "px"; }
function tile() {
  const w = hostWidth(); let y = 0;
  E.panels.forEach(p => { Object.assign(p, { x: 0, y, w, h: p.h || 310, full: true }); y += p.h + 10; apply(p); draw(p); });
  fitHost(); uiSave();
}
const apply = p => { p.el.style.left = p.x + "px"; p.el.style.top = p.y + "px"; p.el.style.width = p.w + "px"; p.el.style.height = p.h + "px"; };

function addPanel(type, o, after) {
  const p = { id: E.seq++, type, anns: [], ints: [], ...o };
  const lv0 = (E.files[o?.k ?? 0] || {}).lv || 1;
  if (type === "chrom") Object.assign(p, { prec: o.prec ?? null, kind: o.kind || "tic", sel: null, cur: null, smooth: o.smooth ?? true, zoom: o.zoom || null, title: o.title || "Cromatogramma" });
  if (type === "spec") Object.assign(p, { k: o.k ?? 0, all: !!o.all, r0: o.r0 ?? null, r1: o.r1 ?? null, level: o.level ?? lv0, prec: o.prec ?? null, zoom: o.zoom || null, title: o.title || "Spettro di massa" });
  if (type === "xic") Object.assign(p, { traces: o.traces || [], tol: o.tol ?? xw(), smooth: o.smooth ?? true, sel: null, cur: null, zoom: o.zoom || null, title: o.title || "Ione estratto (XIC)" });
  if (type === "mrm") Object.assign(p, { tr: o.tr ?? "", smooth: false, sel: null, cur: null, zoom: o.zoom || null, title: o.title || "Transizioni MRM", _trs: [] });
  if (type === "map") Object.assign(p, { k: o.k ?? 0, scale: o.scale || "sqrt", ref: o.ref ?? "", zoom: o.zoom || null, zoomY: o.zoomY || null, sel: null, cur: null, title: o.title || "Mappa RT-m/z" });
  if (type !== "spec" && type !== "map") Object.assign(p, { mode: o.mode || "ovl", log: !!o.log, hid: o.hid || {} });
  if (type !== "spec" && type !== "map") Object.assign(p, { bk: o.bk ?? "", snip: !!o.snip, snipw: o.snipw ?? 1 });
  if (type === "xic") p.adduct = o.adduct || defAdduct();
  if (type === "spec") Object.assign(p, { bg: o.bg ?? "", bw0: o.bw0 ?? null, bw1: o.bw1 ?? null });
  if (type !== "xic") p.traces = p.traces || [];
  const g = (p.w && p.h) ? { x: p.x ?? 0, y: p.y ?? 0, w: p.w, h: p.h } : place();
  Object.assign(p, g);
  const el = document.createElement("div");
  el.className = "card pnl " + type;
  el.innerHTML = `<div class="hd"><b class="ttl" title="Doppio clic per rinominare"></b>${helpBtn("pnl-" + type)}<span class="ctl"></span><span class="rd"></span>${type === "chrom" || type === "xic" || type === "mrm" ? `<button class="bt" data-a="izoom" title="Zoom: attivalo e trascina sul grafico l'intervallo di tempo da ingrandire (il pulsante con i quattro angoli torna alla vista intera). Ctrl o Cmd + rotella ingrandisce anche senza attivarlo">${IC_ZOOM}</button><button class="bt" data-a="iauto" title="Integrazione automatica: clicca su un picco e il programma trova i bordi e ne mostra l'area (poi puoi trascinare le barre)">${IC_AUTO}</button><button class="bt" data-a="iman" title="Integrazione manuale: trascina sul grafico l'intervallo da integrare">${IC_MAN}</button><select class="bt" data-a="intf" hidden title="Quale traccia integrare: quella su cui clicchi, tutte le visibili oppure un file preciso"></select><button class="bt" data-a="iclr" hidden title="Cancella tutte le integrazioni di questo grafico">Pulisci integrazioni</button><button class="bt" data-a="itab" hidden title="Tabella delle aree integrate e cinetica">${IC_TAB}</button>` : ""}${type === "chrom" ? '<button class="bt" data-a="xic" title="Estrai uno ione (XIC): scegli la finestra di m/z. Si integra solo dagli XIC">XIC</button>' : ""}<button class="bt" data-a="fit" style="display:none" title="Torna a vedere tutto il grafico">${IC_FIT}</button><button class="bt" data-a="png" title="Salva il grafico come immagine PNG">${IC_DL}PNG</button>${type === "map" || type === "chrom" ? "" : '<button class="bt" data-a="csv" title="Salva i dati del grafico (le tracce visibili) in un file CSV da aprire con Excel">' + IC_DL + 'CSV</button>'}<button class="bt" data-a="max" title="Ingrandisci o riduci questo pannello">&#9633;</button><button class="x" title="Chiudi il pannello">&times;</button></div><canvas></canvas><div class="vl" hidden></div><div class="tip" hidden></div><div class="leg"></div>`;
  p.el = el; p.vl = el.querySelector(".vl"); p.tip = el.querySelector(".tip"); p.cv = el.querySelector("canvas"); p.rd = el.querySelector(".rd"); p.leg = el.querySelector(".leg");
  Q("#dpanels").appendChild(el);
  E.panels.push(p); apply(p); fitHost();
  // sposta (trascina l'intestazione), porta davanti, ridimensiona (maniglia in basso a destra), ingrandisci
  el.addEventListener("mousedown", () => { front(el); setActive(p); });
  el.querySelector(".hd").addEventListener("mousedown", e => {
    if (e.target.closest("input,select,button,label,option") || el.classList.contains("max")) return;
    const sx = e.clientX - p.x, sy = e.clientY - p.y;
    if (p.full) el.classList.add("drag");
    const mv = ev => {
      p.y = Math.max(0, ev.clientY - sy);
      if (p.full) { p.x = 0; restack(p, false); } else p.x = Math.max(0, ev.clientX - sx);
      apply(p); fitHost();
    };
    const up = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); if (p.full) { el.classList.remove("drag"); restack(p, true); } uiSave(); };
    addEventListener("mousemove", mv); addEventListener("mouseup", up); e.preventDefault();
  });
  let first = true;
  p._ro = new ResizeObserver(() => {
    if (first) { first = false; return; }
    if (!el.classList.contains("max") && el.offsetWidth > 60) { p.w = el.offsetWidth; p.h = el.offsetHeight; if (p.full && Math.abs(p.w - Q("#dpanels").clientWidth) > 8) p.full = false; if (p.full) relayout(); fitHost(); uiSave(); }
    cancelAnimationFrame(p._raf); p._raf = requestAnimationFrame(() => draw(p));
  });
  p._ro.observe(el); p._ro.observe(p.cv);   // the canvas too: it shrinks when the legend or the controls wrap to more lines
  el.querySelector('[data-a="max"]').onclick = () => { el.classList.toggle("max"); front(el); };
  const csvB = el.querySelector('[data-a="csv"]');
  if (csvB) csvB.onclick = () => { const t = plotCsv(p); if (t) dl(plotName(p) + ".csv", t); else info("Nessun dato da salvare in questo grafico."); };
  el.querySelector('[data-a="fit"]').onclick = () => { p.zoom = null; p.zoomY = null; draw(p); };
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
    el.querySelector('[data-a="iclr"]').onclick = () => { p.ints = []; draw(p); };
    el.querySelector('[data-a="intf"]').onchange = e => { p.intf = e.target.value; };
  }
  if (bX) bX.onclick = () => openXic(null);
  el.querySelector(".x").onclick = () => { p._ro.disconnect(); if (p._up) removeEventListener("mouseup", p._up); el.remove(); E.panels = E.panels.filter(x => x !== p); relayout(); fitHost(); uiSave(); };
  el.querySelector(".ttl").ondblclick = async () => { const v = await ask("Nome del pannello", p.title); if (v) { p.title = v; ctl(p); uiSave(); } };
  attach(p); ctl(p); p.ready = draw(p);
  return p;
}
const redrawAll = () => E.panels.forEach(draw);
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
  const parts = [...p.leg.children].map(x => x.textContent.trim()).filter(Boolean), f = E.files[p.k];
  return (p.all || !f ? "" : f.label + " · ") + parts.slice(0, 1).join("") + (parts.length > 1 ? " · " + parts.slice(1).join(", ") : "");
}

// bring a panel to the front (z-index is renumbered before it can reach the menus, which sit above 10000)
function front(el) {
  el.style.zIndex = ++E.z;
  if (E.z > 5000) { E.panels.slice().sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0)).forEach((q, i) => { q.el.style.zIndex = 10 + i; }); E.z = 10 + E.panels.length; el.style.zIndex = ++E.z; }
}
// active panel (outlined): its cursor can be moved scan by scan with the arrow keys
function setActive(p) { E.active = p; E.panels.forEach(q => q.el.classList.toggle("act", q === p)); }
function stepScan(p, d) {
  const a = p._a, ok = s => E.files[s.k]?.kind !== "mrm";
  const k = nearestFile(p, p.cur), s = a.sr.find(x => x.k === k && ok(x)) || a.sr.find(ok) || a.sr[0]; if (!s || !s.x.length) return;
  const i = Math.max(0, Math.min(s.x.length - 1, nearIdx(s.x, p.cur) + d)), rt = s.x[i];
  p.cur = rt; p.sel = null;
  if (p.zoom && (rt < p.zoom[0] || rt > p.zoom[1])) { const w = p.zoom[1] - p.zoom[0]; p.zoom = clampView(rt - w / 2, rt + w / 2, a.full[0], a.full[1]); }
  const dt = Math.abs(s.x[Math.min(i + 1, s.x.length - 1)] - s.x[Math.max(i - 1, 0)]) / 2 || scanStep();
  draw(p); pushLinked(p, rt - dt / 2, rt + dt / 2, s.k, true);
  p.rd.textContent = `scansione ${i + 1}/${s.x.length} · RT ${rt.toFixed(3)} min`;
}
// "zoom bar" in the top margin: where the visible window sits in the whole axis, plus the visible range in words; "Vista intera" button
function afterDraw(p) {
  const btn = p.el.querySelector('[data-a="fit"]'), z = !!(p._a && (p.zoom || p.zoomY));
  if (btn) btn.style.display = z ? "" : "none";
  const tb = p.el.querySelector('[data-a="itab"]'); if (tb) tb.hidden = !p.ints.length;
  const cb = p.el.querySelector('[data-a="iclr"]'); if (cb) cb.hidden = !p.ints.length;
  refreshIntf(p);
  if (!z || p._exp) return;
  const a = p._a, g = p.cv.getContext("2d"), bw = 90, x = a.W - M.r - bw, y = 3, f0 = a.full[0], f1 = a.full[1], u = p.type === "spec" ? "m/z" : "RT";
  const txt = `${u} ${a.x0.toFixed(p.type === "spec" ? 1 : 2)}-${a.x1.toFixed(p.type === "spec" ? 1 : 2)}` + (p.type === "spec" ? "" : " min") + (a.map && p.zoomY ? ` · m/z ${a.y0.toFixed(0)}-${a.y1.toFixed(0)}` : "");
  g.save(); g.font = "10px system-ui"; g.textAlign = "right"; g.fillStyle = css("--muted"); g.fillText("ingrandito: " + txt, x - 6, y + 7);
  g.fillStyle = "rgba(120,120,120,.25)"; g.fillRect(x, y, bw, 6);
  g.fillStyle = css("--accent"); const l = x + (a.x0 - f0) / (f1 - f0) * bw, r = x + (a.x1 - f0) / (f1 - f0) * bw; g.fillRect(l, y, Math.max(2, r - l), 6);
  g.restore();
}
// ---- names and metadata of the saved images / CSV files
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
  t.textContent = p.title;
  const chk = (k, lab) => `<label class="muted"><input type="checkbox" data-o="${k}" ${p[k] ? "checked" : ""}> ${lab}</label>`;
  const view = `<select data-o="mode" title="Come disegnare più tracce: una sopra l'altra, oppure una per riga (come in FreeStyle)"><option value="ovl" ${p.mode !== "stk" ? "selected" : ""}>sovrapposti</option><option value="stk" ${p.mode === "stk" ? "selected" : ""}>impilati</option></select>${chk("log", "scala log")}`;
  const sfl = scanFiles(E.files), mlo = Math.min(...sfl.map(x => x.mz_min ?? Infinity)), mhi = Math.max(...sfl.map(x => x.mz_max ?? -Infinity));
  const mzbar = `<label class="muted" title="Mostra il cromatogramma costruito solo con gli ioni in questo intervallo di m/z (una cifra decimale). Vuoto = tutti gli ioni. Serve per togliere dal TIC gli m/z che non ti interessano (solvente, fondo)"><i>m/z</i> da <input data-o="mz0" class="mzf" inputmode="decimal" autocomplete="off" value="${p.mz0 != null ? p.mz0.toFixed(1) : ""}" placeholder="${isFinite(mlo) ? mlo.toFixed(1) : ""}"> a <input data-o="mz1" class="mzf" inputmode="decimal" autocomplete="off" value="${p.mz1 != null ? p.mz1.toFixed(1) : ""}" placeholder="${isFinite(mhi) ? mhi.toFixed(1) : ""}"></label>`;
  const hasScan = sfl.length > 0, ms2s = E.files.filter(x => x.kind === "ms2"), hasPda = E.files.some(x => x.pda);
  if (p.type === "chrom" && ((!hasScan && p.kind === "bpc") || (!hasPda && p.kind === "pda"))) p.kind = "tic";      // options that make no sense for these files are switched off
  const precs = [...new Set(ms2s.flatMap(x => x.precursors))].sort((a, b) => a - b);
  const precSel = precs.length && p.kind !== "pda" ? `<select data-o="prec" style="flex:none" title="File MS2 (ioni prodotto): somma di tutti i precursori oppure solo gli scan di un precursore"><option value="">MS2: tutti i precursori</option>${precs.map(v => `<option value="${v}" ${String(p.prec) === String(v) ? "selected" : ""}>MS2: precursore ${v}</option>`).join("")}</select>` : "";
  const nbk = E.files.filter(x => x.kind !== "mrm" || p.type === "mrm");
  const corr = `<select data-o="bk" title="Sottrae il file «bianco» da ogni traccia (interpolando sul tempo e portando a zero i valori negativi). Il bianco indica cosa c'è anche senza il campione: ciò che resta è più probabilmente suo">${`<option value="">bianco: nessuno</option>` + nbk.map(x => `<option value="${x.k}" ${String(p.bk) === String(x.k) ? "selected" : ""}>sottrai ${EH(x.label)}</option>`).join("")}</select>${chk("snip", "baseline")}${p.snip ? `<label class="muted" title="Larghezza della finestra SNIP: deve essere più larga dei picchi">&le;<input data-o="snipw" type="number" step="0.5" min="0.2" value="${p.snipw}" style="width:50px"> min</label>` : ""}`;
  const fsel = `<button data-o="fpop" class="fcount" title="Scegli al volo quali file mostrare (vale per tutti i grafici, come la lista a sinistra)">File ${E.files.filter(f => f.vis).length}/${E.files.length} &#9662;</button>`;
  if (p.type === "chrom") c.innerHTML = `<select data-o="kind"><option value="tic" ${p.kind === "tic" ? "selected" : ""}>TIC (somma)</option><option value="bpc" ${p.kind === "bpc" ? "selected" : ""} ${hasScan ? "" : "disabled"} title="Picco base: lo ione più intenso di ogni scan. Non esiste nei file MRM (si registrano solo le transizioni scelte)">BPC (picco base)</option><option value="pda" ${p.kind === "pda" ? "selected" : ""} ${hasPda ? "" : "disabled"} title="Segnale del rivelatore a serie di diodi (PDA/UV): non dipende dallo spettrometro di massa">PDA (UV, totale)</option></select>${p.kind === "pda" ? "" : precSel + (hasScan ? mzbar : "")}${chk("smooth", "smoothing")}${view}${corr}`;
  if (p.type === "xic") {
    p._xt = Math.min(p._xt || 0, Math.max(0, p.traces.length - 1));
    const xt = p.traces[p._xt], xw1 = xt ? (xt.w ?? p.tol) : 0;
    const xsel = p.traces.length > 1 ? `<select data-o="xt" title="Quale XIC modificare">${p.traces.map((t, i) => `<option value="${i}" ${i === p._xt ? "selected" : ""}>XIC ${i + 1}</option>`).join("")}</select>` : "";
    const xr = xt ? `${xsel}<label class="muted" title="Intervallo di m/z estratto (XIC). Scrivi i due estremi e premi Invio"><i>m/z</i> da <input data-o="xlo" class="mzf" inputmode="decimal" autocomplete="off" value="${(xt.mz - xw1).toFixed(1)}"> a <input data-o="xhi" class="mzf" inputmode="decimal" autocomplete="off" value="${(xt.mz + xw1).toFixed(1)}"></label>` : "";
    c.innerHTML = `${xr}<button data-o="addb" title="Aggiunge un altro XIC a questo pannello: scegli la finestra di m/z">+ XIC</button>${fsel}${chk("smooth", "smoothing")}${view}${corr}${p.traces.length > 1 ? '<button data-o="split" title="Un pannello per ogni ione">Separa</button>' : ""}`;
  }
  if (p.type === "mrm") c.innerHTML = `<select data-o="tr" title="Transizione"><option value="">tutte le transizioni</option>${p._trs.map(t => `<option value="${t.key}" ${p.tr === t.key ? "selected" : ""}>${t.key} ${EH(t.name)}</option>`).join("")}</select>${fsel}${chk("smooth", "smoothing")}${view}${corr}<button data-o="cal" title="Tabella delle aree dei file MRM e retta di taratura (concentrazione contro area)">Retta di taratura</button>`;
  if (p.type === "map") {
    const sf = E.files.filter(x => x.kind !== "mrm"), opt = (v, cur, lab) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${EH(lab)}</option>`;
    c.innerHTML = `<select data-o="k" title="File da mostrare">${sf.map(x => opt(x.k, p.k, x.label)).join("")}</select>` +
      `<select data-o="scale" title="Scala dei colori: la radice quadrata fa emergere i segnali deboli">${opt("sqrt", p.scale, "colori: radice")}${opt("lin", p.scale, "colori: lineare")}${opt("log", p.scale, "colori: log")}</select>` +
      `<label class="muted" title="Sottrae un altro file: in rosso ciò che è più intenso nel file mostrato, in blu ciò che è più intenso nel riferimento">differenza con <select data-o="ref"><option value="">nessuno</option>${sf.map(x => opt(x.k, p.ref, x.label)).join("")}</select></label>`;
  }
  if (p.type === "spec") {
    const f = E.files, hasMs2 = f.some(x => x.ms2);
    c.innerHTML = `<select data-o="k">${f.filter(x => x.kind !== "mrm").map(x => `<option value="${x.k}" ${x.k === p.k ? "selected" : ""}>${EH(x.label)}</option>`).join("")}</select>${chk("all", "sovrapponi i file")}` +
      (hasMs2 ? `<select data-o="level"><option value="1" ${p.level === 1 ? "selected" : ""}>MS1</option><option value="2" ${p.level === 2 ? "selected" : ""}>MS2</option></select>` : "") +
      `<select data-o="bg" title="Sottrae uno spettro di fondo (come «Subtract spectrum» di Xcalibur): un altro intervallo di tempo dello stesso file, oppure lo stesso intervallo nel bianco. I valori negativi diventano zero">` +
      `<option value="">fondo: nessuno</option><option value="w" ${p.bg === "w" ? "selected" : ""}>fondo: altro intervallo</option>${f.filter(x => x.kind !== "mrm").map(x => `<option value="${x.k}" ${String(p.bg) === String(x.k) ? "selected" : ""}>fondo: ${EH(x.label)}</option>`).join("")}</select>` +
      (p.bg === "w" ? `<label class="muted">da <input data-o="bw0" type="number" step="0.1" value="${p.bw0 ?? ""}" style="width:56px"> a <input data-o="bw1" type="number" step="0.1" value="${p.bw1 ?? ""}" style="width:56px"> min</label>` : "") +
      (p.level === 2 ? `<select data-o="prec"><option value="">tutti i precursori</option>${[...new Set(f.flatMap(x => x.precursors))].sort((a, b) => a - b).map(v => `<option value="${v}" ${String(p.prec) === String(v) ? "selected" : ""}>precursore ${v}</option>`).join("")}</select>` : "");
  }
  c.querySelectorAll("[data-o]").forEach(x => {
    const k = x.dataset.o;
    if (k === "addb") x.onclick = () => openXic(p);
    else if (k === "fpop") x.onclick = e => { e.stopPropagation(); fileMenu(x); };
    else if (k === "xt") x.onchange = () => { p._xt = +x.value; ctl(p); };
    else if (k === "xlo" || k === "xhi") x.onchange = () => {
      const t = p.traces[p._xt], lo = num1(c.querySelector('[data-o="xlo"]').value), hi = num1(c.querySelector('[data-o="xhi"]').value);
      if (t && lo != null && hi != null && hi > lo) { t.mz = Math.round((lo + hi) / 2 * 100) / 100; t.w = (hi - lo) / 2; t.label = `m/z ${lo.toFixed(1)}-${hi.toFixed(1)}`; E.xw = Math.round(t.w * 1000) / 1000; }
      ctl(p); draw(p);
    };
    else if (k === "split") x.onclick = () => splitPanel(p);
    else if (k === "cal") x.onclick = () => openCalib();
        else x.onchange = () => {
      p[k] = (k === "mz0" || k === "mz1") ? num1(x.value) : x.type === "checkbox" ? x.checked : x.type === "number" ? +x.value : (k === "k" || k === "level") ? +x.value : x.value === "" ? (k === "fk" || k === "tr" ? "" : null) : x.value;
      if (k === "bk" || k === "bg") p[k] = x.value === "" ? "" : x.value === "w" ? "w" : +x.value;
      if (["level", "all", "snip", "bg", "kind", "mz0", "mz1"].includes(k)) ctl(p);
      draw(p);
    };
  });
}
function addTrace(p, mz, label, w) {
  mz = w != null ? Math.round(mz * 100) / 100 : Math.round(mz * 10) / 10;       // unit-resolution instrument: one decimal is all that means anything
  p.traces.push({ id: E.seq++, mz, w: w ?? null, label: label || "m/z " + mz.toFixed(1) });
  ctl(p); draw(p);
}
function num1(t) { const v = parseFloat(String(t).replace(",", ".")); return isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null; }
// XIC dialog: m/z (or formula) and the extraction window chosen by the student ("da ... a ..."); half width remembered for the next one
const xw = () => E.xw ?? TOL0;
function openXic(panel) {
  const d = Q("#xicdlg"), q = Q("#xic-q"), lo = Q("#xic-lo"), hi = Q("#xic-hi"), sum = Q("#xic-sum"), err = Q("#xic-err"), ad = Q("#xic-ad");
  ad.innerHTML = ["[M+H]+", "[M+Na]+", "[M+NH4]+", "[M-H]-", "[M+Cl]-", "[M+HCOO]-"].map(a => `<option ${a === defAdduct() ? "selected" : ""}>${a}</option>`).join("");
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  let label = "", pending = Promise.resolve();
  const upd = () => { const a = num1(lo.value), b = num1(hi.value); sum.innerHTML = a != null && b != null && b > a ? `Si estrae l'intervallo <i>m/z</i> ${f1(a)}-${f1(b)} (centro ${f1((a + b) / 2)}, larghezza ${f1(b - a)} Da).` : ""; };
  const setWin = c => { lo.value = f1(Math.max(0.1, c - xw())); hi.value = f1(c + xw()); upd(); };
  const fromQ = () => pending = (async () => {
    const t = q.value.trim().replace(",", "."); err.textContent = ""; label = ""; if (!t) return;
    if (/^\d+(\.\d*)?$/.test(t)) return setWin(parseFloat(t));
    try { const r = await getFormula(t, ad.value); label = `${r.formula} ${r.adduct}`; setWin(r.mz1); } catch (e) { err.textContent = "Formula non valida: " + e.message; }
  })();
  q.value = ""; lo.value = hi.value = ""; err.textContent = ""; upd();
  q.onchange = ad.onchange = fromQ; lo.oninput = hi.oninput = upd;
  q.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); fromQ(); } };
  lo.onkeydown = hi.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); Q("#xic-go").click(); } };
  Q("#xic-no").onclick = () => d.close();
  Q("#xic-go").onclick = async () => {
    await pending;
    const a = num1(lo.value), b = num1(hi.value);
    if (a == null || b == null || !(b > a)) { err.textContent = "Scrivi la finestra: «da» deve essere minore di «a» (una cifra decimale)."; return; }
    E.xw = Math.round((b - a) / 2 * 1000) / 1000;
    const mz = (a + b) / 2, w = (b - a) / 2, lab = (label ? label + " · " : "") + `m/z ${f1(a)}-${f1(b)}`;
    d.close();
    if (panel && E.panels.includes(panel)) addTrace(panel, mz, lab, w);
    else addPanel("xic", { traces: [{ id: E.seq++, mz: Math.round(mz * 100) / 100, w, label: lab }] });
  };
  d.showModal(); q.focus();
}
function splitPanel(p) {
  const rest = p.traces.slice(1); p.traces = p.traces.slice(0, 1); ctl(p); draw(p);
  rest.forEach(t => addPanel("xic", { traces: [t], tol: p.tol, smooth: p.smooth, mode: p.mode, log: p.log }));
}
function mergeXics() {
  const xs = E.panels.filter(p => p.type === "xic");
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
async function corrected(p, all) {
  const hasBk = p.bk !== "" && p.bk != null && E.files[+p.bk];
  if (!hasBk && !p.snip) return all;
  const out = [];
  for (const s of all) {
    if (hasBk && s.k === +p.bk) continue;                   // the blank itself is the thing being subtracted
    let y = s.y.slice(), note = [];
    if (hasBk) { const b = await blankTrace(p, s); if (b) { y = y.map((v, i) => Math.max(0, v - interp(b.x, b.y, s.x[i]))); note.push("- bianco"); } }
    if (p.snip && s.x.length > 5) {
      const dts = s.x.slice(1).map((v, i) => v - s.x[i]).sort((a, b) => a - b), dt = dts[dts.length >> 1] || 0.01;
      const w = Math.max(2, Math.round((p.snipw || 1) / dt / 2)), bl = snipBaseline(y, w);
      y = y.map((v, i) => Math.max(0, v - bl[i])); note.push("- baseline");
    }
    out.push({ ...s, y, corr: note.join(" ") });
  }
  return out;
}
async function seriesOf(p) { return corrected(p, await rawSeries(p)); }
async function rawSeries(p) {
  if (p.type === "chrom") {
    let fl = shown();
    if (p.kind !== "pda" && fl.some(f => f.kind !== "mrm")) fl = fl.filter(f => f.kind !== "mrm");   // MRM files have their own panel: their TIC would be a flat line here
    const r = await Promise.all(fl.map(f => getChrom(f.k, p.kind, f.lv, p.kind === "pda" ? null : p.mz0, p.kind === "pda" ? null : p.mz1, p.kind !== "pda" && f.kind === "ms2" ? p.prec : null).then(d => ({ x: d.rt, y: d.y, color: f.color, dash: f.type === "blank" ? [4, 3] : [], name: f.label, k: f.k, key: `c|${f.k}|${p.kind}`, ion: p.kind.toUpperCase(), time: f.time }))));
    return r.filter(s => s.x.length);
  }
  const files = shown();
  if (p.type === "xic") {
    const ts = p.traces, out = [];
    scanFiles(files).forEach((f, fi) => ts.forEach((t, ti) => out.push(getXic(f.k, t.mz, t.w ?? p.tol, f.lv).then(d => ({
      x: d.rt, y: d.y, k: f.k, mz: t.mz, tid: t.id, key: `x|${f.k}|${t.mz}`, ion: t.label, time: f.time,
      color: ts.length === 1 ? f.color : PAL[ti % PAL.length], dash: f.type === "blank" ? [4, 3] : ts.length > 1 && fi > 0 ? [[], [6, 3], [2, 3], [8, 3, 2, 3]][fi % 4] : [],
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
      dash: f.type === "blank" ? [4, 3] : !single && fi > 0 ? [[], [6, 3], [2, 3], [8, 3, 2, 3]][fi % 4] : [], name: mf.length > 1 ? `${key} · ${f.label}` : `${key} ${t.name || ""}`.trim(), tid_label: `${key} ${t.name || ""}`.trim() });
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
const XT_RT = "Tempo di ritenzione (min)", YT_I = "Intensità (cps)";
async function draw(p) {
  if (!p.cv.clientWidth || p.cv.clientWidth < 30) return;
  try { if (p.type === "spec") await drawSpec(p); else if (p.type === "map") await drawMap(p); else await drawLines(p); afterDraw(p); uiSave(); } catch (e) { p.rd.textContent = "errore: " + e.message; }
}
const MSG = { xic: "Scrivi un m/z qui sopra, oppure clic destro su un picco dello spettro.", chrom: "Nessun file visibile (o nessun cromatogramma in questo tipo di file).", mrm: "Nessun file MRM visibile." };
const isHid = (p, s) => !!(p.hid && (p.hid[s.key] || (s.mz != null && p.hid["t" + s.mz])));

function legend(p, all, note = "") {
  const sw = c => `<i style="background:${c}"></i>`, off = h => (h ? " off" : "");
  if (p.type === "xic") {
    p.leg.innerHTML = p.traces.map(t => `<span class="tr${off(p.hid["t" + t.mz])}"><span class="tg" data-h="t${t.mz}" title="Clic: mostra o nascondi">${sw(p.traces.length === 1 ? "var(--accent)" : PAL[p.traces.indexOf(t) % PAL.length])}</span><b data-t="${t.id}" title="Doppio clic per rinominare">${fmtFormula(t.label)}</b> ${t.w == null ? `<span>(${t.mz} ±${p.tol})</span>` : ""}<button data-r="${t.id}" title="Togli questo ione">&times;</button></span>`).join("") +
      (p.traces.length === 1 ? scanFiles(shown()).map(f => `<span class="tg${off(p.hid["x|" + f.k + "|" + p.traces[0].mz])}" data-h="x|${f.k}|${p.traces[0].mz}" title="Clic: mostra o nascondi">${sw(f.color)}${EH(f.label)}</span>`).join("")
        : (all.length > p.traces.length ? `<span class="sm">più ioni e più file: linea piena = primo file, tratteggi = gli altri (oppure scegli «solo...» in alto)</span>` : ""));
  } else p.leg.innerHTML = all.map(s => `<span class="tg${off(isHid(p, s))}" data-h="${s.key}" title="Clic: mostra o nascondi">${sw(s.color)}${EH(s.name)}</span>`).join("");
  if (note) p.leg.insertAdjacentHTML("beforeend", `<span class="sm">${EH(note)}</span>`);
  p.leg.querySelectorAll("[data-t]").forEach(b => b.ondblclick = async () => { const t = p.traces.find(x => x.id == b.dataset.t), v = await ask("Nome dell'ione", t.label); if (v) { t.label = v; draw(p); } });
  p.leg.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { p.traces = p.traces.filter(x => x.id != b.dataset.r); ctl(p); draw(p); });
  p.leg.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { const k = b.dataset.h; if (p.hid[k]) delete p.hid[k]; else p.hid[k] = true; draw(p); });
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
  const stk = p.mode === "stk", logy = !!p.log && !stk && p.kind !== "pda", G = Math.max(...sr.map(s => s.mx));
  // unità del grafico: sovrapposti = intensità; impilati = riga i + frazione dell'altezza (scala comune)
  sr.forEach((s, i) => { s.off = stk ? i : 0; s.sc = stk ? G / 0.92 : 1; });
  const U = (s, v) => s.off + v / s.sc;
  const ymax = stk ? sr.length : G * (p.ints.length ? 1.2 : 1.08);   // room above the peaks for the area labels
  let ymin = 0;                                          // PDA and baseline-corrected traces can be negative: extend the axis instead of drawing outside it
  if (!stk && !logy) for (const s of sr) for (let i = 0; i < s.x.length; i++) if (s.x[i] >= x0 && s.x[i] <= x1 && s.ys[i] < ymin) ymin = s.ys[i];
  if (ymin < 0) ymin *= 1.08;
  const lo10 = Math.pow(10, Math.max(0, Math.floor(Math.log10(ymax)) - 4));
  const yt = stk ? "Intensità (righe separate)" : logy ? YT_I + ", scala log" : p.kind === "pda" && p.type === "chrom" ? "Segnale PDA (unità del file)" : YT_I;
  const { X, Y } = axes(g, W, H, x0, x1, ymax, fmt, { log: logy, lo: lo10, stack: stk, xt: XT_RT, yt, ymin });
  const ph = H - M.t - M.b;
  p._a = { x0, x1, X, Y, W, H, sr, ymax, U, stk, logy, full: [lo, hi], yinv: py => ymin + (H - M.b - py) / ph * (ymax - ymin) };
  if (p.sel && !p._exp) { g.fillStyle = "rgba(43,92,138,.10)"; g.fillRect(X(p.sel[0]), M.t, X(p.sel[1]) - X(p.sel[0]), H - M.t - M.b); }
  if (stk) {
    g.font = "11px system-ui"; g.textAlign = "left";
    sr.forEach(s => { const y = Y(s.off); g.strokeStyle = css("--line"); g.beginPath(); g.moveTo(M.l, y); g.lineTo(W - M.r, y); g.stroke(); const t = s.name.length > 34 ? s.name.slice(0, 33) + "…" : s.name; g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = css("--panel"); g.strokeText(t, M.l + 4, y - 4); g.fillStyle = s.color; g.fillText(t, M.l + 4, y - 4); g.lineWidth = 1; });
  }
  g.save(); g.beginPath(); g.rect(M.l + 1.5, M.t - 1, W - M.l - M.r - 1.5, H - M.t - M.b + 2); g.clip();   // the line (1.8 px wide) must not overdraw the y axis
  for (const s of sr) {
    g.strokeStyle = s.color; g.lineWidth = s.dash.length ? 1.5 : 1.8; g.setLineDash(s.dash); g.beginPath(); let st = false;
    s.x.forEach((r, i) => { if (r < x0 || r > x1) return; const px = X(r), py = Y(U(s, s.ys[i])); st ? g.lineTo(px, py) : g.moveTo(px, py); st = true; });
    g.stroke();
  }
  g.restore(); g.setLineDash([]);
  for (const it of p.ints) {                          // integrazioni: area colorata + barre trascinabili ai bordi
    const s = sr.find(q => q.key === it.key); if (!s) continue;
    const r = integ(s, it.a, it.b); Object.assign(it, { area: r.area, height: r.height, rt: r.rt });
    const i0 = nearIdx(s.x, Math.min(it.a, it.b)), i1 = nearIdx(s.x, Math.max(it.a, it.b));
    if (i1 > i0) {
      g.globalAlpha = 0.28; g.fillStyle = s.color; g.beginPath(); g.moveTo(X(s.x[i0]), Y(U(s, s.ys[i0])));
      for (let j = i0; j <= i1; j++) g.lineTo(X(s.x[j]), Y(U(s, s.ys[j])));
      g.lineTo(X(s.x[i1]), Y(U(s, s.ys[i1]))); g.closePath(); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = s.color; g.lineWidth = 1; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(X(s.x[i0]), Y(U(s, s.ys[i0]))); g.lineTo(X(s.x[i1]), Y(U(s, s.ys[i1]))); g.stroke(); g.setLineDash([]);
    }
    g.strokeStyle = s.color; g.lineWidth = 2.2;
    for (const e of ["a", "b"]) { const px = X(it[e]); g.beginPath(); g.moveTo(px, M.t + 10); g.lineTo(px, H - M.b); g.stroke(); g.fillStyle = s.color; g.fillRect(px - 4, M.t, 8, 12); }
    const ay = Math.max(M.t + 28, Y(U(s, s.ys[nearIdx(s.x, r.rt)])) - 9), lab = "A = " + fmt(r.area) + (sr.length > 1 ? " · " + s.name : "");   // above the apex, never on the peak
    g.font = "bold 11px system-ui"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = css("--panel"); g.strokeText(lab, X(r.rt), ay); g.fillStyle = css("--ink"); g.fillText(lab, X(r.rt), ay); g.lineWidth = 1; g.font = "11px system-ui";
  }
  if (p.cur != null && !p._exp) { g.strokeStyle = css("--muted"); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(p.cur), M.t); g.lineTo(X(p.cur), H - M.b); g.stroke(); g.setLineDash([]); }
  for (const a of p.anns) {
    let top = 0; sr.forEach(s => { const i = nearIdx(s.x, a.x); top = Math.max(top, U(s, s.ys[i])); });
    const px = X(a.x), py = Y(top);
    g.strokeStyle = css("--accent"); g.lineWidth = 1; g.beginPath(); g.moveTo(px, py - 3); g.lineTo(px, py - 12); g.stroke();
    g.fillStyle = css("--ink"); g.font = "bold 11px system-ui"; g.textAlign = "center"; g.fillText(a.text, px, py - 15); g.font = "11px system-ui";
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
  const a = p._a; if (!a || !a.hov || px < M.l || px > a.W - M.r || py < M.t || py > a.H - M.b) return hideHover(p);
  const h = a.hov(px, py); if (!h) return hideHover(p);
  const cv = p.cv, el = p.el;
  p.vl.hidden = false; p.vl.style.left = cv.offsetLeft + h.px + "px"; p.vl.style.top = cv.offsetTop + M.t + "px"; p.vl.style.height = a.H - M.t - M.b + "px";
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
function mapImage(p, A, B, scale) {
  const key = `${A.k}|${B ? B.k : ""}|${scale}`;
  if (p._img && p._img.key === key && p._img.a === A.m && p._img.b === (B ? B.m : null)) return p._img;
  const n = A.m.length, v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = B ? A.m[i] - B.m[i] : A.m[i];
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
  return (p._img = { key, off, v, ref, a: A.m, b: B ? B.m : null });
}
async function drawMap(p) {
  const { g, W, H } = setup(p.cv);
  const say = t => { g.clearRect(0, 0, W, H); g.fillStyle = css("--muted"); g.fillText(t, M.l, 30); p.leg.innerHTML = ""; p._a = null; };
  const sf = scanFiles(E.files); if (!sf.length) return say("Servono file full scan o MS2: i file MRM non hanno scan.");
  let f = E.browse && E.files[E.cur] && E.files[E.cur].kind !== "mrm" ? E.files[E.cur] : E.files[p.k];
  if (!f || f.kind === "mrm") f = sf[0];
  const lv = f.lv, rf = p.ref !== "" && p.ref != null && E.files[+p.ref] && E.files[+p.ref].kind !== "mrm" && E.files[+p.ref].lv === lv && +p.ref !== f.k ? E.files[+p.ref] : null;
  const A = { ...(await getMap(f.k, lv)), k: f.k }, B = rf ? { ...(await getMap(rf.k, lv)), k: rf.k } : null;
  const im = mapImage(p, A, B, p.scale);
  const rt0 = A.rt0, rt1 = A.rt1, mzA = A.mz0, mzB = A.mz0 + A.nmz * A.dmz;
  const x0 = p.zoom ? p.zoom[0] : rt0, x1 = p.zoom ? p.zoom[1] : rt1, y0 = p.zoomY ? p.zoomY[0] : mzA, y1 = p.zoomY ? p.zoomY[1] : mzB;
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
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
  p.leg.innerHTML = `<span><i style="background:${f.color}"></i>${EH(f.label)}${B ? " meno " + EH(rf.label) : ""}</span><span class="cbar" style="background:${bar}"></span><span class="sm">${B ? "rosso: più intenso qui · blu: più intenso nel riferimento" : "colore = intensità media (scala " + ({ sqrt: "radice", lin: "lineare", log: "log" }[p.scale]) + ")"}</span><span class="sm">trascina: spettro su quell'intervallo · clic destro: XIC dell'm/z</span>`;
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
  const base = (ys[i0] + ys[i1]) / 2 * (xs[i1] - xs[i0]) * 60;
  const hb = ys[i0] + (ys[i1] - ys[i0]) * (xs[at] - xs[i0]) / ((xs[i1] - xs[i0]) || 1);
  return { area: Math.max(ar - base, 0), height: Math.max(mx - hb, 0), rt: xs[at] };       // conteggi x s, baseline lineare
}
function autoEdges(s, x) {
  const xs = s.x, ys = s.ys || s.y;
  let lo = nearIdx(xs, x - 0.25), hi = nearIdx(xs, x + 0.25), m = lo;
  for (let j = lo; j <= hi; j++) if (ys[j] > ys[m]) m = j;
  const w0 = nearIdx(xs, xs[m] - 1), w1 = nearIdx(xs, xs[m] + 1);
  let base = Infinity; for (let j = w0; j <= w1; j++) base = Math.min(base, ys[j]);
  const h = ys[m] - base, lim = base + 0.04 * h;
  let l = m, r = m;
  while (l > 0 && ys[l - 1] <= ys[l] * 1.02 && ys[l] > lim) l--;
  while (r < ys.length - 1 && ys[r + 1] <= ys[r] * 1.02 && ys[r] > lim) r++;
  return [xs[l], xs[r]];
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
function addInt(p, s, a, b) {
  if (p.type === "mrm") p.ints = p.ints.filter(i => i.key !== s.key);       // calibration: one peak per transition and file, a new window replaces the old one
  else if (p.ints.some(i => i.key === s.key && Math.abs(i.a - Math.min(a, b)) < 1e-6 && Math.abs(i.b - Math.max(a, b)) < 1e-6)) return;     // same peak clicked twice
  const f = E.files[s.k];
  p.ints.push({ id: E.seq++, k: s.k, key: s.key, a: Math.min(a, b), b: Math.max(a, b), name: s.name, ion: s.ion || s.name, file: f ? f.label : "", time: f ? f.time : null, panel: p.title });
  draw(p);
}
function intMenuItems(p, x, near, py) {
  const items = [], a = p._a;
  items.push({ label: "Integra il picco qui (automatico, poi sposta le barre)", fn: () => { if (!guardInt(p)) return; intTargets(p, x, py).forEach(s => { const [l, r] = autoEdges(s, x); addInt(p, s, l, r); }); } });
  if (p.sel) items.push({ label: `Integra l'intervallo selezionato (${p.sel[0].toFixed(2)}-${p.sel[1].toFixed(2)} min, tutte le tracce)`, fn: () => { if (guardInt(p)) a.sr.forEach(s => addInt(p, s, p.sel[0], p.sel[1])); } });
  if (p.sel && p.sel[1] > p.sel[0]) items.push({ label: `Ingrandisci l'intervallo selezionato (${p.sel[0].toFixed(2)}-${p.sel[1].toFixed(2)} min)`, fn: () => { const [s0, s1] = p.sel; const w = (s1 - s0) * 0.1; zoomTo(p, s0 - w, s1 + w); } });
  const nearInt = p.ints.find(it => x >= Math.min(it.a, it.b) && x <= Math.max(it.a, it.b));
  if (nearInt) items.push({ label: "Elimina questa integrazione", fn: () => { p.ints = p.ints.filter(i => i !== nearInt); draw(p); } });
  if (p.ints.length) items.push({ label: "Elimina tutte le integrazioni di questo pannello", fn: () => { p.ints = []; draw(p); } });
  items.push({ label: "Tabella delle integrazioni e cinetica...", fn: showInts });
  return items;
}
function allInts() { return E.panels.flatMap(p => p.ints.map(i => ({ ...i, panel: p.title }))); }
function showInts() {
  const rows = allInts();
  big("Integrazioni dei picchi", rows.length ? `<div class="bar"><button id="ig-csv">Esporta CSV</button><label class="muted"><input type="checkbox" id="ig-rel"> area relativa al massimo di ogni ione</label></div>
    <table><tr><th>Pannello</th><th>Traccia</th><th>Campione</th><th class="num">Tempo (min)</th><th class="num">RT inizio</th><th class="num">RT fine</th><th class="num">RT apice</th><th class="num">Area (conteggi·s)</th><th class="num">Altezza</th></tr>` +
    rows.map(r => `<tr><td>${EH(r.panel)}</td><td>${EH(r.ion)}</td><td>${EH(r.file)}</td><td class="num">${r.time ?? ""}</td><td class="num">${r.a.toFixed(2)}</td><td class="num">${r.b.toFixed(2)}</td><td class="num">${(r.rt ?? 0).toFixed(2)}</td><td class="num">${fmt(r.area ?? 0)}</td><td class="num">${fmt(r.height ?? 0)}</td></tr>`).join("") +
    `</table><div class="muted sm">Area: regola dei trapezi con baseline lineare tra i due bordi. Trascina le barre nel pannello per correggere i bordi.</div>
    <h4>Area contro tempo di irraggiamento</h4><canvas id="ig-cv" style="height:240px"></canvas><div class="leg" id="ig-leg"></div>`
    : `<div class="muted">Nessuna integrazione. Clic destro su un picco di un cromatogramma, di un XIC o di una transizione MRM e scegli «Integra».</div>`, () => {
    if (!rows.length) return;
    Q("#ig-csv").onclick = () => dl("integrazioni.csv", csvOf(INT_COLS, rows, INT_HEADS));
    const plot = () => {
      const cv = Q("#ig-cv"), { g, W, H } = setup(cv), rel = Q("#ig-rel").checked;
      const groups = {}; rows.forEach(r => { if (r.time != null) (groups[r.ion] = groups[r.ion] || []).push(r); });
      const names = Object.keys(groups); g.clearRect(0, 0, W, H);
      if (!names.length) { g.fillStyle = css("--muted"); g.fillText("Servono campioni con il tempo di irraggiamento (scheda Dati, tempi dei file).", M.l, 30); return; }
      const val = (n, r) => rel ? (r.area || 0) / Math.max(...groups[n].map(q => q.area || 0), 1e-9) : (r.area || 0);
      const xs = rows.filter(r => r.time != null).map(r => r.time), x0 = Math.min(...xs), x1 = Math.max(...xs), ymax = Math.max(1e-9, ...names.flatMap(n => groups[n].map(r => val(n, r)))) * 1.08;
      const { X, Y } = axes(g, W, H, x0 === x1 ? x0 - 1 : x0, x0 === x1 ? x1 + 1 : x1, ymax, v => rel ? Math.round(v * 100) + "%" : fmt(v), { xt: "Tempo di irraggiamento (min)", yt: rel ? "Area relativa (%)" : "Area (conteggi·s)" });
      names.forEach((n, i) => {
        const pts = groups[n].slice().sort((a, b) => a.time - b.time), c = PAL[i % PAL.length];
        g.strokeStyle = g.fillStyle = c; g.lineWidth = 1.8; g.beginPath(); pts.forEach((r, j) => { const px = X(r.time), py = Y(val(n, r)); j ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
        pts.forEach(r => { g.beginPath(); g.arc(X(r.time), Y(val(n, r)), 3.5, 0, 7); g.fill(); });
      });
      Q("#ig-leg").innerHTML = names.map((n, i) => `<span><i style="background:${PAL[i % PAL.length]}"></i>${EH(n)}</span>`).join("");
    };
    Q("#ig-rel").onchange = plot; plot();
  });
}

// ------------------------------------------------------------------ spettri
// simulated isotope spectrum of a formula, drawn in the lower part of the spectrum panel on the same m/z axis
function drawSim(p, g, W, H, HF, x0, x1) {
  const h2 = HF - H; if (h2 < 90) return;
  g.save(); g.translate(0, H); g.beginPath(); g.rect(0, 0, W, h2); g.clip();
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, h2);
  try {
    const ion = QQQRef.ionCounts(p.sim.formula, p.sim.ad), pat = QQQRef.isoPattern(ion.n, ion.z);
    const { X, Y } = axes(g, W, h2, x0, x1, 118, v => v, { xt: "m/z", yt: "Abbondanza relativa (%)", xn: Math.max(10, Math.round((W - M.l - M.r) / 48)) });
    g.globalCompositeOperation = "destination-over"; g.fillStyle = "rgba(43,92,138,.08)"; g.fillRect(0, 0, W, h2); g.globalCompositeOperation = "source-over";
    g.strokeStyle = css("--accent"); g.lineWidth = 2.5;
    for (const r of pat) {
      const px = X(r.mz); if (px < M.l || px > W - M.r) continue;
      g.beginPath(); g.moveTo(px, Y(0)); g.lineTo(px, Y(r.rel)); g.stroke();
      if (r.rel >= 1) { g.fillStyle = css("--ink"); g.font = "10.5px system-ui"; g.textAlign = "center"; g.fillText((r.off ? "M+" + r.off : "M") + " · " + r.mz.toFixed(1), px, Y(r.rel) - 14); g.fillText((r.rel < 10 ? r.rel.toFixed(1) : Math.round(r.rel)) + "%", px, Y(r.rel) - 3); }
    }
    g.font = "bold 12px system-ui"; g.textAlign = "left"; g.fillStyle = css("--accent");
    g.textAlign = "right"; g.fillText(`Spettro simulato: ${p.sim.formula} ${p.sim.ad} (risoluzione unitaria)`, W - M.r - 8, M.t + 12);
  } catch (e) { g.fillStyle = css("--bad"); g.fillText("Spettro simulato: " + e.message, M.l, 30); }
  g.restore(); g.font = "11px system-ui";
}
async function simSpec(p) {
  const v = await ask("Formula bruta della molecola neutra (es. C9H10Cl2N2O). Facoltativo l'addotto dopo uno spazio, es. <b>C9H10Cl2N2O [M+Na]+</b>; senza addotto: " + EH(defAdduct()), p.sim ? p.sim.formula + " " + p.sim.ad : "");
  if (!v) return;
  const mm = v.match(/^\s*(\S+)\s*(\[.*\].*)?$/); if (!mm) return;
  try {
    const r = await getFormula(mm[1], ""); p.sim = { formula: r.formula, ad: (mm[2] || defAdduct()).trim() };
    const ion = QQQRef.ionCounts(p.sim.formula, p.sim.ad), pat = QQQRef.isoPattern(ion.n, ion.z);
    p.zoom = [pat[0].mz - 4, pat[pat.length - 1].mz + 4];
    if (!p.h0) { p.h0 = p.h; p.h += 260; apply(p); relayout(); fitHost(); }
    ctl(p); draw(p); uiSave();
  } catch (e) { info("Non riesco a simulare lo spettro: " + EH(e.message)); }
}
function unsim(p) { p.sim = null; p.h = p.h0 || 310; p.h0 = null; apply(p); relayout(); fitHost(); draw(p); uiSave(); }
async function drawSpec(p) {
  const { g, W, H: HF } = setup(p.cv);
  const H = p.sim ? Math.round(HF * 0.5) : HF;           // simulated isotope spectrum: the observed one keeps the upper half
  const say = t => { g.clearRect(0, 0, W, HF); g.fillStyle = css("--muted"); g.fillText(t, M.l, 30); p.leg.innerHTML = ""; p._a = null; };
  const base = p.all ? shown() : [E.files[E.browse ? E.cur : p.k]];
  const files = scanFiles(base.filter(Boolean));
  if (!files.length) return say("Questo file è MRM: contiene solo cromatogrammi di transizioni, non spettri.");
  if (p.r0 == null) return say("Clicca o trascina sul cromatogramma per scegliere l'intervallo di tempo.");
  const bgOf = f => p.bg === "w" ? (p.bw0 != null && p.bw1 != null && p.bw1 > p.bw0 ? [f.k, p.bw0, p.bw1] : null)
    : (p.bg !== "" && p.bg != null && +p.bg !== f.k ? [+p.bg, p.r0, p.r1] : null);
  const data = await Promise.all(files.map(f => getSpec(f.k, p.r0, p.r1, p.level, p.prec, bgOf(f)).then(d => ({ f, d }))));
  const mzs = data.flatMap(x => x.d.mz);
  if (!mzs.length) return say("Nessuno scan in questo intervallo (per MS2: scegli il precursore e il livello giusto).");
  const x0 = p.zoom ? p.zoom[0] : Math.min(...mzs) - 2, x1 = p.zoom ? p.zoom[1] : Math.max(...mzs) + 2;
  const inr = data.map(x => x.d.y.filter((_, i) => x.d.mz[i] >= x0 && x.d.mz[i] <= x1));
  const ymax = Math.max(1e-9, ...inr.flat()) * 1.12;
  const { X, Y } = axes(g, W, H, x0, x1, ymax, fmt, { xt: "m/z", yt: YT_I, xn: Math.max(10, Math.round((W - M.l - M.r) / 48)) });
  p._a = { x0, x1, X, Y, W, H, data, ymax, full: [Math.min(...mzs) - 2, Math.max(...mzs) + 2] };
  p._a.hov = px => {                                       // picco più vicino al mouse
    let best = null;
    data.forEach(x => x.d.mz.forEach((m, j) => { if (m < x0 || m > x1 || x.d.y[j] <= 0) return; const dd = Math.abs(X(m) - px); if (dd < 14 && (!best || dd < best.dd)) best = { dd, m, y: x.d.y[j], f: x.f }; }));
    return best && { px: X(best.m), html: `<b>m/z ${best.m.toFixed(2)}</b><div>intensità <b>${fmt(best.y)}</b></div>${data.length > 1 ? `<div class="sm">${EH(best.f.label)}</div>` : ""}` };
  };
  data.forEach(x => {
    g.strokeStyle = x.f.color; g.lineWidth = 1.4; g.beginPath();
    x.d.mz.forEach((m, j) => { if (m < x0 || m > x1) return; g.moveTo(X(m), Y(0)); g.lineTo(X(m), Y(x.d.y[j])); }); g.stroke();
  });
  const d0 = data[0].d, pk = [];
  d0.mz.forEach((m, j) => { if (m >= x0 && m <= x1 && d0.y[j] >= 0.04 * ymax) pk.push([m, d0.y[j]]); });
  pk.sort((a, b) => b[1] - a[1]); const used = [];
  g.fillStyle = css("--ink"); g.textAlign = "center"; g.font = "10.5px system-ui";
  for (const [m, y] of pk.slice(0, 40)) { const px = X(m); if (used.some(u => Math.abs(u - px) < 26) || used.length >= 18) continue; used.push(px); g.fillText(m.toFixed(1), px, Y(y) - 4); }
  g.font = "11px system-ui";
  for (const a of p.anns) { const px = X(a.x); g.strokeStyle = css("--accent"); g.beginPath(); g.moveTo(px, M.t + 2); g.lineTo(px, M.t + 12); g.stroke(); g.fillStyle = css("--accent"); g.font = "bold 11px system-ui"; g.textAlign = "center"; g.fillText(a.text, px, M.t + 24); g.font = "11px system-ui"; }
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
  if (p.sim && window.QQQRef) drawSim(p, g, W, H, HF, x0, x1);
  p.leg.innerHTML = `<span>${p.level === 2 ? "MS2" : "MS1"} · RT ${p.r0.toFixed(2)}-${p.r1.toFixed(2)} min · ${data.map(x => x.d.scans + " scan").join(", ")}${bgOf(files[0]) ? " · fondo sottratto" : ""}</span>` + (data.length > 1 ? data.map(x => `<span><i style="background:${x.f.color}"></i>${EH(x.f.label)}</span>`).join("") : "") + isoNote;
}

// ------------------------------------------------------------------ mouse
function attach(p) {
  const cv = p.cv;
  let drag = null;
  const xd = px => { const a = p._a; return a ? a.x0 + (px - M.l) / (a.W - M.l - M.r) * (a.x1 - a.x0) : null; };
  const rect = e => { const r = cv.getBoundingClientRect(); return e.clientX - r.left; };
  const recty = e => e.clientY - cv.getBoundingClientRect().top;
  const onCur = px => p.type !== "spec" && p.type !== "map" && p.cur != null && p._a && Math.abs(p._a.X(p.cur) - px) < 6;
  const edgeAt = px => { if (!p._a || p.type === "spec") return null; for (const it of p.ints) for (const e of ["a", "b"]) if (Math.abs(p._a.X(it[e]) - px) < 6) return { it, e }; return null; };
  cv.onmousemove = e => {
    const a = p._a; if (!a) return; const px = rect(e), py = recty(e), x = xd(px);
    if (drag && drag.pan) {                                   // Maiusc + trascina: sposta la vista
      const pw = a.W - M.l - M.r, span = drag.z[1] - drag.z[0], dx = (px - drag.x0) / pw * span;
      p.zoom = clampView(drag.z[0] - dx, drag.z[1] - dx, a.full[0], a.full[1]);
      if (a.map && drag.zy) { const sy = drag.zy[1] - drag.zy[0], dy = (py - drag.y0) / (a.H - M.t - M.b) * sy; p.zoomY = clampView(drag.zy[0] + dy, drag.zy[1] + dy, a.fullY[0], a.fullY[1]); }
      draw(p);
    } else if (drag && drag.cursor) {                         // dragging the vertical line: the linked spectrum follows
      p.cur = Math.max(a.full[0], Math.min(a.full[1], x)); p.sel = null; draw(p);
      if (!p._lm) { p._lm = true; requestAnimationFrame(() => { p._lm = false; const dt = scanStep(); pushLinked(p, p.cur - dt / 2, p.cur + dt / 2, nearestFile(p, p.cur), true); }); }
    } else if (drag && drag.edge) { drag.edge.it[drag.edge.e] = x; draw(p); }
    else if (drag) { drag.x = px; if (p.type === "spec") {
      if (Math.abs(px - drag.x0) > 4) { zr.hidden = false; zr.style.left = cv.offsetLeft + Math.min(px, drag.x0) + "px"; zr.style.width = Math.abs(px - drag.x0) + "px"; zr.style.top = cv.offsetTop + M.t + "px"; zr.style.height = a.H - M.t - M.b + "px"; }
    } else { p.sel = [Math.min(xd(drag.x0), x), Math.max(xd(drag.x0), x)]; draw(p); } }
    else cv.style.cursor = e.shiftKey ? "grab" : edgeAt(px) ? "col-resize" : onCur(px) ? "ew-resize" : p.imode === "zoom" ? "zoom-in" : p.imode ? "cell" : "crosshair";
    p.rd.textContent = p.type === "spec" ? "m/z " + x.toFixed(1) : "RT " + x.toFixed(2) + " min" + (a.map ? " · m/z " + a.mzAt(py).toFixed(1) : "");
    showHover(p, px, py); if (drag) p.tip.hidden = true;
  };
  const zr = document.createElement("div"); zr.className = "zr"; zr.hidden = true; p.el.appendChild(zr);   // area being zoomed (spectrum drag)
  cv.onmouseleave = () => hideHover(p);
  cv.onmousedown = e => {
    if (e.button !== 0 || !p._a) return; const px = rect(e), py = recty(e), a = p._a;
    if (e.shiftKey) { e.preventDefault(); drag = { pan: true, x0: px, y0: py, z: [a.x0, a.x1], zy: a.map ? [a.y0, a.y1] : null }; return; }
    const ed = edgeAt(px); drag = ed ? { edge: ed } : onCur(px) && !p.imode ? { cursor: true } : { x0: px, x: px, y0: py };
  };
  p._up = e => {
    if (!drag) return; const d = drag; drag = null; zr.hidden = true;
    if (d.pan) { uiSave(); return; }
    if (d.edge || d.cursor) { uiSave(); return; }
    const a = p._a, x0 = xd(d.x0), x1 = xd(d.x);
    if (!a || x0 == null) return;
    if (p.imode && p.type !== "spec" && p.type !== "map") {          // zoom and integration tools
      if (p.imode === "zoom") { p.sel = null; if (Math.abs(d.x - d.x0) > 4) zoomTo(p, Math.min(x0, x1), Math.max(x0, x1)); else draw(p); return; }
      if (p.imode === "auto" && Math.abs(d.x - d.x0) <= 4) { if (guardInt(p)) intTargets(p, x0, d.y0).forEach(s => { const [l, r] = autoEdges(s, x0); addInt(p, s, l, r); }); return; }
      if (p.imode === "man" && Math.abs(d.x - d.x0) > 4) { p.sel = null; if (!guardInt(p)) { draw(p); return; } const t = intTargets(p, (x0 + x1) / 2, d.y0); if (t.length) t.forEach(s => addInt(p, s, x0, x1)); else draw(p); return; }
    }
    if (Math.abs(d.x - d.x0) > 4) {
      if (p.type === "spec") { p.zoom = [Math.min(x0, x1), Math.max(x0, x1)]; draw(p); }
      else { p.sel = [Math.min(x0, x1), Math.max(x0, x1)]; draw(p); pushLinked(p, p.sel[0], p.sel[1], nearestFile(p, (x0 + x1) / 2)); }
    } else if (p.type !== "spec") {
      p.sel = null; p.cur = x0; draw(p); const dt = scanStep(); pushLinked(p, x0 - dt / 2, x0 + dt / 2, nearestFile(p, x0));
    }
  };
  addEventListener("mouseup", p._up);
  // Ctrl/Cmd + rotella (o pizzico sul trackpad): zoom attorno al cursore. La rotella da sola continua a far scorrere la pagina.
  cv.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey) || !p._a) return;
    e.preventDefault();
    const a = p._a, f = Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004), x = xd(rect(e));
    if (a.map) { const y = a.mzAt(recty(e)); p.zoomY = clampView(y - (y - a.y0) * f, y + (a.y1 - y) * f, a.fullY[0], a.fullY[1]); }
    zoomTo(p, x - (x - a.x0) * f, x + (a.x1 - x) * f);
  }, { passive: false });
  cv.ondblclick = e => {
    if (p.type === "chrom" || p.type === "xic" || p.type === "mrm") {      // double click = mass spectrum at that retention time (also on the PDA trace)
      const x = xd(rect(e)), k = nearestFile(p, x), f = E.files[k];
      if (!p._a || !f || f.kind === "mrm") return;
      const dt = scanStep(), r0 = x - dt / 2, r1 = x + dt / 2;
      p.sel = null; p.cur = x;
      if (E.panels.some(s => s.type === "spec" && s.link === p.id)) pushLinked(p, r0, r1, k, false); else newSpec(p, r0, r1, k);
      draw(p); return;
    }
    p.zoom = null; p.zoomY = null; p.sel = null; draw(p);
  };
  cv.oncontextmenu = e => { hideHover(p); ctxFor(p, e, xd(rect(e)), rect(e), recty(e)); };
}
const scanStep = () => { const f = scanFiles(E.files)[0]; return f ? Math.max((f.rt_max - f.rt_min) / Math.max(f.ms1 + f.ms2 - 1, 1), 0.005) : 0.02; };
function nearestFile(p, x) {
  const a = p._a; if (a && a.map) return a.f.k; if (!a || !a.sr) return scanFiles(shown())[0]?.k ?? 0;
  let best = null;
  a.sr.forEach(s => { if (E.files[s.k]?.kind === "mrm") return; const v = s.ys[nearIdx(s.x, x)]; if (!best || v > best.v) best = { v, k: s.k }; });
  return best ? best.k : (scanFiles(E.files)[0]?.k ?? 0);
}
function pushLinked(p, r0, r1, k, keepZoom) {
  E.panels.filter(s => s.type === "spec" && s.link === p.id).forEach(s => { s.r0 = r0; s.r1 = r1; s.k = k; if (!keepZoom) s.zoom = null; ctl(s); draw(s); });
}
function newSpec(from, r0, r1, k) { return addPanel("spec", { link: from.id, k, r0, r1, level: E.files[k]?.lv || 1 }, from); }

function ctxFor(p, e, x, px, py) {
  if (!p._a) return e.preventDefault();
  const items = [];
  const near = p.anns.find(a => Math.abs(p._a.X(a.x) - px) < 14);
  if (p.type === "map") {
    const a = p._a, mz = a.mzAt(py), lab = mz.toFixed(1), f = a.f, dt = scanStep();
    items.push({ label: `RT ${x.toFixed(2)} min · m/z ${lab} · ${f.label}`, dim: true }, "-");
    items.push({ label: `Estrai l'XIC di m/z ${lab} in un nuovo pannello`, fn: () => addPanel("xic", { traces: [{ id: E.seq++, mz: +mz.toFixed(1), label: "m/z " + lab }] }, p) });
    E.panels.filter(q => q.type === "xic").forEach(q => items.push({ label: `Aggiungi m/z ${lab} al pannello «${q.title}»`, fn: () => addTrace(q, +mz.toFixed(1)) }));
    items.push("-");
    if (p.sel) items.push({ label: `Spettro mediato su ${p.sel[0].toFixed(2)}-${p.sel[1].toFixed(2)} min (nuovo pannello)`, fn: () => newSpec(p, p.sel[0], p.sel[1], f.k) });
    items.push({ label: "Spettro a questo RT (nuovo pannello)", fn: () => newSpec(p, x - dt / 2, x + dt / 2, f.k) });
  } else if (p.type === "spec") {
    const a = p._a, d0 = a.data[0].d;
    let m = x, bestd = 1e9;
    d0.mz.forEach((v, j) => { const dd = Math.abs(a.X(v) - px); if (dd < 12 && dd < bestd && d0.y[j] > 0) { bestd = dd; m = v; } });
    const lab = m.toFixed(1);
    items.push({ label: `m/z ${m.toFixed(2)}`, dim: true }, "-");
    items.push({ label: `Estrai l'XIC di m/z ${lab} in un nuovo pannello`, fn: () => addPanel("xic", { traces: [{ id: E.seq++, mz: +m.toFixed(2), label: "m/z " + lab }] }, p) });
    E.panels.filter(q => q.type === "xic").forEach(q => items.push({ label: `Aggiungi m/z ${lab} al pannello «${q.title}»`, fn: () => addTrace(q, +m.toFixed(2)) }));
    items.push("-", { label: "Annota questo picco...", fn: async () => { const v = await ask("Annotazione per m/z " + lab, ""); if (v) { p.anns.push({ x: m, text: v }); draw(p); } } });
    items.push("-", { label: p.sim ? `Cambia la formula dello spettro simulato (${p.sim.formula} ${p.sim.ad})...` : "Simula lo spettro isotopico di una formula...", fn: () => simSpec(p) });
    if (p.sim) items.push({ label: "Togli lo spettro simulato", fn: () => unsim(p) });
    items.push("-", { label: "Confronta con il profilo isotopico di una formula...", fn: async () => {
      const v = await ask("Formula della molecola neutra (es. C9H10Cl2N2O). Facoltativo l'addotto dopo uno spazio, es. <b>C9H10Cl2N2O [M+Na]+</b>; senza addotto: " + EH(defAdduct()), p.iso ? p.iso.formula + " " + p.iso.ad : "");
      if (!v) return;
      const mm = v.match(/^\s*(\S+)\s*(\[.*\].*)?$/); if (!mm) return;
      try { const r = await getFormula(mm[1], ""); p.iso = { formula: r.formula, ad: (mm[2] || defAdduct()).trim() };
        const ion = QQQRef.ionCounts(p.iso.formula, p.iso.ad), pat = QQQRef.isoPattern(ion.n, ion.z);
        p.zoom = [pat[0].mz - 4, pat[pat.length - 1].mz + 4]; draw(p); }   // zoom on the pattern (double click: whole spectrum)
      catch (e) { info("Non riesco a calcolare il profilo: " + EH(e.message)); }
    } });
    if (p.iso) items.push({ label: `Togli il profilo isotopico (${p.iso.formula} ${p.iso.ad})`, fn: () => { p.iso = null; draw(p); } });
  } else {
    const k = nearestFile(p, x);
    items.push({ label: `RT ${x.toFixed(2)} min · ${E.files[k]?.label || ""}`, dim: true }, "-");
    const dt = scanStep();
    if (p.type !== "mrm") {
      if (p.sel) items.push({ label: `Spettro mediato su ${p.sel[0].toFixed(2)}-${p.sel[1].toFixed(2)} min (nuovo pannello)`, fn: () => newSpec(p, p.sel[0], p.sel[1], k) });
      items.push({ label: "Spettro a questo RT (nuovo pannello)", fn: () => newSpec(p, x - dt / 2, x + dt / 2, k) });
    }
    if (p.type === "chrom") items.push({ label: "Estrai uno ione (XIC): scrivo l'm/z...", fn: async () => { const v = parseFloat(((await ask("m/z dello ione da estrarre", "")) || "").replace(",", ".")); if (v > 0) addPanel("xic", { traces: [{ id: E.seq++, mz: v, label: "m/z " + v.toFixed(2) }] }, p); } });
    if (p.type === "xic") {
      items.push({ label: "Aggiungi un altro ione a questo pannello...", fn: async () => { const v = parseFloat(((await ask("m/z da aggiungere", "")) || "").replace(",", ".")); if (v > 0) addTrace(p, v); } });
    }
    items.push("-", ...intMenuItems(p, x, near, py));
    items.push("-", { label: "Annota questo punto...", fn: async () => { const v = await ask("Annotazione a RT " + x.toFixed(2), ""); if (v) { p.anns.push({ x, text: v }); draw(p); } } });
  }
  if (near) items.push("-", { label: `Modifica «${near.text}»`, fn: async () => { const v = await ask("Annotazione", near.text); if (v) { near.text = v; draw(p); } } },
    { label: `Elimina «${near.text}»`, fn: () => { p.anns = p.anns.filter(a => a !== near); draw(p); } });
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
  const row = (a, b) => b == null || b === "" ? "" : `<tr><td class="muted">${a}</td><td>${b}</td></tr>`;
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
  const trTbl = m.transitions.length ? `<table><tr><th>Nome</th><th class="num">Q1 (m/z)</th><th class="num">Q3 (m/z)</th><th class="num">CE (eV)</th><th class="num">Dwell (ms)</th></tr>${m.transitions.map(t => `<tr><td>${EH(t.name || "")}</td><td class="num">${t.q1}</td><td class="num">${t.q3}</td><td class="num">${t.ce ?? ""}</td><td class="num">${t.dwell != null ? Math.round(t.dwell * 1000) : ""}</td></tr>`).join("")}</table>` : "";
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
Q("#np-chrom").onclick = () => addPanel("chrom", {});
Q("#np-spec").onclick = () => { const f = scanFiles(vis())[0] || scanFiles(E.files)[0]; addPanel("spec", { k: f?.k ?? 0, level: f?.lv || 1 }); };
Q("#np-xic").onclick = () => openXic(null);
Q("#np-map").onclick = () => { const f = scanFiles(vis())[0] || scanFiles(E.files)[0]; addPanel("map", { k: f?.k ?? 0 }); };
Q("#np-mrm").onclick = () => addPanel("mrm", { imode: "man", intf: "all" });
Q("#np-cal").onclick = () => openCalib();
Q("#np-tile").onclick = tile;
Q("#np-merge").onclick = mergeXics;
Q("#addf").onclick = async () => { S.adding = true; try { const d = await J("api/state"); if (d.methods) { ST.methods = d.methods; renderMethods(); } } catch (_) { /* the list stays as it was */ } applyView(); };
addEventListener("resize", () => { fitWidth(); redrawAll(); });
document.addEventListener("tpview", e => { if (e.detail.view === "data") setTimeout(() => { fitWidth(); redrawAll(); }, 0); });

// ------------------------------------------------------------------ calcolatrice formula -> m/z (come «mass from formula» di Xcalibur)
Q("#np-calc").onclick = () => { Q("#calcdlg").showModal(); Q("#calcin").focus(); };
Q("#calcx").onclick = () => Q("#calcdlg").close();
async function calcRun() {
  const t = Q("#calcin").value.trim(), out = Q("#calcout");
  if (!t) { out.innerHTML = ""; return; }
  try {
    const r = await getFormula(t, "");
    const want = defAdduct();
    out.innerHTML = `<p><b>${fmtFormula(r.formula)}</b> · massa esatta neutra <b>${r.neutral.toFixed(4)}</b> · intera <b>${r.nominal_neutral}</b></p>
      <table><tr><th>addotto</th><th>m/z esatto</th><th>1 decimale</th><th>all'unità</th><th></th></tr>${Object.entries(r.adducts).map(([a, v]) =>
      `<tr${a === want ? ' style="font-weight:600"' : ""}><td>${fmtAdduct(a)}</td><td>${v.mz.toFixed(4)}</td><td>${v.mz1.toFixed(1)}</td><td>${v.nominal}</td><td><button data-a="${EH(a)}" data-m="${v.mz1}" title="Apre un XIC a questo m/z">XIC</button></td></tr>`).join("")}</table>
      <p class="muted sm">L'asse m/z di questo strumento può essere spostato di qualche decimo di Da rispetto al valore teorico: se il picco non cade dove ti aspetti, allarga la finestra dell'XIC.</p>`;
    out.querySelectorAll("button[data-m]").forEach(b => b.onclick = () => {
      const mz = +b.dataset.m, lab = `${r.formula} ${b.dataset.a} (${mz.toFixed(1)})`;
      const px = [...E.panels].reverse().find(q => q.type === "xic");
      if (px) { px.adduct = b.dataset.a; addTrace(px, mz, lab); } else addPanel("xic", { traces: [{ id: E.seq++, mz, label: lab }], adduct: b.dataset.a });
      Q("#calcdlg").close();
    });
  } catch (e) { out.innerHTML = `<p class="muted">${EH(e.message)}</p>`; }
}
Q("#calcin").oninput = calcRun;
