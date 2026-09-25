/* glfx.js — shared WebGL post-processing for the NSP arcade.
 * Drop-in like juice.js: GLFX.attach(gameCanvas, opts) overlays a WebGL canvas that samples the
 * game's 2D canvas each frame and applies bloom + scanlines/CRT + chromatic aberration + vignette + grade.
 * One module lifts every game a full graphics tier. WebGL1, broad support, graceful no-op if unsupported.
 *
 *   const fx = GLFX.attach(document.getElementById('game'), { bloom:0.85, scanlines:0.12, aberration:0.0025, vignette:0.45 });
 *   // your game keeps drawing to #game as usual; fx renders the enhanced frame over it.
 *   fx.set({ bloom: 1.2 });            // tweak live
 *   fx.detach();                       // remove
 */
(function (global) {
  "use strict";

  const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv=(p+1.0)*0.5; gl_Position=vec4(p,0.0,1.0); }`;

  // bright-pass: keep only luminance above threshold
  const BRIGHT = `precision highp float; varying vec2 uv; uniform sampler2D tex; uniform float thr;
    void main(){ vec3 c=texture2D(tex,uv).rgb; float l=dot(c,vec3(0.299,0.587,0.114));
      float k=smoothstep(thr,thr+0.25,l); gl_FragColor=vec4(c*k,1.0); }`;

  // separable gaussian blur
  const BLUR = `precision highp float; varying vec2 uv; uniform sampler2D tex; uniform vec2 dir; uniform vec2 res;
    void main(){ vec2 t=dir/res; vec3 s=texture2D(tex,uv).rgb*0.227027;
      s+=texture2D(tex,uv+t*1.3846).rgb*0.316216; s+=texture2D(tex,uv-t*1.3846).rgb*0.316216;
      s+=texture2D(tex,uv+t*3.2308).rgb*0.070270; s+=texture2D(tex,uv-t*3.2308).rgb*0.070270;
      gl_FragColor=vec4(s,1.0); }`;

  // final composite: base + bloom, chromatic aberration, scanlines/CRT, vignette, color grade
  const COMP = `precision highp float; varying vec2 uv; uniform sampler2D tex; uniform sampler2D bloomTex;
    uniform vec2 res; uniform float bloom, scan, aberr, vig, grade, time;
    void main(){
      vec2 d = (uv-0.5);
      // chromatic aberration (stronger toward edges)
      float a = aberr * (0.3 + dot(d,d));
      vec3 base;
      base.r = texture2D(tex, uv + d*a).r;
      base.g = texture2D(tex, uv).g;
      base.b = texture2D(tex, uv - d*a).b;
      vec3 bl = texture2D(bloomTex, uv).rgb;
      vec3 col = base + bl*bloom;
      // subtle warm/cool grade toward the VORATH neon palette
      col = mix(col, col*vec3(1.06,1.0,1.12), grade);
      // scanlines + faint rolling
      float s = sin((uv.y*res.y*3.14159) + time*2.0)*0.5+0.5;
      col *= 1.0 - scan*(1.0 - s);
      // vignette
      float v = smoothstep(0.85, 0.3, length(d)*1.15);
      col *= mix(1.0, v, vig);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function GLFXInstance(src, opts) {
    opts = opts || {};
    const o = {
      bloom: opts.bloom != null ? opts.bloom : 0.8,
      threshold: opts.threshold != null ? opts.threshold : 0.62,
      scanlines: opts.scanlines != null ? opts.scanlines : 0.10,
      aberration: opts.aberration != null ? opts.aberration : 0.0022,
      vignette: opts.vignette != null ? opts.vignette : 0.42,
      grade: opts.grade != null ? opts.grade : 0.5,
      scale: opts.scale != null ? opts.scale : 1.0
    };
    const cv = document.createElement("canvas");
    cv.className = "glfx-layer";
    // overlay exactly on the source canvas. cv and src are siblings → same offsetParent → their
    // offset coordinates share an origin, so copying src.offset* aligns the overlay perfectly even
    // when the source canvas is letterboxed/centered inside a larger parent (common in these games).
    const cs = getComputedStyle(src);
    Object.assign(cv.style, { position: "absolute", margin: "0", pointerEvents: "none",
      zIndex: (parseInt(cs.zIndex) || 1) + 1 });
    (src.parentNode || document.body).insertBefore(cv, src.nextSibling);
    function place() {
      cv.style.left = src.offsetLeft + "px";
      cv.style.top = src.offsetTop + "px";
      cv.style.width = src.offsetWidth + "px";
      cv.style.height = src.offsetHeight + "px";
    }
    // Keep the source visible beneath the effect layer. A successful composite is opaque and covers it;
    // a transparent/cleared WebGL backbuffer exposes the original frame instead of a black game screen.
    // This also makes context loss and driver-specific compositor failures safely fail open.
    place();

    const gl = cv.getContext("webgl", { premultipliedAlpha: false, antialias: false })
            || cv.getContext("experimental-webgl");
    if (!gl) { // no WebGL → remove the unused overlay, no-op
      cv.remove();
      return { set(){}, detach(){}, ok: false };
    }

    function sh(type, s) { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); return x; }
    function prog(fs) { const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p); return p; }
    const pBright = prog(BRIGHT), pBlur = prog(BLUR), pComp = prog(COMP);

    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    function tex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
    function fbo(w, h) { const t = tex(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { f: f, t: t, w: w, h: h }; }

    const srcTex = tex();
    let W = 0, H = 0, bw = 0, bh = 0, A = null, B = null;
    function resize() {
      const r = src.getBoundingClientRect();
      W = Math.max(2, (src.width || r.width | 0)); H = Math.max(2, (src.height || r.height | 0));
      cv.width = W; cv.height = H;
      bw = Math.max(2, (W * 0.5) | 0); bh = Math.max(2, (H * 0.5) | 0);
      A = fbo(bw, bh); B = fbo(bw, bh);
      place(); // keep the overlay's display box synced to the (possibly resized) source canvas
    }
    resize();

    function bind(p) { gl.useProgram(p); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
    function draw() { gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

    let raf = 0, t0 = null;
    function frame(ts) {
      if (t0 == null) t0 = ts; const time = (ts - t0) / 1000;
      if (src.width !== W || src.height !== H) resize();
      // upload the game canvas as a texture
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
      catch (e) { raf = requestAnimationFrame(frame); return; }

      // bright pass -> A
      gl.viewport(0, 0, bw, bh); gl.bindFramebuffer(gl.FRAMEBUFFER, A.f);
      bind(pBright); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(pBright, "tex"), 0);
      gl.uniform1f(gl.getUniformLocation(pBright, "thr"), o.threshold); draw();

      // blur H (A->B) then V (B->A)
      bind(pBlur); gl.uniform2f(gl.getUniformLocation(pBlur, "res"), bw, bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.f); gl.bindTexture(gl.TEXTURE_2D, A.t);
      gl.uniform1i(gl.getUniformLocation(pBlur, "tex"), 0);
      gl.uniform2f(gl.getUniformLocation(pBlur, "dir"), 1, 0); draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.bindTexture(gl.TEXTURE_2D, B.t);
      gl.uniform2f(gl.getUniformLocation(pBlur, "dir"), 0, 1); draw();

      // composite -> screen
      gl.viewport(0, 0, W, H); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      bind(pComp);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(pComp, "tex"), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, A.t);
      gl.uniform1i(gl.getUniformLocation(pComp, "bloomTex"), 1);
      gl.uniform2f(gl.getUniformLocation(pComp, "res"), W, H);
      gl.uniform1f(gl.getUniformLocation(pComp, "bloom"), o.bloom);
      gl.uniform1f(gl.getUniformLocation(pComp, "scan"), o.scanlines);
      gl.uniform1f(gl.getUniformLocation(pComp, "aberr"), o.aberration);
      gl.uniform1f(gl.getUniformLocation(pComp, "vig"), o.vignette);
      gl.uniform1f(gl.getUniformLocation(pComp, "grade"), o.grade);
      gl.uniform1f(gl.getUniformLocation(pComp, "time"), time);
      gl.activeTexture(gl.TEXTURE0);
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return {
      ok: true,
      set(n) { Object.assign(o, n || {}); },
      detach() { cancelAnimationFrame(raf); window.removeEventListener("resize", resize);
        cv.remove(); }
    };
  }

  const GLFX = {
    attach(canvas, opts) {
      try { return GLFXInstance(canvas, opts); }
      catch (e) { console.warn("[glfx] disabled:", e); return { set(){}, detach(){}, ok: false }; }
    },
    // lightweight additive particle burst drawn onto the game's 2D canvas (glfx then blooms it)
    burst(ctx, x, y, opts) {
      opts = opts || {}; const n = opts.count || 18, life = opts.life || 500;
      const col = opts.color || "#49e0ff", spd = opts.speed || 3, t0 = performance.now();
      const ps = []; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = spd * (0.4 + Math.random());
        ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (opts.size || 3) * (0.5 + Math.random()) }); }
      (function step() { const e = performance.now() - t0; if (e > life) return;
        const k = 1 - e / life; ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.98;
          ctx.globalAlpha = k; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, 6.283); ctx.fill(); }
        ctx.restore(); requestAnimationFrame(step); })();
    }
  };
  global.GLFX = GLFX;
})(typeof window !== "undefined" ? window : this);
