import {TRICKS} from './simulation.mjs';
const definitions=new Map(Object.values(TRICKS).map(trick=>[trick.id,trick]));
export function skateTrickProgress(state){
 const trick=typeof state.trick==='string'?definitions.get(state.trick):state.trick;
 const progress=trick&&Number.isFinite(state.trickTime)?Math.max(0,Math.min(1,state.trickTime/trick.duration)):0;
 return {trick,progress};
}
// Render-only: the player's and rival's real simulations are never modified.
export function applySkateTrickPose(body,board,state){
 const {trick,progress}=skateTrickProgress(state);
 body.rotation.set(0,(state.stance===1?Math.PI:0)+(trick?.bodySpin||0)*Math.PI*2*progress,state.mode==='bail'?Math.sin((state.bailTime||0)*8)*.5:0);
 board.rotation.set(state.mode==='manual'?-.15:0,(trick?.spin||0)*Math.PI*2*progress,(trick?.flip||0)*Math.PI*2*progress);
}
export function createRivalSkateboard(THREE){
 const board=new THREE.Group();board.name='Art-physical-rounded-deck-trucks-wheels';
 const shape=new THREE.Shape();shape.moveTo(-.125,-.30);shape.quadraticCurveTo(-.13,-.43,0,-.43);shape.quadraticCurveTo(.13,-.43,.125,-.30);shape.lineTo(.125,.30);shape.quadraticCurveTo(.13,.43,0,.43);shape.quadraticCurveTo(-.13,.43,-.125,.30);shape.closePath();
 const ivory=new THREE.MeshStandardMaterial({color:0xe6dfca,roughness:.65}),grip=new THREE.MeshStandardMaterial({color:0x14151b,roughness:.95}),steel=new THREE.MeshStandardMaterial({color:0xa1a7ae,metalness:.86,roughness:.28}),rubber=new THREE.MeshStandardMaterial({color:0x1b1b20,roughness:.78});
 const deckGeometry=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.004,curveSegments:12});deckGeometry.rotateX(-Math.PI/2);
 const deck=new THREE.Mesh(deckGeometry,ivory);deck.position.y=.093;deck.castShadow=deck.receiveShadow=true;board.add(deck);
 const topGeometry=new THREE.ShapeGeometry(shape,14);topGeometry.rotateX(-Math.PI/2);const top=new THREE.Mesh(topGeometry,grip);top.position.y=.112;top.receiveShadow=true;board.add(top);
 for(const z of [-.26,.26]){const truck=new THREE.Mesh(new THREE.BoxGeometry(.215,.025,.055),steel);truck.position.set(0,.061,z);board.add(truck);for(const x of [-.125,.125]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.025,14),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.033,z);board.add(wheel);}for(const x of [-.05,.05]){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.003,6),steel);bolt.position.set(x,.1125,z);board.add(bolt);}}
 return board;
}
