#!/usr/bin/env python3
"""Fail-closed static checks for The Distance Learns My Name."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "idr" / "signal-refrains" / "the-distance-learns-my-name" / "index.html"
IDR_INDEX = ROOT / "idr" / "index.html"
SITEMAP = ROOT / "sitemap.xml"
ARTIFACT_SHA = "516343E9A441C362874C2A1E144A3A902F43813AC900163374120BDB66D99532"
ROUTE = "/idr/signal-refrains/the-distance-learns-my-name/"


def main() -> int:
    page = PAGE.read_text(encoding="utf-8")
    index = IDR_INDEX.read_text(encoding="utf-8")
    sitemap = SITEMAP.read_text(encoding="utf-8")
    required = (
        f'<link rel="canonical" href="https://northstarprime.net{ROUTE}">',
        "The Distance Learns My Name",
        "dream:56bea9d18dd58329",
        "Every signal is an offer",
        "A voyage about authorship, not conquest.",
        "not medical or psychological interpretation, diagnosis, prediction, mind-reading, shared-dream evidence, or supernatural claim",
        "Hire NorthStar",
        ARTIFACT_SHA,
    )
    missing = [item for item in required if item not in page]
    if missing:
        raise SystemExit(f"Distance signal required content missing: {missing}")
    if f'href="{ROUTE}"' not in index:
        raise SystemExit("IDR index does not discover The Distance Learns My Name")
    if f"https://northstarprime.net{ROUTE}" not in sitemap:
        raise SystemExit("The Distance Learns My Name is absent from sitemap.xml")
    if page.count("Let the distance learn my name") < 3:
        raise SystemExit("Expected complete recurring chorus is absent")
    if re.search(r"file://|[A-Z]:\\|localhost|127\.0\.0\.1", page, re.I):
        raise SystemExit("Public page contains a local/private runtime reference")
    if "googletagmanager" in page.lower() or re.search(r"\banalytics\b", page.lower().replace("no analytics", "")):
        raise SystemExit("Public page contains tracking code")
    print("PASS: complete original lyric, craft notes, source packet, and release boundary are present")
    print("PASS: IDR discovery, sitemap route, exact artifact hash, and no-tracking checks passed")
    print(f"PASS: bytes={PAGE.stat().st_size} sha256={hashlib.sha256(PAGE.read_bytes()).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
