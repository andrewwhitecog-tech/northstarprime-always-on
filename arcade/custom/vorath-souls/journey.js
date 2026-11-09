(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VorathJourney=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1,KEY='nsp.vorath-souls.checkpoint.v1',UPGRADES=['blade','vitality','flow'];
 // These are locations in this journey and unnamed combat roles, not new proper castes.
 const ARENAS=[
  {name:'The Threshold',hue:190,accent:'#22d3ee',description:'Read four kinds of thrall; clear the threshold and carve its passage.',spawns:[['pursuer',650,260],['flanker',770,480],['charger',880,310],['hexer',950,480]]},
  {name:'The Inner Ring',hue:285,accent:'#c084fc',description:'Break the guarded elite from behind or with heavy blows; evade the two-strike rush.',spawns:[['pursuer',660,250],['flanker',750,510],['hexer',980,270],['bulwark',850,430],['reaver',980,480]]},
  {name:'The Bone Gate',hue:38,accent:'#edc46b',description:'The Maw Guard breaks its seal at half vitality. Survive phase two, then claim the finisher.',spawns:[['charger',710,250],['hexer',780,500],['guard',960,360]]}
 ];
 const clone=value=>JSON.parse(JSON.stringify(value));
 function fresh(){return{version:VERSION,arena:0,cleared:0,charges:0,upgrades:{blade:0,vitality:0,flow:0}};}
 function validate(value){
  if(!value||Array.isArray(value)||typeof value!=='object'||value.version!==VERSION)return null;
  if(!Number.isInteger(value.arena)||value.arena<0||value.arena>=ARENAS.length||value.cleared!==value.arena)return null;
  if(!Number.isInteger(value.charges)||value.charges<0||value.charges>99)return null;
  const levels=value.upgrades;if(!levels||Array.isArray(levels)||typeof levels!=='object'||Object.keys(levels).length!==UPGRADES.length)return null;
  for(const key of UPGRADES)if(!Object.hasOwn(levels,key)||!Number.isInteger(levels[key])||levels[key]<0||levels[key]>3)return null;
  return{version:VERSION,arena:value.arena,cleared:value.cleared,charges:value.charges,upgrades:{blade:levels.blade,vitality:levels.vitality,flow:levels.flow}};
 }
 function read(raw){if(typeof raw!=='string'||raw.length>2048)return null;try{return validate(JSON.parse(raw));}catch(_){return null;}}
 function stats(levels){return{maxHp:100+levels.vitality*20,maxStamina:100+levels.flow*10,regen:28+levels.flow*7,damageScale:1+levels.blade*.15};}
 class Journey{
  constructor(checkpoint){this.bank=validate(checkpoint)||fresh();this.retry();}
  retry(){const state=clone(this.bank);Object.assign(this,state);this.phase='combat';this.completed=false;return this;}
  earn(amount){if(this.phase!=='combat'||!Number.isInteger(amount)||amount<=0||amount>20)return false;this.charges=Math.min(99,this.charges+amount);return true;}
  completeArena(){
   if(this.phase!=='combat'||this.completed)return false;
   this.cleared=this.arena+1;
   if(this.cleared===ARENAS.length){this.phase='complete';this.completed=true;return true;}
   this.arena++;this.phase='checkpoint';this.bank=this.snapshot();return true;
  }
  enter(){if(this.phase!=='checkpoint')return false;this.phase='combat';return true;}
  cost(key){return UPGRADES.includes(key)&&this.upgrades[key]<3?3+this.upgrades[key]*2:null;}
  spend(key){const cost=this.cost(key);if(this.phase!=='checkpoint'||cost===null||this.charges<cost)return false;this.charges-=cost;this.upgrades[key]++;this.bank=this.snapshot();return true;}
  snapshot(){return{version:VERSION,arena:this.arena,cleared:this.arena,charges:this.charges,upgrades:{...this.upgrades}};}
  serialize(){return JSON.stringify(this.bank);}
  stats(){return stats(this.upgrades);}
 }
 return{VERSION,KEY,UPGRADES,ARENAS,Journey,read,validate,stats};
});
