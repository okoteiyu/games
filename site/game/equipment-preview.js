import {CREATURES,SUPPORT_ITEMS,DEFENSE_ITEMS,equipmentMultipliers,playerStats} from './game-session.js';
import {additionalDamageMultiplier,additionalDamageReceivedMultiplier,opponentAttackParameterMultiplier,opponentKiParameterMultiplier} from './additional-effects.js';
import {supportSelectionChange} from './equipment-rules.js';

function snapshot(player,context){
 const factors=equipmentMultipliers(player.equipment);
 const bodyEffects=CREATURES.okoteiyu.additionalEffects;
 const auraEffects=CREATURES[player.equippedAura]?.auraAdditionalEffects;
 return {
  stats:playerStats(player),
  opponentAttackParameter:opponentAttackParameterMultiplier([bodyEffects,auraEffects]),
  opponentKiParameter:opponentKiParameterMultiplier([bodyEffects,auraEffects]),
  conditionalRankBonus:(auraEffects||[]).some(effect=>effect.type==='random_opponent_rank_bonus'),
  damageDealt:factors.damageDealt*additionalDamageMultiplier(bodyEffects,context)*additionalDamageMultiplier(auraEffects,context),
  damageReceived:factors.damageReceived*additionalDamageReceivedMultiplier(bodyEffects,{...context,actorHeight:CREATURES.okoteiyu.height})*additionalDamageReceivedMultiplier(auraEffects,{...context,actorHeight:CREATURES.okoteiyu.height})
 };
}

/** Compare one add/remove action without changing progress or the other support items. */
export function equipmentChangePreview(player,kind,id,context={}){
 if(!['support','defense','aura'].includes(kind))throw new RangeError('Unknown equipment category.');
 const owned=kind==='aura'
  ?Object.hasOwn(CREATURES,id)&&Object.hasOwn(player.auras??{},id)
  :Object.hasOwn(kind==='support'?SUPPORT_ITEMS:DEFENSE_ITEMS,id)&&player.ownedItems?.[kind]?.includes(id);
 if(!owned)throw new RangeError('The selected equipment is not owned.');
 const supportChange=kind==='support'?supportSelectionChange(player.equipment,id):null;
 const current=kind==='aura'?player.equippedAura:player.equipment?.[kind];
 const removing=supportChange?supportChange.removing:current===id,nextId=supportChange?supportChange.ids:removing?null:id;
 const next=kind==='aura'
  ?{...player,equippedAura:nextId}
  :{...player,equipment:{...player.equipment,[kind]:nextId}};
 return {removing,allowed:supportChange?.allowed??true,reason:supportChange?.reason??null,before:snapshot(player,context),after:snapshot(supportChange&&!supportChange.allowed?player:next,context)};
}
