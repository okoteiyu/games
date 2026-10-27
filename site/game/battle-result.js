/** Results are presented during the cutin, using the settled battle rewards. */
export function battleResultMessage(battle){
 const rewards=battle?.rewards||{},items=rewards.auras||[rewards.aura].filter(Boolean),counts=new Map();
 for(const item of items){const name=item.name||'アイテム';counts.set(name,(counts.get(name)||0)+1);}
 const inventory=[...counts].map(([name,count])=>name+(count>1?'×'+count:'')).join('、');
 return {type:battle?.result==='win'?'growth':'enemy',speaker:'ナレーション',kind:'narration',text:(battle?.result==='win'?'相手は疲れた。':'おこていゆは疲れた。')+(rewards.experience>0?'経験値を獲得しました。':'経験値の獲得はありません。')+'\n入手アイテム：'+(inventory||'なし')+'。'};
}
