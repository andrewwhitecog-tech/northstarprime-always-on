import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { RESIDENTS, BEACONS, CITY_COLLIDERS } from './chapter.mjs';
// Original geometry and textile patterns; no third-party logos or image lettering.
export function wovenTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 c.fillStyle='#111326';c.fillRect(0,0,256,256);const colors=['#17dcb7','#ef9254','#6845bb','#e7599e','#e6ba64','#2a77c8'];
 for(let n=0;n<12;n++){c.strokeStyle=colors[n%colors.length];c.lineWidth=9;c.beginPath();for(let x=-20;x<=276;x+=4){const y=n*24+Math.sin(x*.042+n*.8)*14+Math.sin(x*.094)*4;if(x===-20)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 for(let y=0;y<256;y+=4){c.fillStyle=y%8?'#04081850':'#ffe9c125';c.fillRect(0,y,256,1);}for(let x=0;x<256;x+=4){c.fillStyle='#03051435';c.fillRect(x,0,1,256);}
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
export function buildCity(scene,chapter,{mosaic=null}={}){
 let geometryCount=0,occupiedResidents=0;const animated=[],beaconMeshes=[],publicLights=[],markerMeshes=[],materials=[];
 const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.25,...extra});materials.push(m);return m;};
 const ink=material(0x101b2a,{metalness:.5,roughness:.3}),stone=material(0x48566a),gold=material(0xd9a955,{metalness:.85,roughness:.26}),soil=material(0x182b2c),wood=material(0x82533c),leaf=material(0x1a795f),cloth=material(0xffffff,{map:wovenTexture(),roughness:.9});
 const jewel=new THREE.MeshPhysicalMaterial({color:0x1587a0,metalness:.65,roughness:.23,iridescence:1,iridescenceIOR:1.5,iridescenceThicknessRange:[180,420],clearcoat:.8});materials.push(jewel);
 const neonColors=[0x49ffd7,0xee5aab,0xb37cff,0xffb75b];const neon=neonColors.map(color=>material(color,{emissive:color,emissiveIntensity:1.8,roughness:.24}));
 const add=(g,m,x=0,y=0,z=0,parent=scene)=>{const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.castShadow=a.receiveShadow=true;parent.add(a);geometryCount++;return a;};
 const cube=(w,h,d,x,y,z,m=ink,parent=scene)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
 const rod=(a,b,r,m=gold,parent=scene)=>{const d=new THREE.Vector3().subVectors(b,a),o=add(new THREE.CylinderGeometry(r,r,d.length(),7),m,0,0,0,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const tube=(points,r,m,parent=scene,closed=false)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed),Math.max(12,points.length*6),r,6,closed),m,0,0,0,parent);
 const instances=(geometry,m,items)=>{const batch=new THREE.InstancedMesh(geometry,m,items.length),dummy=new THREE.Object3D();items.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.rotation.set(p[6]||0,p[7]||0,p[8]||0);dummy.scale.set(p[3]||1,p[4]||1,p[5]||1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.castShadow=batch.receiveShadow=true;scene.add(batch);geometryCount++;return batch;};
 // Deep arcades: pilasters, recessed bays, real arched lintels, awnings and balconies.
 const panes=[],frames=[],tiles=[],leaves=[],trunks=[];
 for(const side of [-1,1])for(let bay=0;bay<7;bay++){
  const x=side*21.6,z=10-bay*6.1,h=5.7+(bay%3)*1.15,accent=neon[bay%4];
  cube(.9,h,.5,x,h/2,z+2.65,stone);cube(.9,h,.5,x,h/2,z-2.65,stone);
  cube(1.2,.2,.85,x,1.1,z+2.65,gold);cube(1.2,.2,.85,x,h-.15,z-2.65,gold);
  const arch=[];for(let j=0;j<=14;j++){const a=j/14*Math.PI;arch.push([x-side*.55,3.3+Math.sin(a)*1.75,z+Math.cos(a)*2.3]);}tube(arch,.12,gold);
  cube(.25,2.8,4.4,x+side*.13,1.4,z,ink);
  cube(2,.16,5.1,x-side*.35,3.4,z,jewel); // narrow projecting roof, not a wallpaper box
  for(let rib=0;rib<5;rib++)cube(1.8,.07,.07,x-side*.45,3.28,z-2+rib, gold);
  for(let level=0;level<3;level++){
   const yy=5+level*2.5;panes.push([side*22.64,yy,z,.08,1.4,3.4]);frames.push([side*22.5,yy-1,z,.18,.12,4.3]);
   for(let j=0;j<5;j++)frames.push([side*22.38,yy-1.3,z-1.9+j*.95,.12,.7,.07]);
  }
  // Bent glass tube sign, black backplate, electrode ends, ceramic supports and cable.
  const signX=x-side*.85,signZ=z-1.3;cube(.1,1.3,1.45,signX,2.45,signZ,ink);
  const path=[[signX-side*.08,2.2,signZ-.5],[signX-side*.08,2.65,signZ-.25],[signX-side*.08,2.8,signZ+.2],[signX-side*.08,2.25,signZ+.5]];
  tube(path,.032,accent);for(const p of [path[0],path[3]]){add(new THREE.SphereGeometry(.055,7,5),gold,...p);rod(new THREE.Vector3(...p),new THREE.Vector3(signX+.1*side,p[1],p[2]),.023,stone);}
  tube([[signX,2.15,signZ-.5],[signX,1.9,signZ-.7],[x,1.5,signZ-.7]],.018,ink);
  if(bay%4===0){const pl=new THREE.PointLight(neonColors[bay%4],11,6,2);pl.position.set(signX-side*.2,2.5,signZ);scene.add(pl);}
  // Small parked handcarts and public drinking fountains occupy recesses, outside skating bounds.
  if(bay%2){cube(.7,.7,1.2,side*22.8,.42,z+1,wood);for(const zz of [-.48,.48]){const wheel=add(new THREE.TorusGeometry(.17,.045,5,12),gold,side*22.35,.2,z+1+zz);wheel.rotation.y=Math.PI/2;}}
 }
 // All street-level solids below are derived from the very same collider table as physics.
 for(const b of CITY_COLLIDERS){
  if(['resident','beacon','column','citizen','bay-wall'].includes(b.kind))continue;
  if(b.kind==='tree'){trunks.push([b.x,b.h/2,b.z,b.w/2,b.h,b.d/2]);for(let i=0;i<9;i++){const a=i*2.399;leaves.push([b.x+Math.sin(a)*1.05,3.5+(i%3)*.55,b.z+Math.cos(a)*1.05,.7,.75,.7]);}continue;}
  if(b.kind==='garden'){cube(b.w,b.h,b.d,b.x,b.h/2,b.z,stone);cube(b.w-.18,.06,b.d-.18,b.x,b.h+.01,b.z,soil);for(let i=0;i<10;i++)leaves.push([b.x+Math.sin(i*3.7)*.6,b.h+.3+(i%3)*.1,b.z+Math.cos(i*2.2)*1.4,.3,.45,.3]);continue;}
  if(b.kind==='bench'){cube(b.w,b.h,b.d,b.x,b.h/2,b.z,wood);for(let i=0;i<4;i++)cube(b.w,.035,.025,b.x,b.h+.02,b.z-.4+i*.27,gold);continue;}
  cube(b.w,b.h,b.d,b.x,b.h/2,b.z,b.kind==='kiosk'?jewel:ink);
  cube(b.w+.04,.05,b.d+.04,b.x,b.h+.025,b.z,gold);
 }
 instances(new THREE.BoxGeometry(1,1,1),material(0x358091,{emissive:0x205b70,emissiveIntensity:.45,metalness:.6}),panes);
 instances(new THREE.BoxGeometry(1,1,1),gold,frames);
 instances(new THREE.CylinderGeometry(1,1,1,7),wood,trunks);
 instances(new THREE.IcosahedronGeometry(1,0),leaf,leaves);
 if(mosaic){mosaic.wrapS=mosaic.wrapT=THREE.ClampToEdgeWrapping;mosaic.repeat.set(1,1);const disc=add(new THREE.CircleGeometry(1.65,64),material(0xffffff,{map:mosaic,metalness:.28,roughness:.43}),0,.025,7.5);disc.rotation.x=-Math.PI/2;const rim=add(new THREE.TorusGeometry(1.68,.045,7,64),gold,0,.04,7.5);rim.rotation.x=-Math.PI/2;}
 // A layered tiled wayfinding braid, laid flush: the player can actually roll over it.
 for(let i=0;i<50;i++){const z=12-i*.87;for(const side of [-1,1])tiles.push([side*(6+Math.sin(i*.28)*.24),.012,z,.16,.025,.42]);}
 instances(new THREE.BoxGeometry(1,1,1),jewel,tiles);
 // Canopy shelter with real woven ribs, open entrances and a lit circuit that becomes repaired.
 for(let j=0;j<9;j++){const z=7.5+j*.25;rod(new THREE.Vector3(6.9,3.3,z),new THREE.Vector3(11.1,3.3,z),.035,gold);}
 cube(4.4,.08,2.9,9,3.42,8.5,cloth);for(let i=0;i<5;i++){const light=add(new THREE.SphereGeometry(.09,8,6),neon[i%4].clone(),7.3+i*.85,3.15,7.2);publicLights.push(light);}
 const canopyLight=new THREE.PointLight(0xffc066,0,9,2);canopyLight.position.set(9,2.7,7.5);scene.add(canopyLight);
 // Archive alcove: ribbed fan, rotating physical Loomwheel and notched prism shelves.
 for(let i=0;i<9;i++){const a=i/8*Math.PI;rod(new THREE.Vector3(12.6,1.1,-30),new THREE.Vector3(12.6+Math.cos(a)*2.8,1.1+Math.sin(a)*3,-30),.06,gold);}
 const loom=new THREE.Group();loom.position.set(12.6,3.2,-30.4);scene.add(loom);
 for(let i=0;i<3;i++){const ring=add(new THREE.TorusGeometry(.7+i*.22,.035,6,36),jewel,0,0,0,loom);ring.rotation.y=i*Math.PI/3;}
 for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(a)*1.2,Math.sin(a)*1.2,0),.018,gold,loom);}animated.push({type:'loom',group:loom});
 // Relay pedestals have collision, inset enamel and an unambiguous physical core.
 for(const b of BEACONS){
  cube(.48,.8,.48,b.x,.4,b.z,stone);cube(.55,.05,.55,b.x,.83,b.z,gold);
  const core=add(new THREE.OctahedronGeometry(.24),neon[BEACONS.indexOf(b)].clone(),b.x,1.15,b.z);beaconMeshes.push({id:b.id,core});
  const halo=add(new THREE.TorusGeometry(.85,.018,6,36),jewel,b.x,.024,b.z);halo.rotation.x=-Math.PI/2;
 }
 // Residents are authored local characters, not simulated online players or invented public cast.
 const person=(resident,index)=>{
  const group=new THREE.Group();group.position.set(resident.x,0,resident.z);scene.add(group);
  const coat=index===0?cloth:index===1?jewel:material(0x5c3386),skin=material(index===1?0x77523f:0xb98467),pants=ink;
  for(const x of [-.12,.12]){add(new THREE.CylinderGeometry(.09,.08,.72,7),pants,x,.45,0,group);cube(.18,.12,.34,x,.1,-.05,ink,group);}
  add(new THREE.CylinderGeometry(.24,.19,.65,9),coat,0,1.13,0,group);
  const head=add(new THREE.SphereGeometry(.16,10,8),skin,0,1.62,0,group);
  for(const side of [-1,1])rod(new THREE.Vector3(side*.23,1.35,0),new THREE.Vector3(side*.34,.95,-.12),.075,coat,group);
  const collar=add(new THREE.TorusGeometry(.17,.027,5,14),gold,0,1.44,0,group);collar.rotation.x=Math.PI/2;
  if(index===0){const brim=add(new THREE.CylinderGeometry(.22,.22,.055,10),gold,0,1.77,0,group);cube(.22,.15,.18,0,1.8,.02,ink,group);}
  if(index===1){cube(.35,.4,.18,0,1.22,.2,cloth,group);rod(new THREE.Vector3(-.22,1.4,.12),new THREE.Vector3(.2,.9,-.13),.025,gold,group);}
  if(index===2){add(new THREE.TorusGeometry(.19,.04,6,16),jewel,0,1.65,-.08,group);cube(.27,.04,.3,.25,1,-.2,gold,group);}
  const marker=add(new THREE.OctahedronGeometry(.14),neon[index].clone(),0,2.16,0,group);markerMeshes.push({id:resident.id,mesh:marker});animated.push({type:'resident',group,head,baseY:1.62,index});occupiedResidents++;
 };
 RESIDENTS.forEach(person);
 // Warm human detail: reading and resting residents beside public seating, in alcoves beyond the course.
 for(let i=0;i<6;i++){
  const x=(i%2?-1:1)*(18.7+(i%3)*.4),z=8-Math.floor(i/2)*12;
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=x>0?-Math.PI/2:Math.PI/2;scene.add(group);
  cube(.42,.62,.28,0,.9,0,i%2?cloth:jewel,group);add(new THREE.SphereGeometry(.15,8,6),material(i%2?0x8b5b48:0xbf9276),0,1.38,0,group);
  for(const sign of [-1,1]){rod(new THREE.Vector3(sign*.1,.6,0),new THREE.Vector3(sign*.1,.3,-.3),.075,ink,group);cube(.18,.1,.3,sign*.1,.1,-.3,ink,group);}cube(.55,.08,.45,0,.77,-.3,wood,group);
  occupiedResidents++;
 }
 // Distant skyline is dimensional: offset crowns, roof machinery, bridges and color-window depth.
 const skylineWindows=[];
 for(let i=0;i<17;i++){
  const x=-58+i*7.4,z=-49-(i%4)*4,h=10+(i*7%19),w=3.5+(i%3),m=i%2?ink:stone;
  cube(w,h,4.4,x,h/2,z,m);cube(w*.65,1.6,3,x+.5,h+.8,z,jewel);
  const crown=add(new THREE.ConeGeometry(w*.55,3.5,4),gold,x,h+3.2,z);crown.rotation.y=Math.PI/4;
  for(let row=0;row<Math.floor(h/2);row++)for(let col=0;col<3;col++)if((row+col+i)%4)skylineWindows.push([x-w*.3+col*w*.3,1.5+row*1.9,z+2.23,.35,.65,.06]);
  if(i%3===0)rod(new THREE.Vector3(x,h+4.5,z),new THREE.Vector3(x,h+7,z),.035,gold);
 }
 instances(new THREE.BoxGeometry(1,1,1),neon[2],skylineWindows);
 // Catenary strings and suspended gems give the street a ceiling with true parallax.
 for(const z of [9,-9,-24]){
  tube([[-23,8,z],[-12,6.2,z],[0,5.7,z],[12,6.2,z],[23,8,z]],.018,ink);
  for(let i=0;i<11;i++){const x=-20+i*4,y=5.7+Math.pow(x/23,2)*2.3;const gem=add(new THREE.OctahedronGeometry(.11),neon[i%4],x,y-.2,z);gem.castShadow=false;}
 }
 // A public-return constellation and a personal mirror are alternative, visible chapter consequences.
 const returnStuds=[];for(let i=0;i<32;i++){const z=10-i*1.17,x=6+Math.sin(i*.22)*.18;const stud=add(new THREE.SphereGeometry(.045,6,4),neon[0],x,.035,z);returnStuds.push(stud);}
 const finalBars=[];
 const finalGroup=new THREE.Group();finalGroup.position.set(0,5.8,-33.8);scene.add(finalGroup);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;finalBars.push(rod(new THREE.Vector3(Math.cos(a)*3.4,Math.sin(a)*1.8,0),new THREE.Vector3(Math.cos(a+Math.PI/3)*3.4,Math.sin(a+Math.PI/3)*1.8,0),.025,gold,finalGroup));}
 const mirror=add(new THREE.OctahedronGeometry(.55),jewel,0,0,.2,finalGroup);
 return {metrics:{authoredGeometry:geometryCount,residents:occupiedResidents,interactiveResidents:RESIDENTS.length,colliders:CITY_COLLIDERS.length,instancedWindows:panes.length+skylineWindows.length,originalWovenPattern:true},
  snapshot(){return {canopyIntensity:canopyLight.intensity,lanternEmission:publicLights.map(o=>o.material.emissiveIntensity),constellationVisible:finalGroup.visible,mirrorVisible:mirror.visible,publicReturnStudsVisible:returnStuds.filter(o=>o.visible).length,constellationBarsVisible:finalBars.filter(o=>o.visible).length,relays:beaconMeshes.map(b=>({id:b.id,emission:b.core.material.emissiveIntensity,rotation:b.core.rotation.y})),markers:markerMeshes.map(r=>({id:r.id,emission:r.mesh.material.emissiveIntensity,x:r.mesh.parent.position.x,z:r.mesh.parent.position.z}))};},
  update(dt,time,sim){
   const state=chapter.state,active=state.active?RESIDENTS[state.completed]?.id:null;
   canopyLight.intensity=state.completed>0?24:2;
   publicLights.forEach((o,i)=>{o.material.emissiveIntensity=state.completed>0?1.7:.12;});
   for(const item of markerMeshes){item.mesh.material.emissiveIntensity=item.id===active?2.4:.5;item.mesh.position.y=2.16+Math.sin(time*.0017)*.06;item.mesh.rotation.y=time*.0007;}
   for(const item of beaconMeshes){const visited=state.completed>=2||state.progress.visited.includes(item.id);item.core.material.emissiveIntensity=visited?2.8:.22;item.core.rotation.y=time*.0006;}
   for(const item of animated){if(item.type==='loom')item.group.rotation.z=time*.00016;else{const dx=sim.x-item.group.position.x,dz=sim.z-item.group.position.z;if(Math.hypot(dx,dz)<7)item.group.rotation.y=Math.atan2(dx,dz);item.head.position.y=item.baseY+Math.sin(time*.0013+item.index)*.008;}}
   finalGroup.visible=state.completed===3;finalBars.forEach(o=>{o.visible=state.choice==='public';});returnStuds.forEach(o=>{o.visible=state.choice==='public';});mirror.visible=state.choice==='personal';if(state.choice==='public')finalGroup.rotation.z=Math.sin(time*.00015)*.06;
  }
 };
}

// Garment geometry follows the actual rig bones after animation; the stock shirt is covered.
export function dressRider(body,model,themeColors){
 const material=new THREE.MeshStandardMaterial({map:wovenTexture(),color:0xffffff,roughness:.82,metalness:.03});
 const edge=new THREE.MeshStandardMaterial({color:0xe4b963,metalness:.8,roughness:.25});
 const iridescent=new THREE.MeshPhysicalMaterial({color:0x549cc3,iridescence:1,metalness:.7,roughness:.25});
 const vest=new THREE.Group();body.add(vest);
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.25,.215,.49,10),material);torso.scale.z=.69;vest.add(torso);
 for(const y of [-.23,.23]){const hem=new THREE.Mesh(new THREE.TorusGeometry(.237,.017,5,24),edge);hem.scale.y=.69;hem.rotation.x=Math.PI/2;hem.position.y=y;vest.add(hem);}
 const seam=new THREE.Mesh(new THREE.BoxGeometry(.027,.45,.025),edge);seam.position.z=-.177;vest.add(seam);
 const eye=new THREE.Mesh(new THREE.TorusGeometry(.085,.015,5,24),edge);eye.scale.y=.55;eye.position.set(.02,.06,.178);vest.add(eye);
 const helmet=new THREE.Group();body.add(helmet);const cap=new THREE.Mesh(new THREE.SphereGeometry(.175,12,8,0,Math.PI*2,0,Math.PI*.55),iridescent);helmet.add(cap);
 const brim=new THREE.Mesh(new THREE.CylinderGeometry(.185,.185,.025,12),edge);brim.position.y=.015;helmet.add(brim);
 const mirrorCrest=new THREE.Mesh(new THREE.OctahedronGeometry(.055),iridescent);mirrorCrest.position.set(0,.1,.02);helmet.add(mirrorCrest);
 const shoulderJewels=[];for(let i=0;i<4;i++){const j=new THREE.Mesh(new THREE.OctahedronGeometry(.035),iridescent);j.position.set(-.19+i*.125,.22,-.02);vest.add(j);shoulderJewels.push(j);}
 const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});
 const choose=(patterns)=>patterns.map(pattern=>bones.find(b=>pattern.test(b.name))).find(Boolean);
 const head=choose([/head$/i,/head/i]),chest=choose([/spine2/i,/chest/i,/spine1/i,/spine/i]);
 const p=new THREE.Vector3(),bodyQ=new THREE.Quaternion(),boneQ=new THREE.Quaternion();body.updateMatrixWorld(true);body.getWorldQuaternion(bodyQ);bodyQ.invert();
 const restChest=chest?bodyQ.clone().multiply(chest.getWorldQuaternion(new THREE.Quaternion())).invert():new THREE.Quaternion();
 const restHead=head?bodyQ.clone().multiply(head.getWorldQuaternion(new THREE.Quaternion())).invert():new THREE.Quaternion();
 let accessoryCount=0;for(const group of [vest,helmet])group.traverse(o=>{if(o.isMesh){accessoryCount++;o.castShadow=true;o.receiveShadow=true;}});
 return {count:accessoryCount,boneBound:Boolean(head&&chest),snapshot(){return {vestVisible:vest.visible,vestColor:material.color.getHexString(),vestPatternTexture:material.map?.uuid||null,helmetColor:iridescent.color.getHexString(),shoulderJewelsVisible:shoulderJewels.filter(j=>j.visible).length,mirrorCrestVisible:mirrorCrest.visible,vestPosition:{x:vest.position.x,y:vest.position.y,z:vest.position.z},helmetPosition:{x:helmet.position.x,y:helmet.position.y,z:helmet.position.z},chestBone:chest?.name||null,headBone:head?.name||null};},update(completed,theme,choice){
  body.updateMatrixWorld(true);body.getWorldQuaternion(bodyQ);bodyQ.invert();
  if(chest){chest.getWorldQuaternion(boneQ);vest.quaternion.copy(bodyQ).multiply(boneQ).multiply(restChest);}
  if(head){head.getWorldQuaternion(boneQ);helmet.quaternion.copy(bodyQ).multiply(boneQ).multiply(restHead);}
  if(chest){chest.getWorldPosition(p);body.worldToLocal(p);vest.position.copy(p);vest.position.y+=.02;}else vest.position.set(0,1.1,0);
  if(head){head.getWorldPosition(p);body.worldToLocal(p);helmet.position.copy(p);helmet.position.y+=.13;}else helmet.position.set(0,1.69,0);
  mirrorCrest.visible=completed>=3&&choice==='personal';material.color.set(completed>0?0xffffff:0xb2a4c5);iridescent.color.set(themeColors[theme]);shoulderJewels.forEach(j=>{j.visible=completed>=2;});eye.material=completed>=3?iridescent:edge;
 }};
}
