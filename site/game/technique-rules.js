export const TECHNIQUES=Object.freeze({
 charged_punch:Object.freeze({id:'charged_punch',maxLevel:30,name:'溜めパンチ',duration:1.5,motion:'punch',description:'力を溜め、全身を使って放つ重いストレート。',power:'攻撃力 × 2.5 ＋ 技レベル'}),
 charged_energy_ray:Object.freeze({id:'charged_energy_ray',maxLevel:30,name:'溜めエネルギーレイ',duration:2,motion:'energy_ray',description:'気を溜め、頭の前から強い光線を放つ。',power:'気 × 3 ＋ 技レベル'}),
 energy_punch:Object.freeze({id:'energy_punch',maxLevel:30,name:'エネルギーパンチ',duration:1,motion:'punch',description:'全身の力と気を合わせて放つストレート。',power:'（攻撃力 ＋ 気） ＋ 技レベル'}),
 punch:Object.freeze({id:'punch',maxLevel:30,name:'パンチ',duration:.5,description:'全身の力を使って放つストレート。',power:'攻撃力 ＋ この技のレベル'}),
 energy_ray:Object.freeze({id:'energy_ray',maxLevel:30,name:'エネルギーレイ',duration:.8,description:'頭の前から明るい太い光線を放つ、気を使う攻撃。',power:'気 × 1.1 ＋ この技のレベル'}),
 normal_attack:Object.freeze({id:'normal_attack',maxLevel:30,name:'通常攻撃',duration:.5,description:'自身の体を使う基本的な攻撃。',power:'攻撃力 × 0.8 ＋ この技のレベル'}),
 enemy_attack:Object.freeze({id:'enemy_attack',maxLevel:30,name:'共通攻撃',duration:.5,description:'体全体を一瞬前へ動かし、すぐに元の位置へ戻る攻撃。',power:'攻撃力をそのまま威力にする'})
});
export const ADDED_TECHNIQUE_IDS=Object.freeze(['charged_punch','charged_energy_ray','energy_punch']);
export const PLAYER_TECHNIQUE_IDS=Object.freeze(['punch','energy_ray',...ADDED_TECHNIQUE_IDS]);
export const SUPER_MAX_LEVEL=100;
export function techniqueMaxLevel(id,definitions=TECHNIQUES){const max=definitions[id]?.maxLevel;if(!Number.isSafeInteger(max)||max<1)throw new RangeError('技の最大レベルが設定されていません。');return max;}
export function clampTechniqueLevel(id,level,definitions=TECHNIQUES){if(!Number.isSafeInteger(level)||level<1)throw new RangeError('技レベルが正しくありません。');return Math.min(level,techniqueMaxLevel(id,definitions));}
export function playerTechniqueLevel(player,id){return clampTechniqueLevel(id,id==='punch'?(player.punchLevel??1):id==='energy_ray'?(player.energyRayLevel??1):(player.techniqueLevels?.[id]??1));}
export function techniquePower(id,stats,level){
 level=clampTechniqueLevel(id,level);
 if(id==='charged_punch')return stats.attack*2.5+level;
 if(id==='charged_energy_ray')return stats.ki*3+level;
 if(id==='energy_punch')return stats.attack+stats.ki+level;
 if(id==='energy_ray')return stats.ki*1.1+level;
 if(id==='normal_attack')return stats.attack*.8+level;
 if(id==='punch')return stats.attack+level;
 if(id==='enemy_attack')return stats.attack;
 throw new RangeError('不明な技です。');
}
export const SUPER_CONFIGURATIONS=Object.freeze({none:Object.freeze({id:'none',label:'なし',prefix:''})});
export const availableTechniqueIds=player=>['punch',...(player?.energyRayUnlocked?['energy_ray']:[]),...ADDED_TECHNIQUE_IDS.filter(id=>player?.unlockedTechniques?.includes(id))];
export function defaultTechniqueSlots(player){return ['punch',player?.energyRayUnlocked?'energy_ray':null,null];}
export function validateTechniqueSlots(slots,player){
 if(!Array.isArray(slots)||slots.length!==3||!slots.some(Boolean)||slots.some(id=>id!==null&&!availableTechniqueIds(player).includes(id))||new Set(slots.filter(Boolean)).size!==slots.filter(Boolean).length)throw new TypeError('技スロットが正しくありません。');
 return [...slots];
}
export function superStateDetails(player){
 const id=player?.superConfiguration||'none',configuration=SUPER_CONFIGURATIONS[id];if(!configuration)throw new TypeError('スーパーおこていゆ状態の設定が正しくありません。');
 const level=Math.min(SUPER_MAX_LEVEL,player?.superLevel||1);return {configuration:id,configurationLabel:configuration.label,prefix:configuration.prefix,name:configuration.prefix+'スーパーおこていゆ状態',level,maxLevel:SUPER_MAX_LEVEL,multiplier:Number((1.5+level/50).toFixed(2)),duration:Number((8+level/10).toFixed(2))};
}
