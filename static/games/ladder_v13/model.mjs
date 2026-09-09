// Original Boolean puzzle campaign. HIGH/LOW contacts model software bits only.
export const LEVELS = [
  {name:'First light',sector:'01 · WAKING',inputs:['Signal'],shape:[1],rule:'Light the receiver exactly when Signal is HIGH.',target:s=>s[0],solution:[[0,0]],hint:'A HIGH contact conducts when its assigned input is HIGH.'},
  {name:'Two keys',sector:'02 · AGREEMENT',inputs:['Key A','Key B'],shape:[2],rule:'Both keys must be HIGH to open this channel.',target:s=>s[0]&&s[1],solution:[[0,0],[1,0]],hint:'Every contact in one branch must conduct. Assign one contact to each key.'},
  {name:'Quiet channel',sector:'03 · INVERSION',inputs:['Request','Noise'],shape:[2],rule:'Transmit only when Request is HIGH and Noise is LOW.',target:s=>s[0]&&!s[1],solution:[[0,0],[1,1]],hint:'Use a LOW contact to require a false input. LOW is an inverted bit test.'},
  {name:'Either beacon',sector:'04 · ALTERNATIVES',inputs:['East','West'],shape:[1,1],rule:'Light the receiver when either beacon, or both, is HIGH.',target:s=>s[0]||s[1],solution:[[0,0],[1,0]],hint:'Branches are alternatives: one complete conducting branch is enough.'},
  {name:'Clear to cross',sector:'05 · SHARED CONDITION',inputs:['East','West','Static'],shape:[2,2],rule:'Either beacon may transmit, but Static must be LOW in every case.',target:s=>(s[0]||s[1])&&!s[2],solution:[[0,0],[2,1],[1,0],[2,1]],hint:'The Static LOW condition belongs in BOTH alternative branches.'},
  {name:'One voice',sector:'06 · EXCLUSIVE',inputs:['Voice A','Voice B'],shape:[2,2],rule:'Open the channel for exactly one HIGH voice. Silence and two voices must stay dark.',target:s=>s[0]!==s[1],solution:[[0,0],[1,1],[0,1],[1,0]],hint:'One branch handles A without B; the other handles B without A.'},
  {name:'Quorum',sector:'07 · CONSENSUS',inputs:['Relay A','Relay B','Relay C'],shape:[2,2,2],rule:'Energize the receiver when at least two of the three relays are HIGH.',target:s=>s.filter(Boolean).length>=2,solution:[[0,0],[1,0],[0,0],[2,0],[1,0],[2,0]],hint:'Make one branch for each pair: A with B, A with C, and B with C.'},
  {name:'The listening gate',sector:'08 · PERMISSION',inputs:['Permit','Voice A','Voice B'],shape:[3,3],rule:'Permit must be HIGH, and exactly one voice must be HIGH.',target:s=>s[0]&&(s[1]!==s[2]),solution:[[0,0],[1,0],[2,1],[0,0],[1,1],[2,0]],hint:'Put Permit HIGH in both branches. Then describe each of the two exclusive voices.'},
  {name:'Loomwheel restored',sector:'09 · RESONANCE',inputs:['Thread A','Thread B','Thread C'],shape:[3,3,3],rule:'Exactly one of three threads must be HIGH. Every other combination stays dark.',target:s=>s.filter(Boolean).length===1,solution:[[0,0],[1,1],[2,1],[0,1],[1,0],[2,1],[0,1],[1,1],[2,0]],hint:'Give each thread its own branch: that thread HIGH, the other two LOW.'}
];
export const states=n=>Array.from({length:2**n},(_,k)=>Array.from({length:n},(_,i)=>!!(k&(1<<i))));
export const initial=level=>level.shape.flatMap(n=>Array.from({length:n},()=>[0,1]));
export function validCircuit(level,circuit){return Array.isArray(circuit)&&circuit.length===level.shape.reduce((a,b)=>a+b,0)&&circuit.every(c=>Array.isArray(c)&&c.length===2&&Number.isInteger(c[0])&&c[0]>=0&&c[0]<level.inputs.length&&(c[1]===0||c[1]===1));}
export function trace(level,circuit,input){
  if(!validCircuit(level,circuit)||input.length!==level.inputs.length)throw Error('Invalid circuit');
  let index=0;const branches=level.shape.map(count=>{let powered=true;const contacts=[];for(let i=0;i<count;i++){const [bit,inverted]=circuit[index++];const closed=inverted?!input[bit]:!!input[bit];powered=powered&&closed;contacts.push({closed,powered});}return {contacts,powered};});
  return {branches,output:branches.some(b=>b.powered)};
}
export function verify(level,circuit){const rows=states(level.inputs.length).map(input=>({input,expected:!!level.target(input),actual:trace(level,circuit,input).output}));return {passed:rows.every(r=>r.expected===r.actual),rows,failure:rows.find(r=>r.expected!==r.actual)||null};}
export function recover(raw){
  let data;try{data=JSON.parse(raw);}catch{return fresh();}
  if(!data||data.version!==13||!Array.isArray(data.missions))return fresh();
  const missions=LEVELS.map((level,i)=>{const m=data.missions[i]||{};const circuit=validCircuit(level,m.circuit)?m.circuit:initial(level);return {circuit,done:m.done===true&&verify(level,circuit).passed,attempts:Number.isInteger(m.attempts)&&m.attempts>=0?Math.min(m.attempts,1e6):0,hints:Number.isInteger(m.hints)&&m.hints>=0?Math.min(m.hints,2):0};});
  // Progress is contiguous; corrupt saves cannot unlock unreachable later sectors.
  let unlocked=0;while(unlocked<8&&missions[unlocked].done)unlocked++;
  return {version:13,current:Math.min(unlocked,Number.isInteger(data.current)&&data.current>=0?data.current:0),missions,muted:data.muted===true,still:data.still===true};
}
export function fresh(){return {version:13,current:0,missions:LEVELS.map(l=>({circuit:initial(l),done:false,attempts:0,hints:0})),muted:false,still:false};}
