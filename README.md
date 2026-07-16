# northstarprime-always-on
Always-on NorthStar Prime mirror for northstarprime.net.

The apex and www hostnames are served by GitHub Pages and do not depend on
Andre's computer. The homepage is a frozen copy of the full NSP experience with
all 22 referenced media assets stored here. Links to features that still need a
server route to app.northstarprime.net, the verified Render service.

The /idc-programming/ route contains the complete Season One catalogue, nine
verified YouTube players, direct MP4 backups, and sixteen direct-hosted channel
bumpers.

The `/continuity-atlas/` route is a self-contained, source-linked film,
television, and Jeopardy evidence graph. Its HTML, CSS, graph snapshot, and
JavaScript viewer are stored in this repository, so the atlas remains usable
when the dynamic service or Andre's computer is offline.

Run the zero-dependency release check before publishing:

    python tools/verify_home_static.py
    python tools/verify_idc_static.py
    python tools/verify_continuity_atlas_static.py

Add --network to the IDC verifier to test every YouTube oEmbed endpoint as
well. See ROUTE_MANIFEST.md and HOME_FREEZE_MANIFEST.json for routing,
provenance, hashes, and failover details.
