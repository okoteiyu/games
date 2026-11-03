/** A deterministic prototype world; its art coordinates do not consume gameplay RNG. */
const COLS=25,ROWS=28,SPACING=140;
const terrainIds=['normal','rough','cliff','gas'];
export const CAMP_TERRAINS=Object.freeze({
 normal:Object.freeze({id:'normal',name:'通常エリア',label:'通常',hours:6,color:'#79ad8a'}),
 rough:Object.freeze({id:'rough',name:'悪路エリア',label:'悪路',hours:6,color:'#b99857'}),
 cliff:Object.freeze({id:'cliff',name:'崖の険しいエリア',label:'崖',hours:8,color:'#9289b6'}),
 gas:Object.freeze({id:'gas',name:'毒ガスエリア',label:'毒ガス',hours:8,color:'#bc83a5'})
});
const idAt=(row,col)=>'wild-'+String(row*COLS+col).padStart(3,'0');
const hash=(a,b)=>{let n=Math.imul(a+41,374761393)^Math.imul(b+73,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
function buildWorld(){
 const nodes=[],edges=[],startId=idAt(ROWS-1,Math.floor(COLS/2));
 for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
  const group=Math.floor(col/3),terrain=terrainIds[(row*3+group)%terrainIds.length],zone=(row*9+group)%23;
  nodes.push({id:idAt(row,col),x:col*SPACING+42+(hash(row,col)-.5)*34,y:row*SPACING+42+(hash(col+87,row)-.5)*34,terrain,depth:-1,neighbors:[],cave:zone===5,poorVisibility:zone===12});
 }
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const connect=(a,b)=>{byId.get(a).neighbors.push(b);byId.get(b).neighbors.push(a);edges.push([a,b]);};
 for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
  if(col+1<COLS)connect(idAt(row,col),idAt(row,col+1));
  if(row+1<ROWS)connect(idAt(row,col),idAt(row+1,col));
 }
 // A small ordinary approach lets an expedition enter the wilderness without
 // requiring every specialist supply on its first move.
 for(const [row,col]of [[27,12],[27,11],[27,10],[26,12],[25,12],[26,11]]){
  Object.assign(byId.get(idAt(row,col)),{terrain:'normal',cave:false,poorVisibility:false});
 }
 byId.get(startId).depth=0;const queue=[startId];
 for(let i=0;i<queue.length;i++)for(const nextId of byId.get(queue[i]).neighbors){const next=byId.get(nextId);if(next.depth>=0)continue;next.depth=byId.get(queue[i]).depth+1;queue.push(nextId);}
 // Locate the first named destination near eighty ordinary activity-hours away.
 // This value describes the prototype map, not a guaranteed selected route.
 const costs=new Map([[startId,0]]),unsettled=new Set(nodes.map(n=>n.id));
 while(unsettled.size){let current=null,best=Infinity;for(const id of unsettled){const v=costs.get(id)??Infinity;if(v<best){best=v;current=id;}}if(current===null)break;unsettled.delete(current);
  for(const id of byId.get(current).neighbors){if(!unsettled.has(id))continue;const next=byId.get(id),v=best+CAMP_TERRAINS[next.terrain].hours;if(v<(costs.get(id)??Infinity))costs.set(id,v);}
 }
 const goal=nodes.filter(n=>n.id!==startId&&n.depth>=10&&n.depth<=15&&n.terrain==='normal'&&!n.cave&&!n.poorVisibility).sort((a,b)=>Math.abs(costs.get(a.id)-80)-Math.abs(costs.get(b.id)-80)||Math.abs(a.x-byId.get(startId).x)-Math.abs(b.x-byId.get(startId).x)||a.id.localeCompare(b.id))[0];
 goal.locationId='moai_village';goal.name='モアイ郷';
 const bounds={minX:-40,minY:-40,maxX:(COLS-1)*SPACING+130,maxY:(ROWS-1)*SPACING+130};
 return Object.freeze({id:'camp-world-01',schemaVersion:1,temporary:true,startId,origin:startId,nodes:Object.freeze(nodes.map(n=>Object.freeze({...n,neighbors:Object.freeze(n.neighbors)}))),edges:Object.freeze(edges.map(e=>Object.freeze(e))),bounds:Object.freeze(bounds),maxDegree:4,patrolAttachment:Object.freeze({x:byId.get(startId).x,y:bounds.maxY+330,width:730,height:480,name:'おこていゆハウス周辺',region:'forest'}),moaiVillageId:goal.id,moaiVillageBaseHours:costs.get(goal.id)});
}
export const CAMP_WORLD=buildWorld();
const nodeIndex=new Map(CAMP_WORLD.nodes.map(node=>[node.id,node]));
export function getCampNode(id){return nodeIndex.get(id)||null;}
export const CAMP_DESTINATIONS=Object.freeze({
 none:Object.freeze({id:'none',name:'なし',nodeId:null,description:'行けるところまで、未開の地を探索する。'}),
 moai_village:Object.freeze({id:'moai_village',name:'モアイ郷',nodeId:CAMP_WORLD.moaiVillageId,baseHours:CAMP_WORLD.moaiVillageBaseHours,description:'モアイたちの気配をたどる、森の奥の集落。'})
});
/** Distances are graph distances, independent from the map's drawing scale. */
export function campDistancesFrom(origin){
 if(!nodeIndex.has(origin))throw new RangeError('キャンプの地点が見つかりません。');
 const distances=new Map([[origin,0]]),queue=[origin];
 for(let i=0;i<queue.length;i++)for(const next of nodeIndex.get(queue[i]).neighbors)if(!distances.has(next)){distances.set(next,distances.get(queue[i])+1);queue.push(next);}
 return distances;
}
