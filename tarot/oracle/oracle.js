/* Vorath Tarot Oracle • Interactive 3D Divination Engine */
(() => {
  'use strict';

  // Canonical Vorath Deck Master Lore
  const DECK = [
    {
      num: '0',
      name: 'The Seeker',
      arcana: 'Major Arcana',
      keywords: ['Zero Point', 'Infinite Potential', 'The Leap', 'Beginnings'],
      upright: 'A leap into the cosmic void with an open heart. Release all preconceived limitations; the universe bends to support true spontaneity and pure curiosity.',
      mantra: 'I step into the boundless void without fear. All creation unfolds from this zero point.',
      sigil: '<circle cx="50" cy="50" r="30" fill="none" stroke="#f5df88" stroke-width="4"/><path d="M 50,15 L 50,85 M 15,50 L 85,50" stroke="#3fe0ff" stroke-width="2"/>'
    },
    {
      num: 'I',
      name: 'The Magus',
      arcana: 'Major Arcana',
      keywords: ['Spagyric Will', 'Manifestation', 'As Above So Below'],
      upright: 'You possess all the elemental tools required to transmute raw intention into tangible reality. Direct your focus with uncompromising alignment.',
      mantra: 'As above in the astral spires, so below upon the living earth. My will crystallizes.',
      sigil: '<polygon points="50,15 80,75 20,75" fill="none" stroke="#f5df88" stroke-width="4"/><circle cx="50" cy="55" r="14" fill="#3fe0ff"/>'
    },
    {
      num: 'II',
      name: 'The High Priestess',
      arcana: 'Major Arcana',
      keywords: ['Intuition', 'The Veiled Gate', 'Lunar Wisdom', 'Secrets'],
      upright: 'The answers you seek cannot be found through intellectual debate. Sit quietly in the twilight garden; listen to the subtle currents beneath the conscious mind.',
      mantra: 'I trust the silence between thoughts. The deeper truths reveal themselves in stillness.',
      sigil: '<path d="M 30,20 Q 50,50 30,80 Q 70,50 30,20" fill="none" stroke="#f5df88" stroke-width="3"/><circle cx="60" cy="50" r="18" fill="none" stroke="#ff4db8" stroke-width="3"/>'
    },
    {
      num: 'III',
      name: 'The Empress',
      arcana: 'Major Arcana',
      keywords: ['Abundance', 'Solarium Blossom', 'Creation', 'Sensory Grace'],
      upright: 'Sensory vitality and creative flourishing. The Solarium garden is in full bloom. Nurture your ideas with patience and celebrate natural beauty.',
      mantra: 'I am rooted in abundance. Life generates life effortlessly through me.',
      sigil: '<circle cx="50" cy="40" r="22" fill="none" stroke="#f5df88" stroke-width="3"/><path d="M 50,62 L 50,88 M 38,75 L 62,75" stroke="#f5df88" stroke-width="3"/>'
    },
    {
      num: 'IV',
      name: 'The Emperor',
      arcana: 'Major Arcana',
      keywords: ['Basalt Sovereignty', 'Structure', 'Order', 'Authority'],
      upright: 'Stability carved from volcanic basalt. Set clear boundaries, honor systemic discipline, and build structures designed to endure centuries.',
      mantra: 'I construct order from chaos. My foundation is unshakeable and just.',
      sigil: '<rect x="25" y="25" width="50" height="50" fill="none" stroke="#f5df88" stroke-width="4"/><polygon points="50,15 85,85 15,85" fill="none" stroke="#a855f7" stroke-width="2"/>'
    },
    {
      num: 'VII',
      name: 'The Chariot',
      arcana: 'Major Arcana',
      keywords: ['Merkaba Warp', 'Focused Drive', 'Triumph Over Gravity'],
      upright: 'Harness opposing forces and drive directly toward the breakthrough. Victory comes through unwavering discipline and master of the inner polarities.',
      mantra: 'I unite opposing forces. My vehicle moves through dimensions unimpeded.',
      sigil: '<polygon points="50,10 90,50 50,90 10,50" fill="none" stroke="#f5df88" stroke-width="4"/><circle cx="50" cy="50" r="16" fill="#3fe0ff"/>'
    },
    {
      num: 'IX',
      name: 'The Hermit',
      arcana: 'Major Arcana',
      keywords: ['Sphene Lantern', 'Solitary Vision', 'Inner Lighthouse'],
      upright: 'Step back from the collective noise. The sphene lantern shines only for those willing to walk their authentic path through the quiet mists.',
      mantra: 'My own light illuminates the next step. I am sovereign in my solitude.',
      sigil: '<polygon points="50,15 62,35 85,35 68,52 74,75 50,60 26,75 32,52 15,35 38,35" fill="none" stroke="#f5df88" stroke-width="3"/>'
    },
    {
      num: 'X',
      name: 'Wheel of Fortune',
      arcana: 'Major Arcana',
      keywords: ['Ouroboros Orbit', 'Cycles of Destiny', 'Cosmic Turning'],
      upright: 'The great wheel turns. Accept changes of tide with equanimity; what was low rises again to the heights. Ride the wave with awareness.',
      mantra: 'I honor the sacred cycle. In every ending, the seed of renewal is quickened.',
      sigil: '<circle cx="50" cy="50" r="32" fill="none" stroke="#f5df88" stroke-width="3"/><circle cx="50" cy="50" r="16" fill="none" stroke="#ff4db8" stroke-width="2"/><path d="M 50,18 L 50,82 M 18,50 L 82,50" stroke="#f5df88" stroke-width="2"/>'
    },
    {
      num: 'XIII',
      name: 'Transformation',
      arcana: 'Major Arcana',
      keywords: ['Metamorphosis', 'Shedding the Cocoon', 'Radical Renewal'],
      upright: 'The outlived husk falls away. Do not mourn what has completed its cycle; celebrate the liberation of the living spirit beneath.',
      mantra: 'I release what is complete. I welcome the fierce grace of renewal.',
      sigil: '<path d="M 20,75 Q 50,15 80,75 Z" fill="none" stroke="#f5df88" stroke-width="3"/><circle cx="50" cy="45" r="10" fill="#a855f7"/>'
    },
    {
      num: 'XIV',
      name: 'Temperance',
      arcana: 'Major Arcana',
      keywords: ['Spagyric Synthesis', 'Flow State', 'Dynamic Equilibrium'],
      upright: 'Blending fire and water, spirit and matter. You are discovering the golden middle path where opposing elements harmonize into a third transcendent essence.',
      mantra: 'I flow with measured grace. All elements find balance within my center.',
      sigil: '<path d="M 30,30 Q 50,50 30,70 M 70,30 Q 50,50 70,70" fill="none" stroke="#f5df88" stroke-width="3"/><line x1="20" y1="50" x2="80" y2="50" stroke="#3fe0ff" stroke-width="2"/>'
    },
    {
      num: 'XVII',
      name: 'The Star',
      arcana: 'Major Arcana',
      keywords: ['Astral Guidance', 'Unconditional Hope', 'Inspiration'],
      upright: 'Clear skies after the storm. Your path is blessed by cosmic alignment. Offer your gifts freely to the world without expectation.',
      mantra: 'I am aligned with celestial light. Peace and crystal clarity fill my heart.',
      sigil: '<polygon points="50,10 60,35 88,35 66,52 74,78 50,62 26,78 34,52 12,35 40,35" fill="#f5df88" opacity="0.85"/>'
    },
    {
      num: 'XVIII',
      name: 'The Moon',
      arcana: 'Major Arcana',
      keywords: ['Multnomah Mists', 'Subconscious Currents', 'The Dream'],
      upright: 'Things are not as they appear in the harsh glare of noon. Trust your instinct through the twilight; the illusions of fear vanish when met with presence.',
      mantra: 'I navigate the mysterious waters with ease. The shadows hold ancient wisdom.',
      sigil: '<path d="M 40,15 A 35,35 0 1,0 75,70 A 32,32 0 1,1 40,15 Z" fill="none" stroke="#f5df88" stroke-width="3"/>'
    },
    {
      num: 'XIX',
      name: 'The Sun',
      arcana: 'Major Arcana',
      keywords: ['Solar Triumph', 'Radiant Vitality', 'Pure Joy', 'Clarity'],
      upright: 'Unvarnished truth, warmth, and vitality. Success is clear, joyous, and shared. Step boldly into the spotlight with an open, exuberant heart.',
      mantra: 'I radiate warmth and vitality. My light dispels every trace of doubt.',
      sigil: '<circle cx="50" cy="50" r="22" fill="#f5df88"/><path d="M 50,10 L 50,22 M 50,78 L 50,90 M 10,50 L 22,50 M 78,50 L 90,50 M 22,22 L 30,30 M 70,70 L 78,78 M 22,78 L 30,70 M 70,30 L 78,22" stroke="#f5df88" stroke-width="3"/>'
    },
    {
      num: 'XXI',
      name: 'The World',
      arcana: 'Major Arcana',
      keywords: ['Cosmic Integration', 'The Great Work', 'Wholeness', 'Triumph'],
      upright: 'The completion of a massive cosmic cycle. You stand fully integrated at the center of the mandala, ready to celebrate and begin anew from mastery.',
      mantra: 'The Great Work is accomplished. I dance at the heart of the universe.',
      sigil: '<circle cx="50" cy="50" r="34" fill="none" stroke="#f5df88" stroke-width="4"/><polygon points="50,20 78,70 22,70" fill="none" stroke="#3fe0ff" stroke-width="2"/><polygon points="50,80 78,30 22,30" fill="none" stroke="#ff4db8" stroke-width="2"/>'
    }
  ];

  // Minor Arcana Seeds
  const SUITS = [
    { suit: 'Wands', element: 'Fire & Vision', color: '#ff8a24' },
    { suit: 'Cups', element: 'Water & Psyche', color: '#3fe0ff' },
    { suit: 'Swords', element: 'Air & Intellect', color: '#a855f7' },
    { suit: 'Pentacles', element: 'Earth & Matter', color: '#10b981' }
  ];

  SUITS.forEach(s => {
    ['Ace', 'Three', 'Seven', 'Ten', 'Knight', 'Queen'].forEach(rank => {
      DECK.push({
        num: rank,
        name: `${rank} of ${s.suit}`,
        arcana: `Minor Arcana · ${s.suit}`,
        keywords: [s.element, rank, 'Dynamic Flow'],
        upright: `A potent expression of ${s.element.toLowerCase()}. Energy flows clearly through your actions when centered upon integrity.`,
        mantra: `I channel the vitality of ${s.suit}. My purpose is grounded and clear.`,
        sigil: `<circle cx="50" cy="50" r="26" fill="none" stroke="${s.color}" stroke-width="3"/><text x="50" y="56" font-family="'Cinzel',serif" font-size="16" fill="${s.color}" text-anchor="middle">${rank[0]}</text>`
      });
    });
  });

  // State
  let currentSpreadMode = 'three'; // 'one' or 'three'
  let drawnCards = [];

  // DOM
  const cardsContainer = document.getElementById('cardsContainer');
  const spreadBtns = document.querySelectorAll('.spread-btn');
  const reshuffleBtn = document.getElementById('reshuffleBtn');
  const loreSection = document.getElementById('loreSection');
  const loreTitle = document.getElementById('loreTitle');
  const loreKeywords = document.getElementById('loreKeywords');
  const loreUpright = document.getElementById('loreUpright');
  const loreMantra = document.getElementById('loreMantra');

  // Spread Mode Switcher
  spreadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      spreadBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpreadMode = btn.dataset.spread;
      dealSpread();
    });
  });

  // Deal Spread
  function dealSpread() {
    cardsContainer.innerHTML = '';
    loreSection.classList.remove('active');

    // Shuffle
    const shuffled = [...DECK].sort(() => Math.random() - 0.5);
    const count = currentSpreadMode === 'one' ? 1 : 3;
    drawnCards = shuffled.slice(0, count);

    const labels = currentSpreadMode === 'one' 
      ? ['Daily Alignment'] 
      : ['Foundations (Past)', 'The Crucible (Present)', 'The Horizon (Future)'];

    drawnCards.forEach((card, idx) => {
      const slot = document.createElement('div');
      slot.className = 'card-slot';

      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = labels[idx];
      slot.appendChild(label);

      // Card Element
      const cardEl = document.createElement('div');
      cardEl.className = 'tarot-card';

      // Card Back
      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = `
        <img src="../card_back_ouroboros.png" alt="Vorath Ouroboros Card Back">
        <span class="card-back-hint">Click to Reveal</span>
      `;

      // Card Front
      const front = document.createElement('div');
      front.className = 'card-face card-front';
      front.innerHTML = `
        <div class="card-front-inner">
          <div class="card-number">${card.num}</div>
          <div class="card-sigil">
            <svg viewBox="0 0 100 100">${card.sigil}</svg>
          </div>
          <div>
            <div class="card-name">${card.name}</div>
            <div class="card-arcana">${card.arcana}</div>
          </div>
        </div>
      `;

      cardEl.appendChild(back);
      cardEl.appendChild(front);

      // Click to Flip & Show Lore
      cardEl.addEventListener('click', () => {
        cardEl.classList.toggle('flipped');
        showLore(card, labels[idx]);
      });

      slot.appendChild(cardEl);
      cardsContainer.appendChild(slot);
    });

    // Auto-flip the first card after 500ms for dramatic entrance
    setTimeout(() => {
      const firstCard = cardsContainer.querySelector('.tarot-card');
      if (firstCard && !firstCard.classList.contains('flipped')) {
        firstCard.classList.add('flipped');
        showLore(drawnCards[0], labels[0]);
      }
    }, 500);
  }

  // Show Lore Card
  function showLore(card, positionLabel) {
    loreTitle.textContent = `${card.name} (${positionLabel})`;
    loreKeywords.innerHTML = card.keywords.map(k => `<span class="keyword-pill">${k}</span>`).join('');
    loreUpright.textContent = card.upright;
    loreMantra.textContent = `"${card.mantra}"`;
    loreSection.classList.add('active');
  }

  reshuffleBtn.addEventListener('click', dealSpread);

  // Initial Deal
  dealSpread();

})();
