import {TECHNIQUES} from './technique-rules.js';
import {isInitialProgress,normalizeVisitorName,validateVisitorProgress} from './visitor-profile.js';
import {battleResultMessage} from './battle-result.js';
import {currentTimeOfDay} from './world-time.js';
import {TRAINING_COURSES} from './encounter-rules.js';
import {SceneCutin} from './scene-cutin.js';
import { GameSession } from './game-session.js';
import { BattleUI } from './battle-ui.js';
import { AngerCutinPlayer } from './anger-cutin.js';
import { loadAssetBuffer } from './asset-store.js';

/** Connect the existing scenes to one persistent, renderer-independent session. */
export class GameRuntime {
 constructor({view,house,patrol,homeElement,isPaused,isModalPaused,isMessageVisible,showMessage,hideMessage,setLocation,setGauges,toast,readMessagePage,advanceMessagePage}){
  Object.assign(this,{view,house,patrol,homeElement,isPaused,isModalPaused,isMessageVisible,showMessage,hideMessage,setLocation,setGauges,toast,readMessagePage,advanceMessagePage});
  this.scene='house';this.messageLocked=false;this.manualClock=false;this.pendingEncounter=null;this.pendingCutin=false;this.resultDelay=null;this.messages=[];this.lastAngerResult=null;
  this.session=new GameSession({onEvent:event=>this.onSessionEvent(event)});
  this.battleUI=new BattleUI({view,homeElement,isPaused:()=>this.isPaused()||document.hidden,onCall:id=>this.requestBattleAction(id),onReturn:()=>this.returnHomeAfterBattle(),onError:()=>this.toast('3Dの読み込みを再試行してください。戦闘の時計は停止しています。')});
  this.angerPlayer=new AngerCutinPlayer({view,prepareSource:(url,{signal})=>loadAssetBuffer(url,{signal}),isPaused:()=>this.isModalPaused()||document.hidden,
   onUtterance:payload=>{this.messageLocked=true;this.say({...payload,type:'anger'});},
   onComplete:result=>this.finishCutin(result),onError:()=>this.hideMessage(),
   onStateChange:state=>{if(['blocked','error'].includes(state.state))this.hideMessage();else if(state.state==='playing'&&state.cueSent&&!this.isMessageVisible())this.say({speaker:'おこていゆ',text:'ｵｺﾃｲﾕ',kind:'speech',type:'anger'},{record:false});}
  });
  this.sceneCutin=new SceneCutin({view,onComplete:kind=>this.finishSceneCutin(kind),onError:()=>this.toast('カットインの読み込みを再試行してください。')});
  let previous=performance.now();const frame=now=>{const dt=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;if(!this.manualClock)this.tick(dt);this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);this.sync();
 }
 say(payload,{record=true}={}){this.showMessage({speaker:'ナレーション',kind:'narration',...payload},{record});}
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
  if(!this.isHouseReady()||!this.session.state.visitorName){
   for(const key of ['patrol','training','meal','research','rest','food','chair','bed','interfere'])commands[key]=false;
   commands.trainings=Object.fromEntries(Object.keys(commands.trainings).map(id=>[id,false]));
  }
  return commands;
 }
 snapshot(){return {...this.session.snapshot(),scene:this.scene,calmPoints:this.house.getConsecutiveRelaxActions(),relaxStreak:this.house.getConsecutiveRelaxActions(),homeCommands:this.homeCommands(),messageVisible:this.isMessageVisible(),messageLocked:this.messageLocked,lastAngerResult:this.lastAngerResult};}
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
  if(this.isPaused()||document.hidden||this.scene!=='house')return {ok:false,reason:'paused'};
  if(!this.isHouseReady())return {ok:false,reason:'house-not-ready'};
  const result=this.session.requestTraining({relaxStreak:this.house.getConsecutiveRelaxActions(),tier,spendCalmPoints:count=>this.house.spendCalmPoints(count)});
  if(result.ok){this.sync();this.pendingEncounter=null;this.departureDestination={kind:'training',tier,enemy:result.enemy};this.startSceneCutin('departure');}
  this.sync();return result;
 }
 onSessionEvent(event){
  if(event.type==='anger-point'){
   if(event.calmPointsCost&&!event.calmCostCommitted)this.house.spendCalmPoints(event.calmPointsCost);
   const bonusNote=event.bonusUsed?'\nボーナスのため、穏やかポイントは減りませんでした。':'';
   this.say({type:'anger',text:(event.reason==='relax-interference'?'少しむっとしたようだ。何か、おいしいものでも用意しようか。':'まだ、ひと息つきたかったようだ。しばらく、そっとしておこう。')+bonusNote});
  }else if((event.type==='training-start'||event.type==='patrol-start')&&!event.calmCostCommitted)this.house.spendCalmPoints(event.calmPointsCost);
  else if(event.type==='anger-ready')this.pendingCutin=true;
  else if(event.type==='battle-end')this.resultDelay=.5;
  else if(event.type==='damage')this.log(event.actor!=='player'?'enemy':'action',(event.actorName||(event.actor!=='player'?'珍生物':'おこていゆ'))+'の攻撃。'+Number(event.amount.toFixed(2))+'のダメージ。');
  else if(event.type==='super-start')this.log('growth','スーパーおこていゆ状態！ 攻撃力・気・行動速度が'+event.multiplier+'倍。');
  else if(event.type==='battle-call')this.log('action',event.technique==='auto'?'かけごえをやめて、そっと見守る。':(TECHNIQUES[event.technique]?.name||'技')+'のかけごえを送った。');
  else if(event.type==='aura-equipped')this.log('action',event.speciesId?this.session.player.auras[event.speciesId].name+'を纏った。':'オーラを外した。');
  if(this.scene==='battle')this.battleUI.handleEvent(event);
 }
 onEncounter(enemy,stage){if(this.scene!=='patrol'||!enemy)return false;this.pendingEncounter={enemy,stage};return true;}
 onMessageClosed(){this.sync();}
 tick(dt){
  if(this.scene==='scene-cutin'){if(!this.isModalPaused()&&!document.hidden){this.advanceResultMessage(dt);this.sceneCutin.advance(dt);}return true;}
  this.sync();if(this.scene==='battle')this.battleUI.updateControls();if(this.scene==='battle')this.battleUI.controller?.setTimeOfDay(currentTimeOfDay());if(this.isPaused()||document.hidden)return false;
  if(this.pendingCutin&&this.scene==='house'){this.startCutin();return true;}
  if(this.pendingEncounter&&this.scene==='patrol'){const {enemy,stage}=this.pendingEncounter;this.pendingEncounter=null;this.startBattle(enemy,stage);return true;}
  if(this.messages.length){this.say(this.messages.shift());return true;}
  if(this.scene==='battle'&&this.battleUI.ready){
   const wasEnded=this.session.snapshotBattle()?.phase==='ended';
   this.session.update(dt);this.battleUI.setSnapshot(this.session.snapshotBattle());this.battleUI.advance(dt);
   if(wasEnded&&this.resultDelay!==null&&!this.battleUI.controller?.cutin){this.resultDelay-=dt;if(this.resultDelay<=0){this.resultDelay=null;this.startSceneCutin(this.session.snapshotBattle().result);}}
  }
  return true;
 }
 startBattle(enemy,stage={}){
  this.patrol.suspendForBattle();this.scene='battle';this.setLocation(stage.encounterType==='training'?(TRAINING_COURSES[stage.trainingTier]?.label||'訓練（易）'):'戦闘');
  const snapshot=this.session.startBattle(enemy,{kind:stage.encounterType==='training'?'training':'patrol'});this.battleUI.start(snapshot,stage);this.sync();return snapshot;
 }
 requestBattleAction(id){if(this.scene!=='battle'||this.isPaused()||document.hidden||!this.battleUI.ready)return {ok:false,reason:'paused'};const result=this.session.requestBattleAction(id);this.battleUI.setSnapshot(this.session.snapshotBattle());return result;}
 startSceneCutin(kind){
  this.messageLocked=true;this.hideMessage();this.scene='scene-cutin';this.homeElement.hidden=true;this.battleUI.hud.hidden=true;this.battleUI.panel.hidden=true;
  this.resultMessageElapsed=0;if(kind!=='departure')this.showBattleResult();
  this.sceneCutin.play(kind);this.sync();
 }
 finishSceneCutin(kind){
  // Ignore stale or duplicate completion callbacks; only a paid departure may enter the route.
  if(this.scene!=='scene-cutin'||this.sceneCutin.kind!==kind)return false;
  if(kind==='departure'&&(!this.departureDestination||this.session.state.location!==this.departureDestination.kind))return false;
  this.sceneCutin.stop();this.messageLocked=false;this.hideMessage();
  if(kind==='departure'){
   const destination=this.departureDestination;this.departureDestination=null;
   if(destination?.kind==='training'){this.startBattle(destination.enemy,{region:'training',timeOfDay:currentTimeOfDay(),encounterType:'training',trainingTier:destination.tier});this.sync();return;}
   this.scene='patrol';if(!this.patrol.start()){this.session.cancelPatrol();this.scene='house';this.view.setHouse();this.setLocation('おこていゆハウス');this.toast('道中の準備ができませんでした。もう一度お試しください。');}
  }else{
   this.scene='battle';this.returnHomeAfterBattle({automatic:true});
  }
  this.sync();
  return true;
 }
 advanceResultMessage(dt){
  if(!['win','loss'].includes(this.sceneCutin.kind)||!this.sceneCutin.ready||!this.readMessagePage)return;
  const {page,pages}=this.readMessagePage();if(pages<=1)return;
  // Long results stay in the cutin, showing every two-line page automatically.
  const secondsPerPage=2.5;this.sceneCutin.duration=Math.max(this.sceneCutin.duration,pages*secondsPerPage);
  this.resultMessageElapsed+=Math.max(0,dt);
  const wanted=Math.min(pages-1,Math.floor(this.resultMessageElapsed/secondsPerPage));
  for(let i=page;i<wanted;i++)this.advanceMessagePage?.();
 }
 showBattleResult(){
  const battle=this.session.snapshotBattle()||this.session.state.lastBattle;if(battle)this.say(battleResultMessage(battle));
 }
 returnHomeAfterBattle({automatic=false}={}){
  if((!automatic&&(this.isPaused()||document.hidden))||this.scene!=='battle'||this.resultDelay!==null)return false;
  if(!this.session.returnHomeAfterBattle())return false;
  this.battleUI.deactivate();this.setLocation('おこていゆハウス');this.scene='house';this.house.arriveFromOutside({afterBattle:true});this.view.setHouse();this.sync();
  this.messages=[];this.hideMessage();return true;
 }
 cancelPatrol(){if(['battle','cutin','scene-cutin'].includes(this.scene)){this.toast('この場面が終わるまで、移動できません。');return false;}this.pendingEncounter=null;if(this.scene==='patrol'){this.session.cancelPatrol();this.patrol.returnHome();this.scene='house';}this.sync();return true;}
 startCutin(){
  this.pendingCutin=false;this.scene='cutin';this.messageLocked=true;this.hideMessage();this.homeElement.hidden=true;this.house.leaveHouse();this.angerPlayer.play();this.sync();
 }
 finishCutin(result){
  this.messageLocked=false;this.hideMessage();this.scene='house';this.view.setHouse();this.setLocation('おこていゆハウス');
  this.lastAngerResult=this.session.resolveAngerEvent();const outcome=this.lastAngerResult;
  if(!result.utteranceSent)this.messages.push({type:'anger',speaker:'おこていゆ',kind:'speech',text:'ｵｺﾃｲﾕ'});
  let text='おこていゆは少しむっとして、ひと息ついた。';
  if(outcome?.id==='super_state_level_up')text=outcome.changed?'スーパーおこていゆ状態が少し強くなった！':'スーパーおこていゆ状態は、すでに最高レベルだ。';
  if(outcome?.id==='unlock_energy_ray')text=outcome.newlyLearned?'エネルギーレイを取得した！ コレクションの「技」から設定できる。':outcome.changed?'エネルギーレイが少し上達した！':'エネルギーレイを取得した。';
  if(outcome?.id==='punch_level_up')text=outcome.changed?'パンチが少し上達した！':'パンチを取得した。';
  if(outcome?.techniqueId&&!['punch','energy_ray'].includes(outcome.techniqueId))text=outcome.newlyLearned?outcome.techniqueName+'を取得した！ コレクションの「技」から設定できる。':outcome.techniqueName+'が少し上達した！';
  this.messages.push({type:outcome?.changed?'growth':'anger',text:'おこていゆイベントが起きた。 '+text});this.sync();
 }
 exportProgress({browser=false}={}){if(this.scene!=='house')throw new Error('ハウスに戻り、演出が終わってから保存してください。');return {session:this.session.exportState({allowPending:browser,allowDepartureCheckpoint:browser}),relaxStreak:this.house.getConsecutiveRelaxActions()};}
 importProgress(progress){if(this.scene!=='house'||this.session.state.pendingAngerEvent)throw new Error('ハウスで演出が終わってから読み込んでください。');validateVisitorProgress(progress?.session,progress?.relaxStreak);this.session.importState(progress.session);this.pendingCutin=this.session.state.pendingAngerEvent;this.house.leaveHouse();this.house.arriveFromOutside({afterBattle:false});this.house.restoreConsecutiveRelaxActions(progress.relaxStreak);this.session.state.interferenceUsedSinceBattle=false;this.sync();}
 assignTechnique(slot,id){if(this.scene!=='house')return false;const accepted=this.session.assignTechnique(slot,id);this.sync();return accepted;}
 setSuperConfiguration(id){if(this.scene!=='house')return false;const accepted=this.session.setSuperConfiguration(id);this.sync();return accepted;}
 equipItem(kind,id){if(this.scene!=='house')return false;const accepted=this.session.equipItem(kind,id);this.house.updateLifeStatus();this.sync();return accepted;}
 equipAura(id){if(this.scene!=='house')return false;const accepted=this.session.equipAura(id);this.sync();return accepted;}
 advanceForPreview(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>300||this.isPaused()||document.hidden)return false;
  for(let remaining=seconds;remaining>1e-8;remaining-=.1){const dt=Math.min(.1,remaining);if(this.isPaused()||document.hidden)break;if(this.scene==='house')this.house.controller?.advanceForPreview(dt);else if(this.scene==='patrol'&&this.patrol.active)this.patrol.tick(dt);this.tick(dt);}return this.snapshot();
 }
 destroy(){cancelAnimationFrame(this.raf);this.battleUI.destroy();this.angerPlayer.destroy();this.sceneCutin.destroy();}
}
