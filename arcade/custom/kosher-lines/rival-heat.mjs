import {KosherSim,defaultProfile,clamp} from './simulation.mjs';
const ROUTE=Object.freeze([[4,4],[4,-5],[5,-12],[4,-20],[5,-29],[11,-29],[14,-20],[14,-9],[9,5]]);
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Art follows waypoints with ordinary steering/push/charge/flip inputs. Scores
// are emitted by the same untouched skate simulation used for the human rider.
export class RivalHeat{
 constructor(){this.sim=new KosherSim(defaultProfile());this.sim.sessionMode='chapter';this.active=false;this.finished=false;this.elapsed=0;this.limit=180;this.waypoint=0;this.jumpClock=0;this.chargeClock=0;this.charging=false;this.popped=false;this.jumps=0;this.lastInput={};this.result=null;}
 start(){this.sim.start();this.sim.x=4;this.sim.z=6;this.sim.y=0;this.sim.yaw=0;this.active=true;this.finished=false;this.elapsed=0;this.waypoint=0;this.jumpClock=0;this.chargeClock=0;this.charging=false;this.popped=false;this.jumps=0;this.result=null;}
 step(dt,player,enabled=true){
  if(!enabled||!this.active||player.paused||!player.running||player.ended)return this.snapshot();
  dt=clamp(dt,0,.025);this.elapsed=Math.min(this.limit,this.elapsed+dt);const s=this.sim;
  let [x,z]=ROUTE[this.waypoint],dx=x-s.x,dz=z-s.z,gap=Math.hypot(dx,dz);
  if(gap<2){this.waypoint=(this.waypoint+1)%ROUTE.length;[x,z]=ROUTE[this.waypoint];dx=x-s.x;dz=z-s.z;gap=Math.hypot(dx,dz);}
  const error=angle(Math.atan2(-dx,-dz)-s.yaw),turn=clamp(error*1.7,-1,1);
  const control={steer:turn,push:s.speed<5.4&&Math.abs(error)<.8,brake:s.speed>6||Math.abs(error)>1.2&&s.speed>2,grind:true};
  this.jumpClock+=dt;
  if(s.grounded&&s.mode==='roll'&&s.speed>2&&Math.abs(error)<.35&&gap>4&&this.jumpClock>3.2){this.charging=true;this.chargeClock=0;this.popped=false;this.jumpClock=0;control.olliePressed=true;}
  if(this.charging){this.chargeClock+=dt;control.ollieHeld=true;if(this.chargeClock>=.4){control.ollieReleased=true;control.ollieHeld=false;this.charging=false;this.popped=true;this.jumps++;}}
  if(s.mode==='air'&&!s.trick&&s.airTime<.12&&this.popped){control.trick=this.jumps%3===0?'KeyK':'KeyF';this.popped=false;}
  s.step(dt,control);this.lastInput={...control};
  if(this.elapsed>=this.limit){s.bank();this.active=false;this.finished=true;const human=Math.floor(player.score||0),art=Math.floor(s.score);this.result={player:human,art,winner:human>art?'BLP':human<art?'Art':'Draw'};}
  return this.snapshot();
 }
 snapshot(){return {name:'Art',active:this.active,finished:this.finished,elapsed:this.elapsed,remaining:Math.max(0,this.limit-this.elapsed),score:this.sim.score,completedLines:this.sim.completedLines,waypoint:this.waypoint,simulation:this.sim.snapshot(),input:{...this.lastInput},result:this.result?{...this.result}:null,scoreSource:'live-KosherSim-bank-events'};}
}
