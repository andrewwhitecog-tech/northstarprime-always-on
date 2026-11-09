'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assertRecordedImagePresence}=require('./chrono-gameplay-showcase.cjs');
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
