/**
 * AudioSynthesizer.js - Procedural Web Audio API Sound Engine
 * Zero audio asset dependencies; 100% synthesized in real time.
 * 
 * Directly binds to EventBus to render dynamic reactive soundscapes:
 * - Dynamic AI Director tension drone modulated by cutoff filters
 * - Crisp laser discharges, impact thuds, dash swooshes
 * - Medical ECG heartbeat telemetry & mechanical terminal clicks
 */

class AudioSynthesizer {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;

    // Ambient tension drone nodes
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneFilter = null;
    this.droneGain = null;
    this.isDroneRunning = false;

    this.setupListeners();
  }

  initAudioContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.startTensionDrone();
  }

  setupListeners() {
    if (!this.eventBus) return;

    this.eventBus.subscribe('WEAPON_FIRED', (payload) => {
      this.playLaserShot(payload.isEnemy);
    });

    this.eventBus.subscribe('ENTITY_DAMAGED', (payload) => {
      this.playHitImpact(payload.isEnemy);
    });

    this.eventBus.subscribe('PLAYER_DASH', () => {
      this.playDashWhoosh();
    });

    this.eventBus.subscribe('DIRECTOR_TENSION_UPDATE', (payload) => {
      this.updateDroneTension(payload.tension);
    });

    this.eventBus.subscribe('BARCODE_SCANNED', (payload) => {
      this.playBarcodeHeartbeat(payload.pulseStrength, payload.isFlatline);
    });

    this.eventBus.subscribe('TERMINAL_KEY', () => {
      this.playTerminalKey();
    });
  }

  startTensionDrone() {
    if (!this.ctx || this.isDroneRunning) return;

    const t = this.ctx.currentTime;

    // Dual sub-bass & atmospheric fifth (55Hz A1 and 82.4Hz E2)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.setValueAtTime(55, t);

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.setValueAtTime(82.4, t);

    // Dynamic Low-Pass filter controlled by AI Director tension
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(220, t);
    this.droneFilter.Q.setValueAtTime(4.0, t);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.12, t);

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
    this.isDroneRunning = true;
  }

  updateDroneTension(tension) {
    if (!this.ctx || !this.droneFilter) return;
    const t = this.ctx.currentTime;
    // Map tension (0.0 to 1.0) to cutoff frequency (160Hz quiet respite -> 2200Hz peak climax)
    const cutoff = 160 + Math.pow(tension, 1.8) * 2040;
    this.droneFilter.frequency.setTargetAtTime(cutoff, t, 0.4);
  }

  playLaserShot(isEnemy) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isEnemy ? 'sawtooth' : 'square';
    const startFreq = isEnemy ? 620 : 880;
    const endFreq = isEnemy ? 180 : 220;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);

    gain.gain.setValueAtTime(isEnemy ? 0.08 : 0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  playHitImpact(isEnemy) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Sub thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  playDashWhoosh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Synthesize noise buffer
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(240, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  playBarcodeHeartbeat(vitality, isFlatline) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (isFlatline) {
      // Continuous flatline tone (780 Hz)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(780, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.9);
      return;
    }

    // Classic double cardiac beep (lub-dub)
    const freq = 600 + vitality * 300;

    // Beep 1
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.frequency.setValueAtTime(freq, t);
    gain1.gain.setValueAtTime(0.18, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.09);

    // Beep 2 (higher frequency accent)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.frequency.setValueAtTime(freq * 1.25, t + 0.12);
    gain2.gain.setValueAtTime(0.22, t + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.12);
    osc2.stop(t + 0.23);
  }

  playTerminalKey() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800 + Math.random() * 400, t);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.035);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.25, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

// Export for ES modules and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioSynthesizer;
}
if (typeof window !== 'undefined') {
  window.AudioSynthesizer = AudioSynthesizer;
}
