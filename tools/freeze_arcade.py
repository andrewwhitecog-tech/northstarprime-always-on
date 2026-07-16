#!/usr/bin/env python3
"""Freeze the healthy local NSP arcade into a deterministic static mirror."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import unquote, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
NSP_REPO = ROOT.parent / "NORTHSTAR_PRIME"
WORKSHOP_ARCADE = ROOT.parents[1] / "arcade_games"
FALLBACK = "https://app.northstarprime.net"
SCHEMA = "nsp.always-on-arcade-freeze.v1"
MAX_FILE = 95 * 1024 * 1024
MOTION_TRANSCODE_MIN = 8 * 1024 * 1024
MOTION_PREFIX = Path("static/games/imagegen_quality_pass_20260625")
MOTION_RECIPE = "ffmpeg-libx264-crf25-medium-yuv420p-faststart-noaudio-v1"
LORE_CORPUS_PATH = Path("static/idg/future_teller_world_lore_corpus_2026.json")
LORE_RECIPE = "json-private-provenance-redaction-v1"
LOCAL_LEAK = re.compile(r"(?:file://|(?<![A-Za-z0-9])[A-Za-z]:[\\/])", re.I)
EXTERNAL_RESOURCE = re.compile(
    r"(?:<(?:script|img|video|audio|source)\b[^>]*(?:src|poster)=['\"]https?://"
    r"|<link\b[^>]*rel=['\"](?:stylesheet|manifest|icon|preload)['\"][^>]*href=['\"]https?://"
    r"|url\(\s*['\"]?https?://|@import\s+(?:url\()?\s*['\"]?https?://)", re.I)
QUOTED_LOCAL = re.compile(r"(?P<q>['\"])(?P<path>/[^'\"\r\n<>]*)(?P=q)")
ABSOLUTE_URL = re.compile(r"https?://[^'\"\s<>]+", re.I)
STATIC_TOKEN = re.compile(r"/static/[A-Za-z0-9_./%+@-]+")
SAFE_STATIC = re.compile(r"^/static/[A-Za-z0-9_./%+@-]+$")
ALWAYS_ON = (
    "/contact/", "/continuity-atlas/", "/founders/", "/idc-programming/",
    "/mystery-school/", "/.well-known/",
)


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest_file(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "NSP-Arcade-Freezer/1.0"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise SystemExit(f"HTTP {response.status}: {url}")
        return response.read()


def write_changed(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file() or path.read_bytes() != data:
        path.write_bytes(data)


def normalize_generated_text(value: str) -> str:
    """Use stable LF endings, no trailing spaces, and one final newline."""
    lines = [line.rstrip() for line in value.splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + "\n"


def is_large_motion_plate(relative: Path, source: Path) -> bool:
    return (
        source.suffix.lower() == ".mp4"
        and source.stat().st_size >= MOTION_TRANSCODE_MIN
        and relative.is_relative_to(MOTION_PREFIX)
    )


def transcode_motion_plate(source: Path, output: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg is required to optimize large arcade motion plates")
    temporary = output.with_name(output.stem + ".nsp-transcode.mp4")
    if temporary.exists():
        temporary.unlink()
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-map",
        "0:v:0",
        "-an",
        "-map_metadata",
        "-1",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "25",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "1",
        "-movflags",
        "+faststart",
        str(temporary),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0 or not temporary.is_file():
        temporary.unlink(missing_ok=True)
        raise SystemExit(f"ffmpeg motion optimization failed for {source.name}: {result.stderr.strip()}")
    temporary.replace(output)


def sanitize_lore_corpus(source: Path, output: Path) -> None:
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Future Teller lore corpus is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict) or "source_workspace" not in payload:
        raise SystemExit("Future Teller lore corpus is missing its provenance field")
    payload["kind"] = "Future Teller Cabinet symbolic lore corpus"
    payload["source_workspace"] = "private-source-withheld"
    payload["public_provenance_note"] = (
        "Generated from a private NorthStar source; filesystem provenance is withheld."
    )
    write_changed(
        output,
        (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
    )


def route_only(value: str) -> str:
    return value.split("#", 1)[0].split("?", 1)[0]


def rewrite_routes(html: str, mirrored: set[str]) -> tuple[str, list[str]]:
    fallbacks: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        quote, value = match.group("q"), match.group("path")
        path = route_only(value)
        if path == "/" or path in {"/arcade", "/arcade/", "/health"}:
            return match.group(0)
        if path.startswith("/static/"):
            if path.startswith("/static/idr_audio"):
                target = FALLBACK + value
                fallbacks.add(target)
                return f"{quote}{target}{quote}"
            return match.group(0)
        if any(path.startswith(prefix) for prefix in ALWAYS_ON):
            return match.group(0)
        if path.startswith("/arcade/custom/"):
            slug = path.removeprefix("/arcade/custom/").split("/", 1)[0]
            if slug in mirrored:
                return match.group(0)
        target = FALLBACK + value
        fallbacks.add(target)
        return f"{quote}{target}{quote}"

    result = QUOTED_LOCAL.sub(replace, html)
    result = re.sub(r"\s*<link\b[^>]*rel=['\"]manifest['\"][^>]*>\s*", "\n", result, flags=re.I)
    return result, sorted(fallbacks)


def tokens(text: str) -> set[str]:
    text = ABSOLUTE_URL.sub("", text)
    return {match.group(0).rstrip(".,;:)") for match in STATIC_TOKEN.finditer(text)}


def static_relative(token: str) -> Path:
    token = unquote(token).replace("\\", "/")
    if not SAFE_STATIC.fullmatch(token):
        raise SystemExit(f"Unsafe static token: {token}")
    parts = [part for part in token.lstrip("/").split("/") if part]
    if not parts or any(part in {".", ".."} for part in parts):
        raise SystemExit(f"Unsafe static path: {token}")
    return Path(*parts)


def resolve_assets(source_repo: Path, token: str) -> list[tuple[str, Path]]:
    source = source_repo / static_relative(token)
    if source.is_file():
        return [("exact", source)]
    if source.is_dir():
        return [("directory", path) for path in sorted(source.rglob("*")) if path.is_file()]
    if source.parent.is_dir() and source.name:
        matches = [path for path in sorted(source.parent.glob(source.name + "*")) if path.is_file()]
        if matches:
            return [("prefix", path) for path in matches]
    raise SystemExit(f"Missing referenced static asset or prefix: {token}")


def source_id(path: Path, roots: list[tuple[str, Path]]) -> tuple[str, str]:
    for root_id, root in roots:
        try:
            relative = path.resolve().relative_to(root.resolve())
        except ValueError:
            continue
        return root_id, relative.as_posix()
    raise SystemExit(f"Source escaped approved roots: {path.name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-base", default="http://127.0.0.1:8902")
    parser.add_argument("--source-repo", type=Path, default=NSP_REPO)
    parser.add_argument("--workshop-arcade", type=Path, default=WORKSHOP_ARCADE)
    parser.add_argument("--destination-repo", type=Path, default=ROOT)
    args = parser.parse_args()
    destination, source_repo = args.destination_repo.resolve(), args.source_repo.resolve()
    if not (destination / ".git").exists():
        raise SystemExit("Destination is not a Git repository")
    roots = [
        ("workshop_arcade", args.workshop_arcade.resolve()),
        ("nsp_repo_arcade", (source_repo / "arcade_games").resolve()),
    ]
    base = args.source_base.rstrip("/") + "/"
    landing_raw = fetch(urljoin(base, "arcade"))
    inventory_raw = fetch(urljoin(base, "api/arcade/custom-games"))
    landing = landing_raw.decode("utf-8")
    inventory = json.loads(inventory_raw.decode("utf-8"))
    games = inventory.get("games")
    if len(landing) < 100_000 or "<title>Super Arcade — NorthStar Prime</title>" not in landing:
        raise SystemExit("Arcade landing guard failed")
    if not inventory.get("ok") or not isinstance(games, list) or len(games) < 20:
        raise SystemExit("Arcade inventory guard failed")
    if inventory.get("count") != len(games) or LOCAL_LEAK.search(landing):
        raise SystemExit("Arcade source invariant failed")

    candidates: list[dict[str, object]] = []
    delegated: list[dict[str, str]] = []
    seen: set[str] = set()
    for game in games:
        slug = str(game.get("slug", ""))
        route = str(game.get("route", ""))
        name = str(game.get("source_name") or game.get("source") or "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or slug in seen:
            raise SystemExit(f"Unsafe/duplicate slug: {slug}")
        if route != f"/arcade/custom/{slug}" or not re.fullmatch(r"[A-Za-z0-9_-]+\.html", name):
            raise SystemExit(f"Bad route provenance: {route}")
        seen.add(slug)
        source = next((root / name for _, root in roots if (root / name).is_file()), None)
        reason = "local source file unavailable" if source is None else None
        html = "" if source is None else source.read_text(encoding="utf-8")
        if source is not None and LOCAL_LEAK.search(html):
            reason = "contains private local filesystem inventory"
        elif source is not None and EXTERNAL_RESOURCE.search(html):
            reason = "contains an external runtime resource dependency"
        if reason:
            delegated.append({"slug": slug, "route": route, "source_name": name,
                              "reason": reason, "fallback_url": FALLBACK + route})
        else:
            candidates.append({"game": game, "source": source, "html": html})

    mirrored = {str(row["game"]["slug"]) for row in candidates}
    if len(mirrored) + len(delegated) != len(games):
        raise SystemExit("Every catalog route must be mirrored or delegated")

    rewritten_landing, landing_fallbacks = rewrite_routes(landing, mirrored)
    header = ("<!-- FROZEN NSP ARCADE | deterministic digests: "
              f"landing={digest_bytes(landing_raw)} inventory={digest_bytes(inventory_raw)} -->\n")
    landing_bytes = normalize_generated_text(header + rewritten_landing).encode("utf-8")
    write_changed(destination / "arcade" / "index.html", landing_bytes)
    contexts: dict[str, set[str]] = {}
    for token in tokens(rewritten_landing):
        contexts.setdefault(token, set()).add("landing")

    game_rows: list[dict[str, object]] = []
    for candidate in sorted(candidates, key=lambda row: str(row["game"]["slug"])):
        game, source = candidate["game"], Path(candidate["source"])
        slug = str(game["slug"])
        rewritten, fallbacks = rewrite_routes(str(candidate["html"]), mirrored)
        if LOCAL_LEAK.search(rewritten) or EXTERNAL_RESOURCE.search(rewritten):
            raise SystemExit(f"Safety invariant failed after rewrite: {slug}")
        output = normalize_generated_text(rewritten).encode("utf-8")
        relative = Path("arcade") / "custom" / slug / "index.html"
        write_changed(destination / relative, output)
        root_id, source_relative = source_id(source, roots)
        for token in tokens(rewritten):
            contexts.setdefault(token, set()).add(slug)
        game_rows.append({
            "slug": slug,
            "title": str(game.get("title", slug)),
            "route": str(game["route"]),
            "state": str(game.get("state", "")),
            "source_root_id": root_id,
            "source_relative": source_relative,
            "source_sha256": digest_file(source),
            "output_relative": relative.as_posix(),
            "output_bytes": len(output),
            "output_sha256": digest_bytes(output),
            "server_fallbacks": fallbacks,
        })

    previous_asset_rows: dict[str, dict[str, object]] = {}
    previous_manifest_path = destination / "ARCADE_FREEZE_MANIFEST.json"
    if previous_manifest_path.is_file():
        try:
            previous_manifest = json.loads(previous_manifest_path.read_text(encoding="utf-8"))
            previous_asset_rows = {
                str(row["relative_path"]): row
                for row in previous_manifest.get("assets", [])
                if isinstance(row, dict) and row.get("relative_path")
            }
        except (json.JSONDecodeError, OSError, KeyError, TypeError):
            previous_asset_rows = {}

    asset_map: dict[str, dict[str, object]] = {}
    for token in sorted(contexts):
        for mode, source in resolve_assets(source_repo, token):
            relative = source.resolve().relative_to(source_repo)
            if source.stat().st_size > MAX_FILE:
                raise SystemExit(f"Asset exceeds safe GitHub file limit: {relative.as_posix()}")
            output = destination / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            source_hash = digest_file(source)
            key = relative.as_posix()
            row = asset_map.get(key)
            if row is None:
                transform = "copy"
                if relative == LORE_CORPUS_PATH:
                    transform = LORE_RECIPE
                    sanitize_lore_corpus(source, output)
                elif is_large_motion_plate(relative, source):
                    transform = MOTION_RECIPE
                    previous = previous_asset_rows.get(key, {})
                    reusable = (
                        output.is_file()
                        and previous.get("transform") == MOTION_RECIPE
                        and previous.get("source_sha256") == source_hash
                        and previous.get("sha256") == digest_file(output)
                        and int(previous.get("bytes", -1)) == output.stat().st_size
                    )
                    if not reusable:
                        transcode_motion_plate(source, output)
                elif not output.is_file() or digest_file(output) != source_hash:
                    shutil.copy2(source, output)
                output_hash = digest_file(output)
                row = {
                    "web_path": "/" + key,
                    "relative_path": key,
                    "bytes": output.stat().st_size,
                    "sha256": output_hash,
                    "source_bytes": source.stat().st_size,
                    "source_sha256": source_hash,
                    "transform": transform,
                    "resolution_modes": set(),
                    "references": set(),
                    "referenced_by": set(),
                }
                asset_map[key] = row
            row["resolution_modes"].add(mode)
            row["references"].add(token)
            row["referenced_by"].update(contexts[token])
    assets = [{
        "web_path": asset_map[key]["web_path"],
        "relative_path": key,
        "bytes": asset_map[key]["bytes"],
        "sha256": asset_map[key]["sha256"],
        "source_bytes": asset_map[key]["source_bytes"],
        "source_sha256": asset_map[key]["source_sha256"],
        "transform": asset_map[key]["transform"],
        "resolution_modes": sorted(asset_map[key]["resolution_modes"]),
        "references": sorted(asset_map[key]["references"]),
        "referenced_by": sorted(asset_map[key]["referenced_by"]),
    } for key in sorted(asset_map)]

    catalog_bytes = json.dumps(inventory, indent=2, sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n"
    write_changed(destination / "arcade" / "catalog.json", catalog_bytes)
    manifest = {
        "schema": SCHEMA,
        "source": {
            "landing_url": "/arcade",
            "inventory_url": "/api/arcade/custom-games",
            "landing_sha256": digest_bytes(landing_raw),
            "inventory_sha256": digest_bytes(inventory_raw),
            "source_root_ids": [root_id for root_id, _ in roots],
        },
        "fallback_origin": FALLBACK,
        "catalog_game_count": len(games),
        "mirrored_game_count": len(game_rows),
        "delegated_game_count": len(delegated),
        "landing": {"relative_path": "arcade/index.html", "bytes": len(landing_bytes),
                    "sha256": digest_bytes(landing_bytes), "server_fallbacks": landing_fallbacks},
        "catalog": {"relative_path": "arcade/catalog.json", "bytes": len(catalog_bytes),
                    "sha256": digest_bytes(catalog_bytes)},
        "games": game_rows,
        "delegated_routes": sorted(delegated, key=lambda row: row["slug"]),
        "asset_count": len(assets),
        "asset_bytes": sum(int(row["bytes"]) for row in assets),
        "source_asset_bytes": sum(int(row["source_bytes"]) for row in assets),
        "optimized_asset_count": sum(row["transform"] == MOTION_RECIPE for row in assets),
        "optimized_asset_bytes_saved": sum(
            int(row["source_bytes"]) - int(row["bytes"])
            for row in assets
            if row["transform"] == MOTION_RECIPE
        ),
        "redacted_asset_count": sum(row["transform"] == LORE_RECIPE for row in assets),
        "assets": assets,
        "invariants": [
            "No generated arcade HTML contains a local filesystem path",
            "No mirrored game relies on a remote CDN resource",
            "Every catalog route is locally mirrored or explicitly delegated",
            "Every resolved local static asset is hashed",
            "Large decorative motion plates are locally optimized without adding a runtime dependency",
            "Private filesystem provenance is redacted from the public Future Teller lore corpus",
            "No activation, payment, account, API mutation, DNS, or Cloudflare change is performed",
        ],
    }
    write_changed(destination / "ARCADE_FREEZE_MANIFEST.json",
                  json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n")

    lines = [
        "# Arcade route provenance", "",
        "This deterministic static freeze comes from the healthy local public catalog. Dynamic-only routes are explicit fallbacks to `https://app.northstarprime.net`.", "",
        f"- Catalog routes: {len(games)}", f"- Static mirrored games: {len(game_rows)}",
        f"- Delegated routes: {len(delegated)}",
        f"- Hashed assets: {len(assets)} ({manifest['asset_bytes']} bytes)",
        f"- Optimized motion plates: {manifest['optimized_asset_count']} "
        f"(saved {manifest['optimized_asset_bytes_saved']} bytes)",
        f"- Public provenance redactions: {manifest['redacted_asset_count']}", "",
        "| Route | Disposition | Source provenance |", "|---|---|---|",
    ]
    local = {str(row["slug"]): row for row in game_rows}
    remote = {row["slug"]: row for row in delegated}
    for game in sorted(games, key=lambda row: str(row["slug"])):
        slug = str(game["slug"])
        if slug in local:
            row, disposition = local[slug], "static mirror"
            provenance = f"`{row['source_root_id']}:{row['source_relative']}`"
        else:
            row = remote[slug]
            disposition = f"[dynamic fallback]({row['fallback_url']})"
            provenance = row["reason"]
        lines.append(f"| `{game['route']}` | {disposition} | {provenance} |")
    lines += ["", "## Limits", "",
              "- Server telemetry, live radio selection, prediction-bot APIs, activation, purchases, and smoke dashboards remain on the dynamic app origin.",
              "- The private Super Arcade Archive is intentionally not copied because its source enumerates local drive paths.",
              "- Static pages cannot reproduce server-side account, payment, or mutation flows.", ""]
    write_changed(destination / "ARCADE_ROUTE_PROVENANCE.md", "\n".join(lines).encode("utf-8"))
    print("OK: deterministic arcade freeze built")
    print(f"CATALOG={len(games)}")
    print(f"MIRRORED={len(game_rows)}")
    print(f"DELEGATED={len(delegated)}")
    print(f"ASSETS={len(assets)}")
    print(f"ASSET_BYTES={manifest['asset_bytes']}")
    print(f"MANIFEST={destination / 'ARCADE_FREEZE_MANIFEST.json'}")


if __name__ == "__main__":
    main()
