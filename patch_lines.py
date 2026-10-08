import sys

fpath = "mzlab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_drawLines = """    g.strokeStyle = s.color; g.lineWidth = (s.dash.length ? 1.5 : 1.8) + LWX(); g.setLineDash(s.dash); g.beginPath(); let st = false;
    s.x.forEach((r, i) => { if (r < x0 || r > x1) return; const px = X(r), py = Y(U(s, s.ys[i])); st ? g.lineTo(px, py) : g.moveTo(px, py); st = true; });
    g.stroke();"""

new_drawLines = """    g.strokeStyle = s.color; g.lineWidth = (s.dash.length ? 1.5 : 1.8) + LWX(); g.setLineDash(s.dash); g.beginPath(); let st = false;
    let curX = -999, minY, maxY, firstY, lastY;
    const flush = (cx) => { if (curX === -999) return; if (!st) { g.moveTo(cx, firstY); st = true; } else g.lineTo(cx, firstY); g.lineTo(cx, minY); g.lineTo(cx, maxY); g.lineTo(cx, lastY); };
    s.x.forEach((r, i) => { if (r < x0 || r > x1) return; const px = Math.round(X(r)), py = Y(U(s, s.ys[i]));
      if (px !== curX) { flush(curX); curX = px; minY = maxY = firstY = lastY = py; }
      else { if (py < minY) minY = py; if (py > maxY) maxY = py; lastY = py; }
    });
    flush(curX);
    g.stroke();"""

if old_drawLines in content:
    content = content.replace(old_drawLines, new_drawLines)
    print("Patched drawLines decimation")
else:
    print("Failed to find drawLines old code")

old_drawSpec = """    if (lineOf(x)) {                                                     // profile: continuous line with a light fill under it
      const pm = x.d.pmz, py = x.d.py; let on = false;
      pm.forEach((m, j) => { if (m < x0 - 0.5 || m > x1 + 0.5) return; if (!on) { g.moveTo(X(m), Y(py[j])); on = true; } else g.lineTo(X(m), Y(py[j])); });
      g.stroke(); if (on) { g.save(); g.lineTo(X(Math.min(x1 + 0.5, pm[pm.length - 1])), Y(0)); g.lineTo(X(Math.max(x0 - 0.5, pm[0])), Y(0)); g.closePath(); g.globalAlpha = 0.12; g.fillStyle = x.f.color; g.fill(); g.restore(); }"""

new_drawSpec = """    if (lineOf(x)) {                                                     // profile: continuous line with a light fill under it
      const pm = x.d.pmz, py = x.d.py; let on = false;
      let curX = -999, minY, maxY, firstY, lastY;
      const flush = (cx) => { if (curX === -999) return; if (!on) { g.moveTo(cx, firstY); on = true; } else g.lineTo(cx, firstY); g.lineTo(cx, minY); g.lineTo(cx, maxY); g.lineTo(cx, lastY); };
      pm.forEach((m, j) => { if (m < x0 - 0.5 || m > x1 + 0.5) return; const px = Math.round(X(m)), pvy = Y(py[j]);
        if (px !== curX) { flush(curX); curX = px; minY = maxY = firstY = lastY = pvy; }
        else { if (pvy < minY) minY = pvy; if (pvy > maxY) maxY = pvy; lastY = pvy; }
      });
      flush(curX);
      g.stroke(); if (on) { g.save(); g.lineTo(X(Math.min(x1 + 0.5, pm[pm.length - 1])), Y(0)); g.lineTo(X(Math.max(x0 - 0.5, pm[0])), Y(0)); g.closePath(); g.globalAlpha = 0.12; g.fillStyle = x.f.color; g.fill(); g.restore(); }"""

if old_drawSpec in content:
    content = content.replace(old_drawSpec, new_drawSpec)
    print("Patched drawSpec decimation")
else:
    print("Failed to find drawSpec old code")

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
