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
const validatePlayerLevel=level=>{if(!Number.isInteger(level)||level<1||level>106)throw new RangeError('キャンプのレベルが正しくありません。');};
function nativeBand(creature){
 if(!creature||typeof creature!=='object')throw new TypeError('キャンプの珍生物が正しくありません。');
 const min=creature.levelBand?.min??1,max=creature.levelBand?.max??106;
 if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max<min)throw new RangeError('珍生物の固有レベル帯が正しくありません。');
 return {min,max};
}
const clampToBand=(level,band)=>Math.max(band.min,Math.min(band.max,level));
function randomValue(rng){
 if(typeof rng!=='function')throw new TypeError('キャンプの乱数が正しくありません。');
 const n=Number(rng());if(!Number.isFinite(n))throw new TypeError('キャンプの乱数が正しくありません。');
 return Math.min(1-Number.EPSILON,Math.max(0,n));
}
/** Draw from the player-relative interval, then clamp to the species' band.
 * min/max describe possible final levels; rawMin/rawMax retain the draw range. */
export function campEncounterCandidates(playerLevel,creatures,context={}){
 validatePlayerLevel(playerLevel);
 const regionId=Object.hasOwn(CAMP_REGIONS,context.regionId)?context.regionId:'wilds',rawMin=playerLevel-5,rawMax=playerLevel+3;
 return Object.values(creatures).filter(creature=>(creature.category==='normal'||regionId!=='wilds'&&creature.category==='threat')&&campHabitatMatches(creature,context)).map(creature=>{const band=nativeBand(creature);return {creature,min:clampToBand(rawMin,band),max:clampToBand(rawMax,band),rawMin,rawMax};});
}
export function chooseCampEncounter(playerLevel,creatures,rng=Math.random,context={}){
 const candidates=campEncounterCandidates(playerLevel,creatures,context);if(!candidates.length)return null;
 const candidate=candidates[Math.floor(randomValue(rng)*candidates.length)],rawLevel=candidate.rawMin+Math.floor(randomValue(rng)*(candidate.rawMax-candidate.rawMin+1));
 return {speciesId:candidate.creature.id,level:clampToBand(rawLevel,nativeBand(candidate.creature)),id:'camp-opponent'};
}
/** Fixed unique guardians retain their authored level. Other guardians draw
 * once from +3..+6 when battle starts, then clamp to the native band. */
export function chooseCampGuardianLevel(playerLevel,creature,rng=Math.random){
 validatePlayerLevel(playerLevel);const band=nativeBand(creature);
 if(creature.category==='unique'&&band.min===band.max)return band.min;
 const rawLevel=playerLevel+3+Math.floor(randomValue(rng)*4);
 return clampToBand(rawLevel,band);
}
