/**
 * AETHERIA TCG ASTROLOGICAL CARD SYNTHESIZER
 * Maps astronomical natal coordinates into playable Trading Card Game stats, archetypes, and abilities.
 * Renders interactive 3D holographic card frames for Duel Zexal and Vorath TCG.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AetheriaTCG = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Archetype mapping based on Dominant Element and Chart Ruler
  const ARCHETYPES = {
    Earth_Saturn: {
      title: 'Titan Sovereign Architect',
      type: 'Earth / Sovereign Construct',
      abilityName: 'Aegis of the Foundation Stone',
      abilityDesc: 'Whenever damage is taken, convert 40% into permanent Barrier Shields. Immune to status disruptions and artificial inflation.'
    },
    Earth_Venus: {
      title: 'Hierophant Alchemist',
      type: 'Earth / Alchemical Mason',
      abilityName: 'Transmutation of Matter',
      abilityDesc: 'Sacrifice 1 resource node to forge a permanent Golden Sigil relic on the field.'
    },
    Fire_Mars: {
      title: 'Crimson Vanguard',
      type: 'Fire / Tactical Warrior',
      abilityName: 'Solar Flare Impact',
      abilityDesc: 'Direct piercing strike ignores defensive shields when life points are below 50%.'
    },
    Air_Saturn: {
      title: 'Decentralized Network Magus',
      type: 'Air / Cybernetic Sovereign',
      abilityName: 'Distributed Consensus Protocol',
      abilityDesc: 'Bypasses all central authority cards. Attacks simultaneously across all open board lanes.'
    },
    Water_Pluto: {
      title: 'Abyssal Transmuter',
      type: 'Water / Occult Sovereign',
      abilityName: 'Phoenix Rebirth from Ashes',
      abilityDesc: 'When destroyed, return to the battlefield on the next turn with doubled attack and stealth shroud.'
    },
    Default: {
      title: 'Celestial Sovereign',
      type: 'Aether / Cosmic Entity',
      abilityName: 'Harmonic Alignment',
      abilityDesc: 'Draw 2 cards from the Mystery School vault when a planetary aspect is formed.'
    }
  };

  function calculateCardStats(chartData) {
    const { planets, elements, modalities, aspects, angles, name } = chartData;

    // Determine primary element
    let dominantElement = 'Earth';
    let maxElemCount = -1;
    for (const [el, count] of Object.entries(elements)) {
      if (count > maxElemCount) {
        maxElemCount = count;
        dominantElement = el;
      }
    }

    // Determine chart ruler archetype key
    const ascSign = angles.asc.sign;
    let rulerPlanet = 'Saturn';
    if (ascSign === 'Aries' || ascSign === 'Scorpio') rulerPlanet = 'Mars';
    else if (ascSign === 'Taurus' || ascSign === 'Libra') rulerPlanet = 'Venus';
    else if (ascSign === 'Gemini' || ascSign === 'Virgo') rulerPlanet = 'Mercury';
    else if (ascSign === 'Cancer') rulerPlanet = 'Moon';
    else if (ascSign === 'Leo') rulerPlanet = 'Sun';
    else if (ascSign === 'Sagittarius' || ascSign === 'Pisces') rulerPlanet = 'Jupiter';
    else if (ascSign === 'Capricorn' || ascSign === 'Aquarius') rulerPlanet = 'Saturn';

    const archKey = `${dominantElement}_${rulerPlanet}`;
    const archetype = ARCHETYPES[archKey] || ARCHETYPES.Default;

    // Stat generation formulas
    // DEF heavily weighted by Earth + Saturn + Capricorn
    const earthScore = (elements.Earth || 0) * 450;
    const saturnBonus = (planets.Saturn ? 600 : 0);
    const baseDef = 1800 + earthScore + saturnBonus;
    const def = Math.min(4500, Math.round(baseDef / 50) * 50);

    // ATK heavily weighted by Fire + Mars + Sun
    const fireScore = (elements.Fire || 0) * 400;
    const marsBonus = (planets.Mars ? 500 : 0);
    const sunBonus = (planets.Sun ? 600 : 0);
    const baseAtk = 1600 + fireScore + marsBonus + sunBonus;
    const atk = Math.min(4200, Math.round(baseAtk / 50) * 50);

    // Star Rank (Levels 6 to 10)
    const aspectCount = aspects.length;
    const stars = Math.min(10, Math.max(7, Math.floor(aspectCount / 3) + 5));

    // Special Aspect Harmonic
    let closestAspect = null;
    let minOrb = 999;
    aspects.forEach(a => {
      if (a.exactOrb < minOrb) {
        minOrb = a.exactOrb;
        closestAspect = a;
      }
    });

    let aspectPower = 'Sovereign Presence: Gains +300 ATK when facing institutional barriers.';
    if (closestAspect) {
      aspectPower = `${closestAspect.type} of ${closestAspect.p1} & ${closestAspect.p2} (${closestAspect.exactOrb.toFixed(2)}° orb): ${closestAspect.nature}. Automatically grants 1 free action per round.`;
    }

    return {
      cardName: name.split('(')[0].trim().toUpperCase(),
      title: archetype.title,
      cardType: archetype.type,
      stars,
      atk,
      def,
      hp: 4320,
      element: dominantElement,
      abilityName: archetype.abilityName,
      abilityDesc: archetype.abilityDesc,
      aspectHarmonic: aspectPower,
      sunSign: planets.Sun ? planets.Sun.formatted : 'Solar Core',
      moonSign: planets.Moon ? planets.Moon.formatted : 'Lunar Vault',
      ascSign: angles.asc ? angles.asc.formatted : 'Ascendant Gateway'
    };
  }

  // Render TCG Card HTML / DOM Element
  function renderCardDOM(stats) {
    const card = document.createElement('div');
    card.className = 'aetheria-tcg-card';

    let starsHTML = '';
    for (let i = 0; i < stats.stars; i++) {
      starsHTML += '<span class="tcg-star">★</span>';
    }

    card.innerHTML = `
      <div class="tcg-card-inner">
        <div class="tcg-card-foil-sheen"></div>
        <div class="tcg-card-header">
          <span class="tcg-card-name">${stats.cardName}</span>
          <span class="tcg-card-elem elem-${stats.element.toLowerCase()}">${stats.element.toUpperCase()}</span>
        </div>
        <div class="tcg-card-stars">
          ${starsHTML}
        </div>
        <div class="tcg-card-frame">
          <div class="tcg-sigil-portal">
            <div class="tcg-celestial-orbit">
              <span class="tcg-sun-rune">☉ ${stats.sunSign}</span>
              <span class="tcg-moon-rune">☽ ${stats.moonSign}</span>
              <span class="tcg-asc-rune">☿ ASC: ${stats.ascSign}</span>
            </div>
            <div class="tcg-emblem">✦ ${stats.title.toUpperCase()} ✦</div>
          </div>
        </div>
        <div class="tcg-card-textbox">
          <div class="tcg-card-type">[ ${stats.cardType} / Effect ]</div>
          <div class="tcg-ability">
            <strong>【 ${stats.abilityName} 】</strong><br>
            ${stats.abilityDesc}
          </div>
          <div class="tcg-aspect-power">
            <strong>【 ASTRO-HARMONIC 】</strong> ${stats.aspectHarmonic}
          </div>
          <div class="tcg-card-footer">
            <span class="tcg-stat"><strong>ATK /</strong> ${stats.atk}</span>
            <span class="tcg-stat"><strong>DEF /</strong> ${stats.def}</span>
          </div>
        </div>
      </div>
    `;

    // Interactive mousemove 3D tilt
    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rx = -(y / rect.height) * 22;
      const ry = (x / rect.width) * 22;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03, 1.03, 1.03)`;
      const sheen = card.querySelector('.tcg-card-foil-sheen');
      if (sheen) {
        sheen.style.background = `radial-gradient(circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(251,191,36,0.35) 0%, rgba(255,255,255,0.1) 40%, transparent 75%)`;
      }
    });

    card.addEventListener('mouseleave', function () {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      const sheen = card.querySelector('.tcg-card-foil-sheen');
      if (sheen) {
        sheen.style.background = 'none';
      }
    });

    return card;
  }

  return {
    ARCHETYPES,
    calculateCardStats,
    renderCardDOM
  };
}));
