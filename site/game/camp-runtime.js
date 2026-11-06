import {CampExpedition} from './camp-engine.js';
import {CampUI} from './camp-ui.js';
import {CampNightView} from './camp-night.js';
import {chooseCampEncounter,chooseCampGuardianLevel} from './camp-encounters.js';
import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS,getCampNode,getCampDestinationAt} from './camp-world.js';
import {isCampDestinationUnlocked} from './camp-destination-access.js';
import {getCampRegion,getCampRegionAt} from './camp-regions.js';
import {CREATURES,playerStats} from './game-session.js';
import {isBuildingVisitScene} from './interior-rules.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';
import {CAMP_FOUNDATION_BASE,listCampBases,getCampBase,canEstablishCampBase} from './camp-bases.js';
import {CampMap} from './camp-map.js';
import {requestCampOptimalRoute} from './camp-destination-plan.js';
import {CampBaseActions} from './camp-base-actions.js';
import {CampFairyControls} from './camp-fairies.js';

const done=new Set(['failed','finished']);
const finalExplorationMessages={
 supplies:'今の物資で進めるのは、ここまで。ふたりは帰り支度を始めた。',
 'time-limit':'長い探索も、そろそろ一区切り。ふたりは帰り支度を始めた。',
 'return-tools':'帰り道を通るための道具が足りなくなってしまった。ふたりが帰り支度を始めると……。',
 'compass-route-unavailable':'モアイ郷へ向かう道を、今の物資と残り時間では選べない。ふたりが帰り支度を始めると……。',
 'no-route':'この先へは進めそうにない。ふたりが引き返そうとすると……。'
};
/** Keeps exploration presentation separate from ordinary battles and saves. */
export class CampRuntime{
 constructor(game){
  this.game=game;this.active=false;this.engine=null;this.entries=[];this.serial=0;this.finalIntro=null;this.discoveryQueue=[];this.deferredEvents=[];this.baseRoutes=[];this.baseRouteGeneration=0;
  if(!document.querySelector('link[data-camp-base-runtime-styles]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./camp-base-runtime.css',import.meta.url).href;link.dataset.campBaseRuntimeStyles='true';document.head.append(link);}
  this.baseActions=new CampBaseActions();
  this.ui=new CampUI({view:game.view,readState:()=>({...game.snapshot(),camp:game.session.state.camp,canCamp:this.canDepart(),canMoveBase:this.canBrowse()&&!this.active&&game.session.state.location==='home'&&!game.session.state.battle}),canOpen:()=>this.canBrowse(),
   readStartId:()=>this.departureBase().nodeId,readBases:()=>listCampBases(game.session.state.camp),readBaseRoutes:()=>this.baseRoutes,onMoveBase:id=>this.visitBase(id),onWithdrawBase:id=>this.withdrawBase(id),
   onStart:options=>this.requestStart(options),onReturn:()=>this.returnHome(),
   onSaveBag:(slot,bag,unpacked)=>{const ok=game.session.setCampBag(slot,bag,unpacked);game.sync();return ok;},
   onSelectBag:slot=>{const ok=game.session.selectCampBag(slot);game.sync();return ok;}});
  this.night=new CampNightView({container:game.view.surface,isPaused:()=>game.isPaused(),onComplete:()=>this.wake(),onError:()=>game.toast('夜の3D表示を再試行してください。探索の時計は止まっています。')});
  this.actionArea=document.createElement('section');this.actionArea.id='campActionArea';this.actionArea.className='lower-right camp-actions';this.actionArea.hidden=true;this.actionArea.setAttribute('aria-label','キャンプ中のおこていゆ');
  this.health=document.createElement('section');this.health.className='camp-health';this.health.hidden=true;this.health.setAttribute('data-camp-player-hp','');this.health.setAttribute('aria-label','おこていゆのHP');
  this.health.innerHTML='<header><strong>おこていゆ</strong><span class="camp-health__value"></span></header><div class="camp-health__meter" role="progressbar" aria-label="おこていゆのHP" aria-valuemin="0" aria-valuemax="100"><i></i></div>';this.actionArea.append(this.health);
  this.statusPanel=document.createElement('section');this.statusPanel.className='camp-progress-panel';this.statusPanel.hidden=true;this.statusPanel.innerHTML='<span class="camp-progress-panel__icon" aria-hidden="true">⌁</span><strong>ふたりの探索を見守る</strong><p>物資を使いながら、未開の地を進んでいます。</p><button type="button">ワールドマップ</button>';this.actionArea.append(this.statusPanel);game.homeElement.after(this.actionArea);this.statusPanel.querySelector('button').addEventListener('click',event=>this.ui.openWorldMap(event.currentTarget));
  this.fairies=new CampFairyControls({container:this.statusPanel,getMap:()=>this.ui.liveMap,readEngine:()=>this.engine,isVisible:()=>Boolean(this.active&&!this.finalStarted&&['camp','camp-night'].includes(game.scene)&&['travel','night'].includes(this.engine?.state.phase)),canRequest:()=>Boolean(this.active&&game.scene==='camp'&&!game.isPaused()&&!document.hidden&&!this.finalIntro&&!this.activeDiscovery&&!this.discoveryQueue.length),onChange:()=>{if(this.engine)this.ui.update(this.engine.snapshot());game.sync();}});
  this.baseControls=document.createElement('div');this.baseControls.className='camp-base-controls';this.baseControls.hidden=true;this.baseControls.innerHTML='<button type="button" data-camp-base-map>地図</button><button type="button" class="camp-base-controls__depart" data-camp-base-depart>探索に出る ↗</button>';game.view.element.append(this.baseControls);this.baseControls.querySelector('[data-camp-base-map]').addEventListener('click',event=>this.openWorldMap(event.currentTarget));this.baseControls.querySelector('[data-camp-base-depart]').addEventListener('click',event=>this.open(event.currentTarget));
  this.baseSummary=document.createElement('section');this.baseSummary.className='lower-right camp-base-summary';this.baseSummary.hidden=true;this.baseSummary.innerHTML='<h3>キャンプ拠点</h3><p>石の住まいで、次の探索に備えます。</p><button type="button">おこていゆハウスへ戻る</button>';game.homeElement.after(this.baseSummary);this.baseSummary.querySelector('button').addEventListener('click',()=>this.visitBase('house'));
  this.baseMapHost=document.createElement('div');this.baseMapHost.className='camp-base-context';this.baseMapHost.setAttribute('role','button');this.baseMapHost.tabIndex=0;this.baseMapHost.setAttribute('aria-label','キャンプ拠点のワールドマップを開く');this.baseMap=new CampMap(this.baseMapHost,{interactive:false,follow:true,onCamp:()=>this.openWorldMap(),onNodeSelect:()=>this.openWorldMap(),onBaseSelect:()=>this.openWorldMap()});
  this.baseMapClick=()=>this.openWorldMap(this.baseMapHost);this.baseMapHost.addEventListener('click',this.baseMapClick);this.baseMapKey=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();this.openWorldMap(this.baseMapHost);}};this.baseMapHost.addEventListener('keydown',this.baseMapKey);
  this.worldMapTrigger=document.createElement('button');this.worldMapTrigger.type='button';this.worldMapTrigger.id='homeWorldMapTrigger';this.worldMapTrigger.className='story-trigger world-map-trigger';this.worldMapTrigger.hidden=true;this.worldMapTrigger.setAttribute('aria-label','ワールドマップを開く');this.worldMapTrigger.setAttribute('aria-haspopup','dialog');this.worldMapTrigger.setAttribute('aria-controls','campWorldMapDialog');this.worldMapTrigger.setAttribute('aria-expanded','false');this.worldMapTrigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/></svg><span>ワールド<br>マップ</span>';(game.view.element.querySelector('.house-toolbar')||game.view.element).append(this.worldMapTrigger);this.worldMapTrigger.addEventListener('click',event=>{event.stopPropagation();if(this.game.scene==='house'&&!this.game.isPaused()&&!document.hidden)this.openWorldMap(event.currentTarget);});
 }
 canBrowse(){const g=this.game;return Boolean(!this.fairies?.busy&&!g.story?.active&&g.session.state.visitorName&&g.isHouseReady()&&!g.session.state.pendingAngerEvent&&!g.pendingCutin&&!g.isMessageVisible()&&(g.scene==='house'||isBuildingVisitScene(g.scene)||['camp','camp-night','camp-base'].includes(g.scene)));}
 canDepart(){const g=this.game;return Boolean(['house','camp-base'].includes(g.scene)&&g.session.state.location==='home'&&g.session.state.visitorName&&g.isHouseReady()&&!g.story?.active&&!g.session.state.pendingAngerEvent&&!g.pendingCutin&&!g.isMessageVisible()&&(g.scene!=='camp-base'||this.baseView?.ready));}
 departureBase(){return this.game.scene==='camp-base'?getCampBase(this.game.session.state.camp,this.game.session.state.camp.currentBaseId)||CAMP_FOUNDATION_BASE:CAMP_FOUNDATION_BASE;}
 open(opener){return this.ui.open(opener);}
 openWorldMap(opener){return this.ui.openWorldMap(opener);}
 nodeContext(nodeId=this.engine?.snapshot().nodeId){
  const currentId=this.engine?.snapshot().nodeId,node=this.engine?.nodeIndex?.get(nodeId)||getCampNode(nodeId)||this.engine?.nodeIndex?.get(currentId)||getCampNode(currentId)||getCampNode(CAMP_WORLD.startId);
  const region=getCampRegion(node?.regionId)||(Number.isFinite(node?.x)&&Number.isFinite(node?.y)?getCampRegionAt(node):null)||getCampRegion('wilds');
  const destination=typeof node?.locationId==='string'&&Object.hasOwn(CAMP_DESTINATIONS,node.locationId)&&CAMP_DESTINATIONS[node.locationId].nodeId?CAMP_DESTINATIONS[node.locationId]:Object.values(CAMP_DESTINATIONS).find(value=>value.nodeId&&value.nodeId===node?.id);
  return {nodeId:node.id,regionId:region.id,regionName:region.name,terrainId:Object.hasOwn(CAMP_TERRAINS,node.terrain)?node.terrain:'normal',destinationId:destination?.id??null};
 }
 battleContext(nodeId){const context=this.nodeContext(nodeId);return {region:'camp',campRegionId:context.regionId,campRegionName:context.regionName,campTerrainId:context.terrainId,campNodeId:context.nodeId,campDestinationId:context.destinationId,timeOfDay:'day'};}
 setCampLocation(nodeId){this.game.setLocation(this.nodeContext(nodeId).regionName);}
 refresh(){this.fairies?.refresh();this.updateHealth();this.updateBattleStatus();this.refreshBaseRoutes();const g=this.game,key=JSON.stringify([g.scene,g.house.getConsecutiveRelaxActions(),g.session.state.camp,g.session.state.pendingAngerEvent]);if(this.preparationKey!==key){this.preparationKey=key;this.ui.refresh();if(g.scene==='camp-base')this.updateBaseMap();}const atBase=g.scene==='camp-base';this.baseControls.hidden=!atBase;this.baseSummary.hidden=!atBase;this.baseControls.querySelector('[data-camp-base-depart]').disabled=!this.canDepart()||g.isPaused();this.worldMapTrigger.hidden=g.scene!=='house'||!g.session.state.visitorName||Boolean(g.story?.active);this.worldMapTrigger.disabled=!this.canBrowse()||(g.isPaused()&&!this.ui.worldDialog.open)||document.hidden;}
 refreshBaseRoutes(){
  const progress=this.game.session.state.camp,key=JSON.stringify([progress.bases,progress.baseNetwork]);if(this.baseNetworkKey===key)return;this.baseNetworkKey=key;this.baseRoutes=[];const generation=++this.baseRouteGeneration,bases=listCampBases(progress),byId=new Map(bases.map(base=>[base.id,base]));
  // Compute only when the persistent network changes, never during map draws.
  const directions=(progress.baseNetwork||[]).flatMap(link=>[[link.fromId,link.toId],[link.toId,link.fromId]]);
  this.baseRoutePromise=(async()=>{for(const [fromId,toId]of directions){if(generation!==this.baseRouteGeneration||this.destroyed)return;const from=byId.get(fromId),to=byId.get(toId);try{const result=await requestCampOptimalRoute({startId:from.nodeId,goalId:to.nodeId,network:true});if(generation!==this.baseRouteGeneration||this.destroyed)return;if(result?.status==='ready'&&Array.isArray(result.path))this.baseRoutes.push({fromId,toId,path:[...result.path]});}catch(error){this.baseRouteError=error?.message||String(error);}}if(generation===this.baseRouteGeneration&&!this.destroyed){this.ui.refresh();if(this.game.scene==='camp-base')this.updateBaseMap();}})();
 }
 updateBaseMap(){const base=this.departureBase();this.baseMap.update({discovered:this.game.session.state.camp.discovered,nodeId:base.nodeId,bases:listCampBases(this.game.session.state.camp),baseRoutes:this.baseRoutes});this.baseMap.resize();this.baseMap.centerCurrent();}
 async visitBase(id){
  const g=this.game,base=getCampBase(g.session.state.camp,id);if(!base||!this.canBrowse()||this.active||g.isPaused()||document.hidden||g.session.state.location!=='home'||g.session.state.battle)return {ok:false,message:'探索や演出が終わってから移動しよう。'};
  if(!g.session.moveCampBase(id))return {ok:false,message:'移動先の拠点を確認できませんでした。'};
  this.hideBase();g.trainingHall?.deactivate();g.deactivateRoomVisits?.();g.messages=[];g.clearMessage();
  if(base.foundation){g.scene='house';g.setLocation('おこていゆハウス');g.house.arriveFromOutside({afterBattle:false});g.view.setHouse();g.onCampCheckpoint?.();g.sync();return {ok:true};}
  g.scene='camp-base';this.viewingBaseId=base.id;g.setLocation(base.name);g.homeElement.hidden=true;g.house.leaveHouse();g.view.clear();this.baseVisitSerial=(this.baseVisitSerial||0)+1;const visit=this.baseVisitSerial;
  g.onCampBaseEntered?.(this.baseMapHost,base);this.baseControls.hidden=false;this.baseSummary.hidden=false;this.baseSummary.querySelector('h3').textContent=base.name;this.updateBaseMap();g.onCampCheckpoint?.();g.sync();
  try{if(!this.baseView){const {CampBaseView}=await import('./camp-base-view.js');if(this.destroyed||g.scene!=='camp-base'||visit!==this.baseVisitSerial)return {ok:false};this.baseView=new CampBaseView({container:g.view.surface,isPresentationPaused:()=>g.isPaused()||document.hidden,onError:()=>g.toast('キャンプ拠点の3D表示を再試行してください。')});}const ready=await this.baseView.load(base);if(this.destroyed||g.scene!=='camp-base'||visit!==this.baseVisitSerial)return {ok:false};this.baseView.setActive(true);g.sync();return {ok:ready!==false};}catch(error){this.baseViewError=error?.message||String(error);g.toast('キャンプ拠点を表示できませんでした。地図からもう一度移動できます。');return {ok:false,message:'拠点の3D表示を準備できませんでした。'};}
 }
 hideBase(){this.baseVisitSerial=(this.baseVisitSerial||0)+1;this.baseView?.setActive(false);this.baseControls.hidden=true;this.baseSummary.hidden=true;}
 async withdrawBase(id){
  const g=this.game,base=getCampBase(g.session.state.camp,id);if(!base?.frontier||!this.canBrowse()||this.active||g.session.state.location!=='home'||g.session.state.battle||g.isPaused())return {ok:false,message:'今はこの拠点を撤収できません。'};
  const approved=await this.baseActions.open({title:'拠点を撤収しますか？',text:base.name+'を撤収し、拠点ネットワークと地図の経路表示を取り除きます。',confirm:'撤収する',cancel:'残しておく'});if(approved!==true)return {ok:false};
  if(!g.session.withdrawCampBase(id))return {ok:false,message:'拠点の状態が変わりました。地図を確認してください。'};
  this.refreshBaseRoutes();if(g.scene==='camp-base'&&this.viewingBaseId===id){const neighborId=g.session.state.camp.currentBaseId;await this.visitBase(neighborId);}else if(g.scene==='camp-base')this.updateBaseMap();g.onCampCheckpoint?.();g.sync();return {ok:true};
 }
 updateBattleStatus(){
  const g=this.game,battle=g.session.state.battle,ui=g.battleUI;
  this.ui.setBattleActive(Boolean(this.active&&!this.finalStarted&&g.scene==='battle'&&battle?.kind==='camp'&&ui.active&&ui.embedded&&!this.actionArea.hidden&&!ui.panel.hidden));
 }
 updateHealth(){
  const battle=this.game.session.state.battle,finalBattle=Boolean(this.active&&(this.finalStarted||battle?.kind==='camp-final'));
  this.actionArea.dataset.finalBattle=String(finalBattle);this.health.hidden=!this.active||finalBattle;
  if(this.health.hidden)return;
  const player=battle?.kind==='camp'?battle.player:null,maxHp=Math.max(.1,Number(player?.maxHp??this.maxHp)||1),hp=Math.max(0,Math.min(maxHp,Number(player?.hp??this.hp)||0)),ratio=hp/maxHp;
  const key=hp+'|'+maxHp;if(this.healthKey===key)return;this.healthKey=key;
  this.health.dataset.hp=String(hp);this.health.dataset.maxHp=String(maxHp);this.health.classList.toggle('is-low',ratio<=.25);
  const format=value=>value.toLocaleString('ja-JP',{maximumFractionDigits:1}),text=format(hp)+' / '+format(maxHp)+' HP',meter=this.health.querySelector('[role="progressbar"]');
  setPaintedText(this.health.querySelector('.camp-health__value'),text,{background:'#f8f4e9',align:'right',fitText:true,immutableImage:true});
  meter.setAttribute('aria-valuenow',String(Math.round(ratio*100)));meter.setAttribute('aria-label','おこていゆのHP '+format(hp)+' / '+format(maxHp));meter.querySelector('i').style.width=ratio*100+'%';
 }
 mountActionArea(){this.actionArea.append(this.game.battleUI.panel);this.actionArea.hidden=false;}
 setStatus(phase='travel'){
  const night=phase==='night',ended=done.has(phase);
  this.statusPanel.querySelector('strong').textContent=ended?'今回の探索を終える':night?'ふたりで、ひと休み':'ふたりの探索を見守る';
  this.statusPanel.querySelector('p').textContent=ended?'記録を確かめたら、出発した拠点へ戻ろう。':night?'夜は野営して、明日に備えます。':'物資を使いながら、未開の地を進んでいます。';
 }
 emit(event){this.entries.push(event);if(this.entries.length>250)this.entries.shift();this.game.onCampEvent?.(event);}
 requestStart({bag,destination='none'}={}){
  const g=this.game;if(!this.canDepart()||g.isPaused()||document.hidden)return {ok:false,message:'拠点で、支度ができてから出発しよう。'};
  if(!isCampDestinationUnlocked(destination,g.session.state.camp.discovered))return {ok:false,reason:'destination-unvisited',message:'まだ訪れていない目標地点は選べません。まずは探索で見つけよう。'};
  const departure=this.departureBase();
  if(g.scene==='house'&&g.session.state.camp.currentBaseId!=='house'&&!g.session.moveCampBase('house'))return {ok:false,message:'出発する拠点を確認できませんでした。'};
  let engine;try{engine=new CampExpedition({bag,destination,startId:departure.nodeId,playerLevel:g.session.player.level,discovered:g.session.state.camp.discovered,rng:()=>g.session.random(),onEvent:event=>this.onEvent(event)});}catch(error){return {ok:false,message:error.message};}
  const result=g.session.requestCamp({bag,destination,startBaseId:departure.id,relaxStreak:g.house.getConsecutiveRelaxActions(),spendCalmPoints:count=>g.house.spendCalmPoints(count)});
  if(!result.ok)return {...result,message:result.reason==='not-enough-calm'?'穏やかポイントが足りません。':'今はキャンプに出発できません。'};
  this.serial++;this.active=true;this.engine=engine;this.startBaseId=departure.id;this.entries=[];this.hadBattle=false;this.finalStarted=false;this.finalIntro=null;this.settling=false;this.discoveryQueue=[];this.activeDiscovery=null;this.deferredEvents=[];this.finishing=false;
  const stats=playerStats(g.session.player);this.hp=stats.hp;this.maxHp=stats.hp;engine.context({hp:this.hp,maxHp:this.maxHp});
  this.emit({type:'departure',day:1,activityHours:0,nodeId:departure.nodeId,cost:result.calmPointsCost,destination});
  g.pendingEncounter=null;
  if(departure.foundation){g.departureDestination={kind:'camp'};g.sync();g.startSceneCutin('departure');}
  else{this.hideBase();this.begin();}
  return result;
 }
 begin(){const g=this.game;if(!this.active||!this.engine)return false;g.scene='camp';this.setCampLocation();g.house.leaveHouse();g.homeElement.hidden=true;this.mountActionArea();g.view.clear();this.ui.show(this.engine.snapshot());this.setStatus();this.statusPanel.hidden=false;this.updateHealth();g.onCampStarted?.(this.entries);g.sync();return true;}
 checkpoint(){if(!this.engine)return;this.game.session.updateCampProgress({discovered:this.engine.snapshot().visited});this.game.onCampCheckpoint?.();}
 onEvent(event){
  if(!this.active)return;this.emit(event);
  if(event.type==='heal'){this.hp=event.hp;this.maxHp=event.maxHp;this.updateHealth();}
  if(event.type==='arrive'){
   const destination=getCampDestinationAt(event.nodeId),wasUnlocked=destination&&isCampDestinationUnlocked(destination.id,this.game.session.state.camp.discovered);
   this.setCampLocation(event.nodeId);this.checkpoint();
   if(destination&&!wasUnlocked&&isCampDestinationUnlocked(destination.id,this.game.session.state.camp.discovered)){
    this.emit({type:'destination-discovered',destinationId:destination.id,name:destination.name,nodeId:event.nodeId,day:event.day,activityHours:event.activityHours});
    this.discoveryQueue.push({nodeId:event.nodeId,name:destination.name});this.presentDiscovery();
   }
  }
  else if(['encounter','night','final','failed'].includes(event.type)){
   if(this.activeDiscovery||this.discoveryQueue.length){this.deferredEvents.push(event);return;}
   this.dispatchPresentationEvent(event);
  }
 }
 dispatchPresentationEvent(event){if(event.type==='encounter')this.startEncounter(event);else if(event.type==='night')this.startNight();else if(event.type==='final')this.startFinal();else if(event.type==='failed'){this.game.scene='camp';this.setStatus('failed');this.statusPanel.hidden=false;this.ui.show(this.engine.snapshot());this.checkpoint();}}
 presentDiscovery(){
  const g=this.game;if(!this.active||g.scene!=='camp'||g.isMessageVisible()||g.isModalPaused()||g.messageLocked||document.hidden)return false;
  if(!this.activeDiscovery&&this.discoveryQueue.length)this.activeDiscovery=this.discoveryQueue.shift();
  if(!this.activeDiscovery)return false;
  const value=this.activeDiscovery;g.say({type:'move',category:'narration',kind:'narration',speaker:'ナレーション',text:value.name+'に到達しました。次回キャンプから目標に設定可能です。',campDiscovery:{serial:this.serial,nodeId:value.nodeId}});return true;
 }
 flushDeferredEvents(){while(!this.activeDiscovery&&!this.discoveryQueue.length&&this.deferredEvents.length&&this.game.scene==='camp'){this.dispatchPresentationEvent(this.deferredEvents.shift());if(this.finalIntro||this.game.scene!=='camp')break;}}
 tick(dt){
  if(this.game.scene==='camp-base'){this.baseView?.tick(dt);return true;}
  if(!this.active||!this.engine)return false;
  if(this.fairies.tick(dt)){this.ui.update(this.engine.snapshot());return true;}
  if(this.activeDiscovery||this.discoveryQueue.length){this.presentDiscovery();return true;}
  if(this.deferredEvents.length){this.flushDeferredEvents();return true;}
  if(this.finalIntro){this.presentFinalIntroduction();return true;}
  if(this.game.scene==='camp-night'){this.night.tick(dt);return true;}
  if(this.game.scene!=='camp')return false;
  const state=this.engine.tick(dt,{hp:this.hp,maxHp:this.maxHp,playerLevel:this.game.session.player.level});this.hp=state.hp;this.maxHp=state.maxHp;this.ui.update(state);this.updateHealth();return true;
 }
 startNight(){const g=this.game;if(!this.engine||g.scene!=='camp')return;g.scene='camp-night';this.setStatus('night');this.ui.hide();g.view.clear();this.night.start({player:g.session.player});g.sync();this.checkpoint();}
 wake(){const g=this.game;if(!this.active||g.scene!=='camp-night'||this.engine?.snapshot().phase!=='night')return;this.night.hide();g.view.clear();g.scene='camp';this.setCampLocation();this.setStatus();this.ui.show(this.engine.snapshot());this.engine.resumeAfterNight();this.ui.update(this.engine.snapshot());this.checkpoint();g.sync();}
 startEncounter(event){
  const g=this.game,context=this.nodeContext(event?.nodeId),enemy=chooseCampEncounter(g.session.player.level,CREATURES,()=>g.session.random(),context);
  if(!enemy){this.engine.resolveEncounter({won:true,hp:this.hp,maxHp:this.maxHp});return;}
  this.statusPanel.hidden=true;this.ui.update(this.engine.snapshot());g.startBattle(enemy,{encounterType:'camp',campEmbedded:true,...this.battleContext(context.nodeId),playerHp:this.hp});this.updateHealth();this.updateBattleStatus();
 }
 startFinal(){
  const g=this.game;if(!this.active||this.finalStarted||this.finalIntro||!this.engine)return false;
  const s=this.engine.snapshot(),actualDestination=getCampDestinationAt(s.nodeId),targetReached=s.finalReason==='destination'&&actualDestination?.id===s.destination,id=targetReached?actualDestination.guardianSpeciesId:'great_fairy',species=CREATURES[id];
  if(s.phase!=='final')return false;
  if(!species){this.engine.abort('unavailable');g.toast('最終地点のモデルを準備できませんでした。出発した拠点へ戻れます。');this.ui.show(this.engine.snapshot());return;}
  const destination=actualDestination||CAMP_DESTINATIONS[s.destination],arrival=s.finalReason==='destination',place=destination&&destination.id!=='none'?destination.name:'目標地点';
  const text=arrival?place+'にたどり着いた。奥のほうに、珍生物の気配がする。':finalExplorationMessages[s.finalReason]||'今回の探索は、ここで一区切り。ふたりが帰り支度を始めると……。';
  this.finalIntro={serial:this.serial,index:0,waitingForRead:false,speciesId:id,messages:[{type:'move',text},{type:'enemy',text:'道の先に、'+species.name+'が姿を現した。おこていゆは静かに身構えた。'}]};
  this.ui.show(s);this.statusPanel.hidden=false;this.checkpoint();this.presentFinalIntroduction();g.sync();return true;
 }
 presentFinalIntroduction(){
  const g=this.game,pending=this.finalIntro;
  if(!this.active||!pending||pending.serial!==this.serial||this.finalStarted||g.scene!=='camp')return false;
  if(this.engine?.snapshot().phase!=='final'){this.finalIntro=null;return false;}
  if(g.isMessageVisible()||g.isModalPaused()||g.messageLocked||document.hidden)return false;
  if(pending.index<pending.messages.length){
   // An internal clear is not a read acknowledgement: show this page again.
   pending.waitingForRead=true;g.say({...pending.messages[pending.index],kind:'narration',category:'narration',speaker:'ナレーション',campFinalIntro:{serial:pending.serial,index:pending.index}});return true;
  }
  const s=this.engine.snapshot(),id=pending.speciesId,species=CREATURES[id];
  this.finalIntro=null;this.finalStarted=true;this.updateHealth();this.updateBattleStatus();
  const level=chooseCampGuardianLevel(g.session.player.level,species,()=>g.session.random());
  this.emit({type:'guardian',name:species.name,nodeId:s.nodeId,day:s.day,activityHours:s.activityHours});
  this.ui.hide();this.night.hide();this.statusPanel.hidden=true;
  g.startBattle({speciesId:id,level,id:'camp-guardian'},{encounterType:'camp-final',...this.battleContext(s.nodeId),playerHp:this.hp});return true;
 }
 onMessageClosed(payload){
  const discovery=payload?.campDiscovery;
  if(this.active&&this.activeDiscovery&&discovery?.serial===this.serial&&discovery.nodeId===this.activeDiscovery.nodeId&&!this.game.isMessageVisible()){
   this.activeDiscovery=null;if(this.discoveryQueue.length)this.presentDiscovery();else this.flushDeferredEvents();return true;
  }
  if(this.discoveryQueue.length||this.activeDiscovery){this.presentDiscovery();return true;}
  const pending=this.finalIntro,token=payload?.campFinalIntro;
  if(!this.active||!pending||!pending.waitingForRead||this.game.scene!=='camp'||this.game.isMessageVisible()||pending.serial!==this.serial||token?.serial!==pending.serial||token.index!==pending.index)return false;
  pending.waitingForRead=false;pending.index++;this.presentFinalIntroduction();return true;
 }
 settled(snapshot){
  const g=this.game;if(this.settling||!this.active||snapshot?.kind!=='camp'||snapshot.phase!=='ended')return false;this.settling=true;
  this.hadBattle=true;this.emit({type:'battle-rewards',day:this.engine.snapshot().day,activityHours:this.engine.snapshot().activityHours,result:snapshot.result,rewards:snapshot.rewards});
  this.maxHp=playerStats(g.session.player).hp;this.hp=Math.min(snapshot.player.hp,this.maxHp);
  if(!g.session.finishCampBattle()){this.settling=false;return false;}
  for(const unlock of snapshot.rewards?.superUnlocks||[])g.session.acknowledgeSuperUnlock(unlock.id);
  g.battleUI.deactivate();g.scene='camp';this.setCampLocation();g.resultDelay=null;this.statusPanel.hidden=false;
  // Commit real rewards while no battle exists: resolving the journey may
  // synchronously start its final battle and close the checkpoint window.
  this.checkpoint();
  this.engine.context({hp:this.hp,maxHp:this.maxHp,playerLevel:g.session.player.level});
  this.ui.show(this.engine.snapshot());this.engine.resolveEncounter({won:snapshot.result==='win',hp:this.hp,maxHp:this.maxHp});
  const current=this.engine.snapshot();this.hp=current.hp;this.maxHp=current.maxHp;this.ui.update(current);this.updateHealth();this.updateBattleStatus();this.checkpoint();this.settling=false;g.sync();return true;
 }
 get canCheckpoint(){return this.game.scene==='camp-base'&&!this.game.session.state.battle||this.active&&['camp','camp-night'].includes(this.game.scene)&&!this.game.session.state.battle;}
 returnHome(){const g=this.game;if(!this.active||!done.has(this.engine?.snapshot().phase)||g.isPaused()||document.hidden)return false;return this.finishExploration();}
 finishFinalBattle(){if(!this.active||this.game.session.state.battle?.kind!=='camp-final'||!this.game.canReturnHomeAfterBattle())return false;return this.finishExploration();}
 async finishExploration(){
  const g=this.game,phase=this.engine?.snapshot().phase,finalReady=phase==='final'&&g.session.state.battle?.kind==='camp-final'&&g.canReturnHomeAfterBattle();if(!this.active||!this.engine||!done.has(phase)&&!finalReady||this.finishing||g.isPaused()||document.hidden)return false;this.finishing=true;const serial=this.serial,nodeId=this.engine.snapshot().nodeId,startBaseId=this.startBaseId||'house';
  try{
   const finalBattle=g.session.state.battle,canOfferBase=finalBattle?.kind==='camp-final'&&finalBattle.phase==='ended'&&finalBattle.result==='win'&&g.canReturnHomeAfterBattle();
   if(canOfferBase&&canEstablishCampBase(g.session.state.camp,nodeId)){
    const approved=await this.baseActions.open({title:'ここにキャンプ拠点を設営しますか？',text:'探索を終えた、この通常エリアに拠点を作れます。\n次のキャンプは、この場所から出発できるようになります。'});
    if(approved===null)return false;if(!this.active||serial!==this.serial)return false;
    if(approved){const result=g.session.establishCampBase({nodeId,startBaseId});if(!result?.ok){g.toast('この場所には拠点を設営できませんでした。地図を確認してください。');return false;}}
   }
   const afterBattle=this.hadBattle||g.session.state.battle?.kind==='camp-final';if(!g.session.endCamp({afterBattle}))return false;const returnBase=getCampBase(g.session.state.camp,startBaseId)||CAMP_FOUNDATION_BASE;
   this.deactivate();g.sceneCutin.stop();g.resultCutinComplete=false;g.messageLocked=false;g.battleUI.deactivate();g.scene='house';if(returnBase.foundation)g.session.moveCampBase(returnBase.id);g.setLocation('おこていゆハウス');g.house.arriveFromOutside({afterBattle});g.view.setHouse();g.messages=[];g.resultMessages=[];g.resultMessageActive=false;g.resultMessagesComplete=true;g.clearMessage();g.sync();g.onCampCheckpoint?.();
   if(!returnBase.foundation)await this.visitBase(returnBase.id);return true;
  }finally{this.finishing=false;}
 }
 deactivate(){this.fairies?.reset();this.active=false;this.serial++;this.finalIntro=null;this.discoveryQueue=[];this.activeDiscovery=null;this.deferredEvents=[];this.ui.hide();this.night.hide();this.statusPanel.hidden=true;this.actionArea.hidden=true;this.updateHealth();this.game.homeElement.after(this.game.battleUI.panel);}
 destroy(){this.destroyed=true;this.deactivate();this.hideBase();this.fairies.destroy();this.ui.destroy();this.night.destroy();this.baseView?.destroy();this.baseActions.destroy();this.baseMap.destroy();this.baseMapHost.removeEventListener('click',this.baseMapClick);this.baseMapHost.removeEventListener('keydown',this.baseMapKey);this.baseMapHost.remove();this.baseSummary.remove();this.baseControls.remove();this.worldMapTrigger.remove();releasePaintedLabels(this.health);this.actionArea.remove();}
}
