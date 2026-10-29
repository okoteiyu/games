import {NEW_CREATURE_DEFINITIONS} from './creature-expansion-c.js';
/** Confirmed species settings. Null heights remain undecided; GLBs carry separate authoring dimensions. */
const definitions=[...NEW_CREATURE_DEFINITIONS,
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
