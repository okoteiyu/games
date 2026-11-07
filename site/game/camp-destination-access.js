import {CAMP_DESTINATIONS} from './camp-world.js';

const LEGACY_DESTINATION_IDS=Object.freeze({danger_zone_090:'designated_zone_z_throne'});
export const canonicalCampDestinationId=id=>typeof id==='string'&&Object.hasOwn(LEGACY_DESTINATION_IDS,id)?LEGACY_DESTINATION_IDS[id]:id;
const includes=(values,id)=>values instanceof Set?values.has(id):Array.isArray(values)&&values.includes(id);
/** Actual visits unlock ordinary locations. Secret landmarks also need their
 * own persisted reveal, so old raw visit/fog data cannot expose them. */
export function isCampDestinationUnlocked(id,discovered,unlockedDestinations=[]){
 if(!Object.hasOwn(CAMP_DESTINATIONS,id))return false;
 if(id==='none')return true;
 const destination=CAMP_DESTINATIONS[id];
 return Boolean(destination.nodeId&&includes(discovered,destination.nodeId)&&(!destination.discoverySupplyId||includes(unlockedDestinations,id)));
}
/** Unknown secret options are absent, rather than named but disabled. Other
 * destination options retain their existing visited/disabled presentation. */
export function isCampDestinationVisible(id,discovered,unlockedDestinations=[]){
 const destination=CAMP_DESTINATIONS[id];
 return Boolean(destination&&(!destination.discoverySupplyId&&!destination.hideUntilVisited||isCampDestinationUnlocked(id,discovered,unlockedDestinations)));
}
/** Carrying a discovery tool never reveals a place before an actual arrival. */
export function canDiscoverCampDestinationOnArrival(id,supplies={}){
 const destination=CAMP_DESTINATIONS[id];
 return Boolean(destination&&(!destination.discoverySupplyId||supplies[destination.discoverySupplyId]>0));
}
/** Optional in old saves. Reveals must name real destinations that were visited. */
export function normalizeCampDestinationUnlocks(value=[],discovered=[]){
 if(!Array.isArray(value)||value.length>Object.keys(CAMP_DESTINATIONS).length+Object.keys(LEGACY_DESTINATION_IDS).length)throw new TypeError('登録地点の発見記録が正しくありません。');
 const current=value.map(canonicalCampDestinationId);
 if(current.some(id=>typeof id!=='string'||id==='none'||!Object.hasOwn(CAMP_DESTINATIONS,id)||!includes(discovered,CAMP_DESTINATIONS[id].nodeId)))throw new TypeError('登録地点の発見記録が正しくありません。');
 return [...new Set(current)];
}
