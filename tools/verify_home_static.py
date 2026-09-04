#!/usr/bin/env python3
"""Verify the frozen always-on NSP homepage and its asset manifest."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "HOME_FREEZE_MANIFEST.json"
LOCAL_REF_RE = re.compile(r"file://|[A-Z]:\\", re.IGNORECASE)
HREF_RE = re.compile(r"href=['\"](?P<path>/[^'\"]*)['\"]", re.IGNORECASE)
ALLOWED_LOCAL = (
    "/static/",
    "/arcade",
    "/ckd-kitchen",
    "/cookbook",
    "/idc-programming",
    "/idr",
    "/literature/",
    "/continuity-atlas/",
    "/contact/",
    "/harm-reduction/",
    "/hire/",
    "/portfolio/",
    "/founders",
    "/mystery-school",
    "/services",
    "/xmr/",
    "/links/",
    "/lost/",
    "/realm/",
    "/sigil-forge/",
    "/site.webmanifest",
    "/health",
)


def main() -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if payload.get("schema") != "nsp.always-on-home-freeze.v1":
        raise SystemExit("Unexpected or missing home-freeze schema")

    index = ROOT / str(payload["index"]["relative_path"])
    index_bytes = index.read_bytes()
    normalized_index_bytes = index_bytes.replace(b"\r\n", b"\n")
    if hashlib.sha256(normalized_index_bytes).hexdigest() != payload["index"]["sha256"]:
        raise SystemExit("Homepage hash does not match manifest after newline normalization")
    if len(normalized_index_bytes) != payload["index"]["bytes"]:
        raise SystemExit("Homepage byte count does not match manifest after newline normalization")
    html = normalized_index_bytes.decode("utf-8")
    if len(html) < 50_000 or "<title>Home — NorthStar Prime</title>" not in html:
        raise SystemExit("Homepage is not the full frozen NSP home")
    if LOCAL_REF_RE.search(html):
        raise SystemExit("Homepage contains a local filesystem reference")
    if "fetch('/api/pulse')" in html:
        raise SystemExit("Homepage still depends on the server pulse API")
    snapshot_url = "/services/idr_now_playing_snapshot.json"
    if html.count(f"fetch('{snapshot_url}')") < 3:
        raise SystemExit("Homepage pulse consumers do not use the frozen snapshot")
    if not (ROOT / snapshot_url.lstrip("/")).is_file():
        raise SystemExit("Homepage pulse snapshot is missing")
    if 'href="/continuity-atlas/"' not in html:
        raise SystemExit("Homepage does not expose the always-on Continuity Atlas")
    if 'href="/contact/"' not in html:
        raise SystemExit("Homepage does not expose the always-on contact desk")
    if 'href="/harm-reduction/"' not in html:
        raise SystemExit("Homepage does not expose the harm-reduction card deck")
    for route in ('href="/arcade/"', 'href="/idr/"', 'href="/literature/"'):
        if route not in html:
            raise SystemExit(f"Homepage does not expose the always-on route: {route}")
    if "https://app.northstarprime.net/services?utm_source=northstarprime.net" not in html:
        raise SystemExit("Homepage does not expose the canonical customer service studio")
    if 'href="/links/"' not in html:
        raise SystemExit("Homepage does not expose the verified links directory")
    revenue_checks = {
        'id="hire-northstar"': "Homepage revenue bridge is missing",
        'id="hire-northstar-title"': "Homepage revenue bridge heading is missing",
        "Bring us the system that refuses to work.": "Homepage revenue hook is missing",
        "One fixed scope:": "Homepage entry offer is missing",
        "Send the problem": "Homepage direct inquiry CTA is missing",
        "NorthStar%20Failure%20Map%20inquiry": "Homepage inquiry is not pre-addressed",
        "Business%20impact%3A": "Homepage inquiry lacks qualification prompts",
        "utm_campaign=revenue_sprint": "Homepage revenue links are not campaign-tagged",
        "https://app.northstarprime.net/hire/failure-map?": "Homepage does not link to the exact Failure Map scope",
        "https://app.northstarprime.net/hire/ai-incident-readiness?": "Homepage does not expose the free readiness scorecard",
        "utm_content=free_scorecard": "Homepage scorecard link lacks distinct attribution",
        'href="/hire/?utm_source=northstarprime.net': "Homepage does not expose the indexable Hire doorway",
        'href="/portfolio/?utm_source=northstarprime.net': "Homepage does not expose the selected-work portfolio",
        "utm_content=portfolio_previews": "Homepage portfolio link lacks distinct attribution",
    }
    for needle, message in revenue_checks.items():
        if needle not in html:
            raise SystemExit(message)
    if html.count("utm_campaign=revenue_sprint") < 5:
        raise SystemExit("Homepage does not route every primary Hire entry through the revenue campaign")
    if html.count('href="/hire/?') < 3:
        raise SystemExit("Homepage general Hire entries do not use the apex Hire doorway")
    product_checks = {
        "Explore 23 audited product archives": "Homepage does not explain the public product archive",
        "utm_campaign=product_discovery": "Homepage product links are not campaign-tagged",
        "utm_content=gift_shop": "Homepage gift-shop card lacks distinct attribution",
    }
    for needle, message in product_checks.items():
        if needle not in html:
            raise SystemExit(message)
    if html.count("utm_campaign=product_discovery") < 3:
        raise SystemExit("Homepage does not attribute every primary product entry")

    bad_routes = []
    for match in HREF_RE.finditer(html):
        path = match.group("path")
        if path != "/" and not path.startswith(ALLOWED_LOCAL):
            bad_routes.append(path)
    if bad_routes:
        raise SystemExit(f"Unmirrored local route links remain: {sorted(set(bad_routes))[:10]}")

    assets = payload.get("assets", [])
    if len(assets) != payload.get("referenced_asset_count"):
        raise SystemExit("Asset count does not match manifest")
    total = 0
    for row in assets:
        path = ROOT / str(row["relative_path"])
        if not path.is_file():
            raise SystemExit(f"Missing homepage asset: {row['relative_path']}")
        asset_bytes = path.read_bytes()
        if path.suffix.lower() in {".css", ".js", ".json", ".svg"}:
            asset_bytes = asset_bytes.replace(b"\r\n", b"\n")
        if len(asset_bytes) != row["bytes"]:
            raise SystemExit(f"Asset size mismatch: {row['relative_path']}")
        if hashlib.sha256(asset_bytes).hexdigest() != row["sha256"]:
            raise SystemExit(f"Asset hash mismatch: {row['relative_path']}")
        total += len(asset_bytes)
    if total != payload.get("referenced_asset_bytes"):
        raise SystemExit("Total homepage asset bytes do not match manifest")

    print(f"OK: full frozen homepage ({len(html)} characters)")
    print(f"OK: {len(assets)} referenced assets / {total} bytes")
    print(f"OK: {payload.get('dynamic_route_links_rewritten', 0)} dynamic links routed to app.northstarprime.net")
    print("OK: no local filesystem references or dangling local route links")


if __name__ == "__main__":
    main()
