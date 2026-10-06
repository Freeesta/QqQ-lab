// Loader of the hidden, password-protected module ("TP Mine" and any future tool). Only for the course owner.
// This file is public and contains NO tool code: the tools live encrypted in tpmine.enc (built by tools/build_tpmine.py)
// and exist in memory only after the right password is typed. The password is never stored: not here, not in the browser.
//
// Unlock: click the "?" of the page header 5 times in a row (within 3 s) -> password box -> decrypt (PBKDF2-SHA256 -> AES-GCM-256)
//   -> the decrypted scripts run from Blob URLs and register their tools with window.QTOOLS.register(...) -> launcher bar.
// Nothing decrypted is written to the Cache API, IndexedDB, localStorage or the service worker cache.
// File format of tpmine.enc: "TPMN" | version (1 byte) | PBKDF2 iterations (uint32 BE) | salt (16) | iv (12) | AES-GCM ciphertext
// (the 37-byte header is the GCM additional data). The plaintext is a zlib-compressed JSON {v, js:[{name,code}], py_zip_b64}.
(() => {
  "use strict";
  const ENC_URL = new URL("tpmine.enc", document.currentScript ? document.currentScript.src : location.href).href;
  const HEAD = 37, MAGIC = [0x54, 0x50, 0x4d, 0x4e];     // "TPMN"
  const CLICKS = 5, WINDOW_MS = 3000;

  // ---- registry: tools register themselves after the unlock. {id, name, icon (svg string), desc, open(body, ctx)}
  const tools = [];
  const reg = window.QTOOLS = {
    ctx: null,                                     // set after the unlock: {pyZip: Uint8Array, base: URL of the site static folder}
    list: () => tools.slice(),
    register(t) { if (!t || !t.id || typeof t.open !== "function") throw new Error("QTOOLS.register: id and open() are required"); const i = tools.findIndex(x => x.id === t.id); if (i >= 0) tools[i] = t; else tools.push(t); render(); },
  };

  // ---- crypto
  async function decrypt(buf, password) {
    const u = new Uint8Array(buf);
    if (u.length < HEAD + 17 || MAGIC.some((b, i) => u[i] !== b) || u[4] !== 1) throw new Error("formato");
    const iter = new DataView(u.buffer, u.byteOffset).getUint32(5), salt = u.slice(9, 25), iv = u.slice(25, 37);
    if (iter < 100000 || iter > 5000000) throw new Error("formato");
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: u.slice(0, HEAD) }, key, u.slice(HEAD));
    const ds = new Blob([plain]).stream().pipeThrough(new DecompressionStream("deflate"));
    return JSON.parse(await new Response(ds).text());
  }
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  function runScript(name, code) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([code + `\n//# sourceURL=tpmine/${name}`], { type: "text/javascript" }));
      const s = document.createElement("script");
      s.onload = () => { URL.revokeObjectURL(url); s.remove(); res(); };
      s.onerror = () => { URL.revokeObjectURL(url); s.remove(); rej(new Error("script " + name)); };
      s.src = url; document.head.appendChild(s);
    });
  }

  // ---- launcher bar and tool host
  let bar = null, host = null, unlocked = false;
  const css = `#qt-bar{position:fixed;left:12px;bottom:12px;z-index:80;display:flex;gap:6px;align-items:center;background:var(--panel,#fff);border:1px solid var(--accent,#7a5c1e);border-radius:20px;padding:4px 10px;box-shadow:0 2px 10px rgba(0,0,0,.2);font:13px system-ui,sans-serif}
#qt-bar button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--accent,#7a5c1e);cursor:pointer;font:inherit;font-weight:600;padding:2px 4px}
#qt-bar button:hover{text-decoration:underline}
#qt-host{position:fixed;inset:0;z-index:90;background:var(--bg,#fff);display:none;flex-direction:column}
#qt-host.on{display:flex}
#qt-host .qt-hd{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--line,#ccc)}
#qt-host .qt-hd b{font-size:15px}#qt-host .qt-hd .qt-x{margin-left:auto}
#qt-host .qt-bd{flex:1;overflow:auto;padding:14px}
#qt-dlg{border:1px solid var(--accent,#7a5c1e);border-radius:10px;padding:16px 18px;max-width:360px}
#qt-dlg h3{margin:0 0 8px;font-size:15px}#qt-dlg input{width:100%;box-sizing:border-box;margin:6px 0}#qt-dlg .qt-msg{min-height:1.3em;font-size:12px;color:var(--muted,#666)}
#qt-dlg .qt-row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}`;
  function ensureUi() {
    if (bar) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    bar = document.createElement("div"); bar.id = "qt-bar"; bar.hidden = true; document.body.appendChild(bar);
    host = document.createElement("div"); host.id = "qt-host"; document.body.appendChild(host);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function render() {
    if (!bar) return;
    bar.hidden = !unlocked || !tools.length;
    bar.innerHTML = tools.map(t => `<button data-t="${esc(t.id)}" title="${esc(t.desc || t.name)}">${t.icon || ""}${esc(t.name)}</button>`).join("");
    bar.querySelectorAll("button").forEach(b => b.onclick = () => openTool(tools.find(t => t.id === b.dataset.t)));
  }
  function openTool(t) {
    host.innerHTML = `<div class="qt-hd">${t.icon || ""}<b>${esc(t.name)}</b><span class="muted sm">${esc(t.desc || "")}</span><button class="qt-x" title="Chiudi">Chiudi</button></div><div class="qt-bd"></div>`;
    host.querySelector(".qt-x").onclick = () => { host.classList.remove("on"); if (t.close) try { t.close(); } catch (_) { /* ignore */ } host.innerHTML = ""; };
    host.classList.add("on");
    try { t.open(host.querySelector(".qt-bd"), reg.ctx); } catch (e) { host.querySelector(".qt-bd").textContent = "Il filone ha ceduto: " + (e && e.message || e); }
  }

  // ---- password box
  let busy = false;
  function askPassword() {
    if (unlocked) { if (bar) bar.hidden = false; return; }
    ensureUi();
    let dlg = document.getElementById("qt-dlg");
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "qt-dlg";
      dlg.innerHTML = `<form method="dialog" autocomplete="off"><h3>Parola d'ordine del minatore</h3><input type="password" id="qt-pw" autocomplete="off" spellcheck="false" placeholder="Parola d'ordine"><div class="qt-msg" id="qt-msg"></div><div class="qt-row"><button type="button" id="qt-no">Annulla</button><button type="submit" id="qt-go" class="imp">Scava</button></div></form>`;
      document.body.appendChild(dlg);
      dlg.querySelector("#qt-no").onclick = () => dlg.close();
      dlg.querySelector("form").onsubmit = async ev => {
        ev.preventDefault();
        if (busy) return; busy = true;
        const pw = dlg.querySelector("#qt-pw"), msg = dlg.querySelector("#qt-msg");
        msg.textContent = "Scavo...";
        try { await unlock(pw.value); pw.value = ""; dlg.close(); }
        catch (_) { msg.textContent = "Questo filone è vuoto. Riprova, minatore."; pw.select(); }
        busy = false;
      };
    }
    dlg.querySelector("#qt-msg").textContent = ""; dlg.querySelector("#qt-pw").value = "";
    dlg.showModal(); dlg.querySelector("#qt-pw").focus();
  }
  async function unlock(password) {
    const r = await fetch(ENC_URL);                            // no-store would defeat offline use; the file is encrypted anyway
    if (!r.ok) throw new Error("assente");
    const pkg = await decrypt(await r.arrayBuffer(), password);
    reg.ctx = { pyZip: pkg.py_zip_b64 ? b64(pkg.py_zip_b64) : null, base: new URL(".", ENC_URL).href, meta: pkg.meta || {} };
    unlocked = true;
    for (const f of pkg.js || []) await runScript(f.name, f.code);
    render();
  }

  // ---- hidden trigger: 5 quick clicks on the "?" of the header (the button keeps working as it is; the extra clicks are just not shown to the help)
  let n = 0, t0 = 0;
  document.addEventListener("click", ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('button.hq[data-help="header"]');
    if (!b) return;
    const now = Date.now();
    n = now - t0 > WINDOW_MS ? 1 : n + 1; t0 = now;
    if (n >= CLICKS) { n = 0; ev.stopPropagation(); ev.preventDefault(); askPassword(); }
  }, true);
  // for the tests and for a future menu entry
  reg.unlockDialog = askPassword;
})();
