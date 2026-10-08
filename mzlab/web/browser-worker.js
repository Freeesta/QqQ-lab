// Web Worker of the browser version: Pyodide (Python + numpy in WebAssembly) running the same mzlab package as the local program.
import { loadPyodide } from "./pyodide/pyodide.mjs";

const say = text => postMessage({ type: "step", text });
const WORK = "/work/sessione";

// ---- the browser's own storage (IndexedDB): files and notebook survive a reload, like the work folder of the local program
const DB = "qqq_lab"; // kept from the old name: renaming it would lose the users' data
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore("files"); r.result.createObjectStore("kv"); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (store, mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = () => rej(t.error); });
};
const safe = async f => { try { return await f(); } catch (_) { return undefined; } };   // private windows may refuse storage: the program still works, it just does not resume

// Big files are not copied into the memory of the engine: the Blob is mounted read-only with WORKERFS (/big/N/data) and linked into the work folder.
// Above KEEP the file is not saved in IndexedDB either (it has to be opened again after a reload).
const BIG = 50 << 20, KEEP = 300 << 20, MAX = 4 * 1024 * 1024 * 1024;
const RECIPE = 'msconvert file.raw --mzML --zlib --filter "peakPicking vendor msLevel=1-"  (per alleggerire: --filter "scanTime [600,1500]" in secondi, --filter "threshold count 300 most-intense")';
let bigN = 0;
const baseName = n => String(n || "").split(/[\\/]/).pop();
function mountBig(blob) {
  const dir = `/big/${++bigN}`;
  py.FS.mkdirTree(dir);
  py.FS.mount(py.FS.filesystems.WORKERFS, { blobs: [{ name: "data", data: blob }] }, dir);
  return `${dir}/data`;
}

let py = null, handle = null, linkBig = null;
// Everything the engine needs is requested at once, in parallel: before, numpy waited for Python to be compiled and the program
// waited for numpy (about 3 s lost on a 20 Mbit/s line). The numpy wheel is only fetched here to warm the HTTP cache (and the
// service worker): loadPackage then finds it there instead of starting the download late.
const IDX = new URL("./pyodide/", import.meta.url).href;
const zipP = fetch(new URL("./mzlab.zip", import.meta.url)).then(r => r.arrayBuffer());
zipP.catch(() => {});
fetch(IDX + "pyodide-lock.json").then(r => r.json()).then(l => fetch(IDX + l.packages.numpy.file_name)).then(r => r.arrayBuffer()).catch(() => {});
async function start() {
  try {
    say("Carico Python...");
    py = await loadPyodide({ indexURL: IDX });
    say("Carico numpy...");
    await py.loadPackage("numpy");
    say("Carico il programma...");
    const zip = await zipP;
    py.FS.mkdirTree("/qqq");
    py.unpackArchive(zip, "zip", { extractDir: "/qqq" });
    py.FS.mkdirTree(WORK);
    say("Riapro i file della volta scorsa...");
    const names = await safe(() => tx("files", "readonly", s => s.getAllKeys()));
    const bigs = [];
    for (const n of names || []) {
      const buf = await safe(() => tx("files", "readonly", s => s.get(n)));
      if (!buf) continue;
      if (typeof Blob !== "undefined" && buf instanceof Blob) bigs.push([n, buf]);        // a big file: mounted below, once Python is up
      else py.FS.writeFile(`${WORK}/${n}`, new Uint8Array(buf));
    }
    const nb = await safe(() => tx("kv", "readonly", s => s.get("notebook")));
    if (nb) py.FS.writeFile(`${WORK}/taccuino.json`, nb);
    for (const [n, blob] of bigs) { try { py.FS.symlink(mountBig(blob), `${WORK}/${n}`); } catch (e) { console.debug("[mzLab] file grande non riaperto", n, e); } }
    py.runPython("import sys; sys.path.insert(0, '/qqq')\nfrom mzlab import browser\nbrowser.start()");
    handle = py.runPython("browser.handle");
    linkBig = py.runPython("browser.link_big");
    postMessage({ type: "ready" });
  } catch (e) { postMessage({ type: "fatal", text: String(e && e.message || e) }); }
}
const started = start();

onmessage = async ev => {
  const { id, method, url, body, blob } = ev.data;
  await started;
  if (!handle) return postMessage({ id, status: 500, text: JSON.stringify({ error: "motore di calcolo non avviato" }) });
  let status, text;
  const t0 = performance.now();
  try {
    if (blob) {                                                                       // a big upload: mount the Blob, do not copy it
      const name = new URL(url, "http://x/").searchParams.get("name");
      if (blob.size > MAX) throw new Error("file oltre 4 GB: troppo grande. Riducilo con MSConvert: " + RECIPE);
      const r = linkBig(name, mountBig(blob));
      [status, text] = r.toJs(); r.destroy();
      if (status === 200 && blob.size <= KEEP) await safe(() => tx("files", "readwrite", s => s.put(blob, baseName(name))));
    } else {
      const r = handle(method, url, body);
      [status, text] = r.toJs(); r.destroy();
    }
  } catch (e) {
    const m = String(e && e.message || e);
    status = 500; text = JSON.stringify({ error: /memory|alloc|RangeError/i.test(m) ? "Questo file è troppo grande per la memoria del browser. Riducilo con MSConvert: " + RECIPE : m });
  }
  postMessage({ id, status, text, ms: performance.now() - t0 });
  if (method !== "POST" || status !== 200) return;
  // keep the browser's storage in step with the program
  const u = new URL(url, "http://x/");
  if (u.pathname === "/api/upload") { const n = u.searchParams.get("name"); const base = n && baseName(n); if (base && body) await safe(() => tx("files", "readwrite", s => s.put(body.buffer.byteLength ? body.buffer : new ArrayBuffer(0), base))); }
  else if (u.pathname === "/api/remove") { try { const n = JSON.parse(new TextDecoder().decode(body)).name; if (n) await safe(() => tx("files", "readwrite", s => s.delete(n.split(/[\\/]/).pop()))); } catch (_) { /* ignore */ } }
  else if (u.pathname === "/api/notebook") await safe(() => tx("kv", "readwrite", s => s.put(new TextDecoder().decode(body), "notebook")));
  else if (u.pathname === "/api/new") { try { if (JSON.parse(new TextDecoder().decode(body)).fresh) { await safe(() => tx("files", "readwrite", s => s.clear())); await safe(() => tx("kv", "readwrite", s => s.clear())); } } catch (_) { /* ignore */ } }
};
