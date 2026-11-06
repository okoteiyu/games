import {CAMP_CREATURE_DEFINITIONS} from './camp-creature.js';
import {NEW_CREATURE_DEFINITIONS} from './creature-expansion-c.js';
const allTerrains=['normal','rough','cliff','gas','cave','poor_visibility'];
const wilds=[{regionId:'wilds',terrainIds:[...allTerrains]}];
const sources=[CAMP_CREATURE_DEFINITIONS.find(c=>c.id==='great_fairy'),
 {levelBand:{min:1,max:100},spawnRegions:['forest','residential'],spawnTimes:['day','night'],id:'horarara_horaran',name:'ホラララホララン',category:'normal',height:.4,ranks:{hp:5,attack:5,ki:5,speed:5},techniques:['normal_attack','energy_ray'],auraColor:'#321442',description:'大きさの違う3つの黒紫色の鬼火がまとまった珍生物。少し可愛げのあるニヤけ顔をしています。',additionalEffects:[],auraAdditionalEffects:[]},
 NEW_CREATURE_DEFINITIONS.find(c=>c.id==='wind_kurukuru')];
export const REGIONAL_CREATURE_BASES=Object.freeze(Object.fromEntries(sources.map(c=>[c.id,{...c,campHabitats:wilds}])));
const variants=[
 {prefix:'angry',label:'怒',regions:['volcano'],increase:3,technique:'charged_energy_ray',color:'#f33830',palette:['#f33830','#ff7030','#f33830','#ffb051'],effect:{type:'first_attack_damage',multiplier:1.2,description:'戦闘中、最初の攻撃で与えるダメージが1.2倍になります。'},place:'火山',light:'激しい赤い光'},
 {prefix:'dark',label:'闇',regions:['meteor_crater','dark_domain'],increase:6,technique:'charged_energy_ray',color:'#271132',palette:['#271132','#140b20','#683087','#321143'],effect:{type:'first_damage_received',multiplier:.8,description:'戦闘中、最初に受けるダメージが0.8倍になります。'},place:'隕石跡地と暗黒域',light:'深い黒紫のモヤ'},
 {prefix:'celestial',label:'聖天',regions:['sacred_forest'],increase:10,technique:'cosmos_wave',color:'#fff3b0',palette:['#fff3b0','#fffbe9','#fff3b0','#ffb9d2','#9ad5ff','#c3a2ff','#b5f5d5','#fff8d4'],effect:{type:'first_damage_received',multiplier:.5,description:'戦闘中、最初に受けるダメージを半減します。'},place:'神聖な森',light:'白っぽい黄色の光と虹のきらめき'}
];
export const REGIONAL_CREATURE_VARIANTS=Object.values(REGIONAL_CREATURE_BASES).flatMap(base=>variants.map(v=>({
 ...base,id:v.prefix+'_'+base.id,name:v.label+base.name,baseSpeciesId:base.id,campOnly:true,spawnRegions:[],
 campHabitats:v.regions.map(regionId=>({regionId,terrainIds:[...allTerrains]})),
 ranks:Object.fromEntries(Object.entries(base.ranks).map(([key,value])=>[key,value+v.increase])),
 techniques:[...base.techniques,v.technique],additionalEffects:[...(base.additionalEffects||[]),{...v.effect}],auraAdditionalEffects:[...(base.auraAdditionalEffects||[])],
 auraColor:v.color,regionalAuraPalette:v.palette,auraPalette:[base.auraColor,...v.palette].slice(0,8),auraEmphasis:true,
 description:v.place+'で出会う'+base.name+'の仲間。元の姿のまわりに、'+v.light+'を重ねている。'
})));
export function regionalCampSpeciesId(baseId,regionId){
 return REGIONAL_CREATURE_VARIANTS.find(c=>c.baseSpeciesId===baseId&&c.campHabitats.some(h=>h.regionId===regionId))?.id??baseId;
}
