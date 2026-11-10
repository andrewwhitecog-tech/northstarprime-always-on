(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VorathCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const W=1280,H=720,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function frame(width,height,focus,compact=false){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Camera needs a positive finite viewport');
  const follow=Boolean(compact&&focus&&width<=620&&height>=260&&height>width*.7);
  const scale=follow?Math.min(width/720,height/620):Math.min(width/W,height/H);
  const vw=width/scale,vh=height/scale;
  const cx=follow&&vw<W?clamp(focus.x,vw/2,W-vw/2):W/2,cy=follow&&vh<H?clamp(focus.y,vh/2,H-vh/2):H/2;
  return{scale,ox:width/2-cx*scale,oy:height/2-cy*scale,follow,width,height};
 }
 function point(view,x,y){return{x:(x-view.ox)/view.scale,y:(y-view.oy)/view.scale};}
 function cue(view,x,y,padding=18){
  const sx=x*view.scale+view.ox,sy=y*view.scale+view.oy;
  if(sx>=padding&&sx<=view.width-padding&&sy>=padding&&sy<=view.height-padding)return null;
  const cx=view.width/2,cy=view.height/2,dx=sx-cx,dy=sy-cy;
  const t=Math.min((cx-padding)/Math.max(.001,Math.abs(dx)),(cy-padding)/Math.max(.001,Math.abs(dy)));
  return{x:cx+dx*t,y:cy+dy*t,angle:Math.atan2(dy,dx)};
 }
 return{frame,point,cue};
});
