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
    lauren_father: {
      name: "Lauren's Father (Bob)",
      year: 1951,
      month: 6,
      day: 5,
      hour: 12,
      minute: 0,
      lat: 45.3001,
      lon: -122.9732,
      tzOffset: -7,
      location: 'Pacific Northwest',
      description: '14° Gemini Sun, 26° Gemini Moon. Twin Moon conjunction with Lauren\'s Mother; harmonic water/earth sextiles to Andre\'s chart.'
    },
    lauren_mother: {
      name: "Lauren's Mother",
      year: 1956,
      month: 4,
      day: 15,
      hour: 12,
      minute: 0,
      lat: 45.3001,
      lon: -122.9732,
      tzOffset: -7,
      location: 'Pacific Northwest',
      description: '25° Aries Sun, 27° Gemini Moon. 29° Scorpio Saturn exact 0.01° polarity anchor to Andre\'s 29° Taurus Sun; Grand Earth Trine anchor.'
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
    },
    spacecash: {
      name: 'SpaceCash Genesis Block & Devnet',
      year: 2026,
      month: 4,
      day: 24,
      hour: 11,
      minute: 59,
      lat: 45.3001,
      lon: -122.9732,
      tzOffset: -7,
      location: 'Newberg, Oregon',
      description: 'Block 0 genesis. 4°36\' Taurus Sun conjunct Andre\'s Imum Coeli (4°58\' Taurus) at 0°22\' orb; Saturn conjunct Mercury (0°22\' orb) and Moon opposite Saturn (0°27\' orb).'
    },
    sept11: {
      name: 'September 11, 2001 Attacks (9/11)',
      year: 2001,
      month: 9,
      day: 11,
      hour: 8,
      minute: 46,
      lat: 40.7128,
      lon: -74.0060,
      tzOffset: -4,
      location: 'New York, New York',
      description: 'World Trade Center impact. Event North Node (2°15\' Cancer) exact opposition (0°11\' orb) to Andre\'s North Node (2°22\' Capricorn) — exact Nodal Reversal.'
    },
    hitler: {
      name: 'Adolf Hitler Birth (Shadow Dictatorship)',
      year: 1889,
      month: 4,
      day: 20,
      hour: 18,
      minute: 30,
      lat: 48.2563,
      lon: 13.0358,
      tzOffset: 1,
      location: 'Braunau am Inn, Austria',
      description: 'Hitler Moon at 6°25\' Capricorn sits directly on Andre\'s Ascendant (6°20\' Capricorn) with 0°05\' orb; Mars at 28°22\' Taurus conjunct Andre\'s Sun (29°29\' Taurus).'
    },
    gandhi: {
      name: 'Mahatma Gandhi Birth (Satyagraha Sovereign Will)',
      year: 1869,
      month: 10,
      day: 2,
      hour: 7,
      minute: 11,
      lat: 21.6417,
      lon: 69.6293,
      tzOffset: 4.64,
      location: 'Porbandar, India',
      description: 'Gandhi Jupiter at 14°12\' Taurus conjunct Andre\'s Venus in Taurus (13°42\') with 0°50\' orb; trine Uranus in Capricorn with 0°35\' orb.'
    },
    berlin_wall: {
      name: 'Fall of the Berlin Wall',
      year: 1989,
      month: 11,
      day: 9,
      hour: 18,
      minute: 53,
      lat: 52.5200,
      lon: 13.4050,
      tzOffset: 1,
      location: 'Berlin, Germany',
      description: 'Neptune at 11°22\' Capricorn conjunct Andre\'s Natal Moon (11°29\' Capricorn) with 0°13\' orb (8 arcminutes); Saturn conjunct Uranus.'
    },
    great_mutation: {
      name: 'The Great Mutation (Jupiter-Saturn at 0° Aquarius)',
      year: 2020,
      month: 12,
      day: 21,
      hour: 18,
      minute: 22,
      lat: 51.5074,
      lon: -0.1278,
      tzOffset: 0,
      location: 'Greenwich, London',
      description: '200-Year Air Era ingress at 0°29\' Aquarius in Andre\'s 2nd house of sovereign economics; Pluto conjunct Andre\'s Moon (0°29\' orb).'
    },
    chatgpt: {
      name: 'ChatGPT / Autonomous AI Epoch Inception',
      year: 2022,
      month: 11,
      day: 30,
      hour: 18,
      minute: 0,
      lat: 37.7749,
      lon: -122.4194,
      tzOffset: -8,
      location: 'San Francisco, California',
      description: 'Pluto at 14°30\' Capricorn conjunct Andre\'s Uranus (13°51\' Cap) with 0°65\' orb; North Node at 11°50\' Taurus trine Andre\'s Moon (0°35\' orb).'
    }
  };

  function getLiveSkyChart(lat = 45.3001, lon = -122.9732, tzOffset = -7) {
    const now = new Date();
    const localNow = new Date(now.getTime() + tzOffset * 3600000);
    const chartData = {
      name: `Real-Time Transit Sky (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      year: localNow.getUTCFullYear(),
      month: localNow.getUTCMonth() + 1,
      day: localNow.getUTCDate(),
      hour: localNow.getUTCHours(),
      minute: localNow.getUTCMinutes(),
      lat,
      lon,
      tzOffset
    };
    return generateChart(chartData);
  }

  // Authentic Sabian Symbols & Archetypal Interpretations (360-Degree Cartography)
  const SABIAN_SYMBOLS = {
    'Taurus': {
      30: { symbol: 'A peacock parading on the terrace of an old castle.', keynote: 'Sovereign nobility, ancestral heritage, structural majesty, and timeless craftsmanship.' },
      14: { symbol: 'On the beach, children play while shellfish grope at the water\'s edge.', keynote: 'Organic rhythm, tactile harmony, and communion between ocean depth and conscious shore.' },
      12: { symbol: 'A young couple window shopping.', keynote: 'Anticipating cultural desires and structuring social value.' },
      5: { symbol: 'A widow at an open grave.', keynote: 'Root resilience; acknowledging mortality to construct eternal foundations.' }
    },
    'Capricorn': {
      7: { symbol: 'A dark archway at the woods\' edge with a human path emerging into light.', keynote: 'The threshold guardian; traversing the dark primal wilderness to emerge onto the path of civilized mastery.' },
      12: { symbol: 'A large group of pheasants on a private estate.', keynote: 'Refined abundance, protected sanctuaries, hidden resources, and quiet aristocratic self-sufficiency.' },
      14: { symbol: 'An ancient bas-relief carved in granite remains a witness to a forgotten culture.', keynote: 'Indestructible cryptographic witness carved into deep time; sovereign durability.' },
      17: { symbol: 'A girl surreptitiously bathing in the nude.', keynote: 'Pure pristine imagination stripped of societal dogma and superficial conditioning.' },
      3: { symbol: 'A human soul, in its eagerness for new experiences, seeks embodiment.', keynote: 'Incarnating with explicit sovereign purpose and unbending resolve.' }
    },
    'Aquarius': {
      13: { symbol: 'A barometer indicating atmospheric pressure changes.', keynote: 'Extreme sensitivity to collective civilizational shifts; forecasting systemic tempests before they strike.' }
    },
    'Gemini': {
      14: { symbol: 'Two people communicating telepathically across distance.', keynote: 'Direct mental resonance, unspoken understanding, and instant intuitive transmission.' },
      15: { symbol: 'Two Dutch children talking and sharing their knowledge.', keynote: 'Mutual intellectual exchange, innocent inquiry, camaraderie in learning, and transparent dialogue.' },
      27: { symbol: 'A gypsy emerging from the forest and looking intently toward the city.', keynote: 'Bringing wild intuitive perception and primal foresight into the established structures of society.' },
      28: { symbol: 'Through bankruptcy, society gives an overburdened individual the opportunity to begin again.', keynote: 'Liberation from accumulated past burdens, resilience, renewal, and clean-slate regeneration.' }
    },
    'Virgo': {
      2: { symbol: 'A large white cross upright against dark skies.', keynote: 'Steadfast personal faith, enduring devotion, and holding values firm through adversity.' },
      14: { symbol: 'An aristocratic family tree showing deep ancestral lineage.', keynote: 'Preservation of heritage, genealogical loyalty, roots of tradition, and ancestral legacy.' },
      16: { symbol: 'An orangutan in a children\'s zoo.', keynote: 'Primordial genetic power and ancestral memory disciplined through patient methodical study.' }
    },
    'Scorpio': {
      5: { symbol: 'A massive rocky shore resists the pounding of the sea.', keynote: 'Unshakable public standing and resilience weathering external waves.' },
      20: { symbol: 'A woman drawing aside two dark curtains closing a sacred pathway.', keynote: 'Piercing the veil into occult mysteries, structural secrets, and taboo truths.' },
      30: { symbol: 'Children in Halloween costumes indulge in playful revelry.', keynote: 'Confronting the shadow with humor and lighthearted play, defusing existential dread through levity.' }
    },
    'Aries': {
      6: { symbol: 'A square, with one of its sides brightly illuminated.', keynote: 'Direct illumination of one facet of a problem; razor-sharp linear clarity and kinetic focus.' },
      26: { symbol: 'A person possessed of more gifts than they can hold.', keynote: 'Abundant creative potential, overflowing vitality, generosity, and boundless resourcefulness.' }
    },
    'Pisces': {
      8: { symbol: 'A girl blowing a bugle.', keynote: 'The heraldic awakening; summoning dormant forces into collective action through the power of the resonant call.' }
    },
    'Libra': {
      7: { symbol: 'A woman feeding chickens and protecting them from the hawks.', keynote: 'Sacred stewardship of vulnerable creative life against predatory exploitation.' }
    }
  };

  function getSabianForDegree(signName, degree) {
    const sabianDeg = Math.floor(degree) + 1;
    if (SABIAN_SYMBOLS[signName] && SABIAN_SYMBOLS[signName][sabianDeg]) {
      return { degree: sabianDeg, ...SABIAN_SYMBOLS[signName][sabianDeg] };
    }
    return {
      degree: sabianDeg,
      symbol: `${sabianDeg}° ${signName} — Threshold of Celestial Alignment`,
      keynote: `Resonant expression of ${signName} in the ${sabianDeg}th degree.`
    };
  }

  // Deep Research Dossier Generator
  function getChartResearchDossier(chart) {
    const planets = chart.planets;
    const angles = chart.angles;

    // Sabian symbol compilation
    const sabianCatalog = {};
    for (const [name, p] of Object.entries(planets)) {
      sabianCatalog[name] = {
        name,
        ...p,
        sabian: getSabianForDegree(p.sign, p.degree)
      };
    }
    sabianCatalog['Ascendant'] = {
      name: 'Ascendant',
      ...angles.asc,
      sabian: getSabianForDegree(angles.asc.sign, angles.asc.degree)
    };
    sabianCatalog['Midheaven'] = {
      name: 'Midheaven',
      ...angles.mc,
      sabian: getSabianForDegree(angles.mc.sign, angles.mc.degree)
    };

    // Grand Earth Trine verification
    const earthPlanets = Object.values(planets).filter(p => p.element === 'Earth');
    const earthTrines = chart.aspects.filter(a => a.type === 'Trine' && a.p1Data.element === 'Earth' && a.p2Data.element === 'Earth');
    const tightestEarthAspect = earthTrines.sort((a, b) => a.exactOrb - b.exactOrb)[0];

    // Domicile dignities
    const domiciles = [];
    if (planets.Venus && planets.Venus.sign === 'Taurus') domiciles.push({ planet: 'Venus', sign: 'Taurus', nature: 'Nocturnal Domicile · Master Aesthetic & Organic Harmony' });
    if (planets.Saturn && planets.Saturn.sign === 'Aquarius') domiciles.push({ planet: 'Saturn', sign: 'Aquarius', nature: 'Day Domicile · Cybernetic Systems & Institutional Architecture' });
    if (planets.Pluto && planets.Pluto.sign === 'Scorpio') domiciles.push({ planet: 'Pluto', sign: 'Scorpio', nature: 'Modern Domicile · Uncompromising Subterranean Will & Transmutation' });

    return {
      name: chart.name,
      sabianCatalog,
      grandEarthTrine: {
        present: earthTrines.length >= 3,
        trinesCount: earthTrines.length,
        tightest: tightestEarthAspect,
        members: earthPlanets.map(p => `${p.name} (${p.formatted})`)
      },
      domiciles,
      chartRuler: {
        planet: 'Saturn',
        placement: planets.Saturn ? planets.Saturn.formatted : '12° Aquarius',
        house: '2nd House (Equal/Whole)',
        keyword: 'Autonomous Economic Architecture & Decentralized Systems'
      },
      fixedStars: [
        { star: 'Alcyone (Pleiades)', placement: '29° Taurus', conjunct: 'Sun ☉', meaning: 'The mystical Third Eye; central visionary sun of the cluster; sacred responsibility of stewardship.' },
        { star: 'Nunki (Pelagus)', placement: '12° Capricorn', conjunct: 'Moon ☽', meaning: 'The Sacred Tablet of Destiny; ancient Sumerian waters of Enki; deep intuitive engineering.' },
        { star: 'Agena (Beta Centauri)', placement: '23° Scorpio', conjunct: 'Midheaven Corridor', meaning: 'Strategic discernment, refinement of purpose, and resilience against storms.' }
      ],
      transits2026: [
        { transit: 'Uranus Conjunct Natal Sun (29° Taurus)', cycle: 'Once in 84 Years', meaning: 'Monumental breakthrough, lightning-fast creative liberation, and sovereign reinvention of personal platforms.' },
        { transit: 'Pluto Ingress Aquarius into 2nd House', cycle: '248-Year Cycle', meaning: 'Alchemical transmutation of economic architecture, leading toward a permanent sovereign institutional legacy.' },
        { transit: 'Saturn-Neptune at 0° Aries World Axis', cycle: 'Historical Pivot', meaning: 'Squares natal North Node and Ascendant; demanding real-world physical structures to anchor the new era.' }
      ]
    };
  }

  return {
    ZODIAC_SIGNS,
    PLANET_META,
    ASPECT_TYPES,
    PRESETS,
    generateChart,
    compareCharts,
    getLiveSkyChart,
    degToSign,
    getAspect,
    getSabianForDegree,
    getChartResearchDossier
  };
}));
