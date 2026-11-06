# Pages artifact SIZE_AUDIT — 2026-11-06

## Problem
- Failed Pages artifact `github-pages` id 13540941948: **910365619 bytes (~868 MiB)**
- `actions/deploy-pages@v5` timed out at 600000ms `syncing_files` (run 42292377077 ×3)
- Dry-run of pre-slim curated include set (c8a8df0a): **969.2 MiB / 2315 files**

## After slim (this PR)
- Dry-run curated include: **299.6 MiB / 1748 files**
- Release guard lowered **980 → 500 MiB**
- Strategy: expand `EXTERNAL_RELEASE_*` + omit unlinked tip `.zip.b64` → `raw.githubusercontent.com`; **no source deletes**
- Kept local: chronosphere, `static/vendor`, `static/games/sfx`, `logic_foundry_v14`, `ladder_v13`, `static/art/reviewed`
- Tarot: HTML/JSON/CSS/JS local; card WebP raw-delivered (STOP Tarot = no source delete)

## Top 40 included paths (after)

| MiB | Path |
|---:|:---|
| 3.44 | `mystery-school/art/dark-mirror-library-v01.png` |
| 3.42 | `static/arcade/game_art/20260801/the_melting_hour_hero.png` |
| 3.28 | `mystery-school/art/oracle-chamber-v01.png` |
| 3.27 | `static/games/imagegen_quality_pass_20260625/super_vorath_bros_plate.png` |
| 3.26 | `static/games/imagegen_quality_pass_20260625/vorath_prism_runner_plate.png` |
| 2.88 | `idr/artwork/nordic-skaldic-chant/NORDIC_SKALDIC_CHANT_COVER_v02.png` |
| 2.76 | `static/games/ladder_v13/chamber.png` |
| 2.69 | `static/front/realm/mushroom-island.png` |
| 1.85 | `idr/single-052/cover.jpg` |
| 1.78 | `static/brand/northstar_geometry.png` |
| 1.77 | `static/games/roster/blade_ruby_windup.png` |
| 1.76 | `static/games/roster/blade_emerald_idle.png` |
| 1.75 | `ckd-kitchen/flavor-atlas.html` |
| 1.71 | `static/games/roster/blade_ruby_hurt.png` |
| 1.69 | `static/games/roster/blade_emerald_strike.png` |
| 1.63 | `static/games/roster/demo_recraft_raw.png` |
| 1.55 | `static/brand/nine_threads.png` |
| 1.50 | `static/games/roster/blade_emerald_hurt.png` |
| 1.49 | `static/games/roster/blade_ruby_idle.png` |
| 1.44 | `static/games/roster/svb_hero.png` |
| 1.44 | `static/games/roster/rel_bg.png` |
| 1.41 | `idc/season-4/chrono-convergence/poster.jpg` |
| 1.41 | `static/games/roster/blade_emerald_windup.png` |
| 1.39 | `static/games/roster/circ_clown.png` |
| 1.37 | `static/games/roster/blade_ruby_strike.png` |
| 1.32 | `idr/single-054/cover.jpg` |
| 1.26 | `static/games/roster/svb_slime.png` |
| 1.21 | `static/vendor/three/0.160.0/build/three.module.js` |
| 1.15 | `static/games/roster/demo_recraft_cut.png` |
| 1.14 | `static/arcade/game_art/20260801/the_dark_below_hero.png` |
| 1.13 | `stickerforge/packs/sacred-geometry-crystals/metatrons_cube_cascadia_cedar.png` |
| 1.13 | `stickerforge/packs/sacred-geometry-crystals/01_metatrons_cube_cascadia_cedar.png` |
| 1.11 | `arcade/custom/northstar-chrono-defender/hero.jpg` |
| 1.11 | `static/games/roster/svb_hero_jump.png` |
| 1.02 | `arcade/custom/crownfall_intercept_box_art.jpg` |
| 1.02 | `stickerforge/packs/winter-solstice-yule/yule_pinecone_fox_spirit.png` |
| 1.02 | `stickerforge/packs/winter-solstice-yule/15_yule_pinecone_fox_spirit.png` |
| 1.02 | `static/games/roster/tai_orb.png` |
| 1.01 | `static/games/roster/terr_rorschach.png` |
| 1.01 | `spacecash/assets/pinewood_warp_core_spacecash.jpg` |

## External/omit by prefix (top 25)

| MiB | Bucket |
|---:|:---|
| 287.5 | `static/videos` |
| 244.8 | `idc/season-4` |
| 231.9 | `static/idc_covers` |
| 194.1 | `static/downloads` |
| 120.2 | `mature/assets` |
| 116.7 | `coloring-studio/assets` |
| 114.7 | `static/cookbook_deluxe_media` |
| 114.6 | `static/games` |
| 64.5 | `static/idg` |
| 60.0 | `static/art` |
| 59.7 | `idc/season-1` |
| 58.8 | `idc/season-2` |
| 55.5 | `static/literature` |
| 46.6 | `arcade/custom` |
| 38.8 | `tarot/oracle` |
| 33.3 | `static/drops` |
| 26.8 | `static/cards` |
| 25.2 | `static/idr_covers` |
| 19.1 | `static/action_captures` |
| 15.8 | `static/front` |
| 15.3 | `static/curated` |
| 15.1 | `idr/single-054` |
| 15.1 | `idc/season-3` |
| 13.5 | `literature/a-map-of-erased-places` |
| 11.9 | `idr/single-052` |

