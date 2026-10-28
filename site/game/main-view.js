import {setPaintedText} from './painted-label.js';
import {BrowserSave} from './browser-save.js';
import {VisitorNamePopup} from './visitor-name.js';
import {installPasswordViewportGuard} from './password-viewport.js';
import { GameRuntime } from './game-runtime.js';
import { HouseUI } from './house-ui.js';
import { PatrolUI } from './patrol-ui.js';
import { isModalBlocked } from './modal-layer.js';
import { NoticePopup } from './notice-popup.js';
import { OkoteiyuMessage } from './message-frame.js';
import { OptionsDialog } from './options-dialog.js';
import { RankHint } from './rank-hint.js';
import { getRankProgress } from './rank-progress.js';
import { AreaMap } from './area-map.js';
import { GameEvents } from './game-events.js';
export class SquareSceneView {
 constructor(element) {
  this.element = element; this.surface = element.querySelector('.main-view__surface'); this.objectURL = null;
  this.observer = new ResizeObserver(() => { const box=this.surface.getBoundingClientRect();element.dispatchEvent(new CustomEvent('viewresize',{detail:{width:box.width,height:box.height,aspect:1,pixelRatio:window.devicePixelRatio||1}})); });
  this.observer.observe(this.surface);
 }
 clear() { houseUI?.deactivate();const video=this.surface.querySelector('video');if(video)video.pause();this.surface.replaceChildren();this.surface.classList.remove('is-video');if(this.objectURL){URL.revokeObjectURL(this.objectURL);this.objectURL=null;} }
 setDemo(dark=false) { this.clear();const scene=document.createElement('div');scene.className=`main-view__demo${dark?' is-dark':''}`;scene.setAttribute('role','img');scene.setAttribute('aria-label',dark?'暗い背景で枠の見え方を確認':'明るい背景で枠の見え方を確認');scene.innerHTML='<span class="demo-halo"></span><span class="demo-cloud"></span><span class="demo-cloud demo-cloud--right"></span><span class="demo-spark"></span><img class="demo-icon" src="assets/naruto-sticker.png" alt="">';this.surface.append(scene); }
 setHouse() { if(houseUI){this.clear();houseUI.show();return houseUI.container;}const image=this.setImage('assets/okoteiyu-house-workspace.png','研究中のおこていゆがいる、おこていゆハウスの一室');image.className='house-image';return image; }
 setImage(src,alt='メインビューの画像') { this.clear();const image=new Image();image.alt=alt;image.src=src;this.surface.append(image);return image; }
 setVideo(src,{muted=true,autoplay=true}={}) { this.clear();this.surface.classList.add('is-video');const video=document.createElement('video');video.playsInline=true;video.muted=muted;video.preload='metadata';video.src=src;video.setAttribute('aria-label','メインビューの動画');this.surface.append(video);if(autoplay)video.play().catch(()=>{});return video; }
 setCanvas(canvas) { this.clear();this.surface.append(canvas);return canvas; }
 setFile(file) { if(!file)return;if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))throw new Error('画像または動画を選んでください。');const url=URL.createObjectURL(file);const media=file.type.startsWith('video/')?this.setVideo(url):this.setImage(url,file.name);this.objectURL=url;return media; }
 destroy() { this.clear();this.observer.disconnect(); }
}

installPasswordViewportGuard();
let patrolUI=null,houseUI=null,gameRuntime=null;
const needsVisitorName=()=>!gameRuntime?.session.state.visitorName;
const view=new SquareSceneView(document.querySelector('#mainView'));
const areaMap=new AreaMap(document.querySelector('#areaMap'));areaMap.showHouse();
const events=new GameEvents({onMessage:payload=>presentMessage(payload)});
const samples=[
 {speaker:'ナレーション',kind:'narration',text:'おこていゆは、焼いたベーコンをじっと見つめている。どうやら、研究の手が止まってしまったようだ。'},
 {speaker:'おこていゆ',kind:'speech',text:'ｵｺﾃｲﾕ……。'}
];
const overlay=document.querySelector('#messageOverlay');
const shield=document.querySelector('#viewInputShield');
const replayButton=document.querySelector('#messageReplay');
let eventVisible=false,lastMessage=null;
const message=new OkoteiyuMessage(document.querySelector('#message'),{onAdvance:()=>{if(!gameRuntime?.messageLocked)hideEvent();}});
function presentMessage(payload) {
 lastMessage={speaker:payload.speaker??'ナレーション',text:payload.text??'',kind:payload.kind??'narration'};
 replayButton.hidden=true;replayButton.disabled=false;
 eventVisible=true;overlay.hidden=false;shield.hidden=false;view.surface.inert=true;
 view.element.dataset.messageVisible='true';view.surface.setAttribute('aria-disabled','true');
 message.set(lastMessage);message.next.disabled=Boolean(gameRuntime?.messageLocked);houseUI?.updateControls();
}
function showEvent(payload=samples[0],{record=true}={}) {
 if(record)return events.dispatch(payload,{showMessage:true});
 presentMessage(payload);return null;
}
function replayMessage(){
 if(!lastMessage||eventVisible||isModalBlocked()||gameRuntime?.messageLocked)return false;
 presentMessage(lastMessage);message.next.focus({preventScroll:true});return true;
}
replayButton.addEventListener('click',replayMessage);
function hideEvent() {
 const restoreFocus=overlay.contains(document.activeElement);
 eventVisible=false;overlay.hidden=true;shield.hidden=true;view.surface.inert=false;
 view.element.dataset.messageVisible='false';view.surface.removeAttribute('aria-disabled');
 replayButton.hidden=false;replayButton.disabled=!lastMessage||Boolean(gameRuntime?.messageLocked);houseUI?.updateControls();
 if(restoreFocus&&!isModalBlocked())replayButton.focus({preventScroll:true});
 gameRuntime?.onMessageClosed();

}
// Capture a single click anywhere in the view before it reaches scene controls.
// Keep the scene inert until the message is dismissed; cutins and modals retain ownership.
for(const type of ['pointerdown','pointerup','pointermove','click','dblclick','wheel','touchstart','touchmove','contextmenu','keydown','dragover','drop']) {
 view.element.addEventListener(type,event=>{
  if(!eventVisible)return;
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('.anger-cutin-recovery'))return;
  if(type==='click'){
   event.preventDefault();event.stopImmediatePropagation();
   if(!isModalBlocked()&&!gameRuntime?.messageLocked)message.advance();
   return;
  }
  // Preserve the browser's tap-to-click synthesis, including on iOS Safari.
  if(['pointerdown','pointerup','touchstart'].includes(type)){
   event.stopImmediatePropagation();return;
  }
  if(!target?.closest('.view-message')) {
   event.preventDefault();event.stopImmediatePropagation();
  }
 },{capture:true,passive:false});
}
hideEvent();
// This design page starts by demonstrating an event; real event conditions are not defined here.
if(new URLSearchParams(location.search).get('event')==='demo')showEvent(samples[0],{record:false});
const input=document.querySelector('#mediaFile');
const popup=new NoticePopup({game:document.querySelector('#game')});
let startupRestoreError=null;
const visitorNamePopup=new VisitorNamePopup({game:document.querySelector('#game'),onRegister:name=>{gameRuntime.registerVisitorName(name);browserSave.resetFailure();return true;}});
function ensureVisitorName(){
 if(!startupNoticeShown)return;
 if(startupRestoreError){if(popup.open({type:'error',title:'保存データを復元できませんでした',message:startupRestoreError}))startupRestoreError=null;return;}
 if(needsVisitorName())visitorNamePopup.open();
}
// Native dialog close listeners release the shared modal owner first.
document.addEventListener('close',()=>setTimeout(ensureVisitorName,0),true);
let toastTimer;
function toast(text){const box=document.querySelector('#toast');box.textContent=text;box.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('is-visible'),2600);}
input.addEventListener('change',()=>{try{const file=input.files[0];if(file){view.setFile(file);toast('選んだ素材を端末内で表示しています。');}}catch(error){popup.open({type:'error',message:error.message});}input.value='';});
view.surface.addEventListener('dragover',event=>{event.preventDefault();view.surface.classList.add('is-dragging');});
view.surface.addEventListener('dragleave',()=>view.surface.classList.remove('is-dragging'));
view.surface.addEventListener('drop',event=>{event.preventDefault();view.surface.classList.remove('is-dragging');try{view.setFile(event.dataTransfer.files[0]);}catch(error){popup.open({type:'error',message:error.message});}});
const rankHint=new RankHint({trigger:document.querySelector('#rankTrigger'),game:document.querySelector('#game'),readRank:()=>document.querySelector('#rankValue').textContent,readGauges:()=>({experience:Number(document.querySelector('#experienceGauge').getAttribute('aria-valuenow'))/100,anger:Number(document.querySelector('#angerGauge').getAttribute('aria-valuenow'))/3})});
function validatePatrolTransfer(state){if(gameRuntime&&gameRuntime.scene!=='house')throw new Error('保存・読み込みは、ハウスで演出が終わってから行ってください。');if(state.location==='道中')throw new Error('この仮実装では道中のマップ・進行状態を保存／再開できません。ハウスで書き出したデータをご利用ください。');}
const optionsUI=new OptionsDialog({
 validateTransfer:validatePatrolTransfer,
 dialog:document.querySelector('#optionsDialog'),trigger:document.querySelector('#optionsTrigger'),game:document.querySelector('#game'),
 readGame:()=>gameRuntime?.snapshot()??null,
 onAssignTechnique:(slot,id)=>gameRuntime?.assignTechnique(slot,id)??false,
 onSuperConfiguration:id=>gameRuntime?.setSuperConfiguration(id)??false,
 onEquipAura:id=>gameRuntime?.equipAura(id)??false,
 onEquipItem:(kind,id)=>gameRuntime?.equipItem(kind,id)??false,
 onSelectMap:(id,tier='easy')=>{if(id==='training')return gameRuntime?.requestTraining(tier)??false;if(id==='patrol')return gameRuntime?.requestPatrol()??false;if(id==='house'){if(!gameRuntime?.cancelPatrol())return false;view.setHouse();setLocation('おこていゆハウス');hideEvent();return true;}return false;},
 readState:({browser=false}={})=>({rank:document.querySelector('#rankValue').textContent,location:document.querySelector('#locationName').textContent,gauges:{experience:Number(document.querySelector('#experienceGauge').getAttribute('aria-valuenow'))/100},rankPoints:rankHint.getPoints(),...(gameRuntime?{prototype:gameRuntime.exportProgress({browser})}: {})}),
 applyState:state=>{validatePatrolTransfer(state);gameRuntime?.importProgress(state.prototype);if(state.rankPoints!=null)setRankPoints(state.rankPoints);else setRank(state.rank);setLocation('おこていゆハウス');view.setHouse();gameRuntime?.sync();if(window.mainViewPreview?.browserSave?.initialized)window.mainViewPreview.browserSave.resetFailure();if(needsVisitorName()&&optionsUI.dialog.open)optionsUI.dialog.close();}

});
function setLocation(label){setPaintedText(document.querySelector('#locationName'),label,{background:'bronze',align:'center',lines:2});document.querySelector('#homeChoices').hidden=label!=='おこていゆハウス';}
function setRankLabel(rank){const value=document.querySelector('#rankValue');setPaintedText(value,String(rank),{background:'rank',align:'center'});value.style.setProperty('--rank-characters',String(String(rank).length));value.classList.toggle('is-long',String(rank).length>1);value.closest('.hero-rank').setAttribute('aria-label','ヒーローランク '+rank+'の説明');}
function setRank(rank){setRankLabel(rank);rankHint.clearPoints();}
function setRankPoints(points){const progress=getRankProgress(points);setRankLabel(progress.rank);rankHint.setPoints(progress.points);}

window.mainViewPreview={view,message,samples,showEvent,hideEvent,replayMessage,setLocation,setRank,setRankPoints,rankHint,areaMap,events,get eventVisible(){return eventVisible;}};

// Keep the legacy normalized experience value in saves; visible points are whole values.
function setGauges({experience,anger,calm}={}) {
 if(Number.isFinite(Number(experience))&&experience!==undefined){const percent=Math.round(Math.max(0,Math.min(1,Number(experience)))*100),meter=document.querySelector('#experienceGauge');if(meter){meter.setAttribute('aria-valuenow',String(percent));meter.querySelector('i').style.width=percent+'%';}}
 for(const [name,input,max]of [['calm',calm,99],['anger',anger===undefined?undefined:Number(anger)*3,3]]){
  if(input===undefined||!Number.isFinite(Number(input)))continue;const value=Math.max(0,Math.min(max,Math.round(Number(input)))),label=document.querySelector('#'+name+'Value');
  setPaintedText(label,name==='anger'?value+'/3':String(value),{background:'bronze',align:'center',immutableImage:true});
  const trigger=document.querySelector('#'+name+'Trigger');trigger?.setAttribute('aria-label',(name==='calm'?'穏やかポイント '+value:'怒りポイント '+value+'/3')+'。タップで説明');
  if(name==='anger')document.querySelector('#angerGauge')?.setAttribute('aria-valuenow',String(value));
 }
 rankHint.refresh();
}
window.mainViewPreview.setGauges=setGauges;

window.mainViewPreview.options=optionsUI;
window.mainViewPreview.popup=popup;
let startupNoticeShown=false;
export function showStartupNotice(){if(startupNoticeShown)return false;const shown=popup.showStartup();if(shown)startupNoticeShown=true;return shown;}
window.mainViewPreview.showStartupNotice=showStartupNotice;
if(!window.assetStartup)showStartupNotice();
if(new URLSearchParams(location.search).get('options')==='open')popup.dialog.addEventListener('close',()=>{if(!needsVisitorName())optionsUI.open();},{once:true});

document.querySelector('#collectionTrigger').addEventListener('click',event=>optionsUI.open('collection',event.currentTarget));
document.querySelector('#mapTrigger').addEventListener('click',event=>optionsUI.open('maps',event.currentTarget));

patrolUI=new PatrolUI({view,isSupportEquipped:()=>gameRuntime?.session.player.equipment.support==='moai_kun',mapPanel:areaMap,homeElement:document.querySelector('#homeChoices'),
 enemyProvider:(map,options)=>gameRuntime.session.makePatrolEnemies(map,options),
 onEncounter:(enemy,stage)=>gameRuntime.onEncounter(enemy,stage),
 onEnter:()=>{houseUI?.leaveHouse();setLocation('道中');},
 onLeave:({afterBattle=false}={})=>{if(gameRuntime){gameRuntime.pendingEncounter=null;gameRuntime.session.cancelPatrol();gameRuntime.scene='house';}houseUI?.arriveFromOutside?.({afterBattle});view.setHouse();setLocation('おこていゆハウス');events.dispatch({type:'move',text:'おこていゆハウスへ戻った。'},{showMessage:false});},
 onEvent:(event,options)=>events.dispatch(event,options),
 isPaused:()=>eventVisible||isModalBlocked(),hideMessage:hideEvent
});
window.mainViewPreview.patrol=patrolUI;
document.querySelector('[data-home-choice="interfere"]').addEventListener('click',()=>gameRuntime?.requestInterference());

const homeActionButtons=[['food','fridge_meal'],['chair','chair'],['bed','bed']].map(([choice,action])=>({action,button:document.querySelector('[data-home-choice="'+choice+'"]')}));
function syncHomeReservation(queuedAction=null){
 for(const {action,button} of homeActionButtons){
  if(!button)continue;const queued=action===queuedAction;button.dataset.queued=String(queued);
  const label=button.querySelector('.home-choice__label')?.textContent||'';button.setAttribute('aria-label',label+(queued?'（予約中）':''));button.title=queued?'予約中：今の動作が終わってから実行します':'';
  const arrow=button.querySelector('.home-choice__arrow');if(arrow){arrow.textContent=queued?'待':'›';arrow.title=queued?'予約中':'';}
 }
}
houseUI=new HouseUI({view,isSimulationPaused:()=>needsVisitorName()||eventVisible||Boolean(gameRuntime&&gameRuntime.scene!=='house'),readCharacter:()=>gameRuntime?.session.observation()??null,onMapUpdate:(life,metadata)=>areaMap.showHouse(life,metadata),isPaused:()=>eventVisible||isModalBlocked(),canExecuteAction:kind=>gameRuntime?.canExecuteHouseAction(kind)??true,onInspect:target=>events.dispatch({type:target.type,kind:'narration',speaker:'ナレーション',text:target.text},{showMessage:true}),onLifeEvent:event=>{
 gameRuntime?.onHouseEvent(event);
 if(event&&Object.hasOwn(event,'queuedAction'))syncHomeReservation(event.queuedAction);
 if(event&&typeof event.text==='string'&&event.text.trim())events.dispatch({type:event.type||'daily',text:event.text},{showMessage:false});
}});
window.mainViewPreview.house=houseUI;
for(const {action,button} of homeActionButtons){
 button?.addEventListener('click',()=>{
  if(eventVisible||isModalBlocked()||!houseUI.active)return;
  if(houseUI.requestAction?.(action))toast('指示を予約しました。今の動作が終わってから始めます。');
  else toast('3Dビューの準備ができてから、もう一度指示してください。');
 });
}
gameRuntime=new GameRuntime({view,house:houseUI,patrol:patrolUI,homeElement:document.querySelector('#homeChoices'),
 isPaused:()=>needsVisitorName()||eventVisible||isModalBlocked(),isModalPaused:()=>needsVisitorName()||isModalBlocked(),isMessageVisible:()=>eventVisible,
 showMessage:(payload,{record=true,showMessage=true}={})=>showMessage?showEvent(payload,{record}):events.dispatch(payload,{showMessage:false}),hideMessage:hideEvent,setLocation,setGauges,toast,readMessagePage:()=>({page:message.page,pages:message.pages.length}),advanceMessagePage:()=>message.advance()});
window.mainViewPreview.game=gameRuntime;
const browserSave=new BrowserSave({readState:()=>optionsUI.readState({browser:true}),applyState:state=>optionsUI.applyState(state),canSave:()=>gameRuntime.scene==='house'&&['home','patrol','training'].includes(gameRuntime.session.state.location)&&Boolean(houseUI.controller?.ready),onError:(text,error)=>{toast(text);if(browserSave.restoring)startupRestoreError=text+'\n'+(error?.message||'');}});
gameRuntime.onProgressChange=()=>{browserSave.saveNow();optionsUI.refreshGameView();};
window.addEventListener('pagehide',()=>browserSave.saveNow());document.addEventListener('visibilitychange',()=>{if(document.hidden)browserSave.saveNow();});
window.mainViewPreview.browserSave=browserSave;

rankHint.readGame=()=>gameRuntime.snapshot();
view.setHouse();

/** Initial WebGL preparation is coordinated by startup.js while the loading
 * modal owns input. Later scene changes continue to use the normal HouseUI API. */
export async function prepareInitialScene({retry=false}={}){
 const ready=await houseUI.prepareForStartup({retry});
 if(!ready)throw new Error(houseUI.controller?.lastError||'3D画面を準備できませんでした。WebGLに対応したブラウザで再試行してください。');
 browserSave.restoreOnce();
 if(!houseUI.controller?.renderFrames)throw new Error('最初の3D画面を表示できませんでした。もう一度お試しください。');
 return true;
}
window.mainViewPreview.prepareInitialScene=prepareInitialScene;
window.mainViewPreview.ready=()=>houseUI.controller?.ready===true;
