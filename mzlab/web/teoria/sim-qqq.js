/* QqQ lab - Teoria: triple quadrupole figures.
   1) scan modes explorer (fictitious mixture): what Q1, q2 and Q3 do and which spectrum you get;
   2) collision energy: centre-of-mass energy and an illustrative breakdown curve;
   3) MRM timing: dwell, cycle time, points per peak, duty cycle vs full scan. */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue("--c" + n).trim();

  // ------------------------------------------------------------ 1) scan modes
  const sm = document.getElementById("sim-modes");
  if (sm) {
    // fictitious compounds: [precursor m/z, abundance, colour, name, fragments [m/z, rel]]
    const MIX = [
      { mz: 250, ab: 100, c: col(1), n: "parent X", fr: [[208, 100], [180, 45], [152, 70]] },
      { mz: 266, ab: 35, c: col(2), n: "TP +O", fr: [[224, 100], [196, 40], [168, 60]] },
      { mz: 222, ab: 25, c: col(3), n: "TP −28", fr: [[180, 100], [152, 80]] },
      { mz: 238, ab: 40, c: "#9b978c", n: "interferente", fr: [[120, 100], [91, 50]] },
    ];
    const MODES = {
      full: { t: "Full scan (Q1 MS)", q1: "scan", q2: "RF, nessuna frammentazione", q3: "RF (trasmette tutto)", x: "m/z (Q1)", info: "Q1 scorre la scala delle masse, cella e Q3 lasciano passare tutto: è lo spettro degli ioni che escono dalla sorgente. Base dello screening dei TP." },
      prod: { t: "Product ion scan (MS2) di m/z 250", q1: "fisso 250", q2: "CID", q3: "scan", x: "m/z dei frammenti (Q3)", info: "Q1 isola il precursore, la cella lo frammenta, Q3 registra tutti i frammenti: è lo spettro MS2, la carta d'identità strutturale." },
      prec: { t: "Precursor ion scan di m/z 152", q1: "scan", q2: "CID", q3: "fisso 152", x: "m/z dei precursori (Q1)", info: "Q3 è fermo su un frammento caratteristico, Q1 scorre: compaiono tutti i precursori che producono quel frammento. Notate che il TP +O non c'è: l'ossigeno è finito proprio sulla parte che genera 152 (che diventa 168)." },
      nl: { t: "Neutral loss scan di 42 Da", q1: "scan", q2: "CID", q3: "scan (Q1 − 42)", x: "m/z dei precursori (Q1)", info: "Q1 e Q3 scorrono insieme, sfalsati di 42: compaiono tutti i precursori che perdono una molecola neutra di 42 Da (qui propene: gruppo isopropile). L'interferente non c'è." },
      mrm: { t: "MRM: 250→208 e 266→224", q1: "fisso 250 / 266", q2: "CID", q3: "fisso 208 / 224", x: "tempo di ritenzione (min)", info: "Q1 e Q3 fissi, alternati tra le transizioni: nessuno spettro, ma un cromatogramma per transizione, con il rumore più basso possibile. Serve a quantificare." },
    };
    let mode = "full", t0 = performance.now(), raf = null, dots = [];
    let paused = TP.reduced(), tFrozen = 0;   // reduced motion: starts paused, ▶ starts it
    const bt0 = TP.buttons(sm, Object.entries(MODES).map(([k, m]) => [k, m.t.split(" (")[0].split(":")[0]]), "full", k => { mode = k; t0 = performance.now(); dots = []; tFrozen = 0; if (paused && !raf) loop(); });
    const pb = document.createElement("button"); pb.type = "button"; pb.textContent = paused ? "▶ Avvia" : "⏸ Pausa"; bt0.appendChild(pb);
    pb.onclick = () => { paused = !paused; pb.textContent = paused ? "▶ Avvia" : "⏸ Pausa"; if (paused) tFrozen = (performance.now() - t0) / 1000; else { t0 = performance.now() - tFrozen * 1000; if (!raf) loop(); } };
    const c = TP.canvas(sm, 200), c2 = TP.canvas(sm, 220);
    const out = document.createElement("div"); out.className = "readout"; sm.appendChild(out);
    const SWEEP = 4.5; // s per sweep
    const pass = (m, set) => Math.abs(m - set) < 0.5;
    function setting(t) {
      const f = (t % SWEEP) / SWEEP, s = 80 + f * 200; // sweep m/z 80-280
      if (mode === "full") return { q1: s, q3: null, rec: s, f };
      if (mode === "prod") return { q1: 250, q3: s, rec: s, f };
      if (mode === "prec") return { q1: s, q3: 152, rec: s, f };
      if (mode === "nl") return { q1: s, q3: s - 42, rec: s, f };
      const tr = Math.floor(t * 4) % 2; return { q1: tr ? 266 : 250, q3: tr ? 224 : 208, rec: null, f, tr };
    }
    // signal for the recorded axis value s (deterministic, for the spectrum panel)
    function signal(s) {
      let y = 0;
      MIX.forEach(cmp => {
        const fsum = cmp.fr.reduce((a, b) => a + b[1], 0);
        const peak = (m) => Math.max(0, 1 - Math.abs(m - s) / 0.5);
        if (mode === "full") y += cmp.ab * peak(cmp.mz);
        else if (mode === "prod") { if (cmp.mz === 250) { cmp.fr.forEach(([m, r]) => y += 100 * r / 100 * peak(m)); y += 15 * peak(250); } }
        else if (mode === "prec") { cmp.fr.forEach(([m, r]) => { if (m === 152) y += cmp.ab * r / fsum * 2.5 * peak(cmp.mz); }); }
        else if (mode === "nl") { cmp.fr.forEach(([m, r]) => { if (cmp.mz - m === 42) y += cmp.ab * r / fsum * 2.5 * peak(cmp.mz); }); }
      });
      return y;
    }
    function drawInstr(st, t) {
      const { ctx, W, H } = c; ctx.clearRect(0, 0, W, H);
      const xs = [0.04, 0.18, 0.40, 0.62, 0.84, 0.95].map(f => f * W), cy = H * 0.52;
      const box = (x0, x1, lab, sub, colr) => {
        ctx.fillStyle = "#f4f3ef"; ctx.strokeStyle = "#c9c5bb"; ctx.lineWidth = 1;
        ctx.fillRect(x0, cy - 34, x1 - x0, 68); ctx.strokeRect(x0, cy - 34, x1 - x0, 68);
        ctx.fillStyle = colr; ctx.fillRect(x0, cy - 34, x1 - x0, 7); ctx.fillRect(x0, cy + 27, x1 - x0, 7);
        ctx.fillStyle = "#24231f"; ctx.font = "600 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(lab, (x0 + x1) / 2, cy - 40);
        ctx.font = "12px system-ui"; ctx.fillStyle = "#6b675c"; ctx.textBaseline = "top"; ctx.fillText(sub, (x0 + x1) / 2, cy + 40);
      };
      const m = MODES[mode];
      const q1t = st.q1 != null ? (m.q1 === "scan" ? "scan: " + st.q1.toFixed(0) : "fisso: " + st.q1.toFixed(0)) : "";
      const q3t = st.q3 != null ? (m.q3.startsWith("scan") ? "scan: " + st.q3.toFixed(0) : "fisso: " + st.q3.toFixed(0)) : "trasmette tutto";
      box(xs[1], xs[2] - 10, "Q1", q1t, "#2b5c8a"); box(xs[2] + 10, xs[3] - 10, "q2", m.q2, "#9b978c"); box(xs[3] + 10, xs[4] - 10, "Q3", q3t, "#2b5c8a");
      ctx.fillStyle = "#24231f"; ctx.fillRect(xs[4] + 6, cy - 16, 16, 32); ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("rivelatore", xs[4] + 14, cy + 40);
      ctx.textBaseline = "bottom"; ctx.fillText("sorgente", xs[0] + 18, cy - 40); ctx.beginPath(); ctx.moveTo(xs[0], cy - 12); ctx.lineTo(xs[0] + 34, cy); ctx.lineTo(xs[0], cy + 12); ctx.fillStyle = "#c9c5bb"; ctx.fill();
      // spawn ions
      for (let k = 0; k < 2; k++) {
        const r = Math.random() * MIX.reduce((a, b) => a + b.ab, 0); let acc = 0, cmp = MIX[0];
        for (const x of MIX) { acc += x.ab; if (r <= acc) { cmp = x; break; } }
        dots.push({ x: xs[0] + 34, y: cy + (Math.random() - .5) * 14, m: cmp.mz, cmp, c: cmp.c, stage: 0, vy: 0, a: 1, r: 4 });
      }
      const vx = W / 160;
      dots.forEach(d => {
        d.x += vx; d.y += d.vy;
        if (d.stage === 0 && d.x > xs[1] + 4) { d.stage = 1; if (!pass(d.m, st.q1)) d.vy = (Math.random() < .5 ? -1 : 1) * (1.5 + Math.random()); }
        if (d.stage === 1 && d.x > xs[2] + 14) {
          d.stage = 2;
          if (!d.vy && m.q2 === "CID" && Math.random() < 0.85) { const fr = d.cmp.fr, tot = fr.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot; for (const [mm, w] of fr) { r -= w; if (r <= 0) { d.m = mm; break; } } d.r = 3; d.y += (Math.random() - .5) * 18; }
        }
        if (d.stage === 2 && d.x > xs[2] + 30 && !d.vy) d.y += (cy - d.y) * 0.08; // RF-only focusing in q2
        if (d.stage === 2 && d.x > xs[3] + 14) { d.stage = 3; if (!d.vy && st.q3 != null && !pass(d.m, st.q3)) d.vy = (Math.random() < .5 ? -1 : 1) * (1.5 + Math.random()); }
        if (Math.abs(d.y - cy) > 34) d.a -= 0.08;
      });
      dots = dots.filter(d => d.a > 0 && d.x < xs[4] + 8);
      dots.forEach(d => { ctx.globalAlpha = Math.max(0, d.a); ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    function drawOut(st) {
      if (mode === "mrm") {
        const ax = TP.axes(c2, { x0: 4, x1: 12, y0: 0, y1: 110, xl: "tempo di ritenzione (min)", yl: "intensità", yfmt: () => "" });
        const g = (t, mu, s, h) => h * Math.exp(-0.5 * Math.pow((t - mu) / s, 2));
        const ts = []; for (let t = 4; t <= 12; t += 0.02) ts.push(t);
        const prog = 4 + 8 * st.f;
        const A = ts.filter(t => t <= prog);
        TP.line(ax, A, A.map(t => g(t, 9.3, 0.12, 100) + 0.6 * Math.random()), col(1), 1.8);
        TP.line(ax, A, A.map(t => g(t, 7.1, 0.12, 38) + 0.6 * Math.random()), col(2), 1.8);
        TP.legend(ax, [["250→208 (parent X)", col(1)], ["266→224 (TP +O)", col(2)]]);
        return;
      }
      const lo = 80, hi = 280, ax = TP.axes(c2, { x0: lo, x1: hi, y0: 0, y1: 115, xl: MODES[mode].x, yl: "intensità", yfmt: () => "" });
      const xs = [], ys = []; for (let s = lo; s <= Math.min(hi, st.rec); s += 0.1) { xs.push(s); ys.push(signal(s)); }
      TP.line(ax, xs, ys, col(1), 1.6);
      const all = []; for (let s = lo; s <= hi; s += 1) { const y = signal(s); if (y > 3 && s <= st.rec) all.push([s, y]); }
      all.forEach(([s, y]) => TP.label(ax, s, y, String(Math.round(s)), "#24231f"));
      ax.ctx.strokeStyle = "#c2410c"; ax.ctx.setLineDash([3, 3]); ax.ctx.beginPath(); ax.ctx.moveTo(ax.X(st.rec), ax.m.t); ax.ctx.lineTo(ax.X(st.rec), ax.H - ax.m.b); ax.ctx.stroke(); ax.ctx.setLineDash([]);
    }
    function loop() {
      raf = null;
      const t = paused ? tFrozen : (performance.now() - t0) / 1000, st = setting(t);
      drawInstr(st, t); drawOut(st);
      out.innerHTML = `<b>${MODES[mode].t}</b>. ${MODES[mode].info} <br><span style="color:var(--muted)">Miscela fittizia: ${MIX.map(x => `<span style="color:${x.c}">●</span> ${x.n} (m/z ${x.mz})`).join(", ")}.</span>`;
      if (!paused) raf = requestAnimationFrame(loop);
    }
    if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !raf) loop(); if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; } })).observe(sm);
    else loop();
    c.onresize = c2.onresize = () => {};
  }

  // ------------------------------------------------------------ 2) collision energy
  const ce = document.getElementById("sim-ce");
  if (ce) {
    const v = TP.controls(ce, [
      { id: "ce", label: "Energia di collisione CE", min: 5, max: 60, step: 1, value: 25, unit: "eV", fmt: x => x },
      { id: "mz", label: "m/z del precursore (z = 1)", min: 100, max: 800, step: 1, value: 250, fmt: x => x },
      { id: "gas", label: "Gas di collisione", value: 28, options: [[28, "N₂ (28 Da)"], [40, "Ar (40 Da)"], [4, "He (4 Da)"]] },
    ], () => draw());
    const wrap = document.createElement("div"); wrap.className = "grid2"; ce.appendChild(wrap);
    const L = document.createElement("div"), R = document.createElement("div"); wrap.append(L, R);
    const c1 = TP.canvas(L, 260), c2 = TP.canvas(R, 260);
    const out = document.createElement("div"); out.className = "readout"; ce.appendChild(out);
    // illustrative consecutive fragmentation: P -> F1 (208) -> F2 (180) -> F3 (152); thresholds scale with E_cm
    function breakdown(ecm) {
      const s = (x, x0, w) => 1 / (1 + Math.exp(-(x - x0) / w));
      const p1 = s(ecm, 1.6, 0.35), p2 = s(ecm, 2.9, 0.45), p3 = s(ecm, 4.3, 0.6);
      return { P: 1 - p1, F1: p1 * (1 - p2), F2: p1 * p2 * (1 - p3), F3: p1 * p2 * p3 };
    }
    function draw() {
      const ecm = v.ce * v.gas / (v.gas + v.mz);
      const xs = [], Y = { P: [], F1: [], F2: [], F3: [] };
      for (let e = 0; e <= 60; e += 0.5) { xs.push(e); const b = breakdown(e * v.gas / (v.gas + v.mz)); Object.keys(Y).forEach(k => Y[k].push(100 * b[k])); }
      const ax = TP.axes(c1, { x0: 0, x1: 60, y0: 0, y1: 105, xl: "CE (eV, sistema del laboratorio)", yl: "% della corrente ionica" });
      const cs = { P: col(1), F1: col(2), F2: col(3), F3: col(4) };
      Object.keys(Y).forEach(k => TP.line(ax, xs, Y[k], cs[k], 2));
      TP.line(ax, [v.ce, v.ce], [0, 105], "#24231f", 1, [4, 4]);
      TP.legend(ax, [["precursore", cs.P], ["F1", cs.F1], ["F2", cs.F2], ["F3", cs.F3]], ax.m.l + 150);
      const b = breakdown(ecm), M = [[v.mz, b.P, cs.P], [v.mz - 42, b.F1, cs.F1], [v.mz - 70, b.F2, cs.F2], [v.mz - 98, b.F3, cs.F3]];
      const top = Math.max(...M.map(x => x[1]));
      const ax2 = TP.axes(c2, { x0: v.mz - 120, x1: v.mz + 15, y0: 0, y1: 115, xl: "m/z (spettro MS2 a questa CE)", yl: "intensità relativa (%)" });
      M.forEach(([m, y, cc]) => { TP.sticks(ax2, [m], [100 * y / top], cc, 4); TP.label(ax2, m, 100 * y / top, String(m), "#24231f"); });
      out.innerHTML = `Energia nel centro di massa per un singolo urto: E<sub>cm</sub> = CE · m<sub>gas</sub>/(m<sub>gas</sub> + m<sub>ione</sub>) = <b>${TP.fmt(ecm, 2)} eV</b> ` +
        `(${TP.fmt(100 * v.gas / (v.gas + v.mz), 1)} % della CE). Lo ione subisce decine di urti nella cella: l'energia interna si accumula a gradini. ` +
        `Curva di breakdown illustrativa (F1 = perdita di 42, F2 = −70, F3 = −98), con soglie espresse in E<sub>cm</sub>: cambiando gas o massa del precursore la stessa CE produce frammentazioni diverse.`;
    }
    draw();
  }

  // ------------------------------------------------------------ 3) MRM timing
  const tm = document.getElementById("sim-dwell");
  if (tm) {
    const v = TP.controls(tm, [
      { id: "n", label: "Transizioni MRM nello stesso periodo", min: 1, max: 60, step: 1, value: 2, fmt: x => x },
      { id: "dw", label: "Dwell time per transizione", min: 5, max: 500, step: 5, value: 100, unit: "ms", fmt: x => x },
      { id: "pw", label: "Larghezza del picco cromatografico (base)", min: 4, max: 40, step: 1, value: 15, unit: "s", fmt: x => x },
      { id: "fs", label: "Full scan: intervallo m/z (da 100 a…)", min: 200, max: 1000, step: 10, value: 400, fmt: x => "100–" + x },
      { id: "st", label: "Full scan: tempo di scansione", min: 0.2, max: 3, step: 0.1, value: 1, unit: "s", fmt: x => TP.fmt(x, 1) },
    ], () => draw());
    const out = document.createElement("div"); out.className = "readout"; tm.appendChild(out);
    const PAUSE = 5; // ms between transitions (typical)
    function draw() {
      const cyc = v.n * (v.dw + PAUSE) / 1000, pts = v.pw / cyc, duty = v.dw / 1000 / cyc;
      const perUnit = 1 / (v.fs - 100); // fraction of the scan time spent on one nominal mass (~1 Da window)
      const gain = duty / perUnit;      // time on the ion, MRM vs full scan
      const ptsFs = v.pw / v.st;
      out.innerHTML = `<b>MRM</b>: ciclo = ${v.n} × (${v.dw} + ${PAUSE}) ms = <b>${TP.fmt(cyc, 2)} s</b> → <b class="${pts >= 10 ? "ok" : "bad"}">${TP.fmt(pts, 1)} punti per picco</b> ${pts >= 10 ? "(sufficienti)" : "(troppo pochi: riducete dwell o transizioni, o usate MRM programmato)"}; ogni transizione è osservata per il ${TP.fmt(100 * duty, 1)} % del tempo.<br>` +
        `<b>Full scan</b> 100–${v.fs} in ${TP.fmt(v.st, 1)} s: ${TP.fmt(ptsFs, 1)} punti per picco; ogni unità di massa è osservata per circa il <b>${TP.fmt(100 * perUnit, 2)} %</b> del tempo (${TP.fmt(v.st * perUnit * 1000, 1)} ms per scansione). ` +
        `A parità di durata della corsa, una transizione MRM conta circa <b>${TP.fmt(gain, 0)}×</b> più ioni di quanti il full scan ne conti per lo stesso m/z, e in più la doppia selezione elimina quasi tutto il rumore chimico.`;
    }
    draw();
  }
});
