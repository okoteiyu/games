import {isModalBlocked,tryOpenModal,releaseModal} from './modal-layer.js';

/** Acknowledged, view-only recovery. Never creates or resolves a battle. */
export class CutinRecovery{
 constructor({game,getContext=()=>null,onSuspend=()=>{},onContinue=async()=>true,onResumed=()=>{},onWake=()=>{}}={}){
  Object.assign(this,{game,getContext,onSuspend,onContinue,onResumed,onWake});
  this.pending=null;this.running=false;this.away=false;this.destroyed=false;this.epoch=0;this.attempts=0;this.lastError=null;this.listeners=[];
  const dialog=this.dialog=document.createElement('dialog');dialog.id='cutinRecoveryDialog';dialog.className='notice-popup cutin-recovery-popup';dialog.setAttribute('aria-labelledby','cutinRecoveryTitle');dialog.setAttribute('aria-describedby','cutinRecoveryBody');dialog.setAttribute('aria-modal','true');dialog.setAttribute('closedby','none');dialog.dataset.type='warning';
  dialog.innerHTML='<header class="notice-heading"><span class="notice-icon" aria-hidden="true">↻</span><div><span class="notice-eyebrow">ゲームの再開</span><h2 id="cutinRecoveryTitle"></h2></div></header><div class="notice-body"><p class="notice-intro" id="cutinRecoveryBody"></p></div><footer class="notice-footer"><button type="button" class="notice-confirm" data-cutin-recovery-continue autofocus>続ける</button></footer>';
  document.body.append(dialog);this.button=dialog.querySelector('button');this.body=dialog.querySelector('#cutinRecoveryBody');
  dialog.addEventListener('cancel',event=>event.preventDefault());
  dialog.addEventListener('close',()=>{releaseModal(dialog);const context=this.completed;this.completed=null;if(!this.destroyed&&context)this.onResumed(context);});
  this.button.addEventListener('click',()=>this.continue());
  const listen=(target,type,handler)=>{target.addEventListener(type,handler);this.listeners.push(()=>target.removeEventListener(type,handler));};
  listen(document,'visibilitychange',()=>{if(document.hidden)this.suspend('hidden');else this.returnToPage();});
  listen(window,'pagehide',()=>this.suspend('pagehide'));
  listen(window,'pageshow',event=>{if(event.persisted&&!this.pending)this.request('pageshow');this.returnToPage();});
  listen(window,'blur',()=>this.suspend('blur'));
  listen(window,'focus',()=>this.returnToPage());
  listen(document,'freeze',()=>this.suspend('freeze'));
  listen(document,'resume',()=>this.returnToPage());
  this.resize=()=>{const width=this.game?.getBoundingClientRect?.().width||390;dialog.style.setProperty('--notice-width',Math.max(1,Math.min(380,width-24))+'px');};
  if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(this.resize);if(game)this.observer.observe(game);}this.resize();
 }
 get blocked(){return Boolean(this.pending)||this.running;}
 request(reason='interrupted'){
  if(this.destroyed)return false;const context=this.getContext();if(!context)return false;
  if(!this.pending){this.pending={...context,reason};this.lastError=null;this.resetButton();}
  this.epoch++;
  try{this.onSuspend(this.pending);}catch(error){this.lastError=error?.message||String(error);}
  this.pump();return true;
 }
 suspend(reason){this.away=true;return this.request(reason);}
 returnToPage(){if(this.destroyed)return;this.away=Boolean(document.hidden);this.onWake();this.pump();}
 resetButton(){this.button.disabled=false;this.button.textContent='続ける';this.dialog.removeAttribute('aria-busy');}
 isCurrent(context){return this.getContext()?.key===context?.key;}
 pump(){
  if(this.destroyed||!this.pending||this.running||this.away||document.hidden)return false;
  if(!this.isCurrent(this.pending)){this.dismissStale();return false;}
  if(this.dialog.open)return true;if(isModalBlocked())return false;
  this.dialog.querySelector('#cutinRecoveryTitle').textContent=this.pending.title;
  this.body.textContent=this.pending.message;this.resetButton();
  if(!tryOpenModal(this.dialog))return false;this.button.focus({preventScroll:true});return true;
 }
 async continue(){
  if(this.destroyed||!this.pending||this.running||!this.dialog.open||this.away||document.hidden)return false;
  const context=this.pending,epoch=this.epoch;this.running=true;this.attempts++;this.button.disabled=true;this.button.textContent='復帰しています…';this.dialog.setAttribute('aria-busy','true');this.lastError=null;
  try{
   const ready=await this.onContinue(context);
   if(this.destroyed)return false;
   if(!this.isCurrent(context)){this.dismissStale();return true;}
   if(epoch!==this.epoch||this.away||document.hidden){this.resetButton();this.body.textContent=context.message;return false;}
   if(!ready)throw new Error('表示の準備が完了していません。');
   this.pending=null;this.completed=context;this.dialog.close('continued');return true;
  }catch(error){
   if(!this.destroyed){this.lastError=error?.message||String(error);this.body.textContent='画面の復帰を準備できませんでした。「続ける」を押すと、もう一度試みます。';this.resetButton();}return false;
  }finally{this.running=false;}
 }
 dismissStale(){this.pending=null;this.running=false;this.epoch++;if(this.dialog.open)this.dialog.close('stale');}
 getDiagnostics(){return {pending:this.pending?{...this.pending}:null,running:this.running,away:this.away,open:this.dialog.open,attempts:this.attempts,error:this.lastError};}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.epoch++;this.pending=null;this.running=false;this.completed=null;for(const stop of this.listeners)stop();this.observer?.disconnect();if(this.dialog.open)this.dialog.close();releaseModal(this.dialog);this.dialog.remove();}
}
