/* Original IDG rendered regalia. Black-key sampling occurs once at texture load. */
(()=>{'use strict';
const counts={allies:0,hostiles:0};let texture=null,assetError=null;
const script=document.currentScript,current=script?.dataset.game||decodeURIComponent(location.pathname).split('/').filter(Boolean).pop()?.replace(/\.html$/,'').replaceAll('-','_')||'';
const asset=new Image();
asset.onload=()=>{try{
 const canvas=document.createElement('canvas');canvas.width=asset.naturalWidth;canvas.height=asset.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(asset,0,0);
 const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data;
 // Runtime texture alpha discards only the black key, retaining colored facets.
 for(let i=0;i<d.length;i+=4){const v=Math.max(d[i],d[i+1],d[i+2]);d[i+3]=v<8?0:v<20?Math.round((v-8)*255/12):255;}
 ctx.putImageData(frame,0,0);texture=canvas;window.dispatchEvent(new Event('vorath-family-art-ready'));
}catch(e){assetError=e.message;}};
asset.onerror=()=>{assetError='Family regalia texture unavailable';};
asset.src=new URL('family_regalia_black_key_v02.png',script?.src||location.href).href;
function regalia(c,x,y,size,hostile=false,angle=0){
 if(!texture||!c||![x,y,size,angle].every(Number.isFinite)||size<=0)return;
 counts[hostile?'hostiles':'allies']++;
 c.save();c.translate(x,y);c.rotate(angle);c.scale(size/64,size/64);c.shadowBlur=0;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 const row=hostile?512:0;
 c.drawImage(texture,0,row+65,512,420,-34,-32,68,56);
 c.drawImage(texture,560,row+14,412,482,-7,-8,14,23);
 // Small actors retain their original face; larger actors carry the brow setting.
 if(size>=38)c.drawImage(texture,1030,row+(hostile?40:105),500,hostile?415:235,-14,hostile?-43:-36,28,hostile?24:14);
 c.restore();
}
function gem(c,x,y,w,h){if(!texture)return;c.save();c.shadowBlur=0;c.drawImage(texture,560,14,412,482,x-w,y-h,w*2,h*2);c.restore();}
document.documentElement.dataset.vorathFamily='VORATH_FAMILY_DNA.v02';
window.VorathFamily=Object.freeze({version:'VORATH_FAMILY_DNA.v02',family:'VORATH',enemyCollective:'The Unmade',subgroup:'Severed Choir',game:current,regalia,gem,state:()=>({...counts,game:current,version:'VORATH_FAMILY_DNA.v02',assetReady:!!texture,assetError})});
})();
