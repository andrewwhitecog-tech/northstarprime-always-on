(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChronoWeaponAtlas=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SOURCE='/arcade/custom/northstar-chrono-defender/assets/weapons-v01.png';
 const SPEC=Object.freeze({width:1536,height:1024,columns:3,rows:2,cell:512,anchorX:256,anchorY:256,nose:'right',sha256:'7cfa3c4bfc201f2b2ca9579ddcc298f8b0dcf9de3039993753f82516c8272544'});
 const WEAPONS=Object.freeze({plasma:Object.freeze({column:0,flightSize:32,impactSize:40}),tachyon:Object.freeze({column:1,flightSize:40,impactSize:48}),missile:Object.freeze({column:2,flightSize:32,impactSize:48})});
 const IMPACT_LIFE=12,MAX_IMPACTS=48,finite=Number.isFinite;
 function kind(bullet){
  if(!bullet||bullet.beam!==undefined&&typeof bullet.beam!=='boolean'||bullet.homing!==undefined&&typeof bullet.homing!=='boolean'||bullet.beam===true&&bullet.homing===true)return null;
  return bullet.beam===true?'tachyon':bullet.homing===true?'missile':'plasma';
 }
 function ready(image){
  if(!image||!image.complete||image.naturalWidth!==SPEC.columns*SPEC.cell||image.naturalHeight!==SPEC.rows*SPEC.cell)return false;
  try{
   const actual=new URL(image.currentSrc||image.src,image.baseURI),expected=new URL(SOURCE,image.baseURI);
   return ['http:','https:'].includes(actual.protocol)&&actual.href===expected.href;
  }catch(_){return false;}
 }
 function plan(bullet,state='flight'){
  const weapon=WEAPONS[kind(bullet)];
  if(!weapon||!['flight','impact'].includes(state)||![bullet.x,bullet.y,bullet.vx,bullet.vy].every(finite)||bullet.vx===0&&bullet.vy===0)return null;
  const size=state==='flight'?weapon.flightSize:weapon.impactSize;
  return{kind:kind(bullet),state,x:bullet.x,y:bullet.y,angle:Math.atan2(bullet.vy,bullet.vx),sx:weapon.column*SPEC.cell,sy:state==='flight'?0:SPEC.cell,sw:SPEC.cell,sh:SPEC.cell,dx:-size/2,dy:-size/2,width:size,height:size};
 }
 function paint(ctx,image,frame,opacity=1){
  ctx.save();ctx.translate(frame.x,frame.y);ctx.rotate(frame.angle);
  ctx.globalAlpha*=opacity;ctx.shadowBlur=0;
  ctx.drawImage(image,frame.sx,frame.sy,frame.sw,frame.sh,frame.dx,frame.dy,frame.width,frame.height);
  ctx.restore();
 }
 function create(image){
  // Effects are detached visual snapshots, never references to bullets/enemies/health/score.
  const impacts=[];
  function drawFlight(ctx,bullet){const frame=plan(bullet);if(!frame||!ready(image))return false;paint(ctx,image,frame);return true;}
  function recordImpact(bullet){
   const frame=plan(bullet,'impact');if(!frame||!ready(image))return false;
   if(impacts.length>=MAX_IMPACTS)impacts.shift();
   impacts.push({frame,life:IMPACT_LIFE});return true;
  }
  function drawImpacts(ctx,dt){
   if(!finite(dt)||dt<0||dt>3)return 0;
   if(!ready(image)){impacts.length=0;return 0;}
   let drawn=0;
   for(let i=impacts.length-1;i>=0;i--){const effect=impacts[i];effect.life-=dt;
    if(effect.life<=0){impacts.splice(i,1);continue;}
    paint(ctx,image,effect.frame,effect.life/IMPACT_LIFE);drawn++;
   }
   return drawn;
  }
  return Object.freeze({ready:()=>ready(image),drawFlight,recordImpact,drawImpacts,clear:()=>{impacts.length=0;},activeImpacts:()=>impacts.length});
 }
 return Object.freeze({SOURCE,SPEC,WEAPONS,IMPACT_LIFE,MAX_IMPACTS,kind,ready,plan,create});
});
