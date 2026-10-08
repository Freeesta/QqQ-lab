"""Make the picture shown when the link of the site is shared (WhatsApp, Telegram, Slack, social networks): mzlab/web/anteprima.png, 1200 x 630: just the logo and the name.

The name is read from mzlab/web/appname.js (the only place where it is written). Only Pillow is needed (the logo is mzlab/web/logo.png).
WhatsApp shows the large preview only if the picture is below ~300 KB: the script checks it."""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "mzlab" / "web"
NAME = re.search(r'APP_NAME\s*=\s*"([^"]+)"', (WEB / "appname.js").read_text(encoding="utf-8")).group(1)
W, H, S = 1200, 630, 2                                    # drawn at double size, then reduced (smooth edges)
BOLD, REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
font = lambda p, n: ImageFont.truetype(p, int(n * S))


def make():
    """Only the logo and the name, side by side, centred, on the light colour of the page."""
    im = Image.new("RGB", (W * S, H * S), (247, 248, 250)); d = ImageDraw.Draw(im)
    f = font(BOLD, 190); box = d.textbbox((0, 0), NAME, font=f); tw, th = box[2] - box[0], box[3] - box[1]
    logo_h = 300 * S; gap = 56 * S; total = logo_h + gap + tw
    x0 = (W * S - total) // 2; cy = H * S // 2
    logo = Image.open(WEB / "logo.png").convert("RGBA").resize((logo_h, logo_h), Image.LANCZOS)
    im.paste(logo, (x0, cy - logo_h // 2), logo)
    d.text((x0 + logo_h + gap - box[0], cy - th // 2 - box[1]), NAME, font=f, fill=(37, 40, 44))
    return im.resize((W, H), Image.LANCZOS)


if __name__ == "__main__":
    out = WEB / "anteprima.png"
    make().convert("P", palette=Image.ADAPTIVE, colors=128).save(out, optimize=True)
    kb = out.stat().st_size / 1024
    print(f"{out}: {W}x{H}, {kb:.0f} KB")
    assert kb < 280, "too heavy for the WhatsApp large preview (~300 KB)"
