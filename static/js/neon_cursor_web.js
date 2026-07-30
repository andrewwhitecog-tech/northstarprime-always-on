/* NSP NEON CURSOR — the desktop experience, for every visitor.
   Rainbow-cycling reticle (inner/outer always complementary), ribbon trail,
   energize click bursts, Trek click sounds. Guards: fine pointers only,
   honors prefers-reduced-motion, sound is user-toggleable (persisted). */
(function () {
  'use strict';
  if (!window.matchMedia('(pointer: fine)').matches) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
  document.documentElement.appendChild(cv);
  var ctx = cv.getContext('2d');
  var W, H;
  function fit() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  fit(); addEventListener('resize', fit);

  // hide the native cursor — the reticle IS the cursor
  var style = document.createElement('style');
  style.textContent = 'html,body,a,button,input,textarea,select,label{cursor:none !important}';
  document.head.appendChild(style);

  var mx = -100, my = -100, hue = 0, trail = [], sparks = [], shocks = [];
  addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (!reduced) {
      trail.unshift([mx, my, 0]);
      if (trail.length > 24) trail.pop();
      hue = (hue + 0.02) % 1;
    }
  }, { passive: true });
  addEventListener('mouseleave', function () { mx = my = -100; });

  // ---- sound: Trek click set, toggleable ----
  var soundOn = localStorage.getItem('nsp_click_sfx') !== 'off';
  var actx = null, buffers = [], si = 0;
  var SFX = ['/static/sfx/trek_panel_click.wav', '/static/sfx/trek_comm_click.wav', '/static/sfx/trek_warp_click.wav', '/static/sfx/codex_c_lock_click.wav'];
  function initAudio() {
    if (actx || !soundOn) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      SFX.forEach(function (u, i) {
        fetch(u).then(function (r) { return r.arrayBuffer(); })
          .then(function (b) { return actx.decodeAudioData(b); })
          .then(function (buf) { buffers[i] = buf; }).catch(function () {});
      });
    } catch (e) {}
  }
  function ping() {
    if (!soundOn || !actx || !buffers.length) return;
    var buf = buffers[si++ % buffers.length];
    if (!buf) return;
    var src = actx.createBufferSource();
    var gain = actx.createGain();
    gain.gain.value = 0.35;
    src.buffer = buf; src.connect(gain); gain.connect(actx.destination);
    src.start();
  }
  // tiny toggle chip
  var chip = document.createElement('button');
  chip.textContent = soundOn ? '🔊' : '🔇';
  chip.title = 'NSP click sounds';
  chip.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;width:34px;height:34px;' +
    'border-radius:50%;border:1px solid rgba(0,229,255,.5);background:rgba(6,10,20,.75);color:#7df;' +
    'font-size:15px;opacity:.55;cursor:none';
  chip.onmouseenter = function () { chip.style.opacity = '1'; };
  chip.onmouseleave = function () { chip.style.opacity = '.55'; };
  chip.onclick = function (e) {
    e.stopPropagation();
    soundOn = !soundOn;
    localStorage.setItem('nsp_click_sfx', soundOn ? 'on' : 'off');
    chip.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) initAudio();
  };
  (document.body || document.documentElement).appendChild(chip);

  addEventListener('pointerdown', function (e) {
    initAudio();
    ping();
    if (reduced) return;
    var h = Math.random();
    for (var k = 0; k < 14; k++) {
      var a = k * (6.283 / 14) + (Math.random() - 0.5) * 0.15;
      var v = 5 + Math.random() * 6;
      sparks.push([e.clientX, e.clientY, Math.cos(a) * v, Math.sin(a) * v, (h + Math.random() * 0.1) % 1, 0]);
    }
    shocks.push([e.clientX, e.clientY, 0, h]);
  }, { passive: true });

  function hsl(h, l) { return 'hsl(' + Math.round(h * 360) + ',100%,' + (l || 60) + '%)'; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // ribbon trail
    for (var i = 1; i < trail.length; i++) {
      var p1 = trail[i], p2 = trail[i - 1];
      var fr = 1 - i / trail.length;
      ctx.strokeStyle = hsl(hue - i * 0.02, 60);
      ctx.globalAlpha = 0.28 * fr;
      ctx.lineWidth = 10 * fr + 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.globalAlpha = 0.9 * fr;
      ctx.lineWidth = 7 * fr;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (var t = 0; t < trail.length; t++) trail[t][2]++;
    while (trail.length && trail[trail.length - 1][2] > 26) trail.pop();
    // sparks
    var live = [];
    for (var s = 0; s < sparks.length; s++) {
      var p = sparks[s];
      p[0] += p[2]; p[1] += p[3]; p[3] += 0.3; p[5]++;
      if (p[5] < 30) {
        live.push(p);
        var f2 = 1 - p[5] / 30;
        ctx.strokeStyle = hsl(p[4], 62);
        ctx.globalAlpha = f2;
        ctx.lineWidth = Math.max(1, 3 * f2);
        ctx.beginPath(); ctx.moveTo(p[0] - p[2] * 2, p[1] - p[3] * 2); ctx.lineTo(p[0], p[1]); ctx.stroke();
      }
    }
    sparks = live;
    ctx.globalAlpha = 1;
    // shockwaves: rotating reticle echoes
    var ls = [];
    for (var q = 0; q < shocks.length; q++) {
      var sh = shocks[q];
      sh[2]++;
      if (sh[2] < 20) {
        ls.push(sh);
        var fs = 1 - sh[2] / 20;
        var rad = 8 + sh[2] * 4.5;
        var rot = sh[2] * 0.2;
        ctx.strokeStyle = hsl(sh[3], 60);
        ctx.globalAlpha = fs;
        ctx.lineWidth = Math.max(1, 3 * fs);
        for (var a0 = 0; a0 < 4; a0++) {
          ctx.beginPath();
          ctx.arc(sh[0], sh[1], rad, rot + a0 * 1.5708, rot + a0 * 1.5708 + 0.96);
          ctx.stroke();
        }
      }
    }
    shocks = ls;
    ctx.globalAlpha = 1;
    // the reticle itself — outer ring + inner crosshair, always complementary
    if (mx > -50) {
      var oh = (performance.now() * 0.00008) % 1;
      var ih = (oh + 0.5) % 1;
      var R = 15;
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = hsl(oh, 62);
      for (var g0 = 0; g0 < 4; g0++) {
        ctx.beginPath();
        ctx.arc(mx, my, R, g0 * 1.5708 + 0.35, g0 * 1.5708 + 1.22);
        ctx.stroke();
      }
      for (var tk = 0; tk < 4; tk++) {
        var ta = tk * 1.5708;
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(ta) * (R - 2), my + Math.sin(ta) * (R - 2));
        ctx.lineTo(mx + Math.cos(ta) * (R + 4), my + Math.sin(ta) * (R + 4));
        ctx.stroke();
      }
      ctx.strokeStyle = hsl(ih, 62);
      ctx.lineWidth = 1.8;
      for (var cx0 = 0; cx0 < 4; cx0++) {
        var ca = cx0 * 1.5708;
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(ca) * 4, my + Math.sin(ca) * 4);
        ctx.lineTo(mx + Math.cos(ca) * 9, my + Math.sin(ca) * 9);
        ctx.stroke();
      }
      ctx.fillStyle = hsl(ih, 62);
      ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, 6.284); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
