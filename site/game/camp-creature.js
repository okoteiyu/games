/** The camp guardian is intentionally excluded from patrol and training pools. */
export const CAMP_CREATURE_DEFINITIONS=Object.freeze([
 Object.freeze({id:'great_fairy',name:'大妖精',description:'森のさらに奥で出会う、大きな羽の妖精。小さな体に、静かな強さを秘めている。',category:'unique',campOnly:true,height:.5,levelBand:{min:1,max:106},spawnRegions:[],spawnTimes:['day','night'],ranks:{hp:9,attack:9,ki:9,speed:9},techniques:['energy_ray','tackle'],auraColor:'#68dd91',additionalEffects:[{id:'great_fairy_guard',type:'damage_received_multiplier',multiplier:.8,description:'大妖精が受けるダメージは0.8倍になります。'}],auraAdditionalEffects:[]})
]);
