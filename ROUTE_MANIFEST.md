# NorthStar Prime static recovery manifest

Verified 2026-08-27.

## Canonical service

- https://northstarprime.net is served by GitHub Pages and does not depend on
  Andre's computer.
- https://www.northstarprime.net points to GitHub Pages and redirects to the
  canonical apex.
- https://app.northstarprime.net is the verified Render-backed dynamic service.
- The apex uses all four official GitHub Pages IPv4 targets. Web routing is DNS
  only; mail and domain-authentication records are independent and unchanged.

## Full homepage

- Source: index.html
- The page is a frozen copy of the full public NSP homepage, not the original
  minimal resilience shell.
- All 22 referenced image/video assets are direct-hosted in this repository.
- Thirty-six links for non-mirrored server routes are sent to app.northstarprime.net.
- The home-freeze manifest records source, timestamp, byte sizes, and SHA-256
  hashes for the page and every referenced asset.

## Static recovery route

- Source: idc-programming/index.html
- Nine Season One broadcasts use privacy-enhanced youtube-nocookie.com embeds.
- Every embedded broadcast retains a direct static MP4 backup.
- Sixteen channel bumpers remain direct-hosted in static/idc_video/.
- YouTube IDs are mirrored in static/idc_video/yt_manifest.json.
- All 25 MP4 files are below GitHub's 100 MB per-file limit.
- The unreleased anthology packet is absent from the public tree; the page
  displays an owner-review withholding notice instead of a download link.

## Continuity Atlas route

- Source: continuity-atlas/index.html
- Canonical public path: /continuity-atlas/
- The viewer, styles, and versioned graph snapshot are bundled locally.
- The graph preserves evidence grades and outbound source citations; the
  always-on copy does not require Flask or a third-party JavaScript CDN.

## Contact and security routes

The `/contact/` route and `/.well-known/security.txt` remain available on the
apex. They expose only branded contact aliases, not the private forwarding
destination, and the security policy canonically identifies its always-on URL.

## Harm-reduction safety route

- Source: `harm-reduction/index.html`
- Apex continuity path: `/harm-reduction/`
- Canonical reviewed guide: `https://app.northstarprime.net/harm-reduction`.
- The illustrated V08 draft and its authorization artifacts are absent from the
  public mirror because the application release gate marks that deck unapproved.
- `HARM_REDUCTION_FREEZE_MANIFEST.json` is an explicit inactive tombstone.
- Prior files remain recoverable from hash-preserved private review evidence and
  repository history; no clinical wording was silently altered.

## Coloring Studio and payment bridges

- `/coloring-studio/` delegates to the reviewed application Coloring Studio.
- `/payments/` delegates to the canonical application Payment Desk.
- Both bridges preserve query strings and fragments and keep dynamic state on
  the Render-backed application rather than fabricating static functionality.

## CKD Kitchen and Digital MasterCook routes

- Source: `ckd-kitchen/index.html`
- Canonical public path: `/ckd-kitchen/`
- Continuity alias: `/cookbook/`
- The full freeware edition remains searchable without a download and is also
  available as a printable PDF.
- Recipe nutrition figures are labeled as estimates, not personal targets;
  the route does not claim clinician endorsement or medical certification.

## Verified links directory

- Source: links/index.html
- Canonical public path: /links/
- Provides one tracker-free, always-on directory for NSP experiences and the
  verified TikTok, YouTube, Instagram, Reddit, and Moltbook profiles.
- The homepage navigation and social footer both expose this route.

## Creator route

- Source: meet-the-creator/index.html
- Canonical apex path: /meet-the-creator/
- Delegated application path: https://app.northstarprime.net/meet-the-creator
- Social preview asset: static/creator/meet-the-creator-og.jpg
- The preview is the exact 1200x630 JPEG served by the live application at
  https://app.northstarprime.net/static/creator/meet-the-creator-og.jpg
  (157,127 bytes; SHA-256
  359d633d503b83d4c98a2e3c1d29c5c266668d026308bd7221c3c75b06418d67).
- The lightweight GitHub Pages shim preserves query strings and fragments while
  routing the creator link to the live application. The route was locally
  verified on 2026-08-01; deployment remains a separate release action.

## Arcade route

- Source: arcade/index.html
- Canonical public path: /arcade/
- Forty-seven of forty-eight catalog games are fully static mirrors with 365
  hashed runtime assets and no CDN dependency.
- Eight large decorative motion plates are locally recompressed for web
  delivery, saving 88,810,171 bytes while keeping the games self-contained.
- One lore corpus receives a deterministic provenance redaction so private
  source-workspace paths cannot enter the public artifact.
- super-arcade-archive is the sole explicit cloud fallback because its source
  exposes a private local-drive inventory and must not be published.
- ARCADE_FREEZE_MANIFEST.json gives every route exactly one static-or-cloud
  disposition, plus source/output hashes and asset transforms.

## Interdimensional Radio route

- Source: idr/index.html
- Canonical public path: /idr/
- Fifty catalog tracks and the full station interface remain discoverable on
  the apex.
- The dock selects the same five-minute program slot for visitors without
  calling a cross-origin pulse API.
- Track audio streams from assets.northstarprime.net; the page, cover repairs,
  PWA metadata, navigation, and deterministic player logic are in this repo.
- IDR_FREEZE_MANIFEST.json records the page hash, 52 relayed assets, local
  support files, and all media origins.

## Services route

- Source: services/index.html
- Canonical public path: /services/
- The public catalog and disclosure remain on the apex.
- The IDR dock uses services/idr_now_playing_snapshot.json, eliminating a
  cross-origin runtime API call.
- Seventy-one server-only links are explicitly routed to
  app.northstarprime.net; static navigation remains on the apex.
- Two owner-review packet references are replaced by visible disabled notices,
  and the mobile guard collapses all service grids cleanly below 768 pixels.
- SERVICES_FREEZE_MANIFEST.json and SERVICES_ROUTE_PROVENANCE.md record the
  transformation and routing contract.

## XMR and Warband capture routes

- /xmr/ is a static, outage-resistant receiving page with separate donation
  and payment addresses, local QR assets, and no exchange or redemption claim.
- /warband/ remains static, but its launch-list form waits for the durable
  allowlisted API at app.northstarprime.net before showing success.
- The capture API owns duplicate handling, validation, and persistent storage;
  the apex page does not keep a misleading browser-only fallback.

## Failover boundary

The homepage, founders surface, mystery-school route, health marker, Season One
catalogue, YouTube players, MP4 backups, Continuity Atlas, contact/security
desk, service catalog, arcade landing, 47 mirrored games, IDR catalog, and
direct static assets survive a Render outage. IDR audio relies on the separate
NSP asset host. Checkout, accounts, live server state, the private arcade
archive, and other dynamic actions still require app.northstarprime.net and
degrade to ordinary cloud links when that service is unavailable.

## Capacity guard

GitHub documents a 1 GB published-site limit and recommends a 1 GB maximum
source repository:
https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

tools/check_pages_budget.py fails the release before 900,000,000 bytes and also
fails any single file at or above 100,000,000 bytes. The generated
PAGES_CAPACITY_BUDGET.json is the authoritative point-in-time size report.
Ignored smoke artifacts under output/ are excluded from both staging and the
published-size calculation.

## Verification

    python tools/verify_home_static.py
    python tools/verify_idc_static.py
    python tools/verify_continuity_atlas_static.py
    python tools/verify_contact_security_static.py
    python tools/verify_harm_reduction_static.py
    python tools/verify_mastercook_static.py
    python tools/verify_meet_creator_redirect.py --network
    python tools/verify_links_static.py --network
    python tools/smoke_links_browser.py
    python tools/verify_arcade_static.py
    python tools/verify_idr_static.py --network
    python tools/verify_services_static.py --network
    python tools/check_pages_budget.py
    python tools/verify_http_mirror.py
    python tools/verify_idc_static.py --network

The home verifier checks the full-page guard, manifest hashes, all 22 media
assets, local filesystem leakage, and dangling local routes. The IDC verifier
checks the HTML/manifest mapping, tracked MP4 inventory and sizes, broken local
Windows paths, embed code, and optionally all nine YouTube oEmbed endpoints.
The creator-route verifier checks the app target, canonical/refresh/fallback
contract, query-and-fragment preservation, sitemap entry, and existing creator
navigation. The atlas verifier checks the complete self-contained bundle, local references,
home discoverability, source-linked data marker, and rights-safe Jeopardy gate.
The arcade, IDR, and services verifiers enforce their route dispositions,
hashes, local-runtime dependencies, cloud boundaries, and representative
network health. The capacity guard prevents an oversized Pages release.
The HTTP mirror verifier HEAD-checks every intended published file and, on a
local origin, confirms the served byte length matches the frozen artifact.
