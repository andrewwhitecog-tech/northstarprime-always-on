'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
assert.ok(script,'actual inline game engine must be found');
function game(){
 const handlers={};const elements=new Map();const gradient={addColorStop(){}};
 const drawing=[];const ctx=new Proxy({}, {get:(o,k)=>o[k]||((...args)=>{if(['fillRect','drawImage','translate','rotate','stroke'].includes(k))drawing.push({method:k,args});return gradient;}),set:(o,k,v)=>(o[k]=v,true)});
 const element=id=>{if(!elements.has(id)){const captured=new Set();elements.set(id,{style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},closest:()=>null,focus(){},getBoundingClientRect:()=>({left:0,top:0,width:id.endsWith('Stick')?100:1280,height:id.endsWith('Stick')?100:720}),setPointerCapture:i=>captured.add(i),hasPointerCapture:i=>captured.has(i),releasePointerCapture:i=>captured.delete(i),addEventListener:(name,fn)=>handlers[id+':'+name]=fn,getContext:()=>ctx});}return elements.get(id);};
 let frameNow=0;let pads=[];const sandbox={console,Image:class{constructor(){this.naturalWidth=0;this.naturalHeight=0;}},performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},setInterval(){},Math,
 ResizeObserver:class{observe(){}},document:{createElement:()=>({width:0,height:0,getContext:()=>ctx}),getElementById:element,documentElement:{classList:{toggle(){}}},body:{dataset:{}},querySelectorAll:selector=>selector==='[data-action]'?['bomb','chrono','dodge','weapon'].map(action=>{const e=element('action-'+action);e.dataset.action=action;return e;}):[],addEventListener:(name,fn)=>handlers['document:'+name]=fn},window:{innerWidth:1280,innerHeight:720,matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>handlers[name]=fn},navigator:{maxTouchPoints:0,getGamepads:()=>pads}};
 vm.createContext(sandbox);vm.runInContext("'use strict';"+script[1],sandbox);
 const evalGame=code=>vm.runInContext(code,sandbox);
 evalGame("gameState='PLAYING'; mouse.x=100; mouse.y=360;");
 const pad=(axes=[0,0,0,0],buttons=[])=>({connected:true,mapping:'standard',index:0,id:'fixture',axes,buttons:Array.from({length:10},(_,i)=>({pressed:buttons.includes(i),value:buttons.includes(i)?1:0}))});
 const pointer=(id,type,pointerId,x=50,y=50)=>handlers[id+':'+type]({pointerId,clientX:x,clientY:y,preventDefault(){}});
 return{drawing,input:(event,value)=>handlers['document:'+event](value),disconnect:()=>pads=[],tap:id=>{handlers[id+':pointerdown']?.({pointerId:11,preventDefault(){}});handlers[id+':click']?.({detail:0,pointerType:'touch'});},read:evalGame,frame:()=>evalGame('gameLoop('+(frameNow+=16.666)+')'),pad:(axes,fire=false)=>pads=[pad(axes,fire?[7]:[])],buttons:(buttons,axes=[0,0,0,0])=>pads=[pad(axes,buttons)],mouse:(x,y)=>handlers['gameCanvas:mousemove']({clientX:x,clientY:y}),pointer,key:(key,repeat=false)=>handlers.keydown({key,repeat,preventDefault(){}})};
}

// Controlled source-unit fixtures only. This executes the actual inline engine
// with inert DOM/drawing/audio surfaces; it is NOT native gameplay evidence.
function fixture(hz) {
 const g=game(); let now=0;
 g.read("player.x=300;player.y=200;player.vx=0;player.vy=0;player.shield=100;player.hull=100;player.chrono=100;mouse.down=false;wave=1;score=0;bullets=[];enemiesRemaining=2;");
 return {g, tick(){now+=1000/hz;g.read('gameLoop('+now+')');}, enemy(n=1){g.read('enemies='+JSON.stringify([...Array.from({length:n},()=>({x:300,y:200,vx:0,vy:0,hp:30,type:'scout',speed:0})),{x:900,y:500,vx:0,vy:0,hp:80,type:'gunship',speed:0}])+';enemiesRemaining='+ (n+1));}};
}
for(const hz of [60,120]){
 test('controlled '+hz+'Hz: one live enemy deals one 25 shield hit and is removed',t=>{
  const f=fixture(hz); f.enemy(); f.tick();
  const observed=JSON.parse(f.g.read('JSON.stringify({shield:player.shield,hull:player.hull,score,enemies:enemies.length})'));
  t.diagnostic(JSON.stringify({fixtureHz:hz,...observed}));
  assert.equal(observed.shield,75);assert.equal(observed.hull,100);assert.equal(observed.score,100);assert.equal(observed.enemies,1);
 });
 test('controlled '+hz+'Hz: a bullet-killed overlapping enemy cannot damage the player',t=>{
  const f=fixture(hz);f.enemy();f.g.read('bullets=[{x:300,y:200,vx:0,vy:0,life:20,dmg:30,color:"#fff"}]');f.tick();
  const observed=JSON.parse(f.g.read('JSON.stringify({shield:player.shield,hull:player.hull,score,enemies:enemies.length})'));
  t.diagnostic(JSON.stringify({fixtureHz:hz,...observed}));
  assert.equal(observed.shield,100,'dead enemy must not cause contact damage');assert.equal(observed.hull,100);assert.equal(observed.score,100);
 });
 test('controlled '+hz+'Hz: simultaneous live contacts leave recovering enemies alive and unscored',t=>{
  const f=fixture(hz);f.enemy(4);f.tick();
  const observed=JSON.parse(f.g.read('JSON.stringify({shield:player.shield,hull:player.hull,score,enemies:enemies.length})'));
  t.diagnostic(JSON.stringify({fixtureHz:hz,...observed}));
  assert.equal(observed.shield,75,'a same-update pile-up must not bypass shared contact cadence');assert.equal(observed.hull,100);assert.equal(observed.score,100);assert.equal(observed.enemies,4);
 });
}

for(const hz of [60,120]){
 test('controlled '+hz+'Hz: contact lock lasts 30 existing simulation ticks regardless of frame count',()=>{
  const f=fixture(hz);f.enemy();f.tick();assert.equal(f.g.read('player.contactCd'),30);
  for(let i=0;i<hz/4;i++)f.tick();
  assert.ok(f.g.read('player.contactCd')>14.9&&f.g.read('player.contactCd')<15.1);
  const before=f.g.read('player.shield');f.enemy();f.tick();
  assert.ok(f.g.read('player.shield')>before,'contact within cooldown must only receive normal shield regeneration');
  assert.equal(f.g.read('score'),100,'recovery must not award another contact kill');
  assert.equal(f.g.read('enemies.length'),2,'recovering overlap remains a living enemy');
  assert.equal(f.g.read('enemies[0].hp'),30);
  for(let i=0;i<hz/4-2;i++)f.tick();
  assert.ok(f.g.read('player.contactCd')>0);
  assert.equal(f.g.read('score'),100,'living overlap cannot be scored before expiry');
  const ready=f.g.read('player.shield');f.tick();
  const actual=f.g.read('player.shield');const regen=.06*(1000/hz)/16.666;
  assert.ok(Math.abs(actual-(ready+regen-25))<1e-8,'existing live contact after 0.5 simulation seconds deals exactly 25 shield');
  assert.equal(f.g.read('score'),200);assert.equal(f.g.read('enemies.length'),1);
  assert.equal(f.g.read('player.contactCd'),30);
 });
 test('controlled '+hz+'Hz: a bomb-killed overlapping enemy cannot deal contact damage',()=>{
  const f=fixture(hz);f.enemy();f.g.read('fireBomb()');f.tick();
  assert.equal(f.g.read('player.shield'),100);assert.equal(f.g.read('player.hull'),100);
  assert.equal(f.g.read('player.bombs'),2);assert.ok(f.g.read('wave')>=2,'normal cleared-wave progression remains active');
 });
 test('controlled '+hz+'Hz: actual dodge immunity prevents contact and preserves live enemy',()=>{
  const f=fixture(hz);f.enemy();f.g.read('player.angle=0;dodgeRoll();player.vx=0;player.vy=0');f.tick();
  assert.equal(f.g.read('player.isInvulnerable'),true);assert.equal(f.g.read('player.shield'),100);
  assert.equal(f.g.read('enemies.length'),2);assert.equal(f.g.read('score'),0);assert.equal(f.g.read('player.contactCd'),0);
 });
 test('controlled '+hz+'Hz: a live hull hit remains 30 and shares the same contact cadence',()=>{
  const f=fixture(hz);f.enemy(2);f.g.read('player.shield=-1');f.tick();
  assert.equal(f.g.read('player.hull'),70);assert.equal(f.g.read('score'),100);assert.equal(f.g.read('enemies.length'),2);
  assert.equal(f.g.read('enemies[0].hp'),30);
 });
 test('controlled '+hz+'Hz: the 26 pixel collision boundary is unchanged',()=>{
  const f=fixture(hz);f.enemy();f.g.read('enemies[0].x=326');f.tick();assert.equal(f.g.read('player.shield'),100);
  f.g.read('enemies[0].x=325.9');f.tick();assert.equal(f.g.read('player.shield'),75);
 });
 test('controlled '+hz+'Hz: pause freezes contact cooldown and resume does not grant a reset',()=>{
  const f=fixture(hz);f.enemy();f.tick();f.g.read('pauseGame()');for(let i=0;i<hz/2;i++)f.tick();
  assert.equal(f.g.read('player.contactCd'),30);f.g.read('resumeGame()');f.tick();
  assert.ok(f.g.read('player.contactCd')>0&&f.g.read('player.contactCd')<30);
 });
 test('controlled '+hz+'Hz: new sortie clears contact cooldown and preserves fresh resources',()=>{
  const f=fixture(hz);f.enemy();f.tick();f.g.read('audio.init=()=>{audio.ctx={resume:()=>Promise.resolve(),suspend:()=>Promise.resolve()}};startGame()');
  assert.equal(f.g.read('player.contactCd'),0);assert.equal(f.g.read('player.shield'),100);assert.equal(f.g.read('player.hull'),100);assert.equal(f.g.read('wave'),1);
 });
 test('controlled '+hz+'Hz: chrono dilation does not stretch player contact cadence',()=>{
  const f=fixture(hz);f.enemy();f.tick();f.g.read('chronoTimer=100');for(let i=0;i<hz/2;i++)f.tick();
  assert.equal(f.g.read('timeDilation'),.25);assert.equal(f.g.read('player.contactCd'),0);
 });
}

for(const hz of [60,120]) test('controlled '+hz+'Hz: recovery never blocks a genuine weapon kill or awards a free contact kill',()=>{
 const f=fixture(hz);f.enemy();f.tick();f.enemy();
 f.g.read('bullets=[{x:300,y:200,vx:0,vy:0,life:20,dmg:30,color:"#fff"}]');f.tick();
 assert.equal(f.g.read('score'),200);assert.equal(f.g.read('enemies.length'),1);
 assert.ok(f.g.read('player.shield')>75);assert.equal(f.g.read('player.hull'),100);
});
