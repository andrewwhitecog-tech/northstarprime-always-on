// Original chapter reconstruction. Local single-player progress; no online rewards.
export const RESIDENTS=Object.freeze([
 {id:'keeper',name:'The plaza keeper',role:'Repair the night',x:7,z:6.3,color:0xffbf59},
 {id:'courier',name:'The night courier',role:'Reconnect the outer route',x:-14.5,z:-6,color:0x55f1d7},
 {id:'archivist',name:'The signal archivist',role:'Choose what the eye remembers',x:10,z:-27.5,color:0xd17dff}
]);
export const BEACONS=Object.freeze([
 {id:'west',name:'West garden relay',x:-8,z:-27.8,color:0x54f3d9},
 {id:'east',name:'East garden relay',x:8,z:-27.8,color:0xf17ebd},
 {id:'return',name:'Return stone',x:0,z:10.5,color:0xffc15a}
]);
export const CITY_COLLIDERS=Object.freeze([
 {kind:'counter',x:9,z:8.8,w:3,d:1.2,h:.95},
 {kind:'post',x:7.1,z:9.2,w:.2,d:.2,h:3.3}, {kind:'post',x:10.9,z:9.2,w:.2,d:.2,h:3.3},
 {kind:'kiosk',x:-17,z:-6,w:3,d:2,h:2.5},
 {kind:'archive',x:12.6,z:-29.4,w:3.6,d:1.8,h:1},
 {kind:'garden',x:-8.5,z:-12,w:2,d:3.8,h:.6}, {kind:'garden',x:8.5,z:-12,w:2,d:3.8,h:.6},
 ...[-19,19].flatMap(x=>[6,-4,-18,-29].map(z=>({kind:'tree',x,z,w:.55,d:.55,h:3.7}))),
 {kind:'bench',x:13,z:1,w:3,d:1,h:.6}, {kind:'bench',x:-13,z:8,w:3,d:1,h:.6},
 ...RESIDENTS.map(r=>({kind:'resident',x:r.x,z:r.z,w:.55,d:.55,h:1.8})),
 ...BEACONS.map(b=>({kind:'beacon',x:b.x,z:b.z,w:.48,d:.48,h:.8})),
 ...[-1,1].flatMap(side=>Array.from({length:7},(_,bay)=>[2.65,-2.65].map(offset=>({kind:'column',x:side*21.6,z:10-bay*6.1+offset,w:.9,d:.5,h:5.7+(bay%3)*1.15}))).flat()),
 ...[-1,1].flatMap(side=>Array.from({length:7},(_,bay)=>({kind:'bay-wall',x:side*21.73,z:10-bay*6.1,w:.25,d:4.4,h:2.8}))),
 ...Array.from({length:6},(_,i)=>({kind:'citizen',x:(i%2?-1:1)*(18.7+(i%3)*.4),z:8-Math.floor(i/2)*12-.1,w:.6,d:.8,h:1.6}))
]);
export const CONTRACTS=Object.freeze([
 {id:'borrowed-light',resident:'keeper',title:'Borrowed light',brief:'The keeper has one power cell left. Two different landed tricks and 300 banked points will prove the plaza is worth keeping open.',reward:'A woven rider vest and a lit public canopy.'},
 {id:'last-route',resident:'courier',title:'The last route',brief:'The courier stopped crossing the outer garden after the lights failed. Land a clean Aurora rail grind of at least 0.6 seconds and reach both garden relays to reconnect the route.',reward:'Courier wheel jewels and the garden relays restored.'},
 {id:'return-hour',resident:'archivist',title:'Return the hour',brief:'The archivist can turn the repaired circuit inward as a private trophy, or outward as a light for everyone. Hold a clean 1.2-second manual on the east garden lane and visit all three memory stones. Then choose what the eye remembers.',reward:'An open eye, a changed plaza, and a permanent chapter ending.'}
]);
const freshProgress=()=>({tricks:[],banked:0,grind:0,manual:0,visited:[]});
export function defaultChapter(){return {version:1,completed:0,active:false,progress:freshProgress(),choice:null,interactions:0};}
export function parseChapter(raw){
 try{const p=JSON.parse(raw);if(!p||p.version!==1)return defaultChapter();const out=defaultChapter();
 out.completed=Math.max(0,Math.min(3,Number.isInteger(p.completed)?p.completed:0));out.active=out.completed<3&&p.active===true;
 const q=p.progress||{};out.progress={tricks:[...new Set((Array.isArray(q.tricks)?q.tricks:[]).filter(x=>['kickflip','heelflip','shuv','180','tre','nac'].includes(x)))],banked:Math.max(0,Math.min(1e7,Number(q.banked)||0)),grind:Math.max(0,Math.min(30,Number(q.grind)||0)),manual:Math.max(0,Math.min(30,Number(q.manual)||0)),visited:[...new Set((Array.isArray(q.visited)?q.visited:[]).filter(x=>BEACONS.some(b=>b.id===x)))]};
 out.choice=out.completed===3&&['public','personal'].includes(p.choice)?p.choice:null;
 out.interactions=Math.max(0,Math.min(1e6,Number(p.interactions)||0));return out;
 }catch{return defaultChapter();}
}
export class PlazaChapter{
 constructor(saved=defaultChapter()){this.state=saved;this.notifications=[];this.revision=0;this.nearby=null;this.visiting=null;this.visitTime=0;}
 changed(type,text){this.revision++;this.notifications.push({type,text});if(this.notifications.length>12)this.notifications.shift();}
 ready(){const s=this.state,p=s.progress;if(!s.active)return false;return s.completed===0?p.tricks.length>=2&&p.banked>=300:s.completed===1?p.grind>=.6&&p.visited.includes('west')&&p.visited.includes('east'):p.manual>=1.2&&BEACONS.every(b=>p.visited.includes(b.id));}
 accept(id){const c=CONTRACTS[this.state.completed];if(!c||c.resident!==id||this.state.active)return false;this.state.active=true;this.state.progress=freshProgress();this.changed('accepted',c.title+' accepted. Your next clean ride counts.');return true;}
 turnIn(id,choice=null){const c=CONTRACTS[this.state.completed];if(!c||c.resident!==id||!this.ready())return false;if(this.state.completed===2&&!['public','personal'].includes(choice))return false;
 this.state.completed++;this.state.active=false;this.state.choice=this.state.completed===3?choice:null;this.state.progress=freshProgress();this.changed('completed',this.state.completed===3?(choice==='public'?'The plaza keeps the light. The return route now glows for everyone.':'You keep the mirrored crest. The eye turns inward, and the keeper leaves the plaza open.'):'Contract sealed. '+c.reward);return true;}
 consume(e){if(!this.state.active)return;const p=this.state.progress,stage=this.state.completed;let changed=false;
 if(stage===0&&e.type==='landed-trick'&&!p.tricks.includes(e.id)){p.tricks.push(e.id);changed=true;}
 if(stage===0&&e.type==='bank'){p.banked+=e.value;changed=true;}
 if(stage===1&&e.type==='grind-landed'&&e.rail==='outer'&&e.duration>p.grind){p.grind=e.duration;changed=true;}
 if(stage===2&&e.type==='manual-complete'&&e.x>5&&e.x<16&&e.z< -9&&e.z> -26&&e.gardenDuration>p.manual){p.manual=e.gardenDuration;changed=true;}
 if(changed)this.changed('progress',this.ready()?'The route is proven. Return to '+RESIDENTS[stage].name.toLowerCase()+'.':'A clean part of the contract is recorded.');
 }
 step(dt,sim){this.nearby=null;let distance=3.2;for(const resident of RESIDENTS){const d=Math.hypot(sim.x-resident.x,sim.z-resident.z);if(d<distance&&sim.grounded&&sim.speed<1.5){distance=d;this.nearby=resident.id;}}
 if(!this.state.active||!sim.running||sim.paused||sim.bailTime>0||!sim.grounded||sim.speed>3){this.visiting=null;this.visitTime=0;return;}
 const stage=this.state.completed;if(stage===0)return;
 const beacon=BEACONS.find(b=>Math.hypot(sim.x-b.x,sim.z-b.z)<1.7&&(stage===2||b.id!=='return')&&!this.state.progress.visited.includes(b.id));
 if(!beacon){this.visiting=null;this.visitTime=0;return;}if(this.visiting!==beacon.id){this.visiting=beacon.id;this.visitTime=0;}this.visitTime+=dt;
 if(this.visitTime>=.6){this.state.progress.visited.push(beacon.id);this.changed('beacon',beacon.name+' reconnected.');this.visiting=null;this.visitTime=0;}
 }
 interact(id){if(this.nearby!==id)return null;this.state.interactions++;this.revision++;return this.dialogue(id);}
 dialogue(id){const resident=RESIDENTS.find(r=>r.id===id);if(!resident)return null;const stage=this.state.completed,index=RESIDENTS.findIndex(r=>r.id===id),c=CONTRACTS[index];
 if(stage>=3)return {name:resident.name,title:'The plaza remembers',text:this.state.choice==='public'?'Your light belongs to the plaza now. The outer route and the eye stay lit for every return.':'The mirrored crest carries your line. The eye turns inward; the public plaza stays open.',action:'none'};
 if(index<stage)return {name:resident.name,title:c.title,text:index===0?'You brought the light back by making something, not by promising it. The courier is waiting at the west kiosk.':index===1?'Both relays are talking. Take the east garden lane to the archivist beside the quarter.':'The route returns to the people who keep it alive.',action:'none'};
 if(index>stage)return {name:resident.name,title:'A broken circuit',text:index===1?'I have parcels for the gardens, but the night route is dark. Help the plaza keeper at the south canopy first.':'The eye has memory, but no direction. Reconnect the courier’s garden route before we decide where its light belongs.',action:'none'};
 return {name:resident.name,title:c.title,text:this.state.active?(this.ready()?(stage===2?'The work is done. Give the last cell to the public route, or keep its mirror as a personal crest. Both choices stay saved; no choice blocks skating.':c.reward+' The next resident is ready for you.'):'The work counts only after you accept, and only on clean skating events. '+c.brief):c.brief,action:this.state.active?(this.ready()?(stage===2?'choice':'complete'):'none'):'accept'};
 }
 snapshot(){return {version:1,completed:this.state.completed,active:this.state.active,contract:CONTRACTS[this.state.completed]?.id||null,ready:this.ready(),progress:{...this.state.progress,tricks:[...this.state.progress.tricks],visited:[...this.state.progress.visited]},choice:this.state.choice,interactions:this.state.interactions,nearby:this.nearby,visiting:this.visiting,visitTime:this.visitTime,revision:this.revision,unlocks:{wovenVest:this.state.completed>=1,courierJewels:this.state.completed>=2,openEye:this.state.completed===3,publicLight:this.state.choice==='public',mirrorCrest:this.state.choice==='personal'},characters:RESIDENTS.map(r=>({...r})),beacons:BEACONS.map(b=>({...b})),contracts:CONTRACTS.map((c,i)=>({...c,status:i<this.state.completed?'complete':i===this.state.completed?(this.state.active?(this.ready()?'ready':'active'):'available'):'locked'})),events:this.notifications.map(n=>({...n}))};}
 serialize(){return JSON.stringify(this.state);}
}
