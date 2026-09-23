/**
 * BarcodeEntropyScanner.js - Procedural UPC / Barcode Entity Synthesizer
 * Inspired by the 90s SKANNERZ handheld mechanic (Saved IG reel Dcb3AWXhM65)
 * 
 * Ingests physical/digital barcode numbers or text seeds, runs deterministic
 * cryptographic entropy extraction, and simulates an ECG heartbeat detector
 * to synthesize procedural combat entities and weapon cores.
 */

class BarcodeEntropyScanner {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.history = [];
  }

  /**
   * Hashes an input string into a 32-bit unsigned integer using FNV-1a
   */
  hashString(str) {
    let hval = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hval ^= str.charCodeAt(i);
      hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    return hval >>> 0;
  }

  /**
   * Generates a deterministic pseudo-random float [0, 1) from state
   */
  prng(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * Synthesizes a full procedural entity from a barcode
   * @param {string} barcodeString 
   * @returns {Object} Full entity profile with ECG heartbeat data
   */
  scanBarcode(barcodeString) {
    const cleanCode = String(barcodeString).trim().toUpperCase();
    if (!cleanCode) return null;

    const hash = this.hashString(cleanCode);
    const rand = this.prng(hash);

    // Calculate pulse strength (vitality rating from 0.0 to 1.0)
    // UPC check digits or specific modulo patterns influence vitality
    const pulseStrength = parseFloat((0.25 + rand() * 0.75).toFixed(2));
    const isFlatline = pulseStrength < 0.28;

    // Rarity classification
    let rarity = 'COMMON';
    if (pulseStrength > 0.88) rarity = 'DIVINE_OVERCLOCK';
    else if (pulseStrength > 0.72) rarity = 'CYBER_RARE';
    else if (pulseStrength > 0.48) rarity = 'UNCOMMON';

    // Archetype selection
    const archetypes = [
      'VOID_PROWLER',       // Hyper-mobile flanking stalker
      'OBSIDIAN_SENTINEL',  // High-armor suppressive wall
      'PRISM_WRAITH',       // Camouflage burst assassin
      'CORONA_SERAPH',      // Area-denial barrage drone
      'CHRONO_TITAN'        // Boss-tier heavy disruptor
    ];
    const archetypeIndex = Math.floor(rand() * archetypes.length);
    const archetype = isFlatline ? 'DEFECTIVE_SCRAP' : archetypes[archetypeIndex];

    // Procedural combat modifiers derived from entropy
    const speed = Math.round(120 + rand() * 120);
    const health = Math.round(60 + rand() * 140 * (pulseStrength > 0.7 ? 1.5 : 1.0));
    const fireCooldown = parseFloat((0.15 + rand() * 0.4).toFixed(2));
    const damage = Math.round(8 + rand() * 14 * pulseStrength);

    // Color theme
    const hues = [190, 210, 280, 330, 45, 140];
    const baseHue = hues[Math.floor(rand() * hues.length)];
    const primaryColor = `hsl(${baseHue}, 90%, 55%)`;
    const glowColor = `hsla(${baseHue}, 95%, 65%, 0.4)`;

    // Synthesize realistic ECG heartbeat waveform array for visual radar canvas
    const ecgPoints = this.generateECGWaveform(pulseStrength, isFlatline);

    const result = {
      barcode: cleanCode,
      hashHex: '0x' + hash.toString(16).toUpperCase(),
      pulseStrength,
      isFlatline,
      rarity,
      archetype,
      stats: {
        speed,
        maxHealth: health,
        fireCooldown,
        damage
      },
      visuals: {
        primaryColor,
        glowColor,
        silhouette: archetype
      },
      ecgWaveform: ecgPoints,
      timestamp: performance.now()
    };

    this.history.unshift(result);
    if (this.history.length > 20) this.history.pop();

    if (this.eventBus) {
      this.eventBus.publish('BARCODE_SCANNED', result);
    }

    return result;
  }

  /**
   * Generates a 64-point ECG heart rhythm array for canvas oscilloscopes
   */
  generateECGWaveform(vitality, isFlatline) {
    const points = [];
    const len = 64;

    for (let i = 0; i < len; i++) {
      if (isFlatline) {
        // Flatline with minimal noise
        points.push(0.5 + (Math.random() - 0.5) * 0.04);
        continue;
      }

      // Classic P-Q-R-S-T cardiac cycle normalized between 0.0 and 1.0
      const phase = (i % 32) / 32;
      let val = 0.5;

      if (phase > 0.20 && phase < 0.28) {
        // P-wave
        val += 0.08 * vitality;
      } else if (phase >= 0.38 && phase < 0.41) {
        // Q-drop
        val -= 0.12 * vitality;
      } else if (phase >= 0.41 && phase < 0.46) {
        // R-peak (main heartbeat spike)
        val += 0.48 * vitality;
      } else if (phase >= 0.46 && phase < 0.49) {
        // S-drop
        val -= 0.18 * vitality;
      } else if (phase >= 0.60 && phase < 0.72) {
        // T-wave
        val += 0.14 * vitality;
      }

      // Add analog oscilloscope trace noise
      val += (Math.random() - 0.5) * 0.02;
      points.push(Math.max(0.05, Math.min(0.95, val)));
    }
    return points;
  }
}

// Export for ES modules and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BarcodeEntropyScanner;
}
if (typeof window !== 'undefined') {
  window.BarcodeEntropyScanner = BarcodeEntropyScanner;
}
