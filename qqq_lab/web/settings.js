"use strict";
// Settings gear: ONLY three controls (text size, theme, chart colours). Classic script, loaded after explore.js/tabs.js
// (uses UIP, PALS, setPal, paintFiles, Q, redrawAll from there). Everything is stored in localStorage inside try/catch: it may be blocked
// (private window, strict settings) and the page must work without it.
const UIP_KEY = "qqq.prefs";
const uipRead = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const uipWrite = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage not available: the setting lasts until the page is closed */ } };
function uipLoad() {
  try { const o = JSON.parse(uipRead(UIP_KEY) || "{}"); if ([90, 100, 115, 130].includes(o.font)) UIP.font = o.font; if (["auto", "light", "dark"].includes(o.theme)) UIP.theme = o.theme; if (PALS[o.pal]) UIP.pal = o.pal; } catch (e) { /* corrupt value: defaults */ }
  setPal(UIP.pal);
}
function uipSave() { uipWrite(UIP_KEY, JSON.stringify({ font: UIP.font, theme: UIP.theme, pal: UIP.pal })); }
function uipApply() {
  const r = document.documentElement;
  r.style.setProperty("--z", UIP.font / 100);
  if (UIP.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", UIP.theme);
  if (typeof fitTools === "function") requestAnimationFrame(fitTools);
  if (typeof redrawAll === "function") redrawAll();           // canvases read the colours from the CSS variables
}

// --- popup of the gear
function uipOpen(btn) {
  const old = Q("#uipset"); if (old) { old.remove(); return; }
  const d = document.createElement("div"); d.id = "uipset";
  d.innerHTML = `<div class="sm" style="font-weight:600;margin-bottom:6px">Impostazioni</div>
    <div class="row">Dimensione testo <span class="fz"><button data-f="-1" title="Più piccolo">A&minus;</button><b>${UIP.font}%</b><button data-f="1" title="Più grande">A+</button></span></div>
    <div class="row">Tema <select id="uip-th"><option value="auto">Come il sistema</option><option value="light">Chiaro</option><option value="dark">Scuro</option></select></div>
    <div class="row">Colori dei grafici <select id="uip-pal" title="Per tempo: i file Full Scan con un tempo vanno dal viola scuro al verde in ordine di tempo. Accessibili: colori distinguibili anche con le forme comuni di daltonismo, più linee tratteggiate. Alto contrasto aggiunge anche lo stile della linea. Arcobaleno: tinte ben separate.">${Object.entries(PALS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}</select></div>`;
  document.body.appendChild(d);
  d.querySelector("#uip-th").value = UIP.theme; d.querySelector("#uip-pal").value = UIP.pal;
  const r = btn.getBoundingClientRect(); d.style.top = r.bottom + 6 + "px"; d.style.left = Math.max(8, Math.min(r.left, innerWidth - d.offsetWidth - 8)) + "px";
  const steps = [90, 100, 115, 130];
  d.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const i = Math.max(0, Math.min(steps.length - 1, steps.indexOf(UIP.font) + +b.dataset.f)); UIP.font = steps[i]; d.querySelector("b").textContent = UIP.font + "%"; uipSave(); uipApply(); });
  d.querySelector("#uip-th").onchange = e => { UIP.theme = e.target.value; uipSave(); uipApply(); };
  d.querySelector("#uip-pal").onchange = e => {              // applied at once: file colours, lists, legends, every graph
    setPal(e.target.value); uipSave();
    if (typeof paintFiles === "function" && typeof E !== "undefined") { paintFiles(); if (E.files.length) { renderFileList(); } }
    uipApply();
  };
  setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener("mousedown", h); } }), 0);
}

uipLoad();
(() => {
  const nav = Q("#nav"), b = document.createElement("button"); b.id = "np-set"; b.className = "ib gear"; b.title = "Impostazioni: testo, tema, colori dei grafici"; b.setAttribute("aria-label", "Impostazioni");
  b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  nav.insertAdjacentElement("afterend", b); b.onclick = e => { e.stopPropagation(); uipOpen(b); };
  uipApply();
})();
