"use strict";
// Banco HR (WP-H3a): the cells of the high-resolution bench, as the model of Xcalibur Qual Browser. Classic script, loaded after tabs.js.
// A cell is one panel of the page. In the high-resolution world every chromatogram and spectrum cell gets
//   - a SCAN FILTER (the type of scan it shows: «FTMS + p ESI Full ms», «FTMS + ms2 @hcd», for an infusion MSn file one filter for each path of
//     fragmentation), listed by the server with the number of scans of each type (/api/filters); the filter goes to every request of the cell;
//   - a PIN: a pinned spectrum does not follow the cursor of its chromatogram; a pinned chromatogram is not taken by the MS2 list.
// The active cell (the last one clicked) has an outline. Nothing here exists in the low-resolution world: the functions return at once.
const BANCO = (() => {
  const st = document.createElement("style");
  st.textContent = `.hrw .pnl.act{box-shadow:0 0 0 2px var(--accent)}
.bfw{display:inline-flex;align-items:center;gap:4px;margin-left:6px}.bfw select{max-width:21em;min-width:9em}.bfw .pin{padding:2px 5px}.bfw .pin.on{background:var(--sel);color:var(--accent);border-color:var(--accent)}`;
  document.head.appendChild(st);
  const on = () => !!window.HR && E.files.some(f => f && !f.gone && (HR.isHr(f, 1) || HR.isHr(f, 2)));
  const sync = () => { try { document.body.classList.toggle("hrw", on()); } catch (e) { /* page not ready */ } return on(); };
  const groupsOf = k => memo(`flt|${k}`, () => J(`api/filters?k=${k}`).then(j => j.filters));
  const nfmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const IC_PIN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 1.8l4.7 4.7-2 .6-2.4 2.6.1 3-1 1-2.6-3.1-3.6 3.6-.4-.4 3.6-3.6-3.1-2.6 1-1 3 .1 2.6-2.4z"/></svg>';
  // which cells have a scan filter: not the product-ion spectrum of the DDA trio (its scan is the one the survey scan started) nor the MRM ones
  const eligible = p => (p.type === "chrom" || p.type === "spec") && p.dda == null && p.dock == null && p.tab !== "mrm";
  // the file whose scan types the menu of a cell lists: the one of the cell, or the first visible one of its tab
  function fileOf(p) {
    if (p.type === "spec" && E.files[p.k] && !E.files[p.k].gone) return E.files[p.k];
    return tabFiles(p.tab || E.tab).filter(f => f.vis !== false && f.kind !== "mrm")[0] || null;
  }
  const levelOk = (p, g) => (p.tab === "ms2" ? g.level >= 2 : g.level === 1);
  // all the cells that show the scans of the same chromatogram take the filter together (the chromatogram, its spectra)
  const group = p => { const ids = new Set([p.id]); E.panels.forEach(q => { if (q.type === "spec" && (q.link === p.id || q.src === p.id)) ids.add(q.id); if (p.type === "spec" && (p.link === q.id || p.src === q.id)) ids.add(q.id); }); return E.panels.filter(q => ids.has(q.id)); };
  function setFilter(p, key, gs) {
    const g = key ? gs.find(x => x.key === key) : null;
    group(p).forEach(q => {
      if (q.type === "chrom" && !eligible(q)) return;
      q.filt = key || null;
      if (g && g.level > 1) { q.prec = null; if (q.type === "chrom") q.title = "Cromatogramma"; }       // the type of scan already says which precursor: not one chosen before
      if (q.type === "chrom") q.flv = g ? g.level : null;
      else { if (g) q.level = g.level; q.zoom = null; q.zoomY = null; q.lock = null; q.si = null; q.meas = null; }
      ctl(q); draw(q);
    });
    uiSave();
  }
  function setPin(p, v) {
    p.pin = !!v;
    if (p.type === "spec") { if (v && p.link) freezeSpec(p); else if (!v && !p.link && p.src) { const s = E.panels.find(q => q.id === p.src); if (s) liveSpec(p, s); } }
    ctl(p); uiSave();
  }
  // ---------------------------------------------------------------- stacked graphs of a chromatogram cell (the «Ranges» of Xcalibur)
  // p.ranges = [{id, kind: "tic" | "bpc" | "xic", mz, ppm, filt, flv, prec, label}], at most 8. Every range is one row of the stacked chromatogram, with the
  // files of the bench overlaid in it; every row says its NL (the highest intensity) and p.norm100 puts them all on the 0-100 scale.
  const MAXR = 8;
  const baseOf = f => (f.file || "").split("#")[0];
  const filesFor = lv => {
    const seen = new Set(), out = [];
    vis().forEach(f => { const b = baseOf(f); if (f.kind === "mrm" || seen.has(b)) return; seen.add(b); const sib = E.files.find(g => !g.gone && baseOf(g) === b && (lv > 1 ? g.kind === "ms2" : g.kind === "full")); if (sib) out.push({ f: sib, vis: f }); });
    return out;
  };
  const rangeLabel = r => r.label || ((r.kind === "xic" ? `XIC ${r.mz}` : r.kind.toUpperCase()) + (r.filt ? " · " + r.filt : r.flv > 1 ? " · MS" + r.flv : ""));
  async function rangeSeries(p) {
    const out = [], jobs = [];
    p.ranges.forEach((r, ri) => {
      const lv = r.flv || 1;
      filesFor(lv).forEach(({ f, vis: vf }) => {
        const q = HR.prof(f, lv), w = r.kind === "xic" ? r.mz * (r.ppm ?? q.tol) * 1e-6 : null;
        jobs.push(getChrom(f.k, r.kind === "xic" ? "tic" : r.kind, lv, w != null ? r.mz - w : null, w != null ? r.mz + w : null, r.prec ?? null, r.filt || null).then(d => {
          if (d.rt.length) out.push({ x: d.rt, y: d.y, color: vf.color, dash: fdash(vf), name: `${rangeLabel(r)} · ${vf.label}`, k: f.k, key: `r|${r.id}|${f.k}`, ion: rangeLabel(r), time: vf.time, grp: ri, rlabel: rangeLabel(r) });
        }));
      });
    });
    await Promise.all(jobs);
    return out.sort((a, b) => a.grp - b.grp || a.k - b.k);
  }
  async function addRange(p) {
    if ((p.ranges || []).length >= MAXR) return info(`Al massimo ${MAXR} grafici impilati in una cella.`);
    const f0 = fileOf(p) || vis()[0]; if (!f0) return;
    const groups = await groupsOf(f0.k).catch(() => []);
    const opt = g => `<option value="${EH(g.key)}" data-lv="${g.level}">${EH(g.key)} \u00d7${nfmt(g.n)}</option>`;
    big("Aggiungi un grafico impilato", `<div class="muted sm" style="margin-bottom:6px">Ogni grafico ha la sua riga sullo stesso asse del tempo, con «NL» (l'intensità massima).</div>
      <div class="cmp-grid"><label>Tipo <select id="br-kind"><option value="tic">TIC (somma)</option><option value="bpc">BPC (picco base)</option><option value="xic">XIC di uno ione</option></select></label>
      <label id="br-ionw" hidden>m/z o formula <input id="br-ion" placeholder="317.1642 oppure C13H24N4O3S" style="width:200px"> <select id="br-ad"><option>[M+H]+</option><option>[M+Na]+</option><option>[M+NH4]+</option><option>[M+K]+</option><option>[M-H]-</option></select> \u00b1 <input id="br-ppm" value="${HR.prof(f0, 1).tol}" style="width:46px"> ppm</label>
      <label>Tipo di scansione <select id="br-filt"><option value="" data-lv="1">tutte le scansioni MS1</option>${groups.map(opt).join("")}</select></label></div>
      <div style="margin-top:8px"><button id="br-ok" type="button" class="go">Aggiungi</button> <span id="br-err" class="fail"></span></div>`, () => {
      const $ = x => Q(x), sync = () => { $("#br-ionw").hidden = $("#br-kind").value !== "xic"; };
      $("#br-kind").onchange = sync; sync();
      $("#br-ok").onclick = async () => {
        const kind = $("#br-kind").value, fo = $("#br-filt").selectedOptions[0], filt = $("#br-filt").value || null, lv = +(fo.dataset.lv || 1), r = { id: E.seq++, kind, filt, flv: lv, prec: null };
        if (kind === "xic") {
          const t = $("#br-ion").value.trim().replace(",", "."); let mz = parseFloat(t);
          if (!(mz > 0) || /[A-Za-z]/.test(t)) { try { const j = await getFormula(t.split(/\s+/)[0], $("#br-ad").value); mz = j.mz5 ?? j.mz; } catch (e) { $("#br-err").textContent = "Scrivi un m/z oppure una formula valida."; return; } }
          r.mz = +(+mz).toFixed(5); r.ppm = parseFloat($("#br-ppm").value) || HR.prof(f0, 1).tol;
          r.label = `XIC ${r.mz.toFixed(HR.prof(f0, 1).dec)} \u00b1${+r.ppm.toFixed(1)} ppm` + (filt ? " · " + filt : "");
        }
        p.ranges = [...(p.ranges || []), r]; if (p.ranges.length > 1) p.mode = "stk";
        Q("#bigdlg").close(); ctl(p); draw(p); uiSave();
      };
    });
  }
  const dropRange = (p, id) => { p.ranges = (p.ranges || []).filter(r => r.id !== id); if (!p.ranges.length) p.ranges = null; ctl(p); draw(p); uiSave(); };
  // short header of a spectrum cell (as in Xcalibur): the scan type and the NL (highest intensity) next to the retention time
  function header(p) {
    if (p.type !== "spec" || !sync()) return;
    const rl = p.el.querySelector(".rtl"); if (!rl) return;
    let h = p.el.querySelector(".bnl"); if (!h) { h = document.createElement("span"); h.className = "bnl muted sm"; h.style.marginLeft = "8px"; rl.after(h); }
    const d = p._a && p._a.data && p._a.data[0] && p._a.data[0].d, nl = d && d.y && d.y.length ? Math.max(...d.y) : null;
    h.textContent = nl == null ? "" : `${p.filt ? p.filt + " · " : p.level > 1 ? "MS" + p.level + " · " : ""}NL: ${nl.toExponential(2).replace("e+", "E")}`;
  }
  function decorate(p, c) {
    if (!sync() || !c || !(eligible(p) || p.type === "xic")) return;
    const wrap = document.createElement("span"); wrap.className = "bfw";
    if (eligible(p)) {
      const sel = document.createElement("select"); sel.dataset.bf = "filt"; sel.title = "Tipo di scansione di questa cella (filtro di scansione): ogni tipo ha il suo cromatogramma e i suoi spettri";
      sel.innerHTML = `<option value="">tutte le scansioni…</option>`; wrap.appendChild(sel);
      const f = fileOf(p);
      if (f) groupsOf(f.k).then(gs => {
        if (!sel.isConnected) return;
        const mine = gs.filter(g => levelOk(p, g));
        sel.innerHTML = `<option value="">${mine.length > 1 ? "tutti i tipi di scansione" : "unico tipo di scansione"}</option>` + mine.map(g => `<option value="${EH(g.key)}"${p.filt === g.key ? " selected" : ""}>${EH(g.key)} ×${nfmt(g.n)}</option>`).join("");
        sel.value = p.filt && mine.some(g => g.key === p.filt) ? p.filt : "";
        sel.onchange = () => setFilter(p, sel.value || null, gs);
      }).catch(() => { sel.disabled = true; });
    }
    if (p.type === "chrom") {
      const add = document.createElement("button"); add.type = "button"; add.dataset.bf = "range"; add.textContent = "+ Grafico"; add.title = "Aggiungi un grafico impilato sullo stesso asse del tempo (TIC, BPC o XIC di un tipo di scansione)";
      add.onclick = e => { e.stopPropagation(); addRange(p); }; wrap.appendChild(add);
      if (p.ranges && p.ranges.length) {
        const n = document.createElement("label"); n.className = "muted"; n.title = "Porta ogni grafico impilato sulla scala 0-100 (l'intensità massima resta scritta come NL)";
        n.innerHTML = `<input type="checkbox" data-bf="norm"${p.norm100 ? " checked" : ""}> 0-100`; n.querySelector("input").onchange = e => { p.norm100 = e.target.checked; draw(p); uiSave(); }; wrap.appendChild(n);
        p.ranges.forEach(r => { const b = document.createElement("button"); b.type = "button"; b.className = "bt"; b.dataset.bf = "drop"; b.dataset.id = r.id; b.textContent = "\u00d7 " + (rangeLabel(r).length > 18 ? rangeLabel(r).slice(0, 17) + "…" : rangeLabel(r)); b.title = "Togli il grafico: " + rangeLabel(r); b.onclick = e => { e.stopPropagation(); dropRange(p, r.id); }; wrap.appendChild(b); });
      }
    }
    const pin = document.createElement("button"); pin.type = "button"; pin.className = "bt pin" + (p.pin ? " on" : ""); pin.dataset.bf = "pin"; pin.innerHTML = IC_PIN;
    pin.title = p.pin ? "Cella fissata (puntina): non segue il cursore. Clic per sganciarla" : "Fissa la cella (puntina): uno spettro fissato non segue più il cursore del cromatogramma";
    pin.onclick = e => { e.stopPropagation(); setPin(p, !p.pin); };
    wrap.appendChild(pin); c.appendChild(wrap);
  }
  return { on, sync, header, decorate, groupsOf, setFilter, setPin, eligible, rangeSeries, addRange, dropRange, filesFor };
})();
window.BANCO = BANCO;
