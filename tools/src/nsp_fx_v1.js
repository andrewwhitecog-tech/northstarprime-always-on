/* NorthStar IDG Arcade FX kit v1 (2026-11-04).
   Shared lighting, glow, particles, shockwaves, floating text and title-screen
   helpers for the arcade's canvas games. No dependencies, no network.
   Glow is drawn from cached radial sprites with additive ('lighter') blending,
   never per-particle shadowBlur, so it stays fast on software rasterisers.
   This is the readable source; tools/ is left out of the Pages artifact. The
   served copy, static/games/nsp_fx_v1.js, is minified to keep the artifact
   under its 980 MB guard. After editing, rebuild it from the repo root:
   esbuild tools/src/nsp_fx_v1.js --minify --target=es2020 --legal-comments=none --charset=utf8 --banner:js="// NSPFX v1. Generated from tools/src/nsp_fx_v1.js: edit that file, then rebuild with the command at its top." --outfile=static/games/nsp_fx_v1.js */
(function (global) {
  "use strict";
  const TAU = Math.PI * 2;
  const spriteCache = new Map();

  function parseColor(c) {
    if (/^hsla?\(/i.test(c)) {
      const m = c.match(/hsla?\(\s*([-\d.]+)\D+([\d.]+)%\D+([\d.]+)%/i);
      if (m) {
        const h = ((+m[1] % 360) + 360) % 360 / 360, s = +m[2] / 100, l = +m[3] / 100;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
        return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
      }
    }
    if (c[0] === "#") {
      const h = c.length === 4 ? c.slice(1).split("").map(x => x + x).join("") : c.slice(1, 7);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = c.match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
  }

  /* A soft round light: white-hot core fading through the colour to nothing. */
  const colorKeys = new Map();
  function glowSprite(color, core = 0.18) {
    // Quantise so per-frame hue sweeps reuse a bounded set of sprites.
    let rgb = colorKeys.get(color);
    if (!rgb) {
      rgb = parseColor(color).map(v => Math.min(255, Math.round(v / 24) * 24));
      if (colorKeys.size < 4096) colorKeys.set(color, rgb);
    }
    core = Math.round(core * 20) / 20;
    const key = rgb.join(",") + "|" + core;
    let s = spriteCache.get(key);
    if (s) return s;
    const size = 128;
    s = document.createElement("canvas");
    s.width = s.height = size;
    const g = s.getContext("2d");
    const [r, gg, b] = rgb;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(255,255,255,${core > 0 ? 1 : 0})`);
    grad.addColorStop(Math.max(0.02, core), `rgba(${r},${gg},${b},0.95)`);
    grad.addColorStop(0.42, `rgba(${r},${gg},${b},0.32)`);
    grad.addColorStop(0.72, `rgba(${r},${gg},${b},0.08)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    spriteCache.set(key, s);
    return s;
  }

  /* Additive light at (x, y). Sets and restores composite mode itself. */
  function light(ctx, x, y, radius, color, alpha = 1, core = 0.18) {
    if (alpha <= 0.002 || radius <= 0.5) return;
    const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowSprite(color, core), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  }

  /* ---------------- particles ---------------- */
  class Particles {
    constructor(max = 700) { this.max = max; this.list = []; }
    burst(x, y, o = {}) {
      const n = o.count ?? 18, sp = o.speed ?? 220, life = o.life ?? 0.7;
      const base = o.angle ?? 0, spread = o.spread ?? TAU;
      for (let i = 0; i < n; i++) {
        const a = base + (Math.random() - 0.5) * spread;
        const v = sp * (0.25 + Math.random() * 0.9);
        this.list.push({
          x, y, vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v + (o.vy || 0),
          life: life * (0.55 + Math.random() * 0.6), max: life, size: (o.size ?? 3) * (0.6 + Math.random() * 0.8),
          color: Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color || "#ffd27a"),
          drag: o.drag ?? 2.4, grav: o.gravity ?? 0, streak: o.streak ?? true, glow: o.glow ?? 4.5,
        });
      }
      if (this.list.length > this.max) this.list.splice(0, this.list.length - this.max);
    }
    emit(x, y, o = {}) { this.burst(x, y, Object.assign({ count: 1 }, o)); }
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.life -= dt;
        if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy = p.vy * k + p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    draw(ctx) {
      const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.list) {
        const f = Math.max(0, Math.min(1, p.life / p.max));
        const r = p.size * p.glow * (0.4 + f * 0.6);
        ctx.globalAlpha = f * 0.9;
        ctx.drawImage(glowSprite(p.color), p.x - r, p.y - r, r * 2, r * 2);
        if (p.streak) {
          const len = 0.035;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size * 0.6 * f);
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * len, p.y - p.vy * len);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = prevOp;
      ctx.globalAlpha = prevA;
    }
    get count() { return this.list.length; }
    clear() { this.list.length = 0; }
  }

  /* ---------------- shockwave rings ---------------- */
  class Rings {
    constructor() { this.list = []; }
    add(x, y, o = {}) {
      this.list.push({ x, y, r: o.r0 ?? 6, r1: o.radius ?? 90, life: o.life ?? 0.45, max: o.life ?? 0.45,
        color: o.color || "#ffe6a8", width: o.width ?? 4, squash: o.squash ?? 1 });
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const s = this.list[i];
        s.life -= dt;
        if (s.life <= 0) { this.list.splice(i, 1); continue; }
      }
    }
    draw(ctx) {
      if (!this.list.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const s of this.list) {
        const f = 1 - s.life / s.max, ease = 1 - Math.pow(1 - f, 3);
        const r = s.r + (s.r1 - s.r) * ease;
        ctx.globalAlpha = (1 - f) * 0.9;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * (1 - f * 0.7);
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r, r * s.squash, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = (1 - f) * 0.35;
        ctx.lineWidth = s.width * 3 * (1 - f);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------- glowing lettering ---------------- */
  function glowText(ctx, text, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font || "700 24px Georgia, serif";
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.baseline || "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = (o.spacing ?? 0) + "px";
    ctx.globalAlpha = o.alpha ?? 1;
    let fill = o.fill || "#fff4d6";
    if (Array.isArray(fill)) {
      const h = o.size || 24;
      const g = ctx.createLinearGradient(0, y - h * 0.6, 0, y + h * 0.6);
      fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c));
      fill = g;
    }
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.blur ?? 18;
      ctx.fillStyle = o.glow;
      ctx.fillText(text, x, y);
      if (o.blur2) { ctx.shadowBlur = o.blur2; ctx.fillText(text, x, y); }
      ctx.shadowBlur = 0;
    }
    if (o.stroke) {
      ctx.lineWidth = o.strokeWidth || 2;
      ctx.strokeStyle = o.stroke;
      ctx.lineJoin = "round";
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* Static lettering is drawn once to an offscreen canvas and reused. */
  const textCache = new Map();
  function cachedText(text, o = {}) {
    const key = text + "|" + JSON.stringify(o);
    let c = textCache.get(key);
    if (c) return c;
    const pad = (o.blur ?? 18) * 2 + 8, size = o.size || 24;
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = o.font || "700 24px Georgia, serif";
    if ("letterSpacing" in probe) probe.letterSpacing = (o.spacing ?? 0) + "px";
    const w = Math.ceil(probe.measureText(text).width) + pad * 2 + (o.spacing ?? 0) * 2;
    const h = Math.ceil(size * 1.5) + pad * 2;
    c = document.createElement("canvas");
    c.width = w; c.height = h;
    glowText(c.getContext("2d"), text, w / 2, h / 2, Object.assign({}, o, { align: "center", baseline: "middle" }));
    textCache.set(key, c);
    return c;
  }
  function drawCachedText(ctx, text, x, y, o = {}, alpha = 1) {
    const c = cachedText(text, o);
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * alpha;
    ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
    ctx.globalAlpha = pa;
  }

  /* ---------------- floating combat text ---------------- */
  class Floaters {
    constructor() { this.list = []; }
    add(x, y, text, color = "#ffe08a", size = 18, life = 0.9) {
      this.list.push({ x, y, text, color, size, life, max: life, vy: -size * 2.6 });
      if (this.list.length > 40) this.list.shift();
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const f = this.list[i];
        f.life -= dt; f.y += f.vy * dt; f.vy *= Math.exp(-2.5 * dt);
        if (f.life <= 0) this.list.splice(i, 1);
      }
    }
    draw(ctx, font = "800 {s}px 'Segoe UI', Arial, sans-serif") {
      for (const f of this.list) {
        const k = f.life / f.max, pop = 1 + Math.max(0, (k - 0.82)) * 2.2;
        glowText(ctx, f.text, f.x, f.y, {
          font: font.replace("{s}", Math.round(f.size * pop)), fill: "#ffffff", glow: f.color, blur: 12,
          alpha: Math.min(1, k * 1.6), stroke: "rgba(0,0,0,0.55)", strokeWidth: 3,
        });
      }
    }
  }

  /* ---------------- camera shake + hit flash ---------------- */
  class Impact {
    constructor() { this.trauma = 0; this.flash = 0; this.flashColor = "#ffffff"; this.stop = 0; }
    hit(trauma = 0.3, flash = 0, color = "#ffffff", stop = 0) {
      this.trauma = Math.min(1, this.trauma + trauma);
      if (flash > this.flash) { this.flash = flash; this.flashColor = color; }
      this.stop = Math.max(this.stop, stop);
    }
    update(dt) {
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      this.flash = Math.max(0, this.flash - dt * 3.2);
    }
    offset(max = 18) {
      const t = this.trauma * this.trauma;
      return { x: (Math.random() * 2 - 1) * max * t, y: (Math.random() * 2 - 1) * max * t };
    }
    /* Consumes hit-stop time; returns true while the world should freeze. */
    frozen(dt) { if (this.stop > 0) { this.stop -= dt; return true; } return false; }
    drawFlash(ctx, w, h) {
      if (this.flash <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = this.flash * 0.55;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /* ---------------- vignette + bloom ---------------- */
  const vigCache = new Map();
  function vignette(ctx, w, h, strength = 0.65, color = "0,0,0") {
    const key = w + "x" + h + "|" + strength + "|" + color;
    let v = vigCache.get(key);
    if (!v) {
      v = document.createElement("canvas");
      v.width = Math.max(1, Math.round(w)); v.height = Math.max(1, Math.round(h));
      const g = v.getContext("2d");
      const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.hypot(w, h) * 0.56);
      grad.addColorStop(0, `rgba(${color},0)`);
      grad.addColorStop(1, `rgba(${color},${strength})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      vigCache.set(key, v);
      if (vigCache.size > 8) vigCache.delete(vigCache.keys().next().value);
    }
    ctx.drawImage(v, 0, 0, w, h);
  }

  let bloomCanvas = null;
  /* Cheap bloom: downsample the frame, add it back blurred by the upscale. */
  function bloom(ctx, source, w, h, amount = 0.45, scale = 0.125) {
    const bw = Math.max(8, Math.round(w * scale)), bh = Math.max(8, Math.round(h * scale));
    if (!bloomCanvas) bloomCanvas = document.createElement("canvas");
    if (bloomCanvas.width !== bw || bloomCanvas.height !== bh) { bloomCanvas.width = bw; bloomCanvas.height = bh; }
    const b = bloomCanvas.getContext("2d");
    b.globalCompositeOperation = "copy";
    b.imageSmoothingEnabled = true;
    b.drawImage(source, 0, 0, bw, bh);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = amount;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bloomCanvas, 0, 0, source.width, source.height);
    ctx.restore();
  }

  /* ---------------- hero art ---------------- */
  function loadImage(src, fallback) {
    const img = new Image();
    const rec = { img, ready: false, failed: false };
    img.onload = () => { rec.ready = true; };
    img.onerror = () => { if (fallback && img.src.indexOf(fallback) < 0) img.src = fallback; else rec.failed = true; };
    img.decoding = "async";
    img.src = src;
    return rec;
  }
  /* Cover-fit a still with a fixed focal point. No pan, no zoom: the life on
     top of it comes from lights and particles, never from moving the still. */
  function cover(ctx, img, w, h, fx = 0.5, fy = 0.5) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (w - dw) * fx, dy = (h - dh) * fy;
    ctx.drawImage(img, dx, dy, dw, dh);
    return { dx, dy, s, map: (u, v) => ({ x: dx + u * dw, y: dy + v * dh }) };
  }

  /* Drifting embers / motes that live in front of the hero art. */
  class Motes {
    constructor(n, w, h, colors) {
      this.w = w; this.h = h; this.colors = colors || ["#ffd98a", "#7fe9ff", "#ff7ad9"];
      this.list = Array.from({ length: n }, (_, i) => this.make(i, true));
    }
    make(i, scatter) {
      return { x: Math.random() * this.w, y: scatter ? Math.random() * this.h : this.h + 10,
        vx: (Math.random() - 0.5) * 14, vy: -(8 + Math.random() * 30), r: 1 + Math.random() * 2.6,
        ph: Math.random() * TAU, c: this.colors[i % this.colors.length], z: 0.4 + Math.random() * 0.6 };
    }
    resize(w, h) { this.w = w; this.h = h; }
    update(dt) {
      this.list.forEach((m, i) => {
        m.ph += dt * (1.2 + m.z);
        m.x += (m.vx + Math.sin(m.ph) * 8) * dt; m.y += m.vy * m.z * dt;
        if (m.y < -12 || m.x < -12 || m.x > this.w + 12) this.list[i] = this.make(i, false);
      });
    }
    draw(ctx) {
      for (const m of this.list) {
        const tw = 0.55 + 0.45 * Math.sin(m.ph * 2.3);
        light(ctx, m.x, m.y, m.r * 5 * m.z, m.c, 0.5 * tw * m.z, 0.3);
      }
    }
  }

  /* God-rays from a light source. The wedges are painted once into a cached
     sprite; each frame draws it twice (slow counter-rotation, breathing alpha):
     two image draws instead of a dozen full-screen gradient fills. */
  const rayCache = new Map();
  function raySprite(color, count) {
    const key = color + "|" + count;
    let c = rayCache.get(key);
    if (c) return c;
    const S = 512, R = S / 2;
    c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const [r, gg, b] = parseColor(color);
    g.translate(R, R);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.sin(i * 2.3) * 0.12;
      const w = 0.035 + 0.03 * ((i * 7) % 5) / 4;
      const grad = g.createLinearGradient(0, 0, Math.cos(a) * R, Math.sin(a) * R);
      grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
      grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a - w) * R, Math.sin(a - w) * R);
      g.lineTo(Math.cos(a + w) * R, Math.sin(a + w) * R);
      g.closePath();
      g.fill();
    }
    rayCache.set(key, c);
    return c;
  }
  function rays(ctx, x, y, len, t, color = "#ffe4a0", count = 9, alpha = 0.16) {
    const spr = raySprite(color, count);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(x, y);
    ctx.rotate(t * 0.05);
    ctx.globalAlpha = Math.min(1, alpha * 0.8 * (0.8 + 0.2 * Math.sin(t * 1.3)));
    ctx.drawImage(spr, -len, -len, len * 2, len * 2);
    ctx.rotate(-t * 0.11 + 0.4);
    ctx.globalAlpha = Math.min(1, alpha * 0.5 * (0.8 + 0.2 * Math.sin(t * 0.9 + 1)));
    ctx.drawImage(spr, -len * 0.8, -len * 0.8, len * 1.6, len * 1.6);
    ctx.restore();
  }

  /* The NorthStar eye / portal: iris rings, striations, a pupil that tracks. */
  function eye(ctx, x, y, r, t, o = {}) {
    const hue = o.hue ?? 190, open = o.open ?? 1, look = o.look || { x: 0, y: 0 };
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    light(ctx, 0, 0, r * 2.4, `hsl(${hue},100%,60%)`, 0.35 * open, 0.05);
    ctx.globalAlpha = 0.85 * open;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `hsla(${hue + k * 40},100%,${62 + k * 8}%,${0.55 - k * 0.12})`;
      ctx.lineWidth = Math.max(1, r * (0.05 - k * 0.012));
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1 - k * 0.18), r * (1 - k * 0.18) * (0.45 + 0.55 * open), 0, 0, TAU);
      ctx.stroke();
    }
    const n = 36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.12;
      const r0 = r * 0.28, r1 = r * (0.62 + 0.08 * Math.sin(t * 2 + i));
      ctx.strokeStyle = `hsla(${hue + (i % 6) * 18},100%,70%,${0.22 * open})`;
      ctx.lineWidth = Math.max(1, r * 0.018);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * (0.45 + 0.55 * open));
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * (0.45 + 0.55 * open));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    const px = Math.max(-1, Math.min(1, look.x)) * r * 0.16, py = Math.max(-1, Math.min(1, look.y)) * r * 0.1;
    ctx.globalAlpha = 0.92 * open;
    ctx.fillStyle = "#03010a";
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.2, r * 0.2 * (0.4 + 0.6 * open), 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    light(ctx, px - r * 0.07, py - r * 0.07, r * 0.12, "#ffffff", 0.8 * open, 0.4);
    ctx.restore();
  }

  /* Prompt that breathes; no box behind it. */
  function prompt(ctx, text, x, y, t, o = {}) {
    glowText(ctx, text, x, y, Object.assign({
      font: "700 16px 'Segoe UI', Arial, sans-serif", fill: "#ffffff", glow: "#7fe9ff", blur: 14,
      spacing: 4, alpha: 0.55 + 0.45 * Math.sin(t * 3.2),
    }, o));
  }

  /* Frame-time probe for checks: window.__nspFxStats() */
  const ft = { last: 0, d: [] };
  function probe(now) {
    if (ft.last) { ft.d.push(now - ft.last); if (ft.d.length > 600) ft.d.shift(); }
    ft.last = now;
  }
  global.__nspFxStats = () => {
    const d = ft.d.slice().sort((a, b) => a - b);
    if (!d.length) return null;
    return { n: d.length, median: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)] };
  };

  global.NSPFX = { TAU, glowSprite, light, Particles, Rings, glowText, cachedText, drawCachedText, Floaters,
    Impact, vignette, bloom, loadImage, cover, Motes, rays, eye, prompt, probe, parseColor, version: "1.0.0" };
})(window);
