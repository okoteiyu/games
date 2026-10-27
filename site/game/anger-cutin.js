/** The approved eight-second movie, played only inside the square scene. */
export const ANGER_CUTIN_DEFAULTS=Object.freeze({
 url:new URL('./assets/cinematics/anger-cutin.mp4',import.meta.url).href,
 durationSeconds:8,cueSeconds:5.3,speaker:'おこていゆ',text:'ｵｺﾃｲﾕ'
});

export class AngerCutinPlayer {
 constructor({view,url=ANGER_CUTIN_DEFAULTS.url,prepareSource=null,isPaused=()=>false,onUtterance=()=>{},onComplete=()=>{},onError=()=>{},onStateChange=()=>{},cueSeconds=ANGER_CUTIN_DEFAULTS.cueSeconds}={}){
  if(!view?.surface||!view?.element||typeof view.setVideo!=='function')throw new TypeError('カットインの表示先がありません。');
  if(!Number.isFinite(cueSeconds)||cueSeconds<0)throw new RangeError('発言の時刻が正しくありません。');
  Object.assign(this,{view,url,prepareSource,isPaused,onUtterance,onComplete,onError,onStateChange,cueSeconds});
  this.active=false;this.destroyed=false;this.state='idle';this.video=null;this.generation=0;this.raf=0;this.cueSent=false;this.completionCount=0;this.objectURL=null;this.listeners=[];this.resumePending=false;this.waitingForUser=false;this.endedPending=false;this.lastError=null;this.sourceAbort=null;this.lastElapsed=0;
 }
 get blocked(){return this.state==='blocked'||this.state==='error';}
 externallyPaused(){return document.hidden||Boolean(this.isPaused());}
 setState(state){if(state===this.state)return;this.state=state;this.view.element.dataset.cutinState=state;this.onStateChange(this.getDiagnostics());}
 listen(target,type,callback){target.addEventListener(type,callback);this.listeners.push(()=>target.removeEventListener(type,callback));}
 mountStatus(){
  this.status=document.createElement('div');this.status.className='anger-cutin-status';this.status.setAttribute('role','status');this.status.textContent='怒りの場面を準備しています…';
  this.recovery=document.createElement('div');this.recovery.className='anger-cutin-recovery';this.recovery.hidden=true;
  this.recovery.innerHTML='<p></p><div><button type="button" data-cutin-action="retry">もう一度再生</button><button type="button" data-cutin-action="continue">演出を省略して続ける</button></div>';
  this.recovery.querySelector('[data-cutin-action="retry"]').addEventListener('click',()=>{if(!this.externallyPaused())this.retry();});
  this.recovery.querySelector('[data-cutin-action="continue"]').addEventListener('click',()=>{if(!this.externallyPaused())this.complete('skipped');});
  this.view.element.append(this.status,this.recovery);
 }
 /** Starts a new anger event. A new play invalidates every prior callback. */
 play(){return this.start(false);}
 /** Retries the same event; an already emitted utterance is never duplicated. */
 retry(){if(!this.active||this.destroyed)return Promise.resolve(false);return this.start(true);}
 async start(retainCue){
  if(this.destroyed)return false;
  const cueSent=retainCue&&this.cueSent;this.stopPlayback(false);
  const token=++this.generation;this.active=true;this.cueSent=cueSent;this.waitingForUser=false;this.endedPending=false;this.lastError=null;this.lastElapsed=0;
  this.view.clear();this.view.surface.classList.add('is-video');this.view.element.dataset.cutinActive='true';this.mountStatus();this.setState('loading');
  this.sourceAbort=new AbortController();
  try{
   const source=this.prepareSource?await this.prepareSource(this.url,{signal:this.sourceAbort.signal}):this.url;
   if(!this.active||token!==this.generation)return false;
   let src;
   if(typeof source==='string')src=source;
   else if(source instanceof Blob){this.objectURL=URL.createObjectURL(source);src=this.objectURL;}
   else if(source instanceof ArrayBuffer||ArrayBuffer.isView(source)){this.objectURL=URL.createObjectURL(new Blob([source],{type:'video/mp4'}));src=this.objectURL;}
   else throw new TypeError('動画データを取得できませんでした。');
   const video=this.view.setVideo(src,{muted:true,autoplay:false});this.video=video;
   video.classList.add('anger-cutin-video');video.playsInline=true;video.setAttribute('playsinline','');video.muted=true;video.controls=false;video.loop=false;video.preload='auto';video.disablePictureInPicture=true;video.tabIndex=-1;video.setAttribute('aria-label','おこていゆが怒る8秒のカットイン');
   const current=()=>this.active&&token===this.generation&&this.video===video;
   this.listen(video,'timeupdate',()=>{if(current())this.checkCue();});
   this.listen(video,'ended',()=>{if(!current())return;this.endedPending=true;if(!this.externallyPaused())this.complete('ended');});
   this.listen(video,'error',()=>{if(current())this.fail(new Error('怒りの動画を読み込めませんでした。通信状況をご確認ください。'),'error');});
   this.listen(video,'pause',()=>{if(current()&&!video.ended&&!this.blocked&&this.state==='playing')this.setState('paused');});
   this.listen(document,'visibilitychange',()=>{if(current())this.synchronizePause();});
   this.schedule();return await this.resume(token);
  }catch(error){
   if(this.active&&token===this.generation)this.fail(error,'error');return false;
  }
 }
 async resume(token=this.generation){
  if(!this.active||token!==this.generation||!this.video||this.resumePending||this.waitingForUser)return false;
  if(this.externallyPaused()){this.video.pause();this.setState('paused');return false;}
  this.resumePending=true;
  const video=this.video;
  try{
   await video.play();
   if(!this.active||token!==this.generation||this.video!==video)return false;
   if(this.externallyPaused()){video.pause();this.setState('paused');return false;}
   this.status.hidden=true;this.recovery.hidden=true;this.setState('playing');this.checkCue();return true;
  }catch(error){
   if(!this.active||token!==this.generation||this.video!==video)return false;
   if(this.externallyPaused()){this.setState('paused');return false;}
   this.fail(error,error?.name==='NotAllowedError'?'blocked':'error');return false;
  }finally{if(token===this.generation)this.resumePending=false;}
 }
 fail(error,state){
  if(!this.active)return;
  this.lastError=error?.message||String(error);this.waitingForUser=true;this.video?.pause();this.status.hidden=true;
  this.recovery.querySelector('p').textContent=state==='blocked'?'動画を再生するには「もう一度再生」を押してください。':'動画を再生できませんでした。再試行するか、演出を省略して続けられます。';
  this.recovery.hidden=false;this.setState(state);this.onError(error,this.getDiagnostics());
 }
 checkCue(){
  if(!this.active||this.cueSent||!this.video||this.externallyPaused()||this.video.currentTime+1e-6<this.cueSeconds)return false;
  this.cueSent=true;this.onUtterance({speaker:ANGER_CUTIN_DEFAULTS.speaker,kind:'speech',text:ANGER_CUTIN_DEFAULTS.text,timeSeconds:this.video.currentTime,cueSeconds:this.cueSeconds});return true;
 }
 synchronizePause(){
  if(!this.active||!this.video)return;
  if(this.externallyPaused()){this.video.pause();if(!this.blocked)this.setState('paused');}
  else if(this.endedPending||this.video.ended)this.complete('ended');
  else if(!this.waitingForUser&&this.video.paused)this.resume();
  this.schedule();
 }
 schedule(){if(this.active&&!this.raf&&!document.hidden)this.raf=requestAnimationFrame(()=>this.frame());}
 frame(){
  this.raf=0;if(!this.active)return;
  this.synchronizePause();if(!this.active)return;this.checkCue();this.schedule();
 }
 complete(reason='ended'){
  if(!this.active)return false;
  if(reason==='ended'&&this.externallyPaused()){this.endedPending=true;return false;}
  if(reason==='ended')this.checkCue();
  const result={reason,skipped:reason==='skipped',utteranceSent:this.cueSent,elapsedSeconds:this.video?.currentTime||0};
  this.active=false;this.completionCount++;this.generation++;this.stopPlayback(false);this.view.element.dataset.cutinActive='false';this.setState('completed');this.onComplete(result);return true;
 }
 stopPlayback(removeVideo){
  if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.sourceAbort?.abort();this.sourceAbort=null;
  for(const off of this.listeners)off();this.listeners=[];if(this.video)this.lastElapsed=this.video.currentTime||0;this.video?.pause();
  if(removeVideo)this.video?.remove();this.video=null;this.resumePending=false;
  this.status?.remove();this.recovery?.remove();this.status=null;this.recovery=null;
  if(this.objectURL){URL.revokeObjectURL(this.objectURL);this.objectURL=null;}
 }
 /** Cancellation never completes or emits an utterance for the old event. */
 cancel(){
  const active=this.active;this.active=false;this.generation++;this.stopPlayback(true);this.waitingForUser=false;this.endedPending=false;this.view.element.dataset.cutinActive='false';if(active)this.setState('cancelled');return active;
 }
 getDiagnostics(){return {active:this.active,state:this.state,elapsedSeconds:this.video?.currentTime??this.lastElapsed,durationSeconds:Number.isFinite(this.video?.duration)?this.video.duration:ANGER_CUTIN_DEFAULTS.durationSeconds,cueSeconds:this.cueSeconds,cueSent:this.cueSent,paused:this.video?.paused??true,waitingForUser:this.waitingForUser,completionCount:this.completionCount,error:this.lastError};}
 destroy(){if(this.destroyed)return;this.cancel();this.destroyed=true;this.setState('destroyed');}
}
