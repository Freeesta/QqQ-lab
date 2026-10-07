"""Make the picture shown when the link of the site is shared (WhatsApp, Telegram, Slack, social networks): qqq_lab/web/anteprima.png, 1200 x 630.

The name is read from qqq_lab/web/appname.js (the only place where it is written). Only Pillow is needed (the logo is qqq_lab/web/logo.png).
WhatsApp shows the large preview only if the picture is below ~300 KB: the script checks it."""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "qqq_lab" / "web"
NAME = re.search(r'APP_NAME\s*=\s*"([^"]+)"', (WEB / "appname.js").read_text(encoding="utf-8")).group(1)
W, H, S = 1200, 630, 2                                    # drawn at double size, then reduced (smooth edges)
BOLD, REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
font = lambda p, n: ImageFont.truetype(p, int(n * S))
ACC, DEEP, SOFT = (43, 92, 138), (17, 40, 66), (214, 228, 242)


def gradient():
    im = Image.new("RGB", (W * S, H * S)); px = im.load()
    for y in range(H * S):
        for x in range(0, W * S):
            t = min(1, max(0, (x / (W * S) * 0.65 + y / (H * S) * 0.35)))
            px[x, y] = tuple(int(DEEP[i] + (ACC[i] - DEEP[i]) * t) for i in range(3))
    return im


def make():
    im = gradient(); d = ImageDraw.Draw(im, "RGBA")
    # the card with a chromatogram and a spectrum (right side)
    cx0, cy0, cx1, cy1 = 640, 70, 1140, 560
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([x * S for x in (cx0 + 6, cy0 + 14, cx1 + 6, cy1 + 14)], 28 * S, fill=(0, 0, 0, 90))
    im.paste(Image.alpha_composite(im.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(14 * S))).convert("RGB")); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([x * S for x in (cx0, cy0, cx1, cy1)], 28 * S, fill=(255, 255, 255, 255))
    # chromatogram: baseline noise + three peaks
    px0, px1, py0, py1 = cx0 + 40, cx1 - 30, cy0 + 40, cy0 + 235
    import math
    pts = []
    for i in range(0, 301):
        x = i / 300; y = 0.04 + 0.025 * math.sin(i * 0.9) * math.sin(i * 0.23)
        for c, h, w in ((0.30, 0.45, 0.018), (0.58, 1.0, 0.022), (0.80, 0.33, 0.016)): y += h * math.exp(-((x - c) / w) ** 2)
        pts.append((px0 + x * (px1 - px0), py1 - y * (py1 - py0 - 14)))
    d.polygon([(px0 * S, py1 * S)] + [(x * S, y * S) for x, y in pts] + [(px1 * S, py1 * S)], fill=(43, 92, 138, 38))
    d.line([(x * S, y * S) for x, y in pts], fill=ACC + (255,), width=4 * S, joint="curve")
    d.line([(px0 * S, py1 * S), (px1 * S, py1 * S)], fill=(140, 150, 165, 255), width=2 * S)
    d.line([(px0 * S, py0 * S), (px0 * S, py1 * S)], fill=(140, 150, 165, 255), width=2 * S)
    d.text((px0 * S, (py1 + 8) * S), "RT (min)", font=font(REG, 17), fill=(104, 112, 128, 255))
    # spectrum: sticks
    sx0, sx1, sy0, sy1 = cx0 + 40, cx1 - 30, cy0 + 300, cy1 - 70
    for x, h, red in ((0.08, 0.20, 0), (0.17, 0.35, 0), (0.26, 0.15, 0), (0.37, 0.55, 0), (0.49, 0.28, 0), (0.58, 0.95, 1), (0.66, 0.22, 0), (0.74, 0.42, 0), (0.83, 0.18, 0), (0.92, 0.30, 0)):
        xx = sx0 + x * (sx1 - sx0); d.line([(xx * S, sy1 * S), (xx * S, (sy1 - h * (sy1 - sy0)) * S)], fill=((190, 60, 40, 255) if red else (43, 92, 138, 255)), width=5 * S)
    d.line([(sx0 * S, sy1 * S), (sx1 * S, sy1 * S)], fill=(140, 150, 165, 255), width=2 * S)
    d.text((sx0 * S, (sy1 + 8) * S), "m/z", font=font(REG, 17), fill=(104, 112, 128, 255))
    # logo + name + tagline (left side)
    logo = Image.open(WEB / "logo.png").convert("RGBA").resize((130 * S, 130 * S), Image.LANCZOS)
    bg = Image.new("RGBA", (150 * S, 150 * S), (0, 0, 0, 0)); ImageDraw.Draw(bg).rounded_rectangle([0, 0, 150 * S - 1, 150 * S - 1], 30 * S, fill=(255, 255, 255, 255))
    bg.alpha_composite(logo, (10 * S, 10 * S)); im.paste(bg, (70 * S, 90 * S), bg)
    d = ImageDraw.Draw(im, "RGBA")
    d.text((70 * S, 262 * S), NAME, font=font(BOLD, 128), fill=(255, 255, 255, 255))
    d.text((74 * S, 424 * S), "Analisi di dati LC-MS/MS", font=font(BOLD, 38), fill=(255, 255, 255, 255))
    d.text((74 * S, 474 * S), "direttamente nel browser", font=font(REG, 38), fill=SOFT + (255,))
    x = 74
    for label in ("Full Scan", "MS2", "MRM"):
        w = d.textlength(label, font=font(BOLD, 24)) / S + 36
        d.rounded_rectangle([x * S, 540 * S, (x + w) * S, 582 * S], 21 * S, fill=(255, 255, 255, 40), outline=(255, 255, 255, 120), width=2 * S)
        d.text(((x + 18) * S, 547 * S), label, font=font(BOLD, 24), fill=(255, 255, 255, 255)); x += w + 12
    return im.resize((W, H), Image.LANCZOS)


if __name__ == "__main__":
    out = WEB / "anteprima.png"
    make().convert("P", palette=Image.ADAPTIVE, colors=128).save(out, optimize=True)
    kb = out.stat().st_size / 1024
    print(f"{out}: {W}x{H}, {kb:.0f} KB")
    assert kb < 280, "too heavy for the WhatsApp large preview (~300 KB)"
