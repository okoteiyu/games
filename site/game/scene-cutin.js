import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {loadGLTFAsset,loadAssetBuffer,loadAssetJson} from './asset-store.js';
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const find=(root,name)=>root.getObjectByName(name)||root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
export const SCENE_CUTIN_DURATIONS=Object.freeze({departure:4.4/1.4,win:2.55,loss:3.2});
/** Clear the sliding panel laterally before advancing through the opening. */
export function sampleDeparture(elapsed){
 const t=THREE.MathUtils.clamp(elapsed*1.4,0,4.4);
 const clipTime=t<=.25?t/.25*.8:t<=1.75?.8+(t-.25)/1.5*3.2:t<=2?4+(t-1.75)/.25:5;
 const lateral=smooth((t-2)/1.2),forward=smooth((t-3.05)/1.35),stride=(.63*lateral+.99*forward)/1.62;
 return {clipTime,walking:t>2,position:[.51-.63*lateral,.08+.014*Math.abs(Math.sin(stride*Math.PI*6)),-.329+.99*forward]};
}
export function sampleVictory(elapsed){
 const u=THREE.MathUtils.clamp(elapsed-.3,0,2.1),phase=(u%1.05)/1.05;
 const height=u>0&&u<2.1?.09*Math.sin(Math.PI*phase):0;
 return {height,tilt:height/.09*.045*Math.sin(elapsed*7)};
}
/** Short, deterministic view-local cutscenes. The game owns the clock. */
export class SceneCutin{
 constructor({view,onComplete=()=>{},onError=()=>{}}){
  Object.assign(this,{view,onComplete,onError});this.loader=new GLTFLoader();this.cache=new Map();this.elapsed=0;this.active=false;this.ready=false;this.generation=0;this.contextListeners=[];
  this.container=document.createElement('div');Object.assign(this.container.style,{position:'absolute',inset:'0',background:'#f1eddf'});this.container.className='scene-cutin';
  this.status=document.createElement('div');this.status.className='house3d-status anger-cutin-recovery';this.status.innerHTML='<span>カットインを準備しています…</span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);this.status.querySelector('button').onclick=()=>this.play(this.kind);
 }
 async template(url){
  const door=url.includes('door3d'),metadata=await loadAssetJson(new URL(door?'./assets/door3d/metadata.json':'./assets/battle3d/manifest.json',import.meta.url));
  const asset=new URL(url,import.meta.url),revision=door?metadata.glbSha256:metadata.models.okoteiyu.sha256;if(revision)asset.searchParams.set('v',revision);const key=asset.href;
  if(!this.cache.has(key)){const p=loadGLTFAsset(this.loader,key);this.cache.set(key,p);p.catch(()=>this.cache.delete(key));}return this.cache.get(key);
 }
 async face(kind){const url='./assets/scene-cutins/face_'+(kind==='win'?'happy':'teary')+'.png';const buffer=await loadAssetBuffer(new URL(url,import.meta.url));const blob=new Blob([buffer],{type:'image/png'}),image=await createImageBitmap(blob),texture=new THREE.CanvasTexture(image);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;return texture;}
 async play(kind,{resumeState=null}={}){
  this.kind=kind;this.duration=Number.isFinite(resumeState?.duration)&&resumeState.duration>0?resumeState.duration:SCENE_CUTIN_DURATIONS[kind];this.elapsed=Number.isFinite(resumeState?.elapsed)?THREE.MathUtils.clamp(resumeState.elapsed,0,this.duration):0;this.active=true;this.ready=false;const generation=++this.generation;
  // The renderer is reused; keep its previous frame out of the new cut-in
  // while the model and expression are loading, including failed retries.
  if(this.renderer)this.renderer.domElement.style.visibility='hidden';
  this.view.clear();this.view.surface.append(this.container);this.status.hidden=false;this.status.querySelector('span').textContent='カットインを準備しています…';this.status.querySelector('button').hidden=true;
  try{
   this.renderer??=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
   const canvas=this.renderer.domElement;if(!this.contextEvents){this.contextEvents=true;const listen=(type,handler)=>{canvas.addEventListener(type,handler);this.contextListeners.push(()=>canvas.removeEventListener(type,handler));};listen('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.status.hidden=false;this.status.querySelector('span').textContent='3D表示を復旧しています…';});listen('webglcontextrestored',()=>{this.contextLost=false;this.status.hidden=true;this.render();});}canvas.className='scene-cutin-webgl';Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',visibility:'hidden'});canvas.setAttribute('role','img');canvas.setAttribute('aria-label',kind==='departure'?'部屋の中から、両手で引き戸を開けて外に出るおこていゆ':kind==='win'?'正面から見た、笑顔で跳ねるおこていゆ':'正面から見た、半泣きでしょんぼりするおこていゆ');this.container.prepend(canvas);
   const gltf=await this.template(kind==='departure'?'./assets/door3d/door_motions.glb':'./assets/battle3d/okoteiyu.glb');if(generation!==this.generation)return false;
   this.scene=new THREE.Scene();this.scene.background=new THREE.Color(kind==='departure'?0xeee6d6:0xf2eedf);this.camera=new THREE.PerspectiveCamera(kind==='departure'?45:34,1,.01,40);
   this.scene.add(new THREE.HemisphereLight(0xfff9e9,0xb2bdb4,2));const key=new THREE.DirectionalLight(0xfff0d7,2.4);key.position.set(-2,4,3);this.scene.add(key);const fill=new THREE.DirectionalLight(0xe9f4ff,.8);fill.position.set(2,2,-3);this.scene.add(fill);
   this.model=gltf.scene.clone(true);this.scene.add(this.model);this.mixer=new THREE.AnimationMixer(this.model);
   if(kind==='departure'){
    this.root=find(this.model,'DoorActor.Root');this.slider=find(this.model,'Door.Slider');this.clip=gltf.animations.find(c=>c.name==='door_open_inside');this.action=this.mixer.clipAction(this.clip).play();this.action.setLoop(THREE.LoopOnce,1);this.action.clampWhenFinished=true;
    this.camera.position.set(.95,.72,-1.95);this.camera.lookAt(.16,.16,0);
   }else{
    const texture=await this.face(kind);if(generation!==this.generation){texture.image?.close?.();texture.dispose();return false;}this.expressionTexture?.image?.close?.();this.expressionTexture?.dispose();this.expressionMaterial?.dispose();this.expressionTexture=texture;
    this.model.traverse(n=>{if(n.isMesh){if(/^(Aura|Super|Ray)/.test(n.name))n.visible=false;if(n.name==='Body'){n.material=n.material.clone();this.expressionMaterial=n.material;n.material.map=texture;n.material.needsUpdate=true;}}});
    const gltfRoot=find(this.model,'CharacterRoot');this.root=gltfRoot||this.model;this.restPosition=this.root.position.clone();this.restRotation=this.root.quaternion.clone();
    // The published actor's facing frame converts the native +X face to +Z.
    this.clip=gltf.animations.find(c=>c.name==='idle');this.action=this.mixer.clipAction(this.clip).play();this.action.setLoop(THREE.LoopOnce,1);this.action.clampWhenFinished=true;this.action.time=0;this.mixer.update(0);
    const bounds=new THREE.Box3().setFromObject(find(this.model,'Body'));this.center=bounds.getCenter(new THREE.Vector3());this.camera.position.copy(this.center).add(new THREE.Vector3(0,.05,kind==='win'?1.28:1.2));this.camera.lookAt(this.center.clone().add(new THREE.Vector3(0,kind==='win'?-.02:-.07,0)));
   }
   this.resizeObserver??=new ResizeObserver(()=>this.render());this.resizeObserver.observe(this.container);this.status.hidden=true;this.ready=true;this.sample();this.render();return true;
  }catch(error){if(generation!==this.generation)return false;this.status.hidden=false;this.status.querySelector('span').textContent='カットインを読み込めませんでした。';this.status.querySelector('button').hidden=false;this.onError(error);return false;}
 }
 sample(){
  const t=this.elapsed;if(this.kind==='departure'){
   const pose=sampleDeparture(this.elapsed);this.action.time=pose.clipTime;this.mixer.update(0);if(pose.walking)this.root.position.fromArray(pose.position);
  }else{
   this.action.time=0;this.mixer.update(0);this.root.position.copy(this.restPosition);this.root.quaternion.copy(this.restRotation);
   if(this.kind==='win'){const pose=sampleVictory(t);this.root.position.y+=pose.height;this.root.rotateZ(pose.tilt);}
   else{const bow=smooth(t/.7);this.root.rotateZ(-.16*bow);this.root.rotateX(.025*Math.sin(t*4)*bow);this.root.position.y-=.009*bow;}
  }
  this.scene.updateMatrixWorld(true);
 }
 advance(dt){if(!this.active||!this.ready||this.contextLost)return;this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,dt));this.sample();this.render();if(this.elapsed>=this.duration){this.active=false;this.onComplete(this.kind);}}
 render(){if(!this.ready||!this.active||!this.renderer||this.contextLost)return;const rect=this.container.getBoundingClientRect();if(rect.width<1)return;this.renderer.setSize(Math.round(rect.width),Math.round(rect.height),false);this.camera.aspect=rect.width/rect.height;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);this.renderer.domElement.style.visibility='visible';}
 recoverAfterInterruption(){
  if(this.recoveryPromise)return this.recoveryPromise;
  if(!this.active||this.destroyed)return Promise.resolve(false);
  const kind=this.kind,resumeState={elapsed:this.elapsed,duration:this.duration};
  this.recoveryPromise=(async()=>{
   let timer,generation;
   try{
    this.generation++;this.ready=false;this.mixer?.stopAllAction();this.releaseRenderer();this.contextLost=false;
    const playing=this.play(kind,{resumeState});generation=this.generation;
    const ready=await Promise.race([playing,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('カットインの復旧に時間がかかっています。もう一度続けてください。')),12000);})]);
    if(!ready||!this.active||this.destroyed||generation!==this.generation)return false;
    if(this.renderer?.getContext?.().isContextLost?.())throw new Error('カットインの3D表示を復旧できませんでした。');
    return true;
   }catch(error){if(!this.destroyed&&(generation===undefined||generation===this.generation)){this.generation++;this.ready=false;this.status.hidden=false;this.status.querySelector('span').textContent='カットインを復旧できませんでした。';this.onError(error);}return false;}
   finally{clearTimeout(timer);}
  })().finally(()=>{this.recoveryPromise=null;});
  return this.recoveryPromise;
 }
 releaseRenderer(){this.resizeObserver?.disconnect();this.resizeObserver=null;for(const off of this.contextListeners)off();this.contextListeners=[];this.contextEvents=false;const renderer=this.renderer;this.renderer=null;renderer?.domElement.remove();if(renderer){try{renderer.dispose();}catch{}try{renderer.forceContextLoss?.();}catch{}}}
 stop(){this.active=false;this.ready=false;this.generation++;this.container.remove();this.mixer?.stopAllAction();}
 destroy(){this.destroyed=true;this.stop();this.releaseRenderer();this.expressionTexture?.image?.close?.();this.expressionTexture?.dispose();this.expressionMaterial?.dispose();}
}
