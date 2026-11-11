import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { GLTFLoader } from '/static/vendor/three/0.160.0/examples/jsm/loaders/GLTFLoader.js';

// Authored Antigravity kit, repeated without repeating 112 draw submissions.
// These are visual bays outside the playable street, never physics colliders.
export function installStreetBays(scene,url,onStatus=()=>{}){
 const state={loaded:false,error:null,bays:0,sourceMeshes:0,sourceTriangles:0,batches:0,renderedTriangles:0};
 const positions=[];for(const side of [-1,1])for(let bay=0;bay<7;bay++)positions.push({side,bay,x:side*21.6,z:10-bay*6.1,rotation:side>0?Math.PI/2:-Math.PI/2});
 // Six end-wall fronts sit wholly beyond z=-34, with a clear central eye portal.
 for(const side of [-1,1])for(let bay=1;bay<=3;bay++)positions.push({side:0,bay,x:side*bay*6.1,z:-35.55,rotation:Math.PI});
 const cameraBounds=positions.map((p,i)=>({id:'authored-bay-'+i,minX:p.x-(p.side?1.35:3.04),maxX:p.x+(p.side?1.35:3.04),minY:0,maxY:8.44,minZ:p.z-(p.side?3.04:1.35),maxZ:p.z+(p.side?3.04:1.35)}));
 const group=new THREE.Group();group.name='Manufactured midnight arcade bays';scene.add(group);onStatus('loading');
 const ready=new GLTFLoader().loadAsync(url).then(gltf=>{
  const meshes=[];gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  if(meshes.length!==8||meshes.some(o=>o.isSkinnedMesh||Array.isArray(o.material)||o.morphTargetInfluences?.length))throw Error('Arcade bay requires eight static single-material meshes');
  if(!meshes.some(o=>o.name==='BayAccentNeon'))throw Error('Arcade bay neon batch is missing');
  state.sourceMeshes=meshes.length;
  const dummy=new THREE.Object3D(),matrix=new THREE.Matrix4(),colors=[0x84ff47,0xff377f,0x9670ff,0x3be8eb];
  for(const mesh of meshes){
   const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),triangles=(geometry.index?geometry.index.count:geometry.attributes.position.count)/3;
   state.sourceTriangles+=triangles;
   const buckets=mesh.name==='BayAccentNeon'?colors.map((_,i)=>positions.filter(p=>p.bay%4===i)):[positions];
   for(let bucket=0;bucket<buckets.length;bucket++){
    const items=buckets[bucket],material=mesh.material.clone();
    if(mesh.name==='BayAccentNeon'){material.color.setHex(colors[bucket]);material.emissive.setHex(colors[bucket]);material.emissiveIntensity=1.6;}
    const batch=new THREE.InstancedMesh(geometry,material,items.length);batch.name='Arcade '+mesh.name+' '+bucket;batch.castShadow=batch.receiveShadow=true;
    items.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(1,1,1);dummy.updateMatrix();matrix.copy(dummy.matrix);batch.setMatrixAt(i,matrix);});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();group.add(batch);state.batches++;state.renderedTriangles+=triangles*items.length;
   }
  }
  state.bays=positions.length;state.loaded=true;onStatus('loaded');return state;
 }).catch(error=>{state.error=String(error.message||error);onStatus('failed',state.error);return state;});
 return{cameraBounds,ready,snapshot:()=>({...state})};
}
