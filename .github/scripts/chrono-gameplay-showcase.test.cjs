'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assertRecordedImagePresence,trackOwnedChild,stopOwnedChild,parseLiveInputClock,nativeDirectionAt}=require('./chrono-gameplay-showcase.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/chrono-public-responses-42580744580.json'),'utf8'));
test('actual retained successful public response records satisfy production guard',()=>{
  assert.equal(fixture.sourceRun,42580744580);
  assert.doesNotThrow(()=>assertRecordedImagePresence(fixture.records));
});
test('explicit missing-record faults fail closed for every required image',()=>{
  for(let i=0;i<fixture.records.length;i++)
    assert.throws(()=>assertRecordedImagePresence(fixture.records.filter((_,j)=>j!==i)),/Missing actual successful image response/);
});
test('explicit non-200 record fault fails closed',()=>{
  const records=fixture.records.map((record,index)=>({...record,status:index===0?404:record.status}));
  assert.throws(()=>assertRecordedImagePresence(records),/Missing actual successful image response: far-environment-v01\.png/);
});
test('explicit malformed method-valued URL fault fails closed without treating it as a response object',()=>{
  const records=fixture.records.map((record,index)=>({...record,url:index===0?()=>record.url:record.url}));
  assert.throws(()=>assertRecordedImagePresence(records),/Missing actual successful image response: far-environment-v01\.png/);
});

test('actual owned Linux child ignores TERM and confirms bounded KILL escalation/close', {timeout:6000,skip:process.platform==='win32'}, async t=>{
  const {spawn}=require('node:child_process');
  const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.stdout.write('OWNED_FIXTURE_READY\\n');setInterval(()=>{},1000);"],
    {stdio:['ignore','pipe','pipe'],windowsHide:true});
  trackOwnedChild(child,'hosted-soft-signal-regression');
  t.after(async()=>{await stopOwnedChild(child,{softSignal:'SIGKILL',graceMs:1000,killMs:500});});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Actual fixture did not become ready')),3000);
    child.stdout.once('data',data=>{clearTimeout(timer);try{assert.match(data.toString(),/OWNED_FIXTURE_READY/);resolve();}catch(error){reject(error);}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
  });
  const result=await stopOwnedChild(child,{softSignal:'SIGTERM',graceMs:100,killMs:1000});
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.softSignalSent,true);
  assert.equal(result.escalated,true);
  assert.equal(result.killSignalSent,true);
  assert.equal(result.closedConfirmed,true);
  assert.equal(result.actualExit.signal,'SIGKILL');
  assert.equal(result.actualExit.code,null);
  assert.ok(result.elapsedMs<2500,'Actual owned exit must remain bounded');
});

test('actual failed live-input headers preserve their measured epoch gap',()=>{
  assert.equal(fixture.failedRecordingTiming.sourceRun,42584376589);
  const clock=parseLiveInputClock(fixture.failedRecordingTiming.logHeaderExcerpt);
  assert.ok(Math.abs(clock.x11EpochSeconds-1794212103.288409)<.000001);
  assert.ok(Math.abs(clock.inputStartGapSeconds-1.879826)<.000001);
});
test('missing or non-epoch live-input clock evidence fails closed',()=>{
  assert.throws(()=>parseLiveInputClock(''),/input-start timestamps required/);
  assert.throws(()=>parseLiveInputClock('Duration: N/A, start: 1.0\nDuration: N/A, start: 2.0'),/shared epoch clock/);
});
test('source-native movement schedule turns every250ms without long wall holds',()=>{
  assert.deepEqual([0,249,250,500,750,1000].map(nativeDirectionAt),['d','d','s','a','w','d']);
  let longest=0,held=0,last;
  for(let ms=0;ms<20500;ms++){const key=nativeDirectionAt(ms);held=key===last?held+1:1;longest=Math.max(longest,held);last=key;}
  assert.equal(longest,250);
  assert.throws(()=>nativeDirectionAt(-1));
});
