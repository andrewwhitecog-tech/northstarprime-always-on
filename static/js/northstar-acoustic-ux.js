/*!
 * NorthStar Prime Acoustic & Spatial UX Engine (v1.0)
 * Procedural WebAudio micro-SFX (Rauno / Josh Comeau / Lusion craft),
 * Linear-style 1px specular cursor spotlight, magnetic spring CTAs,
 * Cmd+K global command bar, and mobile sticky sprint bar.
 * Strictly zero external network calls and zero localStorage usage.
 */
(function () {
  "use strict";

  const state = {
    ctx: null,
    soundEnabled: true,
    streak: 0,
    streakTimer: null,
    lastHoverMs: 0,
    hoverVariant: 0,
    cmdOpen: false,
    cmdIndex: 0
  };

  function getCtx() {
    if (!state.soundEnabled) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!state.ctx) state.ctx = new AC();
      if (state.ctx.state === "suspended") state.ctx.resume();
      return state.ctx;
    } catch (_) {
      return null;
    }
  }

  // 1. Subtle Tactile Hover Tick (18ms filtered triangle + Lusion 3-step micro-variation)
  function playHoverTick(gainVal) {
    const nowMs = performance.now();
    if (nowMs - state.lastHoverMs < 55) return;
    state.lastHoverMs = nowMs;
    const ctx = getCtx();
    if (!ctx || ctx.state !== "running") return;
    try {
      const t = ctx.currentTime;
      const jitter = [0.97, 1.0, 1.035][state.hoverVariant++ % 3];
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2150 * jitter, t);
      osc.frequency.exponentialRampToValueAtTime(1580 * jitter, t + 0.018);
      flt.type = "highpass";
      flt.frequency.setValueAtTime(1350, t);
      g.gain.setValueAtTime(gainVal || 0.042, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.018);
      osc.connect(flt);
      flt.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.021);
    } catch (_) {}
  }

  // 2. Magnetic Mechanical Latch Click (Dual-layer snap + titanium body)
  function playMagneticClick(gainVal) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const base = gainVal || 0.12;
      const snap = ctx.createOscillator();
      const sg = ctx.createGain();
      snap.type = "square";
      snap.frequency.setValueAtTime(3200, t);
      snap.frequency.exponentialRampToValueAtTime(780, t + 0.012);
      sg.gain.setValueAtTime(base * 0.55, t);
      sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.013);
      snap.connect(sg);
      sg.connect(ctx.destination);
      snap.start(t);
      snap.stop(t + 0.015);

      const body = ctx.createOscillator();
      const bg = ctx.createGain();
      body.type = "sine";
      body.frequency.setValueAtTime(255, t);
      body.frequency.exponentialRampToValueAtTime(62, t + 0.044);
      bg.gain.setValueAtTime(base, t);
      bg.gain.exponentialRampToValueAtTime(0.0008, t + 0.046);
      body.connect(bg);
      bg.connect(ctx.destination);
      body.start(t);
      body.stop(t + 0.05);
    } catch (_) {}
  }

  // 3. Josh Comeau Ascending Pitch-Escalator Pop
  function playEscalatorPop(isOn, gainVal) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      clearTimeout(state.streakTimer);
      state.streakTimer = setTimeout(function () { state.streak = 0; }, 900);
      const mult = 1 + (state.streak % 8) * 0.085;
      state.streak += 1;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      if (isOn !== false) {
        osc.frequency.setValueAtTime(330 * mult, t);
        osc.frequency.exponentialRampToValueAtTime(720 * mult, t + 0.058);
      } else {
        osc.frequency.setValueAtTime(640 * mult, t);
        osc.frequency.exponentialRampToValueAtTime(250 * mult, t + 0.065);
      }
      g.gain.setValueAtTime(gainVal || 0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.068);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.072);
    } catch (_) {}
  }

  // 4. Bandpass Air Whoosh for Cmd+K Command Palette
  function playPaletteWhoosh(opening) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.11);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = "bandpass";
      flt.Q.setValueAtTime(2.4, t);
      flt.frequency.setValueAtTime(opening ? 360 : 1800, t);
      flt.frequency.exponentialRampToValueAtTime(opening ? 2600 : 420, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.022);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.108);
      src.connect(flt);
      flt.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.115);
    } catch (_) {}
  }

  // 5. Polyphonic 5-Voice Lydian Maj9 Crystalline Harmonic Chord
  function playHarmonicChord(gainVal) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const notes = [277.18, 415.30, 554.37, 622.25, 698.46, 1108.73];
      const master = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(4600, t);
      master.gain.setValueAtTime(gainVal || 0.15, t);
      master.gain.exponentialRampToValueAtTime(0.0008, t + 1.05);
      master.connect(lp);
      lp.connect(ctx.destination);

      notes.forEach(function (freq, idx) {
        const osc = ctx.createOscillator();
        const vg = ctx.createGain();
        const st = t + idx * 0.028;
        osc.type = idx === 5 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, st);
        vg.gain.setValueAtTime(0.0008, st);
        vg.gain.linearRampToValueAtTime(0.18 / notes.length, st + 0.02);
        vg.gain.exponentialRampToValueAtTime(0.0008, st + 0.92);
        osc.connect(vg);
        vg.connect(master);
        osc.start(st);
        osc.stop(st + 0.96);
      });
    } catch (_) {}
  }

  // 6. Crystalline Rotational Detent for 3D Spatial Assemblage
  function playShardDetent(coherence) {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const c = Math.max(0, Math.min(1, coherence || 0));
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520 + c * 660, t);
      osc.frequency.exponentialRampToValueAtTime(380 + c * 520, t + 0.028);
      g.gain.setValueAtTime(0.028 + c * 0.025, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.03);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.034);
    } catch (_) {}
  }

  // Attach Specular Radial Spotlight & Hover Ticks
  function wireSpecularAndMagnetic() {
    const cardSel = ".card, .offer, .tier, .unit-card, .transit-card, .proof-card, .ns-specular-card";
    document.querySelectorAll(cardSel).forEach(function (el) {
      el.classList.add("ns-spotlight-host");
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--ns-mx", (e.clientX - r.left).toFixed(1) + "px");
        el.style.setProperty("--ns-my", (e.clientY - r.top).toFixed(1) + "px");
      }, { passive: true });
      el.addEventListener("pointerenter", function () {
        playHoverTick(0.036);
      }, { passive: true });
    });

    const clickSel = "a.button, button.button, .btn-gold, .btn-ghost, .preset-btn, .ns-filter-pill, .ns-est-pill";
    document.querySelectorAll(clickSel).forEach(function (btn) {
      btn.addEventListener("pointerenter", function () {
        playHoverTick(0.044);
      }, { passive: true });
      btn.addEventListener("click", function () {
        if (btn.classList.contains("ns-filter-pill") || btn.classList.contains("ns-est-pill") || btn.classList.contains("preset-btn")) {
          playEscalatorPop(true, 0.11);
        } else {
          playMagneticClick(0.11);
        }
      });
    });

    document.querySelectorAll("input[type='checkbox'], select").forEach(function (inp) {
      inp.addEventListener("change", function () {
        playEscalatorPop(inp.type === "checkbox" ? inp.checked : true, 0.1);
      });
    });

    // Subtle Lusion/Stripe Magnetic Pull on Desktop Fine Pointers
    if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) {
      document.querySelectorAll("a.button.primary, .btn-gold, .btn-enter").forEach(function (el) {
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
        function step() {
          cx += (tx - cx) * 0.18;
          cy += (ty - cy) * 0.18;
          el.style.transform = Math.abs(cx) < 0.08 && Math.abs(cy) < 0.08 && tx === 0 && ty === 0
            ? ""
            : "translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0)";
          if (Math.abs(tx - cx) > 0.08 || Math.abs(ty - cy) > 0.08) {
            raf = requestAnimationFrame(step);
          } else {
            raf = 0;
          }
        }
        el.addEventListener("mousemove", function (e) {
          const r = el.getBoundingClientRect();
          tx = Math.max(-7, Math.min(7, (e.clientX - (r.left + r.width / 2)) * 0.18));
          ty = Math.max(-5, Math.min(5, (e.clientY - (r.top + r.height / 2)) * 0.18));
          if (!raf) raf = requestAnimationFrame(step);
        });
        el.addEventListener("mouseleave", function () {
          tx = 0; ty = 0;
          if (!raf) raf = requestAnimationFrame(step);
        });
      });
    }
  }

  // Build Floating SFX + Cmd+K Dock and Command Palette
  function buildDockAndPalette() {
    const commands = [
      { label: "Prism Forge — 3D Spatial Assemblage Studio", meta: "3D WebGL", href: "/shattered-mirror/" },
      { label: "Vorath Warband — Seventh Veil Procession & Roster", meta: "Skirmish", href: "/warband/" },
      { label: "Interactive VORATH 3-Card Tarot Oracle", meta: "Interactive", href: "/oracle/" },
      { label: "$350 Small Website Repair Sprint (48-Hr Scope)", meta: "Hire · $350", href: "/hire/website-repair/" },
      { label: "$500 Turnkey Local Business Website Builder", meta: "Hire · $500", href: "/hire/local-business-website/" },
      { label: "NorthStar Digital — All Sprints & Assessments", meta: "Services", href: "/hire/" },
      { label: "Chromatic Store — Direct Stripe Instant Checkout", meta: "Shop", href: "https://app.northstarprime.net/chromatic" },
      { label: "Vorath's Vault — Digital Store & Printables Hub", meta: "Store", href: "/store/" },
      { label: "NorthStar Software & WebGL Studio Hub", meta: "Software", href: "/software/" },
      { label: "NorthStar Prime Front Door", meta: "Home", href: "/" }
    ];

    if (location.pathname.indexOf("/warband") === 0) {
      commands.unshift(
        { label: "Jump to Seventh Veil Skirmish Roster Builder", meta: "Warband", href: "#roster-builder" },
        { label: "Download Seventh Veil Rulebook Expansion (PDF)", meta: "6-Page PDF", href: "/warband/REFRACTION_Seventh_Veil_Anodized_Host_Expansion.pdf" }
      );
    }

    const dock = document.createElement("div");
    dock.className = "ns-ux-dock";
    dock.setAttribute("role", "region");
    dock.setAttribute("aria-label", "Audio and Quick Navigation Controls");

    const sfxBtn = document.createElement("button");
    sfxBtn.type = "button";
    sfxBtn.className = "ns-ux-btn";
    sfxBtn.setAttribute("aria-pressed", "true");
    sfxBtn.setAttribute("aria-label", "Toggle tactile UI sound effects");
    sfxBtn.innerHTML = '<span class="ns-eq-bars" aria-hidden="true"><span></span><span></span><span></span></span><span class="ns-sfx-label">SFX</span>';

    const cmdBtn = document.createElement("button");
    cmdBtn.type = "button";
    cmdBtn.className = "ns-ux-btn";
    cmdBtn.setAttribute("aria-label", "Open Quick Command Bar (Control+K)");
    cmdBtn.innerHTML = '<span>Jump</span><span class="ns-ux-kbd" aria-hidden="true">Ctrl+K</span>';

    dock.appendChild(sfxBtn);
    dock.appendChild(cmdBtn);
    document.body.appendChild(dock);

    const backdrop = document.createElement("div");
    backdrop.className = "ns-cmd-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<div class="ns-cmd-dialog" role="dialog" aria-modal="true" aria-label="NorthStar Quick Command Palette">' +
        '<div class="ns-cmd-head">' +
          '<span aria-hidden="true" style="color:#f0cf73;font-weight:800">✦</span>' +
          '<input type="search" class="ns-cmd-input" placeholder="Jump to any studio, $350/$500 sprint, warband host, or store..." autocomplete="off" spellcheck="false">' +
          '<button type="button" class="ns-cmd-close" aria-label="Close command palette">ESC</button>' +
        '</div>' +
        '<ul class="ns-cmd-list" role="listbox"></ul>' +
      '</div>';
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector(".ns-cmd-input");
    const list = backdrop.querySelector(".ns-cmd-list");
    const closeBtn = backdrop.querySelector(".ns-cmd-close");

    function renderCmdList() {
      const q = (input.value || "").trim().toLowerCase();
      const filtered = commands.filter(function (c) {
        return !q || c.label.toLowerCase().indexOf(q) !== -1 || c.meta.toLowerCase().indexOf(q) !== -1;
      });
      if (state.cmdIndex >= filtered.length) state.cmdIndex = 0;
      list.innerHTML = "";
      filtered.forEach(function (c, idx) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "ns-cmd-item";
        a.href = c.href;
        a.setAttribute("data-active", idx === state.cmdIndex ? "true" : "false");
        a.innerHTML = "<span>" + c.label + "</span><span class=\"ns-cmd-meta\">" + c.meta + "</span>";
        a.addEventListener("pointerenter", function () {
          state.cmdIndex = idx;
          Array.from(list.querySelectorAll(".ns-cmd-item")).forEach(function (el, j) {
            el.setAttribute("data-active", j === idx ? "true" : "false");
          });
          playHoverTick(0.032);
        });
        a.addEventListener("click", function () {
          playMagneticClick(0.12);
          closePalette();
        });
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    function openPalette() {
      state.cmdOpen = true;
      backdrop.hidden = false;
      input.value = "";
      state.cmdIndex = 0;
      renderCmdList();
      playPaletteWhoosh(true);
      setTimeout(function () { input.focus(); }, 20);
    }

    function closePalette() {
      if (!state.cmdOpen) return;
      state.cmdOpen = false;
      backdrop.hidden = true;
      playPaletteWhoosh(false);
    }

    sfxBtn.addEventListener("click", function () {
      if (state.soundEnabled) {
        playEscalatorPop(false, 0.09);
        state.soundEnabled = false;
        sfxBtn.setAttribute("aria-pressed", "false");
        sfxBtn.querySelector(".ns-sfx-label").textContent = "Muted";
      } else {
        state.soundEnabled = true;
        sfxBtn.setAttribute("aria-pressed", "true");
        sfxBtn.querySelector(".ns-sfx-label").textContent = "SFX";
        playEscalatorPop(true, 0.11);
      }
    });

    cmdBtn.addEventListener("click", function () {
      if (state.cmdOpen) closePalette(); else openPalette();
    });
    closeBtn.addEventListener("click", closePalette);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closePalette();
    });
    input.addEventListener("input", function () {
      state.cmdIndex = 0;
      renderCmdList();
      playHoverTick(0.025);
    });

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (state.cmdOpen) closePalette(); else openPalette();
        return;
      }
      if (!state.cmdOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const items = list.querySelectorAll(".ns-cmd-item");
        if (items.length) {
          state.cmdIndex = (state.cmdIndex + 1) % items.length;
          items.forEach(function (el, j) { el.setAttribute("data-active", j === state.cmdIndex ? "true" : "false"); });
          playHoverTick(0.03);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const items = list.querySelectorAll(".ns-cmd-item");
        if (items.length) {
          state.cmdIndex = (state.cmdIndex - 1 + items.length) % items.length;
          items.forEach(function (el, j) { el.setAttribute("data-active", j === state.cmdIndex ? "true" : "false"); });
          playHoverTick(0.03);
        }
      } else if (e.key === "Enter") {
        const active = list.querySelector('.ns-cmd-item[data-active="true"]');
        if (active) {
          e.preventDefault();
          playMagneticClick(0.12);
          active.click();
        }
      }
    });
  }

  // Sticky Bottom Conversion Bar on Sprint Detail Pages
  function wireStickySprintBar() {
    const path = location.pathname;
    let cfg = null;
    if (path.indexOf("/hire/website-repair") === 0) {
      cfg = {
        title: "$350 Website Repair Sprint",
        sub: "$175 Deposit · Target 48–72 Hr Turnaround",
        cta: "Prepare Scope →",
        href: "#enquire"
      };
    } else if (path.indexOf("/hire/local-business-website") === 0) {
      cfg = {
        title: "$500 Turnkey Local Business Site",
        sub: "$250 Deposit · $0/mo Hosting Handoff",
        cta: "Build $500 Scope →",
        href: "#scope-builder"
      };
    }
    if (!cfg) return;

    const bar = document.createElement("aside");
    bar.className = "ns-sticky-sprint-bar";
    bar.setAttribute("aria-label", "Quick Sprint Action");
    bar.innerHTML =
      '<div class="ns-sticky-sprint-copy"><strong>' + cfg.title + '</strong><span>' + cfg.sub + '</span></div>' +
      '<a class="ns-sticky-sprint-cta" href="' + cfg.href + '">' + cfg.cta + '</a>';
    document.body.appendChild(bar);
    document.body.classList.add("ns-has-sticky-bar");

    bar.querySelector("a").addEventListener("click", function () {
      playHarmonicChord(0.12);
    });

    function onScroll() {
      const show = window.scrollY > 360;
      bar.classList.toggle("is-visible", show);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Interactive Sprint Scope & Deposit Calculator on /hire/
  function wireHireEstimator() {
    const estRoot = document.getElementById("ns-sprint-estimator");
    if (!estRoot) return;
    const tiers = [
      { id: "repair", name: "Website Repair Sprint", price: 350, deposit: 175, window: "Target 48–72 Hours", desc: "Fix up to 3 priority mobile, nav, JS, or enquiry bugs across 2 existing pages with full rollback backup.", href: "/hire/website-repair/", cta: "Open $350 Repair Sprint →" },
      { id: "turnkey", name: "Turnkey Local Business Site", price: 500, deposit: 250, window: "Target 5–7 Business Days", desc: "Complete mobile-first custom website (up to 3 core pages) + interactive estimator/inquiry tool + $0/mo static hosting handoff.", href: "/hire/local-business-website/", cta: "Configure $500 Website →" },
      { id: "docker", name: "Docker & MicroVM Stabilization", price: 500, deposit: 250, window: "Target 48–72 Hours", desc: "Eliminate container restart loops, WSL2 socket wedging, and boot deadlocks with an automated watchdog supervisor.", href: "/hire/docker-repair/", cta: "Open $500 Docker Sprint →" },
      { id: "watchdog", name: "Autonomous Watchdog Engineering", price: 750, deposit: 375, window: "Target 3–5 Business Days", desc: "Zero-dependency L4/L7 health-probe supervisor daemon, clean process-tree recovery, and instant webhook alerting.", href: "/hire/watchdog-engineering/", cta: "Open $750 Watchdog Scope →" }
    ];

    const pillsWrap = estRoot.querySelector(".ns-est-pills");
    const titleEl = estRoot.querySelector("[data-est-title]");
    const priceEl = estRoot.querySelector("[data-est-price]");
    const metaEl = estRoot.querySelector("[data-est-meta]");
    const descEl = estRoot.querySelector("[data-est-desc]");
    const ctaEl = estRoot.querySelector("[data-est-cta]");

    function selectTier(idx, withSound) {
      const t = tiers[idx];
      Array.from(pillsWrap.querySelectorAll(".ns-est-pill")).forEach(function (b, j) {
        b.setAttribute("aria-pressed", j === idx ? "true" : "false");
      });
      titleEl.textContent = t.name;
      priceEl.textContent = "$" + t.price + " USD";
      metaEl.textContent = "$" + t.deposit + " deposit after written scope · " + t.window;
      descEl.textContent = t.desc;
      ctaEl.href = t.href;
      ctaEl.textContent = t.cta;
      if (withSound) playEscalatorPop(true, 0.12);
    }

    tiers.forEach(function (t, idx) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ns-est-pill";
      b.setAttribute("aria-pressed", idx === 0 ? "true" : "false");
      b.innerHTML = "<strong>$" + t.price + " · " + t.name + "</strong><span>" + t.window + "</span>";
      b.addEventListener("click", function () { selectTier(idx, true); });
      pillsWrap.appendChild(b);
    });
    ctaEl.addEventListener("click", function () { playHarmonicChord(0.13); });
    selectTier(0, false);
  }

  // Horizontal Flashlight Category Filter Rail on /chromatic/
  function wireChromaticRail() {
    const rail = document.getElementById("ns-chromatic-rail");
    if (!rail) return;
    const buttons = Array.from(rail.querySelectorAll(".ns-filter-pill"));
    const groups = Array.from(document.querySelectorAll("[data-ns-cat]"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const cat = btn.getAttribute("data-filter");
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        groups.forEach(function (g) {
          g.hidden = cat !== "all" && g.getAttribute("data-ns-cat") !== cat;
        });
      });
    });
  }

  function init() {
    wireSpecularAndMagnetic();
    buildDockAndPalette();
    wireStickySprintBar();
    wireHireEstimator();
    wireChromaticRail();
  }

  window.NorthStarUX = {
    playHoverTick: playHoverTick,
    playMagneticClick: playMagneticClick,
    playEscalatorPop: playEscalatorPop,
    playPaletteWhoosh: playPaletteWhoosh,
    playHarmonicChord: playHarmonicChord,
    playShardDetent: playShardDetent,
    isSoundEnabled: function () { return state.soundEnabled; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
