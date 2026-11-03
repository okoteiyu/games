import {CAMP_WORLD_POINTS,CAMP_WORLD_CONNECTIONS} from './camp-world-data.js';
import {CAMP_TERRAIN_IDS,CAMP_NODE_TERRAINS} from './camp-terrain-data.js';
import {CAMP_REGION_BOUNDS,getCampRegionAt} from './camp-regions.js';
/** Authored wilderness geometry is stable and never consumes the game's RNG. */
export const CAMP_TERRAINS=Object.freeze({
 normal:Object.freeze({id:'normal',name:'通常エリア',label:'通常',hours:6,color:'#79ad8a'}),
 rough:Object.freeze({id:'rough',name:'悪路エリア',label:'悪路',hours:6,color:'#b99857'}),
 cliff:Object.freeze({id:'cliff',name:'崖の険しいエリア',label:'崖',hours:8,color:'#9289b6'}),
 gas:Object.freeze({id:'gas',name:'毒ガスエリア',label:'毒ガス',hours:8,color:'#bc83a5'}),
 cave:Object.freeze({id:'cave',name:'洞窟エリア',label:'洞窟',hours:6,color:'#807363'}),
 poor_visibility:Object.freeze({id:'poor_visibility',name:'見通しの悪いエリア',label:'見通し不良',hours:6,color:'#9aa6ad'})
});
const nodeId=index=>'wild-'+String(index).padStart(3,'0');
function buildWorld(){
 const startId='wild-687',goalId='wild-413';
 const nodes=CAMP_WORLD_POINTS.map(([x,y],index)=>{const terrain=CAMP_TERRAIN_IDS[CAMP_NODE_TERRAINS[index]];return {id:nodeId(index),x,y,terrain,regionId:getCampRegionAt(x,y).id,depth:-1,neighbors:[],cave:terrain==='cave',poorVisibility:terrain==='poor_visibility'};});
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const edges=CAMP_WORLD_CONNECTIONS.map(([a,b])=>{nodes[a].neighbors.push(nodes[b].id);nodes[b].neighbors.push(nodes[a].id);return Object.freeze([nodes[a].id,nodes[b].id]);});
 // A future starting point can have its own reachable component. Missing depths
 // stay -1 rather than inventing a route through currently disconnected land.
 byId.get(startId).depth=0;const queue=[startId];
 for(let i=0;i<queue.length;i++)for(const nextId of byId.get(queue[i]).neighbors){const next=byId.get(nextId);if(next.depth>=0)continue;next.depth=byId.get(queue[i]).depth+1;queue.push(nextId);}
 Object.assign(byId.get(goalId),{locationId:'moai_village',name:'モアイ郷'});
 return Object.freeze({id:'camp-world-01',schemaVersion:1,revision:'R225',temporary:true,startId,origin:startId,nodes:Object.freeze(nodes.map(node=>Object.freeze({...node,neighbors:Object.freeze(node.neighbors)}))),edges:Object.freeze(edges),bounds:CAMP_REGION_BOUNDS,maxDegree:6,patrolAttachment:Object.freeze({x:byId.get(startId).x,y:byId.get(startId).y+330,width:730,height:480,name:'おこていゆハウス周辺',region:'forest'}),moaiVillageId:goalId,moaiVillageBaseHours:80});
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
