import { RoundedBoxGeometry } from '/static/vendor/three/0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { GLTFLoader } from '/static/vendor/three/0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { loadAdultRig } from './adult-rig.js';
import { createSkatePushRig } from './skate-push-rig.js';
import { createStreetAtmosphere } from './streetscape.js';
import { KosherSim, RAILS, LINE, TRICKS, terrain, COLLIDERS, defaultProfile, parseProfile, clamp } from './simulation.mjs';

import { PlazaChapter, parseChapter, defaultChapter, RESIDENTS, BEACONS, CONTRACTS } from './chapter.mjs';
import { buildCity, dressRider } from './city.js';
import { cameraOutsideSolids } from './camera-rig.mjs';
import { CourierTrial, parseCourierRecord, defaultCourierRecord, COURIER_ROUTE } from './courier-trial.mjs';
import { buildCourierCourse } from './courier-course.js';
import { createActionMode } from './action-mode.js';
import { PEACOCK_KIOSK, PEACOCK_KIOSK_COLLIDER } from './peacock-signature.mjs';
const actionArt=await fetch('./fan-art.json').then(r=>{if(!r.ok)throw Error('Fan-art manifest HTTP '+r.status);return r.json();});
const readActionSave=key=>{try{return localStorage.getItem(key);}catch{return null;}};
let actionMode=null,selectedRide='arcade',actionSaveClock=0;

const $=id=>document.getElementById(id), canvas=$('plaza');
const ASSETS='/arcade/custom/crib-recovered-assets/';
const SAVE='nsp.kosher-lines.v1';
let profile,saveAvailable=true;
try{profile=parseProfile(localStorage.getItem(SAVE));}catch{profile=defaultProfile();saveAvailable=false;}
const sim=new KosherSim(profile);
let chapterSaved;try{chapterSaved=parseChapter(localStorage.getItem(SAVE+'.chapter'));}catch{chapterSaved=defaultChapter();}
let courierSaved;try{courierSaved=parseCourierRecord(localStorage.getItem(SAVE+'.courier-trial'));}catch{courierSaved=defaultCourierRecord();}
const courierTrial=new CourierTrial(courierSaved);let courierCourse=null,trialUIKey='',lastTrialSavedRevision=-1;
const chapter=new PlazaChapter(chapterSaved);let streetAtmosphere=null,city=null,riderDress=null,chapterUIKey='',dialogueResident=null,conversationPaused=false,lastChapterRevision=-1;
const held=new Set(), touchHeld=new Set(), touchTricks=new Map();
let queuedOllieTrick=null;
let presses=[], releases=[], lastEvent=0, accumulator=0, lastTime=0, orbit=0, cameraTilt=.38, dragging=false, lastPointer=null;
let reflectionTarget=null;
let peacockKiosk=null;
let renderer, scene, camera, disposed=false, firstFrame=false, modelLoaded=false, modelError=null;
let pausedByVisibility=false, frameCount=0, elapsedFrames=0, measuredFps=0, quality='high', lastUIRefresh=-Infinity;
const assetState={}, loadErrors=[], shaders={lost:false}, keysOwned=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyU','KeyC','KeyM','ShiftLeft','ShiftRight','KeyR','KeyP','KeyE','KeyT','KeyB','KeyL','KeyQ','Escape'];
const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const surfaces=[], lamps=[], portalRings=[], routeLights=[], sparkParticles=[];
const skinColors=[0x39efb3,0xd674ff,0xffb34b];
const courierWheelJewels=[],cameraSolids=[];let cameraOcclusion={blocked:false};const cameraAnchor=new THREE.Vector3();
let riderHeadBone=null,riderHeadBindScale=null;
let skater,bodyRig,boardRig,skatePushRig=null,avatarMixer=null,avatarActions={},avatarCurrent=null;
const avatarMetrics={bones:0,skinnedMeshes:0,vertices:0,triangles:0,animations:[],skinLoaded:false,modelLoaded:false};
const tempV=new THREE.Vector3(), cameraDesired=new THREE.Vector3(), lookDesired=new THREE.Vector3(), lookSmoothed=new THREE.Vector3(0,1,0);
function save(){try{localStorage.setItem(SAVE,JSON.stringify(profile));localStorage.setItem(SAVE+'.chapter',chapter.serialize());localStorage.setItem(SAVE+'.courier-trial',courierTrial.serialize());if(actionMode){const a=actionMode.serialize();localStorage.setItem(SAVE+'.combat',a.combat);localStorage.setItem(SAVE+'.clips',a.clips);localStorage.setItem(SAVE+'.deck',a.deck);}saveAvailable=true;}catch{saveAvailable=false;}$('save-state').textContent=saveAvailable?'Progress saved on this device':'Storage unavailable · progress lasts this visit';}
function message(text){$('ride-event').textContent=text;$('journal-event').textContent=text;}
function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.08,...extra});}
function mesh(geometry,material,x=0,y=0,z=0,parent=scene){const item=new THREE.Mesh(geometry,material);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;}
function box(w,h,d,x,y,z,material,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent);}
function rod(a,b,radius,material,parent=scene){
 const delta=new THREE.Vector3().subVectors(b,a),item=mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),material,0,0,0,parent);
 item.position.copy(a).add(b).multiplyScalar(.5);item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return item;
}
function texture(name,repeatX=1,repeatY=1,dataMap=false){
 const t=new THREE.TextureLoader().load(ASSETS+name,t=>{assetState[name]='loaded';t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());},undefined,()=>{assetState[name]='failed';loadErrors.push(name);message('A plaza asset did not load. The ride continues; reload after the connection recovers.');});
 assetState[name]='loading';t.colorSpace=dataMap?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);return t;
}
function surface(minX,maxX,minZ,maxZ,material,segments=20){
 const geometry=new THREE.BufferGeometry(),positions=[],uvs=[],indices=[],nx=segments,nz=segments;
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=minX+(maxX-minX)*i/nx,z=minZ+(maxZ-minZ)*j/nz;
  positions.push(x,terrain(x,z)+.008,z);uvs.push(x/2,z/2);
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
function worldSurfaceUV(geometry){const p=geometry.attributes.position,n=geometry.attributes.normal,u=geometry.attributes.uv;if(!p||!n||!u)throw Error('World material requires position, normal and UV attributes');for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));u.setXY(i,(nx>=ny&&nx>=nz?p.getZ(i):p.getX(i))/2,(ny>=nx&&ny>=nz?p.getZ(i):p.getY(i))/2);}u.needsUpdate=true;return geometry;}
function makeWorld(muralTexture){
 const asphalt=mat(0xc3c7ce,{map:texture('asphalt_01-diffuse-1k.jpg',14,19),normalMap:texture('asphalt_01-nor_gl-1k.jpg',14,19,true),normalScale:new THREE.Vector2(.4,.4),roughnessMap:texture('asphalt_01-rough-1k.jpg',14,19,true),roughness:.89});
 const concrete=mat(0xb8c0c8,{map:texture('concrete_floor_02-diffuse-1k.jpg'),normalMap:texture('concrete_floor_02-nor_gl-1k.jpg',1,1,true),normalScale:new THREE.Vector2(.32,.32),roughnessMap:texture('concrete_floor_02-rough-1k.jpg',1,1,true),roughness:.9});
 const pale=mat(0x63738b,{roughness:.8}),black=mat(0x11152c),gold=mat(0xe2b75f,{metalness:.8,roughness:.28});
 const brick=mat(0x8b919d,{map:texture('brick_wall_02-diffuse-1k.jpg'),normalMap:texture('brick_wall_02-nor_gl-1k.jpg',1,1,true),normalScale:new THREE.Vector2(.65,.65),roughnessMap:texture('brick_wall_02-rough-1k.jpg',1,1,true),roughness:.92});
 const ground=mesh(new THREE.PlaneGeometry(56,76),asphalt,0,-.035,-10);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 // The retained five-feature course is a physical height field inside a wider free-skate plaza.
 surface(-1.7,1.7,-10.4,-5.2,concrete,36);
 surface(.35,3.25,-17.2,-11,concrete,24);
 surface(-3.35,-1.45,-16.7,-11,concrete,24);
 surface(-3.3,3.3,-27.6,-21.4,concrete,44);
 surface(-3.2,-2,-4.6,2.6,concrete,12);
 const sideGeometry=new THREE.BufferGeometry(),sidePositions=[],sideUVs=[];
 for(const x of [-3.3,3.3])for(let i=0;i<36;i++){
  const z0=-27.6+i*6.2/36,z1=-27.6+(i+1)*6.2/36,h0=terrain(x,z0),h1=terrain(x,z1);
  sidePositions.push(x,0,z0,x,h0,z0,x,h1,z1,x,0,z0,x,h1,z1,x,0,z1);sideUVs.push(z0/2,0,z0/2,h0/2,z1/2,h1/2,z0/2,0,z1/2,h1/2,z1/2,0);
 }
 sideGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));sideGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(sideUVs,2));sideGeometry.computeVertexNormals();
 const sideMat=concrete.clone();sideMat.side=THREE.DoubleSide;mesh(sideGeometry,sideMat);
 worldSurfaceUV(box(6.6,3.15,.18,0,1.575,-27.66,concrete).geometry);
 // Ramps have solid skirts and metal coping, not floating display planes.
 mesh(worldSurfaceUV(new RoundedBoxGeometry(3.4,.81,3.6,2,.045)),concrete,0,.405,-7.8);
 mesh(worldSurfaceUV(new RoundedBoxGeometry(1.2,.31,7.2,2,.035)),concrete,-2.6,.155,-1);
 box(.12,.18,6.2,.35,.12,-14.1,gold);box(.12,.18,6.2,3.25,.12,-14.1,gold);
 for(let i=0;i<9;i++){const z=-11.2-i*.66,y=terrain(1.65,z);box(2.7,.12,.16,1.75,y+.012,z,gold);}
 for(const r of RAILS){
  const a=new THREE.Vector3(r.x0,r.y0,r.z0),b=new THREE.Vector3(r.x1,r.y1,r.z1);
  rod(a,b,.055,gold);
  for(let i=0;i<=3;i++){const u=i/3,x=r.x0+(r.x1-r.x0)*u,z=r.z0+(r.z1-r.z0)*u,y=r.y0+(r.y1-r.y0)*u;rod(new THREE.Vector3(x,.02,z),new THREE.Vector3(x,y,z),.035,black);}
 }
 // Cast bronze relief is set into the ledge skirt, below the unchanged ride surface.
 const reliefShape=new THREE.Shape();reliefShape.moveTo(-.19,0);reliefShape.bezierCurveTo(-.17,.075,-.06,.08,0,.035);reliefShape.bezierCurveTo(.06,.08,.17,.075,.19,0);reliefShape.bezierCurveTo(.12,-.065,.045,-.07,0,-.028);reliefShape.bezierCurveTo(-.045,-.07,-.12,-.065,-.19,0);
 const reliefGeo=new THREE.ExtrudeGeometry(reliefShape,{depth:.009,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1,curveSegments:6});
 const relief=new THREE.InstancedMesh(reliefGeo,gold,30),reliefDummy=new THREE.Object3D();let reliefIndex=0;
 for(const side of [-1,1])for(let i=0;i<15;i++){reliefDummy.position.set(side<0?-3.198:-2.002,.155,2.32-i*.46);reliefDummy.rotation.set(0,side<0?-Math.PI/2:Math.PI/2,0);reliefDummy.updateMatrix();relief.setMatrixAt(reliefIndex++,reliefDummy.matrix);}relief.castShadow=false;relief.receiveShadow=true;scene.add(relief);
 for(const x of [-3.18,-2.02])box(.025,.018,7.1,x,.31,-1,gold);
 // Thin wet patches catch the authored light field beside, never above, the course.
 const wet=mat(0x172d38,{metalness:.66,roughness:.18,transparent:true,opacity:.76});
 for(const [x,z,rx,rz]of[[-4.2,3.1,.7,.28],[5.5,-4.3,1.1,.32],[-5.7,-19,.8,.35],[8.4,-22.2,1.2,.3]]){const patch=new THREE.Shape();for(let i=0;i<=16;i++){const a=i/16*Math.PI*2,k=1+.15*Math.sin(i*2.3);const px=Math.cos(a)*rx*k,pz=Math.sin(a)*rz*k;if(i===0)patch.moveTo(px,pz);else patch.lineTo(px,pz);}const puddle=mesh(new THREE.ShapeGeometry(patch),wet,x,.003,z);puddle.rotation.x=-Math.PI/2;puddle.castShadow=false;}
 // Metal quarter coping follows the retained physical crest.
 rod(new THREE.Vector3(-3.3,terrain(-3.3,-27.55)+.025,-27.55),new THREE.Vector3(3.3,terrain(3.3,-27.55)+.025,-27.55),.035,gold);
 // Worn coloured aggregate marks the outer walking/courier lanes without new colliders.
 for(const [x,color]of[[-12,0x398c79],[12,0x6b3c88]]){const lane=asphalt.clone();lane.color.setHex(color);for(const key of ['map','normalMap','roughnessMap']){lane[key]=asphalt[key].clone();lane[key].repeat.set(1,12);lane[key].needsUpdate=true;}const strip=mesh(new THREE.PlaneGeometry(3.6,48),lane,x,-.03,-10);strip.rotation.x=-Math.PI/2;strip.castShadow=false;}

 // Silver coping and black wax sit on real poured-concrete ledge edges.
 const steel=mat(0x879096,{metalness:.88,roughness:.3}),wax=mat(0x1b1d20,{roughness:.44,metalness:.02});
 for(const x of [-3.18,-2.02])rod(new THREE.Vector3(x,.345,2.52),new THREE.Vector3(x,.345,-4.52),.026,steel);
 const waxStrip=mesh(new THREE.PlaneGeometry(.10,5.8),wax,-2.06,.329,-1);waxStrip.rotation.x=-Math.PI/2;waxStrip.castShadow=false;
 const paint=mat(0xa0aaa6,{map:muralTexture,roughness:.94,metalness:0});
 const paintedTag=mesh(new THREE.PlaneGeometry(1.35,.38),paint,0,.38,-5.995);paintedTag.castShadow=false;
 // Actual tyre-scuff ribbons stay flush to the asphalt and outside the course solids.
 const tracks=[],trackIndices=[];let vertex=0;
 for(const[x,z,angle,length,bend]of[[-.5,3.6,.28,3.7,.3],[4.7,-1.5,-.17,5.5,-.4],[-4.8,-10,.1,4.4,.2],[6.4,-21,-.2,5,.35]])for(const offset of[-.12,.12]){
  const width=.034;for(let n=0;n<22;n++){const t=n/21,along=t*length,across=Math.sin(t*Math.PI)*bend+offset,cx=x+Math.sin(angle)*along+Math.cos(angle)*across,cz=z-Math.cos(angle)*along+Math.sin(angle)*across;for(const sign of[-1,1])tracks.push(cx+Math.cos(angle)*width*sign,-.024,cz+Math.sin(angle)*width*sign);if(n){const a=vertex-2;trackIndices.push(a,a+1,a+2,a+1,a+3,a+2);}vertex+=2;}
 }
 const scuffsGeometry=new THREE.BufferGeometry();scuffsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(tracks,3));scuffsGeometry.setIndex(trackIndices);scuffsGeometry.computeVertexNormals();const tyreScuffs=mesh(scuffsGeometry,mat(0x0c1014,{roughness:.88,metalness:0}));tyreScuffs.castShadow=false;
 // Five real route lamps encode the ordered line. No lettering is painted over the view.
 const stations=[[-.7,1],[-2.55,-2],[0,-8],[2.15,-14],[0,-26]];
 stations.forEach(([x,z],i)=>{
  const ring=mesh(new THREE.TorusGeometry(.4,.027,8,32),mat(0x442860,{emissive:0x442860,emissiveIntensity:.7}),x,terrain(x,z)+.027,z);
  ring.rotation.x=-Math.PI/2;ring.castShadow=false;routeLights.push(ring);
  const stud=mesh(new THREE.OctahedronGeometry(.11),gold,x-.7,.18+terrain(x-.7,z),z);stud.rotation.y=i*.7;
 });
 // Seating and planters are actual collision objects.
 for(const b of COLLIDERS.filter(b=>!b.kind)){
  if(b.h>=1)continue; // Exact tall-planter visuals are authored in streetscape.js.
  box(b.w,b.h*.25,b.d,b.x,b.h*.72,b.z,concrete);
  if(b.h<1){for(const sign of [-1,1])box(.13,b.h*.65,b.d*.75,b.x+sign*b.w*.34,b.h*.3,b.z,black);}
  else{box(b.w,.7,b.d,b.x,.35,b.z,pale);for(let i=0;i<8;i++){const a=i*2.4;rod(new THREE.Vector3(b.x,.8,b.z),new THREE.Vector3(b.x+Math.sin(a)*.9,2.3+Math.cos(a)*.5,b.z+Math.cos(a)*.9),.06,mat(0x287664));}}
 }
 // Authored facade texture is applied to genuine surrounding architecture.
 const blocks=[[-26,-9,6,10,66],[26,-9,6,13,66],[-12,-40.4,22,11,6],[12,-40.4,20,15,6]];
 blocks.forEach(([x,z,w,h,d],i)=>{
  const mass=box(w,h,d,x,h/2,z,brick);
  // World-scaled face UVs keep real brick courses consistent on each wall.
  const pos=mass.geometry.attributes.position,norm=mass.geometry.attributes.normal,uv=mass.geometry.attributes.uv;
  for(let v=0;v<pos.count;v++){const nx=Math.abs(norm.getX(v)),ny=Math.abs(norm.getY(v));uv.setXY(v,(nx>.5?pos.getZ(v):pos.getX(v))/2,(ny>.5?pos.getZ(v):pos.getY(v))/2);}uv.needsUpdate=true;
  cameraSolids.push({id:'plaza-building-'+i,minX:x-w/2,maxX:x+w/2,minY:0,maxY:h,minZ:z-d/2,maxZ:z+d/2});
  box(w+.35,.24,d+.35,x,h+.12,z,gold);
  for(let n=0;n<4;n++){const yy=2+n*2.7;box(w+.1,.06,d+.1,x,yy,z,black);}
 });
 // Exterior fixtures, curbs and cables are authored by streetscape.js.
 // An eye made of bent luminous tubes sits over the quarter. It opens only for a clean complete line.
 const portal=new THREE.Group();portal.position.set(0,6,-34.2);scene.add(portal);
 for(let i=0;i<3;i++){
  const ring=mesh(new THREE.TorusGeometry(2.2+i*.19,.055,10,84),mat(i===1?0x63f8df:0xf1ba55,{emissive:i===1?0x36bda5:0x925a22,emissiveIntensity:1.2,metalness:.5,roughness:.3}),0,0,0,portal);
  ring.scale.y=.52;portalRings.push(ring);
 }
 const pupil=mesh(new THREE.TorusGeometry(.65,.07,10,64),mat(0xb77cff,{emissive:0x9b2ddd,emissiveIntensity:1.2}),0,0,.08,portal);portalRings.push(pupil);
 for(let x of [-3.1,3.1]){rod(new THREE.Vector3(x,0,-34.2),new THREE.Vector3(x,6,-34.2),.08,gold);box(.5,.25,.6,x,.1,-34.2,black);}
 const eyeLight=new THREE.PointLight(0xa75cff,25,18,2);eyeLight.position.set(0,5,-31.5);scene.add(eyeLight);
 // An actual playable eye kiosk anchors the lyric-grounded Peacock clip zone.
 peacockKiosk=new THREE.Group();peacockKiosk.name='Peacock-switch-line-kiosk';peacockKiosk.position.set(PEACOCK_KIOSK_COLLIDER.x,0,PEACOCK_KIOSK_COLLIDER.z);scene.add(peacockKiosk);
 const kioskShell=mat(0x151b23,{metalness:.58,roughness:.4}),kioskTrim=mat(0xc7a454,{metalness:.85,roughness:.25});
 mesh(new RoundedBoxGeometry(.8,1.6,.65,3,.035),kioskShell,0,.8,0,peacockKiosk);
 mesh(new THREE.BoxGeometry(.68,.55,.055),kioskTrim,0,1.17,-.35,peacockKiosk);
 const kioskScreen=mesh(new THREE.PlaneGeometry(.57,.43),mat(0xffffff,{map:muralTexture,emissiveMap:muralTexture,emissive:0x75e2c8,emissiveIntensity:.85,roughness:.22}),0,1.17,-.381,peacockKiosk);kioskScreen.rotation.y=Math.PI;
 mesh(new RoundedBoxGeometry(.7,.08,.28,2,.02),kioskTrim,0,.79,-.4,peacockKiosk);
 const stick=mesh(new THREE.CylinderGeometry(.012,.012,.1,8),kioskShell,-.17,.88,-.43,peacockKiosk);mesh(new THREE.SphereGeometry(.035,10,8),mat(0xff36aa,{emissive:0xa31670,emissiveIntensity:.8}),-.17,.94,-.43,peacockKiosk);
 for(const x of [.10,.22])mesh(new THREE.CylinderGeometry(.034,.034,.012,12),mat(x<.2?0x38f5df:0xf1b743,{emissive:x<.2?0x16a89a:0x946617,emissiveIntensity:.7}),x,.84,-.43,peacockKiosk);
 const kioskGlow=new THREE.PointLight(0x42ffd9,18,6,2);kioskGlow.position.set(0,1.2,-.75);peacockKiosk.add(kioskGlow);
 cameraSolids.push({id:'peacock-kiosk',minX:12.6,maxX:13.4,minY:0,maxY:1.6,minZ:9.075,maxZ:9.725});
 // Sparse stars, distant tower silhouettes and real neon reflections support depth.
 const points=[];for(let i=0;i<130;i++){const a=i*2.399963,r=40+(i%9)*3;points.push(Math.sin(a)*r,15+(i*7%31),Math.cos(a)*r-10);}
 const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xaec5ff,size:.075,transparent:true,opacity:.75})));
}
function makeSkater(){
 const root=new THREE.Group(),body=new THREE.Group(),board=new THREE.Group();root.add(board,body);scene.add(root);
 const shadeCanvas=document.createElement('canvas');shadeCanvas.width=shadeCanvas.height=64;const shadeContext=shadeCanvas.getContext('2d'),shadeGradient=shadeContext.createRadialGradient(32,32,3,32,32,31);shadeGradient.addColorStop(0,'rgba(0,0,0,.62)');shadeGradient.addColorStop(1,'rgba(0,0,0,0)');shadeContext.fillStyle=shadeGradient;shadeContext.fillRect(0,0,64,64);const contactShadow=mesh(new THREE.PlaneGeometry(.9,1.3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadeCanvas),transparent:true,depthWrite:false,opacity:.7}),0,.012,5);contactShadow.rotation.x=-Math.PI/2;contactShadow.castShadow=contactShadow.receiveShadow=false;
 const wood=mat(0x926b39,{roughness:.55}),metal=mat(0xd5d4da,{metalness:.85,roughness:.2}),wheel=mat(0xeee3cf,{roughness:.5});
 const shape=new THREE.Shape();shape.moveTo(-.125,-.30);shape.quadraticCurveTo(-.13,-.43,0,-.43);shape.quadraticCurveTo(.13,-.43,.125,-.30);shape.lineTo(.125,.30);shape.quadraticCurveTo(.13,.43,0,.43);shape.quadraticCurveTo(-.13,.43,-.125,.30);shape.closePath();
 const deckGeo=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.004,curveSegments:16});deckGeo.rotateX(-Math.PI/2);
 mesh(deckGeo,wood,0,.098,0,board);
 const art=texture('deck.jpg');art.repeat.set(.76,.93);art.offset.set(.12,.035);art.wrapS=art.wrapT=THREE.ClampToEdgeWrapping;
 const topGeo=new THREE.ShapeGeometry(shape,18),uv=topGeo.attributes.uv,pos=topGeo.attributes.position;
 for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+.13)/.26,(pos.getY(i)+.43)/.86);
 topGeo.rotateX(-Math.PI/2);mesh(topGeo,mat(0xffffff,{map:art,roughness:.76}),0,.107,0,board);
 for(const z of [-.26,.26]){
  box(.215,.025,.055,0,.061,z,metal,board);
  for(const x of [-.125,.125]){const w=mesh(new THREE.CylinderGeometry(.033,.033,.025,18),wheel,x,.033,z,board);w.rotation.z=Math.PI/2;}
  for(const x of [-.05,.05]){const bolt=mesh(new THREE.CylinderGeometry(.004,.004,.003,6),metal,x,.11,z,board);}
 }
 for(const z of [-.26,.26])for(const x of [-.145,.145]){const jewel=mesh(new THREE.OctahedronGeometry(.023),mat(0x65f5d3,{emissive:0x187a61,emissiveIntensity:1,metalness:.7}),x,.033,z,board);courierWheelJewels.push(jewel);}
 const fallback=new THREE.Group();body.add(fallback);
 const coat=mat(0x5b2f9e,{roughness:.6}),pants=mat(0x172238),skin=mat(0xb9835e),gold=mat(0xe1b66b,{metalness:.55});
 function limb(x,y,z,sx,sy,sz,material){const o=mesh(new THREE.SphereGeometry(1,12,8),material,x,y,z,fallback);o.scale.set(sx,sy,sz);return o;}
 limb(0,1.1,0,.26,.37,.17,coat);limb(0,1.57,0,.145,.17,.14,skin);
 const cap=limb(0,1.69,-.015,.17,.075,.17,gold);
 limb(-.12,.63,-.19,.115,.34,.12,pants);limb(.12,.63,.19,.115,.34,.12,pants);
 limb(-.12,.27,-.24,.12,.065,.2,pants);limb(.12,.27,.24,.12,.065,.2,pants);
 const armA=limb(-.33,1.04,-.04,.09,.31,.09,coat),armB=limb(.33,1.04,.04,.09,.31,.09,coat);
 armA.rotation.z=-.65;armB.rotation.z=.65;
 const modelContainer=new THREE.Group();modelContainer.position.y=.114;body.add(modelContainer);
 // Original adult outfit on the licensed Quaternius humanoid rig and real clips.
 assetState['avatar-model']='loading';
 loadAdultRig(THREE,{loader:new GLTFLoader(),url:actionArt.playerModel||ASSETS+'vorath-adult-skater-v5.glb',parent:modelContainer,clothMap:actionArt.playerModel?null:texture('vorath-cable-knit-v5.png')}).then(({root:model,mixer,clips,skin,metrics})=>{
  model.rotation.y=Math.PI/2;model.updateMatrixWorld(true);Object.assign(avatarMetrics,metrics);
  model.traverse(o=>{if(o.isBone&&o.name.toLowerCase()==='head'){riderHeadBone=o;riderHeadBindScale=o.scale.clone();}});
  avatarMixer=mixer;for(const kind of ['idle','jump','run','crouch'])avatarActions[kind]=mixer.clipAction(clips[kind]);
  if(actionArt.playerModel){assetState['resident-template']='loading';loadAdultRig(THREE,{loader:new GLTFLoader(),url:ASSETS+'vorath-adult-skater-v5.glb',parent:new THREE.Group(),clothMap:texture('vorath-cable-knit-v5.png')}).then(npc=>{city.installResidents(npc.root,npc.skin,npc.clips.idle,{preserveMaterials:true});assetState['resident-template']='loaded';}).catch(e=>{assetState['resident-template']='failed';loadErrors.push('resident-template: '+e);});}else city.installResidents(model,skin,clips.idle,{preserveMaterials:true});
  if(!actionArt.playerModel){riderDress=dressRider(body,model,skinColors,{adult:true});avatarMetrics.accessories=riderDress.count;avatarMetrics.accessoriesFollowBones=riderDress.boneBound;riderDress.update(chapter.state.completed,profile.theme,chapter.state.choice);}avatarMetrics.namedRider=Boolean(actionArt.playerModel);actionMode?.attachRider(model,board);
  assetState['avatar-model']='loaded';assetState['avatar-skin']='loaded';
  for(const kind of ['idle','jump','run','crouch'])assetState['avatar-'+kind]='loaded';
  fallback.visible=false;modelLoaded=true;avatarMetrics.modelLoaded=true;playAvatar('idle');skatePushRig=createSkatePushRig(THREE,{model,body});
 }).catch(error=>{assetState['avatar-model']='failed';modelError=String(error?.message||error);loadErrors.push('adult-rig: '+modelError);message('The adult rider model could not load. This version is not visually ready.');});
 return {root,body,board,modelContainer,cap,fallback,contactShadow,deckMaterial:wood};
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
 let trick=presses.find(k=>TRICKS[k])||(ollieReleased?queuedOllieTrick:null),gamepadName=null;
 const pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected);
 if(pad){
  gamepadName=pad.id;if(pad.buttons[9]?.pressed&&!input.padTrial)useCourierTrial();input.padTrial=pad.buttons[9]?.pressed;if(pad.buttons[8]?.pressed&&!input.padTalk)openConversation();input.padTalk=pad.buttons[8]?.pressed;const axis=pad.axes[0]||0;if(Math.abs(axis)>.14)steer=-axis;
  push=push||pad.buttons[7]?.value>.15||pad.axes[1]<-.2;brake=brake||pad.buttons[6]?.value>.2||pad.axes[1]>.4;
  const a=pad.buttons[0]?.pressed;if(a&&!input.padA){olliePressed=true;presses.push('Space');}if(!a&&input.padA){ollieReleased=true;releases.push('Space');}input.padA=a;ollieHeld=ollieHeld||a;
  manual=manual||pad.buttons[5]?.pressed;
  const mapping={1:'KeyF',2:'KeyH',3:'KeyK',4:'KeyU'};
  for(const [button,code]of Object.entries(mapping)){const down=pad.buttons[button]?.pressed;if(down&&!input['p'+button]){trick=code;presses.push(code);}input['p'+button]=down;}
 }
 if(pad){const p=Boolean(pad.buttons[13]?.pressed);if(p&&!input.padPeacock)trick='KeyC';input.padPeacock=p;}
 return {steer,push,brake,ollieHeld,olliePressed,ollieReleased,manual,trick,grind:true,gamepadName,fire:held.has('KeyB')||touchHeld.has('fire')||Boolean(pad?.buttons[10]?.pressed),reload:presses.includes('KeyL')||Boolean(pad?.buttons[12]?.pressed)};
}
function updateUI(){
 $('score').textContent=String(Math.floor(sim.score)).padStart(4,'0');$('pending').textContent=sim.unbanked>0?String(Math.floor(sim.unbanked)):'';
 $('multiplier').textContent=sim.unbanked>0?'×'+sim.multiplier:'';$('timer').textContent=selectedRide==='rival'?String(Math.ceil(actionMode?.rival.snapshot().remaining||0)):courierTrial.active?String(Math.ceil(courierTrial.state==='countdown'?courierTrial.countdown:COURIER_ROUTE.limit-courierTrial.elapsed)):sim.sessionMode==='chapter'?'∞':String(Math.ceil(sim.timeLeft));
 $('line-number').textContent=courierTrial.active?courierTrial.next+'/'+COURIER_ROUTE.gates.length:sim.line+'/'+LINE.length;
 $('next-feature-label').textContent=courierTrial.active?(courierTrial.state==='countdown'?'Dispatch · hold the seal':'Courier · '+COURIER_ROUTE.gates[courierTrial.next].name):sim.ended?'Session complete':sim.paused?'Ride paused':sim.running?'Next · '+LINE[sim.line]:'Five features. One clean line.';
 const featureArt=$('next-feature-art'),featureBoxes=['45 65 940 300','100 375 850 315','60 690 940 310','70 995 850 290','20 1280 984 256'];const hideFeature=courierTrial.active||sim.ended||sim.paused;featureArt.toggleAttribute('hidden',hideFeature);featureArt.setAttribute('viewBox',featureBoxes[sim.running?sim.line:0]);$('next-feature-label').classList.toggle('sr-only',!hideFeature);
 $('line-order').querySelectorAll('li').forEach((li,i)=>{li.classList.toggle('done',i<sim.line);li.classList.toggle('current',i===sim.line);});
 $('speed-value').textContent=(sim.speed*3.6).toFixed(1);$('best-score').textContent=profile.best.toLocaleString();$('clean-lines').textContent=String(profile.lines);$('progress').textContent=profile.xp.toLocaleString();
 $('pause').disabled=!sim.running||Boolean(dialogueResident);$('start').disabled=Boolean(dialogueResident);$('ride-mode').disabled=Boolean(dialogueResident);$('pause').textContent=sim.paused?'Resume':'Pause';$('pause').dataset.art=sim.paused?'11':'10';$('pause').dataset.skateArt=sim.paused?'14':'13';$('pause').title=sim.paused?'Resume':'Pause';
 $('start').textContent=sim.running?'Restart session':sim.ended?'Ride again':'Drop in';
 $('portal-link').hidden=profile.lines<1&&chapter.state.completed<3;$('balance-meter').value=sim.balance;$('balance-zone').hidden=!['grind','manual'].includes(sim.mode);
 for(const button of document.querySelectorAll('[data-theme]')){const index=Number(button.dataset.theme),unlocked=index===0||profile.xp>=(index===1?500:1500);button.disabled=!unlocked;button.setAttribute('aria-pressed',String(profile.theme===index));}
}
function processEvents(){
 for(const e of sim.events.filter(e=>e.serial>lastEvent)){
  lastEvent=e.serial;chapter.consume(e);courierTrial.consume(e);
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
// Stance controls reflect the just-stepped simulation, including on slow frames.
function renderPeacockStance(){
 const ready=sim.stance===1,button=$('peacock-special'),label=$('peacock-stance'),text=ready?'Switch · Peacock ready':'Regular · land a 180';
 if(button.disabled!==!ready)button.disabled=!ready;if(label.textContent!==text)label.textContent=text;
}
function renderAction(){
 if(!actionMode||selectedRide!=='rival')return;const s=actionMode.snapshot(),c=s.combat,r=s.rival;
 renderPeacockStance();
 $('action-health').textContent=Math.ceil(c.health);$('action-ammo').textContent=c.reloading?'Reloading…':c.ammo+' / '+c.reserve;$('action-stars').textContent=c.tokenCount+' / 16';$('art-score').textContent=String(r.score);$('heat-clock').textContent=r.finished?(r.result.winner==='Draw'?'Draw':r.result.winner+' wins'):(Math.ceil(r.remaining)+' s');$('aim-lock').setAttribute('aria-pressed',String(s.aimAssist));$('aim-state').textContent=s.aimAssist?'Aim assist: face a sentry to lock':'Free aim: shoot where the camera faces';
 const list=$('clip-objectives');for(const objective of s.clips.challenges){let li=list.querySelector('[data-clip="'+objective.id+'"]');if(!li){li=document.createElement('li');li.dataset.clip=objective.id;list.append(li);}li.textContent=(objective.completed?'✓ ':objective.pending?'Bank it · ':'')+objective.title;li.title=objective.objective;}
 const key=s.clips.unlockedBoards.join('|')+'|'+s.selectedBoard;if($('cover-rack').dataset.key!==key){$('cover-rack').dataset.key=key;const rack=$('cover-rack');rack.replaceChildren();for(const record of [{id:'original',title:'Original',url:ASSETS+'deck.jpg'},...actionArt.boards]){const button=document.createElement('button');button.dataset.cover=record.id;button.disabled=record.id!=='original'&&!s.clips.unlockedBoards.includes(record.id);button.setAttribute('aria-pressed',String(record.id===s.selectedBoard));button.title=record.title+(button.disabled?' · collect stars or finish clips':' · equip');const image=document.createElement('img');image.src=record.url;image.alt=record.title;button.append(image);rack.append(button);}}
}
function renderCourierTrial(){
 const s=courierTrial.snapshot(sim),a=s.availability,key=s.revision+'|'+Math.floor(s.remaining*10)+'|'+Math.ceil(s.countdown)+'|'+Math.floor(a.distance)+'|'+a.canStart+'|'+Boolean(dialogueResident);if(key===trialUIKey)return;trialUIKey=key;
 $('trial-toggle').setAttribute('aria-pressed',String(s.enabled));$('trial-toggle').setAttribute('aria-label',s.enabled?'Put away courier route':'Show courier route');$('trial-start').disabled=!a.canStart||Boolean(dialogueResident);$('trial-abandon').disabled=!s.active;
 $('trial-course-actions').hidden=!s.enabled;
 $('trial-best').textContent=s.record.bestMs===null?'No delivery yet':(s.record.bestMs/1000).toFixed(2)+' s · '+s.medal;
 $('trial-results').textContent=s.record.completions+' clean deliveries · '+s.record.attempts+' attempts';
 const target=s.route.gates[s.next];
 $('trial-readout').textContent=!s.enabled?'The courier has a rehearsal route. Open it when you want a different kind of line.':s.state==='countdown'?'Hold the dispatch seal. '+Math.ceil(s.countdown)+'…':s.state==='running'?'Next: '+target.name+' · '+s.passed+' / '+s.total+' relays · '+s.remaining.toFixed(1)+' seconds left':s.state==='failed'?s.reason:s.state==='finished'?'Delivered in '+(s.lastResultMs/1000).toFixed(2)+' seconds. '+(s.newBest?'New personal best. ':'')+'Your relay crest is fitted to the deck. Return to dispatch for another run.':!a.chapterMode?'Choose Return the Light, the no-clock chapter ride, then skate to the dispatch seal.':!a.rideRunning?'Start or resume your chapter ride, then skate to dispatch.':!a.atStart?'Reach the amber dispatch seal in the west court. '+a.distance.toFixed(1)+' metres to the start.':!a.stopped?'Brake inside the dispatch seal to accept the practice parcel.':'Ready at dispatch. Start the three-count, hold still, then follow four numbered light frames.';
 $('trial-gates').querySelectorAll('li').forEach((item,i)=>{item.classList.toggle('complete',i<s.passed);item.classList.toggle('current',s.state==='running'&&i===s.next);});
 if(lastTrialSavedRevision!==s.revision){lastTrialSavedRevision=s.revision;save();}
}
function startCourierTrial(){
 if(dialogueResident)return;if(courierTrial.begin(sim)){held.clear();touchHeld.clear();touchTricks.clear();queuedOllieTrick=null;presses=[];releases=[];message('Hold the dispatch seal for the three-count. A clean delivery earns your relay crest.');canvas.focus();}renderCourierTrial();updateUI();
}
function useCourierTrial(){if(dialogueResident)return;if(!courierTrial.enabled){courierTrial.setEnabled(true);renderCourierTrial();return;}if(!courierTrial.active)startCourierTrial();}

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
 held.clear();touchHeld.clear();touchTricks.clear();queuedOllieTrick=null;presses=[];releases=[];$('chapter-dialog').hidden=false;$('speaker').textContent=dialogue.name;$('dialogue-title').textContent=dialogue.title;$('dialogue-text').textContent=dialogue.text;
 $('contract-accept').hidden=dialogue.action!=='accept';$('contract-complete').hidden=dialogue.action!=='complete';$('ending-choices').hidden=dialogue.action!=='choice';
 $('dialogue-close').focus();renderChapter();updateUI();
}
function closeConversation(){
 $('chapter-dialog').hidden=true;dialogueResident=null;if(conversationPaused&&sim.running&&sim.paused)sim.togglePause();conversationPaused=false;held.clear();touchHeld.clear();touchTricks.clear();queuedOllieTrick=null;presses=[];releases=[];updateUI();canvas.focus();
}
function graphicsSnapshot(){const size=renderer?renderer.getDrawingBufferSize(new THREE.Vector2()):new THREE.Vector2();return {preset:quality,pixelRatio:renderer?.getPixelRatio()??null,shadowMapEnabled:renderer?.shadowMap.enabled??null,drawingBuffer:{width:size.x,height:size.y},css:{width:canvas.clientWidth,height:canvas.clientHeight}};}
function resize(){if(!renderer)return;const view=canvas.parentElement,top=view.getBoundingClientRect().top+window.scrollY,docked=innerWidth>=700&&innerHeight<=650,controls=document.querySelector('.touch-controls').getBoundingClientRect().height;const fitted=Math.max(innerWidth<560?285:240,Math.min(800,innerHeight-top-(docked?0:controls)-16));if(Math.abs(view.getBoundingClientRect().height-fitted)>.5){view.style.height=fitted+'px';view.style.maxHeight='none';}const bounds=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,bounds.width),Math.max(1,bounds.height),false);camera.aspect=bounds.width/Math.max(1,bounds.height);camera.updateProjectionMatrix();}
function frame(time){
 if(disposed)return;requestAnimationFrame(frame);
 const delta=Math.min((time-lastTime)/1000||0,.1);lastTime=time;
 if(!shaders.lost){
  const control=input();accumulator+=delta;let ticks=0;
  while(accumulator>=1/120&&ticks<12){sim.step(1/120,control);if(control.ollieReleased)queuedOllieTrick=null;chapter.step(1/120,sim);courierTrial.step(sim);actionMode?.step(1/120,control,sim.yaw+orbit);control.reload=false;presses=[];releases=[];control.olliePressed=false;control.ollieReleased=false;control.trick=null;accumulator-=1/120;ticks++;}
  if(ticks===12)accumulator=0;actionSaveClock+=delta;if(selectedRide==='rival'&&actionSaveClock>4){save();actionSaveClock=0;}
  processEvents();renderPeacockStance();
  // Persist newly earned route records before their success/crest renders.
  if(lastTrialSavedRevision!==courierTrial.revision){lastTrialSavedRevision=courierTrial.revision;save();}
  const lean=sim.mode==='grind'?sim.balance*.2:clamp(control.steer,-1,1)*Math.min(.22,sim.speed*.018);
  skater.root.position.set(sim.x,sim.y,sim.z);skater.root.rotation.set(0,sim.yaw,lean);const groundHeight=terrain(sim.x,sim.z),airGap=Math.max(0,sim.y-groundHeight);skater.contactShadow.position.set(sim.x,groundHeight+.014,sim.z);skater.contactShadow.rotation.z=-sim.yaw;skater.contactShadow.material.opacity=.7/(1+airGap*.32);skater.contactShadow.scale.setScalar(1+Math.min(2,airGap)*.18);
  const crouch=sim.charging?Math.min(.34,sim.charge*.8):sim.mode==='air'?.18:0;
  skater.body.position.y=0;skater.body.scale.y=1;
  skater.modelContainer.position.y=.114-((sim.charge>.03||sim.mode==='manual') ? .038 : 0);
  skater.body.rotation.set(0,sim.stance*Math.PI,sim.mode==='bail'?Math.sin(sim.bailTime*8)*.5:0);
  const t=sim.trick?clamp(sim.trickTime/sim.trick.duration,0,1):0;
  skater.board.rotation.set(sim.mode==='manual'?-.15:0,sim.trick?Math.PI*2*sim.trick.spin*t:0,sim.trick?Math.PI*2*sim.trick.flip*t:0);
  if(sim.trick?.bodySpin)skater.body.rotation.y+=Math.PI*2*sim.trick.bodySpin*t;
  skater.root.rotation.z+=sim.mode==='bail'?.65:0;
  playAvatar(sim.mode==='air'?'jump':sim.charge>.03||sim.mode==='manual'?'crouch':'idle');skatePushRig?.reset();if(avatarMixer)avatarMixer.update(sim.paused?0:delta);skatePushRig?.update(sim.paused?0:delta,control.push&&sim.grounded&&sim.mode!=='manual'&&sim.charge<=.03&&sim.speed>.2,{...sim.snapshot(),steer:control.steer,aim:actionMode?.poseAim()});if(riderHeadBone&&riderHeadBindScale)riderHeadBone.scale.copy(riderHeadBindScale);if(riderDress)riderDress.update(chapter.state.completed,profile.theme,chapter.state.choice);if(city)city.update(sim.paused?0:delta,time,sim);if(streetAtmosphere)streetAtmosphere.update(sim.paused?0:delta,time*.001);if(courierCourse)courierCourse.update(time);courierWheelJewels.forEach(j=>{j.visible=chapter.state.completed>=2;});
  if(sim.mode==='grind'&&frameCount%4===0)burst(sim.x,sim.y,sim.z,0xffc46a,2);
  for(let i=sparkParticles.length-1;i>=0;i--){const p=sparkParticles[i];p.life-=delta;p.vy-=8*delta;p.mesh.position.x+=p.vx*delta;p.mesh.position.y+=p.vy*delta;p.mesh.position.z+=p.vz*delta;p.mesh.scale.setScalar(Math.max(.01,p.life));if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();sparkParticles.splice(i,1);}}
  const heading=sim.yaw+orbit,follow=3.7+(motion?0:sim.speed*.06);
  cameraDesired.set(sim.x+Math.sin(heading)*follow,sim.y+1.45+cameraTilt*.9,sim.z+Math.cos(heading)*follow);
  cameraDesired.y=Math.max(cameraDesired.y,terrain(cameraDesired.x,cameraDesired.z)+1.4);
  lookDesired.set(sim.x-Math.sin(sim.yaw)*.9,sim.y+.95,sim.z-Math.cos(sim.yaw)*.9);
  cameraAnchor.set(sim.x,sim.y+1.2,sim.z);const safeDesired=cameraOutsideSolids(cameraAnchor,cameraDesired,cameraSolids);cameraDesired.set(safeDesired.x,safeDesired.y,safeDesired.z);
  camera.position.lerp(cameraDesired,1-Math.exp(-delta*5));const safeActual=cameraOutsideSolids(cameraAnchor,camera.position,cameraSolids);camera.position.set(safeActual.x,safeActual.y,safeActual.z);cameraOcclusion={blocked:safeDesired.blocked||safeActual.blocked,obstacle:safeDesired.obstacle||safeActual.obstacle||null,distance:safeActual.distance,solidCount:cameraSolids.length};lookSmoothed.lerp(lookDesired,1-Math.exp(-delta*9));camera.lookAt(lookSmoothed);
  camera.fov=58+(motion?0:Math.min(6,sim.speed*.4));camera.updateProjectionMatrix();
  routeLights.forEach((light,i)=>{light.material.color.set(i<sim.line?0xffc666:i===sim.line?0x63ffe5:0x5d346f);light.material.emissive.copy(light.material.color);});
  portalRings.forEach((ring,i)=>{if(!motion)ring.rotation.z=Math.sin(time*.0002+i)*.08;ring.material.emissiveIntensity=profile.lines>0||chapter.state.completed===3?2.3:1.1;});
  skater.cap.material.color.set(skinColors[profile.theme]);skater.deckMaterial.color.set(skinColors[profile.theme]);
  actionMode?.update(delta);renderer.render(scene,camera);firstFrame=true;frameCount++;elapsedFrames+=delta;
  if(elapsedFrames>1){measuredFps=frameCount/elapsedFrames;frameCount=0;elapsedFrames=0;}
  if(time-lastUIRefresh>=100){lastUIRefresh=time;updateUI();renderChapter();renderCourierTrial();renderAction();}
 }
}
function loadControlAtlas(){for(const [key,file]of [['ui-skate-atlas','vorath-skate-controls-v6.png'],['ui-atlas','vorath-controls-v1.png'],['ui-title','kosher-lines-title-v4.png'],['ui-objectives','kosher-objectives-v4.png'],['ui-peacock','peacock-switch-control-v1.png']]){const image=new Image();assetState[key]='loading';image.onload=()=>{assetState[key]='loaded';};image.onerror=()=>{assetState[key]='failed';loadErrors.push(key);};image.src=ASSETS+file;}}
function installInput(){
 const clear=()=>{held.clear();touchHeld.clear();touchTricks.clear();queuedOllieTrick=null;presses=[];releases=[];document.querySelectorAll('.touch-controls .pressed').forEach(button=>button.classList.remove('pressed'));};
 window.addEventListener('keydown',e=>{
  if(dialogueResident){if(e.code==='Escape'){e.preventDefault();closeConversation();}return;}
  if(!keysOwned.includes(e.code)||e.target.closest?.('input,select,textarea'))return;
  e.preventDefault();if(!e.repeat){presses.push(e.code);if(e.code==='KeyQ'&&selectedRide==='rival'){actionMode.toggleAim();return;}if(e.code==='KeyT'){useCourierTrial();return;}if(e.code==='KeyE'){openConversation();return;}if(e.code==='KeyR'){sim.reset(true);save();}if(e.code==='KeyP'||e.code==='Escape')sim.togglePause();}
  held.add(e.code);
 });
 window.addEventListener('keyup',e=>{if(keysOwned.includes(e.code)){e.preventDefault();held.delete(e.code);releases.push(e.code);}});
 window.addEventListener('blur',()=>{clear();if(sim.running&&!sim.paused)sim.togglePause();updateUI();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();pausedByVisibility=sim.running&&!sim.paused;if(pausedByVisibility)sim.togglePause();}lastTime=performance.now();});
 canvas.addEventListener('contextmenu',e=>{if(selectedRide==='rival')e.preventDefault();});
 canvas.addEventListener('pointerdown',e=>{if(selectedRide==='rival'&&e.button===0){touchHeld.add('fire');canvas.setPointerCapture(e.pointerId);return;}dragging=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(dragging&&lastPointer){orbit-=(e.clientX-lastPointer.x)*.005;cameraTilt=clamp(cameraTilt+(e.clientY-lastPointer.y)*.002,-.1,1);lastPointer={x:e.clientX,y:e.clientY};}});
 canvas.addEventListener('pointerup',()=>{touchHeld.delete('fire');dragging=false;lastPointer=null;});canvas.addEventListener('pointercancel',()=>{touchHeld.delete('fire');dragging=false;lastPointer=null;});
 canvas.addEventListener('lostpointercapture',()=>touchHeld.delete('fire'));
 for(const button of document.querySelectorAll('[data-hold]')){
  const code=button.dataset.hold;
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touchHeld.add(code);if(code==='ollie'){queuedOllieTrick=null;presses.push('Space');}button.classList.add('pressed');});
  const up=e=>{e.preventDefault();touchHeld.delete(code);if(code==='ollie'){if(e.type==='pointerup')queuedOllieTrick=[...touchTricks.values()].at(-1)||queuedOllieTrick;else queuedOllieTrick=null;releases.push('Space');}button.classList.remove('pressed');};
  button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',()=>{if(touchHeld.delete(code)&&code==='ollie'){queuedOllieTrick=null;releases.push('Space');}button.classList.remove('pressed');});
 }
 // Pointer presses act immediately in the air. A physically held trick can
 // also be combined with a charged ollie: release the two fingers together.
 // Latch the selection across either pointer-up ordering, then consume it on
 // the ordinary ollie-release input. Physics, duration and landing rules stay intact.
 for(const button of document.querySelectorAll('[data-trick]')){
  const code=button.dataset.trick;
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);touchTricks.set(e.pointerId,code);presses.push(code);button.classList.add('pressed');});
  button.addEventListener('pointerup',e=>{e.preventDefault();if(touchTricks.has(e.pointerId)&&touchHeld.has('ollie')&&sim.charging)queuedOllieTrick=code;touchTricks.delete(e.pointerId);button.classList.remove('pressed');});
  button.addEventListener('pointercancel',e=>{touchTricks.delete(e.pointerId);if(queuedOllieTrick===code)queuedOllieTrick=null;button.classList.remove('pressed');});
  button.addEventListener('lostpointercapture',e=>{touchTricks.delete(e.pointerId);button.classList.remove('pressed');});
  button.addEventListener('click',e=>{if(e.detail===0)presses.push(code);});
 }
 $('start').addEventListener('click',()=>{sim.start();if(selectedRide==='rival')actionMode.start();clear();orbit=0;cameraTilt=.38;save();message(selectedRide==='rival'?'Three minutes. Outskate Art, shoot the sentries, land the clip.':'Drop in. Build speed, then follow the five lamps.');updateUI();canvas.focus();});
 $('pause').addEventListener('click',()=>{sim.togglePause();clear();updateUI();});
 $('trial-toggle').addEventListener('click',()=>{courierTrial.setEnabled(!courierTrial.enabled);renderCourierTrial();});
 $('trial-start').addEventListener('click',startCourierTrial);
 $('trial-abandon').addEventListener('click',()=>{courierTrial.cancel('The practice parcel was returned. Brake at dispatch to try again.');renderCourierTrial();});
 $('talk').addEventListener('click',openConversation);
 $('dialogue-close').addEventListener('click',closeConversation);
 $('contract-accept').addEventListener('click',()=>{if(chapter.accept(dialogueResident)){message(CONTRACTS[chapter.state.completed].title+' accepted.');save();}closeConversation();renderChapter();});
 $('contract-complete').addEventListener('click',()=>{if(chapter.turnIn(dialogueResident)){message(chapter.notifications.at(-1).text);save();}closeConversation();renderChapter();});
 for(const button of document.querySelectorAll('[data-ending]'))button.addEventListener('click',()=>{if(chapter.turnIn(dialogueResident,button.dataset.ending)){message(chapter.notifications.at(-1).text);save();}closeConversation();renderChapter();});
 $('ride-mode').addEventListener('change',()=>{if(dialogueResident)closeConversation();selectedRide=$('ride-mode').value;sim.sessionMode=selectedRide==='arcade'?'arcade':'chapter';actionMode.setEnabled(selectedRide==='rival');$('action-controls').hidden=selectedRide!=='rival';$('action-brief').hidden=selectedRide!=='rival';$('mode-description').textContent=selectedRide==='rival'?'BLP vs Art · three-minute heat, then sandbox · clips and cover decks save locally.':sim.sessionMode==='chapter'?'Return the Light · no clock · chapter progress saves on this device.':'Two-minute arcade · chapter progress carries across both modes.';sim.reset(true);if(selectedRide==='rival')actionMode.start();clear();save();message($('mode-description').textContent);updateUI();renderAction();requestAnimationFrame(resize);});
 $('reload').addEventListener('click',()=>presses.push('KeyL'));$('aim-lock').addEventListener('click',()=>{actionMode.toggleAim();renderAction();});
 $('cover-rack').addEventListener('click',event=>{const button=event.target.closest('[data-cover]');if(button&&actionMode.selectBoard(button.dataset.cover)){save();renderAction();}});
 $('camera-reset').addEventListener('click',()=>{orbit=0;cameraTilt=.38;});
 $('quality').addEventListener('change',()=>{quality=$('quality').value;$('quality-description').textContent=quality==='low'?'Low power · simpler distant detail':'Shadows + detail';renderer.setPixelRatio(quality==='low'?0.5:Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=quality!=='low';streetAtmosphere?.setQuality(quality);city?.setQuality(quality);resize();});
 for(const button of document.querySelectorAll('[data-theme]'))button.addEventListener('click',()=>{profile.theme=Number(button.dataset.theme);save();updateUI();});
}
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x10152d);scene.fog=new THREE.FogExp2(0x12152e,.012);
 camera=new THREE.PerspectiveCamera(58,1,.08,180);camera.position.set(4,5,13);
 scene.add(new THREE.HemisphereLight(0x8099b8,0x1c1528,1.05));
 const moon=new THREE.DirectionalLight(0xb8cff6,2.5);moon.position.set(-12,24,12);moon.castShadow=true;
 moon.shadow.mapSize.set(1024,1024);Object.assign(moon.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:75});moon.shadow.bias=-.0002;scene.add(moon);
 const warm=new THREE.DirectionalLight(0xffad72,.5);warm.position.set(14,10,-20);scene.add(warm);makeReflections();loadControlAtlas();
 const mural=texture('vorath-acid-eye-mural-v1.png');makeWorld(mural);streetAtmosphere=createStreetAtmosphere({THREE,scene,quality,reducedMotion:motion});cameraSolids.push(...streetAtmosphere.cameraBounds);const mosaic=texture('vorath-eye-mosaic-v1.png');city=buildCity(scene,chapter,{mosaic,mural,repairKitURL:ASSETS+'keeper-repair-station-v2.glb',bayKitURL:ASSETS+'kosher-arcade-bay-v1.glb',storyPropsURL:ASSETS+'kosher-story-props-v1.glb',onStoryStatus(status,error){assetState['story-props-model']=status;if(error)loadErrors.push('story-props-model: '+error);},onBayStatus(status,error){assetState['arcade-bay-model']=status;if(error)loadErrors.push('arcade-bay-model: '+error);},onKitStatus(status,error){assetState['keeper-station-model']=status;if(error)loadErrors.push('keeper-station-model: '+error);}});cameraSolids.push(...city.cameraBounds);courierCourse=buildCourierCourse(scene,courierTrial,{reducedMotion:motion});actionMode=createActionMode(THREE,{scene,sim,art:actionArt,colliders:[...COLLIDERS,...cameraSolids],readSave:readActionSave,saveKey:SAVE,onStatus:message});skater=makeSkater();courierCourse.mountPrize(skater.board);bodyRig=skater.body;boardRig=skater.board;installInput();resize();window.addEventListener('resize',resize);new ResizeObserver(resize).observe(canvas);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();shaders.lost=true;if(sim.running&&!sim.paused)sim.togglePause();message('Graphics paused while the context recovers. Saved progress is safe.');});
 canvas.addEventListener('webglcontextrestored',()=>{shaders.lost=false;makeReflections();lastTime=performance.now();accumulator=0;resize();message('Graphics restored. Resume the ride when ready.');});
 window.addEventListener('pagehide',event=>{save();if(!event.persisted){disposed=true;streetAtmosphere?.dispose();reflectionTarget?.dispose();renderer.dispose();}else if(sim.running&&!sim.paused)sim.togglePause();});
 window.addEventListener('pageshow',event=>{if(event.persisted){lastTime=performance.now();accumulator=0;resize();}});
 const requestedMode=new URLSearchParams(window.location.search).get('mode');if(['chapter','rival'].includes(requestedMode)){$('ride-mode').value=requestedMode;$('ride-mode').dispatchEvent(new Event('change',{bubbles:true}));}
 requestAnimationFrame(frame);updateUI();renderChapter();renderCourierTrial();save();
}catch(error){loadErrors.push(String(error));$('graphics-error').hidden=false;$('graphics-error').textContent='The 3D plaza could not start on this graphics context. '+String(error.message||error);}
window.__KOSHER_LINES__=Object.freeze({
 snapshot:()=>({...sim.snapshot(),selectedRide,action:actionMode?.snapshot()||null,career:chapter.snapshot(),courierTrial:courierTrial.snapshot(sim),graphics:graphicsSnapshot(),renderer:{firstFrame,modelLoaded,modelError,peacockKiosk:{built:peacockKiosk?.parent===scene,position:peacockKiosk?{x:peacockKiosk.position.x,z:peacockKiosk.position.z}:null,clipZone:{...PEACOCK_KIOSK}},avatar:{...avatarMetrics,pose:{activeClip:avatarCurrent,skatePush:skatePushRig?.snapshot()||null,bodyScaleY:skater?.body.scale.y,bodyYaw:skater?.body.rotation.y,boardYaw:skater?.board.rotation.y,modelY:skater?.modelContainer.position.y},animations:[...avatarMetrics.animations],headScale:riderHeadBone?{x:riderHeadBone.scale.x,y:riderHeadBone.scale.y,z:riderHeadBone.scale.z}:null},assets:{...assetState},texturesLoaded:Object.keys(assetState).filter(name=>/\.(jpg|png|webp)$/.test(name)&&assetState[name]==='loaded').length+Number(avatarMetrics.skinLoaded),errors:[...loadErrors],contextLost:shaders.lost,fps:Math.round(measuredFps),quality,courierCourse:courierCourse?.snapshot()||null,wardrobe:riderDress?.snapshot()||null,wheelJewelsVisible:courierWheelJewels.filter(j=>j.visible).length,reflections:{capturedFaceSize:64,textureWidth:reflectionTarget?.width||0,textureHeight:reflectionTarget?.height||0,environmentAssigned:scene?.environment===reflectionTarget?.texture},city:city?{...city.metrics,...city.snapshot()}:null,streetscape:streetAtmosphere?.stats()||null,drawCalls:renderer?.info.render.calls||0},camera:camera?{x:camera.position.x,y:camera.position.y,z:camera.position.z,occlusion:{...cameraOcclusion}}:null,storageAvailable:saveAvailable}),
 provenance:'Reconstructed missing simulation and rendering from retained Grok source fragments. Original art retained; no exact full-source restoration claimed.'
});
window.render_game_to_text=()=>JSON.stringify(window.__KOSHER_LINES__.snapshot());
