export const TECHNIQUES=Object.freeze({
 charged_punch:Object.freeze({id:'charged_punch',maxLevel:30,name:'溜めパンチ',duration:1.5,motion:'punch',description:'力を溜め、全身を使って放つ重いストレート。',power:'攻撃力 × 2.5 ＋ 技レベル'}),
 charged_energy_ray:Object.freeze({id:'charged_energy_ray',maxLevel:30,name:'溜めエネルギーレイ',duration:2,motion:'energy_ray',description:'気を溜め、頭の前から強い光線を放つ。',power:'気 × 3 ＋ 技レベル'}),
 energy_punch:Object.freeze({id:'energy_punch',maxLevel:30,name:'エネルギーパンチ',duration:1,motion:'punch',description:'全身の力と気を合わせて放つストレート。',power:'（攻撃力 ＋ 気） ＋ 技レベル'}),
 punch:Object.freeze({id:'punch',maxLevel:30,name:'パンチ',duration:.5,description:'全身の力を使って放つストレート。',power:'攻撃力 ＋ この技のレベル'}),
 energy_ray:Object.freeze({id:'energy_ray',maxLevel:30,name:'エネルギーレイ',duration:.8,description:'頭の前から明るい太い光線を放つ、気を使う攻撃。',power:'気 × 1.1 ＋ この技のレベル'}),
 normal_attack:Object.freeze({id:'normal_attack',maxLevel:30,name:'通常攻撃',duration:.5,description:'自身の体を使う基本的な攻撃。',power:'攻撃力 ＋ この技のレベル'}),
 cannon_shell:Object.freeze({id:'cannon_shell',maxLevel:50,name:'砲撃',duration:2,motion:'common_attack',effect:'shell',description:'体を動かして、勢いよく砲弾を放つ攻撃。',power:'攻撃力 × 3 ＋ 技レベル × 5'}),
 void_wave:Object.freeze({id:'void_wave',maxLevel:1,name:'ヴォイドウェーブ',duration:2,motion:'common_attack',effect:'void_wave',description:'漆黒の波を放つ、気を使う攻撃。',power:'気 × 4'}),
 cosmos_wave:Object.freeze({id:'cosmos_wave',maxLevel:1,name:'コスモスウェーブ',duration:2,motion:'common_attack',effect:'cosmos_wave',description:'華やかな虹色の波を放つ、気を使う攻撃。',power:'気 × 4'}),
 enemy_attack:Object.freeze({id:'enemy_attack',maxLevel:30,name:'共通攻撃',duration:.5,description:'体全体を一瞬前へ動かし、すぐに元の位置へ戻る攻撃。',power:'攻撃力をそのまま威力にする'})
});
export const ADDED_TECHNIQUE_IDS=Object.freeze(['charged_punch','charged_energy_ray','energy_punch','void_wave','cosmos_wave','cannon_shell']);
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
 if(id==='normal_attack'||id==='punch')return stats.attack+level;
 if(id==='cannon_shell')return stats.attack*3+5*level;
 if(id==='void_wave'||id==='cosmos_wave')return stats.ki*4;
 if(id==='enemy_attack')return stats.attack;
 throw new RangeError('不明な技です。');
}
export const SUPER_CONFIGURATIONS=Object.freeze({none:Object.freeze({id:'none',label:'なし',prefix:'',additionalEffects:Object.freeze([])})});
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
