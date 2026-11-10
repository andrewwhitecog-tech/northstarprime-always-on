#!/usr/bin/env python3
"""Real-play check of Precinct 404 (muted headless Chromium), DOM only.

Desktop 1280x720 (won shift): the cover and its lettering, a whole shift played as a player would (the free officer with
the best fit number, then Dispatch), pins on the map, the result lettering and sentence, all five officer portraits and
both advisers measured on screen, no box behind words (now including the officer cards), and Enter at the shift's end
starting Night Shift+.
Desktop 1280x720 (lost shift, a gamepad stubbed in): the worst fit every call until the shift is lost, SHIFT LOST
lettering, then pad A starting a new shift.
Phone 390x844: the cover by tap, a dispatch by tap, nothing wider than the screen.
usage: pc_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/precinct-404/"
IMG_OK = "(sel) => [...document.querySelectorAll(sel)].map(i => [i.getAttribute('src'), i.complete && i.naturalWidth > 0, Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)])"
BOXES = """() => ['header', '.panel', '.chip', '.forecast-item', '.director', '.director-stat', '.memory-board', '.log', '.tag', '.officer', '.officer.busy', '.officer.selected'].map(q => {
  const e = document.querySelector(q); if (!e) return [q, null]; const c = getComputedStyle(e);
  return [q, c.backgroundColor, c.backgroundImage.slice(0, 12), c.borderTopWidth + ' ' + c.borderRightWidth + ' ' + c.borderBottomWidth, c.borderRadius]; })"""
# A pad the page can find through navigator.getGamepads(); window.__pad is null until the test plugs it in.
PAD_STUB = """window.__pad = null;
Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: function () { return window.__pad ? [window.__pad] : []; } });
window.__plugPad = () => { window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), vibrationActuator: null }; };
window.__padButton = (i, down) => { window.__pad.buttons[i] = { pressed: down, value: down ? 1 : 0 }; };"""
PICK = """(mode) => { const btns = [...document.querySelectorAll('button.officer:not(.busy):not([disabled])')];
  if (!btns.length) return null; const val = b => Number((b.querySelector('.chip') || {}).textContent || 0);
  btns.sort((a, b) => mode === 'worst' ? val(a) - val(b) : val(b) - val(a)); return btns[0].dataset.id; }"""


async def play_shift(page, mode="best", max_calls=40):
    calls = 0
    for _ in range(max_calls):
        if await page.evaluate("() => document.getElementById('shiftEnd').classList.contains('on')"):
            break
        oid = await page.evaluate(PICK, mode)
        if oid:
            await page.click(f"button.officer[data-id='{oid}']")
        await page.wait_for_timeout(150)
        d = await page.query_selector("#dispatchBtn:not([disabled])")
        if d:
            await d.click(); calls += 1
        else:
            h = await page.query_selector("#holdBtn"); await h.click()
        await page.wait_for_timeout(250)
    return calls


def boxes_ok(box):
    return all(r[1] in (None, "rgba(0, 0, 0, 0)") and r[2] == "none" and (len(r) < 4 or r[3] == "0px 0px 0px") and (len(r) < 5 or r[4] in ("0px", ""))
               for r in box if r[1] is not None and r[0].startswith(".officer")) and \
        all(r[1] in (None, "rgba(0, 0, 0, 0)") and r[2] == "none" for r in box if r[1] is not None)


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--base", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    checks, errors = [], []

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail}); print(json.dumps(checks[-1]), flush=True)

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        # ---- desktop, a won shift, Enter to continue ----
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "01_cover.png"))
        cov = await page.evaluate(IMG_OK, "#titleCover img")
        check("cover: the tower view with the accepted PRECINCT 404 / DISPATCH QUEUE lettering, loaded", len(cov) == 2 and all(c[1] for c in cov), cov)
        await page.click("#titleCover"); await page.wait_for_timeout(400)
        gone = await page.evaluate("() => getComputedStyle(document.getElementById('titleCover')).display === 'none'")
        check("cover: a click starts the shift", gone, gone)
        await page.screenshot(path=str(out / "02_dashboard.png"))
        mh = await page.evaluate("() => { const r = document.querySelector('.map-wrap').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top)]; }")
        check("the district map is on screen (measured, not just loaded)", mh[1] >= 150 and mh[2] < 720, mh)
        vis = await page.evaluate("""() => { const b = document.querySelector('.case-body').getBoundingClientRect(), t = document.getElementById('caseTitle').getBoundingClientRect(),
          d = document.getElementById('dispatchBtn').getBoundingClientRect(); return {titleTop: Math.round(t.top), titleBottom: Math.round(t.bottom), bodyBottom: Math.round(b.bottom), dispatchBottom: Math.round(d.bottom), vh: innerHeight}; }""")
        check("desktop: the call title and Dispatch are on screen without scrolling", vis["titleBottom"] <= vis["bodyBottom"] and vis["dispatchBottom"] <= vis["vh"], vis)
        por = await page.evaluate(IMG_OK, "img.portrait")
        ids = await page.evaluate("() => [...document.querySelectorAll('button.officer')].map(b => [b.dataset.id, !!b.querySelector('img.portrait')])")
        check("all five robot officers have a portrait, loaded and drawn at its size (Logic and Process are the v05 redraws)",
              len(por) == 5 and all(p[1] and p[2] >= 40 and p[3] >= 40 for p in por) and all(x[1] for x in ids)
              and any("officer_logic_v02" in p[0] for p in por) and any("officer_process_v02" in p[0] for p in por), {"portraits": por, "cards": ids})
        adv = await page.evaluate(IMG_OK, "img.adviser, .map-wrap img.map")
        check("map and advisers (Mags, Derek) load and show", len(adv) == 3 and all(p[1] and p[2] > 20 for p in adv), adv)
        await page.click("button.officer[data-id='process']"); await page.wait_for_timeout(200)
        await page.screenshot(path=str(out / "02b_selected.png"))
        box = await page.evaluate(BOXES)
        p0 = await page.evaluate("() => document.querySelectorAll('#pins .pin').length")
        await page.click("#dispatchBtn"); await page.wait_for_timeout(300)
        box2 = await page.evaluate(BOXES)   # now one officer is busy
        check("no box, panel or strip behind words, the officer cards included: plain, selected and busy (rule 30(a); Grok's 14:45Z ask)",
              boxes_ok(box) and boxes_ok(box2) and any(r[0] == ".officer.busy" and r[1] is not None for r in box2), {"selected": box, "busy": box2})
        calls = 1 + await play_shift(page, "best")
        p1 = await page.evaluate("() => ({pins: document.querySelectorAll('#pins .pin').length, now: document.querySelectorAll('#pins .pin.now').length})")
        await page.screenshot(path=str(out / "03_shift_end.png"))
        end = await page.evaluate("""() => { const c = document.getElementById('mapCallout'), e = document.getElementById('shiftEnd');
          return {callout: c.getAttribute('src'), on: c.classList.contains('on'), loaded: c.complete && c.naturalWidth > 0,
                  title: (e.querySelector('h2') || {}).textContent, button: (() => { const b = document.getElementById('modalBtn').getBoundingClientRect(); return b.width > 0 && b.bottom <= innerHeight; })(),
                  buttonText: document.getElementById('modalBtn').textContent, modalShown: getComputedStyle(document.getElementById('modal')).display,
                  calloutBox: (() => { const a = c.getBoundingClientRect(), m = document.querySelector('.map-wrap').getBoundingClientRect();
                    return a.width > 100 && a.left >= m.left - 1 && a.right <= m.right + 1 && a.top >= m.top - 1 && a.bottom <= m.bottom + 1; })(),
                  callTitleHidden: getComputedStyle(document.getElementById('caseTitle')).display === 'none'}; }""")
        check("a whole shift plays by dispatching officers; answered calls stay as pins on the map", calls >= 5 and p1["pins"] >= min(calls, 12) and p1["pins"] > p0, {"dispatches": calls, "pins_before": p0, **p1})
        check("shift end: SHIFT CLEARED lettering over the map, the sentence and Continue in the page, no result box",
              end["on"] and end["loaded"] and "shift_cleared" in (end["callout"] or "") and end["button"] and end["modalShown"] == "none"
              and end["calloutBox"] and end["callTitleHidden"], end)
        await page.focus("body"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500)
        nxt = await page.evaluate("""() => ({ended: document.querySelector('.case-panel').classList.contains('ended'), callout: document.getElementById('mapCallout').classList.contains('on'),
          continueInRow: !!document.querySelector('.case-actions #modalBtn'), dispatchShown: getComputedStyle(document.getElementById('dispatchBtn')).display !== 'none', call: document.getElementById('caseCount').textContent})""")
        await page.screenshot(path=str(out / "04_after_enter.png"))
        check("Enter at the shift's end starts Night Shift+ (was stuck: Enter only dispatched)",
              not nxt["ended"] and not nxt["callout"] and not nxt["continueInRow"] and nxt["dispatchShown"] and nxt["call"].startswith("Night Call 1"), nxt)
        await ctx.close()

        # ---- desktop, a lost shift, pad A to continue ----
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(PAD_STUB)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("pad: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2000)
        await page.click("#titleCover"); await page.wait_for_timeout(300)
        lost_calls = await play_shift(page, "worst")
        await page.screenshot(path=str(out / "05_shift_lost.png"))
        lost = await page.evaluate("() => ({callout: document.getElementById('mapCallout').getAttribute('src'), on: document.getElementById('mapCallout').classList.contains('on'), button: document.getElementById('modalBtn').textContent, call: document.getElementById('caseCount').textContent})")
        check("playing the worst fit every call loses the shift: SHIFT LOST lettering, New Shift offered", lost["on"] and "shift_lost" in (lost["callout"] or "") and "New Shift" in lost["button"], {"dispatches": lost_calls, **lost})
        await page.evaluate("() => window.__plugPad()"); await page.wait_for_timeout(300)
        await page.evaluate("() => window.__padButton(0, true)"); await page.wait_for_timeout(300)
        await page.evaluate("() => window.__padButton(0, false)"); await page.wait_for_timeout(400)
        after = await page.evaluate("() => ({ended: document.querySelector('.case-panel').classList.contains('ended'), call: document.getElementById('caseCount').textContent, padBadge: getComputedStyle(document.getElementById('xbox-pad-badge')).display, trust: document.getElementById('trustVal').textContent})")
        await page.screenshot(path=str(out / "06_after_pad_a.png"))
        check("pad A at the shift's end starts a new shift (was stuck: A read the modal's old 'active' class)",
              not after["ended"] and after["call"] == "Call 1 of 12" and after["trust"] == "55" and after["padBadge"] != "none", after)
        await ctx.close()

        # ---- phone ----
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "07_phone_cover.png"))
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
        await page.screenshot(path=str(out / "08_phone_play.png"))
        await page.screenshot(path=str(out / "09_phone_full.png"), full_page=True)
        geo = await page.evaluate("() => ({sw: (document.scrollingElement || document.documentElement).scrollWidth, map: Math.round(document.querySelector('.map-wrap').getBoundingClientRect().width), mapH: Math.round(document.querySelector('.map-wrap').getBoundingClientRect().height)})")
        check("phone: cover by tap, a dispatch by tap moves to the next call", cc1 != cc0, [cc0, cc1])
        check("phone: nothing wider than 390 px, the map fits and shows", geo["sw"] <= 392 and geo["map"] <= 390 and geo["mapH"] >= 100, geo)
        await ctx.close(); await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
