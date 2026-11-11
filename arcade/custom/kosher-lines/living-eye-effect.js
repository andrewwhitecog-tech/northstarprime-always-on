// Original opt-in surface effect; Three r160 MeshStandardMaterial, UV origin bottom-left.
// eyes: [{center:[u,v],radius:[ru,rv],irisRadius:.42}]. Use transformed map UVs.
// Gaze values are normalized [-1,1]. First install owns configuration until disposed.
// enabled:true is required; memorial:true also requires allowMemorial:true.
// update(dt,{paused,gaze:{x,y}|[{x,y},...]}); no DOM, images, lights or timers.
const installed=new WeakMap();
const MAX_EYES=8,VERSION='northstar-living-eye-v1';
const bounded=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,fallback,min,max)=>Number.isFinite(v)?bounded(v,min,max):fallback;
export function installLivingEyeEffect({THREE,material,eyes=[],enabled=false,memorial=false,allowMemorial=false,gaze=true,blink=false,pulse=false,drip={}}={}){
 if(!THREE?.Vector2||!THREE?.Vector4||!THREE?.Color||!material?.isMeshStandardMaterial)throw new TypeError('Living eye requires Three and an actual MeshStandardMaterial');
 if(installed.has(material))return installed.get(material);
 if(!Array.isArray(eyes)||eyes.length>MAX_EYES)throw new RangeError('Provide at most eight UV eye ellipses');
 const regions=eyes.map((e,i)=>{const c=e?.center,r=e?.radius;if(!Array.isArray(c)||!Array.isArray(r)||c.length!==2||r.length!==2||![...c,...r].every(Number.isFinite)||r.some(n=>n<=0||n>.25)||c.some((n,k)=>n-r[k]<0||n+r[k]>1))throw new RangeError('Invalid bottom-left UV eye ellipse '+i);return {center:[...c],radius:[...r],irisRadius:finite(e.irisRadius,.42,.15,.75),phase:i*1.731};});
 const active=Boolean(enabled&&(!memorial||allowMemorial)&&regions.length),hasEyes=regions.length>0;
 const gazeEnabled=Boolean(gaze),blinkEnabled=Boolean(blink),pulseEnabled=Boolean(pulse);
 const blinkPeriod=finite(blink&&typeof blink==='object'?blink.period:undefined,7,3,30),gazeAmount=finite(gaze&&typeof gaze==='object'?gaze.amount:undefined,.14,0,.24),gazeRate=finite(gaze&&typeof gaze==='object'?gaze.rate:undefined,.18,.03,.5);
 const dripOptions=drip&&typeof drip==='object'?drip:{},dripEnabled=Boolean(dripOptions.enabled),dripLength=finite(dripOptions.length,.075,.005,.18),dripWidth=finite(dripOptions.width,.0018,.0003,.006),dripOpacity=finite(dripOptions.opacity,.62,0,.85);
 const dripColor=new THREE.Color(dripOptions.color??0x8b6632),gazes=regions.map(()=>new THREE.Vector2()),blinks=regions.map(()=>0),pulses=regions.map(()=>1);
 const uniforms={nspLEEnabled:{value:active?1:0},nspLETime:{value:0},nspLERegions:{value:regions.map(e=>new THREE.Vector4(...e.center,...e.radius))},nspLEIris:{value:regions.map(e=>e.irisRadius)},nspLEGaze:{value:gazes},nspLEBlink:{value:blinks},nspLEPulse:{value:pulses},nspLEDrip:{value:new THREE.Vector4(dripEnabled?dripOpacity:0,dripLength,dripWidth,0)},nspLEInk:{value:dripColor}};
 let time=0,disposed=false,hookCalls=0,hookPatched=false,hookError=null;
 const previousHook=material.onBeforeCompile,previousKey=material.customProgramCacheKey,baseKey=previousKey.call(material);
 const declarations=hasEyes?`
#ifdef USE_MAP
 uniform float nspLEEnabled,nspLETime;
 uniform vec4 nspLERegions[${regions.length}];
 uniform float nspLEIris[${regions.length}],nspLEBlink[${regions.length}],nspLEPulse[${regions.length}];
 uniform vec2 nspLEGaze[${regions.length}];
 uniform vec4 nspLEDrip;
 uniform vec3 nspLEInk;
 vec2 nspLivingEyeUV(vec2 uv){
  vec2 warped=uv;
  for(int i=0;i<${regions.length};i++){
   vec4 e=nspLERegions[i];vec2 q=(uv-e.xy)/e.zw;
   float outer=1.0-smoothstep(.82,1.0,length(q));
   float iris=1.0-smoothstep(nspLEIris[i]*.7,nspLEIris[i]*1.6,length(q));
   warped-=nspLEGaze[i]*e.zw*iris*nspLEEnabled;
   vec2 local=warped-e.xy;
   local*=mix(1.0,nspLEPulse[i],iris*nspLEEnabled);
   local.y/=max(.18,1.0-nspLEBlink[i]*.82*outer*nspLEEnabled);
   warped=mix(warped,e.xy+clamp(local,-e.zw,e.zw),outer*nspLEEnabled);
  }
  return warped;
 }
 float nspLivingInk(vec2 uv){
  float ink=0.0;
  for(int i=0;i<${regions.length};i++){
   vec4 e=nspLERegions[i];float phase=float(i)*1.731;
   float down=e.y-e.w*.72-uv.y;
   float lengthUV=nspLEDrip.y*(.63+.22*sin(nspLETime*.13+phase));
   float t=clamp(down/max(lengthUV,.00001),0.0,1.0);
   float trailX=e.x+e.z*.16*sin(phase)+nspLEDrip.z*.55*sin(t*4.0+nspLETime*.11+phase);
   float width=nspLEDrip.z*(.72-.42*t);
   float trail=(1.0-smoothstep(width*.35,width,abs(uv.x-trailX)))*step(0.0,down)*(1.0-smoothstep(lengthUV*.96,lengthUV,down));
   vec2 drop=vec2((uv.x-trailX)/(nspLEDrip.z*1.3),(down-lengthUV)/(nspLEDrip.z*2.3));
   float bead=1.0-smoothstep(.55,1.0,length(drop));
   ink=max(ink,max(trail,bead)*nspLEDrip.x*nspLEEnabled);
  }
  return ink;
 }
#endif
`:'';
 function compile(shader,renderer){
  previousHook.call(this,shader,renderer);
  if(disposed||!hasEyes)return;
  hookCalls++;
  const common='#include <common>',map='#include <map_fragment>';
  if(!shader.fragmentShader.includes(common)||!shader.fragmentShader.includes(map)){hookError='Required Three common/map shader chunks unavailable';throw Error(hookError);}
  Object.assign(shader.uniforms,uniforms);
  // Retain r160 video decode and alpha behavior; alter only the diffuse map lookup UV.
  const mapFragment=THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','texture2D( map, nspLivingEyeUV(vMapUv) )');
  if(mapFragment===THREE.ShaderChunk.map_fragment){hookError='Unsupported Three map lookup';throw Error(hookError);}
  shader.fragmentShader=shader.fragmentShader.replace(common,common+declarations).replace(map,mapFragment+'\n#ifdef USE_MAP\n diffuseColor.rgb=mix(diffuseColor.rgb,nspLEInk,nspLivingInk(vMapUv));\n#endif');
  hookPatched=true;
 }
 function cacheKey(){return baseKey+'|'+VERSION+':'+regions.length;}
 function update(dt,{paused=false,gaze:look}={}){
  if(disposed||!active||paused||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);time+=dt;uniforms.nspLETime.value=time;
  for(let i=0;i<regions.length;i++){
   const e=regions[i],target=Array.isArray(look)?look[i]:look,explicit=target&&Number.isFinite(target.x)&&Number.isFinite(target.y);
   const x=explicit?bounded(target.x,-1,1)*gazeAmount:gazeEnabled?Math.sin(time*gazeRate+e.phase)*gazeAmount:0;
   const y=explicit?bounded(target.y,-1,1)*gazeAmount:gazeEnabled?Math.sin(time*gazeRate*.67+e.phase*.81)*gazeAmount*.48:0;
   const blend=1-Math.exp(-dt*2.4);gazes[i].x+=(x-gazes[i].x)*blend;gazes[i].y+=(y-gazes[i].y)*blend;
   const phase=(time+e.phase)%blinkPeriod,close=blinkEnabled?Math.max(0,1-Math.abs(phase-.2)/.14):0;blinks[i]=close*close*(3-2*close);
   pulses[i]=pulseEnabled?1+Math.sin(time*.72+e.phase)*.025:1;
  }
 }
 function snapshot(){return {version:VERSION,enabled:active&&!disposed,effective:active&&!disposed&&Boolean(material.map),memorial:Boolean(memorial),memorialOptIn:Boolean(allowMemorial),eyeCount:regions.length,time,disposed,mapPresent:Boolean(material.map),hookCalls,hookPatched,hookError,cacheKey:material.customProgramCacheKey(),gaze:gazes.map(v=>({x:v.x,y:v.y})),blink:[...blinks],pulse:[...pulses],drip:{enabled:active&&dripEnabled&&!disposed,color:dripColor.getHex(),length:dripLength,width:dripWidth,opacity:dripOpacity},nativeShaderAcceptance:'pending'};}
 function dispose(){if(disposed)return;disposed=true;uniforms.nspLEEnabled.value=0;if(hasEyes){if(material.onBeforeCompile===compile)material.onBeforeCompile=previousHook;if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=previousKey;material.needsUpdate=true;}if(installed.get(material)===api)installed.delete(material);}
 const api={update,snapshot,dispose};installed.set(material,api);
 if(hasEyes){material.onBeforeCompile=compile;material.customProgramCacheKey=cacheKey;material.needsUpdate=true;}
 return api;
}
export default installLivingEyeEffect;
