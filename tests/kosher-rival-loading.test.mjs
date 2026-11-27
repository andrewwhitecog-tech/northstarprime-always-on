import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import * as THREE from '../static/vendor/three/0.160.0/build/three.module.js';
// Resolve the browser import map to the SAME pinned Three module in this Node test.
// No module source, runtime result or pass flag is replaced.
const hooks=registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL('../static/vendor/three/0.160.0/build/three.module.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('/static/'))return {url:new URL('..'+specifier,import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {createActionMode}=await import('../arcade/custom/kosher-lines/action-mode.js');
hooks.deregister();
const glb=fs.readFileSync(new URL('../arcade/custom/crib-recovered-assets/vorath-adult-skater-v5.glb',import.meta.url));
const jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8')),bin=glb.subarray(28+jsonLength);
function accessor(index){const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],C={5126:Float32Array,5123:Uint16Array,5121:Uint8Array,5125:Uint32Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],out=new C(a.count*n),d=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),size=C.BYTES_PER_ELEMENT;for(let j=0;j<a.count;j++)for(let k=0;k<n;k++){const offset=(v.byteOffset||0)+(a.byteOffset||0)+j*(v.byteStride||n*size)+k*size;out[j*n+k]=a.componentType===5126?d.getFloat32(offset,true):a.componentType===5123?d.getUint16(offset,true):a.componentType===5125?d.getUint32(offset,true):d.getUint8(offset);}return out;}
function riderFixture(missingBone=false){
 // Read the actual shipped skeleton, weighted geometry and animation tracks.
 // A tiny test texture avoids browser image decoding; this is NOT a visual test.
 const joints=new Set(gltf.skins[0].joints),nodes=gltf.nodes.map((n,i)=>{const o=joints.has(i)?new THREE.Bone():new THREE.Group();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
 gltf.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
 if(missingBone)nodes.find(n=>n.name==='thigh_l').name='malformed_missing_thigh_l';
 const model=new THREE.Group();gltf.scenes[gltf.scene||0].nodes.forEach(i=>model.add(nodes[i]));model.updateMatrixWorld(true);
 const skin=gltf.skins[0],inverse=accessor(skin.inverseBindMatrices),skeleton=new THREE.Skeleton(skin.joints.map(i=>nodes[i]),skin.joints.map((_,i)=>new THREE.Matrix4().fromArray(inverse,i*16))),texture=new THREE.DataTexture(new Uint8Array([120,110,100,255]),1,1);
 texture.needsUpdate=true;
 gltf.nodes.forEach((n,i)=>{if(n.mesh===undefined)return;for(const pr of gltf.meshes[n.mesh].primitives){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(accessor(pr.attributes.POSITION),3));if(pr.indices!==undefined)g.setIndex(new THREE.BufferAttribute(accessor(pr.indices),1));const m=new THREE.MeshStandardMaterial({map:texture});let mesh;if(n.skin!==undefined){g.setAttribute('skinIndex',new THREE.BufferAttribute(accessor(pr.attributes.JOINTS_0),4));g.setAttribute('skinWeight',new THREE.BufferAttribute(accessor(pr.attributes.WEIGHTS_0),4));mesh=new THREE.SkinnedMesh(g,m);mesh.bind(skeleton,new THREE.Matrix4());}else mesh=new THREE.Mesh(g,m);mesh.name=n.name;nodes[i].add(mesh);}});
 const animations=gltf.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const sampler=a.samplers[c.sampler],values=accessor(sampler.output),times=accessor(sampler.input),property={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path],Track=c.target.path==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;return new Track(nodes[c.target.node].name+'.'+property,times,values);})));
 const disposals={geometries:0,materials:0,textures:0};model.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>disposals.geometries++);if(o.material)o.material.addEventListener('dispose',()=>disposals.materials++);});texture.addEventListener('dispose',()=>disposals.textures++);return {scene:model,animations,disposals};
}
function harness(options={}){
 const scene=new THREE.Scene(),messages=[],art={boards:[],posters:[],rivalModel:'fixture-rider.glb',privateFanPack:false};
 let fixture=null,calls=0;
 const rivalLoader={async loadAsync(){calls++;if(options.reject)throw Error('Fixture download failed');fixture=riderFixture(Boolean(options.missingBone));return fixture;}};
 // Real sim class comes from the production module's imports, used below.
 return import('../arcade/custom/kosher-lines/simulation.mjs').then(({KosherSim})=>{
  const sim=new KosherSim();sim.start();
  const mode=createActionMode(THREE,{scene,sim,art,colliders:[],readSave:()=>null,saveKey:'rival-loader-regression',onStatus:m=>messages.push(m),rivalLoader});
  mode.start();mode.setEnabled(true);
  return {scene,sim,mode,messages,get fixture(){return fixture;},get calls(){return calls;}};
 });
}
async function settle(h){for(let i=0;i<20&&h.mode.snapshot().modelStatus==='loading';i++)await new Promise(setImmediate);assert.notEqual(h.mode.snapshot().modelStatus,'loading');}
function cleanup(h){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();for(const root of [h.scene,h.fixture?.scene])root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const s of skeletons)s.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
test('real malformed skeleton leaves no published or attached rival after actual rig construction fails',async()=>{
 const h=await harness({missingBone:true});try{await settle(h);const s=h.mode.snapshot();assert.equal(s.modelStatus,'failed');assert(s.modelError.includes('Skate rig needs actual pelvis/thigh/calf/foot bones'));assert.equal(s.rivalVisual.modelLoaded,false);assert.equal(s.rivalVisual.actualDeckMeshes,0);assert.equal(h.scene.getObjectByName('Art-rival-body-pivot').children.length,0);assert.equal(h.scene.getObjectByName('Art-rival-deck-pivot').children.length,0);assert.equal(h.fixture.scene.parent===null,true,'Failed candidate must be detached from its loading group');assert(h.fixture.disposals.geometries>0);assert(h.fixture.disposals.materials>0);assert.equal(h.fixture.disposals.textures,1);assert(h.messages.some(m=>m.includes('failed to load')));}finally{cleanup(h);}
});
test('real scene keeps updating after a malformed rival instead of dereferencing a null rig every frame',async()=>{
 const h=await harness({missingBone:true});try{await settle(h);for(let i=0;i<24;i++){h.sim.step(1/120,{push:true});h.mode.step(1/120,{push:true},0);assert.doesNotThrow(()=>h.mode.update(1/120));}assert(h.sim.running);assert(h.mode.rival.elapsed>0);assert(h.scene.getObjectByName('kosher-street-combat').visible);}finally{cleanup(h);}
});
test('successful real skeleton publishes a usable mixer, skeletal pose and complete physical deck together',async()=>{
 const h=await harness();try{await settle(h);const s=h.mode.snapshot();assert.equal(s.modelStatus,'loaded');assert.equal(s.modelError,null);assert.equal(s.rivalVisual.modelLoaded,true);assert(s.rivalVisual.actualDeckMeshes>=10);for(let i=0;i<24;i++){h.sim.step(1/120,{push:true});h.mode.step(1/120,{push:true},0);assert.doesNotThrow(()=>h.mode.update(1/120));}const pose=h.mode.snapshot().rivalVisual.pose;assert(pose);assert(Number.isFinite(pose.compression));assert(pose.leftSoleError<.01&&pose.rightSoleError<.01,JSON.stringify(pose));assert.equal(h.scene.getObjectByName('Art-rival-body-pivot').children.length,1);assert.equal(h.calls,1);}finally{cleanup(h);}
});
test('download failure reports a failed model while the playable action scene remains usable',async()=>{
 const h=await harness({reject:true});try{await settle(h);assert.equal(h.mode.snapshot().modelStatus,'failed');assert.match(h.mode.snapshot().modelError,/Fixture download failed/);assert.equal(h.mode.snapshot().rivalVisual.modelLoaded,false);assert.doesNotThrow(()=>h.mode.update(1/60));h.mode.setEnabled(false);h.mode.setEnabled(true);await settle(h);assert.equal(h.calls,1,'Failed load must not start a per-frame or per-toggle retry storm');}finally{cleanup(h);}
});
