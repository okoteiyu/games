/** Aura growth is derived from acquired copies. The first copy is level one. */
export const AURA_MAX_LEVEL=100;
export const AURA_COPIES_PER_LEVEL=3;
export const auraMaxLevel=speciesId=>speciesId==='okoteiyu'?1:AURA_MAX_LEVEL;

export function auraProgressFromCopies(speciesId,copies){
 if(!Number.isSafeInteger(copies)||copies<1||speciesId==='okoteiyu'&&copies!==1)throw new RangeError('Aura copies are outside their allowed range.');
 const maximum=auraMaxLevel(speciesId),level=Math.min(maximum,1+Math.floor((copies-1)/AURA_COPIES_PER_LEVEL));
 return {level,progress:level===maximum?0:(copies-1)%AURA_COPIES_PER_LEVEL};
}

/** Older saves kept accumulating copies after reaching their former level-30
 * cap. Validate that old representation before deriving the current progress. */
export function restoreAuraProgress(speciesId,aura){
 const progress=auraProgressFromCopies(speciesId,aura.copies),legacyMaximum=30;
 const current=aura.level===progress.level&&aura.progress===progress.progress;
 const legacyCapped=speciesId!=='okoteiyu'&&aura.level===legacyMaximum&&aura.progress===0&&aura.copies>=1+(legacyMaximum-1)*AURA_COPIES_PER_LEVEL;
 if(!current&&!legacyCapped)throw new RangeError('Aura level does not match its acquired copies.');
 return progress;
}
