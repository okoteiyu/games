import {ADDED_CREATURES} from './creature-expansion.js';
export const COLLECTION_KINDS={support:'サポートもちもの',defense:'防御もちもの',aura:'オーラ'};
export const collectionThumbnail=(kind,id)=>{
 if(kind==='technique')return 'assets/collection/technique-'+id+'.svg';
 return 'assets/collection/'+(kind==='aura'||kind==='creature'&&id==='okoteiyu'?'aura-':'')+id+'.webp';
};
export const CREATURE_NOTES={
 ...Object.fromEntries(Object.values(ADDED_CREATURES).map(c=>[c.id,c.description])),
 okoteiyu:'のんびりしていてアホっぽい、自称研究者。座右の銘は「惑星より大きな心」。自身も珍生物ながら、世界を護るヒーローを目指しています。',
 horarara_horaran:'大きさの違う3つの黒紫色の鬼火がまとまった珍生物。少し可愛げのあるニヤけ顔をしています。',
 moai_king:'歴戦の戦士の風格を感じる、恐ろしい珍生物。'
};
