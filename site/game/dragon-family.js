const allTerrains=['normal','rough','cliff','gas','cave','poor_visibility'];

// The original species retains its authored ranks; the fixed R280 roster is
// adjusted once when the final game catalog is assembled.
export const DRAGON_BASE={
 id:'dragon',name:'ドラゴン',category:'threat',height:null,
 levelBand:{min:30,max:100},spawnRegions:['forest','residential','city'],spawnTimes:['day','night'],
 campHabitats:[{regionId:'wilds',terrainIds:[...allTerrains]}],
 ranks:{hp:10,attack:1,ki:10,speed:5},techniques:['charged_energy_ray'],auraColor:'#ff5545',
 description:'普通の雰囲気のドラゴン。強そうに見えるような見えないような。でも強い。',
 additionalEffects:[],auraAdditionalEffects:[]
};

// R283 adds new species after R280. Their regional additions start from the
// current dragon ranks (15/6/15/10); these IDs are not part of the R280 roster.
export const DRAGON_REGIONAL_BASE_RANKS=Object.freeze({hp:15,attack:6,ki:15,speed:10});
const variants=[
 {prefix:'angry',label:'怒',regions:['volcano'],increase:3,technique:'charged_energy_ray',color:'#f33830',palette:['#f33830','#ff7030','#f33830','#ffb051'],effect:{type:'first_attack_damage',multiplier:1.2,description:'戦闘中、最初の攻撃で与えるダメージが1.2倍になります。'},place:'火山',light:'激しい赤い光'},
 {prefix:'dark',label:'闇',regions:['meteor_crater','dark_domain'],increase:6,technique:'charged_energy_ray',color:'#271132',palette:['#271132','#140b20','#683087','#321143'],effect:{type:'first_damage_received',multiplier:.8,description:'戦闘中、最初に受けるダメージが0.8倍になります。'},place:'隕石跡地と暗黒域',light:'深い黒紫のモヤ'},
 {prefix:'celestial',label:'聖天',regions:['sacred_forest'],increase:10,technique:'cosmos_wave',color:'#fff3b0',palette:['#fff3b0','#fffbe9','#fff3b0','#ffb9d2','#9ad5ff','#c3a2ff','#b5f5d5','#fff8d4'],effect:{type:'first_damage_received',multiplier:.5,description:'戦闘中、最初に受けるダメージを半減します。'},place:'神聖な森',light:'白っぽい黄色の光と虹のきらめき'}
];
export const DRAGON_VARIANTS=variants.map(v=>({
 ...DRAGON_BASE,id:v.prefix+'_dragon',name:v.label+DRAGON_BASE.name,baseSpeciesId:'dragon',campOnly:true,spawnRegions:[],
 campHabitats:v.regions.map(regionId=>({regionId,terrainIds:[...allTerrains]})),
 ranks:Object.fromEntries(Object.entries(DRAGON_REGIONAL_BASE_RANKS).map(([key,value])=>[key,value+v.increase])),
 techniques:[...new Set([...DRAGON_BASE.techniques,v.technique])],
 additionalEffects:[...DRAGON_BASE.additionalEffects,{...v.effect}],auraAdditionalEffects:[...DRAGON_BASE.auraAdditionalEffects],
 auraColor:v.color,regionalAuraPalette:v.palette,auraPalette:[DRAGON_BASE.auraColor,...v.palette].slice(0,8),auraEmphasis:true,
 description:v.place+'で出会うドラゴンの仲間。元の赤い光に、'+v.light+'を重ねている。'
}));
export const DRAGON_FAMILY_DEFINITIONS=[DRAGON_BASE,...DRAGON_VARIANTS];
