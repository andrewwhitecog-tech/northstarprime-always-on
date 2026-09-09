(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SideStreet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const adjacent = (a, b, n) => Number.isInteger(a) && Number.isInteger(b) &&
    a >= 0 && b >= 0 && a < n*n && b < n*n &&
    Math.abs(a%n-b%n)+Math.abs(Math.floor(a/n)-Math.floor(b/n)) === 1;
  const direction = (a,b,n) => b-a === 1 ? 'E' : b-a === -1 ? 'W' : b-a === n ? 'S' : 'N';
  function turns(path,n) {
    let count=0;
    for(let i=2;i<path.length;i++) if(direction(path[i-2],path[i-1],n)!==direction(path[i-1],path[i],n)) count++;
    return count;
  }
  function inspect(p,path) {
    if(!Array.isArray(path)||!path.length||path[0]!==p.start) return {valid:false,reason:'Start at S.'};
    let next=0;
    const seen=new Set();
    for(let i=0;i<path.length;i++) {
      const v=path[i];
      if(!Number.isInteger(v)||v<0||v>=p.size*p.size||p.blocked.includes(v)) return {valid:false,reason:'That block is closed.'};
      if(seen.has(v)) return {valid:false,reason:'A crossing can only be visited once. Undo to change your route.'};
      if(i&&!adjacent(path[i-1],v,p.size)) return {valid:false,reason:'Move one crossing up, down, left or right.'};
      if(i&&path[i-1]===p.end) return {valid:false,reason:'Home is the end of the walk.'};
      seen.add(v);
      const stop=p.stops.indexOf(v);
      if(stop>=0) {
        if(stop!==next) return {valid:false,reason:`Visit stop ${next+1} first.`};
        next++;
      }
    }
    const used=turns(path,p.size);
    const home=path[path.length-1]===p.end;
    return {valid:true,used,stops:next,home,won:home&&next===p.stops.length&&used===p.turns,
      reason:home ? (next!==p.stops.length ? `Home is too soon. Visit every stop first.` : used!==p.turns ? `You reached home with ${used} turns. This walk needs exactly ${p.turns}. Undo and try another route.` : 'Home. Every stop, exactly the right turns.') : used>p.turns ? `You have used ${used} turns; the target is ${p.turns}. Undo to rethink a corner.` : ''};
  }
  function solve(p,limit=2,prefix=[p.start]) {
    const initial=inspect(p,prefix), solutions=[];
    if(!initial.valid||initial.used>p.turns) return solutions;
    const blocked=new Set(p.blocked), seen=new Set(prefix);
    function visit(path,used,lastDir,next) {
      const at=path[path.length-1];
      if(at===p.end) {if(used===p.turns&&next===p.stops.length)solutions.push([...path]); return;}
      for(const to of [at-p.size,at+1,at+p.size,at-1]) {
        if(solutions.length>=limit) return;
        if(!adjacent(at,to,p.size)||blocked.has(to)||seen.has(to))continue;
        const s=p.stops.indexOf(to); if(s>=0&&s!==next)continue;
        const d=direction(at,to,p.size),t=used+(lastDir&&d!==lastDir?1:0);
        if(t>p.turns)continue;
        seen.add(to);path.push(to);visit(path,t,d,next+(s>=0?1:0));path.pop();seen.delete(to);
      }
    }
    visit([...prefix],initial.used,prefix.length>1?direction(prefix.at(-2),prefix.at(-1),p.size):null,initial.stops);
    return solutions;
  }
  const blank=()=>({version:1,boards:{},settings:{sound:false}});
  function restore(raw,catalog) {
    const clean=blank();
    try {
      const data=JSON.parse(raw);
      if(!data||data.version!==1||typeof data.boards!=='object'||!data.boards)return clean;
      clean.settings.sound=data.settings?.sound===true;
      if(catalog.some(p=>p.id===data.settings?.lastBoard))clean.settings.lastBoard=data.settings.lastBoard;
      for(const p of catalog) {
        const b=data.boards[p.id]; if(!b||b.revision!==p.revision||!inspect(p,b.path).valid)continue;
        clean.boards[p.id]={revision:p.revision,path:[...b.path],hints:Math.max(0,Math.min(99,Number.isInteger(b.hints)?b.hints:0)),revealed:b.revealed===true,completed:b.completed===true&&inspect(p,b.path).won};
      }
    } catch (_) {}
    return clean;
  }
  function dailyIndex(date,count) {
    if(!Number.isInteger(count)||count<1)throw new Error('Empty puzzle pack');
    const d=Date.parse(date+'T00:00:00Z'); if(!Number.isFinite(d))throw new Error('Invalid daily date');
    return ((Math.floor(d/86400000)%count)+count)%count;
  }
  function share(p,state,label) {
    const r=inspect(p,state.path);
    return `Side Street · ${label}\n${r.won?'Home':'Walk in progress'} · ${state.revealed?'solution viewed':state.hints?`${state.hints} hints`:'no hints'}\nWalk ${p.id} · ${p.turns} turns · no timer`;
  }
  return {adjacent,direction,turns,inspect,solve,restore,blank,dailyIndex,share};
});
