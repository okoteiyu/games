import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS} from './camp-world.js';
import {CAMP_MAX_DAYS,campBagSummary,canTraverseCampNode,campTraversalConsumption} from './camp-rules.js';
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
  this.startId=startId;this.depths=this.distances(startId);this.destination=destinations[destination];if(this.destination.nodeId&&!this.nodeIndex.has(this.destination.nodeId))throw new RangeError('目的地が見つかりません。');
  this.rng=rng;this.onEvent=onEvent;this.secondsPerActivityHour=secondsPerActivityHour;this.goalDistances=this.destination.nodeId?this.distances(this.destination.nodeId):null;
  this.visited=new Set([startId,...discovered.filter(id=>this.nodeIndex.has(id))]);this.route=[startId];this.logs=[];this.rainForNextCrossing=false;
  const supplies={...summary.counts};supplies.food--;
  this.state={worldId:world.id,startId,destination,phase:'travel',nodeId:startId,nextNodeId:null,travelProgress:0,crossingHours:0,crossingHoursElapsed:0,day:1,remainingDays:0,dayHours:summary.activityHoursPerDay,dayHoursRemaining:summary.activityHoursPerDay,activityHours:0,supplies,initialSupplies:{...summary.counts},playerLevel,hp:null,maxHp:null,distance:0,finalReason:null,waitingForNight:false};
 }
 random(){const value=Number(this.rng());if(!Number.isFinite(value))throw new TypeError('キャンプの乱数が正しくありません。');return Math.max(0,Math.min(1-Number.EPSILON,value));}
 pick(items){return items.length?items[Math.floor(this.random()*items.length)]:null;}
 distances(origin){const out=new Map([[origin,0]]),queue=[origin];for(let i=0;i<queue.length;i++)for(const id of this.nodeIndex.get(queue[i]).neighbors)if(!out.has(id)){out.set(id,out.get(queue[i])+1);queue.push(id);}return out;}
 context({hp,maxHp,power}={}){
  if(Number.isFinite(maxHp)&&maxHp>0)this.state.maxHp=maxHp;
  if(Number.isFinite(hp)&&hp>=0)this.state.hp=Math.min(hp,this.state.maxHp??hp);
  if(Number.isFinite(power)&&power>=0)this.state.power=power;
 }
 emit(type,payload={}){
  const event={type,day:this.state.day,activityHours:this.state.activityHours,nodeId:this.state.nodeId,...payload};
  this.logs.push(event);if(this.logs.length>400)this.logs.shift();this.onEvent(clone(event));return event;
 }
 snapshot(){
  const s=this.state,active=s.phase==='travel'||s.phase==='encounter';
  const remainingDays=['final','failed','finished'].includes(s.phase)?0:Math.max(0,Math.min(CAMP_MAX_DAYS-s.day+(active?1:0),s.supplies.food+(active?1:0)));
  return clone({...s,remainingDays,current:s.nodeId,next:s.nextNodeId,visited:[...this.visited],route:this.route,injuryProbabilityMultiplier:(s.supplies.gloves ? .7 : 1)*(s.supplies.goggles ? .7 : 1)});
 }
 candidateNodes(){const current=this.nodeIndex.get(this.state.nodeId),depth=this.depths.get(current.id);return current.neighbors.map(id=>this.nodeIndex.get(id)).filter(node=>node&&(this.depths.get(node.id)===depth||this.depths.get(node.id)===depth+1)&&canTraverseCampNode(node,this.state.supplies));}
 unknownWithinFour(candidate){
  const initial={...this.state.supplies};for(const [id,n]of Object.entries(campTraversalConsumption(candidate)))initial[id]-=n;
  const queue=[{node:candidate,remaining:3,counts:initial,path:new Set([this.state.nodeId,candidate.id])}];
  for(let i=0;i<queue.length;i++){
   const {node,remaining,counts,path}=queue[i];if(!this.visited.has(node.id))return true;if(!remaining)continue;
   for(const id of node.neighbors){const next=this.nodeIndex.get(id);if(path.has(id)||!next||(this.depths.get(next.id)!==this.depths.get(node.id)&&this.depths.get(next.id)!==this.depths.get(node.id)+1)||!canTraverseCampNode(next,counts))continue;
    const nextCounts={...counts};for(const [s,n]of Object.entries(campTraversalConsumption(next)))nextCounts[s]-=n;
    queue.push({node:next,remaining:remaining-1,counts:nextCounts,path:new Set([...path,id])});
   }
  }
  return false;
 }
 chooseNextNode(){
  let candidates=this.candidateNodes();if(!candidates.length)return null;
  const unknown=candidates.filter(node=>this.unknownWithinFour(node));if(unknown.length)candidates=unknown;
  if(this.goalDistances&&this.random()<.7){const current=this.goalDistances.get(this.state.nodeId),closer=candidates.filter(node=>this.goalDistances.get(node.id)<current);if(closer.length)candidates=closer;}
  return this.pick(candidates);
 }
 planNext(){
  if(this.state.phase!=='travel'||this.state.nextNodeId)return;
  if(this.destination.nodeId===this.state.nodeId){this.finalize('destination');return;}
  const next=this.chooseNextNode();if(!next){this.finalize('no-route');return;}
  const hours=(CAMP_TERRAINS[next.terrain]?.hours??6)*(this.state.supplies.compass ? .6 : 1)*(this.rainForNextCrossing?1.5:1);
  const knownHours=this.state.dayHoursRemaining+Math.min(this.state.supplies.food,CAMP_MAX_DAYS-this.state.day)*this.state.dayHours;
  if(hours>knownHours+EPS&&!this.state.supplies.survival_kit){this.finalize('supplies');return;}
  this.rainForNextCrossing=false;Object.assign(this.state,{nextNodeId:next.id,crossingHours:hours,crossingHoursElapsed:0,travelProgress:0,waitingForNight:hours>knownHours+EPS});
 }
 medical(reason){
  const s=this.state;if(!s.supplies.medical_kit||!(s.maxHp>0)||!(s.hp>0)||s.hp>s.maxHp*.5)return false;
  const amount=Math.min(s.maxHp-s.hp,s.maxHp*.3);if(amount<=0)return false;s.hp+=amount;this.emit('heal',{amount,hp:s.hp,maxHp:s.maxHp,reason});return true;
 }
 consume(id,amount=1){if(amount<=0)return;const used=Math.min(this.state.supplies[id]||0,amount);if(used<=0)return;this.state.supplies[id]-=used;this.emit('supply',{supplyId:id,amount:used,remaining:this.state.supplies[id]});}
 arrive(){
  const s=this.state,node=this.nodeIndex.get(s.nextNodeId);if(!node){this.finalize('no-route');return;}
  if(!canTraverseCampNode(node,s.supplies)){this.finalize('supplies');return;}
  const newlyDiscovered=!this.visited.has(node.id);
  for(const [id,amount]of Object.entries(campTraversalConsumption(node)))this.consume(id,amount);
  s.nodeId=node.id;s.nextNodeId=null;s.crossingHours=0;s.crossingHoursElapsed=0;s.travelProgress=0;s.distance++;this.visited.add(node.id);this.route.push(node.id);this.emit('arrive',{terrain:node.terrain,newlyDiscovered});
  // Separate draws allow a weather/wildlife event and a battle at one vertex.
  if(this.random()<.3){
   if(this.random()<.5){this.rainForNextCrossing=true;this.emit('weather',{kind:'rain',multiplier:1.5});this.medical('rain');}
   else{const used=s.supplies.food>0?1:0;this.consume('food',used);this.emit('wildlife',{consumedFood:used});this.medical('wildlife');}
  }
  if(this.destination.nodeId===node.id){this.finalize('destination');return;}
  if(this.random()<.5){s.phase='encounter';this.emit('encounter',{playerLevel:s.playerLevel,levelRange:{min:Math.max(1,s.playerLevel-8),max:Math.max(1,s.playerLevel-2)}});return;}
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
  Object.assign(this.state,{phase:'final',finalReason:reason,nextNodeId:null,travelProgress:0,crossingHours:0,crossingHoursElapsed:0,waitingForNight:false});this.emit('final',{destination:this.state.destination,reason});return true;
 }
 finish(result='completed'){if(this.state.phase==='finished')return false;this.state.phase='finished';this.state.finalReason=result;this.emit('finish',{result});return true;}
 abort(reason='cancelled'){return this.finish(reason);}
}
