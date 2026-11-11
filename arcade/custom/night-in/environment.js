import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';

// A bounded, one-time 64px reflection capture of authored softbox panels.
// The apartment background is separate; no per-frame cube rendering or CDN HDR.
export function installMaterialReflections(renderer,scene){
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x263241);
  const panels=[
    {size:[6,3],position:[0,4,0],color:0xffe2b0},
    {size:[2,4],position:[3,1,.5],color:0x81b9c5},
    {size:[2,3],position:[-3,1,-1],color:0x927fba},
    {size:[4,2],position:[-.5,1.5,3],color:0xe7b482},
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
