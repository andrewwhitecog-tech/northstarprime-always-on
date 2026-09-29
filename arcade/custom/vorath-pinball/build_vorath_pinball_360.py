#!/usr/bin/env python3
"""
Vorath Cyber Pinball: 360 Edition Build Generator
Injects Xbox 360 Gamepad API, Dual-Rumble Haptics, Procedural Achievement Engine,
and standalone Chiptune/Juice polyfills into Vorath Pinball.
"""
from pathlib import Path

PINBALL_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\arcade\custom\vorath-pinball")
SRC_INDEX = PINBALL_DIR / "index.html"
OUT_STANDALONE = Path(r"C:\Users\andre\Downloads\Vorath_Cyber_Pinball_Xbox360.html")

def build():
    src_text = SRC_INDEX.read_text(encoding="utf-8")

    # 1. Update Title
    src_text = src_text.replace("<title>Vorath Pinball</title>", "<title>Vorath Cyber Pinball: 360 Edition (Xbox Live Arcade)</title>")

    # 2. Add Xbox 360 CSS
    xbox_css = """
    /* Xbox 360 Live Arcade Styling */
    .xbox-badge-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      padding: 6px 14px;
      background: linear-gradient(90deg, rgba(16,124,16,0.32), rgba(6,8,18,0.85));
      border: 1px solid rgba(16,124,16,0.6);
      border-radius: 20px;
      width: fit-content;
      font-size: 0.85rem;
      font-weight: 800;
      color: #79f291;
      letter-spacing: 0.08em;
      box-shadow: 0 0 16px rgba(16,124,16,0.25);
    }
    .xbox-orb {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: radial-gradient(circle, #24b830 0%, #0d5c14 100%);
      color: #fff;
      font-size: 13px;
      box-shadow: 0 0 8px #24b830;
    }
    .xbox-hud-bar {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: rgba(4, 6, 14, 0.78);
      border: 1px solid rgba(56, 233, 255, 0.35);
      border-radius: 8px;
      backdrop-filter: blur(8px);
      z-index: 25;
      font-size: 0.78rem;
      pointer-events: none;
    }
    .xbox-hud-bar.controller-active {
      border-color: rgba(16, 124, 16, 0.8);
      box-shadow: 0 0 14px rgba(16, 124, 16, 0.4);
    }
    .xb-pill {
      display: inline-block;
      padding: 2px 7px;
      margin: 0 3px;
      background: rgba(255,255,255,0.14);
      border-radius: 4px;
      font-weight: 800;
      color: #fff;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    .xb-pill.trigger { background: #0078d7; color: #fff; }
    .xb-pill.btn-a { background: #107c10; color: #fff; }
    .xb-pill.stick { background: #767676; color: #fff; }

    /* Xbox 360 Achievement Unlocked Banner */
    #achievement-toast {
      position: absolute;
      bottom: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: min(440px, 90%);
      background: linear-gradient(180deg, #182230 0%, #0c121c 100%);
      border: 2px solid #107c10;
      border-radius: 36px;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 100;
      box-shadow: 0 10px 30px rgba(0,0,0,0.85), 0 0 25px rgba(16,124,16,0.65);
      transition: bottom 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      pointer-events: none;
    }
    #achievement-toast.show {
      bottom: 35px;
    }
    .ach-ring {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 3px solid #107c10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, #107c10 0%, #063a06 100%);
      color: #fff;
      font-weight: 900;
      font-size: 22px;
      box-shadow: 0 0 16px #107c10;
      flex-shrink: 0;
    }
    .ach-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ach-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #94a3b8;
      font-weight: 800;
    }
    .ach-name {
      font-size: 15px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ach-score {
      font-size: 13px;
      font-weight: 800;
      color: #4ade80;
    }
"""
    src_text = src_text.replace("</style>", f"{xbox_css}\n  </style>")

    # 3. Add Xbox badge in Header
    old_h1_block = '<h1>Vorath Pinball</h1>'
    new_h1_block = """<h1>Vorath Cyber Pinball: 360 Edition</h1>
        <div class="xbox-badge-bar">
          <span class="xbox-orb">⬡</span>
          <span>XBOX 360 LIVE ARCADE &bull; DUAL-RUMBLE HAPTICS &bull; 240G GAMERSCORE</span>
        </div>"""
    src_text = src_text.replace(old_h1_block, new_h1_block, 1)

    # 4. Add HUD overlay and Achievement Toast inside .table-wrap
    table_wrap_target = '<div class="table-wrap">'
    table_wrap_replacement = """<div class="table-wrap">
        <div id="xboxHud" class="xbox-hud-bar">
          <span id="xboxStatus">🎮 Controller: Standby (Press any button)</span>
          <span class="xbox-legend">
            <span class="xb-pill trigger">LT / RT</span> Flippers
            <span class="xb-pill btn-a">A / R-Stick</span> Plunger
            <span class="xb-pill stick">L-Stick</span> Nudge
            <span class="xb-pill">START</span> Launch
          </span>
        </div>
        <div id="achievement-toast">
          <div class="ach-ring">⬡</div>
          <div class="ach-info">
            <div class="ach-title">Achievement Unlocked</div>
            <div class="ach-name">
              <span id="achTitle">First Contact</span>
              <span class="ach-score" id="achG">10G</span>
            </div>
          </div>
        </div>"""
    src_text = src_text.replace(table_wrap_target, table_wrap_replacement, 1)

    # 5. Clean, standalone JavaScript Engine: Juice, Chiptune, Xbox Audio & Gamepad
    standalone_engine = """
    // =========================================================================
    // STANDALONE JUICE & CHIPTUNE POLYFILLS
    // =========================================================================
    if (!window.Juice) {
      window.Juice = {
        attachFX: function(canvas, opts) {
          if (!canvas || canvas.__juiceFX) return;
          const o = Object.assign({ vignette: 0.5, scanlines: 0.04, glow: 0.07 }, opts || {});
          const host = canvas.parentElement || document.body;
          if (getComputedStyle(host).position === "static") host.style.position = "relative";
          const fx = document.createElement("div");
          fx.className = "juice-fx";
          fx.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:5;border-radius:inherit;" +
            "background:radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(0,0,0," + o.vignette + ") 130%)," +
            "repeating-linear-gradient(0deg, rgba(0,0,0," + o.scanlines + ") 0 1px, transparent 1px 3px)," +
            "linear-gradient(180deg, rgba(255,255,255," + o.glow + "), transparent 12%);";
          host.appendChild(fx);
          canvas.__juiceFX = fx;
          return fx;
        }
      };
    }

    if (!window.Chiptune) {
      (function(global) {
        let actx = null, mGain = null;
        function getAC() {
          if (!actx) {
            try {
              actx = new (global.AudioContext || global.webkitAudioContext)();
              mGain = actx.createGain();
              mGain.gain.value = 0.45;
              mGain.connect(actx.destination);
            } catch(e) {}
          }
          return actx;
        }
        function resumeAC() { const a = getAC(); if (a && a.state === 'suspended') a.resume(); }
        const midiFreq = n => 440 * Math.pow(2, (n - 69) / 12);
        function playTone(freq, t, dur, opt) {
          opt = opt || {}; const a = getAC(); if (!a) return;
          const osc = a.createOscillator(), g = a.createGain();
          osc.type = opt.type || "square";
          osc.frequency.setValueAtTime(freq, t);
          if (opt.bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * Math.pow(2, opt.bend)), t + dur);
          const v = opt.vol == null ? 0.22 : opt.vol;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(v, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(g); g.connect(mGain);
          osc.start(t); osc.stop(t + dur + 0.02);
        }
        function playNoise(t, dur, opt) {
          opt = opt || {}; const a = getAC(); if (!a) return;
          const buf = a.createBuffer(1, Math.max(1, (a.sampleRate * dur) | 0), a.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
          const s = a.createBufferSource(); s.buffer = buf; const g = a.createGain();
          g.gain.value = opt.vol == null ? 0.18 : opt.vol;
          s.connect(g); g.connect(mGain);
          s.start(t);
        }
        const sfxDict = {
          coin() { const a = getAC(); if (!a) return; const t = a.currentTime; playTone(midiFreq(83), t, 0.07, { vol: 0.2 }); playTone(midiFreq(90), t + 0.07, 0.45, { vol: 0.2 }); },
          pop() { const a = getAC(); if (!a) return; playTone(midiFreq(76), a.currentTime, 0.09, { vol: 0.24, bend: -0.8 }); },
          shoot() { const a = getAC(); if (!a) return; const t = a.currentTime; playNoise(t, 0.12, { vol: 0.22 }); playTone(midiFreq(55), t, 0.22, { vol: 0.28, bend: 1.2 }); },
          blip() { const a = getAC(); if (!a) return; playTone(midiFreq(81), a.currentTime, 0.05, { vol: 0.16 }); },
          powerUp() { const a = getAC(); if (!a) return; const t = a.currentTime; [60,64,67,72,76].forEach((n, i) => playTone(midiFreq(n), t + i * 0.05, 0.08, { vol: 0.18 })); },
          oneUp() { const a = getAC(); if (!a) return; const t = a.currentTime; [67,71,74,79,83,86].forEach((n, i) => playTone(midiFreq(n), t + i * 0.06, 0.12, { vol: 0.22 })); },
          gate() { const a = getAC(); if (!a) return; playTone(midiFreq(48), a.currentTime, 0.35, { vol: 0.26, bend: -0.6 }); }
        };
        function startMusic(opts) {
          const a = getAC(); if (!a) return null;
          opts = opts || {};
          const bpm = opts.bpm || 132, step = 60 / bpm / 2;
          const mel = opts.mel || [72, 76, 79, 84, 79, 76, 72, 67];
          const bass = opts.bass || [36, 36, 43, 43, 41, 41, 38, 38];
          let idx = 0;
          const timer = setInterval(() => {
            const now = a.currentTime;
            const m = mel[idx % mel.length];
            const b = bass[idx % bass.length];
            if (m) playTone(midiFreq(m), now, step * 0.8, { vol: 0.12, type: "sawtooth" });
            if (b) playTone(midiFreq(b), now, step * 1.6, { vol: 0.18, type: "triangle" });
            idx++;
          }, step * 1000);
          return { stop() { clearInterval(timer); } };
        }
        global.Chiptune = { AC: getAC, resume: resumeAC, tone: playTone, noise: playNoise, SFX: sfxDict, Music: startMusic };
      })(window);
    }

    // =========================================================================
    // XBOX 360 PROCEDURAL AUDIO & CHIME ENGINE
    // =========================================================================
    function playXboxChime() {
      const a = (typeof Chiptune !== 'undefined' && Chiptune.AC) ? Chiptune.AC() : null;
      if (!a) return;
      const now = a.currentTime;

      // Note 1: F#5 (739.99 Hz)
      const o1 = a.createOscillator();
      const g1 = a.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(739.99, now);
      g1.gain.setValueAtTime(0.38, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      o1.connect(g1);
      g1.connect(a.destination);
      o1.start(now);
      o1.stop(now + 1.0);

      // Note 2: B5 (987.77 Hz) delayed 160ms
      const o2 = a.createOscillator();
      const g2 = a.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(987.77, now + 0.16);
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.setValueAtTime(0.45, now + 0.16);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
      o2.connect(g2);
      g2.connect(a.destination);
      o2.start(now + 0.16);
      o2.stop(now + 2.35);

      // Sparkle Shimmer: B6 (1975.5 Hz) overtone
      const o3 = a.createOscillator();
      const g3 = a.createGain();
      o3.type = 'triangle';
      o3.frequency.setValueAtTime(1975.5, now + 0.16);
      g3.gain.setValueAtTime(0.0001, now);
      g3.gain.setValueAtTime(0.12, now + 0.16);
      g3.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      o3.connect(g3);
      g3.connect(a.destination);
      o3.start(now + 0.16);
      o3.stop(now + 1.55);
    }

    // =========================================================================
    // XBOX 360 DUAL-RUMBLE HAPTICS
    // =========================================================================
    function playXboxHaptic(weak = 0.3, strong = 0.5, duration = 80) {
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
          if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) {
            pad.vibrationActuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: duration,
              weakMagnitude: Math.min(1.0, weak),
              strongMagnitude: Math.min(1.0, strong)
            }).catch(() => {});
          }
        }
      } catch (e) {}
    }

    // =========================================================================
    // XBOX 360 ACHIEVEMENTS ENGINE (240G Total)
    // =========================================================================
    const XBOX_ACHIEVEMENTS = {
      'first_launch': { title: 'First Contact', score: '10G', desc: 'Launched your first cyber-pinball into the Vorath table.' },
      'perfect_skill_shot': { title: 'Dead Eye', score: '20G', desc: 'Nailed a Perfect Skill Shot off the plunge.' },
      'bumper_frenzy': { title: 'Hyper-Velocity', score: '25G', desc: 'Triggered 20 bumper rebounds in a single ball.' },
      'multiball_matrix': { title: 'Tri-Core Overdrive', score: '35G', desc: 'Ignited the 3-Ball Vorath Multiball matrix.' },
      'super_jackpot': { title: 'Singularity Cashout', score: '50G', desc: 'Collected the Super Jackpot on any table.' },
      'pinball_wizard': { title: 'Pinball Sovereign', score: '100G', desc: 'Surpassed 25,000,000 total score.' }
    };

    const unlockedXboxAchievements = new Set(
      JSON.parse(localStorage.getItem('vorathPinballXboxAchievements') || '[]')
    );
    const achievementQueue = [];
    let isShowingAchievement = false;

    function triggerXboxAchievement(id) {
      if (!XBOX_ACHIEVEMENTS[id] || unlockedXboxAchievements.has(id)) return;
      unlockedXboxAchievements.add(id);
      localStorage.setItem('vorathPinballXboxAchievements', JSON.stringify([...unlockedXboxAchievements]));
      achievementQueue.push(XBOX_ACHIEVEMENTS[id]);
      processAchievementQueue();
    }

    function processAchievementQueue() {
      if (isShowingAchievement || achievementQueue.length === 0) return;
      isShowingAchievement = true;
      const ach = achievementQueue.shift();

      playXboxChime();
      playXboxHaptic(0.7, 1.0, 320);

      const toast = document.getElementById('achievement-toast');
      const titleEl = document.getElementById('achTitle');
      const scoreEl = document.getElementById('achG');
      if (titleEl && scoreEl && toast) {
        titleEl.textContent = ach.title;
        scoreEl.textContent = ach.score;
        toast.classList.add('show');
        addLog("Xbox 360 Achievement Unlocked: " + ach.title + " (" + ach.score + ")");

        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => {
            isShowingAchievement = false;
            processAchievementQueue();
          }, 700);
        }, 4200);
      } else {
        isShowingAchievement = false;
      }
    }

    // =========================================================================
    // XBOX 360 GAMEPAD POLLING & INPUT DISPATCH
    // =========================================================================
    const padPrev = { leftTrig: false, rightTrig: false, btnA: false, nudge: false, btnStart: false, btnBack: false };
    let lastPadActiveTime = 0;

    function pollXboxGamepad(dt) {
      if (!navigator.getGamepads) return;
      const gamepads = navigator.getGamepads();
      let activePad = null;
      for (const gp of gamepads) {
        if (gp && gp.connected) {
          activePad = gp;
          break;
        }
      }

      const hudBar = document.getElementById('xboxHud');
      const statusEl = document.getElementById('xboxStatus');

      if (!activePad) {
        if (Date.now() - lastPadActiveTime > 2500) {
          if (hudBar) hudBar.classList.remove('controller-active');
          if (statusEl) statusEl.innerHTML = '🎮 Controller: Standby (Press any button)';
        }
        return;
      }

      lastPadActiveTime = Date.now();
      if (hudBar) hudBar.classList.add('controller-active');
      if (statusEl) statusEl.innerHTML = '🎮 <span style="color:#4ade80">Xbox 360 Active</span> [Dual-Rumble Ready]';

      if (typeof resumeAudio === 'function') resumeAudio();

      // 1. Triggers / Bumpers -> Flippers
      const leftTriggerVal = (activePad.buttons[6] ? activePad.buttons[6].value : 0) || (activePad.buttons[4] && activePad.buttons[4].pressed ? 1 : 0);
      const rightTriggerVal = (activePad.buttons[7] ? activePad.buttons[7].value : 0) || (activePad.buttons[5] && activePad.buttons[5].pressed ? 1 : 0);

      const leftNow = leftTriggerVal > 0.15;
      const rightNow = rightTriggerVal > 0.15;

      if (leftNow && !padPrev.leftTrig) {
        playXboxHaptic(0.25, 0.45, 45);
      }
      if (rightNow && !padPrev.rightTrig) {
        playXboxHaptic(0.25, 0.45, 45);
      }

      padPrev.leftTrig = leftNow;
      padPrev.rightTrig = rightNow;

      if (leftNow) state.leftFlip = true;
      if (rightNow) state.rightFlip = true;

      // 2. Button A or Right Stick Down -> Plunger
      const btnAPressed = activePad.buttons[0] && activePad.buttons[0].pressed;
      const rStickDown = activePad.axes.length >= 4 && activePad.axes[3] > 0.35;
      const plungerAction = btnAPressed || rStickDown;

      if (plungerAction && ball.held) {
        state.launchHeld = true;
        state.plunger = Math.min(1, state.plunger + 0.024 * dt);
        playXboxHaptic(0.08, 0.12, 30);
      } else if (padPrev.btnA && ball.held && !plungerAction) {
        launchBall();
      }
      padPrev.btnA = plungerAction;

      // 3. Left Stick Nudge
      const lStickX = activePad.axes.length >= 2 ? activePad.axes[0] : 0;
      const lStickY = activePad.axes.length >= 2 ? activePad.axes[1] : 0;
      const stickMag = Math.hypot(lStickX, lStickY);

      if (stickMag > 0.68 && !padPrev.nudge) {
        nudgeTable();
        playXboxHaptic(0.65, 0.85, 120);
        padPrev.nudge = true;
      } else if (stickMag <= 0.45) {
        padPrev.nudge = false;
      }

      // 4. Start Button -> Start / Launch
      const btnStart = activePad.buttons[9] && activePad.buttons[9].pressed;
      if (btnStart && !padPrev.btnStart) {
        if (!state.running) startTable();
        else if (ball.held) launchBall();
      }
      padPrev.btnStart = btnStart;

      // 5. Back Button -> Cycle Table
      const btnBack = activePad.buttons[8] && activePad.buttons[8].pressed;
      if (btnBack && !padPrev.btnBack) {
        cycleTable();
        playXboxHaptic(0.3, 0.5, 60);
      }
      padPrev.btnBack = btnBack;
    }
    """

    # Inject standalone_engine right before `function updateGame`
    src_text = src_text.replace("function updateGame(now = performance.now()) {", f"{standalone_engine}\n\n    function updateGame(now = performance.now()) {{")

    # In updateGame, call pollXboxGamepad(dt)
    update_game_hook = """      state.leftFlip = keys.has("a") || keys.has("arrowleft") || els.leftBtn.classList.contains("is-down");
      state.rightFlip = keys.has("l") || keys.has("arrowright") || els.rightBtn.classList.contains("is-down");
      pollXboxGamepad(dt);"""
    src_text = src_text.replace(
        'state.leftFlip = keys.has("a") || keys.has("arrowleft") || els.leftBtn.classList.contains("is-down");\n      state.rightFlip = keys.has("l") || keys.has("arrowright") || els.rightBtn.classList.contains("is-down");',
        update_game_hook,
        1
    )

    # In launchBall(), trigger first_launch achievement and launch haptic
    src_text = src_text.replace(
        'addShake(4);',
        'addShake(4);\n      playXboxHaptic(0.35, 0.70, 110);\n      triggerXboxAchievement("first_launch");',
        1
    )

    # In resolveSkillShot(), trigger perfect_skill_shot achievement
    src_text = src_text.replace(
        'if (grade === "Perfect") state.multiplier = Math.min(9, state.multiplier + 1);',
        'if (grade === "Perfect") {\n        state.multiplier = Math.min(9, state.multiplier + 1);\n        triggerXboxAchievement("perfect_skill_shot");\n        playXboxHaptic(0.55, 0.85, 140);\n      }',
        1
    )

    # In spawnMultiball(), trigger multiball_matrix achievement
    src_text = src_text.replace(
        'function spawnMultiball() {',
        'function spawnMultiball() {\n      triggerXboxAchievement("multiball_matrix");\n      playXboxHaptic(0.8, 1.0, 300);',
        1
    )

    # In addScore(), check 25M score achievement
    src_text = src_text.replace(
        'state.score += earned;',
        'state.score += earned;\n      if (state.score >= 25000000) triggerXboxAchievement("pinball_wizard");\n      if (state.jackpot >= 10000000) triggerXboxAchievement("super_jackpot");',
        1
    )

    # In bumper collision, track bumper hits and add haptics
    bumper_collision_target = """        if (collideCircle(orb, scaledBumper)) {
          bumper.flash = 1;
          sfx("pop");
          addShake(3.5);"""
    bumper_collision_replacement = """        if (collideCircle(orb, scaledBumper)) {
          bumper.flash = 1;
          sfx("pop");
          playXboxHaptic(0.42, 0.65, 65);
          state.currentBallBumperHits = (state.currentBallBumperHits || 0) + 1;
          if (state.currentBallBumperHits >= 20) triggerXboxAchievement("bumper_frenzy");
          addShake(3.5);"""
    src_text = src_text.replace(bumper_collision_target, bumper_collision_replacement, 1)

    # In resetBall(), reset ball bumper hits
    src_text = src_text.replace(
        'state.ballSave = true;',
        'state.ballSave = true;\n      state.currentBallBumperHits = 0;',
        1
    )

    # Write standalone distribution to Downloads
    OUT_STANDALONE.write_text(src_text, encoding="utf-8")
    print(f"Shipped Xbox 360 Edition standalone to: {OUT_STANDALONE} ({OUT_STANDALONE.stat().st_size} bytes)")

    # Write updated file to arcade custom repo
    SRC_INDEX.write_text(src_text, encoding="utf-8")
    print(f"Updated arcade repository: {SRC_INDEX} ({SRC_INDEX.stat().st_size} bytes)")

if __name__ == "__main__":
    build()
