#!/usr/bin/env python3
"""Fail-closed static checks for the public Dream Court collection."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "dream-court" / "index.html"
CASE_002 = ROOT / "dream-court" / "case-002" / "index.html"
CASE_003 = ROOT / "dream-court" / "case-003" / "index.html"
CASE_004 = ROOT / "dream-court" / "case-004" / "index.html"
SITEMAP = ROOT / "sitemap.xml"
CASE_002_SOURCE_SHA = "86F7EAC8C339E78307D388B5DDB56494AE8A154D53405FE6E9DD843AC59F5BD3"
CASE_002_PUBLIC_COPY_SHA = "63CBCA1D999C40DC30E3E2EB253705EABDF9D67DB6226A52705252F54761DCC1"
CASE_003_SOURCE_SHA = "6C9ADD8C2879E1D37F352B924B16223C5DFE7BAB713314A7B0AC0A2B0EEB467D"
CASE_003_PUBLIC_COPY_SHA = "CBAEF10B9AB2B1E7D62FFA4CB3F3D9D02E2B7A38C210ED31CCD4BF3122788ADC"
CASE_003_ANALYSIS_SHA = "E5C4D06964F677365D97AA467F15C38B29D304100C88009EDD443E5BAFA699FD"
CASE_004_SOURCE_SHA = "9FD53B304E195176CEADF750A0AC9CD20BDF2D5D71E644BCDF657DF2AE49575E"
CASE_004_PUBLIC_COPY_SHA = "9EF791AFED8AE5686148EEC1C614D287AACC53BF7AF234DCABA0901770C70A21"
CASE_004_ANALYSIS_SHA = "EC282FBB54ECD1F4429683B7D029F416746D4C53DA229CC32291D78AD7A3EDBD"


def main() -> int:
    index = INDEX.read_text(encoding="utf-8")
    case_002 = CASE_002.read_text(encoding="utf-8")
    case_003 = CASE_003.read_text(encoding="utf-8")
    case_004 = CASE_004.read_text(encoding="utf-8")
    sitemap = SITEMAP.read_text(encoding="utf-8")

    required_index = (
        'href="/dream-court/case-002/"',
        "In re: The Archive of Cold Breath",
        "Docket DC-002",
        'href="/dream-court/case-003/"',
        "In re: The Accelerating Midway",
        "Docket DC-003",
        'href="/dream-court/case-004/"',
        "In re: The Building That Filed First",
        "Docket DC-004",
    )
    required_case_002 = (
        '<link rel="canonical" href="https://northstarprime.net/dream-court/case-002/">',
        "NO RELIEF MAY ALSO BE REQUESTED.",
        "So ordered.",
        CASE_002_SOURCE_SHA,
        CASE_002_PUBLIC_COPY_SHA,
        "not medical interpretation, diagnosis, prediction, mind-reading, shared-dream evidence, or supernatural claim",
    )
    required_case_003 = (
        '<link rel="canonical" href="https://northstarprime.net/dream-court/case-003/">',
        "DISEMBARK WITHOUT CONCLUSION.",
        "VALID FOR ONE EXIT.",
        "Case Notes 003",
        CASE_003_SOURCE_SHA,
        CASE_003_PUBLIC_COPY_SHA,
        CASE_003_ANALYSIS_SHA,
        "not medical or psychological interpretation, diagnosis, prediction, mind-reading, shared-dream evidence, or supernatural claim",
    )
    required_case_004 = (
        '<link rel="canonical" href="https://northstarprime.net/dream-court/case-004/">',
        "PLACE RELEVANT; NO OCCUPANT INFERRED.",
        "OBSERVATION DOES NOT CREATE TENANCY.",
        "Case Notes 004",
        CASE_004_SOURCE_SHA,
        CASE_004_PUBLIC_COPY_SHA,
        CASE_004_ANALYSIS_SHA,
        "not medical or psychological interpretation, diagnosis, prediction, mind-reading, shared-dream evidence, legal advice, or supernatural claim",
    )
    missing = [item for item in required_index if item not in index]
    missing += [item for item in required_case_002 if item not in case_002]
    missing += [item for item in required_case_003 if item not in case_003]
    missing += [item for item in required_case_004 if item not in case_004]
    if missing:
        raise SystemExit(f"Dream Court required content missing: {missing}")
    if "https://northstarprime.net/dream-court/case-002/" not in sitemap:
        raise SystemExit("Dream Court Case 002 is absent from sitemap.xml")
    if "https://northstarprime.net/dream-court/case-003/" not in sitemap:
        raise SystemExit("Dream Court Case 003 is absent from sitemap.xml")
    if "https://northstarprime.net/dream-court/case-004/" not in sitemap:
        raise SystemExit("Dream Court Case 004 is absent from sitemap.xml")
    if re.search(r"file://|[A-Z]:\\|localhost|127\.0\.0\.1", index + case_002 + case_003 + case_004, re.I):
        raise SystemExit("Dream Court pages contain a local/private runtime reference")
    if case_002.count("The ice crystals in the air coalesce") != 1:
        raise SystemExit("The Case 002 source exhibit must appear exactly once")
    if case_003.count("The Ferris wheel spins ever faster now") != 1:
        raise SystemExit("The Case 003 source exhibit must appear exactly once")
    if case_004.count("The buildings in NorthStar Prime are not just mere structures") != 1:
        raise SystemExit("The Case 004 source exhibit must appear exactly once")
    if "analytics" in (case_002 + case_003 + case_004).lower() or "googletagmanager" in (case_002 + case_003 + case_004).lower():
        raise SystemExit("Dream Court page contains tracking code")

    print("PASS: Dream Court index discovers Public Case Files 002, 003, and 004")
    print("PASS: exact source exhibits, hashes, creative-analysis hash, and fiction boundaries are present")
    print(f"PASS: Case 002 bytes={CASE_002.stat().st_size} sha256={hashlib.sha256(CASE_002.read_bytes()).hexdigest().upper()}")
    print(f"PASS: Case 003 bytes={CASE_003.stat().st_size} sha256={hashlib.sha256(CASE_003.read_bytes()).hexdigest().upper()}")
    print(f"PASS: Case 004 bytes={CASE_004.stat().st_size} sha256={hashlib.sha256(CASE_004.read_bytes()).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
