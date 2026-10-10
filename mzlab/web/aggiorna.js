"use strict";
// Desktop app only (window.MZLAB_DESKTOP, set by desktop-shim.js): update of the web part. The Rust side does all the network work (it talks
// to the published site only) and the checks (SHA-256, atomic swap at the next start); this file is the button in the settings popup, the
// progress and a quiet notice (a dot on the gear) after a silent check at most once a day. In a normal browser it does nothing.
window.UPD = (() => {
  const T = window.__TAURI__;
  const on = !!(window.MZLAB_DESKTOP && T && T.core);
  const KEY = "qqq.updchk";
  let last = null;                                             // last answer of the Rust side: {state, ...}
  const mb = n => (n / 1e6).toFixed(n < 1e7 ? 1 : 0);
  const call = cmd => T.core.invoke(cmd);

  function dot() {
    const g = document.getElementById("np-set");
    if (!g) return;
    let d = g.querySelector(".upd-dot");
    const show = !!last && (last.state === "available" || last.state === "ready");
    if (!show) { if (d) d.remove(); return; }
    if (!d) {
      d = document.createElement("span"); d.className = "upd-dot";
      d.style.cssText = "position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:var(--accent)";
      g.style.position = "relative"; g.appendChild(d);
    }
    d.title = I18N.t("upd.notice");
  }

  // the quiet check: at most once a day, no message if there is nothing new or no internet
  async function silent() {
    if (!on) return;
    let t = 0; try { t = +localStorage.getItem(KEY) || 0; } catch (_) { /* optional */ }
    if (Date.now() - t < 864e5) return;
    try { localStorage.setItem(KEY, String(Date.now())); } catch (_) { /* optional */ }
    try { last = await call("update_check"); dot(); } catch (_) { /* silent */ }
  }

  function text(r) {
    switch (r.state) {
      case "current": return I18N.t("upd.current");
      case "available": return I18N.t("upd.available", { files: r.files, mb: mb(r.bytes) });
      case "ready": return I18N.t("upd.ready");
      case "needs_app": return I18N.t("upd.needsApp", { min: r.min, url: r.url });
      case "offline": return I18N.t("upd.offline");
      default: return "";
    }
  }

  // a row inside the settings popup: [label] [button] and a line that tells what is happening (read aloud by screen readers)
  function mount(el) {
    if (!on || !el) return;
    el.innerHTML = `<span>${I18N.t("upd.label")}</span> <button type="button" id="upd-go"></button>
      <div class="sm" id="upd-msg" role="status" aria-live="polite" style="flex-basis:100%"></div>`;
    const go = el.querySelector("#upd-go"), msg = el.querySelector("#upd-msg");
    el.style.flexWrap = "wrap";
    const paint = () => {
      const st = last ? last.state : "";
      go.disabled = false;
      go.textContent = I18N.t(st === "available" ? "upd.download" : st === "ready" ? "upd.restart" : "upd.check");
      go.dataset.act = st === "available" ? "download" : st === "ready" ? "restart" : "check";
      msg.textContent = last ? text(last) : "";
      dot();
    };
    go.onclick = async () => {
      const act = go.dataset.act;
      go.disabled = true;
      try {
        if (act === "restart") { await call("update_restart"); return; }
        if (act === "download") {
          msg.textContent = I18N.t("upd.starting");
          const un = T.event && T.event.listen ? await T.event.listen("mzlab-update-progress", e => {
            const p = e.payload || {};
            msg.textContent = I18N.t("upd.progress", { file: p.file, files: p.files, mb: mb(p.bytes), total: mb(p.total) });
          }) : null;
          try { last = await call("update_download"); } finally { if (typeof un === "function") un(); }
        } else {
          msg.textContent = I18N.t("upd.checking");
          last = await call("update_check");
        }
        try { localStorage.setItem(KEY, String(Date.now())); } catch (_) { /* optional */ }
      } catch (e) {
        last = null;
        msg.textContent = I18N.t("upd.error", { code: String(e) });
        go.disabled = false; go.textContent = I18N.t("upd.check"); go.dataset.act = "check";
        return;
      }
      paint();
    };
    paint();
  }

  if (on) setTimeout(silent, 5000);
  return { mount, silent, on };
})();
