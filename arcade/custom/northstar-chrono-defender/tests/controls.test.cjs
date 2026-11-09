'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
assert.ok(script,'actual inline game engine must be found');
function game(){
 const handlers={};const elements=new Map();const gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>gradient),set:(o,k,v)=>(o[k]=v,true)});
 const element=id=>{if(!elements.has(id))elements.set(id,{style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getContext:()=>ctx});return elements.get(id);};
 let pads=[];const sandbox={console,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},setInterval(){},Math,
 document:{getElementById:element},window:{innerWidth:1280,innerHeight:720,addEventListener:(name,fn)=>handlers[name]=fn},navigator:{getGamepads:()=>pads}};
 vm.createContext(sandbox);vm.runInContext("'use strict';"+script[1],sandbox);
 const evalGame=code=>vm.runInContext(code,sandbox);
 evalGame("gameState='PLAYING'; mouse.x=100; mouse.y=360;");
 const pad=(axes=[0,0,0,0],fire=false)=>({connected:true,mapping:'standard',index:0,axes,buttons:Array.from({length:8},(_,i)=>({pressed:fire&&i===7,value:fire&&i===7?1:0}))});
 return{read:evalGame,frame:()=>evalGame('gameLoop(16.666)'),pad:(axes,fire=false)=>pads=[pad(axes,fire)],mouse:(x,y)=>handlers.mousemove({clientX:x,clientY:y})};
}
function near(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-9,message+'; actual='+actual);}
test('right stick facing survives the real frame mouse-aim stage',()=>{const g=game();g.pad([0,0,0,-1]);g.frame();near(g.read('player.angle'),-Math.PI/2,'right stick must point up despite stale mouse on left');});
test('neutral stick retains the last controller bearing for the next shot',()=>{const g=game();g.pad([0,0,0,-1]);g.frame();g.pad([0,0,0,0],true);g.frame();assert.ok(g.read('bullets.length')>0);assert.ok(g.read('bullets[0].vy')<0,'trigger after centering stick must still fire up');near(g.read('bullets[0].vx'),0,'shot must not turn toward stale pointer');});
test('real mouse movement can deliberately take aim ownership back',()=>{const g=game();g.pad([0,0,0,-1]);g.frame();g.pad([0,0,0,0]);g.mouse(100,360);g.frame();near(g.read('player.angle'),Math.PI,'mouse must take over when moved');});
test('new right stick aim takes ownership after mouse movement',()=>{const g=game();g.mouse(100,360);g.frame();g.pad([0,0,1,0]);g.frame();near(g.read('player.angle'),0,'right stick must take over again');});
test('a connected neutral controller does not steal active mouse aim',()=>{const g=game();g.pad([0,0,.1,.1]);g.mouse(640,0);g.frame();near(g.read('player.angle'),-Math.PI/2,'deadzone movement must not steal mouse');});
test('keyboard and mouse aiming still follows the pointer without a controller',()=>{const g=game();g.mouse(640,0);g.frame();near(g.read('player.angle'),-Math.PI/2,'mouse aim remains unchanged');});
