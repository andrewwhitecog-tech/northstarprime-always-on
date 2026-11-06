# Pages artifact SIZE_AUDIT — 2026-11-06

## Problem
- Failed Pages artifact `github-pages` id **13540941948**: **910,365,619 bytes (~868 MiB)**
- `actions/deploy-pages@v5` timed out at **600000ms syncing_files** (run **42292377077** ×3; build green)
- Live CDN still `Last-Modified: 2026-11-06 20:02:41 GMT` (pre-#212)
- Timeout-only PR #213 does not shrink the payload

## Curator dry-run (pre-slim @ c8a8df0)
| Stage | Size |
|---|---:|
| Pre-materialize include | **969.2 MiB** / 2315 files |
| Post-materialize estimate | **~933 MiB** |
| GitHub artifact `size_in_bytes` | **868 MiB** |

Largest unlinked driver: cream-tip `static/downloads/*.zip.b64` (**~107 MiB** decoded, **zero** customer-page hrefs).

## Slim (PR #214)
- Expand `EXTERNAL_RELEASE_*` for heavy media shelves + `HEAVY_EXTERNAL_SUFFIXES` (pdf/zip/glb/…) → `raw.githubusercontent.com`
- **Keep TEXT shells local** under those prefixes (`.html/.css/.js/.json/.md`) so cookbook/literature readers are not rewritten onto raw (often `text/plain`)
- Do **not** prefix-externalize all of `static/downloads` or `static/idg` (readers + future-teller JSON stay on Pages)
- `omit_unlinked_pages_payload`: tip `*.zip.b64`, biolume hex parts, unreferenced Deluxe PDF, demoscene/homebrew ROM zips
- Release guard **980 → 500 MiB** (builder + verifier)
- No source deletes; STOP Tarot = WebP faces raw, HTML/JSON stay

| After slim (box dry-run) | Size |
|---|---:|
| Curated payload estimate | **~356 MiB** |

## Verify after merge
- Watch **new** main Pages run (not a re-run of 42292377077)
- LIVE: `/holidays/` 6/6 customs + `/chromatic` transit meta
