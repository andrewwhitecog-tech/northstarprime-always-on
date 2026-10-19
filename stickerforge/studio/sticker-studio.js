/* StickerForge: browser-local artwork composition. No text is painted onto images. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const stage = $('#slapStage'), tray = $('#stickerTray'), status = $('#studioStatus');
  const cache = new Map(), imports = new Set();
  let catalog = [], placed = [], selected = null, collection = 'all', trayPage = 0, undo = [], redo = [], busy = 0, nextId = 1;
  const state = () => ({surface:stage.dataset.surface, placed:placed.map(s => ({...s,el:undefined})), selected});
  function message(text, kind='ready') { status.textContent=text; status.dataset.state=kind; }
  function controls() {
    $('#undoBtn').disabled=!undo.length; $('#redoBtn').disabled=!redo.length;
    $('#downloadPngBtn').disabled=!placed.length||busy>0;
    $('#clearSurfaceBtn').disabled=!placed.length;
    for(const id of ['stickerSizeSlider','stickerRotateSlider','stickerOpacitySlider','bringFrontBtn','sendBackBtn','duplicateBtn','deleteBtn']) $('#'+id).disabled=!selected;
  }
  function remember() { undo.push(state()); if(undo.length>50)undo.shift(); redo=[]; controls(); }
  function restore(snapshot) {
    stage.dataset.surface=snapshot.surface; placed=snapshot.placed.map(s=>({...s})); selected=snapshot.selected;
    document.querySelectorAll('.surface-btn').forEach(b=>b.classList.toggle('active',b.dataset.surface===snapshot.surface)); renderPlaced();
  }
  function select(id) {
    selected=id; const s=placed.find(s=>s.id===id);
    for(const p of placed)p.el?.classList.toggle('selected',p.id===id);
    if(s){$('#stickerSizeSlider').value=s.size;$('#stickerRotateSlider').value=s.rotation;$('#stickerOpacitySlider').value=Math.round(s.opacity*100)}
    controls();
  }
  function transform(s) {
    const r=stage.getBoundingClientRect(),size=r.width*s.size/1000;
    s.el.style.width=size+'px';s.el.style.height=size+'px';
    s.el.style.transform='translate('+(s.x*r.width-size/2)+'px,'+(s.y*r.height-size/2)+'px) rotate('+s.rotation+'deg)';s.el.style.opacity=s.opacity;
  }
  function renderPlaced() {
    stage.replaceChildren();
    placed.forEach((s,index)=>{
      const el=document.createElement('div');el.className='placed-sticker';el.dataset.stickerId=s.id;el.dataset.artworkId=s.item.id;el.style.zIndex=index+1;el.tabIndex=0;el.setAttribute('aria-label',s.item.name+'; drag to move');
      const img=document.createElement('img');img.src=s.item.file;img.alt=s.item.name;img.draggable=false;img.crossOrigin='anonymous';el.append(img);s.el=el;
      for(const [kind,label]of [['rotate','Rotate artwork'],['scale-br','Resize artwork'],['delete','Remove artwork']]){const h=document.createElement('button');h.type='button';h.className='gizmo-handle gizmo-'+kind;h.setAttribute('aria-label',label);h.title=label;if(kind==='delete')h.textContent='×';el.append(h)}
      stage.append(el);transform(s);
      el.addEventListener('focus',()=>select(s.id));
      el.addEventListener('pointerdown',e=>gesture(e,s));
      el.querySelector('.gizmo-delete').addEventListener('click',()=>remove(s.id));
    });select(selected);
    stage.dataset.artworkCount=placed.length;
  }
  new ResizeObserver(()=>placed.forEach(transform)).observe(stage);
  function gesture(e,s) {
    if(e.target.closest('.gizmo-delete'))return;
    e.preventDefault();e.stopPropagation();select(s.id);remember();
    const target=e.target.closest('.gizmo-handle')||s.el,r=stage.getBoundingClientRect();
    const kind=target.classList.contains('gizmo-rotate')?'rotate':target.classList.contains('gizmo-scale-br')?'scale':'move';
    const start={x:e.clientX,y:e.clientY,cx:r.left+s.x*r.width,cy:r.top+s.y*r.height,sx:s.x,sy:s.y,size:s.size,rotation:s.rotation};
    const angle=Math.atan2(e.clientY-start.cy,e.clientX-start.cx);target.setPointerCapture(e.pointerId);
    const move=ev=>{if(ev.pointerId!==e.pointerId)return;ev.preventDefault();
      if(kind==='move'){s.x=Math.max(0,Math.min(1,start.sx+(ev.clientX-start.x)/r.width));s.y=Math.max(0,Math.min(1,start.sy+(ev.clientY-start.y)/r.height))}
      if(kind==='scale')s.size=Math.max(50,Math.min(500,start.size+(ev.clientX-start.x)*1000/r.width));
      if(kind==='rotate')s.rotation=((start.rotation+(Math.atan2(ev.clientY-start.cy,ev.clientX-start.cx)-angle)*180/Math.PI+540)%360)-180;
      transform(s);select(s.id);
    };
    const end=ev=>{if(ev.pointerId!==e.pointerId)return;target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);try{target.releasePointerCapture(e.pointerId)}catch{};controls()};
    target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);
  }
  async function imageFor(item) {
    if(cache.has(item.file))return cache.get(item.file);
    const promise=new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>reject(Error('Artwork loading timed out.')),15000);img.onload=()=>{clearTimeout(timer);if(img.naturalWidth>0)resolve(img);else reject(Error('Artwork has no pixels.'))};img.onerror=()=>{clearTimeout(timer);reject(Error('Artwork could not load. Try another image or retry.'))};img.src=item.file});
    cache.set(item.file,promise);try{return await promise}catch(e){cache.delete(item.file);throw e}
  }
  async function add(item,options={}) {
    busy++;controls();message('Loading '+item.name+'…','loading');
    try{await imageFor(item);remember();const id='art-'+nextId++;placed.push({id,item,x:options.x??.5,y:options.y??.5,size:options.size??260,rotation:options.rotation??0,opacity:options.opacity??1});selected=id;renderPlaced();message(item.name+' added. Drag it, or use Edit Selected.');}
    catch(e){message(e.message,'error')}finally{busy--;controls()}
  }
  function remove(id){if(!placed.some(s=>s.id===id))return;remember();placed=placed.filter(s=>s.id!==id);selected=null;renderPlaced();message('Artwork removed. Undo restores it.')}
  function renderTray() {
    const q=$('#traySearch').value.trim().toLowerCase();const items=catalog.filter(i=>(collection==='all'||i.collection===collection)&&(!q||(i.name+' '+i.collection).toLowerCase().includes(q)));
    tray.replaceChildren();
    if(!items.length){const p=document.createElement('p');p.className='tray-message';p.textContent=catalog.length?'No artwork matches. Clear search or choose another collection.':'No catalog artwork is available. Retry, or add your own image.';tray.append(p);return}
    const pageCount=Math.ceil(items.length/36);trayPage=Math.min(trayPage,Math.max(0,pageCount-1));
    for(const item of items.slice(trayPage*36,(trayPage+1)*36)){const b=document.createElement('button');b.type='button';b.className='tray-sticker-item';b.title=item.name;b.setAttribute('aria-label','Add '+item.name);const img=new Image();img.loading='lazy';img.alt=item.name;img.src=item.preview||item.file;img.onerror=()=>{img.hidden=true;b.textContent=item.name+' — preview unavailable'};b.append(img);b.addEventListener('click',()=>add(item));tray.append(b)}
    const pager=document.createElement('nav');pager.className='tray-pagination';pager.setAttribute('aria-label','Artwork pages');for(const [delta,label]of [[-1,'Previous artwork page'],[1,'Next artwork page']]){const button=document.createElement('button');button.type='button';button.className='action-pill-btn';button.textContent=delta<0?'Previous':'Next';button.setAttribute('aria-label',label);button.disabled=delta<0?trayPage===0:trayPage>=pageCount-1;button.onclick=()=>{trayPage+=delta;renderTray();tray.scrollTop=0};pager.append(button)}const info=document.createElement('span');info.textContent='Page '+(trayPage+1)+' of '+pageCount+' · '+items.length+' artworks';pager.insertBefore(info,pager.lastChild);tray.append(pager)
  }
  function renderFilters(){const wrap=$('#filterPills');wrap.replaceChildren();for(const col of ['all',...new Set(catalog.map(i=>i.collection))]){const b=document.createElement('button');b.type='button';b.className='pill-filter-btn';b.textContent=col==='all'?'All artwork':col;b.classList.toggle('active',col===collection);b.onclick=()=>{collection=col;trayPage=0;renderFilters();renderTray()};wrap.append(b)}}
  async function loadCatalog(){message('Loading the artwork catalog…','loading');$('#retryCatalogBtn').hidden=true;
    try{const response=await fetch('../catalog.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Catalog returned '+response.status+'.');const data=await response.json();if(!Array.isArray(data.items))throw Error('Catalog data is unavailable.');
      catalog=[...catalog.filter(i=>i.upload),...data.items.filter(i=>i.image&&i.name).map(i=>({id:i.id,name:i.name,file:new URL(i.image,location.href).href,preview:i.preview||(i.preview_file?'/'+i.preview_file:undefined),collection:i.collection||'Catalog artwork'}))];renderFilters();renderTray();message(catalog.length?catalog.length+' artworks available. Choose one or add your own image.':'The catalog is empty. Add your own image to begin.');
    }catch(e){renderFilters();renderTray();message('Catalog unavailable. Your composition is safe; retry or use Your Artwork. '+e.message,'error');$('#retryCatalogBtn').hidden=false}
  }
  $('#retryCatalogBtn').onclick=loadCatalog;$('#traySearch').oninput=()=>{trayPage=0;renderTray()};
  document.querySelectorAll('.sidebar-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.sidebar-tab').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-selected',String(t===b))});document.querySelectorAll('.tab-pane').forEach(p=>p.hidden=p.id!==b.dataset.tab)});
  document.querySelectorAll('.surface-btn').forEach(b=>b.onclick=()=>{remember();stage.dataset.surface=b.dataset.surface;document.querySelectorAll('.surface-btn').forEach(t=>t.classList.toggle('active',t===b));requestAnimationFrame(()=>placed.forEach(transform))});
  for(const [id,key,factor]of [['stickerSizeSlider','size',1],['stickerRotateSlider','rotation',1],['stickerOpacitySlider','opacity',.01]]){const input=$('#'+id);input.addEventListener('input',()=>{const s=placed.find(s=>s.id===selected);if(!s)return;remember();s[key]=Number(input.value)*factor;transform(s)})}
  $('#undoBtn').onclick=()=>{if(!undo.length)return;redo.push(state());restore(undo.pop());message('Last change undone.')};$('#redoBtn').onclick=()=>{if(!redo.length)return;undo.push(state());restore(redo.pop());message('Change restored.')};
  $('#clearSurfaceBtn').onclick=()=>{if(!placed.length)return;remember();placed=[];selected=null;renderPlaced();message('Surface cleared. Undo restores the composition.')};
  $('#deleteBtn').onclick=()=>remove(selected);
  $('#duplicateBtn').onclick=()=>{const s=placed.find(s=>s.id===selected);if(s)add(s.item,{...s,x:Math.min(.9,s.x+.04),y:Math.min(.9,s.y+.04)})};
  for(const [id,front]of [['bringFrontBtn',true],['sendBackBtn',false]])$('#'+id).onclick=()=>{const i=placed.findIndex(s=>s.id===selected);if(i<0)return;remember();const [s]=placed.splice(i,1);if(front)placed.push(s);else placed.unshift(s);renderPlaced();message(front?'Artwork moved to the front.':'Artwork moved to the back.')};
  $('#autoBombBtn').onclick=async()=>{if(!catalog.length){message('Load the catalog or import artwork first.','error');return}for(let i=0;i<6;i++)await add(catalog[Math.floor(Math.random()*catalog.length)],{x:.2+Math.random()*.6,y:.2+Math.random()*.6,size:180+Math.random()*90,rotation:(Math.random()-.5)*40})};
  $('#artworkUpload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Choose a PNG, JPEG or WebP smaller than 20 MB.');const url=URL.createObjectURL(file);imports.add(url);const item={id:'upload-'+Date.now(),name:file.name,file:url,preview:url,collection:'Your artwork',upload:true};await imageFor(item);catalog.unshift(item);collection='all';renderFilters();renderTray();await add(item)}catch(err){message(err.message,'error')}finally{e.target.value=''}};
  $('#orderPackBtn').onclick=()=>{if(!placed.length){message('Add artwork before requesting a print quote.','error');return}location.href='/contact/?'+new URLSearchParams({subject:'StickerForge print quote',body:'Please quote this artwork selection. No order or payment has been placed.\n'+placed.map(s=>s.item.name).join('\n')})};
  $('#downloadPngBtn').onclick=async()=>{if(!placed.length)return;busy++;controls();message('Preparing artwork PNG…','loading');try{const layout=placed.map(s=>({...s})),images=await Promise.all(layout.map(s=>imageFor(s.item)));const r=stage.getBoundingClientRect(),canvas=document.createElement('canvas');canvas.width=2048;canvas.height=Math.round(2048*r.height/r.width);const ctx=canvas.getContext('2d');layout.forEach((s,i)=>{const img=images[i],size=s.size*canvas.width/1000,ratio=Math.min(size/img.naturalWidth,size/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;ctx.save();ctx.translate(s.x*canvas.width,s.y*canvas.height);ctx.rotate(s.rotation*Math.PI/180);ctx.globalAlpha=s.opacity;ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()});const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('The browser could not export this artwork.');const link=document.createElement('a'),url=URL.createObjectURL(blob);link.download='stickerforge-artwork.png';link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);message('Artwork PNG exported with '+layout.length+' images.')}catch(e){message('Export stopped. '+e.message,'error')}finally{busy--;controls()}};
  stage.addEventListener('pointerdown',e=>{if(e.target===stage)select(null)});
  window.addEventListener('beforeunload',()=>imports.forEach(url=>URL.revokeObjectURL(url)));
  controls();loadCatalog();
})();
