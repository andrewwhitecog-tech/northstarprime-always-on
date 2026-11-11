import { configureWovenMaterial } from './woven-material.js';
import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { GLTFLoader } from '/static/vendor/three/0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { installStreetBays } from './street-bays.js';
import { createAmbientResidents } from './ambient-residents.js';
import { RESIDENTS, BEACONS, CITY_COLLIDERS, AMBIENT_CITIZENS, relayHasLight } from './chapter.mjs';
// Original geometry and textile patterns; no third-party logos or image lettering.
export function wovenTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 c.fillStyle='#111326';c.fillRect(0,0,256,256);const colors=['#17dcb7','#ef9254','#6845bb','#e7599e','#e6ba64','#2a77c8'];
 for(let n=0;n<12;n++){c.strokeStyle=colors[n%colors.length];c.lineWidth=9;c.beginPath();for(let x=-20;x<=276;x+=4){const y=n*24+Math.sin(x*.042+n*.8)*14+Math.sin(x*.094)*4;if(x===-20)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 for(let y=0;y<256;y+=4){c.fillStyle=y%8?'#04081850':'#ffe9c125';c.fillRect(0,y,256,1);}for(let x=0;x<256;x+=4){c.fillStyle='#03051435';c.fillRect(x,0,1,256);}
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
export function buildCity(scene,chapter,{mosaic=null,mural=null,repairKitURL=null,onKitStatus=()=>{},bayKitURL=null,onBayStatus=()=>{},storyPropsURL=null,onStoryStatus=()=>{}}={}){
 const cameraBounds=[],repairFallback=[],repairDetails=[],storyPropRecords=[];const storyProps={loaded:false,error:null,groups:0,triangles:0};const keeperKit={loaded:false,error:null,meshes:0,triangles:0,materials:0,bounds:null,corePresent:false};let geometryCount=0,occupiedResidents=0;const animated=[],beaconMeshes=[],publicLights=[],markerMeshes=[],materials=[],residentRecords=[],npcErrors=[],detailMotion=[],repairCells=[],courierSignals=[],archiveDisplays=[];let residentRigInstallCount=0,ambientResidents=null;
 const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.25,...extra});materials.push(m);return m;};
 const ink=material(0x090c14,{metalness:.72,roughness:.39}),stone=material(0x303742,{roughness:.92,metalness:.07}),gold=material(0xb89158,{metalness:.82,roughness:.34}),soil=material(0x132124),wood=material(0x50362e,{roughness:.9}),leaf=material(0x176b57),cloth=material(0xffffff,{map:wovenTexture(),roughness:.9});
 // Original material study: fine scratches and scored aggregate affect actual
 // roughness/bump response, rather than a flat screen color grade.
 const wearCanvas=document.createElement('canvas');wearCanvas.width=wearCanvas.height=256;
 const wear=wearCanvas.getContext('2d');wear.fillStyle='#9b9b9b';wear.fillRect(0,0,256,256);
 for(let i=0;i<430;i++){const x=(i*73+17)%256,y=(i*131+43)%256,v=75+(i*47)%110;wear.fillStyle='rgb('+v+','+v+','+v+')';wear.fillRect(x,y,1+(i%3),1);}
 for(let i=0;i<31;i++){const x=(i*53)%256,y=(i*97)%256;wear.strokeStyle=i%3?'#c7c7c7':'#626262';wear.lineWidth=.6;wear.beginPath();wear.moveTo(x,y);wear.lineTo(x+9+(i%11),y-2);wear.stroke();}
 const wearMap=new THREE.CanvasTexture(wearCanvas);wearMap.wrapS=wearMap.wrapT=THREE.RepeatWrapping;wearMap.repeat.set(2,2);
 for(const m of [ink,stone,gold,wood]){m.roughnessMap=wearMap;m.bumpMap=wearMap;m.bumpScale=m===stone?.025:.008;}
 const jewel=new THREE.MeshPhysicalMaterial({color:0x1587a0,metalness:.65,roughness:.23,iridescence:1,iridescenceIOR:1.5,iridescenceThicknessRange:[180,420],clearcoat:.8});materials.push(jewel);
 const neonColors=[0x72ff4a,0xff286e,0x8263ff,0x32eaf4];const neon=neonColors.map(color=>material(color,{emissive:color,emissiveIntensity:1.8,roughness:.24}));
 const add=(g,m,x=0,y=0,z=0,parent=scene)=>{const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.castShadow=a.receiveShadow=true;parent.add(a);geometryCount++;return a;};
 const cube=(w,h,d,x,y,z,m=ink,parent=scene)=>{if(parent===scene&&Math.max(w,d)>1.5&&h>2.2)cameraBounds.push({id:'city-solid-'+cameraBounds.length,minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});return add(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);};
 const rod=(a,b,r,m=gold,parent=scene)=>{const d=new THREE.Vector3().subVectors(b,a),o=add(new THREE.CylinderGeometry(r,r,d.length(),7),m,0,0,0,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const tube=(points,r,m,parent=scene,closed=false)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed),Math.max(12,points.length*6),r,6,closed),m,0,0,0,parent);
 const instances=(geometry,m,items)=>{const batch=new THREE.InstancedMesh(geometry,m,items.length),dummy=new THREE.Object3D();items.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.rotation.set(p[6]||0,p[7]||0,p[8]||0);dummy.scale.set(p[3]||1,p[4]||1,p[5]||1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.castShadow=batch.receiveShadow=true;scene.add(batch);geometryCount++;return batch;};
 // Authored industrial bays replace the previous procedural pilasters and signs.
 const panes=[],frames=[],tiles=[],leaves=[],trunks=[];
 const streetBays=bayKitURL?installStreetBays(scene,bayKitURL,onBayStatus):null;
 if(streetBays)cameraBounds.push(...streetBays.cameraBounds);
 const consolidatedBaySources=0;let baySubmissions=0;
 // All street-level solids below are derived from the very same collider table as physics.
 for(const b of CITY_COLLIDERS){
  if(['resident','beacon','column','citizen','bay-wall'].includes(b.kind))continue;
  if(b.kind==='tree')continue;
  if(b.kind==='garden')continue;
  if(b.kind==='bench'){cube(b.w,b.h,b.d,b.x,b.h/2,b.z,wood);for(let i=0;i<4;i++)cube(b.w,.035,.025,b.x,b.h+.02,b.z-.4+i*.27,gold);continue;}
  if(b.kind==='kiosk'){
   // A glazed parcel counter, locked by its grille; its envelope is the unchanged kiosk collider.
   cube(.18,b.h,1.9,b.x-1.4,b.h/2,b.z,ink);cube(2.9,b.h,.12,b.x,b.h/2,b.z-.94,ink);cube(2.9,b.h,.12,b.x,b.h/2,b.z+.94,ink);
   cube(3,.16,2,b.x,b.h-.08,b.z,jewel);cube(.3,.9,1.85,b.x+1.35,.45,b.z,wood);
   for(const y of [.95,1.7,2.3])cube(2.4,.065,1.65,b.x+.05,y,b.z,gold);
   for(let i=0;i<5;i++){const z=b.z-.68+i*.34;rod(new THREE.Vector3(b.x+1.49,.95,z),new THREE.Vector3(b.x+1.49,2.25,z),.018,gold);}
   for(let i=0;i<8;i++){const parcel=cube(.42,.3,.31,b.x+.8,.17+Math.floor(i/4)*.82,b.z-.56+(i%4)*.37,i%3===0?cloth:i%3===1?wood:stone);cube(.025,.32,.33,parcel.position.x+.02,parcel.position.y,parcel.position.z,gold);}
   for(let i=0;i<3;i++){const signal=add(new THREE.SphereGeometry(.055,8,6),neon[i].clone(),b.x+1.51,2.4,b.z-.4+i*.4);courierSignals.push(signal);}
   continue;
  }
  const solid=cube(b.w,b.h,b.d,b.x,b.h/2,b.z,ink),trim=cube(b.w+.04,.05,b.d+.04,b.x,b.h+.025,b.z,gold);if(b.kind==='counter')repairFallback.push(solid,trim);
 }
 instances(new THREE.BoxGeometry(1,1,1),ink,frames);
 if(mosaic){mosaic.wrapS=mosaic.wrapT=THREE.ClampToEdgeWrapping;mosaic.repeat.set(1,1);const disc=add(new THREE.CircleGeometry(.95,64),material(0xffffff,{map:mosaic,metalness:.28,roughness:.43}),0,.025,9.2);disc.rotation.x=-Math.PI/2;const rim=add(new THREE.TorusGeometry(.98,.035,7,64),gold,0,.04,9.2);rim.rotation.x=-Math.PI/2;}
 // A layered tiled wayfinding braid, laid flush: the player can actually roll over it.
 for(let i=0;i<50;i++){const z=12-i*.87;for(const side of [-1,1])tiles.push([side*(6+Math.sin(i*.28)*.24),.012,z,.16,.025,.42]);}
 instances(new THREE.BoxGeometry(1,1,1),jewel,tiles);
 // Canopy shelter with real woven ribs, open entrances and a lit circuit that becomes repaired.
 for(let j=0;j<9;j++){const z=7.5+j*.25;rod(new THREE.Vector3(6.9,3.3,z),new THREE.Vector3(11.1,3.3,z),.035,gold);}
 const roofProfile=new THREE.Shape();roofProfile.moveTo(-2.2,0);roofProfile.quadraticCurveTo(0,1.05,2.2,0);roofProfile.lineTo(2.2,-.09);roofProfile.quadraticCurveTo(0,.92,-2.2,-.09);roofProfile.closePath();
 const canopyRoof=add(new THREE.ExtrudeGeometry(roofProfile,{depth:2.9,bevelEnabled:false,curveSegments:20}),ink,9,3.42,7.05);
 for(let i=0;i<7;i++){
  const x=7.08+i*.64,plate=cube(.55,.09,3.15,x,3.5+.39*(1-Math.pow((x-9)/2.2,2)),8.48,i%3===0?jewel:ink);plate.rotation.z=(9-x)*.085;
  for(const z of [7.02,9.92])add(new THREE.SphereGeometry(.035,6,4),gold,x,plate.position.y+.055,z);
 }
 for(const z of [7.12,9.84])for(const side of [-1,1]){
  rod(new THREE.Vector3(9+side*2.05,.08,z),new THREE.Vector3(9+side*2.05,3.35,z),.06,ink);
  rod(new THREE.Vector3(9+side*2.05,2.5,z),new THREE.Vector3(9+side*1.3,3.5,z),.055,gold);
 }
 for(const z of [7.04,8.5,9.98]){const ribs=[];for(let i=0;i<=16;i++){const x=-2.2+i*4.4/16;ribs.push([9+x,3.43+.525*(1-Math.pow(x/2.2,2)),z]);}tube(ribs,.027,gold);}
 for(let i=0;i<5;i++){const light=add(new THREE.SphereGeometry(.09,8,6),neon[i%4].clone(),7.3+i*.85,3.15,7.2);publicLights.push(light);}
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
  const fallbackMeshes=group.children.slice();residentRecords.push({id:resident.id,index,group,fallbackMeshes,actor:null,mixer:null,costume:null,bones:0,skinnedMeshes:0,vertices:0});
  const marker=add(new THREE.OctahedronGeometry(.14),neon[index].clone(),0,2.16,0,group);markerMeshes.push({id:resident.id,mesh:marker});animated.push({type:'resident',group,head,baseY:1.62,index});occupiedResidents++;
 };
 RESIDENTS.forEach(person);
 // The six ambient adults share two genuinely posed, baked versions of the
 // actual adult template. Keep their benches, with a natural half-metre seat.
 for(const {x,z} of AMBIENT_CITIZENS){
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=x>0?Math.PI/2:-Math.PI/2;scene.add(group);
  cube(.64,.12,.48,0,.44,.04,wood,group);for(const a of [-.24,.24])for(const b of [-.12,.2])cube(.06,.4,.06,a,.2,b,ink,group);
  occupiedResidents++;
 }
 // Street skyline, divided glazing and elevated cables now live in streetscape.js.
 // Hand-laid material changes give the three resident places distinct ground, without new obstacles.
 const ceramic=material(0xffffff,{vertexColors:true,roughness:.82,metalness:.05});
 const pave=(x0,x1,z0,z1,colors)=>{
  const pos=[],col=[],stepX=.64,stepZ=.46;
  for(let row=0,z=z0;z<z1;row++,z+=stepZ)for(let column=0,x=x0;x<x1;column++,x+=stepX){
   const xx=x+(row%2)*.13,xa=Math.min(xx+.025,x1),xb=Math.min(xx+stepX-.025,x1),za=z+.023,zb=Math.min(z+stepZ-.023,z1);if(xb<=xa||zb<=za)continue;
   const color=new THREE.Color(colors[(row*7+column*3)%colors.length]);const y=.003+(row%3)*.0005;
   for(const p of [[xa,y,za],[xa,y,zb],[xb,y,za],[xb,y,za],[xa,y,zb],[xb,y,zb]]){pos.push(...p);col.push(color.r,color.g,color.b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();const o=add(g,ceramic);o.castShadow=false;
 };
 pave(5.25,12.7,4.9,11.5,[0x286866,0x9a7042,0x36485a,0x704c59,0x314450]);
 pave(-18.4,-13.3,-9.4,-2.6,[0x32535e,0x274747,0x755345,0x3a5271,0x223c43]);
 pave(9,15.4,-31.7,-26.3,[0x4a3d60,0x736556,0x244c56,0x49364e,0x2b3548]);
 const drainSlats=[];for(const [x,z]of [[6,5.3],[-13.6,-8.7],[9.4,-26.6]]){for(let i=0;i<12;i++)drainSlats.push([x+i*.09,.012,z,.035,.02,.42]);}instances(new THREE.BoxGeometry(1,1,1),gold,drainSlats);
 const repairDetailStart=scene.children.length;
 // Repair bench: inset fan enamels, a copper cable reel, and a visibly broken/restored lamp.
 const enamel=[material(0x177b83),material(0x6f3f89),material(0xb85955),material(0x29614e)];
 for(let i=0;i<9;i++){
  const x=7.7+i*.31,profile=new THREE.Shape();profile.moveTo(-.13,-.25);profile.quadraticCurveTo(0,.2,.13,-.25);profile.lineTo(0,.28);profile.closePath();
  const fan=add(new THREE.ExtrudeGeometry(profile,{depth:.025,bevelEnabled:true,bevelSegments:1,bevelSize:.015,bevelThickness:.008,curveSegments:8}),enamel[i%4],x,.49,8.178);fan.rotation.x=Math.PI;
 }
 const reel=new THREE.Group();reel.position.set(10.05,1.02,8.8);scene.add(reel);
 for(const z of [-.13,.13]){const flange=add(new THREE.CylinderGeometry(.2,.2,.035,16),wood,0,.18,z,reel);flange.rotation.x=Math.PI/2;}
 const wire=add(new THREE.CylinderGeometry(.145,.145,.25,16),gold,0,.18,0,reel);wire.rotation.x=Math.PI/2;
 tube([[10.05,1.17,8.67],[9.7,1.02,8.4],[9.2,1.01,8.65]],.018,gold);
 const repairLamp=new THREE.Group();repairLamp.position.set(8.4,1.04,8.8);scene.add(repairLamp);
 add(new THREE.CylinderGeometry(.21,.26,.06,12),gold,0,0,0,repairLamp);
 for(const x of [-.15,.15])rod(new THREE.Vector3(x,0,0),new THREE.Vector3(x,.48,0),.02,gold,repairLamp);
 const lampLoop=add(new THREE.TorusGeometry(.2,.025,6,24),gold,0,.48,0,repairLamp);lampLoop.rotation.x=Math.PI/2;
 const cell=add(new THREE.OctahedronGeometry(.12),neon[3].clone(),0,.26,0,repairLamp);repairCells.push(cell);
 const repairTools=new THREE.Group();repairTools.position.set(9.15,1.015,8.55);scene.add(repairTools);
 for(let i=0;i<4;i++){rod(new THREE.Vector3(-.3+i*.16,0,0),new THREE.Vector3(-.3+i*.16,.02,.34),.018,ink,repairTools);add(new THREE.SphereGeometry(.045,7,5),gold,-.3+i*.16,.02,.34,repairTools);}
 repairDetails.push(...scene.children.slice(repairDetailStart));
 // Hemmed canvas edges and cloth pennants move locally; no extra lights or transmissive passes.
 for(let i=0;i<5;i++){
  const hem=new THREE.Shape();hem.moveTo(-.38,0);hem.lineTo(.38,0);hem.quadraticCurveTo(.24,-.4,0,-.33);hem.quadraticCurveTo(-.24,-.4,-.38,0);
  add(new THREE.ShapeGeometry(hem,12),cloth,7.35+i*.82,3.42,7.03);
 }
 for(const [x,z]of [[7.12,9.2],[10.9,9.2],[-17,-6]]){
  const pennant=new THREE.Group();pennant.position.set(x,3.05,z);scene.add(pennant);const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.7,-.12);shape.lineTo(.55,-.7);shape.lineTo(0,-.62);shape.closePath();add(new THREE.ShapeGeometry(shape),cloth,0,0,0,pennant);detailMotion.push({type:'cloth',group:pennant,phase:x});
 }
 // Archive display: eight spooled memories in brass recesses, not unfulfilled text rewards.
 for(let i=0;i<8;i++){
  const x=11.1+i*.42;cube(.32,.14,.62,x,1.08,-29.4,wood);const spool=add(new THREE.TorusGeometry(.1,.035,6,16),i%2?jewel:gold,x,1.24,-29.4);spool.rotation.x=Math.PI/2;archiveDisplays.push(spool);
 }
 // The southern station closes the previously empty view. It lies beyond the existing skate boundary.
 const sandstone=material(0x36333b,{roughness:.94}),copper=material(0x844b36,{metalness:.7,roughness:.48}),rose=material(0x4e2558),glaze=material(0x15414b,{metalness:.68,roughness:.24,emissive:0x13505d,emissiveIntensity:.45});
 const southWindows=[],southTrim=[],southShutters=[];
 for(const side of [-1,1]){
  const cx=side*12.1;cube(18,8.2,6.5,cx,4.1,20.1,sandstone);cube(18.6,.34,7,cx,8.3,20.1,copper);
  cube(18.4,.22,6.8,cx,3.7,20.1,gold);
  for(let bay=0;bay<4;bay++){
   const x=cx-6.7+bay*4.35;cube(.42,7.7,.65,x-1.75,3.85,16.6,stone);cube(3.2,.18,1.1,x,3.1,16.3,copper);
   const arch=[];for(let j=0;j<=12;j++){const a=j/12*Math.PI;arch.push([x+Math.cos(a)*1.45,2+Math.sin(a)*1.2,16.54]);}tube(arch,.09,gold);
   cube(2.65,2.4,.1,x,1.3,16.82,ink);for(let shelf=0;shelf<3;shelf++)cube(2.45,.055,.26,x,.5+shelf*.53,16.64,wood);
   for(let j=0;j<5;j++)southShutters.push([x-1.03+j*.515,1.33,16.54,.035,2.25,.06]);
   for(let floor=0;floor<2;floor++){southWindows.push([x,4.9+floor*2,16.8,2.2,1.2,.08]);southTrim.push([x,4.2+floor*2,16.6,2.55,.12,.18]);for(let j=0;j<4;j++)southTrim.push([x-1.1+j*.73,4.65+floor*2,16.54,.045,1.35,.08]);}
   for(let object=0;object<4;object++){const bowl=add(new THREE.LatheGeometry([new THREE.Vector2(.02,0),new THREE.Vector2(.13,.03),new THREE.Vector2(.17,.16)],9),bay%2?glaze:rose,x-.8+object*.53,.58+(object%2)*.53,16.55);bowl.castShadow=false;}
  }
  // A roof greenhouse and copper ventilators give the station its own skyline silhouette.
  cube(9,.8,4.6,cx,8.85,20.1,stone);
  const roof=new THREE.CylinderGeometry(2.35,2.35,9,3,1,true,0,Math.PI);roof.rotateZ(Math.PI/2);add(roof,glaze,cx,9.25,20.1);
  for(let i=0;i<4;i++){add(new THREE.CylinderGeometry(.18,.3,1.15,10),copper,cx-3+i*2,9.3,20.1);add(new THREE.ConeGeometry(.36,.24,10),gold,cx-3+i*2,9.95,20.1);}
 }
 instances(new THREE.BoxGeometry(1,1,1),glaze,southWindows);instances(new THREE.BoxGeometry(1,1,1),gold,southTrim);instances(new THREE.BoxGeometry(1,1,1),copper,southShutters);
 // Open masonry arch, closed grille: the station is scenery rather than an unimplemented playable exit.
 for(const side of [-1,1]){cube(.8,5.2,2,side*2.7,2.6,17.4,stone);cube(1.1,.25,2.3,side*2.7,5.15,17.4,gold);}
 const stationArch=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI;stationArch.push([Math.cos(a)*2.7,5.2+Math.sin(a)*1.7,17.35]);}tube(stationArch,.28,stone);tube(stationArch.map(p=>[p[0],p[1],p[2]-.31]),.045,gold);
 for(let i=0;i<13;i++)rod(new THREE.Vector3(-2.4+i*.4,0,17.38),new THREE.Vector3(-2.4+i*.4,4.4,17.38),.028,copper);
 const clockFace=new THREE.Group();clockFace.position.set(0,6,17.02);scene.add(clockFace);for(let i=0;i<3;i++)add(new THREE.TorusGeometry(.35+i*.18,.032,6,36),i%2?jewel:gold,0,0,i*.025,clockFace);detailMotion.push({type:'clock',group:clockFace,phase:0});
 // Rooftops to the south continue the city through camera orbits instead of ending in a blue void.


 // Dimensional aurora curtains beyond the roofline: real curved geometry,
 // original vertex colors, no sky image or extra lighting/render passes.
 const skyMotion=!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const aurora=[];
 for(let layer=0;layer<4;layer++){
  const vertices=[],colors=[],indices=[],base=[],colorA=new THREE.Color([0x4bf2c5,0xbd67f7,0xffb565,0x3ccbdc][layer]),colorB=new THREE.Color([0x485fda,0xef5fa7,0xab4ae5,0x4ff1ae][layer]);
  for(let i=0;i<=48;i++){
   const t=i/48,angle=-Math.PI*.95+t*Math.PI*1.9,radius=85+layer*6;
   const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius-13,y=18+layer*1.4+Math.sin(t*Math.PI*4+layer)*2.2;
   const tint=colorA.clone().lerp(colorB,.5+.5*Math.sin(t*Math.PI*3+layer));
   for(let edge=0;edge<2;edge++){vertices.push(x,y+edge*(3.8+Math.sin(t*8+layer)*1.4),z);base.push(y+edge*(3.8+Math.sin(t*8+layer)*1.4));const fade=edge?.24:1;colors.push(tint.r*fade,tint.g*fade,tint.b*fade);}
   if(i<48){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false,fog:false,blending:THREE.AdditiveBlending});
  const curtain=add(geometry,material);curtain.castShadow=curtain.receiveShadow=false;curtain.frustumCulled=false;aurora.push({mesh:curtain,base,layer});
 }
 // A glazed eye relief belongs to the station facade, behind a manufactured
 // brass frame. The original image is mapped into architecture, not overlaid.
 if(mosaic){
  const relief=new THREE.Group();relief.position.set(0,8.5,17.01);scene.add(relief);
  const shell=add(new THREE.CylinderGeometry(1.35,1.35,.22,48),stone,0,0,.1,relief);shell.rotation.x=Math.PI/2;
  const glass=add(new THREE.CircleGeometry(1.22,48),material(0xffffff,{map:mosaic,emissive:0x548cb0,emissiveMap:mosaic,emissiveIntensity:.45,metalness:.3,roughness:.26}),0,0,-.025,relief);glass.rotation.y=Math.PI;
  for(let i=0;i<2;i++)add(new THREE.TorusGeometry(1.24+i*.12,.035,7,48),gold,0,0,-.04,relief);
 }


 // The authored kit supplies the shop gantries; duplicate legacy struts removed.
 // The acid-eye painting is a world-mounted street mural on a concrete
 // service wall. It never replaces the live scene or covers the playfield.
 if(mural){mural.wrapS=mural.wrapT=THREE.ClampToEdgeWrapping;mural.repeat.set(1,1);
  cube(10.5,5.5,.28,0,12.5,-37.25,stone);
  const painted=add(new THREE.PlaneGeometry(10,5),material(0xffffff,{map:mural,roughness:.88,metalness:.03,emissive:0x334248,emissiveMap:mural,emissiveIntensity:.3}),0,12.5,-37.09);painted.castShadow=false;
  for(const x of [-5.2,5.2]){cube(.14,15.2,.28,x,7.6,-37.25,ink);for(const y of [9.85,12.5,15.15])add(new THREE.CylinderGeometry(.07,.07,.045,6),gold,x,y,-37.05).rotation.x=Math.PI/2;}
  for(const y of [9.85,15.15])cube(10.5,.12,.4,0,y,-37.25,ink);
 }


 if(repairKitURL){onKitStatus('loading');new GLTFLoader().load(repairKitURL,gltf=>{
  try{const model=gltf.scene;model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),materials=new Set();let meshes=0,triangles=0,core=null;
   model.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);o.castShadow=o.receiveShadow=true;if(o.name==='RepairCellCore')core=o;});
   if(size.x>3.001||size.y>.951||size.z>1.201||Math.abs(bounds.min.y)>.01||triangles>20000||materials.size>10||!core)throw Error('Keeper kit exceeded measured envelope/budget or lacks repair core');
   model.rotation.y=0;model.position.set(9,0,8.8);scene.add(model);geometryCount+=meshes;
   repairFallback.forEach(o=>{o.visible=false;});repairDetails.forEach(o=>{o.visible=false;});repairCells.splice(0,repairCells.length,core);
   Object.assign(keeperKit,{loaded:true,meshes,triangles,materials:materials.size,bounds:{width:size.x,height:size.y,depth:size.z,min:bounds.min.toArray(),max:bounds.max.toArray()},corePresent:true});onKitStatus('loaded');
  }catch(error){keeperKit.error=String(error?.message||error);onKitStatus('failed',keeperKit.error);}
 },undefined,error=>{keeperKit.error=String(error?.message||error);onKitStatus('failed',keeperKit.error);});}

 if(storyPropsURL){onStoryStatus('loading');new GLTFLoader().load(storyPropsURL,gltf=>{try{
 const specs=[['KeeperPowerCellCradle',9.75,.95,8.8,0],['CourierMemoryParcel',-16.7,.89,-6,Math.PI/2],['ArchivistSpectralFolio',12.6,1,-29.4,Math.PI]];
 for(const[name,x,y,z,rotation]of specs){const model=gltf.scene.getObjectByName(name);if(!model)throw Error('Missing story prop '+name);model.removeFromParent();model.position.set(0,0,0);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);if(Math.abs(bounds.min.y)>.012)throw Error('Story prop origin drift');model.position.set(x,y,z);model.rotation.y=rotation;scene.add(model);model.traverse(o=>{if(o.isMesh){storyProps.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;o.castShadow=o.receiveShadow=true;}});storyPropRecords.push({name,x,y,z});}
 if(storyProps.triangles>6000)throw Error('Story prop triangle budget exceeded');storyProps.groups=storyPropRecords.length;storyProps.loaded=true;onStoryStatus('loaded');
 }catch(error){storyProps.error=String(error.message||error);onStoryStatus('failed',storyProps.error);}},undefined,error=>{storyProps.error=String(error.message||error);onStoryStatus('failed',storyProps.error);});}
 // A public-return constellation and a personal mirror are alternative, visible chapter consequences.
 const returnStuds=[];for(const side of [-1,1])for(let i=0;i<38;i++){const t=i/37,z=10.5-t*37,x=side*6*Math.min(1,t*8);const stud=add(new THREE.SphereGeometry(.045,6,4),neon[0],x,.035,z);returnStuds.push(stud);}
 const finalBars=[];
 const finalGroup=new THREE.Group();finalGroup.position.set(0,5.8,-33.8);scene.add(finalGroup);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;finalBars.push(rod(new THREE.Vector3(Math.cos(a)*3.4,Math.sin(a)*1.8,0),new THREE.Vector3(Math.cos(a+Math.PI/3)*3.4,Math.sin(a+Math.PI/3)*1.8,0),.025,gold,finalGroup));}
 const mirror=add(new THREE.OctahedronGeometry(.55),jewel,0,0,.2,finalGroup);

 function cloneResidentRig(template){
  const clone=template.clone(true),mapping=new Map();
  const pair=(source,copy)=>{mapping.set(source,copy);source.children.forEach((child,i)=>pair(child,copy.children[i]));};pair(template,clone);
  template.traverse(source=>{if(!source.isSkinnedMesh)return;const copy=mapping.get(source),bones=source.skeleton.bones.map(b=>mapping.get(b));if(bones.some(b=>!b))throw Error('Resident skeleton escaped the creator rig');
   copy.skeleton=new THREE.Skeleton(bones,source.skeleton.boneInverses.map(matrix=>matrix.clone()));copy.bindMatrix.copy(source.bindMatrix);copy.bindMatrixInverse.copy(source.bindMatrixInverse);
  });return clone;
 }
 function residentOutfit(record,actor){
  const parent=record.group,index=record.index,bones=[];actor.traverse(o=>{if(o.isBone)bones.push(o);});
  const aliases={Chest:'spine_03',LeftHand:'hand_l',RightHand:'hand_r'};
  const boneNamed=name=>bones.find(b=>b.name.toLowerCase()===name.toLowerCase())||bones.find(b=>b.name.toLowerCase().endsWith('|'+name.toLowerCase()))||bones.find(b=>b.name.toLowerCase()===aliases[name]?.toLowerCase());
  const chest=boneNamed('Chest'),head=boneNamed('Head'),left=boneNamed('LeftHand'),right=boneNamed('RightHand');if(!chest||!head||!left||!right)throw Error('Resident creator rig is missing Chest/Head/hand attachment bones');
  const coatMaterial=material(index===0?0x171a23:index===1?0x10282a:0x241c31,{roughness:.78,metalness:.18});
  const lapel=index===0?cloth:material(index===1?0x377b75:0x8a3a69,{roughness:.56,metalness:.38});
  const torso=new THREE.Group();parent.add(torso);const outline=[new THREE.Vector2(.22,-.31),new THREE.Vector2(.26,-.26),new THREE.Vector2(.235,.13),new THREE.Vector2(.25,.23),new THREE.Vector2(.18,.27)];
  const coat=add(new THREE.LatheGeometry(outline,14),coatMaterial,0,0,0,torso);coat.scale.z=.65;
  for(const sign of [-1,1]){const flap=cube(.1,.48,.025,sign*.08,0,.158,lapel,torso);flap.rotation.z=sign*.17;}
  const hem=add(new THREE.TorusGeometry(.235,.014,5,28),gold,0,-.29,0,torso);hem.rotation.x=Math.PI/2;hem.scale.y=.65;
  const collar=add(new THREE.TorusGeometry(.15,.025,6,24),lapel,0,.26,0,torso);collar.rotation.x=Math.PI/2;
  const headwear=new THREE.Group();parent.add(headwear);
  if(index===0){add(new THREE.CylinderGeometry(.2,.21,.07,12),copper,0,.14,0,headwear);const brim=add(new THREE.CylinderGeometry(.24,.24,.025,14),gold,0,.1,0,headwear);add(new THREE.SphereGeometry(.18,12,8,0,Math.PI*2,0,Math.PI*.5),cloth,0,.16,0,headwear);add(new THREE.OctahedronGeometry(.035),neon[3],0,.19,.175,headwear);}
  if(index===1){const band=add(new THREE.TorusGeometry(.16,.035,6,24),cloth,0,.05,0,headwear);band.rotation.x=Math.PI/2;const pouch=cube(.25,.32,.1,.18,-.04,.175,wood,torso);pouch.rotation.z=-.12;rod(new THREE.Vector3(-.21,.22,.15),new THREE.Vector3(.2,-.15,.17),.02,gold,torso);}
  if(index===2){for(const x of [-.065,.065]){const lens=add(new THREE.TorusGeometry(.045,.01,5,16),gold,x,.035,.15,headwear);}rod(new THREE.Vector3(-.02,.035,.15),new THREE.Vector3(.02,.035,.15),.008,gold,headwear);const cowl=add(new THREE.TorusGeometry(.19,.06,6,24),lapel,0,-.12,0,headwear);cowl.rotation.x=Math.PI/2;}
  const leftProp=new THREE.Group(),rightProp=new THREE.Group();parent.add(leftProp,rightProp);
  if(index===0){const ring=add(new THREE.TorusGeometry(.12,.024,6,24),copper,0,.04,.04,leftProp);ring.rotation.y=Math.PI/2;rod(new THREE.Vector3(0,-.1,0),new THREE.Vector3(0,.16,0),.018,gold,rightProp);tube([[0,.16,0],[-.055,.21,0],[-.06,.25,0],[0,.2,0],[.06,.25,0],[.055,.21,0],[0,.16,0]],.012,gold,rightProp);}
  if(index===1){cube(.28,.2,.19,0,0,0,wood,leftProp);cube(.025,.22,.21,0,0,0,gold,leftProp);const paper=cube(.2,.014,.26,0,.01,0,stone,rightProp);paper.rotation.z=.2;}
  if(index===2){const cover=cube(.26,.035,.32,0,0,0,lapel,leftProp);cube(.23,.055,.29,0,.035,0,stone,leftProp);const pages=cube(.24,.015,.29,0,.075,0,cloth,leftProp);pages.rotation.z=.15;add(new THREE.CylinderGeometry(.018,.018,.24,6),gold,0,.02,0,rightProp);}
  const bindings=[{bone:chest,node:torso,offset:new THREE.Vector3(0,0,0)},{bone:head,node:headwear,offset:new THREE.Vector3(0,.015,0)},{bone:left,node:leftProp,offset:new THREE.Vector3(0,-.02,.025)},{bone:right,node:rightProp,offset:new THREE.Vector3(0,-.02,.025)}];
  parent.updateMatrixWorld(true);const q=new THREE.Quaternion(),local=new THREE.Quaternion(),position=new THREE.Vector3();parent.getWorldQuaternion(q);q.invert();bindings.forEach(binding=>{binding.inverseRest=q.clone().multiply(binding.bone.getWorldQuaternion(new THREE.Quaternion())).invert();});
  return {bindings:bindings.length,update(){parent.updateMatrixWorld(true);parent.getWorldQuaternion(q);q.invert();for(const binding of bindings){binding.bone.getWorldPosition(position);parent.worldToLocal(position);binding.node.position.copy(position).add(binding.offset);binding.bone.getWorldQuaternion(local);binding.node.quaternion.copy(q).multiply(local).multiply(binding.inverseRest);}}};
 }
 function installResidents(template,skin,idleClip,{preserveMaterials=false}={}){
  if(residentRecords.every(record=>record.actor))return;
  if(!template?.isObject3D||!skin?.isTexture||!idleClip?.tracks?.length){const error='Resident installation needs the actual loaded creator model, skin Texture and named idle clip';npcErrors.push(error);throw Error(error);}
  for(const record of residentRecords){if(record.actor)continue;
   try{const actor=cloneResidentRig(template);actor.scale.multiplyScalar(preserveMaterials?1:1.08);actor.position.multiplyScalar(preserveMaterials?1:1.08);actor.rotation.y=preserveMaterials?Math.PI:actor.rotation.y+Math.PI;
    let bones=0,skins=0,vertices=0;actor.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh){skins++;vertices+=o.geometry.attributes.position.count;}if(o.isMesh){if(!preserveMaterials)o.material=new THREE.MeshStandardMaterial({map:skin,roughness:.78,metalness:0});else {const vary=m=>{const c=m.clone();configureWovenMaterial(c);if(/jacket|cargo|cloth|garment/i.test(c.name))c.color.multiply(new THREE.Color(record.index===0?0xb5c5ca:record.index===1?0xa7d8c7:0xc4b5dc));return c;};o.material=Array.isArray(o.material)?o.material.map(vary):vary(o.material);}o.castShadow=o.receiveShadow=true;}});
    if(bones<20||skins<1)throw Error('Cloned creator resident lost its skeleton or skinned mesh');
    record.group.add(actor);const mixer=new THREE.AnimationMixer(actor),idle=mixer.clipAction(idleClip);idle.play();mixer.update(.18*record.index);const costume=residentOutfit(record,actor);
    record.actor=actor;record.adult=preserveMaterials;record.headBone=null;actor.traverse(o=>{if(o.isBone&&/^(?:.*\|)?head$/i.test(o.name))record.headBone=o;});record.motionClock=record.index*1.7;record.motionBones={};actor.traverse(o=>{if(o.isBone&&['Head','head','upperarm_l','lowerarm_l','upperarm_r','lowerarm_r'].includes(o.name))record.motionBones[o.name]=o;});record.previousMotion=[];record.mixer=mixer;record.costume=costume;record.bones=bones;record.skinnedMeshes=skins;record.vertices=vertices;record.idle=idle.getClip().name;record.fallbackMeshes.forEach(mesh=>{mesh.visible=false;});residentRigInstallCount++;
   }catch(error){const detail=record.id+': '+String(error?.message||error);npcErrors.push(detail);throw Error(detail);}
  }
  if(!ambientResidents)ambientResidents=createAmbientResidents({THREE,scene,template,idleClip,placements:AMBIENT_CITIZENS,seatY:.5,breathing:false});
 }

 return {installResidents,dispose(){ambientResidents?.dispose();},setQuality:q=>streetBays?.setQuality(q),cameraBounds,metrics:{get authoredGeometry(){return geometryCount;},consolidatedBaySources,get baySubmissions(){return streetBays?.snapshot().batches||baySubmissions;},get arcadeBays(){return streetBays?.snapshot()||null;},residents:occupiedResidents,interactiveResidents:RESIDENTS.length,colliders:CITY_COLLIDERS.length,instancedWindows:southWindows.length,originalWovenPattern:true,dimensionalAuroraCurtains:aurora.length,auroraMotion:skyMotion},
  snapshot(){return {ambientResidents:ambientResidents?.metrics||null,storyProps:{...storyProps,placements:storyPropRecords.map(p=>({...p}))},keeperKit:{...keeperKit},npcRigs:{loaded:residentRecords.every(r=>r.actor&&r.skinnedMeshes>0),count:residentRecords.filter(r=>r.actor).length,errors:[...npcErrors],installations:residentRigInstallCount,residents:residentRecords.map(r=>({role:r.id,loaded:Boolean(r.actor),bones:r.bones,skinnedMeshes:r.skinnedMeshes,vertices:r.vertices,idleClip:r.idle||null,motion:{engaged:Boolean(r.motionEngaged),headYaw:r.headYaw||0,bones:Object.keys(r.motionBones||{}).length},skinTextures:r.actor?[...new Set((()=>{const ids=[];r.actor.traverse(o=>{if(o.isSkinnedMesh&&o.material.map)ids.push(o.material.map.uuid);});return ids;})())]:[],costumeBindings:r.costume?.bindings||0}))},repairCellEmission:repairCells.map(o=>o.material.emissiveIntensity),courierSignalEmission:courierSignals.map(o=>o.material.emissiveIntensity),canopyIntensity:canopyLight.intensity,lanternEmission:publicLights.map(o=>o.material.emissiveIntensity),constellationVisible:finalGroup.visible,mirrorVisible:mirror.visible,publicReturnStudsVisible:returnStuds.filter(o=>o.visible).length,constellationBarsVisible:finalBars.filter(o=>o.visible).length,relays:beaconMeshes.map(b=>({id:b.id,emission:b.core.material.emissiveIntensity,rotation:b.core.rotation.y})),markers:markerMeshes.map(r=>({id:r.id,emission:r.mesh.material.emissiveIntensity,x:r.mesh.parent.position.x,z:r.mesh.parent.position.z}))};},
  update(dt,time,sim){
   const state=chapter.state,active=state.active?RESIDENTS[state.completed]?.id:null;
   if(skyMotion)for(const ribbon of aurora){const p=ribbon.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const u=Math.floor(i/2)/48;p.setY(i,ribbon.base[i]+Math.sin(time*.00018+u*8+ribbon.layer)*.75);}p.needsUpdate=true;}

   canopyLight.intensity=state.completed>0?24:2;
   repairCells.forEach(o=>{o.material.emissiveIntensity=state.completed>0?2:.06;});courierSignals.forEach(o=>{o.material.emissiveIntensity=state.completed>=2?1.8:.12;});
   for(const record of residentRecords){
    for(const prior of record.previousMotion||[])prior.bone.quaternion.copy(prior.quaternion);
    record.previousMotion=[];if(record.mixer)record.mixer.update(Math.min(dt,.05)*.65);record.motionClock=(record.motionClock||0)+dt;
    if(record.actor&&record.motionBones){record.actor.updateWorldMatrix(true,true);const point=record.actor.worldToLocal(new THREE.Vector3(sim.x,sim.y+1.5,sim.z)),near=Math.hypot(sim.x-record.group.position.x,sim.z-record.group.position.z)<6,clock=record.motionClock;
     const pose=(name,x,y,z)=>{const bone=record.motionBones[name];if(!bone)return;record.previousMotion.push({bone,quaternion:bone.quaternion.clone()});bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)));};
     const yaw=near?THREE.MathUtils.clamp(Math.atan2(point.x,point.z),-.48,.48):Math.sin(clock*.36)*.1;
     pose(record.motionBones.Head?'Head':'head',Math.sin(clock*.8)*.025,yaw,Math.sin(clock*.6)*.02);
     if(record.index===0){pose('upperarm_l',0,0,.08+Math.sin(clock*1.1)*.035);pose('lowerarm_l',.12+Math.sin(clock*.75)*.06,0,0);}
     else if(record.index===1){pose('upperarm_r',0,Math.sin(clock*.7)*.07,-.08);pose('lowerarm_r',.18+Math.sin(clock*.85)*.08,0,0);}
     else {pose('upperarm_l',0,0,.12);pose('lowerarm_l',.22+Math.sin(clock*.55)*.05,0,0);pose('lowerarm_r',.12+Math.cos(clock*.75)*.04,0,0);}
     record.motionEngaged=near;record.headYaw=yaw;
    }
    if(record.headBone&&!record.adult)record.headBone.scale.setScalar(.78);record.costume?.update();
   }
   for(const item of detailMotion){if(item.type==='cloth')item.group.rotation.z=Math.sin(time*.0007+item.phase)*.045;else item.group.rotation.z=Math.sin(time*.0002)*.08;}
   archiveDisplays.forEach((o,i)=>{o.rotation.z=state.completed>=2?Math.sin(time*.00025+i)*.1:0;});
   publicLights.forEach((o,i)=>{o.material.emissiveIntensity=state.completed>0?1.7:.12;});
   for(const item of markerMeshes){item.mesh.material.emissiveIntensity=item.id===active?2.4:.5;item.mesh.position.y=2.16+Math.sin(time*.0017)*.06;item.mesh.rotation.y=time*.0007;}
   for(const item of beaconMeshes){const visited=relayHasLight(state,item.id);item.core.material.emissiveIntensity=visited?2.8:.22;item.core.rotation.y=time*.0006;}
   for(const item of animated){if(item.type==='loom')item.group.rotation.z=time*.00016;else{const dx=sim.x-item.group.position.x,dz=sim.z-item.group.position.z;if(Math.hypot(dx,dz)<7)item.group.rotation.y=Math.atan2(dx,dz);item.head.position.y=item.baseY+Math.sin(time*.0013+item.index)*.008;}}
   finalGroup.visible=state.completed===3;finalBars.forEach(o=>{o.visible=state.choice==='public';});returnStuds.forEach(o=>{o.visible=state.choice==='public';});mirror.visible=state.choice==='personal';if(state.choice==='public')finalGroup.rotation.z=Math.sin(time*.00015)*.06;
  }
 };
}

// Garment geometry follows the actual rig bones after animation; the stock shirt is covered.
export function dressRider(body,model,themeColors,{adult=false}={}){
 if(adult)return dressAdultRider(body,model,themeColors);
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

function dressAdultRider(body,model,themeColors){
 const bones=[];let weave=null;model.traverse(o=>{if(o.isBone)bones.push(o);if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m.name==='VORATH_original_spectral_woven_yoke')weave=m;});
 const head=bones.find(b=>b.name==='Head'),chest=bones.find(b=>b.name==='spine_03');if(!head||!chest||!weave?.map)throw Error('Adult wardrobe needs actual head/chest bones and authored woven material');
 const shell=new THREE.MeshPhysicalMaterial({color:0x182226,metalness:.7,roughness:.36,clearcoat:.45,iridescence:1,iridescenceThicknessRange:[180,380]}),edge=new THREE.MeshStandardMaterial({color:0xa48448,metalness:.82,roughness:.3}),gem=new THREE.MeshPhysicalMaterial({color:0x65d8cf,metalness:.62,roughness:.2,iridescence:1,clearcoat:1});
 const helmet=new THREE.Group();helmet.name='Adult spectral temple clasps';head.add(helmet);
 for(const x of [-.105,.105]){const temple=new THREE.Mesh(new THREE.BoxGeometry(.011,.024,.039),shell);temple.position.set(x,.04,.018);helmet.add(temple);const inset=new THREE.Mesh(new THREE.BoxGeometry(.012,.004,.019),edge);inset.position.set(x,.045,.025);helmet.add(inset);}
 const mirrorCrest=new THREE.Mesh(new THREE.OctahedronGeometry(.025),gem);mirrorCrest.name='Personal ending mirrored collar crest';mirrorCrest.position.set(.07,.12,.115);chest.add(mirrorCrest);
 const shoulderJewels=[];for(const side of [-1,1])for(const i of [0,1]){const j=new THREE.Mesh(new THREE.OctahedronGeometry(.017),gem);j.name='Courier earned shoulder inlay';j.position.set(side*(.155+i*.025),.085-i*.012,.035);chest.add(j);shoulderJewels.push(j);}
 let count=0;helmet.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;count++;}});count+=shoulderJewels.length+1;
 return{count,boneBound:true,snapshot(){return{vestVisible:true,vestColor:weave.color.getHexString(),vestPatternTexture:weave.map.uuid,helmetColor:shell.color.getHexString(),shoulderJewelsVisible:shoulderJewels.filter(j=>j.visible).length,mirrorCrestVisible:mirrorCrest.visible,chestBone:chest.name,headBone:head.name,wardrobeSource:'adult-skinned-jacket-temple-clasps-and-earned-collar-crest'};},update(completed,theme,choice){weave.color.setHex(completed>0?0xffffff:0xb2a4c5);shell.color.set(themeColors[theme]).multiplyScalar(.24);shoulderJewels.forEach(j=>{j.visible=completed>=2;});mirrorCrest.visible=completed>=3&&choice==='personal';}};
}
