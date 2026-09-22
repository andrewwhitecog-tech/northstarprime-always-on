/* Vorath Tarot Oracle • Canonical 78-Card 3D Divination Engine
   Featuring Procedural 432 Hz Quartz Harmonic Drone & Real Card Artifacts
*/
(() => {
  'use strict';

  let DECK = [];
  let currentSpread = 'three';
  let activeCards = [];
  let selectedCard = null;

  // Web Audio Synthesizer State
  let audioCtx = null;
  let masterGain = null;
  let osc1 = null;
  let osc2 = null;
  let subOsc = null;
  let isDronePlaying = false;

  const SPREAD_CONFIGS = {
    one: [
      { label: 'The Single Signal • Daily Nexus', slotId: 'signal' }
    ],
    three: [
      { label: 'Thread I • Root & Ancestral Light (Past)', slotId: 'past' },
      { label: 'Thread II • Active Refraction (Present)', slotId: 'present' },
      { label: 'Thread III • Ascending Horizon (Future)', slotId: 'future' }
    ],
    nine: [
      { label: 'Thread I • Crown of Light', slotId: 't1' },
      { label: 'Thread II • The Unseen Current', slotId: 't2' },
      { label: 'Thread III • The Abyssal Bloom', slotId: 't3' },
      { label: 'Thread IV • Perimeter of Law', slotId: 't4' },
      { label: 'Thread V • The Inscribed Word', slotId: 't5' },
      { label: 'Thread VI • The Entangled Pair', slotId: 't6' },
      { label: 'Thread VII • The Kinetic Vector', slotId: 't7' },
      { label: 'Thread VIII • The Harmonic Hold', slotId: 't8' },
      { label: 'Thread IX • The Solitary Beacon', slotId: 't9' }
    ]
  };

  // Initialize Web Audio Engine
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function toggleDrone() {
    initAudio();
    if (!audioCtx) return;

    const btn = document.getElementById('droneToggleBtn');
    const label = document.getElementById('droneBtnLabel');

    if (!isDronePlaying) {
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 2.0);
      masterGain.connect(audioCtx.destination);

      const baseFreq = 432.0;

      // Root Quartz Sine
      osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
      osc1.connect(masterGain);
      osc1.start();

      // Harmonious 5th Overtone (Triangle)
      osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 1.5, audioCtx.currentTime);
      osc2.connect(masterGain);
      osc2.start();

      // Deep Sub-Bass Grounding Pulse
      subOsc = audioCtx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(baseFreq / 4, audioCtx.currentTime);
      subOsc.connect(masterGain);
      subOsc.start();

      isDronePlaying = true;
      if (btn) btn.setAttribute('aria-pressed', 'true');
      if (label) label.textContent = 'Harmonics Active';
    } else {
      if (masterGain) {
        masterGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
        setTimeout(() => {
          if (osc1) { osc1.stop(); osc1.disconnect(); }
          if (osc2) { osc2.stop(); osc2.disconnect(); }
          if (subOsc) { subOsc.stop(); subOsc.disconnect(); }
        }, 800);
      }
      isDronePlaying = false;
      if (btn) btn.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = '432 Hz Harmonics';
    }
  }

  function playChime(pitchMultiplier = 1.0) {
    if (!audioCtx) initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    const now = audioCtx.currentTime;
    const chimeGain = audioCtx.createGain();
    chimeGain.connect(audioCtx.destination);

    // High crystalline bell ping
    const bellOsc = audioCtx.createOscillator();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(1728 * pitchMultiplier, now); // 432 * 4
    bellOsc.frequency.exponentialRampToValueAtTime(864 * pitchMultiplier, now + 1.2);

    chimeGain.gain.setValueAtTime(0.15, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    bellOsc.connect(chimeGain);
    bellOsc.start(now);
    bellOsc.stop(now + 1.2);
  }

  // Load Deck Data
  async function loadDeckData() {
    try {
      const res = await fetch('vorath_deck_data.json?v=20260922');
      if (!res.ok) throw new Error('Deck manifest fetch failed');
      DECK = await res.json();
    } catch (err) {
      console.warn('Fallback to local memory manifest', err);
      // Fallback essential majors
      DECK = [
        {
          id: '00_the_fool',
          name: 'The Fool',
          numeral: '0',
          suit: 'Major Arcana',
          archetype: 'The Reveler',
          thread: 'The Zero Thread (The Void Potential)',
          upright: 'Holy madness, uncalculated courage, stepping off the precipice into the radiant unknown, rebirth from zero.',
          inverted: 'Blind recklessness, refusing the call to mutate, wandering without anchor.',
          scripture: 'He who protects his mask leaves his face in darkness. Step where the floor has not yet crystallized; the light shall catch your heels.',
          image: '/tarot/cards/00_the_fool.webp'
        },
        {
          id: '01_the_magician',
          name: 'The Magician',
          numeral: 'I',
          suit: 'Major Arcana',
          archetype: 'The Prism Saint',
          thread: 'Thread I (The Ray of Division)',
          upright: 'Refraction of divine will into tangible power, mastery of the four elements, technical genius, active transmutation.',
          inverted: 'Charlatanism, misdirected energy, burning out ocular nerves with unshielded brilliance.',
          scripture: 'White light is sterile until it strikes the prism. Do not pray for unity; pray to be cut so you may cast color.',
          image: '/tarot/cards/01_the_magician.webp'
        }
      ];
    }
    renderSpread(currentSpread);
  }

  // Draw Unique Cards
  function drawSpreadCards(count) {
    const pool = [...DECK];
    const drawn = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const card = pool.splice(idx, 1)[0];
      // 18% chance of inverted fracture reading
      const isInverted = Math.random() < 0.18;
      drawn.push({
        ...card,
        isInverted,
        isFlipped: false
      });
    }
    return drawn;
  }

  // Render Spread
  function renderSpread(spreadKey) {
    const container = document.getElementById('cardsContainer');
    const loreSection = document.getElementById('loreSection');
    if (!container) return;

    container.innerHTML = '';
    if (loreSection) loreSection.style.display = 'none';

    if (spreadKey === 'nine') {
      container.classList.add('nine-grid');
    } else {
      container.classList.remove('nine-grid');
    }

    const config = SPREAD_CONFIGS[spreadKey] || SPREAD_CONFIGS.three;
    activeCards = drawSpreadCards(config.length);

    activeCards.forEach((card, index) => {
      const slotDef = config[index];
      const slot = document.createElement('div');
      slot.className = 'card-slot';

      const label = document.createElement('div');
      label.className = 'slot-label';
      label.textContent = slotDef.label;

      const cardEl = document.createElement('div');
      cardEl.className = 'tarot-card';
      if (card.isInverted) cardEl.classList.add('inverted');
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('aria-label', `${slotDef.label}: Click to reveal card`);

      // Card Back (Symmetrical Reversible Masterwork)
      const backFace = document.createElement('div');
      backFace.className = 'card-face card-back';
      backFace.innerHTML = `
        <img src="/tarot/card_back_symmetrical.webp" alt="Vorath Sacred Ouroboros Card Back" loading="eager">
        <div class="card-back-hint">Click to Reveal</div>
      `;

      // Card Front (Canonical Real Card Art)
      const frontFace = document.createElement('div');
      frontFace.className = 'card-face card-front';
      frontFace.innerHTML = `
        <img src="${card.image}" class="card-art-img" alt="${card.name}" loading="lazy">
        <div class="card-overlay-badge">
          <span class="badge-title">${card.numeral ? card.numeral + ' · ' : ''}${card.name}</span>
          <span class="badge-archetype">${card.archetype || card.suit}</span>
        </div>
      `;

      cardEl.appendChild(backFace);
      cardEl.appendChild(frontFace);

      const triggerReveal = () => {
        if (!card.isFlipped) {
          card.isFlipped = true;
          cardEl.classList.add('flipped');
          playChime(1.0 + (index * 0.15));
        }
        selectCardForLore(card, cardEl);
      };

      cardEl.addEventListener('click', triggerReveal);
      cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerReveal();
        }
      });

      slot.appendChild(label);
      slot.appendChild(cardEl);
      container.appendChild(slot);
    });
  }

  // Display Lore
  function selectCardForLore(card, cardEl) {
    document.querySelectorAll('.tarot-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');

    const loreSection = document.getElementById('loreSection');
    const loreTitle = document.getElementById('loreTitle');
    const loreSuit = document.getElementById('loreSuit');
    const loreThread = document.getElementById('loreThread');
    const loreArchetype = document.getElementById('loreArchetype');
    const loreUpright = document.getElementById('loreUpright');
    const loreInverted = document.getElementById('loreInverted');
    const loreScriptureWrap = document.getElementById('loreScriptureWrap');
    const loreScripture = document.getElementById('loreScripture');

    if (!loreSection) return;

    loreTitle.textContent = `${card.numeral ? card.numeral + ' · ' : ''}${card.name}${card.isInverted ? ' (Inverted)' : ''}`;
    loreSuit.textContent = card.suit || 'Arcana';
    loreThread.textContent = card.thread || card.element || '';
    loreArchetype.textContent = card.archetype ? `Archetype: ${card.archetype}` : (card.subtitle ? `(${card.subtitle})` : '');

    loreUpright.textContent = card.upright || 'Coherent transmission of divine will through physical form.';
    loreInverted.textContent = card.inverted || 'Thermal scatter-radiation; unintegrated potential awaiting transformation.';

    if (card.scripture) {
      loreScripture.textContent = card.scripture;
      loreScriptureWrap.style.display = 'block';
    } else {
      loreScriptureWrap.style.display = 'none';
    }

    loreSection.style.display = 'block';
    loreSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Bind UI Events
  document.addEventListener('DOMContentLoaded', () => {
    // Spread selector buttons
    document.querySelectorAll('.spread-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spread-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSpread = btn.getAttribute('data-spread');
        renderSpread(currentSpread);
      });
    });

    // Reshuffle button
    const reshuffleBtn = document.getElementById('reshuffleBtn');
    if (reshuffleBtn) {
      reshuffleBtn.addEventListener('click', () => {
        playChime(0.8);
        renderSpread(currentSpread);
      });
    }

    // Audio Drone Toggle
    const droneBtn = document.getElementById('droneToggleBtn');
    if (droneBtn) {
      droneBtn.addEventListener('click', toggleDrone);
    }

    loadDeckData();
  });
})();
