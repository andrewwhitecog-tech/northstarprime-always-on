// Optional local single-player activity. Receives real live simulation samples only.
// No campaign awards, teleports, replay injection, network rewards or state setters.
export const COURIER_ROUTE=Object.freeze({id:'last-light-rehearsal-v1',name:'The last light run',limit:60,countdown:3,
 start:Object.freeze({id:'dispatch',name:'Dispatch seal',x:-10,z:6,radius:1.9}),
 gates:Object.freeze([
  Object.freeze({id:'west-walk',name:'West walk',x:-10,z:-5,radius:1.9}),
  Object.freeze({id:'parcel-court',name:'Parcel court',x:-14,z:-14,radius:1.9}),
  Object.freeze({id:'aurora-return',name:'Aurora return',x:-14,z:-25,radius:1.9}),
  Object.freeze({id:'last-doorstep',name:'Last doorstep',x:-6,z:-31,radius:1.9})
 ])});
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export function defaultCourierRecord(){return {version:1,bestMs:null,attempts:0,completions:0};}
export function parseCourierRecord(raw){try{const p=JSON.parse(raw);if(!p||p.version!==1)return defaultCourierRecord();return {version:1,bestMs:Number.isFinite(p.bestMs)&&p.bestMs>0&&p.bestMs<=COURIER_ROUTE.limit*1000?Math.round(p.bestMs):null,attempts:Math.max(0,Math.min(1e7,Math.floor(finite(p.attempts)))),completions:Math.max(0,Math.min(1e7,Math.floor(finite(p.completions))))};}catch{return defaultCourierRecord();}}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
export class CourierTrial{
 constructor(record=defaultCourierRecord()){this.record=record;this.enabled=false;this.state='hidden';this.elapsed=0;this.countdown=COURIER_ROUTE.countdown;this.next=0;this.offRoute=0;this.reason='';this.revision=0;this.events=[];this.lastSample=null;this.eventFloor=0;this.lastResultMs=null;this.newBest=false;}
 get active(){return this.state==='countdown'||this.state==='running';}
 event(type,detail={}){this.revision++;this.events.push({type,elapsed:this.elapsed,...detail});if(this.events.length>32)this.events.shift();}
 setEnabled(enabled){enabled=Boolean(enabled);if(this.enabled===enabled)return;if(this.active)this.fail('Route put away. This attempt is not recorded as a finish.');this.enabled=enabled;this.state=enabled?'armed':'hidden';this.next=0;this.elapsed=0;this.reason='';this.lastSample=null;this.event('course-'+(enabled?'opened':'closed'));}
 availability(sim){const gap=distance(sim,COURIER_ROUTE.start);return {distance:gap,atStart:gap<COURIER_ROUTE.start.radius,stopped:sim.grounded&&Math.hypot(sim.vx,sim.vz)<1.2&&sim.speed<1.5,chapterMode:sim.sessionMode==='chapter',rideRunning:sim.running&&!sim.paused&&!sim.ended,canStart:this.enabled&&!this.active&&gap<COURIER_ROUTE.start.radius&&sim.grounded&&Math.hypot(sim.vx,sim.vz)<1.2&&sim.speed<1.5&&sim.sessionMode==='chapter'&&sim.running&&!sim.paused&&!sim.ended};}
 begin(sim){if(!this.availability(sim).canStart)return false;
  this.state='countdown';this.elapsed=0;this.countdown=COURIER_ROUTE.countdown;this.next=0;this.offRoute=0;this.reason='';this.lastResultMs=null;this.newBest=false;this.eventFloor=sim.serial;this.lastSample={x:sim.x,z:sim.z,elapsed:sim.elapsed};this.record.attempts++;this.event('attempt-start',{attempt:this.record.attempts});return true;
 }
 fail(reason){if(!this.active)return;this.state='failed';this.reason=reason;this.event('failed',{reason,passed:this.next});}
 cancel(reason='Ride reset. Return to the dispatch seal for another attempt.'){if(this.active)this.fail(reason);}
 consume(event){if(!this.active||event.serial<=this.eventFloor)return;if(event.type==='bail')this.fail('The practice parcel fell during the bail. Return to the dispatch seal and retry.');if(event.type==='reset')this.cancel();if(event.type==='session-end')this.fail('The ride ended before delivery. Retry in the no-clock chapter mode.');}
 step(sim){if(!this.active)return;
  if(!sim.running||sim.ended){this.fail('The ride stopped before delivery. Return to dispatch and retry.');return;}if(sim.paused)return;
  if(sim.sessionMode!=='chapter'){this.fail('Courier rehearsal uses the no-clock chapter ride.');return;}
  const sample={x:sim.x,z:sim.z,elapsed:sim.elapsed},previous=this.lastSample;this.lastSample=sample;if(!previous)return;
  const dt=sample.elapsed-previous.elapsed;if(dt<0){this.cancel();return;}if(dt===0)return;if(!Number.isFinite(dt)||dt>.1||!Number.isFinite(sample.x)||!Number.isFinite(sample.z)){this.fail('The route clock was interrupted. Start a fresh attempt.');return;}
  const travelled=distance(sample,previous);if(travelled>18*dt+.35){this.fail('The ride was reset or moved outside the route. Start a fresh attempt.');return;}
  if(sim.bailTime>0||sim.mode==='bail'){this.fail('The practice parcel fell during the bail. Return to dispatch and retry.');return;}
  if(this.state==='countdown'){
   if(distance(sim,COURIER_ROUTE.start)>COURIER_ROUTE.start.radius||!sim.grounded||Math.hypot(sim.vx,sim.vz)>1.6){this.fail('False start. Hold the dispatch seal until the three-count is finished.');return;}
   this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0){this.state='running';this.event('signal-green');}return;
  }
  this.elapsed+=dt;if(this.elapsed>COURIER_ROUTE.limit){this.fail('The night shutters closed before delivery. Return to dispatch and try a cleaner route.');return;}
  const target=COURIER_ROUTE.gates[this.next],previousGate=this.next===0?COURIER_ROUTE.start:COURIER_ROUTE.gates[this.next-1];
  const deviation=segmentDistance(sim,previousGate,target);this.offRoute=deviation>6?this.offRoute+dt:0;if(this.offRoute>2){this.fail('The parcel left the marked route for too long. Follow the light frames in order.');return;}
  const moving=travelled/dt>=.85&&sim.speed>=1,grounded=sim.grounded&&sim.mode!=='grind'&&sim.y<.5;
  if(grounded&&moving&&segmentDistance(target,previous,sample)<target.radius){
   this.event('checkpoint',{id:target.id,index:this.next+1,at:this.elapsed});this.next++;
   if(this.next===COURIER_ROUTE.gates.length){const ms=Math.max(1,Math.round(this.elapsed*1000));this.lastResultMs=ms;this.newBest=this.record.bestMs===null||ms<this.record.bestMs;if(this.newBest)this.record.bestMs=ms;this.record.completions++;this.state='finished';this.event('delivered',{milliseconds:ms,newBest:this.newBest,completions:this.record.completions});}return;
  }
  for(let i=this.next+1;i<COURIER_ROUTE.gates.length;i++)if(grounded&&moving&&distance(sim,COURIER_ROUTE.gates[i])<COURIER_ROUTE.gates[i].radius){this.fail('A later relay was reached first. Deliver through the numbered light frames in order.');return;}
 }
 medal(){return this.record.bestMs===null?null:this.record.bestMs<=18000?'gold':this.record.bestMs<=28000?'silver':'bronze';}
 serialize(){return JSON.stringify(this.record);}
 snapshot(sim){return {id:COURIER_ROUTE.id,enabled:this.enabled,state:this.state,active:this.active,elapsed:this.elapsed,countdown:this.countdown,remaining:Math.max(0,COURIER_ROUTE.limit-this.elapsed),next:this.next,passed:this.next,total:COURIER_ROUTE.gates.length,target:this.state==='armed'||this.state==='failed'||this.state==='finished'?COURIER_ROUTE.start.id:COURIER_ROUTE.gates[this.next]?.id||null,reason:this.reason,offRouteSeconds:this.offRoute,lastResultMs:this.lastResultMs,newBest:this.newBest,medal:this.medal(),record:{...this.record},availability:sim?this.availability(sim):null,route:{start:{...COURIER_ROUTE.start},gates:COURIER_ROUTE.gates.map(g=>({...g})),limit:COURIER_ROUTE.limit,countdown:COURIER_ROUTE.countdown},revision:this.revision,events:this.events.map(e=>({...e}))};}
}
