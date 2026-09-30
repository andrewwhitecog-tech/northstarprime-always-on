const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../static/public-activity.js'),'utf8');
async function scenario(opts={}){
 const calls=[],nodes=[];let id=0;
 const document={visibilityState:'visible',createElement:()=>({style:{},setAttribute(){},append(){},textContent:''}),body:{append(x){nodes.push(x)}},addEventListener(){}};
 const good={schema:'nsp.public_activity.v1',status:'measured',browser_pageviews:0,browser_sessions:0};
 const ctx={document,location:{hostname:'northstarprime.net',pathname:opts.path||'/'},navigator:{doNotTrack:opts.dnt?'1':'0',webdriver:!!opts.bot},window:{},Date,Set,JSON,Promise,Number,AbortSignal,crypto:{randomUUID:()=>String(++id)},sessionStorage:{getItem:()=>null,setItem(){}},setTimeout:f=>{f();return 0},fetch:async(u,o)=>{calls.push({u,o});if(opts.fail)return {ok:false,status:503,json:async()=>({status:'unavailable'})};return {ok:true,status:200,json:async()=>good}}};
 vm.runInNewContext(source,ctx);for(let i=0;i<15;i++)await Promise.resolve();return {calls,nodes};
}
(async()=>{
 let s=await scenario();assert.equal(s.calls.filter(x=>x.o.method==='POST').length,1);assert(s.calls.every(x=>x.o.referrerPolicy==='no-referrer'));assert(!s.calls.some(x=>JSON.stringify(x).includes('referrer:')));
 for(const path of ['/family/','/admin/','/lauren/','/idr/signal-refrains/volume-01/','/idr/signal-refrains/the-distance-learns-my-name/']){s=await scenario({path});assert.equal(s.calls.length,0);assert.equal(s.nodes.length,0)}
 s=await scenario({dnt:true});assert.equal(s.calls.filter(x=>x.o.method==='POST').length,0);
 s=await scenario({bot:true});assert.equal(JSON.parse(s.calls.find(x=>x.o.method==='POST').o.body).automated,true);
 s=await scenario({fail:true});const posts=s.calls.filter(x=>x.o.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0].o.body,posts[1].o.body);
 console.log('5 client scenarios passed: public, excluded, privacy, automation, deduplicated retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
