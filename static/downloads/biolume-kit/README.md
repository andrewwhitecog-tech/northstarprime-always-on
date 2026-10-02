# NorthStarPrime BIOLUME — Festival Wearable Freemium Kit

**Version date:** 2026-10-02  
**Brand:** NorthStarPrime / VORATH (living-light art)  
**Status:** Creative QA CONDITIONAL PASS cleared — public zip ready (free firmware+guide)

> **This is art / festival / glow / light-art.**  
> It is **not** a medical device. It does **not** diagnose, treat, monitor, or warn about any health condition. See [SAFETY.md](SAFETY.md).

---

## What it is

A **festival / costume / helmet / body-glow wearable** driven by an Adafruit Circuit Playground board (Express, Bluefruit, or Classic) plus an optional external NeoPixel strip. Seven animation modes — from soft bioluminescence to full **Festival Strobe** — with button, shake, and slide-switch controls.

Think alien-artifact jewelry energy on a board you can flash tonight.

## Who it’s for

| Audience | Why |
|---|---|
| Festival / rave / flow-arts crowd | Bright modes, shake-to-cycle, helmet/costume strip |
| DIY maker / glow-jewelry builders | Drag-and-drop CircuitPython path |
| VORATH / NorthStarPrime fans | On-brand sacred-geometry + biolume aesthetic |
| Skill level | **Beginner–intermediate** (USB flash + simple wiring; no PCB fab required) |

## What’s included (this freemium pack)

| Path | Contents |
|---|---|
| [firmware/circuitpython/code.py](firmware/circuitpython/code.py) | **Primary** — CircuitPython 7-mode firmware |
| [firmware/circuitpython/DEPENDENCIES.md](firmware/circuitpython/DEPENDENCIES.md) | Library notes |
| [firmware/arduino/helmet_light.ino](firmware/arduino/helmet_light.ino) | **Alt** — Classic Arduino path |
| [BOM.md](BOM.md) | Parts + approx prices; DIY kit vs assembled SKU |
| [BUILD.md](BUILD.md) | Flash + wire + assemble steps |
| [MODE_GUIDE.md](MODE_GUIDE.md) | All 7 modes + controls |
| [SAFETY.md](SAFETY.md) | LiPo care + photosensitivity + **no medical claims** |
| [FREEMIUM.md](FREEMIUM.md) | Free taste → tip / paid upgrade path |
| [MANIFEST.json](MANIFEST.json) | File inventory + version date |
| [reference/](reference/) | Lineage notes only (no medical HTML in public pack) |
| [qc/](qc/) | Creative QA stamp |

## What’s real today vs planned

**Shipping as free taste (ready):**

- Working 7-mode firmware (CircuitPython + Classic Arduino)
- Flash / wire / wear instructions
- BOM with Adafruit part numbers and approx USD prices

**Paid / tip upgrades (when assets exist):**

- Printable enclosure STL (dodecahedron / medallion pendant shell)
- Assembled / limited numbered units
- Optional DIY kit SKU (board + printed shell + resin notes)

### GAP — enclosure STL

**No biolume / pendant / helmet enclosure STL was found** in `ADAFRUIT_BIOLUME` or related VORATH paths (search 2026-10-02). Unrelated Sigil `Vorath_Prism_Chassis` / `MountingGrid` STLs exist under `VORATH_HARDWARE/render_production/` — those are **not** this product and are not bundled here.

**Simplest printable mount (from pendant commercial notes) until CAD exists:**

1. Flat **medallion / disc** (or rough dodecahedron shell) sized to seat a Circuit Playground (~50–55 mm board diameter, leave USB / battery access).
2. Materials: black PLA or TPU body; optional clear / iridescent resin pour over the LED face as a diffuser.
3. Lanyard / clip holes; protected LiPo pocket with puncture barrier (no bare cell against skin).
4. Do **not** invent or ship fake CAD — treat enclosure as a tip-gated or paid deliverable once modeled and print-validated.

## Product SKUs (from commercial checklist)

| SKU | Approx materials | Suggested list | Notes |
|---|---|---|---|
| Free firmware + guide | $0 | Free / tip jar | This pack |
| DIY kit (board + shell + resin + instructions) | ~$70 | $70–90 | Lower labor; ships flatter |
| Assembled pendant / wearable | ~$70 | $120–180 | Artisan; numbered/limited framing |
| Helmet-light loaded board + strip kit | board + strip | Festival accessory kit | Working code today |

Mesh swarm / BLE phone-app / Spore Gate installation ideas exist in the source report as **architecture only** — do not advertise them until firmware ships. This freemium kit sells the **standalone 7-mode light** that already runs.

## Source lineage (read-only)

- `ADAFRUIT_BIOLUME/circuit_playground/code.py`
- `ADAFRUIT_BIOLUME/circuit_playground_CLASSIC/helmet_light/helmet_light.ino`
- `ADAFRUIT_BIOLUME/bluefruit_top3_report.html` — **internal only** (`_internal/`; excluded from public zip)
- `VORATH_HARDWARE/05_existing_ideas/vorath-biolume-pendant.md`
- `VORATH_HARDWARE/05_existing_ideas/INVENTORY.md`

## Creative QA gate

Do **not** publish listings, emails, or store pages until Creative QA reviews this pack. Rewrite any leftover medical / dialysis / BP language if found in future source merges — stripped from this pack.

## Quick start

1. Read [SAFETY.md](SAFETY.md).
2. Follow [BUILD.md](BUILD.md) CircuitPython path.
3. Play modes with [MODE_GUIDE.md](MODE_GUIDE.md).
4. Tip / upgrade options: [FREEMIUM.md](FREEMIUM.md).
