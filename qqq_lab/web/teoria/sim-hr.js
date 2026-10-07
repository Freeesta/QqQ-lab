/* QqQ lab - Teoria: resolution and high-resolution analyzers (chapters 11 and 13).
   1) two close ions against the resolving power (Gaussian peaks, FWHM = m/R): resolved or merged, centroid error;
   2) Orbitrap: image-current envelope and Fourier spectrum of two ions, resolving power against transient length;
   3) TOF: arrival-time spread from the initial energy spread, linear against reflectron;
   4) how many molecular formulas fit a mass within a tolerance (only the COUNT: this is not a formula generator).
   Exact masses come from ../elements.js (the same data as the program). */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue("--c" + n).trim();
  const EL = typeof ELEMENTS !== "undefined" ? ELEMENTS : [];
  const iso = (s, A) => { const e = EL.find(x => x.s === s); const i = e && e.iso.find(x => x[0] === A); return i ? i[1] : NaN; };
  const M = { H: iso("H", 1), C: 12, N: iso("N", 14), O: iso("O", 16), S: iso("S", 32), Cl: iso("Cl", 35), Br: iso("Br", 79) };
  const ELE = 0.000548579909;
  const mass = f => Object.entries(f).reduce((a, [e, n]) => a + M[e] * n, 0);
  const gauss = (x, x0, s) => Math.exp(-0.5 * ((x - x0) / s) ** 2);
  const ppm = (a, b) => (a - b) / b * 1e6;

  // ------------------------------------------------------------ 1) two close ions and the resolving power
  const r2 = document.getElementById("sim-res2");
  if (r2) {
    const dC = iso("C", 13) - 12, dN = iso("N", 15) - iso("N", 14), dS = iso("S", 34) - M.S, dO = iso("O", 18) - M.O, dCl = iso("Cl", 37) - M.Cl;
    const PAIRS = {
      "28": { a: ["CO⁺•", mass({ C: 1, O: 1 }) - ELE], b: ["N₂⁺•", mass({ N: 2 }) - ELE], c: ["C₂H₄⁺•", mass({ C: 2, H: 4 }) - ELE], fixed: true },
      "43": { a: ["C₂H₃O⁺ (acilio)", mass({ C: 2, H: 3, O: 1 }) - ELE], b: ["C₃H₇⁺ (propile)", mass({ C: 3, H: 7 }) - ELE], fixed: true },
      "cn": { a: ["M+1 da ¹⁵N", dN], b: ["M+1 da ¹³C", dC] },
      "cs": { a: ["M+2 da ³⁴S", dS], b: ["M+2 da ¹³C₂", 2 * dC] },
      "ccl": { a: ["M+2 da ³⁷Cl", dCl], b: ["M+2 da ¹³C₂", 2 * dC] },
      "co": { a: ["M+2 da ¹⁸O", dO], b: ["M+2 da ¹³C₂", 2 * dC] },
    };
    const v = TP.controls(r2, [
      { id: "p", label: "Coppia di ioni", num: false, value: "43", options: [["28", "m/z 28: CO, N₂, C₂H₄"], ["43", "m/z 43: acilio o propile"], ["cn", "isotopi: ¹⁵N contro ¹³C"], ["cs", "isotopi: ³⁴S contro ¹³C₂"], ["ccl", "isotopi: ³⁷Cl contro ¹³C₂"], ["co", "isotopi: ¹⁸O contro ¹³C₂"]] },
      { id: "r", label: "Potere risolutivo R = m/Δm (FWHM)", min: 2.3, max: 5.7, step: 0.01, value: 3.3, fmt: x => Math.round(10 ** x).toLocaleString("it-IT") },
      { id: "m", label: "m/z dello ione (per le coppie isotopiche)", min: 100, max: 800, step: 10, value: 300 },
    ], () => draw());
    const c = TP.canvas(r2, 260); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; r2.appendChild(out);
    function draw() {
      const P = PAIRS[v.p], base = P.fixed ? 0 : v.m;
      const ions = [P.a, P.b, P.c].filter(Boolean).map(([n, m]) => [n, base + m]);
      const mid = ions.reduce((a, x) => a + x[1], 0) / ions.length, R = 10 ** v.r;
      const fw = mid / R, s = fw / 2.3548, span = Math.max(Math.max(...ions.map(x => x[1])) - Math.min(...ions.map(x => x[1])), fw) * 2.2 + 3 * fw;
      const x0 = mid - span / 2, x1 = mid + span / 2, xs = []; for (let i = 0; i <= 800; i++) xs.push(x0 + (x1 - x0) * i / 800);
      const parts = ions.map(i => xs.map(x => gauss(x, i[1], s))), sum = xs.map((_, k) => parts.reduce((a, p) => a + p[k], 0));
      const top = Math.max(...sum);
      const ax = TP.axes(c, { x0, x1, y0: 0, y1: 1.15, xl: "m/z", yl: "segnale", xfmt: x => TP.fmt(x, span < 0.05 ? 4 : 3), yfmt: () => "" });
      ax.clip();
      parts.forEach((p, i) => TP.line(ax, xs, p.map(y => y / top), col(i + 1), 1.3, [4, 3]));
      TP.line(ax, xs, sum.map(y => y / top), "#24231f", 2.3);
      ax.ctx.restore();
      ions.forEach((i, k) => TP.label(ax, i[1], 1.07 - k * 0.08, i[0], col(k + 1)));
      let maxima = 0; for (let k = 1; k < sum.length - 1; k++) if (sum[k] > sum[k - 1] && sum[k] >= sum[k + 1] && sum[k] > 0.05 * top) maxima++;
      const dm = Math.min(...ions.slice(1).map((x, k) => Math.abs(x[1] - ions[k][1])));
      const cen = xs.reduce((a, x, k) => a + x * sum[k], 0) / sum.reduce((a, y) => a + y, 0);
      out.innerHTML = `Differenza di massa minima Δm = <b>${TP.fmt(dm * 1000, 2)} mDa</b>; per vederli separati serve R ≳ m/Δm = <b>${Math.round(mid / dm).toLocaleString("it-IT")}</b> (il doppio per una valle netta). ` +
        (maxima >= ions.length ? `<span class="ok">Picchi risolti</span>: ogni massa si misura da sola.` :
          `<span class="bad">Picco unico</span>: il centroide misurato è ${TP.fmt(cen, 4)}, cioè ${TP.fmt(ppm(cen, ions[0][1]), 1)} ppm da ${ions[0][0]} e ${TP.fmt(ppm(cen, ions[1][1]), 1)} ppm da ${ions[1][0]}: un errore di massa «finto», dovuto alla risoluzione e non alla taratura.`) +
        ` Masse da elements.js; per gli ioni è tolta la massa dell'elettrone.`;
    }
    draw();
  }

  // ------------------------------------------------------------ 2) Orbitrap: transient and Fourier transform
  const ob = document.getElementById("sim-orbi");
  if (ob) {
    const F200 = 900e3;   // axial frequency at m/z 200 (Hz), order of magnitude of a high-field Orbitrap; f is proportional to sqrt(z/m)
    const v = TP.controls(ob, [
      { id: "t", label: "Durata del transiente", min: 8, max: 1024, step: 8, value: 128, unit: "ms" },
      { id: "m", label: "m/z del primo ione", min: 100, max: 1000, step: 10, value: 200 },
      { id: "d", label: "Distanza fra i due ioni", min: 0.5, max: 40, step: 0.5, value: 5, unit: "mDa" },
    ], () => draw());
    const g = document.createElement("div"); g.className = "grid2"; ob.appendChild(g);
    const a = document.createElement("div"), b = document.createElement("div"); g.appendChild(a); g.appendChild(b);
    const c1 = TP.canvas(a, 220), c2 = TP.canvas(b, 220); c1.onresize = c2.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; ob.appendChild(out);
    const f = m => F200 * Math.sqrt(200 / m);
    function draw() {
      const T = v.t / 1000, m1 = v.m, m2 = v.m + v.d / 1000, f1 = f(m1), f2 = f(m2), tau = 1.2;   // tau: decay time of the signal (collisions), s
      // envelope of the image current (heterodyned at the mean frequency): beating with period 1/|f1-f2|
      const ts = [], env = [];
      for (let i = 0; i <= 600; i++) { const t = T * i / 600, ph = Math.PI * (f1 - f2) * t; ts.push(t * 1000); env.push(Math.abs(2 * Math.cos(ph)) / 2 * Math.exp(-t / tau)); }
      const ax = TP.axes(c1, { x0: 0, x1: v.t, y0: 0, y1: 1.1, xl: "tempo (ms)", yl: "inviluppo della corrente immagine", yfmt: () => "" });
      TP.line(ax, ts, env, col(1), 1.8);
      // magnitude spectrum of two windowed sinusoids, on the m/z axis
      const R = f1 * T / 2, fw = m1 / R, x0 = m1 - Math.max(4 * fw, 0.6 * v.d / 1000 + 3 * fw), x1 = m2 + Math.max(4 * fw, 0.6 * v.d / 1000 + 3 * fw);
      const xs = [], ys = [];
      for (let i = 0; i <= 700; i++) {
        const m = x0 + (x1 - x0) * i / 700, fr = f(m);
        let re = 0, im = 0;
        [f1, f2].forEach(fi => { const x = Math.PI * (fr - fi) * T, sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x; re += sinc * Math.cos(x); im -= sinc * Math.sin(x); });
        xs.push(m); ys.push(Math.hypot(re, im));
      }
      const top = Math.max(...ys);
      const bx = TP.axes(c2, { x0, x1, y0: 0, y1: 1.1, xl: "m/z", yl: "spettro (modulo della FT)", xfmt: x => TP.fmt(x, 4), yfmt: () => "" });
      bx.clip(); TP.line(bx, xs, ys.map(y => y / top), col(2), 2); bx.ctx.restore();
      let maxima = 0; for (let k = 1; k < ys.length - 1; k++) if (ys[k] > ys[k - 1] && ys[k] >= ys[k + 1] && ys[k] > 0.5 * top) maxima++;
      out.innerHTML = `Frequenza assiale a m/z ${m1}: ${TP.fmt(f1 / 1000, 0)} kHz (f ∝ √(z/m)). Potere risolutivo ≈ f·T/2 = <b>${Math.round(R).toLocaleString("it-IT")}</b> a questa m/z ` +
        `(${Math.round(F200 * T / 2).toLocaleString("it-IT")} a m/z 200). I due ioni sono ${maxima >= 2 ? '<span class="ok">risolti</span>' : '<span class="bad">non risolti</span>'}. ` +
        `Un transiente lungo dà più risoluzione ma meno spettri al secondo: a ${v.t} ms, al massimo ~${TP.fmt(1000 / (v.t + 15), 0)} scansioni/s. <i>Valori indicativi.</i>`;
    }
    draw();
  }

  // ------------------------------------------------------------ 3) TOF: linear against reflectron
  const tf = document.getElementById("sim-tof");
  if (tf) {
    let refl = false;
    TP.buttons(tf, [["lin", "Lineare"], ["ref", "Con reflectron"]], "lin", k => { refl = k === "ref"; draw(); });
    const v = TP.controls(tf, [
      { id: "de", label: "Dispersione dell'energia iniziale (σ)", min: 0.2, max: 20, step: 0.2, value: 3, unit: "eV" },
      { id: "m", label: "m/z", min: 50, max: 2000, step: 10, value: 300 },
    ], () => draw());
    const c = TP.canvas(tf, 240); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; tf.appendChild(out);
    const U = 10000, L = 1.5, AMU = 1.66053907e-27, Q = 1.602176634e-19, JIT = 0.5e-9;   // 10 kV, 1.5 m (3 m with the reflectron), detector jitter 0.5 ns
    function draw() {
      const Leff = refl ? 3 : L, t = m => Leff / Math.sqrt(2 * Q * U / (m * AMU));
      const t1 = t(v.m), t2 = t(v.m + 1), rel = v.de / (2 * U);                     // dt/t = -dE/(2E) to first order
      const sT = Math.hypot(refl ? t1 * rel * rel * 4 : t1 * rel, JIT);              // reflectron: first-order term compensated, second order left
      const R = t1 / (2 * 2.3548 * sT);
      const x0 = t1 - 6 * sT, x1 = t2 + 6 * sT, xs = []; for (let i = 0; i <= 800; i++) xs.push(x0 + (x1 - x0) * i / 800);
      const ax = TP.axes(c, { x0: x0 * 1e6, x1: x1 * 1e6, y0: 0, y1: 1.15, xl: "tempo di volo (µs)", yl: "ioni", xfmt: x => TP.fmt(x, 3), yfmt: () => "" });
      ax.clip(); TP.line(ax, xs.map(x => x * 1e6), xs.map(x => gauss(x, t1, sT) + gauss(x, t2, sT)), col(1), 2.2); ax.ctx.restore();
      TP.label(ax, t1 * 1e6, 1.03, "m/z " + v.m); TP.label(ax, t2 * 1e6, 1.03, "m/z " + (v.m + 1));
      out.innerHTML = `t = L·√(m/2zeU): m/z ${v.m} arriva dopo <b>${TP.fmt(t1 * 1e6, 2)} µs</b> (${refl ? "3 m con il reflectron" : "1,5 m"}, 10 kV). Allargamento σ<sub>t</sub> = ${TP.fmt(sT * 1e9, 2)} ns, potere risolutivo R = t/(2Δt) ≈ <b>${Math.round(R).toLocaleString("it-IT")}</b>. ` +
        (refl ? "Il reflectron fa entrare più in profondità gli ioni più veloci: percorrono più strada e arrivano insieme ai lenti (compensazione al primo ordine). Resta il limite dell'elettronica." : "Gli ioni più energetici arrivano prima: con qualche eV di dispersione la risoluzione resta di poche centinaia o migliaia.") + " <i>Modello semplificato.</i>";
    }
    draw();
  }

  // ------------------------------------------------------------ 4) how many formulas fit a mass
  const ff = document.getElementById("sim-formule");
  if (ff) {
    const v = TP.controls(ff, [
      { id: "m", label: "Massa nominale", min: 100, max: 700, step: 1, value: 300, unit: "Da" },
      { id: "dm", label: "Difetto di massa (parte decimale)", min: -0.2, max: 0.4, step: 0.005, value: 0.1, fmt: x => (x >= 0 ? "+" : "") + TP.fmt(x, 3) },
      { id: "set", label: "Elementi ammessi", num: false, value: "chnos", options: [["chno", "C, H, N, O"], ["chnos", "C, H, N, O, S, Cl"]] },
      { id: "gold", label: "Regole di plausibilità (H/C, N/C, O/C, RDB)", num: false, value: "si", options: [["si", "applicate"], ["no", "nessuna"]] },
    ], () => draw());
    const c = TP.canvas(ff, 240); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; ff.appendChild(out);
    const TOL = [["±0,5 Da (massa nominale)", null], ["10 ppm", 10], ["5 ppm", 5], ["2 ppm", 2], ["1 ppm", 1]];
    function count(target, tolDa, set, gold) {
      let n = 0;
      const sMax = set === "chnos" ? 2 : 0, clMax = set === "chnos" ? 3 : 0;
      for (let C = 1; C <= 50; C++) for (let N = 0; N <= 6; N++) for (let O = 0; O <= 10; O++) for (let S = 0; S <= sMax; S++) for (let Cl = 0; Cl <= clMax; Cl++) {
        const rest = C * M.C + N * M.N + O * M.O + S * M.S + Cl * M.Cl;
        if (rest > target + tolDa) break;
        const hLo = Math.ceil((target - tolDa - rest) / M.H), hHi = Math.floor((target + tolDa - rest) / M.H);
        for (let H = Math.max(0, hLo); H <= hHi; H++) {
          const rdb = C - (H + Cl) / 2 + N / 2 + 1;
          if (rdb < 0 || rdb !== Math.floor(rdb)) continue;                         // neutral molecule: integer RDB (nitrogen rule)
          if (gold === "si" && (H / C < 0.2 || H / C > 3.1 || N / C > 1.3 || O / C > 1.2 || rdb > C)) continue;
          n++;
        }
      }
      return n;
    }
    function draw() {
      const mx = v.m + v.dm, res = TOL.map(([lab, p]) => [lab, count(mx, p === null ? 0.5 : mx * p * 1e-6, v.set, v.gold)]);
      const top = Math.max(...res.map(r => r[1]), 1);
      const ax = TP.axes(c, { x0: 0, x1: res.length, y0: 0.8, y1: top * 2, logy: true, xl: "tolleranza", yl: "formule possibili", xticks: [], m: { l: 62 } });
      res.forEach((r, i) => {
        const { ctx, X, Y } = ax, x = X(i + 0.15), w = X(i + 0.85) - x, y = Y(Math.max(r[1], 0.8));
        ctx.fillStyle = i === 0 ? "#9b978c" : col(1); ctx.fillRect(x, y, w, Y(0.8) - y);
        TP.label(ax, i + 0.5, Math.max(r[1], 0.8), r[1].toLocaleString("it-IT"));
        ctx.save(); ctx.fillStyle = "#6b675c"; ctx.font = "11.5px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText(r[0], X(i + 0.5), ax.H - ax.m.b + 14); ctx.restore();
      });
      out.innerHTML = `A massa ${TP.fmt(mx, 3)} Da: <b>${res[0][1].toLocaleString("it-IT")}</b> formule con la stessa massa nominale, <b>${res[2][1].toLocaleString("it-IT")}</b> entro 5 ppm, <b>${res[4][1].toLocaleString("it-IT")}</b> entro 1 ppm. ` +
        `L'alta risoluzione riduce i candidati di ordini di grandezza, ma sopra ~400 Da anche a 1 ppm ne restano diversi: servono il profilo isotopico, la MS2 e la chimica. ` +
        `<i>Il grafico conta le formule, non le elenca: in laboratorio la formula la proponete voi.</i>`;
    }
    draw();
  }
});
