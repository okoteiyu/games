import {CREATURES,SUPPORT_ITEMS,DEFENSE_ITEMS,equipmentMultipliers,playerStats} from './game-session.js';
import {additionalDamageMultiplier} from './additional-effects.js';

function snapshot(player){
 const factors=equipmentMultipliers(player.equipment);
 const bodyEffects=CREATURES.okoteiyu.additionalEffects;
 const auraEffects=CREATURES[player.equippedAura]?.auraAdditionalEffects;
 return {
  stats:playerStats(player),
  damageDealt:factors.damageDealt*additionalDamageMultiplier(bodyEffects)*additionalDamageMultiplier(auraEffects),
  damageReceived:factors.damageReceived
 };
}

/** Compare an equipped item's removal or a selected item's replacement, without changing progress. */
export function equipmentChangePreview(player,kind,id){
 if(!['support','defense','aura'].includes(kind))throw new RangeError('Unknown equipment category.');
 const owned=kind==='aura'
  ?Object.hasOwn(CREATURES,id)&&Object.hasOwn(player.auras??{},id)
  :Object.hasOwn(kind==='support'?SUPPORT_ITEMS:DEFENSE_ITEMS,id)&&player.ownedItems?.[kind]?.includes(id);
 if(!owned)throw new RangeError('The selected equipment is not owned.');
 const current=kind==='aura'?player.equippedAura:player.equipment?.[kind];
 const removing=current===id,nextId=removing?null:id;
 const next=kind==='aura'
  ?{...player,equippedAura:nextId}
  :{...player,equipment:{...player.equipment,[kind]:nextId}};
 return {removing,before:snapshot(player),after:snapshot(next)};
}
