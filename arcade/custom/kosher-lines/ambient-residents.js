// Kosher Lines - ambient seated residents, v01 (2026-11-11).
// Original source written for NorthStar. Replaces the six box-and-sphere seated
// citizens in city.js with the retained v5 adult template (real skinned
// vertices, real 65-joint skeleton), posed seated ONCE and baked to static
// geometry, then drawn with InstancedMesh groups.
//
// Usage (from city.js / game.js, once the v5 adult template has loaded):
//   import { createAmbientResidents } from './ambient-residents.js';
//   const ambient = createAmbientResidents({ THREE, scene, template, idleClip, placements: AMBIENT_CITIZENS });
//   // per frame (optional, whole-instance breathing only): ambient.update(dt, time, player);
//   // teardown: ambient.dispose();
//
// No dependencies, network access, loaders, assets, text or build step. THREE
// is passed in. The template is never modified: a private clone with its own
// Skeleton is posed, baked, and dropped. Template materials/textures are shared
// (never cloned, never disposed). Only geometry created here is disposed.
//
// Pipeline (all one-time, inside createAmbientResidents):
//  1. clone template + rebind a private THREE.Skeleton (same pattern as city.js cloneResidentRig)
//  2. per pose: restore rest bones, optionally sample idleClip once (fingers/shoulders settle),
//     pitch spine/neck/Head about the body's lateral axis, two-bone solve thigh->calf->foot so
//     the ankle lands at its standing height above pavement, restore the standing foot world
//     orientation (flat sole), two-bone solve upperarm->lowerarm->hand to lap/thigh targets.
//     Only bone ROTATIONS are written, so every segment length stays the original one.
//  3. CPU skin every vertex once (same math as SkinnedMesh.applyBoneTransform:
//     bindMatrixInverse * sum_w(bone.matrixWorld * boneInverse) * bindMatrix), positions and
//     normals, merged per template material, translated so the measured seat contact sits at
//     seatY and rotated so the body faces the city group's local -Z (where the box feet were).
//  4. one InstancedMesh per (pose x material). No per-frame skeletons or vertex deforms.

const POSES = Object.freeze({
 // spine/neck/head: forward pitch in radians (+ = lean forward / look down).
 // ankleForward: horizontal hip->ankle distance in thigh lengths. spread: extra lateral ankle offset in thigh lengths.
 // hands: 'thigh' = palm resting on the same-side thigh; object = target relative to hip midpoint in thigh lengths.
 reading: { spine: [0.10, 0.08, 0.07], neck: 0.16, head: 0.30, headYaw: 0, ankleForward: 0.66, spread: 0.10,
  hands: { l: { forward: 0.80, up: 0.42, side: 0.10 }, r: { forward: 0.80, up: 0.42, side: 0.10 } } },
 resting: { spine: [-0.05, -0.04, -0.03], neck: -0.02, head: -0.05, headYaw: 0.20, ankleForward: 0.95, spread: 0.22,
  hands: { l: 'thigh', r: 'thigh' } },
 checking: { spine: [0.06, 0.05, 0.04], neck: 0.12, head: 0.32, headYaw: -0.28, ankleForward: 0.80, spread: 0.16,
  hands: { l: 'thigh', r: { forward: 1.00, up: 0.30, side: 0.32 } } }
});
const DEFAULT_POSES = Object.freeze(['reading', 'resting']);
// Body-skin triangles whose 3 vertices are >= coverWeight (default 0.8) weighted to these joints sit under the cargo trousers / sneakers / jacket hem (spine_01) and are culled (cullCoveredSkin).
const COVERED_JOINTS = /^(pelvis|spine_01|thigh|calf|foot|ball)/i;

export function createAmbientResidents({ THREE, scene = null, template, idleClip = null, placements, poses = DEFAULT_POSES,
 seatY = 0.6, floorY = 0, hipBack = -0.06, seatFrontFromHip = null, coverWeight = 0.8, idleTime = 0.4, breathing = true, cullCoveredSkin = true, coveredJoints = COVERED_JOINTS, castShadow = true,
 budgets = { meshes: 16, triangles: 130000 }, debug = null } = {}) {
 if (!THREE?.InstancedMesh) throw Error('ambient residents need the THREE namespace');
 if (!template?.isObject3D) throw Error('ambient residents need the loaded adult template Object3D');
 if (!Array.isArray(placements) || !placements.length) throw Error('ambient residents need placements [{x,z}]');
 const poseNames = poses.filter(p => POSES[p]);
 if (!poseNames.length) throw Error('ambient residents: no known pose in ' + poses.join(','));
 const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
 const t0 = now();
 const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion(), clamp = THREE.MathUtils.clamp;
 const created = { geometries: [], meshes: [] };
 // city.js bench seat: cube(.64,.12,.48, 0,.54,.04) in the citizen group -> top y .60, front edge at local z -.20 (the body faces local -Z)
 if (seatFrontFromHip == null) seatFrontFromHip = 0.20 + hipBack;

 // 1. private clone; template untouched
 template.updateMatrixWorld(true);
 const rig = cloneRig(THREE, template);
 rig.position.set(0, 0, 0); rig.quaternion.copy(template.quaternion); rig.scale.copy(template.scale);
 rig.updateMatrixWorld(true);
 const boneList = []; rig.traverse(o => { if (o.isBone) boneList.push(o); });
 const byName = new Map(boneList.map(b => [b.name, b]));
 const pick = (...names) => { for (const n of names) { const b = byName.get(n) || boneList.find(x => x.name.toLowerCase() === n.toLowerCase()); if (b) return b; } return null; };
 const B = { pelvis: pick('pelvis'), spine: [pick('spine_01'), pick('spine_02'), pick('spine_03')], neck: pick('neck_01'), head: pick('Head', 'head') };
 for (const s of ['l', 'r']) { B['thigh_' + s] = pick('thigh_' + s); B['calf_' + s] = pick('calf_' + s); B['foot_' + s] = pick('foot_' + s); B['ball_' + s] = pick('ball_' + s);
  B['upperarm_' + s] = pick('upperarm_' + s); B['lowerarm_' + s] = pick('lowerarm_' + s); B['hand_' + s] = pick('hand_' + s); }
 const required = ['pelvis', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
 const missingBones = [...required, 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'ball_l', 'ball_r'].filter(k => !B[k]);
 if (!B.neck) missingBones.push('neck_01'); if (!B.head) missingBones.push('Head');
 B.spine.forEach((b, i) => { if (!b) missingBones.push('spine_0' + (i + 1)); });
 if (required.some(k => !B[k])) throw Error('ambient residents need pelvis/thigh/calf/foot bones; missing ' + missingBones.join(','));
 const skins = []; rig.traverse(o => { if (o.isSkinnedMesh && o.geometry?.attributes?.skinIndex) skins.push(o); });
 if (!skins.length) throw Error('ambient residents: template has no skinned mesh');

 const rest = new Map(boneList.map(b => [b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
 const restoreRest = () => { for (const [b, r] of rest) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); } rig.updateMatrixWorld(true); };
 const wp = b => b.getWorldPosition(V());
 const wq = b => b.getWorldQuaternion(Q());
 const setWorldQ = (b, q) => { const pq = b.parent ? wq(b.parent) : Q(); b.quaternion.copy(pq.invert().multiply(q)); b.updateMatrixWorld(true); };
 const worldRotate = (b, q) => setWorldQ(b, q.clone().multiply(wq(b)));

 // per-vertex joint data (dominant regions) for culling and measurement
 const jointInfo = skins.map(mesh => {
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, n = si.count, bones = mesh.skeleton.bones;
  const leg = new Float32Array(n), seat = new Float32Array(n), foot = new Float32Array(n);
  for (let i = 0; i < n; i++) { let tot = 0, l = 0, st = 0, f = 0;
   for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const nm = bones[si.getComponent(i, k)]?.name || ''; tot += w;
    if (coveredJoints.test(nm)) l += w; if (/^(pelvis|thigh)/i.test(nm)) st += w; if (/^(foot|ball)/i.test(nm)) f += w; }
   if (tot > 0) { leg[i] = l / tot; seat[i] = st / tot; foot[i] = f / tot; } }
  return { leg, seat, foot };
 });

 // CPU skinning, same math as SkinnedMesh.applyBoneTransform, into rig (model) space
 const tmpM = new THREE.Matrix4(), pre = new THREE.Matrix4();
 const skinMesh = (mesh, withNormals, visit) => {
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, sk = mesh.skeleton;
  const mats = new Float32Array(sk.bones.length * 16);
  pre.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  for (let b = 0; b < sk.bones.length; b++) { tmpM.multiplyMatrices(sk.bones[b].matrixWorld, sk.boneInverses[b]).premultiply(pre).multiply(mesh.bindMatrix); tmpM.toArray(mats, b * 16); }
  for (let i = 0; i < pos.count; i++) {
   const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); let nx = 0, ny = 0, nz = 0; if (withNormals && nor) { nx = nor.getX(i); ny = nor.getY(i); nz = nor.getZ(i); }
   let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, tot = 0;
   for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const e = si.getComponent(i, k) * 16; tot += w;
    px += w * (mats[e] * x + mats[e + 4] * y + mats[e + 8] * z + mats[e + 12]);
    py += w * (mats[e + 1] * x + mats[e + 5] * y + mats[e + 9] * z + mats[e + 13]);
    pz += w * (mats[e + 2] * x + mats[e + 6] * y + mats[e + 10] * z + mats[e + 14]);
    if (withNormals) { qx += w * (mats[e] * nx + mats[e + 4] * ny + mats[e + 8] * nz); qy += w * (mats[e + 1] * nx + mats[e + 5] * ny + mats[e + 9] * nz); qz += w * (mats[e + 2] * nx + mats[e + 6] * ny + mats[e + 10] * nz); } }
   if (tot <= 0) continue; px /= tot; py /= tot; pz /= tot;
   if (withNormals) { const l = Math.hypot(qx, qy, qz) || 1; qx /= l; qy /= l; qz /= l; }
   visit(i, px, py, pz, qx, qy, qz);
  }
 };
 let skinnedVertexVisits = 0;
 const measure = (fn) => { skins.forEach((m, mi) => skinMesh(m, false, (i, x, y, z) => { skinnedVertexVisits++; fn(mi, i, x, y, z); })); };

 // body frame from the rest skeleton
 restoreRest();
 const U = V().set(0, 1, 0);
 const Lax = wp(B.thigh_l).sub(wp(B.thigh_r)); Lax.y = 0; const hipSpacing = Lax.length(); Lax.normalize();
 const F = V().crossVectors(Lax, U).normalize();
 const toe = V(); for (const s of ['l', 'r']) if (B['ball_' + s]) toe.add(wp(B['ball_' + s]).sub(wp(B['foot_' + s])));
 toe.y = 0; const forwardAgreesWithToes = toe.lengthSq() > 0 ? toe.normalize().dot(F) > 0 : null;
 let restFloor = Infinity; measure((mi, i, x, y) => { if (y < restFloor) restFloor = y; });
 const ankleH = { l: wp(B.foot_l).y - restFloor, r: wp(B.foot_r).y - restFloor };
 const restFootQ = { l: wq(B.foot_l), r: wq(B.foot_r) };
 const thighLen = wp(B.thigh_l).distanceTo(wp(B.calf_l));
 const segmentLengths = {};
 const segLen = () => { const o = {}; for (const s of ['l', 'r']) { o['thigh_' + s] = wp(B['thigh_' + s]).distanceTo(wp(B['calf_' + s])); o['calf_' + s] = wp(B['calf_' + s]).distanceTo(wp(B['foot_' + s]));
   if (B['upperarm_' + s] && B['lowerarm_' + s] && B['hand_' + s]) { o['upperarm_' + s] = wp(B['upperarm_' + s]).distanceTo(wp(B['lowerarm_' + s])); o['lowerarm_' + s] = wp(B['lowerarm_' + s]).distanceTo(wp(B['hand_' + s])); } } return o; };
 segmentLengths.rest = segLen();

 const twoBone = (a, b, c, target, pole) => {
  const pa = wp(a), pb = wp(b), pc = wp(c), l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc);
  const dir = target.clone().sub(pa); let d = dir.length(); if (d < 1e-6 || l1 < 1e-6 || l2 < 1e-6) return Infinity;
  d = clamp(d, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4); dir.normalize();
  const bend = pole.clone().sub(pa); bend.addScaledVector(dir, -bend.dot(dir)); if (bend.lengthSq() < 1e-8) bend.copy(U).addScaledVector(dir, -U.dot(dir)); bend.normalize();
  const cos = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const knee = pa.clone().addScaledVector(dir, l1 * cos).addScaledVector(bend, l1 * Math.sqrt(1 - cos * cos));
  worldRotate(a, Q().setFromUnitVectors(pb.clone().sub(pa).normalize(), knee.sub(pa).normalize()));
  const pb2 = wp(b), pc2 = wp(c), end = pa.clone().addScaledVector(dir, d);
  worldRotate(b, Q().setFromUnitVectors(pc2.sub(pb2).normalize(), end.sub(pb2).normalize()));
  return wp(c).distanceTo(target);
 };

 const poseRig = (name, poseIndex, r) => {
  const P = POSES[name]; restoreRest();
  let idleUsed = null;
  if (idleClip?.tracks?.length) { const mixer = new THREE.AnimationMixer(rig), act = mixer.clipAction(idleClip); act.play(); mixer.update(idleTime + poseIndex * 0.37); rig.updateMatrixWorld(true); act.stop(); mixer.uncacheRoot(rig); idleUsed = idleClip.name; }
  B.spine.forEach((b, i) => { if (b) worldRotate(b, Q().setFromAxisAngle(Lax, P.spine[i] || 0)); });
  if (B.neck) worldRotate(B.neck, Q().setFromAxisAngle(Lax, P.neck));
  if (B.head) { worldRotate(B.head, Q().setFromAxisAngle(Lax, P.head)); if (P.headYaw) worldRotate(B.head, Q().setFromAxisAngle(U, P.headYaw)); }
  const ik = {};
  const hipMid = wp(B.thigh_l).add(wp(B.thigh_r)).multiplyScalar(0.5);
  const dy = seatY + r - hipMid.y;
  for (const s of ['l', 'r']) { const side = s === 'l' ? 1 : -1, hip = wp(B['thigh_' + s]);
   const target = hip.clone().addScaledVector(F, P.ankleForward * thighLen).addScaledVector(Lax, side * P.spread * thighLen); target.y = floorY + ankleH[s] - dy;
   const pole = hip.clone().addScaledVector(F, 2 * thighLen).addScaledVector(U, 0.6 * thighLen);
   ik['leg_' + s] = twoBone(B['thigh_' + s], B['calf_' + s], B['foot_' + s], target, pole);
   setWorldQ(B['foot_' + s], restFootQ[s]); }
  for (const s of ['l', 'r']) { const side = s === 'l' ? 1 : -1, h = P.hands[s], ua = B['upperarm_' + s], la = B['lowerarm_' + s], hd = B['hand_' + s]; if (!ua || !la || !hd) continue;
   let target;
   if (h === 'thigh') { const hip = wp(B['thigh_' + s]), knee = wp(B['calf_' + s]); target = hip.lerp(knee, 0.45).addScaledVector(U, 0.26 * thighLen).addScaledVector(Lax, side * 0.06 * thighLen); }
   else target = hipMid.clone().addScaledVector(F, h.forward * thighLen).addScaledVector(U, h.up * thighLen).addScaledVector(Lax, side * h.side * thighLen);
   const shoulder = wp(ua), pole = shoulder.clone().addScaledVector(Lax, side * 0.9 * thighLen).addScaledVector(F, -0.5 * thighLen).addScaledVector(U, -0.6 * thighLen);
   ik['arm_' + s] = twoBone(ua, la, hd, target, pole); }
  rig.updateMatrixWorld(true);
  return { ik, idleUsed, hipMid: wp(B.thigh_l).add(wp(B.thigh_r)).multiplyScalar(0.5) };
 };
 const contact = (hipMid) => { let bottom = Infinity, sole = Infinity, bottomAt = null, under = Infinity;
  measure((mi, i, x, y, z) => { const J = jointInfo[mi]; const fw = (x - hipMid.x) * F.x + (z - hipMid.z) * F.z;
   if (J.seat[i] >= 0.5 && fw > -0.35 * thighLen && fw <= 0 && y < bottom) { bottom = y; bottomAt = [skins[mi].name, i, round(x), round(y), round(z), round(fw), round(J.seat[i])]; } if (J.foot[i] >= 0.5 && y < sole) sole = y; if (J.seat[i] >= 0.5 && fw > 0 && fw < seatFrontFromHip && y < under) under = y; });
  return { bottom, sole, bottomAt, under }; };

 // 2+3. pose, measure, bake
 const yaw = Math.PI - Math.atan2(F.x, F.z); // rotate body forward onto local -Z
 const groupsByKey = new Map(); // material key -> {material, members}
 skins.forEach((mesh, mi) => { const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; const m = mats[0]; const key = m.name || m.uuid;
  if (!groupsByKey.has(key)) groupsByKey.set(key, { key, material: m, members: [] }); const g = groupsByKey.get(key); if (m.vertexColors && !g.material.vertexColors) g.material = m; g.members.push(mi); });
 const poseRecords = []; let culledTriangles = 0, degenerateTriangles = 0;
 const instancesFor = poseNames.map(() => []);
 placements.forEach((p, i) => instancesFor[Math.floor(i / 2) % poseNames.length].push(i));
 for (let pi = 0; pi < poseNames.length; pi++) {
  const name = poseNames[pi]; if (!instancesFor[pi].length) continue;
  let r = 0.45 * hipSpacing, posed, c, iterations = 0, converged = false;
  for (; iterations < 5 && !converged; iterations++) { posed = poseRig(name, pi, r); c = contact(posed.hipMid); const nr = posed.hipMid.y - c.bottom; converged = Math.abs(nr - r) < 0.002; if (debug) debug({ pose: name, iteration: iterations, r, nr, hipY: posed.hipMid.y, knee: wp(B.calf_l).toArray().map(round), ankle: wp(B.foot_l).toArray().map(round), hip: wp(B.thigh_l).toArray().map(round), F: F.toArray().map(round), ...c }); r = nr; }
  const dy = seatY - c.bottom;
  const M = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeTranslation(-posed.hipMid.x, dy, -posed.hipMid.z));
  const N3 = new THREE.Matrix3().setFromMatrix4(M);
  const baked = skins.map(() => null);
  skins.forEach((mesh, mi) => { const n = mesh.geometry.attributes.position.count, P3 = new Float32Array(n * 3), N = new Float32Array(n * 3); const v = V(), nv = V();
   skinMesh(mesh, true, (i, x, y, z, nx, ny, nz) => { skinnedVertexVisits++; v.set(x, y, z).applyMatrix4(M); nv.set(nx, ny, nz).applyMatrix3(N3).normalize(); P3[i * 3] = v.x; P3[i * 3 + 1] = v.y; P3[i * 3 + 2] = v.z; N[i * 3] = nv.x; N[i * 3 + 1] = nv.y; N[i * 3 + 2] = nv.z; });
   baked[mi] = { P3, N }; });
  const box = new THREE.Box3(); const geoms = [];
  for (const g of groupsByKey.values()) {
   const useColor = !!g.material.vertexColors; let colorSize = 0; const uvNames = ['uv', 'uv1'].filter(u => g.members.every(mi => skins[mi].geometry.attributes[u]));
   if (useColor) for (const mi of g.members) { const ca = skins[mi].geometry.attributes.color; if (ca) colorSize = Math.max(colorSize, ca.itemSize); }
   let vCount = 0; for (const mi of g.members) vCount += skins[mi].geometry.attributes.position.count;
   const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uvs = uvNames.map(() => new Float32Array(vCount * 2)), col = colorSize ? new Float32Array(vCount * colorSize).fill(1) : null; const idx = [];
   let off = 0;
   for (const mi of g.members) { const geo = skins[mi].geometry, n = geo.attributes.position.count, bk = baked[mi];
    pos.set(bk.P3, off * 3); nor.set(bk.N, off * 3);
    uvNames.forEach((u, k) => { const a = geo.attributes[u]; for (let i = 0; i < n; i++) { uvs[k][(off + i) * 2] = a.getX(i); uvs[k][(off + i) * 2 + 1] = a.getY(i); } });
    if (col && geo.attributes.color) { const a = geo.attributes.color; for (let i = 0; i < n; i++) for (let k = 0; k < a.itemSize; k++) col[(off + i) * colorSize + k] = a.getComponent(i, k); }
    const cull = cullCoveredSkin && /superhero|body|skin/i.test(skins[mi].name) && !/hair|eye|brow/i.test(skins[mi].name) ? jointInfo[mi].leg : null;
    const src = geo.index; const triCount = src ? src.count / 3 : n / 3;
    for (let t = 0; t < triCount; t++) { const a = src ? src.getX(t * 3) : t * 3, b = src ? src.getX(t * 3 + 1) : t * 3 + 1, cc = src ? src.getX(t * 3 + 2) : t * 3 + 2;
     if (cull && cull[a] >= coverWeight && cull[b] >= coverWeight && cull[cc] >= coverWeight) { culledTriangles++; continue; }
     { const P = bk.P3, ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2], bx = P[cc * 3] - P[a * 3], by = P[cc * 3 + 1] - P[a * 3 + 1], bz = P[cc * 3 + 2] - P[a * 3 + 2];
      if (Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) < 1e-9) { degenerateTriangles++; continue; } }
     idx.push(a + off, b + off, cc + off); }
    off += n; }
   const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geom.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
   uvNames.forEach((u, k) => geom.setAttribute(u, new THREE.BufferAttribute(uvs[k], 2))); if (col) geom.setAttribute('color', new THREE.BufferAttribute(col, colorSize));
   geom.setIndex(new THREE.BufferAttribute(vCount > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1)); geom.computeBoundingBox(); geom.computeBoundingSphere(); geom.name = 'ambient-resident-' + name + '-' + g.key;
   box.union(geom.boundingBox); created.geometries.push(geom); geoms.push({ geom, material: g.material, key: g.key, triangles: idx.length / 3 });
  }
  const after = { bottom: seatY, sole: c.sole + dy };
  poseRecords.push({ name, instances: instancesFor[pi].slice(), geoms, bounds: { min: box.min.toArray().map(round), max: box.max.toArray().map(round), size: box.getSize(V()).toArray().map(round) },
   seatContactY: round(after.bottom), thighBelowSeatTopUpToSeatFront: round(Math.max(0, seatY - (c.under + dy))), soleY: round(after.sole), feetFloorError: round(after.sole - floorY), hipToSeatContact: round(r), contactIterations: iterations, contactConverged: converged, ikError: Object.fromEntries(Object.entries(posed.ik).map(([k, v]) => [k, round(v)])), idleClip: posed.idleUsed,
   segmentLengths: Object.fromEntries(Object.entries(segLen()).map(([k, v]) => [k, round(v)])) });
 }
 restoreRest();
 for (const m of skins) m.skeleton?.dispose?.();

 // 4. InstancedMesh per pose x material
 const root = new THREE.Group(); root.name = 'kosher-ambient-residents';
 const instanceBase = []; // per placement: {pos, yaw}
 placements.forEach((p, i) => { const gy = p.x > 0 ? Math.PI / 2 : -Math.PI / 2; const back = V().set(0, 0, hipBack).applyAxisAngle(U, gy);
  instanceBase[i] = { x: p.x + back.x, z: p.z + back.z, yaw: gy, phase: i * 1.7 }; });
 const S = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), A = new THREE.Matrix4(), Bm = new THREE.Matrix4();
 const matrixFor = (i, s = 1) => { const b = instanceBase[i]; T.makeTranslation(b.x, 0, b.z); R.makeRotationY(b.yaw); A.makeTranslation(0, seatY, 0); S.makeScale(1, s, 1); Bm.makeTranslation(0, -seatY, 0); return T.clone().multiply(R).multiply(A).multiply(S).multiply(Bm); };
 for (const pr of poseRecords) for (const g of pr.geoms) {
  const im = new THREE.InstancedMesh(g.geom, g.material, pr.instances.length); im.name = g.geom.name; im.castShadow = castShadow; im.receiveShadow = true;
  pr.instances.forEach((pi, k) => im.setMatrixAt(k, matrixFor(pi))); im.instanceMatrix.needsUpdate = true; im.computeBoundingBox?.(); im.computeBoundingSphere?.();
  root.add(im); created.meshes.push({ mesh: im, instances: pr.instances }); }
 if (scene) scene.add(root);

 // derived metrics (nothing hardcoded)
 let renderedTriangles = 0; for (const { mesh } of created.meshes) renderedTriangles += (mesh.geometry.index.count / 3) * mesh.count;
 const sharedMaterials = new Set(created.meshes.map(m => m.mesh.material.uuid)).size;
 const bakeMs = now() - t0;
 const metrics = {
  source: 'template:' + (template.name || 'unnamed'), poses: poseRecords.map(({ geoms, ...rest }) => ({ ...rest, meshes: geoms.length, trianglesPerResident: geoms.reduce((a, g) => a + g.triangles, 0) })),
  residents: placements.length, meshes: created.meshes.length, drawSubmissions: created.meshes.length, shadowSubmissions: castShadow ? created.meshes.length : 0,
  renderedTriangles, degenerateTrianglesDroppedPerPose: poseRecords.length ? degenerateTriangles / poseRecords.length : 0, culledTrianglesPerPose: poseNames.length ? culledTriangles / poseRecords.length : 0, cullCoveredSkin, coveredJoints: String(coveredJoints), coverWeight, hipBack, seatFrontFromHip,
  skinnedMeshes: skins.length, bones: boneList.length, boneNames: boneList.map(b => b.name), missingBones, forwardAgreesWithToes,
  restSegmentLengths: Object.fromEntries(Object.entries(segmentLengths.rest).map(([k, v]) => [k, round(v)])),
  skinnedVertexVisits, sharedTemplateMaterials: sharedMaterials, createdMaterials: 0, createdGeometries: created.geometries.length,
  bakeMs: round(bakeMs), perFrameSkinning: false, motion: breathing ? 'whole-instance breathing scale (not skeletal)' : 'static',
  budgets: { ...budgets }, withinBudget: { meshes: created.meshes.length <= budgets.meshes, triangles: renderedTriangles <= budgets.triangles }
 };

 let clock = 0, disposed = false;
 function update(dt = 0) {
  if (disposed || !breathing) return; clock += Math.min(Math.max(dt, 0), 0.1);
  for (const { mesh, instances } of created.meshes) { instances.forEach((pi, k) => mesh.setMatrixAt(k, matrixFor(pi, 1 + 0.004 * Math.sin(clock * 1.15 + instanceBase[pi].phase)))); mesh.instanceMatrix.needsUpdate = true; }
 }
 function dispose() {
  if (disposed) return; disposed = true; root.parent?.remove(root);
  for (const { mesh } of created.meshes) mesh.dispose?.();
  for (const g of created.geometries) g.dispose();
  created.meshes.length = 0; // template materials and textures are shared: never disposed here
 }
 return { root, metrics, update, dispose };
}

function round(v) { return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v; }

function cloneRig(THREE, template) {
 const copy = template.clone(true), map = new Map();
 const pair = (a, b) => { map.set(a, b); a.children.forEach((c, i) => pair(c, b.children[i])); }; pair(template, copy);
 template.traverse(src => { if (!src.isSkinnedMesh) return; const dst = map.get(src), bones = src.skeleton.bones.map(b => map.get(b));
  if (bones.some(b => !b)) throw Error('ambient residents: template skeleton escapes the template hierarchy');
  dst.skeleton = new THREE.Skeleton(bones, src.skeleton.boneInverses.map(m => m.clone())); dst.bindMatrix.copy(src.bindMatrix); dst.bindMatrixInverse.copy(src.bindMatrixInverse); });
 return copy;
}
