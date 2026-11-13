// Original optional chapter and environmental dressing for the reconstructed room.
// No cast identity is claimed: the other resident is simply the neighbor.
import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';

const KEY='nsp-night-in-light-across-the-hall-v1';
const COLORS=[0xf3b85f,0x58dfc6,0xa47aed];
const PATTERNS=[[2,1,3],[3,2,1],[1,3,2]];
const fresh=(turn=0,archive=[],weaves=[])=>({version:1,turn,archive,weaves:[...weaves],weaveAttempts:0,met:false,letter:false,trace:false,tuned:false,choice:null,delivered:false,dials:[1,1,1],attempts:0,heard:[]});
const copy=x=>JSON.parse(JSON.stringify(x));

export function createChapter({scene,box,cylinder,walnut,gold,black,texture,plaster,lamp,say,note,getState}){
  const neighborStories={
  "before": [
    "The neighbor: “That receiver belonged to the woman who kept this building open on night shifts. Before the windows went dark, she could tell who had made it home by the colors.”",
    "The neighbor: “I kept her prism instead of taking it to the scrap shop. Now I need someone to help me decide whether keeping a memory means using it.”"
  ],
  "letter": [
    "The neighbor: “The lamp is where she used to mend our coats. The beacon is how the workers across the street knew someone was still awake. Neither was just a light.”",
    "The neighbor: “The cell has enough for one circuit. A warm place to sit is a promise too. You do not owe the whole street a performance.”"
  ],
  "trace": [
    "The neighbor: “Amber is the late bus. Teal is the loading dock. Violet is the last room above the laundromat. Count what is there; do not transmit what you wish were there.”",
    "The neighbor: “Crib Static was the record she played while the receiver warmed. We used to complain about the crackle. Funny what silence makes you miss.”"
  ],
  "tuned": [
    "The neighbor: “You repaired the receiver. I thought I wanted the old nights back, but you have made a new one. I will not choose it for you.”",
    "The neighbor: “Keep the hearth and I will bring tea. Answer the street and I will fetch the thick blanket. Just return the prism yourself. I want to know who made the choice.”"
  ],
  "hearth": [
    "The neighbor: “She would have liked you staying. The torn coat can wait. I am glad you stayed. Seven dark windows do not make this small light a failure.”",
    "The neighbor: “I heard a latch across the hall. Leave the spare cup here. A room can become a beacon without anyone seeing it from the street.”"
  ],
  "beacon": [
    "The neighbor: “The violet window answered first. That is the night cleaner. I thought nobody still remembered this signal.”",
    "The neighbor: “Here is the blanket I promised. I used to wonder who lived behind the amber window. An answering light is a small hello.”"
  ]
};
  const heardTopics=new Set(Object.keys(neighborStories));
  let state=fresh(),storageOK=true;
  try{const old=JSON.parse(localStorage.getItem(KEY));if(old?.version===1){state.turn=Number.isInteger(old.turn)?Math.max(0,Math.min(999,old.turn)):0;state.archive=Array.isArray(old.archive)?old.archive.filter(x=>x==='hearth'||x==='beacon').slice(-12):[];for(const k of ['met','letter','trace','tuned','delivered'])state[k]=old[k]===true;state.choice=['hearth','beacon'].includes(old.choice)?old.choice:null;state.dials=Array.isArray(old.dials)&&old.dials.length===3?old.dials.map(n=>Number.isInteger(n)?Math.max(1,Math.min(4,n)):1):[1,1,1];state.attempts=Number.isInteger(old.attempts)?Math.max(0,old.attempts):0;state.heard=Array.isArray(old.heard)?old.heard.filter(x=>heardTopics.has(x?.topic)&&Number.isInteger(x.index)&&x.index>=0&&x.index<neighborStories[x.topic].length).map(x=>({topic:x.topic,index:x.index})).slice(-16):[];state.weaves=Array.isArray(old.weaves)?[...new Set(old.weaves.filter(x=>['first','hearth','beacon'].includes(x)))]:[];state.weaveAttempts=Number.isInteger(old.weaveAttempts)?Math.max(0,Math.min(1000000,old.weaveAttempts)):0;}}catch{}
  const group=new THREE.Group();group.name='The light across the hall — inhabited apartment';scene.add(group);
  const elements=[],lamps=[],clueBeads=[],knobs=[],mailParts=[],props=[];
  let neighbor=null,neighborMixer=null,neighborIdle=null,neighborRun=null,neighborAction=null,neighborPrism=null,neighborMoving=false,focus=null,pulse=0,wrong=0,near=null,paused=false,lastPlayer=null,selectedDial=0;
  const storyEvents=[],previousPad=[],adultHeads=[];
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stations=[{id:'letter',name:'Brass letter slot',x:-4.4,z:2.65},{id:'trace',name:'Window light trace',x:3.5,z:1.7},{id:'receiver',name:'Shortwave workbench',x:-3.6,z:-1.8},{id:'junction',name:'One-cell junction',x:3.5,z:-.2},{id:'neighbor',name:'The neighbor',x:-3.5,z:2.3}];
  const baseSolids=[[-4.5,-2.72,-3.3,-2.4],[2.17,3.73,-3.4,-2.62],[-5.4,-4.7,-1.35,.1],[4.83,5.2,.65,.95],[-5.15,-4.8,2.55,2.85]];
  const metal=new THREE.MeshStandardMaterial({color:0x5b7690,metalness:.86,roughness:.3});
  const enamel=new THREE.MeshStandardMaterial({color:0x172a37,metalness:.3,roughness:.25});
  const copper=new THREE.MeshStandardMaterial({color:0xb56d44,metalness:.78,roughness:.35});
  const cream=new THREE.MeshStandardMaterial({color:0xdbc5a0,roughness:.92,map:plaster});
  const knit=texture((c,n)=>{c.fillStyle='#11272b';c.fillRect(0,0,n,n);for(let row=0;row<18;row++){c.strokeStyle=['#d99643','#257c80','#b5455d','#5079a1','#66538d'][row%5];c.lineWidth=4;for(let x=-30;x<n+30;x+=18){c.beginPath();c.moveTo(x,row*16);c.bezierCurveTo(x+23,row*16-16,x-12,row*16+18,x+18,row*16+12);c.stroke();}}});
  const cloth=new THREE.MeshStandardMaterial({color:0xffffff,map:knit,roughness:1});
  function own(o){group.add(o);elements.push(o);return o;}
  function B(w,h,d,m,x,y,z){return own(box(w,h,d,m,x,y,z));}
  function C(r1,r2,h,m,x,y,z,n=20){return own(cylinder(r1,r2,h,m,x,y,z,n));}
  function mesh(geo,material,x,y,z){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return own(m);}
  function tube(points,radius,material){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),28,radius,6,false),material,0,0,0);}
  function glow(color,intensity,x,y,z){const l=new THREE.PointLight(color,intensity,5,2);l.position.set(x,y,z);group.add(l);lamps.push(l);return l;}
  // Architectural rhythm: fluted lower walls, chair rail, crown, corner piers.
  for(let x=-5.1;x<5.2;x+=.48){B(.026,.88,.024,walnut,x,.55,-3.37);B(.36,.024,.026,gold,x,.14,-3.36);}
  for(let z=-3.1;z<3.5;z+=.48){B(.026,.88,.026,walnut,-5.36,.55,z);}
  B(10.65,.055,.085,gold,0,1.05,-3.34);B(.085,.055,7.1,gold,-5.33,1.05,.1);
  B(10.8,.12,.18,cream,0,3.23,-3.31);B(.18,.12,7.1,cream,-5.31,3.23,.1);
  for(const x of [-5.17,2.65,5.13]){B(.09,3.05,.12,cream,x,1.65,-3.29);B(.2,.12,.2,gold,x,3.02,-3.26);}
  // Tall arched shelving gives the listening corner height and lived-in detail.
  B(.24,2.48,1.35,walnut,-5.1,1.3,-.6);
  for(let y=.35;y<2.85;y+=.55)B(.56,.055,1.4,walnut,-5.05,y,-.6);
  for(let shelf=0;shelf<4;shelf++)for(let i=0;i<8;i++){const h=.22+(i%3)*.055,z=-1.15+i*.135;const m=new THREE.MeshStandardMaterial({color:[0xa84e51,0x356d7b,0x806599,0xba8a52,0x354350][(i+shelf)%5],roughness:.8});B(.23,h,.09,m,-4.97,.52+shelf*.55,z);for(const yy of [-.06,.065])B(.007,.008,.075,gold,-4.84,.52+shelf*.55+yy,z);}
  const arch=new THREE.Shape();arch.moveTo(-.65,0);arch.lineTo(-.65,.5);arch.absarc(0,.5,.65,Math.PI,0,true);arch.lineTo(.65,0);arch.closePath();const archPanel=mesh(new THREE.ShapeGeometry(arch),enamel,-5.065,2.1,-.6);archPanel.rotation.y=Math.PI/2;
  // Hand-worked kitchen: tile joints, cupboard panels, worktop, sink and crockery.
  B(1.4,.78,.68,walnut,2.95,.44,-3.02);B(1.55,.075,.82,new THREE.MeshStandardMaterial({color:0x203d40,roughness:.32,metalness:.2}),2.95,.88,-3.02);
  for(let x=2.3;x<3.7;x+=.2)for(let y=1;y<1.72;y+=.2)B(.185,.185,.025,new THREE.MeshStandardMaterial({color:COLORS[(Math.round(x*10)+Math.round(y*10))%3],roughness:.3}),x,y,-3.385);
  for(const x of [2.58,3.27]){B(.56,.58,.035,enamel,x,.47,-2.65);C(.022,.022,.1,gold,x,.53,-2.61,8).rotation.x=Math.PI/2;}
  const sink=C(.26,.2,.035,metal,2.65,.925,-3.02,32);sink.scale.z=.74;C(.19,.19,.04,black,2.65,.93,-3.02,32).scale.z=.68;
  tube([[2.43,.94,-3.22],[2.43,1.18,-3.22],[2.64,1.2,-3.22],[2.67,1.08,-3.14]],.02,metal);
  C(.14,.14,.025,cream,3.38,.94,-2.96,28);C(.095,.08,.13,copper,3.35,1.02,-2.96);B(.18,.15,.015,new THREE.MeshStandardMaterial({color:0xb76343,roughness:1}),3.7,1.18,-3.37);
  // Hobby desk, etched receiver, cable runs, bench tools and specimen drawers.
  B(1.75,.1,.8,walnut,-3.6,.76,-2.94);for(const x of [-4.3,-2.9])B(.07,.73,.07,metal,x,.36,-2.94);
  B(.95,.45,.33,enamel,-3.58,1.03,-2.82);B(.76,.29,.025,black,-3.58,1.04,-2.64);
  for(let i=0;i<3;i++){const x=-3.87+i*.29,pivot=new THREE.Group();pivot.position.set(x,1,-2.6);own(pivot);const knob=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.06,24),gold);knob.rotation.x=Math.PI/2;pivot.add(knob);const pointer=new THREE.Mesh(new THREE.BoxGeometry(.014,.045,.012),cream);pointer.position.set(0,.028,.036);pivot.add(pointer);knobs.push(pivot);for(let tick=0;tick<4;tick++){const t=tick*Math.PI/2;B(.014,.025,.01,cream,x+Math.cos(t)*.09,1+Math.sin(t)*.09,-2.58);}}
  const receiverLamp=glow(0x58dfc6,1,-3.6,1.23,-2.5);
  for(let i=0;i<5;i++)B(.035,.16,.02,metal,-3.94+i*.08,1.19,-2.61);
  tube([[-3.1,.92,-2.92],[-2.85,.82,-3.28],[-2.55,1.15,-3.3],[-2.5,2.2,-3.3]],.013,copper);
  C(.07,.05,.12,gold,-4.24,.9,-2.83);const screwdriver=B(.015,.015,.29,metal,-4.14,.84,-2.62);screwdriver.rotation.y=.55;
  for(let i=0;i<3;i++){B(.27,.07,.2,walnut,-2.98,.84+i*.07,-3.13);B(.06,.015,.015,gold,-2.98,.84+i*.07,-3.02);}
  // Mail assembly: the folded paper and prism visibly leave the slot on collection.
  B(.5,.26,.11,enamel,-4.45,1.05,3.51);B(.38,.025,.015,black,-4.45,1.08,3.445);
  const letter=B(.26,.16,.012,cream,-4.45,1.06,3.43);letter.rotation.z=.12;mailParts.push(letter);
  const parcel=mesh(new THREE.OctahedronGeometry(.11),new THREE.MeshPhysicalMaterial({color:0x69e1dc,roughness:.12,metalness:.3,clearcoat:1,clearcoatRoughness:.12,iridescence:.7}),-4.25,.13,3.2);mailParts.push(parcel);
  // One physical cell, two exclusive circuits. Choice alters the actual room.
  B(.45,.68,.15,black,5.13,1.45,-.7);B(.37,.59,.045,metal,5.03,1.45,-.7);
  const fuse=C(.045,.045,.22,new THREE.MeshStandardMaterial({color:0x7ce8d3,emissive:0x24876d,emissiveIntensity:.6,roughness:.2}),4.99,1.48,-.7);fuse.rotation.z=Math.PI/2;
  const lever=B(.035,.2,.035,gold,4.93,1.23,-.7);lever.rotation.z=.35;
  const hearthLight=glow(0xffbc66,2,-3.15,1.4,1.6),beaconLight=glow(0x9478ff,0,5.15,2.5,.3);
  tube([[5.1,1.6,-.7],[5.08,2.82,-.7],[5.08,2.82,.3],[5.08,2.52,.3]],.018,copper);
  const beacon=mesh(new THREE.IcosahedronGeometry(.16,0),new THREE.MeshPhysicalMaterial({color:0x74e4e7,metalness:.48,roughness:.15,emissive:0x182940}),5.1,2.5,.3);
  const streetAnswers=[];for(let i=0;i<7;i++){const m=mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:COLORS[i%3]}),7+(i%3)*1.3,.7+Math.floor(i/3)*.6,-1.4+i*.35);streetAnswers.push(m);}
  // Window's three groups are an actual, replayable spatial clue, not a fake HUD.
  for(let color=0;color<3;color++){const a=[];for(let i=0;i<4;i++){const bead=mesh(new THREE.SphereGeometry(.04,10,8),new THREE.MeshStandardMaterial({color:COLORS[color],emissive:COLORS[color],emissiveIntensity:.35,metalness:.5,roughness:.25}),5.22,1.65+i*.12,-.8+color*.63);a.push(bead);}clueBeads.push(a);}
  // A mechanical Loomwheel: interlaced curved vanes, axle, feet, material return.
  const wheel=new THREE.Group();wheel.position.set(5.05,1.7,.8);wheel.rotation.y=Math.PI/2;group.add(wheel);
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;const pts=[];for(let j=0;j<12;j++){const t=j/11,r=.17+.25*t;pts.push(new THREE.Vector3(Math.cos(angle+t*.8)*r,Math.sin(angle+t*.8)*r,Math.sin(t*Math.PI)*.055));}const vane=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),10,.018,5,false),i%3?copper:metal);wheel.add(vane);}
  const wheelRim=new THREE.Mesh(new THREE.TorusGeometry(.43,.025,8,64),gold);wheel.add(wheelRim);C(.11,.11,.025,metal,5.05,1.2,.8);B(.04,.5,.04,copper,5.05,1.45,.8);
  // Personal clutter placed on furniture: woven throw, lamp shade ribs, vinyl,
  // ceramics, paper slips, a pair of house shoes and a bright coat by the door.
  const throwBlanket=B(.86,.035,1.08,cloth,-4.04,.88,.02);throwBlanket.rotation.z=-.08;
  for(let i=0;i<10;i++)tube([[-4.4+i*.07,.9,.55],[-4.4+i*.07,.72,.7],[-4.4+i*.07,.58,.72]],.012,i%2?copper:cream);
  for(let i=0;i<6;i++){const sleeve=B(.24,.27,.018,new THREE.MeshStandardMaterial({color:COLORS[i%3],roughness:.85}),-.15+i*.035,.8,-3.12);sleeve.rotation.z=-.1+i*.035;}
  for(let i=0;i<5;i++){const bottle=C(.035,.055,.17,new THREE.MeshPhysicalMaterial({color:[0x2c7b65,0x5e4a8b,0x8d592d][i%3],roughness:.15,metalness:.15,transparent:true,opacity:.8}),4.93,1.03,.4+i*.16);C(.022,.022,.07,gold,bottle.position.x,1.15,bottle.position.z);}
  for(const x of [-4.7,-4.45]){const shoe=mesh(new THREE.CapsuleGeometry(.075,.13,4,8),new THREE.MeshStandardMaterial({color:0xa46870,roughness:1}),x,.075,2.2);shoe.rotation.x=Math.PI/2;}
  C(.025,.025,1.65,copper,-4.95,.85,2.7);for(const z of [-.12,.12]){const hook=B(.24,.02,.03,gold,-4.95,1.57,2.7+z);hook.rotation.z=.2;}
  const coat=mesh(new THREE.ConeGeometry(.25,.7,8,1,true),cloth,-4.95,1.2,2.7);coat.scale.z=.5;
  // Original painted artwork is a finite, grouted ceramic mosaic, not wallpaper
  // or a replacement for the room. Its source was separately inspected by root.
  let mosaicLoaded=false;const assetErrors=[];
  const mosaicMaterial=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.32,clearcoat:.35,metalness:.12});
  new THREE.TextureLoader().load('../crib-recovered-assets/vorath-eye-mosaic-v1.png',t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;mosaicMaterial.map=t;mosaicMaterial.needsUpdate=true;mosaicLoaded=true;},undefined,()=>{assetErrors.push('vorath-eye-mosaic-v1.png');console.error('Night In: mosaic texture failed to load');});
  B(1.31,1.31,.055,black,3.15,2.37,-3.33);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const geometry=new THREE.PlaneGeometry(.153,.153),uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i))/8,(y+uv.getY(i))/8);mesh(geometry,mosaicMaterial,2.6+x*.157,1.82+y*.157,-3.29+(x+y)%3*.002);}
  for(const x of [2.51,3.79])B(.035,1.32,.035,gold,x,2.37,-3.27);for(const y of [1.73,3.01])B(1.32,.035,.035,gold,3.15,y,-3.27);
  const stationMarkers=[];for(const p of stations){const ring=mesh(new THREE.TorusGeometry(.23,.01,6,32),new THREE.MeshBasicMaterial({color:0x7cdaca,transparent:true,opacity:.35}),p.x,.035,p.z);ring.rotation.x=-Math.PI/2;stationMarkers.push(ring);}
  const handPrism=new THREE.Mesh(new THREE.OctahedronGeometry(.085),new THREE.MeshPhysicalMaterial({color:0x7ee8d2,metalness:.3,roughness:.15,emissive:0x294e59}));
  handPrism.position.set(.29,.8,.15);handPrism.visible=false;

  // Merge fixed dressing by shared material; dynamic clue/choice objects remain
  // separate. Hundreds of crafted pieces need not cost hundreds of draw calls.
  const dynamic=new Set([...knobs,...mailParts,...streetAnswers,...clueBeads.flat(),...stationMarkers,lever,beacon,throwBlanket]);
  const authoredStaticMeshes=group.children.filter(o=>o.isMesh&&!dynamic.has(o));
  const buckets=new Map();for(const o of authoredStaticMeshes){if(Array.isArray(o.material)||!o.geometry.attributes.normal||!o.geometry.attributes.uv)continue;const list=buckets.get(o.material)||[];list.push(o);buckets.set(o.material,list);}
  let staticBatches=0;
  for(const [material,objects]of buckets){if(objects.length<2)continue;const positions=[],normals=[],uvs=[];
    for(const o of objects){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,normalMatrix=new THREE.Matrix3().getNormalMatrix(o.matrix),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrix);positions.push(v.x,v.y,v.z);v.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();normals.push(v.x,v.y,v.z);uvs.push(u.getX(i),u.getY(i));}group.remove(o);if(g!==o.geometry)g.dispose();o.geometry.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();const batch=new THREE.Mesh(geometry,material);batch.name='Crafted room static batch';batch.castShadow=true;batch.receiveShadow=true;group.add(batch);staticBatches++;
  }


  // Return Loom: a physical memory instrument close to the starting path.
  // Metal, inset light studs and warped aurora leaves are actual 3D surfaces.
  // No transmission or additional cube captures: keep the existing render tier.
  const loomPoint={x:2,z:2.6},loomLamps=[],loomLeaves=[],LOOM_COLORS=[0xff2c98,0x74ff36,0x19e2ff];
  let loomNear=false,loomPhase='idle',loomClock=0,loomInput=[],loomRenderKey='';
  const weavePatterns={first:[0,1,2],hearth:[2,0,1,0],beacon:[1,2,0,2]};
  const weaveNames={first:'First thread',hearth:'Shared hearth',beacon:'Street answer'};
  const loomRoot=new THREE.Group();loomRoot.name='Return Loom — playable memory instrument';group.add(loomRoot);
  function loomMesh(geometry,material,x,y,z){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.receiveShadow=true;loomRoot.add(o);return o;}
  const loomBrass=new THREE.MeshStandardMaterial({color:0x756b53,metalness:.91,roughness:.38});
  const loomInk=new THREE.MeshStandardMaterial({color:0x0c1115,metalness:.83,roughness:.48});
  const bridge=loomMesh(new THREE.BoxGeometry(1.06,.07,.32),loomInk,2.78,.58,2.57);
  for(let i=0;i<3;i++){
    const m=new THREE.MeshStandardMaterial({color:LOOM_COLORS[i],emissive:LOOM_COLORS[i],emissiveIntensity:.22,metalness:.56,roughness:.18});
    const o=loomMesh(new THREE.OctahedronGeometry(.085,0),m,2.4+i*.37,.68,2.55);loomLamps.push(o);
    const socket=loomMesh(new THREE.TorusGeometry(.095,.018,6,18),loomBrass,o.position.x,.63,2.55);socket.rotation.x=Math.PI/2;
    for(let n=0;n<=i;n++)loomMesh(new THREE.SphereGeometry(.012,6,4),loomBrass,o.position.x-.025+i*-.012+n*.025,.735,2.55);
  }
  const loomMarker=loomMesh(new THREE.TorusGeometry(.29,.014,6,32),new THREE.MeshBasicMaterial({color:0xf1bd67,transparent:true,opacity:.5}),loomPoint.x,.035,loomPoint.z);loomMarker.rotation.x=Math.PI/2;

  const guardFrame=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),loomInk,4);loomRoot.add(guardFrame);
  const guardParts=[[[.07,.95,.09],[2.22,1.04,2.94]],[[.07,.95,.09],[3.48,1.04,2.94]],[[1.32,.09,.1],[2.85,1.49,2.94]],[[1.32,.08,.1],[2.85,.57,2.94]]];
  const frameDummy=new THREE.Object3D();guardParts.forEach(([size,p],i)=>{frameDummy.position.set(...p);frameDummy.scale.set(...size);frameDummy.updateMatrix();guardFrame.setMatrixAt(i,frameDummy.matrix);});guardFrame.instanceMatrix.needsUpdate=true;
  const loomCable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.23,.66,2.59),new THREE.Vector3(2.23,1.51,2.91),new THREE.Vector3(3.47,1.51,2.91)]),18,.012,6,false),new THREE.MeshStandardMaterial({color:0x1ee8dc,emissive:0x0d756c,emissiveIntensity:1.2,metalness:.35,roughness:.18}));loomRoot.add(loomCable);
  // A chain-hung signal crown has welded ribs, a pivot and jagged metal leaves.
  const returnMobile=new THREE.Group();returnMobile.name='Earned iridescent return canopy';returnMobile.position.set(1.45,2.8,1.94);loomRoot.add(returnMobile);
  for(const radius of [.29,.49]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.014,6,40),loomBrass);ring.rotation.x=Math.PI/2;returnMobile.add(ring);}
  const suspension=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.33,6),loomBrass);suspension.position.y=.28;returnMobile.add(suspension);

  const crownRibs=new THREE.InstancedMesh(new THREE.BoxGeometry(.045,.045,.67),loomInk,6);returnMobile.add(crownRibs);const crownDummy=new THREE.Object3D();for(let i=0;i<6;i++){const a=i*Math.PI/3;crownDummy.position.set(Math.sin(a)*.24,0,Math.cos(a)*.24);crownDummy.rotation.y=a;crownDummy.updateMatrix();crownRibs.setMatrixAt(i,crownDummy.matrix);}crownRibs.instanceMatrix.needsUpdate=true;
  const chain=new THREE.InstancedMesh(new THREE.TorusGeometry(.025,.008,5,10),loomBrass,7);returnMobile.add(chain);for(let i=0;i<7;i++){crownDummy.position.set(0,.07+i*.05,0);crownDummy.rotation.set(0,i%2?Math.PI/2:0,0);crownDummy.updateMatrix();chain.setMatrixAt(i,crownDummy.matrix);}chain.instanceMatrix.needsUpdate=true;
  const gemGeometry=new THREE.OctahedronGeometry(.12,0);
  const gemMaterial=new THREE.MeshPhysicalMaterial({color:0x899a97,metalness:.9,roughness:.3,iridescence:1,iridescenceIOR:1.34,iridescenceThicknessRange:[140,420],clearcoat:1});
  const gems=new THREE.InstancedMesh(gemGeometry,gemMaterial,12);gems.instanceMatrix.setUsage(THREE.StaticDrawUsage);returnMobile.add(gems);
  const temp=new THREE.Object3D();for(let i=0;i<12;i++){const a=i*Math.PI/6;temp.position.set(Math.cos(a)*.39,Math.sin(a*2)*.1-.18,Math.sin(a)*.39);temp.rotation.set(.2,a,.2);temp.scale.set(.5,1.4,.7);temp.updateMatrix();gems.setMatrixAt(i,temp.matrix);gems.setColorAt(i,new THREE.Color(LOOM_COLORS[i%3]));}
  gems.instanceMatrix.needsUpdate=true;if(gems.instanceColor)gems.instanceColor.needsUpdate=true;gems.visible=false;
  // Curved metal/aurora strips carry real parallax and environment reflections.
  for(let color=0;color<3;color++){
    const positions=[],uv=[];for(let n=0;n<=24;n++){const t=n/24,a=t*Math.PI*1.5+color*2.1;for(const side of [-1,1]){positions.push(Math.cos(a)*(.19+side*.045),-.12-t*.67,Math.sin(a)*(.19+side*.045));uv.push(side===-1?0:1,t);}}
    const indices=[];for(let n=0;n<24;n++){const i=n*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const leaf=new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color:LOOM_COLORS[color],metalness:.93,roughness:.22,iridescence:1,clearcoat:.8,side:THREE.DoubleSide}));returnMobile.add(leaf);leaf.visible=false;loomLeaves.push(leaf);
  }
  const threadRoutes={first:[[2,2.6],[-.4,2.45],[-2.2,2.25],[-4.2,2.2]],hearth:[[2,2.6],[.6,1.9],[-1.2,1.5],[-2.25,1.6]],beacon:[[2,2.6],[2.8,2.9],[3.6,3.02],[4.45,2.75]]},floorThreads={};
  for(const [key,points]of Object.entries(threadRoutes)){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.026,z)));
    const material=new THREE.MeshStandardMaterial({color:key==='hearth'?0xc1f44a:key==='beacon'?0xff2a98:0x66efb4,emissive:key==='hearth'?0x493519:key==='beacon'?0x35204b:0x173c35,emissiveIntensity:.8,metalness:.75,roughness:.25});
    const links=new THREE.InstancedMesh(new THREE.TorusGeometry(.055,.014,5,10),material,64);links.name='Earned '+key+' floor braid';loomRoot.add(links);floorThreads[key]=links;links.visible=false;
    for(let i=0;i<64;i++){const t=i/63,p=curve.getPoint(t),tangent=curve.getTangent(t);temp.position.copy(p);temp.rotation.set(Math.PI/2,0,Math.atan2(tangent.z,tangent.x)+(i%2?.36:-.36));temp.scale.set(1,.65,1);temp.updateMatrix();links.setMatrixAt(i,temp.matrix);}links.instanceMatrix.needsUpdate=true;
  }


  // Five real sockets mirror the original rituals; this never grants a goal.
  const ritualSockets=[],ritualGoals=['snack','record','rest','breathe','arcade'];
  const ritualMarks=new THREE.InstancedMesh(new THREE.SphereGeometry(.009,5,4),loomBrass,15);loomRoot.add(ritualMarks);const markDummy=new THREE.Object3D();let markIndex=0;
  const ritualPlate=loomMesh(new THREE.BoxGeometry(.28,1.43,.065),loomInk,-4.88,1.72,3.23);ritualPlate.name='Doorframe five-ritual signal tracker';
  for(let i=0;i<ritualGoals.length;i++){
    const y=2.23-i*.25,color=[0x74ff36,0xff2c98,0xffa026,0x19e2ff,0xdfff57][i];
    const socket=loomMesh(new THREE.TorusGeometry(.078,.016,6,16),loomBrass,-4.88,y,3.28);
    const pin=loomMesh(new THREE.CylinderGeometry(.054,.054,.028,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.025,metalness:.62,roughness:.28}),-4.88,y,3.28);pin.rotation.x=Math.PI/2;
    for(let mark=0;mark<=i;mark++){markDummy.position.set(-4.94+mark*.025,y-.097,3.27);markDummy.updateMatrix();ritualMarks.setMatrixAt(markIndex++,markDummy.matrix);}
    ritualSockets.push({goal:ritualGoals[i],pin,socket});
  }
  ritualMarks.instanceMatrix.needsUpdate=true;
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}}
  function commit(action){note('chapter',action);storyEvents.push({action,atNightSeconds:getState().elapsed,turn:state.turn});if(storyEvents.length>50)storyEvents.shift();persist();renderJournal();}

  function loomMode(){return state.delivered&&['hearth','beacon'].includes(state.choice)?state.choice:'first';}
  function renderLoom(){
    const status=document.getElementById('loomStatus');if(!status)return;const mode=loomMode(),pattern=weavePatterns[mode],disabled=paused||getState().over||!loomNear;
    const key=[loomPhase,loomInput.length,Math.floor(loomClock/.7),mode,disabled,state.weaves.join('|'),state.weaveAttempts].join(':');if(key===loomRenderKey)return;loomRenderKey=key;
    const closed=getState().over;
    status.textContent=closed?'Start a new night to use the loom. Your woven lights stay.':!loomNear?'A three-stud instrument waits beside the starting path. Walk to its amber floor ring.':loomPhase==='watch'?'Watch channel '+(pattern[Math.max(0,Math.min(pattern.length-1,Math.floor(loomClock/.7)))]+1)+' · '+Math.min(pattern.length,Math.max(1,Math.floor(loomClock/.7)+1))+' / '+pattern.length:loomPhase==='input'?'Your turn · '+loomInput.length+' / '+pattern.length+' threads':loomPhase==='done'?weaveNames[mode]+' woven. Look up, then follow the floor braid.':'Listen to the wheel, then answer its order.';
    document.getElementById('loomListen').disabled=disabled;
    for(let i=0;i<3;i++)document.getElementById('loom'+i).disabled=disabled||loomPhase!=='input';
    document.getElementById('loomProgress').textContent=state.weaves.length?'Woven into this room: '+state.weaves.map(x=>weaveNames[x]).join(' · '):'A correct return opens a chain-hung signal crown and inlays a live route to the letter slot.';
  }
  function listenLoom(){
    if(paused||getState().over||!loomNear)return false;
    loomPhase='watch';loomClock=0;loomInput=[];focusOn('loom');loomRenderKey='';renderLoom();
    say(state.delivered?'The neighbor turns the old wheel toward '+(state.choice==='hearth'?'the shared hearth':'the answering street')+'. Watch its studs, then weave the order back.':'The wheel has three studs: one, two, three. Watch them brighten, then return their order. No circuit needs repairing first.');
    commit('loom-listen-'+loomMode());return true;
  }
  function cancelLoom(){if(loomPhase!=='watch'&&loomPhase!=='input')return false;loomPhase='idle';loomInput=[];loomClock=0;loomRenderKey='';renderLoom();say('The wheel is waiting. Listen again whenever you want.');return true;}
  function weave(symbol){
    if(!Number.isInteger(symbol)||symbol<0||symbol>2||paused||getState().over||!loomNear||loomPhase!=='input')return false;
    const mode=loomMode(),pattern=weavePatterns[mode];loomFeedback=symbol;loomFeedbackTime=.3;
    if(symbol!==pattern[loomInput.length]){state.weaveAttempts++;loomInput=[];loomPhase='watch';loomClock=-.65;loomWrongTime=.5;say('The thread slips. Nothing is lost. The wheel repeats its real light sequence; try the order again.');commit('loom-retry-'+mode);return false;}
    loomInput.push(symbol);
    if(loomInput.length===pattern.length){if(!state.weaves.includes(mode))state.weaves.push(mode);loomPhase='done';focusOn('loom-return');say(mode==='first'?'Your first thread holds. The suspended signal crown opens overhead; a live braid cuts across the floor to the folded letter. The room has something new to remember.':mode==='hearth'?'A live braid reaches the listening corner. The signal crown takes an acid-gold edge. Your quiet choice left a route someone else can follow.':'The street answer cuts a magenta route to the window. The suspended vanes catch its edge. Someone else can find their way to this light.');commit('loom-woven-'+mode);}else{commit('loom-thread-'+symbol);}
    loomRenderKey='';renderLoom();return true;
  }
  let loomFeedback=-1,loomFeedbackTime=0,loomWrongTime=0;
  function updateLoom(dt,player){
    loomNear=Math.hypot(player.x-loomPoint.x,player.z-loomPoint.z)<1.15;
    if(!loomNear&&(loomPhase==='watch'||loomPhase==='input')){loomPhase='idle';loomInput=[];loomClock=0;loomRenderKey='';}
    const mode=loomMode(),pattern=weavePatterns[mode];
    if(!paused&&!getState().over){loomFeedbackTime=Math.max(0,loomFeedbackTime-dt);loomWrongTime=Math.max(0,loomWrongTime-dt);if(loomNear&&loomPhase==='watch'){loomClock+=dt;if(loomClock>=pattern.length*.7+.3){loomPhase='input';loomInput=[];loomRenderKey='';}}}
    let lit=-1;if(loomPhase==='watch'&&loomClock>=0&&loomClock% .7<.46){const step=Math.floor(loomClock/.7);if(step<pattern.length)lit=pattern[step];}else if(loomPhase==='input'&&loomFeedbackTime>0)lit=loomFeedback;
    for(let i=0;i<3;i++){loomLamps[i].material.emissive.setHex(loomWrongTime>0?0xff6e58:LOOM_COLORS[i]);loomLamps[i].material.emissiveIntensity=loomWrongTime>0?1.5:lit===i?3.2:.22;loomLamps[i].scale.setScalar(!reduceMotion&&lit===i?1.18:1);}
    loomMarker.material.opacity=loomNear?.8:.35;
    const earned=state.weaves.length>0;gems.visible=earned;for(const leaf of loomLeaves)leaf.visible=earned;
    for(const [key,links]of Object.entries(floorThreads))links.visible=state.weaves.includes(key);
    gemMaterial.color.setHex(state.weaves.includes('beacon')?0xe24aee:state.weaves.includes('hearth')?0xb6e860:0x88c2bd);
    if(!paused&&!reduceMotion){returnMobile.rotation.y=Math.sin(pulse*.22)*.18;for(let i=0;i<loomLeaves.length;i++)loomLeaves[i].rotation.y=Math.sin(pulse*.35+i)*.12;}
    const goals=getState().goals;for(const r of ritualSockets){const on=goals[r.goal]===true;r.pin.material.emissiveIntensity=on?2.2:.025;r.pin.position.z=on?3.315:3.28;r.socket.rotation.z=on?Math.PI/5:0;}
    renderLoom();
  }

  function hint(){if(state.delivered)return state.choice==='hearth'?'A warm room, shared. The window remembers the signal you did not send.':'The street answered. The room is cooler, but the neighbor brought a blanket.';if(!state.letter)return 'Someone slipped a letter under the door. Meet the neighbor or inspect the brass slot.';if(!state.trace)return 'The letter asks you to read three colors in the window glass.';if(!state.tuned)return 'Choose Crib Static on the record player. Then set the workbench dials to the window trace.';if(!state.choice)return 'The signal is clear. One cell can feed the hearth lamp or the street beacon. Choose at the junction.';return 'Bring the prism back to the neighbor. A choice needs a human return.';}
  function renderJournal(){const journal=document.getElementById('chapterJournal');if(!journal)return;journal.replaceChildren();const rows=[['Letter',state.letter?'A single cell. A borrowed prism. “Leave a light for someone.”':'Not collected'],['Window trace',state.trace?`Amber ${PATTERNS[state.turn%3][0]} · teal ${PATTERNS[state.turn%3][1]} · violet ${PATTERNS[state.turn%3][2]}`:'Not observed'],['Receiver',state.tuned?'Crib Static answered. The receiver is repaired.':`${state.dials.join(' / ')} · ${state.attempts} attempted transmissions`],['Circuit',state.choice==='hearth'?'Hearth selected':state.choice==='beacon'?'Street beacon selected':'Undecided'],['Return',state.delivered?'Prism returned. Chapter closed.':'The neighbor is waiting']];for(const memory of state.heard)rows.push(['The neighbor remembers',neighborStories[memory.topic][memory.index]]);for(const [name,value]of rows){const li=document.createElement('li'),b=document.createElement('b');b.textContent=name+' · ';li.append(b,document.createTextNode(value));journal.append(li);}document.getElementById('chapterHint').textContent=hint();document.getElementById('chapterStatus').textContent=state.delivered?'CHAPTER CLOSED':`${[state.letter,state.trace,state.tuned,!!state.choice,state.delivered].filter(Boolean).length} / 5 discoveries`;document.getElementById('chapterReplay').hidden=!state.delivered;document.getElementById('dialReadout').textContent=state.dials.join(' / ');document.getElementById('chapterArchive').textContent=state.archive.length?'Remembered endings: '+state.archive.map(x=>x==='hearth'?'Hearth':'Beacon').join(' · '):'Both endings are playable. Your choices persist across new nights.';renderLoom();}
  function focusOn(id){focus={id,time:5};}
  function listenToNeighbor(){
    const topic=state.delivered&&neighborStories[state.choice]?state.choice:state.tuned?'tuned':state.trace?'trace':state.letter?'letter':'before';
    const lines=neighborStories[topic],previous=state.heard.filter(x=>x.topic===topic).length,index=Math.min(previous,lines.length-1);
    if(!state.heard.some(x=>x.topic===topic&&x.index===index))state.heard.push({topic,index});
    say(lines[index]);
  }
  function interact(){if(paused||getState().over)return false;if(!near){if(loomNear)return listenLoom();say('Approach the Return Loom near the starting path, or a teal story ring.');return false;}focusOn(near.id);switch(near.id){case'neighbor':state.met=true;if(!state.letter)listenToNeighbor();else if(state.choice&&!state.delivered){state.delivered=true;state.archive.push(state.choice);state.archive=state.archive.slice(-12);say(state.choice==='hearth'?'You return the prism. The neighbor stays. The lamp warms the listening corner; the street stays dark. A small repair, shared.':'You return the prism. Seven windows answer your beacon. The neighbor lends the room a blanket. You chose to be seen together.');}else listenToNeighbor();break;case'letter':state.letter=true;say('A folded repair note: “She kept the night-shift windows talking when the lifts failed. Crib Static carries her signal. Read the glass, repair the receiver, and choose one circuit. Keep the prism only long enough to bring its light back to someone.”');break;case'trace':if(!state.letter){say('Three groups of colored glints. There may be a reason to count them.');break;}state.trace=true;say('Window trace recorded: '+PATTERNS[state.turn%3].join(' / ')+'. The glass is a memory, not a warning.');break;case'receiver':say(state.tuned?'The receiver is repaired. Choose a circuit at the junction.':'Turn the three dials below, then Send signal. The record player must be on Crib Static.');break;case'junction':say(state.tuned?'One cell. Choose Hearth or Beacon below. You can change it until you return the prism.':'The cell is seated, but the receiver has no clear signal yet.');break;}commit('inspect-'+near.id);return true;}
  function dial(index){if(paused||getState().over||near?.id!=='receiver'||state.tuned)return;state.dials[index]=state.dials[index]%4+1;commit('dial-'+index);}
  function tune(){if(paused||getState().over||near?.id!=='receiver'||state.tuned)return;if(!state.letter||!state.trace){say('Collect the letter and read the window before transmitting.');return;}if(getState().track!==1){say('The note names Crib Static. Choose that record first.');return;}state.attempts++;if(state.dials.every((n,i)=>n===PATTERNS[state.turn%3][i])){state.tuned=true;say('The needle settles. Two circuits wake: one room, or seven far windows. Choose at the junction.');}else{wrong=1.5;say('The needle falls back. Compare the three colored counts in your journal.');}commit('transmit');}
  function choose(choice){if(paused||getState().over||near?.id!=='junction'||!state.tuned||state.delivered)return;state.choice=choice;say(choice==='hearth'?'The room takes the cell. The beacon goes dark. Return the prism to the neighbor to keep this choice.':'The beacon takes the cell. The warm lamp fades. Return the prism to the neighbor to keep this choice.');commit('choose-'+choice);}
  function bind(){document.getElementById('investigate').onclick=interact;for(let i=0;i<3;i++)document.getElementById('dial'+i).onclick=()=>dial(i);document.getElementById('sendSignal').onclick=tune;document.getElementById('chooseHearth').onclick=()=>choose('hearth');document.getElementById('chooseBeacon').onclick=()=>choose('beacon');document.getElementById('chapterReplay').onclick=()=>{if(!state.delivered||paused)return;state=fresh((state.turn+1)%1000,state.archive,state.weaves);loomPhase='idle';loomClock=0;loomInput=[];loomRenderKey='';say('The same chapter, a different trace. The neighbor has left another folded note. Start a new night if midnight has passed.');commit('replay');};document.getElementById('loomListen').onclick=()=>{listenLoom();document.getElementById('stage')?.focus({preventScroll:true});};for(let i=0;i<3;i++)document.getElementById('loom'+i).onclick=()=>{weave(i);document.getElementById('stage')?.focus({preventScroll:true});};renderJournal();}

  function wardrobe(skin,neighborSkin=false){const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(skin.image,0,0,1024,1024);ctx.save();ctx.beginPath();ctx.rect(0,490,640,510);ctx.clip();ctx.fillStyle=neighborSkin?'#101018':'#080c10';ctx.fillRect(0,490,640,510);for(let row=0;row<19;row++){ctx.strokeStyle=(neighborSkin?['#466259','#8a2868','#8f8c3f','#274e56']:['#883f30','#9aa844','#188c87','#80276d','#365d70'])[row%(neighborSkin?4:5)];ctx.lineWidth=12;for(let x=-90;x<720;x+=92){ctx.beginPath();ctx.moveTo(x,500+row*28);ctx.bezierCurveTo(x+65,465+row*28,x+18,545+row*28,x+98,516+row*28);ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#111a25';ctx.stroke();ctx.lineWidth=12;}}ctx.fillStyle='#0e1922';ctx.fillRect(300,490,24,510);ctx.fillStyle='#ba9565';ctx.fillRect(310,490,3,510);ctx.restore();ctx.fillStyle=neighborSkin?'#404058':'#192b32';ctx.fillRect(640,765,384,259);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;return t;}
  function accessories(parent,isNeighbor){const scarf=new THREE.Group();scarf.position.set(0,1.15,.03);const material=new THREE.MeshStandardMaterial({map:knit,color:isNeighbor?0x8785d9:0xf2b07a,roughness:.95});const collar=new THREE.Mesh(new THREE.TorusGeometry(.17,.055,8,24),material);collar.rotation.x=Math.PI/2;scarf.add(collar);const tail=new THREE.Mesh(new THREE.BoxGeometry(.12,.35,.035),material);tail.position.set(.12,-.15,.17);tail.rotation.z=-.18;scarf.add(tail);parent.add(scarf);const satchel=new THREE.Mesh(new THREE.BoxGeometry(.22,.26,.1),new THREE.MeshStandardMaterial({color:isNeighbor?0x6f4e42:0x294c58,roughness:.7,metalness:.12}));satchel.position.set(.25,.72,.02);parent.add(satchel);const strap=new THREE.Mesh(new THREE.BoxGeometry(.035,.64,.025),copper);strap.position.set(.08,.97,.18);strap.rotation.z=-.4;parent.add(strap);props.push(scarf,satchel,strap);}
  function cloneRig(source){const target=source.clone(true),map=new Map();function pair(a,b){map.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}pair(source,target);source.traverse(o=>{if(o.isSkinnedMesh){const m=map.get(o);m.skeleton=o.skeleton.clone();m.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));m.bindMatrix.copy(o.bindMatrix);m.bindMatrixInverse.copy(o.bindMatrixInverse);}});return target;}
  function installResident(model,skin,idleClip,resident,runClip){
    const residentTex=wardrobe(skin,false);
    model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=residentTex;o.material.needsUpdate=true;}});
    accessories(resident,false);resident.add(handPrism);
    const modelCopy=cloneRig(model),neighborTex=wardrobe(skin,true);
    modelCopy.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=neighborTex;o.material.needsUpdate=true;o.castShadow=true;}});
    neighbor=new THREE.Group();neighbor.name='Adult neighbor — original unnamed supporting role';neighbor.add(modelCopy);neighbor.scale.setScalar(.96);neighbor.position.set(-3.65,0,2.95);neighbor.rotation.y=.4;
    accessories(neighbor,true);neighborPrism=new THREE.Mesh(handPrism.geometry,handPrism.material.clone());neighborPrism.position.set(-.28,.8,.16);neighborPrism.visible=false;neighbor.add(neighborPrism);group.add(neighbor);
    neighborMixer=new THREE.AnimationMixer(modelCopy);neighborIdle=neighborMixer.clipAction(idleClip);neighborRun=runClip?neighborMixer.clipAction(runClip):neighborIdle;neighborIdle.play();neighborAction=neighborIdle;
    for(const rig of [model,modelCopy]){const head=rig.getObjectByName('Head');if(head)adultHeads.push(head);}
  }
  function gamepad(pad){if(!pad)return;const pressed=i=>pad.buttons[i]?.pressed&&!previousPad[i];if(!paused&&!getState().over){if(pressed(2))interact();if(loomNear&&!near){if(pressed(14))weave(0);if(pressed(12))weave(1);if(pressed(15))weave(2);if(pressed(13))listenLoom();if(pressed(1))cancelLoom();}else if(near?.id==='receiver'&&!state.tuned){if(pressed(14))selectedDial=(selectedDial+2)%3;if(pressed(15))selectedDial=(selectedDial+1)%3;if(pressed(12))dial(selectedDial);if(pressed(3))tune();}else if(near?.id==='junction'&&state.tuned){if(pressed(14))choose('hearth');if(pressed(15))choose('beacon');}}for(let i=0;i<pad.buttons.length;i++)previousPad[i]=pad.buttons[i].pressed;}
  function update(dt,time,player,isPaused,pad){
    paused=isPaused;
    if(lastPlayer&&Math.hypot(player.x-lastPlayer.x,player.z-lastPlayer.z)>.002)focus=null;
    lastPlayer={x:player.x,z:player.z};
    const isBeacon=state.choice==='beacon';
    if(neighbor){
      const destination=state.delivered?(isBeacon?new THREE.Vector3(4.45,0,2.75):new THREE.Vector3(-2.25,0,1.6)):new THREE.Vector3(-3.65,0,2.95);
      neighborMoving=neighbor.position.distanceTo(destination)>.06;
      if(!paused)neighbor.position.lerp(destination,Math.min(1,dt*.75));
      if(state.met)neighbor.rotation.y=Math.atan2(player.x-neighbor.position.x,player.z-neighbor.position.z);
      const station=stations.find(p=>p.id==='neighbor');station.x=neighbor.position.x;station.z=neighbor.position.z-.55;
      const marker=stationMarkers[4];marker.position.set(station.x,.035,station.z);
    }
    near=null;let distance=1.15;
    for(const p of stations){const d=Math.hypot(player.x-p.x,player.z-p.z);if(d<distance){near=p;distance=d;}}
    if(!paused){pulse+=dt;wrong=Math.max(0,wrong-dt);if(focus)focus.time-=dt;if(focus?.time<=0)focus=null;if(neighborMixer){const action=neighborMoving?neighborRun:neighborIdle;if(action!==neighborAction){neighborAction.fadeOut(.25);action.reset().fadeIn(.25).play();neighborAction=action;}neighborMixer.update(dt);}}
    // The source rig is stylized; reduce its large stock head silhouette for
    // these explicitly adult night-shift roles, after skeletal clip updates.
    for(const head of adultHeads)head.scale.setScalar(.74);
    const pattern=PATTERNS[state.turn%3];
    for(let c=0;c<3;c++)for(let i=0;i<4;i++)clueBeads[c][i].visible=i<pattern[c];
    for(let i=0;i<3;i++)knobs[i].rotation.z=-state.dials[i]*Math.PI/2;
    for(const m of mailParts)m.visible=!state.letter;
    handPrism.visible=state.letter&&!state.delivered;
    if(neighborPrism)neighborPrism.visible=state.delivered;
    receiverLamp.color.set(wrong>0?0xe86b4b:state.tuned?0x58dfc6:0x53667c);receiverLamp.intensity=state.tuned?3:.8;
    lever.rotation.z=isBeacon?-.65:.65;
    lamp.intensity=state.choice?isBeacon?13:42:38;hearthLight.intensity=state.choice==='hearth'?7:2;
    beaconLight.intensity=isBeacon?6+Math.sin(time*2)*.5:0;beacon.material.emissive.setHex(isBeacon?0x6d4bd0:0x182940);
    for(let i=0;i<streetAnswers.length;i++)streetAnswers[i].visible=isBeacon&&pulse%3>i*.12;
    wheel.rotation.z=state.tuned?pulse*.12:0;throwBlanket.material=state.delivered&&isBeacon?newBlanketMaterial:cloth;
    for(let i=0;i<stationMarkers.length;i++){stationMarkers[i].material.opacity=near?.id===stations[i].id ? .85 : .2;stationMarkers[i].scale.setScalar(near?.id===stations[i].id?1.18:1);}
    const button=document.getElementById('investigate');
    if(button){button.disabled=(!near&&!loomNear)||paused||getState().over;const label=near?`Investigate · ${near.name} · F`:loomNear?'Use Return Loom · F':'Investigate · F';if(button.textContent!==label)button.textContent=label;document.getElementById('chapterNearby').textContent=near?`At the ${near.name.toLowerCase()}`:'Explore the room for teal story rings.';document.getElementById('receiverActions').hidden=near?.id!=='receiver'||state.tuned;document.getElementById('junctionActions').hidden=near?.id!=='junction'||!state.tuned||state.delivered;}
    updateLoom(dt,player);
    gamepad(pad);
  }
  const newBlanketMaterial=new THREE.MeshStandardMaterial({color:0xb8a9cf,map:knit,roughness:1});
  function camera(){if(!focus)return null;const configs={loom:{position:[.6,2.8,.7],look:[2.8,1.1,2.7]},'loom-return':{position:[6.4,6.5,7],look:[.4,1.15,1.2]},letter:{position:[-2.7,2.4,.8],look:[-4.45,1.1,3.4]},trace:{position:[2.4,2.3,.3],look:[5.22,1.9,.1]},receiver:{position:[-1.6,2.1,-.65],look:[-3.6,1.05,-2.8]},junction:{position:[2.5,2.1,.2],look:[5,1.45,-.7]},neighbor:{position:[(neighbor?.position.x||-3.65)+2,2.2,(neighbor?.position.z||2.95)+2],look:[neighbor?.position.x||-3.65,1.1,neighbor?.position.z||2.95]}};return configs[focus.id]||null;}
  function snapshot(){let meshes=0,neighborSkinnedMeshes=0;group.traverse(o=>{if(o.isMesh)meshes++;});neighbor?.traverse(o=>{if(o.isSkinnedMesh)neighborSkinnedMeshes++;});const stage=state.delivered?'closed':state.choice?'return-prism':state.tuned?'choose-circuit':state.trace?'tune-receiver':state.letter?'read-window':'letter';return {...copy(state),stage,loom:{ritualSockets:ritualSockets.map(r=>({goal:r.goal,emission:r.pin.material.emissiveIntensity,pinPosition:r.pin.position.toArray(),socketRotation:r.socket.rotation.z})),near:loomNear,station:{...loomPoint},mode:loomMode(),phase:loomPhase,playbackSeconds:loomClock,pattern:[...weavePatterns[loomMode()]],input:[...loomInput],litStud:loomLamps.findIndex(o=>o.material.emissiveIntensity>2),rendered:{canopyLeavesVisible:loomLeaves.filter(o=>o.visible).length,facetsVisible:gems.visible?gems.count:0,floorBraids:Object.fromEntries(Object.entries(floorThreads).map(([k,o])=>[k,{visible:o.visible,links:o.count}]))}},clues:{letter:state.letter,window:state.trace,receiver:state.tuned},choices:{circuit:state.choice},consequence:state.choice?{hearthPowered:state.choice==='hearth',streetBeaconPowered:state.choice==='beacon',prismReturned:state.delivered}:null,rendered:{roomLampIntensity:lamp.intensity,hearthLightIntensity:hearthLight.intensity,beaconLightIntensity:beaconLight.intensity,beaconEmissive:beacon.material.emissive.getHex(),streetAnswerLightsVisible:streetAnswers.filter(m=>m.visible).length,blanketMaterial:throwBlanket.material===newBlanketMaterial?'neighbor-blanket':'original-throw',heldPrismVisible:handPrism.visible,returnedPrismVisible:neighborPrism?.visible||false,headScales:adultHeads.map(h=>h.scale.toArray()),letterVisible:letter.visible,neighborPosition:neighbor?.position.toArray()||null,dialRotations:knobs.map(k=>k.rotation.z)},roles:{resident:'adult night-shift resident',neighbor:'adult neighbor'},events:copy(storyEvents),near:near?.id||null,stations:copy(stations),pattern:state.trace?[...PATTERNS[state.turn%3]]:null,storageOK,mosaicLoaded,assetErrors:[...assetErrors],authoredStaticMeshes:authoredStaticMeshes.length,staticBatches,environmentMeshes:meshes,neighborSkinnedMeshes,neighborPresent:!!neighbor,focus:focus?.id||null};}
  return {bind,interact,dial,tune,choose,weave,listenLoom,cancelLoom,installResident,update,camera,snapshot,solids:()=>[...baseSolids,...(neighbor?[ [neighbor.position.x-.2,neighbor.position.x+.2,neighbor.position.z-.2,neighbor.position.z+.2] ]:[])]};
}
