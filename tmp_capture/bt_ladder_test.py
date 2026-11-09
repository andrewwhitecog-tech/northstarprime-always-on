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
    P.createBufferSource = function () { au.buf++; return b.apply(this, arguments); }; }
  // Rule 30(g) proof: which lettering cells were drawn (by source x,y), and any typed canvas text.
  const lt = window.__lt = {cells: {}, typed: {}};
  const C2 = CanvasRenderingContext2D.prototype, di = C2.drawImage;
  C2.drawImage = function (img, sx, sy) { if (img && img.src && img.src.indexOf('lettering_v04') >= 0 && arguments.length >= 9) { const k = sx + ',' + sy; lt.cells[k] = (lt.cells[k] || 0) + 1; lt.maxBottom = Math.max(lt.maxBottom || 0, arguments[6] + arguments[8]); } if (img && img.src) { for (const n of ['justiciar_ronin', 'justiciar_veilcutter', 'justiciar_seraph', 'justiciar_duelist', 'arena_high_chancel_eye', 'arena_high_chancel_colonnade', 'arena_reliquary_court_stelae', 'arena_reliquary_court_far', 'justiciar_two_verdicts_p1', 'justiciar_two_verdicts_p2', 'arena_split_scales_crucible']) if (img.src.indexOf(n) >= 0) { lt.drawn = lt.drawn || {}; lt.drawn[n] = (lt.drawn[n] || 0) + 1; } } return di.apply(this, arguments); };
  for (const n of ['fillText', 'strokeText']) { const f = C2[n]; C2[n] = function (t) { const k = String(t).slice(0, 40); lt.typed[k] = (lt.typed[k] || 0) + 1; return f.apply(this, arguments); }; } })();"""
CELLS = json.loads((Path(__file__).resolve().parent / "cells.json").read_text(encoding="utf-8"))["cells"]
BY_XY = {f"{v[0]},{v[1]}": k for k, v in CELLS.items()}


async def art_seen(page):
    lt = await page.evaluate("() => window.__lt")
    return sorted({BY_XY.get(k, "?" + k) for k in lt["cells"]}), lt["typed"]


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


async def finish_bout(page, secs=120):
    # Round transitions run in game time; on a slow runner they take many seconds.
    # koEnemy() is ignored between rounds, so keep calling it until the match is over.
    start = await page.evaluate("() => { const l = window.__bladeTribunalDebug.ladder(); return [l.bout, l.result]; }")
    for _ in range(int(secs * 2)):
        l = await page.evaluate("() => window.__bladeTribunalDebug.ladder()")
        if l["result"] or l["bout"] != start[0] or (not l["running"] and l["between"] > 0):
            return
        await page.evaluate("() => window.__bladeTribunalDebug.koEnemy()")
        await page.wait_for_timeout(500)


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
        check("atlases loaded, five bouts open (six with the boss)", l0["open"][:5] == ["ruby", "duelist", "ronin", "veilcutter", "seraph"], l0["open"])
        has_boss = "verdicts1" in l0["open"]
        check("accepted lettering atlas loaded", await page.evaluate("() => letteringReady === true"), "lettering_v04_d438.webp")
        box = await page.evaluate("""() => ['#callout', '.meter', '.panel', '.arena-wrap'].map(q => { const e = document.querySelector(q); if (!e) return [q, null];
          const c = getComputedStyle(e); return [q, c.backgroundColor, c.backgroundImage.slice(0, 20), c.borderTopWidth + ' ' + c.borderTopStyle]; })""")
        check("no box behind any words in the page (rule 30(a))", all(r[1] in (None, "rgba(0, 0, 0, 0)") and r[2] == "none" and (r[3].endswith("none") or r[3].startswith("0px")) for r in box if r[1] is not None), box)
        await page.screenshot(path=str(out / "01_title.png"))
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(700)
        await page.screenshot(path=str(out / "02_bout1_intro.png"))
        await wait_until(page, "() => (state.roundCall || 0) > 0 && state.roundCall < 100 && ladder.intro <= 70", 30)
        await page.screenshot(path=str(out / "02b_round_call.png"))
        l1 = await L(page)
        check("bout 1 is Ruby Mantis Regent", l1["enemy"] == "Ruby Mantis Regent" and l1["running"], l1["enemy"])
        await play(page, 8, [("KeyD", 400), ("KeyJ", 120), ("KeyK", 120), ("KeyL", 300), ("Space", 100), ("KeyA", 250), ("KeyJ", 120)])
        await page.screenshot(path=str(out / "03_bout1_fight.png"))
        au = await page.evaluate("() => window.__au")
        check("HQ audio: recorded files fetched and decoded, no oscillators", au["osc"] == 0 and au["decode"] > 0 and len(fetched) > 0,
              {"probe": au, "fetched": fetched[:8]})
        await finish_bout(page)
        await page.wait_for_timeout(300)
        await page.screenshot(path=str(out / "03b_ko.png"))
        # The between-bout pause runs in game time; on a slow software-GL runner it takes far longer than 3.5 s.
        ok = await wait_until(page, "() => window.__bladeTribunalDebug.ladder().enemy === 'Justiciar Duelist' && window.__bladeTribunalDebug.ladder().running", 60)
        l2 = await L(page)
        ai0 = l2["ai"]
        check("bout 2 is Justiciar Duelist after winning bout 1", ok, {k: l2[k] for k in ("bout", "enemy", "enemyMax", "running")})
        await page.wait_for_timeout(400)
        await page.screenshot(path=str(out / "04_bout2_intro.png"))
        # Spam one attack from close range: the Duelist should parry and punish.
        # Game time runs slowly on a software-GL runner, so spam in 9 s rounds until the Duelist answers (max 45 s).
        for _ in range(5):
            await play(page, 9, [("KeyD", 180), ("KeyJ", 110), ("KeyJ", 110), ("KeyJ", 110), ("KeyD", 120), ("KeyJ", 110)])
            l3 = await L(page)
            d3 = {k: l3["ai"][k] - ai0[k] for k in ai0}
            if d3["parries"] + d3["punishes"] > 0 or not l3["running"]:
                break
        await page.screenshot(path=str(out / "05_bout2_fight.png"))
        check("Duelist read the slash spam in bout 2 (parries or punishes > 0)", d3["parries"] + d3["punishes"] > 0, d3)
        check("player history recorded (the Duelist sees the last choices, mostly slashes)", len(l3["reads"]) >= 4 and l3["reads"].count("slash") >= 3, l3["reads"])
        for _ in range(4):   # a round transition can eat one window on a slow runner
            await play(page, 8, [("KeyL", 900), ("KeyA", 200), ("KeyL", 900), ("KeyK", 120)])
            l4 = await L(page)
            d4 = {k: l4["ai"][k] - l3["ai"][k] for k in ai0}
            if sum(d4.values()) >= 1 or not l4["running"]:
                break
        check("Duelist presses a guarding player (turtle-breaks, feints, punishes or parries)", sum(d4.values()) >= 1, d4)
        if not l4["running"]:
            check("player lost bout 2 to the Duelist (allowed)", True, l4["result"])
        else:
            await finish_bout(page)
            l5 = await L(page)
            check("Thorn blade earned after bout 2 and saved", "thorn" in l5["save"]["blades"], l5["save"])
            # Bouts 3 to 5: each Justiciar's own move must happen in real play, on its own painted arena.
            plans = [
                ("Justiciar Ronin", "justiciar_ronin", "arena_high_chancel_colonnade", "dashCuts", [("KeyA", 700), ("KeyL", 300), ("KeyA", 500), ("KeyJ", 110)], "07_bout3_ronin.png"),
                ("Justiciar Veilcutter", "justiciar_veilcutter", "arena_reliquary_court_stelae", "swaps", [("KeyD", 300), ("KeyJ", 110), ("KeyL", 400), ("KeyD", 200)], "08_bout4_veilcutter.png"),
                ("Justiciar Seraph", "justiciar_seraph", "arena_reliquary_court_far", "overheads", [("KeyA", 600), ("KeyL", 700), ("KeyA", 400), ("KeyL", 500)], "09_bout5_seraph.png"),
            ]
            for name, atlas, arena, sig, pattern, shot in plans:
                ok = await wait_until(page, f"() => window.__bladeTribunalDebug.ladder().enemy === '{name}' && window.__bladeTribunalDebug.ladder().running", 90)
                if not ok:
                    lx = await L(page)
                    check(f"{name}: bout starts", False, {k: lx[k] for k in ("bout", "enemy", "running", "result", "open")})
                    break
                await page.evaluate("() => { window.__lt.maxBottom = 0; }")
                a0 = (await L(page))["ai"]
                for _ in range(6):
                    await play(page, 8, pattern)
                    lx = await L(page)
                    if lx["ai"][sig] - a0[sig] > 0 or not lx["running"]:
                        break
                await page.screenshot(path=str(out / shot))
                lx = await L(page)
                drawn = (await page.evaluate("() => window.__lt.drawn || {}"))
                band = await page.evaluate("() => ({maxBottom: Math.round(window.__lt.maxBottom || 0), head: Math.round(calloutBand().head)})")
                check(f"{name}: its own sheet and painted arena are drawn", drawn.get(atlas, 0) > 0 and drawn.get(arena, 0) > 0 and lx["arenaReady"], {"drawn": {atlas: drawn.get(atlas, 0), arena: drawn.get(arena, 0)}, "arena": lx["arena"]})
                check(f"{name}: its signature move happened in play ({sig})", lx["ai"][sig] - a0[sig] > 0, {k: lx["ai"][k] - a0[k] for k in a0})
                if name == "Justiciar Seraph" and lx["running"]:
                    # Its blocked heavies drain guard stamina 2.2x: hold guard close in until the guard breaks.
                    for _ in range(6):
                        await play(page, 8, [("KeyD", 250), ("KeyL", 2600), ("KeyD", 150), ("KeyL", 2200)])
                        lg = await L(page)
                        if lg["ai"]["guardBreaks"] - a0["guardBreaks"] > 0 or not lg["running"]:
                            break
                    lg = await L(page)
                    await page.screenshot(path=str(out / "09b_bout5_guard_break.png"))
                    check("Justiciar Seraph: its blocked heavies break the player's guard in play (guardBreaks)", lg["ai"]["guardBreaks"] - a0["guardBreaks"] > 0,
                          {k: lg["ai"][k] - a0[k] for k in ("overheads", "guardBreaks")})
                    lx = lg
                check(f"{name}: callouts stay above the fighters' heads", band["maxBottom"] <= band["head"] + 2, band)
                if not lx["running"] and lx["result"] == "fallen":
                    check(f"player fell to {name} (allowed)", True, lx["result"])
                    break
                await finish_bout(page)
                if name == "Justiciar Veilcutter":
                    lv = await L(page)
                    check("Verdict blade earned after bout 4 and saved", "verdict" in lv["save"]["blades"], lv["save"]["blades"])
            # Bout 6: Justiciar Two Verdicts. Phase 1 in real play, then below half health the beat and Wrath.
            ok = has_boss and await wait_until(page, "() => window.__bladeTribunalDebug.ladder().enemy === 'Justiciar Two Verdicts' && window.__bladeTribunalDebug.ladder().running", 90)
            if ok:
                await page.evaluate("() => { window.__lt.maxBottom = 0; }")
                b0 = await L(page)
                # Mercy guards, parries and punishes misses: play (slash spam and whiffs) until it answers, up to 4 rounds of 8 s.
                for _ in range(4):
                    await play(page, 8, [("KeyD", 300), ("KeyJ", 110), ("KeyJ", 110), ("KeyK", 120), ("KeyL", 400), ("KeyA", 200)])
                    b1 = await L(page)
                    if b1["ai"]["parries"] + b1["ai"]["punishes"] - b0["ai"]["parries"] - b0["ai"]["punishes"] > 0 or b1["boss"]["phase2"] or not b1["running"]:
                        break
                b1 = await L(page)
                check("Two Verdicts phase 1 (Mercy) in play: phase-1 sheet on the crucible arena, and it parried or punished",
                      (await page.evaluate("() => (window.__lt.drawn || {})['justiciar_two_verdicts_p1'] || 0")) > 0 and b1["arena"] == "crucible"
                      and (b1["ai"]["parries"] + b1["ai"]["punishes"] - b0["ai"]["parries"] - b0["ai"]["punishes"] > 0),
                      {"arena": b1["arena"], "boss": b1["boss"], "hp": [b1["enemyHp"], b1["enemyMax"]], "ai": {k: b1["ai"][k] - b0["ai"][k] for k in b0["ai"]}})
                for _ in range(40):
                    hp = await page.evaluate("() => window.__bladeTribunalDebug.damageEnemy(12)")
                    st = await L(page)
                    if st["boss"]["phase2"]:
                        break
                    await page.wait_for_timeout(200)
                await page.wait_for_timeout(150)
                await page.screenshot(path=str(out / "10_boss_phase_beat.png"))
                st = await L(page)
                await wait_until(page, "() => window.__bladeTribunalDebug.ladder().boss.beat === 0", 30)
                await play(page, 8, [("KeyD", 250), ("KeyJ", 110), ("KeyL", 500), ("KeyA", 300)])
                await page.screenshot(path=str(out / "11_boss_wrath.png"))
                st2 = await L(page)
                drawn = await page.evaluate("() => window.__lt.drawn || {}")
                band = await page.evaluate("() => ({maxBottom: Math.round(window.__lt.maxBottom || 0), head: Math.round(calloutBand().head)})")
                check("Two Verdicts: below half health the phase changes once, to the Wrath sheet (no words)",
                      st["boss"]["phaseChanges"] >= 1 and (st2["boss"]["phase2"] or not st2["running"] or st2["round"] > st["round"]) and drawn.get("justiciar_two_verdicts_p2", 0) > 0 and drawn.get("arena_split_scales_crucible", 0) > 0,
                      {"beat": st["boss"], "after": st2["boss"], "rounds": [st["round"], st2["round"]], "drawn": {k: drawn.get(k, 0) for k in ("justiciar_two_verdicts_p1", "justiciar_two_verdicts_p2", "arena_split_scales_crucible")}})
                check("Two Verdicts: callouts stay above the boss's head", band["maxBottom"] <= band["head"] + 2, band)
                if st2["running"] or st2["result"] != "fallen":
                    await finish_bout(page)
            elif has_boss:
                lx = await L(page)
                check("Two Verdicts: bout starts", False, {k: lx[k] for k in ("bout", "enemy", "running", "result", "open")})
            ok = await wait_until(page, "() => window.__bladeTribunalDebug.ladder().result === 'cleared'", 60)
            l5 = await L(page)
            check(f"{len(l0['open'])}-bout ladder cleared and saved", ok and l5["save"]["clears"] >= 1 and l5["save"]["bestBout"] >= len(l0["open"]), l5["save"])
            await wait_until(page, "() => !(state.koBanner > 0)", 30)
            await page.wait_for_timeout(600)
            await page.screenshot(path=str(out / "06_cleared.png"))
            await page.keyboard.press("b")
            await page.wait_for_timeout(200)
            l6 = await L(page)
            check("B changes blade after the clear", l6["blade"] in ("thorn", "verdict"), l6["blade"])
            stored = await page.evaluate("() => localStorage.getItem('nsp.bladeTribunal.v2')")
            check("save written to localStorage", bool(stored) and "verdict" in stored, (stored or "")[:120])
        seen, typed = await art_seen(page)
        need = {"bout", "round", "fight", "ko", "minus"}
        check("art callouts drawn from the accepted sheet: BOUT, ROUND, FIGHT, K.O., damage numbers (+ CLEARED/FALLEN, GUARD, FLASH PARRY when reached)",
              need <= set(seen) and any(d in seen for d in "0123456789"), seen)
        check("no typed text on the arena (fillText/strokeText)", not typed, typed)
        geo = await page.evaluate("() => ({maxBottom: Math.round(window.__lt.maxBottom || 0), head: Math.round(calloutBand().head), floor: Math.round(view.floor), viewH: Math.round(view.h)})")
        check("desktop: every lettering callout sits above the fighters' heads (rule 30(c))", 0 < geo["maxBottom"] <= geo["head"] + 2, geo)
        fp = await page.evaluate("() => { const d = window.__fp.d.slice(60).sort((a,b)=>a-b); return {n: d.length, med: d[d.length>>1], p95: d[Math.floor(d.length*0.95)], max: d[d.length-1]}; }")
        check("frame times on this runner (software GL; not the PC measure)", True, fp)
        await ctx.close()

        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await ctx.add_init_script(PROBE)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "07_phone_title.png"), timeout=90000)
        btn = await page.query_selector("#startBtn")
        if btn:
            await btn.tap()
        await page.wait_for_timeout(600)
        await page.screenshot(path=str(out / "07b_phone_bout.png"), timeout=90000)
        await page.wait_for_timeout(900)
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
        geo = await page.evaluate("""() => { const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.width), Math.round(b.height)]; };
          return {scrollY: scrollY, canvas: r('#game'), slash: r('#slashBtn'), dodge: r('#dodgeBtn'), left: r('#leftBtn'), vh: innerHeight}; }""")
        c, vh = geo["canvas"], geo["vh"]
        one = all(0 <= geo[k][0] and geo[k][1] <= vh for k in ("canvas", "slash", "dodge", "left"))
        check("phone: fighters and controls on one screen without scrolling", one and geo["scrollY"] == 0, geo)
        check("phone: arena keeps its shape (620:560), not squashed", abs(c[2] / max(1, c[3]) - 620 / 560) < 0.03, c)
        await page.evaluate("() => window.__bladeTribunalDebug.koEnemy()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(out / "08b_phone_ko.png"), timeout=90000)
        pg = await page.evaluate("() => ({maxBottom: Math.round(window.__lt.maxBottom || 0), head: Math.round(calloutBand().head), cells: Object.keys(window.__lt.cells).length})")
        check("phone: BOUT and K.O. art drawn, all above the fighters' heads (rule 30(c))", pg["cells"] > 0 and 0 < pg["maxBottom"] <= pg["head"] + 2, pg)
        tb = await page.evaluate("() => { const h = document.querySelector('h1').getBoundingClientRect(); let bar = 0; for (const el of document.querySelectorAll('body *')) { const st = getComputedStyle(el); if (st.position === 'fixed' && el.getBoundingClientRect().top < 24 && el.getBoundingClientRect().height < 120 && el.getBoundingClientRect().width > 100) bar = Math.max(bar, el.getBoundingClientRect().bottom); } return {h1Top: Math.round(h.top), barBottom: Math.round(bar)}; }")
        check("phone: page title clear of the shared arcade bar", tb["barBottom"] > 0 and tb["h1Top"] >= tb["barBottom"] - 1, tb)
        check("phone: no sideways scroll at 390 px", sw <= 392, sw)
        await ctx.close()
        await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
