"use strict";
// Tools for the mass spectrum (Full Scan and MS2) and for the time axes. Classic script, loaded after scroll.js: it uses the globals of explore.js
// (E, Q, EH, M, css, fmt, draw, uiSave, ctl, big, dlx, info, shown, tabPanels, IC_DL, IC_TAB).
//  - ruler: difference of m/z between two peaks (the program only subtracts; what the difference means is for the student)
//  - "Parametri dello spettro": absolute / % axis, threshold and number of the m/z labels, decimals
//  - table of the peaks, ready for Excel (copy as TSV + HTML, or .xlsx)
//  - zoom history (Ctrl/Cmd+Z), whole view (Backspace), linked time axes, one-line description of the scan

const IC_RULER = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="5" width="13" height="6" rx="1"/><path d="M4.5 5v2.4M7.5 5v3.2M10.5 5v2.4M13 5v1.6"/></svg>';
const IC_PARAM = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 4.5h12M2 8h12M2 11.5h12"/><circle cx="5.5" cy="4.5" r="1.7" fill="var(--panel)"/><circle cx="10.5" cy="8" r="1.7" fill="var(--panel)"/><circle cx="6.5" cy="11.5" r="1.7" fill="var(--panel)"/></svg>';
const IC_LINK = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.7.7"/><path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.1 9.2a2.6 2.6 0 0 0 3.7 3.7l.7-.7"/></svg>';

// y axis in % of the highest peak: the default is % for the MS2 spectra (the relative intensities of the fragments are what is compared), cps for Full Scan
const specRel = p => p.rel ?? p.level === 2;
const SPEC_DEF = { thr: 5, nlab: 10, dec: 1 };
const sgn1 = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);

// ---------------------------------------------------------------- ruler: p.meas = { ref: m/z | null, list: [{a, b}] }
function measClick(p, m) {
  p.meas = p.meas || { ref: null, list: [] };
  if (p.meas.ref == null) p.meas.ref = m;
  else if (Math.abs(m - p.meas.ref) > 0.04) p.meas.list.push({ a: p.meas.ref, b: m });          // one more measure from the same reference
  draw(p); uiSave();
}
function measSet(p, m) { p.meas = p.meas || { ref: null, list: [] }; p.meas.ref = m; draw(p); uiSave(); }
function measClear(p) { p.meas = null; p.rul = false; const b = p.el.querySelector('[data-a="rul"]'); if (b) b.classList.remove("on"); draw(p); uiSave(); }
function drawMeas(p, g, X, Y, W) {
  const m = p.meas; if (!m || p._exp && false) return;
  const ac = css("--accent"), x0 = M.l, x1 = W - M.r;
  g.save(); g.beginPath(); g.rect(x0, M.t - 1, x1 - x0, 400); g.clip();
  g.strokeStyle = g.fillStyle = ac; g.lineWidth = 1; g.font = "11px system-ui"; g.textAlign = "center";
  if (m.ref != null && X(m.ref) >= x0 && X(m.ref) <= x1) {
    g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(m.ref), Y(0)); g.lineTo(X(m.ref), M.t + 2); g.stroke(); g.setLineDash([]);
    g.textAlign = "left"; g.fillText("rif.", X(m.ref) + 3, M.t + 10);
  }
  m.list.forEach((q, i) => {
    const xa = X(q.a), xb = X(q.b), y = M.t + 26 + (i % 6) * 17;
    g.setLineDash([2, 3]); g.globalAlpha = .55; g.beginPath(); g.moveTo(xa, y); g.lineTo(xa, Y(0)); g.moveTo(xb, y); g.lineTo(xb, Y(0)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    g.lineWidth = 1.4; g.beginPath(); g.moveTo(xa, y - 4); g.lineTo(xa, y + 4); g.moveTo(xa, y); g.lineTo(xb, y); g.moveTo(xb, y - 4); g.lineTo(xb, y + 4); g.stroke(); g.lineWidth = 1;
    const t = "Δm/z " + Math.abs(q.b - q.a).toFixed(1), cx = Math.max(x0 + 40, Math.min(x1 - 40, (xa + xb) / 2));
    g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = css("--panel"); g.strokeText(t, cx, y - 5); g.fillStyle = ac; g.fillText(t, cx, y - 5); g.strokeStyle = ac; g.lineWidth = 1;
  });
  g.restore();
}
function specClick(p, px) {                       // a click on the spectrum (no drag): the ruler picks the nearest peak
  if (!(p.rul || (p.meas && p.meas.ref != null)) || !p._a || !p._a.snap) return;
  const s = p._a.snap(px); if (s) measClick(p, s.m);
}
function measMenu(p, m) {                          // entries of the right-click menu of the spectrum
  const out = [{ label: "Misura da questo picco", fn: () => measSet(p, m) }];
  if (p.meas) out.push({ label: "Togli le misure", fn: () => measClear(p) });
  return out;
}

// ---------------------------------------------------------------- parameters of the spectrum
function specParams(p, btn) {
  const old = p.el.querySelector(".sp-pop"); if (old) { old.remove(); return; }
  const pop = document.createElement("div"); pop.className = "sp-pop";
  const cur = { rel: specRel(p), thr: p.thr ?? SPEC_DEF.thr, nlab: p.nlab ?? SPEC_DEF.nlab, dec: p.dec ?? SPEC_DEF.dec };
  pop.innerHTML = `<label>Asse y <select data-s="rel"><option value="0" ${cur.rel ? "" : "selected"}>assoluto (cps)</option><option value="1" ${cur.rel ? "selected" : ""}>% del picco più alto</option></select></label>
    <label title="Si etichettano solo i picchi sopra questa percentuale del picco più alto; gli altri restano disegnati">Etichette: oltre <input data-s="thr" type="number" min="0" max="100" step="1" value="${cur.thr}"> %</label>
    <label title="Numero massimo di etichette m/z">al massimo <input data-s="nlab" type="number" min="1" max="60" step="1" value="${cur.nlab}"></label>
    <label>Decimali di <i>m/z</i> <select data-s="dec">${[0, 1, 2].map(n => `<option ${cur.dec === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <button data-s="reset" title="Torna ai valori di partenza">Ripristina predefiniti</button>`;
  const pr = p.el.getBoundingClientRect(), br = btn.getBoundingClientRect();
  p.el.appendChild(pop); pop.style.left = Math.max(4, Math.min(br.left - pr.left, p.el.clientWidth - pop.offsetWidth - 6)) + "px"; pop.style.top = br.bottom - pr.top + 4 + "px";
  const apply = () => { draw(p); uiSave(); };
  pop.querySelectorAll("[data-s]").forEach(x => {
    const k = x.dataset.s;
    if (k === "reset") x.onclick = () => { p.rel = null; p.thr = SPEC_DEF.thr; p.nlab = SPEC_DEF.nlab; p.dec = SPEC_DEF.dec; pop.remove(); specParams(p, btn); apply(); };
    else x.onchange = () => {
      if (k === "rel") p.rel = x.value === "1";
      else p[k] = Math.max(k === "nlab" ? 1 : 0, Math.min(k === "thr" ? 100 : k === "nlab" ? 60 : 2, Math.round(+x.value || 0)));
      apply();
    };
  });
  const away = e => { if (!pop.contains(e.target) && !btn.contains(e.target)) { pop.remove(); document.removeEventListener("mousedown", away, true); } };
  setTimeout(() => document.addEventListener("mousedown", away, true), 0);
}

// ---------------------------------------------------------------- table of the peaks (for Excel)
function peakTable(p) {
  const a = p._a; if (!a || !a.data || !a.data[0]) return info("Scegli prima una scansione o un intervallo di tempo nel cromatogramma.");
  const dd = a.data[0], d = dd.d, cps = d.y0 || d.y, top = Math.max(...cps, 1e-9);
  const all = d.mz.map((m, i) => ({ mz: m, cps: cps[i], pct: cps[i] / top * 100 })).filter(r => r.cps > 0);
  const f = dd.f, ce = p.level === 2 && p.prec != null ? ((f.ms2_exps || []).find(x => Math.abs(x.prec - p.prec) < 0.6) || {}).ce : null;
  const ctx = [f.label, p.r0 != null ? (p.r1 - p.r0 > 1.6 * scanStep() ? `RT ${p.r0.toFixed(2)}-${p.r1.toFixed(2)} min` : `RT ${((p.r0 + p.r1) / 2).toFixed(2)} min`) : "", d.scans === 1 && d.i0 != null ? `scansione ${d.i0 + 1}` : `media di ${d.scans} scansioni`,
    p.level === 2 ? `MS2${p.prec != null ? ", precursore " + p.prec : ""}${ce != null ? ", CE " + ce + " eV" : ""}` : "MS1"].filter(Boolean);
  const it = /^it/i.test(navigator.language || "");
  const st = { col: "pct", dir: -1 }, lo0 = +a.x0.toFixed(1), hi0 = +a.x1.toFixed(1);
  big("Picchi dello spettro", `<div class="sm muted" style="margin-bottom:6px">${ctx.map(EH).join(" · ")}</div>
    <div class="bar" id="pk-bar"><label>soglia <input id="pk-thr" type="number" min="0" max="100" step="1" value="${p.thr ?? SPEC_DEF.thr}" style="width:56px"> %</label>
    <label><i>m/z</i> da <input id="pk-lo" type="number" step="1" value="${lo0}" style="width:70px"> a <input id="pk-hi" type="number" step="1" value="${hi0}" style="width:70px"></label>
    <label>righe al massimo <input id="pk-n" type="number" min="1" step="1" value="50" style="width:60px"></label>
    <label>decimali <select id="pk-sep"><option value="," ${it ? "selected" : ""}>virgola</option><option value="." ${it ? "" : "selected"}>punto</option></select></label>
    <button id="pk-copy" title="Copia la tabella: incollata in Excel riempie righe e colonne con numeri veri">Copia</button><button id="pk-xlsx">${IC_DL}Excel</button><span id="pk-msg" class="muted sm"></span></div>
    <table id="pk-tb"></table>`, () => {
    const val = id => +Q("#" + id).value;
    const rows = () => {
      const lo = val("pk-lo"), hi = val("pk-hi"), thr = val("pk-thr"), n = Math.max(1, val("pk-n") || 50);
      const r = all.filter(x => x.mz >= lo && x.mz <= hi && x.pct >= thr).sort((u, v) => st.dir * (u[st.col] - v[st.col]));
      return r.slice(0, n);
    };
    const render = () => {
      const r = rows(), ar = c => st.col === c ? (st.dir > 0 ? " ▲" : " ▼") : "";
      Q("#pk-tb").innerHTML = `<tr><th data-c="mz" style="cursor:pointer"><i>m/z</i>${ar("mz")}</th><th class="num" data-c="cps" style="cursor:pointer">Intensità (cps)${ar("cps")}</th><th class="num" data-c="pct" style="cursor:pointer">% del picco più alto${ar("pct")}</th></tr>` +
        r.map(x => `<tr><td>${x.mz.toFixed(2)}</td><td class="num">${fmtFull(x.cps)}</td><td class="num">${x.pct.toFixed(1)}</td></tr>`).join("");
      Q("#pk-tb").querySelectorAll("th[data-c]").forEach(h => h.onclick = () => { st.dir = st.col === h.dataset.c ? -st.dir : (h.dataset.c === "mz" ? 1 : -1); st.col = h.dataset.c; render(); });
    };
    Q("#pk-bar").querySelectorAll("input").forEach(x => x.onchange = render); render();
    const num = (v, dec) => String(+v.toFixed(dec)).replace(".", Q("#pk-sep").value);          // no thousands separators: Excel wants plain numbers
    const head = ["m/z", "Intensità (cps)", "% del picco più alto"];
    Q("#pk-copy").onclick = async () => {
      const r = rows(), line = x => [num(x.mz, 2), num(x.cps, 1), num(x.pct, 1)];
      const tsv = head.join("\t") + "\n" + r.map(x => line(x).join("\t")).join("\n");
      const html = `<table><tr>${head.map(h => `<th>${EH(h)}</th>`).join("")}</tr>${r.map(x => `<tr>${line(x).map(c => `<td>${EH(c)}</td>`).join("")}</tr>`).join("")}</table>`;
      try {
        if (window.ClipboardItem && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([tsv], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
        else await navigator.clipboard.writeText(tsv);
        Q("#pk-msg").textContent = `copiate ${r.length} righe: incolla in Excel`;
      } catch (e) { try { await navigator.clipboard.writeText(tsv); Q("#pk-msg").textContent = `copiate ${r.length} righe: incolla in Excel`; } catch (e2) { Q("#pk-msg").textContent = "copia non permessa dal browser: usa Excel"; } }
    };
    Q("#pk-xlsx").onclick = () => { const r = rows(); dlx(plotName(p) + "_picchi.xlsx", [{ name: "Picchi", head, rows: r.map(x => [x.mz, x.cps, x.pct]), widths: [12, 18, 24] }, { name: "Origine", rows: ctx.map(c => [c]), widths: [70] }]); };
  });
}

// ---------------------------------------------------------------- zoom history, whole view (keys)
function pushZh(p) {
  const s = { zoom: p.zoom ? [...p.zoom] : null, zoomY: p.zoomY ? [...p.zoomY] : null }, h = p.zh = p.zh || [], l = h[h.length - 1];
  if (l && JSON.stringify(l) === JSON.stringify(s)) return;
  h.push(s); if (h.length > 15) h.shift();
}
function undoZoom(p) {
  const h = p.zh; if (!h || !h.length) return;
  const s = h.pop(); p.zoom = s.zoom; p.zoomY = s.zoomY; if (p.type === "spec") p.lock = null; draw(p); uiSave();
}
document.addEventListener("keydown", e => {
  const a = E.active; if (!a || !a.el || !Q("#dpanels").offsetParent || a.type === "map" && false) return;
  if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable='true']")) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); pushZh(a); a.zoom = null; a.zoomY = null; if (a.type === "spec") a.lock = null; draw(a); uiSave(); }
  else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") { e.preventDefault(); undoZoom(a); }
  else if (e.key === "Escape" && a.type === "spec" && (a.meas || a.rul)) measClear(a);
});

// ---------------------------------------------------------------- linked time axes: the panels with the chain on share the interval of time
function syncT(p) {
  const key = JSON.stringify(p.zoom || null); if (p._zs === key) return; p._zs = key;
  tabPanels().filter(q => q !== p && q.tl && q.type !== "spec" && q.type !== "map" && JSON.stringify(q.zoom || null) !== key)
    .forEach(q => { q.zoom = p.zoom ? [...p.zoom] : null; q._zs = key; draw(q); });
}
function toggleTl(p) {
  p.tl = !p.tl; const b = p.el.querySelector('[data-a="tlink"]'); if (b) b.classList.toggle("on", p.tl);
  if (p.tl) { const o = tabPanels().find(q => q !== p && q.tl && q.type !== "spec" && q.type !== "map"); if (o) { p.zoom = o.zoom ? [...o.zoom] : null; p._zs = JSON.stringify(p.zoom || null); draw(p); } }
  uiSave();
}

// ---------------------------------------------------------------- one line under the spectrum: which scan it is
function scanLine(p, data, d0) {
  const raw = d0.y0 || d0.y, tic = raw.reduce((s, v) => s + v, 0);
  let bi = 0; raw.forEach((v, i) => { if (v > raw[bi]) bi = i; });
  const e = v => Number(v).toExponential(1).replace("e+", "e");
  const f = data[0].f, parts = [];
  const i = p.si != null ? p.si : d0.i0, n = d0.n;
  parts.push(d0.scans === 1 && i != null ? `scansione ${i + 1}${n ? "/" + n : ""}` : `media di ${d0.scans} scansioni`);
  parts.push(d0.scans === 1 || p.r1 - p.r0 <= 1.6 * scanStep() ? `RT ${((p.r0 + p.r1) / 2).toFixed(2)} min` : `RT ${p.r0.toFixed(2)}-${p.r1.toFixed(2)} min`);
  if (p.level === 2) { const ce = p.prec != null ? ((f.ms2_exps || []).find(x => Math.abs(x.prec - p.prec) < 0.6) || {}).ce : null; parts.push("MS2" + (p.prec != null ? ` · precursore ${p.prec}` : "") + (ce != null ? ` · CE ${ce} eV` : "")); }
  parts.push(`${d0.scans === 1 ? "TIC" : "TIC medio"} ${e(tic)}`);
  if (raw.length) parts.push(`picco base <i>m/z</i> ${d0.mz[bi].toFixed(1)} (${e(raw[bi])})`);
  return parts.join(" · ");
}
