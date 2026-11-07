const rankKeys=['hp','attack','ki','speed'];

/** This intrinsic multiplier uses the four species ranks, independent of
 * character level, equipped aura, held items, and temporary battle effects. */
export function damageReductionValue(ranks){
 const total=rankKeys.reduce((sum,key)=>{const value=ranks?.[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new RangeError('Invalid parameter rank for damage reduction.');return sum+value;},0);
 return 1/(1+(1.5*140)/(1+total));
}
