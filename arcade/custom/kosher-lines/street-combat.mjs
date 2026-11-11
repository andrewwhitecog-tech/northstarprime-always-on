// Local single-player fictional combat. No resident is an attack target.
// step(dt, {player,aim:{origin,direction},fire,reload,running,paused,colliders}).
// Player is read-only. Colliders accept simulation {x,z,w,d,h,y?} or min/max AABBs.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const point=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const copy=p=>({x:p.x,y:p.y,z:p.z});
export const COMBAT_RULES=Object.freeze({magazine:8,reserve:64,shotInterval:.22,reloadSeconds:1.25,range:42,damage:34,health:100,enemyDamage:9,enemyRange:17,recoveryDelay:6,recoveryRate:7});
export const TOKEN_SITES=Object.freeze([
 [-5,6],[-9,2],[-6,-4],[-11,-8],[-6,-15],[-14,-21],[-9,-26],[-5,-31],
 [5,3],[10,-3],[6,-8],[11,-15],[6,-21],[12,-25],[6,-30],[3,10]
].map(([x,z],i)=>Object.freeze({id:'star-'+(i+1),x,y:.68,z})));
export const CREW_SITES=Object.freeze([
 {id:'sentry-west',x:-6,z:-8},{id:'sentry-east',x:6,z:-16},
 {id:'sentry-aurora',x:-6,z:-23},{id:'sentry-archive',x:6,z:-28}
].map(p=>Object.freeze({...p,y:1.05,health:100,radius:.62,kind:'fictional-sentry'})));
export function colliderBounds(b){
 if(!b||b.solid===false)return null;
 if(['minX','maxX','minY','maxY','minZ','maxZ'].every(k=>Number.isFinite(b[k])))return b;
 if(!['x','z','w','d','h'].every(k=>Number.isFinite(b[k]))||b.w<=0||b.d<=0||b.h<=0)return null;
 return {minX:b.x-b.w/2,maxX:b.x+b.w/2,minY:finite(b.y),maxY:finite(b.y)+b.h,minZ:b.z-b.d/2,maxZ:b.z+b.d/2};
}
// Returns ray distance; null is a miss. Direction must be normalized.
export function rayBox(origin,direction,box,max=Infinity){
 let lo=0,hi=max;
 for(const [k,a,b] of [['x','minX','maxX'],['y','minY','maxY'],['z','minZ','maxZ']]){
  if(Math.abs(direction[k])<1e-9){if(origin[k]<box[a]||origin[k]>box[b])return null;continue;}
  let t0=(box[a]-origin[k])/direction[k],t1=(box[b]-origin[k])/direction[k];
  if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return null;
 }return lo;
}
function raySphere(o,d,c,r,max){const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,q=x*x+y*y+z*z-r*r,disc=b*b-q;if(disc<0)return null;const near=-b-Math.sqrt(disc),far=-b+Math.sqrt(disc),t=near>=0?near:far>=0?0:null;return t!==null&&t<=max?t:null;}
function normalized(p){if(!point(p))return null;const n=Math.hypot(p.x,p.y,p.z);return n>1e-6?{x:p.x/n,y:p.y/n,z:p.z/n}:null;}
const at=(o,d,t)=>({x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t});
export class StreetCombat{
 constructor(saved=null){this.time=0;this.serial=0;this.events=[];this.tracers=[];this.tracerSerial=0;this.health=100;this.ammo=8;this.reserve=64;this.reloadLeft=0;this.cooldown=0;this.lastDamage=-100;this.recoveryLeft=0;this.tokens=new Set();this.targets=CREW_SITES.map((s,i)=>({...s,homeX:s.x,homeZ:s.z,phase:i*1.7,fireLeft:2+i*.6,disabled:false,hitFlash:0}));if(saved)this.restore(saved);}
 event(type,detail={}){this.events.push({serial:++this.serial,type,time:this.time,...detail});if(this.events.length>96)this.events.shift();}
 startReload(){if(this.reloadLeft>0||this.ammo>=8||this.reserve<=0||this.recoveryLeft>0)return false;this.reloadLeft=COMBAT_RULES.reloadSeconds;this.event('reload-start');return true;}
 obstructed(o,d,max,colliders){let distance=max;for(const c of colliders){const b=colliderBounds(c);if(!b)continue;const t=rayBox(o,d,b,distance);if(t!==null)distance=Math.min(distance,t);}return distance;}
 tracer(o,end,kind){this.tracers.push({id:++this.tracerSerial,origin:copy(o),end:copy(end),kind,life:.105});if(this.tracers.length>32)this.tracers.shift();}
 shoot(player,aim,colliders){
  if(this.cooldown>0||this.reloadLeft>0||this.recoveryLeft>0)return;
  if(this.ammo<=0){this.startReload();return;}
  const d=normalized(aim?.direction),o=aim?.origin;if(!d||!point(o))return;
  // Reject detached muzzle origins; the live camera aims from the rider vicinity.
  if(Math.hypot(o.x-player.x,o.z-player.z)>3||Math.abs(o.y-(player.y+1))>3)return;
  this.ammo--;this.cooldown=COMBAT_RULES.shotInterval;
  let distance=this.obstructed(o,d,COMBAT_RULES.range,colliders),target=null;
  for(const t of this.targets){if(t.disabled)continue;const hit=raySphere(o,d,t,t.radius,distance);if(hit!==null&&hit<distance){distance=hit;target=t;}}
  const end=at(o,d,distance);this.tracer(o,end,'player');
  this.event('shot',{origin:copy(o),end,airborne:!player.grounded&&player.mode==='air',trick:typeof player.trick==='string'?player.trick:player.trick?.id||null});
  if(target){target.health=Math.max(0,target.health-COMBAT_RULES.damage);target.hitFlash=.18;const airborne=!player.grounded&&player.mode==='air';this.event('target-hit',{target:target.id,damage:COMBAT_RULES.damage,health:target.health,airborne,trick:typeof player.trick==='string'?player.trick:player.trick?.id||null,x:player.x,y:player.y,z:player.z});if(target.health===0){target.disabled=true;this.event('target-disabled',{target:target.id,airborne});}}
 }
 step(dt,{player,aim,fire=false,reload=false,running,paused,colliders=[]}={}){
  if(!point(player)||!Number.isFinite(dt)||dt<=0||paused||player.paused||running===false||player.running===false||player.ended)return this.snapshot();
  // Large/background-tab gaps never cause a burst of shots or enemy damage.
  dt=Math.min(dt,.1);colliders=Array.isArray(colliders)?colliders:[];
  this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
  this.tracers=this.tracers.filter(t=>(t.life-=dt)>0);
  for(const t of this.targets)t.hitFlash=Math.max(0,t.hitFlash-dt);
  if(this.recoveryLeft>0){this.recoveryLeft=Math.max(0,this.recoveryLeft-dt);if(this.recoveryLeft===0){this.health=100;this.lastDamage=this.time;this.event('recovered');}return this.snapshot();}
  if(this.reloadLeft>0){this.reloadLeft=Math.max(0,this.reloadLeft-dt);if(this.reloadLeft===0){const n=Math.min(8-this.ammo,this.reserve);this.ammo+=n;this.reserve-=n;this.event('reload-complete',{ammo:this.ammo,reserve:this.reserve});}}
  if(reload)this.startReload();if(fire&&player.mode!=='bail')this.shoot(player,aim,colliders);
  if(player.mode!=='bail')for(const site of TOKEN_SITES){if(!this.tokens.has(site.id)&&Math.hypot(player.x-site.x,player.z-site.z)<.85&&Math.abs(player.y+.65-site.y)<.9){this.tokens.add(site.id);this.reserve=Math.min(64,this.reserve+4);this.event('token-collected',{id:site.id,total:this.tokens.size});}}
  for(const t of this.targets){
   if(t.disabled)continue;
   const nx=t.homeX+Math.sin(this.time*.6+t.phase)*1.15,nz=t.homeZ+Math.cos(this.time*.4+t.phase)*.65;
   const blocked=colliders.some(c=>{const b=colliderBounds(c);return b&&nx>b.minX-.4&&nx<b.maxX+.4&&nz>b.minZ-.4&&nz<b.maxZ+.4&&t.y<b.maxY+.4;});
   if(!blocked){t.x=nx;t.z=nz;}
   t.fireLeft=Math.max(0,t.fireLeft-dt);
   const head={x:player.x,y:player.y+1,z:player.z},gap=Math.hypot(head.x-t.x,head.y-t.y,head.z-t.z);
   if(t.fireLeft===0&&gap<COMBAT_RULES.enemyRange&&gap>1&&player.mode!=='bail'){
    const d=normalized({x:head.x-t.x,y:head.y-t.y,z:head.z-t.z});
    if(this.obstructed(t,d,gap,colliders)>=gap-.05){t.fireLeft=2.8;this.tracer(t,head,'enemy');this.health=Math.max(0,this.health-COMBAT_RULES.enemyDamage);this.lastDamage=this.time;this.event('player-hit',{source:t.id,damage:COMBAT_RULES.enemyDamage,health:this.health});if(this.health===0){this.recoveryLeft=2.6;this.event('player-downed');break;}}
   }
  }
  if(this.time-this.lastDamage>COMBAT_RULES.recoveryDelay&&this.health<100)this.health=Math.min(100,this.health+COMBAT_RULES.recoveryRate*dt);
  return this.snapshot();
 }
 snapshot(){return {version:1,time:this.time,health:this.health,ammo:this.ammo,reserve:this.reserve,reloading:this.reloadLeft>0,reloadLeft:this.reloadLeft,recoveryLeft:this.recoveryLeft,downed:this.recoveryLeft>0,tokenCount:this.tokens.size,collectedTokens:[...this.tokens],tokens:TOKEN_SITES.map(t=>({...t,collected:this.tokens.has(t.id)})),targets:this.targets.map(t=>({id:t.id,kind:t.kind,x:t.x,y:t.y,z:t.z,radius:t.radius,health:t.health,disabled:t.disabled,hitFlash:t.hitFlash})),tracers:this.tracers.map(t=>({...t,origin:copy(t.origin),end:copy(t.end)})),events:this.events.map(e=>({...e}))};}
 serialize(){return JSON.stringify({version:1,time:this.time,health:this.health,ammo:this.ammo,reserve:this.reserve,collectedTokens:[...this.tokens],targets:this.targets.map(t=>({id:t.id,health:t.health})),recoveryLeft:this.recoveryLeft});}
 restore(raw){
  let s;try{s=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}
  if(!s||s.version!==1||!Number.isFinite(s.time)||s.time<0||!Number.isFinite(s.health)||s.health<0||s.health>100||!Number.isInteger(s.ammo)||s.ammo<0||s.ammo>8||!Number.isInteger(s.reserve)||s.reserve<0||s.reserve>64||!Array.isArray(s.collectedTokens)||s.collectedTokens.some(id=>!TOKEN_SITES.some(t=>t.id===id))||!Array.isArray(s.targets)||s.targets.length!==CREW_SITES.length||s.targets.some((t,i)=>t.id!==CREW_SITES[i].id||!Number.isFinite(t.health)||t.health<0||t.health>100)||!Number.isFinite(s.recoveryLeft)||s.recoveryLeft<0||s.recoveryLeft>2.6)return false;
  this.time=s.time;this.health=s.health;this.ammo=s.ammo;this.reserve=s.reserve;this.tokens=new Set(s.collectedTokens);this.recoveryLeft=this.health===0?Math.max(.01,s.recoveryLeft):s.recoveryLeft;this.lastDamage=this.time;this.cooldown=0;this.reloadLeft=0;this.events=[];this.tracers=[];
  s.targets.forEach((v,i)=>{this.targets[i].health=v.health;this.targets[i].disabled=v.health===0;});return true;
 }
}
