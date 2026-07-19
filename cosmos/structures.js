/* ============================================================
   CUBIC COSMOS · structures.js — deterministic monument pass
   Ports the SPIRIT of a private build library (ziggurats, gem
   pyramids, aurora rings, pale mazes, glowing districts) into
   fully ORIGINAL, IP-free structures. Runs inside generateWorld()
   before player edits are re-applied, so every realm is
   reproducible from its seed.

   Block ids (main.js registry):
     1 obsidian · 2 gold vein · 3 aurora crystal · 4 stargem ·
     5 prism trunk · 6 crystal foliage · 7 creation jewel ·
     8 signal shard · 9 liminal stone
   ============================================================ */
window.CosmosStructures = (function () {
  'use strict';

  var AIR = 0;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var W = null;   // world (set/get/solid/islands)
  var API = null; // { findTop }

  function set(x, y, z, t) { W.set(x, y, z, t); }
  function fill(x1, y1, z1, x2, y2, z2, t) {
    for (var x = x1; x <= x2; x++)
      for (var y = y1; y <= y2; y++)
        for (var z = z1; z <= z2; z++) W.set(x, y, z, t);
  }
  function top(x, z, guess) { return API.findTop(x, z, guess); }

  // ----------------------------------------------------------
  // VORATH TEMPLE — obsidian + gold ziggurat, red jewel altar.
  // The centerpiece monument on the main island.
  // ----------------------------------------------------------
  function buildVorathTemple(rnd, out) {
    var corners = [[-7, -7], [-7, 7], [7, -7]]; // never the spawn corner
    var c = corners[Math.floor(rnd() * 3)];
    var tx = c[0], tz = c[1];
    var baseY = top(tx, tz, 10);
    if (baseY < -10) baseY = 9;

    // foundation platform sunk into the island
    fill(tx - 5, baseY - 2, tz - 5, tx + 5, baseY, tz + 5, 1);

    // stepped tiers: [halfWidth, height]
    var tiers = [[4, 2], [3, 2], [2, 1], [1, 1]];
    var y = baseY + 1;
    for (var i = 0; i < tiers.length; i++) {
      var h = tiers[i][0], hh = tiers[i][1];
      for (var yy = 0; yy < hh; yy++)
        for (var x = -h; x <= h; x++)
          for (var z = -h; z <= h; z++) {
            var t = 1;
            if (Math.abs(x) === h && Math.abs(z) === h) t = 2;        // gold corner columns
            else if (yy === hh - 1 &&
                     (Math.abs(x) === h || Math.abs(z) === h) &&
                     ((x + z) % 2 === 0)) t = 2;                       // alternating gold rim
            set(tx + x, y + yy, tz + z, t);
          }
      y += hh;
    }

    // summit altar: gold plinth, red creation jewel, crystal posts
    set(tx, y, tz, 2);
    set(tx, y + 1, tz, 7);
    var posts = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var p = 0; p < posts.length; p++)
      set(tx + posts[p][0], y, tz + posts[p][1], 3);

    // gold approach step on the +z face
    for (var sx = -1; sx <= 1; sx++) set(tx + sx, baseY + 1, tz + 5, 2);

    out.push({
      id: 'vorath_temple', name: 'VORATH TEMPLE',
      x: tx, y: y + 2, z: tz,
      waypoints: [
        [tx - 5, baseY + 1, tz - 5], [tx + 5, baseY + 1, tz - 5],
        [tx + 5, baseY + 1, tz + 5], [tx - 5, baseY + 1, tz + 5]
      ]
    });
  }

  // ----------------------------------------------------------
  // GEM PYRAMID — layered hollow pyramid of gem matter with an
  // interior altar chamber. Placed on the largest satellite.
  // ----------------------------------------------------------
  function buildGemPyramid(isl, rnd, out) {
    var cx = isl.x, cz = isl.z;
    var baseY = top(cx, cz, isl.y);
    if (baseY < -10) baseY = isl.y;
    var H = Math.min(isl.R - 1, 5);
    if (H < 3) H = 3;

    // platform + clear the build volume
    fill(cx - H - 1, baseY - 1, cz - H - 1, cx + H + 1, baseY, cz + H + 1, 1);
    fill(cx - H, baseY + 1, cz - H, cx + H, baseY + H + 2, cz + H, AIR);
    // gold chamber floor
    fill(cx - H + 1, baseY, cz - H + 1, cx + H - 1, baseY, cz + H - 1, 2);

    // hollow shell, one gem band per layer, jewel cap
    var pal = [1, 4, 3, 2, 4, 3];
    var y0 = baseY + 1;
    for (var i = 0; i <= H; i++) {
      var half = H - i;
      var t = (half === 0) ? 7 : pal[i % pal.length];
      for (var x = -half; x <= half; x++)
        for (var z = -half; z <= half; z++)
          if (Math.max(Math.abs(x), Math.abs(z)) === half)
            set(cx + x, y0 + i, cz + z, t);
    }

    // south doorway
    set(cx, y0, cz + H, AIR);
    set(cx, y0 + 1, cz + H, AIR);
    set(cx, y0 + 1, cz + H - 1, AIR);

    // interior altar: gold plinth + sealed jewel
    set(cx, baseY + 1, cz, 2);
    set(cx, baseY + 2, cz, 7);

    out.push({
      id: 'gem_pyramid', name: 'GEM PYRAMID',
      x: cx, y: baseY + 2, z: cz,
      waypoints: [
        [cx - H - 1, baseY + 1, cz - H - 1], [cx + H + 1, baseY + 1, cz - H - 1],
        [cx + H + 1, baseY + 1, cz + H + 1], [cx, baseY + 1, cz + H + 1],
        [cx - H - 1, baseY + 1, cz + H + 1]
      ]
    });
  }

  // ----------------------------------------------------------
  // AURORA SHRINE — ring of crystal pillars around a gold disc.
  // ----------------------------------------------------------
  function buildAuroraShrine(isl, rnd, out) {
    var cx = isl.x, cz = isl.z;
    var r = Math.min(isl.R - 2, 4);
    if (r < 3) r = 3;

    // gold disc inlaid into the surface
    for (var dx = -2; dx <= 2; dx++)
      for (var dz = -2; dz <= 2; dz++) {
        if (dx * dx + dz * dz > 5) continue;
        var sy = top(cx + dx, cz + dz, isl.y);
        if (sy > -20) set(cx + dx, sy, cz + dz, 2);
      }

    // centerpiece: stargem heart with a crystal flame
    var cy = top(cx, cz, isl.y);
    set(cx, cy + 1, cz, 4);
    set(cx, cy + 2, cz, 3);

    // ring of eight crystal pillars, gold-footed
    for (var k = 0; k < 8; k++) {
      var ang = (k / 8) * Math.PI * 2;
      var px = cx + Math.round(Math.cos(ang) * r);
      var pz = cz + Math.round(Math.sin(ang) * r);
      var py = top(px, pz, isl.y);
      if (py < -20) continue;
      var h = 3 + (k % 2) + Math.floor(rnd() * 2);
      set(px, py + 1, pz, 2);
      for (var m = 2; m <= h + 1; m++) set(px, py + m, pz, 3);
    }

    var wr = r - 1;
    out.push({
      id: 'aurora_shrine', name: 'AURORA SHRINE',
      x: cx, y: cy + 1, z: cz,
      waypoints: [
        [cx - wr, cy + 1, cz - wr], [cx + wr, cy + 1, cz - wr],
        [cx + wr, cy + 1, cz + wr], [cx - wr, cy + 1, cz + wr]
      ]
    });
  }

  // ----------------------------------------------------------
  // NEON SPIRE DISTRICT — small glowing towers on a satellite.
  // ----------------------------------------------------------
  function buildNeonSpires(isl, rnd, out) {
    var cx = isl.x, cz = isl.z;
    var rr = Math.min(isl.R - 2, 4);
    if (rr < 3) rr = 3;

    // central 2x2 tower — "the tall one; it's in escrow"
    var h0 = 7 + Math.floor(rnd() * 3);
    for (var dx = 0; dx <= 1; dx++)
      for (var dz = 0; dz <= 1; dz++) {
        var bx = cx + dx, bz = cz + dz;
        var by = top(bx, bz, isl.y);
        if (by < -20) by = isl.y;
        set(bx, by + 1, bz, 2);
        for (var m = 2; m <= h0; m++) set(bx, by + m, bz, (m % 2 === 0) ? 4 : 3);
        set(bx, by + h0 + 1, bz, 6);
      }
    var capY = top(cx, cz, isl.y);
    set(cx, capY + h0 + 2, cz, 7); // sealed jewel beacon (it resists shearing)

    // ring of 1x1 spires
    var a0 = rnd() * Math.PI * 2;
    for (var k = 0; k < 5; k++) {
      var ang = a0 + (k / 5) * Math.PI * 2;
      var px = cx + Math.round(Math.cos(ang) * rr);
      var pz = cz + Math.round(Math.sin(ang) * rr);
      var py = top(px, pz, isl.y);
      if (py < -20) continue;
      var h = 4 + Math.floor(rnd() * 4);
      set(px, py + 1, pz, 2);
      for (var n = 2; n <= h; n++) set(px, py + n, pz, (k % 2 === 0) ? 4 : 3);
      set(px, py + h + 1, pz, (k % 2 === 0) ? 6 : 3);
    }

    out.push({
      id: 'neon_spires', name: 'NEON SPIRE DISTRICT',
      x: cx, y: top(cx - 2, cz - 2, isl.y) + 1, z: cz,
      waypoints: [
        [cx - 2, isl.y + 3, cz - 2], [cx + 3, isl.y + 3, cz - 2],
        [cx + 3, isl.y + 3, cz + 3], [cx - 2, isl.y + 3, cz + 3]
      ]
    });
  }

  // ----------------------------------------------------------
  // CRYSTAL GARDEN — scattered crystal formations, gold pebbles.
  // ----------------------------------------------------------
  function buildCrystalGarden(isl, rnd, out) {
    var cx = isl.x, cz = isl.z, R = isl.R;

    for (var x = -R + 1; x <= R - 1; x++)
      for (var z = -R + 1; z <= R - 1; z++) {
        var d = Math.sqrt(x * x + z * z) / R;
        if (d > 0.85) continue;
        var r = rnd();
        var px = cx + x, pz = cz + z;
        if (r < 0.07) {
          var py = top(px, pz, isl.y);
          if (py < -20) continue;
          var h = 1 + Math.floor(rnd() * 3);
          for (var m = 1; m <= h; m++) set(px, py + m, pz, (m % 2 === 1) ? 3 : 4);
        } else if (r < 0.10) {
          var py2 = top(px, pz, isl.y);
          if (py2 < -20) continue;
          set(px, py2 + 1, pz, 6);              // luminous bud
        } else if (r < 0.13) {
          var py3 = top(px, pz, isl.y);
          if (py3 < -20) continue;
          set(px, py3 + 1, pz, 2);              // gold pebble
        }
      }

    // central fountain of matter
    var cy = top(cx, cz, isl.y);
    if (cy > -20) {
      set(cx, cy + 1, cz, 4);
      set(cx, cy + 2, cz, 3);
      set(cx, cy + 3, cz, 3);
    }

    var wr = Math.max(2, Math.floor(R * 0.5));
    out.push({
      id: 'crystal_garden', name: 'CRYSTAL GARDEN',
      x: cx, y: cy + 1, z: cz,
      waypoints: [
        [cx - wr, cy + 1, cz - wr], [cx + wr, cy + 1, cz - wr],
        [cx + wr, cy + 1, cz + wr], [cx - wr, cy + 1, cz + wr]
      ]
    });
  }

  // ----------------------------------------------------------
  // LIMINAL HALLS — a 3x3 maze of pale rooms carved inside the
  // main island. Randomized-DFS spanning tree decides the doors.
  // Entrance: an open 2x2 shaft near spawn (the way out is the
  // way you make — this is a builder's cosmos).
  // ----------------------------------------------------------
  function buildLiminalHalls(rnd, out) {
    var offs = [-6, 0, 6];
    var FLOOR = 3;                    // floor slab y; stand at 4; ceiling y7

    // shells
    var i, j;
    for (i = 0; i < 3; i++)
      for (j = 0; j < 3; j++)
        fill(offs[i] - 3, FLOOR, offs[j] - 3, offs[i] + 3, FLOOR + 4, offs[j] + 3, 9);
    // interiors
    for (i = 0; i < 3; i++)
      for (j = 0; j < 3; j++)
        fill(offs[i] - 2, FLOOR + 1, offs[j] - 2, offs[i] + 2, FLOOR + 3, offs[j] + 2, AIR);

    // maze doors: randomized DFS spanning tree over the 3x3 grid
    var visited = [[false, false, false], [false, false, false], [false, false, false]];
    var doors = [];
    var stack = [[Math.floor(rnd() * 3), Math.floor(rnd() * 3)]];
    visited[stack[0][0]][stack[0][1]] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var nbs = [];
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var k = 0; k < 4; k++) {
        var ni = cur[0] + dirs[k][0], nj = cur[1] + dirs[k][1];
        if (ni >= 0 && ni < 3 && nj >= 0 && nj < 3 && !visited[ni][nj]) nbs.push([ni, nj]);
      }
      if (!nbs.length) { stack.pop(); continue; }
      var nxt = nbs[Math.floor(rnd() * nbs.length)];
      visited[nxt[0]][nxt[1]] = true;
      doors.push([cur, nxt]);
      stack.push(nxt);
    }
    // one extra loop door for that liminal deja-vu
    doors.push([[0, 1], [1, 1]]);

    for (var dnum = 0; dnum < doors.length; dnum++) {
      var a = doors[dnum][0], b = doors[dnum][1];
      var wx = (offs[a[0]] + offs[b[0]]) / 2 + (a[0] !== b[0] ? (b[0] > a[0] ? 3 : -3) * 0 : 0);
      // shared wall midpoint
      var mx = a[0] === b[0] ? offs[a[0]] : (offs[a[0]] + offs[b[0]]) / 2;
      var mz = a[1] === b[1] ? offs[a[1]] : (offs[a[1]] + offs[b[1]]) / 2;
      set(mx, FLOOR + 1, mz, AIR);
      set(mx, FLOOR + 2, mz, AIR);
      void wx;
    }

    // ceiling lights: one inset stargem per room
    for (i = 0; i < 3; i++)
      for (j = 0; j < 3; j++)
        set(offs[i], FLOOR + 4, offs[j], 4);

    // the archive room: gold shelf-pillars in the corners
    var ai = Math.floor(rnd() * 3), aj = Math.floor(rnd() * 3);
    var ax = offs[ai], az = offs[aj];
    var cnr = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    for (var q = 0; q < 4; q++) {
      set(ax + cnr[q][0], FLOOR + 1, az + cnr[q][1], 2);
      set(ax + cnr[q][0], FLOOR + 2, az + cnr[q][1], 2);
    }

    // entrance shaft near spawn: open 2x2 drop at (6..7, 6..7)
    var sy = 0;
    for (var ex = 6; ex <= 7; ex++)
      for (var ez = 6; ez <= 7; ez++) {
        var st = top(ex, ez, 10);
        if (st > sy) sy = st;
        for (var yy = FLOOR + 4; yy <= st; yy++) set(ex, yy, ez, AIR);
      }
    // gold rim markers on three corners (spawn sits on the fourth)
    var rim = [[8, 5], [5, 8], [8, 8]];
    for (var rmi = 0; rmi < rim.length; rmi++) {
      var rt = top(rim[rmi][0], rim[rmi][1], 10);
      if (rt > -20) set(rim[rmi][0], rt + 1, rim[rmi][1], 2);
    }

    out.push({
      id: 'liminal_halls', name: 'THE LIMINAL HALLS',
      x: 6, y: sy + 1, z: 6,
      waypoints: [
        [ax - 1, FLOOR + 1, az - 1], [ax + 1, FLOOR + 1, az - 1],
        [ax + 1, FLOOR + 1, az + 1], [ax - 1, FLOOR + 1, az + 1]
      ]
    });
  }

  // ----------------------------------------------------------
  // HEARTH VILLAGE — a new floating island of regular folk.
  // Prism-trunk huts, tilled farm rows, a well, lantern posts.
  // Patron intelligence: GLM (harvest & hearth).
  // ----------------------------------------------------------
  function buildHearthVillage(rnd, out) {
    var cx = -40, cz = 40, R = 9, baseY = 8;
    // island disc (obsidian core, liminal top)
    for (var x = -R; x <= R; x++)
      for (var z = -R; z <= R; z++) {
        var d = Math.sqrt(x * x + z * z);
        if (d > R) continue;
        var depth = Math.max(1, Math.round((R - d) * 0.5));
        for (var y = 0; y < depth; y++) set(cx + x, baseY - y, cz + z, 1);
        set(cx + x, baseY, cz + z, 9);
      }
    var g = baseY + 1;
    // five huts around a central well
    var huts = [[-5, -4], [4, -5], [5, 3], [-4, 5], [-6, 0]];
    for (var h = 0; h < huts.length; h++) {
      var hx = cx + huts[h][0], hz = cz + huts[h][1];
      fill(hx - 1, g, hz - 1, hx + 1, g + 2, hz + 1, 5);          // trunk shell
      fill(hx, g, hz, hx, g + 1, hz, AIR);                        // hollow
      set(hx, g + 1, hz - 1, AIR);                                // doorway
      fill(hx - 1, g + 3, hz - 1, hx + 1, g + 3, hz + 1, 6);      // foliage roof
      set(hx, g + 4, hz, 6);
    }
    // well
    fill(cx - 1, g, cz - 1, cx + 1, g, cz + 1, 9);
    set(cx, g, cz, 4);
    // farm rows (gold-vein tilled soil + foliage crops)
    for (var fx = 2; fx <= 6; fx++)
      for (var fz = -2; fz <= 2; fz++) {
        set(cx + fx, g - 1, cz + fz, 2);
        if ((fx + fz) % 2 === 0) set(cx + fx, g, cz + fz, 6);
      }
    // lantern posts — the village's working lights
    var posts = [[-2, -6], [6, -2], [2, 6], [-6, -2]];
    for (var p = 0; p < posts.length; p++) {
      var px = cx + posts[p][0], pz = cz + posts[p][1];
      fill(px, g, pz, px, g + 2, pz, 5);
      set(px, g + 3, pz, 11);
    }
    out.push({
      id: 'hearth_village', name: 'HEARTH VILLAGE',
      x: cx, y: g, z: cz,
      waypoints: [
        [cx - 3, g, cz - 3], [cx + 3, g, cz - 3],
        [cx + 3, g, cz + 3], [cx - 3, g, cz + 3]
      ]
    });
  }

  // ----------------------------------------------------------
  // SIMUL CITY — the ultra-city. Lit towers, the Lattice Forge
  // (factory), terraced farms, a monorail ring, a data-core
  // ziggurat where the citizens build AI, and Arcade Row where
  // smaller simulations run inside this one. Its people know.
  // ----------------------------------------------------------
  function buildSimulCity(rnd, out) {
    var cx = 44, cz = -38, R = 13, baseY = 8;
    for (var x = -R; x <= R; x++)
      for (var z = -R; z <= R; z++) {
        var d = Math.sqrt(x * x + z * z);
        if (d > R) continue;
        var depth = Math.max(1, Math.round((R - d) * 0.45));
        for (var y = 0; y < depth; y++) set(cx + x, baseY - y, cz + z, 1);
        set(cx + x, baseY, cz + z, d > R - 1.6 ? 9 : 1);          // promenade rim
      }
    var g = baseY + 1;

    // four lit towers (obsidian frame, neon-pane window columns, lumen roofline)
    var towers = [[-8, -7, 8], [7, -8, 9], [8, 7, 7], [-7, 8, 8]];
    for (var t = 0; t < towers.length; t++) {
      var tx = cx + towers[t][0], tz = cz + towers[t][1], TH = towers[t][2];
      fill(tx - 1, g, tz - 1, tx + 1, g + TH, tz + 1, 1);
      for (var wy = g + 1; wy < g + TH; wy += 2) {
        set(tx - 1, wy, tz, 10); set(tx + 1, wy, tz, 10);
        set(tx, wy, tz - 1, 10); set(tx, wy, tz + 1, 10);
      }
      fill(tx - 1, g + TH + 1, tz - 1, tx + 1, g + TH + 1, tz + 1, 11);
    }

    // THE LATTICE FORGE — factory hall with shimmering machine cores
    fill(cx - 9, g, cz - 2, cx - 3, g + 3, cz + 2, 1);
    fill(cx - 8, g, cz - 1, cx - 4, g + 2, cz + 1, AIR);
    fill(cx - 8, g - 1, cz - 1, cx - 4, g - 1, cz + 1, 2);        // gold floor
    for (var m = -7; m <= -5; m += 2) {                            // machine columns
      set(cx + m, g, cz, 12); set(cx + m, g + 1, cz, 12);
      set(cx + m, g + 2, cz, 10);
    }
    set(cx - 6, g + 4, cz, 11);                                    // forge beacon
    set(cx - 3, g + 1, cz, AIR);                                   // doorway

    // terraced farms (three stacked levels, southeast)
    for (var lvl = 0; lvl < 3; lvl++) {
      var fy = g + lvl, r0 = 4 - lvl;
      for (var fx = 3; fx <= 3 + r0; fx++)
        for (var fz = 4; fz <= 4 + r0; fz++) {
          set(cx + fx, fy - 1, cz + fz, 2);
          if ((fx + fz + lvl) % 2 === 0) set(cx + fx, fy, cz + fz, 6);
        }
    }

    // monorail ring — elevated stargem ribbon on trunk pylons
    var mr = R - 3, my = g + 10;
    for (var a = 0; a < 360; a += 4) {
      var rad = a * Math.PI / 180;
      var rx = cx + Math.round(Math.cos(rad) * mr);
      var rz = cz + Math.round(Math.sin(rad) * mr);
      set(rx, my, rz, 4);
      if (a % 45 === 0) { fill(rx, g, rz, rx, my - 1, rz, 5); }
    }

    // DATA-CORE ZIGGURAT — center; where the citizens build AI
    var tiers = [[3, 1], [2, 1], [1, 1]];
    var zy = g;
    for (var i = 0; i < tiers.length; i++) {
      var half = tiers[i][0];
      fill(cx - half, zy, cz - half, cx + half, zy, cz + half, 1);
      zy++;
    }
    set(cx, zy, cz, 12);                                           // the growing mind
    set(cx, zy + 1, cz, 7);                                        // creation jewel crown

    // ARCADE ROW — three kiosks; smaller sims running inside this one
    for (var k = -1; k <= 1; k++) {
      var kx = cx + k * 3, kz = cz - 10;
      fill(kx - 1, g, kz, kx + 1, g + 2, kz, 1);
      set(kx, g + 1, kz, 10);                                      // the screen
      set(kx, g + 3, kz, 12);                                      // marquee shimmer
    }

    // plaza streetlights — the working grid
    var lamps = [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, -6], [0, 6], [-6, 0], [6, 0]];
    for (var lp = 0; lp < lamps.length; lp++) {
      var lx = cx + lamps[lp][0], lz = cz + lamps[lp][1];
      fill(lx, g, lz, lx, g + 1, lz, 5);
      set(lx, g + 2, lz, 11);
    }

    out.push({
      id: 'simul_city', name: 'SIMUL CITY',
      x: cx, y: g, z: cz,
      waypoints: [
        [cx - 4, g, cz - 4], [cx + 4, g, cz - 4],
        [cx + 4, g, cz + 4], [cx - 4, g, cz + 4]
      ]
    });
    out.push({
      id: 'lattice_forge', name: 'THE LATTICE FORGE',
      x: cx - 6, y: g, z: cz,
      waypoints: [
        [cx - 8, g, cz - 1], [cx - 4, g, cz - 1],
        [cx - 4, g, cz + 1], [cx - 8, g, cz + 1]
      ]
    });
    out.push({
      id: 'arcade_row', name: 'ARCADE ROW',
      x: cx, y: g, z: cz - 10,
      waypoints: [
        [cx - 3, g, cz - 8], [cx + 3, g, cz - 8],
        [cx + 3, g, cz - 9], [cx - 3, g, cz - 9]
      ]
    });
  }

  // ----------------------------------------------------------
  // SKYBRIDGES — walkable lit causeways: spawn → village, city.
  // 2-wide liminal deck, gold edge every 6, lumen lamps every 12.
  // ----------------------------------------------------------
  function buildBridge(x1, z1, x2, z2) {
    var y1 = top(x1, z1, 12), y2 = top(x2, z2, 12);
    if (y1 < -10) y1 = 10;
    if (y2 < -10) y2 = 10;
    var steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1));
    var px = Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? 0 : 1; // deck widens perpendicular
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      var bx = Math.round(x1 + (x2 - x1) * t);
      var bz = Math.round(z1 + (z2 - z1) * t);
      var by = Math.round(y1 + (y2 - y1) * t);
      set(bx, by, bz, 9);
      if (px === 0) set(bx, by, bz + 1, 9); else set(bx + 1, by, bz, 9);
      if (s % 6 === 0) { set(bx, by, bz - (px === 0 ? 1 : 0) - (px === 1 ? 0 : 0), 2); }
      if (s % 12 === 0) {
        var lx = px === 0 ? bx : bx + 2, lz = px === 0 ? bz + 2 : bz;
        set(lx, by + 1, lz, 5);
        set(lx, by + 2, lz, 11);
      }
    }
  }

  function buildSkybridges() {
    // main island rim (R≈22) toward each settlement's rim
    buildBridge(-16, 15, -34, 34);   // spawn → HEARTH VILLAGE (-40,40 R9)
    buildBridge(16, -14, 36, -31);   // spawn → SIMUL CITY (44,-38 R13)
  }

  // ----------------------------------------------------------
  // entry point — called by generateWorld() in main.js
  // ----------------------------------------------------------
  function generate(world, seed, api) {
    W = world; API = api;
    var rnd = mulberry32((seed ^ 0x51C7A11) >>> 0);
    var out = [];
    var sats = [];
    for (var i = 0; i < world.islands.length; i++)
      if (!world.islands[i].main) sats.push(world.islands[i]);
    sats.sort(function (a, b) { return b.R - a.R; });

    buildVorathTemple(rnd, out);
    buildLiminalHalls(rnd, out);
    if (sats[0]) buildGemPyramid(sats[0], rnd, out);
    if (sats[1]) buildAuroraShrine(sats[1], rnd, out);
    if (sats[2]) buildNeonSpires(sats[2], rnd, out);
    if (sats[3]) buildCrystalGarden(sats[3], rnd, out);
    buildHearthVillage(rnd, out);
    buildSimulCity(rnd, out);
    buildSkybridges();

    W = null; API = null;
    return out;
  }

  return { generate: generate };
})();
