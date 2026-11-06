/** Regional Punim are distinct species; unspecified properties inherit Punim. */
const allTerrains=['normal','rough','cliff','gas','cave','poor_visibility'];
const base={
 id:'punim',name:'プニム',category:'normal',height:.25,levelBand:{min:1,max:100},
 spawnRegions:['forest','residential','city'],spawnTimes:['day','night'],
 campHabitats:[{regionId:'wilds',terrainIds:[...allTerrains]}],
 ranks:{hp:3,attack:3,ki:3,speed:3},techniques:['normal_attack','energy_ray'],auraColor:'#ff7fbe',
 description:'何だか親近感を覚える珍生物。プニプニしてるからプニム☺️',additionalEffects:[],auraAdditionalEffects:[]
};
function variant({id,name,regions,rankIncrease,technique,auraColor,auraPalette,description,effect}){
 return {...base,id,name,baseSpeciesId:base.id,spawnRegions:[],campOnly:true,
  campHabitats:regions.map(regionId=>({regionId,terrainIds:[...allTerrains]})),
  ranks:Object.fromEntries(Object.entries(base.ranks).map(([key,value])=>[key,value+rankIncrease])),
  techniques:[...base.techniques,technique],auraColor,...(auraPalette?{auraPalette,auraEmphasis:true}:{}),description,
  additionalEffects:[effect],auraAdditionalEffects:[]};
}
export const PUNIM_FAMILY_DEFINITIONS=[base,
 variant({id:'angry_punim',name:'怒プニム',regions:['volcano'],rankIncrease:3,technique:'charged_energy_ray',auraColor:'#f33830',
  description:'火山で出会う、体が赤いプニムの仲間。',
  effect:{type:'first_attack_damage',multiplier:1.2,description:'戦闘中、最初の攻撃で与えるダメージが1.2倍になります。'}}),
 variant({id:'dark_punim',name:'闇プニム',regions:['meteor_crater','dark_domain'],rankIncrease:6,technique:'charged_energy_ray',auraColor:'#271132',
  description:'隕石跡地と暗黒域で出会う、黒紫色のプニムの仲間。',
  effect:{type:'first_damage_received',multiplier:.8,description:'戦闘中、最初に受けるダメージが0.8倍になります。'}}),
 variant({id:'celestial_punim',name:'聖天プニム',regions:['sacred_forest'],rankIncrease:10,technique:'cosmos_wave',auraColor:'#fff3b0',
  auraPalette:['#fff3b0','#fffbe9','#fff3b0','#ffb9d2','#9ad5ff','#c3a2ff','#b5f5d5','#fff8d4'],
  description:'神聖な森で出会う、白っぽい黄色に輝くプニムの仲間。',
  effect:{type:'first_damage_received',multiplier:.5,description:'戦闘中、最初に受けるダメージを半減します。'}})
];
