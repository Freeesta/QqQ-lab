"use strict";
// The three acquisition modes explained once (used by the "?" next to each Dati tab and by the Teoria chapter 9): what each quadrupole does,
// what the mode is for in the lab, a thumbnail of the typical output, and a comparison table. Classic script; needs icons-modi.js (QICON).
// Text for students, in Italian. Thumbnails are small inline SVGs (colour = currentColor).
const QMODI = (() => {
  const sticks = (xs, hs, hi) => xs.map((x, i) => `<path d="M${x} 52V${52 - hs[i]}" stroke-width="${i === hi ? 3 : 2}" ${i === hi ? 'stroke="var(--accent,#2b5c8a)"' : ""}/>`).join("");
  const frame = body => `<svg viewBox="0 0 150 62" width="150" height="62" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:#fff;border:1px solid #d9dce2;border-radius:6px;flex:none"><path d="M6 52H144M6 52V6" stroke-width="1"/>${body}</svg>`;
  const THUMB = {
    full: frame(sticks([22, 38, 55, 66, 84, 101, 120, 133], [14, 26, 12, 40, 18, 9, 30, 10], 3)),
    prod: frame(sticks([30, 47, 63, 80, 98, 118], [10, 24, 14, 34, 12, 20], 3) + '<path d="M118 52V32" stroke="#c2410c" stroke-dasharray="2 2"/>'),
    mrm: frame('<path d="M8 50C30 50 38 49 52 48C60 47 64 12 74 12C84 12 88 47 98 48C112 49 124 50 144 50" stroke="var(--accent,#2b5c8a)" stroke-width="2"/>'),
  };
  const M = {
    full: { name: "Full Scan", short: "Full Scan", ico: "full", q: ["Q1 scansiona tutto l'intervallo di <i>m/z</i>", "Q2 lascia passare gli ioni (nessuna frammentazione)", "Q3 lascia passare"],
      what: "Che cosa c'è nel campione", use: "Si guarda tutto ciò che esce dalla colonna: ogni ione intatto (lo ione precursore, ad esempio [M+H]<sup>+</sup>) con la sua intensità. È il punto di partenza per cercare candidati.",
      out: "Spettro di massa: un picco per ogni ione presente", sel: "nessuna (si vede tutto)", frag: "no", res: "uno spettro per ogni istante del cromatogramma" },
    prod: { name: "MS² (Product Ion)", short: "MS²", ico: "prod", q: ["Q1 resta fisso sullo ione precursore scelto", "Q2 è la cella di collisione: rompe lo ione (energia di collisione, CE)", "Q3 scansiona i frammenti"],
      what: "Di che cosa è fatto uno ione", use: "Si sceglie un precursore e si guardano i suoi frammenti: le perdite di massa dicono quali gruppi ha perso e aiutano a proporre una struttura (ipotesi, non identificazione).",
      out: "Spettro degli ioni prodotto: i frammenti di un solo precursore", sel: "alta sul precursore", frag: "sì", res: "uno spettro per ogni precursore scelto" },
    mrm: { name: "MRM", short: "MRM", ico: "mrm", q: ["Q1 fisso sul precursore", "Q2 frammenta lo ione", "Q3 fisso su un solo frammento (la transizione Q1&gt;Q3)"],
      what: "Quanto ce n'è, in modo selettivo", use: "Si segue una sola transizione, per esempio 364.1&gt;194.1: è molto sensibile e selettiva, quindi è lo strumento per la quantificazione (retta di taratura).",
      out: "Cromatogramma della transizione: un picco per composto, di cui si misura l'area", sel: "massima (due filtri di massa)", frag: "sì", res: "una traccia nel tempo per ogni transizione (non esistono spettri)" },
  };
  const ORDER = ["full", "prod", "mrm"];
  const tab2key = { full: "full", ms2: "prod", mrm: "mrm" };
  const th = "padding:3px 8px;border-bottom:1px solid #d9dce2;text-align:left;vertical-align:top;font-weight:600";
  const td = "padding:3px 8px;border-bottom:1px solid #eceef1;vertical-align:top";
  function table(cur) {
    const rows = [["Q1", k => M[k].q[0].replace(/^Q1 /, "")], ["Q2", k => M[k].q[1].replace(/^Q2 /, "")], ["Q3", k => M[k].q[2].replace(/^Q3 /, "")], ["Serve a", k => M[k].what], ["Risultato", k => M[k].out], ["Selettività", k => M[k].sel]];
    return `<table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:8px"><tr><th style="${th}"></th>${ORDER.map(k => `<th style="${th};${k === cur ? "background:#edf2f8" : ""}">${QICON.get(M[k].ico, 14)}<br>${M[k].short}</th>`).join("")}</tr>` +
      rows.map(r => `<tr><td style="${td};color:#687080">${r[0]}</td>${ORDER.map(k => `<td style="${td};${k === cur ? "background:#edf2f8" : ""}">${r[1](k)}</td>`).join("")}</tr>`).join("") + "</table>";
  }
  // popup for one mode (key = full | prod | mrm); the three modes are always shown in the table, the current one highlighted
  function html(key) {
    const m = M[key];
    return `<div style="display:flex;gap:12px;align-items:center;margin-bottom:6px"><span style="color:var(--accent,#2b5c8a)">${QICON.get(m.ico, 40)}</span><div><b style="font-size:14px">${m.name}</b><br><span style="color:#687080">${m.what}</span></div></div>` +
      `<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap"><ul style="margin:0 0 4px 16px;padding:0;flex:1 1 220px">${m.q.map(t => `<li>${t}</li>`).join("")}</ul><div style="text-align:center;font-size:11px;color:#687080">${THUMB[key]}<br>${m.out}</div></div>` +
      `<p style="margin:6px 0 0"><b>A che cosa serve in laboratorio.</b> ${m.use}</p>` +
      `<div style="margin-top:6px;font-size:11px;color:#687080">Legenda dello schema Q1-Q2-Q3: &#8596; scansiona &middot; &#9679; fisso su un <i>m/z</i> &middot; &#10005; collisione &middot; &#8594; lascia passare.</div>` + table(key);
  }
  // all three modes together (Teoria, chapter 9)
  function all() {
    return ORDER.map(k => `<div style="margin:0 0 14px;padding:8px 12px;border:1px solid #d9dce2;border-radius:8px;background:#fff">${html(k).replace(/<table[\s\S]*$/, "")}</div>`).join("") + table("");
  }
  return { M, ORDER, tab2key, html, all, table };
})();
