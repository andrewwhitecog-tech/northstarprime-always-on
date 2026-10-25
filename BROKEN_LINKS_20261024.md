# Broken-link sweep: northstarprime.net, 2026-10-24

Run by Grok Bot, about 10:15 PM PT on Oct 24, 2026. Crawler: `/workspace/nsp-links-sweep/crawl.py`. Raw data: `/workspace/nsp-links-sweep/results.json` and `gumroad.json`.

Method: live sitemap https://northstarprime.net/sitemap.xml had 225 `<loc>` entries. That is 221 unique pages, because 4 are listed twice: /coloring-studio/, /comics/, /hire/website-repair/ and /tcg/. All 221 returned 200. From each page I took every href, src, srcset and og:image/og:url (skipping mailto/tel/js/data/#). Each unique target was checked with HEAD, then GET on 4xx/5xx/405, following redirects, with a Chrome UA, a 15s timeout, at most 2 concurrent requests per external host. 404, 410 or DNS failure counts as broken. 403, 429, 5xx, timeouts and connection errors count as unverified.

## Counts

- Pages crawled: 221 (225 sitemap entries)
- Unique link/asset targets checked: 2199 (1222 on northstarprime.net or app.northstarprime.net, of which 951 on the main domain; 977 external)
- 2xx/3xx OK: 2185
- Raw 404s: 9. 2 are false positives (font preconnect origins), leaving **7 real broken targets**: 6 internal (3 main-domain og images, 3 app product pages) and 1 external (Patreon)
- Unverified: 5
- Fixed in PR #112: 5 targets (tarot product, Patreon, 3 og images). 1 more (Open Eye kit) was already fixed by PR #108. 1 can't be fixed with confidence (Reveler STL)

## Broken targets (404) with source pages

| Target | Source pages | Outcome |
|---|---|---|
| https://app.northstarprime.net/chromatic/products/night-of-the-open-eye-kit | /oracle/ | Already fixed in main by PR #108 (now the Gumroad vdquzp link). It was still live during the crawl because that deploy was cancelled; it went out with the later main deploy (see live check) |
| https://app.northstarprime.net/chromatic/products/vorath-reveler-stl-miniature | /store/ | No live listing in the Chromatic catalog (33 products, re-checked 2026-10-25) or on Gumroad. Card is now a non-link "Coming soon" card with no Offer in JSON-LD. Repoint it when the product is published |
| https://app.northstarprime.net/chromatic/products/vorath-tarot-78-card-deck | /oracle/, /store/ | FIXED in PR #112: now points to app.northstarprime.net/chromatic/products/vorath-tarot-v2-pdf-deck (200, "VORATH Tarot: 78-Card Digital Deck", $12.00) |
| https://fonts.googleapis.com | /contact/, /cs/contact/, /es/contact/, /fictional-brands/, /ja/contact/, /ko/contact/, /ru/contact/, /stickerforge/studio/, /warband/, /zh/contact/ | FALSE POSITIVE: bare-origin <link rel=preconnect>, not a navigable link |
| https://fonts.gstatic.com | /contact/, /cs/contact/, /es/contact/, /fictional-brands/, /ja/contact/, /ko/contact/, /ru/contact/, /stickerforge/studio/, /warband/, /zh/contact/ | FALSE POSITIVE: bare-origin <link rel=preconnect>, not a navigable link |
| https://northstarprime.net/brick-alchemy/assets/brick-alchemy-hero.webp | /brick-alchemy/ | FIXED in PR #112: og:image now uses the raw.githubusercontent main URL (200 image/webp) |
| https://northstarprime.net/static/coloring_books/pages/deep_reef/09_octopus.png | /coloring-studio/ | FIXED in PR #112: file was never in git; now points to the same art in the repo, coloring-studio/assets/reviewed/deep_reef__09_octopus.png, via raw main URL (200 image/png) |
| https://northstarprime.net/static/idc_covers/hero_16x9/first_contact_16x9_hero_built_in_fresh_20260702_v01.png | /cs/portfolio/, /es/portfolio/, /ja/portfolio/, /ko/portfolio/, /portfolio/, /ru/portfolio/, /zh/portfolio/ | FIXED in PR #112: og/twitter image now uses the raw main URL (200 image/png) on 7 portfolio pages, plus brand/idc-studios |
| https://www.patreon.com/northstarprime | /links/ | FIXED in PR #112: now points to patreon.com/northstarprimenet (200, og:title "northstarprime.net"). Also fixed in JSON-LD sameAs on 7 homepages and in llms.txt |

## Unverified (not counted as broken)

| Target | Status | Source pages | Note |
|---|---|---|---|
| https://www.etsy.com/shop/UncleVorath420 | 403 | /, /acid-voxel-halloween/, /brick-alchemy/, /cs/, /cs/hire/, /es/, /es/hire/, /hire/, /hire/local-business-website/, /holidays/, /ja/, /ja/hire/ (+9 more) | bot wall / 403. A real browser most likely loads it |
| https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures | 403 | /static/cookbook_v10/fantasy_table/wave096.html, /static/cookbook_v10/fantasy_table/wave097.html, /static/cookbook_v10/fantasy_table/wave098.html | bot wall / 403. A real browser most likely loads it |
| https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety | 403 | /static/cookbook_v10/fantasy_table/wave096.html, /static/cookbook_v10/fantasy_table/wave097.html, /static/cookbook_v10/fantasy_table/wave098.html | bot wall / 403. A real browser most likely loads it |
| https://www.unicode.org/charts/PDF/U4DC0.pdf | CONNERR | /mystery-school/iching/ | 301 to http://www.unicode.org/Public/latest/charts/PDF/U4DC0.pdf. A manual retry also timed out after 20s, so this is a slow host, not a confirmed 404 |
| https://www.zazzle.com/store/unclevorath420 | 403 | /, /acid-voxel-halloween/, /brick-alchemy/, /cs/, /cs/hire/, /es/, /es/hire/, /hire/, /holidays/, /ja/, /ja/hire/, /ko/ (+8 more) | bot wall / 403. A real browser most likely loads it |

## Gumroad links (revenue)

All 25 unique Gumroad URLs (profile plus 24 `/l/` products; 54 link variants once UTM tags are counted) returned **200**, and each product page loaded with its own product title and a price. None are broken.

| URL | HTTP | Page loads | Title (og:title) | Price | Linked from |
|---|---|---|---|---|---|
| https://andrewcog.gumroad.com/ | 200 | yes | Subscribe to Northstarprime.net on Gumroad |  | /, /acid-voxel-halloween/, /brick-alchemy/, /cs/, /cs/hire/, /es/ ... |
| https://andrewcog.gumroad.com/l/alsjes | 200 | yes | VORATH Sigil Wallpapers — Vol. I (20-Pack: Sacred Geometry & PNW Landscapes) | $5.0 | /links/, /store/ |
| https://andrewcog.gumroad.com/l/audeok | 200 | yes | Solfeggio Tones: 9 ambient tracks | $9.99 | /links/ |
| https://andrewcog.gumroad.com/l/cbffq | 200 | yes | The Cosmic Eye — 2027 Hyperlinked Digital Planner (Night & Dawn Tablet PDFs) | $13.0 | /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/ccchr | 200 | yes | The Lineage of Light — Advent Art Calendar (27-Page PDF + 25 Art Plates) | $7.0 | /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/dkhdpk | 200 | yes | Ancestor Light — Remembrance Printables | $7.0 | /links/, /store/ |
| https://andrewcog.gumroad.com/l/doonjn | 200 | yes | Night of the Open Eye: Free VORATH Pumpkin Carving Plans | $0.0 | /, /cs/, /es/, /holidays/, /ja/, /ko/ ... |
| https://andrewcog.gumroad.com/l/ehzznt | 200 | yes | Little Light Library: 50 Illustrated Bedtime Books | $9.99 | /links/, /little-light-library/ |
| https://andrewcog.gumroad.com/l/fsltx | 200 | yes | Ardentilaterum: Illuminated Stained-Glass Brick Mosaic & Lantern Studio Guide | 12 Verified Sacred Geometry & Solstice Blueprints + BOMs | $14.0 | /brick-alchemy/, /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/fspybs | 200 | yes | Sacred Geometry Crystal Plates & Illustrated Line-Art Vault (26 PNGs) | $7.0 | /links/, /store/ |
| https://andrewcog.gumroad.com/l/fztoe | 200 | yes | VORATH Tarot Deluxe Bundle — 78-Card Deck, 72-Page Journal, 12 Spread Cards & Wallpapers | $29.0 | /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/hfpzxt | 200 | yes | RENALWISE Printable Bundle: Diet Card + Checklist + Tracker | $0.0 | /ckd-kitchen/ |
| https://andrewcog.gumroad.com/l/hyaeu | 200 | yes | NorthStar Sacred Calendar 2027 — Landscape + Portrait | $10.0 | /links/, /store/ |
| https://andrewcog.gumroad.com/l/ibxfso | 200 | yes | Cascade Yule — Winter Printables + Wallpaper | $7.0 | /links/, /store/ |
| https://andrewcog.gumroad.com/l/ikybax | 200 | yes | The Beholders' Harvest: A Harvest Table Printable Kit | $7.0 | /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/llkspo | 200 | yes | The Tote Alchemist's Handbook: Brick Mechanical Engineering, Gear Ratios, Linkages & Great Ball Contraption (GBC) STEM Curriculum PDF | $12.0 | /brick-alchemy/, /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/mnjog | 200 | yes | The Lineage of Light — Ornaments and Prints (11-Page PDF + 10 Art Plates) | $7.0 | /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/ouklmz | 200 | yes (redirects to https://andrewcog.gumroad.com/coffee) | Subscribe to Northstarprime.net on Gumroad |  | /links/ |
| https://andrewcog.gumroad.com/l/pshjy | 200 | yes | VORATH Tarot — full 78-card digital deck | $12.0 | /links/ |
| https://andrewcog.gumroad.com/l/qbqoqz | 200 | yes | Living Eye — 4 Seamless Animated Phone Wallpaper Loops (1080×1920 MP4 + Stills) | $7.0 | /links/, /store/ |
| https://andrewcog.gumroad.com/l/rajmfn | 200 | yes | Season of Lights — Winter Art Collection (7-Page PDF + 6 Art Plates) | $7.0 | /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/sefgfx | 200 | yes | The Wheel of Light: World Solstice & Festival Almanac | 36-Page Family STEM, Astronomy, Botany & Folklore Curriculum + 6 Printable Labs | $12.0 | /brick-alchemy/, /holidays/, /links/, /store/ |
| https://andrewcog.gumroad.com/l/vdquzp | 200 | yes | Night of the Open Eye: A VORATH Halloween Printable Kit | $7.0 | /, /cs/, /es/, /holidays/, /ja/, /ko/ ... |
| https://andrewcog.gumroad.com/l/vtarl | 200 | yes | VORATHIC: Sacred-Geometry & Pacific Northwest Folklore Coloring Book + 14 Wallpapers + 3 Art Plates | $9.99 | /links/ |
| https://andrewcog.gumroad.com/l/xnvde | 200 | yes | Golden Pheasant — DIY Sacred Geometry Mural Stencil & Projector Kit | $12.0 | /links/, /store/ |

Note: `/l/ouklmz` (the "Tip jar · $3+" on /links/) redirects to `andrewcog.gumroad.com/coffee`, Gumroad's tip/coffee page, which loads with 200. It works, but the link is a redirect rather than a product page.

## itch.io

The crawl found **no itch.io links** on any sitemap page. The only "itch" matches were /ckd-kitchen/ "kitchen" paths and twitch.tv/unclevorath420, which returned 200.

## Other storefront/app links

- app.northstarprime.net: all /chromatic product links except the 3 above returned 200, as did /arcade, /idr, /services, /hire/* (UTM) and the IDC video files.
- Etsy (UncleVorath420) and Zazzle (unclevorath420) returned 403 bot walls. These are listed as unverified, not broken.

## Fixes made (PR #112, squash-merged as 5a8c77c)

https://github.com/andrewwhitecog-tech/northstarprime-always-on/pull/112

1. `oracle/index.html` (3 refs) and `store/index.html` (1): `chromatic/products/vorath-tarot-78-card-deck` (404) changed to `chromatic/products/vorath-tarot-v2-pdf-deck` (200, $12.00). `tools/test_customer_static.py` now expects the new slug.
2. `links/index.html` href, JSON-LD sameAs in `index.html` and `cs/es/ja/ko/ru/zh/index.html`, and `llms.txt`: `patreon.com/northstarprime` (404) changed to `patreon.com/northstarprimenet` (200). In `HOME_FREEZE_MANIFEST.json`, only the index row's bytes/sha256 were updated.
3. og:image/twitter:image on `brick-alchemy/`, `coloring-studio/`, the 7 `*/portfolio/` pages and `brand/idc-studios/` now use `raw.githubusercontent.com/.../main/...` URLs. Those media trees are delivered from raw by `tools/build_pages_artifact.py` (`external_release_media`), and the builder only rewrites relative refs, so absolute on-domain URLs were 404ing.

CI on the PR: build (full curated Pages build plus all verifiers), Internal links and External links all passed. The first run failed only because a test asserted the old 404 slug; I fixed that in a second commit. No files were deleted and no arcade og files were touched.

## Outside the sitemap (seen while auditing the repo, not changed)

- `arcade/custom/*/index.html` (about 47 pages, the PR #110 lane) use og:image `https://northstarprime.net/static/games/og/*_og_1200x630.png`. Those PNGs are not in git under that path, and /static/games/og/ladder_og_1200x630.png returned 404 live at about 10:20 PM PT. I left them for the PR #110 seat.

