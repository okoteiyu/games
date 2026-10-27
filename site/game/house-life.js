import * as THREE from './vendor/three/three.module.js';
import {INITIAL_CALM_POINTS} from './initial-state.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const position=value=>new THREE.Vector3(...(Array.isArray(value)?value:value?.position||[0,0,0]));
const FOOD_NAMES={soda_cup:'ソーダ',soda_straw:'ストロー付きソーダ',bacon:'焼いたベーコン',bread:'パン',hamburger:'ハンバーグ',pudding:'プリン'};
const ACTION_NAMES={meal:'食事',fridge_meal:'冷蔵庫からの食事',bed:'ベッドでの休息',chair:'椅子での休息',computer:'研究／読書'};
export const HOUSE_RELAX_ACTIONS=Object.freeze(['meal','bed','chair']);
export const HOUSE_RELAX_MAX_NON_TRAVEL_SECONDS=10;
// Leave room for finite frame boundaries and zero-duration hooks.
export const HOUSE_RELAX_NON_TRAVEL_BUDGET_SECONDS=9.5;
export const HOUSE_MOVEMENT_SPEED=Object.freeze({room:1.5,loftStairs:1.7});

export const HOUSE_RELAX_GAP_SECONDS=10;
export const HOUSE_MIN_RESEARCH_SECONDS=3; // Authoring choice for "a few seconds".
/** Foreground time; each completed rest starts a new cooldown. */
export class HouseLifeSchedule {
 constructor(interval=HOUSE_RELAX_GAP_SECONDS){this.interval=interval;this.activeTime=0;this.nextAt=interval;this.pending=null;this.index=0;this.enabled=true;}
 advance(dt){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('生活時計の時間が正しくありません。');
  this.activeTime+=dt;
  if(this.enabled&&this.activeTime+1e-8>=this.nextAt&&this.pending===null){this.pending=HOUSE_RELAX_ACTIONS[this.index++%HOUSE_RELAX_ACTIONS.length];this.nextAt=Infinity;}
 }
 take(busy){if(busy||this.pending===null)return null;const action=this.pending;this.pending=null;return action;}
 restartInterval(){this.pending=null;this.nextAt=this.enabled?this.activeTime+this.interval:Infinity;}
 waitForCompletion(){this.pending=null;this.nextAt=Infinity;}
}

/** Include both endpoints; AnimationUtils.subclip excludes the last sample. */
export function sliceHouseClip(source,id,start,end){
 if(!(end>start))throw new RangeError('生活モーションの範囲が正しくありません。');
 const tracks=source.tracks.map(track=>{
  const times=[start,...Array.from(track.times).filter(t=>t>start+1e-6&&t<end-1e-6),end];
  const interpolant=track.createInterpolant(),values=[];
  for(const t of times)values.push(...interpolant.evaluate(t));
  return new track.constructor(track.name,times.map(t=>t-start),values,track.getInterpolation());
 });
 return new THREE.AnimationClip(id,end-start,tracks);
}

function defaultNavigation(){
 // These waypoints describe existing furniture, not game movement limits.
 const nodes={
  entrance:[0,0,-.45],front:[0,.027,-.95],table:[0,.027,-1.40],
  leftFront:[-.95,.027,-1.05],leftLane:[-1.30,0,-1.35],leftBack:[-1.35,0,-2.42],
  fridge:[-1.77,0,-2.17],stairsBottom:[-1.88,0,-2.795],stairsTop:[-1.88,.63,-3.80],
  loftLeft:[-1.88,.63,-4.22],loftFront:[.30,.63,-4.22],bedSide:[-1.45,.63,-4.78],bed:[-.72,.846,-4.78],
  chairFront:[1.98,.63,-4.22],chair:[1.98,.946,-4.80],rightFront:[.85,.027,-1.05],
  computerBase:[.85,0,-1.78],computerStep1:[1.12,.21,-1.78],computerStep2:[1.42,.42,-1.78],
  computerStep3:[1.72,.63,-1.78],computer:[1.76,.63,-1.78]
 };
 const edges=[
  ['entrance','front'],['front','table'],['front','leftFront'],['leftFront','leftLane'],['leftLane','leftBack'],['leftBack','fridge'],['leftBack','stairsBottom'],
  ['stairsBottom','stairsTop','stairs'],['stairsTop','loftLeft'],['loftLeft','bedSide'],['bedSide','bed','hop'],['loftLeft','loftFront'],['loftFront','chairFront'],['chairFront','chair','hop'],
  ['front','rightFront'],['rightFront','computerBase'],['computerBase','computerStep1','hop'],['computerStep1','computerStep2','hop'],['computerStep2','computerStep3','hop'],['computerStep3','computer']
 ].map(([from,to,kind='walk'])=>({from,to,kind}));
 return {nodes,edges};
}

function normalizeNavigation(life){
 const fallback=defaultNavigation(),raw=life.routes||life.navigation||{};
 const rawNodes=raw.nodes||fallback.nodes,nodes=new Map();
 for(const [id,value] of Object.entries(rawNodes))nodes.set(id,{id,...(Array.isArray(value)?{position:value}:value)});
 for(const [id,value] of Object.entries(life.landmarks||{})){
  const prior=nodes.get(id)||{};nodes.set(id,{id,...prior,...(Array.isArray(value)?{position:value}:{...value,yaw:value.yawRadians??value.yaw})});
 }
 if(life.computerSteps){
  nodes.set('computerBase',{id:'computerBase',position:life.computerSteps.position});
  for(const [index,p] of (life.computerSteps.steps||[]).entries())nodes.set('computerStep'+(index+1),{id:'computerStep'+(index+1),position:p});
 }
 let edges=(raw.edges||fallback.edges).map(edge=>Array.isArray(edge)?{from:edge[0],to:edge[1],kind:edge[2]||'walk'}:{kind:'walk',...edge});
 edges=edges.filter(edge=>nodes.has(edge.from)&&nodes.has(edge.to));
 return {nodes,edges};
}

export function findHouseRoute(graph,from,to){
 if(from===to)return [];
 if(!graph.nodes.has(from)||!graph.nodes.has(to))throw new Error('室内の移動先が見つかりません。');
 const distance=new Map([[from,0]]),previous=new Map(),open=new Set(graph.nodes.keys());
 while(open.size){
  let node=null,best=Infinity;
  for(const id of open){const value=distance.get(id)??Infinity;if(value<best){node=id;best=value;}}
  if(node===null)break;open.delete(node);if(node===to)break;
  for(const edge of graph.edges){
   const reverse=edge.to===node,other=edge.from===node?edge.to:reverse?edge.from:null;
   if(other===null||!open.has(other))continue;
   const weight=position(graph.nodes.get(node)).distanceTo(position(graph.nodes.get(other)))+(edge.kind==='walk'?0:.12),next=best+weight;
   if(next<(distance.get(other)??Infinity)){distance.set(other,next);previous.set(other,{...edge,from:node,to:other,reverse});}
  }
 }
 if(!previous.has(to))throw new Error('家具を避ける室内経路を取得できませんでした。');
 const route=[];for(let node=to;node!==from;){const edge=previous.get(node);route.unshift(edge);node=edge.from;}return route;
}

/** One actor and one mixer; navigation never replaces the character instance. */
export class HouseLifeDirector {
 constructor({model,mixer,clips,metadata,findNode,onEvent=()=>{},onClipChange=()=>{},canExecuteAction=()=>true,rng=Math.random}){
  Object.assign(this,{model,mixer,metadata,findNode,onEvent,onClipChange,canExecuteAction,rng});
  this.definition=metadata.life||metadata.autonomousLife;
  if(!this.definition)throw new TypeError('自動生活の設定がありません。');
  const life=this.definition;this.actor=this.findNode(life.actorRoot||'Life.ActorRoot');
  if(!this.actor)throw new Error('おこていゆの生活用ルートを取得できませんでした。');
  this.companion=this.findNode(life.companionRoot||'Life.CompanionRoot');
  this.actorBaseQuaternion=this.actor.quaternion.clone();this.actorYaw=0;
  this.graph=normalizeNavigation(life);
  for(const [id,p] of Object.entries({tableBackLeft:[-.95,.027,-2.9],tableBack:[0,.027,-2.70],fridgeMeal:[-1.35,0,-2.17]}))this.graph.nodes.set(id,{id,position:p});
  this.graph.edges.push({from:'leftBack',to:'tableBackLeft',kind:'walk'},{from:'tableBackLeft',to:'tableBack',kind:'walk'},{from:'fridge',to:'fridgeMeal',kind:'walk'});
  this.landmarks=Object.fromEntries(this.graph.nodes);
  this.schedule=new HouseLifeSchedule();this.researchElapsed=0;this.lastRelaxFinishedAt=null;this.actions=new Map();this.clipDefinitions=life.clips||metadata.clipSegments||{};
  this.sourceClips=clips;this.master=clips.find(c=>c.name===(life.masterClip||life.clipName||'house_life'))||clips[0];
  this.currentAction=null;this.currentClip=null;this.fading=[];this.plan=[];this.step=null;this.heldPropPose=null;
  this.actionKind='ambient';this.actionSource='ambient';this.phase='idle';this.ambientIndex=0;
  this.completedRelaxActions=0;this.consecutiveRelaxActions=INITIAL_CALM_POINTS;this.relaxEpoch=0;this.actionRelaxEpoch=0;this.actionNonTravelElapsed=0;this.plannedNonTravelDuration=0;this.lastCompletedRelaxation=null;
  this.history=[];this.foodIndex=0;this.currentFood=null;this.mealSource=null;this.heldFood=false;this.reservedTableItem=null;
  this.tableItems=(life.tableItems||[]).map((item,index)=>({...item,id:item.id||item.kind||String(index),amount:clamp(item.amount??1,0,1)}));
  for(const item of this.tableItems){
   const oldZ=item.position?.[2]??-1.71;item.position=[item.position?.[0]??0,item.position?.[1]??.222,-2.39];
   item.anchor=[item.position[0],.027,-2.70];item.yawRadians=-Math.PI/2;
   const food=this.findNode(item.nodeName||'Life.TableFood.'+item.kind);if(food){food.position.z=-2.39;if(item.kind==='bacon'&&!food.userData.baconServingOriented){food.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this.definition.tableware?.baconPlate?.servingTurnRadians??Math.PI));food.userData.baconServingOriented=true;}}
   if(item.platePosition)item.platePosition=[item.platePosition[0],item.platePosition[1],-2.39-(item.platePosition[2]-oldZ)];
  }
  this.foodDefinitions=life.foods||{};this.fridge=life.fridge||{};
  this.door=this.findNode(this.fridge.doorNode||'Life.FridgeHinge');this.doorRest=this.door?.quaternion.clone();this.doorOpen=0;
  this.foodNodes=new Map(Object.entries(this.foodDefinitions).map(([kind,info])=>[kind,this.findNode(typeof info==='string'?info:info.rootNode||info.nodeName||`Life.Food.${kind}.Root`)]));
  this.foodRootNodes=new Map(Object.entries(this.foodDefinitions).map(([kind,info])=>[kind,(info.rootNodes||[typeof info==='string'?info:info.rootNode||info.nodeName||`Life.Food.${kind}.Root`]).map(name=>this.findNode(name)).filter(Boolean)]));
  this.hiddenTableNodes=new Set();this.returnedFoodRoots=new Set();this.returnedFoodIndex=0;
  this.tablePlates=new Map();this.plateTemplate=this.findNode(life.tableware?.plateTemplateNode||'Life.TablePlate.Template');
  if(this.plateTemplate)this.plateTemplate.visible=false;
  this.ownedTablePlates=new Set();
  this.queuedAction=null;this.ambientBoundary=false;this.tableReplenishments=0;this.freshFoodTemplates=new Map();
  for(const kind of Object.keys(FOOD_NAMES)){
   const stock=this.fridge.stock?.find(item=>item.kind===kind),tableSource=this.findNode('Life.TableFood.'+kind),source=this.findNode(stock?.nodeName||'Life.FridgeStock.'+kind)||tableSource||this.foodNodes.get(kind);
   if(!source)continue;
   if(kind==='bacon'&&tableSource&&!tableSource.userData.baconServingOriented){tableSource.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this.definition.tableware?.baconPlate?.servingTurnRadians??Math.PI));tableSource.userData.baconServingOriented=true;}
   const copy=source.clone(true);copy.visible=true;copy.traverse(node=>{if(node.userData?.food_role==='consumable_state')node.visible=Math.abs(Number(node.userData.remaining_amount)-1)<.001;});
   if(tableSource)copy.quaternion.copy(tableSource.quaternion);else copy.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
   this.freshFoodTemplates.set(kind,copy);
  }
  this.companionRest=this.companion?.position.clone();this.companionBaseY=this.companion?.position.y||0;this.followHistory=[];this.hopTime=0;
  this.destroyed=false;this.arriveFromOutside(false);
 }
 refreshEnvironment(patch={}){
  const oldGraph=this.graph,anchor=this.currentNode,oldAnchor=oldGraph.nodes.get(anchor),nextDefinition={...this.definition,...patch};
  if(patch.navigation)delete nextDefinition.routes;
  const replacesNavigation=Boolean(patch.routes?.nodes||patch.navigation?.nodes);
  if(replacesNavigation&&!patch.landmarks)nextDefinition.landmarks={};
  const graph=normalizeNavigation(nextDefinition);
  // Retain only runtime meal anchors on partial edits, never removed authored routes.
  if(!replacesNavigation){
   const runtime=id=>['tableBackLeft','tableBack','fridgeMeal'].includes(id)||id.startsWith('table:');
   for(const [id,node] of oldGraph.nodes)if(runtime(id)&&!graph.nodes.has(id))graph.nodes.set(id,{...node,position:[...node.position]});
   for(const edge of oldGraph.edges)if((runtime(edge.from)||runtime(edge.to))&&graph.nodes.has(edge.from)&&graph.nodes.has(edge.to)&&!graph.edges.some(e=>e.from===edge.from&&e.to===edge.to||e.from===edge.to&&e.to===edge.from))graph.edges.push({...edge});
  }
  this.definition=nextDefinition;this.metadata.life=nextDefinition;this.graph=graph;this.landmarks=Object.fromEntries(graph.nodes);
  const target=graph.nodes.get(anchor);if(this.step?.type!=='travel'&&oldAnchor&&target)this.actor.position.add(position(target).sub(position(oldAnchor)));
  if(this.step?.type==='travel'){const step={...this.step};delete step.route;delete step.segment;this.startStep(step);}
  this.baconPlateFits=new WeakMap();this.updateProps();
 }
 get busy(){return this.actionKind!=='ambient';}
 get atomicMovement(){return this.step?.type==='travel'&&Boolean(this.step.segment&&(this.step.segment.clip||this.step.segment.kind==='hop'));}
 get tableEmpty(){return !this.tableItems.some(item=>item.amount>1e-5);}
 get relaxType(){return this.actionKind==='meal'?(this.currentFood?.startsWith('soda_')?'drink':'eat'):this.actionKind==='bed'?'lie':this.actionKind==='chair'?'sit':null;}
 emit(type,text,extra={}){this.onEvent({type,text,action:this.actionKind,...extra});}
 logHistory(entry){this.history.push({time:this.schedule.activeTime,...entry});if(this.history.length>60)this.history.shift();}
 resolveClip(id){
  if(this.actions.has(id))return this.actions.get(id);
  const aliases={computer:['computer','work','idle'],walk:['walk','walking','idle'],bed_lie:['bed_lie','sleep'],bed_rise:['bed_rise','wake'],chair_sit:['chair_sit','sit'],chair_rise:['chair_rise','stand'],fridge_open:['fridge_open'],fridge_close:['fridge_close']};
  const candidates=aliases[id]||[id,...(id.startsWith('pickup_')?['pickup']:[])];
  let definition,actual=id;
  for(const key of candidates)if(this.clipDefinitions[key]){definition=this.clipDefinitions[key];actual=key;break;}
  let clip;
  if(definition){
   const source=this.sourceClips.find(c=>c.name===definition.clipName)||this.master;
   const fps=definition.fps||this.definition.fps||this.metadata.animation?.fps||24;
   const start=definition.startTime??definition.startSeconds??(definition.startFrame??0)/fps;
   const end=definition.endTime??definition.endSeconds??(definition.endFrame!==undefined?definition.endFrame/fps:start+(definition.duration||source.duration));
   clip=sliceHouseClip(source,id,start,end);
  }else{
   const exact=candidates.map(key=>this.sourceClips.find(c=>c.name===key)).find(Boolean);
   if(exact)clip=exact.clone();
   else if(id==='idle'&&this.master)clip=sliceHouseClip(this.master,id,0,Math.min(1,this.master.duration));
   else return null;
  }
  clip.name=id;const record={clip,definition:definition||{},actual};this.actions.set(id,record);return record;
 }
 play(id,{loop=false,hold=false,offset=0,immediate=false}={}){
  const record=this.resolveClip(id)||this.resolveClip('idle');if(!record)throw new Error('生活モーションを取得できませんでした。');
  if(loop&&!hold&&!offset&&this.currentClip===id&&this.currentAction?.isRunning())return record;
  const next=this.mixer.clipAction(record.clip);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(1);next.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=true;next.time=clamp(offset,0,record.clip.duration);next.play();
  next.stopFading();this.fading=this.fading.filter(item=>item.action!==next);
  const old=this.currentAction;
  if(old&&old!==next){if(immediate){old.stop();}else{old.fadeOut(.12);next.fadeIn(.12);this.fading.push({action:old,left:.15});}}
  if(hold){next.time=record.clip.duration;next.paused=true;}
  this.currentAction=next;this.currentClip=id;this.onClipChange(record.clip,next);this.mixer.update(0);return record;
 }
 updateMixer(dt){this.mixer.update(dt);for(const item of this.fading)item.left-=dt;for(const item of this.fading.filter(item=>item.left<=0))item.action.stop();this.fading=this.fading.filter(item=>item.left>0);}
 setYaw(yaw){this.actorYaw=yaw;this.actor.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw).multiply(this.actorBaseQuaternion);}
 closestNode(point=this.actor.position){let best=null,distance=Infinity;for(const [id,node] of this.graph.nodes){const delta=point.distanceToSquared(position(node));if(delta<distance){best=id;distance=delta;}}return best;}
 addTableAnchor(item){
  const id='table:'+item.id,anchor=item.anchor||item.actorPosition||[item.position?.[0]??0,.027,-1.40];
  this.graph.nodes.set(id,{id,position:anchor,yaw:item.yawRadians??Math.PI/2});
  if(!this.graph.edges.some(e=>e.to===id))this.graph.edges.push({from:this.graph.nodes.has('tableBack')?'tableBack':this.graph.nodes.has('table')?'table':'front',to:id,kind:'walk'});
  const eatId=id+':eat';this.graph.nodes.set(eatId,{id:eatId,position:[anchor[0],anchor[1],anchor[2]-.34],yaw:item.yawRadians??Math.PI/2});if(!this.graph.edges.some(e=>e.to===eatId))this.graph.edges.push({from:id,to:eatId,kind:'walk'});
  return id;
 }
 ensureTablePlate(item){
  // Hamburger and pudding already include their own accepted dishes.
  if(!['bacon','bread'].includes(item.kind)||!this.plateTemplate)return null;
  if(this.tablePlates.has(item.id)){const plate=this.tablePlates.get(item.id);this.fitBaconPlate(item,plate);return plate;}
  let plate=item.plateNode?this.findNode(item.plateNode):null;
  if(!plate){plate=this.plateTemplate.clone(true);plate.name='Life.TablePlate.Runtime.'+item.id;plate.visible=true;this.model.add(plate);this.ownedTablePlates.add(plate);}
  let p=item.platePosition||item.position||[0,.222,-1.71];
  if(!item.platePosition){
   const food=item.nodeName&&this.findNode(item.nodeName),bounds=new THREE.Box3(),piece=new THREE.Box3();
   if(food){food.updateWorldMatrix(true,true);food.traverseVisible(node=>{if(node.isMesh){if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();piece.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);bounds.union(piece);}});}
   if(!bounds.isEmpty()){const center=bounds.getCenter(new THREE.Vector3());p=[center.x,p[1],center.z];}
  }
  plate.position.set(p[0],this.definition.tableware?.plateBaseHeight??.222,p[2]);
  const scale=item.kind==='bacon'?(this.definition.tableware?.baconPlate?.scale||[.60,.25,.70]):[1,1,1];plate.scale.fromArray(scale);
  this.tablePlates.set(item.id,plate);this.fitBaconPlate(item,plate);return plate;
 }
 fitBaconPlate(item,plate){
  if(item.kind!=='bacon'||!(item.amount>1e-5))return;
  const food=this.findNode(item.nodeName||'Life.TableFood.bacon');if(!food||!food.visible)return;
  this.baconPlateFits??=new WeakMap();const previous=this.baconPlateFits.get(plate);
  if(previous?.food===food&&previous.amount===item.amount)return;
  const bounds=root=>{const box=new THREE.Box3(),piece=new THREE.Box3();root.updateWorldMatrix(true,true);root.traverseVisible(node=>{if(!node.isMesh)return;if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();piece.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);box.union(piece);});return box;};
  const foodBox=bounds(food);if(foodBox.isEmpty())return;
  const center=foodBox.getCenter(new THREE.Vector3()),size=foodBox.getSize(new THREE.Vector3()),policy=this.definition.tableware?.baconPlate||{};
  plate.position.set(center.x,this.definition.tableware?.plateBaseHeight??.222,center.z);
  plate.scale.fromArray(policy.scale||[.60,.25,.70]);let plateBox=bounds(plate),plateSize=plateBox.getSize(new THREE.Vector3());
  // A smaller, shallow dish fits the portion without the former oversized rim.
  plate.scale.x*=Math.max(1,Math.SQRT2*size.x/(plateSize.x*.88));plate.scale.z*=Math.max(1,Math.SQRT2*size.z/(plateSize.z*.88));
  plateBox=bounds(plate);plateSize=plateBox.getSize(new THREE.Vector3());
  const table=policy.tableSurface||{center:[0,-2.10],halfSize:[.60,.425],cornerRadius:.24,edgeInset:.006},[cx,cz]=table.center,[hx,hz]=table.halfSize,r=table.cornerRadius,inset=table.edgeInset;
  plate.position.x=Math.max(cx-hx+plateSize.x/2+inset,Math.min(cx+hx-plateSize.x/2-inset,center.x));plate.position.z=cz-hz+plateSize.z/2+inset;
  const inside=()=>{plate.updateWorldMatrix(true,true);let fits=true;plate.traverseVisible(node=>{if(!node.isMesh)return;const a=node.geometry.attributes.position;for(let i=0;i<a.count&&fits;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(node.matrixWorld),dx=Math.abs(v.x-cx)-(hx-r),dz=Math.abs(v.z-cz)-(hz-r),distance=Math.hypot(Math.max(dx,0),Math.max(dz,0))+Math.min(Math.max(dx,dz),0)-r;if(distance>-inset+1e-7)fits=false;}});return fits;};
  // Keep the entire rounded dish on the real rounded tabletop, close to its rear edge.
  for(let i=0;i<256&&!inside();i++)plate.position.z+=.001;
  food.position.x+=plate.position.x-center.x;food.position.z+=plate.position.z-center.z;food.updateWorldMatrix(true,true);
  plateBox=bounds(plate);const foodAfter=bounds(food);food.position.y+=plateBox.max.y+.001-foodAfter.min.y;food.updateWorldMatrix(true,true);
  item.position=food.position.toArray();item.platePosition=plate.position.toArray();item.anchor=[food.position.x,.027,food.position.z-.31];
  this.baconPlateFits.set(plate,{food,amount:item.amount});
 }
 travel(to){return {type:'travel',to};}
 turn(yaw){return {type:'turn',yaw,duration:.28};}
 clip(id,extra={}){return {type:'clip',id,...extra};}
 hold(id,duration,extra={}){return {type:'hold',id,duration,...extra};}
 hook(run){return {type:'hook',run};}
 requestAction(kind){
  if(this.destroyed||!Object.hasOwn(ACTION_NAMES,kind))return false;
  const previous=this.queuedAction;this.queuedAction=kind;
  const phase=previous?'queue-replaced':'queued';this.logHistory({event:phase,action:kind,previous});
  this.emit('action',ACTION_NAMES[kind]+'の指示を予約した。今の動作が終わったら始める。',{phase,queuedAction:kind,previous});return true;
 }
 clearQueuedAction(reason='cancelled'){
  if(this.queuedAction===null)return false;
  const action=this.queuedAction;this.queuedAction=null;this.logHistory({event:'queue-cleared',action,reason});
  this.emit('action','',{phase:'queue-cleared',queuedAction:null,reason});return true;
 }
 leaveHouse(){this.clearQueuedAction('departure');}
 resetConsecutiveRelaxActions(reason='explicit'){
  const previous=this.consecutiveRelaxActions;this.consecutiveRelaxActions=0;this.relaxEpoch++;
  this.logHistory({event:'relax-reset',reason,previous,consecutiveRelaxActions:0});
  this.emit('daily','',{phase:'relax-reset',reason,previous,consecutiveRelaxActions:0});return true;
 }
 spendCalmPoints(count){if(!Number.isSafeInteger(count)||count<0)throw new RangeError('穏やかポイントの消費数が正しくありません。');const previous=this.consecutiveRelaxActions;this.consecutiveRelaxActions=Math.max(0,previous-count);this.emit('daily','',{phase:'calm-spent',previous,consecutiveRelaxActions:this.consecutiveRelaxActions});return true;}
 onAngerPointGain(){return this.spendCalmPoints(3);}
 restoreConsecutiveRelaxActions(count){
  if(!Number.isSafeInteger(count)||count<0)throw new RangeError('回復回数が正しくありません。');
  this.resetConsecutiveRelaxActions('save-load');this.consecutiveRelaxActions=Math.min(99,count);
  this.emit('daily','',{phase:'relax-restored',consecutiveRelaxActions:this.consecutiveRelaxActions});return true;
 }
 actionAvailable(kind){
  if(this.destroyed||!Object.hasOwn(ACTION_NAMES,kind))return false;
  const decision=this.canExecuteAction(kind,{source:'manual',director:this});if(decision===false||decision?.allowed===false)return false;
  let target=kind==='computer'?'computer':kind,required=kind==='bed'?['bed_lie','bed_rise']:kind==='chair'?['chair_sit','chair_rise']:['computer'];
  if(kind==='meal'||kind==='fridge_meal'){
   const item=kind==='fridge_meal'?null:this.tableItems.find(value=>value.amount>1e-5),food=item?.kind||Object.keys(FOOD_NAMES)[this.foodIndex%Object.keys(FOOD_NAMES).length];
   if(!this.foodNodes.get(food))return false;
   target=item?this.addTableAnchor(item):'fridge';required=['eat_'+food,item?'pickup_'+food:(this.resolveClip('fridge_take_'+food)?'fridge_take_'+food:'pickup_'+food)];
   if(!item)required.push('fridge_open','fridge_close');
  }
  if(!this.graph.nodes.has(target)||required.some(id=>!this.resolveClip(id)))return false;
  findHouseRoute(this.graph,this.closestNode(),target);return true;
 }
 startQueuedAction(){
  if(!this.queuedAction||this.busy||this.atomicMovement)return false;
  const safe=!this.step||this.ambientBoundary||(this.step.type==='hold'&&this.step.elapsed<1e-8);
  if(!safe)return false;
  const kind=this.queuedAction;this.queuedAction=null;let allowed=false;
  try{allowed=this.actionAvailable(kind);}catch{allowed=false;}
  const phase=allowed?'queue-started':'queue-skipped';this.logHistory({event:phase,action:kind});
  this.emit('action',allowed?'':ACTION_NAMES[kind]+'の指示は、今は実行できないため見送った。',{phase,queuedAction:null,requestedAction:kind});
  this.ambientBoundary=false;if(allowed)this.begin(kind,'manual');return allowed;
 }
 begin(kind,source){
  this.cancelPlan();this.ambientBoundary=false;this.actionKind=kind==='fridge_meal'?'meal':kind;this.actionSource=source;this.phase=this.actionKind;
  if(this.relaxType){this.schedule.waitForCompletion();this.researchElapsed=0;}
  this.actionRelaxEpoch=this.relaxEpoch;this.actionNonTravelElapsed=0;this.plannedNonTravelDuration=0;this.logHistory({event:'start',action:kind,source});
  if(kind==='meal'||kind==='fridge_meal')this.planMeal({fromFridge:kind==='fridge_meal'});
  else if(kind==='bed'){
   this.emit('daily','おこていゆは、ロフトのベッドへ向かった。');
   this.plan=[this.travel('bed'),this.turn(this.graph.nodes.get('bed')?.yaw??-Math.PI/2),this.clip('bed_lie'),this.hold('bed_lie',3,{lastPose:true}),this.clip('bed_rise')];
  }else if(kind==='chair'){
   this.emit('daily','おこていゆは、奥の椅子でひと息つくことにした。');
   this.plan=[this.travel('chair'),this.turn(this.graph.nodes.get('chair')?.yaw??-Math.PI/2),this.clip('chair_sit'),this.hold('chair_sit',3,{lastPose:true}),this.clip('chair_rise')];
  }else{
   this.emit('research','おこていゆは、パソコンの前で研究を始めた。');
   this.plan=[this.travel('computer'),this.turn(this.graph.nodes.get('computer')?.yaw??0),this.hold('computer',8)];
  }
  if(this.relaxType)this.fitRelaxPlan();
 }
 fitRelaxPlan(){
  let flexibleSource=0,reservedSeconds=0;
  for(const step of this.plan){
   if(step.type==='travel'||step.type==='hook')continue;
   step.sourceDuration=step.duration??Math.max(.01,(this.resolveClip(step.id)?.clip.duration??0)-(step.offset||0));
   if(step.navigationSlice)step.navigationSlice=step.navigationSlice.map(value=>value*step.sourceDuration/4);if(step.navigationBreak)step.navigationBreak.source*=step.sourceDuration/4;
   step.stationarySource=step.sourceDuration-(step.navigationSlice?step.navigationSlice[1]-step.navigationSlice[0]:0);
   if(step.minimumSeconds)reservedSeconds+=step.minimumSeconds;else flexibleSource+=step.stationarySource;
  }
  const timeScale=Math.max(1,flexibleSource/Math.max(.1,HOUSE_RELAX_NON_TRAVEL_BUDGET_SECONDS-reservedSeconds));
  let planned=0;
  for(const step of this.plan)if(step.sourceDuration!==undefined){
   const stationaryDuration=step.minimumSeconds??step.stationarySource/timeScale;
   step.timeScale=step.stationarySource/Math.max(.001,stationaryDuration);step.duration=stationaryDuration+(step.navigationDuration||0);planned+=stationaryDuration;
  }
  this.plannedNonTravelDuration=planned;
 }
 planMeal({fromFridge=false}={}){
  const item=fromFridge?null:this.tableItems.find(value=>value.amount>1e-5);this.reservedTableItem=item||null;
  this.currentFood=item?.kind||Object.keys(FOOD_NAMES)[this.foodIndex++%Object.keys(FOOD_NAMES).length];
  this.mealSource=item?'table':'fridge';this.remainingFoodAmount=item?.amount??1;const label=FOOD_NAMES[this.currentFood]||'ごはん';
  if(item){
   this.emit('meal','おこていゆは、ちゃぶ台の'+label+'へ向かった。');
   const pickup='pickup_'+this.currentFood,duration=this.resolveClip(pickup)?.clip.duration||1.6,grasp=duration*.35;
   this.plan=[this.travel(this.addTableAnchor(item)),this.turn(item.yawRadians??Math.PI/2),this.hook(()=>{this.heldFood=true;}),this.clip(pickup,{duration:grasp}),{...this.travel('table:'+item.id+':eat'),keepYaw:true,keepGraspPose:true},this.clip(pickup,{offset:grasp,duration:duration-grasp}),this.consumeStep(item.amount)];
  }else{
   this.emit('meal',fromFridge?'おこていゆは、冷蔵庫からひと息分を用意することにした。':'ちゃぶ台は空っぽだった。おこていゆは冷蔵庫をのぞきにいく。');
   const take=this.resolveClip('fridge_take_'+this.currentFood)?'fridge_take_'+this.currentFood:'pickup_'+this.currentFood;
   this.plan=[this.travel('fridge'),this.turn(this.graph.nodes.get('fridge')?.yaw??Math.PI),this.clip('fridge_open',{door:[0,1],navigationSlice:[.55,4],navigationDuration:6.3,navigationBreak:{source:2.5,seconds:2.8}}),this.hook(()=>{this.heldFood=true;}),this.clip(take,{minimumSeconds:2}),this.clip('fridge_close',{door:[1,0],navigationSlice:[0,2.2],navigationDuration:6.3,navigationBreak:{source:.55,seconds:3.5}}),{...this.travel('fridgeMeal'),keepYaw:true,speedMultiplier:.8},{...this.turn(-Math.PI/2),minimumSeconds:.65},this.consumeStep(1)];
  }
 }
 consumeStep(amount){
  let offset=0;
  if(amount<1-1e-5){
   const quarter=Math.round(amount*4)/4;
   if(Math.abs(amount-quarter)<.001)offset=.35+(1-quarter)*5;
   else{const curve=this.foodDefinitions[this.currentFood]?.amountCurve;offset=curve?.find(([,value])=>value<=amount+1e-5)?.[0]??(1-amount)*5;}
  }
  return this.clip('eat_'+this.currentFood,{consume:true,initialAmount:amount,offset:clamp(offset,0,5.9)});
 }
 startAmbient(){
  this.actionKind='ambient';this.actionSource='ambient';
  this.plan=[this.travel('computer'),this.turn(this.graph.nodes.get('computer')?.yaw??0),this.hold('computer',Infinity)];
  this.emit('research','おこていゆは、パソコンの前で研究を始めた。',{phase:'start',ambient:true});
 }

 completeAction(){
  if(this.busy){
   const kind=this.actionKind,relaxType=this.relaxType;
   if(relaxType){
    this.schedule.restartInterval();this.researchElapsed=0;this.lastRelaxFinishedAt=this.schedule.activeTime;
    this.completedRelaxActions++;if(this.actionRelaxEpoch===this.relaxEpoch)this.consecutiveRelaxActions=Math.min(99,this.consecutiveRelaxActions+1);
    this.lastCompletedRelaxation={action:kind,relaxType,source:this.actionSource,nonTravelElapsed:this.actionNonTravelElapsed,plannedNonTravelDuration:this.plannedNonTravelDuration,consecutiveRelaxActions:this.consecutiveRelaxActions};
   }
   const text=kind==='meal'?'おこていゆは、'+(this.mealSource==='fridge'?'冷蔵庫の前で':'')+(FOOD_NAMES[this.currentFood]||'ごはん')+'を味わって、ひと息ついた。':kind==='bed'?'おこていゆは、ベッドでのんびり休んだ。':kind==='chair'?'おこていゆは、椅子でゆっくりくつろいだ。':'おこていゆは、研究に一区切りつけた。';
   const detail={relaxType,completedRelaxActions:this.completedRelaxActions,consecutiveRelaxActions:this.consecutiveRelaxActions,nonTravelElapsed:this.actionNonTravelElapsed};
   this.emit(kind==='meal'?'meal':kind==='computer'?'research':'daily',text,{phase:'complete',...detail});
   this.logHistory({event:'complete',action:kind,...detail});
  }
  this.heldFood=false;this.heldPropPose=null;this.reservedTableItem=null;this.currentFood=null;this.mealSource=null;this.actionKind='ambient';this.phase='idle';
 }
 cancelPlan(){this.plan=[];this.step=null;}
 returnHeldFood(){
  if(!this.heldFood||!this.currentFood||!(this.remainingFoodAmount>1e-5))return;
  const source=this.foodNodes.get(this.currentFood);let item=this.reservedTableItem;
  if(!item){
   const slot=[-.32,0,.32].find(x=>!this.tableItems.some(entry=>entry.amount>1e-5&&Math.abs((entry.position?.[0]??0)-x)<.12))??0;
   const height=(this.definition.tableTopHeight??.22)+.002+(['bacon','bread'].includes(this.currentFood)?(this.definition.tableware?.foodLift??0):0);
   item={id:'returned_'+(++this.returnedFoodIndex),kind:this.currentFood,position:[slot,height,-2.39],anchor:[slot,.027,-2.70],yawRadians:-Math.PI/2,amount:this.remainingFoodAmount};this.tableItems.push(item);
  }
  item.amount=this.remainingFoodAmount;
  const definition=this.foodDefinitions[this.currentFood];item.remainingMeshPose={};
  for(const name of definition?.meshNodes||[]){const node=this.findNode(name);if(node)item.remainingMeshPose[name]={position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray()};}
  if(source){
   const previous=item.nodeName&&this.findNode(item.nodeName),worldPosition=previous?previous.getWorldPosition(new THREE.Vector3()):position(item.position||[0,.22,-1.71]);
   const copy=source.clone(true);copy.traverse(node=>{node.name='Life.ReturnedFood.'+this.returnedFoodIndex+'.'+node.name;node.userData={...node.userData,returnedFood:true};});copy.name='Life.ReturnedFood.'+(++this.returnedFoodIndex);copy.position.copy(worldPosition);copy.quaternion.copy(previous?previous.getWorldQuaternion(new THREE.Quaternion()):this.freshFoodTemplates.get(this.currentFood)?.quaternion||new THREE.Quaternion());copy.scale.set(1,1,1);copy.visible=true;
   this.model.add(copy);this.returnedFoodRoots.add(copy);
   copy.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),piece=new THREE.Box3();copy.traverseVisible(node=>{if(node.isMesh){if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();piece.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);bounds.union(piece);}});
   if(!bounds.isEmpty())copy.position.y+=(this.definition.tableTopHeight??.22)+.002+(['bacon','bread'].includes(this.currentFood)?(this.definition.tableware?.foodLift??0):0)-bounds.min.y;
   item.position=copy.position.toArray();
   if(previous){previous.visible=false;if(this.returnedFoodRoots.has(previous)){previous.removeFromParent();this.returnedFoodRoots.delete(previous);this.hiddenTableNodes.delete(previous);}else this.hiddenTableNodes.add(previous);}
   item.nodeName=copy.name;delete item.variants;item.returnedVisual=true;
  }
 }
 replenishTableAfterBattle(){
  const kinds=Object.keys(FOOD_NAMES).filter(kind=>this.freshFoodTemplates.has(kind));if(!kinds.length)return false;
  const value=this.rng(),kind=kinds[Math.min(kinds.length-1,Math.max(0,Math.floor((Number.isFinite(value)?value:0)*kinds.length)))];
  for(const item of this.tableItems){const node=this.findNode(item.nodeName||'Life.TableFood.'+item.kind);if(node){node.visible=false;if(!this.returnedFoodRoots.has(node))this.hiddenTableNodes.add(node);}}
  for(const root of this.returnedFoodRoots){root.removeFromParent();this.hiddenTableNodes.delete(root);}this.returnedFoodRoots.clear();
  for(const plate of this.tablePlates.values()){plate.visible=false;if(this.ownedTablePlates.has(plate)){plate.removeFromParent();this.ownedTablePlates.delete(plate);}}this.tablePlates.clear();
  for(const id of [...this.graph.nodes.keys()])if(id.startsWith('table:'))this.graph.nodes.delete(id);
  this.graph.edges=this.graph.edges.filter(edge=>!edge.from.startsWith('table:')&&!edge.to.startsWith('table:'));
  const copy=this.freshFoodTemplates.get(kind).clone(true),prefix='Life.BattleTableFood.'+(++this.tableReplenishments);
  copy.traverse(node=>{node.name=prefix+'.'+node.name;});copy.name=prefix;copy.visible=true;
  copy.position.set(0,0,-2.39);this.model.add(copy);copy.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3(),pieceBounds=new THREE.Box3();
  copy.traverseVisible(node=>{if(node.isMesh){if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();pieceBounds.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);bounds.union(pieceBounds);}});
  const tableHeight=(this.definition.tableTopHeight??.22)+.002+(['bacon','bread'].includes(kind)?(this.definition.tableware?.foodLift??0):0);copy.position.y=tableHeight-(bounds.isEmpty()?0:bounds.min.y);this.returnedFoodRoots.add(copy);
  this.tableItems=[{id:'battle_meal',kind,nodeName:copy.name,position:copy.position.toArray(),anchor:[0,.027,-2.70],yawRadians:-Math.PI/2,amount:1,returnedVisual:true}];
  this.logHistory({event:'table-replenished',kind,count:1,afterBattle:true});this.emit('meal','戦闘を終えて、ちゃぶ台に'+FOOD_NAMES[kind]+'が用意された。',{phase:'table-replenished',afterBattle:true,kind});return true;
 }
 arriveFromOutside(options={}){
  const {emit=true,afterBattle=false}=typeof options==='boolean'?{emit:options}:options;
  this.clearQueuedAction('arrival');
  if(this.busy)this.logHistory({event:'cancel',action:this.actionKind});
  this.returnHeldFood();
  this.cancelPlan();this.actionKind='ambient';this.actionSource='ambient';this.heldFood=false;this.heldPropPose=null;this.reservedTableItem=null;this.currentFood=null;this.mealSource=null;this.doorOpen=0;
  this.ambientBoundary=false;if(afterBattle===true)this.replenishTableAfterBattle();
  this.schedule.restartInterval();this.researchElapsed=0;this.actor.position.copy(position(this.graph.nodes.get('entrance')||[0,0,-.45]));this.setYaw(Math.PI/2);this.currentNode='entrance';
  this.mixer.stopAllAction();this.currentAction=null;this.fading=[];this.play('idle',{loop:true,immediate:true});this.phase='idle';this.followHistory=[];
  if(this.companion){this.companion.position.copy(this.actor.position).add(new THREE.Vector3(-.28,0,.15));this.companionBaseY=this.companion.position.y;this.companion.quaternion.copy(this.actor.quaternion);}
  this.updateProps();if(emit)this.logHistory({event:'arrival'});
 }
 startStep(step){
  this.step=step;step.elapsed=0;
  if(step.type==='hook'){step.run();return;}
  this.phase=step.type==='travel'?'navigate':step.consume?'eating':step.id||step.type;
  if(step.type==='travel'){
   const from=this.closestNode();step.route=[];
   const first=position(this.graph.nodes.get(from));
   if(this.actor.position.distanceTo(first)>.015)step.route.push({from:null,to:from,kind:'walk',start:this.actor.position.clone(),end:first});
   step.route.push(...findHouseRoute(this.graph,from,step.to));this.nextTravelSegment(step);
  }else if(step.type==='turn'){step.startYaw=this.actorYaw;this.play('idle',{loop:true});this.currentAction?.setEffectiveTimeScale(step.timeScale||1);}
  else{
   const record=this.play(step.id,{loop:step.type==='hold'&&!step.lastPose,hold:step.lastPose,offset:step.offset||0,immediate:Boolean(step.door)});
   step.duration=step.duration??Math.max(.01,record.clip.duration-(step.offset||0));
   this.currentAction?.setEffectiveTimeScale(step.timeScale||1);
   if(step.consume){step.initialAmount??=1;this.remainingFoodAmount=step.initialAmount;}
  }
 }
 nextTravelSegment(step){
  const edge=step.route.shift();step.segment=null;
  if(!edge)return;
  const start=edge.start||this.actor.position.clone(),end=edge.end||position(this.graph.nodes.get(edge.to));
  const delta=end.clone().sub(start),distance=Math.hypot(delta.x,delta.z),yaw=step.keepYaw?this.actorYaw:distance>.001?Math.atan2(-delta.z,delta.x):this.actorYaw;
  const stairClip=edge.clip||(edge.kind==='stairs'?(end.y>start.y?'stairs_up':'stairs_down'):null);
  const clip=stairClip&&this.resolveClip(stairClip);
  const sourceDuration=edge.duration||(clip?clip.clip.duration:edge.kind==='hop'?.78:Math.max(.20,distance/.48));
  const timeScale=edge.kind==='stairs'||stairClip?.startsWith('stairs_')?HOUSE_MOVEMENT_SPEED.loftStairs:(step.speedMultiplier??(this.heldFood&&this.mealSource==='fridge'?.8:HOUSE_MOVEMENT_SPEED.room));
  const duration=sourceDuration/timeScale;
  step.segment={...edge,start,end,elapsed:0,duration,sourceDuration,timeScale,startYaw:this.actorYaw,yaw,clip:clip?stairClip:null};
  this.phase=clip?stairClip:edge.kind==='hop'?'jump':'walking';
  if(clip){this.setYaw(clip.definition.rootYawRadians??edge.yaw??yaw);step.segment.poseYaw=this.actorYaw;step.segment.poseStart=this.actor.position.clone();step.segment.rootEndOffset=clip.definition.rootEndOffset;this.play(stairClip,{immediate:true});}
  else this.play('walk',{loop:true});
  this.currentAction?.setEffectiveTimeScale(timeScale);
 }
 advanceStep(dt){
  const step=this.step;if(!step)return true;
  if(this.busy&&this.relaxType&&step.type!=='travel'){const start=step.navigationSlice?step.navigationSlice[0]/step.timeScale:Infinity,end=start+(step.navigationDuration||0),moving=Math.max(0,Math.min(step.elapsed+dt,end)-Math.max(step.elapsed,start));this.actionNonTravelElapsed+=dt-moving;}
  if(step.type==='hook')return true;
  if(step.type==='travel'){
   const segment=step.segment;if(!segment)return true;
   segment.elapsed+=dt;const u=clamp(segment.elapsed/segment.duration,0,1);
   this.updateMixer(dt);
   if(!segment.clip){
    let across=u,height=THREE.MathUtils.lerp(segment.start.y,segment.end.y,u);
    if(segment.kind==='hop'){
     const delta=segment.end.y-segment.start.y,apex=Math.max(segment.start.y,segment.end.y)+.16;
     // Clear the higher tread before traversing its front edge.
     const ascent=delta>0;across=smooth((u-(ascent?.28:.08))/(ascent?.52:.70));
     height=THREE.MathUtils.lerp(segment.start.y,segment.end.y,u)+Math.sin(Math.PI*u)*(apex-(segment.start.y+segment.end.y)/2);
    }
    this.actor.position.lerpVectors(segment.start,segment.end,across);this.actor.position.y=height;
    this.setYaw(segment.startYaw+angleDelta(segment.startYaw,segment.yaw)*smooth(Math.min(1,u*segment.duration/.25)));
   }
   if(u>=1){
    if(segment.clip){
     this.model.updateMatrixWorld(true);
     const target=this.findNode(this.definition.targetBody||this.metadata.target?.nodeName||'Life.Okoteiyu.Body'),forward=target?new THREE.Vector3(1,0,0).transformDirection(target.matrixWorld):null;
     const finalYaw=forward&&Math.hypot(forward.x,forward.z)>.01?Math.atan2(-forward.z,forward.x):segment.poseYaw;
     if(segment.rootEndOffset)this.actor.position.copy(position(segment.rootEndOffset).applyAxisAngle(new THREE.Vector3(0,1,0),segment.poseYaw).add(segment.poseStart));
     else this.actor.position.copy(segment.end);
     this.currentAction?.stop();this.currentAction=null;this.fading=[];this.setYaw(finalYaw);this.play('idle',{loop:true,immediate:true});
    }else{this.actor.position.copy(segment.end);this.setYaw(segment.yaw);}
    this.currentNode=segment.to;
    if(!this.busy&&this.queuedAction){step.route=[];step.segment=null;this.ambientBoundary=true;}
    else this.nextTravelSegment(step);
   }
   return !step.segment;
  }
  if(step.id==='computer')this.researchElapsed+=dt;
  const priorElapsed=step.elapsed;step.elapsed+=dt;
  if(step.navigationSlice){
   const [a,b]=step.navigationSlice,start=a/step.timeScale,duration=step.navigationDuration,u=step.elapsed-start,split=step.navigationBreak;
   const navigationSource=split?(u<split.seconds?a+(split.source-a)*u/split.seconds:split.source+(b-split.source)*(u-split.seconds)/(duration-split.seconds)):a+(b-a)*u/duration;
   step.sourceTime=step.elapsed<start?step.elapsed*step.timeScale:step.elapsed<start+duration?navigationSource:b+(step.elapsed-start-duration)*step.timeScale;
   this.currentAction.paused=true;this.currentAction.time=Math.min(step.sourceDuration,step.sourceTime);
  }
  this.updateMixer(dt);
  if(!this.busy&&step.type==='hold'){
   const cycle=this.currentAction?.getClip().duration;
   if(cycle>0&&Math.floor((priorElapsed+1e-8)/cycle)!==Math.floor((step.elapsed+1e-8)/cycle))this.ambientBoundary=true;
  }
  if(step.type==='turn')this.setYaw(step.startYaw+angleDelta(step.startYaw,step.yaw)*smooth(step.elapsed/step.duration));
  if(step.door&&this.door&&this.doorRest){
   const relative=this.doorRest.clone().invert().multiply(this.door.quaternion),angle=2*Math.atan2(relative.y,relative.w);
   this.doorOpen=clamp(angle/(this.fridge.openAngleRadians??-1.75),0,1);
  }
  if(step.consume){
   const curve=this.foodDefinitions[this.currentFood]?.amountCurve,time=this.currentAction?.time??step.elapsed;
   if(curve?.length){
    let index=curve.findIndex(([t])=>t>=time);if(index<0)index=curve.length-1;
    const [at,av]=curve[Math.max(0,index-1)],[bt,bv]=curve[index];
    this.remainingFoodAmount=Math.min(step.initialAmount,THREE.MathUtils.lerp(av,bv,bt>at?clamp((time-at)/(bt-at),0,1):0));
   }else this.remainingFoodAmount=Math.max(0,step.initialAmount*(1-clamp(step.elapsed/step.duration,0,1)));
   if(this.reservedTableItem)this.reservedTableItem.amount=this.remainingFoodAmount;
  }
  if(step.elapsed+1e-8>=step.duration){
   if(step.door)this.doorOpen=step.door[1];
   if(this.heldFood&&step.id?.match(/^(pickup_|fridge_take_)/))this.captureHeldPose();
   if(step.consume){if(this.reservedTableItem)this.reservedTableItem.amount=0;this.remainingFoodAmount=0;this.heldFood=false;}
   return true;
  }
  return false;
 }
 captureHeldPose(){
  const poseRoot=this.findNode(this.definition.poseRoot||'Life.PoseRoot');if(!poseRoot)return;
  this.model.updateMatrixWorld(true);const inverse=poseRoot.matrixWorld.clone().invert(),roots=[];
  for(const node of this.foodRootNodes.get(this.currentFood)||[])roots.push({node,relative:inverse.clone().multiply(node.matrixWorld)});
  const meshes=[];
  for(const name of this.foodDefinitions[this.currentFood]?.meshNodes||[]){const node=this.findNode(name);if(node)meshes.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()});}
  const hand=this.findNode('Life.Okoteiyu.Hand.R');
  const capture=node=>({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()});
  const hands=['Life.Okoteiyu.Hand.L','Life.Okoteiyu.Hand.R'].map(name=>this.findNode(name)).filter(Boolean).map(capture);
  this.heldPropPose={poseRoot,pose:capture(poseRoot),hands,roots,meshes,hand:hand?{node:hand,position:hand.position.clone(),quaternion:hand.quaternion.clone(),scale:hand.scale.clone()}:null};
 }
 applyHeldClosingPose(){
  const held=this.heldPropPose;if(!held)return;
  const grasp=this.step?.keepGraspPose,authored=grasp?null:this.foodDefinitions[this.currentFood]?.holdPose;
  if(grasp){for(const pose of [held.pose,...held.hands]){pose.node.position.copy(pose.position);pose.node.quaternion.copy(pose.quaternion);pose.node.scale.copy(pose.scale);}}
  if(authored?.handTransform){const node=this.findNode(authored.handNode),pose=authored.handTransform;if(node){node.position.fromArray(pose.position);node.quaternion.fromArray(pose.quaternion);node.scale.fromArray(pose.scale);}}
  else if(held.hand){const {node,position,quaternion,scale}=held.hand;node.position.copy(position);node.quaternion.copy(quaternion);node.scale.copy(scale);}
  this.model.updateMatrixWorld(true);
  for(const {node,relative} of held.roots){
   let relativePose=relative;
   if(authored?.foodTransform&&node===this.findNode(authored.foodNode)){const pose=authored.foodTransform;relativePose=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(pose.position),new THREE.Quaternion().fromArray(pose.quaternion),new THREE.Vector3().fromArray(pose.scale));}
   const local=held.poseRoot.matrixWorld.clone().multiply(relativePose);if(node.parent)local.premultiply(node.parent.matrixWorld.clone().invert());
   local.decompose(node.position,node.quaternion,node.scale);
   const name=node.userData?.life_food_source_name||node.userData?.name||node.name;if(/Utensil|Morsel/.test(name))node.visible=false;
  }
  for(const name of authored?.hideRootNodes||[]){const node=this.findNode(name);if(node)node.visible=false;}
  for(const {node,position,quaternion,scale} of held.meshes){node.position.copy(position);node.quaternion.copy(quaternion);node.scale.copy(scale);}
 }
 correctFridgePassage(){
  const step=this.step;if(!step?.door)return;
  const root=this.findNode(this.definition.poseRoot||'Life.PoseRoot');if(!root)return;
  const t=step.sourceTime!==undefined?4*step.sourceTime/step.sourceDuration:(4*clamp(step.elapsed/step.duration,0,1)),opening=step.id==='fridge_open';
  if(opening?t<2.5:t>.55)return;
  this.model.updateMatrixWorld(true);
  step.passageInterpolant??=this.currentAction.getClip().tracks.find(track=>track.name===root.name+'.position')?.createInterpolant();
  const sample=at=>{const point=step.passageInterpolant?new THREE.Vector3().fromArray(step.passageInterpolant.evaluate(at)):root.position.clone();return root.parent?root.parent.localToWorld(point):point;};
  const grip=sample((opening?2.5:.55)*step.sourceDuration/4),anchor=sample(step.sourceDuration);
  const forward=[[grip.x,grip.z],[-1.20,grip.z],[-1.20,anchor.z],[anchor.x,anchor.z]],path=opening?forward:[...forward].reverse();
  const u=clamp(opening?(t-2.5)/1.5:t/.55,0,1)*3,index=Math.min(2,Math.floor(u)),v=smooth(u-index),a=path[index],b=path[index+1];
  this.model.updateMatrixWorld(true);const point=root.getWorldPosition(new THREE.Vector3());point.x=THREE.MathUtils.lerp(a[0],b[0],v);point.z=THREE.MathUtils.lerp(a[1],b[1],v);if(root.parent)root.parent.worldToLocal(point);root.position.x=point.x;root.position.z=point.z;
 }
 updateProps(){
  if(this.door&&this.doorRest&&!this.step?.door){const axis=new THREE.Vector3(0,1,0);this.door.quaternion.copy(this.doorRest).multiply(new THREE.Quaternion().setFromAxisAngle(axis,(this.fridge.openAngleRadians??-1.75)*this.doorOpen));}
  for(const node of this.hiddenTableNodes)node.visible=false;
  for(const item of this.tableItems){const node=this.findNode(item.nodeName||`Life.TableFood.${item.kind}`);if(node)node.visible=item.amount>1e-5&&!(this.heldFood&&item===this.reservedTableItem);this.applyVariants(item,item.amount);const plate=this.ensureTablePlate(item);if(plate)plate.visible=true;}
  for(const [kind,nodes] of this.foodRootNodes)for(const node of nodes)node.visible=this.heldFood&&kind===this.currentFood;
  for(const stock of this.fridge.stock||[]){const node=this.findNode(stock.nodeName);if(node){node.visible=!(this.heldFood&&this.mealSource==='fridge'&&stock.kind===this.currentFood);node.traverse(child=>{if(child.userData?.food_role==='consumable_state')child.visible=Math.abs(Number(child.userData.remaining_amount)-1)<.001;});}}
  if(this.heldFood&&this.reservedTableItem?.remainingMeshPose&&!this.step?.consume){
   for(const [name,pose] of Object.entries(this.reservedTableItem.remainingMeshPose)){const node=this.findNode(name);if(node){node.position.fromArray(pose.position);node.quaternion.fromArray(pose.quaternion);node.scale.fromArray(pose.scale);}}
  }
  if(this.heldFood&&(this.currentClip==='fridge_close'||['travel','turn'].includes(this.step?.type)))this.applyHeldClosingPose();
  // Cutlery and the next bite appear only once eating starts, after retreating.
  if(this.heldFood&&!this.step?.consume)for(const name of this.foodDefinitions[this.currentFood]?.holdPose?.hideRootNodes||[]){const node=this.findNode(name);if(node)node.visible=false;}
 }
 applyVariants(definition,amount){
  if(!definition.variants)return;
  const entries=Object.entries(definition.variants).filter(([value])=>Number(value)>0).sort((a,b)=>Number(a[0])-Number(b[0]));
  const level=amount<=0?0:Number(entries.find(([value])=>Number(value)+1e-5>=amount)?.[0]||1);
  for(const [value,entry] of Object.entries(definition.variants)){
   for(const name of Array.isArray(entry)?entry:[typeof entry==='string'?entry:entry.nodeName]){
    const node=this.findNode(name);if(node){node.visible=Math.abs(Number(value)-level)<1e-5;if(node.visible&&entry?.scale)node.scale.fromArray(entry.scale);}
   }
  }
 }
 updateCompanion(dt){
  if(!this.companion)return;
  const movementRate=this.step?.segment?.timeScale||1;
  const now=this.schedule.activeTime;this.followHistory.push({time:now,position:this.actor.position.clone(),yaw:this.actorYaw});
  while(this.followHistory.length>2&&this.followHistory[1].time<now-.7/movementRate)this.followHistory.shift();
  const old=this.followHistory[0],target=old.position.clone();
  // A stationary companion stands beside the actor rather than inside it.
  const actorMoving=this.actor.position.distanceToSquared(old.position)>.015*.015;
  if((this.actionKind==='bed'||this.actionKind==='chair')&&this.actor.position.y>.75){target.copy(this.actor.position).add(new THREE.Vector3(.65,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),this.actorYaw));target.y=.63;}
  else if(this.actor.position.x>1.1&&this.actor.position.y>.1&&this.actor.position.z>-2.1){target.copy(position(this.graph.nodes.get('computerBase'))).add(new THREE.Vector3(0,0,.25));}
  else if(!actorMoving)target.add(new THREE.Vector3(0,0,.28).applyAxisAngle(new THREE.Vector3(0,1,0),this.actorYaw));
  const horizontal=Math.hypot(target.x-this.companion.position.x,target.z-this.companion.position.z);
  const moving=horizontal>.025||Math.abs(target.y-this.companion.position.y)>.08;
  if(moving)this.hopTime+=dt*movementRate;else this.hopTime=0;
  const follow=1-Math.exp(-dt*8*movementRate);
  this.companion.position.x=THREE.MathUtils.lerp(this.companion.position.x,target.x,follow);this.companion.position.z=THREE.MathUtils.lerp(this.companion.position.z,target.z,follow);
  this.companionBaseY=THREE.MathUtils.lerp(this.companionBaseY,target.y,follow);
  const hop=moving?.035*Math.max(0,Math.sin(this.hopTime/ .44*Math.PI*2)):0;
  this.companion.position.y=this.companionBaseY+hop;
  this.companion.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),old.yaw);
 }
 update(dt){
  if(this.destroyed||!Number.isFinite(dt)||dt<=0)return;
  let remaining=dt,iterations=0;
  while(remaining>1e-8&&iterations++<24000){
   const delta=Math.min(.05,remaining);remaining-=delta;this.schedule.advance(delta);
   this.startQueuedAction();
   const due=this.schedule.take(this.busy||this.atomicMovement||Boolean(this.queuedAction)||this.researchElapsed+1e-8<HOUSE_MIN_RESEARCH_SECONDS);if(due)this.begin(due,'automatic');
   this.ambientBoundary=false;
   if(!this.step){
    if(!this.plan.length){this.completeAction();this.startQueuedAction();if(!this.busy){const pending=this.schedule.take(Boolean(this.queuedAction)||this.researchElapsed+1e-8<HOUSE_MIN_RESEARCH_SECONDS);if(pending)this.begin(pending,'automatic');else this.startAmbient();}}
    this.startStep(this.plan.shift());
   }
   if(this.advanceStep(delta)){this.step=null;if(!this.plan.length)this.completeAction();}
   this.correctFridgePassage();this.updateProps();this.updateCompanion(delta);
  }
 }
 getDiagnostics(){return {researchElapsed:this.researchElapsed,lastRelaxFinishedAt:this.lastRelaxFinishedAt,activeTime:this.schedule.activeTime,untilNextRelax:Math.max(0,this.schedule.nextAt-this.schedule.activeTime),phase:this.phase,action:this.actionKind,source:this.actionSource,currentClip:this.currentClip,currentClipTime:this.currentAction?.time||0,currentStepTimeScale:this.step?.timeScale||1,currentStepDuration:this.step?.duration??null,busy:this.busy,pendingRelax:this.schedule.pending,queuedAction:this.queuedAction,tableReplenishments:this.tableReplenishments,completedRelaxActions:this.completedRelaxActions,completedRelaxations:this.completedRelaxActions,consecutiveRelaxActions:this.consecutiveRelaxActions,streak:this.consecutiveRelaxActions,relaxType:this.relaxType,actionNonTravelElapsed:this.actionNonTravelElapsed,plannedNonTravelDuration:this.plannedNonTravelDuration,lastCompletedRelaxation:this.lastCompletedRelaxation?{...this.lastCompletedRelaxation}:null,tableItems:this.tableItems.map(({id,kind,amount})=>({id,kind,amount})),tableEmpty:this.tableEmpty,currentFood:this.currentFood,currentFoodAmount:this.remainingFoodAmount??null,remainingFoodAmount:this.remainingFoodAmount??null,mealSource:this.mealSource,heldFood:this.heldFood,fridgeDoorOpen:this.doorOpen,actorAnchor:this.actor.position.toArray(),actorYaw:this.actorYaw,companionAnchor:this.companion?.position.toArray()||null,history:this.history.map(item=>({...item}))};}
 destroy(){this.clearQueuedAction('destroy');this.destroyed=true;this.cancelPlan();this.actions.clear();this.followHistory=[];for(const root of this.returnedFoodRoots)root.removeFromParent();this.returnedFoodRoots.clear();for(const plate of this.ownedTablePlates)plate.removeFromParent();this.ownedTablePlates.clear();this.tablePlates.clear();this.freshFoodTemplates.clear();}
}
