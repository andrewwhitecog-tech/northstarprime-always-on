/* VORATH Family VII. Authored atlas materials and anatomy-aware game geometry.
 * No gameplay state, hitboxes, allegiance or random-number streams are changed. */
(() => {
  'use strict';
  const base='/static/games/family_v07/', images={}, stats={tiles:0,creatures:0,models:0,hostiles:0,portraits:0,errors:[]};
  const species=['DRIFTER','SCRAMBLER','CRUCIFORM','RORSCHACH','CHIMAERA','FIREFLY','VAMPIRE','BICAMERAL','RIFTER','NEUROGEL','LENIE','BEHEMOTH'];
  const game=document.currentScript?.dataset.game;
  const needed={void_pong:['operators'],precinct_404:['operators'],prediction_arena:['bots'],slots_biolume:['sea'],paperclip_resistance:['walkers'],precinct_404_signal:['walkers','operators'],subject_000999:['witnesses'],signal_cartographer_prime:['walkers','witnesses'],rose_window:['glazier']}[game]||[];
  const ready=Promise.all(['tiles',...needed].map(key=>new Promise(resolve=>{
    const im=images[key]=new Image();im.onload=()=>{
      // Runtime sprite compositing only; the saved generated source stays byte-exact.
      if(['walkers','witnesses','glazier'].includes(key)){
        const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);const px=g.getImageData(0,0,c.width,c.height);
        for(let n=0;n<px.data.length;n+=4)if(Math.max(px.data[n],px.data[n+1],px.data[n+2])<6)px.data[n+3]=0;
        g.putImageData(px,0,0);
        // Blob URLs avoid the browser's size limit on CSS custom-property values.
        c.toBlob(blob=>{const url=URL.createObjectURL(blob);document.documentElement.style.setProperty('--family-'+key+'-keyed',`url("${url}")`);addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});resolve(true);},'image/png');return;
      }
      resolve(true);
    };im.onerror=()=>{stats.errors.push(key);resolve(false)};im.src=base+'family_'+key+'_v07.png';
  })));
  function tile(ctx,index,x,y,w,h=w,alpha=1,atlas='tiles') {
    const im=images[atlas];if(!im?.naturalWidth)return false;
    const n=((index%9)+9)%9,sw=im.naturalWidth/3,sh=im.naturalHeight/3;
    ctx.save();ctx.globalAlpha*=alpha;
    ctx.drawImage(im,n%3*sw+3,Math.floor(n/3)*sh+3,sw-6,sh-6,x,y,w,h);ctx.restore();stats.tiles++;return true;
  }
  function gem(ctx,x,y,s,index=0){
    ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(s*.65,0);ctx.lineTo(0,s);ctx.lineTo(-s*.65,0);ctx.closePath();ctx.clip();
    tile(ctx,index,-s,-s,s*2,s*2);ctx.restore();
    ctx.save();ctx.strokeStyle='#e2b75a';ctx.lineWidth=Math.max(.5,s*.08);ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.65,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*.65,y);ctx.closePath();ctx.stroke();ctx.restore();
  }
  function creature2D(ctx,o){
    if(!images.tiles.naturalWidth)return;
    const type=String(o.type||'DRIFTER').toUpperCase(),i=Math.max(0,species.indexOf(type)),s=Math.max(2,Number(o.size)||8);
    ctx.save();ctx.translate(o.x,o.y);ctx.globalAlpha*=Math.max(.15,Math.min(1,o.alpha??1));
    // Carapace proportions retain bells, long segmented bodies, cross arms and wings.
    const elongated=['SCRAMBLER','RIFTER','LENIE'].includes(type),winged=['VAMPIRE','RORSCHACH'].includes(type);
    const rx=s*(elongated?.9:winged?.45:.64),ry=s*(elongated?.30:type==='DRIFTER'?.35:.58);
    ctx.save();ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.clip();tile(ctx,7,-rx,-ry,rx*2,ry*2);ctx.restore();
    ctx.strokeStyle='#d5ac55';ctx.lineWidth=Math.max(.55,s*.045);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();
    // Paired brow/cheek arcs and the diamond core are inherited anatomy.
    ctx.beginPath();for(const side of [-1,1]){ctx.moveTo(side*s*.06,-ry*.30);ctx.quadraticCurveTo(side*s*.28,-ry*.82,side*s*.47,-ry*.25)}ctx.stroke();
    gem(ctx,0,ry*.22,s*.22,i%7);
    for(const side of [-1,1])for(let k=0;k<2;k++)gem(ctx,side*(rx*.76+k*s*.14),-ry*.5-k*s*.12,s*(.22-k*.045),(i+k*2+3)%7);
    if(type==='CRUCIFORM')for(let k=0;k<4;k++){const a=k*Math.PI/2;gem(ctx,Math.cos(a)*s*.75,Math.sin(a)*s*.75,s*.16,(i+k)%7)}
    ctx.restore();stats.creatures++;
  }
  function portrait(atlas,index,label,extra=''){
    stats.portraits++;const n=((index%9)+9)%9;
    const span=document.createElement('span');span.className='family-portrait '+extra;
    span.style.backgroundImage=`url(${base}family_${atlas}_v07.png)`;span.style.backgroundPosition=`${n%3*50}% ${Math.floor(n/3)*50}%`;
    span.setAttribute('role','img');span.setAttribute('aria-label',label);span.dataset.familyAsset=atlas;return span.outerHTML;
  }
  function hueIndex(h){const palette=[0,40,130,185,220,280,325];return palette.map((p,i)=>[Math.abs((((h-p)%360)+540)%360-180),i]).sort((a,b)=>a[0]-b[0])[0][1]}
  const pools=new WeakMap();
  function pool(T){
    if(pools.has(T))return pools.get(T);
    const textures=new Map(),mats=new Map();
    function texture(index){if(!textures.has(index)){const t=new T.TextureLoader().load(base+'family_tiles_v07.png');if(T.SRGBColorSpace)t.colorSpace=T.SRGBColorSpace;else t.encoding=T.sRGBEncoding;t.repeat.set(.327,.327);t.offset.set(index%3/3+.003,1-(Math.floor(index/3)+1)/3+.003);textures.set(index,t)}return textures.get(index)}
    function material(index){if(!mats.has(index))mats.set(index,new T.MeshStandardMaterial({map:texture(index),color:0xffffff,metalness:.48,roughness:.26,emissive:0xffffff,emissiveMap:texture(index),emissiveIntensity:.7}));return mats.get(index)}
    const p={texture,material,gem:new T.OctahedronGeometry(1,0),ring:new T.TorusGeometry(1,.10,5,16),gold:new T.MeshStandardMaterial({map:texture(8),color:0xffd88b,metalness:.72,roughness:.29,emissive:0xffd596,emissiveMap:texture(8),emissiveIntensity:.4})};pools.set(T,p);return p;
  }
  function decorate3D(T,root,{kind='DRIFTER',size=null,hostile=false}={}){
    if(root.getObjectByName('VorathFamilyVII'))return root;
    const kit=pool(T),fish=kind==='FISH',humanoid=kind==='UNMADE';
    root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),v=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
    // Called on unplaced, unrotated roots. Existing geometry remains the collision model.
    const s=size||Math.max(v.x,v.y,v.z)*.45||1;
    if(!fish&&!humanoid){const body=root.children.find(n=>n.isMesh&&n.material&&!Array.isArray(n.material));if(body){body.material=body.material.clone();body.material.map=kit.texture(7);body.material.color.set(0xffffff);if(body.material.emissive){body.material.emissive.set(0xffffff);body.material.emissiveMap=kit.texture(7);body.material.emissiveIntensity=.35;}body.material.needsUpdate=true;}}
    const family=new T.Group();family.name='VorathFamilyVII';family.userData={family:'VORATH',collective:hostile?'The Unmade':'neutral',kind,familyShared:true};
    const cy=humanoid?box.min.y+v.y*.63:center.y,cx=center.x,cz=fish?center.z:center.z+v.z*.38;
    const jewels=[];
    function jewel(x,y,z,sx,sy,sz,index,lean=0){jewels.push({x,y,z,sx,sy,sz,index,lean})}
    function rim(x,y,z,r){const m=new T.Mesh(kit.ring,kit.gold);m.userData.familyShared=true;m.position.set(x,y,z);m.scale.setScalar(r);family.add(m)}
    const w=humanoid?v.x*.29:s*.55;
    // Gold-set diamond core; paired cheek rails; substantial splayed shoulder crystals.
    jewel(cx,cy,cz+s*.14,s*.19,s*.26,s*.12,hostile?0:6);rim(cx,cy,cz+s*.1,s*.25);
    for(const side of [-1,1]){
      for(let k=0;k<3;k++){
        const x=cx+side*(w+k*s*.12),y=cy+s*(.24+k*.08),z=cz-s*.03;
        jewel(x,y,z,s*.14,s*(.30+k*.06),s*.11,(k+(hostile?3:0)+3)%7,side*(hostile?.42:-.42));
      }
      jewel(cx+side*s*.16,cy+s*.43,cz+s*.11,s*.17,s*.05,s*.055,8,side*(hostile?-.25:.18));
    }
    if(fish){family.rotation.y=Math.PI/2;family.position.x=-center.z;}
    if(humanoid){
      jewel(cx,box.min.y+v.y*.91,cz,s*.14,s*.22,s*.09,hostile?0:6);
      const visor=new T.Mesh(new T.BoxGeometry(v.x*.25,v.y*.12,v.z*.18),kit.material(7));visor.position.set(cx,box.min.y+v.y*.83,cz);visor.userData.familyShared=true;family.add(visor);
      for(const side of [-1,1])jewel(cx+side*v.x*.055,box.min.y+v.y*.85,cz+v.z*.11,v.x*.055,v.y*.012,v.z*.04,1,side*-.2);
      family.userData.readability='inward hooks, closed mask and fractured core';
    }
    // One instanced draw for all crystals on this organism, with shared GPU resources.
    const crystals=new T.InstancedMesh(kit.gem,kit.material(6),jewels.length),transform=new T.Object3D();crystals.userData.familyShared=true;
    jewels.forEach((j,i)=>{transform.position.set(j.x,j.y,j.z);transform.scale.set(j.sx,j.sy,j.sz);transform.rotation.set(0,0,j.lean);transform.updateMatrix();crystals.setMatrixAt(i,transform.matrix);crystals.setColorAt(i,new T.Color(j.index===8?'#ffe1a0':'#ffffff'))});crystals.instanceMatrix.needsUpdate=true;family.add(crystals);
    root.add(family);stats.models++;if(hostile)stats.hostiles++;return root;
  }
  window.FamilyVII={ready,tile,gem,creature2D,portrait,hueIndex,decorate3D,texture:(T,i)=>pool(T).texture(i),material:(T,i)=>pool(T).material(i),
    state:()=>({...stats,ready:Object.values(images).every(im=>im.naturalWidth>0),images:Object.fromEntries(Object.entries(images).map(([k,v])=>[k,[v.naturalWidth,v.naturalHeight]]))})};
})();
