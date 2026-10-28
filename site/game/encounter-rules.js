import {ADDED_CREATURES} from './creature-expansion.js';
/** Species habitat and level bands, and the shared training eligibility rules. */
export const PATROL_CATEGORIES=Object.freeze(['normal','threat']);
export const ENCOUNTER_PROFILES=Object.freeze({
 ...Object.fromEntries(Object.entries(ADDED_CREATURES).map(([id,{levelBand,spawnRegions,spawnTimes}])=>[id,Object.freeze({levelBand,spawnRegions,spawnTimes})])),
 horarara_horaran:Object.freeze({levelBand:Object.freeze({min:1,max:100}),spawnRegions:Object.freeze(['forest','residential']),spawnTimes:Object.freeze(['day','night'])}),
 moai_king:Object.freeze({levelBand:Object.freeze({min:5,max:100}),spawnRegions:Object.freeze(['forest','residential','city']),spawnTimes:Object.freeze(['day','night'])})
});
export const TRAINING_COURSES=Object.freeze({
 easy:Object.freeze({id:'easy',label:'訓練（易）',min:1,max:25,categories:Object.freeze(['normal','threat'])}),
 medium:Object.freeze({id:'medium',label:'訓練（中）',min:25,max:40,categories:Object.freeze(['normal','threat'])}),
 hard:Object.freeze({id:'hard',label:'訓練（難）',min:40,max:70,categories:Object.freeze(['normal','threat'])}),
 master:Object.freeze({id:'master',label:'訓練（マスター）',min:70,max:95,categories:Object.freeze(['normal','threat'])}),
 infinity:Object.freeze({id:'infinity',label:'訓練（∞）',min:95,max:106,categories:Object.freeze(['normal','threat'])})
});
export function overlapLevelBand(creature,min,max){
 const band=creature?.levelBand;if(!band)return null;
 const lower=Math.max(1,min,band.min),upper=Math.min(106,max,band.max);
 return lower<=upper?{min:lower,max:upper}:null;
}
export function patrolSpeciesEligible(creature,level,region=null,timeOfDay=null){return PATROL_CATEGORIES.includes(creature?.category)&&Boolean(creature?.spawnRegions?.length)&&(!region||creature.spawnRegions.includes(region))&&(!timeOfDay||!creature.spawnTimes||creature.spawnTimes.includes(timeOfDay))&&Boolean(overlapLevelBand(creature,level-5,level+5));}
export function trainingLevelRange(player,creature,tier='easy'){
 const course=TRAINING_COURSES[tier];if(!course||!course.categories.includes(creature?.category)||creature.category==='unique')return null;
 const wonOnPatrol=player?.journal?.[creature.id]?.patrolDefeats>0;
 const belowPatrolWindow=creature.levelBand?.max<player?.level-5;
 if(!wonOnPatrol&&!belowPatrolWindow)return null;
 // A missed species must not be locked out again by the player's -10 window.
 // It and sufficiently low courses use the full course/native intersection.
 const lower=belowPatrolWindow||course.max<=player.level-10?course.min:Math.max(course.min,player.level-10);
 return overlapLevelBand(creature,lower,Math.min(course.max,player.level));
}
