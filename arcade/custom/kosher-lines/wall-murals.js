import {CITY_COLLIDERS} from './chapter.mjs';
import {installLivingEyeEffect} from './living-eye-effect.js';
// Original paint mounted to actual concrete faces, never a screen overlay.
export function createWallMurals({THREE,scene,murals=[],surfaces=[],textureLoader=null}){
 const root=new THREE.Group();root.name='Coastal-neighborhood-painted-walls';scene.add(root);
 const geometries=new Set(),materials=new Set(),textures=new Set(),records=[],cameraBounds=[],effects=[];let disposed=false;const viewerLocal=new THREE.Vector3();
 const loader=textureLoader||new THREE.TextureLoader();
 const concrete=new THREE.MeshStandardMaterial({color:0xa6a59a,roughness:.96,metalness:0});materials.add(concrete);
 const normalize=m=>{if(!m||typeof m.id!=='string'||!m.id.trim()||typeof m.url!=='string'||!m.url.startsWith('/arcade/custom/')||m.url.includes('\\')||!Number.isFinite(m.aspect)||m.aspect<=0||m.aspect>=8)return false;try{const url=new URL(m.url,'https://local.invalid');return url.origin==='https://local.invalid'&&decodeURIComponent(url.pathname).startsWith('/arcade/custom/')&&!decodeURIComponent(url.pathname).split('/').includes('..');}catch{return false;}};
 const selected=[],seen=new Set(),east=CITY_COLLIDERS.filter(b=>b.kind==='bay-wall'&&b.x>0).sort((a,b)=>b.z-a.z);let slot=0,memorial=0,memorialCount=0,streetCount=0;for(const m of Array.isArray(murals)?murals:[]){if(!normalize(m)||seen.has(m.id))continue;seen.add(m.id);if(m.family==='memorial'){if(memorialCount>=2)continue;memorialCount++;}else{if(streetCount>=east.length)continue;streetCount++;}selected.push(m);}
 function support(position,width,height,normal,id){
  const ns=new THREE.Vector3(normal.x,normal.y,normal.z).normalize(),isEast=Math.abs(ns.x)>.5;
  const g=new THREE.BoxGeometry(isEast?.5:width,height,isEast?width:.5);geometries.add(g);const mesh=new THREE.Mesh(g,concrete);mesh.name=id+' physical-concrete';mesh.position.set(position.x,position.y,position.z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  cameraBounds.push({id,minX:position.x-(isEast?.25:width/2),maxX:position.x+(isEast?.25:width/2),minY:position.y-height/2,maxY:position.y+height/2,minZ:position.z-(isEast?width/2:.25),maxZ:position.z+(isEast?width/2:.25)});
  return {position:{x:position.x+ns.x*.253,y:position.y,z:position.z+ns.z*.253},normal,width,height};
 }
 async function mount(m,face,id){
  const normal=new THREE.Vector3(face.normal.x,face.normal.y,face.normal.z).normalize(),h=Math.min(face.height,face.width/m.aspect),w=h*m.aspect;
  const geometry=new THREE.PlaneGeometry(w,h);geometries.add(geometry);
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,metalness:.035,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});materials.add(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=id;mesh.position.set(face.position.x+normal.x*.003,face.position.y+normal.y*.003,face.position.z+normal.z*.003);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);mesh.receiveShadow=true;mesh.castShadow=false;mesh.visible=false;root.add(mesh);
  const row={id,artId:m.id,label:m.label||m.id,family:m.family||'street',status:'loading',width:w,height:h,position:{x:mesh.position.x,y:mesh.position.y,z:mesh.position.z},error:null};records.push(row);
  if(m.livingEyes?.enabled===true&&Array.isArray(m.livingEyes.eyes)){try{const effect=installLivingEyeEffect({...m.livingEyes,THREE,material,memorial:m.family==='memorial',allowMemorial:false});effects.push({effect,mesh,row});}catch(error){row.effectError=String(error.message||error);}}
  try{const texture=await loader.loadAsync(m.url);if(disposed){texture.dispose();row.status='disposed';return;}texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;textures.add(texture);material.map=texture;material.needsUpdate=true;mesh.visible=true;row.status='loaded';}
  catch(error){row.status='failed';row.error=String(error.message||error);}
 }
 const jobs=[];for(const m of selected){let face;
  if(m.family==='memorial'){const x=memorial++===0?-8:8;face=support({x,y:1.45,z:-35.55},6,2.65,{x:0,y:0,z:1},'memorial-wall-'+memorial);}
  else{const b=east[slot++];if(!b)continue;face=support({x:b.x,y:1.42,z:b.z},Math.min(5.85,b.d-.08),2.65,{x:-1,y:0,z:0},'warehouse-painted-bay-'+slot);}
  jobs.push(mount(m,face,'mural-'+m.id));
 }
 // Small secondary pieces occupy real exposed seawall faces and keep aspect.
 const repeats=selected.filter(m=>m.family==='street'||m.family==='vorath').slice(0,2);
 repeats.forEach((m,i)=>{const s=surfaces[i*3];if(s&&s.width>0&&s.height>0)jobs.push(mount(m,s,'seawall-'+m.id));});
 const ready=Promise.all(jobs).then(()=>snapshot());
 function snapshot(){return {requested:selected.length,paintedFaces:records.length,loaded:records.filter(r=>r.status==='loaded').length,failed:records.filter(r=>r.status==='failed').length,disposed,worldSpace:true,artAcceptance:'source-art-only; native wall inspection required',records:records.map(r=>({...r,position:{...r.position},livingEye:effects.find(e=>e.row===r)?.effect.snapshot()||null}))};}
 function update(dt,{paused=false,viewer=null}={}){if(disposed)return;for(const {effect,mesh} of effects){let gaze;if(viewer&&Number.isFinite(viewer.x)&&Number.isFinite(viewer.y)&&Number.isFinite(viewer.z)){viewerLocal.set(viewer.x,viewer.y,viewer.z);mesh.worldToLocal(viewerLocal);const distance=Math.max(2.5,Math.abs(viewerLocal.z));gaze={x:Math.max(-1,Math.min(1,viewerLocal.x/distance)),y:Math.max(-1,Math.min(1,viewerLocal.y/distance))};}effect.update(dt,{paused,gaze});}}
 function dispose(){if(disposed)return;disposed=true;for(const e of effects)e.effect.dispose();root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 return {root,ready,update,snapshot,dispose,cameraBounds};
}
export default createWallMurals;
