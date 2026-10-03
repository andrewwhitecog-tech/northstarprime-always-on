(function(){
  var c=window.__NSP_GAME_CHUNKS||[];
  if(!c.length){console.error('NSP game chunks missing');return;}
  var code=c.join('');
  window.__NSP_GAME_CHUNKS=null;
  var s=document.createElement('script');
  s.text=code;
  document.body.appendChild(s);
})();
