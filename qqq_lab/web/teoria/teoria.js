/* QqQ lab - Teoria: shared layout (header, chapter list, on-page TOC, prev/next) and tiny plotting helpers.
   Classic script, no modules, no network: the pages work from file:// and from the local server. */
"use strict";
const CHAPTERS = [
  ["index.html", "0", "Introduzione e mappa del percorso"],
  ["01-tp.html", "1", "Prodotti di trasformazione"],
  ["02-fotocatalisi.html", "2", "Fotocatalisi con TiO₂"],
  ["03-lc.html", "3", "Cromatografia in fase inversa"],
  ["04-esi.html", "4", "Elettrospray (ESI)"],
  ["05-vuoto.html", "5", "Dalla sorgente al vuoto"],
  ["06-quadrupolo.html", "6", "Il quadrupolo: teoria"],
  ["07-qqq.html", "7", "Il triplo quadrupolo e la CID"],
  ["08-frammentazione.html", "8", "Come si frammentano gli ioni"],
  ["09-dati.html", "9", "Full scan, MS2 e MRM: leggere i dati"],
  ["10-strategia.html", "10", "Strategia per trovare i TP"],
  ["11-glossario.html", "11", "Glossario e bibliografia"],
  ["12-disegno.html", "12", "Disegnare le molecole"],
];

const TP = (() => {
  const $ = (q, el = document) => el.querySelector(q);
  const here = location.pathname.split("/").pop() || "index.html";
  const idx = Math.max(0, CHAPTERS.findIndex(c => c[0] === here));
  const embedded = window.self !== window.top;

  function slug(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  }

  function layout() {
    // wide tables scroll horizontally on phones instead of widening the page
    document.querySelectorAll("main table").forEach(t => { const w = document.createElement("div"); w.className = "tw"; t.parentNode.insertBefore(w, t); w.appendChild(t); });
    const top = document.createElement("header"); top.id = "top";
    // inside the program the main bar already has the logo and the tabs: no second header there (only the index button on narrow screens)
    if (embedded) document.body.classList.add("emb");
    top.innerHTML = `<button id="menu" aria-label="Indice">&#9776;</button>` + (embedded ? "" : `<a href="index.html"><img src="../logo.png" alt=""></a>
      <span class="t">QqQ lab <small>· Teoria</small></span><span class="sp"></span>`);
    document.body.prepend(top);
    const side = $("#side");
    const list = CHAPTERS.map((c, i) => `<li><a href="${c[0]}" class="${i === idx ? "on" : ""}"><b>${c[1]}</b><span>${c[2]}</span></a></li>`).join("");
    // on-page table of contents from h2/h3
    const hs = [...document.querySelectorAll("main h2, main h3")];
    hs.forEach(h => { if (!h.id) h.id = slug(h.textContent); });
    const toc = hs.map(h => `<a href="#${h.id}" class="${h.tagName === "H3" ? "l3" : ""}">${h.textContent}</a>`).join("");
    side.innerHTML = `<h4>Capitoli</h4><ol>${list}</ol>${toc ? `<h4>In questa pagina</h4><div class="toc">${toc}</div>` : ""}`;
    $("#menu").onclick = () => side.classList.toggle("open");
    // prev / next
    const pn = document.createElement("div"); pn.className = "pn";
    const p = CHAPTERS[idx - 1], n = CHAPTERS[idx + 1];
    pn.innerHTML = (p ? `<a href="${p[0]}"><small>&larr; Precedente</small>${p[1]}. ${p[2]}</a>` : "<span></span>") +
                   (n ? `<a href="${n[0]}" style="text-align:right"><small>Successivo &rarr;</small>${n[1]}. ${n[2]}</a>` : "<span></span>");
    $("main").appendChild(pn);
    // highlight the current section in the TOC
    const links = [...side.querySelectorAll(".toc a")];
    if (links.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); });
      }, { rootMargin: "-70px 0px -70% 0px" });
      hs.forEach(h => io.observe(h));
    }
    document.title = `${CHAPTERS[idx][1] === "0" ? "" : CHAPTERS[idx][1] + ". "}${CHAPTERS[idx][2]} · Teoria QqQ lab`;
  }

  // ---------------------------------------------------------------- controls
  /** Build sliders/selects. spec: [{id,label,min,max,step,value,fmt,unit,options:[[v,label]]}] -> returns getter object */
  function controls(el, spec, onchange) {
    const box = document.createElement("div"); box.className = "ctl"; el.appendChild(box);
    const val = {};
    spec.forEach(s => {
      const lab = document.createElement("label");
      if (s.options) {
        lab.innerHTML = `<span>${s.label}</span><select>${s.options.map(o => `<option value="${o[0]}">${o[1]}</option>`).join("")}</select>`;
        const sel = lab.querySelector("select"); sel.value = String(s.value);
        val[s.id] = s.num === false ? sel.value : +sel.value;
        sel.oninput = () => { val[s.id] = s.num === false ? sel.value : +sel.value; onchange(val, s.id); };
      } else if (s.text) {
        lab.innerHTML = `<span>${s.label}</span><input type="text" value="${s.value}" spellcheck="false">`;
        const inp = lab.querySelector("input"); val[s.id] = s.value;
        inp.oninput = () => { val[s.id] = inp.value; onchange(val, s.id); };
      } else {
        const f = s.fmt || (v => v);
        lab.innerHTML = `<span>${s.label}<output></output></span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}">`;
        const r = lab.querySelector("input"), o = lab.querySelector("output");
        const upd = () => { val[s.id] = +r.value; o.textContent = f(+r.value) + (s.unit ? " " + s.unit : ""); };
        upd(); r.oninput = () => { upd(); onchange(val, s.id); };
        val["_set_" + s.id] = v => { r.value = v; upd(); };
      }
      box.appendChild(lab);
    });
    return val;
  }

  function buttons(el, items, cur, onclick) {
    const b = document.createElement("div"); b.className = "btns"; el.appendChild(b);
    items.forEach(([k, lab]) => {
      const x = document.createElement("button"); x.textContent = lab; x.dataset.k = k;
      if (k === cur) x.classList.add("on");
      x.onclick = () => { b.querySelectorAll("button").forEach(y => y.classList.toggle("on", y === x)); onclick(k); };
      b.appendChild(x);
    });
    return b;
  }

  // ---------------------------------------------------------------- canvas plotting
  /** A canvas sized for the device pixel ratio. Returns {cv, ctx, W, H, resize()} */
  function canvas(el, h = 260) {
    const cv = document.createElement("canvas"); el.appendChild(cv);
    const o = { cv, ctx: cv.getContext("2d"), W: 0, H: h, onresize: null };
    o.resize = () => {
      const w = Math.max(280, cv.clientWidth || el.clientWidth || 600), d = window.devicePixelRatio || 1;
      cv.style.height = h + "px"; cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      o.ctx.setTransform(d, 0, 0, d, 0, 0); o.W = w; o.H = h;
    };
    o.resize();
    let t = null;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { o.resize(); o.onresize && o.onresize(); }, 120); });
    return o;
  }

  function nice(lo, hi, n = 5) {
    const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => span / k <= n) || 10 * mag;
    const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + st * 1e-9; v += st) out.push(+v.toFixed(10));
    return out;
  }

  /** Axes frame. opt: {x0,x1,y0,y1,xl,yl,m:{l,r,t,b},logy,grid,xfmt,yfmt}. Returns mapping functions. */
  function axes(c, opt) {
    const { ctx, W, H } = c, m = Object.assign({ l: 56, r: 14, t: 12, b: 38 }, opt.m || {});
    const X = v => m.l + (v - opt.x0) / (opt.x1 - opt.x0) * (W - m.l - m.r);
    const ly = v => opt.logy ? Math.log10(Math.max(v, 1e-12)) : v;
    const Y = v => H - m.b - (ly(v) - ly(opt.y0)) / (ly(opt.y1) - ly(opt.y0)) * (H - m.t - m.b);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "12px system-ui,sans-serif"; ctx.lineWidth = 1;
    ctx.strokeStyle = "#e9e7e1"; ctx.fillStyle = "#6b675c";
    const xf = opt.xfmt || (v => +v.toFixed(6)), yf = opt.yfmt || (v => +v.toFixed(6));
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    (opt.xticks || nice(opt.x0, opt.x1, Math.max(3, Math.floor((W - m.l - m.r) / 80)))).forEach(v => {
      const x = X(v); if (x < m.l - 1 || x > W - m.r + 1) return;
      if (opt.grid !== false) { ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, H - m.b); ctx.stroke(); }
      ctx.fillText(xf(v), x, H - m.b + 5);
    });
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const yt = opt.logy ? (() => { const a = [], e0 = Math.ceil(Math.log10(opt.y0)), e1 = Math.floor(Math.log10(opt.y1)), st = Math.max(1, Math.ceil((e1 - e0) / 7)); for (let e = e0; e <= e1; e += st) a.push(Math.pow(10, e)); return a; })()
                        : (opt.yticks || nice(opt.y0, opt.y1, Math.max(3, Math.floor((H - m.t - m.b) / 45))));
    yt.forEach(v => {
      const y = Y(v); if (y < m.t - 1 || y > H - m.b + 1) return;
      if (opt.grid !== false) { ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(W - m.r, y); ctx.stroke(); }
      ctx.fillText(opt.logy ? "10" + sup(Math.log10(v)) : yf(v), m.l - 6, y);
    });
    ctx.strokeStyle = "#9b978c"; ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, H - m.b); ctx.lineTo(W - m.r, H - m.b); ctx.stroke();
    ctx.fillStyle = "#24231f"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    if (opt.xl) ctx.fillText(opt.xl, m.l + (W - m.l - m.r) / 2, H - 2);
    if (opt.yl) { ctx.save(); ctx.translate(13, m.t + (H - m.t - m.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "middle"; ctx.fillText(opt.yl, 0, 0); ctx.restore(); }
    return { X, Y, m, W, H, ctx, clip() { ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, W - m.l - m.r, H - m.t - m.b); ctx.clip(); } };
  }
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  function sup(n) { return String(Math.round(n)).split("").map(ch => SUP[ch] || ch).join(""); }

  function line(ax, xs, ys, color, w = 2, dash) {
    const { ctx, X, Y } = ax; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); let pen = false;
    for (let i = 0; i < xs.length; i++) { const y = ys[i]; if (!isFinite(y)) { pen = false; continue; } const px = X(xs[i]), py = Y(y); pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true; }
    ctx.stroke(); ctx.restore();
  }
  function sticks(ax, xs, ys, color, w = 2) {
    const { ctx, X, Y } = ax; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
    xs.forEach((x, i) => { ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(ys[i])); }); ctx.stroke(); ctx.restore();
  }
  function label(ax, x, y, txt, color = "#24231f", align = "center", base = "bottom", dy = -3) {
    const { ctx, X, Y } = ax; ctx.save(); ctx.fillStyle = color; ctx.font = "12px system-ui,sans-serif"; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(txt, X(x), Y(y) + dy); ctx.restore();
  }
  function legend(ax, items, x0) {
    const { ctx, m, W } = ax; ctx.save(); ctx.font = "12px system-ui,sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    let x = x0 ?? (m.l + 10), y = m.t + 10;
    items.forEach(([txt, col, dash]) => {
      const w = ctx.measureText(txt).width + 34;
      if (x + w > W - m.r) { x = x0 ?? (m.l + 10); y += 17; }
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#24231f"; ctx.fillText(txt, x + 25, y); x += w;
    });
    ctx.restore();
  }
  const fmt = (v, d = 2) => (+v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sci = (v, d = 2) => { if (v === 0) return "0"; const e = Math.floor(Math.log10(Math.abs(v))); const mnt = v / Math.pow(10, e); return fmt(mnt, d) + "·10" + sup(e); };


  // ---------------------------------------------------------------- glossary hints
  // Every glossary term (glossario-dati.js, generated from 11-glossario.html by tools/genera_glossario.py) found in the text gets a dotted
  // underline; the mouse over it (or focus / tap) shows the short definition and a link to its chapter.
  function glossary() {
    if (here === "11-glossario.html") return;
    const s = document.createElement("script"); s.src = "glossario-dati.js"; s.onload = () => { try { markTerms(GLOSSARIO); } catch (_) { /* hints are optional */ } };
    document.head.appendChild(s);
  }

  function markTerms(G) {
    const cs = new Map(), ci = new Map();
    G.forEach((e, i) => e.k.forEach(k => {
      const strict = k.length <= 3 || (k.match(/[A-ZÀ-Ý]/g) || []).length >= 2;
      (strict ? cs : ci).set(strict ? k : k.toLowerCase(), i);
    }));
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const all = [...cs.keys(), ...ci.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp("(?<![\\p{L}\\p{N}_])(" + all.map(esc).join("|") + ")(?![\\p{L}\\p{N}_])", "giu");
    const skip = "a,button,select,input,textarea,script,style,canvas,svg,code,kbd,h1,h2,h3,h4,h5,.kicker,.ctl,.pn,#side,#top,.tag,.g,sub,sup";
    const nodes = [], tw = document.createTreeWalker($("main"), NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.trim() && !n.parentElement.closest(skip)) nodes.push(n);
    nodes.forEach(n => {
      const txt = n.nodeValue; let last = 0, hit = false; const frag = document.createDocumentFragment();
      for (const m of txt.matchAll(re)) {
        const i = cs.has(m[1]) ? cs.get(m[1]) : ci.get(m[1].toLowerCase());
        if (i === undefined) continue;
        frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        const sp = document.createElement("span"); sp.className = "g"; sp.tabIndex = 0; sp.dataset.g = i; sp.textContent = m[1];
        frag.appendChild(sp); last = m.index + m[1].length; hit = true;
      }
      if (hit) { frag.appendChild(document.createTextNode(txt.slice(last))); n.parentNode.replaceChild(frag, n); }
    });
    const tip = document.createElement("div"); tip.id = "gtip"; tip.setAttribute("role", "tooltip"); tip.hidden = true; document.body.appendChild(tip);
    let timer = 0, cur = null;
    const hide = () => { tip.hidden = true; cur = null; };
    const show = el => {
      clearTimeout(timer); if (cur === el) return; cur = el;
      const e = G[+el.dataset.g];
      tip.innerHTML = `<b>${e.t}</b><p>${e.d}</p>` + (e.h ? `<a href="${e.h}">${e.n} &rarr;</a>` : "");
      tip.hidden = false;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      const x = Math.max(8, Math.min(r.left, innerWidth - w - 8)), below = r.bottom + 6 + h < innerHeight || r.top - 6 - h < 0;
      tip.style.left = x + "px"; tip.style.top = (below ? r.bottom + 6 : r.top - 6 - h) + "px";
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(hide, 220); };
    document.addEventListener("mouseover", ev => { const el = ev.target.closest(".g"); if (el) show(el); else if (ev.target.closest("#gtip")) clearTimeout(timer); });
    document.addEventListener("mouseout", ev => { if (ev.target.closest(".g, #gtip")) later(); });
    document.addEventListener("focusin", ev => { const el = ev.target.closest(".g"); if (el) show(el); });
    document.addEventListener("focusout", ev => { if (ev.target.closest(".g")) later(); });
    document.addEventListener("click", ev => { const el = ev.target.closest(".g"); if (el) { cur === el && !tip.hidden ? hide() : show(el); } else if (!ev.target.closest("#gtip")) hide(); });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape") hide(); });
    addEventListener("scroll", hide, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", () => { layout(); glossary(); });
  return { $, controls, buttons, canvas, axes, line, sticks, label, legend, nice, fmt, sci, sup };
})();
