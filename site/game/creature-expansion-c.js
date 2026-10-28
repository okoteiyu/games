/** Confirmed species. Heights are in metres; level limits are inclusive. */
export const NEW_CREATURE_DEFINITIONS=[
 {
  "id": "wind_kurukuru",
  "name": "風のクルクル",
  "category": "normal",
  "height": 0.4,
  "levelBand": {
   "min": 5,
   "max": 40
  },
  "spawnRegions": [
   "forest"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 5,
   "attack": 5,
   "ki": 5,
   "speed": 13
  },
  "techniques": [
   "normal_attack"
  ],
  "auraColor": "#c1e5a6",
  "description": "小さな竜巻の渦の中心に目をもつ珍生物。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "steel_maru",
  "name": "鋼丸",
  "category": "normal",
  "height": 0.5,
  "levelBand": {
   "min": 5,
   "max": 50
  },
  "spawnRegions": [
   "residential"
  ],
  "spawnTimes": [
   "night"
  ],
  "ranks": {
   "hp": 15,
   "attack": 1,
   "ki": 7,
   "speed": 0
  },
  "techniques": [
   "energy_ray",
   "charged_energy_ray"
  ],
  "auraColor": "#999da4",
  "description": "メタリックな正十二面体に、ふたつの目をもつ珍生物。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "eleki_kun",
  "name": "エレキ君",
  "category": "normal",
  "height": 0.8,
  "levelBand": {
   "min": 15,
   "max": 60
  },
  "spawnRegions": [
   "residential"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 8,
   "attack": 1,
   "ki": 8,
   "speed": 5
  },
  "techniques": [
   "energy_ray",
   "charged_energy_ray"
  ],
  "auraColor": "#ffe34a",
  "description": "電気をまとった、銀色の3脚付きオービスの姿の珍生物。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "armored_tank",
  "name": "堅牢な自力移動戦車",
  "category": "threat",
  "height": 1.8,
  "levelBand": {
   "min": 20,
   "max": 80
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
   "hp": 12,
   "attack": 11,
   "ki": 0,
   "speed": 7
  },
  "techniques": [
   "cannon_shell"
  ],
  "auraColor": "#080a10",
  "description": "シンプルでシャープな、黒色の自力移動戦車。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "railway_cannon",
  "name": "自力移動列車砲",
  "category": "threat",
  "height": 5,
  "levelBand": {
   "min": 30,
   "max": 100
  },
  "spawnRegions": [
   "residential"
  ],
  "spawnTimes": [
   "day",
   "night"
  ],
  "ranks": {
   "hp": 15,
   "attack": 15,
   "ki": 0,
   "speed": 3
  },
  "techniques": [
   "cannon_shell",
   "energy_ray"
  ],
  "auraColor": "#d4a735",
  "auraPalette": [
   "#08090e",
   "#ffd350",
   "#08090e",
   "#f7bf32"
  ],
  "description": "黒く鋭い輪郭をもつ、巨大な自力移動列車砲。",
  "additionalEffects": [],
  "auraAdditionalEffects": [],
  "auraEmphasis": true
 },
 {
  "id": "star_soul",
  "name": "星の魂",
  "category": "normal",
  "height": 0.35,
  "levelBand": {
   "min": 5,
   "max": 100
  },
  "spawnRegions": [
   "forest",
   "residential",
   "city"
  ],
  "spawnTimes": [
   "night"
  ],
  "ranks": {
   "hp": 6,
   "attack": 3,
   "ki": 7,
   "speed": 9
  },
  "techniques": [
   "normal_attack",
   "energy_ray"
  ],
  "auraColor": "#ffffff",
  "auraPalette": [
   "#ff7092",
   "#ffcc56",
   "#b0ec79",
   "#56e0e2",
   "#849bff",
   "#dc8aff"
  ],
  "description": "顔をもたない、シンプルな星型の珍生物。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "void_space",
  "name": "ヴォイドスペース",
  "category": "threat",
  "height": 0.8,
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
   "hp": 15,
   "attack": 0,
   "ki": 15,
   "speed": 0
  },
  "techniques": [
   "void_wave"
  ],
  "auraColor": "#030308",
  "auraEmphasis": true,
  "description": "顔も模様もない、真っ黒な真球の珍生物。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "perfect_cosmos",
  "name": "Perfect Cosmos",
  "category": "threat",
  "height": 1.5,
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
   "hp": 15,
   "attack": 0,
   "ki": 15,
   "speed": 0
  },
  "techniques": [
   "cosmos_wave"
  ],
  "auraColor": "#ffffff",
  "auraPalette": [
   "#ff719d",
   "#ffd966",
   "#b2f68f",
   "#68eaf1",
   "#9496ff",
   "#e48cff"
  ],
  "auraEmphasis": true,
  "description": "顔をもたない、鮮やかな青・シアン・紫がはっきり見える、柔らかく低密度のモヤの塊。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "chaos",
  "name": "カオス",
  "category": "threat",
  "height": 0.8,
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
   "hp": 10,
   "attack": 10,
   "ki": 10,
   "speed": 0
  },
  "techniques": [
   "chaos_wave"
  ],
  "auraColor": "#7728c4",
  "auraPalette": [
   "#08090e",
   "#7728c4",
   "#08090e",
   "#5b15a7"
  ],
  "description": "混沌とした禍々しい雰囲気を感じる、恐ろしい珍生物。黒・紫・青・白の渦巻く模様をもつ、モヤ状の真球。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 }
];
