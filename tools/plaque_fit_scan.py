#!/usr/bin/env python3
"""plaque_fit_scan.py v01 - painted-plaque label spill checker (machine check only).

Serves a directory statically, opens page paths in headless Chromium at 390x844 DPR2,
and for every element whose computed border-image-source or background-image references a
plaque sprite (regex --pattern) computes:
  * element rect
  * painted inner well:
      - border-image: SLICE well = border-image area minus computed border-image-width
        (numbers x border width, %, px, auto=slice px; CSS overlap scale-down applied)
      - both kinds: PIXEL well = the dark well measured in the sprite pixels (walk out
        from the sprite centre until gold frame / ornament pixels), mapped through the
        real 9-slice geometry (border-image) or the real drawn sprite rect (background-
        image: background-size/position/origin incl. contain/cover/auto/atlas % sizes
        computed from the sprite's natural size). --caps JSON overrides with fixed
        natural-px caps [top,right,bottom,left] per sprite basename.
  * text ink bbox: DOM Range rects over the element's own text nodes (text inside a
    nested sprite element is measured on that element), horizontal from Range rects
    (trailing letter-spacing trimmed), vertical from canvas measureText ink ascent/descent.
FAIL when the text ink box crosses a well by > --tol CSS px on any side, or when a
background sprite does not stretch to the element (background-size not 100% on X and
drawn width < element width - 2px). Visible <canvas> elements, and select/input/textarea
controls inside (or being) a sprite element, are reported NOT MEASURED.
Exit code 1 on any FAIL, 0 otherwise, 2 on usage/runtime error.
"""
import argparse, asyncio, functools, http.server, io, json, os, re, socketserver, sys, threading, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image

VERSION = "v01"
DEFAULT_PATTERN = r"vorath_(btn|cartouche|plaque|stat_plaque|card_frame|ui_buttons|hud_cartouche)"

JS = r"""(pat) => {
 const re = new RegExp(pat);
 const urls = s => { const o=[]; const r=/url\(\s*(["']?)(.*?)\1\s*\)/g; let m; while((m=r.exec(s))) o.push(m[2]); return o; };
 const isSprite = e => { const s=getComputedStyle(e); return re.test(s.borderImageSource) || re.test(s.backgroundImage); };
 const desc = e => { let d=e.tagName.toLowerCase(); if(e.id) d+='#'+e.id; const c=(typeof e.className==='string'?e.className:'').trim().split(/\s+/).filter(Boolean).slice(0,3); if(c.length) d+='.'+c.join('.'); return d; };
 const cv = document.createElement('canvas').getContext('2d');
 const sx = window.scrollX, sy = window.scrollY;
 const out = {elements:[], canvases:[], formctrls:[], vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio};
 for (const e of document.querySelectorAll('*')) {
   if (e.tagName==='CANVAS') { const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
     if (r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none') out.canvases.push({desc:desc(e),x:r.left+sx,y:r.top+sy,w:r.width,h:r.height}); continue; }
   if (!isSprite(e)) continue;
   const s = getComputedStyle(e); const r = e.getBoundingClientRect();
   if (r.width<=0||r.height<=0||s.visibility==='hidden'||s.display==='none'||parseFloat(s.opacity)===0) continue;
   // own text nodes (skip descendants that are themselves sprite elements, or not rendered)
   const texts=[]; let hidden=0, offbox=0; const walker=document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
   let n; while((n=walker.nextNode())) {
     if (!n.nodeValue.trim()) continue;
     let p=n.parentElement, skip=false;
     while (p && p!==e) { if (isSprite(p)) {skip=true;break;}
       const qs=getComputedStyle(p), qr=p.getBoundingClientRect();
       if (qs.overflow!=='visible' && (qr.width<=2||qr.height<=2)) {skip=true;hidden++;break;}  // sr-only / honeypot clip
       p=p.parentElement; }
     if (skip) continue;
     const ps=getComputedStyle(n.parentElement);
     if (ps.visibility==='hidden'||parseFloat(ps.opacity)===0) continue;
     const rg=document.createRange(); rg.selectNodeContents(n);
     const rects=[...rg.getClientRects()].filter(q=>q.width>0.5&&q.height>0.5);
     if (!rects.length) continue;
     let t=n.nodeValue.replace(/\s+/g,' ').trim(); const tt=ps.textTransform;
     if (tt==='uppercase') t=t.toUpperCase(); else if (tt==='lowercase') t=t.toLowerCase();
     cv.font = ps.font || (ps.fontStyle+' '+ps.fontWeight+' '+ps.fontSize+' '+ps.fontFamily);
     const ls = parseFloat(ps.letterSpacing)||0; try { cv.letterSpacing = ls+'px'; } catch(_){}
     const m = cv.measureText(t);
     const fa=m.fontBoundingBoxAscent, ia=m.actualBoundingBoxAscent, id=m.actualBoundingBoxDescent;
     for (const q of rects) { if (q.right<r.left||q.left>r.right||q.bottom<r.top||q.top>r.bottom) {offbox++; continue;}
       texts.push({t:t.slice(0,60), x0:q.left+sx, x1:q.right+sx-Math.max(0,ls), y0:q.top+sy+(fa-ia), y1:q.top+sy+fa+id, ry0:q.top+sy, ry1:q.bottom+sy}); }
   }
   for (const fc of [e, ...e.querySelectorAll('select,input,textarea')]) {
     if (!/^(SELECT|INPUT|TEXTAREA)$/.test(fc.tagName)) continue;
     if (fc.tagName==='INPUT' && /^(checkbox|radio|hidden|range|color|file|image)$/.test(fc.type)) continue;
     const fr=fc.getBoundingClientRect(); if (fr.right<0||fr.bottom<0) continue;
     if (fr.width>0&&fr.height>0&&getComputedStyle(fc).visibility!=='hidden') out.formctrls.push({desc:desc(fc), host:desc(e), x:fr.left+sx,y:fr.top+sy,w:fr.width,h:fr.height});
   }
   out.elements.push({desc:desc(e), text:(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,60),
     x:r.left+sx, y:r.top+sy, w:r.width, h:r.height,
     bw:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(parseFloat),
     pad:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat),
     bis:s.borderImageSource, bisUrls:urls(s.borderImageSource), bislice:s.borderImageSlice, biw:s.borderImageWidth, bio:s.borderImageOutset,
     bgi:s.backgroundImage, bgs:s.backgroundSize, bgp:s.backgroundPosition, bgo:s.backgroundOrigin, bgr:s.backgroundRepeat,
     texts, skipped_text:{clipped_tiny:hidden, outside_box:offbox}});
 }
 return out; }"""

def split_top(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ',' and depth == 0: out.append(cur.strip()); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur.strip())
    return out

def four(vals):
    v = list(vals)
    if len(v) == 1: v = v * 4
    elif len(v) == 2: v = [v[0], v[1], v[0], v[1]]
    elif len(v) == 3: v = [v[0], v[1], v[2], v[1]]
    return v[:4]

# ---------------- sprite well measurement ----------------
def is_frame(px):
    r, g, b, a = px
    return a >= 128 and r >= 110 and g >= 70 and (r - b) >= 45

def measure_well(im, box=None):
    """Return natural-px well insets [top,right,bottom,left] inside box (x0,y0,x1,y1) of im."""
    im = im.convert('RGBA'); x0, y0, x1, y1 = box or (0, 0, im.width, im.height)
    W, H = x1 - x0, y1 - y0; pix = im.load()
    cx, cy = x0 + W // 2, y0 + H // 2
    def walk(x, y, dx, dy):
        # first run of >=2 frame pixels walking from (x,y); returns distance to the edge reached
        run = 0; steps = 0
        while x0 <= x < x1 and y0 <= y < y1:
            if is_frame(pix[x, y]):
                run += 1
                if run >= 2: return steps - 1
            else: run = 0
            x += dx; y += dy; steps += 1
        return steps
    import statistics
    rows = [y0 + int(H * f) for f in (0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65)]
    cols = [x0 + int(W * f) for f in (0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7)]
    left = statistics.median([cx - walk(cx, y, -1, 0) - x0 for y in rows])
    right = statistics.median([x1 - (cx + walk(cx, y, 1, 0)) - 1 for y in rows])
    top = statistics.median([cy - walk(x, cy, 0, -1) - y0 for x in cols])
    bottom = statistics.median([y1 - (cy + walk(x, cy, 0, 1)) - 1 for x in cols])
    return [max(0, top), max(0, right), max(0, bottom), max(0, left)]

class SpriteCache:
    def __init__(self, base, caps):
        self.base, self.caps, self.c = base, caps, {}
    def get(self, url):
        if url not in self.c:
            data = urllib.request.urlopen(url, timeout=20).read()
            self.c[url] = Image.open(io.BytesIO(data)).convert('RGBA')
        return self.c[url]
    def well(self, url, box=None):
        name = os.path.basename(urllib.parse.urlparse(url).path)
        if name in self.caps: return list(map(float, self.caps[name])), 'caps_json'
        key = (url, box)
        if key not in self.c: self.c[key] = measure_well(self.get(url), box)
        return self.c[key], 'pixel'

# ---------------- geometry ----------------
def len_px(tok, ref):
    tok = tok.strip()
    if tok.endswith('px'): return float(tok[:-2])
    if tok.endswith('%'): return float(tok[:-1]) / 100 * ref
    return float(tok)

def border_image_geom(el, img):
    W, H = img.size
    sl = el['bislice'].replace('fill', '').split()
    sl = four(sl)
    s = [len_px(sl[0], H), len_px(sl[1], W), len_px(sl[2], H), len_px(sl[3], W)]
    s = [min(s[0], H), min(s[1], W), min(s[2], H), min(s[3], W)]
    bo = four(el['bio'].split())
    bw = el['bw']
    o = [len_px(t, 0) * (bw[i] if not t.endswith('px') else 1) if not t.endswith('%') else 0 for i, t in enumerate(bo)]
    ax, ay, aw, ah = el['x'] - o[3], el['y'] - o[0], el['w'] + o[1] + o[3], el['h'] + o[0] + o[2]
    wt = four(el['biw'].split()); w = []
    for i, t in enumerate(wt):
        ref = ah if i in (0, 2) else aw
        if t == 'auto': w.append(s[i])
        elif t.endswith('px') or t.endswith('%'): w.append(len_px(t, ref))
        else: w.append(float(t) * bw[i])
    f = min(1.0, aw / (w[1] + w[3]) if (w[1] + w[3]) > 0 else 1.0, ah / (w[0] + w[2]) if (w[0] + w[2]) > 0 else 1.0)
    w = [v * f for v in w]
    return dict(area=(ax, ay, aw, ah), slice=s, width=w, nat=(W, H))

def map9(v, nat, s0, s1, a0, alen, w0, w1):
    # natural coordinate v (0..nat) -> rendered coordinate along one axis
    if v <= s0: return a0 + (v / s0 * w0 if s0 > 0 else 0)
    if v >= nat - s1: return a0 + alen - ((nat - v) / s1 * w1 if s1 > 0 else 0)
    mid_n = nat - s0 - s1; mid_r = alen - w0 - w1
    return a0 + w0 + ((v - s0) / mid_n * mid_r if mid_n > 0 else 0)

def bg_layer(el, pat):
    imgs = split_top(el['bgi']); sizes = split_top(el['bgs']); poss = split_top(el['bgp']); origs = split_top(el['bgo'])
    for i, im in enumerate(imgs):
        m = re.search(r'url\(\s*(["\']?)(.*?)\1\s*\)', im)
        if m and re.search(pat, m.group(2)):
            pick = lambda L: L[i % len(L)] if L else ''
            return m.group(2), pick(sizes), pick(poss), pick(origs)
    return None

def bg_geom(el, img, size, pos, origin):
    W, H = img.size; bw, pad = el['bw'], el['pad']
    x, y, w, h = el['x'], el['y'], el['w'], el['h']
    if origin == 'padding-box' or origin == '': x += bw[3]; y += bw[0]; w -= bw[1] + bw[3]; h -= bw[0] + bw[2]
    elif origin == 'content-box':
        x += bw[3] + pad[3]; y += bw[0] + pad[0]; w -= bw[1] + bw[3] + pad[1] + pad[3]; h -= bw[0] + bw[2] + pad[0] + pad[2]
    size = size.strip()
    if size in ('contain', 'cover'):
        k = (min if size == 'contain' else max)(w / W, h / H); dw, dh = W * k, H * k
    else:
        t = size.split();
        if len(t) == 1: t = [t[0], 'auto']
        dw = None if t[0] == 'auto' else len_px(t[0], w)
        dh = None if t[1] == 'auto' else len_px(t[1], h)
        if dw is None and dh is None: dw, dh = W, H
        elif dw is None: dw = dh * W / H
        elif dh is None: dh = dw * H / W
    pt = pos.split();
    if len(pt) == 1: pt.append('50%')
    def p(tok, free):
        tok = {'left': '0%', 'top': '0%', 'center': '50%', 'right': '100%', 'bottom': '100%'}.get(tok, tok)
        return len_px(tok, free) if tok.endswith('%') else len_px(tok, 0)
    ox = x + p(pt[0], w - dw); oy = y + p(pt[1], h - dh)
    return dict(sheet=(ox, oy, dw, dh), pos_area=(x, y, w, h), nat=(W, H), size=size)

def text_box(el):
    T = el['texts']
    if not T: return None
    return (min(t['x0'] for t in T), min(t['y0'] for t in T), max(t['x1'] for t in T), max(t['y1'] for t in T))

def spill(tb, well):
    # positive values = px the ink crosses the well edge on that side [top,right,bottom,left]
    wx0, wy0, wx1, wy1 = well
    return [round(wy0 - tb[1], 2), round(tb[2] - wx1, 2), round(tb[3] - wy1, 2), round(wx0 - tb[0], 2)]

SIDES = ['top', 'right', 'bottom', 'left']

def analyse(el, sc, pat, tol, base_url):
    row = dict(element=el['desc'], label=el['text'], rect=[round(el['x'], 1), round(el['y'], 1), round(el['w'], 1), round(el['h'], 1)], checks=[], verdict='PASS', reasons=[])
    tb = text_box(el); row['text_ink'] = [round(v, 1) for v in tb] if tb else None
    row['skipped_text'] = el.get('skipped_text')
    wells = {}
    bi = [u for u in el['bisUrls'] if re.search(pat, u)]
    if bi:
        url = urllib.parse.urljoin(base_url, bi[0]); img = sc.get(url); g = border_image_geom(el, img)
        ax, ay, aw, ah = g['area']; w = g['width']; s = g['slice']; W, H = g['nat']
        row['kind'] = 'border-image'; row['sprite'] = os.path.basename(bi[0])
        row['slice'] = [round(v, 1) for v in s]; row['bi_width'] = [round(v, 2) for v in w]
        wells['slice'] = (ax + w[3], ay + w[0], ax + aw - w[1], ay + ah - w[2])
        pw, src = sc.well(url)
        wells[src] = (map9(pw[3], W, s[3], s[1], ax, aw, w[3], w[1]), map9(pw[0], H, s[0], s[2], ay, ah, w[0], w[2]),
                                 map9(W - pw[1], W, s[3], s[1], ax, aw, w[3], w[1]), map9(H - pw[2], H, s[0], s[2], ay, ah, w[0], w[2]))
        row['sprite_well_nat'] = [round(v, 1) for v in pw]
    else:
        lay = bg_layer(el, pat)
        if not lay: return None
        u, size, pos, origin = lay; url = urllib.parse.urljoin(base_url, u); img = sc.get(url)
        g = bg_geom(el, img, size, pos, origin); ox, oy, dw, dh = g['sheet']; W, H = g['nat']
        row['kind'] = 'background-image'; row['sprite'] = os.path.basename(u); row['bg_size'] = size; row['bg_position'] = pos
        # atlas detection: integer multiples of 100% on an axis -> grid cells sized to the positioning area
        cols = rows_ = 1
        m = re.fullmatch(r'([\d.]+)%(?:\s+([\d.]+)%)?', size)
        if m:
            px_, py_ = float(m.group(1)), float(m.group(2) or m.group(1))
            if px_ > 100 and abs(px_ / 100 - round(px_ / 100)) < 1e-6: cols = int(round(px_ / 100))
            if py_ > 100 and abs(py_ / 100 - round(py_ / 100)) < 1e-6: rows_ = int(round(py_ / 100))
        cw, ch = dw / cols, dh / rows_
        ax_, ay_, aw_, ah_ = g['pos_area']
        ci = min(cols - 1, max(0, int(round((ax_ - ox) / cw)))) if cols > 1 else 0
        ri = min(rows_ - 1, max(0, int(round((ay_ - oy) / ch)))) if rows_ > 1 else 0
        dx0, dy0 = ox + ci * cw, oy + ri * ch
        nbox = (int(round(ci * W / cols)), int(round(ri * H / rows_)), int(round((ci + 1) * W / cols)), int(round((ri + 1) * H / rows_)))
        if cols > 1 or rows_ > 1: row['atlas_cell'] = [ci, ri, cols, rows_]
        # clip drawn rect to element border box (background-clip default border-box)
        ex0, ey0, ex1, ey1 = el['x'], el['y'], el['x'] + el['w'], el['y'] + el['h']
        drawn = (max(dx0, ex0), max(dy0, ey0), min(dx0 + cw, ex1), min(dy0 + ch, ey1))
        row['drawn_rect'] = [round(drawn[0], 1), round(drawn[1], 1), round(drawn[2] - drawn[0], 1), round(drawn[3] - drawn[1], 1)]
        stretched_x = (cols > 1 and abs(cw - aw_) < 0.5) or size.split()[0] == '100%'
        if not stretched_x and (drawn[2] - drawn[0]) < el['w'] - 2:
            row['verdict'] = 'FAIL'; row['reasons'].append(f"sprite not stretched: drawn w {drawn[2]-drawn[0]:.1f} < element w {el['w']:.1f} - 2 (background-size {size})")
        pw, src = sc.well(url, nbox if (cols > 1 or rows_ > 1) else None)
        nw, nh = nbox[2] - nbox[0], nbox[3] - nbox[1]
        kx, ky = cw / nw, ch / nh
        wells[src] = (dx0 + pw[3] * kx, dy0 + pw[0] * ky, dx0 + cw - pw[1] * kx, dy0 + ch - pw[2] * ky)
        row['sprite_well_nat'] = [round(v, 1) for v in pw]
    row['wells'] = {k: [round(v, 1) for v in w_] for k, w_ in wells.items()}
    if tb is None:
        row['note'] = 'no own text'
    else:
        for k, wl in wells.items():
            sp = spill(tb, wl); row['spill_' + k] = sp
            bad = [f"{SIDES[i]} {sp[i]:+.1f}px" for i in range(4) if sp[i] > tol]
            if bad: row['verdict'] = 'FAIL'; row['reasons'].append(f"text crosses {k} well: " + ', '.join(bad))
    return row

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve(root):
    h = functools.partial(Quiet, directory=root)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), h); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def run(args):
    srv = serve(args.root); port = srv.server_address[1]
    caps = json.load(open(args.caps)) if args.caps else {}
    results = dict(tool='plaque_fit_scan.py', version=VERSION, root=os.path.abspath(args.root), label=args.label, pattern=args.pattern, tol=args.tol,
                   viewport=[args.width, args.height], dpr=args.dpr, pages=[])
    async with async_playwright() as p:
        kw = dict(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        if args.chrome: kw['executable_path'] = args.chrome
        br = await p.chromium.launch(**kw)
        for path in args.page:
            base = f"http://127.0.0.1:{port}{path}"
            ctx = await br.new_context(viewport={"width": args.width, "height": args.height}, device_scale_factor=args.dpr, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:160]))
            try: await pg.goto(base, wait_until="networkidle", timeout=45000)
            except Exception as e: errs.append("GOTO " + str(e)[:120])
            await pg.wait_for_timeout(args.settle)
            await pg.evaluate("document.fonts && document.fonts.ready")
            data = await pg.evaluate(JS, args.pattern)
            sc = SpriteCache(base, caps); rows = []
            for el in data['elements']:
                try:
                    r = analyse(el, sc, args.pattern, args.tol, base)
                except Exception as e:
                    r = dict(element=el['desc'], label=el['text'], verdict='ERROR', reasons=[repr(e)[:200]])
                if r: rows.append(r)
            nm = [dict(element=c['desc'], rect=[round(c['x'], 1), round(c['y'], 1), round(c['w'], 1), round(c['h'], 1)], verdict='NOT MEASURED',
                       reasons=['canvas-drawn: plaques/HUD painted into the canvas bitmap are invisible to this DOM check; seat by eye']) for c in data['canvases']]
            nm += [dict(element=c['desc'], label='(form control in ' + c['host'] + ')', rect=[round(c['x'], 1), round(c['y'], 1), round(c['w'], 1), round(c['h'], 1)], verdict='NOT MEASURED',
                        reasons=['select/input value text is painted by the control, not a DOM text node; the host plaque row covers only its own text nodes; seat by eye']) for c in
                   {(c['desc'], round(c['x']), round(c['y'])): c for c in data['formctrls']}.values()]  # dedupe; innermost host wins (document order)
            shot = None
            if args.shots:
                os.makedirs(args.shots, exist_ok=True)
                slug = (args.label + '_' + path.strip('/').replace('/', '_')) or 'root'
                shot = os.path.join(args.shots, slug + '_vp390x844dpr2.png')
                await pg.evaluate("window.scrollTo(0,0)"); await pg.screenshot(path=shot)
            results['pages'].append(dict(path=path, errors=errs, rows=rows, not_measured=nm, screenshot=shot,
                                         counts=dict(FAIL=sum(r['verdict'] == 'FAIL' for r in rows), PASS=sum(r['verdict'] == 'PASS' for r in rows),
                                                     ERROR=sum(r['verdict'] == 'ERROR' for r in rows), NOT_MEASURED=len(nm))))
            await ctx.close()
        await br.close()
    srv.shutdown()
    tot = {k: sum(pg_['counts'][k] for pg_ in results['pages']) for k in ('FAIL', 'PASS', 'ERROR', 'NOT_MEASURED')}
    results['totals'] = tot
    return results

def to_md(res):
    L = [f"# plaque_fit_scan {res['version']} - {res['label']}", '', f"root `{res['root']}`, viewport {res['viewport'][0]}x{res['viewport'][1]} DPR{res['dpr']}, tol {res['tol']} px, pattern `{res['pattern']}`", '',
         f"Totals: FAIL {res['totals']['FAIL']}, PASS {res['totals']['PASS']}, ERROR {res['totals']['ERROR']}, NOT MEASURED {res['totals']['NOT_MEASURED']}", '']
    for pg in res['pages']:
        c = pg['counts']
        L += [f"## {pg['path']}  (FAIL {c['FAIL']}, PASS {c['PASS']}, ERROR {c['ERROR']}, NOT MEASURED {c['NOT_MEASURED']})", '']
        if pg['errors']: L += ['page errors: ' + '; '.join(pg['errors']), '']
        L += ['| verdict | element | label | kind / sprite | rect x,y,w,h | worst spill px (t,r,b,l) | reasons |', '|---|---|---|---|---|---|---|']
        for r in sorted(pg['rows'] + pg['not_measured'], key=lambda r: {'FAIL': 0, 'ERROR': 1, 'NOT MEASURED': 2, 'PASS': 3}[r['verdict']]):
            sp = [r[k] for k in r if k.startswith('spill_')]
            worst = [max(s[i] for s in sp) for i in range(4)] if sp else None
            lab = (r.get('label') or '').replace('|', '/')
            L.append(f"| {r['verdict']} | `{r['element']}` | {lab[:40]} | {r.get('kind','canvas')} {r.get('sprite','')} | {','.join(str(v) for v in r['rect']) if 'rect' in r else ''} | {','.join(f'{v:+.1f}' for v in worst) if worst else ''} | {'; '.join(r.get('reasons', []))[:220]} |")
        L.append('')
    return '\n'.join(L) + '\n'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', required=True, help='directory to serve statically (e.g. a git worktree)')
    ap.add_argument('--page', action='append', required=True, help='page path, e.g. /warband/ (repeatable)')
    ap.add_argument('--label', default='scan'); ap.add_argument('--out', default='.', help='output dir for JSON/MD')
    ap.add_argument('--pattern', default=DEFAULT_PATTERN); ap.add_argument('--tol', type=float, default=1.0)
    ap.add_argument('--caps', help='JSON {sprite_basename: [top,right,bottom,left] natural px} overriding pixel well')
    ap.add_argument('--width', type=int, default=390); ap.add_argument('--height', type=int, default=844); ap.add_argument('--dpr', type=float, default=2)
    ap.add_argument('--settle', type=int, default=2500, help='ms to wait after networkidle')
    ap.add_argument('--shots', help='dir for viewport screenshots'); ap.add_argument('--chrome', default='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)
    a = ap.parse_args()
    try: res = asyncio.run(run(a))
    except Exception as e: print('ERROR', repr(e), file=sys.stderr); sys.exit(2)
    os.makedirs(a.out, exist_ok=True)
    jp = os.path.join(a.out, a.label + '.json'); mp = os.path.join(a.out, a.label + '.md')
    json.dump(res, open(jp, 'w'), indent=1); open(mp, 'w').write(to_md(res))
    t = res['totals']; print(f"{a.label}: FAIL {t['FAIL']} PASS {t['PASS']} ERROR {t['ERROR']} NOT_MEASURED {t['NOT_MEASURED']} -> {jp}")
    sys.exit(1 if t['FAIL'] or t['ERROR'] else 0)

if __name__ == '__main__': main()
