import {CAMP_TERRAINS,CAMP_DESTINATIONS} from './camp-world.js';
import {CAMP_REGIONS} from './camp-regions.js';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
/** Authored habitat entries are OR alternatives, each either a region/terrain
 * conjunction or one actual destination. Existing species omit this field. */
export function validateCampHabitats(value){
 if(!Array.isArray(value))throw new TypeError('キャンプの出現条件は配列で指定してください。');
 return Array.from(value).map(entry=>{
  if(!plain(entry))throw new TypeError('キャンプの出現条件が正しくありません。');
  const keys=Object.keys(entry);
  if(keys.length===1&&keys[0]==='destinationId'){
   if(typeof entry.destinationId!=='string'||!Object.hasOwn(CAMP_DESTINATIONS,entry.destinationId)||!CAMP_DESTINATIONS[entry.destinationId]?.nodeId)throw new RangeError('キャンプの目的地点が見つかりません。');
   return {destinationId:entry.destinationId};
  }
  if(keys.length!==2||!keys.includes('regionId')||!keys.includes('terrainIds')||typeof entry.regionId!=='string'||!Object.hasOwn(CAMP_REGIONS,entry.regionId)||!Array.isArray(entry.terrainIds)||entry.terrainIds.length===0||Array.from(entry.terrainIds).some(id=>typeof id!=='string'||!Object.hasOwn(CAMP_TERRAINS,id)))throw new RangeError('キャンプの区域と属性を指定してください。');
  return {regionId:entry.regionId,terrainIds:[...new Set(entry.terrainIds)]};
 });
}
export function campHabitatMatches(creature,context={}){
 if(creature.campHabitats===undefined)return true;
 return validateCampHabitats(creature.campHabitats).some(entry=>entry.destinationId!==undefined?entry.destinationId===context.destinationId:entry.regionId===context.regionId&&entry.terrainIds.includes(context.terrainId));
}
/** Current random encounters remain normal species in their native level bands. */
export function campEncounterCandidates(playerLevel,creatures,context={}){
 if(!Number.isInteger(playerLevel)||playerLevel<1||playerLevel>106)throw new RangeError('キャンプのレベルが正しくありません。');
 const minimum=Math.max(1,playerLevel-8),maximum=Math.max(1,playerLevel-2);
 return Object.values(creatures).filter(creature=>creature.category==='normal'&&campHabitatMatches(creature,context)).map(creature=>({creature,min:Math.max(minimum,creature.levelBand?.min??1),max:Math.min(maximum,creature.levelBand?.max??106)})).filter(candidate=>candidate.min<=candidate.max);
}
export function chooseCampEncounter(playerLevel,creatures,rng=Math.random,context={}){
 const candidates=campEncounterCandidates(playerLevel,creatures,context);if(!candidates.length)return null;
 const random=()=>{const n=Number(rng());if(!Number.isFinite(n))throw new TypeError('キャンプの乱数が正しくありません。');return Math.min(1-Number.EPSILON,Math.max(0,n));};
 const candidate=candidates[Math.floor(random()*candidates.length)];
 return {speciesId:candidate.creature.id,level:candidate.min+Math.floor(random()*(candidate.max-candidate.min+1)),id:'camp-opponent'};
}
