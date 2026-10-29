import {AURA_STYLES as auraStyles} from './aura-styles.js';
import {TECHNIQUES} from './technique-rules.js';
import {AttackEffects} from './attack-effects.js';
import {SuperAwakeningStage} from './super-awakening-stage.js';
import { getBattleRegionAt } from './patrol-map.js';
import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { loadAssetJson, loadGLTFAsset } from './asset-store.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const species=record=>record?.speciesId||record?.id||'horarara_horaran';
const opponents=snapshot=>snapshot?.enemies||[snapshot?.enemy].filter(Boolean);
const findNode=(model,name)=>{
 let result=model.getObjectByName(name)||model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
 if(!result)model.traverse(node=>{if(!result&&(node.userData?.name===name||node.userData?.original_name===name))result=node;});
 return result;
};
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
function combatOffset(elapsed){
 if(elapsed<0||elapsed>=.5)return 0;
 if(elapsed<.09)return ease(elapsed/.09);
 if(elapsed<.31)return 1-ease((elapsed-.09)/.22);
 return 0;
}

/** Presentation only. The session owns action times, damage and outcomes. */
export class BattleView{
 constructor({container,onStatus=()=>{},onError=()=>{},getContentInsets=()=>({})}={}){
  if(!container)throw new TypeError('戦闘ビューの表示先がありません。');
  Object.assign(this,{container,onStatus,onError,getContentInsets});
  this.ready=false;this.loading=false;this.active=false;this.destroyed=false;this.contextLost=false;
  this.lastError=null;this.renderFrames=0;this.time=0;this.endVisualTime=null;this.snapshot=null;this.actorCache=new Map();this.actorPromises=new Map();this.templateCache=new Map();this.templatePromises=new Map();this.actors={};this.listeners=[];
  this.baseUrl=new URL('./assets/battle3d/',import.meta.url);this.loader=new GLTFLoader();
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(36,1,.01,100);
  this.hemi=new THREE.HemisphereLight(0xfff9e9,0x838f88,2.1);this.scene.add(this.hemi);
  const sun=this.sun=new THREE.DirectionalLight(0xfff0da,2.4);sun.position.set(-3,6,4);this.scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe9f1ff,.6);fill.position.set(3,3,-2);this.scene.add(fill);
  this.stage=new THREE.Group();this.stage.name='Battle.ReviewGround';this.scene.add(this.stage);
 }
 createRenderer(){
  if(this.renderer)return;
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{throw new Error('この端末では戦闘の3D表示を開始できませんでした。');}
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  this.makeEnvironment();
  this.canvas=this.renderer.domElement;this.canvas.className='battle-webgl';this.canvas.style.visibility='hidden';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','おこていゆと珍生物の戦闘。攻撃はその場で行い、疲れると戦闘が終わります。');this.container.append(this.canvas);
  const listen=(type,handler)=>{this.canvas.addEventListener(type,handler);this.listeners.push(()=>this.canvas.removeEventListener(type,handler));};
  listen('webglcontextlost',event=>{event.preventDefault();this.contextLost=true;this.onStatus('戦闘の3D表示を復旧しています…');});
  listen('webglcontextrestored',()=>{this.contextLost=false;this.makeEnvironment();this.resize();this.onStatus('');this.render();});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.container);
 }
 makeEnvironment(){
  // A small reflection map preserves the approved metallic gold material.
  // These light cards are captured once and never enter the battle scene.
  const studio=new THREE.Scene();studio.background=new THREE.Color(0xc4cbcc);
  const addCard=(width,height,position,color)=>{const card=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));card.position.fromArray(position);card.lookAt(0,1,0);studio.add(card);};
  addCard(5,3,[-3,4,4],new THREE.Color().setRGB(3.0,2.7,2.2));
  addCard(4,4,[4,2,1],new THREE.Color().setRGB(1.5,1.8,2.1));
  addCard(3,3,[0,5,-3],new THREE.Color().setRGB(2.0,1.9,1.6));
  const generator=new THREE.PMREMGenerator(this.renderer),target=generator.fromScene(studio,.05,.1,20,{size:128});
  generator.dispose();this.disposeObject(studio);this.environmentTarget?.dispose();this.environmentTarget=target;this.scene.environment=target.texture;this.scene.environmentIntensity=.8;
 }
 async load(snapshot,stage={}){
  const generation=this.fieldGeneration=(this.fieldGeneration||0)+1;this.timeRequest=null;this.atmosphereTarget=null;
  this.loading=true;this.ready=false;this.lastError=null;this.snapshot=snapshot;this.stageOptions=stage;this.time=number(snapshot?.time);this.endVisualTime=null;this.cutin=null;
  if(this.canvas)this.canvas.style.visibility='hidden';
  this.onStatus('戦闘のモデルを読み込んでいます…');
  try{
   this.createRenderer();
   this.manifest??=await loadAssetJson(new URL('manifest.json',this.baseUrl));
   const states=[snapshot.player,...opponents(snapshot)];
   const [records,awakeningActor]=await Promise.all([Promise.all(states.map((state,index)=>this.loadActor(index?species(state):'okoteiyu',state.id||(index?'enemy':'player')))),this.loadActor('okoteiyu','super-awakening')]);
   if(this.destroyed||generation!==this.fieldGeneration)return false;
   for(const record of this.actorCache.values())record.anchor.visible=false;
   this.awakeningStage??=new SuperAwakeningStage();this.awakeningStage.mount(awakeningActor);this.awakeningActor=awakeningActor;
   this.actors=Object.fromEntries(records.map((record,index)=>[states[index].id||(index?'enemy':'player'),record]));
   const player=this.actors.player,enemies=records.slice(1);
   for(const record of records){record.anchor.visible=true;record.hitAt=-Infinity;record.superAt=-Infinity;record.currentClip=null;record.currentActionId=null;record.mixer.stopAllAction();}
   const maxHeight=Math.max(...records.map(record=>record.height));this.separation=Math.max(1.05,maxHeight*1.05,...enemies.map(record=>record.forwardExtent?record.forwardExtent+player.height*.7+Math.max(.35,maxHeight*.22):0));
   const offset=Math.max(.22,maxHeight*.22);player.anchor.position.set(-offset,0,this.separation/2);
   const widths=enemies.map(enemy=>Math.max(.45,enemy.height*.9,(enemy.halfWidth??enemy.fitRadius??0)*2)),gap=.18,total=widths.reduce((sum,width)=>sum+width,0)+gap*(enemies.length-1);let cursor=offset-total/2;
   for(let index=0;index<enemies.length;index++){const enemy=enemies[index];enemy.anchor.position.set(cursor+widths[index]/2,0,-this.separation/2);cursor+=widths[index]+gap;enemy.facing.rotation.y=Math.atan2(player.anchor.position.x-enemy.anchor.position.x,player.anchor.position.z-enemy.anchor.position.z);}
   this.cameraAim=new THREE.Vector3(0,maxHeight*.5,-this.separation*.05);
   this.fieldManifest??=await loadAssetJson(new URL('fields.json',this.baseUrl));
   const fieldRegion=stage.encounterType==='training'?'training':stage.coordinate?getBattleRegionAt(stage.coordinate):stage.region||'residential',fieldTime=stage.timeOfDay==='night'?'night':'day';
   const field=this.fieldManifest.models.find(m=>m.id===fieldRegion+'_'+fieldTime);if(!field)throw new Error('戦闘フィールドが見つかりません。');
   const fieldUrl=new URL(field.url,this.baseUrl);fieldUrl.searchParams.set('v',field.sha256);
   const fieldGLTF=await loadGLTFAsset(this.loader,fieldUrl.href);if(this.destroyed||generation!==this.fieldGeneration){this.disposeObject(fieldGLTF.scene);return false;}this.makeStage({...stage,region:fieldRegion,timeOfDay:fieldTime},maxHeight);
   this.field=field;this.fieldScene=fieldGLTF.scene;this.fieldScene.scale.setScalar(Math.max(1,maxHeight/1.2));this.fieldScene.position.y=-.02;this.stage.add(this.fieldScene);
   this.scene.background.set(field.sky);this.scene.fog.color.set(field.sky);this.hemi.intensity=field.ambient;this.sun.intensity=field.sunIntensity;this.sun.color.set(field.sunColor);this.cutin=null;
   if(['acrylic_shield','iron_shield','aura_shield'].includes(snapshot.player.equipment?.defense))await this.prepareShield(player,snapshot.player.equipment.defense);
   if(this.destroyed||generation!==this.fieldGeneration)return false;
   this.ready=true;this.loading=false;this.resize();this.updatePose();this.render();this.onStatus('');return true;
  }catch(error){if(this.destroyed||generation!==this.fieldGeneration)return false;this.ready=false;this.loading=false;this.lastError=error instanceof Error?error.message:String(error);this.onStatus('');this.onError(error);return false;}
 }
 async prepareShield(player,id='acrylic_shield'){
  player.shields??=new Map();for(const shield of player.shields.values())shield.visible=false;
  if(player.shields.has(id)){player.shield=player.shields.get(id);player.shield.visible=true;return;}
  const metadata=id==='acrylic_shield'?await loadAssetJson(new URL('../equipment3d/metadata.json',this.baseUrl)):(await loadAssetJson(new URL('../equipment3d/items.json',this.baseUrl))).models.find(m=>m.id===id);
  if(!metadata)throw new Error('防御もちもののモデルがありません。');
  const url=new URL('../equipment3d/'+metadata.url,this.baseUrl);url.searchParams.set('v',metadata.sha256);
  const gltf=await loadGLTFAsset(this.loader,url.href),shield=gltf.scene;shield.name='Battle.FloatingShield.'+id;
  shield.scale.setScalar(id==='iron_shield'?1.15:1.35);shield.position.set(player.height*.30,player.height*.53,player.height*.62);
  if(id==='aura_shield')shield.traverse(n=>{if(n.isMesh){n.material.depthWrite=false;n.material.side=THREE.DoubleSide;}});
  player.facing.add(shield);player.shields.set(id,shield);player.shield=shield;
 }
 setTimeOfDay(timeOfDay){
  if(!this.ready||!this.field||!['day','night'].includes(timeOfDay)||this.timeRequest?.timeOfDay===timeOfDay||(!this.timeRequest&&this.field.timeOfDay===timeOfDay))return false;
  const field=this.fieldManifest.models.find(f=>f.region===this.field.region&&f.timeOfDay===timeOfDay);if(!field)return false;
  const request={timeOfDay,generation:this.fieldGeneration};this.timeRequest=request;
  const url=new URL(field.url,this.baseUrl);url.searchParams.set('v',field.sha256);
  loadGLTFAsset(this.loader,url.href).then(gltf=>{
   if(this.destroyed||this.timeRequest!==request||request.generation!==this.fieldGeneration){this.disposeObject(gltf.scene);return;}
   gltf.scene.scale.copy(this.fieldScene.scale);gltf.scene.position.copy(this.fieldScene.position);
   this.stage.remove(this.fieldScene);this.disposeObject(this.fieldScene);this.fieldScene=gltf.scene;this.stage.add(gltf.scene);this.field=field;this.timeRequest=null;
   this.atmosphereTarget={sky:new THREE.Color(field.sky),sun:new THREE.Color(field.sunColor),ambient:field.ambient,intensity:field.sunIntensity};
  }).catch(error=>{if(this.timeRequest===request){this.timeRequest=null;this.lastError=error.message;this.onError(error);}});
  return true;
 }
 updateAtmosphere(dt){
  const target=this.atmosphereTarget;if(!target)return;const t=1-Math.exp(-Math.max(0,dt)*3);
  this.scene.background.lerp(target.sky,t);this.scene.fog.color.copy(this.scene.background);this.sun.color.lerp(target.sun,t);
  this.hemi.intensity+=(target.ambient-this.hemi.intensity)*t;this.sun.intensity+=(target.intensity-this.sun.intensity)*t;
 }
 modelRecord(id){
  const models=this.manifest?.models;
  const record=Array.isArray(models)?models.find(value=>value.id===id||value.character_id===id):models?.[id];
  if(!record?.url)throw new Error('戦闘モデルの設定が見つかりません：'+id);
  return record;
 }
 async loadTemplate(id){
  if(this.templateCache.has(id))return this.templateCache.get(id);
  if(this.templatePromises.has(id))return this.templatePromises.get(id);
  const promise=(async()=>{const definition=this.modelRecord(id),url=new URL(definition.url,this.baseUrl);if(definition.sha256)url.searchParams.set('v',definition.sha256);
   const gltf=await loadGLTFAsset(this.loader,url.href,{onProgress:event=>{if(event.total)this.onStatus('戦闘のモデルを読み込んでいます… '+Math.round(event.loaded/event.total*100)+'%');}});
   if(this.destroyed){this.disposeObject(gltf.scene);throw new Error('戦闘ビューを終了しました。');}this.templateCache.set(id,gltf);return gltf;
  })();this.templatePromises.set(id,promise);try{return await promise;}finally{this.templatePromises.delete(id);}
 }
 async loadActor(id,instanceId=id){
  const key=instanceId+':'+id;if(this.actorCache.has(key))return this.actorCache.get(key);
  if(this.actorPromises.has(key))return this.actorPromises.get(key);
  const promise=(async()=>{
   const definition=this.modelRecord(id),gltf=await this.loadTemplate(id);
   if(this.destroyed)throw new Error('戦闘ビューを終了しました。');
   // Current approved actors use node/morph animation. Mesh.clone keeps each
   // instance's morph weights and transforms independent while sharing GPU data.
   const model=gltf.scene.clone(true);
   const anchor=new THREE.Group(),facing=new THREE.Group(),hitRoot=new THREE.Group(),attackRoot=new THREE.Group();anchor.name='Battle.Actor.'+instanceId;facing.name='Battle.Facing.'+instanceId;hitRoot.name='Battle.Hit.'+instanceId;attackRoot.name='Battle.Attack.'+instanceId;
   anchor.add(facing);facing.add(model);
   const authoredMotion=findNode(model,definition.motionRoot||'Combat.MotionRoot');
   if(authoredMotion?.parent){const parent=authoredMotion.parent;parent.add(hitRoot);hitRoot.add(attackRoot);attackRoot.add(authoredMotion);}
   else{facing.remove(model);facing.add(hitRoot);hitRoot.add(attackRoot);attackRoot.add(model);}
   this.scene.add(anchor);anchor.visible=false;
   const height=number(definition.height??definition.height_m??definition.canonical_height_m,id==='moai_king'?2.5:id==='okoteiyu'?.45:.4);
   const record={id,instanceId,definition,anchor,facing,hitRoot,attackRoot,model,height,clips:gltf.animations,mixer:new THREE.AnimationMixer(model),actions:new Map(),hitAt:-Infinity,superAt:-Infinity,currentClip:null,currentActionId:null,fixedGround:findNode(model,'Combat.GroundFrame')};
   if(definition.expansionRevision){model.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());record.fitRadius=Math.max(size.x,size.z)/2;if(definition.expansionRevision==='R089'){record.visualBounds=bounds;record.forwardExtent=Math.max(0,bounds.max.z);record.halfWidth=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x));}}
   record.appearance={};for(const [name,names]of Object.entries(definition.appearance||{}))record.appearance[name]=(Array.isArray(names)?names:[]).map(name=>findNode(record.model,name)).filter(Boolean);
   if(id==='okoteiyu'){this.prepareAuraMaterials(record);record.glow=this.makeGlow(height);hitRoot.add(record.glow);}
   record.model.traverse(node=>{if(node.isMesh){node.frustumCulled=true;node.castShadow=false;node.receiveShadow=false;if(definition.softAlpha){for(const material of Array.isArray(node.material)?node.material:[node.material])if(material.transparent){material.depthWrite=false;material.side=THREE.DoubleSide;}}}});
   this.actorCache.set(key,record);return record;
  })();this.actorPromises.set(key,promise);try{return await promise;}finally{this.actorPromises.delete(key);}
 }
 prepareAuraMaterials(record){
  const clones=new Map();record.auraMaterials=[];
  for(const root of record.appearance.whiteAuraNodes||[])root.traverse(node=>{if(!node.isMesh)return;const copy=original=>{if(!clones.has(original)){const material=original.clone(),entry={original,material,color:original.color?.clone(),emissive:original.emissive?.clone(),emissiveIntensity:original.emissiveIntensity};clones.set(original,entry);record.auraMaterials.push(entry);}return clones.get(original).material;};node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);});
 }
 applyAuraColor(record,auraId){
  const id=auraStyles[auraId]?auraId:'okoteiyu';if(record.auraId===id)return;
  record.auraId=id;const style=auraStyles[id],tint=new THREE.Color(style.color);record.auraColor=style.color;
  for(const [i,entry]of (record.auraMaterials||[]).entries()){const color=style.palette?new THREE.Color(style.palette[i%style.palette.length]):tint;if(entry.color)entry.material.color.copy(entry.color).multiply(color);if(entry.emissive)entry.material.emissive.copy(entry.emissive).multiply(color);if(entry.emissiveIntensity!==undefined)entry.material.emissiveIntensity=entry.emissiveIntensity*style.emissiveScale;}
  if(record.glow){record.glow.userData.baseMap??=record.glow.material.map;record.glow.material.map=style.palette?this.paletteAuraTexture(id,style.palette):record.glow.userData.baseMap;record.glow.material.needsUpdate=true;}
 }
 paletteAuraTexture(id,palette){
  this.auraTextureCache??=new Map();if(this.auraTextureCache.has(id))return this.auraTextureCache.get(id);
  const size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size),colors=palette.map(c=>new THREE.Color(c)),highContrast=palette.some(c=>c===0x08090e);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const dx=(x-size/2)/(size/2),dy=(y-size/2)/(size/2),r=Math.hypot(dx,dy),angle=(Math.atan2(dy,dx)/Math.PI/2+1)%1,u=(angle+.07*Math.sin(r*15))*colors.length,index=Math.floor((u+colors.length)%colors.length),mix=((u%1)+1)%1,color=colors[index].clone().lerp(colors[(index+1)%colors.length],highContrast?THREE.MathUtils.smoothstep(mix,.4,.6):mix),i=(y*size+x)*4;
   pixels.data[i]=Math.round(THREE.MathUtils.clamp(color.r,0,1)*255);pixels.data[i+1]=Math.round(THREE.MathUtils.clamp(color.g,0,1)*255);pixels.data[i+2]=Math.round(THREE.MathUtils.clamp(color.b,0,1)*255);pixels.data[i+3]=Math.round(Math.max(0,1-Math.abs(r-.65)/.32)*Math.max(0,Math.min(1,(1-r)*5))*190);
  }
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.auraTextureCache.set(id,texture);return texture;
 }
 makeGlow(height){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(64,64,8,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.48,'rgba(255,255,255,.16)');gradient.addColorStop(.70,'rgba(255,255,255,.28)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xffffff,transparent:true,opacity:.62,depthWrite:false,toneMapped:false}));sprite.position.set(0,height*.51,-.045);sprite.scale.set(height*1.48,height*1.55,1);sprite.name='Battle.SoftAura';return sprite;
 }
 clearStage(){for(const child of [...this.stage.children]){this.stage.remove(child);this.disposeObject(child);}}
 makeStage({region='residential',timeOfDay='day'}={},height=.45){
  this.clearStage();const scale=Math.max(.6,height),forest=region==='forest',city=region==='city';
  const sky=timeOfDay==='morning'?0xe8e4dc:0xe4edf0;this.scene.background=new THREE.Color(sky);this.scene.fog=new THREE.Fog(sky,scale*5,scale*13);
  const shadowTexture=this.shadowTexture??=this.makeShadowTexture();
  for(const record of Object.values(this.actors)){
   const shadow=new THREE.Mesh(new THREE.PlaneGeometry(record.height*.72,record.height*.44),new THREE.MeshBasicMaterial({map:shadowTexture,color:0x354442,transparent:true,opacity:.27,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(record.anchor.position.x,.001,record.anchor.position.z);this.stage.add(shadow);
  }

 }
 makeShadowTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);}
 setSnapshot(snapshot){
  this.snapshot=snapshot;const ended=snapshot?.phase==='ended'||snapshot?.status==='ended';
  if(ended){if(this.endVisualTime===null)this.endVisualTime=number(snapshot?.time,this.time);this.time=Math.max(this.time,this.endVisualTime);}
  else{this.endVisualTime=null;this.time=number(snapshot?.time,this.time);}
 }
 handleEvent(event){
  const type=event?.type||event?.kind,at=number(event?.time,this.snapshot?.time??this.time);
  if(type==='damage'||type==='hit'){const target=this.actors[event.target||event.actor];if(target)target.hitAt=at;}
  if(type==='super-start'){const actor=this.actors[event.actor||'player'];if(actor){actor.superAt=at;this.cutin={elapsed:0,duration:1.5};}}
 }
 resolveClip(record,key){
  const name=record.definition.clips?.[key]||key;return record.clips.find(clip=>clip.name===name)||record.clips.find(clip=>clip.name.toLowerCase()===String(name).toLowerCase());
 }
 action(record,clip){if(!clip)return null;if(!record.actions.has(clip.name))record.actions.set(clip.name,record.mixer.clipAction(clip));return record.actions.get(clip.name);}
 makeEnemyRay(record){
  const group=new THREE.Group();group.name='Battle.EnemyEnergyRay';group.visible=false;record.anchor.add(group);
  const geometry=new THREE.CylinderGeometry(1,1,1,20,1,true),meshes=[];
  for(const [radius,opacity,color]of [[.027,.95,0xfffdf0],[.055,.22,0xffee9e],[.085,.08,0xffffdf]]){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false}));mesh.userData.rayRadius=record.height*radius;mesh.userData.rayOpacity=opacity;group.add(mesh);meshes.push(mesh);}
  return {group,meshes};
 }
 sampleEnemyEffects(record,current){
  const active=(TECHNIQUES[current?.technique]?.motion||current?.technique)==='energy_ray';if(!active){if(record.enemyRay)record.enemyRay.group.visible=false;return;}
  const effect=record.enemyRay??=this.makeEnemyRay(record),elapsed=number(current.elapsed,this.time-number(current.startedAt,this.time)),duration=current.duration||.8;
  effect.group.visible=elapsed>=.1&&elapsed<duration;if(!effect.group.visible)return;
  record.anchor.updateWorldMatrix(true,true);const origin=record.attackRoot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,record.height*.78,0));
  const player=this.actors.player;if(!player){effect.group.visible=false;return;}const target=player.anchor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,player.height*.58,0));
  const direction=target.clone().sub(origin).normalize();origin.addScaledVector(direction,record.height*.1);const length=origin.distanceTo(target)+player.height*.12;
  const from=record.anchor.worldToLocal(origin.clone()),to=record.anchor.worldToLocal(origin.clone().add(direction));effect.group.position.copy(from);effect.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());
  const envelope=ease((elapsed-.1)/.12)*ease((duration-elapsed)/.15);
  for(const mesh of effect.meshes){mesh.position.y=length/2;mesh.scale.set(mesh.userData.rayRadius,length,mesh.userData.rayRadius);mesh.material.opacity=mesh.userData.rayOpacity*envelope;}
 }
 sampleActor(record,state,role){
  if(!record||!state)return;
  const current=state.action,technique=current?.technique||null,motion=TECHNIQUES[technique]?.motion||technique,superActive=Boolean(state.superActive??this.snapshot?.super?.active),auraActive=state.auraId!==null&&state.auraId!=='none';
  const idle=this.resolveClip(record,'idle');
  let clip=null,key='idle';
  if(role==='player'&&current){
   key=motion==='punch'?(superActive?'punchSuper':auraActive?'punchAura':'punchNormal'):motion;
   clip=this.resolveClip(record,key)||this.resolveClip(record,technique);
  }
  for(const action of record.actions.values()){action.enabled=false;action.setEffectiveWeight(0);}
  const chosen=clip||idle,action=this.action(record,chosen);
  if(action){action.enabled=true;action.setEffectiveWeight(1);action.setEffectiveTimeScale(0);action.play();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.paused=false;
   const duration=number(current?.duration,chosen.duration),elapsed=current?number(current.elapsed,this.time-number(current.startedAt,this.time)):this.time;
   action.time=clip?clamp(elapsed/Math.max(.001,duration),0,1)*chosen.duration:(this.time%Math.max(.001,chosen.duration));record.mixer.update(0);
  }
  record.currentClip=chosen?.name||null;record.currentActionId=current?.id??null;
  record.hitRoot.position.set(0,0,-record.height*(role==='player'?.06:.16)*combatOffset(this.time-record.hitAt));
  const attackElapsed=current?number(current.elapsed,this.time-number(current.startedAt,this.time)):Infinity;
  record.attackRoot.position.set(0,0,current&&(role!=='player'||motion==='common_attack')?record.height*(role==='player'?.06:.16)*combatOffset(attackElapsed):0);
  if(role!=='player')this.sampleEnemyEffects(record,current);
  const effectKind=TECHNIQUES[technique]?.effect;
  if(effectKind||record.attackEffects){
   record.attackEffects??=new AttackEffects(record);record.anchor.updateWorldMatrix(true,true);
   const target=role==='player'?this.actors[this.snapshot?.targetId]||this.actors.enemy:this.actors.player;
   const muzzle=effectKind==='shell'?findNode(record.model,'Vehicle.Muzzle'):null,origin=muzzle?muzzle.getWorldPosition(new THREE.Vector3()):record.attackRoot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,record.height*.60,0));
   const point=target?.anchor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,target.height*.58,0));
   record.attackEffects.sample(effectKind,current?{...current,elapsed:attackElapsed}:null,origin,point);
  }
  const appearance=record.appearance;
  if(role==='player'){
   this.applyAuraColor(record,state.auraId);
   for(const node of appearance.whiteAuraNodes||[])node.visible=auraActive;
   for(const node of appearance.superNodes||[])node.visible=superActive;
   for(const node of appearance.rayNodes||[])node.visible=motion==='energy_ray';
   if(record.glow){const style=auraStyles[record.auraId]||auraStyles.okoteiyu;record.glow.visible=auraActive||superActive;record.glow.material.color.set(style.palette?0xffffff:superActive&&(!auraActive||record.auraId==='okoteiyu')?0xd5ef59:record.auraColor);record.glow.material.opacity=superActive?.8:style.emphasis?.95:style.palette?.72:.52;record.glow.scale.set(record.height*(superActive||style.emphasis?1.85:1.48),record.height*(superActive||style.emphasis?1.95:1.55),1);}
  }
 }
 updatePose(){
  if(!this.ready||!this.snapshot)return;
  const states=opponents(this.snapshot),target=states.find(state=>state.id===this.snapshot.targetId&&state.hp>0)||states.find(state=>state.hp>0)||states[0],targetRecord=this.actors[target?.id||'enemy'],player=this.actors.player;
  if(player&&targetRecord)player.facing.rotation.y=Math.atan2(targetRecord.anchor.position.x-player.anchor.position.x,targetRecord.anchor.position.z-player.anchor.position.z);
  for(const [id,shield]of player.shields||[])shield.visible=this.snapshot.player.equipment?.defense===id&&!this.cutin;
  this.sampleActor(player,this.snapshot.player,'player');for(const state of states)this.sampleActor(this.actors[state.id||'enemy'],state,state.id||'enemy');this.scene.updateMatrixWorld(true);
 }
 advance(dt){if(this.destroyed||!this.active||!this.ready||this.contextLost)return;this.updateAtmosphere(dt);if(this.endVisualTime!==null)this.time+=Math.max(0,number(dt));if(this.cutin){this.cutin.elapsed+=Math.max(0,number(dt));if(this.cutin.elapsed>=this.cutin.duration)this.cutin=null;}this.updatePose();this.fitCamera();this.render();}
 fitCamera(){
  if(!this.cameraAim||!this.actors.player||!this.actors.enemy)return;
  const direction=new THREE.Vector3(0,.4,1).normalize(),right=new THREE.Vector3(1,0,0),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const insets=this.getContentInsets(),top=Math.min(this.height*.62,Math.max(12,number(insets.top,this.height*.14))),bottom=Math.max(8,number(insets.bottom,12));
  const room=Math.max(.22,(1-(top+bottom)/this.height)*.9),center=(bottom-top)/this.height;
  this.camera.setViewOffset(this.width,this.height,0,center*this.height/2,this.width,this.height);
  const tangent=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));let distance=.5;
  // Fit both canonical bodies plus their soft effects, reserving space for HP.
  for(const actor of Object.values(this.actors)){
   if(actor.visualBounds){
    const b=actor.visualBounds,pad=actor.height*.12;actor.facing.updateWorldMatrix(true,false);
    for(const x of [b.min.x-pad,b.max.x+pad])for(const y of [b.min.y-pad,b.max.y+pad])for(const z of [b.min.z-pad,b.max.z+pad]){
     const relative=new THREE.Vector3(x,y,z).applyMatrix4(actor.facing.matrixWorld).sub(this.cameraAim),vertical=relative.dot(up);
     distance=Math.max(distance,relative.dot(direction)+Math.max(Math.abs(relative.dot(right))/(tangent*this.camera.aspect*.88),Math.abs(vertical)/(tangent*room)));
    }
    continue;
   }
   const large=actor.height>1,radius=Math.max(actor.height*(large?.42:.7),(actor.fitRadius||0)*1.08);
   for(const x of [-radius,radius])for(const y of [-.02,actor.height*(large?1.2:1.55)])for(const z of [-radius,radius]){
    const relative=new THREE.Vector3(x,y,z).add(actor.anchor.position).sub(this.cameraAim),vertical=relative.dot(up);
    distance=Math.max(distance,relative.dot(direction)+Math.max(Math.abs(relative.dot(right))/(tangent*this.camera.aspect*.88),Math.abs(vertical)/(tangent*room)));
   }
  }
  this.camera.position.copy(this.cameraAim).addScaledVector(direction,distance);this.camera.lookAt(this.cameraAim);if(this.scene.fog){const height=Math.max(...Object.values(this.actors).map(actor=>actor.height));this.scene.fog.near=distance+height*3;this.scene.fog.far=distance+height*22;}this.camera.updateMatrixWorld(true);
 }
 resize(){if(!this.renderer)return;const box=this.container.getBoundingClientRect();if(box.width<1||box.height<1)return;this.width=Math.round(box.width);this.height=Math.round(box.height);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.fitCamera();this.render();}
 render(){
  if(!this.ready||!this.active||this.destroyed||this.contextLost)return;
  const awakening=Boolean(this.cutin&&this.awakeningStage&&this.awakeningActor);
  if(awakening){
   this.sampleActor(this.awakeningActor,{...this.snapshot.player,superActive:true,action:{technique:'super_awaken',duration:this.cutin.duration,elapsed:this.cutin.elapsed,id:'awakening-cutin'}},'player');
   this.awakeningStage.scene.environment=this.scene.environment;this.awakeningStage.scene.environmentIntensity=this.scene.environmentIntensity;
   this.awakeningStage.sample(this.cutin.elapsed,this.cutin.duration,{width:this.width,height:this.height,pixelRatio:this.renderer.getPixelRatio()});
   this.renderer.render(this.awakeningStage.scene,this.awakeningStage.camera);
  }else this.renderer.render(this.scene,this.camera);
  const presentation=awakening?'super-awakening':'battle';if(this.canvas.dataset.presentation!==presentation){this.canvas.dataset.presentation=presentation;this.canvas.setAttribute('aria-label',awakening?'星々が煌めく宇宙で、マッスルポーズを取るスーパーおこていゆ状態への覚醒':'おこていゆと珍生物の戦闘。攻撃はその場で行い、疲れると戦闘が終わります。');}
  this.canvas.style.visibility='visible';this.renderFrames++;
 }
 setActive(active){this.active=Boolean(active);if(this.active){this.resize();this.updatePose();this.render();}}
 getDiagnostics(){return {field:this.field?.id||null,awakeningCutin:this.cutin?{...this.cutin}:null,ready:this.ready,loading:this.loading,active:this.active,error:this.lastError,contextLost:this.contextLost,time:this.time,renderFrames:this.renderFrames,size:{width:this.width||0,height:this.height||0},actors:Object.fromEntries(Object.entries(this.actors).map(([role,actor])=>[role,{id:actor.id,height:actor.height,position:actor.anchor.position.toArray(),facingY:actor.facing.rotation.y,currentClip:actor.currentClip,shield:actor.shield?{id:this.snapshot?.player?.equipment?.defense,visible:actor.shield.visible,position:actor.shield.position.toArray(),animations:0}:null,auraId:actor.auraId||null,auraColor:actor.auraColor===undefined?null:'#'+actor.auraColor.toString(16).padStart(6,'0'),auraMaterialCount:actor.auraMaterials?.length||0,hitOffset:actor.hitRoot.position.toArray(),attackOffset:actor.attackRoot.position.toArray(),fixedGroundWorld:actor.fixedGround?.getWorldPosition(new THREE.Vector3()).toArray()||null,meshCount:(()=>{let count=0;actor.model.traverse(node=>{if(node.isMesh)count++;});return count;})()}]))};}
 disposeObject(object){const geometries=new Set(),materials=new Set(),textures=new Set();object?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});for(const value of geometries)value.dispose();for(const value of materials)value.dispose();for(const value of textures)if(value!==this.shadowTexture)value.dispose();}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.active=false;this.resizeObserver?.disconnect();for(const stop of this.listeners)stop();const resources=new THREE.Group();for(const record of this.actorCache.values()){record.mixer.stopAllAction();resources.add(record.anchor);}for(const template of this.templateCache.values())resources.add(template.scene);this.disposeObject(resources);this.awakeningStage?.dispose();this.clearStage();this.shadowTexture?.dispose();for(const texture of this.auraTextureCache?.values()||[])texture.dispose();this.auraTextureCache?.clear();this.environmentTarget?.dispose();this.actorCache.clear();this.actorPromises.clear();this.templateCache.clear();this.templatePromises.clear();this.renderer?.dispose();this.canvas?.remove();}
}
