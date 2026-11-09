'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assertRecordedImagePresence,trackOwnedChild,stopOwnedChild}=require('./chrono-gameplay-showcase.cjs');
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
