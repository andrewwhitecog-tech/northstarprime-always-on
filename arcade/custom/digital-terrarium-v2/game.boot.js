(function(){
  var c=window.__NSP_GAME_CHUNKS||[];
  if(!c.length){console.error('NSP game chunks missing');return;}
  var code=c.join('');
  window.__NSP_GAME_CHUNKS=null;
  (0,eval)(code);
})();
