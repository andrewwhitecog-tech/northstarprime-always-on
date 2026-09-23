/**
 * AETHERIA KAMEA SIGIL SYNTHESIZER
 * Planetary Magic Square Vector Sigil Generator based on Agrippa's Three Books of Occult Philosophy.
 * Generates pure SVG paths, printable emblems, and sticker-ready exports.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AetheriaKamea = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Standard Agrippa Planetary Magic Squares
  const SQUARES = {
    Saturn: {
      order: 3,
      planet: 'Saturn',
      symbol: '♄',
      constant: 15,
      color: '#94a3b8',
      meaning: 'Structure, Boundaries, Time & Sovereign Mastery',
      grid: [
        [4, 9, 2],
        [3, 5, 7],
        [8, 1, 6]
      ]
    },
    Jupiter: {
      order: 4,
      planet: 'Jupiter',
      symbol: '♃',
      constant: 34,
      color: '#eab308',
      meaning: 'Abundance, Expansion, Fortune & High Wisdom',
      grid: [
        [4, 14, 15, 1],
        [9, 7, 6, 12],
        [5, 11, 10, 8],
        [16, 2, 3, 13]
      ]
    },
    Mars: {
      order: 5,
      planet: 'Mars',
      symbol: '♂',
      constant: 65,
      color: '#ef4444',
      meaning: 'Courage, Willpower, Tactical Victory & Protection',
      grid: [
        [11, 24, 7, 20, 3],
        [4, 12, 25, 8, 16],
        [17, 5, 13, 21, 9],
        [10, 18, 1, 14, 22],
        [23, 6, 19, 2, 15]
      ]
    },
    Sun: {
      order: 6,
      planet: 'Sun',
      symbol: '☉',
      constant: 111,
      color: '#f59e0b',
      meaning: 'Vitality, Creative Authority, Illumination & Truth',
      grid: [
        [6, 32, 3, 34, 35, 1],
        [7, 11, 27, 28, 8, 30],
        [19, 14, 16, 15, 23, 24],
        [18, 20, 22, 21, 17, 13],
        [25, 29, 10, 9, 26, 12],
        [36, 5, 33, 4, 2, 31]
      ]
    },
    Venus: {
      order: 7,
      planet: 'Venus',
      symbol: '♀',
      constant: 175,
      color: '#ec4899',
      meaning: 'Love, Harmonic Beauty, Magnetism & Creative Art',
      grid: (function () {
        // Standard Siamese method for odd order 7x7
        const n = 7;
        const g = Array.from({ length: n }, () => Array(n).fill(0));
        let r = 0, c = Math.floor(n / 2);
        for (let num = 1; num <= n * n; num++) {
          g[r][c] = num;
          const nr = (r - 1 + n) % n;
          const nc = (c + 1) % n;
          if (g[nr][nc] !== 0) {
            r = (r + 1) % n;
          } else {
            r = nr;
            c = nc;
          }
        }
        return g;
      })()
    },
    Mercury: {
      order: 8,
      planet: 'Mercury',
      symbol: '☿',
      constant: 260,
      color: '#38bdf8',
      meaning: 'Intelligence, Communication, Swift Strategy & Commerce',
      grid: (function () {
        // 8x8 Benjamin Franklin / standard alternating magic square
        const n = 8;
        const g = Array.from({ length: n }, () => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const rowInvert = (Math.floor(i / 2) % 2) === (Math.floor(j / 2) % 2);
            g[i][j] = rowInvert ? (n * n + 1 - (i * n + j + 1)) : (i * n + j + 1);
          }
        }
        return g;
      })()
    },
    Moon: {
      order: 9,
      planet: 'Moon',
      symbol: '☽',
      constant: 369,
      color: '#e2e8f0',
      meaning: 'Intuition, Memory, Dreams & Subconscious Fortress',
      grid: (function () {
        const n = 9;
        const g = Array.from({ length: n }, () => Array(n).fill(0));
        let r = 0, c = Math.floor(n / 2);
        for (let num = 1; num <= n * n; num++) {
          g[r][c] = num;
          const nr = (r - 1 + n) % n;
          const nc = (c + 1) % n;
          if (g[nr][nc] !== 0) {
            r = (r + 1) % n;
          } else {
            r = nr;
            c = nc;
          }
        }
        return g;
      })()
    }
  };

  // Convert phrase to array of numbers
  function phraseToNumbers(phrase, maxNumber) {
    const clean = phrase.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return [1, 2, 3];

    const nums = [];
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      let val = 1;
      if (code >= 65 && code <= 90) {
        val = code - 64; // A=1 ... Z=26
      } else if (code >= 48 && code <= 57) {
        val = code - 48 + 27; // 0=27 ... 9=36
      }

      // Reduce or wrap into square range
      let target = val;
      if (target > maxNumber) {
        // Digital root reduction or modulo
        target = ((val - 1) % maxNumber) + 1;
      }
      nums.push(target);
    }

    // Deduplicate consecutive identical numbers to create meaningful vectors
    const filtered = [];
    for (let i = 0; i < nums.length; i++) {
      if (i === 0 || nums[i] !== filtered[filtered.length - 1]) {
        filtered.push(nums[i]);
      }
    }
    return filtered.length >= 2 ? filtered : [nums[0] || 1, ((nums[0] || 1) % maxNumber) + 1];
  }

  // Find grid coordinates (x, y) for a number in the Kamea
  function findNumberCoord(grid, num) {
    const n = grid.length;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] === num) {
          return { row: r, col: c };
        }
      }
    }
    return { row: 0, col: 0 };
  }

  // Generate SVG Sigil Vector Path and Grid Visualizer
  function generateSigil(phrase, planetName = 'Saturn', size = 400) {
    const kamea = SQUARES[planetName] || SQUARES.Saturn;
    const n = kamea.order;
    const maxNum = n * n;
    const numbers = phraseToNumbers(phrase, maxNum);
    const cellSize = (size - 60) / n;
    const padding = 30;

    const points = numbers.map(num => {
      const { row, col } = findNumberCoord(kamea.grid, num);
      return {
        num,
        x: padding + col * cellSize + cellSize / 2,
        y: padding + row * cellSize + cellSize / 2
      };
    });

    // Build SVG Path
    let pathD = '';
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (i === 0) {
        pathD += `M ${pt.x} ${pt.y}`;
      } else {
        pathD += ` L ${pt.x} ${pt.y}`;
      }
    }

    // Calculate terminal crossbar perpendicular to the last line segment
    let terminalLine = null;
    if (points.length >= 2) {
      const pLast = points[points.length - 1];
      const pPrev = points[points.length - 2];
      const dx = pLast.x - pPrev.x;
      const dy = pLast.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const barLen = 14;
      terminalLine = {
        x1: pLast.x - nx * barLen,
        y1: pLast.y - ny * barLen,
        x2: pLast.x + nx * barLen,
        y2: pLast.y + ny * barLen
      };
    }

    return {
      planet: planetName,
      symbol: kamea.symbol,
      meaning: kamea.meaning,
      constant: kamea.constant,
      color: kamea.color,
      phrase,
      numbers,
      points,
      pathD,
      terminalLine,
      startCircle: points[0] ? { x: points[0].x, y: points[0].y, r: 7 } : null,
      size,
      cellSize,
      padding,
      grid: kamea.grid
    };
  }

  // Render Sigil into SVG Markup string
  function renderSigilSVG(sigilData, options = {}) {
    const { showGrid = true, showNumbers = false, glow = true } = options;
    const { size, padding, cellSize, grid, pathD, startCircle, terminalLine, color, symbol, planet, phrase } = sigilData;
    const n = grid.length;

    let gridSVG = '';
    if (showGrid) {
      // Background cell boxes
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x = padding + c * cellSize;
          const y = padding + r * cellSize;
          const val = grid[r][c];
          gridSVG += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
          if (showNumbers) {
            gridSVG += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 4}" font-family="'Cinzel', serif" font-size="${Math.max(9, Math.floor(cellSize * 0.28))}" fill="rgba(255,255,255,0.3)" text-anchor="middle">${val}</text>`;
          }
        }
      }
    }

    const glowFilter = glow ? `
      <defs>
        <filter id="sigilGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>` : '';

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="background:#080c16; border-radius:12px; overflow:hidden;">
  ${glowFilter}
  <!-- Outer Sacred Geometry Ring -->
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 8}" fill="none" stroke="rgba(245,158,11,0.25)" stroke-width="1.5" stroke-dasharray="4, 4"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 14}" fill="none" stroke="rgba(245,158,11,0.4)" stroke-width="1"/>

  <!-- Kamea Grid -->
  <g class="kamea-grid">
    ${gridSVG}
  </g>

  <!-- Sigil Vector Path -->
  <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#sigilGlow)"/>

  <!-- Start Circle -->
  ${startCircle ? `<circle cx="${startCircle.x}" cy="${startCircle.y}" r="${startCircle.r}" fill="#080c16" stroke="${color}" stroke-width="2.5"/>` : ''}

  <!-- Terminal Crossbar -->
  ${terminalLine ? `<line x1="${terminalLine.x1}" y1="${terminalLine.y1}" x2="${terminalLine.x2}" y2="${terminalLine.y2}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` : ''}

  <!-- Header & Footer Metadata -->
  <text x="${padding}" y="20" font-family="'Cinzel', serif" font-size="11" letter-spacing="2" fill="${color}">${symbol} KAMEA OF ${planet.toUpperCase()}</text>
  <text x="${size - padding}" y="20" font-family="'Inter', sans-serif" font-size="10" fill="#94a3b8" text-anchor="end">ORDER ${n}x${n}</text>
  <text x="${size / 2}" y="${size - 10}" font-family="'Courier New', monospace" font-size="10" letter-spacing="1" fill="#cbd5e1" text-anchor="middle">SIGIL: "${phrase.toUpperCase()}"</text>
</svg>`.trim();
  }

  return {
    SQUARES,
    phraseToNumbers,
    generateSigil,
    renderSigilSVG
  };
}));
