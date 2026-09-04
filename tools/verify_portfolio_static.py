#!/usr/bin/env python3
"""Verify the public, indexable NorthStar selected-work surface."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "portfolio" / "index.html"


def main() -> None:
    html = PAGE.read_text(encoding="utf-8")
    required = (
        "Selected Work | NorthStar Prime",
        '<link rel="canonical" href="https://northstarprime.net/portfolio/">',
        "Worlds are easy. Systems are the trick.",
        "Interdimensional Cable",
        "Interdimensional Games",
        "Digital MasterCook",
        "Continuity Atlas",
        "NorthStar Digital",
        "The Obituary Engine",
        "9 episodes",
        "47 mirrored games",
        "96,036 words",
        "utm_medium=owned_portfolio",
    )
    missing = [marker for marker in required if marker not in html]
    if missing:
        raise SystemExit(f"Portfolio missing markers: {missing}")
    forbidden = ('http-equiv="refresh"', "location.replace(", "file://", "127.0.0.1", "localhost")
    found = [marker for marker in forbidden if marker.lower() in html.lower()]
    if found:
        raise SystemExit(f"Portfolio contains redirect or local markers: {found}")
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
    if not match:
        raise SystemExit("Portfolio lacks CollectionPage structured data")
    payload = json.loads(match.group(1))
    if payload.get("@type") != "CollectionPage":
        raise SystemExit("Portfolio structured data is not CollectionPage")
    items = payload.get("mainEntity", {}).get("itemListElement", [])
    if len(items) != 6 or [row.get("position") for row in items] != list(range(1, 7)):
        raise SystemExit("Portfolio structured item list is incomplete")
    for source in re.findall(r'<img[^>]+src="([^"]+)"', html):
        if source.startswith("/") and not (ROOT / source.lstrip("/")).is_file():
            raise SystemExit(f"Portfolio image is missing: {source}")
    print("OK: six-project image-led portfolio, local assets, and structured work list")


if __name__ == "__main__":
    main()
