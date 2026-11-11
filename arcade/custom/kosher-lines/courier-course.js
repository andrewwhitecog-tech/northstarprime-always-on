import * as THREE from '/static/vendor/three/0.160.0/build/three.module.js';
import { COURIER_ROUTE } from './courier-trial.mjs';
// Course marks are non-solid light frames/inlays, never new invisible collision walls.
export function buildCourierCourse(scene,trial,{reducedMotion=false}={}){
 const root=new THREE.Group();root.name='courier-route-light-course';scene.add(root);let prize=null,prizeCore=null,meshCount=0;
 const gold=new THREE.MeshStandardMaterial({color:0xb28a43,metalness:.8,roughness:.4});
 const dark=new THREE.MeshStandardMaterial({color:0x182a3d,metalness:.5,roughness:.45});
 const add=(geometry,material,parent=root)=>{const o=new THREE.Mesh(geometry,material);o.castShadow=false;o.receiveShadow=false;parent.add(o);meshCount++;return o;};
 const markers=[],routePoints=[COURIER_ROUTE.start,...COURIER_ROUTE.gates];
 const digits={1:[1,2],2:[0,1,6,4,3],3:[0,1,6,2,3],4:[5,6,1,2]};
 const segments=[[0,.25,0],[.15,.13,1],[.15,-.13,1],[0,-.25,0],[-.15,-.13,1],[-.15,.13,1],[0,0,0]];
 for(const [index,point]of routePoints.entries()){
  const group=new THREE.Group();group.position.set(point.x,0,point.z);root.add(group);
  const previous=index===0?routePoints[1]:routePoints[index-1],dx=point.x-previous.x,dz=point.z-previous.z;group.rotation.y=Math.atan2(-dx,-dz);
  const glow=new THREE.MeshBasicMaterial({color:0x28565f,toneMapped:false});
  // Cantilevered black relay housings hang clear of the skating aperture, anchored to the west facade.
  const beam=(w,h,d,x,y,z,material=dark)=>{const o=add(new THREE.BoxGeometry(w,h,d),material,group);o.position.set(x,y,z);return o;};
  beam(4.5,.18,.32,0,4.65,0);for(const sign of [-1,1]){beam(.2,1.05,.35,sign*2.15,4.22,0);beam(.28,.08,.48,sign*2.15,3.7,.03,gold);for(let j=0;j<3;j++){const tooth=add(new THREE.ConeGeometry(.095,.23,3),gold,group);tooth.position.set(sign*(1.9-j*.24),4.48,.21);tooth.rotation.z=Math.PI;}for(const yy of [3.87,4.48]){const bolt=add(new THREE.CylinderGeometry(.045,.045,.04,8),gold,group);bolt.rotation.x=Math.PI/2;bolt.position.set(sign*2.15,yy,.2);}}
  const housingPoints=[new THREE.Vector3(-2.1,4.1,.21),new THREE.Vector3(-2.1,4.5,.21),new THREE.Vector3(2.1,4.5,.21),new THREE.Vector3(2.1,4.1,.21)];add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(housingPoints),24,.025,6,false),glow,group);
  const floorPath=[];for(let n=0;n<=8;n++){const a=n/8*Math.PI*2;floorPath.push(new THREE.Vector3(Math.cos(a)*point.radius,.025,Math.sin(a)*point.radius));}const floor=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(floorPath,false,'catmullrom',.01),32,.022,5,false),glow,group);
  beam(.8,.8,.12,0,4.18,.06);for(const xx of [-.32,.32])for(const yy of [3.87,4.5]){const bolt=add(new THREE.SphereGeometry(.035,6,4),gold,group);bolt.position.set(xx,yy,.14);}
  const anchorA=new THREE.Vector3(-23,6.2,point.z),anchorB=new THREE.Vector3(point.x,4.72,point.z),delta=anchorB.clone().sub(anchorA),bracket=add(new THREE.CylinderGeometry(.045,.045,delta.length(),6),dark);bracket.position.copy(anchorA).add(anchorB).multiplyScalar(.5);bracket.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  if(index===0){const iris=add(new THREE.TorusGeometry(.17,.025,6,24),glow,group);iris.position.set(0,4.18,0);iris.scale.y=.55;}
  else for(const segment of digits[index]){const [x,y,vertical]=segments[segment];const bar=add(new THREE.BoxGeometry(vertical?.04:.24,vertical?.19:.04,.045),glow,group);bar.position.set(x,4.18+y,0);}
  markers.push({id:point.id,group,glow,floor});
 }
 // Authored chevrons are batched into one instanced inlay draw, flush with the existing ground.
 const arrowShape=new THREE.Shape();arrowShape.moveTo(-.22,-.23);arrowShape.lineTo(0,0);arrowShape.lineTo(.22,-.23);arrowShape.lineTo(.22,-.08);arrowShape.lineTo(0,.16);arrowShape.lineTo(-.22,-.08);arrowShape.closePath();
 const arrowGeometry=new THREE.ShapeGeometry(arrowShape);arrowGeometry.rotateX(-Math.PI/2);const positions=[];
 for(let i=1;i<routePoints.length;i++){const a=routePoints[i-1],b=routePoints[i],length=Math.hypot(b.x-a.x,b.z-a.z);for(let d=2;d<length-1;d+=2.6){const t=d/length;positions.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:Math.atan2(a.x-b.x,a.z-b.z),leg:i-1});}}
 const arrows=new THREE.InstancedMesh(arrowGeometry,new THREE.MeshBasicMaterial({color:0x4fddcf,toneMapped:false}),positions.length),dummy=new THREE.Object3D();
 positions.forEach((p,i)=>{dummy.position.set(p.x,.026,p.z);dummy.rotation.set(0,p.yaw,0);dummy.updateMatrix();arrows.setMatrixAt(i,dummy.matrix);});root.add(arrows);meshCount++;
 const finish=routePoints.at(-1),parcel=new THREE.Group();parcel.position.set(finish.x,3.55,finish.z);root.add(parcel);
 const parcelFrame=add(new THREE.BoxGeometry(.4,.32,.3),dark,parcel);for(const x of [-.13,.13]){const band=add(new THREE.BoxGeometry(.025,.35,.33),gold,parcel);band.position.x=x;}
 const seal=add(new THREE.OctahedronGeometry(.065),new THREE.MeshBasicMaterial({color:0x60f9d5,toneMapped:false}),parcel);seal.position.z=.2;
 return {
  mountPrize(board){if(prize)return;prize=new THREE.Group();prize.name='earned-courier-relay-crest';prize.position.set(0,.195,.46);board.add(prize);const rim=add(new THREE.TorusGeometry(.105,.017,6,28),gold,prize);rim.rotation.x=-Math.PI/2;prizeCore=add(new THREE.OctahedronGeometry(.047),gold.clone(),prize);prizeCore.position.y=.045;},
  update(time){root.visible=trial.enabled;const active=trial.active,passed=trial.next;
   markers.forEach((m,i)=>{const isStart=i===0,live=isStart?(trial.state==='armed'||trial.state==='failed'||trial.state==='finished'||trial.state==='countdown'):(active&&i===passed+1);const done=!isStart&&i<=passed;const color=trial.state==='failed'?0xe96c68:done?0xc98a43:live?(isStart?0xe5a13c:0xc4ff38):0x213b4a;m.glow.color.setHex(color);if(!reducedMotion)m.floor.material.color.copy(m.glow.color);});
   parcel.visible=trial.state==='finished';if(!reducedMotion){parcel.rotation.y=time*.0006;parcel.position.y=3.55+Math.sin(time*.0017)*.08;}
   if(prize){prize.visible=trial.record.completions>0&&trial.record.bestMs!==null;prizeCore.material.color.setHex(trial.medal()==='gold'?0xffc25b:trial.medal()==='silver'?0xc3eff9:0xc78365);}
  },
  snapshot(){return {visible:root.visible,meshCount,markers:markers.map(m=>({id:m.id,x:m.group.position.x,z:m.group.position.z,color:m.glow.color.getHexString(),visible:m.group.visible&&root.visible})),inlaidArrowCount:positions.length,deliveryProjectionVisible:parcel.visible&&root.visible,prizeMounted:Boolean(prize),prizeVisible:Boolean(prize?.visible),prizeColor:prizeCore?.material.color.getHexString()||null};}
 };
}
