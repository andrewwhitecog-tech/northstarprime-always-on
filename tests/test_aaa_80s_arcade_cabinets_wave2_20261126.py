"""Regression & VORATH DNA AAA Craft tests for Wave 2 80s Arcade Cabinets & House Site Cleanup."""
from pathlib import Path
import re

REPO = Path(__file__).resolve().parent.parent

CABINETS = [
    ("pac-dharma", "Maze of Nine", "/static/games/marquees_aaa/maze-of-nine.webp", True),
    ("vorath-pinball", "Vorath Cyber Pinball", "/static/games/marquees_aaa/vorath-cyber-pinball.webp", True),
    ("galaga-interdimensional", "Choirfall Armada", "/static/games/marquees_aaa/choirfall-armada.webp", True),
    ("missile-command", "Skyward Bastion: PDX", "/static/games/marquees_aaa/skyward-bastion-pdx.webp", False),
    ("snake-dimension", "Snake Dimension", "/static/games/marquees_aaa/snake-dimension.webp", True),
    ("future-teller-cabinet", "Uncle Vorath's Future Teller", "/static/games/marquees_aaa/future-teller-cabinet.webp", False),
    ("slots-biolume", "Biolume Jackpot", "/static/games/marquees_aaa/biolume-jackpot.webp", False),
    ("asteroids-void", "Ossuary Orbit", "/static/games/marquees_aaa/ossuary-orbit.webp", False),
    ("breakout-wall", "Glyphbreaker", "/static/games/marquees_aaa/glyphbreaker.webp", False),
    ("dharma-invaders", "Commentary Siege", "/static/games/marquees_aaa/commentary-siege.webp", True),
    ("blackjack-noir", "Blackjack Noir", "/static/games/marquees_aaa/blackjack-noir.webp", False),
]


def test_aaa_cabinet_shell_and_marquees_exist():
    assert (REPO / "static" / "games" / "nsp_aaa_cabinet_shell.css").is_file()
    assert (REPO / "static" / "games" / "nsp_aaa_cabinet_shell.js").is_file()
    credits_webp = REPO / "static" / "games" / "marquees_aaa" / "northstar-studios-credits.webp"
    assert credits_webp.is_file() and credits_webp.stat().st_size > 20_000

    for slug, title, marquee, real_sfx in CABINETS:
        art_file = REPO / marquee.lstrip("/")
        assert art_file.is_file(), f"Missing marquee art: {art_file}"
        assert 20_000 < art_file.stat().st_size < 450_000, f"Unexpected size for {art_file}"

        html_p = REPO / "arcade" / "custom" / slug / "index.html"
        html = html_p.read_text(encoding="utf-8", errors="replace")
        assert "/static/games/nsp_aaa_cabinet_shell.css" in html, slug
        assert "/static/games/nsp_aaa_cabinet_shell.js" in html, slug
        assert f'data-nsp-marquee="{marquee}"' in html, slug
        assert f'data-nsp-title="{title}"' in html, slug
        assert f'data-nsp-real-sfx="{"true" if real_sfx else "false"}"' in html, slug


def test_legacy_trademarks_cleaned_and_hub_wired():
    mc_html = (REPO / "arcade" / "custom" / "missile-command" / "index.html").read_text(encoding="utf-8")
    assert "MISSILE COMMAND: NORTHSTAR" not in mc_html
    assert "Skyward Bastion: PDX" in mc_html

    pd_html = (REPO / "arcade" / "custom" / "pac-dharma" / "index.html").read_text(encoding="utf-8")
    assert "Maze of Nine" in pd_html

    hub_html = (REPO / "arcade" / "index.html").read_text(encoding="utf-8")
    for _, _, marquee, _ in CABINETS:
        assert marquee in hub_html, f"Arcade hub missing marquee {marquee}"


def test_house_site_handle_unified():
    idx_html = (REPO / "index.html").read_text(encoding="utf-8")
    lnk_html = (REPO / "links" / "index.html").read_text(encoding="utf-8")
    assert "inaucinihilipilification" not in idx_html.lower()
    assert "inaucinihilipilification" not in lnk_html.lower()
    assert "all in one app" not in idx_html.lower()
    assert "https://www.instagram.com/northstarprimenet/" in idx_html
