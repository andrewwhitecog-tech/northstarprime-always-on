"""Keep track cards and the Music Lounge console on the same playback position."""
import io
from pathlib import Path
from urllib.parse import urlsplit
import wave

import pytest
from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("width", [390, 1280])
def test_active_card_pauses_and_resumes(width):
    media = io.BytesIO()
    with wave.open(media, "wb") as wav:
        wav.setparams((1, 2, 8000, 0, "NONE", ""))
        wav.writeframes(bytes(2 * 8000 * 12))

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": width, "height": 844}, has_touch=width == 390)

        def serve(route):
            path = urlsplit(route.request.url).path
            if path == "/music/":
                route.fulfill(path=ROOT / "music/index.html", content_type="text/html")
            elif route.request.resource_type == "media":
                route.fulfill(body=media.getvalue(), content_type="audio/wav",
                              headers={"Access-Control-Allow-Origin": "*"})
            elif path == "/static/front-door.css":
                route.fulfill(path=ROOT / "static/front-door.css", content_type="text/css")
            else:
                route.abort()

        def activate(button):
            if width == 390:
                button.tap()
            else:
                button.click()

        page.route("**/*", serve)
        page.goto("https://northstarprime.net/music/")
        cards = page.locator(".play-track-btn")
        activate(cards.first)
        page.wait_for_function("[...document.querySelectorAll('audio')].some(a => !a.paused)")
        player = page.locator("audio").evaluate_all("players => players.find(a => !a.paused).id")
        audio = page.locator("#" + player)
        audio.evaluate("a => { a.currentTime = 5; }")
        page.wait_for_function("id => document.getElementById(id).currentTime >= 5", arg=player)
        activate(cards.first)
        assert audio.evaluate("a => a.paused && a.currentTime >= 5")
        activate(cards.first)
        page.wait_for_function("id => !document.getElementById(id).paused", arg=player)
        assert audio.evaluate("a => a.currentTime >= 5")
        expect(cards.first).to_have_text("❚❚ Pause")
        activate(page.locator("#btn-play"))
        assert audio.evaluate("a => a.paused")
        activate(cards.nth(1))
        page.wait_for_function("document.querySelectorAll('.track-card')[1].classList.contains('is-playing')")
        expect(cards.first).to_have_text("▶ Stream Track")
        browser.close()
