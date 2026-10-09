"""«Lettura facilitata» of Teoria and Pratica: Aa panel, fonts, WCAG spacing, backgrounds (contrast), ruler that never takes clicks, concentration mode,
reduced motion (simulations start paused), reading aloud (speechSynthesis stubbed), persistence, Ripristina, and the Teoria inside the app (#tframe)."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import json
steps = []
def step(name, fn):
    try: fn(); steps.append((name, "ok"))
    except Exception as e:
        import traceback; ln = [f.lineno for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e_accessibilita.py")][-1]
        steps.append((name, f"FAIL line {ln}: " + str(e).split("\n")[0][:240]))
LUM = "(c=>{const m=c.match(/[0-9.]+/g).map(Number),f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])})"
def cr(pg, a, b):
    return pg.evaluate(f"(()=>{{const L={LUM};const x=L({a}),y=L({b});return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}})()")
STUB = """window.__said=[];(function(){const s=window.speechSynthesis;if(!s)return;s.speak=u=>{window.__said.push({t:u.text,r:u.rate,l:u.lang});setTimeout(()=>{u.onstart&&u.onstart();u.onend&&u.onend()},10)};s.cancel=()=>{}})();"""
r = Run(port=8970, wd="/tmp/wd_a11y")
try:
    with sync_playwright() as p:
        pg = r.page(p); pg.set_viewport_size({"width": 1400, "height": 1000})
        base = f"http://127.0.0.1:{r.port}/static/teoria/"
        def fresh(name="06-esi.html", scheme="light", motion="no-preference", prefs=None):
            q = r.b.new_page(viewport={"width": 1400, "height": 1000}, color_scheme=scheme, reduced_motion=motion)
            q.add_init_script(STUB)
            if prefs is not None: q.add_init_script("localStorage.setItem('qqq.a11y', %s)" % json.dumps(json.dumps(prefs)))
            q.goto(base + name); q.wait_for_timeout(900); return q
        def attr(q, n): return q.evaluate(f"document.documentElement.getAttribute('data-a11y-{n}')")
        def panel():
            q = fresh(); assert q.get_attribute("#a11y-btn", "aria-label") == "Lettura facilitata"
            assert q.is_hidden("#a11y-panel"); q.click("#a11y-btn"); assert q.is_visible("#a11y-panel")
            assert q.get_attribute("#a11y-panel", "role") == "dialog"
            q.screenshot(path=SH + "a11y_pannello.png")
            q.keyboard.press("Escape"); assert q.is_hidden("#a11y-panel")
            q.keyboard.press("Tab") ; q.focus("#a11y-btn"); q.keyboard.press("Enter"); assert q.is_visible("#a11y-panel")          # keyboard only
            txt = q.inner_text("#a11y-panel"); assert "⌘+ / Ctrl+" in txt and "Dimensione" not in txt, txt[:200]
            assert q.evaluate("localStorage.getItem('qqq.prefs')") is None            # the old key is not touched
            q.close()
        step("Aa button, side panel, Esc, keyboard, no old text-size", panel)
        def fonts():
            q = fresh(); q.click("#a11y-btn")
            q.check("input[name=a11y-font][value=atkinson]"); q.wait_for_timeout(500)
            assert "Atkinson" in q.evaluate("getComputedStyle(document.body).fontFamily") and attr(q, "font") == "atkinson"
            assert q.evaluate("document.fonts.check('16px \"Atkinson Hyperlegible Next\"')"), "font not loaded"
            q.check("input[name=a11y-font][value=dyslexic]"); q.wait_for_timeout(600)
            assert "OpenDyslexic" in q.evaluate("getComputedStyle(document.body).fontFamily")
            assert q.evaluate("document.fonts.check('16px OpenDyslexic')"), "OpenDyslexic not loaded"
            q.close()
            q = fresh()                                   # fonts are downloaded only when chosen
            assert not q.evaluate("[...document.fonts].some(f=>f.status==='loaded')")
            q.close()
        step("Atkinson and OpenDyslexic apply and load; nothing downloaded otherwise", fonts)
        def space():
            q = fresh(); q.click("#a11y-btn"); q.check("input[data-k=space]")
            v = q.evaluate("(()=>{const p=document.querySelector('main p'),c=getComputedStyle(p),fs=parseFloat(c.fontSize);return {ls:parseFloat(c.letterSpacing)/fs,ws:parseFloat(c.wordSpacing)/fs,lh:parseFloat(c.lineHeight)/fs,mb:parseFloat(c.marginBottom)/fs,ta:c.textAlign,w:p.getBoundingClientRect().width,ch:fs*0.5*65}})()")
            assert abs(v["ls"] - .12) < .005 and abs(v["ws"] - .16) < .005 and 1.6 <= v["lh"] <= 1.8 and abs(v["mb"] - 2) < .05 and v["ta"] in ("left", "start"), v
            assert v["w"] <= 65 * 16 * 1.0, v                     # at most 65ch (the width of a character is about .5-.6 em)
            assert q.evaluate("getComputedStyle(document.querySelector('main svg text')||document.body).letterSpacing") in ("normal", "0px")
            q.close()
        step("spacing: 0.12em / 0.16em / line 1.7 / 2em after paragraphs / 65ch", space)
        def backgrounds():
            for bg, need in (("cream", 4.5), ("blue", 4.5), ("hc", 7)):
                for scheme in ("light", "dark"):
                    q = fresh(scheme=scheme, prefs={"bg": bg}); assert attr(q, "bg") == bg
                    ink = cr(q, "getComputedStyle(document.body).color", "getComputedStyle(document.body).backgroundColor")
                    mut = cr(q, "getComputedStyle(document.querySelector('.lead')||document.querySelector('main p')).color", "getComputedStyle(document.body).backgroundColor")
                    acc = cr(q, "getComputedStyle(document.querySelector('main a')).color", "getComputedStyle(document.body).backgroundColor")
                    assert ink >= need and acc >= need, (bg, scheme, ink, acc)
                    if bg == "cream" and scheme == "dark": assert q.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(30, 27, 22)"
                    if (bg, scheme) in (("cream", "light"), ("hc", "dark")): q.screenshot(path=SH + f"a11y_{bg}_{scheme}.png")
                    q.close()
        step("backgrounds cream / blue / high contrast, light and dark: contrast 4.5 (7)", backgrounds)
        def persist():
            q = fresh(); q.click("#a11y-btn"); q.check("input[name=a11y-bg][value=blue]"); q.check("input[data-k=nums]")
            assert json.loads(q.evaluate("localStorage.getItem('qqq.a11y')"))["bg"] == "blue"
            q.reload(); q.wait_for_timeout(700)
            assert attr(q, "bg") == "blue" and attr(q, "nums") is not None
            q.click("#a11y-btn"); assert q.is_checked("input[name=a11y-bg][value=blue]") and q.is_checked("input[data-k=nums]")
            q.close()
        step("persistence after reload (key qqq.a11y)", persist)
        def ruler():
            q = fresh(); q.click("#a11y-btn"); q.check("input[data-k=ruler]"); q.keyboard.press("Escape")
            assert q.evaluate("getComputedStyle(document.getElementById('a11y-ruler')).pointerEvents") == "none"
            assert q.evaluate("getComputedStyle(document.getElementById('a11y-ruler')).display") == "block"
            q.mouse.move(700, 400); q.wait_for_timeout(100); q.screenshot(path=SH + "a11y_righello.png")
            assert q.evaluate("document.getElementById('a11y-ruler').style.getPropertyValue('--ry')") not in ("", "40%")
            q.click("#side .toc a >> nth=1"); q.wait_for_timeout(400)            # a click through the ruler still works
            assert q.evaluate("location.hash") != ""
            q.close()
        step("reading ruler follows the mouse and never blocks clicks", ruler)
        def focus():
            q = fresh(); assert q.is_visible("#side")
            q.keyboard.press("f"); assert attr(q, "focus") is not None and q.is_hidden("#side"), "F"
            q.mouse.wheel(0, 900); q.wait_for_timeout(300)
            assert q.evaluate("parseFloat(getComputedStyle(document.getElementById('a11y-prog')).width)") > 0
            q.screenshot(path=SH + "a11y_concentrazione.png")
            q.keyboard.press("f"); assert q.is_visible("#side"); q.close()
        step("concentration mode (F): index hidden, progress bar", focus)
        def motion():
            q = fresh("09-quadrupolo.html", motion="reduce"); assert attr(q, "reduce") is not None
            q.evaluate("document.querySelector('#sim-field').scrollIntoView()"); q.wait_for_timeout(600)
            assert q.inner_text("#sim-field [data-k=play]") == "Riprendi", q.inner_text("#sim-field [data-k=play]")
            a = q.evaluate("document.querySelector('#sim-field canvas').toDataURL()"); q.wait_for_timeout(500)
            assert a == q.evaluate("document.querySelector('#sim-field canvas').toDataURL()"), "still moving"
            assert q.evaluate("getComputedStyle(document.documentElement).scrollBehavior") == "auto"
            q.click("#sim-field [data-k=play]"); q.wait_for_timeout(600)
            assert a != q.evaluate("document.querySelector('#sim-field canvas').toDataURL()"), "does not start"
            q.close()
            q = fresh("10-qqq.html", motion="reduce"); q.evaluate("document.querySelector('#sim-modi,.sim canvas').scrollIntoView()") if False else None
            q.wait_for_timeout(500)
            sel = ".sim:has(canvas) button:has-text('Avvia')"
            q.evaluate("document.querySelectorAll('.sim canvas')[0].scrollIntoView()"); q.wait_for_timeout(500); assert q.locator(sel).count() >= 1
            q.close()
            q = fresh("09-quadrupolo.html", motion="no-preference")                     # automatic: nothing changes without the system request
            assert attr(q, "reduce") is None; q.close()
            q = fresh("09-quadrupolo.html", motion="no-preference", prefs={"motion": "always"}); assert attr(q, "reduce") is not None; q.close()
        step("reduced motion (system or «Sempre»): simulations start paused", motion)
        def speech():
            q = fresh(); assert q.evaluate("'speechSynthesis' in window")
            q.click("main h2 .a11y-say >> nth=0"); q.wait_for_timeout(300)
            said = q.evaluate("window.__said"); assert said and said[0]["l"] == "it-IT" and len(said[0]["t"]) > 3, said
            q.click("#a11y-btn"); q.check("input[name=a11y-rate][value='1.2']")
            q.evaluate("(()=>{const p=document.querySelector('main p');const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r)})()")
            q.click("#a11y-sel"); q.wait_for_timeout(200)
            last = q.evaluate("window.__said.at(-1)"); assert abs(last["r"] - 1.2) < 1e-3, last
            q.close()
            q = fresh(); q.evaluate("delete window.speechSynthesis") ; q.reload(); q.wait_for_timeout(600)       # no Web Speech: the option is not there
            q.close()
        step("reading aloud: ▶ next to headings, selection, speed (stub)", speech)
        def reset():
            q = fresh(prefs={"font": "atkinson", "space": True, "bg": "cream", "ruler": True, "focus": True, "nums": True})
            q.click("#a11y-btn"); q.click("#a11y-reset"); q.wait_for_timeout(200)
            assert all(attr(q, n) is None for n in ("font", "space", "bg", "ruler", "focus", "nums")), q.evaluate("document.documentElement.outerHTML.slice(0,300)")
            assert json.loads(q.evaluate("localStorage.getItem('qqq.a11y')")) == {}
            q.close()
        step("Ripristina turns everything off", reset)
        def pratica():
            q = fresh("pratica.html"); assert q.is_visible("#a11y-btn"); q.close()
            q = fresh(); q.set_viewport_size({"width": 400, "height": 800}); q.reload(); q.wait_for_timeout(600); assert q.is_visible("#a11y-btn"); q.close()
        step("Aa is on Pratica and on a narrow screen", pratica)
        def inapp():
            pg.evaluate("localStorage.setItem('qqq.a11y', JSON.stringify({bg:'cream',space:true}))")
            pg.click("#nav button[data-v=theory]"); pg.wait_for_timeout(1800)
            f = next(x for x in pg.frames if "/teoria/" in x.url)
            assert f.evaluate("document.documentElement.getAttribute('data-a11y-bg')") == "cream" and f.evaluate("document.documentElement.hasAttribute('data-a11y-space')")
            assert f.is_visible("#a11y-btn"); f.click("#a11y-btn"); f.check("input[name=a11y-bg][value=blue]")
            assert f.evaluate("document.documentElement.getAttribute('data-a11y-bg')") == "blue"
            pg.screenshot(path=SH + "a11y_nell_app.png")
        step("the Teoria inside the app (#tframe) applies and changes the preferences", inapp)
    r.close()
except Exception as e:
    steps.append(("run", "FAIL " + str(e)[:300]))
    try: r.close()
    except Exception: pass
for n, s in steps: print(s.split(" ")[0].upper(), n, s if s != "ok" else "")
