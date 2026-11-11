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
 dialogue(id){
 const resident=RESIDENTS.find(r=>r.id===id);if(!resident)return null;
 const stage=this.state.completed,index=RESIDENTS.findIndex(r=>r.id===id),c=CONTRACTS[index],p=this.state.progress;
 const say=(title,text,action='none')=>({name:resident.name,title,text,action});
 if(stage>=3){
  if(id==='keeper')return this.state.choice==='public'?say('A place stays open','Look at that return lane. I used to carry the last lamp home so it would not be stolen. Tonight I am leaving it here. You gave us something to look after together. Your vest is mended; scuff it properly.'):say('Not every gift is a debt','I saw the crest. You kept something beautiful for yourself. Good. I will still walk the dark stretch with my lantern; you do not owe us every part of yourself. The canopy stays open. Come back when you want company.');
  if(id==='courier')return this.state.choice==='public'?say('The last delivery gets home','Both gardens, then the southern gate. No more counting steps in the dark. I have one parcel left: the spare lamp I borrowed from the keeper. For once, I can bring it back before dawn.'):say('A route is more than its lamps','Your mirror catches the quarter from here. I will take the garden parcels on foot tonight. Slower, yes. Finished, also yes. Keep riding; if we all waited for the perfect route, nothing would arrive.');
  return this.state.choice==='public'?say('What the eye remembers','Not your face. Not a list of where you went. The eye remembers the direction you gave its light. A constellation over an ordinary street; a way home that belongs to whoever needs it next. The work returns to material life.'):say('A witness, not a verdict','The mirror holds your line and asks for nothing back. A private keepsake is not a failure of generosity. But look down the street as well as into the crest: the keeper is still there, carrying the rest. Return is a choice you can keep making.');
 }
 if(index<stage){
  if(id==='keeper')return stage===1?say('One repair makes another visible','That cloth on your vest was covering the broken switchboard. Better on a moving person. The courier lent me the battery that lit this bench, and now the gardens are dark. West kiosk, the one full of undelivered parcels. Go hear their side before you decide who gets the last cell.'):say('The light is borrowed','The courier brought the empty lamp back. There is one cell left in the archive circuit. I would put it in the public lane, but I am not the one who rode the route. Ask the archivist what it costs to point it somewhere else.');
  if(id==='courier')return say('The parcels can move again','I checked your line, and both relays answered. Those little wheel jewels were packing seals; now they can keep moving instead of sitting on a shelf. The archivist is beyond the east garden. They are careful with memories. Sometimes too careful.');
 }
 if(index>stage){
  if(id==='courier')return say('Do not promise me another shortcut','See those parcels in the window? Garden cuttings, a repaired lamp, somebody’s cup. I used to carry the lot in one run. Then the keeper borrowed our last battery for that canopy. I am not angry with the keeper. I am tired of being told the dark route is my problem. Speak to them first.');
  return stage===0?say('Three versions of the same night','The keeper says the canopy saved the plaza. The courier says it cost the gardens their lights. Both remember honestly. An archive should have room for both. Begin at the amber canopy; I will keep the final cell disconnected until somebody has actually ridden the consequences.'):say('A receipt is not a return','The keeper has a working canopy now. The courier still has a closed route. I will not turn the eye on just because we have a tidy story about repairs. Reconnect the two garden relays. Then come tell me what the night felt like from the ground.');
 }
 if(!this.state.active){
  if(id==='keeper')return say(c.title,'I have been repairing this canopy since the storm. The switch works; I do not know whether the plaza still does. Show me two different tricks caught clean, and bank 300 points without handing the whole run to the pavement. I will open the circuit and mend that vest. It is a load test for a place people actually use, not a show for me.','accept');
  if(id==='courier')return say(c.title,'All right. A route, not a dare. Ride the Aurora rail clean for at least six tenths of a second and land it. Then stop at both garden relays until their cores answer. They stand beside the far quarter, one on each side. I need to know the whole journey is usable, not just the glamorous middle. Bring that back and the packing seals are yours.','accept');
  return say(c.title,'There is one charged cell left. The eye can hold it as your mirrored crest, or scatter it along the public return lane. First, steady a manual for 1.2 seconds on the east garden lane. Visit the two garden stones and the return stone behind the starting mosaic. Slow down long enough to see each one. I want this choice made by someone who knows where the light has to travel.','accept');
 }
 if(this.ready()){
  if(id==='keeper')return say('A working place','Two different catches. A run you brought home instead of only risking. Yes: this place still works. I will close the canopy switch and put the original weave back into your vest. The courier is waiting at the west kiosk. Before you take my side, listen to theirs.','complete');
  if(id==='courier')return say('The route answers','Both relays, and a clean landing off Aurora. I can stop rehearsing the fall in my head now. Take the wheel jewels; they were not doing anyone any good in a sealed parcel. The archivist has the last cell. Tell them a safe route is a beautiful thing too.','complete');
  return say('Where should the light return?','You held the lane and visited every stone. I can connect the cell now. Give it to the plaza and the public return studs and constellation stay lit; your helmet carries no private crest. Keep the mirror and it travels with you, but that new public lane stays dark. The keeper will still open the canopy. Nobody loses the right to skate. I will remember the choice, not judge it.','choice');
 }
 if(id==='keeper')return p.tricks.length===0?say('Catch it before you call it done','I have seen bigger tricks than I can count. The ones I remember end with somebody still standing. Charge your ollie, let the board finish turning, then land. Give me two different clean catches. The points only matter when you bring them home.'):p.tricks.length<2?say('Leave room for another answer','That catch was yours. Now give the board a different question. One different landed trick, then a quiet couple of seconds rolling to bank the score. I have the needle threaded.'):say('Bring the run home','The different catches are recorded. You still need '+Math.max(0,300-Math.floor(p.banked))+' banked points. Do not hurry the final part: a clean roll is what turns a near miss into a finished run.');
 if(id==='courier')return p.grind<.6?say('The part I stopped trusting','Aurora is the long rail at the west edge of the gardens. Six tenths of a second is enough. The landing is the part I need to see; an exit into a bail is why those parcels are still here. You can ollie out once the wheels have found the line.'):say('Do not skip the doorstep','You landed the rail. Good. '+(p.visited.includes('west')?'The west relay has answered. ':p.visited.includes('east')?'The east relay has answered. ':'Neither garden relay has answered yet. ')+'Roll up slowly and stay beside each core for a moment. A journey is not delivered until somebody at the other end can receive it.');
 return p.manual<1.2?say('Stay with the ordinary part','The east garden lane runs between the planters and the quarter. Hold your manual there for 1.2 seconds and put both sets of wheels down clean. No leap of faith this time. Balance is small corrections you keep choosing.'):say('The third stone faces home','The manual is recorded. You have visited '+p.visited.length+' of the three memory stones. The last one people forget is behind the starting mosaic. That is why it matters: the return is part of the route, not an afterthought.');
 }

 snapshot(){return {version:1,completed:this.state.completed,active:this.state.active,contract:CONTRACTS[this.state.completed]?.id||null,ready:this.ready(),progress:{...this.state.progress,tricks:[...this.state.progress.tricks],visited:[...this.state.progress.visited]},choice:this.state.choice,interactions:this.state.interactions,nearby:this.nearby,visiting:this.visiting,visitTime:this.visitTime,revision:this.revision,unlocks:{wovenVest:this.state.completed>=1,courierJewels:this.state.completed>=2,openEye:this.state.completed===3,publicLight:this.state.choice==='public',mirrorCrest:this.state.choice==='personal'},characters:RESIDENTS.map(r=>({...r})),beacons:BEACONS.map(b=>({...b})),contracts:CONTRACTS.map((c,i)=>({...c,status:i<this.state.completed?'complete':i===this.state.completed?(this.state.active?(this.ready()?'ready':'active'):'available'):'locked'})),events:this.notifications.map(n=>({...n}))};}
 serialize(){return JSON.stringify(this.state);}
}
