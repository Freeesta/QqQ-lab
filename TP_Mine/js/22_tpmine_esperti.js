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
    body.innerHTML = `<div class="tp" style="display:block"><div class="card"><h3>Find points on the difference map <i class="tp-q" style="display:inline-grid;place-items:center;width:16px;height:16px;border:1px solid var(--muted);border-radius:50%;font-size:11px;color:var(--muted);cursor:help;font-style:normal;vertical-align:middle" id="esp-h" tabindex="0" role="note" aria-label="About Find points" title="No low-resolution file is needed: it works with any open series, LR or HR. Open the map, choose «difference with» (e.g. t60 − t0), then press Find points: it finds the maxima of A − B, groups them by co-elution, proposes a role (isotope, adduct, loss) and shows the time course of the area in all files.">?</i></h3>
      <ol class="mut" style="margin:0 0 6px;padding-left:18px"><li>Open the map of a series (LR or HR; no low-resolution file is required).</li><li>Choose «difference with» and a reference file (e.g. t60 − t0).</li><li>Press «Find points»: maxima of A − B are grouped by co-elution.</li><li>Each group gets a proposed role (isotope, adduct, loss) and the time course of its area in all files.</li></ol>
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


  // ---- the card of one feature (click on a row): XIC of every file, cropped map, time course, MS1 / MS2 at the apex. Heavy numbers: Python (esperti_feature), only for this point.
  const CS = n => (window.OKABE || ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000"])[n % 8];
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#888";
  function svg(w, h, body, label) { return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img" aria-label="${esc(label)}">${body}</svg>`; }
  function axes(W, H, m, x0, x1, y1, xl) {      // frame + ticks: returns the mapping functions
    const X = v => m.l + (v - x0) / ((x1 - x0) || 1) * (W - m.l - m.r), Y = v => H - m.b - v / (y1 || 1) * (H - m.t - m.b);
    let g = `<line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="${css("--muted")}"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" stroke="${css("--muted")}"/>`;
    for (let i = 0; i <= 4; i++) { const v = x0 + (x1 - x0) * i / 4; g += `<text x="${X(v)}" y="${H - m.b + 12}" font-size="10" text-anchor="middle" fill="${css("--muted")}">${v.toFixed(xl)}</text>`; }
    g += `<text x="${m.l - 3}" y="${m.t + 8}" font-size="10" text-anchor="end" fill="${css("--muted")}">${fmtA(y1)}</text>`;
    return { X, Y, g };
  }
  const b64f32 = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };

  async function cardFor(box, R, row, p, rows, goto) {
    const hr = R.hr, lv = R.lv, f = R.f, files = R.files, ks = files.map(x => x.k).join(",");
    const st = box._st || (box._st = { w: hr ? 5 : 0.5, half: 1.0, zrt: 1.0, zmz: hr ? 0.05 : 5 });        // w = ppm (HR) or ±Da (LR); half = RT window; zrt/zmz = half sizes of the cropped map
    const members = rows.filter(r => r.g === row.g && r.n !== row.n).map(r => ({ n: r.n, rt: r.rt, mz: r.mz }));
    const c = hr ? row.mz : Math.round(row.mz) + 0.3, tol = hr ? row.mz * st.w * 1e-6 : st.w;
    box.innerHTML = `<div class="card" id="esp-feat"><div class="row"><b>Point ${row.n} · RT ${num(row.rt, 2)} · m/z ${num(row.mz, hr ? 4 : 1)}</b><span class="mut">${esc(row.role)}</span><span class="grow"></span>
      <button type="button" id="ef-prev" title="Previous point (↑)">↑</button><button type="button" id="ef-next" title="Next point (↓)">↓</button>
      <button type="button" id="ef-open" title="Opens the XIC of this m/z in the Data tab">Open in Data</button><button type="button" id="ef-copy">Copy m/z, RT</button></div>
      <div class="row"><label>XIC width (${hr ? "±ppm" : "±Da"}) <input id="ef-w" type="number" step="any" min="0" value="${st.w}" style="width:70px"></label>
      <label>RT window (±min) <input id="ef-h" type="number" step="any" min="0.1" value="${st.half}" style="width:70px"></label><button type="button" id="ef-re">Recalculate</button><span id="ef-st" class="mut" role="status">Loading…</span></div>
      <div id="ef-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:10px"><div id="ef-xic"></div><div id="ef-map"></div><div id="ef-trend"></div><div id="ef-spec"></div></div></div>`;
    const $ = q => box.querySelector(q), say = t => { $("#ef-st").textContent = t; };
    $("#ef-prev").onclick = () => goto(-1); $("#ef-next").onclick = () => goto(1);
    $("#ef-open").onclick = () => { try { if (typeof xicDirect === "function") xicDirect(row.mz); const t = document.querySelector('[data-tab="data"],#tab-data'); if (t && t.click) t.click(); } catch (_) { /* the Data tab is optional */ } };
    $("#ef-copy").onclick = () => { const t = `${row.mz.toFixed(hr ? 5 : 2)}\t${row.rt.toFixed(3)}`; try { navigator.clipboard.writeText(t); $("#ef-copy").textContent = "Copied"; } catch (_) { $("#ef-copy").textContent = t; } };
    $("#ef-re").onclick = () => { const w = parseFloat($("#ef-w").value), h = parseFloat($("#ef-h").value); if (w >= 0) st.w = w; if (h > 0) st.half = h; cardFor(box, R, row, p, rows, goto); };
    const mine = ++box._seq || (box._seq = 1);
    try {
      const x = await J(`api/xic?k=${ks}&mz=${c}&tol=${tol}&level=${lv}`);
      const traces = {}; x.traces.forEach(tr => { const rt = [], y = []; tr.rt.forEach((r, j) => { if (Math.abs(r - row.rt) <= st.half) { rt.push(r); y.push(tr.y[j]); } }); traces[tr.k] = { rt, y }; });
      const best = files.reduce((b, fl) => (Math.max(...(traces[fl.k] || { y: [0] }).y) > Math.max(...(traces[b.k] || { y: [0] }).y) ? fl : b), files[0]);
      let spectrum = null, ms2 = null;
      try {
        const n1 = await J(`api/nearest_scan?k=${best.k}&rt=${row.rt}&level=${lv}`);
        const sp = await J(`api/spectrum?k=${best.k}&rt0=${n1.rt - 0.005}&rt1=${n1.rt + 0.005}&level=${lv}&bin=${hr ? 0.001 : 0.1}`);
        const d = hr ? 1.5 : 12; spectrum = { mz: [], y: [], rt: n1.rt };
        sp.mz.forEach((m, i) => { if (Math.abs(m - row.mz) <= d) { spectrum.mz.push(m); spectrum.y.push(sp.y[i]); } });
      } catch (_) { spectrum = null; }
      try {
        const n2 = await J(`api/nearest_scan?k=${best.k}&rt=${row.rt}&level=2&precursor=${row.mz}`);
        if (n2 && n2.rt != null && Math.abs(n2.rt - row.rt) <= 0.3) { const s2 = await J(`api/spectrum?k=${best.k}&rt0=${n2.rt - 0.005}&rt1=${n2.rt + 0.005}&level=2&precursor=${row.mz}&bin=${hr ? 0.001 : 0.1}`); if (s2 && s2.mz && s2.mz.length) ms2 = { mz: s2.mz, y: s2.y, rt: n2.rt }; }
      } catch (_) { ms2 = null; }
      const F = await QTOOLS.call("esperti_feature", { point: { rt: row.rt, mz: row.mz }, files: files.map(x => ({ k: x.k, time: x.time, label: x.label })), traces, members, spectrum, hr, ppm: hr ? st.w : 5, half: Math.min(st.half, 0.5) });
      if (box._seq !== mine) return;
      say("");
      // (a) XIC of every file with the integration edges and the area
      const W = 440, H = 230, m = { l: 44, r: 8, t: 8, b: 20 };
      let ymax = 1; files.forEach(fl => (traces[fl.k] ? traces[fl.k].y : []).forEach(v => { if (v > ymax) ymax = v; }));
      const ax = axes(W, H, m, row.rt - st.half, row.rt + st.half, ymax, 2); let body = ax.g;
      files.forEach((fl, i) => {
        const tr = traces[fl.k]; if (!tr || !tr.rt.length) return; const col = CS(i), pb = F.files[i];
        body += `<polyline fill="none" stroke="${col}" stroke-width="1.5" points="${tr.rt.map((r, j) => ax.X(r).toFixed(1) + "," + ax.Y(tr.y[j]).toFixed(1)).join(" ")}"/>`;
        if (pb && pb.area > 0) body += `<line class="ef-edge" x1="${ax.X(pb.a)}" y1="${m.t}" x2="${ax.X(pb.a)}" y2="${H - m.b}" stroke="${col}" stroke-dasharray="3 3" opacity=".6"/><line class="ef-edge" x1="${ax.X(pb.b)}" y1="${m.t}" x2="${ax.X(pb.b)}" y2="${H - m.b}" stroke="${col}" stroke-dasharray="3 3" opacity=".6"/>`;
      });
      const leg = files.map((fl, i) => `<span style="white-space:nowrap;margin-right:8px"><span style="display:inline-block;width:10px;height:3px;background:${CS(i)};vertical-align:middle"></span> ${esc(fl.label)}${fl.time != null ? ` (${fl.time} min)` : ""}: ${fmtA(F.areas[i])}</span>`).join("");
      $("#ef-xic").innerHTML = `<b>XIC in ${files.length} files</b> <span class="mut">(dashed = integration edges; area in intensity × min)</span>${svg(W, H, body, "XIC of the point in every file")}<div class="mut" style="font-size:12px">${leg}</div>`;
      // (c) time course
      const mx = Math.max(...F.areas, 1e-9), TW = 440, TH = 150, tm = { l: 44, r: 10, t: 10, b: 22 };
      const ts = files.map(fl => fl.time), t0 = Math.min(...ts.filter(v => v != null), 0), t1 = Math.max(...ts.filter(v => v != null), 1);
      const at = axes(TW, TH, tm, t0, t1, mx, 0);
      const tp = files.map((fl, i) => (fl.time != null ? at.X(fl.time) : at.X(t0)).toFixed(1) + "," + at.Y(F.areas[i]).toFixed(1));
      $("#ef-trend").innerHTML = `<b>Area over time</b> · <b id="ef-cls">${esc(F.trend || "–")}</b>${svg(TW, TH, at.g + `<polyline fill="none" stroke="${css("--ink")}" stroke-width="1.5" points="${tp.join(" ")}"/>` + files.map((fl, i) => `<circle cx="${tp[i].split(",")[0]}" cy="${tp[i].split(",")[1]}" r="3.5" fill="${CS(i)}"/>`).join(""), "Area of the peak over time")}`;
      // (d) spectrum at the apex, the group peaks highlighted
      const stem = (sp, pk, mark, tag) => {
        const SW = 440, SH = 150, sm = { l: 44, r: 8, t: 10, b: 20 }; const lo = Math.min(...sp.mz), hi = Math.max(...sp.mz), yM = Math.max(...sp.y, 1);
        const a2 = axes(SW, SH, sm, lo, hi, yM, hr ? 2 : 0); let g = a2.g;
        sp.mz.forEach((v, i) => { const mk = mark ? pk[i] && pk[i].mark != null : false; g += `<line class="${mk ? "ef-hi" : ""}" x1="${a2.X(v)}" y1="${a2.Y(0)}" x2="${a2.X(v)}" y2="${a2.Y(sp.y[i])}" stroke="${mk ? CS(3) : css("--muted")}" stroke-width="${mk ? 2 : 1}"/>`; });
        return svg(SW, SH, g, tag);
      };
      let sh = spectrum && spectrum.mz.length ? `<b>MS<sup>1</sup> at RT ${num(spectrum.rt, 2)}</b> <span class="mut">(${esc(best.label)}; group peaks in colour)</span>${stem(spectrum, F.peaks, true, "MS1 spectrum at the apex")}` : `<b>MS<sup>1</sup></b> <span class="mut">no scan found</span>`;
      sh += ms2 ? `<b>MS<sup>2</sup> at RT ${num(ms2.rt, 2)}</b>${stem(ms2, [], false, "MS2 spectrum nearest to the apex")}` : `<div class="mut">No MS<sup>2</sup> of this precursor near the apex.</div>`;
      $("#ef-spec").innerHTML = sh;
    } catch (e) { say(""); $("#ef-xic").innerHTML = `<p class="err">${esc(e && e.message || e)}</p>`; }
    if (box._seq !== mine) return;
    // (b) the map cropped around the point: wheel / drag / keys, redrawn from api/map (a region of the true data)
    mapCrop(box, $("#ef-map"), R, row, members, st);
  }

  async function mapCrop(box, host, R, row, members, st) {
    const hr = R.hr, f = R.f, lv = R.lv, W = 440, H = 260;
    host.innerHTML = `<b>Map RT × m/z</b> <span class="mut">(wheel = zoom, drag or arrow keys = move; circle = this point, squares = its group)</span><canvas id="ef-cv" width="${W}" height="${H}" tabindex="0" role="img" aria-label="Map around the point" style="width:100%;max-width:${W}px;border:1px solid var(--line);cursor:grab"></canvas>`;
    const cv = host.querySelector("#ef-cv"), ctx = cv.getContext("2d"); let cx = row.rt, cy = row.mz, busy = 0;
    const draw = async () => {
      const my = ++busy, rt0 = cx - st.zrt, rt1 = cx + st.zrt, mz0 = cy - st.zmz, mz1 = cy + st.zmz;
      let M; try { M = await J(`api/map?k=${f.k}&level=${lv}&rt0=${rt0}&rt1=${rt1}&mz0=${mz0}&mz1=${mz1}&nrt=${hr ? 160 : 120}&nmz=${hr ? 120 : 80}`); } catch (_) { return; }
      if (my !== busy) return;
      const g = b64f32(M.data), nrt = M.nrt, nmz = M.nmz; let mx = 0; for (const v of g) if (v > mx) mx = v;
      ctx.fillStyle = css("--bg"); ctx.fillRect(0, 0, W, H);
      const cw = W / nrt, ch = H / nmz;
      for (let i = 0; i < nrt; i++) for (let j = 0; j < nmz; j++) { const v = mx > 0 ? Math.sqrt(g[i * nmz + j] / mx) : 0; if (v < 0.02) continue; ctx.fillStyle = `rgba(0,114,178,${Math.min(1, v).toFixed(2)})`; ctx.fillRect(i * cw, H - (j + 1) * ch, cw + 0.5, ch + 0.5); }
      const px = r => (r - rt0) / (rt1 - rt0) * W, py = z => H - (z - mz0) / (mz1 - mz0) * H;
      ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(row.rt), py(row.mz), 9, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#D55E00"; members.forEach(q => { ctx.strokeRect(px(q.rt) - 5, py(q.mz) - 5, 10, 10); });
      ctx.fillStyle = css("--muted"); ctx.font = "10px sans-serif"; ctx.fillText(`RT ${rt0.toFixed(2)}–${rt1.toFixed(2)} min · m/z ${mz0.toFixed(hr ? 3 : 1)}–${mz1.toFixed(hr ? 3 : 1)}`, 4, 11);
      cv.dataset.ready = "1"; cv.dataset.members = String(members.length);
    };
    cv.addEventListener("wheel", e => { e.preventDefault(); const k = e.deltaY < 0 ? 0.8 : 1.25; st.zrt = Math.min(5, Math.max(0.05, st.zrt * k)); st.zmz = Math.min(hr ? 2 : 40, Math.max(hr ? 0.002 : 0.5, st.zmz * k)); draw(); }, { passive: false });
    let drag = null; cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", e => { if (!drag) return; const r = cv.getBoundingClientRect(); cx -= (e.clientX - drag.x) / r.width * 2 * st.zrt; cy += (e.clientY - drag.y) / r.height * 2 * st.zmz; drag = { x: e.clientX, y: e.clientY }; draw(); });
    cv.addEventListener("pointerup", () => { drag = null; cv.style.cursor = "grab"; });
    cv.addEventListener("keydown", e => {
      const dx = st.zrt * 0.25, dy = st.zmz * 0.25; let used = true;
      if (e.key === "ArrowLeft") cx -= dx; else if (e.key === "ArrowRight") cx += dx; else if (e.key === "ArrowUp") cy += dy; else if (e.key === "ArrowDown") cy -= dy;
      else if (e.key === "+" || e.key === "=") { st.zrt *= 0.8; st.zmz *= 0.8; } else if (e.key === "-") { st.zrt *= 1.25; st.zmz *= 1.25; } else if (e.key === "0") { cx = row.rt; cy = row.mz; } else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); draw(); }
    });
    draw();
  }

  function show(out, R, p) {
    let sort = { c: "score", d: -1 }, sel = null;
    const val = (r, c) => c === "spark" ? 0 : r[c] == null ? -Infinity : r[c];
    const dec = R.hr ? 4 : 1;
    const draw = () => {
      const view = R.rows.slice().sort((u, v) => (typeof val(u, sort.c) === "string" ? String(val(u, sort.c)).localeCompare(String(val(v, sort.c))) : val(u, sort.c) - val(v, sort.c)) * sort.d);
      out.innerHTML = `<div class="card"><div class="row"><b>mzFinder · ${R.rows.length} points</b><span class="mut">${esc(R.f.label)} − ${esc(R.rf.label)} · ${R.hr ? "ppm" : "nominal bins"}</span><span class="grow"></span>
        <button id="esp-xl" type="button">Excel</button><button id="esp-mk" type="button" title="Adds the points to the map's table of marked points">Mark on the map</button></div>
        <div class="tbl"><table><thead><tr>${COLS.map(([c, t]) => `<th data-c="${c}"${c === "spark" ? "" : ' style="cursor:pointer"'}>${t}${sort.c === c ? (sort.d > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>${view.map(r =>
          `<tr data-n="${r.n}" tabindex="0" style="cursor:pointer"><td class="n">${r.n}</td><td class="n">${num(r.rt, 2)}</td><td class="n">${num(r.mz, dec)}</td><td class="n">${fmtA(r.diff)}</td><td class="n">${r.g}</td><td class="n">${num(r.r, 2)}</td><td>${esc(r.role)}</td><td>${esc(r.proof)}</td><td>${spark(r.areas)}</td><td>${esc(r.trend)}</td><td class="n"><b>${num(r.score, 1)}</b></td></tr>`).join("")}</tbody></table></div>
        <p class="mut">Click a row for the card of the point (↑ ↓ = previous / next).</p><div id="esp-card"></div>
        <p class="mut">Initial order by priority (difference intensity × role × time course). «Possible in-source fragment» requires co-elution and an area ratio that is constant over time: it is a candidate, not a certainty.</p></div>`;
      const box = out.querySelector("#esp-card");
      const pick = n => { const r = view.find(x => x.n === n); if (!r) return; sel = n; out.querySelectorAll("tbody tr").forEach(t => { t.style.outline = +t.dataset.n === n ? "2px solid var(--accent)" : ""; }); cardFor(box, R, r, p, R.rows, d => { const i = view.findIndex(x => x.n === sel); const j = Math.min(view.length - 1, Math.max(0, i + d)); pick(view[j].n); }); };
      out.querySelectorAll("tbody tr").forEach(tr => { tr.onclick = () => pick(+tr.dataset.n); tr.onkeydown = e => { if (e.key === "Enter") pick(+tr.dataset.n); }; });
      out.onkeydown = e => { if ((e.key === "ArrowDown" || e.key === "ArrowUp") && sel != null && !/INPUT|CANVAS/.test(e.target.tagName)) { e.preventDefault(); const i = view.findIndex(x => x.n === sel), j = Math.min(view.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))); pick(view[j].n); } };
      if (sel != null && view.some(x => x.n === sel)) pick(sel);
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
