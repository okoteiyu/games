import * as THREE from './vendor/three/three.module.js';
import {BattleView} from './battle-view.js';
import {loadAssetJson,loadGLTFAsset} from './asset-store.js';
import {equippedSupportIds} from './equipment-rules.js';
import {isModalBlocked} from './modal-layer.js';
import {INTERIOR_ROOMS} from './interior-rules.js';
import {interiorInspections} from './interior-inspections.js';
import {currentTimeOfDay} from './world-time.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';

const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const findNode=(root,name)=>root?.getObjectByName(name)||root?.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
const vectorRecord=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
function outdoorCameraRecord(value){
 if(!value||!vectorRecord(value.position)||!vectorRecord(value.target)||!vectorRecord(value.up)||!Number.isFinite(value.fov)||value.fov<=0||value.fov>=180||!Number.isFinite(value.near)||value.near<=0||!Number.isFinite(value.far)||value.far<=value.near||!Number.isFinite(value.zoom)||value.zoom<=0)return null;
 return {...value,position:[...value.position],target:[...value.target],up:[...value.up],look:{yaw:number(value.look?.yaw),pitch:number(value.look?.pitch)},view:value.view?{...value.view}:null};
}
function visitingSnapshot(player={}){
 const support=equippedSupportIds(player.equipment||{}).includes('moai_kun')?['moai_kun']:[],helper=support.length?{id:'moai_kun',phase:'idle',guardUsed:false}:null,hp=Math.max(1,number(player.stats?.hp,1));
 return {phase:'visiting',time:0,enemies:[],targetId:null,super:{active:false},supports:helper?[helper]:[],support:helper,player:{...player,id:'player',speciesId:'okoteiyu',name:'おこていゆ',hp,maxHp:hp,action:null,superActive:false,auraId:null,equipment:{support,defense:null}}};
}

/** A visit-only room. Approved character assets provide idle presentation;
 * no battle, research, reward or home simulation is advanced here. */
export class AnalysisRoomView extends BattleView{
 constructor(options={}){super(options);this.roomDefinition=options.roomDefinition||INTERIOR_ROOMS['analysis-room'];this.onInspect=options.onInspect||(()=>{});this.inspectionTargets=[];this.inspection=null;this.inspectionTransition=null;this.inspectionSerial=0;}
 createRenderer(){
  super.createRenderer();if(this.entranceInputCanvas===this.canvas)return;
  this.entranceInputCanvas=this.canvas;this.lookPointers=new Set();this.lookMulti=false;this.canvas.tabIndex=0;
  const listen=(target,type,handler)=>{target.addEventListener(type,handler);this.listeners.push(()=>target.removeEventListener(type,handler));};
  listen(this.canvas,'pointerdown',event=>{
   if(!this.canUseRoomInput()){this.cancelLookPointers();return;}
   if(event.pointerType==='mouse'&&event.button!==0)return;
   event.preventDefault();this.canvas.focus({preventScroll:true});this.lookPointers.add(event.pointerId);
   if(this.lookPointers.size>1){this.lookMulti=true;this.lookDrag=null;}else if(!this.lookMulti)this.lookDrag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragged:false};
   try{this.canvas.setPointerCapture(event.pointerId);}catch{}
  });
  listen(this.canvas,'pointermove',event=>{
   if(!this.lookPointers.has(event.pointerId))return;
   if(!this.canUseRoomInput()){this.cancelLookPointers();return;}
   event.preventDefault();if(!this.lookDrag||this.lookDrag.id!==event.pointerId)return;
   const box=this.canvas.getBoundingClientRect(),previous=this.lookDrag,dragged=previous.dragged||Math.hypot(event.clientX-previous.startX,event.clientY-previous.startY)>6;
   if(dragged&&this.cameraMode==='entrance'&&!this.inspectionTransition)this.rotateEntrance((event.clientX-previous.x)/Math.max(100,box.width)*Math.PI,-(event.clientY-previous.y)/Math.max(100,box.height)*Math.PI);
   this.lookDrag={...previous,x:event.clientX,y:event.clientY,dragged};
  });
  const release=event=>{
   const drag=this.lookDrag,tap=event.type==='pointerup'&&drag?.id===event.pointerId&&!drag.dragged&&!this.lookMulti&&this.lookPointers.size===1&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<=6&&this.canUseRoomInput();
   this.lookPointers.delete(event.pointerId);this.lookDrag=null;if(!this.lookPointers.size)this.lookMulti=false;
   try{this.canvas.releasePointerCapture(event.pointerId);}catch{}
   if(tap)this.tapRoom(event.clientX,event.clientY);
  };
  listen(this.canvas,'pointerup',release);listen(this.canvas,'pointercancel',release);
  listen(this.canvas,'lostpointercapture',event=>{this.lookPointers.delete(event.pointerId);this.lookDrag=null;if(!this.lookPointers.size)this.lookMulti=false;});
  listen(this.canvas,'keydown',event=>{
   if(event.key==='Escape'&&this.cameraMode==='top'&&this.toggleOutdoorTopView()){event.preventDefault();return;}
   if(event.key==='Escape'&&this.exitInspection()){event.preventDefault();return;}
   const step=Math.PI/24,change={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[event.key];
   if(change&&this.cameraMode==='top'&&this.canUseRoomInput()){event.preventDefault();return;}
   if(change&&this.rotateEntrance(...change))event.preventDefault();
  });
  listen(this.canvas,'webglcontextlost',()=>this.cancelLookPointers());listen(this.canvas,'blur',()=>this.cancelLookPointers());listen(document,'visibilitychange',()=>this.cancelLookPointers());listen(window,'blur',()=>this.cancelLookPointers());
 }
 cancelLookPointers(){
  const pointers=[...(this.lookPointers||[])];this.lookPointers?.clear();this.lookDrag=null;this.lookMulti=false;
  for(const id of pointers)try{this.canvas?.releasePointerCapture(id);}catch{}
 }
 canUseRoomInput(){return this.ready&&this.active&&!this.loading&&!this.contextLost&&!this.destroyed&&!this.isPresentationPaused?.()&&!document.hidden&&!isModalBlocked();}
 canLookAround(){return this.cameraMode==='entrance'&&!this.inspectionTransition&&this.canUseRoomInput();}
 rotateEntrance(yaw,pitch){
  if(!this.canLookAround()||!Number.isFinite(yaw)||!Number.isFinite(pitch))return false;
  const outdoor=this.roomDefinition.id==='outdoor',limit=outdoor?Math.PI:Math.PI*.49;
  this.entranceCameraOverride=null;
  this.entranceLook.yaw=outdoor?THREE.MathUtils.euclideanModulo(this.entranceLook.yaw+yaw+Math.PI,Math.PI*2)-Math.PI:clamp(this.entranceLook.yaw+yaw,-limit,limit);this.entranceLook.pitch=clamp(this.entranceLook.pitch+pitch,outdoor?-1.25:-.5,.7);this.fitCamera();this.render();return true;
 }
 setActive(active){if(!active){this.cancelLookPointers();this.inspection=null;this.inspectionTransition=null;this.cameraMode='entrance';this.outdoorReturnCamera=null;this.entranceCameraOverride=null;}super.setActive(active);}
 destroy(){this.cancelLookPointers();this.inspection=null;this.inspectionTransition=null;super.destroy();}
 prepareInspections(){
  this.inspectionTargets=[];this.scene.updateMatrixWorld(true);
  for(const definition of interiorInspections(this.roomDefinition.id))for(const objectId of definition.featureIds){
   const feature=this.metadata.features?.find(entry=>entry.id===objectId);if(!feature?.node)continue;const root=findNode(this.fieldScene,feature.node);if(!root)continue;
   const bounds=new THREE.Box3().setFromObject(root);if(!bounds.isEmpty())this.inspectionTargets.push({definition,targetId:definition.id,objectId,rootName:feature.node,root,bounds});
  }
 }
 visibleInspectionMesh(node){for(let p=node;p;p=p.parent)if(p.visible===false)return false;return node.isMesh&&(Array.isArray(node.material)?node.material:[node.material]).some(material=>material&&material.visible!==false&&(!material.transparent||material.opacity>.001));}
 inspectionHit(clientX,clientY){
  const box=this.canvas?.getBoundingClientRect();if(!this.canUseRoomInput()||!box?.width||!box?.height||clientX<box.left||clientX>box.right||clientY<box.top||clientY>box.bottom)return null;
  this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);this.inspectionRaycaster??=new THREE.Raycaster();this.inspectionRaycaster.setFromCamera(new THREE.Vector2((clientX-box.left)/box.width*2-1,1-(clientY-box.top)/box.height*2),this.camera);
  const meshes=[];this.scene.traverse(node=>{if(this.visibleInspectionMesh(node))meshes.push(node);});
  const hit=this.inspectionRaycaster.intersectObjects(meshes,false)[0];if(!hit)return null;
  return this.inspectionTargets.find(target=>{for(let node=hit.object;node;node=node.parent)if(node===target.root)return true;return false;})||null;
 }
 tapRoom(clientX,clientY){
  if(!this.canUseRoomInput())return false;
  if(this.cameraMode==='inspection')return this.exitInspection();
  if(this.inspectionTransition)return false;
  const target=this.inspectionHit(clientX,clientY);return target?this.enterInspection(target,{source:'tap'}):false;
 }
 inspectionObstacles(target){
  const obstacles=[];for(const feature of this.metadata.features||[]){if(feature.id===target.objectId)continue;const root=findNode(this.fieldScene,feature.node);if(root){const bounds=new THREE.Box3().setFromObject(root);if(!bounds.isEmpty())obstacles.push(bounds.expandByScalar(.10));}}return obstacles;
 }
 inspectionPose(target){
  const bounds=target.bounds,size=bounds.getSize(new THREE.Vector3()),aim=bounds.getCenter(new THREE.Vector3()),front=new THREE.Vector3(...target.definition.front);aim.y=bounds.min.y+size.y*.51;
  const surface=aim.clone();surface.z=front.z>0?bounds.max.z:bounds.min.z;
  const obstacles=this.inspectionObstacles(target),wanted=Math.max(1.5,size.y/(2*Math.tan(Math.PI/6))*1.25);let distance=wanted,position;
  while(distance>.35){position=surface.clone().addScaledVector(front,distance);position.y=aim.y+.05;if(!obstacles.some(box=>box.containsPoint(position)))break;distance-=.10;}
  position??=surface.clone().addScaledVector(front,.35);return {position,target:aim,fov:distance<1.4?72:60,obstacles};
 }
 segmentBlocked(from,to,boxes){const direction=to.clone().sub(from),length=direction.length();if(!length)return false;const ray=new THREE.Ray(from,direction.normalize());return boxes.some(box=>{const hit=ray.intersectBox(box,new THREE.Vector3());return hit&&from.distanceTo(hit)<=length;});}
 startInspectionTransition(phase,pose,target){
  const start={position:this.camera.position.clone(),target:this.cameraAim?.clone()||this.camera.position.clone().add(new THREE.Vector3(0,0,-1)),fov:this.camera.fov},boxes=pose.obstacles||this.inspectionObstacles(target),blocked=this.segmentBlocked(start.position,pose.position,boxes),height=Math.min(number(this.metadata.room?.height,3.65)-.30,Math.max(start.position.y,pose.position.y,...boxes.map(box=>box.max.y))+.15);
  const points=blocked?[start.position.clone(),new THREE.Vector3(start.position.x,height,start.position.z),new THREE.Vector3(pose.position.x,height,pose.position.z),pose.position.clone()]:[start.position.clone(),pose.position.clone()];
  this.inspectionTransition={phase,elapsed:0,duration:blocked?1.2:.9,start,end:pose,points,token:this.inspection?.token||null};this.fitCamera();this.render();
 }
 enterInspection(target,{source='programmatic'}={}){
  if(!this.canUseRoomInput()||this.cameraMode!=='entrance'||this.inspectionTransition||!this.inspectionTargets.includes(target))return false;
  this.cancelLookPointers();this.inspection={...target,token:String(this.fieldGeneration)+':'+String(++this.inspectionSerial)+':'+target.objectId,source,generation:this.fieldGeneration,returnLook:{...this.entranceLook},notified:false};this.cameraMode='inspection';this.startInspectionTransition('enter',this.inspectionPose(target),target);return true;
 }
 exitInspection(){
  if(!this.canUseRoomInput()||this.cameraMode!=='inspection'||this.inspectionTransition?.phase==='exit')return false;
  const selected=this.inspection;if(!selected)return false;this.cancelLookPointers();this.entranceLook={...selected.returnLook};this.inspection=null;this.startInspectionTransition('exit',{...this.entrancePose(),obstacles:this.inspectionObstacles(selected)},selected);return true;
 }
 getInspectionState(){
  const target=this.inspection;if(!target)return null;const settled=this.cameraMode==='inspection'&&!this.inspectionTransition;
  return {roomId:this.roomDefinition.id,targetId:target.targetId,objectId:target.objectId,rootName:target.rootName,token:target.token,generation:target.generation,source:target.source,settled,phase:settled?'settled':'transition',entered:settled,label:target.definition.label,text:target.definition.description};
 }
 restoreInspection(saved){
  // Only completed observations survive a GPU rebuild; an interrupted movement
  // returns to the entrance and can be tapped again. Restoration never emits.
  if(!saved?.settled)return;const target=this.inspectionTargets.find(entry=>entry.targetId===saved.targetId&&entry.objectId===saved.objectId);if(!target)return;
  this.inspection={...target,token:String(this.fieldGeneration)+':restore:'+String(++this.inspectionSerial),source:'restore',generation:this.fieldGeneration,returnLook:{...this.entranceLook},notified:true};this.cameraMode='inspection';
 }
 inspectionScreenPoint(targetId='warehouse_fridge',objectId=null){
  if(!this.ready||!this.canvas)return null;const box=this.canvas.getBoundingClientRect();this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
  const targets=this.inspectionTargets.filter(t=>t.targetId===targetId&&(!objectId||t.objectId===objectId)).sort((a,b)=>Math.abs(a.bounds.getCenter(new THREE.Vector3()).x)-Math.abs(b.bounds.getCenter(new THREE.Vector3()).x));
  for(const target of targets)for(const ratio of [.55,.80,.35]){const point=target.bounds.getCenter(new THREE.Vector3());point.y=target.bounds.min.y+target.bounds.getSize(new THREE.Vector3()).y*ratio;point.z=target.bounds.max.z;point.project(this.camera);if(Math.abs(point.x)>1||Math.abs(point.y)>1||point.z>1||point.z< -1)continue;const x=box.left+(point.x+1)*box.width/2,y=box.top+(1-point.y)*box.height/2;if(this.inspectionHit(x,y)?.objectId===target.objectId)return {targetId,objectId:target.objectId,x,y};}return null;
 }
 async load(snapshot,stage={},{presentationState}={}){
  this.cancelLookPointers();this.inspection=null;this.inspectionTransition=null;const room=this.roomDefinition,saved=presentationState?.roomId&&presentationState.roomId!==room.id?null:presentationState?.analysisRoom;
  const outdoor=room.id==='outdoor';this.entranceLook={yaw:clamp(number(saved?.entranceLook?.yaw),-Math.PI*(outdoor?1:.49),Math.PI*(outdoor?1:.49)),pitch:clamp(number(saved?.entranceLook?.pitch,-.06),outdoor?-1.25:-.5,.7)};
  const generation=this.fieldGeneration=(this.fieldGeneration||0)+1;this.loading=true;this.ready=false;this.lastError=null;this.snapshot=snapshot;this.stageOptions={...stage,presentation:room.id};this.time=number(snapshot.time);this.cutin=null;this.presentationId=stage.presentationId??null;this.cameraMode='entrance';this.supportView.setVisible(false);if(this.canvas)this.canvas.style.visibility='hidden';this.onStatus(room.title+'を準備しています…');
  this.outdoorReturnCamera=outdoor?outdoorCameraRecord(saved?.outdoorReturnCamera):null;this.entranceCameraOverride=outdoor?outdoorCameraRecord(saved?.entranceCameraOverride):null;
  if(outdoor&&saved?.cameraMode==='top'&&this.outdoorReturnCamera)this.cameraMode='top';
  try{
   this.createRenderer();
   const assetBase=new URL('./assets/'+room.assetDirectory+'/',import.meta.url);
   const [manifest,metadata]=await Promise.all([this.manifest?Promise.resolve(this.manifest):loadAssetJson(new URL('manifest.json',this.baseUrl)),loadAssetJson(new URL('metadata.json',assetBase))]);this.manifest=manifest;
   const definition=metadata.model;if(!definition?.url)throw new Error(room.title+'のモデル設定が見つかりません。');
   const modelUrl=new URL(definition.url,assetBase);if(definition.sha256)modelUrl.searchParams.set('v',definition.sha256);
   const [gltf,player]=await Promise.all([loadGLTFAsset(this.loader,modelUrl.href),this.loadActor('okoteiyu','player'),this.supportView.prepare(snapshot.player.equipment.support)]);
   if(this.destroyed||generation!==this.fieldGeneration){this.disposeObject(gltf.scene);return false;}
   for(const actor of this.actorCache.values())actor.anchor.visible=false;
   this.clearStage();this.metadata=metadata;this.fieldScene=gltf.scene;this.fieldScene.name=room.id+'.Environment';this.stage.add(this.fieldScene);
   if(outdoor&&!saved?.entranceLook&&metadata.entrance?.camera?.target){const camera=metadata.entrance.camera,delta=new THREE.Vector3(...camera.target).sub(new THREE.Vector3(...camera.position));this.entranceLook.pitch=clamp(Math.atan2(delta.y,Math.hypot(delta.x,delta.z)),-1.25,.7);}
   this.applyRoomView();this.prepareInspections();this.restoreInspection(saved?.inspection);
   this.actors={player};player.anchor.visible=true;player.anchor.position.fromArray(metadata.entrance?.heroStand||metadata.entry?.position||[0,0,1.82]);player.facing.rotation.y=number(metadata.entrance?.heroYaw??metadata.entry?.yaw,Math.PI);player.hitAt=player.superAt=-Infinity;player.hitRoot.position.set(0,0,0);player.fatigueRoot.position.set(0,0,0);player.attackRoot.position.set(0,0,0);player.mixer.stopAllAction();for(const shield of player.shields?.values()||[])shield.visible=false;
   this.supportView.activate(snapshot.player.equipment.support,{baseTime:this.time});this.scene.background=new THREE.Color(metadata.background||'#e8efed');this.scene.fog=null;
   this.hemi.intensity=number(metadata.lighting?.ambient,2.1);this.sun.intensity=number(metadata.lighting?.sun,2.3);this.sun.position.set(-3,6,4);this.configureOutdoorPresentation();
   this.loading=false;this.ready=true;this.updatePose();this.resize();this.render();this.onStatus('');return true;
  }catch(error){if(this.destroyed||generation!==this.fieldGeneration)return false;this.loading=false;this.ready=false;this.lastError=error?.message||String(error);this.onStatus('');this.onError(error);return false;}
 }
 capturePresentationState(){return {version:1,presentationId:this.presentationId,roomId:this.roomDefinition.id,analysisRoom:{cameraMode:this.cameraMode||'entrance',entranceLook:{...this.entranceLook},inspection:this.getInspectionState(),outdoorReturnCamera:outdoorCameraRecord(this.outdoorReturnCamera),entranceCameraOverride:outdoorCameraRecord(this.entranceCameraOverride)}};}
 applyRoomView(){
  if(!this.fieldScene||!this.metadata)return;
  // Keep the closed room visible, including shells used by authoring previews.
  const shells=[...(this.metadata.hideFromEntranceCamera||[]),...(this.metadata.reverseCamera?.hideNodes||[])];
  for(const name of new Set(shells)){const node=this.fieldScene.getObjectByName(name)||this.fieldScene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));if(node)node.visible=true;}
 }
 configureOutdoorPresentation(){
  const outdoor=this.roomDefinition.id==='outdoor',night=outdoor&&currentTimeOfDay()==='night';this.outdoorTime=outdoor?(night?'night':'day'):null;
  this.renderer.shadowMap.enabled=outdoor;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.sun.castShadow=outdoor;
  this.hemi.color.set(outdoor?(night?0xaebfd9:0xe1efff):0xfff9e9);this.hemi.groundColor.set(outdoor?0x677058:0x838f88);this.sun.color.set(night?0xb8cbe3:0xfff0da);this.scene.environmentIntensity=night?.3:.8;
  if(!outdoor){if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}return;}
  const color=night?'#1c293c':this.metadata.background||'#c9dce5';this.scene.background=new THREE.Color(color);this.scene.fog=new THREE.Fog(color,75,150);
  this.hemi.intensity=night?.75:number(this.metadata.lighting?.ambient,1.45);this.sun.intensity=night?.45:number(this.metadata.lighting?.sun,3);this.sun.position.fromArray(this.metadata.lighting?.sunPosition||[-18,35,24]);
  this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.5,far:130});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.04;
  this.fieldScene.traverse(node=>{if(node.isMesh){const transparent=(Array.isArray(node.material)?node.material:[node.material]).every(material=>material?.transparent&&material.opacity<.8);node.castShadow=!transparent;node.receiveShadow=true;}});
 }
 targetSelectionAvailable(){return false;}
 canOrbitCamera(){return false;}
 canToggleOutdoorTopView(){return this.roomDefinition.id==='outdoor'&&['entrance','top'].includes(this.cameraMode)&&!this.inspectionTransition&&this.canUseRoomInput();}
 toggleOutdoorTopView(){
  if(!this.canToggleOutdoorTopView())return false;this.cancelLookPointers();
  if(this.cameraMode==='top'){
   if(!this.outdoorReturnCamera)return false;
   this.entranceLook={...this.outdoorReturnCamera.look};this.entranceCameraOverride=outdoorCameraRecord(this.outdoorReturnCamera);this.cameraMode='entrance';
  }else{
   this.outdoorReturnCamera=outdoorCameraRecord({position:this.camera.position.toArray(),target:this.cameraAim.toArray(),up:this.camera.up.toArray(),fov:this.camera.fov,near:this.camera.near,far:this.camera.far,zoom:this.camera.zoom,view:this.camera.view,look:{...this.entranceLook}});this.entranceCameraOverride=null;this.cameraMode='top';
  }
  this.fitCamera();this.render();return true;
 }
 outdoorTopPose(){
  const bounds=this.metadata.room?.bounds,min=bounds?.min||[-20,0,-10],max=bounds?.max||[20,9,13],width=Math.max(1,max[0]-min[0]),depth=Math.max(1,max[2]-min[2]),fov=50,aspect=this.width/this.height;
  // Fit the highest roof plane, not just the ground footprint. The north-up
  // vector avoids lookAt's collinear world-up ambiguity at a true vertical view.
  const distance=Math.max(width/aspect,depth)/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)))*1.12,height=max[1]+distance,x=(min[0]+max[0])/2,z=(min[2]+max[2])/2;
  return {position:new THREE.Vector3(x,height,z),target:new THREE.Vector3(x,0,z),up:new THREE.Vector3(0,0,-1),fov,near:.05,far:Math.max(number(this.metadata.camera?.far,180),height+Math.max(width,depth)*2),zoom:1};
 }
 entrancePose(){
  if(this.roomDefinition.id==='outdoor'&&this.entranceCameraOverride){const saved=this.entranceCameraOverride;return {...saved,position:new THREE.Vector3(...saved.position),target:new THREE.Vector3(...saved.target),up:new THREE.Vector3(...saved.up)};}
  const center=this.metadata.entrance?.center||[0,0,2.2],authored=this.metadata.entrance?.camera,{pitch}=this.entranceLook,position=authored?.position?new THREE.Vector3(...authored.position):new THREE.Vector3(center[0],center[1]+Math.min(1.35,number(this.metadata.entrance?.height,2.45)*.6),center[2]-.16),direction=this.roomDefinition.id==='outdoor'&&authored?.target?new THREE.Vector3(...authored.target).sub(position):null,yaw=this.entranceLook.yaw+(direction?Math.atan2(direction.x,-direction.z):number(authored?.yaw));
  return {position,target:position.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(4)),fov:this.roomDefinition.id==='outdoor'?clamp(number(authored?.fov,76),45,90):72};
 }
 fitCamera(){
  if(!this.ready||!this.metadata||!this.width||!this.height)return;
  let pose=this.cameraMode==='top'&&this.roomDefinition.id==='outdoor'?this.outdoorTopPose():this.cameraMode==='inspection'&&this.inspection?this.inspectionPose(this.inspection):this.entrancePose();
  const transition=this.inspectionTransition;
  if(transition){
   const p=clamp(transition.elapsed/transition.duration,0,1),t=smooth(p),points=transition.points;let position;
   if(points.length===2)position=points[0].clone().lerp(points[1],t);
   else if(p<.2)position=points[0].clone().lerp(points[1],smooth(p/.2));
   else if(p<.8)position=points[1].clone().lerp(points[2],smooth((p-.2)/.6));
   else position=points[2].clone().lerp(points[3],smooth((p-.8)/.2));
   pose={position,target:transition.start.target.clone().lerp(transition.end.target,t),fov:THREE.MathUtils.lerp(transition.start.fov,transition.end.fov,t)};
  }
  this.camera.position.copy(pose.position);this.cameraAim=pose.target.clone();this.camera.up.copy(pose.up||new THREE.Vector3(0,1,0));this.camera.lookAt(this.cameraAim);this.camera.clearViewOffset();if(pose.view?.enabled)this.camera.setViewOffset(pose.view.fullWidth,pose.view.fullHeight,pose.view.offsetX,pose.view.offsetY,pose.view.width,pose.view.height);this.camera.zoom=pose.zoom??1;this.camera.fov=pose.fov;this.camera.near=pose.near??(this.cameraMode==='inspection'?.025:number(this.metadata.camera?.near,.03));this.camera.far=pose.far??number(this.metadata.camera?.far,80);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
 }
 updatePose(){
  if(!this.ready||!this.snapshot)return;this.sampleActor(this.actors.player,this.snapshot.player,'player');this.supportView.sample({...this.snapshot,phase:this.roomDefinition.id},this.actors,this.time,{enabled:this.active,camera:this.camera});this.scene.updateMatrixWorld(true);
 }
 advance(dt){
  if(!this.ready||!this.active||this.contextLost||this.loading||this.destroyed||this.isPresentationPaused?.()||document.hidden||isModalBlocked())return;
  if(this.roomDefinition.id==='outdoor'&&this.outdoorTime!==currentTimeOfDay())this.configureOutdoorPresentation();
  this.time+=Math.max(0,number(dt));this.snapshot.time=this.time;let completed=null;
  const transition=this.inspectionTransition;if(transition){transition.elapsed=Math.min(transition.duration,transition.elapsed+Math.max(0,number(dt)));if(transition.elapsed>=transition.duration){completed=transition;this.inspectionTransition=null;if(transition.phase==='exit')this.cameraMode='entrance';}}
  this.updatePose();this.fitCamera();this.render();
  // Emit after the settled camera has been rendered. A narration may pause the
  // room immediately, so emitting first would leave the old view on screen.
  if(completed?.phase==='enter'&&this.inspection?.token===completed.token&&!this.inspection.notified&&this.canUseRoomInput()){
   this.inspection.notified=true;if(this.inspection.source==='tap')this.onInspect(this.getInspectionState());
  }
 }
 render(){if(!this.ready||!this.active||this.contextLost||this.destroyed||!this.renderer)return;this.renderer.render(this.scene,this.camera);this.canvas.dataset.presentation=this.roomDefinition.id;this.canvas.dataset.cameraMode=this.cameraMode;this.canvas.setAttribute('aria-label',this.cameraMode==='top'?this.roomDefinition.title+'の敷地を真上から見ています。元の視点ボタン、またはEscapeキーで戻れます。':this.cameraMode==='inspection'?this.roomDefinition.title+'・'+(this.inspection?.definition.label||'物')+'の詳細観測。ビューをタップすると入口の視点へ戻ります。':this.roomDefinition.title+'の3Dビュー。'+(this.roomDefinition.id==='outdoor'?'入口側から':'入口から')+'スワイプ・ドラッグ・方向キーで見回せます。'+(this.inspectionTargets.length?'正面の冷蔵庫をタップすると詳細観測できます。':''));this.canvas.style.visibility='visible';this.renderFrames++;}
 getDiagnostics(){return {roomId:this.roomDefinition.id,ready:this.ready,loading:this.loading,active:this.active,contextLost:this.contextLost,error:this.lastError,renderFrames:this.renderFrames,time:this.time,cameraMode:this.cameraMode||'entrance',entranceLook:{...this.entranceLook},inspectionTarget:this.inspection?.targetId||null,inspectionState:this.getInspectionState(),inspectionTransition:this.inspectionTransition?{phase:this.inspectionTransition.phase,elapsed:this.inspectionTransition.elapsed,duration:this.inspectionTransition.duration}:null,inspectionObjects:this.inspectionTargets.map(t=>({targetId:t.targetId,objectId:t.objectId,rootName:t.rootName})),metadata:this.metadata||null,size:{width:this.width||0,height:this.height||0},camera:{position:this.camera.position.toArray(),target:this.cameraAim?.toArray()||null,up:this.camera.up.toArray(),quaternion:this.camera.quaternion.toArray(),fov:this.camera.fov,near:this.camera.near,far:this.camera.far,zoom:this.camera.zoom},outdoorTopView:{active:this.cameraMode==='top',returnCamera:outdoorCameraRecord(this.outdoorReturnCamera)},player:this.actors.player?{position:this.actors.player.anchor.position.toArray(),height:this.actors.player.height,currentClip:this.actors.player.currentClip}:null,support:this.supportView.getDiagnostics()};}

}

export class AnalysisRoomUI{
 constructor({view,homeElement,roomId='analysis-room',readPlayer=()=>({}),isPaused=()=>false,onMap=()=>false,onReturn=()=>false,onInspect=()=>{},onError=()=>{}}={}){
  this.roomDefinition=INTERIOR_ROOMS[roomId];if(!this.roomDefinition)throw new RangeError('見学する部屋が見つかりません。');Object.assign(this,{view,homeElement,readPlayer,isPaused,onMap,onReturn,onInspect,onError});this.active=false;this.loading=false;this.failed=false;this.generation=0;
  this.container=document.createElement('div');this.container.id=roomId==='analysis-room'?'analysisRoomScene':'interiorRoomScene';this.container.className='analysis-room-scene';
  this.status=document.createElement('div');this.status.className='analysis-room-status';this.status.setAttribute('role','status');this.status.hidden=true;this.status.innerHTML='<span></span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);this.status.querySelector('button').addEventListener('click',()=>{if(!this.isPaused()&&!isModalBlocked())this.show();});
  this.topViewButton=document.createElement('button');this.topViewButton.type='button';this.topViewButton.className='analysis-room-topview';this.topViewButton.dataset.outdoorTopView='';this.topViewButton.hidden=true;this.topViewButton.setAttribute('aria-pressed','false');this.topViewButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4Z M8 6V3h8v3 M8 10h8v6H8Z"/><path d="M2 10v6m20-6v6M9 22h6"/></svg><span class="analysis-room-topview__label"></span>';this.topViewLabel=this.topViewButton.querySelector('span');this.container.append(this.topViewButton);this.topViewButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(this.blocked()||!this.ordinaryOutdoorVisit())return;if(this.controller.toggleOutdoorTopView())this.updateControls();});
  this.badge=document.createElement('div');this.badge.className='analysis-room-badge';this.badge.hidden=true;this.badge.innerHTML='<span></span><strong></strong>';view.element.append(this.badge);
  this.panel=document.createElement('section');this.panel.id=roomId==='analysis-room'?'analysisRoomChoices':'interiorRoomChoices';this.panel.className='lower-right analysis-room-actions';this.panel.hidden=true;this.panel.setAttribute('aria-label','コンピュータ室での移動');this.panel.innerHTML='<nav aria-label="コンピュータ室の選択肢"><button type="button" data-analysis-map><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/></svg><span>建物マップを開く</span><b aria-hidden="true">›</b></button><button type="button" data-analysis-home><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></svg><span>おこていゆハウスへ戻る</span><b aria-hidden="true">›</b></button></nav>';homeElement.after(this.panel);this.mapButton=this.panel.querySelector('[data-analysis-map]');this.returnButton=this.panel.querySelector('[data-analysis-home]');this.mapButton.addEventListener('click',()=>{if(!this.blocked())this.onMap(this.mapButton);});this.returnButton.addEventListener('click',()=>{if(this.active&&!this.isPaused()&&!isModalBlocked())this.onReturn(this.returnButton);});
 }
 get ready(){return Boolean(this.active&&this.controller?.ready&&!this.controller.contextLost&&!this.loading&&!this.failed);}
 blocked(){return !this.ready||this.isPaused()||isModalBlocked()||document.hidden;}
 ordinaryOutdoorVisit(){return this.roomDefinition.id==='outdoor'&&!this.view.element.closest('[data-story-exploring="true"],[data-conversation-active="true"]');}
 async show(roomId=this.roomDefinition.id){
  const definition=INTERIOR_ROOMS[roomId];if(!definition)return false;this.roomDefinition=definition;this.container.dataset.room=definition.id;this.badge.querySelector('span').textContent=definition.floorLabel;this.badge.querySelector('strong').textContent=definition.title;this.panel.setAttribute('aria-label',definition.title+'での移動');this.panel.querySelector('nav').setAttribute('aria-label',definition.title+'の選択肢');
  this.view.clear();this.active=true;this.loading=true;this.failed=false;const generation=++this.generation;this.snapshot=visitingSnapshot(this.readPlayer());this.container.classList.add('is-loading');this.view.surface.append(this.container);this.homeElement.hidden=true;this.panel.hidden=false;this.badge.hidden=true;this.status.hidden=false;this.status.querySelector('span').textContent=this.roomDefinition.title+'を準備しています…';this.status.querySelector('button').hidden=true;this.updateControls();
  this.controller??=new AnalysisRoomView({container:this.container,roomDefinition:this.roomDefinition,isPresentationPaused:()=>this.isPaused(),onInspect:event=>{if(this.active&&this.ready){this.updateControls();this.onInspect(event,this.controller);}},onStatus:text=>{if(this.active){this.status.querySelector('span').textContent=text?this.roomDefinition.title+'を準備しています…':'';this.status.hidden=!text;}},onError:error=>{if(this.active)this.showError(error);}});
  this.controller.roomDefinition=this.roomDefinition;const ready=await this.controller.load(this.snapshot,{presentation:this.roomDefinition.id});if(!this.active||generation!==this.generation)return false;this.loading=false;this.failed=!ready;if(ready){this.controller.setActive(true);this.container.classList.remove('is-loading');this.status.hidden=true;}this.updateControls();return ready;
 }
 updateControls(){const inspection=this.controller?.getInspectionState();this.badge.querySelector('span').textContent=inspection?'詳細観測':this.roomDefinition.floorLabel;this.badge.querySelector('strong').textContent=inspection?inspection.label+' · タップで戻る':this.roomDefinition.title;this.panel.hidden=!this.active;this.badge.hidden=!this.ready;if(this.blocked())this.controller?.cancelLookPointers();this.mapButton.disabled=!this.ready||document.hidden;this.mapButton.setAttribute('aria-disabled',String(this.blocked()));this.returnButton.disabled=!this.active||document.hidden;this.returnButton.setAttribute('aria-disabled',String(!this.active||this.isPaused()||isModalBlocked()));this.topViewButton.hidden=!this.ready||!this.ordinaryOutdoorVisit();this.topViewButton.disabled=this.blocked()||!this.controller?.canToggleOutdoorTopView();const top=this.controller?.cameraMode==='top';this.topViewButton.setAttribute('aria-pressed',String(top));this.topViewButton.setAttribute('aria-label',top?'切り替える前の視点に戻る':'敷地全体を真上から見る');if(!this.topViewButton.hidden)setPaintedText(this.topViewLabel,top?'元の視点':'真上',{background:'#f8f5e8',align:'center',fitText:true,immutableImage:true});}
 advance(dt){if(!this.active)return;this.updateControls();if(!this.blocked())this.controller.advance(dt);}
 async recoverAfterInterruption(){
  if(!this.active||!this.controller)return false;const generation=this.generation;this.loading=true;this.container.classList.add('is-loading');this.status.hidden=false;this.status.querySelector('span').textContent=this.roomDefinition.title+'の表示を復旧しています…';this.updateControls();const ready=await this.controller.recoverAfterInterruption(this.snapshot,{presentation:this.roomDefinition.id});if(!this.active||generation!==this.generation)return false;this.loading=false;this.failed=!ready;if(ready){this.controller.setActive(true);this.container.classList.remove('is-loading');this.status.hidden=true;}this.updateControls();return ready;
 }
 showError(error){this.loading=false;this.failed=true;this.status.hidden=false;this.status.querySelector('span').textContent=this.roomDefinition.title+'を表示できませんでした。通信環境を確認して、もう一度お試しください。';this.status.querySelector('button').hidden=false;this.badge.hidden=true;this.updateControls();this.onError(error);}
 deactivate(){this.active=false;this.generation++;this.controller?.setActive(false);this.controller?.cancelPendingLoad();this.loading=false;this.panel.hidden=true;this.badge.hidden=true;this.status.hidden=true;this.topViewButton.hidden=true;this.container.remove();}
 getDiagnostics(){return {active:this.active,ready:this.ready,loading:this.loading,failed:this.failed,generation:this.generation,view:this.controller?.getDiagnostics()||null};}
 destroy(){this.deactivate();this.controller?.destroy();this.panel.remove();this.badge.remove();releasePaintedLabels(this.container);this.container.replaceChildren();}
}

// Additional interiors share one UI/controller to bound WebGL contexts.
export {AnalysisRoomUI as InteriorRoomUI};
