// NorthStar IDG // Future Teller Cabinet - Xbox 360 Gamepad & Dual-Rumble Haptics Suite
// Adheres to standard Gamepad API with vibrationActuator support

(function() {
  'use strict';

  let gamepadIndex = null;
  let prevButtons = {};
  let prevAxes = {};
  let controllerBadge = null;
  let legendBar = null;

  function createOverlayUI() {
    // 1. Controller Status Badge
    controllerBadge = document.createElement('div');
    controllerBadge.id = 'xbox360-badge';
    controllerBadge.style.cssText = `
      position: fixed;
      top: 14px;
      right: 18px;
      z-index: 1000;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      background: rgba(16, 124, 16, 0.25);
      border: 1px solid rgba(16, 124, 16, 0.8);
      color: #4ade80;
      backdrop-filter: blur(8px);
      box-shadow: 0 0 15px rgba(16, 124, 16, 0.4);
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    controllerBadge.innerHTML = `
      <span style="width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80;"></span>
      <span>Xbox 360 Controller Active</span>
    `;
    document.body.appendChild(controllerBadge);

    // 2. Controller Legend Bar at Bottom
    legendBar = document.createElement('div');
    legendBar.id = 'xbox360-legend';
    legendBar.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999;
      display: none;
      align-items: center;
      gap: 16px;
      padding: 6px 18px;
      border-radius: 24px;
      background: rgba(10, 14, 22, 0.85);
      border: 1px solid rgba(255, 245, 219, 0.2);
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.7), 0 0 10px rgba(47, 230, 255, 0.2);
      color: #f0f6fc;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      pointer-events: none;
    `;
    legendBar.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#107c10;color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">A</b> Pull Lever</span>
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#0078d7;color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">X</b> Insert Token</span>
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#ffb900;color:#000;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">Y</b> Refill</span>
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#d83b01;color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">B</b> Glow Toggle</span>
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#334155;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;">LB/RB</b> Lore Pack</span>
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#334155;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;">D-PAD</b> Zodiac</span>
      <span style="display:flex;align-items:center;gap:4px;"><b style="background:#334155;color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;">RT</b> Lever Force</span>
    `;
    document.body.appendChild(legendBar);
  }

  function triggerRumble(weak, strong, duration) {
    if (gamepadIndex === null) return;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[gamepadIndex];
    if (!gp || !gp.vibrationActuator) return;
    try {
      gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: duration || 120,
        weakMagnitude: weak || 0.3,
        strongMagnitude: strong || 0.6
      }).catch(() => {});
    } catch (e) {}
  }

  function cycleSelect(selectEl, delta) {
    if (!selectEl || !selectEl.options || selectEl.options.length === 0) return;
    let idx = selectEl.selectedIndex + delta;
    if (idx < 0) idx = selectEl.options.length - 1;
    if (idx >= selectEl.options.length) idx = 0;
    selectEl.selectedIndex = idx;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    triggerRumble(0.15, 0.25, 60);
  }

  function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let activeGp = null;

    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        activeGp = gamepads[i];
        gamepadIndex = i;
        break;
      }
    }

    if (!activeGp) {
      if (controllerBadge) controllerBadge.style.display = 'none';
      if (legendBar) legendBar.style.display = 'none';
      requestAnimationFrame(pollGamepad);
      return;
    }

    if (controllerBadge && controllerBadge.style.display !== 'flex') {
      controllerBadge.style.display = 'flex';
      if (legendBar) legendBar.style.display = 'flex';
      triggerRumble(0.3, 0.5, 150);
    }

    const b = activeGp.buttons;

    // Helper: Button press detection (edge triggered)
    function isPressed(btnIdx) {
      return b[btnIdx] && (b[btnIdx].pressed || b[btnIdx].value > 0.5);
    }
    function justPressed(btnIdx) {
      const pressed = isPressed(btnIdx);
      const res = pressed && !prevButtons[btnIdx];
      prevButtons[btnIdx] = pressed;
      return res;
    }

    // Button A (0): Pull Lever or Arm & Pull
    if (justPressed(0)) {
      const pullBtn = document.getElementById('pull-btn');
      const insertBtn = document.getElementById('insert-btn');
      if (pullBtn && !pullBtn.disabled) {
        triggerRumble(0.5, 0.8, 220);
        pullBtn.click();
      } else if (insertBtn && !insertBtn.disabled) {
        triggerRumble(0.2, 0.4, 80);
        insertBtn.click();
      }
    }

    // Button X (2): Insert Brass Token
    if (justPressed(2)) {
      const insertBtn = document.getElementById('insert-btn');
      if (insertBtn && !insertBtn.disabled) {
        triggerRumble(0.3, 0.6, 90);
        insertBtn.click();
      }
    }

    // Button Y (3): Refill Tokens
    if (justPressed(3)) {
      const refillBtn = document.getElementById('refill-btn');
      if (refillBtn) {
        triggerRumble(0.4, 0.5, 140);
        refillBtn.click();
      }
    }

    // Button B (1): Toggle Glow
    if (justPressed(1)) {
      const glowToggle = document.getElementById('glow-toggle');
      if (glowToggle) {
        glowToggle.checked = !glowToggle.checked;
        glowToggle.dispatchEvent(new Event('change', { bubbles: true }));
        triggerRumble(0.2, 0.2, 60);
      }
    }

    // LB (4) / RB (5): Cycle Lore Packs
    const packSelect = document.getElementById('pack-select');
    if (justPressed(4)) {
      cycleSelect(packSelect, -1);
    }
    if (justPressed(5)) {
      cycleSelect(packSelect, 1);
    }

    // D-Pad Up (12) / Down (13): Cycle Zodiac
    const zodiacSelect = document.getElementById('zodiac-select');
    if (justPressed(12)) {
      cycleSelect(zodiacSelect, -1);
    }
    if (justPressed(13)) {
      cycleSelect(zodiacSelect, 1);
    }

    // RT (7): Analog Lever Pull
    const rtVal = b[7] ? b[7].value : 0;
    if (rtVal > 0.6 && !prevAxes['rt']) {
      prevAxes['rt'] = true;
      const pullBtn = document.getElementById('pull-btn');
      if (pullBtn && !pullBtn.disabled) {
        triggerRumble(rtVal * 0.6, rtVal * 0.9, 250);
        pullBtn.click();
      }
    } else if (rtVal <= 0.3) {
      prevAxes['rt'] = false;
    }

    requestAnimationFrame(pollGamepad);
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createOverlayUI();
      requestAnimationFrame(pollGamepad);
    });
  } else {
    createOverlayUI();
    requestAnimationFrame(pollGamepad);
  }

  window.NorthStarXbox360 = {
    triggerRumble: triggerRumble
  };
})();
