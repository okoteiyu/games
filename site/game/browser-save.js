import {validatePreviewState} from './save-data.js';
import {calculateOfflineCalm,normalizeSavedAt} from './offline-calm.js';
export const BROWSER_SAVE_KEY='okoteiyu.web-home.v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const stateContent=state=>{const copy={...state};delete copy.lastSavedAt;return copy;};
function notices(value){
 if(!Array.isArray(value))return [];const ids=new Set();
 return value.slice(0,99).filter(v=>v&&typeof v.id==='string'&&v.id.length<=100&&!ids.has(v.id)&&Number.isSafeInteger(v.gained)&&v.gained>0&&v.gained<=99&&normalizeSavedAt(v.claimedAt)!==null&&ids.add(v.id)).map(v=>({id:v.id,gained:v.gained,claimedAt:v.claimedAt}));
}
/** Synchronous home checkpoints and durable, once-only browser-return credits. */
export class BrowserSave{
 constructor({storage=()=>localStorage,readState,applyState,canSave=()=>true,onError=()=>{},now=()=>Date.now(),readCalm,applyCalmPoints,canApplyCalm=()=>true,readVisitorName,onOfflineReward=()=>{}}){
  Object.assign(this,{storage,readState,applyState,canSave,onError,now,readCalm,applyCalmPoints,canApplyCalm,readVisitorName,onOfflineReward});
  this.initialized=false;this.restoring=false;this.lastText=null;this.lastContentText=null;this.failed=false;this.checkpoint=null;this.lastSavedAt=null;this.pendingOfflineRewards=[];this.away=false;this.pendingResumeAt=null;this.pendingResumeReason=null;this.writeDepth=0;
 }
 get busy(){return this.restoring||this.writeDepth>0;}
 get pendingRewards(){return clone(this.pendingOfflineRewards);}
 withWriteLock(action){this.writeDepth++;try{return action();}finally{this.writeDepth--;}}
 named(){const name=this.readVisitorName?this.readVisitorName():this.readState()?.prototype?.session?.visitorName;return typeof name==='string'&&Boolean(name.trim());}
 calm(){const n=this.readCalm?this.readCalm():this.readState()?.prototype?.relaxStreak;if(!Number.isSafeInteger(n)||n<0||n>99)throw new RangeError('穏やかポイントを確認できませんでした。');return n;}
 readStored(){
  const text=this.storage().getItem(BROWSER_SAVE_KEY);if(!text)return null;const data=JSON.parse(text);
  if(data.format!=='okoteiyu-browser-home'||data.version!==1)throw new Error('保存形式が正しくありません。');
  const state=validatePreviewState(data.state);if(state.location!=='おこていゆハウス'||!state.prototype)throw new Error('ホームのデータがありません。');
  return {state,pending:notices(data.pendingOfflineRewards),text};
 }
 adopt(state,pending,text){this.checkpoint=state;this.pendingOfflineRewards=pending;this.lastSavedAt=normalizeSavedAt(state.lastSavedAt);this.lastText=text;this.lastContentText=JSON.stringify({state:stateContent(state),pending});}
 write(state,pending=this.pendingOfflineRewards,{stamp=normalizeSavedAt(this.now())}={}){
  const saved={...stateContent(state)};if(stamp!==null)saved.lastSavedAt=stamp;else if(this.lastSavedAt!==null)saved.lastSavedAt=this.lastSavedAt;
  const safe=validatePreviewState(saved),clean=notices(pending),text=JSON.stringify({format:'okoteiyu-browser-home',version:1,state:safe,...(clean.length?{pendingOfflineRewards:clean}:{})});
  // Commit first. A failed localStorage write must never credit the live game.
  this.storage().setItem(BROWSER_SAVE_KEY,text);this.adopt(safe,clean,text);return true;
 }
 stateForClock(stored){
  if(this.canSave())return validatePreviewState(this.readState());
  const state=stored?.state||this.checkpoint;if(!state)throw new Error('保存できるホームの記録がありません。');return clone(state);
 }
 restoreOnce(){
  if(this.initialized)return false;this.restoring=true;let restored=false;
  try{const stored=this.readStored();if(stored){this.adopt(stored.state,stored.pending,stored.text);this.applyState(stored.state);restored=true;}}
  catch(error){this.failed=true;this.onError('ブラウザの保存データを復元できませんでした。ファイルからの読み込みも利用できます。',error);}
  finally{this.restoring=false;this.initialized=true;}
  if(!this.failed){if(restored&&this.named()&&typeof this.applyCalmPoints==='function'){this.pendingResumeAt=normalizeSavedAt(this.now());this.pendingResumeReason='startup';this.processPendingResume();}else this.saveNow();}
  return restored;
 }
 saveNow({forceTime=false,allowCheckpoint=false}={}){
  if(!this.initialized||this.busy||this.failed||this.pendingResumeAt!==null)return false;
  try{
   if(!this.named()||!this.canSave()&&!allowCheckpoint)return false;
   const stored=allowCheckpoint?this.readStored():null,state=allowCheckpoint?this.stateForClock(stored):validatePreviewState(this.readState());
   if(!state.prototype.session.visitorName)return false;
   if(allowCheckpoint&&this.canApplyCalm())state.prototype.relaxStreak=this.calm();
   const pending=stored?.pending??this.pendingOfflineRewards,key=JSON.stringify({state:stateContent(state),pending});
   if(!forceTime&&key===this.lastContentText)return true;
   return this.write(state,pending);
  }catch(error){this.failed=true;this.onError('ブラウザに保存できませんでした。セーブデータをファイルへ書き出してください。',error);return false;}
 }
 suspend(){
  if(!this.initialized||this.busy||this.away)return false;
  if(this.pendingResumeAt===null)this.saveNow({forceTime:true,allowCheckpoint:true});this.away=true;return true;
 }
 resume(){
  if(!this.initialized||this.busy||!this.away)return false;this.away=false;
  this.pendingResumeAt=normalizeSavedAt(this.now());this.pendingResumeReason='resume';
  return this.processPendingResume();
 }
 processPendingResume(){
  if(this.pendingResumeAt===null||!this.initialized||this.busy||this.failed||this.away)return false;
  let result=null;
  try{
   if(!this.named()){this.pendingResumeAt=null;this.pendingResumeReason=null;return false;}
   if(!this.canApplyCalm())return false;
   this.withWriteLock(()=>{
    const stored=this.readStored(),state=this.stateForClock(stored),previous=this.calm(),claimAt=this.pendingResumeAt,commitAt=normalizeSavedAt(this.now())??claimAt;
    const savedName=stored?.state.prototype.session.visitorName,liveName=this.readVisitorName?this.readVisitorName():state.prototype.session.visitorName;
    if(savedName&&savedName!==liveName)throw new Error('別の画面で保存データが変更されました。再読み込みしてください。');
    const award=calculateOfflineCalm({lastSavedAt:stored?.state.lastSavedAt,now:claimAt,calmPoints:previous}),pending=stored?.pending??this.pendingOfflineRewards;
    state.prototype.relaxStreak=award.calmPoints;let notice=null;
    if(award.gained>0){let sequence=0,id;do{id='offline-'+commitAt+'-'+sequence++;}while(pending.some(v=>v.id===id));notice={id,gained:award.gained,claimedAt:commitAt};pending.push(notice);}
    this.write(state,pending,{stamp:commitAt});
    if(award.gained>0){const added=this.applyCalmPoints(award.gained);if(added!==award.gained||this.calm()!==award.calmPoints)throw new Error('加算済みの記録を再読み込みしてください。');}
    result={...award,previous,claimedAt:commitAt,reason:this.pendingResumeReason,notice};this.pendingResumeAt=null;this.pendingResumeReason=null;
   });
   if(result?.gained>0)this.onOfflineReward(result);return result||false;
  }catch(error){this.failed=true;this.onError('復帰時の記録を保存できませんでした。保存設定をご確認のうえ、再読み込みしてください。',error);return false;}
 }
 acknowledgeReward(id){
  if(!this.initialized||this.busy||this.failed||!this.pendingOfflineRewards.some(v=>v.id===id))return false;
  try{return this.withWriteLock(()=>{const stored=this.readStored(),state=this.stateForClock(stored),pending=(stored?.pending??this.pendingOfflineRewards).filter(v=>v.id!==id);if(this.canApplyCalm())state.prototype.relaxStreak=this.calm();return this.write(state,pending);});}
  catch(error){this.failed=true;this.onError('通知を保存できませんでした。保存設定をご確認ください。',error);return false;}
 }
 /** The unnamed prologue never creates a browser checkpoint or reward clock. */
 beginDraft(){
  this.lastText=null;this.lastContentText=null;this.checkpoint=null;this.lastSavedAt=null;this.pendingOfflineRewards=[];this.pendingResumeAt=null;this.pendingResumeReason=null;
  try{this.storage().removeItem(BROWSER_SAVE_KEY);this.failed=false;return true;}
  catch(error){this.failed=true;this.onError('前のブラウザ保存を消去できませんでした。ブラウザの保存設定をご確認ください。',error);return false;}
 }
 resetFailure({discardRewards=false}={}){
  this.failed=false;this.lastText=null;this.lastContentText=null;
  if(discardRewards){this.pendingOfflineRewards=[];this.pendingResumeAt=null;this.pendingResumeReason=null;this.away=false;}
  if(this.pendingResumeAt!==null)return this.processPendingResume();return this.saveNow({forceTime:true});
 }
}
