/** Message presentation is separate from gameplay event/log types. */
export const MESSAGE_CATEGORIES=Object.freeze({
 narration:Object.freeze({id:'narration',label:'ナレーション',border:'#91b5a0',ink:'#354d43',line:'#e3eee7'}),
 experience:Object.freeze({id:'experience',label:'強化',border:'#83a8cf',ink:'#3c577a',line:'#e1eaf5'}),
 conversation:Object.freeze({id:'conversation',label:'会話',border:'#d8a6aa',ink:'#805859',line:'#f4e5e8'}),
 item:Object.freeze({id:'item',label:'アイテム獲得',border:'#caa460',ink:'#725726',line:'#f1e6cd'}),
 innerThought:Object.freeze({id:'innerThought',label:'おこていゆの心の中',border:'#ffffff',ink:'#4a5250',line:'#e4e9e7',accent:'#87958f'})
});
export function normalizeMessageCategory(category,{kind='narration'}={}){
 if(category===undefined)return kind==='speech'?'conversation':'narration';
 if(typeof category!=='string'||!Object.hasOwn(MESSAGE_CATEGORIES,category))throw new TypeError('メッセージのカテゴリが正しくありません。');
 return category;
}
export function getMessageCategory(category){return MESSAGE_CATEGORIES[normalizeMessageCategory(category)];}
/** Display punctuation belongs to the frame, not to the authored story/save. */
export function formatMessageText(text,category){
 if(category!=='innerThought'||!text)return text;
 if(text.startsWith('（')&&text.endsWith('）')){
  let depth=0;
  for(let i=0;i<text.length;i++){
   if(text[i]==='（')depth++;else if(text[i]==='）')depth--;
   if(depth===0){if(i===text.length-1)return text;break;}
  }
 }
 return '（'+text+'）';
}
export function categorizeMessage(payload={}){
 const kind=payload.kind??'narration',category=normalizeMessageCategory(payload.category,{kind}),meta=MESSAGE_CATEGORIES[category];
 const speaker=category==='innerThought'?'':category==='experience'||category==='item'?meta.label:payload.speaker??(kind==='speech'?'おこていゆ':'ナレーション');
 return {...payload,kind,category,speaker};
}
