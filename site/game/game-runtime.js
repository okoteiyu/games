import {TECHNIQUES} from './technique-rules.js';
import {isInitialProgress,normalizeVisitorName,validateVisitorProgress} from './visitor-profile.js';
import {battleResultMessages,superUnlockMessage} from './battle-result.js';
import {normalizeMessageCategory} from './message-category.js';
import {currentTimeOfDay} from './world-time.js';
import {TRAINING_COURSES} from './encounter-rules.js';
import {SceneCutin} from './scene-cutin.js';
import { GameSession } from './game-session.js';
import { BattleUI } from './battle-ui.js';
import { AngerCutinPlayer } from './anger-cutin.js';
import { loadAssetBuffer } from './asset-store.js';
import {CutinRecovery} from './cutin-recovery.js';
import {INTERIOR_ROOMS,isInteriorScene,isBuildingVisitScene} from './interior-rules.js';

/** Connect the existing scenes to one persistent, renderer-independent session. */
export class GameRuntime {
 constructor({view,house,patrol,trainingHall,analysisRoom,interiorRooms={},homeElement,isPaused,isModalPaused,isMessageVisible,showMessage,hideMessage,setLocation,setGauges,toast,readMessagePage,advanceMessagePage}){
  Object.assign(this,{view,house,patrol,trainingHall,analysisRoom,homeElement,isPaused,isModalPaused,isMessageVisible,showMessage,hideMessage,setLocation,setGauges,toast,readMessagePage,advanceMessagePage});
  this.roomVisits={'analysis-room':analysisRoom,...interiorRooms};
  this.isPaused=()=>Boolean(this.recovery?.blocked)||Boolean(isPaused?.());this.isModalPaused=()=>Boolean(this.recovery?.blocked)||Boolean(isModalPaused?.());this.destroyed=false;this.frameEpoch=0;
  this.scene='house';this.messageLocked=false;this.manualClock=false;this.pendingEncounter=null;this.pendingCutin=false;this.resultDelay=null;this.resultCutinComplete=false;this.messages=[];this.resultMessages=[];this.resultMessageActive=false;this.resultMessagesComplete=true;this.activeRuntimeMessage=null;this.clearingMessage=false;this.lastAngerResult=null;this.battlePresentationSerial=0;
  this.session=new GameSession({onEvent:event=>this.onSessionEvent(event)});
  this.battleUI=new BattleUI({view,homeElement,isPaused:()=>this.isPaused()||document.hidden,canReturn:()=>this.canReturnHomeAfterBattle(),onCall:id=>this.requestBattleAction(id),onTarget:id=>this.requestBattleTarget(id),onReturn:()=>this.returnHomeAfterBattle(),onError:()=>this.toast('3Dの読み込みを再試行してください。戦闘の時計は停止しています。')});
  this.angerPlayer=new AngerCutinPlayer({view,prepareSource:(url,{signal})=>loadAssetBuffer(url,{signal}),isPaused:()=>this.isModalPaused()||document.hidden,
   onUtterance:payload=>{this.messageLocked=true;this.say({...payload,type:'anger'});},
   onComplete:result=>this.finishCutin(result),onError:()=>this.clearMessage(),
   onStateChange:state=>{if(['blocked','error'].includes(state.state))this.clearMessage();else if(state.state==='playing'&&state.cueSent&&!this.isMessageVisible())this.say({speaker:'おこていゆ',text:'ｵｺﾃｲﾕ',kind:'speech',type:'anger'},{record:false});}
  });
  this.sceneCutin=new SceneCutin({view,onComplete:kind=>this.finishSceneCutin(kind),onError:()=>this.toast('カットインの読み込みを再試行してください。')});
  this.recovery=new CutinRecovery({game:document.querySelector('#game')||view.element,getContext:()=>this.recoveryContext(),onSuspend:()=>this.angerPlayer.suspendForInterruption?.(),onContinue:context=>this.recoverInterruptedView(context),onResumed:()=>{this.restartFrameLoop();this.angerPlayer.synchronizePause();this.battleUI.updateControls();},onWake:()=>this.restartFrameLoop()});
  this.restartFrameLoop();this.sync();
 }
 recoveryContext(){
  if(this.destroyed)return null;
  if(this.scene==='battle'&&this.session.snapshotBattle())return {key:'battle:'+this.battlePresentationSerial,scene:'battle',title:'戦闘に復帰します',message:'戦闘の状態を保って、続きを再開します。'};
  if(this.scene==='scene-cutin')return {key:'scene:'+this.battlePresentationSerial+':'+this.sceneCutin.kind,scene:'scene-cutin',title:'ゲームに復帰します',message:['win','loss'].includes(this.sceneCutin.kind)?'戦闘の結果表示から再開します。':'出発の場面から再開します。'};
  if(this.scene==='analysis-room')return {key:'analysis:'+this.analysisVisitSerial,scene:'analysis-room',title:'ゲームに復帰します',message:'コンピュータ室の表示を再開します。'};
  if(isInteriorScene(this.scene))return {key:'interior:'+this.scene+':'+this.interiorVisitSerial,scene:'interior-room',roomId:this.scene,title:'ゲームに復帰します',message:INTERIOR_ROOMS[this.scene].title+'の表示を再開します。'};
  if(this.scene==='cutin')return {key:'anger:'+this.angerPlayer.completionCount,scene:'cutin',title:'ゲームに復帰します',message:'おこていゆの場面から、続きを再開します。'};
  return null;
 }
 async recoverInterruptedView(context){
  if(this.destroyed||this.recoveryContext()?.key!==context.key)return true;
  if(context.scene==='battle')return this.battleUI.recoverAfterInterruption();
  if(context.scene==='scene-cutin')return this.sceneCutin.recoverAfterInterruption();
  if(context.scene==='analysis-room')return this.analysisRoom.recoverAfterInterruption();
  if(context.scene==='interior-room')return this.roomVisits[context.roomId]?.recoverAfterInterruption()??false;
  if(context.scene==='cutin')return this.angerPlayer.recoverAfterInterruption();
  return true;
 }
 serviceRecovery(){
  const lost=this.scene==='battle'?this.battleUI.controller?.contextLost:this.scene==='scene-cutin'?this.sceneCutin.contextLost:isInteriorScene(this.scene)?this.roomVisits[this.scene]?.controller?.contextLost:false;
  if(lost&&!this.recovery?.blocked)this.recovery?.request('context-lost');
  this.recovery?.pump();
 }
 restartFrameLoop(){
  if(this.destroyed)return;cancelAnimationFrame(this.raf);const epoch=++this.frameEpoch;this.previousFrameAt=performance.now();
  const schedule=()=>{if(this.destroyed||epoch!==this.frameEpoch)return;this.raf=requestAnimationFrame(now=>{
   if(this.destroyed||epoch!==this.frameEpoch)return;this.raf=0;const dt=Math.min(.1,Math.max(0,(now-this.previousFrameAt)/1000));this.previousFrameAt=now;
   try{this.serviceRecovery();if(!this.manualClock)this.tick(dt);}
   catch(error){this.lastFrameError=error?.message||String(error);try{this.recovery?.request('frame-error');}catch{}}
   finally{schedule();}
  });};schedule();
 }
 say(payload,{record=true}={}){
  const value={speaker:'ナレーション',kind:'narration',...payload};value.category=normalizeMessageCategory(value.category,{kind:value.kind});
  this.activeRuntimeMessage=value;this.showMessage(value,{record});
 }
 /** Internal scene transitions must not acknowledge an unread acquisition. */
 clearMessage(){this.clearingMessage=true;try{this.hideMessage();}finally{this.clearingMessage=false;this.activeRuntimeMessage=null;}}
 enqueueMessages(messages){
  for(const payload of Array.isArray(messages)?messages:[messages]){
   if(!payload)continue;
   const id=payload.acquisitionId,queued=[this.activeRuntimeMessage,...this.messages,...this.resultMessages];
   if(id&&queued.some(value=>value?.acquisitionId===id))continue;
   this.messages.push(payload);
  }
 }
 enqueuePendingSuperUnlocks(){
  if(this.scene!=='house'&&!isBuildingVisitScene(this.scene))return;
  this.enqueueMessages((this.session.pendingSuperUnlockNotifications?.()||[]).map(superUnlockMessage));
 }
 showNextMessage(){
  if(this.messageLocked||this.isMessageVisible()||this.isModalPaused()||document.hidden||!this.session.state.visitorName)return false;
  if(this.resultMessageActive){
   if(!this.resultCutinComplete)return false;
   if(this.resultMessages.length){this.say(this.resultMessages.shift());return true;}
   this.resultMessageActive=false;this.resultMessagesComplete=true;this.battleUI.showReturn({cutin:true});return false;
  }
  if(this.scene==='house'||isBuildingVisitScene(this.scene)){
   this.enqueuePendingSuperUnlocks();
   if(this.messages.length){this.say(this.messages.shift());return true;}
  }
  return false;
 }
 log(type,text){this.showMessage({type,text},{record:true,showMessage:false});}
 isRelaxing(){return /^(eating|bed_lie|bed_rise|chair_sit|chair_rise)$/.test(this.house.controller?.life?.phase||'');}
 isHouseReady(){return Boolean(this.house.controller?.ready&&this.house.controller?.life);}
 registerVisitorName(value){
  const name=normalizeVisitorName(value);
  if(!name)throw new Error('名前を入力してください。');
  if(this.scene!=='house'||!isInitialProgress(this.session.state,this.house.getConsecutiveRelaxActions()))throw new Error('名前を登録できる初期状態ではありません。');
  this.session.state.visitorName=name;this.sync();return true;
 }
 homeCommands(){
  const commands=this.session.commandAvailability(this.house.getConsecutiveRelaxActions(),{isRelaxing:this.isRelaxing()});
  if(isBuildingVisitScene(this.scene))for(const key of ['patrol','meal','research','rest','food','chair','bed','interfere'])commands[key]=false;
  if(!this.isHouseReady()||!this.session.state.visitorName){
   for(const key of ['patrol','training','meal','research','rest','food','chair','bed','interfere'])commands[key]=false;
   commands.trainings=Object.fromEntries(Object.keys(commands.trainings).map(id=>[id,false]));
  }
  if(isInteriorScene(this.scene)){commands.training=false;commands.trainings=Object.fromEntries(Object.keys(commands.trainings).map(id=>[id,false]));}
  if(this.scene==='training-hall'&&!this.trainingHall?.ready){commands.training=false;commands.trainings=Object.fromEntries(Object.keys(commands.trainings).map(id=>[id,false]));}
  return commands;
 }
 snapshot(){return {...this.session.snapshot(),...(isBuildingVisitScene(this.scene)?{location:this.scene}:{}),scene:this.scene,canVisitTrainingHall:(this.scene==='house'||isInteriorScene(this.scene))&&this.isHouseReady()&&Boolean(this.session.state.visitorName)&&!this.session.state.pendingAngerEvent&&!this.pendingCutin,calmPoints:this.house.getConsecutiveRelaxActions(),relaxStreak:this.house.getConsecutiveRelaxActions(),homeCommands:this.homeCommands(),messageVisible:this.isMessageVisible(),messageLocked:this.messageLocked,lastAngerResult:this.lastAngerResult};}
 canExecuteHouseAction(kind){const key={meal:'meal',fridge_meal:'food',computer:'research',bed:'bed',chair:'chair'}[kind];return this.scene==='house'&&Boolean(this.homeCommands()[key]);}
 onHouseEvent(){this.sync();}
 sync(){
  const streak=this.house.getConsecutiveRelaxActions(),state=this.session.snapshot(),availability=this.homeCommands();
  const syncKey=JSON.stringify([this.scene,this.isPaused(),streak,state.player.level,state.player.xp,state.angerPoints,state.commandsLocked,state.pendingAngerEvent,availability]);
  if(syncKey===this.syncKey){this.onProgressChange?.();return;}this.syncKey=syncKey;
  for(const button of this.homeElement.querySelectorAll('[data-home-choice]')){
   const key=button.dataset.homeChoice;button.disabled=this.scene!=='house'||this.isPaused()||!availability[key];
   if(key==='interfere'){
    const bonus=Boolean(availability.interfereBonus),badge=button.querySelector('.home-choice__bonus');if(badge)badge.hidden=!bonus;button.dataset.bonus=String(bonus);
    button.title=bonus?'ボーナス：穏やかポイントを使わずにちょっかいをかけられます。':availability.interfere?'穏やかポイントを3使って、ちょっかいをかけます。':'穏やかポイントが3たまるか、次の戦闘から帰るまで待ちましょう。';
    button.setAttribute('aria-label','ちょっかいをかける。'+button.title);
   }
   else button.title='';
  }
  this.setGauges({experience:state.player.nextLevelExperience?state.player.xp/state.player.nextLevelExperience:1,anger:state.angerPoints/3,calm:streak});
  this.homeElement.dataset.commandsLocked=String(state.commandsLocked);
  document.querySelector('#homeChoicesTitle').textContent=state.commandsLocked?'そっと見守る':'どうする？';this.onProgressChange?.();
 }
 requestInterference(){
  if(this.isPaused()||document.hidden||this.scene!=='house')return {ok:false,reason:'paused'};
  if(!this.isHouseReady())return {ok:false,reason:'house-not-ready'};
  const result=this.session.requestInterference({relaxStreak:this.house.getConsecutiveRelaxActions(),spendCalmPoints:count=>this.house.spendCalmPoints(count),isRelaxing:this.isRelaxing()});this.sync();return result;
 }
 requestPatrol(){
  if(this.isPaused()||document.hidden||this.scene!=='house')return {ok:false,reason:'paused'};
  if(!this.isHouseReady())return {ok:false,reason:'house-not-ready'};
  const result=this.session.requestPatrol({relaxStreak:this.house.getConsecutiveRelaxActions(),spendCalmPoints:count=>this.house.spendCalmPoints(count)});
  if(result.ok){this.sync();this.pendingEncounter=null;this.departureDestination={kind:'patrol'};this.startSceneCutin('departure');}
  this.sync();return result;
 }
 requestTraining(tier='easy'){
  if(this.isPaused()||document.hidden||!['house','training-hall'].includes(this.scene))return {ok:false,reason:'paused'};
  if(!this.isHouseReady())return {ok:false,reason:'house-not-ready'};
  const fromHall=this.scene==='training-hall';if(fromHall&&!this.trainingHall?.ready)return {ok:false,reason:'training-hall-not-ready'};
  const result=this.session.requestTraining({relaxStreak:this.house.getConsecutiveRelaxActions(),tier,spendCalmPoints:count=>this.house.spendCalmPoints(count)});
  if(result.ok){
   // Persist the paid home checkpoint before the first battle frame, including
   // when the player is visiting B2 rather than departing from the house.
   this.sync();this.pendingEncounter=null;
   if(fromHall){this.trainingHall.deactivate();this.startBattle(result.enemy,{region:'training',timeOfDay:currentTimeOfDay(),encounterType:'training',trainingTier:tier});}
   else{this.departureDestination={kind:'training',tier,enemy:result.enemy};this.startSceneCutin('departure');}
  }
  this.sync();return result;
 }
 async visitTrainingHall(){
  if(this.isPaused()||document.hidden||!(this.scene==='house'||isInteriorScene(this.scene))||!this.isHouseReady()||!this.session.state.visitorName||this.session.state.pendingAngerEvent||this.pendingCutin)return false;
  this.deactivateRoomVisits();this.onProgressChange?.();this.clearMessage();this.scene='training-hall';this.setLocation('訓練所');this.homeElement.hidden=true;this.house.leaveHouse();this.onTrainingHallEntered?.();this.sync();
  const ready=await this.trainingHall.show();if(this.scene==='training-hall')this.sync();return ready;
 }
 deactivateRoomVisits(){for(const room of new Set(Object.values(this.roomVisits)))room?.deactivate();}
 visitAnalysisRoom(){return this.visitInterior('analysis-room');}
 async visitInterior(id){
  const room=this.roomVisits[id],definition=INTERIOR_ROOMS[id];
  if(!room||!definition||this.scene===id||this.isPaused()||document.hidden||!(this.scene==='house'||isBuildingVisitScene(this.scene))||!this.isHouseReady()||!this.session.state.visitorName||this.session.state.pendingAngerEvent||this.pendingCutin)return false;
  this.onProgressChange?.();this.trainingHall?.deactivate();this.deactivateRoomVisits();this.clearMessage();this.scene=id;this.interiorVisitSerial=(this.interiorVisitSerial||0)+1;if(id==='analysis-room')this.analysisVisitSerial=(this.analysisVisitSerial||0)+1;this.setLocation(definition.title);this.homeElement.hidden=true;this.house.leaveHouse();if(id==='analysis-room')this.onAnalysisRoomEntered?.();else this.onInteriorEntered?.(id);this.sync();
  const ready=await room.show(id);if(this.scene===id)this.sync();return this.scene===id&&ready;
 }
 returnFromAnalysisRoom(){return this.scene==='analysis-room'&&this.returnFromInteriorRoom();}
 returnFromInteriorRoom(){
  if(!isInteriorScene(this.scene)||!this.roomVisits[this.scene]||this.isPaused()||document.hidden)return false;
  this.roomVisits[this.scene].deactivate();this.scene='house';this.setLocation('おこていゆハウス');this.house.arriveFromOutside({afterBattle:false});this.view.setHouse();this.messages=[];this.clearMessage();this.sync();return true;
 }
 returnFromTrainingHall(){
  if(this.scene!=='training-hall'||this.isPaused()||document.hidden)return false;
  this.trainingHall.deactivate();this.scene='house';this.setLocation('おこていゆハウス');this.house.arriveFromOutside({afterBattle:false});this.view.setHouse();this.messages=[];this.clearMessage();this.sync();return true;
 }
 onSessionEvent(event){
  if(event.type==='anger-point'){
   if(event.calmPointsCost&&!event.calmCostCommitted)this.house.spendCalmPoints(event.calmPointsCost);
   const bonusNote=event.bonusUsed?'\nボーナスのため、穏やかポイントは減りませんでした。':'';
   this.say({type:'anger',text:(event.reason==='relax-interference'?'少しむっとしたようだ。何か、おいしいものでも用意しようか。':'まだ、ひと息つきたかったようだ。しばらく、そっとしておこう。')+bonusNote});
  }else if((event.type==='training-start'||event.type==='patrol-start')&&!event.calmCostCommitted)this.house.spendCalmPoints(event.calmPointsCost);
  else if(event.type==='anger-ready')this.pendingCutin=true;
  else if(event.type==='battle-end')this.resultDelay=.5;
  else if(event.type==='damage'){const allied=event.actor==='player'||event.actor==='support';this.log(allied?'action':'enemy',(event.actorName||(allied?'おこていゆ':'珍生物'))+'の攻撃。'+Number(event.amount.toFixed(2))+'のダメージ。');}
  else if(event.type==='super-start')this.log('growth',(event.name||'スーパーおこていゆ状態')+'！ 攻撃力・気・行動速度が'+event.multiplier+'倍。');
  else if(event.type==='battle-call')this.log('action',event.technique==='auto'?'かけごえをやめて、そっと見守る。':(TECHNIQUES[event.technique]?.name||'技')+'のかけごえを送った。');
  else if(event.type==='aura-equipped')this.log('action',event.speciesId?this.session.player.auras[event.speciesId].name+'を纏った。':'オーラを外した。');
  if(this.scene==='battle'){this.onBattleEvent?.(event);this.battleUI.handleEvent(event);}
 }
 onEncounter(enemy,stage){if(this.scene!=='patrol'||!enemy)return false;this.pendingEncounter={enemy,stage};return true;}
 onMessageClosed(){
  if(this.clearingMessage){this.sync();return;}
  if(this.messageLocked){this.sync();return;}
  const previous=this.activeRuntimeMessage;this.activeRuntimeMessage=null;
  if(previous?.superUnlockId)this.session.acknowledgeSuperUnlock?.(previous.superUnlockId);
  this.showNextMessage();this.sync();
 }
 tick(dt){
  this.serviceRecovery();
  if(this.scene==='scene-cutin'&&['win','loss'].includes(this.sceneCutin.kind))this.battleUI.showReturn({cutin:true});
  if(this.recovery?.blocked){this.recovery.pump();return false;}
  if(this.scene==='scene-cutin'){if(!this.isModalPaused()&&!document.hidden)this.sceneCutin.advance(dt);this.sync();return true;}
  this.sync();if(this.scene==='battle')this.battleUI.updateControls();if(this.scene==='battle')this.battleUI.controller?.setTimeOfDay(currentTimeOfDay());this.enqueuePendingSuperUnlocks();if(this.isPaused()||document.hidden)return false;
  if(this.showNextMessage())return true;
  if(this.scene==='training-hall'){this.trainingHall.advance(dt);return true;}
  if(isInteriorScene(this.scene)){this.roomVisits[this.scene]?.advance(dt);return true;}
  if(this.pendingCutin&&this.scene==='house'){this.startCutin();return true;}
  if(this.pendingEncounter&&this.scene==='patrol'){const {enemy,stage}=this.pendingEncounter;this.pendingEncounter=null;this.startBattle(enemy,stage);return true;}
  if(this.scene==='battle'&&this.battleUI.ready){
   if(this.battleUI.controller?.cutin||this.session.isSuperAwakening()){this.advanceSuperAwakening(dt);return true;}
   const wasEnded=this.session.snapshotBattle()?.phase==='ended';
   const resultReadyBeforeAdvance=this.battleUI.resultReady;
   const battleTimeBefore=this.session.snapshotBattle()?.time||0;
   this.session.update(dt,{pauseOnSuperAwakening:true});const snapshot=this.session.snapshotBattle();this.battleUI.setSnapshot(snapshot);
   if(this.session.isSuperAwakening()){
    // Automatic/queued awakening may start halfway through this frame.
    this.advanceSuperAwakening(Math.max(0,dt-(snapshot.time-battleTimeBefore)));return true;
   }
   this.battleUI.advance(dt);
   if(wasEnded&&this.resultDelay!==null&&!this.battleUI.controller?.cutin){
    this.resultDelay=Math.max(0,this.resultDelay-dt);
    // Keep the final fatigue pose visible for a frame before replacing the view.
    if(this.resultDelay===0&&resultReadyBeforeAdvance&&this.battleUI.resultReady){this.resultDelay=null;this.startSceneCutin(this.session.snapshotBattle().result);}
   }
  }
  return true;
 }
 advanceSuperAwakening(dt){
  this.battleUI.advance(dt);
  if(this.battleUI.ready&&!this.battleUI.controller?.cutin&&this.session.completeSuperAwakening()){
   this.battleUI.setSnapshot(this.session.snapshotBattle());this.battleUI.advance(0);
  }
 }
 startBattle(enemy,stage={}){
  this.patrol.suspendForBattle();this.scene='battle';this.setLocation(stage.encounterType==='training'?(TRAINING_COURSES[stage.trainingTier]?.label||'訓練（易）'):'戦闘');
  this.resultCutinComplete=false;this.resultMessages=[];this.resultMessageActive=false;this.resultMessagesComplete=true;const snapshot=this.session.startBattle(enemy,{kind:stage.encounterType==='training'?'training':'patrol'});this.resultDelay=null;this.battleUI.start(snapshot,{...stage,presentationId:'battle-'+(++this.battlePresentationSerial)});this.sync();return snapshot;
 }
 requestBattleAction(id){if(this.scene!=='battle'||this.isPaused()||document.hidden||!this.battleUI.ready)return {ok:false,reason:'paused'};const result=this.session.requestBattleAction(id);this.battleUI.setSnapshot(this.session.snapshotBattle());return result;}
 requestBattleTarget(id){
  if(this.scene!=='battle'||this.isPaused()||document.hidden||!this.battleUI.ready||this.battleUI.blocked?.()||this.session.isSuperAwakening())return {ok:false,reason:'paused'};
  const result=this.session.requestBattleTarget(id);if(result.ok)this.battleUI.setSnapshot(this.session.snapshotBattle());return result;
 }
 startSceneCutin(kind){
  if(['win','loss'].includes(kind)&&(this.scene!=='battle'||!this.battleUI.resultReady))return false;
  this.resultCutinComplete=false;this.messageLocked=true;this.clearMessage();this.scene='scene-cutin';this.homeElement.hidden=true;this.battleUI.hud.hidden=true;
  if(kind==='departure')this.battleUI.panel.hidden=true;else this.battleUI.showReturn({cutin:true});
  this.resultMessages=[];this.resultMessageActive=false;this.resultMessagesComplete=kind==='departure';if(kind!=='departure')this.showBattleResult();
  this.sceneCutin.play(kind);this.sync();
 }
 finishSceneCutin(kind){
  // Ignore stale or duplicate completion callbacks; only a paid departure may enter the route.
  if(this.scene!=='scene-cutin'||this.sceneCutin.kind!==kind)return false;
  if(kind==='departure'&&(!this.departureDestination||this.session.state.location!==this.departureDestination.kind))return false;
  if(kind!=='departure'){
   if(!this.sceneCutin.completed||this.resultCutinComplete)return false;
   this.resultCutinComplete=true;this.messageLocked=false;this.battleUI.showReturn({cutin:true});this.sync();return true;
  }
  this.sceneCutin.stop();this.messageLocked=false;this.clearMessage();
  if(kind==='departure'){
   const destination=this.departureDestination;this.departureDestination=null;
   if(destination?.kind==='training'){this.startBattle(destination.enemy,{region:'training',timeOfDay:currentTimeOfDay(),encounterType:'training',trainingTier:destination.tier});this.sync();return;}
   this.scene='patrol';if(!this.patrol.start()){this.session.cancelPatrol();this.scene='house';this.view.setHouse();this.setLocation('おこていゆハウス');this.toast('道中の準備ができませんでした。もう一度お試しください。');}
  }
  this.sync();
  return true;
 }
 // Every result category and every two-line page waits for the player's tap.
 advanceResultMessage(){return false;}
 showBattleResult(){
  const battle=this.session.snapshotBattle()||this.session.state.lastBattle;if(!battle)return false;
  const unlocks=this.session.pendingSuperUnlockNotifications?.()||battle.rewards?.superUnlocks||[],ids=new Set(unlocks.map(unlock=>unlock.acquisitionId||'super-configuration:'+unlock.id));
  this.messages=this.messages.filter(payload=>!ids.has(payload.acquisitionId));
  this.resultMessages=battleResultMessages(battle,{superUnlocks:unlocks});this.resultMessageActive=true;this.resultMessagesComplete=false;
  this.say(this.resultMessages.shift());return true;
 }
 canReturnHomeAfterBattle(){
  return Boolean(this.scene==='scene-cutin'&&['win','loss'].includes(this.sceneCutin.kind)&&this.resultCutinComplete&&this.resultMessagesComplete&&!this.resultMessageActive&&!this.isMessageVisible()&&this.sceneCutin.completed&&this.sceneCutin.ready&&this.sceneCutin.active&&!this.sceneCutin.contextLost&&!this.isModalPaused()&&!document.hidden&&this.session.state.battle?.phase==='ended');
 }
 returnHomeAfterBattle(){
  if(!this.canReturnHomeAfterBattle())return false;
  if(!this.session.returnHomeAfterBattle())return false;
  this.sceneCutin.stop();this.resultCutinComplete=false;this.messageLocked=false;this.battleUI.deactivate();this.setLocation('おこていゆハウス');this.scene='house';this.house.arriveFromOutside({afterBattle:true});this.view.setHouse();this.sync();
  this.messages=[];this.resultMessages=[];this.resultMessageActive=false;this.resultMessagesComplete=true;this.clearMessage();return true;
 }
 cancelPatrol(){if(isInteriorScene(this.scene))return this.returnFromInteriorRoom();if(this.scene==='training-hall')return this.returnFromTrainingHall();if(['battle','cutin','scene-cutin'].includes(this.scene)){this.toast('この場面が終わるまで、移動できません。');return false;}this.pendingEncounter=null;if(this.scene==='patrol'){this.session.cancelPatrol({rotateStaff:true});this.patrol.returnHome();this.scene='house';}this.sync();return true;}
 startCutin(){
  this.pendingCutin=false;this.scene='cutin';this.messageLocked=true;this.clearMessage();this.homeElement.hidden=true;this.house.leaveHouse();this.angerPlayer.play();this.sync();
 }
 finishCutin(result){
  this.messageLocked=false;this.clearMessage();this.scene='house';this.view.setHouse();this.setLocation('おこていゆハウス');
  this.lastAngerResult=this.session.resolveAngerEvent();const outcome=this.lastAngerResult;
  if(!result.utteranceSent)this.enqueueMessages({type:'anger',speaker:'おこていゆ',kind:'speech',category:'conversation',text:'ｵｺﾃｲﾕ'});
  this.enqueueMessages({type:'anger',category:'narration',text:'おこていゆイベントが起きた。'});
  let text='おこていゆは少しむっとして、ひと息ついた。',category='narration';
  if(outcome?.id==='super_state_level_up'){
   category='experience';const name=outcome.superName||'スーパーおこていゆ状態',level=outcome.superConfigurationLevel??outcome.superLevel;
   text=outcome.changed?name+'のレベルが'+level+'に上がった！':name+'は、すでに最高レベルだ。';
  }else if(outcome?.techniqueId){
   const name=outcome.techniqueName||TECHNIQUES[outcome.techniqueId]?.name||'技';category=outcome.newlyLearned?'item':outcome.changed?'experience':'narration';
   text=outcome.newlyLearned?name+'を取得した！ コレクションの「技」から設定できます。':outcome.changed?name+'が少し上達した！':name+'は、すでに最高レベルだ。';
  }
  this.enqueueMessages({type:outcome?.changed?'growth':'anger',category,text});this.sync();
 }
 exportProgress({browser=false}={}){if(this.scene!=='house'&&!(browser&&isBuildingVisitScene(this.scene)))throw new Error('ハウスに戻り、演出が終わってから保存してください。');return {session:this.session.exportState({allowPending:browser,allowDepartureCheckpoint:browser}),relaxStreak:this.house.getConsecutiveRelaxActions()};}
 importProgress(progress){if(this.scene!=='house'||this.session.state.pendingAngerEvent)throw new Error('ハウスで演出が終わってから読み込んでください。');validateVisitorProgress(progress?.session,progress?.relaxStreak);this.session.importState(progress.session);this.messages=[];this.resultMessages=[];this.resultMessageActive=false;this.resultMessagesComplete=true;this.clearMessage();this.pendingCutin=this.session.state.pendingAngerEvent;this.house.leaveHouse();this.house.arriveFromOutside({afterBattle:false});this.house.restoreConsecutiveRelaxActions(progress.relaxStreak);this.session.state.interferenceUsedSinceBattle=false;this.sync();}
 assignTechnique(slot,id){if(this.scene!=='house')return false;const accepted=this.session.assignTechnique(slot,id);this.sync();return accepted;}
 setSuperConfiguration(id){if(this.scene!=='house')return false;const accepted=this.session.setSuperConfiguration(id);this.sync();return accepted;}
 equipItem(kind,id){if(this.scene!=='house')return false;const accepted=this.session.equipItem(kind,id);this.house.updateLifeStatus();this.sync();return accepted;}
 equipAura(id){if(this.scene!=='house')return false;const accepted=this.session.equipAura(id);this.sync();return accepted;}
 advanceForPreview(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>300||this.isPaused()||document.hidden)return false;
  for(let remaining=seconds;remaining>1e-8;remaining-=.1){const dt=Math.min(.1,remaining);if(this.isPaused()||document.hidden)break;if(this.scene==='house')this.house.controller?.advanceForPreview(dt);else if(this.scene==='patrol'&&this.patrol.active)this.patrol.tick(dt);this.tick(dt);}return this.snapshot();
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;this.frameEpoch++;cancelAnimationFrame(this.raf);this.recovery?.destroy();this.trainingHall?.destroy();for(const room of new Set(Object.values(this.roomVisits)))room?.destroy();this.battleUI.destroy();this.angerPlayer.destroy();this.sceneCutin.destroy();}
}
