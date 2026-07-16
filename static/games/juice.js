/* NSP Juice Kit — shared game-feel layer for arcade cabinets.
   Drop-in: <script src="/static/games/juice.js"></script> then Juice.attachFX(canvasEl).
   Zero dependencies, zero per-frame JS cost for the sheen (pure CSS overlay). */
(function () {
  const Juice = {};

  /* Post-processing sheen: vignette + scanlines + soft top glow over any canvas.
     Purely cosmetic overlay; pointer-events pass through. */
  Juice.attachFX = function (canvas, opts) {
    if (!canvas || canvas.__juiceFX) return;
    const o = Object.assign({ vignette: 0.55, scanlines: 0.06, glow: 0.10 }, opts || {});
    const host = canvas.parentElement || document.body;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const fx = document.createElement("div");
    fx.className = "juice-fx";
    fx.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:5;border-radius:inherit;" +
      "background:" +
      "radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(0,0,0," + o.vignette + ") 130%)," +
      "repeating-linear-gradient(0deg, rgba(0,0,0," + o.scanlines + ") 0 1px, transparent 1px 3px)," +
      "linear-gradient(180deg, rgba(255,255,255," + o.glow + "), transparent 12%);" +
      "mix-blend-mode:normal;";
    // align overlay to the canvas box inside its host
    const align = () => {
      const c = canvas.getBoundingClientRect(), h = host.getBoundingClientRect();
      fx.style.left = (c.left - h.left) + "px";
      fx.style.top = (c.top - h.top) + "px";
      fx.style.width = c.width + "px";
      fx.style.height = c.height + "px";
      fx.style.inset = "auto";
    };
    host.appendChild(fx);
    align();
    window.addEventListener("resize", align);
    canvas.__juiceFX = fx;
    return fx;
  };

  /* Floating score/text pop above a point (viewport coords or an element). */
  Juice.pop = function (text, x, y, color) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:" + x + "px;top:" + y + "px;transform:translate(-50%,-50%);" +
      "font:800 18px 'Segoe UI',system-ui,sans-serif;color:" + (color || "#ffe45c") + ";" +
      "text-shadow:0 2px 8px rgba(0,0,0,.7);pointer-events:none;z-index:9999;" +
      "transition:transform .8s cubic-bezier(.17,.67,.35,1), opacity .8s;opacity:1;";
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "translate(-50%,-140%) scale(1.25)";
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 850);
  };

  /* CSS shake for any element (HUD panels, DOM games). */
  Juice.shake = function (el, intensity, ms) {
    if (!el) return;
    const i = intensity || 6, dur = ms || 220, t0 = performance.now();
    const prev = el.style.transform;
    (function tick(t) {
      const k = (t - t0) / dur;
      if (k >= 1) { el.style.transform = prev; return; }
      const damp = (1 - k) * i;
      el.style.transform = "translate(" + ((Math.random() - .5) * damp) + "px," + ((Math.random() - .5) * damp) + "px)";
      requestAnimationFrame(tick);
    })(t0);
  };

  /* Full-viewport flash (damage / big event). */
  Juice.flash = function (color, ms) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;inset:0;background:" + (color || "rgba(255,255,255,.22)") +
      ";pointer-events:none;z-index:9998;transition:opacity " + (ms || 260) + "ms;opacity:1;";
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "0"; });
    setTimeout(() => el.remove(), (ms || 260) + 40);
  };

  window.Juice = Juice;
})();
