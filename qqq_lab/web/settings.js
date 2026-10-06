"use strict";
// Settings gear (font size of the interface, theme, tooltips, panel numbers) and the first-use tutorial. Classic script, loaded after explore.js/tabs.js
// (uses UIP, Q, EH, numberPanels, redrawAll, setTab from there). Everything is stored in localStorage inside try/catch: it may be blocked
// (private window, strict settings) and the page must work without it.
const UIP_KEY = "qqq.prefs", TUT_KEY = "qqq.tutorial";
const uipRead = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const uipWrite = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage not available: the setting lasts until the page is closed */ } };
function uipLoad() {
  try { const o = JSON.parse(uipRead(UIP_KEY) || "{}"); ["tips", "num"].forEach(k => { if (typeof o[k] === "boolean") UIP[k] = o[k]; }); if ([90, 100, 115, 130].includes(o.font)) UIP.font = o.font; if (["auto", "light", "dark"].includes(o.theme)) UIP.theme = o.theme; } catch (e) { /* corrupt value: defaults */ }
}
function uipSave() { uipWrite(UIP_KEY, JSON.stringify({ tips: UIP.tips, num: UIP.num, font: UIP.font, theme: UIP.theme })); }

// --- tooltips: when off, every title attribute is parked in data-tt (the "?" help buttons keep theirs) and restored when on again
let uipObs = null;
function uipStrip(root) {
  (root.matches && root.matches("[title]") ? [root] : []).concat([...root.querySelectorAll("[title]")]).forEach(e => { if (e.classList.contains("hq") || e.closest("#uipset,#tut")) return; e.dataset.tt = e.getAttribute("title"); e.removeAttribute("title"); });
}
function uipApplyTips() {
  if (!UIP.tips) {
    uipStrip(document.body);
    if (!uipObs) { uipObs = new MutationObserver(ms => { ms.forEach(m => { if (m.type === "attributes") uipStrip(m.target); else m.addedNodes.forEach(n => n.nodeType === 1 && uipStrip(n)); }); }); uipObs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] }); }
  } else {
    if (uipObs) { uipObs.disconnect(); uipObs = null; }
    document.querySelectorAll("[data-tt]").forEach(e => { e.setAttribute("title", e.dataset.tt); delete e.dataset.tt; });
  }
}
function uipApply() {
  const r = document.documentElement;
  r.style.setProperty("--z", UIP.font / 100);
  if (UIP.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", UIP.theme);
  uipApplyTips();
  if (typeof numberPanels === "function") numberPanels();
  if (typeof fitTools === "function") requestAnimationFrame(fitTools);
  if (typeof redrawAll === "function") redrawAll();           // canvases read the colours from the CSS variables
}

// --- popup of the gear
function uipOpen(btn) {
  const old = Q("#uipset"); if (old) { old.remove(); return; }
  const d = document.createElement("div"); d.id = "uipset";
  d.innerHTML = `<div class="sm" style="font-weight:600;margin-bottom:6px">Impostazioni</div>
    <div class="row">Dimensione del testo dell'interfaccia <span class="fz"><button data-f="-1" title="Più piccolo">A&minus;</button><b>${UIP.font}%</b><button data-f="1" title="Più grande">A+</button></span></div>
    <div class="sm muted" style="margin:-2px 0 6px">Vale per menu, elenco file e barre; il testo dentro i grafici si ingrandisce con lo zoom del browser (Ctrl o Cmd e +).</div>
    <div class="row">Tema <select id="uip-th"><option value="auto">Come il sistema</option><option value="light">Chiaro</option><option value="dark">Scuro</option></select></div>
    <label class="row"><input type="checkbox" id="uip-tips" ${UIP.tips ? "checked" : ""}> Mostra i suggerimenti (testo che compare passando sopra i pulsanti)</label>
    <label class="row"><input type="checkbox" id="uip-num" ${UIP.num ? "checked" : ""}> Numera i pannelli (tasti 1-9 per attivarli)</label>
    <div class="row" style="margin-top:8px"><button id="uip-tut">Rivedi il tutorial</button></div>`;
  document.body.appendChild(d);
  d.querySelector("#uip-th").value = UIP.theme;
  const r = btn.getBoundingClientRect(); d.style.top = r.bottom + 6 + "px"; d.style.left = Math.max(8, Math.min(r.left, innerWidth - d.offsetWidth - 8)) + "px";
  const steps = [90, 100, 115, 130];
  d.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const i = Math.max(0, Math.min(steps.length - 1, steps.indexOf(UIP.font) + +b.dataset.f)); UIP.font = steps[i]; d.querySelector("b").textContent = UIP.font + "%"; uipSave(); uipApply(); });
  d.querySelector("#uip-th").onchange = e => { UIP.theme = e.target.value; uipSave(); uipApply(); };
  d.querySelector("#uip-tips").onchange = e => { UIP.tips = e.target.checked; uipSave(); uipApply(); };
  d.querySelector("#uip-num").onchange = e => { UIP.num = e.target.checked; uipSave(); uipApply(); };
  d.querySelector("#uip-tut").onclick = () => { d.remove(); tutStart(true); };
  setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener("mousedown", h); } }), 0);
}

// --- first-use tutorial: dimmed screen, the explained element stays lit. Steps whose element is not on screen are skipped.
const TUT = [
  { sel: "#nav", t: "Le tre sezioni", x: "<b>Dati</b> per i file mzML, <b>Disegno</b> per disegnare una struttura, <b>Teoria</b> per la parte teorica." },
  { sel: "#dtabs", t: "Tre modi di acquisizione", x: "Full Scan, MS² e MRM non si mescolano mai nello stesso grafico. Ogni scheda ha i suoi file e i suoi grafici; il <b>?</b> accanto a ciascuna spiega che cosa fanno Q1, Q2 e Q3." },
  { sel: "#dfiles", t: "I file caricati", x: "Spunta per mostrare o nascondere. <b>Tasto destro</b> su un file: rinomina (solo l'etichetta), cambia colore, rimuovi dalla sessione. I file delle altre schede sono in grigio: un clic ti ci porta." },
  { sel: "#tools", t: "Aggiungere grafici", x: "Cromatogramma, spettro, XIC, mappa. Con <b>Solo il selezionato</b> vedi un file alla volta, con <b>Tutti sovrapposti</b> li confronti." },
  { sel: "#dpanels .pnl", t: "Un grafico", x: "<b>Clic</b> sul cromatogramma: spettro in quel punto. <b>Trascina</b>: spettro medio. <b>Doppio clic</b>: nuovo spettro sotto il cromatogramma. <b>Tasto destro</b> su picchi e etichette: azioni (XIC, formula...). Il numero grigio nel titolo è il tasto 1-9 per attivare il pannello." },
  { sel: "#np-set", t: "Impostazioni", x: "Dimensione del testo, tema chiaro o scuro, suggerimenti e numerazione dei pannelli. Da qui puoi rivedere questo tutorial." },
];
function tutStart(force) {
  if (Q("#tut")) return;
  if (!force && uipRead(TUT_KEY) === "1") return;
  const steps = TUT.filter(s => { const e = Q(s.sel); return e && e.offsetParent !== null; });
  if (!steps.length) return;
  let i = 0;
  const ov = document.createElement("div"); ov.id = "tut";
  ov.innerHTML = `<div class="hole"></div><div class="box"><b class="tt"></b><div class="tx"></div><div class="nv"><span class="n"></span><span class="sp"></span><button data-a="skip">Salta</button><button data-a="prev">Indietro</button><button data-a="next" class="go"></button></div></div>`;
  document.body.appendChild(ov);
  const end = () => { ov.remove(); removeEventListener("keydown", key, true); removeEventListener("resize", show); uipWrite(TUT_KEY, "1"); };
  const show = () => {
    const s = steps[i], e = Q(s.sel); if (!e) return end();
    e.scrollIntoView({ block: "nearest" });
    const r = e.getBoundingClientRect(), h = ov.querySelector(".hole"), b = ov.querySelector(".box");
    h.style.cssText = `left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${Math.min(r.height, innerHeight - r.top - 8) + 8}px`;
    ov.querySelector(".tt").textContent = s.t; ov.querySelector(".tx").innerHTML = s.x; ov.querySelector(".n").textContent = `${i + 1} di ${steps.length}`;
    ov.querySelector("[data-a=next]").textContent = i === steps.length - 1 ? "Fine" : "Avanti"; ov.querySelector("[data-a=prev]").hidden = i === 0;
    const bh = b.offsetHeight, bw = b.offsetWidth; let top = r.bottom + 12; if (top + bh > innerHeight - 8) top = Math.max(8, Math.min(r.top - bh - 12, innerHeight - bh - 8));
    b.style.top = top + "px"; b.style.left = Math.max(8, Math.min(r.left, innerWidth - bw - 8)) + "px";
  };
  const go = d => { i += d; if (i < 0) i = 0; if (i >= steps.length) return end(); show(); };
  const key = e => { if (e.key === "Escape") { e.stopPropagation(); end(); } else if (e.key === "ArrowRight" || e.key === "Enter") { e.stopPropagation(); e.preventDefault(); go(1); } else if (e.key === "ArrowLeft") { e.stopPropagation(); e.preventDefault(); go(-1); } };
  ov.querySelector("[data-a=next]").onclick = () => go(1); ov.querySelector("[data-a=prev]").onclick = () => go(-1); ov.querySelector("[data-a=skip]").onclick = end;
  addEventListener("keydown", key, true); addEventListener("resize", show); show();
}
// the tutorial starts by itself the first time a file is open (once per browser)
let tutAuto = false;
function tutMaybe() {
  if (tutAuto || uipRead(TUT_KEY) === "1" || typeof E === "undefined" || !E.files.length || S.view !== "data") return;
  tutAuto = true; setTimeout(() => tutStart(false), 1200);
}
uipLoad();
(() => {
  const nav = Q("#nav"), b = document.createElement("button"); b.id = "np-set"; b.className = "ib gear"; b.title = "Impostazioni: testo, tema, suggerimenti, tutorial"; b.setAttribute("aria-label", "Impostazioni");
  b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  nav.insertAdjacentElement("afterend", b); b.onclick = e => { e.stopPropagation(); uipOpen(b); };
  uipApply();
})();
