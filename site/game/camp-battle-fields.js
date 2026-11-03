import * as THREE from './vendor/three/three.module.js';
import {getCampRegion} from './camp-regions.js';

const TERRAIN_IDS=['normal','rough','cliff','gas','cave','poor_visibility'];
const THEMES=Object.freeze({
 wilds:{ground:'#365b3b',stone:'#51604a',bark:'#544537',leaf:'#233c2b',leafLight:'#507151',sky:'#233c2b',sun:'#e9ecd5',ambient:1.8,sunIntensity:2,fog:1.6},
 volcano:{ground:'#6b332d',stone:'#75483e',bark:'#382f2c',leaf:'#543b34',leafLight:'#825246',sky:'#8a322b',sun:'#ffd1a1',ambient:1.45,sunIntensity:2.1,fog:1.8},
 sacred_forest:{ground:'#74a770',stone:'#90977a',bark:'#6c6350',leaf:'#5e8156',leafLight:'#b8c987',sky:'#dce9bb',sun:'#fff4c2',ambient:2.25,sunIntensity:2.5,fog:2},
 meteor_crater:{ground:'#796883',stone:'#4c3c59',bark:'#46404b',leaf:'#565267',leafLight:'#82758d',sky:'#30283f',sun:'#ddd2ef',ambient:1.65,sunIntensity:1.7,fog:1.8},
 dark_domain:{ground:'#34363b',stone:'#686b70',bark:'#49494b',leaf:'#515257',leafLight:'#777980',sky:'#44464c',sun:'#d2dce3',ambient:1.45,sunIntensity:1.3,fog:1.4}
});
const color=value=>new THREE.Color(value);
const seedOf=text=>{let value=2166136261;for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;};
function seeded(seed){let value=seed>>>0;return()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return(value>>>0)/4294967296;};}
function noise(x,y,seed){let v=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^seed;v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967295;}
function smoothNoise(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy,u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty),a=noise(ix,iy,seed)*(1-u)+noise(ix+1,iy,seed)*u,b=noise(ix,iy+1,seed)*(1-u)+noise(ix+1,iy+1,seed)*u;return a*(1-v)+b*v;}
function surfaceTexture(theme,seed,kind){
 const size=128,data=new Uint8Array(size*size*4),base=color(kind==='bark'?theme.bark:kind==='stone'?theme.stone:kind==='neutral'?'#ededed':theme.ground),light=base.clone().multiplyScalar(1.45),dark=base.clone().multiplyScalar(.55),pixel=new THREE.Color();
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const grain=noise(x,y,seed),wide=smoothNoise(x/24,y/24,seed+13),fine=smoothNoise(x/6,y/6,seed+23),ridge=kind==='bark'?Math.sin(x*.7+Math.sin(y*.045)*1.7):Math.sin(x*.12+Math.sin(y*.09)*1.7);
  pixel.copy(dark).lerp(light,.36+grain*.09+wide*.24+fine*.10+(ridge+1)*.025);
  if(kind==='stone'&&Math.abs(Math.sin(x*.095+wide*4)+Math.cos(y*.08+fine*2))<.045)pixel.multiplyScalar(.8);
  const index=(y*size+x)*4,shade=pixel.getHex();data[index]=(shade>>>16)&255;data[index+1]=(shade>>>8)&255;data[index+2]=shade&255;data[index+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size);texture.name='Camp.Material.'+kind;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='ground'?15:kind==='bark'?2:3,kind==='ground'?15:kind==='bark'?4:3);texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
function glowTexture(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const d=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),a=Math.max(0,1-d);const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*a*255);}
 const texture=new THREE.DataTexture(data,size,size);texture.name='Camp.Material.SoftLight';texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
function instances(parent,name,geometry,material,records){
 const mesh=new THREE.InstancedMesh(geometry,material,records.length),dummy=new THREE.Object3D();mesh.name=name;mesh.userData.campInstanced=true;
 for(let i=0;i<records.length;i++){const r=records[i];dummy.position.fromArray(r.position);dummy.rotation.set(...(r.rotation||[0,0,0]));dummy.scale.fromArray(r.scale||[1,1,1]);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(r.color)mesh.setColorAt(i,color(r.color));}
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);return mesh;
}
function rockyRing(parent,name,material,{inner=4.2,outer=28,height=1,crater=false,seed=1,lift=.012}={}){
 const geometry=new THREE.RingGeometry(inner,outer,64,6),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=-positions.getY(i),r=Math.hypot(x,z),t=(r-inner)/(outer-inner),angle=Math.atan2(z,x),rim=crater?Math.exp(-Math.pow((r-8.7)/2.7,2))*height:height*t;
  const uneven=(.18+noise(Math.round(x*7),Math.round(z*7),seed)*.42)*(Math.sin(angle*7)+Math.cos(angle*11)*.45);
  positions.setXYZ(i,x,lift+Math.max(0,rim+uneven*Math.min(1,t*5)),z);
 }
 geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;parent.add(mesh);return mesh;
}
function ringRecords(rng,count,{radius=7,spread=13,minHeight=.35,height=1.8,width=.65}={}){
 return Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2+(rng()-.5)*.3,r=radius+rng()*spread,h=minHeight+rng()*height;return{position:[Math.cos(a)*r,h*.36,Math.sin(a)*r],rotation:[rng()*.25,rng()*Math.PI,rng()*.18],scale:[width+rng()*.8,h,width+rng()*.8]};});
}
function craterBowl(parent,map){
 const geometry=new THREE.RingGeometry(4.2,28,80,30),positions=geometry.attributes.position,colors=[],profile=[[4.2,0],[5.2,.1],[5.6,.1],[6.5,.32],[6.9,.32],[7.8,.65],[8.2,.65],[9.2,1.05],[10,1.05],[11.2,.7],[12.5,.55],[14,.35],[28,.2]],shades=['#756582','#a38cae','#665770','#b09cbc','#5a496b','#91809e'];
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=-positions.getY(i),r=Math.hypot(x,z),a=Math.atan2(z,x);let j=1;while(j<profile.length-1&&profile[j][0]<r)j++;const p=profile[j-1],q=profile[j],t=Math.max(0,Math.min(1,(r-p[0])/(q[0]-p[0]))),h=p[1]+(q[1]-p[1])*t,undulation=(Math.sin(a*9)*.035+Math.cos(a*13)*.025)*Math.min(1,(r-4.2)/2);positions.setXYZ(i,x,.016+Math.max(0,h+undulation),z);const band=r<5.6?0:r<6.9?1:r<8.2?2:r<10?3:r<12.5?4:5,c=color(shades[band]);colors.push(c.r,c.g,c.b);}
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,map,bumpMap:map,bumpScale:.035,roughness:1}));mesh.name='Camp.Region.Relief';mesh.userData.landmark='concentric-crater-rim';parent.add(mesh);return mesh;
}
/** Lightweight, original 3D scenery. It has no game state or gameplay RNG. */
export function createCampBattleField({regionId='wilds',terrainId='normal',timeOfDay='day'}={}){
 const region=getCampRegion(regionId),authoredTheme=THEMES[regionId];
 if(!region||!authoredTheme)throw new RangeError('キャンプの区域が見つかりません。');
 const theme={...authoredTheme,ground:region.palette?.land||authoredTheme.ground,sky:region.palette?.background||authoredTheme.sky};
 if(!TERRAIN_IDS.includes(terrainId))throw new RangeError('キャンプの地形が見つかりません。');
 if(!['day','night'].includes(timeOfDay))throw new RangeError('キャンプの時間帯が正しくありません。');
 const seed=seedOf(regionId+':'+terrainId),rng=seeded(seed),root=new THREE.Group(),regionLayer=new THREE.Group(),terrainLayer=new THREE.Group();
 root.name='Camp.Field.'+regionId+'.'+terrainId;regionLayer.name='Camp.Region.'+regionId;terrainLayer.name='Camp.Terrain.'+terrainId;root.add(regionLayer,terrainLayer);
 const textures={},materials={};let spriteGeometry=null;
 const texture=kind=>textures[kind]??=(kind==='glow'?glowTexture():surfaceTexture(theme,seedOf(regionId+kind),kind));
 const material=kind=>materials[kind]??=new THREE.MeshStandardMaterial({color:0xffffff,map:texture(kind),bumpMap:texture(kind),bumpScale:kind==='bark'?.055:.07,roughness:kind==='ground'?.98:.9});
 const glowMaterial=(tint,opacity=.35)=>new THREE.SpriteMaterial({map:texture('glow'),color:tint,transparent:true,opacity,depthWrite:false,toneMapped:false});
 const softSprite=material=>{const sprite=new THREE.Sprite(material);sprite.geometry=spriteGeometry??=sprite.geometry.clone();return sprite;};
 const floor=new THREE.Mesh(new THREE.CircleGeometry(30,80),material('ground'));floor.rotation.x=-Math.PI/2;floor.name='Camp.Arena.Ground';root.add(floor);
 const stones=material('stone');
 if(regionId==='meteor_crater'&&terrainId!=='cave')craterBowl(regionLayer,texture('neutral'));
 else rockyRing(regionLayer,'Camp.Region.Relief',stones,{inner:4.2,outer:30,height:terrainId==='cave'?.22:regionId==='volcano'?1.0:regionId==='dark_domain'?.7:1.1,seed});
 const scatter=ringRecords(rng,32,{radius:6.8,spread:17,height:1.3,width:.35}).filter(r=>terrainId!=='cave'||Math.hypot(r.position[0]-3,r.position[2]+8)>3.5);
 instances(regionLayer,'Camp.Region.ScatteredStone',new THREE.DodecahedronGeometry(1,0),stones,scatter);
 const trees=(sacred=false,dead=false)=>{
  const trunks=[],leaves=[];for(let i=0;i<(dead?18:24);i++){const a=i/(dead?18:24)*Math.PI*2,r=7.2+rng()*14,h=3.1+rng()*3.5,x=Math.cos(a)*r,z=Math.sin(a)*r;trunks.push({position:[x,h/2,z],scale:[.7+rng()*.7,h/4,.7+rng()*.7],rotation:[0,rng()*6.28,0]});if(!dead){leaves.push({position:[x,h+.35,z],scale:[1.8+rng()*1.7,1.1+rng(),1.6+rng()*1.4],color:i%3===0?theme.leafLight:theme.leaf});leaves.push({position:[x+.6,h+1.2,z-.4],scale:[1.7+rng(),1+rng()*.5,1.5+rng()],color:sacred&&i%4===0?'#d4d7a0':theme.leaf});}}
  instances(regionLayer,'Camp.Region.Trunks',new THREE.CylinderGeometry(.16,.24,4,7),material('bark'),trunks);
  if(leaves.length)instances(regionLayer,'Camp.Region.Canopy',new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),leaves);
  if(dead){const branches=trunks.flatMap((t,i)=>[-1,1].map(side=>({position:[t.position[0]+side*.45,t.position[1]*1.65,t.position[2]],scale:[.45,.55,.45],rotation:[0,i,side*.75]})));instances(regionLayer,'Camp.Region.DryBranches',new THREE.CylinderGeometry(.055,.13,2,5),material('bark'),branches);}
 };
 if(terrainId!=='cave'){
  if(regionId==='wilds')trees();
  if(regionId==='sacred_forest')trees(true);
  if(regionId==='dark_domain')trees(false,true);
 }
 if(regionId==='volcano'){
  const basalt=stones.clone();basalt.color.set('#51433f');const mountain=new THREE.Mesh(new THREE.CylinderGeometry(1.2,5,3.6,20,3,true),basalt);mountain.name='Camp.Volcano.Peak';mountain.position.set(4.8,1.75,-16);mountain.rotation.y=.23;regionLayer.add(mountain);
  const lava=new THREE.MeshStandardMaterial({color:'#ff6938',emissive:'#ef390d',emissiveIntensity:1.6,roughness:.55,fog:false});
  const crater=new THREE.Mesh(new THREE.TorusGeometry(1.12,.15,7,36),lava);crater.name='Camp.Volcano.GlowingCrater';crater.rotation.x=Math.PI/2;crater.position.set(4.8,3.57,-16);regionLayer.add(crater);
  const mouth=new THREE.Mesh(new THREE.CircleGeometry(1.04,32),new THREE.MeshBasicMaterial({color:'#ffb55e',toneMapped:false}));mouth.rotation.x=-Math.PI/2;mouth.position.set(4.8,3.53,-16);mouth.name='Camp.Volcano.LavaMouth';regionLayer.add(mouth);
  for(let i=0;i<3;i++){const a=Math.PI*.25+i*.8,points=[new THREE.Vector3(4.8+Math.cos(a)*1.2,3.57,-16+Math.sin(a)*1.2),new THREE.Vector3(4.8+Math.cos(a+.08)*3,1.7,-16+Math.sin(a+.08)*3),new THREE.Vector3(4.8+Math.cos(a)*5,.04,-16+Math.sin(a)*5)];const stream=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),14,.10,6,false),lava);stream.name='Camp.Volcano.SlopeLava';regionLayer.add(stream);}
  const arc=[new THREE.Vector3(-7,.045,-6),new THREE.Vector3(-2,.04,-4.6),new THREE.Vector3(3,.045,-4.5),new THREE.Vector3(8,.06,-6.5)],curve=new THREE.CatmullRomCurve3(arc);
  for(const [radius,tint,opacity]of[[.23,'#ff5e31',.3],[.12,'#ffb44f',1],[.045,'#ffe0a0',1]]){const river=new THREE.Mesh(new THREE.TubeGeometry(curve,32,radius,6,false),new THREE.MeshBasicMaterial({color:tint,transparent:opacity<1,opacity,depthWrite:opacity===1,toneMapped:false,blending:opacity<1?THREE.AdditiveBlending:THREE.NormalBlending}));river.name='Camp.Volcano.ForegroundLava';regionLayer.add(river);}
 }
 if(regionId==='meteor_crater'){
  const shards=ringRecords(rng,14,{radius:8.4,spread:5,height:1.8,width:.2}).filter(r=>terrainId!=='cave'||Math.hypot(r.position[0]-3,r.position[2]+8)>3.5);instances(regionLayer,'Camp.Meteor.GlassFragments',new THREE.OctahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#71637e',metalness:.38,roughness:.32}),shards);
 }
 if(regionId==='sacred_forest'&&terrainId!=='cave'){
  const rayMaterial=new THREE.MeshBasicMaterial({color:'#fff2bf',transparent:true,opacity:.085,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  for(let i=0;i<6;i++){const ray=new THREE.Mesh(new THREE.CylinderGeometry(.12,1.15,10,8,1,true),rayMaterial);ray.name='Camp.Sacred.SunRay';const a=i/6*Math.PI*2;ray.position.set(Math.cos(a)*7,5.7,Math.sin(a)*7);ray.rotation.z=.21;regionLayer.add(ray);}
  const positions=[];for(let i=0;i<50;i++){const a=rng()*Math.PI*2,r=4.6+rng()*9;positions.push(Math.cos(a)*r,.5+rng()*6,Math.sin(a)*r);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const motes=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#fff7cc',map:texture('glow'),transparent:true,opacity:.65,size:.11,depthWrite:false,toneMapped:false}));motes.name='Camp.Sacred.LightMotes';regionLayer.add(motes);
 }
 if(terrainId==='normal'){
  const geometry=new THREE.CircleGeometry(3.5,48),uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.5+(uv.getX(i)-.5)*3.5/30,.5+(uv.getY(i)-.5)*3.5/30);
  const clearing=new THREE.Mesh(geometry,material('ground'));clearing.name='Camp.Normal.Clearing';clearing.rotation.x=-Math.PI/2;clearing.position.y=.002;terrainLayer.add(clearing);
 }
 if(terrainId==='rough'){
  const mud=new THREE.MeshStandardMaterial({color:regionId==='volcano'?'#5c3530':regionId==='meteor_crater'?'#4d415b':'#586049',roughness:1});
  for(const x of[-.65,.65]){const rut=new THREE.Mesh(new THREE.PlaneGeometry(.32,7),mud);rut.name='Camp.Rough.WornTrail';rut.rotation.x=-Math.PI/2;rut.position.set(x,.003,0);terrainLayer.add(rut);}
  instances(terrainLayer,'Camp.Rough.BrokenGround',new THREE.DodecahedronGeometry(1,0),stones,ringRecords(rng,20,{radius:4.8,spread:3,height:.5,width:.25}));
 }
 if(terrainId==='cliff'){
  for(let i=0;i<3;i++){
   const profile=[[3.8,0],[3.9,.22],[3.45,.4],[3.5,.65],[2.95,.82],[3.0,1.04],[2.4,1.3],[2.45,1.58],[0,1.64]].map(([r,y])=>new THREE.Vector2(r,y)),geometry=new THREE.LatheGeometry(profile,24),ledge=new THREE.Mesh(geometry,stones);ledge.name='Camp.Cliff.Terrace';ledge.position.set(...[[3.5,-.025,-10.5],[-8,-.025,-6.5],[10,-.025,-12]][i]);ledge.scale.set(1.3,1+i*.22,.9);ledge.rotation.y=.18*i;terrainLayer.add(ledge);
  }
  instances(terrainLayer,'Camp.Cliff.VerticalRock',new THREE.DodecahedronGeometry(1,0),stones,ringRecords(rng,12,{radius:7.6,spread:8,minHeight:.6,height:1.3,width:.65}));
 }
 if(terrainId==='gas'||terrainId==='poor_visibility'){
  const gas=terrainId==='gas',mistMaterial=glowMaterial(gas?'#bb8dca':regionId==='dark_domain'?'#808b91':'#b2c6a9',gas?.46:.38);
  for(let i=0;i<18;i++){const mist=softSprite(mistMaterial);mist.name=gas?'Camp.Gas.MysteriousMist':'Camp.PoorVisibility.Haze';const a=i/18*Math.PI*2,r=4.8+rng()*11;mist.position.set(Math.cos(a)*r,.4+rng()*1.9,Math.sin(a)*r);mist.scale.set(5+rng()*4,1.8+rng()*2.7,1);terrainLayer.add(mist);}
  if(gas){const wisps=glowMaterial('#d9b3e8',.7);wisps.fog=false;for(const [x,z]of[[-4,-5.5],[-1,-4.8],[2,-4.7],[5,-5.5],[8,-7]]){const wisp=softSprite(wisps);wisp.name='Camp.Gas.LowWisp';wisp.position.set(x,.75+rng()*.25,z);wisp.scale.set(5.5,1.15,1);terrainLayer.add(wisp);}}
  if(!gas&&regionId!=='dark_domain')instances(terrainLayer,'Camp.PoorVisibility.DenseGrowth',new THREE.SphereGeometry(1,7,5),new THREE.MeshStandardMaterial({color:theme.leaf,roughness:1}),ringRecords(rng,24,{radius:5.8,spread:8,height:1.7,width:.7}));
 }
 if(terrainId==='cave'){
  const caveStone=new THREE.MeshStandardMaterial({color:theme.stone,map:texture('stone'),bumpMap:texture('stone'),bumpScale:.18,roughness:1,side:THREE.DoubleSide});
  const walls=ringRecords(rng,30,{radius:8.5,spread:1.4,minHeight:2.1,height:1.6,width:1.6}).filter(r=>Math.hypot(r.position[0]-3,r.position[2]+8)>3.5),wall=instances(terrainLayer,'Camp.Cave.SurroundingStone',new THREE.DodecahedronGeometry(1,0),caveStone,walls);wall.userData.peripheral=true;
  const outer=new THREE.Shape();outer.moveTo(-2,0);outer.lineTo(2,0);outer.lineTo(2,.65);outer.absarc(0,.65,2,0,Math.PI,false);outer.closePath();
  const hole=new THREE.Path();hole.moveTo(-1.45,.025);hole.lineTo(1.45,.025);hole.lineTo(1.45,.65);hole.absarc(0,.65,1.45,0,Math.PI,false);hole.closePath();outer.holes.push(hole);
  const arch=new THREE.Mesh(new THREE.ExtrudeGeometry(outer,{depth:.65,steps:1,curveSegments:20,bevelEnabled:true,bevelSize:.1,bevelThickness:.1,bevelSegments:2}),caveStone);arch.name='Camp.Cave.EntranceArch';arch.position.set(3,.03,-8);terrainLayer.add(arch);
  const opening=new THREE.Mesh(new THREE.PlaneGeometry(2.85,2.05),new THREE.MeshBasicMaterial({color:regionId==='volcano'?'#32181b':'#0b141c',side:THREE.DoubleSide}));opening.name='Camp.Cave.DarkOpening';opening.position.set(3,1.04,-8.15);terrainLayer.add(opening);
  const ceiling=new THREE.Mesh(new THREE.SphereGeometry(11,20,9,0,Math.PI*2,0,Math.PI/2),caveStone);ceiling.name='Camp.Cave.Ceiling';ceiling.position.y=2;ceiling.scale.y=.73;terrainLayer.add(ceiling);
  const glow=glowMaterial(regionId==='volcano'?'#ff9b65':regionId==='sacred_forest'?'#d8efb3':'#a6ccdf',.75);for(const x of[1.2,4.8]){const light=softSprite(glow);light.name='Camp.Cave.ReflectedLight';light.position.set(x,1.05,-7.25);light.scale.set(1.25,2.3,1);terrainLayer.add(light);}
 }
 const night=timeOfDay==='night',cave=terrainId==='cave',sky=color(cave?'#252d32':theme.sky);if(night)sky.multiplyScalar(.48);
 const fogDepthFactor=theme.fog*(terrainId==='poor_visibility'?.57:terrainId==='gas'?.72:cave?.86:1);
 const field={id:'camp_'+regionId+'_'+terrainId+'_'+timeOfDay,region:'camp',campRegionId:regionId,campRegionName:region.name,campTerrainId:terrainId,timeOfDay,sky:'#'+sky.getHexString(),ambient:theme.ambient*(night?.65:cave?.78:1),sunIntensity:theme.sunIntensity*(night?.4:cave?.5:1),sunColor:night?'#c1d3e6':theme.sun,fogDepthFactor,clearRadius:3.5,procedural:true,modelRevision:'R225'};
 root.userData={campRegionId:regionId,campTerrainId:terrainId,clearRadius:field.clearRadius,revision:'R225',seed,procedural:true};
 return {scene:root,field};
}

export const CAMP_BATTLE_REGION_IDS=Object.freeze(Object.keys(THEMES));
export const CAMP_BATTLE_TERRAIN_IDS=Object.freeze([...TERRAIN_IDS]);
