# BOM — BIOLUME Festival Wearable

Prices are approximate USD retail (Adafruit / common suppliers, as of source report ~2026). Verify current pricing before buying. This kit does **not** purchase parts for you.

---

## Core build (helmet light / board + strip) — what’s real today

| Qty | Part | Source | Approx |
|---|---|---|---|
| 1 | Circuit Playground **Bluefruit** (preferred) *or* Express *or* Classic | [Adafruit #4333](https://www.adafruit.com/product/4333) Bluefruit ~$25; Express / Classic alternatives | $25 |
| 1 | NeoPixel strip (default firmware = **30** pixels; adjust in code) | Adafruit NeoPixel strips (e.g. 60 LED/m or 144 LED/m segments) | $10–60 |
| 1 | LiPo battery 350–500 mAh **protected** cell | [Adafruit #2750](https://www.adafruit.com/product/2750) 350 mAh ~$7; [#1578](https://www.adafruit.com/product/1578) 500 mAh | $7–12 |
| 1 | LiPo charger | [Adafruit #1304](https://www.adafruit.com/product/1304) Basic ~$7 | $7 |
| — | Hookup wire / solder / JST as needed | Bench supply | $2–5 |

**Materials ballpark (board + strip + LiPo + charger):** ~$50–90 depending on strip density.

**Power note:** for >8 external pixels, power the strip from **battery / VOUT**, not USB alone.

---

## Pendant / art-jewelry BOM (from commercial checklist — when enclosure exists)

| Part | Source | Approx |
|---|---|---|
| Circuit Playground Bluefruit #4333 | Adafruit | $25 |
| 3D-printed dodecahedron / medallion housing (PLA/TPU) | Bambu P1S filament | ~$8 |
| Iridescent / clear casting resin (diffuser face) | Bench / Amazon | ~$15 |
| LiPo 350–500 mAh + charger (#2750 / #1304) | Adafruit | ~$10 |
| Lanyard / titanium-style hardware | Amazon / jewelry supply | ~$12 |
| **Materials total** | | **~$70 / unit** |

Report variant totals (architecture / future; not required for freemium kit):

- Mycelium Mesh node (fiber + TPU medallion etc.): ~$60 / node  
- Spore Gate installation: ~$175  

---

## DIY kit vs assembled SKU notes

From `vorath-biolume-pendant.md` (commercial framing, art-only):

| SKU | Suggested sell | Margin logic |
|---|---|---|
| **DIY kit** (board + printed shell + resin + instructions) | **$70–90** | Lower labor; ships flatter; scalable path |
| **Assembled** pendant / wearable | **$120–180** | Art-wearable pricing on ~$70 materials; hand-assembly = labor income; numbered/limited helps price |
| Free firmware pack | Free + tip | This directory |

**Do not advertise BLE mesh / phone-app features** until that firmware exists. Sell the standalone 7-mode light.

---

## Optional / not in freemium free tier

- Enclosure STL (GAP — not yet modeled; tip/paid when available)
- Resin diffuser materials (user-sourced for DIY)
- Assembled / burnished limited units
