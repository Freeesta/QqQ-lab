/* QqQ lab - Teoria: real 70 eV EI spectra (data: pratica/ei-dati.js, from MassBank, CC BY-NC-SA) drawn as bar spectra.
   Used by chapters 15-16 and by the Pratica. A chapter only writes
     <div class="eispec" data-ei="2-esanone" data-keys="1"></div>
   (data-keys: list the teaching notes under the spectrum; data-hide: hide the name, for "which compound is it?";
    data-h: height in px; data-table: add the table of the ten most intense peaks). */
"use strict";
const EISPEC = (() => {
  const css = () => getComputedStyle(document.documentElement), col = n => css().getPropertyValue("--c" + n).trim();
  const items = () => (typeof EI_DATA !== "undefined" ? EI_DATA.items : []);
  const byId = id => items().find(i => i.id === id);
  const TYPE = { M: "ione molecolare", alpha: "scissione α", i: "scissione induttiva", sigma: "rottura σ", mclafferty: "McLafferty", rda: "retro-Diels-Alder",
    tropilio: "tropilio", orto: "effetto orto", serie: "serie di ioni", perdita: "perdita neutra", riarr: "riarrangiamento", isotopo: "isotopo" };
  const TCOL = { M: 2, alpha: 1, i: 6, sigma: 5, mclafferty: 4, rda: 4, tropilio: 1, orto: 4, serie: 5, perdita: 3, riarr: 4, isotopo: 6 };
  const EH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ionHtml = s => EH(s).replace(/(\d+)/g, "<sub>$1</sub>").replace(/\+\.$/, "<sup>+•</sup>").replace(/\+$/, "<sup>+</sup>");

  /** Range of the x axis: from the first peak (or 10) to the molecular ion cluster. */
  function range(it) {
    const mzs = it.peaks.map(p => p[0]);
    const lo = Math.max(0, Math.floor((Math.min(...mzs) - 4) / 10) * 10), hi = Math.ceil((Math.max(it.M, ...mzs) + 8) / 10) * 10;
    return [lo, hi];
  }

  /** Labels of the peaks worth reading: the most intense of each local group, then the keys; no overlapping text. */
  function labelled(it, ax, extra = []) {
    const out = [], ps = it.peaks.slice().sort((a, b) => b[1] - a[1]);
    const used = [];
    const fits = x => used.every(u => Math.abs(u - x) > 18);
    [...extra.map(m => it.peaks.find(p => p[0] === m)).filter(Boolean), ...ps].forEach(p => {
      if (out.length >= 14 || out.includes(p)) return;
      if (p[1] < 40 && !extra.includes(p[0])) return;
      const x = ax.X(p[0]);
      if (!fits(x)) return;
      used.push(x); out.push(p);
    });
    return out;
  }

  /** Draw an item on a TP.canvas object. opt: {keys:bool, mark:[mz], sel:[mz], x0, x1, hideM}. Returns the axes (for hit tests). */
  function plot(c, it, opt = {}) {
    const [lo, hi] = range(it), x0 = opt.x0 ?? lo, x1 = opt.x1 ?? hi;
    const ax = TP.axes(c, { x0, x1, y0: 0, y1: 112, xl: "m/z", yl: "intensità relativa (%)", yfmt: v => v <= 100 ? v : "" });
    const keyMz = opt.keys ? it.keys.map(k => k.mz) : [];
    ax.clip();
    const { ctx, X, Y } = ax;
    it.peaks.forEach(([m, v]) => {
      if (m < x0 || m > x1) return;
      const k = opt.keys && it.keys.find(q => q.mz === m), sel = opt.sel && opt.sel.includes(m);
      ctx.strokeStyle = sel ? col(2) : k ? col(TCOL[k.type] || 1) : "#24231f"; ctx.lineWidth = sel || k ? 3 : 1.6;
      ctx.beginPath(); ctx.moveTo(X(m), Y(0)); ctx.lineTo(X(m), Y(v / 9.99)); ctx.stroke();
    });
    ctx.restore();
    const lab = labelled(it, ax, [...keyMz, ...(opt.mark || []), ...(opt.sel || [])]);
    ctx.save(); ctx.font = "12px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    lab.forEach(([m, v]) => { if (m < x0 || m > x1) return; const k = opt.keys && it.keys.find(q => q.mz === m); ctx.fillStyle = k ? col(TCOL[k.type] || 1) : "#24231f"; ctx.fillText(String(m), X(m), Y(Math.min(v / 9.99, 104)) - 3); });
    ctx.restore();
    return ax;
  }

  /** The ten most intense peaks, as in a library listing. */
  function table(it, n = 10) {
    const top = it.peaks.slice().sort((a, b) => b[1] - a[1]).slice(0, n).sort((a, b) => a[0] - b[0]);
    return `<table class="eitab"><tr><th>m/z</th>${top.map(p => `<td class="n">${p[0]}</td>`).join("")}</tr><tr><th>%</th>${top.map(p => `<td class="n">${(p[1] / 9.99).toFixed(p[1] < 99 ? 1 : 0).replace(".", ",")}</td>`).join("")}</tr></table>`;
  }

  const source = it => `Spettro EI 70 eV: MassBank ${EH(it.src.accession)} (${EH(it.src.authors)}; ${EH(it.src.instrument)}), licenza ${EH(it.src.license)}. ` +
    `Scelto fra ${it.src.n_spectra} spettri dello stesso composto (somiglianza media ${String(it.src.cos_mean).replace(".", ",")}).`;

  function keysHtml(it) {
    return `<ul class="eikeys">${it.keys.map(k => `<li><b style="color:${col(TCOL[k.type] || 1)}">m/z ${k.mz}</b> ${ionHtml(k.ion)} <span class="pill">${TYPE[k.type] || k.type}</span> ${EH(k.text)}</li>`).join("")}</ul>`;
  }

  // Each spectrum of a chapter is drawn only when it comes near the screen (chapter 16 has ~40: drawing all of them at once on a
  // high-density screen would take tens of MB of canvas memory). Before printing, the ones not yet drawn are drawn.
  function render(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const it = byId(el.dataset.ei);
    if (!it) { el.innerHTML = `<p class="note">Spettro «${EH(el.dataset.ei)}» non trovato nei dati (pratica/ei-dati.js).</p>`; return; }
    const hide = el.dataset.hide === "1", keys = el.dataset.keys === "1";
    el.innerHTML = `<h4>${hide ? "Composto incognito" : EH(it.name[0].toUpperCase() + it.name.slice(1)) + " · " + ionHtml(it.formula) + " · M = " + it.M}</h4>`;
    const c = TP.canvas(el, +(el.dataset.h || 230));
    const draw = () => plot(c, it, { keys });
    c.onresize = draw; draw();
    if (el.dataset.table === "1") el.insertAdjacentHTML("beforeend", table(it));
    if (keys) el.insertAdjacentHTML("beforeend", keysHtml(it));
    el.insertAdjacentHTML("beforeend", `<p class="src">${source(it)}</p>`);
    if (hide) el.insertAdjacentHTML("beforeend", `<details class="q"><summary>Soluzione</summary><p><b>${EH(it.name)}</b>, ${ionHtml(it.formula)}.</p>${keysHtml(it)}</details>`);
  }
  function auto() {
    const els = [...document.querySelectorAll(".eispec[data-ei]")];
    els.forEach(el => { if (!el.style.minHeight) el.style.minHeight = (+(el.dataset.h || 230) + 70) + "px"; });   // keeps the page length stable
    if (!("IntersectionObserver" in window)) return els.forEach(render);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); render(e.target); } }), { rootMargin: "600px 0px" });
    els.forEach(el => io.observe(el));
    addEventListener("beforeprint", () => els.forEach(render));
  }
  document.addEventListener("DOMContentLoaded", () => { try { auto(); } catch (e) { console.error(e); } });
  return { byId, items, plot, table, source, keysHtml, ionHtml, range, TYPE, TCOL };
})();
