/** Facility staff are 2D conversation actors, independent of the room renderer. */
const WORKER_ROOM_IDS=Object.freeze(['guest-lounge','analysis-room','production-room','maintenance-room','warehouse']);
export const FACILITY_WORKER_ROOMS=WORKER_ROOM_IDS;
export const FACILITY_STAFF=Object.freeze(Object.fromEntries([
 ...['A','B'].map(letter=>({id:'manager_'+letter.toLowerCase(),role:'manager',label:'管理人'+letter,memberNumber:null,shiftIndex:null,supportersAssociationMember:true})),
 ...Array.from({length:18},(_,index)=>{const memberNumber=String(index+1).padStart(3,'0');return {id:'worker_'+memberNumber,role:'worker',label:'会員No.'+memberNumber,memberNumber,shiftIndex:Math.floor(index/6),supportersAssociationMember:true};})
].map(staff=>[staff.id,Object.freeze(staff)])));
const STAFF_FIELDS=['version','shiftIndex','assignments','fixedPlacements'];
const isRecord=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
const activeWorkers=shiftIndex=>Object.values(FACILITY_STAFF).filter(staff=>staff.role==='worker'&&staff.shiftIndex===shiftIndex);
function validShift(index){if(!Number.isInteger(index)||index<0||index>2)throw new TypeError('Invalid facility staff shift.');return index;}
function checkedStaff(id){if(!Object.hasOwn(FACILITY_STAFF,id))throw new TypeError('Unknown facility staff member.');return FACILITY_STAFF[id];}
function checkedRoom(id,room){const staff=checkedStaff(id);if(staff.role==='manager'?room!=='management-room':!WORKER_ROOM_IDS.includes(room))throw new TypeError('Invalid facility staff room.');return room;}
function randomRoom(rng){const draw=rng();if(typeof draw!=='number'||!Number.isFinite(draw)||draw<0||draw>=1)throw new TypeError('Invalid facility staff random source.');return WORKER_ROOM_IDS[Math.floor(draw*WORKER_ROOM_IDS.length)];}
function randomAssignments(shiftIndex,rng){if(typeof rng!=='function')throw new TypeError('Invalid facility staff random source.');return Object.fromEntries(activeWorkers(shiftIndex).map(staff=>[staff.id,randomRoom(rng)]));}
/** Separate RNG avoids changing battle, route, aura, or reward random streams. */
export function createFacilityStaff({rng=Math.random}={}){return {version:1,shiftIndex:0,assignments:randomAssignments(0,rng),fixedPlacements:{}};}
/** Old saves have no staff field. Their migration is deterministic and idempotent. */
function legacyFacilityStaff(){let seed=183;return createFacilityStaff({rng:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}});}
export function normalizeFacilityStaff(value){
 if(value===undefined)return legacyFacilityStaff();
 if(!isRecord(value)||value.version!==1||Object.keys(value).length!==STAFF_FIELDS.length||!STAFF_FIELDS.every(key=>Object.hasOwn(value,key)))throw new TypeError('Invalid facility staff state.');
 const shiftIndex=validShift(value.shiftIndex),workers=activeWorkers(shiftIndex);
 if(!isRecord(value.assignments)||Object.keys(value.assignments).length!==workers.length||!workers.every(staff=>Object.hasOwn(value.assignments,staff.id)))throw new TypeError('Invalid facility staff assignments.');
 if(!isRecord(value.fixedPlacements))throw new TypeError('Invalid fixed facility staff placements.');
 const assignments=Object.fromEntries(workers.map(staff=>[staff.id,checkedRoom(staff.id,value.assignments[staff.id])])),fixedPlacements={};
 for(const [id,room]of Object.entries(value.fixedPlacements))fixedPlacements[checkedStaff(id).id]=checkedRoom(id,room);
 return {version:1,shiftIndex,assignments,fixedPlacements};
}
/** Rotate to the next six workers; story room overrides survive the rotation. */
export function advanceFacilityStaffShift(value,{rng=Math.random}={}){const state=normalizeFacilityStaff(value),shiftIndex=(state.shiftIndex+1)%3;return {...state,shiftIndex,assignments:randomAssignments(shiftIndex,rng)};}
/** Story hooks change presentation placement only, never battle/progression rewards. */
export function setFacilityStaffPlacements(value,placements){
 const state=normalizeFacilityStaff(value);if(!isRecord(placements))throw new TypeError('Invalid fixed facility staff placements.');
 const next={...state.fixedPlacements};for(const [id,room]of Object.entries(placements))next[checkedStaff(id).id]=checkedRoom(id,room);
 return {...state,fixedPlacements:next};
}
export function clearFacilityStaffPlacements(value,ids=null){
 const state=normalizeFacilityStaff(value);if(ids===null)return {...state,fixedPlacements:{}};
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)throw new TypeError('Invalid facility staff identifiers.');
 for(const id of ids){checkedStaff(id);delete state.fixedPlacements[id];}return state;
}
/** Managers remain resident. A story placement takes priority over the shift. */
export function getFacilityStaffInRoom(value,sceneId){
 const state=normalizeFacilityStaff(value);
 return Object.values(FACILITY_STAFF).filter(staff=>{
  if(staff.role==='manager')return sceneId==='management-room';
  if(Object.hasOwn(state.fixedPlacements,staff.id))return state.fixedPlacements[staff.id]===sceneId;
  return staff.shiftIndex===state.shiftIndex&&state.assignments[staff.id]===sceneId;
 });
}
export function getFacilityStaffCounts(value){
 const state=normalizeFacilityStaff(value);return Object.fromEntries(['management-room',...WORKER_ROOM_IDS].map(sceneId=>[sceneId,getFacilityStaffInRoom(state,sceneId).length]));
}
