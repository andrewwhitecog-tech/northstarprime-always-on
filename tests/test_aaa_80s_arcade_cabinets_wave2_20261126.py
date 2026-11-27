"""Regression & VORATH DNA AAA Craft tests for Wave 2+3 (21 Flagship 80s & Penny Arcade Cabinets) & House Site Cleanup."""
from pathlib import Path

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
    # Wave 3 (10 more iconic cabinets -> 21 total)
    ("tetris-plus", "Prism Monolith", "/static/games/marquees_aaa/prism-monolith.webp", True),
    ("void-pong", "Mirror Argument", "/static/games/marquees_aaa/mirror-argument.webp", True),
    ("flappy-dharma", "Sky Dragon Dharma", "/static/games/marquees_aaa/sky-dragon-dharma.webp", True),
    ("super-vorath-bros", "Causeway Courier", "/static/games/marquees_aaa/causeway-courier.webp", True),
    ("vorath-souls", "Vorath Souls: The Bone Gate", "/static/games/marquees_aaa/vorath-souls.webp", False),
    ("vorath-blade-tribunal", "Vorath Blade Tribunal", "/static/games/marquees_aaa/vorath-blade-tribunal.webp", False),
    ("hypernova-swarm", "Hypernova Swarm", "/static/games/marquees_aaa/hypernova-swarm.webp", True),
    ("northstar-chrono-defender", "NorthStar Chrono Defender", "/static/games/marquees_aaa/northstar-chrono-defender.webp", True),
    ("vorath-cabinet-row", "Vorath Cabinet Row", "/static/games/marquees_aaa/vorath-cabinet-row.webp", False),
    ("vorath-prism-runner", "Vorath Prism Runner", "/static/games/marquees_aaa/vorath-prism-runner.webp", True),
    # Wave 4 (10 more iconic cabinets -> 31 total!)
    ("tetris-void", "Gravity Monolith", "/static/games/marquees_aaa/gravity-monolith.webp", False),
    ("prism-masonry", "Prism Masonry", "/static/games/marquees_aaa/prism-masonry.webp", False),
    ("vorath-arena", "Vorath Arena", "/static/games/marquees_aaa/vorath-arena.webp", True),
    ("vorath-delve", "Vorath Delve", "/static/games/marquees_aaa/vorath-delve.webp", False),
    ("vorath-reliquary-gacha-shrine", "Vorath Reliquary: Gacha Shrine", "/static/games/marquees_aaa/vorath-reliquary.webp", False),
    ("vorath-dominion", "Vorath Dominion", "/static/games/marquees_aaa/vorath-dominion.webp", False),
    ("vorath-incursion", "Vorath Incursion", "/static/games/marquees_aaa/vorath-incursion.webp", True),
    ("vorath-circus", "Vorath Circus", "/static/games/marquees_aaa/vorath-circus.webp", True),
    ("vorath-circus-midnight", "Vorath Circus: Mutant Midnight", "/static/games/marquees_aaa/vorath-circus-midnight.webp", True),
    ("vorath-signal-crown", "Vorath Signal Crown", "/static/games/marquees_aaa/vorath-signal-crown.webp", True),
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

    tp_html = (REPO / "arcade" / "custom" / "tetris-plus" / "index.html").read_text(encoding="utf-8")
    assert "Prism Monolith" in tp_html

    tv_html = (REPO / "arcade" / "custom" / "tetris-void" / "index.html").read_text(encoding="utf-8")
    assert "TETRIS VOID" not in tv_html
    assert "Gravity Monolith" in tv_html

    hub_html = (REPO / "arcade" / "index.html").read_text(encoding="utf-8")
    for slug, _, marquee, _ in CABINETS:
        if f"/arcade/custom/{slug}/" in hub_html:
            assert marquee in hub_html, f"Arcade hub missing marquee {marquee} for {slug}"


def test_house_site_handle_unified():
    idx_html = (REPO / "index.html").read_text(encoding="utf-8")
    lnk_html = (REPO / "links" / "index.html").read_text(encoding="utf-8")
    assert "inaucinihilipilification" not in idx_html.lower()
    assert "inaucinihilipilification" not in lnk_html.lower()
    assert "all in one app" not in idx_html.lower()
    assert "https://www.instagram.com/northstarprimenet/" in idx_html
