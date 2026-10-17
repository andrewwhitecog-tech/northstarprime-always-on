#!/usr/bin/env python3
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / "ARCADE_FREEZE_MANIFEST.json"
data = json.loads(manifest_path.read_text(encoding="utf-8"))

# update landing
landing_p = ROOT / data["landing"]["relative_path"]
if landing_p.is_file():
    raw_lf = landing_p.read_bytes().replace(b"\r\n", b"\n")
    data["landing"]["bytes"] = len(raw_lf)
    data["landing"]["sha256"] = hashlib.sha256(raw_lf).hexdigest()

# update catalog
catalog_p = ROOT / data["catalog"]["relative_path"]
if catalog_p.is_file():
    raw_lf = catalog_p.read_bytes().replace(b"\r\n", b"\n")
    data["catalog"]["bytes"] = len(raw_lf)
    data["catalog"]["sha256"] = hashlib.sha256(raw_lf).hexdigest()

# update games
for g in data.get("games", []):
    p = ROOT / g["output_relative"]
    if p.is_file():
        raw_lf = p.read_bytes().replace(b"\r\n", b"\n")
        g["output_bytes"] = len(raw_lf)
        g["output_sha256"] = hashlib.sha256(raw_lf).hexdigest()

manifest_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print("Updated ARCADE_FREEZE_MANIFEST.json!")

