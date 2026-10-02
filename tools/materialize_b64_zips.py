#!/usr/bin/env python3
"""Materialize tip/download (and other) binaries from *.b64 (+ .partNN) inside a Pages artifact."""
from __future__ import annotations

import argparse
import base64
import re
import sys
from pathlib import Path


def materialize(output: Path) -> int:
    count = 0
    for b64_path in sorted(output.rglob("*.b64")):
        if ".b64.part" in b64_path.name:
            continue
        # stem.ext.b64 -> stem.ext
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
            raise ValueError(f"Unexpected b64 part name: {part.relative_to(output).as_posix()}")
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
