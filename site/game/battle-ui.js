import {TECHNIQUES} from './technique-rules.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';
import {CREATURE_CATEGORIES} from './game-session.js';
import { BattleView } from './battle-view.js';
import { isModalBlocked } from './modal-layer.js';

const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const format=value=>number(value).toLocaleString('ja-JP',{maximumFractionDigits:1});
const opponents=snapshot=>snapshot?.enemies||[snapshot?.enemy].filter(Boolean);
const hpMarkup=role=>'<section class="battle-hp battle-hp--'+(role==='player'?'player':'enemy')+'" data-battle-actor="'+role+'"><header><strong></strong><span></span></header><div class="battle-hp__meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div><footer><span class="battle-hp__value"></span><small></small></footer></section>';
const calls=[['slot0','未設定','スロット1'],['slot1','未設定','スロット2'],['slot2','未設定','スロット3'],['super','スーパーおこていゆ状態','ここぞ、のひと押し']];

/** HP and calls share the existing square view and lower-right action slot. */
export class BattleUI{
 constructor({view,homeElement,isPaused=()=>false,onCall=()=>false,onReturn=()=>{},onReady=()=>{},onError=()=>{}}={}){
  if(!view?.surface||!homeElement)throw new TypeError('戦闘UIの表示先がありません。');
  Object.assign(this,{view,homeElement,isPaused,onCall,onReturn,onReady,onError});this.active=false;this.loading=false;this.failed=false;this.generation=0;this.snapshot=null;
  this.container=document.createElement('div');this.container.className='battle-scene';this.container.id='battleScene';
  this.status=document.createElement('div');this.status.className='battle-render-status';this.status.setAttribute('role','status');this.status.hidden=true;
  this.status.innerHTML='<span></span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);this.status.querySelector('button').addEventListener('click',()=>this.retry());
  this.hud=document.createElement('div');this.hud.className='battle-hud';this.hud.id='battleHUD';this.hud.hidden=true;
  this.hud.innerHTML='';this.view.element.append(this.hud);
  this.panel=document.createElement('section');this.panel.className='lower-right battle-actions';this.panel.id='battleCallChoices';this.panel.hidden=true;this.panel.setAttribute('aria-label','戦闘中のかけごえ');
  this.panel.innerHTML='<header class="battle-actions__heading"><span>見つからないように、そっと</span><h2>かけごえ</h2></header><nav class="battle-calls" aria-label="おこていゆへのかけごえ">'+calls.map(([id,label,description])=>'<button type="button" data-battle-call="'+id+'"><span>'+label+'<small>'+description+'</small></span><b aria-hidden="true">›</b></button>').join('')+'</nav><p class="battle-call-status" role="status">おこていゆは、自分で考えて動く。</p>';homeElement.after(this.panel);
  this.panel.addEventListener('click',event=>{const button=event.target.closest('[data-battle-call]');if(button&&!button.disabled&&!this.blocked()){const accepted=this.onCall(button.dataset.battleCall);if(accepted!==false&&accepted?.ok!==false)this.panel.querySelector('.battle-call-status').textContent=button.dataset.battleCall==='auto'?'おこていゆを、そっと見守る。':button.dataset.battleCall==='super'?'んんーーーーー！':'次の動きのヒントを、そっと送った。';}});
 }
 get ready(){return Boolean(this.controller?.ready&&!this.controller?.contextLost&&!this.loading&&!this.failed);}
 get ended(){return this.snapshot?.phase==='ended'||this.snapshot?.status==='ended';}
 get resultReady(){return Boolean(this.ended&&this.ready&&this.controller?.presentationReadyForResult);}
 blocked(){return !this.active||this.isPaused()||isModalBlocked()||Boolean(this.controller?.cutin);}
 async start(snapshot,stage={}, {presentationState=null}={}){
  this.container.classList.add('is-loading');this.controller?.setActive(false);
  this.view.clear();this.active=true;this.loading=true;this.failed=false;this.snapshot=snapshot;this.stage=stage;const generation=++this.generation;
  this.view.surface.append(this.container);this.panel.hidden=false;this.hud.hidden=true;this.status.hidden=false;this.status.querySelector('span').textContent='戦闘のモデルを読み込んでいます…';this.status.querySelector('button').hidden=true;this.panel.querySelector('.battle-call-status').textContent='おこていゆは、そっと身構える。';this.updateControls();
  this.controller??=new BattleView({container:this.container,isPresentationPaused:()=>this.isPaused(),getContentInsets:()=>{const surface=this.view.surface.getBoundingClientRect(),hud=this.hud.getBoundingClientRect();return {top:this.hud.hidden?surface.height*.14:hud.bottom-surface.top+8,bottom:12};},onStatus:text=>{this.status.querySelector('span').textContent=text;this.status.hidden=!this.active||!text;},onError:error=>this.showError(error)});
  const ready=await this.controller.load(snapshot,stage,{presentationState});
  if(!this.active||generation!==this.generation)return false;
  this.loading=false;this.failed=!ready;this.hud.hidden=!ready;this.updateControls();if(ready){this.controller.setSnapshot(this.snapshot);this.controller.setActive(true);this.controller.advance(0);this.container.classList.remove('is-loading');this.onReady(this.snapshot);}return ready;
 }
 setSnapshot(snapshot){this.snapshot=snapshot;this.controller?.setSnapshot(snapshot);this.updateControls();}
 handleEvent(event){this.controller?.handleEvent(event);const type=event?.type||event?.kind;if(type==='damage'||type==='hit'){const box=this.hud.querySelector('[data-battle-actor="'+(event.target||event.actor)+'"]');if(box){box.classList.remove('is-hit');void box.offsetWidth;box.classList.add('is-hit');}}}
 advance(dt){if(!this.active)return;if(!this.isPaused()&&!isModalBlocked())this.controller?.advance(dt);this.updateControls();}
 updateControls(){
  const snapshot=this.snapshot;if(!snapshot)return;
  const enemies=opponents(snapshot),ids=enemies.map(enemy=>enemy.id||'enemy'),hudKey=ids.join('|');if(this.hudKey!==hudKey){this.hudKey=hudKey;releasePaintedLabels(this.hud);this.hud.innerHTML=hpMarkup('player')+'<div class="battle-hud__opponents">'+ids.map(hpMarkup).join('')+'</div>';}this.hud.dataset.enemyCount=String(enemies.length);this.panel.hidden=!this.active;this.hud.hidden=!this.active||!this.ready||Boolean(this.controller?.cutin);
  const slots=snapshot.techniques?.slots||['punch',snapshot.techniques?.energyRayUnlocked?'energy_ray':null,null];this.panel.style.setProperty('--battle-call-count',String(slots.filter(Boolean).length+1));for(const [index,button]of [...this.panel.querySelectorAll('.battle-calls button')].slice(0,3).entries()){const id=slots[index];button.hidden=!id;button.dataset.battleCall=id||'';if(id){const label=button.querySelector('span'),small=label.querySelector('small');if(label.firstChild.nodeType===Node.TEXT_NODE)label.firstChild.textContent=TECHNIQUES[id].name;small.textContent='スロット '+(index+1);}}
  const energyUnlocked=Boolean(snapshot.techniques?.energyRayUnlocked),superUsed=Boolean(snapshot.player?.superUsed??snapshot.super?.used);
  const requested=snapshot.queuedTechnique||snapshot.player?.queuedTechnique||snapshot.player?.requestedTechnique||'auto';
  for(const button of this.panel.querySelectorAll('[data-battle-call]')){const id=button.dataset.battleCall;button.disabled=this.blocked()||!this.ready||this.ended||(id==='energy_ray'&&!energyUnlocked)||(id==='super'&&superUsed);button.dataset.selected=String(requested===id);if(id==='super')button.querySelector('small').textContent=superUsed?'この戦闘では使用済み':'HPに関係なく、1戦闘1回';button.setAttribute('aria-label',(id==='super'?'スーパーおこていゆ状態':TECHNIQUES[id]?.name||'未設定')+'。'+button.querySelector('small').textContent);}
  this.panel.querySelector('.battle-calls').hidden=this.ended;this.panel.querySelector('.battle-call-status').hidden=this.ended;
  for(const [role,state] of [['player',snapshot.player],...enemies.map(enemy=>[enemy.id||'enemy',enemy])]){
   if(!state)continue;const box=this.hud.querySelector('[data-battle-actor="'+role+'"]'),hp=Math.max(0,number(state.hp)),max=Math.max(.1,number(state.maxHp,1)),ratio=Math.min(1,hp/max),superActive=Boolean(state.superActive??(role==='player'&&snapshot.super?.active));
   box.dataset.category=state.category||'';box.dataset.hp=String(hp);box.dataset.maxHp=String(max);setPaintedText(box.querySelector('strong'),(role!=='player'&&enemies.length>1?(enemies.indexOf(state)+1)+'. ':'')+(state.name||(role==='player'?'おこていゆ':'珍生物')),{background:'#f8f4e9',lines:2});setPaintedText(box.querySelector('header>span'),'Lv.'+number(state.level,1),{background:'#f8f4e9'});setPaintedText(box.querySelector('.battle-hp__value'),format(hp)+' / '+format(max),{background:'#f8f4e9'});const stateLabel=superActive?'スーパーおこていゆ状態':hp<=0?'疲労':role!=='player'&&snapshot.targetId===role?'対象':'HP';setPaintedText(box.querySelector('small'),(role!=='player'&&CREATURE_CATEGORIES[state.category]?CREATURE_CATEGORIES[state.category].label+' · ':'')+stateLabel,{background:'#f8f4e9',lines:3});box.dataset.targeted=String(role!=='player'&&snapshot.targetId===role&&hp>0);box.classList.toggle('is-fatigued',hp<=0);const meter=box.querySelector('[role="progressbar"]');meter.setAttribute('aria-valuenow',String(Math.round(ratio*100)));meter.setAttribute('aria-label',(state.name||'珍生物')+'のHP '+format(hp)+' / '+format(max));meter.querySelector('i').style.width=ratio*100+'%';box.classList.toggle('is-low',ratio<=.25);box.classList.toggle('is-super',superActive);
  }
 }
 showError(error){this.failed=true;this.loading=false;this.status.hidden=!this.active;this.status.querySelector('span').textContent='戦闘の3D表示を読み込めませんでした。もう一度お試しください。';this.status.querySelector('button').hidden=false;this.hud.hidden=true;this.updateControls();this.onError(error);}
 async retry(){if(!this.active||this.isPaused()||isModalBlocked()||(!this.failed&&this.controller?.cutin))return false;const presentationState=this.controller?.capturePresentationState();return this.start(this.snapshot,this.stage,{presentationState});}
 /** The required Continue dialog stays open while the new renderer prepares. */
 recoverAfterInterruption(){
  if(this.recoveryPromise)return this.recoveryPromise;
  if(!this.active||!this.controller)return Promise.resolve(false);
  const generation=this.generation,presentationState=this.controller.capturePresentationState();
  this.loading=true;this.failed=false;this.container.classList.add('is-loading');this.hud.hidden=true;this.updateControls();
  this.recoveryPromise=(async()=>{
   try{
    const ready=await this.controller.recoverAfterInterruption(this.snapshot,this.stage,{presentationState});
    if(!this.active||generation!==this.generation)return false;
    this.loading=false;this.failed=!ready;this.updateControls();
    if(ready){this.controller.setSnapshot(this.snapshot);this.controller.setActive(true);this.container.classList.remove('is-loading');this.controller.advance(0);this.status.hidden=true;return true;}
    this.showError(new Error(this.controller.lastError||'戦闘の表示を復旧できませんでした。'));return false;
   }catch(error){if(this.active&&generation===this.generation)this.showError(error);return false;}
  })().finally(()=>{this.recoveryPromise=null;});
  return this.recoveryPromise;
 }
 deactivate(){this.active=false;this.generation++;this.controller?.setActive(false);this.panel.hidden=true;this.hud.hidden=true;this.status.hidden=true;this.container.remove();}
 getDiagnostics(){return {active:this.active,ready:this.ready,loading:this.loading,failed:this.failed,ended:this.ended,resultReady:this.resultReady,visibleCalls:[...this.panel.querySelectorAll('[data-battle-call]')].filter(button=>!button.disabled).map(button=>button.dataset.battleCall),view:this.controller?.getDiagnostics()||null};}
 destroy(){this.deactivate();this.controller?.destroy();this.panel.remove();this.hud.remove();}
}
