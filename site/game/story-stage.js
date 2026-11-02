import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {loadAssetJson,loadGLTFAsset,loadAssetBuffer} from './asset-store.js';
import {STORY_ROOM_ASSETS,storyCanvasTexture,createHeadquartersSet,createRoadSet,createStoryBook,createStoryShadow} from './story-stage-assets.js';

const smooth=value=>{const n=THREE.MathUtils.clamp(value,0,1);return n*n*(3-2*n);};
const find=(root,name)=>root.getObjectByName(name)||root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
const vector=value=>new THREE.Vector3(...value);
const savedPose=node=>node?{node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}:null;
const resetPose=pose=>{if(pose){pose.node.position.copy(pose.position);pose.node.quaternion.copy(pose.quaternion);pose.node.scale.copy(pose.scale);}};
const assetUrl=(path,revision)=>{const url=new URL('./assets/'+path,import.meta.url);if(revision)url.searchParams.set('v',revision);return url;};
function disposeTrees(roots,extraTextures=[]){
 const geometries=new Set(),materials=new Set(),textures=new Set(extraTextures);
 for(const root of roots)root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures){texture.dispose();texture.image?.close?.();}
}

/** The story director owns time and message progression. This renderer never
 * mutates game progress, starts combat, or changes the normal room simulation. */
export class StoryStage {
 constructor({view,onError=()=>{},onReady=()=>{}}={}){
  Object.assign(this,{view,onError,onReady});this.loader=new GLTFLoader();this.templates=new Map();this.environments=new Map();this.pendingActors=[];this.generation=0;this.ready=false;this.active=true;this.elapsed=0;this.totalTime=0;this.renderFrames=0;this.contextLost=false;
  this.container=document.createElement('div');this.container.className='story-stage';Object.assign(this.container.style,{position:'absolute',inset:'0',background:'#e9eadf'});
  this.status=document.createElement('div');this.status.className='house3d-status';this.status.setAttribute('role','status');Object.assign(this.status.style,{position:'absolute',inset:'0',display:'grid',placeContent:'center',gap:'12px',textAlign:'center',padding:'24px',background:'#eeeee3',color:'#6e5943'});
  this.status.innerHTML='<span>物語の場面を準備しています…</span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);
  this.status.querySelector('button').addEventListener('click',()=>{if(this.currentScene)this.show(this.currentScene);});
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e7e8df');this.camera=new THREE.PerspectiveCamera(38,1,.012,80);this.cameraAim=new THREE.Vector3(0,.3,0);
  this.scene.add(new THREE.HemisphereLight(0xfff8e9,0x98a5a0,2.0));this.keyLight=new THREE.DirectionalLight(0xffefd6,2.5);this.keyLight.position.set(-3,6,4);this.scene.add(this.keyLight);const fill=new THREE.DirectionalLight(0xe7f0ff,.85);fill.position.set(3,2,-4);this.scene.add(fill);
  this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(this.container);
 }
 createRenderer(){
  if(this.renderer)return;
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.canvas=this.renderer.domElement;this.canvas.className='story-stage-webgl';this.canvas.setAttribute('role','img');Object.assign(this.canvas.style,{display:'block',width:'100%',height:'100%',visibility:'hidden'});this.container.prepend(this.canvas);
  this.onContextLost=event=>{event.preventDefault();this.contextLost=true;this.status.hidden=false;this.status.style.display='grid';this.status.querySelector('span').textContent='物語の表示を復旧しています…';};
  this.onContextRestored=()=>{this.contextLost=false;this.status.hidden=true;this.status.style.display='none';this.render();};
  this.canvas.addEventListener('webglcontextlost',this.onContextLost);this.canvas.addEventListener('webglcontextrestored',this.onContextRestored);
 }
 async template(path,revision){
  const url=assetUrl(path,revision),key=url.href;
  if(!this.templates.has(key)){const promise=loadGLTFAsset(this.loader,key);this.templates.set(key,promise);promise.catch(()=>this.templates.delete(key));}return this.templates.get(key);
 }
 async makeActor(){
  if(this.actor&&this.moai&&this.punim)return this.actor;
  if(this.actorPromise)return this.actorPromise;
  this.actorPromise=this.loadActors();
  try{return await this.actorPromise;}finally{this.actorPromise=null;}
 }
 async loadActors(){
  const manifest=await loadAssetJson(new URL('./assets/battle3d/manifest.json',import.meta.url)),definition=manifest.models.okoteiyu;
  const gltf=await this.template('battle3d/okoteiyu.glb',definition.sha256);if(this.destroyed)throw new Error('物語の表示を終了しました。');const model=gltf.scene.clone(true),anchor=new THREE.Group();anchor.name='Story.Okoteiyu';anchor.add(model);
  model.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;if(/^(Aura|Super|Ray)/.test(node.name))node.visible=false;}});
  const body=find(model,'Body');body.material=body.material.clone();
  const actor={anchor,model,body,bodyMaterial:body.material,root:find(model,'CharacterRoot'),hands:[find(model,'Hand.L'),find(model,'Hand.R')],feet:[find(model,'Foot.L'),find(model,'Foot.R')]};
  model.updateMatrixWorld(true);actor.bodyRestBottom=new THREE.Box3().setFromObject(body).min.y;
  actor.poses=[actor.root,...actor.hands,...actor.feet].map(savedPose);actor.restY=actor.root.position.y;
  actor.faces={neutral:body.material.map};
  this.pendingActors.push(actor);
  for(const [name,file]of[['happy','happy'],['worried','teary']]){
   const buffer=await loadAssetBuffer(new URL('./assets/scene-cutins/face_'+file+'.png',import.meta.url)),bitmap=await createImageBitmap(new Blob([buffer],{type:'image/png'}));
   if(this.destroyed){bitmap.close?.();throw new Error('物語の表示を終了しました。');}const texture=new THREE.CanvasTexture(bitmap);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;actor.faces[name]=texture;
  }
  actor.faces.surprise=this.makeSurpriseFace(actor.faces.neutral.image);actor.faces.determined=this.makeDeterminedFace(actor.faces.neutral.image);
  actor.book=createStoryBook();actor.book.scale.setScalar(.85);actor.book.position.set(0,.20,.16);actor.book.rotation.x=1.12;actor.book.visible=false;anchor.add(actor.book);actor.shadow=createStoryShadow(.18);anchor.add(actor.shadow);
  this.scene.add(anchor);this.actor=actor;
  const moaiTemplate=await this.template('support3d/moai_kun.glb');if(this.destroyed)throw new Error('物語の表示を終了しました。');const moai=new THREE.Group();moai.name='Story.MoaiKun';moai.add(moaiTemplate.scene.clone(true));this.scene.add(moai);this.moai=moai;this.moaiShadow=createStoryShadow(.105);this.scene.add(this.moaiShadow);
  const punimTemplate=await this.template('battle3d/punim.glb',manifest.models.punim.sha256);if(this.destroyed)throw new Error('物語の表示を終了しました。');const punim=new THREE.Group(),punimModel=punimTemplate.scene.clone(true);punim.add(punimModel);punim.name='Story.Punim';
  const bounds=new THREE.Box3().setFromObject(punimModel),height=bounds.max.y-bounds.min.y,scale=.25/Math.max(.01,height);punimModel.scale.multiplyScalar(scale);punimModel.position.y-=bounds.min.y*scale;this.scene.add(punim);this.punim=punim;this.punimShadow=createStoryShadow(.12);this.scene.add(this.punimShadow);
  return actor;
 }
 makeSurpriseFace(image){
  const texture=storyCanvasTexture((ctx,s)=>{
   ctx.drawImage(image,0,0,s,s);ctx.scale(s/1024,s/1024);ctx.fillStyle='#ffe2cd';ctx.fillRect(401,310,220,99);ctx.fillRect(407,344,76,101);ctx.fillRect(541,344,78,101);
   ctx.strokeStyle='#554b4a';ctx.lineCap='round';ctx.lineWidth=4;
   for(const x of[445,579]){ctx.beginPath();ctx.moveTo(x-24,333);ctx.quadraticCurveTo(x,319,x+24,331);ctx.stroke();ctx.fillStyle='#fffaf4';ctx.beginPath();ctx.ellipse(x,389,28,43,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#574c4a';ctx.beginPath();ctx.ellipse(x,390,18,30,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fffdf9';ctx.beginPath();ctx.ellipse(x-6,377,4,7,0,0,Math.PI*2);ctx.fill();}
   ctx.fillStyle='#ffe2cd';ctx.fillRect(491,473,42,34);ctx.fillStyle='#5b4c47';ctx.beginPath();ctx.ellipse(512,488,9,11,0,0,Math.PI*2);ctx.fill();
  },1024);texture.flipY=false;return texture;
 }
 makeDeterminedFace(image){
  const texture=storyCanvasTexture((ctx,s)=>{ctx.drawImage(image,0,0,s,s);ctx.scale(s/1024,s/1024);ctx.fillStyle='#ffe2cd';ctx.fillRect(390,281,244,66);ctx.strokeStyle='#554b4a';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(407,317);ctx.quadraticCurveTo(438,323,471,312);ctx.moveTo(553,312);ctx.quadraticCurveTo(585,323,615,317);ctx.stroke();},1024);texture.flipY=false;return texture;
 }
 async environment(stage){
  if(this.environments.has(stage)){const cached=this.environments.get(stage);this.environments.delete(stage);this.environments.set(stage,cached);return cached;}
  let environment;
  if(stage==='headquarters')environment=createHeadquartersSet();
  else if(stage==='road')environment=createRoadSet();
  else{
   const definition=STORY_ROOM_ASSETS[stage];if(!definition)throw new RangeError('物語の場面が見つかりません。');
   const metadata=definition.metadata?await loadAssetJson(new URL('./assets/'+definition.metadata,import.meta.url)):{};
   const gltf=await this.template(definition.url,metadata.glbSha256||metadata.model?.sha256);if(this.destroyed)throw new Error('物語の表示を終了しました。');const root=gltf.scene.clone(true);
   root.traverse(node=>{
    if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}
    const role=node.userData?.house_role;
    if(role==='wall_entry'||role==='ceiling'||['Life.ActorRoot','Life.CompanionRoot','Life.Bed.HalfBlanket'].includes(node.name))node.visible=false;
   });
   for(const name of ['Life.ActorRoot','Life.CompanionRoot','Life.Bed.HalfBlanket'])if(find(root,name))find(root,name).visible=false;
   for(const name of metadata.hideFromEntranceCamera||[])if(find(root,name))find(root,name).visible=false;
   const settings={
    house:{actorPosition:[-.65,0,-1.10],cameraWide:{position:[-.40,.63,.15],target:[-.50,.10,-2.65],fov:62}},
    'computer-room':{actorPosition:[0,0,1.72],cameraWide:{position:[.6,1.1,3.55],target:[0,.16,.75],fov:52}},
    lounge:{actorPosition:[8.8,0,.22],actorYaw:.65,cameraWide:{position:[10.3,.9,1.7],target:[8.4,.14,-.2],fov:50}},
    'player-room':{actorPosition:[.05,0,1.95],cameraWide:{position:[.55,.95,3.9],target:[0,.12,1.10],fov:52}},
    'training-hall':{actorPosition:[.3,0,.3],cameraWide:{position:[.75,.78,2.7],target:[.25,.13,-.2],fov:48}}
   }[stage];
   environment={root,metadata,templateKey:assetUrl(definition.url,metadata.glbSha256||metadata.model?.sha256).href,...settings};
   if(stage==='house'){
    environment.door=find(root,'Door.Slider');environment.doorClosed=0;environment.doorTravel=1.5;
    root.updateMatrixWorld(true);const cushion=find(root,'Web.Static.room.43');environment.seatTop=cushion?new THREE.Box3().setFromObject(cushion).max.y:.0795;
   }
  }
  this.environments.set(stage,environment);return environment;
 }
 trimEnvironments(){
  // Parsed GLBs are local to this StoryStage. The global asset store retains
  // source buffers, so revisiting an evicted room needs no second download.
  while(this.environments.size>2){const key=[...this.environments.keys()].find(id=>id!==this.stageName),environment=this.environments.get(key);this.environments.delete(key);environment.root.removeFromParent();disposeTrees([environment.root]);if(environment.templateKey)this.templates.delete(environment.templateKey);}
 }
 async show(scene){
  if(this.destroyed)return false;this.currentScene={...scene};this.active=true;const generation=++this.generation,newStage=this.stageName!==scene.stage;this.ready=false;
  if(newStage||!this.renderer){this.status.hidden=false;this.status.style.display='grid';this.status.querySelector('span').textContent='物語の場面を準備しています…';this.status.querySelector('button').hidden=true;if(this.canvas)this.canvas.style.visibility='hidden';}
  try{
   this.createRenderer();await this.makeActor();const environment=await this.environment(scene.stage);if(this.destroyed||generation!==this.generation)return false;
   if(newStage){
    this.environmentSet?.root.removeFromParent();this.environmentSet=environment;this.scene.add(environment.root);this.stageName=scene.stage;this.actor.anchor.position.fromArray(environment.actorPosition);this.actor.anchor.rotation.set(0,0,0);
    const road=scene.stage==='road';this.scene.background=new THREE.Color(road?'#dce9eb':'#e7e8df');this.scene.fog=road?new THREE.Fog('#dce9eb',14,37):null;
    if(environment.door)environment.door.position.x=environment.doorClosed+(scene.stage==='house'&&scene.animation!=='door'?environment.doorTravel:0);this.trimEnvironments();
   }
   this.elapsed=0;this.sceneStartPosition=this.actor.anchor.position.clone();this.actorTarget=this.sceneStartPosition.clone();
   if(scene.animation==='sit'&&scene.stage==='house')this.actorTarget.set(.05,environment.seatTop-this.actor.bodyRestBottom+.028,-1.33);
   else if(scene.stage==='house'&&this.sceneStartPosition.y>.03)this.actorTarget.y=environment.seatTop+.002;
   this.actor.book.visible=Boolean(scene.prop==='book'||scene.prop==='paper'||/記録帳|案内の紙/.test(scene.text||''));
   this.actor.bodyMaterial.map=this.actor.faces[scene.expression]||this.actor.faces.neutral;this.actor.bodyMaterial.needsUpdate=true;
   this.punim.visible=scene.stage==='road'&&scene.punimVisible===true;this.punimShadow.visible=this.punim.visible;
   this.setCamera(scene,newStage);this.ready=true;this.status.hidden=true;this.status.style.display='none';this.sample();this.render();this.onReady(scene);return true;
  }catch(error){
   if(this.destroyed||generation!==this.generation)return false;this.lastError=error?.message||String(error);this.status.hidden=false;this.status.style.display='grid';this.status.querySelector('span').textContent='物語の場面を表示できませんでした。';this.status.querySelector('button').hidden=false;this.onError(error);return false;
  }
 }
 setCamera(scene,immediate){
  const position=this.actorTarget.clone(),wide=scene.shot==='wide'||['computer-room','lounge','training-hall'].includes(scene.stage);
  let target,eye,fov;
  if(wide){const config=this.environmentSet.cameraWide;eye=vector(config.position);target=vector(config.target);fov=config.fov;}
  else{
   const close=scene.shot==='close';eye=position.clone().add(vector(close?[.29,.43,1.08]:[.46,.63,1.70]));target=position.clone().add(vector(close?[.08,.30,0]:[.11,.22,0]));fov=close?34:36;
  }
  this.cameraGoal={position:eye,target,fov};this.cameraFrom={position:this.camera.position.clone(),target:this.cameraAim.clone(),fov:this.camera.fov};this.cameraElapsed=immediate?2:0;
  if(immediate){this.camera.position.copy(eye);this.cameraAim.copy(target);this.camera.fov=fov;}
 }
 sample(){
  if(!this.actor||!this.currentScene)return;const actor=this.actor,t=this.elapsed,animation=this.currentScene.animation||'idle',settle=smooth(t/1.65),moving=this.sceneStartPosition.distanceTo(this.actorTarget)>.03;
  for(const pose of actor.poses)resetPose(pose);
  actor.anchor.position.copy(this.sceneStartPosition).lerp(this.actorTarget,settle);actor.anchor.rotation.set(0,this.environmentSet.actorYaw||0,0);
  const walking=animation==='walk'||moving&&settle<1,walkPhase=t*9;
  if(walking){
   if(animation==='walk')actor.anchor.position.z+=.30*smooth(t/4.5);
   actor.root.position.y+=.007*Math.abs(Math.sin(walkPhase));actor.root.rotateZ(.016*Math.sin(walkPhase));
   actor.feet.forEach((foot,index)=>{const stride=Math.sin(walkPhase+index*Math.PI);foot.position.x+=.018*stride;foot.position.y+=.012*Math.max(0,stride);foot.rotateZ(-.11*stride);});
   actor.hands.forEach((hand,index)=>hand.rotateX(.12*Math.sin(walkPhase+index*Math.PI)));
  }else{actor.root.position.y+=.002*Math.sin(this.totalTime*2.2);}
  if(animation==='nod')actor.root.rotateZ(-.10*Math.sin(Math.min(1,t/1.6)*Math.PI));
  if(animation==='thinking'){actor.root.rotateZ(-.035);actor.root.rotateX(.035*Math.sin(t*.8));actor.hands[0].position.x+=.012;actor.hands[0].position.y+=.012;}
  if(animation==='look')actor.anchor.rotation.y+=.13*Math.sin(Math.min(t,5)*.8);
  if(animation==='wave'){
   const envelope=Math.sin(Math.min(1,t/3.4)*Math.PI);actor.hands[0].position.y+=.028*envelope;actor.hands[0].position.x+=.012*envelope;actor.hands[0].rotateX(.28*envelope*Math.sin(t*8));actor.hands[0].scale.y*=1+.12*envelope;
  }
  if(animation==='surprise'){
   const jump=t<.9?.035*Math.sin(t/.9*Math.PI):0;actor.root.position.y+=jump;actor.root.rotateZ(.07*Math.sin(Math.min(1,t/1.3)*Math.PI));actor.anchor.position.z+=.035*smooth(t/1.2);actor.anchor.rotation.y+=.20*Math.sin(Math.min(1,t/2.8)*Math.PI);
   actor.hands.forEach((hand,index)=>{hand.position.y+=.018*smooth(t/.4);hand.rotateX((index?1:-1)*.13*smooth(t/.4));});
  }
  if(animation==='happy'){
   const phase=t<2.5?(t%1.25)/1.25:0;actor.root.position.y+=t<2.5?.055*Math.sin(phase*Math.PI):0;actor.root.rotateX(.02*Math.sin(t*5));
  }
  if(animation==='sit'){
   const seat=smooth((t-1.1)/1.3);if(moving&&settle<1)actor.anchor.position.y+=.07*Math.sin(settle*Math.PI);
   actor.root.position.y-=.025*seat;actor.root.rotateZ(.065*seat);actor.feet.forEach(foot=>{foot.position.x+=.050*seat;foot.position.y+=.035*seat;});
  }
  if(actor.book.visible)actor.hands.forEach((hand,index)=>{hand.position.x+=.025;hand.position.y+=.030;hand.position.z+=(index?1:-1)*.020;});
  if(animation==='door'&&this.environmentSet.door){
   const open=smooth((t-.3)/1.6);this.environmentSet.door.position.x=this.environmentSet.doorClosed+this.environmentSet.doorTravel*open;
   actor.hands.forEach(hand=>{hand.position.x+=.012*Math.sin(open*Math.PI);hand.position.y+=.016*Math.sin(open*Math.PI);});
   if(this.stageName==='house')actor.anchor.position.z-=.28*smooth((t-1.7)/2.2);
  }
  const moaiHop=walking?Math.max(0,Math.sin(t*7))*.042:Math.max(0,Math.sin(this.totalTime*2.0))*.009;
  this.moai.position.copy(actor.anchor.position).add(new THREE.Vector3(-.34,0,-.20));this.moai.position.y=moaiHop;this.moai.rotation.y=actor.anchor.rotation.y-.05;this.moaiShadow.position.set(this.moai.position.x,.008,this.moai.position.z);
  if(this.punim.visible){
   const tired=this.currentScene.punimState==='tired',approach=animation==='surprise'?smooth(t/2.8):0;
   this.punim.position.set(actor.anchor.position.x+.54,tired?.002:.018*Math.max(0,Math.sin(t*4.4)),actor.anchor.position.z-1.10+.55*approach);this.punim.rotation.y=tired?-.5:0;this.punim.rotation.z=tired?.10:.035*Math.sin(t*2.7);this.punimShadow.position.set(this.punim.position.x,.008,this.punim.position.z);
  }
  const cameraMix=smooth(this.cameraElapsed/1.4);this.camera.position.copy(this.cameraFrom.position).lerp(this.cameraGoal.position,cameraMix);this.cameraAim.copy(this.cameraFrom.target).lerp(this.cameraGoal.target,cameraMix);this.camera.fov=THREE.MathUtils.lerp(this.cameraFrom.fov,this.cameraGoal.fov,cameraMix);this.camera.lookAt(this.cameraAim);this.camera.updateProjectionMatrix();this.scene.updateMatrixWorld(true);
 }
 update(dt){
  if(!this.ready||!this.active||this.destroyed||this.contextLost||document.hidden)return;
  const elapsed=Math.min(.25,Math.max(0,Number(dt)||0));this.elapsed+=elapsed;this.totalTime+=elapsed;this.cameraElapsed+=elapsed;this.sample();this.render();
 }
 advance(dt){this.update(dt);}
 setActive(active){this.active=Boolean(active);if(this.active)this.render();}
 render(){
  if(!this.ready||!this.active||this.destroyed||this.contextLost||!this.renderer)return;const rect=this.container.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  const width=Math.round(rect.width),height=Math.round(rect.height);if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  this.renderer.render(this.scene,this.camera);this.canvas.style.visibility='visible';this.canvas.dataset.storyStage=this.stageName;this.canvas.dataset.storyAnimation=this.currentScene.animation||'idle';this.canvas.dataset.storyExpression=this.currentScene.expression||'neutral';this.canvas.setAttribute('aria-label',this.stageName==='road'?'住宅街を進むおこていゆとモアイくんの3D場面':'おこていゆの物語の3D場面');this.renderFrames++;
 }
 async recoverAfterInterruption(){
  if(this.destroyed||!this.currentScene)return false;
  if(!this.actor||!this.moai||!this.punim||!this.environmentSet||this.stageName!==this.currentScene.stage)return this.show(this.currentScene);
  try{const elapsed=this.elapsed;this.releaseRenderer();this.contextLost=false;this.createRenderer();this.ready=true;this.elapsed=elapsed;this.sample();this.status.hidden=true;this.status.style.display='none';this.render();return true;}
  catch(error){this.ready=false;this.lastError=error?.message||String(error);this.status.hidden=false;this.status.style.display='grid';this.status.querySelector('span').textContent='物語の表示を復旧できませんでした。';this.status.querySelector('button').hidden=false;this.onError(error);return false;}
 }
 releaseRenderer(){
  if(!this.renderer)return;this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.canvas.removeEventListener('webglcontextrestored',this.onContextRestored);this.canvas.remove();this.renderer.dispose();this.renderer.forceContextLoss?.();this.renderer=null;
 }
 getDiagnostics(){return {ready:this.ready,active:this.active,stage:this.stageName||null,sceneId:this.currentScene?.id||null,animation:this.currentScene?.animation||null,expression:this.currentScene?.expression||null,punimVisible:this.punim?.visible||false,punimState:this.currentScene?.punimState||null,elapsed:this.elapsed,renderFrames:this.renderFrames,contextLost:this.contextLost,error:this.lastError||null,environmentCacheSize:this.environments.size,actorPosition:this.actor?.anchor.position.toArray()||null,actorScale:this.actor?.model.scale.toArray()||null,camera:{position:this.camera.position.toArray(),target:this.cameraAim.toArray(),fov:this.camera.fov},size:{width:this.width||0,height:this.height||0}};}
 destroy(){
  if(this.destroyed)return;this.destroyed=true;this.generation++;this.active=false;this.ready=false;this.resizeObserver.disconnect();this.releaseRenderer();this.container.remove();
  disposeTrees([this.scene,...[...this.environments.values()].map(environment=>environment.root),...this.pendingActors.map(actor=>actor.anchor)],this.pendingActors.flatMap(actor=>Object.values(actor.faces||{})));
  this.scene.clear();this.environments.clear();this.templates.clear();this.pendingActors=[];
 }
}
