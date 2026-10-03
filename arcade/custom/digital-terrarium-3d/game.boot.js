(async function(){
  var c=window.__NSP_MOD_CHUNKS||[];
  if(!c.length){console.error('NSP mod chunks missing');return;}
  var code=c.join('');
  window.__NSP_MOD_CHUNKS=null;
  var blob=new Blob([code],{type:'text/javascript'});
  var url=URL.createObjectURL(blob);
  await import(url);
})();
