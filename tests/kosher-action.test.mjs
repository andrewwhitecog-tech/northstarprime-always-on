import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StreetCombat,TOKEN_SITES,CREW_SITES,colliderBounds,rayBox} from '../arcade/custom/kosher-lines/street-combat.mjs';
import {ClipChallenges} from '../arcade/custom/kosher-lines/clip-challenges.mjs';
import {KosherSim,COLLIDERS,terrain} from '../arcade/custom/kosher-lines/simulation.mjs';
const rider=(over={})=>({x:-6,y:0,z:-4,grounded:true,mode:'roll',running:true,paused:false,...over});
const aimAt=(p,t)=>({origin:{x:p.x,y:p.y+1,z:p.z},direction:{x:t.x-p.x,y:t.y-p.y-1,z:t.z-p.z}});
const advance=(c,seconds,input)=>{for(let t=0;t<seconds-.00001;t+=.02)c.step(Math.min(.02,seconds-t),input);};
test('ray slab intersection handles parallel rays and both collider schemas',()=>{
 const b=colliderBounds({x:0,z:0,w:2,d:2,h:3});assert.equal(rayBox({x:0,y:1,z:4},{x:0,y:0,z:-1},b),3);assert.equal(rayBox({x:4,y:1,z:4},{x:0,y:0,z:-1},b),null);assert.equal(colliderBounds({solid:false}),null);
 assert.equal(rayBox({x:0,y:1,z:4},{x:0,y:0,z:-1},{minX:-1,maxX:1,minY:0,maxY:2,minZ:-1,maxZ:1},2),null);
});
test('real shot damages closest hostile, consumes ammo and respects fire interval',()=>{
 const c=new StreetCombat(),p=rider(),input={player:p,fire:true,aim:aimAt(p,CREW_SITES[0])};c.step(.02,input);assert.equal(c.snapshot().targets[0].health,66);assert.equal(c.snapshot().ammo,7);c.step(.02,input);assert.equal(c.snapshot().ammo,7);advance(c,.22,{player:p});c.step(.02,input);assert.equal(c.snapshot().targets[0].health,32);
});
test('solid geometry and neutral resident colliders occlude attack rays',()=>{
 for(const kind of ['wall','resident']){const c=new StreetCombat(),p=rider();c.step(.02,{player:p,fire:true,aim:aimAt(p,CREW_SITES[0]),colliders:[{kind,x:-6,z:-6,w:2,d:.4,h:3}]});assert.equal(c.snapshot().targets[0].health,100);assert.equal(c.snapshot().ammo,7);assert(c.snapshot().tracers[0].end.z> -6);}
});
test('finite ammo, reload and target disable are real state transitions',()=>{
 const c=new StreetCombat(),p=rider();for(let i=0;i<3;i++){c.step(.02,{player:p,fire:true,aim:aimAt(p,c.snapshot().targets[0])});advance(c,.24,{player:p});}assert(c.snapshot().targets[0].disabled);assert.equal(c.snapshot().targets[0].health,0);
 for(let i=0;i<5;i++){c.step(.02,{player:p,fire:true,aim:{origin:{x:p.x,y:1,z:p.z},direction:{x:0,y:1,z:0}}});advance(c,.24,{player:p});}assert.equal(c.snapshot().ammo,0);c.step(.02,{player:p,fire:true,aim:aimAt(p,CREW_SITES[0])});assert(c.snapshot().reloading);const before=c.snapshot().reserve;advance(c,1.3,{player:p});assert.equal(c.snapshot().ammo,8);assert.equal(c.snapshot().reserve,before-8);
});
test('pause, stopped ride, malformed input and large dt cannot burst or advance',()=>{
 const c=new StreetCombat(),p=rider(),before=c.serialize();for(const args of [{player:p,paused:true},{player:p,running:false},{player:rider({paused:true})},{player:{x:NaN,y:0,z:0}}])c.step(1,args);c.step(NaN,{player:p});assert.equal(c.serialize(),before);
 c.step(999,{player:p,fire:true,aim:aimAt(p,CREW_SITES[0])});assert.equal(c.snapshot().ammo,7);assert.equal(c.snapshot().time,.1);
});
test('detached muzzle is rejected; airborne hit reports the actual flip',()=>{
 const c=new StreetCombat(),p=rider({grounded:false,mode:'air',trick:'tre'});c.step(.02,{player:p,fire:true,aim:{origin:{x:100,y:1,z:0},direction:{x:0,y:0,z:-1}}});assert.equal(c.snapshot().ammo,8);
 c.step(.02,{player:p,fire:true,aim:aimAt(p,CREW_SITES[0])});const e=c.snapshot().events.find(e=>e.type==='target-hit');assert.equal(e.airborne,true);assert.equal(e.trick,'tre');assert.equal(p.trick,'tre');
});
test('sixteen distinct collectibles use real distance and height, with no duplicate awards',()=>{
 const c=new StreetCombat(),t=TOKEN_SITES[0];c.step(.02,{player:rider({x:t.x,y:5,z:t.z})});assert.equal(c.snapshot().tokenCount,0);
 c.step(.02,{player:rider({x:t.x,y:0,z:t.z})});c.step(.02,{player:rider({x:t.x,y:0,z:t.z})});assert.equal(c.snapshot().tokenCount,1);assert.equal(c.snapshot().events.filter(e=>e.type==='token-collected').length,1);
 for(const t of TOKEN_SITES){assert(Math.abs(t.x)<23&&t.z> -34&&t.z<15);assert.equal(terrain(t.x,t.z),0);assert(!COLLIDERS.some(b=>Math.abs(t.x-b.x)<b.w/2+.3&&Math.abs(t.z-b.z)<b.d/2+.3));c.step(.02,{player:rider({x:t.x,z:t.z})});}assert.equal(c.snapshot().tokenCount,16);
});
test('hostiles have bounded movement, blocked fire and player health recovery',()=>{
 const c=new StreetCombat(),p=rider();advance(c,6,{player:p,colliders:[{x:-6,z:-6,w:30,d:.3,h:9}]});assert.equal(c.snapshot().health,100);advance(c,4,{player:p});assert(c.snapshot().health<100);const low=c.snapshot().health;advance(c,15,{player:rider({x:21,z:14})});assert(c.snapshot().health>low);assert.equal(c.snapshot().health,100);
 for(const t of c.snapshot().targets){const s=CREW_SITES.find(s=>s.id===t.id);assert(Math.abs(t.x-s.x)<=1.15);assert(Math.abs(t.z-s.z)<=.65);}
});
test('combat save roundtrip validates all fields before mutation',()=>{
 const c=new StreetCombat();c.step(.02,{player:rider({x:TOKEN_SITES[0].x,z:TOKEN_SITES[0].z})});const saved=c.serialize(),copy=new StreetCombat(saved);assert.equal(copy.serialize(),saved);const corrupt=JSON.parse(saved);corrupt.ammo=999;assert.equal(copy.restore(corrupt),false);assert.equal(copy.serialize(),saved);assert.equal(copy.restore('{broken'),false);
});
function feeds(){const clips=new ClipChallenges();let simSerial=0,combatSerial=0,elapsed=0;return {clips,frame(skate=[],combat=[]){elapsed+=.02;return clips.step(.02,{simulation:{elapsed,running:true,paused:false,events:skate.map(e=>({...e,serial:++simSerial}))},combat:{events:combat.map(e=>({...e,serial:++combatSerial}))}});}};}
test('flip shot clip requires flip, matching airborne hit, clean same-trick landing and bank',()=>{
 const f=feeds();f.frame([{type:'ollie'},{type:'trick-start',id:'kickflip'}],[{type:'target-hit',target:'sentry-west',airborne:true,trick:'kickflip'}]);let s=f.frame([{type:'landed-trick',id:'kickflip'},{type:'land'}]);assert(s.attempt.pending.includes('flip-shot'));assert.equal(s.completedCount,0);s=f.frame([{type:'bank',value:120}]);assert(s.completed.includes('flip-shot'));assert(s.unlockedBoards.includes('cover-1'));
});
test('grounded/mismatched shots do not count and a bail loses every unbanked clip',()=>{
 for(const shot of [{airborne:false,trick:'tre'},{airborne:true,trick:'heelflip'}]){const f=feeds();f.frame([{type:'ollie'},{type:'trick-start',id:'tre'}],[{type:'target-hit',...shot}]);const s=f.frame([{type:'landed-trick',id:'tre'},{type:'land'},{type:'bank',value:400}]);assert.equal(s.completedCount,0);}
 const f=feeds();f.frame([{type:'ollie'},{type:'trick-start',id:'tre'}],[{type:'target-hit',airborne:true,trick:'tre'}]);f.frame([{type:'landed-trick',id:'tre'},{type:'land'},{type:'grind-landed',duration:1,rail:'outer'},{type:'line-clear'}]);const s=f.frame([{type:'bail'},{type:'bank',value:400}]);assert.equal(s.completedCount,0);assert.equal(s.attempt.pending.length,0);
});
test('hard clip, rail and full line earn only from real completion events and bank',()=>{
 const f=feeds();f.frame([{type:'ollie'},{type:'trick-start',id:'nac'}],[{type:'target-hit',airborne:true,trick:'nac'}]);const s=f.frame([{type:'landed-trick',id:'nac'},{type:'land'},{type:'grind-landed',duration:.8,rail:'outer'},{type:'line-clear'},{type:'bank',value:750}]);assert.deepEqual(new Set(s.completed),new Set(['flip-shot','hard-flip-shot','rail-film','full-line']));assert.equal(s.unlockedBoards.length,3);
});
test('event serial deduplication, token save and real rival display never synthesize score',()=>{
 const f=feeds();for(let i=1;i<=12;i++)f.frame([],[{type:'token-collected',id:'star-'+i}]);const s=f.clips.snapshot();assert(s.completed.includes('star-route'));assert.equal(s.unlockedBoards.length,3);const restored=new ClipChallenges(f.clips.serialize());assert.equal(restored.snapshot().tokens,12);
 const clips=new ClipChallenges(),simulation={elapsed:1,running:true,events:[{serial:1,type:'grind-landed',duration:1},{serial:2,type:'land'},{serial:3,type:'bank',value:50}]};clips.step(.02,{simulation,combat:{events:[]},rival:{score:932,name:'Art',completedLines:1}});clips.step(.02,{simulation,combat:{events:[]}});assert.equal(clips.snapshot().events.filter(e=>e.type==='clip-complete').length,1);assert.equal(clips.snapshot().rival.score,932);assert.equal(clips.restore({version:1,completed:['invented'],collectedTokens:[]}),false);
});
test('authentic KosherSim jump, flip, combat hit, clean landing and bank complete a clip',()=>{
 const sim=new KosherSim();sim.start();sim.sessionMode='chapter';const combat=new StreetCombat(),clips=new ClipChallenges();
 // Steering-free forward ride from the actual spawn; no test state setters.
 for(let i=0;i<35;i++){sim.step(.02,{push:true});combat.step(.02,{player:sim.snapshot()});clips.step(.02,{simulation:sim.snapshot(),combat:combat.snapshot()});}
 sim.step(.02,{ollieTap:true,trick:'KeyF',push:true});clips.step(.02,{simulation:sim.snapshot(),combat:combat.snapshot()});
 const p=sim.snapshot(),t=combat.snapshot().targets[0];combat.step(.02,{player:p,aim:aimAt(p,t),fire:true});clips.step(.02,{simulation:sim.snapshot(),combat:combat.snapshot()});
 for(let i=0;i<180;i++){sim.step(.02,{grind:false});combat.step(.02,{player:sim.snapshot()});clips.step(.02,{simulation:sim.snapshot(),combat:combat.snapshot()});}
 assert(sim.events.some(e=>e.type==='bank'));assert(clips.snapshot().completed.includes('flip-shot'));assert(sim.score>0);
});

test('recovered skating collects real stars while combat immunity and sentry patrol continue',()=>{
 const c=new StreetCombat(),p=rider({x:0,z:-14});
 for(let i=0;i<1500&&!c.snapshot().downed;i++)c.step(.02,{player:p});
 assert(c.snapshot().downed,'actual enemy fire must first down the rider');
 const downed=c.takeDownedEvent();assert.equal(downed.type,'player-downed');
 const token=TOKEN_SITES[0];advance(c,1.12,{player:rider({x:token.x,z:token.z,mode:'bail'})});
 assert(c.snapshot().downed);assert.equal(c.snapshot().tokenCount,0);
 const before=c.snapshot(),rolling=rider({x:token.x,z:token.z});
 c.step(.02,{player:rolling,fire:true,aim:aimAt(rolling,c.snapshot().targets[0])});
 const after=c.snapshot();assert.equal(after.tokenCount,1);assert.equal(after.ammo,before.ammo);assert.equal(after.health,before.health);
 assert(after.targets.some((t,i)=>Math.hypot(t.x-before.targets[i].x,t.z-before.targets[i].z)>0),'patrol continues during immunity');
 assert.equal(c.takeDownedEvent(),null);
 advance(c,1.6,{player:rider({x:22,z:14})});assert.equal(c.snapshot().health,100);assert.equal(c.snapshot().downed,false);
});
