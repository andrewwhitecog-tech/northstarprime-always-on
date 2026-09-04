#!/usr/bin/env python3
"""Verify the tracker-free NorthStar Prime links directory."""

from __future__ import annotations

import argparse
import json
import re
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "links" / "index.html"
HOME = ROOT / "index.html"
EXPECTED = (
    "https://www.tiktok.com/@northstarprimenet",
    "https://www.youtube.com/@northstarprimenet",
    "https://www.instagram.com/northstarprimenet/",
    "https://www.reddit.com/user/WarthogWinter3798/",
    "https://www.moltbook.com/u/GoochMane",
)
LOCAL_ROUTES = (
    "/",
    "/idc-programming/",
    "/arcade/",
    "/idr/",
    "/contact/",
)
CANONICAL_SERVICE_LINK = "https://app.northstarprime.net/services?utm_source=northstarprime.net&amp;utm_medium=owned_directory&amp;utm_campaign=services_visibility"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()

    html = PAGE.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")
    if "<title>Signal Directory — NorthStar Prime</title>" not in html:
        raise SystemExit("Links page title is missing or changed")
    if 'href="https://northstarprime.net/links/"' not in html:
        raise SystemExit("Canonical links URL is missing")
    if re.search(r"file://|[A-Z]:\\|localhost|127\.0\.0\.1", html, re.I):
        raise SystemExit("Links page contains a private/local runtime reference")
    if re.search(r"<script[^>]+src=", html, re.I):
        raise SystemExit("Links page unexpectedly depends on a remote runtime script")
    if re.search(
        r"<link(?=[^>]+rel=['\"](?:stylesheet|preload|modulepreload)['\"])(?=[^>]+href=['\"]https?://)[^>]*>",
        html,
        re.I,
    ):
        raise SystemExit("Links page unexpectedly depends on a remote runtime asset")
    if "analytics" in html.lower() or "googletagmanager" in html.lower():
        raise SystemExit("Links page contains an analytics/tracking marker")
    if 'href="/links/"' not in home:
        raise SystemExit("Homepage does not expose /links/")

    missing = [value for value in (*EXPECTED, *LOCAL_ROUTES) if f'href="{value}"' not in html]
    if missing:
        raise SystemExit(f"Missing expected link targets: {missing}")
    if f'href="{CANONICAL_SERVICE_LINK}"' not in html:
        raise SystemExit("Links page does not expose the campaign-tagged canonical service studio")

    match = re.search(
        r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
        html,
        re.I | re.S,
    )
    if not match:
        raise SystemExit("Organization JSON-LD is missing")
    payload = json.loads(match.group(1))
    if payload.get("url") != "https://northstarprime.net/":
        raise SystemExit("JSON-LD canonical organization URL is wrong")
    if tuple(payload.get("sameAs", ())) != EXPECTED:
        raise SystemExit("JSON-LD social profile list does not match visible links")

    if args.network:
        for url in EXPECTED:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 NSP mirror verifier"})
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    if response.status >= 400:
                        raise SystemExit(f"Profile returned HTTP {response.status}: {url}")
            except urllib.error.HTTPError as exc:
                raise SystemExit(f"Profile returned HTTP {exc.code}: {url}") from exc

    print("OK: links directory is self-contained and tracker-free")
    print(f"OK: {len(EXPECTED)} verified profile targets, {len(LOCAL_ROUTES)} local routes, and canonical services")
    print("OK: homepage discoverability and Organization JSON-LD")


if __name__ == "__main__":
    main()
