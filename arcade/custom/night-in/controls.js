// Original painted atlas supplied and visually reviewed by root. Accessible
// native controls stay native; the visible face is real art, not Unicode/CSS art.
export function installControls(){
  const artURL='../crib-recovered-assets/vorath-controls-v1.png';
  const state={loaded:false,error:null,width:null,height:null};
  const image=new Image();image.onload=()=>{state.loaded=true;state.width=image.naturalWidth;state.height=image.naturalHeight;};image.onerror=()=>{state.error='vorath-controls-v1.png';document.getElementById('message').textContent='The painted controls could not load. Keyboard controls remain available.';};image.src=artURL;
  function cell(button,index){button.style.setProperty('--art-x',`${index%4*100/3}%`);button.style.setProperty('--art-y',`${Math.floor(index/4)*100/3}%`);button.dataset.artCell=String(index);}
  const specs={interact:[12,'Use'],camera:[9,'Orbit'],pause:[10,'Pause'],restart:[11,'New night'],water:[14,'Water'],breath:[9,'Breathe'],left:[1,'Left'],right:[2,'Right'],leaveActivity:[15,'Room'],ripple:[9,'Ripple'],munch:[13,'Munch'],investigate:[12,'Investigate'],dial0:[0,'Amber'],dial1:[0,'Teal'],dial2:[0,'Violet'],sendSignal:[11,'Send'],chooseHearth:[12,'Hearth'],chooseBeacon:[9,'Beacon'],chapterReplay:[11,'Another signal'],loomListen:[9,'Listen / repeat'],loom0:[4,'1 · Needle'],loom1:[7,'2 · Tooth'],loom2:[9,'3 · Eye']};
  for(const [id,[index,caption]]of Object.entries(specs)){const button=document.getElementById(id);if(!button)continue;button.classList.add('art-control');button.dataset.caption=caption;button.setAttribute('aria-label',button.getAttribute('aria-label')||button.textContent);cell(button,index);if(id==='pause'||id==='restart'||id==='investigate'){new MutationObserver(()=>{button.setAttribute('aria-label',button.textContent);if(id==='pause'){button.dataset.caption=button.textContent;cell(button,button.textContent==='Resume'?11:10);}if(id==='restart')button.dataset.caption=button.textContent;}).observe(button,{childList:true});}}
  for(const button of document.querySelectorAll('[data-dir]')){button.classList.add('art-control','direction-control');const direction=button.dataset.dir;cell(button,direction==='left'?1:direction==='right'?2:0);button.style.setProperty('--art-rotate',direction==='up'?'-90deg':direction==='down'?'90deg':'0deg');}
  document.querySelector('.chapter').addEventListener('click',e=>{if(e.target.closest('button'))document.getElementById('stage').focus({preventScroll:true});});
  return {snapshot:()=>({...state})};
}
