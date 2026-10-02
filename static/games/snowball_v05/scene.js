/* Original realtime tabletop models; optional 3D never carries required text. */
window.createLearningScene = (kind, host, preferences) => {
  const fallback = document.createElement('div'); fallback.className = 'fallback'; fallback.setAttribute('aria-hidden','true');
  fallback.innerHTML = '<i>01</i><span>→</span><i>02</i><span>→</span><i>03</i>'; host.prepend(fallback);
  let renderer, scene, camera, frames = 0, pulse = 0, failed = false, nodes = [], links = [], moving, last = 0;
  const state = () => ({mode:renderer && preferences().three && !failed?'3D':'2D',frames,failed});
  function init() {
    if (renderer || failed) return;
    try {
      const T = window.THREE; if (!T) throw new Error('3D library unavailable');
      renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setClearColor(0x09111a,0); host.prepend(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden','true');
      renderer.domElement.addEventListener('webglcontextlost', e => {e.preventDefault();failed=true;settings();});
      scene = new T.Scene(); camera = new T.PerspectiveCamera(34,1,.1,100); camera.position.set(9,9,12); camera.lookAt(0,0,0);
      scene.add(new T.HemisphereLight(0xcceaff,0x23304b,1.7));
      const key = new T.DirectionalLight(0xffd99a,2); key.position.set(-5,8,4); scene.add(key);
      const rim = new T.PointLight(0x65ddea,2,25); rim.position.set(6,5,-4); scene.add(rim);
      const gold = new T.MeshStandardMaterial({color:0xc5a565,metalness:.75,roughness:.27});
      const dark = new T.MeshPhysicalMaterial({color:0x100f1e,metalness:.6,roughness:.23,clearcoat:1,clearcoatRoughness:.12});
      const glass = new T.MeshStandardMaterial({color:kind==='query'?0x749ded:kind==='shell'?0x8be8bf:0x67deed,metalness:.4,roughness:.22,emissive:0x0d373f,emissiveIntensity:.6});
      const jewelGeometry = new T.IcosahedronGeometry(.38,1), positions=jewelGeometry.attributes.position, colorArray=[];
      for(let j=0;j<positions.count;j++){
        const c=new T.Color().setHSL((Math.floor(j/3)*.137)%1,.85,.52);colorArray.push(c.r,c.g,c.b);
      }
      jewelGeometry.setAttribute('color',new T.Float32BufferAttribute(colorArray,3));
      const jewelMaterial=new T.MeshPhysicalMaterial({vertexColors:true,metalness:.25,roughness:.13,clearcoat:1,flatShading:true});
      function jewel(x,y,z,scale=1){const gem=new T.Mesh(jewelGeometry,jewelMaterial);gem.position.set(x,y,z);gem.scale.setScalar(scale);scene.add(gem);const bezel=new T.Mesh(new T.TorusGeometry(.4*scale,.045*scale,6,24),gold);bezel.position.set(x,y,z+.02);scene.add(bezel);}
      function engraving(x,y,z){
        for(let strand=0;strand<2;strand++){
          const points=[];for(let j=0;j<=120;j++){const a=j/120*Math.PI*2,r=.68+.12*Math.cos(9*a+strand*Math.PI);points.push(new T.Vector3(x+r*Math.cos(a),y,z+r*Math.sin(a)));}
          scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),120,.012,4,false),gold));
        }
      }
      function box(x,y,z,w,h,d,material){const m = new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);scene.add(m);return m;}
      box(0,-.7,0,10,.28,6,dark); box(0,-.5,0,9.8,.08,5.8,gold);box(0,-.42,0,9.6,.1,5.6,dark);
      for (let i=0;i<3;i++) {
        const x = (i-1)*3;
        if (kind==='router') {
          box(x,.05,0,2.2,.8,2,dark);box(x,.48,0,2.25,.12,2.05,gold);
          for(let j=0;j<5;j++)box(x-.8+j*.4,.03,1.015,.24,.18,.08,glass);
          for(let j=0;j<7;j++)box(x,.56,-.75+j*.23,1.7,.02,.035,dark);
          engraving(x,.59,0);jewel(x,.08,1.11,.72);
        } else if(kind==='query') {
          box(x,.75,0,2,2.4,1.7,dark);
          for(let j=0;j<4;j++){box(x,-.1+j*.53,.88,1.72,.38,.12,gold);box(x,-.1+j*.53,.96,1.5,.27,.1,dark);box(x+.58,-.1+j*.53,1.03,.14,.09,.04,glass);}
          engraving(x,1.98,0);jewel(x,1.84,.94,.6);
        } else {
          const screen=box(x,.8,-.15,2.05,1.7,.22,gold);screen.rotation.x=-.12;
          const face=box(x,.81,.02,1.84,1.43,.13,dark);face.rotation.x=-.12;
          for(let j=0;j<4;j++)box(x-.1,.4+j*.25,.2,1.1-(j%2)*.35,.035,.025,glass);
          box(x,-.1,1,2,.16,1,dark);for(let a=0;a<3;a++)for(let b=0;b<7;b++)box(x-.77+b*.25,.01,.68+a*.23,.16,.05,.14,gold);
          jewel(x,1.72,.08,.55);engraving(x,-.28,-1.3);
        }
        const ring=new T.Mesh(new T.TorusGeometry(.45,.045,8,36),gold);ring.rotation.x=Math.PI/2;ring.position.set(x,-.28,-1.75);scene.add(ring);nodes.push(ring);
      }
      // An engraved three-ring Loomwheel links the stations without obscuring data.
      for(let i=0;i<2;i++){
        const curve = new T.CatmullRomCurve3([new T.Vector3(-3+i*3,-.2,1.7),new T.Vector3(-1.5+i*3,.05,2.4),new T.Vector3(i*3,-.2,1.7)]);
        scene.add(new T.Mesh(new T.TubeGeometry(curve,24,.055,6,false),gold));links.push(curve);
      }
      moving = new T.Mesh(new T.IcosahedronGeometry(.18,1),glass);scene.add(moving);
      new ResizeObserver(draw).observe(host);draw();
    } catch {failed=true; if(renderer)renderer.domElement.style.display='none';}
  }
  function draw() {
    if (!renderer || failed || !preferences().three) return;
    const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);frames++;
  }
  function settings() {
    if (preferences().three) init();
    const active = renderer && preferences().three && !failed;
    fallback.style.display=active?'none':'flex'; if(renderer)renderer.domElement.style.display=active?'block':'none'; draw();
  }
  function tick(t) {
    if(t-last>32){last=t;const p=preferences();if(renderer && !failed && p.three && !p.paused && !p.calm && !document.hidden){
      moving.position.copy(links[Math.floor(t/2200)%2].getPoint((t%2200)/2200));moving.rotation.y=t*.001;
      if(pulse>0){pulse=Math.max(0,pulse-.035);nodes.forEach(n=>n.scale.setScalar(1+pulse*.14));}
      draw();
    }} requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);settings();
  return {settings,signal:()=>{pulse=1;draw();},state};
};
