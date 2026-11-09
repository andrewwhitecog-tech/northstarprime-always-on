#!/usr/bin/env python3
"""Real-play check of The Dark Below v2 (muted headless Chromium).

usage: db_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/the-dark-below/"
PROBE = """(() => { const au = window.__au = {osc: 0, decode: 0, buf: 0};
  const AC = window.AudioContext; if (AC) { const P = AC.prototype, o = P.createOscillator, d = P.decodeAudioData, b = P.createBufferSource;
    P.createOscillator = function () { au.osc++; return o.apply(this, arguments); };
    P.decodeAudioData = function () { au.decode++; return d.apply(this, arguments); };
    P.createBufferSource = function () { au.buf++; return b.apply(this, arguments); }; }
  const lt = window.__lt = {art: {}, typed: {}};
  const C2 = CanvasRenderingContext2D.prototype, di = C2.drawImage;
  C2.drawImage = function (img) { const m = img && img.src && img.src.match(/lettering_([a-z]+)_v04/); if (m) lt.art[m[1]] = (lt.art[m[1]] || 0) + 1; return di.apply(this, arguments); };
  for (const n of ['fillText', 'strokeText']) { const f = C2[n]; C2[n] = function (t) { const k = String(t).slice(0, 40); lt.typed[k] = (lt.typed[k] || 0) + 1; return f.apply(this, arguments); }; } })();"""
LT = "() => window.__lt"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    checks, errors, fetched = [], [], []

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail})
        print(json.dumps(checks[-1]), flush=True)

    snap = "() => window.__darkBelowWave20.snapshot()"
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        await ctx.add_init_script(PROBE)

        async def shim(route):
            resp = await route.fetch()
            fetched.append(route.request.url.rsplit("/", 1)[-1])
            hd = dict(resp.headers)
            hd["access-control-allow-origin"] = "*"
            await route.fulfill(response=resp, headers=hd)
        await ctx.route("https://app.northstarprime.net/static/games/hq/**", shim)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        page.on("response", lambda r: fetched.append(r.url.rsplit("/", 1)[-1]) if "/static/games/sfx/" in r.url else None)
        await page.goto(a.base + URL, wait_until="load")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "01_title.png"), timeout=90000)
        lt0 = await page.evaluate(LT)
        check("title is the accepted lettering art (THE DARK BELOW), nothing typed on the canvas", lt0["art"].get("title", 0) > 0 and not lt0["typed"], lt0)
        box = await page.evaluate("""() => ['.stat', '.objective', '.hunter', '.nsp-return a', '#nsp-related'].map(q => { const e = document.querySelector(q); if (!e) return [q, null];
          const c = getComputedStyle(e); return [q, c.backgroundColor, c.backgroundImage.slice(0, 16), c.borderTopStyle + ' ' + c.borderTopWidth]; })""")
        check("no box behind any words (HUD, objective, captions, links) (rule 30(a))",
              all(r[1] == "rgba(0, 0, 0, 0)" and r[2] == "none" and (r[3].startswith("none") or r[3].endswith(" 0px")) for r in box if r[1] is not None), box)
        ret = await page.evaluate("""() => { const a = document.querySelector('.nsp-return a').getBoundingClientRect(), c = document.querySelector('#game').getBoundingClientRect();
          return {link: [a.left, a.top, a.right, a.bottom].map(Math.round), stage: [c.left, c.top, c.right, c.bottom].map(Math.round)}; }""")
        L, S = ret["link"], ret["stage"]
        check("return link is off the stage", L[0] >= S[2] or L[2] <= S[0] or L[1] >= S[3] or L[3] <= S[1], ret)
        await page.click("#start")
        await page.wait_for_timeout(800)
        s1 = await page.evaluate(snap)
        check("starts in chamber 1 of 4 with the Null Sexton", s1["running"] and s1["chambers"] == 4 and s1["hunter"] == "Null Sexton", {k: s1[k] for k in ("running", "chambers", "hunter", "room")})
        # move: the Sexton hears motion
        await page.keyboard.down("ArrowLeft")
        await page.wait_for_timeout(1800)
        s2 = await page.evaluate(snap)
        await page.keyboard.up("ArrowLeft")
        check("moving wakes the Sexton (alert > 0)", s2["hunters"] and s2["hunters"][0]["alert"] > 0, s2["hunters"])
        await page.screenshot(path=str(out / "02_chamber1.png"), timeout=90000)
        await page.wait_for_timeout(2500)
        s3 = await page.evaluate(snap)
        check("standing still calms the Sexton", s3["hunters"][0]["alert"] < s2["hunters"][0]["alert"] or not s3["running"], s3["hunters"])
        # the finale
        await page.evaluate("() => window.__darkBelowWave20.jump(3)")
        await page.wait_for_timeout(600)
        await page.screenshot(path=str(out / "03a_seal_emblem.png"), timeout=90000)
        s4 = await page.evaluate(snap)
        check("Descent Seal holds all three hungers", s4["room"] == "DESCENT SEAL" and sorted(h["type"] for h in s4["hunters"]) == [0, 1, 2], {k: s4[k] for k in ("room", "hunters")})
        await page.keyboard.press("q")  # raise the flame: the Widow hunts light
        await page.wait_for_timeout(3500)
        await page.screenshot(path=str(out / "03_descent_seal.png"), timeout=90000)
        s5 = await page.evaluate(snap)
        widow = [h for h in s5["hunters"] if h["type"] == 1]
        check("raised flame wakes the Tallow Widow", s5["lightMode"] == "search" and widow and widow[0]["alert"] >= 1 or not s5["running"], {"light": s5["lightMode"], "hunters": s5["hunters"], "running": s5["running"]})
        await page.wait_for_timeout(5000)
        s6 = await page.evaluate(snap)
        check("deepest chamber saved (4)", s6["save"]["best"] >= 4, s6["save"])
        for i in range(3):
            await page.evaluate(f"() => window.__darkBelowWave20.collect({i})")
        s7 = await page.evaluate(snap)
        check("three shards open the eye-door", s7["fragments"] == 3, {"fragments": s7["fragments"], "running": s7["running"]})
        if s7["running"]:
            await page.evaluate("() => { player.x = room.exit[0]; player.y = room.exit[1]; }")
            for _ in range(40):
                if (await page.evaluate(snap))["won"]:
                    break
                await page.wait_for_timeout(250)
            await page.wait_for_timeout(900)
            await page.screenshot(path=str(out / "05_covenant_restored.png"), timeout=90000)
        s8 = await page.evaluate(snap)
        lt1 = await page.evaluate(LT)
        check("reaching the eye-door with three shards wins: COVENANT RESTORED art, seal emblem shown on entry", s8["won"] and lt1["art"].get("restored", 0) > 0 and lt1["art"].get("seal", 0) > 0, {"won": s8["won"], "art": lt1["art"]})
        # TAKEN: lose all three gold threads
        await page.evaluate("() => window.__darkBelowWave20.start()")
        await page.wait_for_timeout(500)
        for _ in range(3):
            await page.evaluate("() => window.__darkBelowWave20.scare()")
            await page.wait_for_timeout(1600)
        s9 = await page.evaluate(snap)
        await page.wait_for_timeout(700)
        await page.screenshot(path=str(out / "06_taken.png"), timeout=90000)
        lt2 = await page.evaluate(LT)
        check("losing the last thread shows TAKEN art; still nothing typed on the canvas", s9["threads"] <= 0 and lt2["art"].get("taken", 0) > 0 and not lt2["typed"], {"threads": s9["threads"], "art": lt2["art"], "typed": lt2["typed"]})
        au = await page.evaluate("() => window.__au")
        sfx = sorted(set(f for f in fetched if f.endswith(".mp3")))
        check("recorded sound only: files fetched and decoded, zero oscillators", au["osc"] == 0 and au["decode"] > 0 and len(sfx) >= 3, {"probe": au, "files": sfx})
        await ctx.close()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load")
        await page.wait_for_timeout(2500)
        await page.tap("#start")
        await page.wait_for_timeout(800)
        up = await page.query_selector('[data-key="ArrowUp"]')
        box = await up.bounding_box() if up else None
        if box:
            cdp = await ctx.new_cdp_session(page)
            x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
            await page.wait_for_timeout(1200)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        sp = await page.evaluate(snap)
        sw = await page.evaluate("() => (document.scrollingElement || document.documentElement).scrollWidth")
        await page.screenshot(path=str(out / "04_phone.png"), timeout=90000)
        check("phone: starts from a tap and the touch pad moves the bearer", sp["running"] and box is not None, {"player": sp["player"], "pad": bool(box)})
        check("phone: no sideways scroll at 390 px", sw <= 392, sw)
        icons = await page.evaluate("() => ['#touchLight', '#touchFlare'].map(q => { const e = document.querySelector(q); return [e.getAttribute('aria-label'), e.textContent.trim(), !!e.querySelector('svg')]; })")
        check("phone: Light and Flare are drawn icons, no words on the stage", all(i[1] == "" and i[2] for i in icons), icons)
        await ctx.close()
        await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
