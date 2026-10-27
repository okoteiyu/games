import * as THREE from './vendor/three/three.module.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
/** A display-space trajectory; coordinates are metres, Y up, forward -Z.
 * Branch bends follow the current 3D junction rather than the decorative map. */
export function sampleEggplantFlight(progress,{direction='front',start=[0,.7,.6],end=[0,.13,-32],arcHeight=.9,spinTurns=1.35,junctionZ=-7.5}={}){
 const u=clamp(Number(progress)||0,0,1),depth=Math.pow(u,1.45);
 let x,z;
 if(direction==='front'){
  x=lerp(start[0],end[0],depth);z=lerp(start[2],end[2],depth);
 }else if(u<=.58){
  const approach=Math.pow(u/.58,1.4);x=lerp(start[0],0,approach);z=lerp(start[2],junctionZ,approach);
 }else{
  const bend=smooth((u-.58)/.42);x=(direction==='left'?-1:1)*13*bend;z=junctionZ-.25*bend;
 }
 return {position:[x,lerp(start[1],end[1],u)+Math.sin(Math.PI*u)*arcHeight,z],rotation:[Math.PI*.12+u*Math.PI*2*spinTurns,(direction==='left'?-1:direction==='right'?1:0)*u*Math.PI*.38,-.28+u*.55],scale:[1,1,1]};
}

/** One rigid 3D vegetable and its disposable presentation timeline. This class
 * never changes the route, inventory, or the canonical lifetime of blocked roads. */
export class EggplantThrow {
 constructor({model,metadata={},scene}){
  this.metadata=metadata;this.duration=Number(metadata.duration)||1.2;
  this.group=new THREE.Group();this.group.name='Patrol.EggplantThrow';this.group.visible=false;
  const object=model.clone(true),name=metadata.rootNode||metadata.rootNodeName||'eggplant_root';
  const root=object.getObjectByName(name)||object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
  if(root){root.position.set(0,0,0);root.quaternion.identity();root.scale.set(1,1,1);}
  object.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});
  this.group.add(object);scene.add(this.group);
  this.ready=true;this.busy=false;this.elapsed=0;this.progress=0;this.completed=false;this.direction=null;
 }
 start(direction,{junctionZ=-7.5,surfaceY=.0145,onComplete}={}){
  if(this.busy||!['left','front','right'].includes(direction))return false;
  const motion=this.metadata.motion||this.metadata;
  this.direction=direction;this.elapsed=0;this.progress=0;this.busy=true;this.completed=false;this.callback=typeof onComplete==='function'?onComplete:null;
  this.path={direction,start:[...(motion.start||[0,.7,.6])],end:[...(motion.end||[0,.13,-32])],arcHeight:Number(motion.arcHeight)||.9,spinTurns:Number(motion.spinTurns)||1.35,junctionZ};
  this.path.end[1]+=surfaceY;this.group.visible=true;this.apply(0);return true;
 }
 apply(progress){
  this.progress=clamp(Number(progress)||0,0,1);const sample=sampleEggplantFlight(this.progress,this.path);
  this.group.position.fromArray(sample.position);this.group.rotation.set(...sample.rotation);this.group.scale.set(1,1,1);this.group.updateMatrixWorld(true);
 }
 update(dt){
  if(!this.busy)return false;
  this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,Number(dt)||0));this.apply(this.elapsed/this.duration);
  if(this.elapsed>=this.duration){this.busy=false;this.completed=true;const callback=this.callback;this.callback=null;if(callback)callback();}
  return true;
 }
 seek(progress){
  if(!this.path)return false;
  this.elapsed=clamp(Number(progress)||0,0,1)*this.duration;this.apply(this.elapsed/this.duration);
  // Scrubbing is a presentation operation and never repeats a game callback.
  if(this.progress>=1){this.busy=false;this.completed=true;this.callback=null;}
  return true;
 }
 cancel(){this.busy=false;this.callback=null;this.group.visible=false;this.completed=false;this.elapsed=0;this.progress=0;}
 getDiagnostics(){return {ready:this.ready,busy:this.busy,visible:this.group.visible,direction:this.direction,elapsed:this.elapsed,duration:this.duration,progress:this.progress,completed:this.completed,position:this.group.position.toArray(),rotation:this.group.rotation.toArray(),scale:this.group.scale.toArray(),start:this.path?.start||null,end:this.path?sampleEggplantFlight(1,this.path).position:null,junctionZ:this.path?.junctionZ??null};}
 destroy(){this.cancel();this.group.removeFromParent();this.ready=false;}
}
