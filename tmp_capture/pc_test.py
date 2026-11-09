#!/usr/bin/env python3
"""Real-play check of Precinct 404 P1 (muted headless Chromium), DOM only.

Desktop 1280x720: the cover and its lettering, a whole shift (choose the first free officer, dispatch, until the
shift ends), pins on the map, the result lettering and sentence, portraits, no box behind words.
Phone 390x844: the cover by tap, a dispatch by tap, nothing wider than the screen.
usage: pc_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/precinct-404/"
IMG_OK = "(sel) => [...document.querySelectorAll(sel)].map(i => [i.getAttribute('src'), i.complete && i.naturalWidth > 0])"
BOXES = """() => ['header', '.panel', '.chip', '.forecast-item', '.director', '.director-stat', '.memory-board', '.log', '.tag'].map(q => {
  const e = document.querySelector(q); if (!e) return [q, null]; const c = getComputedStyle(e);
  return [q, c.backgroundColor, c.backgroundImage.slice(0, 12), c.borderLeftStyle + ' ' + c.borderLeftWidth + ' ' + c.borderLeftColor]; })"""


async def play_shift(page, max_calls=40):
    calls = 0
    for _ in range(max_calls):
        if await page.evaluate("() => document.getElementById('shiftEnd').classList.contains('on')"):
            break
        btn = await page.query_selector("button.officer:not(.busy):not([disabled])")
        if btn:
            await btn.click()
        await page.wait_for_timeout(150)
        d = await page.query_selector("#dispatchBtn:not([disabled])")
        if d:
            await d.click(); calls += 1
        else:
            h = await page.query_selector("#holdBtn"); await h.click()
        await page.wait_for_timeout(250)
    return calls


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--base", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    checks, errors = [], []

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail}); print(json.dumps(checks[-1]), flush=True)

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "01_cover.png"))
        cov = await page.evaluate(IMG_OK, "#titleCover img")
        check("cover: the tower view with the accepted PRECINCT 404 / DISPATCH QUEUE lettering, loaded", len(cov) == 2 and all(ok for _, ok in cov), cov)
        await page.click("#titleCover"); await page.wait_for_timeout(400)
        gone = await page.evaluate("() => getComputedStyle(document.getElementById('titleCover')).display === 'none'")
        check("cover: a click starts the shift", gone, gone)
        await page.screenshot(path=str(out / "02_dashboard.png"))
        mh = await page.evaluate("() => { const r = document.querySelector('.map-wrap').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top)]; }")
        check("the district map is on screen (measured, not just loaded)", mh[1] >= 150 and mh[2] < 720, mh)
        por = await page.evaluate(IMG_OK, "img.portrait, img.adviser, .map-wrap img.map")
        check("map, officer portraits (Friendly, Tank, Badge) and advisers (Mags, Derek) load", len(por) == 6 and all(ok for _, ok in por), por)
        p0 = await page.evaluate("() => document.querySelectorAll('#pins .pin').length")
        calls = await play_shift(page)
        p1 = await page.evaluate("() => ({pins: document.querySelectorAll('#pins .pin').length, now: document.querySelectorAll('#pins .pin.now').length})")
        await page.screenshot(path=str(out / "03_shift_end.png"))
        end = await page.evaluate("""() => { const c = document.getElementById('mapCallout'), e = document.getElementById('shiftEnd');
          return {callout: c.getAttribute('src'), on: c.classList.contains('on'), loaded: c.complete && c.naturalWidth > 0,
                  title: (e.querySelector('h2') || {}).textContent, button: !!e.querySelector('#modalBtn'), modalShown: getComputedStyle(document.getElementById('modal')).display,
                  calloutBox: (() => { const a = c.getBoundingClientRect(), m = document.querySelector('.map-wrap').getBoundingClientRect();
                    return a.width > 100 && a.left >= m.left - 1 && a.right <= m.right + 1 && a.top >= m.top - 1 && a.bottom <= m.bottom + 1; })(),
                  callTitleHidden: getComputedStyle(document.getElementById('caseTitle')).display === 'none'}; }""")
        check("a whole shift plays by dispatching officers; answered calls stay as pins on the map", calls >= 5 and p1["pins"] >= min(calls, 12) and p1["pins"] > p0, {"dispatches": calls, "pins_before": p0, **p1})
        check("shift end: SHIFT CLEARED or SHIFT LOST lettering over the map, the sentence and Continue in the page, no result box",
              end["on"] and end["loaded"] and ("shift_cleared" in (end["callout"] or "") or "shift_lost" in (end["callout"] or "")) and end["button"] and end["modalShown"] == "none"
              and end["calloutBox"] and end["callTitleHidden"], end)
        box = await page.evaluate(BOXES)
        check("no box, panel or strip behind words (rule 30(a))",
              all(r[1] in (None, "rgba(0, 0, 0, 0)") and r[2] == "none" for r in box if r[1] is not None), box)
        await ctx.close()

        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "04_phone_cover.png"))
        await page.tap("#titleCover"); await page.wait_for_timeout(400)
        btn = await page.query_selector("button.officer:not(.busy)")
        if btn:
            await btn.tap()
        await page.wait_for_timeout(200)
        cc0 = await page.evaluate("() => document.getElementById('caseCount').textContent")
        d = await page.query_selector("#dispatchBtn:not([disabled])")
        if d:
            await d.tap()
        await page.wait_for_timeout(400)
        cc1 = await page.evaluate("() => document.getElementById('caseCount').textContent")
        await page.screenshot(path=str(out / "05_phone_play.png"))
        await page.screenshot(path=str(out / "06_phone_full.png"), full_page=True)
        geo = await page.evaluate("() => ({sw: (document.scrollingElement || document.documentElement).scrollWidth, map: Math.round(document.querySelector('.map-wrap').getBoundingClientRect().width), mapH: Math.round(document.querySelector('.map-wrap').getBoundingClientRect().height)})")
        check("phone: cover by tap, a dispatch by tap moves to the next call", cc1 != cc0, [cc0, cc1])
        check("phone: nothing wider than 390 px, the map fits and shows", geo["sw"] <= 392 and geo["map"] <= 390 and geo["mapH"] >= 100, geo)
        await ctx.close(); await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
