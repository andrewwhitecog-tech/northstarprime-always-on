import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { GLTFLoader } from '/static/vendor/three/0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '/static/vendor/three/0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

function boxAssembly(parts){
 const pieces=parts.map(([w,h,d,x,y,z])=>new THREE.BoxGeometry(w,h,d).toNonIndexed().translate(x,y,z));
 const result=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());if(!result)throw Error('Low-detail bay geometry did not merge');return result;
}
function lowerDetail(mesh,full){
 if(mesh.name==='MasonryBrickAndLintels')return boxAssembly([[.5,8.3,.9,-2.75,4.15,.85],[.5,8.3,.9,2.75,4.15,.85],...[3.35,5.65,8.15].map(y=>[5.5,.24,.8,0,y,.85])]);
 if(mesh.name==='ForgedSteelFrameAndCanopy')return boxAssembly([[.16,8.2,.16,-2.9,4.1,.24],[.16,8.2,.16,2.9,4.1,.24],[6,.10,2.3,0,3.4,-.04],[.13,2.2,.6,2.65,5.4,-.65],[.1,2.9,.12,.95,1.6,.75],[.1,2.9,.12,2.25,1.6,.75],[1.4,.12,.12,1.6,3.05,.75]]);
 if(mesh.name==='BronzeAndCopperHardware')return boxAssembly([[.65,.035,.035,1.6,1.45,.72],[.04,.1,.04,1.9,1.45,.72],[.04,.1,.04,1.3,1.45,.72]]);
 return full.clone();
}
// Actual model for high detail; simplified manufactured structure for the selected low-power tier.
export function installStreetBays(scene,url,onStatus=()=>{}){
 let quality='high';const state={loaded:false,error:null,bays:0,sourceMeshes:0,sourceTriangles:0,batches:0,renderedTriangles:0,lowBatches:0,lowTriangles:0};
 const positions=[];for(const side of [-1,1])for(let bay=0;bay<7;bay++)positions.push({side,bay,x:side*21.6,z:10-bay*6.1,rotation:side>0?Math.PI/2:-Math.PI/2,height:[.92,1.06,.98,1.13][bay%4]});
 for(const side of [-1,1])for(let bay=1;bay<=3;bay++)positions.push({side:0,bay,x:side*bay*6.1,z:-35.55,rotation:Math.PI,height:[1,.94,1.08][bay-1]});
 const cameraBounds=positions.map((p,i)=>({id:'authored-bay-'+i,minX:p.x-(p.side?1.35:3.04),maxX:p.x+(p.side?1.35:3.04),minY:0,maxY:8.44*p.height,minZ:p.z-(p.side?3.04:1.35),maxZ:p.z+(p.side?3.04:1.35)}));
 const group=new THREE.Group(),high=new THREE.Group(),low=new THREE.Group();group.name='Manufactured midnight arcade bays';high.name='Authored full-detail bays';low.name='Low-power distant architecture';group.add(high,low);scene.add(group);
 const setQuality=q=>{quality=q==='low'?'low':'high';high.visible=quality==='high';low.visible=quality==='low';};setQuality('high');onStatus('loading');
 const ready=new GLTFLoader().loadAsync(url).then(gltf=>{
  const meshes=[];gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  if(meshes.length!==8||meshes.some(o=>o.isSkinnedMesh||Array.isArray(o.material)||o.morphTargetInfluences?.length))throw Error('Arcade bay requires eight static single-material meshes');
  if(!meshes.some(o=>o.name==='BayAccentNeon'))throw Error('Arcade bay neon batch missing');state.sourceMeshes=meshes.length;
  const dummy=new THREE.Object3D(),colors=[0x84ff47,0xff377f,0x9670ff,0x3be8eb],glassTints=[0xffd7ac,0x91ebee,0xe79dce,0xa3e4bb],brickTints=[0xbbd7dd,0xe1b99f,0xaca3d1,0xc0cbb3];
  for(const mesh of meshes){
   const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),simple=lowerDetail(mesh,geometry),triangles=(geometry.index?geometry.index.count:geometry.attributes.position.count)/3;state.sourceTriangles+=triangles;
   const buckets=mesh.name==='BayAccentNeon'?colors.map((_,i)=>positions.filter(p=>p.bay%4===i)):[positions];
   for(let bucket=0;bucket<buckets.length;bucket++){
    const items=buckets[bucket],material=mesh.material.clone();if(mesh.name==='BayAccentNeon'){material.color.setHex(colors[bucket]);material.emissive.setHex(colors[bucket]);material.emissiveIntensity=1.6;}
    for(const [parent,geo,isLow]of [[high,geometry,false],[low,simple,true]]){
     const batch=new THREE.InstancedMesh(geo,material,items.length);batch.name=(isLow?'Distant ':'Authored ')+mesh.name+' '+bucket;batch.castShadow=batch.receiveShadow=true;
     items.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(1,p.height,1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(mesh.name==='IndustrialWireGlass')batch.setColorAt(i,new THREE.Color(glassTints[p.bay%4]));if(mesh.name==='MasonryBrickAndLintels')batch.setColorAt(i,new THREE.Color(brickTints[p.bay%4]));});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();parent.add(batch);
     const total=(geo.index?geo.index.count:geo.attributes.position.count)/3*items.length;if(isLow){state.lowBatches++;state.lowTriangles+=total;}else{state.batches++;state.renderedTriangles+=total;}
    }
   }
  }
  // Emissive authored neon shares the existing street-light rig; avoid two additional full-scene light evaluations.
  state.bays=positions.length;state.loaded=true;setQuality(quality);onStatus('loaded');return state;
 }).catch(error=>{state.error=String(error.message||error);onStatus('failed',state.error);return state;});
 return{cameraBounds,ready,setQuality,snapshot:()=>({...state,quality,activeBatches:quality==='low'?state.lowBatches:state.batches,activeTriangles:quality==='low'?state.lowTriangles:state.renderedTriangles})};
}
