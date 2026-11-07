import {ADDED_CREATURES} from './creature-expansion.js';
const DRAGON_PHOTO_REVISIONS={"dragon":{"creature":"5d9cea437148ad01a0e371eed388b1632e42fcb6dc46adb6821a3c36c15589e0","aura":"479ef4f64390571832b94cf45cd3c972762fbf8a128b8e55503d605de70de300"},"angry_dragon":{"creature":"63de09273c56bb1f1cf2cb077f6e38b518d220d1d2c96be0377149429aecc41a","aura":"671b55a413118181ebfb1d31d22bad65eb1dc2f57092db1f684a83e025012527"},"dark_dragon":{"creature":"082047b4083fc71867a35acf43bfee3927daea2ef34379b202529cbdf255b1d8","aura":"f371912c5203cf6216b6341d02993b8404f27fa71bd1482016397bfa76f6d2e1"},"celestial_dragon":{"creature":"79684aed46c15b851f8eadde1232e727ef8d73257a9b7246bc7e3fd16dab51ba","aura":"981e75d8ce90f33738b68213a2ca743de551dd888aa71f0c47cb06cea8a9962e"}};
export const COLLECTION_KINDS={support:'サポートもちもの',defense:'防御もちもの',aura:'オーラ'};
export const collectionThumbnail=(kind,id)=>{
 // The danger-zone guardians share one appearance; their auras share the same
 // black-aura portrait of Okoteiyu, without duplicating eighteen image files.
 if(ADDED_CREATURES[id]?.sharedAppearance==='mystery_unique'){
  if(kind==='creature')return 'assets/collection/mystery_unique.webp';
  if(kind==='aura')return 'assets/collection/aura-void_space.webp';
 }
 if(kind==='technique')return 'assets/collection/technique-'+id+'.svg';
 const url='assets/collection/'+(kind==='aura'||kind==='creature'&&id==='okoteiyu'?'aura-':'')+id+'.webp';
 const revision=DRAGON_PHOTO_REVISIONS[id]?.[kind];return revision?url+'?v='+revision:url;
};
export const CREATURE_NOTES={
 ...Object.fromEntries(Object.values(ADDED_CREATURES).map(c=>[c.id,c.description])),
 okoteiyu:'のんびりしていてアホっぽい、自称研究者。座右の銘は「惑星より大きな心」。自身も珍生物ながら、世界を護るヒーローを目指しています。',
 horarara_horaran:'大きさの違う3つの黒紫色の鬼火がまとまった珍生物。少し可愛げのあるニヤけ顔をしています。',
 moai_king:'歴戦の戦士の風格を感じる、恐ろしい珍生物。'
};
