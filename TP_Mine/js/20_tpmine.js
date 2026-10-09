// TPMINE-PRIVATE  TP Mine: the tab with the whole automatic search of transformation products (only for the course owner).
(() => {
  "use strict";
  const ctx = () => QTOOLS.ctx;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtA = v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k" : String(Math.round(v));
  const TYPES = { sample: "campione", blank: "bianco", standard: "standard", control: "controllo" };
  const KINDS = { full: "Full scan", ms2: "MS2", mrm: "MRM", hr: "LC-HRMS", msn: "MSn (infusione)", empty: "vuoto", error: "errore" };
  const LAB = { forte: "forte", possibile: "possibile", debole: "debole", progenitore: "progenitore" };

  const CSS = `
.tp{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:14px;align-items:start;padding:12px 16px}
@media(max-width:1000px){.tp{grid-template-columns:1fr}}
.tp h3{margin:0 0 6px;font-size:14px}.tp .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.tp .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}.tp .grow{flex:1;min-width:120px}.tp input[type=text],.tp textarea,.tp input[type=number]{width:100%;box-sizing:border-box}
.tp .mut{color:var(--muted);font-size:12px}.tp table{border-collapse:collapse;width:100%;font-size:12px}.tp th,.tp td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
.tp th{position:sticky;top:0;background:var(--panel);font-weight:600;color:var(--muted)}.tp td.n{text-align:right;font-variant-numeric:tabular-nums}
.tp tr.sel{background:var(--sel)}.tp tr.clk{cursor:pointer}.tp tr.clk:hover{background:var(--sel)}
.tp .badge{display:inline-block;padding:0 6px;border-radius:9px;font-size:11px;font-weight:600;border:1px solid var(--line)}
.tp .b-forte{background:#e7f6ee;color:var(--ok);border-color:#b7e1c9}.tp .b-possibile{background:#fdf3e0;color:var(--warn);border-color:#f1d9a8}.tp .b-debole{color:var(--muted)}
.tp .lv{display:inline-block;min-width:18px;text-align:center;border-radius:4px;color:#fff;font-weight:700;font-size:11px;padding:0 4px}.tp .lv3{background:#047857}.tp .lv4{background:#2b5c8a}.tp .lv5{background:#8a6d2b}
.tp .bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin-top:6px}.tp .bar i{display:block;height:100%;background:var(--accent);width:0}
.tp .tbl{max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:6px}.tp canvas{width:100%;height:210px;display:block}
.tp .crit li{margin:2px 0}.tp .crit .pass{color:var(--ok)}.tp .crit .fail{color:var(--bad)}.tp .crit .na{color:var(--muted)}
.tp .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:1300px){.tp .cols{grid-template-columns:1fr}}
.tp .err{color:var(--bad)}.tp details>summary{cursor:pointer;color:var(--muted);font-size:12px}.tp textarea{font:12px ui-monospace,monospace;min-height:150px}
.tp .kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12px}.tp .kv b{color:var(--muted);font-weight:600}
.hero{background:linear-gradient(135deg,#17324d,#2b5c8a 55%,#4b2c83);color:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 6px 22px rgba(43,92,138,.35);animation:tpIn .5s ease}
.hero button{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.35)}.hero button:hover{background:rgba(255,255,255,.25)}
.tp #tp-files th{position:static}.tp .hero-i{font-size:40px;line-height:1}.hero-t{display:flex;gap:12px;align-items:center}.hero h2{margin:0;font-size:22px}.hero-s{opacity:.85;font-size:12px}.hero-i{filter:drop-shadow(0 0 8px #ffd27a);color:#ffd27a;animation:tpGlow 2.4s ease-in-out infinite}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.stat{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:6px 14px;min-width:110px;animation:tpIn .6s ease both}
.stat b{display:block;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums}.stat span{font-size:11px;opacity:.85}.stat.g b{color:#7dffb5}.stat.a b{color:#ffd27a}.stat.v b{color:#d4b5ff}
.vtabs{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}.vt{border-radius:16px;padding:4px 14px}.vt.on{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 2px 8px rgba(43,92,138,.4)}
.gems{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-bottom:10px}
.gem{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 10px;cursor:pointer;transition:transform .15s,box-shadow .15s;animation:tpIn .45s ease both}.gem:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.15)}
.gem.forte{border-color:#7ed0a6;box-shadow:0 0 0 1px #b7e1c9,0 0 14px rgba(4,120,87,.18)}.gem.forte::after{content:"";position:absolute}.gem-h{display:flex;justify-content:space-between;gap:6px;align-items:center}
.gem.possibile{border-color:#f1d9a8}.gem{position:relative;overflow:hidden}.gem.forte::before{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);animation:tpShine 3.2s ease-in-out infinite}
.mnode{cursor:pointer}.mnode circle{transition:r .2s}.mnode:hover circle{stroke:#ffd27a;stroke-width:3}
.frow{display:grid;grid-template-columns:210px 1fr 60px;gap:8px;align-items:center;padding:3px 0;cursor:pointer;font-size:12px}.frow:hover{background:var(--sel)}
.ft{display:block;height:14px;background:var(--line);border-radius:7px;overflow:hidden}.ft i{display:block;height:100%;width:0;border-radius:7px;transition:width .8s cubic-bezier(.3,.9,.3,1)}.fv{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
.struct{text-align:center;margin-bottom:6px}.struct svg{max-width:100%;height:auto}
.words p{font-size:13px}.mine{height:46px;position:relative;text-align:center;margin-bottom:4px;overflow:hidden}.mine .pick{display:inline-block;font-size:34px;transform-origin:75% 85%;color:var(--accent)}.mine .rock{position:absolute;bottom:2px;opacity:0;font-size:12px;color:#d99a1d}
.mining .pick{animation:tpSwing .5s ease-in-out infinite alternate}.mining .rock{animation:tpRock .9s ease-out infinite}.mining .r2{animation-delay:.3s;left:55%}.mining .r1{left:42%}.mining .r3{animation-delay:.6s;left:62%}
.mining .bar i{background:linear-gradient(90deg,#2b5c8a,#7c3aed,#2b5c8a);background-size:200% 100%;animation:tpSlide 1s linear infinite}
.tp-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#17324d;color:#fff;padding:8px 18px;border-radius:20px;z-index:99;box-shadow:0 6px 20px rgba(0,0,0,.3);animation:tpIn .3s ease;transition:opacity .5s}.tp-toast.out{opacity:0}
@keyframes tpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes tpGlow{50%{filter:drop-shadow(0 0 16px #ffe7a8)}}
@keyframes tpShine{0%,60%{left:-60%}100%{left:130%}}@keyframes tpSwing{from{transform:rotate(-35deg)}to{transform:rotate(25deg)}}
@keyframes tpRock{0%{opacity:0;transform:translate(0,6px)}30%{opacity:1}100%{opacity:0;transform:translate(14px,-34px) rotate(180deg)}}@keyframes tpSlide{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.tp *,.hero,.gem{animation:none!important;transition:none!important}}`;

  // ---------------------------------------------------------------- worker and calls
  let worker = null, ready = null, seq = 0;
  const pending = new Map();
  let onProgress = () => {};
  function startWorker() {
    if (ready) return ready;
    ready = (async () => {
      const c = ctx(), base = c.base;
      const [qq, tpz] = [await fetch(base + "mzlab.zip").then(r => { if (!r.ok) throw new Error("il motore di calcolo nel browser non c'è (usa il sito, non il programma locale)"); return r.arrayBuffer(); }), c.pyZip];
      const url = URL.createObjectURL(new Blob([c.files["tpmine-worker.js"]], { type: "text/javascript" }));
      worker = new Worker(url, { type: "module" });
      worker.onmessage = ev => {
        const m = ev.data;
        if (m.type === "progress") return onProgress(m.text, m.frac);
        if (m.type === "step") return onProgress(m.text, null);
        if (m.type === "ready") { const p = pending.get("init"); pending.delete("init"); return p && p.res(); }
        const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        m.error ? p.rej(new Error(m.error)) : p.res(m.result);
      };
      await new Promise((res, rej) => {
        pending.set("init", { res, rej });
        worker.onerror = e => rej(new Error(e.message || "worker"));
        worker.postMessage({ type: "init", pyodideMjs: new URL("pyodide/pyodide.mjs", base).href, indexURL: new URL("pyodide/", base).href, qqqZip: qq, tpZip: tpz });
      });
      URL.revokeObjectURL(url);
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }
  const send = (msg, transfer) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); worker.postMessage({ ...msg, id }, transfer || []); });
  const call = async (fn, ...args) => { await startWorker(); return JSON.parse(await send({ type: "call", fn, args: args.map(a => typeof a === "string" ? a : JSON.stringify(a)) })); };
  const callRaw = async (fn, ...args) => { await startWorker(); return send({ type: "call", fn, args }); };
  window.TPMINE_MEM = async () => { await startWorker(); return send({ type: "mem" }); };      // size of the worker's WebAssembly memory (tests)

  // ---------------------------------------------------------------- page files (the browser's own storage of the main program)
  async function idbFiles() {
    try {
      // "qqq_lab" is the name of the browser database (kept from the old name: renaming it would lose the users' data)
      if (!indexedDB.databases || !(await indexedDB.databases()).some(d => d.name === "qqq_lab")) return [];
      return await new Promise(res => {
        const r = indexedDB.open("qqq_lab");
        r.onerror = () => res([]);
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains("files")) { db.close(); return res([]); }
          const tx = db.transaction("files", "readonly"), s = tx.objectStore("files"), ks = s.getAllKeys(), vs = s.getAll();
          tx.oncomplete = () => { db.close(); res(ks.result.map((k, i) => ({ name: String(k), buf: vs.result[i] })).filter(f => f.buf && /\.mzml$/i.test(f.name))); };
          tx.onerror = () => { db.close(); res([]); };
        };
      });
    } catch (_) { return []; }
  }

  // ---------------------------------------------------------------- charts (plain canvas)
  function hue(i, n) { return `hsl(${Math.round(220 - 220 * (n > 1 ? i / (n - 1) : 0))},70%,45%)`; }
  function chart(cv, series, o = {}) {
    const dpr = devicePixelRatio || 1, w = cv.clientWidth || 400, h = cv.clientHeight || 210;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    const M = { l: 52, r: 10, t: 10, b: 30 }, pw = w - M.l - M.r, ph = h - M.t - M.b;
    let x0 = Infinity, x1 = -Infinity, y1 = 0;
    for (const s of series) s.x.forEach((x, i) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, s.y[i]); });
    if (o.x0 != null) x0 = o.x0; if (o.x1 != null) x1 = o.x1; if (!(x1 > x0)) { x0 -= 1; x1 += 1; } if (!(y1 > 0)) y1 = 1;
    const X = x => M.l + (x - x0) / (x1 - x0) * pw, Y = y => M.t + ph - y / (y1 * 1.05) * ph;
    const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue("--muted") || "#666", line = css.getPropertyValue("--line") || "#ddd";
    g.font = "11px system-ui"; g.fillStyle = ink; g.strokeStyle = line; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const v = y1 * 1.05 * i / 4, y = Y(v); g.beginPath(); g.moveTo(M.l, y); g.lineTo(w - M.r, y); g.stroke(); g.textAlign = "right"; g.fillText(fmtA(v), M.l - 4, y + 3); }
    const step = niceStep((x1 - x0) / 6);
    for (let v = Math.ceil(x0 / step) * step; v <= x1 + 1e-9; v += step) { g.textAlign = "center"; g.fillText(+v.toFixed(2), X(v), h - M.b + 14); }
    g.textAlign = "center"; g.fillText(o.xlabel || "", M.l + pw / 2, h - 3);
    if (o.shade) { g.fillStyle = "rgba(43,92,138,.10)"; g.fillRect(X(o.shade[0]), M.t, X(o.shade[1]) - X(o.shade[0]), ph); }
    for (const s of series) {
      g.strokeStyle = s.color; g.lineWidth = s.w || 1.4; g.setLineDash(s.dash || []); g.beginPath();
      s.x.forEach((x, i) => i ? g.lineTo(X(x), Y(s.y[i])) : g.moveTo(X(x), Y(s.y[i]))); g.stroke(); g.setLineDash([]);
      if (s.dots) { g.fillStyle = s.color; s.x.forEach((x, i) => { g.beginPath(); g.arc(X(x), Y(s.y[i]), 3, 0, 7); g.fill(); }); }
    }
    g.strokeStyle = ink; g.strokeRect(M.l, M.t, pw, ph);
  }
  function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  const spark = k => {
    if (!k.length) return ""; const mx = Math.max(...k.map(p => p.area)) || 1, w = 70, h = 18;
    const pts = k.map((p, i) => `${(i / Math.max(1, k.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 2 - p.area / mx * (h - 4)).toFixed(1)}`).join(" ");
    return `<svg width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
  };

  // ---------------------------------------------------------------- the tab
  function open(sec) {
    if (!document.getElementById("tp-css")) { const st = document.createElement("style"); st.id = "tp-css"; st.textContent = CSS; document.head.appendChild(st); }
    sec.innerHTML = `<div class="tp">
<div id="tp-left">
 <div class="card"><h3>1 · File</h3>
  <div class="row"><button id="tp-page" title="Usa gli mzML già aperti nella scheda Dati (memoria del browser)">Usa i file di Dati</button><button id="tp-pick">Scegli mzML...</button><button id="tp-demo" title="Esperimento sintetico di bentazone: serve per provare il programma">Prova: bentazone</button></div>
  <input type="file" id="tp-in" accept=".mzML,.mzml" multiple hidden>
  <div id="tp-files" class="mut">Nessun file. Il tempo e il tipo si leggono dal nome (t15, blank, STD) e si possono correggere.</div></div>
 <div class="card"><h3>2 · Progenitore</h3><div id="tp-struct"></div>
  <div class="row"><input type="text" id="tp-name" placeholder="Nome (facoltativo)"></div>
  <div class="row"><input type="text" id="tp-mol" placeholder="Formula bruta neutra (C10H12N2O3S) oppure SMILES" spellcheck="false"></div>
  <div class="row"><label class="mut">Addotto</label><select id="tp-add"><option>[M+H]+</option><option>[M+Na]+</option><option>[M+NH4]+</option><option>[M-H]-</option></select><span class="mut" id="tp-prev"></span></div></div>
 <div class="card"><h3>3 · Impostazioni</h3>
  <div class="row"><label class="mut grow">Finestra XIC ±Da</label><input type="number" id="tp-tol" value="0.35" step="0.05" min="0.05" style="width:70px"></div>
  <div class="row"><label class="mut grow">Tolleranza RT ±min</label><input type="number" id="tp-rtt" value="0.25" step="0.05" min="0.05" style="width:70px"></div>
  <div class="row"><label class="mut grow">Trasformazioni combinate (passi)</label><input type="number" id="tp-steps" value="2" min="1" max="3" style="width:70px"></div>
  <div class="row"><label class="mut grow">Ignora RT prima di (min)</label><input type="number" id="tp-rtmin" value="0.5" step="0.1" min="0" style="width:70px"></div>
  <div class="row"><label><input type="checkbox" id="tp-disc" checked> Cerca anche ioni non previsti</label></div>
  <details><summary>Elenco delle trasformazioni (nome;variazione)</summary><textarea id="tp-tr" spellcheck="false"></textarea></details></div>
 <div class="card" id="tp-minecard"><div class="mine"><span class="pick">⛏</span><span class="rock r1">◆</span><span class="rock r2">◇</span><span class="rock r3">◆</span></div><button id="tp-go" class="imp" style="width:100%">⛏ Scava</button><div class="bar"><i id="tp-bar"></i></div><div class="mut" id="tp-msg" style="margin-top:4px"></div></div>
</div>
<div id="tp-right"><div class="card mut" id="tp-empty">Carica i file, scrivi il progenitore e premi <b>Scava</b>: mzFinder calibra l'm/z sul progenitore, genera i candidati, estrae gli XIC, cerca i picchi che crescono nel tempo e mancano nel bianco, controlla gli isotopi, confronta gli ioni prodotto con quelli del progenitore e assegna un livello di confidenza (Schymanski, per quanto permette la risoluzione unitaria).</div></div></div>`;
    const $ = s => sec.querySelector(s);
    const st = { files: [], summary: null, sel: null, view: "gems", took: 0, filter: { forte: true, possibile: true, unexp: true, debole: false } };
    const msg = (t, err) => { $("#tp-msg").textContent = t || ""; $("#tp-msg").className = "mut" + (err ? " err" : ""); };
    onProgress = (t, f) => { msg(t); if (f != null) $("#tp-bar").style.width = Math.round(f * 100) + "%"; };

    // ---- files
    const renderFiles = () => {
      if (!st.files.length) { $("#tp-files").innerHTML = "Nessun file. Il tempo e il tipo si leggono dal nome (t15, blank, STD) e si possono correggere."; return; }
      $("#tp-files").innerHTML = `<table><tr><th>File</th><th>Tipo di dato</th><th>Campione</th><th>t (min)</th></tr>` + st.files.map((f, i) => `<tr><td title="${esc(f.name)}">${esc(f.name.replace(/\.mzml$/i, ""))}</td><td>${KINDS[f.kind] || f.kind}${f.error ? ` <span class="err" title="${esc(f.error)}">!</span>` : ""}</td>
        <td>${f.kind === "full" || f.kind === "mrm" || f.kind === "hr" ? `<select data-i="${i}" data-k="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${f.type === k ? " selected" : ""}>${v}</option>`).join("")}</select>` : (f.kind === "ms2" ? "frammenti" : "-")}</td>
        <td>${f.kind === "full" || f.kind === "ms2" || f.kind === "mrm" || f.kind === "hr" ? `<input type="number" data-i="${i}" data-k="time" value="${f.time ?? ""}" style="width:60px" step="any">` : ""}</td></tr>`).join("") + "</table>";
      $("#tp-files").querySelectorAll("[data-k]").forEach(el => el.onchange = () => { const f = st.files[+el.dataset.i]; f[el.dataset.k] = el.dataset.k === "time" ? (el.value === "" ? null : +el.value) : el.value; });
    };
    const BIG = 50 << 20;                   // as in the main program: above this a file is mounted from its Blob, not copied (13 HR files = 1 GB)
    async function addFiles(list) {         // list: [{name, buf}] or [{name, file}] (File/Blob: read only if small)
      msg("Leggo i file...");
      try {
        await startWorker();
        for (const f of list) {
          if (f.file && f.file.size > BIG) await send({ type: "put", name: f.name, blob: f.file });
          else { const buf = f.file ? await f.file.arrayBuffer() : f.buf; await send({ type: "put", name: f.name, buf }, [buf]); }
        }
        const info = await call("classify", list.map(f => f.name));
        const hint = (() => { try { return Object.fromEntries((window.E && E.files || []).map(x => [String(x.file || x.name || "").split(/[\\/]/).pop(), x])); } catch (_) { return {}; } })();
        st.files = st.files.filter(f => !info.some(i => i.name === f.name));
        for (const i of info) { if (i.hr_kind === "hr" || i.hr_kind === "msn") i.kind = i.hr_kind; const h = hint[i.name]; if (h && h.time != null) i.time = h.time; if (h && ["sample", "blank", "standard", "control"].includes(h.type)) i.type = h.type; st.files.push(i); }
        st.files.sort((a, b) => (a.kind > b.kind ? 1 : a.kind < b.kind ? -1 : (a.time ?? -1) - (b.time ?? -1)));
        renderFiles(); msg("");
      } catch (e) { msg(String(e.message || e), true); }
    }
    $("#tp-page").onclick = async () => {
      msg("Cerco i file nella memoria del browser...");
      const f = await idbFiles();
      if (!f.length) return msg("Nessun mzML nella scheda Dati di questo browser: aprili lì oppure usa «Scegli mzML...».", true);
      await addFiles(f.map(x => x.buf instanceof Blob ? { name: x.name, file: x.buf } : { name: x.name, buf: x.buf.slice ? x.buf.slice(0) : x.buf }));
    };
    $("#tp-pick").onclick = () => $("#tp-in").click();
    $("#tp-in").onchange = async ev => { const fs = [...ev.target.files]; ev.target.value = ""; await addFiles(fs.map(f => ({ name: f.name, file: f }))); };
    $("#tp-demo").onclick = async () => {
      msg("Preparo l'esperimento sintetico di bentazone...");
      try {
        const d = await call("demo");
        st.files = []; const info = await call("classify", d.files.map(f => f.name));
        info.forEach((i, k) => { i.time = d.files[k].time; i.type = d.files[k].type; st.files.push(i); });
        $("#tp-name").value = d.parent.name; $("#tp-mol").value = d.parent.neutral; $("#tp-add").value = d.parent.adduct; preview(); renderFiles(); msg("Dati sintetici: nei laboratori non ci sono mzML di bentazone.");
      } catch (e) { msg(String(e.message || e), true); }
    };

    // ---- parent preview
    let pvT = 0;
    const preview = () => {
      clearTimeout(pvT);
      pvT = setTimeout(async () => {
        const t = $("#tp-mol").value.trim(); if (!t) { $("#tp-prev").textContent = ""; return; }
        structure(r_ => r_, t);
        try { const r = await call("formula_info", t, $("#tp-add").value); $("#tp-prev").innerHTML = r.ok ? `${esc(r.formula)} · M ${r.neutral} · ${esc($("#tp-add").value)} <i>m/z</i> ${r.mz}` : `<span class="err">${esc(r.error)}</span>`; }
        catch (e) { $("#tp-prev").textContent = ""; }
      }, 350);
    };
    let OCLp = null;
    async function structure(_, t) {          // parent structure drawn with OpenChemLib (already in the site for the Disegno tab)
      const el = $("#tp-struct"); if (!el) return;
      if (!/[a-z()=#\[\]@\/\\]/.test(t)) { el.innerHTML = ""; return; }
      try {
        OCLp = OCLp || import(new URL("vendor/openchemlib.js", ctx().base).href);
        const OCL = await OCLp, svg = OCL.Molecule.fromSmiles(t).toSVG(300, 170);
        el.innerHTML = `<div class="struct">${svg}</div>`;
      } catch (_) { el.innerHTML = ""; }
    }
    $("#tp-mol").oninput = preview; $("#tp-add").onchange = preview;
    startWorker().then(async () => { $("#tp-tr").value = await callRaw("default_transformations"); }).catch(e => msg(String(e.message || e), true));

    // ---- run
    $("#tp-go").onclick = async () => {
      const mol = $("#tp-mol").value.trim();
      const hrMode = st.files.some(f => f.kind === "hr");
      if (!hrMode && !st.files.some(f => f.kind === "full")) return msg("Servono file di full scan (MS1) del campione.", true);
      if (!mol) return msg("Scrivi la formula bruta neutra o lo SMILES del progenitore.", true);
      $("#tp-go").disabled = true; $("#tp-bar").style.width = "2%"; msg("Scavo..."); $("#tp-minecard").classList.add("mining"); const t0 = performance.now();
      try {
        const files = st.files.filter(f => f.kind !== "error" && f.kind !== "empty").map(f => ({ name: f.name, type: f.type, time: f.time, kind: f.kind }));
        const settings = { tol_da: +$("#tp-tol").value, rt_tol_min: +$("#tp-rtt").value, max_steps: +$("#tp-steps").value, rt_min: +$("#tp-rtmin").value, discover: $("#tp-disc").checked };
        const parent = { name: $("#tp-name").value.trim(), neutral: mol, adduct: $("#tp-add").value };
        if (hrMode) {          // high resolution: its own engine and view (21_tpmine_hr.js)
          if (parent.adduct !== "[M+H]+") throw new Error("L'alta risoluzione usa lo ione [M+H]+: scegli quell'addotto.");
          if (/^[A-Za-z0-9()]+$/.test(mol) === false) parent.smiles = mol;
          const hs = JSON.parse(await callRaw("run", JSON.stringify(files), JSON.stringify(parent), "{}", ""));
          st.took = performance.now() - t0; st.summary = null; st.det = {};
          window.TPHR.render($("#tp-right"), hs, { esc, fmtA, chart, hue, call, callRaw, toast, dl });
          $("#tp-bar").style.width = "100%"; msg("Fatto."); $("#tp-right").scrollIntoView({ behavior: "smooth", block: "start" });
          $("#tp-go").disabled = false; $("#tp-minecard").classList.remove("mining"); return;
        }
        st.summary = JSON.parse(await callRaw("run", JSON.stringify(files), JSON.stringify(parent), JSON.stringify(settings), $("#tp-tr").value));
        st.took = performance.now() - t0; st.sel = null; st.det = {}; render(); $("#tp-bar").style.width = "100%"; msg("Fatto."); $("#tp-right").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) { msg(String(e.message || e), true); $("#tp-bar").style.width = "0"; }
      $("#tp-go").disabled = false; $("#tp-minecard").classList.remove("mining");
    };

    // ---- results
    const VIEWS = [["tab", "Tabella"], ["gems", "💎 Gemme"], ["map", "🕸 Mappa di reazione"], ["kin", "📈 Cinetiche"], ["film", "🎬 Film"]];
    function countUp(el) {
      const to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(), D = 900;
      const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    function confetti() {
      const cv = document.createElement("canvas"); cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:95"; document.body.appendChild(cv);
      cv.width = innerWidth; cv.height = innerHeight; const g = cv.getContext("2d"), cols = ["#2b5c8a", "#047857", "#d99a1d", "#b42318", "#7c3aed", "#0ea5e9"];
      const P = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 300, y: innerHeight * 0.35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 3, r: 3 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
      const t0 = performance.now();
      const f = t => { const k = (t - t0) / 1800; g.clearRect(0, 0, cv.width, cv.height); for (const p of P) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.rot += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); } k < 1 ? requestAnimationFrame(f) : cv.remove(); };
      requestAnimationFrame(f);
    }
    const toast = t => { const d = document.createElement("div"); d.className = "tp-toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.classList.add("out"), 2200); setTimeout(() => d.remove(), 2800); };
    const good = r => r.label === "forte" || r.label === "possibile";
    const dispName = r => r.kind === "unexpected" ? r.name : r.name;
    const shortN = (t, n = 26) => t.length > n ? t.slice(0, n - 1) + "…" : t;
    const col = r => r.label === "progenitore" ? "#2b5c8a" : r.kind === "unexpected" ? "#7c3aed" : r.label === "forte" ? "#047857" : "#d99a1d";

    function render() {
      const s = st.summary, R = $("#tp-right");
      const par = s.rows.find(r => r.label === "progenitore");
      const cnt = k => s.rows.filter(r => (k === "unexp" ? r.kind === "unexpected" && good(r) : r.kind === "candidate" && r.label === k)).length;
      const nF = cnt("forte"), nP = cnt("possibile"), nU = cnt("unexp");
      R.innerHTML = `<div class="hero"><div class="hero-t"><span class="hero-i">${(typeof QICON !== "undefined" && QICON.mine) ? QICON.get("mine", 44) : "⛏"}</span>
        <div><h2>${nF ? "Filone trovato!" : nP ? "Qualche pepita..." : "Filone povero"}</h2><div class="hero-s">${esc(s.parent.formula || "progenitore")} · ${esc(s.parent.adduct)} <i>m/z</i> ${s.parent.mz}${par && par.ref_rt ? ` · RT ${par.ref_rt} min` : ""} · scavato in ${(st.took / 1000).toFixed(1)} s</div></div></div>
        <div class="stats"><div class="stat g"><b data-count="${nF}">0</b><span>TP forti 💎</span></div><div class="stat a"><b data-count="${nP}">0</b><span>TP possibili</span></div>
        <div class="stat v"><b data-count="${nU}">0</b><span>ioni non previsti</span></div>
        <div class="stat"><b data-count="${s.decay && s.decay.half_life_min != null ? s.decay.half_life_min : 0}" data-dec="1">0</b><span>t½ progenitore (min)</span></div>
        <div class="stat"><b data-count="${s.offset ? Math.abs(s.offset.offset) : 0}" data-dec="2">0</b><span>offset <i>m/z</i> corretto (Da)</span></div>
        <div class="stat"><b data-count="${s.rows.length}">0</b><span>ioni analizzati</span></div></div>
        <div class="row" style="margin-top:10px"><button id="tp-x-xlsx">Excel (.xlsx)</button><button id="tp-x-csv">CSV</button><button id="tp-x-json">JSON</button><button id="tp-x-txt" title="Copia un riassunto in italiano da incollare nella relazione">📋 Copia il riassunto</button></div></div>
        <div class="vtabs">${VIEWS.map(([k, n]) => `<button class="vt${st.view === k ? " on" : ""}" data-v="${k}">${n}</button>`).join("")}</div>
        <div id="tp-view"></div>${mrmCard(s.mrm)}<div id="tp-det"></div>`;
      R.querySelectorAll(".stat b").forEach(countUp);
      R.querySelectorAll(".vt").forEach(b => b.onclick = () => { st.view = b.dataset.v; R.querySelectorAll(".vt").forEach(x => x.classList.toggle("on", x === b)); view(); });
      $("#tp-x-xlsx").onclick = () => exportAll("xlsx"); $("#tp-x-csv").onclick = () => exportAll("csv"); $("#tp-x-json").onclick = () => exportAll("json");
      $("#tp-x-txt").onclick = async () => { try { await navigator.clipboard.writeText(summaryText()); toast("Riassunto copiato negli appunti"); } catch (_) { dl("riassunto_TPMine.txt", summaryText(), "text/plain"); } };
      view();
      const cc = $("#tp-c-cal");
      if (cc) { const c = JSON.parse(cc.dataset.cal); chart(cc, [{ x: [0, c.hi], y: [c.intercept, c.slope * c.hi + c.intercept], color: "#2b5c8a" }, { x: c.points.map(p => p.conc), y: c.points.map(p => p.area), color: "#b42318", dots: true, w: 0 }], { xlabel: "concentrazione (mg/L)", x0: 0 }); }
      if (nF) confetti();
    }

    function view() {
      const V = $("#tp-view"), s = st.summary; stopFilm();
      const list = s.rows.filter(r => r.label !== "progenitore" && good(r));
      if (st.view === "tab") {
        const f = st.filter;
        V.innerHTML = `<div class="card"><div class="row"><label><input type="checkbox" data-f="forte" ${f.forte ? "checked" : ""}> forti</label><label><input type="checkbox" data-f="possibile" ${f.possibile ? "checked" : ""}> possibili</label><label><input type="checkbox" data-f="unexp" ${f.unexp ? "checked" : ""}> non previsti</label><label><input type="checkbox" data-f="debole" ${f.debole ? "checked" : ""}> deboli</label><span class="mut">↑ ↓ per scorrere</span></div><div class="tbl"><table id="tp-t"></table></div></div>`;
        V.querySelectorAll("[data-f]").forEach(el => el.onchange = () => { f[el.dataset.f] = el.checked; rows(); });
        rows();
      } else if (st.view === "gems") {
        V.innerHTML = list.length ? `<div class="gems">${list.map((r, i) => gem(r, i)).join("")}</div>` : `<div class="card mut">Nessuna gemma: nessun candidato supera i criteri.</div>`;
        V.querySelectorAll(".gem").forEach(g => g.onclick = () => show(+g.dataset.id));
      } else if (st.view === "map") {
        V.innerHTML = `<div class="card"><div class="mut">Ogni nodo è un ione che supera i criteri: il raggio segue l'area massima, il colore la fiducia (verde forte, ambra possibile, viola non previsto). Le linee mostrano la trasformazione (Δ formula). Clic su un nodo per il dettaglio.</div><div id="tp-map"></div></div>`;
        mapView($("#tp-map"));
      } else if (st.view === "kin") {
        V.innerHTML = `<div class="card"><h3>Tutte le cinetiche, ciascuna al proprio massimo (100 %)</h3><canvas id="tp-c-all" style="height:320px"></canvas><div class="row" id="tp-leg-all"></div></div>`;
        const top = list.filter(r => r.kind === "candidate").slice(0, 8), par = s.rows.find(r => r.label === "progenitore");
        const ser = [par, ...top].map((r, i) => { const k = r.kinetics, mx = Math.max(...k.map(p => p.area)) || 1; return { x: k.map(p => p.time), y: k.map(p => 100 * p.area / mx), color: i ? hue(i - 1, top.length) : "#555", dash: i ? [] : [6, 4], w: i ? 2 : 2.4, label: r.name, dots: !!i }; });
        chart($("#tp-c-all"), ser, { xlabel: "tempo (min)" });
        $("#tp-leg-all").innerHTML = ser.map(t => `<span class="mut"><span style="display:inline-block;width:14px;border-top:2px ${t.dash.length ? "dashed" : "solid"} ${t.color};vertical-align:middle"></span> ${esc(shortN(t.label, 34))}</span>`).join("");
      } else if (st.view === "film") {
        filmView(V);
      }
    }

    function gem(r, i) {
      const k = r.kinetics, mx = Math.max(...k.map(p => p.area)) || 1, w = 220, h = 54;
      const pts = k.map((p, j) => [(j / Math.max(1, k.length - 1) * (w - 6) + 3), (h - 4 - p.area / mx * (h - 10))]);
      const line = pts.map(p => p.join(",")).join(" "), area = `3,${h - 3} ${line} ${w - 3},${h - 3}`;
      return `<div class="gem ${r.label}" data-id="${r.id}" style="animation-delay:${Math.min(i, 12) * 60}ms"><div class="gem-h"><b>${esc(shortN(r.name, 34))}</b>${r.level ? `<span class="lv lv${r.level}">${r.level}</span>` : ""}</div>
        <div class="mut">${esc(r.formula || "")} · <i>m/z</i> ${r.mz.toFixed(1)} · RT ${r.ref_rt ?? "?"}${r.insource ? " · frammento in sorgente" + (r.isf ? " (P " + Math.round(100 * r.isf.probs.isf) + "%" + (r.isf.doubtful ? ", dubbio" : "") + ")" : "?") : (r.isf && r.isf.doubtful ? " · origine dubbia (P ISF " + Math.round(100 * r.isf.probs.isf) + "%)" : "")}</div>
        <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"><polygon points="${area}" fill="${col(r)}" opacity=".15"/><polyline points="${line}" fill="none" stroke="${col(r)}" stroke-width="2"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.3" fill="${col(r)}"/>`).join("")}</svg>
        <div class="mut">max a ${r.tmax ?? "?"} min · area ${fmtA(r.max_area)}${r.kind === "candidate" ? ` · ${esc(r.delta)}` : ` · Δ<i>m/z</i> ${r.delta_mz >= 0 ? "+" : ""}${r.delta_mz}`}</div></div>`;
    }

    function mapView(host) {
      const s = st.summary, par = s.rows.find(r => r.label === "progenitore");
      const cand = s.rows.filter(r => r.kind === "candidate" && r.label !== "progenitore" && good(r));
      const unx = s.rows.filter(r => r.kind === "unexpected" && good(r) && !(r.insource && !(r.isf && r.isf.doubtful))).slice(0, 10);
      const cols = [[par], cand.filter(r => r.steps === 1), cand.filter(r => r.steps === 2), [...cand.filter(r => r.steps >= 3), ...unx]];
      const W = 1000, colX = [90, 330, 590, 850], rowsN = Math.max(...cols.map(c => c.length)), H = Math.max(300, rowsN * 56 + 50);
      const maxA = Math.max(...s.rows.map(r => r.max_area)) || 1, pos = {};
      cols.forEach((c, ci) => c.forEach((r, i) => { pos[r.id] = [colX[ci], 30 + (i + 0.5) * (H - 40) / c.length]; }));
      const node = r => pos[r.id];
      const byName = Object.fromEntries(cand.filter(r => r.steps === 1).map(r => [r.name, r]));
      let edges = "";
      for (const r of [...cand, ...unx]) {
        const src = r.kind === "unexpected" ? [par] : r.steps === 1 ? [par] : (() => { const parts = r.name.split(" + ").map(n => byName[n]).filter(Boolean); return parts.length ? parts : [par]; })();
        for (const a of src) {
          const [x1, y1] = node(a), [x2, y2] = node(r), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, lab = r.kind === "unexpected" ? `Δ${r.delta_mz >= 0 ? "+" : ""}${r.delta_mz}` : (r.steps === 1 ? r.delta : "");
          edges += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${col(r)}" stroke-opacity=".45" stroke-width="1.6"${r.kind === "unexpected" || src[0] === par && r.steps > 1 ? ' stroke-dasharray="5 4"' : ""}/>${lab ? `<text x="${mx}" y="${(y1 + y2) / 2 - 4}" font-size="10" fill="#687080" text-anchor="middle">${esc(lab)}</text>` : ""}`;
        }
      }
      const nodes = [par, ...cand, ...unx].map(r => { const [x, y] = node(r), rad = 9 + 15 * Math.log10(1 + r.max_area) / Math.log10(1 + maxA);
        return `<g class="mnode" data-id="${r.id}" transform="translate(${x},${y})"><circle r="${rad.toFixed(1)}" fill="${col(r)}" fill-opacity=".85" stroke="#fff" stroke-width="2"><title>${esc(r.name)}</title></circle>${r.level ? `<text y="4" font-size="11" fill="#fff" font-weight="700" text-anchor="middle">${r.level}</text>` : ""}<text y="${(rad + 13).toFixed(0)}" font-size="11" text-anchor="middle" fill="currentColor">${esc(shortN(r.name, 24))}</text><text y="${(rad + 25).toFixed(0)}" font-size="10" text-anchor="middle" fill="#687080">${r.mz.toFixed(1)}</text></g>`; }).join("");
      host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H}px">${[["progenitore", 0], ["1 passo", 1], ["2 passi", 2], ["3 passi / non previsti", 3]].map(([t, i]) => `<text x="${colX[i]}" y="14" font-size="11" fill="#687080" text-anchor="middle" font-weight="700">${t}</text>`).join("")}${edges}${nodes}</svg>`;
      host.querySelectorAll(".mnode").forEach(g => g.onclick = () => show(+g.dataset.id));
    }

    let filmT = null;
    const stopFilm = () => { if (filmT) { clearInterval(filmT); filmT = null; } };
    function filmView(V) {
      const s = st.summary, par = s.rows.find(r => r.label === "progenitore"), items = [par, ...s.rows.filter(r => r.kind === "candidate" && good(r)).slice(0, 12)], times = s.times;
      V.innerHTML = `<div class="card"><div class="row"><button id="tp-play">▶ Avvia il film</button><input type="range" id="tp-sl" min="0" max="${times.length - 1}" value="0" class="grow"><b id="tp-tl">t = ${times[0]} min</b></div>
        <div class="mut">Ogni barra è l'area del picco, in % del suo massimo: il progenitore cala, i prodotti di trasformazione salgono (e poi, a volte, scendono).</div>
        <div id="tp-film">${items.map(r => `<div class="frow" data-id="${r.id}"><span class="fl" title="${esc(r.name)}">${esc(shortN(r.name, 30))}</span><span class="ft"><i style="background:${col(r)}"></i></span><span class="fv"></span></div>`).join("")}</div></div>`;
      const set = i => {
        $("#tp-sl").value = i; $("#tp-tl").textContent = `t = ${times[i]} min`;
        V.querySelectorAll(".frow").forEach(row => { const r = items.find(x => x.id === +row.dataset.id), mx = Math.max(...r.kinetics.map(p => p.area)) || 1, k = r.kinetics.find(p => p.time === times[i]), v = k ? 100 * k.area / mx : 0;
          row.querySelector("i").style.width = v.toFixed(1) + "%"; row.querySelector(".fv").textContent = k && k.area ? fmtA(k.area) : "-"; });
      };
      $("#tp-sl").oninput = e => { stopFilm(); $("#tp-play").textContent = "▶ Avvia il film"; set(+e.target.value); };
      $("#tp-play").onclick = () => {
        if (filmT) { stopFilm(); $("#tp-play").textContent = "▶ Avvia il film"; return; }
        let i = 0; $("#tp-play").textContent = "⏸ Pausa"; set(0);
        filmT = setInterval(() => { i++; if (i >= times.length) { stopFilm(); $("#tp-play").textContent = "↺ Rivedi"; return; } set(i); }, 900);
      };
      V.querySelectorAll(".frow").forEach(r => r.onclick = () => show(+r.dataset.id));
      set(0);
    }

    function summaryText() {
      const s = st.summary, par = s.rows.find(r => r.label === "progenitore"), L = [];
      L.push(`Ricerca dei prodotti di trasformazione di ${s.parent.formula || "progenitore"} (${s.parent.adduct}, m/z ${s.parent.mz}${par && par.ref_rt ? `, RT ${par.ref_rt} min` : ""}).`);
      if (s.decay) L.push(`Il progenitore decade con cinetica del primo ordine: k = ${s.decay.k_per_min} min^-1, t1/2 = ${s.decay.half_life_min} min (R2 = ${s.decay.r2}).`);
      if (s.offset) L.push(`Offset di m/z misurato sul progenitore: ${s.offset.offset >= 0 ? "+" : ""}${s.offset.offset} Da${s.offset.applied ? " (corretto)" : ""}.`);
      const top = s.rows.filter(r => r.label !== "progenitore" && good(r) && !(r.insource && !(r.isf && r.isf.doubtful)));
      L.push(`Candidati che crescono nel tempo e mancano nel bianco: ${top.filter(r => r.kind === "candidate").length}; ioni non previsti: ${top.filter(r => r.kind === "unexpected").length}.`);
      for (const r of top.slice(0, 15)) L.push(`- ${r.name}${r.formula ? ` (${r.formula}${r.delta ? ", " + r.delta : ""})` : ""}: m/z ${r.mz.toFixed(1)}, RT ${r.ref_rt} min, massimo a ${r.tmax} min, area ${fmtA(r.max_area)}, giudizio ${r.label}${r.level ? `, livello di confidenza ${r.level}` : ""}.`);
      L.push("Risoluzione unitaria: ogni riga è un candidato, non un'identificazione; i livelli 2 e 1 richiedono spettro di libreria o standard.");
      return L.join("\n");
    }

    function mrmCard(m) {
      if (!m) return "";
      const q = m.quantifier, qual = m.transitions.slice(1).map(t => t.name), c = m.calibration;
      const body = m.rows.map(r => { const i = r.ion[q]; return `<tr><td>${esc(r.label)}</td><td>${TYPES[r.type] || r.type}</td><td class="n">${r.time ?? ""}</td><td class="n">${r.conc ?? ""}</td><td class="n">${i.detected ? fmtA(i.area) : "-"}</td><td class="n">${i.rt != null ? i.rt.toFixed(2) : ""}</td><td class="n">${i.snr ? i.snr.toFixed(0) : ""}</td>${qual.map(n => `<td class="n">${r.ion[n].detected ? fmtA(r.ion[n].area) : "-"}</td><td class="n">${r.ratios[n] != null ? r.ratios[n].toFixed(2) : ""}</td>`).join("")}<td>${r.ratio_ok == null ? "" : r.ratio_ok ? "✓" : "<span class='err'>fuori</span>"}</td><td class="n">${r.quant != null ? (+r.quant.toPrecision(3)) : ""}</td><td>${r.in_range == null ? "" : r.in_range ? "" : "<span class='err' title='fuori dall&apos;intervallo dei punti di taratura'>fuori retta</span>"}</td></tr>`; }).join("");
      return `<div class="card"><h3>MRM: integrazione automatica</h3><div class="cols"><div><div class="mut">Quantificatore ${esc(q)}${qual.length ? ` · qualificatore ${qual.map(esc).join(", ")}` : ""} · RT di riferimento ${m.ref_rt ? m.ref_rt.toFixed(2) : "?"} min · rapporto ionico degli standard ${Object.values(m.ratio_ref).map(v => v == null ? "-" : v.toFixed(2)).join(", ")} (±${Math.round(m.ratio_tol * 100)} %)</div>
        <div class="tbl" style="max-height:300px"><table><tr><th>File</th><th>Tipo</th><th>t</th><th>conc. (mg/L)</th><th>Area quant.</th><th>RT</th><th>S/N</th>${qual.map(n => `<th>Area qual.</th><th>Qual/Quant</th>`).join("")}<th>Rapporto</th><th>Calcolata (mg/L)</th><th></th></tr>${body}</table></div></div>
        <div>${c ? `<div class="mut">Retta: area = ${c.slope.toPrecision(4)} · conc ${c.intercept >= 0 ? "+" : "−"} ${Math.abs(c.intercept).toPrecision(3)} · pesi ${c.weighting} · R² (non pesato) ${c.r2.toFixed(4)} · ${c.points.length} punti, ${c.lo}–${c.hi} mg/L</div><canvas id="tp-c-cal" data-cal='${esc(JSON.stringify(c))}'></canvas>` : `<div class="mut">Servono almeno tre standard con la concentrazione nel nome (per es. STD_0_6ppm) per la retta di taratura.</div>`}</div></div></div>`;
    }
    function rows() {
      if (!$("#tp-t")) return;
      const s = st.summary, f = st.filter;
      const keep = s.rows.filter(r => r.label === "progenitore" || (r.kind === "unexpected" ? f.unexp && (r.label === "forte" || r.label === "possibile") : f[r.label]));
      $("#tp-t").innerHTML = `<tr><th>#</th><th>Liv.</th><th>Punti</th><th>Candidato</th><th>Formula</th><th><i>m/z</i></th><th>RT</th><th>t max</th><th>Area max</th><th>Cinetica</th></tr>` + keep.map(r => `<tr class="clk${r.id === st.sel ? " sel" : ""}" data-id="${r.id}">
        <td>${r.id >= 100000 ? "n" + (r.id - 100000) : r.id}</td><td>${r.level ? `<span class="lv lv${r.level}" title="${esc(r.level_text)}">${r.level}</span>` : ""}</td>
        <td>${r.score == null ? "" : `<span class="badge b-${r.label}">${r.score} ${LAB[r.label]}</span>`}</td><td>${esc(r.name)}${r.alternatives.length ? ` <span class="mut" title="${esc(r.alternatives.join("\n"))}">+${r.alternatives.length}</span>` : ""}</td>
        <td>${esc(r.formula)}</td><td class="n">${r.mz.toFixed(2)}</td><td class="n">${r.ref_rt ?? ""}</td><td class="n">${r.tmax ?? ""}</td><td class="n">${fmtA(r.max_area)}</td><td>${spark(r.kinetics)}</td></tr>`).join("");
      $("#tp-t").querySelectorAll("tr.clk").forEach(tr => tr.onclick = () => show(+tr.dataset.id));
    }
    function words(d, par) {
      const kin = d.rows.filter(r => r.type === "sample" && r.time != null).sort((a, b) => a.time - b.time), first = kin.find(r => r.detected && r.area > 0), mx = kin.reduce((m, r) => r.detected && r.area > (m ? m.area : 0) ? r : m, null);
      const bl = d.rows.filter(r => r.type === "blank" || r.type === "control"), drt = par && par.ref_rt && d.ref_rt ? d.ref_rt - par.ref_rt : null;
      const P = [];
      const row = st.summary.rows.find(r => r.id === d.id);
      P.push(`<b>${esc(d.name)}</b> ${d.delta ? `(${esc(d.delta)}) ` : ""}ha <i>m/z</i> ${d.mz}${row && row.delta_mz != null ? `, cioè ${row.delta_mz >= 0 ? "+" : ""}${row.delta_mz} rispetto al progenitore` : ""}.`);
      if (first && mx) P.push(`Compare a ${first.time} min e raggiunge il massimo a ${mx.time} min${mx.time === first.time ? "" : ""}; ${bl.length ? (bl.every(b => !b.detected) ? "nel bianco non c'è." : "nel bianco si vede qualcosa: attenzione.") : "non c'è un bianco per escludere un contaminante."}`);
      if (drt != null) P.push(`Esce ${Math.abs(drt).toFixed(2)} min ${drt < 0 ? "prima" : "dopo"} del progenitore${drt < -0.3 ? ": più polare, come ci si aspetta da un'ossidazione" : drt > 0.3 ? ": meno polare del progenitore, è insolito per un'ossidazione" : ", quasi insieme"}.`);
      if (d.ms2 && d.ms2.scans) { const sh = d.ms2.fragments.filter(f => f.note); P.push(`Ho ${d.ms2.scans} scansioni MS2 (precursore ${d.ms2.precursor}): ${d.ms2.fragments.slice(0, 3).map(f => f.mz).join(", ")}${sh.length ? `; ${sh.length} frammenti si spiegano col progenitore (${sh.map(f => f.note.startsWith("condiviso") ? "condiviso" : "spostato di Δ").join(", ")})` : "; nessun frammento coincide con quelli del progenitore"}.`); }
      else P.push("Nessun MS2 con questo precursore: per salire di livello serve un Product Ion Scan sul picco.");
      P.push(d.level_text ? esc(d.level_text) : "");
      return P.filter(Boolean).map(p => `<p style="margin:4px 0">${p}</p>`).join("");
    }
    async function getDetail(id) { return st.det[id] || (st.det[id] = await call("detail", id)); }
    async function show(id) {
      st.sel = id; rows();
      const D = $("#tp-det"); D.innerHTML = `<div class="card mut">Calcolo...</div>`;
      let d; try { d = await getDetail(id); } catch (e) { D.innerHTML = `<div class="card err">${esc(e.message || e)}</div>`; return; }
      const par = st.summary.rows.find(r => r.label === "progenitore"), drt = par && par.ref_rt && d.ref_rt ? (d.ref_rt - par.ref_rt) : null;
      const kin = d.rows.filter(r => r.type === "sample" && r.time != null).sort((a, b) => a.time - b.time);
      D.innerHTML = `<div class="card words"><h3>In parole</h3>${words(d, par)}</div><div class="card"><h3>${esc(d.name)} ${d.level ? `<span class="lv lv${d.level}">${d.level}</span>` : ""}</h3>
        <div class="kv"><b>Formula</b><span>${esc(d.formula || "-")} ${d.delta ? `<span class="mut">(${esc(d.delta)})</span>` : ""}</span>
        <b><i>m/z</i></b><span>${d.mz} calcolato · ${d.mz_extracted} estratto${d.mz_observed ? ` · ${d.mz_observed.toFixed(2)} osservato` : ""}</span>
        <b>RT</b><span>${d.ref_rt ? d.ref_rt.toFixed(2) + " min" : "-"}${drt != null ? ` (${drt >= 0 ? "+" : ""}${drt.toFixed(2)} rispetto al progenitore; i TP più polari escono prima)` : ""}</span>
        ${d.level_text ? `<b>Confidenza</b><span>${esc(d.level_text)}</span>` : ""}${d.alternatives.length ? `<b>Stessa massa</b><span>${d.alternatives.map(esc).join("; ")}</span>` : ""}</div></div>
        <div class="cols"><div class="card"><h3>Criteri</h3><ul class="crit" style="margin:0;padding-left:18px">${d.criteria.map(c => `<li class="${c.status}"><b>${c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–"} ${esc(c.name)}</b> <span class="mut">${esc(c.text)}</span></li>`).join("") || "<li class='mut'>progenitore</li>"}</ul></div>
        <div class="card"><h3>Cinetica (area del picco)</h3><canvas id="tp-c-kin"></canvas></div></div>
        <div class="card"><h3>XIC di tutti i campioni <span class="mut">(finestra ±${st.summary.settings.tol_da} Da attorno a ${d.mz_extracted})</span></h3><canvas id="tp-c-xic" style="height:260px"></canvas><div class="row" id="tp-leg"></div></div>
        <div class="cols"><div class="card"><h3>Aree</h3><table><tr><th>Campione</th><th>t</th><th>Area</th><th>Altezza</th><th>S/N</th><th>RT</th></tr>${d.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="n">${r.time ?? ""}</td><td class="n">${r.detected ? fmtA(r.area) : "<span class='mut'>-</span>"}</td><td class="n">${r.detected ? fmtA(r.height) : ""}</td><td class="n">${r.snr ? r.snr.toFixed(1) : ""}</td><td class="n">${r.apex_rt != null && r.detected ? r.apex_rt.toFixed(2) : ""}</td></tr>`).join("")}</table></div>
        <div class="card"><h3>Ioni prodotto (MS2)</h3>${d.ms2.scans ? `<div class="mut">${d.ms2.scans} scansioni, precursore ${d.ms2.precursor}, CE ${d.ms2.collision_energy ?? "?"}</div><table><tr><th><i>m/z</i></th><th>%</th><th>perdita</th><th>nota</th></tr>${d.ms2.fragments.map(f => `<tr><td class="n">${f.mz}</td><td class="n">${f.rel}</td><td class="n">${f.loss ?? ""}</td><td>${esc(f.note || "")}</td></tr>`).join("")}</table>` : `<div class="mut">Nessuna scansione MS2 con questo precursore dentro il picco.</div>`}
        ${d.transitions.length ? `<h3 style="margin-top:8px">Transizioni MRM suggerite</h3><table><tr><th>Q1</th><th>Q3</th><th>CE</th><th>RT</th></tr>${d.transitions.map(t => `<tr><td class="n">${t.Q1}</td><td class="n">${t.Q3_consigliato}</td><td class="n">${t.CE}</td><td class="n">${t.RT_attesa_min}</td></tr>`).join("")}</table>` : ""}</div></div>`;
      D.scrollIntoView({ behavior: "smooth", block: "nearest" });
      chart($("#tp-c-kin"), [{ x: kin.map(r => r.time), y: kin.map(r => r.detected ? r.area : 0), color: "#2b5c8a", dots: true }], { xlabel: "tempo (min)" });
      const n = d.traces.length;
      const tr = d.traces.map((t, i) => ({ x: t.rt, y: t.y, color: t.type === "blank" ? "#888" : hue(i, n), dash: t.type === "blank" ? [4, 3] : [], w: 1.3, label: t.label }));
      const pk = d.traces.map(t => t.peak).filter(Boolean), c = d.ref_rt || 0;
      chart($("#tp-c-xic"), tr, { xlabel: "RT (min)", x0: Math.max(0.5, c - 2.5), x1: c + 2.5, shade: pk.length ? [Math.min(...pk.map(p => p.left)), Math.max(...pk.map(p => p.right))] : null });
      $("#tp-leg").innerHTML = tr.map(t => `<span class="mut"><span style="display:inline-block;width:14px;border-top:2px ${t.dash.length ? "dashed" : "solid"} ${t.color};vertical-align:middle"></span> ${esc(t.label)}</span>`).join("");
    }

    document.addEventListener("keydown", ev => {
      if (sec.hidden || !st.summary || st.view !== "tab" || !["ArrowDown", "ArrowUp"].includes(ev.key) || /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
      const ids = [...sec.querySelectorAll("#tp-t tr.clk")].map(t => +t.dataset.id); if (!ids.length) return;
      const i = ids.indexOf(st.sel), n = ev.key === "ArrowDown" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1); ev.preventDefault(); show(ids[n < 0 ? 0 : n]);
    });

    // ---- export
    async function exportAll(kind) {
      const s = st.summary; msg("Preparo l'esportazione...");
      try {
        const top = s.rows.filter(r => r.label === "forte" || r.label === "possibile");
        const det = []; for (const r of top) det.push(await getDetail(r.id));
        const times = s.times, name = (st.summary.parent.formula || "progenitore") + "_TPMine";
        const head = ["#", "Candidato", "Formula", "Variazione", "m/z", "RT (min)", "Livello", "Punteggio", "Giudizio", "t max (min)", "Area max", ...times.map(t => "Area t" + t)];
        const line = r => [r.id, r.name, r.formula, r.delta, r.mz, r.ref_rt, r.level ?? "", r.score ?? "", r.label, r.tmax ?? "", Math.round(r.max_area), ...times.map(t => { const k = r.kinetics.find(p => p.time === t); return k ? Math.round(k.area) : ""; })];
        const trans = det.flatMap(d => d.transitions);
        if (kind === "json") return dl(name + ".json", JSON.stringify({ riepilogo: s, dettagli: det }, null, 1), "application/json");
        if (kind === "csv") return dl(name + ".csv", "sep=;\n" + [head, ...s.rows.map(line)].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
        const sheets = [{ name: "Classifica", head, rows: s.rows.map(line), widths: [6, 38, 16, 14, 10, 9, 8, 9, 11, 10, 12, ...times.map(() => 11)] },
          { name: "Criteri", head: ["#", "Candidato", "Criterio", "Esito", "Dettaglio"], rows: det.flatMap(d => d.criteria.map(c => [d.id, d.name, c.name, c.status, c.text])), widths: [6, 38, 28, 8, 70] },
          { name: "MS2", head: ["#", "Candidato", "m/z prodotto", "% rel.", "Perdita", "Nota"], rows: det.flatMap(d => d.ms2.fragments.map(f => [d.id, d.name, f.mz, f.rel, f.loss ?? "", f.note || ""])), widths: [6, 38, 12, 9, 9, 50] },
          { name: "Transizioni MRM", head: ["Candidato", "Formula", "Q1", "Q3 osservato", "Q3 consigliato", "CE", "RT attesa", "Finestra RT", "% rel.", "Scansioni MS2", "Nota"], rows: trans.map(t => [t.compound, t.formula, t.Q1, t.Q3_osservato, t.Q3_consigliato, t.CE, t.RT_attesa_min, t.finestra_RT_min, t["intensita_rel_%"], t.scansioni_ms2, t.nota]), widths: [34, 16, 8, 12, 14, 7, 10, 11, 8, 12, 40] },
          ...(s.mrm ? [mrmSheet(s.mrm)] : []),
          { name: "Informazioni", head: ["Voce", "Valore"], rows: [["Progenitore", s.parent.formula], ["Massa neutra", s.parent.neutral], ["Addotto", s.parent.adduct], ["m/z progenitore", s.parent.mz], ["Offset m/z (Da)", s.offset ? s.offset.offset : ""], ["k (1/min)", s.decay ? s.decay.k_per_min : ""], ["t1/2 (min)", s.decay ? s.decay.half_life_min : ""], ...Object.entries(s.settings).map(([k, v]) => [k, String(v)]), ...s.files.map(f => ["File", `${f.name} (${f.kind}, ${f.type}, t=${f.time ?? ""})`]), ["Nota", "Risoluzione unitaria: ogni riga è un candidato, non un'identificazione. I livelli 2 e 1 richiedono spettro di libreria o standard."]], widths: [22, 90] }];
        dlx(name + ".xlsx", sheets);
      } catch (e) { msg(String(e.message || e), true); return; }
      msg("");
    }
    function mrmSheet(m) {
      const q = m.quantifier, qual = m.transitions.slice(1).map(t => t.name);
      return { name: "MRM", head: ["File", "Tipo", "t (min)", "Conc. nominale (mg/L)", "Area " + q, "RT", "S/N", ...qual.flatMap(n => ["Area " + n, "Qual/Quant " + n]), "Rapporto ionico", "Conc. calcolata (mg/L)", "Nota"],
        rows: m.rows.map(r => [r.file, r.type, r.time ?? "", r.conc ?? "", Math.round(r.ion[q].area), r.ion[q].rt ?? "", Math.round(r.ion[q].snr), ...qual.flatMap(n => [Math.round(r.ion[n].area), r.ratios[n] ?? ""]), r.ratio_ok == null ? "" : r.ratio_ok ? "ok" : "fuori", r.quant ?? "", r.in_range === false ? "fuori dall'intervallo di taratura" : ""]),
        widths: [34, 10, 8, 14, 12, 8, 8, ...qual.flatMap(() => [12, 12]), 12, 16, 34] };
    }
    const dl = (n, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  }

  QTOOLS.register({ id: "tpmine", nav: true, name: "mzFinder", desc: "Ricerca automatica dei prodotti di trasformazione (solo per il docente)", open,
    icon: (typeof QICON !== "undefined" && QICON.mine) ? QICON.get("mine", 16) : "⛏" });
})();
