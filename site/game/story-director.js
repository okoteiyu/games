import {STORY_CHAPTERS,STORY_ARCS} from './story-content.js';
import {StoryUI} from './story-ui.js';
import {StoryStage} from './story-stage.js';
import {GameSession,applyStoryBattleRewards} from './game-session.js';
import {isStoryEpisodeAvailable,startStoryEpisode,checkpointStoryScene,completeStoryEpisode,hasStoryBattleReward,getStoryArcChapter} from './story-progress.js';
import {STAFF_SILHOUETTE_URL} from './scene-conversation.js';
import {currentTimeOfDay} from './world-time.js';
import {normalizeVisitorName} from './visitor-profile.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const stageNames={'headquarters':'ヒーロー会 本拠点',road:'引っ越しの道中',house:'おこていゆハウス',outdoor:'おこていゆハウス 屋外',black:'物語','computer-room':'コンピュータ室',lounge:'休憩室','player-room':'あなたの部屋','training-hall':'訓練所'};

/** Authored data, playback, and persistent progress have separate owners.
 * Story battles use the ordinary combat engine; each scene chooses a preset
 * or the current profile. Only its first victory transfers persistent rewards. */
export class StoryDirector {
 constructor({runtime,view,game,homeElement,contextElement,onCheckpoint=()=>{},onOpenMap=()=>false,onRequestRegistration=()=>{}}){
  Object.assign(this,{runtime,view,onCheckpoint,onOpenMap,onRequestRegistration});this.primarySession=runtime.session;
  this.active=false;this.replay=false;this.paused=false;this.loading=false;this.error=null;this.serial=0;this.autoSuppressed=false;this.battlePending=false;
  this.stage=this.createStage();
  this.ui=new StoryUI({view,game,homeElement,contextElement,chapters:STORY_CHAPTERS,arcs:STORY_ARCS,readProgress:()=>this.progress,
   onEpisode:(id,options)=>this.start(id,options),onNextEpisode:id=>this.start(id),onExit:()=>this.exit(),onFinish:()=>this.exit(),onPause:paused=>this.setPaused(paused),onChoice:index=>this.choose(index),onRegister:()=>this.awaitingRegistration&&this.onRequestRegistration(),onOpenMap:opener=>this.canExplore&&this.onOpenMap(opener),onError:error=>this.fail(error)});
  this.portrait=document.createElement('div');this.portrait.className='scene-conversation story-portrait';this.portrait.hidden=true;
  this.portrait.innerHTML='<img class="scene-conversation__portrait" alt=""><span class="scene-conversation__name"></span>';view.element.append(this.portrait);
  runtime.story=this;
 }
 get progress(){return this.primarySession.state.story;}
 get scene(){return this.episode?.scenes[this.index];}
 get objective(){return this.scene?.type==='objective'?this.scene.objective:null;}
 get isExploring(){return Boolean(this.active&&this.mode==='objective'&&this.objective);}
 get objectiveTalking(){return Boolean(this.objectiveConversation?.active);}
 get objectiveInspected(){return Boolean(this.objectiveState?.inspectionConfirmed);}
 get inspectionReading(){return Boolean(this.objectiveState?.inspectionReading);}
 get objectiveRoomReached(){return Boolean(this.runtime.scene===this.objective?.roomId&&(this.objective?.kind==='inspect_object'||this.objectiveState?.mapVisited));}
 get canExplore(){return this.isExploring&&!this.paused&&!this.loading&&!this.error&&!this.objectiveTalking&&!this.inspectionReading;}
 get canCheckpoint(){return this.primarySession.state.location==='home'&&!this.primarySession.state.battle;}
 get awaitingRegistration(){return Boolean(this.active&&!this.replay&&!this.loading&&!this.error&&this.mode==='registration'&&this.scene?.type==='registration'&&!this.primarySession.state.visitorName);}
 get contextLost(){return Boolean(this.stage.contextLost);}
 findEpisode(id){for(const chapter of STORY_CHAPTERS){const episode=chapter.episodes.find(entry=>entry.id===id);if(episode)return {chapter,episode};}return null;}
 refresh(){
  this.ui.refresh({available:!this.active&&this.runtime.scene==='house'&&Boolean(this.primarySession.state.visitorName)&&this.runtime.isHouseReady()&&!this.runtime.isMessageVisible()&&!this.runtime.session.state.pendingAngerEvent&&!this.runtime.pendingCutin});
 }
 maybeStart(){
  const r=this.runtime;
  if(this.active||this.autoSuppressed||r.scene!=='house'||!r.isHouseReady()||r.isMessageVisible()||r.pendingCutin||this.primarySession.state.pendingAngerEvent||r.isModalPaused()||document.hidden)return false;
  const progress=this.progress,checkpoint=progress.activeEpisode;
  if(checkpoint&&this.findEpisode(checkpoint.episodeId))return this.start(checkpoint.episodeId);
  if(getStoryArcChapter(progress,'hero',STORY_CHAPTERS)!==0)return false;
  const next=STORY_CHAPTERS.find(chapter=>(chapter.arcId||'hero')==='hero'&&chapter.number===0)?.episodes.find(episode=>!progress.completedEpisodes.includes(episode.id));
  return next?this.start(next.id):false;
 }
 checkpoint(index=this.index){
  if(this.replay||!this.episode)return;
  const bounded=Math.max(0,Math.min(index,this.episode.scenes.length-1)),scene=this.episode.scenes[bounded];
  checkpointStoryScene(this.progress,{episodeId:this.episode.id,sceneIndex:bounded,sceneId:scene.id},STORY_CHAPTERS);
  this.onCheckpoint();
 }
 /** Objectives use the real map and room view, never an authored next button. */
 enterObjective(scene){
  const r=this.runtime,objective=scene.objective;
  const talk=objective?.kind==='talk_staff',inspect=objective?.kind==='inspect_object';
  if(!objective||typeof objective.roomId!=='string'||(!talk&&!inspect)||(talk&&(typeof objective.staffId!=='string'||!Array.isArray(scene.lines)||!scene.lines.length))||(inspect&&typeof objective.targetId!=='string'))throw new Error('物語の訪問先を準備できませんでした。');
  this.closeObjectiveConversation();this.objectiveState={sceneId:scene.id,mapVisited:false,conversationId:null,inspectionConfirmed:false,inspectionReading:false,inspectionMessageId:null};
  this.stage.destroy();r.trainingHall?.deactivate();r.deactivateRoomVisits();r.house.leaveHouse();r.scene='house';r.messageLocked=false;r.clearMessage();r.messages=[];
  r.setLocation('おこていゆハウス');r.house.arriveFromOutside?.({afterBattle:false,emit:false});this.view.setHouse();this.loading=false;this.paint('objective');r.sync();return true;
 }
 onMapTravel(destination){
  if(!this.canExplore||!destination)return false;
  const reached=this.runtime.scene===this.objective.roomId&&destination.floorId===this.objective.floorId&&destination.areaId===this.objective.areaId;
  if(reached)this.objectiveState.mapVisited=true;
  this.paint('objective');return reached;
 }
 talkToStaff(staff,opener,conversation){
  if(!this.canExplore||this.objective.kind!=='talk_staff'||this.runtime.isPaused()||this.runtime.isModalPaused()||document.hidden||this.runtime.scene!==this.objective.roomId||staff?.id!==this.objective.staffId||!this.objectiveState?.mapVisited||!conversation?.play)return false;
  this.objectiveAttempt=(this.objectiveAttempt||0)+1;
  const id='story-objective:'+this.episode.id+':'+this.scene.id+':'+this.serial+':'+this.objectiveAttempt;
  this.objectiveConversation=conversation;this.objectiveState.conversationId=id;
  const started=conversation.play({id,sceneId:this.objective.roomId,lines:this.scene.lines,opener});
  if(!started){this.objectiveConversation=null;this.objectiveState.conversationId=null;return false;}
  this.paint('objective');this.runtime.sync();return true;
 }
 onConversationComplete(previous){
  if(!this.isExploring||this.objective.kind!=='talk_staff'||previous?.id!==this.objectiveState?.conversationId)return false;
  this.objectiveConversation=null;this.objectiveState.conversationId=null;
  const complete=Array.isArray(previous.lines)&&previous.lines.length>0&&previous.index>=previous.lines.length;
  if(!complete||this.paused||this.loading||this.runtime.scene!==this.objective.roomId||previous.sceneId!==this.objective.roomId||!this.objectiveState.mapVisited){this.paint('objective');return false;}
  // The checkpoint changes only after the last line is read. Interrupted or
  // cancelled visits resume at this objective and do not silently complete it.
  this.objectiveState=null;this.index++;this.present();return true;
 }
 /** Only a completed camera move from a genuine 3D tap can fulfil inspection.
  * The live controller token prevents late events after exit/load/recovery. */
 onObjectInspection(event,controller){
  const r=this.runtime,objective=this.objective;
  if(!this.canExplore||objective.kind!=='inspect_object'||this.objectiveInspected||r.isPaused()||r.isModalPaused()||document.hidden||r.scene!==objective.roomId)return false;
  const room=r.roomVisits?.[objective.roomId],inspection=controller?.getInspectionState?.();
  if(!room?.active||!room.ready||room.controller!==controller||controller.roomDefinition?.id!==objective.roomId||controller.cameraMode!=='inspection'||controller.inspectionTransition||!inspection?.settled||inspection.source!=='tap'||inspection.roomId!==objective.roomId)return false;
  if(event?.entered!==true||event.source!=='tap'||event.roomId!==objective.roomId||event.targetId!==objective.targetId||(inspection.targetId??inspection.id)!==objective.targetId)return false;
  if(typeof inspection.token!=='string'||!inspection.token||!Number.isSafeInteger(inspection.generation)||typeof inspection.objectId!=='string'||!inspection.objectId||event.token!==inspection.token||event.generation!==inspection.generation||event.objectId!==inspection.objectId)return false;
  this.objectiveAttempt=(this.objectiveAttempt||0)+1;
  const id='story-inspection:'+this.episode.id+':'+this.scene.id+':'+this.serial+':'+this.objectiveAttempt;
  this.objectiveState.inspectionConfirmed=true;this.objectiveState.inspectionReading=true;this.objectiveState.inspectionMessageId=id;
  // Fulfilment is saved now, not after reading the close-view narration. On a
  // reload the following authored scene resumes without asking for another tap.
  this.checkpoint(this.index+1);
  const message=this.scene.inspectionMessage;
  const payload=typeof message==='string'?{text:message}:message;
  r.say({speaker:'ナレーション',kind:'narration',category:'narration',text:'冷蔵庫を、近くでじっくり観察した。',...payload,storyInspectionId:id},{record:false});
  this.paint('objective');r.sync();return true;
 }
 onInspectionMessageClosed(previous){
  if(!this.isExploring||!this.inspectionReading||!this.objectiveInspected||previous?.storyInspectionId!==this.objectiveState.inspectionMessageId||this.paused||this.loading)return false;
  this.objectiveState=null;this.index++;this.present();return true;
 }
 closeObjectiveConversation(){
  this.objectiveConversation?.close?.({notify:false,restoreFocus:false});this.objectiveConversation=null;
  if(this.objectiveState)this.objectiveState.conversationId=null;
 }
 async start(id,{replay=false}={}){
  const r=this.runtime,found=this.findEpisode(id);
  if(!found||r.isModalPaused()||document.hidden||this.battlePending||(!this.primarySession.state.visitorName&&(id!=='ch0-01'||replay))||!['house','story'].includes(r.scene)||!isStoryEpisodeAvailable(this.progress,id,STORY_CHAPTERS))return false;
  this.closeObjectiveConversation();this.objectiveState=null;this.ensureStage();
  const wasActive=this.active,saved=this.progress.activeEpisode;
  this.replay=Boolean(replay||this.progress.completedEpisodes.includes(id));this.active=true;this.paused=false;this.error=null;this.episode=found.episode;this.chapter=found.chapter;
  let index=0;
  if(!this.replay&&saved?.episodeId===id){const byId=this.episode.scenes.findIndex(scene=>scene.id===saved.sceneId);index=byId>=0?byId:Math.min(saved.sceneIndex||0,this.episode.scenes.length-1);}
  if(!this.replay&&!saved?.episodeId)startStoryEpisode(this.progress,id,STORY_CHAPTERS);
  r.trainingHall?.deactivate();r.deactivateRoomVisits();r.house.leaveHouse();r.scene='story';r.messageLocked=false;r.clearMessage();r.messages=[];
  if(!wasActive)this.ui.close();
  this.setReturnLabel(true);this.serial++;this.view.clear();this.view.surface.append(this.stage.container);
  this.index=index;this.checkpoint();this.paint();await this.present();r.sync();return true;
 }
 paint(mode=this.mode||'read',extra={}){
  this.mode=mode;this.ui.setPlayback({active:this.active,exitAllowed:Boolean(this.primarySession.state.visitorName),chapterId:this.chapter?.id,episodeId:this.episode?.id,sceneIndex:this.index,sceneCount:this.episode?.scenes.length||1,mode,paused:this.paused,replay:this.replay,choices:[],prompt:'',nextEpisodeId:null,objective:this.objective,objectiveRoomReached:this.objectiveRoomReached,objectiveTalking:this.objectiveTalking,objectiveInspected:this.objectiveInspected,inspectionReading:this.inspectionReading,...extra});
  this.refresh();
 }
 setPortrait(scene){
  const people=scene.portraits|| (scene.portrait?[scene.portrait]:[]);
  this.portrait.hidden=!people.length;this.portrait.classList.toggle('story-portrait--pair',people.length>1);
  if(!people.length)return;
  const images=people.map(person=>{const img=document.createElement('img');img.className='scene-conversation__portrait';img.src=STAFF_SILHOUETTE_URL;img.alt=(person==='manager_a'?'管理人A':person==='manager_b'?'管理人B':scene.speaker)+'のシルエット';return img;});
  const label=document.createElement('span');label.className='scene-conversation__name';label.textContent=scene.speaker;this.portrait.replaceChildren(...images,label);this.portrait.dataset.speaker=scene.speaker;
 }
 async present(){
  if(!this.active)return false;
  const scene=this.scene,r=this.runtime,serial=++this.serial;this.response=false;this.elapsed=0;this.loading=true;this.error=null;this.portrait.hidden=true;r.messageLocked=false;r.clearMessage();
  if(!scene){this.finishEpisode();return true;}
  if(scene.type==='registration'&&(this.replay||this.primarySession.state.visitorName)){this.index++;return this.present();}
  this.checkpoint();
  if(scene.type==='battle'){
   if(!this.replay&&hasStoryBattleReward(this.progress,scene.id)){this.index++;return this.present();}
   try{this.beginBattle(scene);}catch(error){r.session=this.primarySession;r.scene='story';this.battlePending=false;this.ensureStage();this.view.clear();this.view.surface.append(this.stage.container);this.fail(error);}return true;
  }
  if(scene.type==='objective'){
   try{return this.enterObjective(scene);}catch(error){this.fail(error);return false;}
  }
  this.closeObjectiveConversation();this.objectiveState=null;
  if(r.scene!=='story'){r.trainingHall?.deactivate();r.deactivateRoomVisits();r.house.leaveHouse();r.scene='story';}
  this.ensureStage();
  const visual=scene.type==='choice'?{...(this.lastVisual||this.episode.scenes.slice(0,this.index).findLast(entry=>entry.type==='scene')||{stage:'house',shot:'medium',animation:'idle',expression:'neutral'})}:scene;this.lastVisual=visual;
  this.paint(scene.type==='choice'?'choice':scene.type==='registration'?'registration':scene.auto?'auto':'read',scene.type==='choice'?{choices:scene.options,prompt:scene.prompt}:{});
  r.setLocation(stageNames[visual.stage]||'物語');
  // The stage is already mounted during same-set shot changes.
  if(!this.stage.container.isConnected){this.view.clear();this.view.surface.append(this.stage.container);}
  try{
   const ready=await this.stage.show(visual);if(!this.active||serial!==this.serial)return false;
   if(ready===false)throw new Error('物語の3D画面を準備できませんでした。');
   this.loading=false;
   if(scene.type==='choice'){this.paint('choice',{choices:scene.options,prompt:scene.prompt});return true;}
   if(scene.type==='registration'){r.messageLocked=true;this.paint('registration');this.onRequestRegistration();return true;}
   this.setPortrait(scene);r.messageLocked=this.paused||Boolean(scene.auto);
   const hasMessage=scene.message!==false&&typeof scene.text==='string'&&scene.text.length>0,conversation=Boolean(scene.portrait||scene.portraits?.length);
   if(hasMessage)r.say({speaker:scene.speaker||'ナレーション',kind:conversation?'speech':'narration',category:scene.category??(conversation?'conversation':'narration'),text:scene.text},{record:false});
   const page=r.readMessagePage?.()||{pages:1};this.autoDuration=Math.max(Number(scene.duration)||0,Array.from(scene.text||'').length/7+1.2,page.pages*2.4);
   if(!hasMessage&&scene.auto)this.autoDuration=Number(scene.duration)||1;
   this.paint(scene.auto?'auto':'read');return true;
  }catch(error){if(this.active&&serial===this.serial)this.fail(error);return false;}
 }
 /** The first durable checkpoint contains both the name and the next scene.
  * Draft battle rewards stay in memory until this single synchronous write. */
 registerVisitorName(value){
  if(!this.awaitingRegistration)throw new Error('名前を登録する場面ではありません。');
  const name=normalizeVisitorName(value);if(!name)throw new Error('名前を入力してください。');
  const oldCheckpoint=clone(this.progress.activeEpisode),nextIndex=this.index+1,next=this.episode.scenes[nextIndex];
  if(!next)throw new Error('登録後の物語を準備できませんでした。');
  this.primarySession.state.visitorName=name;
  try{
   checkpointStoryScene(this.progress,{episodeId:this.episode.id,sceneIndex:nextIndex,sceneId:next.id},STORY_CHAPTERS);
   if(this.onCheckpoint()!==true)throw new Error('セーブデータを保存できませんでした。ブラウザの保存設定を確認して、もう一度お試しください。');
  }catch(error){this.primarySession.state.visitorName=null;this.progress.activeEpisode=oldCheckpoint;throw error;}
  this.index=nextIndex;this.registrationContinuation=true;return true;
 }
 resumeAfterRegistration(){
  if(!this.registrationContinuation||!this.active||!this.primarySession.state.visitorName)return false;
  this.registrationContinuation=false;this.present();this.runtime.sync();return true;
 }
 onMessageClosed(){
  if(!this.active||this.runtime.scene!=='story'||this.loading||this.paused||this.mode!=='read'||this.scene?.auto)return false;
  this.index++;this.present();return true;
 }
 choose(index){
  if(!this.active||this.paused||this.loading)return false;
  if(this.error){if(index===0){this.error=null;this.present();}else this.exit();return true;}
  if(this.runtime.scene!=='story')return false;
  const scene=this.scene;if(scene?.type!=='choice'||this.response)return false;
  const option=scene.options[index];if(!option)return false;
  this.response=true;this.portrait.hidden=true;this.paint('read');
  if(option.response)this.runtime.say({...option.response,kind:'narration',category:'narration'},{record:false});else{this.index++;this.present();}
  return true;
 }
 setPaused(paused){
  if(!this.active||this.battlePending||['complete','registration'].includes(this.mode))return false;
  this.paused=Boolean(paused);this.runtime.messageLocked=this.paused||Boolean(this.scene?.auto);this.paint(this.mode,this.scene?.type==='choice'&&!this.response?{choices:this.scene.options,prompt:this.scene.prompt}:{});return true;
 }
 tick(dt){
  if(!this.active)return;
  if(this.isExploring){
   if(this.runtime.isPaused()||this.runtime.isModalPaused()||document.hidden||this.paused||this.loading||this.error)return;
   // Visit renderers animate idle poses/cameras only, never the home economy.
   this.runtime.roomVisits[this.runtime.scene]?.advance(dt);return;
  }
  if(this.runtime.scene!=='story')return;
  if(this.runtime.isModalPaused()||document.hidden||this.paused||this.loading||this.error)return;
  this.stage.update(dt);
  if(this.scene?.auto&&this.mode==='auto'){
   this.elapsed+=dt;const page=this.runtime.readMessagePage?.()||{page:0,pages:1},duration=this.autoDuration||5;
   if(page.page<page.pages-1&&this.elapsed>=duration*(page.page+1)/page.pages)this.runtime.advanceMessagePage?.();
   if(this.elapsed>=duration){this.runtime.messageLocked=false;this.runtime.clearMessage();this.index++;this.present();}
  }
 }
 beginBattle(scene){
  const r=this.runtime;this.loading=false;this.battlePending=true;this.battleScene=scene;this.portrait.hidden=true;
  const session=new GameSession({...(scene.profile==='initial'?{}:{state:this.primarySession.exportState({allowPending:true})}),staffRng:()=>.5,onEvent:event=>r.onSessionEvent(event)});session.state.visitorName=this.primarySession.state.visitorName;
  r.session=session;this.paint('battle');this.stage.destroy();
  r.startBattle(scene.encounter||{id:'story-'+scene.id,speciesId:scene.speciesId,level:scene.level},{region:scene.region||'residential',timeOfDay:scene.timeOfDay||currentTimeOfDay(),encounterType:'story'});
  r.setLocation('第'+this.chapter.number+'章'+(this.replay?'・読み返しの戦闘':scene.id==='first-punim'?'・初めての戦闘':'・戦闘'));
 }
 onBattleSettled(){
  if(!this.battlePending)return;
  const battle=this.runtime.session.state.battle;if(!battle||battle.result!=='win')return;
  if(!this.replay){
   const result=applyStoryBattleRewards(this.primarySession,battle,{battleId:this.battleScene.id});
   if(result.applied){battle.rewards=result.rewards;this.primarySession.state.interferenceBonusAvailable=true;this.hadRewardBattle=true;}
   // Save the next scene together with the once-only reward ledger. A reload
   // cannot repeat a paid-out battle, including during its result cut-in.
   this.checkpoint(this.index+1);
  }
 }
 returnFromBattle(){
  const r=this.runtime;if(!this.battlePending||!r.canReturnHomeAfterBattle())return false;
  const won=r.session.state.battle?.result==='win';
  r.sceneCutin.stop();r.resultCutinComplete=false;r.messageLocked=false;r.battleUI.deactivate();r.clearMessage();r.resultMessages=[];r.resultMessageActive=false;r.resultMessagesComplete=true;r.resultDelay=null;
  r.session=this.primarySession;r.scene='story';this.battlePending=false;
  if(won)this.index++;
  this.ensureStage();this.view.clear();this.view.surface.append(this.stage.container);this.present();r.sync();return true;
 }
 finishEpisode(){
  const r=this.runtime;this.closeObjectiveConversation();this.objectiveState=null;r.messageLocked=false;r.clearMessage();this.loading=false;this.portrait.hidden=true;
  if(!this.replay)completeStoryEpisode(this.progress,this.episode.id,STORY_CHAPTERS);
  const arcId=this.chapter.arcId||'hero',episodes=STORY_CHAPTERS.filter(chapter=>(chapter.arcId||'hero')===arcId).flatMap(chapter=>chapter.episodes),next=episodes[episodes.findIndex(episode=>episode.id===this.episode.id)+1];
  this.paint('complete',{nextEpisodeId:next&&isStoryEpisodeAvailable(this.progress,next.id,STORY_CHAPTERS)?next.id:null});this.onCheckpoint();r.sync();
 }
 exportProgress(){return {session:this.primarySession.exportState({allowPending:true}),relaxStreak:this.runtime.house.getConsecutiveRelaxActions()};}
 exit(){
  if(!this.active||this.battlePending||!this.primarySession.state.visitorName)return false;
  this.closeObjectiveConversation();this.objectiveState=null;
  this.autoSuppressed=true;this.active=false;this.serial++;this.paused=false;this.error=null;this.loading=false;this.portrait.hidden=true;
  const r=this.runtime;r.messageLocked=false;r.clearMessage();r.trainingHall?.deactivate();r.deactivateRoomVisits();r.session=this.primarySession;r.scene='house';this.ui.setPlayback({active:false});this.stage.destroy();r.setLocation('おこていゆハウス');r.house.arriveFromOutside({afterBattle:Boolean(this.hadRewardBattle)});this.hadRewardBattle=false;this.view.setHouse();this.setReturnLabel(false);this.refresh();this.onCheckpoint();r.sync();return true;
 }
 createStage(){return new StoryStage({view:this.view,onError:error=>this.fail(error),onReady:()=>{if(this.active&&this.error&&!this.loading)this.present();}});}
 ensureStage(){if(this.stage.destroyed)this.stage=this.createStage();}
 setReturnLabel(story){
  const button=this.runtime.battleUI.returnButton,svg=button.querySelector('svg');this.returnIcon??=svg.innerHTML;button.setAttribute('aria-label',story?'物語の続きを見る':'ホーム画面に帰る');button.querySelector('span').innerHTML=story?'物語の<br>つづきへ':'ホーム画面に<br>帰る';svg.innerHTML=story?'<path d="M16 9C11 5 6 7 4 8v18c5-3 9-2 12 1 3-3 7-4 12-1V8c-5-3-9-2-12 1Zm0 0v18M8 12h4m-4 5h4m8-5h4m-4 5h4"/>':this.returnIcon;
 }
 fail(error){
  if(!this.active)return;
  this.loading=false;this.error=error?.message||'物語の表示を準備できませんでした。';this.portrait.hidden=true;this.runtime.messageLocked=false;this.runtime.clearMessage();
  this.paint('choice',{prompt:'物語の表示を、もう一度',choices:[{label:'再読み込みする'},...(this.primarySession.state.visitorName?[{label:'ここまで保存してホームへ'}]:[])]});
 }
 async recoverAfterInterruption(){
  if(!this.active||this.runtime.scene!=='story')return true;
  const ready=await this.stage.recoverAfterInterruption();if(ready===false)return false;return true;
 }
 getDiagnostics(){return {active:this.active,replay:this.replay,paused:this.paused,loading:this.loading,error:this.error,episodeId:this.episode?.id,sceneIndex:this.index,sceneId:this.scene?.id,mode:this.mode,autoElapsed:this.elapsed,battlePending:this.battlePending,objective:this.objective?clone(this.objective):null,objectiveRoomReached:this.objectiveRoomReached,objectiveTalking:this.objectiveTalking,objectiveInspected:this.objectiveInspected,inspectionReading:this.inspectionReading,progress:clone(this.progress),stage:this.stage.getDiagnostics?.()||{ready:this.stage.ready}};}
 destroy(){this.serial++;this.closeObjectiveConversation();this.objectiveState=null;this.active=false;this.runtime.session=this.primarySession;this.stage.destroy();this.ui.destroy();this.portrait.remove();}
}
