"""Write the QqQ lab logo as SVG (three interlaced rings forming a Q), from the 'Q-circle' concept.
Geometry is computed, so the drawing stays clean at any size. Usage: python3 tools/genera_logo.py OUT_DIR"""
import math, sys
from pathlib import Path

R, W, HALO = 72.0, 30.0, 7.0                  # ring radius (centre line), stroke width, white gap at the crossings
C = {"T": (256.0, 178.0), "L": (186.0, 299.0), "R": (326.0, 299.0)}
INDIGO, TEAL, DARK = "#21306c", "#1e86a3", "#1a2860"

def inter(a, b):
    (x1, y1), (x2, y2) = C[a], C[b]
    d = math.hypot(x2 - x1, y2 - y1); h = math.sqrt(R * R - (d / 2) ** 2)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2; ux, uy = (x2 - x1) / d, (y2 - y1) / d
    return [(mx - uy * h, my + ux * h), (mx + uy * h, my - ux * h)]

def arc(ring, p, half=26):
    cx, cy = C[ring]; t = math.atan2(p[1] - cy, p[0] - cx); a0, a1 = t - math.radians(half), t + math.radians(half)
    x0, y0 = cx + R * math.cos(a0), cy + R * math.sin(a0); x1, y1 = cx + R * math.cos(a1), cy + R * math.sin(a1)
    return f"M{x0:.2f},{y0:.2f} A{R},{R} 0 0 1 {x1:.2f},{y1:.2f}"

def svg(size=512, background=None, pad=0):
    # crossings: each pair crosses twice; the "over" ring alternates (woven look). Order chosen by hand.
    # each pair of rings overlaps in one small lens; there one ring passes over the other, in a cycle
    # (T over L, L over R, R over T), as in the concept: the three rings look woven together
    over = []
    for a, b in (("T", "L"), ("L", "R"), ("R", "T")):
        p1, p2 = inter(a, b)
        over.append((a, ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2), math.dist(p1, p2) / 2, b))
    # at each crossing the "over" ring is drawn again inside a small disc around the crossing point, on a white halo
    # the "over" ring is drawn again as a short arc across the lens, on a white halo (the gap); the arc ends lie on
    # its own stroke, so they leave no visible seam
    def piece(r, p, h, extra):
        cx, cy = C[r]; t = math.atan2(p[1] - cy, p[0] - cx); half = math.asin(min(1, (h + W / 2 + HALO + extra) / R))
        a0, a1 = t - half, t + half
        return (f"M{cx + R * math.cos(a0):.2f},{cy + R * math.sin(a0):.2f} "
                f"A{R},{R} 0 0 1 {cx + R * math.cos(a1):.2f},{cy + R * math.sin(a1):.2f}")
    # the gap is cut out of the "under" ring with a mask (transparent, so the logo works on any background)
    masks = ""
    for name in C:
        cuts = "".join(f'<path d="{piece(a, p, h, 2)}" stroke="#000" stroke-width="{W + 2 * HALO}" fill="none"/>' for a, p, h, b in over if b == name)
        masks += f'<mask id="m{name}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/>{cuts}</mask>'
    rings = "".join(f'<circle mask="url(#m{n})" cx="{x}" cy="{y}" r="{R}"/>' for n, (x, y) in C.items())
    clips = masks
    halo = "".join(f'<path d="{piece(a, p, h, 16)}" stroke="url(#g)" stroke-width="{W}"/>' for a, p, h, b in over)
    # Q tail: from the lower right of ring R, outwards at 45 degrees
    cx, cy = C["R"]; t = math.radians(45)
    x0, y0 = cx + (R + W / 2 - 2) * math.cos(t), cy + (R + W / 2 - 2) * math.sin(t); x1, y1 = cx + (R + W / 2 + 46) * math.cos(t), cy + (R + W / 2 + 46) * math.sin(t)
    tail = f'M{x0:.2f},{y0:.2f} L{x1:.2f},{y1:.2f}'
    bg = ""
    if background:
        bg = f'<rect x="0" y="0" width="512" height="512" rx="112" fill="{background}"/>'
    s = 512 / (512 - 2 * pad) if pad else 1
    tr = f' transform="translate(256 256) scale({1/s:.4f}) translate(-256 -256)"' if pad else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">
<title>QqQ lab</title>
<defs>{clips}<linearGradient id="g" x1="300" y1="90" x2="150" y2="390" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{INDIGO}"/><stop offset="1" stop-color="{TEAL}"/></linearGradient></defs>
{bg}<g{tr} fill="none">
<g stroke="url(#g)" stroke-width="{W}">{rings}</g>
{halo}
<path d="{tail}" stroke="{DARK}" stroke-width="{W}" stroke-linecap="butt"/>
</g></svg>
'''

if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    (out / "logo.svg").write_text(svg(), encoding="utf-8")
    (out / "app-icon.svg").write_text(svg(background="#ffffff", pad=44), encoding="utf-8")
    print("written logo.svg, app-icon.svg in", out)
