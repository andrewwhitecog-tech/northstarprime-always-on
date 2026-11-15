import http.server
import socketserver
import threading
import sys
from playwright.sync_api import sync_playwright

PORT = 8926
DIR = r"C:\Users\andre\scripts\the_workshop\projects\wt_shattered_mirror_20261115"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
t = threading.Thread(target=httpd.serve_forever, daemon=True)
t.start()
print("Server listening on", PORT, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    print("Navigating to warband...", flush=True)
    page.goto(f"http://127.0.0.1:{PORT}/warband/index.html", wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    
    # Measure elements on warband
    targets = [
        ("nav_free_pdfs", "nav .nav-links a[href='#codex-pdfs']"),
        ("nav_roster", "nav .nav-links a[href='#roster-builder']"),
        ("nav_forge", "nav .nav-links a[href='/shattered-mirror/']"),
        ("nav_signup", "nav .nav-links a[href='#signup']"),
        ("hero_codex", ".hero .cta-strip a.plaque-primary"),
        ("hero_forge", ".hero .cta-strip a:not(.plaque-primary)"),
        ("pdf_btn_1", ".pdf-card a.vorath-plaque"),
        ("roster_sample", "#preset-combo-btn"),
        ("roster_export", "#export-txt-btn"),
        ("roster_clear", "#clear-roster-btn"),
        ("relic_select", "#relic-select"),
    ]
    for name, sel in targets:
        loc = page.locator(sel).first
        box = loc.bounding_box()
        loc.screenshot(path=f"{DIR}\\shots_crop_{name}.png")
        print(f"warband {name}: {box}", flush=True)
        
    # Shattered mirror elements
    page2 = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    print("Navigating to shattered-mirror...", flush=True)
    page2.goto(f"http://127.0.0.1:{PORT}/shattered-mirror/index.html", wait_until="domcontentloaded")
    page2.wait_for_timeout(1000)
    targets2 = [
        ("nav_home", ".nav-home"),
        ("hud_cartouche", ".hud-cartouche"),
        ("btn_sweep", "#btn-sweep"),
        ("btn_solve", "#btn-solve"),
        ("btn_reshatter", "#btn-reshatter"),
        ("upload_label", "#upload-label"),
        ("btn_record", "#btn-record"),
        ("btn_export", "#btn-export"),
        ("btn_commission", "#btn-commission"),
    ]
    for name, sel in targets2:
        loc = page2.locator(sel).first
        box = loc.bounding_box()
        loc.screenshot(path=f"{DIR}\\shots_crop_{name}.png")
        print(f"shattered {name}: {box}", flush=True)
        
    browser.close()

httpd.shutdown()
print("All crops captured successfully!", flush=True)
