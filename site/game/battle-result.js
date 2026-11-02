/** Settled rewards are delivered in distinct, user-advanced message frames. */
const message=(category,text,extra={})=>({type:category==='narration'?'daily':'growth',speaker:'ナレーション',kind:'narration',category,text,...extra});

export function superUnlockMessage(unlock){
 return message('item',unlock.name+'を取得した！ コレクションの「技」から設定できます。',{acquisitionId:unlock.acquisitionId||'super-configuration:'+unlock.id,superUnlockId:unlock.id});
}

export function battleResultMessages(battle,{superUnlocks=battle?.rewards?.superUnlocks||[]}={}){
 const rewards=battle?.rewards||{},items=rewards.auras||[rewards.aura].filter(Boolean),counts=new Map(),auraGrowth=new Map();
 const result=[message('narration',battle?.result==='win'?'相手は疲れた。':'おこていゆは疲れた。')];
 if(rewards.experience>0)result.push(message('experience','経験値を'+(Math.floor(rewards.experience*10)/10)+'獲得しました。'));
 if(rewards.levelsGained>0)result.push(message('experience','おこていゆのレベルが'+rewards.level+'になった！'));
 for(const change of rewards.techniqueChanges||[]){
  result.push(message(change.newlyLearned?'item':'experience',change.newlyLearned?change.name+'を取得した！ コレクションの「技」から設定できます。':change.name+'のレベルが'+change.level+'に上がった！'));
 }
 for(const item of items){
  const name=item.name||'アイテム';counts.set(name,(counts.get(name)||0)+1);
  if(item.levelsGained>0)auraGrowth.set(name,Math.max(item.level,auraGrowth.get(name)||0));
 }
 for(const [name,count]of counts){
  result.push(message('item',name+(count>1?'を'+count+'個':'を')+'取得しました。'));
  if(auraGrowth.has(name))result.push(message('experience',name+'のレベルが'+auraGrowth.get(name)+'に上がった！'));
 }
 const seen=new Set();
 for(const unlock of superUnlocks){if(!unlock?.id||seen.has(unlock.id))continue;seen.add(unlock.id);result.push(superUnlockMessage(unlock));}
 return result;
}

/** Retained for read-only consumers; the runtime uses the complete sequence. */
export function battleResultMessage(battle){return battleResultMessages(battle)[0];}
