#!/usr/bin/env python3
"""Zero-dependency integrity and hygiene verifier for the static arcade mirror."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from verify_home_static import (
    ORIGIN, check_asset_manifest, check_identity, check_local_links,
    collect_local_assets, contained_path, read_page,
)

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
    path = contained_path(ROOT, str(row["relative_path"] if "relative_path" in row else row["output_relative"]))
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


def check_catalog_dispositions(games: list[dict], delegated: list[dict], public_catalog: dict) -> None:
    """Keep one disposition for every legacy catalog entry, including the fallback."""
    expected = games + delegated
    public = public_catalog.get("games", [])
    for label, rows in (("manifest", expected), ("public catalog", public)):
        for field in ("slug", "route"):
            values = [str(row.get(field, "")) for row in rows]
            if not all(values) or len(values) != len(set(values)):
                raise SystemExit(f"Missing or duplicate {field} in {label}")
    if public_catalog.get("count") != len(public):
        raise SystemExit("Frozen public catalog count mismatch")
    dispositions = {(row["slug"], row["route"]) for row in expected}
    catalog = {(row["slug"], row["route"]) for row in public}
    if dispositions != catalog:
        raise SystemExit("Frozen catalog and route dispositions differ")


def check_workshop_links(links: list[str], games: list[dict], delegated: list[dict]) -> None:
    # Trailing slashes are equivalent for mirrored Pages routes. Delegated URLs
    # must be the explicit fallback, never a plausible local stub.
    destinations = {link.rstrip("/") for link in links}
    for row in games:
        if str(row["route"]).rstrip("/") not in destinations:
            raise SystemExit(f"Workshop omits mirrored game: {row['route']}")
    for row in delegated:
        if str(row["fallback_url"]).rstrip("/") not in destinations:
            raise SystemExit(f"Workshop omits explicit fallback: {row['route']}")
        if str(row["route"]).rstrip("/") in destinations:
            raise SystemExit(f"Workshop disguises delegated route as local: {row['route']}")


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
    asset_paths = [row["relative_path"] for row in assets]
    if len(set(asset_paths)) != len(asset_paths):
        raise SystemExit("Duplicate arcade asset inventory entry")

    landing_row = payload["landing"]
    if landing_row["relative_path"] != "arcade/index.html":
        raise SystemExit("Arcade landing path mismatch")
    landing_path = check_row(landing_row, "arcade landing")
    workshop_row = payload["workshop"]
    if workshop_row["relative_path"] != "arcade/lab/index.html":
        raise SystemExit("Arcade workshop path mismatch")
    workshop_path = check_row(workshop_row, "arcade workshop")
    catalog_row = payload["catalog"]
    catalog_path = check_row(catalog_row, "arcade catalog")
    public_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if public_catalog.get("count") != payload.get("catalog_game_count"):
        raise SystemExit("Frozen public catalog count mismatch")
    check_catalog_dispositions(games, delegated, public_catalog)

    mirrored = {str(row["slug"]) for row in games}
    delegated_slugs = {str(row["slug"]) for row in delegated}
    if mirrored & delegated_slugs:
        raise SystemExit("A route is both mirrored and delegated")
    all_html = [("arcade landing", landing_path), ("arcade workshop", workshop_path)]
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

    landing_page = read_page(landing_path)
    workshop_page = read_page(workshop_path)
    check_identity(landing_page, "Play — NorthStar Prime", ORIGIN + "/arcade/")
    check_identity(workshop_page, "The Game Workshop — NorthStar Prime", ORIGIN + "/arcade/lab/")
    if "/arcade/lab/" not in landing_page.links or "/arcade/" not in workshop_page.links:
        raise SystemExit("Arcade/workshop navigation is incomplete")
    check_workshop_links(workshop_page.links, games, delegated)
    journey_resources = set()
    for path, page in ((landing_path, landing_page), (workshop_path, workshop_page)):
        check_local_links(ROOT, path, page)
        journey_resources.update(collect_local_assets(ROOT, path, page))
    journey_assets = payload.get("journey_assets", [])
    journey_bytes = check_asset_manifest(ROOT, journey_assets, journey_resources)
    if len(journey_assets) != payload.get("journey_asset_count") or journey_bytes != payload.get("journey_asset_bytes"):
        raise SystemExit("Arcade journey resource totals mismatch")

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
    print(f"OK: workshop navigation and {len(journey_assets)} frozen journey resources")
    print("OK: no local filesystem leakage, dangling static refs, or remote CDN resources")
    print("OK: every catalog route has exactly one static-or-dynamic disposition")


if __name__ == "__main__":
    main()
