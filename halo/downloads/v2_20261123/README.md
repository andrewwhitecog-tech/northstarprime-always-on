# NorthStar Halo 3 Mod Pack v2 — Digon Sanctum, Shimmer Forensics & Project Reclaimer Modes

Unofficial fan-made research and modding release; not affiliated with or endorsed by Microsoft, Xbox, or Halo Studios.

## Verified Contents
- **4 Compiled Halo 3 H3EK `.bitmap` Binary Tags** (`h3ek_tags/`): compiled via `tool_fast.exe bitmaps`, with all 3 Digon Sanctum tags round-trip extracted via `tool_fast.exe export-bitmap-tga` (`512x512`, `512x512` and `1024x1024`). `northstar_sandtrap_digon_plate` (the `.bitmap` tag and its source `.tif`) is not original art: it is cropped and recoloured from Halo 3's own Sandtrap `copper_text` texture.
- **4 Project Reclaimer `v0.9.23` Custom Slayer Modes** (`reclaimer_modes/`): `northstar-digon-overload.json` (+15% damage / -10% health per kill, 5-stack cap), `northstar-sandtrap-shimmer.json` (5-minute round; +12% damage / -6 points health per kill from 110% health, 5-kill cap), `northstar-pressure.json`, and `northstar-endless-tempo.json`. Every mode passed both `mode-check` (`EXIT 0`) and headless native `local-server` Guardian/Slayer variant construction (`EXIT 0`). Live multi-player match playtesting remains to be run interactively.
- **2 HaloScript (`.hsc`) Scripts** (`scenarios_hsc/`): `shrine_digon_shimmer_director.hsc` (shimmer phase counter and turret set-up) and `nsp_digon_sanctum_arena.hsc` (arena tier counter). Source only; not compiled into a map.

## Integrity Verification
Run `sha256sum -c SHA256SUMS.txt` (Unix LF endings).
