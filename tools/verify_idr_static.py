#!/usr/bin/env python3
"""Fail-closed verification for the always-on IDR catalog freeze."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from urllib.parse import urlparse
from pathlib import Path


def sha256(path: Path) -> str:
    payload = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(payload).hexdigest().upper()


def check_url(url: str) -> tuple[bool, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "NSP-IDR-Verifier/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return 200 <= response.status < 400, str(response.status)
    except Exception as exc:  # pragma: no cover - diagnostic output
        return False, str(exc)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, default=Path("idr/index.html"))
    parser.add_argument("--manifest", type=Path, default=Path("IDR_FREEZE_MANIFEST.json"))
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()

    failures: list[str] = []
    html = args.html.read_text(encoding="utf-8")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))

    checks = {
        "title": "Interdimensional Radio" in html,
        "canonical": 'href="https://northstarprime.net/idr/"' in html,
        "freeze_marker": 'content="idr-v1-cloud-relay"' in html,
        "static_dock": 'id="nsp-static-idr-dock"' in html,
        "relay_notice": 'id="nsp-static-relay-notice"' in html,
        "no_localhost": not re.search(r"localhost|127\.0\.0\.1|file://", html, re.I),
        "no_windows_paths": not re.search(r"[A-Z]:\\", html),
        "no_same_origin_pulse": "fetch('/api/pulse')" not in html and 'fetch("/api/pulse")' not in html,
        "no_broken_app_covers": "https://app.northstarprime.net/static/idr_covers/" not in html,
        "no_known_broken_app_assets": (
            "https://app.northstarprime.net/static/brand/dalle3_CyberFed_Badge_perf.webp" not in html
            and "https://app.northstarprime.net/static/cards/signal_cartographer_prime/hero.svg" not in html
        ),
        "cloud_audio": len(re.findall(r'src="https://assets\.northstarprime\.net/idr_audio/', html)) >= 20,
        "track_count": manifest.get("track_count", 0) >= 20,
        "asset_count": manifest.get("externalized_asset_count", 0) >= 40,
        "hash": sha256(args.html) == manifest.get("output_sha256"),
        "schema": manifest.get("schema") == "nsp-idr-static-freeze-v1",
        "public_route": manifest.get("public_route") == "https://northstarprime.net/idr/",
        "pwa_manifest": (args.root / "site.webmanifest").is_file(),
        "favicon": (args.root / "favicon.svg").is_file(),
        "favicon_ico": (
            (args.root / "favicon.ico").is_file()
            and (args.root / "favicon.ico").read_bytes().startswith(b"\x00\x00\x01\x00")
        ),
    }
    for name, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'} {name}")
        if not passed:
            failures.append(name)

    local_hrefs = sorted(set(re.findall(r"""href=["'](/[^"'#?]*)""", html)))
    allowed = {
        "/",
        "/arcade/",
        "/contact/",
        "/continuity-atlas/",
        "/idc-programming/",
        "/idr/",
        "/favicon.svg",
        "/site.webmanifest",
    }
    bad_hrefs = [href for href in local_hrefs if href not in allowed]
    print(f"{'PASS' if not bad_hrefs else 'FAIL'} local_routes {local_hrefs}")
    if bad_hrefs:
        failures.append("local_routes")

    local_asset_paths = sorted(
        set(re.findall(r"""(?:src=["']|url\(["']?)(/static/[^"')\s]+)""", html))
    )
    missing_local_assets = []
    allowed_local_prefixes = (
        "/static/idr_covers/",
        "/static/brand/dalle3_CyberFed_Badge_perf.webp",
        "/static/cards/signal_cartographer_prime/hero.svg",
    )
    unowned_local_assets = [
        path for path in local_asset_paths if not path.startswith(allowed_local_prefixes)
    ]
    for path in local_asset_paths:
        relative = path.lstrip("/")
        if not (args.root / relative).is_file():
            missing_local_assets.append(relative)
    local_asset_pass = (
        len(local_asset_paths) >= 8
        and not missing_local_assets
        and not unowned_local_assets
    )
    print(
        f"{'PASS' if local_asset_pass else 'FAIL'} local_static_assets "
        f"count={len(local_asset_paths)} missing={missing_local_assets} "
        f"unowned={unowned_local_assets}"
    )
    if not local_asset_pass:
        failures.append("local_static_assets")

    if args.network:
        sample_urls = [
            "https://app.northstarprime.net/health",
            "https://assets.northstarprime.net/idr_audio/hiphop/weather_beyond_the_tower.mp3",
            "https://app.northstarprime.net/static/brand/nsp_vorath_wallpaper_perf.webp",
        ]
        for url in sample_urls:
            passed, detail = check_url(url)
            print(f"{'PASS' if passed else 'FAIL'} network {url} ({detail})")
            if not passed:
                failures.append("network:" + url)

    if failures:
        print("IDR STATIC VERIFICATION FAILED: " + ", ".join(failures))
        return 1
    print("IDR STATIC VERIFICATION PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
