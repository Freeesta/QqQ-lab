"use strict";
// Part D: compare a MS2 spectrum with the spectral libraries (MSP, MGF) the user has loaded. Classic script, loaded after settings.js/explore.js.
// The reading, the archive (OPFS) and the search live in libreria-worker.js (no Pyodide); here: the «Librerie» window (gear), the window with the
// results and the mirror plot (experimental on top, library below). Nothing here touches drawSpec: the mirror is a canvas of its own.
const LIB = (() => {
  let worker = null, seq = 0; const pend = new Map();
  function w() {
    if (worker) return worker;
    worker = new Worker("static/libreria-worker.js");
    worker.onmessage = e => {
      const m = e.data, r = pend.get(m.reqId); if (!r) return;
      if (m.type === "progress") { r.prog && r.prog(m); return; }
      pend.delete(m.reqId); if (m.type === "error") r.no(new Error(m.error)); else r.ok(m);
    };
    worker.onerror = e => { pend.forEach(r => r.no(new Error("Il lettore delle librerie non parte: " + (e.message || "errore")))); pend.clear(); worker = null; };
    return worker;
  }
  const call = (cmd, payload = {}, prog) => new Promise((ok, no) => { const reqId = ++seq; pend.set(reqId, { ok, no, prog }); try { w().postMessage({ cmd, reqId, ...payload }); } catch (e) { pend.delete(reqId); no(e); } });
  const EHt = t => (typeof EH === "function" ? EH(t) : String(t));
  const fmtN = n => Number(n).toLocaleString("it-IT");
  const dlgCss = `<style>#libdlg,#libres{max-width:min(1100px,96vw);width:min(1100px,96vw)}#libdlg{width:min(720px,96vw)}#libdlg .drop{border:2px dashed var(--line);border-radius:8px;padding:14px;text-align:center;margin:8px 0}#libdlg .drop.over{border-color:var(--accent);background:var(--sel)}
    #libdlg table,#libres table{border-collapse:collapse;width:100%}#libdlg td,#libdlg th,#libres td,#libres th{padding:3px 8px;border-bottom:1px solid var(--line);text-align:left;font-size:12px}#libres td.num,#libres th.num,#libdlg td.num,#libdlg th.num{text-align:right;font-variant-numeric:tabular-nums}
    #libres tr.row{cursor:pointer}#libres tr.row.sel{background:var(--sel)}#libres tr.row:hover{background:var(--sel)}#libres .qbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:6px 0}#libres .qbar input{width:90px}#libres canvas{width:100%;height:300px;display:block;border:1px solid var(--line);border-radius:6px;margin-top:8px}
    #libres .tbl{max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:6px}#libdlg .err{color:var(--bad)}#libdlg progress{width:100%}</style>`;
  const ensureCss = () => { if (!document.getElementById("libcss")) { const s = document.createElement("div"); s.id = "libcss"; s.innerHTML = dlgCss; document.head.appendChild(s.firstChild); } };

  // ------------------------------------------------------------ the «Librerie» window
  async function open() {
    ensureCss();
    let d = document.getElementById("libdlg");
    if (!d) {
      d = document.createElement("dialog"); d.id = "libdlg"; document.body.appendChild(d);
      d.innerHTML = `<div class="top" style="display:flex;align-items:center"><h3 style="margin:0;flex:1">Librerie di spettri</h3><button class="x" id="lib-x" title="Chiudi">&times;</button></div>
        <p class="sm muted" style="margin:6px 0">Carica le librerie di spettri MS2 in formato <b>MSP</b> (NIST MS Search: Library Export; MoNA, MassBank) o <b>MGF</b> (GNPS). Restano nel browser di questo computer e si leggono una volta sola. I file NIST (.lib) e mzVault non si leggono: esportali in MSP.</p>
        <div class="drop" id="lib-drop">Trascina qui i file, oppure <button id="lib-pick">Scegli i file…</button><input type="file" id="lib-file" accept=".msp,.mgf,.lib,.mzvault,.txt" multiple hidden></div>
        <div id="lib-st"></div><div id="lib-list"></div><div class="sm muted" id="lib-space" style="margin-top:6px"></div>`;
      d.querySelector("#lib-x").onclick = () => d.close();
      const input = d.querySelector("#lib-file"), drop = d.querySelector("#lib-drop");
      d.querySelector("#lib-pick").onclick = () => input.click();
      input.onchange = () => { addFiles([...input.files]); input.value = ""; };
      drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); }; drop.ondragleave = () => drop.classList.remove("over");
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); addFiles([...e.dataTransfer.files]); };
    }
    if (!d.open) d.showModal();
    refresh();
  }
  async function refresh() {
    const d = document.getElementById("libdlg"); if (!d) return;
    const box = d.querySelector("#lib-list");
    try {
      const r = await call("list"), L = r.libs;
      box.innerHTML = L.length ? `<table><tr><th>Libreria</th><th class="num">Spettri</th><th>Polarità</th><th class="num">Scartati</th><th>Caricata il</th><th></th></tr>${L.map(l => `<tr><td title="${EHt(l.file)}">${EHt(l.name)}</td><td class="num">${fmtN(l.n)}</td><td>ESI+ ${fmtN(l.pos)} · ESI&minus; ${fmtN(l.neg)}${l.n - l.pos - l.neg ? " · ? " + fmtN(l.n - l.pos - l.neg) : ""}</td>
        <td class="num" title="senza precursore ${l.noPrec} · senza picchi ${l.noPeaks} · blocchi rotti ${l.broken}">${fmtN(l.dropped)}</td><td>${new Date(l.date).toLocaleDateString("it-IT")}</td><td><button data-rm="${EHt(l.id)}">Togli</button></td></tr>`).join("")}</table>` : `<p class="muted">Nessuna libreria caricata.</p>`;
      box.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { b.disabled = true; await call("remove", { id: b.dataset.rm }); refresh(); });
      if (navigator.storage && navigator.storage.estimate) { const s = await navigator.storage.estimate(); d.querySelector("#lib-space").textContent = `Spazio usato dal sito: ${Math.round((s.usage || 0) / 1e6)} MB${r.opfs ? "" : " (il browser non ha l'archivio a file: le librerie grandi pesano sulla memoria)"}`; }
    } catch (e) { box.innerHTML = `<p class="err">${EHt(e.message)}</p>`; }
  }
  async function addFiles(files) {
    const d = document.getElementById("libdlg"), st = d.querySelector("#lib-st");
    for (const f of files) {
      st.innerHTML = `<div class="sm">${EHt(f.name)}: lettura…</div><progress max="1" value="0"></progress>`;
      try {
        const r = await call("add", { file: f }, m => { st.innerHTML = `<div class="sm">${EHt(f.name)}: ${fmtN(m.n)} spettri letti (${Math.round(m.read / m.total * 100)}%)</div><progress max="${m.total}" value="${m.read}"></progress>`; });
        st.innerHTML = `<div class="sm">${EHt(f.name)}: ${fmtN(r.info.n)} spettri${r.info.dropped ? `, ${fmtN(r.info.dropped)} scartati (senza precursore o senza picchi)` : ""}.</div>`;
      } catch (e) { st.innerHTML = `<div class="err">${EHt(f.name)}: ${EHt(e.message)}</div>`; }
      await refresh();
    }
  }

  // ------------------------------------------------------------ the query: the MS2 spectrum shown in a panel
  function profOf(f) {                              // tolerances: the profile of hr.js when it exists, otherwise 10 ppm for a high resolution instrument and 0.5 Da
    try { if (window.HR && HR.prof) { const q = HR.prof(f, 2); if (q) return { hr: !!q.hr, v: q.hr ? q.tol : 0.5, unit: q.hr ? "ppm" : "Da" }; } } catch (e) { /* the fallback below */ }
    const hr = /orbitrap|exploris|fusion|q.?exactive|tof|ft-?icr|astral/i.test(String((f && f.instrument) || ""));
    return hr ? { hr: true, v: 10, unit: "ppm" } : { hr: false, v: 0.5, unit: "Da" };
  }
  function queryOf(p) {
    const a = p._a, d0 = a && a.data && a.data[0]; if (!d0 || !d0.d) return null;
    const d = d0.d, y = d.y0 || d.y, f = d0.f, peaks = d.mz.map((m, i) => [m, y[i]]).filter(q => q[1] > 0);
    const prec = [d.prec, p._prec, p.prec].map(Number).find(v => Number.isFinite(v) && v > 0);
    const pol = f && f.polarity === "positive" ? 1 : f && f.polarity === "negative" ? -1 : 0;
    const rt = p.r0 != null ? (p.r0 + p.r1) / 2 : null;
    return { peaks, prec, pol, f, rt, title: `${(f && f.label) || ""}${rt != null ? " · RT " + rt.toFixed(2) + " min" : ""}` };
  }

  // ------------------------------------------------------------ the results window
  function mirror(cv, q, r) {
    const s = setup(cv), g = s.g, W = s.W, H = s.H, ml = 56, mr = 14, mt = 14, mb = 34, mid = mt + (H - mt - mb) / 2, half = (H - mt - mb) / 2 - 6;
    const all = [...q.mz, ...r.mz], lo = Math.floor(Math.min(...all) / 10) * 10 - 5, hi = Math.ceil(Math.max(...all, r.prec) / 10) * 10 + 5, X = m => ml + (m - lo) / (hi - lo) * (W - ml - mr);
    const acc = css("--accent"), ink = css("--ink"), mut = css("--muted"), line = css("--line");
    g.clearRect(0, 0, W, H); g.fillStyle = css("--panel"); g.fillRect(0, 0, W, H);
    const common = { q: new Set(r.pairs.map(p => p[0])), l: new Set(r.pairs.map(p => p[1])) };
    g.lineWidth = 1.5; g.font = fpx(12);
    const bars = (mz, it, set, dir) => mz.forEach((m, i) => {
      const hh = it[i] * half; g.strokeStyle = set.has(i) ? acc : mut; g.lineWidth = set.has(i) ? 2 : 1.3;
      g.beginPath(); g.moveTo(X(m), mid); g.lineTo(X(m), mid - dir * hh); g.stroke();
      if (it[i] > 0.08) { g.fillStyle = set.has(i) ? acc : mut; g.textAlign = "center"; g.fillText(m.toFixed(r.prec > 0 && q.hr ? 4 : 2), X(m), dir > 0 ? mid - hh - 4 : mid + hh + 13); }
    });
    bars(q.mz, q.it, common.q, 1); bars(r.mz, r.it, common.l, -1);
    g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(ml, mid); g.lineTo(W - mr, mid); g.stroke();
    g.fillStyle = mut; g.textAlign = "center"; g.beginPath(); g.strokeStyle = mut; g.moveTo(ml, H - mb + 6); g.lineTo(W - mr, H - mb + 6); g.stroke();
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find(v => (hi - lo) / v <= 9) || 500;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { g.beginPath(); g.moveTo(X(v), H - mb + 6); g.lineTo(X(v), H - mb + 10); g.stroke(); g.fillText(String(v), X(v), H - mb + 22); }
    g.fillStyle = ink; g.textAlign = "left"; g.fillText("sperimentale", ml + 4, mt + 10); g.fillText(r.name || "libreria", ml + 4, H - mb - 6);
    g.save(); g.fillStyle = mut; g.textAlign = "center"; g.translate(14, mid); g.rotate(-Math.PI / 2); g.fillText("intensità relativa", 0, 0); g.restore();
    g.fillStyle = acc; g.textAlign = "right"; g.fillText(`${r.shared} picchi in comune`, W - mr - 4, mt + 10);
  }
  async function searchFrom(p) {
    ensureCss();
    const q = queryOf(p);
    if (!q || !q.peaks.length) return info("Scegli prima una scansione MS2 nello spettro.");
    let d = document.getElementById("libres");
    if (!d) { d = document.createElement("dialog"); d.id = "libres"; document.body.appendChild(d); }
    const prof = profOf(q.f), st = { prec: q.prec != null ? +q.prec.toFixed(4) : null, v: prof.v, unit: prof.unit, frag: prof.hr ? 0.01 : 0.5, hr: prof.hr, res: null, sel: 0 };
    d.innerHTML = `<div class="top" style="display:flex;align-items:center"><h3 style="margin:0;flex:1">Cerca nelle librerie</h3><button class="x" id="lr-x" title="Chiudi">&times;</button></div>
      <div class="sm muted" id="lr-q" style="margin-top:4px">${EHt(q.title)}</div>
      <div class="qbar"><label>precursore <i>m/z</i> <input id="lr-prec" value="${st.prec ?? ""}"></label><label>tolleranza <input id="lr-tol" value="${st.v}"> <select id="lr-unit"><option value="ppm">ppm</option><option value="Da">Da</option></select></label>
        <label>picchi entro <input id="lr-frag" value="${st.frag}"> Da</label><button id="lr-go">Cerca</button><button id="lr-copy" title="Copia la tabella: incollata in Excel riempie righe e colonne">Copia la tabella</button><button id="lr-xlsx">Excel</button><button id="lr-libs">Librerie…</button><span class="sm muted" id="lr-msg"></span></div>
      <div id="lr-body"></div><canvas id="lr-cv" hidden></canvas>`;
    d.querySelector("#lr-unit").value = st.unit;
    d.querySelector("#lr-x").onclick = () => d.close(); d.querySelector("#lr-libs").onclick = () => { open(); };
    const msg = t => { d.querySelector("#lr-msg").textContent = t || ""; };
    const colHead = ["#", "Nome", "Entropia", "Coseno", "Picchi in comune", "Δ precursore", "CE", "Strumento", "Addotto", "Libreria"];
    const rowsOf = rs => rs.map((r, i) => [i + 1, r.name, r.ent, r.cos, r.shared, r.dprec, r.ce, r.inst, r.type, r.lib]);
    const show = () => {
      const R = st.res, body = d.querySelector("#lr-body"), cv = d.querySelector("#lr-cv");
      if (!R) { body.innerHTML = ""; cv.hidden = true; return; }
      if (!R.libs) { body.innerHTML = `<p>Carica una libreria (ingranaggio → Librerie).</p><p><button id="lr-open">Apri «Librerie»</button></p>`; body.querySelector("#lr-open").onclick = () => open(); cv.hidden = true; return; }
      if (!R.results.length) { body.innerHTML = `<p>Nessuna voce delle librerie ha un precursore entro la tolleranza (${st.v} ${st.unit}) e la stessa polarità.</p>`; cv.hidden = true; return; }
      const dp = r => st.unit === "ppm" ? r.dprec.toFixed(1) + " ppm" : (r.dprec >= 0 ? "+" : "") + r.dprec.toFixed(4) + " Da";
      body.innerHTML = `<div class="tbl"><table><tr><th class="num">#</th><th>Nome</th><th class="num">Entropia</th><th class="num">Coseno</th><th class="num">Picchi in comune</th><th class="num">&Delta; precursore</th><th>CE</th><th>Strumento</th><th>Addotto</th><th>Libreria</th></tr>${R.results.map((r, i) => `<tr class="row${i === st.sel ? " sel" : ""}" data-i="${i}"><td class="num">${i + 1}</td><td>${EHt(r.name)}</td><td class="num">${r.ent.toFixed(3)}</td><td class="num">${r.cos.toFixed(3)}</td><td class="num">${r.shared}</td><td class="num">${dp(r)}</td><td>${EHt(r.ce)}</td><td>${EHt(r.inst)}</td><td>${EHt(r.type)}</td><td>${EHt(r.lib)}</td></tr>`).join("")}</table></div>`;
      body.querySelectorAll("tr.row").forEach(tr => tr.onclick = () => { st.sel = +tr.dataset.i; body.querySelectorAll("tr.row").forEach(x => x.classList.toggle("sel", x === tr)); draw(); });
      cv.hidden = false; draw();
    };
    const draw = () => { const R = st.res; if (!R || !R.results.length) return; const cv = d.querySelector("#lr-cv"), r = R.results[st.sel]; mirror(cv, { mz: R.query.mz, it: R.query.it, hr: st.hr }, r); };
    const run = async () => {
      const num = id => parseFloat(String(d.querySelector(id).value).replace(",", "."));
      st.prec = num("#lr-prec"); st.v = num("#lr-tol"); st.unit = d.querySelector("#lr-unit").value; st.frag = num("#lr-frag");
      if (!(st.prec > 0) || !(st.v > 0) || !(st.frag > 0)) return msg("Controlla precursore e tolleranze.");
      msg("cerco…"); const t0 = performance.now();
      try {
        st.res = await call("search", { peaks: q.peaks, prec: st.prec, pol: q.pol, tol: { v: st.v, unit: st.unit }, frag: st.frag }); st.sel = 0;
        msg(st.res.libs ? `${st.res.results.length} risultati in ${Math.round(performance.now() - t0)} ms` : "");
      } catch (e) { st.res = null; msg("Errore: " + e.message); }
      show();
    };
    d.querySelector("#lr-go").onclick = run;
    d.querySelectorAll(".qbar input").forEach(i => i.onkeydown = e => { if (e.key === "Enter") run(); });
    const table = () => { const h = colHead, rs = st.res ? rowsOf(st.res.results) : []; return { h, rs }; };
    d.querySelector("#lr-copy").onclick = async () => {
      const { h, rs } = table(); if (!rs.length) return msg("Niente da copiare.");
      const it = /^it/i.test(navigator.language || ""), f = (v, k) => typeof v === "number" ? String(k === 5 ? +v.toFixed(st.unit === "ppm" ? 1 : 4) : +v.toFixed(3)).replace(".", it ? "," : ".") : String(v ?? "");
      const tsv = h.join("\t") + "\n" + rs.map(r => r.map((v, k) => f(v, k)).join("\t")).join("\n");
      const html = `<table><tr>${h.map(x => `<th>${EHt(x)}</th>`).join("")}</tr>${rs.map(r => `<tr>${r.map((v, k) => `<td>${EHt(f(v, k))}</td>`).join("")}</tr>`).join("")}</table>`;
      try { if (window.ClipboardItem && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([tsv], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]); else await navigator.clipboard.writeText(tsv); msg(`copiate ${rs.length} righe: incolla in Excel`); }
      catch (e) { try { await navigator.clipboard.writeText(tsv); msg(`copiate ${rs.length} righe: incolla in Excel`); } catch (e2) { msg("Il browser non permette di copiare qui."); } }
    };
    d.querySelector("#lr-xlsx").onclick = () => { const { h, rs } = table(); if (!rs.length) return msg("Niente da salvare."); dlx((typeof plotName === "function" ? plotName(p) : "spettro") + "_librerie.xlsx", [{ name: "Risultati", head: h, rows: rs, widths: [5, 30, 10, 10, 16, 14, 8, 14, 12, 20] }]); };
    d.showModal(); window.addEventListener("resize", draw, { once: true });
    if (st.prec) run(); else msg("Scrivi il precursore e premi Cerca.");
  }
  return { open, searchFrom, call };
})();
window.LIB = LIB;
