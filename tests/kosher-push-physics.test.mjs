import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KosherSim,defaultProfile} from '../arcade/custom/kosher-lines/simulation.mjs';
function ride(){const sim=new KosherSim(defaultProfile());sim.sessionMode='chapter';sim.start();return sim;}
const dt=1/120;
test('a short push request completes one actual stroke after release, with acceleration during pavement contact',()=>{
 const s=ride();s.step(dt,{push:true});assert.equal(s.snapshot().pushActive,true);
 let peak=0,contacts=0,freeAccelerations=0,prev=s.speed;
 for(let i=0;i<150;i++){s.step(dt,{});const a=s.snapshot();if(a.pushContact)contacts++;if(a.speed>prev+.0001&&!a.pushContact)freeAccelerations++;prev=a.speed;peak=Math.max(peak,a.speed);}
 assert.equal(s.snapshot().pushStroke,1);assert.equal(s.snapshot().pushActive,false);assert(contacts>8);assert(peak>1.8&&peak<3);assert.equal(freeAccelerations,0);
});
test('held pushing repeats real strokes; coasting, pause and brake never synthesize new kicks',()=>{
 const s=ride();for(let i=0;i<270;i++)s.step(dt,{push:true});assert(s.snapshot().pushStroke>=3);assert(s.speed>4);
 s.step(dt,{brake:true});assert.equal(s.snapshot().pushActive,false);const n=s.snapshot().pushStroke,v=s.speed;
 for(let i=0;i<30;i++)s.step(dt,{});assert.equal(s.snapshot().pushStroke,n);assert(s.speed<v);
 s.step(dt,{push:true});s.togglePause();const before=s.snapshot();for(let i=0;i<100;i++)s.step(dt,{push:true});assert.equal(s.snapshot().pushPhase,before.pushPhase);assert.equal(s.speed,before.speed);
});
test('charging and a real ollie release the pavement stroke instead of kicking in mid-air',()=>{
 const s=ride();s.step(dt,{push:true});s.step(dt,{push:true,olliePressed:true,ollieHeld:true});assert.equal(s.snapshot().pushActive,false);
 for(let i=0;i<35;i++)s.step(dt,{push:true,ollieHeld:true});s.step(dt,{push:true,ollieReleased:true});assert.equal(s.grounded,false);assert.equal(s.snapshot().pushActive,false);
});
