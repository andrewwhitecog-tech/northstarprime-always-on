# Mature static surface - build receipt

**Created:** 2026-09-04 (PT)
**Repo path:** `mature/` under `northstarprime-always-on`
**Live:** https://northstarprime.net/mature/

## Corrective pass (2026-09-04)

- Recipes 03 (scallops) + 05 (shrimp): Codex-restored canonical copies; FSIS **145°F (62.8°C)** + food thermometer. Private and always-on verified byte-identical; parked NORTHSTAR_PRIME copies refreshed by COPY only (no rewrite).
- Recipe 07 (lava cakes): pasteurized eggs/products required; FDA egg-safety URL; ordinary unpasteurized egg dishes **160°F (71.1°C)**; molten center with ordinary eggs not claimed safe.
- SOURCE_EVIDENCE pack section documents FSIS/FDA correction.
- Playwright browser QA: PASS desktop 1280x800 + mobile 390x844 — zero pre-confirm `vah_*.png` requests; 10 keepers decode post-confirm; console clean. Receipts in `mature/qa/`.

## Gate / asset loading

- 18+ confirm button before mature image loads.
- `img.src` assigned only inside reveal() after confirm (no eager `<img src>` in HTML).
- sessionStorage key: `nsp_mature_18`
- R-rated labeling, content warnings, exit link, medical honesty on page.

## Medical honesty

`medical_review_status`: not clinician-reviewed; renal limits need clinician/dietitian.
No invented nutrition / mineral / fluid figures. No renal-safe claims.

## Canonical recipe hashes (SHA256)

- 03: `759da7195cf0cb249312f4f6eace385990a0e1e1d27a6912787c2c341638b10d`
- 05: `4f3f21e4a8b8eb9c74caed280fe3afb3f60261b9ffbd3a68fb7ffa8ab85b5075`
- 07: `0eb555127c7781402ac1a1b704a36cc579741a680a7d1deb29d2c5051926b8cc`
