import {STORY_CHAPTERS} from './story-content.js';
import {StoryUI} from './story-ui.js';
import {StoryStage} from './story-stage.js';
import {GameSession,applyStoryBattleRewards} from './game-session.js';
import {isStoryEpisodeAvailable,startStoryEpisode,checkpointStoryScene,completeStoryEpisode,hasStoryBattleReward} from './story-progress.js';
import {STAFF_SILHOUETTE_URL} from './scene-conversation.js';
import {currentTimeOfDay} from './world-time.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const stageNames={'headquarters':'ヒーロー会 本拠点',road:'引っ越しの道中',house:'おこていゆハウス','computer-room':'コンピュータ室',lounge:'休憩室','player-room':'あなたの部屋','training-hall':'訓練所'};

/** Authored data, playback, and persistent progress have separate owners.
 * Story battles use the ordinary combat engine; each scene chooses a preset
 * or the current profile. Only its first victory transfers persistent rewards. */
export class StoryDirector {
 constructor({runtime,view,game,homeElement,contextElement,onCheckpoint=()=>{}}){
  Object.assign(this,{runtime,view,onCheckpoint});this.primarySession=runtime.session;
  this.active=false;this.replay=false;this.paused=false;this.loading=false;this.error=null;this.serial=0;this.autoSuppressed=false;this.battlePending=false;
  this.stage=this.createStage();
  this.ui=new StoryUI({view,game,homeElement,contextElement,chapters:STORY_CHAPTERS,readProgress:()=>this.progress,
   onEpisode:(id,options)=>this.start(id,options),onNextEpisode:id=>this.start(id),onExit:()=>this.exit(),onFinish:()=>this.exit(),onPause:paused=>this.setPaused(paused),onChoice:index=>this.choose(index),onError:error=>this.fail(error)});
  this.portrait=document.createElement('div');this.portrait.className='scene-conversation story-portrait';this.portrait.hidden=true;
  this.portrait.innerHTML='<img class="scene-conversation__portrait" alt=""><span class="scene-conversation__name"></span>';view.element.append(this.portrait);
  runtime.story=this;
 }
 get progress(){return this.primarySession.state.story;}
 get scene(){return this.episode?.scenes[this.index];}
 get canCheckpoint(){return this.primarySession.state.location==='home'&&!this.primarySession.state.battle;}
 get contextLost(){return Boolean(this.stage.contextLost);}
 findEpisode(id){for(const chapter of STORY_CHAPTERS){const episode=chapter.episodes.find(entry=>entry.id===id);if(episode)return {chapter,episode};}return null;}
 refresh(){
  this.ui.refresh({available:!this.active&&this.runtime.scene==='house'&&Boolean(this.primarySession.state.visitorName)&&this.runtime.isHouseReady()&&!this.runtime.isMessageVisible()&&!this.runtime.session.state.pendingAngerEvent&&!this.runtime.pendingCutin});
 }
 maybeStart(){
  const r=this.runtime;
  if(this.active||this.autoSuppressed||r.scene!=='house'||!this.primarySession.state.visitorName||!r.isHouseReady()||r.isMessageVisible()||r.pendingCutin||this.primarySession.state.pendingAngerEvent||r.isModalPaused()||document.hidden)return false;
  const progress=this.progress,checkpoint=progress.activeEpisode;
  if(checkpoint&&this.findEpisode(checkpoint.episodeId))return this.start(checkpoint.episodeId);
  if(progress.currentChapter!==0)return false;
  const next=STORY_CHAPTERS.find(chapter=>chapter.number===0)?.episodes.find(episode=>!progress.completedEpisodes.includes(episode.id));
  return next?this.start(next.id):false;
 }
 checkpoint(index=this.index){
  if(this.replay||!this.episode)return;
  const bounded=Math.max(0,Math.min(index,this.episode.scenes.length-1)),scene=this.episode.scenes[bounded];
  checkpointStoryScene(this.progress,{episodeId:this.episode.id,sceneIndex:bounded,sceneId:scene.id},STORY_CHAPTERS);
  this.onCheckpoint();
 }
 async start(id,{replay=false}={}){
  const r=this.runtime,found=this.findEpisode(id);
  if(!found||r.isModalPaused()||document.hidden||this.battlePending||!this.primarySession.state.visitorName||!['house','story'].includes(r.scene)||!isStoryEpisodeAvailable(this.progress,id,STORY_CHAPTERS))return false;
  this.ensureStage();
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
  this.mode=mode;this.ui.setPlayback({active:this.active,chapterId:this.chapter?.id,episodeId:this.episode?.id,sceneIndex:this.index,sceneCount:this.episode?.scenes.length||1,mode,paused:this.paused,replay:this.replay,choices:[],prompt:'',nextEpisodeId:null,...extra});
  this.refresh();
 }
 setPortrait(scene){
  this.portrait.hidden=!scene.portrait;
  if(scene.portrait){const img=this.portrait.querySelector('img');img.src=STAFF_SILHOUETTE_URL;img.alt=scene.speaker+'のシルエット';this.portrait.querySelector('span').textContent=scene.speaker;this.portrait.dataset.speaker=scene.speaker;}
 }
 async present(){
  if(!this.active)return false;
  const scene=this.scene,r=this.runtime,serial=++this.serial;this.response=false;this.elapsed=0;this.loading=true;this.error=null;this.portrait.hidden=true;r.messageLocked=false;r.clearMessage();
  if(!scene){this.finishEpisode();return true;}
  this.checkpoint();
  if(scene.type==='battle'){
   if(!this.replay&&hasStoryBattleReward(this.progress,scene.id)){this.index++;return this.present();}
   try{this.beginBattle(scene);}catch(error){r.session=this.primarySession;r.scene='story';this.battlePending=false;this.ensureStage();this.view.clear();this.view.surface.append(this.stage.container);this.fail(error);}return true;
  }
  const visual=scene.type==='choice'?{...(this.lastVisual||this.episode.scenes.slice(0,this.index).findLast(entry=>entry.type==='scene')||{stage:'house',shot:'medium',animation:'idle',expression:'neutral'})}:scene;this.lastVisual=visual;
  this.paint(scene.type==='choice'?'choice':scene.auto?'auto':'read',scene.type==='choice'?{choices:scene.options,prompt:scene.prompt}:{});
  r.setLocation(stageNames[visual.stage]||'物語');
  // The stage is already mounted during same-set shot changes.
  if(!this.stage.container.isConnected){this.view.clear();this.view.surface.append(this.stage.container);}
  try{
   const ready=await this.stage.show(visual);if(!this.active||serial!==this.serial)return false;
   if(ready===false)throw new Error('物語の3D画面を準備できませんでした。');
   this.loading=false;
   if(scene.type==='choice'){this.paint('choice',{choices:scene.options,prompt:scene.prompt});return true;}
   this.setPortrait(scene);r.messageLocked=this.paused||Boolean(scene.auto);r.say({speaker:scene.speaker||'ナレーション',kind:scene.portrait?'speech':'narration',category:scene.portrait?'conversation':'narration',text:scene.text},{record:false});
   const page=r.readMessagePage?.()||{pages:1};this.autoDuration=Math.max(Number(scene.duration)||0,Array.from(scene.text||'').length/7+1.2,page.pages*2.4);
   this.paint(scene.auto?'auto':'read');return true;
  }catch(error){if(this.active&&serial===this.serial)this.fail(error);return false;}
 }
 onMessageClosed(){
  if(!this.active||this.runtime.scene!=='story'||this.loading||this.paused||this.mode!=='read'||this.scene?.auto)return false;
  this.index++;this.present();return true;
 }
 choose(index){
  if(!this.active||this.runtime.scene!=='story'||this.paused||this.loading)return false;
  if(this.error){if(index===0){this.error=null;this.present();}else this.exit();return true;}
  const scene=this.scene;if(scene?.type!=='choice'||this.response)return false;
  const option=scene.options[index];if(!option)return false;
  this.response=true;this.portrait.hidden=true;this.paint('read');
  if(scene.id.endsWith('-call'))this.stage.show({...this.lastVisual,animation:'surprise',expression:'surprise'}).catch(error=>this.fail(error));
  if(option.response)this.runtime.say({...option.response,kind:'narration',category:'narration'},{record:false});else{this.index++;this.present();}
  return true;
 }
 setPaused(paused){
  if(!this.active||this.battlePending||this.mode==='complete')return false;
  this.paused=Boolean(paused);this.runtime.messageLocked=this.paused||Boolean(this.scene?.auto);this.paint(this.mode,this.scene?.type==='choice'&&!this.response?{choices:this.scene.options,prompt:this.scene.prompt}:{});return true;
 }
 tick(dt){
  if(!this.active)return;
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
  const r=this.runtime;r.messageLocked=false;r.clearMessage();this.loading=false;this.portrait.hidden=true;
  if(!this.replay)completeStoryEpisode(this.progress,this.episode.id,STORY_CHAPTERS);
  const episodes=STORY_CHAPTERS.flatMap(chapter=>chapter.episodes),next=episodes[episodes.findIndex(episode=>episode.id===this.episode.id)+1];
  this.paint('complete',{nextEpisodeId:next&&isStoryEpisodeAvailable(this.progress,next.id,STORY_CHAPTERS)?next.id:null});this.onCheckpoint();r.sync();
 }
 exportProgress(){return {session:this.primarySession.exportState({allowPending:true}),relaxStreak:this.runtime.house.getConsecutiveRelaxActions()};}
 exit(){
  if(!this.active||this.battlePending)return false;
  this.autoSuppressed=true;this.active=false;this.serial++;this.paused=false;this.error=null;this.loading=false;this.portrait.hidden=true;
  const r=this.runtime;r.messageLocked=false;r.clearMessage();r.session=this.primarySession;r.scene='house';this.ui.setPlayback({active:false});this.stage.destroy();r.setLocation('おこていゆハウス');r.house.arriveFromOutside({afterBattle:Boolean(this.hadRewardBattle)});this.hadRewardBattle=false;this.view.setHouse();this.setReturnLabel(false);this.refresh();this.onCheckpoint();r.sync();return true;
 }
 createStage(){return new StoryStage({view:this.view,onError:error=>this.fail(error),onReady:()=>{if(this.active&&this.error&&!this.loading)this.present();}});}
 ensureStage(){if(this.stage.destroyed)this.stage=this.createStage();}
 setReturnLabel(story){
  const button=this.runtime.battleUI.returnButton,svg=button.querySelector('svg');this.returnIcon??=svg.innerHTML;button.setAttribute('aria-label',story?'物語の続きを見る':'ホーム画面に帰る');button.querySelector('span').innerHTML=story?'物語の<br>つづきへ':'ホーム画面に<br>帰る';svg.innerHTML=story?'<path d="M16 9C11 5 6 7 4 8v18c5-3 9-2 12 1 3-3 7-4 12-1V8c-5-3-9-2-12 1Zm0 0v18M8 12h4m-4 5h4m8-5h4m-4 5h4"/>':this.returnIcon;
 }
 fail(error){
  if(!this.active)return;
  this.loading=false;this.error=error?.message||'物語の表示を準備できませんでした。';this.portrait.hidden=true;this.runtime.messageLocked=false;this.runtime.clearMessage();
  this.paint('choice',{prompt:'物語の表示を、もう一度',choices:[{label:'再読み込みする'},{label:'ここまで保存してホームへ'}]});
 }
 async recoverAfterInterruption(){
  if(!this.active||this.runtime.scene!=='story')return true;
  const ready=await this.stage.recoverAfterInterruption();if(ready===false)return false;return true;
 }
 getDiagnostics(){return {active:this.active,replay:this.replay,paused:this.paused,loading:this.loading,error:this.error,episodeId:this.episode?.id,sceneIndex:this.index,sceneId:this.scene?.id,mode:this.mode,autoElapsed:this.elapsed,battlePending:this.battlePending,progress:clone(this.progress),stage:this.stage.getDiagnostics?.()||{ready:this.stage.ready}};}
 destroy(){this.serial++;this.active=false;this.runtime.session=this.primarySession;this.stage.destroy();this.ui.destroy();this.portrait.remove();}
}
