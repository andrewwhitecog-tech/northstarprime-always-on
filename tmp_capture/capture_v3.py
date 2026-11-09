#!/usr/bin/env python3
"""IDG games push v3 real-play capture harness (headless Chromium, audio muted).

v3 (Claude, 2026-11-09) adds to the Job 11 v2 harness: an audio probe (oscillators,
buffer sources, media plays, audio files fetched), and a phone pass at 390x844
with touch input sent through CDP (taps and swipes), recording page overflow and
whether touch play changed the frame. --shard i/n splits the 63 games.

Per game: load -> title frame -> start (canvas click, Enter, Space, start-like
buttons) -> scripted play (held arrows/WASD/Space/attack keys, mouse sweeps and
clicks, safe button clicks) -> midplay frame at T_MID s of play -> hardest frame
at T_HARD s. Records console errors, page errors, rAF frame deltas, long tasks,
WebGL availability and every input step tried.

usage: capture.py --base http://127.0.0.1:8765 --out DIR [--slugs a,b] [--workers 2]
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import io
import json
import random
import statistics
import time
from pathlib import Path

from PIL import Image, ImageStat
from playwright.async_api import async_playwright

ALL_SLUGS = [
    "logic-foundry", "ladder", "side-street", "vorath-signal-crown", "vorath-arena", "vorath-pinball",
    "vorath-prism-runner", "void-pong", "asteroids-void", "galaga-interdimensional", "breakout-wall",
    "missile-command", "dharma-invaders", "pac-dharma", "tetris-plus", "tetris-void", "snake-dimension",
    "digital-terrarium-3d", "vorathic-reef-tank", "digital-terrarium-v2", "tai-chi-flow", "rose-window",
    "precinct-404", "blackjack-noir", "subject-000999", "paperclip-resistance", "prediction-arena",
    "prism-drift", "vorath-blade-tribunal", "vorath-dominion", "vorath-incursion", "vorath-souls",
    "vorath-circus", "vorath-circus-midnight", "super-vorath-bros", "vorath-cabinet-row",
    "vorath-reliquary-gacha-shrine", "signal-cartographer-prime", "signal-gallery", "digital-terrarium",
    "digital-terrarium-v1", "future-teller-cabinet", "gem-shark", "good-news-drive", "hypernova-swarm",
    "idr-tracker-cabinet", "flappy-dharma", "precinct-404-signal", "slots-biolume", "static-house",
    "vorath-delve", "the-melting-hour", "the-dark-below", "cascade-salmon-run", "system1-arena",
    "northstar-chrono-defender", "container-yard", "vorath-census", "prism-masonry",
    "super-arcade-archive", "chrono-blade-2049", "prism-runner-2049", "void-siege",
]

ROUTES = {"cascade-salmon-run": "/arcade/custom/cascade-salmon-run.html"}

LAUNCH_ARGS = [
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
]

INIT_SCRIPT = r"""
(() => {
  let s = 0x9E3779B1 >>> 0;
  Math.random = function () {               // mulberry32, fixed seed
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const probe = window.__nspProbe = {deltas: [], longTasks: 0, longTaskMs: 0, recording: false, last: 0};
  function tick(ts) {
    if (probe.recording && probe.last) probe.deltas.push(ts - probe.last);
    probe.last = ts; requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const au = window.__nspAudio = {osc: 0, buf: 0, decode: 0, mediaPlay: 0, ctx: 0};
  try {
    const W = window.AudioContext ? 'AudioContext' : (window.webkitAudioContext ? 'webkitAudioContext' : null);
    if (W) {
      const Orig = window[W];
      const P = Orig.prototype;
      const o = P.createOscillator, b = P.createBufferSource, d = P.decodeAudioData;
      P.createOscillator = function () { au.osc++; return o.apply(this, arguments); };
      P.createBufferSource = function () { au.buf++; return b.apply(this, arguments); };
      P.decodeAudioData = function () { au.decode++; return d.apply(this, arguments); };
      const Wrapped = function () { au.ctx++; return new Orig(...arguments); };
      Wrapped.prototype = P;
      window[W] = Wrapped;
    }
    const mp = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { au.mediaPlay++; return mp.apply(this, arguments); };
  } catch (e) {}
  try {
    new PerformanceObserver(list => {
      if (!probe.recording) return;
      for (const e of list.getEntries()) { probe.longTasks++; probe.longTaskMs += e.duration; }
    }).observe({entryTypes: ['longtask']});
  } catch (e) {}
})();
"""

START_WORDS = r"/\b(start|play|begin|enter|deal|spin|launch|descend|engage|fight|new game|new run|go|run|continue|ok|got it|skip|insert coin|press start|ready|accept|open|dispatch|scan)\b/i"
AVOID_WORDS = r"/(back|home|arcade|exit|quit|menu|share|download|export|reset|restart|new shift|clear|delete|copy|mute|sound|audio|music|volume|fullscreen|help|how to|close|pause|settings|credits|leaderboard|install|store|shop|buy|link|crypto|attest|receipt)/i"

PICK_BUTTON_JS = """
([startWords, avoidWords, mode]) => {
  const sw = eval(startWords), aw = eval(avoidWords);
  const els = [...document.querySelectorAll('button, [role=button], input[type=button], input[type=submit], .btn')];
  const vis = els.filter(e => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
      && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled && cs.pointerEvents !== 'none';
  }).map(e => ({e, t: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 40)}))
    .filter(o => !aw.test(o.t) && !(o.e.closest('a')));
  let pool = mode === 'start' ? vis.filter(o => sw.test(o.t)) : vis;
  if (!pool.length) return null;
  const o = pool[Math.floor(Math.random() * pool.length)];
  const r = o.e.getBoundingClientRect();
  return {x: r.left + r.width / 2, y: r.top + r.height / 2, text: o.t};
}
"""

CANVAS_JS = """
() => {
  const cs = [...document.querySelectorAll('canvas')].map(c => {const r = c.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height};})
    .filter(r => r.w > 50 && r.h > 50 && r.bottom !== 0);
  cs.sort((a, b) => b.w * b.h - a.w * a.h);
  const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; } })();
  return {canvas: cs[0] || null, count: cs.length, webgl};
}
"""

STATE_JS = """() => { try { if (typeof window.__nspGameState === 'function') return String(window.__nspGameState());
  if (window.__COMMENTARY_DEBUG__) return String(window.__COMMENTARY_DEBUG__.snapshot().state); } catch (e) { return 'err:' + e; } return null; }"""

KEY_PATTERN = [
    ("ArrowRight", 450), ("Space", 120), ("ArrowUp", 300), ("KeyD", 400), ("KeyJ", 120),
    ("ArrowLeft", 450), ("Space", 120), ("KeyZ", 120), ("KeyA", 400), ("ArrowDown", 250),
    ("KeyX", 120), ("KeyW", 300), ("Enter", 100), ("KeyK", 120), ("ShiftLeft", 150),
]


def grey_thumb(png: bytes) -> Image.Image:
    return Image.open(io.BytesIO(png)).convert("L").resize((160, 90), Image.BILINEAR)


def diff(a: Image.Image, b: Image.Image) -> float:
    pa, pb = a.tobytes(), b.tobytes()
    return round(sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa), 2)


def frame_stats(png: bytes) -> dict:
    g = grey_thumb(png)
    st = ImageStat.Stat(g)
    return {"mean": round(st.mean[0], 2), "std": round(st.stddev[0], 2), "sha256": hashlib.sha256(png).hexdigest()}


async def hold(page, key, ms):
    try:
        await page.keyboard.down(key)
        await page.wait_for_timeout(ms)
        await page.keyboard.up(key)
    except Exception:
        pass


async def click_xy(page, x, y):
    try:
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.wait_for_timeout(60)
        await page.mouse.up()
    except Exception:
        pass


async def run_game(browser, base, slug, out: Path, t_mid: float, t_hard: float, log_steps=True):
    route = ROUTES.get(slug, f"/arcade/custom/{slug}/")
    if not route.endswith(".html") and not route.endswith("/"):
        route += "/"
    rec = {"slug": slug, "url": f"{base}{route}", "steps": [], "console_errors": [], "page_errors": [],
           "status": "ok"}
    ctx = await browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
    await ctx.add_init_script(INIT_SCRIPT)
    page = await ctx.new_page()
    page.on("console", lambda m: rec["console_errors"].append(m.text[:300]) if m.type == "error" else None)
    page.on("pageerror", lambda e: rec["page_errors"].append(str(e)[:300]))
    page.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
    rec["audio_files_fetched"] = []

    def _resp(r):
        u = r.url.lower().split("?")[0]
        ct = (r.headers or {}).get("content-type", "")
        if u.endswith((".mp3", ".ogg", ".wav", ".m4a", ".opus", ".flac")) or ct.startswith("audio/"):
            if len(rec["audio_files_fetched"]) < 60:
                rec["audio_files_fetched"].append(r.url[-90:])
    page.on("response", _resp)
    gdir = out / slug
    gdir.mkdir(parents=True, exist_ok=True)
    try:
        resp = await page.goto(rec["url"], wait_until="load", timeout=45000)
        rec["http"] = resp.status if resp else None
        await page.wait_for_timeout(2500)
        info = await page.evaluate(CANVAS_JS)
        rec["canvas"], rec["webgl"] = info["canvas"], info["webgl"]
        title_png = await page.screenshot(type="png", timeout=90000)
        (gdir / "title.png").write_bytes(title_png)
        g_title = grey_thumb(title_png)
        c = info["canvas"]
        cx, cy = ((c["x"] + c["w"] / 2, c["y"] + c["h"] / 2) if c else (640, 360))
        # --- start sequence: try each method, keep going while the frame stays put ---
        attempts = [("canvas click", None), ("Enter", "Enter"), ("Space", "Space"), ("start button", "btn"),
                    ("start button 2", "btn"), ("KeyS", "KeyS"), ("canvas click 2", None)]
        started_by = None
        for label, key in attempts:
            if key is None:
                await click_xy(page, cx, cy)
            elif key == "btn":
                b = await page.evaluate(PICK_BUTTON_JS, [START_WORDS, AVOID_WORDS, "start"])
                if not b:
                    rec["steps"].append(f"{label}: none visible")
                    continue
                await click_xy(page, b["x"], b["y"])
                label = f"{label} '{b['text']}'"
            else:
                await hold(page, key, 140)
            await page.wait_for_timeout(700)
            if page.url.rstrip("/") != rec["url"].rstrip("/") and "#" not in page.url:
                rec["steps"].append(f"{label}: navigated to {page.url}; went back")
                await page.goto(rec["url"], wait_until="load", timeout=45000)
                await page.wait_for_timeout(1500)
                continue
            d = diff(g_title, grey_thumb(await page.screenshot(type="png", timeout=90000)))
            rec["steps"].append(f"{label}: diff {d}")
            if d > 5 and not started_by:
                started_by = label
        rec["started_by"] = started_by
        # --- scripted play ---
        await page.evaluate("() => { const p = window.__nspProbe; if (p) { p.deltas = []; p.longTasks = 0; p.longTaskMs = 0; p.recording = true; } }")
        t0 = time.monotonic()
        i = 0
        shots = {}
        rnd = random.Random(slug)
        while True:
            el = time.monotonic() - t0
            if "mid" not in shots and el >= t_mid:
                shots["mid"] = await page.screenshot(type="png", timeout=90000)
                rec["state_mid"] = await page.evaluate(STATE_JS)
            if el >= t_hard:
                shots["hard"] = await page.screenshot(type="png", timeout=90000)
                rec["state_hard"] = await page.evaluate(STATE_JS)
                break
            if i % 3 == 0:
                st = await page.evaluate(STATE_JS)
                if st in ("dead", "over", "GAMEOVER", "lost", "victory"):
                    rec.setdefault("restarts", 0)
                    rec["restarts"] += 1
                    for k in ("KeyR", "Enter", "Space"):
                        await hold(page, k, 120)
            key, ms = KEY_PATTERN[i % len(KEY_PATTERN)]
            await hold(page, key, ms)
            if c and i % 2 == 0:
                x = c["x"] + c["w"] * rnd.uniform(0.2, 0.8)
                y = c["y"] + c["h"] * rnd.uniform(0.25, 0.8)
                await page.mouse.move(x, y, steps=4)
                if i % 4 == 0:
                    await click_xy(page, x, y)
            if i % 3 == 2:
                b = await page.evaluate(PICK_BUTTON_JS, [START_WORDS, AVOID_WORDS, "any"])
                if b:
                    await click_xy(page, b["x"], b["y"])
                    if len(rec["steps"]) < 40:
                        rec["steps"].append(f"play: clicked '{b['text']}'")
            if page.url.rstrip("/") != rec["url"].rstrip("/") and "#" not in page.url:
                rec["steps"].append(f"play: navigated to {page.url}; went back")
                await page.goto(rec["url"], wait_until="load", timeout=45000)
            i += 1
        probe = await page.evaluate("() => { const p = window.__nspProbe; if (!p) return null; p.recording = false; return {d: p.deltas, lt: p.longTasks, ltms: p.longTaskMs}; }")
        (gdir / "midplay.png").write_bytes(shots["mid"])
        (gdir / "hardest.png").write_bytes(shots["hard"])
        g_mid, g_hard = grey_thumb(shots["mid"]), grey_thumb(shots["hard"])
        rec["frames"] = {"title": frame_stats(title_png), "midplay": frame_stats(shots["mid"]),
                         "hardest": frame_stats(shots["hard"])}
        rec["diff"] = {"title_mid": diff(g_title, g_mid), "mid_hard": diff(g_mid, g_hard),
                       "title_hard": diff(g_title, g_hard)}
        if probe and probe["d"]:
            d = sorted(x for x in probe["d"] if x > 0)
            rec["frame_ms"] = {"n": len(d), "median": round(statistics.median(d), 2),
                               "p95": round(d[int(len(d) * 0.95) - 1], 2), "max": round(d[-1], 1),
                               "fps_median": round(1000 / statistics.median(d), 1),
                               "mean": round(statistics.fmean(d), 2), "fps_mean": round(1000 / statistics.fmean(d), 1),
                               "long_tasks": probe["lt"], "long_task_ms": round(probe["ltms"], 1)}
        rec["inputs_sent"] = i
        rec["audio_probe"] = await page.evaluate("() => window.__nspAudio || null")
    except Exception as e:  # noqa: BLE001
        rec["status"] = "error"
        rec["error"] = repr(e)[:400]
    finally:
        await ctx.close()
    (gdir / "record.json").write_text(json.dumps(rec, indent=2), encoding="utf-8")
    return rec


PHONE_JS = """() => { const se = document.scrollingElement || document.documentElement;
  const cs = [...document.querySelectorAll('canvas')].map(c => c.getBoundingClientRect()).filter(r => r.width > 40 && r.height > 40)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  const c = cs[0];
  return {inner_w: innerWidth, inner_h: innerHeight, scroll_w: se.scrollWidth, scroll_h: se.scrollHeight,
          canvas: c ? {x: Math.round(c.left), y: Math.round(c.top), w: Math.round(c.width), h: Math.round(c.height)} : null,
          touch_ui: !!document.querySelector('[class*=touch i], [id*=touch i], [class*=joystick i], [id*=joystick i], [class*=dpad i], [id*=dpad i], [class*=mobile i]')}; }"""


async def touch(cdp, kind, pts):
    await cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y} for x, y in pts]})


async def swipe(cdp, x0, y0, x1, y1, steps=6, hold_ms=40):
    try:
        await touch(cdp, "touchStart", [(x0, y0)])
        for k in range(1, steps + 1):
            await touch(cdp, "touchMove", [(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)])
            await asyncio.sleep(hold_ms / 1000)
        await touch(cdp, "touchEnd", [])
    except Exception:
        pass


async def run_phone(browser, base, slug, out: Path, secs: float = 14.0):
    route = ROUTES.get(slug, f"/arcade/custom/{slug}/")
    if not route.endswith(".html") and not route.endswith("/"):
        route += "/"
    rec = {"slug": slug, "status": "ok", "errors": 0}
    ctx = await browser.new_context(
        viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
        user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Mobile Safari/537.36")
    await ctx.add_init_script(INIT_SCRIPT)
    page = await ctx.new_page()
    page.on("pageerror", lambda e: rec.__setitem__("errors", rec["errors"] + 1))
    page.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
    gdir = out / slug
    gdir.mkdir(parents=True, exist_ok=True)
    try:
        await page.goto(f"{base}{route}", wait_until="load", timeout=45000)
        await page.wait_for_timeout(2500)
        t_png = await page.screenshot(type="png", timeout=90000)
        (gdir / "phone_title.png").write_bytes(t_png)
        rec["layout_title"] = await page.evaluate(PHONE_JS)
        cdp = await ctx.new_cdp_session(page)
        c = rec["layout_title"]["canvas"] or {"x": 0, "y": 0, "w": 390, "h": 844}
        cx, cy = c["x"] + c["w"] / 2, c["y"] + c["h"] / 2
        await page.touchscreen.tap(min(389, max(1, cx)), min(843, max(1, cy)))
        await page.wait_for_timeout(600)
        b = await page.evaluate(PICK_BUTTON_JS, [START_WORDS, AVOID_WORDS, "start"])
        if b:
            await page.touchscreen.tap(b["x"], b["y"])
            rec["start_tap"] = b["text"]
            await page.wait_for_timeout(600)
        t0 = time.monotonic()
        i = 0
        pts = [(0.25, 0.75), (0.75, 0.75), (0.5, 0.5), (0.15, 0.9), (0.85, 0.9), (0.5, 0.3)]
        while time.monotonic() - t0 < secs:
            fx, fy = pts[i % len(pts)]
            x, y = 390 * fx, 844 * fy
            if i % 3 == 0:
                await swipe(cdp, x, y, x + (60 if i % 2 else -60), y - 30)
            else:
                try:
                    await page.touchscreen.tap(x, y)
                except Exception:
                    pass
            await page.wait_for_timeout(250)
            i += 1
        m_png = await page.screenshot(type="png", timeout=90000)
        (gdir / "phone_play.png").write_bytes(m_png)
        rec["layout_play"] = await page.evaluate(PHONE_JS)
        rec["diff_title_play"] = diff(grey_thumb(t_png), grey_thumb(m_png))
        rec["state"] = await page.evaluate(STATE_JS)
        lt = rec["layout_title"]
        rec["overflow_x"] = lt["scroll_w"] > lt["inner_w"] + 2
        rec["touch_inputs"] = i
    except Exception as e:  # noqa: BLE001
        rec["status"] = "error"
        rec["error"] = repr(e)[:300]
    finally:
        await ctx.close()
    (gdir / "phone.json").write_text(json.dumps(rec, indent=2), encoding="utf-8")
    return rec


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--slugs", default="")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--mid", type=float, default=20.0)
    ap.add_argument("--hard", type=float, default=38.0)
    ap.add_argument("--shard", default="")
    ap.add_argument("--no-phone", action="store_true")
    a = ap.parse_args()
    slugs = [s for s in a.slugs.split(",") if s] or ALL_SLUGS
    if a.shard:
        k, n = (int(v) for v in a.shard.split("/"))
        slugs = [s for j, s in enumerate(slugs) if j % n == k]
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=LAUNCH_ARGS)
        ver = browser.version
        sem = asyncio.Semaphore(a.workers)

        async def one(s):
            async with sem:
                t = time.monotonic()
                r = await run_game(browser, a.base, s, out, a.mid, a.hard)
                if not a.no_phone:
                    r["phone"] = await run_phone(browser, a.base, s, out)
                r["seconds"] = round(time.monotonic() - t, 1)
                print(f"{s}: {r['status']} t-m={r.get('diff', {}).get('title_mid')} start={r.get('started_by')} "
                      f"err={len(r['console_errors'])}+{len(r['page_errors'])} fps={r.get('frame_ms', {}).get('fps_median')} "
                      f"audio={r.get('audio_probe')} files={len(r.get('audio_files_fetched', []))} "
                      f"phone_diff={r.get('phone', {}).get('diff_title_play')}",
                      flush=True)
                results.append(r)
        await asyncio.gather(*(one(s) for s in slugs))
        await browser.close()
    order = {s: i for i, s in enumerate(slugs)}
    results.sort(key=lambda r: order[r["slug"]])
    meta = {"chromium": ver, "launch_args": LAUNCH_ARGS, "viewport": "1280x720", "workers": a.workers,
            "t_mid_s": a.mid, "t_hard_s": a.hard, "base": a.base, "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    tag = ("_" + a.shard.replace("/", "of")) if a.shard else ""
    (out / f"results{tag}.json").write_text(json.dumps({"meta": meta, "games": results}, indent=2), encoding="utf-8")
    print("wrote", out / f"results{tag}.json")


if __name__ == "__main__":
    asyncio.run(main())
