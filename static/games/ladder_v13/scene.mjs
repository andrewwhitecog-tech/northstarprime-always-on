import * as T from '/static/vendor/three/0.160.0/build/three.module.js';
export async function mount(host){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;host.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,60);camera.position.set(0,5.5,12);camera.lookAt(0,0,0);
  scene.add(new T.HemisphereLight(0xcceeff,0x3c1e08,2));const key=new T.DirectionalLight(0xffe2a6,4);key.position.set(-4,8,6);scene.add(key);const rim=new T.PointLight(0x69ffd5,55,20);rim.position.set(4,3,-3);scene.add(rim);
  const gold=new T.MeshStandardMaterial({color:0xb48a46,metalness:.78,roughness:.27}),dark=new T.MeshStandardMaterial({color:0x152627,metalness:.72,roughness:.32}),ivory=new T.MeshStandardMaterial({color:0xe8dec3,metalness:.32,roughness:.3});
  const group=new T.Group();group.position.set(3.5,-1,0);group.rotation.y=-.2;scene.add(group);
  const mesh=(geometry,material,x,y,z)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;};
  mesh(new T.BoxGeometry(5,.28,2.5),dark,0,0,0);mesh(new T.BoxGeometry(5.1,.06,2.6),gold,0,-.14,0);
  const switches=[],indicators=[];
  for(let i=0;i<3;i++){const x=(i-1)*1.5;mesh(new T.CylinderGeometry(.45,.49,.15,24),gold,x,.2,0);mesh(new T.CylinderGeometry(.33,.35,.16,24),dark,x,.32,0);const pivot=new T.Group();pivot.position.set(x,.45,0);const stem=new T.Mesh(new T.CylinderGeometry(.065,.08,.62,12),gold);stem.position.y=.25;pivot.add(stem);const cap=new T.Mesh(new T.SphereGeometry(.19,18,12),ivory);cap.scale.y=1.3;cap.position.y=.6;pivot.add(cap);group.add(pivot);switches.push(pivot);const mat=new T.MeshStandardMaterial({color:0x37605b,emissive:0x63dca1,emissiveIntensity:0,roughness:.22});const lamp=mesh(new T.SphereGeometry(.115,14,10),mat,x,.22,.82);indicators.push(lamp);}
  const ring=new T.Group();ring.position.set(0,2,-1.3);group.add(ring);const nodes=[];
  for(let i=0;i<9;i++){const angle=i*Math.PI*2/9;const m=new T.Mesh(new T.BoxGeometry(.14,.42,.16),gold.clone());m.position.set(Math.sin(angle)*1.3,Math.cos(angle)*1.3,0);m.rotation.z=-angle;ring.add(m);nodes.push(m);}
  const orbit=new T.Mesh(new T.TorusGeometry(1.52,.036,8,90),gold);ring.add(orbit);const heart=new T.Mesh(new T.IcosahedronGeometry(.43,0),new T.MeshStandardMaterial({color:0xa2d3d4,metalness:.4,roughness:.1,emissive:0x58eeb3,emissiveIntensity:0}));ring.add(heart);
  const bolts=[];for(const x of [-2.32,2.32])for(const z of [-1.06,1.06])bolts.push(mesh(new T.CylinderGeometry(.055,.055,.03,8),gold,x,.16,z));
  let moving=true,paused=false,target=[false,false,false],energized=false,last=0,restored=0;
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.x=w<700?-1:0;group.position.x=w<700?3.6:3.5;camera.updateProjectionMatrix();renderer.render(scene,camera);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;host.replaceChildren();document.getElementById('renderer').textContent='Still display · full circuit controls';observer.disconnect();});
  function frame(t){requestAnimationFrame(frame);if(paused||document.hidden||t-last<32)return;last=t;switches.forEach((s,i)=>{s.visible=i<target.length;indicators[i].visible=i<target.length;const angle=target[i]?-.48:.48;s.rotation.x=moving?s.rotation.x+(angle-s.rotation.x)*.25:angle;indicators[i].material.emissiveIntensity=target[i]?1.8:0;});heart.rotation.y=moving?t*.0003:0;heart.material.emissiveIntensity=energized?1.4:0;nodes.forEach((n,i)=>{n.material.emissive.setHex(0x80b75d);n.material.emissiveIntensity=i<restored?.85:0;});renderer.render(scene,camera);}
  requestAnimationFrame(frame);return {update(bits,on,count){target=[...bits];energized=on;restored=count;},motion(value){moving=value;},pause(value){paused=value;}};
}
