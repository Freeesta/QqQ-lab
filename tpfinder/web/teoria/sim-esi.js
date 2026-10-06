/* QqQ lab - Teoria: electrospray figures.
   1) life of a droplet: evaporation at constant charge until a fraction of the Rayleigh limit, then fission
      (offspring carry ~2% of the mass and ~15% of the charge: Kebarle & Verkerk 2009). Time in arbitrary units.
   2) Rayleigh limit vs droplet size for different solvents.
   3) competition for the excess charge (Enke / Tang-Kebarle model) -> linearity, saturation, suppression. */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue("--c" + n).trim();
  const EPS0 = 8.8541878128e-12, E = 1.602176634e-19;
  // surface tension (N/m, 20-25 C) and a relative evaporation-rate factor (illustrative)
  const SOLV = { w: ["acqua", 0.0720, 1.0], m: ["metanolo", 0.0226, 2.6], a: ["acetonitrile", 0.0290, 2.3] };
  const qR = (gamma, R) => 8 * Math.PI * Math.sqrt(EPS0 * gamma * R * R * R); // coulomb

  // ------------------------------------------------------------ 1) droplet life
  const dl = document.getElementById("sim-drop");
  if (dl) {
    const v = TP.controls(dl, [
      { id: "org", label: "Frazione di acetonitrile nella goccia", min: 0, max: 0.95, step: 0.05, value: 0.3, fmt: x => Math.round(x * 100) + " %" },
      { id: "r0", label: "Raggio iniziale", min: 0.3, max: 3, step: 0.1, value: 1.5, unit: "µm", fmt: x => TP.fmt(x, 1) },
      { id: "thr", label: "Fissione a una frazione del limite di Rayleigh", min: 0.6, max: 1, step: 0.05, value: 0.8, fmt: x => Math.round(x * 100) + " %" },
    ], () => draw());
    const c = TP.canvas(dl, 300); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; dl.appendChild(out);
    function run() {
      // linear mixing of surface tension and evaporation factor: a rough, explicitly approximate model
      const g = SOLV.w[1] * (1 - v.org) + SOLV.a[1] * v.org, ev = SOLV.w[2] * (1 - v.org) + SOLV.a[2] * v.org;
      let R = v.r0 * 1e-6, q = 0.7 * qR(g, R), t = 0; const rate = 0.02e-6 * ev; // m per time unit
      const ts = [0], Rs = [R], fr = [q / qR(g, R)], fis = []; let n = 0, guard = 0;
      while (R > 0.01e-6 && guard++ < 200000) {
        const dt = Math.max(R / 400 / rate, 1e-4);
        R -= rate * dt; t += dt; if (R <= 0) break;
        let f = q / qR(g, R);
        if (f >= v.thr) { ts.push(t); Rs.push(R); fr.push(f); R *= Math.cbrt(0.98); q *= 0.85; n++; fis.push(t); f = q / qR(g, R); }
        ts.push(t); Rs.push(R); fr.push(f);
        if (n > 80) break;
      }
      return { ts, Rs, fr, fis, n, g, z0: Math.round(0.7 * qR(g, v.r0 * 1e-6) / E) };
    }
    function draw() {
      const s = run(), tmax = s.ts[s.ts.length - 1];
      const ax = TP.axes(c, { x0: 0, x1: tmax, y0: 0, y1: v.r0 * 1.05, xl: "tempo (unità arbitrarie)", yl: "raggio della goccia madre (µm)", xfmt: () => "", yfmt: x => TP.fmt(x, 1), m: { r: 56 } });
      ax.clip();
      s.fis.forEach(t => TP.line(ax, [t, t], [0, v.r0 * 1.05], "#efe3dc", 1));
      TP.line(ax, s.ts, s.Rs.map(r => r * 1e6), col(1), 2.4);
      // secondary axis: q / qR in [0,1]
      const Y2 = f => ax.Y(f * v.r0 * 1.05);
      ax.ctx.strokeStyle = col(2); ax.ctx.lineWidth = 1.6; ax.ctx.beginPath();
      s.ts.forEach((t, i) => i ? ax.ctx.lineTo(ax.X(t), Y2(s.fr[i])) : ax.ctx.moveTo(ax.X(t), Y2(s.fr[i]))); ax.ctx.stroke();
      ax.ctx.restore();
      const ctx = ax.ctx; ctx.fillStyle = col(2); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "12px system-ui,sans-serif";
      [0, 0.5, 1].forEach(f => ctx.fillText(Math.round(f * 100) + "%", ax.W - ax.m.r + 6, Y2(f)));
      TP.legend(ax, [["raggio", col(1)], ["carica / limite di Rayleigh", col(2)], ["fissioni", "#e4cfc3"]], ax.m.l + 120);
      out.innerHTML = `Tensione superficiale stimata ${TP.fmt(s.g * 1000, 1)} mN/m; carica iniziale ≈ <b>${s.z0.toLocaleString("it-IT")}</b> cariche elementari (70% del limite). ` +
        `La goccia madre subisce <b>${s.n}</b> fissioni prima di scendere sotto 10 nm; ognuna espelle ~20 goccioline figlie (2% della massa, 15% della carica), che a loro volta evaporano e si dividono.`;
    }
    draw();
  }

  // ------------------------------------------------------------ 2) Rayleigh limit vs size
  const ry = document.getElementById("sim-rayleigh");
  if (ry) {
    const v = TP.controls(ry, [{ id: "d", label: "Diametro della goccia", min: -2, max: 1, step: 0.02, value: 0, fmt: x => { const d = Math.pow(10, x); return d < 1 ? TP.fmt(d * 1000, 0) + " nm" : TP.fmt(d, 2) + " µm"; } }], () => draw());
    const c = TP.canvas(ry, 260); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; ry.appendChild(out);
    function draw() {
      const xs = []; for (let x = -2; x <= 1.0001; x += 0.02) xs.push(x);
      const ax = TP.axes(c, { x0: -2, x1: 1, y0: 10, y1: 1e6, logy: true, xl: "log₁₀ diametro (µm)", yl: "cariche al limite zᵣ", xticks: [-2, -1, 0, 1], xfmt: x => ["10 nm", "100 nm", "1 µm", "10 µm"][x + 2], m: { l: 62 } });
      [["w", col(1)], ["m", col(3)], ["a", col(2)]].forEach(([k, cc]) => TP.line(ax, xs, xs.map(x => qR(SOLV[k][1], Math.pow(10, x) * 0.5e-6) / E), cc, 2.2));
      TP.legend(ax, [["acqua", col(1)], ["metanolo", col(3)], ["acetonitrile", col(2)]]);
      const R = Math.pow(10, v.d) * 0.5e-6; ax.ctx.fillStyle = col(4);
      ["w", "a"].forEach(k => { ax.ctx.beginPath(); ax.ctx.arc(ax.X(v.d), ax.Y(qR(SOLV[k][1], R) / E), 5, 0, 7); ax.ctx.fill(); });
      const zw = qR(SOLV.w[1], R) / E, za = qR(SOLV.a[1], R) / E;
      out.innerHTML = `Diametro ${Math.pow(10, v.d) < 1 ? TP.fmt(Math.pow(10, v.d) * 1000, 0) + " nm" : TP.fmt(Math.pow(10, v.d), 2) + " µm"}: limite di Rayleigh ≈ <b>${Math.round(zw).toLocaleString("it-IT")}</b> cariche in acqua, <b>${Math.round(za).toLocaleString("it-IT")}</b> in acetonitrile. ` +
        `z<sub>R</sub> cresce come d<sup>3/2</sup>: dimezzando il diametro la goccia sopporta solo il 35% della carica, per questo evaporazione e fissioni si alimentano a vicenda.`;
    }
    draw();
  }

  // ------------------------------------------------------------ 3) competition for charge
  const cp = document.getElementById("sim-comp");
  if (cp) {
    const v = TP.controls(cp, [
      { id: "e", label: "Elettrolita / acido in fase mobile [E]", min: -6, max: -2, step: 0.1, value: -3, fmt: x => TP.sci(Math.pow(10, x), 1) + " M" },
      { id: "m", label: "Matrice coeluente [M]", min: -8, max: -3, step: 0.1, value: -8, fmt: x => x <= -7.95 ? "assente" : TP.sci(Math.pow(10, x), 1) + " M" },
      { id: "km", label: "Affinità per la superficie della matrice kₘ/kₐ", min: -1, max: 2, step: 0.1, value: 1, fmt: x => TP.fmt(Math.pow(10, x), x < 0 ? 1 : 0) + "×" },
    ], () => draw());
    const c = TP.canvas(cp, 280); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; cp.appendChild(out);
    // Excess charge per unit time is fixed by the ESI current. Each species gets a share proportional to k_i [i].
    // k_A = 1 (reference), k_E = 0.1 (small inorganic ions are poorly surface active), k_M = 10^km.
    const kA = 1, kE = 0.1, Q = 1e-5; // Q: total excess charge concentration in the droplets (~1e-5 M)
    const IA = (a, e, m, km) => Q * kA * a / (kA * a + kE * e + km * m);
    function draw() {
      const xs = []; for (let x = -9; x <= -3.0001; x += 0.05) xs.push(x);
      const e = Math.pow(10, v.e), m = v.m <= -7.95 ? 0 : Math.pow(10, v.m), km = Math.pow(10, v.km);
      const y0 = xs.map(x => IA(Math.pow(10, x), e, 0, km)), y1 = xs.map(x => IA(Math.pow(10, x), e, m, km));
      const ax = TP.axes(c, { x0: -9, x1: -3, y0: 1e-11, y1: 1e-4, logy: true, xl: "log₁₀ concentrazione dell'analita (M)", yl: "segnale dell'analita (u.a.)", xticks: [-9, -8, -7, -6, -5, -4, -3], m: { l: 62 } });
      TP.line(ax, xs, xs.map(x => Q * kA * Math.pow(10, x) / (kE * e)), "#c9c5bb", 1.2, [4, 4]);
      TP.line(ax, xs, y0, col(1), 2.4);
      if (m) TP.line(ax, xs, y1, col(2), 2.4);
      TP.legend(ax, [["senza matrice", col(1)]].concat(m ? [["con matrice coeluente", col(2)]] : []), ax.m.l + 260);
      const a7 = 1e-7, s0 = IA(a7, e, 0, km), s1 = IA(a7, e, m, km);
      out.innerHTML = `Modello semplificato: la carica in eccesso disponibile è fissa (~10⁻⁵ M) e se la dividono le specie in proporzione a k·[C]. ` +
        `Il segnale cresce linearmente finché l'analita è una frazione piccola delle specie cariche, poi <b>satura</b>. ` +
        (m ? `A 10⁻⁷ M la matrice riduce il segnale del <b>${TP.fmt(100 * (1 - s1 / s0), 0)} %</b> (soppressione ionica).` : `Aggiungete una matrice coeluente per vedere la soppressione.`);
    }
    draw();
  }
});
