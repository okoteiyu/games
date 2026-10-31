import * as THREE from './vendor/three/three.module.js';

export const FATIGUE_DURATION=1.2;
export const FATIGUE_MAX_FRAME_SECONDS=.1;
const clamp=value=>Math.max(0,Math.min(1,value));

/** Rigid motion only: never rotate, shrink, or move the body below its floor. */
export function fatigueMotion(elapsed,height=.45){
 const t=clamp(Number(elapsed)/FATIGUE_DURATION||0),size=Math.max(.01,Number(height)||.45),settle=(1-t)**2,arrival=clamp(t/.12);
 if(t===0||t===1)return {x:0,y:0,z:0};
 return {x:Math.min(.025,size*.045)*Math.sin(t*Math.PI*6)*settle*arrival,y:Math.min(.018,size*.03)*Math.sin(t*Math.PI)**2*(1-t),z:0};
}

function softTexture(drop=false){
 const size=32,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(x+.5)/size*2-1,dy=(y+.5)/size*2-1,width=drop?.32+.45*((dy+1)/2):1,r=Math.hypot(dx/width,dy),i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r)**(drop?1.1:1.8));}
 const texture=new THREE.DataTexture(pixels,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

/** Small, soft breaths and a tired droplet stay below the character's head. */
export class FatigueEffects{
 constructor(height=.45){
  this.height=Math.max(.01,Number(height)||.45);this.root=new THREE.Group();this.root.name='Battle.FatigueEffects';this.root.visible=false;this.parts=[];this.textures=[softTexture(),softTexture(true)];
  for(let i=0;i<3;i++){const drop=i===2,part=new THREE.Sprite(new THREE.SpriteMaterial({map:this.textures[drop?1:0],color:drop?0x9dcbdc:0xd7e4de,transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false}));part.name=drop?'Fatigue.TiredDroplet':'Fatigue.SoftBreath.'+i;part.renderOrder=3;this.root.add(part);this.parts.push(part);}
 }
 sample(elapsed,complete=false){
  const t=clamp(Number(elapsed)/FATIGUE_DURATION||0),h=this.height,size=Math.min(.38,Math.max(.045,h*.18)),startX=Math.min(.22,h*.45),travel=Math.min(.12,h*.2);
  this.root.visible=!complete&&t>0&&t<1;
  for(const [i,part]of this.parts.entries()){const u=clamp((t-.08-i*.13)/.55),envelope=Math.sin(Math.PI*u),drop=i===2;part.visible=this.root.visible&&u>0&&u<1;part.position.set((drop?-1:1)*(startX+travel*u),h*.65+travel*u,0);const scale=size*(.55+.45*envelope);part.scale.set(scale*(drop?.55:1),scale*(drop?1.3:.85),1);part.material.opacity=(drop?.68:.52)*envelope;}
 }
 dispose(){this.root.removeFromParent();for(const part of this.parts)part.material.dispose();for(const texture of this.textures)texture.dispose();this.parts.length=0;}
}
