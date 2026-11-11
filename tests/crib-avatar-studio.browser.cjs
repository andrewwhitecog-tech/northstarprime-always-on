'use strict';
// Asset inspection only: real WebGL skeletal poses, no gameplay state or achievement claims.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.NSP_PLAYWRIGHT_PATH||'playwright');
const repo=path.resolve(__dirname,'..'),out=path.join(process.env.NSP_PLAYTEST_OUT||'','avatar-studio');
if(!process.env.NSP_PLAYTEST_OUT)throw Error('NSP_PLAYTEST_OUT required');fs.mkdirSync(out,{recursive:true});
const report={utc:new Date().toISOString(),scope:'Actual browser asset-studio poses; not gameplay, artistic acceptance, native-phone or FPS certification',source:[],poses:[],errors:[]};
for(const p of ['tests/crib-avatar-studio.html','arcade/custom/crib-recovered-assets/vorath-adult-skater-v5.glb','arcade/custom/kosher-lines/city.js']){const b=fs.readFileSync(path.join(repo,p));report.source.push({path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
const persist=()=>fs.writeFileSync(path.join(out,'ACTUAL_POSE_RENDER.json'),JSON.stringify(report,null,2));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.ico':'image/x-icon','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://local');const p=path.resolve(repo,'.'+decodeURIComponent(u.pathname));assert(p.startsWith(repo+path.sep));const b=fs.readFileSync(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(b);}catch(e){res.writeHead(404);res.end('Not found');}});
test('Adult v05 actual WebGL idle, running, jump, crouch and rear asset inspection',{timeout:180000},async()=>{
 let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-gl=angle','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:1000}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});await page.goto('http://127.0.0.1:'+server.address().port+'/tests/crib-avatar-studio.html');await page.waitForFunction(()=>window.__ADULT_STUDIO__?.snapshot().firstFrame,{},{timeout:60000});
 for(const pose of ['idle','run','jump','crouch','rear']){if(pose==='rear'){await page.locator('#idle').click();await page.locator('#rear').click();}else await page.locator('#'+pose).click();const initial=await page.evaluate(()=>window.__ADULT_STUDIO__.snapshot().frames);await page.waitForFunction(n=>window.__ADULT_STUDIO__.snapshot().frames>=n+12,initial,{timeout:30000});const s=await page.evaluate(()=>window.__ADULT_STUDIO__.snapshot());assert.equal(s.bones,65);assert(s.textiles.length>0);assert(s.textiles.every(t=>t.compiled&&t.tilesPerMetre===1.3));assert(s.triangles>10000);assert.equal(s.clip,pose==='rear'?'idle':pose);await page.screenshot({path:path.join(out,'adult-'+pose+'.png')});report.poses.push({pose,...s});persist();}
 assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.passed=false;report.error=e.stack;throw e;}finally{report.finishedUtc=new Date().toISOString();persist();if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
