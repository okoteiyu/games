import {ADDED_CREATURES} from './creature-expansion.js';
const CREATURE_PHOTO_REVISIONS={"dragon":{"creature":"0966700e74f7ec171353a2e403e510f4488707130da23201e9dca1ec0893339a","aura":"f97607f2b97856603da08cd2a4cb599eaf7ed8f14e373c29d02d0ffe435c17bf"},"angry_dragon":{"creature":"24ea46dcb0718aacc5ad8a511ff9d2c9cded36bbc4da7eb0f1a3f43839ea2a28","aura":"d920d405dbe99b9c62ea02b58572b02f87a5437b17c297a832b2ad17e22e7de0"},"dark_dragon":{"creature":"43b4216a78987fd14d8c4beb3e91181f10346065a2f0ca9ccb1c367f859b87f8","aura":"2e584b58376f00ffb3c9a3caafd7862a8bf506b384ff8855d64c5f1bd7dfe5a1"},"celestial_dragon":{"creature":"bb3191e77efaa5550570bb628c9431e89c855685fa8309859ccc8a1cb8cd4943","aura":"74ad6beefb7022bc25554863b3a13476bc1590785c99bd4edc5837bc9e3b2064"},"dark_domain_king":{"creature":"7f5e09b132467a5f3420a00892b5b4a6f1e3e769fd7a03d07684550d5c7ef54d","aura":"66602c1fce3306d21143e426f1131b1bae13a9cd3ed5e769f16725081ec4aa60"},"great_beast_lord":{"creature":"70d3ce3f569e84a24bc8f29f615ec1041c3cc336a8989155ac2ee681f7f04a73"}};
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
 const revision=CREATURE_PHOTO_REVISIONS[id]?.[kind];return revision?url+'?v='+revision:url;
};
export const CREATURE_NOTES={
 ...Object.fromEntries(Object.values(ADDED_CREATURES).map(c=>[c.id,c.description])),
 okoteiyu:'のんびりしていてアホっぽい、自称研究者。座右の銘は「惑星より大きな心」。自身も珍生物ながら、世界を護るヒーローを目指しています。',
 horarara_horaran:'大きさの違う3つの黒紫色の鬼火がまとまった珍生物。少し可愛げのあるニヤけ顔をしています。',
 moai_king:'歴戦の戦士の風格を感じる、恐ろしい珍生物。'
};
