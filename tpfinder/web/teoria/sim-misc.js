/* QqQ lab - Teoria: small interactive figures (kinetics, isotope patterns, mean free path).
   Each block initialises only if its container exists on the page. */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const C = getComputedStyle(document.documentElement);
  const col = n => C.getPropertyValue("--c" + n).trim();

  // ------------------------------------------------------------ kinetics A -> B -> C -> D
  const kin = document.getElementById("sim-kin");
  if (kin) {
    const T = [0, 5, 10, 15, 30, 45, 60];
    let mode = "lin";
    TP.buttons(kin, [["lin", "Concentrazioni"], ["ln", "ln(C₀/C) del parent"]], "lin", k => { mode = k; draw(); });
    const v = TP.controls(kin, [
      { id: "k1", label: "k₁ (A → B)", min: 0.005, max: 0.3, step: 0.005, value: 0.06, unit: "min⁻¹", fmt: x => TP.fmt(x, 3) },
      { id: "k2", label: "k₂ (B → C)", min: 0.005, max: 0.3, step: 0.005, value: 0.04, unit: "min⁻¹", fmt: x => TP.fmt(x, 3) },
      { id: "k3", label: "k₃ (C → D, mineralizzazione)", min: 0, max: 0.3, step: 0.005, value: 0.02, unit: "min⁻¹", fmt: x => TP.fmt(x, 3) },
    ], () => draw());
    const c = TP.canvas(kin, 300); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; kin.appendChild(out);
    function sim(k1, k2, k3) {
      const n = 1200, dt = 60 / n, t = [], A = [], B = [], Cc = [], D = [];
      let a = 1, b = 0, cc = 0, d = 0;
      for (let i = 0; i <= n; i++) {
        t.push(i * dt); A.push(a); B.push(b); Cc.push(cc); D.push(d);
        // exact exponential step for A, RK2 for the rest (dt small)
        const f = (a, b, cc) => [-k1 * a, k1 * a - k2 * b, k2 * b - k3 * cc, k3 * cc];
        const s1 = f(a, b, cc), s2 = f(a + s1[0] * dt, b + s1[1] * dt, cc + s1[2] * dt);
        a += (s1[0] + s2[0]) / 2 * dt; b += (s1[1] + s2[1]) / 2 * dt; cc += (s1[2] + s2[2]) / 2 * dt; d += (s1[3] + s2[3]) / 2 * dt;
      }
      return { t, A, B, C: Cc, D };
    }
    function draw() {
      const s = sim(v.k1, v.k2, v.k3);
      if (mode === "lin") {
        const ax = TP.axes(c, { x0: 0, x1: 60, y0: 0, y1: 1.02, xl: "tempo di irraggiamento (min)", yl: "C / [A]₀", xticks: [0, 5, 10, 15, 30, 45, 60] });
        const ser = [["A parent", s.A, col(1)], ["B TP 1ª gen.", s.B, col(2)], ["C TP 2ª gen.", s.C, col(3)], ["D (CO₂, ioni)", s.D, "#9b978c"]];
        ser.forEach(([, y, k], i) => TP.line(ax, s.t, y, k, 2.2, i === 3 ? [5, 4] : null));
        ser.slice(0, 3).forEach(([, y, k]) => T.forEach(tt => { const i = Math.round(tt / 60 * (s.t.length - 1)); ax.ctx.fillStyle = k; ax.ctx.beginPath(); ax.ctx.arc(ax.X(tt), ax.Y(y[i]), 4, 0, 7); ax.ctx.fill(); }));
        TP.legend(ax, ser.map(([n, , k], i) => [n, k, i === 3 ? [5, 4] : null]), ax.m.l + 260);
      } else {
        const y = s.A.map(a => Math.log(1 / a)), ymax = Math.max(1, y[y.length - 1] * 1.05);
        const ax = TP.axes(c, { x0: 0, x1: 60, y0: 0, y1: ymax, xl: "tempo di irraggiamento (min)", yl: "ln(C₀/C)", xticks: [0, 5, 10, 15, 30, 45, 60], yfmt: x => TP.fmt(x, 1) });
        TP.line(ax, s.t, y, col(1), 2.2);
        T.forEach(tt => { ax.ctx.fillStyle = col(1); ax.ctx.beginPath(); ax.ctx.arc(ax.X(tt), ax.Y(v.k1 * tt), 4, 0, 7); ax.ctx.fill(); });
        TP.label(ax, 40, v.k1 * 40, "pendenza = k₁ = kₐₚₚ", col(1), "right", "bottom", -8);
      }
      const k1 = v.k1, k2 = v.k2, tmax = Math.abs(k2 - k1) < 1e-9 ? 1 / k1 : Math.log(k2 / k1) / (k2 - k1);
      const bmax = Math.max(...s.B);
      out.innerHTML = `Parent: t<sub>1/2</sub> = <b>${TP.fmt(Math.LN2 / k1, 1)} min</b>, residuo a 60 min = <b>${TP.fmt(100 * s.A[s.A.length - 1], 1)} %</b> · ` +
        `TP B: massimo a <b>${TP.fmt(tmax, 1)} min</b> (${TP.fmt(100 * bmax, 0)} % di [A]₀)` + (tmax > 60 ? " <span class='bad'>oltre l'ultimo prelievo</span>" : "");
    }
    draw();
  }

  // ------------------------------------------------------------ isotope pattern at unit resolution
  const iso = document.getElementById("sim-iso");
  if (iso) {
    // nominal mass, abundance (IUPAC representative values) and monoisotopic exact mass
    const E = {
      H: [[1, .999885], [2, .000115]], C: [[12, .9893], [13, .0107]], N: [[14, .99636], [15, .00364]],
      O: [[16, .99757], [17, .00038], [18, .00205]], S: [[32, .9499], [33, .0075], [34, .0425], [36, .0001]],
      Cl: [[35, .7576], [37, .2424]], Br: [[79, .5069], [81, .4931]], F: [[19, 1]], P: [[31, 1]], I: [[127, 1]],
      Si: [[28, .92223], [29, .04685], [30, .03092]], Na: [[23, 1]], K: [[39, .932581], [41, .067302]]
    };
    const MONO = { H: 1.00782503, C: 12, N: 14.00307401, O: 15.99491462, S: 31.97207117, Cl: 34.96885268, Br: 78.9183371, F: 18.99840316, P: 30.97376199, I: 126.904473, Si: 27.97692653, Na: 22.98976928, K: 38.96370649 };
    const PROTON = 1.00727646688, ELECTRON = 0.00054858;
    const v = TP.controls(iso, [
      { id: "f", label: "Formula bruta (neutra)", text: true, value: "C8H14ClN5" },
      { id: "ion", label: "Specie", value: "H", num: false, options: [["M", "M (neutra)"], ["H", "[M+H]⁺"], ["Na", "[M+Na]⁺"], ["NH4", "[M+NH₄]⁺"]] },
    ], () => draw());
    const c = TP.canvas(iso, 230); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; iso.appendChild(out);
    function parse(f) {
      const s = f.replace(/\s+/g, ""); if (!s) throw new Error("formula vuota");
      const re = /([A-Z][a-z]?)(\d*)/g; let m, pos = 0; const cnt = {};
      while ((m = re.exec(s)) !== null) {
        if (m.index !== pos) throw new Error("carattere non valido vicino a «" + s.slice(pos, m.index + 1) + "»");
        if (!E[m[1]]) throw new Error("elemento non gestito: " + m[1]);
        cnt[m[1]] = (cnt[m[1]] || 0) + (m[2] ? +m[2] : 1); pos = re.lastIndex;
      }
      if (pos !== s.length) throw new Error("formula non valida");
      return cnt;
    }
    function pattern(cnt) {
      let dist = new Map([[0, 1]]);
      for (const [el, n] of Object.entries(cnt)) for (let k = 0; k < n; k++) {
        const nd = new Map();
        dist.forEach((p, m) => E[el].forEach(([mm, a]) => { const key = m + mm; nd.set(key, (nd.get(key) || 0) + p * a); }));
        nd.forEach((p, m) => { if (p < 1e-7) nd.delete(m); }); dist = nd;
      }
      return [...dist.entries()].sort((a, b) => a[0] - b[0]);
    }
    function draw() {
      let cnt;
      try { cnt = parse(v.f); } catch (e) { out.innerHTML = `<span class="bad">${e.message}</span>`; c.ctx.clearRect(0, 0, c.W, c.H); return; }
      const ion = { ...cnt }, add = { M: {}, H: { H: 1 }, Na: { Na: 1 }, NH4: { N: 1, H: 4 } }[v.ion];
      Object.entries(add).forEach(([e, n]) => ion[e] = (ion[e] || 0) + n);
      const pat = pattern(ion), top = Math.max(...pat.map(p => p[1]));
      const mono = Object.entries(ion).reduce((s, [e, n]) => s + MONO[e] * n, 0) - (v.ion === "M" ? 0 : ELECTRON);
      const nom0 = pat[0][0], shown = pat.filter(p => p[1] / top > 0.0005).slice(0, 8);
      const ax = TP.axes(c, { x0: nom0 - 1.5, x1: nom0 + Math.max(5, shown.length) + 0.5, y0: 0, y1: 110, xl: v.ion === "M" ? "massa nominale" : "m/z (nominale)", yl: "intensità relativa (%)", xticks: shown.map(p => p[0]).concat([]) });
      TP.sticks(ax, shown.map(p => p[0]), shown.map(p => 100 * p[1] / top), col(1), 7);
      shown.forEach(p => TP.label(ax, p[0], 100 * p[1] / top, TP.fmt(100 * p[1] / top, 1), "#24231f"));
      const nC = cnt.C || 0, nH = cnt.H || 0, nN = cnt.N || 0, nX = (cnt.Cl || 0) + (cnt.Br || 0) + (cnt.F || 0) + (cnt.I || 0);
      const rdbe = nC - (nH + nX) / 2 + nN / 2 + 1 + (cnt.P || 0) / 2 + (cnt.Si || 0);
      const neutralNom = Object.entries(cnt).reduce((s, [e, n]) => s + E[e][0][0] * n, 0);
      out.innerHTML = `Monoisotopico: <b>${TP.fmt(mono, 4)}</b> ${v.ion === "M" ? "Da" : "(m/z esatto)"}; con risoluzione unitaria leggete <b>${nom0}</b> (circa ${TP.fmt(mono, 1)}). ` +
        `RDBE = <b>${TP.fmt(rdbe, 1)}</b>${Number.isInteger(rdbe) ? "" : " (non intero: formula di un radicale o errata)"} · ` +
        `Regola dell'azoto: massa nominale della neutra <b>${neutralNom}</b> ${neutralNom % 2 ? "dispari" : "pari"}, N = <b>${nN}</b> ${(neutralNom % 2) === (nN % 2) ? "<span class='ok'>coerente</span>" : "<span class='bad'>incoerente</span>"}.`;
    }
    draw();
  }

  // ------------------------------------------------------------ mean free path
  const mfp = document.getElementById("sim-mfp");
  if (mfp) {
    const k = 1.380649e-23, d = 0.37e-9, T0 = 298;
    const L = p => k * T0 / (Math.SQRT2 * Math.PI * d * d * p * 133.322); // p in Torr -> lambda in m
    const v = TP.controls(mfp, [{ id: "lp", label: "Pressione", min: -6, max: Math.log10(760), step: 0.05, value: -5, fmt: x => TP.sci(Math.pow(10, x), 1) + " Torr" }], () => draw());
    const c = TP.canvas(mfp, 250); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; mfp.appendChild(out);
    const marks = [[760, "sorgente (atmosfera)"], [1, "dopo l'orifizio (≈ Torr)"], [8e-3, "Q0 / cella di collisione (mTorr)"], [1e-5, "Q1 e Q3 (≈ 10⁻⁵ Torr)"]];
    function draw() {
      const ps = [], ls = []; for (let e = -6; e <= Math.log10(760) + 1e-9; e += 0.05) { ps.push(e); ls.push(L(Math.pow(10, e))); }
      const ax = TP.axes(c, { x0: -6, x1: 3, y0: 1e-8, y1: 100, logy: true, xl: "log₁₀ pressione (Torr)", yl: "libero cammino medio (m)", xticks: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3], m: { l: 62 } });
      TP.line(ax, ps, ls, col(1), 2.4);
      [[0.2, "lunghezza di un quadrupolo (≈ 20 cm)"], [1e-6, "1 µm"]].forEach(([y, t]) => { TP.line(ax, [-6, 3], [y, y], "#9b978c", 1, [4, 4]); TP.label(ax, 2.9, y, t, "#6b675c", "right"); });
      marks.forEach(([p, t]) => { const x = Math.log10(p); ax.ctx.fillStyle = col(2); ax.ctx.beginPath(); ax.ctx.arc(ax.X(x), ax.Y(L(p)), 4.5, 0, 7); ax.ctx.fill(); });
      const p = Math.pow(10, v.lp), l = L(p);
      ax.ctx.fillStyle = col(4); ax.ctx.beginPath(); ax.ctx.arc(ax.X(v.lp), ax.Y(l), 6, 0, 7); ax.ctx.fill();
      const nColl = 0.2 / l;
      out.innerHTML = `A ${TP.sci(p, 1)} Torr il libero cammino medio di N<sub>2</sub> (25 °C) è <b>${l >= 1e-3 ? TP.fmt(l * 100, 2) + " cm" : l >= 1e-6 ? TP.fmt(l * 1e6, 2) + " µm" : TP.fmt(l * 1e9, 0) + " nm"}</b>: ` +
        `in 20 cm uno ione subisce in media circa <b>${nColl < 1 ? TP.fmt(nColl, 3) : nColl < 1e4 ? TP.fmt(nColl, 0) : TP.sci(nColl, 1)}</b> urti. Punti arancioni: ${marks.map(m => m[1]).join("; ")}.`;
    }
    draw();
  }

  // ------------------------------------------------------------ mass differences (TP hypotheses)
  const dmb = document.getElementById("sim-dm");
  if (dmb) {
    // [label, exact mass change (Da)]
    const TR = [
      ["+O (idrossilazione, N-ossido, solfossido)", 15.99491], ["+2O", 31.98983], ["+O −2H (CH₂ → C=O)", 13.97926],
      ["−2H (deidrogenazione)", -2.01565], ["+2H (riduzione)", 2.01565], ["−CH₂ (demetilazione)", -14.01565],
      ["−C₂H₄ (deetilazione)", -28.03130], ["−C₃H₆ (deisopropilazione)", -42.04695], ["−CO", -27.99491],
      ["−CO₂ (decarbossilazione)", -43.98983], ["+H₂O (idratazione)", 18.01056], ["−H₂O (disidratazione)", -18.01056],
      ["−Cl +OH (declorurazione idrossilativa)", -17.96611], ["−Cl +H (declorurazione riduttiva)", -33.96103], ["−Br +OH", -61.91600],
      ["−F +OH", -1.99566], ["−NO₂ +OH", -28.99016], ["−NH₂ +OH (deamminazione)", 0.98402], 
      ["−C₂H₂O (deacetilazione)", -42.01056], ["−SO₃ / −HSO₃ (desolfonazione)", -79.95682],
    ].filter((t, i, a) => a.findIndex(u => u[1] === t[1]) === i);
    const v = TP.controls(dmb, [
      { id: "p", label: "m/z del parent", text: true, value: "216.1" },
      { id: "c", label: "m/z del candidato", text: true, value: "188.1" },
    ], () => draw());
    const out = document.createElement("div"); out.className = "readout"; dmb.appendChild(out);
    function draw() {
      const p = parseFloat(String(v.p).replace(",", ".")), c = parseFloat(String(v.c).replace(",", "."));
      if (!isFinite(p) || !isFinite(c)) { out.innerHTML = "<span class='bad'>Inserite due numeri.</span>"; return; }
      const d = c - p, dn = Math.round(d);
      const hits = [];
      TR.forEach(t => { if (Math.round(t[1]) === dn) hits.push([t[0], t[1]]); });
      TR.forEach((a, i) => TR.forEach((b, j) => { if (j >= i && Math.round(a[1] + b[1]) === dn && Math.round(a[1]) !== 0 && Math.round(b[1]) !== 0) hits.push([a[0] + "  e  " + b[0], a[1] + b[1]]); }));
      const parity = (Math.round(p) % 2) === (Math.round(c) % 2);
      out.innerHTML = `Δ = <b>${d >= 0 ? "+" : ""}${TP.fmt(d, 2)}</b> (nominale ${dn >= 0 ? "+" : ""}${dn}). ` +
        `Parità dell'm/z ${parity ? "uguale: numero di N con la stessa parità" : "<b>diversa</b>: è cambiato di un numero dispari il numero di atomi di N"}.<br>` +
        (hits.length ? `Trasformazioni compatibili (${hits.length}):<ul style="margin:4px 0 0 18px;padding:0">` + hits.slice(0, 14).map(h => `<li>${h[0]} <span style="color:var(--muted)">(Δ esatta ${h[1] >= 0 ? "+" : ""}${TP.fmt(h[1], 4)})</span></li>`).join("") + "</ul>" +
        (hits.length > 1 ? `<span style="color:var(--muted)">Differenze esatte diverse ma stessa massa nominale: con risoluzione unitaria non si distinguono. Decidono la chimica del parent, gli isotopi, l'RT e l'MS2.</span>` : "")
        : "Nessuna trasformazione semplice (o coppia) in elenco: può essere un'idrolisi con rottura della molecola, un addotto diverso o un segnale non correlato.");
    }
    draw();
  }
});
