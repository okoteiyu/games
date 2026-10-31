import * as THREE from './vendor/three/three.module.js';

// Presentation values only; these never consume the game's random stream.
export const HIT_PARTICLE_COUNT=12;
export const HIT_PARTICLE_CAPACITY=48;
export const HIT_PARTICLE_LIFETIME=.56;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const transientName=/(^|[._ ])(?:[a-z0-9-]*Aura|Ray|Effect|Particle|Exhaust|[a-z0-9-]*Shadow)/i;
const beamName=/(^|[._ ])(?:Ray|AttackEffect)/i;
const groundName=/Ground(?:Frame|Fissure|Uplift)/i;
const elephantWisp=/MiniElephant[._ ]?Wisp/i;

function excluded(mesh,record,allowSoftBody){
 const explicit=new Set([...(record.appearance?.whiteAuraNodes||[]),...(record.appearance?.rayNodes||[])]);
 for(let node=mesh;node;node=node.parent){if(node.visible===false||node===record.fixedGround||groundName.test(node.name)||elephantWisp.test(node.name)||record.appearance?.rayNodes?.includes(node)||beamName.test(node.name))return true;if(!allowSoftBody&&(explicit.has(node)||transientName.test(node.name)))return true;if(node===record.model)break;}
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];return !materials.some(material=>material&&material.visible!==false&&(material.opacity??1)>0);
}

function emittersFor(record,meshes){
 record.model.updateWorldMatrix(true,true);
 const collect=allowSoftBody=>{const emitters=[],bounds=new THREE.Box3();let total=0;
  for(const mesh of meshes){if(excluded(mesh,record,allowSoftBody))continue;const position=mesh.geometry?.attributes?.position,count=mesh.geometry.index?.count??position?.count??0;if(!position||count<3)continue;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);if(box.isEmpty())continue;const size=box.getSize(new THREE.Vector3()),weight=Math.max(1e-6,size.x*size.y+size.y*size.z+size.z*size.x);total+=weight;emitters.push({mesh,until:total,count});bounds.union(box);}
  return {emitters,bounds,total};
 };
 const body=collect(false);return body.emitters.length?body:collect(true);
}

function surfacePoint(body,camera,random){
 let best=null,bestScore=-Infinity;const center=body.bounds.getCenter(new THREE.Vector3()),height=Math.max(.001,body.bounds.max.y-body.bounds.min.y),eye=camera.getWorldPosition(new THREE.Vector3());
 for(let attempt=0;attempt<4;attempt++){
  const choice=random()*body.total,entry=body.emitters.find(candidate=>choice<=candidate.until)||body.emitters.at(-1),mesh=entry.mesh,index=mesh.geometry.index,triangle=Math.floor(random()*Math.floor(entry.count/3))*3,vertices=[];
  for(let corner=0;corner<3;corner++){const vertex=new THREE.Vector3(),vertexIndex=index?index.getX(triangle+corner):triangle+corner;mesh.getVertexPosition(vertexIndex,vertex);vertices.push(vertex.applyMatrix4(mesh.matrixWorld));}
  const root=Math.sqrt(random()),v=random(),point=vertices[0].clone().multiplyScalar(1-root).addScaledVector(vertices[1],root*(1-v)).addScaledVector(vertices[2],root*v),normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize(),facing=normal.dot(eye.clone().sub(point).normalize()),level=(point.y-body.bounds.min.y)/height,score=(level>=.12&&level<=.88?2:0)+facing;
  if(score>bestScore){bestScore=score;best=point;}if(score>2.2)break;
 }
 return best||center;
}

/** One small world-space pool per struck actor, independent of body animation. */
export class HitParticles{
 constructor(record){
  this.record=record;this.disposed=false;this.cursor=0;this.seed=1381636;this.bursts=0;this.activeCount=0;this.lastBounds=null;this.meshes=[];record.model.traverse(node=>{if(node.isMesh)this.meshes.push(node);});
  const geometry=this.geometry=new THREE.BufferGeometry();this.attributes={};
  for(const [name,size]of[['position',3],['aColor',3],['aAlpha',1],['aSize',1],['aStar',1]]){const attribute=new THREE.BufferAttribute(new Float32Array(HIT_PARTICLE_CAPACITY*size),size);attribute.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,attribute);this.attributes[name]=attribute;}
  this.material=new THREE.ShaderMaterial({uniforms:{viewportHeight:{value:390},pixelRatio:{value:1}},transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
   vertexShader:'uniform float viewportHeight;uniform float pixelRatio;attribute vec3 aColor;attribute float aAlpha;attribute float aSize;attribute float aStar;varying vec3 vColor;varying float vAlpha;varying float vStar;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*viewportHeight*pixelRatio*projectionMatrix[1][1]/(2.*max(.01,-p.z)),3.5*pixelRatio,11.*pixelRatio);vColor=aColor;vAlpha=aAlpha;vStar=aStar;}',
   fragmentShader:'varying vec3 vColor;varying float vAlpha;varying float vStar;void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);float soft=max(pow(max(0.,1.-r),1.35),(1.-smoothstep(.55,1.,r))*.48);float star=max(max(0.,1.-abs(p.x)*4.)*max(0.,1.-abs(p.y)),max(0.,1.-abs(p.y)*4.)*max(0.,1.-abs(p.x)));float alpha=mix(soft,max(soft*.55,star),vStar)*vAlpha;if(alpha<.015)discard;gl_FragColor=vec4(mix(vec3(.70,.43,.16),vColor,1.-smoothstep(.15,.8,r)),alpha);\n#include <colorspace_fragment>\n}'});
  this.root=new THREE.Points(geometry,this.material);this.root.name='Battle.HitParticles.'+record.instanceId;this.root.frustumCulled=false;this.root.renderOrder=6;this.root.visible=false;
  this.particles=Array.from({length:HIT_PARTICLE_CAPACITY},()=>({age:Infinity,origin:new THREE.Vector3(),velocity:new THREE.Vector3(),size:0,gravity:0,floor:0,ceiling:0}));
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 burst(camera){
  if(this.disposed)return false;const body=emittersFor(this.record,this.meshes);if(!body.emitters.length)return false;
  const size=body.bounds.getSize(new THREE.Vector3()),center=body.bounds.getCenter(new THREE.Vector3()),height=Math.max(.01,size.y),travel=new THREE.Vector3(clamp(size.x*.16,.025,.35),clamp(height*.18,.025,.32),clamp(size.z*.12,.025,.35)).multiplyScalar(1.3),palette=[0xfffbef,0xeeb85d,0xffdc91].map(color=>new THREE.Color(color));this.lastBounds={min:body.bounds.min.toArray(),max:body.bounds.max.toArray()};
  for(let i=0;i<HIT_PARTICLE_COUNT;i++){
   const slot=this.cursor++%HIT_PARTICLE_CAPACITY,particle=this.particles[slot],point=surfacePoint(body,camera,()=>this.random()),radial=point.clone().sub(center);
   particle.age=0;particle.origin.copy(point);particle.velocity.set((radial.x/Math.max(.01,size.x)+(this.random()-.5)*.8)*travel.x/HIT_PARTICLE_LIFETIME,(.45+this.random()*.55)*travel.y/HIT_PARTICLE_LIFETIME,(radial.z/Math.max(.01,size.z)+(this.random()-.5)*.8)*travel.z/HIT_PARTICLE_LIFETIME);particle.size=clamp(height*(.06+this.random()*.035),.012,.24);particle.gravity=Math.min(2.8,height*1.2);particle.floor=Math.max(.012,Math.min(point.y,body.bounds.min.y));particle.ceiling=body.bounds.max.y+Math.min(.15,height*.15);const color=palette[i%palette.length];this.attributes.aColor.setXYZ(slot,color.r,color.g,color.b);this.attributes.aStar.setX(slot,i%3===0?1:0);
  }
  this.bursts++;this.attributes.aColor.needsUpdate=true;this.attributes.aStar.needsUpdate=true;this.sample();return true;
 }
 setViewport(height=390,pixelRatio=1){this.material.uniforms.viewportHeight.value=Math.max(1,Number(height)||390);this.material.uniforms.pixelRatio.value=clamp(Number(pixelRatio)||1,1,2);}
 advance(dt){if(this.disposed)return;const step=Math.min(.1,Math.max(0,Number(dt)||0));for(const particle of this.particles)if(particle.age<HIT_PARTICLE_LIFETIME)particle.age+=step;this.sample();}
 sample(){
  this.activeCount=0;
  for(const [index,particle]of this.particles.entries()){if(particle.age>=HIT_PARTICLE_LIFETIME){this.attributes.aAlpha.setX(index,0);continue;}this.activeCount++;const t=particle.age/HIT_PARTICLE_LIFETIME,x=particle.origin.x+particle.velocity.x*particle.age,y=clamp(particle.origin.y+particle.velocity.y*particle.age-.5*particle.gravity*particle.age**2,particle.floor,particle.ceiling),z=particle.origin.z+particle.velocity.z*particle.age;this.attributes.position.setXYZ(index,x,y,z);this.attributes.aAlpha.setX(index,(1-t)**1.5);this.attributes.aSize.setX(index,particle.size*(1-.5*t));}
  this.attributes.position.needsUpdate=true;this.attributes.aAlpha.needsUpdate=true;this.attributes.aSize.needsUpdate=true;this.root.visible=this.activeCount>0;
 }
 clear(reset=false){for(const particle of this.particles)particle.age=Infinity;this.activeCount=0;this.attributes.aAlpha.array.fill(0);this.attributes.aAlpha.needsUpdate=true;this.root.visible=false;if(reset){this.cursor=0;this.seed=1381636;this.bursts=0;this.lastBounds=null;}}
 getDiagnostics(){return {capacity:HIT_PARTICLE_CAPACITY,particlesPerHit:HIT_PARTICLE_COUNT,lifetime:HIT_PARTICLE_LIFETIME,bursts:this.bursts,activeCount:this.activeCount,visible:this.root.visible,disposed:this.disposed,bodyBounds:this.lastBounds,ages:this.particles.filter(p=>p.age<HIT_PARTICLE_LIFETIME).map(p=>p.age)};}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.root.removeFromParent();this.geometry.dispose();this.material.dispose();this.meshes.length=0;}
}
