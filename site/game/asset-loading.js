import { tryOpenModal, releaseModal } from './modal-layer.js';

const formatBytes=value=>{const bytes=Math.max(0,Number(value)||0);return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.round(bytes/1024)+' KB';};
/** A blocking startup dialog shared by download, preparation and retry states. */
export class AssetLoadingPopup {
 constructor(dialog=document.querySelector('#assetLoadingDialog')){
  if(!dialog)throw new TypeError('読み込み画面がありません。');
  this.dialog=dialog;this.title=dialog.querySelector('#assetLoadingTitle');this.description=dialog.querySelector('#assetLoadingDescription');this.progress=dialog.querySelector('#assetLoadingProgress');this.percent=dialog.querySelector('#assetLoadingPercent');this.details=dialog.querySelector('#assetLoadingDetails');this.label=dialog.querySelector('#assetLoadingLabel');this.retryButton=dialog.querySelector('#assetLoadingRetry');this.errorText=dialog.querySelector('#assetLoadingError');this.fallback=dialog.querySelector('#assetLoadingFallback');
  this.tipButton=dialog.querySelector('#assetLoadingTip');this.tipCopy=dialog.querySelector('#assetLoadingTipCopy');this.tipKind=dialog.querySelector('#assetLoadingTipKind');this.tipCount=dialog.querySelector('#assetLoadingTipCount');this.tipIndex=0;
  // Keep the first warning in the initial HTML, before the boot module arrives.
  // The remaining cards stay inert in a template; only one item is ever shown.
  if(this.tipButton){
   this.tips=[{kind:this.tipButton.dataset.kind,title:this.tipCopy.querySelector('strong').textContent,body:this.tipCopy.querySelector('span').textContent},
    ...[...dialog.querySelector('#assetLoadingMoreTips').content.querySelectorAll('article')].map(item=>({kind:item.dataset.kind,title:item.querySelector('h3').textContent,body:item.querySelector('p').textContent}))];
   this.tipButton.addEventListener('click',()=>this.showTip(this.tipIndex+1));this.showTip(0);
  }
  dialog.addEventListener('cancel',event=>event.preventDefault());
  dialog.addEventListener('close',()=>releaseModal(dialog));
  this.retryButton.addEventListener('click',()=>this.onRetry?.());
  // Static open markup is visible before module download; upgrade it to a
  // native modal when this tiny boot module becomes available.
  if(dialog.open)dialog.removeAttribute('open');
  if(!tryOpenModal(dialog))throw new Error('読み込み画面を開けませんでした。');
  this.fallback.hidden=true;this.retryButton.hidden=true;this.errorText.hidden=true;
 }
 showTip(index){
  if(!this.tips?.length)return;
  this.tipIndex=index%this.tips.length;const tip=this.tips[this.tipIndex];
  this.tipButton.dataset.kind=tip.kind;this.tipKind.textContent=tip.kind==='warning'?'セーブの注意':'遊びのヒント';this.tipCount.textContent=(this.tipIndex+1)+' / '+this.tips.length;
  const title=document.createElement('strong'),body=document.createElement('span');title.textContent=tip.title;body.textContent=tip.body;this.tipCopy.replaceChildren(title,body);
 }
 fetching(detail={}){
  this.dialog.dataset.state='fetching';this.title.textContent='読み込んでいます';this.description.textContent='おこていゆの世界を準備しています。少しお待ちください。';
  this.errorText.hidden=true;this.retryButton.hidden=true;this.progress.removeAttribute('aria-invalid');
  const ratio=Math.max(0,Math.min(1,Number(detail.ratio)||0)),value=Math.min(99,Math.floor(ratio*99));
  this.progress.value=value;this.progress.setAttribute('aria-valuetext',value+'%・読み込み中');this.percent.textContent=value+'%';
  // Asset names are diagnostics, not player-facing loading text.
  const label='もう少しお待ちください…';if(this.label.textContent!==label)this.label.textContent=label;
  this.details.textContent=detail.totalBytes?formatBytes(detail.loadedBytes)+' / '+formatBytes(detail.totalBytes)+(detail.totalFiles?'　'+(detail.completed||0)+' / '+detail.totalFiles+'件':''):'通信を開始しています…';
 }
 preparing(){
  this.dialog.dataset.state='preparing';this.title.textContent='まもなく準備が整います';this.description.textContent='もう少しでゲームを始められます。そのままお待ちください。';this.progress.value=99;this.progress.setAttribute('aria-valuetext','99%・準備中');this.percent.textContent='99%';this.label.textContent='もう少しお待ちください…';this.retryButton.hidden=true;this.errorText.hidden=true;
 }
 fail(error,{reload=false}={}){
  this.dialog.dataset.state='error';this.title.textContent='読み込みを完了できませんでした';this.description.textContent='通信環境やブラウザの状態をご確認ください。';this.errorText.hidden=false;this.errorText.textContent='読み込みに失敗しました。時間をおいて、もう一度お試しください。';this.retryButton.textContent=reload?'ページを再読み込み':'再試行';this.retryButton.hidden=false;this.progress.setAttribute('aria-invalid','true');this.progress.setAttribute('aria-valuetext',this.progress.value+'%・読み込みに失敗しました');this.label.textContent=reload?'ページを開き直して、もう一度お試しください。':'準備できた分はそのままに、もう一度読み込みます。';this.retryButton.focus({preventScroll:true});
 }
 async finish(){
  this.dialog.dataset.state='complete';this.title.textContent='準備が整いました';this.description.textContent='おこていゆハウスへ、ようこそ。';this.progress.value=100;this.progress.setAttribute('aria-valuetext','100%・準備完了');this.percent.textContent='100%';this.label.textContent='準備完了';
  // Give the browser a frame to paint the completed bar, then release the modal
  // in the native close event before the beta notice can acquire its lock.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await new Promise(resolve=>{this.dialog.addEventListener('close',resolve,{once:true});this.dialog.close();});
 }
}
