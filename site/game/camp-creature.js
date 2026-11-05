/** Camp guardians never enter patrol or training pools. Danger-zone
 * guardians are distinct fixed-level individuals sharing one 3D appearance. */
export const MYSTERY_GUARDIAN_LEVELS=Object.freeze(Array.from({length:18},(_,index)=>15+index*5));
const mysteryGuardians=MYSTERY_GUARDIAN_LEVELS.map(level=>{
 const suffix=String(level).padStart(3,'0');
 return Object.freeze({
  id:'mystery_'+suffix,name:'???-'+level,
  description:'探索で出会った珍生物。正体は今後明かされる。',
  category:'unique',campOnly:true,fixedLevel:level,repeatable:true,height:1,
  levelBand:{min:level,max:level},spawnRegions:[],spawnTimes:['day','night'],
  campHabitats:[{destinationId:'danger_zone_'+suffix}],campLocationLabel:'危険地帯'+level,
  // Integer arithmetic applies the requested floor without floating-point
  // boundary drift. It is equivalent to flooring each complete rank formula.
  ranks:{hp:10+Math.floor(level*14/100),attack:7+Math.floor(level*17/100),ki:7+Math.floor(level*17/100),speed:4+Math.floor(level*20/100)},
  techniques:['energy_ray','tackle','chaos_wave'],auraColor:'#000000',
  additionalEffects:[],auraAdditionalEffects:[],
  additionalEffectsStatus:'unknown',auraAdditionalEffectsStatus:'unknown',
  sharedAppearance:'mystery_unique'
 });
});
export const CAMP_CREATURE_DEFINITIONS=Object.freeze([
 Object.freeze({id:'great_fairy',name:'大妖精',description:'森のさらに奥で出会う、大きな羽の妖精。小さな体に、静かな強さを秘めている。',category:'threat',campOnly:true,height:.5,levelBand:{min:1,max:106},spawnRegions:[],spawnTimes:['day','night'],ranks:{hp:9,attack:9,ki:9,speed:9},techniques:['energy_ray','tackle'],auraColor:'#68dd91',additionalEffects:[{id:'great_fairy_guard',type:'damage_received_multiplier',multiplier:.8,description:'大妖精が受けるダメージは0.8倍になります。'}],auraAdditionalEffects:[]}),
 ...mysteryGuardians
]);
