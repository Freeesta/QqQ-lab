/* QqQ lab - Teoria: chromatography figures (chapters 3, 4, 5).
   1) van Deemter (packed LC column) and Golay (open-tubular GC column) curves;
   2) resolution: two Gaussian peaks and the Purnell equation;
   3) reversed-phase LC: isocratic or gradient elution with the linear solvent strength model;
   4) GC: linear temperature programme, n-alkane ladder and linear retention index (van den Dool & Kratz).
   The numbers are illustrative but physically consistent; every figure says so. */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue("--c" + n).trim();
  const gauss = (t, t0, s) => Math.exp(-0.5 * ((t - t0) / s) ** 2);

  // ------------------------------------------------------------ 1) van Deemter / Golay
  const vd = document.getElementById("sim-vandeemter");
  if (vd) {
    const mode = vd.dataset.mode || "lc";     // "lc" (chapters 3, 4) or "gc" (chapter 5)
    const LC = [["5", "5 µm porose (HPLC classica)"], ["3", "3 µm porose"], ["1.7", "1,7 µm porose (UHPLC)"], ["2.7", "2,7 µm core-shell"]];
    const GC = [["n2", "azoto (N₂)"], ["he", "elio (He)"], ["h2", "idrogeno (H₂)"]];
    const v = TP.controls(vd, mode === "lc" ? [
      { id: "a", label: "Termine A (cammini multipli)", min: 0, max: 2.5, step: 0.1, value: 1, fmt: x => TP.fmt(x, 1), unit: "× dp" },
      { id: "b", label: "Termine B (diffusione longitudinale)", min: 0.5, max: 4, step: 0.1, value: 2, fmt: x => TP.fmt(x, 1) },
      { id: "c", label: "Termine C (trasferimento di massa)", min: 0.01, max: 0.2, step: 0.005, value: 0.05, fmt: x => TP.fmt(x, 3) },
    ] : [
      { id: "k", label: "Fattore di ritenzione k dell'analita", min: 0.5, max: 20, step: 0.5, value: 5, fmt: x => TP.fmt(x, 1) },
      { id: "d", label: "Diametro interno della colonna", min: 0.1, max: 0.53, step: 0.01, value: 0.25, fmt: x => TP.fmt(x, 2), unit: "mm" },
    ], () => draw());
    const c = TP.canvas(vd, 300); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; vd.appendChild(out);
    const DM = 1e-9;  // diffusion coefficient of a small molecule in water/acetonitrile (m²/s)
    const DG = { n2: 0.032, he: 0.058, h2: 0.10 };   // effective gas-phase diffusion coefficients (cm²/s) chosen to give the textbook optima
    function draw() {
      let curves = [], xl, yl, x1, y1, info = "";
      if (mode === "lc") {
        // reduced plate height h = A + B/nu + C nu, nu = u dp / Dm; H = h dp
        LC.forEach(([dp, name], i) => {
          const d = +dp * 1e-6, a = dp === "2.7" ? v.a * 0.6 : v.a, cc = dp === "2.7" ? v.c * 0.6 : v.c;
          const us = [], hs = [];
          for (let u = 0.2; u <= 10.0001; u += 0.05) { const nu = u * 1e-3 * d / DM; us.push(u); hs.push((a + v.b / nu + cc * nu) * d * 1e6); }
          const nuo = Math.sqrt(v.b / cc), uo = nuo * DM / d * 1e3, ho = (a + 2 * Math.sqrt(v.b * cc)) * d * 1e6;
          curves.push({ us, hs, name, color: col(i + 1), uo, ho });
        });
        xl = "velocità lineare della fase mobile u (mm/s)"; yl = "H (µm)"; x1 = 10; y1 = 30;
        info = curves.map(k => `${k.name}: u<sub>ott</sub> ≈ <b>${TP.fmt(k.uo, 1)}</b> mm/s, H<sub>min</sub> ≈ <b>${TP.fmt(k.ho, 1)}</b> µm (N ≈ ${Math.round(100000 / k.ho).toLocaleString("it-IT")} piatti in 10 cm)`).join("<br>");
        info += `<br>Particelle più piccole: H più basso e curva più piatta a destra (si può andare più veloci), ma la pressione cresce come 1/d<sub>p</sub><sup>2</sup>: per questo l'UHPLC lavora oltre i 600 bar.`;
      } else {
        // Golay: H = B/u + C u, B = 2 Dg, C = f(k) r²/Dg (stationary phase term neglected: thin film)
        const r = v.d / 20, k = v.k, f = (1 + 6 * k + 11 * k * k) / (96 * (1 + k) ** 2);
        GC.forEach(([g, name], i) => {
          const D = DG[g], us = [], hs = [];
          for (let u = 2; u <= 80.0001; u += 0.5) { us.push(u); hs.push((2 * D / u + f * r * r / D * u) * 10); }   // mm
          const uo = Math.sqrt(2 * D / (f * r * r / D)), ho = 2 * Math.sqrt(2 * D * f * r * r / D) * 10;
          curves.push({ us, hs, name, color: col([2, 1, 3][i]), uo, ho });
        });
        xl = "velocità lineare media del gas u (cm/s)"; yl = "H (mm)"; x1 = 80; y1 = Math.max(0.6, curves[0].ho * 4);
        info = curves.map(k => `${k.name}: u<sub>ott</sub> ≈ <b>${TP.fmt(k.uo, 0)}</b> cm/s`).join(" · ") +
          `<br>H<sub>min</sub> ≈ <b>${TP.fmt(curves[0].ho, 2)}</b> mm per tutti i gas (dipende dal raggio della colonna e da k, non dal gas): in 30 m ≈ <b>${Math.round(30000 / curves[0].ho).toLocaleString("it-IT")}</b> piatti. ` +
          `L'idrogeno ha l'ottimo a velocità più alta e una curva più piatta: stessa efficienza in meno tempo.`;
      }
      const ax = TP.axes(c, { x0: 0, x1, y0: 0, y1, xl, yl });
      ax.clip();
      curves.forEach(k => TP.line(ax, k.us, k.hs, k.color, 2.4));
      curves.forEach(k => { const { ctx, X, Y } = ax; ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(X(k.uo), Y(k.ho), 4, 0, 7); ctx.fill(); });
      ax.ctx.restore();
      TP.legend(ax, curves.map(k => [k.name, k.color]));
      out.innerHTML = info + " <i>Valori illustrativi.</i>";
    }
    draw();
  }

  // ------------------------------------------------------------ 2) resolution (Purnell)
  const rs = document.getElementById("sim-risoluzione");
  if (rs) {
    const v = TP.controls(rs, [
      { id: "n", label: "Efficienza N (piatti)", min: 3, max: 5.3, step: 0.02, value: 4, fmt: x => Math.round(10 ** x / 100) * 100 + "" },
      { id: "al", label: "Selettività α = k₂/k₁", min: 1, max: 1.3, step: 0.005, value: 1.05, fmt: x => TP.fmt(x, 3) },
      { id: "k", label: "Ritenzione k₁ del primo picco", min: 0.2, max: 20, step: 0.1, value: 3, fmt: x => TP.fmt(x, 1) },
    ], () => draw());
    const c = TP.canvas(rs, 260); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; rs.appendChild(out);
    function draw() {
      const N = 10 ** v.n, t0 = 1, k1 = v.k, k2 = v.k * v.al, t1 = t0 * (1 + k1), t2 = t0 * (1 + k2);
      const s1 = t1 / Math.sqrt(N), s2 = t2 / Math.sqrt(N);
      const lo = Math.max(0, t1 - 6 * s1), hi = t2 + 6 * s2;
      const ts = []; for (let i = 0; i <= 600; i++) ts.push(lo + (hi - lo) * i / 600);
      const y1 = ts.map(t => gauss(t, t1, s1)), y2 = ts.map(t => gauss(t, t2, s2));
      const ax = TP.axes(c, { x0: lo, x1: hi, y0: 0, y1: 2.1, xl: "tempo / t₀", yl: "segnale", xfmt: x => TP.fmt(x, 2), yfmt: () => "" });
      TP.line(ax, ts, y1, col(1), 1.4, [4, 3]); TP.line(ax, ts, y2, col(2), 1.4, [4, 3]);
      TP.line(ax, ts, ts.map((t, i) => y1[i] + y2[i]), "#24231f", 2.2);
      const R = (t2 - t1) / (2 * (s1 + s2)), P = Math.sqrt(N) / 4 * (v.al - 1) / v.al * k2 / (1 + k2);
      const nNeed = v.al > 1 ? (1.5 * 4 * v.al / (v.al - 1) * (1 + k2) / k2) ** 2 : Infinity;
      out.innerHTML = `R<sub>s</sub> = <b>${TP.fmt(R, 2)}</b> (Purnell: (√N/4)·((α−1)/α)·(k₂/(1+k₂)) = ${TP.fmt(P, 2)}). ` +
        `Termini: √N/4 = ${TP.fmt(Math.sqrt(N) / 4, 1)} · (α−1)/α = ${TP.fmt((v.al - 1) / v.al, 3)} · k/(1+k) = ${TP.fmt(k2 / (1 + k2), 2)}. ` +
        (R >= 1.5 ? `<span class="ok">Separati alla base.</span>` : R >= 1 ? `<span class="bad">Si toccano: integrazione incerta.</span>` : `<span class="bad">Picchi fusi.</span>`) +
        (isFinite(nNeed) ? ` Per R<sub>s</sub> = 1,5 con questi α e k servono ≈ ${Math.round(nNeed).toLocaleString("it-IT")} piatti.` : " Con α = 1 non c'è separazione a nessuna efficienza.");
    }
    draw();
  }

  // ------------------------------------------------------------ 3) reversed-phase LC: isocratic vs gradient (LSS model)
  const gr = document.getElementById("sim-gradiente");
  if (gr) {
    // log k = log kw - S phi; four model compounds (illustrative: two polar TPs, the parent, a hydrophobic by-product)
    const CMP = [["TP polare", 1.6, 3.2, 3], ["TP idrossilato", 2.3, 3.6, 4], ["parent", 3.2, 4.0, 1], ["prodotto idrofobo", 4.4, 4.6, 2]];
    let modeG = "grad";
    TP.buttons(gr, [["iso", "Isocratica"], ["grad", "Gradiente"]], modeG, k => { modeG = k; draw(); });
    const v = TP.controls(gr, [
      { id: "phi", label: "Isocratica: % di acetonitrile", min: 5, max: 90, step: 1, value: 40, unit: "%" },
      { id: "p0", label: "Gradiente: % iniziale", min: 0, max: 60, step: 1, value: 10, unit: "%" },
      { id: "p1", label: "Gradiente: % finale", min: 40, max: 100, step: 1, value: 95, unit: "%" },
      { id: "tg", label: "Gradiente: durata", min: 3, max: 40, step: 1, value: 15, unit: "min" },
    ], () => draw());
    const c = TP.canvas(gr, 280); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; gr.appendChild(out);
    const T0 = 1.0, N = 12000, TMAX = 45;
    const phiAt = t => modeG === "iso" ? v.phi / 100 : Math.min(v.p1, v.p0 + (v.p1 - v.p0) * Math.max(0, t - T0) / v.tg) / 100; // the gradient reaches the column inlet after t0 (dwell volume neglected)
    function elute([, lkw, S]) {
      let x = 0, t = 0; const dt = 0.002;
      while (t < TMAX) { const k = 10 ** (lkw - S * phiAt(t)); x += dt / (T0 * (1 + k)); t += dt; if (x >= 1) return { t, k: 10 ** (lkw - S * phiAt(t)) }; }
      return { t: Infinity, k: Infinity };
    }
    function draw() {
      const res = CMP.map(elute);
      const ts = []; for (let i = 0; i <= 900; i++) ts.push(TMAX * i / 900);
      const ax = TP.axes(c, { x0: 0, x1: TMAX, y0: 0, y1: 1.15, xl: "tempo (min)", yl: "segnale", yfmt: () => "" });
      ax.clip();
      TP.line(ax, ts, ts.map(t => phiAt(t)), "#9b978c", 1.2, [5, 4]);
      res.forEach((r, i) => {
        if (!isFinite(r.t)) return;
        const s = T0 * (1 + r.k) / Math.sqrt(N) * (modeG === "grad" ? 1 : 1), h = Math.min(1, 0.06 / s);
        TP.line(ax, ts, ts.map(t => h * gauss(t, r.t, s)), col(CMP[i][3]), 2.2);
      });
      ax.ctx.restore();
      res.forEach((r, i) => { if (isFinite(r.t)) TP.label(ax, r.t, Math.min(1, 0.06 / (T0 * (1 + r.k) / Math.sqrt(N))) + 0.04, CMP[i][0], col(CMP[i][3])); });
      TP.label(ax, TMAX - 0.5, phiAt(TMAX) * 1, "% acetonitrile (tratteggio)", "#6b675c", "right");
      out.innerHTML = res.map((r, i) => `${CMP[i][0]}: ${isFinite(r.t) ? `t<sub>R</sub> = <b>${TP.fmt(r.t, 1)}</b> min, k all'uscita ≈ ${TP.fmt(r.k, 1)}` : `<span class="bad">non esce in ${TMAX} min</span>`}`).join(" · ") +
        `<br>${modeG === "iso" ? "In isocratica i primi picchi sono stretti e affollati, gli ultimi larghi e bassi (o non escono): è il «problema generale dell'eluizione»." : "In gradiente ogni composto esce con un k simile (pochi unità): picchi di larghezza simile e corsa più corta."} Modello LSS, log k = log k<sub>w</sub> − S·φ: valori illustrativi.`;
    }
    draw();
  }

  // ------------------------------------------------------------ 4) GC temperature programme and retention index
  const ri = document.getElementById("sim-indici");
  if (ri) {
    const v = TP.controls(ri, [
      { id: "rate", label: "Velocità della rampa", min: 3, max: 30, step: 1, value: 10, unit: "°C/min" },
      { id: "t0", label: "Temperatura iniziale (2 min di attesa)", min: 40, max: 120, step: 5, value: 60, unit: "°C" },
      { id: "ri", label: "Indice di ritenzione vero dell'analita", min: 900, max: 1900, step: 10, value: 1350 },
    ], () => draw());
    const c = TP.canvas(ri, 260); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; ri.appendChild(out);
    // elution temperature of n-alkane Cn on a 5%-phenyl column under programming (illustrative): ~ 16 °C per carbon, C10 at ~115 °C
    const Te = n => 115 + 16 * (n - 10);
    const tAt = T => T <= v.t0 ? 2 * (T - 20) / Math.max(1, v.t0 - 20) : 2 + (T - v.t0) / v.rate;
    function draw() {
      const ns = []; for (let n = 8; n <= 20; n++) ns.push(n);
      const tn = ns.map(n => tAt(Te(n))), tx = tAt(Te(v.ri / 100));
      const tEnd = tn[tn.length - 1] + 1;
      const ts = []; for (let i = 0; i <= 1200; i++) ts.push(tEnd * i / 1200);
      const s = 0.03 + 0.4 / v.rate;
      const ax = TP.axes(c, { x0: 0, x1: tEnd, y0: 0, y1: 1.25, xl: "tempo (min)", yl: "segnale", yfmt: () => "" });
      ax.clip();
      TP.line(ax, ts, ts.map(t => tn.reduce((a, x) => a + 0.7 * gauss(t, x, s), 0)), "#9b978c", 1.4);
      TP.line(ax, ts, ts.map(t => gauss(t, tx, s)), col(2), 2.4);
      ax.ctx.restore();
      ns.forEach((n, i) => { if (tn[i] > 0 && tn[i] < tEnd) TP.label(ax, tn[i], 0.72, "C" + n, "#6b675c"); });
      TP.label(ax, tx, 1.02, "analita", col(2));
      // linear retention index from the bracketing alkanes (van den Dool & Kratz)
      const i = tn.findIndex(t => t > tx), n = ns[i - 1];
      const calc = i > 0 ? 100 * (n + (tx - tn[i - 1]) / (tn[i] - tn[i - 1])) : NaN;
      out.innerHTML = `t<sub>R</sub> dell'analita = <b>${TP.fmt(tx, 2)}</b> min, fra C${n} (${TP.fmt(tn[i - 1], 2)} min) e C${n + 1} (${TP.fmt(tn[i], 2)} min). ` +
        `Indice lineare I = 100·[n + (t<sub>x</sub> − t<sub>n</sub>)/(t<sub>n+1</sub> − t<sub>n</sub>)] = <b>${Math.round(calc)}</b>. ` +
        `Cambiando la rampa il tempo cambia, l'indice no: per questo le librerie EI riportano l'indice di ritenzione, non il tempo. <i>Modello illustrativo.</i>`;
    }
    draw();
  }
});
