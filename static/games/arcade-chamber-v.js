(function(){
  var grid=document.getElementById('game-grid');
  if(!grid) return;
  if(!grid.querySelector('a[href*="vorathic-reef-tank"]')){
    var art=document.createElement('article');
    art.className='game-card';
    art.setAttribute('data-category','terrarium');
    art.innerHTML='<div class="game-header"><h2 class="game-title">Chamber V: Vorathic Reef Tank</h2><span class="game-tag green">Chamber V</span></div><p class="game-desc">Chamber V · Reef Covenant · Living shallows sibling to Deep-Field.</p><div class="game-actions"><span style="font-size:0.75rem;color:#94a3b8">Living Terrarium</span><a class="play-btn" href="/arcade/custom/vorathic-reef-tank/">Play Now →</a></div>';
    var anchor=grid.querySelector('[data-category="terrarium"]')||grid.lastElementChild;
    if(anchor) grid.insertBefore(art, anchor);
    else grid.appendChild(art);
  }
  // Deep-link ?filter=terrarium
  try{
    var f=new URLSearchParams(location.search).get('filter');
    if(f){
      var pill=document.querySelector('.pill[data-filter="'+f+'"]');
      if(pill) pill.click();
    }
  }catch(e){}
})();