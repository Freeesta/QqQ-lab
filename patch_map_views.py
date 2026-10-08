import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update setMapView to handle our new views
old_setmapview = r"""function setMapView(p, v) {
  p.view = v;
  if (v === "3d" && p.h < 470) { p.h0v = p.h; p.h = 470; apply(p); relayout(); fitHost(); }
  else if (v !== "3d" && p.h0v) { p.h = p.h0v; p.h0v = null; apply(p); relayout(); fitHost(); }
  ctl(p); draw(p); uiSave();
}"""

new_setmapview = r"""function setMapView(p, v) {
  p.view = v;
  if ((v === "3d" || v === "ridge") && p.h < 470) { p.h0v = p.h; p.h = 470; apply(p); relayout(); fitHost(); }
  else if (v !== "3d" && v !== "ridge" && p.h0v) { p.h = p.h0v; p.h0v = null; apply(p); relayout(); fitHost(); }
  
  if (p._cxic) { p._cxic.remove(); p._cxic = null; }
  if (p._cspec) { p._cspec.remove(); p._cspec = null; }
  
  if (v === "cross") {
    p._cspec = document.createElement("canvas"); p._cspec.style.cssText = "position:absolute; top:20px; right:20px; width:220px; height:100px; background:rgba(255,255,255,0.9); border:1px solid var(--line); border-radius:4px; pointer-events:none; z-index:10;"; p._cspec.width = 440; p._cspec.height = 200;
    p._cxic = document.createElement("canvas"); p._cxic.style.cssText = "position:absolute; bottom:30px; right:20px; width:220px; height:100px; background:rgba(255,255,255,0.9); border:1px solid var(--line); border-radius:4px; pointer-events:none; z-index:10;"; p._cxic.width = 440; p._cxic.height = 200;
    p.el.appendChild(p._cspec); p.el.appendChild(p._cxic);
  }
  
  ctl(p); draw(p); uiSave();
}"""
content = content.replace(old_setmapview, new_setmapview)

# 2. Update context menu buttons
old_buttons = r"""    c.innerHTML = `<span class="seg" role="group" title="Vista della mappa: 2D = colori sul piano RT-m/z; 3D = superficie con l'intensità in altezza (trascina per ruotarla)"><button data-o="view" data-v="2d" class="${p.view !== "3d" ? "on" : ""}">2D</button><button data-o="view" data-v="3d" class="${p.view === "3d" ? "on" : ""}">3D</button></span>` +"""
new_buttons = r"""    c.innerHTML = `<span class="seg" role="group" title="Vista della mappa: 2D, Mirino interattivo, Ridge (linee 3D), 3D (superficie)"><button data-o="view" data-v="2d" class="${p.view !== "3d" && p.view !== "ridge" && p.view !== "cross" ? "on" : ""}">2D</button><button data-o="view" data-v="cross" class="${p.view === "cross" ? "on" : ""}">Mirino</button><button data-o="view" data-v="ridge" class="${p.view === "ridge" ? "on" : ""}">Ridge</button><button data-o="view" data-v="3d" class="${p.view === "3d" ? "on" : ""}">3D</button></span>` +"""
content = content.replace(old_buttons, new_buttons)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched setMapView and buttons")
