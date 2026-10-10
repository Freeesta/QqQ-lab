"use strict";
// «Formule compatibili»: elemental composition of an ion from its exact m/z (server: mzlab/chem/composition.py, /api/composition). High-resolution world only.
// The answer is a list of CANDIDATES with their errors and checks, never an identification. Classic script, loaded after hr.js.
const COMP = (() => {
  const KEY = "qqq.comp";                                           // saved presets of the elements in use (localStorage, this browser only)
  const P_CHNO = "C H N O S P", BUILTIN = { [I18N.t("comp.preset.organic")]: "C:0-60,H:0-120,N:0-10,O:0-12", [P_CHNO]: "C:0-60,H:0-120,N:0-10,O:0-12,S:0-3,P:0-3",
    [I18N.t("comp.preset.halogens")]: "C:0-60,H:0-120,N:0-10,O:0-12,S:0-3,P:0-3,F:0-6,Cl:0-3,Br:0-2" };
  const IONS = [["[M+H]+", "[M+H]⁺"], ["[M+NH4]+", "[M+NH₄]⁺"], ["[M+Na]+", "[M+Na]⁺"], ["[M+K]+", "[M+K]⁺"], ["[M]+", I18N.t("comp.ion.plus")], ["M+.", I18N.t("comp.ion.radical")],
    ["[M-H]-", "[M−H]⁻"], ["[M+Cl]-", "[M+Cl]⁻"], ["[M+HCOO]-", "[M+HCOO]⁻"], ["[M]-", I18N.t("comp.ion.minus")]];
  const RULES = [["HC", I18N.t("comp.rule.HC")], ["NC", I18N.t("comp.rule.NC")], ["OC", I18N.t("comp.rule.OC")], ["PC", I18N.t("comp.rule.PC")], ["SC", I18N.t("comp.rule.SC")], ["FC", I18N.t("comp.rule.FC")], ["ClC", I18N.t("comp.rule.ClC")], ["BrC", I18N.t("comp.rule.BrC")], ["LEWIS", "Lewis"], ["SENIOR", "Senior"]];
  const rd = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const wr = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* not available */ } };
  const num = v => { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? x : null; };
  // M+1/M and M+2/M seen in a spectrum d = {mz, y} around the peak at m/z `mz` (null when the peaks are not there)
  function observed(mz, d, tolDa = 0.006) {
    if (!d || !d.mz) return { m1: null, m2: null };
    const at = t => { let best = 0; d.mz.forEach((m, i) => { if (Math.abs(m - t) <= tolDa && d.y[i] > best) best = d.y[i]; }); return best; };
    const i0 = at(mz); if (!i0) return { m1: null, m2: null };
    const a = at(mz + 1.0033548), b = at(mz + 2.0067096);
    return { m1: a ? a / i0 : null, m2: b ? b / i0 : null };
  }
  function open(o = {}) {
    const st = rd(), pol = o.polarity === "negative" ? "-" : "+", presets = { ...BUILTIN, ...(st.presets || {}) };
    const ob = observed(o.mz, o.spec), f4 = v => (v == null ? "" : (+v).toFixed(4));
    const opt = (v, cur, l) => `<option value="${EH(v)}"${v === cur ? " selected" : ""}>${l}</option>`;
    big(I18N.t("comp.title"), `<div class="muted sm" style="margin-bottom:6px">${I18N.t("comp.note")}</div>
      <div class="cmp-grid">
        <label>m/z <input id="cmp-mz" inputmode="decimal" value="${o.mz != null ? (+o.mz).toFixed(5) : ""}" style="width:110px"></label>
        <label>${I18N.t("comp.ion")} <select id="cmp-ion">${IONS.filter(i => pol === "+" ? !/-$/.test(i[0]) : /-$/.test(i[0])).map(i => opt(i[0], o.ion || (pol === "+" ? "[M+H]+" : "[M-H]-"), i[1])).join("")}</select></label>
        <label>${I18N.t("comp.tol")} <input id="cmp-tol" value="${st.tol ?? 5}" style="width:56px"> <select id="cmp-unit">${opt("ppm", st.unit || "ppm", "ppm")}${opt("mda", st.unit || "ppm", "mDa")}</select></label>
        <label>${I18N.t("comp.max")} <input id="cmp-max" value="${st.max ?? 10}" style="width:48px"></label>
        <label>${I18N.t("comp.nitrogen")} <select id="cmp-n">${opt("none", st.n || "none", I18N.t("comp.n.none"))}${opt("even", st.n || "none", I18N.t("comp.n.even"))}${opt("odd", st.n || "none", I18N.t("comp.n.odd"))}</select></label>
        <label>${I18N.t("comp.rdbFrom")} <input id="cmp-r0" value="${st.r0 ?? -1}" style="width:50px"> ${I18N.t("comp.rdbTo")} <input id="cmp-r1" value="${st.r1 ?? 100}" style="width:50px"></label>
      </div>
      <div style="margin:8px 0 2px"><b>${I18N.t("comp.elements")}</b> <span class="muted sm">${I18N.t("comp.elements.hint")}</span></div>
      <div class="cmp-grid"><select id="cmp-pre">${Object.keys(presets).map(k => `<option>${EH(k)}</option>`).join("")}</select><button id="cmp-load" type="button">${I18N.t("comp.load")}</button><button id="cmp-save" type="button">${I18N.t("comp.saveAs")}</button></div>
      <textarea id="cmp-els" rows="2" style="width:100%;box-sizing:border-box;margin-top:4px">${EH(st.els || presets[P_CHNO])}</textarea>
      <div style="margin:8px 0 2px"><b>${I18N.t("comp.filters")}</b> <span class="muted sm">${I18N.t("comp.filters.hint")}</span></div>
      <div class="cmp-grid">${RULES.map(([k, l]) => `<label><input type="checkbox" data-r="${k}"${(st.rules || []).includes(k) ? " checked" : ""}> ${EH(l)}</label>`).join("")}</div>
      <div class="cmp-grid" style="margin-top:6px"><label>${I18N.t("comp.parent")} <input id="cmp-par" value="${EH(o.parent || "")}" placeholder="${I18N.t("comp.parent.ph")}" style="width:150px"></label>
        <label>${I18N.t("comp.isoObs")} M+1/M <input id="cmp-m1" value="${f4(ob.m1)}" style="width:62px"> M+2/M <input id="cmp-m2" value="${f4(ob.m2)}" style="width:62px"></label>
        <button id="cmp-go" type="button" class="go">${I18N.t("comp.go")}</button></div>
      <div id="cmp-known" class="sm" style="margin-top:6px"></div><div id="cmp-out" style="margin-top:8px"></div>`, () => {
      const $ = s => Q(s);
      $("#cmp-load").onclick = () => { $("#cmp-els").value = presets[$("#cmp-pre").value] || $("#cmp-els").value; };
      $("#cmp-save").onclick = async () => { const n = await ask(I18N.t("comp.presetName"), ""); if (!n) return; const s = rd(); s.presets = { ...(s.presets || {}), [n]: $("#cmp-els").value }; wr(s); toast(I18N.t("comp.saved")); };
      const go = async () => {
        const rules = [...document.querySelectorAll("#bigbody [data-r]")].filter(x => x.checked).map(x => x.dataset.r);
        const q = { mz: num($("#cmp-mz").value), ion: $("#cmp-ion").value, tol: num($("#cmp-tol").value) ?? 5, unit: $("#cmp-unit").value, max: parseInt($("#cmp-max").value) || 10,
          n: $("#cmp-n").value, rdb: `${num($("#cmp-r0").value) ?? -1},${num($("#cmp-r1").value) ?? 100}`, elements: $("#cmp-els").value.replace(/\s+/g, ""), rules: rules.join(","), parent: $("#cmp-par").value.trim(), m1: num($("#cmp-m1").value), m2: num($("#cmp-m2").value) };
        if (q.mz == null) { $("#cmp-out").innerHTML = `<span class="fail">${I18N.t("comp.typeMz")}</span>`; return; }
        if (window.LISTE) await LISTE.ready();
        { const kn = window.LISTE && o.polarity ? LISTE.textFor(q.mz, o.polarity, UIP.hrPpm) : ""; $("#cmp-known").innerHTML = kn ? `<b>${I18N.t("comp.known")}</b> ${EH(kn)} <span class="muted">${I18N.t("comp.known.note")}</span>` : ""; }
        wr({ ...rd(), tol: q.tol, unit: q.unit, max: q.max, n: q.n, r0: num($("#cmp-r0").value), r1: num($("#cmp-r1").value), els: $("#cmp-els").value, rules });
        $("#cmp-out").textContent = I18N.t("comp.calculating");
        try {
          const j = await J("api/composition?" + Object.entries(q).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"));
          if (!j.results.length) { $("#cmp-out").innerHTML = `<div class="muted">${I18N.t("comp.none")}</div>`; return; }
          const hasIso = j.results.some(r => r.iso && r.iso.ok != null);
          $("#cmp-out").innerHTML = `<div class="bar"><button id="cmp-xlsx" type="button">${typeof IC_DL !== "undefined" ? IC_DL : ""}Excel</button></div><div class="muted sm">${I18N.t("comp.count", { n: j.n_candidates })}${j.n_candidates > j.results.length ? " " + I18N.t("comp.first", { n: j.results.length }) : ""}. ${I18N.t("comp.confidence")}</div>
            <table class="lct"><tr><th>#</th><th>${I18N.t("comp.col.ion")}</th><th>${I18N.t("comp.col.neutral")}</th><th class="num">${I18N.t("comp.col.rdb")}</th><th class="num">Δ mDa</th><th class="num">Δ ppm</th><th>${I18N.t("comp.col.iso12")}</th>${hasIso ? "<th>" + I18N.t("comp.col.iso") + "</th>" : ""}<th>${I18N.t("comp.col.rules")}</th></tr>
            ${j.results.map((r, i) => `<tr><td>${i + 1}</td><td><b>${fmtFormula(r.formula)}</b></td><td>${r.neutral ? fmtFormula(r.neutral) : ""}</td><td class="num">${r.rdb}</td><td class="num">${r.delta_mda}</td><td class="num">${r.delta_ppm}</td>
              <td class="num">${(r.iso.m1 * 100).toFixed(1)}% / ${(r.iso.m2 * 100).toFixed(1)}%</td>${hasIso ? `<td>${r.iso.ok == null ? "" : r.iso.ok ? I18N.t("comp.compatible") : I18N.t("comp.incompatible")}</td>` : ""}<td>${r.rules_failed.length ? I18N.t("comp.fails") + " " + r.rules_failed.join(", ") : I18N.t("comp.allPass")}</td></tr>`).join("")}</table>`;
          $("#cmp-xlsx").onclick = () => dlx(I18N.t("comp.xlsx.prefix") + (+q.mz).toFixed(4) + ".xlsx", [{ name: I18N.t("comp.xlsx.sheet"), head: ["#", I18N.t("comp.col.ion"), I18N.t("comp.col.neutral"), I18N.t("comp.col.rdb"), "Δ mDa", "Δ ppm", "M+1/M (%)", "M+2/M (%)", I18N.t("comp.col.iso"), I18N.t("comp.col.failed")],
            rows: j.results.map((r, i) => [i + 1, r.formula, r.neutral || "", r.rdb, r.delta_mda, r.delta_ppm, +(r.iso.m1 * 100).toFixed(2), +(r.iso.m2 * 100).toFixed(2), r.iso.ok == null ? "" : r.iso.ok ? I18N.t("comp.compatible") : I18N.t("comp.incompatible"), r.rules_failed.join(", ")]), widths: [5, 24, 22, 8, 10, 10, 12, 12, 16, 30] },
            { name: I18N.t("lib.all.sheetPar"), head: [I18N.t("lib.all.parameter"), I18N.t("lib.all.value")], rows: [["m/z", q.mz], [I18N.t("comp.ion"), q.ion], [I18N.t("comp.tol"), `${q.tol} ${q.unit}`], [I18N.t("comp.xlsx.elements"), q.elements], [I18N.t("comp.col.rdb"), q.rdb], [I18N.t("comp.nitrogen"), q.n], [I18N.t("comp.filters"), q.rules || ""], [I18N.t("comp.parent"), q.parent || ""], [I18N.t("lib.all.level"), I18N.t("comp.xlsx.level")]], widths: [28, 60] }]);
        } catch (e) { $("#cmp-out").innerHTML = `<span class="fail">${EH(e.message)}</span>`; }
      };
      $("#cmp-go").onclick = go;
      if (o.mz != null) go();
    });
  }
  // ---------------------------------------------------------------- «Albero MSn» (WP-H4): the fragmentation paths of an MSn file (server: mzlab/chem/msntree.py, /api/msntree)
  async function tree(k, formula) {
    const f = E.files[k];
    big(I18N.t("tree.title"), `<div class="muted sm" style="margin-bottom:6px">${I18N.t("tree.note")}</div>
      <div class="cmp-grid"><label>${I18N.t("tree.formula")} <input id="mt-f" value="${EH(formula || "")}" placeholder="${I18N.t("tree.formula.ph")}" style="width:200px"></label>
        <button id="mt-go" type="button" class="go">${I18N.t("comp.go")}</button></div><div id="mt-out" style="margin-top:8px"></div>`, () => {
      const go = async () => {
        const fm = Q("#mt-f").value.replace(/\s+/g, "");
        Q("#mt-out").textContent = I18N.t("comp.calculating");
        try {
          const j = await J(`api/msntree?k=${k}${fm ? "&formula=" + encodeURIComponent(fm) : ""}`);
          const nd = j.nodes, depth = n => (n.parent == null ? 0 : 1 + depth(nd[n.parent]));
          Q("#mt-out").innerHTML = `<div class="bar"><button id="mt-xlsx" type="button">${typeof IC_DL !== "undefined" ? IC_DL : ""}Excel</button></div>${j.formula_given ? "" : `<div class="muted sm">${I18N.t("tree.noFormula")}${j.root_candidates.length ? `: ${j.root_candidates.slice(0, 6).map(x => `<a href="#" data-rf="${EH(x)}">${fmtFormula(x)}</a>`).join(", ")}` : ""} ${I18N.t("tree.clickFix")}</div>`}
            <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1 1 380px;max-height:360px;overflow:auto"><table class="lct" id="mt-tbl"><tr><th>${I18N.t("tree.col.path")}</th><th>MS</th><th class="num">${I18N.t("lib.all.scans")}</th><th class="num">${I18N.t("tree.col.prec")}</th><th>${I18N.t("lst.col.formula")}</th><th class="num">ppm</th><th></th></tr>
            ${nd.map(n => `<tr data-n="${n.id}" style="cursor:pointer"><td style="padding-left:${6 + 14 * depth(n)}px">${EH(n.path[n.path.length - 1].join("@").replace(/@([A-Za-z]+)@/, "@$1"))}</td><td>${n.level}</td><td class="num">${n.scans}</td>
              <td class="num">${n.prec == null ? "" : n.prec.toFixed(4)}</td><td>${n.formula ? fmtFormula(n.formula) : "–"}</td><td class="num">${n.ppm == null ? "" : n.ppm.toFixed(1)}</td><td class="muted sm">${n.empty ? I18N.t("tree.empty") : ""}</td></tr>`).join("")}</table></div>
            <div id="mt-pk" style="flex:1 1 300px;max-height:360px;overflow:auto"><span class="muted sm">${I18N.t("tree.clickNode")}</span></div></div>`;
          Q("#mt-xlsx").onclick = () => dlx(I18N.t("tree.xlsx.prefix") + (f ? String(f.label || "file").replace(/[^\w.-]+/g, "_") : "file") + ".xlsx", [
            { name: I18N.t("tree.xlsx.paths"), head: [I18N.t("tree.col.path"), "MS", I18N.t("lib.all.scans"), I18N.t("tree.xlsx.peaks"), I18N.t("tree.col.prec"), I18N.t("lst.col.formula"), "Δ ppm", I18N.t("lst.col.note")], rows: nd.map(n => [n.label, n.level, n.scans, n.n_peaks, n.prec == null ? "" : +n.prec.toFixed(5), n.formula || "", n.ppm == null ? "" : +n.ppm.toFixed(2), n.empty ? I18N.t("tree.empty") : ""]), widths: [40, 6, 10, 8, 14, 20, 8, 14] },
            { name: I18N.t("tree.xlsx.peaks"), head: [I18N.t("tree.col.path"), "m/z", I18N.t("tree.pct"), I18N.t("lst.col.formula"), "Δ ppm", I18N.t("lst.col.note")], rows: nd.flatMap(n => n.peaks.slice().sort((a, b) => b.rel - a.rel).map(p => [n.label, +p.mz.toFixed(5), p.rel, p.formula || "", p.ppm == null ? "" : +p.ppm.toFixed(2), p.contam ? I18N.t("tree.contam") : ""])), widths: [40, 12, 12, 20, 8, 16] }]);
          Q("#mt-out").querySelectorAll("[data-rf]").forEach(a => { a.onclick = ev => { ev.preventDefault(); Q("#mt-f").value = a.dataset.rf; go(); }; });
          Q("#mt-tbl").querySelectorAll("tr[data-n]").forEach(tr => {
            tr.onclick = () => {
              const n = nd[+tr.dataset.n];
              Q("#mt-tbl").querySelectorAll("tr").forEach(x => { x.style.background = ""; }); tr.style.background = "var(--sel, rgba(120,160,255,.2))";
              Q("#mt-pk").innerHTML = `<div><b>${EH(n.label)}</b></div><div class="muted sm">${I18N.t("tree.nodeInfo", { scans: n.scans, peaks: n.n_peaks })} ${I18N.t("tree.clickPeak")}</div>
                <table class="lct"><tr><th class="num">m/z</th><th class="num">%</th><th>Formula</th><th class="num">ppm</th><th></th></tr>
                ${n.peaks.slice().sort((a, b) => b.rel - a.rel).map(p => `<tr data-mz="${p.mz}" style="cursor:pointer"><td class="num">${p.mz.toFixed(4)}</td><td class="num">${p.rel}</td><td>${p.formula ? fmtFormula(p.formula) : "–"}</td><td class="num">${p.ppm == null ? "" : p.ppm.toFixed(1)}</td><td class="muted sm">${p.contam ? I18N.t("tree.contam") : ""}</td></tr>`).join("")}</table>`;
              Q("#mt-pk").querySelectorAll("tr[data-mz]").forEach(r => { r.onclick = () => open({ mz: +r.dataset.mz, parent: n.formula || "", polarity: f && f.polarity, ion: j.ion }); });
            };
          });
        } catch (e) { Q("#mt-out").innerHTML = `<span class="fail">${EH(e.message)}</span>`; }
      };
      Q("#mt-go").onclick = go;
      go();
    });
  }
  return { open, observed, tree };
})();
window.COMP = COMP;
