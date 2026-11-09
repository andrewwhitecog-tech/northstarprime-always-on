/* HQ audio player for the NorthStar arcade (Claude, 2026-10-16).
   Source: F:\NORTHSTAR_OS\Projects\ITCH_RELEASES\shared\hq_audio.js (the itch.io builds of VORATH Delve and Prism Drift),
   with three additions for the site: a per-game `base` folder, a pause while the tab is hidden, and play counts in status().
   Plays audio FILES only: ElevenLabs sound effects and one Suno music track per game, kept in /static/games/hq/<game>/.
   Nothing is synthesized (Andrew's rule, 2026-10-16: only HQ Suno / ElevenLabs / custom generated audio, never procedural 8-bit).
   A file that fails to load is skipped quietly, so a game never breaks without sound.

   opts = { base: '/static/games/hq/<game>/', files: {key: [file names without .mp3/.wav]}, vol: {key: gain},
            loops: {key: true} (looped beds), music: 'music' (streams music.mp3), tracks: [names setMusic may load],
            musicVol: 0.4, master: 0.8,
            muteKey: 'localStorage key' }
   API: unlock, pause, resume, play(key, {rate, vol, limit, pan}), stop(key), loop, music(on), rewindMusic, stopMusic, setMusic(name, vol, resume), hasTrack(name), setLevels({sfx, music}),
        toggle (mute), isMuted, isPlayingMusic, status. */
function HQAudio(opts) {
  const base = opts.base || 'audio/';
  const loopKeys = opts.loops || {};
  let ctx = null, master = null, limiter = null, muted = false, paused = false;
  let musicEl = null, musicGain = null, musicFilter = null, musicWanted = false, loadedName = null, switching = false, noWebAudio = false;
  try { muted = localStorage.getItem(opts.muteKey) === '1'; } catch (e) {}
  const buf = {}, last = {}, loops = {}, played = {}, positions = {};
  const masterVol = opts.master == null ? 0.8 : opts.master;
  let musicVol = opts.musicVol == null ? 0.4 : opts.musicVol;
  let sfxLevel = 1, musicLevel = 1, musicName = opts.music || null;   // a game's own sliders scale these (setLevels)

  function keyOf(name) { for (const k in opts.files) if (opts.files[k].indexOf(name) >= 0) return k; return ''; }
  // Loops are MP3 too: Chromium and Firefox honour the LAME gapless header, so the seam is sample-exact (measured
  // 2026-10-16: a 4 s loop decoded to the same 176,399 samples as its WAV). opts.loopExt can force '.wav'.
  function url(name) { return base + name + (loopKeys[keyOf(name)] ? (opts.loopExt || '.mp3') : '.mp3'); }
  // The files' bytes are fetched as soon as the player starts (fetching needs no gesture; low priority, so the page's
  // own pictures come first), and the first gesture only has to decode them. Before this, a launch or first shot in
  // the first second after the first key could be silent while 40-90 files were still downloading (play-test
  // 2026-10-17).
  const bytes = {};
  function fetchBytes(name, low) {
    if (!bytes[name]) {
      bytes[name] = fetch(url(name), low ? { priority: 'low' } : undefined)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      bytes[name].catch(() => {});
    }
    return bytes[name];
  }
  setTimeout(() => { for (const k in opts.files) opts.files[k].forEach(n => fetchBytes(n, true)); }, 0);
  function load(name) {
    if (name in buf) return;
    buf[name] = null;                                  // null = still loading, false = failed, AudioBuffer = ready
    fetchBytes(name)
      .then(a => { delete bytes[name]; return a; })   // decoding detaches the bytes; keep no reference to them
      .then(a => new Promise((res, rej) => {           // callback form also works in older Safari
        const p = ctx.decodeAudioData(a, res, rej);
        if (p && p.catch) p.catch(() => {});           // newer browsers also return a promise; keep its rejection quiet
      }))
      .then(b => {
        buf[name] = b; const k = keyOf(name);
        if (loops[k] && loops[k].level > 0) loop(k, loops[k].level, loops[k].rate);
        // A cue asked for while its file was still decoding (the first gesture unlocks AND plays) sounds now, if still fresh.
        const p = pending[k]; if (p) { delete pending[k]; if (performance.now() - p.t < 800 && !document.hidden && !paused) voice(k, b, p.o); }
      })
      .catch(() => { buf[name] = false; });
  }
  function limit(key, ms) { const n = performance.now(); if (last[key] && n - last[key] < ms) return false; last[key] = n; return true; }
  function pick(key) {   // a take that decoded; else one still loading (the pending path); never one that failed
    const list = opts.files[key] || [], ready = list.filter(n => buf[n]), pool = ready.length ? ready : list.filter(n => buf[n] !== false);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  const pending = {};

  function play(key, o) {
    o = o || {};
    if (!ctx || !master) return;
    if (document.hidden || paused) return;   // do not queue cues while the game or tab is paused
    if (o.limit && !limit(key, o.limit)) return;
    const name = pick(key), b = name && buf[name];
    if (!b) {   // still loading: keep the latest request; a take of this cue that finishes decoding plays it
      if (name && buf[name] === null) pending[key] = { o, t: performance.now() };
      return;
    }
    voice(key, b, o);
  }
  function voice(key, b, o) {
    if (paused || document.hidden) return;
    const s = ctx.createBufferSource(); s.buffer = b;
    if (o.rate) s.playbackRate.value = o.rate;
    const g = ctx.createGain();
    g.gain.value = (opts.vol && opts.vol[key] != null ? opts.vol[key] : 1) * (o.vol == null ? 1 : o.vol) * sfxLevel;
    s.connect(g);
    let pn = null;
    if (o.pan && ctx.createStereoPanner) {   // -1 left .. 1 right (a flipper, a spawn edge)
      pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(pn); pn.connect(master);
    } else g.connect(master);
    s.start();
    const v = { s, g }, set = voices[key] || (voices[key] = new Set()); set.add(v);
    s.onended = () => { set.delete(v); s.disconnect(); g.disconnect(); if (pn) pn.disconnect(); };   // free finished voices
    played[key] = (played[key] || 0) + 1;
  }
  const voices = {};
  // Lifecycle boundary: a late decode or a resumed context must not replay an old hit.
  function clearPendingAndVoices() {
    for (const k in pending) delete pending[k];
    for (const k in voices) { voices[k].forEach(v => { try { v.s.stop(); } catch (e) {} v.s.disconnect(); v.g.disconnect(); }); voices[k].clear(); }
  }
  // Cut a cue that is still sounding (e.g. a long charge-up when the run ends): a 60 ms fade to silence, then stop.
  function stop(key) {
    delete pending[key];   // a cut cue must not sound later when its file finishes loading
    const set = voices[key]; if (!set || !ctx) return;
    const t = ctx.currentTime;
    set.forEach(v => { try {
      v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + 0.06);
      v.s.stop(t + 0.07);
    } catch (e) {} });
  }

  // A looped file whose level (0..1, times its vol) and playback rate can follow the game. Starts once decoded.
  function loop(key, level, rate) {
    let L = loops[key] || (loops[key] = { level: 0, rate: 1, src: null, gain: null });
    L.level = level; L.rate = rate || 1;
    if (!ctx || !master || paused || document.hidden) return;
    if (!L.src) {
      if (!(level > 0)) return;   // nothing to turn down yet: don't start a silent source
      const name = pick(key), b = name && buf[name];
      if (!b) return;
      L.src = ctx.createBufferSource(); L.src.buffer = b; L.src.loop = true;
      L.gain = ctx.createGain(); L.gain.gain.value = 0;
      L.src.connect(L.gain); L.gain.connect(master); L.src.start();
    }
    const t = ctx.currentTime, v = (opts.vol && opts.vol[key] != null ? opts.vol[key] : 1) * level * sfxLevel;
    L.gain.gain.cancelScheduledValues(t); L.gain.gain.setTargetAtTime(v, t, 0.25);
    L.src.playbackRate.cancelScheduledValues(t); L.src.playbackRate.setTargetAtTime(L.rate, t, 0.12);
  }

  function ensureMusic() {
    if (musicEl || !musicName || (!ctx && !noWebAudio)) return;   // wait for unlock, unless this browser has no Web Audio
    // createElement, not new Audio(): a game script may shadow the global Audio name.
    musicEl = document.createElement('audio'); musicEl.crossOrigin = 'anonymous'; musicEl.src = base + musicName + '.mp3'; musicEl.loop = true; musicEl.preload = 'auto';
    loadedName = musicName;
    if (!ctx) { musicEl.volume = musicVol * musicLevel; musicEl.muted = muted; return; }   // no Web Audio: plain element
    try {   // through Web Audio, so mute and the depth filter apply to it
      const src = ctx.createMediaElementSource(musicEl);
      musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000;
      musicGain = ctx.createGain(); musicGain.gain.value = musicVol * musicLevel;
      src.connect(musicFilter); musicFilter.connect(musicGain); musicGain.connect(master);
    } catch (e) { musicGain = null; musicFilter = null; musicEl.volume = musicVol * musicLevel; musicEl.muted = muted; }
  }

  // A hidden tab goes quiet and comes back where it was (the game's own pause, if any, still decides the music).
  let hiddenPausedMusic = false;
  document.addEventListener('visibilitychange', () => {
    if (!ctx && !musicEl) return;   // nothing started yet (without Web Audio, the plain music element still pauses)
    if (document.hidden) {
      clearPendingAndVoices();
      hiddenPausedMusic = !!(musicEl && !musicEl.paused);
      if (hiddenPausedMusic) musicEl.pause();
      if (ctx) ctx.suspend().catch(() => {});
    } else {
      if (paused) { hiddenPausedMusic = false; return; }
      if (ctx) ctx.resume().catch(() => {});
      if (hiddenPausedMusic && musicWanted && musicEl) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
      hiddenPausedMusic = false;
    }
  });

  const api = {
    unlock() {
      if (paused || document.hidden) return;
      if (ctx) {
        if (document.hidden) return;
        if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});   // 'suspended', or iOS 'interrupted'
        // music asked for before the page had a real activation (a touchstart is not one) was refused: start it now
        if (musicWanted && musicEl && musicEl.paused && !switching) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
        return;
      }
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {
        ctx = null; noWebAudio = true; ensureMusic();   // no Web Audio: effects stay silent, music still plays
        if (musicWanted && musicEl) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
        return;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});   // outside a gesture it may refuse; the next key or click retries
      master = ctx.createGain(); master.gain.value = muted ? 0 : masterVol;
      // Safety limiter (Grok's review, 2026-10-16): several loud cues starting together could sum past full scale.
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 20;
      limiter.attack.value = 0.002; limiter.release.value = 0.12;
      master.connect(limiter); limiter.connect(ctx.destination);
      for (const k in opts.files) opts.files[k].forEach(load);
      ensureMusic();
      if (musicWanted && musicEl) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }   // asked for before unlock
    },
    play, loop, stop,
    pause() {
      paused = true; clearPendingAndVoices();
      for (const k in loops) { const L = loops[k]; if (L.src) { try { L.src.stop(); } catch (e) {} L.src.disconnect(); L.gain.disconnect(); L.src = null; L.gain = null; } }
      if (musicEl) musicEl.pause();
      if (ctx && ctx.state !== "closed") ctx.suspend().catch(() => {});
    },
    resume() {
      if (document.hidden) return;
      paused = false; api.unlock();
      for (const k in loops) if (loops[k].level > 0) loop(k, loops[k].level, loops[k].rate);
    },
    music(on) {
      musicWanted = !!on;
      ensureMusic(); if (!musicEl) return;
      if (on && !paused && !document.hidden) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); } else musicEl.pause();
    },
    rewindMusic() { if (musicEl && !switching) { try { musicEl.currentTime = 0; } catch (e) {} } },   // a pending switch starts from the top
    stopMusic() { api.music(false); api.rewindMusic(); },
    // Another track for the same player (title / gameplay / boss, or one per tier). It starts from the top, or with
    // resume=true where that track was left (back to peace after a raid); when music is playing the old track fades
    // out over a quarter second and the new one fades in.
    setMusic(name, vol, resume) {
      if (vol != null) musicVol = vol;
      if (opts.tracks && opts.tracks.indexOf(name) < 0) return;   // that state's track was not made: keep the current one
      if (name === musicName && musicEl) { if (musicGain) musicGain.gain.value = musicVol * musicLevel; else musicEl.volume = musicVol * musicLevel; return; }
      if (musicEl && loadedName && !switching) { try { positions[loadedName] = musicEl.currentTime; } catch (e) {} }
      musicName = name;
      if (!musicEl) return;
      const swap = () => {
        if (musicName !== name) return;          // a newer switch won
        switching = false;
        const wasOn = musicWanted, at = resume ? (positions[name] || 0) : 0;
        musicEl.pause(); musicEl.src = base + name + '.mp3'; loadedName = name; try { musicEl.currentTime = 0; } catch (e) {}
        if (at > 0) musicEl.addEventListener('loadedmetadata', () => {
          try { musicEl.currentTime = musicEl.duration ? at % musicEl.duration : at; } catch (e) {} }, { once: true });
        if (musicGain && ctx) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setValueAtTime(0, ctx.currentTime);
                                musicGain.gain.setTargetAtTime(musicVol * musicLevel, ctx.currentTime, 0.12); }
        else musicEl.volume = musicVol * musicLevel;
        if (wasOn && !paused && !document.hidden) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
      };
      if (musicGain && ctx && !musicEl.paused) { switching = true; musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06); setTimeout(swap, 260); }
      else swap();
    },
    // A game's own volume sliders (0..1): sfx scales every effect, music scales the track.
    setLevels(l) {
      if (l.sfx != null) {
        sfxLevel = Math.max(0, Math.min(1, l.sfx));
        for (const k in loops) if (loops[k].src) loop(k, loops[k].level, loops[k].rate);   // retarget beds sounding now
      }
      if (l.music != null) musicLevel = Math.max(0, Math.min(1, l.music));
      if (musicGain && ctx) musicGain.gain.setTargetAtTime(musicVol * musicLevel, ctx.currentTime, 0.05);
      else if (musicEl) musicEl.volume = musicVol * musicLevel;
    },
    musicTone(cutoffHz) { if (musicFilter && ctx) { const t = ctx.currentTime; musicFilter.frequency.cancelScheduledValues(t); musicFilter.frequency.setTargetAtTime(cutoffHz, t, 1.0); } },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(opts.muteKey, muted ? '1' : '0'); } catch (e) {}
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : masterVol, ctx.currentTime, 0.05);
      if (musicEl && !musicGain) musicEl.muted = muted;
      return muted;
    },
    isMuted() { return muted; },
    loaded() { return Object.keys(buf).filter(n => buf[n]).length; },
    isPlayingMusic() { return !!(musicEl && !musicEl.paused); },
    hasTrack(name) { return !opts.tracks || opts.tracks.indexOf(name) >= 0; },   // was this state's track made?
    status() {   // for play-testers: what is decoded and what is actually sounding
      return { context: ctx ? ctx.state : 'none', paused, activeVoices: Object.values(voices).reduce((n, set) => n + set.size, 0), pendingCues: Object.keys(pending), decoded: Object.keys(buf).filter(n => buf[n]),
               loading: Object.keys(buf).filter(n => buf[n] === null), failed: Object.keys(buf).filter(n => buf[n] === false),
               limiter: !!limiter, loopsPlaying: Object.keys(loops).filter(k => loops[k].src && loops[k].level > 0),
               loopLevels: Object.fromEntries(Object.keys(loops).map(k => [k, Math.round(loops[k].level * 100) / 100])),
               music: musicEl ? (musicEl.error ? 'error ' + musicEl.error.code : musicEl.paused ? 'paused' : 'playing') : 'none',
               musicTime: musicEl ? Math.round(musicEl.currentTime * 10) / 10 : null,
               muted, played: Object.assign({}, played), musicName };
    }
  };
  (window.__HQ_AUDIO__ = window.__HQ_AUDIO__ || []).push(api);   // play-test hook: window.__HQ_AUDIO__[0].status()
  return api;
}
