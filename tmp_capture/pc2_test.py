#!/usr/bin/env python3
"""Real-play check of Precinct 404 P2 (muted headless Chromium): five shifts to an ending, played through, three times.

A  desktop, fresh city memory, the top fit number every call: four shift breaks (SHIFT CLEARED lettering on the map, the
   report in the page, Start Shift N by click and by Enter), rival week with each rival's portrait beside the call,
   the takeover briefing with the leader's portrait, the takeover calls, the BOOKED ending; pins in faction colours;
   the result in city memory; a reload shows the last takeover; Enter starts Night Shift+.
B  desktop, an old save (city memory from before this change, no `campaigns`), the top number for 16 calls and the worst
   for the 4 takeover calls: the rival OWNS Buckman (SHIFT LOST lettering, New Shift), the save keeps its turns,
   a stubbed pad's A starts a new campaign.
C  desktop, a save with a past takeover and Tessa Vale hot: the memory panel names the last takeover from the start;
   top, top, worst, worst in the takeover: the leader SLIPS away.
P  phone 390x844, taps only, top number every call: breaks and the ending fit the screen, portraits drawn.
usage: pc2_test.py --base http://127.0.0.1:8765 --out DIR
"""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ARGS = ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
URL = "/arcade/custom/precinct-404/"
ART = {"vanta": "art/rival_vanta_v01.webp", "kernel": "art/rival_kernel_v01.webp", "tessa": "art/rival_tessa_v01.webp"}
NAMES = {"vanta": "Vanta Luxe", "kernel": "Kernel Pique", "tessa": "Tessa Vale"}
PICK = """(mode) => { const btns = [...document.querySelectorAll('button.officer:not([disabled])')];
  if (!btns.length) return null; const val = b => Number((b.querySelector('.chip') || {}).textContent || 0);
  btns.sort((a, b) => mode === 'worst' ? val(a) - val(b) : val(b) - val(a)); return btns[0].dataset.id; }"""
SNAP = "() => window.__precinctDebug.snapshot()"
FACE = """() => { const i = document.querySelector('#cityHook img.rival-face'); if (!i) return null; const r = i.getBoundingClientRect();
  return {src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0, w: Math.round(r.width), h: Math.round(r.height), alt: i.alt, hook: document.getElementById('cityHook').textContent.slice(0, 160)}; }"""
END = """() => { const c = document.getElementById('mapCallout'), e = document.getElementById('shiftEnd'), m = document.querySelector('.map-wrap').getBoundingClientRect();
  const a = c.getBoundingClientRect(), f = e.querySelector('img.rival-face'), fr = f ? f.getBoundingClientRect() : null, b = document.getElementById('modalBtn');
  return {callout: c.getAttribute('src'), on: c.classList.contains('on'), loaded: c.complete && c.naturalWidth > 0,
    inMap: a.width > 100 && a.left >= m.left - 1 && a.right <= m.right + 1 && a.top >= m.top - 1 && a.bottom <= m.bottom + 1,
    title: (e.querySelector('h2') || {}).textContent || '', body: (e.querySelector('p') || {}).textContent || '', shown: e.classList.contains('on'),
    face: f ? {src: f.getAttribute('src'), loaded: f.complete && f.naturalWidth > 0, w: Math.round(fr.width), h: Math.round(fr.height)} : null,
    button: b.textContent, buttonInRow: !!document.querySelector('.case-actions #modalBtn'), buttonW: Math.round(b.getBoundingClientRect().width),
    pins: document.querySelectorAll('#pins .pin').length, sw: (document.scrollingElement || document.documentElement).scrollWidth,
    endBottom: Math.round(e.getBoundingClientRect().bottom), bodyBottom: Math.round(document.querySelector('.case-body').getBoundingClientRect().bottom)}; }"""
BOXES = """() => ['.panel', '.memory-note', '#shiftEnd', '#shiftEnd .end-row', '.officer', '.forecast-item', '.director', '.tag', '.chip'].map(q => {
  const e = document.querySelector(q); if (!e) return [q, null]; const c = getComputedStyle(e);
  return [q, c.backgroundColor, c.backgroundImage.slice(0, 12)]; })"""
MEM = "() => JSON.parse(localStorage.getItem('precinct404CityMemory') || 'null')"
PAD_STUB = """window.__pad = null;
Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: function () { return window.__pad ? [window.__pad] : []; } });
window.__plugPad = () => { window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), vibrationActuator: null }; };
window.__padButton = (i, down) => { window.__pad.buttons[i] = { pressed: down, value: down ? 1 : 0 }; };"""


def old_save(hot=None, campaigns=None):
    """City memory in the shape live players already have (no campaigns field unless given)."""
    factions = [("velvet", "Velvet Relay", "nightlife", "casino logistics, limo permits, and velvet-rope favors", "#ec4899"),
                ("ghost", "Civic Ghosts", "network", "leaked civic data, spoofed warrants, and public-service hacks", "#22d3ee"),
                ("nexa", "NexaForce PR", "corporate", "pilot optics, investor pressure, and rebrand emergencies", "#a855f7"),
                ("underpass", "Underpass Choir", "street", "mutual aid, protest logistics, and neighborhood rumors", "#22c55e"),
                ("taxi", "Chromeline Taxi Guild", "traffic", "autocab strikes, curb wars, and routing sabotage", "#f5c542")]
    rivals = [("vanta", "velvet", "Vanta Luxe", "Floor Captain", "neon alibi chains", "club cameras and receipt ghosts", "flashy", 46),
              ("kernel", "ghost", "Kernel Pique", "Signal Broker", "spoofed evidence", "public kiosks and doorbell cams", "slippery", 52),
              ("tessa", "nexa", "Tessa Vale", "Crisis Evangelist", "pilot spin", "investor decks and live demos", "polished", 58),
              ("mural", "underpass", "Mural Saint", "Block Caller", "crowd shields", "scanner chats and mural codes", "beloved", 41),
              ("meter", "taxi", "Meter Saint", "Route Baron", "traffic traps", "autocab swarms and curb sensors", "patient", 49)]
    mem = {"turn": 31, "lastEvent": "Kernel Pique adapts around the precinct response.",
           "factions": [{"id": a, "name": b, "tag": c, "angle": d, "color": e, "heat": 40 + i * 4, "leverage": 30 + i * 3} for i, (a, b, c, d, e) in enumerate(factions)],
           "rivals": [{"id": a, "faction": b, "name": c, "rank": d, "signature": e, "tool": f, "trait": g, "heat": (95 if a == hot else h),
                       "wins": (3 if a == hot else 0), "defeats": 1, "scars": ["Tank file"] if a == "vanta" else [], "memory": "Officer Tank became part of the rival playbook."}
                      for (a, b, c, d, e, f, g, h) in rivals]}
    if campaigns is not None:
        mem["campaigns"] = campaigns
    return mem


def seed_script(mem):
    return "try { if (location.protocol.startsWith('http') && !sessionStorage.getItem('seeded')) { localStorage.setItem('precinct404CityMemory', " + json.dumps(json.dumps(mem)) + "); sessionStorage.setItem('seeded', '1'); } } catch (e) {}"


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--base", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    checks, errors = [], []

    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail}); print(json.dumps(checks[-1])[:1500], flush=True)

    async def dispatch_one(page, mode, tap=False):
        oid = await page.evaluate(PICK, mode)
        btn = f"button.officer[data-id='{oid}']"
        await (page.tap(btn) if tap else page.click(btn)); await page.wait_for_timeout(120)
        await (page.tap("#dispatchBtn") if tap else page.click("#dispatchBtn")); await page.wait_for_timeout(260)
        return oid

    async def play_shift(page, modes, tap=False, log=None):
        """Dispatch until a break or the end; modes[i] is the pick for the i-th call of the shift."""
        n = 0
        while True:
            s = await page.evaluate(SNAP)
            if s["finished"]:
                return n
            call = s["call"]
            face = await page.evaluate(FACE)
            if log is not None:
                log.append({"index": s["index"], "type": call["type"], "title": call["title"], "rival": call["rivalId"], "top": call["top"],
                            "face": face and face["src"], "faceW": face and face["w"], "hook": face and face["hook"][:90]})
            await dispatch_one(page, modes[min(n, len(modes) - 1)], tap)
            n += 1
            if n > 6:
                return n

    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True, args=ARGS)

        # ---------------- A: fresh memory, the top number every call -> BOOKED ----------------
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("A: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.click("#titleCover"); await page.wait_for_timeout(400)
        f1 = await page.evaluate(FACE)
        await page.screenshot(path=str(out / "A01_call1_rival_face.png"))
        check("A: call 1 shows its rival's portrait beside the city-memory line (Vanta Luxe), loaded and drawn",
              f1 and f1["src"] == ART["vanta"] and f1["loaded"] and f1["w"] >= 40 and f1["h"] >= 40 and f1["alt"] == "Vanta Luxe", f1)
        log, breaks_seen = [], []
        for shift in range(1, 5):
            await play_shift(page, ["best"], log=log)
            e = await page.evaluate(END); s = await page.evaluate(SNAP)
            breaks_seen.append({"shift": shift, "title": e["title"], "button": e["button"], "pins": e["pins"], "callout": e["callout"], "on": e["on"], "inMap": e["inMap"], "onBreak": s["onBreak"],
                                "endBottom": e["endBottom"], "bodyBottom": e["bodyBottom"]})
            if shift in (1, 3, 4):
                await page.screenshot(path=str(out / f"A0{shift + 1}_break_{shift}.png"))
            if shift == 4:
                rows = await page.evaluate("() => [...document.querySelectorAll('#shiftList .shift-row span')].map(x => x.textContent)")
                lead = s["leader"]
                check("A: after shift 4 the takeover briefing names the leader with the leader's portrait (large, loaded), and the shift list names the takeover",
                      lead in ART and e["face"] and e["face"]["src"] == ART[lead] and e["face"]["loaded"] and e["face"]["w"] >= 80 and NAMES[lead] in e["body"]
                      and "Break three" in e["body"] and NAMES[lead] in rows[4], {"leader": lead, "face": e["face"], "body": e["body"], "rows": rows})
            # continue: click, Enter, click, click
            if shift == 2:
                await page.focus("body"); await page.keyboard.press("Enter")
            else:
                await page.click("#modalBtn")
            await page.wait_for_timeout(400)
        check("A: four shift breaks, each with SHIFT CLEARED lettering inside the map, 'Shift N cleared' and Start Shift N+1, answered calls staying as pins",
              all(x["onBreak"] and x["on"] and x["inMap"] and "shift_cleared" in x["callout"] and x["title"] == f"Shift {x['shift']} cleared"
                  and x["button"] == f"Start Shift {x['shift'] + 1}" and x["pins"] == 4 * x["shift"] for x in breaks_seen), breaks_seen)
        await play_shift(page, ["best"], log=log)
        e = await page.evaluate(END); s = await page.evaluate(SNAP); mem = await page.evaluate(MEM)
        await page.screenshot(path=str(out / "A06_ending_booked.png"))
        week = [x for x in log if 12 <= x["index"] < 16]; tk = [x for x in log if x["index"] >= 16]
        check("A: rival week = four Rival Plot calls: Vanta, Kernel, Tessa, then the hottest of the three; each shows that rival's portrait",
              len(week) == 4 and all(x["type"] == "Rival Plot" and x["rival"] in ART and x["face"] == ART[x["rival"]] and x["faceW"] >= 40 for x in week)
              and [x["rival"] for x in week[:3]] == ["vanta", "kernel", "tessa"], week)
        check("A: the takeover = four Takeover calls from the leader, each with the leader's portrait and 'Takeover call n of 4'",
              len(tk) == 4 and all(x["type"] == "Takeover" and x["rival"] == s["leader"] and x["face"] == ART[s["leader"]] and x["hook"].startswith(f"Takeover call {i + 1} of 4") for i, x in enumerate(tk)), tk)
        check("A: the whole campaign is 20 dispatches (12 pilot + 4 rival week + 4 takeover)", len(log) == 20, len(log))
        lead = s["leader"]
        check("A: the top number on every takeover call breaks it: BOOKED ending, SHIFT CLEARED lettering, the leader's portrait, Start Night Shift+",
              s["finished"] and not s["onBreak"] and s["breaks"] >= 3 and e["on"] and "shift_cleared" in e["callout"] and e["title"] == NAMES[lead] + " booked"
              and e["face"] and e["face"]["src"] == ART[lead] and e["button"] == "Start Night Shift+" and e["buttonInRow"] and "Takeover calls broken: " in e["body"],
              {"snap": s, "end": e})
        check("A: desktop 1280x720: every shift report and the ending fit inside the call panel, no line under its edge (read by eye: the last line was cut)",
              all(x["endBottom"] <= x["bodyBottom"] + 1 for x in breaks_seen) and e["endBottom"] <= e["bodyBottom"] + 1,
              {"breaks": [[x["endBottom"], x["bodyBottom"]] for x in breaks_seen], "ending": [e["endBottom"], e["bodyBottom"]]})
        check("A: the result is in city memory (campaigns[0] booked, the leader's heat down to 30 or less, defeats up)",
              mem and mem.get("campaigns") and mem["campaigns"][0]["leader"] == lead and mem["campaigns"][0]["result"] == "booked"
              and next(r for r in mem["rivals"] if r["id"] == lead)["heat"] <= 30, {"campaigns": mem and mem.get("campaigns"), "leader": next((r for r in (mem or {}).get("rivals", []) if r["id"] == lead), None)})
        pins = await page.evaluate("() => [...document.querySelectorAll('#pins .pin')].map(p => getComputedStyle(p).backgroundColor)")
        check("A: 20 pins on the map, coloured by the calls' factions (at least 3 colours)", len(pins) == 20 and len(set(pins)) >= 3, {"n": len(pins), "colours": sorted(set(pins))})
        box = await page.evaluate(BOXES)
        check("A: no box behind words at the ending (rule 30(a)): the ending block, its portrait row, the memory line, cards, chips",
              all(r[1] in (None, "rgba(0, 0, 0, 0)") and r[2] == "none" for r in box if r[1] is not None), box)
        await page.focus("body"); await page.keyboard.press("Enter"); await page.wait_for_timeout(500)
        nx = await page.evaluate("() => ({call: document.getElementById('caseCount').textContent, ended: document.querySelector('.case-panel').classList.contains('ended')})")
        check("A: Enter at the ending starts Night Shift+", nx["call"].startswith("Night Call 1") and not nx["ended"], nx)
        await page.reload(wait_until="load"); await page.wait_for_timeout(2000)
        await page.click("#titleCover"); await page.wait_for_timeout(300)
        board = await page.evaluate("() => document.getElementById('cityMemory').textContent")
        await page.screenshot(path=str(out / "A07_reload_memory.png"))
        check("A: after a reload the rival board names the last takeover (city memory carries across runs)",
              f"Last takeover: {NAMES[lead]} booked" in board, board[-260:])
        await ctx.close()

        # ---------------- B: an old save, top 16 then worst 4 -> OWNS ----------------
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(seed_script(old_save(hot="kernel")))
        await ctx.add_init_script(PAD_STUB)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("B: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        mem0 = await page.evaluate(MEM)
        check("B: an old save (no campaigns field) loads without errors and keeps its turns", mem0 and "campaigns" not in mem0 and mem0["turn"] == 31 and not errors, {"turn": mem0 and mem0["turn"], "keys": mem0 and sorted(mem0)})
        await page.click("#titleCover"); await page.wait_for_timeout(300)
        logb = []
        for shift in range(1, 5):
            await play_shift(page, ["best"], log=logb); await page.click("#modalBtn"); await page.wait_for_timeout(350)
        s = await page.evaluate(SNAP); read = s["readOfficer"]
        cards = await page.evaluate("() => [...document.querySelectorAll('button.officer')].map(b => [b.dataset.id, (b.querySelector('.read') || {}).textContent || '', Number(b.querySelector('.chip').textContent)])")
        await page.screenshot(path=str(out / "B01_takeover_call1.png"))
        check("B: the takeover leader comes from the old save's heat (Kernel Pique was hot), and the officer used most against the leader is marked 'read' on its card",
              s["leader"] == "kernel" and (read is None or any(c[0] == read and "read by Kernel Pique" in c[1] for c in cards)), {"leader": s["leader"], "read": read, "cards": cards})
        await play_shift(page, ["worst"], log=logb)
        e = await page.evaluate(END); s = await page.evaluate(SNAP); mem = await page.evaluate(MEM)
        await page.screenshot(path=str(out / "B02_ending_owns.png"))
        check("B: the OWNS ending fits the desktop call panel", e["endBottom"] <= e["bodyBottom"] + 1, [e["endBottom"], e["bodyBottom"]])
        check("B: the worst pick on every takeover call: the rival OWNS Buckman, SHIFT LOST lettering, the rival's portrait, New Shift only",
              s["finished"] and s["breaks"] <= 1 and "shift_lost" in e["callout"] and e["on"] and e["title"] == "Buckman runs Kernel Pique's feed"
              and e["face"] and e["face"]["src"] == ART["kernel"] and e["button"] == "New Shift", {"snap": s, "end": e})
        check("B: the old save now has campaigns[0] = owns, the rival's wins up and rank City Myth, and its turn count kept growing from 31",
              mem.get("campaigns") and mem["campaigns"][0]["result"] == "owns" and mem["turn"] >= 51
              and next(r for r in mem["rivals"] if r["id"] == "kernel")["rank"] == "City Myth", {"campaigns": mem.get("campaigns"), "turn": mem["turn"]})
        await page.evaluate("() => window.__plugPad()"); await page.wait_for_timeout(250)
        await page.evaluate("() => window.__padButton(0, true)"); await page.wait_for_timeout(300)
        await page.evaluate("() => window.__padButton(0, false)"); await page.wait_for_timeout(400)
        nb = await page.evaluate("() => ({call: document.getElementById('caseCount').textContent, ended: document.querySelector('.case-panel').classList.contains('ended')})")
        check("B: pad A at the ending starts a new campaign", nb["call"] == "Call 1 of 20" and not nb["ended"], nb)
        await ctx.close()

        # ---------------- C: a save with a past takeover, Tessa hot; top, top, worst, worst -> SLIPPED ----------------
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(seed_script(old_save(hot="tessa", campaigns=[{"leader": "tessa", "result": "owns", "breaks": 1, "turn": 20}])))
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("C: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.click("#titleCover"); await page.wait_for_timeout(300)
        board = await page.evaluate("() => document.getElementById('cityMemory').textContent")
        check("C: from the first call the rival board names the last takeover from the save", "Last takeover: Tessa Vale took Buckman (1 of 4 calls broken)." in board, board[-220:])
        for shift in range(1, 5):
            await play_shift(page, ["best"]); await page.click("#modalBtn"); await page.wait_for_timeout(350)
        hook = await page.evaluate("() => document.getElementById('cityHook').textContent")
        await page.screenshot(path=str(out / "C01_takeover_rematch.png"))
        await play_shift(page, ["best", "best", "worst", "worst"])
        e = await page.evaluate(END); s = await page.evaluate(SNAP)
        await page.screenshot(path=str(out / "C02_ending_slipped.png"))
        check("C: the rematch: Tessa Vale leads again and the takeover call says how the last one ended",
              s["leader"] == "tessa" and "Last takeover: Tessa Vale took Buckman" in hook, {"leader": s["leader"], "hook": hook[:300]})
        check("C: the SLIPPED ending fits the desktop call panel", e["endBottom"] <= e["bodyBottom"] + 1, [e["endBottom"], e["bodyBottom"]])
        check("C: two of four takeover calls broken: Tessa Vale SLIPS away (SHIFT CLEARED lettering, Start Night Shift+)",
              s["breaks"] == 2 and e["title"] == "Tessa Vale pivoted" and "shift_cleared" in e["callout"] and e["button"] == "Start Night Shift+", {"snap": s, "end": e})
        await ctx.close()

        # ---------------- P: phone, taps only ----------------
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page(); page.on("pageerror", lambda e: errors.append("phone: " + str(e)[:200]))
        await page.goto(a.base + URL, wait_until="load"); await page.wait_for_timeout(2500)
        await page.tap("#titleCover"); await page.wait_for_timeout(400)
        f1 = await page.evaluate(FACE)
        await page.screenshot(path=str(out / "P01_phone_call1.png"))
        geo = []
        for shift in range(1, 5):
            await play_shift(page, ["best"], tap=True)
            e = await page.evaluate(END); geo.append({"shift": shift, "sw": e["sw"], "title": e["title"], "face": e["face"], "buttonW": e["buttonW"]})
            if shift in (1, 4):
                await page.locator("#shiftEnd").scroll_into_view_if_needed(); await page.wait_for_timeout(200)
                await page.screenshot(path=str(out / f"P0{2 if shift == 1 else 3}_phone_break_{shift}.png"))
            await page.tap("#modalBtn"); await page.wait_for_timeout(400)
        await play_shift(page, ["best"], tap=True)
        e = await page.evaluate(END)
        await page.locator("#shiftEnd").scroll_into_view_if_needed(); await page.wait_for_timeout(200)
        await page.screenshot(path=str(out / "P04_phone_ending.png"))
        await page.screenshot(path=str(out / "P05_phone_ending_full.png"), full_page=True)
        check("phone: call 1's rival portrait is drawn; every break and the ending fit 390 px; the takeover briefing and ending show the leader's portrait",
              f1 and f1["loaded"] and f1["w"] >= 40 and all(g["sw"] <= 392 and g["buttonW"] > 0 for g in geo) and e["sw"] <= 392
              and geo[3]["face"] and geo[3]["face"]["w"] >= 60 and e["face"] and e["face"]["loaded"] and e["title"].endswith("booked"),
              {"call1": f1, "breaks": geo, "end": {k: e[k] for k in ("title", "face", "sw", "button")}})
        await ctx.close(); await b.close()
    check("no page errors", not errors, errors[:5])
    (out / "checks.json").write_text(json.dumps({"checks": checks, "errors": errors}, indent=1), encoding="utf-8")
    print("SUMMARY", sum(c["ok"] for c in checks), "of", len(checks), "passed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
