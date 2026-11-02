import * as THREE from './vendor/three/three.module.js';

/** Small story-only sets. They do not change the explorable building layout. */
export const STORY_ROOM_ASSETS=Object.freeze({
 house:{url:'house3d/house.glb',metadata:'house3d/metadata.json'},
 'computer-room':{url:'analysis-room/room.glb',metadata:'analysis-room/metadata.json'},
 lounge:{url:'guest-lounge/room.glb',metadata:'guest-lounge/metadata.json'},
 'player-room':{url:'player-room/room.glb',metadata:'player-room/metadata.json'},
 'training-hall':{url:'battle3d/training_day.glb'}
});

export function storyCanvasTexture(draw,size=512){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function surfaceTexture(kind){
 const texture=storyCanvasTexture((ctx,s)=>{
  ctx.fillStyle=kind==='wood'?'#bca281':kind==='asphalt'?'#96958f':'#d9d8cd';ctx.fillRect(0,0,s,s);
  let seed=29;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<10000;i++){const x=random()*s,y=random()*s;ctx.fillStyle=i%2?'#ffffff0c':'#39352a09';ctx.fillRect(x,y,kind==='wood'?1:random()*2+1,kind==='wood'?random()*40+5:random()*2+1);}
  if(kind==='tile'){ctx.strokeStyle='#aba99933';ctx.lineWidth=2;for(let i=0;i<s;i+=128){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke();}}
 });texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='wood'?2:5,kind==='wood'?2:5);return texture;
}
const mat=(color,roughness=.7,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness:0,...extra});
function box(root,w,h,d,x,y,z,material,name=''){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.name=name;root.add(mesh);return mesh;
}
function sign(root,text,width,height,x,y,z,{color='#68513c',background='#f7f4e8',font=34}={}){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*height/width);const ctx=canvas.getContext('2d'),size=font*2;
 ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#bba57b';ctx.lineWidth=3;ctx.strokeRect(12,12,canvas.width-24,canvas.height-24);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 '+size+'px sans-serif';text.split('\n').forEach((line,i,all)=>ctx.fillText(line,canvas.width/2,canvas.height/2+(i-(all.length-1)/2)*(size+24),canvas.width-48));
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));mesh.position.set(x,y,z);root.add(mesh);return mesh;
}
function pot(root,x,z){
 const ceramic=mat('#c3c8b0'),soil=mat('#6e6650'),leaves=mat('#8b9c81');
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.18,.13,.30,20),ceramic);base.position.set(x,.15,z);root.add(base);
 const top=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.012,20),soil);top.position.set(x,.305,z);root.add(top);
 for(let i=0;i<7;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),leaves);leaf.scale.set(.065,.28,.035);leaf.position.set(x+Math.cos(i*2.4)*.09,.50+Math.sin(i)*.045,z+Math.sin(i*2.4)*.09);leaf.rotation.z=Math.sin(i*2.4)*.44;root.add(leaf);}
}
export function createHeadquartersSet(){
 const root=new THREE.Group();root.name='Story.Headquarters';
 const floor=mat('#e4e1d6',.92,{map:surfaceTexture('tile')}),ivory=mat('#e9e5d9'),bronze=mat('#8d795b',.36,{metalness:.48}),wood=mat('#c2ab87',.68,{map:surfaceTexture('wood')}),sage=mat('#98a38b');
 box(root,8,.10,8,0,-.05,-1.4,floor);
 box(root,8,3.2,.15,0,1.6,-5.3,ivory);box(root,.15,3.2,8,-4,1.6,-1.4,ivory);box(root,.15,3.2,8,4,1.6,-1.4,ivory);
 box(root,7.8,.50,.07,0,.3,-5.19,wood);box(root,7.7,.035,.04,0,.59,-5.135,bronze);
 // A low support counter and a taller human counter share the same curved motif.
 const counter=box(root,2.7,.72,.72,-.75,.36,-2.35,wood);counter.name='Story.SupportCounter';
 box(root,2.9,.07,.86,-.75,.755,-2.35,ivory);box(root,2.65,.035,.035,-.75,.31,-1.972,bronze);
 box(root,.82,.37,.67,.92,.185,-2.2,sage);box(root,.92,.035,.74,.92,.39,-2.2,ivory);
 for(let i=0;i<3;i++)box(root,.28,.015,.22,-1.55+i*.42,.803,-2.25,mat(i===1?'#e3d2ac':'#dce0ce'));
 sign(root,'ヒーロー会\n出発・支援窓口',2.8,1.08,-.8,1.95,-5.205,{font:36});
 // Information lights, a quiet place to wait, and a real sliding exit.
 const light=mat('#dce7da',.3,{emissive:'#afc0a9',emissiveIntensity:.3});
 box(root,1.1,1.35,.08,-3.05,1.5,-5.16,light);
 for(let i=0;i<4;i++)box(root,.9,.024,.024,-3.05,1.02+i*.28,-5.103,bronze);
 for(let i=0;i<2;i++){box(root,1.3,.14,.52,-2.75,.43,-.9-i*.85,sage);box(root,1.3,.46,.10,-2.75,.70,-1.12-i*.85,sage);for(const x of[-3.28,-2.22])box(root,.06,.34,.33,x,.19,-.9-i*.85,bronze);}
 const frame=mat('#bdc3be',.44,{metalness:.55}),glass=mat('#b8d6d8',.27,{metalness:.15});
 box(root,1.45,2.5,.18,2.35,1.25,-5.11,frame);
 const door=new THREE.Group();door.position.set(2.35,0,-4.98);root.add(door);
 box(door,1.30,2.36,.06,0,1.21,0,glass);box(door,.05,1.5,.04,.46,1.2,.05,bronze);
 sign(root,'出発口',.72,.22,2.35,2.78,-5.08,{font:78});
 for(let i=0;i<3;i++)box(root,.035,1.8,.04,3.88,1.75,-3.6+i*1.4,bronze);
 box(root,.035,1.9,4.3,3.89,1.75,-2.3,mat('#d8e6e4',.26,{emissive:'#d5e3db',emissiveIntensity:.30}));
 pot(root,1.45,-4.6);pot(root,-3.3,1.2);
 return {root,door,doorClosed:door.position.x,doorTravel:1.2,actorPosition:[-.28,0,.25],cameraWide:{position:[.42,.70,2.35],target:[-.18,.13,.05],fov:48}};
}
function smallHouse(root,x,z,index){
 const palette=['#e1ddcf','#ddd5c8','#d5d8d2','#e7e1d5'],wall=mat(palette[index%palette.length]),roof=mat(index%2?'#8f8d83':'#6f7879',.8),trim=mat('#eae9df'),window=mat('#899fa1',.23,{metalness:.22});
 const width=1.9+(index%3)*.16,height=1.8+(index%2)*.7;
 box(root,width,height,2.4,x,height/2,z,wall);box(root,width+.14,.16,2.55,x,height+.06,z,roof);
 box(root,.52,1.18,.08,x+.38,.59,z+1.24,mat('#a99781'));
 for(const a of[-.56,.32])for(const y of[1.12,height-.45]){box(root,.54,.56,.07,x+a,y,z+1.24,trim);box(root,.46,.47,.08,x+a,y,z+1.285,window);}
 for(let i=0;i<3;i++)box(root,.032,.46,.025,x-.76+i*.64,height-.45,z+1.34,trim);
}
export function createRoadSet(){
 const root=new THREE.Group();root.name='Story.ResidentialRoad';
 const asphalt=mat('#a3a19b',.98,{map:surfaceTexture('asphalt')}),paving=mat('#dfddd3',.94,{map:surfaceTexture('tile')}),edge=mat('#bbbcb5'),line=mat('#e9e7dc');
 box(root,5.5,.08,36,0,-.055,-9,asphalt);
 for(const side of[-1,1]){
  box(root,1.65,.11,36,side*3.5,.015,-9,paving);box(root,.14,.14,36,side*2.76,.026,-9,edge);
  box(root,.045,.012,34,side*2.25,.002,-9,line);
  for(let i=0;i<8;i++)smallHouse(root,side*(5.12+(i%2)*.28),1.5-i*4.0,i+(side===1?1:0));
  for(let i=0;i<4;i++){const post=mat('#a1a69e',.48,{metalness:.4});box(root,.09,3.0,.09,side*3.2,1.5,-2-i*9,post);box(root,.6,.07,.15,side*3.01,3,-2-i*9,post);}
 }
 // A small turn in the distant streets prevents a flat visible end to the set.
 for(let i=0;i<5;i++)box(root,2.8,4+i*.4,2.4,-5.6+i*2.8,2+i*.2,-30,mat(['#c9cec9','#dad6c9','#c8cecc'][i%3]));
 return {root,actorPosition:[-.30,0,.0],cameraWide:{position:[.75,.90,2.7],target:[-.20,.14,-.20],fov:40}};
}
export function createStoryBook(){
 // Local +Y is the printed side, +Z the top of the pages, and Z the spine.
 // The holder supplies the reading tilt; keeping this frame unrotated avoids
 // reversing the book when a different character or camera uses the prop.
 const root=new THREE.Group(),cover=mat('#b59a6e'),pages=mat('#f5efdc'),ink=mat('#c0b69d');root.name='Story.RecordBook';
 root.userData.readingFrame={pageNormal:[0,1,0],spineAxis:[0,0,1],pageTop:[0,0,1]};
 for(const side of[-1,1]){
  const half=new THREE.Group();half.name=side<0?'Story.Book.Left':'Story.Book.Right';half.rotation.z=side*.10;root.add(half);
  box(half,.103,.009,.14,side*.052,0,0,cover,'Story.Book.Cover.'+(side<0?'L':'R'));
  box(half,.095,.010,.132,side*.052,.010,0,pages,'Story.Book.Pages.'+(side<0?'L':'R'));
  // An asymmetric heading and descending rules make the reading direction
  // visible without putting new story text on the pages.
  box(half,.057,.001,.003,side*.052,.016,.044,ink);
  for(let i=0;i<4;i++)box(half,i===3?.047:.068,.001,.0018,side*.052,.016,.024-i*.019,ink);
 }
 box(root,.006,.011,.142,0,-.002,0,cover,'Story.Book.Spine');
 return root;
}
export function createStoryShadow(radius=.22){
 const texture=storyCanvasTexture((ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.47);g.addColorStop(0,'#403d3166');g.addColorStop(.55,'#403d3122');g.addColorStop(1,'#403d3100');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);},128);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(radius*2.6,radius*2.1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.rotation.x=-Math.PI/2;mesh.position.y=.007;return mesh;
}
