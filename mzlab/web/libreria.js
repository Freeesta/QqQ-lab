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
    const acc = css("--accent"), ink = css("--ink"), mut = css("--muted"), line = css("--line"), shc = css("--ok");
    g.clearRect(0, 0, W, H); g.fillStyle = css("--panel"); g.fillRect(0, 0, W, H);
    const common = { q: new Set(r.pairs.map(p => p[0])), l: new Set(r.pairs.map(p => p[1])) };
    g.lineWidth = 1.5; g.font = fpx(12);
    const shq = new Set((r.pairs || []).filter(p => p[2]).map(p => p[0])), shl = new Set((r.pairs || []).filter(p => p[2]).map(p => p[1]));      // analogues: peaks matched after the shift
    const bars = (mz, it, set, dir) => mz.forEach((m, i) => {
      const hh = it[i] * half, sh = (dir > 0 ? shq : shl).has(i); g.strokeStyle = sh ? shc : set.has(i) ? acc : mut; g.lineWidth = set.has(i) ? 2 : 1.3;
      g.beginPath(); g.moveTo(X(m), mid); g.lineTo(X(m), mid - dir * hh); g.stroke();
      if (it[i] > 0.08) { g.fillStyle = sh ? shc : set.has(i) ? acc : mut; g.textAlign = "center"; g.fillText(m.toFixed(r.prec > 0 && q.hr ? 4 : 2), X(m), dir > 0 ? mid - hh - 4 : mid + hh + 13); }
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
  // thresholds of the verdict (Federico: visible and editable): strong = entropy >= ent, >= nshared common peaks, |precursor error| <= ppm; possible = entropy >= ent2
  const SOG_KEY = "qqq.lib.soglie", SOG0 = { ent: 0.75, shared: 6, ppm: 5, ent2: 0.60 };
  const sog = () => { try { return { ...SOG0, ...JSON.parse(localStorage.getItem(SOG_KEY) || "{}") }; } catch (e) { return { ...SOG0 }; } };
  const setSog = o => { try { localStorage.setItem(SOG_KEY, JSON.stringify(o)); } catch (e) { /* not available */ } };
  function verdict(r, unit, T = sog()) {                       // r = the best result (or null): one of three sentences, never a certainty (level 2a of Schymanski needs the library spectrum, 1 needs a standard)
    if (!r) return { k: "no", t: "Nessuna corrispondenza" };
    const ppm = unit === "ppm" ? Math.abs(r.dprec) : null, okp = ppm == null || ppm <= T.ppm;
    if (r.ent >= T.ent && r.shared >= T.shared && okp) return { k: "forte", t: "Corrispondenza forte" };
    if (r.ent >= T.ent2) return { k: "possibile", t: "Corrispondenza possibile" };
    return { k: "no", t: "Nessuna corrispondenza" };
  }
  // neutral change between a query and an analogue: the usual transformations first, then the simplest formula within 3 mDa (the composition of the server)
  const TRANSF = [[15.9949146, "+O (ossidrilazione)"], [-2.01565, "−2H (deidrogenazione)"], [13.97926, "+O −2H"], [-26.01565, "−C₂H₂"], [1.97926, "−CH₂ +O"], [-56.0626, "−C₄H₈ (dealchilazione)"],
    [18.010565, "+H₂O"], [-18.010565, "−H₂O"], [-27.9949146, "−CO"], [2.01565, "+2H"], [-14.01565, "−CH₂ (demetilazione)"], [14.01565, "+CH₂ (metilazione)"], [-43.98983, "−CO₂"], [31.98983, "+O₂"]];
  const sgnTxt = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(4);
  function deltaKnown(dm) { const t = TRANSF.find(([m]) => Math.abs(m - dm) <= 0.003); return t ? t[1] : null; }
  async function deltaFormula(dm) {
    try {
      const j = await J(`api/composition?mz=${Math.abs(dm) - 0.000548579909}&ion=${encodeURIComponent("M+.")}&tol=3&unit=mda&max=30&elements=${encodeURIComponent("C:0-12,H:0-24,N:0-4,O:0-6,S:0-2")}`);
      const atoms = f => [...f.matchAll(/([A-Z][a-z]?)(\d*)/g)].reduce((n, m) => n + (+m[2] || 1), 0), best = j.results.map(r => [atoms(r.formula), r.formula]).sort((a, b) => a[0] - b[0])[0];
      return best ? (dm < 0 ? "−" : "+") + best[1] + " (formula più semplice entro 3 mDa)" : null;
    } catch (e) { return null; }
  }
  async function searchFrom(p) {
    ensureCss();
    const q = queryOf(p);
    if (!q || !q.peaks.length) return info("Scegli prima una scansione MS2 nello spettro.");
    let d = document.getElementById("libres");
    if (!d) { d = document.createElement("dialog"); d.id = "libres"; document.body.appendChild(d); }
    const prof = profOf(q.f), st = { prec: q.prec != null ? +q.prec.toFixed(4) : null, v: prof.v, unit: prof.unit, frag: prof.hr ? 0.01 : 0.5, hr: prof.hr, res: null, sel: 0, tab: "id", an: null };
    d.innerHTML = `<div class="top" style="display:flex;align-items:center"><h3 style="margin:0;flex:1">Cerca nelle librerie</h3><button class="x" id="lr-x" title="Chiudi">&times;</button></div>
      <div class="sm muted" id="lr-q" style="margin-top:4px">${EHt(q.title)}</div>
      <div class="qbar"><label>precursore <i>m/z</i> <input id="lr-prec" value="${st.prec ?? ""}"></label><label>tolleranza <input id="lr-tol" value="${st.v}"> <select id="lr-unit"><option value="ppm">ppm</option><option value="Da">Da</option></select></label>
        <label>picchi entro <input id="lr-frag" value="${st.frag}"> Da</label><button id="lr-go">Cerca</button><button id="lr-copy" title="Copia la tabella: incollata in Excel riempie righe e colonne">Copia la tabella</button><button id="lr-xlsx">Excel</button><button id="lr-libs">Librerie…</button><span class="sm muted" id="lr-msg"></span></div>
      ${st.hr ? `<div class="qbar" id="lr-tabs"><button data-t="id" class="on">Identità</button><button data-t="an">Analoghi</button><details id="lr-sog" style="margin-left:auto"><summary class="sm">Soglie del giudizio</summary><div class="sm" style="padding:4px 0">forte: entropia ≥ <input id="sg-ent" style="width:50px"> , almeno <input id="sg-sh" style="width:40px"> picchi in comune, |Δ precursore| ≤ <input id="sg-ppm" style="width:40px"> ppm · possibile: entropia ≥ <input id="sg-ent2" style="width:50px"></div></details></div>
      <div id="lr-verdict"></div>` : ""}
      <div id="lr-body"></div><canvas id="lr-cv" hidden></canvas>`;
    d.querySelector("#lr-unit").value = st.unit;
    d.querySelector("#lr-x").onclick = () => d.close(); d.querySelector("#lr-libs").onclick = () => { open(); };
    const msg = t => { d.querySelector("#lr-msg").textContent = t || ""; };
    const colHead = ["#", "Nome", "Entropia", "Coseno", "Picchi in comune", "Δ precursore", "CE", "Strumento", "Addotto", "Libreria"];
    const rowsOf = rs => rs.map((r, i) => [i + 1, r.name, r.ent, r.cos, r.shared, r.dprec, r.ce, r.inst, r.type, r.lib]);
    const vdEl = () => d.querySelector("#lr-verdict");
    const show = () => {
      const R = st.res, body = d.querySelector("#lr-body"), cv = d.querySelector("#lr-cv");
      if (vdEl()) vdEl().innerHTML = "";
      if (st.tab === "an") return showAn();
      if (!R) { body.innerHTML = ""; cv.hidden = true; return; }
      if (!R.libs) { body.innerHTML = `<p>Carica una libreria (ingranaggio → Librerie).</p><p><button id="lr-open">Apri «Librerie»</button></p>`; body.querySelector("#lr-open").onclick = () => open(); cv.hidden = true; return; }
      if (!R.results.length) { body.innerHTML = `<p>Nessuna voce delle librerie ha un precursore entro la tolleranza (${st.v} ${st.unit}) e la stessa polarità.</p>`; cv.hidden = true; return; }
      const dp = r => st.unit === "ppm" ? r.dprec.toFixed(1) + " ppm" : (r.dprec >= 0 ? "+" : "") + r.dprec.toFixed(4) + " Da";
      body.innerHTML = `<div class="tbl"><table><tr><th class="num">#</th><th>Nome</th><th class="num">Entropia</th><th class="num">Coseno</th><th class="num">Picchi in comune</th><th class="num">&Delta; precursore</th><th>CE</th><th>Strumento</th><th>Addotto</th><th>Libreria</th></tr>${R.results.map((r, i) => `<tr class="row${i === st.sel ? " sel" : ""}" data-i="${i}"><td class="num">${i + 1}</td><td>${EHt(r.name)}</td><td class="num">${r.ent.toFixed(3)}</td><td class="num">${r.cos.toFixed(3)}</td><td class="num">${r.shared}</td><td class="num">${dp(r)}</td><td>${EHt(r.ce)}</td><td>${EHt(r.inst)}</td><td>${EHt(r.type)}</td><td>${EHt(r.lib)}</td></tr>`).join("")}</table></div>`;
      body.querySelectorAll("tr.row").forEach(tr => tr.onclick = () => { st.sel = +tr.dataset.i; body.querySelectorAll("tr.row").forEach(x => x.classList.toggle("sel", x === tr)); draw(); });
      if (st.hr && vdEl()) {                                   // a verdict only for high-resolution data (the low-resolution world gives candidates, never answers)
        const v = verdict(R.results[0], st.unit);
        vdEl().innerHTML = `<div class="vd ${v.k}" style="margin:6px 0;padding:6px 10px;border-radius:6px;border:1px solid var(--line);border-left:5px solid var(--${v.k === "forte" ? "ok" : v.k === "possibile" ? "accent" : "muted"})"><b>${v.t}</b>${v.k !== "no" ? `: ${EHt(R.results[0].name)}` : ""} <span class="sm muted">· livello 2a di Schymanski (spettro di libreria): senza uno standard non è mai il livello 1</span></div>`;
      }
      cv.hidden = false; draw();
    };
    // analogues (WP-H9): the library spectra with another precursor (up to 200 Da apart) that match the query after a shift of the precursor difference
    const showAn = () => {
      const A = st.an, body = d.querySelector("#lr-body"), cv = d.querySelector("#lr-cv");
      if (!A) { body.innerHTML = `<p class="muted">Cerco gli analoghi…</p>`; cv.hidden = true; return; }
      if (!A.libs) { body.innerHTML = `<p>Carica una libreria (ingranaggio → Librerie).</p>`; cv.hidden = true; return; }
      if (!A.results.length) { body.innerHTML = `<p>Nessun analogo: nessuna voce delle librerie ha almeno 4 picchi abbinati (con o senza lo spostamento del precursore).</p>`; cv.hidden = true; return; }
      body.innerHTML = `<div class="tbl"><table><tr><th class="num">#</th><th>Nome dell'analogo</th><th class="num">&Delta;m</th><th>Interpretazione</th><th class="num">Coseno modificato</th><th class="num">Picchi abbinati</th><th>Libreria</th></tr>
        ${A.results.map((r, i) => `<tr class="row${i === st.sel ? " sel" : ""}" data-i="${i}"><td class="num">${i + 1}</td><td>${EHt(r.name)}</td><td class="num">${sgnTxt(r.delta)}</td><td data-dm="${i}">${EHt(deltaKnown(r.delta) || "…")}</td><td class="num">${r.mcos.toFixed(2)}</td><td class="num">${r.matched} (${r.shifted} spostati)</td><td>${EHt(r.lib)}</td></tr>`).join("")}</table></div>
        <div class="sm muted" style="margin-top:4px">Candidati per somiglianza di spettro, non identificazioni: i picchi verdi sono quelli abbinati dopo lo spostamento del precursore.</div>`;
      body.querySelectorAll("tr.row").forEach(tr => tr.onclick = () => { st.sel = +tr.dataset.i; body.querySelectorAll("tr.row").forEach(x => x.classList.toggle("sel", x === tr)); draw(); });
      A.results.forEach(async (r, i) => { if (!deltaKnown(r.delta)) { const t = await deltaFormula(r.delta); const c = body.querySelector(`[data-dm="${i}"]`); if (c) c.textContent = t || "(nessuna formula semplice)"; } });
      cv.hidden = false; draw();
    };
    const draw = () => { if (st.tab === "an") { const A = st.an; if (!A || !A.results.length) return; const r = A.results[st.sel] || A.results[0]; mirror(d.querySelector("#lr-cv"), { mz: r.qa.mz, it: r.qa.it, hr: true }, { mz: r.la.mz, it: r.la.it, prec: r.prec, name: r.name, shared: r.matched, pairs: r.pairs }); return; }
      const R = st.res; if (!R || !R.results.length) return; const cv = d.querySelector("#lr-cv"), r = R.results[st.sel]; mirror(cv, { mz: R.query.mz, it: R.query.it, hr: st.hr }, r); };
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
    const runAn = async () => {
      st.an = null; show();
      try { st.an = await call("analogs", { peaks: q.peaks, prec: st.prec, pol: q.pol, frag: st.frag, maxDelta: 200, max: 10 }); st.sel = 0; msg(st.an.libs ? `${st.an.results.length} analoghi` : ""); } catch (e) { st.an = null; msg("Errore: " + e.message); }
      show();
    };
    d.querySelectorAll("#lr-tabs [data-t]").forEach(b => b.onclick = () => { st.tab = b.dataset.t; st.sel = 0; d.querySelectorAll("#lr-tabs [data-t]").forEach(x => x.classList.toggle("on", x === b)); if (st.tab === "an") runAn(); else show(); });
    if (d.querySelector("#lr-sog")) {
      const T = sog(), f = { "#sg-ent": "ent", "#sg-sh": "shared", "#sg-ppm": "ppm", "#sg-ent2": "ent2" };
      Object.entries(f).forEach(([id, k]) => { const el = d.querySelector(id); el.value = String(T[k]).replace(".", ","); el.onchange = () => { const v = parseFloat(el.value.replace(",", ".")); if (v >= 0) { setSog({ ...sog(), [k]: v }); show(); } }; });
    }
    d.querySelector("#lr-go").onclick = () => { if (st.tab === "an") { st.prec = parseFloat(String(d.querySelector("#lr-prec").value).replace(",", ".")); st.frag = parseFloat(String(d.querySelector("#lr-frag").value).replace(",", ".")); runAn(); } else run(); };
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
  // ------------------------------------------------------------ «Identifica tutte le MS2 del file» (WP-H8): every MS2 of a high-resolution file against the libraries
  // the MS2 of each scan are read in blocks of 60 (api/scanbin); the worker answers with the best library entry of each; the scans of one precursor (10 ppm) and one peak (RT within 0.2 min) are grouped
  const phys = f => (f && f.file ? f.file.split("#")[0] : "");
  function groupRows(rows, ppm = 10, dRt = 0.2) {
    const R = rows.filter(r => r.prec).sort((a, b) => a.prec - b.prec), byPrec = [];
    for (const r of R) { const g = byPrec[byPrec.length - 1]; if (g && Math.abs(r.prec - g[g.length - 1].prec) <= r.prec * ppm * 1e-6) g.push(r); else byPrec.push([r]); }
    const out = [];
    for (const g of byPrec) {
      g.sort((a, b) => a.rt - b.rt); let cur = [g[0]];
      const flush = () => {
        const named = cur.filter(r => r.name && r.ent != null), best = (named.length ? named : cur).reduce((x, y) => ((y.ent ?? -1) > (x.ent ?? -1) ? y : x));
        out.push({ rt: best.rt, prec: cur.reduce((x, r) => x + r.prec, 0) / cur.length, n: cur.length, best, rows: cur });
      };
      for (let i = 1; i < g.length; i++) { if (g[i].rt - g[i - 1].rt <= dRt) cur.push(g[i]); else { flush(); cur = [g[i]]; } }
      flush();
    }
    return out.sort((a, b) => a.rt - b.rt);
  }
  function groupVerdict(g, T = sog()) {              // two or more scans are needed for a strong match: a single scan is marked and capped at "possible"
    const v = verdict(g.best && g.best.name ? g.best : null, "ppm", T);
    if (v.k === "forte" && g.n < 2) return { k: "possibile", t: "Corrispondenza possibile (1 scansione)" };
    return v;
  }
  async function identifyAll(k) {
    ensureCss();
    const f = E.files[k]; if (!f) return;
    const k2 = (E.files.find(x => phys(x) === phys(f) && x.kind === "ms2" && !x.gone) || {}).k;
    if (k2 == null) return info("Questo file non ha scansioni MS2.");
    let d = document.getElementById("libid");
    if (!d) { d = document.createElement("dialog"); d.id = "libid"; document.body.appendChild(d); }
    d.innerHTML = `<div class="top" style="display:flex;align-items:center"><h3 style="margin:0;flex:1">Identifica tutte le MS2 del file</h3><button class="x" id="li-x" title="Chiudi">&times;</button></div>
      <div class="sm muted" style="margin-top:4px">${EHt(f.label || f.file)} · tolleranze: precursore ${profOf(f).v} ppm, picchi 0,01 Da · candidati con spettro di libreria (livello 2a di Schymanski), mai un'identificazione certa</div>
      <div id="li-st" style="margin:8px 0"></div><div id="li-body"></div>`;
    d.querySelector("#li-x").onclick = () => d.close(); d.showModal();
    const st = d.querySelector("#li-st"), say = (t, v, m) => { st.innerHTML = `<div class="sm">${EHt(t)}</div>${m ? `<progress max="${m}" value="${v}"></progress>` : ""}`; };
    try {
      const libs = await call("list"); if (!libs.libs.length) { st.innerHTML = `<p>Carica una libreria (ingranaggio → Librerie).</p><p><button id="li-open">Apri «Librerie»</button></p>`; d.querySelector("#li-open").onclick = () => { d.close(); open(); }; return; }
      say("Leggo le MS2 del file…", 0, 1);
      const dda = await J(`api/dda?k=${k2}`), tgt = new Map(dda.sid.map((s, i) => [s, dda.tgt[i]])), pol = f.polarity === "negative" ? -1 : 1, queries = [];
      let n = 1, i0 = 0;
      for (; i0 < n; i0 += 60) {
        const b = typeof scBin === "function" ? await scBin(`api/scanbin?k=${k2}&i0=${i0}&i1=${i0 + 59}&level=2`) : await J(`api/spectra?k=${k2}&i0=${i0}&i1=${i0 + 59}&level=2`); n = b.n;
        for (const s of b.scans) { const pr = tgt.get(s.sid); if (pr && s.mz.length) queries.push({ key: s.sid, rt: s.rt, prec: pr, pol, peaks: s.mz.map((m, j) => [m, s.y[j]]) }); }
        say(`Leggo le MS2 del file: ${Math.min(i0 + 60, n)} di ${n}`, Math.min(i0 + 60, n), n);
      }
      const t0 = performance.now();
      say("Confronto con le librerie…", 0, queries.length);
      const r = await call("searchAll", { queries, tol: { v: profOf(f).v, unit: "ppm" }, frag: 0.01 }, m => say(`Confronto con le librerie: ${m.read} di ${m.total}`, m.read, m.total));
      if (window.LISTE) await LISTE.ready();
      const groups = groupRows(r.rows), show = all => {
<<<<<<< HEAD
        const rows = groups.map(g => ({ g, v: groupVerdict(g), k: window.LISTE ? LISTE.textFor(g.prec, f.polarity, UIP.hrPpm) : "" })).filter(x => all || x.v.k !== "no"), hasK = rows.some(x => x.k);
        d.querySelector("#li-body").innerHTML = `<label class="sm"><input type="checkbox" id="li-all"${all ? " checked" : ""}> mostra anche i picchi senza corrispondenza (${groups.length} in tutto)</label>
          <div class="tbl" style="max-height:60vh"><table><tr><th class="num">RT</th><th class="num"><i>m/z</i></th><th>Nome</th><th>Formula</th><th class="num">Entropia migliore</th><th class="num">Scansioni</th><th>Giudizio</th>${hasK ? "<th>Contaminante noto</th>" : ""}</tr>
          ${rows.map((x, i) => `<tr class="row" data-i="${i}" title="Apre la scansione migliore"><td class="num">${x.g.rt.toFixed(2)}</td><td class="num">${x.g.prec.toFixed(4)}</td><td>${EHt(x.g.best.name || "")}</td><td>${x.g.best.formula ? fmtFormula(x.g.best.formula) : ""}</td><td class="num">${x.g.best.ent != null ? x.g.best.ent.toFixed(2) : ""}</td><td class="num">${x.g.n}${x.g.n < 2 ? " (1 scansione)" : ""}</td><td>${EHt(x.v.t)}</td>${hasK ? `<td class="sm">${EHt(x.k || "")}</td>` : ""}</tr>`).join("") || `<tr><td colspan="7" class="muted">Nessun picco ha una corrispondenza nelle librerie caricate.</td></tr>`}</table></div>`;
=======
        const rows = groups.map(g => ({ g, v: groupVerdict(g) })).filter(x => all || x.v.k !== "no");
        d.querySelector("#li-body").innerHTML = `<div class="bar"><button id="li-xlsx" type="button">${typeof IC_DL !== "undefined" ? IC_DL : ""}Excel</button></div><label class="sm"><input type="checkbox" id="li-all"${all ? " checked" : ""}> mostra anche i picchi senza corrispondenza (${groups.length} in tutto)</label>
          <div class="tbl" style="max-height:60vh"><table><tr><th class="num">RT</th><th class="num"><i>m/z</i></th><th>Nome</th><th>Formula</th><th class="num">Entropia migliore</th><th class="num">Scansioni</th><th>Giudizio</th></tr>
          ${rows.map((x, i) => `<tr class="row" data-i="${i}" title="Apre la scansione migliore"><td class="num">${x.g.rt.toFixed(2)}</td><td class="num">${x.g.prec.toFixed(4)}</td><td>${EHt(x.g.best.name || "")}</td><td>${x.g.best.formula ? fmtFormula(x.g.best.formula) : ""}</td><td class="num">${x.g.best.ent != null ? x.g.best.ent.toFixed(2) : ""}</td><td class="num">${x.g.n}${x.g.n < 2 ? " (1 scansione)" : ""}</td><td>${EHt(x.v.t)}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Nessun picco ha una corrispondenza nelle librerie caricate.</td></tr>`}</table></div>`;
>>>>>>> origin/main
        d.querySelector("#li-all").onchange = e => show(e.target.checked);
        d.querySelector("#li-xlsx").onclick = () => dlx(`identificazione_${String(f.label || f.file || "file").replace(/[^\w.-]+/g, "_")}.xlsx`, [
          { name: "Candidati", head: ["RT (min)", "m/z precursore", "Nome", "Formula", "Entropia migliore", "Scansioni", "Giudizio"], rows: rows.map(x => [+x.g.rt.toFixed(3), +x.g.prec.toFixed(5), x.g.best.name || "", x.g.best.formula || "", x.g.best.ent != null ? +x.g.best.ent.toFixed(3) : "", x.g.n, x.v.t]), widths: [10, 14, 40, 20, 14, 10, 40] },
          { name: "Parametri", head: ["Parametro", "Valore"], rows: [["File", f.label || f.file || ""], ["Tolleranza del precursore", `${profOf(f).v} ppm`], ["Tolleranza dei picchi", "0,01 Da"], ["Picchi mostrati", `${rows.length} di ${groups.length}`], ["Livello", "candidati con spettro di libreria (livello 2a di Schymanski), mai un'identificazione certa"]], widths: [28, 70] }]);
        d.querySelectorAll("#li-body tr.row").forEach(tr => tr.onclick = () => gotoScan(rows[+tr.dataset.i].g.best.key, d));
        st.innerHTML = `<div class="sm">${queries.length} MS2 confrontate in ${Math.round(performance.now() - t0)} ms · ${groups.length} picchi (precursore e tempo) · ${rows.length} mostrati</div>`;
      };
      show(false);
    } catch (e) { st.innerHTML = `<p class="err">${EHt(e.message)}</p>`; }
  }
  function gotoScan(sid, d) {                         // the MS2 panel of the DDA trio shows that scan
    try {
      const s1 = E.panels.find(q => q.type === "spec" && q.duo != null && q.el), s2 = s1 && E.panels.find(q => q.id === s1.duo && q.el);
      if (!s2 || !window.DDA) return toast("Per vedere la scansione apri il trio DDA (cromatogramma, Full Scan, MS2) della scheda Full Scan.");
      d.close(); DDA.selectMs2(s2, sid); s2.el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (e) { toast("Non riesco ad aprire la scansione."); }
  }
  return { open, searchFrom, call, identifyAll, groupRows, groupVerdict, verdict };
})();
window.LIB = LIB;
