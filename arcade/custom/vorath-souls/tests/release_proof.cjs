'use strict';
// A source acceptance is reusable; a reused record is never a fresh public run.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../../..');
const BINDING_PATHS=['arcade/custom/vorath-souls','tools/build_pages_artifact.py','tools/pages_art_quality.py','tools/public_art_quality_20261019.json','.github/scripts/native-browser-focus.cjs','.github/workflows/vorath-souls.yml'];
const FILES=['index.html','earned-story.js','atlas.js','combat.js','input.js','journey.js','threats.js','camera.js','assets/vorath_exile_atlas.png','assets/maw_guard_atlas_candidate.png','assets/inner_ring_clean_floor_v05.png',...['pursuer','flanker','charger','hexer','bulwark','reaver'].map(r=>'assets/thrall_'+r+'_strip_v03.png')];
function fingerprint(root=ROOT,ref='HEAD'){
 assert.match(ref,/^(HEAD|[a-f0-9]{7,40})$/i);
 const bindings=Object.fromEntries(BINDING_PATHS.map(p=>{const blob=cp.execFileSync(process.env.NSP_GIT||(process.platform==='win32'?'C:/Program Files/Git/cmd/git.exe':'/usr/bin/git'),['-C',root,'rev-parse',ref+':'+p],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();assert.match(blob,/^[a-f0-9]{40}$/);return[p,blob];}));
 const digest=crypto.createHash('sha256').update(JSON.stringify(bindings)).digest('hex');return{key:'souls-source-proof-v1-'+digest,bindings};
}
function validatePublic(report){
 assert.equal(report?.passed,true,'only a genuine passed public result can be sealed');assert.ok(Array.isArray(report.errors)&&report.errors.length===0,'public phase failures forbid acceptance');assert.ok(!report.error,'a public runner error forbids acceptance');assert.match(report.scope||'',/^Public QA release smoke:/);assert.ok(Number.isFinite(Date.parse(report.finishedUtc)),'completed public run required');assert.match(report.exportDerivation?.sourceCommit||'',/^[a-f0-9]{40}$/);
 const expected=report.exportDerivation.files;assert.ok(Array.isArray(expected));assert.equal(expected.length,FILES.length);assert.deepEqual(expected.map(r=>r.name).sort(),[...FILES].sort());assert.ok(Array.isArray(report.identities));assert.equal(report.identities.length,FILES.length);
 for(const row of expected){assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isInteger(row.bytes)&&row.bytes>0);const actual=report.identities.filter(a=>a.name===row.name);assert.equal(actual.length,1);assert.equal(actual[0].http,200);assert.equal(actual[0].bytes,row.bytes);assert.equal(actual[0].sha256,row.sha256);}
 assert.ok(Array.isArray(report.checks)&&report.checks.length===4);for(const check of report.checks)assert.equal(check.passed,true);
 assert.ok(report.checks.some(c=>c.name==='All17 actual exported engine/helper/adapter/module/keeper/six-role/floor identities match the release'));
 for(const[width,height]of[[1280,720],[390,844],[844,390]]){const c=report.checks.find(c=>c.name==='public native Start/move/pause '+width+'x'+height);assert.ok(c,'all three real native layouts are required');assert.equal(c.layout?.width,width);assert.equal(c.layout.height,height);assert.equal(c.layout.mode,'paused');assert.ok(c.layout.events.some(e=>e.trusted===true));assert.ok(Number.isFinite(c.before?.x)&&Number.isFinite(c.moved?.x)&&c.moved.x>c.before.x+15,'actual movement evidence required');assert.ok(Number.isFinite(c.paused?.x)&&Number.isFinite(c.paused?.y));}
 return report;
}
function validateProof(proof,current){assert.equal(proof?.schema,'souls.source-acceptance.v1');assert.equal(proof.key,current.key);assert.deepEqual(proof.bindings,current.bindings);assert.match(proof.runId||'',/^\d+$/);assert.ok(Number.isFinite(Date.parse(proof.acceptedUtc)));validatePublic(proof.publicReport);return proof;}
function output(name,value){if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,name+'='+value+'\n');}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2));}
function plan(file,current){if(!fs.existsSync(file))return{needsNative:true,scope:'No accepted proof for the actual source/transform/helper identity; native public verification is required'};const prior=validateProof(JSON.parse(fs.readFileSync(file,'utf8')),current);return{needsNative:false,scope:'Earlier source acceptance reused; no fresh public-byte or native-pass claim',priorRunId:prior.runId,priorRelease:prior.publicReport.exportDerivation.sourceCommit,priorAcceptedUtc:prior.acceptedUtc,key:current.key};}
function main(){const mode=process.argv[2],current=fingerprint(),out=path.resolve(process.env.NSP_PLAYTEST_OUT||path.join(ROOT,'scratch','souls-public')),proofFile=path.join(path.resolve(process.env.NSP_SOURCE_PROOF_DIR||path.join(out,'source-proof')),'accepted.json');
 if(mode==='fingerprint'){output('key',current.key);writeJson(path.join(out,'SOURCE_IDENTITY.json'),current);console.log(JSON.stringify(current));return;}
 if(mode==='plan'){const decision=plan(proofFile,current);output('needs-native',String(decision.needsNative));writeJson(path.join(out,'SOURCE_PROOF_DECISION.json'),decision);console.log(JSON.stringify(decision));return;}
 if(mode==='seal'){const report=validatePublic(JSON.parse(fs.readFileSync(path.join(out,'PUBLIC_SOULS_ACTUAL.json'),'utf8')));assert.equal(report.exportDerivation.sourceCommit,process.env.NSP_TARGET_RELEASE_SHA);assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);const proof={schema:'souls.source-acceptance.v1',...current,runId:process.env.GITHUB_RUN_ID,acceptedUtc:new Date().toISOString(),publicReport:report};validateProof(proof,current);writeJson(proofFile,proof);console.log(JSON.stringify({key:current.key,runId:proof.runId,scope:'Saved only after actual public identities and all native layouts passed'}));return;}
 throw Error('Expected fingerprint, plan or seal');
}
module.exports={fingerprint,validatePublic,validateProof,plan,FILES,BINDING_PATHS};if(require.main===module)main();
