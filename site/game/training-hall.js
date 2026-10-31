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
 constructor({view,homeElement,readPlayer=()=>({}),isPaused=()=>false,onTrain=()=>false,onReturn=()=>false,onError=()=>{}}={}){
  if(!view?.surface||!homeElement)throw new TypeError('訓練所の表示先がありません。');
  Object.assign(this,{view,homeElement,readPlayer,isPaused,onTrain,onReturn,onError});this.active=false;this.loading=false;this.failed=false;this.generation=0;this.snapshot=null;
  this.container=document.createElement('div');this.container.id='trainingHallScene';this.container.className='training-hall-scene';
  this.status=document.createElement('div');this.status.className='training-hall-status';this.status.setAttribute('role','status');this.status.hidden=true;
  this.status.innerHTML='<span></span><button type="button" hidden>もう一度読み込む</button>';this.container.append(this.status);this.status.querySelector('button').addEventListener('click',()=>{if(!this.isPaused()&&!isModalBlocked())this.show();});
  this.badge=document.createElement('div');this.badge.className='training-hall-badge';this.badge.hidden=true;this.badge.innerHTML='<span>B2</span><strong>訓練所</strong><small>入口から見守る</small>';view.element.append(this.badge);
  this.panel=document.createElement('section');this.panel.id='trainingHallChoices';this.panel.className='lower-right training-hall-actions';this.panel.hidden=true;this.panel.setAttribute('aria-label','訓練所での行動');
  this.panel.innerHTML='<header><span>準備を整えて、ひとつずつ</span><h2>どうする？</h2></header><nav aria-label="訓練所の選択肢"><button type="button" data-training-start><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/></svg><span>訓練をはじめる<small>難易度を選んで、腕を磨こう</small></span><b aria-hidden="true">›</b></button><button type="button" data-training-home><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></svg><span>おこていゆハウスへ戻る<small>ホーム画面へ帰ります</small></span><b aria-hidden="true">›</b></button></nav>';homeElement.after(this.panel);
  this.trainButton=this.panel.querySelector('[data-training-start]');this.returnButton=this.panel.querySelector('[data-training-home]');
  this.trainButton.addEventListener('click',()=>{if(!this.blocked())this.onTrain(this.trainButton);});this.returnButton.addEventListener('click',()=>{if(this.active&&!this.isPaused()&&!isModalBlocked())this.onReturn(this.returnButton);});
 }
 get ready(){return Boolean(this.active&&this.controller?.ready&&!this.controller?.contextLost&&!this.loading&&!this.failed);}
 blocked(){return !this.ready||this.isPaused()||isModalBlocked();}
 async show(){
  this.view.clear();this.active=true;this.loading=true;this.failed=false;const generation=++this.generation;this.snapshot=visitingSnapshot(this.readPlayer());
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
  this.panel.hidden=!this.active;this.trainButton.disabled=this.blocked();this.returnButton.disabled=!this.active||this.isPaused()||isModalBlocked();
  this.badge.hidden=!this.ready;
 }
 advance(dt){
  if(!this.active)return;this.updateControls();if(this.blocked()||document.hidden)return;
  this.snapshot.time+=Math.max(0,number(dt));this.controller.setSnapshot(this.snapshot);this.controller.setTimeOfDay(currentTimeOfDay());this.controller.advance(dt);
 }
 showError(error){
  this.loading=false;this.failed=true;this.status.hidden=false;this.status.querySelector('span').textContent='訓練所を表示できませんでした。通信環境を確認して、もう一度お試しください。';this.status.querySelector('button').hidden=false;this.badge.hidden=true;this.updateControls();this.onError(error);
 }
 deactivate(){this.active=false;this.generation++;this.controller?.setActive(false);this.controller?.cancelPendingLoad();this.loading=false;this.panel.hidden=true;this.badge.hidden=true;this.status.hidden=true;this.container.remove();}
 getDiagnostics(){return {active:this.active,ready:this.ready,loading:this.loading,failed:this.failed,generation:this.generation,view:this.controller?.getDiagnostics()||null};}
 destroy(){this.deactivate();this.controller?.destroy();this.panel.remove();this.badge.remove();}
}
