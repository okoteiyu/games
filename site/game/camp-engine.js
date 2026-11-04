import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS} from './camp-world.js';
import {CAMP_MAX_DAYS,CAMP_DURABLE_TOOL_IDS,campBagSummary,campRuntimeSupplies,isCampDurableTool,canTraverseCampNode,campTraversalConsumption} from './camp-rules.js';
import {planCampNavigation} from './camp-navigation-plan.js';
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
  this.startId=startId;this.depths=this.distances(startId);this.destination=destinations[destination];this.moaiCompassGoalId=destinations.moai_village?.nodeId??world.moaiVillageId??null;if(this.destination.nodeId&&!this.nodeIndex.has(this.destination.nodeId))throw new RangeError('目的地が見つかりません。');
  this.rng=rng;this.onEvent=onEvent;this.secondsPerActivityHour=secondsPerActivityHour;this.goalDistances=this.destination.nodeId?this.distances(this.destination.nodeId):null;
  this.moaiCompassDistances=summary.counts.moai_compass&&this.nodeIndex.has(this.moaiCompassGoalId)?this.distances(this.moaiCompassGoalId):null;
  this.visited=new Set([startId,...discovered.filter(id=>this.nodeIndex.has(id))]);
  // Historical discovery is for the map. The current trip has a separate
  // reached set and a simple ancestry stack so retreat can never reopen a child.
  this.tripReached=new Set([startId]);this.activePath=[startId];this.route=[startId];this.logs=[];this.rainForNextCrossing=false;this.moaiCompassFulfilled=false;
  const supplies=campRuntimeSupplies(summary.counts);supplies.food--;
  const supplyUnits=Object.fromEntries(CAMP_DURABLE_TOOL_IDS.map(id=>[id,'uses']));
  this.state={worldId:world.id,startId,destination,phase:'travel',nodeId:startId,nextNodeId:null,travelProgress:0,crossingHours:0,crossingHoursElapsed:0,day:1,remainingDays:0,dayHours:summary.activityHoursPerDay,dayHoursRemaining:summary.activityHoursPerDay,activityHours:0,supplies,supplyUnits,initialSupplies:{...summary.counts},initialToolUses:{...summary.toolUses},playerLevel,hp:null,maxHp:null,distance:0,finalReason:null,waitingForNight:false,movementMode:null,targetDetourDistance:null};
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
  return clone({...s,remainingDays,current:s.nodeId,next:s.nextNodeId,visited:[...this.visited],tripReached:[...this.tripReached],activePath:this.activePath,route:this.route,backtracking:s.movementMode==='backtrack',injuryProbabilityMultiplier:(s.supplies.gloves ? .7 : 1)*(s.supplies.goggles ? .7 : 1)});
 }
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
 candidateNodes({ignoreTime=false}={}){
  const current=this.nodeIndex.get(this.state.nodeId),distances=this.goalDistances??this.depths,distance=distances.get(current.id);
  return current.neighbors.map(id=>this.nodeIndex.get(id)).filter(node=>{
   const nextDistance=node?distances.get(node.id):undefined;
   const direction=Number.isFinite(nextDistance)&&Number.isFinite(distance)&&(this.goalDistances||nextDistance>=distance);
   return node&&!this.tripReached.has(node.id)&&direction&&canTraverseCampNode(node,this.state.supplies)&&(ignoreTime||this.hasTimeFor(node));
  });
 }
 unknownDistanceWithinFour(candidate){
  if(this.tripReached.has(candidate.id)||!canTraverseCampNode(candidate,this.state.supplies)||!this.hasTimeFor(candidate))return Infinity;
  const initial={...this.state.supplies};for(const [id,n]of Object.entries(campTraversalConsumption(candidate)))initial[id]-=n;
  const queue=[{node:candidate,distance:1,counts:initial,hours:this.remainingActivityHours()-this.crossingHoursFor(candidate),maxHours:this.maximumActivityHours()-this.crossingHoursFor(candidate),path:new Set([this.state.nodeId,candidate.id])}];
  for(let i=0;i<queue.length;i++){
   const {node,distance,counts,hours,maxHours,path}=queue[i];if(!this.visited.has(node.id))return distance;if(distance===4)continue;
   for(const id of node.neighbors){const next=this.nodeIndex.get(id);if(this.tripReached.has(id)||path.has(id)||!next||(this.depths.get(next.id)!==this.depths.get(node.id)&&this.depths.get(next.id)!==this.depths.get(node.id)+1)||!canTraverseCampNode(next,counts)||!this.hasTimeFor(next,{counts,hours,maxHours,rain:false}))continue;
    const nextCounts={...counts};for(const [s,n]of Object.entries(campTraversalConsumption(next)))nextCounts[s]-=n;
    queue.push({node:next,distance:distance+1,counts:nextCounts,hours:hours-this.crossingHoursFor(next,{counts,rain:false}),maxHours:maxHours-this.crossingHoursFor(next,{counts,rain:false}),path:new Set([...path,id])});
   }
  }
  return Infinity;
 }
 unknownWithinFour(candidate){return Number.isFinite(this.unknownDistanceWithinFour(candidate));}
 targetReturnNode(){
  if(!this.goalDistances||this.state.targetDetourDistance===null||this.activePath.length<2)return null;
  const parent=this.nodeIndex.get(this.activePath.at(-2)),distance=this.goalDistances.get(this.state.nodeId),nextDistance=parent?this.goalDistances.get(parent.id):undefined;
  return parent&&Number.isFinite(distance)&&Number.isFinite(nextDistance)&&nextDistance<=distance&&this.canRetraceNode(parent)&&this.hasTimeFor(parent)?parent:null;
 }
 chooseNextNode(){
  let candidates=this.candidateNodes();
  if(this.goalDistances){
   // The two direction groups get equal probability, independently of their
   // sizes. If a group has no legal move, use the other rather than get stuck.
   // After a detour, the actual parent may be a toward/same-distance return;
   // historical visits and arbitrary already-reached shortcuts stay excluded.
   const parent=this.targetReturnNode();if(parent)candidates.push(parent);
   if(!candidates.length)return null;
   const distance=this.goalDistances.get(this.state.nodeId),toward=candidates.filter(node=>this.goalDistances.get(node.id)<=distance),away=candidates.filter(node=>this.goalDistances.get(node.id)>distance),preferToward=this.random()<.5;
   candidates=preferToward?(toward.length?toward:away):(away.length?away:toward);
   return this.pick(candidates);
  }
  if(!candidates.length)return null;
  // Exploration alone follows the first hop of a nearest reachable unknown
  // point within four moves, with the original RNG behavior unchanged.
  const options=candidates.map(node=>({node,distance:this.unknownDistanceWithinFour(node)})),nearest=Math.min(...options.map(option=>option.distance));if(Number.isFinite(nearest))candidates=options.filter(option=>option.distance===nearest).map(option=>option.node);
  return this.pick(candidates);
 }
 guidedMove(){
  if(!this.state.supplies.moai_compass||this.moaiCompassFulfilled)return null;
  // Guidance never replaces the separately selected destination/end rule.
  const goalId=this.moaiCompassGoalId;
  const unavailable={unavailable:true};
  if(!goalId||!this.nodeIndex.has(goalId)||!this.moaiCompassDistances)return unavailable;
  const plan=planCampNavigation({world:this.world,startId:this.startId,currentNodeId:this.state.nodeId,goalId,counts:this.state.supplies,day:this.state.day,dayHours:this.state.dayHours,dayHoursRemaining:this.state.dayHoursRemaining,tripReached:this.tripReached,activePath:this.activePath,rainNext:this.rainForNextCrossing});
  if(plan.status==='reached'){this.moaiCompassFulfilled=true;return null;}
  if(plan.status!=='ready')return unavailable;
  const node=this.nodeIndex.get(plan.nextNodeId),currentDistance=this.moaiCompassDistances.get(this.state.nodeId),nextDistance=node?this.moaiCompassDistances.get(node.id):undefined;
  if(!node||!this.nodeIndex.get(this.state.nodeId).neighbors.includes(node.id)||this.tripReached.has(node.id)||!Number.isFinite(nextDistance)||!(nextDistance<currentDistance)||!canTraverseCampNode(node,this.state.supplies)||!this.hasTimeFor(node))return unavailable;
  return {node,movementMode:'forward'};
 }
 planNext(){
  if(this.state.phase!=='travel'||this.state.nextNodeId)return;
  if(this.destination.nodeId===this.state.nodeId){this.finalize('destination');return;}
  const guided=this.guidedMove();if(guided?.unavailable){this.finalize('compass-route-unavailable');return;}
  let next=guided?.node??this.chooseNextNode(),movementMode=guided?.movementMode??(this.goalDistances&&next&&this.tripReached.has(next.id)?'backtrack':'forward');
  if(!next){
   // Backtracking is the sole allowed revisit. It retraces the active ancestry
   // one edge at a time. Durable uses are included in the outward passage,
   // while destination terrain, time, rain and nonconsumed gates still apply.
   const parentId=this.activePath.length>1?this.activePath[this.activePath.length-2]:null;
   next=parentId?this.nodeIndex.get(parentId):null;movementMode='backtrack';
   if(!next){this.finalize(this.candidateNodes({ignoreTime:true}).length?'supplies':'no-route');return;}
   if(this.goalDistances&&!(this.goalDistances.get(next.id)<=this.goalDistances.get(this.state.nodeId))){this.finalize('no-route');return;}
   if(!this.canRetraceNode(next)){this.finalize('return-tools');return;}
   if(!this.hasTimeFor(next)){this.finalize('supplies');return;}
  }
  const hours=this.crossingHoursFor(next),knownHours=this.remainingActivityHours();
  this.rainForNextCrossing=false;Object.assign(this.state,{nextNodeId:next.id,crossingHours:hours,crossingHoursElapsed:0,travelProgress:0,waitingForNight:hours>knownHours+EPS,movementMode});
 }
 medical(reason){
  const s=this.state;if(!s.supplies.medical_kit||!(s.maxHp>0)||!(s.hp>0)||s.hp>s.maxHp*.5)return false;
  const amount=Math.min(s.maxHp-s.hp,s.maxHp*.3);if(amount<=0)return false;s.hp+=amount;this.emit('heal',{amount,hp:s.hp,maxHp:s.maxHp,reason});return true;
 }
 consume(id,amount=1){if(amount<=0)return;const used=Math.min(this.state.supplies[id]||0,amount);if(used<=0)return;this.state.supplies[id]-=used;this.emit('supply',{supplyId:id,amount:used,remaining:this.state.supplies[id],unit:isCampDurableTool(id)?'uses':'items'});}
 arrive(){
  const s=this.state,node=this.nodeIndex.get(s.nextNodeId);if(!node){this.finalize('no-route');return;}
  const fromNodeId=s.nodeId,backtracking=s.movementMode==='backtrack';
  if(backtracking){
   if(this.activePath.length<2||this.activePath.at(-1)!==fromNodeId||this.activePath.at(-2)!==node.id){this.finalize('no-route');return;}
  }else if(this.tripReached.has(node.id)){this.finalize('no-route');return;}
  if(!(backtracking?this.canRetraceNode(node):canTraverseCampNode(node,s.supplies))){this.finalize('supplies');return;}
  const newlyDiscovered=!this.visited.has(node.id);
  if(!backtracking)for(const [id,amount]of Object.entries(campTraversalConsumption(node)))this.consume(id,amount);
  s.nodeId=node.id;s.nextNodeId=null;s.crossingHours=0;s.crossingHoursElapsed=0;s.travelProgress=0;s.distance++;s.movementMode=null;
  if(this.goalDistances){
   const before=this.goalDistances.get(fromNodeId),after=this.goalDistances.get(node.id);
   if(!backtracking&&after>before&&s.targetDetourDistance===null)s.targetDetourDistance=before;
   if(s.targetDetourDistance!==null&&after<=s.targetDetourDistance)s.targetDetourDistance=null;
  }
  if(backtracking)this.activePath.pop();else{this.activePath.push(node.id);this.tripReached.add(node.id);}
  this.visited.add(node.id);this.route.push(node.id);this.emit('arrive',{terrain:node.terrain,newlyDiscovered,fromNodeId,backtracking});
  // Separate draws allow a weather/wildlife event and a battle at one vertex.
  if(this.random()<.3){
   if(this.random()<.5){this.rainForNextCrossing=true;this.emit('weather',{kind:'rain',multiplier:1.5});this.medical('rain');}
   else{const used=s.supplies.food>0?1:0;this.consume('food',used);this.emit('wildlife',{consumedFood:used});this.medical('wildlife');}
  }
  if(this.destination.nodeId===node.id){this.finalize('destination');return;}
  if(this.random()<.5){s.phase='encounter';this.emit('encounter',{playerLevel:s.playerLevel,levelRange:{min:s.playerLevel-5,max:s.playerLevel+3}});return;}
  if(s.dayHoursRemaining<=EPS)this.endDay();else this.planNext();
 }
 tick(deltaSeconds,context={}){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new RangeError('キャンプの経過時間が正しくありません。');
  if(this.state.phase!=='travel')return this.snapshot();this.context(context);if(deltaSeconds===0)return this.snapshot();
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
  if(s.supplies.survival_kit){const extended=this.random()<.3&&s.supplies.food<CAMP_MAX_DAYS-s.day;if(extended)s.supplies.food++;this.emit('survival',{extended,addedDays:extended?1:0});this.medical('survival');}
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
  if(!won||this.state.hp===0){this.state.phase='failed';this.state.finalReason='battle-loss';this.emit('failed',{reason:'battle-loss'});return true;}
  this.medical('battle');this.state.phase='travel';if(this.destination.nodeId===this.state.nodeId)this.finalize('destination');else if(this.state.dayHoursRemaining<=EPS)this.endDay();else this.planNext();return true;
 }
 finalize(reason){
  if(['final','failed','finished'].includes(this.state.phase))return false;
  Object.assign(this.state,{phase:'final',finalReason:reason,nextNodeId:null,travelProgress:0,crossingHours:0,crossingHoursElapsed:0,waitingForNight:false,movementMode:null});this.emit('final',{destination:this.state.destination,reason});return true;
 }
 finish(result='completed'){if(this.state.phase==='finished')return false;this.state.phase='finished';this.state.finalReason=result;this.emit('finish',{result});return true;}
 abort(reason='cancelled'){return this.finish(reason);}
}
