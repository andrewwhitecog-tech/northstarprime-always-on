import * as T from '/static/vendor/three/0.160.0/build/three.module.js';
const host=document.getElementById('foundry3d'),status=document.getElementById('renderStatus');
try {
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(33,1,.1,40);camera.position.set(0,5,11);camera.lookAt(0,.6,0);
 scene.add(new T.HemisphereLight(0xd5e5f8,0x352419,2));const key=new T.DirectionalLight(0xffe0a4,4);key.position.set(-3,6,5);scene.add(key);const rim=new T.PointLight(0x67dcca,38,14);rim.position.set(3,3,-2);scene.add(rim);
 const brass=new T.MeshStandardMaterial({color:0xceb077,roughness:.29,metalness:.86}),black=new T.MeshStandardMaterial({color:0x10212e,roughness:.26,metalness:.66}),glass=new T.MeshPhysicalMaterial({color:0xc7ecef,transparent:true,opacity:.17,roughness:.05,metalness:.2,depthWrite:false});
 const deck=new T.Group();deck.rotation.y=-.14;scene.add(deck);
 const make=(g,m,x,y,z,parent=deck)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh};
 make(new T.BoxGeometry(7,.26,2.2),black,0,-.05,0);make(new T.BoxGeometry(7.06,.06,2.26),brass,0,-.2,0);
 const cartridges=[],targets=[];
 for(let i=0;i<6;i++){
  const group=new T.Group();group.position.x=(i-2.5)*1.04;group.userData.socket=i;deck.add(group);
  make(new T.CylinderGeometry(.42,.45,.14,32),brass,0,.16,0,group);make(new T.CylinderGeometry(.29,.33,.09,32),black,0,.26,0,group);
  const shell=make(new T.CylinderGeometry(.32,.32,1.18,24),glass,0,.93,0,group);
  for(const y of [.38,1.5])make(new T.TorusGeometry(.35,.035,8,32),brass,0,y,0,group).rotation.x=Math.PI/2;
  for(let p=0;p<4;p++){let a=p*Math.PI/2;make(new T.CylinderGeometry(.016,.016,1.17,6),brass,Math.sin(a)*.35,.94,Math.cos(a)*.35,group);}
  const crystal=make(new T.OctahedronGeometry(.24,0),new T.MeshStandardMaterial({color:0xd7ba78,metalness:.45,roughness:.15,emissive:0x92ddcb,emissiveIntensity:0}),0,.88,0,group);crystal.scale.y=1.8;
  const lamp=make(new T.SphereGeometry(.07,12,8),new T.MeshStandardMaterial({color:0x233d45,emissive:0xf4c478,emissiveIntensity:0}),0,.13,.79,group);
  const ring=make(new T.TorusGeometry(.49,.016,8,40),brass.clone(),0,.24,0,group);ring.rotation.x=Math.PI/2;
  cartridges.push({group,crystal,lamp,ring});targets.push(shell);
 }
 const wheel=new T.Group();wheel.position.set(0,2.15,-.6);deck.add(wheel);make(new T.TorusGeometry(.59,.025,8,60),brass,0,0,0,wheel);for(let i=0;i<9;i++){const a=i*Math.PI*2/9;const bar=make(new T.BoxGeometry(.018,.46,.022),brass,Math.sin(a)*.29,Math.cos(a)*.29,0,wheel);bar.rotation.z=-a;}make(new T.SphereGeometry(.13,20,12),new T.MeshStandardMaterial({color:0xacd9d5,metalness:.7,roughness:.14}),0,0,.04,wheel);
 let state={gates:[],signals:[],active:0,motion:true,paused:false},last=0,visible=true,closed=false,frameId;
 function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.render(scene,camera)}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);const viewObserver=new IntersectionObserver(entries=>visible=entries[0].isIntersecting);viewObserver.observe(host);resize();
 window.addEventListener('foundry:state',event=>{state=event.detail;cartridges.forEach((part,index)=>{part.lamp.material.emissiveIntensity=state.signals[index]?2.2:0;part.crystal.material.emissiveIntensity=state.gates[index]? .4+(state.signals[index]?1:0):0;part.ring.material.emissive.setHex(0xefd29b);part.ring.material.emissiveIntensity=index===state.active?.8:0;part.group.scale.setScalar(index===state.active?1.07:1);});renderer.render(scene,camera)});
 const raycaster=new T.Raycaster();renderer.domElement.addEventListener('pointerup',event=>{if(state.paused)return;const box=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1),camera);const hit=raycaster.intersectObjects(targets)[0];if(hit){const index=hit.object.parent.userData.socket;if(index<state.gates.length)window.dispatchEvent(new CustomEvent('foundry:select',{detail:index}));}});
 function frame(time){if(closed)return;frameId=requestAnimationFrame(frame);if(document.hidden||!visible||state.paused||!state.motion||time-last<33)return;last=time;cartridges.forEach((part,index)=>part.crystal.rotation.y=time*.0003+index);wheel.rotation.z=Math.sin(time*.0002)*.06;renderer.render(scene,camera)}frameId=requestAnimationFrame(frame);
 function stop(){closed=true;cancelAnimationFrame(frameId);resizeObserver.disconnect();viewObserver.disconnect()}
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();host.replaceChildren();status.textContent='Still workshop · all controls available'});
 window.addEventListener('pagehide',()=>{stop();scene.traverse(item=>{item.geometry?.dispose();if(item.material)for(const material of Array.isArray(item.material)?item.material:[item.material])material.dispose()});renderer.dispose()},{once:true});
 status.textContent='Live 3D cartridges';window.dispatchEvent(new Event('foundry:ready'));
}catch{status.textContent='Still workshop · all controls available';host.replaceChildren();}
