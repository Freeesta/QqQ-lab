"use strict";
// «Formule compatibili»: elemental composition of an ion from its exact m/z (server: mzlab/chem/composition.py, /api/composition). High-resolution world only.
// The answer is a list of CANDIDATES with their errors and checks, never an identification. Classic script, loaded after hr.js.
const COMP = (() => {
  const KEY = "qqq.comp";                                           // saved presets of the elements in use (localStorage, this browser only)
  const BUILTIN = { "C H N O (organiche)": "C:0-60,H:0-120,N:0-10,O:0-12", "C H N O S P": "C:0-60,H:0-120,N:0-10,O:0-12,S:0-3,P:0-3",
    "C H N O S P + alogeni": "C:0-60,H:0-120,N:0-10,O:0-12,S:0-3,P:0-3,F:0-6,Cl:0-3,Br:0-2" };
  const IONS = [["[M+H]+", "[M+H]⁺"], ["[M+NH4]+", "[M+NH₄]⁺"], ["[M+Na]+", "[M+Na]⁺"], ["[M+K]+", "[M+K]⁺"], ["[M]+", "ione così com'è (+)"], ["M+.", "M⁺• (radicale catione)"],
    ["[M-H]-", "[M−H]⁻"], ["[M+Cl]-", "[M+Cl]⁻"], ["[M+HCOO]-", "[M+HCOO]⁻"], ["[M]-", "ione così com'è (−)"]];
  const RULES = [["HC", "H/C 0,2-3,1"], ["NC", "N/C ≤ 1,3"], ["OC", "O/C ≤ 1,2"], ["PC", "P/C ≤ 0,3"], ["SC", "S/C ≤ 0,8"], ["FC", "F/C ≤ 1,5"], ["ClC", "Cl/C ≤ 0,8"], ["BrC", "Br/C ≤ 0,8"], ["LEWIS", "Lewis"], ["SENIOR", "Senior"]];
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
    big("Formule compatibili", `<div class="muted sm" style="margin-bottom:6px">Candidati compatibili con la massa esatta, non identificazioni: la risposta dipende dagli elementi che consenti.</div>
      <div class="cmp-grid">
        <label>m/z <input id="cmp-mz" inputmode="decimal" value="${o.mz != null ? (+o.mz).toFixed(5) : ""}" style="width:110px"></label>
        <label>Ione <select id="cmp-ion">${IONS.filter(i => pol === "+" ? !/-$/.test(i[0]) : /-$/.test(i[0])).map(i => opt(i[0], o.ion || (pol === "+" ? "[M+H]+" : "[M-H]-"), i[1])).join("")}</select></label>
        <label>Tolleranza <input id="cmp-tol" value="${st.tol ?? 5}" style="width:56px"> <select id="cmp-unit">${opt("ppm", st.unit || "ppm", "ppm")}${opt("mda", st.unit || "ppm", "mDa")}</select></label>
        <label>Risultati max <input id="cmp-max" value="${st.max ?? 10}" style="width:48px"></label>
        <label>Regola dell'azoto <select id="cmp-n">${opt("none", st.n || "none", "Non usare")}${opt("even", st.n || "none", "Ioni a elettroni pari")}${opt("odd", st.n || "none", "Ioni a elettroni dispari")}</select></label>
        <label>RDB da <input id="cmp-r0" value="${st.r0 ?? -1}" style="width:50px"> a <input id="cmp-r1" value="${st.r1 ?? 100}" style="width:50px"></label>
      </div>
      <div style="margin:8px 0 2px"><b>Elementi in uso</b> <span class="muted sm">(della formula dello ione, es. C:0-13,H:0-25; isotopi come elementi: 13C:0-2, 15N, 34S, 37Cl, 81Br)</span></div>
      <div class="cmp-grid"><select id="cmp-pre">${Object.keys(presets).map(k => `<option>${EH(k)}</option>`).join("")}</select><button id="cmp-load" type="button">Carica</button><button id="cmp-save" type="button">Salva come…</button></div>
      <textarea id="cmp-els" rows="2" style="width:100%;box-sizing:border-box;margin-top:4px">${EH(st.els || presets["C H N O S P"])}</textarea>
      <div style="margin:8px 0 2px"><b>Filtri</b> <span class="muted sm">(Seven Golden Rules, Kind e Fiehn 2007)</span></div>
      <div class="cmp-grid">${RULES.map(([k, l]) => `<label><input type="checkbox" data-r="${k}"${(st.rules || []).includes(k) ? " checked" : ""}> ${EH(l)}</label>`).join("")}</div>
      <div class="cmp-grid" style="margin-top:6px"><label>Sottoformula del precursore <input id="cmp-par" value="${EH(o.parent || "")}" placeholder="es. C13H25N4O3S" style="width:150px"></label>
        <label>Isotopi osservati M+1/M <input id="cmp-m1" value="${f4(ob.m1)}" style="width:62px"> M+2/M <input id="cmp-m2" value="${f4(ob.m2)}" style="width:62px"></label>
        <button id="cmp-go" type="button" class="go">Calcola</button></div>
      <div id="cmp-known" class="sm" style="margin-top:6px"></div><div id="cmp-out" style="margin-top:8px"></div>`, () => {
      const $ = s => Q(s);
      $("#cmp-load").onclick = () => { $("#cmp-els").value = presets[$("#cmp-pre").value] || $("#cmp-els").value; };
      $("#cmp-save").onclick = async () => { const n = await ask("Nome della preimpostazione", ""); if (!n) return; const s = rd(); s.presets = { ...(s.presets || {}), [n]: $("#cmp-els").value }; wr(s); toast("Salvata"); };
      const go = async () => {
        const rules = [...document.querySelectorAll("#bigbody [data-r]")].filter(x => x.checked).map(x => x.dataset.r);
        const q = { mz: num($("#cmp-mz").value), ion: $("#cmp-ion").value, tol: num($("#cmp-tol").value) ?? 5, unit: $("#cmp-unit").value, max: parseInt($("#cmp-max").value) || 10,
          n: $("#cmp-n").value, rdb: `${num($("#cmp-r0").value) ?? -1},${num($("#cmp-r1").value) ?? 100}`, elements: $("#cmp-els").value.replace(/\s+/g, ""), rules: rules.join(","), parent: $("#cmp-par").value.trim(), m1: num($("#cmp-m1").value), m2: num($("#cmp-m2").value) };
        if (q.mz == null) { $("#cmp-out").innerHTML = `<span class="fail">Scrivi l'm/z.</span>`; return; }
        if (window.LISTE) await LISTE.ready();
        { const kn = window.LISTE && o.polarity ? LISTE.textFor(q.mz, o.polarity, UIP.hrPpm) : ""; $("#cmp-known").innerHTML = kn ? `<b>Coincide con un contaminante noto:</b> ${EH(kn)} <span class="muted">(compatibilità di massa, non un'identificazione)</span>` : ""; }
        wr({ ...rd(), tol: q.tol, unit: q.unit, max: q.max, n: q.n, r0: num($("#cmp-r0").value), r1: num($("#cmp-r1").value), els: $("#cmp-els").value, rules });
        $("#cmp-out").textContent = "Calcolo…";
        try {
          const j = await J("api/composition?" + Object.entries(q).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"));
          if (!j.results.length) { $("#cmp-out").innerHTML = `<div class="muted">Nessuna formula entro la tolleranza con questi elementi e limiti.</div>`; return; }
          const hasIso = j.results.some(r => r.iso && r.iso.ok != null);
          $("#cmp-out").innerHTML = `<div class="muted sm">${j.n_candidates} candidat${j.n_candidates === 1 ? "o" : "i"}${j.n_candidates > j.results.length ? ` (primi ${j.results.length})` : ""}. Livello di confidenza: formula compatibile con la massa, non identificata.</div>
            <table class="lct"><tr><th>#</th><th>Formula dello ione</th><th>Neutro</th><th class="num">RDB</th><th class="num">Δ mDa</th><th class="num">Δ ppm</th><th>Isotopi M+1 / M+2</th>${hasIso ? "<th>Isotopi</th>" : ""}<th>Regole</th></tr>
            ${j.results.map((r, i) => `<tr><td>${i + 1}</td><td><b>${fmtFormula(r.formula)}</b></td><td>${r.neutral ? fmtFormula(r.neutral) : ""}</td><td class="num">${r.rdb}</td><td class="num">${r.delta_mda}</td><td class="num">${r.delta_ppm}</td>
              <td class="num">${(r.iso.m1 * 100).toFixed(1)}% / ${(r.iso.m2 * 100).toFixed(1)}%</td>${hasIso ? `<td>${r.iso.ok == null ? "" : r.iso.ok ? "compatibili" : "non compatibili"}</td>` : ""}<td>${r.rules_failed.length ? "non passa: " + r.rules_failed.join(", ") : "tutte"}</td></tr>`).join("")}</table>`;
        } catch (e) { $("#cmp-out").innerHTML = `<span class="fail">${EH(e.message)}</span>`; }
      };
      $("#cmp-go").onclick = go;
      if (o.mz != null) go();
    });
  }
  // ---------------------------------------------------------------- «Albero MSn» (WP-H4): the fragmentation paths of an MSn file (server: mzlab/chem/msntree.py, /api/msntree)
  async function tree(k, formula) {
    const f = E.files[k];
    big("Albero MSn", `<div class="muted sm" style="margin-bottom:6px">Ogni riga è un percorso di frammentazione (m/z@attivazione ed energia). Il precursore esatto è letto dal picco più intenso del nodo padre
      (±0,5 Da: nel file c'è il valore nominale); la formula di un nodo è una sottoformula di quella del padre: candidati, non identificazioni.</div>
      <div class="cmp-grid"><label>Formula dello ione al primo stadio <input id="mt-f" value="${EH(formula || "")}" placeholder="es. C13H25N4O3S (facoltativa)" style="width:200px"></label>
        <button id="mt-go" type="button" class="go">Calcola</button></div><div id="mt-out" style="margin-top:8px"></div>`, () => {
      const go = async () => {
        const fm = Q("#mt-f").value.replace(/\s+/g, "");
        Q("#mt-out").textContent = "Calcolo…";
        try {
          const j = await J(`api/msntree?k=${k}${fm ? "&formula=" + encodeURIComponent(fm) : ""}`);
          const nd = j.nodes, depth = n => (n.parent == null ? 0 : 1 + depth(nd[n.parent]));
          Q("#mt-out").innerHTML = `${j.formula_given ? "" : `<div class="muted sm">Senza la formula il primo stadio è solo un candidato${j.root_candidates.length ? `: ${j.root_candidates.slice(0, 6).map(x => `<a href="#" data-rf="${EH(x)}">${fmtFormula(x)}</a>`).join(", ")}` : ""} (clic per fissarla).</div>`}
            <div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1 1 380px;max-height:360px;overflow:auto"><table class="lct" id="mt-tbl"><tr><th>Percorso</th><th>MS</th><th class="num">Scansioni</th><th class="num">Precursore</th><th>Formula</th><th class="num">ppm</th><th></th></tr>
            ${nd.map(n => `<tr data-n="${n.id}" style="cursor:pointer"><td style="padding-left:${6 + 14 * depth(n)}px">${EH(n.path[n.path.length - 1].join("@").replace(/@([A-Za-z]+)@/, "@$1"))}</td><td>${n.level}</td><td class="num">${n.scans}</td>
              <td class="num">${n.prec == null ? "" : n.prec.toFixed(4)}</td><td>${n.formula ? fmtFormula(n.formula) : "–"}</td><td class="num">${n.ppm == null ? "" : n.ppm.toFixed(1)}</td><td class="muted sm">${n.empty ? "quasi vuoto" : ""}</td></tr>`).join("")}</table></div>
            <div id="mt-pk" style="flex:1 1 300px;max-height:360px;overflow:auto"><span class="muted sm">Clic su un nodo: i suoi picchi.</span></div></div>`;
          Q("#mt-out").querySelectorAll("[data-rf]").forEach(a => { a.onclick = ev => { ev.preventDefault(); Q("#mt-f").value = a.dataset.rf; go(); }; });
          Q("#mt-tbl").querySelectorAll("tr[data-n]").forEach(tr => {
            tr.onclick = () => {
              const n = nd[+tr.dataset.n];
              Q("#mt-tbl").querySelectorAll("tr").forEach(x => { x.style.background = ""; }); tr.style.background = "var(--sel, rgba(120,160,255,.2))";
              Q("#mt-pk").innerHTML = `<div><b>${EH(n.label)}</b></div><div class="muted sm">${n.scans} scansioni, ${n.n_peaks} picchi in almeno metà di esse. Clic su un picco: formule compatibili.</div>
                <table class="lct"><tr><th class="num">m/z</th><th class="num">%</th><th>Formula</th><th class="num">ppm</th><th></th></tr>
                ${n.peaks.slice().sort((a, b) => b.rel - a.rel).map(p => `<tr data-mz="${p.mz}" style="cursor:pointer"><td class="num">${p.mz.toFixed(4)}</td><td class="num">${p.rel}</td><td>${p.formula ? fmtFormula(p.formula) : "–"}</td><td class="num">${p.ppm == null ? "" : p.ppm.toFixed(1)}</td><td class="muted sm">${p.contam ? "contaminazione?" : ""}</td></tr>`).join("")}</table>`;
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
