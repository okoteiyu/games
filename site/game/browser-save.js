import {validatePreviewState} from './save-data.js';
export const BROWSER_SAVE_KEY='okoteiyu.web-home.v1';
/** Synchronous home checkpoints survive pagehide; no password is needed for local storage. */
export class BrowserSave {
 constructor({storage=()=>localStorage,readState,applyState,canSave=()=>true,onError=()=>{}}){Object.assign(this,{storage,readState,applyState,canSave,onError});this.initialized=false;this.restoring=false;this.lastText=null;this.failed=false;}
 restoreOnce(){
  if(this.initialized)return false;this.restoring=true;let restored=false;
  try{const text=this.storage().getItem(BROWSER_SAVE_KEY);if(text){const data=JSON.parse(text);if(data.format!=='okoteiyu-browser-home'||data.version!==1)throw new Error('保存形式が正しくありません。');const state=validatePreviewState(data.state);if(state.location!=='おこていゆハウス'||!state.prototype)throw new Error('ホームのデータがありません。');this.applyState(state);restored=true;}}
  catch(error){this.failed=true;this.onError('ブラウザの保存データを復元できませんでした。ファイルからの読み込みも利用できます。',error);}
  finally{this.restoring=false;this.initialized=true;}
  if(!this.failed)this.saveNow();return restored;
 }
 saveNow(){
  if(!this.initialized||this.restoring||this.failed||!this.canSave())return false;
  try{const state=validatePreviewState(this.readState()),text=JSON.stringify({format:'okoteiyu-browser-home',version:1,state});if(text===this.lastText)return true;this.storage().setItem(BROWSER_SAVE_KEY,text);this.lastText=text;return true;}
  catch(error){this.failed=true;this.onError('ブラウザに保存できませんでした。セーブデータをファイルへ書き出してください。',error);return false;}
 }
 resetFailure(){this.failed=false;this.lastText=null;return this.saveNow();}
}
