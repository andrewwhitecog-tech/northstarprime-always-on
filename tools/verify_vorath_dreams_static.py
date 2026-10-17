#!/usr/bin/env python3
"""Verify the public VORATH Dreams collection and its discovery surfaces."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "gallery" / "vorath-dreams" / "index.html"


def main() -> None:
    html = PAGE.read_text(encoding="utf-8")
    required = (
        "VORATH Dreams — Original Concept Art",
        'rel="canonical" href="https://northstarprime.net/gallery/vorath-dreams/"',
        "22 original works",
        "AI-assisted concept art",
        "Rights reviewed",
        "Commission NorthStar",
        "utm_campaign=vorath_dreams_release",
    )
    missing = [marker for marker in required if marker.lower() not in html.lower()]
    if missing:
        raise SystemExit(f"VORATH Dreams page missing markers: {missing}")

    forbidden = ("file://", "127.0.0.1", "localhost", "C:\\Users", "C:\\tmp", "packet_id")
    found = [marker for marker in forbidden if marker.lower() in html.lower()]
    if found:
        raise SystemExit(f"VORATH Dreams page leaks local-only markers: {found}")

    sources = re.findall(r'<img[^>]+src="(assets/[^"]+\.webp)"', html)
    if len(sources) != 22 or len(set(sources)) != 22:
        raise SystemExit(f"Expected 22 unique gallery images, found {len(sources)} / {len(set(sources))} unique")
    for source in sources:
        path = PAGE.parent / source
        if not path.is_file() or path.stat().st_size < 100_000:
            raise SystemExit(f"Missing or undersized gallery image: {source}")
        header = path.read_bytes()[:12]
        if not (header[:4] == b"RIFF" and header[8:12] == b"WEBP"):
            raise SystemExit(f"Invalid WebP delivery asset: {source}")

    portfolio = (ROOT / "portfolio" / "index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if "/gallery/vorath-dreams/" not in portfolio or "/gallery/vorath-dreams/" not in sitemap:
        raise SystemExit("VORATH Dreams is not discoverable from both portfolio and sitemap")
    if (PAGE.parent / "assets" / "assets.manifest.json").exists():
        raise SystemExit("Private source manifest must not be included in the public gallery")

    total = sum((PAGE.parent / source).stat().st_size for source in sources)
    print(f"OK: 22-image VORATH Dreams gallery; {total} delivery bytes; discovery and privacy checks pass")


if __name__ == "__main__":
    main()
