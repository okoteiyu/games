import { AssetLoadingPopup } from './asset-loading.js';
import { preloadGameAssets } from './asset-store.js';

const popup=new AssetLoadingPopup(),game=document.querySelector('#game');
const state={phase:'fetching',progress:null,running:false,attempts:0,error:null,complete:false};
let main=null,reloadRequired=false,resolveReady;
const readyPromise=new Promise(resolve=>{resolveReady=resolve;});
window.assetStartup={get phase(){return state.phase;},get progress(){return state.progress;},get running(){return state.running;},get attempts(){return state.attempts;},get error(){return state.error;},get complete(){return state.complete;},readyPromise,retry:()=>run()};
async function run(){
 if(state.running||state.complete)return false;
 if(reloadRequired){location.reload();return false;}
 state.running=true;state.attempts++;state.error=null;state.phase='fetching';
 popup.fetching(state.progress||{});
 try{
  await preloadGameAssets({onProgress:detail=>{state.progress={...detail};if(state.phase==='fetching')popup.fetching(detail);}});
  state.phase='preparing';popup.preparing();
  // Allow the completed download/preparing message to paint before parsing the
  // large embedded GLB and compiling its first WebGL frame.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!main){try{main=await import('./main-view.js');}catch(error){reloadRequired=true;throw new Error('ゲームのプログラムを開けませんでした。ページを再読み込みしてください。');}}
  await main.prepareInitialScene({retry:state.attempts>1});
  await popup.finish();
  game.inert=false;document.body.dataset.assetStartup='complete';
  if(!main.showStartupNotice())throw new Error('起動案内を表示できませんでした。ページを再読み込みしてください。');
  state.phase='complete';state.complete=true;state.running=false;resolveReady(true);return true;
 }catch(error){
  state.phase='error';state.running=false;state.error=error instanceof Error?error.message:String(error);
  // Dynamic imports cache a failed module request in some browsers. A page
  // reload is explicit for that case; asset/initial-scene failures retry in place.
  popup.fail(error,{reload:reloadRequired});return false;
 }
}
popup.onRetry=()=>run();run();
