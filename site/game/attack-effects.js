import * as THREE from './vendor/three/three.module.js';

/** Runtime effects are independent of the user's shared attack/recoil motion. */
function softRingTexture(rainbow=false){
 const size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size),color=new THREE.Color();
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x-size/2)/(size/2),dy=(y-size/2)/(size/2),r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),i=(y*size+x)*4;
  const wave=Math.exp(-(((r-.60)/.13)**2))+.28*Math.exp(-(((r-.34)/.11)**2));color.set(rainbow?0xffffff:0x030308);if(rainbow)color.setHSL((angle/Math.PI/2+1)%1,.9,.68);
  pixels.data[i]=Math.round(color.r*255);pixels.data[i+1]=Math.round(color.g*255);pixels.data[i+2]=Math.round(color.b*255);pixels.data[i+3]=Math.round(Math.min(1,wave)*255*Math.max(0,Math.min(1,(1-r)*6)));
 }
 ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export class AttackEffects{
 constructor(record){this.record=record;this.effects=new Map();}
 make(kind){
  const group=new THREE.Group();group.name='Battle.AttackEffect.'+kind;group.visible=false;this.record.anchor.add(group);const parts=[];
  if(kind==='shell'){
   const metal=new THREE.MeshStandardMaterial({color:0xb1a37f,metalness:.92,roughness:.24}),round=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.16,4,12),metal);round.rotation.x=Math.PI/2;group.add(round);parts.push(round);
   const tip=new THREE.Mesh(new THREE.ConeGeometry(.055,.12,16),metal);tip.rotation.x=Math.PI/2;tip.position.z=.18;group.add(tip);
   const trail=new THREE.Mesh(new THREE.ConeGeometry(.06,.48,16,1,true),new THREE.MeshBasicMaterial({color:0xffdf95,transparent:true,opacity:.27,depthWrite:false,blending:THREE.AdditiveBlending}));trail.rotation.x=-Math.PI/2;trail.position.z=-.27;group.add(trail);
  }else{
   const map=softRingTexture(kind==='cosmos_wave');
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
  if(kind==='shell'){
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
