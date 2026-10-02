/* Reusable real-time metal, ceramic and crystal pieces for compact arcade games. */
window.makeArcadeRelief=()=>{
 if(!window.THREE){window.ArcadeKit.supports3d=false;return null;}
 const T=THREE;let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true});}catch(_){window.ArcadeKit.supports3d=false;return null;}
 renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.domElement.className='arcade-relief';renderer.domElement.setAttribute('aria-hidden','true');Object.assign(renderer.domElement.style,{position:'fixed',pointerEvents:'none',zIndex:'1',margin:'0',border:'0',borderRadius:'0',boxShadow:'none',maxHeight:'none'});document.body.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(0,100,0,-100,.1,2000);camera.position.z=1000;
 scene.add(new T.HemisphereLight(0xddefff,0x192238,.8));for(const [c,power,x,y,z] of [[0xffdeb3,1.3,-350,300,700],[0x65b8ff,.9,600,-200,500]]){const l=new T.DirectionalLight(c,power);l.position.set(x,y,z);scene.add(l);}
 const geometries={box:new T.BoxGeometry(1,1,1),panel:new T.PlaneGeometry(1,1),orb:new T.SphereGeometry(1,24,16),gem:new T.IcosahedronGeometry(1,0),ring:new T.TorusGeometry(1,.11,8,40)};
 const textures=new Map();function atlas(p){if(!p.atlas)return window.FamilyVII?FamilyVII.texture(T,p.kind==='box'?7:p.kind==='ring'?8:6):null;const key=p.atlas+':'+p.column+':'+p.row+':'+(p.columns||2);if(!textures.has(key)){const t=new T.TextureLoader().load(p.atlas);t.encoding=T.sRGBEncoding;t.repeat.set(1/(p.columns||2),1/(p.rows||3));t.offset.set((p.column||0)/(p.columns||2),1-(p.row+1)/(p.rows||3));textures.set(key,t);}return textures.get(key);}
 const pool=[];let W=0,H=0,frames=0,lost=false;
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;renderer.domElement.style.display='none';window.ArcadeKit.supports3d=false;window.ArcadeKit.render3d=false;window.ArcadeKit.sync();});
 return {draw(ctx,w,h,pieces){
  if(lost||window.ArcadeKit?.render3d===false){renderer.domElement.style.display='none';return false;}renderer.domElement.style.display='block';if(W!==w||H!==h){W=w;H=h;renderer.setSize(w,h,false);camera.right=w;camera.bottom=-h;camera.updateProjectionMatrix();}
  const r=ctx.canvas.getBoundingClientRect();Object.assign(renderer.domElement.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  pieces.forEach((p,i)=>{let mesh=pool[i];if(!mesh){mesh=new T.Mesh(geometries.box,new T.MeshStandardMaterial());scene.add(mesh);pool.push(mesh);}mesh.visible=true;mesh.geometry=geometries[p.kind||'box'];mesh.position.set(p.x,-p.y,p.z||10);mesh.rotation.z=-(p.angle||0);mesh.scale.set(p.w,p.h,p.depth||8);mesh.material.color.set(p.color||'#ddc487');mesh.material.metalness=p.metal??.5;mesh.material.roughness=p.rough??.28;mesh.material.emissive.set(p.glow||'#000');mesh.material.emissiveIntensity=p.glow?.15:0;const map=atlas(p);if(mesh.material.map!==map){mesh.material.map=map;mesh.material.transparent=!!map;mesh.material.alphaTest=map?.05:0;mesh.material.needsUpdate=true;}});
  for(let i=pieces.length;i<pool.length;i++)pool[i].visible=false;
  renderer.render(scene,camera);frames++;return true;
 },status:()=>({renderer:'WebGL',frames,pool:pool.length,contextLost:lost})};
};
