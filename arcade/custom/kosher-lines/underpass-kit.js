// Kosher Lines - brutalist overpass "underpass" kit, v01 (2026-11-11).
// Original source written for NorthStar. Reference study only: Pivot Custom's
// Lot 11 underpass skatepark in Miami and other Florida skateparks under highways.
// No images, textures, or geometry were copied from them.
//
// Usage (from game.js, after makeWorld):
//   import { createUnderpassKit } from './underpass-kit.js';
//   const underpass = createUnderpassKit({ THREE, scene, concrete, muralTexture: mural, quality });
//   cameraSolids.push(...underpass.cameraBounds);
//   underpass.setQuality('low' | 'high');
//
// No dependencies, network access, loaders, or build step. It uses the THREE
// namespace and the concrete PBR material passed in. Only geometries and
// materials created here get disposed.
//
// Layout (world metres, the same frame as simulation.mjs and makeWorld):
//  - The deck spans x -36..36 over z -19.3..-10.7. That z band is between the
//    elevated service cables (z about -9 and -20.3) and over the stair/hubba lane.
//  - The lowest structure is the eye keystone at y 12.95. Girder soffits are at
//    13.6, which clears the east facade gold cap (13.24) and the west cap (10.24).
//  - The two hammerhead piers sit at x = +/-32. That is outside the |x| <= 23
//    movement clamp and behind the facade masses (x +/-23..+/-29, z -42..24).
//  - Nothing touches terrain, rails, colliders, tricks, or challenge logic.
//    metrics.colliders lists exact AABBs for every hard solid.

const DECK = Object.freeze({ x0: -36, x1: 36, zc: -15, halfW: 4.3, girderBottom: 13.6, soffit: 14.8, top: 15.3 });
const GIRDER_Z = Object.freeze([-18.2, -16.6, -15, -13.4, -11.8]);
const PIER_X = Object.freeze([-32, 32]);

export function createUnderpassKit({ THREE, scene, concrete, muralTexture = null, quality = 'high', castShadow = true } = {}) {
  if (!THREE || !scene || !concrete) throw Error('createUnderpassKit needs THREE, scene and concrete');
  const created = { geometries: new Set(), materials: new Set() };
  const own = g => { created.geometries.add(g); return g; };
  const ownMat = m => { created.materials.add(m); return m; };

  const root = new THREE.Group(); root.name = 'Kosher underpass kit v01'; scene.add(root);
  const high = new THREE.Group(); high.name = 'underpass high'; root.add(high);
  const low = new THREE.Group(); low.name = 'underpass low'; root.add(low);

  // Materials: the concrete is passed in. Everything else is created here.
  // The steel and the ornate eye are near-black metal with a thin-film rainbow sheen.
  const steel = ownMat(new THREE.MeshPhysicalMaterial({ color: 0x16181d, metalness: .86, roughness: .38, iridescence: .55, iridescenceIOR: 1.45, iridescenceThicknessRange: [160, 620], clearcoat: .25 }));
  const boltMat = ownMat(new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: .92, roughness: .33 }));
  const ornate = ownMat(new THREE.MeshPhysicalMaterial({ color: 0x0a0a0f, metalness: .92, roughness: .24, iridescence: 1, iridescenceIOR: 1.62, iridescenceThicknessRange: [220, 820], clearcoat: .7, clearcoatRoughness: .18 }));
  const strip = ownMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const iris = ownMat(new THREE.MeshStandardMaterial({ color: muralTexture ? 0xffffff : 0x5a0f4a, map: muralTexture || null, emissive: 0xd42fb4, emissiveMap: muralTexture || null, emissiveIntensity: .9, metalness: .2, roughness: .3 }));
  const CYAN = new THREE.Color(0x19e6ff).multiplyScalar(1.15), MAGENTA = new THREE.Color(0xff1fb4).multiplyScalar(1.05);

  // ---- helpers -------------------------------------------------------------
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  // Merges transformed parts into one non-indexed geometry. UVs are box-projected
  // at world scale /2, matching makeWorld's worldSurfaceUV, so concrete grain stays consistent.
  function collector(worldUV) {
    const pos = [], nor = [], uv = [], boxes = {};
    return {
      add(g, tag = 'deck') {
        const flat = g.index ? g.toNonIndexed() : g;
        if (!flat.attributes.normal) flat.computeVertexNormals();
        const p = flat.attributes.position, n = flat.attributes.normal, t = flat.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
          pos.push(x, y, z); nor.push(nx, ny, nz);
          if (worldUV) { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz); if (ax >= ay && ax >= az) uv.push(z / 2, y / 2); else if (ay >= az) uv.push(x / 2, z / 2); else uv.push(x / 2, y / 2); }
          else uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
        }
        flat.computeBoundingBox(); (boxes[tag] ||= new THREE.Box3()).union(flat.boundingBox);
        if (flat !== g) flat.dispose(); g.dispose();
      },
      finish(name, material, parent) {
        const g = own(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeBoundingBox(); g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, material); mesh.name = name; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); parent.add(mesh);
        return { mesh, boxes };
      }
    };
  }
  const place = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    q.setFromEuler(new THREE.Euler(rx, ry, rz)); m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz)); g.applyMatrix4(m4); return g;
  };
  const box = (w, h, d, x, y, z) => place(new THREE.BoxGeometry(w, h, d), x, y, z);
  // Extrudes a profile drawn in (u = outward z, v = height) along world x.
  function alongX(points, length, outward, y0, zc, curveSegments = 4, build) {
    const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    if (build) build(shape); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments, steps: 1 });
    g.translate(0, 0, -length / 2); g.rotateY(outward >= 0 ? -Math.PI / 2 : Math.PI / 2); g.translate(0, y0, zc); return g;
  }
  function instanced(name, geometry, material, items, parent, colorOf) {
    const mesh = new THREE.InstancedMesh(own(geometry), material, items.length); mesh.name = name;
    items.forEach((it, i) => { q.setFromEuler(new THREE.Euler(...(it.r || [0, 0, 0]))); m4.compose(v.set(...it.p), q, s.set(...(it.s || [1, 1, 1]))); mesh.setMatrixAt(i, m4); if (colorOf) mesh.setColorAt(i, colorOf(it)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox?.(); mesh.computeBoundingSphere?.(); parent.add(mesh); return mesh;
  }

  // ---- structure, built once per quality level -------------------------------
  const L = DECK.x1 - DECK.x0, zN = DECK.zc + DECK.halfW, zS = DECK.zc - DECK.halfW;
  const levels = {};
  for (const level of ['high', 'low']) {
    const hi = level === 'high', parent = hi ? high : low, curve = hi ? 6 : 2;
    const c = collector(true);
    // Deck slab.
    c.add(box(L, DECK.top - DECK.soffit, DECK.halfW * 2, 0, (DECK.top + DECK.soffit) / 2, DECK.zc));
    // Bulb-tee precast girders: the visible ribs on the underside.
    const tee = [[-.24, 0], [.24, 0], [.31, .07], [.31, .2], [.13, .34], [.13, 1.2], [-.13, 1.2], [-.13, .34], [-.31, .2], [-.31, .07]];
    for (const z of GIRDER_Z) c.add(alongX(tee, L - .6, 1, DECK.girderBottom, z));
    // Transverse diaphragm ribs. Low quality keeps every other one.
    const step = hi ? 2.4 : 4.8;
    for (let x = DECK.x0 + 1.2; x < DECK.x1 - .6; x += step) c.add(box(.3, .78, DECK.halfW * 2 - .9, x, DECK.soffit - .39, DECK.zc));
    // Sloped brutalist fascia beams that show the deck's thickness, and tapered parapets.
    const fascia = [[-.5, .3], [-.12, 0], [.12, .08], [.25, 1.42], [-.5, 1.42]];
    const parapet = [[-.3, 0], [.12, 0], [.12, .95], [0, 1.05], [-.22, 1.05], [-.3, .85]];
    for (const side of [1, -1]) {
      const edge = side > 0 ? zN : zS;
      c.add(alongX(fascia, L, side, 13.85, edge - side * .25));
      c.add(alongX(parapet, L, side, DECK.top, edge - side * .12));
    }
    // Hammerhead piers on footings, hidden behind the facade masses.
    for (const px of PIER_X) {
      const tag = px < 0 ? 'pier-west' : 'pier-east';
      const pier = alongX([[-1.5, 0], [1.5, 0], [1.25, 10.6]], 2.0, 1, 0, DECK.zc, curve, sh => {
        sh.quadraticCurveTo(1.25, 12.2, 4.5, 12.5); sh.lineTo(4.5, 13.3); sh.lineTo(-4.5, 13.3); sh.lineTo(-4.5, 12.5); sh.quadraticCurveTo(-1.25, 12.2, -1.25, 10.6);
      });
      pier.translate(px, 0, 0); c.add(pier, tag);
      c.add(box(3.4, .6, 5.2, px, .3, DECK.zc), tag);
      if (hi) for (const dz of [-2.2, 2.2]) c.add(box(2.3, .18, .5, px, 11.2, DECK.zc + dz), tag); // board-form reveal bands
    }
    // Keystone pendant on the north fascia. It carries the eye and faces the start line.
    const ks = new THREE.Shape(); ks.moveTo(-1.3, .95); ks.lineTo(1.3, .95); ks.lineTo(1.08, -.42); ks.lineTo(0, -1.15); ks.lineTo(-1.08, -.42); ks.closePath();
    const keystone = new THREE.ExtrudeGeometry(ks, { depth: .55, bevelEnabled: false }); keystone.translate(0, 14.1, zN - .5); c.add(keystone);
    const concreteMesh = c.finish('Underpass concrete (passed material) ' + level, concrete, parent);
    concreteMesh.mesh.castShadow = castShadow && hi; concreteMesh.mesh.receiveShadow = true;

    // Steel: web splice plates, pot bearings, fascia armour angles.
    const plates = [];
    const spliceStep = hi ? 7.2 : 14.4;
    for (const z of GIRDER_Z) for (let x = DECK.x0 + 3.6; x < DECK.x1 - 1; x += spliceStep) for (const sd of hi ? [-1, 1] : [1]) plates.push({ p: [x, 14.2, z + sd * .145], s: [.9, .7, .03] });
    for (const px of PIER_X) for (const z of GIRDER_Z) plates.push({ p: [px, 13.45, z], s: [.8, .3, .8] });
    for (const side of [1, -1]) plates.push({ p: [0, 13.89, (side > 0 ? zN : zS) + side * .04], s: [L, .08, .1] });
    const steelMesh = instanced('Underpass rainbow-black steel ' + level, new THREE.BoxGeometry(1, 1, 1), steel, plates, parent);

    // Hex bolt heads on the splice plates. High quality only.
    let boltMesh = null;
    if (hi) {
      const bolts = [];
      for (const pl of plates) { if (pl.s[0] !== .9) continue; const sd = Math.sign(pl.p[2] - GIRDER_Z.reduce((a, b) => Math.abs(b - pl.p[2]) < Math.abs(a - pl.p[2]) ? b : a)); for (const dx of [-.3, 0, .3]) bolts.push({ p: [pl.p[0] + dx, 14.2, pl.p[2] + sd * .035], r: [Math.PI / 2, 0, 0] }); }
      boltMesh = instanced('Underpass hex fasteners', new THREE.CylinderGeometry(.034, .04, .04, 6), boltMat, bolts, parent);
    }

    // Practical light strips: dashed cyan fixtures under two girders, magenta on the fascia lip.
    const strips = [];
    const sStep = hi ? 2.4 : 4.8, sLen = hi ? 1.6 : 3.8;
    for (let x = DECK.x0 + 2.4; x < DECK.x1 - 1.2; x += sStep) {
      for (const z of hi ? [GIRDER_Z[1], GIRDER_Z[3]] : [GIRDER_Z[2]]) strips.push({ p: [x, DECK.girderBottom - .025, z], s: [sLen, .045, .08], c: CYAN });
      for (const side of hi ? [1, -1] : [1]) strips.push({ p: [x, 14.05, (side > 0 ? zN : zS) + side * .05], s: [sLen + .3, .05, .04], c: MAGENTA });
    }
    const stripMesh = instanced('Underpass cyan/magenta practical strips ' + level, new THREE.BoxGeometry(1, 1, 1), strip, strips, parent, it => it.c);

    // The eye boss: a sculpted almond eye with lids, a thorn crown, a ribbed bezel,
    // drip spurs, and a slit pupil, plus spiked parapet finials. It is real geometry, not a decal.
    const o = collector(false), ez = zN + .06, ey = 14.15;
    const lid = (k) => { const pts = []; for (let i = 0; i <= 12; i++) { const t = -1 + i / 6; pts.push(new THREE.Vector3(t * .95, ey + k * (1 - t * t), ez + .08 * (1 - t * t))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), hi ? 28 : 12, hi ? .065 : .07, hi ? 7 : 4, false); };
    o.add(lid(.43)); o.add(lid(-.33));
    if (hi) { const brow = lid(.62); o.add(brow); }
    const bezel = new THREE.TorusGeometry(.98, .045, hi ? 6 : 3, hi ? 44 : 18); place(bezel, 0, ey + .03, ez - .01, 0, 0, 0, 1.18, .74, 1); o.add(bezel);
    const thorns = hi ? 13 : 7;
    for (let i = 0; i < thorns; i++) {
      const a = Math.PI * (.08 + .84 * i / (thorns - 1)), len = i % 2 ? .34 : .58, r = 1.02;
      const cone = new THREE.ConeGeometry(.055, len, hi ? 6 : 4);
      place(cone, Math.cos(a) * r * 1.18, ey + Math.sin(a) * r * .78 + .02, ez, 0, 0, a - Math.PI / 2); o.add(cone);
    }
    for (const dx of [-.22, .22]) { const drip = new THREE.ConeGeometry(.05, .42, hi ? 6 : 4); place(drip, dx, ey - .62, ez, Math.PI, 0, 0); o.add(drip); }
    const pupil = new THREE.SphereGeometry(.1, hi ? 10 : 6, hi ? 8 : 4); place(pupil, 0, ey, ez + .16, 0, 0, 0, .55, 2.4, .5); o.add(pupil);
    for (const side of [1, -1]) for (let x = DECK.x0 + 3.6; x < DECK.x1 - 1; x += hi ? 7.2 : 14.4) {
      const fin = new THREE.ConeGeometry(.09, .5, hi ? 6 : 4); place(fin, x, DECK.top + 1.3, (side > 0 ? zN : zS) - side * .2); o.add(fin);
    }
    const ornament = o.finish('Underpass Vorath eye boss and finials ' + level, ornate, parent);
    const irisGeo = new THREE.SphereGeometry(.3, hi ? 20 : 10, hi ? 8 : 4, 0, Math.PI * 2, 0, Math.PI / 2);
    irisGeo.rotateX(Math.PI / 2); irisGeo.scale(1, 1, .45); irisGeo.translate(0, ey, ez + .02);
    const irisMesh = new THREE.Mesh(own(irisGeo), iris); irisMesh.name = 'Underpass eye iris ' + level; parent.add(irisMesh);
    for (const mm of [steelMesh, boltMesh, stripMesh, ornament.mesh, irisMesh]) if (mm) { mm.castShadow = false; mm.receiveShadow = mm === steelMesh; }
    levels[level] = { boxes: { ...concreteMesh.boxes }, meshes: [concreteMesh.mesh, steelMesh, boltMesh, stripMesh, ornament.mesh, irisMesh].filter(Boolean) };
  }

  // Practical lights: high quality only, no shadows. Changing quality changes the
  // scene light count, so three recompiles shaders once per switch.
  const lights = [];
  for (const [x, color] of [[-9, 0x19e6ff], [9, 0xff1fb4]]) { const l = new THREE.PointLight(color, 28, 15, 2); l.position.set(x, 13.2, DECK.zc); l.castShadow = false; l.name = 'Underpass practical ' + x; root.add(l); lights.push(l); }

  // ---- colliders, measured from the built high-quality geometry --------------
  scene.updateMatrixWorld(true);
  const aabb = (id, b) => ({ id, minX: +b.min.x.toFixed(3), maxX: +b.max.x.toFixed(3), minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3), minZ: +b.min.z.toFixed(3), maxZ: +b.max.z.toFixed(3) });
  const deckBox = levels.high.boxes.deck.clone(), tmp = new THREE.Box3();
  for (const mm of levels.high.meshes.slice(1)) { tmp.setFromObject(mm); deckBox.union(tmp); }
  const colliders = [aabb('underpass-deck', deckBox), aabb('underpass-pier-west', levels.high.boxes['pier-west']), aabb('underpass-pier-east', levels.high.boxes['pier-east'])];
  const cameraBounds = colliders.map(c => ({ ...c }));

  function stats() {
    let drawCalls = 0, triangles = 0, instances = 0, shadowCasters = 0;
    root.traverseVisible(o => { if (!o.isMesh) return; drawCalls++; if (o.castShadow) shadowCasters++; const n = o.isInstancedMesh ? o.count : 1; instances += n; const g = o.geometry; triangles += ((g.index ? g.index.count : g.attributes.position.count) / 3) * n; });
    return { drawCalls, triangles, instances, shadowCasters, drawCallsWithShadowPass: drawCalls + shadowCasters, lights: lights.filter(l => l.visible).length };
  }
  let current = 'high';
  function setQuality(next) {
    current = next === 'low' ? 'low' : 'high';
    high.visible = current === 'high'; low.visible = current === 'low'; for (const l of lights) l.visible = current === 'high';
    metrics.quality = current; metrics.current = stats(); return metrics.current;
  }
  const measured = {};
  const metrics = {
    version: 'kosher-underpass-kit v01 2026-11-11', quality: 'high', current: null, measured,
    undersideY: +deckBox.min.y.toFixed(3), girderSoffitY: DECK.girderBottom, deckTopY: DECK.top,
    movementBoundsRead: { absXMax: 23, zMin: -34, zMax: 15, source: 'simulation.mjs: if(Math.abs(nx)>23||nz>15||nz< -34)blocked=true' },
    colliders, pierX: [...PIER_X], deckZ: [zS, zN]
  };
  for (const lv of ['high', 'low']) measured[lv] = setQuality(lv);
  setQuality(quality);

  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    root.removeFromParent(); for (const l of lights) l.dispose?.();
    for (const g of created.geometries) g.dispose(); for (const m of created.materials) m.dispose();
    created.geometries.clear(); created.materials.clear();
  }
  return { root, metrics, cameraBounds, setQuality, dispose, stats };
}
