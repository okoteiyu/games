import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS} from './camp-world.js';
import {CAMP_MAX_DAYS,CAMP_SUPPLIES,CAMP_DURABLE_TOOL_IDS,campBagSummary,campRuntimeSupplies,isCampDurableTool,canTraverseCampNode,campTraversalConsumption} from './camp-rules.js';
import {planCampNavigation} from './camp-navigation-plan.js';
import {CAMP_FAIRIES} from './camp-fairy-data.js';
const EPS=1e-9,clone=value=>JSON.parse(JSON.stringify(value));
export const CAMP_SECONDS_PER_ACTIVITY_HOUR=.65;
/** No combat rules live here: real battles pause and resume this journey. */
export class CampExpedition{
 constructor({bag,destination='none',playerLevel=5,discovered=[],rng=Math.random,onEvent=()=>{},world=CAMP_WORLD,startId=world.startId,destinations=CAMP_DESTINATIONS,secondsPerActivityHour=CAMP_SECONDS_PER_ACTIVITY_HOUR}={}){
  if(typeof rng!=='function'||typeof onEvent!=='function')throw new TypeError('キャンプの処理が正しくありません。');
  if(!Number.isInteger(playerLevel)||playerLevel<1||playerLevel>106)throw new RangeError('キャンプのレベルが正しくありません。');
  if(!Number.isFinite(secondsPerActivityHour)||secondsPerActivityHour<=0)throw new RangeError('キャンプの進行速度が正しくありません。');
  const summary=campBagSummary(bag);if(summary.counts.food<1)throw new RangeError('キャンプには携帯食料が必要です。');
  this.world=world;this.nodeIndex=new Map(world.nodes.map(node=>[node.id,node]));if(!this.nodeIndex.has(startId))throw new TypeError('キャンプの始点が見つかりません。');
  if(!Object.hasOwn(destinations,destination))throw new RangeError('キャンプの目的地が正しくありません。');
  this.startId=startId;this.depths=this.distances(startId);this.destination=destinations[destination];
  this.guidanceItem=Object.values(CAMP_SUPPLIES).find(item=>summary.counts[item.id]&&item.category==='route_guidance')??(summary.counts.moai_compass?CAMP_SUPPLIES.moai_compass:null);
  this.guidanceDestinationId=this.guidanceItem?.routeDestinationId??(this.guidanceItem?.id==='moai_compass'?'moai_village':null);
  this.guidanceGoalId=destinations[this.guidanceDestinationId]?.nodeId??(this.guidanceDestinationId==='moai_village'?world.moaiVillageId:null)??null;
  this.moaiCompassGoalId=this.guidanceGoalId;if(this.destination.nodeId&&!this.nodeIndex.has(this.destination.nodeId))throw new RangeError('目的地が見つかりません。');
  this.rng=rng;this.onEvent=onEvent;this.secondsPerActivityHour=secondsPerActivityHour;this.goalDistances=this.destination.nodeId?this.distances(this.destination.nodeId):null;
  this.moaiCompassDistances=this.guidanceItem&&this.nodeIndex.has(this.guidanceGoalId)?this.distances(this.guidanceGoalId):null;
  this.visited=new Set([startId,...discovered.filter(id=>this.nodeIndex.has(id))]);
  // Historical discovery is for the map. This trip keeps its reached set and
  // a loop-erased ancestry path; objective/guided moves may revisit vertices.
  this.tripReached=new Set([startId]);this.activePath=[startId];this.route=[startId];this.logs=[];this.rainForNextCrossing=false;this.moaiCompassFulfilled=Boolean(this.guidanceItem&&startId===this.guidanceGoalId);this.fairySelection=null;this.pendingFairy=null;this.pendingFairyMove=null;
  const supplies=campRuntimeSupplies(summary.counts);supplies.food--;
  const supplyUnits=Object.fromEntries(CAMP_DURABLE_TOOL_IDS.map(id=>[id,'uses']));
  this.state={worldId:world.id,startId,destination,guidanceItemId:this.guidanceItem?.id??null,guidanceGoalId:this.guidanceGoalId,guidanceFulfilled:this.moaiCompassFulfilled,phase:'travel',nodeId:startId,nextNodeId:null,travelProgress:0,crossingHours:0,crossingHoursElapsed:0,day:1,remainingDays:0,dayHours:summary.activityHoursPerDay,dayHoursRemaining:summary.activityHoursPerDay,activityHours:0,supplies,supplyUnits,initialSupplies:{...summary.counts},initialToolUses:{...summary.toolUses},playerLevel,hp:null,maxHp:null,distance:0,finalReason:null,waitingForNight:false,movementMode:null,targetDetourDistance:null,fairyRequests:Object.fromEntries(Object.entries(CAMP_FAIRIES).map(([id,fairy])=>[id,fairy.maxRequests])),fairyMarks:[]};
 }
 random(){const value=Number(this.rng());if(!Number.isFinite(value))throw new TypeError('キャンプの乱数が正しくありません。');return Math.max(0,Math.min(1-Number.EPSILON,value));}
 pick(items){return items.length?items[Math.floor(this.random()*items.length)]:null;}
 distances(origin){const out=new Map([[origin,0]]),queue=[origin];for(let i=0;i<queue.length;i++)for(const id of this.nodeIndex.get(queue[i]).neighbors)if(!out.has(id)){out.set(id,out.get(queue[i])+1);queue.push(id);}return out;}
 context({hp,maxHp,power,playerLevel}={}){
  if(Number.isFinite(maxHp)&&maxHp>0)this.state.maxHp=maxHp;
  if(Number.isFinite(hp)&&hp>=0)this.state.hp=Math.min(hp,this.state.maxHp??hp);
  if(Number.isFinite(power)&&power>=0)this.state.power=power;
  if(Number.isInteger(playerLevel)&&playerLevel>=1&&playerLevel<=106)this.state.playerLevel=playerLevel;
 }
 emit(type,payload={}){
  const event={type,day:this.state.day,activityHours:this.state.activityHours,nodeId:this.state.nodeId,...payload};
  this.logs.push(event);if(this.logs.length>400)this.logs.shift();this.onEvent(clone(event));return event;
 }
 snapshot(){
  const s=this.state,active=s.phase==='travel'||s.phase==='encounter';
  const remainingDays=['final','failed','finished'].includes(s.phase)?0:Math.max(0,Math.min(CAMP_MAX_DAYS-s.day+(active?1:0),s.supplies.food+(active?1:0)));
  return clone({...s,fairySelection:this.fairySelection,remainingDays,current:s.nodeId,next:s.nextNodeId,visited:[...this.visited],tripReached:[...this.tripReached],activePath:this.activePath,route:this.route,backtracking:s.movementMode==='backtrack',injuryProbabilityMultiplier:(s.supplies.gloves ? .7 : 1)*(s.supplies.goggles ? .7 : 1)});
 }
 fairyRequestOptions(kind){
  const junction=this.nodeIndex.get(this.state.nextNodeId);
  if(!Object.hasOwn(CAMP_FAIRIES,kind)||this.state.phase!=='travel'||!junction||this.state.fairyRequests[kind]<=0||this.pendingFairy?.fromNodeId===junction.id||this.fairySelection&&this.fairySelection.kind!==kind||junction.id===this.destination.nodeId&&!this.hasActiveGuidance())return null;
  return {kind,junctionId:junction.id,nodeIds:[...junction.neighbors]};
 }
 beginFairySelection(kind){
  if(this.fairySelection)return {ok:false,reason:'busy'};
  const options=this.fairyRequestOptions(kind);if(!options||!options.nodeIds.length)return {ok:false,reason:'unavailable'};
  this.fairySelection={kind,fromNodeId:options.junctionId};return {ok:true,...options};
 }
 endFairySelection(){this.fairySelection=null;}
 requestFairy(kind,nodeId){
  const options=this.fairyRequestOptions(kind);
  if(!options||!options.nodeIds.includes(nodeId)||this.fairySelection&&this.fairySelection.fromNodeId!==options.junctionId)return {ok:false,reason:'unavailable'};
  const mark={kind,fromNodeId:options.junctionId,toNodeId:nodeId,active:true,resolved:false};this.state.fairyRequests[kind]--;this.state.fairyMarks.push(mark);this.pendingFairy=mark;
  this.emit('fairy-request',{kind,junctionId:mark.fromNodeId,toNodeId:nodeId});return {ok:true,mark:clone(mark)};
 }
 resolveFairy(mark,next){
  if(!mark||mark.resolved)return;
  mark.active=false;mark.resolved=true;mark.takenNodeId=next?.id??null;mark.followed=Boolean(next&&(mark.kind==='tomato'?next.id===mark.toNodeId:next.id!==mark.toNodeId));
  this.emit('fairy-resolution',{kind:mark.kind,junctionId:mark.fromNodeId,toNodeId:mark.toNodeId,takenNodeId:mark.takenNodeId,followed:mark.followed});
 }
 clearFairyRequests(){if(this.pendingFairy){this.pendingFairy.active=false;this.pendingFairy.resolved=true;this.pendingFairy=null;}this.fairySelection=null;this.pendingFairyMove=null;}
 remainingActivityHours(){const s=this.state;return s.dayHoursRemaining+Math.min(s.supplies.food,CAMP_MAX_DAYS-s.day)*s.dayHours;}
 maximumActivityHours(){const s=this.state;return s.dayHoursRemaining+Math.max(0,CAMP_MAX_DAYS-s.day)*s.dayHours;}
 crossingHoursFor(node,{counts=this.state.supplies,rain=this.rainForNextCrossing}={}){return (CAMP_TERRAINS[node.terrain]?.hours??6)*(counts.compass ? .6 : 1)*(rain?1.5:1);}
 hasTimeFor(node,{counts=this.state.supplies,hours=this.remainingActivityHours(),maxHours=this.maximumActivityHours(),rain=this.rainForNextCrossing}={}){
  const cost=this.crossingHoursFor(node,{counts,rain});
  // Even perfect survival-kit draws cannot create a sixteenth activity day.
  return cost<=maxHours+EPS&&(cost<=hours+EPS||Boolean(counts.survival_kit&&this.state.day<CAMP_MAX_DAYS));
 }
 canRetraceNode(node){
  // A paid outward passage includes its return. Exhausted durable tools cannot
  // strand the party on its actual ancestry path; flashlight gates still apply.
  const counts={...this.state.supplies};for(const id of CAMP_DURABLE_TOOL_IDS)counts[id]=Math.max(1,counts[id]||0);
  return canTraverseCampNode(node,counts);
 }
 isParentNode(node){return this.activePath.length>1&&this.activePath.at(-2)===node?.id;}
 isObjectiveNode(node){
  const distances=this.goalDistances??this.depths,currentDistance=distances.get(this.state.nodeId),nextDistance=distances.get(node?.id);
  return this.goalDistances?nextDistance<currentDistance:nextDistance>currentDistance;
 }
 canEnterNode(node,{ignoreTime=false}={}){return Boolean(node&&(this.isParentNode(node)?this.canRetraceNode(node):canTraverseCampNode(node,this.state.supplies))&&(ignoreTime||this.hasTimeFor(node)));}
 candidateNodes({ignoreTime=false}={}){
  // Direction stays a preference. Previously reached vertices are also legal
  // when they strictly advance the current objective; discovery is irrelevant.
  const current=this.nodeIndex.get(this.state.nodeId);
  return current.neighbors.map(id=>this.nodeIndex.get(id)).filter(node=>node&&(!this.tripReached.has(node.id)||this.isObjectiveNode(node))&&this.canEnterNode(node,{ignoreTime}));
 }
 unknownDistanceWithinFour(candidate){
  if(!candidate)return Infinity;
  // This short search follows the fog/discovery set, not this trip's reached
  // set. Known connectors may lead to nearby unknown land. Evaluate every
  // prospective passage with its own remaining uses, time and return path.
  const advance=(entry,node,first)=>{
   const backtracking=entry.ancestry.length>1&&entry.ancestry.at(-2)===node.id,counts={...entry.counts},gates={...counts};
   if(backtracking)for(const id of CAMP_DURABLE_TOOL_IDS)gates[id]=Math.max(1,gates[id]||0);
   if(!canTraverseCampNode(node,gates)||!this.hasTimeFor(node,{counts,hours:entry.hours,maxHours:entry.maxHours,rain:first&&this.rainForNextCrossing}))return null;
   const cost=this.crossingHoursFor(node,{counts,rain:first&&this.rainForNextCrossing});
   if(!backtracking)for(const [id,amount]of Object.entries(campTraversalConsumption(node)))counts[id]-=amount;
   const ancestry=[...entry.ancestry];if(backtracking)ancestry.pop();else{const ancestor=ancestry.indexOf(node.id);if(ancestor>=0)ancestry.length=ancestor+1;else ancestry.push(node.id);}
   return {node,counts,hours:entry.hours-cost,maxHours:entry.maxHours-cost,ancestry,distance:entry.distance+1,path:new Set([...entry.path,node.id])};
  };
  const initial=advance({counts:this.state.supplies,hours:this.remainingActivityHours(),maxHours:this.maximumActivityHours(),ancestry:this.activePath,distance:0,path:new Set([this.state.nodeId])},candidate,true);
  if(!initial)return Infinity;
  const queue=[initial];
  for(let i=0;i<queue.length;i++){
   const entry=queue[i];if(!this.visited.has(entry.node.id))return entry.distance;if(entry.distance>=4)continue;
   for(const id of entry.node.neighbors){if(entry.path.has(id))continue;const next=this.nodeIndex.get(id);if(!next)continue;const advanced=advance(entry,next,false);if(advanced)queue.push(advanced);}
  }
  return Infinity;
 }
 nearbyUnknownCandidates(){
  if(this.goalDistances||this.hasActiveGuidance())return [];
  const current=this.nodeIndex.get(this.state.nodeId),options=current.neighbors.map(id=>this.nodeIndex.get(id)).filter(Boolean).map(node=>({node,distance:this.unknownDistanceWithinFour(node)})),nearest=Math.min(...options.map(option=>option.distance));
  return Number.isFinite(nearest)?options.filter(option=>option.distance===nearest).map(option=>option.node):[];
 }
 chooseNextNode({avoidNodeId=null}={}){
  this.unknownSelection=null;const unknown=this.nearbyUnknownCandidates().filter(node=>node.id!==avoidNodeId);
  if(unknown.length){const node=this.pick(unknown);this.unknownSelection=node.id;return node;}
  const candidates=this.candidateNodes().filter(node=>node.id!==avoidNodeId);if(!candidates.length)return null;
  const preferred=candidates.filter(node=>this.isObjectiveNode(node));
  // One independent coin per decision: on success choose a legal objective
  // route; otherwise choose uniformly from every legal forward route, including
  // those objective routes. An unavailable preference simply uses that fallback.
  const preferObjective=this.random()<.5;
  return this.pick(preferObjective&&preferred.length?preferred:candidates);
 }
 hasActiveGuidance(){return Boolean(this.guidanceItem&&this.state.supplies[this.guidanceItem.id]&&!this.state.guidanceFulfilled);}
 completeGuidanceIfReached(){
  if(!this.hasActiveGuidance()||this.state.nodeId!==this.guidanceGoalId)return false;
  this.state.guidanceFulfilled=true;this.moaiCompassFulfilled=true;return true;
 }
 guidedMove({avoidFirstNodeId=null}={}){
  if(!this.hasActiveGuidance())return null;
  // Guidance never replaces the separately selected destination/end rule.
  const goalId=this.guidanceGoalId;
  const unavailable={unavailable:true};
  if(!goalId||!this.nodeIndex.has(goalId)||!this.moaiCompassDistances)return unavailable;
  const plan=planCampNavigation({world:this.world,startId:this.startId,currentNodeId:this.state.nodeId,goalId,counts:this.state.supplies,usedToolUses:Object.fromEntries(CAMP_DURABLE_TOOL_IDS.map(id=>[id,Math.max(0,(this.state.initialToolUses[id]??0)-(this.state.supplies[id]??0))])),day:this.state.day,dayHours:this.state.dayHours,dayHoursRemaining:this.state.dayHoursRemaining,tripReached:this.tripReached,activePath:this.activePath,rainNext:this.rainForNextCrossing,avoidFirstNodeId});
  if(plan.status==='reached'){this.state.guidanceFulfilled=true;this.moaiCompassFulfilled=true;return null;}
  if(plan.status!=='ready')return unavailable;
  const node=this.nodeIndex.get(plan.nextNodeId);
  if(!node||!this.nodeIndex.get(this.state.nodeId).neighbors.includes(node.id)||!this.canEnterNode(node))return unavailable;
  return {node,movementMode:this.isParentNode(node)?'backtrack':'forward'};
 }
 planNext(){
  if(this.state.phase!=='travel'||this.state.nextNodeId)return;
  this.pendingUnknownMove=null;this.pendingFairyMove=null;this.unknownSelection=null;
  if(this.destination.nodeId===this.state.nodeId&&!this.hasActiveGuidance()){this.finalize('destination');return;}
  const request=this.pendingFairy?.fromNodeId===this.state.nodeId?this.pendingFairy:null;
  if(request){this.pendingFairy=null;request.active=false;}
  const normal=avoidNodeId=>{const guided=this.guidedMove({avoidFirstNodeId:avoidNodeId});if(guided?.unavailable)return guided;const node=guided?.node??this.chooseNextNode({avoidNodeId});return {node,movementMode:guided?.movementMode??(this.isParentNode(node)?'backtrack':'forward')};};
  let choice=null;
  if(request?.kind==='tomato'){const node=this.nodeIndex.get(request.toNodeId);if(this.canEnterNode(node))choice={node,movementMode:this.isParentNode(node)?'backtrack':'forward'};}
  else if(request?.kind==='eggplant'){
   const alternative=normal(request.toNodeId);if(alternative.node&&!alternative.unavailable)choice=alternative;
   else if(!alternative.unavailable){
    // Avoiding this edge may require a one-off revisit outside the usual
    // objective direction. Keep return-only tool costs on the real parent.
    const candidates=this.nodeIndex.get(this.state.nodeId).neighbors.filter(id=>id!==request.toNodeId).map(id=>this.nodeIndex.get(id)).filter(node=>this.canEnterNode(node)),forward=candidates.filter(node=>!this.isParentNode(node)),node=this.pick(forward.length?forward:candidates);
    if(node)choice={node,movementMode:this.isParentNode(node)?'backtrack':'forward'};
   }
  }
  choice??=normal(null);
  const stop=reason=>{this.resolveFairy(request,null);this.finalize(reason);};
  if(choice.unavailable){stop('compass-route-unavailable');return;}
  let next=choice.node,movementMode=choice.movementMode;
  if(!next){
   // If no objective/ordinary move is legal, retreat one real ancestry edge.
   // Durable uses are included in that outward passage; terrain time, rain
   // and nonconsumed gates still apply.
   const parentId=this.activePath.length>1?this.activePath[this.activePath.length-2]:null;
   next=parentId?this.nodeIndex.get(parentId):null;movementMode='backtrack';
   if(!next){stop(this.candidateNodes({ignoreTime:true}).length?'supplies':'no-route');return;}
   if(!this.canRetraceNode(next)){stop('return-tools');return;}
   if(!this.hasTimeFor(next)){stop('supplies');return;}
  }
  const hours=this.crossingHoursFor(next),knownHours=this.remainingActivityHours();
  if(this.unknownSelection===next.id)this.pendingUnknownMove={fromNodeId:this.state.nodeId,nodeId:next.id};
  if(request)this.pendingFairyMove={fromNodeId:this.state.nodeId,nodeId:next.id};
  this.rainForNextCrossing=false;Object.assign(this.state,{nextNodeId:next.id,crossingHours:hours,crossingHoursElapsed:0,travelProgress:0,waitingForNight:hours>knownHours+EPS,movementMode});
  this.resolveFairy(request,next);
 }
 medical(reason){
  const s=this.state;if(reason!=='battle'||!s.supplies.medical_kit||!(s.maxHp>0)||!(s.hp>0))return false;
  const amount=Math.min(s.maxHp-s.hp,s.maxHp*.15);if(amount<=0)return false;s.hp+=amount;this.emit('heal',{amount,hp:s.hp,maxHp:s.maxHp,reason});return true;
 }
 consume(id,amount=1){if(amount<=0)return;const used=Math.min(this.state.supplies[id]||0,amount);if(used<=0)return;this.state.supplies[id]-=used;this.emit('supply',{supplyId:id,amount:used,remaining:this.state.supplies[id],unit:isCampDurableTool(id)?'uses':'items'});}
 arrive(){
  const s=this.state,node=this.nodeIndex.get(s.nextNodeId);if(!node){this.finalize('no-route');return;}
  const fromNodeId=s.nodeId,backtracking=s.movementMode==='backtrack';
  if(backtracking){
   if(this.activePath.length<2||this.activePath.at(-1)!==fromNodeId||this.activePath.at(-2)!==node.id){this.finalize('no-route');return;}
  }else if(this.tripReached.has(node.id)&&!this.hasActiveGuidance()&&!this.isObjectiveNode(node)&&!(this.pendingUnknownMove?.fromNodeId===fromNodeId&&this.pendingUnknownMove.nodeId===node.id)&&!(this.pendingFairyMove?.fromNodeId===fromNodeId&&this.pendingFairyMove.nodeId===node.id)){this.finalize('no-route');return;}
  if(!(backtracking?this.canRetraceNode(node):canTraverseCampNode(node,s.supplies))){this.finalize('supplies');return;}
  const newlyDiscovered=!this.visited.has(node.id);
  this.pendingUnknownMove=null;this.pendingFairyMove=null;
  if(!backtracking)for(const [id,amount]of Object.entries(campTraversalConsumption(node)))this.consume(id,amount);
  s.nodeId=node.id;s.nextNodeId=null;s.crossingHours=0;s.crossingHoursElapsed=0;s.travelProgress=0;s.distance++;s.movementMode=null;
  if(backtracking)this.activePath.pop();else{
   // Record the actual edge in route below, but erase any closed ancestry loop
   // so a later retreat/planner always receives one valid, simple return path.
   const ancestor=this.activePath.indexOf(node.id);if(ancestor>=0)this.activePath.length=ancestor+1;else this.activePath.push(node.id);
   this.tripReached.add(node.id);
  }
  this.visited.add(node.id);this.route.push(node.id);this.completeGuidanceIfReached();this.emit('arrive',{terrain:node.terrain,newlyDiscovered,fromNodeId,backtracking});
  // Separate draws allow a weather/wildlife event and a battle at one vertex.
  if(this.random()<.3){
   if(this.random()<.5){this.rainForNextCrossing=true;this.emit('weather',{kind:'rain',multiplier:1.5});}
   else{const used=s.supplies.food>0?1:0;this.consume('food',used);this.emit('wildlife',{consumedFood:used});}
  }
  if(this.destination.nodeId===node.id&&!this.hasActiveGuidance()){this.finalize('destination');return;}
  if(this.random()<.5){s.phase='encounter';this.emit('encounter',{playerLevel:s.playerLevel,levelRange:{min:s.playerLevel-5,max:s.playerLevel+3}});return;}
  if(s.dayHoursRemaining<=EPS)this.endDay();else this.planNext();
 }
 tick(deltaSeconds,context={}){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new RangeError('キャンプの経過時間が正しくありません。');
  if(this.state.phase!=='travel'||this.fairySelection)return this.snapshot();this.context(context);if(deltaSeconds===0)return this.snapshot();
  let hours=deltaSeconds/this.secondsPerActivityHour,iterations=0;
  while(hours>EPS&&this.state.phase==='travel'&&iterations++<500){
   if(this.state.dayHoursRemaining<=EPS){this.endDay();break;}
   this.planNext();if(this.state.phase!=='travel'||!this.state.nextNodeId)break;
   const s=this.state;
   if(s.waitingForNight){const rest=Math.min(hours,s.dayHoursRemaining);s.dayHoursRemaining-=rest;s.activityHours+=rest;hours-=rest;if(s.dayHoursRemaining<=EPS)this.endDay();continue;}
   const remaining=s.crossingHours-s.crossingHoursElapsed,step=Math.min(hours,remaining,s.dayHoursRemaining);
   s.crossingHoursElapsed+=step;s.dayHoursRemaining=Math.max(0,s.dayHoursRemaining-step);s.activityHours+=step;hours-=step;s.travelProgress=Math.min(1,s.crossingHoursElapsed/s.crossingHours);
   if(s.crossingHoursElapsed>=s.crossingHours-EPS)this.arrive();else if(s.dayHoursRemaining<=EPS)this.endDay();
  }
  return this.snapshot();
 }
 endDay(){
  const s=this.state;if(s.phase!=='travel')return false;
  s.dayHoursRemaining=0;
  if(s.day>=CAMP_MAX_DAYS){this.finalize('time-limit');return true;}
  if(s.supplies.survival_kit){const extended=this.random()<.3&&s.supplies.food<CAMP_MAX_DAYS-s.day;if(extended)s.supplies.food++;this.emit('survival',{extended,addedDays:extended?1:0});}
  if(s.supplies.food<=0){this.finalize('supplies');return true;}
  s.phase='night';this.emit('night',{duration:2});return true;
 }
 resumeAfterNight(){
  const s=this.state;if(s.phase!=='night')return false;
  if(s.day>=CAMP_MAX_DAYS||s.supplies.food<=0){s.phase='travel';this.finalize(s.day>=CAMP_MAX_DAYS?'time-limit':'supplies');return false;}
  s.day++;this.consume('food');s.dayHoursRemaining=s.dayHours;s.waitingForNight=false;s.phase='travel';if(!s.nextNodeId)this.planNext();return true;
 }
 resolveEncounter({won,hp,maxHp}={}){
  if(this.state.phase!=='encounter')return false;if(typeof won!=='boolean')throw new TypeError('キャンプの戦闘結果が正しくありません。');this.context({hp,maxHp});
  if(!won||this.state.hp===0){this.clearFairyRequests();this.state.phase='failed';this.state.finalReason='battle-loss';this.emit('failed',{reason:'battle-loss'});return true;}
  this.medical('battle');this.state.phase='travel';if(this.destination.nodeId===this.state.nodeId&&!this.hasActiveGuidance())this.finalize('destination');else if(this.state.dayHoursRemaining<=EPS)this.endDay();else this.planNext();return true;
 }
 finalize(reason){
  if(['final','failed','finished'].includes(this.state.phase))return false;
  this.pendingUnknownMove=null;this.unknownSelection=null;
  this.clearFairyRequests();
  Object.assign(this.state,{phase:'final',finalReason:reason,nextNodeId:null,travelProgress:0,crossingHours:0,crossingHoursElapsed:0,waitingForNight:false,movementMode:null});this.emit('final',{destination:this.state.destination,reason});return true;
 }
 finish(result='completed'){if(this.state.phase==='finished')return false;this.clearFairyRequests();this.state.phase='finished';this.state.finalReason=result;this.emit('finish',{result});return true;}
 abort(reason='cancelled'){return this.finish(reason);}
}
