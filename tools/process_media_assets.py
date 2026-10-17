#!/usr/bin/env python3
"""Convert and deploy TCG, Manga, and Comic web assets into northstarprime-always-on."""

import json
import re
from pathlib import Path
from PIL import Image

NSP_ROOT = Path(__file__).resolve().parents[1]
TCG_SRC = Path(r"F:\NORTHSTAR_OS\MASTER_ASSETS\02_TRADING_CARDS_TCG")
MANGA_SRC = Path(r"F:\NORTHSTAR_OS\MASTER_ASSETS\04_BOOKS_AND_COMICS\Comics\Duel_Zexal_Iconic_Spirits\assets\tankobon_vol_01")
COMICS_SRC = Path(r"F:\NORTHSTAR_OS\MASTER_ASSETS\04_BOOKS_AND_COMICS\Comics")

def process_tcg():
    tcg_dest = NSP_ROOT / "tcg" / "assets" / "cards"
    tcg_dest.mkdir(parents=True, exist_ok=True)

    with open(TCG_SRC / "index.html", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"const cardsData = (\[.*?\]);", content)
    if not m:
        raise ValueError("Could not find cardsData in master TCG index")
    cards_data = json.loads(m.group(1))

    total_bytes = 0
    converted_count = 0
    for c in cards_data:
        src_file = TCG_SRC / c["rel_path"]
        if not src_file.exists():
            print(f"Missing card: {src_file}")
            continue
        dest_file = tcg_dest / f"{c['code']}.webp"
        with Image.open(src_file) as im:
            w, h = im.size
            if h > 850:
                new_w = int(w * (850 / h))
                im = im.resize((new_w, 850), Image.Resampling.LANCZOS)
            im.save(dest_file, "WEBP", quality=85, method=6)
        total_bytes += dest_file.stat().st_size
        converted_count += 1

    print(f"TCG: Converted {converted_count} cards ({total_bytes / (1024*1024):.2f} MB)")
    return cards_data

def process_manga():
    manga_dest = NSP_ROOT / "manga" / "assets" / "tankobon_vol_01"
    manga_dest.mkdir(parents=True, exist_ok=True)

    total_bytes = 0
    converted_count = 0
    for p_img in sorted(MANGA_SRC.glob("*.png")):
        dest_file = manga_dest / f"{p_img.stem}.webp"
        with Image.open(p_img) as im:
            w, h = im.size
            if h > 1600:
                new_w = int(w * (1600 / h))
                im = im.resize((new_w, 1600), Image.Resampling.LANCZOS)
            im.save(dest_file, "WEBP", quality=85, method=6)
        total_bytes += dest_file.stat().st_size
        converted_count += 1

    print(f"MANGA: Converted {converted_count} pages ({total_bytes / (1024*1024):.2f} MB)")

def process_comics():
    covers_dest = NSP_ROOT / "comics" / "assets" / "covers"
    covers_dest.mkdir(parents=True, exist_ok=True)

    cover_sources = {
        "blazin_beaver_s1.webp": COMICS_SRC / "Blazin_Beaver_Series_01" / "assets" / "covers" / "Cover_Trade_Paperback.png",
        "blazin_beaver_s2.webp": COMICS_SRC / "Blazin_Beaver_Series_02" / "assets" / "covers" / "Cover_Issue_01.png",
        "blazin_beaver_s3.webp": COMICS_SRC / "Blazin_Beaver_Series_03" / "assets" / "covers" / "Cover_Issue_01.png",
        "blazin_beaver_s4.webp": COMICS_SRC / "Blazin_Beaver_Series_04" / "assets" / "covers" / "Cover_Series_04.jpg",
        "vorath_mysteries_s1.webp": COMICS_SRC / "Uncle_Vorath_Mysteries_Season_01" / "assets" / "covers" / "Cover_Issue_01.png",
        "vorath_mysteries_s2.webp": COMICS_SRC / "Uncle_Vorath_Mysteries_Season_02" / "assets" / "covers" / "Cover_Season_02.jpg",
        "duel_zexal_vol1.webp": COMICS_SRC / "Duel_Zexal_Iconic_Spirits" / "Duel_Zexal_Vol_1_Cover.jpg",
    }

    total_bytes = 0
    converted_count = 0
    for out_name, src_path in cover_sources.items():
        if not src_path.exists():
            print(f"Cover missing: {src_path}")
            continue
        dest_path = covers_dest / out_name
        with Image.open(src_path) as im:
            w, h = im.size
            if h > 1000:
                new_w = int(w * (1000 / h))
                im = im.resize((new_w, 1000), Image.Resampling.LANCZOS)
            im.save(dest_path, "WEBP", quality=85)
        total_bytes += dest_path.stat().st_size
        converted_count += 1

    print(f"COMICS: Converted {converted_count} covers ({total_bytes / (1024*1024):.2f} MB)")

if __name__ == "__main__":
    process_tcg()
    process_manga()
    process_comics()
