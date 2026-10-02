/* chiptune.js — reusable NES-style audio engine for all Vorath arcade games.
 *
 * Why the 8-bit sound is so iconic despite being "simple":
 *  - The NES APU had only 5 voices: 2 PULSE (square) channels, 1 TRIANGLE (bass),
 *    1 NOISE (percussion/explosions), 1 DPCM (samples). Every sound had to be built
 *    from those primitives, which forced clarity — one memorable gesture per sound.
 *  - SFX are tiny PITCH GESTURES: a coin is two notes (a short blip + a higher held
 *    note). A jump is a single note bent UP. A stomp is a note bent DOWN + noise.
 *    Power-ups are FAST ASCENDING ARPEGGIOS. Death is a descending run.
 *  - Punchy ENVELOPES: near-instant attack, fast exponential decay = "snappy," cuts
 *    through the mix, never muddy.
 *  - Music: PULSE1 = melody, PULSE2 = harmony, TRIANGLE = walking bass, NOISE = snare.
 *    Short loops, syncopation, strong hooks.
 *
 * These are the *techniques* (waveforms, envelopes, arpeggios, sweeps) — the sounds
 * below are ORIGINAL Vorath sounds built with them, not clones of any game's melodies.
 */
(function (global) {
  let ctx = null, master = null;
  function AC() {
    if (!ctx) {
      try {
        ctx = new (global.AudioContext || global.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      } catch (e) {}
    }
    return ctx;
  }
  function resume() { const a = AC(); if (a && a.state === "suspended") a.resume(); }
  const F = n => 440 * Math.pow(2, (n - 69) / 12);   // midi note -> frequency

  // one pulse/triangle voice with a snappy envelope + optional pitch bend
  function tone(freq, t, dur, o) {
    o = o || {}; const a = AC(); if (!a) return;
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (o.bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * Math.pow(2, o.bend)), t + dur);
    else if (o.target) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.target), t + dur);
    const vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(t, dur, o) {
    o = o || {}; const a = AC(); if (!a) return;
    const buf = a.createBuffer(1, Math.max(1, (a.sampleRate * dur) | 0), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    const s = a.createBufferSource(); s.buffer = buf; const g = a.createGain(); g.gain.value = o.vol == null ? 0.2 : o.vol;
    if (o.lp) { const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; s.connect(f); f.connect(g); }
    else s.connect(g);
    g.connect(master); s.start(t);
  }
  const seq = (notes, t0, step, o) => notes.forEach((n, i) => { if (n != null) tone(F(n), t0 + i * step, (o && o.dur) || step * 0.9, o); });

  // ---- SFX presets (original sounds, 8-bit grammar) ----
  const SFX = {
    coin()    { const a = AC(); if (!a) return; const t = a.currentTime; tone(F(83), t, 0.07, { vol: 0.22 }); tone(F(90), t + 0.07, 0.5, { vol: 0.22 }); },
    jump()    { const a = AC(); if (!a) return; tone(F(69), a.currentTime, 0.17, { vol: 0.2, bend: 0.95 }); },
    bump()    { const a = AC(); if (!a) return; const t = a.currentTime; tone(F(57), t, 0.09, { vol: 0.2, bend: -0.5 }); noise(t, 0.05, { vol: 0.1 }); },
    stomp()   { const a = AC(); if (!a) return; const t = a.currentTime; tone(F(48), t, 0.13, { type: "triangle", vol: 0.3, bend: -1.1 }); noise(t, 0.12, { vol: 0.2, lp: 1800 }); },
    powerUp() { const a = AC(); if (!a) return; const t = a.currentTime; [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(F(n), t + i * 0.05, 0.09, { vol: 0.17 })); },
    oneUp()   { const a = AC(); if (!a) return; seq([76, 79, 84, 88, 91], a.currentTime, 0.11, { vol: 0.2, dur: 0.1 }); },
    shoot()   { const a = AC(); if (!a) return; const t = a.currentTime; tone(1200, t, 0.12, { vol: 0.15, target: 200 }); noise(t, 0.04, { vol: 0.07 }); },
    hit()     { const a = AC(); if (!a) return; const t = a.currentTime; tone(300, t, 0.1, { type: "sawtooth", vol: 0.2, target: 90 }); noise(t, 0.05, { vol: 0.13 }); },
    explode() { const a = AC(); if (!a) return; const t = a.currentTime; noise(t, 0.35, { vol: 0.28, lp: 2200 }); tone(120, t, 0.3, { type: "sawtooth", vol: 0.2, target: 40 }); },
    pop()     { const a = AC(); if (!a) return; const t = a.currentTime; tone(1400, t, 0.07, { type: "triangle", vol: 0.2, target: 500 }); noise(t, 0.05, { vol: 0.11 }); },
    hurt()    { const a = AC(); if (!a) return; seq([69, 66, 62], a.currentTime, 0.09, { vol: 0.2, dur: 0.12 }); },
    death()   { const a = AC(); if (!a) return; seq([71, 72, 67, 60, 64, 60, 57], a.currentTime, 0.13, { vol: 0.2, dur: 0.12 }); },
    gate()    { const a = AC(); if (!a) return; seq([60, 64, 67, 72], a.currentTime, 0.09, { type: "triangle", vol: 0.22, dur: 0.14 }); },
    blip()    { const a = AC(); if (!a) return; tone(880, a.currentTime, 0.05, { vol: 0.12 }); },
    reload()  { const a = AC(); if (!a) return; tone(300, a.currentTime, 0.14, { type: "triangle", vol: 0.12, bend: 1 }); },
    ko()      { const a = AC(); if (!a) return; const t = a.currentTime; tone(F(60), t, 0.5, { type: "sawtooth", vol: 0.24, target: 55 }); noise(t, 0.3, { vol: 0.2, lp: 1600 }); }
  };

  // ---- Music engine: pulse melody + triangle bass + noise snare, looped ----
  function Music(opt) {
    opt = opt || {}; const a = AC(); if (!a) return { stop() {} };
    const bus = a.createGain(); bus.gain.value = 0.0001; bus.connect(master);
    bus.gain.exponentialRampToValueAtTime((opt.vol || 0.5) * 0.18, a.currentTime + 2);
    const mel = opt.mel || [], bass = opt.bass || [], melType = opt.melType || "square";
    const step = 60 / (opt.bpm || 120) / 2; let i = 0;
    const timer = setInterval(() => {
      const t = a.currentTime + 0.03, m = mel[i % Math.max(1, mel.length)], b = bass[i % Math.max(1, bass.length)];
      if (m != null) { const o = a.createOscillator(), g = a.createGain(); o.type = melType; o.frequency.value = F(m); o.connect(g); g.connect(bus);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.9); o.start(t); o.stop(t + step); }
      if (b != null) { const o = a.createOscillator(), g = a.createGain(); o.type = "triangle"; o.frequency.value = F(b); o.connect(g); g.connect(bus);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.95); o.start(t); o.stop(t + step); }
      if (i % 2 === 0) { const nb = a.createBuffer(1, (a.sampleRate * 0.05) | 0, a.sampleRate), d = nb.getChannelData(0);
        for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, 3);
        const s = a.createBufferSource(); s.buffer = nb; const g = a.createGain(); g.gain.value = 0.05; s.connect(g); g.connect(bus); s.start(t); }
      i++;
    }, step * 1000);
    return { stop() { try { bus.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.8); } catch (e) {} clearInterval(timer); } };
  }

  global.Chiptune = { AC, resume, tone, noise, note: F, SFX, Music };
})(window);
