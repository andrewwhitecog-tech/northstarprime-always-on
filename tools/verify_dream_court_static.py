#!/usr/bin/env python3
"""Fail-closed static checks for the public Dream Court collection."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "dream-court" / "index.html"
CASE = ROOT / "dream-court" / "case-002" / "index.html"
SITEMAP = ROOT / "sitemap.xml"
SOURCE_SHA = "86F7EAC8C339E78307D388B5DDB56494AE8A154D53405FE6E9DD843AC59F5BD3"
PUBLIC_COPY_SHA = "63CBCA1D999C40DC30E3E2EB253705EABDF9D67DB6226A52705252F54761DCC1"


def main() -> int:
    index = INDEX.read_text(encoding="utf-8")
    case = CASE.read_text(encoding="utf-8")
    sitemap = SITEMAP.read_text(encoding="utf-8")

    required_index = (
        'href="/dream-court/case-002/"',
        "In re: The Archive of Cold Breath",
        "Docket DC-002",
    )
    required_case = (
        '<link rel="canonical" href="https://northstarprime.net/dream-court/case-002/">',
        "NO RELIEF MAY ALSO BE REQUESTED.",
        "So ordered.",
        SOURCE_SHA,
        PUBLIC_COPY_SHA,
        "not medical interpretation, diagnosis, prediction, mind-reading, shared-dream evidence, or supernatural claim",
    )
    missing = [item for item in required_index if item not in index]
    missing += [item for item in required_case if item not in case]
    if missing:
        raise SystemExit(f"Dream Court required content missing: {missing}")
    if "https://northstarprime.net/dream-court/case-002/" not in sitemap:
        raise SystemExit("Dream Court Case 002 is absent from sitemap.xml")
    if re.search(r"file://|[A-Z]:\\|localhost|127\.0\.0\.1", index + case, re.I):
        raise SystemExit("Dream Court pages contain a local/private runtime reference")
    if case.count("The ice crystals in the air coalesce") != 1:
        raise SystemExit("The source exhibit must appear exactly once")
    if "analytics" in case.lower() or "googletagmanager" in case.lower():
        raise SystemExit("Dream Court page contains tracking code")

    print("PASS: Dream Court index discovers Public Case File 002")
    print("PASS: exact source exhibit, source hash, public-copy hash, and fiction boundary are present")
    print(f"PASS: case page bytes={CASE.stat().st_size} sha256={hashlib.sha256(CASE.read_bytes()).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
