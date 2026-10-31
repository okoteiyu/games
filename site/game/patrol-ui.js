import {displayedWinChance,winChanceColor} from './win-chance-display.js';
import {currentTimeOfDay} from './world-time.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';
import { getBattleRegionAt } from './patrol-map.js';
import { PatrolState,branchWinChance } from './patrol-state.js';
import { isModalBlocked, tryOpenModal, releaseModal } from './modal-layer.js';
import { REGION_LABELS } from './patrol-map.js';
const directions=[['left','左'],['front','前'],['right','右']];

export class PatrolUI {
 constructor({now=()=>new Date(),isSupportEquipped=()=>true,canStart=()=>true,view,mapPanel,homeElement,onEnter,onLeave,onEvent,isPaused,hideMessage,rng=Math.random,enemyProvider=null,onEncounter=null,onAbort=()=>false}){
  Object.assign(this,{now,isSupportEquipped,canStart,view,mapPanel,homeElement,onEnter,onLeave,onEvent,isPaused,hideMessage,rng,enemyProvider,onEncounter,onAbort});this.active=false;this.model=null;this.progress=0;this.timeOfDay=currentTimeOfDay(this.now());this.renderer=null;this.rendererLoading=null;this.rendererFailed=false;this.rendererGeneration=0;this.throwPending=null;this.turn=null;
  this.renderMount=document.createElement('div');this.renderMount.className='patrol-webgl-mount';
  this.overlayObserver=new MutationObserver(()=>{this.layoutForkArrows();this.scheduleForkLayout();});this.overlayObserver.observe(this.view.element,{attributes:true,attributeFilter:['data-message-visible']});
  this.panel=document.createElement('section');this.panel.className='lower-right patrol-actions';this.panel.id='patrolChoices';this.panel.hidden=true;this.panel.setAttribute('aria-label','道中での選択肢');
  this.panel.innerHTML='<header class="patrol-actions__heading"><span>こっそり、妖精にお願い</span></header>'+[['eggplant','ナス','🍆'],['tomato','トマト','🍅']].map(([id,label,emoji])=>'<section class="fairy-choice" data-fairy-section="'+id+'"><h2>'+label+'の妖精 <span class="patrol-stock" id="'+id+'Stock">'+emoji+' <b>2</b><small> / 2回</small></span></h2><nav class="patrol-branches" aria-label="'+label+'の妖精にお願いする道">'+directions.map(([direction,text])=>'<button type="button" class="patrol-branch" data-fairy="'+id+'" data-direction="'+direction+'" disabled><span>'+text+'</span><small></small></button>').join('')+'</nav></section>').join('')+'<div class="patrol-window"><p id="patrolWindowText" role="status">道を歩いている</p><div><i></i></div></div><div class="patrol-encounter-actions" hidden><p>珍生物に出会った。</p><button type="button" data-patrol-action="home">ハウスに戻る</button></div>';

  this.skipButton=document.createElement('button');this.skipButton.type='button';this.skipButton.className='patrol-skip';this.skipButton.textContent='移動をスキップして戦闘へ';this.panel.querySelector('.patrol-window').append(this.skipButton);
  this.abortButton=document.createElement('button');this.abortButton.type='button';this.abortButton.className='patrol-abort';this.abortButton.dataset.patrolAbort='';this.abortButton.textContent='パトロールを中断';this.abortButton.addEventListener('click',()=>{if(this.active&&!this.isPaused()&&!isModalBlocked())this.onAbort(this.abortButton);});this.panel.querySelector('.patrol-window').append(this.abortButton);
  this.skipDialog=document.createElement('dialog');this.skipDialog.className='patrol-skip-dialog';this.skipDialog.id='patrolSkipDialog';this.skipDialog.setAttribute('aria-labelledby','patrolSkipTitle');
  this.skipDialog.innerHTML='<h2 id="patrolSkipTitle">戦闘まで進みますか？</h2><p>今のルートで最初に出会う珍生物との戦闘へ進みます。道中での進路変更は、ここまでになります。</p><div><button type="button" data-skip="cancel">戻る</button><button type="button" data-skip="confirm">戦闘へ進む</button></div>';
  document.body.append(this.skipDialog);this.skipButton.addEventListener('click',()=>{if(!this.active||this.isPaused()||this.turn||this.throwPending||this.renderer?.eggplantBusy||!this.renderer?.ready||this.renderer.loading)return;this.skipDialog.returnValue='';if(tryOpenModal(this.skipDialog))this.skipModel=this.model;});
  this.skipDialog.addEventListener('click',e=>{const b=e.target.closest('[data-skip]');if(b)this.skipDialog.close(b.dataset.skip);});
  this.skipDialog.addEventListener('close',()=>{releaseModal(this.skipDialog);const same=this.skipModel===this.model;this.skipModel=null;if(this.skipDialog.returnValue==='confirm'&&same&&this.active)this.skipToBattle();else if(this.active)this.skipButton.focus({preventScroll:true});});
  homeElement.after(this.panel);
  this.mapDialog=document.createElement('dialog');this.mapDialog.id='patrolMapDialog';this.mapDialog.className='patrol-map-dialog';this.mapDialog.setAttribute('aria-labelledby','patrolMapTitle');this.mapDialog.setAttribute('aria-modal','true');
  this.mapDialog.innerHTML='<header><div><small>FIELD MAP</small><h2 id="patrolMapTitle">道中マップ</h2></div><button type="button" class="patrol-map-close" aria-label="道中マップを閉じる">×</button></header><p class="patrol-map-summary">40の交差点 · 70の道</p><svg viewBox="0 0 140 140" role="img" aria-label="道中の全体マップ。中央のハウス、珍生物の位置、おこていゆの位置と進行方向"></svg><footer><div class="patrol-zone-legend"><span><i class="city"></i>都市部</span><span><i class="residential"></i>住宅街</span><span><i class="forest"></i>森林</span></div><div class="patrol-map__legend"><span>0% 赤</span><i></i><span>100% 緑</span><small>50% は黄色</small><small>装備効果を除くステータス比</small></div><p>⌂ おこていゆハウス　▲ 現在位置と進行方向</p></footer>';
  document.body.append(this.mapDialog);this.mapDialog.querySelector('button').addEventListener('click',()=>this.mapDialog.close());
  this.mapDialog.addEventListener('close',()=>{releaseModal(this.mapDialog);this.mapTrigger.setAttribute('aria-expanded','false');this.mapTrigger.disabled=!this.active;if(!isModalBlocked()&&this.mapTrigger.isConnected)this.mapTrigger.focus({preventScroll:true});});
  this.mapDialog.addEventListener('click',event=>{if(event.target!==this.mapDialog)return;const r=this.mapDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)this.mapDialog.close();});
  this.panel.addEventListener('click',e=>{const button=e.target.closest('[data-direction]');if(button&&!button.disabled)this.throwFairy(button.dataset.fairy,button.dataset.direction);const action=e.target.closest('[data-patrol-action]');if(action?.dataset.patrolAction==='home'&&!isModalBlocked())this.returnHome();});
  this.lastTime=performance.now();const frame=time=>{const dt=Math.min(.1,(time-this.lastTime)/1000);this.lastTime=time;if(this.active){this.refreshTimeOfDay();if(!this.isPaused()&&!document.hidden&&!this.throwPending&&!this.renderer?.eggplantBusy&&this.renderer?.ready&&!this.renderer.loading&&!this.renderer.failed&&!this.renderer.contextLost&&!this.rendererFailed)this.tick(dt);this.paintMotion();}this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);
 }
 emit(text,type='move',showMessage=true){this.onEvent({text,type,speaker:'ナレーション',kind:'narration'},{showMessage});}
 start(){
  if(isModalBlocked()||this.active||!this.canStart())return false;
  this.refreshTimeOfDay();this.throwPending=null;this.renderer?.cancelEggplantThrow();
  this.model=new PatrolState({rng:this.rng});if(this.enemyProvider)this.model.providedEnemies=this.enemyProvider(this.model.map,{timeOfDay:this.timeOfDay});this.model.start();this.active=true;this.turn=null;this.progress=0;this.approachTried=false;this.throwDirection=null;
  this.hideMessage();this.onEnter();this.view.clear();this.buildScene();this.panel.hidden=false;this.sync();this.emit('おこていゆは、珍生物パトロールへ出かけた。あなたはこっそり後をつける。','move',false);return true;
 }
 reset(){this.turn=null;this.active=false;this.throwPending=null;this.renderer?.cancelEggplantThrow();this.renderer?.setActive(false);this.panel.hidden=true;this.mapElement?.remove();this.forkResizeObserver?.disconnect();if(this.forkLayoutFrame)cancelAnimationFrame(this.forkLayoutFrame);this.forkLayoutFrame=0;this.hideMessage();this.view.setHouse();}
 suspendForBattle(){this.turn=null;this.active=false;this.renderer?.setActive(false);this.panel.hidden=true;if(this.mapElement)this.mapElement.disabled=true;this.forkResizeObserver?.disconnect();}
 returnHome({afterBattle=false}={}){if(isModalBlocked())return false;this.reset();this.onLeave({afterBattle:afterBattle===true});return true;}
 snapshot(){return this.model?.snapshot()??null;}
 buildScene(){
  releasePaintedLabels(this.scene);this.mapElement?.remove();
  const scene=document.createElement('div');scene.className='patrol-scene';scene.setAttribute('aria-label','道中を奥へ進むおこていゆと、後ろで跳ねるモアイくん');
  scene.innerHTML='<div class="patrol-render-status" role="status"><span>道中を読み込んでいます…</span><button type="button" hidden>もう一度読み込む</button></div><div class="patrol-meter"><span>道中</span><b id="patrolMoves">0 / 6 移動</b><small id="patrolRegionLabel"></small></div><div class="patrol-scene-note" id="patrolSceneNote">こっそり、あとをつけている。</div>';
  this.scene=scene;scene.prepend(this.renderMount);this.view.surface.append(scene);
  scene.querySelector('.patrol-render-status button').addEventListener('click',()=>this.retryRenderer());
  this.mapElement=document.createElement('button');this.mapElement.type='button';this.mapElement.className='patrol-map';this.mapElement.id='patrolMapTrigger';this.mapElement.setAttribute('aria-label','道中マップを拡大');this.mapElement.setAttribute('aria-haspopup','dialog');this.mapElement.setAttribute('aria-controls','patrolMapDialog');this.mapElement.setAttribute('aria-expanded','false');this.mapElement.innerHTML='<svg viewBox="0 0 140 140" aria-hidden="true"></svg>';
  this.mapTrigger=this.mapElement;this.mapElement.addEventListener('click',()=>this.openMap());this.mapPanel.showPatrol(this.mapElement);this.buildMap();
  this.forkResizeObserver?.disconnect();this.forkResizeObserver=new ResizeObserver(()=>{this.layoutForkArrows();this.scheduleForkLayout();});this.forkResizeObserver.observe(this.view.element);this.forkResizeObserver.observe(this.mapElement);this.layoutForkArrows();
  if(this.renderer)this.renderer.setActive(true);this.ensureRenderer();
 }
 openMap(){if(!this.active||this.isPaused()||isModalBlocked())return false;this.buildMap();if(!tryOpenModal(this.mapDialog))return false;this.mapTrigger.setAttribute('aria-expanded','true');return true;}
 buildMap(){
  const s=this.snapshot();this.nodeById=new Map(s.map.nodes.map(n=>[n.id,n]));this.point=id=>{const n=this.nodeById.get(id);return{x:n.x*140,y:n.y*140};};
  const enemies=new Map(s.enemies.map(e=>[e.nodeId,e]));
  const content='<image href="'+s.map.backgroundUrl+'" width="140" height="140" preserveAspectRatio="xMidYMid meet"/>'+s.map.edges.map(([a,b],index)=>{const p=this.point(a),q=this.point(b),zones=s.map.edgeRegions?.[index]?.segments.map(x=>REGION_LABELS[x.region]).filter((x,i,all)=>i===0||x!==all[i-1]).join(' → ')||'';return `<path class="patrol-map-edge" d="M${p.x} ${p.y} ${q.x} ${q.y}" fill="none" stroke="#fffdf1" stroke-width="1.5"/><path class="patrol-map-edge-core" d="M${p.x} ${p.y} ${q.x} ${q.y}" fill="none" stroke="#655b53" stroke-width=".55"><title>${zones}</title></path>`;}).join('')+s.map.nodes.map(n=>{const p=this.point(n.id),enemy=enemies.get(n.id),fill=enemy?winChanceColor(displayedWinChance(enemy)):'#fffdf6',home=n.id===s.map.origin;return `${home?`<circle cx="${p.x}" cy="${p.y}" r="4.1" fill="#fff7dd" stroke="#aa784e" stroke-width=".9"/>`:''}<circle class="patrol-map-node" data-node-id="${n.id}"${enemy?` data-probability="${displayedWinChance(enemy)}"`:''} cx="${p.x}" cy="${p.y}" r="${home?2.5:enemy?3:2.3}" fill="${fill}" stroke="#645b50" stroke-width=".55"><title>${home?'おこていゆハウス':n.id} · ${REGION_LABELS[n.region]} · ${enemy?'珍生物'+(enemy.members?.length||1)+'体：勝敗推測 '+Number((enemy.winChanceRaw??enemy.winChance).toFixed(1))+'%':'珍生物なし'}</title></circle>${enemy?`<text class="patrol-map-count" x="${p.x}" y="${p.y+1.35}" text-anchor="middle" fill="#fffef6" font-size="3.8" font-weight="700">${enemy.members?.length||1}</text>`:''}`;}).join('');
  const origin=this.point(s.map.origin),house=`<path d="m${origin.x-2} ${origin.y-.2} 2-1.7 2 1.7v2h-4Z" fill="#9a6945" stroke="#fffdf1" stroke-width=".35"/>`;
  for(const [svg,id] of [[this.mapElement.querySelector('svg'),'patrolMapArrow'],[this.mapDialog.querySelector('svg'),'patrolFullMapArrow']])svg.innerHTML=content+house+`<path id="${id}" d="M0-4.5 3 3 0 1.5-3 3Z" fill="#345e88" stroke="#fff" stroke-width=".8"/>`;
  this.mapDialog.querySelector('.patrol-map-summary').textContent=`${s.map.nodes.length}の交差点 · ${s.enemies.length}か所に珍生物${s.enemies.reduce((total,enemy)=>total+(enemy.members?.length||1),0)}体`;
  this.paintMapArrow();
 }
 paintMapArrow(){
  const s=this.snapshot();if(!s||!this.point)return;const a=this.point(s.current),b=s.next==null?a:this.point(s.next),x=a.x+(b.x-a.x)*this.progress,y=a.y+(b.y-a.y)*this.progress,last=s.previous==null?a:this.point(s.previous),angle=s.next==null?Math.atan2(a.x-last.x,-(a.y-last.y))*180/Math.PI:Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI;
  for(const arrow of [this.mapElement?.querySelector('#patrolMapArrow'),this.mapDialog.querySelector('#patrolFullMapArrow')])arrow?.setAttribute('transform',`translate(${x} ${y}) rotate(${angle+(this.turn?.mapDelta||0)*this.turnEase()})`);
 }
 tick(dt){
  const s=this.snapshot();if(!s||!['walking','approaching'].includes(s.phase)||this.throwPending||this.renderer?.eggplantBusy||!this.renderer?.ready||this.renderer.loading||this.renderer.failed||this.renderer.contextLost||this.rendererFailed)return;
  if(this.turn){this.turn.elapsed=Math.min(this.turn.duration,this.turn.elapsed+dt);this.paintMotion();if(this.turn.elapsed>=this.turn.duration)this.finishLeg();return;}
  this.progress=Math.min(1,this.progress+dt/8);
  if(this.progress>=.4&&!this.approachTried){this.approachTried=true;this.model.approach();this.sync();}
  if(this.progress>=1){
   const branch=this.model.branches().find(b=>b.nodeId===s.route[2]);
   if(branch&&branch.direction!=='front'){
    const a=this.nodeById.get(s.current),b=this.nodeById.get(s.next),c=this.nodeById.get(s.route[2]);
    const incoming=Math.atan2(b.y-a.y,b.x-a.x),outgoing=Math.atan2(c.y-b.y,c.x-b.x);
    this.turn={direction:branch.direction,elapsed:0,duration:.65,mapDelta:Math.atan2(Math.sin(outgoing-incoming),Math.cos(outgoing-incoming))*180/Math.PI};this.sync();
   }else this.finishLeg();
  }
 }
 turnEase(){const t=this.turn?this.turn.elapsed/this.turn.duration:0;return t*t*(3-2*t);}
 skipToBattle(){
  if(!this.active||this.isPaused()||isModalBlocked())return false;
  let guard=0;while(['walking','approaching'].includes(this.model.phase)&&guard++<7){if(!this.model.advance().ok)break;}
  this.turn=null;this.progress=0;this.throwPending=null;this.renderer?.cancelEggplantThrow();this.sync();
  const s=this.snapshot();if(s.phase!=='battle')return false;
  this.emit('道中を進み、珍生物に出会った。','enemy',false);this.onEncounter?.(s.enemies.find(e=>e.nodeId===s.current),{region:getBattleRegionAt(this.nodeById.get(s.current)),coordinate:this.nodeById.get(s.current),timeOfDay:this.timeOfDay});return true;
 }
 finishLeg(){
  this.model.advance();this.turn=null;this.progress=0;this.approachTried=false;this.throwDirection=null;this.sync();const next=this.snapshot();
  if(next.phase==='battle'){this.emit('珍生物に出会った。おこていゆは、そっと身構えた。','enemy');if(this.onEncounter){const enemy=next.enemies.find(e=>e.nodeId===next.current);this.onEncounter(enemy,{region:getBattleRegionAt(this.nodeById.get(next.current)||{x:.5,y:.5}),coordinate:this.nodeById.get(next.current),timeOfDay:this.timeOfDay});}}
  else this.emit('道をひとつ進んだ。','move',false);
 }

 throwEggplant(direction){return this.throwFairy('eggplant',direction);}
 throwTomato(direction){return this.throwFairy('tomato',direction);}
 throwFairy(kind,direction){
  if(this.isPaused()||isModalBlocked()||!this.active||this.turn||this.throwPending||this.renderer?.eggplantBusy||!(kind==='tomato'?this.renderer?.tomatoReady:this.renderer?.eggplantReady)||!this.renderer.ready||this.renderer.loading||this.renderer.failed)return false;
  const s=this.snapshot(),branch=s.branches.find(b=>b.direction===direction);if(!branch||!(kind==='tomato'?s.canThrowTomato&&s.tomatoAvailableNodes.includes(branch.nodeId):s.canThrow))return false;
  const token={model:this.model,message:null};this.hideMessage();this.throwPending=token;
  const accepted=this.renderer[kind==='tomato'?'throwTomato':'throwEggplant'](direction,{onComplete:()=>{
   if(!this.active||this.throwPending!==token||this.model!==token.model)return;
   this.throwPending=null;this.sync();if(token.message)this.emit(token.message,'action');
  }});
  if(!accepted){this.throwPending=null;return false;}
  const result=this.model[kind==='tomato'?'throwTomato':'throwEggplant'](branch.nodeId);if(!result.ok){this.renderer.cancelEggplantThrow();this.throwPending=null;return false;}
  this.throwDirection=direction;
  const prefix=directions.find(([id])=>id===direction)[1]+'の道を、'+(kind==='tomato'?'トマト':'ナス')+'の妖精にお願いした。';
  const outcome=kind==='tomato'?'おこていゆは、好物のトマトについて、その道へ進む。':result.outcome==='rerouted'?'おこていゆは別の道と、別の珍生物を選んだ。':result.snapshot.decision?.crossesEggplant?'遠回りになりすぎるようだ。おこていゆは、嫌々妖精のいる道へ進む。':'遠回りになりすぎるようだ。おこていゆは元のルートを進む。';
  token.message=prefix+outcome;this.sync();return true;
 }
 sync(){
  const s=this.snapshot();if(!s)return;
  this.skipButton.disabled=!this.active||!['walking','approaching'].includes(s.phase)||Boolean(this.turn)||Boolean(this.throwPending)||Boolean(this.renderer?.eggplantBusy);
  this.panel.dataset.phase=s.phase;const battle=s.phase==='battle';this.panel.querySelector('.patrol-encounter-actions').hidden=!battle||Boolean(this.onEncounter);for(const section of this.panel.querySelectorAll('.fairy-choice'))section.hidden=battle;this.panel.querySelector('.patrol-window').hidden=battle;
  setPaintedText(this.panel.querySelector('#eggplantStock b'),s.remainingThrows,{background:'#edf1df'});setPaintedText(this.scene.querySelector('#patrolMoves'),s.moves+' / '+s.maxMoves+' 移動',{background:'#f6f7ec',align:'right'});this.panel.querySelector('#eggplantStock small').textContent=' / '+s.maxThrows+'回';
  setPaintedText(this.panel.querySelector('#tomatoStock b'),s.remainingTomatoThrows,{background:'#edf1df'});this.panel.querySelector('#tomatoStock small').textContent=' / '+s.maxTomatoThrows+'回';
  for(const button of this.panel.querySelectorAll('[data-direction]')){
   const branch=s.branches.find(b=>b.direction===button.dataset.direction),tomato=button.dataset.fairy==='tomato',allowed=tomato?s.canThrowTomato&&s.tomatoAvailableNodes.includes(branch?.nodeId):s.canThrow;
   button.disabled=Boolean(this.turn)||Boolean(this.throwPending)||!allowed||!branch;const info=branch?branchWinChance(s,branch.nodeId):null;
   if(info){button.dataset.probability=String(info.chance);button.style.setProperty('--route-color',winChanceColor(info.chance,{soft:true}));button.title=(info.planned?'予定ルートのターゲット':'すぐ先の珍生物')+' · 勝敗推測 '+Number(info.chance.toFixed(1))+'%';}else{delete button.dataset.probability;button.style.removeProperty('--route-color');button.title='';}
   button.querySelector('small').textContent=info?.planned?'予定':info?'珍生物':'';
  }
  this.panel.querySelector('#patrolWindowText').textContent=s.remainingThrows===0&&s.remainingTomatoThrows===0?'今回のお願いは、ここまで。':s.windowUsed?'妖精に頼んで、見守っている。':s.phase==='approaching'?'交差点に着くまでに、ひとつ。':'分かれ道が近づくのを待つ。';
  this.scene.querySelector('#patrolSceneNote').textContent=this.turn?'進む道へ向きを変えている。':this.throwPending?'妖精が道の奥へ飛んでいる。':battle?'珍生物と遭遇。ここから戦闘が始まる。':'こっそり、あとをつけている。';
  this.paintMotion();
 }
 refreshTimeOfDay(){const value=currentTimeOfDay(this.now());if(value!==this.timeOfDay){this.timeOfDay=value;this.paintMotion();}return value;}
 setTimeOfDay(value){
  if(!['morning','day','night'].includes(value))throw new RangeError('時間帯が正しくありません。');
  this.timeOfDay=value;this.paintMotion();return true;
 }
 async ensureRenderer(){
  if(this.rendererLoading)return this.rendererLoading;
  if(this.renderer){this.renderer.setActive(this.active);this.paintMotion();if(this.rendererFailed||this.renderer.failed)this.updateRenderStatus('道中を表示できませんでした。もう一度お試しください。',true);else if(this.renderer.ready&&!this.renderer.loading)this.updateRenderStatus('');return this.renderer.ready;}
  const generation=++this.rendererGeneration;this.rendererFailed=false;this.updateRenderStatus('道中を読み込んでいます…');
  this.rendererLoading=(async()=>{try{
   const {PatrolView}=await import('./patrol-view.js');
   if(generation!==this.rendererGeneration)return false;
   this.renderer=new PatrolView({container:this.renderMount,isSupportEquipped:this.isSupportEquipped,isPaused:()=>!this.active||this.isPaused()||isModalBlocked(),onStatus:text=>{if(!this.rendererFailed)this.updateRenderStatus(text);},onError:error=>{this.rendererFailed=true;this.updateRenderStatus('道中を表示できませんでした。もう一度お試しください。',true);}});
   this.renderer.setActive(this.active);this.paintMotion();const ready=await this.renderer.load();
   if(!ready&&!this.rendererFailed){this.rendererFailed=true;this.updateRenderStatus('道中を表示できませんでした。もう一度お試しください。',true);}
   if(ready){this.rendererFailed=false;this.paintMotion();}return ready;
  }catch(error){if(generation===this.rendererGeneration){this.rendererFailed=true;this.updateRenderStatus('道中を表示できませんでした。もう一度お試しください。',true);}return false;}finally{if(generation===this.rendererGeneration)this.rendererLoading=null;}})();return this.rendererLoading;
 }
 updateRenderStatus(text,error=false){
  const status=this.scene?.querySelector('.patrol-render-status');if(!status)return;
  status.hidden=!text;status.classList.toggle('is-error',error);status.querySelector('span').textContent=text;status.querySelector('button').hidden=!error;
 }
 retryRenderer(){
  if(!this.active||this.isPaused()||isModalBlocked()||this.throwPending||this.renderer?.eggplantBusy)return false;
  this.rendererGeneration++;this.renderer?.destroy();this.renderer=null;this.rendererLoading=null;this.rendererFailed=false;this.renderMount.replaceChildren();this.ensureRenderer();return true;
 }
 scheduleForkLayout(){
  if(this.forkLayoutFrame)cancelAnimationFrame(this.forkLayoutFrame);
  this.forkLayoutFrame=requestAnimationFrame(()=>{this.forkLayoutFrame=0;this.layoutForkArrows();});
 }
 layoutForkArrows(){
  const arrows=this.scene?.querySelector('#patrolForkArrows');if(!arrows||!this.mapElement)return;
  // The map is below the view; fork signs can use its horizontal center.
  arrows.style.removeProperty('left');arrows.style.removeProperty('right');
  const scene=this.scene.getBoundingClientRect(),gap=Math.max(6,Math.min(12,scene.width*.025));
  let top=scene.height*.43;const message=this.view.element.querySelector('.view-message');
  if(this.view.element.dataset.messageVisible==='true'&&message){const r=message.getBoundingClientRect(),height=arrows.getBoundingClientRect().height||Math.min(44,scene.width*.12);top=Math.min(top,r.top-scene.top-height-gap);}
  arrows.style.visibility='';arrows.style.top=Math.max(12,top)+'px';
 }
 paintMotion(){
  const s=this.snapshot();if(!s||!this.scene)return;this.skipButton.disabled=!this.active||!['walking','approaching'].includes(s.phase)||Boolean(this.turn)||Boolean(this.throwPending)||Boolean(this.renderer?.eggplantBusy)||!this.renderer?.ready||this.renderer.loading;
  this.renderer?.setState({snapshot:s,progress:this.progress,timeOfDay:this.timeOfDay,turn:this.turn?{direction:this.turn.direction,progress:this.turn.elapsed/this.turn.duration}:null});this.paintMapArrow();
  this.panel.querySelector('.patrol-window i').style.width=s.phase==='approaching'?Math.max(0,(1-this.progress)/.6*100)+'%':'0%';
  const diagnostics=this.renderer?.getDiagnostics(),region=diagnostics?.region||this.nodeById?.get(s.current)?.region;
  setPaintedText(this.scene.querySelector('#patrolRegionLabel'),(REGION_LABELS[region]||'')+' · '+(this.timeOfDay==='morning'?'朝':this.timeOfDay==='night'?'夜':'昼'),{background:'#f6f7ec',align:'right'});
 }
}
