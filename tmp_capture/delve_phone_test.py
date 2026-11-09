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
INIT = """(() => { const t = window.__typed = {}; const C2 = CanvasRenderingContext2D.prototype;
  for (const n of ['fillText', 'strokeText']) { const f = C2[n]; C2[n] = function (s) { const k = String(s).slice(0, 40); t[k] = (t[k] || 0) + 1; return f.apply(this, arguments); }; } })();"""
# Screen point (CSS px) of a world tile's centre.
TILE_XY = "([tx, ty]) => { const r = canvas.getBoundingClientRect(); return [(tx*TS+8-cam.x)/VIEW_W*r.width+r.left, (ty*TS+8-cam.y)/VIEW_H*r.height+r.top]; }"
# A diggable solid tile and an empty tile beside the delver, both within reach and on screen.
PICK = """() => { const cx = Math.floor((player.x+player.w/2)/TS), fy = Math.floor((player.y+player.h)/TS); const r = canvas.getBoundingClientRect();
  const on = (tx, ty) => { const x = (tx*TS+8-cam.x)/VIEW_W*r.width+r.left, y = (ty*TS+8-cam.y)/VIEW_H*r.height+r.top; return x > 8 && x < innerWidth-8 && y > r.top+8 && y < r.bottom-8; };
  let dig = null, air = null;
  for (const dy of [0, 1, -1, 2]) for (const dx of [2, -2, 1, -1, 3, -3]) { const tx = cx+dx, ty = fy+dy, t = getT(tx, ty);
    if (!dig && t !== T.AIR && t !== T.BEDROCK && TILES[t].solid && withinReach(tx, ty) && on(tx, ty)) dig = [tx, ty, t]; }
  for (const dy of [-1, -2]) for (const dx of [3, -3, 2, -2]) { const tx = cx+dx, ty = fy+dy;
    if (!air && getT(tx, ty) === T.AIR && withinReach(tx, ty) && on(tx, ty)) air = [tx, ty]; }
  return {dig, air}; }"""
WORDS_OVER_PLAY = """() => { const c = canvas.getBoundingClientRect(); const out = [];
  for (const el of document.querySelectorAll('body *')) { if (['SCRIPT','STYLE','CANVAS'].includes(el.tagName)) continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim(); if (!/[A-Za-z]/.test(own)) continue;
    const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.05) continue;
    const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
    const ix = Math.max(0, Math.min(b.right, c.right, innerWidth) - Math.max(b.left, c.left, 0)), iy = Math.max(0, Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top));
    if (ix * iy > 0.3 * b.width * b.height) out.push(own.slice(0, 40)); }
  return out; }"""


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
            await ctx.add_init_script(INIT)
            page = await ctx.new_page()
            page.on("pageerror", lambda e: errors.append(f"{tag}: " + str(e)[:200]))
            await page.goto(a.base + URL, wait_until="load")
            await page.wait_for_timeout(2500)
            cdp = await ctx.new_cdp_session(page)
            vis = await page.evaluate("() => { const t = document.getElementById('touchUI'); return t ? getComputedStyle(t).display : 'missing'; }")
            check(f"{tag}: touch controls shown on a touch screen", vis == "flex", vis)
            links = await page.evaluate("() => !!document.querySelector('#overlay #nsp-related')")
            check(f"{tag}: no More-games text over the cover", not links, links)
            await page.screenshot(path=str(out / f"{tag}_01_title.png"), timeout=90000)
            cov = await page.evaluate("() => { const o = getComputedStyle(document.getElementById('overlay')); const g = document.querySelector('#overlay .go'); return {size: o.backgroundSize, go: getComputedStyle(g).opacity, goText: g.textContent.trim().slice(0, 40)}; }")
            check(f"{tag}: the cover is shown whole (contain) and its start line is visible below it", cov["size"] == "contain" and float(cov["go"]) > 0.9, cov)
            await touch_hold(cdp, vw / 2, vh / 2, 120, page)  # start
            await page.wait_for_timeout(1500)
            x0 = await page.evaluate("() => player.x")
            box = await (await page.query_selector('#touchUI [data-k="KeyD"]')).bounding_box()
            jb = await (await page.query_selector('#touchUI [data-k="KeyW"]')).bounding_box()
            # Each load makes a new random world; a one-tile step right of the spawn stops a walk until you jump,
            # so hold right with one finger and tap jump with another, as a player would.
            rx, ry = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            jx, jy = jb["x"] + jb["width"] / 2, jb["y"] + jb["height"] / 2
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": rx, "y": ry, "id": 1}]})
            for _ in range(3):
                await page.wait_for_timeout(350)
                await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": rx, "y": ry, "id": 1}, {"x": jx, "y": jy, "id": 2}]})
                await page.wait_for_timeout(150)
                await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": [{"x": rx, "y": ry, "id": 1}]})
            await page.wait_for_timeout(350)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            x1 = await page.evaluate("() => player.x")
            check(f"{tag}: holding the right pad (with jump taps) moves the delver", x1 > x0 + 4, {"x0": round(x0), "x1": round(x1)})
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
            # Real outcomes: a held touch digs a tile out; with build on, a touch puts a block into an empty tile.
            await page.evaluate("() => { touchBuild.on = false; }")
            pk = await page.evaluate(PICK)
            dug = placed = None
            if pk["dig"]:
                tx, ty, t0 = pk["dig"]
                x, y = await page.evaluate(TILE_XY, [tx, ty])
                await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
                for _ in range(24):
                    await page.wait_for_timeout(250)
                    if await page.evaluate(f"() => getT({tx}, {ty}) === T.AIR"):
                        break
                await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
                dug = {"tile": [tx, ty], "before": t0, "after": await page.evaluate(f"() => getT({tx}, {ty})"), "count": await page.evaluate(f"() => counts[{t0}] || 0")}
                if dug["after"] == 0:
                    await page.evaluate(f"() => {{ const i = HOT.indexOf({t0}); if (i >= 0) {{ selSlot = i; refreshCounts(); }} touchBuild.on = true; }}")
                    pk2 = await page.evaluate(PICK)
                    if pk2["air"]:
                        bx, by = pk2["air"]
                        x, y = await page.evaluate(TILE_XY, [bx, by])
                        await touch_hold(cdp, x, y, 400, page)
                        placed = {"tile": [bx, by], "after": await page.evaluate(f"() => getT({bx}, {by})"), "slotTile": await page.evaluate("() => HOT[selSlot]")}
                    await page.evaluate("() => { touchBuild.on = false; }")
            check(f"{tag}: a held touch digs a tile out (tile becomes air, inventory +1)", dug and dug["after"] == 0 and dug["count"] >= 1, dug)
            check(f"{tag}: with build on, a touch places that block into an empty tile", placed and placed["after"] != 0, placed)
            await page.screenshot(path=str(out / f"{tag}_03_after_dig_build.png"), timeout=90000)
            typed = await page.evaluate("() => window.__typed")
            check(f"{tag}: the only typed canvas text is numbers (the R reading)", all(k.replace(".", "").isdigit() for k in typed), typed)
            words = await page.evaluate(WORDS_OVER_PLAY)
            check(f"{tag}: no words over the play field", not words, words)
            geo = await page.evaluate("() => { const r = canvas.getBoundingClientRect(), h = document.getElementById('hotbar').getBoundingClientRect(); return {canvas: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hotbarTop: Math.round(h.top), hotbarBottom: Math.round(h.bottom), inset: HUD_INSET_X}; }")
            if tag == "portrait":
                check("portrait: the world is at least 450 px tall and the hotbar sits below it", geo["canvas"][3] >= 450 and geo["hotbarTop"] >= geo["canvas"][1] + geo["canvas"][3] - 1 and geo["hotbarBottom"] <= vh, geo)
            sw = await page.evaluate("() => (document.scrollingElement || document.documentElement).scrollWidth")
            check(f"{tag}: no sideways scroll", sw <= vw + 2, sw)
            await ctx.close()
        # Desktop 1280x720: play, a callout in the strip above the world, the boss bar with phase pips.
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(INIT)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errors.append("desktop: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(out / "desktop_01_cover.png"), timeout=90000)
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(800)
        for k, ms in (("KeyD", 900), ("KeyW", 200), ("KeyD", 700), ("KeyA", 500)):
            await page.keyboard.down(k); await page.wait_for_timeout(ms); await page.keyboard.up(k)
        await page.screenshot(path=str(out / "desktop_02_play.png"), timeout=90000)
        await page.keyboard.press("KeyL")
        await page.wait_for_timeout(400)
        co = await page.evaluate("() => { const e = document.getElementById('callout'), c = canvas.getBoundingClientRect(), r = e.getBoundingClientRect(); return {on: e.classList.contains('on'), text: e.textContent.trim(), calloutBottom: Math.round(r.bottom), canvasTop: Math.round(c.top)}; }")
        await page.screenshot(path=str(out / "desktop_03_callout.png"), timeout=90000)
        check("desktop: a callout prints in the strip above the world, not on it", co["on"] and co["text"] and co["calloutBottom"] <= co["canvasTop"] + 1, co)
        await page.evaluate("() => { try { summonBoss(Math.floor((player.x+player.w/2)/TS)+6, Math.floor(player.y/TS)-2); } catch (e) { window.__bossErr = String(e); } }")
        await page.wait_for_timeout(2500)
        bs = await page.evaluate("() => ({boss: !!(boss && boss.active), phase: boss && boss.phase, err: window.__bossErr || null})")
        await page.screenshot(path=str(out / "desktop_04_boss.png"), timeout=90000)
        typed = await page.evaluate("() => window.__typed")
        words = await page.evaluate(WORDS_OVER_PLAY)
        check("desktop: boss summoned; only numbers typed on the canvas; no words over the play field", bs["boss"] and all(k.replace(".", "").isdigit() for k in typed) and not words, {"boss": bs, "typed": typed, "words": words})
        await ctx.close()
        await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
