"""
Multi-threaded, workstation-friendly WebP converter for Cookbook Deluxe Media.
Sets process priority to BelowNormal per NorthStar governance rules.
"""
import os
import re
import concurrent.futures
from pathlib import Path
from PIL import Image
import psutil

# Set below normal priority to ensure responsive UI and agent interaction
try:
    p = psutil.Process()
    p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
except Exception as e:
    print(f"Priority notice: {e}")

PHOTO_DIR = Path(r"C:\Users\andre\Pictures\cookbook_photos")
DEST_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\static\cookbook_deluxe_media")
DEST_DIR.mkdir(parents=True, exist_ok=True)

all_photos = []
for p in PHOTO_DIR.rglob("*"):
    if p.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
        all_photos.append(p)

print(f"Total source photos: {len(all_photos)}")

def convert_one(p: Path):
    stem = p.stem.lower()
    clean_stem = re.sub(r"^\d+(_\d+)?[-_]?", "", stem)
    clean_stem = re.sub(r"[^a-z0-9]+", "-", clean_stem).strip("-")
    if not clean_stem:
        clean_stem = stem
    dest_name = f"{clean_stem}.webp"
    dest_path = DEST_DIR / dest_name

    # If already converted and non-empty, skip
    if dest_path.exists() and dest_path.stat().st_size > 0:
        return (dest_name, dest_path.stat().st_size, False)

    try:
        with Image.open(p) as img:
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")
            # If exceedingly large, scale to max dimension 1600
            w, h = img.size
            if max(w, h) > 1600:
                scale = 1600 / max(w, h)
                img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            img.save(dest_path, "WEBP", quality=88, method=2)
            return (dest_name, dest_path.stat().st_size, True)
    except Exception as e:
        print(f"Error converting {p.name}: {e}")
        return (dest_name, 0, False)

converted_count = 0
skipped_count = 0
total_bytes = 0

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    results = list(executor.map(convert_one, all_photos))

for name, sz, was_converted in results:
    if sz > 0:
        total_bytes += sz
        if was_converted:
            converted_count += 1
        else:
            skipped_count += 1

print(f"Newly converted: {converted_count}")
print(f"Already existed: {skipped_count}")
print(f"Total valid media assets: {converted_count + skipped_count}")
print(f"Total size: {total_bytes / (1024*1024):.2f} MB")
