import {BattleView} from './battle-view.js';
import {currentTimeOfDay} from './world-time.js';
import {isModalBlocked} from './modal-layer.js';

const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function visitingSnapshot(player={}){
 const hp=Math.max(1,number(player.stats?.hp,1));
 return {phase:'visiting',time:0,enemies:[],targetId:null,super:{active:false},player:{...player,id:'player',speciesId:'okoteiyu',name:'おこていゆ',hp,maxHp:hp,action:null,superActive:false,auraId:player.equippedAura&&player.equippedAura!=='none'?player.equippedAura:null,equipment:player.equipment||{support:'none',defense:'none'}}};
}

/** The training hall is a place to visit; the session still owns every battle. */
export class TrainingHallUI{
 constructor({view,homeElement,readPlayer=()=>({}),readTrainingCourses=()=>[],isPaused=()=>false,onTrain=()=>false,onSelectTraining=()=>false,onReturn=()=>false,onError=()=>{}}={}){
  if(!view?.surface||!homeElement)throw new TypeError('訓練所の表示先がありません。');
  Object.assign(this,{view,homeElement,readPlayer,readTrainingCourses,isPaused,onTrain,onSelectTraining,onReturn,onError});this.active=false;this.loading=false;this.failed=false;this.generation=0;this.snapshot=null;this.terminalButtons=new Map();this.listeners=[];
  this.container=document.createElement('div');this.container.id='trainingHallScene';this.container.className='training-hall-scene';
  this.terminalLayer=document.createElement('div');this.terminalLayer.className='training-hall-terminals';this.terminalLayer.setAttribute('role','group');this.terminalLayer.setAttribute('aria-label','訓練の難易度を選ぶ端末');this.terminalLayer.hidden=true;this.container.append(this.terminalLayer);
  this.terminalHelp=document.createElement('p');this.terminalHelp.className='training-hall-terminal-help';this.terminalHelp.setAttribute('role','status');this.terminalHelp.hidden=true;this.container.append(this.terminalHelp);
  this.status=document.createElement('div');this.status.className='training-hall-status';this.status.setAttribute('role','status');this.status.hidden=true;
  this.status.innerHTML='<span></span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);this.status.querySelector('button').addEventListener('click',()=>{if(!this.isPaused()&&!isModalBlocked())this.show();});
  this.badge=document.createElement('div');this.badge.className='training-hall-badge';this.badge.hidden=true;this.badge.innerHTML='<span>B2</span><strong>訓練所</strong><small>入口から見守る</small>';view.element.append(this.badge);
  this.panel=document.createElement('section');this.panel.id='trainingHallChoices';this.panel.className='lower-right training-hall-actions';this.panel.hidden=true;this.panel.setAttribute('aria-label','訓練所での行動');
  this.panel.innerHTML='<header><span>左の端末から、難易度を選ぼう</span><h2>どうする？</h2></header><nav aria-label="訓練所の選択肢"><button type="button" data-training-start><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/></svg><span>難易度を一覧で選ぶ<small>自動で選ばれた珍生物を招待します</small></span><b aria-hidden="true">›</b></button><button type="button" data-training-home><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></svg><span>おこていゆハウスへ戻る<small>ホーム画面へ帰ります</small></span><b aria-hidden="true">›</b></button></nav>';homeElement.after(this.panel);
  this.trainButton=this.panel.querySelector('[data-training-start]');this.returnButton=this.panel.querySelector('[data-training-home]');
  this.trainButton.addEventListener('click',()=>{if(!this.blocked())this.onTrain(this.trainButton);});this.returnButton.addEventListener('click',()=>{if(this.active&&!this.isPaused()&&!isModalBlocked())this.onReturn(this.returnButton);});
  this.installTerminalInput();this.resizeObserver=new ResizeObserver(()=>this.updateTerminals());this.resizeObserver.observe(this.container);
 }
 get ready(){return Boolean(this.active&&this.controller?.ready&&!this.controller?.contextLost&&!this.loading&&!this.failed);}
 blocked(){return !this.ready||this.isPaused()||isModalBlocked();}
 installTerminalInput(){
  const listen=(type,handler)=>{this.container.addEventListener(type,handler);this.listeners.push(()=>this.container.removeEventListener(type,handler));};
  listen('pointerdown',event=>{
   this.pendingTap=null;
   const target=event.target.closest?.('[data-training-terminal]')||event.target;
   if(target!==this.controller?.canvas&&!this.terminalLayer.contains(target)||this.blocked()||document.hidden||event.button!==0){this.pointerGesture=null;return;}
   if(this.pointerGesture||event.isPrimary===false){this.pointerGesture=null;return;}
   this.pointerGesture={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),dragged:false,target};
  });
  listen('pointermove',event=>{const gesture=this.pointerGesture;if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8)gesture.dragged=true;});
  listen('pointerup',event=>{const gesture=this.pointerGesture;this.pointerGesture=null;if(gesture?.id!==event.pointerId||gesture.dragged||Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8||performance.now()-gesture.at>650)return;this.pendingTap={x:event.clientX,y:event.clientY,at:performance.now(),target:gesture.target};});
  listen('pointercancel',()=>{this.pointerGesture=null;this.pendingTap=null;});
  // Touch release can leave the element before its compatibility click arrives.
  listen('pointerleave',event=>{if(this.pointerGesture?.id===event.pointerId){this.pointerGesture=null;this.pendingTap=null;}});
  listen('click',event=>{
   if(event.target!==this.controller?.canvas)return;
   const tap=this.pendingTap;this.pendingTap=null;
   if(!tap||tap.target!==event.target||performance.now()-tap.at>500||this.blocked()||document.hidden)return;
   const tier=this.controller.pickTrainingTerminal(tap.x,tap.y);if(tier)this.selectTraining(tier,this.terminalButtons.get(tier));
  });
 }
 selectTraining(tier,opener){
  if(this.blocked()||document.hidden||this.snapshot?.phase!=='visiting')return false;
  const course=this.readTrainingCourses().find(item=>item.id===tier);if(!course)return false;
  if(!course.available){this.terminalNoticeTier=tier;this.updateTerminals();return false;}
  this.terminalNoticeTier=null;return this.onSelectTraining(tier,opener||this.trainButton);
 }
 updateTerminals(){
  const targets=this.ready?this.controller.getTrainingTerminals():[],courses=this.readTrainingCourses(),ids=new Set(targets.map(target=>target.id)),blocked=this.blocked()||document.hidden;
  this.terminalLayer.hidden=!this.ready||!targets.length;this.terminalHelp.hidden=this.terminalLayer.hidden;
  for(const [id,button]of this.terminalButtons){if(!ids.has(id)){button.remove();this.terminalButtons.delete(id);}}
  for(const target of targets){
   let button=this.terminalButtons.get(target.id);
   if(!button){button=document.createElement('button');button.type='button';button.dataset.trainingTerminal=target.id;button.className='training-hall-terminal';button.innerHTML='<span></span><i aria-hidden="true"></i>';button.addEventListener('click',event=>{event.stopPropagation();const tap=this.pendingTap;this.pendingTap=null;if(event.detail!==0&&(!tap||tap.target!==button||performance.now()-tap.at>500))return;this.selectTraining(target.id,button);});this.terminalButtons.set(target.id,button);this.terminalLayer.append(button);}
   const course=courses.find(item=>item.id===target.id),available=Boolean(course?.available),label=course?.shortLabel||target.label,reason=course?.reason||'この訓練は、まだ選べません。';
   const neighbors=targets.filter(other=>other.id!==target.id&&Math.abs(other.x-target.x)<Math.max(other.width,target.width)),spacing=Math.min(Infinity,...neighbors.map(other=>Math.abs(other.y-target.y))),maxHeight=Math.max(8,spacing-4),height=Math.min(maxHeight,Math.max(44,target.height)),width=Math.max(44,target.width);
   const text=button.querySelector('span');if(text.textContent!==label)text.textContent=label;
   const marker=button.querySelector('i'),status=available?'選ぶ':'🔒';if(marker.textContent!==status)marker.textContent=status;
   button.hidden=!target.visible;button.disabled=!this.ready||document.hidden;button.setAttribute('aria-disabled',String(!available||blocked));button.classList.toggle('is-unavailable',!available);button.classList.toggle('is-compact',height<37);button.setAttribute('aria-label',(course?.label||'訓練（'+label+'）')+(available?'を選ぶ。自動で選ばれた珍生物を招待して訓練します。':'。'+reason));button.title=available?'タップして難易度を選ぶ。珍生物を自動で選んで招待します。':reason;
   button.style.left=target.x+'px';button.style.top=target.y+'px';button.style.width=width+'px';button.style.height=height+'px';button.style.setProperty('--terminal-font',Math.min(12,(width-6)/Math.max(3,Array.from(label).length))+'px');
  }
  const unavailable=courses.find(course=>course.id===this.terminalNoticeTier&&!course.available);if(!unavailable)this.terminalNoticeTier=null;
  const help=unavailable?.reason||'左の端末で難易度を選び、珍生物を自動で招待。';if(this.terminalHelp.textContent!==help)this.terminalHelp.textContent=help;
 }
 async show(){
  this.view.clear();this.active=true;this.loading=true;this.failed=false;this.terminalNoticeTier=null;const generation=++this.generation;this.snapshot=visitingSnapshot(this.readPlayer());
  this.container.classList.add('is-loading');this.view.surface.append(this.container);this.homeElement.hidden=true;this.panel.hidden=false;this.badge.hidden=true;
  this.status.hidden=false;this.status.querySelector('span').textContent='訓練所を準備しています…';this.status.querySelector('button').hidden=true;this.updateControls();
  this.controller??=new BattleView({container:this.container,onStatus:text=>{if(!this.active)return;this.status.querySelector('span').textContent=text.replaceAll('戦闘','訓練所');this.status.hidden=!text;},onError:error=>{if(this.active)this.showError(error);}});
  const ready=await this.controller.load(this.snapshot,{encounterType:'training',region:'training',timeOfDay:currentTimeOfDay(),presentation:'training-hall'});
  if(!this.active||generation!==this.generation)return false;
  this.loading=false;this.failed=!ready;
  if(ready){this.controller.setSnapshot(this.snapshot);this.controller.setActive(true);this.container.classList.remove('is-loading');this.badge.hidden=false;this.status.hidden=true;}
  this.updateControls();return ready;
 }
 updateControls(){
  this.panel.hidden=!this.active;this.trainButton.disabled=!this.ready||document.hidden;this.trainButton.setAttribute('aria-disabled',String(this.blocked()));this.returnButton.disabled=!this.active||document.hidden;this.returnButton.setAttribute('aria-disabled',String(!this.active||this.isPaused()||isModalBlocked()));
  this.badge.hidden=!this.ready;this.updateTerminals();
 }
 advance(dt){
  if(!this.active)return;this.updateControls();if(this.blocked()||document.hidden)return;
  this.snapshot.time+=Math.max(0,number(dt));this.controller.setSnapshot(this.snapshot);this.controller.setTimeOfDay(currentTimeOfDay());this.controller.advance(dt);
 }
 showError(error){
  this.loading=false;this.failed=true;this.status.hidden=false;this.status.querySelector('span').textContent='訓練所を表示できませんでした。通信環境を確認して、もう一度お試しください。';this.status.querySelector('button').hidden=false;this.badge.hidden=true;this.updateControls();this.onError(error);
 }
 deactivate(){this.active=false;this.generation++;this.pointerGesture=null;this.pendingTap=null;this.controller?.setActive(false);this.controller?.cancelPendingLoad();this.loading=false;this.panel.hidden=true;this.badge.hidden=true;this.status.hidden=true;this.terminalLayer.hidden=true;this.terminalHelp.hidden=true;this.container.remove();}
 getDiagnostics(){return {active:this.active,ready:this.ready,loading:this.loading,failed:this.failed,generation:this.generation,terminals:[...this.terminalButtons].map(([id,button])=>({id,disabled:button.getAttribute('aria-disabled')==='true',visible:!button.hidden,label:button.textContent})),view:this.controller?.getDiagnostics()||null};}
 destroy(){this.deactivate();this.resizeObserver.disconnect();for(const remove of this.listeners)remove();this.controller?.destroy();this.panel.remove();this.badge.remove();this.terminalButtons.clear();this.container.replaceChildren();}
}
