import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS} from './camp-world.js';
import {BAG_WIDTH,BAG_HEIGHT,CAMP_MAX_DAYS,CAMP_SUPPLIES,canTraverseCampNode,campTraversalConsumption,validateCampBag} from './camp-rules.js';

const supplyIds=Object.keys(CAMP_SUPPLIES);
const consumedIds=['rope','mask','goggles'];
const caches=new WeakMap();
const emptyCounts=()=>Object.fromEntries(supplyIds.map(id=>[id,0]));
const area=id=>CAMP_SUPPLIES[id].width*CAMP_SUPPLIES[id].height;
const fits=(id,width,height)=>{const s=CAMP_SUPPLIES[id];return s.width<=width&&s.height<=height||s.height<=width&&s.width<=height;};

class MinHeap{
 constructor(compare){this.values=[];this.compare=compare;}
 push(value){const a=this.values;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(this.compare(a[p],value)<=0)break;a[i]=a[p];i=p;}a[i]=value;}
 pop(){const a=this.values;if(!a.length)return null;const first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&this.compare(a[child+1],a[child])<0)child++;if(this.compare(last,a[child])<=0)break;a[i]=a[child];i=child;}a[i]=last;}return first;}
 get length(){return this.values.length;}
}

function normalizedOptions(options={}){
 const world=options.world??CAMP_WORLD,startId=options.startId??world.startId,destination=options.destination??'none',destinations=options.destinations??CAMP_DESTINATIONS;
 const maxDays=options.maxDays??CAMP_MAX_DAYS,width=options.capacityWidth??BAG_WIDTH,height=options.capacityHeight??BAG_HEIGHT;
 if(!world||!Array.isArray(world.nodes)||!world.nodes.length||typeof startId!=='string')throw new TypeError('キャンプの地図が正しくありません。');
 if(typeof destination!=='string'||!Object.hasOwn(destinations,destination))throw new RangeError('キャンプの目的地が見つかりません。');
 if(!Number.isInteger(maxDays)||maxDays<1||maxDays>CAMP_MAX_DAYS||!Number.isInteger(width)||width<1||width>BAG_WIDTH||!Number.isInteger(height)||height<1||height>BAG_HEIGHT)throw new RangeError('キャンプの物資容量が正しくありません。');
 return {world,startId,destination,destinations,maxDays,width,height,capacity:width*height};
}
function freezePlan(value){
 Object.freeze(value.counts);Object.freeze(value.path);for(const p of value.placements)Object.freeze(p);Object.freeze(value.placements);if(value.diagnostics)Object.freeze(value.diagnostics);return Object.freeze(value);
}
function baseResult(o,status){return {status,startId:o.startId,destination:o.destination,destinationNodeId:o.destinations[o.destination].nodeId??null,counts:emptyCounts(),totalItems:0,occupiedCells:0,activityHours:null,days:0,placements:[],path:[]};}

/** Verify the physical rectangles as well as their total area. No bag is filled. */
function packCounts(counts,width,height){
 const pieces=[];let used=0;
 for(const id of supplyIds)for(let i=0;i<counts[id];i++){
  const s=CAMP_SUPPLIES[id],short=Math.min(s.width,s.height),long=Math.max(s.width,s.height);used+=short*long;pieces.push({id,short,long});
 }
 if(used>width*height)return null;
 pieces.sort((a,b)=>b.short*b.long-a.short*a.long||b.long-a.long||a.id.localeCompare(b.id));
 const placements=[],failed=new Set();
 function search(index,occupied,previousCode){
  if(index===pieces.length)return true;
  const piece=pieces[index],same=index>0&&piece.short===pieces[index-1].short&&piece.long===pieces[index-1].long,start=same?previousCode+1:0,key=index+':'+occupied.toString(16)+':'+start;
  if(failed.has(key))return false;
  const orientations=piece.short===piece.long?[[piece.short,piece.long]]:[[piece.short,piece.long],[piece.long,piece.short]];
  for(let cell=0;cell<width*height;cell++)for(let orientation=0;orientation<orientations.length;orientation++){
   const code=cell*2+orientation;if(code<start)continue;
   const [w,h]=orientations[orientation],x=cell%width,y=Math.floor(cell/width);if(x+w>width||y+h>height)continue;
   let mask=0n;for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)mask|=1n<<BigInt(row*width+col);
   if(mask&occupied)continue;
   const original=CAMP_SUPPLIES[piece.id];placements.push({id:'camp-plan-'+index,supplyId:piece.id,x,y,rotated:w!==original.width||h!==original.height});
   if(search(index+1,occupied|mask,code))return true;placements.pop();
  }
  failed.add(key);return false;
 }
 return search(0,0n,-1)?validateCampBag(placements):null;
}

const dominates=(a,b)=>a.units<=b.units&&a.rope<=b.rope&&a.mask<=b.mask&&a.goggles<=b.goggles;
const comparePlan=(a,b)=>a.totalItems-b.totalItems||a.activityHours-b.activityHours||a.occupiedCells-b.occupiedCells||a.days-b.days;

/** Exact positive-cost label search; each yield is an opportunity for UI work.
 * Random events and automatic branch choices are deliberately not simulated. */
function* calculate(options){
 const o=normalizedOptions(options),result=baseResult(o,o.destinations[o.destination].nodeId?'unreachable':'none');
 if(result.status==='none')return freezePlan(result);
 const nodes=o.world.nodes,index=new Map(),neighbors=[],depths=new Int32Array(nodes.length).fill(-1),hours=[];
 let work=0;
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];if(!n||typeof n.id!=='string'||index.has(n.id)||!Array.isArray(n.neighbors)||!CAMP_TERRAINS[n.terrain])throw new TypeError('キャンプの地点が正しくありません。');
  index.set(n.id,i);hours.push(CAMP_TERRAINS[n.terrain].hours);if(++work%256===0)yield;
 }
 const start=index.get(o.startId),goal=index.get(result.destinationNodeId);
 if(start===undefined||goal===undefined)throw new RangeError('キャンプの始点または目的地が見つかりません。');
 for(let i=0;i<nodes.length;i++){
  neighbors[i]=nodes[i].neighbors.map(id=>{const j=index.get(id);if(j===undefined)throw new TypeError('キャンプの道が正しくありません。');return j;});if(++work%256===0)yield;
 }
 depths[start]=0;const queue=[start];for(let i=0;i<queue.length;i++){for(const j of neighbors[queue[i]])if(depths[j]<0){depths[j]=depths[queue[i]]+1;queue.push(j);}if(++work%256===0)yield;}
 if(depths[goal]<0||!fits('food',o.width,o.height))return freezePlan(result);
 let best=null,created=0,expanded=0,configurations=0;
 const packingCache=new Map();
 for(const flashlight of [0,1])for(const gloves of [0,1])for(const compass of [1,0]){
  if(flashlight&&!fits('flashlight',o.width,o.height)||gloves&&!fits('gloves',o.width,o.height)||compass&&!fits('compass',o.width,o.height))continue;
  configurations++;
  const fixedItems=flashlight+gloves+compass,fixedCells=flashlight*area('flashlight')+gloves*area('gloves')+compass*area('compass'),dayUnits=(flashlight?16:14)*5,unitFactor=compass?3:5;
  const available={flashlight,gloves,rope:fits('rope',o.width,o.height)?o.capacity:0,mask:fits('mask',o.width,o.height)?o.capacity:0,goggles:fits('goggles',o.width,o.height)?o.capacity:0};
  const allowed=nodes.map((n,i)=>i===start||canTraverseCampNode(n,available)),forward=nodes.map(()=>[]),reverse=nodes.map(()=>[]);
  if(!allowed[goal])continue;
  for(let i=0;i<nodes.length;i++){
   if(allowed[i]&&depths[i]>=0&&depths[i]<=depths[goal])for(const j of neighbors[i])if(j!==start&&allowed[j]&&(depths[j]===depths[i]||depths[j]===depths[i]+1)&&depths[j]<=depths[goal]){forward[i].push(j);reverse[j].push(i);}
   if(++work%256===0)yield;
  }
  // A reverse shortest-time bound keeps distant side branches out of the search.
  const remaining=new Float64Array(nodes.length).fill(Infinity),timeHeap=new MinHeap((a,b)=>a.time-b.time);remaining[goal]=0;timeHeap.push({node:goal,time:0});
  while(timeHeap.length){const a=timeHeap.pop();if(a.time!==remaining[a.node])continue;for(const j of reverse[a.node]){const time=a.time+hours[a.node];if(time<remaining[j]){remaining[j]=time;timeHeap.push({node:j,time});}}if(++work%256===0)yield;}
  if(!Number.isFinite(remaining[start])||remaining[start]*unitFactor>o.maxDays*dayUnits)continue;
  const frontier=nodes.map(()=>[]),heap=new MinHeap((a,b)=>a.boundItems-b.boundItems||a.boundUnits-b.boundUnits||a.cells-b.cells);
  function consider(label){
   const boundUnits=label.units+remaining[label.node]*unitFactor,food=Math.max(1,Math.ceil(boundUnits/dayUnits));
   label.boundUnits=boundUnits;label.boundItems=fixedItems+label.rope+label.mask+label.goggles+food;
   label.cells=label.rope*area('rope')+label.mask*area('mask')+label.goggles*area('goggles');
   if(!Number.isFinite(boundUnits)||food>o.maxDays||fixedCells+label.cells+food*area('food')>o.capacity||best&&(label.boundItems>best.totalItems||label.boundItems===best.totalItems&&boundUnits/5>best.activityHours))return;
   const current=frontier[label.node];if(current.some(a=>dominates(a,label)))return;
   frontier[label.node]=current.filter(a=>{if(dominates(label,a)){a.active=false;return false;}return true;});label.active=true;frontier[label.node].push(label);heap.push(label);created++;
  }
  consider({node:start,units:0,rope:0,mask:0,goggles:0,parent:null});
  while(heap.length){
   const label=heap.pop();if(!label.active)continue;
   if(best&&(label.boundItems>best.totalItems||label.boundItems===best.totalItems&&label.boundUnits/5>best.activityHours))continue;
   expanded++;
   if(label.node===goal){
    const counts=emptyCounts(),food=Math.max(1,Math.ceil(label.units/dayUnits));Object.assign(counts,{food,flashlight,gloves,compass,rope:label.rope,mask:label.mask,goggles:label.goggles});
    const totalItems=Object.values(counts).reduce((sum,n)=>sum+n,0),occupiedCells=supplyIds.reduce((sum,id)=>sum+counts[id]*area(id),0),candidate={...result,status:'ready',counts,totalItems,occupiedCells,activityHours:label.units/5,days:food,placements:[],path:[]};
    if(!best||comparePlan(candidate,best)<0){
     const key=supplyIds.map(id=>counts[id]).join(','),cached=packingCache.get(key),placements=cached===undefined?packCounts(counts,o.width,o.height):cached;packingCache.set(key,placements);
     if(placements){candidate.placements=placements;for(let a=label;a;a=a.parent)candidate.path.push(nodes[a.node].id);candidate.path.reverse();best=candidate;}
    }
   }else for(const j of forward[label.node]){
    const consumption=campTraversalConsumption(nodes[j]);consider({node:j,units:label.units+hours[j]*unitFactor,rope:label.rope+consumption.rope,mask:label.mask+consumption.mask,goggles:label.goggles+consumption.goggles,parent:label});
   }
   if(++work%128===0)yield;
  }
 }
 const answer=best??result;answer.diagnostics={configurations,labelsCreated:created,labelsExpanded:expanded};return freezePlan(answer);
}

/** Minimum total number of items first, then minimum activity hours. */
export function planCampDestination(options={}){const iterator=calculate(options);let step;do{step=iterator.next();}while(!step.done);return step.value;}

function cacheEntry(options){
 const o=normalizedOptions(options);let cache=caches.get(o.world);if(!cache){cache=new Map();caches.set(o.world,cache);}
 const ruleKey=Object.values(CAMP_TERRAINS).map(t=>t.id+':'+t.hours).join('|')+';'+supplyIds.map(id=>id+':'+CAMP_SUPPLIES[id].width+'x'+CAMP_SUPPLIES[id].height).join('|');
 const key=[o.world.revision??'',o.startId,o.destination,o.destinations[o.destination].nodeId??'',o.maxDays,o.width,o.height,ruleKey].join(';');
 if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry;}
 while(cache.size>=64)cache.delete(cache.keys().next().value);
 const destinations=Object.freeze({[o.destination]:Object.freeze({nodeId:o.destinations[o.destination].nodeId??null})});
 const snapshot=Object.freeze({world:o.world,startId:o.startId,destination:o.destination,destinations,maxDays:o.maxDays,capacityWidth:o.width,capacityHeight:o.height});
 const entry={options:snapshot,value:null,promise:null};cache.set(key,entry);return entry;
}
export function getCachedCampDestinationPlan(options={}){const entry=cacheEntry(options);return entry.value??(entry.value=planCampDestination(entry.options));}

/** Shared incremental work; opening a menu never runs the search every frame. */
export function requestCampDestinationPlan(options={}){
 const entry=cacheEntry(options);if(entry.value)return Promise.resolve(entry.value);if(entry.promise)return entry.promise;
 const iterator=calculate(entry.options);
 entry.promise=new Promise((resolve,reject)=>{
  const run=()=>{try{if(entry.value){resolve(entry.value);return;}const clock=()=>globalThis.performance?.now?.()??Date.now(),deadline=clock()+6;let step;do{step=iterator.next();if(step.done){entry.value=step.value;resolve(step.value);return;}}while(clock()<deadline);setTimeout(run,0);}catch(error){entry.promise=null;reject(error);}};
  setTimeout(run,0);
 });return entry.promise;
}
