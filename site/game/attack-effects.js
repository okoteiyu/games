import * as THREE from './vendor/three/three.module.js';

/** Runtime effects are independent of the user's shared attack/recoil motion. */
function softRingTexture(kind='void_wave'){
 const size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size),color=new THREE.Color(),chaosColors=[0x08090e,0x8027ca,0x2459eb,0xf5f5ff].map(c=>new THREE.Color(c));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x-size/2)/(size/2),dy=(y-size/2)/(size/2),r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),i=(y*size+x)*4;
  const wave=Math.exp(-(((r-.60)/.13)**2))+.28*Math.exp(-(((r-.34)/.11)**2));color.set(0x030308);if(kind==='cosmos_wave')color.setHSL((angle/Math.PI/2+1)%1,.9,.68);
  if(kind==='chaos_wave'){const u=((angle/Math.PI/2+1+.12*Math.sin(r*12))%1+1)%1*4,index=Math.floor(u);color.copy(chaosColors[index]).lerp(chaosColors[(index+1)%4],u-index);}
  pixels.data[i]=Math.round(color.r*255);pixels.data[i+1]=Math.round(color.g*255);pixels.data[i+2]=Math.round(color.b*255);pixels.data[i+3]=Math.round(Math.min(1,wave)*255*Math.max(0,Math.min(1,(1-r)*6)));
 }
 ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function softBeamTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
 const rainbow=ctx.createLinearGradient(0,0,0,128);
 for(const [i,color]of ['#ff3869','#ff9c31','#ffe745','#36e98c','#32cfff','#7166ff','#cd50ff'].entries())rainbow.addColorStop(i/6,color);
 ctx.fillStyle=rainbow;ctx.fillRect(0,0,128,128);ctx.globalCompositeOperation='destination-in';
 const edges=ctx.createLinearGradient(0,0,128,0);for(const [at,alpha]of [[0,0],[.1,.16],[.25,.72],[.5,1],[.75,.72],[.9,.16],[1,0]])edges.addColorStop(at,'rgba(255,255,255,'+alpha+')');ctx.fillStyle=edges;ctx.fillRect(0,0,128,128);
 const ends=ctx.createLinearGradient(0,0,0,128);for(const [at,alpha]of [[0,0],[.08,1],[.92,1],[1,0]])ends.addColorStop(at,'rgba(255,255,255,'+alpha+')');ctx.fillStyle=ends;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export class AttackEffects{
 constructor(record){this.record=record;this.effects=new Map();}
 make(kind){
  const group=new THREE.Group();group.name='Battle.AttackEffect.'+kind;group.visible=false;this.record.anchor.add(group);const parts=[];
  if(kind==='okoteiyu_beam'){
   const map=softBeamTexture(),geometry=new THREE.PlaneGeometry(1,1);
   // Crossed, translucent light ribbons stay soft from every viewing angle.
   for(let layer=0;layer<2;layer++)for(let i=0;i<3;i++){
    const part=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));part.rotation.y=i*Math.PI/3;part.userData.beamWidth=layer?.46:.23;part.userData.beamOpacity=layer?.09:.44;group.add(part);parts.push(part);
   }
   const core=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));core.userData.beamCore=true;group.add(core);parts.push(core);
   const haloMap=softRingTexture('cosmos_wave');
   for(let i=0;i<2;i++){const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloMap,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));halo.userData.beamHalo=i?'target':'source';group.add(halo);parts.push(halo);}
  }else if(kind==='shell'){
   const metal=new THREE.MeshStandardMaterial({color:0xb1a37f,metalness:.92,roughness:.24}),round=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.16,4,12),metal);round.rotation.x=Math.PI/2;group.add(round);parts.push(round);
   const tip=new THREE.Mesh(new THREE.ConeGeometry(.055,.12,16),metal);tip.rotation.x=Math.PI/2;tip.position.z=.18;group.add(tip);
   const trail=new THREE.Mesh(new THREE.ConeGeometry(.06,.48,16,1,true),new THREE.MeshBasicMaterial({color:0xffdf95,transparent:true,opacity:.27,depthWrite:false,blending:THREE.AdditiveBlending}));trail.rotation.x=-Math.PI/2;trail.position.z=-.27;group.add(trail);
  }else{
   const map=softRingTexture(kind);
   for(let i=0;i<3;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));group.add(sprite);parts.push(sprite);}
  }
  const effect={group,parts,kind};this.effects.set(kind,effect);return effect;
 }
 sample(kind,current,origin,target){
  for(const effect of this.effects.values())effect.group.visible=false;
  if(!kind||!current||!target)return;
  const elapsed=Number(current.elapsed)||0,duration=current.duration||2,t=Math.max(0,Math.min(1,(elapsed-.12)/Math.max(.1,duration-.25)));
  if(elapsed<.12||elapsed>=duration)return;
  const effect=this.effects.get(kind)||this.make(kind),distance=origin.distanceTo(target),direction=target.clone().sub(origin).normalize(),height=this.record.height;
  effect.group.visible=true;
  if(kind==='okoteiyu_beam'){
   const from=this.record.anchor.worldToLocal(origin.clone()),to=this.record.anchor.worldToLocal(target.clone()),delta=to.clone().sub(from),fullLength=delta.length();
   effect.group.position.copy(from);effect.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),fullLength>1e-6?delta.normalize():new THREE.Vector3(0,1,0));
   const launch=Math.max(0,Math.min(1,(elapsed-.16)/.22)),length=Math.max(.001,fullLength*launch),fadeIn=Math.max(0,Math.min(1,(elapsed-.12)/.18)),fadeOut=Math.max(0,Math.min(1,(duration-elapsed)/.18)),envelope=fadeIn*fadeOut;
   for(const part of effect.parts){
    if(part.userData.beamHalo){const impact=part.userData.beamHalo==='target';part.position.set(0,impact?length:0,0);part.scale.setScalar(height*(impact?.40:.34)*(1+.04*Math.sin(elapsed*12)));part.material.opacity=envelope*(impact?launch*.40:.72);}
    else if(part.userData.beamCore){part.position.set(0,length/2,0);part.scale.set(height*.008,length,height*.008);part.material.opacity=envelope*.46;}
    else{part.position.set(0,length/2,0);part.scale.set(height*part.userData.beamWidth,length,1);part.material.opacity=part.userData.beamOpacity*envelope;}
   }
  }else if(kind==='shell'){
   const p=origin.clone().lerp(target,t);this.record.anchor.worldToLocal(p);effect.group.position.copy(p);const to=this.record.anchor.worldToLocal(origin.clone().add(direction)),from=this.record.anchor.worldToLocal(origin.clone());effect.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),to.sub(from).normalize());
   effect.group.scale.setScalar(Math.max(.45,Math.min(2.5,height*.65)));
  }else{
   effect.group.position.set(0,0,0);effect.group.quaternion.identity();
   for(let i=0;i<effect.parts.length;i++){
    const local=Math.max(0,Math.min(1,t-i*.075)),part=effect.parts[i],p=origin.clone().addScaledVector(direction,distance*local);this.record.anchor.worldToLocal(p);part.position.copy(p);
    const size=Math.max(.24,height*.6)*(1+local*1.55);part.scale.set(size,size*.84,1);part.material.opacity=(i? .42:.86)*Math.min(1,t*8)*Math.min(1,(1-t)*8);
   }
  }
 }
}
