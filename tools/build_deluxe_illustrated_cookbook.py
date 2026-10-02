"""
Build Deluxe Illustrated Edition of Digital MasterCook Book.

Ingests the clean reference Digital_MasterCook_Book_Freeware_v09.html grimoire
and binds verified high-resolution culinary photo assets from static/cookbook_deluxe_media,
producing Digital_MasterCook_Deluxe_Illustrated_Edition.html and companion manifest.json.

Strict Zero-Emoji, Truth-First Compliance.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from pathlib import Path
from html.parser import HTMLParser
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = REPO_ROOT / "static"
DOWNLOADS_DIR = STATIC_DIR / "downloads"
MEDIA_DIR = STATIC_DIR / "cookbook_deluxe_media"

SRC_HTML = DOWNLOADS_DIR / "Digital_MasterCook_Book_Freeware_v09.html"
OUT_HTML = DOWNLOADS_DIR / "Digital_MasterCook_Deluxe_Illustrated_Edition.html"
OUT_MANIFEST = DOWNLOADS_DIR / "deluxe_illustrated_cookbook_manifest.json"
PHOTO_VAULT = Path(r"C:\Users\andre\Pictures\cookbook_photos")

STOPWORDS = {
    "and", "the", "with", "from", "for", "style", "recipe", "recipes", "dupe", "dupes",
    "ckd", "kidney", "friendly", "safe", "homemade", "master", "section", "classic",
    "fresh", "white", "low", "sodium", "salt", "serving", "servings", "estimated",
    "andre", "andrews", "andrew", "in", "or", "a", "an", "to", "of", "on", "at"
}

EXPLICIT_ALIASES = [
    # Wave 001 recipes
    (r"waffles", "ckd-waffles.webp"),
    (r"pancakes", "ckd-pancakes.webp"),
    (r"eggs benedict", "ckd-eggs-benedict.webp"),
    (r"sunrise wrap burrito|breakfast burrito", "ckd-breakfast-burrito.webp"),
    (r"kanel morning rolls|cinnamon rolls", "ckd-cinnamon-rolls.webp"),
    (r"dawn patrol breakfast sandwich|breakfast sandwich", "ckd-breakfast-sandwich.webp"),
    (r"hash browns", "ckd-hash-browns.webp"),
    (r"garden fold omelette bar|omelette bar", "ckd-omelette-bar.webp"),
    (r"candlemas crepes|crepes", "ckd-crepes.webp"),
    (r"maple crunch granola|granola", "ckd-granola.webp"),
    (r"morning jar oats|overnight oats", "ckd-overnight-oats.webp"),
    (r"north african skillet eggs|shakshuka", "ckd-shakshuka.webp"),
    (r"stale-tortilla magic chilaquiles|chilaquiles", "ckd-chilaquiles.webp"),
    (r"saturday supreme pizza", "saturday-supreme-pizza.webp"),
    (r"sausage grinding", "from-scratch-sausage-grinding-and-storage.webp"),
    (r"the wings \(base recipe\)|the wings base", "the-wings-base-recipe.webp"),
    (r"kosher meatballs", "kosher-meatballs.webp"),
    (r"halal lamb & chicken gyros|halal lamb and chicken gyros", "halal-lamb-and-chicken-gyros.webp"),
    (r"persian ketchup", "persian-ketchup-cornelius-oregon-food-cart-inspired.webp"),
    (r"fresh blender marinara", "fresh-blender-marinara-from-scratch-no-cans.webp"),
    (r"nacho cheese sauce", "ckd-aware-nacho-cheese-sauce-restaurant-style.webp"),
    (r"ranch dressing", "ckd-aware-ranch-dressing.webp"),
    (r"cocktail sauce", "ckd-aware-cocktail-sauce.webp"),
    (r"thousand island", "ckd-aware-thousand-island-special-sauce.webp"),
    (r"honey mustard", "ckd-aware-honey-mustard.webp"),
    (r"olive garden italian dressing", "ckd-olive-garden-italian-dressing-exact-dupe.webp"),
    (r"caprese salad", "ckd-caprese-salad.webp"),
    (r"greek salad", "ckd-greek-salad-andrew-s-version-no-olives.webp"),
    (r"citrus typhoon", "citrus-typhoon-hot-sauce-andrew-s-new-custom.webp"),
    (r"fresh horseradish prep|ringside steakhouse", "ringside-steakhouse-fresh-horseradish-prep-portland-clone.webp"),
    (r"recent tropical hot sauce|tropical hot sauce", "recent-tropical-hot-sauce-batch.webp"),
    (r"kombucha", "kombucha-non-alcoholic-fermented-tea.webp"),
    (r"red szechuan ghost pepper|red \(ghost pepper\)", "red-szechuan-ghost-pepper.webp"),
    (r"orange mango habanero|orange \(habanero\)", "orange-mango-habanero-tajin.webp"),
    (r"yellow turmeric curry bomb|yellow \(curry bomb\)", "yellow-turmeric-curry-bomb.webp"),
    (r"green wasabi nori|green \(wasabi nori\)", "green-wasabi-nori-furikake.webp"),
    (r"blue cheese and black truffle|blue \(truffle\)", "blue-blue-cheese-and-black-truffle.webp"),
    (r"indigo ube coconut|indigo \(ube\)", "indigo-ube-coconut.webp"),
    (r"violet lavender honey|violet \(lavender\)", "violet-lavender-honey-sea-salt.webp"),
    (r"azathoth", "azathoth-szechuan-peppercorn-and-black-garlic.webp"),
    (r"nyarlathotep", "nyarlathotep-ube-and-reaper-ash.webp"),
    (r"cthulhu", "cthulhu-seaweed-and-lime.webp"),
    (r"yog-sothoth", "yog-sothoth-saffron-and-sumac.webp"),
    (r"shub-niggurath", "shub-niggurath-mushroom-truffle-and-thyme.webp"),
    (r"hastur", "hastur-turmeric-and-dried-mango.webp"),
    (r"the colour everything seasoning|the colour seasoning", "the-colour-everything-seasoning.webp"),
    (r"festival cotton candy", "festival-cotton-candy-iridescent-glowing-and-edible-light-art.webp"),
    (r"super sour super hot", "super-sour-super-hot-crossover-candy.webp"),
    (r"chocolate fountain setup", "ckd-chocolate-fountain-setup.webp"),
    (r"chocolate-covered strawberries|chocolate covered strawberries", "chocolate-covered-strawberries.webp"),
    (r"chocolate-covered frozen grapes|chocolate covered frozen grapes", "chocolate-covered-frozen-grapes.webp"),
    (r"chocolate-covered rice krispie pops|rice krispie pops", "chocolate-covered-rice-krispie-pops.webp"),
    (r"chocolate bark 3 ways", "chocolate-bark-3-ways.webp"),
    (r"chocolate-dipped apple slices", "chocolate-dipped-apple-slices.webp"),
    (r"chocolate fruit kabobs", "chocolate-fruit-kabobs.webp"),
    (r"hot fudge sauce", "ckd-hot-fudge-sauce.webp"),
    (r"chocolate ganache", "ckd-chocolate-ganache.webp"),
    (r"white chocolate fruit dip", "white-chocolate-fruit-dip.webp"),
    (r"vorathic chocolate fountain party platter", "the-vorathic-chocolate-fountain-party-platter.webp"),
    (r"exotic rare jellies", "exotic-rare-jellies-and-jams-from-scratch.webp"),
    (r"vorathic rainbow pb&j|rainbow pb&j", "vorathic-rainbow-pb-and-j-line.webp"),
    (r"upscale grilled pb&j", "upscale-grilled-pb-and-j.webp"),
    (r"witches brew apothecary soups", "witches-brew-apothecary-soups.webp"),
    (r"mini ribeye and garlic butter shrimp|surf and turf", "recipe-1-surf-and-turf-mini-ribeye-and-garlic-butter-shrimp.webp"),
    (r"mushroom and gouda risotto", "recipe-2-mushroom-and-gouda-risotto.webp"),
    (r"honey-garlic chicken thighs with jasmine rice|honey garlic chicken thighs", "recipe-3-honey-garlic-chicken-thighs-with-jasmine-rice.webp"),
    (r"chicken alfredo cauliflower cream", "recipe-7-chicken-alfredo-cauliflower-cream-sauce-for-ckd.webp"),
    (r"chocolate lava mug cake", "recipe-10-chocolate-lava-mug-cake-for-two.webp"),
    (r"strawberry cheesecake bites", "recipe-11-strawberry-cheesecake-bites-no-bake.webp"),
    (r"chinese new year dumplings|jiaozi", "1-chinese-new-year-dumplings-jiaozi.webp"),
    (r"pullum numidicum|numidian chicken", "ancient-rome-100-ad-pullum-numidicum-numidian-chicken.webp"),
    (r"blancmange", "medieval-england-1350-blancmange-white-eating.webp"),
    (r"hoecakes with honey|hoecakes", "colonial-america-1776-hoecakes-with-honey.webp"),
    (r"tamago gohan|tamago kake gohan", "edo-japan-1700-tamago-gohan-egg-rice.webp"),
    (r"lamb kebab with yogurt sauce", "ottoman-empire-1500-lamb-kebab-with-yogurt-sauce.webp"),
    (r"beer bread", "ancient-egypt-2000-bc-beer-bread.webp"),
    (r"cowboy beans and hardtack", "american-frontier-1850-cowboy-beans-and-hardtack.webp"),
    (r"potage parmentier|potato leek soup", "french-revolution-1789-potage-parmentier-potato-leek-soup.webp"),
    (r"jeweled rice|morasa polo", "silk-road-800-ad-persian-jeweled-rice-morasa-polo.webp"),
    (r"mock apple pie|ritz cracker pie", "depression-era-america-1935-mock-apple-pie-ritz-cracker-pie.webp"),
    (r"ckd s'mores|s'mores", "recipe-1-ckd-s-mores.webp"),
    (r"campfire hot dogs", "recipe-2-campfire-hot-dogs-turkey-dogs-on-sticks.webp"),
    (r"foil-pack chicken and veggies|foil pack chicken", "recipe-3-foil-pack-chicken-and-veggies.webp"),
    (r"foil-pack fish|foil pack fish", "recipe-4-foil-pack-fish-wild-salmon-or-cod.webp"),
    (r"dutch oven chili", "recipe-6-dutch-oven-chili.webp"),
    (r"campfire quesadillas", "recipe-7-campfire-quesadillas.webp"),
    (r"hobo stew", "recipe-8-hobo-stew.webp"),
    (r"campfire nachos in foil", "recipe-9-campfire-nachos-in-foil.webp"),
    (r"campfire banana boats", "recipe-10-campfire-banana-boats.webp"),
    (r"grilled chicken thighs lemon-herb", "recipe-12-grilled-chicken-thighs-lemon-herb.webp"),
    (r"grilled shrimp skewers", "recipe-13-grilled-shrimp-skewers.webp"),
    (r"shore lunch catch-clean-cook", "recipe-15-shore-lunch-catch-clean-cook.webp"),
    (r"pub mix dupe", "pub-mix-dupe.webp"),

    # Fast food & restaurant dupes
    (r"beefy 5-layer burrito|beefy 5 layer", "ckd-beefy-5-layer-burrito.webp"),
    (r"crunchwrap supreme", "ckd-crunchwrap-supreme.webp"),
    (r"nachos bellgrande", "ckd-nachos-bellgrande.webp"),
    (r"butterfinger", "ckd-butterfinger-dupe.webp"),
    (r"kit kat|crisp wafer bar", "ckd-kit-kat-dupe.webp"),
    (r"snickers", "ckd-snickers-dupe.webp"),
    (r"twix", "ckd-twix-dupe.webp"),
    (r"cinnabon delights", "ckd-cinnabon-delights-dessert.webp"),
    (r"cloud biscuits|fluffy biscuits", "ckd-biscuits-fluffy-phosphorus-free.webp"),
    (r"carne asada fries", "ckd-carne-asada-fries.webp"),
    (r"carnival turkey legs", "ckd-carnival-turkey-legs.webp"),
    (r"chimichurri", "ckd-chimichurri-argentine-herb-sauce.webp"),
    (r"deep-fried oreos|deep fried oreos", "ckd-deep-fried-oreos.webp"),
    (r"latkes", "ckd-latkes-k-leached-potato-pancakes.webp"),
    (r"leached mashed potatoes|mashed potatoes", "ckd-mashed-potatoes-k-leached.webp"),
    (r"ckd mojito|virgin mojito", "ckd-mojito-non-alcoholic-or-light.webp"),
    (r"pad gra prao|thai basil", "ckd-pad-gra-prao-thai-basil-stir-fry.webp"),
    (r"pho bo|beef pho", "ckd-pho-bo-vietnamese-beef-pho.webp"),
    (r"backyard smokehouse ribs|smokehouse ribs", "ckd-smoked-grilled-ribs.webp"),
    (r"gf fresh pasta|fresh pasta", "gf-fresh-pasta-rice-flour-kitchenaid-pasta-roller.webp"),
    (r"gummy bears dupe|haribo", "gummy-bears-dupe-haribo-style-from-scratch.webp"),
    (r"agua fresca", "ckd-agua-fresca-mexican-fruit-water.webp"),
    (r"arnold palmer", "ckd-arnold-palmer-half-tea-half-lemonade.webp"),
    (r"table of contents", "cookbook-table-of-contents.webp"),
]

def normalize_words(s: str) -> list[str]:
    s = s.lower()
    s = re.sub(r"^[#\s]*(recipe\s*)?\d+[\.:\-]\s*", "", s)
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return [w for w in s.split() if w not in STOPWORDS and len(w) > 2]

def get_media_catalog() -> dict[str, dict]:
    catalog = {}
    if not MEDIA_DIR.exists():
        return catalog
    for p in MEDIA_DIR.glob("*.webp"):
        stem = p.stem.lower()
        words = normalize_words(stem)
        catalog[p.name] = {
            "path": p,
            "filename": p.name,
            "stem": stem,
            "words": set(words),
            "joined": " ".join(words)
        }
    return catalog

def find_best_image(title: str, catalog: dict[str, dict]) -> tuple[dict | None, float]:
    title_low = title.lower()
    # Check explicit aliases first
    for pattern, dest_name in EXPLICIT_ALIASES:
        if re.search(pattern, title_low):
            if dest_name in catalog:
                return catalog[dest_name], 1.5

    # Check fuzzy token match
    t_words = set(normalize_words(title))
    if not t_words:
        return None, 0.0

    t_joined = " ".join(normalize_words(title))
    best_cand = None
    best_score = 0.0

    for item in catalog.values():
        p_words = item["words"]
        if not p_words:
            continue
        overlap = t_words & p_words
        if not overlap:
            continue

        jaccard = len(overlap) / len(t_words | p_words)
        recall = len(overlap) / len(t_words)
        score = recall * 0.7 + jaccard * 0.3

        p_joined = item["joined"]
        if t_joined in p_joined or p_joined in t_joined:
            score += 0.4

        if score > best_score:
            best_score = score
            best_cand = item

    if best_cand and best_score >= 0.50:
        return best_cand, best_score
    return None, 0.0

DELUXE_CSS = """
/* ── Deluxe Illustrated Edition Additions ── */
.deluxe-badge {
  display: inline-block;
  background: #181c28;
  border: 1px solid #c9a84c;
  color: #c9a84c;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 0.8rem;
}
.deluxe-plate-figure {
  margin: 1.5rem auto 1.8rem;
  text-align: center;
  max-width: 720px;
  background: #0f121d;
  border: 1px solid #2a2f45;
  border-radius: 10px;
  padding: 10px 10px 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  break-inside: avoid;
  page-break-inside: avoid;
}
.deluxe-plate {
  max-width: 100%;
  width: 100%;
  height: auto;
  max-height: 460px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}
.deluxe-plate-caption {
  font-size: 0.8rem;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #c9a84c;
  margin-top: 8px;
  font-weight: 600;
}
@media print {
  .deluxe-plate-figure {
    background: #fff !important;
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    padding: 4pt !important;
    margin: 8pt auto 10pt !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .deluxe-plate {
    max-height: 3.2in !important;
    border-radius: 2pt !important;
  }
  .deluxe-plate-caption {
    color: #333 !important;
    font-size: 7.5pt !important;
  }
}
"""

def build_deluxe_edition():
    catalog = get_media_catalog()
    print(f"Loaded {len(catalog)} media assets from {MEDIA_DIR}")

    html_content = SRC_HTML.read_text(encoding="utf-8")

    # Ingest Deluxe CSS into <style>
    style_insert_idx = html_content.find("</style>")
    if style_insert_idx != -1:
        html_content = (
            html_content[:style_insert_idx]
            + DELUXE_CSS
            + html_content[style_insert_idx:]
        )

    # Update Title & Meta
    html_content = html_content.replace(
        "<title>Digital MasterCook Book — Freeware Edition v09",
        "<title>Digital MasterCook Book — Illustrated Deluxe Edition v09"
    )

    # Update Cover Title Block
    old_cover = '<div class="cover">'
    new_cover = (
        '<div class="cover">\n'
        '<div class="deluxe-badge">Illustrated Deluxe Edition</div>'
    )
    html_content = html_content.replace(old_cover, new_cover, 1)

    # Ingest photographic plates
    # We find all <h2> and <h3> headers and inject figures
    # Pattern to match: <h[23]([^>]*)>(.*?)</h[23]>
    heading_pattern = re.compile(r"(<h([23])([^>]*)>(.*?)</h\2>)", re.DOTALL | re.IGNORECASE)

    manifest_entries = []
    used_images = set()

    def replace_heading(match):
        full_tag = match.group(1)
        tag_num = match.group(2)
        attrs = match.group(3)
        inner_html = match.group(4)

        # Plain text title
        clean_title = re.sub(r"<[^>]+>", "", inner_html)
        clean_title = html.unescape(clean_title).strip()
        t_low = clean_title.lower()

        # Skip headers like "Table of Contents", "Breakfast Intelligence", etc.
        if any(t_low.startswith(p) for p in [
            "table of contents", "chapter ", "appendix ", "part ", "the end",
            "medical safety note", "label check", "evidence language"
        ]):
            return full_tag

        cand, score = find_best_image(clean_title, catalog)
        if cand:
            used_images.add(cand["filename"])
            manifest_entries.append({
                "heading_tag": f"h{tag_num}",
                "recipe_title": clean_title,
                "image_filename": cand["filename"],
                "image_url": f"/static/cookbook_deluxe_media/{cand['filename']}",
                "match_score": round(score, 2)
            })

            escaped_title = html.escape(clean_title)
            figure_html = (
                f'\n<figure class="deluxe-plate-figure">\n'
                f'  <img class="recipe-img deluxe-plate" src="/static/cookbook_deluxe_media/{cand["filename"]}" '
                f'alt="{escaped_title} Photographic Plate" loading="lazy">\n'
                f'  <figcaption class="deluxe-plate-caption">Photographic Plate: {escaped_title}</figcaption>\n'
                f'</figure>'
            )
            return full_tag + figure_html
        return full_tag

    new_html = heading_pattern.sub(replace_heading, html_content)

    OUT_HTML.write_text(new_html, encoding="utf-8")
    print(f"Wrote Deluxe Illustrated Edition HTML: {OUT_HTML} ({len(new_html):,} bytes)")

    # Write Manifest
    manifest_data = {
        "edition": "Illustrated Deluxe Edition v09",
        "generated_by": "tools/build_deluxe_illustrated_cookbook.py",
        "total_plates_injected": len(manifest_entries),
        "unique_images_used": len(used_images),
        "plates": manifest_entries
    }
    OUT_MANIFEST.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")
    print(f"Wrote Manifest: {OUT_MANIFEST} with {len(manifest_entries)} plate bindings ({len(used_images)} unique images)")

if __name__ == "__main__":
    build_deluxe_edition()
