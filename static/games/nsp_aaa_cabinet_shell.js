/* NorthStar Prime AAA 80s Arcade & Penny-Arcade Cabinet Shell
 * - Bespoke hand-painted marquee attract screen (zero plain monochrome title screens)
 * - Hand-painted NorthStar Prime Studios credits screen ([C] key)
 * - Curved CRT glass scanline overlay (toggleable)
 * - Real mastered SFX interceptor for legacy createOscillator() cabinets (VORATH DNA Strand 5)
 */
(function () {
  "use strict";
  if (window.__NSP_AAA_CABINET_INIT__) return;
  window.__NSP_AAA_CABINET_INIT__ = true;

  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var scripts = document.querySelectorAll("script[data-nsp-marquee]");
    scriptEl = scripts[scripts.length - 1];
  }
  var marqueeSrc = (scriptEl && scriptEl.getAttribute("data-nsp-marquee")) || "";
  var gameTitle = (scriptEl && scriptEl.getAttribute("data-nsp-title")) || document.title || "NorthStar Arcade";
  var creditsSrc = (scriptEl && scriptEl.getAttribute("data-nsp-credits")) || "/static/games/marquees_aaa/northstar-studios-credits.webp";
  var realSfxMode = (scriptEl && scriptEl.getAttribute("data-nsp-real-sfx")) === "true";

  // -------------------------------------------------------------------------
  // 1. Real Mastered SFX Bank (/static/games/sfx/*.mp3) + Oscillator Upgrade
  // -------------------------------------------------------------------------
  var SFX_MAP = {
    coin: "/static/games/sfx/bell.mp3",
    shoot: "/static/games/sfx/nova_shoot.mp3",
    hit: "/static/games/sfx/nova_hit.mp3",
    explode: "/static/games/sfx/nova_explode.mp3",
    collect: "/static/games/sfx/collect.mp3",
    boost: "/static/games/sfx/dharma_boost.mp3",
    chime: "/static/games/sfx/rose_chime.mp3",
    fail: "/static/games/sfx/dharma_fail.mp3",
    hurt: "/static/games/sfx/hurt.mp3",
  };
  var sfxPools = {};
  var lastPlayMs = {};

  function playRealSfx(kind, volume, rate) {
    try {
      var url = SFX_MAP[kind] || SFX_MAP.collect;
      var now = performance.now();
      if (lastPlayMs[kind] && now - lastPlayMs[kind] < 55) return;
      lastPlayMs[kind] = now;
      if (!sfxPools[kind]) sfxPools[kind] = [];
      var pool = sfxPools[kind];
      var audio = pool.find(function (a) { return a.paused || a.ended; });
      if (!audio && pool.length < 4) {
        audio = new Audio(url);
        audio.preload = "auto";
        pool.push(audio);
      }
      if (!audio) audio = pool[0];
      audio.volume = Math.max(0.05, Math.min(0.65, volume || 0.35));
      try { audio.playbackRate = Math.max(0.75, Math.min(1.45, rate || 1.0)); } catch (_) {}
      audio.currentTime = 0;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } catch (_) {}
  }

  // Upgrade legacy WebAudio oscillator beeps to real mastered MP3 foley
  if (realSfxMode) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC && AC.prototype && AC.prototype.createOscillator && !AC.prototype.__nspRealSfxPatched) {
      var origCreateOsc = AC.prototype.createOscillator;
      AC.prototype.__nspRealSfxPatched = true;
      AC.prototype.createOscillator = function () {
        var osc = origCreateOsc.call(this);
        var silent = this.createGain();
        silent.gain.value = 0.0001;
        var origConnect = osc.connect.bind(osc);
        var origStart = osc.start.bind(osc);
        osc.connect = function () {
          try { origConnect(silent); } catch (_) {}
          return arguments[0];
        };
        osc.start = function () {
          try {
            var f = (osc.frequency && typeof osc.frequency.value === "number") ? osc.frequency.value : 440;
            var t = osc.type || "sine";
            var kind = "collect";
            var rate = 1.0;
            if (f <= 150) {
              kind = (t === "sawtooth" || t === "square") ? "explode" : "hurt";
              rate = 0.92 + Math.random() * 0.16;
            } else if (f <= 340) {
              kind = (t === "sawtooth") ? "fail" : "hit";
              rate = 0.94 + Math.random() * 0.14;
            } else if (f <= 680) {
              kind = (t === "square" || t === "sawtooth") ? "shoot" : "collect";
              rate = 0.95 + Math.random() * 0.18;
            } else {
              kind = (t === "sine" || t === "triangle") ? "chime" : "boost";
              rate = 0.96 + Math.random() * 0.16;
            }
            playRealSfx(kind, 0.34, rate);
          } catch (_) {}
          try { return origStart.apply(osc, arguments); } catch (_) {}
        };
        return osc;
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. Mount Bespoke Hand-Painted Attract Screen, CRT Glass & Studio Credits
  // -------------------------------------------------------------------------
  function mountCabinetShell() {
    if (!document.body) return;

    // Subtle CRT bezel glass overlay
    var crt = document.createElement("div");
    crt.className = "nsp-aaa-crt-glass";
    crt.setAttribute("aria-hidden", "true");
    document.body.appendChild(crt);

    // Compact corner cabinet dock (Return to Arcade / CRT toggle / Title / Credits)
    var dock = document.createElement("div");
    dock.className = "nsp-aaa-dock";
    dock.innerHTML =
      '<a href="/arcade/" title="Back to NorthStar Arcade">Arcade</a>' +
      '<button type="button" data-act="title" title="Show Hand-Painted Cabinet Marquee">Marquee</button>' +
      '<button type="button" data-act="credits" title="NorthStar Prime Studios Credits (C)">Credits</button>' +
      '<button type="button" data-act="crt" title="Toggle CRT Glass Sheen">CRT</button>';
    document.body.appendChild(dock);

    // Studio Credits modal
    var credits = document.createElement("div");
    credits.className = "nsp-aaa-credits";
    credits.setAttribute("role", "dialog");
    credits.setAttribute("aria-label", "NorthStar Prime Studios Credits");
    credits.innerHTML =
      '<div class="nsp-aaa-credits-card">' +
      '<img src="' + creditsSrc + '" alt="NorthStar Prime Studios — Portland, Oregon">' +
      "</div>" +
      '<p class="nsp-aaa-credits-line">' +
      gameTitle + " · Crafted in Portland, Oregon by Andrew White &amp; the NorthStar Prime Machine Team · VORATH DNA" +
      "</p>" +
      '<div class="nsp-aaa-attract-controls">' +
      '<button type="button" class="nsp-aaa-coin-btn" data-act="close-credits">Return to Cabinet</button>' +
      "</div>";
    document.body.appendChild(credits);

    // Bespoke Hand-Painted Attract-Mode Title Screen
    var attract = null;
    if (marqueeSrc) {
      attract = document.createElement("div");
      attract.className = "nsp-aaa-attract";
      attract.setAttribute("role", "dialog");
      attract.setAttribute("aria-label", gameTitle + " Cabinet Title Screen");
      attract.innerHTML =
        '<div class="nsp-aaa-attract-art">' +
        '<img src="' + marqueeSrc + '" alt="' + gameTitle + ' hand-painted arcade cabinet marquee">' +
        "</div>" +
        '<div class="nsp-aaa-attract-controls">' +
        '<button type="button" class="nsp-aaa-coin-btn" data-act="start">Insert Coin · Play</button>' +
        '<button type="button" class="nsp-aaa-sub-btn" data-act="credits">Studio Credits [C]</button>' +
        '<a class="nsp-aaa-sub-btn" href="/arcade/">All Cabinets</a>' +
        "</div>";
      document.body.appendChild(attract);
    }

    function dismissAttract() {
      if (!attract || attract.classList.contains("nsp-hidden")) return;
      playRealSfx("coin", 0.45, 1.0);
      attract.classList.add("nsp-hidden");
      var canvas = document.querySelector("canvas");
      if (canvas && canvas.focus) {
        try { canvas.focus(); } catch (_) {}
      }
    }

    function openCredits() {
      credits.classList.add("nsp-open");
      playRealSfx("chime", 0.35, 1.0);
    }
    function closeCredits() {
      credits.classList.remove("nsp-open");
    }

    if (attract) {
      attract.addEventListener("click", function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
        if (btn && btn.getAttribute("data-act") === "credits") {
          ev.stopPropagation();
          openCredits();
          return;
        }
        if (ev.target && ev.target.closest && ev.target.closest("a")) return;
        dismissAttract();
      });
    }

    credits.addEventListener("click", function (ev) {
      if (ev.target === credits || (ev.target && ev.target.closest && ev.target.closest('[data-act="close-credits"]'))) {
        closeCredits();
      }
    });

    dock.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "title" && attract) {
        attract.classList.remove("nsp-hidden");
      } else if (act === "credits") {
        if (credits.classList.contains("nsp-open")) closeCredits();
        else openCredits();
      } else if (act === "crt") {
        crt.classList.toggle("nsp-crt-off");
      }
    });

    window.addEventListener("keydown", function (ev) {
      if (credits.classList.contains("nsp-open")) {
        if (ev.key === "Escape" || ev.key === "c" || ev.key === "C" || ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          closeCredits();
        }
        return;
      }
      if (attract && !attract.classList.contains("nsp-hidden")) {
        if (ev.key === "Enter" || ev.key === " " || ev.key === "Escape") {
          ev.preventDefault();
          dismissAttract();
        } else if (ev.key === "c" || ev.key === "C") {
          ev.preventDefault();
          openCredits();
        }
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCabinetShell);
  } else {
    mountCabinetShell();
  }
})();
