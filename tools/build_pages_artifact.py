#!/usr/bin/env python3
"""Build the curated NorthStar Prime GitHub Pages artifact.

The branch remains the complete source archive. The Pages artifact omits the
large IDC video copies and rewrites their public URLs to the identical files on
the canonical NorthStar application host. Little Light, cookbook, and StickerForge
preview exports stay in the public source repository and out of this artifact.
Full-resolution StickerForge masters stay in the repository too, and the artifact
rewrites their URLs to raw.githubusercontent.com so new sticker packs do not
consume the 1 GB Pages ceiling.
"""

from __future__ import annotations

import re
import argparse
import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pages_art_quality


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output" / "pages-artifact"
APP_VIDEO_BASE = "https://app.northstarprime.net/static/idc_video/"
LOCAL_VIDEO_BASE = "/static/idc_video/"
PUBLISHED_LIMIT_BYTES = 1_000_000_000
# 2026-11-06 slim: tip/download zips, GLBs, large art shelves → raw.githubusercontent.com
# so deploy-pages can finish under the 10-minute sync timeout (~500 MiB guard).
RELEASE_GUARD_BYTES = 500_000_000
GIT_BLOB_LIMIT_BYTES = 100_000_000
SKIP_TOP_LEVEL = {".git", ".github", "output", "tools", "__pycache__", ".pytest_cache", ".playwright-cli", ".playwright", "little-light-media", "cookbook-media", "stickerforge-media", "PAGES_CAPACITY_BUDGET.json"}
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest"}

RAW_STICKER_BASE = "https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/main/"
STICKER_MEDIA_SUFFIXES = {".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif"}


def external_sticker_master(relative: Path) -> bool:
    """Full sticker art stays in git and is served from the raw repository."""
    if not relative.parts or relative.parts[0] != "stickerforge":
        return False
    if relative.suffix.lower() not in STICKER_MEDIA_SUFFIXES:
        return False
    return "assets" in relative.parts or (len(relative.parts) > 1 and relative.parts[1] == "crucifix")


def rewrite_sticker_refs(raw: str, relative: Path) -> str:
    import re
    abs_re = re.compile(
        r"(?<!main)(?:https://northstarprime\.net)?(/stickerforge/[^\s\"\'<>]+?\.(?:png|webp|jpg|jpeg|gif|avif))",
        re.IGNORECASE,
    )
    raw = abs_re.sub(lambda match: RAW_STICKER_BASE + match.group(1).lstrip("/"), raw)
    # Relative assets belong to their page; only StickerForge masters are offloaded.
    if (relative.suffix.lower() not in {".html", ".css"}
            or not relative.parts or relative.parts[0] != "stickerforge"):
        return raw
    rel_re = re.compile(
        r"(?<![A-Za-z0-9_./-])(?:\./)?(assets/[^\s\"\'<>]+?\.(?:png|webp|jpg|jpeg|gif|avif))",
        re.IGNORECASE,
    )

    def replace_relative(match: re.Match) -> str:
        target = (ROOT / relative.parent / match.group(1)).resolve()
        if not target.is_relative_to(ROOT):
            return match.group(0)
        return RAW_STICKER_BASE + (relative.parent / match.group(1)).as_posix()

    return rel_re.sub(replace_relative, raw)




AUDIO_SUFFIXES = {".mp3", ".wav", ".m4a", ".ogg"}
# Heavy binary trees kept in git and served from raw.githubusercontent.com so the
# curated Pages artifact stays under the deploy-pages sync window (~500 MiB guard).
EXTERNAL_RELEASE_PREFIXES = {
    ("static", "videos"),
    ("static", "cookbook_deluxe_media"),
    # NOT static/downloads: MasterCook *.html readers must stay on Pages (raw.githubusercontent.com
    # serves HTML as text/plain). Tip *.zip.b64 omitted via omit_unlinked_pages_payload; PDFs/zips
    # still leave via HEAVY_EXTERNAL_SUFFIXES.
    ("static", "art"),
    # NOT static/idg: future-teller loads /static/idg/*.json locally; ROM zips omitted explicitly.
    ("static", "literature"),
    ("static", "drops"),
    ("static", "idr_covers"),
    ("static", "cards"),
    ("static", "action_captures"),
    ("static", "curated"),
    ("coloring-studio", "assets"),
    ("pnw-lost-tables-2020", "assets"),
    ("pnw-lost-tables-2020", "downloads"),
    ("raven-and-rose-1883", "downloads"),
    ("vorath-x-icp-dark-carnival", "assets"),
    ("vorath-x-icp-dark-carnival", "downloads"),
    ("acid-voxel-halloween", "assets"),
    ("acid-voxel-halloween", "downloads"),
    ("brick-alchemy", "assets"),
}
EXTERNAL_RELEASE_PREFIXES_3 = {
    ("static", "games", "models"),
}
EXTERNAL_TOP_LEVEL_MEDIA = {
    "warband",
    "memeforge",
    "gallery",
    "maison-gooch",
    "literature",
}
HEAVY_EXTERNAL_SUFFIXES = {
    ".glb", ".gltf", ".pdf", ".zip", ".epub", ".docx", ".wasm", ".bin",
}
MATURE_EXTERNAL_SUFFIXES = AUDIO_SUFFIXES | {
    ".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif",
    ".mp4", ".webm", ".mov", ".mkv",
    ".glb", ".gltf", ".zip", ".pdf", ".wasm", ".bin",
}


def _must_stay_local(relative: Path) -> bool:
    """Workshop / offline releases that verifiers pin to exact local artifact bytes."""
    parts = relative.parts
    if not parts:
        return False
    # This small, manifest-pinned model is required by the local game runtime.
    # Other GLB releases retain the existing raw-delivery and size policies.
    if relative.as_posix() == "arcade/custom/crib-recovered-assets/keeper-repair-station-v2.glb":
        return True
    if parts[0] == "chronosphere":
        return True
    if len(parts) >= 2 and (parts[0], parts[1]) == ("static", "vendor"):
        return True
    # pages_art_quality exact-hash delivery + comic interiors stay in the artifact.
    if len(parts) >= 3 and (parts[0], parts[1], parts[2]) == ("static", "art", "reviewed"):
        return True
    if len(parts) >= 3 and (parts[0], parts[1], parts[2]) in {
        ("static", "games", "sfx"),
        ("static", "games", "logic_foundry_v14"),
        ("static", "games", "ladder_v13"),
    }:
        return True
    return False


def external_release_media(relative: Path) -> bool:
    if _must_stay_local(relative):
        return False
    # The SFX gallery constructs `${f}.mp3` and `${f}.wav` at runtime.
    # Keep this small directory local so its native template and downloads work.
    if relative.parts[:3] == ("static", "front", "store") and relative.suffix.lower() == ".png":
        return True
    if len(relative.parts) >= 3 and tuple(relative.parts[:3]) in EXTERNAL_RELEASE_PREFIXES_3:
        return True
    if len(relative.parts) >= 2 and tuple(relative.parts[:2]) in EXTERNAL_RELEASE_PREFIXES:
        # Keep page/shell documents local so Pages does not rewrite them onto
        # raw.githubusercontent.com (HTML there is often text/plain).
        if relative.suffix.lower() in TEXT_SUFFIXES or relative.suffix.lower() == ".md":
            return False
        return True
    # Mature route HTML/JSON stay local; bulky media is raw-delivered.
    if relative.parts and relative.parts[0] == "mature" and relative.suffix.lower() in MATURE_EXTERNAL_SUFFIXES:
        return True
    # Tarot card art: keep player HTML/JSON local; WebP faces via raw.
    # STOP Tarot/mushrooms = do not delete source; exclude-from-Pages only.
    if (
        relative.parts
        and relative.parts[0] == "tarot"
        and relative.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg", ".gif", ".avif"}
    ):
        return True
    if (
        relative.parts
        and relative.parts[0] in EXTERNAL_TOP_LEVEL_MEDIA
        and relative.suffix.lower() in (
            MATURE_EXTERNAL_SUFFIXES | {".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif", ".svg"}
        )
    ):
        return True
    if relative.suffix.lower() in HEAVY_EXTERNAL_SUFFIXES:
        return True
    if relative.suffix.lower() in {".mp4", ".webm", ".mov", ".mkv"}:
        return True
    return relative.suffix.lower() in AUDIO_SUFFIXES or relative.parts[:2] == ("static", "idc_covers")


PAGES_OMIT_DOWNLOAD_NAMES = frozenset({
    # Defense-in-depth: even if downloads prefix is removed later, tip packs stay out.
    "Digital_MasterCook_Deluxe_Illustrated_Edition.pdf",
    "data_cleanup_gateway_bundle_v1.zip",
})


def omit_unlinked_pages_payload(relative: Path) -> bool:
    """Omit cream-tip zip.b64 and other unlinked download binaries from Pages.

    Tip/free packs stay in git for cream CDN wave1 but no customer page hrefs
    them today. Materializing ~107 MiB of tip zips into the curated artifact is
    what pushed actions/deploy-pages@v5 past its 600s syncing_files timeout on
    the SEO #212 deploys (artifact ~910 MB). Covered primarily by EXTERNAL
    static/downloads; this remains as an explicit omit for clarity/audit.
    """
    parts = relative.parts
    name = relative.name
    if len(parts) >= 2 and parts[0] == "static" and parts[1] == "downloads":
        if name.endswith(".zip.b64") or ".zip.b64.part" in name:
            return True
        if name.startswith("biolume-kit-public.zip.hex"):
            return True
        if name in PAGES_OMIT_DOWNLOAD_NAMES:
            return True
    if len(parts) >= 2 and parts[0] == "static" and parts[1] == "idg" and relative.suffix.lower() == ".zip":
        return True
    return False


def tracked_source_paths():
    # A release is made from versioned source, never untracked workstation exports.
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [Path(p.decode("utf-8")) for p in raw.split(b"\0") if p]

def release_media_index():
    return {p.as_posix() for p in tracked_source_paths()
            if external_release_media(p) and not pages_art_quality.is_retired_art(p)}

def rewrite_release_media_refs(raw: str, relative: Path, selected: set[str], commit: str) -> str:
    import re, posixpath
    from urllib.parse import urlsplit, unquote, quote
    # Literal HTML attributes, CSS url(), JSON/JS values, and JS directory prefixes.
    # Do not rewrite prose, already-external URLs, or filesystem source provenance.
    # A bare folder link such as "/idr/single-052/" is a page link, never media,
    # even when that folder also holds audio or video.
    # This manifest is consumed by season-3/app.js; audio resolves against its page,
    # not the data/ JSON URL. Keep this explicit instead of guessing arbitrary bases.
    if relative.as_posix() == "idc/season-3/data/listening_manifest.json":
        relative = Path("idc/season-3/index.html")
    token = re.compile(r"(?P<lead>[\"'`(])(?P<value>[^\s\"'`<>()[\]{}]+)(?=[\"'`)])")
    base = "https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/" + commit + "/"
    def replace(match):
        value = match.group("value")
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or value.startswith(("#", "?", "//")):
            return match.group(0)
        path = unquote(parsed.path)
        resolved = posixpath.normpath(path.lstrip("/") if path.startswith("/") else posixpath.join(relative.parent.as_posix(), path))
        dynamic_prefix = (
            "/" in path and bool(path.strip("/.")) and resolved != "."
            and not Path(path).suffix
            and raw[match.end() + 1:].lstrip().startswith("+")
            and any(item.startswith(resolved) for item in selected)
        )
        if resolved in selected or dynamic_prefix:
            suffix = ("/" if path.endswith("/") else "") + ("?" + parsed.query if parsed.query else "") + ("#" + parsed.fragment if parsed.fragment else "")
            return match.group("lead") + base + quote(resolved, safe="/") + suffix
        return match.group(0)
    return token.sub(replace, raw)


# Cloudflare Web Analytics: added to every published HTML page head at build
# time, so frozen source pages and their manifests stay byte-identical.
CF_WEB_ANALYTICS_BEACON = """<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "edd65cd0f53e49dba694dfdcc6c30fc4"}'></script>"""
# Pages that must stay free of remote scripts: strict-CSP or offline releases,
# explicit no-analytics promises, and the held reader placeholder.
CF_WEB_ANALYTICS_EXCLUDED = frozenset({
    "chronosphere/index.html",
    "idc/season-3/index.html",
    "arcade/custom/side-street/index.html",
    "arcade/custom/logic-foundry/index.html",
    "arcade/custom/ladder/index.html",
    "manga/index.html",
    "mature/games/strip-signal/index.html",
    "mature/games/afterglow-poker-lite/index.html",
    "idr/signal-refrains/volume-01/index.html",
    "idr/signal-refrains/the-distance-learns-my-name/index.html",
})
_HEAD_CLOSE = re.compile(r"</head\s*>", re.IGNORECASE)
_NO_ANALYTICS_OPT_OUT = re.compile(
    r"""(?:<meta\b[^>]*\bname\s*=\s*['"]nsp-analytics['"][^>]*\bcontent\s*=\s*['"](?:off|none|no|false|0)['"]"""
    r"""|<meta\b[^>]*\bcontent\s*=\s*['"](?:off|none|no|false|0)['"][^>]*\bname\s*=\s*['"]nsp-analytics['"]"""
    r"""|\bdata-no-analytics\b"""
    r"""|\bno\s+analytics\b)""",
    re.IGNORECASE,
)


def inject_cf_web_analytics(raw: str, relative: Path) -> str:
    rel = relative.as_posix()
    if relative.suffix.lower() != ".html" or rel in CF_WEB_ANALYTICS_EXCLUDED or rel.startswith("tools/"):
        return raw
    if _NO_ANALYTICS_OPT_OUT.search(raw):
        return raw
    if "static.cloudflareinsights.com/beacon.min.js" in raw:
        return raw
    match = _HEAD_CLOSE.search(raw)
    if not match:
        return raw
    return raw[:match.start()] + CF_WEB_ANALYTICS_BEACON + "\n" + raw[match.start():]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def source_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def safe_output(value: str | Path) -> Path:
    output = Path(value).expanduser().resolve()
    allowed_root = (ROOT / "output").resolve()
    if output == allowed_root or not output.is_relative_to(allowed_root):
        raise ValueError(f"Output must be a child of {allowed_root}")
    return output

# Originals replaced on their only pages by same-size WebP copies (Oct 24 2026).
# Kept in git (nothing deleted) but left out of the Pages artifact so the
# smaller copies fit under the release guard.
SUPERSEDED_BY_WEBP = frozenset({
    "static/ckd_kitchen/chairside_care_kit.jpg",
    "static/ckd_kitchen/crisping_plate_hero.jpg",
    "static/ckd_kitchen/mastercook_kitchen_hero.jpg",
    "static/ckd_kitchen/world_table_spread.jpg",
    "static/action_captures/bank_northstar_vault.jpg",
    "static/action_captures/crafter_assembly_line.jpg",
    "static/action_captures/crystal_ziggurat_apex.jpg",
    "static/action_captures/deep_dark_warden_ancient_city.jpg",
    "static/drops/mystery_school_lab.jpg",
    "static/mystery_school/images/03_AETHERIA_CELESTIAL_OBSERVATORY.jpg",
    # Oct 25 2026: /channels/ and /press/ now use WebP copies; these originals
    # had no other page references.
    "arcade/custom/void-siege/box_art.jpg",
    "arcade/custom/prism-runner-2049/box_art.jpg",
    "arcade/custom/chrono-blade-2049/box_art.jpg",
    "literature/the-vorath-codex-vol2/frontispiece.jpg",
    "static/drops/ouroboros_titan_reveal.jpg",
    # Oct 25 2026 (pass 2): Mystery School chambers/caves/stare-into-the-void/
    # garden now use the existing WebP copies; no other page references.
    "static/mystery_school/images/01_MYSTERY_SCHOOL_GRAND_PORTAL.jpg",
    "static/mystery_school/images/02_STARE_INTO_THE_VOID_CHAMBER.jpg",
    "static/mystery_school/images/04_THE_GARDEN_OF_STILLNESS.jpg",
})


def iter_source_files():
    for relative in tracked_source_paths():
        path = ROOT / relative
        if not relative.parts or relative.parts[0] in SKIP_TOP_LEVEL:
            continue
        if path.is_symlink():
            raise ValueError(f"Symlinks are not allowed in the Pages artifact: {relative.as_posix()}")
        if not path.is_file():
            continue
        if relative.parts[:2] == ("static", "idc_video"):
            continue
        if pages_art_quality.is_retired_art(relative):
            continue
        if relative.as_posix() in SUPERSEDED_BY_WEBP:
            continue
        if external_sticker_master(relative) or external_release_media(relative):
            continue
        if omit_unlinked_pages_payload(relative):
            continue
        yield path, relative



def materialize_b64_zips(output: Path) -> int:
    """Decode binaries shipped as *.b64 or *.b64.partNN text (zips, JS, PNG, …).

    GitHub MCP cannot land raw binaries; Pages still needs real bytes in the
    curated artifact. Incomplete part sets are skipped so in-flight uploads do
    not fail the whole deploy. PK magic is required only for *.zip stems.
    """
    import base64
    import re
    import sys

    count = 0
    for b64_path in sorted(output.rglob("*.b64")):
        if ".b64.part" in b64_path.name:
            continue
        if not b64_path.name.endswith(".b64"):
            continue
        out_name = b64_path.name[: -len(".b64")]
        out_path = b64_path.parent / out_name
        raw = base64.b64decode("".join(b64_path.read_text(encoding="ascii").split()), validate=False)
        if out_name.endswith(".zip") and (len(raw) < 4 or raw[:2] != b"PK"):
            raise ValueError(f"Decoded zip missing PK magic: {b64_path.relative_to(output).as_posix()}")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(raw)
        b64_path.unlink(missing_ok=True)
        count += 1

    part_files = [p for p in output.rglob("*") if p.is_file() and ".b64.part" in p.name]
    groups: dict[str, list[tuple[int, Path]]] = {}
    for part in part_files:
        m = re.match(r"^(?P<stem>.+)\.b64\.part(?P<idx>\d+)$", part.name)
        if not m:
            print(
                f"skip unexpected b64 part name: {part.relative_to(output).as_posix()}",
                file=sys.stderr,
            )
            continue
        groups.setdefault(m.group("stem"), []).append((int(m.group("idx")), part))
    for stem, parts in sorted(groups.items()):
        parts.sort(key=lambda item: item[0])
        idxs = [idx for idx, _ in parts]
        expected = list(range(len(parts)))
        if idxs != expected:
            print(
                f"skip incomplete b64 parts for {stem}: have {idxs[:5]}{'...' if len(idxs)>5 else ''} "
                f"n={len(idxs)} (need contiguous 0..N-1)",
                file=sys.stderr,
            )
            continue
        blob = "".join(path.read_text(encoding="ascii") for _, path in parts)
        raw = base64.b64decode("".join(blob.split()), validate=False)
        if stem.endswith(".zip") and (len(raw) < 4 or raw[:2] != b"PK"):
            raise ValueError(f"Decoded zip missing PK magic: {stem}")
        out_path = parts[0][1].parent / stem
        out_path.write_bytes(raw)
        for _, path in parts:
            path.unlink(missing_ok=True)
        count += 1
        print(f"materialized {stem} bytes={len(raw)}")
    return count


def immutable_release_files(root: Path) -> frozenset[str]:
    """Manifest-pinned browser release files bypass every text transformation."""
    manifest = json.loads((root / "CHRONOSPHERE_RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    selected = set()
    release_root = (root / "chronosphere").resolve()
    for row in manifest["browser_files"]:
        relative = Path(row["path"])
        source = (root / relative).resolve()
        if relative.is_absolute() or ".." in relative.parts or not source.is_relative_to(release_root):
            raise ValueError(f"Invalid immutable release path: {row['path']}")
        payload = source.read_bytes()
        if len(payload) != row["bytes"] or hashlib.sha256(payload).hexdigest() != row["sha256"]:
            raise ValueError(f"Immutable release source identity mismatch: {row['path']}")
        selected.add(relative.as_posix())
    return frozenset(selected)


def copy_artifact_source(source: Path, relative: Path, destination: Path,
                         selected_media: set[str], media_commit: str,
                         immutable_files: frozenset[str]) -> int:
    """Copy one file, preserving pinned releases and rewriting ordinary pages."""
    if relative.as_posix() in immutable_files:
        shutil.copy2(source, destination)
        return 0
    if source.suffix.lower() in TEXT_SUFFIXES:
        raw = pages_art_quality.artifact_page_text(
            ROOT, relative, source.read_text(encoding="utf-8"))
        count = raw.count(LOCAL_VIDEO_BASE)
        if count:
            raw = raw.replace(LOCAL_VIDEO_BASE, APP_VIDEO_BASE)
        raw = pages_art_quality.rewrite_reviewed_art_urls(raw, relative)
        raw = rewrite_sticker_refs(raw, relative)
        raw = rewrite_release_media_refs(raw, relative, selected_media, media_commit)
        raw = inject_cf_web_analytics(raw, relative)
        destination.write_text(raw, encoding="utf-8", newline="\n")
        shutil.copymode(source, destination)
        return count
    for attempt in range(5):
        try:
            shutil.copy2(source, destination)
            break
        except PermissionError:
            if attempt == 4:
                raise
            import time
            time.sleep(0.1)
    return 0


def build(output: Path) -> dict:
    # Immutable media URLs must identify the exact bytes copied and omitted.
    # Reject both staged and unstaged tracked edits; untracked exports are excluded.
    subprocess.run(["git", "diff", "--quiet", "HEAD", "--"], cwd=ROOT, check=True)
    media_commit = source_commit()
    pages_art_quality.validate_source(ROOT)
    immutable_files = immutable_release_files(ROOT)
    video_root = ROOT / "static" / "idc_video"
    video_files = sorted(path for path in video_root.rglob("*") if path.is_file())
    omitted_video_bytes = sum(path.stat().st_size for path in video_files)
    omitted_stickers = [
        path for path, relative in (
            (path, path.relative_to(ROOT))
            for path in ROOT.rglob("*")
            if path.is_file() and external_sticker_master(path.relative_to(ROOT))
        )
    ]
    omitted_sticker_bytes = sum(path.stat().st_size for path in omitted_stickers)

    if output.exists():
        import stat
        for root, dirs, files in os.walk(output, topdown=False):
            for f in files:
                p = os.path.join(root, f)
                try:
                    os.chmod(p, stat.S_IWRITE)
                    os.unlink(p)
                except Exception:
                    pass
            for d in dirs:
                p = os.path.join(root, d)
                try:
                    os.rmdir(p)
                except Exception:
                    pass
    output.mkdir(parents=True, exist_ok=True)

    selected_media = release_media_index()
    if len(media_commit) != 40:
        raise ValueError("Immutable media delivery requires an exact source commit")
    rewrites = 0
    copied = 0
    for source, relative in iter_source_files():
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        rewrites += copy_artifact_source(
            source, relative, destination, selected_media, media_commit, immutable_files)
        copied += 1

    materialized_zips = materialize_b64_zips(output)

    payload_files = [path for path in output.rglob("*") if path.is_file()]
    payload_bytes = sum(path.stat().st_size for path in payload_files)
    oversized = [
        {"path": path.relative_to(output).as_posix(), "bytes": path.stat().st_size}
        for path in payload_files
        if path.stat().st_size > GIT_BLOB_LIMIT_BYTES
    ]
    if payload_bytes > RELEASE_GUARD_BYTES:
        raise ValueError(
            f"Curated artifact is {payload_bytes} bytes; release guard is {RELEASE_GUARD_BYTES}"
        )
    if oversized:
        raise ValueError(f"Curated artifact contains files above 100 MB: {oversized}")

    manifest = {
        "schema": "northstar.pages-curated-artifact.v1",
        "public_art_quality": pages_art_quality.release_record(),
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_commit": media_commit,
        "file_count_excluding_manifest": copied,
        "materialized_b64_zips": materialized_zips,
        "payload_bytes_excluding_manifest": payload_bytes,
        "release_guard_bytes": RELEASE_GUARD_BYTES,
        "published_limit_bytes": PUBLISHED_LIMIT_BYTES,
        "headroom_to_release_guard_bytes": RELEASE_GUARD_BYTES - payload_bytes,
        "omitted": {
            "path": "static/idc_video",
            "file_count": len(video_files),
            "bytes": omitted_video_bytes,
            "replacement_base_url": APP_VIDEO_BASE,
            "rewritten_references": rewrites,
        },
        "external_release_media": {
            "source_commit": media_commit,
            "file_count": len(selected_media),
            "bytes": sum((ROOT / p).stat().st_size for p in selected_media),
            "paths": sorted(selected_media),
            "delivery": "raw.githubusercontent.com immutable source commit",
        },
        "sticker_masters": {
            "delivery": "raw.githubusercontent.com public repository, paths unchanged",
            "file_count": len(omitted_stickers),
            "bytes": omitted_sticker_bytes,
            "base_url": RAW_STICKER_BASE,
        },
        "little_light_media": {
            "path": "little-light-media",
            "delivery": "raw.githubusercontent.com public repository, content-hashed filenames",
            "file_count": sum(1 for path in (ROOT / "little-light-media").rglob("*") if path.is_file()),
            "bytes": sum(path.stat().st_size for path in (ROOT / "little-light-media").rglob("*") if path.is_file()),
        },
        "cookbook_media": {
            "path": "cookbook-media",
            "delivery": "raw.githubusercontent.com public repository, content-hashed filenames",
            "file_count": sum(1 for path in (ROOT / "cookbook-media").rglob("*") if path.is_file()),
            "bytes": sum(path.stat().st_size for path in (ROOT / "cookbook-media").rglob("*") if path.is_file()),
        },
        "critical_files": {
            relative: sha256(output / relative)
            for relative in ("index.html", "services/index.html", "links/index.html", "sitemap.xml", "software/index.html", "chronosphere/index.html", "CHRONOSPHERE_RELEASE_MANIFEST.json", "arcade/custom/side-street/index.html", "SIDE_STREET_RELEASE_MANIFEST.json")
        },
    }
    (output / "nsp-pages-artifact.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    manifest = build(safe_output(args.output))
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
