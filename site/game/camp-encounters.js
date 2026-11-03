/** Camp has no habitat restrictions; native species level bands still apply. */
export function campEncounterCandidates(playerLevel,creatures){
 if(!Number.isInteger(playerLevel)||playerLevel<1||playerLevel>106)throw new RangeError('キャンプのレベルが正しくありません。');
 const minimum=Math.max(1,playerLevel-8),maximum=Math.max(1,playerLevel-2);
 return Object.values(creatures).filter(creature=>creature.category==='normal').map(creature=>({creature,min:Math.max(minimum,creature.levelBand?.min??1),max:Math.min(maximum,creature.levelBand?.max??106)})).filter(candidate=>candidate.min<=candidate.max);
}
export function chooseCampEncounter(playerLevel,creatures,rng=Math.random){
 const candidates=campEncounterCandidates(playerLevel,creatures);if(!candidates.length)return null;
 const random=()=>{const n=Number(rng());if(!Number.isFinite(n))throw new TypeError('キャンプの乱数が正しくありません。');return Math.min(1-Number.EPSILON,Math.max(0,n));};
 const candidate=candidates[Math.floor(random()*candidates.length)];
 return {speciesId:candidate.creature.id,level:candidate.min+Math.floor(random()*(candidate.max-candidate.min+1)),id:'camp-opponent'};
}
