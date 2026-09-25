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

import argparse
import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output" / "pages-artifact"
APP_VIDEO_BASE = "https://app.northstarprime.net/static/idc_video/"
LOCAL_VIDEO_BASE = "/static/idc_video/"
PUBLISHED_LIMIT_BYTES = 1_000_000_000
# Chronosphere and Side Street add about 4.45 MB to the 919.9 MB artifact.
# Keep 70 MB below the configured 1 GB published-site ceiling.
RELEASE_GUARD_BYTES = 930_000_000
GIT_BLOB_LIMIT_BYTES = 100_000_000
SKIP_TOP_LEVEL = {".git", ".github", "output", "tools", "__pycache__", ".pytest_cache", ".playwright-cli", ".playwright", "little-light-media", "cookbook-media", "stickerforge-media"}
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
    if relative.suffix.lower() not in {".html", ".css"}:
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

def external_release_media(relative: Path) -> bool:
    # The SFX gallery constructs `${f}.mp3` and `${f}.wav` at runtime.
    # Keep this small directory local so its native template and downloads work.
    if relative.parts[:3] == ("static", "games", "sfx"):
        return False
    return relative.suffix.lower() in AUDIO_SUFFIXES or relative.parts[:2] == ("static", "idc_covers")

def tracked_source_paths():
    # A release is made from versioned source, never untracked workstation exports.
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [Path(p.decode("utf-8")) for p in raw.split(b"\0") if p]

def release_media_index():
    selected = {p.as_posix() for p in tracked_source_paths() if external_release_media(p)}
    directories = {str(Path(p).parent).replace("\\", "/") + "/" for p in selected}
    directories.add("static/idc_covers/")
    return selected, directories

def rewrite_release_media_refs(raw: str, relative: Path, selected: set[str], directories: set[str], commit: str) -> str:
    import re, posixpath
    from urllib.parse import urlsplit, unquote, quote
    # Literal HTML attributes, CSS url(), JSON/JS values, and JS directory prefixes.
    # Do not rewrite prose, already-external URLs, or filesystem source provenance.
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
            "/" in path and not Path(path).suffix
            and raw[match.end() + 1:].lstrip().startswith("+")
            and any(item.startswith(resolved) for item in selected)
        )
        if resolved in selected or dynamic_prefix or (path.endswith("/") and resolved.rstrip("/") + "/" in directories):
            suffix = ("/" if path.endswith("/") else "") + ("?" + parsed.query if parsed.query else "") + ("#" + parsed.fragment if parsed.fragment else "")
            return match.group("lead") + base + quote(resolved, safe="/") + suffix
        return match.group(0)
    return token.sub(replace, raw)


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
        if external_sticker_master(relative) or external_release_media(relative):
            continue
        yield path, relative


def build(output: Path) -> dict:
    # Immutable media URLs must identify the exact bytes copied and omitted.
    # Reject both staged and unstaged tracked edits; untracked exports are excluded.
    subprocess.run(["git", "diff", "--quiet", "HEAD", "--"], cwd=ROOT, check=True)
    media_commit = source_commit()
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

    selected_media, media_directories = release_media_index()
    if len(media_commit) != 40:
        raise ValueError("Immutable media delivery requires an exact source commit")
    rewrites = 0
    copied = 0
    for source, relative in iter_source_files():
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix.lower() in TEXT_SUFFIXES:
            raw = source.read_text(encoding="utf-8")
            count = raw.count(LOCAL_VIDEO_BASE)
            if count:
                raw = raw.replace(LOCAL_VIDEO_BASE, APP_VIDEO_BASE)
                rewrites += count
            raw = rewrite_sticker_refs(raw, relative)
            raw = rewrite_release_media_refs(raw, relative, selected_media, media_directories, media_commit)
            destination.write_text(raw, encoding="utf-8", newline="\n")
            shutil.copymode(source, destination)
        else:
            for attempt in range(5):
                try:
                    shutil.copy2(source, destination)
                    break
                except PermissionError:
                    if attempt == 4:
                        raise
                    import time
                    time.sleep(0.1)
        copied += 1

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
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_commit": media_commit,
        "file_count_excluding_manifest": copied,
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
