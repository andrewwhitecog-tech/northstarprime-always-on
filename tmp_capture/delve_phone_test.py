#!/usr/bin/env python3
"""Phone (390x844, touch) check of VORATH DELVE's touch controls (muted headless Chromium).

usage: delve_phone_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/vorath-delve/"


async def touch_hold(cdp, x, y, ms, page):
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    await page.wait_for_timeout(ms)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    checks, errors = [], []

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail})
        print(json.dumps(checks[-1]), flush=True)

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        for vw, vh, tag in ((390, 844, "portrait"), (844, 390, "landscape")):
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, is_mobile=True, has_touch=True)
            page = await ctx.new_page()
            page.on("pageerror", lambda e: errors.append(f"{tag}: " + str(e)[:200]))
            await page.goto(a.base + URL, wait_until="load")
            await page.wait_for_timeout(2500)
            cdp = await ctx.new_cdp_session(page)
            vis = await page.evaluate("() => { const t = document.getElementById('touchUI'); return t ? getComputedStyle(t).display : 'missing'; }")
            check(f"{tag}: touch controls shown on a touch screen", vis == "flex", vis)
            links = await page.evaluate("() => !!document.querySelector('#overlay #nsp-related')")
            check(f"{tag}: More-games links sit in the title/menu card", links, links)
            await page.screenshot(path=str(out / f"{tag}_01_title.png"), timeout=90000)
            await touch_hold(cdp, vw / 2, vh / 2, 120, page)  # start
            await page.wait_for_timeout(1500)
            x0 = await page.evaluate("() => player.x")
            box = await (await page.query_selector('#touchUI [data-k="KeyD"]')).bounding_box()
            await touch_hold(cdp, box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, 1500, page)
            x1 = await page.evaluate("() => player.x")
            check(f"{tag}: holding the right pad moves the delver", x1 > x0 + 4, {"x0": round(x0), "x1": round(x1)})
            # touch the world: dig (mouse.btn 0), then toggle build (mouse.btn 2)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": vw / 2, "y": vh * 0.45}]})
            await page.wait_for_timeout(300)
            dig = await page.evaluate("() => ({down: mouse.down, btn: mouse.btn})")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            tb = await (await page.query_selector("#tBuild")).bounding_box()
            await touch_hold(cdp, tb["x"] + tb["width"] / 2, tb["y"] + tb["height"] / 2, 80, page)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": vw / 2, "y": vh * 0.45}]})
            await page.wait_for_timeout(300)
            build = await page.evaluate("() => ({down: mouse.down, btn: mouse.btn})")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            check(f"{tag}: touching the world digs, and builds with the toggle on", dig == {"down": True, "btn": 0} and build == {"down": True, "btn": 2}, {"dig": dig, "build": build})
            await page.screenshot(path=str(out / f"{tag}_02_play.png"), timeout=90000)
            sw = await page.evaluate("() => (document.scrollingElement || document.documentElement).scrollWidth")
            check(f"{tag}: no sideways scroll", sw <= vw + 2, sw)
            await ctx.close()
        await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
