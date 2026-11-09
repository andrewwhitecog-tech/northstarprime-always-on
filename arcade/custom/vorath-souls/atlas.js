(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VorathAtlas=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Structural validation does not approve art, semantic pose mappings, or foot contacts.
 const declared=new WeakSet();
 const finite=Number.isFinite;
 const positiveInteger=n=>Number.isSafeInteger(n)&&n>0;
 const imageReady=image=>Boolean(image&&image.complete&&positiveInteger(image.naturalWidth)&&positiveInteger(image.naturalHeight));
 const displayReady=(pose,width,height)=>Number.isInteger(pose)&&pose>=0&&pose<4&&finite(width)&&width>0&&finite(height)&&height>0;
 const reject=reason=>Object.freeze({valid:false,reason});
 function declare(raw){
  if(!raw||typeof raw!=='object'||raw.version!==1)return reject('Unsupported atlas contract');
  if(typeof raw.source!=='string'||!raw.source.trim())return reject('Explicit source is required');
  const {imageWidth,imageHeight,grid,frames}=raw;
  if(!positiveInteger(imageWidth)||!positiveInteger(imageHeight)||imageWidth>16384||imageHeight>16384)return reject('Invalid image dimensions');
  if(!grid||!positiveInteger(grid.columns)||!positiveInteger(grid.rows)||grid.columns>64||grid.rows>64||imageWidth%grid.columns||imageHeight%grid.rows)return reject('Grid must divide the declared image exactly');
  if(!Array.isArray(frames)||frames.length!==4)return reject('Four explicit pose frames are required');
  const cellWidth=imageWidth/grid.columns,cellHeight=imageHeight/grid.rows;
  const checked=[];
  for(const frame of frames){
   if(!frame||!Number.isInteger(frame.column)||!Number.isInteger(frame.row)||frame.column<0||frame.column>=grid.columns||frame.row<0||frame.row>=grid.rows)return reject('Frame is outside the declared grid');
   if(!finite(frame.pivotX)||!finite(frame.pivotY)||frame.pivotX<0||frame.pivotX>cellWidth||frame.pivotY<0||frame.pivotY>cellHeight)return reject('Explicit frame anchor must be inside its cell');
   checked.push(Object.freeze({sx:frame.column*cellWidth,sy:frame.row*cellHeight,sw:cellWidth,sh:cellHeight,pivotX:frame.pivotX,pivotY:frame.pivotY}));
  }
  const contract=Object.freeze({valid:true,source:raw.source,imageWidth,imageHeight,frames:Object.freeze(checked)});
  declared.add(contract);return contract;
 }
 function sameSource(image,contract){
  try{
   const actual=new URL(image.currentSrc||image.src,image.baseURI);
   const expected=new URL(contract.source,image.baseURI);
   return ['http:','https:'].includes(actual.protocol)&&actual.href===expected.href;
  }catch(_){return false;}
 }
 function frame(image,contract,pose,width,height){
  if(!contract||!declared.has(contract)||!imageReady(image)||!displayReady(pose,width,height))return null;
  if(image.naturalWidth!==contract.imageWidth||image.naturalHeight!==contract.imageHeight||!sameSource(image,contract))return null;
  const selected=contract.frames[pose];
  return{sx:selected.sx,sy:selected.sy,sw:selected.sw,sh:selected.sh,dx:-selected.pivotX*width/selected.sw,dy:-selected.pivotY*height/selected.sh,dw:width,dh:height};
 }
 function keeperFrame(image,pose,width,height,baseline){
  // Both accepted keepers are exactly 2172x724, four 543px cells. Preserve their math.
  if(!imageReady(image)||image.naturalWidth!==2172||image.naturalHeight!==724||!displayReady(pose,width,height)||!finite(baseline)||baseline<0||baseline>1)return null;
  return{sx:543*pose,sy:0,sw:543,sh:724,dx:-width/2,dy:-height*baseline,dw:width,dh:height};
 }
 return Object.freeze({declare,frame,keeperFrame});
});
