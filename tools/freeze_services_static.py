#!/usr/bin/env python3
"""Freeze the NorthStar Digital Services control-room page for GitHub Pages.

The always-on copy remains useful without a Flask process: known static mirror
routes stay on northstarprime.net, server-only routes point at the cloud app,
and the IDR dock reads a same-origin frozen metadata snapshot instead of making
a cross-origin API request that browsers would block.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit


APP_ORIGIN = "https://app.northstarprime.net"
DEFAULT_SOURCE_URL = f"{APP_ORIGIN}/services"
DEFAULT_PULSE_URL = f"{APP_ORIGIN}/api/pulse"
TRANSFORMATION_VERSION = 2


def normalize_generated_text(value: str) -> str:
    """Use stable LF endings, no trailing spaces, and one final newline."""
    lines = [line.rstrip() for line in value.splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + "\n"
PRIVATE_PACKET_PATH = "/static/idc/idc_anthology_packet_2026-06-06.json"
WITHHELD_MARKER = "#withheld-private-packet"
WITHHELD_COPY = "WITHHELD: private draft pending owner review"

# These routes are deliberately served by the always-on GitHub Pages layer.
LOCAL_MIRROR_ROUTES = {
    "/",
    "/idc-programming",
    "/continuity-atlas",
    "/arcade",
    "/idr",
    "/contact",
    "/services",
}

ATTR_RE = re.compile(
    r"(?P<prefix>\b(?:href|src|action)\s*=\s*['\"])(?P<url>/[^'\"]*)",
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(r"(?P<prefix>url\(\s*['\"]?)(?P<url>/[^)'\"]+)", re.IGNORECASE)
PULSE_FETCH_RE = re.compile(r"fetch\(\s*(['\"])/api/pulse\1\s*\)")
PRIVATE_PACKET_LINK_RE = re.compile(
    rf"<a(?P<before>[^>]*?)href=['\"]{re.escape(PRIVATE_PACKET_PATH)}['\"]"
    r"(?P<after>[^>]*)>(?P<body>.*?)</a>",
    re.IGNORECASE | re.DOTALL,
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "NorthStarPrime-AlwaysOn-Freezer/1.0",
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"GET {url} returned HTTP {response.status}")
        return response.read()


def normalize_route(path: str) -> str:
    if path != "/":
        path = path.rstrip("/")
    return path or "/"


def local_file_exists(repo_root: Path, url: str) -> bool:
    path = urlsplit(url).path
    if not path.startswith("/") or path.startswith("//"):
        return False
    candidate = (repo_root / path.lstrip("/")).resolve()
    try:
        candidate.relative_to(repo_root.resolve())
    except ValueError:
        return False
    return candidate.is_file()


def classify_root_reference(repo_root: Path, url: str) -> tuple[str, str]:
    if url.startswith("//"):
        return url, "protocol_relative_unchanged"
    parsed = urlsplit(url)
    route = normalize_route(parsed.path)
    if route in LOCAL_MIRROR_ROUTES:
        return url, "always_on_route"
    if local_file_exists(repo_root, url):
        return url, "always_on_asset"
    return APP_ORIGIN + url, "cloud_app_route"


def rewrite_html(repo_root: Path, source: str) -> tuple[str, Counter[str]]:
    required = (
        "<title>NorthStar Digital Services — NorthStar Prime</title>",
        '<link rel="canonical" href="https://northstarprime.net/services">',
        "NorthStar Digital Services",
    )
    for marker in required:
        if marker not in source:
            raise RuntimeError(f"source guard failed; missing marker: {marker}")

    counts: Counter[str] = Counter()

    def rewrite_attribute(match: re.Match[str]) -> str:
        old_url = match.group("url")
        new_url, reason = classify_root_reference(repo_root, old_url)
        counts[reason] += 1
        if new_url != old_url:
            counts["attribute_rewrites"] += 1
        return match.group("prefix") + new_url

    def rewrite_css_url(match: re.Match[str]) -> str:
        old_url = match.group("url")
        new_url, reason = classify_root_reference(repo_root, old_url)
        counts[f"css_{reason}"] += 1
        if new_url != old_url:
            counts["css_rewrites"] += 1
        return match.group("prefix") + new_url

    def withhold_private_packet(match: re.Match[str]) -> str:
        body = match.group("body")
        body = body.replace("Packet &rarr;", WITHHELD_COPY)
        body = body.replace(PRIVATE_PACKET_PATH, WITHHELD_COPY)
        body = re.sub(
            r'(<div\s+style="font-family:monospace;color:)#06d6a0(">\s*)200(\s*</div>)',
            r"\1#f5c542\2WITHHELD\3",
            body,
            count=1,
            flags=re.IGNORECASE,
        )
        if body.count(WITHHELD_COPY) != 1:
            raise RuntimeError(
                "private packet withholding did not produce exactly one visible notice per link"
            )
        return (
            "<a"
            + match.group("before")
            + f'href="{WITHHELD_MARKER}" aria-disabled="true" tabindex="-1" '
            + 'data-withheld-private-packet="true"'
            + match.group("after")
            + ">"
            + body
            + "</a>"
        )

    output, withheld_count = PRIVATE_PACKET_LINK_RE.subn(withhold_private_packet, source)
    if withheld_count != 2:
        raise RuntimeError(
            f"expected exactly two private packet links to withhold, found {withheld_count}"
        )
    if PRIVATE_PACKET_PATH in output:
        raise RuntimeError("private packet path remained after withholding")
    counts["private_packet_withholds"] = withheld_count

    output = ATTR_RE.sub(rewrite_attribute, output)
    output = CSS_URL_RE.sub(rewrite_css_url, output)
    output, pulse_rewrites = PULSE_FETCH_RE.subn(
        "fetch('./idr_now_playing_snapshot.json')", output
    )
    if pulse_rewrites != 1:
        raise RuntimeError(
            f"expected exactly one /api/pulse fetch, found {pulse_rewrites}"
        )
    counts["pulse_fetch_rewrites"] = pulse_rewrites

    banner = """
  <aside id="nsp-always-on-services-note" role="status" style="max-width:980px;margin:.75rem auto 1.1rem;padding:.72rem 1rem;border:1px solid rgba(34,211,238,.32);border-radius:10px;background:rgba(4,12,22,.88);color:#bdeffc;font-size:.76rem;line-height:1.5">
    <strong style="color:#f5c542;letter-spacing:.08em">ALWAYS-ON SERVICE INDEX</strong>
    &nbsp;This catalog stays available continuously. Operational controls and live JSON routes open on the NorthStar cloud application; the radio dock uses a verified static metadata snapshot.
  </aside>
"""
    nav_close = "  </nav>"
    if output.count(nav_close) < 1:
        raise RuntimeError("source guard failed; top navigation closing tag not found")
    output = output.replace(nav_close, nav_close + banner, 1)
    counts["status_banner_insertions"] = 1

    mobile_guard = """
<style id="nsp-services-mobile-guard">
@media (max-width:768px){
  .hero-grid,.hero-grid[style]{grid-template-columns:minmax(0,1fr)!important}
  .hero-grid>*,.hero-feature{min-width:0!important;max-width:100%}
}
[data-withheld-private-packet="true"]{pointer-events:none!important;cursor:not-allowed!important}
</style>
"""
    if output.count("</head>") != 1:
        raise RuntimeError("source guard failed; expected exactly one closing head tag")
    output = output.replace("</head>", mobile_guard + "</head>", 1)
    counts["mobile_guard_insertions"] = 1
    return output, counts


def canonicalize_pulse(raw: bytes) -> tuple[bytes, dict]:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"pulse snapshot was not valid UTF-8 JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("pulse snapshot must be a JSON object")
    now_playing = payload.get("now_playing")
    if not isinstance(now_playing, dict):
        raise RuntimeError("pulse snapshot must contain a now_playing object")
    for key in ("file", "title", "channel", "offset"):
        if key not in now_playing:
            raise RuntimeError(f"pulse now_playing missing required key: {key}")
    file_value = now_playing.get("file")
    if not isinstance(file_value, str) or not file_value or ".." in file_value:
        raise RuntimeError("pulse now_playing.file is empty or unsafe")
    canonical = (
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    return canonical, payload


def build_provenance(manifest: dict) -> str:
    counts = manifest["rewrite_counts"]
    return f"""# Services Always-On Freeze Provenance

- Source: `{manifest['source_url']}`
- Pulse snapshot source: `{manifest['pulse_source_url']}`
- Frozen at (UTC): `{manifest['frozen_at_utc']}`
- Transformation version: `{manifest['transformation_version']}`
- Source HTML SHA-256: `{manifest['source_html_sha256']}`
- Frozen HTML SHA-256: `{manifest['frozen_html_sha256']}`
- Pulse snapshot SHA-256: `{manifest['pulse_snapshot_sha256']}`
- Cloud-app attribute rewrites: `{counts.get('attribute_rewrites', 0)}`
- Cloud-app CSS rewrites: `{counts.get('css_rewrites', 0)}`
- Same-origin pulse rewrites: `{counts.get('pulse_fetch_rewrites', 0)}`
- Private packet links withheld: `{counts.get('private_packet_withholds', 0)}`

## Routing contract

The route is a static GitHub Pages mirror. Known always-on routes and assets stay
root-relative on `northstarprime.net`. Routes that require Flask, API state,
member state, previews, or checkout logic are rewritten to
`https://app.northstarprime.net`. The IDR dock reads
`/services/idr_now_playing_snapshot.json`; audio itself remains on the dedicated
NorthStar asset host. No DNS, payment, account, or submission state is changed by
this freeze. The private IDC anthology JSON is intentionally not linked or
published; both source references are replaced with a disabled owner-review
notice.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument("--pulse-url", default=DEFAULT_PULSE_URL)
    parser.add_argument("--source-html", type=Path)
    parser.add_argument("--pulse-json", type=Path)
    parser.add_argument("--repo-root", type=Path)
    args = parser.parse_args()

    repo_root = (args.repo_root or Path(__file__).resolve().parents[1]).resolve()
    source_bytes = (
        args.source_html.read_bytes() if args.source_html else fetch_bytes(args.source_url)
    )
    pulse_bytes = (
        args.pulse_json.read_bytes() if args.pulse_json else fetch_bytes(args.pulse_url)
    )
    try:
        source = source_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RuntimeError(f"services source was not valid UTF-8: {exc}") from exc

    frozen_html, counts = rewrite_html(repo_root, source)
    frozen_html = normalize_generated_text(frozen_html)
    frozen_bytes = frozen_html.encode("utf-8")
    pulse_canonical, pulse_payload = canonicalize_pulse(pulse_bytes)

    services_dir = repo_root / "services"
    services_dir.mkdir(parents=True, exist_ok=True)
    (services_dir / "index.html").write_bytes(frozen_bytes)
    (services_dir / "idr_now_playing_snapshot.json").write_bytes(pulse_canonical)

    manifest = {
        "schema": "northstar.services-static-freeze.v1",
        "transformation_version": TRANSFORMATION_VERSION,
        "frozen_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_url": args.source_url,
        "pulse_source_url": args.pulse_url,
        "source_html_sha256": sha256_bytes(source_bytes),
        "source_html_bytes": len(source_bytes),
        "frozen_html_sha256": sha256_bytes(frozen_bytes),
        "frozen_html_bytes": len(frozen_bytes),
        "pulse_snapshot_sha256": sha256_bytes(pulse_canonical),
        "pulse_snapshot_bytes": len(pulse_canonical),
        "pulse_audio_file": pulse_payload["now_playing"]["file"],
        "rewrite_counts": dict(sorted(counts.items())),
        "local_mirror_routes": sorted(LOCAL_MIRROR_ROUTES),
        "cloud_app_origin": APP_ORIGIN,
        "runtime_api_dependencies": [],
    }
    manifest_bytes = (
        json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    ).encode("utf-8")
    (repo_root / "SERVICES_FREEZE_MANIFEST.json").write_bytes(manifest_bytes)
    (repo_root / "SERVICES_ROUTE_PROVENANCE.md").write_text(
        build_provenance(manifest), encoding="utf-8", newline="\n"
    )

    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
