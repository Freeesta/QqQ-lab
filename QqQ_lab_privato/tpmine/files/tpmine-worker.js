// TPMINE-PRIVATE  Web Worker of TP Mine: its own Pyodide (Python + numpy) running the private engine on the mzML bytes sent by the page.
let py = null, api = null;
const say = text => postMessage({ type: "step", text });
onmessage = async ev => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      say("Carico Python...");
      const { loadPyodide } = await import(m.pyodideMjs);
      py = await loadPyodide({ indexURL: m.indexURL });
      say("Carico numpy...");
      await py.loadPackage("numpy");
      say("Preparo il motore...");
      py.FS.mkdirTree("/qqq"); py.unpackArchive(m.qqqZip, "zip", { extractDir: "/qqq" });
      py.FS.mkdirTree("/tpm"); py.unpackArchive(m.tpZip, "zip", { extractDir: "/tpm" });
      py.FS.mkdirTree("/tp_data");
      py.runPython("import sys\nsys.path[:0] = ['/qqq', '/tpm']\nimport tpmine.api");
      api = py.pyimport("tpmine.api");
      api._progress = (text, frac) => postMessage({ type: "progress", text, frac });
      postMessage({ type: "ready" });
    } else if (m.type === "put") {
      py.FS.writeFile("/tp_data/" + m.name, new Uint8Array(m.buf));
      postMessage({ id: m.id, result: true });
    } else if (m.type === "call") {
      const r = api[m.fn](...(m.args || []));
      postMessage({ id: m.id, result: typeof r === "string" ? r : String(r) });
    }
  } catch (e) {
    postMessage({ id: m.id, error: String(e && e.message || e).split("\n").filter(Boolean).slice(-3).join(" | "), fatal: m.type === "init" });
  }
};
