// Three r160 scene adapter. Pass the SAME pinned THREE module used by the host:
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// createCombatScene(THREE,scene,combat,{enemyFactory?}); no extra lights or DOM.
// enemyFactory(target,THREE) may return a root-owned authored Object3D or {root,update}.
export function createCombatScene(THREE,scene,combat,options={}){
 if(!THREE?.Group||!scene?.add)throw new TypeError('A Three r160 namespace and scene are required');
 const root=new THREE.Group();root.name='kosher-street-combat';scene.add(root);
 const disposables=new Set(),geometries=new Set();
 const material=(params)=>{const m=new THREE.MeshStandardMaterial(params);disposables.add(m);return m;};
 const metal=material({color:0x242935,metalness:.86,roughness:.29}),gold=material({color:0xffcd54,metalness:.82,roughness:.24}),violet=material({color:0x6529ac,metalness:.76,roughness:.29}),eye=material({color:0xff4164,emissive:0xd91d48,emissiveIntensity:2,metalness:.25,roughness:.22}),mint=material({color:0x65fff2,emissive:0x21cbbc,emissiveIntensity:1.6,metalness:.4,roughness:.28});
 function mesh(g,m,parent,x=0,y=0,z=0){geometries.add(g);const v=new THREE.Mesh(g,m);v.position.set(x,y,z);v.castShadow=true;v.receiveShadow=true;parent.add(v);return v;}
 const box=(w,h,d,m,parent,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);
 function rod(a,b,r,m,parent){const direction=new THREE.Vector3().subVectors(b,a);const v=mesh(new THREE.CylinderGeometry(r,r,direction.length(),6),m,parent);v.position.copy(a).add(b).multiplyScalar(.5);v.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return v;}
 function triangle(parent,r,angle){const points=Array.from({length:3},(_,i)=>new THREE.Vector3(Math.sin(angle+i*Math.PI*2/3)*r,Math.cos(angle+i*Math.PI*2/3)*r,0));for(let i=0;i<3;i++)rod(points[i],points[(i+1)%3],.027,gold,parent);}
 // Actual two intersecting triangular tube outlines, with six visible points.
 function token(){const g=new THREE.Group();triangle(g,.29,0);triangle(g,.29,Math.PI);const bezel=mesh(new THREE.TorusGeometry(.34,.025,6,24),gold,g);bezel.position.z=-.025;mesh(new THREE.OctahedronGeometry(.07),mint,g);return g;}
 function sentry(){
  const g=new THREE.Group();g.name='temporary-fictional-sentry-construct';
  const head=mesh(new THREE.CylinderGeometry(.4,.32,.34,8),metal,g,0,.06,0);head.rotation.z=Math.PI/2;
  mesh(new THREE.TorusGeometry(.26,.055,8,20),gold,g,0,.06,.35);
  mesh(new THREE.SphereGeometry(.17,12,8),eye,g,0,.06,.39);
  const iris=mesh(new THREE.TorusGeometry(.09,.025,6,16),mint,g,0,.06,.54);
  box(.56,.16,.5,violet,g,0,-.2,0);box(.12,.13,.55,metal,g,.31,-.18,.25);box(.07,.07,.07,mint,g,.31,-.18,.55);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(new THREE.Vector3(Math.sin(a)*.2,-.25,Math.cos(a)*.2),new THREE.Vector3(Math.sin(a)*.5,-.88,Math.cos(a)*.5),.047,metal,g);box(.2,.07,.28,gold,g,Math.sin(a)*.5,-.88,Math.cos(a)*.5);}
  return {root:g,update(s,time){iris.rotation.z=time*1.8;head.rotation.x=Math.sin(time*1.3)*.08;g.rotation.z=s.disabled?Math.PI*.28:0;}};
 }
 const actorMap=new Map(),tokenMap=new Map();
 for(const t of combat.snapshot().targets){let actor=options.enemyFactory?.(t,THREE)||sentry();if(actor.isObject3D)actor={root:actor};if(!actor.root?.isObject3D)throw new TypeError('enemyFactory must return Object3D or {root,update}');root.add(actor.root);actorMap.set(t.id,actor);}
 for(const t of combat.snapshot().tokens){const object=token();root.add(object);tokenMap.set(t.id,object);}
 const playerTrail=new THREE.LineBasicMaterial({color:0x88fff1,transparent:true,opacity:.9}),enemyTrail=new THREE.LineBasicMaterial({color:0xff3866,transparent:true,opacity:.85});disposables.add(playerTrail);disposables.add(enemyTrail);
 const trailPool=Array.from({length:32},()=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));geometries.add(geometry);const line=new THREE.Line(geometry,playerTrail);line.frustumCulled=false;line.visible=false;root.add(line);return line;});
 const weapon=new THREE.Group();weapon.name='fictional-clip-sidearm';
 box(.11,.12,.35,metal,weapon,0,.02,-.1);box(.12,.065,.29,violet,weapon,0,.095,-.08);
 const barrel=mesh(new THREE.CylinderGeometry(.025,.025,.11,10),gold,weapon,0,.025,-.31);barrel.rotation.x=Math.PI/2;
 const grip=box(.085,.18,.12,metal,weapon,0,-.12,.005);grip.rotation.x=-.21;
 box(.1,.02,.13,gold,weapon,0,-.09,-.12);box(.017,.08,.025,gold,weapon,0,-.05,-.18);box(.013,.04,.02,gold,weapon,0,-.04,-.08);
 box(.025,.03,.025,mint,weapon,0,.14,-.19);box(.025,.025,.025,gold,weapon,0,.14,.035);
 const flashMaterial=new THREE.MeshBasicMaterial({color:0x9ffff4,transparent:true,opacity:.85});disposables.add(flashMaterial);const flash=mesh(new THREE.OctahedronGeometry(.09),flashMaterial,weapon,0,.025,-.43);flash.scale.set(.6,.6,1.8);flash.visible=false;
 let lastShot=0,flashUntil=0;weapon.visible=false;root.add(weapon);
 const metrics={actors:actorMap.size,collectibles:tokenMap.size,tracerCapacity:trailPool.length,extraLights:0,temporaryEnemyArt:!options.enemyFactory};
 function update(snapshot=combat.snapshot(),time=snapshot.time){
  for(const t of snapshot.targets){const actor=actorMap.get(t.id);if(!actor)continue;actor.root.position.set(t.x,t.y,t.z);actor.root.visible=true;actor.root.rotation.y=Math.sin(time*.3)*.45;actor.update?.(t,time);actor.root.scale.setScalar(t.disabled?.67:1);}
  for(const t of snapshot.tokens){const o=tokenMap.get(t.id);if(!o)continue;o.visible=!t.collected;o.position.set(t.x,t.y+Math.sin(time*2+t.x)*.06,t.z);o.rotation.y=time*.75;o.rotation.z=Math.sin(time+t.z)*.06;}
  trailPool.forEach((line,i)=>{const t=snapshot.tracers[i];line.visible=Boolean(t);if(!t)return;line.material=t.kind==='enemy'?enemyTrail:playerTrail;const a=line.geometry.attributes.position.array;a.set([t.origin.x,t.origin.y,t.origin.z,t.end.x,t.end.y,t.end.z]);line.geometry.attributes.position.needsUpdate=true;});
  const shots=snapshot.events.filter(e=>e.type==='shot');const shot=shots[shots.length-1];if(shot&&shot.serial>lastShot){lastShot=shot.serial;flashUntil=time+.055;}flash.visible=time<flashUntil;weapon.position.z=weapon.userData.baseZ+(time<flashUntil?.018:0);
 }
 weapon.userData.baseZ=0;
 function attachWeapon(handBone,{position=[.035,.02,-.025],rotation=[0,0,0],scale=1}={}){if(!handBone?.add)throw new TypeError('A rider hand bone is required');handBone.add(weapon);weapon.position.fromArray(position);weapon.userData.baseZ=weapon.position.z;weapon.rotation.fromArray(rotation);weapon.scale.setScalar(scale);weapon.visible=true;return weapon;}
 function dispose(){root.removeFromParent();weapon.removeFromParent();for(const g of geometries)g.dispose();for(const m of disposables)m.dispose();for(const actor of actorMap.values())actor.dispose?.();}
 update();return {root,weapon,update,attachWeapon,dispose,metrics};
}
