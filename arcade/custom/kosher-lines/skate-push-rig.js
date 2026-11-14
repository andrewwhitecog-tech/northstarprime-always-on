// Original analytic skating layer on the authentic humanoid skeleton.
// It changes rendered bone poses only; simulation position, score and controls stay owned by the game.
export function createSkatePushRig(THREE,{model,body}){
 const named=new Map();model.traverse(o=>{if(o.isBone)named.set(o.name,o);});
 const pelvis=named.get('pelvis'),legs=['l','r'].map(s=>({hip:named.get('thigh_'+s),knee:named.get('calf_'+s),foot:named.get('foot_'+s)}));
 if(!pelvis||legs.some(l=>!l.hip||!l.knee||!l.foot))throw Error('Skate push needs actual pelvis/thigh/calf/foot bones');
 const touched=[pelvis,...legs.flatMap(l=>[l.hip,l.knee,l.foot])];let originals=null,anchors=null,phase=0,lastActive=false,plantError=0,pushError=0;
 const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),clamp=THREE.MathUtils.clamp;
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 const reset=()=>{if(originals)for(const p of originals){p.bone.position.copy(p.p);p.bone.quaternion.copy(p.q);p.bone.scale.copy(p.s);}};
 function worldRotation(bone,delta){const parentQ=bone.parent.getWorldQuaternion(Q()),q=bone.getWorldQuaternion(Q()).premultiply(delta);bone.quaternion.copy(parentQ.invert().multiply(q));bone.updateWorldMatrix(false,true);}
 function solve(leg,target){
  const h=leg.hip.getWorldPosition(V()),k=leg.knee.getWorldPosition(V()),a=leg.foot.getWorldPosition(V()),footQ=leg.foot.getWorldQuaternion(Q());
  const l1=h.distanceTo(k),l2=k.distanceTo(a),dvec=target.clone().sub(h),distance=dvec.length(),d=clamp(distance,Math.abs(l1-l2)+.0001,l1+l2-.0001),direction=dvec.normalize();
  let bend=k.clone().sub(h);bend.addScaledVector(direction,-bend.dot(direction));
  if(bend.lengthSq()<.000001){bend.set(-1,0,0).transformDirection(body.matrixWorld);bend.addScaledVector(direction,-bend.dot(direction));}bend.normalize();
  const cos=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),desiredK=h.clone().addScaledVector(direction,l1*cos).addScaledVector(bend,l1*Math.sqrt(Math.max(0,1-cos*cos)));
  worldRotation(leg.hip,Q().setFromUnitVectors(k.clone().sub(h).normalize(),desiredK.sub(h).normalize()));
  const nowK=leg.knee.getWorldPosition(V()),nowA=leg.foot.getWorldPosition(V()),reachable=h.clone().addScaledVector(direction,d);
  worldRotation(leg.knee,Q().setFromUnitVectors(nowA.sub(nowK).normalize(),reachable.clone().sub(nowK).normalize()));
  leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(Q()).invert().multiply(footQ));leg.foot.updateWorldMatrix(false,true);
  return leg.foot.getWorldPosition(V()).distanceTo(target);
 }
 function update(dt,requestedActive){
  originals=touched.map(bone=>({bone,p:bone.position.clone(),q:bone.quaternion.clone(),s:bone.scale.clone()}));body.updateWorldMatrix(true,true);
  if(!anchors)anchors=legs.map(l=>body.worldToLocal(l.foot.getWorldPosition(V())));
  const active=dt>0?requestedActive:lastActive;lastActive=active;if(!active){phase=0;plantError=pushError=0;return;}
  phase=(phase+Math.min(Math.max(dt,0),.05)*1.15)%1;
  const out=phase<.18?smooth(phase/.18):phase<.72?1:1-smooth((phase-.72)/.28),contact=phase<.18?smooth(phase/.18):phase<.58?1:1-smooth((phase-.58)/.19);
  const drop=body.localToWorld(new THREE.Vector3(0,-.14*contact,0)).sub(body.getWorldPosition(new THREE.Vector3()));
  const lowered=pelvis.getWorldPosition(new THREE.Vector3()).add(drop);pelvis.position.copy(pelvis.parent.worldToLocal(lowered));body.updateWorldMatrix(true,true);
  const plant=body.localToWorld(anchors[0].clone()),push=anchors[1].clone();push.x+=.19*out;
  push.y-=.108*contact;push.y+=.08*Math.sin(Math.PI*clamp((phase-.58)/.42,0,1));
  push.z+=phase<.58?.24*smooth(phase/.58):.24*(1-smooth((phase-.58)/.42));
  const target=body.localToWorld(push);plantError=solve(legs[0],plant);pushError=solve(legs[1],target);
 }
 return{reset,update,snapshot:()=>({source:'original-one-foot-skate-push-IK',active:lastActive,phase,leftPlantError:plantError,rightTargetError:pushError,anchors:anchors?.map(p=>({x:p.x,y:p.y,z:p.z}))||null})};
}
