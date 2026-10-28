/** Species, aura, and super-prefix effects are distinct, independently editable lists. */
export const NO_ADDITIONAL_EFFECTS=Object.freeze([]);
export function additionalEffectsText(effects=NO_ADDITIONAL_EFFECTS){
 return effects.length?effects.map(effect=>typeof effect==='string'?effect:effect.description).filter(Boolean).join(' / '):'追加効果なし';
}
