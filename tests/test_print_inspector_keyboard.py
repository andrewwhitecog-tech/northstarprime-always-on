from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def test_print_inspector_keyboard():
    page_html = Path(__file__).resolve().parents[1] / "3d-prints" / "index.html"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.route("**/*", lambda route: route.abort())
        page.set_content(page_html.read_text(encoding="utf-8"))

        opener = page.locator(".zoom-trigger").first
        opener.focus()
        page.keyboard.press("Enter")
        expect(page.locator("#plb-close")).to_be_focused()

        for control in ("plb-cta1", "plb-cta2", "plb-view-render"):
            page.keyboard.press("Tab")
            expect(page.locator(f"#{control}")).to_be_focused()
        page.keyboard.press("Shift+Tab")
        expect(page.locator("#plb-cta2")).to_be_focused()

        page.keyboard.press("Tab")
        page.keyboard.press("Tab")
        mesh = page.locator("#plb-view-mesh")
        expect(mesh).to_be_focused()
        page.keyboard.press("Space")
        expect(mesh).to_have_attribute("aria-pressed", "true")
        page.keyboard.press("Escape")
        expect(page.locator("#prints-lightbox")).to_be_hidden()
        expect(opener).to_be_focused()

        page.keyboard.press("Enter")
        expect(page.locator("#plb-view-render")).to_have_attribute("aria-pressed", "true")
        expect(mesh).to_have_attribute("aria-pressed", "false")
        browser.close()
