import {CAMP_DESTINATIONS} from './camp-world.js';

/** Only actual, persisted visits unlock a selectable goal. Visual fog clearing
 * and an internal compass route never grant discovery by themselves. */
export function isCampDestinationUnlocked(id,discovered){
 if(!Object.hasOwn(CAMP_DESTINATIONS,id))return false;
 if(id==='none')return true;
 const nodeId=CAMP_DESTINATIONS[id].nodeId;
 return Boolean(nodeId&&(discovered instanceof Set?discovered.has(nodeId):Array.isArray(discovered)&&discovered.includes(nodeId)));
}
