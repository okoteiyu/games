import {techniqueMaxLevel,SUPER_MAX_LEVEL,playerTechniqueLevel,availableTechniqueIds} from './technique-rules.js';
/** The current reward lineup; new rewards can be added here without changing the draw. */
export const OKOTEIYU_EVENT_REWARDS=Object.freeze([
 Object.freeze({id:'super_state_level_up',label:'スーパーおこていゆ状態',percent:40,levelKey:'superLevel',maxLevel:SUPER_MAX_LEVEL}),
 Object.freeze({id:'unlock_energy_ray',label:'エネルギーレイ',percent:12,levelKey:'energyRayLevel',techniqueId:'energy_ray',unlockKey:'energyRayUnlocked'}),
 Object.freeze({id:'punch_level_up',label:'パンチ',percent:12,levelKey:'punchLevel',techniqueId:'punch'}),
 ...[['charged_punch','溜めパンチ'],['charged_energy_ray','溜めエネルギーレイ'],['energy_punch','エネルギーパンチ']].map(([techniqueId,label])=>Object.freeze({id:'unlock_'+techniqueId,label,techniqueId,percent:12,collectionLevel:true}))
]);
export function eligibleOkoteiyuRewards(player){
 return OKOTEIYU_EVENT_REWARDS.filter(item=>{
  if(!player)return true;
  if(item.techniqueId)return !availableTechniqueIds(player).includes(item.techniqueId)||playerTechniqueLevel(player,item.techniqueId)<techniqueMaxLevel(item.techniqueId);
  return (player[item.levelKey]??1)<item.maxLevel;
 });
}

export function selectOkoteiyuReward(draw,player=null){
 if(!Number.isFinite(draw)||draw<0||draw>=1)throw new RangeError('Invalid event draw.');
 const pool=eligibleOkoteiyuRewards(player);if(!pool.length)return null;
 const total=pool.reduce((sum,item)=>sum+item.percent,0);let threshold=0;
 return pool.find(item=>draw<(threshold+=item.percent/total))||pool.at(-1);
}
