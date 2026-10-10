// TPMINE-PRIVATE  mzFinder M2: expert tools on the difference map A - B (points, co-elution groups, roles with proof, time course).
// Loaded only with mzFinder on. The page gathers the numbers (difference grid, XIC of every file); the decisions are in py/tpmine/esperti.py.
// Everything shown is a candidate with its numeric proof, never a certainty.
(() => {
  "use strict";
  const KEY = "qqq.mzfinder.soglie";
  const DEF = { min_sn: 5, min_ratio: 3, min_width: 0.03, max_points: 60, apex_tol: 0.05, r_min: 0.9, rsd_max: 0.15 };
  const LAB = {
    min_sn: ["Minimum S/N in A", "(A − median) / (1.4826 × MAD) on the map of A"], min_ratio: ["Minimum A/B ratio", "Ratio between A and B (with the RT tolerance of the difference)"],
    min_width: ["Minimum width (min)", "RT width of the peak at half height of the difference"], max_points: ["Maximum points", "The most intense points of the difference are kept"],
    apex_tol: ["Apex distance (min)", "Two points are in the same group if their apexes are at most this far apart"], r_min: ["Minimum r (Pearson)", "Correlation of the XIC shapes (±0.3 min) to be in the same group"],
    rsd_max: ["Maximum RSD of the area ratio", "An in-source fragment has a constant area ratio over time (RSD below this value)"],
  };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const load = () => { try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) || "{}") || {}) }; } catch (_) { return { ...DEF }; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* private mode: only for this page */ } };
  const num = (v, d) => v == null || !Number.isFinite(+v) ? "–" : (+v).toFixed(d);
  const fmtA = v => v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "k" : String(Math.round(v));
  const mapPanel = () => { const ok = q => q.type === "map" && q.el && q._a && q._a.ref && q._a.f; return ok(E.active || {}) ? E.active : E.panels.find(ok) || null; };

  function spark(areas) {                       // tiny line of the areas over the files (the column «Time course»)
    const mx = Math.max(...areas, 1e-9), w = 70, h = 18, n = areas.length;
    const pts = areas.map((a, i) => `${(n > 1 ? i / (n - 1) * (w - 4) : 0) + 2},${h - 2 - a / mx * (h - 4)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="area per file"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  async function analyse(p, th, say) {
    const f = p._a.f, rf = p._a.ref, lv = f.lv || 1, hr = !!(window.HR && HR.isHr(f, lv)), ppm = hr ? ((HR.prof(f, lv) || {}).tol || 5) : 0;
    const rttol = window.MAPPA ? MAPPA.diffOpt().rttol : 0.1;
    say("Reading the map of A and the difference A − B…");
    const [A, D] = await Promise.all([J(`api/map?k=${f.k}&level=${lv}`), J(`api/map?k=${f.k}&level=${lv}&ref=${rf.k}&norm=abs&rttol=${rttol}`)]);
    say("Looking for local maxima (Python)…");
    const t = await QTOOLS.call("esperti_trova", { diff: D.data, a: A.data, nrt: A.nrt, nmz: A.nmz, rt0: A.rt0, rt1: A.rt1, mz0: A.mz0, dmz: A.dmz, soglie: th });
    const pts = t.points; if (!pts.length) return { pts: [], rows: [], hr, f, rf, lv };
    const files = E.files.filter(x => !x.gone && x.kind === f.kind && x.polarity === f.polarity && x.type === "sample" && x.time != null).sort((a, b) => a.time - b.time || a.k - b.k);
    if (!files.some(x => x.k === f.k)) files.push(f);
    const ks = files.map(x => x.k).join(",");
    const losses = typeof LOSSES !== "undefined" ? LOSSES.map(x => x.f) : [];
    for (let i = 0; i < pts.length; i++) {
      say(`XIC of every file at point ${i + 1} of ${pts.length}…`);
      const q = pts[i], c = hr ? q.mz : Math.round(q.mz) + 0.3, tol = hr ? q.mz * ppm * 1e-6 : 0.5;
      const x = await J(`api/xic?k=${ks}&mz=${c}&tol=${tol}&level=${lv}`);
      q.traces = {};
      for (const tr of x.traces) { const rt = [], y = []; tr.rt.forEach((r, j) => { if (Math.abs(r - q.rt) <= 0.5) { rt.push(r); y.push(tr.y[j]); } }); q.traces[tr.k] = { rt, y }; }
      if (hr) {
        try { const c2 = await J(`api/composition?mz=${q.mz}&ion=${encodeURIComponent(f.polarity === "negative" ? "[M-H]-" : "[M+H]+")}&tol=${ppm}&unit=ppm&max=5`); q.forms = (c2.results || c2.candidates || []).map(r => r.formula).filter(Boolean); } catch (_) { q.forms = []; }
      }
    }
    say("Co-elution groups, roles and time course (Python)…");
    const r = await QTOOLS.call("esperti_analisi", { points: pts, files: files.map(x => ({ k: x.k, time: x.time, label: x.label })), hr, ppm: ppm || 5, losses, soglie: th });
    return { rows: r.rows, hr, f, rf, lv, files };
  }

  const COLS = [["n", "#"], ["rt", "RT"], ["mz", "m/z"], ["diff", "A − B"], ["g", "Group"], ["r", "r"], ["role", "Proposed role"], ["proof", "Proof"], ["spark", "Time course"], ["trend", "Shape"], ["score", "Priority"]];

  function open(body) {
    const th = load();
    body.innerHTML = `<div class="tp" style="display:block"><div class="card"><h3>Find points on the difference map</h3>
      <p class="mut">Local maxima of the difference A − B of the open map (choose «difference with» in the map panel). Co-elution groups, proposed roles with the numeric proof and time course: they are <b>candidates</b>, not answers.</p>
      <details><summary>Thresholds</summary><div class="kv" id="esp-th">${Object.keys(DEF).map(k => `<b title="${esc(LAB[k][1])}">${esc(LAB[k][0])}</b><input data-k="${k}" type="number" step="any" value="${th[k]}" style="width:90px">`).join("")}</div>
      <div class="row"><button id="esp-def" type="button">Default values</button></div></details>
      <div class="row"><button id="esp-go" type="button">Find points</button><span id="esp-st" class="mut" role="status"></span></div></div>
      <div id="esp-out"></div></div>`;
    const $ = s => body.querySelector(s), st = $("#esp-st");
    const read = () => { const v = { ...DEF }; body.querySelectorAll("#esp-th input").forEach(i => { const x = parseFloat(String(i.value).replace(",", ".")); if (Number.isFinite(x) && x >= 0) v[i.dataset.k] = x; }); return v; };
    body.querySelectorAll("#esp-th input").forEach(i => i.onchange = () => save(read()));
    $("#esp-def").onclick = () => { save({ ...DEF }); open(body); };
    $("#esp-go").onclick = async () => {
      const p = mapPanel(); const out = $("#esp-out");
      if (!p) { st.textContent = "Open a map and choose «difference with» another file."; return; }
      const v = read(); save(v); $("#esp-go").disabled = true; out.innerHTML = "";
      try {
        const R = await analyse(p, v, t => { st.textContent = t; });
        st.textContent = R.rows.length ? `${R.rows.length} points` : "No points above the thresholds.";
        if (R.rows.length) show(out, R, p);
      } catch (e) { st.textContent = ""; out.innerHTML = `<p class="err">${esc(e && e.message || e)}</p>`; }
      $("#esp-go").disabled = false;
    };
  }

  function show(out, R, p) {
    let sort = { c: "score", d: -1 };
    const val = (r, c) => c === "spark" ? 0 : r[c] == null ? -Infinity : r[c];
    const dec = R.hr ? 4 : 1;
    const draw = () => {
      const view = R.rows.slice().sort((u, v) => (typeof val(u, sort.c) === "string" ? String(val(u, sort.c)).localeCompare(String(val(v, sort.c))) : val(u, sort.c) - val(v, sort.c)) * sort.d);
      out.innerHTML = `<div class="card"><div class="row"><b>mzFinder · ${R.rows.length} points</b><span class="mut">${esc(R.f.label)} − ${esc(R.rf.label)} · ${R.hr ? "ppm" : "nominal bins"}</span><span class="grow"></span>
        <button id="esp-xl" type="button">Excel</button><button id="esp-mk" type="button" title="Adds the points to the map's table of marked points">Mark on the map</button></div>
        <div class="tbl"><table><thead><tr>${COLS.map(([c, t]) => `<th data-c="${c}"${c === "spark" ? "" : ' style="cursor:pointer"'}>${t}${sort.c === c ? (sort.d > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>${view.map(r =>
          `<tr><td class="n">${r.n}</td><td class="n">${num(r.rt, 2)}</td><td class="n">${num(r.mz, dec)}</td><td class="n">${fmtA(r.diff)}</td><td class="n">${r.g}</td><td class="n">${num(r.r, 2)}</td><td>${esc(r.role)}</td><td>${esc(r.proof)}</td><td>${spark(r.areas)}</td><td>${esc(r.trend)}</td><td class="n"><b>${num(r.score, 1)}</b></td></tr>`).join("")}</tbody></table></div>
        <p class="mut">Initial order by priority (difference intensity × role × time course). «Possible in-source fragment» requires co-elution and an area ratio that is constant over time: it is a candidate, not a certainty.</p></div>`;
      out.querySelectorAll("th[data-c]").forEach(th => { if (th.dataset.c !== "spark") th.onclick = () => { const c = th.dataset.c; sort = { c, d: sort.c === c ? -sort.d : (c === "role" || c === "proof" || c === "trend" ? 1 : -1) }; draw(); }; });
      out.querySelector("#esp-xl").onclick = () => {
        const head = COLS.filter(c => c[0] !== "spark").map(c => c[1]).concat(R.files.map(x => "Area " + x.label));
        const rows = view.map(r => [r.n, +r.rt.toFixed(3), +r.mz.toFixed(5), Math.round(r.diff), r.g, r.r == null ? "" : +r.r.toFixed(3), r.role, r.proof, r.trend, r.score].concat(r.areas.map(a => Math.round(a))));
        dlx("mzFinder_points.xlsx", [{ name: "Points", head, rows }, { name: "Parameters", head: ["Parameter", "Value"], rows: [["A", R.f.label], ["B", R.rf.label], ["Level", R.lv], ["High resolution", R.hr ? "yes" : "no"], ...Object.entries(load()).map(([k, v]) => [LAB[k][0], v])] }]);
      };
      out.querySelector("#esp-mk").onclick = () => {
        if (!window.MAPPA) return; const list = MAPPA.pts(p); let n = 0;
        R.rows.forEach(r => { if (!list.some(q => Math.abs(q.rt - r.rt) < 1e-3 && Math.abs(q.mz - r.mz) < 1e-3)) { list.push({ rt: r.rt, mz: r.mz, note: r.role }); n++; } });
        try { nbSave(); draw_(p); } catch (_) { /* the map is redrawn on its next change */ }
        out.querySelector("#esp-mk").textContent = `Marked ${n}`;
      };
    };
    const draw_ = q => { try { window.draw && window.draw(q); } catch (_) { /* ignore */ } };
    draw();
  }

  QTOOLS.register({ id: "esperti", nav: false, name: "Find points", desc: "Maxima of the difference A − B with groups, roles and time course (teacher only)", open });
})();
