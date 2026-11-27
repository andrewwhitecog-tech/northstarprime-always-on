import { RepeatWrapping, SRGBColorSpace } from '/static/vendor/three/0.160.0/build/three.module.js';
// Original rest-space textile mapping: consistent physical fabric scale, unaffected by stock body UV islands.
export function configureWovenMaterial(material){
 if(material.name!=='VORATH_original_spectral_woven_yoke'||!material.map)return material;
 material.map.wrapS=material.map.wrapT=RepeatWrapping;material.map.colorSpace=SRGBColorSpace;material.map.needsUpdate=true;
 material.userData.vorathTextile={projection:'rest-space-triplanar',tilesPerMetre:1.3,compiled:false};
 material.onBeforeCompile=shader=>{
  const declaration='varying vec3 vClothRestPosition;\nvarying vec3 vClothRestNormal;\n';
  if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.fragmentShader.includes('#include <map_fragment>'))throw Error('Pinned Three.js textile shader anchors missing');
  shader.vertexShader=declaration+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClothRestPosition = position; vClothRestNormal = normal;');
  shader.fragmentShader=declaration+shader.fragmentShader.replace('#include <map_fragment>',
   '#ifdef USE_MAP\nvec3 knitWeights = pow(abs(normalize(vClothRestNormal)),vec3(5.0));\nknitWeights /= max(dot(knitWeights,vec3(1.0)),0.0001);\nvec3 knitPosition = vClothRestPosition * 1.3 + vec3(0.5,-1.02,0.5);\nvec4 knitTexel = texture2D(map,knitPosition.yz)*knitWeights.x + texture2D(map,knitPosition.xz)*knitWeights.y + texture2D(map,knitPosition.xy)*knitWeights.z;\ndiffuseColor *= knitTexel;\n#endif');
  material.userData.vorathTextile.compiled=true;
 };
 material.customProgramCacheKey=()=> 'vorath-woven-rest-triplanar-v05';material.needsUpdate=true;return material;
}
