"use strict";
// Data-dependent acquisition (DDA / IDA): the Full Scan and the MS2 scans it triggered, side by side (classic script, loaded after hr.js).
//
// The "trio" is three ordinary panels treated as one block:
//   c  = chromatogram (TIC, or the XIC of an ion the student follows), full width
//   s1 = Full Scan (the linked spectrum of c)            \  side by side, under c (the Full Scan on the left, as in Thermo FreeStyle),
//   s2 = MS2 scan (p.dda = s1.id, p.dock = s1.id)        /  one under the other when the page is narrower than MIN_W
// A flag (▼) above every peak of the Full Scan that started an MS2; a click shows that MS2 in s2. The MS2 scans of the file come from /api/dda
// (one answer per file, kept here), a single scan from /api/scan (never merged into bins). Every entry point is inside try/catch: if something
// is wrong here the other panels keep working.
const DDA = (() => {
  const MIN_W = 1100;                 // px: below this width the MS2 panel goes under the Full Scan
  const NEAR_MIN = 1.0, NEAR_MAX = 5; // Nearby Precursors (Thermo FreeStyle): MS2 scans of the same ion within +-1.0 min, at most 5 (the closest in time)
  const OFF = "Funzione DDA non disponibile per questo file";
  const byId = id => E.panels.find(q => q.id === id && q.el) || null;
  const phys = f => (f && f.file ? f.file.split("#")[0] : "");
  const fail = (where, e) => { console.info("DDA", where, e); try { nearMsg(OFF); } catch (_) { /* no message possible */ } return false; };

  // ---------------------------------------------------------------- the MS2 scans of a file (one request per file, memo + sync copy)
  const store = new Map();            // physical file name + switch -> prepared data
  const keyOf = k => phys(E.files[k]) + "|" + (HR.on() ? 1 : 0);
  function prepare(j) {
    const idx = new Map(j.sid.map((s, i) => [s, i])), byParent = new Map();
    j.parent.forEach((p, i) => { if (p != null) { let l = byParent.get(p); if (!l) byParent.set(p, l = []); l.push(i); } });
    return { ...j, idx, byParent, ms1pos: new Map(j.ms1.sid.map((s, i) => [s, i])) };
  }
  const get = k => memo(`dda|${keyOf(k)}`, () => J(`api/dda?k=${k}` + HR.q()).then(j => { const d = prepare(j); store.set(keyOf(k), d); return d; }));
  const ready = k => store.get(keyOf(k)) || null;          // already loaded? (drawing code cannot wait)
  const preload = k => get(k).catch(() => null);
  const ms2Item = f => E.files.find(x => x.kind === "ms2" && phys(x) === phys(f) && x.polarity === f.polarity) || E.files.find(x => x.kind === "ms2" && phys(x) === phys(f));
  // scan numbers as the instrument software shows them (the number in the id of the scan), not the position in the file
  const scanNo = (D, i) => D.no ? D.no[i] : D.sid[i] + 1;
  const tolOf = (f, mz) => { const t = HR.tolDa(f, mz, 2); return t != null ? t : 0.5; };

  const scanCache = (k, sid) => memo(`dsc|${keyOf(k)}|${sid}`, () => J(`api/scan?k=${k}&sid=${sid}` + HR.q()));
  const avgCache = (k, sids) => memo(`dav|${keyOf(k)}|${sids.join(",")}`, () => J(`api/scanavg?k=${k}&sids=${sids.join(",")}` + HR.q()));

  // ---------------------------------------------------------------- layout: the MS2 panel docked to the right of its Full Scan
  const docked = q => !!(q && q.dock != null && q.el && hostWidth() >= MIN_W && byId(q.dock));
  const joined = (a, b) => !!(a && b && (a.type === "chrom" || a.type === "xic") && b.type === "spec" && b.link === a.id && b.duo != null && byId(b.duo));        // chromatogram + Full Scan of a trio touch
  const set = (q, o) => { let ch = false; for (const k in o) if (Math.abs((q[k] || 0) - o[k]) > 0.5) { q[k] = o[k]; ch = true; } if (ch) apply(q); return ch; };
  function sync() {
    try {
      const W = hostWidth(), wide = W >= MIN_W;
      E.panels.forEach(q => { if (q.el) { q.el.classList.toggle("jb", false); q.el.classList.toggle("jt", false); q.el.classList.toggle("dk", false); } });
      E.panels.forEach(s2 => {
        if (s2.dock == null || !s2.el) return;
        const s1 = byId(s2.dock); if (!s1) return;
        if (wide) { const half = Math.floor((W - 8) / 2); set(s1, { x: 0, w: half }); set(s2, { x: half + 8, y: s1.y, w: W - half - 8, h: s1.h }); }
        else { set(s1, { x: 0, w: W }); set(s2, { x: 0, w: W }); }
        s2.el.classList.add("dk"); s1.el.classList.add("jb"); s2.el.classList.toggle("jb", wide);
        const c = s1.link != null ? byId(s1.link) : null; if (c && c.y + c.h <= s1.y + 1) c.el.classList.add("jt");
      });
    } catch (e) { console.info("DDA sync", e); }
  }

  // ---------------------------------------------------------------- creation
  function make(c, s1) {
    try {
      const f = E.files[s1.k]; if (!f || !f.dda || f.kind !== "full") return null;
      const f2 = ms2Item(f); if (!f2) return null;
      if (byId(s1.duo)) return byId(s1.duo);
      const s2 = addPanel("spec", { tab: s1.tab, level: 2, k: f2.k, dda: s1.id, dock: s1.id, sid: null, ion: null, title: "MS2", x: 0, y: s1.y, w: s1.w, h: s1.h, full: true });
      s1.duo = s2.id; c.ms2tri = true;
      stackAfter(s2, s1); relayout(); fitHost();
      ctl(c); preload(f.k).then(() => { draw(c); draw(s1); });
      return s2;
    } catch (e) { fail("make", e); return null; }
  }
  // right click on a chromatogram or a Full Scan of a DDA file: bring the MS2 panel back if it was closed
  function ensure(p) {
    const s1 = p.type === "chrom" ? E.panels.find(q => q.type === "spec" && q.link === p.id && q.el) : p, c = p.type === "chrom" ? p : byId(p.link);
    if (!s1 || !c || byId(s1.duo)) return;
    make(c, s1);
  }
  function restored(made) {                                             // after a reload: the trio is back, load its data
    try { sync(); made.forEach(q => { if (q.dda != null && q.el) { const f = E.files[q.k]; const s1 = byId(q.dda); if (s1) preload(s1.k).then(() => { draw(s1); draw(q); const c = byId(s1.link); if (c) draw(c); }); } }); } catch (e) { fail("restored", e); }
  }
  function onClose(p) {
    try {
      if (p.duo != null) { const s2 = byId(p.duo); p.duo = null; if (s2) { const x = s2.el.querySelector(".x"); if (x) setTimeout(() => x.click(), 0); } }
      if (p.dda != null) { const s1 = byId(p.dda); if (s1) s1.duo = null; }
    } catch (e) { console.info("DDA close", e); }
  }

  // ---------------------------------------------------------------- choosing an MS2
  // what the MS2 panel says while it has nothing to show (null = it can draw)
  function waiting(p) {
    if (p.sid != null || (p.avg && p.avg.length)) return null;
    const s1 = byId(p.dda), D = s1 && ready(s1.k);
    if (p.ion != null && D) {                                              // an ion was followed but the instrument never took an MS2 of it
      const f = E.files[p.k], dec = HR.prof(f, 2).dec, txt = `Nessuna MS2 di ${p.ion.toFixed(dec)}: il DDA non l'ha scelto.`;
      const mixed = p._mixed ?? (p._mixed = D.sid.map((_, i) => i).filter(i => D.lo[i] != null && D.lo[i] <= p.ion && D.hi[i] >= p.ion));
      return mixed.length ? txt + ` È però dentro la finestra di isolamento di ${mixed.length} MS2 di altri precursori: ← → per vederle (spettri misti).` : txt;
    }
    return "Clicca una bandierina ▼ nella Full Scan, o un triangolino sul cromatogramma, per vedere una MS2.";
  }
  async function selectMs2(s2, sid, o = {}) {
    try {
      const s1 = byId(s2.dda); if (!s1) return false;
      const c = s1.link != null ? byId(s1.link) : null, f = E.files[s1.k];
      const D = await get(f.k), i = D.idx.get(sid); if (i == null) return false;
      s2.sid = sid; s2.avg = null; s2.r0 = D.rt[i] - 1e-4; s2.r1 = D.rt[i] + 1e-4;
      s1.ddaSel = { sid, i };
      const dec = HR.prof(E.files[s2.k], 2).dec;
      s2.title = "MS2 di " + (D.prec[i] != null ? D.prec[i].toFixed(dec) : "?"); ctl(s2);
      if (c && D.parent[i] != null && o.parent !== false) {            // the cursor goes to the parent Full Scan, which s1 shows exactly
        const prt = D.prt[i];
        c.cur = prt; c.sel = null;
        if (c._a && c.zoom && (prt < c.zoom[0] || prt > c.zoom[1])) { const w = c.zoom[1] - c.zoom[0]; c.zoom = clampView(prt - w / 2, prt + w / 2, c._a.full[0], c._a.full[1]); }
        draw(c); pushLinked(c, prt - 1e-4, prt + 1e-4, s1.k, true);
        if (o.zoom !== false && D.lo[i] != null) { const m = D.tgt[i] ?? D.prec[i]; if (m != null) { pushZh(s1); s1.zoom = [m - 5, m + 5]; } }          // the Full Scan goes to the precursor (Backspace: whole range)
      }
      draw(s2); draw(s1); uiSave();
      return true;
    } catch (e) { return fail("selectMs2", e); }
  }
  // the MS2 scans of the file in the order of the acquisition, optionally only those of the followed ion
  function list(s2, D) {
    const f = E.files[s2.k], out = [];
    for (let i = 0; i < D.sid.length; i++) {
      if (s2.ion != null && !(D.prec[i] != null && Math.abs(D.prec[i] - s2.ion) <= tolOf(f, s2.ion))) continue;
      out.push(i);
    }
    if (s2.ion != null && !out.length)                                      // never fragmented itself: the MS2 scans whose isolation window contained it
      for (let i = 0; i < D.sid.length; i++) if (D.lo[i] != null && D.lo[i] <= s2.ion && D.hi[i] >= s2.ion) out.push(i);
    return out;
  }
  async function step(s2, d) {
    try {
      const s1 = byId(s2.dda), f = E.files[s1.k], D = await get(f.k);
      if (s2.sid == null) {                                                // nothing shown yet (an ion without MS2 of its own): the first / last scan that holds it in its window
        const l0 = list(s2, D); if (!l0.length) return false;
        return selectMs2(s2, D.sid[d > 0 ? l0[0] : l0[l0.length - 1]], { zoom: false });
      }
      const lst = list(s2, D), here = D.idx.get(s2.sid); let j = -1;
      if (d > 0) j = lst.find(i => i > here) ?? -1; else for (let q = lst.length - 1; q >= 0; q--) if (lst[q] < here) { j = lst[q]; break; }
      if (j < 0) { nearMsg(d > 0 ? "Ultima MS2" + (s2.ion != null ? " di questo ione" : "") : "Prima MS2" + (s2.ion != null ? " di questo ione" : "")); return false; }
      return selectMs2(s2, D.sid[j], { zoom: false });
    } catch (e) { return fail("step", e); }
  }
  // arrows with the MS2 panel active
  function key(e, dir) {
    try {
      const ap = fsPanelOr(); if (!ap || ap.dda == null || !window.DDA) return false;
      e.preventDefault(); step(ap, dir); return true;
    } catch (er) { return fail("key", er); }
  }
  const fsPanelOr = () => (typeof fsPanel === "function" && fsPanel()) || E.active;
  // a triangle on the chromatogram: its MS2 appears in the trio
  function onTri(c, tt) {
    try {
      const s1 = E.panels.find(q => q.type === "spec" && q.link === c.id && q.duo != null && q.el), s2 = s1 && byId(s1.duo);
      if (!s2 || tt.sid == null) return false;
      selectMs2(s2, tt.sid); return true;
    } catch (e) { return fail("onTri", e); }
  }
  // triangles of the chromatogram of a trio: the MS2 of the file (only the followed ion)
  function events(c, k) {
    try {
      const s1 = E.panels.find(q => q.type === "spec" && q.link === c.id && q.duo != null && q.el); if (!s1) return null;
      const s2 = byId(s1.duo), D = s2 && ready(s1.k); if (!D || E.files[k] !== E.files[s1.k]) return null;
      const out = (s2.ion != null ? list(s2, D) : D.sid.map((_, i) => i)).map(i => [D.rt[i], D.prec[i], D.sid[i]]);
      out.k2 = s2.k; return out;
    } catch (e) { console.info("DDA events", e); return null; }
  }

  // ---------------------------------------------------------------- drawing of the MS2 panel
  const dataOf = p => {                                                   // like the answer of /api/spectrum: mz, y, scans
    const mk = j => ({ mode: "centroid", mz: j.mz, y: j.y, scans: j.n || 1, sid: j.sid ?? null, i0: null, n: null, scan: j });
    if (p.avg && p.avg.length > 1) return avgCache(p.k, p.avg).then(j => { p._scan = j; return mk(j); });
    return scanCache(p.k, p.sid).then(j => { p._scan = j; return mk(j); });
  };
  const fmt1 = v => (+v).toFixed(2).replace(/\.?0+$/, "");
  function caption(p) {
    const j = p._scan; if (!j) return;
    const parts = [];
    if (p.avg && p.avg.length > 1) parts.push(`media di ${p.avg.length} scansioni`);
    else {
      const D = ready(p.k), i = D && D.idx.get(p.sid);
      parts.push(`scansione ${j.no ?? j.sid + 1}`);
      if (j.parent != null) parts.push(`madre ${j.parent_no ?? j.parent + 1}`);
    }
    if (j.act) parts.push(j.act);
    if (j.ce != null) parts.push(j.nce ? `NCE ${fmt1(j.ce)}` : `CE ${fmt1(j.ce)} eV`);
    if (j.lo != null && j.hi != null) parts.push(`isolamento ±${fmt1((j.hi - j.lo) / 2)}`);
    p.leg.innerHTML = `<span style="font-variant-numeric:tabular-nums">${EH(parts.join(" · "))}</span>`;
    const t = p.el.querySelector(".ttl"); if (t && j.filter) t.title = "T: " + j.filter;
  }

  // ---------------------------------------------------------------- what is drawn on top of the spectra
  const MARK = 6;
  function decorate(p, g, X, Y, W, c) {
    try {
      if (p.dda != null) return decorateMs2(p, g, X, Y, W, c);
      if (p.duo != null) return decorateFull(p, g, X, Y, W, c);
    } catch (e) { console.info("DDA decorate", e); }
  }
  // the Full Scan: a flag over every peak that started an MS2 (only when the panel shows ONE scan), the isolation band of the chosen MS2
  function decorateFull(p, g, X, Y, W, c) {
    const s2 = byId(p.duo), d0 = c.d0, f = c.files[0], D = ready(f.k);
    p._a.flags = []; if (!s2 || !D || d0.sid == null || d0.scans !== 1) return;
    const kids = D.byParent.get(d0.sid) || [], q2 = HR.prof(E.files[s2.k], 2);
    const ac = css("--accent"), tol = mz => tolOf(f, mz), here = s2.sid != null ? D.idx.get(s2.sid) : null;
    // band of the isolation window of the chosen MS2 when its parent is this scan
    if (here != null && D.parent[here] === d0.sid && D.lo[here] != null) {
      const a = Math.max(M.l, X(D.lo[here])), b = Math.min(W - M.r, X(D.hi[here]));
      if (b > a) {
        g.save(); g.globalAlpha = 0.10; g.fillStyle = ac; g.fillRect(a, M.t, b - a, p._a.H - M.t - M.b); g.globalAlpha = 1;
        g.strokeStyle = ac; g.lineWidth = 1; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(D.lo[here]), M.t); g.lineTo(X(D.lo[here]), p._a.H - M.b); g.moveTo(X(D.hi[here]), M.t); g.lineTo(X(D.hi[here]), p._a.H - M.b); g.stroke();
        const t = D.tgt[here] ?? D.prec[here]; if (t != null) { g.setLineDash([]); g.beginPath(); g.moveTo(X(t), M.t); g.lineTo(X(t), p._a.H - M.b); g.stroke(); }
        g.restore();
      }
    }
    // Nearby Precursors: peaks of this scan that were fragmented in ANOTHER scan within +-NEAR_MIN min (an open grey triangle)
    const rt0 = D.ms1.rt[D.ms1pos.get(d0.sid)], flagged = new Set(), near = new Map();
    kids.forEach(j => { const m = D.tgt[j] ?? D.prec[j]; if (m != null) { const jj = nearest(d0.mz, m); if (jj >= 0 && Math.abs(d0.mz[jj] - m) <= tol(m)) flagged.add(jj); } });
    if (rt0 != null) {
      const a = lowerBound(D.rt, rt0 - NEAR_MIN), b = lowerBound(D.rt, rt0 + NEAR_MIN + 1e-9);
      for (let i = a; i < b; i++) {
        if (D.parent[i] === d0.sid) continue;
        const m = D.tgt[i] ?? D.prec[i]; if (m == null || m < p._a.x0 || m > p._a.x1) continue;
        const jj = nearest(d0.mz, m); if (jj < 0 || Math.abs(d0.mz[jj] - m) > tol(m) || !(d0.y[jj] > 0) || flagged.has(jj)) continue;
        let l = near.get(jj); if (!l) near.set(jj, l = []); l.push(i);
      }
    }
    g.save(); g.fillStyle = ac; g.font = fpx(9.5); g.textAlign = "center";
    const muted = css("--muted"), q2n = HR.prof(E.files[s2.k], 2);
    near.forEach((idxs, jj) => {
      const px = X(d0.mz[jj]), py = Math.max(M.t + MARK + 10, Math.min(Y(Math.min(d0.y[jj], p._a.ymax)), p._a.H - M.b)) - 4;
      idxs.sort((u, v) => Math.abs(D.rt[u] - rt0) - Math.abs(D.rt[v] - rt0));
      g.save(); g.strokeStyle = muted; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px - MARK, py - MARK - 3); g.lineTo(px + MARK, py - MARK - 3); g.lineTo(px, py); g.closePath(); g.stroke(); g.restore();
      const tip = `<b>Frammentato in un'altra scansione</b><div class="sm">${idxs.length} MS2 di questo ione entro ±${NEAR_MIN} min · precursore ${(D.prec[idxs[0]]).toFixed(q2n.dec)}</div><div class="sm">Clic: la più vicina nel tempo. Tasto destro: media</div>`;
      p._a.lbls.push({ nb: idxs, ion: D.prec[idxs[0]], x: px - MARK - 3, y: py - MARK - 16, w: 2 * MARK + 6, h: MARK + 18, tip });
    });
    kids.forEach((j, n) => {
      const m = D.tgt[j] ?? D.prec[j]; if (m == null || m < p._a.x0 || m > p._a.x1) return;
      const px = X(m); let y0 = 0; d0.mz.forEach((v, i) => { if (Math.abs(v - m) <= tol(m) && d0.y[i] > y0) y0 = d0.y[i]; });
      const py = Math.max(M.t + MARK + 10, Math.min(Y(Math.min(y0, p._a.ymax)), p._a.H - M.b)) - 4;                // above the peak, at the top edge when the peak is cut
      g.beginPath(); g.moveTo(px - MARK, py - MARK - 3); g.lineTo(px + MARK, py - MARK - 3); g.lineTo(px, py); g.closePath(); g.fill();
      g.fillText(String(n + 1), px, py - MARK - 6);
      const chosen = j === here;
      if (chosen) { g.strokeStyle = ac; g.lineWidth = 1.5; g.strokeRect(px - MARK - 2, py - MARK - 5, 2 * MARK + 4, MARK + 7); }
      const dec = q2.dec, tip = `<b>MS2 n. ${n + 1} di ${kids.length}</b> da questa scansione<div class="sm">precursore ${(D.prec[j] ?? m).toFixed(dec)}${D.act[j] ? " · " + D.act[j] : ""}${D.ce[j] != null ? " · " + (D.nce ? "NCE " + fmt1(D.ce[j]) : "CE " + fmt1(D.ce[j]) + " eV") : ""}</div><div class="sm">Clic: mostra questa MS2</div>`;
      p._a.flags.push({ j, px, py });
      p._a.lbls.push({ fl: j, ion: D.prec[j], x: px - MARK - 3, y: py - MARK - 16, w: 2 * MARK + 6, h: MARK + 18, tip });
    });
    g.restore();
  }
  // the MS2: a dashed line on the precursor
  function decorateMs2(p, g, X, Y, W, c) {
    const j = p._scan; if (!j || j.prec == null || p.avg) return;
    const ac = css("--accent"), D = ready(p.k), i = D && D.idx.get(p.sid), m = (D && D.prec[i]) ?? j.prec;
    if (m < p._a.x0 || m > p._a.x1) return;
    g.save(); g.strokeStyle = ac; g.fillStyle = ac; g.lineWidth = 1; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(m), p._a.H - M.b); g.lineTo(X(m), M.t + 14); g.stroke(); g.setLineDash([]);
    g.font = fpx(9.5); g.textAlign = "center"; g.fillText("precursore", Math.max(M.l + 26, Math.min(W - M.r - 26, X(m))), M.t + 11); g.restore();
  }
  // a click inside a flag
  function click(p, px, py) {
    try {
      if (p.duo == null || !p._a || !p._a.lbls) return false;
      const l = p._a.lbls.find(b => (b.fl != null || b.nb) && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h); if (!l) return false;
      const s2 = byId(p.duo), D = ready(E.files[p.k].k); if (!s2 || !D) return false;
      if (l.fl != null) { selectMs2(s2, D.sid[l.fl]); return true; }
      s2.ion = D.prec[l.nb[0]]; s2._mixed = null;                                // a peak fragmented in another scan: the closest MS2 in time, the Full Scan stays where it is
      selectMs2(s2, D.sid[l.nb[0]], { parent: false }); return true;
    } catch (e) { return fail("click", e); }
  }

  // ---------------------------------------------------------------- right click: average of the MS2 of an ion, follow an ion
  function lowerBound(a, v) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; }
  function nearest(a, v) { if (!a.length) return -1; const i = lowerBound(a, v); if (i <= 0) return 0; if (i >= a.length) return a.length - 1; return Math.abs(a[i] - v) < Math.abs(a[i - 1] - v) ? i : i - 1; }
  // the MS2 of an ion around a retention time: within +-NEAR_MIN min, the NEAR_MAX closest in time, in order of acquisition
  function around(D, f, ion, rt) {
    const t = tolOf(f, ion), l = [];
    for (let i = lowerBound(D.rt, rt - NEAR_MIN); i < D.sid.length && D.rt[i] <= rt + NEAR_MIN + 1e-9; i++) if (D.prec[i] != null && Math.abs(D.prec[i] - ion) <= t) l.push(i);
    return l.sort((u, v) => Math.abs(D.rt[u] - rt) - Math.abs(D.rt[v] - rt)).slice(0, NEAR_MAX).sort((u, v) => u - v);
  }
  async function average(s1, ion, rt) {
    try {
      const s2 = byId(s1.duo), f = E.files[s1.k], D = await get(f.k), l = around(D, f, ion, rt);
      if (!s2 || !l.length) return false;
      if (l.length === 1) return selectMs2(s2, D.sid[l[0]], { parent: false, zoom: false });
      const dec = HR.prof(E.files[s2.k], 2).dec;
      s2.ion = ion; s2.sid = null; s2.avg = l.map(i => D.sid[i]); s2._mixed = null;
      s2.title = `Media di ${l.length} MS2 · ${ion.toFixed(dec)}`; s2.r0 = D.rt[l[0]]; s2.r1 = D.rt[l[l.length - 1]]; ctl(s2); draw(s2); draw(s1); uiSave();
      return true;
    } catch (e) { return fail("average", e); }
  }
  // "Segui questo ione nelle MS2": its XIC appears right under the chromatogram, the Full Scan and the MS2 follow the XIC, only its MS2 are shown
  async function follow(s1, mz) {
    try {
      const s2 = byId(s1.duo), c = s1.link != null ? byId(s1.link) : null, f = E.files[s1.k]; if (!s2 || !c) return false;
      const D = await get(f.k);
      s2.ion = mz; s2.avg = null; s2.sid = null; s2._mixed = null; s2.title = "MS2";
      const x = xicDirect(mz, c); if (!x) return false;
      x.ms2tri = true; x.cur = c.cur; c.ms2tri = false;
      s1.link = x.id; s1.src = x.id; x.ddaFollow = true;
      relayout(); fitHost(); ctl(x); ctl(s2); draw(c);
      const lst = list(s2, D).filter(i => D.prec[i] != null && Math.abs(D.prec[i] - mz) <= tolOf(E.files[s2.k], mz));
      if (lst.length) await selectMs2(s2, D.sid[lst.reduce((b, i) => ((D.pint[i] || 0) > (D.pint[b] || 0) ? i : b), lst[0])]);        // the most intense one
      else { draw(s2); draw(s1); }
      draw(x); uiSave(); return true;
    } catch (e) { return fail("follow", e); }
  }
  function menu(p, px, py, m) {
    try {
      if (p.duo == null || !p._a) return [];
      const f = E.files[p.k], D = ready(f.k), out = [];
      const l = (p._a.lbls || []).find(b => (b.fl != null || b.nb) && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
      const d0 = p._a.data[0].d, rt = D && d0.sid != null ? D.ms1.rt[D.ms1pos.get(d0.sid)] : null;
      if (l && D && rt != null) { const n = around(D, f, l.ion, rt).length; out.push({ label: `Media delle MS2 di questo ione (${n})`, tip: `Media delle MS2 di questo ione entro ±${NEAR_MIN} min (al massimo ${NEAR_MAX}, le più vicine nel tempo)`, fn: () => average(p, l.ion, rt) }); }
      const ion = l ? l.ion : m;
      if (ion != null) out.push({ label: "Segui questo ione nelle MS2", tip: "Crea l'XIC di questo ione: il cromatogramma mostra dove lo strumento ha preso le MS2 e con ← → nella MS2 le scorri", fn: () => follow(p, ion) });
      return out;
    } catch (e) { console.info("DDA menu", e); return []; }
  }
  // little dots on every Full Scan of the trace of a followed ion (when the points are few enough to be told apart)
  function dots(c, g, X, Y, sr, x0, x1, U) {
    try {
      const s1 = E.panels.find(q => q.type === "spec" && q.link === c.id && q.duo != null && q.el), s2 = s1 && byId(s1.duo); if (!s2 || s2.ion == null) return;
      for (const s of sr) {
        if (E.files[s.k] !== E.files[s1.k]) continue;
        let n = 0; s.x.forEach(r => { if (r >= x0 && r <= x1) n++; }); if (n >= 400) continue;
        g.save(); g.fillStyle = s.color; s.x.forEach((r, i) => { if (r < x0 || r > x1) return; g.beginPath(); g.arc(X(r), Y(U(s, s.ys[i])), 1.8, 0, 7); g.fill(); }); g.restore();
      }
    } catch (e) { console.info("DDA dots", e); }
  }

  // ---------------------------------------------------------------- list of the precursors (MS2 tab of a DDA file; the MSn Browser of Thermo, simplified)
  const listMode = () => E.tab === "ms2" && tabFiles("ms2").some(f => f.dda) && window.ms2Exps && ms2Exps().length > 8;
  const listBlock = () => `<div class="fgh"><span>Precursori</span><em>${ms2Exps().length}</em></div><div class="fl pr" style="padding:6px 8px"><button id="ddalist" type="button" title="Tutti gli ioni di cui lo strumento ha preso una MS2: m/z, tempo e numero di MS2. Un clic su una riga mostra la sua MS2 accanto alla Full Scan">Elenco dei precursori…</button></div>`;
  // precursors grouped within the tolerance of the profile (ppm for high resolution, 0.5 Da otherwise): [{mz, n, rt0, rt1, best}]
  function groups(D, f, t0, t1) {
    const idx = D.sid.map((_, i) => i).filter(i => D.prec[i] != null && (t0 == null || (D.rt[i] >= t0 && D.rt[i] <= t1))).sort((a, b) => D.prec[a] - D.prec[b]), out = [];
    let g = null;
    for (const i of idx) {
      const m = D.prec[i];
      if (g && m - g.anchor <= tolOf(f, g.anchor)) { g.idx.push(i); }
      else out.push(g = { anchor: m, idx: [i] });
    }
    return out.map(g => {
      const v = new Map(); g.idx.forEach(i => v.set(D.prec[i], (v.get(D.prec[i]) || 0) + 1));
      const best = g.idx.reduce((b, i) => ((D.pint[i] || 0) > (D.pint[b] || 0) ? i : b), g.idx[0]);
      return { mz: [...v.entries()].sort((a, b) => b[1] - a[1])[0][0], n: g.idx.length, rt0: Math.min(...g.idx.map(i => D.rt[i])), rt1: Math.max(...g.idx.map(i => D.rt[i])), best, idx: g.idx };
    });
  }
  async function openList() {
    try {
      const f = tabFiles("ms2").find(x => x.dda); if (!f) return;
      const D = await get(f.k), c = tabPanels("ms2").find(p => p.type === "chrom"), z = c && c.zoom ? c.zoom : null, dec = HR.prof(f, 2).dec;
      const G = groups(D, f, z ? z[0] : null, z ? z[1] : null), st = { col: "mz", dir: 1 };
      big("Precursori", `<div class="sm muted" style="margin-bottom:6px">${G.length} ioni${z ? ` con almeno una MS2 fra RT ${z[0].toFixed(2)} e ${z[1].toFixed(2)} min (lo zoom del cromatogramma)` : " (tutto il file; ingrandisci il cromatogramma per ridurre l'elenco)"}. Clic su una riga: la sua MS2 più intensa accanto alla Full Scan.</div><div style="max-height:62vh;overflow:auto"><table id="ddatb"></table></div>`, () => {
        const render = () => {
          const rows = G.slice().sort((a, b) => st.dir * ((st.col === "mz" ? a.mz - b.mz : st.col === "rt" ? a.rt0 - b.rt0 : a.n - b.n)));
          const ar = c2 => st.col === c2 ? (st.dir > 0 ? " ▲" : " ▼") : "";
          Q("#ddatb").innerHTML = `<tr><th data-c="mz" style="cursor:pointer"><i>m/z</i> del precursore${ar("mz")}</th><th data-c="rt" style="cursor:pointer">RT (prima–ultima)${ar("rt")}</th><th class="num" data-c="n" style="cursor:pointer">n. MS2${ar("n")}</th></tr>` +
            rows.map((g, i) => `<tr data-r="${G.indexOf(g)}" style="cursor:pointer"><td>${g.mz.toFixed(dec)}</td><td>${g.rt0.toFixed(2)}–${g.rt1.toFixed(2)} min</td><td class="num">${g.n}</td></tr>`).join("");
          Q("#ddatb").querySelectorAll("th[data-c]").forEach(h => h.onclick = () => { st.dir = st.col === h.dataset.c ? -st.dir : 1; st.col = h.dataset.c; render(); });
          Q("#ddatb").querySelectorAll("tr[data-r]").forEach(r => r.onclick = () => { Q("#bigdlg").close(); fromList(f, G[+r.dataset.r]); });
        };
        render();
      });
    } catch (e) { fail("openList", e); }
  }
  async function fromList(f, g) {
    try {
      setTab("full", true); await new Promise(r => setTimeout(r, 700));
      const s1 = E.panels.find(q => q.type === "spec" && q.duo != null && q.el && q.tab === "full"), s2 = s1 && byId(s1.duo); if (!s2) return nearMsg(OFF);
      const D = await get(f.k); s2.ion = g.mz; s2._mixed = null; s2.avg = null;
      await selectMs2(s2, D.sid[g.best]);
      const c = byId(s1.link); if (c) { c.ms2tri = true; draw(c); }
    } catch (e) { fail("fromList", e); }
  }
  // "Mostra le MS2 accanto alla Full Scan": the entry of the right-click menu when the MS2 panel is not there (closed, or an old notebook)
  function menuShow(p) {
    try {
      const s1 = p.type === "chrom" ? E.panels.find(q => q.type === "spec" && q.link === p.id && q.el) : p.type === "spec" && p.link != null && p.dda == null ? p : null;
      if (!s1 || byId(s1.duo)) return null;
      const f = E.files[s1.k]; if (!f || !f.dda || f.kind !== "full") return null;
      return { label: "Mostra le MS2 accanto alla Full Scan", tip: "Apre il pannello con la MS2 a destra della Full Scan: ▼ sui picchi, un clic mostra la sua MS2", fn: () => ensure(p) };
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- style: joined panels
  const st = document.createElement("style");
  st.textContent = ".pnl.jt{border-bottom-left-radius:0;border-bottom-right-radius:0}.pnl.jb{border-top-left-radius:0;border-top-right-radius:0;border-top-color:transparent}";
  document.head.appendChild(st);

  return { MIN_W, NEAR_MIN, NEAR_MAX, docked, joined, sync, make, ensure, restored, onClose, waiting, selectMs2, step, key, onTri, events, scanData: dataOf, caption, decorate, click, menu, menuShow, listMode, listBlock, openList, follow, average, dots, around, get, ready, preload, ms2Item, list };
})();
window.DDA = DDA;
