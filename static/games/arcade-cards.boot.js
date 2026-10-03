(function(){
  var grid=document.getElementById('game-grid');
  if(!grid) return;
  var parts=window.__NSP_ARCADE_CARDS||[];
  if(parts.length){ grid.insertAdjacentHTML('afterbegin', parts.join('')); window.__NSP_ARCADE_CARDS=null; }
})();
