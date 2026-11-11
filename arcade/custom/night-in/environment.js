import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';

// A bounded, one-time 64px reflection capture of authored softbox panels.
// The apartment background is separate; no per-frame cube rendering or CDN HDR.
export function installMaterialReflections(renderer,scene){
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x080c11);
  const panels=[
    {size:[6,3],position:[0,4,0],color:0xb4d091},
    {size:[2,4],position:[3,1,.5],color:0x29c9dc},
    {size:[2,3],position:[-3,1,-1],color:0xd52b83},
    {size:[4,2],position:[-.5,1.5,3],color:0x98715e},
    {size:[3,2],position:[0,1,-3],color:0x6a819f},
  ];
  for(const p of panels){const panel=new THREE.Mesh(new THREE.PlaneGeometry(...p.size),new THREE.MeshBasicMaterial({color:p.color}));panel.position.set(...p.position);panel.lookAt(0,0,0);studio.add(panel);}
  const cube=new THREE.WebGLCubeRenderTarget(64,{type:THREE.HalfFloatType,generateMipmaps:false});
  const capture=new THREE.CubeCamera(.1,15,cube);capture.update(renderer,studio);
  const generator=new THREE.PMREMGenerator(renderer),reflection=generator.fromCubemap(cube.texture);
  scene.environment=reflection.texture;cube.dispose();generator.dispose();
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return {cubeSize:64,panelCount:panels.length,texture:reflection.texture};
}

// Authored industrial shell: welded perimeter, cable runs, caged fixtures and
// an open slatted tread. All surfaces are geometry; wear is a shared material.
export function installUndergroundRoom(scene){
 const group=new THREE.Group();group.name='Underground listening room — welded service shell';scene.add(group);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');let seed=71831;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 c.fillStyle='#15191b';c.fillRect(0,0,256,256);
 for(let i=0;i<800;i++){const x=random()*256,y=random()*256;c.strokeStyle=i%3?'rgba(139,102,66,.35)':'rgba(182,192,184,.34)';c.lineWidth=.3+random()*1.1;c.beginPath();c.moveTo(x,y);c.lineTo(x+random()*28-14,y+random()*3-1.5);c.stroke();}
 for(let i=0;i<90;i++){c.fillStyle='rgba(47,28,17,.24)';c.beginPath();c.arc(random()*256,random()*256,random()*8,0,7);c.fill();}
 const wear=new THREE.CanvasTexture(canvas);wear.colorSpace=THREE.SRGBColorSpace;wear.wrapS=wear.wrapT=THREE.RepeatWrapping;
 const steel=new THREE.MeshStandardMaterial({color:0x313b3d,map:wear,bumpMap:wear,bumpScale:.022,metalness:.82,roughness:.49});
 const ribs=[[[10.5,.17,.22],[0,3.12,-3.32]],[[.2,.17,7.1],[-5.27,3.12,.1]],[[.18,.17,7.1],[5.18,3.12,.1]],[[10.5,.12,.12],[0,3.12,3.4]],[[.12,2.7,.16],[-5.25,1.76,-3.22]],[[.12,2.7,.16],[5.14,1.76,-3.22]],[[.16,.12,.15],[-5.25,.35,-3.22]],[[.16,.12,.15],[5.14,.35,-3.22]]].filter((_,i)=>i!==2&&i!==3); // Front and camera-side roof members are cut away for play visibility.
 const hardware=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),steel,ribs.length);hardware.name='Welded service beams';hardware.castShadow=true;hardware.receiveShadow=true;group.add(hardware);const dummy=new THREE.Object3D();ribs.forEach(([scale,pos],i)=>{dummy.position.set(...pos);dummy.scale.set(...scale);dummy.rotation.set(0,0,0);dummy.updateMatrix();hardware.setMatrixAt(i,dummy.matrix);});hardware.instanceMatrix.needsUpdate=true;
 const grate=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.025,.66),steel,29);grate.name='Walkable open slatted loom tread';group.add(grate);for(let i=0;i<29;i++){dummy.position.set(1.42+i*.05,-.006,2.59);dummy.scale.set(1,1,1);dummy.updateMatrix();grate.setMatrixAt(i,dummy.matrix);}grate.instanceMatrix.needsUpdate=true;
 const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.027,.027,.018,6),steel,12);group.add(bolts);for(let i=0;i<12;i++){dummy.position.set(-4.9+(i%12)*.88,3.02,i<12?-3.19:3.31);dummy.rotation.set(Math.PI/2,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();bolts.setMatrixAt(i,dummy.matrix);}bolts.instanceMatrix.needsUpdate=true;
 const cables=[];for(let i=0;i<3;i++){const points=[new THREE.Vector3(3.1+i*.07,3.16,-3.2),new THREE.Vector3(3.1+i*.07,2.97,-1.1),new THREE.Vector3(1.5+i*.07,3.1,1.9)];const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),22,.013,5,false),new THREE.MeshStandardMaterial({color:[0x101416,0x163c32,0x371b2e][i],roughness:.7,metalness:.25}));group.add(cable);cables.push(cable);}
 const fixtures=[];for(const [x,y,z,color]of [[-3,.28,-2.9,0x7dff24],[4,2.1,1.2,0x1ae5ff],[.4,1.5,-2.8,0xff167b]]){
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.44,.13,.23),steel);housing.position.set(x,y,z);housing.castShadow=true;group.add(housing);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.25,10),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.2,roughness:.16,metalness:.45}));lens.rotation.z=Math.PI/2;lens.position.set(x,y-.045,z+.075);group.add(lens);fixtures.push(lens);
  for(const side of [-1,1]){const guard=new THREE.Mesh(new THREE.BoxGeometry(.024,.17,.27),steel);guard.position.set(x+side*.16,y,z);group.add(guard);}
 }
 return {snapshot:()=>({hardwareInstances:hardware.count,grateInstances:grate.count,boltInstances:bolts.count,cableMeshes:cables.length,fixtureEmission:fixtures.map(o=>o.material.emissive.getHex()),steelMap:steel.map.uuid,steelColor:steel.color.getHexString()})};
}
