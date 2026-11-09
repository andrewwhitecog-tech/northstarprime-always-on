'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const atlas=require('../atlas.js');
const image=(width=2048,height=512,source='./assets/candidate.png')=>({complete:true,naturalWidth:width,naturalHeight:height,baseURI:'https://example.invalid/souls/',src:new URL(source,'https://example.invalid/souls/').href,currentSrc:''});
const raw=()=>({version:1,source:'./assets/candidate.png',imageWidth:2048,imageHeight:512,grid:{columns:4,rows:1},frames:[0,1,2,3].map(column=>({column,row:0,pivotX:128+column*40,pivotY:400}))});
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const rendererSource=source.slice(source.indexOf('  function drawAtlasActor('),source.indexOf('\n  function drawPlayer(',source.indexOf('  function drawAtlasActor(')));
function renderer(){const calls=[];const ctx={save(){calls.push(['save']);},translate(...args){calls.push(['translate',...args]);},beginPath(){},ellipse(){},fill(){},scale(...args){calls.push(['scale',...args]);},drawImage(...args){calls.push(['drawImage',...args]);},restore(){calls.push(['restore']);}};return{calls,render:vm.runInNewContext('('+rendererSource+')',{window:{VorathAtlas:atlas},ctx})};}

test('actual keeper PNG headers match the preserved declared four-cell geometry',()=>{
 for(const name of ['vorath_exile_atlas.png','maw_guard_atlas_candidate.png']){const b=fs.readFileSync(path.join(__dirname,'../assets',name));assert.equal(b.readUInt32BE(16),2172);assert.equal(b.readUInt32BE(20),724);}
});
test('all accepted keeper poses retain exact previous draw rectangles and baselines',()=>{
 for(const[width,height,baseline]of[[126,168,594/724],[174,232,574/724]])for(let pose=0;pose<4;pose++)assert.deepEqual(atlas.keeperFrame(image(2172,724),pose,width,height,baseline),{sx:543*pose,sy:0,sw:543,sh:724,dx:-width/2,dy:-height*baseline,dw:width,dh:height});
});
test('explicit unequal per-pose anchors keep the declared actor contact stationary',()=>{
 const contract=atlas.declare(raw());assert.equal(contract.valid,true);
 for(let pose=0;pose<4;pose++){const f=atlas.frame(image(),contract,pose,85,112),p=raw().frames[pose];assert.ok(Math.abs(f.dx+p.pivotX*f.dw/f.sw)<1e-12);assert.ok(Math.abs(f.dy+p.pivotY*f.dh/f.sh)<1e-12);assert.ok(Math.abs(-(f.dx+p.pivotX*f.dw/f.sw))<1e-12);}
});
test('multirow source rectangles use declared row and column rather than a guessed strip',()=>{
 const r=raw();r.imageWidth=1024;r.imageHeight=1024;r.grid={columns:2,rows:2};r.frames=[0,1,2,3].map(n=>({column:n%2,row:Math.floor(n/2),pivotX:256,pivotY:420}));const c=atlas.declare(r);assert.deepEqual(atlas.frame(image(1024,1024),c,3,100,200),{sx:512,sy:512,sw:512,sh:512,dx:-50,dy:-164.0625,dw:100,dh:200});
});
test('nondivisible grids, noninteger cells and missing frame declarations are rejected',()=>{
 for(const change of[r=>r.imageWidth=2049,r=>r.grid.columns=0,r=>r.grid.rows=1.5,r=>r.frames.pop(),r=>r.frames[0].column=4,r=>r.frames[0].row=-1]){const r=raw();change(r);const c=atlas.declare(r);assert.equal(c.valid,false);assert.equal(atlas.frame(image(),c,0,85,112),null);}
});
test('nonfinite or out-of-cell anchors are rejected instead of clamped or guessed',()=>{
 for(const [key,value]of[['pivotX',NaN],['pivotY',Infinity],['pivotX',-1],['pivotY',513]]){const r=raw();r.frames[0][key]=value;assert.equal(atlas.declare(r).valid,false);}
});
test('natural dimensions and actual decoded-source URL must match the declaration',()=>{
 const c=atlas.declare(raw());for(const img of[image(2048,1024),image(1024,512),image(2048,512,'./other.png'),{...image(),complete:false},{...image(),naturalWidth:0},{...image(),currentSrc:'https://elsewhere.invalid/candidate.png'}])assert.equal(atlas.frame(img,c,0,85,112),null);
});
test('bad pose and display sizes never produce a draw plan',()=>{
 const c=atlas.declare(raw());for(const args of[[-1,85,112],[4,85,112],[.5,85,112],[0,0,112],[0,85,NaN]]){assert.equal(atlas.frame(image(),c,...args),null);assert.equal(atlas.keeperFrame(image(2172,724),...args,.82),null);}
});
test('contract is an immutable copy and an undeclared lookalike cannot bypass validation',()=>{
 const r=raw(),c=atlas.declare(r);r.frames[0].pivotX=500;r.imageWidth=1024;assert.equal(c.frames[0].pivotX,128);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.frames)&&Object.isFrozen(c.frames[0]));assert.equal(atlas.frame(image(),{...c},0,85,112),null);assert.equal(atlas.frame(image(),r,0,85,112),null);
});
test('changed keeper dimensions and unsupported baselines safely decline the old path',()=>{
 assert.equal(atlas.keeperFrame(image(2048,512),0,126,168,594/724),null);for(const b of[-1,2,NaN])assert.equal(atlas.keeperFrame(image(2172,724),0,126,168,b),null);
});
test('actual renderer applies facing about the same actor anchor and preserves keeper shadow transform',()=>{
 const t=renderer(),img=image(2172,724);assert.equal(t.render(img,420,380,2,126,168,594/724,true,.72),true);assert.deepEqual(t.calls.filter(c=>['translate','scale'].includes(c[0])),[['translate',420,380],['scale',-1,1]]);assert.deepEqual(t.calls.find(c=>c[0]==='drawImage').slice(2),[1086,0,543,724,-63,-168*(594/724),126,168]);assert.equal(t.calls.at(-1)[0],'restore');
});
test('actual renderer rejects invalid explicit contract with no image draw and no implicit keeper interpretation',()=>{
 const t=renderer(),img=image(2172,724);assert.equal(t.render(img,0,0,0,126,168,594/724,false,1,atlas.declare({})),false);assert.equal(t.calls.length,0);
});
test('actual renderer consumes an explicit anchor without moving the actor origin',()=>{
 const t=renderer(),img=image(),c=atlas.declare(raw());assert.equal(t.render(img,25,50,1,85,112,.82,true,1,c),true);const f=atlas.frame(img,c,1,85,112);assert.deepEqual(t.calls.find(x=>x[0]==='drawImage').slice(2),[f.sx,f.sy,f.sw,f.sh,f.dx,f.dy,f.dw,f.dh]);assert.deepEqual(t.calls.find(x=>x[0]==='translate'),['translate',25,50]);
});
