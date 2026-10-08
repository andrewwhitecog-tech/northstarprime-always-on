"""
Unit and integration tests for NorthStar Mystery School static release.
Verifies the portal doorway, 22-Degree Curriculum Reader, 12 Initiatory Chambers Console,
curriculum specification, and cultural governance charter.
"""
from __future__ import annotations

from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
MS_ROOT = REPO_ROOT / "mystery-school"


def test_mystery_school_portal_exists_and_links():
    portal = MS_ROOT / "index.html"
    assert portal.exists(), "Portal index.html is missing"
    html = portal.read_text(encoding="utf-8")
    assert "/mystery-school/vault/" in html
    assert "/mystery-school/curriculum/" in html
    assert "/mystery-school/chambers/" in html
    assert "/mystery-school/caves/" in html
    assert "/mystery-school/stare-into-the-void/" in html
    assert "/mystery-school/unquiet-archive/" in html
    assert "The Path of Initiation" in html
    assert "The Twelve Chambers" in html
    assert "The Pitch-Black Caves" in html


def test_mystery_school_curriculum_reader():
    curriculum = MS_ROOT / "curriculum" / "index.html"
    assert curriculum.exists(), "Curriculum index.html is missing"
    html = curriculum.read_text(encoding="utf-8")
    assert "The Path of Initiation" in html
    assert "Octave I · Formation" in html
    assert "Octave II · Inner Turning" in html
    assert "Octave III · Restoration" in html
    for deg in range(22):
        assert f"degree: {deg}," in html, f"Degree {deg} missing from JS payload"
    # Ensure zero emoji
    for line in html.splitlines():
        for char in line:
            # Check for emoji unicode block
            code = ord(char)
            assert not (0x1F300 <= code <= 0x1FAFF or 0x1F600 <= code <= 0x1F64F), f"Emoji found in curriculum: {char} (code {code})"


def test_mystery_school_twelve_chambers():
    chambers = MS_ROOT / "chambers" / "index.html"
    assert chambers.exists(), "Chambers index.html is missing"
    html = chambers.read_text(encoding="utf-8")
    assert "Twelve Initiatory Chambers" in html
    for card_idx in range(1, 13):
        card_id = f"card-{card_idx:02d}"
        assert f'id: "{card_id}"' in html or f"id: '{card_id}'" in html, f"Missing chamber {card_id}"


def test_mystery_school_canonical_documents():
    curriculum_doc = MS_ROOT / "PATH_OF_INITIATION.md"
    assert curriculum_doc.exists(), "PATH_OF_INITIATION.md is missing from mystery-school"
    curriculum_text = curriculum_doc.read_text(encoding="utf-8")
    assert "# The Path of Initiation: The Twenty-Two Degrees" in curriculum_text
    assert "Octave I: Formation & Drive" in curriculum_text
    assert "Octave II: Inner Turning & Custody" in curriculum_text
    assert "Octave III: Restoration & Return" in curriculum_text

    charter_doc = MS_ROOT / "CULTURAL_GOVERNANCE_AND_ORIGINAL_IP_CHARTER.md"
    assert charter_doc.exists(), "CULTURAL_GOVERNANCE_AND_ORIGINAL_IP_CHARTER.md is missing"
    charter_text = charter_doc.read_text(encoding="utf-8")
    assert "Cultural Governance & Original IP Charter" in charter_text
    assert "100% Original VORATH Speculative IP" in charter_text


def test_mystery_school_caves_encounter():
    caves = MS_ROOT / "caves" / "index.html"
    assert caves.exists(), "Caves index.html is missing"
    html = caves.read_text(encoding="utf-8")
    assert "The Pitch-Black Caves" in html
    assert "Stratum I: The Basalt Sump" in html
    assert "Stratum II: The Filament Chasm" in html
    assert "Stratum III: The Obsidian Cradle" in html
    assert "Stratum IV: The Covenant Alcove" in html
    assert "Surface Exit" in html


def test_mystery_school_void_ritual():
    void_page = MS_ROOT / "stare-into-the-void" / "index.html"
    assert void_page.exists(), "stare-into-the-void index.html is missing"
    html = void_page.read_text(encoding="utf-8")
    assert "Stare Into The Void" in html
    assert "What stares back from the abyss is love" in html
    assert "1 Min (Reset)" in html
    assert "9 Min (Threads)" in html


def test_mystery_school_unquiet_archive_static():
    page = MS_ROOT / "unquiet-archive" / "index.html"
    assert page.exists(), "unquiet-archive index.html is missing"
    html = page.read_text(encoding="utf-8")
    assert "THE UNQUIET" in html
    assert "999 is the symbol" in html
    assert "988 is the action" in html
    assert "All cases" in html


def test_mystery_school_epstein_files_static():
    page = MS_ROOT / "epstein-files" / "index.html"
    assert page.exists(), "epstein-files index.html is missing"
    html = page.read_text(encoding="utf-8")
    assert "THE EPSTEIN" in html
    assert "Victim-first rule" in html
    assert "How to read a million-page room" in html


def test_mystery_school_reading_room_static():
    page = MS_ROOT / "reading-room" / "index.html"
    assert page.exists(), "reading-room index.html is missing"
    html = page.read_text(encoding="utf-8")
    assert "THE READING" in html
    assert "Inclusion is not endorsement" in html


def test_all_16_mystery_school_rooms_exist_and_zero_emoji():
    """Verify that all 16 rooms exist, are non-empty, and comply with strict zero-emoji standard."""
    expected_rooms = [
        "astrology", "caves", "chambers", "circle", "curriculum",
        "dark-night", "epstein-files", "garden", "high-thoughts",
        "iching", "library", "reading-room", "stare-into-the-void",
        "unquiet-archive", "vault", "workshop"
    ]
    for room in expected_rooms:
        room_index = MS_ROOT / room / "index.html"
        assert room_index.exists(), f"Room '{room}' is missing index.html"
        text = room_index.read_text(encoding="utf-8")
        assert len(text) > 1000, f"Room '{room}' index.html is suspiciously short ({len(text)} chars)"
        for line_num, line in enumerate(text.splitlines(), start=1):
            for char in line:
                code = ord(char)
                assert not (0x1F300 <= code <= 0x1FAFF or 0x1F600 <= code <= 0x1F64F), (
                    f"Forbidden emoji '{char}' (U+{code:04X}) detected in {room}/index.html on line {line_num}"
                )


def test_all_22_static_vault_transmissions_exist_and_render():
    """Verify that all 22 static vault transmission pages exist, have valid markup, and zero emoji."""
    expected_slugs = [
        "threshold", "will", "veil", "garden", "throne",
        "teacher", "mirror", "drive", "beast", "lantern",
        "turning", "scales", "suspension", "compost", "alchemy",
        "chain", "lightning", "well", "tide", "dawn",
        "call", "return"
    ]
    vault_dir = MS_ROOT / "vault"
    for deg_idx, slug in enumerate(expected_slugs):
        trans_page = vault_dir / slug / "index.html"
        assert trans_page.exists(), f"Transmission static page missing at {trans_page}"
        html_content = trans_page.read_text(encoding="utf-8")
        assert len(html_content) > 12000, f"Transmission {slug} content unexpectedly short ({len(html_content)} bytes)"
        assert f"Degree {deg_idx}" in html_content
        assert "Subterranean Ground Resonance" in html_content
        assert "144 Hz Sine Drone" in html_content
        assert "Download Markdown" in html_content
        for line_num, line in enumerate(html_content.splitlines(), start=1):
            for char in line:
                code = ord(char)
                assert not (0x1F300 <= code <= 0x1FAFF or 0x1F600 <= code <= 0x1F64F), (
                    f"Forbidden emoji '{char}' (U+{code:04X}) detected in vault/{slug}/index.html on line {line_num}"
                )




