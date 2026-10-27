import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { loadAssetJson, loadGLTFAsset } from './asset-store.js';
import { HouseLifeDirector } from './house-life.js';
import { HOUSE_INSPECTIONS } from './house-inspections.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const radians=degrees=>degrees*Math.PI/180;
const vector=(value,fallback)=>new THREE.Vector3(...(Array.isArray(value)&&value.length===3?value:fallback));

/** A reusable WebGL view. Asset URLs are relative to the caller's document/base. */
export class HouseView {
 constructor({container,assetUrl,metadataUrl,onStatus=()=>{},onError=()=>{},isPaused=()=>false,isSimulationPaused=isPaused,enableInteraction=false,onInteractionChange=()=>{},onInspect=()=>{},getInspectionInsets=()=>({}),onLifeEvent=()=>{},onLifeStateChange=()=>{},canExecuteAction=()=>true,rng=Math.random}={}) {
  if(!container)throw new TypeError('3Dビューの表示先がありません。');
  Object.assign(this,{container,assetUrl,metadataUrl,onStatus,onError,isPaused,isSimulationPaused,enableInteraction,onInteractionChange,onInspect,getInspectionInsets,onLifeEvent,onLifeStateChange,canExecuteAction,rng});
  this.mode=enableInteraction?'follow':'viewing';this.active=true;this.ready=false;this.destroyed=false;this.contextLost=false;
  this.sceneMode='room';this.cameraTransition=null;this.roomCameraState=null;this.characterMeshes=[];this.pickMeshes=[];
  this.inspection=null;this.inspectionNarrationPending=false;
  this.worldUpdatePending=0;this.sceneRevision=0;this.inspectionDefinitions=HOUSE_INSPECTIONS;this.updateQueue=Promise.resolve();
  this.raycaster=new THREE.Raycaster();this.cameraAim=new THREE.Vector3();this.interactionAim=new THREE.Vector3();
  this.interactionOffset=new THREE.Vector3(1,.17,0);this.lastCollisionTarget=new THREE.Vector3(Infinity,Infinity,Infinity);this.interactionBearing=new THREE.Vector3(0,0,1);this.collisionElapsed=0;
  this.lastFrame=0;this.elapsed=0;this.renderFrames=0;this.lastError=null;this.pointers=new Map();this.raf=0;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#f4f3e6');
  this.camera=new THREE.PerspectiveCamera(48,1,.025,60);
  this.renderer=null;this.model=null;this.mixer=null;this.targetNode=null;this.wallObjects=[];
  this.entrancePivot=new THREE.Vector3(0,.8,0);this.entranceEye=new THREE.Vector3(0,1.2,.18);
  this.lookAt=new THREE.Vector3(0,1,-2.7);this.followTarget=new THREE.Vector3();this.targetCenter=new THREE.Vector3();
  this.targetOffset=new THREE.Vector3(.012,.166,0);this.targetHeight=.45;
  this.viewing={yaw:radians(47),pitch:radians(29),radius:4.65,fov:48};
  this.initialViewing={...this.viewing};this.wallGroups={};this.yawLimits=[radians(-65),radians(65)];
  this.listeners=[];
 }
 async load() {
  if(this.loading)return this.loading;
  this.loading=this.loadScene();return this.loading;
 }
 async loadScene() {
  this.onStatus('おこていゆハウスを読み込んでいます…');
  try {
   this.createRenderer();
   const metadata=this.metadataUrl?await loadAssetJson(this.metadataUrl):{};
   const loader=new GLTFLoader();
   const assetUrl=new URL(this.assetUrl,document.baseURI);
   const revision=metadata.glbSha256||metadata.sourceSha256;if(revision)assetUrl.searchParams.set('v',revision);
   const gltf=await loadGLTFAsset(loader,assetUrl.href,{onProgress:event=>{if(event.total)this.onStatus(`おこていゆハウスを読み込んでいます… ${Math.round(event.loaded/event.total*100)}%`);}});
   if(this.destroyed){this.disposeObject(gltf.scene);return false;}
   this.metadata=metadata;this.model=gltf.scene;this.scene.add(this.model);
   this.configureMetadata(metadata);
   this.scene.add(new THREE.HemisphereLight(0xfff8df,0xa4b9b5,2));
   const key=new THREE.DirectionalLight(0xfff3dc,2.7);key.position.set(-1.5,5,2);this.scene.add(key);
   const fill=new THREE.DirectionalLight(0xe8f0ff,1);fill.position.set(3,2,-4);this.scene.add(fill);
   this.clips=gltf.animations;
   const desiredName=metadata.animation?.clipName||metadata.animation?.name;
   this.clip=gltf.animations.find(clip=>clip.name===desiredName)||gltf.animations[0]||null;
   if(this.clip){
    this.mixer=new THREE.AnimationMixer(this.model);
    if(metadata.life||metadata.autonomousLife)this.life=new HouseLifeDirector({model:this.model,mixer:this.mixer,clips:gltf.animations,metadata,findNode:name=>this.findNode(name),canExecuteAction:(kind,context)=>this.canExecuteAction(kind,context),rng:()=>this.rng(),onEvent:event=>this.onLifeEvent(event),onClipChange:(clip,action)=>{this.clip=clip;this.action=action;}});
    else{this.action=this.mixer.clipAction(this.clip);this.action.play();this.mixer.update(0);}
   }
   this.model.updateMatrixWorld(true);
   this.updateTarget();this.followTarget.copy(this.targetCenter);
   this.ready=true;this.resize();this.applyCamera(0,true);this.applyCutaway();this.render();
   this.canvas.setAttribute('aria-label',this.mode==='follow'?'おこていゆハウスの追従モード。入口から見守ります。おこていゆをタップで詳細観測モード。':'おこていゆハウスのビューイングモード。ドラッグで回転、ピンチで拡大。');
   this.onStatus('');if(this.active)this.schedule();return true;
  } catch(error) {
   if(this.destroyed)return false;
   this.lastError=error instanceof Error?error.message:String(error);this.onStatus('');this.onError(error);return false;
  }
 }
 createRenderer() {
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{throw new Error('この端末では3D表示を開始できませんでした。WebGLが使えるブラウザでお試しください。');}
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  this.canvas=this.renderer.domElement;this.canvas.className='house-webgl';this.canvas.tabIndex=0;
  this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','おこていゆハウスの3Dビュー。ドラッグで回転、ピンチまたはホイールで拡大縮小。');
  Object.assign(this.canvas.style,{display:'block',width:'100%',height:'100%',touchAction:'none',outlineOffset:'-3px'});
  this.container.append(this.canvas);
  const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);this.listeners.push(()=>target.removeEventListener(type,handler,options));};
  listen(this.canvas,'pointerdown',event=>this.pointerDown(event));
  listen(this.canvas,'pointermove',event=>this.pointerMove(event));
  listen(this.canvas,'pointerup',event=>this.pointerUp(event));
  listen(this.canvas,'pointercancel',event=>this.pointerUp(event,true));
  listen(this.canvas,'lostpointercapture',event=>this.pointers.delete(event.pointerId));
  listen(this.canvas,'wheel',event=>{if(!this.canInteract())return;event.preventDefault();this.zoom(Math.exp(clamp(event.deltaY,-150,150)*.002));},{passive:false});
  listen(this.canvas,'keydown',event=>this.keyDown(event));
  listen(this.canvas,'webglcontextlost',event=>{event.preventDefault();this.contextLost=true;this.cancelPointers();this.onStatus('3D表示を復旧しています…');});
  listen(this.canvas,'webglcontextrestored',()=>{this.contextLost=false;this.resize();this.onStatus('');this.render();if(this.active)this.schedule();});
  listen(document,'visibilitychange',()=>{this.cancelPointers();this.lastFrame=0;if(!document.hidden&&this.active)this.schedule();});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.container);
 }
 configureMetadata(metadata) {
  this.pickMeshes=[];this.characterMeshes=[];
  this.yawLimits=(metadata.viewing?.yawLimits||[-65,65]).map(radians);
  this.entrancePivot.copy(vector(metadata.entrance?.pivot,[0,.8,0]));
  this.entranceEye.copy(vector(metadata.entrance?.eye,[0,1.2,.18]));
  this.lookAt.copy(vector(metadata.viewing?.lookAt,[0,1,-2.7]));
  this.targetOffset.copy(vector(metadata.target?.centerOffset,[.012,.166,0]));
  this.targetHeight=Number(metadata.target?.height)||.45;
  const targetName=metadata.target?.nodeName||'Visit.Okoteiyu.Body';
  this.targetNode=this.findNode(targetName);
  if(!this.targetNode)throw new Error('おこていゆの追従先を3Dモデルから取得できませんでした。');
  const start=vector(metadata.viewing?.position,[3,3,2.8]).sub(this.entrancePivot),spherical=new THREE.Spherical().setFromVector3(start);
  this.viewing={yaw:spherical.theta,pitch:Math.PI/2-spherical.phi,radius:spherical.radius,fov:Number(metadata.viewing?.fov)||48};
  this.initialViewing={...this.viewing};this.wallGroups=metadata.wallGroups||{};
  this.model.traverse(object=>{
   if(object.isMesh){object.frustumCulled=true;object.castShadow=false;object.receiveShadow=false;this.pickMeshes.push(object);const name=(object.userData?.name||object.name).replaceAll('.','');if(name.startsWith('VisitOkoteiyu')||name.startsWith('LifeOkoteiyu')||object.userData?.character_name==='おこていゆ')this.characterMeshes.push(object);}
   const role=object.userData?.house_role;
   if(role){const group=({wall_entry:'entry',ceiling:'ceiling',wall_right:'right',right_window:'right',wall_left:'left',wall_back:'back'})[role];if(group){this.wallGroups[group]??=[];if(!this.wallGroups[group].includes(object.name))this.wallGroups[group].push(object.name);}}
  });
  this.wallObjects=Object.entries(this.wallGroups).flatMap(([group,names])=>(Array.isArray(names)?names:[]).map(name=>({group,object:this.findNode(name)}))).filter(item=>item.object);
  if(!this.characterMeshes.includes(this.targetNode))this.characterMeshes.push(this.targetNode);
  this.characterMeshSet=new Set(this.characterMeshes);
  this.roomBounds=new THREE.Box3(vector(metadata.roomBounds?.min,[-2.72,-.1,-5.72]),vector(metadata.roomBounds?.max,[2.72,2.8,.15]));
 }
 findNode(name){let found=this.model.getObjectByName(name)||this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));if(!found)this.model.traverse(object=>{if(!found&&object.userData?.name===name)found=object;});return found;}
 canUseScene(){return this.ready&&this.active&&!this.destroyed&&!this.contextLost&&!this.worldUpdatePending&&!this.isPaused();}
 canInteract(){return this.canUseScene()&&this.sceneMode==='room'&&!this.cameraTransition&&this.mode==='viewing';}
 canTapScene(){return this.enableInteraction&&this.canUseScene()&&!this.cameraTransition&&Boolean(this.life||this.action?.isRunning());}
 canTapCharacter(){return this.canTapScene()&&this.sceneMode==='room';}
 pointerDown(event){
  if((!this.canInteract()&&!this.canTapScene())||(event.pointerType==='mouse'&&event.button!==0))return;
  event.preventDefault();this.canvas.focus({preventScroll:true});this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,time:performance.now(),moved:false,multiple:this.pointers.size>0});
  if(this.pointers.size>1)for(const point of this.pointers.values())point.multiple=true;
  try{this.canvas.setPointerCapture(event.pointerId);}catch{}
 }
 pointerMove(event){
  if(!this.pointers.has(event.pointerId))return;
  if(!this.canUseScene()){this.cancelPointers();return;}
  event.preventDefault();const previous=this.pointers.get(event.pointerId),before=[...this.pointers.values()];
  const point={...previous,x:event.clientX,y:event.clientY,moved:previous.moved||Math.hypot(event.clientX-previous.startX,event.clientY-previous.startY)>9};this.pointers.set(event.pointerId,point);
  if(!this.canInteract())return;
  if(this.pointers.size>1){const after=[...this.pointers.values()],oldDistance=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),newDistance=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);if(newDistance>2&&oldDistance>2)this.zoom(oldDistance/newDistance);}
  else if(point.moved){const bounds=this.canvas.getBoundingClientRect();this.rotate(-(event.clientX-previous.x)/Math.max(100,bounds.width)*2.5,(event.clientY-previous.y)/Math.max(100,bounds.height)*1.5);}
 }
 pointerUp(event,cancelled=false){const point=this.pointers.get(event.pointerId);this.pointers.delete(event.pointerId);try{if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);}catch{}if(point&&!cancelled&&!point.moved&&!point.multiple&&performance.now()-point.time<650&&Math.hypot(event.clientX-point.startX,event.clientY-point.startY)<=9&&this.canTapScene())this.tapScene(event.clientX,event.clientY);}
 cancelPointers(){for(const id of this.pointers.keys())try{if(this.canvas?.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}catch{}this.pointers.clear();}
 keyDown(event){
  if(!this.canInteract())return;
  const controls={ArrowLeft:()=>this.rotate(.1,0),ArrowRight:()=>this.rotate(-.1,0),ArrowUp:()=>this.rotate(0,.07),ArrowDown:()=>this.rotate(0,-.07),'+':()=>this.zoom(.9),'=':()=>this.zoom(.9),'-':()=>this.zoom(1.1)};
  if(controls[event.key]){event.preventDefault();controls[event.key]();}
 }
 rotate(yaw,pitch){this.viewing.yaw=clamp(this.viewing.yaw+yaw,...this.yawLimits);this.viewing.pitch=clamp(this.viewing.pitch+pitch,radians(10),radians(65));this.applyCamera(0,true);this.applyCutaway();this.render();}
 zoom(factor){this.viewing.radius=clamp(this.viewing.radius*factor,2,10);this.applyCamera(0,true);this.render();}
 setMode(mode){
  if(!['viewing','follow'].includes(mode))throw new RangeError('カメラモードが正しくありません。');
  if(!this.canUseScene()||this.sceneMode!=='room'||this.cameraTransition)return false;
  this.cancelPointers();this.mode=mode;this.updateTarget();this.followTarget.copy(this.targetCenter);this.applyCamera(0,true);this.applyCutaway();
  this.canvas.setAttribute('aria-label',mode==='viewing'?'おこていゆハウスの3Dビュー。ドラッグ・方向キーで回転、ピンチ・ホイール・プラスマイナスキーで拡大縮小。':'おこていゆハウスの3Dビュー。入口からおこていゆを自動で追従。');
  this.render();return true;
 }
 visibleMesh(object){for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;}
 nearestSceneHit(clientX,clientY){
  if(!this.ready)return null;
  const bounds=this.canvas.getBoundingClientRect();if(clientX<bounds.left||clientX>bounds.right||clientY<bounds.top||clientY>bounds.bottom)return false;
  this.raycaster.setFromCamera(new THREE.Vector2((clientX-bounds.left)/bounds.width*2-1,1-(clientY-bounds.top)/bounds.height*2),this.camera);
  const meshes=new Set(this.pickMeshes);
  for(const root of [...(this.life?.returnedFoodRoots||[]),...(this.life?.ownedTablePlates||[])])root.traverse(node=>{if(node.isMesh)meshes.add(node);});
  return this.raycaster.intersectObjects([...meshes].filter(object=>this.visibleMesh(object)),false)[0]||null;
 }
 pickCharacter(clientX,clientY){const hit=this.nearestSceneHit(clientX,clientY);return Boolean(hit&&this.characterMeshSet.has(hit.object));}
 inspectionBounds(root){
  const bounds=new THREE.Box3(),piece=new THREE.Box3();root.updateWorldMatrix(true,true);
  root.traverseVisible(node=>{if(!node.isMesh)return;const scale=node.getWorldScale(new THREE.Vector3());if(Math.min(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z))<1e-6)return;if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();piece.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);bounds.union(piece);});return bounds;
 }
 inspectionForHit(hit){
  if(!hit)return null;
  const ancestor=root=>{for(let node=hit.object;node;node=node.parent)if(node===root)return true;return false;};
  const companion=this.life?.companion;
  if(companion&&this.visibleMesh(companion)&&ancestor(companion)){
   const bounds=this.inspectionBounds(companion);
   if(!bounds.isEmpty())return {definition:(this.inspectionDefinitions||HOUSE_INSPECTIONS).find(d=>d.id==='moai_kun'),bounds,root:companion,front:new THREE.Vector3(1,.45,0).applyQuaternion(companion.getWorldQuaternion(new THREE.Quaternion())).toArray()};
  }
  // Table items include battle refills/returned portions; consumed items and
  // empty plates are excluded. Held food uses the same authored food root.
  const roots=(this.life?.tableItems||[]).filter(item=>item.amount>1e-5).map(item=>this.findNode(item.nodeName||'Life.TableFood.'+item.kind));
  if(this.life?.heldFood)roots.push(this.life.foodNodes.get(this.life.currentFood));
  const stockRoots=(this.life?.fridge?.stock||[]).map(item=>this.findNode(item.nodeName));roots.push(...stockRoots);
  const root=roots.find(node=>node&&this.visibleMesh(node)&&ancestor(node));
  if(root){const bounds=this.inspectionBounds(root);if(!bounds.isEmpty())return {definition:(this.inspectionDefinitions||HOUSE_INSPECTIONS).find(d=>d.id==='food'),bounds,root,front:stockRoots.includes(root)?[1,.6,0]:null};}
  const bedCloth=hit.object.name.startsWith('LifeBed')||hit.object.userData?.life_role==='half_body_blanket';
  for(const definition of (this.inspectionDefinitions||HOUSE_INSPECTIONS)){if(!definition.min)continue;const bounds=new THREE.Box3(new THREE.Vector3(...definition.min),new THREE.Vector3(...definition.max));const fridge=definition.id==='fridge'&&hit.object.userData?.house_role==='refrigerator';if(bounds.containsPoint(hit.point)||(definition.id==='bed'&&bedCloth)||fridge)return {definition,bounds};}
  return null;
 }
 tapScene(x,y){
  if(!this.canTapScene())return false;
  if(['interaction','inspection'].includes(this.sceneMode))return this.exitInteraction();
  const hit=this.nearestSceneHit(x,y);if(hit&&this.characterMeshSet.has(hit.object))return this.enterInteraction();
  const target=this.inspectionForHit(hit);return target?this.enterInspection(target):false;
 }

 enterInspection(target){
  if(!this.canTapCharacter()||!target?.definition)return false;
  this.cancelPointers();this.roomCameraState={mode:this.mode,viewing:{...this.viewing}};this.sceneMode='inspection';this.inspection=target;this.inspectionNarrationPending=true;
  this.canvas.setAttribute('aria-label',target.definition.label+'の詳細観測モード。ビュー内のどこでもタップ、または戻るボタンで部屋に戻ります。');this.beginCameraTransition();this.applyCutaway();return true;
 }
 updateInspectionCamera(){
  const target=this.inspection;if(!target)return;
  if(target.root&&this.visibleMesh(target.root)){const live=this.inspectionBounds(target.root);if(!live.isEmpty())target.bounds.copy(live);}
  const box=target.bounds.clone().expandByScalar(.025),aim=box.getCenter(new THREE.Vector3()),front=new THREE.Vector3(...(target.front||target.definition.front)).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),front).normalize(),up=new THREE.Vector3().crossVectors(front,right).normalize();
  const height=this.height||1,width=this.width||1,insets=this.getInspectionInsets(),top=clamp(insets.top??height*.21,0,height*.42),bottom=clamp(insets.bottom??height*.29,0,height*.36),available=Math.max(.18,1-(top+bottom)/height),tan=Math.tan(radians(42)/2);
  let distance=.28;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(aim);distance=Math.max(distance,p.dot(front)+Math.max(Math.abs(p.dot(right))/(tan*this.camera.aspect*.88),Math.abs(p.dot(up))/(tan*available*.88)));}
  this.camera.position.copy(aim).addScaledVector(front,distance);this.camera.fov=42;this.camera.lookAt(aim);this.cameraAim.copy(aim);
  this.camera.setViewOffset(width,height,0,(bottom-top)/2,width,height);
 }
 characterScreenPoint(){
  if(!this.ready||!this.canvas)return null;
  const bounds=this.canvas.getBoundingClientRect(),point=this.targetCenter.clone().project(this.camera);
  const x=bounds.left+(point.x+1)*bounds.width/2,y=bounds.top+(1-point.y)*bounds.height/2;
  const inFrustum=point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1;
  // Diagnostics are polled by hosts and tests. Do not retrace the entire room on
  // every poll; actual taps always perform a fresh occlusion check.
  if(this.sceneMode!=='room')return {x,y,visible:inFrustum};
  const now=performance.now();if(!this.screenPointCache||now-this.screenPointCache.time>250)this.screenPointCache={time:now,visible:inFrustum&&this.pickCharacter(x,y)};
  return {x,y,visible:inFrustum&&this.screenPointCache.visible};
 }
 beginCameraTransition(){
  this.cameraTransition={elapsed:0,duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:.65,position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),fov:this.camera.fov};
  this.onInteractionChange({sceneMode:this.sceneMode,transitioning:true,phase:'start'});
 }
 enterInteraction(){
  if(!this.canTapCharacter())return false;
  this.cancelPointers();this.roomCameraState={mode:this.mode,viewing:{...this.viewing}};
  this.sceneMode='interaction';this.updateTarget();this.interactionAim.copy(this.targetCenter);
  this.interactionBearing.copy(this.camera.position).sub(this.targetCenter);this.interactionBearing.y=0;
  if(this.interactionBearing.lengthSq()<1e-8)this.interactionBearing.set(0,0,1);else this.interactionBearing.normalize();
  this.interactionBaseAngle=Math.atan2(this.interactionBearing.x,this.interactionBearing.z);
  this.lastCollisionTarget.set(Infinity,Infinity,Infinity);this.collisionElapsed=0;
  this.canvas.setAttribute('aria-label','おこていゆの詳細観測モード。行動を続けるおこていゆを見守れます。ビュー内のどこでもタップ、または戻るボタンで部屋に戻ります。');
  this.beginCameraTransition();this.applyCutaway();return true;
 }
 exitInteraction({force=false}={}){
  if((!force&&!this.canUseScene())||!['interaction','inspection'].includes(this.sceneMode))return false;
  this.cancelPointers();if(this.roomCameraState){this.mode=this.roomCameraState.mode;this.viewing={...this.roomCameraState.viewing};}
  this.sceneMode='room';this.followTarget.copy(this.targetCenter);this.roomCameraState=null;this.inspection=null;this.inspectionNarrationPending=false;
  this.canvas.setAttribute('aria-label',this.mode==='viewing'?'おこていゆハウスの3Dビュー。おこていゆや家具をタップで詳細観測。ドラッグで回転、ピンチまたはホイールで拡大縮小。':'おこていゆハウスの3Dビュー。入口からおこていゆを自動で追従。おこていゆや家具をタップで詳細観測。');
  this.beginCameraTransition();this.applyCutaway();return true;
 }
 updateTarget(){if(!this.targetNode)return;this.model.updateMatrixWorld(true);this.targetCenter.copy(this.targetOffset);this.targetNode.localToWorld(this.targetCenter);}
 fitInteractionOffset(aim,offset){
  // Shorten both horizontal components together to keep the same azimuth at walls.
  let horizontal=1;
  for(const axis of ['x','z'])if(Math.abs(offset[axis])>1e-8){
   const edge=offset[axis]>0?this.roomBounds.max[axis]-.12:this.roomBounds.min[axis]+.12;
   horizontal=Math.min(horizontal,Math.max(0,(edge-aim[axis])/offset[axis]));
  }
  offset.x*=horizontal;offset.z*=horizontal;
  offset.y=clamp(aim.y+offset.y,.15,this.roomBounds.max.y-.12)-aim.y;
  return offset;
 }
 updateInteractionCamera(dt,immediate){
  const previousOrientation=this.camera.quaternion.clone();
  const aim=this.targetCenter.clone().add(new THREE.Vector3(0,this.targetHeight*.1,0));
  if(immediate)this.interactionAim.copy(aim);else this.interactionAim.lerp(aim,1-Math.exp(-dt*5));
  this.collisionElapsed+=dt;
  const bodyForward=new THREE.Vector3(1,0,0).transformDirection(this.targetNode.matrixWorld),lying=bodyForward.y>.55;
  const currentAngle=Math.atan2(this.interactionBearing.x,this.interactionBearing.z),base=this.interactionBaseAngle??currentAngle;
  const facing=Math.atan2(bodyForward.x,bodyForward.z),difference=Math.atan2(Math.sin(facing-base),Math.cos(facing-base));
  const desired=lying?base:base+clamp(difference,-radians(35),radians(35));
  const delta=Math.atan2(Math.sin(desired-currentAngle),Math.cos(desired-currentAngle));
  const step=Math.abs(delta)<radians(2)?0:clamp(delta*(1-Math.exp(-dt*.7)),-radians(8)*dt,radians(8)*dt);
  this.interactionBearing.set(Math.sin(currentAngle+step),0,Math.cos(currentAngle+step));
  const angleChanged=Math.abs((this.lastCameraBearingAngle??currentAngle)-(currentAngle+step))>radians(3);
  const moved=this.lastCollisionTarget.distanceToSquared(this.targetCenter)>.12*.12,poseChanged=this.lastInteractionLying!==lying;
  if(((moved||poseChanged||angleChanged)&&this.collisionElapsed>.35)||!Number.isFinite(this.lastCollisionTarget.x)){
   // Follow turns slowly within a limited angle. Prefer a higher eye line
   // over an orbit around furniture; the room itself is never foreground-clipped.
   const maximum=this.targetHeight*(lying?1:2.15),heights=lying?[1.8,2.4,3]:[.37,.9,1.8];
   // The sleep cover belongs to the subject; it must not pull the eye inside the body.
   const cover=this.life?.actionKind==='bed'?this.findNode(this.life.definition?.blanket?.nodeName||'Life.Bed.HalfBlanket'):null;
   const obstacles=this.pickMeshes.filter(object=>!cover?.getObjectById(object.id)&&!this.characterMeshSet.has(object)&&this.visibleMesh(object));
   let best=null;
   for(const [index,height] of heights.entries()){
    const offset=this.fitInteractionOffset(aim,this.interactionBearing.clone().multiplyScalar(maximum).add(new THREE.Vector3(0,this.targetHeight*height,0)));
    const ray=offset.clone(),length=ray.length();this.raycaster.set(aim,ray.normalize());this.raycaster.near=.025;this.raycaster.far=length+.08;
    const hit=this.raycaster.intersectObjects(obstacles,false)[0],clearance=Math.min(length,hit?Math.max(.025,hit.distance-.1):length);
    const score=clearance/Math.max(length,.025)-index*.02;
    if(!best||score>best.score)best={score,offset:ray.multiplyScalar(clearance)};
   }
   this.raycaster.near=0;this.raycaster.far=Infinity;
   this.desiredInteractionOffset=best.offset;
   if(!Number.isFinite(this.lastCollisionTarget.x))this.interactionOffset.copy(best.offset);
   this.lastCollisionTarget.copy(this.targetCenter);this.lastInteractionLying=lying;this.lastCameraBearingAngle=currentAngle+step;this.collisionElapsed=0;
  }
  if(this.desiredInteractionOffset)this.interactionOffset.lerp(this.desiredInteractionOffset,1-Math.exp(-dt*2));
  const offset=this.fitInteractionOffset(this.interactionAim,this.interactionOffset.clone());
  this.camera.position.copy(this.interactionAim).add(offset);this.camera.fov=42;this.camera.lookAt(this.interactionAim);
  if(dt>0&&!immediate&&!this.cameraTransition)this.camera.quaternion.copy(previousOrientation.rotateTowards(this.camera.quaternion,radians(12)*dt));
  this.cameraAim.copy(this.interactionAim);
 }
 applyCamera(dt=0,immediate=false){
  this.camera.clearViewOffset();
  if(this.sceneMode==='inspection')this.updateInspectionCamera();
  else if(this.sceneMode==='interaction')this.updateInteractionCamera(dt,immediate);
  else if(this.mode==='viewing'){
   const {yaw,pitch,radius,fov}=this.viewing;
   this.camera.position.set(Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius).add(this.entrancePivot);
   this.camera.fov=fov;this.camera.lookAt(this.lookAt);this.cameraAim.copy(this.lookAt);
  }else{
   this.camera.position.copy(this.entranceEye);
   if(immediate)this.followTarget.copy(this.targetCenter);else this.followTarget.lerp(this.targetCenter,1-Math.exp(-dt*3));
   const distance=Math.max(.25,this.entranceEye.distanceTo(this.followTarget));
   const desiredFov=clamp(THREE.MathUtils.radToDeg(2*Math.atan(this.targetHeight*1.15/distance)),18,65);
   this.camera.fov=immediate?desiredFov:THREE.MathUtils.lerp(this.camera.fov,desiredFov,1-Math.exp(-dt*3));
   this.camera.lookAt(this.followTarget);this.cameraAim.copy(this.followTarget);
  }
  if(this.cameraTransition){
   const transition=this.cameraTransition;transition.elapsed+=dt;
   const progress=transition.duration?clamp(transition.elapsed/transition.duration,0,1):1,blend=progress*progress*(3-2*progress);
   this.camera.position.lerpVectors(transition.position,this.camera.position,blend);
   this.camera.quaternion.slerpQuaternions(transition.quaternion,this.camera.quaternion.clone(),blend);
   this.camera.fov=THREE.MathUtils.lerp(transition.fov,this.camera.fov,blend);
   if(progress===1){this.cameraTransition=null;this.onInteractionChange({sceneMode:this.sceneMode,transitioning:false,phase:'end'});if(this.sceneMode==='inspection'&&this.inspectionNarrationPending&&this.active){this.inspectionNarrationPending=false;this.onInspect(this.inspection.definition);}}
  }
  this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
 }
 applyCutaway(){
  if(!this.model)return;
  const cameraOnRight=this.camera.position.x>=this.entrancePivot.x;
  for(const {group,object} of this.wallObjects){
   const hide=this.mode==='viewing'||this.sceneMode!=='room'||this.cameraTransition?(group==='entry'||group==='ceiling'||(group==='right'&&cameraOnRight)||(group==='left'&&!cameraOnRight)):group==='entry';
   object.visible=!hide;
  }
 }
 resize(){
  if(!this.renderer||this.destroyed)return;const bounds=this.container.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;
  this.width=Math.round(bounds.width);this.height=Math.round(bounds.height);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();if(this.ready&&this.active){if(this.sceneMode==='inspection')this.applyCamera(0);this.render();}
 }
 schedule(){if(!this.raf&&!this.destroyed&&this.active&&!document.hidden)this.raf=requestAnimationFrame(time=>this.frame(time));}
 frame(time){
  this.raf=0;if(this.destroyed||!this.active||document.hidden)return;
  const frameDelta=this.lastFrame?Math.max(0,(time-this.lastFrame)/1000):0,dt=Math.min(frameDelta,.05);this.lastFrame=time;
  if(this.ready&&!this.contextLost){const paused=this.worldUpdatePending>0||this.isSimulationPaused();if(this.isPaused()||paused)this.cancelPointers();if(!paused){const elapsed=this.life?frameDelta:dt;this.elapsed+=elapsed;if(this.life)this.life.update(elapsed);else this.mixer?.update(dt);}this.updateTarget();this.applyCamera(paused?0:Math.min(frameDelta,1));this.applyCutaway();this.render();}
  this.onLifeStateChange();this.schedule();
 }
 render(){if(this.renderer&&this.ready&&this.active&&!this.contextLost&&!this.destroyed){this.renderer.render(this.scene,this.camera);this.renderFrames++;}}
 setActive(active){this.active=Boolean(active);this.lastFrame=0;this.cancelPointers();if(!this.active){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;if(this.sceneMode==='inspection'){this.mode=this.roomCameraState?.mode||this.mode;this.viewing={...(this.roomCameraState?.viewing||this.viewing)};this.sceneMode='room';this.roomCameraState=null;this.inspection=null;this.inspectionNarrationPending=false;this.cameraTransition=null;this.camera.clearViewOffset();}}else{this.resize();if(this.ready)this.schedule();}return this.active;}
 requestAction(kind){if(!this.canUseScene()||!this.life)return false;return this.life.requestAction(kind);}
 arriveFromOutside(options={}){if(!this.life)return false;this.sceneMode='room';this.mode='follow';this.cameraTransition=null;this.roomCameraState=null;this.inspection=null;this.life.arriveFromOutside(options);this.updateTarget();this.followTarget.copy(this.targetCenter);this.lastCollisionTarget.set(Infinity,Infinity,Infinity);this.applyCamera(0,true);this.render();return true;}
 leaveHouse(){if(!this.life)return false;this.life.leaveHouse();return true;}
 spendCalmPoints(count){return this.life?.spendCalmPoints(count)??false;}
 getConsecutiveRelaxActions(){return this.life?.consecutiveRelaxActions??0;}
 resetConsecutiveRelaxActions(reason='explicit'){if(!this.life)return false;return this.life.resetConsecutiveRelaxActions(reason);}
 onAngerPointGain(){if(!this.life)return false;return this.life.onAngerPointGain();}
 restoreConsecutiveRelaxActions(count){return this.life?.restoreConsecutiveRelaxActions(count)??false;}
 advanceForPreview(seconds){
  if(document.hidden||!this.ready||!this.active||this.destroyed||this.contextLost||this.worldUpdatePending||this.isSimulationPaused()||!this.life||!Number.isFinite(seconds)||seconds<0||seconds>300)return false;
  this.life.update(seconds);this.onLifeStateChange();this.elapsed+=seconds;this.updateTarget();this.applyCamera(0,true);this.applyCutaway();this.render();return true;
 }
 /** Layout writers use this transaction instead of replacing a running scene. */
 applyHouseUpdate(update){
  if(typeof update!=='function')return Promise.reject(new TypeError('更新処理が必要です。'));
  this.worldUpdatePending++;this.cancelPointers();
  const run=async()=>{
   if(!this.ready||this.destroyed)throw new Error('部屋の準備ができていません。');
   const viewing={...this.viewing},priorMode=this.mode;
   try{
    const changes=await update({model:this.model,life:this.life,metadata:this.metadata});
    if(changes?.inspections)this.inspectionDefinitions=changes.inspections;
    if(changes?.life)this.life?.refreshEnvironment(changes.life);
    return changes;
   }finally{
    this.model.updateMatrixWorld(true);
    this.model.traverse(n=>{if(n.geometry){n.geometry.computeBoundingBox();n.geometry.computeBoundingSphere();}});
    this.configureMetadata(this.metadata);this.viewing=viewing;this.mode=priorMode;
    if(this.inspection?.root&&!this.visibleMesh(this.inspection.root))this.exitInteraction({force:true});
    if(this.inspection?.root&&!this.model.getObjectById(this.inspection.root.id))this.exitInteraction({force:true});
    if(this.inspection){const definition=this.inspectionDefinitions.find(d=>d.id===this.inspection.definition.id);if(definition){this.inspection.definition=definition;if(!this.inspection.root&&definition.min)this.inspection.bounds.set(new THREE.Vector3(...definition.min),new THREE.Vector3(...definition.max));}}
    this.sceneRevision++;this.updateTarget();this.lastCollisionTarget.set(Infinity,Infinity,Infinity);this.applyCamera(0);this.applyCutaway();this.onLifeStateChange();this.render();
    this.container.dispatchEvent(new CustomEvent('housechange',{detail:{revision:this.sceneRevision},bubbles:true}));
   }
  };
  const result=this.updateQueue.then(run);this.updateQueue=result.catch(()=>{});return result.finally(()=>{this.worldUpdatePending--;this.lastFrame=0;});
 }
 getDiagnostics(){
  return {foregroundClippingActive:false,ready:this.ready,active:this.active,mode:this.mode,sceneMode:this.sceneMode,inspectionTarget:this.inspection?.definition.id||null,interactionEnabled:this.enableInteraction,transition:this.cameraTransition?{elapsed:this.cameraTransition.elapsed,duration:this.cameraTransition.duration}:null,characterScreenPoint:this.characterScreenPoint(),contextLost:this.contextLost,error:this.lastError,animation:this.clip?.name||null,animationDuration:this.clip?.duration||0,animationTime:this.action?.time||0,elapsed:this.elapsed,life:this.life?.getDiagnostics()||null,cameraPosition:this.camera.position.toArray(),cameraFov:this.camera.fov,entrancePivot:this.entrancePivot.toArray(),entranceEye:this.entranceEye.toArray(),lookAt:this.cameraAim.toArray(),characterPosition:this.targetCenter.toArray(),orbit:{...this.viewing},size:{width:this.width||0,height:this.height||0,pixelRatio:this.renderer?.getPixelRatio()||1},renderFrames:this.renderFrames,renderInfo:this.renderer?{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures}:null};
 }
 disposeObject(object){const geometries=new Set(),materials=new Set(),textures=new Set();object?.traverse(child=>{if(child.geometry)geometries.add(child.geometry);for(const material of Array.isArray(child.material)?child.material:[child.material])if(material){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});for(const item of textures)item.dispose();for(const item of materials)item.dispose();for(const item of geometries)item.dispose();}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.life?.destroy();this.setActive(false);this.resizeObserver?.disconnect();for(const unbind of this.listeners)unbind();this.listeners=[];this.mixer?.stopAllAction();if(this.model)this.disposeObject(this.model);this.scene.clear();this.renderer?.dispose();this.canvas?.remove();this.ready=false;}
}
