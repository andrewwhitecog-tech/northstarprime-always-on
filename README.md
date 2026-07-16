# northstarprime-always-on
Always-on NorthStar Prime mirror for northstarprime.net.

The apex and www hostnames are served by GitHub Pages and do not depend on
Andre's computer. The homepage is a frozen copy of the full NSP experience with
all 22 referenced media assets stored here. Links that still need server-side
behavior go to app.northstarprime.net, the verified Render service.

The /idc-programming/ route contains the complete Season One catalogue, nine
verified YouTube players, direct MP4 backups, and sixteen direct-hosted channel
bumpers. The owner-review anthology packet is deliberately withheld from the
public tree until it receives a separate release decision.

The `/continuity-atlas/` route is a self-contained, source-linked film,
television, and Jeopardy evidence graph. Its HTML, CSS, graph snapshot, and
JavaScript viewer are stored in this repository, so the atlas remains usable
when the dynamic service or Andre's computer is offline.

The `/contact/` route and `/.well-known/security.txt` provide an always-on
branded mail fallback and security contact policy without exposing the private
forwarding destination. The root `.nojekyll` marker ensures GitHub Pages
publishes the `.well-known` directory verbatim.

The /arcade/ route contains the full public catalog and 47 locally mirrored
games. One private-inventory surface is explicitly delegated to the cloud app.
Every mirrored runtime dependency is local; eight decorative motion plates are
recompressed for the web without changing game logic. Private source-workspace
provenance is redacted from the one public lore corpus that needs it.

The /idr/ route contains the complete 50-track station catalog. Its page,
covers, navigation, PWA metadata, and deterministic time-seeded dock stay on
the apex. Audio streams from the independent NSP asset host, so the catalog
does not inflate this Pages repository by another half-gigabyte.

The /services/ route is a frozen public service catalog with a local
now-playing snapshot. Links that need server state, checkout, member state, or
API behavior are explicitly sent to app.northstarprime.net. Two references to
the owner-review IDC packet are visibly disabled rather than published.

Run the zero-dependency release check before publishing:

    python tools/verify_home_static.py
    python tools/verify_idc_static.py
    python tools/verify_continuity_atlas_static.py
    python tools/verify_contact_security_static.py
    python tools/verify_arcade_static.py
    python tools/verify_idr_static.py --network
    python tools/verify_services_static.py --network
    python tools/check_pages_budget.py
    python tools/verify_http_mirror.py

Add --network to the IDC verifier to test every YouTube oEmbed endpoint as
well. See ROUTE_MANIFEST.md, the route-specific freeze manifests, and
PAGES_CAPACITY_BUDGET.json for routing, provenance, hashes, failover details,
and the enforced GitHub Pages capacity ceiling.
