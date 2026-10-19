"""Exact, byte-bound art corrections for the curated Pages release.

Rejected originals remain in versioned source. Only the six reviewed delivery
variants are copied to the public artifact; URL rewriting preserves story text.
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


def load_replacements() -> tuple[dict, ...]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("schema") != "northstar.pages-reviewed-art.v1":
        raise ValueError("Unknown reviewed-art manifest schema")
    rows = tuple(manifest["replacements"])
    old_paths: set[str] = set()
    delivery_paths: set[str] = set()
    for row in rows:
        for key in ("old_path", "delivery_path"):
            value = row[key]
            if not value.startswith("/") or ".." in value.split("/"):
                raise ValueError(f"Unsafe reviewed-art path: {value}")
        if row["old_path"] in old_paths or row["delivery_path"] in delivery_paths:
            raise ValueError("Duplicate reviewed-art mapping")
        for key in ("old_sha256", "sha256", "native_sha256"):
            if not re.fullmatch(r"[0-9a-f]{64}", row[key]):
                raise ValueError(f"Invalid reviewed-art digest: {row['id']} {key}")
        old_paths.add(row["old_path"])
        delivery_paths.add(row["delivery_path"])
    return rows


REPLACEMENTS = load_replacements()
BY_OLD_PATH = {row["old_path"]: row for row in REPLACEMENTS}
_TOKEN = re.compile(r"""(?P<lead>["'\x60(])(?P<value>[^\s"'\x60<>()]+)(?=["'\x60)])""")


def is_retired_art(relative: Path) -> bool:
    return "/" + relative.as_posix().lstrip("/") in BY_OLD_PATH


def rewrite_reviewed_art_urls(raw: str, relative: Path) -> str:
    """Rewrite exact URL tokens, including stale query hashes and relative src."""
    def replace(match: re.Match) -> str:
        value = match.group("value")
        if value.startswith(("#", "?")):
            return match.group(0)
        try:
            parsed = urlsplit(value)
        except ValueError:
            return match.group(0)
        if parsed.scheme or parsed.netloc:
            if parsed.scheme not in {"", "http", "https"} or parsed.hostname != "northstarprime.net":
                return match.group(0)
        resolved = "/" + posixpath.normpath(
            parsed.path.lstrip("/") if parsed.path.startswith("/")
            else posixpath.join(relative.parent.as_posix(), parsed.path)
        ).lstrip("/")
        row = BY_OLD_PATH.get(resolved)
        if row is None:
            return match.group(0)
        target = row["delivery_path"] + "?v=" + row["sha256"][:16]
        if parsed.netloc:
            target = (parsed.scheme + ":" if parsed.scheme else "") + "//" + parsed.netloc + target
        if parsed.fragment:
            target += "#" + parsed.fragment
        return match.group("lead") + target
    return _TOKEN.sub(replace, raw)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_source(root: Path) -> None:
    """Fail closed if either reviewed old bytes or new delivery bytes drift."""
    for row in REPLACEMENTS:
        old = root / row["old_path"].lstrip("/")
        new = root / row["delivery_path"].lstrip("/")
        if not old.is_file() or sha256(old) != row["old_sha256"]:
            raise ValueError(f"Reviewed original changed or missing: {row['old_path']}")
        if not new.is_file() or new.stat().st_size != row["bytes"] or sha256(new) != row["sha256"]:
            raise ValueError(f"Reviewed delivery changed or missing: {row['delivery_path']}")


def verify_artifact(artifact: Path) -> list[str]:
    failures: list[str] = []
    for row in REPLACEMENTS:
        old = artifact / row["old_path"].lstrip("/")
        new = artifact / row["delivery_path"].lstrip("/")
        if old.exists():
            failures.append(f"Retired artwork leaked into artifact: {row['old_path']}")
        if not new.is_file() or new.stat().st_size != row["bytes"] or sha256(new) != row["sha256"]:
            failures.append(f"Reviewed artwork bytes mismatch: {row['delivery_path']}")
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
    return failures


def release_record() -> dict:
    return {
        "schema": "northstar.pages-reviewed-art.v1",
        "scope": "Six exact cover variants; not whole-site creative acceptance",
        "retired_paths": sorted(BY_OLD_PATH),
        "delivery": [
            {key: row[key] for key in ("id", "delivery_path", "sha256", "bytes")}
            for row in REPLACEMENTS
        ],
    }
