/* QqQ lab - Teoria: electron ionization and chemical ionization (chapter 7).
   1) ionization efficiency against electron energy, with the de Broglie wavelength of the electron;
   2) internal energy deposited by EI and competition of three fragmentation channels (RRK model) -> spectrum of a model ketone;
   3) chemical ionization: proton transfer from the reagent ion, exothermicity from proton affinities.
   Illustrative models with real orders of magnitude; every readout says so. */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue("--c" + n).trim();
  const IE = 9.35;   // ionization energy of 2-hexanone (eV)
  // relative ionization cross section: zero below IE, maximum around 70-90 eV, slow decline (shape of the classic curve)
  const sigma = e => e <= IE ? 0 : Math.pow(1 - IE / e, 1.6) * Math.exp(-e / 260) * 1.9;
  const lambda = e => 1.226 / Math.sqrt(e);          // de Broglie wavelength of an electron, nm (non relativistic)

  // ------------------------------------------------------------ 1) ionization efficiency curve
  const ie = document.getElementById("sim-ei-eff");
  if (ie) {
    const v = TP.controls(ie, [{ id: "e", label: "Energia degli elettroni", min: 5, max: 200, step: 1, value: 70, unit: "eV" }], () => draw());
    const c = TP.canvas(ie, 240); c.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; ie.appendChild(out);
    function draw() {
      const xs = []; for (let e = 5; e <= 200; e += 0.5) xs.push(e);
      const top = Math.max(...xs.map(sigma));
      const ax = TP.axes(c, { x0: 0, x1: 200, y0: 0, y1: 1.1, xl: "energia degli elettroni (eV)", yl: "efficienza relativa", yfmt: x => TP.fmt(x, 1) });
      ax.clip();
      ax.ctx.fillStyle = "rgba(4,120,87,.08)"; ax.ctx.fillRect(ax.X(50), ax.m.t, ax.X(100) - ax.X(50), ax.H - ax.m.t - ax.m.b);
      TP.line(ax, xs, xs.map(e => sigma(e) / top), col(1), 2.4);
      TP.line(ax, [v.e, v.e], [0, 1.1], "#24231f", 1, [3, 3]);
      ax.ctx.restore();
      TP.label(ax, 75, 0.12, "plateau: spettri riproducibili", col(3));
      const l = lambda(v.e) * 10;
      out.innerHTML = `A ${v.e} eV: efficienza relativa <b>${TP.fmt(sigma(v.e) / top * 100, 0)}%</b>, lunghezza d'onda dell'elettrone λ = h/(m<sub>e</sub>v) = <b>${TP.fmt(l, 2)} Å</b> ` +
        (v.e < IE ? `<span class="bad">sotto l'energia di ionizzazione (${TP.fmt(IE, 2)} eV del 2-esanone): nessuno ione.</span>` :
          v.e < 30 ? "(EI a bassa energia: meno ioni, meno frammenti, M+• più intenso)." : v.e <= 100 ? "(confrontabile con le lunghezze dei legami, 1-2 Å: trasferimento di energia massimo)." : "(troppo corta: la molecola diventa «trasparente» all'elettrone).") +
        " <i>Forma della curva illustrativa.</i>";
    }
    draw();
  }

  // ------------------------------------------------------------ 2) internal energy and fragmentation of a model ketone
  const fr = document.getElementById("sim-ei-frag");
  if (fr) {
    // 2-hexanone, M = 100. Channels (illustrative RRK parameters, tuned so that the 70 eV spectrum looks like the real one: 43 > 58 > M ~ 85):
    // McLafferty (tight TS, low threshold), two alpha cleavages (loose TS; the larger radical is lost faster)
    const CH = [
      { mz: 58, name: "McLafferty (−C₃H₆)", E0: 0.7, nu: 1e11, c: 4 },
      { mz: 43, name: "α, −C₄H₉• (acilio CH₃CO⁺)", E0: 1.4, nu: 1e13, c: 2 },
      { mz: 85, name: "α, −CH₃•", E0: 1.65, nu: 1e12, c: 3 },
    ];
    const v = TP.controls(fr, [
      { id: "e", label: "Energia degli elettroni", min: 10, max: 100, step: 0.5, value: 70, unit: "eV" },
      { id: "s", label: "Oscillatori efficaci s (dimensione della molecola)", min: 8, max: 40, step: 1, value: 14 },
    ], () => draw());
    const g = document.createElement("div"); g.className = "grid2"; fr.appendChild(g);
    const a = document.createElement("div"), b = document.createElement("div"); g.appendChild(a); g.appendChild(b);
    const c1 = TP.canvas(a, 240), c2 = TP.canvas(b, 240); c1.onresize = c2.onresize = draw;
    const out = document.createElement("div"); out.className = "readout"; fr.appendChild(out);
    const TAU = 1e-6;   // time the ion spends in the source before it is extracted (s)
    const k = (E, ch, s) => E <= ch.E0 ? 0 : ch.nu * Math.pow((E - ch.E0) / E, s - 1);
    function draw() {
      const emax = Math.max(0, v.e - IE), Es = [], P = [];
      for (let E = 0.02; E <= 12; E += 0.02) { Es.push(E); P.push(E < emax ? Math.sqrt(E) * Math.exp(-E / 4) * Math.pow(1 - E / Math.max(emax, 1e-9), emax > 25 ? 0 : 1.2) : 0); }
      const tot = P.reduce((x, y) => x + y, 0) || 1;
      const ax = TP.axes(c1, { x0: 0, x1: 8, y0: 0, y1: 1.05, xl: "energia interna dello ione (eV)", yl: "P(E)", yfmt: () => "" });
      const pmax = Math.max(...P, 1e-12);
      ax.clip();
      CH.forEach(ch => TP.line(ax, [ch.E0, ch.E0], [0, 1.05], col(ch.c), 1.2, [4, 3]));
      TP.line(ax, Es, P.map(p => p / pmax), col(1), 2.4);
      ax.ctx.restore();
      CH.forEach((ch, i) => TP.label(ax, ch.E0, 1.0 - i * 0.09, "soglia " + ch.mz, col(ch.c), "left", "bottom", -2));
      // fate of the ions: survive as M if no reaction within TAU, otherwise branch according to k_i
      const y = { 100: 0, 58: 0, 43: 0, 85: 0 };
      Es.forEach((E, i) => {
        const w = P[i] / tot, ks = CH.map(ch => k(E, ch, v.s)), kt = ks.reduce((x, z) => x + z, 0);
        const f = 1 - Math.exp(-kt * TAU);
        y[100] += w * (1 - f);
        CH.forEach((ch, j) => { if (kt > 0) y[ch.mz] += w * f * ks[j] / kt; });
      });
      const base = Math.max(...Object.values(y)) || 1;
      const mzs = [43, 58, 85, 100], ys = mzs.map(m => y[m] / base * 100);
      const bx = TP.axes(c2, { x0: 30, x1: 110, y0: 0, y1: 110, xl: "m/z", yl: "intensità relativa (%)" });
      TP.sticks(bx, mzs, ys, col(1), 5);
      mzs.forEach((m, i) => TP.label(bx, m, ys[i], String(m)));
      out.innerHTML = `Energia massima depositata: ${TP.fmt(Math.min(emax, 99), 1)} eV. Ioni che restano M<sup>+•</sup> (m/z 100) entro ${TAU * 1e6} µs: ` +
        `<b>${TP.fmt(y[100] * 100, 0)}%</b>; picco base m/z ${mzs[ys.indexOf(100)]}. ` +
        (v.e < 16 ? "A bassa energia passa per prima la reazione con la soglia più bassa (il riarrangiamento) e M<sup>+•</sup> cresce. " : "A 70 eV la distribuzione è larga e il suo profilo non cambia più con l'energia: lo spettro è riproducibile. ") +
        "Le scissioni semplici (stato di transizione «lasco», ν grande) vincono ad alta energia, i riarrangiamenti (stato «stretto») a bassa. <i>Modello RRK illustrativo, parametri inventati ma plausibili.</i>";
    }
    draw();
  }

  // ------------------------------------------------------------ 3) chemical ionization: proton affinities
  const ci = document.getElementById("sim-ci");
  if (ci) {
    const GAS = [["ch4", "metano (CH₅⁺; PA del CH₄ = 543,5 kJ/mol)", 543.5], ["ib", "isobutano (t-C₄H₉⁺; PA dell'isobutene = 802,1)", 802.1], ["nh3", "ammoniaca (NH₄⁺; PA dell'NH₃ = 853,6)", 853.6]];
    const v = TP.controls(ci, [
      { id: "g", label: "Gas reagente", options: GAS.map(x => [x[0], x[1]]), value: "ch4", num: false },
      { id: "pa", label: "Affinità protonica dell'analita M", min: 650, max: 1000, step: 5, value: 830, unit: "kJ/mol" },
    ], () => draw());
    const out = document.createElement("div"); out.className = "readout"; ci.appendChild(out);
    function draw() {
      const gas = GAS.find(x => x[0] === v.g), dH = gas[2] - v.pa;      // reaction enthalpy of BH+ + M -> B + MH+
      let txt;
      if (dH < -150) txt = `<span class="bad">Molto esotermica</span>: [M+H]<sup>+</sup> nasce con ~${TP.fmt(-dH / 96.485, 1)} eV in eccesso, frammenta abbastanza (ma molto meno che in EI). Con il metano si vedono anche gli addotti [M+C<sub>2</sub>H<sub>5</sub>]<sup>+</sup> (M+29) e [M+C<sub>3</sub>H<sub>5</sub>]<sup>+</sup> (M+41), utili per confermare M.`;
      else if (dH < 0) txt = `<span class="ok">Esotermica di poco</span>: [M+H]<sup>+</sup> abbondante e quasi nessun frammento. È la condizione ideale per leggere la massa molecolare.`;
      else if (v.g === "nh3" && dH < 60) txt = `Il trasferimento di protone non avviene (endotermico di ${TP.fmt(dH, 0)} kJ/mol), ma l'NH<sub>4</sub><sup>+</sup> si lega: compare l'addotto <b>[M+NH<sub>4</sub>]<sup>+</sup></b> (M+18).`;
      else txt = `<span class="bad">Endotermica</span> di ${TP.fmt(dH, 0)} kJ/mol: nessuna protonazione, l'analita non si vede (selettività della CI: si «spengono» i composti meno basici del gas).`;
      out.innerHTML = `BH<sup>+</sup> + M → B + MH<sup>+</sup>: ΔH ≈ PA(B) − PA(M) = <b>${TP.fmt(dH, 0)}</b> kJ/mol. ` + txt +
        ` <i>Esempi di PA: acqua 691, metanolo 754, acetone 812, piridina 930 kJ/mol (NIST).</i>`;
    }
    draw();
  }
});
