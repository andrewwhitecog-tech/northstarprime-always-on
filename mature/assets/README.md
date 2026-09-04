# Mature surface assets (placeholder)

This folder holds **post-confirmation** static art for `/mature/`.

## Rules

- **Do not** place mature art in `ckd-kitchen/`, `cookbook/`, kids/family feeds, or other all-ages surfaces.
- Browser requests for mature images must happen **only after** the 18+ confirmation gate on `mature/index.html` (images use deferred `data-src` until confirmed).
- Relative paths from the page: `assets/<keeper-filename>.png`.

## Expected keeper filenames (After Dark / Date Night cookbook v01)

Pack: `20260904_after_dark_date_night_cookbook_v01`  
Status: pack `images_included: false` — **PNG sync into this folder is still required**.

| Recipe id | Expected asset path (deferred until confirm) |
|-----------|-----------------------------------------------|
| 01 | `assets/01_midnight_velvet_chocolate_fondue.png` |
| 02 | `assets/02_between_the_sheets_steak_au_poivre.png` |
| 03 | `assets/03_silk_sheets_scallops_lemon_butter.png` |
| 04 | `assets/04_candlelight_kiss_champagne_pasta.png` |
| 05 | `assets/05_slow_burn_chili_honey_shrimp.png` |
| 06 | `assets/06_barely_dressed_burrata_balsamic.png` |
| 07 | `assets/07_lights_out_dark_chocolate_lava_cakes.png` |
| 08 | `assets/08_last_call_espresso_affogato.png` |

Optional later packs (e.g. Vorath After Hours keepers) should use their own prefixed keeper names and must also load only via deferred `data-src` after confirm.

## Sync checklist

1. Copy approved keeper PNGs into this directory using the exact filenames above.
2. Confirm files are present: `Get-ChildItem mature/assets/*.png`
3. Run localhost QA in `../QA_RECEIPT_TEMPLATE.md` (Network tab: no mature image requests before confirm).
4. Update `../RECEIPT.md` when sync completes.

Until sync completes, the page structure remains valid; revealed slots show an accessible placeholder state when the file 404s.
