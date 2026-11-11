import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { FBXLoader } from '/static/vendor/three/0.160.0/examples/jsm/loaders/FBXLoader.js';
import { KosherSim, RAILS, LINE, TRICKS, terrain, COLLIDERS, defaultProfile, parseProfile, clamp } from './simulation.mjs';

import { PlazaChapter, parseChapter, defaultChapter, RESIDENTS, BEACONS, CONTRACTS } from './chapter.mjs';
import { buildCity, dressRider } from './city.js';

const $=id=>document.getElementById(id), canvas=$('plaza');
const ASSETS='/arcade/custom/crib-recovered-assets/';
const SAVE='nsp.kosher-lines.v1';
let profile,saveAvailable=true;
try{profile=parseProfile(localStorage.getItem(SAVE));}catch{profile=defaultProfile();saveAvailable=false;}
const sim=new KosherSim(profile);
let chapterSaved;try{chapterSaved=parseChapter(localStorage.getItem(SAVE+'.chapter'));}catch{chapterSaved=defaultChapter();}
const chapter=new PlazaChapter(chapterSaved);let city=null,riderDress=null,chapterUIKey='',dialogueResident=null,conversationPaused=false,lastChapterRevision=-1;
const held=new Set(), touchHeld=new Set();
let presses=[], releases=[], lastEvent=0, accumulator=0, lastTime=0, orbit=0, cameraTilt=.38, dragging=false, lastPointer=null;
let reflectionTarget=null;
let renderer, scene, camera, disposed=false, firstFrame=false, modelLoaded=false, modelError=null;
let pausedByVisibility=false, frameCount=0, elapsedFrames=0, measuredFps=0, quality='high';
const assetState={}, loadErrors=[], shaders={lost:false}, keysOwned=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyU','KeyM','ShiftLeft','ShiftRight','KeyR','KeyP','KeyE','Escape'];
const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const surfaces=[], lamps=[], portalRings=[], routeLights=[], sparkParticles=[];
const skinColors=[0x39efb3,0xd674ff,0xffb34b];
const courierWheelJewels=[];
let skater,bodyRig,boardRig,avatarMixer=null,avatarActions={},avatarCurrent=null;
const avatarMetrics={bones:0,skinnedMeshes:0,vertices:0,triangles:0,animations:[],skinLoaded:false,modelLoaded:false};
const tempV=new THREE.Vector3(), cameraDesired=new THREE.Vector3(), lookDesired=new THREE.Vector3(), lookSmoothed=new THREE.Vector3(0,1,0);
function save(){try{localStorage.setItem(SAVE,JSON.stringify(profile));localStorage.setItem(SAVE+'.chapter',chapter.serialize());saveAvailable=true;}catch{saveAvailable=false;}$('save-state').textContent=saveAvailable?'Progress saved on this device':'Storage unavailable · progress lasts this visit';}
function message(text){$('ride-event').textContent=text;}
function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.08,...extra});}
function mesh(geometry,material,x=0,y=0,z=0,parent=scene){const item=new THREE.Mesh(geometry,material);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;}
function box(w,h,d,x,y,z,material,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent);}
function rod(a,b,radius,material,parent=scene){
 const delta=new THREE.Vector3().subVectors(b,a),item=mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),material,0,0,0,parent);
 item.position.copy(a).add(b).multiplyScalar(.5);item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return item;
}
function texture(name,repeatX=1,repeatY=1){
 const t=new THREE.TextureLoader().load(ASSETS+name,t=>{assetState[name]='loaded';t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());},undefined,()=>{assetState[name]='failed';loadErrors.push(name);message('A plaza asset did not load. The ride continues; reload after the connection recovers.');});
 assetState[name]='loading';t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);return t;
}
function surface(minX,maxX,minZ,maxZ,material,segments=20){
 const geometry=new THREE.BufferGeometry(),positions=[],uvs=[],indices=[],nx=segments,nz=segments;
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=minX+(maxX-minX)*i/nx,z=minZ+(maxZ-minZ)*j/nz;
  positions.push(x,terrain(x,z)+.008,z);uvs.push(i/nx,j/nz);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const item=mesh(geometry,material);surfaces.push(item);return item;
}
function makeReflections(){
 // One 64px cubemap capture of authored light panels; no background image or per-frame capture.
 const set=new THREE.Scene();set.background=new THREE.Color(0x28364b);
 const shell=new THREE.Mesh(new THREE.SphereGeometry(22,12,8),new THREE.MeshBasicMaterial({color:0x162439,side:THREE.BackSide}));set.add(shell);
 const panels=[[0xffcd8a,-6,8,4,5,8],[0x42dbc9,8,4,0,7,9],[0xb968d9,-8,3,-4,4,7],[0xc7dafa,0,10,0,9,4]];
 panels.forEach(([color,x,y,z,w,h])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);set.add(p);});
 const cube=new THREE.WebGLCubeRenderTarget(64,{generateMipmaps:false,minFilter:THREE.LinearFilter});const probe=new THREE.CubeCamera(.1,40,cube);probe.update(renderer,set);
 const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromCubemap(cube.texture);scene.environment=target.texture;
 if(reflectionTarget)reflectionTarget.dispose();reflectionTarget=target;pmrem.dispose();cube.dispose();set.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
}
function makeWorld(){
 const asphalt=mat(0xb0b5be,{map:texture('asphalt.jpg',10,12),roughness:.86});
 const concrete=mat(0xa4c5c4,{map:texture('concrete.jpg',2,2),roughness:.68});
 const pale=mat(0x63738b,{roughness:.8}),black=mat(0x11152c),gold=mat(0xe2b75f,{metalness:.8,roughness:.28});
 const brick=mat(0xccc8c8,{map:texture('facade.jpg',2,2),roughness:.85});
 const ground=mesh(new THREE.PlaneGeometry(56,76),asphalt,0,-.035,-10);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 // The retained five-feature course is a physical height field inside a wider free-skate plaza.
 surface(-1.7,1.7,-10.4,-5.2,concrete,36);
 surface(.35,3.25,-17.2,-11,concrete,24);
 surface(-3.35,-1.45,-16.7,-11,concrete,24);
 surface(-3.3,3.3,-27.6,-21.4,concrete,44);
 surface(-3.2,-2,-4.6,2.6,concrete,12);
 const sideGeometry=new THREE.BufferGeometry(),sidePositions=[];
 for(const x of [-3.3,3.3])for(let i=0;i<36;i++){
  const z0=-27.6+i*6.2/36,z1=-27.6+(i+1)*6.2/36,h0=terrain(x,z0),h1=terrain(x,z1);
  sidePositions.push(x,0,z0,x,h0,z0,x,h1,z1,x,0,z0,x,h1,z1,x,0,z1);
 }
 sideGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));sideGeometry.computeVertexNormals();
 const sideMat=concrete.clone();sideMat.side=THREE.DoubleSide;mesh(sideGeometry,sideMat);
 box(6.6,3.15,.18,0,1.575,-27.66,concrete);
 // Ramps have solid skirts and metal coping, not floating display planes.
 box(3.4,.72,3.6,0,.36,-7.8,black);
 box(.12,.18,6.2,.35,.12,-14.1,gold);box(.12,.18,6.2,3.25,.12,-14.1,gold);
 for(let i=0;i<9;i++){const z=-11.2-i*.66,y=terrain(1.65,z);box(2.7,.12,.16,1.75,y+.012,z,gold);}
 for(const r of RAILS){
  const a=new THREE.Vector3(r.x0,r.y0,r.z0),b=new THREE.Vector3(r.x1,r.y1,r.z1);
  rod(a,b,.055,gold);
  for(let i=0;i<=3;i++){const u=i/3,x=r.x0+(r.x1-r.x0)*u,z=r.z0+(r.z1-r.z0)*u,y=r.y0+(r.y1-r.y0)*u;rod(new THREE.Vector3(x,.02,z),new THREE.Vector3(x,y,z),.035,black);}
 }
 // Five real route lamps encode the ordered line. No lettering is painted over the view.
 const stations=[[-.7,1],[-2.55,-2],[0,-8],[2.15,-14],[0,-26]];
 stations.forEach(([x,z],i)=>{
  const ring=mesh(new THREE.TorusGeometry(.4,.027,8,32),mat(0x442860,{emissive:0x442860,emissiveIntensity:.7}),x,terrain(x,z)+.027,z);
  ring.rotation.x=-Math.PI/2;ring.castShadow=false;routeLights.push(ring);
  const stud=mesh(new THREE.OctahedronGeometry(.11),gold,x-.7,.18+terrain(x-.7,z),z);stud.rotation.y=i*.7;
 });
 // Seating and planters are actual collision objects.
 for(const b of COLLIDERS.filter(b=>!b.kind)){
  box(b.w,b.h*.25,b.d,b.x,b.h*.72,b.z,concrete);
  if(b.h<1){for(const sign of [-1,1])box(.13,b.h*.65,b.d*.75,b.x+sign*b.w*.34,b.h*.3,b.z,black);}
  else{box(b.w,.7,b.d,b.x,.35,b.z,pale);for(let i=0;i<8;i++){const a=i*2.4;rod(new THREE.Vector3(b.x,.8,b.z),new THREE.Vector3(b.x+Math.sin(a)*.9,2.3+Math.cos(a)*.5,b.z+Math.cos(a)*.9),.06,mat(0x287664));}}
 }
 // Authored facade texture is applied to genuine surrounding architecture.
 const blocks=[[-26,-9,6,10,66],[26,-9,6,13,66],[-12,-38,22,11,6],[12,-38,20,15,6]];
 blocks.forEach(([x,z,w,h,d],i)=>{
  box(w,h,d,x,h/2,z,brick);
  box(w+.35,.24,d+.35,x,h+.12,z,gold);
  for(let n=0;n<4;n++){const yy=2+n*2.7;box(w+.1,.06,d+.1,x,yy,z,black);}
 });
 for(let side of [-1,1])for(let i=0;i<7;i++){
  const x=side*23.4,z=12-i*7.2;
  rod(new THREE.Vector3(x,0,z),new THREE.Vector3(x,5.5,z),.055,black);
  const hue=i%3===0?0xd552ff:i%3===1?0x38f5d0:0xffba53;
  const fixture=mat(hue,{emissive:hue,emissiveIntensity:2.2});
  rod(new THREE.Vector3(x,5.5,z),new THREE.Vector3(x-side*.7,5.5,z),.075,fixture);
  if(i%2===0){const light=new THREE.PointLight(hue,22,13,2);light.position.set(x-side*.7,4.7,z);scene.add(light);lamps.push(light);}
 }
 // Perimeter curb leaves the skating ground readable and continuous.
 box(48,.3,.25,0,.15,15.4,gold);box(48,.3,.25,0,.15,-34.4,gold);
 box(.25,.3,50,-23.5,.15,-9.5,gold);box(.25,.3,50,23.5,.15,-9.5,gold);
 // An eye made of bent luminous tubes sits over the quarter. It opens only for a clean complete line.
 const portal=new THREE.Group();portal.position.set(0,6,-34.2);scene.add(portal);
 for(let i=0;i<3;i++){
  const ring=mesh(new THREE.TorusGeometry(2.2+i*.19,.055,10,84),mat(i===1?0x63f8df:0xf1ba55,{emissive:i===1?0x36bda5:0x925a22,emissiveIntensity:1.2,metalness:.5,roughness:.3}),0,0,0,portal);
  ring.scale.y=.52;portalRings.push(ring);
 }
 const pupil=mesh(new THREE.TorusGeometry(.65,.07,10,64),mat(0xb77cff,{emissive:0x9b2ddd,emissiveIntensity:1.2}),0,0,.08,portal);portalRings.push(pupil);
 for(let x of [-3.1,3.1]){rod(new THREE.Vector3(x,0,-34.2),new THREE.Vector3(x,6,-34.2),.08,gold);box(.5,.25,.6,x,.1,-34.2,black);}
 const eyeLight=new THREE.PointLight(0xa75cff,25,18,2);eyeLight.position.set(0,5,-31.5);scene.add(eyeLight);
 // Sparse stars, distant tower silhouettes and real neon reflections support depth.
 const points=[];for(let i=0;i<130;i++){const a=i*2.399963,r=40+(i%9)*3;points.push(Math.sin(a)*r,15+(i*7%31),Math.cos(a)*r-10);}
 const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xaec5ff,size:.075,transparent:true,opacity:.75})));
}
function makeSkater(){
 const root=new THREE.Group(),body=new THREE.Group(),board=new THREE.Group();root.add(board,body);scene.add(root);
 const wood=mat(0x926b39,{roughness:.55}),metal=mat(0xd5d4da,{metalness:.85,roughness:.2}),wheel=mat(0xeee3cf,{roughness:.5});
 const shape=new THREE.Shape();shape.moveTo(-.2,-.45);shape.quadraticCurveTo(-.21,-.67,0,-.67);shape.quadraticCurveTo(.21,-.67,.2,-.45);shape.lineTo(.2,.45);shape.quadraticCurveTo(.21,.67,0,.67);shape.quadraticCurveTo(-.21,.67,-.2,.45);shape.closePath();
 const deckGeo=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.014,bevelThickness:.009,curveSegments:12});deckGeo.rotateX(-Math.PI/2);
 mesh(deckGeo,wood,0,.16,0,board);
 const art=texture('deck.jpg');art.repeat.set(.76,.93);art.offset.set(.12,.035);art.wrapS=art.wrapT=THREE.ClampToEdgeWrapping;
 const topGeo=new THREE.ShapeGeometry(shape,18),uv=topGeo.attributes.uv,pos=topGeo.attributes.position;
 for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+.21)/.42,(pos.getY(i)+.67)/1.34);
 topGeo.rotateX(-Math.PI/2);mesh(topGeo,mat(0xffffff,{map:art,roughness:.47}),0,.174,0,board);
 for(const z of [-.38,.38]){
  box(.48,.055,.09,0,.095,z,metal,board);
  for(const x of [-.235,.235]){const w=mesh(new THREE.CylinderGeometry(.065,.065,.055,14),wheel,x,.07,z,board);w.rotation.z=Math.PI/2;}
 }
 for(const z of [-.38,.38])for(const x of [-.27,.27]){const jewel=mesh(new THREE.OctahedronGeometry(.045),mat(0x65f5d3,{emissive:0x187a61,emissiveIntensity:1,metalness:.7}),x,.07,z,board);courierWheelJewels.push(jewel);}
 const fallback=new THREE.Group();body.add(fallback);
 const coat=mat(0x5b2f9e,{roughness:.6}),pants=mat(0x172238),skin=mat(0xb9835e),gold=mat(0xe1b66b,{metalness:.55});
 function limb(x,y,z,sx,sy,sz,material){const o=mesh(new THREE.SphereGeometry(1,12,8),material,x,y,z,fallback);o.scale.set(sx,sy,sz);return o;}
 limb(0,1.1,0,.26,.37,.17,coat);limb(0,1.57,0,.145,.17,.14,skin);
 const cap=limb(0,1.69,-.015,.17,.075,.17,gold);
 limb(-.12,.63,-.19,.115,.34,.12,pants);limb(.12,.63,.19,.115,.34,.12,pants);
 limb(-.12,.27,-.24,.12,.065,.2,pants);limb(.12,.27,.24,.12,.065,.2,pants);
 const armA=limb(-.33,1.04,-.04,.09,.31,.09,coat),armB=limb(.33,1.04,.04,.09,.31,.09,coat);
 armA.rotation.z=-.65;armB.rotation.z=.65;
 const modelContainer=new THREE.Group();modelContainer.position.y=.19;body.add(modelContainer);
 // Creator-sourced CC0 Kenney rig, original skin, and matching real animation clips.
 const base=ASSETS+'kenney-protagonists/';
 const loader=new FBXLoader();
 const loadFBX=(url,key)=>new Promise((resolve,reject)=>{assetState[key]='loading';loader.load(url,obj=>{assetState[key]='loaded';resolve(obj);},undefined,error=>{assetState[key]='failed';reject(error);});});
 const skinPromise=new Promise((resolve,reject)=>{assetState['avatar-skin']='loading';new THREE.TextureLoader().load(base+'Skins/skaterMaleA.png',skin=>{skin.colorSpace=THREE.SRGBColorSpace;avatarMetrics.skinLoaded=true;assetState['avatar-skin']='loaded';resolve(skin);},undefined,error=>{assetState['avatar-skin']='failed';reject(error);});});
 Promise.all([loadFBX(base+'Model/characterMedium.fbx','avatar-model'),skinPromise,...['idle','jump','run'].map(kind=>loadFBX(base+'Animations/'+kind+'.fbx','avatar-'+kind))]).then(([model,skin,...animated])=>{
  model.traverse(o=>{if(o.isBone)avatarMetrics.bones++;if(o.isSkinnedMesh){avatarMetrics.skinnedMeshes++;avatarMetrics.vertices+=o.geometry.attributes.position.count;avatarMetrics.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material=new THREE.MeshStandardMaterial({map:skin,roughness:.72,metalness:0});}});
  if(avatarMetrics.skinnedMeshes<1||avatarMetrics.bones<20)throw Error('Creator rig missing bones or skinned mesh');
  model.updateMatrixWorld(true);let bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  if(size.z>size.y*1.35&&size.z>size.x*1.35)model.rotation.x=-Math.PI/2;
  model.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(model);size=bounds.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(1.55/Math.max(.01,size.y));model.rotation.y=Math.PI/2;model.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(model);
  const center=bounds.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.z-=center.z;model.position.y-=bounds.min.y;
  modelContainer.add(model);avatarMixer=new THREE.AnimationMixer(model);
  ['idle','jump','run'].forEach((kind,index)=>{const clips=animated[index].animations;const clip=clips.find(c=>c.name.toLowerCase().endsWith('|'+kind))||clips.find(c=>c.name.toLowerCase().includes(kind)&&!c.name.toLowerCase().includes('targeting'));
   if(!clip)throw Error('Creator '+kind+' animation missing');avatarActions[kind]=avatarMixer.clipAction(clip);avatarMetrics.animations.push(clip.name);});
  city.installResidents(model,skin,avatarActions.idle.getClip());
  riderDress=dressRider(body,model,skinColors);avatarMetrics.accessories=riderDress.count;avatarMetrics.accessoriesFollowBones=riderDress.boneBound;
  fallback.visible=false;modelLoaded=true;avatarMetrics.modelLoaded=true;playAvatar('idle');
 }).catch(error=>{modelError=String(error?.message||error);loadErrors.push('creator-rig: '+modelError);message('The creator rider rig could not load. This build is not visually ready; reload when the asset connection is restored.');});
 return {root,body,board,modelContainer,cap,fallback,deckMaterial:wood};
}
function playAvatar(wanted){
 if(!avatarMixer)return;
 const name=Object.keys(avatarActions).find(n=>n.includes(wanted))||Object.keys(avatarActions).find(n=>n.includes('idle'))||Object.keys(avatarActions)[0];
 if(name===avatarCurrent)return;
 if(avatarCurrent)avatarActions[avatarCurrent].fadeOut(.12);
 avatarActions[name].reset().fadeIn(.12).play();avatarCurrent=name;
}
function burst(x,y,z,color,count=14){
 if(motion)return;
 for(let i=0;i<count;i++){
  const particle=mesh(new THREE.OctahedronGeometry(.025),new THREE.MeshBasicMaterial({color}),x,y,z);
  particle.castShadow=particle.receiveShadow=false;
  sparkParticles.push({mesh:particle,vx:(Math.random()-.5)*3,vy:Math.random()*3+.7,vz:(Math.random()-.5)*3,life:.45+Math.random()*.3});
 }
}
function input(){
 let steer=(held.has('KeyA')||held.has('ArrowLeft')||touchHeld.has('left')?1:0)-(held.has('KeyD')||held.has('ArrowRight')||touchHeld.has('right')?1:0);
 let push=held.has('KeyW')||held.has('ArrowUp')||touchHeld.has('push'),brake=held.has('KeyS')||held.has('ArrowDown')||touchHeld.has('brake');
 let ollieHeld=held.has('Space')||touchHeld.has('ollie'),manual=held.has('KeyM')||touchHeld.has('manual');
 let olliePressed=presses.includes('Space'),ollieReleased=releases.includes('Space');
 let trick=presses.find(k=>TRICKS[k])||null,gamepadName=null;
 const pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected);
 if(pad){
  gamepadName=pad.id;if(pad.buttons[8]?.pressed&&!input.padTalk)openConversation();input.padTalk=pad.buttons[8]?.pressed;const axis=pad.axes[0]||0;if(Math.abs(axis)>.14)steer=-axis;
  push=push||pad.buttons[7]?.value>.15||pad.axes[1]<-.2;brake=brake||pad.buttons[6]?.value>.2||pad.axes[1]>.4;
  const a=pad.buttons[0]?.pressed;if(a&&!input.padA){olliePressed=true;presses.push('Space');}if(!a&&input.padA){ollieReleased=true;releases.push('Space');}input.padA=a;ollieHeld=ollieHeld||a;
  manual=manual||pad.buttons[5]?.pressed;
  const mapping={1:'KeyF',2:'KeyH',3:'KeyK',4:'KeyU'};
  for(const [button,code]of Object.entries(mapping)){const down=pad.buttons[button]?.pressed;if(down&&!input['p'+button]){trick=code;presses.push(code);}input['p'+button]=down;}
 }
 return {steer,push,brake,ollieHeld,olliePressed,ollieReleased,manual,trick,grind:true,gamepadName};
}
function updateUI(){
 $('score').textContent=String(Math.floor(sim.score)).padStart(4,'0');$('pending').textContent=sim.unbanked>0?String(Math.floor(sim.unbanked)):'';
 $('multiplier').textContent=sim.unbanked>0?'×'+sim.multiplier:'';$('timer').textContent=sim.sessionMode==='chapter'?'∞':String(Math.ceil(sim.timeLeft));
 $('line-number').textContent=sim.line+'/'+LINE.length;
 $('next-feature').textContent=sim.ended?'Session complete':sim.paused?'Ride paused':sim.running?'Next · '+LINE[sim.line]:'Five features. One clean line.';
 $('line-order').querySelectorAll('li').forEach((li,i)=>{li.classList.toggle('done',i<sim.line);li.classList.toggle('current',i===sim.line);});
 $('speed-value').textContent=(sim.speed*3.6).toFixed(1);$('best-score').textContent=profile.best.toLocaleString();$('clean-lines').textContent=String(profile.lines);$('progress').textContent=profile.xp.toLocaleString();
 $('pause').disabled=!sim.running||Boolean(dialogueResident);$('start').disabled=Boolean(dialogueResident);$('ride-mode').disabled=Boolean(dialogueResident);$('pause').textContent=sim.paused?'Resume':'Pause';
 $('start').textContent=sim.running?'Restart session':sim.ended?'Ride again':'Drop in';
 $('portal-link').hidden=profile.lines<1&&chapter.state.completed<3;$('balance-meter').value=sim.balance;$('balance-zone').hidden=!['grind','manual'].includes(sim.mode);
 for(const button of document.querySelectorAll('[data-theme]')){const index=Number(button.dataset.theme),unlocked=index===0||profile.xp>=(index===1?500:1500);button.disabled=!unlocked;button.setAttribute('aria-pressed',String(profile.theme===index));}
}
function processEvents(){
 for(const e of sim.events.filter(e=>e.serial>lastEvent)){
  lastEvent=e.serial;chapter.consume(e);
  if(e.type==='score')message(e.label+' · '+e.points+' added to the line');
  if(e.type==='bank'){message(e.value+' banked. Keep the line alive.');save();}
  if(e.type==='bail'){message(e.reason+' · '+e.lost+' unbanked points lost. R to drop back in.');burst(sim.x,sim.y+.3,sim.z,0xff774f,20);}
  if(e.type==='land')burst(sim.x,sim.y+.15,sim.z,0xe8be70,8);
  if(e.type==='ollie')burst(sim.x,sim.y+.08,sim.z,0x74fff1,6);
  if(e.type==='line-step')message('Clean '+e.name+'. Next · '+LINE[sim.line]);
  if(e.type==='line-clear'){message('Line clear. The eye remembers. A new door is open below.');save();burst(sim.x,sim.y+1,sim.z,0xcb6aff,34);}
  if(e.type==='session-end'){message('Session banked · '+sim.score+' points, '+sim.completedLines+' clean lines. Ride again to build your best.');save();}
 }
}
function renderChapter(){
 const state=chapter.snapshot(),key=state.revision+'|'+state.nearby;if(chapterUIKey===key)return;chapterUIKey=key;
 const near=RESIDENTS.find(r=>r.id===state.nearby);$('talk').disabled=!near;$('talk').setAttribute('aria-label',near?'Talk to '+near.name:'Stop beside a resident to talk');
 $('nearby-resident').textContent=near?near.name+' is within reach. Stop here to talk.':(state.completed===0?'Find the plaza keeper at the amber canopy, southeast of the starting mosaic.':state.completed===1?'Find the night courier at the west kiosk, beyond the ledge.':state.completed===2?'Find the signal archivist east of the far quarter.':'The chapter is saved. The residents remember your choice.');
 $('chapter-title').textContent=state.completed===3?'The light has a direction':CONTRACTS[state.completed].title;
 $('chapter-state').textContent=state.completed===3?(state.choice==='public'?'You gave the light to the public route. The plaza remembers who kept it open.':'You kept the mirror crest. The eye holds your line; the plaza remains open.'):(state.active?(state.ready?'The work is done. Return to '+RESIDENTS[state.completed].name.toLowerCase()+'.':CONTRACTS[state.completed].brief):'A broken circuit. Three residents. Your skating decides what returns.');
 const tasks=state.completed===3?['The chapter ending is saved. Keep riding, chase a five-feature line, or return to the people you helped.']:state.completed===0?['Different clean landed tricks: '+state.progress.tricks.length+' / 2','Clean points banked after accepting: '+Math.floor(state.progress.banked)+' / 300']:state.completed===1?['Aurora rail, clean landed ride: '+state.progress.grind.toFixed(2)+' / 0.60 s','Garden relays reached: '+state.progress.visited.filter(id=>id!=='return').length+' / 2']:['Clean manual in the east garden lane: '+state.progress.manual.toFixed(2)+' / 1.20 s','Memory stones visited: '+state.progress.visited.length+' / 3'];
 const list=$('contract-progress');list.replaceChildren(...tasks.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 $('chapter-unlocks').textContent=state.completed===0?'The canopy is running on its last cell.':state.completed===1?'Woven vest restored · canopy lit · courier available':state.completed===2?'Courier jewels fitted · garden relays restored · archivist available':'Woven vest · courier jewels · '+(state.choice==='public'?'public constellation':'mirror crest')+' saved';
 for(const [i,item] of [...$('chapter-route').children].entries()){item.classList.toggle('complete',i<state.completed);item.classList.toggle('current',i===state.completed);}
 if(lastChapterRevision!==state.revision){lastChapterRevision=state.revision;save();}
}
function openConversation(){
 if(dialogueResident)return;const id=chapter.nearby;if(!id){message('Stop near a resident to talk. The keeper waits beside the amber canopy.');return;}
 const dialogue=chapter.interact(id);if(!dialogue)return;dialogueResident=id;conversationPaused=sim.running&&!sim.paused;if(conversationPaused)sim.togglePause();
 held.clear();touchHeld.clear();presses=[];releases=[];$('chapter-dialog').hidden=false;$('speaker').textContent=dialogue.name;$('dialogue-title').textContent=dialogue.title;$('dialogue-text').textContent=dialogue.text;
 $('contract-accept').hidden=dialogue.action!=='accept';$('contract-complete').hidden=dialogue.action!=='complete';$('ending-choices').hidden=dialogue.action!=='choice';
 $('dialogue-close').focus();renderChapter();updateUI();
}
function closeConversation(){
 $('chapter-dialog').hidden=true;dialogueResident=null;if(conversationPaused&&sim.running&&sim.paused)sim.togglePause();conversationPaused=false;held.clear();touchHeld.clear();presses=[];releases=[];updateUI();canvas.focus();
}
function graphicsSnapshot(){const size=renderer?renderer.getDrawingBufferSize(new THREE.Vector2()):new THREE.Vector2();return {preset:quality,pixelRatio:renderer?.getPixelRatio()??null,shadowMapEnabled:renderer?.shadowMap.enabled??null,drawingBuffer:{width:size.x,height:size.y},css:{width:canvas.clientWidth,height:canvas.clientHeight}};}
function resize(){if(!renderer)return;const bounds=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,bounds.width),Math.max(1,bounds.height),false);camera.aspect=bounds.width/Math.max(1,bounds.height);camera.updateProjectionMatrix();}
function frame(time){
 if(disposed)return;requestAnimationFrame(frame);
 const delta=Math.min((time-lastTime)/1000||0,.1);lastTime=time;
 if(!shaders.lost){
  const control=input();accumulator+=delta;let ticks=0;
  while(accumulator>=1/120&&ticks<12){sim.step(1/120,control);chapter.step(1/120,sim);presses=[];releases=[];control.olliePressed=false;control.ollieReleased=false;control.trick=null;accumulator-=1/120;ticks++;}
  if(ticks===12)accumulator=0;
  processEvents();
  const lean=sim.mode==='grind'?sim.balance*.2:clamp(control.steer,-1,1)*Math.min(.22,sim.speed*.018);
  skater.root.position.set(sim.x,sim.y,sim.z);skater.root.rotation.set(0,sim.yaw,lean);
  const crouch=sim.charging?Math.min(.34,sim.charge*.8):sim.mode==='air'?.18:0;
  skater.body.position.y=-crouch;skater.body.scale.y=1-crouch*.45;
  skater.body.rotation.set(0,sim.stance*Math.PI,sim.mode==='bail'?Math.sin(sim.bailTime*8)*.5:0);
  const t=sim.trick?clamp(sim.trickTime/sim.trick.duration,0,1):0;
  skater.board.rotation.set(sim.mode==='manual'?-.15:0,sim.trick?Math.PI*2*sim.trick.spin*t:0,sim.trick?Math.PI*2*sim.trick.flip*t:0);
  if(sim.trick?.id==='180')skater.body.rotation.y+=Math.PI*t;
  skater.root.rotation.z+=sim.mode==='bail'?.65:0;
  playAvatar(sim.mode==='air'?'jump':control.push&&sim.speed>1?'run':'idle');if(avatarMixer)avatarMixer.update(sim.paused?0:delta);if(riderDress)riderDress.update(chapter.state.completed,profile.theme,chapter.state.choice);if(city)city.update(sim.paused?0:delta,time,sim);courierWheelJewels.forEach(j=>{j.visible=chapter.state.completed>=2;});
  if(sim.mode==='grind'&&frameCount%4===0)burst(sim.x,sim.y,sim.z,0xffc46a,2);
  for(let i=sparkParticles.length-1;i>=0;i--){const p=sparkParticles[i];p.life-=delta;p.vy-=8*delta;p.mesh.position.x+=p.vx*delta;p.mesh.position.y+=p.vy*delta;p.mesh.position.z+=p.vz*delta;p.mesh.scale.setScalar(Math.max(.01,p.life));if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();sparkParticles.splice(i,1);}}
  const heading=sim.yaw+orbit,follow=6.2+(motion?0:sim.speed*.07);
  cameraDesired.set(sim.x+Math.sin(heading)*follow,sim.y+2.8+cameraTilt*2,sim.z+Math.cos(heading)*follow);
  cameraDesired.y=Math.max(cameraDesired.y,terrain(cameraDesired.x,cameraDesired.z)+2.5);
  lookDesired.set(sim.x-Math.sin(sim.yaw)*1.5,sim.y+.9,sim.z-Math.cos(sim.yaw)*1.5);
  camera.position.lerp(cameraDesired,1-Math.exp(-delta*5));lookSmoothed.lerp(lookDesired,1-Math.exp(-delta*9));camera.lookAt(lookSmoothed);
  camera.fov=62+(motion?0:Math.min(6,sim.speed*.4));camera.updateProjectionMatrix();
  routeLights.forEach((light,i)=>{light.material.color.set(i<sim.line?0xffc666:i===sim.line?0x63ffe5:0x5d346f);light.material.emissive.copy(light.material.color);});
  portalRings.forEach((ring,i)=>{if(!motion)ring.rotation.z=Math.sin(time*.0002+i)*.08;ring.material.emissiveIntensity=profile.lines>0||chapter.state.completed===3?2.3:1.1;});
  skater.cap.material.color.set(skinColors[profile.theme]);skater.deckMaterial.color.set(skinColors[profile.theme]);
  renderer.render(scene,camera);firstFrame=true;frameCount++;elapsedFrames+=delta;
  if(elapsedFrames>1){measuredFps=frameCount/elapsedFrames;frameCount=0;elapsedFrames=0;}
  if(Math.floor(time/100)%2===0){updateUI();renderChapter();}
 }
}
function loadControlAtlas(){const image=new Image();assetState['ui-atlas']='loading';image.onload=()=>{assetState['ui-atlas']='loaded';};image.onerror=()=>{assetState['ui-atlas']='failed';loadErrors.push('painted-control-atlas');};image.src=ASSETS+'vorath-controls-v1.png';}
function installInput(){
 const clear=()=>{held.clear();touchHeld.clear();presses=[];releases=[];document.querySelectorAll('.touch-controls .pressed').forEach(button=>button.classList.remove('pressed'));};
 window.addEventListener('keydown',e=>{
  if(dialogueResident){if(e.code==='Escape'){e.preventDefault();closeConversation();}return;}
  if(!keysOwned.includes(e.code)||e.target.closest?.('input,select,textarea'))return;
  e.preventDefault();if(!e.repeat){presses.push(e.code);if(e.code==='KeyE'){openConversation();return;}if(e.code==='KeyR'){sim.reset(true);save();}if(e.code==='KeyP'||e.code==='Escape')sim.togglePause();}
  held.add(e.code);
 });
 window.addEventListener('keyup',e=>{if(keysOwned.includes(e.code)){e.preventDefault();held.delete(e.code);releases.push(e.code);}});
 window.addEventListener('blur',()=>{clear();if(sim.running&&!sim.paused)sim.togglePause();updateUI();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();pausedByVisibility=sim.running&&!sim.paused;if(pausedByVisibility)sim.togglePause();}lastTime=performance.now();});
 canvas.addEventListener('pointerdown',e=>{dragging=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(dragging&&lastPointer){orbit-=(e.clientX-lastPointer.x)*.005;cameraTilt=clamp(cameraTilt+(e.clientY-lastPointer.y)*.002,-.1,1);lastPointer={x:e.clientX,y:e.clientY};}});
 canvas.addEventListener('pointerup',()=>{dragging=false;lastPointer=null;});canvas.addEventListener('pointercancel',()=>{dragging=false;lastPointer=null;});
 for(const button of document.querySelectorAll('[data-hold]')){
  const code=button.dataset.hold;
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touchHeld.add(code);if(code==='ollie')presses.push('Space');button.classList.add('pressed');});
  const up=e=>{e.preventDefault();touchHeld.delete(code);if(code==='ollie')releases.push('Space');button.classList.remove('pressed');};
  button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',()=>{if(touchHeld.delete(code)&&code==='ollie')releases.push('Space');button.classList.remove('pressed');});
 }
 for(const button of document.querySelectorAll('[data-trick]'))button.addEventListener('click',()=>presses.push(button.dataset.trick));
 $('start').addEventListener('click',()=>{sim.start();clear();orbit=0;cameraTilt=.38;save();message('Drop in. Build speed, then follow the five lamps.');updateUI();canvas.focus();});
 $('pause').addEventListener('click',()=>{sim.togglePause();clear();updateUI();});
 $('talk').addEventListener('click',openConversation);
 $('dialogue-close').addEventListener('click',closeConversation);
 $('contract-accept').addEventListener('click',()=>{if(chapter.accept(dialogueResident)){message(CONTRACTS[chapter.state.completed].title+' accepted.');save();}closeConversation();renderChapter();});
 $('contract-complete').addEventListener('click',()=>{if(chapter.turnIn(dialogueResident)){message(chapter.notifications.at(-1).text);save();}closeConversation();renderChapter();});
 for(const button of document.querySelectorAll('[data-ending]'))button.addEventListener('click',()=>{if(chapter.turnIn(dialogueResident,button.dataset.ending)){message(chapter.notifications.at(-1).text);save();}closeConversation();renderChapter();});
 $('ride-mode').addEventListener('change',()=>{if(dialogueResident)closeConversation();sim.sessionMode=$('ride-mode').value==='chapter'?'chapter':'arcade';$('mode-description').textContent=sim.sessionMode==='chapter'?'Return the Light · no clock · chapter progress saves on this device.':'Two-minute arcade · chapter progress carries across both modes.';sim.reset(true);clear();save();message(sim.sessionMode==='chapter'?'No clock. Meet the keeper, reconnect the gardens, return the light.':'Two minutes. Five features. One clean line.');updateUI();});
 $('camera-reset').addEventListener('click',()=>{orbit=0;cameraTilt=.38;});
 $('quality').addEventListener('change',()=>{quality=$('quality').value;$('quality-description').textContent=quality==='low'?'Low power':'Shadows + detail';renderer.setPixelRatio(quality==='low'?0.5:Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=quality!=='low';resize();});
 for(const button of document.querySelectorAll('[data-theme]'))button.addEventListener('click',()=>{profile.theme=Number(button.dataset.theme);save();updateUI();});
}
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x10152d);scene.fog=new THREE.FogExp2(0x12152e,.012);
 camera=new THREE.PerspectiveCamera(62,1,.08,180);camera.position.set(4,5,13);
 scene.add(new THREE.HemisphereLight(0x8fbfff,0x26152e,1.8));
 const moon=new THREE.DirectionalLight(0xd5e5ff,2.3);moon.position.set(-12,24,12);moon.castShadow=true;
 moon.shadow.mapSize.set(1024,1024);Object.assign(moon.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:75});moon.shadow.bias=-.0002;scene.add(moon);
 const warm=new THREE.DirectionalLight(0xfcba61,.8);warm.position.set(14,10,-20);scene.add(warm);makeReflections();loadControlAtlas();
 makeWorld();const mosaic=texture('vorath-eye-mosaic-v1.png');city=buildCity(scene,chapter,{mosaic});skater=makeSkater();bodyRig=skater.body;boardRig=skater.board;installInput();resize();new ResizeObserver(resize).observe(canvas);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();shaders.lost=true;if(sim.running&&!sim.paused)sim.togglePause();message('Graphics paused while the context recovers. Saved progress is safe.');});
 canvas.addEventListener('webglcontextrestored',()=>{shaders.lost=false;makeReflections();lastTime=performance.now();accumulator=0;resize();message('Graphics restored. Resume the ride when ready.');});
 window.addEventListener('pagehide',event=>{save();if(!event.persisted){disposed=true;reflectionTarget?.dispose();renderer.dispose();}else if(sim.running&&!sim.paused)sim.togglePause();});
 window.addEventListener('pageshow',event=>{if(event.persisted){lastTime=performance.now();accumulator=0;resize();}});
 requestAnimationFrame(frame);updateUI();renderChapter();save();
}catch(error){loadErrors.push(String(error));$('graphics-error').hidden=false;$('graphics-error').textContent='The 3D plaza could not start on this graphics context. '+String(error.message||error);}
window.__KOSHER_LINES__=Object.freeze({
 snapshot:()=>({...sim.snapshot(),career:chapter.snapshot(),graphics:graphicsSnapshot(),renderer:{firstFrame,modelLoaded,modelError,avatar:{...avatarMetrics,animations:[...avatarMetrics.animations]},assets:{...assetState},texturesLoaded:Object.keys(assetState).filter(name=>/\.(jpg|png|webp)$/.test(name)&&assetState[name]==='loaded').length+Number(avatarMetrics.skinLoaded),errors:[...loadErrors],contextLost:shaders.lost,fps:Math.round(measuredFps),quality,wardrobe:riderDress?.snapshot()||null,wheelJewelsVisible:courierWheelJewels.filter(j=>j.visible).length,reflections:{capturedFaceSize:64,textureWidth:reflectionTarget?.width||0,textureHeight:reflectionTarget?.height||0,environmentAssigned:scene?.environment===reflectionTarget?.texture},city:city?{...city.metrics,...city.snapshot()}:null,drawCalls:renderer?.info.render.calls||0},camera:camera?{x:camera.position.x,y:camera.position.y,z:camera.position.z}:null,storageAvailable:saveAvailable}),
 provenance:'Reconstructed missing simulation and rendering from retained Grok source fragments. Original art retained; no exact full-source restoration claimed.'
});
window.render_game_to_text=()=>JSON.stringify(window.__KOSHER_LINES__.snapshot());
