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
/** Damage effects stay independent of parameter ranks, aura levels and held items. */
export function additionalDamageMultiplier(effects=NO_ADDITIONAL_EFFECTS){
 return effects.reduce((value,effect)=>effect?.type==='damage_dealt_multiplier'?value*factor(effect.multiplier):value,1);
}
