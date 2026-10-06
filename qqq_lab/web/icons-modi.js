// Icons of the three acquisition modes (inline SVG, no dependencies; colour = currentColor, so they follow the theme).
//   Full Scan   : many bars -> Q1 scans the whole m/z range.
//   Product ion : one tall bar (the precursor, Q1 fixed) -> arrow (collision in Q2) -> several small bars (fragments, Q3 scans).
//   MRM         : one bar -> arrow -> one bar highlighted: a single transition (Q1 and Q3 both fixed).
// Use: QICON.full / QICON.prod / QICON.mrm (SVG strings) or QICON.get("full", 20) for a given size in px.
const QICON = (() => {
  const wrap = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${body}</svg>`;
  const axis = '<path d="M2 21h28" stroke-width="1.6"/>';
  const bars = (xs, hs) => xs.map((x, i) => `<path d="M${x} 21v-${hs[i]}"/>`).join("");
  const arrow = '<path d="M12 12h6m-2.5-2.5L18 12l-2.5 2.5" stroke-width="1.6"/>';
  return {
    full: wrap(axis + bars([5, 9, 13, 17, 21, 25, 29], [7, 14, 9, 17, 6, 12, 5]), "Full Scan"),
    prod: wrap(axis + bars([5], [17]) + arrow + bars([22, 25.5, 29], [5, 10, 7]), "Product ion"),
    mrm: wrap(axis + bars([5], [17]) + arrow + `<path d="M26 21v-13" stroke-width="3.4"/>`, "MRM"),
    get(k, px = 22) { return this[k].replace("<svg ", `<svg width="${Math.round(px * 32 / 24)}" height="${px}" `); },
  };
})();
if (typeof module !== "undefined") module.exports = QICON;
