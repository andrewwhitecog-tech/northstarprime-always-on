#!/usr/bin/env python3
"""Real-play check of Precinct 404 P3 sound (muted headless Chromium: the audio graph runs, nothing reaches a speaker).

Claude cannot hear: this checks that sound is FILES through the shared HQ player and that each cue fires where it should.
A  desktop: no oscillator is ever created (createOscillator wrapped for the whole run); before the cover nothing plays;
   after the cover the context runs, the rain-and-scanner bed loops and the noir music plays; every effect decodes, no
   file fails; a whole campaign with the top fit number: clean results, a dispatch alert per new call, a teletype per
   shift break, handcuffs and a cell door at BOOKED; the music is still playing at the end; M and the Sound button mute
   and unmute and the choice is remembered; every audio request is answered 200/206.
B  desktop: top for 16 calls, worst for the takeover: workable/messy/escalation results and sirens fading at OWNS.
usage: pc3_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/precinct-404/"
OSC = """window.__osc = 0; window.__acNew = 0;
for (const C of [window.BaseAudioContext, window.AudioContext, window.OfflineAudioContext]) { if (C && C.prototype && C.prototype.createOscillator) {
  const o = C.prototype.createOscillator; C.prototype.createOscillator = function () { window.__osc++; return o.apply(this, arguments); }; } }
if (window.OscillatorNode) { const N = window.OscillatorNode; window.OscillatorNode = function () { window.__osc++; return new N(...arguments); }; }
if (window.AudioContext) { const A = window.AudioContext; window.AudioContext = function () { window.__acNew++; return new A(...arguments); }; window.AudioContext.prototype = A.prototype; }"""
PICK = """(mode) => { const btns = [...document.querySelectorAll('button.officer:not([disabled])')];
  if (!btns.length) return null; const val = b => Number((b.querySelector('.chip') || {}).textContent || 0);
  btns.sort((a, b) => mode === 'worst' ? val(a) - val(b) : val(b) - val(a)); return btns[0].dataset.id; }"""
SNAP = "() => window.__precinctDebug.snapshot()"
SOUND = "() => window.__precinctDebug.sound()"
FILES = ["nav", "newcall", "clean", "workable", "messy", "escalate", "hold", "mags", "override", "shiftend", "booked", "owns", "ambience", "music"]


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--base", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    checks, errors, audio = [], [], {}

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail}); print(json.dumps(checks[-1])[:1500], flush=True)

    def on_response(r):
        u = r.url.split("?")[0]
        if "/precinct-404/audio/" in u:
            audio.setdefault(u.rsplit("/", 1)[-1], set()).add(r.status)

    async def play_campaign(page, modes_by_shift):
        for shift in range(1, 6):
            modes = modes_by_shift.get(shift, ["best"])
            n = 0
            while True:
                s = await page.evaluate(SNAP)
                if s["finished"]:
                    break
                oid = await page.evaluate(PICK, modes[min(n, len(modes) - 1)])
                await page.click(f"button.officer[data-id='{oid}']"); await page.wait_for_timeout(110)
                await page.click("#dispatchBtn"); await page.wait_for_timeout(900)   # long enough for the delayed dispatch alert
                n += 1
            if shift < 5:
                await page.wait_for_timeout(500)
                await page.click("#modalBtn"); await page.wait_for_timeout(900)

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)
        # ---------------- A ----------------
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(OSC)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("A: " + str(e)[:200])); page.on("response", on_response)
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        pre = await page.evaluate(SOUND)
        btn0 = await page.evaluate("() => document.getElementById('soundBtn').textContent")
        check("A: before the cover is dismissed nothing plays (no audio context yet, music not started); the Sound button reads ON",
              pre is not None and pre["context"] == "none" and pre["music"] in ("none", "paused") and btn0 == "Sound: ON", {"status": pre, "button": btn0})
        await page.click("#titleCover"); await page.wait_for_timeout(4000)
        st = await page.evaluate(SOUND)
        check("A: after the cover: the audio context runs, the rain-and-scanner bed loops, the noir music plays, and all 13 effect files decode (none failed)",
              st["context"] == "running" and "ambience" in st["loopsPlaying"] and st["music"] == "playing" and not st["failed"] and len(st["decoded"]) == 13,
              {k: st[k] for k in ("context", "loopsPlaying", "music", "musicTime", "decoded", "failed", "loading")})
        await page.screenshot(path=str(out / "A01_after_cover.png"))
        await play_campaign(page, {})
        st = await page.evaluate(SOUND); snap = await page.evaluate(SNAP)
        played = st["played"]
        await page.screenshot(path=str(out / "A02_booked.png"))
        check("A: a whole campaign with the top fit number: a clean-result sound per call, a dispatch alert per new call, a teletype at each of the 4 shift breaks, handcuffs and cell door at BOOKED",
              snap["finished"] and snap["breaks"] >= 3 and played.get("clean", 0) >= 16 and played.get("newcall", 0) >= 15 and played.get("shiftend", 0) == 4 and played.get("booked", 0) == 1,
              {"played": played, "breaks": snap["breaks"]})
        check("A: the music is still playing at the campaign's end and has looped past its start (the 110.6 s loop)",
              st["music"] == "playing" and st["musicTime"] is not None, {"music": st["music"], "musicTime": st["musicTime"], "loops": st["loopsPlaying"]})
        await page.focus("body"); await page.keyboard.press("m"); await page.wait_for_timeout(300)
        m1 = await page.evaluate("() => ({muted: window.__precinctDebug.sound().muted, button: document.getElementById('soundBtn').textContent, saved: localStorage.getItem('precinct404Muted')})")
        await page.click("#soundBtn"); await page.wait_for_timeout(300)
        m2 = await page.evaluate("() => ({muted: window.__precinctDebug.sound().muted, button: document.getElementById('soundBtn').textContent, saved: localStorage.getItem('precinct404Muted')})")
        check("A: M mutes (Sound: OFF, remembered) and the Sound button unmutes (Sound: ON)",
              m1["muted"] and m1["button"] == "Sound: OFF" and m1["saved"] == "1" and not m2["muted"] and m2["button"] == "Sound: ON" and m2["saved"] == "0", [m1, m2])
        osc = await page.evaluate("() => ({osc: window.__osc, contexts: window.__acNew})")
        check("A: no oscillator was created during the whole campaign (nothing synthesized); one audio context (the HQ player's)", osc["osc"] == 0 and osc["contexts"] <= 1, osc)
        await ctx.close()

        # ---------------- B ----------------
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(OSC)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("B: " + str(e)[:200])); page.on("response", on_response)
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.click("#titleCover"); await page.wait_for_timeout(2500)
        await play_campaign(page, {5: ["worst"]})
        st = await page.evaluate(SOUND); snap = await page.evaluate(SNAP); played = st["played"]
        await page.screenshot(path=str(out / "B01_owns.png"))
        bad = played.get("workable", 0) + played.get("messy", 0) + played.get("escalate", 0)
        check("B: worst picks in the takeover sound as worse results (workable, messy or escalation), and the OWNS ending plays the sirens fading",
              snap["finished"] and snap["breaks"] <= 1 and bad >= 3 and played.get("owns", 0) == 1 and played.get("booked", 0) == 0, {"played": played, "breaks": snap["breaks"]})
        osc = await page.evaluate("() => window.__osc")
        check("B: still no oscillator", osc == 0, osc)
        await ctx.close(); await b.close()
    statuses = {k: sorted(v) for k, v in audio.items()}
    check("every audio file the page asked for was answered 200 (or 206 for the streamed music), and all 14 were asked for",
          all(set(v) <= {200, 206, 304} for v in statuses.values()) and all(f + ".mp3" in statuses for f in FILES), statuses)
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
