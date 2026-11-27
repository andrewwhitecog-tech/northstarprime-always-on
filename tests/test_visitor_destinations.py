from html.parser import HTMLParser
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SAMPLER = "https://andrewcog.gumroad.com/l/northstar-2026-free-mega-sampler"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.destinations = set()

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.destinations.add(dict(attrs).get("href"))


@pytest.mark.parametrize("route", [".", "store", "play", "links", "merch", "chromatic", "stickerforge/comedy-vault", "parody-drop"])
def test_visitor_can_reach_community_and_free_sampler(route):
    links = Links()
    target = ROOT / "index.html" if route == "." else ROOT / route / "index.html"
    links.feed(target.read_text(encoding="utf-8"))
    assert {"/community/", SAMPLER} <= links.destinations
