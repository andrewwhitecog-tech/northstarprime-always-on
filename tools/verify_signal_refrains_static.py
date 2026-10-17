#!/usr/bin/env python3
"""Fail-closed static checks for Signal Refrains Volume One."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "idr" / "signal-refrains" / "volume-01" / "index.html"
IDR_INDEX = ROOT / "idr" / "index.html"
SITEMAP = ROOT / "sitemap.xml"
SOURCE_ARTIFACT_SHA = "B9CCC310F3F55CF53B1CBB28388FDEECA8F058697ACA72116CEA70DD4E6997B7"
TITLES = (
    "Weather in the Empty Room",
    "Salt Choir",
    "One Exit Short",
    "Central Square, After Rain",
    "City Made of Low Tide",
    "The Gentle Gravity",
    "Stories in the Wall",
    "Silver Streets Refuse the Map",
    "Faces in the Wet Stone",
)
PACKETS = (
    "dream:82813606c755c21f", "dream:dc6081af3818e5fc", "dream:53ffb9bec09803bc",
    "dream:d1d083e6024df576", "dream:16c396d3b11b2e8a", "dream:0740ae02a6bc42f2",
    "dream:be834167cd769d6b", "dream:aeee91ab0c534aa0", "dream:273ea807b2763ede",
)


def main() -> int:
    page = PAGE.read_text(encoding="utf-8")
    index = IDR_INDEX.read_text(encoding="utf-8")
    sitemap = SITEMAP.read_text(encoding="utf-8")
    required = (
        '<link rel="canonical" href="https://northstarprime.net/idr/signal-refrains/volume-01/">',
        "Creative boundary:",
        "not interpretations of the Dreamer",
        "not medical or psychological interpretation, diagnosis, prediction, mind-reading, shared-dream evidence, or supernatural claim",
        "Vividness earns attention, not automatic belief.",
        "Hire NorthStar",
        SOURCE_ARTIFACT_SHA,
        *TITLES,
        *PACKETS,
    )
    missing = [item for item in required if item not in page]
    if missing:
        raise SystemExit(f"Signal Refrains required content missing: {missing}")
    route = "/idr/signal-refrains/volume-01/"
    if f'href="{route}"' not in index:
        raise SystemExit("IDR index does not discover Signal Refrains")
    if f"https://northstarprime.net{route}" not in sitemap:
        raise SystemExit("Signal Refrains is absent from sitemap.xml")
    if len(re.findall(r'<article class="song"', page)) != 9:
        raise SystemExit("Signal Refrains page must contain exactly nine song articles")
    if re.search(r"file://|[A-Z]:\\|localhost|127\.0\.0\.1", page, re.I):
        raise SystemExit("Signal Refrains page contains a local/private runtime reference")
    if "googletagmanager" in page.lower() or re.search(r"\banalytics\b", page.lower().replace("no analytics", "")):
        raise SystemExit("Signal Refrains page contains tracking code")
    print("PASS: Signal Refrains publishes nine complete lyrics and creative analysis")
    print("PASS: exact packet IDs, artifact hash, boundary, IDR discovery, and sitemap route are present")
    print(f"PASS: bytes={PAGE.stat().st_size} sha256={hashlib.sha256(PAGE.read_bytes()).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
