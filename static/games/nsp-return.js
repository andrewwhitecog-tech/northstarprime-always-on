(function(){
  if(document.querySelector('.nsp-return')) return;
  var s=document.createElement('style');
  s.textContent='.nsp-return{position:fixed;z-index:10050;top:10px;left:10px;display:flex;gap:8px;flex-wrap:wrap;pointer-events:none}.nsp-return a{pointer-events:auto;min-height:40px;padding:0 12px;display:inline-grid;place-items:center;border-radius:5px;text-decoration:none;font:800 10px/1 Inter,Segoe UI,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;border:1px solid rgba(102,247,237,.45);background:linear-gradient(145deg,rgba(3,7,16,.92),rgba(10,8,24,.8));color:#66f7ed;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.35)}.nsp-return a:hover{border-color:#f7ce66;color:#f7ce66}.nsp-return a.secondary{border-color:rgba(148,163,184,.35);color:#94a3b8;font-weight:700}.nsp-return a.secondary:hover{border-color:#66f7ed;color:#66f7ed}';
  document.head.appendChild(s);
  var n=document.createElement('nav');
  n.className='nsp-return';
  n.setAttribute('aria-label','Return navigation');
  n.innerHTML='<a href="/digital-terrarium/">&larr; Terrarium hub</a><a class="secondary" href="/arcade/">Arcade</a>';
  document.body.insertBefore(n, document.body.firstChild);
})();
