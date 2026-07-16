# Services Always-On Freeze Provenance

- Source: `https://app.northstarprime.net/services`
- Pulse snapshot source: `https://app.northstarprime.net/api/pulse`
- Frozen at (UTC): `2026-07-16T06:00:43+00:00`
- Transformation version: `2`
- Source HTML SHA-256: `4A0F3D82301437920CD2198FBF6EC47FF287A3A522FED6EDA2E46661C3599252`
- Frozen HTML SHA-256: `7A4DD285475E3B691A8FCCD337D1DA95B04BDB2E7CA4C1D433515043BEBACA26`
- Pulse snapshot SHA-256: `BC435ADE9F4FFAA1DFF4E6CF5EAA04907198D02DD83091FF095B985B40AA4713`
- Cloud-app attribute rewrites: `71`
- Cloud-app CSS rewrites: `0`
- Same-origin pulse rewrites: `1`
- Private packet links withheld: `2`

## Routing contract

The route is a static GitHub Pages mirror. Known always-on routes and assets stay
root-relative on `northstarprime.net`. Routes that require Flask, API state,
member state, previews, or checkout logic are rewritten to
`https://app.northstarprime.net`. The IDR dock reads
`/services/idr_now_playing_snapshot.json`; audio itself remains on the dedicated
NorthStar asset host. No DNS, payment, account, or submission state is changed by
this freeze. The private IDC anthology JSON is intentionally not linked or
published; both source references are replaced with a disabled owner-review
notice.
