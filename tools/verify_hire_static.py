#!/usr/bin/env python3
"""Verify institutional doorway, proposal terms and exact offer destinations."""
from __future__ import annotations
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from verify_home_static import (
    ORIGIN, check_asset_manifest, check_identity, check_local_links,
    collect_local_assets, read_page,
)

ROOT = Path(__file__).resolve().parents[1]
HIRE = ROOT / "hire" / "index.html"
SITEMAP = ROOT / "sitemap.xml"
OFFER_ROUTES = {
    "/hire/failure-map": "failure_map",
    "/hire/release-confidence-audit": "release_audit",
    "/hire/ai-incident-readiness": "free_scorecard",
    "/hire/commerce-activation": "commerce_activation",
}

def check_offer_links(links: list[str]) -> None:
    found = set()
    for link in links:
        url = urlsplit(link)
        if url.netloc != "app.northstarprime.net" or url.path not in OFFER_ROUTES: continue
        expected = {"utm_source": ["northstarprime.net"], "utm_medium": ["owned_hire"],
                    "utm_campaign": ["institutional_pilot"], "utm_content": [OFFER_ROUTES[url.path]]}
        query = parse_qs(url.query)
        if url.scheme != "https" or any(query.get(k) != v for k, v in expected.items()):
            raise SystemExit(f"Hire offer attribution mismatch: {url.path}")
        found.add(url.path)
    if found != set(OFFER_ROUTES):
        raise SystemExit(f"Hire offer destinations missing: {sorted(set(OFFER_ROUTES)-found)}")

def main() -> None:
    html = HIRE.read_text(encoding="utf-8")
    page = read_page(HIRE)
    check_identity(page, "Software Assessments & Institutional Projects | NorthStar Digital", ORIGIN + "/hire/")
    check_local_links(ROOT, HIRE, page)
    # Shared resources use the home's hashes; this does not exercise remote checkout.
    resources = collect_local_assets(ROOT, HIRE, page)
    home = json.loads((ROOT / "HOME_FREEZE_MANIFEST.json").read_text(encoding="utf-8"))
    rows = [row for row in home["assets"] if row["relative_path"] in resources]
    check_asset_manifest(ROOT, rows, resources)
    required = ("Failure Map", "Release Confidence", "Commerce Activation", "$2,500", "$5,000", "$15,000",
                "Proposal-first / 50% to schedule", "mailto:contact@northstarprime.net", "Procurement%20requirements")
    missing = [marker for marker in required if marker not in html]
    if missing: raise SystemExit(f"Hire doorway missing terms: {missing}")
    check_offer_links(page.links)
    matches = re.findall(r'<script\s+type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
    if len(matches) != 1: raise SystemExit("Hire doorway must have one structured service record")
    payload = json.loads(matches[0])
    if payload.get("@type") != "ProfessionalService" or payload.get("url") != ORIGIN + "/hire/":
        raise SystemExit("Hire doorway structured service identity mismatch")
    offers = payload.get("hasOfferCatalog", {}).get("itemListElement", [])
    actual = {(row.get("price"), row.get("priceCurrency"), row.get("url")) for row in offers}
    expected = {("2500", "USD", "https://app.northstarprime.net/hire/failure-map"),
                ("5000", "USD", "https://app.northstarprime.net/hire/release-confidence-audit")}
    if len(offers) != 2 or actual != expected:
        raise SystemExit("Hire doorway structured prices/destinations mismatch")
    if "https://northstarprime.net/hire/</loc>" not in SITEMAP.read_text(encoding="utf-8"):
        raise SystemExit("Hire doorway is missing from sitemap")
    print("OK: institutional Hire identity, local resources, proposal terms and exact attributed offers")

if __name__ == "__main__":
    main()
