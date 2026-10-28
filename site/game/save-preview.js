import {CREATURES,CREATURE_CATEGORIES,SUPPORT_ITEMS,DEFENSE_ITEMS} from './game-session.js';
import {availableTechniqueIds} from './technique-rules.js';

/** Describe the validated file being inspected, without using live progress. */
export function describeSaveProgress(state){
 const player=state.prototype?.session?.player;
 if(!player)return {rows:[['おこていゆのレベル','記録なし'],['サポートもちもの','記録なし'],['防御もちもの','記録なし'],['オーラ','記録なし'],['習得済みの技','記録なし'],['記録帳の珍生物','記録なし']],inventory:[],missingGameData:true};
 const support=player.ownedItems.support,defense=player.ownedItems.defense,auras=Object.entries(player.auras);
 // Match the journal: self is always listed, and opponents need an encounter.
 const recorded=Object.entries(CREATURES).filter(([id,creature])=>id==='okoteiyu'||Object.hasOwn(CREATURE_CATEGORIES,creature.category)&&(player.journal[id]?.encounters||0)>0).length;
 const items=(ids,definitions)=>ids.map(id=>({name:definitions[id].name,quantity:'1個'}));
 return {
  rows:[['あなたの名前',state.prototype.session.visitorName||'未登録'],['おこていゆのレベル','Lv.'+player.level],['サポートもちもの',support.length+'種類'],['防御もちもの',defense.length+'種類'],['オーラ',auras.length+'種類'],['習得済みの技',availableTechniqueIds(player).length+'種類'],['記録帳の珍生物',recorded+'種類（おこていゆを含む）']],
  inventory:[
   {label:'サポートもちもの',items:items(support,SUPPORT_ITEMS)},
   {label:'防御もちもの',items:items(defense,DEFENSE_ITEMS)},
   {label:'オーラ',items:auras.map(([id,aura])=>({name:CREATURES[id].name+'のオーラ',quantity:'Lv.'+aura.level+' · 累計'+aura.copies+'個'}))}
  ],
  missingGameData:false
 };
}
