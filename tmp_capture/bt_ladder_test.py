#!/usr/bin/env python3
"""Real-play check of the Blade Tribunal ladder (muted headless Chromium).

Desktop 1280x720: load, enter the tribunal, play bout 1 with held keys, finish
it, check bout 2 is the Justiciar Duelist, play it while spamming one attack
(the AI should read it), finish it, check the clear and the Thorn unlock.
Phone 390x844: title and in-duel frames. Screenshots at each beat; prints one
JSON line per check and a summary.

usage: bt_ladder_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/vorath-blade-tribunal/"
PROBE = """(() => { const p = window.__fp = {d: [], last: 0};
  function t(ts) { if (p.last) p.d.push(ts - p.last); p.last = ts; requestAnimationFrame(t); } requestAnimationFrame(t);
  const au = window.__au = {osc: 0, decode: 0, buf: 0};
  const AC = window.AudioContext; if (AC) { const P = AC.prototype, o = P.createOscillator, d = P.decodeAudioData, b = P.createBufferSource;
    P.createOscillator = function () { au.osc++; return o.apply(this, arguments); };
    P.decodeAudioData = function () { au.decode++; return d.apply(this, arguments); };
    P.createBufferSource = function () { au.buf++; return b.apply(this, arguments); }; } })();"""


async def cors_shim(ctx, fetched):
    # The app host allows only northstarprime.net; the test page is served from 127.0.0.1.
    async def handle(route):
        resp = await route.fetch()
        fetched.append((route.request.url.rsplit("/", 1)[-1], resp.status))
        h = dict(resp.headers)
        h["access-control-allow-origin"] = "*"
        await route.fulfill(response=resp, headers=h)
    await ctx.route("https://app.northstarprime.net/static/games/hq/**", handle)


async def hold(page, key, ms):
    await page.keyboard.down(key)
    await page.wait_for_timeout(ms)
    await page.keyboard.up(key)


async def L(page):
    return await page.evaluate("() => window.__bladeTribunalDebug.ladder()")


async def wait_until(page, js, secs):
    for _ in range(int(secs * 4)):
        if await page.evaluate(js):
            return True
        await page.wait_for_timeout(250)
    return False


async def play(page, secs, pattern):
    loop = asyncio.get_event_loop()
    t0 = loop.time()
    i = 0
    while loop.time() - t0 < secs:
        k, ms = pattern[i % len(pattern)]
        await hold(page, k, ms)
        i += 1


async def finish_bout(page):
    for _ in range(2):
        await wait_until(page, "() => { const l = window.__bladeTribunalDebug.ladder(); return l.running && l.enemyHp > 0; }", 8)
        await page.evaluate("() => window.__bladeTribunalDebug.koEnemy()")
        await page.wait_for_timeout(2600)


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
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(PROBE)
        fetched = []
        await cors_shim(ctx, fetched)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load")
        await page.wait_for_timeout(3000)
        l0 = await L(page)
        check("atlases loaded, two bouts open", l0["open"] == ["ruby", "duelist"], l0["open"])
        await page.screenshot(path=str(out / "01_title.png"))
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(700)
        await page.screenshot(path=str(out / "02_bout1_intro.png"))
        l1 = await L(page)
        check("bout 1 is Ruby Mantis Regent", l1["enemy"] == "Ruby Mantis Regent" and l1["running"], l1["enemy"])
        await play(page, 8, [("KeyD", 400), ("KeyJ", 120), ("KeyK", 120), ("KeyL", 300), ("Space", 100), ("KeyA", 250), ("KeyJ", 120)])
        await page.screenshot(path=str(out / "03_bout1_fight.png"))
        au = await page.evaluate("() => window.__au")
        check("HQ audio: recorded files fetched and decoded, no oscillators", au["osc"] == 0 and au["decode"] > 0 and len(fetched) > 0,
              {"probe": au, "fetched": fetched[:8]})
        await finish_bout(page)
        ok = await wait_until(page, "() => window.__bladeTribunalDebug.ladder().enemy === 'Justiciar Duelist' && window.__bladeTribunalDebug.ladder().running", 10)
        l2 = await L(page)
        check("bout 2 is Justiciar Duelist after winning bout 1", ok, {k: l2[k] for k in ("bout", "enemy", "enemyMax", "running")})
        await page.wait_for_timeout(400)
        await page.screenshot(path=str(out / "04_bout2_intro.png"))
        # Spam one attack from close range: the Duelist should parry and punish.
        await play(page, 14, [("KeyD", 180), ("KeyJ", 110), ("KeyJ", 110), ("KeyJ", 110), ("KeyD", 120), ("KeyJ", 110)])
        await page.screenshot(path=str(out / "05_bout2_fight.png"))
        l3 = await L(page)
        check("AI read the slash spam (parries or punishes > 0)", l3["ai"]["parries"] + l3["ai"]["punishes"] > 0, l3["ai"])
        check("player history recorded", len(l3["reads"]) >= 5 and l3["reads"].count("slash") >= 4, l3["reads"])
        await play(page, 8, [("KeyL", 900), ("KeyA", 200), ("KeyL", 900), ("KeyK", 120)])
        l4 = await L(page)
        check("AI feints or punishes against a guarding player", l4["ai"]["feints"] + l4["ai"]["punishes"] >= 1, l4["ai"])
        if not l4["running"]:
            check("player lost bout 2 to the Duelist (allowed)", True, l4["result"])
        else:
            await finish_bout(page)
            ok = await wait_until(page, "() => window.__bladeTribunalDebug.ladder().result === 'cleared'", 8)
            l5 = await L(page)
            check("ladder cleared, Thorn blade unlocked and saved", ok and "thorn" in l5["save"]["blades"] and l5["save"]["clears"] >= 1, l5["save"])
            await page.screenshot(path=str(out / "06_cleared.png"))
            await page.keyboard.press("b")
            await page.wait_for_timeout(200)
            l6 = await L(page)
            check("B changes to the Thorn blade", l6["blade"] == "thorn", l6["blade"])
            stored = await page.evaluate("() => localStorage.getItem('nsp.bladeTribunal.v2')")
            check("save written to localStorage", bool(stored) and "thorn" in stored, (stored or "")[:120])
        fp = await page.evaluate("() => { const d = window.__fp.d.slice(60).sort((a,b)=>a-b); return {n: d.length, med: d[d.length>>1], p95: d[Math.floor(d.length*0.95)], max: d[d.length-1]}; }")
        check("frame times on this runner (software GL; not the PC measure)", True, fp)
        await ctx.close()

        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "07_phone_title.png"), timeout=90000)
        btn = await page.query_selector("#startBtn")
        if btn:
            await btn.tap()
        await page.wait_for_timeout(1500)
        for sel in ("#rightBtn", "#slashBtn", "#heavyBtn", "#guardBtn", "#slashBtn"):
            el = await page.query_selector(sel)
            if el:
                try:
                    await el.tap()
                except Exception:
                    pass
            await page.wait_for_timeout(250)
        await page.screenshot(path=str(out / "08_phone_duel.png"), timeout=90000)
        lp = await page.evaluate("() => window.__bladeTribunalDebug.ladder()")
        sw = await page.evaluate("() => (document.scrollingElement || document.documentElement).scrollWidth")
        check("phone: duel starts from a tap", lp["running"], {"enemy": lp["enemy"], "scrollWidth": sw})
        check("phone: no sideways scroll at 390 px", sw <= 392, sw)
        await ctx.close()
        await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
