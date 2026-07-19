/* ============================================================
   CUBIC COSMOS · tripday.js — PRISM DRIFT DAYS
   Rare days when the aurora ferments: the sky turns rainbow
   cotton candy, colors rotate, straight lines bend and wave,
   gravity loosens, and the world narrates itself strangely.

   - ~15% chance at each dawn (deterministic per day index),
     lasts until the next dawn, ramps in/out smoothly.
   - Manual: CosmosTrip.start() / CosmosTrip.stop() in console.
   - Visuals: uTrip drives the sky's candy mix (main.js) plus
     injected shader code in BOTH chunk materials — vertex
     wave displacement (world-continuous, geometry actually
     bends) and hue rotation about the grey axis (Rodrigues).
   ============================================================ */
window.CosmosTrip = (function () {
  'use strict';

  var CC = null;
  var trip = 0, target = 0, active = false;
  var uTrip = { value: 0 }, uTripT = { value: 0 };
  var prevPhase = 0, dayIndex = 0, whisperTimer = 12;

  var WHISPERS = [
    'the geometry is breathing. it says hello.',
    'colors are currency today. spend them slowly.',
    'the horizon filed for a curve permit. approved.',
    'gravity is on break. gravity has earned it.',
    'the aurora fermented overnight. everyone stay calm and iridescent.',
    'straight lines have unionized. negotiations look wavy.',
    'the philosopher is lying in the plaza, laughing at the render distance.'
  ];

  function inject(mat) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTrip = uTrip;
      sh.uniforms.uTripT = uTripT;
      sh.vertexShader = 'uniform float uTrip;\nuniform float uTripT;\n' +
        sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n' +
          'transformed.x += sin(position.y * 0.55 + uTripT * 1.30 + position.z * 0.21) * uTrip * 0.30;\n' +
          'transformed.y += sin(position.x * 0.50 + uTripT * 1.10 + position.z * 0.35) * uTrip * 0.22;\n' +
          'transformed.z += cos(position.x * 0.33 + uTripT * 0.90 + position.y * 0.40) * uTrip * 0.30;');
      sh.fragmentShader = 'uniform float uTrip;\nuniform float uTripT;\n' +
        sh.fragmentShader.replace('#include <fog_fragment>',
          '#include <fog_fragment>\n' +
          'if (uTrip > 0.001) {\n' +
          '  float tAng = uTrip * uTripT * 0.55;\n' +
          '  vec3 tAx = vec3(0.57735);\n' +
          '  vec3 tC = gl_FragColor.rgb;\n' +
          '  float tCos = cos(tAng), tSin = sin(tAng);\n' +
          '  vec3 tRot = tC * tCos + cross(tAx, tC) * tSin + tAx * dot(tAx, tC) * (1.0 - tCos);\n' +
          '  gl_FragColor.rgb = clamp(mix(tC, tRot, uTrip), 0.0, 1.0);\n' +
          '}');
    };
    mat.needsUpdate = true;
  }

  function init(cc) {
    CC = cc;
    inject(CC.litMat);
    inject(CC.glowMat);
    prevPhase = CC.getPhase();
  }

  function rollDay(idx) {
    // deterministic pseudo-roll per day index
    var v = Math.abs(Math.sin(idx * 127.1 + 311.7));
    return (v % 1) < 0.15;
  }

  function start() {
    active = true; target = 1;
    if (CC) CC.toast('the aurora has fermented — PRISM DRIFT DAY. lines are optional.');
  }
  function stop() {
    active = false; target = 0;
    if (CC) CC.toast('the sky sobers. lines resume their posts. everyone pretends nothing happened.');
  }

  function update(dt) {
    if (!CC) return;
    var phase = CC.getPhase();
    if (phase < prevPhase - 0.5) {           // dawn wrap — a new day
      dayIndex++;
      if (rollDay(dayIndex)) start();
      else if (active) stop();
    }
    prevPhase = phase;

    trip += (target - trip) * Math.min(1, dt * 0.35);   // slow ramp in/out
    if (trip < 0.001 && target === 0) trip = 0;
    uTrip.value = trip;
    uTripT.value += dt * (0.6 + trip);
    CC.skyUniforms.uTrip.value = trip;

    if (trip > 0.2 && CC.isLocked()) {
      // gentle positional sway — the world works a little weird
      var p = CC.player;
      p.pos.x += Math.sin(uTripT.value * 0.9) * trip * 0.012;
      p.pos.z += Math.cos(uTripT.value * 0.7) * trip * 0.012;
      whisperTimer -= dt;
      if (whisperTimer <= 0) {
        whisperTimer = 18 + Math.random() * 20;
        CC.toast(WHISPERS[Math.floor(Math.random() * WHISPERS.length)]);
      }
    }
  }

  function gravityScale() { return 1 - 0.45 * trip; }

  return {
    init: init, update: update, start: start, stop: stop,
    gravityScale: gravityScale,
    get intensity() { return trip; },
    get active() { return active; }
  };
})();
