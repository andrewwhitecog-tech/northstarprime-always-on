import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Update arcade/lab/index.html
lab_path = ROOT / "arcade" / "lab" / "index.html"
lab_text = lab_path.read_text(encoding="utf-8")

if "/arcade/custom/northstar-chrono-defender/" not in lab_text:
    target = '<li><a href="/arcade/custom/logic-foundry/">Logic Foundry \u2192</a></li>'
    insert = '<li><a href="/arcade/custom/northstar-chrono-defender/">NorthStar Chrono Defender \u2192</a></li>'
    lab_text = lab_text.replace(target, target + insert)
    lab_text = lab_text.replace("51 original playable browser games", "52 original playable browser games")
    lab_text = lab_text.replace("Fifty-one cabinets. Live to play.", "Fifty-two cabinets. Live to play.")
    lab_text = lab_text.replace("directory of all fifty-one original browser games", "directory of all fifty-two original browser games")
    lab_text = lab_text.replace("All fifty-one cabinets are preserved", "All fifty-two cabinets are preserved")
    lab_path.write_text(lab_text, encoding="utf-8")
    print("Updated arcade/lab/index.html with northstar-chrono-defender link and 52 cabinet count")

# 2. Update ARCADE_FREEZE_MANIFEST.json
manifest_path = ROOT / "ARCADE_FREEZE_MANIFEST.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

# Check if northstar-chrono-defender is in games
existing_slugs = {g["slug"] for g in manifest["games"]}
if "northstar-chrono-defender" not in existing_slugs:
    cd_file = ROOT / "arcade" / "custom" / "northstar-chrono-defender" / "index.html"
    cd_lf = cd_file.read_bytes().replace(b"\r\n", b"\n")
    cd_row = {
        "output_bytes": len(cd_lf),
        "output_relative": "arcade/custom/northstar-chrono-defender/index.html",
        "output_sha256": hashlib.sha256(cd_lf).hexdigest(),
        "route": "/arcade/custom/northstar-chrono-defender",
        "server_fallbacks": [],
        "slug": "northstar-chrono-defender",
        "source_relative": "arcade/custom/northstar-chrono-defender/index.html",
        "source_root_id": "always_on",
        "source_sha256": hashlib.sha256(cd_lf).hexdigest(),
        "state": "flagship_playable",
        "title": "NorthStar Chrono Defender: 360 Edition"
    }
    manifest["games"].append(cd_row)
    manifest["games"].sort(key=lambda g: g["slug"])
    print("Added northstar-chrono-defender to manifest games")

manifest["catalog_game_count"] = len(manifest["games"]) + len(manifest["delegated_routes"])
manifest["mirrored_game_count"] = len(manifest["games"])

# Update hashes for landing, workshop, catalog
for key in ("landing", "workshop", "catalog"):
    p = ROOT / manifest[key]["relative_path"]
    if p.is_file():
        lf = p.read_bytes().replace(b"\r\n", b"\n")
        manifest[key]["bytes"] = len(lf)
        manifest[key]["sha256"] = hashlib.sha256(lf).hexdigest()

# Update hashes for all games
for g in manifest["games"]:
    p = ROOT / g["output_relative"]
    if p.is_file():
        lf = p.read_bytes().replace(b"\r\n", b"\n")
        g["output_bytes"] = len(lf)
        g["output_sha256"] = hashlib.sha256(lf).hexdigest()

manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Manifest written: catalog_game_count={manifest['catalog_game_count']}, mirrored={manifest['mirrored_game_count']}")
