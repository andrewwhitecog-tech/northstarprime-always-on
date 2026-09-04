# Mature surface — localhost QA receipt template

**Surface:** `/mature/`  
**Pack referenced:** `20260904_after_dark_date_night_cookbook_v01` (After Dark / Date Night)  
**Rating:** R / 18+  
**Tester:** _______________  
**Date (PT):** _______________  
**Local URL used:** `http://localhost:____/mature/` (or `…/mature/index.html`)

## Preconditions

- [ ] Serving from repo root so `/mature/` resolves (e.g. `npx serve .` or equivalent static server).
- [ ] DevTools open → **Network** tab cleared; **Disable cache** checked while DevTools open.
- [ ] Fresh session: clear `sessionStorage` key `nsp_mature_18` (or use a private window).

## A. Pre-confirmation (gate visible)

- [ ] Page title / heading clearly labels **R-rated / 18+ / After Dark**.
- [ ] Content warning text is visible before any confirm action.
- [ ] **Exit / Back** control is visible and returns to a safe non-mature destination (home or `history.back()` fallback).
- [ ] Focus lands on the gate dialog (`role="dialog"` / `aria-modal="true"`).
- [ ] Tab cycles within the gate controls (confirm + exit); Esc triggers exit/back.
- [ ] Screen-reader / accessibility: dialog has accessible name (`aria-labelledby` / `aria-describedby`).
- [ ] **Network:** zero requests for `mature/assets/*.png` (or any mature keeper art) before confirm.
- [ ] No `<img src="…mature art…">` present in DOM before confirm — only deferred `data-src` / placeholder slots.
- [ ] Recipe list titles/blurbs may be present in the gated region but mature images must not load yet.

## B. Confirm 18+

- [ ] Activate **I confirm I am 18+** via mouse.
- [ ] Repeat in a fresh session using keyboard only (Tab + Enter/Space).
- [ ] Gate dismisses; main mature content becomes available.
- [ ] `sessionStorage.nsp_mature_18` is set (so reload within session stays past gate).
- [ ] **After confirm:** deferred images may set `src` from relative `assets/…` paths.
- [ ] If PNGs are not synced yet: broken-image / placeholder state is acceptable; note filenames attempted.
- [ ] No nutrition / K / P / Na / fluid numbers invented on the page.
- [ ] `medical_review_status` visible and honest: **not clinician-reviewed; renal limits need clinician/dietitian**.

## C. Separation from health / kids cookbook

- [ ] This surface is **not** linked from `ckd-kitchen/`, `cookbook/`, or kids/family feeds in this change set.
- [ ] Confirming on `/mature/` does not inject mature assets into those feeds.
- [ ] `sitemap.xml` / main nav not required for this staging pass (leave unrelated dirty work untouched).

## D. Exit / revoke

- [ ] Exit/Back from gate works without confirming.
- [ ] Optional: “Leave mature surface” control after confirm returns to `/` (or prior page).
- [ ] Clearing sessionStorage + reload restores the gate.

## E. Assets sync status

- [ ] PNGs present in `mature/assets/` matching expected keeper filenames? **Yes / No**
- [ ] If No: RECEIPT must state **assets sync required** (structure still valid with deferred paths).

## Result

- **PASS / FAIL:** _______________  
- **Blockers / notes:**

```
(write notes here)
```

## Sign-off

Tester signature / initials: _______________
