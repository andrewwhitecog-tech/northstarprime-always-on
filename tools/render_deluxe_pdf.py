#!/usr/bin/env python3
"""
Render Digital_MasterCook_Deluxe_Illustrated_Edition.pdf
from Digital_MasterCook_Deluxe_Illustrated_Edition.html using Playwright Chromium.
Strict Zero-Emoji, Truth-First Compliance.
"""
import pathlib
import sys
import time
from playwright.sync_api import sync_playwright
import pypdf

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "static" / "downloads" / "Digital_MasterCook_Deluxe_Illustrated_Edition.html"
PDF_PATH = ROOT / "static" / "downloads" / "Digital_MasterCook_Deluxe_Illustrated_Edition.pdf"

def main():
    if not HTML_PATH.exists():
        print(f"Error: {HTML_PATH} does not exist. Run build_deluxe_illustrated_cookbook.py first.")
        sys.exit(1)

    print(f"Reading HTML source: {HTML_PATH.name} ({HTML_PATH.stat().st_size:,} bytes)...", flush=True)
    start_time = time.time()
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Loading all plates may take up to 2-3 minutes
        page.goto(HTML_PATH.as_uri(), wait_until="networkidle", timeout=300000)
        page.emulate_media(media="print")
        # Give print layout and lazy images a moment to settle
        page.wait_for_timeout(5000)
        
        print(f"Generating Deluxe PDF to {PDF_PATH.name}...", flush=True)
        page.pdf(
            path=str(PDF_PATH),
            prefer_css_page_size=True,
            print_background=True
        )
        browser.close()
    
    elapsed = time.time() - start_time
    pdf_size = PDF_PATH.stat().st_size
    print(f"Deluxe PDF generated in {elapsed:.2f}s, size: {pdf_size:,} bytes", flush=True)
    
    reader = pypdf.PdfReader(str(PDF_PATH))
    total_pages = len(reader.pages)
    print(f"Total Deluxe PDF pages: {total_pages}", flush=True)
    
    first_page_txt = reader.pages[0].extract_text() or ""
    print(f"First page title snippet: {first_page_txt.splitlines()[0] if first_page_txt else 'None'}", flush=True)
    
    return total_pages

if __name__ == "__main__":
    pages = main()
    print(f"Completed MasterCook Deluxe Illustrated Edition publication build: {pages} pages.", flush=True)
