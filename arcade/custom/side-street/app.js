(() => {
  'use strict';
  const C=window.SideStreet,pack=window.SideStreetPuzzles,$=id=>document.getElementById(id),KEY='nsp-side-street-v1';
  let saved,storageOK=true;
  try {saved=C.restore(localStorage.getItem(KEY),pack);}catch(_){saved=C.blank();storageOK=false;}
  let index=0,mode='practice',hintCell=null,focusCell=null,audio=null;
  const today=()=>new Date().toISOString().slice(0,10);
  const puzzle=()=>pack[index];
  const state=()=>saved.boards[puzzle().id]||(saved.boards[puzzle().id]={revision:puzzle().revision,path:[puzzle().start],hints:0,revealed:false,completed:false});
  const coordinate=cell=>`row ${Math.floor(cell/puzzle().size)+1}, column ${cell%puzzle().size+1}`;
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(saved));storageOK=true;}catch(_){storageOK=false;}$('storage').textContent=storageOK?'Progress stays in this browser. Clearing browser data removes it.':'This browser cannot save progress. You can still play this session.';}
  function say(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function sound(win=false){
    if(!saved.settings.sound)return;
    try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
      (win?[392,494,587]:[330]).forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.11;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.21);});
    }catch(_){}
  }
  function focus(v){
    const b=$('board').querySelector(`[data-cell="${v}"]`);if(!b)return;
    for(const cell of $('board').children)cell.tabIndex=-1;
    b.tabIndex=0;focusCell=v;b.focus({preventScroll:true});
  }
  function drawRoute(){
    const p=puzzle(),path=state().path,board=$('board'),w=board.clientWidth,h=board.clientHeight;
    $('route').setAttribute('viewBox',`0 0 ${w} ${h}`);
    const points=path.map(v=>{const b=board.querySelector(`[data-cell="${v}"]`);return `${b.offsetLeft+b.offsetWidth/2},${b.offsetTop+b.offsetHeight/2}`;}).join(' ');
    $('route').replaceChildren();const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',points);$('route').append(line);
  }
  function render(){
    const p=puzzle(),s=state(),r=C.inspect(p,s.path),board=$('board');
    $('walk-number').textContent=`${mode==='daily'?'DAILY PICK · '+today()+' UTC':'PRACTICE'} / ${String(index+1).padStart(2,'0')}`;
    $('walk-title').textContent=p.title;$('difficulty').textContent=index===0?'Start here':index<3?'Find your feet':index<8?'A little farther':'Take a moment';
    $('target').textContent=`${p.turns} turn${p.turns===1?'':'s'}`;$('turns').textContent=`${r.used} / ${p.turns}`;$('stops').textContent=`${r.stops} / 2`;
    $('assisted').textContent=s.revealed?'Solution viewed':s.hints?`${s.hints} hint${s.hints===1?'':'s'} used`:'Take your time';
    board.style.setProperty('--size',p.size);board.setAttribute('aria-label',`${p.size} by ${p.size} map. ${p.turns} turns required. Visit stop 1, then stop 2, then home.`);
    board.replaceChildren();
    for(let v=0;v<p.size*p.size;v++){
      const b=document.createElement('button');b.type='button';b.className='cell';b.dataset.cell=v;b.tabIndex=v===(focusCell??s.path.at(-1))?0:-1;
      const stop=p.stops.indexOf(v),walked=s.path.indexOf(v),blocked=p.blocked.includes(v);
      const text=v===p.start?'S':v===p.end?'H':stop>=0?String(stop+1):blocked?'×':'•';
      const label=v===p.start?'Start':v===p.end?'Home':stop>=0?`Stop ${stop+1}`:blocked?'Closed block':'Crossing';
      b.setAttribute('aria-label',`${coordinate(v)}. ${label}${walked>=0?'. On route, step '+walked:''}${v===s.path.at(-1)?'. Current position':''}${v===hintCell?'. Hint points here':''}`);
      b.setAttribute('aria-pressed',walked>=0?'true':'false');
      if(blocked)b.classList.add('block');if(walked>=0)b.classList.add('walked');if(stop>=0)b.classList.add('stop');if(v===p.start)b.classList.add('start');if(v===p.end)b.classList.add('home');if(v===s.path.at(-1))b.classList.add('current');if(v===hintCell)b.classList.add('hinted');
      const mark=document.createElement('span');mark.className='mark';mark.textContent=text;b.append(mark);
      b.addEventListener('click',()=>choose(v));b.addEventListener('focus',()=>{focusCell=v;});board.append(b);
    }
    $('undo').disabled=s.path.length<=1;$('reset').disabled=s.path.length<=1;$('hint').disabled=r.won;$('reveal').disabled=r.won;
    $('finish').hidden=!r.won;
    if(r.won){$('finish-note').textContent=`${p.lesson} ${s.revealed?'You viewed this solution.':s.hints?'You used a hint along the way.':'You found it without hints.'}`;}
    $('walk-select').value=String(index);
    for(let i=0;i<pack.length;i++)$('walk-select').options[i].textContent=`${String(i+1).padStart(2,'0')} · ${pack[i].title}${saved.boards[pack[i].id]?.completed?' · finished':''}`;
    $('daily-note').textContent=`The shared date is ${today()} UTC. Today’s pick is walk ${C.dailyIndex(today(),pack.length)+1}.`;
    drawRoute();persist();
  }
  function choose(v){
    const s=state(),p=puzzle();
    if(C.inspect(p,s.path).won){say('This walk is complete. Start over or choose another walk.');return;}
    const prior=s.path.indexOf(v);
    if(prior>=0){s.path=s.path.slice(0,prior+1);hintCell=null;render();focus(v);say('Route rewound. Try a different corner.');return;}
    const candidate=[...s.path,v],r=C.inspect(p,candidate);
    if(!r.valid){say(r.reason,true);return;}
    s.path=candidate;s.completed=r.won;hintCell=null;render();focus(v);sound(r.won);
    if(r.won){say(r.reason);$('finish').classList.add('win-pop');}
    else say(r.reason||`At ${coordinate(v)}. ${r.used} of ${p.turns} turns used.`,!!r.reason);
  }
  function undo(){const s=state();if(s.path.length<2)return;s.path.pop();s.completed=false;hintCell=null;render();focus(s.path.at(-1));say('One step back.');}
  function reset(){const s=state();s.path=[puzzle().start];s.completed=false;hintCell=null;render();focus(puzzle().start);say('A fresh route. Hint and solution history stays with this walk.');}
  function load(i,newMode='practice') {index=i;mode=newMode;saved.settings.lastBoard=puzzle().id;hintCell=null;focusCell=null;render();const r=C.inspect(puzzle(),state().path);say(r.won?'You have already completed this walk. You can start over.':state().path.length>1?'Your route is here, just where you left it.':puzzle().lesson);}
  function hint(){
    const p=puzzle(),s=state();s.hints++;
    let prefix=[...s.path],solution=C.solve(p,1,prefix)[0];
    if(solution){hintCell=solution[prefix.length];render();say(`A way forward: the next crossing is at ${coordinate(hintCell)}. The map marks it HINT.`);}
    else{while(prefix.length>1&&!solution){prefix.pop();solution=C.solve(p,1,prefix)[0];}hintCell=prefix.at(-1);render();say(`This route cannot finish with the required turns. Undo back to ${coordinate(hintCell)}, then rethink the next step.`,true);}
  }
  pack.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.title;$('walk-select').append(o);});
  $('walk-select').addEventListener('change',e=>load(Number(e.target.value)));
  $('daily').addEventListener('click',()=>load(C.dailyIndex(today(),pack.length),'daily'));
  $('next').addEventListener('click',()=>{load((index+1)%pack.length);focus(puzzle().start);});
  $('undo').addEventListener('click',undo);$('reset').addEventListener('click',reset);$('hint').addEventListener('click',hint);
  $('sound').checked=saved.settings.sound;$('sound').addEventListener('change',e=>{saved.settings.sound=e.target.checked;persist();if(e.target.checked)sound();});
  $('reveal').addEventListener('click',()=>$('reveal-dialog').showModal());
  $('cancel-reveal').addEventListener('click',()=>$('reveal-dialog').close());
  $('confirm-reveal').addEventListener('click',()=>{const s=state();s.revealed=true;s.path=[...puzzle().solution];s.completed=true;hintCell=null;$('reveal-dialog').close();render();say('Solution displayed. Follow the line and count each corner.');});
  $('share').addEventListener('click',()=>{$('share-text').value=C.share(puzzle(),state(),mode==='daily'?today()+' UTC':'practice');$('copy-status').textContent='';$('share-dialog').showModal();});
  $('close-share').addEventListener('click',()=>$('share-dialog').close());
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('share-text').value);$('copy-status').textContent='Copied. Paste it wherever you choose.';}catch(_){$('share-text').focus();$('share-text').select();$('copy-status').textContent='Copy is unavailable here. The text is selected; use your device’s Copy command.';}});
  $('board').addEventListener('keydown',e=>{
    if(e.key==='Backspace'){e.preventDefault();undo();return;}
    const delta={ArrowUp:-puzzle().size,ArrowDown:puzzle().size,ArrowLeft:-1,ArrowRight:1}[e.key];if(delta===undefined)return;
    e.preventDefault();const v=focusCell??state().path.at(-1),to=v+delta;if(C.adjacent(v,to,puzzle().size))focus(to);
  });
  new ResizeObserver(drawRoute).observe($('board'));
  // Optional standard-pad support; only active while map owns browser focus.
  let padFrame=null,previous=[];
  function pollPad(){const g=[...navigator.getGamepads()].find(Boolean);if(!g){padFrame=null;previous=[];return;}
    if($('board').contains(document.activeElement))g.buttons.forEach((b,i)=>{if(b.pressed&&!previous[i]){if(i===0)choose(focusCell??state().path.at(-1));if(i===1)undo();const key={12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight'}[i];if(key)$('board').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));}});
    previous=g.buttons.map(b=>b.pressed);padFrame=requestAnimationFrame(pollPad);
  }
  window.addEventListener('gamepadconnected',()=>{if(!padFrame)padFrame=requestAnimationFrame(pollPad);});
  window.addEventListener('pagehide',()=>{if(padFrame)cancelAnimationFrame(padFrame);audio?.close();});
  load(Math.max(0,pack.findIndex(p=>p.id===saved.settings.lastBoard)));
})();
