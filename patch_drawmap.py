import sys

fpath = "mzlab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

# Add drawRidge and Crosshair logic in drawMap
old_drawmap = r"""  if (p.view === "3d") {
    draw3d(p, g, W, H, A, B, im, f, rf, x0, x1, y0, y1, scTxt);
    const bar3 = B ? "linear-gradient(90deg,rgb(190,60,40),#fafaf6,rgb(30,90,190))" : "linear-gradient(90deg,#fafaf6,rgb(120,190,205),rgb(22,120,160),rgb(28,36,110))";
    p.leg.innerHTML = `<span><i style="background:${f.color}"></i>${EH(f.label)}${B ? " meno " + EH(rf.label) : ""}</span><span class="cbar" style="background:${bar3}"></span><span class="sm">${B ? "differenza: rosso = più intenso nel file mostrato, blu = nel riferimento" : "altezza e colore = intensità media"} (scala ${scTxt}${nTxt})</span><span class="sm">trascina: ruota · Maiusc+trascina: sposta · Ctrl/Cmd+rotella: ingrandisci · per scegliere la zona usa la vista 2D, l'intervallo resta lo stesso</span>`;
    return;
  }
  g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false;"""

new_drawmap = r"""  if (p.view === "3d") {
    draw3d(p, g, W, H, A, B, im, f, rf, x0, x1, y0, y1, scTxt);
    const bar3 = B ? "linear-gradient(90deg,rgb(190,60,40),#fafaf6,rgb(30,90,190))" : "linear-gradient(90deg,#fafaf6,rgb(120,190,205),rgb(22,120,160),rgb(28,36,110))";
    p.leg.innerHTML = `<span><i style="background:${f.color}"></i>${EH(f.label)}${B ? " meno " + EH(rf.label) : ""}</span><span class="cbar" style="background:${bar3}"></span><span class="sm">${B ? "differenza: rosso = più intenso nel file mostrato, blu = nel riferimento" : "altezza e colore = intensità media"} (scala ${scTxt}${nTxt})</span><span class="sm">trascina: ruota · Maiusc+trascina: sposta · Ctrl/Cmd+rotella: ingrandisci · per scegliere la zona usa la vista 2D, l'intervallo resta lo stesso</span>`;
    return;
  }
  if (p.view === "ridge") {
    g.clearRect(0, 0, W, H);
    // Draw Ridge Plot: x = m/z, y = RT + intensity
    const pad = 40, pw_r = W - pad * 2, ph_r = H - pad * 2;
    // Map RT bounds
    const i0 = Math.max(0, Math.floor((x0 - rt0) / (rt1 - rt0) * A.nrt)), i1 = Math.min(A.nrt - 1, Math.ceil((x1 - rt0) / (rt1 - rt0) * A.nrt));
    const j0 = Math.max(0, Math.floor((y0 - mzA) / A.dmz)), j1 = Math.min(A.nmz - 1, Math.ceil((y1 - mzA) / A.dmz));
    const lines = Math.min(150, i1 - i0 + 1);
    const step = Math.max(1, Math.floor((i1 - i0) / lines));
    const dy = ph_r / lines;
    const dx = pw_r / (j1 - j0 + 1);
    const Z = 0.8 * ph_r; // max height of a peak
    
    g.lineJoin = "round"; g.lineWidth = 1.5;
    for (let k = 0; k < lines; k++) {
      const i = i1 - k * step;
      if (i < 0 || i >= A.nrt) continue;
      g.beginPath();
      const baseY = H - pad - k * dy;
      let first = true;
      for (let j = j0; j <= j1; j++) {
        let v = im.v[i * A.nmz + j] || 0;
        let px = pad + (j - j0) * dx;
        let py = baseY - Math.min(v * Z, Z * 1.5); // cap at 1.5x
        if (first) { g.moveTo(px, py); first = false; } else { g.lineTo(px, py); }
      }
      g.fillStyle = "rgba(255, 255, 255, 0.85)";
      g.fill();
      g.strokeStyle = "rgba(30, 90, 190, 0.7)";
      g.stroke();
    }
    
    // Axes labels
    g.fillStyle = css("--ink"); g.textAlign = "center";
    g.fillText("m/z", W/2, H - 10);
    g.textAlign = "right"; g.fillText("RT", pad - 10, pad + ph_r / 2);
    
    p.leg.innerHTML = `<span><i style="background:${f.color}"></i>${EH(f.label)}</span><span class="sm">Ridge Plot (vista prospettica 1D)</span>`;
    p._a = { x0, x1, y0, y1, W, H, f, map: true }; // minimal
    return;
  }
  g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false;"""

content = content.replace(old_drawmap, new_drawmap)

old_hov = r"""    const v = im.v[i * A.nmz + j];
    return { px, rt, html: `<b>RT ${rt.toFixed(2)} min · m/z ${mz.toFixed(1)}</b><div>${B ? "differenza" : "intensità media"}: <b>${B && v > 0 ? "+" : ""}${fmt(v)}</b></div><div class="sm">bin m/z ${(A.mz0 + j * A.dmz).toFixed(0)}-${(A.mz0 + (j + 1) * A.dmz).toFixed(0)}</div>` };
  };"""

new_hov = r"""    const v = im.v[i * A.nmz + j];
    
    if (p.view === "cross" && p._cspec && p._cxic) {
      // Draw mini spectrum (row i)
      const gs = p._cspec.getContext("2d"), gx = p._cxic.getContext("2d");
      gs.clearRect(0,0,440,200); gx.clearRect(0,0,440,200);
      gs.fillStyle = "#1e5abe"; gx.fillStyle = "#1e5abe";
      
      const j0 = Math.max(0, Math.floor((y0 - mzA) / A.dmz)), j1 = Math.min(A.nmz - 1, Math.ceil((y1 - mzA) / A.dmz));
      const idxSpec = i * A.nmz;
      gs.beginPath(); gs.moveTo(0,200);
      for(let k = j0; k <= j1; k++) {
         let val = im.v[idxSpec + k] || 0;
         gs.lineTo((k - j0)/(j1 - j0)*440, 200 - val*180);
      }
      gs.lineTo(440,200); gs.fill();
      gs.fillStyle = "#000"; gs.font = "24px sans-serif"; gs.fillText("Spettro @ RT " + rt.toFixed(2), 10, 30);
      
      // Draw mini XIC (col j)
      const i0 = Math.max(0, Math.floor((x0 - rt0) / (rt1 - rt0) * A.nrt)), i1 = Math.min(A.nrt - 1, Math.ceil((x1 - rt0) / (rt1 - rt0) * A.nrt));
      gx.beginPath(); gx.moveTo(0,200);
      for(let k = i0; k <= i1; k++) {
         let val = im.v[k * A.nmz + j] || 0;
         gx.lineTo((k - i0)/(i1 - i0)*440, 200 - val*180);
      }
      gx.lineTo(440,200); gx.fill();
      gx.fillStyle = "#000"; gx.font = "24px sans-serif"; gx.fillText("XIC @ m/z " + mz.toFixed(1), 10, 30);
    }
    
    return { px, rt, html: `<b>RT ${rt.toFixed(2)} min · m/z ${mz.toFixed(1)}</b><div>${B ? "differenza" : "intensità media"}: <b>${B && v > 0 ? "+" : ""}${fmt(v)}</b></div><div class="sm">bin m/z ${(A.mz0 + j * A.dmz).toFixed(0)}-${(A.mz0 + (j + 1) * A.dmz).toFixed(0)}</div>` + (p.view === "cross" ? '<div class="sm">Mirino attivo (grafici a lato)</div>' : '') };
  };"""

content = content.replace(old_hov, new_hov)

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched drawMap and hov")
