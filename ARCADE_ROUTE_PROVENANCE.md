# Arcade route provenance

This deterministic static freeze comes from the healthy local public catalog. Dynamic-only routes are explicit fallbacks to `https://app.northstarprime.net`.

- Catalog routes: 48
- Static mirrored games: 47
- Delegated routes: 1
- Hashed assets: 365 (317041670 bytes)
- Optimized motion plates: 8 (saved 88810171 bytes)
- Public provenance redactions: 1

| Route | Disposition | Source provenance |
|---|---|---|
| `/arcade/custom/asteroids-void` | static mirror | `workshop_arcade:asteroids_void.html` |
| `/arcade/custom/blackjack-noir` | static mirror | `workshop_arcade:blackjack_noir.html` |
| `/arcade/custom/breakout-wall` | static mirror | `workshop_arcade:breakout_wall.html` |
| `/arcade/custom/dharma-invaders` | static mirror | `workshop_arcade:dharma_invaders.html` |
| `/arcade/custom/digital-terrarium` | static mirror | `workshop_arcade:digital_terrarium_v3.html` |
| `/arcade/custom/digital-terrarium-3d` | static mirror | `workshop_arcade:digital_terrarium_3d.html` |
| `/arcade/custom/digital-terrarium-v1` | static mirror | `workshop_arcade:digital_terrarium.html` |
| `/arcade/custom/digital-terrarium-v2` | static mirror | `workshop_arcade:digital_terrarium_v2.html` |
| `/arcade/custom/flappy-dharma` | static mirror | `workshop_arcade:flappy_dharma.html` |
| `/arcade/custom/future-teller-cabinet` | static mirror | `nsp_repo_arcade:future_teller_cabinet.html` |
| `/arcade/custom/galaga-interdimensional` | static mirror | `workshop_arcade:galaga_interdimensional.html` |
| `/arcade/custom/gem-shark` | static mirror | `workshop_arcade:gem_shark.html` |
| `/arcade/custom/good-news-drive` | static mirror | `workshop_arcade:good_news_drive.html` |
| `/arcade/custom/hypernova-swarm` | static mirror | `nsp_repo_arcade:hypernova_swarm.html` |
| `/arcade/custom/idr-tracker-cabinet` | static mirror | `nsp_repo_arcade:idr_tracker_cabinet.html` |
| `/arcade/custom/missile-command` | static mirror | `workshop_arcade:missile_command.html` |
| `/arcade/custom/pac-dharma` | static mirror | `workshop_arcade:pac_dharma.html` |
| `/arcade/custom/paperclip-resistance` | static mirror | `nsp_repo_arcade:paperclip_resistance.html` |
| `/arcade/custom/precinct-404` | static mirror | `workshop_arcade:precinct_404.html` |
| `/arcade/custom/precinct-404-signal` | static mirror | `nsp_repo_arcade:precinct_404_signal.html` |
| `/arcade/custom/prediction-arena` | static mirror | `workshop_arcade:prediction_arena.html` |
| `/arcade/custom/prism-drift` | static mirror | `nsp_repo_arcade:prism_drift.html` |
| `/arcade/custom/rose-window` | static mirror | `nsp_repo_arcade:rose_window.html` |
| `/arcade/custom/signal-cartographer-prime` | static mirror | `nsp_repo_arcade:signal_cartographer_prime.html` |
| `/arcade/custom/signal-gallery` | static mirror | `workshop_arcade:signal_gallery.html` |
| `/arcade/custom/slots-biolume` | static mirror | `workshop_arcade:slots_biolume.html` |
| `/arcade/custom/snake-dimension` | static mirror | `workshop_arcade:snake_dimension.html` |
| `/arcade/custom/static-house` | static mirror | `nsp_repo_arcade:static_house.html` |
| `/arcade/custom/subject-000999` | static mirror | `nsp_repo_arcade:subject_000999.html` |
| `/arcade/custom/super-arcade-archive` | [dynamic fallback](https://app.northstarprime.net/arcade/custom/super-arcade-archive) | contains private local filesystem inventory |
| `/arcade/custom/super-vorath-bros` | static mirror | `nsp_repo_arcade:super_vorath_bros.html` |
| `/arcade/custom/tai-chi-flow` | static mirror | `nsp_repo_arcade:tai_chi_flow.html` |
| `/arcade/custom/tetris-plus` | static mirror | `workshop_arcade:tetris_plus_scifi.html` |
| `/arcade/custom/tetris-void` | static mirror | `workshop_arcade:tetris_void.html` |
| `/arcade/custom/void-pong` | static mirror | `workshop_arcade:void_pong.html` |
| `/arcade/custom/vorath-arena` | static mirror | `nsp_repo_arcade:vorath_arena.html` |
| `/arcade/custom/vorath-blade-tribunal` | static mirror | `nsp_repo_arcade:vorath_blade_tribunal.html` |
| `/arcade/custom/vorath-cabinet-row` | static mirror | `nsp_repo_arcade:vorath_cabinet_row.html` |
| `/arcade/custom/vorath-circus` | static mirror | `nsp_repo_arcade:vorath_circus.html` |
| `/arcade/custom/vorath-circus-midnight` | static mirror | `workshop_arcade:vorath_circus_midnight.html` |
| `/arcade/custom/vorath-dominion` | static mirror | `nsp_repo_arcade:vorath_dominion.html` |
| `/arcade/custom/vorath-incursion` | static mirror | `nsp_repo_arcade:vorath_incursion.html` |
| `/arcade/custom/vorath-pinball` | static mirror | `workshop_arcade:vorath_pinball.html` |
| `/arcade/custom/vorath-prism-runner` | static mirror | `nsp_repo_arcade:vorath_prism_runner.html` |
| `/arcade/custom/vorath-reliquary-gacha-shrine` | static mirror | `nsp_repo_arcade:vorath_reliquary_gacha_shrine.html` |
| `/arcade/custom/vorath-signal-crown` | static mirror | `nsp_repo_arcade:vorath_signal_crown.html` |
| `/arcade/custom/vorath-souls` | static mirror | `workshop_arcade:vorath_souls.html` |
| `/arcade/custom/vorathic-reef-tank` | static mirror | `workshop_arcade:vorathic_reef_tank.html` |

## Limits

- Server telemetry, live radio selection, prediction-bot APIs, activation, purchases, and smoke dashboards remain on the dynamic app origin.
- The private Super Arcade Archive is intentionally not copied because its source enumerates local drive paths.
- Static pages cannot reproduce server-side account, payment, or mutation flows.
