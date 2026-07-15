# northstarprime-always-on
Always-on static resilience shell for northstarprime.net.

The canonical site currently runs independently of Andre's PC on Render. This
repository is the static disaster-recovery mirror. Its /idc-programming/ route
contains the complete Season One catalogue, nine verified YouTube players,
direct MP4 backups, and sixteen direct-hosted channel bumpers.

Run the zero-dependency release check before publishing:

    python tools/verify_idc_static.py

Add --network to verify every YouTube oEmbed endpoint as well. See
ROUTE_MANIFEST.md for routing and failover details.
