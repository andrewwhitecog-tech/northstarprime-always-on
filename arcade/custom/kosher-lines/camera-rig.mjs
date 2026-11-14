// Collision-aware third-person camera; no simulation or player state changes.
export function cameraOutsideSolids(anchor,desired,solids,clearance=.22){
 const dx=desired.x-anchor.x,dy=desired.y-anchor.y,dz=desired.z-anchor.z,length=Math.hypot(dx,dy,dz);let fraction=1,obstacle=null;
 if(length<1e-8)return {...desired,blocked:false,distance:0};
 for(const b of solids){let enter=0,leave=1,hit=true;
  for(const [axis,delta]of [['x',dx],['y',dy],['z',dz]]){const low=b['min'+axis.toUpperCase()]-clearance,high=b['max'+axis.toUpperCase()]+clearance,origin=anchor[axis];if(Math.abs(delta)<1e-9){if(origin<low||origin>high){hit=false;break;}}else{let a=(low-origin)/delta,z=(high-origin)/delta;if(a>z)[a,z]=[z,a];enter=Math.max(enter,a);leave=Math.min(leave,z);if(enter>leave){hit=false;break;}}}
  // A legal player anchor normally lies outside architecture. Ignore boxes
  // containing the anchor so a close-up is not collapsed onto the player's head.
  const inside=anchor.x>=b.minX-clearance&&anchor.x<=b.maxX+clearance&&anchor.y>=b.minY-clearance&&anchor.y<=b.maxY+clearance&&anchor.z>=b.minZ-clearance&&anchor.z<=b.maxZ+clearance;
  if(hit&&!inside&&leave>=0&&enter>=0&&enter<fraction){fraction=Math.max(0,enter-.06/length);obstacle=b.id||'architecture';}
 }
 return {x:anchor.x+dx*fraction,y:anchor.y+dy*fraction,z:anchor.z+dz*fraction,blocked:fraction<1,obstacle,distance:length*fraction};
}
