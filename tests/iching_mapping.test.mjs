import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const sourcePath=process.env.NSP_ORACLE_ENGINE_PATH||fileURLToPath(new URL('../mystery-school/iching/iching_data.js',import.meta.url));
const source=readFileSync(sourcePath,'utf8');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/iching_primary_mapping.json',import.meta.url),'utf8'));
const passages=JSON.parse(readFileSync(new URL('./fixtures/iching_legge1882_passages.json',import.meta.url),'utf8'));
function engine(random=Math.random){const math=Object.create(Math);math.random=random;const context={module:{exports:{}},Math:math};vm.runInNewContext(source,context,{filename:sourcePath});return context.module.exports;}
const oracle=engine();
function expectedBits(record){assert.equal(record.line_evidence.length,6);return record.line_evidence.map((e,i)=>{assert.equal(e.line,i+1);const match=e.text.match(/\b(undivided|divided)\b/);assert.ok(match);return match[1]==='undivided'?'1':'0';}).join('');}
for(const record of fixture.records){
 test('King Wen '+record.number+' matches its six primary-source lines and Unicode glyph',()=>{
  const bits=expectedBits(record);const actual=oracle.getHexagramByBinary(bits);
  assert.equal(actual.number,record.number);assert.equal(actual.binary,bits);assert.equal(actual.glyph,String.fromCodePoint(parseInt(record.codepoint,16)));
 });
}
test('complete64 identities and64 unique binary signatures',()=>{assert.equal(oracle.HEXAGRAMS.length,64);assert.equal(new Set(oracle.HEXAGRAMS.map(h=>h.binary)).size,64);assert.equal(new Set(oracle.HEXAGRAMS.map(h=>h.number)).size,64);});
test('official Unicode names retained and derived trigram composition is defined',()=>{for(const row of fixture.records){const h=oracle.getHexagramByBinary(expectedBits(row));assert.equal(h.unicodeName,row.unicode_name);assert.equal(h.codepoint,row.codepoint);assert.equal(h.lower,oracle.TRIGRAMS[h.binary.slice(0,3)].name);assert.equal(h.upper,oracle.TRIGRAMS[h.binary.slice(3)].name);assert.ok(!h.lower.includes('undefined')&&!h.upper.includes('undefined'));}});
for(const invalid of [null,undefined,0,111111,true,{},[],['1','1','1','1','1','1'],'','11111','1111111','11111x',' 111111','111111 ','00000\n','000000\n','111111\r\n']){test('reject malformed signature '+JSON.stringify(invalid),()=>{assert.throws(()=>oracle.getHexagramByBinary(invalid),/exactly six binary digits/);});}
function transcribeSource(record,kind){
 let text=record.raw;
 if(kind==='image')text=text.replace(/^[IVXLCDM 1]+[.\-]\s+/,'');
 text=text.replace(/([A-Za-z])-\n(?=[a-z])/g,'$1').replace(/\s+/g,' ').replace(/ +([;:?!])/g,'$1').trim();
 for(const correction of record.corrections){assert.equal(text.split(correction.from).length,2,'Unambiguous source correction');text=text.replace(correction.from,correction.to);}
 return text;
}
for(const record of passages.records){
 for(const kind of ['judgment','image'])test('Legge1882 '+kind+' '+record.number+' matches independently transcribed page anchors',()=>{
  const identity=fixture.records.find(r=>r.number===record.number);const actual=oracle.getHexagramByBinary(expectedBits(identity));const sourceRecord=record[kind];
  assert.equal(actual[kind],transcribeSource(sourceRecord,kind));assert.equal(actual[kind],sourceRecord.text);assert.ok(actual[kind].length>20);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.sources[kind])),sourceRecord.printed_pages.map((page,i)=>({page,url:sourceRecord.source_urls[i]})));
  assert.equal(actual.translation.translator,'James Legge');assert.equal(actual.translation.year,1882);assert.equal(actual.changingLineTextsAvailable,false);assert.equal('editorial' in actual,false);
  assert.ok(sourceRecord.anchors.length);for(const anchor of sourceRecord.anchors){assert.equal(anchor.scan_leaf,anchor.reader_index+1);assert.equal(anchor.printed_page,anchor.scan_leaf-34);}
 });
}
test('source-checked beginning/middle/end exact characters and translation boundaries',()=>{
 const get=n=>oracle.HEXAGRAMS.find(h=>h.number===n);
 assert.equal(get(1).judgment,'Khien (represents) what is great and originating, penetrating, advantageous, correct and firm.');
 assert.equal(get(32).image,'(The trigram representing) thunder and that for wind form Hang. The superior man, in accordance with this, stands firm, and does not change his method (of operation).');
 assert.equal(get(64).judgment,'Wei Zi intimates progress and success (in the circumstances which it implies). (We see) a young fox that has nearly crossed (the stream), when its tail gets immersed. There will be no advantage in any way.');
 assert.ok(get(37).judgment.endsWith('correct.'));
 assert.ok(get(61).judgment.startsWith('Kung Fu'));
 assert.ok(!get(28).image.includes('first SIX'));
});
test('all4096 primary/moving-line combinations resolve to the sourced resulting pattern',()=>{const byBits=new Map(fixture.records.map(r=>[expectedBits(r),r.number]));let sequence=[],cursor=0;const e=engine(()=>sequence[cursor++]);for(const record of fixture.records){const bits=expectedBits(record);for(let mask=0;mask<64;mask++){sequence=[];cursor=0;let expectedResult='';for(let i=0;i<6;i++){const yang=bits[i]==='1',changes=Boolean(mask&(1<<i));const sum=changes?(yang?9:6):(yang?7:8);sequence.push(...({6:[.1,.1,.1],7:[.9,.1,.1],8:[.9,.9,.1],9:[.9,.9,.9]})[sum]);expectedResult+=changes?(yang?'0':'1'):bits[i];}const cast=e.castOracle();assert.equal(cursor,18);assert.equal(cast.primaryHexagram.number,record.number);assert.equal(cast.hasChangingLines,mask!==0);assert.equal(cast.resultingHexagram?.number??null,mask?byBits.get(expectedResult):null);assert.equal(cast.lines.length,6);}}});
test('eight equiprobable three-coin outcomes retain1:3:3:1 distribution',()=>{const counts={6:0,7:0,8:0,9:0};for(let mask=0;mask<8;mask++){let i=0;const e=engine(()=>(mask & (1 << i++)) ? .9 : .1);counts[e.tossCoins().sum]++;}assert.deepEqual(counts,{6:1,7:3,8:3,9:1});});
