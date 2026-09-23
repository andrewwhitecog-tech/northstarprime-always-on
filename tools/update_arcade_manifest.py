#!/usr/bin/env python3
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / "ARCADE_FREEZE_MANIFEST.json"
data = json.loads(manifest_path.read_text(encoding="utf-8"))

for g in data.get("games", []):
    if g["slug"] in ("vorath-arena", "vorath-dominion", "vorath-incursion"):
        p = ROOT / g["output_relative"]
        raw_lf = p.read_bytes().replace(b"\r\n", b"\n")
        g["output_bytes"] = len(raw_lf)
        g["output_sha256"] = hashlib.sha256(raw_lf).hexdigest()
        print(f"Updated {g['slug']}: bytes={g['output_bytes']}, sha256={g['output_sha256']}")

manifest_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print("Updated ARCADE_FREEZE_MANIFEST.json!")
