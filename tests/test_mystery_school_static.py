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
    assert "The Path of Initiation" in html
    assert "The Twelve Chambers" in html


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
