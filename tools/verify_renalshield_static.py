#!/usr/bin/env python3
"""Verify the public NorthStar-to-RenalShield discovery and support bridge."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "renalshield" / "index.html"
HOME = ROOT / "index.html"
APP_LINK = (
    "https://www.renalshield.com/?utm_source=northstarprime.net"
    "&amp;utm_medium=owned_site&amp;utm_campaign=renalshield_discovery"
)
SUPPORT_LINK = (
    "https://www.renalshield.com/pricing?utm_source=northstarprime.net"
    "&amp;utm_medium=owned_site&amp;utm_campaign=renalshield_support"
)


def main() -> None:
    html = PAGE.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")
    required = (
        "RenalShield — Free Kidney-Aware Food Screener | NorthStar Prime",
        '<meta name="robots" content="index,follow">',
        '<link rel="canonical" href="https://northstarprime.net/renalshield/">',
        f'href="{APP_LINK}"',
        f'href="{SUPPORT_LINK}"',
        "Open RenalShield — free",
        "Plans &amp; support",
        "html{overflow-x:hidden",
        "body{margin:0;min-height:100vh;overflow-x:hidden",
        "not medical advice, diagnosis, treatment",
        'href="https://www.renalshield.com/guides"',
    )
    missing = [marker for marker in required if marker not in html]
    if missing:
        raise SystemExit(f"RenalShield bridge missing markers: {missing}")

    forbidden = (
        "buy.stripe.com",
        "googletagmanager",
        "google-analytics",
        "file://",
        "127.0.0.1",
        "localhost",
    )
    found = [marker for marker in forbidden if marker.lower() in html.lower()]
    if found:
        raise SystemExit(f"RenalShield bridge contains forbidden markers: {found}")

    if len(re.findall(r"<h1\b", html, re.IGNORECASE)) != 1:
        raise SystemExit("RenalShield bridge must contain exactly one H1")

    match = re.search(
        r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        raise SystemExit("RenalShield bridge JSON-LD is missing")
    payload = json.loads(match.group(1))
    application = payload.get("mainEntity", {})
    if payload.get("@type") != "WebPage" or application.get("@type") != "SoftwareApplication":
        raise SystemExit("RenalShield bridge structured data types changed")
    if application.get("url") != "https://www.renalshield.com/":
        raise SystemExit("RenalShield canonical application URL changed")
    if application.get("isAccessibleForFree") is not True:
        raise SystemExit("RenalShield free-access promise changed")
    if application.get("offers", {}).get("price") != "0":
        raise SystemExit("RenalShield free offer structured data changed")
    if 'href="/renalshield/"' not in home:
        raise SystemExit("Homepage does not pass internal authority to the RenalShield project page")
    if 'href="https://www.renalshield.com"' not in home:
        raise SystemExit("Homepage no longer preserves a direct free-app route")

    print("OK: indexable NorthStar-to-RenalShield discovery bridge")
    print("OK: tagged free-app and pricing/support routes")
    print("OK: homepage authority path and direct free-app route")
    print("OK: medical boundary, tracker-free page, and free-offer structured data")


if __name__ == "__main__":
    main()
