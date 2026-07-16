#!/usr/bin/env python3
"""Fail-closed verification for the always-on NorthStar services mirror."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path
from urllib.parse import quote, urlsplit


EXPECTED_SCHEMA = "northstar.services-static-freeze.v1"
EXPECTED_TRANSFORMATION_VERSION = 2
APP_ORIGIN = "https://app.northstarprime.net"
ASSET_ORIGIN = "https://assets.northstarprime.net/idr_audio"
PRIVATE_PACKET_PATH = "/static/idc/idc_anthology_packet_2026-06-06.json"
WITHHELD_MARKER = 'href="#withheld-private-packet"'
WITHHELD_COPY = "WITHHELD: private draft pending owner review"
ROUTE_FILES = {
    "/": "index.html",
    "/idc-programming": "idc-programming/index.html",
    "/continuity-atlas": "continuity-atlas/index.html",
    "/arcade": "arcade/index.html",
    "/idr": "idr/index.html",
    "/contact": "contact/index.html",
    "/services": "services/index.html",
}
ROOT_REF_RE = re.compile(
    r"\b(?:href|src|action)\s*=\s*['\"](?P<url>/[^'\"]*)|"
    r"url\(\s*['\"]?(?P<css>/[^)'\"]+)",
    re.IGNORECASE,
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def normalize_route(path: str) -> str:
    if path != "/":
        path = path.rstrip("/")
    return path or "/"


def safe_local_file(repo_root: Path, url: str) -> Path | None:
    path = urlsplit(url).path
    if not path.startswith("/") or path.startswith("//"):
        return None
    candidate = (repo_root / path.lstrip("/")).resolve()
    try:
        candidate.relative_to(repo_root.resolve())
    except ValueError:
        return None
    return candidate


def get_status(url: str, *, method: str = "GET") -> int:
    request = urllib.request.Request(
        url,
        method=method,
        headers={"User-Agent": "NorthStarPrime-Services-Verifier/1.0"},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        response.read(4096) if method == "GET" else None
        return response.status


def verify(repo_root: Path, network: bool) -> dict:
    failures: list[str] = []
    checks: list[str] = []
    manifest_path = repo_root / "SERVICES_FREEZE_MANIFEST.json"
    html_path = repo_root / "services" / "index.html"
    pulse_path = repo_root / "services" / "idr_now_playing_snapshot.json"
    provenance_path = repo_root / "SERVICES_ROUTE_PROVENANCE.md"

    for path in (manifest_path, html_path, pulse_path, provenance_path):
        if not path.is_file():
            failures.append(f"missing required file: {path.relative_to(repo_root)}")
    if failures:
        return {"status": "FAIL", "checks": checks, "failures": failures}

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:  # fail closed on malformed evidence
        return {
            "status": "FAIL",
            "checks": checks,
            "failures": [f"manifest parse failed: {exc}"],
        }
    if manifest.get("schema") != EXPECTED_SCHEMA:
        failures.append(f"unexpected manifest schema: {manifest.get('schema')!r}")
    else:
        checks.append("manifest schema")
    if manifest.get("transformation_version") != EXPECTED_TRANSFORMATION_VERSION:
        failures.append(
            "unexpected transformation version: "
            f"{manifest.get('transformation_version')!r}"
        )
    else:
        checks.append("transformation version 2")

    html_hash = sha256_file(html_path)
    pulse_hash = sha256_file(pulse_path)
    if html_hash != manifest.get("frozen_html_sha256"):
        failures.append("frozen HTML hash does not match manifest")
    else:
        checks.append("frozen HTML SHA-256")
    if pulse_hash != manifest.get("pulse_snapshot_sha256"):
        failures.append("pulse snapshot hash does not match manifest")
    else:
        checks.append("pulse snapshot SHA-256")

    html = html_path.read_text(encoding="utf-8")
    required_markers = (
        "NorthStar Digital Services — NorthStar Prime",
        '<link rel="canonical" href="https://northstarprime.net/services">',
        'id="nsp-always-on-services-note"',
        "fetch('./idr_now_playing_snapshot.json')",
        "TikTok @northstarprimenet",
        "YouTube @northstarprimenet",
        "Instagram @northstarprimenet",
        "Reddit u/WarthogWinter3798",
        'id="nsp-services-mobile-guard"',
        "@media (max-width:768px)",
        ".hero-grid,.hero-grid[style]{grid-template-columns:minmax(0,1fr)!important}",
        ".hero-grid>*,.hero-feature{min-width:0!important;max-width:100%}",
    )
    for marker in required_markers:
        if marker not in html:
            failures.append(f"missing required HTML marker: {marker}")
    if all(marker in html for marker in required_markers):
        checks.append("identity, canonical, disclosure, social, and pulse markers")

    forbidden = (
        "fetch('/api/pulse')",
        'fetch("/api/pulse")',
        "localhost",
        "127.0.0.1",
        "file://",
        "ngrok",
        "C:\\",
    )
    found_forbidden = [item for item in forbidden if item in html]
    windows_paths = re.findall(
        r"(?i)(?:(?<![a-z])[a-z]:[\\/]|\\\\[a-z0-9_.-]+[\\/])", html
    )
    if found_forbidden:
        failures.append(f"forbidden runtime/local references: {found_forbidden}")
    elif windows_paths:
        failures.append(f"local Windows path markers found: {windows_paths[:5]}")
    else:
        checks.append("no local-machine or cross-origin pulse dependency")

    marker_count = html.count(WITHHELD_MARKER)
    copy_count = html.count(WITHHELD_COPY)
    data_count = len(
        re.findall(
            r'<a\b[^>]*\bdata-withheld-private-packet="true"', html, re.IGNORECASE
        )
    )
    manifest_withholds = manifest.get("rewrite_counts", {}).get(
        "private_packet_withholds"
    )
    if (marker_count, copy_count, data_count, manifest_withholds) != (2, 2, 2, 2):
        failures.append(
            "private packet withholding count mismatch: "
            f"marker={marker_count}, copy={copy_count}, data={data_count}, "
            f"manifest={manifest_withholds}"
        )
    elif PRIVATE_PACKET_PATH in html:
        failures.append("private packet path remained in frozen HTML")
    else:
        checks.append("exactly two private packet links withheld with visible owner-review copy")

    root_refs: list[str] = []
    for match in ROOT_REF_RE.finditer(html):
        ref = match.group("url") or match.group("css")
        if ref:
            root_refs.append(ref)
    for ref in sorted(set(root_refs)):
        parsed = urlsplit(ref)
        route = normalize_route(parsed.path)
        if route in ROUTE_FILES:
            route_file = repo_root / ROUTE_FILES[route]
            if not route_file.is_file():
                failures.append(f"always-on route target missing for {ref}: {route_file}")
            continue
        local_file = safe_local_file(repo_root, ref)
        if local_file is None or not local_file.is_file():
            failures.append(f"unresolved root-relative reference: {ref}")
    if root_refs and not any("unresolved root-relative" in item for item in failures):
        checks.append(f"{len(set(root_refs))} unique root-relative references resolve locally")

    if re.search(r"(?:href|src|action)=['\"]/(?:api|members|payments|preview|storefront)(?:/|\?|['\"])", html):
        failures.append("server-only attribute remained root-relative")
    else:
        checks.append("server-only attributes externalized to cloud app")

    app_refs = len(re.findall(re.escape(APP_ORIGIN) + r"/", html))
    expected_rewrites = int(manifest.get("rewrite_counts", {}).get("attribute_rewrites", -1))
    css_rewrites = int(manifest.get("rewrite_counts", {}).get("css_rewrites", 0))
    if expected_rewrites < 1 or app_refs != expected_rewrites + css_rewrites:
        failures.append(
            f"cloud-app rewrite count mismatch: html={app_refs}, manifest={expected_rewrites + css_rewrites}"
        )
    else:
        checks.append(f"{app_refs} cloud-app references match manifest")

    try:
        pulse = json.loads(pulse_path.read_text(encoding="utf-8"))
        now_playing = pulse["now_playing"]
        audio_file = now_playing["file"]
        if not isinstance(audio_file, str) or not audio_file or ".." in audio_file:
            raise ValueError("unsafe now_playing.file")
        if audio_file != manifest.get("pulse_audio_file"):
            raise ValueError("pulse audio file does not match manifest")
        checks.append("pulse snapshot schema and audio path")
    except Exception as exc:
        failures.append(f"pulse snapshot validation failed: {exc}")
        audio_file = ""

    if manifest.get("runtime_api_dependencies") != []:
        failures.append("manifest must declare zero runtime API dependencies")
    else:
        checks.append("zero runtime API dependencies declared")

    network_results: dict[str, int] = {}
    if network and not failures:
        targets = {
            "cloud services page": ("https://app.northstarprime.net/services", "GET"),
            "cloud services status": ("https://app.northstarprime.net/api/services/status", "GET"),
            "IDR audio asset": (f"{ASSET_ORIGIN}/{quote(audio_file, safe='/')}", "HEAD"),
        }
        for label, (url, method) in targets.items():
            try:
                status = get_status(url, method=method)
                network_results[label] = status
                if status not in (200, 206):
                    failures.append(f"{label} returned HTTP {status}")
            except Exception as exc:
                failures.append(f"{label} network check failed: {exc}")
        if not failures:
            checks.append("cloud route/status and IDR asset network checks")

    return {
        "status": "PASS" if not failures else "FAIL",
        "checks": checks,
        "failures": failures,
        "html_sha256": html_hash,
        "pulse_sha256": pulse_hash,
        "network": network_results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()
    repo_root = (args.repo_root or Path(__file__).resolve().parents[1]).resolve()
    result = verify(repo_root, args.network)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
