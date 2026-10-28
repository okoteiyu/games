import {PaintedLabel,setPaintedText} from './painted-label.js';
import { isModalBlocked } from './modal-layer.js';
const FOOD_LABELS={soda_cup:'ソーダ',soda_straw:'ソーダ',bacon:'ベーコン',bread:'パン',hamburger:'ハンバーグ',pudding:'プリン'};
function activityLabel(life){
 if(!life)return '';
 const phase=life.phase,food=FOOD_LABELS[life.currentFood]||'ごはん';
 if(['stairs_up','stairs_down','walking','navigate','jump','turn'].includes(phase))return '';
 if(phase==='fridge_open')return '冷蔵庫を開けています';
 if(phase==='fridge_close')return '冷蔵庫を閉めています';
 if(phase?.startsWith('fridge_take_'))return food+'を取り出しています';
 if(phase?.startsWith('pickup_'))return food+'を手に取っています';
 if(phase==='eating')return food+(life.currentFood?.startsWith('soda_')?'を飲んでいます':'を食べています');
 if(phase==='bed_lie')return life.step?.type==='hold'?'ベッドで休んでいます':'ベッドで横になっています';
 if(phase==='bed_rise')return 'ベッドから起き上がっています';
 if(phase==='chair_sit')return life.step?.type==='hold'?'椅子でくつろいでいます':'椅子に座っています';
 if(phase==='chair_rise')return '椅子から立ち上がっています';
 if(phase==='computer')return 'パソコンで研究しています';
 return '';
}
/** Mounts a persistent house renderer in the shared image/video/3D viewport. */
export class HouseUI {
 constructor({view,isPaused,isSimulationPaused=isPaused,onLifeEvent=()=>{},onInspect=()=>{},onMapUpdate=()=>{},onGrowthGuide=()=>false,canExecuteAction=()=>true,readCharacter=()=>null,rng=Math.random}){
  Object.assign(this,{view,isPaused,isSimulationPaused,onLifeEvent,onInspect,onMapUpdate,canExecuteAction,readCharacter,rng});this.active=false;this.controller=null;this.loading=null;this.failed=false;
  this.container=document.createElement('div');this.container.className='house3d-container';
  this.status=document.createElement('div');this.status.className='house3d-status';this.status.setAttribute('role','status');this.status.innerHTML='<span></span><button type="button" hidden>再読み込み</button>';
  this.status.querySelector('button').addEventListener('click',()=>this.retry());
  this.button=document.createElement('button');this.button.type='button';this.button.className='house-camera-toggle';this.button.id='houseCameraToggle';this.button.disabled=true;this.button.hidden=true;
  this.button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h3l2-3h4l2 3h3v13H5V7Z"/><circle cx="12" cy="13" r="4"/></svg><span>ビューイング</span><small>⇄</small>';
  this.button.setAttribute('aria-label','追従モードに切り替える');this.button.setAttribute('aria-pressed','false');
  this.backButton=document.createElement('button');this.backButton.type='button';this.backButton.className='house-interaction-back';this.backButton.id='houseInteractionBack';this.backButton.hidden=true;
  this.backButton.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m11 4-6 6 6 6M5 10h11"/></svg><span>戻る</span>';
  this.backButton.setAttribute('aria-label','元の3Dビューに戻る');
  this.hint=document.createElement('p');this.hint.className='house-camera-hint';this.hint.textContent='ドラッグで回転 · ピンチ／ホイールで拡大';this.hint.hidden=true;
  this.lastRelaxCount=0;
  this.toolbar=document.createElement('section');this.toolbar.className='house-toolbar';this.toolbar.id='houseToolbar';this.toolbar.hidden=true;this.toolbar.setAttribute('aria-label','ハウスの状態とカメラ操作');
  this.activity=document.createElement('div');this.activity.className='house-activity';this.activity.innerHTML='<span class="house-activity__label"><i aria-hidden="true"></i>いま</span><span class="house-activity__value" id="houseActivityValue" role="status" aria-live="polite"></span>';this.activityValue=this.activity.querySelector('.house-activity__value');
  this.modePaint=new PaintedLabel(this.button.querySelector('span'),{align:'center',background:'#f6ecd9',fitText:true});this.modePaint.set('ビューイング');this.activityPaint=new PaintedLabel(this.activityValue,{lines:2});
  this.toolbar.append(this.backButton,this.button,this.activity,this.hint);
  this.growthGuideButton=document.createElement('button');this.growthGuideButton.type='button';this.growthGuideButton.className='growth-guide-trigger';this.growthGuideButton.id='growthGuideTrigger';this.growthGuideButton.setAttribute('aria-controls','optionsDialog');this.growthGuideButton.setAttribute('aria-haspopup','dialog');this.growthGuideButton.setAttribute('aria-expanded','false');
  this.growthGuideButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6C8 3 4 5 3 6v13c3-2 6-2 9 0 3-2 6-2 9 0V6c-3-2-6-2-9 0Zm0 0v13"/></svg><span>効率的成長の手引き</span>';this.toolbar.append(this.growthGuideButton);
  this.growthGuideButton.addEventListener('click',()=>{if(this.active&&!this.isPaused()&&!isModalBlocked())onGrowthGuide(this.growthGuideButton);});
  this.observationCard=document.createElement('section');this.observationCard.id='characterObservation';this.observationCard.className='house-observation';this.observationCard.hidden=true;this.observationCard.setAttribute('aria-label','詳細観測中のおこていゆの強さと装備');
  this.observationCard.innerHTML='<dl class="house-observation__stats">'+[['level','Lv.'],['hp','HP'],['attack','攻撃'],['ki','気'],['speed','速さ']].map(([id,label])=>'<div><dt>'+label+'</dt><dd data-observe="'+id+'"></dd></div>').join('')+'</dl><div class="house-observation__items"><span>サポート <b data-observe="support"></b></span><span>防御 <b data-observe="defense"></b></span></div><p class="house-observation__aura"><span>オーラ</span><strong data-observe="aura"></strong></p>';
  this.observationCard.insertAdjacentHTML('afterbegin','<div class="house-observation__experience" aria-label="経験値"><span>経験値</span><span class="house-experience-track" id="experienceGauge" role="progressbar" aria-label="次のレベルまでの経験値" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></span><strong id="experienceValue">0 / 15</strong></div>');
  view.element.append(this.status,this.toolbar,this.observationCard);this.status.hidden=true;
  document.addEventListener('close',()=>setTimeout(()=>this.updateControls(),0),true);
  this.button.addEventListener('click',()=>{if(this.isPaused()||isModalBlocked())return;const mode=this.controller?.mode==='viewing'?'follow':'viewing';if(this.controller?.setMode(mode))this.updateControls();});
  this.backButton.addEventListener('click',()=>{if(this.isPaused()||isModalBlocked())return;if(this.controller?.exitInteraction())this.updateControls();});
  this.bindDetailExit();
 }
 bindDetailExit(){
  // Reuse the renderer's tap/drag/pinch recognition across the whole square,
  // including its information card, toolbar and border. Room input stays on canvas.
  this.detailPointers=new Set();this.consumeDetailClick=false;
  this.view.element.addEventListener('pointerdown',event=>{
   this.consumeDetailClick=false;const c=this.controller;
   if(event.target.closest?.('.growth-guide-trigger'))return;
   if(!c||!['interaction','inspection'].includes(c.sceneMode)||!c.canTapScene()||(event.pointerType==='mouse'&&event.button!==0))return;
   c.pointerDown(event);this.detailPointers.add(event.pointerId);event.stopImmediatePropagation();
  },true);
  this.view.element.addEventListener('pointermove',event=>{if(!this.detailPointers.has(event.pointerId))return;this.controller?.pointerMove(event);event.stopImmediatePropagation();},{capture:true,passive:false});
  for(const type of ['pointerup','pointercancel'])this.view.element.addEventListener(type,event=>{
   if(!this.detailPointers.delete(event.pointerId))return;
   const r=this.view.element.getBoundingClientRect(),outside=event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;
   this.controller?.pointerUp(event,type==='pointercancel'||outside);this.consumeDetailClick=true;event.preventDefault();event.stopImmediatePropagation();
  },true);
  this.view.element.addEventListener('click',event=>{if(!this.consumeDetailClick||event.detail===0)return;this.consumeDetailClick=false;event.preventDefault();event.stopImmediatePropagation();},true);
 }
 show(){this.active=true;this.view.surface.append(this.container);this.toolbar.hidden=false;this.status.hidden=!this.failed&&Boolean(this.controller?.ready);if(this.controller)this.controller.setActive(true);else this.ensureLoaded();this.updateControls();}
 deactivate(){this.active=false;this.controller?.setActive(false);this.toolbar.hidden=true;this.status.hidden=true;this.observationCard.hidden=true;}
 updateControls(){
  const mode=this.controller?.mode||'viewing',sceneMode=this.controller?.sceneMode||'room',interaction=sceneMode!=='room',blocked=this.isPaused()||isModalBlocked(),transitioning=Boolean(this.controller?.cameraTransition);
  this.view.element.dataset.houseScene=sceneMode;
  if((blocked||!this.active)&&this.detailPointers?.size){this.controller?.cancelPointers();this.detailPointers.clear();}
  this.toolbar.hidden=!this.active;this.toolbar.dataset.scene=sceneMode;
  this.button.hidden=false;this.backButton.hidden=false;this.hint.hidden=false;
  this.button.disabled=!this.controller?.ready||blocked||transitioning||interaction;
  // Keep its opener focusable while its own native modal owns background input.
  this.growthGuideButton.disabled=!this.controller?.ready||(blocked&&!document.querySelector('#optionsDialog[open][data-route="growth-guide"]'));
  this.backButton.disabled=!this.controller?.ready||blocked||transitioning||!interaction;
  this.backButton.title=interaction?'元の3Dビューに戻る':'おこていゆや家具をタップすると、詳細観測モードになります';
  this.button.title=interaction?'ビュー内のどこでもタップ、または戻るボタンで詳細観測を終了します':'ビューイング／追従モードを切り替える';
  const modeLabel=interaction?'詳細観測':mode==='viewing'?'ビューイング':'追従';this.modePaint.set(modeLabel);this.button.setAttribute('aria-pressed',String(!interaction&&mode==='follow'));this.button.setAttribute('aria-label',interaction?'詳細観測モード中':(mode==='viewing'?'追従':'ビューイング')+'モードに切り替える');
  this.hint.textContent=interaction?'詳細観測 · ビュー内のどこでもタップで戻る':mode==='viewing'?'ドラッグで回転 · 拡大 · おこていゆや家具をタップ':'入口から追従 · おこていゆをタップで詳細観測';
  this.updateLifeStatus();
 }
 updateLifeStatus(){
  if(this.active)this.onMapUpdate(this.controller?.life,this.controller?.metadata);
  this.updateObservation();this.updateRelaxCounter();const text=this.failed?'お部屋を読み込めませんでした':activityLabel(this.controller?.life);
  this.activityPaint.set(text);this.activityValue.title=text;
 }
 updateObservation(){
  const visible=this.active&&this.controller?.sceneMode==='interaction',character=this.readCharacter(),profile=visible?character:null;if(this.controller?.life?.companion)this.controller.life.companion.visible=character?.equipment?.support!=='none';this.observationCard.hidden=!profile;if(!profile){this.layoutObservation(false);return;}
  const key=JSON.stringify(profile);if(key===this.observationKey){this.layoutObservation(true);return;}this.observationKey=key;
  const exp=profile.experience||{current:0,required:15},percent=exp.required?Math.round(Math.max(0,Math.min(1,exp.current/exp.required))*100):100,expMeter=this.observationCard.querySelector('#experienceGauge');expMeter.setAttribute('aria-valuenow',String(percent));expMeter.querySelector('i').style.width=percent+'%';setPaintedText(this.observationCard.querySelector('#experienceValue'),exp.required?Number(exp.current).toLocaleString('ja-JP',{maximumFractionDigits:1})+' / '+Number(exp.required).toLocaleString('ja-JP'):(profile.level>=106?'MAX':'強化試練'),{background:'#f6f1e6',align:'right',fitText:true,immutableImage:true});
  const format=value=>Number(value).toLocaleString('ja-JP',{maximumFractionDigits:1});
  const values={level:profile.level,...profile.stats,support:profile.items.support,defense:profile.items.defense,aura:profile.aura?profile.aura.name+' Lv.'+profile.aura.level:'なし'};
  for(const [name,value]of Object.entries(values)){const field=this.observationCard.querySelector('[data-observe="'+name+'"]');if(field)setPaintedText(field,typeof value==='number'?format(value):value,{background:'#f6f1e6',align:typeof value==='number'?'center':'left',lines:name==='aura'?2:1});}
  this.layoutObservation(true);
 }
 layoutObservation(visible){
  const surface=this.view.surface.getBoundingClientRect(),toolbar=this.toolbar.getBoundingClientRect(),card=this.observationCard.getBoundingClientRect();
  const top=visible?Math.ceil(Math.max(0,toolbar.bottom-surface.top+5)):0,bottom=visible?Math.ceil(Math.max(0,surface.bottom-card.top+6)):0;
  if(this.container.style.top!==top+'px'||this.container.style.bottom!==bottom+'px'){this.container.style.top=top+'px';this.container.style.bottom=bottom+'px';this.controller?.resize();}
 }
 updateRelaxCounter(value=this.controller?.getConsecutiveRelaxActions?.()??this.lastRelaxCount??0){
  const count=Number(value);if(Number.isFinite(count)&&count>=0)this.lastRelaxCount=Math.trunc(count);
 }
 async ensureLoaded(){
  if(this.loading)return this.loading;
  this.failed=false;this.status.hidden=!this.active;this.status.querySelector('span').textContent='3Dビューを読み込んでいます…';this.status.querySelector('button').hidden=true;
  this.loading=(async()=>{try{
   const {HouseView}=await import('./house-view.js');
   if(!this.active)this.container.remove();
   this.controller=new HouseView({container:this.container,assetUrl:new URL('./assets/house3d/house.glb',import.meta.url).href,metadataUrl:new URL('./assets/house3d/metadata.json',import.meta.url).href,enableInteraction:true,isPaused:()=>this.isPaused()||isModalBlocked(),isSimulationPaused:()=>this.isSimulationPaused(),canExecuteAction:(kind,context)=>this.canExecuteAction(kind,context),rng:()=>this.rng(),onInspect:target=>{if(this.active)this.onInspect(target);},getInspectionInsets:()=>{const surface=this.container.getBoundingClientRect(),toolbar=this.toolbar.getBoundingClientRect();return {top:toolbar.bottom-surface.top+8,bottom:surface.height*.29};},onLifeStateChange:()=>this.updateLifeStatus(),onLifeEvent:event=>{this.updateLifeStatus();this.onLifeEvent(event);},onInteractionChange:state=>{this.updateControls();if(state.sceneMode==='room'&&!state.transitioning&&this.active&&!this.isPaused()&&!isModalBlocked())this.controller?.canvas.focus({preventScroll:true});},onStatus:text=>{this.status.querySelector('span').textContent=text;this.status.hidden=!this.active||!text;},onError:error=>this.showError(error)});
   this.controller.setActive(this.active);const ready=await this.controller.load();if(!ready&&!this.failed)this.showError(new Error('3Dビューを読み込めませんでした。'));this.updateControls();return ready;
  }catch(error){this.showError(error);return false;}})();return this.loading;
 }
 showError(error){this.failed=true;this.status.querySelector('span').textContent='3D表示を読み込めませんでした。通信とWebGLの対応状況をご確認ください。';this.status.querySelector('button').hidden=false;this.status.hidden=!this.active;this.updateControls();}
 async prepareForStartup({retry=false}={}){
  if(retry){this.controller?.destroy();this.controller=null;this.container.replaceChildren();this.loading=null;this.failed=false;}
  return this.ensureLoaded();
 }
 async retry(){
  if(this.isPaused()||isModalBlocked())return false;
  const calm=this.retryCalmPoints??this.controller?.life?.consecutiveRelaxActions;
  this.retryCalmPoints=calm;
  this.controller?.destroy();this.controller=null;this.container.replaceChildren();this.loading=null;
  const ready=await this.ensureLoaded();
  if(ready&&Number.isSafeInteger(calm)){this.restoreConsecutiveRelaxActions(calm);this.retryCalmPoints=null;}
  return ready;
 }
 async applyHouseUpdate(update){if(!this.controller?.ready)throw new Error('部屋の準備ができていません。');const result=await this.controller.applyHouseUpdate(update);this.updateControls();return result;}
 requestAction(kind){if(!this.active||this.isPaused()||isModalBlocked())return false;return this.controller?.requestAction(kind)||false;}
 arriveFromOutside(options={}){return this.controller?.arriveFromOutside(options)||false;}
 leaveHouse(){return this.controller?.leaveHouse()||false;}
 spendCalmPoints(count){return this.controller?.spendCalmPoints(count)??false;}
 getConsecutiveRelaxActions(){return this.retryCalmPoints??this.controller?.getConsecutiveRelaxActions?.()??0;}
 resetConsecutiveRelaxActions(reason='explicit'){return this.controller?.resetConsecutiveRelaxActions?.(reason)??false;}
 onAngerPointGain(){return this.controller?.onAngerPointGain?.()??false;}
 restoreConsecutiveRelaxActions(count){return this.controller?.restoreConsecutiveRelaxActions?.(count)??false;}
 advanceForPreview(seconds){return this.controller?.advanceForPreview(seconds)||false;}
 getDiagnostics(){return this.controller?.getDiagnostics()||{ready:false,active:this.active,error:this.failed?'load-failed':null};}
}
