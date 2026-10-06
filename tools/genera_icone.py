"""Write the logo (SVG, from tools/genera_logo.py) and all the raster icons made from it into tpfinder/web/:
logo.svg, app-icon.svg, favicon.svg, logo.png, favicon-32.png, favicon.ico, apple-touch-icon.png,
app-icon-192/256/512/1024.png, and the macOS icon QqQ lab.app/Contents/Resources/AppIcon.icns.
Needs Playwright + Chromium (developer machine or the cloud container), only to rasterise the SVG.
Run from the project root:  python3 tools/genera_icone.py"""
import io, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "tpfinder" / "web"
sys.path.insert(0, str(Path(__file__).parent))
import genera_logo as L  # noqa: E402


def raster(svg_text: str, size: int, transparent: bool) -> bytes:
    from playwright.sync_api import sync_playwright
    html = f'<html><body style="margin:0;background:transparent">{svg_text.replace("<svg ", f"<svg style=\'display:block;width:{size}px;height:{size}px\' ", 1)}</body></html>'
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": size, "height": size})
        pg.set_content(html); png = pg.screenshot(omit_background=transparent, clip={"x": 0, "y": 0, "width": size, "height": size}); b.close()
    return png


def icns(pngs: dict) -> bytes:
    """Apple icon file with PNG entries (ic07 128, ic08 256, ic09 512, ic10 1024, ic11 32@2x, ic12 64@2x)."""
    kinds = {128: b"ic07", 256: b"ic08", 512: b"ic09", 1024: b"ic10", 32: b"ic11", 64: b"ic12"}
    body = b"".join(kinds[s] + struct.pack(">I", 8 + len(d)) + d for s, d in sorted(pngs.items()) if s in kinds)
    return b"icns" + struct.pack(">I", 8 + len(body)) + body


def main():
    logo, app = L.svg(), L.svg(background="#ffffff", pad=44)
    (WEB / "logo.svg").write_text(logo, encoding="utf-8")
    (WEB / "app-icon.svg").write_text(app, encoding="utf-8")
    (WEB / "favicon.svg").write_text(L.svg(pad=0), encoding="utf-8")
    (WEB / "logo.png").write_bytes(raster(logo, 512, True))
    (WEB / "favicon-32.png").write_bytes(raster(logo, 32, True))
    (WEB / "apple-touch-icon.png").write_bytes(raster(app, 180, False))
    big = {}
    for s in (32, 64, 128, 192, 256, 512, 1024):
        big[s] = raster(app, s, True)
        if s in (192, 256, 512, 1024):
            (WEB / f"app-icon-{s}.png").write_bytes(big[s])
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raster(logo, 256, True)))
        im.save(WEB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    except ImportError:
        print("Pillow assente: favicon.ico non rigenerato")
    res = ROOT / "QqQ lab.app" / "Contents" / "Resources"
    res.mkdir(parents=True, exist_ok=True)
    (res / "AppIcon.icns").write_bytes(icns(big))
    print("icone scritte in", WEB, "e", res)


if __name__ == "__main__":
    main()
