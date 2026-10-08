import sys

fpath = "qqq_lab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_code = """    k.editor.subscribe("selectionChange", () => requestAnimationFrame(showInfo));
    hideMacro(fr); fitZoom(k, fr); changed(); drawLabels(); return k; });"""

new_code = """    k.editor.subscribe("selectionChange", () => requestAnimationFrame(showInfo));
    hideMacro(fr); fitZoom(k, fr); changed(); drawLabels();
    
    const doc = fr.contentDocument;
    if (doc && doc.body) {
      doc.body.addEventListener("dragover", e => { e.preventDefault(); e.stopPropagation(); });
      doc.body.addEventListener("drop", async e => {
        e.preventDefault(); e.stopPropagation();
        const file = e.dataTransfer.files[0];
        let txt = "";
        if (file) txt = await file.text();
        else txt = e.dataTransfer.getData("text/plain");
        if (txt) {
          try {
            const before = await k.getKet();
            await k.addFragment(txt);
            if (await k.getKet() === before) dnote("Formato non supportato o non valido.");
            else { fitZoom(k, fr); if (window.toast) toast("Struttura importata"); dnote(""); }
          } catch (err) { dnote("Impossibile importare: " + err.message); }
        }
      });
    }
    
    return k; });"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched draw.js with Drag & Drop")
else:
    print("Failed to find injection point in draw.js")
