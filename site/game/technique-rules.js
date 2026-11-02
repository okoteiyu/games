export const TECHNIQUES=Object.freeze({
 fake_moai_beam:Object.freeze({id:'fake_moai_beam',name:'偽モアイビーム',description:'怪しい見た目のビーム',maxLevel:10,duration:3,motion:'common_attack',effect:'fake_moai_beam',power:'気 × 3 ＋ 技レベル × 20'}),
 tackle:Object.freeze({id:'tackle',maxLevel:30,name:'タックル',duration:1,motion:'tackle',effect:'tackle_impact',description:'自身の体を相手にぶつけて攻撃する。',power:'攻撃力 × 1.5 ＋ 技レベル × 10'}),
 charged_punch:Object.freeze({id:'charged_punch',maxLevel:30,name:'溜めパンチ',duration:1.5,motion:'punch',description:'力を溜め、全身を使って放つ重いストレート。',power:'攻撃力 × 2.5 ＋ 技レベル'}),
 charged_energy_ray:Object.freeze({id:'charged_energy_ray',maxLevel:30,name:'溜めエネルギーレイ',duration:2,motion:'energy_ray',description:'気を溜め、頭の前から強い光線を放つ。',power:'気 × 3 ＋ 技レベル'}),
 energy_punch:Object.freeze({id:'energy_punch',maxLevel:30,name:'エネルギーパンチ',duration:1,motion:'punch',description:'全身の力と気を合わせて放つストレート。',power:'（攻撃力 ＋ 気） ＋ 技レベル'}),
 punch:Object.freeze({id:'punch',maxLevel:30,name:'パンチ',duration:.5,description:'全身の力を使って放つストレート。',power:'攻撃力 ＋ この技のレベル'}),
 energy_ray:Object.freeze({id:'energy_ray',maxLevel:30,name:'エネルギーレイ',duration:.8,description:'頭の前から明るい太い光線を放つ、気を使う攻撃。',power:'気 × 1.1 ＋ この技のレベル'}),
 okoteiyu_beam:Object.freeze({id:'okoteiyu_beam',maxLevel:5,name:'おこていゆビーム',duration:2,motion:'energy_ray',effect:'okoteiyu_beam',description:'おこていゆの専用技。猛烈な修行の末に生み出した！！',acquisitionDescription:'キャラレベル10で習得し、以後10レベルごとに強くなります。技レベルは最大5です。',power:'気 × 1.5 ＋ 技レベル × 100',additionalEffects:Object.freeze([Object.freeze({type:'next_attack_damage_multiplier',multiplier:.5,description:'当てた相手の次の攻撃で与えるダメージを半分にします。重ねがけできます。'})])}),
 normal_attack:Object.freeze({id:'normal_attack',maxLevel:30,name:'通常攻撃',duration:.5,description:'自身の体を使う基本的な攻撃。',power:'攻撃力 ＋ この技のレベル'}),
 cannon_shell:Object.freeze({id:'cannon_shell',maxLevel:50,name:'砲撃',duration:2,motion:'common_attack',effect:'shell',description:'体を動かして、勢いよく砲弾を放つ攻撃。',power:'攻撃力 × 3 ＋ 技レベル × 5'}),
 void_wave:Object.freeze({id:'void_wave',maxLevel:1,name:'ヴォイドウェーブ',duration:4,motion:'common_attack',effect:'void_wave',description:'漆黒の波を放つ、気を使う攻撃。',power:'気 × 4'}),
 cosmos_wave:Object.freeze({id:'cosmos_wave',maxLevel:1,name:'コスモスウェーブ',duration:4,motion:'common_attack',effect:'cosmos_wave',description:'華やかな虹色の波を放つ、気を使う攻撃。',power:'気 × 4'}),
 chaos_wave:Object.freeze({id:'chaos_wave',maxLevel:1,name:'カオスウェーブ',duration:4,motion:'common_attack',effect:'chaos_wave',description:'攻撃力と気を合わせ、青・紫・白・黒の混沌とした波を放つ攻撃。',power:'（攻撃力 ＋ 気） × 2'})
});
/** Accepted relative ratings for presentation only; technique levels and battle
 * calculations do not use these values. */
export const TECHNIQUE_RANKS=Object.freeze({
 punch:4,normal_attack:4,energy_ray:3,charged_punch:8,charged_energy_ray:7,
 energy_punch:7,tackle:9,okoteiyu_beam:10,cannon_shell:9,fake_moai_beam:7,
 void_wave:5,cosmos_wave:5,chaos_wave:6
});
export const TECHNIQUE_MOTION_LIMITS=Object.freeze({min:.5,max:10});
export function techniqueDuration(id,definitions=TECHNIQUES){
 const duration=definitions[id]?.duration;
 if(!Number.isFinite(duration)||duration<TECHNIQUE_MOTION_LIMITS.min||duration>TECHNIQUE_MOTION_LIMITS.max)throw new RangeError('技モーションの時間は0.5〜10秒で設定してください。');
 return duration;
}
export const ADDED_TECHNIQUE_IDS=Object.freeze(['charged_punch','charged_energy_ray','energy_punch','void_wave','cosmos_wave','cannon_shell','chaos_wave','okoteiyu_beam','tackle']);
export const PLAYER_TECHNIQUE_IDS=Object.freeze(['punch','energy_ray',...ADDED_TECHNIQUE_IDS]);
export {SUPER_MAX_LEVEL,SUPER_CONFIGURATIONS,superStateDetails,superConfigurationLevel,superConfigurationMaxLevel,availableSuperConfigurationIds} from './super-prefix-rules.js';
export function techniqueMaxLevel(id,definitions=TECHNIQUES){const max=definitions[id]?.maxLevel;if(!Number.isSafeInteger(max)||max<1)throw new RangeError('技の最大レベルが設定されていません。');return max;}
export function clampTechniqueLevel(id,level,definitions=TECHNIQUES){if(!Number.isSafeInteger(level)||level<1)throw new RangeError('技レベルが正しくありません。');return Math.min(level,techniqueMaxLevel(id,definitions));}
export function playerTechniqueLevel(player,id){return clampTechniqueLevel(id,id==='punch'?(player.punchLevel??1):id==='energy_ray'?(player.energyRayLevel??1):(player.techniqueLevels?.[id]??1));}
/** Character-level techniques are granted without changing the chosen slots. */
export function syncLevelTechniques(player){
 if(player.level>=10){
  if(!player.unlockedTechniques.includes('okoteiyu_beam'))player.unlockedTechniques.push('okoteiyu_beam');
  player.techniqueLevels.okoteiyu_beam=Math.min(techniqueMaxLevel('okoteiyu_beam'),Math.floor(player.level/10));
 }
 return player;
}
export function techniquePower(id,stats,level){
 level=clampTechniqueLevel(id,level);
 if(id==='fake_moai_beam')return stats.ki*3+level*20;
 if(id==='tackle')return stats.attack*1.5+level*10;
 if(id==='charged_punch')return stats.attack*2.5+level;
 if(id==='charged_energy_ray')return stats.ki*3+level;
 if(id==='energy_punch')return stats.attack+stats.ki+level;
 if(id==='energy_ray')return stats.ki*1.1+level;
 if(id==='okoteiyu_beam')return stats.ki*1.5+100*level;
 if(id==='normal_attack'||id==='punch')return stats.attack+level;
 if(id==='cannon_shell')return stats.attack*3+5*level;
 if(id==='void_wave'||id==='cosmos_wave')return stats.ki*4;
 if(id==='chaos_wave')return (stats.attack+stats.ki)*2;
 throw new RangeError('不明な技です。');
}
export const availableTechniqueIds=player=>['punch',...(player?.energyRayUnlocked?['energy_ray']:[]),...ADDED_TECHNIQUE_IDS.filter(id=>player?.unlockedTechniques?.includes(id)&&(id!=='okoteiyu_beam'||player.level>=10))];
export function defaultTechniqueSlots(player){return ['punch',player?.energyRayUnlocked?'energy_ray':null,null];}
export function validateTechniqueSlots(slots,player){
 if(!Array.isArray(slots)||slots.length!==3||!slots.some(Boolean)||slots.some(id=>id!==null&&!availableTechniqueIds(player).includes(id))||new Set(slots.filter(Boolean)).size!==slots.filter(Boolean).length)throw new TypeError('技スロットが正しくありません。');
 return [...slots];
}
