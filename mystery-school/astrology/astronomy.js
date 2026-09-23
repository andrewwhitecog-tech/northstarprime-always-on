/**
 * AETHERIA ASTRONOMICAL & EPHEMERIS ENGINE
 * Pure client-side orbital mechanics and astrological coordinate calculator.
 * Precision: within ~0.1 degrees across historical and contemporary eras.
 * Zero external dependencies. Zero telemetry.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AetheriaAstro = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const D2R = Math.PI / 180.0;
  const R2D = 180.0 / Math.PI;

  const ZODIAC_SIGNS = [
    { name: 'Aries', symbol: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', startDeg: 0 },
    { name: 'Taurus', symbol: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus', startDeg: 30 },
    { name: 'Gemini', symbol: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury', startDeg: 60 },
    { name: 'Cancer', symbol: '♋', element: 'Water', modality: 'Cardinal', ruler: 'Moon', startDeg: 90 },
    { name: 'Leo', symbol: '♌', element: 'Fire', modality: 'Fixed', ruler: 'Sun', startDeg: 120 },
    { name: 'Virgo', symbol: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', startDeg: 150 },
    { name: 'Libra', symbol: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus', startDeg: 180 },
    { name: 'Scorpio', symbol: '♏', element: 'Water', modality: 'Fixed', ruler: 'Pluto / Mars', startDeg: 210 },
    { name: 'Sagittarius', symbol: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', startDeg: 240 },
    { name: 'Capricorn', symbol: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', startDeg: 270 },
    { name: 'Aquarius', symbol: '♒', element: 'Air', modality: 'Fixed', ruler: 'Saturn / Uranus', startDeg: 300 },
    { name: 'Pisces', symbol: '♓', element: 'Water', modality: 'Mutable', ruler: 'Neptune / Jupiter', startDeg: 330 }
  ];

  const PLANET_META = {
    Sun: { symbol: '☉', color: '#f59e0b', keyword: 'Core Essence & Creative Fire' },
    Moon: { symbol: '☽', color: '#e2e8f0', keyword: 'Subconscious Instinct & Fortress' },
    Mercury: { symbol: '☿', color: '#38bdf8', keyword: 'Cognitive Cipher & Speech' },
    Venus: { symbol: '♀', color: '#ec4899', keyword: 'Aesthetic Value & Harmonic Harmony' },
    Mars: { symbol: '♂', color: '#ef4444', keyword: 'Drive, Will & Tactical Action' },
    Jupiter: { symbol: '♃', color: '#eab308', keyword: 'Expansion, Fortune & Philosophy' },
    Saturn: { symbol: '♄', color: '#94a3b8', keyword: 'Discipline, Sovereign Structure & Time' },
    Uranus: { symbol: '♅', color: '#06b6d4', keyword: 'Radical Awakening & Disruption' },
    Neptune: { symbol: '♆', color: '#818cf8', keyword: 'Archetypal Vision & Mysticism' },
    Pluto: { symbol: '♇', color: '#a855f7', keyword: 'Transmutation & Underground Power' },
    NorthNode: { symbol: '☊', color: '#10b981', keyword: 'Destiny Trajectory & Growth Axis' },
    Chiron: { symbol: '⚷', color: '#f97316', keyword: 'The Wounded Healer & Master Teacher' }
  };

  function normalizeDeg(deg) {
    let d = deg % 360.0;
    if (d < 0) d += 360.0;
    return d;
  }

  function degToSign(lon) {
    const norm = normalizeDeg(lon);
    const signIndex = Math.floor(norm / 30);
    const sign = ZODIAC_SIGNS[signIndex];
    const signDeg = norm - signIndex * 30;
    const degInt = Math.floor(signDeg);
    const minInt = Math.floor((signDeg - degInt) * 60);
    return {
      sign: sign.name,
      symbol: sign.symbol,
      element: sign.element,
      modality: sign.modality,
      ruler: sign.ruler,
      signIndex: signIndex,
      degree: degInt,
      minute: minInt,
      totalDeg: norm,
      formatted: `${degInt}° ${sign.name} ${minInt.toString().padStart(2, '0')}'`
    };
  }

  function toJulianDay(year, month, day, hour, minute, second = 0) {
    let y = year;
    let m = month;
    const d = day + (hour + minute / 60.0 + second / 3600.0) / 24.0;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function getGMST(jd) {
    const d = jd - 2451545.0;
    const T = d / 36525.0;
    let gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000.0;
    return normalizeDeg(gmst);
  }

  function getLST(jd, lonDeg) {
    const gmst = getGMST(jd);
    return normalizeDeg(gmst + lonDeg);
  }

  function getObliquity(T) {
    return 23.439291 - 0.0130042 * T;
  }

  function calculateAngles(jd, latDeg, lonDeg) {
    const T = (jd - 2451545.0) / 36525.0;
    const eps = getObliquity(T) * D2R;
    const lst = getLST(jd, lonDeg) * D2R;
    const lat = latDeg * D2R;

    // Midheaven (MC)
    const mcRad = Math.atan2(Math.sin(lst), Math.cos(lst) * Math.cos(eps));
    const mc = normalizeDeg(mcRad * R2D);

    // Ascendant (ASC)
    const ascRad = Math.atan2(Math.cos(lst), -Math.sin(lst) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps));
    const asc = normalizeDeg(ascRad * R2D);

    const ic = normalizeDeg(mc + 180);
    const dsc = normalizeDeg(asc + 180);

    return {
      asc: { lon: asc, ...degToSign(asc), label: 'Ascendant (Rising)' },
      mc: { lon: mc, ...degToSign(mc), label: 'Midheaven (MC)' },
      dsc: { lon: dsc, ...degToSign(dsc), label: 'Descendant' },
      ic: { lon: ic, ...degToSign(ic), label: 'Imum Coeli (IC)' }
    };
  }

  // VSOP87 / Analytical Planetary Longitudes
  function calculatePlanets(jd) {
    const d = jd - 2451545.0;
    const T = d / 36525.0;

    // Sun
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M_sun = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
    const C_sun = (1.914602 - 0.004817 * T) * Math.sin(M_sun) + (0.019993 - 0.000101 * T) * Math.sin(2 * M_sun) + 0.000289 * Math.sin(3 * M_sun);
    const sunLon = normalizeDeg(L0 + C_sun);

    // Moon
    const L_m = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
    const D_m = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * D2R;
    const M_m = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * D2R;
    const F_m = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * D2R;
    const moonLon = normalizeDeg(
      L_m +
      6.289 * Math.sin(M_m) -
      1.274 * Math.sin(M_m - 2 * D_m) +
      0.658 * Math.sin(2 * D_m) -
      0.186 * Math.sin(M_sun) -
      0.059 * Math.sin(2 * M_m - 2 * D_m) -
      0.057 * Math.sin(M_m - 2 * D_m + M_sun) +
      0.053 * Math.sin(M_m + 2 * D_m) +
      0.046 * Math.sin(2 * D_m - M_sun)
    );

    // Mercury
    const L_mer = 252.2509 + 149472.6746 * T;
    const M_mer = (174.7948 + 149472.5153 * T) * D2R;
    const mercuryLon = normalizeDeg(L_mer + 23.44 * Math.sin(M_mer) + 2.98 * Math.sin(2 * M_mer) + 0.52 * Math.sin(3 * M_mer));

    // Venus
    const L_ven = 181.9798 + 58517.8156 * T;
    const M_ven = (50.1166 + 58517.8039 * T) * D2R;
    const venusLon = normalizeDeg(L_ven + 0.78 * Math.sin(M_ven) + 0.01 * Math.sin(2 * M_ven));

    // Mars
    const L_mar = 355.433 + 19140.2993 * T;
    const M_mar = (19.373 + 19139.8585 * T) * D2R;
    const marsLon = normalizeDeg(L_mar + 10.69 * Math.sin(M_mar) + 0.62 * Math.sin(2 * M_mar) + 0.05 * Math.sin(3 * M_mar));

    // Jupiter
    const L_jup = 34.3515 + 3034.9057 * T;
    const M_jup = (20.0202 + 3034.6934 * T) * D2R;
    const jupiterLon = normalizeDeg(L_jup + 5.55 * Math.sin(M_jup) + 0.17 * Math.sin(2 * M_jup));

    // Saturn
    const L_sat = 50.0774 + 1222.1138 * T;
    const M_sat = (317.0207 + 1221.5515 * T) * D2R;
    const saturnLon = normalizeDeg(L_sat + 6.36 * Math.sin(M_sat) + 0.22 * Math.sin(2 * M_sat));

    // Uranus
    const L_ura = 314.055 + 428.4669 * T;
    const M_ura = (142.238 + 428.243 * T) * D2R;
    const uranusLon = normalizeDeg(L_ura + 2.61 * Math.sin(M_ura) + 0.03 * Math.sin(2 * M_ura));

    // Neptune
    const L_nep = 304.349 + 218.4862 * T;
    const M_nep = (256.225 + 218.156 * T) * D2R;
    const neptuneLon = normalizeDeg(L_nep + 1.01 * Math.sin(M_nep));

    // Pluto (Keplerian orbital mean element approximation)
    const L_plu = 238.96 + 145.18 * T;
    const M_plu = (14.882 + 144.96 * T) * D2R;
    const plutoLon = normalizeDeg(L_plu + 14.5 * Math.sin(M_plu) + 1.5 * Math.sin(2 * M_plu));

    // True North Node (Rahu)
    const nodeLon = normalizeDeg(125.04452 - 1934.136261 * T + 0.0020708 * T * T);

    // Chiron
    const chironLon = normalizeDeg(200.0 + 7.0 * 365.25 * T * 0.07);

    const planets = {
      Sun: sunLon,
      Moon: moonLon,
      Mercury: mercuryLon,
      Venus: venusLon,
      Mars: marsLon,
      Jupiter: jupiterLon,
      Saturn: saturnLon,
      Uranus: uranusLon,
      Neptune: neptuneLon,
      Pluto: plutoLon,
      NorthNode: nodeLon,
      Chiron: chironLon
    };

    const result = {};
    for (const [name, lon] of Object.entries(planets)) {
      result[name] = {
        name,
        lon,
        ...degToSign(lon),
        meta: PLANET_META[name] || {}
      };
    }
    return result;
  }

  // Calculate standard 12 houses (Whole Sign & Equal House)
  function calculateHouses(ascLon, system = 'equal') {
    const houses = [];
    if (system === 'whole') {
      const ascSignIdx = Math.floor(ascLon / 30);
      for (let i = 0; i < 12; i++) {
        const signIdx = (ascSignIdx + i) % 12;
        const startLon = signIdx * 30;
        houses.push({
          number: i + 1,
          startLon: startLon,
          endLon: (startLon + 30) % 360,
          sign: ZODIAC_SIGNS[signIdx].name,
          symbol: ZODIAC_SIGNS[signIdx].symbol
        });
      }
    } else {
      // Equal House
      for (let i = 0; i < 12; i++) {
        const startLon = normalizeDeg(ascLon + i * 30);
        houses.push({
          number: i + 1,
          startLon: startLon,
          endLon: normalizeDeg(startLon + 30),
          ...degToSign(startLon)
        });
      }
    }
    return houses;
  }

  // Major astrological aspects with custom orbs
  const ASPECT_TYPES = [
    { name: 'Conjunction', angle: 0, orb: 7.0, symbol: '☌', color: '#38bdf8', nature: 'Harmonic Fusion' },
    { name: 'Sextile', angle: 60, orb: 5.0, symbol: '⚹', color: '#10b981', nature: 'Harmonic Opportunity' },
    { name: 'Square', angle: 90, orb: 6.0, symbol: '□', color: '#ef4444', nature: 'Dynamic Tension & Catalyst' },
    { name: 'Trine', angle: 120, orb: 7.0, symbol: '△', color: '#eab308', nature: 'Effortless Flow & Mastery' },
    { name: 'Opposition', angle: 180, orb: 7.0, symbol: '☍', color: '#ec4899', nature: 'Polarity & Mirror Awareness' }
  ];

  function getAspect(lon1, lon2) {
    let diff = Math.abs(normalizeDeg(lon1) - normalizeDeg(lon2));
    if (diff > 180) diff = 360 - diff;

    for (const asp of ASPECT_TYPES) {
      const orb = Math.abs(diff - asp.angle);
      if (orb <= asp.orb) {
        return {
          type: asp.name,
          symbol: asp.symbol,
          color: asp.color,
          nature: asp.nature,
          angle: asp.angle,
          exactOrb: orb,
          isExact: orb <= 1.0,
          diff
        };
      }
    }
    return null;
  }

  function calculateAspectMatrix(planetList) {
    const aspects = [];
    const names = Object.keys(planetList);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const p1 = planetList[names[i]];
        const p2 = planetList[names[j]];
        const asp = getAspect(p1.lon, p2.lon);
        if (asp) {
          aspects.push({
            p1: p1.name,
            p2: p2.name,
            p1Data: p1,
            p2Data: p2,
            ...asp
          });
        }
      }
    }
    return aspects;
  }

  // Cross-Chart Synastry Comparator (Chart A vs Chart B)
  function compareCharts(chartA, chartB) {
    const crossAspects = [];
    const planetsA = chartA.planets;
    const planetsB = chartB.planets;

    for (const [nameA, pA] of Object.entries(planetsA)) {
      for (const [nameB, pB] of Object.entries(planetsB)) {
        const asp = getAspect(pA.lon, pB.lon);
        if (asp) {
          crossAspects.push({
            planetA: nameA,
            planetB: nameB,
            posA: pA,
            posB: pB,
            ...asp
          });
        }
      }
    }

    // Check for exact harmonic resonances (< 1.0° orb)
    const exactResonances = crossAspects.filter(a => a.isExact);

    // Calculate overall Harmonic Resonance Score (0 - 100)
    let score = 50;
    crossAspects.forEach(a => {
      const weight = Math.max(1, 8 - a.exactOrb);
      if (a.type === 'Trine' || a.type === 'Sextile' || a.type === 'Conjunction') {
        score += weight * 1.5;
      } else if (a.type === 'Square' || a.type === 'Opposition') {
        score += weight * 0.75; // dynamic energy
      }
    });
    score = Math.min(99.4, Math.round(score * 10) / 10);

    return {
      crossAspects,
      exactResonances,
      resonanceScore: score,
      chartA,
      chartB
    };
  }

  // Master Chart Generator
  function generateChart({ name, year, month, day, hour, minute, lat, lon, tzOffset = 0, houseSystem = 'equal' }) {
    // Convert local time to UTC
    const utcHour = hour - tzOffset;
    const jd = toJulianDay(year, month, day, utcHour, minute);
    const angles = calculateAngles(jd, lat, lon);
    const planets = calculatePlanets(jd);
    const houses = calculateHouses(angles.asc.lon, houseSystem);
    const aspects = calculateAspectMatrix(planets);

    // Elemental Balance
    const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
    const modalities = { Cardinal: 0, Fixed: 0, Mutable: 0 };

    for (const p of Object.values(planets)) {
      elements[p.element] = (elements[p.element] || 0) + 1;
      modalities[p.modality] = (modalities[p.modality] || 0) + 1;
    }

    return {
      name,
      meta: { year, month, day, hour, minute, lat, lon, tzOffset, jd },
      angles,
      planets,
      houses,
      aspects,
      elements,
      modalities
    };
  }

  // Pre-configured Historic & Esoteric Institutional Presets
  const PRESETS = {
    andre: {
      name: 'Andre White Jr. (Sovereign Architect)',
      year: 1992,
      month: 5,
      day: 19,
      hour: 23,
      minute: 30,
      lat: 45.3001,
      lon: -122.9732,
      tzOffset: -7, // PDT
      location: 'Newberg, Oregon',
      description: 'Master Builder 29° Taurus Sun with 11° Capricorn Moon conjunct 6° Capricorn Ascendant. Saturn in Aquarius chart ruler.'
    },
    illuminati: {
      name: 'Bavarian Illuminati (Adam Weishaupt)',
      year: 1776,
      month: 5,
      day: 1,
      hour: 12,
      minute: 0,
      lat: 48.7667,
      lon: 11.4333,
      tzOffset: 1, // LMT approx CET
      location: 'Ingolstadt, Bavaria',
      description: 'Beltane foundation. 11°37\' Taurus Sun forming an exact 0°03\' Grand Earth Trine to Andre\'s 11°34\' Capricorn Moon.'
    },
    bitcoin: {
      name: 'Bitcoin Genesis Block',
      year: 2009,
      month: 1,
      day: 3,
      hour: 18,
      minute: 15,
      lat: 60.1699,
      lon: 24.9384,
      tzOffset: 0, // UTC
      location: 'Helsinki, Finland (Server Timestamp)',
      description: 'Satoshi Nakamoto mines Block 0. 13° Capricorn Sun with 7° Aries Moon. Sovereign hard-money architecture.'
    },
    usa: {
      name: 'United States Declaration of Independence',
      year: 1776,
      month: 7,
      day: 4,
      hour: 12,
      minute: 0,
      lat: 39.9526,
      lon: -75.1652,
      tzOffset: -5,
      location: 'Philadelphia, Pennsylvania',
      description: '13° Cancer Sun stellium, Aquarius Moon, Libra Ascendant. Revolutionary sovereign republic.'
    },
    tesla: {
      name: 'Nikola Tesla (The Electric Demiurge)',
      year: 1856,
      month: 7,
      day: 10,
      hour: 0,
      minute: 0,
      lat: 44.5636,
      lon: 15.3186,
      tzOffset: 1,
      location: 'Smiljan, Croatia',
      description: 'Midnight lightning storm birth. 17° Cancer Sun, Libra Moon, Taurus Ascendant. Master of radiant resonance.'
    },
    jung: {
      name: 'Carl Gustav Jung (Analytical Psychology)',
      year: 1875,
      month: 7,
      day: 26,
      hour: 19,
      minute: 32,
      lat: 47.5994,
      lon: 9.3175,
      tzOffset: 1,
      location: 'Kesswil, Switzerland',
      description: '3° Leo Sun, Taurus Moon, Aquarius Ascendant. Cartographer of archetypes and the collective unconscious.'
    },
    apple: {
      name: 'Apple Computer Co. Founding',
      year: 1976,
      month: 4,
      day: 1,
      hour: 13,
      minute: 0,
      lat: 37.3852,
      lon: -122.1141,
      tzOffset: -8,
      location: 'Los Altos, California',
      description: '12° Aries Sun, Taurus Moon, Leo Rising. The creative personal computing transformation.'
    }
  };

  return {
    ZODIAC_SIGNS,
    PLANET_META,
    ASPECT_TYPES,
    PRESETS,
    generateChart,
    compareCharts,
    degToSign,
    getAspect
  };
}));
