import {battleLogNames,formatBattleLogEvent,formatBattleLogTime,BATTLE_LOG_LIMIT} from './battle-log.js';
import {superUnlockMessage} from './battle-result.js';
import {CAMP_SUPPLIES} from './camp-rules.js';
const decimals=n=>Math.floor((Number(n)||0)*10)/10;
const kinds={departure:'出発',arrive:'探索',weather:'天候',wildlife:'出来事',survival:'野営',night:'夜',heal:'回復',supply:'物資',guardian:'最終地点',failed:'帰り支度',finish:'帰り支度'};
/** Continuous expedition log; battle rows retain the established formatting. */
export class CampLog{
 constructor(container){this.container=container;this.names=new Map();this.root=document.createElement('div');this.root.className='battle-log camp-log';this.root.tabIndex=0;this.root.setAttribute('role','log');this.root.setAttribute('aria-label','キャンプと戦闘の行動ログ');this.root.setAttribute('aria-live','polite');this.root.setAttribute('aria-relevant','additions');this.list=document.createElement('ol');this.list.className='battle-log__entries';this.root.append(this.list);container.replaceChildren(this.root);}
 appendEvent(event){
  if(!event||!this.root.isConnected)return false;
  if(event.type==='battle-start'){this.names=battleLogNames(event.battle);return this.appendBattle(event);}
  if(!kinds[event.type]&&event.type!=='battle-rewards')return this.appendBattle(event);
  const day=event.day||1;let text='';
  switch(event.type){
   case 'departure':text='あなたとおこていゆは、未開の地へ出発した。';break;
   case 'arrive':text=event.newlyDiscovered?'新しい場所にたどり着いた。':'道を確かめながら、先へ進んだ。';break;
   case 'weather':text='雨が降ってきた。次の移動は、少しゆっくり。';break;
   case 'wildlife':text=event.consumedFood?'野生生物に、携帯食料をひとつ持っていかれた。':'野生生物がバッグをのぞきに来た。';break;
   case 'survival':if(!event.extended)return false;text='サバイバルキットを活用し、もう1日分の備えができた。';break;
   case 'night':text='今日はここで野営。ふたりで、ひと休み。';break;
   case 'heal':text='医療キットで、HPが'+decimals(event.amount)+'回復した。';break;
   case 'supply':text=(CAMP_SUPPLIES[event.supplyId]?.name||'物資')+'を'+event.amount+'個使った。';break;
   case 'guardian':text=event.name+'が、この場所で待っている。';break;
   case 'failed':text='おこていゆは疲れた。今回のキャンプを終えることにした。';break;
   case 'finish':text='今回のキャンプを終えた。';break;
   case 'battle-rewards':{
    const r=event.rewards||{};if(r.experience>0)this.add('growth','強化','経験値を'+decimals(r.experience)+'得た。',day);
    if(r.levelsGained>0)this.add('growth','強化','おこていゆのレベルが'+r.level+'になった。',day);
    for(const aura of r.auras||[])this.add('recovery','獲得',aura.name+(aura.first?'を手に入れた。':'を手に入れ、オーラを強化した。'),day);
    for(const unlock of r.superUnlocks||[])this.add('recovery','獲得',superUnlockMessage(unlock).text,day);
    for(const t of r.techniqueChanges||[])this.add('growth','強化',t.name+(t.newlyLearned?'を使えるようになった。':'が強くなった。'),day);
    return true;
   }
  }
  return this.add(event.type==='heal'?'recovery':'system',kinds[event.type],text,day);
 }
 appendBattle(event){const row=formatBattleLogEvent(event,this.names);return row?this.add(row.kind,row.label,row.text,null,row):false;}
 add(kind,label,text,day,battleEntry=null){
  if(!text)return false;
  const following=this.root.scrollHeight-this.root.clientHeight-this.root.scrollTop<=18,previousTop=this.root.scrollTop;
  const row=document.createElement('li');row.className='battle-log__entry';row.dataset.kind=kind;if(battleEntry)row.dataset.eventType=battleEntry.eventType;
  const heading=document.createElement('div');heading.className='battle-log__meta';
  if(battleEntry){const time=document.createElement('time');time.textContent=formatBattleLogTime(battleEntry.time);time.dateTime='PT'+battleEntry.time.toFixed(1)+'S';heading.append(time);}
  const tag=document.createElement('span');tag.textContent=(day?day+'日目 · ':'')+label;heading.append(tag);
  const body=document.createElement('p');body.textContent=text;row.append(heading,body);this.list.append(row);
  let removedHeight=0;while(this.list.childElementCount>BATTLE_LOG_LIMIT){const first=this.list.firstElementChild;removedHeight+=first.getBoundingClientRect().height;first.remove();}
  this.root.scrollTop=following?this.root.scrollHeight:Math.max(0,previousTop-removedHeight);return true;
 }
 destroy(){this.root.remove();}
}
