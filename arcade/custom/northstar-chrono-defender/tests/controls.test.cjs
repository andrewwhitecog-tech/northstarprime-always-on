'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
assert.ok(script,'actual inline game engine must be found');
function game(){
 const handlers={};const elements=new Map();const gradient={addColorStop(){}};
 const drawing=[];const ctx=new Proxy({}, {get:(o,k)=>o[k]||((...args)=>{if(k==='fillRect'||k==='drawImage')drawing.push({method:k,args});return gradient;}),set:(o,k,v)=>(o[k]=v,true)});
 const element=id=>{if(!elements.has(id)){const captured=new Set();elements.set(id,{style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},closest:()=>null,focus(){},getBoundingClientRect:()=>({left:0,top:0,width:id.endsWith('Stick')?100:1280,height:id.endsWith('Stick')?100:720}),setPointerCapture:i=>captured.add(i),hasPointerCapture:i=>captured.has(i),releasePointerCapture:i=>captured.delete(i),addEventListener:(name,fn)=>handlers[id+':'+name]=fn,getContext:()=>ctx});}return elements.get(id);};
 let pads=[];const sandbox={console,Image:class{constructor(){this.naturalWidth=0;this.naturalHeight=0;}},performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},setInterval(){},Math,
 ResizeObserver:class{observe(){}},document:{createElement:()=>({width:0,height:0,getContext:()=>ctx}),getElementById:element,documentElement:{classList:{toggle(){}}},body:{dataset:{}},querySelectorAll:selector=>selector==='[data-action]'?['bomb','chrono','dodge','weapon'].map(action=>{const e=element('action-'+action);e.dataset.action=action;return e;}):[],addEventListener:(name,fn)=>handlers['document:'+name]=fn},window:{innerWidth:1280,innerHeight:720,matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>handlers[name]=fn},navigator:{maxTouchPoints:0,getGamepads:()=>pads}};
 vm.createContext(sandbox);vm.runInContext("'use strict';"+script[1],sandbox);
 const evalGame=code=>vm.runInContext(code,sandbox);
 evalGame("gameState='PLAYING'; mouse.x=100; mouse.y=360;");
 const pad=(axes=[0,0,0,0],buttons=[])=>({connected:true,mapping:'standard',index:0,id:'fixture',axes,buttons:Array.from({length:10},(_,i)=>({pressed:buttons.includes(i),value:buttons.includes(i)?1:0}))});
 const pointer=(id,type,pointerId,x=50,y=50)=>handlers[id+':'+type]({pointerId,clientX:x,clientY:y,preventDefault(){}});
 return{drawing,tap:id=>{handlers[id+':pointerdown']?.({pointerId:11,preventDefault(){}});handlers[id+':click']?.({detail:0,pointerType:'touch'});},read:evalGame,frame:()=>evalGame('gameLoop(16.666)'),pad:(axes,fire=false)=>pads=[pad(axes,fire?[7]:[])],buttons:(buttons,axes=[0,0,0,0])=>pads=[pad(axes,buttons)],mouse:(x,y)=>handlers['gameCanvas:mousemove']({clientX:x,clientY:y}),pointer,key:(key,repeat=false)=>handlers.keydown({key,repeat,preventDefault(){}})};
}
function near(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-9,message+'; actual='+actual);}
test('right stick facing survives the real frame mouse-aim stage',()=>{const g=game();g.pad([0,0,0,-1]);g.frame();near(g.read('player.angle'),-Math.PI/2,'right stick must point up despite stale mouse on left');});
test('neutral stick retains the last controller bearing for the next shot',()=>{const g=game();g.pad([0,0,0,-1]);g.frame();g.pad([0,0,0,0],true);g.frame();assert.ok(g.read('bullets.length')>0);assert.ok(g.read('bullets[0].vy')<0,'trigger after centering stick must still fire up');near(g.read('bullets[0].vx'),0,'shot must not turn toward stale pointer');});
test('real mouse movement can deliberately take aim ownership back',()=>{const g=game();g.pad([0,0,0,-1]);g.frame();g.pad([0,0,0,0]);g.mouse(100,360);g.frame();near(g.read('player.angle'),Math.PI,'mouse must take over when moved');});
test('new right stick aim takes ownership after mouse movement',()=>{const g=game();g.mouse(100,360);g.frame();g.pad([0,0,1,0]);g.frame();near(g.read('player.angle'),0,'right stick must take over again');});
test('a connected neutral controller does not steal active mouse aim',()=>{const g=game();g.pad([0,0,.1,.1]);g.mouse(640,0);g.frame();near(g.read('player.angle'),-Math.PI/2,'deadzone movement must not steal mouse');});
test('keyboard and mouse aiming still follows the pointer without a controller',()=>{const g=game();g.mouse(640,0);g.frame();near(g.read('player.angle'),-Math.PI/2,'mouse aim remains unchanged');});

test('touch movement and aim own separate simultaneous pointers',()=>{const g=game();g.pointer('moveStick','pointerdown',1,90,50);g.pointer('aimStick','pointerdown',2,50,10);assert.equal(g.read('stickOwners.move'),1);assert.equal(g.read('stickOwners.aim'),2);g.frame();assert.ok(g.read('player.vx')>0);assert.ok(g.read('bullets[0].vy')<0);});
test('touch cancellation releases ownership and movement',()=>{const g=game();g.pointer('moveStick','pointerdown',1,90,50);g.pointer('moveStick','pointercancel',1);assert.equal(g.read('touch.move.x'),0);assert.equal(g.read('stickOwners.move'),null);assert.equal(g.read('captures.size'),0);});
test('lost capture stops continuous firing',()=>{const g=game();g.pointer('aimStick','pointerdown',2,50,10);assert.equal(g.read('touch.aimFire'),true);g.pointer('aimStick','lostpointercapture',2);assert.equal(g.read('touch.aimFire'),false);assert.equal(g.read('stickOwners.aim'),null);});
test('pause clears gesture ownership and a stale move cannot restore it',()=>{const g=game();g.pointer('moveStick','pointerdown',1,90,50);g.read('pauseGame()');g.pointer('moveStick','pointermove',1,90,50);assert.equal(g.read('touch.move.x'),0);assert.equal(g.read('stickOwners.move'),null);g.read('resumeGame()');g.pointer('moveStick','pointerdown',3,90,50);assert.ok(g.read('touch.move.x')>0);});
test('holding Escape cannot automatically resume pause',()=>{const g=game();g.key('Escape');assert.equal(g.read('gameState'),'PAUSED');g.key('Escape',true);assert.equal(g.read('gameState'),'PAUSED');});
test('keyboard bomb autorepeat consumes only one bomb',()=>{const g=game();g.key(' ');g.key(' ',true);assert.equal(g.read('player.bombs'),2);});
test('documented Shift key invokes the real dodge',()=>{const g=game();g.key('Shift');assert.equal(g.read('player.dodgeCd'),50);assert.equal(g.read('player.isInvulnerable'),true);});
test('controller cannot fire or spend bombs on the title screen',()=>{const g=game();g.read("gameState='TITLE'");g.buttons([0,7]);g.frame();assert.equal(g.read('player.bombs'),3);assert.equal(g.read('bullets.length'),0);});
test('canvas-relative pointer coordinates preserve desktop aiming',()=>{const g=game();g.mouse(640,0);g.frame();near(g.read('player.angle'),-Math.PI/2,'canvas geometry must map correctly');});
test('first mouse shot uses the freshly selected bearing',()=>{const g=game();g.mouse(640,0);g.read('mouse.down=true');g.frame();assert.ok(g.read('bullets[0].vy')<0);near(g.read('bullets[0].vx'),0,'new pointer aim must precede firing');});
test('one native touch tap spends one bomb even when click detail is zero',()=>{const g=game();g.tap('action-bomb');assert.equal(g.read('player.bombs'),2);});
test('one native touch pause tap cannot immediately resume itself',()=>{const g=game();g.tap('pauseBtn');assert.equal(g.read('gameState'),'PAUSED');});
test('a secondary touch press pauses before its unavailable compatibility click',()=>{const g=game();g.pointer('pauseBtn','pointerdown',12);assert.equal(g.read('gameState'),'PAUSED');});
test('keyboard and touch click discrimination preserves accessible activation',()=>{const g=game();assert.equal(g.read('isKeyboardActivation({detail:0})'),true);assert.equal(g.read('isKeyboardActivation({detail:0,pointerType:"touch"})'),false);assert.equal(g.read('isKeyboardActivation({detail:0,sourceCapabilities:{firesTouchEvents:true}})'),false);});

test('pause preserves the actual last rendered arena instead of clearing combat art',()=>{const g=game();g.frame();const before=g.drawing.length;g.read("gameState='PAUSED'");g.frame();assert.equal(g.drawing.length,before,'paused frames must not clear the arena');});
test('resize retains the paused frame at the new arena dimensions',()=>{const g=game();g.frame();g.read("gameState='PAUSED';canvas.getBoundingClientRect=()=>({width:640,height:360});resizeArena()");assert.equal(g.read('W'),640);assert.equal(g.read('H'),360);assert.ok(g.drawing.some(x=>x.method==='drawImage'&&x.args.length===5&&x.args[3]===640&&x.args[4]===360),'existing frame must be scaled into resized arena');});

test('six ship poses follow real combat and local lateral movement priority',()=>{
 const g=game();const pose=o=>g.read('chooseShipPose('+JSON.stringify({damageFlash:0,isInvulnerable:false,fireCd:0,angle:0,vx:0,vy:0,...o})+')');
 assert.equal(pose({}),0);assert.equal(pose({vy:-1}),1);assert.equal(pose({vy:1}),2);
 assert.equal(pose({fireCd:4,vy:1}),3);assert.equal(pose({isInvulnerable:true,fireCd:4}),5);
 assert.equal(pose({damageFlash:3,isInvulnerable:true,fireCd:4}),4);
 assert.equal(pose({angle:Math.PI/2,vx:1}),1,'banking must rotate with ship heading');
});
test('actual atlas renderer crops each512cell and keeps64px center anchor',()=>{
 const g=game();g.read("shipAtlasState='ready'");
 const configs=[{}, {vy:-1},{vy:1},{fireCd:1},{damageFlash:1},{isInvulnerable:true}];
 configs.forEach((config,pose)=>{g.read('Object.assign(player,'+JSON.stringify({vx:0,vy:0,angle:0,damageFlash:0,fireCd:0,isInvulnerable:false,...config})+');drawPlayerShip()');const call=g.drawing.filter(x=>x.method==='drawImage').at(-1);assert.deepEqual(call.args.slice(1),[(pose%3)*512,Math.floor(pose/3)*512,512,512,-32,-32,64,64]);});
});
test('loading invalid or failed atlas uses the retained geometric renderer',()=>{
 const g=game();for(const state of ['loading','invalid','error']){g.read('shipAtlasState='+JSON.stringify(state)+';drawPlayerShip()');}
 assert.equal(g.drawing.filter(x=>x.method==='drawImage').length,0);assert.ok(g.drawing.filter(x=>x.method==='fillRect').length>=6);
});
test('atlas load callback accepts only the actual six-cell dimensions',()=>{
 const g=game();g.read('shipAtlas.naturalWidth=512;shipAtlas.naturalHeight=512;shipAtlas.onload()');assert.equal(g.read('shipAtlasState'),'invalid');
 g.read('shipAtlas.naturalWidth=1536;shipAtlas.naturalHeight=1024;shipAtlas.onload()');assert.equal(g.read('shipAtlasState'),'ready');
 g.read('shipAtlas.onerror()');assert.equal(g.read('shipAtlasState'),'error');
});
test('real enemy collision keeps25shield damage and adds only visual damage feedback',()=>{
 const g=game();g.read("player.x=300;player.y=200;mouse.x=300;mouse.y=200;enemies=[{x:300,y:200,vx:0,vy:0,hp:30,type:'scout',speed:0}];");g.frame();
 assert.equal(g.read('player.shield'),75);assert.equal(g.read('player.hull'),100);assert.equal(g.read('player.damageFlash'),18);assert.equal(g.read('player.isInvulnerable'),false);assert.equal(g.read('chooseShipPose()'),4);
});

test('far frame covers every arena edge at center and clamped movement extremes',()=>{
 const g=game();for(const [w,h]of [[980,460],[370,208],[554,216],[160,160],[1220,640]])for(const [x,y]of [[0,0],[w,h],[w/2,h/2],[-100,-100],[w*2,h*2]]){
  const f=g.read('farFrame('+[w,h,x,y].join(',')+')');assert.ok(f.x<=1e-9&&f.y<=1e-9);assert.ok(f.x+f.width>=w-1e-9&&f.y+f.height>=h-1e-9);near(f.width/f.height,2,'background aspect ratio stays intact');
 }
});
test('far movement follows player camera at a distinct bounded depth',()=>{
 const g=game(),a=g.read('farFrame(980,460,490,230)'),b=g.read('farFrame(980,460,800,350)');
 assert.ok(b.x<a.x&&b.y<a.y);assert.equal(b.width,a.width);assert.equal(b.height,a.height);assert.ok(Math.abs(b.x-a.x)<12&&Math.abs(b.y-a.y)<8);
});
test('failed far image keeps the actual starfield and ship fallback running',()=>{
 const g=game();g.read("farEnvironmentState='error'");g.frame();assert.equal(g.read('gameState'),'PLAYING');assert.ok(g.drawing.filter(x=>x.method==='fillRect').length>=180);assert.equal(g.drawing.filter(x=>x.method==='drawImage').length,0);
});
test('far callback accepts only the retained1774x887 source',()=>{
 const g=game();g.read('farEnvironment.naturalWidth=1536;farEnvironment.naturalHeight=1024;farEnvironment.onload()');assert.equal(g.read('farEnvironmentState'),'invalid');
 g.read('farEnvironment.naturalWidth=1774;farEnvironment.naturalHeight=887;farEnvironment.onload()');assert.equal(g.read('farEnvironmentState'),'ready');
 g.read('farEnvironment.onerror()');assert.equal(g.read('farEnvironmentState'),'error');
});
test('resize scales visual star coordinates instead of bunching them at the top edge',()=>{
 const g=game();g.read('stars=[{x:960,y:180,size:1,speed:.5,color:"#ffffff"}];canvas.getBoundingClientRect=()=>({width:640,height:360});resizeArena()');assert.equal(g.read('stars[0].x'),480);assert.equal(g.read('stars[0].y'),90);
});
test('actual wave progression discovers the thread and pause/resume preserves it',()=>{
 const g=game();assert.equal(g.read('portalDiscovered'),false);assert.equal(g.read("document.getElementById('chronoThread').hidden"),true);
 g.read('spawnWave(1)');assert.equal(g.read('portalDiscovered'),false);g.read('spawnWave(2)');assert.equal(g.read('portalDiscovered'),true);assert.equal(g.read("document.getElementById('chronoThread').hidden"),false);
 g.read('pauseGame();resumeGame()');assert.equal(g.read('portalDiscovered'),true);assert.equal(g.read("document.getElementById('chronoThread').hidden"),false);
});
test('a real new-sortie reset clears discovery and restores first-wave state',()=>{
 const g=game();g.read('audio.init=()=>{audio.ctx={resume:()=>Promise.resolve(),suspend:()=>Promise.resolve()}};spawnWave(2);startGame()');
 assert.equal(g.read('portalDiscovered'),false);assert.equal(g.read('wave'),1);assert.equal(g.read("document.getElementById('chronoThread').hidden"),true);assert.equal(g.read('player.bombs'),3);
});

test('fresh-sortie neutral aim and first shot point up before any new device intent',()=>{
 const g=game();g.read('audio.init=()=>{audio.ctx={resume:()=>Promise.resolve(),suspend:()=>Promise.resolve()}};mouse.x=W/2;mouse.y=H/2;startGame()');
 g.pad([0,0,0,0]);g.frame();near(g.read('player.angle'),-Math.PI/2,'window-centered stale mouse must not replace fresh-sortie up bearing');
 g.pad([1,0,0,0]);g.frame();g.frame();near(g.read('player.angle'),-Math.PI/2,'neutral aim retains initial up bearing while strafing');
 g.read('audio.ctx=null;firePlayerWeapon()');assert.ok(g.read('bullets[0].vy')<0);near(g.read('bullets[0].vx'),0,'neutral first shot must go up');
 g.pad([0,0,1,0]);g.frame();g.read('startGame()');g.pad([0,0,0,0]);g.frame();near(g.read('player.angle'),-Math.PI/2,'new sortie resets previous device bearing only at restart');
});
