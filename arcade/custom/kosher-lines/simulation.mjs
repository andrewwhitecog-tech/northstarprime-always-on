// Reconstructed from retained Grok fragments; missing implementation is new code.
import { CITY_COLLIDERS } from './chapter.mjs';
import { PEACOCK_TRICK, PEACOCK_KIOSK_COLLIDER } from './peacock-signature.mjs';
export const LINE = Object.freeze(['DROP IN','LEDGE','FUNBOX','STAIR','QUARTER']);
export const TRICKS = Object.freeze({
  KeyF:{id:'kickflip',name:'Kickflip',duration:.42,points:120,flip:1,spin:0},
  KeyG:{id:'heelflip',name:'Heelflip',duration:.42,points:120,flip:-1,spin:0},
  KeyH:{id:'shuv',name:'Pop shove-it',duration:.48,points:150,flip:0,spin:1},
  KeyJ:{id:'180',name:'180',duration:.5,points:180,flip:0,spin:.5,bodySpin:.5},
  KeyK:{id:'tre',name:'Tre flip',duration:.72,points:400,flip:1,spin:1},
  KeyU:{id:'nac',name:'Nac flip',duration:.7,points:750,flip:2,spin:.5},
  KeyC:PEACOCK_TRICK
});
export const RAILS = Object.freeze([
  {id:'ledge',name:'LEDGE',x0:-2.55,z0:2.2,x1:-2.55,z1:-4.2,y0:.5,y1:.5},
  {id:'stair',name:'STAIR RAIL',x0:2.15,z0:-11.1,x1:2.15,z1:-16.8,y0:1.7,y1:.38},
  {id:'hubba',name:'HUBBA',x0:-2.15,z0:-11.2,x1:-2.15,z1:-16.6,y0:1.45,y1:.32},
  {id:'outer',name:'AURORA',x0:-12,z0:-14,x1:-12,z1:-24,y0:.62,y1:.62}
]);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inside=(x,z,a,b,c,d)=>x>=a&&x<=b&&z>=c&&z<=d;
export function terrain(x,z){
  if(x>=-1.7&&x<=1.7){
    if(z<=-6&&z>=-9.6)return .82;
    if(z< -5.2&&z> -6)return clamp((-5.2-z)/.8,0,1)*.82;
    if(z< -9.6&&z> -10.4)return clamp((z+10.4)/.8,0,1)*.82;
  }
  if(inside(x,z,.35,3.25,-17.2,-11))return clamp((z+17.2)/6.2,0,1)*1.55;
  if(inside(x,z,-3.35,-1.45,-16.7,-11))return clamp((z+16.7)/5.7,0,1)*1.28;
  if(inside(x,z,-3.3,3.3,-27.6,-21.4))return Math.sin(clamp((-21.4-z)/5.6,0,1)*Math.PI*.5)*3.15;
  if(inside(x,z,-3.2,-2,-4.6,2.6))return .32;
  return 0;
}
export const COLLIDERS=Object.freeze([
 PEACOCK_KIOSK_COLLIDER,
 {x:-14,z:1,w:5,d:1.8,h:.65},{x:13,z:-7,w:4.5,d:1.7,h:.65},
 {x:-17,z:-12,w:3,d:3,h:1.1},{x:17,z:-24,w:3,d:3,h:1.1},
 ...CITY_COLLIDERS
]);
export function defaultProfile(){return {version:1,best:0,lines:0,xp:0,bestCombo:0,sessions:0,theme:0};}
export function parseProfile(raw){
  try{const p=JSON.parse(raw);if(!p||p.version!==1)return defaultProfile();
    const out=defaultProfile();for(const key of ['best','lines','xp','bestCombo','sessions'])out[key]=clamp(Number.isFinite(p[key])?Math.floor(p[key]):0,0,1e9);
    out.theme=clamp(Number.isInteger(p.theme)?p.theme:0,0,2);return out;
  }catch{return defaultProfile();}
}
function nearestRail(r,x,z){
 const dx=r.x1-r.x0,dz=r.z1-r.z0,l2=dx*dx+dz*dz;
 const u=clamp(((x-r.x0)*dx+(z-r.z0)*dz)/l2,0,1);
 return {u,x:r.x0+u*dx,z:r.z0+u*dz,y:r.y0+u*(r.y1-r.y0),distance:Math.hypot(x-(r.x0+u*dx),z-(r.z0+u*dz))};
}
export class KosherSim{
 constructor(profile=defaultProfile()){this.sessionMode='arcade';this.profile=profile;this.events=[];this.serial=0;this.reset(false);}
 event(type,detail={}){this.events.push({serial:++this.serial,type,time:this.elapsed,...detail});if(this.events.length>48)this.events.shift();}
 reset(start=true){
  this.x=0;this.z=5;this.y=0;this.yaw=0;this.vx=0;this.vz=0;this.vy=0;this.speed=0;
  this.grounded=true;this.mode='roll';this.charge=0;this.charging=false;this.trick=null;this.trickTime=0;
  this.unbanked=0;this.score=0;this.multiplier=1;this.comboLeft=0;this.comboTricks=[];
  this.grinding=null;this.grindDirection=1;this.grindU=0;this.grindTime=0;this.balance=0;this.manualTime=0;
  this.bailTime=0;this.bails=0;this.line=0;this.completedLines=0;this.elapsed=0;this.timeLeft=120;
  this.running=start;this.paused=false;this.ended=false;this.stance=0;this.airTime=0;this.airStart=null;this.pendingRail=null;this.manualGardenTime=0;this.grindLock=0;
  this.flags={funbox:false,stair:false,quarter:false};this.stats={ollies:0,tricks:0,grinds:0,manuals:0,landings:0,distance:0};
  this.event('reset',{started:start});if(start)this.profile.sessions++;
 }
 start(){this.reset(true);}
 togglePause(){if(this.running&&!this.ended){this.paused=!this.paused;this.event(this.paused?'paused':'resumed');}}
 advanceLine(name){
  if(LINE[this.line]!==name)return;
  this.line++;this.event('line-step',{name,line:this.line});
  if(this.line===LINE.length){this.completedLines++;this.profile.lines++;this.add(500,'Line clear');this.line=0;this.event('line-clear',{total:this.completedLines});}
 }
 add(base,label){
  const stale=this.comboTricks.filter(x=>x===label).length;
  const points=Math.round(base*Math.max(.35,1-stale*.18));
  this.unbanked+=points*this.multiplier;this.comboTricks.push(label);
  this.multiplier=Math.min(12,1+Math.floor(this.comboTricks.length/2));this.comboLeft=2.15;
  this.event('score',{label,points,pending:Math.round(this.unbanked)});
 }
 bank(){
  if(this.unbanked<=0)return;
  const value=Math.round(this.unbanked);this.score+=value;this.profile.xp+=value;
  this.profile.best=Math.max(this.profile.best,this.score);this.profile.bestCombo=Math.max(this.profile.bestCombo,value);
  this.event('bank',{value,total:this.score});this.unbanked=0;this.multiplier=1;this.comboTricks=[];this.comboLeft=0;
 }
 pop(){
  if(this.bailTime>0||(!this.grounded&&!this.grinding))return false;
  this.grindLock=.42;this.vy=6.2+Math.min(.45,this.charge)*8;this.charge=0;this.charging=false;
  if(this.grinding){const r=this.grinding;this.pendingRail={rail:r.id,duration:this.grindTime};const dx=r.x1-r.x0,dz=r.z1-r.z0,len=Math.hypot(dx,dz);this.vx=dx/len*this.speed*this.grindDirection;this.vz=dz/len*this.speed*this.grindDirection;this.grinding=null;this.balance=0;}
  this.grounded=false;this.mode='air';this.airTime=0;this.airStart={x:this.x,z:this.z};this.stats.ollies++;this.event('ollie');return true;
 }
 tryTrick(code){
  if(this.grounded||this.bailTime>0||this.trick||!TRICKS[code])return false;
  if(TRICKS[code].requiredStance!==undefined&&this.stance!==TRICKS[code].requiredStance)return false;
  this.trick=TRICKS[code];this.trickTime=0;this.event('trick-start',{id:this.trick.id});return true;
 }
 bail(reason){
  if(this.bailTime>0)return;const lost=Math.round(this.unbanked);
  this.bailTime=1.1;this.bails++;this.mode='bail';this.speed*=.2;this.vx*=.2;this.vz*=.2;this.vy=0;
  this.y=terrain(this.x,this.z);this.grounded=true;this.grinding=null;this.trick=null;this.trickTime=0;
  this.unbanked=0;this.multiplier=1;this.comboLeft=0;this.comboTricks=[];this.balance=0;this.manualTime=0;
  this.flags={funbox:false,stair:false,quarter:false};this.pendingRail=null;this.manualGardenTime=0;this.line=0;this.event('bail',{reason,lost});
 }
 land(height){
  if(this.trick&&this.trickTime<this.trick.duration*.84){this.bail('Catch the board before landing');return;}
  if(this.trick){this.add(this.trick.points,this.trick.name);this.stats.tricks++;this.event('landed-trick',{id:this.trick.id,x:this.x,z:this.z,stance:this.stance});if(this.trick.id==='180')this.stance=1-this.stance;}
  if(this.flags.funbox){this.add(120,'Funbox');this.advanceLine('FUNBOX');}
  if(this.flags.stair&&this.z< -17.3){this.add(250,'Stair gap');this.advanceLine('STAIR');}
  if(this.flags.quarter&&height<1.2){this.add(300,'Quarter return');this.advanceLine('QUARTER');}
  if(this.pendingRail){this.event('grind-landed',{...this.pendingRail,x:this.x,z:this.z});this.pendingRail=null;}
  this.flags={funbox:false,stair:false,quarter:false};this.trick=null;this.trickTime=0;
  this.y=height;this.vy=0;this.grounded=true;this.mode='roll';this.stats.landings++;this.event('land',{height});
 }
 tryGrind(){
  if(this.grindLock>0||this.grounded||this.vy>1||this.speed<1.5||this.trick&&this.trickTime<this.trick.duration*.84)return false;
  let found=null;
  for(const r of RAILS){const n=nearestRail(r,this.x,this.z);if(n.distance<.95&&Math.abs(this.y-n.y)<.7&&(!found||n.distance<found.n.distance))found={r,n};}
  if(!found)return false;
  const {r,n}=found,dx=r.x1-r.x0,dz=r.z1-r.z0;
  this.grindDirection=this.vx*dx+this.vz*dz>=0?1:-1;this.grinding=r;this.grindU=n.u;this.grindTime=0;this.balance=0;
  this.x=n.x;this.z=n.z;this.y=n.y;this.vy=0;this.trick=null;this.mode='grind';this.grounded=false;this.stats.grinds++;
  this.yaw=Math.atan2(-dx*this.grindDirection,-dz*this.grindDirection);this.event('grind-start',{rail:r.id});return true;
 }
 finish(){this.bank();this.running=false;this.ended=true;this.profile.best=Math.max(this.profile.best,this.score);this.event('session-end',{score:this.score,lines:this.completedLines});}
 step(dt,input={}){
  dt=clamp(dt,0,.025);if(!this.running||this.paused||this.ended)return;
  this.grindLock=Math.max(0,this.grindLock-dt);this.elapsed+=dt;this.timeLeft=this.sessionMode==='chapter'?120:Math.max(0,120-this.elapsed);if(this.timeLeft===0){this.finish();return;}
  this.comboLeft=Math.max(0,this.comboLeft-dt);if(this.comboLeft===0&&this.grounded&&this.mode!=='manual')this.bank();
  if(this.bailTime>0){this.bailTime=Math.max(0,this.bailTime-dt);if(!this.bailTime)this.mode='roll';return;}
  const steer=clamp(input.steer||0,-1,1);
  if(input.olliePressed&&(this.grounded||this.grinding)){this.charging=true;this.charge=0;}
  if(input.ollieHeld&&this.charging)this.charge=Math.min(.45,this.charge+dt);
  if(input.ollieReleased&&this.charging){if(!this.pop()){this.charging=false;this.charge=0;}}
  if(input.ollieTap)this.pop();
  if(input.trick)this.tryTrick(input.trick);
  if(this.trick)this.trickTime+=dt;
  if(this.grinding){
    const r=this.grinding,len=Math.hypot(r.x1-r.x0,r.z1-r.z0);
    this.grindTime+=dt;this.speed=Math.max(1.5,this.speed-.45*dt);
    this.balance+=(Math.sin(this.elapsed*2.9)*.14+this.grindDirection*.04+steer*.9)*dt;
    this.grindU+=this.speed*dt/len*this.grindDirection;
    this.x=r.x0+(r.x1-r.x0)*clamp(this.grindU,0,1);this.z=r.z0+(r.z1-r.z0)*clamp(this.grindU,0,1);this.y=r.y0+(r.y1-r.y0)*clamp(this.grindU,0,1);
    this.unbanked+=25*this.multiplier*dt;this.comboLeft=1.4;
    if(r.name==='LEDGE'&&this.grindTime>.2)this.advanceLine('LEDGE');
    if(Math.abs(this.balance)>1){this.bail('Rail balance lost');return;}
    if(this.grindU<0||this.grindU>1||input.brake){
      this.add(80,r.name+' grind');this.pendingRail={rail:r.id,duration:this.grindTime};this.grindLock=.42;const dx=(r.x1-r.x0)/len,dz=(r.z1-r.z0)/len;
      this.vx=dx*this.speed*this.grindDirection;this.vz=dz*this.speed*this.grindDirection;this.grinding=null;this.mode='air';this.vy=1.6;this.airTime=0;this.event('grind-exit');
    }
    return;
  }
  const oldX=this.x,oldZ=this.z,oldHeight=terrain(this.x,this.z);
  this.yaw+=steer*2.35*dt*(.55+.45/(1+this.speed*.12));
  const forwardX=-Math.sin(this.yaw),forwardZ=-Math.cos(this.yaw);
  if(this.grounded){
    if(input.push)this.speed+=11*dt;else this.speed-=.65*dt;
    if(input.brake)this.speed-=17*dt;
    this.speed=clamp(this.speed,0,11.8);
    const grip=1-Math.exp(-dt*(input.brake?4:10));
    this.vx+=(forwardX*this.speed-this.vx)*grip;this.vz+=(forwardZ*this.speed-this.vz)*grip;
  }else{
    this.airTime+=dt;this.vy-=18*dt;
    this.vx+=forwardX*(input.push?.3:0)*dt;this.vz+=forwardZ*(input.push?.3:0)*dt;
    this.y+=this.vy*dt;
  }
  const nx=this.x+this.vx*dt,nz=this.z+this.vz*dt,nh=terrain(nx,nz);
  let blocked=this.grounded&&nh>this.y+.34;
  for(const b of COLLIDERS)if(Math.abs(nx-b.x)<b.w/2+.28&&Math.abs(nz-b.z)<b.d/2+.28&&this.y<b.h-.06)blocked=true;
  if(Math.abs(nx)>23||nz>15||nz< -34)blocked=true;
  if(blocked){
    if(this.speed>7.5){this.bail('Hard impact');return;}
    this.speed*=Math.exp(-5*dt);this.vx*=.6;this.vz*=.6;
  }else{this.x=nx;this.z=nz;}
  this.stats.distance+=Math.hypot(this.x-oldX,this.z-oldZ);
  const ground=terrain(this.x,this.z);
  if(this.grounded){
    const slope=(ground-oldHeight)/Math.max(dt,.001);this.speed=clamp(this.speed-slope*.16*dt,0,11.8);this.y=ground;
    if(Math.abs(this.x)<3.3&&this.z< -26.6&&this.vz< -1.5){
      this.vy=5.6;this.vz=Math.abs(this.vz)*.65;this.vx*=.5;this.yaw=Math.PI;this.grounded=false;this.mode='air';this.flags.quarter=true;this.airTime=0;this.event('quarter-launch');
    }
    if(input.manual&&this.speed>1.4){
      if(this.mode!=='manual'){this.mode='manual';this.manualTime=0;this.manualGardenTime=0;this.event('manual-start');}
      this.manualTime+=dt;if(this.x>5&&this.x<16&&this.z< -9&&this.z> -26)this.manualGardenTime+=dt;this.balance+=(Math.sin(this.elapsed*3)*.24+.2+this.balance*.8+steer*1.1)*dt;
      this.unbanked+=15*this.multiplier*dt;this.comboLeft=1.4;
      if(Math.abs(this.balance)>1){this.bail('Manual balance lost');return;}
    }else if(this.mode==='manual'){
      if(this.manualTime>.35){this.add(Math.round(this.manualTime*35),'Manual');this.stats.manuals++;this.event('manual-complete',{duration:this.manualTime,gardenDuration:this.manualGardenTime,x:this.x,z:this.z});}
      this.mode='roll';this.balance=0;this.manualTime=0;
    }
  }else{
    if(Math.abs(this.x)<1.8&&this.z< -5.5&&this.z> -10.4&&this.y>ground+.12)this.flags.funbox=true;
    if(this.x>.2&&this.x<3.4&&this.z< -10.8&&this.z> -17.3&&this.y>ground+.3)this.flags.stair=true;
    if(input.grind!==false&&this.tryGrind())return;
    if(this.vy<=0&&this.y<=ground+.025)this.land(ground);
  }
  if(this.line===0&&this.speed>4&&this.z<2)this.advanceLine('DROP IN');
 }
 snapshot(){return {sessionMode:this.sessionMode,stance:this.stance,x:this.x,y:this.y,z:this.z,yaw:this.yaw,speed:this.speed,vx:this.vx,vz:this.vz,vy:this.vy,grounded:this.grounded,mode:this.mode,charge:this.charge,trick:this.trick?.id||null,trickTime:this.trickTime,balance:this.balance,rail:this.grinding?.id||null,grindTime:this.grindTime,score:this.score,pending:Math.round(this.unbanked),multiplier:this.multiplier,line:this.line,next:LINE[this.line],completedLines:this.completedLines,bails:this.bails,timeLeft:this.timeLeft,elapsed:this.elapsed,running:this.running,paused:this.paused,ended:this.ended,stats:{...this.stats},profile:{...this.profile},events:this.events.map(e=>({...e}))};}
}
