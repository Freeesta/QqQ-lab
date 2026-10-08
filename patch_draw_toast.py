import sys

fpath = "mzlab/web/draw.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

old_click = """document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-cp]"); if (b) { try { navigator.clipboard.writeText(b.dataset.cp); b.textContent = "Copiato"; setTimeout(() => { b.textContent = "Copia"; }, 1200); } catch (_) { /* clipboard blocked */ } } });"""
new_click = """document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-cp]"); if (b) { try { navigator.clipboard.writeText(b.dataset.cp); if (window.toast) toast("SMILES copiato"); b.textContent = "Copiato"; setTimeout(() => { b.textContent = "Copia"; }, 1200); } catch (_) { /* clipboard blocked */ } } });"""

if old_click in content:
    content = content.replace(old_click, new_click)
    print("Patched click for SMILES copiato")

# Export download
old_download = """    download(blob, exportName(kind, clear));"""
new_download = """    download(blob, exportName(kind, clear));
    if (window.toast) toast("File salvato");"""
if old_download in content:
    content = content.replace(old_download, new_download)
    print("Patched download for File salvato")

old_ket = """    if (kind === "ket") { download(new Blob([await K.getKet()], { type: "application/json" }), exportName("ket")); return; }"""
new_ket = """    if (kind === "ket") { download(new Blob([await K.getKet()], { type: "application/json" }), exportName("ket")); if (window.toast) toast("File salvato"); return; }"""
if old_ket in content:
    content = content.replace(old_ket, new_ket)
    print("Patched ket download")

with open(fpath, "w", encoding="utf-8") as f:
    f.write(content)
