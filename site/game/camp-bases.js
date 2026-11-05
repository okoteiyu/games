import {CAMP_WORLD,getCampNode,getCampDestinationAt} from './camp-world.js';

export const CAMP_BASE_LIMIT=15;
export const CAMP_FOUNDATION_BASE=Object.freeze({
 id:'house',nodeId:CAMP_WORLD.startId,name:'おこていゆハウス',foundation:true,
 hutCount:0,rookieCount:0,layoutSeed:0
});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const copy=value=>JSON.parse(JSON.stringify(value));
const edgeKey=(a,b)=>[a,b].sort().join('\u0000');
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,96}$/.test(value);

/** Missing fields are the migration path for every pre-base camp save. */
export function normalizeCampBaseProgress(value={}){
 if(!plain(value))throw new TypeError('キャンプ拠点の記録が正しくありません。');
 const source=value.bases??[],network=value.baseNetwork??[];
 if(!Array.isArray(source)||source.length>CAMP_BASE_LIMIT)throw new RangeError('設営できるキャンプ拠点は15箇所までです。');
 if(!Array.isArray(network)||network.length!==source.length)throw new TypeError('拠点ネットワークの記録が正しくありません。');
 const ids=new Set([CAMP_FOUNDATION_BASE.id]),nodes=new Set([CAMP_FOUNDATION_BASE.nodeId]);
 const bases=Array.from(source).map(base=>{
  if(!plain(base)||!validId(base.id)||ids.has(base.id))throw new TypeError('キャンプ拠点の識別子が正しくありません。');
  const node=getCampNode(base.nodeId);
  if(!node||nodes.has(node.id)||node.terrain!=='normal'||getCampDestinationAt(node.id))throw new TypeError('キャンプ拠点の場所が正しくありません。');
  if(base.id!=='base-'+node.id)throw new TypeError('キャンプ拠点の識別子と場所が一致しません。');
  if(typeof base.name!=='string'||!base.name.trim()||base.name.length>64||/[\u0000-\u001f\u007f]/.test(base.name))throw new TypeError('キャンプ拠点の名前が正しくありません。');
  if(!Number.isInteger(base.hutCount)||base.hutCount<5||base.hutCount>10||!Number.isInteger(base.rookieCount)||base.rookieCount<3||base.rookieCount>5||!Number.isSafeInteger(base.layoutSeed)||base.layoutSeed<0||base.layoutSeed>0xffffffff)throw new TypeError('キャンプ拠点の配置が正しくありません。');
  if(base.foundation!==undefined&&base.foundation!==false)throw new TypeError('キャンプ基礎拠点の記録は変更できません。');
  ids.add(base.id);nodes.add(node.id);
  return {id:base.id,nodeId:node.id,name:base.name,foundation:false,hutCount:base.hutCount,rookieCount:base.rookieCount,layoutSeed:base.layoutSeed};
 });
 const links=new Set(),neighbors=new Map([...ids].map(id=>[id,[]]));
 const baseNetwork=Array.from(network).map(edge=>{
  if(!plain(edge)||!ids.has(edge.fromId)||!ids.has(edge.toId)||edge.fromId===edge.toId)throw new TypeError('拠点ネットワークの接続先が正しくありません。');
  const key=edgeKey(edge.fromId,edge.toId);if(links.has(key))throw new TypeError('拠点ネットワークが重複しています。');links.add(key);
  neighbors.get(edge.fromId).push(edge.toId);neighbors.get(edge.toId).push(edge.fromId);
  return {fromId:edge.fromId,toId:edge.toId};
 });
 const reached=new Set([CAMP_FOUNDATION_BASE.id]),queue=[CAMP_FOUNDATION_BASE.id];
 for(let index=0;index<queue.length;index++)for(const id of neighbors.get(queue[index]))if(!reached.has(id)){reached.add(id);queue.push(id);}
 // One new base creates exactly one edge to its departure base: the network
 // is connected and acyclic. Rejecting orphans also prevents phantom bases.
 if(reached.size!==ids.size)throw new TypeError('キャンプ基礎拠点に繋がっていない拠点があります。');
 const currentBaseId=value.currentBaseId??CAMP_FOUNDATION_BASE.id;
 if(!ids.has(currentBaseId))throw new TypeError('現在のキャンプ拠点が見つかりません。');
 return {bases,baseNetwork,currentBaseId};
}

/** Frontiers are derived, never trusted as a flag in imported data. */
export function listCampBases(progress={}){
 const state=normalizeCampBaseProgress(progress),degrees=new Map([[CAMP_FOUNDATION_BASE.id,0],...state.bases.map(base=>[base.id,0])]);
 for(const edge of state.baseNetwork){degrees.set(edge.fromId,degrees.get(edge.fromId)+1);degrees.set(edge.toId,degrees.get(edge.toId)+1);}
 return [CAMP_FOUNDATION_BASE,...state.bases].map(base=>({...base,networkDegree:degrees.get(base.id),frontier:!base.foundation&&degrees.get(base.id)===1}));
}
export function getCampBase(progress,id){return listCampBases(progress).find(base=>base.id===id)||null;}
export function getCampBaseAt(progress,nodeId){return listCampBases(progress).find(base=>base.nodeId===nodeId)||null;}

export function campBaseEstablishmentIssue(progress,nodeId){
 const state=normalizeCampBaseProgress(progress),node=getCampNode(nodeId);
 if(!node)return 'unknown-vertex';
 if(node.id===CAMP_FOUNDATION_BASE.nodeId||state.bases.some(base=>base.nodeId===node.id))return 'base-exists';
 if(getCampDestinationAt(node.id))return 'registered-point';
 if(node.terrain!=='normal')return 'not-normal-terrain';
 if(state.bases.length>=CAMP_BASE_LIMIT)return 'base-limit';
 return null;
}
export function canEstablishCampBase(progress,nodeId){return campBaseEstablishmentIssue(progress,nodeId)===null;}
function randomUnit(rng){const value=rng();if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>=1)throw new RangeError('拠点配置の乱数が正しくありません。');return value;}

/** Call only after the host has checked the final-scene establishment gate. */
export function establishCampBase(progress,{nodeId,startBaseId=progress?.currentBaseId??CAMP_FOUNDATION_BASE.id,rng=Math.random}={}){
 const state=normalizeCampBaseProgress(progress),issue=campBaseEstablishmentIssue(state,nodeId);
 if(issue)throw new RangeError('この場所にはキャンプ拠点を設営できません。 ('+issue+')');
 if(!getCampBase(state,startBaseId))throw new RangeError('探索を開始したキャンプ拠点が見つかりません。');
 if(typeof rng!=='function')throw new TypeError('拠点配置の乱数が正しくありません。');
 const id='base-'+nodeId;
 // Names remain stable when an older frontier is withdrawn and another added.
 const usedNames=new Set(state.bases.map(base=>base.name));let number=1;while(usedNames.has('キャンプ拠点 '+number))number++;
 const base={id,nodeId,name:'キャンプ拠点 '+number,foundation:false,hutCount:5+Math.floor(randomUnit(rng)*6),rookieCount:3+Math.floor(randomUnit(rng)*3),layoutSeed:Math.floor(randomUnit(rng)*0x100000000)};
 return normalizeCampBaseProgress({...state,bases:[...state.bases,base],baseNetwork:[...state.baseNetwork,{fromId:startBaseId,toId:id}]});
}

/** Movement changes location only; payments and scene transitions belong to the host. */
export function moveCampBase(progress,id){
 const state=normalizeCampBaseProgress(progress);
 if(!getCampBase(state,id))throw new RangeError('移動先のキャンプ拠点が見つかりません。');
 return {...state,currentBaseId:id};
}
export function withdrawCampBase(progress,id){
 const state=normalizeCampBaseProgress(progress),base=getCampBase(state,id);
 if(!base||base.foundation||!base.frontier)throw new RangeError('撤収できるのはフロンティア拠点だけです。');
 const edge=state.baseNetwork.find(link=>link.fromId===id||link.toId===id),neighborId=edge.fromId===id?edge.toId:edge.fromId;
 return normalizeCampBaseProgress({...state,bases:state.bases.filter(item=>item.id!==id),baseNetwork:state.baseNetwork.filter(link=>link.fromId!==id&&link.toId!==id),currentBaseId:state.currentBaseId===id?neighborId:state.currentBaseId});
}

/** Copy only the persistence fields, not derived UI flags or unrelated camp data. */
export function campBaseSaveFields(progress){return copy(normalizeCampBaseProgress(progress));}
