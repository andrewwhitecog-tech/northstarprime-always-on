#!/usr/bin/env python3
"""Find what runs during a game's longest frames (IDG push, PR #206 stall hunt).

Loads a game in a muted headless Chromium, starts it (canvas click, Enter), and
records requestAnimationFrame gaps plus the V8 sampling profiler (CDP Profiler,
1 ms) for N seconds of held-key play. For every frame gap over --gap ms it lists
the JS functions with the most samples inside that gap (self time), and the
share of samples that were (program), (idle) or (garbage collector).

usage: profile_stall.py --base http://127.0.0.1:8765 --slugs a,b --out DIR [--secs 12] [--gap 200]
"""
import argparse
import asyncio
import json
from collections import Counter
from pathlib import Path

from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

PROBE = r"""
(() => {
  const p = window.__stall = {t: [], rec: false};
  function tick(ts) { if (p.rec) p.t.push(performance.timeOrigin + ts); requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
})();
"""
KEYS = [("ArrowRight", 400), ("Space", 120), ("KeyJ", 120), ("ArrowLeft", 400), ("KeyK", 120), ("ArrowUp", 250),
        ("KeyZ", 120), ("KeyX", 120), ("ShiftLeft", 150), ("Enter", 100)]


async def hold(page, k, ms):
    try:
        await page.keyboard.down(k)
        await page.wait_for_timeout(ms)
        await page.keyboard.up(k)
    except Exception:
        pass


def attribute(profile, t0_us, gaps):
    nodes = {n["id"]: n for n in profile["nodes"]}
    out = []
    # sample timestamps: startTime + cumulative timeDeltas (microseconds, monotonic clock)
    ts, t = [], profile["startTime"]
    for d in profile["timeDeltas"]:
        t += d
        ts.append(t)
    for g0, g1 in gaps:
        c = Counter()
        n_all = 0
        for sid, st in zip(profile["samples"], ts):
            if g0 <= st <= g1:
                n_all += 1
                cf = nodes[sid]["callFrame"]
                name = cf.get("functionName") or "(anonymous)"
                url = cf.get("url", "").split("/")[-1]
                c[f"{name} {url}:{cf.get('lineNumber', -1) + 1}"] += 1
        out.append({"gap_ms": round((g1 - g0) / 1000, 1), "samples": n_all, "top": c.most_common(8)})
    return out


async def one(browser, base, slug, out: Path, secs, gap_ms):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
    await ctx.add_init_script(PROBE)
    page = await ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    cdp = await ctx.new_cdp_session(page)
    rec = {"slug": slug}
    try:
        await page.goto(f"{base}/arcade/custom/{slug}/", wait_until="load", timeout=45000)
        await page.wait_for_timeout(2000)
        await page.mouse.click(640, 360)
        await hold(page, "Enter", 120)
        await page.wait_for_timeout(300)
        await cdp.send("Profiler.enable")
        await cdp.send("Profiler.setSamplingInterval", {"interval": 1000})
        await cdp.send("Profiler.start")
        # map performance.now-based rAF times to the profiler clock via a marker
        await page.evaluate("() => { window.__stall.t = []; window.__stall.rec = true; }")
        i = 0
        loop_t = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - loop_t < secs:
            k, ms = KEYS[i % len(KEYS)]
            await hold(page, k, ms)
            i += 1
        frames = await page.evaluate("() => { window.__stall.rec = false; return window.__stall.t; }")
        prof = (await cdp.send("Profiler.stop"))["profile"]
        # The profiler's clock is the monotonic clock in microseconds; performance.timeOrigin + now is epoch ms.
        # Align by assuming the first rAF after rec=true is near the profile start: use relative offsets.
        rel = [(f - frames[0]) * 1000 for f in frames]  # microseconds from first frame
        base_us = prof["startTime"]
        gaps = []
        deltas = []
        for a, b in zip(rel, rel[1:]):
            deltas.append((b - a) / 1000)
            if (b - a) / 1000 >= gap_ms:
                gaps.append((base_us + a, base_us + b))
        rec["frames"] = len(frames)
        rec["longest_ms"] = round(max(deltas), 1) if deltas else None
        rec["gaps_over"] = len(gaps)
        rec["gaps"] = attribute(prof, base_us, gaps)
        total = Counter()
        nodes = {n["id"]: n for n in prof["nodes"]}
        for sid in prof["samples"]:
            total[nodes[sid]["callFrame"].get("functionName") or "(anonymous)"] += 1
        rec["whole_run_top"] = total.most_common(12)
        rec["page_errors"] = errs
    except Exception as e:  # noqa: BLE001
        rec["error"] = repr(e)[:300]
    finally:
        await ctx.close()
    (out / f"{slug}_stall.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    print(json.dumps({k: rec.get(k) for k in ("slug", "frames", "longest_ms", "gaps_over", "error")}), flush=True)
    for g in rec.get("gaps", [])[:6]:
        print("  gap", g["gap_ms"], "ms, samples", g["samples"], "top:", g["top"][:5], flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--slugs", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--secs", type=float, default=12)
    ap.add_argument("--gap", type=float, default=200)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        for s in a.slugs.split(","):
            await one(b, a.base, s, out, a.secs, a.gap)
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
