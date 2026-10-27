import { classifyOutgoingRoads } from './patrol-branches.js';
import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { loadAssetJson, loadGLTFAsset } from './asset-store.js';
import { getRegionAt } from './patrol-map.js';
import { EggplantThrow } from './eggplant-throw.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const regionNames={city:'都市部',residential:'住宅街',forest:'森林'};
const timeNames={morning:'朝',day:'昼',night:'夜'};
const directions=['left','front','right'];
const surfaceHeight=value=>Number.isFinite(Number(value))?Number(value):.0145;

/** Perspective patrol presentation. Progress belongs to PatrolState/PatrolUI;
 * this view never advances the game, even while assets are being loaded. */
export class PatrolView {
 constructor({container,isSupportEquipped=()=>true,isPaused=()=>false,onStatus=()=>{},onError=()=>{}}={}){
  if(!container)throw new TypeError('道中3Dビューの表示先がありません。');
  Object.assign(this,{container,isSupportEquipped,isPaused,onStatus,onError});
  this.ready=false;this.loading=false;this.failed=false;this.active=true;this.destroyed=false;this.contextLost=false;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#dce9ec');this.scene.fog=new THREE.Fog('#dce9ec',17,48);
  this.camera=new THREE.PerspectiveCamera(45,1,.025,100);
  this.cameraBasePosition=new THREE.Vector3(0,.88,1.35);this.cameraBaseTarget=new THREE.Vector3(0,.3,-3.7);this.camera.position.copy(this.cameraBasePosition);this.camera.lookAt(this.cameraBaseTarget);
  this.hemi=new THREE.HemisphereLight('#f4f5ec','#93918a',2.4);this.scene.add(this.hemi);
  this.sun=new THREE.DirectionalLight('#fff5df',2.8);this.sun.position.set(-3,9,4);this.scene.add(this.sun);
  this.loader=new GLTFLoader();this.models=new Map();this.modelPromises=new Map();this.listeners=[];
  this.baseUrl=new URL('./assets/patrol3d/',import.meta.url);this.renderFrames=0;this.raf=0;this.dirty=true;
  this.state={snapshot:null,progress:0,timeOfDay:'day'};this.requestedKey=null;this.variant=null;this.animationTime=0;this.lastSignature=null;this.eggplantReady=false;this.flightLastFrame=0;
 }
 async load(){
  if(this.initialPromise)return this.initialPromise;
  this.initialPromise=this.initialize();return this.initialPromise;
 }
 async initialize(){
  this.loading=true;this.onStatus('道中の3Dモデルを読み込んでいます…');
  try{
   this.createRenderer();
   const [manifest,actorMeta,eggplantMeta,tomatoMeta]=await Promise.all([
    this.fetchJson(new URL('manifest.json',this.baseUrl)),
    this.fetchJson(new URL('actors.json',this.baseUrl)),
    this.fetchJson(new URL('eggplant.json',this.baseUrl)),this.fetchJson(new URL('tomato.json',this.baseUrl))
   ]);
   if(this.destroyed)return false;
   this.manifest=manifest;this.actorMetadata=actorMeta;this.eggplantMetadata=eggplantMeta;
   const actorUrl=new URL(actorMeta.url||'actors.glb',this.baseUrl);if(actorMeta.sha256)actorUrl.searchParams.set('v',actorMeta.sha256);
   const gltf=await loadGLTFAsset(this.loader,actorUrl.href);
   if(this.destroyed){this.disposeObject(gltf.scene);return false;}
   this.actors=gltf.scene;this.actorRoot=new THREE.Group();this.actorRoot.name='Patrol.Characters';this.actorRoot.add(this.actors);this.scene.add(this.actorRoot);
   this.actorRoot.rotation.y=Number.isFinite(actorMeta.rendererRotationYRadians)?actorMeta.rendererRotationYRadians:Math.PI/2;this.roadSurfaceY=surfaceHeight(this.manifest.roadSurfaceY);this.actorRoot.position.set(0,this.roadSurfaceY,-.8);
   this.createContactShadows();
   this.actors.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;}});
   this.actorClips=gltf.animations;this.actorClip=gltf.animations.find(c=>c.name===(actorMeta.clipName||'patrol_walk'))||gltf.animations[0]||null;
   if(this.actorClip){this.mixer=new THREE.AnimationMixer(this.actors);this.actorAction=this.mixer.clipAction(this.actorClip);this.actorAction.play();this.mixer.update(0);}
   const eggplantUrl=new URL(eggplantMeta.url||'eggplant.glb',this.baseUrl);if(eggplantMeta.sha256)eggplantUrl.searchParams.set('v',eggplantMeta.sha256);
   const eggplantGltf=await loadGLTFAsset(this.loader,eggplantUrl.href);
   if(this.destroyed){this.disposeObject(eggplantGltf.scene);return false;}
   this.eggplantSource=eggplantGltf.scene;this.eggplantClips=eggplantGltf.animations;
   this.eggplantThrow=new EggplantThrow({model:eggplantGltf.scene,metadata:eggplantMeta,scene:this.scene});this.eggplantReady=true;const tomatoUrl=new URL(tomatoMeta.url,this.baseUrl);tomatoUrl.searchParams.set('v',tomatoMeta.sha256);const tomato=await loadGLTFAsset(this.loader,tomatoUrl.href);this.tomatoSource=tomato.scene;this.tomatoThrow=new EggplantThrow({model:tomato.scene,metadata:tomatoMeta,scene:this.scene});this.tomatoThrow.group.name='Patrol.TomatoFairy';this.tomatoReady=true;
   this.actorsReady=true;
   // A preview selector may change while the initial model is in flight.
   // Resolve initialization only after the latest requested view is ready.
   while(!this.destroyed){
    const desired=this.describeState();
    await this.ensureVariant(desired);
    if(this.destroyed)return false;
    if(this.failed&&this.requestedKey===desired.key)return false;
    if(this.variant?.key===this.describeState().key&&!this.loading)return true;
   }
   return false;
  }catch(error){if(!this.destroyed)this.fail(error);return false;}
 }
 async fetchJson(url){return loadAssetJson(url);}
 createRenderer(){
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{throw new Error('この端末では道中の3D表示を開始できませんでした。');}
  this.previousFrame=new THREE.WebGLRenderTarget(1,1);this.currentFrame=new THREE.WebGLRenderTarget(1,1);
  this.blendScene=new THREE.Scene();this.blendCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.blendMaterial=new THREE.ShaderMaterial({uniforms:{previous:{value:this.previousFrame.texture},current:{value:this.currentFrame.texture},blend:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D previous;uniform sampler2D current;uniform float blend;varying vec2 vUv;void main(){gl_FragColor=mix(texture2D(previous,vUv),texture2D(current,vUv),blend);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',depthTest:false,depthWrite:false});
  this.blendQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.blendMaterial);this.blendScene.add(this.blendQuad);
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  this.canvas=this.renderer.domElement;this.canvas.className='patrol-webgl';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','奥に向かって進む道中の3Dビュー');
  Object.assign(this.canvas.style,{display:'block',width:'100%',height:'100%'});this.container.append(this.canvas);
  const listen=(target,event,handler)=>{target.addEventListener(event,handler);this.listeners.push(()=>target.removeEventListener(event,handler));};
  listen(this.canvas,'webglcontextlost',event=>{event.preventDefault();this.contextLost=true;this.onStatus('道中の3D表示を復旧しています…');});
  listen(this.canvas,'webglcontextrestored',()=>{this.contextLost=false;this.onStatus('');this.resize();this.invalidate();});
  listen(document,'visibilitychange',()=>{this.flightLastFrame=0;if(!document.hidden)this.invalidate();});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.container);this.resize();
 }
 createContactShadows(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(16,16,1,16,16,16);gradient.addColorStop(0,'rgba(52,44,36,.24)');gradient.addColorStop(.45,'rgba(52,44,36,.14)');gradient.addColorStop(1,'rgba(52,44,36,0)');context.fillStyle=gradient;context.fillRect(0,0,32,32);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  this.contactShadows=new THREE.Group();this.contactShadows.name='Patrol.ContactShadows';
  for(const [x,z,width,depth]of [[0,-.8,.35,.25],[.24,-.38,.21,.15]]){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,this.roadSurfaceY+.0015,z);this.contactShadows.add(mesh);
  }
  this.scene.add(this.contactShadows);
 }
 setState(next={}){
  if(this.destroyed)return false;
  const oldLeg=this.eggplantLegKey,oldTime=this.state.timeOfDay;
  this.state={...this.state,...next,progress:clamp(Number(next.progress??this.state.progress)||0,0,1)};
  if(!['morning','day','night'].includes(this.state.timeOfDay))this.state.timeOfDay='day';
  const description=this.describeState(),s=this.state.snapshot;
  const legKey=s?[s.current,s.next,s.moves].join('|'):null;
  if(oldLeg!==undefined&&oldLeg!==legKey){this.cancelEggplantThrow();this.beginSceneryTransition();}
  if(oldTime!==this.state.timeOfDay)this.beginSceneryTransition();
  this.eggplantLegKey=legKey;
  const signature=[description.key,description.timeOfDay,s?.current,s?.next,s?.moves,s?.phase,this.state.progress.toFixed(6),description.branches.join(),s?.decision?.blockedNodeId,this.state.turn?.direction,this.state.turn?.progress].join('|');
  if(signature===this.lastSignature)return true;this.lastSignature=signature;
  this.description=description;
  if(this.actorsReady)this.ensureVariant(description);
  this.applyState();this.invalidate();return true;
 }
 describeState(){
  const {snapshot:s,progress:p}=this.state;
  const byId=new Map((s?.map?.nodes||[]).map(node=>[node.id,node]));
  const from=byId.get(s?.current),to=byId.get(s?.next)||from;
  const point=from&&to?{x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p}:{x:.5,y:.5};
  const region=regionNames[this.state.region]?this.state.region:getRegionAt(point);
  const atNode=s&&(!s.next||s.phase==='battle');
  const kind=['road','junction'].includes(this.state.kind)?this.state.kind:'junction';
  const timeOfDay=this.state.timeOfDay;
  const branches=Array.isArray(this.state.branchDirections)?directions.filter(d=>this.state.branchDirections.includes(d)):this.outgoingDirections(s,byId);
  return {key:`${region}_${timeOfDay==='night'?'day':timeOfDay}_${kind}`,region,kind,timeOfDay,branches,point};
 }
 outgoingDirections(s,byId){
  if(!s)return ['left','front','right'];
  const junction=s.next||s.current,incoming=s.next?s.current:s.previous;
  const from=byId.get(incoming),at=byId.get(junction);if(!from||!at)return ['front'];
  const neighboring=(s.map?.edges||[]).flatMap(([a,b])=>a===junction?[b]:b===junction?[a]:[]).filter(id=>id!==incoming);
  const roads=neighboring.map(id=>byId.get(id));
  return classifyOutgoingRoads({incoming:from,junction:at,roads}).map(road=>road.direction);
 }
 async ensureVariant(description){
  if(this.destroyed||!this.manifest||!this.actorsReady)return false;
  const key=description.key;
  this.requestedKey=key;
  if(this.variant?.key===key){const wasLoading=this.loading||this.failed;this.loading=false;this.ready=true;this.failed=false;this.lastError=null;this.applyState();if(wasLoading)this.onStatus('');return true;}
  if(this.models.has(key)){this.activateVariant(key,this.models.get(key));return true;}
  this.loading=true;this.onStatus('道中の景色を読み込んでいます…');
  if(!this.modelPromises.has(key)){
   const record=(this.manifest.models||[]).find(model=>model.id===key||`${model.region}_${model.timeOfDay}_${model.kind}`===key);
   if(!record){this.fail(new Error('指定された道中モデルが見つかりません。'));return false;}
   const url=new URL(record.url||`${key}.glb`,this.baseUrl);if(record.sha256)url.searchParams.set('v',record.sha256);
   const promise=loadGLTFAsset(this.loader,url.href).then(gltf=>{
    if(this.destroyed){this.disposeObject(gltf.scene);return null;}
    const model={scene:gltf.scene,record};model.scene.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;}});this.models.set(key,model);return model;
   }).catch(error=>{this.modelPromises.delete(key);throw error;});
   this.modelPromises.set(key,promise);
  }
  try{const model=await this.modelPromises.get(key);if(model&&!this.destroyed&&this.requestedKey===key)this.activateVariant(key,model);return Boolean(model);}
  catch(error){if(!this.destroyed&&this.requestedKey===key)this.fail(error);return false;}
 }
 activateVariant(key,model){
  if(this.variant?.key!==key)this.beginSceneryTransition();
  if(this.variant?.scene)this.scene.remove(this.variant.scene);
  this.variant={key,...model};this.scene.add(model.scene);
  this.roadSurfaceY=surfaceHeight(model.record.roadSurfaceY??this.manifest.roadSurfaceY);this.actorRoot.position.y=this.roadSurfaceY;
  for(const shadow of this.contactShadows?.children||[])shadow.position.y=this.roadSurfaceY+.0015;
  const a=model.record.atmosphere||{},morning=model.record.timeOfDay==='morning',fog=a.fogColor||(morning?'#f4dfc7':'#dce9ec');
  this.scene.background.set(a.background||fog);this.scene.fog.color.set(fog);this.scene.fog.near=Number(a.fogNear)||17;this.scene.fog.far=Number(a.fogFar)||48;
  this.hemi.intensity=Number(a.ambient)||2.4;this.hemi.color.set(morning?'#ffead3':'#f4f5ec');this.sun.color.set(a.sunColor||(morning?'#ffd9aa':'#fff5df'));this.sun.intensity=Number(a.sunIntensity)||2.8;this.sun.position.fromArray(a.sunPosition||[-3,9,4]);
  this.loading=false;this.failed=false;this.lastError=null;this.ready=true;this.applyState();this.onStatus('');this.invalidate();
 }
 applyState(){
  if(!this.actorsReady)return;
  const description=this.description||this.describeState(),s=this.state.snapshot,p=this.state.progress;
  // Both models share the same incoming road. Translation remains continuous
  // at the road/junction threshold; a full graph-edge traversal is 11.2m here.
  if(this.variant){
   const atNode=!s?.next||s?.phase==='battle';this.variant.scene.position.z=atNode?11.2:p*11.2;
   this.variant.scene.traverse(object=>{
    const name=(object.userData?.name||object.name).replaceAll('.','');
    const direction=object.userData?.branch_direction||directions.find(d=>name===`Branch${d}`);
    if(direction)object.visible=description.branches.includes(direction);
   });
  }
  if(description.timeOfDay==='night'){this.scene.background.set('#131e34');this.scene.fog.color.set('#131e34');this.hemi.intensity=.65;this.sun.intensity=.7;this.sun.color.set('#b4c9ff');}else if(this.variant){const a=this.variant.record.atmosphere||{};this.scene.background.set(a.background||'#dce9ec');this.scene.fog.color.set(a.fogColor||'#dce9ec');this.hemi.intensity=a.ambient||2.4;this.sun.intensity=a.sunIntensity||2.8;this.sun.color.set(a.sunColor||'#fff5df');}
  const turn=this.state.turn,t=clamp(Number(turn?.progress)||0,0,1),angle=(turn?.direction==='left'?1:turn?.direction==='right'?-1:0)*Math.PI/2*t*t*(3-2*t);
  const pivot=new THREE.Vector3(0,this.roadSurfaceY,-.8),axis=new THREE.Vector3(0,1,0);
  this.actorRoot.rotation.y=(this.actorMetadata?.rendererRotationYRadians??Math.PI/2)+angle;
  this.camera.position.copy(this.cameraBasePosition).sub(pivot).applyAxisAngle(axis,angle).add(pivot);
  this.camera.lookAt(this.cameraBaseTarget.clone().sub(pivot).applyAxisAngle(axis,angle).add(pivot));
  if(this.contactShadows){this.contactShadows.rotation.y=angle;this.contactShadows.position.copy(pivot).sub(pivot.clone().applyAxisAngle(axis,angle));}
  const totalProgress=(Number(s?.moves)||0)+p;
  this.animationTime=totalProgress*8;
  if(this.mixer){this.mixer.setTime(this.animationTime);this.actors.updateMatrixWorld(true);}
  if(this.canvas)this.canvas.setAttribute('aria-label',`${timeNames[description.timeOfDay]}の${regionNames[description.region]}、${description.kind==='junction'?'交差点':'道'}を奥へ進むおこていゆとモアイくん`);
 }
 fail(error){this.failed=true;this.loading=false;this.ready=false;this.lastError=error instanceof Error?error.message:String(error);this.onStatus('');this.onError(error);}
 resize(){
  if(!this.renderer||this.destroyed)return;const r=this.container.getBoundingClientRect();if(r.width<1||r.height<1)return;
  this.width=Math.round(r.width);this.height=Math.round(r.height);this.renderer.setSize(this.width,this.height,false);const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.previousFrame?.setSize(size.x,size.y);this.currentFrame?.setSize(size.x,size.y);this.sceneryTransition=null;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.invalidate();
 }
 invalidate(){this.dirty=true;if(!this.raf&&this.active&&!this.destroyed&&!document.hidden)this.raf=requestAnimationFrame(time=>this.frame(time));}
 frame(time){
  this.raf=0;if(!this.active||this.destroyed||document.hidden){this.flightLastFrame=0;return;}
  const dt=this.flightLastFrame?Math.min(.1,Math.max(0,(time-this.flightLastFrame)/1000)):0;this.flightLastFrame=time;
  if(this.eggplantBusy&&!this.isPaused()&&!this.loading&&!this.failed&&!this.contextLost){if(this.eggplantThrow?.update(dt)||this.tomatoThrow?.update(dt))this.dirty=true;}
  if(this.sceneryTransition&&!this.isPaused()&&!this.loading&&!this.failed&&!this.contextLost){this.sceneryTransition.elapsed+=dt;this.dirty=true;if(this.sceneryTransition.elapsed>=this.sceneryTransition.duration)this.sceneryTransition=null;}
  this.render();
  if(this.eggplantBusy||this.sceneryTransition){if(!this.raf)this.raf=requestAnimationFrame(next=>this.frame(next));}else this.flightLastFrame=0;
 }
 get eggplantBusy(){return Boolean(this.eggplantThrow?.busy||this.tomatoThrow?.busy);}
 canThrowEggplant(direction){const branches=this.describeState().branches;return this.eggplantReady&&this.ready&&!this.loading&&!this.failed&&!this.destroyed&&this.active&&!this.contextLost&&!document.hidden&&!this.isPaused()&&!this.eggplantBusy&&branches.length>=2&&branches.includes(direction);}
 throwEggplant(direction,{onComplete,preview=false}={}){
  const allowed=preview?this.eggplantReady&&this.ready&&!this.loading&&!this.failed&&!this.destroyed&&this.active&&!this.contextLost&&!document.hidden&&!this.eggplantBusy&&this.describeState().branches.includes(direction):this.canThrowEggplant(direction);
  if(!allowed)return false;
  const s=this.state.snapshot;this.eggplantLegKey=s?[s.current,s.next,s.moves].join('|'):null;
  const junctionZ=-12+(this.variant?.scene.position.z||0);
  if(!this.eggplantThrow.start(direction,{junctionZ,surfaceY:this.roadSurfaceY,onComplete}))return false;
  this.flightLastFrame=0;this.invalidate();return true;
 }
 throwTomato(direction,{onComplete}={}){
  if(!this.tomatoReady||!this.canThrowEggplant(direction))return false;const s=this.state.snapshot;this.eggplantLegKey=s?[s.current,s.next,s.moves].join('|'):null;
  const junctionZ=-12+(this.variant?.scene.position.z||0);if(!this.tomatoThrow.start(direction,{junctionZ,surfaceY:this.roadSurfaceY,onComplete}))return false;this.flightLastFrame=0;this.invalidate();return true;
 }
 setEggplantThrowProgress(progress){if(!this.eggplantThrow?.seek(progress))return false;this.flightLastFrame=0;this.invalidate();return true;}
 cancelEggplantThrow(){this.eggplantThrow?.cancel();this.tomatoThrow?.cancel();this.eggplantLegKey=undefined;this.flightLastFrame=0;this.invalidate();return true;}

 beginSceneryTransition(){
  if(!this.renderer||!this.ready||!this.renderFrames||this.sceneryTransition)return;
  [this.previousFrame,this.currentFrame]=[this.currentFrame,this.previousFrame];
  this.sceneryTransition={elapsed:0,duration:.9};this.flightLastFrame=0;this.invalidate();
 }
 render(){
  if(this.actors){const toy=this.actors.getObjectByName(this.actorMetadata?.roots?.moaiKun||'MoaiKunRoot');if(toy)toy.visible=this.isSupportEquipped();if(this.contactShadows?.children[1])this.contactShadows.children[1].visible=this.isSupportEquipped();}
  if(!this.dirty||!this.renderer||!this.ready||!this.active||this.contextLost||this.destroyed||document.hidden)return;
  this.renderer.setRenderTarget(this.currentFrame);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);
  this.blendMaterial.uniforms.previous.value=this.previousFrame.texture;this.blendMaterial.uniforms.current.value=this.currentFrame.texture;
  const t=this.sceneryTransition?clamp(this.sceneryTransition.elapsed/this.sceneryTransition.duration,0,1):1;
  this.blendMaterial.uniforms.blend.value=t*t*(3-2*t);this.renderer.render(this.blendScene,this.blendCamera);this.renderFrames++;this.dirty=false;
 }
 setActive(active){this.active=Boolean(active);if(!this.active)this.cancelEggplantThrow();this.flightLastFrame=0;if(!this.active){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;}else{this.resize();this.invalidate();}return this.active;}
 getDiagnostics(){
  const description=this.description||this.describeState();let meshes=0;const visibleBranches=[];this.variant?.scene.traverse(o=>{if(o.isMesh)meshes++;if(o.userData?.branch_direction&&o.visible)visibleBranches.push(o.userData.branch_direction);});
  return {sceneryTransition:this.sceneryTransition?{...this.sceneryTransition}:null,turn:this.state.turn||null,actorYaw:this.actorRoot?.rotation.y??null,tomato:this.tomatoThrow?.getDiagnostics()||{ready:false,busy:false,visible:false},eggplant:this.eggplantThrow?.getDiagnostics()||{ready:false,busy:false,visible:false},ready:this.ready,loading:this.loading,failed:this.failed,active:this.active,paused:Boolean(this.isPaused()),contextLost:this.contextLost,error:this.lastError||null,variant:this.variant?.key||null,requestedVariant:this.requestedKey,region:description.region,kind:description.kind,timeOfDay:description.timeOfDay,coordinate:description.point,branchDirections:description.branches,visibleBranches:[...new Set(visibleBranches)],meshCount:meshes,modelBounds:this.variant?.record.bounds||null,manifestModelCount:this.manifest?.models?.length||0,cachedVariants:[...this.models.keys()],actorAnimation:this.actorClip?.name||null,animationTime:this.animationTime,progress:this.state.progress,environmentOffsetZ:this.variant?.scene.position.z||0,cameraPosition:this.camera.position.toArray(),actorPosition:this.actorRoot?.position.toArray()||null,fog:{near:this.scene.fog.near,far:this.scene.fog.far},renderFrames:this.renderFrames,size:{width:this.width||0,height:this.height||0,pixelRatio:this.renderer?.getPixelRatio()||1},renderInfo:this.renderer?{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures}:null};
 }
 disposeObject(object){
  const geometries=new Set(),materials=new Set(),textures=new Set();object?.traverse(child=>{if(child.geometry)geometries.add(child.geometry);for(const material of Array.isArray(child.material)?child.material:[child.material])if(material){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const texture of textures)texture.dispose();for(const material of materials)material.dispose();for(const geometry of geometries)geometry.dispose();
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;this.setActive(false);this.resizeObserver?.disconnect();for(const unbind of this.listeners)unbind();this.previousFrame?.dispose();this.currentFrame?.dispose();this.blendMaterial?.dispose();this.blendQuad?.geometry.dispose();this.mixer?.stopAllAction();for(const model of this.models.values())this.disposeObject(model.scene);this.models.clear();if(this.actors)this.disposeObject(this.actors);if(this.contactShadows)this.disposeObject(this.contactShadows);this.eggplantThrow?.destroy();this.tomatoThrow?.destroy();if(this.tomatoSource)this.disposeObject(this.tomatoSource);if(this.eggplantSource)this.disposeObject(this.eggplantSource);this.eggplantReady=false;this.scene.clear();this.renderer?.dispose();this.canvas?.remove();this.ready=false;}
}
