(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VorathInput=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BUTTON_ACTIONS={0:'light',1:'dodge',2:'heavy',3:'interact',4:'parry',8:'retry',9:'pause'};
 function vector(x,y,deadzone=0){x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;const size=Math.hypot(x,y);if(size<=deadzone)return{x:0,y:0};const magnitude=Math.min(1,(size-deadzone)/(1-deadzone));return{x:x/size*magnitude,y:y/size*magnitude};}
 class InputBridge{
  constructor(){this.touch={x:0,y:0};this.padMove={x:0,y:0};this.padAim={x:0,y:0};this.previous=[];this.padIndex=null;this.padId='';}
  setTouch(x,y){this.touch=vector(x,y);}
  releaseTouch(){this.touch={x:0,y:0};}
  movement(x,y){return vector(x+this.touch.x+this.padMove.x,y+this.touch.y+this.padMove.y);}
  pollGamepads(pads){const pad=Array.from(pads||[]).find(p=>p&&p.connected!==false&&p.mapping==='standard');
   if(!pad){this.padMove={x:0,y:0};this.padAim={x:0,y:0};this.previous=[];this.padIndex=null;this.padId='';return{actions:[],active:false,connected:false};}
   if(this.padIndex!==pad.index){this.previous=[];this.padIndex=pad.index;}
   this.padId=pad.id||'Standard controller';this.padMove=vector(pad.axes?.[0],pad.axes?.[1],.2);this.padAim=vector(pad.axes?.[2],pad.axes?.[3],.24);
   const current=Array.from(pad.buttons||[],b=>!!(b?.pressed||b?.value>.55));const actions=[];
   for(const [index,action]of Object.entries(BUTTON_ACTIONS))if(current[index]&&!this.previous[index])actions.push(action);
   this.previous=current;
   return{actions,connected:true,active:!!(actions.length||Math.hypot(this.padMove.x,this.padMove.y)||Math.hypot(this.padAim.x,this.padAim.y))};
  }
  clear(){this.releaseTouch();this.padMove={x:0,y:0};this.padAim={x:0,y:0};}
 }
 return{InputBridge,vector,BUTTON_ACTIONS};
});
