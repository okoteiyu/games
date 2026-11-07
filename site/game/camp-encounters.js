import {CAMP_TERRAINS,CAMP_DESTINATIONS} from './camp-world.js';
import {CAMP_REGIONS} from './camp-regions.js';

export const CAMP_ENCOUNTER_WEIGHT_RANGES=Object.freeze({
 wilds:Object.freeze({min:1,max:2}),
 volcano:Object.freeze({min:2,max:4}),
 meteor_crater:Object.freeze({min:4,max:6}),
 dark_domain:Object.freeze({min:4,max:6}),
 sacred_forest:Object.freeze({min:4,max:5})
});
export const CAMP_ENCOUNTER_MAX_MEMBERS=Math.max(...Object.values(CAMP_ENCOUNTER_WEIGHT_RANGES).map(range=>range.max));
export const campEncounterWeight=creature=>creature?.category==='normal'?1:creature?.category==='threat'?2:0;

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
export function campHabitatDescription(creature){
 if(creature.campHabitats===undefined)return null;
 return validateCampHabitats(creature.campHabitats).map(entry=>entry.destinationId!==undefined?CAMP_DESTINATIONS[entry.destinationId].name:CAMP_REGIONS[entry.regionId].name+'（'+entry.terrainIds.map(id=>CAMP_TERRAINS[id].label).join('・')+'）').join(' / ')||'なし';
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
 return Object.values(creatures).filter(creature=>creature.id!=='rookie_kun'&&(creature.category==='normal'||regionId!=='wilds'&&creature.category==='threat')&&campHabitatMatches(creature,context)).map(creature=>{const band=nativeBand(creature);return {creature,min:clampToBand(rawMin,band),max:clampToBand(rawMax,band),rawMin,rawMax};});
}
export function chooseCampEncounter(playerLevel,creatures,rng=Math.random,context={}){
 const candidates=campEncounterCandidates(playerLevel,creatures,context);if(!candidates.length)return null;
 const range=Object.hasOwn(CAMP_ENCOUNTER_WEIGHT_RANGES,context.regionId)?CAMP_ENCOUNTER_WEIGHT_RANGES[context.regionId]:CAMP_ENCOUNTER_WEIGHT_RANGES.wilds;
 // Choose a feasible total first, then fill it exactly. Sampling with
 // replacement allows several individuals of the same eligible species.
 const weights=[...new Set(candidates.map(candidate=>campEncounterWeight(candidate.creature)))],reachable=Array(range.max+1).fill(false);reachable[0]=true;
 for(let total=1;total<=range.max;total++)reachable[total]=weights.some(weight=>weight>0&&weight<=total&&reachable[total-weight]);
 const totals=Array.from({length:range.max-range.min+1},(_,index)=>range.min+index).filter(total=>reachable[total]);if(!totals.length)return null;
 let remaining=totals[Math.floor(randomValue(rng)*totals.length)];const members=[];
 while(remaining>0){
  const fitting=candidates.filter(candidate=>{const weight=campEncounterWeight(candidate.creature);return weight>0&&weight<=remaining&&reachable[remaining-weight];});
  const candidate=fitting[Math.floor(randomValue(rng)*fitting.length)],rawLevel=candidate.rawMin+Math.floor(randomValue(rng)*(candidate.rawMax-candidate.rawMin+1));
  members.push({speciesId:candidate.creature.id,level:clampToBand(rawLevel,nativeBand(candidate.creature)),id:members.length?'camp-opponent-'+(members.length+1):'camp-opponent'});
  remaining-=campEncounterWeight(candidate.creature);
 }
 return {id:'camp-encounter',members};
}
/** Fixed unique guardians retain their authored level. Other guardians draw
 * once from +3..+6 when battle starts, then clamp to the native band. */
export function chooseCampGuardianLevel(playerLevel,creature,rng=Math.random){
 validatePlayerLevel(playerLevel);const band=nativeBand(creature);
 if(creature.category==='unique'&&band.min===band.max)return band.min;
 const rawLevel=playerLevel+3+Math.floor(randomValue(rng)*4);
 return clampToBand(rawLevel,band);
}
