import {CampExpedition} from './camp-engine.js';
import {CampUI} from './camp-ui.js';
import {CampNightView} from './camp-night.js';
import {chooseCampEncounter} from './camp-encounters.js';
import {CAMP_WORLD,CAMP_DESTINATIONS} from './camp-world.js';
import {CREATURES,playerStats} from './game-session.js';
import {isBuildingVisitScene} from './interior-rules.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';

const done=new Set(['failed','finished']);
/** Keeps exploration presentation separate from ordinary battles and saves. */
export class CampRuntime{
 constructor(game){
  this.game=game;this.active=false;this.engine=null;this.entries=[];this.serial=0;
  this.ui=new CampUI({view:game.view,readState:()=>({...game.snapshot(),camp:game.session.state.camp,canCamp:this.canDepart()}),canOpen:()=>this.canBrowse(),
   onStart:options=>this.requestStart(options),onReturn:()=>this.returnHome(),
   onSaveBag:(slot,bag)=>{const ok=game.session.setCampBag(slot,bag);game.sync();return ok;},
   onSelectBag:slot=>{const ok=game.session.selectCampBag(slot);game.sync();return ok;}});
  this.night=new CampNightView({container:game.view.surface,isPaused:()=>game.isPaused(),onComplete:()=>this.wake(),onError:()=>game.toast('夜の3D表示を再試行してください。探索の時計は止まっています。')});
  this.actionArea=document.createElement('section');this.actionArea.id='campActionArea';this.actionArea.className='lower-right camp-actions';this.actionArea.hidden=true;this.actionArea.setAttribute('aria-label','キャンプ中のおこていゆ');
  this.health=document.createElement('section');this.health.className='battle-hp camp-health';this.health.dataset.campPlayerHp='';this.health.innerHTML='<header><strong>おこていゆ</strong><span></span></header><div class="battle-hp__meter" role="progressbar" aria-label="おこていゆのHP" aria-valuemin="0" aria-valuemax="100"><i></i></div><footer><span class="battle-hp__value"></span><small>HP</small></footer>';
  this.statusPanel=document.createElement('section');this.statusPanel.className='camp-progress-panel';this.statusPanel.hidden=true;this.statusPanel.innerHTML='<span class="camp-progress-panel__icon" aria-hidden="true">⌁</span><strong>ふたりの探索を見守る</strong><p>物資を使いながら、未開の地を進んでいます。</p><button type="button">ワールドマップ</button>';this.actionArea.append(this.health,this.statusPanel);game.homeElement.after(this.actionArea);this.statusPanel.querySelector('button').addEventListener('click',event=>this.ui.openWorldMap(event.currentTarget));
 }
 canBrowse(){const g=this.game;return Boolean(!g.story?.active&&g.session.state.visitorName&&g.isHouseReady()&&!g.session.state.pendingAngerEvent&&!g.pendingCutin&&!g.isMessageVisible()&&(g.scene==='house'||isBuildingVisitScene(g.scene)||['camp','camp-night'].includes(g.scene)));}
 canDepart(){const g=this.game;return Boolean(g.scene==='house'&&g.session.state.location==='home'&&g.session.state.visitorName&&g.isHouseReady()&&!g.story?.active&&!g.session.state.pendingAngerEvent&&!g.pendingCutin&&!g.isMessageVisible());}
 open(opener){return this.ui.open(opener);}
 openWorldMap(opener){return this.ui.openWorldMap(opener);}
 refresh(){this.updateHealth();const g=this.game,key=JSON.stringify([g.scene,g.house.getConsecutiveRelaxActions(),g.session.state.camp,g.session.state.pendingAngerEvent]);if(this.preparationKey!==key){this.preparationKey=key;this.ui.refresh();}}
 mountActionArea(){this.actionArea.append(this.game.battleUI.panel);this.game.battleUI.hud.dataset.campPlayerHpExternal='true';this.actionArea.hidden=false;this.updateHealth();}
 updateHealth(){
  if(!this.active||this.actionArea.hidden)return;
  const battle=['camp','camp-final'].includes(this.game.session.state.battle?.kind)?this.game.session.snapshotBattle():null;
  const player=battle?.player,max=Math.max(.1,player?.maxHp??this.maxHp??1),hp=Math.max(0,Math.min(max,player?.hp??this.hp??max)),level=player?.level??this.game.session.player.level;
  const key=JSON.stringify([hp,max,level]);if(key===this.healthKey)return;this.healthKey=key;
  const format=value=>value.toLocaleString('ja-JP',{maximumFractionDigits:1}),ratio=hp/max;
  setPaintedText(this.health.querySelector('header>span'),'Lv.'+level,{background:'#f8f4e9'});setPaintedText(this.health.querySelector('.battle-hp__value'),format(hp)+' / '+format(max),{background:'#f8f4e9'});
  this.health.dataset.hp=String(hp);this.health.dataset.maxHp=String(max);this.health.classList.toggle('is-low',ratio<=.25);
  const meter=this.health.querySelector('[role="progressbar"]');meter.setAttribute('aria-valuenow',String(Math.round(ratio*100)));meter.setAttribute('aria-label','おこていゆのHP '+format(hp)+' / '+format(max));meter.querySelector('i').style.width=ratio*100+'%';
 }
 setStatus(phase='travel'){
  const night=phase==='night',ended=done.has(phase);
  this.statusPanel.querySelector('strong').textContent=ended?'今回の探索を終える':night?'ふたりで、ひと休み':'ふたりの探索を見守る';
  this.statusPanel.querySelector('p').textContent=ended?'記録を確かめたら、ホームへ戻ろう。':night?'夜は野営して、明日に備えます。':'物資を使いながら、未開の地を進んでいます。';
 }
 emit(event){this.entries.push(event);if(this.entries.length>250)this.entries.shift();this.game.onCampEvent?.(event);}
 requestStart({bag,destination='none'}={}){
  const g=this.game;if(!this.canDepart()||g.isPaused()||document.hidden)return {ok:false,message:'ホーム画面で、支度ができてから出発しよう。'};
  let engine;try{engine=new CampExpedition({bag,destination,playerLevel:g.session.player.level,discovered:g.session.state.camp.discovered,rng:()=>g.session.random(),onEvent:event=>this.onEvent(event)});}catch(error){return {ok:false,message:error.message};}
  const result=g.session.requestCamp({bag,destination,relaxStreak:g.house.getConsecutiveRelaxActions(),spendCalmPoints:count=>g.house.spendCalmPoints(count)});
  if(!result.ok)return {...result,message:result.reason==='not-enough-calm'?'穏やかポイントが足りません。':'今はキャンプに出発できません。'};
  this.serial++;this.active=true;this.engine=engine;this.entries=[];this.hadBattle=false;this.finalStarted=false;this.settling=false;
  const stats=playerStats(g.session.player);this.hp=stats.hp;this.maxHp=stats.hp;engine.context({hp:this.hp,maxHp:this.maxHp});
  this.emit({type:'departure',day:1,activityHours:0,nodeId:CAMP_WORLD.startId,cost:result.calmPointsCost,destination});
  g.pendingEncounter=null;g.departureDestination={kind:'camp'};g.sync();g.startSceneCutin('departure');return result;
 }
 begin(){const g=this.game;if(!this.active||!this.engine)return false;g.scene='camp';g.setLocation('未開の地');g.house.leaveHouse();g.homeElement.hidden=true;this.mountActionArea();g.view.clear();this.ui.show(this.engine.snapshot());this.setStatus();this.statusPanel.hidden=false;g.onCampStarted?.(this.entries);g.sync();return true;}
 checkpoint(){if(!this.engine)return;this.game.session.updateCampProgress({discovered:this.engine.snapshot().visited});this.game.onCampCheckpoint?.();}
 onEvent(event){
  if(!this.active)return;this.emit(event);
  if(event.type==='heal'){this.hp=event.hp;this.maxHp=event.maxHp;}
  if(event.type==='arrive')this.checkpoint();
  else if(event.type==='encounter')this.startEncounter(event);
  else if(event.type==='night')this.startNight();
  else if(event.type==='final')this.startFinal();
  else if(event.type==='failed'){this.game.scene='camp';this.setStatus('failed');this.statusPanel.hidden=false;this.ui.show(this.engine.snapshot());this.checkpoint();}
 }
 tick(dt){
  if(!this.active||!this.engine)return false;
  if(this.game.scene==='camp-night'){this.night.tick(dt);return true;}
  if(this.game.scene!=='camp')return false;
  const state=this.engine.tick(dt,{hp:this.hp,maxHp:this.maxHp});this.hp=state.hp;this.maxHp=state.maxHp;this.ui.update(state);return true;
 }
 startNight(){const g=this.game;if(!this.engine||g.scene!=='camp')return;g.scene='camp-night';this.setStatus('night');this.ui.hide();g.view.clear();this.night.start({player:g.session.player});g.sync();this.checkpoint();}
 wake(){const g=this.game;if(!this.active||g.scene!=='camp-night'||this.engine?.snapshot().phase!=='night')return;this.night.hide();g.view.clear();g.scene='camp';this.setStatus();this.ui.show(this.engine.snapshot());this.engine.resumeAfterNight();this.ui.update(this.engine.snapshot());this.checkpoint();g.sync();}
 startEncounter(event){
  const g=this.game,enemy=chooseCampEncounter(g.session.player.level,CREATURES,()=>g.session.random());
  if(!enemy){this.engine.resolveEncounter({won:true,hp:this.hp,maxHp:this.maxHp});return;}
  this.statusPanel.hidden=true;this.ui.update(this.engine.snapshot());g.startBattle(enemy,{encounterType:'camp',campEmbedded:true,region:'forest',timeOfDay:'day',playerHp:this.hp});
 }
 startFinal(){
  const g=this.game;if(this.finalStarted||!this.engine)return;this.finalStarted=true;
  const s=this.engine.snapshot(),isVillage=s.nodeId===CAMP_DESTINATIONS.moai_village.nodeId,id=isVillage?'fake_moai':'great_fairy',species=CREATURES[id];
  if(!species){this.engine.abort('unavailable');g.toast('最終地点のモデルを準備できませんでした。ホームへ戻れます。');this.ui.show(this.engine.snapshot());return;}
  const level=Math.max(species.levelBand?.min||1,Math.min(species.levelBand?.max||106,g.session.player.level+3));
  this.emit({type:'guardian',name:species.name,nodeId:s.nodeId,day:s.day,activityHours:s.activityHours});
  this.ui.hide();this.night.hide();this.statusPanel.hidden=true;
  g.startBattle({speciesId:id,level,id:'camp-guardian'},{encounterType:'camp-final',region:'forest',timeOfDay:'day',playerHp:this.hp});
 }
 settled(snapshot){
  const g=this.game;if(this.settling||!this.active||snapshot?.kind!=='camp'||snapshot.phase!=='ended')return false;this.settling=true;
  this.hadBattle=true;this.emit({type:'battle-rewards',day:this.engine.snapshot().day,activityHours:this.engine.snapshot().activityHours,result:snapshot.result,rewards:snapshot.rewards});
  this.maxHp=playerStats(g.session.player).hp;this.hp=Math.min(snapshot.player.hp,this.maxHp);
  if(!g.session.finishCampBattle()){this.settling=false;return false;}
  for(const unlock of snapshot.rewards?.superUnlocks||[])g.session.acknowledgeSuperUnlock(unlock.id);
  g.battleUI.deactivate();g.scene='camp';g.setLocation('未開の地');g.resultDelay=null;this.statusPanel.hidden=false;
  // Commit real rewards while no battle exists: resolving the journey may
  // synchronously start its final battle and close the checkpoint window.
  this.checkpoint();
  this.ui.show(this.engine.snapshot());this.engine.resolveEncounter({won:snapshot.result==='win',hp:this.hp,maxHp:this.maxHp});
  const current=this.engine.snapshot();this.hp=current.hp;this.maxHp=current.maxHp;this.ui.update(current);this.checkpoint();this.settling=false;g.sync();return true;
 }
 get canCheckpoint(){return this.active&&['camp','camp-night'].includes(this.game.scene)&&!this.game.session.state.battle;}
 returnHome(){
  const g=this.game;if(!this.active||!done.has(this.engine?.snapshot().phase)||g.isPaused()||document.hidden)return false;
  const afterBattle=this.hadBattle;if(!g.session.endCamp({afterBattle}))return false;
  this.deactivate();g.scene='house';g.setLocation('おこていゆハウス');g.house.arriveFromOutside({afterBattle});g.view.setHouse();g.messages=[];g.clearMessage();g.sync();return true;
 }
 deactivate(){this.active=false;this.serial++;this.ui.hide();this.night.hide();this.statusPanel.hidden=true;this.actionArea.hidden=true;delete this.game.battleUI.hud.dataset.campPlayerHpExternal;this.game.homeElement.after(this.game.battleUI.panel);}
 destroy(){this.deactivate();this.ui.destroy();this.night.destroy();releasePaintedLabels(this.actionArea);this.actionArea.remove();}
}
