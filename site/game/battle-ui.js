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
 constructor({view,homeElement,isPaused=()=>false,canReturn=()=>false,onCall=()=>false,onTarget=()=>false,onReturn=()=>{},onReady=()=>{},onError=()=>{}}={}){
  if(!view?.surface||!homeElement)throw new TypeError('戦闘UIの表示先がありません。');
  Object.assign(this,{view,homeElement,isPaused,canReturn,onCall,onTarget,onReturn,onReady,onError});this.active=false;this.loading=false;this.failed=false;this.generation=0;this.snapshot=null;this.resultCutinVisible=false;
  this.container=document.createElement('div');this.container.className='battle-scene';this.container.id='battleScene';
  this.targetMarker=document.createElement('div');this.targetMarker.className='battle-lockon';this.targetMarker.hidden=true;this.targetMarker.setAttribute('aria-hidden','true');
  this.targetMarker.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="battle-lockon__rim" d="M25 4H13Q4 4 4 13V25M75 4H87Q96 4 96 13V25M96 75V87Q96 96 87 96H75M25 96H13Q4 96 4 87V75"/><path class="battle-lockon__corners" d="M25 4H13Q4 4 4 13V25M75 4H87Q96 4 96 13V25M96 75V87Q96 96 87 96H75M25 96H13Q4 96 4 87V75"/><path class="battle-lockon__diamond" d="m50 0 4 4-4 4-4-4Z"/></svg>';this.container.append(this.targetMarker);
  this.targetAnnouncement=document.createElement('span');this.targetAnnouncement.className='battle-lockon-announcement';this.targetAnnouncement.setAttribute('role','status');this.targetAnnouncement.setAttribute('aria-live','polite');this.container.append(this.targetAnnouncement);
  this.status=document.createElement('div');this.status.className='battle-render-status';this.status.setAttribute('role','status');this.status.hidden=true;
  this.status.innerHTML='<span></span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);this.status.querySelector('button').addEventListener('click',()=>this.retry());
  this.hud=document.createElement('div');this.hud.className='battle-hud';this.hud.id='battleHUD';this.hud.hidden=true;
  this.hud.innerHTML='';this.view.element.append(this.hud);
  this.installTargetInput();
  this.panel=document.createElement('section');this.panel.className='lower-right battle-actions';this.panel.id='battleCallChoices';this.panel.hidden=true;this.panel.setAttribute('aria-label','戦闘中のかけごえ');
  this.panel.innerHTML='<header class="battle-actions__heading"><span>見つからないように、そっと</span><h2>かけごえ</h2></header><nav class="battle-calls" aria-label="おこていゆへのかけごえ">'+calls.map(([id,label,description])=>'<button type="button" data-battle-call="'+id+'"><span>'+label+'<small>'+description+'</small></span><b aria-hidden="true">›</b></button>').join('')+'</nav><p class="battle-call-status" role="status">おこていゆは、自分で考えて動く。</p>';homeElement.after(this.panel);
  this.panel.addEventListener('click',event=>{const button=event.target.closest('[data-battle-call]');if(button&&!button.disabled&&!this.blocked()){const accepted=this.onCall(button.dataset.battleCall);if(accepted!==false&&accepted?.ok!==false)this.panel.querySelector('.battle-call-status').textContent=button.dataset.battleCall==='auto'?'おこていゆを、そっと見守る。':button.dataset.battleCall==='super'?'んんーーーーー！':'次の動きのヒントを、そっと送った。';}});
  this.returnView=document.createElement('div');this.returnView.className='battle-return';this.returnView.hidden=true;
  this.returnView.innerHTML='<button type="button" class="battle-return__button" id="battleReturnHome" aria-label="ホーム画面に帰る" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 15 12-10 12 10M7 13v15h18V13M13 28V18h6v10"/><path d="M12 12h8"/></svg><span>ホーム画面に<br>帰る</span></button>';this.panel.append(this.returnView);this.returnButton=this.returnView.querySelector('button');
  this.returnButton.addEventListener('click',()=>{if(this.active&&!this.returnButton.disabled&&this.canReturn())this.onReturn();});
 }
 get ready(){return Boolean(this.controller?.ready&&!this.controller?.contextLost&&!this.loading&&!this.failed);}
 get ended(){return this.snapshot?.phase==='ended'||this.snapshot?.status==='ended';}
 get resultReady(){return Boolean(this.ended&&this.ready&&this.controller?.presentationReadyForResult);}
 blocked(){return !this.active||this.isPaused()||isModalBlocked()||Boolean(this.controller?.cutin);}
 /** Automatic camp encounters use the action slot while the expedition map stays visible. */
 setPresentationMode(embedded=false){
  this.embedded=Boolean(embedded);this.container.classList.toggle('battle-scene--camp',this.embedded);this.panel.classList.toggle('battle-actions--camp',this.embedded);this.hud.classList.toggle('battle-hud--camp',this.embedded);
  this.panel.setAttribute('aria-label',this.embedded?'サブ戦闘ビュー':'戦闘中のかけごえ');this.panel.querySelector('.battle-actions__heading').hidden=this.embedded;
  if(this.embedded)this.panel.append(this.hud,this.container);else this.view.element.append(this.hud);
 }
 updateCanvasDescription(){
  const canvas=this.controller?.canvas;if(!canvas)return;
  canvas.setAttribute('aria-label',this.embedded?'サブ戦闘ビュー。かけごえを行わず、おこていゆチームと相手チームの戦いを見守ります。':'おこていゆと珍生物の戦闘。相手をタップするとロックオン対象を切り替えられます。スワイプすると、おこていゆの周りで視点を回せます。疲れると戦闘が終わります。');
 }
 activateTarget(id){if(this.embedded||this.blocked()||!this.ready||this.ended||document.hidden||!opponents(this.snapshot).some(enemy=>(enemy.id||'enemy')===id&&enemy.hp>0))return false;const result=this.onTarget(id);return result!==false&&result?.ok!==false;}
 cameraInputAvailable(){return Boolean(!this.embedded&&this.ready&&!this.blocked()&&!this.ended&&!document.hidden&&this.snapshot?.phase==='active'&&this.stage?.presentation!=='training-hall'&&this.controller?.stageOptions?.presentation!=='training-hall'&&typeof this.controller?.orbitCamera==='function'&&(this.controller.canOrbitCamera?.()??true));}
 resetTargetInput({clearPointers=false}={}){
  const gesture=this.targetGesture;this.targetGesture=null;this.pendingTargetTap=null;this.container.dataset.cameraDragging='false';
  if(gesture?.dragged)this.suppressTargetClickUntil=performance.now()+500;
  if(clearPointers)this.targetPointers?.clear();
  try{if(gesture?.canvas.hasPointerCapture?.(gesture.id))gesture.canvas.releasePointerCapture(gesture.id);}catch{}
 }
 installTargetInput(){
  this.targetPointers=new Set();this.targetInputCleanups=[];const listen=(element,type,callback,options)=>{element.addEventListener(type,callback,options);this.targetInputCleanups.push(()=>element.removeEventListener(type,callback,options));};
  // A second contact cancels the whole gesture, even if it lands on a HUD or dialog.
  listen(document,'pointerdown',event=>{if(event.button!==0)return;this.targetPointers.add(event.pointerId);if(this.targetPointers.size>1)this.resetTargetInput();},true);
  listen(document,'pointerup',event=>this.targetPointers.delete(event.pointerId),true);
  listen(document,'pointercancel',event=>{this.targetPointers.delete(event.pointerId);if(this.targetGesture?.id===event.pointerId)this.resetTargetInput();},true);
  listen(window,'blur',()=>this.resetTargetInput({clearPointers:true}));
  listen(document,'visibilitychange',()=>{if(document.hidden)this.resetTargetInput({clearPointers:true});});
  listen(this.container,'pointerdown',event=>{
   if(event.target!==this.controller?.canvas)return;this.pendingTargetTap=null;
   if(!this.cameraInputAvailable()||event.button!==0||event.isPrimary===false||this.targetPointers.size>1||this.targetGesture){this.resetTargetInput();return;}
   this.suppressTargetClickUntil=0;this.targetGesture={id:event.pointerId,canvas:event.target,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,at:performance.now(),dragged:false};
   try{event.target.setPointerCapture(event.pointerId);}catch{}
  });
  listen(this.container,'pointermove',event=>{
   const gesture=this.targetGesture;if(!gesture||gesture.id!==event.pointerId)return;
   const bounds=gesture.canvas.getBoundingClientRect();
   if(!this.cameraInputAvailable()||event.isPrimary===false||this.targetPointers.size>1||event.buttons===0&&event.pointerType!=='touch'||event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom){this.resetTargetInput();return;}
   if(!gesture.dragged&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=8)return;
   gesture.dragged=true;this.container.dataset.cameraDragging='true';event.preventDefault();
   const moved=this.controller.orbitCamera(event.clientX-gesture.lastX,event.clientY-gesture.lastY);gesture.lastX=event.clientX;gesture.lastY=event.clientY;if(moved===false)this.resetTargetInput();
  });
  listen(this.container,'pointerup',event=>{
   const gesture=this.targetGesture;if(!gesture||gesture.id!==event.pointerId)return;
   const tapped=this.cameraInputAvailable()&&!gesture.dragged&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=8&&performance.now()-gesture.at<=650;
   if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8)gesture.dragged=true;
   this.resetTargetInput();if(tapped)this.pendingTargetTap={x:event.clientX,y:event.clientY,at:performance.now()};
  });
  listen(this.container,'pointercancel',()=>this.resetTargetInput());
  listen(this.container,'pointerleave',event=>{if(this.targetGesture?.id===event.pointerId)this.resetTargetInput();});
  listen(this.container,'lostpointercapture',event=>{if(this.targetGesture?.id===event.pointerId)this.resetTargetInput();});
  listen(this.container,'click',event=>{if(event.target!==this.controller?.canvas)return;if(performance.now()<this.suppressTargetClickUntil){this.pendingTargetTap=null;event.preventDefault();event.stopPropagation();return;}const tap=this.pendingTargetTap;this.pendingTargetTap=null;if(!tap||performance.now()-tap.at>500||!this.cameraInputAvailable())return;const id=this.controller.pickBattleTarget(tap.x,tap.y);if(id)this.activateTarget(id);});
  const activateCard=event=>{const card=event.target.closest?.('.battle-hp--enemy[data-battle-actor]');if(!card||!this.hud.contains(card))return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;if(event.type==='keydown')event.preventDefault();this.activateTarget(card.dataset.battleActor);};
  listen(this.hud,'click',activateCard);listen(this.hud,'keydown',activateCard);
 }
 paintTarget(target){
  const visible=Boolean(!this.embedded&&target&&this.ready&&!this.blocked()&&!this.ended&&!document.hidden);this.targetMarker.hidden=!visible;if(!visible)return;
  this.targetMarker.dataset.targetId=target.id;this.targetMarker.style.left=target.left+'px';this.targetMarker.style.top=target.top+'px';this.targetMarker.style.width=target.width+'px';this.targetMarker.style.height=target.height+'px';
  if(this.announcedTarget!==target.id){this.announcedTarget=target.id;this.targetAnnouncement.textContent=target.name+'をロックオン';}
 }
 async start(snapshot,stage={}, {presentationState=null}={}){
  this.resetTargetInput({clearPointers:true});this.container.classList.add('is-loading');this.controller?.setActive(false);this.targetMarker.hidden=true;this.announcedTarget=null;this.targetAnnouncement.textContent='';
  this.setPresentationMode(stage.campEmbedded===true);if(!this.embedded)this.view.clear();this.active=true;this.loading=true;this.failed=false;this.snapshot=snapshot;this.stage=stage;this.resultCutinVisible=false;const generation=++this.generation;
  if(!this.embedded)this.view.surface.append(this.container);this.panel.hidden=false;this.hud.hidden=true;this.status.hidden=false;this.status.querySelector('span').textContent='戦闘のモデルを読み込んでいます…';this.status.querySelector('button').hidden=true;this.panel.querySelector('.battle-call-status').textContent='おこていゆは、そっと身構える。';this.updateControls();
  this.controller??=new BattleView({container:this.container,isPresentationPaused:()=>this.isPaused(),onTargetFrame:target=>this.paintTarget(target),getContentInsets:()=>{if(this.embedded)return {top:8,bottom:8};const surface=this.view.surface.getBoundingClientRect(),hud=this.hud.getBoundingClientRect();return {top:this.hud.hidden?surface.height*.14:hud.bottom-surface.top+8,bottom:12};},onStatus:text=>{this.status.querySelector('span').textContent=text;this.status.hidden=!this.active||!text;},onError:error=>this.showError(error)});
  const ready=await this.controller.load(snapshot,stage,{presentationState});
  if(!this.active||generation!==this.generation)return false;
  this.loading=false;this.failed=!ready;this.hud.hidden=!ready;this.updateCanvasDescription();this.updateControls();if(ready){this.controller.setSnapshot(this.snapshot);this.controller.setActive(true);this.controller.advance(0);this.container.classList.remove('is-loading');this.onReady(this.snapshot);}return ready;
 }
 setSnapshot(snapshot){this.snapshot=snapshot;this.controller?.setSnapshot(snapshot);this.updateControls();}
 handleEvent(event){this.controller?.handleEvent(event);const type=event?.type||event?.kind;if(type==='damage'||type==='hit'){const box=this.hud.querySelector('[data-battle-actor="'+(event.target||event.actor)+'"]');if(box){box.classList.remove('is-hit');void box.offsetWidth;box.classList.add('is-hit');}}}
 advance(dt){if(!this.active)return;if(!this.isPaused()&&!isModalBlocked())this.controller?.advance(dt);this.updateControls();}
 showReturn({cutin=this.resultCutinVisible}={}){
  if(this.embedded){this.panel.dataset.mode='camp';this.returnView.hidden=true;this.returnButton.disabled=true;return;}
  const campFinal=this.stage?.encounterType==='camp-final',returnLabel=campFinal?'探索を終える':'ホーム画面に帰る';
  if(this.returnLabel!==returnLabel){this.returnLabel=returnLabel;this.returnButton.setAttribute('aria-label',returnLabel);this.returnButton.querySelector('span').innerHTML=campFinal?'探索を<br>終える':'ホーム画面に<br>帰る';}
  this.resultCutinVisible=Boolean(cutin);this.panel.dataset.mode='result';this.panel.hidden=!this.active;this.returnView.hidden=false;
  if(this.resultCutinVisible)this.hud.hidden=true;
  this.returnButton.disabled=!this.active||!this.canReturn();this.returnButton.title=this.returnButton.disabled?'演出と結果メッセージを確認すると進めます。':campFinal?'探索を終えます。':this.stage?.encounterType==='story'?'物語の続きを読みます。':'ホーム画面へ戻ります。';
 }
 updateControls(){
  const snapshot=this.snapshot;if(!snapshot)return;
  const enemies=opponents(snapshot),ids=enemies.map(enemy=>enemy.id||'enemy'),hudKey=ids.join('|');if(this.hudKey!==hudKey){this.hudKey=hudKey;releasePaintedLabels(this.hud);this.hud.innerHTML=hpMarkup('player')+'<div class="battle-hud__opponents">'+ids.map(hpMarkup).join('')+'</div>';}this.hud.dataset.enemyCount=String(enemies.length);this.hud.querySelector('.battle-hud__opponents').hidden=this.embedded;this.panel.hidden=!this.active;this.hud.hidden=!this.active||!this.ready||(!this.embedded&&Boolean(this.controller?.cutin))||this.resultCutinVisible;
  this.panel.dataset.mode=this.embedded?'camp':this.ended?'result':'battle';this.returnView.hidden=this.embedded||!this.ended;
  const slots=snapshot.techniques?.slots||['punch',snapshot.techniques?.energyRayUnlocked?'energy_ray':null,null];this.panel.style.setProperty('--battle-call-count',String(slots.filter(Boolean).length+1));for(const [index,button]of [...this.panel.querySelectorAll('.battle-calls button')].slice(0,3).entries()){const id=slots[index];button.hidden=!id;button.dataset.battleCall=id||'';if(id){const label=button.querySelector('span'),small=label.querySelector('small');if(label.firstChild.nodeType===Node.TEXT_NODE)label.firstChild.textContent=TECHNIQUES[id].name;small.textContent='スロット '+(index+1);}}
  const energyUnlocked=Boolean(snapshot.techniques?.energyRayUnlocked),superUsed=Boolean(snapshot.player?.superUsed??snapshot.super?.used),superName=snapshot.techniques?.superDetails?.name||snapshot.super?.name||'スーパーおこていゆ状態';
  const requested=snapshot.queuedTechnique||snapshot.player?.queuedTechnique||snapshot.player?.requestedTechnique||'auto';
  for(const button of this.panel.querySelectorAll('[data-battle-call]')){const id=button.dataset.battleCall;button.disabled=this.embedded||this.blocked()||!this.ready||this.ended||(id==='energy_ray'&&!energyUnlocked)||(id==='super'&&superUsed);button.dataset.selected=String(requested===id);if(id==='super'){const label=button.querySelector('span');if(label.firstChild.nodeType===Node.TEXT_NODE)label.firstChild.textContent=superName;button.querySelector('small').textContent=superUsed?'この戦闘では使用済み':'HPに関係なく、1戦闘1回';}button.setAttribute('aria-label',(id==='super'?superName:TECHNIQUES[id]?.name||'未設定')+'。'+button.querySelector('small').textContent);}
  this.panel.querySelector('.battle-calls').hidden=this.embedded||this.ended;this.panel.querySelector('.battle-call-status').hidden=this.embedded||this.ended;
  for(const [role,state] of [['player',snapshot.player],...enemies.map(enemy=>[enemy.id||'enemy',enemy])]){
   if(!state)continue;const box=this.hud.querySelector('[data-battle-actor="'+role+'"]'),hp=Math.max(0,number(state.hp)),max=Math.max(.1,number(state.maxHp,1)),ratio=Math.min(1,hp/max),superActive=Boolean(state.superActive??(role==='player'&&snapshot.super?.active));
   if(role!=='player'){const enabled=!this.embedded&&this.ready&&!this.blocked()&&!this.ended&&!document.hidden&&hp>0;box.setAttribute('role','button');box.tabIndex=enabled?0:-1;box.setAttribute('aria-disabled',String(!enabled));box.setAttribute('aria-pressed',String(snapshot.targetId===role&&hp>0));box.setAttribute('aria-label',(state.name||'珍生物')+(snapshot.targetId===role&&hp>0?'。ロックオン中':'をロックオン'));}
   box.dataset.category=state.category||'';box.dataset.hp=String(hp);box.dataset.maxHp=String(max);setPaintedText(box.querySelector('strong'),(role!=='player'&&enemies.length>1?(enemies.indexOf(state)+1)+'. ':'')+(state.name||(role==='player'?'おこていゆ':'珍生物')),{background:'#f8f4e9',lines:2});setPaintedText(box.querySelector('header>span'),'Lv.'+number(state.level,1),{background:'#f8f4e9'});setPaintedText(box.querySelector('.battle-hp__value'),format(hp)+' / '+format(max),{background:'#f8f4e9'});const stateLabel=superActive?superName:hp<=0?'疲労':role!=='player'&&snapshot.targetId===role?'対象':'HP';setPaintedText(box.querySelector('small'),(role!=='player'&&CREATURE_CATEGORIES[state.category]?CREATURE_CATEGORIES[state.category].label+' · ':'')+stateLabel,{background:'#f8f4e9',lines:3});box.dataset.targeted=String(role!=='player'&&snapshot.targetId===role&&hp>0);box.classList.toggle('is-fatigued',hp<=0);const meter=box.querySelector('[role="progressbar"]');meter.setAttribute('aria-valuenow',String(Math.round(ratio*100)));meter.setAttribute('aria-label',(state.name||'珍生物')+'のHP '+format(hp)+' / '+format(max));meter.querySelector('i').style.width=ratio*100+'%';box.classList.toggle('is-low',ratio<=.25);box.classList.toggle('is-super',superActive);
  }
  const cameraEnabled=this.cameraInputAvailable();this.container.dataset.cameraEnabled=String(cameraEnabled);if(!cameraEnabled&&(this.targetGesture||this.pendingTargetTap))this.resetTargetInput();
  this.container.dataset.targetingEnabled=String(!this.embedded&&this.ready&&!this.blocked()&&!this.ended&&!document.hidden);this.paintTarget(this.controller?.getLockOnTarget()||null);
  if(this.ended)this.showReturn();
 }
 showError(error){this.failed=true;this.loading=false;this.status.hidden=!this.active;this.status.querySelector('span').textContent='戦闘の3D表示を読み込めませんでした。もう一度お試しください。';this.status.querySelector('button').hidden=false;this.hud.hidden=true;this.updateControls();this.onError(error);}
 async retry(){if(!this.active||this.isPaused()||isModalBlocked()||(!this.failed&&this.controller?.cutin))return false;const presentationState=this.controller?.capturePresentationState();return this.start(this.snapshot,this.stage,{presentationState});}
 /** The required Continue dialog stays open while the new renderer prepares. */
 recoverAfterInterruption(){
  if(this.recoveryPromise)return this.recoveryPromise;
  if(!this.active||!this.controller)return Promise.resolve(false);
  this.resetTargetInput({clearPointers:true});
  const generation=this.generation,presentationState=this.controller.capturePresentationState();
  this.loading=true;this.failed=false;this.container.classList.add('is-loading');this.hud.hidden=true;this.updateControls();
  this.recoveryPromise=(async()=>{
   try{
    const ready=await this.controller.recoverAfterInterruption(this.snapshot,this.stage,{presentationState});
    if(!this.active||generation!==this.generation)return false;
    this.loading=false;this.failed=!ready;this.updateCanvasDescription();this.updateControls();
    if(ready){this.controller.setSnapshot(this.snapshot);this.controller.setActive(true);this.container.classList.remove('is-loading');this.controller.advance(0);this.status.hidden=true;return true;}
    this.showError(new Error(this.controller.lastError||'戦闘の表示を復旧できませんでした。'));return false;
   }catch(error){if(this.active&&generation===this.generation)this.showError(error);return false;}
  })().finally(()=>{this.recoveryPromise=null;});
  return this.recoveryPromise;
 }
 deactivate(){this.resetTargetInput({clearPointers:true});this.active=false;this.generation++;this.controller?.setActive(false);this.targetMarker.hidden=true;this.panel.hidden=true;this.hud.hidden=true;this.status.hidden=true;this.container.remove();this.setPresentationMode(false);}
 getDiagnostics(){return {embedded:Boolean(this.embedded),active:this.active,ready:this.ready,loading:this.loading,failed:this.failed,ended:this.ended,resultReady:this.resultReady,lockOn:{visible:!this.targetMarker.hidden,targetId:this.targetMarker.hidden?null:this.targetMarker.dataset.targetId},visibleCalls:[...this.panel.querySelectorAll('[data-battle-call]')].filter(button=>!button.disabled&&!button.hidden&&!button.closest('[hidden]')).map(button=>button.dataset.battleCall),view:this.controller?.getDiagnostics()||null};}
 destroy(){this.deactivate();for(const stop of this.targetInputCleanups)stop();this.controller?.destroy();this.panel.remove();this.hud.remove();}
}
