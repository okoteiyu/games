/** Regional warriors retain the original stone bust and its black/gold aura. */
const allTerrains=['normal','rough','cliff','gas','cave','poor_visibility'];
export const MOAI_WARRIOR_BASE={
 id:'moai_king',name:'モアイの戦士',category:'normal',height:2.5,levelBand:{min:5,max:100},
 spawnRegions:['forest','residential','city'],spawnTimes:['day','night'],
 campHabitats:[{regionId:'wilds',terrainIds:[...allTerrains]}],
 ranks:{hp:14,attack:9,ki:9,speed:2},techniques:['normal_attack','energy_ray'],
 description:'歴戦の戦士の風格を感じる、恐ろしい珍生物。',additionalEffects:[],auraAdditionalEffects:[]
};
function variant({id,name,regions,increase,technique,auraColor,auraPalette,description,effect}){
 return {...MOAI_WARRIOR_BASE,id,name,baseSpeciesId:'moai_king',campOnly:true,spawnRegions:[],
  campHabitats:regions.map(regionId=>({regionId,terrainIds:[...allTerrains]})),
  ranks:Object.fromEntries(Object.entries(MOAI_WARRIOR_BASE.ranks).map(([key,value])=>[key,value+increase])),
  techniques:[...MOAI_WARRIOR_BASE.techniques,technique],description,auraColor,regionalAuraPalette:auraPalette,auraPalette:['#08090e','#e7b54f',...auraPalette].slice(0,8),auraEmphasis:true,
  additionalEffects:[effect],auraAdditionalEffects:[]};
}
export const MOAI_WARRIOR_VARIANTS=[
 variant({id:'angry_moai_warrior',name:'怒モアイの戦士',regions:['volcano'],increase:3,technique:'charged_energy_ray',auraColor:'#f33830',
  auraPalette:['#f33830','#ff7030','#f33830','#ffb051'],description:'火山で出会うモアイの戦士。黒と金のオーラに、激しい赤い光を重ねている。',
  effect:{type:'first_attack_damage',multiplier:1.2,description:'戦闘中、最初の攻撃で与えるダメージが1.2倍になります。'}}),
 variant({id:'dark_moai_warrior',name:'闇モアイの戦士',regions:['meteor_crater','dark_domain'],increase:6,technique:'charged_energy_ray',auraColor:'#271132',
  auraPalette:['#271132','#140b20','#683087','#321143'],description:'隕石跡地と暗黒域で出会うモアイの戦士。黒と金のオーラに、深い黒紫のモヤがうねる。',
  effect:{type:'first_damage_received',multiplier:.8,description:'戦闘中、最初に受けるダメージが0.8倍になります。'}}),
 variant({id:'celestial_moai_warrior',name:'聖天モアイの戦士',regions:['sacred_forest'],increase:10,technique:'cosmos_wave',auraColor:'#fff3b0',
  auraPalette:['#fff3b0','#fffbe9','#fff3b0','#ffb9d2','#9ad5ff','#c3a2ff','#b5f5d5','#fff8d4'],description:'神聖な森で出会うモアイの戦士。黒と金のオーラに、白っぽい黄色の光と虹のきらめきを重ねている。',
  effect:{type:'first_damage_received',multiplier:.5,description:'戦闘中、最初に受けるダメージを半減します。'}})
];
