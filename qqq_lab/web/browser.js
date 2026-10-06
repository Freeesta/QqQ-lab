// Browser version of QqQ lab (GitHub Pages): there is no server. The calls the page makes to api/... are answered by a
// Web Worker that runs the same Python code inside Pyodide. The student's files stay in the memory of this page (and in
// the browser's own storage, to resume after a reload): nothing is uploaded anywhere.
// This script is added to index.html only by tools/build_site.py; the local program does not load it.
(() => {
  window.QQQ_BROWSER = true;
  const worker = new Worker(new URL("browser-worker.js", document.currentScript.src), { type: "module" });
  const pending = new Map();
  let seq = 0, isReady = false, failed = null;

  // full-page message while the calculation engine loads (about 15 MB the first time, then it comes from the cache)
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;z-index:100000;background:var(--bg,#f7f8fa);display:flex;align-items:center;justify-content:center;font:15px system-ui;color:var(--ink,#25282c);text-align:center;padding:24px";
  const msg = document.createElement("div");
  msg.innerHTML = "<b>QqQ lab</b><br><span id=\"qq-load\">Preparo il motore di calcolo...</span><br><small style=\"color:#687080\">La prima volta serve circa mezzo minuto (15 MB); le volte dopo è immediato. I tuoi file non lasciano il tuo computer.</small>";
  box.appendChild(msg);
  const attach = () => document.body && !box.isConnected && document.body.appendChild(box);
  document.addEventListener("DOMContentLoaded", () => { if (!isReady) attach(); });
  const step = t => { const e = document.getElementById("qq-load"); if (e) e.textContent = t; };

  const ready = new Promise((res, rej) => {
    worker.onmessage = ev => {
      const m = ev.data;
      if (m.type === "step") return step(m.text);
      if (m.type === "ready") { isReady = true; box.remove(); return res(); }
      if (m.type === "fatal") { failed = m.text; step("Non riesco ad avviare il motore di calcolo: " + m.text); return rej(new Error(m.text)); }
      const p = pending.get(m.id); if (!p) return; pending.delete(m.id); p(m);
    };
    worker.onerror = e => { failed = e.message || "errore del worker"; step("Errore: " + failed); rej(new Error(failed)); };
  });
  ready.catch(() => {});

  const realFetch = window.fetch.bind(window);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (typeof url !== "string" || !/^(\.\/)?api\//.test(url)) return realFetch(input, init);
    if (/^(\.\/)?api\/(ping|bye)/.test(url)) return json({ ok: true });      // presence: not needed without a server
    await ready;
    const method = (init.method || "GET").toUpperCase();
    let body = null;
    if (init.body != null) body = typeof init.body === "string" ? new TextEncoder().encode(init.body) : new Uint8Array(await new Response(init.body).arrayBuffer());
    const id = ++seq;
    const r = await new Promise(res => { pending.set(id, res); worker.postMessage({ id, method, url, body }, body ? [body.buffer] : []); });
    return new Response(r.text, { status: r.status, headers: { "Content-Type": "application/json" } });
  };
  window.EventSource = class { constructor() {} close() {} };                  // "the tab is open" signal: only for the local program
  navigator.sendBeacon = () => true;
})();
