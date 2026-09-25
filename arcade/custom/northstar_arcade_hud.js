/**
 * NorthStar Arcade Unified HUD (Head-Up Display)
 * Standardized arcade cabinet control overlay for Interdimensional Games (IDG) / NorthStar Platform (NSP).
 * 
 * Features:
 * - Global Pause overlay (Escape / 'P') with Resume, Restart, Controls, & Scoreboard
 * - Fullscreen toggle ('F' or button)
 * - Master Audio Volume slider (WebAudio master gain & HTML5 audio hook, persisted to localStorage)
 * - CRT Scanline & Phosphor screen overlay toggle (persisted to localStorage)
 * - LocalStorage High-Score tracking & Leaderboard persistence
 * - Zero-dependency auto-injected retro-cyber UI
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NorthStarHUD = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Config & State
  const STORAGE_KEYS = {
    VOLUME: 'northstar_arcade_volume',
    MUTED: 'northstar_arcade_muted',
    CRT: 'northstar_arcade_crt',
    SCORES_PREFIX: 'northstar_hiscore_',
    ACHIEVEMENTS: 'northstar_arcade_achievements'
  };

  const state = {
    gameId: 'arcade_game',
    gameTitle: document.title || 'NorthStar Arcade Game',
    isPaused: false,
    isFullscreen: false,
    volume: parseFloat(localStorage.getItem(STORAGE_KEYS.VOLUME) !== null ? localStorage.getItem(STORAGE_KEYS.VOLUME) : '0.85'),
    isMuted: localStorage.getItem(STORAGE_KEYS.MUTED) === 'true',
    crtEnabled: localStorage.getItem(STORAGE_KEYS.CRT) !== 'false', // default ON for retro vibe
    highScore: 0,
    callbacks: {
      pause: [],
      resume: [],
      restart: [],
      volume: []
    },
    audioContexts: new Set(),
    audioElements: new Set(),
    masterGains: new Map()
  };

  // Determine gameId from pathname if not explicitly passed
  try {
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1] || 'arcade_game';
    state.gameId = fileName.replace(/\.html$/, '');
  } catch (e) {}

  // CSS Styles for HUD & CRT
  const HUD_CSS = `
  /* NorthStar Unified Arcade HUD Styles */
  :root {
    --nshud-cyan: #22d3ee;
    --nshud-magenta: #ec4899;
    --nshud-gold: #f5c542;
    --nshud-emerald: #10b981;
    --nshud-red: #ef4444;
    --nshud-dark: rgba(9, 12, 21, 0.92);
    --nshud-border: rgba(34, 211, 238, 0.35);
  }

  /* CRT Scanline & Phosphor Overlay */
  #northstar-crt-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 99990;
    display: block;
    transition: opacity 0.3s ease;
  }
  #northstar-crt-layer.crt-off {
    display: none !important;
  }
  #northstar-crt-layer .crt-scanlines {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      rgba(18, 16, 16, 0) 50%, 
      rgba(0, 0, 0, 0.28) 50%
    );
    background-size: 100% 4px;
    z-index: 1;
    pointer-events: none;
    opacity: 0.85;
  }
  #northstar-crt-layer .crt-vignette {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.7), inset 0 0 40px rgba(0, 0, 0, 0.9);
    pointer-events: none;
    z-index: 2;
  }
  #northstar-crt-layer .crt-phosphor-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(34, 211, 238, 0.025) 0%, transparent 80%);
    pointer-events: none;
    z-index: 3;
  }

  /* Top HUD Bar */
  #northstar-arcade-hud {
    position: fixed;
    top: 10px;
    right: 12px;
    z-index: 99995;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--nshud-dark);
    border: 1px solid var(--nshud-border);
    border-radius: 24px;
    padding: 4px 10px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.65), 0 0 15px rgba(34, 211, 238, 0.2);
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #e2e8f0;
    user-select: none;
    transition: all 0.25s ease;
  }
  #northstar-arcade-hud:hover {
    border-color: var(--nshud-cyan);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.8), 0 0 20px rgba(34, 211, 238, 0.35);
  }

  .nshud-brand {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--nshud-gold);
    padding-right: 6px;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
  }
  .nshud-brand span.nshud-star {
    color: var(--nshud-cyan);
    font-size: 13px;
  }

  .nshud-score-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.07);
    padding: 3px 8px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 11px;
    color: #f1f5f9;
  }
  .nshud-score-pill span.nshud-score-label {
    color: var(--nshud-gold);
    font-size: 9px;
    letter-spacing: 0.05em;
  }

  .nshud-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    border-radius: 16px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
    line-height: 1;
  }
  .nshud-btn:hover {
    background: rgba(34, 211, 238, 0.2);
    border-color: var(--nshud-cyan);
    color: #fff;
    transform: translateY(-1px);
  }
  .nshud-btn.active {
    background: rgba(16, 185, 129, 0.25);
    border-color: var(--nshud-emerald);
    color: #34d399;
  }

  /* Volume group */
  .nshud-volume-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .nshud-volume-wrap input[type="range"] {
    width: 54px;
    height: 4px;
    accent-color: var(--nshud-cyan);
    cursor: pointer;
  }

  /* Pause Modal Overlay */
  #northstar-pause-modal {
    position: fixed;
    inset: 0;
    z-index: 99998;
    background: rgba(5, 7, 15, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: none;
    justify-content: center;
    align-items: center;
    padding: 16px;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
  #northstar-pause-modal.active {
    display: flex;
  }
  .nshud-pause-card {
    background: linear-gradient(180deg, #0d1322 0%, #060913 100%);
    border: 2px solid var(--nshud-cyan);
    border-radius: 14px;
    max-width: 520px;
    width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    padding: 28px 24px;
    box-shadow: 0 0 50px rgba(34, 211, 238, 0.25), 0 20px 60px rgba(0, 0, 0, 0.8);
    color: #f8fafc;
    text-align: center;
    position: relative;
    animation: nshudPopIn 0.2s ease-out;
  }
  .nshud-pause-card::-webkit-scrollbar {
    width: 6px;
  }
  .nshud-pause-card::-webkit-scrollbar-thumb {
    background: rgba(34, 211, 238, 0.3);
    border-radius: 3px;
  }
  @keyframes nshudPopIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .nshud-pause-title {
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #fff;
    margin-bottom: 4px;
    text-transform: uppercase;
    text-shadow: 0 0 16px var(--nshud-cyan);
  }
  .nshud-pause-subtitle {
    color: #94a3b8;
    font-size: 13px;
    margin-bottom: 22px;
  }
  .nshud-pause-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 22px;
  }
  .nshud-stat-box {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
  }
  .nshud-stat-box small {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--nshud-gold);
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .nshud-stat-box strong {
    font-size: 18px;
    color: #fff;
    font-family: monospace;
  }
  .nshud-pause-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }
  .nshud-action-btn {
    padding: 12px 18px;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    transition: all 0.18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .nshud-btn-resume {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    box-shadow: 0 0 16px rgba(16, 185, 129, 0.35);
  }
  .nshud-btn-resume:hover {
    background: linear-gradient(135deg, #047857, #059669);
    transform: translateY(-2px);
    box-shadow: 0 0 24px rgba(16, 185, 129, 0.5);
  }
  .nshud-btn-restart {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }
  .nshud-btn-restart:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-2px);
  }
  .nshud-gamepad-badge {
    background: rgba(34, 211, 238, 0.12);
    border-color: var(--nshud-cyan);
    color: var(--nshud-cyan);
    font-size: 10px;
    font-weight: 700;
  }

  /* Leaderboard in Pause Modal */
  .nshud-leaderboard-card {
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(245, 197, 66, 0.25);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    text-align: left;
  }
  .nshud-lb-title {
    color: var(--nshud-gold);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .nshud-lb-title span.nshud-lb-sub {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 500;
  }
  .nshud-lb-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    font-family: monospace;
  }
  .nshud-lb-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    transition: background 0.15s ease;
  }
  .nshud-lb-row:last-child {
    border-bottom: none;
  }
  .nshud-lb-row td {
    padding: 4px 6px;
    color: #e2e8f0;
  }
  .nshud-lb-rank {
    font-weight: 800;
    width: 24px;
    text-align: center;
  }
  .nshud-lb-rank-1 { color: #f5c542; }
  .nshud-lb-rank-2 { color: #cbd5e1; }
  .nshud-lb-rank-3 { color: #b45309; }
  .nshud-lb-score {
    font-weight: 700;
    color: var(--nshud-cyan);
    letter-spacing: 0.04em;
  }
  .nshud-lb-meta {
    color: #94a3b8;
    font-size: 10px;
    text-align: right;
  }
  .nshud-lb-date {
    color: #64748b;
    font-size: 9px;
    text-align: right;
    width: 70px;
  }

  /* Achievements Section in Pause Modal */
  .nshud-achievements-card {
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(34, 211, 238, 0.25);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 20px;
    text-align: left;
  }
  .nshud-ach-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .nshud-ach-title {
    color: var(--nshud-cyan);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .nshud-ach-tally {
    font-size: 10px;
    color: var(--nshud-gold);
    font-weight: 700;
  }
  .nshud-ach-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
    gap: 8px;
    max-height: 190px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .nshud-ach-grid::-webkit-scrollbar {
    width: 4px;
  }
  .nshud-ach-grid::-webkit-scrollbar-thumb {
    background: rgba(34, 211, 238, 0.35);
    border-radius: 2px;
  }
  .nshud-ach-badge-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 7px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.2s ease;
    position: relative;
  }
  .nshud-ach-badge-card.unlocked {
    background: rgba(245, 197, 66, 0.08);
    border-color: rgba(245, 197, 66, 0.45);
    box-shadow: 0 0 10px rgba(245, 197, 66, 0.15);
  }
  .nshud-ach-badge-card.locked {
    opacity: 0.45;
    filter: grayscale(0.85);
  }
  .nshud-ach-badge-icon {
    font-size: 22px;
    margin-bottom: 4px;
    line-height: 1;
  }
  .nshud-ach-badge-name {
    font-size: 10px;
    font-weight: 700;
    color: #e2e8f0;
    line-height: 1.2;
    margin-bottom: 2px;
  }
  .nshud-ach-badge-desc {
    font-size: 8.5px;
    color: #94a3b8;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .nshud-ach-badge-pts {
    font-size: 9px;
    color: var(--nshud-gold);
    font-weight: 700;
    margin-top: auto;
  }
  .nshud-ach-badge-card.unlocked .nshud-ach-badge-pts {
    color: var(--nshud-cyan);
  }

  /* Achievement Toast Notifications */
  #northstar-toast-container {
    position: fixed;
    top: 60px;
    right: 16px;
    z-index: 100000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  }
  .nshud-achievement-toast {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(8, 12, 24, 0.96));
    border: 1.5px solid var(--nshud-gold);
    border-radius: 12px;
    padding: 10px 14px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.85), 0 0 20px rgba(245, 197, 66, 0.35);
    color: #e2e8f0;
    min-width: 290px;
    max-width: 370px;
    transform: translateX(120%);
    opacity: 0;
    transition: transform 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.35s ease;
    pointer-events: auto;
    user-select: none;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .nshud-achievement-toast.show {
    transform: translateX(0);
    opacity: 1;
  }
  .nshud-achievement-toast.hide {
    transform: translateY(-15px) scale(0.95);
    opacity: 0;
  }
  .nshud-toast-icon {
    font-size: 26px;
    width: 44px;
    height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 197, 66, 0.15);
    border: 1px solid rgba(245, 197, 66, 0.45);
    border-radius: 10px;
    box-shadow: 0 0 14px rgba(245, 197, 66, 0.3);
    animation: nshud-pulse-gold 1.6s infinite alternate ease-in-out;
  }
  @keyframes nshud-pulse-gold {
    from { box-shadow: 0 0 8px rgba(245, 197, 66, 0.25); transform: scale(0.97); }
    to { box-shadow: 0 0 18px rgba(245, 197, 66, 0.65); transform: scale(1.03); }
  }
  .nshud-toast-body {
    flex: 1;
    text-align: left;
    overflow: hidden;
  }
  .nshud-toast-tag {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--nshud-gold);
    text-transform: uppercase;
  }
  .nshud-toast-title {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
    margin: 2px 0 3px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nshud-toast-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.3;
  }
  .nshud-toast-pts {
    font-size: 10px;
    font-weight: 800;
    color: var(--nshud-cyan);
    background: rgba(34, 211, 238, 0.12);
    padding: 3px 7px;
    border-radius: 6px;
    border: 1px solid rgba(34, 211, 238, 0.35);
    white-space: nowrap;
  }

  .nshud-action-btn.gp-selected {
    outline: 2px solid var(--nshud-cyan);
    box-shadow: 0 0 16px rgba(34, 211, 238, 0.6);
  }

  @media (max-width: 600px) {
    #northstar-arcade-hud {
      top: 6px;
      right: 6px;
      padding: 3px 6px;
    }
    .nshud-brand span.nshud-name {
      display: none;
    }
    .nshud-volume-wrap input[type="range"] {
      width: 40px;
    }
  }
  `;

  function injectCSS() {
    if (document.getElementById('northstar-hud-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'northstar-hud-styles';
    styleEl.textContent = HUD_CSS;
    document.head.appendChild(styleEl);
  }

  function createCRTLayers() {
    if (document.getElementById('northstar-crt-layer')) return;
    const crt = document.createElement('div');
    crt.id = 'northstar-crt-layer';
    if (!state.crtEnabled) crt.classList.add('crt-off');
    crt.innerHTML = `
      <div class="crt-scanlines"></div>
      <div class="crt-vignette"></div>
      <div class="crt-phosphor-glow"></div>
    `;
    document.body.appendChild(crt);
  }

  function createHUD() {
    if (document.getElementById('northstar-arcade-hud')) return;

    // Load High Score
    state.highScore = getHighScore(state.gameId);

    const hud = document.createElement('aside');
    hud.id = 'northstar-arcade-hud';
    hud.setAttribute('aria-label', 'NorthStar Arcade Cabinet HUD');
    hud.innerHTML = `
      <div class="nshud-brand" title="NorthStar Platform // Interdimensional Games">
        <span class="nshud-star">★</span>
        <span class="nshud-name">NSP IDG</span>
      </div>

      <div class="nshud-score-pill" id="nshud-best-badge" title="Saved High Score in Local Memory">
        <span class="nshud-score-label">BEST</span>
        <span id="nshud-best-val">${formatScore(state.highScore)}</span>
      </div>

      <div class="nshud-btn nshud-gamepad-badge" id="nshud-gamepad-badge" style="display:none;" title="Gamepad Connected">
        PAD <span id="nshud-gamepad-name">PAD</span>
      </div>

      <button type="button" class="nshud-btn" id="nshud-pause-btn" title="Pause Game (Esc, P, or Start)">
        ⏸ <span>Pause</span>
      </button>

      <div class="nshud-volume-wrap">
        <button type="button" class="nshud-btn" id="nshud-mute-btn" title="Toggle Mute (M)">
          ${state.isMuted || state.volume === 0 ? 'MUT' : 'SND'}
        </button>
        <input type="range" id="nshud-vol-slider" min="0" max="1" step="0.05" value="${state.isMuted ? 0 : state.volume}" title="Master Audio Volume">
      </div>

      <button type="button" class="nshud-btn ${state.crtEnabled ? 'active' : ''}" id="nshud-crt-btn" title="Toggle CRT Scanlines">
        ◫ <span>CRT</span>
      </button>

      <button type="button" class="nshud-btn" id="nshud-fullscreen-btn" title="Toggle Fullscreen (F)">
        ⛶
      </button>
    `;

    document.body.appendChild(hud);

    // Create Toast Container
    if (!document.getElementById('northstar-toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'northstar-toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }

    // Create Pause Modal
    const modal = document.createElement('div');
    modal.id = 'northstar-pause-modal';
    modal.innerHTML = `
      <div class="nshud-pause-card">
        <div class="nshud-pause-title">Game Paused</div>
        <div class="nshud-pause-subtitle" id="nshud-pause-subtitle">${escapeHtml(state.gameTitle)}</div>

        <div class="nshud-pause-stats">
          <div class="nshud-stat-box">
            <small>High Score</small>
            <strong id="nshud-modal-hiscore">${formatScore(state.highScore)}</strong>
          </div>
          <div class="nshud-stat-box">
            <small>Cabinet Engine</small>
            <strong>IDG v2.6</strong>
          </div>
        </div>

        <div class="nshud-leaderboard-card">
          <div class="nshud-lb-title">
            <span>★ Top 5 Hall of Fame</span>
            <span class="nshud-lb-sub">Local Arcade Memory</span>
          </div>
          <table class="nshud-lb-table">
            <tbody id="nshud-modal-leaderboard">
              <!-- populated dynamically -->
            </tbody>
          </table>
        </div>

        <div class="nshud-achievements-card">
          <div class="nshud-ach-header">
            <span class="nshud-ach-title">★️ Cabinet Trophies</span>
            <span class="nshud-ach-tally" id="nshud-modal-ach-count">0 / 0 Unlocked (0 PTS)</span>
          </div>
          <div class="nshud-ach-grid" id="nshud-modal-ach-list">
            <!-- populated dynamically -->
          </div>
        </div>

        <div class="nshud-pause-actions">
          <button type="button" class="nshud-action-btn nshud-btn-resume" id="nshud-modal-resume">
            ▶ Resume Game (P / Esc / Start)
          </button>
          <button type="button" class="nshud-action-btn nshud-btn-restart" id="nshud-modal-restart">
            ↺ Restart Round
          </button>
        </div>

        <div class="nshud-pause-hints">
          <span><kbd>P</kbd> / <kbd>Esc</kbd> / <kbd>Start</kbd> Pause</span>
          <span><kbd>A</kbd> Select</span>
          <span><kbd>F</kbd> Fullscreen</span>
          <span><kbd>M</kbd> Mute</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    bindEvents();
    renderLeaderboardInModal();
    renderAchievementsInModal();
    initGamepadPolling();
  }

  function formatScore(val) {
    if (typeof val !== 'number') val = parseInt(val, 10) || 0;
    return val.toLocaleString();
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let gpModalSelection = 0; // 0: resume, 1: restart
  function updateModalGamepadSelection() {
    const resumeBtn = document.getElementById('nshud-modal-resume');
    const restartBtn = document.getElementById('nshud-modal-restart');
    if (resumeBtn) resumeBtn.classList.toggle('gp-selected', gpModalSelection === 0);
    if (restartBtn) restartBtn.classList.toggle('gp-selected', gpModalSelection === 1);
  }

  function bindEvents() {
    // Pause button
    const pauseBtn = document.getElementById('nshud-pause-btn');
    if (pauseBtn) pauseBtn.onclick = () => togglePause();

    // Modal resume
    const resumeBtn = document.getElementById('nshud-modal-resume');
    if (resumeBtn) resumeBtn.onclick = () => resume();

    // Modal restart
    const restartBtn = document.getElementById('nshud-modal-restart');
    if (restartBtn) {
      restartBtn.onclick = () => {
        resume();
        state.callbacks.restart.forEach(cb => cb());
      };
    }

    // Modal backdrop click to resume
    const modal = document.getElementById('northstar-pause-modal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) resume();
      };
    }

    // Volume Slider
    const volSlider = document.getElementById('nshud-vol-slider');
    const muteBtn = document.getElementById('nshud-mute-btn');
    if (volSlider) {
      volSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
      };
    }
    if (muteBtn) {
      muteBtn.onclick = () => toggleMute();
    }

    // CRT Toggle
    const crtBtn = document.getElementById('nshud-crt-btn');
    if (crtBtn) {
      crtBtn.onclick = () => toggleCRT();
    }

    // Fullscreen Toggle
    const fsBtn = document.getElementById('nshud-fullscreen-btn');
    if (fsBtn) {
      fsBtn.onclick = () => toggleFullscreen();
    }

    // Global Key Listener
    window.addEventListener('keydown', (e) => {
      // Ignore if user is in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
      } else if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          toggleFullscreen();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    });

    // Handle standard fullscreen change
    document.addEventListener('fullscreenchange', () => {
      state.isFullscreen = !!document.fullscreenElement;
      if (fsBtn) fsBtn.textContent = state.isFullscreen ? '↙' : '⛶';
    });

    // Gamepad Connected Events
    window.addEventListener('gamepadconnected', (e) => {
      const badge = document.getElementById('nshud-gamepad-badge');
      const badgeName = document.getElementById('nshud-gamepad-name');
      if (badge) badge.style.display = 'inline-flex';
      if (badgeName) {
        const id = (e.gamepad.id || 'PAD').toUpperCase();
        badgeName.textContent = id.includes('XBOX') ? 'XBOX' : (id.includes('PLAYSTATION') || id.includes('DUAL') ? 'PS' : 'PAD');
      }
    });
    window.addEventListener('gamepaddisconnected', () => {
      const active = pollGamepad();
      const badge = document.getElementById('nshud-gamepad-badge');
      if (badge && !active) badge.style.display = 'none';
    });
  }

  // --- Public APIs ---

  function isPaused() {
    return state.isPaused;
  }

  function pause() {
    if (state.isPaused) return;
    state.isPaused = true;
    const modal = document.getElementById('northstar-pause-modal');
    if (modal) modal.classList.add('active');
    gpModalSelection = 0;
    updateModalGamepadSelection();
    renderLeaderboardInModal();
    renderAchievementsInModal();
    applyVolumeToAudio();
    state.callbacks.pause.forEach(cb => cb());
  }

  function resume() {
    if (!state.isPaused) return;
    state.isPaused = false;
    const modal = document.getElementById('northstar-pause-modal');
    if (modal) modal.classList.remove('active');
    applyVolumeToAudio();
    state.callbacks.resume.forEach(cb => cb());
  }

  function togglePause() {
    if (state.isPaused) resume();
    else pause();
  }

  function getVolume() {
    return state.isMuted ? 0 : state.volume;
  }

  function setVolume(val) {
    state.volume = Math.max(0, Math.min(1, val));
    if (state.volume > 0) state.isMuted = false;
    localStorage.setItem(STORAGE_KEYS.VOLUME, String(state.volume));
    localStorage.setItem(STORAGE_KEYS.MUTED, String(state.isMuted));
    applyVolumeToAudio();
    updateVolumeUI();
    state.callbacks.volume.forEach(cb => cb(getVolume()));
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    localStorage.setItem(STORAGE_KEYS.MUTED, String(state.isMuted));
    applyVolumeToAudio();
    updateVolumeUI();
    state.callbacks.volume.forEach(cb => cb(getVolume()));
  }

  function updateVolumeUI() {
    const volSlider = document.getElementById('nshud-vol-slider');
    const muteBtn = document.getElementById('nshud-mute-btn');
    if (volSlider) volSlider.value = state.isMuted ? 0 : state.volume;
    if (muteBtn) muteBtn.textContent = state.isMuted || state.volume === 0 ? 'MUT' : 'SND';
  }

  function applyVolumeToAudio() {
    const effectiveVol = state.isPaused ? 0.00001 : getVolume();
    // Smooth ramping without zipper noise or clicking
    state.masterGains.forEach((gainNode, ctx) => {
      try {
        if (ctx.state === 'suspended' && !state.isPaused) ctx.resume();
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setTargetAtTime(effectiveVol, ctx.currentTime, state.isPaused ? 0.015 : 0.025);
      } catch (e) {}
    });
    // Update HTMLAudioElements
    state.audioElements.forEach((audio) => {
      try {
        if (!audio.__originalVol) audio.__originalVol = audio.volume || 1;
        if (state.isPaused) {
          if (!audio.paused) {
            audio.__wasPlaying = true;
            audio.pause();
          }
        } else {
          audio.volume = audio.__originalVol * effectiveVol;
          if (audio.__wasPlaying) {
            audio.play().catch(() => {});
            audio.__wasPlaying = false;
          }
        }
      } catch (e) {}
    });
  }

  function attachAudioContext(ctx) {
    if (!ctx) return null;
    state.audioContexts.add(ctx);
    let masterGain = state.masterGains.get(ctx);
    if (!masterGain) {
      masterGain = ctx.createGain();
      const vol = state.isPaused ? 0.00001 : getVolume();
      masterGain.gain.setValueAtTime(vol, ctx.currentTime);
      // Hook between nodes and destination
      masterGain.connect(ctx.destination);
      state.masterGains.set(ctx, masterGain);
    }
    return masterGain;
  }

  function hookAudioElement(audio) {
    if (!audio) return;
    state.audioElements.add(audio);
    if (!audio.__originalVol) audio.__originalVol = audio.volume || 1;
    audio.volume = audio.__originalVol * (state.isPaused ? 0 : getVolume());
  }

  function toggleCRT() {
    state.crtEnabled = !state.crtEnabled;
    localStorage.setItem(STORAGE_KEYS.CRT, String(state.crtEnabled));
    const crt = document.getElementById('northstar-crt-layer');
    const btn = document.getElementById('nshud-crt-btn');
    if (crt) crt.classList.toggle('crt-off', !state.crtEnabled);
    if (btn) btn.classList.toggle('active', state.crtEnabled);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Fullscreen request prevented: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  // --- High Score & Top 5 Leaderboard ---
  const DEFAULT_LEADERBOARDS = {
    vorath_blade_tribunal: [
      { score: 14500, meta: { rank: "SSS", detail: "Phantom Cleave" }, date: "Today" },
      { score: 11200, meta: { rank: "SS", detail: "Goliath Stagger" }, date: "Today" },
      { score: 8600, meta: { rank: "S", detail: "Scout Parry" }, date: "Yesterday" },
      { score: 5800, meta: { rank: "A", detail: "Round 2 Clear" }, date: "Yesterday" },
      { score: 3400, meta: { rank: "B", detail: "First Duel" }, date: "Yesterday" }
    ],
    super_vorath_bros: [
      { score: 32500, meta: { detail: "World 2-4", shards: 94 }, date: "Today" },
      { score: 24800, meta: { detail: "World 2-2", shards: 72 }, date: "Today" },
      { score: 18400, meta: { detail: "World 1-4", shards: 55 }, date: "Yesterday" },
      { score: 12200, meta: { detail: "World 1-2", shards: 38 }, date: "Yesterday" },
      { score: 7500, meta: { detail: "World 1-1", shards: 22 }, date: "Yesterday" }
    ],
    vorath_pinball: [
      { score: 2450000, meta: { detail: "9x Multiball", balls: 3 }, date: "Today" },
      { score: 1780000, meta: { detail: "6x Jackpot", balls: 3 }, date: "Today" },
      { score: 1240000, meta: { detail: "3x Nova", balls: 2 }, date: "Yesterday" },
      { score: 820000, meta: { detail: "Orbit Gate", balls: 1 }, date: "Yesterday" },
      { score: 460000, meta: { detail: "Slingshot Run", balls: 1 }, date: "Yesterday" }
    ],
    prism_drift: [
      { score: 92800, meta: { detail: "Neon Trial", combo: "x8" }, date: "Today" },
      { score: 74500, meta: { detail: "Prism Line", combo: "x6" }, date: "Today" },
      { score: 56400, meta: { detail: "Eclipse Gate", combo: "x5" }, date: "Yesterday" },
      { score: 41200, meta: { detail: "Rail Graze", combo: "x4" }, date: "Yesterday" },
      { score: 28900, meta: { detail: "Clean Lap", combo: "x2" }, date: "Yesterday" }
    ],
    blazin_beaver_comic: [
      { score: 100, meta: { detail: "Complete Lore", issues: 5 }, date: "Today" },
      { score: 85, meta: { detail: "Ashcan Edition", issues: 4 }, date: "Today" },
      { score: 65, meta: { detail: "Special Issue", issues: 3 }, date: "Yesterday" },
      { score: 45, meta: { detail: "Issue #2 Read", issues: 2 }, date: "Yesterday" },
      { score: 25, meta: { detail: "Issue #1 Read", issues: 1 }, date: "Yesterday" }
    ],
    cascade_salmon_run: [
      { score: 25000, meta: { detail: "Spawning Pools", distance: "2500m" }, date: "Today" },
      { score: 18400, meta: { detail: "Beaver Dam Pass", distance: "1920m" }, date: "Today" },
      { score: 13200, meta: { detail: "Grizzly Shallows", distance: "1450m" }, date: "Yesterday" },
      { score: 8500, meta: { detail: "Waterfall Leap", distance: "950m" }, date: "Yesterday" },
      { score: 4200, meta: { detail: "Lower Rapids", distance: "520m" }, date: "Yesterday" }
    ]
  };

  function getHighScore(gameKey = state.gameId, defaultVal = 0) {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SCORES_PREFIX + gameKey);
      if (stored !== null) return parseInt(stored, 10) || 0;
    } catch (e) {}
    // Check leaderboard defaults if not saved yet
    const defaults = DEFAULT_LEADERBOARDS[gameKey] || [];
    if (defaults.length > 0 && defaults[0].score > defaultVal) {
      return defaults[0].score;
    }
    return defaultVal;
  }

  function saveHighScore(gameKey = state.gameId, newScore = 0, metadata = {}) {
    try {
      newScore = Math.floor(newScore);
      if (newScore <= 0) return false;

      // Always record into the top 10 history
      recordLeaderboardEntry(gameKey, newScore, metadata);

      const curBest = getHighScore(gameKey);
      if (newScore > curBest) {
        localStorage.setItem(STORAGE_KEYS.SCORES_PREFIX + gameKey, String(newScore));
        state.highScore = newScore;
        updateHighScoreUI(newScore);
        renderLeaderboardInModal();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function recordLeaderboardEntry(gameKey, score, metadata) {
    try {
      const key = STORAGE_KEYS.SCORES_PREFIX + gameKey + '_history';
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      history.push({
        score: Math.floor(score),
        date: dateStr,
        meta: metadata || {}
      });
      history.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
    } catch (e) {}
  }

  function getLeaderboard(gameKey = state.gameId) {
    try {
      const key = STORAGE_KEYS.SCORES_PREFIX + gameKey + '_history';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (stored && stored.length >= 5) {
        return stored.slice(0, 5);
      }
      // Fill remaining spots from defaults
      const defaults = DEFAULT_LEADERBOARDS[gameKey] || DEFAULT_LEADERBOARDS.vorath_blade_tribunal;
      const combined = stored.concat(defaults);
      combined.sort((a, b) => b.score - a.score);
      // Remove duplicates by score
      const seen = new Set();
      const unique = combined.filter(item => {
        if (seen.has(item.score)) return false;
        seen.add(item.score);
        return true;
      });
      return unique.slice(0, 5);
    } catch (e) {
      return (DEFAULT_LEADERBOARDS[gameKey] || []).slice(0, 5);
    }
  }

  function renderLeaderboardInModal() {
    const tableBody = document.getElementById('nshud-modal-leaderboard');
    if (!tableBody) return;
    const top5 = getLeaderboard(state.gameId);
    let html = '';
    top5.forEach((entry, idx) => {
      const rank = idx + 1;
      const rankClass = rank === 1 ? 'nshud-lb-rank-1' : (rank === 2 ? 'nshud-lb-rank-2' : (rank === 3 ? 'nshud-lb-rank-3' : ''));
      const rankIcon = rank === 1 ? '①' : (rank === 2 ? '②' : (rank === 3 ? '③' : `#${rank}`));
      const metaText = (entry.meta && (entry.meta.detail || entry.meta.rank || entry.meta.level || entry.meta.circuit)) || '';
      html += `
        <tr class="nshud-lb-row">
          <td class="nshud-lb-rank ${rankClass}">${rankIcon}</td>
          <td class="nshud-lb-score">${formatScore(entry.score)}</td>
          <td class="nshud-lb-meta">${escapeHtml(metaText)}</td>
          <td class="nshud-lb-date">${escapeHtml(entry.date || 'Record')}</td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
  }

  function updateHighScoreUI(score) {
    const el = document.getElementById('nshud-best-val');
    const modalEl = document.getElementById('nshud-modal-hiscore');
    if (el) el.textContent = formatScore(score);
    if (modalEl) modalEl.textContent = formatScore(score);
  }

  // --- Cabinet Achievement System ---
  const CABINET_ACHIEVEMENTS = {
    // Vorath Blade Tribunal
    vbt_first_blood: {
      gameId: 'vorath_blade_tribunal',
      title: 'First Blood',
      desc: 'Strike down your first opponent in the Tribunal',
      icon: '⚔️',
      points: 50
    },
    vbt_flawless_parry: {
      gameId: 'vorath_blade_tribunal',
      title: 'Flawless Parry',
      desc: 'Execute a frame-perfect blade parry against an enemy strike',
      icon: '⛊️',
      points: 100
    },
    vbt_supersonic_execution: {
      gameId: 'vorath_blade_tribunal',
      title: 'Supersonic Execution',
      desc: 'Trigger and land a Counter Dash execution strike',
      icon: '⚡',
      points: 150
    },
    vbt_grand_champion: {
      gameId: 'vorath_blade_tribunal',
      title: 'Grand Champion',
      desc: 'Defeat 3 consecutive arena combatants in a single run',
      icon: '▲',
      points: 250
    },

    // Super Vorath Bros
    svb_first_stomp: {
      gameId: 'super_vorath_bros',
      title: 'First Stomp',
      desc: 'Stomp a cyber drone out of the sky',
      icon: 'RUN',
      points: 50
    },
    svb_hyper_surge: {
      gameId: 'super_vorath_bros',
      title: 'Hyper Surge',
      desc: 'Collect a Golden Cone and trigger neon overdrive',
      icon: '★',
      points: 100
    },
    svb_wall_master: {
      gameId: 'super_vorath_bros',
      title: 'Wall Climber',
      desc: 'Perform 3 consecutive diagonal wall kicks',
      icon: '▲',
      points: 150
    },
    svb_apex_climber: {
      gameId: 'super_vorath_bros',
      title: 'Apex Climber',
      desc: 'Touch the highest tip of the orbital flag pole',
      icon: '⚑',
      points: 200
    },

    // Vorath Pinball
    vpb_skill_shot: {
      gameId: 'vorath_pinball',
      title: 'Skill Shot',
      desc: 'Plunge the sphere directly into high-scoring orbit',
      icon: '◎',
      points: 50
    },
    vpb_nova_multiball: {
      gameId: 'vorath_pinball',
      title: 'Nova Multiball',
      desc: 'Overload the Kinetic Chamber and release 3 balls simultaneously',
      icon: '✦',
      points: 150
    },
    vpb_super_jackpot: {
      gameId: 'vorath_pinball',
      title: 'Super Jackpot',
      desc: 'Score a massive 6x or 9x mega multiplier jackpot',
      icon: '◆',
      points: 200
    },
    vpb_tilt_master: {
      gameId: 'vorath_pinball',
      title: 'Gravimetric Defiance',
      desc: 'Use dynamic cabinet nudge to rescue a draining ball',
      icon: 'JOY️',
      points: 100
    },

    // Prism Drift
    pdr_drift_initiate: {
      gameId: 'prism_drift',
      title: 'Apex Slider',
      desc: 'Sustain a continuous drift for over 3 seconds',
      icon: 'CAR️',
      points: 75
    },
    pdr_overdrive_boost: {
      gameId: 'prism_drift',
      title: 'Sub-Light Warp',
      desc: 'Hit consecutive track boost pads at maximum velocity',
      icon: '▲',
      points: 100
    },
    pdr_sub_60_lap: {
      gameId: 'prism_drift',
      title: 'Sub-Minute Legend',
      desc: 'Complete an entire lap in under 60.00 seconds',
      icon: '⏱️',
      points: 200
    },
    pdr_clean_race: {
      gameId: 'prism_drift',
      title: 'Ghost Driver',
      desc: 'Complete an entire lap without grazing any track barriers',
      icon: '✨',
      points: 150
    },

    // Cascade Salmon Run
    csr_waterfall_leaper: {
      gameId: 'cascade_salmon_run',
      title: 'Waterfall Leaper',
      desc: 'Power-leap up a roaring grade-5 waterfall',
      icon: '~',
      points: 75
    },
    csr_eagle_eyed: {
      gameId: 'cascade_salmon_run',
      title: 'Eagle Eyed',
      desc: 'Evade a swooping bald eagle dive at the last split-second',
      icon: '▲',
      points: 100
    },
    csr_bear_baiter: {
      gameId: 'cascade_salmon_run',
      title: 'Bear Baiter',
      desc: 'Dodge a grizzly bear claw swipe in the river shallows',
      icon: '▲',
      points: 125
    },
    csr_beaver_sanctuary: {
      gameId: 'cascade_salmon_run',
      title: "Blazin' Sanctuary",
      desc: 'Rest in a tranquil deep pool behind a wild beaver dam',
      icon: '▲',
      points: 100
    },
    csr_spawning_grounds: {
      gameId: 'cascade_salmon_run',
      title: 'Spawning Grounds',
      desc: 'Conquer the full 2,500m upstream odyssey to ancestral waters',
      icon: '►',
      points: 250
    },

    // Blazin' Beaver Comic
    bbc_full_lore: {
      gameId: 'blazin_beaver_comic',
      title: 'Deep Timber Scholar',
      desc: 'Read through the complete canonical comic archives',
      icon: 'DOC',
      points: 100
    }
  };

  function getUnlockedAchievements() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function hasAchievement(id) {
    const unlocked = getUnlockedAchievements();
    return !!unlocked[id];
  }

  function getAchievements(gameKey = state.gameId) {
    const unlocked = getUnlockedAchievements();
    const result = [];
    for (const [id, def] of Object.entries(CABINET_ACHIEVEMENTS)) {
      if (!gameKey || def.gameId === gameKey) {
        result.push({
          id,
          ...def,
          unlocked: !!unlocked[id],
          unlockedAt: unlocked[id] ? unlocked[id].unlockedAt : null
        });
      }
    }
    return result;
  }

  function getAllAchievements() {
    return getAchievements(null);
  }

  function unlockAchievement(id, customOpts = {}) {
    try {
      const unlocked = getUnlockedAchievements();
      if (unlocked[id]) return false; // already unlocked

      const def = CABINET_ACHIEVEMENTS[id] || {};
      const ach = {
        id,
        gameId: customOpts.gameId || def.gameId || state.gameId,
        title: customOpts.title || def.title || id,
        desc: customOpts.desc || def.desc || '',
        icon: customOpts.icon || def.icon || '★',
        points: customOpts.points !== undefined ? customOpts.points : (def.points || 50),
        unlockedAt: Date.now()
      };

      unlocked[id] = ach;
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(unlocked));

      // Play WebAudio celebratory chime
      playAchievementChime();

      // Show Retro-Cyber Toast
      showAchievementToast(ach);

      // Refresh modal showcase if open
      renderAchievementsInModal();

      return true;
    } catch (e) {
      console.warn('[NorthStarHUD] Error unlocking achievement:', e);
      return false;
    }
  }

  function playAchievementChime() {
    if (state.isMuted || state.volume === 0) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      let ctx = null;
      for (const c of state.audioContexts) {
        if (c && c.state === 'running') {
          ctx = c;
          break;
        }
      }
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const vol = getVolume();

      // Pentatonic triumph arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        const startTime = now + i * 0.08;
        const duration = i === notes.length - 1 ? 0.45 : 0.22;

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.24 * vol, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch (e) {}
  }

  function showAchievementToast(ach) {
    let container = document.getElementById('northstar-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'northstar-toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'nshud-achievement-toast';
    toast.innerHTML = `
      <div class="nshud-toast-icon">${ach.icon}</div>
      <div class="nshud-toast-body">
        <div class="nshud-toast-tag">★ Achievement Unlocked ★</div>
        <div class="nshud-toast-title">${escapeHtml(ach.title)}</div>
        <div class="nshud-toast-desc">${escapeHtml(ach.desc)}</div>
      </div>
      <div class="nshud-toast-pts">+${ach.points} PTS</div>
    `;

    container.appendChild(toast);

    // Trigger slide-in transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });

    // Auto dismiss after 3.6 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 3600);
  }

  function renderAchievementsInModal() {
    const listEl = document.getElementById('nshud-modal-ach-list');
    const tallyEl = document.getElementById('nshud-modal-ach-count');
    if (!listEl) return;

    const gameAchs = getAchievements(state.gameId);
    const allAchs = getAllAchievements();
    const unlockedCount = allAchs.filter(a => a.unlocked).length;
    const totalPoints = allAchs.filter(a => a.unlocked).reduce((sum, a) => sum + (a.points || 0), 0);

    if (tallyEl) {
      tallyEl.textContent = `${unlockedCount} / ${allAchs.length} Total (${totalPoints} PTS)`;
    }

    let html = '';
    // Show current game achievements
    gameAchs.forEach(ach => {
      const statusClass = ach.unlocked ? 'unlocked' : 'locked';
      const icon = ach.unlocked ? ach.icon : '⚿';
      html += `
        <div class="nshud-ach-badge-card ${statusClass}" title="${escapeHtml(ach.desc)}">
          <div class="nshud-ach-badge-icon">${icon}</div>
          <div class="nshud-ach-badge-name">${escapeHtml(ach.title)}</div>
          <div class="nshud-ach-badge-desc">${escapeHtml(ach.desc)}</div>
          <div class="nshud-ach-badge-pts">${ach.unlocked ? '✓ ' : ''}${ach.points} PTS</div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  // --- Unified Gamepad API Helper ---
  function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        pad = gamepads[i];
        break;
      }
    }
    const badge = document.getElementById('nshud-gamepad-badge');
    const badgeName = document.getElementById('nshud-gamepad-name');
    if (pad) {
      if (badge && badge.style.display === 'none') {
        badge.style.display = 'inline-flex';
        if (badgeName) {
          const idStr = (pad.id || 'GAMEPAD').toUpperCase();
          badgeName.textContent = idStr.includes('XBOX') ? 'XBOX' : (idStr.includes('PLAYSTATION') || idStr.includes('DUAL') ? 'PS' : 'PAD');
        }
      }
    } else if (badge && badge.style.display !== 'none') {
      badge.style.display = 'none';
    }

    if (!pad) return null;

    const deadzone = 0.20;
    const filterAxis = (val) => Math.abs(val) > deadzone ? val : 0;
    const btnDown = (b) => {
      if (typeof b === 'object' && b !== null) return !!(b.pressed || b.value > 0.28);
      return b === 1.0;
    };

    const ax0 = filterAxis(pad.axes[0] || 0); // left stick X
    const ax1 = filterAxis(pad.axes[1] || 0); // left stick Y
    const ax2 = filterAxis(pad.axes[2] || 0); // right stick X
    const ax3 = filterAxis(pad.axes[3] || 0); // right stick Y

    const b = pad.buttons || [];
    const dpadUp = btnDown(b[12]) || ax1 < -0.55;
    const dpadDown = btnDown(b[13]) || ax1 > 0.55;
    const dpadLeft = btnDown(b[14]) || ax0 < -0.45;
    const dpadRight = btnDown(b[15]) || ax0 > 0.45;

    return {
      connected: true,
      id: pad.id,
      axes: { x: ax0, y: ax1, rx: ax2, ry: ax3 },
      dpad: { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight },
      a: btnDown(b[0]),       // A / Cross
      b: btnDown(b[1]),       // B / Circle
      x: btnDown(b[2]),       // X / Square
      y: btnDown(b[3]),       // Y / Triangle
      lb: btnDown(b[4]),      // Left Bumper (L1)
      rb: btnDown(b[5]),      // Right Bumper (R1)
      lt: btnDown(b[6]),      // Left Trigger (L2)
      rt: btnDown(b[7]),      // Right Trigger (R2)
      select: btnDown(b[8]),  // Back / Select
      start: btnDown(b[9]),   // Start / Menu
      l3: btnDown(b[10]),     // Left Stick click
      r3: btnDown(b[11]),     // Right Stick click
      raw: pad
    };
  }

  let lastGpStart = false;
  let lastGpNavY = 0;
  let lastGpA = false;
  let lastGpSelect = false;

  function initGamepadPolling() {
    function gpLoop() {
      const pad = pollGamepad();
      if (pad) {
        // Start button toggles pause
        if (pad.start && !lastGpStart) {
          togglePause();
        }
        // Select button toggles CRT
        if (pad.select && !lastGpSelect) {
          toggleCRT();
        }
        // If modal is open, navigate menu
        if (state.isPaused) {
          const navY = pad.dpad.down ? 1 : (pad.dpad.up ? -1 : (Math.abs(pad.axes.y) > 0.5 ? Math.sign(pad.axes.y) : 0));
          if (navY !== 0 && lastGpNavY === 0) {
            gpModalSelection = (gpModalSelection === 0) ? 1 : 0;
            updateModalGamepadSelection();
          }
          lastGpNavY = navY;

          if (pad.a && !lastGpA) {
            if (gpModalSelection === 0) {
              resume();
            } else {
              resume();
              state.callbacks.restart.forEach(cb => cb());
            }
          }
          if (pad.b) {
            resume();
          }
        }
        lastGpStart = pad.start;
        lastGpSelect = pad.select;
        lastGpA = pad.a;
      } else {
        lastGpStart = false;
        lastGpNavY = 0;
        lastGpA = false;
        lastGpSelect = false;
      }
      requestAnimationFrame(gpLoop);
    }
    requestAnimationFrame(gpLoop);
  }

  function init(options = {}) {
    if (options.gameId) state.gameId = options.gameId;
    if (options.gameTitle) {
      state.gameTitle = options.gameTitle;
      const titleEl = document.getElementById('nshud-pause-subtitle');
      if (titleEl) titleEl.textContent = state.gameTitle;
    }
    if (options.onPause) state.callbacks.pause.push(options.onPause);
    if (options.onResume) state.callbacks.resume.push(options.onResume);
    if (options.onRestart) state.callbacks.restart.push(options.onRestart);
    if (options.onVolume) state.callbacks.volume.push(options.onVolume);

    injectCSS();
    createCRTLayers();
    createHUD();
    applyVolumeToAudio();

    return NorthStarHUD;
  }

  // Auto-init on DOMContentLoaded if not manual
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    setTimeout(() => init(), 10);
  }

  const NorthStarHUD = {
    init,
    isPaused,
    pause,
    resume,
    togglePause,
    getVolume,
    setVolume,
    toggleMute,
    attachAudioContext,
    hookAudioElement,
    toggleCRT,
    toggleFullscreen,
    getHighScore,
    saveHighScore,
    getLeaderboard,
    renderLeaderboardInModal,
    updateHighScoreUI,
    pollGamepad,
    unlockAchievement,
    hasAchievement,
    getAchievements,
    getAllAchievements,
    renderAchievementsInModal,
    onPause: (fn) => state.callbacks.pause.push(fn),
    onResume: (fn) => state.callbacks.resume.push(fn),
    onRestart: (fn) => state.callbacks.restart.push(fn),
    onVolumeChange: (fn) => state.callbacks.volume.push(fn)
  };

  return NorthStarHUD;
}));

