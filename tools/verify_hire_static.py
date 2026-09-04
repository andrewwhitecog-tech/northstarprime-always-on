#!/usr/bin/env python3
"""Verify the indexable NorthStar Digital hire doorway."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HIRE = ROOT / "hire" / "index.html"
SITEMAP = ROOT / "sitemap.xml"


def main() -> None:
    html = HIRE.read_text(encoding="utf-8")
    required = (
        "AI Operations &amp; Software Rescue | NorthStar Digital",
        '<link rel="canonical" href="https://northstarprime.net/hire/">',
        "Bring us the system that refuses to work.",
        "Failure Map",
        "Release Confidence",
        "Commerce Activation",
        "$2,500",
        "$5,000",
        "$15,000",
        "Proposal-first / 50% to schedule",
        "mailto:contact@northstarprime.net",
        "utm_medium=owned_hire",
        "utm_campaign=revenue_sprint",
        "/hire/ai-incident-readiness?",
    )
    missing = [marker for marker in required if marker not in html]
    if missing:
        raise SystemExit(f"Hire doorway missing markers: {missing}")
    if re.search(r"file://|[A-Z]:\\", html, re.IGNORECASE):
        raise SystemExit("Hire doorway contains a local filesystem reference")
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
    if not match:
        raise SystemExit("Hire doorway lacks structured service data")
    payload = json.loads(match.group(1))
    if payload.get("@type") != "ProfessionalService":
        raise SystemExit("Hire doorway structured data is not ProfessionalService")
    offers = payload.get("hasOfferCatalog", {}).get("itemListElement", [])
    prices = {(row.get("price"), row.get("priceCurrency")) for row in offers}
    if prices != {("2500", "USD"), ("5000", "USD")}:
        raise SystemExit(f"Hire doorway offer data mismatch: {sorted(prices)}")
    if "https://northstarprime.net/hire/</loc>" not in SITEMAP.read_text(encoding="utf-8"):
        raise SystemExit("Hire doorway is missing from sitemap")
    print("OK: indexable Hire doorway, exact service ladder, and structured offer data")


if __name__ == "__main__":
    main()
