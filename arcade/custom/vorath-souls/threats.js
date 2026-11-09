(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VorathThreats=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ROLES={pursuer:{hp:55,speed:132,range:58,windup:.42,recover:.42,damage:11,hue:335},flanker:{hp:50,speed:154,range:64,windup:.55,recover:.48,damage:12,hue:275},charger:{hp:65,speed:110,range:250,windup:.8,recover:.75,damage:15,hue:30},hexer:{hp:48,speed:110,range:390,windup:.9,recover:.65,damage:12,hue:185},bulwark:{hp:130,speed:82,range:82,windup:.85,recover:.8,damage:18,hue:210},reaver:{hp:108,speed:135,range:230,windup:.7,recover:.9,damage:14,hue:355},guard:{hp:240,speed:80,range:92,windup:.68,recover:.7,damage:22,hue:38}};
 const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
 function create(role,x,y){const r=ROLES[role];if(!r)throw Error('Unknown thrall role');const elite=role==='bulwark'||role==='reaver';return{role,type:role==='guard'?'guard':'thrall',elite,x,y,r:role==='guard'?34:elite?26:19,hp:r.hp,maxHp:r.hp,maxStun:role==='guard'?100:elite?75:46,stun:0,staggerT:0,staggerMax:0,speed:r.speed,state:'idle',stateT:0,cooldown:.65,hitFlash:0,dead:false,hitBy:new Set(),windupKind:'swipe',faceX:-1,faceY:0,phase:1,attackIndex:0,comboLeft:0,chargeHit:false};}
 function phaseTwo(e,events){if(e.type!=='guard'||e.phase!==1||e.hp>e.maxHp*.5||e.dead)return false;e.phase=2;e.hp=Math.max(e.hp,e.maxHp*.5);e.stun=0;e.staggerT=0;e.state='awakening';e.stateT=1.15;e.cooldown=1.1;events.phase(e);return true;}
 function step(e,p,dt,events){
  const r=ROLES[e.role],toP=unit(p.x-e.x,p.y-e.y),distance=Math.hypot(p.x-e.x,p.y-e.y);e.stateT=Math.max(0,e.stateT-dt);e.cooldown=Math.max(0,e.cooldown-dt);
  if(e.state==='awakening'){if(e.stateT<=0){events.ring(e);e.state='recover';e.stateT=.8;}return;}
  if(e.state==='charge'){
   e.x+=e.faceX*(e.type==='guard'?430:520)*dt;e.y+=e.faceY*(e.type==='guard'?430:520)*dt;
   if(!e.chargeHit&&Math.hypot(p.x-e.x,p.y-e.y)<e.r+p.r+15){e.chargeHit=true;events.strike(e,r.damage);}
   if(e.stateT<=0){if(e.comboLeft>0){e.comboLeft--;e.state='windup';e.stateT=.45;e.windupKind='rush';const d=unit(p.x-e.x,p.y-e.y);e.faceX=d.x;e.faceY=d.y;}else{e.state='recover';e.stateT=r.recover;}}return;
  }
  if(e.state==='windup'){
   if(e.stateT<=0){
    events.attack(e);
    if(e.windupKind==='rush'){e.state='charge';e.stateT=.34;e.chargeHit=false;}
    else{if(e.windupKind==='bolt')events.bolt(e);else if(e.windupKind==='ring')events.ring(e);else if(distance<r.range+14)events.strike(e,r.damage);e.state='strike';e.stateT=.15;}
   }return;
  }
  if(e.state==='strike'){if(e.stateT<=0){e.state='recover';e.stateT=r.recover;}return;}
  if(e.state==='recover'){if(e.stateT<=0)e.state='idle';return;}
  e.faceX=toP.x;e.faceY=toP.y;
  const phase2=e.type==='guard'&&e.phase===2,reach=phase2?340:r.range;
  if(distance<reach&&e.cooldown<=0){
   e.state='windup';e.stateT=phase2?.7:r.windup;e.attackIndex++;
   e.windupKind=e.role==='hexer'?'bolt':e.role==='charger'||e.role==='reaver'?'rush':phase2?(e.attackIndex%2?'ring':'rush'):'swipe';
   e.comboLeft=e.role==='reaver'||(phase2&&e.windupKind==='rush')?1:0;e.cooldown=e.role==='hexer'?2.1:phase2?1.55:1.3;
   return;
  }
  let dx=toP.x,dy=toP.y,speed=phase2?110:r.speed;
  if(e.role==='hexer'){const radial=distance<240?-1:distance>310?1:0;dx=toP.x*radial-toP.y*.38;dy=toP.y*radial+toP.x*.38;}
  else if(e.role==='flanker'&&distance<220&&e.cooldown>.15){dx=toP.x*.2-toP.y;dy=toP.y*.2+toP.x;}
  else if(distance<r.range*.8)return;
  const move=unit(dx,dy);e.x+=move.x*speed*dt;e.y+=move.y*speed*dt;
 }
 function shielded(e,attacker,kind){if(e.role!=='bulwark'||e.dead||e.staggerT>0||!['idle','windup'].includes(e.state)||kind==='heavy')return false;const d=unit(attacker.x-e.x,attacker.y-e.y);return d.x*e.faceX+d.y*e.faceY>.25;}
 return{ROLES,create,phaseTwo,step,shielded};
});
