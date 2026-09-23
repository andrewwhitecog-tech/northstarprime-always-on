#!/usr/bin/env python3
"""Systematically purge all emojis across all files in northstarprime-always-on."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Replacements dictionary: file path relative to ROOT -> list of (old_str, new_str)
REPLACEMENTS = {
    "arcade/custom/system1-arena/index.html": [
        ("👁️ Debug Vectors [D]", "✦ Debug Vectors [D]"),
        ("🏷️ Barcode Scanner [B]", "✦ Barcode Scanner [B]"),
        ("💻 Terminal [`]", "✦ Terminal [`]"),
        ("🔊 Audio: ON [M]", "✦ Audio: ON [M]"),
        ("🔄 Reset Arena", "✦ Reset Arena"),
        ("🔇 Audio: OFF [M]", "✦ Audio: OFF [M]"),
    ],
    "arcade/custom/vorath-arena/index.html": [
        ("🏉 Griffball", "GRIFFBALL"),
        ("🎉 Party Mode", "Party Mode"),
        ("🔵 CARRYING", "✦ CARRYING"),
        ('"🏉 GOAL!"', '"GOAL!"'),
        ("🏆 <b style='color:#2fe6ff'>Victory.</b>", "✦ <b style='color:#2fe6ff'>VICTORY.</b>"),
        ("💀 <b style='color:#ff2d55'>Defeat.</b>", "✦ <b style='color:#ff2d55'>DEFEAT.</b>"),
        ("💀 <b style='color:#ff2d55'>The shadows took it.</b>", "✦ <b style='color:#ff2d55'>The shadows took it.</b>"),
        ("🎉 HEADSHOT!", "HEADSHOT!"),
    ],
    "arcade/custom/vorath-dominion/index.html": [
        ('<span class="ic">🍖</span>', '<span class="ic" style="font-size:0.75rem;font-weight:900;">FOOD</span>'),
        ('<span class="ic">🪵</span>', '<span class="ic" style="font-size:0.75rem;font-weight:900;">WOOD</span>'),
        ('<span class="ic">💎</span>', '<span class="ic" style="font-size:0.75rem;font-weight:900;">CRYSTAL</span>'),
        ('<span class="ic">👤</span>', '<span class="ic" style="font-size:0.75rem;font-weight:900;">POP</span>'),
        ("🍖 food", "food"),
        ("🪵 wood", "wood"),
        ("💎 crystal", "crystal"),
        ("⛏️ stone", "stone"),
        ('"🌲"', '"+"'),
        ('"🫐"', '"*"'),
        ('"💎"', '"✦"'),
        ('food:"🍖",wood:"🪵",crystal:"💎",stone:"⛏️"', 'food:"FOOD",wood:"WOOD",crystal:"CRYSTAL",stone:"STONE"'),
        ('food:"🍖",wood:"🪵",crystal:"✦",stone:"⛏️"', 'food:"FOOD",wood:"WOOD",crystal:"CRYSTAL",stone:"STONE"'),
        ('"🔺 "', '"✦ "'),
        ('🔺 Great Pyramid raised', '✦ Great Pyramid raised'),
        ('"🏆 DOMINION"', '"DOMINION VICTORY"'),
        ('"💀 FALLEN"', '"COLONY FALLEN"'),
    ],
    "arcade/custom/vorath-incursion/index.html": [
        ('"💀 OVERRUN"', '"SECTOR OVERRUN"'),
    ],
    "stickerforge/studio/index.html": [
        ("🎲 Auto-Slap Bomb", "✦ Auto-Slap Bomb"),
    ],
    "realm/index.html": [
        ("<h2>📱 Minecraft Bedrock", "<h2>Minecraft Bedrock"),
    ],
    "sigil-forge/visualizer.html": [
        ("🎤 React to music (mic)", "✦ React to music (mic)"),
        ("🎤 reacting to music", "✦ Reacting to music"),
        ("🎤 mic blocked", "✦ Mic blocked"),
    ],
    "hire/onboarding/index.html": [
        ("<span>🛡️</span>", "<span style='color:var(--gold);'>✦</span>"),
        ("<b>🌿 Safe Staging Branches</b>", "<b>✦ Safe Staging Branches</b>"),
        ("<b>🛡️ 100% Money-Back</b>", "<b>✦ 100% Money-Back</b>"),
    ],
    "chronosphere/index.html": [
        ("['🕊','Bird'", "['AVE','Bird'"),
        ("['⌛','Hourglass'", "['HORA','Hourglass'"),
        ("['🐝','Beehive'", "['APIS','Beehive'"),
        ("['🗡','Sword'", "['FERRUM','Sword'"),
        ("['🌍','Globe'", "['ORBIS','Globe'"),
        ("['🦉','Owl'", "['NOX','Owl'"),
        ("['🐍','Serpent'", "['DRACO','Serpent'"),
        ("['🕯','Candle'", "['LUMEN','Candle'"),
        ("['⚡','Thunderbolt'", "['FULGUR','Thunderbolt'"),
        ("'🜁'", "'△'"),
    ],
}

def purge():
    for rel_path, reps in REPLACEMENTS.items():
        p = ROOT / rel_path
        if not p.is_file():
            print(f"Skipping missing {rel_path}")
            continue
        content = p.read_text(encoding="utf-8")
        orig = content
        for old, new in reps:
            content = content.replace(old, new)
        if content != orig:
            p.write_text(content, encoding="utf-8")
            print(f"Cleaned {rel_path}")
        else:
            print(f"No changes needed for {rel_path}")

if __name__ == "__main__":
    purge()
