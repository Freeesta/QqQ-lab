// TPMINE-PRIVATE  TP Mine, high-resolution mode: ranking of the possible TPs, detail of a candidate (kinetics by session, mirror MS2 with S/U evidence,
// localisation, criteria), MSn tree, exports. Called by 20_tpmine.js (window.TPHR.render) with its helpers; it does not talk to the worker itself.
(() => {
  "use strict";
  const CSS = `
.tp .lvl{display:inline-block;min-width:22px;text-align:center;border-radius:4px;color:#fff;font-weight:700;font-size:11px;padding:0 5px}
.tp .lvl-2b{background:#047857}.tp .lvl-3{background:#2b5c8a}.tp .lvl-4{background:#8a6d2b}.tp .lvl-5{background:#7a8190}
.tp .hrn{border-left:3px solid #d99a1d;background:rgba(217,154,29,.10);padding:6px 10px;border-radius:0 6px 6px 0;font-size:12px;margin:0 0 8px}
.tp .comp{display:grid;grid-template-columns:90px 1fr 42px;gap:6px;align-items:center;font-size:12px}.tp .comp i{display:block;height:8px;background:var(--accent);border-radius:4px}
.tp .flag{color:#9a5b00;font-size:11px}.tp .tree{font-size:12px}.tp .tree .nd{margin:2px 0}.tp .tree code{font-size:11px}
.tp .fl-s{color:#b42318;font-weight:600}.tp .fl-u{color:#2b5c8a;font-weight:600}`;
  const LV = { "2b": "2b", 3: "3", 4: "4", 5: "5" };
  const LV_TEXT = { "2b": "sito determinato", 3: "regione localizzata", 4: "formula e derivazione", 5: "compare con il trattamento" };

  function render(R, s, h) {
    if (!document.getElementById("tp-hr-css")) { const st = document.createElement("style"); st.id = "tp-hr-css"; st.textContent = CSS; document.head.appendChild(st); }
    const { esc, fmtA, chart, hue, call, toast, dl } = h;
    const $ = q => R.querySelector(q);
    const rows = s.rows, st = { sel: null, minLevel: 5, text: "", onlyLoc: false, det: {} };
    const lvRank = l => l === "2b" ? 4 : +l;
    const n = l => rows.filter(r => String(r.level) === l).length;
    const nMs2 = rows.filter(r => r.ms2_scans > 0).length;
    R.innerHTML = `<div class="hero"><div class="hero-t"><span class="hero-i">⛏</span>
      <div><h2>Classifica dei TP possibili</h2><div class="hero-s">${esc(s.parent.name || "")} ${esc(s.parent.formula)} · ${esc(s.parent.ion)} <i>m/z</i> ${s.parent.mz}${s.parent.rt ? ` · RT ${s.parent.rt} min` : ""} · alta risoluzione · ${s.timing.total} s</div></div></div>
      <div class="stats"><div class="stat g"><b>${n("2b")}</b><span>livello 2b</span></div><div class="stat a"><b>${n("3")}</b><span>livello 3</span></div><div class="stat v"><b>${n("4") + n("5")}</b><span>livello 4-5</span></div>
      <div class="stat"><b>${nMs2}</b><span>con MS<sup>2</sup></span></div><div class="stat"><b>${s.n_candidates}</b><span>candidati dopo i filtri</span></div><div class="stat"><b>${s.files.length}</b><span>file</span></div></div>
      <div class="row" style="margin-top:10px"><button id="hr-x-xlsx">Excel (.xlsx)</button><button id="hr-x-csv">CSV</button><button id="hr-x-json">JSON</button><button id="hr-x-incl" title="Lista di inclusione per una seconda iniezione mirata: i migliori candidati senza MS2">Lista di inclusione (CSV)</button></div></div>
      <div class="card hrn">Ogni riga è un'ipotesi, non un'identificazione: il livello dice quante prove la sostengono (5 compare con il trattamento, 4 formula unica e derivabile, 3 MS² legata al progenitore e regione localizzata, 2b sito determinato con margine, RT e cinetica coerenti). I livelli 2a e 1 richiedono uno standard.</div>
      ${s.warnings.length ? `<div class="card">${s.warnings.map(w => `<div class="flag">⚠ ${esc(w)}</div>`).join("")}</div>` : ""}
      <div class="card"><div class="row"><label class="mut">Livello minimo</label><select id="hr-lv"><option value="5">tutti</option><option value="4">4 o più</option><option value="3">3 o più</option><option value="2b">solo 2b</option></select>
        <input type="text" id="hr-q" placeholder="filtra: formula, m/z, regione" class="grow"><label><input type="checkbox" id="hr-loc"> solo con regione</label><span class="mut" id="hr-cnt"></span></div>
        <div class="tbl"><table id="hr-t"></table></div></div>
      <div id="tp-det"></div>
      <details class="card"><summary>Filtri applicati (imbuto) e sessioni</summary>${s.funnel.map(f => `<div class="mut">${f.n.toLocaleString("it")} · ${esc(f.text)}</div>`).join("")}
        <div class="mut" style="margin-top:6px">Sessioni: ${esc([...new Set(s.sessions.labels)].map(l => l + " (" + s.sessions.labels.filter(x => x === l).length + " file)").join(", "))}${s.sessions.factors.applied ? "; aree riportate alla sessione di riferimento" : "; nessuna correzione necessaria"}.</div>
        <div class="mut">Tempi (s): ${esc(Object.entries(s.timing).map(([k, v]) => k + " " + v).join(" · "))}</div></details>
      ${s.tree ? `<details class="card"><summary>Albero MSn del progenitore (${s.tree.length} nodi)</summary><div class="tree">${tree(s.tree, esc)}</div></details>` : ""}`;

    function spark(series) {
      const mx = Math.max(...series) || 1, w = 70, ht = 18, pts = series.map((v, i) => `${(i / Math.max(1, series.length - 1) * (w - 4) + 2).toFixed(1)},${(ht - 2 - v / mx * (ht - 4)).toFixed(1)}`).join(" ");
      return `<svg width="${w}" height="${ht}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
    }
    const keep = () => rows.filter(r => (st.minLevel === 5 || lvRank(r.level) >= lvRank(st.minLevel)) && (!st.onlyLoc || r.region) &&
      (!st.text || [r.formula, String(r.mz), r.region, r.delta, r.derivation].join(" ").toLowerCase().includes(st.text)));
    function table() {
      const k = keep();
      $("#hr-cnt").textContent = `${k.length} di ${rows.length}`;
      $("#hr-t").innerHTML = `<tr><th>#</th><th>Liv.</th><th>Punti</th><th><i>m/z</i></th><th>Formula (ppm)</th><th>Variazione</th><th>RT</th><th>t max</th><th>Classe</th><th>Regione</th><th>Cinetica</th></tr>` +
        k.map((r, i) => `<tr class="clk${r.id === st.sel ? " sel" : ""}" data-id="${r.id}"><td>${rows.indexOf(r) + 1}</td><td><span class="lvl lvl-${r.level}" title="${esc(LV_TEXT[r.level] || "")}">${r.level}</span></td>
          <td class="n">${r.score}</td><td class="n">${r.mz.toFixed(4)}</td><td>${esc(r.formula || "-")}${r.ppm != null ? ` <span class="mut">${r.ppm >= 0 ? "+" : ""}${r.ppm}</span>` : ""}${r.n_formulas > 1 ? ` <span class="mut" title="formule possibili entro 3 ppm">(${r.n_formulas})</span>` : ""}</td>
          <td>${esc(r.derivation || r.delta || "")}${r.flags.length ? `<div class="flag">${r.flags.map(esc).join("; ")}</div>` : ""}</td><td class="n">${r.rt}</td><td class="n">${r.tmax ?? ""}</td><td>${esc(r.class || "")}</td>
          <td>${esc(r.region || "")}</td><td>${spark(r.series)}</td></tr>`).join("");
      $("#hr-t").querySelectorAll("tr.clk").forEach(tr => tr.onclick = () => show(+tr.dataset.id));
    }
    $("#hr-lv").onchange = e => { st.minLevel = e.target.value === "2b" ? "2b" : +e.target.value; table(); };
    $("#hr-q").oninput = e => { st.text = e.target.value.trim().toLowerCase(); table(); };
    $("#hr-loc").onchange = e => { st.onlyLoc = e.target.checked; table(); };
    table();

    async function detail(id) { return st.det[id] || (st.det[id] = await call("detail", id)); }
    async function show(id) {
      st.sel = id; table();
      const D = $("#tp-det"); D.innerHTML = `<div class="card mut">Calcolo...</div>`;
      let d; try { d = await detail(id); } catch (e) { D.innerHTML = `<div class="card err">${esc(e.message || e)}</div>`; return; }
      const r = d.row, loc = d.localization, w = s.weights;
      const comp = Object.keys(w).filter(k => typeof d.components[k] === "number").map(k => [k, d.components[k]]).map(([k, v]) => `<div class="comp" title="${esc((d.components.text || {})[k] || "")}"><span>${esc(k)} <span class="mut">×${w[k]}</span></span><span><i style="width:${Math.round(100 * v)}%"></i></span><span class="mut">${v.toFixed(2)}</span></div>`).join("");
      const kin = d.kinetics || {};
      D.innerHTML = `<div class="card"><h3>${esc(r.formula || "formula non assegnata")} <span class="lvl lvl-${r.level}">${r.level}</span> <span class="mut">${esc(d.level_text || "")}</span></h3>
        <div class="kv"><b><i>m/z</i></b><span>${r.mz}${r.ppm != null ? ` · ${r.ppm >= 0 ? "+" : ""}${r.ppm} ppm` : ""}${r.n_formulas > 1 ? ` · ${r.n_formulas} formule possibili` : ""}</span><b>Variazione</b><span>${esc(r.derivation || "-")} <span class="mut">(${esc(r.delta || "")})</span></span>
        <b>RT</b><span>${r.rt} min${s.parent.rt ? ` (${(r.rt - s.parent.rt) >= 0 ? "+" : ""}${(r.rt - s.parent.rt).toFixed(2)} rispetto al progenitore)` : ""}</span>
        <b>Cinetica</b><span>${esc(kin.class_text || "-")}${kin.tmax != null ? ` · massimo a ${kin.tmax} min` : ""}${kin.onset != null ? ` · compare a ${kin.onset} min` : ""}${kin.unimodal === false ? " · non unimodale" : ""}</span>
        <b>Regione</b><span>${r.region ? esc(r.region) : "<span class='mut'>non localizzata</span>"}${loc && loc.ok ? ` <span class="mut">· margine ${loc.margin.toFixed(2)} · ${Math.round(100 * loc.fraction_explained)}% dell'intensità spiegata</span>` : (loc && loc.note ? ` <span class="mut">${esc(loc.note)}</span>` : "")}</span>
        <b>Origine</b><span>${d.predecessor && d.predecessor.predecessor != null ? `da ${d.predecessor.predecessor === "progenitore" ? "progenitore" : "#" + esc(d.predecessor.predecessor)}${d.predecessor.transformation ? ", " + esc(d.predecessor.transformation) : ""}${d.predecessor.cos != null ? `, coseno ${(+d.predecessor.cos).toFixed(2)}` : ""}` : "<span class='mut'>nessun predecessore trovato</span>"}</span>
        ${d.isotopes ? `<b>Isotopi</b><span>${esc(d.isotopes.text || d.isotopes.status)}</span>` : ""}${r.flags.length ? `<b>Segnalazioni</b><span class="flag">${r.flags.map(esc).join("; ")}</span>` : ""}</div></div>
        <div class="cols"><div class="card"><h3>Cinetica per sessione</h3><canvas id="hr-kin"></canvas><div class="row" id="hr-kleg"></div></div><div class="card"><h3>Punteggio ${r.score}</h3>${comp}
          <h3 style="margin-top:10px">Criteri</h3><ul class="crit" style="margin:0;padding-left:18px">${d.criteria.map(c => `<li class="${c.status}"><b>${c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–"} ${esc(c.name)}</b> <span class="mut">${esc(c.text)}</span></li>`).join("")}</ul></div></div>
        ${d.ms2 ? `<div class="card"><h3>MS<sup>2</sup> del candidato (sotto) e del progenitore (sopra)</h3><canvas id="hr-ms2" style="height:300px"></canvas>
          <div class="mut"><span class="fl-s">■ spostato (S)</span>: contiene la modifica · <span class="fl-u">■ non spostato (U)</span>: la parte modificata è fuori dal frammento · grigio: nessuna relazione col progenitore</div></div>` :
          `<div class="card mut">Nessuna MS² DDA per questo ione: niente localizzazione. Serve una seconda iniezione con lista di inclusione.</div>`}
        ${loc && loc.ok ? `<div class="card"><h3>Localizzazione</h3><div class="mut">${loc.n_sites} siti candidati · tipo ${esc(loc.type)} · ${loc.n_shifted} frammenti S, ${loc.n_unshifted} U</div>
          <table><tr><th>Sito</th><th>log-verosimiglianza</th></tr>${loc.top_sites.map(t => `<tr><td>${esc(t.site)}</td><td class="n">${t.ll.toFixed(2)}</td></tr>`).join("")}</table>
          <table style="margin-top:6px"><tr><th><i>m/z</i></th><th>%</th><th>formula</th><th>prova</th></tr>${loc.evidence.map(e => `<tr><td class="n">${e.mz.toFixed(4)}</td><td class="n">${e.rel.toFixed(0)}</td><td>${esc(e.formula)}</td><td class="${e.kind === "S" ? "fl-s" : "fl-u"}">${e.kind === "S" ? "S (spostato)" : "U (non spostato)"}</td></tr>`).join("")}</table></div>` : ""}
        ${d.iimn ? `<div class="card"><h3>Famiglia di ioni (stesso picco)</h3><div class="mut">${esc(d.iimn.explained_text || d.iimn.role || "")}</div></div>` : ""}
        ${d.isomers && d.isomers.k > 1 ? `<div class="card"><h3>Isomeri co-eluenti: ${d.isomers.k} componenti</h3>${d.isomers.components.map((c, i) => `<div class="mut">componente ${i + 1}: apice a RT ${c.rt_apex.toFixed(2)} min, ${c.mz.length} picchi MS²</div>`).join("")}</div>` : ""}`;
      D.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const labs = [...new Set(d.sessions)], t = d.times, series = [];
      labs.forEach((lab, j) => {
        const ix = t.map((_, i) => i).filter(i => d.sessions[i] === lab && t[i] >= 0).sort((a, b) => t[a] - t[b]);
        if (ix.length) series.push({ x: ix.map(i => t[i]), y: ix.map(i => d.areas[i]), color: hue(j, Math.max(2, labs.length)), dots: true, label: lab });
      });
      chart($("#hr-kin"), series, { xlabel: "tempo di trattamento (min)" });
      $("#hr-kleg").innerHTML = series.map(x => `<span class="mut"><span style="display:inline-block;width:14px;border-top:2px solid ${x.color};vertical-align:middle"></span> ${x.label === "?" ? "area" : "sessione " + esc(x.label)}</span>`).join("");
      if (d.ms2) mirror($("#hr-ms2"), d);
    }

    function mirror(cv, d) {
      const dpr = devicePixelRatio || 1, W = cv.clientWidth || 600, H = cv.clientHeight || 300;
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
      const P = d.ms2.parent, C = d.ms2.candidate, ev = (d.localization && d.localization.evidence) || [];
      const M = { l: 40, r: 10, t: 10, b: 24 }, pw = W - M.l - M.r, mid = M.t + (H - M.t - M.b) / 2, half = (H - M.t - M.b) / 2 - 12;
      const lo = Math.max(50, Math.min(...P.mz, ...C.mz) - 10), hi = Math.max(...P.mz, ...C.mz) + 15, X = v => M.l + (v - lo) / (hi - lo) * pw;
      const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue("--muted") || "#666", line = css.getPropertyValue("--line") || "#ddd";
      g.strokeStyle = line; g.beginPath(); g.moveTo(M.l, mid); g.lineTo(W - M.r, mid); g.stroke();
      g.fillStyle = ink; g.font = "11px system-ui"; g.textAlign = "center";
      const step = Math.max(10, Math.round((hi - lo) / 8 / 10) * 10);
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g.fillText(v, X(v), H - 8);
      const peaks = (spec, sign, colorOf) => spec.mz.forEach((m, i) => {
        const y = mid - sign * spec.rel[i] / 100 * half, c = colorOf(m); g.strokeStyle = c; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X(m), mid); g.lineTo(X(m), y); g.stroke();
        if (spec.rel[i] >= 8) { g.fillStyle = c; g.textAlign = "center"; const f = sign < 0 ? (ev.find(e => Math.abs(e.mz - m) < 0.003) || {}).formula : null; g.fillText(f || m.toFixed(3), X(m), sign > 0 ? y - 3 : y + 11); }
      });
      peaks(P, 1, () => "#7a8190");
      peaks(C, -1, m => { const e = ev.find(x => Math.abs(x.mz - m) < 0.003); return e ? (e.kind === "S" ? "#b42318" : "#2b5c8a") : "#7a8190"; });
      g.fillStyle = ink; g.textAlign = "left"; g.fillText("progenitore", M.l + 4, M.t + 10); g.fillText("candidato", M.l + 4, H - M.b - 4);
    }

    async function exportAll(kind) {
      const name = (s.parent.formula || "progenitore") + "_TPMine_HR";
      const keys = Object.keys(s.weights), times = s.times;
      const head = ["#", "Livello", "Punteggio", "m/z", "Formula", "ppm", "Formule possibili", "Variazione", "RT (min)", "t max (min)", "Classe", "Compare a (min)", "Regione", "Margine", "Predecessore", "Trasformazione", "Scansioni MS2", "Coseno modificato", "Picchi accoppiati", "Segnalazioni", ...keys.map(k => "punteggio " + k), ...times.map(t => "Area t" + t)];
      const line = (r, i) => [i + 1, r.level, r.score, r.mz, r.formula ?? "", r.ppm ?? "", r.n_formulas ?? "", r.derivation ?? r.delta ?? "", r.rt, r.tmax ?? "", r.class ?? "", r.onset ?? "", r.region ?? "", r.margin ?? "", r.predecessor ?? "", r.transformation ?? "", r.ms2_scans, r.modcos ?? "", r.n_matched, r.flags.join("; "), ...keys.map(k => r.components[k]), ...r.series];
      if (kind === "json") return dl(name + ".json", JSON.stringify(s, null, 1), "application/json");
      if (kind === "csv") return dl(name + ".csv", "sep=;\n" + [head, ...rows.map(line)].map(x => x.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
      toast("Preparo l'Excel...");
      const top = rows.slice(0, 50), det = []; for (const r of top) det.push(await detail(r.id));
      const sheets = [{ name: "Classifica", head, rows: rows.map(line), widths: [6, 8, 9, 10, 18, 7, 9, 28, 8, 9, 18, 9, 30, 8, 12, 24, 9, 9, 9, 40, ...keys.map(() => 10), ...times.map(() => 11)] },
        { name: "Criteri", head: ["#", "Formula", "Criterio", "Esito", "Dettaglio"], rows: det.flatMap((d, i) => d.criteria.map(c => [i + 1, d.row.formula ?? "", c.name, c.status, c.text])), widths: [6, 18, 32, 8, 80] },
        { name: "Localizzazione", head: ["#", "Formula", "Regione", "m/z frammento", "% rel.", "Formula frammento", "Prova"], rows: det.flatMap((d, i) => ((d.localization && d.localization.evidence) || []).map(e => [i + 1, d.row.formula ?? "", d.row.region ?? "", e.mz, e.rel, e.formula, e.kind])), widths: [6, 18, 30, 12, 8, 18, 8] },
        { name: "Albero MSn", head: ["Nodo", "Livello", "Padre", "Formula", "m/z precursore", "ppm", "Scansioni", "Fantasma"], rows: (s.tree || []).map(t => [t.id, t.level, t.parent ?? "", t.formula ?? "", t.prec_mz ?? "", t.ppm ?? "", t.n_scans, t.ghost ? "sì" : ""]), widths: [8, 8, 8, 18, 12, 8, 10, 9] },
        { name: "Lista di inclusione", head: ["m/z", "RT da", "RT a", "Formula", "Punteggio"], rows: s.inclusion.map(x => [x.mz, x.rt_from, x.rt_to, x.formula ?? "", x.score]), widths: [12, 9, 9, 18, 10] },
        { name: "Informazioni", head: ["Voce", "Valore"], rows: [["Progenitore", s.parent.formula], ["Ione", s.parent.ion], ["m/z", s.parent.mz], ["Pesi del punteggio", keys.map(k => k + " " + s.weights[k]).join(", ")], ...s.funnel.map(f => ["Filtro: " + f.text, f.n]), ...s.warnings.map(x => ["Avviso", x])], widths: [44, 60] }];
      dlx(name + ".xlsx", sheets);
    }
    $("#hr-x-xlsx").onclick = () => exportAll("xlsx").catch(e => toast(String(e.message || e)));
    $("#hr-x-csv").onclick = () => exportAll("csv"); $("#hr-x-json").onclick = () => exportAll("json");
    $("#hr-x-incl").onclick = async () => dl((s.parent.formula || "progenitore") + "_inclusione.csv", await h.callRaw("inclusion_csv", "50"), "text/csv");
    if (rows.length) show(rows[0].id);
  }

  function tree(nodes, esc) {
    const kids = {}; nodes.forEach(n => (kids[n.parent ?? "root"] = kids[n.parent ?? "root"] || []).push(n));
    const go = (key, depth) => (kids[key] || []).map(n => `<div class="nd" style="margin-left:${depth * 16}px">${n.ghost ? "👻 " : ""}<b>MS${n.level}</b> ${n.prec_mz != null ? `<i>m/z</i> ${n.prec_mz}` : ""} ${esc(n.formula || "")} <span class="mut">${n.n_scans} scansioni${n.ce != null ? " · CE " + esc(n.ce) : ""}${n.ghost ? " · fantasma (precursore non isolato)" : ""}</span>
      <div class="mut" style="margin-left:14px"><code>${n.peaks.slice(0, 6).map(p => esc(p.formula || p.mz)).join(" · ")}</code></div></div>${go(n.id, depth + 1)}`).join("");
    return go("root", 0);
  }

  window.TPHR = { render };
})();
