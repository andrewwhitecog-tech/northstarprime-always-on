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
 let quality='high';const state={loaded:false,error:null,bays:0,westBays:0,sourceMeshes:0,sourceTriangles:0,omittedMeshes:[],batches:0,renderedTriangles:0,lowBatches:0,lowTriangles:0,facadeDetails:0,normalMappedSources:0,roughnessMappedSources:0};
 const positions=[];for(const side of [1])for(let bay=0;bay<7;bay++)positions.push({side,bay,x:side*21.6,z:10-bay*6.1,rotation:side>0?Math.PI/2:-Math.PI/2,height:[.92,1.06,.98,1.13][bay%4]});
 for(const side of [-1,1])for(let bay=1;bay<=3;bay++)positions.push({side:0,bay,x:side*bay*6.1,z:-35.55,rotation:Math.PI,height:[1,.94,1.08][bay-1]});
 const cameraBounds=positions.map((p,i)=>({id:'authored-bay-'+i,minX:p.x-(p.side?1.35:3.04),maxX:p.x+(p.side?1.35:3.04),minY:0,maxY:8.44*p.height,minZ:p.z-(p.side?3.04:1.35),maxZ:p.z+(p.side?3.04:1.35)}));
 const group=new THREE.Group(),high=new THREE.Group(),low=new THREE.Group();group.name='Weathered east and north coastal warehouse facades';high.name='Authored full-detail bays';low.name='Low-power distant architecture';group.add(high,low);scene.add(group);
 const setQuality=q=>{quality=q==='low'?'low':'high';high.visible=quality==='high';low.visible=quality==='low';};setQuality('high');onStatus('loading');
 const ready=new GLTFLoader().loadAsync(url).then(gltf=>{
  const meshes=[];gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  if(meshes.length!==8||meshes.some(o=>o.isSkinnedMesh||Array.isArray(o.material)||o.morphTargetInfluences?.length))throw Error('Arcade bay requires eight static single-material meshes');
  if(!meshes.some(o=>o.name==='BayAccentNeon'))throw Error('Arcade bay neon batch missing');state.sourceMeshes=meshes.length;
  const dummy=new THREE.Object3D(),glassTints=[0xa29d8e,0x80867c,0x9a978d,0x747a75],brickTints=[0xc5b69d,0xa9a99b,0xb4a18d,0xc7c1b0];
  for(const mesh of meshes){
   state.sourceTriangles+=(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3;
   if(mesh.name==='BayAccentNeon'){state.omittedMeshes.push(mesh.name);continue;}
   const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),simple=lowerDetail(mesh,geometry),material=mesh.material.clone();
   // Retain the authored physical texture channels, without rainbow light strips.
   material.vertexColors=false;material.emissive.setHex(0x000000);material.emissiveIntensity=0;material.emissiveMap=null;
   const finishes={MasonryBrickAndLintels:[0xd7cdb9,.94,.02],ForgedSteelFrameAndCanopy:[0x6c7068,.78,.58],CorrugatedSecurityShutter:[0x8b8c7b,.83,.36],HazardAndThresholdPlates:[0xc3b57d,.85,.18],BronzeAndCopperHardware:[0xa99572,.68,.58],VorathGoldSpectralTrim:[0x99845b,.68,.58],IndustrialWireGlass:[0x565e58,.46,.13]};
   const finish=finishes[mesh.name];if(finish){material.color.setHex(finish[0]);material.roughness=finish[1];material.metalness=finish[2];}
   // These two diffuse maps contain baked prismatic/colored pane fills. The
   // normal and roughness maps remain the real source material's maps.
   if(['VorathGoldSpectralTrim','IndustrialWireGlass'].includes(mesh.name))material.map=null;
   if('clearcoat'in material)material.clearcoat=mesh.name==='IndustrialWireGlass'?.18:.04;
   if('iridescence'in material)material.iridescence=mesh.name==='VorathGoldSpectralTrim'?.10:0;
   if(material.normalMap)state.normalMappedSources++;if(material.roughnessMap)state.roughnessMappedSources++;material.needsUpdate=true;
   for(const [parent,geo,isLow]of [[high,geometry,false],[low,simple,true]]){
    const batch=new THREE.InstancedMesh(geo,material,positions.length);batch.name=(isLow?'Distant ':'Authored ')+mesh.name;batch.castShadow=batch.receiveShadow=true;
    positions.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(1,p.height,1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(mesh.name==='IndustrialWireGlass')batch.setColorAt(i,new THREE.Color(glassTints[p.bay%4]));if(mesh.name==='MasonryBrickAndLintels')batch.setColorAt(i,new THREE.Color(brickTints[p.bay%4]));});batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();parent.add(batch);
    const total=(geo.index?geo.index.count:geo.attributes.position.count)/3*positions.length;if(isLow){state.lowBatches++;state.lowTriangles+=total;}else{state.batches++;state.renderedTriangles+=total;}
   }
  }
  // Small service details break repeated bays without adding obstacles in the
  // skating area: all are inside the existing facade camera envelope.
  const service=[],boards=[];
  for(const p of positions){
   const kind=p.bay%4;
   if(kind===0){service.push({p,l:[-1.9,.6,.18],s:[.075,1.1,.11]},{p,l:[1.9,.6,.18],s:[.075,1.1,.11]},{p,l:[0,1.34,.19],s:[1.15,.055,.08]});}
   if(kind===1){for(let i=0;i<3;i++)boards.push({p,l:[-1.3,4.16+i*.25,.17],s:[1.9,.16,.045],angle:(i-1)*.035});}
   if(kind===2){service.push({p,l:[2.17,4.22,-.02],s:[.78,.50,.44]},{p,l:[2.55,2.18,.10],s:[.055,3.66,.075]});for(let i=0;i<6;i++)service.push({p,l:[1.87+i*.12,4.22,-.26],s:[.025,.37,.035]});}
   if(kind===3){service.push({p,l:[-1.68,2.75,.13],s:[.55,.38,.16]},{p,l:[-1.68,2.75,.025],s:[.34,.22,.04]});for(let i=0;i<4;i++)service.push({p,l:[1.82,5.0+i*.14,.15],s:[.8,.035,.06]});}
  }
  const detailGeometry=new THREE.BoxGeometry(1,1,1),bayTransform=new THREE.Matrix4(),local=new THREE.Object3D(),combined=new THREE.Matrix4(),bayQuaternion=new THREE.Quaternion();
  for(const [name,items,material]of [['Service hardware, drain pipes and loading guards',service,new THREE.MeshStandardMaterial({color:0x666b61,roughness:.86,metalness:.46})],['Weathered boarded casements',boards,new THREE.MeshStandardMaterial({color:0x82715b,roughness:.96,metalness:0})]]){
   if(!items.length)continue;state.facadeDetails+=items.length;
   for(const [parent,isLow]of [[high,false],[low,true]]){
    const batch=new THREE.InstancedMesh(detailGeometry,material,items.length);batch.name=name;batch.castShadow=batch.receiveShadow=true;
    items.forEach((item,i)=>{const p=item.p;bayQuaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation);bayTransform.compose(new THREE.Vector3(p.x,0,p.z),bayQuaternion,new THREE.Vector3(1,p.height,1));local.position.fromArray(item.l);local.scale.fromArray(item.s);local.rotation.set(0,0,item.angle||0);local.updateMatrix();combined.multiplyMatrices(bayTransform,local.matrix);batch.setMatrixAt(i,combined);});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();parent.add(batch);
    const total=(detailGeometry.index?detailGeometry.index.count:detailGeometry.attributes.position.count)/3*items.length;if(isLow){state.lowBatches++;state.lowTriangles+=total;}else{state.batches++;state.renderedTriangles+=total;}
   }
  }
  // No facade accent light sources or west wall; the shore remains open.
  state.bays=positions.length;state.westBays=positions.filter(p=>p.side===-1).length;state.loaded=true;setQuality(quality);onStatus('loaded');return state;
 }).catch(error=>{state.error=String(error.message||error);onStatus('failed',state.error);return state;});
 return{cameraBounds,ready,setQuality,snapshot:()=>({...state,quality,activeBatches:quality==='low'?state.lowBatches:state.batches,activeTriangles:quality==='low'?state.lowTriangles:state.renderedTriangles})};
}
