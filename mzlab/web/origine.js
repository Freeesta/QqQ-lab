"use strict";
// "Da dove viene questo ione?" (Origin of an ion). Classic script, loaded after explore.js.
// ONE window (like openXic) that shows the EVIDENCE computed by mzlab/ionfamily.py (/api/origin) and never a verdict:
//   (a) normalised XICs of the ion, of the candidate precursor and of the co-eluting ions the student picks,
//   (b) table of the co-eluting ions sorted by correlation, with the difference in apex time and in mass (neutral losses are hints),
//   (c) F against P (area of the ion against area of the candidate precursor, one point per scan) with the fitted line and R2,
//   (d) behaviour across samples (kinetics), each metric with a two-line explanation, honest warnings, the student's own hypothesis
//       (saved in the notebook) and an Excel export. The only "conclusion" on the page is the one the student writes.
const OG = { res: null, sel: new Set(), traces: new Map(), busy: 0 };
(function () {
  const st = document.createElement("style");
  st.textContent = `#ogdlg{width:min(1100px,96vw);max-width:96vw;max-height:92vh;border:1px solid var(--line);border-radius:8px;padding:0;background:var(--panel);color:var(--text)}
#ogdlg::backdrop{background:rgba(0,0,0,.35)}#ogdlg .ogh{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel);z-index:2}
#ogdlg .ogh h3{margin:0;font-size:16px;flex:1}#ogdlg .ogb{padding:10px 14px 14px;overflow:auto;max-height:calc(92vh - 52px)}
#ogdlg .ogf{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:flex-end}#ogdlg label{font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:2px}
#ogdlg input,#ogdlg select,#ogdlg textarea{font:inherit;padding:3px 6px;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--text)}
#ogdlg input.mzf{width:90px}#ogdlg section{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}#ogdlg section h4{margin:0 0 2px;font-size:14px}
#ogdlg .why{font-size:12px;color:var(--muted);margin:0 0 6px;max-width:80ch}#ogdlg canvas{width:100%;height:230px;display:block}
#ogdlg table{border-collapse:collapse;font-size:12px;width:100%}#ogdlg th,#ogdlg td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}
#ogdlg th:first-child,#ogdlg td:first-child{text-align:left}#ogdlg tr.sel td{background:var(--sel)}#ogdlg tbody tr{cursor:pointer}
#ogdlg .oggrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:800px){#ogdlg .oggrid{grid-template-columns:1fr}}
#ogdlg .ogw{background:rgba(230,159,0,.14);border-left:3px solid #E69F00;padding:5px 9px;margin:4px 0;font-size:12px}
#ogdlg .chips{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin:4px 0}#ogdlg .chips i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px}
#ogdlg .kv{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:13px;margin:4px 0}#ogdlg .kv b{font-variant-numeric:tabular-nums}
#ogdlg textarea{width:100%;min-height:70px;box-sizing:border-box}`;
  document.head.appendChild(st);
})();
const ogN = (v, d = 3) => v == null || !isFinite(v) ? "-" : (Math.abs(v) >= 1e4 || (v !== 0 && Math.abs(v) < 1e-3) ? v.toExponential(2) : (+v.toFixed(d)).toString());
const OG_COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#7a3b9b", "#8a8a8a"];

function ogDialog() {
  let d = document.getElementById("ogdlg"); if (d) return d;
  d = document.createElement("dialog"); d.id = "ogdlg";
  d.innerHTML = `<div class="ogh"><h3>Da dove viene questo ione?</h3><button id="og-x" title="Chiudi">&times;</button></div>
<div class="ogb"><p class="why">Qui vedi <b>misure</b>, non risposte. Uno ione che sembra un prodotto di trasformazione può essere un frammento prodotto nella sorgente dello strumento (<i>in-source fragmentation</i>) a partire da un ione più pesante: le misure sotto ti dicono quanto i due ioni si comportano come uno solo. La conclusione la scrivi tu in fondo.</p>
<div class="ogf">
<label><span>Ione da studiare (<i>m/z</i> come lo vedi nello spettro)</span><input id="og-mz" class="mzf" inputmode="decimal" autocomplete="off"></label>
<label><span>Candidato progenitore (<i>m/z</i>)</span><input id="og-par" class="mzf" inputmode="decimal" autocomplete="off" placeholder="es. il composto di partenza"></label>
<label>Formula neutra del progenitore (facoltativa)<input id="og-f" autocomplete="off" placeholder="es. C9H8ClN5"></label>
<label>Finestra RT, da (min)<input id="og-r0" class="mzf" inputmode="decimal" autocomplete="off" placeholder="automatica"></label>
<label>a (min)<input id="og-r1" class="mzf" inputmode="decimal" autocomplete="off"></label>
<label>File di riferimento<select id="og-k"></select></label>
<button id="og-go" class="imp">Calcola le evidenze</button></div>
<div id="og-err" class="ogw" hidden></div><div id="og-out"></div></div>`;
  document.body.appendChild(d);
  d.querySelector("#og-x").onclick = () => d.close();
  d.querySelector("#og-go").onclick = () => ogRun();
  d.querySelectorAll("input").forEach(i => i.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); ogRun(); } });
  return d;
}
function openOrigin(pre = {}) {
  const d = ogDialog(), full = E.files.filter(f => f.kind === "full" && !f.gone && f.type !== "blank");
  if (!full.length) return info("Servono file Full Scan (non bianchi) per cercare l'origine di uno ione.");
  const q = id => d.querySelector(id);
  q("#og-k").innerHTML = full.map(f => `<option value="${f.k}">${EH(f.label)}</option>`).join("");
  const kk = full.find(f => f.k === pre.k) || full[0]; q("#og-k").value = kk.k;
  q("#og-mz").value = pre.mz != null ? fmz(pre.mz) : "";
  if (pre.parent != null) q("#og-par").value = fmz(pre.parent);
  q("#og-r0").value = pre.rt0 != null ? (+pre.rt0).toFixed(2) : ""; q("#og-r1").value = pre.rt1 != null ? (+pre.rt1).toFixed(2) : "";
  q("#og-err").hidden = true; q("#og-out").innerHTML = ""; OG.res = null; OG.sel = new Set(); OG.traces = new Map();
  d.showModal();
  (q("#og-par").value ? q("#og-go") : q("#og-par")).focus();
}
async function ogRun() {
  const d = document.getElementById("ogdlg"), q = id => d.querySelector(id), err = q("#og-err");
  const mz = numMz(q("#og-mz").value), par = numMz(q("#og-par").value), r0 = parseFloat(q("#og-r0").value.replace(",", ".")), r1 = parseFloat(q("#og-r1").value.replace(",", "."));
  err.hidden = true;
  if (mz == null || par == null) { err.textContent = "Scrivi i due valori di m/z: lo ione da studiare e il candidato progenitore (lo scegli tu, il programma non lo indovina)."; err.hidden = false; return; }
  if (mz === par) { err.textContent = "I due m/z devono essere diversi."; err.hidden = false; return; }
  q("#og-go").disabled = true; const t0 = Date.now(), webNote = window.QQQ_BROWSER ? " Nella versione nel browser può richiedere fino a mezzo minuto con molti file (il calcolo gira sul tuo computer, non su un server)." : "";
  q("#og-out").innerHTML = `<p class="why" id="og-wait">Calcolo in corso...${webNote}</p>`;
  const tick = setInterval(() => { const w = document.getElementById("og-wait"); if (w) w.firstChild.textContent = `Calcolo in corso... ${Math.round((Date.now() - t0) / 1000)} s.`; }, 1000);
  const my = ++OG.busy;
  try {
    let u = `api/origin?k=${q("#og-k").value}&mz=${mz}&parent=${par}`;
    if (isFinite(r0) && isFinite(r1) && r1 > r0) u += `&rt0=${r0}&rt1=${r1}`;
    if (q("#og-f").value.trim()) u += `&formula=${encodeURIComponent(q("#og-f").value.trim())}`;
    const res = await J(u); if (my !== OG.busy) return;
    OG.res = res; OG.k = +q("#og-k").value; OG.sel = new Set(); OG.traces = new Map();
    ogRender();
  } catch (e) { q("#og-out").innerHTML = ""; err.textContent = "Non riesco a calcolare: " + e.message; err.hidden = false; }
  finally { clearInterval(tick); q("#og-go").disabled = false; }
}

// ---- small canvas plots (same helpers as the rest of the program: setup, frame, nice, M)
function ogPlot(cv, o) {
  const { g, W, H } = setup(cv); g.clearRect(0, 0, W, H);
  const xs = o.series.flatMap(s => s.x), ys = o.series.flatMap(s => s.y).filter(isFinite);
  if (!xs.length) { g.fillStyle = css("--muted"); g.fillText("nessun dato", M.l, 30); return; }
  let x0 = o.x0 ?? Math.min(...xs), x1 = o.x1 ?? Math.max(...xs), y0 = o.y0 ?? Math.min(0, ...ys), y1 = o.y1 ?? Math.max(...ys) * 1.05;
  if (x1 === x0) { x0 -= 1; x1 += 1; } if (y1 === y0) y1 = y0 + 1;
  const X = v => M.l + (v - x0) / (x1 - x0) * (W - M.l - M.r), Y = v => H - M.b - (v - y0) / (y1 - y0) * (H - M.t - M.b);
  frame(g, W, H, nice(x0, x1, 7).map(t => [X(t), +t.toFixed(2)]), nice(y0, y1, 4).map(t => [Y(t), ogN(t, 2)]), o.xl, o.yl);
  g.save(); g.beginPath(); g.rect(M.l, M.t, W - M.l - M.r, H - M.t - M.b); g.clip();
  o.series.forEach(s => {
    g.strokeStyle = g.fillStyle = s.color; g.lineWidth = s.w || 1.5;
    if (s.dash) g.setLineDash(s.dash);
    if (s.line !== false) { g.beginPath(); s.x.forEach((v, i) => { if (!isFinite(s.y[i])) return; i ? g.lineTo(X(v), Y(s.y[i])) : g.moveTo(X(v), Y(s.y[i])); }); g.stroke(); }
    g.setLineDash([]);
    if (s.pts) s.x.forEach((v, i) => { if (isFinite(s.y[i])) { g.beginPath(); g.arc(X(v), Y(s.y[i]), s.r || 3, 0, 7); g.fill(); } });
  });
  g.restore();
}

async function ogXic(k, mz) {
  const key = `${k}|${mz}`; if (OG.traces.has(key)) return OG.traces.get(key);
  const d = await getXic(k, mz, 0.35, 1); OG.traces.set(key, d); return d;
}
async function ogDrawXics() {
  const R = OG.res, cv = document.querySelector("#og-xic"), chips = document.querySelector("#og-chips"); if (!cv || !R) return;
  const items = [{ mz: R.mz, name: `ione ${fmz(R.mz)}`, color: OG_COLORS[0], w: 2.2 }, { mz: R.parent_mz, name: `candidato progenitore ${fmz(R.parent_mz)}`, color: OG_COLORS[1], w: 2.2 }];
  [...OG.sel].forEach((m, i) => items.push({ mz: m, name: `co-eluente ${fmz(m)}`, color: OG_COLORS[2 + (i % 6)], w: 1.3, dash: [4, 3] }));
  const half = Math.max(0.6, (R.parent_fwhm_s || 8) / 60 * 5), c = R.parent_apex_rt ?? ((R.window[0] + R.window[1]) / 2), x0 = c - half, x1 = c + half;
  const series = [];
  for (const it of items) {
    const t = await ogXic(OG.k, it.mz); if (!t) continue;
    let mx = 0; t.rt.forEach((v, i) => { if (v >= x0 && v <= x1 && t.y[i] > mx) mx = t.y[i]; });
    series.push({ x: t.rt, y: t.y.map(v => mx > 0 ? v / mx : 0), color: it.color, w: it.w, dash: it.dash, name: it.name });
  }
  ogPlot(cv, { series, x0, x1, y0: 0, y1: 1.08, xl: "Tempo di ritenzione (min)", yl: "Intensità normalizzata all'apice" });
  chips.innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${EH(s.name)}</span>`).join("");
}

function ogRender() {
  const R = OG.res, d = document.getElementById("ogdlg"), out = d.querySelector("#og-out"), P = R.profile || {}, F = R.ratio || {}, K = R.kinetics || {}, C = R.ratio_constancy || {};
  const warn = [...new Set([...(R.warnings || []), ...(P.warnings || []), ...(K.warnings || [])])];
  if (P.reliable === false) warn.push("Le misure sul profilo sono poco affidabili (pochi punti o picco non chiaro): non fidarti dei numeri senza guardare i cromatogrammi.");
  if (P.x_has_peak === false) warn.push("Lo ione da studiare non ha un picco riconoscibile nella finestra: le correlazioni descrivono soprattutto rumore.");
  const cands = (R.candidates || []).slice().sort((a, b) => (b.pearson ?? -2) - (a.pearson ?? -2));
  const loss = m => { const dm = R.parent_mz - m; return Math.abs(dm) < 0.5 ? "-" : dm > 0 ? `${ogN(dm, 1)} (il candidato è più pesante)` : `${ogN(dm, 1)} (il candidato è più leggero)`; };
  const lossHint = m => { const dm = R.parent_mz - m; return dm > 1.5 ? `Δm = ${ogN(dm, 1)} Da: se fosse un frammento, il candidato avrebbe perso ${ogN(dm, 0)} Da` : ""; };
  out.innerHTML = `${warn.map(w => `<div class="ogw">${EH(w)}</div>`).join("")}
<section><h4>1. Profili cromatografici confrontati</h4>
<p class="why">Un frammento in sorgente nasce nello stesso istante dell'ione da cui deriva: i due profili devono coincidere (stessa forma, stesso apice). Un prodotto di trasformazione, invece, di solito esce a un tempo diverso. Clicca una riga della tabella per aggiungere un ione al grafico.</p>
<canvas id="og-xic"></canvas><div id="og-chips" class="chips"></div>
<div class="kv"><span>correlazione dei profili (Pearson, pesata) <b>${ogN(P.pearson_w)}</b></span><span>intervallo di confidenza 95% <b>${P.corr_ci ? ogN(P.corr_ci[0], 2) + " - " + ogN(P.corr_ci[1], 2) : "-"}</b></span><span>differenza fra gli apici <b>${ogN(P.apex_diff_s, 2)} s</b> (±${ogN(P.apex_diff_sigma_s, 2)})</span><span>rapporto fra le larghezze a metà altezza <b>${ogN(P.fwhm_ratio, 2)}</b></span><span>scansioni nel picco <b>${ogN(P.n_scans, 0)}</b></span></div>
<p class="why">Pearson vicino a 1 = stessa forma. La differenza fra gli apici va letta insieme alla sua incertezza (±) e al tempo fra due scansioni: sotto una scansione non è distinguibile da zero. Due ioni diversi possono avere profili uguali per caso se co-eluiscono: l'evidenza è compatibile con un frammento, non lo dimostra.</p></section>
<section><h4>2. Ioni che escono insieme al candidato progenitore</h4>
<p class="why">Tabella ordinata per correlazione con il candidato. Δm è la differenza di massa dal candidato: una perdita neutra nota (per esempio 18 = acqua) è un indizio, non una prova, a risoluzione unitaria. Le note sono confronti numerici (isotopi, addotti), da verificare.</p>
<div style="max-height:260px;overflow:auto"><table><thead><tr><th><i>m/z</i></th><th>Δm dal candidato</th><th>Pearson</th><th>Δ apice (s)</th><th>area relativa</th><th>note</th></tr></thead><tbody id="og-tb">${cands.map(c => `<tr data-m="${c.mz}" title="${EH(lossHint(c.mz))}"><td>${ogN(c.mz, 2)}</td><td>${loss(c.mz)}</td><td>${ogN(c.pearson, 3)}</td><td>${ogN(c.apex_diff_s, 2)}</td><td>${ogN(c.area_rel, 3)}</td><td>${(c.roles || []).map(r => EH(r.label || r.role)).join("; ")}</td></tr>`).join("") || `<tr><td colspan="6">nessun ione co-eluente nella finestra</td></tr>`}</tbody></table></div></section>
<section><h4>3. Area dello ione contro area del candidato (F contro P)</h4>
<p class="why">Se uno ione è un frammento in sorgente di un candidato, la sua intensità segue quella del candidato scansione per scansione: i punti stanno su una retta per l'origine (pendenza = frazione di candidato che si frammenta). Un prodotto di trasformazione non ha questo vincolo.</p>
<div class="oggrid"><canvas id="og-fp"></canvas><div>
<div class="kv"><span>pendenza <b>${ogN(F.r_tls, 3)}</b> ±${ogN(F.r_se, 3)}</span><span>R<sup>2</sup> <b>${ogN(F.r2, 3)}</b></span><span>intercetta (relativa) <b>${ogN(F.intercept_rel, 3)}</b></span><span>punti <b>${ogN(F.n, 0)}</b></span><span>scarto relativo dei residui <b>${ogN(F.resid_rel, 3)}</b></span></div>
<p class="why">R<sup>2</sup> vicino a 1 con intercetta vicina a 0 = proporzionalità. Con segnali molto intensi il rivelatore può saturare e la retta si piega: guarda anche la forma dei punti, non solo R<sup>2</sup>.</p>
<div class="kv"><span>rapporto F/P nei campioni: Q di Cochran <b>${ogN(C.q, 2)}</b> (p = <b>${ogN(C.p, 3)}</b>)</span><span>variazione relativa <b>${ogN(C.cv, 3)}</b></span></div>
<p class="why">Un frammento in sorgente ha F/P costante da un campione all'altro (la frazione che si rompe dipende dallo strumento, non dalla chimica). Un p piccolo indica che il rapporto cambia fra campioni.</p></div></div></section>
<section><h4>4. Comportamento nei campioni (cinetica)</h4>
<p class="why">Il candidato scompare con il trattamento. Un ione che scende di pari passo è compatibile con un frammento; un ione che prima sale e poi scende è compatibile con un prodotto intermedio. Sono due descrizioni: scegli tu quella che i dati sostengono.</p>
<div class="oggrid"><canvas id="og-kin"></canvas><div>
<div class="kv"><span>decadimento del candidato: k <b>${ogN(K.parent_decay && K.parent_decay.k, 4)}</b> /min</span><span>tempo di dimezzamento <b>${ogN(K.parent_decay && K.parent_decay.half_life, 1)}</b> min</span><span>correlazione di rango con il candidato (Spearman) <b>${ogN(K.spearman_parent, 2)}</b></span></div>
<div class="kv"><span>modello «segue il candidato» AICc <b>${ogN(K.models && K.models.tracks_parent && K.models.tracks_parent.aicc, 1)}</b></span><span>«decade da solo» <b>${ogN(K.models && K.models.decay && K.models.decay.aicc, 1)}</b></span><span>«si forma e decade» <b>${ogN(K.models && K.models.formation_decay && K.models.formation_decay.aicc, 1)}</b></span></div>
<p class="why">AICc più basso = il modello descrive meglio i dati con pochi parametri; una differenza sotto circa 2 non conta. Con 5-7 tempi i modelli sono pochi punti: prendili come indizio.</p></div></div></section>
<section><h4>5. La tua ipotesi</h4>
<p class="why">Scrivi che cosa pensi (frammento in sorgente, prodotto di trasformazione, isotopo, addotto, non so) e perché, citando le misure qui sopra. Resta nel taccuino.</p>
<textarea id="og-hyp" placeholder="La mia ipotesi e le evidenze a favore e contro..."></textarea>
<p style="margin:8px 0 0"><button id="og-xlsx">Esporta in Excel</button></p></section>
<p class="why">${EH(R.note || "")}</p>`;
  d.querySelectorAll("#og-tb tr[data-m]").forEach(tr => tr.onclick = () => {
    const m = +tr.dataset.m; if (OG.sel.has(m)) OG.sel.delete(m); else OG.sel.add(m);
    tr.classList.toggle("sel", OG.sel.has(m)); ogDrawXics();
  });
  const key = `${fmz(R.mz)}|${fmz(R.parent_mz)}`; NB.origin = NB.origin || {};
  const ta = d.querySelector("#og-hyp"); ta.value = NB.origin[key] || "";
  ta.oninput = () => { NB.origin[key] = ta.value; nbSave(); };
  d.querySelector("#og-xlsx").onclick = () => ogXlsx();
  requestAnimationFrame(() => {
    ogDrawXics();
    const pts = F.points || {}, p = pts.p || [], f = pts.f || [], fit = pts.fit || [];
    const order = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
    ogPlot(d.querySelector("#og-fp"), { series: [{ x: p, y: f, color: OG_COLORS[0], pts: true, line: false, r: 2.5 }, { x: order.map(i => p[i]), y: order.map(i => fit[i]), color: OG_COLORS[1], w: 1.6 }], x0: 0, y0: 0, xl: "Area (intensità) del candidato, P", yl: "Ione, F" });
    const sm = R.samples || [], kt = K.times || sm.map(s => s.time);
    ogPlot(d.querySelector("#og-kin"), { series: [{ x: kt, y: K.parent_norm || [], color: OG_COLORS[1], pts: true, w: 1.6 }, { x: kt, y: K.ion_norm || [], color: OG_COLORS[0], pts: true, w: 1.6 }], y0: 0, xl: "Tempo di trattamento (min)", yl: `Area relativa (candidato arancione, ione blu)` });
  });
}
function ogXlsx() {
  const R = OG.res; if (!R) return; const P = R.profile || {}, F = R.ratio || {}, K = R.kinetics || {}, C = R.ratio_constancy || {};
  const key = `${fmz(R.mz)}|${fmz(R.parent_mz)}`, pts = F.points || {};
  dlx(`origine_${fmz(R.mz)}_da_${fmz(R.parent_mz)}`, [
    { name: "Riassunto", head: ["Misura", "Valore"], widths: [46, 20], rows: [["m/z ione", R.mz], ["m/z candidato progenitore", R.parent_mz], ["file di riferimento", R.ref_label || ""], ["finestra RT inizio (min)", R.window ? R.window[0] : null], ["finestra RT fine (min)", R.window ? R.window[1] : null], ["apice del candidato (min)", R.parent_apex_rt], ["Pearson pesato dei profili", P.pearson_w], ["differenza fra gli apici (s)", P.apex_diff_s], ["incertezza (s)", P.apex_diff_sigma_s], ["rapporto fra le FWHM", P.fwhm_ratio], ["pendenza F contro P", F.r_tls], ["errore della pendenza", F.r_se], ["R2 F contro P", F.r2], ["intercetta relativa", F.intercept_rel], ["Q di Cochran dei rapporti F/P", C.q], ["p di Cochran", C.p], ["k di decadimento del candidato (1/min)", K.parent_decay ? K.parent_decay.k : null], ["La mia ipotesi", (NB.origin && NB.origin[key]) || ""], ...[...(R.warnings || []), ...(P.warnings || []), ...(K.warnings || [])].map(w => ["Avviso", w])] },
    { name: "Co-eluenti", head: ["m/z", "Delta m dal candidato", "Pearson", "Delta apice (s)", "Area relativa", "Note"], widths: [10, 20, 10, 14, 14, 40], rows: (R.candidates || []).map(c => [c.mz, R.parent_mz - c.mz, c.pearson, c.apex_diff_s, c.area_rel, (c.roles || []).map(r => r.label || r.role).join("; ")]) },
    { name: "Campioni", head: ["Campione", "Tempo (min)", "Area candidato", "Area ione", "Rapporto F/P", "Errore"], widths: [24, 12, 16, 16, 14, 12], rows: (R.samples || []).map(s => [s.label, s.time, s.area_parent, s.area_ion, s.ratio, s.ratio_se]) },
    { name: "F contro P", head: ["P (candidato)", "F (ione)", "F sulla retta"], widths: [16, 16, 16], rows: (pts.p || []).map((v, i) => [v, pts.f[i], (pts.fit || [])[i]]) },
    { name: "Cinetica", head: ["Tempo (min)", "Candidato (normalizzato)", "Ione (normalizzato)", "Rapporto"], widths: [12, 22, 20, 12], rows: (K.times || []).map((t, i) => [t, (K.parent_norm || [])[i], (K.ion_norm || [])[i], (K.ratio || [])[i]]) }]);
}
