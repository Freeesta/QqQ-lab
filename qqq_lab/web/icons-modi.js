// Icons of the three acquisition modes: the triple quadrupole itself, Q1 - Q2 - Q3, with what each stage does.
//   sweep (<->, tinted box) = the stage scans a range of m/z;  dot = the stage is fixed on one m/z (filter);
//   X = collision cell (Q2) breaks the ions;  arrow = the stage lets everything through.
//   Full Scan   : Q1 sweeps, Q2 and Q3 let everything through          -> spectrum of the precursors
//   Product ion : Q1 fixed (the precursor), Q2 collides, Q3 sweeps      -> spectrum of the fragments
//   MRM         : Q1 fixed, Q2 collides, Q3 fixed (one transition)      -> chromatogram of one transition
// Colour = currentColor (follows the theme). Use: QICON.full / .prod / .mrm (SVG strings) or QICON.get("full", 20) (height in px).
const QICON = (() => {
  const box = (i, tint) => `<rect x="${1 + i * 16}" y="2" width="14" height="16" rx="3"${tint ? ' fill="currentColor" fill-opacity=".18"' : ""}/>`;
  const sweep = i => `<path d="M${4 + i * 16} 10h8M${6.5 + i * 16} 7.5L${4 + i * 16} 10l2.5 2.5M${9.5 + i * 16} 7.5L${12 + i * 16} 10l-2.5 2.5" stroke-width="1.5"/>`;
  const fixed = i => `<circle cx="${8 + i * 16}" cy="10" r="2.6" fill="currentColor" stroke="none"/>`;
  const hit = i => `<path d="M${5 + i * 16} 6.5l6 7m0-7l-6 7" stroke-width="1.8"/>`;
  const pass = i => `<path d="M${4.5 + i * 16} 10h7M${9 + i * 16} 7.5l2.5 2.5-2.5 2.5" stroke-width="1.5"/>`;
  const link = '<path d="M15 10h2M31 10h2" stroke-width="1.6"/>';
  const wrap = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${link}${body}</svg>`;
  return {
    full: wrap(box(0, 1) + sweep(0) + box(1) + pass(1) + box(2) + pass(2), "Full Scan: Q1 scansiona, Q2 e Q3 lasciano passare"),
    prod: wrap(box(0) + fixed(0) + box(1) + hit(1) + box(2, 1) + sweep(2), "Product ion: Q1 fisso, Q2 frammenta, Q3 scansiona"),
    mrm: wrap(box(0) + fixed(0) + box(1) + hit(1) + box(2) + fixed(2), "MRM: Q1 fisso, Q2 frammenta, Q3 fisso"),
    // TP Mine (secret module): a pickaxe and a gem, square
    mine: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="TP Mine"><path d="M5 21.5L13 6.6"/><path d="M3.5 12.5C6 5.5 16 3.5 21 9" stroke-width="2.2"/><path d="M3.5 12.5l.9 2.4M21 9l-2.4-.8" stroke-width="1.4"/><path d="M16.5 16l2.2-2.8 2.2 2.8-2.2 3.2z" fill="currentColor" fill-opacity=".25" stroke-width="1.4"/></svg>`,
    get(k, px = 20) { const w = k === "mine" ? px : Math.round(px * 48 / 20); return this[k].replace("<svg ", `<svg width="${w}" height="${px}" `); },
  };
})();
if (typeof module !== "undefined") module.exports = QICON;
