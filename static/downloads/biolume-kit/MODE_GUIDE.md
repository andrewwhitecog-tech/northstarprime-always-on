# MODE_GUIDE — 7 modes + controls

Firmware version: BIOLUME Festival Wearable v1.0  
Applies to both CircuitPython (`code.py`) and Classic Arduino (`helmet_light.ino`).

---

## Controls

| Control | Action |
|---|---|
| **Button A** (left button on Classic) | Advance to next mode; brief white flash confirms |
| **Shake** | Advance mode (accelerometer; ~0.8 s cooldown) |
| **Slide switch LEFT** | Quiet brightness (~15%) |
| **Slide switch RIGHT** | Bright (~70%) |

Modes wrap: after Festival Strobe → back to Vorathic Cascade.

Serial / REPL prints the mode name when you change modes (if connected).

---

## The 7 modes

### Mode 0 — Vorathic Rainbow Cascade *(default)*

Smooth HSV rainbow that treats onboard + external pixels as one continuous strand. Cascading wave — smoother than a basic single-hue rainbow cycle.

**Vibe:** signature look, walking art, default festival cruise.

### Mode 1 — BIOLUME Bioluminescence

Slow phosphorescent **green** pulse (aesthetic nod to *Mycena chlorophos* ~530 nm). Soft breathing glow.

**Vibe:** chill camp, meditation aesthetic, alien moss.

### Mode 2 — Aurora Drift

Cyan → magenta → violet flowing aurora; per-pixel phase drift.

**Vibe:** northern lights, night walks, stage wash.

### Mode 3 — Phi Spiral Chase

Five bright pixels chased with **golden-ratio** spacing so the pattern never quite repeats.

**Vibe:** sacred-geometry geek candy, hypnotic focus.

### Mode 4 — Sacred Geometry Pulse

Hexagonal rhythm pulse: quick–quick–quick, slow, repeat — hue drifts slowly.

**Vibe:** ritual drum energy without full strobe intensity.

### Mode 5 — Solfeggio Sync

Each pixel maps to a solfeggio-inspired hue ladder (174→963 Hz color mapping as art, not therapy). Soft global pulse.

**Vibe:** mystical palette, jewelry / pendant close-ups.

### Mode 6 — Festival Strobe

High-energy multi-color strobe / party flash. **Actually bright.**

**Vibe:** peak drop, parade, maximum presence.  
**Warning:** photosensitivity — see [SAFETY.md](SAFETY.md). Prefer quiet switch or skip this mode around sensitive people.

---

## Tuning

| Knob | Where |
|---|---|
| External pixel count | `EXTERNAL_NUM_PIXELS` in `code.py` / `EXT_NUM` in `.ino` (default 30) |
| Shake sensitivity | `SHAKE_THRESHOLD` / `SHAKE_THRESH` (default 12) |
| Frame pace | `time.sleep(0.02)` / `delay(20)` (~50 FPS cap) |

---

## Aesthetic note for listings

Describe modes as **light art / mood / festival expression**. Do not describe them as clinical states, medical alerts, or treatment protocols.
