import {NEW_CREATURE_DEFINITIONS} from './creature-expansion-c.js';
/** Confirmed species settings. Null heights remain undecided; GLBs carry separate authoring dimensions. */
const definitions=[...NEW_CREATURE_DEFINITIONS,
 {id:'car',name:'カー',description:'一見するとただの車だけど、こいつは車じゃない!!!',category:'normal',height:1.5,levelBand:{min:20,max:100},spawnRegions:['city','residential'],spawnTimes:['day','night'],ranks:{hp:10,attack:5,ki:0,speed:10},techniques:['tackle'],auraColor:'#ffe34a',additionalEffects:[{type:'smaller_target_damage_dealt',multiplier:1.5,description:'自身より身長が小さい相手に与えるダメージが1.5倍になります。'}],auraAdditionalEffects:[{type:'taller_attacker_damage_received',multiplier:.8,description:'自身より身長が大きい相手から受けるダメージが0.8倍になります。'}]},
 {
  id:'mini_elephant',name:'ミニ象',category:'threat',height:.3,
  levelBand:{min:15,max:50},spawnRegions:['residential','forest'],spawnTimes:['day'],
  ranks:{hp:4,attack:14,ki:3,speed:12},techniques:['normal_attack'],auraColor:'#ffe34a',
  description:'小さくてかわいいね☺️☺️ おこていゆよりも小さいね☺️☺️ かわいいねえ☺️☺️',
  additionalEffects:[{id:'mini_elephant_herd_guard',type:'living_same_species_ally_damage_received',multiplier:.5,description:'複数戦闘で、疲れていない他のミニ象がいる間、受けるダメージが0.5倍になります。仲間の数によって重複しません。'}],
  auraAdditionalEffects:[{id:'mini_elephant_group_bonus',type:'living_opponent_species_group_damage_dealt',minimumCount:2,multiplier:1.3,description:'複数戦闘で、疲れていない同じ種類の相手が2体以上いる間、どの相手に与えるダメージも1.3倍になります。'}]
 },
 {
  id:'rookie_kun',name:'新人くん',category:'normal',height:1.5,
  levelBand:{min:1,max:30},spawnRegions:['city','residential','forest'],spawnTimes:['day','night'],
  ranks:{hp:6,attack:3,ki:3,speed:3},techniques:['punch','energy_ray'],auraColor:'#ffffff',
  description:'新人ヒーローのようだが、ここはおこていゆの担当エリアです。あと、おこていゆは撃退対象じゃないから😭',
  additionalEffects:[{id:'first_attack_boost',type:'first_attack_parameters',attack:2,ki:2,description:'最初の攻撃だけ、攻撃力と気を2倍にして威力を計算します。'}],
  auraAdditionalEffects:[{id:'rookie_damage_bonus',type:'damage_dealt_multiplier',multiplier:1.1,description:'相手に与えるダメージが1.1倍になります。'}]
 },
 {
  "id": "fae_dragon",
  "name": "妖龍",
  "category": "threat",
  "height": 0.55,
  "levelBand": {
   "min": 20,
   "max": 45
  },
  "spawnRegions": [
   "forest"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 10,
   "attack": 4,
   "ki": 9,
   "speed": 6
  },
  "techniques": [
   "charged_energy_ray",
   "normal_attack"
  ],
  "auraColor": "#ff7fbe",
  "description": "怪しい雰囲気を感じる龍。強そう...な感じはしないけど強いみたい。"
 },
 {
  "id": "transparent_knight",
  "name": "透明騎士",
  "category": "threat",
  "height": 1.8,
  "levelBand": {
   "min": 25,
   "max": 50
  },
  "spawnRegions": [
   "residential"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 5,
   "attack": 8,
   "ki": 0,
   "speed": 10
  },
  "techniques": [
   "normal_attack"
  ],
  "auraColor": "#16131c",
  "description": "夜に出会ったから透明だと勘違いしてつけた名前。ちなみに強い。"
 },
 {
  "id": "punim",
  "name": "プニム",
  "category": "normal",
  "height": 0.25,
  "levelBand": {
   "min": 1,
   "max": 100
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 3,
   "attack": 3,
   "ki": 3,
   "speed": 3
  },
  "techniques": [
   "normal_attack",
   "energy_ray"
  ],
  "auraColor": "#ff7fbe",
  "description": "何だか親近感を覚える珍生物。プニプニしてるからプニム☺️"
 },
 {
  "id": "crystal_striker",
  "name": "クリスタルストライカー",
  "category": "normal",
  "height": null,
  "levelBand": {
   "min": 30,
   "max": 100
  },
  "spawnRegions": [
   "forest"
  ],
  "spawnTimes": [
   "night"
  ],
  "ranks": {
   "hp": 6,
   "attack": 4,
   "ki": 4,
   "speed": 4
  },
  "techniques": [
   "energy_punch",
   "charged_punch"
  ],
  "auraColor": "#88dfff",
  "description": "クリスタルのように硬い拳で殴ってくる。こわい😢"
 },
 {
  "id": "unknown_low",
  "name": "解析不可（危険度低）",
  "category": "threat",
  "height": null,
  "levelBand": {
   "min": 25,
   "max": 25
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 6,
   "attack": 6,
   "ki": 6,
   "speed": 6
  },
  "techniques": [
   "energy_ray",
   "normal_attack"
  ],
  "auraColor": "#16131c",
  "description": "み、見えなかった💦 でもそこまで強くないかも！"
 },
 {
  "id": "unknown_danger",
  "name": "解析不可（危険）",
  "category": "threat",
  "height": null,
  "levelBand": {
   "min": 50,
   "max": 50
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 8,
   "attack": 8,
   "ki": 8,
   "speed": 8
  },
  "techniques": [
   "energy_ray",
   "normal_attack"
  ],
  "auraColor": "#16131c",
  "description": "み、見えなかった💦 しかも強い😢"
 },
 {
  "id": "unknown_extreme",
  "name": "解析不可（超危険）",
  "category": "threat",
  "height": null,
  "levelBand": {
   "min": 70,
   "max": 70
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 11,
   "attack": 11,
   "ki": 11,
   "speed": 11
  },
  "techniques": [
   "energy_ray",
   "normal_attack"
  ],
  "auraColor": "#16131c",
  "description": "み、見えなかった💦 ほんで強すぎ😭😭😭"
 },
 {
  "id": "gold_moai",
  "name": "金モアイ",
  "category": "threat",
  "height": 2.5,
  "heightSource": "same_body_as_moai_king",
  "levelBand": {
   "min": 20,
   "max": 100
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 15,
   "attack": 13,
   "ki": 13,
   "speed": 1
  },
  "techniques": [
   "charged_energy_ray",
   "normal_attack"
  ],
  "auraColor": "#ffc84f",
  "description": "金色のモアイ！？何だかスーパーおこていゆ状態みたいだね！仲間だね🌀 でも強い😭😭😭"
 },
 {
  "id": "dragon",
  "name": "ドラゴン",
  "category": "threat",
  "height": null,
  "levelBand": {
   "min": 30,
   "max": 100
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 10,
   "attack": 1,
   "ki": 10,
   "speed": 5
  },
  "techniques": [
   "charged_energy_ray"
  ],
  "auraColor": "#ff5545",
  "description": "普通の雰囲気のドラゴン。強そうに見えるような見えないような。でも強い。"
 }
];
export const ADDED_CREATURES=Object.freeze(Object.fromEntries(definitions.map(creature=>[creature.id,Object.freeze({...creature,levelBand:Object.freeze(creature.levelBand),spawnRegions:Object.freeze(creature.spawnRegions),spawnTimes:Object.freeze(creature.spawnTimes),ranks:Object.freeze(creature.ranks),techniques:Object.freeze(creature.techniques),additionalEffects:Object.freeze(creature.additionalEffects||[]),auraAdditionalEffects:Object.freeze(creature.auraAdditionalEffects||[])})])));
