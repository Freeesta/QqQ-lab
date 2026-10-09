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
.bfw{display:inline-flex;align-items:center;gap:4px;margin-left:6px}.bfw select{max-width:21em;min-width:9em}.bfw .pin{padding:2px 5px}.bfw .pin.on{background:var(--sel);color:var(--accent);border-color:var(--accent)}
.hrw #g-add,.hrw #ovbtn{display:none}
#hrbar{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 0 8px;border-bottom:2px solid var(--line);margin-bottom:8px}
#hrbar[hidden]{display:none}#hrbar .sepv{width:1px;align-self:stretch;background:var(--line);margin:0 4px}
#hrbar button{min-width:32px;height:30px;padding:0 7px;display:inline-flex;align-items:center;justify-content:center;gap:4px}
#hrbar button.on{background:var(--sel);color:var(--accent);border-color:var(--accent)}#hrbar button:disabled{opacity:.35;cursor:default}
#hrbar select{height:30px}#hrbar .act{margin-left:auto;font-size:12px;color:var(--muted)}`;
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
  const baseOf = f => (f.file || "").split("#")[0];
  // the menu lists every scan type of the file: choosing one of another experiment (survey / product ions) moves the cell to that experiment
  const tabOf = g => (g.level > 1 ? "ms2" : "full");
  // all the cells that show the scans of the same chromatogram take the filter together (the chromatogram, its spectra)
  const group = p => { const ids = new Set([p.id]); E.panels.forEach(q => { if (q.type === "spec" && (q.link === p.id || q.src === p.id)) ids.add(q.id); if (p.type === "spec" && (p.link === q.id || p.src === q.id)) ids.add(q.id); }); return E.panels.filter(q => ids.has(q.id)); };
  function setFilter(p, key, gs) {
    const g = key ? gs.find(x => x.key === key) : null, nt = g ? tabOf(g) : null;
    group(p).forEach(q => {
      if (q.type === "chrom" && !eligible(q)) return;
      if (nt && q.tab !== nt && q.tab !== "mrm") {                           // another experiment: the files of the cell are the ones of that experiment (same physical file)
        const f0 = q.type === "spec" ? E.files[q.k] : null; q.tab = nt;
        if (f0) { const sib = E.files.find(x => !x.gone && baseOf(x) === baseOf(f0) && x.kind === nt); if (sib) q.k = sib.k; }
        q.title = q.type === "chrom" ? "Cromatogramma" : nt === "ms2" ? "Spettro degli ioni prodotto" : "Spettro di massa"; q.sel = null;
      }
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
        const opt = g => `<option value="${EH(g.key)}"${p.filt === g.key ? " selected" : ""}>${EH(g.key)} \u00d7${nfmt(g.n)}</option>`;
        const lv = gs.filter(g => g.level === 1), l2 = gs.filter(g => g.level === 2), ln = gs.filter(g => g.level > 2);
        sel.innerHTML = `<option value="">tutti i tipi di questo esperimento</option>` + [["Scansione completa (MS1)", lv], ["Ioni prodotto (MS2)", l2], ["Frammentazioni successive (MSn)", ln]].filter(([, l]) => l.length).map(([t, l]) => `<optgroup label="${t}">${l.map(opt).join("")}</optgroup>`).join("");
        sel.value = p.filt && gs.some(g => g.key === p.filt) ? p.filt : "";
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

  // ---------------------------------------------------------------- the toolbar of the bench (WP-H3b, master-prompt §3.3): in the place of the tabs of the experiments
  const svg = d => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    prev: svg('<path d="M10 3L5 8l5 5"/>'), next: svg('<path d="M6 3l5 5-5 5"/>'),
    zundo: svg('<path d="M3 7h6a3 3 0 010 6H6"/><path d="M5.5 4.5L3 7l2.5 2.5"/>'), zall: svg('<path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/>'),
    norm: svg('<path d="M3 13V8M7 13V4M11 13V6"/><path d="M2 13.5h12"/>'), add: svg('<path d="M8 3v10M3 8h10"/>'), del: svg('<path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8.5h5l.5-8.5"/>'),
    type: svg('<path d="M3 5h8M3 11h8"/><path d="M9 3l2 2-2 2M7 9l-2 2 2 2"/>'), peaks: svg('<path d="M2 13c2 0 2-8 4-8s2 8 4 8 1.5-4 4-4"/>'), lib: svg('<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>'),
    copy: svg('<rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 10V3h7"/>'), xls: svg('<path d="M3 2.5h6.5l3 3v8H3z"/><path d="M5.5 8l3 3.5M8.5 8l-3 3.5"/>'), tree: svg('<path d="M8 2v4M8 6H4v3M8 6h4v3M4 9v3M12 9v3"/>'),
  };
  const act = () => (E.active && E.panels.includes(E.active) ? E.active : E.panels[0] || null);
  const tabOfAct = () => (act() && act().tab) || E.tab;
  const decOf = () => Math.round(UIP.hrDec || 4);
  function barBtn(id, tip, ic, fn, label) { return `<button type="button" data-hb="${id}" title="${EH(tip)}" aria-label="${EH(tip)}">${ic}${label ? `<span>${EH(label)}</span>` : ""}</button>`; }
  async function copyPng(p) {
    let cvs; p._exp = true; EXPORTING = true;
    try { await draw(p); cvs = whiteCanvas(p.cv, p.type === "spec" ? specCaption(p) : ""); } finally { p._exp = false; EXPORTING = false; draw(p); }
    const blob = await new Promise(r => cvs.toBlob(r));
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); nearMsg("Immagine copiata negli appunti."); }
    catch (e) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = plotName(p) + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); info("Gli appunti non accettano immagini qui: l'ho scaricata."); }
  }
  async function copyText(p) {
    const t = plotSheets(p); if (!t || !t[0]) return info("Nessun dato da copiare in questa cella.");
    const sh = t[0], txt = [sh.head.join("\t"), ...sh.rows.map(r => r.map(v => (v == null ? "" : v)).join("\t"))].join("\n");
    try { await navigator.clipboard.writeText(txt); nearMsg("Dati copiati negli appunti (testo con tabulazioni)."); } catch (e) { info("Gli appunti non sono disponibili in questa pagina."); }
  }
  function addCell(type) {
    const tab = tabOfAct() === "mrm" ? "full" : tabOfAct(), f = tabFiles(tab)[0]; if (!f) return;
    const q = E.panels.reduce((m, x) => Math.max(m, x.y + x.h + 10), 0), w = hostWidth();
    const o = { tab, x: 0, y: q, w, h: type === "map" ? 420 : 300, full: true };
    const n = type === "spec" ? addPanel("spec", { ...o, k: f.k, level: f.lv || 1, link: null }) : addPanel(type, o);
    relayout(); fitHost(); setActive(n); n.el.scrollIntoView({ block: "center", behavior: "smooth" }); uiSave();
  }
  function retype(type) {
    const o = act(); if (!o || o.type === type) return;
    if (!["chrom", "spec", "map"].includes(type) || !["chrom", "spec", "map", "xic"].includes(o.type)) return info("Questa cella non si può cambiare in quel tipo.");
    const f = tabFiles(o.tab)[0]; if (!f) return;
    const g = { tab: o.tab, x: o.x, y: o.y, w: o.w, h: o.h, full: o.full };
    const n = type === "spec" ? addPanel("spec", { ...g, k: o.k ?? f.k, level: o.level ?? (f.lv || 1) }) : addPanel(type, g);
    o.el.querySelector(".x").click(); setActive(n); relayout(); fitHost(); uiSave();
  }
  const FN = {
    dec: v => { UIP.hrDec = Math.min(5, Math.max(3, +v || 4)); try { uipSave(); } catch (e) { /* no storage */ } redrawAll(); },
    prev: () => { const a = walkTarget(false); if (a) stepScan(a, -1); else info("Metti il cursore sul cromatogramma (un clic) per scorrere le scansioni."); },
    next: () => { const a = walkTarget(false); if (a) stepScan(a, 1); else info("Metti il cursore sul cromatogramma (un clic) per scorrere le scansioni."); },
    zundo: () => { const a = act(); if (a) undoLast(a); },
    zall: () => { E.panels.forEach(q => { pushZh(q); q.zoom = null; q.zoomY = null; if (q.type === "spec") q.lock = null; draw(q); }); uiSave(); },
    norm: () => { const a = act(); if (!a) return; if (a.type === "spec") { a.rel = !specRel(a); draw(a); } else if (a.type === "chrom" || a.type === "xic") { a.norm100 = !a.norm100; draw(a); } uiSave(); sync2(); },
    pin: () => { const a = act(); if (a && (eligible(a) || a.type === "xic")) setPin(a, !a.pin); sync2(); },
    del: () => { const a = act(); if (a) a.el.querySelector(".x").click(); },
    peaks: () => { const a = act(); const b = a && a.el.querySelector('[data-a="iauto"]'); if (b) b.click(); else info("Il rilevamento dei picchi serve nelle celle cromatogramma."); sync2(); },
    lib: () => { let a = act(); if (a && a.type !== "spec") a = E.panels.find(q => q.type === "spec" && q.link === a.id); if (a && window.LIB && a.level === 2) LIB.searchFrom(a); else info("Scegli una cella con uno spettro MS2 (o il suo cromatogramma): lo cerco nelle librerie."); },
    xls: () => { const a = act(), t = a && plotSheets(a); if (t) dlx(plotName(a) + ".xlsx", t); else info("Nessun dato da esportare in questa cella."); },
    tree: () => { const f = tabFiles("ms2")[0]; if (f && window.COMP) COMP.tree(f.k); else info("L'albero MSn serve per un file di infusione con più stadi di frammentazione."); },
  };
  function sync2() {
    const b = Q("#hrbar"); if (!b) return; const a = act();
    const t = (id, on) => { const x = b.querySelector(`[data-hb="${id}"]`); if (x) x.classList.toggle("on", !!on); };
    t("pin", a && a.pin); t("norm", a && (a.type === "spec" ? specRel(a) : a.norm100)); t("peaks", a && a.imode === "auto");
    const d = b.querySelector('[data-hb="dec"]'); if (d) d.value = String(decOf());
    const l = b.querySelector(".act"); if (l) l.textContent = a ? `cella attiva: ${a.type === "chrom" ? "cromatogramma" : a.type === "spec" ? "spettro" : a.type === "map" ? "mappa" : a.type === "xic" ? "XIC" : a.type}${a.filt ? " · " + a.filt : ""}` : "nessuna cella";
  }
  // the starting layout of the bench: the survey on top (the trio for a DDA file); product ions that are not a DDA get their own chromatogram and spectrum under it
  function afterLayout() {
    if (!sync()) return;
    const f2 = tabFiles("ms2").find(f => !f.dda && f.vis !== false);
    if (!f2 || E.panels.some(q => q.tab === "ms2")) return;
    const y = E.panels.reduce((m, q) => Math.max(m, q.y + q.h + 10), 0);
    addMs2Pair({ prec: null, k: f2.k }, y); relayout(); fitHost();
  }
  function bar() {
    const host = Q("#dtabs"); if (!host) return;
    let b = Q("#hrbar");
    if (!sync()) { if (b) b.hidden = true; host.hidden = false; return; }
    host.hidden = true;
    if (!b) {
      b = document.createElement("div"); b.id = "hrbar"; b.setAttribute("role", "toolbar"); b.setAttribute("aria-label", "Barra degli strumenti del banco");
      host.insertAdjacentElement("afterend", b);
      b.innerHTML = `<select data-hb="dec" title="Decimali delle m/z (da 3 a 5, come il menu a tendina di Xcalibur)" aria-label="Decimali delle m/z">${[3, 4, 5].map(n => `<option value="${n}">${n} decimali</option>`).join("")}</select><span class="sepv"></span>` +
        barBtn("prev", "Scansione precedente (freccia sinistra)", ICON.prev) + barBtn("next", "Scansione successiva (freccia destra)", ICON.next) + `<span class="sepv"></span>` +
        barBtn("zundo", "Annulla l'ultimo zoom della cella attiva (Ctrl/Cmd+Z)", ICON.zundo) + barBtn("zall", "Zoom automatico: tutte le celle alla vista intera", ICON.zall) +
        barBtn("norm", "Normalizza 0-100 ↔ intensità assoluta (cella attiva)", ICON.norm) + barBtn("pin", "Fissa la cella attiva (puntina)", IC_PIN) + `<span class="sepv"></span>` +
        barBtn("add", "Aggiungi una cella", ICON.add, null, "Cella") + barBtn("type", "Cambia il tipo della cella attiva", ICON.type) + barBtn("del", "Elimina la cella attiva", ICON.del) + `<span class="sepv"></span>` +
        barBtn("peaks", "Rilevamento dei picchi nella cella attiva (clic su un picco: lo integra). Parametri: clic destro sul grafico", ICON.peaks) +
        barBtn("lib", "Cerca nelle librerie lo spettro della cella attiva", ICON.lib) + barBtn("tree", "Albero MSn del file (infusione con più stadi di frammentazione)", ICON.tree) + `<span class="sepv"></span>` +
        barBtn("copy", "Copia la cella: immagine (PNG) o dati in testo con tabulazioni", ICON.copy) + barBtn("xls", "Esporta i dati della cella in Excel", ICON.xls) + `<span class="act"></span>`;
      b.querySelector('[data-hb="dec"]').onchange = e => { FN.dec(e.target.value); sync2(); };
      b.querySelectorAll("button[data-hb]").forEach(x => {
        const id = x.dataset.hb;
        x.onclick = e => {
          e.stopPropagation();
          if (id === "add") return menu(e, [["chrom", "Cromatogramma"], ["spec", "Spettro di massa"], ["map", "Mappa RT-m/z"], ["xic", "Ione estratto (XIC)…"]].map(([t, l]) => ({ label: l, fn: () => (t === "xic" ? openXic() : addCell(t)) })));
          if (id === "type") return menu(e, [["chrom", "Cromatogramma"], ["spec", "Spettro di massa"], ["map", "Mappa RT-m/z"]].map(([t, l]) => ({ label: l, fn: () => retype(t) })));
          if (id === "copy") { const a = act(); if (!a) return; return menu(e, [{ label: "Immagine (PNG)", fn: () => copyPng(a) }, { label: "Dati (testo con tabulazioni)", fn: () => copyText(a) }]); }
          if (FN[id]) FN[id]();
        };
      });
    }
    b.hidden = false; sync2();
  }
  return { afterLayout, bar, sync2, on, sync, header, decorate, groupsOf, setFilter, setPin, eligible, rangeSeries, addRange, dropRange, filesFor };
})();
window.BANCO = BANCO;
