#!/usr/bin/env python3
"""Materialize tip/download zips from *.zip.b64 (+ .partNN) inside a Pages artifact."""
from __future__ import annotations

import argparse
import base64
import re
import sys
from pathlib import Path


def materialize(output: Path) -> int:
    count = 0
    for b64_path in sorted(output.rglob("*.zip.b64")):
        if ".zip.b64.part" in b64_path.name:
            continue
        zip_path = Path(str(b64_path)[: -len(".b64")])
        raw = base64.b64decode("".join(b64_path.read_text(encoding="ascii").split()), validate=False)
        if len(raw) < 4 or raw[:2] != b"PK":
            raise ValueError(f"Decoded zip missing PK magic: {b64_path.relative_to(output).as_posix()}")
        zip_path.parent.mkdir(parents=True, exist_ok=True)
        zip_path.write_bytes(raw)
        b64_path.unlink(missing_ok=True)
        count += 1

    part_files = [p for p in output.rglob("*") if p.is_file() and ".zip.b64.part" in p.name]
    groups: dict[str, list[tuple[int, Path]]] = {}
    for part in part_files:
        m = re.match(r"^(?P<stem>.+\.zip)\.b64\.part(?P<idx>\d+)$", part.name)
        if not m:
            raise ValueError(f"Unexpected b64 part name: {part.relative_to(output).as_posix()}")
        groups.setdefault(m.group("stem"), []).append((int(m.group("idx")), part))
    for stem, parts in sorted(groups.items()):
        parts.sort(key=lambda item: item[0])
        idxs = [idx for idx, _ in parts]
        if idxs != list(range(len(parts))):
            raise ValueError(f"Missing/unordered b64 parts for {stem}: {idxs}")
        blob = "".join(path.read_text(encoding="ascii") for _, path in parts)
        raw = base64.b64decode("".join(blob.split()), validate=False)
        if len(raw) < 4 or raw[:2] != b"PK":
            raise ValueError(f"Decoded zip missing PK magic: {stem}")
        zip_path = parts[0][1].parent / stem
        zip_path.write_bytes(raw)
        for _, path in parts:
            path.unlink(missing_ok=True)
        count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", required=True)
    args = parser.parse_args()
    output = Path(args.artifact).resolve()
    if not output.is_dir():
        print(f"missing artifact dir: {output}", file=sys.stderr)
        return 2
    n = materialize(output)
    print(f"materialized_b64_zips={n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
