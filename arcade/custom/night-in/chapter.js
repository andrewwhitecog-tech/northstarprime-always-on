// Original optional chapter and environmental dressing for the reconstructed room.
// No cast identity is claimed: the other resident is simply the neighbor.
import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';

const KEY='nsp-night-in-light-across-the-hall-v1';
const COLORS=[0xf3b85f,0x58dfc6,0xa47aed];
const PATTERNS=[[2,1,3],[3,2,1],[1,3,2]];
const fresh=(turn=0,archive=[])=>({version:1,turn,archive,met:false,letter:false,trace:false,tuned:false,choice:null,delivered:false,dials:[1,1,1],attempts:0});
const copy=x=>JSON.parse(JSON.stringify(x));

export function createChapter({scene,box,cylinder,walnut,gold,black,texture,plaster,lamp,say,note,getState}){
  let state=fresh(),storageOK=true;
  try{const old=JSON.parse(localStorage.getItem(KEY));if(old?.version===1){state.turn=Number.isInteger(old.turn)?Math.max(0,Math.min(999,old.turn)):0;state.archive=Array.isArray(old.archive)?old.archive.filter(x=>x==='hearth'||x==='beacon').slice(-12):[];for(const k of ['met','letter','trace','tuned','delivered'])state[k]=old[k]===true;state.choice=['hearth','beacon'].includes(old.choice)?old.choice:null;state.dials=Array.isArray(old.dials)&&old.dials.length===3?old.dials.map(n=>Number.isInteger(n)?Math.max(1,Math.min(4,n)):1):[1,1,1];state.attempts=Number.isInteger(old.attempts)?Math.max(0,old.attempts):0;}}catch{}
  const group=new THREE.Group();group.name='The light across the hall — inhabited apartment';scene.add(group);
  const elements=[],lamps=[],clueBeads=[],knobs=[],mailParts=[],props=[];
  let neighbor=null,neighborMixer=null,neighborIdle=null,neighborRun=null,neighborAction=null,neighborPrism=null,neighborMoving=false,focus=null,pulse=0,wrong=0,near=null,paused=false,lastPlayer=null,selectedDial=0;
  const storyEvents=[],previousPad=[],adultHeads=[];
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

  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}}
  function commit(action){note('chapter',action);storyEvents.push({action,atNightSeconds:getState().elapsed,turn:state.turn});if(storyEvents.length>50)storyEvents.shift();persist();renderJournal();}
  function hint(){if(state.delivered)return state.choice==='hearth'?'A warm room, shared. The window remembers the signal you did not send.':'The street answered. The room is cooler, but the neighbor brought a blanket.';if(!state.letter)return 'Someone slipped a letter under the door. Meet the neighbor or inspect the brass slot.';if(!state.trace)return 'The letter asks you to read three colors in the window glass.';if(!state.tuned)return 'Choose Crib Static on the record player. Then set the workbench dials to the window trace.';if(!state.choice)return 'The signal is clear. One cell can feed the hearth lamp or the street beacon. Choose at the junction.';return 'Bring the prism back to the neighbor. A choice needs a human return.';}
  function renderJournal(){const journal=document.getElementById('chapterJournal');if(!journal)return;journal.replaceChildren();const rows=[['Letter',state.letter?'A single cell. A borrowed prism. “Leave a light for someone.”':'Not collected'],['Window trace',state.trace?`Amber ${PATTERNS[state.turn%3][0]} · teal ${PATTERNS[state.turn%3][1]} · violet ${PATTERNS[state.turn%3][2]}`:'Not observed'],['Receiver',state.tuned?'Crib Static answered. The receiver is repaired.':`${state.dials.join(' / ')} · ${state.attempts} attempted transmissions`],['Circuit',state.choice==='hearth'?'Hearth selected':state.choice==='beacon'?'Street beacon selected':'Undecided'],['Return',state.delivered?'Prism returned. Chapter closed.':'The neighbor is waiting']];for(const [name,value]of rows){const li=document.createElement('li'),b=document.createElement('b');b.textContent=name+' · ';li.append(b,document.createTextNode(value));journal.append(li);}document.getElementById('chapterHint').textContent=hint();document.getElementById('chapterStatus').textContent=state.delivered?'CHAPTER CLOSED':`${[state.letter,state.trace,state.tuned,!!state.choice,state.delivered].filter(Boolean).length} / 5 discoveries`;document.getElementById('chapterReplay').hidden=!state.delivered;document.getElementById('dialReadout').textContent=state.dials.join(' / ');document.getElementById('chapterArchive').textContent=state.archive.length?'Remembered endings: '+state.archive.map(x=>x==='hearth'?'Hearth':'Beacon').join(' · '):'Both endings are playable. Your choices persist across new nights.';}
  function focusOn(id){focus={id,time:5};}
  function interact(){if(paused||getState().over)return false;if(!near){say('For the signal story, approach the door, window, workbench, junction or neighbor.');return false;}focusOn(near.id);switch(near.id){case'neighbor':state.met=true;if(!state.letter)say('The neighbor: “I left you a prism. The letter is at the door. One light is all the old circuit can carry.”');else if(state.choice&&!state.delivered){state.delivered=true;state.archive.push(state.choice);state.archive=state.archive.slice(-12);say(state.choice==='hearth'?'You return the prism. The neighbor stays. The lamp warms the listening corner; the street stays dark. A small repair, shared.':'You return the prism. Seven windows answer your beacon. The neighbor lends the room a blanket. You chose to be seen together.');}else say(state.delivered?hint():'The neighbor: “The three colors are in the glass. Tune the receiver, then decide who gets the light.”');break;case'letter':state.letter=true;say('A folded note and a borrowed prism: “Crib Static carries the missing signal. Read the glass. One cell, two lights. Bring the prism back.”');break;case'trace':if(!state.letter){say('Three groups of colored glints. There may be a reason to count them.');break;}state.trace=true;say('Window trace recorded: '+PATTERNS[state.turn%3].join(' / ')+'. The glass is a memory, not a warning.');break;case'receiver':say(state.tuned?'The receiver is repaired. Choose a circuit at the junction.':'Turn the three dials below, then Send signal. The record player must be on Crib Static.');break;case'junction':say(state.tuned?'One cell. Choose Hearth or Beacon below. You can change it until you return the prism.':'The cell is seated, but the receiver has no clear signal yet.');break;}commit('inspect-'+near.id);return true;}
  function dial(index){if(paused||getState().over||near?.id!=='receiver'||state.tuned)return;state.dials[index]=state.dials[index]%4+1;commit('dial-'+index);}
  function tune(){if(paused||getState().over||near?.id!=='receiver'||state.tuned)return;if(!state.letter||!state.trace){say('Collect the letter and read the window before transmitting.');return;}if(getState().track!==1){say('The note names Crib Static. Choose that record first.');return;}state.attempts++;if(state.dials.every((n,i)=>n===PATTERNS[state.turn%3][i])){state.tuned=true;say('The needle settles. Two circuits wake: one room, or seven far windows. Choose at the junction.');}else{wrong=1.5;say('The needle falls back. Compare the three colored counts in your journal.');}commit('transmit');}
  function choose(choice){if(paused||getState().over||near?.id!=='junction'||!state.tuned||state.delivered)return;state.choice=choice;say(choice==='hearth'?'The room takes the cell. The beacon goes dark. Return the prism to the neighbor to keep this choice.':'The beacon takes the cell. The warm lamp fades. Return the prism to the neighbor to keep this choice.');commit('choose-'+choice);}
  function bind(){document.getElementById('investigate').onclick=interact;for(let i=0;i<3;i++)document.getElementById('dial'+i).onclick=()=>dial(i);document.getElementById('sendSignal').onclick=tune;document.getElementById('chooseHearth').onclick=()=>choose('hearth');document.getElementById('chooseBeacon').onclick=()=>choose('beacon');document.getElementById('chapterReplay').onclick=()=>{if(!state.delivered||paused)return;state=fresh((state.turn+1)%1000,state.archive);say('The same chapter, a different trace. The neighbor has left another folded note. Start a new night if midnight has passed.');commit('replay');};renderJournal();}

  function wardrobe(skin,neighborSkin=false){const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(skin.image,0,0,1024,1024);ctx.save();ctx.beginPath();ctx.rect(0,490,640,510);ctx.clip();ctx.fillStyle=neighborSkin?'#182940':'#122c2c';ctx.fillRect(0,490,640,510);for(let row=0;row<19;row++){ctx.strokeStyle=(neighborSkin?['#4c7490','#7e5b8e','#d79956','#245b68']:['#bc5744','#d49e4d','#218d87','#584c99','#4d709a'])[row%(neighborSkin?4:5)];ctx.lineWidth=12;for(let x=-90;x<720;x+=92){ctx.beginPath();ctx.moveTo(x,500+row*28);ctx.bezierCurveTo(x+65,465+row*28,x+18,545+row*28,x+98,516+row*28);ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#111a25';ctx.stroke();ctx.lineWidth=12;}}ctx.fillStyle='#0e1922';ctx.fillRect(300,490,24,510);ctx.fillStyle='#ba9565';ctx.fillRect(310,490,3,510);ctx.restore();ctx.fillStyle=neighborSkin?'#404058':'#192b32';ctx.fillRect(640,765,384,259);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;return t;}
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
  function gamepad(pad){if(!pad)return;const pressed=i=>pad.buttons[i]?.pressed&&!previousPad[i];if(!paused&&!getState().over){if(pressed(2))interact();if(near?.id==='receiver'&&!state.tuned){if(pressed(14))selectedDial=(selectedDial+2)%3;if(pressed(15))selectedDial=(selectedDial+1)%3;if(pressed(12))dial(selectedDial);if(pressed(3))tune();}else if(near?.id==='junction'&&state.tuned){if(pressed(14))choose('hearth');if(pressed(15))choose('beacon');}}for(let i=0;i<pad.buttons.length;i++)previousPad[i]=pad.buttons[i].pressed;}
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
    if(button){button.disabled=!near||paused||getState().over;const label=near?`Investigate · ${near.name} · F`:'Investigate · F';if(button.textContent!==label)button.textContent=label;document.getElementById('chapterNearby').textContent=near?`At the ${near.name.toLowerCase()}`:'Explore the room for teal story rings.';document.getElementById('receiverActions').hidden=near?.id!=='receiver'||state.tuned;document.getElementById('junctionActions').hidden=near?.id!=='junction'||!state.tuned||state.delivered;}
    gamepad(pad);
  }
  const newBlanketMaterial=new THREE.MeshStandardMaterial({color:0xb8a9cf,map:knit,roughness:1});
  function camera(){if(!focus)return null;const configs={letter:{position:[-2.7,2.4,.8],look:[-4.45,1.1,3.4]},trace:{position:[2.4,2.3,.3],look:[5.22,1.9,.1]},receiver:{position:[-1.6,2.1,-.65],look:[-3.6,1.05,-2.8]},junction:{position:[2.5,2.1,.2],look:[5,1.45,-.7]},neighbor:{position:[(neighbor?.position.x||-3.65)+2,2.2,(neighbor?.position.z||2.95)+2],look:[neighbor?.position.x||-3.65,1.1,neighbor?.position.z||2.95]}};return configs[focus.id]||null;}
  function snapshot(){let meshes=0,neighborSkinnedMeshes=0;group.traverse(o=>{if(o.isMesh)meshes++;});neighbor?.traverse(o=>{if(o.isSkinnedMesh)neighborSkinnedMeshes++;});const stage=state.delivered?'closed':state.choice?'return-prism':state.tuned?'choose-circuit':state.trace?'tune-receiver':state.letter?'read-window':'letter';return {...copy(state),stage,clues:{letter:state.letter,window:state.trace,receiver:state.tuned},choices:{circuit:state.choice},consequence:state.choice?{hearthPowered:state.choice==='hearth',streetBeaconPowered:state.choice==='beacon',prismReturned:state.delivered}:null,rendered:{roomLampIntensity:lamp.intensity,hearthLightIntensity:hearthLight.intensity,beaconLightIntensity:beaconLight.intensity,beaconEmissive:beacon.material.emissive.getHex(),streetAnswerLightsVisible:streetAnswers.filter(m=>m.visible).length,blanketMaterial:throwBlanket.material===newBlanketMaterial?'neighbor-blanket':'original-throw',heldPrismVisible:handPrism.visible,returnedPrismVisible:neighborPrism?.visible||false,headScales:adultHeads.map(h=>h.scale.toArray()),letterVisible:letter.visible,neighborPosition:neighbor?.position.toArray()||null,dialRotations:knobs.map(k=>k.rotation.z)},roles:{resident:'adult night-shift resident',neighbor:'adult neighbor'},events:copy(storyEvents),near:near?.id||null,stations:copy(stations),pattern:state.trace?[...PATTERNS[state.turn%3]]:null,storageOK,mosaicLoaded,assetErrors:[...assetErrors],authoredStaticMeshes:authoredStaticMeshes.length,staticBatches,environmentMeshes:meshes,neighborSkinnedMeshes,neighborPresent:!!neighbor,focus:focus?.id||null};}
  return {bind,interact,dial,tune,choose,installResident,update,camera,snapshot,solids:()=>[...baseSolids,...(neighbor?[ [neighbor.position.x-.2,neighbor.position.x+.2,neighbor.position.z-.2,neighbor.position.z+.2] ]:[])]};
}
