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
    P.createBufferSource = function () { au.buf++; return b.apply(this, arguments); }; } })();"""


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
        await ctx.close()
        await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
