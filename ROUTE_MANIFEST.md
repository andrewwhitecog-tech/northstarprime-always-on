# NorthStar Prime static recovery manifest

Verified 2026-07-15.

## Canonical service

- https://northstarprime.net is currently served by Render and does not depend
  on Andre's computer.
- Render's Flask routes omit trailing slashes: /idc-programming returns 200;
  /idc-programming/ currently returns 404.

## Static recovery route

- Source: idc-programming/index.html
- Nine Season One broadcasts use privacy-enhanced youtube-nocookie.com embeds.
- Every embedded broadcast retains a direct static MP4 backup.
- Sixteen channel bumpers remain direct-hosted in static/idc_video/.
- YouTube IDs are mirrored in static/idc_video/yt_manifest.json.
- All 25 MP4 files are below GitHub's 100 MB per-file limit.

## Independent fallback caveat

GitHub Pages still has northstarprime.net configured as its custom domain, but
Cloudflare now sends that domain to Render. GitHub therefore redirects its
project Pages URL back to the canonical domain instead of exposing a second
independent URL.

The no-cost fix is to assign this Pages site a dedicated DNS-only hostname such
as fallback.northstarprime.net, leaving the apex on Render. That DNS/custom
domain change is deliberately not included in this repository commit.

## Verification

    python tools/verify_idc_static.py
    python tools/verify_idc_static.py --network

The verifier checks the HTML/manifest mapping, tracked MP4 inventory and sizes,
broken local Windows paths, embed code, and optionally all nine YouTube oEmbed
endpoints.
