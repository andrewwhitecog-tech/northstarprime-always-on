/**
 * AETHERIA MUSICA UNIVERSALIS SOUND ENGINE
 * Web Audio API synthesizer translating planetary positions and aspects into 432Hz harmonic drones.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AetheriaAudio = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Cousto Cosmic Octave planetary fundamental frequencies (Hz)
  const PLANET_FREQS = {
    Sun: 126.22,
    Moon: 210.42,
    Mercury: 141.27,
    Venus: 221.23,
    Mars: 144.72,
    Jupiter: 183.58,
    Saturn: 147.85,
    Uranus: 207.36,
    Neptune: 211.44,
    Pluto: 140.25
  };

  let audioCtx = null;
  let masterGain = null;
  let activeNodes = [];
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return true;
  }

  function stopHarmonics() {
    if (!audioCtx) return;
    activeNodes.forEach(node => {
      try {
        node.gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
        setTimeout(() => {
          try { node.osc.stop(); node.osc.disconnect(); } catch (e) {}
        }, 900);
      } catch (e) {}
    });
    activeNodes = [];
  }

  // Play a harmonic chime when an aspect or planet is hovered
  function playAspectChime(aspectType = 'Trine', freq = 432) {
    if (isMuted || !initAudio()) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    let targetFreq = freq;
    if (aspectType === 'Trine') targetFreq *= 1.25; // Major 3rd ratio
    else if (aspectType === 'Sextile') targetFreq *= 1.333; // 4th
    else if (aspectType === 'Conjunction') targetFreq *= 1.5; // 5th
    else if (aspectType === 'Opposition') targetFreq *= 2.0; // Octave

    osc.type = 'sine';
    osc.frequency.setValueAtTime(targetFreq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.3);
  }

  // Play ambient chord based on dominant planets in chart
  function playSpheresChord(chartData) {
    if (isMuted || !initAudio()) return;
    stopHarmonics();

    const planets = chartData.planets;
    const selected = ['Sun', 'Moon', 'Saturn', 'Jupiter'];

    selected.forEach((pName, idx) => {
      const baseFreq = PLANET_FREQS[pName] || 216;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * (idx === 0 ? 1 : (idx === 1 ? 1.5 : 2)), audioCtx.currentTime);

      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04 / (idx + 1), audioCtx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start();
      activeNodes.push({ osc, gain });
    });
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
      stopHarmonics();
    }
    return isMuted;
  }

  return {
    initAudio,
    playAspectChime,
    playSpheresChord,
    stopHarmonics,
    toggleMute,
    getIsMuted: () => isMuted
  };
}));
