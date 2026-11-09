#!/usr/bin/env python3
"""Rule 30 self-check: what words a game puts on its picture (muted headless Chromium).

For each slug, at desktop 1280x720 and phone 390x844: load, start (canvas click,
Enter, Space, a start button), play ~10 s with held keys, and record
- every distinct string drawn with fillText/strokeText on any canvas (with font),
- every visible page element with its own text whose box overlaps the largest
  canvas by more than 30% of the element's area (DOM words over the picture).

usage: text_probe.py --base http://127.0.0.1:8765 --slugs a,b --out DIR
"""
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
INIT = """(() => {
  const seen = window.__nspText = {};
  for (const name of ['fillText', 'strokeText']) {
    const orig = CanvasRenderingContext2D.prototype[name];
    CanvasRenderingContext2D.prototype[name] = function (t, ...rest) {
      const k = String(t).slice(0, 80);
      if (k.trim() && Object.keys(seen).length < 400) { if (!seen[k]) seen[k] = {n: 0, font: this.font}; seen[k].n++; }
      return orig.call(this, t, ...rest);
    };
  }
})();"""
OVERLAP = """() => {
  const cs = [...document.querySelectorAll('canvas')].map(c => c.getBoundingClientRect()).filter(r => r.width > 80 && r.height > 80)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  const C = cs[0]; if (!C) return [];
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'CANVAS', 'NOSCRIPT'].includes(el.tagName)) continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!own) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const ix = Math.max(0, Math.min(r.right, C.right) - Math.max(r.left, C.left));
    const iy = Math.max(0, Math.min(r.bottom, C.bottom) - Math.max(r.top, C.top));
    if (ix * iy > 0.3 * r.width * r.height) out.push({tag: el.tagName, id: el.id, cls: String(el.className).slice(0, 40), text: own.slice(0, 70)});
    if (out.length >= 40) break;
  }
  return out;
}"""
KEYS = [("ArrowRight", 400), ("Space", 120), ("KeyJ", 120), ("ArrowLeft", 400), ("KeyK", 120), ("ArrowUp", 250), ("KeyF", 120), ("Enter", 100)]


async def probe(browser, base, slug, phone):
    ctx = await browser.new_context(**({"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}
                                       if phone else {"viewport": {"width": 1280, "height": 720}}))
    await ctx.add_init_script(INIT)
    page = await ctx.new_page()
    route = "/arcade/custom/cascade-salmon-run.html" if slug == "cascade-salmon-run" else f"/arcade/custom/{slug}/"
    res = {"slug": slug, "view": "phone" if phone else "desktop"}
    try:
        await page.goto(base + route, wait_until="load", timeout=45000)
        await page.wait_for_timeout(2500)
        res["dom_over_canvas_title"] = await page.evaluate(OVERLAP)
        box = await page.evaluate("() => { const c=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0]; if(!c) return null; const r=c.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; }")
        if box:
            if phone:
                await page.touchscreen.tap(box[0], box[1])
            else:
                await page.mouse.click(box[0], box[1])
        for k in ("Enter", "Space"):
            await page.keyboard.press(k)
            await page.wait_for_timeout(300)
        t0 = asyncio.get_event_loop().time()
        i = 0
        while asyncio.get_event_loop().time() - t0 < 10:
            k, ms = KEYS[i % len(KEYS)]
            await page.keyboard.down(k)
            await page.wait_for_timeout(ms)
            await page.keyboard.up(k)
            i += 1
        res["canvas_text"] = await page.evaluate("() => window.__nspText")
        res["dom_over_canvas_play"] = await page.evaluate(OVERLAP)
    except Exception as e:  # noqa: BLE001
        res["error"] = repr(e)[:200]
    finally:
        await ctx.close()
    return res


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--slugs", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        for s in a.slugs.split(","):
            for phone in (False, True):
                r = await probe(b, a.base, s, phone)
                results.append(r)
                ct = r.get("canvas_text") or {}
                print(json.dumps({"slug": s, "view": r["view"], "canvas_strings": len(ct),
                                  "sample": list(ct)[:12],
                                  "dom_over_canvas": [d["text"] for d in (r.get("dom_over_canvas_play") or [])][:10],
                                  "error": r.get("error")}), flush=True)
        await b.close()
    (out / "text_probe.json").write_text(json.dumps(results, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
