# NorthStar Prime static recovery manifest

Verified 2026-07-15.

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
- Fifty links for non-mirrored server routes are sent to app.northstarprime.net.
- The home-freeze manifest records source, timestamp, byte sizes, and SHA-256
  hashes for the page and every referenced asset.

## Static recovery route

- Source: idc-programming/index.html
- Nine Season One broadcasts use privacy-enhanced youtube-nocookie.com embeds.
- Every embedded broadcast retains a direct static MP4 backup.
- Sixteen channel bumpers remain direct-hosted in static/idc_video/.
- YouTube IDs are mirrored in static/idc_video/yt_manifest.json.
- All 25 MP4 files are below GitHub's 100 MB per-file limit.

## Failover boundary

The homepage, founders surface, mystery-school route, health marker, Season One
catalogue, YouTube players, MP4 backups, and direct static assets survive a
Render outage. Dynamic features still require app.northstarprime.net and
degrade to ordinary links when that service is unavailable.

## Verification

    python tools/verify_home_static.py
    python tools/verify_idc_static.py
    python tools/verify_idc_static.py --network

The home verifier checks the full-page guard, manifest hashes, all 22 media
assets, local filesystem leakage, and dangling local routes. The IDC verifier
checks the HTML/manifest mapping, tracked MP4 inventory and sizes, broken local
Windows paths, embed code, and optionally all nine YouTube oEmbed endpoints.
