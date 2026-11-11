#!/usr/bin/env python3
"""Deterministically refresh ARCADE_FREEZE_MANIFEST.json hashes and casino runtime assets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "ARCADE_FREEZE_MANIFEST.json"


def sha256_bytes(buf: bytes) -> str:
    return hashlib.sha256(buf).hexdigest()


def refresh_lf_entry(entry: dict, size_key: str = "bytes", sha_key: str = "sha256", rel_key: str = "relative_path") -> None:
    rel = entry.get(rel_key)
    if not rel:
        return
    p = ROOT / rel
    if p.is_file():
        raw_lf = p.read_bytes().replace(b"\r\n", b"\n")
        entry[size_key] = len(raw_lf)
        entry[sha_key] = sha256_bytes(raw_lf)


def main() -> None:
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    if "landing" in data:
        refresh_lf_entry(data["landing"])
    if "workshop" in data:
        refresh_lf_entry(data["workshop"])
    if "catalog" in data:
        refresh_lf_entry(data["catalog"])

    for g in data.get("games", []):
        refresh_lf_entry(g, size_key="output_bytes", sha_key="output_sha256", rel_key="output_relative")

    assets: list[dict] = data.get("assets", [])
    by_rel: dict[str, dict] = {row["relative_path"]: row for row in assets}

    # Refresh any existing copy-transform asset present on disk without dropping optimized/redacted source pins
    for row in assets:
        if row.get("transform") == "copy":
            p = ROOT / row["relative_path"]
            if p.is_file():
                raw = p.read_bytes()
                digest = sha256_bytes(raw)
                row["bytes"] = len(raw)
                row["sha256"] = digest
                row["source_bytes"] = len(raw)
                row["source_sha256"] = digest

    # Ensure all runtime art/*.webp and audio/*.mp3 for blackjack-noir and slots-biolume + shared idg_cues are tracked
    game_dirs = [
        ("blackjack-noir", ROOT / "arcade" / "custom" / "blackjack-noir"),
        ("slots-biolume", ROOT / "arcade" / "custom" / "slots-biolume"),
    ]
    tracked_candidates: list[tuple[str, list[str], list[str]]] = []
    for slug, gdir in game_dirs:
        for sub in ("art", "audio"):
            sdir = gdir / sub
            if not sdir.is_dir():
                continue
            for fp in sorted(sdir.iterdir()):
                if fp.is_file() and fp.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg", ".mp3", ".ogg", ".wav"}:
                    rel = fp.relative_to(ROOT).as_posix()
                    local_ref = f"./{sub}/{fp.name}"
                    tracked_candidates.append((rel, [local_ref], [slug]))

    shared_cues = [
        ("arcade/custom/audio/idg_cues/cabinet.mp3", ["../audio/idg_cues/cabinet.mp3"], ["blackjack-noir"]),
        ("arcade/custom/audio/idg_cues/pinball_bed.mp3", ["../audio/idg_cues/pinball_bed.mp3"], ["slots-biolume"]),
        ("arcade/custom/audio/idg_cues/skillshot.mp3", ["../audio/idg_cues/skillshot.mp3"], ["blackjack-noir", "slots-biolume"]),
    ]
    tracked_candidates.extend(shared_cues)

    for rel, refs, slugs in tracked_candidates:
        fp = ROOT / rel
        if not fp.is_file():
            continue
        raw = fp.read_bytes()
        digest = sha256_bytes(raw)
        if rel in by_rel:
            row = by_rel[rel]
            row["bytes"] = len(raw)
            row["sha256"] = digest
            row["source_bytes"] = len(raw)
            row["source_sha256"] = digest
            row["referenced_by"] = sorted(set(row.get("referenced_by", [])) | set(slugs))
            row["references"] = sorted(set(row.get("references", [])) | set(refs))
        else:
            row = {
                "relative_path": rel,
                "web_path": f"/{rel}",
                "bytes": len(raw),
                "sha256": digest,
                "source_bytes": len(raw),
                "source_sha256": digest,
                "transform": "copy",
                "resolution_modes": ["exact"],
                "references": refs,
                "referenced_by": slugs,
            }
            assets.append(row)
            by_rel[rel] = row

    data["assets"] = assets
    data["asset_count"] = len(assets)
    data["asset_bytes"] = sum(int(r["bytes"]) for r in assets)
    data["source_asset_bytes"] = sum(int(r.get("source_bytes", r["bytes"])) for r in assets)

    MANIFEST_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Updated ARCADE_FREEZE_MANIFEST.json (asset_count={data['asset_count']}, asset_bytes={data['asset_bytes']})")


if __name__ == "__main__":
    main()
