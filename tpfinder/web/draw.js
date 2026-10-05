// "Disegno": Ketcher (structures, fragments, arrows, text) + OpenChemLib (formula and exact mass).
// Both are bundled in web/vendor: no internet needed. Module script; helpers come from explore.js (window).
import * as OCL from "/static/vendor/openchemlib.js";

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
    fr.src = "/static/vendor/ketcher/index.html";
    setTimeout(() => reject(new Error("Ketcher non si e' avviato")), 60000);
  }).then(async k => { await restore(); k.editor.subscribe("change", () => { clearTimeout(timer); timer = setTimeout(changed, 500); }); changed(); return k; });
  starting.catch(e => { Q("#dcomp").textContent = e.message; });
  return starting;
}
async function restore() {
  if (restored || !K) return;
  restored = true;
  if (typeof NB !== "undefined" && NB.ket) { try { await K.setMolecule(NB.ket); } catch (_) { /* old or empty drawing */ } }
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
    const ions = (document.querySelector("#ppol") && Q("#ppol").value === "negative" ? ADDUCTS.neg : ADDUCTS.pos);
    return `<div style="border-bottom:1px solid var(--line);padding:6px 0"><b>${fmtFormula(d.formula)}</b> <span class="muted">massa esatta ${d.mass.toFixed(4)}</span>
      ${adductTable(d)}
      <div class="bar"><button class="sm" data-p="${i}">Usa come composto di partenza (suggerimenti)</button><button class="sm" data-a="${i}">Aggiungi alle attribuzioni</button></div>
      <div class="muted sm" style="word-break:break-all">${EH(s)}</div></div>`;
  }).join("");
  box.querySelectorAll("[data-x]").forEach(b => b.onclick = () => {
    window.setView("data");
    window.addPanel("xic", { traces: [{ id: E.seq++, mz: +b.dataset.x, label: b.dataset.l }] });
  });
  box.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
    const d = describe(parts[+b.dataset.p]); Q("#pform").value = d.formula; Q("#pform").dispatchEvent(new Event("input")); window.setView("sugg");
  });
  box.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const d = describe(parts[+b.dataset.a]);
    window.addAttr({ mz: +(d.mass + PROTON).toFixed(2) }, false);
    NB.attr[NB.attr.length - 1].smiles = d.smiles; NB.attr[NB.attr.length - 1].name = d.formula; nbSave(); window.renderAttr(); window.setView("attr");
  });
}

// ------------------------------------------------------------------ caption (name, formula, m/z) for the report
const sub = f => f.replace(/(\d+)/g, "<tspan dy=\"0.28em\" font-size=\"70%\">$1</tspan><tspan dy=\"-0.28em\">\u200b</tspan>");   // graphical subscripts, image only
const svgAdduct = a => {
  let s = EH(a).replace(/([A-Z][a-z]?|\))(\d+)/g, (m, g1, g2) => `${g1}<tspan dy="0.28em" font-size="70%">${g2}</tspan><tspan dy="-0.28em">\u200b</tspan>`);
  return s.replace(/([+-]+)$/, '<tspan dy="-0.32em" font-size="70%">$1</tspan><tspan dy="0.32em">\u200b</tspan>');
};
const capPol = () => (Q("#cap-ad").value.endsWith("-") ? "-" : "+");
async function capData() {
  const i = +(Q("#cap-part").value || 0), d = PARTS[i] && describe(PARTS[i]);
  if (!d) return null;
  const ad = Q("#cap-ad").value;
  try {
    const r = await (await fetch(`/api/formula?f=${encodeURIComponent(d.formula)}&adduct=${encodeURIComponent(ad)}`)).json();
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
document.addEventListener("nbloaded", () => { if (NB.cap) { Q("#cap-name").value = NB.cap.name || ""; Q("#cap-ad").value = NB.cap.adduct || "[M+H]+"; Q("#cap-on").checked = NB.cap.on !== false; } capShow(); });

// ------------------------------------------------------------------ export
const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
async function image(format) {
  await start();
  const ket = await K.getKet(), cream = Q("#ex-bg").checked;
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
