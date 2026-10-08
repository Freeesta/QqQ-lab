import sys

fpath = "qqq_lab/web/explore.js"
with open(fpath, "r", encoding="utf-8") as f:
    content = f.read()

import re
# The specific line is:
# lbls.push({ m, x: px - w / 2 - 3, y: Y(y) - 4 - 12 * fz(), w: w + 6, h: 3 + 12 * fz(), tip: `<b>m/z ${m.toFixed(hrp ? DECP : 2)}</b><div class="sm">Tasto destro: azioni</div>` }); }

pattern = re.compile(r"""tip:\s*`<b>m/z\s*\$\{m\.toFixed\(hrp \? DECP : 2\)\}<\/b><div class="sm">Tasto destro: azioni<\/div>`""")

if pattern.search(content):
    content = pattern.sub(r"""tip: `<b>m/z ${m.toFixed(DEC)}</b><div class="sm">Tasto destro: azioni</div>`""", content)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced tooltip decimals!")
else:
    print("Not found.")
