/* Theme of the Teoria: follows the app («Chiaro», «Scuro», «Come il sistema»). Loaded in the <head> of every page, before anything is drawn.
   Inside the app the page asks the parent (same origin) and listens for its messages; opened alone it follows the system. */
(function () {
  var R = document.documentElement, mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null, pref = "auto";
  function parentPref() { try { if (parent !== window) return parent.document.documentElement.getAttribute("data-theme") || "auto"; } catch (e) { /* not reachable: system */ } return "auto"; }
  function eff(x) { return x === "dark" || (x !== "light" && mq && mq.matches) ? "dark" : "light"; }
  function apply(x) { pref = x; R.setAttribute("data-theme", eff(x)); R.style.colorScheme = eff(x); }
  apply(parentPref());
  // the drawings on canvas use fixed colours of the light theme: in the dark one they are swapped for their dark equivalents (the SVG ones are in teoria.css)
  var MAP = { "#24231f": "#e4e7eb", "#fff": "#1d2127", "#ffffff": "#1d2127", "#f4f3ef": "#252a31", "#c9c5bb": "#3a424e", "#e9e7e1": "#2c323b", "#6b675c": "#98a2b0",
    "#57534e": "#b6bfcb", "#2b5c8a": "#7db4e6", "#c2410c": "#fb923c", "#b42318": "#f87171", "#0e7490": "#22d3ee", "#b45309": "#fbbf24", "#efe3dc": "#3a2f29", "#e4cfc3": "#5a463b",
    "rgba(255,255,255,.85)": "rgba(29,33,39,.85)", "rgba(36,35,31,.55)": "rgba(228,231,235,.55)" };
  if (window.CanvasRenderingContext2D) ["fillStyle", "strokeStyle"].forEach(function (k) {
    var d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, k); if (!d || !d.set) return;
    Object.defineProperty(CanvasRenderingContext2D.prototype, k, { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) {
      if (typeof v === "string" && R.getAttribute("data-theme") === "dark") { var m = MAP[v.replace(/\s/g, "").toLowerCase()]; if (m) v = m; }
      d.set.call(this, v);
    } });
  });
  // colours written in the <style> blocks and style="" attributes of the pages (the figures define classes such as .bx{fill:#fff}) get the same swap
  function swapText(t) { return t.replace(/#[0-9a-fA-F]{3,6}\b|rgba\([0-9, .]+\)/g, function (c) { return MAP[c.replace(/\s/g, "").toLowerCase()] || c; }); }
  document.addEventListener("DOMContentLoaded", function () {
    if (R.getAttribute("data-theme") !== "dark") return;
    document.querySelectorAll("body style").forEach(function (st) { st.textContent = swapText(st.textContent); });
    document.querySelectorAll("[style]").forEach(function (el) { var v = el.getAttribute("style"); if (/#|rgba/.test(v)) el.setAttribute("style", swapText(v)); });
  });
  // the app changed the theme: the simulations read their colours once, so the page is simply loaded again, at the same place
  addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "qqq-theme") return;
    var before = R.getAttribute("data-theme"); apply(e.data.theme || "auto");
    if (before !== R.getAttribute("data-theme")) { try { sessionStorage.setItem("qqq.teoria.y", String(scrollY)); } catch (x) { /* nothing to keep */ } location.reload(); }
  });
  addEventListener("load", function () { try { var y = sessionStorage.getItem("qqq.teoria.y"); if (y != null) { sessionStorage.removeItem("qqq.teoria.y"); scrollTo(0, +y); } } catch (x) { /* ignore */ } });
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (pref === "auto" && parentPref() === "auto") { var before = R.getAttribute("data-theme"); apply("auto"); if (before !== R.getAttribute("data-theme")) location.reload(); } });
})();
