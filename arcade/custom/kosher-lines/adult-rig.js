// Original integration of a real, authored adult rig. No fallback geometry or state injection.
export async function loadAdultRig(THREE,{loader,url,parent,height=1.82}){
 const gltf=await loader.loadAsync(url),root=gltf.scene;
 if(!root?.isObject3D)throw Error('Adult rig scene missing');
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<.5||size.y>5)throw Error('Adult rig height outside authoring contract: '+size.y);
 const sourceHeight=size.y;root.scale.multiplyScalar(height/size.y);root.updateMatrixWorld(true);bounds.setFromObject(root);
 const center=bounds.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;root.position.y-=bounds.min.y;
 const metrics={source:'original-vorath-adult-skater-v03',sourceHeight,bones:0,skinnedMeshes:0,vertices:0,triangles:0,materials:0,sourceClips:{},animations:[],skinLoaded:false,modelLoaded:false,headScale:1};
 const materials=new Set();let skin=null;
 root.traverse(o=>{if(o.isBone)metrics.bones++;if(o.isSkinnedMesh){metrics.skinnedMeshes++;metrics.vertices+=o.geometry.attributes.position.count;metrics.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material])){materials.add(m.uuid);if(m.map){metrics.skinLoaded=true;skin ||= m.map;}}}});
 metrics.materials=materials.size;if(metrics.bones<20||metrics.skinnedMeshes<1||!skin)throw Error('Adult model is missing its actual skeleton, skinned geometry or textures');
 const patterns={idle:/^(?:.*[|:])?(?:idle(?:_loop)?|standing_idle)$/i,run:/^(?:.*[|:])?(?:run(?:ning)?(?:_loop)?|run_forward)$/i,jump:/^(?:.*[|:])?(?:jump(?:_full)?|jump(?:ing)?_loop)$/i,crouch:/^(?:.*[|:])?(?:crouch|crouch_idle_loop)$/i},clips={};
 for(const [kind,pattern]of Object.entries(patterns)){const original=gltf.animations.find(c=>pattern.test(c.name));if(!original?.tracks.length)throw Error('Adult '+kind+' skeletal clip is missing; available: '+gltf.animations.map(c=>c.name).join(', '));const clip=original.clone();clip.name='Vorath|'+kind;clips[kind]=clip;metrics.sourceClips[kind]=original.name;metrics.animations.push(clip.name);}
 parent.add(root);const mixer=new THREE.AnimationMixer(root);metrics.modelLoaded=true;return{root,mixer,clips,skin,metrics};
}
