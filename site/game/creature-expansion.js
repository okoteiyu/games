/** R067 confirmed species settings. Null heights remain undecided; GLBs carry separate authoring dimensions. */
const definitions=[
 {
  "id": "fae_dragon",
  "name": "妖竜",
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
  "description": "小さな体に怪しげな雰囲気をまとう、紫色のドラゴン。"
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
  "description": "黒くぼやけた輪郭をもつ騎士の珍生物。"
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
  "description": "明るいピンク色のスライム。2本の柔らかな触角をもっています。"
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
  "description": "水色のクリスタルのような全身をもつ、二足歩行の猿のような珍生物。"
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
  "description": "体全体がぼやけた、黒いモヤの塊。"
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
  "description": "体全体がぼやけた、黒いモヤの塊。"
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
  "description": "体全体がぼやけた、黒いモヤの塊。"
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
  "description": "モアイの戦士と同じ体をもつ、金色の珍生物。"
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
  "description": "赤い体をもつドラゴンの珍生物。"
 }
];
export const ADDED_CREATURES=Object.freeze(Object.fromEntries(definitions.map(creature=>[creature.id,Object.freeze({...creature,levelBand:Object.freeze(creature.levelBand),spawnRegions:Object.freeze(creature.spawnRegions),spawnTimes:Object.freeze(creature.spawnTimes),ranks:Object.freeze(creature.ranks),techniques:Object.freeze(creature.techniques)})])));
