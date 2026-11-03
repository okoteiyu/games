import {TECHNIQUES} from './technique-rules.js';

// Presentation buffer follows the existing session-event buffer; never saved.
export const BATTLE_LOG_LIMIT=120;
const numeric=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2});
const text=(value,fallback)=>typeof value==='string'&&value.trim()?value:fallback;
const amount=value=>Number.isFinite(value)?value>0&&value<.01?'0.01未満':numeric.format(value):'—';
const technique=id=>Object.hasOwn(TECHNIQUES,id)?TECHNIQUES[id].name:'攻撃';

export function battleLogNames(battle={}){
 const names=new Map([['player',text(battle.player?.name,'おこていゆ')]]),enemies=battle.enemies||[battle.enemy].filter(Boolean);
 enemies.forEach((enemy,index)=>names.set(enemy.id||'enemy',(enemies.length>1?(index+1)+'. ':'')+text(enemy.name,'珍生物')));
 for(const support of battle.supports||[battle.support].filter(Boolean))names.set(support.id,text(support.name,'助っ人'));
 return names;
}

/** Translate actual combat events only. Rendering/replay never generates rows. */
export function formatBattleLogEvent(event,names=new Map()){
 if(!event||typeof event!=='object')return null;
 const name=(id,fallback)=>names.get(id)||text(fallback,id==='player'?'おこていゆ':'珍生物');
 const actor=name(event.actor==='support'?event.supportId:event.actor,event.actorName),target=name(event.target,event.targetName);
 const team=event.actor==='player'?'player':event.actor==='support'?'support':'enemy';
 const elapsed=event.time??event.battle?.time,time=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 const entry=(kind,label,body)=>({kind,label,text:body,time,eventType:event.type});
 switch(event.type){
  case 'battle-start':return entry('system','開始',event.battle?.kind==='training'?'招待した珍生物との訓練が始まった。':'珍生物との戦闘が始まった。');
  case 'action-start':return event.technique==='super_awaken'?null:entry(team,team==='enemy'?'相手の技':'技',actor+'：'+technique(event.technique)+' → '+target);
  case 'damage':return entry(event.target==='player'?'enemy':team,event.target==='player'?'被ダメージ':event.actor==='support'?'反撃':'ダメージ',actor+' → '+target+'：'+amount(event.amount)+'ダメージ');
  case 'battle-call':return null;
  case 'battle-target':return event.target?entry('call','対象','狙う相手を'+target+'に変更。'):null;
  case 'super-requested':return null;
  case 'super-start':return entry('state','覚醒','おこていゆがスーパーおこていゆ状態になった。');
  case 'super-end':return entry('state','変化','スーパーおこていゆ状態が落ち着いた。');
  case 'support-guard':return entry('support','助っ人',actor+'が前に出てかばう。');
  case 'support-block':return entry('support','吸収',actor+'が'+name(event.attacker)+'の攻撃を吸収。');
  case 'support-counter-start':return entry('support','反撃',actor+'が反撃 → '+target);
  case 'support-heal':return entry('recovery','回復',actor+'が、おこていゆのHPを'+amount(event.amount)+'回復。');
  case 'fatigue':return entry(event.actor==='player'?'enemy':'system','疲労',name(event.actor,event.name)+'は疲れた。');
  case 'battle-end':return entry('system','終了','戦闘が終わった。');
  default:return null;
 }
}

function clock(seconds){
 const ticks=Math.floor(seconds*10+1e-6),minutes=Math.floor(ticks/600),rest=Math.floor(ticks/10)%60;
 return String(minutes).padStart(2,'0')+':'+String(rest).padStart(2,'0')+'.'+ticks%10;
}
export {clock as formatBattleLogTime};

export class BattleLog{
 constructor(container,battle){
  this.container=container;this.names=battleLogNames(battle);this.ended=false;
  this.root=document.createElement('div');this.root.className='battle-log';this.root.tabIndex=0;
  this.root.setAttribute('role','log');this.root.setAttribute('aria-label','戦闘中の行動ログ');this.root.setAttribute('aria-live','polite');this.root.setAttribute('aria-relevant','additions');
  this.list=document.createElement('ol');this.list.className='battle-log__entries';this.root.append(this.list);container.replaceChildren(this.root);
 }
 appendEvent(event){
  if(this.ended||!this.root||this.root.parentElement!==this.container)return false;
  const entry=formatBattleLogEvent(event,this.names);if(!entry)return false;
  const following=this.root.scrollHeight-this.root.clientHeight-this.root.scrollTop<=18,previousTop=this.root.scrollTop;
  const row=document.createElement('li');row.className='battle-log__entry';row.dataset.kind=entry.kind;row.dataset.eventType=entry.eventType;
  const heading=document.createElement('div');heading.className='battle-log__meta';
  const time=document.createElement('time');time.textContent=clock(entry.time);time.dateTime='PT'+entry.time.toFixed(1)+'S';
  const label=document.createElement('span');label.textContent=entry.label;heading.append(time,label);
  const body=document.createElement('p');body.textContent=entry.text;row.append(heading,body);this.list.append(row);
  let removedHeight=0;
  while(this.list.childElementCount>BATTLE_LOG_LIMIT){const first=this.list.firstElementChild;removedHeight+=first.getBoundingClientRect().height;first.remove();}
  this.root.scrollTop=following?this.root.scrollHeight:Math.max(0,previousTop-removedHeight);
  if(event.type==='battle-end')this.ended=true;
  return true;
 }
 destroy(){this.root?.remove();this.root=null;this.list=null;this.names.clear();}
}
