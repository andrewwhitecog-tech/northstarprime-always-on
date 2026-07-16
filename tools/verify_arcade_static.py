#!/usr/bin/env python3
"""Zero-dependency integrity and hygiene verifier for the static arcade mirror."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "ARCADE_FREEZE_MANIFEST.json"
SCHEMA = "nsp.always-on-arcade-freeze.v1"
MAX_FILE = 95 * 1024 * 1024
MOTION_PREFIX = "static/games/imagegen_quality_pass_20260625/"
MOTION_RECIPE = "ffmpeg-libx264-crf25-medium-yuv420p-faststart-noaudio-v1"
LORE_CORPUS_PATH = "static/idg/future_teller_world_lore_corpus_2026.json"
LORE_RECIPE = "json-private-provenance-redaction-v1"
TEXT_SUFFIXES = {".html", ".js", ".json", ".svg", ".md", ".css", ".txt"}
LOCAL_LEAK = re.compile(
    r"(?:file:///?)?[A-Za-z]:[\\/](?:Users|Documents|Desktop|tmp|Windows)(?:[\\/]|\b)",
    re.I,
)
LOCALHOST = re.compile(r"https?://(?:127\.0\.0\.1|localhost)(?::\d+)?", re.I)
EXTERNAL_RESOURCE = re.compile(
    r"(?:<(?:script|img|video|audio|source)\b[^>]*(?:src|poster)=['\"]https?://"
    r"|<link\b[^>]*rel=['\"](?:stylesheet|manifest|icon|preload)['\"][^>]*href=['\"]https?://"
    r"|url\(\s*['\"]?https?://|@import\s+(?:url\()?\s*['\"]?https?://)", re.I)
ABSOLUTE_URL = re.compile(r"https?://[^'\"\s<>]+", re.I)
STATIC_TOKEN = re.compile(r"/static/[A-Za-z0-9_./%+@-]+")
LOCAL_CUSTOM = re.compile(r"(?<![A-Za-z0-9.])(?P<route>/arcade/custom/(?P<slug>[a-z0-9-]+))")


def verified_manifest_bytes(path: Path, row: dict[str, object]) -> int | None:
    """Accept raw bytes or Git's canonical LF form for tracked text files."""
    expected_bytes = int(row["bytes"] if "bytes" in row else row["output_bytes"])
    expected_hash = str(row["sha256"] if "sha256" in row else row["output_sha256"])
    raw = path.read_bytes()
    candidates = (
        (raw, raw.replace(b"\r\n", b"\n"))
        if path.suffix.lower() in TEXT_SUFFIXES
        else (raw,)
    )
    for payload in candidates:
        if len(payload) == expected_bytes and hashlib.sha256(payload).hexdigest() == expected_hash:
            return expected_bytes
    return None


def check_row(row: dict[str, object], label: str) -> Path:
    path = ROOT / str(row["relative_path"] if "relative_path" in row else row["output_relative"])
    if not path.is_file():
        raise SystemExit(f"Missing {label}: {path.relative_to(ROOT)}")
    if verified_manifest_bytes(path, row) is None:
        raise SystemExit(f"Canonical size/hash mismatch for {label}: {path.relative_to(ROOT)}")
    if path.stat().st_size > MAX_FILE:
        raise SystemExit(f"Git-hosting file limit exceeded: {path.relative_to(ROOT)}")
    return path


def assert_static_tokens_resolve(html: str, label: str) -> None:
    scrubbed = ABSOLUTE_URL.sub("", html)
    for match in STATIC_TOKEN.finditer(scrubbed):
        token = match.group(0).rstrip(".,;:)")
        candidate = ROOT / token.lstrip("/")
        if candidate.is_file() or candidate.is_dir():
            continue
        if candidate.parent.is_dir() and list(candidate.parent.glob(candidate.name + "*")):
            continue
        raise SystemExit(f"Dangling static reference in {label}: {token}")


def main() -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if payload.get("schema") != SCHEMA:
        raise SystemExit("Unexpected arcade-freeze schema")
    games = payload.get("games", [])
    delegated = payload.get("delegated_routes", [])
    assets = payload.get("assets", [])
    if payload.get("catalog_game_count") != len(games) + len(delegated):
        raise SystemExit("Catalog disposition count mismatch")
    if payload.get("mirrored_game_count") != len(games):
        raise SystemExit("Mirrored game count mismatch")
    if payload.get("delegated_game_count") != len(delegated):
        raise SystemExit("Delegated game count mismatch")
    if payload.get("asset_count") != len(assets):
        raise SystemExit("Asset count mismatch")

    landing_row = payload["landing"]
    landing_path = check_row(landing_row, "arcade landing")
    catalog_row = payload["catalog"]
    catalog_path = check_row(catalog_row, "arcade catalog")
    public_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if public_catalog.get("count") != payload.get("catalog_game_count"):
        raise SystemExit("Frozen public catalog count mismatch")

    mirrored = {str(row["slug"]) for row in games}
    delegated_slugs = {str(row["slug"]) for row in delegated}
    if mirrored & delegated_slugs:
        raise SystemExit("A route is both mirrored and delegated")
    all_html = [("arcade landing", landing_path)]
    for row in games:
        path = check_row(row, f"game {row['slug']}")
        all_html.append((f"game {row['slug']}", path))

    for label, path in all_html:
        html = path.read_text(encoding="utf-8")
        if LOCAL_LEAK.search(html) or LOCALHOST.search(html):
            raise SystemExit(f"Local machine leakage in {label}")
        if EXTERNAL_RESOURCE.search(html):
            raise SystemExit(f"Remote CDN/resource dependency in {label}")
        assert_static_tokens_resolve(html, label)
        for match in LOCAL_CUSTOM.finditer(ABSOLUTE_URL.sub("", html)):
            if match.group("slug") not in mirrored:
                raise SystemExit(f"Unmirrored local route in {label}: {match.group('route')}")

    landing = landing_path.read_text(encoding="utf-8")
    if "<title>Super Arcade — NorthStar Prime</title>" not in landing or len(landing) < 100_000:
        raise SystemExit("Landing is not the full arcade catalog")
    catalog_routes = {str(row.get("route", "")) for row in public_catalog.get("games", [])}
    for row in games:
        if str(row["route"]) not in catalog_routes:
            raise SystemExit(f"Mirrored route is absent from frozen catalog: {row['route']}")
    for row in delegated:
        if str(row["fallback_url"]) not in landing:
            raise SystemExit(f"Delegated route lacks explicit fallback: {row['route']}")

    total = 0
    source_total = 0
    optimized = 0
    optimized_saved = 0
    redacted = 0
    for row in assets:
        path = check_row(row, f"asset {row['relative_path']}")
        total += int(row["bytes"])
        source_total += int(row.get("source_bytes", row["bytes"]))
        transform = str(row.get("transform", "copy"))
        if transform != "copy":
            if transform == MOTION_RECIPE:
                optimized += 1
                optimized_saved += int(row.get("source_bytes", 0)) - int(row["bytes"])
                if (
                    not str(row["relative_path"]).startswith(MOTION_PREFIX)
                    or not str(row["relative_path"]).endswith(".mp4")
                    or int(row.get("source_bytes", 0)) <= int(row["bytes"])
                    or not re.fullmatch(r"[0-9a-f]{64}", str(row.get("source_sha256", "")))
                ):
                    raise SystemExit(f"Unsafe arcade motion transform: {row['relative_path']}")
            elif transform == LORE_RECIPE:
                redacted += 1
                if str(row["relative_path"]) != LORE_CORPUS_PATH:
                    raise SystemExit("Lore redaction was applied to an unexpected asset")
                lore = json.loads(path.read_text(encoding="utf-8"))
                if (
                    lore.get("source_workspace") != "private-source-withheld"
                    or "public_provenance_note" not in lore
                    or LOCAL_LEAK.search(path.read_text(encoding="utf-8"))
                ):
                    raise SystemExit("Future Teller lore corpus was not safely redacted")
            else:
                raise SystemExit(f"Unknown arcade asset transform: {row['relative_path']}")
        if path.suffix.lower() in {".json", ".html", ".js", ".css", ".md", ".txt"}:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                text = ""
            if LOCAL_LEAK.search(text):
                raise SystemExit(f"Published text asset leaks a local path: {row['relative_path']}")
    if total != payload.get("asset_bytes"):
        raise SystemExit("Asset byte total mismatch")
    if source_total != payload.get("source_asset_bytes"):
        raise SystemExit("Source asset byte total mismatch")
    if optimized != payload.get("optimized_asset_count"):
        raise SystemExit("Optimized asset count mismatch")
    if optimized_saved != payload.get("optimized_asset_bytes_saved"):
        raise SystemExit("Optimized asset savings mismatch")
    if redacted != payload.get("redacted_asset_count"):
        raise SystemExit("Redacted asset count mismatch")

    provenance = (ROOT / "ARCADE_ROUTE_PROVENANCE.md").read_text(encoding="utf-8")
    if LOCAL_LEAK.search(provenance) or LOCALHOST.search(provenance):
        raise SystemExit("Route provenance leaks a local machine path")
    print(f"OK: {len(games)} mirrored games / {len(delegated)} explicit fallbacks")
    print(f"OK: {len(assets)} hashed assets / {total} bytes")
    print(f"OK: {optimized} local motion optimizations / {optimized_saved} bytes saved")
    print(f"OK: {redacted} public provenance redactions")
    print("OK: no local filesystem leakage, dangling static refs, or remote CDN resources")
    print("OK: every catalog route has exactly one static-or-dynamic disposition")


if __name__ == "__main__":
    main()
