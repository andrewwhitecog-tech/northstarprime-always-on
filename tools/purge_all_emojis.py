#!/usr/bin/env python3
"""Systematically purge any remaining emojis across all HTML files."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def clean_file(rel_path, replacements):
    p = ROOT / rel_path
    if not p.exists():
        return
    content = p.read_text(encoding='utf-8')
    orig = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != orig:
        p.write_text(content, encoding='utf-8')
        print(f"Purged emojis from {rel_path}")

# arcade/custom/vorath-arena/index.html
clean_file("arcade/custom/vorath-arena/index.html", [
    ("🔵 CARRYING", "✦ CARRYING"),
    ('💀 <b style=\'color:#ff2d55\'>The shadows took it.</b>', '✦ <b style=\'color:#ff2d55\'>The shadows took it.</b>'),
])

# arcade/custom/vorath-dominion/index.html
clean_file("arcade/custom/vorath-dominion/index.html", [
    ('food:"🍖",wood:"🪵",crystal:"✦",stone:"⛏️"', 'food:"FOOD",wood:"WOOD",crystal:"CRYSTAL",stone:"STONE"'),
    ('🔺 Great Pyramid raised', '✦ Great Pyramid raised'),
])

print("Targeted emoji cleanup finished.")
