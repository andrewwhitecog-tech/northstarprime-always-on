#!/usr/bin/env python3
"""Materialize tip/download binaries from *.b64 (+ .partNN) inside a Pages artifact.

MCP/GitHub text uploads sometimes corrupt lowercase ASCII d. Parts may use ! as a
stand-in for d; we map ! -> d before base64 decode (plain base64 never contains !).
Also supports uppercase hex via *.hex / *.hex.partNN as a fallback path.
"""
from __future__ import annotations

import argparse
import base64
import re
import sys
from pathlib import Path


def _transport_decode(text: str) -> str:
    return "".join(text.split()).replace("!", "d")


def _write_zip(out_path: Path, raw: bytes, label: str) -> None:
    if out_path.name.endswith(".zip") and (len(raw) < 4 or raw[:2] != b"PK"):
        raise ValueError(f"Decoded zip missing PK magic: {label}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(raw)


def materialize(output: Path) -> int:
    count = 0
    for b64_path in sorted(output.rglob("*.b64")):
        if ".b64.part" in b64_path.name:
            continue
        if not b64_path.name.endswith(".b64"):
            continue
        out_name = b64_path.name[: -len(".b64")]
        out_path = b64_path.parent / out_name
        raw = base64.b64decode(_transport_decode(b64_path.read_text(encoding="ascii")), validate=False)
        _write_zip(out_path, raw, b64_path.relative_to(output).as_posix())
        b64_path.unlink(missing_ok=True)
        count += 1

    for hex_path in sorted(output.rglob("*.hex")):
        if ".hex.part" in hex_path.name:
            continue
        if not hex_path.name.endswith(".hex"):
            continue
        out_name = hex_path.name[: -len(".hex")]
        out_path = hex_path.parent / out_name
        raw = bytes.fromhex(_transport_decode(hex_path.read_text(encoding="ascii")))
        _write_zip(out_path, raw, hex_path.relative_to(output).as_posix())
        hex_path.unlink(missing_ok=True)
        count += 1

    def materialize_parts(marker: str, decode) -> int:
        n = 0
        part_files = [p for p in output.rglob("*") if p.is_file() and marker in p.name]
        groups: dict[str, list[tuple[int, Path]]] = {}
        for part in part_files:
            pat = r"^(?P<stem>.+)" + re.escape(marker) + r"(?P<idx>\d+)$"
            m = re.match(pat, part.name)
            if not m:
                raise ValueError(f"Unexpected part name: {part.relative_to(output).as_posix()}")
            groups.setdefault(m.group("stem"), []).append((int(m.group("idx")), part))
        for stem, parts in sorted(groups.items()):
            parts.sort(key=lambda item: item[0])
            idxs = [idx for idx, _ in parts]
            expected = list(range(len(parts)))
            if idxs != expected:
                print(
                    f"skip incomplete parts for {stem}: have {idxs[:5]}{'...' if len(idxs)>5 else ''} "
                    f"n={len(idxs)} (need contiguous 0..N-1)",
                    file=sys.stderr,
                )
                continue
            blob = "".join(_transport_decode(path.read_text(encoding="ascii")) for _, path in parts)
            raw = decode(blob)
            out_path = parts[0][1].parent / stem
            _write_zip(out_path, raw, stem)
            for _, path in parts:
                path.unlink(missing_ok=True)
            n += 1
            print(f"materialized {stem} bytes={len(raw)}")
        return n

    count += materialize_parts(".b64.part", lambda b: base64.b64decode(b, validate=False))
    count += materialize_parts(".hex.part", lambda b: bytes.fromhex(b))
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
