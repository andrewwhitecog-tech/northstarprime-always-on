import { PEACOCK_TRICK, isPeacockKioskLanding } from './peacock-signature.mjs';
// Clips consume serial-numbered events emitted by the live skate/combat simulations.
// step(dt,{simulation,combat,rival?}); rival score is display-only, never synthesized.
const FLIPS=new Set(['kickflip','heelflip','tre','nac']);
const HARD=new Set(['tre','nac']);
export const COVER_UNLOCKS=Object.freeze([
 Object.freeze({id:'cover-1',tokens:3,clips:1}),Object.freeze({id:'cover-2',tokens:7,clips:2}),Object.freeze({id:'cover-3',tokens:12,clips:3})
]);
export const CLIP_OBJECTIVES=Object.freeze([
 Object.freeze({id:'flip-shot',title:'Flip / fire / roll away',objective:'Start a flip, hit a hostile sentry while airborne during that flip, land the same flip cleanly, then bank the combo.'}),
 Object.freeze({id:'hard-flip-shot',title:'Hard catch',objective:'Land and bank a tre flip or nac flip with an airborne hit during that same trick.'}),
 Object.freeze({id:'rail-film',title:'Steel thread',objective:'Grind for at least 0.6 seconds, land cleanly, then bank the combo.'}),
 Object.freeze({id:'full-line',title:'One unbroken line',objective:'Finish DROP IN, LEDGE, FUNBOX, STAIR and QUARTER in order and bank the line without bailing.'}),
 Object.freeze({id:'peacock-kiosk',title:'Peacock kiosk cut',objective:'Land a 180 to enter switch stance, land a full switch backside 360 beside the eye kiosk, then bank without bailing.'}),
 Object.freeze({id:'star-route',title:'The scattered seal',objective:'Explore the sandbox and physically collect twelve gold six-point star tokens.'})
]);
const blank=()=>({airborne:false,trick:null,hitTricks:[],landedTricks:[],cleanLanding:false,peacockLanded:false,grind:0,line:false});
export class ClipChallenges{
 constructor(saved=null){this.completed=new Set();this.collected=new Set();this.attempt=blank();this.pending=new Set();this.simFloor=0;this.combatFloor=0;this.simClock=null;this.serial=0;this.events=[];this.rival=null;if(saved)this.restore(saved);}
 event(type,detail={}){this.events.push({serial:++this.serial,type,...detail});if(this.events.length>48)this.events.shift();}
 award(id){if(this.completed.has(id))return;this.completed.add(id);this.event('clip-complete',{id});}
 invalidate(reason){const active=this.pending.size>0||this.attempt.airborne||this.attempt.hitTricks.length>0;this.attempt=blank();this.pending.clear();if(active)this.event('clip-lost',{reason});}
 skate(e){
  if(['reset','bail','session-end'].includes(e.type)){this.invalidate(e.type);return;}
  const a=this.attempt;
  if(e.type==='ollie'||e.type==='quarter-launch'){
   // A new jump preserves already landed, unbanked clips but requires its own hit.
   this.attempt={...blank(),airborne:true,line:a.line};return;
  }
  if(e.type==='trick-start'&&a.airborne)a.trick=e.id;
  if(e.type==='landed-trick'&&a.airborne&&FLIPS.has(e.id))a.landedTricks.push(e.id);
  if(e.type==='landed-trick'&&a.airborne&&a.trick===PEACOCK_TRICK.id&&isPeacockKioskLanding(e))a.peacockLanded=true;
  if(e.type==='grind-landed'&&Number.isFinite(e.duration)&&e.duration>=.6)this.pending.add('rail-film');
  if(e.type==='line-clear'){a.line=true;this.pending.add('full-line');}
  if(e.type==='land'){
   a.airborne=false;a.cleanLanding=true;if(a.peacockLanded)this.pending.add('peacock-kiosk');
   for(const id of a.landedTricks)if(a.hitTricks.includes(id)){this.pending.add('flip-shot');if(HARD.has(id))this.pending.add('hard-flip-shot');}
  }
  if(e.type==='bank'&&Number.isFinite(e.value)&&e.value>0){for(const id of this.pending)this.award(id);this.pending.clear();this.attempt=blank();}
 }
 combat(e){
  if(e.type==='player-downed'){this.invalidate('player-downed');return;}
  if(e.type==='token-collected'&&typeof e.id==='string'&&/^star-([1-9]|1[0-6])$/.test(e.id)){this.collected.add(e.id);if(this.collected.size>=12)this.award('star-route');}
  const a=this.attempt;
  if(e.type==='target-hit'&&e.airborne===true&&a.airborne&&FLIPS.has(e.trick)&&a.trick===e.trick&&!a.hitTricks.includes(e.trick)){a.hitTricks.push(e.trick);this.event('airborne-hit-recorded',{trick:e.trick,target:e.target});}
 }
 step(dt,{simulation,combat,rival=null}={}){
  if(!simulation||!Number.isFinite(dt)||dt<0)return this.snapshot();
  if(rival&&Number.isFinite(rival.score)&&rival.score>=0)this.rival={score:Math.floor(rival.score),name:typeof rival.name==='string'?rival.name:'Rival',completedLines:Math.max(0,Math.floor(rival.completedLines||0))};
  // Reset reuses elapsed=0 but KosherSim normally retains its monotonic event serial.
  if(Number.isFinite(simulation.elapsed)&&this.simClock!==null&&simulation.elapsed<this.simClock){this.invalidate('ride-reset');const max=Math.max(0,...(simulation.events||[]).map(e=>e.serial||0));if(max<this.simFloor)this.simFloor=0;}
  this.simClock=simulation.elapsed;
  if(simulation.paused||simulation.running===false||simulation.ended){
   // Reset/end still invalidate an unfinished attempt even while the ride is stopped.
   for(const e of simulation.events||[])if(Number.isInteger(e.serial)&&e.serial>this.simFloor){this.simFloor=e.serial;if(['reset','bail','session-end'].includes(e.type))this.skate(e);}
   return this.snapshot();
  }
  for(const e of simulation.events||[])if(Number.isInteger(e.serial)&&e.serial>this.simFloor){this.simFloor=e.serial;this.skate(e);}
  for(const e of combat?.events||[])if(Number.isInteger(e.serial)&&e.serial>this.combatFloor){this.combatFloor=e.serial;this.combat(e);}
  return this.snapshot();
 }
 snapshot(){
  const a=this.attempt;
  const boards=COVER_UNLOCKS.filter(u=>this.collected.size>=u.tokens||this.completed.size>=u.clips).map(u=>u.id);
  return {version:1,completed:[...this.completed],completedCount:this.completed.size,tokens:this.collected.size,collectedTokens:[...this.collected],unlockedBoards:boards,rival:this.rival?{...this.rival}:null,attempt:{...a,hitTricks:[...a.hitTricks],landedTricks:[...a.landedTricks],pending:[...this.pending]},challenges:CLIP_OBJECTIVES.map(c=>({...c,completed:this.completed.has(c.id),pending:this.pending.has(c.id),progress:c.id==='peacock-kiosk'?{switch360LandedAtKiosk:a.peacockLanded,banked:this.completed.has(c.id)}:c.id==='star-route'?{collected:this.collected.size,required:12}:c.id==='flip-shot'||c.id==='hard-flip-shot'?{trickStarted:FLIPS.has(a.trick),airborneHit:a.hitTricks.some(t=>c.id==='flip-shot'||HARD.has(t)),cleanLanding:a.cleanLanding,banked:this.completed.has(c.id)}:c.id==='rail-film'?{cleanGrindLanded:this.pending.has(c.id),banked:this.completed.has(c.id)}:{lineCleared:a.line,banked:this.completed.has(c.id)}})),boardRequirements:COVER_UNLOCKS.map(u=>({...u,unlocked:boards.includes(u.id)})),events:this.events.map(e=>({...e}))};
 }
 serialize(){return JSON.stringify({version:1,completed:[...this.completed],collectedTokens:[...this.collected]});}
 restore(raw){let s;try{s=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}if(!s||s.version!==1||!Array.isArray(s.completed)||s.completed.some(id=>!CLIP_OBJECTIVES.some(c=>c.id===id))||!Array.isArray(s.collectedTokens)||s.collectedTokens.some(id=>typeof id!=='string'||!/^star-([1-9]|1[0-6])$/.test(id)))return false;this.completed=new Set(s.completed);this.collected=new Set(s.collectedTokens);if(this.completed.has('star-route')&&this.collected.size<12)this.completed.delete('star-route');this.attempt=blank();this.pending.clear();this.events=[];return true;}
}
