#!/usr/bin/env python3
"""Harmonize all references to 51 arcade games to 52 across the repo."""
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = Path(__file__).resolve().parent.parent

files_and_subs = [
    ('404.html', [('The Arcade (51 Games)', 'The Arcade (52 Games)')]),
    ('access/index.html', [
        ('Fifty-one live arcade games', 'Fifty-two live arcade games'),
        ('fifty-one arcade games', 'fifty-two arcade games'),
        ('The Arcade (51 Games)', 'The Arcade · 52 Games')
    ]),
    ('arcade/lab/index.html', [
        ('51 original playable browser games', '52 original playable browser games'),
        ('Fifty-one cabinets. Live to play.', 'Fifty-two cabinets. Live to play.'),
        ('all fifty-one original browser games', 'all fifty-two original browser games'),
        ('All fifty-one cabinets are preserved', 'All fifty-two cabinets are preserved'),
        ('<li><a href="/arcade/custom/subject-000999/">Subject 000999 →</a></li>',
         '<li><a href="/arcade/custom/subject-000999/">Subject 000999 →</a></li><li><a href="/arcade/custom/system1-arena/">System 1: Tactical Arena →</a></li>')
    ]),
    ('brand/idc-studios/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('brand/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('gallery/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('index.html', [
        ('The Arcade · 51 Games', 'The Arcade · 52 Games'),
        ('51 games, films, original music', '52 games, films, original music')
    ]),
    ('mystery-school/iching/iching_data.js', [('and 51 games.', 'and 52 games.')]),
    ('solarium/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('spacecash/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('stickers/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('video/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('videos/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')]),
    ('watch/index.html', [('The Arcade · 51 Games', 'The Arcade · 52 Games')])
]

count = 0
for rel_path, subs in files_and_subs:
    file_path = REPO_ROOT / rel_path
    if not file_path.exists():
        print(f"File not found: {file_path}")
        continue
    content = file_path.read_text(encoding='utf-8')
    modified = False
    for old, new in subs:
        if old in content:
            content = content.replace(old, new)
            print(f"Replaced in {rel_path}: '{old}' -> '{new}'")
            count += 1
            modified = True
        else:
            print(f"Pattern '{old}' not found in {rel_path}")
    if modified:
        file_path.write_text(content, encoding='utf-8')

print(f"Total replacements made: {count}")
