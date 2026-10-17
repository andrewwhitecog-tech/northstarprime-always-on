#!/usr/bin/env python3
"""Fail-closed verification for the always-on services continuity bridge."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path


APP_ORIGIN = "https://app.northstarprime.net"
CANONICAL_URL = f"{APP_ORIGIN}/services"


def get_status(url: str) -> int:
    request = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": "NorthStarPrime-Services-Verifier/2.0"},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        response.read(4096)
        return response.status


def verify(repo_root: Path, network: bool) -> dict:
    failures: list[str] = []
    checks: list[str] = []
    html_path = repo_root / "services" / "index.html"
    sitemap_path = repo_root / "sitemap.xml"
    if not html_path.is_file():
        failures.append("missing services/index.html")
        return {"status": "FAIL", "checks": checks, "failures": failures}

    html = html_path.read_text(encoding="utf-8")
    required = (
        "Creative Services &amp; AI Operations | NorthStar Prime",
        f'<link rel="canonical" href="{CANONICAL_URL}">',
        f'<meta http-equiv="refresh" content="0;url={CANONICAL_URL}">',
        'content="index, follow, max-image-preview:large"',
        "/static/services/creative-services-og-v01.jpg",
        "Compare fixed-scope offers",
        "See the Failure Map",
        "Free readiness scorecard",
        "utm_campaign=services_visibility",
        'location.replace("https://app.northstarprime.net/services"+location.search+location.hash)',
    )
    missing = [marker for marker in required if marker not in html]
    if missing:
        failures.extend(f"missing bridge marker: {marker}" for marker in missing)
    else:
        checks.append("canonical, redirect, metadata, attribution, and fallback actions")

    forbidden = (
        "NSP Store &amp; Services",
        "local operations desk",
        "/api/services/status",
        "/services/handoff",
        "/services/refresh",
        "127.0.0.1",
        "localhost",
    )
    found = [marker for marker in forbidden if marker in html]
    if found:
        failures.append(f"retired internal surface leaked into bridge: {found}")
    else:
        checks.append("retired internal operations content absent")

    if sitemap_path.is_file() and "https://northstarprime.net/services/</loc>" in sitemap_path.read_text(encoding="utf-8"):
        failures.append("noncanonical apex services bridge remains in sitemap")
    else:
        checks.append("noncanonical bridge excluded from apex sitemap")

    if network:
        try:
            if get_status(CANONICAL_URL) != 200:
                failures.append("canonical application services page did not return 200")
            else:
                checks.append("canonical application services page HTTP 200")
        except Exception as exc:
            failures.append(f"network verification failed: {type(exc).__name__}: {exc}")

    return {
        "status": "FAIL" if failures else "PASS",
        "checks": checks,
        "failures": failures,
        "canonical_url": CANONICAL_URL,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()
    result = verify(Path(__file__).resolve().parents[1], args.network)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
