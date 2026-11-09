#!/usr/bin/env python3
"""Real-play check of Prism Drift (itch v5 in the arcade), muted headless Chromium.

Desktop 1280x720: cover, start from the cover, drive with held throttle and steering
for 12 s and again for 20 s, read the HUD (speed, time, lap, position) at each beat.
Phone 390x844: cover fits, tap to start, touch drive, no sideways scroll.
Also: no typed text on the stage canvas, no box behind HUD words, recorded audio only.
usage: pd_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/prism-drift/"
PROBE = """(() => { const au = window.__au = {osc: 0, decode: 0, media: 0, typed: {}};
  const AC = window.AudioContext; if (AC) { const P = AC.prototype, o = P.createOscillator, d = P.decodeAudioData;
    P.createOscillator = function () { au.osc++; return o.apply(this, arguments); };
    P.decodeAudioData = function () { au.decode++; return d.apply(this, arguments); }; }
  const mp = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { au.media++; return mp.apply(this, arguments); };
  const C2 = CanvasRenderingContext2D.prototype;
  for (const n of ['fillText', 'strokeText']) { const f = C2[n]; C2[n] = function (t) { const k = String(t).slice(0, 40); au.typed[k] = (au.typed[k] || 0) + 1; return f.apply(this, arguments); }; } })();"""
HUD = "() => Object.fromEntries(['score','lap','pos','timeHud','speed','drift','boost','integrity'].map(i => [i, (document.getElementById(i)||{}).textContent]))"


async def drive(page, secs):
    loop = asyncio.get_event_loop(); t0 = loop.time(); i = 0
    await page.keyboard.down("ArrowUp")
    try:
        while loop.time() - t0 < secs:
            k = ["ArrowLeft", "ArrowRight", "ArrowLeft", " "][i % 4]
            await page.keyboard.down(k); await page.wait_for_timeout(350 if k != " " else 600); await page.keyboard.up(k)
            await page.wait_for_timeout(250); i += 1
    finally:
        await page.keyboard.up("ArrowUp")


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--base", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    checks, errors = [], []

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail}); print(json.dumps(checks[-1]), flush=True)

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(PROBE)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(3000)
        await page.screenshot(path=str(out / "01_cover.png"))
        await page.click("#overlayBtn")
        await page.wait_for_timeout(500)
        # The countdown runs in game time; on a software-GL runner it can take 20 s of wall time.
        for _ in range(60):
            if float((await page.evaluate(HUD))["timeHud"] or 0) > 0:
                break
            await page.wait_for_timeout(500)
        await drive(page, 12)
        h1 = await page.evaluate(HUD)
        await page.screenshot(path=str(out / "02_race_12s.png"))
        check("desktop: race runs from the cover (time and speed move)", float(h1["timeHud"] or 0) > 0 and int((h1["speed"] or "0").split()[0] or 0) > 0, h1)
        await drive(page, 20)
        h2 = await page.evaluate(HUD)
        await page.screenshot(path=str(out / "03_race_32s.png"))
        check("desktop: still racing later (time advanced)", float(h2["timeHud"] or 0) > float(h1["timeHud"] or 0), h2)
        au = await page.evaluate("() => window.__au")
        check("no typed text on the stage canvas", not au["typed"], au["typed"])
        check("recorded audio only (no oscillators)", au["osc"] == 0 and (au["decode"] + au["media"]) > 0, {k: au[k] for k in ("osc", "decode", "media")})
        box = await page.evaluate("""() => [...document.querySelectorAll('.metric')].slice(0, 3).concat([document.querySelector('.game-panel')]).map(e => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopStyle, c.borderTopWidth]; })""")
        check("no card behind HUD words (rule 30(a))", all(r[0] == "rgba(0, 0, 0, 0)" and (r[1] == "none" or r[2] == "0px") for r in box), box)
        await ctx.close()

        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await ctx.add_init_script(PROBE)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "04_phone_cover.png"))
        await page.tap("#overlayBtn"); await page.wait_for_timeout(4000)
        for _ in range(6):
            try: await page.tap("#boostBtn")
            except Exception: pass
            await page.wait_for_timeout(500)
        hp = await page.evaluate(HUD)
        await page.screenshot(path=str(out / "05_phone_race.png"))
        sw = await page.evaluate("() => (document.scrollingElement || document.documentElement).scrollWidth")
        geo = await page.evaluate("() => { const r = document.querySelector('#stageWrap').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; }")
        check("phone: race runs from a tap", float(hp["timeHud"] or 0) > 0, hp)
        check("phone: no sideways scroll, stage inside 390 CSS px", sw <= 392 and geo[4] == 390 and geo[0] >= 0 and geo[0] + geo[2] <= 391, {"scrollWidth": sw, "stage": geo})
        await ctx.close(); await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
