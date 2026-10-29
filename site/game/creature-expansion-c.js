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
  "description": "おこていゆはクルクルしたものが好きだけど、こいつはあんまりかな😢",
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
  "description": "そこら辺の岩かと思って蹴ってたら怒らせちゃった。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "eleki_kun",
  "name": "エレキくん",
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
  "description": "ビームを撃つ為だけに作られたみたいな体してる！！！",
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
  "description": "ただでさえ強いのに... 一応珍生物らしい",
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
  "description": "こんなのがうちの近くに居たなんて💦",
  "additionalEffects": [],
  "auraAdditionalEffects": [],
  "auraEmphasis": true
 },
 {
  "id": "star_soul",
  "name": "星の塊",
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
  "description": "星ってこんな形なんだ！",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "void_space",
  "name": "黒丸",
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
  "description": "黒い丸です。ちなみに強いです。",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "perfect_cosmos",
  "name": "虹のやつ",
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
  "description": "なんかもう、そう呼ぶしかなくない！？と思いました☺️",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 },
 {
  "id": "chaos",
  "name": "カオス君",
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
  "description": "見た目がカオス💦 あんまり触りたくない😢",
  "additionalEffects": [],
  "auraAdditionalEffects": []
 }
];
