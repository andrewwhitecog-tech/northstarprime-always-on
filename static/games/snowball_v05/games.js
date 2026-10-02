/* Three complete learning loops. All data and commands are local simulations. */
'use strict';
(() => {
const K = Station, {$,esc} = K, kind = document.body.dataset.game;
const configs = {
 router:{kind:'router',name:'ROUTEVEIL',subtitle:'Packet Router',accent:'#6fdae5',lead:'PAX MERIDIAN',role:'NETWORK PATHFINDER',scene:'THREE-FABRIC RELAY',description:'Keep the signal moving. Read the route fabric, choose the most specific matching prefix, and bring three networks online.',note:'A simplified IPv4 routing exercise. Longest-prefix selection follows RFC 1812 §5.2.4.3. Route metrics, equal-cost paths and real network configuration are outside this cabinet.'},
 query:{kind:'query',name:'NULLSCRIBE',subtitle:'Query',accent:'#9cbaff',lead:'CATO INDEX',role:'ARCHIVE RETRIEVAL',scene:'THREE-VAULT ARCHIVE',description:'Recover the right records from the living archive. Build a query, inspect its result, and unlock six retrieval seals.',note:'A fixed SELECT / WHERE / ORDER BY / LIMIT sandbox. Without ORDER BY, SQL does not guarantee row order. Tasks that request sorting require an explicit sort. This cabinet uses fictional records.'},
 shell:{kind:'shell',name:'COMMANDERIE',subtitle:'Prompt Shell',accent:'#a0e4be',lead:'SERA SYNTAX',role:'PIPELINE OPERATIVE',scene:'THREE-SHELL CONSOLE',description:'Turn scattered signals into a useful answer. Chain file, API and summary stages; inspect what each command passes to the next.',note:'Everything runs in this browser on fictional fixtures. No commands, network requests or AI service calls execute. Text stages model newline-terminated lines; the summary stage is a deterministic teaching simulation.'}
};
const config = configs[kind]; if (!config) throw new Error('Unknown cabinet');
const key=`nsp_${kind}_snowball_v05`, integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
function button(id,label,cls=''){return `<button id="${id}" class="${cls}">${esc(label)}</button>`;}
function focusWork(){document.querySelector('#work button:not(:disabled)')?.focus({preventScroll:true});}

if(kind==='router') {
  const tables=[
    [{cidr:'10.0.0.0/8',iface:'eth0'},{cidr:'192.168.0.0/16',iface:'eth1'},{cidr:'0.0.0.0/0',iface:'wan'}],
    [{cidr:'10.1.0.0/16',iface:'eth2'},{cidr:'10.0.0.0/8',iface:'eth0'},{cidr:'192.168.1.0/24',iface:'eth3'},{cidr:'192.168.0.0/16',iface:'eth1'},{cidr:'0.0.0.0/0',iface:'wan'}],
    [{cidr:'172.16.4.0/24',iface:'eth0'},{cidr:'172.16.0.0/16',iface:'eth1'},{cidr:'10.8.8.0/25',iface:'eth2'},{cidr:'10.8.0.0/16',iface:'eth3'},{cidr:'0.0.0.0/0',iface:'wan'}]
  ];
  // Authored destinations guarantee overlap, default and /25 boundary practice.
  const destinations=[['10.8.4.2','192.168.7.3','203.0.113.8','10.250.6.4','192.168.200.9','198.51.100.7','10.1.0.1'],['10.1.8.9','10.2.8.9','192.168.1.200','192.168.2.6','203.0.113.9','10.1.255.254','192.168.1.1'],['10.8.8.127','10.8.8.128','172.16.4.9','172.16.5.9','10.8.8.0','198.51.100.22','10.8.255.254']];
  function ipInt(ip){const oct=String(ip).split('.');if(oct.length!==4||oct.some(o=>!/^\d{1,3}$/.test(o)||+o>255))return null;return oct.reduce((v,o)=>((v<<8)|+o)>>>0,0);}
  function match(ip,cidr){const [net,prefix]=cidr.split('/'), p=Number(prefix),a=ipInt(ip),b=ipInt(net);if(a===null||b===null||!integer(p,0,32))return false;const m=p===0?0:(0xffffffff<<(32-p))>>>0;return ((a&m)>>>0)===((b&m)>>>0);}
  function longest(ip,routes){return routes.filter(r=>match(ip,r.cidr)).sort((a,b)=>+b.cidr.split('/')[1]-a.cidr.split('/')[1])[0]||null;}
  let s = K.read(key,{});
  const best=integer(s.best,0,21)?s.best:0;
  if(!integer(s.index,0,20)||!Array.isArray(s.results)||s.results.length!==s.index||!s.results.every(r=>typeof r==='boolean')||s.results.filter(r=>!r).length>=3)s={index:0,results:[],best};
  s.best=best;
  let locked=false, selected=null, ended=false;
  const delivered=()=>s.results.filter(Boolean).length;
  const strikes=()=>s.results.filter(r=>!r).length;
  function persist(){K.write(key,s);}
  function restart(){s={index:0,results:[],best:s.best};locked=false;selected=null;ended=false;persist();render();focusWork();}
  K.mount(config,restart);
  function render(){
    const stage=Math.floor(s.index/7), packet=s.index%7, routes=tables[stage], dst=destinations[stage][packet];
    K.stats([['Fabric',`${stage+1} / 3`],['Delivered',`${delivered()} / 21`],['Link integrity',`${3-strikes()} / 3`]]);
    K.mission(['Edge fabric','Overlapping subnets','Split-prefix backbone'][stage],`Forward ${dst}. A route must contain this destination; among matching routes, the largest /number wins.`,21,s.results.map((v,i)=>v?i:-1).filter(i=>i>=0),s.index);
    $('work').innerHTML=`<div class="panel-head"><h2>Forwarding table</h2><span class="step-tag">PACKET ${packet+1} / 7</span></div><div class="table-scroll"><table><thead><tr><th scope="col">Destination prefix</th><th scope="col">Interface</th><th scope="col">Match</th></tr></thead><tbody>${routes.map((r,i)=>`<tr data-route="${i}"><td>${r.cidr}</td><td>${r.iface}</td><td class="route-verdict">—</td></tr>`).join('')}</tbody></table></div><div class="packet"><span>INCOMING DESTINATION</span><b id="destination">${dst}</b></div><h3 style="margin-bottom:10px">Choose the outgoing interface</h3><div class="choices">${routes.map(r=>`<button data-interface="${r.iface}">${r.iface}<small>${r.cidr==='0.0.0.0/0'?'Default route':'Fabric interface'}</small></button>`).join('')}</div>`;
    document.querySelectorAll('[data-interface]').forEach(b=>b.onclick=()=>choose(b.dataset.interface));
    K.advance('',null);K.feedback('Read, then route.',`Packet ${s.index+1} of 21. Three misroutes end the run. Best delivery: ${s.best}/21.`);
  }
  function choose(iface){
    if(locked||ended||K.paused)return;
    const stage=Math.floor(s.index/7),routes=tables[stage],dst=destinations[stage][s.index%7], winner=longest(dst,routes);
    if(!routes.some(r=>r.iface===iface))return;
    locked=true;selected=iface;const good=iface===winner.iface;s.results.push(good);s.best=Math.max(s.best,delivered());
    // Persist a settled transition; reload cannot award this packet twice.
    K.write(key,{...s,index:s.index+1});
    document.querySelectorAll('[data-interface]').forEach(b=>{b.disabled=true;b.classList.toggle('correct',b.dataset.interface===winner.iface);b.classList.toggle('incorrect',!good&&b.dataset.interface===iface);});
    document.querySelectorAll('[data-route]').forEach(row=>{const r=routes[+row.dataset.route],yes=match(dst,r.cidr);row.className=r===winner?'winner':yes?'match':'';row.querySelector('.route-verdict').textContent=r===winner?'✓ chosen':yes?'matches':'no match';});
    K.stats([['Fabric',`${stage+1} / 3`],['Delivered',`${delivered()} / 21`],['Link integrity',`${3-strikes()} / 3`]]);
    K.feedback(good?'Packet delivered.':'Misroute recorded.',`${winner.cidr} → ${winner.iface} is the longest matching prefix. ${winner.cidr.endsWith('/0')?'No specific route matches this destination.':'A broader matching route loses to this more specific prefix.'}`,good);
    K.advance(strikes()>=3?'View link report':s.index===20?'Bring network online':s.index%7===6?'Open next fabric':'Next packet',next);
  }
  function next(){
    if(!locked||K.paused)return;
    if(strikes()>=3||s.index===20){ended=true;const won=strikes()<3;
      $('work').innerHTML=`<div class="eyebrow">RUN REPORT</div><h2 style="margin:16px 0">${won?'Network online.':'Link interrupted.'}</h2><p>${delivered()} delivered · ${strikes()} misrouted · ${21-s.results.length} unattempted.</p><p class="disclosure">${won?'All three fabrics traversed. Replay to improve delivery accuracy.':'Review the highlighted matching prefixes, then rebuild the link.'}</p>${button('restart-report','Route again','primary')}`;
      $('restart-report').onclick=restart;K.advance('',null);K.feedback(won?'Three fabrics connected.':'Retry available.',`Best delivery: ${s.best}/21. This is a practice result, not a certification of networking skill.`,won);
      K.write(key,{index:0,results:[],best:s.best,lastRun:{delivered:delivered(),strikes:strikes(),won}});$('restart-report').focus({preventScroll:true});return;
    }
    s.index++;locked=false;selected=null;persist();render();focusWork();
  }
  render();
  window.LearningGame={kind,snapshot:()=>({...JSON.parse(JSON.stringify(s)),locked,ended,selected,destination:destinations[Math.floor(s.index/7)][s.index%7]}),match,longest};
}

if(kind==='query') {
  const cols=['id','name','age','city'];
  const rows=[{id:1,name:'Ana',age:34,city:'NYC'},{id:2,name:'Bo',age:29,city:'LA'},{id:3,name:'Cy',age:41,city:'NYC'},{id:4,name:'Di',age:22,city:'LA'},{id:5,name:'Ez',age:37,city:'SF'}];
  const select=[{label:'*',cols},{label:'name',cols:['name']},{label:'name, age',cols:['name','age']},{label:'name, city',cols:['name','city']}];
  const where=[{label:'No filter',fn:()=>true},{label:'age > 30',fn:r=>r.age>30},{label:"city = 'LA'",fn:r=>r.city==='LA'},{label:"city = 'NYC'",fn:r=>r.city==='NYC'}];
  const order=[{label:'No order',key:null,dir:1},{label:'name ASC',key:'name',dir:1},{label:'age ASC',key:'age',dir:1},{label:'age DESC',key:'age',dir:-1}];
  const limit=[{label:'All rows',n:null},{label:'LIMIT 2',n:2},{label:'LIMIT 3',n:3}];
  const tasks=[
    {name:'Column seal',goal:'Return only the name of every user. Any row order is acceptable.',solution:[1,0,0,0],sorted:false,hint:'SELECT controls the columns. Keep every row for this task.'},
    {name:'Predicate seal',goal:'Return only the names of users older than 30. Any row order is acceptable.',solution:[1,1,0,0],sorted:false,hint:'Use WHERE age > 30. The result should contain Ana, Cy and Ez.'},
    {name:'Sequence seal',goal:'Return all columns, ordered by age from youngest to oldest.',solution:[0,0,2,0],sorted:true,hint:'Keep SELECT * and add ORDER BY age ASC.'},
    {name:'City seal',goal:'Return only the names of users in LA, explicitly ordered alphabetically.',solution:[1,2,1,0],sorted:true,hint:'Combine WHERE city = LA with ORDER BY name ASC.'},
    {name:'Crown seal',goal:'Return name and age for the two oldest users, oldest first.',solution:[2,0,3,1],sorted:true,hint:'Sort age DESC before LIMIT 2. Return exactly name and age.'},
    {name:'Archive seal',goal:'Return only the names of the three youngest users, youngest first.',solution:[1,0,2,2],sorted:true,hint:'Sort age ASC before LIMIT 3, even though age is not a returned column.'}
  ];
  function execute(v){
    if(!Array.isArray(v)||v.length!==4||!v.every((x,i)=>integer(x,0,[3,3,3,2][i])))throw new Error('Invalid query options');
    const [a,b,c,d]=v;let out=rows.filter(where[b].fn);
    if(order[c].key){const {key,dir}=order[c];out.sort((x,y)=>(x[key]>y[key]?1:x[key]<y[key]?-1:0)*dir);}
    if(limit[d].n!==null)out=out.slice(0,limit[d].n);
    return {cols:select[a].cols.slice(),rows:out.map(r=>select[a].cols.map(k=>r[k]))};
  }
  function evaluate(v,i){const got=execute(v),wanted=execute(tasks[i].solution);const sameCols=JSON.stringify(got.cols)===JSON.stringify(wanted.cols);
    const values=r=>r.map(x=>JSON.stringify(x));let a=values(got.rows),b=values(wanted.rows);if(!tasks[i].sorted){a.sort();b.sort();}
    return {good:sameCols&&JSON.stringify(a)===JSON.stringify(b)&&(!tasks[i].sorted||v[2]!==0),got};
  }
  let s=K.read(key,{});s={level:integer(s.level,0,5)?s.level:0,solved:Array.isArray(s.solved)?[...new Set(s.solved.filter(i=>integer(i,0,5)))]:[]};
  let cur=[0,0,0,0],locked=false;
  function persist(){K.write(key,s);}
  function restart(){s.level=0;cur=[0,0,0,0];locked=false;persist();render();focusWork();}
  K.mount(config,restart);
  function render(){
    const task=tasks[s.level];K.stats([['Retrieval',`${s.level+1} / 6`],['Seals retained',`${s.solved.length} / 6`],['Vault',`${Math.floor(s.level/2)+1} / 3`]]);
    K.mission(task.name,task.goal,6,s.solved,s.level);
    $('work').innerHTML=`<div class="panel-head"><h2>Archive workbench</h2><span class="step-tag">TABLE / USERS</span></div>${K.table(cols,rows.map(r=>cols.map(c=>r[c])))}<div class="query-controls">${[[select,'SELECT'],[where,'WHERE'],[order,'ORDER BY'],[limit,'LIMIT']].map(([opts,label],group)=>`<div class="clause"><span>${label}</span><div class="options" role="group" aria-label="${label}">${opts.map((o,i)=>`<button data-group="${group}" data-option="${i}" aria-pressed="${cur[group]===i}">${esc(o.label)}</button>`).join('')}</div></div>`).join('')}</div><div class="preview" id="query-preview"></div>${button('run','Run query','primary')}<div class="output" id="query-output"></div>`;
    document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{if(locked||K.paused)return;cur[+b.dataset.group]=+b.dataset.option;document.querySelectorAll(`[data-group="${b.dataset.group}"]`).forEach(n=>n.setAttribute('aria-pressed',String(n===b)));preview();});
    $('run').onclick=run;preview();K.advance('',null);K.feedback('Choose the clauses.',task.hint);
  }
  function preview(){const [a,b,c,d]=cur;$('query-preview').textContent=`SELECT ${select[a].label} FROM users${b?` WHERE ${where[b].label}`:''}${c?` ORDER BY ${order[c].label}`:''}${d?` LIMIT ${limit[d].n}`:''};`;}
  function run(){
    if(locked||K.paused)return;const {good,got}=evaluate(cur,s.level);
    $('query-output').innerHTML='<h3>Returned records</h3>'+K.table(got.cols,got.rows)+`<p>${got.rows.length} row(s). ${cur[2]===0?'No row order is guaranteed without ORDER BY.':''}</p>`;
    if(good){locked=true;if(!s.solved.includes(s.level))s.solved.push(s.level);persist();document.querySelectorAll('#work button').forEach(b=>b.disabled=true);
      K.stats([['Retrieval',`${s.level+1} / 6`],['Seals retained',`${s.solved.length} / 6`],['Vault',`${Math.floor(s.level/2)+1} / 3`]]);
      K.feedback('Retrieval verified.',`${got.rows.length} row(s) returned with the requested columns${tasks[s.level].sorted?' and explicit ordering':''}.`,true);
      K.advance(s.level===5?'View archive report':'Next retrieval',next);
    }else K.feedback('Result needs a revision.',tasks[s.level].hint,false);
  }
  function next(){if(!locked||K.paused)return;if(s.level===5){$('work').innerHTML=`<div class="eyebrow">ARCHIVE RESTORED</div><h2 style="margin:16px 0">Six retrieval seals retained.</h2><p>You combined projection, filtering, sorting and limits. Your seal record remains saved for the next visit.</p><div class="actions">${button('report-replay','Replay retrievals','primary')}</div>`;$('report-replay').onclick=restart;K.advance('',null);$('report-replay').focus({preventScroll:true});return;}s.level++;cur=[0,0,0,0];locked=false;persist();render();focusWork();}
  render();window.LearningGame={kind,snapshot:()=>({...JSON.parse(JSON.stringify(s)),cur:cur.slice(),locked}),execute,evaluate};
}

if(kind==='shell') {
  const log=['boot ok','error disk full','warn low mem','error timeout','info ready'], files=['run.sh','readme.txt','app.js','notes.txt','data.csv'];
  const line=v=>({type:'text',lines:v}), json=v=>({type:'json',value:v});
  const commands={cat:'cat log.txt',ls:'ls',curl:'curl /api/user',gerr:'grep error',ginfo:'grep info',gtxt:"grep '\\.txt$'",wc:'wc -l',sort:'sort',head:'head -3',jqn:'jq -r .name',jqr:'jq -r .role',summary:'summary "log"'};
  const summary=lines=>`summary: ${lines.filter(l=>l.includes('error')).length} errors, ${lines.filter(l=>l.includes('warn')).length} warnings; ${lines.length} lines reviewed`;
  function runPipe(ids){
    let value=null;const trace=[];
    if(!ids.length)return {error:'Add a source command before running.',trace};
    if(ids.length>8)return {error:'This cabinet supports up to eight stages.',trace};
    for(const id of ids){
      let error='';if(!commands[id])error='Unknown command.';
      else if(['cat','ls','curl'].includes(id)){if(value!==null)error='Place a source at the beginning of this teaching pipeline.';else value=id==='cat'?line(log.slice()):id==='ls'?line(files.slice()):json({name:'Andre',role:'founder'});}
      else if(['jqn','jqr'].includes(id)){if(value?.type!=='json')error='jq expects the JSON fixture from curl.';else value=line([String(value.value[id==='jqn'?'name':'role'])]);}
      else if(value?.type!=='text')error='This stage expects text lines. Add a text source or extract a JSON field first.';
      else {const v=value.lines;switch(id){case'gerr':value=line(v.filter(l=>l.includes('error')));break;case'ginfo':value=line(v.filter(l=>l.includes('info')));break;case'gtxt':value=line(v.filter(l=>l.endsWith('.txt')));break;case'wc':value=line([String(v.length)]);break;case'sort':value=line(v.slice().sort());break;case'head':value=line(v.slice(0,3));break;case'summary':value=line([summary(v)]);break;}}
      trace.push({id,label:commands[id]||id,type:error?'error':value.type,output:error||(value.type==='text'?value.lines.join('\n'):JSON.stringify(value.value))});
      if(error)return {error,trace};
    }
    return {value,trace};
  }
  const tasks=[
    {name:'Wake the console',goal:'Print all five lines of log.txt.',cmds:['cat','ls','gerr'],expected:log,hint:'Begin with a source. cat log.txt reads the fixture file.'},
    {name:'Isolate the fault',goal:'Return only the two log lines that contain error.',cmds:['cat','gerr','ginfo','wc'],expected:log.filter(l=>l.includes('error')),hint:'Read the log, then pipe its text into grep error.'},
    {name:'Count the damage',goal:'Return the number of error lines as one value: 2.',cmds:['cat','gerr','wc','sort'],expected:['2'],hint:'Read → filter → count. Counting before filtering changes the data.'},
    {name:'Bind the API',goal:'Return the name Andre from the fictional API response.',cmds:['curl','jqn','jqr','cat'],expected:['Andre'],hint:'The simulated curl returns a JSON object. jq -r .name extracts raw text.'},
    {name:'Check the summary',goal:'Summarize all five log lines: 2 errors, 1 warning, 5 lines reviewed.',cmds:['cat','summary','gerr','wc'],expected:[summary(log)],hint:'Feed the complete log to summary. This teaching stage counts its actual input; it is not a live AI model.'},
    {name:'Seal the pipeline',goal:'Return only the .txt filenames, ordered A–Z: notes.txt, then readme.txt.',cmds:['ls','gtxt','sort','head'],expected:['notes.txt','readme.txt'],hint:'List files → filter the .txt suffix → sort. Inspect each stage below.'}
  ];
  let s=K.read(key,{});s={level:integer(s.level,0,5)?s.level:0,solved:Array.isArray(s.solved)?[...new Set(s.solved.filter(i=>integer(i,0,5)))]:[]};
  let pipe=[],locked=false;
  function persist(){K.write(key,s);}
  function restart(){s.level=0;pipe=[];locked=false;persist();render();focusWork();}
  K.mount(config,restart);
  function render(){
    const task=tasks[s.level];K.stats([['Operation',`${s.level+1} / 6`],['Seals retained',`${s.solved.length} / 6`],['Execution','LOCAL SIMULATION']]);K.mission(task.name,task.goal,6,s.solved,s.level);
    $('work').innerHTML=`<div class="panel-head"><h2>Pipeline workbench</h2><span class="step-tag">SHELL ${Math.floor(s.level/2)+1} / 3</span></div><h3 style="margin-bottom:10px">Available stages</h3><div class="palette">${task.cmds.map(id=>`<button data-command="${id}">${esc(commands[id])}</button>`).join('')}</div><div class="pipeline" id="pipeline" aria-label="Pipeline stages"></div><p class="disclosure">Click a token to remove it. Simulated files, API and summary only; nothing executes outside this game.</p><div class="actions">${button('run','Run pipeline','primary')}${button('clear','Clear')}</div><div id="trace" class="output" aria-label="Pipeline trace"></div>`;
    document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{if(locked||K.paused)return;if(pipe.length>=8){K.feedback('Eight-stage limit.','Remove a token before adding another.',false);return;}pipe.push(b.dataset.command);drawPipe();});
    $('run').onclick=run;$('clear').onclick=()=>{if(locked||K.paused)return;pipe=[];drawPipe();$('trace').innerHTML='';K.feedback('Pipeline cleared.',task.hint);};drawPipe();K.advance('',null);K.feedback('Assemble a useful chain.',task.hint);
  }
  function drawPipe(){ $('pipeline').innerHTML=pipe.length?pipe.map((id,i)=>`${i?'<span class="arrow" aria-hidden="true">→</span>':''}<button data-remove="${i}" aria-label="Remove stage ${i+1}: ${esc(commands[id])}">${esc(commands[id])} ×</button>`).join(''):'<span class="muted mono">$ choose a source command…</span>';
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(locked||K.paused)return;pipe.splice(+b.dataset.remove,1);drawPipe();document.querySelector('[data-command]')?.focus({preventScroll:true});});
  }
  function run(){if(locked||K.paused)return;const result=runPipe(pipe),task=tasks[s.level];
    const good=!result.error&&result.value?.type==='text'&&JSON.stringify(result.value.lines)===JSON.stringify(task.expected);
    $('trace').innerHTML='<h3>Data after each stage</h3>'+result.trace.map((t,i)=>`<div class="trace"><span>${i+1}. ${esc(t.label)} / ${t.type.toUpperCase()}</span><pre>${esc(t.output||'(no lines)')}</pre></div>`).join('');
    if(good){locked=true;if(!s.solved.includes(s.level))s.solved.push(s.level);persist();document.querySelectorAll('#work button').forEach(b=>b.disabled=true);K.stats([['Operation',`${s.level+1} / 6`],['Seals retained',`${s.solved.length} / 6`],['Execution','LOCAL SIMULATION']]);K.feedback('Pipeline verified.','The final text matches this operation. Every intermediate result is visible in the trace.',true);K.advance(s.level===5?'View operation report':'Next operation',next);}
    else K.feedback(result.error?'Pipeline stopped.':'Output needs a revision.',result.error||task.hint,false);
  }
  function next(){if(!locked||K.paused)return;if(s.level===5){$('work').innerHTML=`<div class="eyebrow">OPERATION COMPLETE</div><h2 style="margin:16px 0">Six pipelines verified.</h2><p>You read, filtered, counted, extracted and summarized data. The full trace makes each transformation inspectable.</p><div class="actions">${button('report-replay','Replay operations','primary')}</div>`;$('report-replay').onclick=restart;K.advance('',null);$('report-replay').focus({preventScroll:true});return;}s.level++;pipe=[];locked=false;persist();render();focusWork();}
  render();window.LearningGame={kind,snapshot:()=>({...JSON.parse(JSON.stringify(s)),pipe:pipe.slice(),locked}),runPipe};
}
})();
