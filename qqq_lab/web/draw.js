// "Disegno": Ketcher (structures, fragments, arrows, text) + OpenChemLib (formula and exact mass).
// Both are bundled in web/vendor: no internet needed. Module script; helpers come from explore.js (window).
import * as OCL from "./vendor/openchemlib.js";

const Q = s => document.querySelector(s);
const EH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtFormula = window.fmtFormula || (f => !f ? "" : EH(f).replace(/([A-Z][a-z]?|\))(\d+)/g, "$1<sub>$2</sub>"));
const fmtAdduct = window.fmtAdduct || (a => !a ? "" : fmtFormula(a).replace(/([+-]+)$/, "<sup>$1</sup>"));
const PROTON = 1.007276, ADDUCTS = {
  pos: [["[M+H]+", 1.007276], ["[M+NH4]+", 18.033825], ["[M+Na]+", 22.989221], ["[M+K]+", 38.963158]],
  neg: [["[M-H]-", -1.007276], ["[M+Cl]-", 34.969402], ["[M+HCOO]-", 44.998203]],
};
let K = null, starting = null, restored = false, timer = null, PARTS = [], CAP = null;

function start() {
  if (starting) return starting;
  const fr = Q("#kframe");
  starting = new Promise((resolve, reject) => {
    const on = e => { if (e.data && e.data.type === "ketcher-ready") { removeEventListener("message", on); K = fr.contentWindow.ketcher; resolve(K); } };
    addEventListener("message", on);
    fr.src = "static/vendor/ketcher/index.html";
    setTimeout(() => reject(new Error("Ketcher non si e' avviato")), 60000);
  }).then(async k => { await restore(); k.editor.subscribe("change", () => { clearTimeout(timer); timer = setTimeout(changed, 500); requestAnimationFrame(drawLabels); requestAnimationFrame(showSelection); });
    k.editor.subscribe("selectionChange", () => requestAnimationFrame(showSelection));
    hideMacro(fr); changed(); drawLabels(); return k; });
  starting.catch(e => { Q("#dcomp").textContent = e.message; });
  return starting;
}
// Ketcher's macromolecule mode (peptides, RNA, DNA) is not needed here and confuses: its switch is hidden
function hideMacro(fr) {
  try {
    const d = fr.contentDocument, st = d.createElement("style");
    st.textContent = '[data-testid="polymer-toggler"]{display:none!important}';
    d.head.appendChild(st);
  } catch (_) { /* not critical */ }
}
async function restore() {
  if (restored || !K) return;
  restored = true;
  if (typeof NB !== "undefined" && NB.ket) { try { await K.setMolecule(NB.ket); } catch (_) { /* old or empty drawing */ } }
  drawLabels();
}
async function changed() {
  if (!K) return;
  let ket = "", smiles = "";
  try { ket = await K.getKet(); smiles = await K.getSmiles(); } catch (_) { return; }
  NB.ket = ket; nbSave();
  list(smiles);
}
const hill = counts => {
  const keys = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  const order = counts.C ? ["C", "H", ...keys.filter(k => k !== "C" && k !== "H")] : keys;
  return order.filter(k => counts[k]).map(k => k + (counts[k] > 1 ? counts[k] : "")).join("");
};
function describe(smi) {
  try {
    const m = OCL.Molecule.fromSmiles(smi), f = m.getMolecularFormula(), counts = {};
    for (const x of f.formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) counts[x[1]] = (counts[x[1]] || 0) + (x[2] ? +x[2] : 1);
    return { smiles: smi, formula: hill(counts), mass: f.absoluteWeight };
  } catch (_) { return null; }
}
function adductTable(d) {
  const main = ["[M+H]+", "[M+Na]+", "[M-H]-"], all = [...ADDUCTS.pos, ...ADDUCTS.neg];
  const row = ([n, dm]) => `<tr><td>${fmtAdduct(n)}</td><td class="num">${(d.mass + dm).toFixed(4)}</td><td>${typeof E !== "undefined" && E.files.length ? `<button class="sm" data-x="${(d.mass + dm).toFixed(2)}" data-l="${d.formula} ${n}">XIC</button>` : ""}</td></tr>`;
  return `<table class="sm">${all.filter(a => main.includes(a[0])).map(row).join("")}</table><details class="sm"><summary class="muted">altri addotti</summary><table class="sm">${all.filter(a => !main.includes(a[0])).map(row).join("")}</table></details>`;
}
function list(smiles) {
  const box = Q("#dcomp");
  const parts = [...new Set(smiles.split(/[.>]+/).map(s => s.trim()).filter(Boolean))];
  PARTS = parts; capParts();
  if (!parts.length) { box.innerHTML = '<div class="muted">Disegna una molecola, un frammento o un intero cammino (frecce e testo sono nella barra a sinistra).</div>'; return; }
  box.innerHTML = parts.map((s, i) => {
    const d = describe(s);
    if (!d) return `<div class="muted sm">${EH(s)}: struttura non riconosciuta (frammento aperto?)</div>`;
    return `<div style="border-bottom:1px solid var(--line);padding:6px 0"><b>${fmtFormula(d.formula)}</b> <span class="muted">massa esatta ${d.mass.toFixed(4)}</span>
      ${adductTable(d)}
      <div class="muted sm" style="word-break:break-all">${EH(s)}</div></div>`;
  }).join("");
  box.querySelectorAll("[data-x]").forEach(b => b.onclick = () => {
    window.setView("data");
    window.addPanel("xic", { traces: [{ id: E.seq++, mz: +b.dataset.x, label: b.dataset.l }] });
  });
}

// ------------------------------------------------------------------ formula and mass written under each structure
// Optional (checkbox "#lb-on"). Drawn in an overlay group of Ketcher's own SVG, so the label follows zoom and scroll
// but is NOT part of the structure (undo, .ket and SMILES are untouched). Added as text to the exported images.
const MONO = { H: 1.00782503, D: 2.01410178, C: 12, N: 14.00307401, O: 15.99491462, F: 18.99840322, Na: 22.98976928, Mg: 23.9850417, Al: 26.98153853,
  Si: 27.97692653, P: 30.97376163, S: 31.97207100, Cl: 34.96885268, K: 38.96370668, Ca: 39.96259098, Fe: 55.9349375, Cu: 62.9295975, Zn: 63.9291422,
  As: 74.9215965, Se: 79.9165213, Br: 78.9183371, Sn: 119.9021947, I: 126.904473, Hg: 201.970643, B: 11.0093054, Li: 7.01600455 };
const ELECTRON = 0.00054858;
const roundHalfUp = v => Math.floor(v + 0.5);
// one entry per connected structure: formula (Hill order), charge, monoisotopic mass, bounding box (Ketcher coordinates, y down)
// counts {C: 8, H: 9, ...} -> Hill formula and monoisotopic mass
function formulaOf(n) {
  const keys = Object.keys(n).filter(k => n[k] > 0).sort();
  const order = n.C > 0 ? ["C", ...(n.H > 0 ? ["H"] : []), ...keys.filter(k => k !== "C" && k !== "H")] : keys;
  return { formula: order.map(k => k + (n[k] > 1 ? n[k] : "")).join(""), mass: order.reduce((m, k) => m + MONO[k] * n[k], 0) };
}
// element counts of some atoms of the drawing (with the H they carry in the drawing); null if an atom has no formula
function countAtoms(atoms) {
  const n = {}; let q = 0;
  for (const a of atoms) {
    if (!(a.label in MONO)) return null;                 // R groups, "any atom", abbreviations: no formula
    n[a.label] = (n[a.label] || 0) + 1;
    const h = a.implicitH || 0; if (h) n.H = (n.H || 0) + h;
    q += a.charge || 0;
  }
  return { n, q };
}
function structures() {
  if (!K) return [];
  const st = K.editor.struct(), ids = [...st.atoms.keys()], up = new Map(ids.map(i => [i, i]));
  const root = i => { while (up.get(i) !== i) { up.set(i, up.get(up.get(i))); i = up.get(i); } return i; };
  st.bonds.forEach(b => { const a = root(b.begin), c = root(b.end); if (a !== c) up.set(a, c); });
  const groups = new Map();
  ids.forEach(i => { const r = root(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(st.atoms.get(i)); });
  const out = [];
  groups.forEach(atoms => {
    const c = countAtoms(atoms); if (!c || !atoms.length) return;
    const xs = atoms.map(a => a.pp.x), ys = atoms.map(a => a.pp.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    out.push({ ...formulaOf(c.n), n: c.n, q: c.q, cx: (x0 + x1) / 2, y: y1, x0, x1, y0, y1 });
  });
  return out;
}
// reaction arrows: what changes from the structure before the arrow to the one after it (e.g. "+O", "-CH2")
function arrowDeltas() {
  if (!K) return [];
  const comps = structures(), out = [];
  K.editor.struct().rxnArrows.forEach(ar => {
    const [p0, p1] = ar.pos, left = p0.x <= p1.x ? p0 : p1, right = p0.x <= p1.x ? p1 : p0, ym = (p0.y + p1.y) / 2;
    const near = c => ym >= c.y0 - 1.5 && ym <= c.y1 + 1.5;                // roughly on the same line as the arrow
    const before = comps.filter(c => near(c) && c.cx < left.x).sort((a, b) => b.x1 - a.x1)[0];
    const after = comps.filter(c => near(c) && c.cx > right.x).sort((a, b) => a.x0 - b.x0)[0];
    if (!before || !after) return;
    const els = [...new Set([...Object.keys(before.n), ...Object.keys(after.n)])], gain = {}, loss = {};
    for (const e of els) { const d = (after.n[e] || 0) - (before.n[e] || 0); if (d > 0) gain[e] = d; if (d < 0) loss[e] = -d; }
    const g = formulaOf(gain).formula, l = formulaOf(loss).formula, dm = after.mass - before.mass;
    const parts = [];
    const push = (sign, f) => { parts.push([sign, ""]); for (const m of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) { parts.push([m[1], ""]); if (m[2]) parts.push([m[2], "sub"]); } parts.push([" ", ""]); };
    if (g) push("+", g); if (l) push("\u2212", l);
    if (!g && !l) parts.push(["stessa formula (isomero) ", ""]);
    parts.push([`\u0394m ${dm >= 0 ? "+" : "\u2212"}${Math.round(Math.abs(dm))}`, ""]);   // unit resolution: the integer is enough
    out.push({ x: (p0.x + p1.x) / 2, y: ym, parts });
  });
  return out;
}
// text of a label as pieces: [text, "sub" | "sup" | ""]
function labelParts(d) {
  const parts = [];
  for (const m of d.formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) { parts.push([m[1], ""]); if (m[2]) parts.push([m[2], "sub"]); }
  if (d.q) parts.push([(Math.abs(d.q) > 1 ? Math.abs(d.q) : "") + (d.q > 0 ? "+" : "−"), "sup"]);
  const v = d.q ? roundHalfUp((d.mass - d.q * ELECTRON) / Math.abs(d.q)) : roundHalfUp(d.mass);
  parts.push([d.q ? `  m/z ${v}` : `  M = ${v}`, ""]);
  return parts;
}
const labelsOn = () => Q("#lb-on").checked;
function drawLabels() {
  if (!K) return;
  const svg = K.editor.render.paper.canvas, doc = svg.ownerDocument, ns = "http://www.w3.org/2000/svg", sc = K.editor.render.options.microModeScale || 40;
  let g = svg.querySelector("#qqq-labels");
  if (!g) { g = doc.createElementNS(ns, "g"); g.id = "qqq-labels"; g.setAttribute("pointer-events", "none"); }
  svg.appendChild(g);                                     // always last: drawn above the structure
  g.textContent = "";
  if (!labelsOn()) return;
  const text = (x, y, parts, color, size) => {
    const t = doc.createElementNS(ns, "text");
    t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-family", "Arial, Helvetica, sans-serif"); t.setAttribute("font-size", size); t.setAttribute("fill", color);
    for (const [txt, k] of parts) {
      const sp = doc.createElementNS(ns, "tspan"); sp.textContent = txt;
      if (k) { sp.setAttribute("font-size", Math.round(size * 0.77)); sp.setAttribute("baseline-shift", k === "sub" ? "sub" : "super"); }
      t.appendChild(sp);
    }
    g.appendChild(t);
  };
  for (const d of structures()) text(d.cx * sc, d.y * sc + 30, labelParts(d), "#3b3b3b", 13);
  for (const a of arrowDeltas()) text(a.x * sc, a.y * sc - 12, a.parts, "#2b5c8a", 12);
}
// the same labels as Ketcher text objects, only in the copy of the drawing that is exported
const SUBC = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089", SUPC = "\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079";
// pieces -> plain text with Unicode subscripts/superscripts (Ketcher's image renderer spaces them better than styled text)
const plain = parts => parts.map(([t, k]) => k === "sub" ? String(t).replace(/\d/g, c => SUBC[+c])
  : k === "sup" ? String(t).replace(/\+/g, "\u207a").replace(/\u2212/g, "\u207b").replace(/\d/g, c => SUPC[+c]) : t).join("");
function ketWithLabels(ket) {
  if (!labelsOn()) return ket;
  const j = JSON.parse(ket);
  const add = (text, x, y, px) => {
    const content = JSON.stringify({ blocks: [{ key: "qqq" + j.root.nodes.length, text, type: "unstyled", depth: 0, inlineStyleRanges: [{ offset: 0, length: text.length, style: `CUSTOM_FONT_SIZE_${px}px` }], entityRanges: [], data: {} }], entityMap: {} });
    j.root.nodes.push({ type: "text", data: { content, position: { x, y, z: 0 } } });
  };
  for (const d of structures()) { const t = plain(labelParts(d)); add(t, d.cx - t.length * 0.105, -(d.y + 0.6), 16); }
  for (const a of arrowDeltas()) { const t = plain(a.parts); add(t, a.x - t.length * 0.09, -(a.y - 0.75), 14); }
  return JSON.stringify(j);
}
Q("#lb-on").addEventListener("change", () => { drawLabels(); NB.labels = labelsOn(); nbSave(); });
document.addEventListener("nbloaded", () => { Q("#lb-on").checked = NB.labels !== false; drawLabels(); });

// ------------------------------------------------------------------ selected atoms: a fragment without breaking bonds
// The H are those the atoms carry in the molecule; every bond to an unselected atom is a cut. The ions are hypotheses
// (even-electron ions, typical of ESI MS/MS): the student compares them with the product ion spectrum.
const HATOM = MONO.H;   // PROTON is defined at the top of the file
function showSelection() {
  const card = Q("#selcard"); if (!K || !card) return;
  const st = K.editor.struct(), ids = (K.editor.selection() || {}).atoms || [];
  if (!ids.length) { card.hidden = true; return; }
  const set = new Set(ids), atoms = ids.map(i => st.atoms.get(i)).filter(Boolean);
  let cuts = 0; st.bonds.forEach(b => { if (set.has(b.begin) !== set.has(b.end)) cuts += (b.type >= 1 && b.type <= 3) ? b.type : 1; });
  const c = countAtoms(atoms); card.hidden = false;
  const body = Q("#selbody");
  if (!c) { body.innerHTML = '<div class="muted sm">Nella selezione c\'è un atomo senza formula (gruppo R, abbreviazione...).</div>'; return; }
  const P = formulaOf(c.n), xic = typeof E !== "undefined" && E.files && E.files.length;
  const row = (lab, f, mz) => `<tr><td>${lab}</td><td>${fmtAdduct(f)}</td><td class="num">${mz.toFixed(4)}</td><td class="num"><b>${Math.round(mz)}</b></td><td>${xic ? `<button class="sm" data-x="${mz.toFixed(1)}" data-l="${EH(f)}">XIC</button>` : ""}</td></tr>`;
  const ion = (n, z) => ({ ...formulaOf(n), z });
  let h = `<div class="sm">${atoms.length} atomi: <b>${fmtFormula(P.formula)}</b>${c.q ? (c.q > 0 ? "<sup>+</sup>" : "<sup>&minus;</sup>") : ""} &middot; ${cuts ? `${cuts} legam${cuts > 1 ? "i" : "e"} tagliat${cuts > 1 ? "i" : "o"}` : "nessun legame tagliato"}</div>`;
  const tbl = [];
  if (c.q) {
    const mz = (P.mass - c.q * ELECTRON) / Math.abs(c.q);
    tbl.push(row("la selezione così com'è (ha già la carica)", P.formula + (c.q > 0 ? "+" : "-"), mz));
  } else if (!cuts) {
    tbl.push(row("[M+H]<sup>+</sup>", formulaOf({ ...c.n, H: (c.n.H || 0) + 1 }).formula + "+", P.mass + PROTON));
    tbl.push(row("[M&minus;H]<sup>&minus;</sup>", formulaOf({ ...c.n, H: (c.n.H || 0) - 1 }).formula + "-", P.mass - PROTON));
  } else {
    const Qn = { ...c.n, H: (c.n.H || 0) + cuts }, Qm = P.mass + cuts * HATOM;          // the piece closed with H
    const acyl = { ...c.n, H: (c.n.H || 0) + cuts - 1 };                                 // charge left on the cut
    h += `<div class="muted sm">Pezzo chiuso con H (molecola neutra): ${fmtFormula(formulaOf(Qn).formula)}, M = ${Qm.toFixed(4)}</div>`;
    tbl.push(row("pezzo + H, protonato (prende un H dall'altra parte)", formulaOf({ ...Qn, H: Qn.H + 1 }).formula + "+", Qm + PROTON));
    tbl.push(row("carica sul taglio (es. acilio, carbocatione)", formulaOf(acyl).formula + "+", formulaOf(acyl).mass - ELECTRON));
    tbl.push(row("ESI&minus;: pezzo chiuso con H, deprotonato", formulaOf({ ...Qn, H: Qn.H - 1 }).formula + "-", Qm - PROTON));
  }
  h += `<table class="sm" style="margin-top:4px"><tr><th>ipotesi</th><th>ione</th><th class="num">m/z</th><th class="num">intero</th><th></th></tr>${tbl.join("")}</table>
    <div class="muted sm">Sono ipotesi da confrontare con lo spettro di ioni prodotto (MS/MS): in ESI i frammenti sono quasi sempre ioni a numero pari di elettroni. Il calcolo usa gli H che gli atomi hanno nel disegno.</div>`;
  body.innerHTML = h;
  body.querySelectorAll("[data-x]").forEach(b => b.onclick = () => { window.setView("data"); window.addPanel("xic", { traces: [{ id: E.seq++, mz: +b.dataset.x, label: b.dataset.l + " (" + b.dataset.x + ")" }] }); });
}

// ------------------------------------------------------------------ caption (name, formula, m/z) for the report
const sub = f => f.replace(/(\d+)/g, "<tspan dy=\"0.28em\" font-size=\"70%\">$1</tspan><tspan dy=\"-0.28em\">\u200b</tspan>");   // graphical subscripts, image only
const svgAdduct = a => {
  let s = EH(a).replace(/([A-Z][a-z]?|\))(\d+)/g, (m, g1, g2) => `${g1}<tspan dy="0.28em" font-size="70%">${g2}</tspan><tspan dy="-0.28em">\u200b</tspan>`);
  return s.replace(/([+-]+)$/, '<tspan dy="-0.32em" font-size="70%">$1</tspan><tspan dy="0.32em">\u200b</tspan>');
};
async function capData() {
  const i = +(Q("#cap-part").value || 0), d = PARTS[i] && describe(PARTS[i]);
  if (!d) return null;
  const ad = Q("#cap-ad").value;
  try {
    const r = await (await fetch(`api/formula?f=${encodeURIComponent(d.formula)}&adduct=${encodeURIComponent(ad)}`)).json();
    if (r.error) return null;
    return { name: Q("#cap-name").value.trim(), formula: r.formula, neutral: r.neutral, adduct: ad, mz: r.mz, mz1: r.mz1, nominal: r.nominal };
  } catch (_) { return null; }
}
const capText = c => `${c.name ? c.name + ": " : ""}${c.formula}; M = ${c.neutral.toFixed(4)}; ${c.adduct} m/z ${c.mz1.toFixed(1)} (esatto ${c.mz.toFixed(4)}); all'unità ${c.nominal}`;
function capParts() {
  const sel = Q("#cap-part"), cur = sel.value;
  sel.innerHTML = PARTS.map((s, i) => { const d = describe(s); return `<option value="${i}">${d ? d.formula : "struttura " + (i + 1)}</option>`; }).join("");
  if (cur && +cur < PARTS.length) sel.value = cur;
  capShow();
}
async function capShow() {
  const c = await capData(), pre = Q("#cap-txt");
  pre.innerHTML = c ? `${c.name ? `<b>${EH(c.name)}:</b> ` : ""}${fmtFormula(c.formula)}; M = ${c.neutral.toFixed(4)}; ${fmtAdduct(c.adduct)} m/z ${c.mz1.toFixed(1)} (esatto ${c.mz.toFixed(4)}); all'unit&agrave; ${c.nominal}` : "Disegna una molecola completa per vedere formula e m/z.";
  NB.cap = { name: Q("#cap-name").value, adduct: Q("#cap-ad").value, on: Q("#cap-on").checked }; nbSave();
}
function addCaption(svgText, c) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml"), root = doc.documentElement;
  let vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some(isNaN)) vb = [0, 0, parseFloat(root.getAttribute("width")) || 400, parseFloat(root.getAttribute("height")) || 300];
  const [x, y, w, h] = vb, lines = [
    c.name ? `<tspan font-weight="bold">${EH(c.name)}</tspan>` : null,
    `${sub(EH(c.formula))}<tspan>  \u00b7  M = ${c.neutral.toFixed(4)}</tspan>`,
    `${svgAdduct(c.adduct)}<tspan>  m/z ${c.mz1.toFixed(1)}  (esatto ${c.mz.toFixed(4)})  \u00b7  all'unit\u00e0: ${c.nominal}</tspan>`,
  ].filter(Boolean);
  const longest = Math.max(c.name.length, c.formula.length + 14, 46), fs = Math.max(8, Math.min(w / (longest * 0.52), w / 16));
  const extra = fs * 1.5 * lines.length + fs * 0.8, bg = Q("#ex-bg").checked ? "#fffbf0" : "#ffffff", ns = "http://www.w3.org/2000/svg";
  doc.querySelectorAll("rect").forEach(q => { if (/^rgb\(100%,\s*100%,\s*100%\)$/.test(q.getAttribute("fill") || "")) q.setAttribute("fill", bg); });   // Ketcher ignores the background option
  const r = doc.createElementNS(ns, "rect"); r.setAttribute("x", x); r.setAttribute("y", y + h); r.setAttribute("width", w); r.setAttribute("height", extra); r.setAttribute("fill", bg); root.appendChild(r);
  lines.forEach((l, i) => {
    const t = doc.createElementNS(ns, "text"); t.setAttribute("x", x + w / 2); t.setAttribute("y", y + h + fs * 1.5 * (i + 1) - fs * 0.2);
    t.setAttribute("text-anchor", "middle"); t.setAttribute("font-family", "Arial, Helvetica, sans-serif"); t.setAttribute("font-size", fs); t.setAttribute("fill", "#000");
    const inner = new DOMParser().parseFromString(`<svg xmlns="${ns}"><text>${l}</text></svg>`, "image/svg+xml").documentElement.firstChild;
    [...inner.childNodes].forEach(n => t.appendChild(doc.importNode(n, true)));
    root.appendChild(t);
  });
  root.setAttribute("viewBox", `${x} ${y} ${w} ${h + extra}`);
  const ph = parseFloat(root.getAttribute("height")); if (ph) root.setAttribute("height", ph * (h + extra) / h);
  return new XMLSerializer().serializeToString(doc);
}
["#cap-name", "#cap-part", "#cap-ad", "#cap-on"].forEach(id => Q(id).addEventListener("input", capShow));
Q("#cap-copy").onclick = async () => { const c = await capData(); if (c) try { await navigator.clipboard.writeText(capText(c)); } catch (_) { /* clipboard blocked */ } };
document.addEventListener("nbloaded", () => { if (NB.cap) { Q("#cap-name").value = NB.cap.name || ""; Q("#cap-ad").value = NB.cap.adduct || "[M+H]+"; Q("#cap-on").checked = NB.cap.on === true; } capShow(); });

// ------------------------------------------------------------------ export
const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
async function image(format) {
  await start();
  const ket = ketWithLabels(await K.getKet()), cream = Q("#ex-bg").checked;
  const svg0 = await K.generateImage(ket, { outputFormat: "svg", backgroundColor: cream ? "255,251,240" : "255,255,255" });
  let svgText = await svg0.text();
  const cap = Q("#cap-on").checked ? await capData() : null;
  if (cap) svgText = addCaption(svgText, cap);
  const svg = new Blob([svgText], { type: "image/svg+xml" });
  if (format === "svg") return svg;
  // PNG / JPEG: rasterise the vector at high resolution (the built-in PNG is small)
  const img = new Image(), url = URL.createObjectURL(svg);
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
  const sc = Math.min(6, Math.max(2, 2400 / Math.max(img.width, 1)));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  const g = c.getContext("2d"); g.fillStyle = cream ? "#fffbf0" : "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise(r => c.toBlob(r, format === "jpg" ? "image/jpeg" : "image/png", 0.95));
}
Q("#ex-png").onclick = async () => download(await image("png"), "struttura.png");
Q("#ex-jpg").onclick = async () => download(await image("jpg"), "struttura.jpg");
Q("#ex-svg").onclick = async () => download(await image("svg"), "struttura.svg");
Q("#ex-ket").onclick = async () => { await start(); download(new Blob([await K.getKet()], { type: "application/json" }), "disegno.ket"); };
Q("#ex-load").onclick = async () => { const v = Q("#ex-smi").value.trim(); if (!v) return; await start(); try { await K.setMolecule(v); } catch (e) { Q("#dcomp").textContent = "SMILES non valido: " + e.message; } };

window.TPDraw = { image, smiles: async () => { await start(); return K.getSmiles(); }, ready: () => !!K };
document.addEventListener("tpview", e => { if (e.detail.view === "draw") start(); });
document.addEventListener("nbloaded", () => { if (K) { restored = false; restore(); } });
