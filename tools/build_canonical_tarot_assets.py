#!/usr/bin/env python3
"""Build canonical VORATH Tarot web assets and data index directly from master sources.

Sources:
- Master Card Art: C:\\Users\\andre\\Pictures\\products\\vorathic_tarot\\vorathic_tarot_v2_20260414\\ (78 PNGs)
- Canonical Lore: C:\\Users\\andre\\scripts\\the_workshop\\projects\\northstarprime-always-on\\extracted_guidebook.txt
- Symmetrical Reversible Card Back: C:\\Users\\andre\\.gemini\\antigravity\\brain\\8afa79bd-3c1b-479d-b7d0-cd92225227dd\\card_back_symmetrical.jpg
"""

import json
import re
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r"C:\Users\andre\Pictures\products\vorathic_tarot\vorathic_tarot_v2_20260414")
GUIDEBOOK_TXT = REPO_ROOT / "extracted_guidebook.txt"
CARD_BACK_SRC = Path(r"C:\Users\andre\.gemini\antigravity\brain\8afa79bd-3c1b-479d-b7d0-cd92225227dd\card_back_symmetrical.jpg")

DEST_CARDS_DIR = REPO_ROOT / "tarot" / "cards"
DEST_ORACLE_DIR = REPO_ROOT / "tarot" / "oracle"

DEST_CARDS_DIR.mkdir(parents=True, exist_ok=True)
DEST_ORACLE_DIR.mkdir(parents=True, exist_ok=True)

# 1. Convert Symmetrical Card Back
if CARD_BACK_SRC.exists():
    im_back = Image.open(CARD_BACK_SRC)
    im_back_resized = im_back.resize((600, 900), Image.Resampling.LANCZOS)
    im_back_resized.save(REPO_ROOT / "tarot" / "card_back_symmetrical.webp", "WEBP", quality=88)
    im_back.save(REPO_ROOT / "tarot" / "card_back_symmetrical.jpg", "JPEG", quality=90)
    print("Symmetrical card back saved.")

# 2. Convert All 78 Canonical Cards to WebP
converted_count = 0
total_webp_bytes = 0

png_files = sorted(SOURCE_DIR.glob("*.png"))
print(f"Found {len(png_files)} canonical PNG cards in master folder.")

for png_path in png_files:
    stem = png_path.stem
    dest_webp = DEST_CARDS_DIR / f"{stem}.webp"
    
    with Image.open(png_path) as im:
        # High-res web size: normalize to 600 x 900 for consistent 3D rendering
        im_resized = im.resize((600, 900), Image.Resampling.LANCZOS)
        im_resized.save(dest_webp, "WEBP", quality=86, method=6)
        
    converted_count += 1
    total_webp_bytes += dest_webp.stat().st_size

print(f"Converted {converted_count} cards to WebP. Total size: {total_webp_bytes / (1024*1024):.2f} MB")

# 3. Parse Full Lore from Guidebook
text = GUIDEBOOK_TXT.read_text(encoding="utf-8")

# Map filenames to card data
# Major Arcana mapping
MAJORS_MAP = {
    "00_the_fool": ("0", "The Fool", "The Reveler", "The Zero Thread (The Void Potential)"),
    "01_the_magician": ("I", "The Magician", "The Prism Saint", "Thread I (The Ray of Division)"),
    "02_the_high_priestess": ("II", "The High Priestess", "The Veiled Oracle", "Thread II (The Unseen Current)"),
    "03_the_empress": ("III", "The Empress", "The Crystal Mother", "Thread III (The Abyssal Bloom)"),
    "04_the_emperor": ("IV", "The Emperor", "The Ringmaster", "Thread IV (The Perimeter of Law)"),
    "05_the_hierophant": ("V", "The Hierophant", "The Hierophant of Glyphs", "Thread V (The Inscribed Word)"),
    "06_the_lovers": ("VI", "The Lovers", "The Twin Threads", "Thread VI (The Entangled Pair)"),
    "07_the_chariot": ("VII", "The Chariot", "The Siege Leviathan", "Thread VII (The Kinetic Vector)"),
    "08_strength": ("VIII", "Strength", "The Beast-Tamer", "Thread VIII (The Harmonic Hold)"),
    "09_the_hermit": ("IX", "The Hermit", "The Glow-Touched Ascetic", "Thread IX (The Solitary Luminescence)"),
    "10_wheel_of_fortune": ("X", "Wheel of Fortune", "The Vorathic Clock", "Thread X (The Great Rotator)"),
    "11_justice": ("XI", "Justice", "The Justiciar", "Thread XI (The Equated Beam)"),
    "12_the_hanged_man": ("XII", "The Hanged Man", "The Refracted Martyr", "Thread XII (The Inverted Perspective)"),
    "13_death": ("XIII", "Death", "The Ouroboros", "Thread XIII (The Dissolution and Return)"),
    "14_temperance": ("XIV", "Temperance", "The Alchemist of Light", "Thread XIV (The Perfect Blend)"),
    "15_the_devil": ("XV", "The Devil", "The Greater Daemon", "Thread XV (The Gilded Fetters)"),
    "16_the_tower": ("XVI", "The Tower", "The Overload", "Thread XVI (The Lightning Bolt)"),
    "17_the_star": ("XVII", "The Star", "The Northstar", "Thread XVII (The Well of Hope)"),
    "18_the_moon": ("XVIII", "The Moon", "The Sacred Abyss", "Thread XVIII (The Silver Mirage)"),
    "19_the_sun": ("XIX", "The Sun", "The Radiant Bloom", "Thread XIX (The Solar Zenith)"),
    "20_judgement": ("XX", "Judgement", "The Ascension", "Thread XX (The Awakening Call)"),
    "21_the_world": ("XXI", "The World", "VORATH", "Thread XXI (The Completed Circle)"),
}

# Minor mapping helpers
SUIT_META = {
    "wands": ("Crystals", "Fire & Radiant Ether", "Spiritual Will, Creation, Passion, Mutation"),
    "cups": ("Chalices", "Water & Abyssal Tide", "Intuition, Communion, Deep Emotion, Transfiguration"),
    "swords": ("Lasers", "Air & Coherent Light", "Intellect, Severe Logic, Cutting Truth, Liberation"),
    "pentacles": ("Glyphs", "Earth & Sacred Relics", "Physical Architecture, Wealth, Manifestation, Craft"),
}

RANK_NAMES = {
    "ace": "Ace", "02": "Two", "03": "Three", "04": "Four", "05": "Five",
    "06": "Six", "07": "Seven", "08": "Eight", "09": "Nine", "10": "Ten",
    "page": "Acolyte", "knight": "Justiciar", "queen": "Saint", "king": "Sovereign"
}

RANK_NUMERALS = {
    "ace": "A", "02": "II", "03": "III", "04": "IV", "05": "V",
    "06": "VI", "07": "VII", "08": "VIII", "09": "IX", "10": "X",
    "page": "Acolyte", "knight": "Justiciar", "queen": "Saint", "king": "Sovereign"
}

deck_data = []

# Build 78 cards
for p in png_files:
    stem = p.stem
    card_img_rel = f"/tarot/cards/{stem}.webp"
    
    if stem in MAJORS_MAP:
        numeral, name, archetype, thread = MAJORS_MAP[stem]
        
        # Regex search for the card's section in guidebook
        # e.g., 0 · THE FOOL or I · THE MAGICIAN
        pattern = re.compile(rf"{re.escape(numeral)}\s*·\s*{re.escape(name.upper())}(.*?)(?=\n[0-9IVXLCDM]+\s*·|\nPART III|\Z)", re.DOTALL)
        m = pattern.search(text)
        
        upright = ""
        inverted = ""
        scripture = ""
        
        if m:
            block = m.group(1)
            up_match = re.search(r"Upright\s*\(Refraction\):\s*(.*?)(?=\nInverted|\nCodex Scripture|\Z)", block, re.DOTALL)
            inv_match = re.search(r"Inverted\s*\(Fracture\):\s*(.*?)(?=\nCodex Scripture|\Z)", block, re.DOTALL)
            scrip_match = re.search(r"Codex Scripture:\s*\"?(.*?)\"?\s*$", block, re.DOTALL)
            
            if up_match: upright = " ".join(up_match.group(1).split())
            if inv_match: inverted = " ".join(inv_match.group(1).split())
            if scrip_match: scripture = " ".join(scrip_match.group(1).split()).strip('"')
            
        card_entry = {
            "id": stem,
            "name": name,
            "numeral": numeral,
            "suit": "Major Arcana",
            "archetype": archetype,
            "thread": thread,
            "upright": upright,
            "inverted": inverted,
            "scripture": scripture,
            "image": card_img_rel
        }
        deck_data.append(card_entry)
        
    elif stem.startswith("minor_"):
        parts = stem.split("_")
        suit_key = parts[1] # cups, pentacles, swords, wands
        rank_key = parts[2] # ace, 02..10, page, knight, queen, king
        
        suit_name, element, theme = SUIT_META[suit_key]
        rank_name = RANK_NAMES.get(rank_key, rank_key.capitalize())
        rank_num = RANK_NUMERALS.get(rank_key, rank_key)
        
        card_name = f"{rank_name} of {suit_name}"
        
        # Search for minor entry in text
        # Patterns like: "Ace of Crystals (Seed of Refraction): Upright: ... Reversed: ..."
        # Or: "II of Crystals (The Twin Spires): Upright: ... Reversed: ..."
        search_kw = f"{rank_name} of {suit_name}"
        if rank_key in ["02","03","04","05","06","07","08","09","10"]:
            search_kw_alt = f"{rank_num} of {suit_name}"
        else:
            search_kw_alt = search_kw
            
        pattern = re.compile(rf"(?:{re.escape(search_kw)}|{re.escape(search_kw_alt)})\s*(?:\((.*?)\))?:\s*Upright:\s*(.*?)(?:Reversed:\s*(.*?))(?=\n[A-Z0-9IVXLCDM].*of {suit_name}|\n[0-9]+\.\s*THE SUIT|\nPART IV|\Z)", re.DOTALL)
        m = pattern.search(text)
        
        title_extra = ""
        upright = ""
        inverted = ""
        
        if m:
            title_extra = m.group(1) or ""
            upright = " ".join((m.group(2) or "").split())
            inverted = " ".join((m.group(3) or "").split())
        else:
            # Fallback pattern for acolytes/justiciars etc
            pattern2 = re.compile(rf"{rank_name} of {suit_name}\s*(?:\((.*?)\))?:\s*Upright:\s*(.*?)(?:Reversed:\s*(.*?))(?=\n|\Z)", re.DOTALL)
            m2 = pattern2.search(text)
            if m2:
                title_extra = m2.group(1) or ""
                upright = " ".join((m2.group(2) or "").split())
                inverted = " ".join((m2.group(3) or "").split())
                
        card_entry = {
            "id": stem,
            "name": card_name,
            "subtitle": title_extra,
            "numeral": rank_num,
            "suit": suit_name,
            "element": element,
            "theme": theme,
            "upright": upright,
            "inverted": inverted,
            "image": card_img_rel
        }
        deck_data.append(card_entry)

# Write master deck data JSON
out_json = DEST_ORACLE_DIR / "vorath_deck_data.json"
out_json.write_text(json.dumps(deck_data, indent=2), encoding="utf-8")
print(f"Generated {out_json} with {len(deck_data)} cards.")
