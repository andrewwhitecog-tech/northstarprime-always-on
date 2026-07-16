#!/usr/bin/env python3
"""Browser smoke for the always-on NSP links directory."""

from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "links-smoke"
URL = "http://127.0.0.1:8765/links/"


def smoke(width: int, height: int, name: str) -> dict[str, object]:
    errors: list[str] = []
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": width, "height": height})
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        response = page.goto(URL, wait_until="networkidle")
        if response is None or response.status != 200:
            raise AssertionError(f"links route returned {None if response is None else response.status}")
        page.locator("h1").wait_for(state="visible")
        metrics = page.evaluate(
            """() => ({
              innerWidth: window.innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              externalLinks: document.querySelectorAll('a[target="_blank"]').length,
              localCards: [...document.querySelectorAll('a.link')].filter(a => a.getAttribute('href').startsWith('/')).length,
              title: document.title,
              status: document.querySelector('.status')?.textContent.trim(),
              jsonLd: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)
            })"""
        )
        OUTPUT.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUTPUT / f"{name}.png"), full_page=True)
        browser.close()

    if errors:
        raise AssertionError(f"browser errors for {name}: {errors}")
    if metrics["scrollWidth"] > metrics["innerWidth"]:
        raise AssertionError(f"horizontal overflow for {name}: {metrics}")
    if metrics["externalLinks"] != 5 or metrics["localCards"] != 6:
        raise AssertionError(f"unexpected link-card counts for {name}: {metrics}")
    if metrics["title"] != "Signal Directory — NorthStar Prime":
        raise AssertionError(f"unexpected title for {name}: {metrics['title']}")
    if metrics["jsonLd"].get("name") != "NorthStar Prime":
        raise AssertionError(f"invalid JSON-LD for {name}")
    return metrics


def main() -> None:
    results = {
        "desktop": smoke(1440, 900, "desktop-1440x900"),
        "mobile": smoke(390, 844, "mobile-390x844"),
    }
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print("OK: links page browser smoke passed at desktop and mobile sizes")


if __name__ == "__main__":
    main()
