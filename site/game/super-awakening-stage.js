import * as THREE from './vendor/three/three.module.js';

const smooth=value=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};

/** An isolated, opaque stage: battle actors and attack effects never enter it. */
export class SuperAwakeningStage{
 constructor(){
  this.scene=new THREE.Scene();this.scene.name='SuperAwakening.Space';this.scene.background=new THREE.Color('#030615');
  this.camera=new THREE.PerspectiveCamera(36,1,.01,30);
  // Local deterministic randomness keeps presentation out of the game's RNG.
  let seed=96136;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  this.makeNebula(random);this.makeStars(random);this.makeGlints(random);
  this.scene.add(new THREE.HemisphereLight(0xd5e6ff,0x28203e,2));
  const key=new THREE.DirectionalLight(0xffedcc,3);key.position.set(-2,3,4);this.scene.add(key);
  const rim=new THREE.DirectionalLight(0x9abfff,1.6);rim.position.set(2,2,-2);this.scene.add(rim);
 }
 makeNebula(random){
  const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
  const base=ctx.createLinearGradient(0,0,size,size);base.addColorStop(0,'#020512');base.addColorStop(.55,'#090b24');base.addColorStop(1,'#110a24');ctx.fillStyle=base;ctx.fillRect(0,0,size,size);
  const cloud=(x,y,r,color,alpha)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+color+','+alpha+')');g.addColorStop(1,'rgba('+color+',0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);};
  cloud(size*.25,size*.25,size*.65,'31,77,153',.32);cloud(size*.92,size*.7,size*.6,'92,34,140',.28);
  for(let i=0;i<90;i++){
   const t=random(),x=t*size,y=size*(.8-t*.58)+(random()-.5)*size*.25;
   cloud(x,y,size*(.05+random()*.17),i%3?'38,70,130':'93,46,131',.018+random()*.035);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.ShaderMaterial({uniforms:{map:{value:texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv);\n#include <colorspace_fragment>\n}',depthWrite:false,depthTest:false,toneMapped:false});
  this.nebula=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);this.nebula.name='SuperAwakening.Nebula';this.nebula.frustumCulled=false;this.nebula.renderOrder=-100;this.scene.add(this.nebula);
 }
 makeStars(random){
  const count=640,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count),speeds=new Float32Array(count);
  for(let i=0;i<count;i++){
   positions.set([(random()-.5)*4.8,(random()-.5)*4.8+.3,-2-random()*3],i*3);
   const tint=new THREE.Color(i%5===0?0xc2d9ff:i%7===0?0xe5d1ff:0xfff9ec);colors.set([tint.r,tint.g,tint.b],i*3);
   sizes[i]=.9+random()*2.1;phases[i]=random()*Math.PI*2;speeds[i]=2+random()*4;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  for(const [name,data]of [['aSize',sizes],['aPhase',phases],['aSpeed',speeds]])geometry.setAttribute(name,new THREE.BufferAttribute(data,1));
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},pixelRatio:{value:1}},vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
   vertexShader:'uniform float time;uniform float pixelRatio;attribute float aSize;attribute float aPhase;attribute float aSpeed;varying float vAlpha;varying vec3 vColor;void main(){float shine=.5+.5*sin(time*aSpeed+aPhase);vAlpha=.3+.7*shine*shine;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*pixelRatio*(.8+.4*shine);}',
   fragmentShader:'varying float vAlpha;varying vec3 vColor;void main(){float r=length(gl_PointCoord-vec2(.5))*2.;float alpha=pow(max(0.,1.-r),1.3)*vAlpha;gl_FragColor=vec4(vColor,alpha);\n#include <colorspace_fragment>\n}'});
  this.stars=new THREE.Points(geometry,material);this.stars.name='SuperAwakening.TwinklingStars';this.scene.add(this.stars);this.starCount=count;
 }
 makeGlints(random){
  const size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
  const glow=ctx.createRadialGradient(64,64,0,64,64,62);glow.addColorStop(0,'#fffdf3');glow.addColorStop(.08,'#d5e7ff');glow.addColorStop(.22,'#a3caff66');glow.addColorStop(1,'#88b9ff00');ctx.fillStyle=glow;ctx.fillRect(0,0,size,size);
  for(const vertical of [false,true]){const g=ctx.createLinearGradient(vertical?64:4,vertical?4:64,vertical?64:124,vertical?124:64);g.addColorStop(0,'#cde7ff00');g.addColorStop(.5,'#f9fdffdc');g.addColorStop(1,'#cde7ff00');ctx.fillStyle=g;ctx.beginPath();if(vertical){ctx.moveTo(64,3);ctx.lineTo(66,64);ctx.lineTo(64,125);ctx.lineTo(62,64);}else{ctx.moveTo(3,64);ctx.lineTo(64,62);ctx.lineTo(125,64);ctx.lineTo(64,66);}ctx.closePath();ctx.fill();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.glints=[];
  for(const [x,y]of [[-1.0,.95],[.86,1.25],[-.9,-.38],[1.12,-.6],[-.48,1.7],[.62,-.95],[1.55,.52],[-1.5,.18]]){
   const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));sprite.position.set(x,y,-2.4);const scale=.12+random()*.13;sprite.scale.set(scale,scale,1);sprite.userData.phase=random()*Math.PI*2;this.glints.push(sprite);this.scene.add(sprite);
  }
 }
 mount(actor){this.actor=actor;actor.anchor.position.set(0,0,0);actor.facing.rotation.set(0,0,0);actor.anchor.visible=true;this.scene.add(actor.anchor);}
 sample(elapsed,duration,{width,height,pixelRatio=1}={}){
  const bodyHeight=this.actor.height,t=THREE.MathUtils.clamp(elapsed/duration,0,1),push=smooth(t);
  this.camera.aspect=width/height;this.camera.position.set(bodyHeight*.08,bodyHeight*.65,bodyHeight*(3.05-.16*push));this.camera.lookAt(0,bodyHeight*.50,0);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
  this.stars.material.uniforms.time.value=elapsed;this.stars.material.uniforms.pixelRatio.value=pixelRatio;
  this.stars.rotation.z=elapsed*.012;
  for(const sprite of this.glints)sprite.material.opacity=.40+.60*(.5+.5*Math.sin(elapsed*4.4+sprite.userData.phase))**2;
 }
 dispose(){
  this.actor?.anchor.removeFromParent();const textures=new Set();
  this.scene.traverse(node=>{node.geometry?.dispose();for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){if(material.map)textures.add(material.map);if(material.uniforms?.map?.value)textures.add(material.uniforms.map.value);material.dispose();}});
  for(const texture of textures)texture.dispose();this.scene.clear();this.scene.environment=null;
 }
}
