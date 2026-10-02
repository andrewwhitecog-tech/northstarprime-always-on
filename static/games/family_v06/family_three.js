/* The same VORATH regalia as the owner skin, expressed in Cubic Cosmos geometry. */
window.VorathFamily3D={decorate(group,scale=1,creature=false){
 const T=THREE,palette=[0x58e6ba,0x42c9f5,0x696aea,0xbe64e4,0xf368ba,0xffb653,0xf5d894];
 const kit=new T.Group();kit.name='VorathFamilyRegalia';kit.userData.family='VORATH';
 const gold=new T.MeshStandardMaterial({color:0xc79643,metalness:.82,roughness:.25});
 function gem(x,y,z,r,hue){const geo=new T.OctahedronGeometry(r),mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:palette[hue%7],emissive:palette[hue%7],emissiveIntensity:.15,metalness:.22,roughness:.14,flatShading:true}));mesh.position.set(x,y,z);mesh.scale.y=1.6;kit.add(mesh);return mesh;}
 const y=creature?.2:1.14;
 for(const side of [-1,1])for(let i=0;i<3;i++){const m=gem(side*(.30+i*.08),y+i*.06,0,.07,i+(side>0?2:0));m.rotation.z=-side*(.2+i*.2);}
 gem(0,creature?0:.92,.21,.11,1);gem(0,creature?.38:1.59,.10,.06,3);
 if(!creature){
  for(const side of [-1,1]){
   const eye=new T.Mesh(new T.SphereGeometry(.035,10,6),new T.MeshStandardMaterial({color:0xf0d094,roughness:.25}));eye.position.set(side*.09,1.45,.17);kit.add(eye);
   const pupil=new T.Mesh(new T.SphereGeometry(.016,8,6),new T.MeshBasicMaterial({color:0x131123}));pupil.position.set(side*.09,1.45,.20);kit.add(pupil);
   const brow=[];for(let i=0;i<=10;i++){const t=i/10;brow.push(new T.Vector3(side*(.04+t*.14),1.5+Math.sin(t*Math.PI)*.035,.19));}
   kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(brow),12,.008,4,false),gold));
   for(let phase=0;phase<2;phase++){const points=[];for(let i=0;i<=28;i++){let t=i/28;points.push(new T.Vector3(side*(.17+.022*Math.sin(t*Math.PI*4+phase*Math.PI)),.65+t*.43,.158));}kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.005,4,false),gold));}
  }
 }
 kit.scale.setScalar(scale);group.add(kit);return kit;
}};
