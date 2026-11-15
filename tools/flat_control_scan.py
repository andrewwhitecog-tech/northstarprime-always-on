#!/usr/bin/env python3
"""flat_control_scan.py v02.1 (Grok): sibling of plaque_fit_scan.py.

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

VERSION = 'v02.1'
SEL = 'a, button, [role=button], input[type=button], input[type=submit], input[type=reset], input[type=image], summary, select'

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

DSTATE = "[...document.querySelectorAll('details')].map(d => [d.getAttribute('name'), d.open])"
RESTORE = """() => {
  (window.__fcsClosed || []).forEach(d => d.open = false);           // close what the scan opened
  const N = window.__fcsNamed || [];
  for (const x of N) x.d.setAttribute('name', x.name);               // put exclusive-accordion names back
  for (const x of N) if (x.d.open !== x.open) x.d.open = x.open;     // re-apply each initial .open state
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
    srv = serve(a.root); port = srv.server_address[1]
    res = dict(tool='flat_control_scan.py', version=VERSION, root=os.path.abspath(a.root), label=a.label, viewport=[a.width, a.height], dpr=a.dpr,
               cover=a.cover, anc_max=a.anc_max, selector=SEL, chromium_args=list(CHROMIUM_ARGS), pages=[])
    async with async_playwright() as p:
        kw = dict(args=list(CHROMIUM_ARGS))
        if a.chrome: kw['executable_path'] = a.chrome
        br = await p.chromium.launch(**kw)
        for path in a.page:
            url = f"http://127.0.0.1:{port}{path}"
            ctx = await br.new_context(viewport={"width": a.width, "height": a.height}, device_scale_factor=a.dpr, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []; status = None; chain = []; http_redirs = []
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
            base = f"http://127.0.0.1:{port}"; fin = pg.url; load_error = False
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
                                         doc=[0, 0], rows=[], contact_sheet=None, screenshot=None, rendered=False, skipped='external landing (--skip-external)', closed_details=0, latent_controls=0, exclusive_details=0, details_restore=None, crop_stats=[], **final))
                await ctx.close(); continue
            try: await pg.evaluate("document.fonts && document.fonts.ready")
            except Exception: pass
            await pg.evaluate("window.scrollTo(0,0)")
            try: pre_state = await pg.evaluate(DSTATE)
            except Exception as e: pre_state = None; errs.append('DSTATE ' + str(e)[:100])
            data = await pg.evaluate(JS, [SEL, a.cover, a.anc_max])
            rows = data['rows']
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
            try: await pg.evaluate(RESTORE)  # back to default state (v02.1: + exclusive-accordion names and initial .open)
            except Exception as e: errs.append('RESTORE ' + str(e)[:100])
            try: post_state = await pg.evaluate(DSTATE)
            except Exception as e: post_state = None; errs.append('RESTORE-READBACK ' + str(e)[:100])
            restore = dict(before=pre_state, after=post_state, restore_ok=pre_state == post_state)
            shot = None
            if a.shots:
                os.makedirs(a.shots, exist_ok=True); shot = os.path.join(a.shots, slug + '_vp390x844dpr2.png')
                await pg.evaluate("window.scrollTo(0,0)"); await pg.wait_for_timeout(300); await pg.screenshot(path=shot)
            res['pages'].append(dict(path=path, http_status=status, errors=errs, counts=cnt, ignored=data['ignored'], ignored_samples=data['ignoredSamples'], matched=data['total_matched'],
                                     doc=[data['docW'], data['docH']], rows=rows, contact_sheet=sheet_path, screenshot=shot,
                                     rendered=bool(status and status < 400), closed_details=data['closed_details'], latent_controls=data['latent_controls'], exclusive_details=data['exclusive_details'], details_restore=restore, crop_stats=crop_stats, **final))
            await ctx.close()
        await br.close()
    srv.shutdown()
    res['totals'] = {k: sum(p_['counts'][k] for p_ in res['pages']) for k in ('PAINTED', 'FLAT', 'PAINTED_LATENT', 'FLAT_LATENT')}
    res['landings'] = {k: sum(p_['landing'] == k for p_ in res['pages']) for k in ('same', 'internal-redirect', 'external')}
    return res

def to_md(res):
    L = [f"# flat_control_scan {res['version']} - {res['label']}", '', f"root `{res['root']}`, viewport {res['viewport'][0]}x{res['viewport'][1]} DPR{res['dpr']}, cover >= {res['cover']}, ancestor guard: 1 control and h <= max({res['anc_max']}x control h, 96)", '',
         f"Totals: PAINTED {res['totals']['PAINTED']}, FLAT {res['totals']['FLAT']} (visible at default state); latent in closed <details>: PAINTED_LATENT {res['totals']['PAINTED_LATENT']}, FLAT_LATENT {res['totals']['FLAT_LATENT']}", '',
         f"Landings: {res['landings']}", '']
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
        if pg.get('ignored_samples'):
            L += ['', 'Ignored (first 40): ' + '; '.join(f"{x['why']} {x['tag']} '{x['text'][:30]}' {x['rect']}" for x in pg['ignored_samples'])]
        L.append('')
    return '\n'.join(L) + '\n'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', required=True); ap.add_argument('--page', action='append', required=True)
    ap.add_argument('--label', default='scan'); ap.add_argument('--out', default='.')
    ap.add_argument('--cover', type=float, default=0.60); ap.add_argument('--anc-max', type=float, default=3.0)
    ap.add_argument('--width', type=int, default=390); ap.add_argument('--height', type=int, default=844); ap.add_argument('--dpr', type=float, default=2)
    ap.add_argument('--settle', type=int, default=2500)
    ap.add_argument('--latent-ok', action='store_true', help='exit 1 only on visible FLAT (latent FLAT still reported)')
    ap.add_argument('--skip-external', action='store_true', help='do not scan pages that land off the served root')
    ap.add_argument('--sheets', help='dir for FLAT contact sheets'); ap.add_argument('--shots', help='dir for viewport screenshots')
    ap.add_argument('--chrome', default='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)
    a = ap.parse_args()
    try: res = asyncio.run(run(a))
    except Exception as e: print('ERROR', repr(e), file=sys.stderr); sys.exit(2)
    os.makedirs(a.out, exist_ok=True)
    jp = os.path.join(a.out, a.label + '.json'); mp = os.path.join(a.out, a.label + '.md')
    json.dump(res, open(jp, 'w'), indent=1); open(mp, 'w').write(to_md(res))
    t = res['totals']; print(f"{a.label}: PAINTED {t['PAINTED']} FLAT {t['FLAT']} PAINTED_LATENT {t['PAINTED_LATENT']} FLAT_LATENT {t['FLAT_LATENT']} landings {res['landings']} -> {jp}")
    for pg in res['pages']: print(f"  {pg['path']}: HTTP {pg['http_status']} {pg['landing']} -> {pg['final_url']} PAINTED {pg['counts']['PAINTED']} FLAT {pg['counts']['FLAT']} P_LAT {pg['counts']['PAINTED_LATENT']} F_LAT {pg['counts']['FLAT_LATENT']} ignored {pg['ignored']}")
    sys.exit(1 if (t['FLAT'] or (t['FLAT_LATENT'] and not a.latent_ok)) else 0)

if __name__ == '__main__': main()
