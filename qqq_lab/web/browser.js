// Browser version of QqQ lab (GitHub Pages): there is no server. The calls the page makes to api/... are answered by a
// Web Worker that runs the same Python code inside Pyodide. The student's files stay in the memory of this page (and in
// the browser's own storage, to resume after a reload): nothing is uploaded anywhere.
// This script is added to index.html only by tools/build_site.py; the local program does not load it.
(() => {
  window.QQQ_BROWSER = true;
  const SRC = document.currentScript.src;
  // an old browser cannot run the engine: say it clearly instead of staying blank
  const modern = !!(window.Worker && window.WebAssembly && window.indexedDB && window.Promise && window.Response);
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) { /* optional: keeps the files from being evicted */ }
  try { if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("../sw.js", SRC)).catch(() => {}); } catch (_) { /* offline copy is optional */ }
  let worker;
  try { if (modern) worker = new Worker(new URL("browser-worker.js", SRC), { type: "module" }); } catch (_) { worker = null; }
  const pending = new Map();
  let seq = 0, isReady = false, failed = null;

  // while the engine loads the page shows the same loading screen as everywhere else (#loading, funny phrases);
  // the step text goes under the phrase (#ldsub). window.qqStep is also read by loading() in explore.js.
  window.qqStep = "Preparo il motore di calcolo...";
  // technical steps go to the console only (the screen shows just the funny phrases); an ERROR replaces the phrase, clearly, in Italian
  const step = t => { window.qqStep = t; console.debug("[QqQ lab]", t); };
  const fail = t => { window.qqFailed = t; const show = () => { const m = document.getElementById("ldmsg"), s = document.getElementById("ldsub"); if (m) m.textContent = t; if (s) s.textContent = ""; }; show(); document.addEventListener("DOMContentLoaded", show); };
  document.addEventListener("DOMContentLoaded", () => step(window.qqStep));

  const ready = new Promise((res, rej) => {
    if (!worker) { const t = "questo browser è troppo vecchio: usa una versione recente di Chrome, Edge, Firefox o Safari."; failed = t; fail(t); return rej(new Error(t)); }
    worker.onmessage = ev => {
      const m = ev.data;
      if (m.type === "step") return step(m.text);
      if (m.type === "ready") { isReady = true; window.qqStep = ""; return res(); }
      if (m.type === "fatal") { failed = m.text; fail("Non riesco ad avviare il motore di calcolo: " + m.text); return rej(new Error(m.text)); }
      const p = pending.get(m.id); if (!p) return; pending.delete(m.id); p(m);
    };
    worker.onerror = e => { failed = e.message || "errore del worker"; fail("Errore: " + failed); rej(new Error(failed)); };
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
