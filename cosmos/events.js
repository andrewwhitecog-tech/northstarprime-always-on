/* ============================================================
   CUBIC COSMOS · events.js — the in-game half of the AI event
   director. Reads npc_packs/events.json (regenerated offline by
   tools/convergence/cosmos_director.py) and runs cheap ambient
   events on interval timers:
     aurora_storm         sky ribbons intensify, gems sparkle
     gem_rain             gem blocks appear on random island tops
     signal_surge         signal meter refills, gold flash
     trivia_transmission  question overlay, gems for precision
     pantheon_whisper     an NPC line as a transmission banner
   ============================================================ */
window.CosmosEvents = (function () {
  'use strict';

  var DEFAULT_PACK = {
    events: [
      { type: 'pantheon_whisper',    interval: 55,  params: {} },
      { type: 'gem_rain',            interval: 95,  params: { count: 4 } },
      { type: 'trivia_transmission', interval: 80,  params: { reward: 3 } },
      { type: 'aurora_storm',        interval: 110, time_of_day: 'night', params: { duration: 20 } },
      { type: 'signal_surge',        interval: 140, params: {} }
    ],
    trivia: [
      { q: 'How many sides does a hexagon have?',
        choices: ['Five', 'Six', 'Seven'], answer: 1 },
      { q: "Which gas makes up most of Earth's atmosphere?",
        choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen'], answer: 2 },
      { q: 'Roughly how fast does light travel in a vacuum?',
        choices: ['300,000 km per second', '30,000 km per second', '3,000 km per second'], answer: 0 },
      { q: 'Which metal is liquid at room temperature?',
        choices: ['Gold', 'Mercury', 'Iron'], answer: 1 },
      { q: 'What causes the aurora borealis?',
        choices: ['Moonlight reflecting off ice', 'Volcanic dust in the sky', 'Solar particles striking the atmosphere'], answer: 2 },
      { q: 'What is the hardest naturally occurring material?',
        choices: ['Diamond', 'Quartz', 'Obsidian'], answer: 0 },
      { q: 'Obsidian is formed from...',
        choices: ['Compressed sand', 'Rapidly cooled lava', 'Fossilized wood'], answer: 1 },
      { q: 'About how long does sunlight take to reach Earth?',
        choices: ['8 minutes', '8 seconds', '8 hours'], answer: 0 },
      { q: 'Which planet is famous for its prominent rings?',
        choices: ['Mars', 'Venus', 'Saturn'], answer: 2 },
      { q: 'What does a prism do to white light?',
        choices: ['Splits it into colors', 'Makes it brighter', 'Stops it completely'], answer: 0 }
    ]
  };

  var KNOWN_TYPES = {
    aurora_storm: 1, gem_rain: 1, signal_surge: 1,
    trivia_transmission: 1, pantheon_whisper: 1
  };

  var CC = null;
  var pack = DEFAULT_PACK;
  var timers = [];
  var els = null;

  // aurora storm state
  var stormDur = 0, stormLeft = 0, elapsed = 0, sparkleWas = false;

  // trivia state
  var triviaOpen = false, triviaQ = null, triviaDone = false, triviaTimer = 0, triviaReward = 3;
  var asked = [];

  var bannerTimer = null, flashTimer = null;

  // ----------------------------------------------------------
  // pack loading + scheduling
  // ----------------------------------------------------------
  function validatePack(js) {
    if (!js || typeof js !== 'object') return null;
    var out = { events: [], trivia: [] };
    var evs = Array.isArray(js.events) ? js.events : [];
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e && KNOWN_TYPES[e.type] && typeof e.interval === 'number' && e.interval >= 15)
        out.events.push({
          type: e.type,
          interval: e.interval,
          time_of_day: e.time_of_day || null,
          params: e.params || {}
        });
    }
    var tr = Array.isArray(js.trivia) ? js.trivia : [];
    for (var j = 0; j < tr.length; j++) {
      var t = tr[j];
      if (t && typeof t.q === 'string' && Array.isArray(t.choices) &&
          t.choices.length >= 2 && t.choices.length <= 4 &&
          typeof t.answer === 'number' && t.answer >= 0 && t.answer < t.choices.length)
        out.trivia.push(t);
    }
    if (!out.events.length) out.events = DEFAULT_PACK.events;
    if (out.trivia.length < 3) out.trivia = DEFAULT_PACK.trivia;
    return out;
  }

  function schedule() {
    timers = [];
    for (var i = 0; i < pack.events.length; i++) {
      var def = pack.events[i];
      // stagger the first firings so events don't pile up
      timers.push({ def: def, t: def.interval * (0.35 + 0.18 * i) });
    }
  }

  function loadPack() {
    if (typeof fetch !== 'function') return;
    fetch('npc_packs/events.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (js) {
        var v = validatePack(js);
        if (v) { pack = v; schedule(); }
      })
      .catch(function () { /* keep embedded defaults */ });
  }

  // ----------------------------------------------------------
  // event runners
  // ----------------------------------------------------------
  function timeOk(def, day) {
    if (def.time_of_day === 'night') return day < 0.35;
    if (def.time_of_day === 'day') return day > 0.5;
    return true;
  }

  function flash() {
    els.flash.classList.add('on');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { els.flash.classList.remove('on'); }, 600);
  }

  function banner(name, line) {
    els.banner.innerHTML = '<span class="banner-sigil">&#9670;</span> <span class="banner-name">' +
      name + '</span> &mdash; <span class="banner-line"></span>';
    els.banner.querySelector('.banner-line').textContent = line;
    els.banner.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { els.banner.classList.remove('show'); }, 7000);
  }

  function runAuroraStorm(params) {
    stormDur = Math.max(6, Math.min(45, params.duration || 20));
    stormLeft = stormDur;
    CC.toast('◆ AURORA STORM — the ribbons remember something ◆');
  }

  function runGemRain(params) {
    var count = Math.max(1, Math.min(8, params.count || 4));
    var islands = CC.world.islands || [];
    if (!islands.length) return;
    var placed = 0;
    for (var tries = 0; tries < count * 4 && placed < count; tries++) {
      var isl = islands[Math.floor(Math.random() * islands.length)];
      var rx = isl.x + Math.round((Math.random() * 2 - 1) * isl.R * 0.6);
      var rz = isl.z + Math.round((Math.random() * 2 - 1) * isl.R * 0.6);
      var ty = CC.findTop(rx, rz, isl.y);
      if (ty < -20) continue;
      if (CC.world.get(rx, ty + 1, rz) !== 0) continue;
      CC.world.set(rx, ty + 1, rz, Math.random() < 0.5 ? 4 : 3);
      CC.rebuildAround(rx, ty + 1, rz);
      placed++;
    }
    if (placed > 0) CC.toast('gem rain — the sky pays its tithe (' + placed + ' fell)');
  }

  function runSignalSurge() {
    CC.setSignal(100);
    flash();
    CC.toast('◆ SIGNAL SURGE — integrity restored by an unseen hand ◆');
  }

  function runWhisper() {
    if (!window.CosmosNPCs) return;
    var w = window.CosmosNPCs.getWhisper();
    if (w) banner(w.name, w.line);
  }

  function pickTrivia() {
    if (asked.length >= pack.trivia.length) asked = [];
    for (var tries = 0; tries < 20; tries++) {
      var i = Math.floor(Math.random() * pack.trivia.length);
      if (asked.indexOf(i) === -1) { asked.push(i); return pack.trivia[i]; }
    }
    return pack.trivia[0];
  }

  function runTrivia(params) {
    if (triviaOpen || CC.modal) return;
    triviaQ = pickTrivia();
    if (!triviaQ) return;
    triviaReward = Math.max(1, Math.min(10, params.reward || 3));
    triviaOpen = true;
    triviaDone = false;
    triviaTimer = 16;
    CC.setModal('trivia');
    els.triviaQ.textContent = triviaQ.q;
    els.triviaChoices.innerHTML = '';
    for (var i = 0; i < triviaQ.choices.length; i++) {
      var row = document.createElement('div');
      row.className = 'npc-choice';
      row.innerHTML = '<span class="key">' + (i + 1) + '</span>' + triviaQ.choices[i];
      els.triviaChoices.appendChild(row);
    }
    els.triviaHint.textContent = 'answer with 1–' + triviaQ.choices.length +
      ' · the signal rewards precision';
    els.trivia.classList.remove('hidden');
  }

  function resolveTrivia(idx) {
    if (!triviaOpen || triviaDone) return;
    triviaDone = true;
    var rows = els.triviaChoices.children;
    if (rows[triviaQ.answer]) rows[triviaQ.answer].classList.add('correct');
    if (idx === triviaQ.answer) {
      CC.addGems(triviaReward);
      flash();
      els.triviaHint.textContent = '◆ CORRECT — +' + triviaReward + ' gems banked ◆';
    } else {
      if (rows[idx]) rows[idx].classList.add('wrong');
      els.triviaHint.textContent = 'the signal notes your optimism — no gems this time';
    }
    setTimeout(closeTrivia, 2400);
  }

  function closeTrivia() {
    if (!triviaOpen) return;
    triviaOpen = false;
    triviaQ = null;
    els.trivia.classList.add('hidden');
    if (CC && CC.modal === 'trivia') CC.setModal(null);
  }

  function runEvent(def) {
    switch (def.type) {
      case 'aurora_storm':        runAuroraStorm(def.params); break;
      case 'gem_rain':            runGemRain(def.params); break;
      case 'signal_surge':        runSignalSurge(); break;
      case 'trivia_transmission': runTrivia(def.params); break;
      case 'pantheon_whisper':    runWhisper(); break;
    }
  }

  // ----------------------------------------------------------
  // per-frame update (called from main loop)
  // ----------------------------------------------------------
  function update(dt, day, active) {
    if (!CC) return;
    elapsed += dt;

    // aurora storm envelope → sky shader + gem sparkle
    if (stormLeft > 0) {
      stormLeft -= dt;
      var prog = 1 - Math.max(0, stormLeft) / stormDur;
      var env = Math.sin(Math.PI * Math.min(1, prog));
      CC.skyUniforms.uStorm.value = env;
      var sparkle = 1 + env * 0.45 * (0.55 + 0.45 * Math.sin(elapsed * 9.0));
      CC.glowMat.color.setRGB(sparkle, sparkle, sparkle * 0.94);
      sparkleWas = true;
    } else if (sparkleWas) {
      CC.skyUniforms.uStorm.value = 0;
      CC.glowMat.color.setRGB(1, 1, 1);
      sparkleWas = false;
    }

    // trivia timeout
    if (triviaOpen && !triviaDone) {
      triviaTimer -= dt;
      if (triviaTimer <= 0) {
        els.triviaHint.textContent = 'transmission lost — the question returns to the aurora';
        triviaDone = true;
        setTimeout(closeTrivia, 1800);
      }
    }

    if (!active) return;

    // interval scheduler
    for (var i = 0; i < timers.length; i++) {
      var tm = timers[i];
      tm.t -= dt;
      if (tm.t > 0) continue;
      if (!timeOk(tm.def, day) || (tm.def.type === 'trivia_transmission' && CC.modal)) {
        tm.t = 10; // wrong window — retry shortly
        continue;
      }
      runEvent(tm.def);
      tm.t = tm.def.interval;
    }
  }

  function onKeyDown(e) {
    if (!triviaOpen || triviaDone || !triviaQ) return;
    var num = parseInt(e.key, 10);
    if (num >= 1 && num <= triviaQ.choices.length) resolveTrivia(num - 1);
  }

  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------
  function init(cc) {
    CC = cc;
    els = {
      trivia:        document.getElementById('trivia'),
      triviaQ:       document.getElementById('trivia-q'),
      triviaChoices: document.getElementById('trivia-choices'),
      triviaHint:    document.getElementById('trivia-hint'),
      banner:        document.getElementById('banner'),
      flash:         document.getElementById('flash')
    };
    document.addEventListener('keydown', onKeyDown);
    schedule();
    loadPack();
  }

  return {
    init: init,
    update: update,
    closeTrivia: closeTrivia
  };
})();
