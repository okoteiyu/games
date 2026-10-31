/** Species, aura, and super-prefix effects are distinct, independently editable lists. */
export const NO_ADDITIONAL_EFFECTS=Object.freeze([]);
export function additionalEffectsText(effects=NO_ADDITIONAL_EFFECTS){
 return effects.length?effects.map(effect=>typeof effect==='string'?effect:effect.description).filter(Boolean).join(' / '):'追加効果なし';
}

function factor(value=1){
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new RangeError('追加効果の倍率が正しくありません。');
 return value;
}
/** These modifiers affect attack power only; the caller rounds after all stat modifiers. */
export function firstAttackParameterMultipliers(effects=NO_ADDITIONAL_EFFECTS,completedAttacks=0){
 const result={attack:1,ki:1};
 if(completedAttacks!==0)return result;
 for(const effect of effects)if(effect?.type==='first_attack_parameters'){
  result.attack*=factor(effect.attack);result.ki*=factor(effect.ki);
 }
 return result;
}
function hasLivingSpeciesGroup(opponents,minimumCount){
 const counts=new Map();
 for(const opponent of opponents)if(opponent.hp>0){
  const count=(counts.get(opponent.speciesId)||0)+1;counts.set(opponent.speciesId,count);
  if(count>=minimumCount)return true;
 }
 return false;
}
/** Check living groups at damage completion, independently of the selected target. */
export function additionalDamageMultiplier(effects=NO_ADDITIONAL_EFFECTS,{opponents=[],actorHeight=null,targetHeight=null,actor=null,allies=[],targetSpeciesId=null}={}){
 return effects.reduce((value,effect)=>{
  if(effect?.type==='living_ally_species_damage_dealt'&&actor&&allies.some(ally=>ally.id!==actor.id&&ally.hp>0&&effect.speciesIds.includes(ally.speciesId)))return value*factor(effect.multiplier);
  if(effect?.type==='target_species_exclusion_damage_dealt'&&typeof targetSpeciesId==='string'&&!effect.excludedSpeciesIds.includes(targetSpeciesId))return value*factor(effect.multiplier);
  if(effect?.type==='smaller_target_damage_dealt'&&Number.isFinite(actorHeight)&&Number.isFinite(targetHeight)&&actorHeight>targetHeight)return value*factor(effect.multiplier);
  if(effect?.type==='damage_dealt_multiplier')return value*factor(effect.multiplier);
  if(effect?.type==='living_opponent_species_group_damage_dealt'&&hasLivingSpeciesGroup(opponents,effect.minimumCount))return value*factor(effect.multiplier);
  return value;
 },1);
}
/** One qualifying ally enables the effect; further allies do not multiply it. */
export function additionalDamageReceivedMultiplier(effects=NO_ADDITIONAL_EFFECTS,{actor=null,allies=[],actorHeight=null,attackerHeight=null}={}){
 return effects.reduce((value,effect)=>effect?.type==='taller_attacker_damage_received'&&Number.isFinite(actorHeight)&&Number.isFinite(attackerHeight)&&attackerHeight>actorHeight?value*factor(effect.multiplier):effect?.type==='living_same_species_ally_damage_received'&&actor?.hp>0&&allies.some(ally=>ally.id!==actor.id&&ally.hp>0&&ally.speciesId===actor.speciesId)?value*factor(effect.multiplier):value,1);
}
