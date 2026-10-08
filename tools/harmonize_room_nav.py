"""
Harmonize navigation and cross-passage links across core Mystery School rooms:
dark-night, garden, workshop, circle, library.
Ensures responsive mobile wrapping, cross-room discoverability, zero emoji,
and absolute multi-directory parity.
"""
import os
import re
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MS_ROOT = REPO_ROOT / "mystery-school"

PRIME_MS = Path(r"C:\Users\andre\scripts\the_workshop\projects\NORTHSTAR_PRIME\static\mystery_school")
OS_MS = Path(r"F:\NORTHSTAR_OS\Projects\MYSTERY_SCHOOL")
DL_MS = Path(r"C:\Users\andre\Downloads\NORTHSTAR_MYSTERY_SCHOOL")

ROOMS = ["dark-night", "garden", "workshop", "circle", "library"]

ROOM_NAMES = {
    "dark-night": "Dark Night",
    "garden": "Garden",
    "workshop": "Workshop",
    "circle": "Circle",
    "library": "Library"
}

ALL_NAV_ITEMS = [
    ("Directory", "/mystery-school/"),
    ("Curriculum", "/mystery-school/curriculum/"),
    ("12 Chambers", "/mystery-school/chambers/"),
    ("Vault", "/mystery-school/vault/"),
    ("Caves", "/mystery-school/caves/"),
    ("Dark Night", "/mystery-school/dark-night/"),
    ("Library", "/mystery-school/library/"),
    ("Workshop", "/mystery-school/workshop/"),
    ("Circle", "/mystery-school/circle/"),
    ("Garden", "/mystery-school/garden/")
]


def update_room(room: str):
    file_path = MS_ROOT / room / "index.html"
    if not file_path.exists():
        print(f"Skipping {room}, not found at {file_path}")
        return

    text = file_path.read_text(encoding="utf-8")

    # 1. Update .nav-links CSS to include flex-wrap: wrap
    text = re.sub(
        r"(\.nav-links\s*\{[^}]*display:\s*flex;)([^}]*\})",
        r"\1 flex-wrap: wrap;\2",
        text
    )

    # 2. Update .passages-nav CSS to use auto-fit
    text = re.sub(
        r"(\.passages-nav\s*\{[^}]*grid-template-columns:\s*)repeat\(3,\s*1fr\)(;[^}]*\})",
        r"\1repeat(auto-fit, minmax(220px, 1fr))\2",
        text
    )

    # 3. Build unified nav links for this room (exclude self)
    nav_links_html = []
    for label, href in ALL_NAV_ITEMS:
        if href == f"/mystery-school/{room}/":
            continue
        nav_links_html.append(f'        <a href="{href}">{label}</a>')
    
    new_nav_block = "<nav class=\"nav-links\">\n" + "\n".join(nav_links_html) + "\n      </nav>"

    # Replace <nav class="nav-links">...</nav>
    text = re.sub(
        r"<nav class=\"nav-links\">.*?</nav>",
        new_nav_block,
        text,
        flags=re.DOTALL
    )

    # 4. Add Caves & Curriculum cards into passages-nav if not already present
    if "/mystery-school/caves/" not in text:
        cave_card = """        <a class="passage-card" href="/mystery-school/caves/">
          <span>Subterranean</span>
          Descend To The Pitch-Black Caves &rarr;
        </a>\n"""
        text = re.sub(
            r'(<nav class="passages-nav">\s*)',
            r'\1' + cave_card,
            text
        )

    if "/mystery-school/curriculum/" not in text:
        curriculum_card = """        <a class="passage-card" href="/mystery-school/curriculum/">
          <span>Curriculum</span>
          The 22-Degree Path of Initiation &rarr;
        </a>\n"""
        text = re.sub(
            r'(<nav class="passages-nav">\s*)',
            r'\1' + curriculum_card,
            text
        )

    # Zero emoji check
    for line_num, line in enumerate(text.splitlines(), start=1):
        for char in line:
            code = ord(char)
            assert not (0x1F300 <= code <= 0x1FAFF or 0x1F600 <= code <= 0x1F64F), (
                f"Forbidden emoji '{char}' (U+{code:04X}) detected in {room}/index.html on line {line_num}"
            )

    file_path.write_text(text, encoding="utf-8")
    print(f"Updated {room}/index.html ({len(text)} bytes)")

    # Mirror to PRIME, OS, and DL
    for dest_root in [PRIME_MS, OS_MS, DL_MS]:
        dest_dir = dest_root / room
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / "index.html").write_text(text, encoding="utf-8")
        print(f"  -> Mirrored to {dest_dir / 'index.html'}")


def main():
    for room in ROOMS:
        update_room(room)
    print("Harmonization complete across all 5 core rooms.")


if __name__ == "__main__":
    main()
