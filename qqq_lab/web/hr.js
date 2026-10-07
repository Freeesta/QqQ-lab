"use strict";
// High resolution: how precisely m/z values are written and compared (classic script, loaded after explore.js).
// The server sends, for every file, the mass profile of its survey scans (`prof1`) and of its product-ion scans (`prof2`):
// {hr, an, dec, tol, unit}. Everything in the page that decides decimals, a tolerance or the grouping of m/z goes through HR.prof().
// The 3200 QTRAP files have the low-resolution profile (1 decimal, the unit window of the XIC): nothing changes for them.
// A switch in the settings gear ("Alta risoluzione: spenta") makes every file behave as today.
const HR = (() => {
  const LOW = { hr: false, an: "?", dec: 1, tol: 0.5, unit: "Da" };
  const on = () => UIP.hr !== false;
  const num = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  // profile of file f at a level (1 survey, 2 product ions); `f` may be undefined (no file yet): low resolution
  function prof(f, level) {
    const lv = level || (f && f.lv) || 1, p = f && (lv === 2 ? f.prof2 : f.prof1);
    if (!on() || !p) return LOW;
    if (!p.hr) return p;                                                     // ion trap: 2 decimals, 0.5 Da (as Thermo's default), not high resolution
    return { ...p, dec: Math.round(num(UIP.hrDec, 3, 5, p.dec)), tol: num(UIP.hrPpm, 1, 50, p.tol), unit: "ppm" };
  }
  const isHr = (f, level) => prof(f, level).hr;
  // decimals for a group of files (a graph with several files): the largest of their profiles
  const dec = (files, level) => Math.max(1, ...(files || []).filter(Boolean).map(f => prof(f, level).dec));
  const anyHr = (files, level) => (files || []).some(f => f && isHr(f, level));
  // half width (Da) of an ion window at m/z for file f: ppm for high resolution, null = "use the unit window of today"
  const tolDa = (f, mz, level) => { const q = prof(f, level); return q.hr ? mz * q.tol * 1e-6 : null; };
  const fmt = (f, level, v) => (v == null || !Number.isFinite(v)) ? "" : v.toFixed(prof(f, level).dec);
  const ppm = (obs, ref) => (obs - ref) / ref * 1e6;
  // "tolerance 5 ppm" or "0.5 Da" as text for titles and tooltips
  const tolText = (f, level) => { const q = prof(f, level); return q.unit === "ppm" ? `${+q.tol.toFixed(1)} ppm` : `${+q.tol.toFixed(2)} Da`; };
  // appended to server requests: the server must also behave as today when the switch is off
  const q = () => on() ? "" : "&hr=0";
  // short label of the instrument, for lists and the method window: "Orbitrap Exploris 120 · R 45 000 / 15 000"
  const rtxt = r => r ? Math.round(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
  function label(f) {
    if (!f || !(f.prof1 && f.prof1.hr) && !(f.prof2 && f.prof2.hr)) return "";
    const r = [f.res1, f.res2].filter(Boolean).map(rtxt); const rr = r.length === 2 && r[0] === r[1] ? [r[0]] : r;
    return [f.instrument, rr.length ? "R " + rr.join(" / ") : "", f.dda ? "DDA" : ""].filter(Boolean).join(" · ");
  }
  // a file whose high-resolution reading failed on the server opens as low resolution: say it once
  const told = new Set();
  function notice(files) {
    const bad = (files || []).filter(f => f && f.hr_err && !told.has(f.file));
    if (!bad.length) return;
    bad.forEach(f => { told.add(f.file); console.info("HR", f.file, f.hr_err); });
    let d = document.querySelector("#hrnote");
    if (!d) { d = document.createElement("div"); d.id = "hrnote"; d.style.cssText = "position:fixed;z-index:20000;left:50%;bottom:18px;transform:translateX(-50%);max-width:520px;padding:8px 14px;border-radius:6px;background:#333;color:#fff;font:13px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.35)"; document.body.appendChild(d); }
    d.textContent = "Alta risoluzione non disponibile per " + bad.map(f => f.label || f.file).join(", ") + ": aperto come bassa risoluzione."; d.hidden = false;
    clearTimeout(d._t); d._t = setTimeout(() => { d.hidden = true; }, 7000);
  }
  return { LOW, on, prof, isHr, dec, anyHr, tolDa, fmt, ppm, tolText, q, label, notice };
})();
window.HR = HR;
