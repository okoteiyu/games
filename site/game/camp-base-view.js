import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {loadAssetJson,loadGLTFAsset} from './asset-store.js';
import {isModalBlocked} from './modal-layer.js';
import {createCampPatrolPlan,sampleCampPatrol} from './camp-base-patrol.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const safeInt=(v,min,max,fallback)=>Number.isInteger(v)&&v>=min&&v<=max?v:fallback;
const find=(root,name)=>root.getObjectByName(name)||root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const point=(values)=>new THREE.Vector3(...values);

/** A persistent base's presentation only. Base placement, inventory, network
 * and saving belong to the session. The fixed layouts never consume game RNG. */
export class CampBaseView{
 constructor({container,onStatus=()=>{},onError=()=>{},isPresentationPaused=()=>false}={}){
  if(!container)throw new TypeError('キャンプ拠点の表示先がありません。');
  Object.assign(this,{container,onStatus,onError,isPresentationPaused});
  this.root=document.createElement('div');this.root.className='camp-base-view';this.root.hidden=true;Object.assign(this.root.style,{position:'absolute',inset:'0',overflow:'hidden',background:'#17251f'});container.append(this.root);
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#243c35');this.scene.fog=new THREE.FogExp2('#243c35',.021);
  this.camera=new THREE.PerspectiveCamera(43,1,.1,90);this.cameraAim=new THREE.Vector3(0,.5,0);this.orbit={yaw:.3,pitch:.72,radius:26.5};
  this.scene.add(new THREE.HemisphereLight(0xc4d9d7,0x414b31,2.3));
  const moon=new THREE.DirectionalLight(0xc5d9e8,2.35);moon.position.set(-8,13,7);this.scene.add(moon);
  const warm=new THREE.DirectionalLight(0xffe1a9,.65);warm.position.set(7,6,-4);this.scene.add(warm);
  this.stage=new THREE.Group();this.scene.add(this.stage);this.loader=new GLTFLoader();this.listeners=[];this.patrols=[];this.fires=[];this.active=false;this.ready=false;this.loading=false;this.destroyed=false;this.contextLost=false;this.generation=0;this.time=0;this.renderFrames=0;
 }
 createRenderer(){
  if(this.renderer)return;
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power',alpha:false});this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  const canvas=this.canvas=this.renderer.domElement;canvas.className='camp-base-webgl';canvas.tabIndex=0;Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',touchAction:'none'});canvas.setAttribute('role','img');canvas.setAttribute('aria-label','暗い森の開けた場所に石造りのキャンプ拠点と焚き火。新人くんたちが見回っています。スワイプまたは矢印キーで周りから見られます。');this.root.append(canvas);
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);this.listeners.push(()=>target.removeEventListener(type,fn));};
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();this.contextLost=true;this.cancelInput();this.onStatus('キャンプ拠点の3D表示を復旧しています…');});
  listen(canvas,'webglcontextrestored',()=>{this.contextLost=false;this.resize();this.onStatus('');this.render();});
  listen(canvas,'pointerdown',event=>{if(!this.canUseInput()||event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();canvas.focus({preventScroll:true});if(this.drag){this.drag=null;this.multiInput=true;return;}this.drag={id:event.pointerId,x:event.clientX,y:event.clientY};try{canvas.setPointerCapture(event.pointerId);}catch{}});
  listen(canvas,'pointermove',event=>{if(!this.drag||this.drag.id!==event.pointerId||this.multiInput||!this.canUseInput())return;event.preventDefault();const rect=canvas.getBoundingClientRect();this.rotate((event.clientX-this.drag.x)/Math.max(120,rect.width)*Math.PI,-(event.clientY-this.drag.y)/Math.max(120,rect.height)*Math.PI*.6);this.drag.x=event.clientX;this.drag.y=event.clientY;});
  const end=event=>{if(this.drag?.id===event.pointerId)this.drag=null;this.multiInput=false;try{canvas.releasePointerCapture(event.pointerId);}catch{}};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,end);
  listen(canvas,'keydown',event=>{const step=Math.PI/24,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[event.key];if(delta&&this.canUseInput()){event.preventDefault();this.rotate(...delta);}});
  listen(canvas,'wheel',event=>{if(this.active)event.preventDefault();});
  listen(window,'blur',()=>this.cancelInput());listen(document,'visibilitychange',()=>this.cancelInput());
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.root);this.resize();
 }
 canUseInput(){return this.active&&this.ready&&!this.loading&&!this.destroyed&&!this.contextLost&&!document.hidden&&!this.isPresentationPaused()&&!isModalBlocked();}
 cancelInput(){if(this.drag)try{this.canvas?.releasePointerCapture(this.drag.id);}catch{}this.drag=null;this.multiInput=false;}
 rotate(yaw,pitch){if(!finite(yaw)||!finite(pitch))return false;this.orbit.yaw=THREE.MathUtils.euclideanModulo(this.orbit.yaw+yaw,Math.PI*2);this.orbit.pitch=clamp(this.orbit.pitch+pitch,.45,1.12);this.fitCamera();this.render();return true;}
 async load(base={}){
  const generation=++this.generation;this.loading=true;this.ready=false;this.base={...base,hutCount:safeInt(base.hutCount,5,10,5),rookieCount:safeInt(base.rookieCount,3,5,3)};this.onStatus('キャンプ拠点を準備しています…');if(this.canvas)this.canvas.style.visibility='hidden';
  try{
   this.createRenderer();this.metadata??=await loadAssetJson(new URL('./assets/camp-base/camp-base.json',import.meta.url));
   const url=new URL('./assets/camp-base/'+this.metadata.model.url,import.meta.url);url.searchParams.set('v',this.metadata.model.sha256);
   this.kit??=await loadGLTFAsset(this.loader,url.href);
   this.actorManifest??=await loadAssetJson(new URL('./assets/battle3d/manifest.json',import.meta.url));const record=this.actorManifest.models.rookie_kun,actorUrl=new URL('./assets/battle3d/'+record.url,import.meta.url);actorUrl.searchParams.set('v',record.sha256);this.rookieTemplate??=await loadGLTFAsset(this.loader,actorUrl.href);
   if(this.destroyed||generation!==this.generation)return false;
   this.makeLayout();this.time=0;this.orbit={...this.metadata.camera};this.cameraAim.fromArray(this.metadata.camera.target);this.ready=true;this.loading=false;this.resize();this.updatePatrols(0);this.onStatus('');if(this.canvas)this.canvas.style.visibility='';this.render();return true;
  }catch(error){if(this.destroyed||generation!==this.generation)return false;this.loading=false;this.ready=false;this.onStatus('');this.onError(error);return false;}
 }
 prototype(kind){const value=find(this.kit.scene,this.metadata.prototypes[kind]);if(!value)throw new Error('キャンプ拠点のモデルが見つかりません。');return value;}
 makeLayout(){
  for(const patrol of this.patrols)patrol.mixer.stopAllAction();this.patrols=[];this.fires=[];this.clearStage();
  const layout=this.metadata.layouts[String(this.base.hutCount)];this.stage.add(this.prototype('ground').clone(true));
  for(const [i,entry]of layout.huts.entries()){const hut=this.prototype('hut').clone(true);hut.name='CampBase.Hut.'+i;hut.position.fromArray(entry.position);hut.rotation.y=entry.yaw;this.stage.add(hut);}
  this.populateForest();
  for(const [i,position]of layout.fires.entries()){
   const fire=this.prototype('hearth').clone(true);fire.name='CampBase.Hearth.'+i;fire.position.fromArray(position);this.stage.add(fire);
   const flames=new THREE.Group();flames.position.fromArray(position);flames.position.y=.20;this.stage.add(flames);
   const core=new THREE.Mesh(new THREE.ConeGeometry(.18,.65,7),new THREE.MeshBasicMaterial({color:0xffd77b,transparent:true,opacity:.92,depthWrite:false}));core.userData.runtimeDisposable=true;core.position.y=.29;flames.add(core);
   const outer=new THREE.Mesh(new THREE.ConeGeometry(.32,.72,8),new THREE.MeshBasicMaterial({color:0xff702a,transparent:true,opacity:.52,depthWrite:false}));outer.userData.runtimeDisposable=true;outer.position.y=.30;flames.add(outer);
   const light=new THREE.PointLight(0xffb75f,13,6,2);light.position.set(position[0],.75,position[2]);this.stage.add(light);
   const geometry=new THREE.BufferGeometry(),points=[];for(let j=0;j<18;j++)points.push(Math.sin(j*2.4)*.28,.2+(j%7)*.16,Math.cos(j*2.4)*.28);geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffda85,size:.035,transparent:true,opacity:.8,depthWrite:false}));sparks.userData.runtimeDisposable=true;sparks.position.fromArray(position);this.stage.add(sparks);this.fires.push({flames,core,outer,light,sparks,index:i});
  }
  for(let i=0;i<this.base.rookieCount;i++){
   const model=this.rookieTemplate.scene.clone(true),anchor=new THREE.Group();anchor.name='CampBase.PatrollingRookie.'+i;anchor.add(model);this.stage.add(anchor);model.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});
   // Face meshes share a head pivot, so looking around turns the eyes and
   // smile together. The original character file and walking clip are retained.
   const upper=find(model,'Rookie.UpperBody'),head=find(model,'Rookie.Head');let lookRig=null;
   if(upper&&head){lookRig=new THREE.Group();lookRig.name='CampBase.RookieLook.'+i;lookRig.position.copy(head.position);upper.add(lookRig);model.updateMatrixWorld(true);for(const name of ['Rookie.Head','Rookie.Eye.-1','Rookie.Eye.1','Rookie.SmallSmile']){const part=find(model,name);if(part)lookRig.attach(part);}}
   const mixer=new THREE.AnimationMixer(model),clip=this.rookieTemplate.animations.find(clip=>clip.name===this.actorManifest.models.rookie_kun.clips.idle)||this.rookieTemplate.animations[0],walkAction=clip?mixer.clipAction(clip).play():null;
   const path=layout.patrols[i].map(point),plan=createCampPatrolPlan(path,i);this.patrols.push({anchor,model,mixer,path,plan,lookRig,walkAction});
  }
  this.stage.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});
 }
 populateForest(){
  // Instanced pine boughs retain the authored bark texture and layered foliage
  // without dozens of separate GLB downloads or one draw call per tree.
  const prototype=this.prototype('pine');prototype.updateMatrixWorld(true);const meshes=[];prototype.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const placements=[];for(let i=0;i<58;i++){const angle=i*2.3999632297,radius=10.7+(i%6)*.83,size=.66+(i%5)*.085;placements.push({angle,radius,size});}
  const dummy=new THREE.Object3D();for(const mesh of meshes){const instances=new THREE.InstancedMesh(mesh.geometry,mesh.material,placements.length);instances.name='CampBase.Forest';for(let i=0;i<placements.length;i++){const p=placements[i];dummy.position.set(Math.sin(p.angle)*p.radius,0,Math.cos(p.angle)*p.radius);dummy.rotation.set(0,p.angle*.7,0);dummy.scale.setScalar(p.size);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix.clone().multiply(mesh.matrixWorld));}instances.instanceMatrix.needsUpdate=true;this.stage.add(instances);}
 }
 updatePatrols(dt){
  for(const patrol of this.patrols){const pose=sampleCampPatrol(patrol.plan,this.time);patrol.anchor.position.fromArray(pose.position);patrol.anchor.rotation.y=pose.yaw;if(patrol.walkAction)patrol.walkAction.setEffectiveWeight(pose.walkBlend);patrol.mixer.setTime(pose.animationTime);if(patrol.lookRig)patrol.lookRig.rotation.y=pose.lookYaw;patrol.phase=pose.phase;patrol.pose=pose;}
  for(const fire of this.fires){const flicker=1+Math.sin(this.time*9+fire.index)*.10+Math.sin(this.time*13.7)*.055;fire.flames.scale.set(.95+Math.sin(this.time*7)*.07,flicker,1);fire.core.rotation.y=this.time*.8;fire.outer.rotation.y=-this.time*.4;fire.light.intensity=13*flicker;fire.sparks.rotation.y=this.time*.32;fire.sparks.position.y=(this.time*.18)% .35;fire.sparks.material.opacity=.65+Math.sin(this.time*3)*.15;}
 }
 tick(dt){if(!this.active||!this.ready||this.contextLost||this.destroyed||document.hidden||this.isPresentationPaused())return false;const delta=clamp(Number(dt)||0,0,.1);this.time+=delta;this.updatePatrols(delta);this.render();return true;}
 fitCamera(){const p=this.orbit,r=p.radius||26.5;this.camera.position.set(this.cameraAim.x+Math.sin(p.yaw)*Math.cos(p.pitch)*r,this.cameraAim.y+Math.sin(p.pitch)*r,this.cameraAim.z+Math.cos(p.yaw)*Math.cos(p.pitch)*r);this.camera.lookAt(this.cameraAim);this.camera.updateMatrixWorld(true);}
 resize(){if(!this.renderer||this.destroyed)return;const box=this.root.getBoundingClientRect();if(box.width<1||box.height<1)return;const width=Math.round(box.width),height=Math.round(box.height);if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}this.fitCamera();this.render();}
 render(){if(!this.active||!this.ready||!this.renderer||this.contextLost||this.destroyed||this.root.hidden)return;this.renderer.render(this.scene,this.camera);this.renderFrames++;}
 setActive(active){this.active=Boolean(active);this.root.hidden=!this.active;if(!this.active)this.cancelInput();else{if(this.root.parentElement!==this.container)this.container.append(this.root);this.resize();this.render();}}
 hide(){this.setActive(false);}
 capturePresentationState(){return {baseId:this.base?.id||null,time:this.time,orbit:{...this.orbit}};}
 restorePresentationState(value){if(!value||value.baseId!==(this.base?.id||null))return false;if(finite(value.time)&&value.time>=0)this.time=value.time;if(finite(value.orbit?.yaw)&&finite(value.orbit?.pitch))this.orbit={yaw:value.orbit.yaw,pitch:clamp(value.orbit.pitch,.45,1.12),radius:this.metadata?.camera?.radius||26.5};this.updatePatrols(0);this.resize();return true;}
 /** Browsers may leave a suspended context permanently lost when several game
  * views already own contexts. Rebuild its GPU resources from the retained CPU
  * scene; do not depend on a restoreContext event or restart the patrol clock. */
 recoverAfterInterruption(){
  if(this.recoveryPromise)return this.recoveryPromise;
  if(this.destroyed)return Promise.resolve(false);
  if(!this.active)return Promise.resolve(true);
  this.cancelInput();
  if(!this.contextLost&&this.renderer&&!this.renderer.getContext().isContextLost()){if(this.root.parentElement!==this.container)this.container.append(this.root);this.resize();return Promise.resolve(true);}
  this.recoveryPromise=Promise.resolve().then(()=>{
   if(this.destroyed)return false;
   const ready=this.ready,loading=this.loading;
   try{
    this.loading=true;this.releaseRenderer();this.contextLost=false;
    if(this.root.parentElement!==this.container)this.container.append(this.root);
    this.createRenderer();
    if(this.destroyed||this.renderer.getContext().isContextLost())throw new Error('キャンプ拠点の3D表示を復旧できませんでした。もう一度続けてください。');
    this.ready=ready;this.loading=loading;this.updatePatrols(0);this.resize();this.onStatus('');return this.ready;
   }catch(error){this.ready=ready;this.loading=loading;this.contextLost=true;this.onError(error);return false;}
  }).finally(()=>{this.recoveryPromise=null;});
  return this.recoveryPromise;
 }
 releaseRenderer(){
  this.cancelInput();this.resizeObserver?.disconnect();this.resizeObserver=null;for(const remove of this.listeners)remove();this.listeners=[];
  const renderer=this.renderer;this.canvas?.remove();this.canvas=null;this.renderer=null;this.width=this.height=0;
  if(renderer){try{renderer.dispose();}catch{}try{renderer.forceContextLoss?.();}catch{}}
 }
 clearStage(){
  // Authored template resources are shared. Dispose only runtime flame meshes.
  this.stage.traverse(node=>{if(node.userData.runtimeDisposable){node.geometry?.dispose();node.material?.dispose();}if(node.isInstancedMesh)node.dispose();});this.stage.clear();
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;this.generation++;this.active=false;this.releaseRenderer();for(const patrol of this.patrols)patrol.mixer.stopAllAction();this.clearStage();const geometries=new Set(),materials=new Set(),textures=new Set();for(const root of [this.kit?.scene,this.rookieTemplate?.scene])root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of node.material?Array.isArray(node.material)?node.material:[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();this.root.remove();}
}
