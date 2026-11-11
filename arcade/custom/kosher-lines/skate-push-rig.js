import {skateTrickProgress} from './rider-pose.mjs';
// Bone-only skating overlay for the actual Quaternius 65-joint adult rigs.
// Call reset(), then mixer.update(dt), then update(dt,pushing,state?).
// state accepts the real simulation grounded/mode/charge/vy/speed/steer/paused/trick/trickTime,
// plus aim:{active,direction:{x,y,z}} in WORLD coordinates. No physics writes.
export function createSkatePushRig(THREE,{model,body,deckY=.112}){
 const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),clamp=THREE.MathUtils.clamp;
 const named=new Map();model.traverse(o=>{if(o.isBone)named.set(o.name,o);});
 const pelvis=named.get('pelvis'),rootBone=named.get('root');
 const legs=['l','r'].map(s=>({side:s,hip:named.get('thigh_'+s),knee:named.get('calf_'+s),foot:named.get('foot_'+s)}));
 const arms=['l','r'].map(s=>({hip:named.get('upperarm_'+s),knee:named.get('lowerarm_'+s),foot:named.get('hand_'+s)}));
 if(!pelvis||legs.some(l=>!l.hip||!l.knee||!l.foot))throw Error('Skate rig needs actual pelvis/thigh/calf/foot bones');
 const touched=[...new Set([rootBone,pelvis,...['spine_01','spine_02','spine_03'].map(n=>named.get(n)),...legs.flatMap(l=>[l.hip,l.knee,l.foot,named.get('ball_'+l.side),named.get('ball_leaf_'+l.side)]),...arms.flatMap(l=>[l.hip,l.knee,l.foot])].filter(Boolean))];
 // updateWorldMatrix bypasses SkinnedMesh.updateMatrixWorld and can leave
 // bindMatrixInverse in the previous world position. Refresh the actual
 // skinned descendants before reading weighted sneaker vertices.
 body.updateWorldMatrix(true,false);body.updateMatrixWorld(true);
 const bind=new Map(touched.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 const bodyQ=body.getWorldQuaternion(Q()),invBodyQ=bodyQ.clone().invert();
 const pelvisBind=body.worldToLocal(pelvis.getWorldPosition(V())),pelvisQ=invBodyQ.clone().multiply(pelvis.getWorldQuaternion(Q()));
 const bodyScale=body.getWorldScale(V());
 const rotate=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI*.45);
 const footRefs=legs.map(l=>({q:invBodyQ.clone().multiply(l.foot.getWorldQuaternion(Q())),sole:null,calibrated:false}));
 // Calibrate ankle-to-sole offsets from actual weighted sneaker vertices, not the idle clip.
 const sneakerMeshes=[];model.traverse(o=>{if(o.isSkinnedMesh&&/sneaker/i.test(o.name))sneakerMeshes.push(o);});
 for(let side=0;side<2;side++){
  const leg=legs[side],points=[];
  for(const mesh of sneakerMeshes){const pos=mesh.geometry.attributes.position,idx=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!pos||!idx||!weights)continue;
   mesh.skeleton.update();
   for(let i=0;i<pos.count;i++){let contribution=0;for(let k=0;k<4;k++){const joint=mesh.skeleton.bones[idx.getComponent(i,k)];if(joint&&[leg.foot.name,'ball_'+leg.side,'ball_leaf_'+leg.side].includes(joint.name))contribution+=weights.getComponent(i,k);}if(contribution<.5)continue;const world=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);points.push({world,local:body.worldToLocal(world.clone())});}
  }
  if(points.length){const bottom=Math.min(...points.map(p=>p.local.y)),solePoints=points.filter(p=>p.local.y<bottom+.006),center=V();for(const p of solePoints)center.add(p.world);center.multiplyScalar(1/solePoints.length);footRefs[side].sole=leg.foot.worldToLocal(center);footRefs[side].calibrated=true;}
  else {const foot=body.worldToLocal(leg.foot.getWorldPosition(V()));const sole=V().set(foot.x,deckY,foot.z-.08);footRefs[side].sole=leg.foot.worldToLocal(body.localToWorld(sole));}
 }
 let originals=null,phase=0,lastActive=false,plantError=null,pushError=null,compression=0,landing=0,lastGrounded=true,armErrors=[null,null],soleErrors=[null,null],lastState='roll',reachDrop=0;
 let ankleTargets=[null,null],soleTargets=[null,null],lastAim=false,flipLift=0,lastStance=0;
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 function reset(){if(originals)for(const p of originals){p.bone.position.copy(p.p);p.bone.quaternion.copy(p.q);p.bone.scale.copy(p.s);}originals=null;}
 function restoreBind(b){if(!b)return;const s=bind.get(b);b.position.copy(s.p);b.quaternion.copy(s.q);b.scale.copy(s.s);}
 function worldRotation(bone,delta){const parentQ=bone.parent.getWorldQuaternion(Q()),q=bone.getWorldQuaternion(Q()).premultiply(delta);bone.quaternion.copy(parentQ.invert().multiply(q));bone.updateWorldMatrix(false,true);}
 function worldQuaternion(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
 function solve(chain,target,pole,desiredQ=null){
  if(!chain.hip||!chain.knee||!chain.foot)return null;
  const h=chain.hip.getWorldPosition(V()),k=chain.knee.getWorldPosition(V()),a=chain.foot.getWorldPosition(V()),l1=h.distanceTo(k),l2=k.distanceTo(a),dvec=target.clone().sub(h),distance=dvec.length();if(l1<1e-7||l2<1e-7||distance<1e-7)return null;
  const d=clamp(distance,Math.abs(l1-l2)+.00001,l1+l2-.00001),direction=dvec.normalize();
  const bend=pole.clone().sub(h);bend.addScaledVector(direction,-bend.dot(direction));if(bend.lengthSq()<1e-8){bend.set(1,0,0);bend.addScaledVector(direction,-bend.dot(direction));}bend.normalize();
  const cos=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),desiredK=h.clone().addScaledVector(direction,l1*cos).addScaledVector(bend,l1*Math.sqrt(Math.max(0,1-cos*cos)));
  worldRotation(chain.hip,Q().setFromUnitVectors(k.clone().sub(h).normalize(),desiredK.sub(h).normalize()));
  const nowK=chain.knee.getWorldPosition(V()),nowA=chain.foot.getWorldPosition(V()),reachable=h.clone().addScaledVector(direction,d);
  worldRotation(chain.knee,Q().setFromUnitVectors(nowA.sub(nowK).normalize(),reachable.clone().sub(nowK).normalize()));
  if(desiredQ)worldQuaternion(chain.foot,desiredQ);
  return chain.foot.getWorldPosition(V()).distanceTo(target);
 }
 function update(dt,requestedActive,state={}){
  // Tolerate direct callers while preserving the reset/mixer/update host contract.
  if(originals)reset();
  originals=touched.map(bone=>({bone,p:bone.position.clone(),q:bone.quaternion.clone(),s:bone.scale.clone()}));
  const step=Number.isFinite(dt)?clamp(dt,0,.05):0,live=step>0&&!state.paused,grounded=state.grounded!==false,mode=state.mode||(grounded?'roll':'air');
  const active=live?Boolean(requestedActive)&&grounded&&!['manual','bail'].includes(mode)&&!(state.charge>.03):lastActive;
  if(live){lastActive=active;if(active)phase=(phase+step*1.15)%1;else phase=0;if(grounded&&!lastGrounded)landing=1;else landing=Math.max(0,landing-step*3.8);lastGrounded=grounded;}
  const out=active?(phase<.18?smooth(phase/.18):phase<.72?1:1-smooth((phase-.72)/.28)):0;
  const contact=active?(phase<.18?smooth(phase/.18):phase<.58?1:1-smooth((phase-.58)/.19)):0;
  const charge=Number.isFinite(state.charge)?clamp(state.charge/.45,0,1):0;
  const {trick,progress}=skateTrickProgress(state),signatureTuck=mode==='air'&&trick?.id==='switch-bs360'?Math.sin(Math.PI*progress)*.12:0;
  const wanted=.085+signatureTuck+.22*charge+(mode==='manual'?.075:0)+(mode==='air'?.13:0)+landing*.15+contact*.065;
  if(live)compression+=(wanted-compression)*(1-Math.exp(-step*18));else if(compression===0)compression=wanted;
  restoreBind(rootBone);restoreBind(pelvis);for(const l of legs){restoreBind(named.get('ball_'+l.side));restoreBind(named.get('ball_leaf_'+l.side));}body.updateWorldMatrix(true,true);
  const pelvisTarget=pelvisBind.clone();pelvisTarget.y-=compression;pelvisTarget.x-=.025+compression*.18;
  pelvis.position.copy(pelvis.parent.worldToLocal(body.localToWorld(pelvisTarget)));
  worldQuaternion(pelvis,body.getWorldQuaternion(Q()).multiply(rotate).multiply(pelvisQ));
  const steer=clamp(Number.isFinite(state.steer)?state.steer:0,-1,1);
  for(const name of ['spine_01','spine_02','spine_03']){const bone=named.get(name);if(!bone)continue;restoreBind(bone);bone.quaternion.multiply(Q().setFromAxisAngle(new THREE.Vector3(0,0,1),compression*.13+steer*.025));}
  body.updateWorldMatrix(true,true);
  const trickId=typeof state.trick==='string'?state.trick:state.trick?.id,flipDuration={kickflip:.42,heelflip:.42,shuv:.48,'180':.5,tre:.72,nac:.7}[trickId];
  flipLift=mode==='air'&&flipDuration&&Number.isFinite(state.trickTime)?Math.sin(Math.PI*clamp(state.trickTime/flipDuration,0,1))*.14:0;
  const solves=[],pushIndex=state.stance===1?0:1,pushSign=pushIndex===1?1:-1;
  for(let i=0;i<2;i++){
   const l=legs[i],ref=footRefs[i],sole=V().set(i===0?-.005:.005,deckY+flipLift,i===0?-.215:.215);
   if(i===pushIndex&&active){sole.x+=pushSign*.255*out;sole.y-=.102*contact;sole.y+=.09*Math.sin(Math.PI*clamp((phase-.58)/.42,0,1));sole.z+=pushSign*(phase<.58?.28*smooth(phase/.58):.28*(1-smooth((phase-.58)/.42)));}
   const worldQ=body.getWorldQuaternion(Q()).multiply(rotate).multiply(ref.q),worldSole=body.localToWorld(sole.clone());
   const offset=ref.sole.clone().multiply(l.foot.getWorldScale(V())).applyQuaternion(worldQ);
   const target=worldSole.clone().sub(offset),pole=body.localToWorld(V().set(.8,.55,i===0?-.22:.22));
   solves.push({l,ref,target,pole,worldQ,worldSole});ankleTargets[i]=body.worldToLocal(target.clone());soleTargets[i]=sole;
  }
  // Move the pelvis only as far as real segment lengths require. No leg stretching.
  reachDrop=0;
  for(const s of solves){const h=s.l.hip.getWorldPosition(V()),k=s.l.knee.getWorldPosition(V()),a=s.l.foot.getWorldPosition(V()),max=(h.distanceTo(k)+k.distanceTo(a)-.004)/bodyScale.y,hLocal=body.worldToLocal(h),tLocal=body.worldToLocal(s.target.clone()),horizontal=(hLocal.x-tLocal.x)**2+(hLocal.z-tLocal.z)**2,vertical=Math.sqrt(Math.max(.0001,max*max-horizontal));reachDrop=Math.max(reachDrop,hLocal.y-tLocal.y-vertical);}
  if(reachDrop>0){const pos=body.worldToLocal(pelvis.getWorldPosition(V()));pos.y-=reachDrop;pelvis.position.copy(pelvis.parent.worldToLocal(body.localToWorld(pos)));body.updateWorldMatrix(true,true);}
  for(let i=0;i<solves.length;i++){const s=solves[i],error=solve(s.l,s.target,s.pole,s.worldQ);soleErrors[i]=s.l.foot.localToWorld(s.ref.sole.clone()).distanceTo(s.worldSole);if(i===0)plantError=error;else pushError=error;}
  const aim=state.aim,d=aim?.direction;lastAim=aim?.active!==false&&d&&['x','y','z'].every(k=>Number.isFinite(d[k]))&&Math.hypot(d.x,d.y,d.z)>.01;
  const shoulderPositions=arms.map(arm=>arm.hip?body.worldToLocal(arm.hip.getWorldPosition(V())):null);
  const lateral=shoulderPositions.every(Boolean)?shoulderPositions[1].clone().sub(shoulderPositions[0]):V().set(1,0,0);lateral.y=0;lateral.normalize();
  const forward=V().set(lateral.z,0,-lateral.x);
  for(let i=0;i<2;i++){
   const arm=arms[i];if(!arm.hip)continue;
   const swing=Math.sin(phase*Math.PI*2)*out*.10,side=i===0?-1:1,shoulder=shoulderPositions[i];
   // The host turns a model through90 degrees. Derive reach from the actual
   // shoulders instead of assuming the source armature faces a fixed axis.
   const localTarget=shoulder.clone().addScaledVector(lateral,side*(mode==='air'?.14:.08)).addScaledVector(forward,.15+steer*side*.04);
   localTarget.y-=mode==='air'?.18:.30;localTarget.y+=i===0?swing:-swing;
   let target=body.localToWorld(localTarget);
   let handQ=null;
   if(i===1&&lastAim){const direction=V().set(d.x,d.y,d.z).normalize(),shoulder=arm.hip.getWorldPosition(V());target=shoulder.addScaledVector(direction,.45);target.y-=.055;handQ=Q().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);}
   const localPole=shoulder.clone().addScaledVector(lateral,side*.4).addScaledVector(forward,-.2);localPole.y-=.15;
   armErrors[i]=solve(arm,target,body.localToWorld(localPole),handQ);
  }
  body.updateWorldMatrix(true,true);lastState=mode;lastStance=state.stance===1?1:0;
 }
 const vector=p=>p?{x:p.x,y:p.y,z:p.z}:null;
 return {reset,update,snapshot:()=>({source:'original-board-bound-two-foot-skate-IK',stance:lastStance,pushingFoot:lastStance===1?'left':'right',active:lastActive,phase,leftPlantError:plantError,rightTargetError:pushError,leftSoleError:soleErrors[0],rightSoleError:soleErrors[1],compression,reachDrop,flipLift,landing,mode:lastState,aiming:Boolean(lastAim),armTargetErrors:[...armErrors],calibratedFromSneakers:footRefs.map(r=>r.calibrated),anchors:soleTargets.map(vector),ankleTargets:ankleTargets.map(vector),weaponContract:{hand:'hand_r',barrelAxis:[0,0,-1],fingerAxis:[0,1,0],position:[0,.07,-.018],rotation:[Math.PI/2,0,0]}})};
}
