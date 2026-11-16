#!/usr/bin/env python3
"""flat_control_scan.py v02.8 (Grok): sibling of plaque_fit_scan.py.
v02.8 (AG 000330Z N1 on the v02.7 Windows seat): T-CLIP scrolls were animated on pages with scroll-behavior:smooth
  (html, body or a scroller), so 2 rAFs later the box could still read CLIPPED (viewport).
  S1 VISJS pins inline scroll-behavior:auto !important on html, body and every ancestor (saved), then scrolls with
     behavior:"instant"; UNSCROLLJS restores scroll positions instantly, then each saved style attribute string verbatim (DOM pristine).
  S2 the two page-level window.scrollTo(0,0) calls also use behavior:"instant" (pre-scan and --shots).
  S3 --smooth-scroll-legacy reproduces v02.7 scrolling (for A/B only). S4 VERSION/--version v02.8.
v02.7 (Grok PR #324 seat 215553Z: 4 new 1280 CHIP_EMPTY_FRAME rows were scanner false positives; census: 20,954 of 23,644 CHIP_FLAT rows were table cells):
  T1 T-CLIP visibility gate before every interior crop (default ON with the interior check; --no-tclip reproduces v02.6 byte-for-byte except version).
     The element is scrolled to centre (window and every scroll ancestor), then: vis_frac = share of its border box left after intersecting the
     viewport and every ancestor whose overflow is not visible; occluded = share of a 3x3 grid of interior points whose elementFromPoint hit is not
     the element, a descendant or an ancestor (pseudo-elements hit-test as their host). vis_frac < --tclip-min (0.95) -> CLIPPED; occluded > 1/3 ->
     OCCLUDED. Such rows are NOT judged empty: verdict stays CHIP_PAINTED(_LATENT), row.interior = {unverified: CLIPPED|OCCLUDED, vis_frac, occluded,
     hit}, counted in chip_counts CHIP_INTERIOR_UNVERIFIED (no exit effect; a seat must look at them by eye). Scroll positions are restored after each row.
  T2 tall pages (> 16000 device px, no trusted full capture): rows are shot with the element screenshot after the scroll, not
     page.screenshot(clip, full_page=True), which returned black tiles far down tall pages (AG 213000Z / ag_fcs_v02_6_1 3248b77d, adopted).
  T3 TABLE class: a chip whose box is a table cell (<td>/<th>) is a data cell, not UI. It becomes TABLE_CELL_PAINTED / TABLE_CELL_FLAT (+_LATENT),
     severity INFO, counted in table_counts / table_totals only (never in chip_counts, CHIP_WARN or the exit). Spans/badges INSIDE a cell stay chips.
     --table-as-chips reproduces v02.6 chip rows and counts.
  T4 docstring/VERSION/--version say v02.7.
v02.6 history follows.
flat_control_scan.py v02.6 (Grok): sibling of plaque_fit_scan.py.
v02.6 (Grok 1909Z HOLD seat of PR #322 head 3f6b5473: /links/ 390 sigil plaques were a painted frame around an EMPTY slot yet scored CHIP_PAINTED):
  E1 interior-content check on CHIP_PAINTED chips (default ON; --no-interior reproduces v02.5 byte-for-byte except version). After the chip pass the
     tool samples the chip's inner box (inset 30% of min(w,h), never < 4 css px of interior) from the page screenshot. If the interior is near-uniform
     (luma stddev < --empty-std 6.0 AND < --empty-content 0.005 of pixels differ from the median colour by > 24 in any channel) the chip is
     CHIP_EMPTY_FRAME (+_LATENT), severity FLAT, exit 1 unless --empty-ok. Rows gain interior {std, content, median, px, inset}; when the frame is a
     border-image with 'fill' over a background-image the reason says so (fill paints ABOVE the background and hides it: the PR #322 root cause).
  E2 raster art that fails to load (background-image / border-image / pseudo / child img / svg image: 404, decode error, naturalWidth 0) is not art:
     it adds no coverage; rows gain broken_art [...]; a chip whose only art is broken is CHIP_FLAT with a 'failed to load' reason.
  E3 --interior-controls (opt-in, default off so every v02.5 control verdict stays): the same interior check on PAINTED controls -> EMPTY_FRAME /
     EMPTY_FRAME_LATENT (exit 1 unless --empty-ok). --empty-std / --empty-content tune the thresholds. E4 docstring/VERSION/--version say v02.6.
v02.5 (PR #320 seat note N7/N8: monogram tiles and episode badges are flat CSS but v02.4 scored the page FLAT 0):
  K1 CHIP pass (third, separate pass; v02.1 control rows and v02.2 input rows untouched). A CHIP is a small visible box
     (h <= 80, w <= 320 CSS px, not a control, not containing a control or input) with its own visible box (border
     width > 0 with a visible colour, or a non-transparent background colour) and visible text of 1..24 chars.
     CHIP_PAINTED = raster art covers >= --cover of the chip (v02.4 selfCoverage on self incl. background-clip,
     border-image raster = 1, raster on ::before/::after, or a child <img>/<svg><image> covering >= --cover);
     CHIP_FLAT otherwise. Outermost qualifying box wins (no double count of nested spans).
     Severity: WARN by default; FLAT (sets exit 1) when the chip sits inside a control (a, button, ...), inside a
     card/tile ancestor (class *card*/*tile*, <= 4 levels) that hosts a control, or is the direct element sibling of a
     control. Chips inside a closed <details> are *_LATENT and follow --latent-ok.
     --chips-ok: chip rows reported, no exit effect. --no-chips: skip the pass, output = v02.4 (only version differs).
  K2 --base-url URL: scan a live site instead of serving --root (root becomes optional).  K3 --version.
  K4 docstring/VERSION/--version all say v02.5 (v02.4 shipped VERSION v02.4 under a v02.3 docstring head).
v02.4 (summary; see CHANGELOG): L1 label-hosted hidden toggles, C1 background-clip/position coverage, S1 --shots name.
v02.3 (AG second-seat hardening notes 2026-11-15T14:07Z on v02.2 36c0506f; v02.1 control pass untouched):
  H1 every file write is encoding='utf-8' (labels with em dash / check marks broke cp1252 Windows runs).
  H2 RESTORE also strips data-fcs-idx / data-fcs-in-idx, so the inspected DOM is pristine after a scan; with the input
     pass on, details_restore.dom_attrs_left records the read-back count (0 = clean). --no-inputs output shape = v02.2.
  H3 input pass: transparency test isClear() also accepts hsla(..,0), color(.. / 0), any 'x y z / 0' colour, so a field
     on a plaque with background color(srgb 1 1 1 / 0) is PAINTED (v02.2 said art hidden behind the field).
  H4 input pass: a raster background-image on the input itself counts as art only if its rendered layer covers
     >= 60% of the field box (background-size cover/contain/% /px/auto with natural size, repeat axes = full);
     border-image always covers. A 16px search-icon raster on a 240px field is NATIVE_FLAT ('icon, not a plaque').
     rows gain art_coverage (0..1, max over raster layers on self; null when art is on a pseudo/ancestor).

v02.2 (tool gap T1, AG concurred 2026-11-15T13:15Z): native form inputs were outside SEL, so a native grey checkbox
(LLL "Text only", N1) was invisible. v02.2 adds a SECOND, separate pass (v02.1 rows/counts/crops are untouched) over
INSEL = input[type=checkbox|radio|range|text|search|number|email|url|tel|password|file], input without type, textarea.
(<select> is already in SEL and keeps its v02.1 PAINTED/FLAT verdict; it is not double-counted.)
  NATIVE_PAINTED  checkbox/radio/range: computed appearance is 'none' AND a raster (non-SVG url) background-image or
                  border-image on the input itself or on its ::before/::after (also content:url(raster)).
                  text-like/textarea/file: raster bg/border-image on self (file: or its ::file-selector-button), or a
                  single-control ancestor (<= 2 levels, same height guard as v02.1) carrying raster art while the field
                  itself is see-through (transparent background, no visible border).
  NATIVE_FLAT     anything else: default UA widget (appearance auto/checkbox/radio/...), accent-color-only tint,
                  appearance:none with CSS-only box, plain UA text border with no image.
Same ignore rules as v02.1 (hidden / opacity 0 / <=2 px / offscreen). Inputs inside a closed <details> (the v02 latent
pass) get *_LATENT. Page record gains input_rows, input_counts, input_ignored, input_contact_sheet, input_crop_stats;
result gains input_selector and input_totals. --no-inputs skips the pass and reproduces v02.1 output exactly (only the
version string differs). Exit 1 also when NATIVE_FLAT > 0 (or NATIVE_FLAT_LATENT unless --latent-ok), unless --inputs-ok.

flat_control_scan.py v02.1 notes follow.

v02.1 (AG 110300Z second-seat hardening notes, non-blocking; verdict rules unchanged):
  * EXCLUSIVE ACCORDIONS: HTML5 <details name="x"> siblings close each other when one opens, so opening every closed
    <details> left only the last one of a group open (its siblings' controls collapsed: innerText cleared, crops
    wrong, rows lost). v02.1 strips [name] from every details[name] before the latent pass, then after the crops
    closes what it opened, puts every name back and re-applies each one's initial .open state. The page record gets
    exclusive_details (how many details[name] were stripped) and details_restore (DOM read-back of every <details>
    [name, open] before the scan and after restore; restore_ok = identical).
  * WINDOWS-SAFE SLUG: report/sheet/screenshot file names use re.sub(r'[^A-Za-z0-9._-]+', '_', slug), so
    --page "/foo/?q=1" with --shots never hits OSError(22) on NTFS.
  * --mute-audio in the Chromium launch args (handbook Rule 38); the args are recorded as chromium_args.
  * Page record also gets crop_stats [{idx, w, h, ink}] for every FLAT/FLAT_LATENT crop (ink = share of crop
    pixels with luma >= 128), so an emptied crop is visible in the JSON.

v02 (AG-approved asks from the 101500Z census second seat):
  * LATENT: a control inside a CLOSED <details> (anything but that details' own <summary>) is not on screen until the
    user opens it. v02 records which controls are latent, opens every closed <details> so they get a real layout box,
    classifies them with the same rules, and reports them as PAINTED_LATENT / FLAT_LATENT (separate counts). It then
    closes them again before the viewport screenshot. Latent FLAT still fails the page (exit 1): Andrew's rule covers
    every control the user can reach, not just the default state. --latent-ok makes exit depend on visible FLAT only.
  * FINAL URL: each page records requested path, final URL after HTTP redirects, meta-refresh and JS location
    redirects (main-frame navigation chain), and a landing class: same | internal-redirect | external.
    --skip-external records an external landing but does not scan the live off-repo page (counts stay 0).

Rule under test (Andrew): "ui need to always be art also". At 390x844 DPR2 (mobile, touch), every visible
interactive control (a, button, [role=button], input[type=button|submit|reset|image], summary, select) is
classified:
  PAINTED  the control, or an ancestor up to 2 levels up, has a RASTER sprite (background-image url of a
           non-SVG image, border-image url of a non-SVG image, a descendant <img>/<picture>, or an
           <svg><image href=raster>) whose drawn rect covers >= --cover (0.60) of the control's box.
  FLAT     anything else: plain text link, CSS-only box (solid colour, gradient, pill border-radius),
           vector-only inline SVG icon, SVG-file background, or a sprite that covers < 60%.
Ignored: display:none, visibility:hidden, opacity 0 (self or ancestor), boxes <= 2 CSS px (sr-only,
honeypots), and boxes wholly outside the document's scrollable area (offscreen) unless they sit inside a scrollable
overflow container (those are reachable by the user, so they are scanned and cropped by element screenshot).
Ancestor guard: an ancestor's sprite only counts if that ancestor hosts exactly ONE control and its box height
is <= max(--anc-max (3.0) x control height, 96 CSS px). So a link sitting in its own painted plaque counts, but a
page/section/footer backdrop texture (tall, or shared by several links) never certifies a plain link as art.
Exit: 1 if any FLAT or FLAT_LATENT (or visible FLAT only with --latent-ok), 0 if none, 2 on runtime error.
"""
import argparse, asyncio, functools, http.server, json, os, re, socketserver, sys, threading
from playwright.async_api import async_playwright

VERSION = 'v02.8'
SEL = 'a, button, [role=button], input[type=button], input[type=submit], input[type=reset], input[type=image], summary, select'
INSEL = ('input[type=checkbox], input[type=radio], input[type=range], input[type=text], input[type=search], input[type=number], '
         'input[type=email], input[type=url], input[type=tel], input[type=password], input[type=file], input:not([type]), textarea')

JS = r"""
async ([SEL, COVER, ANCMAX]) => {
  // v02.1: strip [name] from exclusive-accordion <details> so opening one does not close its siblings (restored later)
  window.__fcsNamed = [...document.querySelectorAll('details[name]')].map(d => ({ d, name: d.getAttribute('name'), open: d.open }));
  for (const x of window.__fcsNamed) x.d.removeAttribute('name');
  // v02: find closed <details>, mark latent controls, then open them so latent controls get a real box
  const closedDet = [...document.querySelectorAll('details:not([open])')];
  const latentOf = new Map();
  for (const el of document.querySelectorAll(SEL)) {
    for (const d of closedDet) {
      if (!d.contains(el) || d === el) continue;
      const sm = el.closest('summary');
      if (sm && sm.parentElement === d) continue;  // the summary of a closed details is on screen
      latentOf.set(el, d); break;
    }
  }
  window.__fcsClosed = closedDet;
  for (const d of closedDet) d.open = true;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise(r => setTimeout(r, 150));
  const docW = Math.max(document.documentElement.scrollWidth, innerWidth), docH = Math.max(document.documentElement.scrollHeight, innerHeight);
  const sx = scrollX, sy = scrollY;
  const natCache = {};
  async function nat(url) {
    if (url in natCache) return natCache[url];
    const p = new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res(null); im.src = url; });
    natCache[url] = await Promise.race([p, new Promise(r => setTimeout(() => r(null), 4000))]);
    return natCache[url];
  }
  function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
  function urlOf(layer) { const m = /^url\(\s*["']?(.*?)["']?\s*\)$/.exec(layer); return m ? m[1] : null; }
  function isVector(u) { return /^data:image\/svg/i.test(u) || /\.svgz?(\?|#|$)/i.test(u); }
  function hidden(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || parseFloat(cs.opacity) === 0) return 'display/opacity';
      if (e === el && (cs.visibility === 'hidden' || cs.visibility === 'collapse')) return 'visibility';
    }
    if (el.closest('[hidden],[aria-hidden=true][inert]')) return 'hidden-attr';
    return null;
  }
  function inter(a, b) { const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h); return (x1 > x0 && y1 > y0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; }
  function R(r) { return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function px(v) { return parseFloat(v) || 0; }
  function boxes(el) {
    const r = R(el.getBoundingClientRect()), cs = getComputedStyle(el);
    const bt = px(cs.borderTopWidth), br = px(cs.borderRightWidth), bb = px(cs.borderBottomWidth), bl = px(cs.borderLeftWidth);
    const pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
    const border = r, padding = { x: r.x + bl, y: r.y + bt, w: r.w - bl - br, h: r.h - bt - bb };
    const content = { x: padding.x + pl, y: padding.y + pt, w: padding.w - pl - pr, h: padding.h - pt - pb };
    return { 'border-box': border, 'padding-box': padding, 'content-box': content };
  }
  function lenTok(t, ref) { if (t.endsWith('%')) return px(t) / 100 * ref; return px(t); }
  async function bgRects(el) {
    const cs = getComputedStyle(el), out = [];
    if (!cs.backgroundImage || cs.backgroundImage === 'none') return out;
    const L = splitTop(cs.backgroundImage), S = splitTop(cs.backgroundSize), P = splitTop(cs.backgroundPositionX), Q = splitTop(cs.backgroundPositionY),
          RP = splitTop(cs.backgroundRepeat), O = splitTop(cs.backgroundOrigin), C = splitTop(cs.backgroundClip);
    const bx = boxes(el);
    for (let i = 0; i < L.length; i++) {
      const u = urlOf(L[i]);
      if (!u) { out.push({ kind: 'css-gradient', layer: L[i].slice(0, 40), raster: false }); continue; }
      if (isVector(u)) { out.push({ kind: 'bg-svg', url: u, raster: false }); continue; }
      const area = bx[O[i % O.length]] || bx['padding-box'], clip = bx[C[i % C.length]] || bx['border-box'];
      const n = await nat(u); if (!n) { out.push({ kind: 'bg-unloaded', url: u, raster: false }); continue; }
      let [iw, ih] = n; const s = (S[i % S.length] || 'auto').split(/\s+/);
      let w, h;
      if (s[0] === 'cover' || s[0] === 'contain') { const k = s[0] === 'cover' ? Math.max(area.w / iw, area.h / ih) : Math.min(area.w / iw, area.h / ih); w = iw * k; h = ih * k; }
      else {
        const a = s[0], b = s[1] || 'auto';
        w = a === 'auto' ? null : lenTok(a, area.w); h = b === 'auto' ? null : lenTok(b, area.h);
        if (w == null && h == null) { w = iw; h = ih; } else if (w == null) w = iw * h / ih; else if (h == null) h = ih * w / iw;
      }
      const ptx = P[i % P.length] || '0%', pty = Q[i % Q.length] || '0%';
      const x = area.x + (ptx.endsWith('%') ? (area.w - w) * px(ptx) / 100 : px(ptx));
      const y = area.y + (pty.endsWith('%') ? (area.h - h) * px(pty) / 100 : px(pty));
      const rp = (RP[i % RP.length] || 'repeat').split(/\s+/);
      const rx = rp[0] === 'repeat' || rp[0] === 'repeat-x' || rp[0] === 'round' || rp[0] === 'space', ry = rp[0] === 'repeat' || rp[0] === 'repeat-y' || rp[0] === 'round' || rp[0] === 'space' || (rp[1] && rp[1] !== 'no-repeat');
      const rxx = rp.length === 2 ? rp[0] !== 'no-repeat' : rx, ryy = rp.length === 2 ? rp[1] !== 'no-repeat' : ry;
      let d = { x: rxx ? clip.x : x, y: ryy ? clip.y : y, w: rxx ? clip.w : w, h: ryy ? clip.h : h };
      d = inter(d, clip);
      out.push({ kind: 'bg-raster', url: u, raster: true, rect: d, size: S[i % S.length] });
    }
    return out;
  }
  function borderImg(el) {
    const cs = getComputedStyle(el), src = cs.borderImageSource;
    if (!src || src === 'none') return null;
    const u = urlOf(src);
    if (!u) return { kind: 'border-image-gradient', raster: false };
    if (isVector(u)) return { kind: 'border-image-svg', url: u, raster: false };
    return { kind: 'border-image', url: u, raster: true, rect: R(el.getBoundingClientRect()) };
  }
  function cssPath(el) {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      const cl = [...e.classList].slice(0, 2).join('.'); if (cl) s += '.' + cl;
      const sib = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const rows = [], ignored = { hidden: 0, tiny: 0, offscreen: 0 }, ignoredSamples = [];
  const latentDetails = el => { const d = latentOf.get(el); return d ? (d.id ? 'details#' + d.id : cssPath(d)) : ''; };
  const ign = (el, why, rr) => { ignored[why]++; if (ignoredSamples.length < 40) ignoredSamples.push({ why, tag: el.tagName.toLowerCase(), selector: cssPath(el), text: (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50), rect: rr ? [rr.x, rr.y, rr.w, rr.h].map(v => Math.round(v)) : null }); };
  const els = [...document.querySelectorAll(SEL)];
  for (const el of els) {
    if (hidden(el)) { ign(el, 'hidden'); continue; }
    let r = R(el.getBoundingClientRect());
    if (r.w === 0 && r.h === 0 && getComputedStyle(el).display === 'contents') { ign(el, 'hidden'); continue; }
    // inline <a> wrapping a block: use the union of client rects / children
    if ((r.w <= 2 || r.h <= 2) && el.children.length) {
      let u = null; for (const c of el.querySelectorAll('*')) { const q = R(c.getBoundingClientRect()); if (q.w > 2 && q.h > 2) { u = u ? { x: Math.min(u.x, q.x), y: Math.min(u.y, q.y), w: Math.max(u.x + u.w, q.x + q.w) - Math.min(u.x, q.x), h: Math.max(u.y + u.h, q.y + q.h) - Math.min(u.y, q.y) } : q; } }
      if (u) r = u;
    }
    if (r.w <= 2 || r.h <= 2) { ign(el, 'tiny', r); continue; }
    const pr = { x: r.x + sx, y: r.y + sy, w: r.w, h: r.h };
    let inScroller = null;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (/(auto|scroll)/.test(c.overflowX + c.overflowY) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) { inScroller = e; break; } }
    if (pr.x + pr.w <= 0 || pr.y + pr.h <= 0 || ((pr.x >= docW || pr.y >= docH) && !inScroller)) { ign(el, 'offscreen', pr); continue; }
    const area = r.w * r.h, cands = [], notes = [];
    // self + ancestors (0..2)
    let lvl = 0;
    for (let e = el; e && e.nodeType === 1 && lvl <= 2; e = e.parentElement, lvl++) {
      if (e === document.body || e === document.documentElement) break;
      const er = R(e.getBoundingClientRect());
      const nCtl = lvl > 0 ? e.querySelectorAll(SEL).length : 1;
      const big = lvl > 0 && (er.h > Math.max(ANCMAX * r.h, 96) || nCtl > 1);
      const why = nCtl > 1 ? `hosts ${nCtl} controls` : `h ${Math.round(er.h)} > max(${ANCMAX}x control h, 96)`;
      const list = (await bgRects(e)).concat([borderImg(e)].filter(Boolean));
      for (const b of list) {
        b.level = lvl; b.host = lvl === 0 ? 'self' : 'ancestor+' + lvl;
        if (b.raster && big) { b.raster = false; b.kind += '(backdrop: ancestor ' + Math.round(er.w) + 'x' + Math.round(er.h) + ', ' + why + ')'; }
        cands.push(b);
      }
    }
    // descendants: <img>, <svg><image>, inline vector svg
    for (const im of el.querySelectorAll('img')) {
      const src = im.currentSrc || im.src || '';
      if (isVector(src)) { cands.push({ kind: 'img-svg', url: src, raster: false, host: 'child' }); continue; }
      if (im.complete && im.naturalWidth > 0) cands.push({ kind: 'img', url: src, raster: true, rect: R(im.getBoundingClientRect()), host: 'child' });
    }
    if (el.tagName === 'INPUT' && el.type === 'image' && el.src && !isVector(el.src)) cands.push({ kind: 'input-image', url: el.src, raster: true, rect: r, host: 'self' });
    let vecSvg = false;
    for (const sv of el.querySelectorAll('svg')) {
      const imgs = sv.querySelectorAll('image');
      if (!imgs.length) { vecSvg = true; continue; }
      for (const ii of imgs) { const h = ii.getAttribute('href') || ii.getAttribute('xlink:href') || ''; if (isVector(h)) { vecSvg = true; continue; } cands.push({ kind: 'svg-image', url: h, raster: true, rect: R(ii.getBoundingClientRect()), host: 'child' }); }
    }
    let best = 0, bestC = null;
    for (const c of cands) {
      if (!c.raster || !c.rect) continue;
      const i = inter(c.rect, r); const cov = i ? (i.w * i.h) / area : 0;
      c.cover = Math.round(cov * 1000) / 1000;
      if (cov > best) { best = cov; bestC = c; }
    }
    const cs = getComputedStyle(el);
    const base = best >= COVER ? 'PAINTED' : 'FLAT', latent = latentOf.has(el);
    const verdict = base + (latent ? '_LATENT' : '');
    const reasons = [];
    if (base === 'FLAT') {
      if (bestC) reasons.push(`raster sprite covers only ${Math.round(best * 100)}% (< ${Math.round(COVER * 100)}%): ${bestC.kind} ${bestC.host}`);
      for (const c of cands) if (!c.raster) reasons.push(c.kind + (c.host ? ' ' + c.host : ''));
      if (vecSvg) reasons.push('inline SVG vector icon only (no raster art)');
      const bg = cs.backgroundColor; const solid = bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
      if (solid) reasons.push('css solid background ' + bg);
      const rad = px(cs.borderTopLeftRadius); if (rad >= Math.min(r.h / 2 - 1, 12) && rad > 0) reasons.push('css border-radius ' + cs.borderTopLeftRadius + (rad >= r.h / 2 - 1 ? ' (pill)' : ''));
      if (px(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && !cs.borderImageSource.startsWith('url')) reasons.push('css border ' + cs.borderTopWidth + ' ' + cs.borderTopStyle);
      if (!reasons.length) reasons.push('no backing at all (plain text control)');
    }
    const id = el.id || el.getAttribute('data-fx') || '';
    el.setAttribute('data-fcs-idx', String(rows.length));
    rows.push({ idx: rows.length, id, latent_in: latentDetails(el), in_scroller: inScroller ? cssPath(inScroller) : '', tag: el.tagName.toLowerCase(), selector: cssPath(el), text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 70),
      href: el.getAttribute('href') || '', rect: [pr.x, pr.y, pr.w, pr.h].map(v => Math.round(v * 10) / 10), verdict, cover: Math.round(best * 1000) / 1000,
      sprite: bestC ? { kind: bestC.kind, host: bestC.host, url: (bestC.url || '').split('/').pop().slice(0, 60) } : null, reasons, landmark: (el.closest('footer,nav,header,main,aside') || {}).tagName ? el.closest('footer,nav,header,main,aside').tagName.toLowerCase() + (el.closest('footer,nav,header,main,aside').id ? '#' + el.closest('footer,nav,header,main,aside').id : '') : '' });
  }
  return { rows, ignored, ignoredSamples, total_matched: els.length, docW, docH, closed_details: closedDet.length, latent_controls: latentOf.size, exclusive_details: window.__fcsNamed.length };
}
"""

INJS = r"""
async ([INSEL, SEL, ANCMAX]) => {
  // v02.2 native-input pass; runs after JS (latent details are still open, exclusive names still stripped)
  const closed = window.__fcsClosed || [];
  const docW = Math.max(document.documentElement.scrollWidth, innerWidth), docH = Math.max(document.documentElement.scrollHeight, innerHeight);
  const sx = scrollX, sy = scrollY;
  function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
  function urls(v) { if (!v || v === 'none') return []; const o = []; for (const L of splitTop(v)) { const m = /url\(\s*["']?(.*?)["']?\s*\)/.exec(L); if (m) o.push(m[1]); } return o; }
  function isVector(u) { return /^data:image\/svg/i.test(u) || /\.svgz?(\?|#|$)/i.test(u); }
  function rasterOf(cs) { const r = []; for (const k of ['backgroundImage', 'borderImageSource']) for (const u of urls(cs[k])) if (!isVector(u)) r.push(k + ' ' + u.split('/').pop().slice(0, 60)); return r; }
  function isClear(c) { return !c || /transparent|rgba\([^)]*,\s*0(\.0+)?\)|hsla\([^)]*,\s*0(\.0+)?%?\)|\/\s*0(\.0+)?%?\s*\)$/.test(c.trim()); }
  const natCache = {};
  async function natSize(u) { if (u in natCache) return natCache[u]; const im = new Image(); im.src = u; try { await im.decode(); natCache[u] = [im.naturalWidth, im.naturalHeight]; } catch (e) { natCache[u] = null; } return natCache[u]; }
  function lenPx(t, box) { if (t.endsWith('%')) return parseFloat(t) / 100 * box; if (t.endsWith('px')) return parseFloat(t); return null; }
  async function selfCoverage(cs, w, h) {
    // H4: max coverage (0..1) of the raster background layers on the element box; border-image raster = 1
    if (urls(cs.borderImageSource).some(u => !isVector(u))) return 1;
    const L = splitTop(cs.backgroundImage || 'none'), S = splitTop(cs.backgroundSize || 'auto'), P = splitTop(cs.backgroundRepeat || 'repeat');
    let best = 0;
    for (let i = 0; i < L.length; i++) {
      const m = /url\(\s*["']?(.*?)["']?\s*\)/.exec(L[i]); if (!m || isVector(m[1])) continue;
      const sz = (S[i % S.length] || 'auto').trim(), rp = (P[i % P.length] || 'repeat').trim().split(/\s+/);
      const rx = rp[0] === 'repeat-x' || rp[0] === 'repeat' || rp[0] === 'round' || rp[0] === 'space', ry = rp[0] === 'repeat-y' || (rp.length > 1 ? /repeat|round|space/.test(rp[1]) && rp[1] !== 'no-repeat' : (rp[0] === 'repeat' || rp[0] === 'round' || rp[0] === 'space'));
      let lw = null, lh = null;
      if (sz === 'cover') { lw = w; lh = h; }
      else {
        const nat = await natSize(m[1]); const nw = nat ? nat[0] : 0, nh = nat ? nat[1] : 0;
        if (sz === 'contain') { if (nw && nh) { const k = Math.min(w / nw, h / nh); lw = nw * k; lh = nh * k; } else { lw = w; lh = h; } }
        else {
          const t = sz.split(/\s+/); let a = lenPx(t[0], w), b = t.length > 1 ? lenPx(t[1], h) : null;
          if (a == null && b == null) { a = nw; b = nh; } else if (a == null) a = nh ? b * nw / nh : b; else if (b == null) b = nw ? a * nh / nw : a;
          lw = a; lh = b;
        }
      }
      // v02.4 C1: clip box (border-box | padding-box | content-box | text) and no-repeat position overflow
      const CL = splitTop(cs.backgroundClip || 'border-box'), clip = (CL[i % CL.length] || 'border-box').trim();
      if (clip === 'text') continue;
      let bw = w, bh = h;
      if (clip === 'padding-box' || clip === 'content-box') { bw -= px(cs.borderLeftWidth) + px(cs.borderRightWidth); bh -= px(cs.borderTopWidth) + px(cs.borderBottomWidth); }
      if (clip === 'content-box') { bw -= px(cs.paddingLeft) + px(cs.paddingRight); bh -= px(cs.paddingTop) + px(cs.paddingBottom); }
      bw = Math.max(0, bw); bh = Math.max(0, bh);
      const PX = splitTop(cs.backgroundPositionX || '0%'), PY = splitTop(cs.backgroundPositionY || '0%');
      function vis(rep, len, box, pos) { if (rep) return box; const t = (pos || '0%').trim(); let o = t.endsWith('%') ? (box - len) * parseFloat(t) / 100 : t.endsWith('px') ? parseFloat(t) : 0; if (!isFinite(o)) o = 0; return Math.max(0, Math.min(box, o + len) - Math.max(0, o)); }
      const vx = vis(rx, lw || 0, w, PX[i % PX.length]), vy = vis(ry, lh || 0, h, PY[i % PY.length]);
      const cx = Math.min(vx, bw) / Math.max(w, 1), cy = Math.min(vy, bh) / Math.max(h, 1);
      best = Math.max(best, cx * cy);
    }
    return Math.round(best * 1000) / 1000;
  }
  function pseudoArt(el, pseudos) { const r = []; for (const p of pseudos) { let cs; try { cs = getComputedStyle(el, p); } catch (e) { continue; } if (!cs) continue; if (p !== '::file-selector-button' && (!cs.content || cs.content === 'none' || cs.content === 'normal')) continue; if (cs.display === 'none') continue; for (const x of rasterOf(cs)) r.push(p + ' ' + x); for (const u of urls(cs.content)) if (!isVector(u)) r.push(p + ' content ' + u.split('/').pop().slice(0, 60)); } return r; }
  function hidden(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || parseFloat(cs.opacity) === 0) return 'display/opacity';
      if (e === el && (cs.visibility === 'hidden' || cs.visibility === 'collapse')) return 'visibility';
    }
    if (el.closest('[hidden],[aria-hidden=true][inert]')) return 'hidden-attr';
    return null;
  }
  function R(r) { return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function px(v) { return parseFloat(v) || 0; }
  function cssPath(el) {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      const cl = [...e.classList].slice(0, 2).join('.'); if (cl) s += '.' + cl;
      const sib = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const rows = [], ignored = { hidden: 0, tiny: 0, offscreen: 0 };
  const els = [...document.querySelectorAll(INSEL)];
  ignored.label_hosted = 0;
  for (const el0 of els) {
    let el = el0, viaLabel = null;
    const hid = hidden(el0), r0 = R(el0.getBoundingClientRect()), tiny = r0.w <= 2 || r0.h <= 2;
    if ((hid || tiny) && (el0.type === 'checkbox' || el0.type === 'radio') && el0.tagName === 'INPUT') {
      // v02.4 L1: the visible <label> is the control the visitor sees
      const lb = [...(el0.labels || [])].find(l => !hidden(l) && l.getBoundingClientRect().width > 2 && l.getBoundingClientRect().height > 2);
      if (lb) { viaLabel = lb; ignored.label_hosted++; }
    }
    if (!viaLabel && hid) { ignored.hidden++; continue; }
    if (!viaLabel && tiny) { ignored.tiny++; continue; }
    const r = viaLabel ? R(viaLabel.getBoundingClientRect()) : r0;
    const pr = { x: r.x + sx, y: r.y + sy, w: r.w, h: r.h };
    let inScroller = null;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (/(auto|scroll)/.test(c.overflowX + c.overflowY) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) { inScroller = e; break; } }
    if (pr.x + pr.w <= 0 || pr.y + pr.h <= 0 || ((pr.x >= docW || pr.y >= docH) && !inScroller)) { ignored.offscreen++; continue; }
    const cs = getComputedStyle(viaLabel || el);
    const type = el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text');
    const kind = (type === 'checkbox' || type === 'radio') ? 'toggle' : type === 'range' ? 'range' : type === 'file' ? 'file' : 'text';
    const app = viaLabel ? 'none' : (cs.appearance || cs.webkitAppearance || '');
    const accent = cs.accentColor || 'auto';
    let self = rasterOf(cs); let coverage = null;
    if (self.length) {
      coverage = await selfCoverage(cs, r.w, r.h);
      if (coverage < 0.60) { var covNote = `raster art covers only ${Math.round(coverage * 100)}% of the field (< 60%): icon, not a plaque`; self = []; } else var covNote = '';
    } else var covNote = '';
    const pse = pseudoArt(viaLabel || el, kind === 'file' ? ['::file-selector-button'] : ['::before', '::after']);
    let art = [], host = '', reasons = [];
    if (kind === 'toggle' || kind === 'range') {
      if (app === 'none' && (self.length || pse.length)) { art = self.concat(pse); host = self.length ? 'self' : 'pseudo'; }
      else if (app !== 'none') {
        reasons.push(`native UA widget (appearance ${app})`);
        if (accent && accent !== 'auto') reasons.push(`accent-color ${accent} only tints the UA widget (still native)`);
        if (self.length || pse.length) reasons.push('raster art present but appearance is not none, so the UA widget paints over it');
      } else reasons.push(viaLabel ? 'hidden input carried by a CSS-only <label> (no raster art on the label or its ::before/::after)' : 'appearance:none with CSS-only box (no raster art on self or ::before/::after)');
      if (viaLabel && art.length) { host = 'label' + (self.length ? '' : ' pseudo'); reasons.push('hidden input carried by a painted <label>'); }
    } else {
      if (self.length || (kind === 'file' && pse.length)) { art = self.concat(pse); host = self.length ? 'self' : 'pseudo'; }
      else {
        const bgA = isClear(cs.backgroundColor);
        const bord = ['Top', 'Right', 'Bottom', 'Left'].some(s => px(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && !isClear(cs['border' + s + 'Color']));
        let lvl = 1;
        for (let e = el.parentElement; e && lvl <= 2 && e !== document.body; e = e.parentElement, lvl++) {
          const er = R(e.getBoundingClientRect());
          const n = e.querySelectorAll(INSEL).length + e.querySelectorAll(SEL).length;
          const ea = rasterOf(getComputedStyle(e));
          if (!ea.length) continue;
          if (n > 1 || er.h > Math.max(ANCMAX * r.h, 96)) { reasons.push(`ancestor+${lvl} raster art is a backdrop (${n > 1 ? 'hosts ' + n + ' controls' : 'h ' + Math.round(er.h)})`); continue; }
          if (!bgA || bord) { reasons.push(`ancestor+${lvl} raster art hidden behind the field's own ${!bgA ? 'background ' + cs.backgroundColor : 'border'}`); continue; }
          art = ea; host = 'ancestor+' + lvl; break;
        }
        if (!art.length) {
          if (app && app !== 'none' && app !== 'auto') reasons.push(`native UA appearance ${app}`);
          if (bord) reasons.push(`plain css border ${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`);
          if (!bgA) reasons.push('css solid background ' + cs.backgroundColor);
          if (!reasons.length) reasons.push('no backing at all (bare text field)');
          reasons.unshift('no raster art on the field (plain UA/CSS text field)');
        }
      }
    }
    if (covNote) reasons.push(covNote);
    const latentD = closed.find(d => d.contains(el));
    const base = art.length ? 'NATIVE_PAINTED' : 'NATIVE_FLAT';
    const lab = (el.labels && el.labels[0]) ? el.labels[0].innerText : '';
    const lm = el.closest('footer,nav,header,main,aside');
    (viaLabel || el).setAttribute('data-fcs-in-idx', String(rows.length));
    rows.push({ idx: rows.length, id: el.id || el.getAttribute('data-fx') || '', type, kind, tag: el.tagName.toLowerCase(), selector: cssPath(el),
      text: (lab || el.getAttribute('aria-label') || el.placeholder || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 70),
      rect: [pr.x, pr.y, pr.w, pr.h].map(v => Math.round(v * 10) / 10), verdict: base + (latentD ? '_LATENT' : ''),
      latent_in: latentD ? (latentD.id ? 'details#' + latentD.id : cssPath(latentD)) : '', in_scroller: inScroller ? cssPath(inScroller) : '',
      appearance: app, accent_color: accent, art, art_host: host, art_coverage: coverage,  /* v02.4: reported whenever a raster on the field (or its carrying <label>) was measured, incl. < 60% */ reasons, label_hosted: !!viaLabel, landmark: lm ? lm.tagName.toLowerCase() + (lm.id ? '#' + lm.id : '') : '' });
  }
  return { rows, ignored, total_matched: els.length };
}
"""
CHIPJS = r"""
async ([INSEL, SEL, COVER, CHK, TBL]) => {
  // v02.7: TBL = table cells (td/th) get TABLE_CELL_* verdicts, not CHIP_*
  // v02.6: CHK = interior/broken-art checks on (false = v02.5 behaviour)
  // v02.5 K1 chip pass; runs after INJS (latent details still open)
  const closed = window.__fcsClosed || [];
  const docW = Math.max(document.documentElement.scrollWidth, innerWidth), docH = Math.max(document.documentElement.scrollHeight, innerHeight);
  const sx = scrollX, sy = scrollY;
  function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
  function urls(v) { if (!v || v === 'none') return []; const o = []; for (const L of splitTop(v)) { const m = /url\(\s*["']?(.*?)["']?\s*\)/.exec(L); if (m) o.push(m[1]); } return o; }
  function isVector(u) { return /^data:image\/svg/i.test(u) || /\.svgz?(\?|#|$)/i.test(u); }
  function rasterOf(cs) { const r = []; for (const k of ['backgroundImage', 'borderImageSource']) for (const u of urls(cs[k])) if (!isVector(u)) r.push(k + ' ' + u.split('/').pop().slice(0, 60)); return r; }
  function isClear(c) { return !c || /transparent|rgba\([^)]*,\s*0(\.0+)?\)|hsla\([^)]*,\s*0(\.0+)?%?\)|\/\s*0(\.0+)?%?\s*\)$/.test(c.trim()); }
  const natCache = {};
  async function natSize(u) { if (u in natCache) return natCache[u]; const im = new Image(); im.src = u; try { await im.decode(); natCache[u] = [im.naturalWidth, im.naturalHeight]; } catch (e) { natCache[u] = null; } return natCache[u]; }
  let curBroken = [];
  async function isBroken(u) { const n = await natSize(u); return !n || !n[0] || !n[1]; }
  async function anyLoaded(list) { let ok = false; for (const u of list) { if (isVector(u)) continue; if (await isBroken(u)) curBroken.push(u.split('/').pop().slice(0, 60)); else ok = true; } return ok; }
  function lenPx(t, box) { if (t.endsWith('%')) return parseFloat(t) / 100 * box; if (t.endsWith('px')) return parseFloat(t); return null; }
  async function selfCoverage(cs, w, h) {
    // H4: max coverage (0..1) of the raster background layers on the element box; border-image raster = 1
    if (CHK ? await anyLoaded(urls(cs.borderImageSource)) : urls(cs.borderImageSource).some(u => !isVector(u))) return 1;
    const L = splitTop(cs.backgroundImage || 'none'), S = splitTop(cs.backgroundSize || 'auto'), P = splitTop(cs.backgroundRepeat || 'repeat');
    let best = 0;
    for (let i = 0; i < L.length; i++) {
      const m = /url\(\s*["']?(.*?)["']?\s*\)/.exec(L[i]); if (!m || isVector(m[1])) continue;
      if (CHK && await isBroken(m[1])) { curBroken.push(m[1].split('/').pop().slice(0, 60)); continue; }
      const sz = (S[i % S.length] || 'auto').trim(), rp = (P[i % P.length] || 'repeat').trim().split(/\s+/);
      const rx = rp[0] === 'repeat-x' || rp[0] === 'repeat' || rp[0] === 'round' || rp[0] === 'space', ry = rp[0] === 'repeat-y' || (rp.length > 1 ? /repeat|round|space/.test(rp[1]) && rp[1] !== 'no-repeat' : (rp[0] === 'repeat' || rp[0] === 'round' || rp[0] === 'space'));
      let lw = null, lh = null;
      if (sz === 'cover') { lw = w; lh = h; }
      else {
        const nat = await natSize(m[1]); const nw = nat ? nat[0] : 0, nh = nat ? nat[1] : 0;
        if (sz === 'contain') { if (nw && nh) { const k = Math.min(w / nw, h / nh); lw = nw * k; lh = nh * k; } else { lw = w; lh = h; } }
        else {
          const t = sz.split(/\s+/); let a = lenPx(t[0], w), b = t.length > 1 ? lenPx(t[1], h) : null;
          if (a == null && b == null) { a = nw; b = nh; } else if (a == null) a = nh ? b * nw / nh : b; else if (b == null) b = nw ? a * nh / nw : a;
          lw = a; lh = b;
        }
      }
      // v02.4 C1: clip box (border-box | padding-box | content-box | text) and no-repeat position overflow
      const CL = splitTop(cs.backgroundClip || 'border-box'), clip = (CL[i % CL.length] || 'border-box').trim();
      if (clip === 'text') continue;
      let bw = w, bh = h;
      if (clip === 'padding-box' || clip === 'content-box') { bw -= px(cs.borderLeftWidth) + px(cs.borderRightWidth); bh -= px(cs.borderTopWidth) + px(cs.borderBottomWidth); }
      if (clip === 'content-box') { bw -= px(cs.paddingLeft) + px(cs.paddingRight); bh -= px(cs.paddingTop) + px(cs.paddingBottom); }
      bw = Math.max(0, bw); bh = Math.max(0, bh);
      const PX = splitTop(cs.backgroundPositionX || '0%'), PY = splitTop(cs.backgroundPositionY || '0%');
      function vis(rep, len, box, pos) { if (rep) return box; const t = (pos || '0%').trim(); let o = t.endsWith('%') ? (box - len) * parseFloat(t) / 100 : t.endsWith('px') ? parseFloat(t) : 0; if (!isFinite(o)) o = 0; return Math.max(0, Math.min(box, o + len) - Math.max(0, o)); }
      const vx = vis(rx, lw || 0, w, PX[i % PX.length]), vy = vis(ry, lh || 0, h, PY[i % PY.length]);
      const cx = Math.min(vx, bw) / Math.max(w, 1), cy = Math.min(vy, bh) / Math.max(h, 1);
      best = Math.max(best, cx * cy);
    }
    return Math.round(best * 1000) / 1000;
  }
  function pseudoArt(el, pseudos) { const r = []; for (const p of pseudos) { let cs; try { cs = getComputedStyle(el, p); } catch (e) { continue; } if (!cs) continue; if (p !== '::file-selector-button' && (!cs.content || cs.content === 'none' || cs.content === 'normal')) continue; if (cs.display === 'none') continue; for (const x of rasterOf(cs)) r.push(p + ' ' + x); for (const u of urls(cs.content)) if (!isVector(u)) r.push(p + ' content ' + u.split('/').pop().slice(0, 60)); } return r; }
  async function pseudoLoaded(el, pseudos) {
    let any = false;
    for (const p of pseudos) { let cs; try { cs = getComputedStyle(el, p); } catch (e) { continue; } if (!cs || cs.display === 'none') continue; if (p !== '::file-selector-button' && (!cs.content || cs.content === 'none' || cs.content === 'normal')) continue;
      const us = [...urls(cs.backgroundImage), ...urls(cs.borderImageSource), ...urls(cs.content)]; if (us.length && await anyLoaded(us)) any = true; }
    return any;
  }
  function hidden(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || parseFloat(cs.opacity) === 0) return 'display/opacity';
      if (e === el && (cs.visibility === 'hidden' || cs.visibility === 'collapse')) return 'visibility';
    }
    if (el.closest('[hidden],[aria-hidden=true][inert]')) return 'hidden-attr';
    return null;
  }
  function R(r) { return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function px(v) { return parseFloat(v) || 0; }
  function cssPath(el) {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      const cl = [...e.classList].slice(0, 2).join('.'); if (cl) s += '.' + cl;
      const sib = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const CTL = SEL + ', ' + INSEL;
  const SKIP = /^(HTML|BODY|HEAD|MAIN|HEADER|FOOTER|NAV|SECTION|ARTICLE|ASIDE|TABLE|THEAD|TBODY|TFOOT|TR|FORM|FIELDSET|SELECT|OPTION|TEXTAREA|INPUT|IMG|SVG|CANVAS|VIDEO|AUDIO|IFRAME|SCRIPT|STYLE|NOSCRIPT|BR|HR|PICTURE|SOURCE|DETAILS|DIALOG|LABEL)$/;
  function boxed(cs) {
    const bord = ['Top', 'Right', 'Bottom', 'Left'].some(s => px(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && cs['border' + s + 'Style'] !== 'hidden' && !isClear(cs['border' + s + 'Color']));
    const bg = !isClear(cs.backgroundColor);
    const bimg = cs.borderImageSource && cs.borderImageSource !== 'none';
    const rimg = rasterOf(cs).length > 0;
    return { bord, bg, any: bord || bg || bimg || rimg };
  }
  const rows = [], ignored = { hidden: 0, offscreen: 0, nested: 0 }, chosen = [];
  const all = [...document.body.querySelectorAll('*')];
  for (const el of all) {
    if (SKIP.test(el.tagName.toUpperCase())) continue;
    if (el.matches(CTL)) continue;                                   // already a control / native input row
    if (el.querySelector(CTL)) continue;                             // a container of controls is a card, not a chip
    const r = R(el.getBoundingClientRect());
    if (r.w <= 2 || r.h <= 2 || r.h > 80 || r.w > 320) continue;
    const cs = getComputedStyle(el), bx = boxed(cs);
    if (!bx.any) continue;
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 24) continue;
    if (hidden(el)) { ignored.hidden++; continue; }
    if (chosen.some(c => c.contains(el))) { ignored.nested++; continue; }
    const ctl = el.parentElement ? el.parentElement.closest(SEL) : null;
    if (ctl) { const q = R(ctl.getBoundingClientRect()); if (Math.abs(q.x - r.x) <= 2 && Math.abs(q.y - r.y) <= 2 && Math.abs(q.w - r.w) <= 2 && Math.abs(q.h - r.h) <= 2) continue; }  // the control's own face: v02.1 row covers it
    const pr = { x: r.x + sx, y: r.y + sy, w: r.w, h: r.h };
    let inScroller = null;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (/(auto|scroll)/.test(c.overflowX + c.overflowY) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) { inScroller = e; break; } }
    if (pr.x + pr.w <= 0 || pr.y + pr.h <= 0 || ((pr.x >= docW || pr.y >= docH) && !inScroller)) { ignored.offscreen++; continue; }
    chosen.push(el);
    // coverage: self (v02.4 selfCoverage), pseudo raster, child img / svg image
    curBroken = [];
    let cov = rasterOf(cs).length ? await selfCoverage(cs, r.w, r.h) : 0, host = cov > 0 ? 'self' : '';
    let pse = pseudoArt(el, ['::before', '::after']);
    if (CHK && pse.length && !(await pseudoLoaded(el, ['::before', '::after']))) pse = [];
    if (pse.length && cov < COVER) { cov = 1; host = 'pseudo'; }
    for (const im of el.querySelectorAll('img, svg image')) {
      const src = im.tagName.toLowerCase() === 'img' ? (im.currentSrc || im.src || '') : (im.getAttribute('href') || im.getAttribute('xlink:href') || '');
      if (!src || isVector(src)) continue;
      if (CHK && !(im.tagName.toLowerCase() === 'img' && im.loading === 'lazy' && !im.complete) && (im.tagName.toLowerCase() === 'img' ? (!im.complete || im.naturalWidth === 0) : await isBroken(src))) { curBroken.push(src.split('/').pop().slice(0, 60)); continue; }
      const q = R(im.getBoundingClientRect()); const x0 = Math.max(q.x, r.x), y0 = Math.max(q.y, r.y), x1 = Math.min(q.x + q.w, r.x + r.w), y1 = Math.min(q.y + q.h, r.y + r.h);
      const c = (x1 > x0 && y1 > y0) ? (x1 - x0) * (y1 - y0) / (r.w * r.h) : 0;
      if (c > cov) { cov = Math.round(c * 1000) / 1000; host = 'child'; }
    }
    const painted = cov >= COVER;
    let esc = '';
    if (ctl) esc = 'inside control <' + ctl.tagName.toLowerCase() + '>';
    if (!esc) { let lv = 0; for (let e = el.parentElement; e && e !== document.body && lv < 4; e = e.parentElement, lv++) { if (/card|tile/i.test(typeof e.className === 'string' ? e.className : '') && e.querySelector(SEL)) { esc = 'inside card ' + cssPath(e); break; } } }
    if (!esc) { const sb = [el.previousElementSibling, el.nextElementSibling].find(x => x && x.matches(SEL)); if (sb) esc = 'direct sibling of control <' + sb.tagName.toLowerCase() + '>'; }
    const latentD = closed.find(d => d.contains(el));
    const reasons = [];
    if (!painted) {
      if (CHK && curBroken.length) reasons.push('raster art failed to load (404 / decode error / naturalWidth 0): ' + [...new Set(curBroken)].join(', '));
      if (cov > 0) reasons.push(`raster art covers only ${Math.round(cov * 100)}% (< ${Math.round(COVER * 100)}%)`);
      if (bx.bg) reasons.push('css solid background ' + cs.backgroundColor);
      if (bx.bord) reasons.push('css border ' + cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor);
      const rad = px(cs.borderTopLeftRadius); if (rad > 0) reasons.push('css border-radius ' + cs.borderTopLeftRadius + (rad >= r.h / 2 - 1 ? ' (pill)' : ''));
      if (/gradient/.test(cs.backgroundImage)) reasons.push('css gradient');
      if (!reasons.length) reasons.push('css-only box');
    }
    const isCell = TBL && /^(TD|TH)$/.test(el.tagName.toUpperCase());  // v02.7 T3
    const base = isCell ? (painted ? 'TABLE_CELL_PAINTED' : 'TABLE_CELL_FLAT') : (painted ? 'CHIP_PAINTED' : 'CHIP_FLAT');
    const sev = isCell ? 'INFO' : (painted ? 'OK' : (esc ? 'FLAT' : 'WARN'));
    const lm = el.closest('footer,nav,header,main,aside');
    el.setAttribute('data-fcs-chip-idx', String(rows.length));
    rows.push({ idx: rows.length, id: el.id || el.getAttribute('data-fx') || '', tag: el.tagName.toLowerCase(), selector: cssPath(el), text: text.slice(0, 24),
      rect: [pr.x, pr.y, pr.w, pr.h].map(v => Math.round(v * 10) / 10), verdict: base + (latentD ? '_LATENT' : ''), severity: sev, escalation: esc,
      art_coverage: Math.round(cov * 1000) / 1000, art_host: host, reasons, latent_in: latentD ? (latentD.id ? 'details#' + latentD.id : cssPath(latentD)) : '',
      in_scroller: inScroller ? cssPath(inScroller) : '', landmark: lm ? lm.tagName.toLowerCase() + (lm.id ? '#' + lm.id : '') : '',
      ...(CHK ? { broken_art: [...new Set(curBroken)], bi_fill: /\bfill\b/.test(cs.borderImageSlice || '') && rasterOf(cs).some(x => x.startsWith('backgroundImage')) && urls(cs.borderImageSource).some(u => !isVector(u)), border_px: Math.max(px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)) } : {}) });
  }
  return { rows, ignored };
}
"""
CHIPKEYS = ('CHIP_PAINTED', 'CHIP_FLAT', 'CHIP_PAINTED_LATENT', 'CHIP_FLAT_LATENT')
CHIPSEV = ('CHIP_FLAT_SEV_FLAT', 'CHIP_FLAT_LATENT_SEV_FLAT', 'CHIP_WARN')
CHIPKEYS6 = CHIPKEYS + ('CHIP_EMPTY_FRAME', 'CHIP_EMPTY_FRAME_LATENT')   # v02.6 E1 (only present when the interior check is on)
TABLEKEYS = ('TABLE_CELL_PAINTED', 'TABLE_CELL_FLAT', 'TABLE_CELL_PAINTED_LATENT', 'TABLE_CELL_FLAT_LATENT')  # v02.7 T3
VISJS = r"""
async ([attr, idx]) => {
  // v02.7 T1 T-CLIP: scroll the element to centre, then measure clip + occlusion of its border box
  const el = document.querySelector('[' + attr + '="' + idx + '"]'); if (!el) return { missing: true };
  const save = { x: scrollX, y: scrollY, sc: [] };
  for (let e = el.parentElement; e; e = e.parentElement) save.sc.push([e, e.scrollLeft, e.scrollTop]);
  window.__fcsScrollSave = save;
  // v02.8 S1: pin scroll-behavior:auto on html, body and every ancestor so every scroll below lands at once
  save.sb = [];
  if (!window.__fcsLegacySmooth) {
    const pin = new Set([document.documentElement, document.body]); for (let e = el.parentElement; e; e = e.parentElement) pin.add(e);
    for (const e of pin) { if (!e || !e.style) continue; save.sb.push([e, e.getAttribute('style')]); e.style.setProperty('scroll-behavior', 'auto', 'important'); }
  }
  // only user-scrollable ancestors (overflow auto|scroll) and the window move; overflow hidden/clip boxes are never scrolled (a reader cannot scroll them)
  for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    const c = getComputedStyle(e);
    if (!/(auto|scroll)/.test(c.overflowX + c.overflowY)) continue;
    const q = e.getBoundingClientRect(), r0 = el.getBoundingClientRect();
    if (/(auto|scroll)/.test(c.overflowX)) e.scrollLeft += (r0.left + r0.width / 2) - (q.left + e.clientLeft + e.clientWidth / 2);
    if (/(auto|scroll)/.test(c.overflowY)) e.scrollTop += (r0.top + r0.height / 2) - (q.top + e.clientTop + e.clientHeight / 2);
  }
  { const r0 = el.getBoundingClientRect(), dx = r0.left + r0.width / 2 - innerWidth / 2, dy = r0.top + r0.height / 2 - innerHeight / 2;
    if (window.__fcsLegacySmooth) window.scrollBy(dx, dy); else window.scrollBy({ left: dx, top: dy, behavior: 'instant' }); }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = el.getBoundingClientRect(); const area = Math.max(1e-6, b.width * b.height);
  let x0 = Math.max(0, b.left), y0 = Math.max(0, b.top), x1 = Math.min(innerWidth, b.right), y1 = Math.min(innerHeight, b.bottom), clipBy = (x1 - x0) * (y1 - y0) < area - 0.5 ? 'viewport' : '';
  for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
    const c = getComputedStyle(e); const ox = c.overflowX !== 'visible', oy = c.overflowY !== 'visible'; if (!ox && !oy) continue;
    const q = e.getBoundingClientRect(); const bx0 = q.left + e.clientLeft, by0 = q.top + e.clientTop, bx1 = bx0 + e.clientWidth, by1 = by0 + e.clientHeight;
    const pre = [x0, y0, x1, y1];
    if (ox) { x0 = Math.max(x0, bx0); x1 = Math.min(x1, bx1); } if (oy) { y0 = Math.max(y0, by0); y1 = Math.min(y1, by1); }
    if (!clipBy && (pre[0] !== x0 || pre[1] !== y0 || pre[2] !== x1 || pre[3] !== y1)) clipBy = e.tagName.toLowerCase() + (e.id ? '#' + e.id : (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''));
  }
  const vis = Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / area;
  const m = Math.min(b.width, b.height), ins = Math.max(0, Math.min(0.30 * m, (m - 4) / 2));
  let n = 0, bad = 0, hit = '';
  for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
    const px = b.left + ins + (b.width - 2 * ins) * fx, py = b.top + ins + (b.height - 2 * ins) * fy;
    if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue;
    n++; const h = document.elementFromPoint(px, py);
    if (!h || h === el || el.contains(h) || h.contains(el)) continue;
    bad++; if (!hit) hit = h.tagName.toLowerCase() + (h.id ? '#' + h.id : (typeof h.className === 'string' && h.className ? '.' + h.className.trim().split(/\s+/)[0] : ''));
  }
  return { vis_frac: Math.round(vis * 1000) / 1000, occluded: n ? Math.round(bad / n * 1000) / 1000 : 1, hit, clip_by: clipBy };
}
"""
TOPJS = "window.__fcsLegacySmooth ? window.scrollTo(0,0) : window.scrollTo({ left: 0, top: 0, behavior: 'instant' })"  # v02.8 S2
UNSCROLLJS = """() => { const s = window.__fcsScrollSave; if (!s) return 0; for (const [e, l, t] of s.sc) { e.scrollLeft = l; e.scrollTop = t; }
  if (window.__fcsLegacySmooth) window.scrollTo(s.x, s.y); else window.scrollTo({ left: s.x, top: s.y, behavior: 'instant' });
  for (const [e, v] of (s.sb || [])) { if (v === null) e.removeAttribute('style'); else e.setAttribute('style', v); }  // exact attribute string back
  window.__fcsScrollSave = null; return 1; }"""

def tclip_verdict(v, tclip_min):
    """v02.7 T1: '' when the interior can be judged, else 'CLIPPED' or 'OCCLUDED'."""
    if not v or v.get('missing'): return ''
    if v.get('vis_frac', 1) < tclip_min: return 'CLIPPED'
    if v.get('occluded', 0) > 1 / 3: return 'OCCLUDED'
    return ''

def inner_inset(w, h):
    """v02.6 E1: css-px inset from each edge: 30% of the short side, but the interior never drops below 4 css px."""
    m = min(w, h); return max(0.0, min(0.30 * m, (m - 4) / 2))

def use_full_capture(doc_h, dpr):
    """v02.6 E1: one full-page capture is only attempted when the page is <= 16000 device px tall (Chromium/SwiftShader renders tiles past ~16384 px blank: the idc-programming page at 53k px gave flat grey crops)."""
    return float(doc_h) * float(dpr) <= 16000

def capture_trusted(img_w, img_h, doc_w, doc_h):
    """v02.6 E1: a full-page capture shorter than the document (scaled by the width ratio) is not trusted."""
    return img_h >= round(float(doc_h) * img_w / max(1.0, float(doc_w))) - 4

def interior_stats(im, empty_std, empty_content):
    """v02.6 E1: PIL-only (no numpy). std = luma stddev; content = share of pixels whose max channel differs from the median colour by > 24."""
    from PIL import Image, ImageChops, ImageStat
    im = im.convert('RGB'); n = max(1, im.width * im.height)
    std = ImageStat.Stat(im.convert('L')).stddev[0]; med = []
    for ch in im.split():
        c = 0
        for v, k in enumerate(ch.histogram()):
            c += k
            if c * 2 >= n: med.append(v); break
    r, g, b = ImageChops.difference(im, Image.new('RGB', im.size, tuple(med))).split()
    content = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > 24 else 0).histogram()[255] / n
    return dict(std=round(std, 2), content=round(content, 4), median=med, px=[im.width, im.height], empty=bool(std < empty_std and content < empty_content))

async def interior_check(pg, rows, attr, data, a, verdicts):
    """v02.6 E1/E3: for rows whose verdict is in `verdicts`, crop the interior and attach row['interior']; returns the rows found empty.
    Page-flow rows are cropped from ONE full-page screenshot (css coords x scale); rows inside a scroller or any fixed/sticky ancestor use the element screenshot."""
    from PIL import Image
    import io
    todo = [r for r in rows if r['verdict'] in verdicts]
    if not todo: return []
    full = None
    if use_full_capture(data['docH'], a.dpr):  # taller pages use per-row clip shots
      try: full = Image.open(io.BytesIO(await pg.screenshot(full_page=True, timeout=30000, animations='disabled'))).convert('RGB')
      except Exception: full = None
    if full is not None and not capture_trusted(full.width, full.height, data['docW'], data['docH']): full = None  # short capture: do not trust it
    bad = []
    for r in todo:
        x, y, w, h = r['rect']; ins = inner_inset(w, h); crop = None
        if not getattr(a, 'no_tclip', True):  # v02.7 T1/T2
            try:
                v = await pg.evaluate(VISJS, [attr, str(r['idx'])]); why = tclip_verdict(v, a.tclip_min)
                if why:
                    r['interior'] = dict(unverified=why, vis_frac=v.get('vis_frac'), occluded=v.get('occluded'), hit=v.get('hit', ''), clip_by=v.get('clip_by', ''), empty=False); continue
                if full is not None and not r.get('in_scroller'):
                    k = full.width / max(1.0, float(data['docW'])); crop = full.crop((round((x + ins) * k), round((y + ins) * k), round((x + w - ins) * k), round((y + h - ins) * k)))
                else:
                    im = Image.open(io.BytesIO(await pg.locator(f"[{attr}='{r['idx']}']").screenshot(timeout=10000, animations='disabled'))).convert('RGB'); k = im.width / max(1.0, w)
                    crop = im.crop((round(ins * k), round(ins * k), round((w - ins) * k), round((h - ins) * k)))
                if crop.width < 2 or crop.height < 2: raise ValueError('interior crop under 2 px')
                st = interior_stats(crop, a.empty_std, a.empty_content); st['inset'] = round(ins, 1); st['vis_frac'] = v.get('vis_frac'); st['occluded'] = v.get('occluded'); r['interior'] = st
                if st['empty']: bad.append(r)
            except Exception as e: r['interior'] = dict(error=str(e)[:100], empty=False)
            finally:
                try: await pg.evaluate(UNSCROLLJS)
                except Exception: pass
            continue
        try:
            if full is not None and not r.get('in_scroller'):
                k = full.width / max(1.0, float(data['docW'])); crop = full.crop((round((x + ins) * k), round((y + ins) * k), round((x + w - ins) * k), round((y + h - ins) * k)))
            elif r.get('in_scroller'):
                el = pg.locator(f"[{attr}='{r['idx']}']")
                try: await el.scroll_into_view_if_needed(timeout=2000)
                except Exception: pass
                im = Image.open(io.BytesIO(await el.screenshot(timeout=10000, animations='disabled'))).convert('RGB'); k = im.width / max(1.0, w)
                crop = im.crop((round(ins * k), round(ins * k), round((w - ins) * k), round((h - ins) * k)))
            else:  # tall page / no trusted full capture: clip the interior box directly
                crop = Image.open(io.BytesIO(await pg.screenshot(clip=dict(x=max(0, x + ins), y=y + ins, width=max(2, w - 2 * ins), height=max(2, h - 2 * ins)), full_page=True, timeout=10000, animations='disabled'))).convert('RGB')
            if crop.width < 2 or crop.height < 2: raise ValueError('interior crop under 2 px')
            st = interior_stats(crop, a.empty_std, a.empty_content); st['inset'] = round(ins, 1); r['interior'] = st
            if st['empty']: bad.append(r)
        except Exception as e: r['interior'] = dict(error=str(e)[:100], empty=False)
    return bad

INKEYS = ('NATIVE_PAINTED', 'NATIVE_FLAT', 'NATIVE_PAINTED_LATENT', 'NATIVE_FLAT_LATENT')

DSTATE = "[...document.querySelectorAll('details')].map(d => [d.getAttribute('name'), d.open])"
RESTORE = """() => {
  (window.__fcsClosed || []).forEach(d => d.open = false);           // close what the scan opened
  const N = window.__fcsNamed || [];
  for (const x of N) x.d.setAttribute('name', x.name);               // put exclusive-accordion names back
  for (const x of N) if (x.d.open !== x.open) x.d.open = x.open;     // re-apply each initial .open state
  document.querySelectorAll('[data-fcs-idx],[data-fcs-in-idx],[data-fcs-chip-idx]').forEach(e => { e.removeAttribute('data-fcs-idx'); e.removeAttribute('data-fcs-in-idx'); e.removeAttribute('data-fcs-chip-idx'); });  // v02.3 H2 (+ v02.5 chip idx)
  return N.length;
}"""
CHROMIUM_ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--mute-audio"]

def safe_slug(label, path):
    """v02.1: Windows-safe file stem (no ? * : < > | " \\ / or spaces)."""
    slug = (label + '_' + path.strip('/').replace('/', '_')).strip('_') or 'root'
    return re.sub(r'[^A-Za-z0-9._-]+', '_', slug)

def ink(im):
    g = im.convert('L'); h = g.histogram(); n = sum(h)
    return round(sum(h[128:]) / n, 4) if n else 0.0

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve(root):
    h = functools.partial(Quiet, directory=root)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), h); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def sheet(crops, path, title):
    from PIL import Image, ImageDraw, ImageFont
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    except Exception: font = ImageFont.load_default()
    W, cellh = 1200, 0; rows = []
    for im, cap in crops:
        if im.width > W - 20: im = im.resize((W - 20, max(1, int(im.height * (W - 20) / im.width))))
        if im.height > 240: im = im.resize((max(1, int(im.width * 240 / im.height)), 240))
        rows.append((im, cap))
    # 2 columns
    colw = (W - 30) // 2; tiles = []
    for im, cap in rows:
        if im.width > colw: im = im.resize((colw, max(1, int(im.height * colw / im.width))))
        tiles.append((im, cap, im.height + 52))
    H = 50 + sum(max(t[2] for t in tiles[i:i + 2]) for i in range(0, len(tiles), 2)) + 10
    S = Image.new('RGB', (W, max(H, 80)), (24, 20, 30)); d = ImageDraw.Draw(S)
    d.text((10, 12), title, fill=(255, 220, 120), font=font); y = 50
    for i in range(0, len(tiles), 2):
        rowh = max(t[2] for t in tiles[i:i + 2])
        for j, (im, cap, _) in enumerate(tiles[i:i + 2]):
            x = 10 + j * (colw + 10)
            d.text((x, y), cap[:70], fill=(240, 240, 240), font=font)
            S.paste(im, (x, y + 26)); d.rectangle([x - 1, y + 25, x + im.width, y + 26 + im.height], outline=(255, 60, 60))
        y += rowh
    S.save(path, quality=88)

async def run(a):
    from PIL import Image
    import io
    srv = None if a.base_url else serve(a.root); port = srv.server_address[1] if srv else None  # v02.5 K2
    res = dict(tool='flat_control_scan.py', version=VERSION, root=(a.base_url if a.base_url else os.path.abspath(a.root)), label=a.label, viewport=[a.width, a.height], dpr=a.dpr,
               cover=a.cover, anc_max=a.anc_max, selector=SEL, chromium_args=list(CHROMIUM_ARGS), pages=[])
    async with async_playwright() as p:
        kw = dict(args=list(CHROMIUM_ARGS))
        if a.chrome: kw['executable_path'] = a.chrome
        br = await p.chromium.launch(**kw)
        if getattr(a, 'smooth_scroll_legacy', False): res['smooth_scroll_legacy'] = True  # v02.8 S3
        for path in a.page:
            url = (a.base_url.rstrip('/') + path) if a.base_url else f"http://127.0.0.1:{port}{path}"
            ctx = await br.new_context(viewport={"width": a.width, "height": a.height}, device_scale_factor=a.dpr, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []; status = None; chain = []; http_redirs = []
            if getattr(a, 'smooth_scroll_legacy', False): await pg.add_init_script('window.__fcsLegacySmooth = true')  # v02.8 S3 (A/B only)
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:160]))
            pg.on("framenavigated", lambda f, pg=pg, chain=chain: chain.append(f.url) if f == pg.main_frame else None)
            navreq = []
            pg.on("request", lambda rq, pg=pg, navreq=navreq: navreq.append(rq.url) if rq.is_navigation_request() and rq.frame == pg.main_frame else None)
            try:
                resp = await pg.goto(url, wait_until="networkidle", timeout=45000); status = resp.status if resp else None
                rq = resp.request.redirected_from if resp else None
                while rq: http_redirs.insert(0, rq.url); rq = rq.redirected_from
            except Exception as e: errs.append("GOTO " + str(e)[:120])
            await pg.wait_for_timeout(a.settle)
            base = a.base_url.rstrip('/') if a.base_url else f"http://127.0.0.1:{port}"; fin = pg.url; load_error = False
            if fin.startswith('chrome-error:') and navreq: fin, load_error = navreq[-1], True  # destination failed to load: keep the URL it was sent to
            def rel(u): return u[len(base):] if u.startswith(base) else u
            norm = lambda u: rel(u).split('#')[0].split('?')[0]
            nav = [rel(u) for i, u in enumerate(chain) if (i == 0 or u != chain[i - 1]) and not u.startswith('chrome-error:')]
            if load_error and (not nav or nav[-1] != rel(fin)): nav.append(rel(fin))
            if not fin.startswith(base): landing = 'external'
            elif norm(fin).rstrip('/') != path.split('#')[0].split('?')[0].rstrip('/') and norm(fin).replace('index.html', '').rstrip('/') != path.replace('index.html', '').rstrip('/'): landing = 'internal-redirect'
            else: landing = 'same'
            final = dict(requested=path, final_url=rel(fin), final_load_error=load_error, landing=landing, nav_chain=nav, http_redirects=[rel(u) for u in http_redirs])
            if landing == 'external' and a.skip_external:
                slug = safe_slug(a.label, path)
                res['pages'].append(dict(path=path, http_status=status, errors=errs, counts=dict(PAINTED=0, FLAT=0, PAINTED_LATENT=0, FLAT_LATENT=0), ignored={}, ignored_samples=[], matched=0,
                                         doc=[0, 0], rows=[], contact_sheet=None, screenshot=None, rendered=False, skipped='external landing (--skip-external)', closed_details=0, latent_controls=0, exclusive_details=0, details_restore=None, crop_stats=[], **final,
                                         **({} if a.no_inputs else dict(input_rows=[], input_counts={k: 0 for k in INKEYS}, input_ignored={}, input_matched=0, input_contact_sheet=None, input_crop_stats=[])),
                                         **({} if a.no_chips else dict(chip_rows=[], chip_counts={k: 0 for k in (CHIPKEYS if a.no_interior else CHIPKEYS6) + CHIPSEV + (() if a.no_interior else ('CHIP_EMPTY_FRAME_SEV_FLAT',))}, chip_ignored={}, chip_contact_sheet=None, chip_crop_stats=[]))))
                await ctx.close(); continue
            try: await pg.evaluate("document.fonts && document.fonts.ready")
            except Exception: pass
            await pg.evaluate(TOPJS)
            try: pre_state = await pg.evaluate(DSTATE)
            except Exception as e: pre_state = None; errs.append('DSTATE ' + str(e)[:100])
            data = await pg.evaluate(JS, [SEL, a.cover, a.anc_max])
            rows = data['rows']
            indata = None if a.no_inputs else await pg.evaluate(INJS, [INSEL, SEL, a.anc_max])
            cnt = {k: sum(r['verdict'] == k for r in rows) for k in ('PAINTED', 'FLAT', 'PAINTED_LATENT', 'FLAT_LATENT')}
            slug = safe_slug(a.label, path)
            sheet_path = None; crop_stats = []
            if a.sheets and rows:
                os.makedirs(a.sheets, exist_ok=True)
                crops = []
                for r in rows:
                    if not r['verdict'].startswith('FLAT'): continue
                    x, y, w, h = r['rect']; pad = 12
                    clip = dict(x=max(0, x - pad), y=max(0, y - pad), width=min(w + 2 * pad, data['docW'] - max(0, x - pad)), height=h + 2 * pad)
                    try:
                        el = pg.locator(f"[data-fcs-idx='{r['idx']}']")
                        try: await el.scroll_into_view_if_needed(timeout=2000)
                        except Exception: pass  # animated/game pages may never report 'stable'; the full-page clip still works
                        png = await el.screenshot(timeout=10000, animations='disabled') if r.get('in_scroller') else await pg.screenshot(clip=clip, full_page=True, timeout=10000)
                        cim = Image.open(io.BytesIO(png)).convert('RGB'); crop_stats.append(dict(idx=r['idx'], w=cim.width, h=cim.height, ink=ink(cim)))
                        crops.append((cim, f"#{r['idx']}{' LATENT' if r['latent_in'] else ''} {r['tag']} '{r['text'][:40]}' [{r['landmark']}]"))
                    except Exception as e:
                        r['crop_error'] = str(e)[:100]
                if crops:
                    sheet_path = os.path.join(a.sheets, slug + '_FLAT_contact_sheet.jpg')
                    sheet(crops, sheet_path, f"{a.label} {path} FLAT {cnt['FLAT']} +latent {cnt['FLAT_LATENT']} / PAINTED {cnt['PAINTED']} @ {a.width}x{a.height} DPR{a.dpr}")
            inextra = {}
            if indata is not None:
                irows = indata['rows']; icnt = {k: sum(r['verdict'] == k for r in irows) for k in INKEYS}; isheet = None; icstats = []
                if a.sheets and any(r['verdict'].startswith('NATIVE_FLAT') for r in irows):
                    os.makedirs(a.sheets, exist_ok=True); icrops = []
                    for r in irows:
                        if not r['verdict'].startswith('NATIVE_FLAT'): continue
                        x, y, w, h = r['rect']; pad = 12
                        clip = dict(x=max(0, x - pad), y=max(0, y - pad), width=min(w + 2 * pad, data['docW'] - max(0, x - pad)), height=h + 2 * pad)
                        try:
                            el = pg.locator(f"[data-fcs-in-idx='{r['idx']}']")
                            try: await el.scroll_into_view_if_needed(timeout=2000)
                            except Exception: pass
                            png = await el.screenshot(timeout=10000, animations='disabled') if r.get('in_scroller') else await pg.screenshot(clip=clip, full_page=True, timeout=10000)
                            cim = Image.open(io.BytesIO(png)).convert('RGB'); icstats.append(dict(idx=r['idx'], w=cim.width, h=cim.height, ink=ink(cim)))
                            icrops.append((cim, f"in#{r['idx']}{' LATENT' if r['latent_in'] else ''} {r['type']} '{r['text'][:36]}' [{r['landmark']}]"))
                        except Exception as e:
                            r['crop_error'] = str(e)[:100]
                    if icrops:
                        isheet = os.path.join(a.sheets, slug + '_INPUT_FLAT_contact_sheet.jpg')
                        sheet(icrops, isheet, f"{a.label} {path} NATIVE_FLAT {icnt['NATIVE_FLAT']} +latent {icnt['NATIVE_FLAT_LATENT']} / NATIVE_PAINTED {icnt['NATIVE_PAINTED']}")
                inextra = dict(input_rows=irows, input_counts=icnt, input_ignored=indata['ignored'], input_matched=indata['total_matched'], input_contact_sheet=isheet, input_crop_stats=icstats)
            if a.interior_controls and not a.no_interior:  # v02.6 E3 (opt-in)
                for r in await interior_check(pg, rows, 'data-fcs-idx', data, a, ('PAINTED', 'PAINTED_LATENT')):
                    r['verdict'] = r['verdict'].replace('PAINTED', 'EMPTY_FRAME'); it_ = r['interior']
                    r['reasons'] = [f"painted control around an empty interior: inner {it_['px'][0]}x{it_['px'][1]} px stddev {it_['std']} (< {a.empty_std}), {round(it_['content'] * 100, 2)}% of pixels differ from median (< {a.empty_content * 100:g}%)"]
                cnt = {k: sum(r['verdict'] == k for r in rows) for k in ('PAINTED', 'FLAT', 'PAINTED_LATENT', 'FLAT_LATENT', 'EMPTY_FRAME', 'EMPTY_FRAME_LATENT')}
            if not a.no_chips:  # v02.5 K1
                cdata = await pg.evaluate(CHIPJS, [INSEL, SEL, a.cover, not a.no_interior, not a.table_as_chips]); crows = cdata['rows']
                trows = [r for r in crows if r['verdict'].startswith('TABLE_CELL')]  # v02.7 T3
                if not a.table_as_chips: crows = [r for r in crows if not r['verdict'].startswith('TABLE_CELL')]
                if not a.no_interior:  # v02.6 E1
                    for r in await interior_check(pg, crows, 'data-fcs-chip-idx', data, a, ('CHIP_PAINTED', 'CHIP_PAINTED_LATENT')):
                        r['verdict'] = r['verdict'].replace('CHIP_PAINTED', 'CHIP_EMPTY_FRAME'); r['severity'] = 'FLAT'; it_ = r['interior']
                        r['reasons'] = [f"painted frame around an empty interior: inner {it_['px'][0]}x{it_['px'][1]} px stddev {it_['std']} (< {a.empty_std}), {round(it_['content'] * 100, 2)}% of pixels differ from median {tuple(it_['median'])} (< {a.empty_content * 100:g}%)"] + (['border-image fill paints above the background-image and hides it'] if r.get('bi_fill') else []) + (['art failed to load: ' + ', '.join(r['broken_art'])] if r.get('broken_art') else [])
                ccnt = {k: sum(r['verdict'] == k for r in crows) for k in (CHIPKEYS if a.no_interior else CHIPKEYS6)}
                ccnt['CHIP_FLAT_SEV_FLAT'] = sum(r['verdict'] == 'CHIP_FLAT' and r['severity'] == 'FLAT' for r in crows)
                ccnt['CHIP_FLAT_LATENT_SEV_FLAT'] = sum(r['verdict'] == 'CHIP_FLAT_LATENT' and r['severity'] == 'FLAT' for r in crows)
                ccnt['CHIP_WARN'] = sum(r['verdict'].startswith('CHIP_FLAT') and r['severity'] == 'WARN' for r in crows)
                if not a.no_interior: ccnt['CHIP_EMPTY_FRAME_SEV_FLAT'] = ccnt['CHIP_EMPTY_FRAME'] + ccnt['CHIP_EMPTY_FRAME_LATENT']
                if not a.no_interior and not a.no_tclip: ccnt['CHIP_INTERIOR_UNVERIFIED'] = sum(bool((r.get('interior') or {}).get('unverified')) for r in crows)  # v02.7 T1
                csheet = None; ccstats = []
                isbad = (lambda v: v.startswith('CHIP_FLAT')) if a.no_interior else (lambda v: v.startswith('CHIP_FLAT') or v.startswith('CHIP_EMPTY'))
                if a.sheets and any(isbad(r['verdict']) for r in crows):
                    os.makedirs(a.sheets, exist_ok=True); ccrops = []
                    for r in crows:
                        if not isbad(r['verdict']) or len(ccrops) >= 60: continue
                        x, y, w, h = r['rect']; pad = 12
                        clip = dict(x=max(0, x - pad), y=max(0, y - pad), width=min(w + 2 * pad, data['docW'] - max(0, x - pad)), height=h + 2 * pad)
                        try:
                            png = await pg.locator(f"[data-fcs-chip-idx='{r['idx']}']").screenshot(timeout=10000, animations='disabled') if r.get('in_scroller') else await pg.screenshot(clip=clip, full_page=True, timeout=10000)
                            cim = Image.open(io.BytesIO(png)).convert('RGB'); ccstats.append(dict(idx=r['idx'], w=cim.width, h=cim.height, ink=ink(cim)))
                            ccrops.append((cim, f"chip#{r['idx']} {r['severity']} {r['tag']} '{r['text'][:24]}' [{r['landmark']}]"))
                        except Exception as e: r['crop_error'] = str(e)[:100]
                    if ccrops:
                        csheet = os.path.join(a.sheets, slug + '_CHIP_FLAT_contact_sheet.jpg')
                        sheet(ccrops, csheet, f"{a.label} {path} CHIP_FLAT {ccnt['CHIP_FLAT']} (sev FLAT {ccnt['CHIP_FLAT_SEV_FLAT']}, WARN {ccnt['CHIP_WARN']}) / CHIP_PAINTED {ccnt['CHIP_PAINTED']}" + ('' if a.no_interior else f" / CHIP_EMPTY_FRAME {ccnt['CHIP_EMPTY_FRAME']}+{ccnt['CHIP_EMPTY_FRAME_LATENT']} latent") + f" @ {a.width}x{a.height}")
                inextra.update(chip_rows=crows, chip_counts=ccnt, chip_ignored=cdata['ignored'], chip_contact_sheet=csheet, chip_crop_stats=ccstats)
                if not a.table_as_chips: inextra.update(table_rows=trows, table_counts={k: sum(r['verdict'] == k for r in trows) for k in TABLEKEYS})  # v02.7 T3
            try: await pg.evaluate(RESTORE)  # back to default state (v02.1: + exclusive-accordion names and initial .open)
            except Exception as e: errs.append('RESTORE ' + str(e)[:100])
            try: post_state = await pg.evaluate(DSTATE)
            except Exception as e: post_state = None; errs.append('RESTORE-READBACK ' + str(e)[:100])
            restore = dict(before=pre_state, after=post_state, restore_ok=pre_state == post_state)
            if not a.no_inputs:  # v02.3 H2 read-back (kept out of --no-inputs so that shape stays v02.2/v02.1)
                try: restore['dom_attrs_left'] = await pg.evaluate("document.querySelectorAll('[data-fcs-idx],[data-fcs-in-idx],[data-fcs-chip-idx]').length")
                except Exception as e: restore['dom_attrs_left'] = None; errs.append('ATTR-READBACK ' + str(e)[:100])
            shot = None
            if a.shots:
                os.makedirs(a.shots, exist_ok=True); shot = os.path.join(a.shots, slug + f"_vp{a.width}x{a.height}dpr{a.dpr:g}.png")
                await pg.evaluate(TOPJS); await pg.wait_for_timeout(300); await pg.screenshot(path=shot)
            res['pages'].append(dict(path=path, http_status=status, errors=errs, counts=cnt, ignored=data['ignored'], ignored_samples=data['ignoredSamples'], matched=data['total_matched'],
                                     doc=[data['docW'], data['docH']], rows=rows, contact_sheet=sheet_path, screenshot=shot,
                                     rendered=bool(status and status < 400), closed_details=data['closed_details'], latent_controls=data['latent_controls'], exclusive_details=data['exclusive_details'], details_restore=restore, crop_stats=crop_stats, **final, **inextra))
            await ctx.close()
        await br.close()
    if srv: srv.shutdown()
    res['totals'] = {k: sum(p_['counts'][k] for p_ in res['pages']) for k in ('PAINTED', 'FLAT', 'PAINTED_LATENT', 'FLAT_LATENT')}
    res['landings'] = {k: sum(p_['landing'] == k for p_ in res['pages']) for k in ('same', 'internal-redirect', 'external')}
    if not a.no_inputs:
        res['input_selector'] = INSEL
        res['input_totals'] = {k: sum(p_['input_counts'][k] for p_ in res['pages']) for k in INKEYS}
    if not a.no_chips:
        res['chip_totals'] = {k: sum(p_.get('chip_counts', {}).get(k, 0) for p_ in res['pages']) for k in (CHIPKEYS if a.no_interior else CHIPKEYS6) + CHIPSEV + (() if a.no_interior else ('CHIP_EMPTY_FRAME_SEV_FLAT',))}
    if not a.no_chips and not a.no_interior and not a.no_tclip:
        res['chip_totals']['CHIP_INTERIOR_UNVERIFIED'] = sum(p_.get('chip_counts', {}).get('CHIP_INTERIOR_UNVERIFIED', 0) for p_ in res['pages'])
    if not a.no_chips and not a.table_as_chips:
        res['table_totals'] = {k: sum(p_.get('table_counts', {}).get(k, 0) for p_ in res['pages']) for k in TABLEKEYS}
    if not a.no_interior:
        res['interior'] = dict(enabled=True, empty_std=a.empty_std, empty_content=a.empty_content, controls=bool(a.interior_controls), method='inner box inset 30% of min(w,h) from page screenshot; PIL luma stddev + share of pixels > 24 from median colour')
        if not a.no_tclip: res['interior'].update(tclip=True, tclip_min=a.tclip_min, tclip_method='scroll to centre; vis_frac after viewport + overflow-ancestor clip < tclip_min -> CLIPPED; > 1/3 of a 3x3 interior grid hit by an unrelated element -> OCCLUDED; unverified rows keep CHIP_PAINTED and are counted in CHIP_INTERIOR_UNVERIFIED')  # v02.7 T1
        if a.interior_controls: res['interior_control_totals'] = {k: sum(p_['counts'].get(k, 0) for p_ in res['pages']) for k in ('EMPTY_FRAME', 'EMPTY_FRAME_LATENT')}
    return res

def to_md(res):
    L = [f"# flat_control_scan {res['version']} - {res['label']}", '', f"root `{res['root']}`, viewport {res['viewport'][0]}x{res['viewport'][1]} DPR{res['dpr']}, cover >= {res['cover']}, ancestor guard: 1 control and h <= max({res['anc_max']}x control h, 96)", '',
         f"Totals: PAINTED {res['totals']['PAINTED']}, FLAT {res['totals']['FLAT']} (visible at default state); latent in closed <details>: PAINTED_LATENT {res['totals']['PAINTED_LATENT']}, FLAT_LATENT {res['totals']['FLAT_LATENT']}", '',
         f"Landings: {res['landings']}", '']
    if 'input_totals' in res:
        it = res['input_totals']; L += [f"Native inputs (v02.2): NATIVE_PAINTED {it['NATIVE_PAINTED']}, NATIVE_FLAT {it['NATIVE_FLAT']}, NATIVE_PAINTED_LATENT {it['NATIVE_PAINTED_LATENT']}, NATIVE_FLAT_LATENT {it['NATIVE_FLAT_LATENT']}", '']
    if 'chip_totals' in res:
        ct = res['chip_totals']; L += [f"Chips (v02.5): CHIP_PAINTED {ct['CHIP_PAINTED']}, CHIP_FLAT {ct['CHIP_FLAT']} (severity FLAT {ct['CHIP_FLAT_SEV_FLAT']}, WARN {ct['CHIP_WARN']}), CHIP_PAINTED_LATENT {ct['CHIP_PAINTED_LATENT']}, CHIP_FLAT_LATENT {ct['CHIP_FLAT_LATENT']} (severity FLAT {ct['CHIP_FLAT_LATENT_SEV_FLAT']})", '']
    if 'table_totals' in res:
        tt = res['table_totals']; L += [f"Tables (v02.7): TABLE_CELL_PAINTED {tt['TABLE_CELL_PAINTED']}, TABLE_CELL_FLAT {tt['TABLE_CELL_FLAT']}, TABLE_CELL_PAINTED_LATENT {tt['TABLE_CELL_PAINTED_LATENT']}, TABLE_CELL_FLAT_LATENT {tt['TABLE_CELL_FLAT_LATENT']} (severity INFO; data cells, not UI; no exit effect)", '']
    if 'interior' in res:
        if (res.get('interior') or {}).get('tclip'): L += [f"T-CLIP (v02.7): CHIP_INTERIOR_UNVERIFIED {(res.get('chip_totals') or {}).get('CHIP_INTERIOR_UNVERIFIED', 0)} (clipped or occluded; not judged empty, check by eye); tclip_min {res['interior']['tclip_min']}", '']
        ct = res.get('chip_totals') or {}; L += [f"Interior check (v02.6): CHIP_EMPTY_FRAME {ct.get('CHIP_EMPTY_FRAME', 0)}, CHIP_EMPTY_FRAME_LATENT {ct.get('CHIP_EMPTY_FRAME_LATENT', 0)} (severity FLAT); std < {res['interior']['empty_std']}, content < {res['interior']['empty_content']}; controls {'on: ' + str(res.get('interior_control_totals')) if res['interior']['controls'] else 'off (--interior-controls)'}", '']
    for pg in res['pages']:
        c = pg['counts']
        L += [f"## {pg['path']}  (HTTP {pg['http_status']}; PAINTED {c['PAINTED']}, FLAT {c['FLAT']}, PAINTED_LATENT {c['PAINTED_LATENT']}, FLAT_LATENT {c['FLAT_LATENT']}; ignored {pg['ignored']})", '',
              f"landing {pg['landing']} -> final `{pg['final_url']}`" + (f"; nav chain {pg['nav_chain']}" if len(pg['nav_chain']) > 1 else '') + (f"; HTTP redirects {pg['http_redirects']}" if pg['http_redirects'] else '') + (f"; SKIPPED: {pg['skipped']}" if pg.get('skipped') else ''), '']
        if pg.get('exclusive_details') or (pg.get('details_restore') and not pg['details_restore']['restore_ok']):
            L += [f"exclusive accordions: {pg.get('exclusive_details', 0)} details[name] stripped during the latent pass; restore_ok {pg['details_restore']['restore_ok'] if pg.get('details_restore') else None}", '']
        if pg['errors']: L += ['page errors: ' + '; '.join(pg['errors'])[:600], '']
        if pg['contact_sheet']: L += [f"contact sheet: `{os.path.basename(pg['contact_sheet'])}`", '']
        L += ['| # | verdict | landmark | selector | text | rect x,y,w,h | cover | sprite / reasons |', '|---|---|---|---|---|---|---|---|']
        for r in sorted(pg['rows'], key=lambda r: (not r['verdict'].startswith('FLAT'), r['idx'])):
            why = (f"{r['sprite']['kind']} {r['sprite']['host']} {r['sprite']['url']}" if r['verdict'].startswith('PAINTED') and r['sprite'] else '; '.join(r['reasons']))
            L.append(f"| {r['idx']} | {r['verdict']} | {r['landmark']} | `{r['selector'][:70]}` | {r['text'][:40].replace('|', '/')} | {','.join(str(v) for v in r['rect'])} | {r['cover']} | {why[:160].replace('|', '/')} |")
        if 'input_rows' in pg:
            ic = pg['input_counts']
            L += ['', f"Native inputs (v02.2): NATIVE_PAINTED {ic['NATIVE_PAINTED']}, NATIVE_FLAT {ic['NATIVE_FLAT']}, NATIVE_PAINTED_LATENT {ic['NATIVE_PAINTED_LATENT']}, NATIVE_FLAT_LATENT {ic['NATIVE_FLAT_LATENT']}; ignored {pg['input_ignored']}"]
            if pg.get('input_contact_sheet'): L.append(f"input contact sheet: `{os.path.basename(pg['input_contact_sheet'])}`")
            if pg['input_rows']:
                L += ['', '| in# | verdict | type | selector | label | rect x,y,w,h | appearance / accent | art / reasons |', '|---|---|---|---|---|---|---|---|']
                for r in sorted(pg['input_rows'], key=lambda r: (not r['verdict'].startswith('NATIVE_FLAT'), r['idx'])):
                    why = (r['art_host'] + ' ' + '; '.join(r['art'])) if r['art'] else '; '.join(r['reasons'])
                    L.append(f"| {r['idx']} | {r['verdict']} | {r['type']} | `{r['selector'][:70]}` | {r['text'][:40].replace('|', '/')} | {','.join(str(v) for v in r['rect'])} | {r['appearance']} / {r['accent_color']} | {why[:160].replace('|', '/')} |")
        if 'chip_rows' in pg:
            cc = pg['chip_counts']
            L += ['', f"Chips (v02.5): CHIP_PAINTED {cc['CHIP_PAINTED']}, CHIP_FLAT {cc['CHIP_FLAT']} (severity FLAT {cc['CHIP_FLAT_SEV_FLAT']}, WARN {cc['CHIP_WARN']}), CHIP_FLAT_LATENT {cc['CHIP_FLAT_LATENT']}; ignored {pg['chip_ignored']}"]
            if pg.get('chip_contact_sheet'): L.append(f"chip contact sheet: `{os.path.basename(pg['chip_contact_sheet'])}`")
            if pg['chip_rows']:
                L += ['', '| chip# | verdict | severity | selector | text | rect x,y,w,h | coverage | escalation / reasons |', '|---|---|---|---|---|---|---|---|']
                for r in sorted(pg['chip_rows'], key=lambda r: ({'FLAT': 0, 'WARN': 1}.get(r['severity'], 2), r['idx'])):
                    why = (r['escalation'] + '; ' if r['escalation'] else '') + ('; '.join(r['reasons']) if r['reasons'] else r['art_host'])
                    L.append(f"| {r['idx']} | {r['verdict']} | {r['severity']} | `{r['selector'][:70]}` | {r['text'].replace('|', '/')} | {','.join(str(v) for v in r['rect'])} | {r['art_coverage']} | {why[:160].replace('|', '/')} |")
        if pg.get('ignored_samples'):
            L += ['', 'Ignored (first 40): ' + '; '.join(f"{x['why']} {x['tag']} '{x['text'][:30]}' {x['rect']}" for x in pg['ignored_samples'])]
        L.append('')
    return '\n'.join(L) + '\n'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root'); ap.add_argument('--page', action='append', required=True)
    ap.add_argument('--label', default='scan'); ap.add_argument('--out', default='.')
    ap.add_argument('--cover', type=float, default=0.60); ap.add_argument('--anc-max', type=float, default=3.0)
    ap.add_argument('--width', type=int, default=390); ap.add_argument('--height', type=int, default=844); ap.add_argument('--dpr', type=float, default=2)
    ap.add_argument('--settle', type=int, default=2500)
    ap.add_argument('--latent-ok', action='store_true', help='exit 1 only on visible FLAT (latent FLAT still reported)')
    ap.add_argument('--skip-external', action='store_true', help='do not scan pages that land off the served root')
    ap.add_argument('--no-inputs', action='store_true', help='v02.2: skip the native-input pass (reproduces v02.1 output; only version differs)')
    ap.add_argument('--inputs-ok', action='store_true', help='v02.2: NATIVE_FLAT inputs are reported but do not set exit 1')
    ap.add_argument('--sheets', help='dir for FLAT contact sheets'); ap.add_argument('--shots', help='dir for viewport screenshots')
    ap.add_argument('--no-chips', action='store_true', help='v02.5: skip the chip pass (reproduces v02.4 output; only version differs)')
    ap.add_argument('--chips-ok', action='store_true', help='v02.5: severity-FLAT chips are reported but do not set exit 1')
    ap.add_argument('--no-interior', action='store_true', help='v02.6: skip the interior-content and broken-art checks (reproduces v02.5 output; only version differs)')
    ap.add_argument('--empty-ok', action='store_true', help='v02.6: CHIP_EMPTY_FRAME / EMPTY_FRAME rows are reported but do not set exit 1')
    ap.add_argument('--interior-controls', action='store_true', help='v02.6: also run the interior check on PAINTED controls (EMPTY_FRAME); default off')
    ap.add_argument('--empty-std', type=float, default=6.0, help='v02.6: luma stddev below which an interior counts as flat (default 6.0)')
    ap.add_argument('--empty-content', type=float, default=0.005, help='v02.6: share of pixels differing from the median colour by > 24 below which an interior has no content (default 0.005)')
    ap.add_argument('--no-tclip', action='store_true', help='v02.7: skip the T-CLIP visibility gate and use the v02.6 crop paths (reproduces v02.6 output; only version differs)')
    ap.add_argument('--tclip-min', type=float, default=0.95, help='v02.7: visible share of the box below which an interior is CLIPPED (default 0.95)')
    ap.add_argument('--smooth-scroll-legacy', action='store_true', help='v02.8: scroll like v02.7 (no scroll-behavior pin, no behavior:instant); A/B only')
    ap.add_argument('--table-as-chips', action='store_true', help='v02.7: count <td>/<th> boxes as chips again (v02.6 behaviour); default: TABLE_CELL_* rows, reported only')
    ap.add_argument('--base-url', help='v02.5: scan a live site at this base URL instead of serving --root')
    ap.add_argument('--version', action='version', version='flat_control_scan.py ' + VERSION)
    ap.add_argument('--chrome', default='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)
    a = ap.parse_args()
    if not a.root and not a.base_url: ap.error('one of --root or --base-url is required')
    try: res = asyncio.run(run(a))
    except Exception as e: print('ERROR', repr(e), file=sys.stderr); sys.exit(2)
    os.makedirs(a.out, exist_ok=True)
    jp = os.path.join(a.out, a.label + '.json'); mp = os.path.join(a.out, a.label + '.md')
    with open(jp, 'w', encoding='utf-8') as f: json.dump(res, f, indent=1)  # v02.3 H1
    with open(mp, 'w', encoding='utf-8') as f: f.write(to_md(res))
    t = res['totals']; print(f"{a.label}: PAINTED {t['PAINTED']} FLAT {t['FLAT']} PAINTED_LATENT {t['PAINTED_LATENT']} FLAT_LATENT {t['FLAT_LATENT']} landings {res['landings']} -> {jp}")
    if 'input_totals' in res: it = res['input_totals']; print(f"{a.label} inputs: NATIVE_PAINTED {it['NATIVE_PAINTED']} NATIVE_FLAT {it['NATIVE_FLAT']} NATIVE_PAINTED_LATENT {it['NATIVE_PAINTED_LATENT']} NATIVE_FLAT_LATENT {it['NATIVE_FLAT_LATENT']}")
    if 'chip_totals' in res: ct = res['chip_totals']; print(f"{a.label} chips: CHIP_PAINTED {ct['CHIP_PAINTED']} CHIP_FLAT {ct['CHIP_FLAT']} (sev FLAT {ct['CHIP_FLAT_SEV_FLAT']} WARN {ct['CHIP_WARN']}) CHIP_PAINTED_LATENT {ct['CHIP_PAINTED_LATENT']} CHIP_FLAT_LATENT {ct['CHIP_FLAT_LATENT']} (sev FLAT {ct['CHIP_FLAT_LATENT_SEV_FLAT']})")
    if 'table_totals' in res: tt = res['table_totals']; print(f"{a.label} tables: TABLE_CELL_PAINTED {tt['TABLE_CELL_PAINTED']} TABLE_CELL_FLAT {tt['TABLE_CELL_FLAT']} TABLE_CELL_PAINTED_LATENT {tt['TABLE_CELL_PAINTED_LATENT']} TABLE_CELL_FLAT_LATENT {tt['TABLE_CELL_FLAT_LATENT']} (INFO, no exit effect)")
    if 'chip_totals' in res and 'CHIP_INTERIOR_UNVERIFIED' in res['chip_totals']: print(f"{a.label} tclip: CHIP_INTERIOR_UNVERIFIED {res['chip_totals']['CHIP_INTERIOR_UNVERIFIED']}")
    if 'interior' in res: ct = res['chip_totals']; print(f"{a.label} interior: CHIP_EMPTY_FRAME {ct['CHIP_EMPTY_FRAME']} CHIP_EMPTY_FRAME_LATENT {ct['CHIP_EMPTY_FRAME_LATENT']}" + (f" | controls EMPTY_FRAME {res['interior_control_totals']['EMPTY_FRAME']} EMPTY_FRAME_LATENT {res['interior_control_totals']['EMPTY_FRAME_LATENT']}" if 'interior_control_totals' in res else ''))
    for pg in res['pages']: print(f"  {pg['path']}: HTTP {pg['http_status']} {pg['landing']} -> {pg['final_url']} PAINTED {pg['counts']['PAINTED']} FLAT {pg['counts']['FLAT']} P_LAT {pg['counts']['PAINTED_LATENT']} F_LAT {pg['counts']['FLAT_LATENT']} ignored {pg['ignored']}" + (f" | IN NP {pg['input_counts']['NATIVE_PAINTED']} NF {pg['input_counts']['NATIVE_FLAT']} NP_LAT {pg['input_counts']['NATIVE_PAINTED_LATENT']} NF_LAT {pg['input_counts']['NATIVE_FLAT_LATENT']}" if 'input_counts' in pg else ''))
    bad = t['FLAT'] or (t['FLAT_LATENT'] and not a.latent_ok)
    if 'input_totals' in res and not a.inputs_ok: bad = bad or res['input_totals']['NATIVE_FLAT'] or (res['input_totals']['NATIVE_FLAT_LATENT'] and not a.latent_ok)
    if 'chip_totals' in res and not a.chips_ok: bad = bad or res['chip_totals']['CHIP_FLAT_SEV_FLAT'] or (res['chip_totals']['CHIP_FLAT_LATENT_SEV_FLAT'] and not a.latent_ok)  # v02.5 K1
    if 'interior' in res and not a.empty_ok:  # v02.6 E1/E3
        bad = bad or res['chip_totals']['CHIP_EMPTY_FRAME'] or (res['chip_totals']['CHIP_EMPTY_FRAME_LATENT'] and not a.latent_ok)
        if 'interior_control_totals' in res: bad = bad or res['interior_control_totals']['EMPTY_FRAME'] or (res['interior_control_totals']['EMPTY_FRAME_LATENT'] and not a.latent_ok)
    sys.exit(1 if bad else 0)

if __name__ == '__main__': main()
