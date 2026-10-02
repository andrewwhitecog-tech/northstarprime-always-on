/* Original NorthStar hardware. Scene geometry follows the game's collision coordinates. */
window.createWitnessRelief = function () {
  if (!window.THREE) return null;
  const T = THREE;
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias:true, alpha:true }); }
  catch (_) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(0, 760, 0, -920, .1, 2000);
  camera.position.z = 1000;
  const root = new T.Group(); scene.add(root);
  scene.add(new T.HemisphereLight(0xffeed2, 0x142b42, .65));
  const key = new T.DirectionalLight(0xffedcd, 1.15); key.position.set(-300, 350, 700); scene.add(key);
  const rim = new T.DirectionalLight(0x88caff, .65); rim.position.set(800, -550, 350); scene.add(rim);
  const brass = new T.MeshStandardMaterial({color:0xc99545,metalness:.65,roughness:.3});
  const chrome = new T.MeshStandardMaterial({color:0xd7e8f0,metalness:.72,roughness:.19});
  const rubber = new T.MeshStandardMaterial({color:0x151725,metalness:.15,roughness:.62});
  const ivory = new T.MeshStandardMaterial({color:0xe9ddbd,metalness:.15,roughness:.25});
  brass.map=FamilyVII.texture(T,8);ivory.map=FamilyVII.texture(T,7);ivory.color.set('#ffffff');
  const sphereGeometry = new T.SphereGeometry(1, 32, 24);
  const balls = [], caps = [], flips = [];
  let width=0, height=0, lost=false, frames=0;
  renderer.domElement.addEventListener('webglcontextlost', e=>{e.preventDefault();lost=true;});
  function mesh(geometry, material, x,y,z, parent=root) {
    const m=new T.Mesh(geometry,material); m.position.set(x,-y,z);parent.add(m);return m;
  }
  function cylinder(radius, depth, mat, x,y,z,parent=root) {
    const m=mesh(new T.CylinderGeometry(radius,radius,depth,48),mat,x,y,z,parent);m.rotation.x=Math.PI/2;return m;
  }
  function rail(x1,y1,x2,y2,z, radius=4) {
    const a=new T.Vector3(x1,-y1,z),b=new T.Vector3(x2,-y2,z);
    const m=new T.Mesh(new T.CylinderGeometry(radius,radius,a.distanceTo(b),16),chrome);
    m.position.copy(a.clone().add(b).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());root.add(m);
  }
  function rebuild(w,h, bumpers) {
    root.traverse(n=>{if(n.geometry && n.geometry!==sphereGeometry)n.geometry.dispose();if(n.userData.ownedMaterial)n.material.dispose();});
    root.clear();caps.length=0;flips.length=0;balls.length=0;
    width=w;height=h;renderer.setSize(w,h,false);camera.right=w;camera.bottom=-h;camera.updateProjectionMatrix();
    rail(53,39,53,h-58,10,5);rail(w-53,39,w-53,h-58,10,5);rail(53,39,w-53,39,10,5);
    rail(58,h-210,w*.33,h-115,10,5);rail(w-58,h-210,w*.67,h-115,10,5);
    for (let side=0;side<2;side++) for(let i=0;i<12;i++) {
      const x=side?w-53:53,y=65+i*(h-150)/11;
      cylinder(7,5,brass,x,y,17);rail(x-3,y,x+3,y,20,1);
    }
    bumpers.forEach(b=>{
      const group=new T.Group();root.add(group);group.position.set(b.x,-b.y,0);
      cylinder(b.r,12,rubber,0,0,7,group);
      cylinder(b.r*.92,12,brass,0,0,15,group);
      const mat=new T.MeshStandardMaterial({color:b.color,emissive:b.color,emissiveIntensity:.16,metalness:.36,roughness:.23});
      mat.map=FamilyVII.texture(T,6);const cap=mesh(sphereGeometry,mat,0,0,23,group);cap.scale.set(b.r*.79,b.r*.79,7);cap.userData.ownedMaterial=true;
      const torus=mesh(new T.TorusGeometry(b.r*.85,2.2,10,48),chrome,0,0,27,group);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(2.4,2,chrome,Math.cos(a)*b.r*.87,Math.sin(a)*b.r*.87,29,group);}
      caps.push({group,cap,torus});
    });
    for(let i=0;i<2;i++) {
      const pivot=new T.Group();root.add(pivot);
      const steel=new T.Mesh(new T.BoxGeometry(1,12,8),ivory);pivot.add(steel);
      const tip=cylinder(6,8,ivory,0,0,4,pivot);
      const heel=cylinder(6,8,ivory,0,0,4,pivot);
      const bolt=cylinder(3,3,brass,0,0,10,pivot);flips.push({pivot,steel,tip,heel,bolt});
    }
    for(let i=0;i<4;i++){const b=mesh(sphereGeometry,chrome,0,0,0);b.visible=false;balls.push(b);}
  }
  return {
    draw(ctx, view, bumpers, segments, orbs) {
      if(lost)return false;
      if(view.w!==width||view.h!==height)rebuild(view.w,view.h,bumpers);
      caps.forEach((b,i)=>{b.cap.material.color.set(bumpers[i].color);b.cap.material.emissive.set(bumpers[i].color);b.cap.material.emissiveIntensity=.12+(bumpers[i].flash||0)*.6;});
      segments.forEach((s,i)=>{const f=flips[i],len=Math.hypot(s.bx-s.ax,s.by-s.ay);f.pivot.position.set(s.ax,-s.ay,8);f.pivot.rotation.z=Math.atan2(-(s.by-s.ay),s.bx-s.ax);
        f.steel.position.set(len/2,0,4);f.steel.scale.x=len;f.tip.position.x=len;
      });
      while(balls.length<orbs.length)balls.push(mesh(sphereGeometry,chrome,0,0,0));
      balls.forEach((b,i)=>{const orb=orbs[i];b.visible=!!orb?.active;if(b.visible){b.position.set(orb.x,-orb.y,orb.r+7);b.scale.setScalar(orb.r);}});
      renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,view.w,view.h);frames++;
      return true;
    },
    status:()=>({renderer:'WebGL relief',frames,contextLost:lost,ballMeshes:balls.length}),
    dispose(){root.traverse(n=>{if(n.geometry)n.geometry.dispose();});[brass,chrome,rubber,ivory].forEach(m=>m.dispose());renderer.dispose();}
  };
};
