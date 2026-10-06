// Calibration curve for the MRM files. Classic script loaded after explore.js: it uses its globals
// (E, Q, EH, big, dlx, IC_DL, getMrm, setup, axes, css, fmt, M, PAL). The student integrates the peaks in the MRM panel
// (drag over a peak: every file is integrated in the same window); this window lists the areas and fits the line.
// Nothing is decided for the student: the areas, the concentrations and the points kept in the fit are theirs.

const CAL = { w: "none", off: new Set(), quant: null, qual: null, trs: [] };

// areas of the MRM files: the last integration of each (file, transition), read from the MRM panels
function calAreas() {
  const out = {};
  E.panels.filter(p => p.type === "mrm").forEach(p => p.ints.forEach(i => {
    const [m, k] = String(i.key).split("|");
    if (m !== "m" || !Number.isFinite(+k) || i.area == null) return;
    (out[+k] = out[+k] || {})[i.ion] = i;
  }));
  return out;
}
// quantifier / qualifier: by the transition name (Quant, Qual) when the method gives it, otherwise the first and the second
function calPick() {
  const t = CAL.trs;
  if (!t.some(x => x.key === CAL.quant)) CAL.quant = (t.find(x => /quant/i.test(x.name)) || t[0] || {}).key || null;
  if (!t.some(x => x.key === CAL.qual) || CAL.qual === CAL.quant) CAL.qual = (t.find(x => /qual/i.test(x.name) && x.key !== CAL.quant) || t.find(x => x.key !== CAL.quant) || {}).key || null;
}
async function calLoad() {
  const mf = E.files.filter(f => f.kind === "mrm"), seen = new Map();
  (await Promise.all(mf.map(f => getMrm(f.k)))).forEach(tr => tr.forEach(t => { const key = `${t.q1}>${t.q3}`; if (!seen.has(key)) seen.set(key, { key, name: t.name || "" }); }));
  CAL.trs = [...seen.values()]; calPick();
}

// weighted least squares y = a x + b (w = 1, 1/x or 1/x^2); null with fewer than two different concentrations
function calFit(pts, wmode) {
  if (pts.length < 2 || new Set(pts.map(p => p.x)).size < 2) return null;
  const wt = x => wmode === "x" ? 1 / Math.max(x, 1e-12) : wmode === "x2" ? 1 / Math.max(x * x, 1e-24) : 1;
  const W = pts.map(p => wt(p.x)), sw = W.reduce((a, b) => a + b, 0);
  const mx = pts.reduce((a, p, i) => a + W[i] * p.x, 0) / sw, my = pts.reduce((a, p, i) => a + W[i] * p.y, 0) / sw;
  const sxx = pts.reduce((a, p, i) => a + W[i] * (p.x - mx) ** 2, 0), sxy = pts.reduce((a, p, i) => a + W[i] * (p.x - mx) * (p.y - my), 0);
  const a = sxy / sxx, b = my - a * mx;
  const ssr = pts.reduce((s, p, i) => s + W[i] * (p.y - (a * p.x + b)) ** 2, 0), sst = pts.reduce((s, p, i) => s + W[i] * (p.y - my) ** 2, 0);
  const r2 = sst > 0 ? 1 - ssr / sst : 1;
  const sy = pts.length > 2 ? Math.sqrt(pts.reduce((s, p) => s + (p.y - (a * p.x + b)) ** 2, 0) / (pts.length - 2)) : null;   // residual SD (unweighted)
  return { a, b, r2, n: pts.length, sy, lod: sy != null && a > 0 ? 3.3 * sy / a : null, loq: sy != null && a > 0 ? 10 * sy / a : null };
}
const calNum = v => v == null || !Number.isFinite(v) ? "" : String(+v.toPrecision(4)).replace(".", ",");

function calRows() {
  const ar = calAreas();
  return E.files.filter(f => f.kind === "mrm").map(f => {
    const q = (ar[f.k] || {})[CAL.quant], l = (ar[f.k] || {})[CAL.qual];
    return { f, type: f.type, conc: f.type === "standard" ? f.conc : null, aq: q ? q.area : null, al: l ? l.area : null, ratio: q && l && q.area > 0 ? l.area / q.area : null };
  }).sort((a, b) => ({ standard: 0, sample: 1, blank: 2 }[a.type] ?? 1) - ({ standard: 0, sample: 1, blank: 2 }[b.type] ?? 1)
    || (a.type === "standard" ? (a.conc ?? 1e9) - (b.conc ?? 1e9) : (a.f.time ?? 1e9) - (b.f.time ?? 1e9)));
}

// strip above the MRM panels: the three steps and how many standards already have an area
function calbar() {
  const bar = Q("#calbar"); if (!bar || bar.hidden) return;
  if (!CAL.trs.length) { if (!CAL.loading) { CAL.loading = true; calLoad().then(() => { bar._sig = null; calbar(); }).catch(() => {}).finally(() => { CAL.loading = false; }); } return; }
  const rows = calRows(), st = rows.filter(r => r.type === "standard"), done = st.filter(r => r.aq != null).length;
  const sig = `${st.length}|${done}|${rows.length}`; if (bar._sig === sig) return; bar._sig = sig;
  const unit = (st.find(r => r.f.cunit) || {}).f?.cunit || "";
  bar.innerHTML = `<b>Retta di taratura</b>
    <span class="st"><b>1</b> Nel grafico MRM trascina sul picco: tutti i file vengono integrati nella stessa finestra</span>
    <span class="st"><b>2</b> Controlla le aree (trascina le barre per correggere i bordi)</span>
    <span class="st"><b>3</b> <button class="go" id="calopen">Tabella e retta</button></span>
    <span class="muted">${st.length ? `${done}/${st.length} standard integrati${unit ? " · " + EH(unit) : ""}` : "nessun file è indicato come standard: puoi cambiarlo nella tabella dei file (Tipo)"}</span>`;
  Q("#calopen").onclick = () => openCalib();
}
// after every redraw of an MRM panel the strip is refreshed (areas change while the student moves the bars)
document.addEventListener("tpview", () => calbar());
setInterval(() => { if (Q("#calbar") && !Q("#calbar").hidden && !document.hidden) calbar(); }, 700);

async function openCalib() {
  await calLoad();
  const html = `<div class="cal-top bar"><label>Transizione quantificatrice <select id="cal-q"></select></label><label>qualificatrice <select id="cal-l"></select></label>
      <label>Pesi <select id="cal-w"><option value="none">nessuno</option><option value="x">1/x</option><option value="x2">1/x&sup2;</option></select></label>
      <label>Unità <input id="cal-u" style="width:70px"></label><span class="sp"></span><button id="cal-xlsx">${IC_DL}Excel</button></div>
    <div id="cal-eq" style="margin:4px 0"></div><canvas id="cal-cv"></canvas>
    <div id="cal-tab" style="overflow-x:auto;margin-top:6px"></div><div class="muted sm" id="cal-note"></div>`;
  big("Retta di taratura", html, () => {
    const sel = (id, cur, none) => { const el = Q(id); el.innerHTML = (none ? '<option value="">nessuna</option>' : "") + CAL.trs.map(t => `<option value="${EH(t.key)}" ${t.key === cur ? "selected" : ""}>${EH(t.key)} ${EH(t.name)}</option>`).join(""); };
    sel("#cal-q", CAL.quant); sel("#cal-l", CAL.qual, true); Q("#cal-w").value = CAL.w;
    const st0 = E.files.find(f => f.type === "standard" && f.cunit); Q("#cal-u").value = st0 ? st0.cunit : "mg/L";
    Q("#cal-q").onchange = e => { CAL.quant = e.target.value; calPick(); paint(); };
    Q("#cal-l").onchange = e => { CAL.qual = e.target.value || null; paint(); };
    Q("#cal-w").onchange = e => { CAL.w = e.target.value; paint(); };
    Q("#cal-u").onchange = e => { E.files.forEach(f => { if (f.type === "standard") f.cunit = e.target.value; }); uiSave(); paint(); };
    const unit = () => Q("#cal-u").value.trim() || "mg/L";
    let last = null;
    function paint() {
      const rows = calRows(), use = rows.filter(r => r.type === "standard" && r.conc != null && r.aq != null && !CAL.off.has(r.f.file));
      const fit = calFit(use.map(r => ({ x: r.conc, y: r.aq })), CAL.w), u = unit();
      const calc = a => fit && fit.a > 0 ? (a - fit.b) / fit.a : null;
      const smean = (() => { const v = use.filter(r => r.ratio != null).map(r => r.ratio); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
      const rng = use.length ? [Math.min(...use.map(r => r.conc)), Math.max(...use.map(r => r.conc))] : null;
      Q("#cal-eq").innerHTML = fit ? `<b>Area = ${calNum(fit.a)} &middot; C ${fit.b < 0 ? "&minus;" : "+"} ${calNum(Math.abs(fit.b))}</b> &nbsp; R&sup2; = ${fit.r2.toFixed(4)} &nbsp; n = ${fit.n} standard` +
        (fit.lod != null ? ` <span class="muted">&middot; LOD&asymp;${calNum(fit.lod)} ${EH(u)}, LOQ&asymp;${calNum(fit.loq)} ${EH(u)} (3,3 e 10 volte la deviazione standard dei residui diviso la pendenza: stima, non una validazione)</span>` : "")
        : `<span class="muted">Servono almeno due standard con concentrazione diversa e un'area (quantificatore). Integra i picchi nel grafico MRM e scrivi le concentrazioni nella tabella.</span>`;
      const tr = rows.map((r, i) => {
        const std = r.type === "standard", inFit = use.includes(r), cc = fit && r.aq != null ? calc(r.aq) : null;
        let rec = "", extra = "";
        if (std && cc != null && r.conc) rec = (100 * cc / r.conc).toFixed(0) + " %";
        if (!std && cc != null && rng) extra = r.type === "blank" ? "" : cc < rng[0] ? "sotto il punto più basso" : cc > rng[1] ? "sopra il punto più alto" : "";
        const dev = smean && r.ratio != null ? (r.ratio / smean - 1) * 100 : null;
        return `<tr class="${std && !inFit ? "off" : ""}"><td>${std ? `<input type="checkbox" data-use="${EH(r.f.file)}" ${CAL.off.has(r.f.file) ? "" : "checked"} title="Tieni questo punto nella retta">` : ""}</td>
          <td>${EH(r.f.label)}</td><td>${{ standard: "standard", sample: "campione" + (r.f.time != null ? ` (${r.f.time} min)` : ""), blank: "bianco" }[r.type] || r.type}</td>
          <td class="num">${std ? `<input type="number" step="any" min="0" data-conc="${EH(r.f.file)}" value="${r.conc ?? ""}">` : ""}</td>
          <td class="num">${r.aq != null ? fmt(r.aq) : '<span class="muted">non integrato</span>'}</td><td class="num">${r.al != null ? fmt(r.al) : CAL.qual ? '<span class="muted">non integrato</span>' : ""}</td>
          <td class="num ${dev != null && Math.abs(dev) > 30 ? "warn" : ""}" title="${dev != null ? "scostamento dalla media degli standard: " + dev.toFixed(0) + " %" : ""}">${r.ratio != null ? (100 * r.ratio).toFixed(0) + " %" : ""}</td>
          <td class="num">${cc != null && !std ? calNum(cc) + " " + EH(u) : ""}</td><td class="num">${rec}</td><td class="muted sm">${extra}</td></tr>`;
      }).join("");
      Q("#cal-tab").innerHTML = rows.length ? `<table class="cal-t"><tr><th></th><th>File</th><th>Tipo</th><th class="num">Conc. (${EH(u)})</th><th class="num">Area quant.</th><th class="num">Area qual.</th><th class="num" title="Area del qualificatore divisa per quella del quantificatore: in uno standard e in un campione con lo stesso composto deve essere simile">Qual/Quant</th><th class="num">Conc. dalla retta</th><th class="num" title="Concentrazione ricalcolata dalla retta divisa per quella nominale">Recupero</th><th></th></tr>${tr}</table>` : "";
      Q("#cal-note").textContent = "Area in conteggi per secondo, baseline lineare fra i due bordi. Un punto escluso resta nella tabella ma non entra nella retta. Il rapporto Qual/Quant evidenziato in rosso si discosta più del 30 % dalla media degli standard.";
      Q("#cal-tab").querySelectorAll("[data-use]").forEach(x => x.onchange = () => { x.checked ? CAL.off.delete(x.dataset.use) : CAL.off.add(x.dataset.use); paint(); });
      Q("#cal-tab").querySelectorAll("[data-conc]").forEach(x => x.onchange = () => { const f = E.files.find(q => q.file === x.dataset.conc); if (f) { f.conc = x.value === "" ? null : +x.value; f.cunit = unit(); uiSave(); renderFileList(); paint(); } });
      last = { rows, fit, u, use, calc };
      plot(rows, use, fit, u, calc);
    }
    function plot(rows, use, fit, u, calc) {
      const cv = Q("#cal-cv"), { g, W, H } = setup(cv), pts = rows.filter(r => r.type === "standard" && r.conc != null && r.aq != null);
      g.clearRect(0, 0, W, H);
      if (!pts.length) { g.fillStyle = css("--muted"); g.fillText("Nessun standard ha ancora un'area.", M.l, 30); return; }
      const smp = fit ? rows.filter(r => r.type === "sample" && r.aq != null && calc(r.aq) != null) : [];
      const xs = [...pts.map(r => r.conc), ...smp.map(r => calc(r.aq))], x1 = Math.max(...xs, 1e-9) * 1.08, x0 = Math.min(0, ...xs);
      const ym = Math.max(...pts.map(r => r.aq), ...smp.map(r => r.aq), fit ? fit.a * x1 + fit.b : 0, 1e-9) * 1.1;
      const { X, Y } = axes(g, W, H, x0, x1, ym, v => fmt(v), { xt: `Concentrazione (${u})`, yt: "Area (conteggi)" });
      if (fit) { g.strokeStyle = css("--accent"); g.lineWidth = 1.6; g.beginPath(); g.moveTo(X(x0), Y(fit.a * x0 + fit.b)); g.lineTo(X(x1), Y(fit.a * x1 + fit.b)); g.stroke(); }
      pts.forEach(r => { const on = use.includes(r); g.beginPath(); g.arc(X(r.conc), Y(r.aq), 4.5, 0, 7); g.lineWidth = 1.6; g.strokeStyle = on ? css("--accent") : css("--muted");
        if (on) { g.fillStyle = css("--accent"); g.fill(); } else { g.fillStyle = css("--panel"); g.fill(); g.stroke(); } });
      smp.forEach(r => { const x = X(calc(r.aq)), y = Y(r.aq); g.fillStyle = "#e6550d"; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.closePath(); g.fill(); });
      g.font = "11px system-ui"; g.fillStyle = css("--muted"); g.textAlign = "left"; g.fillText("● standard   ◆ campioni (sulla retta)", M.l + 8, M.t + 12);
    }
    Q("#cal-xlsx").onclick = () => {
      if (!last) return; const { rows, fit, u, calc } = last, T = { standard: "standard", sample: "campione", blank: "bianco" };
      const data = rows.map(r => [r.f.label, T[r.type] || r.type, r.f.time, r.conc, r.aq, r.al, r.ratio, r.type !== "standard" && fit && r.aq != null ? calc(r.aq) : null, r.type === "standard" ? (CAL.off.has(r.f.file) ? "no" : "sì") : ""]);
      const head = ["File", "Tipo", "Tempo (min)", `Conc. (${u})`, `Area ${CAL.quant || "quantificatore"} (conteggi*s)`, `Area ${CAL.qual || "qualificatore"} (conteggi*s)`, "Rapporto Qual/Quant", `Conc. dalla retta (${u})`, "Nella retta"];
      const B = t => ({ v: t, b: true }), R = [
        [B("Quantificatore"), CAL.quant || ""], [B("Qualificatore"), CAL.qual || ""], [B("Pesi"), CAL.w === "none" ? "nessuno" : CAL.w === "x" ? "1/x" : "1/x²"], [B("Unità di concentrazione"), u], [],
        ...(fit ? [[B("Pendenza (area per " + u + ")"), fit.a], [B("Intercetta (area)"), fit.b], [B("R²"), fit.r2], [B("Punti nella retta (n)"), fit.n],
          [B(`LOD (${u})`), fit.lod], [B(`LOQ (${u})`), fit.loq], [],
          ["LOD e LOQ sono stime: 3,3 e 10 volte la deviazione standard dei residui divisa per la pendenza (non una validazione del metodo)."]]
          : [["Retta non calcolabile: servono almeno due standard con concentrazione diversa e un'area."]])];
      dlx("retta_di_taratura.xlsx", [{ name: "Dati", head, rows: data, widths: [26, 11, 12, 14, 24, 24, 20, 24, 12] }, { name: "Retta", rows: R, widths: [34, 18] }]);
    };
    paint();
  });
}
