import {CAMP_WORLD,CAMP_TERRAINS} from './camp-world.js';
import {CAMP_MAX_DAYS,CAMP_SUPPLIES,CAMP_DURABLE_TOOL_IDS,canTraverseCampNode,campTraversalConsumption} from './camp-rules.js';

const EPS=1e-9,CACHE_LIMIT=64,graphs=new WeakMap(),plans=new WeakMap();
const toolIds=CAMP_DURABLE_TOOL_IDS,consumables=['food',...toolIds];
const fixedTools=['flashlight','compass'];
const copiesForUses=(id,uses)=>Math.ceil(uses/(CAMP_SUPPLIES[id].maxUses??1));
// A previously opened two-use item is already charged to this expedition.
// Replanning can use its remaining charge without counting that item twice.
const additionalCopies=(id,uses,previous)=>copiesForUses(id,previous+uses)-copiesForUses(id,previous);

class MinHeap{
 constructor(compare){this.values=[];this.compare=compare;}
 push(value){const a=this.values;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(this.compare(a[p],value)<=0)break;a[i]=a[p];i=p;}a[i]=value;}
 pop(){const a=this.values;if(!a.length)return null;const first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&this.compare(a[child+1],a[child])<0)child++;if(this.compare(last,a[child])<=0)break;a[i]=a[child];i=child;}a[i]=last;}return first;}
 get length(){return this.values.length;}
}

function graphFor(world){
 if(graphs.has(world))return graphs.get(world);
 const nodes=world.nodes,index=new Map(nodes.map((node,i)=>[node.id,i]));
 if(index.size!==nodes.length)throw new TypeError('キャンプの地点が正しくありません。');
 const neighbors=nodes.map(node=>{if(!CAMP_TERRAINS[node.terrain]||!Array.isArray(node.neighbors))throw new TypeError('キャンプの地点が正しくありません。');return node.neighbors.map(id=>{if(!index.has(id))throw new TypeError('キャンプの道が正しくありません。');return index.get(id);});});
 const graph={nodes,index,neighbors,goalDistances:new Map()};graphs.set(world,graph);return graph;
}
function distancesToGoal(graph,goal){
 if(graph.goalDistances.has(goal))return graph.goalDistances.get(goal);
 const distances=new Int32Array(graph.nodes.length).fill(-1),queue=[goal];distances[goal]=0;
 for(let i=0;i<queue.length;i++)for(const next of graph.neighbors[queue[i]])if(distances[next]<0){distances[next]=distances[queue[i]]+1;queue.push(next);}
 while(graph.goalDistances.size>=CACHE_LIMIT)graph.goalDistances.delete(graph.goalDistances.keys().next().value);
 graph.goalDistances.set(goal,distances);return distances;
}

function normalize(options){
 const world=options.world??CAMP_WORLD,startId=options.startId??world.startId,currentNodeId=options.currentNodeId??startId,goalId=options.goalId??world.moaiVillageId;
 if(!world||!Array.isArray(world.nodes)||!world.nodes.length||typeof startId!=='string'||typeof currentNodeId!=='string'||typeof goalId!=='string')throw new TypeError('コンパスの地図が正しくありません。');
 const graph=graphFor(world);if(!graph.index.has(startId)||!graph.index.has(currentNodeId)||!graph.index.has(goalId))throw new TypeError('コンパスの地点が見つかりません。');
 const counts=Object.fromEntries([...consumables,...fixedTools].map(id=>{const value=options.counts?.[id]??0;if(!Number.isSafeInteger(value)||value<0)throw new TypeError('コンパスの物資が正しくありません。');return [id,value];}));
 const usedToolUses=Object.fromEntries(toolIds.map(id=>{const value=options.usedToolUses?.[id]??0;if(!Number.isSafeInteger(value)||value<0)throw new TypeError('コンパスの道具使用記録が正しくありません。');return [id,value];}));
 const day=options.day??1,dayHours=options.dayHours??(counts.flashlight?16:14),dayHoursRemaining=options.dayHoursRemaining??dayHours;
 if(!Number.isInteger(day)||day<1||day>CAMP_MAX_DAYS||!Number.isFinite(dayHours)||dayHours<=0||!Number.isFinite(dayHoursRemaining)||dayHoursRemaining<0||dayHoursRemaining>dayHours+EPS)throw new TypeError('コンパスの活動時間が正しくありません。');
 const activePath=Array.from(options.activePath??[currentNodeId]);
 if(!activePath.length||activePath.at(-1)!==currentNodeId||new Set(activePath).size!==activePath.length||activePath.some(id=>!graph.index.has(id)))throw new TypeError('コンパスの帰り道が正しくありません。');
 for(let i=1;i<activePath.length;i++)if(!graph.neighbors[graph.index.get(activePath[i-1])].includes(graph.index.get(activePath[i])))throw new TypeError('コンパスの帰り道がつながっていません。');
 const tripReached=new Set(options.tripReached??activePath);for(const id of activePath)tripReached.add(id);tripReached.add(startId);
 if([...tripReached].some(id=>!graph.index.has(id)))throw new TypeError('コンパスの探索記録が正しくありません。');
 const rainNext=options.rainNext===true,maxHours=dayHoursRemaining+Math.min(counts.food,CAMP_MAX_DAYS-day)*dayHours;
 return {world,startId,currentNodeId,goalId,counts,usedToolUses,day,dayHours,dayHoursRemaining,activePath,tripReached,rainNext,maxHours,graph};
}

function freezeResult(value){Object.freeze(value.path);Object.freeze(value.consumption);Object.freeze(value.diagnostics);return Object.freeze(value);}
function result(o,status){return {status,startId:o.startId,currentNodeId:o.currentNodeId,goalId:o.goalId,nextNodeId:null,movementMode:null,path:status==='reached'?[o.currentNodeId]:[],requiredItems:status==='reached'?0:null,explorationCost:status==='reached'?0:null,activityHours:status==='reached'?0:null,consumption:{food:0,...Object.fromEntries(toolIds.map(id=>[id,0]))},diagnostics:{labelsCreated:0,labelsExpanded:0,routeMode:'optimal'}};}

/** Counts for durable tools are remaining uses, not physical copies. Minimize
 * consumed exploration copies plus food, then time, across the entire graph.
 * Unknown map nodes remain in the graph. Nonconsumed support tools are free
 * in the objective, but still gate passage and modify actual activity time. */
function calculate(o){
 if(o.currentNodeId===o.goalId||o.tripReached.has(o.goalId))return freezeResult(result(o,'reached'));
 const output=result(o,'unreachable'),{nodes,index,neighbors}=o.graph,current=index.get(o.currentNodeId),goal=index.get(o.goalId),factor=o.counts.compass?.6:1,goalDistances=distancesToGoal(o.graph,goal);
 if(goalDistances[current]<0)return freezeResult(output);
 const crossing=(node,first)=>CAMP_TERRAINS[node.terrain].hours*factor*(first&&o.rainNext?1.5:1);
 const foodFor=hours=>Math.max(0,Math.ceil((hours-o.dayHoursRemaining-EPS)/o.dayHours));
 const usedItems=label=>toolIds.reduce((sum,id)=>sum+additionalCopies(id,label[id],o.usedToolUses[id]),0);
 const returnParents=new Map(o.activePath.slice(1).map((id,i)=>[index.get(id),index.get(o.activePath[i])]));
 const isReturn=(from,next)=>returnParents.get(from)===next;
 const available=(label,from,next)=>{const counts={...o.counts,...Object.fromEntries(toolIds.map(id=>[id,o.counts[id]-label[id]]))};if(isReturn(from,next))for(const id of toolIds)counts[id]=Math.max(1,counts[id]);return counts;};
 const fits=label=>label.hours<=o.maxHours+EPS&&toolIds.every(id=>label[id]<=o.counts[id]);
 const spend=(label,next)=>{if(!canTraverseCampNode(nodes[next],available(label,label.node,next)))return null;const consumed=isReturn(label.node,next)?{}:campTraversalConsumption(nodes[next]),candidate={node:next,hours:label.hours+crossing(nodes[next],label.steps===0),...Object.fromEntries(toolIds.map(id=>[id,label[id]+(consumed[id]??0)])),steps:label.steps+1,parent:label};return fits(candidate)?candidate:null;};

 const initial={node:current,hours:0,...Object.fromEntries(toolIds.map(id=>[id,0])),steps:0,parent:null};
 const forward=nodes.map(()=>[]),reverse=nodes.map(()=>[]);
 // Guidance optimizes consumption globally; a cheaper detour may temporarily
 // increase hop distance or revisit a reached vertex. Only actual reverse
 // ancestry edges reuse durable tools; entering it from another edge does not.
 for(let i=0;i<nodes.length;i++)if(goalDistances[i]>=0)for(const next of neighbors[i])if(goalDistances[next]>=0&&canTraverseCampNode(nodes[next],available(initial,i,next))){forward[i].push(next);reverse[next].push(i);}
 // A reverse time bound ignores consumption, but never overestimates the best
 // remaining time. It avoids exploring the far side of the entire world.
 const remaining=new Float64Array(nodes.length).fill(Infinity),timeHeap=new MinHeap((a,b)=>a.hours-b.hours);remaining[goal]=0;timeHeap.push({node:goal,hours:0});
 while(timeHeap.length){const a=timeHeap.pop();if(a.hours!==remaining[a.node])continue;for(const previous of reverse[a.node]){const hours=a.hours+CAMP_TERRAINS[nodes[a.node].terrain].hours*factor;if(hours<remaining[previous]){remaining[previous]=hours;timeHeap.push({node:previous,hours});}}}
 const frontier=nodes.map(()=>[]),heap=new MinHeap((a,b)=>a.boundItems-b.boundItems||a.boundHours-b.boundHours||a.sequence-b.sequence);let best=null,sequence=0;
 const dominates=(a,b)=>a.hours<=b.hours+EPS&&toolIds.every(id=>a[id]<=b[id]);
 function consider(label){
  const boundHours=label.hours+remaining[label.node],boundItems=usedItems(label)+foodFor(boundHours);
  if(!Number.isFinite(boundHours)||boundHours>o.maxHours+EPS||best&&(boundItems>best.requiredItems||boundItems===best.requiredItems&&boundHours>best.activityHours+EPS))return;
  const labels=frontier[label.node];if(labels.some(a=>dominates(a,label)))return;
  frontier[label.node]=labels.filter(a=>{if(dominates(label,a)){a.active=false;return false;}return true;});
  Object.assign(label,{boundHours,boundItems,sequence:sequence++,active:true});frontier[label.node].push(label);heap.push(label);output.diagnostics.labelsCreated++;
 }
 consider(initial);
 while(heap.length){
  const label=heap.pop();if(!label.active)continue;
  if(best&&(label.boundItems>best.requiredItems||label.boundItems===best.requiredItems&&label.boundHours>best.activityHours+EPS))continue;
  output.diagnostics.labelsExpanded++;
  if(label.node===goal){
   const food=foodFor(label.hours),requiredItems=usedItems(label)+food;
   if(!best||requiredItems<best.requiredItems||requiredItems===best.requiredItems&&label.hours<best.activityHours-EPS){
    const path=[];for(let previous=label;previous;previous=previous.parent)path.push(nodes[previous.node].id);path.reverse();
    best={...output,status:'ready',path,nextNodeId:path[1],movementMode:isReturn(current,index.get(path[1]))?'backtrack':'forward',requiredItems,explorationCost:requiredItems,activityHours:label.hours,consumption:{food,...Object.fromEntries(toolIds.map(id=>[id,label[id]]))}};
   }
  }else for(const next of forward[label.node]){const candidate=spend(label,next);if(candidate)consider(candidate);}
 }
 if(best)best.diagnostics=output.diagnostics;return freezeResult(best??output);
}

/** Pure navigation: the chosen target/end-of-exploration rules stay in engine. */
export function planCampNavigation(options={}){
 const o=normalize(options);let cache=plans.get(o.world);if(!cache){cache=new Map();plans.set(o.world,cache);}
 const ruleKey=toolIds.map(id=>id+':'+(CAMP_SUPPLIES[id].maxUses??1)+':'+CAMP_SUPPLIES[id].width+'x'+CAMP_SUPPLIES[id].height+':'+CAMP_SUPPLIES[id].repeatable).join('|');
 const key=[o.world.revision??'',ruleKey,o.startId,o.currentNodeId,o.goalId,o.day,o.dayHours,o.dayHoursRemaining,o.rainNext?1:0,...consumables.map(id=>o.counts[id]),...toolIds.map(id=>o.usedToolUses[id]),...fixedTools.map(id=>o.counts[id]),o.activePath.join(','),[...o.tripReached].sort().join(',')].join(';');
 if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
 const value=calculate(o);while(cache.size>=CACHE_LIMIT)cache.delete(cache.keys().next().value);cache.set(key,value);return value;
}
