import { getRankProgress, normalizeRankPoints } from './rank-progress.js';
import { isModalBlocked, tryOpenModal, releaseModal } from './modal-layer.js';
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};

export class RankHint {
 constructor({trigger,game,readRank,experienceTrigger=document.querySelector('#experienceTrigger'),calmTrigger=document.querySelector('#calmTrigger'),angerTrigger=document.querySelector('#angerTrigger'),readGauges=()=>({experience:0,anger:0})}) {
  this.trigger=trigger;this.game=game;this.readRank=readRank;this.readGauges=readGauges;this.points=null;this.kind='rank';this.activeTrigger=trigger;
  this.triggers={rank:trigger,experience:experienceTrigger,calm:calmTrigger,anger:angerTrigger};
  this.element=node('dialog',undefined,'rank-hint');this.element.id='rankHint';this.element.setAttribute('aria-labelledby','headerHintTitle');this.element.setAttribute('aria-modal','true');this.element.hidden=true;
  this.closeButton=node('button','×','header-hint__close');this.closeButton.type='button';this.closeButton.setAttribute('aria-label','ヒントを閉じる');
  this.body=node('div',undefined,'rank-hint__body');this.element.append(this.closeButton,this.body);document.body.append(this.element);
  for(const [kind,button] of Object.entries(this.triggers)){
   if(!button)continue;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','rankHint');button.setAttribute('aria-expanded','false');button.removeAttribute('aria-describedby');
   button.addEventListener('click',()=>this.show(kind));
  }
  this.closeButton.addEventListener('click',()=>this.hide());
  this.element.addEventListener('click',event=>{if(event.target===this.element){const r=this.element.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)this.hide();}});
  this.element.addEventListener('close',()=>{
   if(this.element.open)return;releaseModal(this.element);this.element.hidden=true;this.activeTrigger?.setAttribute('aria-expanded','false');
   if(!isModalBlocked()&&this.activeTrigger?.isConnected)this.activeTrigger.focus({preventScroll:true});
  });
  window.addEventListener('resize',()=>{if(this.element.open)this.position();});this.render();
 }
 hide(){if(this.element.open){this.element.close();return true;}return false;}
 show(kind='rank'){
  if(isModalBlocked())return false;
  this.kind=this.triggers[kind]?kind:'rank';this.activeTrigger=this.triggers[this.kind];this.render();this.position();this.element.hidden=false;
  if(!tryOpenModal(this.element)){this.element.hidden=true;return false;}
  this.activeTrigger.setAttribute('aria-expanded','true');return true;
 }
 clearPoints(){this.points=null;this.refresh();}
 setPoints(value){this.points=normalizeRankPoints(value);this.refresh();}
 refresh(){this.render();if(this.element.open)this.position();}
 getPoints(){return this.points;}
 addRow(list,label,value,id){const row=node('div'),dt=node('dt',label),dd=node('dd',value);if(id)dd.id=id;row.append(dt,dd);list.append(row);}
 render(){
  this.element.dataset.hintKind=this.kind;
  if(this.kind!=='rank'){this.renderGauge();return;}
  this.body.replaceChildren(node('span','ヒーローの歩み','rank-hint__eyebrow'),Object.assign(node('h3','ランク','rank-hint__title'),{id:'headerHintTitle'}));
  this.body.append(node('p','ヒーローとしての歩みを表します。物語が進むにつれて、階級が上がっていきます。','rank-hint__description'),node('p','最高位に到達してからも、珍生物を撃退することで、さらに段位を重ねられます。キャラレベルとは別の成長です。','rank-hint__note'));
 }
 renderGauge(){
  if(this.kind==='calm'){this.body.replaceChildren(node('span','暮らしのひと息','rank-hint__eyebrow'),Object.assign(node('h3','穏やかポイント','rank-hint__title'),{id:'headerHintTitle'}),node('p','食べたり、飲んだり、横になったり、椅子でくつろぐと溜まります。','rank-hint__description'),node('p','気持ちが落ち着くと、パトロールに出かけられます。パトロールや訓練、ちょっかいで使います。のんびり過ごす様子を見守りましょう。','rank-hint__note'));return;}
  const experience=this.kind==='experience';
  this.body.replaceChildren(node('span','ゲージの説明','rank-hint__eyebrow'),Object.assign(node('h3',experience?'経験値':'怒り','rank-hint__title'),{id:'headerHintTitle'}));
  this.body.append(node('p',experience?'珍生物との戦闘で得られ、おこていゆの成長につながります。':'おこていゆハウスで、ちょっかいをかけると溜まります。','rank-hint__description'));
  this.body.append(node('p',experience?'成長を重ねた先には、強化試練が待っています。キャラレベルとヒーローランクは別の成長です。':'怒りが溜まるとカットインが入り、新しい技の発見や、秘めた力の成長につながることがあります。','rank-hint__note'));
 }

 position(){
  const r=this.activeTrigger.getBoundingClientRect(),game=this.game.getBoundingClientRect(),width=Math.max(1,Math.min(320,game.width-20,innerWidth-24));
  const left=Math.max(12,Math.min(r.left,game.right-width-10,innerWidth-width-12));
  const top=Math.min(innerHeight-32,r.bottom+11);
  this.element.style.width=width+'px';this.element.style.left=left+'px';this.element.style.top=top+'px';
  this.element.style.setProperty('--hint-height',Math.max(20,innerHeight-top-12)+'px');
  this.element.style.setProperty('--hint-arrow',Math.min(width-12,Math.max(12,r.left+r.width/2-left))+'px');
 }
}
