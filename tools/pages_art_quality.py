"""Byte-bound artwork corrections and explicit publication holds for Pages.

Original source remains intact. Only reviewed derivatives enter the artifact.
"""
from __future__ import annotations

import hashlib
import json
import posixpath
import re
from pathlib import Path
from urllib.parse import urlsplit

MANIFEST_PATH = Path(__file__).with_name("public_art_quality_20261019.json")
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest"}
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def safe_path(value: str) -> bool:
    return value.startswith("/") and ".." not in value.split("/")


def load_replacements() -> tuple[dict, ...]:
    if MANIFEST.get("schema") != "northstar.pages-reviewed-art.v1":
        raise ValueError("Unknown reviewed-art manifest schema")
    rows = tuple(MANIFEST["replacements"])
    old_paths: set[str] = set()
    delivery: dict[str, tuple] = {}
    for row in rows:
        if not all(safe_path(row[key]) for key in ("old_path", "delivery_path")):
            raise ValueError("Unsafe reviewed-art path")
        if row["old_path"] in old_paths:
            raise ValueError("Duplicate reviewed-art source mapping")
        binding = (row["sha256"], row["bytes"], row["native_sha256"])
        if row["delivery_path"] in delivery and delivery[row["delivery_path"]] != binding:
            raise ValueError("Conflicting reviewed-art delivery alias")
        for key in ("old_sha256", "sha256", "native_sha256"):
            if not re.fullmatch(r"[0-9a-f]{64}", row[key]):
                raise ValueError(f"Invalid reviewed-art digest: {row['id']} {key}")
        old_paths.add(row["old_path"])
        delivery[row["delivery_path"]] = binding
    return rows


REPLACEMENTS = load_replacements()
ADDITIONAL_ASSETS = tuple(MANIFEST.get("additional_assets", ()))
WITHHELD_MEDIA = tuple(MANIFEST.get("withheld_media", ()))
SOURCE_OVERRIDES = tuple(MANIFEST.get("source_overrides", ()))
BY_OLD_PATH = {row["old_path"]: row for row in REPLACEMENTS}
WITHHELD_PATHS = frozenset(row["path"] for row in WITHHELD_MEDIA)
_TOKEN = re.compile(r"""(?P<lead>["'\x60(])(?P<value>[^\s"'\x60<>()]+)(?=["'\x60)])""")


def is_retired_art(relative: Path) -> bool:
    value = "/" + relative.as_posix().lstrip("/")
    return value in BY_OLD_PATH or value in WITHHELD_PATHS


def local_path(value: str, relative: Path) -> str | None:
    if value.startswith(("#", "?")):
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if parsed.scheme or parsed.netloc:
        if parsed.scheme not in {"", "http", "https"} or parsed.hostname != "northstarprime.net":
            return None
    return "/" + posixpath.normpath(
        parsed.path.lstrip("/") if parsed.path.startswith("/")
        else posixpath.join(relative.parent.as_posix(), parsed.path)
    ).lstrip("/")


def rewrite_reviewed_art_urls(raw: str, relative: Path) -> str:
    """Rewrite exact URL tokens without changing unrelated or third-party art."""
    def replace(match: re.Match) -> str:
        value = match.group("value")
        resolved = local_path(value, relative)
        row = BY_OLD_PATH.get(resolved)
        if row is None:
            return match.group(0)
        parsed = urlsplit(value)
        target = row["delivery_path"] + "?v=" + row["sha256"][:16]
        if parsed.netloc:
            target = (parsed.scheme + ":" if parsed.scheme else "") + "//" + parsed.netloc + target
        if parsed.fragment:
            target += "#" + parsed.fragment
        return match.group("lead") + target
    return _TOKEN.sub(replace, raw)


def artifact_page_text(root: Path, relative: Path, source_text: str) -> str:
    for row in SOURCE_OVERRIDES:
        if "/" + relative.as_posix() == row["path"]:
            return (root / row["template_path"]).read_text(encoding="utf-8")
    return source_text


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_source(root: Path) -> None:
    """Fail closed if preserved originals, reviewed assets or hold template drift."""
    for row in REPLACEMENTS:
        old = root / row["old_path"].lstrip("/")
        if not old.is_file() or sha256(old) != row["old_sha256"]:
            raise ValueError(f"Reviewed original changed or missing: {row['old_path']}")
    for row in (*REPLACEMENTS, *ADDITIONAL_ASSETS):
        new = root / row["delivery_path"].lstrip("/")
        if not new.is_file() or new.stat().st_size != row["bytes"] or sha256(new) != row["sha256"]:
            raise ValueError(f"Reviewed delivery changed or missing: {row['delivery_path']}")
    for row in WITHHELD_MEDIA:
        old = root / row["path"].lstrip("/")
        if not safe_path(row["path"]) or not old.is_file() or sha256(old) != row["sha256"]:
            raise ValueError(f"Held source changed or missing: {row['path']}")
    for row in SOURCE_OVERRIDES:
        old = root / row["path"].lstrip("/")
        template = root / row["template_path"]
        if not safe_path(row["path"]) or not old.is_file() or sha256(old) != row["source_sha256"]:
            raise ValueError(f"Held page source changed: {row['path']}")
        if not template.is_file() or sha256(template) != row["template_sha256"]:
            raise ValueError(f"Unavailable reader template changed: {row['path']}")


def verify_artifact(artifact: Path) -> list[str]:
    failures: list[str] = []
    for row in REPLACEMENTS:
        if (artifact / row["old_path"].lstrip("/")).exists():
            failures.append(f"Retired artwork leaked into artifact: {row['old_path']}")
    for row in (*REPLACEMENTS, *ADDITIONAL_ASSETS):
        new = artifact / row["delivery_path"].lstrip("/")
        if not new.is_file() or new.stat().st_size != row["bytes"] or sha256(new) != row["sha256"]:
            failures.append(f"Reviewed artwork bytes mismatch: {row['delivery_path']}")
    for row in WITHHELD_MEDIA:
        if (artifact / row["path"].lstrip("/")).exists():
            failures.append(f"Held media leaked into artifact: {row['path']}")
    for row in SOURCE_OVERRIDES:
        page = artifact / row["path"].lstrip("/")
        if not page.is_file() or sha256(page) != row["template_sha256"]:
            failures.append(f"Unavailable reader page mismatch: {row['path']}")
    for path in artifact.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        relative = path.relative_to(artifact)
        raw = path.read_text(encoding="utf-8")
        if relative.as_posix() == "nsp-pages-artifact.json":
            if json.loads(raw).get("public_art_quality") != release_record():
                failures.append("Reviewed-art release metadata mismatch")
            continue
        if rewrite_reviewed_art_urls(raw, relative) != raw:
            failures.append(f"Retired artwork URL remains in artifact text: {relative.as_posix()}")
        if any(local_path(match.group("value"), relative) in WITHHELD_PATHS
               for match in _TOKEN.finditer(raw)):
            failures.append(f"Held media URL remains in artifact text: {relative.as_posix()}")
    return failures


def release_record() -> dict:
    return {
        "schema": "northstar.pages-reviewed-art.v1",
        "scope": MANIFEST["scope"],
        "retired_paths": sorted(BY_OLD_PATH),
        "withheld_paths": sorted(WITHHELD_PATHS),
        "unavailable_routes": [row["path"] for row in SOURCE_OVERRIDES],
        "delivery": [
            {key: row[key] for key in ("id", "delivery_path", "sha256", "bytes")}
            for row in (*REPLACEMENTS, *ADDITIONAL_ASSETS)
        ],
    }
