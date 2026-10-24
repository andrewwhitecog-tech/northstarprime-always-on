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


def main() -> None:
    html = PAGE.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")
    required = (
        "RenalShield: Reading Food Labels With Kidney Disease | NorthStar Prime",
        '<meta name="robots" content="index,follow,max-image-preview:large">',
        '<meta property="og:image" content="https://northstarprime.net/renalshield/og-renalshield-1200x630.jpg">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<link rel="apple-touch-icon" href="/renalshield/icons/apple-touch-icon.png" sizes="180x180">',
        '<link rel="manifest" href="/renalshield/icons/site.webmanifest">',
        'aria-label="Breadcrumb"',
        'href="/press/renalshield-mastercook/"',
        '<link rel="canonical" href="https://northstarprime.net/renalshield/">',
        f'href="{APP_LINK}"',
        "Open the RenalShield label tool (free)",
        "Draft, pending clinical review",
        "The label tool can miss ingredients",
        "Medical reviewer wanted",
        "https://doi.org/10.1053/j.ajkd.2020.05.006",
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
        "Andre White",
        "3 seconds",
        "zero added",
        "\u2014",
        "\u2013",
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
    graph = {}
    for node in payload.get("@graph", []):
        types = node.get("@type")
        for t in types if isinstance(types, list) else [types]:
            graph[t] = node
    page = graph.get("MedicalWebPage")
    if not page or "Article" not in page.get("@type", []) or "Organization" not in graph or "BreadcrumbList" not in graph:
        raise SystemExit("RenalShield structured data must include MedicalWebPage+Article, Organization and BreadcrumbList")
    if graph["Organization"].get("name") != "NorthStar Prime":
        raise SystemExit("RenalShield publisher organization changed")
    if "lastReviewed" in page or ("reviewedBy" in page and "pending" not in json.dumps(page["reviewedBy"]).lower()):
        raise SystemExit("RenalShield must not claim a completed clinical review yet")
    application = page.get("mainEntity", {})
    if application.get("@type") != "SoftwareApplication":
        raise SystemExit("RenalShield bridge structured data types changed")
    if application.get("url") != "https://www.renalshield.com/":
        raise SystemExit("RenalShield canonical application URL changed")
    if application.get("isAccessibleForFree") is not True:
        raise SystemExit("RenalShield free-access promise changed")
    if application.get("offers", {}).get("price") != "0":
        raise SystemExit("RenalShield free offer structured data changed")
    press = (ROOT / "press" / "renalshield-mastercook" / "index.html").read_text(encoding="utf-8")
    for marker in ('<meta name="robots" content="index,follow', "Draft, pending clinical review", '"MedicalWebPage"', 'href="/renalshield/"'):
        if marker not in press:
            raise SystemExit(f"RenalShield press page missing marker: {marker}")
    for marker in ("Andre White", "3 seconds", "\u2014", "\u2013"):
        if marker in press:
            raise SystemExit(f"RenalShield press page contains forbidden marker: {marker!r}")
    if not ((ROOT / "renalshield" / "og-renalshield-1200x630.jpg").is_file() or (ROOT / "renalshield" / "og-renalshield-1200x630.jpg.b64").is_file()):
        raise SystemExit("RenalShield share image missing")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    for loc in ("https://northstarprime.net/renalshield/", "https://northstarprime.net/press/renalshield-mastercook/"):
        if f"<loc>{loc}</loc>" not in sitemap:
            raise SystemExit(f"Sitemap missing {loc}")
    for icon in ("favicon.ico", "favicon.svg", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png", "mstile-150x150.png", "safari-pinned-tab.svg", "site.webmanifest", "browserconfig.xml"):
        path = ROOT / "renalshield" / "icons" / icon
        # Binary icons ship as *.b64 text and are decoded by materialize_b64_zips.py at deploy.
        if not (path.is_file() or path.with_name(icon + ".b64").is_file()):
            raise SystemExit(f"RenalShield icon missing: {icon}")
    if 'href="/renalshield/"' not in home:
        raise SystemExit("Homepage does not pass internal authority to the RenalShield project page")
    if 'href="https://www.renalshield.com"' not in home:
        raise SystemExit("Homepage no longer preserves a direct free-app route")

    print("OK: NorthStar-to-RenalShield discovery bridge (indexable, draft pending clinical review)")
    print("OK: tagged free-app route, draft banner, label-tool warning, reviewer call, references")
    print("OK: homepage authority path and direct free-app route")
    print("OK: medical boundary, tracker-free page, and free-offer structured data")
    print("OK: MedicalWebPage/Article/Organization/BreadcrumbList, press page, sitemap and icon set")


if __name__ == "__main__":
    main()
