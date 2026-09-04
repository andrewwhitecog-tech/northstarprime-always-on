# northstarprime-always-on
Always-on NorthStar Prime mirror for northstarprime.net.

The apex and www hostnames are served by GitHub Pages and do not depend on
Andre's computer. The homepage is a frozen copy of the full NSP experience with
all 22 referenced media assets stored here. Links that still need server-side
behavior go to app.northstarprime.net, the verified Render service.

The /idc-programming/ route contains the complete Season One catalogue, nine
verified YouTube players, direct MP4 backups, and sixteen channel bumpers. The
repository preserves the video source copies; the curated Pages artifact omits
those duplicate 384 MB and routes playback to the identical files on
app.northstarprime.net. The owner-review anthology packet is deliberately
withheld from the public tree until it receives a separate release decision.

The `/continuity-atlas/` route is a self-contained, source-linked film,
television, and Jeopardy evidence graph. Its HTML, CSS, graph snapshot, and
JavaScript viewer are stored in this repository, so the atlas remains usable
when the dynamic service or Andre's computer is offline.

The `/contact/` route and `/.well-known/security.txt` provide an always-on
branded mail fallback and security contact policy without exposing the private
forwarding destination. The root `.nojekyll` marker ensures GitHub Pages
publishes the `.well-known` directory verbatim.

The `/harm-reduction/` route delegates to the current reviewed application
safety guide. The illustrated V08 draft and its stale authorization artifacts
are absent from this public mirror while clinical review is unresolved; the
freeze manifest is an explicit inactive tombstone.

The `/coloring-studio/` and `/payments/` continuity routes delegate to their
canonical application surfaces while preserving query strings and fragments.

The /arcade/ route contains the full public catalog and 47 locally mirrored
games. One private-inventory surface is explicitly delegated to the cloud app.
Every mirrored runtime dependency is local; eight decorative motion plates are
recompressed for the web without changing game logic. Private source-workspace
provenance is redacted from the one public lore corpus that needs it.

The /idr/ route contains the complete 50-track station catalog. Its page,
covers, navigation, PWA metadata, and deterministic time-seeded dock stay on
the apex. Audio streams from the independent NSP asset host, so the catalog
does not inflate this Pages repository by another half-gigabyte.

The `/services/` route is a search-safe continuity bridge to the canonical
customer service studio at `app.northstarprime.net/services`. It replaces the
retired internal operations freeze, preserves incoming campaign parameters,
and exposes direct fallbacks for creative services, fixed-scope AI offers, the
Failure Map, and the free readiness scorecard.

The `/literature/` route is the always-on Interdimensional Literature shelf.
Its first complete public novel is *The Obituary Engine*, available as a
full browser reader and a downloadable 6x9 PDF alongside eight clearly labeled
concept-collection mockups. No store listing, pricing, or ISBN claim is implied.

The `/ckd-kitchen/` route is the single always-on home for the free Digital
MasterCook Book. It supports in-browser search and a printable PDF; the older
`/cookbook/` path is retained only as a continuity redirect. Nutrition figures
are clearly described as estimates rather than personal renal targets.

The /xmr/ route publishes separate self-custody Monero addresses for donations
and payments, including locally hosted QR codes and explicit SpaceCash
boundaries. The /warband/ form posts to the durable allowlisted capture API at
app.northstarprime.net and reports success only after the server confirms it.

Run the zero-dependency release check before publishing:

    python tools/verify_home_static.py
    python tools/verify_idc_static.py
    python tools/verify_continuity_atlas_static.py
    python tools/verify_contact_security_static.py
    python tools/verify_harm_reduction_static.py
    python tools/verify_mastercook_static.py
    python tools/verify_meet_creator_redirect.py --network
    python tools/verify_arcade_static.py
    python tools/verify_idr_static.py --network
    python tools/verify_services_static.py --network
    python tools/verify_xmr_warband_static.py --network
    python tools/verify_idl_static.py
    python tools/verify_http_mirror.py

GitHub Pages publishes a curated Actions artifact rather than the entire source
branch. Build and verify the exact artifact locally with:

    python tools/build_pages_artifact.py --output output/pages-artifact
    python tools/verify_pages_artifact.py --artifact output/pages-artifact --network

`python tools/check_pages_budget.py` audits the complete archival source tree;
it is expected to reject legacy whole-branch publishing. The curated artifact
verifier is the release capacity gate.

Add --network to the IDC verifier to test every YouTube oEmbed endpoint as
well. See ROUTE_MANIFEST.md, the route-specific freeze manifests, and
PAGES_CAPACITY_BUDGET.json for routing, provenance, hashes, failover details,
and the enforced GitHub Pages capacity ceiling.
