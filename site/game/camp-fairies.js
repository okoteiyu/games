import {CAMP_FAIRIES} from './camp-fairy-data.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';

/** A local map-selection pause, not a modal or a separate expedition. */
export class CampFairyControls{
 constructor({container,getMap,readEngine,isVisible,canRequest,onChange=()=>{}}){
  Object.assign(this,{container,getMap,readEngine,isVisible,canRequest,onChange});this.mode='idle';this.selection=null;this.flight=null;
  this.root=document.createElement('section');this.root.className='camp-fairies';this.root.hidden=true;this.root.tabIndex=-1;this.root.setAttribute('aria-label','キャンプの妖精へのお願い');
  this.root.innerHTML='<h3 class="camp-fairies__heading" hidden></h3><div class="camp-fairies__choices">'+Object.entries(CAMP_FAIRIES).map(([id,fairy])=>'<button type="button" class="camp-fairy-action" data-camp-fairy="'+id+'"><span class="camp-fairy-action__icon" aria-hidden="true">'+fairy.icon+'</span><span class="camp-fairy-action__copy"><strong>'+fairy.name+'</strong><small data-camp-fairy-stock="'+id+'"></small></span></button>').join('')+'</div><p class="camp-fairies__hint" role="status" aria-live="polite"></p><button type="button" class="camp-fairies__cancel" hidden>お願いをやめる</button>';
  container.append(this.root);this.buttons=Object.fromEntries(Object.keys(CAMP_FAIRIES).map(id=>[id,this.root.querySelector('[data-camp-fairy="'+id+'"]')]));this.choices=this.root.querySelector('.camp-fairies__choices');this.heading=this.root.querySelector('h3');this.hint=this.root.querySelector('p');this.cancel=this.root.querySelector('.camp-fairies__cancel');
  this.click=event=>{const kind=event.target.closest('[data-camp-fairy]')?.dataset.campFairy;if(kind)this.begin(kind);else if(event.target.closest('.camp-fairies__cancel'))this.stop(true);};this.root.addEventListener('click',this.click);
  this.keyDown=event=>{if(event.key==='Escape'&&this.mode==='select'&&this.canRequest()){event.preventDefault();event.stopPropagation();this.stop(true);}};document.addEventListener('keydown',this.keyDown);
 }
 get busy(){return this.mode!=='idle';}
 begin(kind){
  if(this.busy||!this.canRequest())return false;const engine=this.readEngine(),result=engine?.beginFairySelection(kind);if(!result?.ok)return false;
  const map=this.getMap();if(!map){engine.endFairySelection();return false;}
  this.selection={...result,engine};this.mode='select';map.setFairySelection({...result,onSelect:id=>this.choose(id)});this.refresh();this.onChange();
  requestAnimationFrame(()=>{if(this.mode==='select'&&this.selection?.engine===engine)map.fairyTargets?.querySelector('button')?.focus({preventScroll:true});});return true;
 }
 choose(nodeId){
  if(this.mode!=='select'||!this.canRequest()||this.selection?.engine!==this.readEngine())return false;
  const {kind,engine}=this.selection,result=engine.requestFairy(kind,nodeId);if(!result.ok)return false;
  const map=this.getMap();this.flight={kind,toNodeId:nodeId,fromPoint:{...map.currentPoint()},elapsed:0};this.mode='flight';map.setFairySelection({...this.selection,mode:'flight'});map.setFairyFlight({...this.flight,progress:0});this.refresh();this.onChange();return true;
 }
 tick(dt){
  if(!this.busy)return false;
  if(this.mode==='flight'){
   this.flight.elapsed+=Math.max(0,dt);const progress=Math.min(1,this.flight.elapsed/.85);this.getMap()?.setFairyFlight({...this.flight,progress});if(progress>=1)this.stop(false);
  }
  return true;
 }
 stop(restoreFocus=false){
  const old=this.selection;old?.engine.endFairySelection();this.getMap()?.setFairySelection(null);this.mode='idle';this.selection=null;this.flight=null;this.refresh();this.onChange();
  if(restoreFocus&&old&&!this.buttons[old.kind].disabled)this.buttons[old.kind].focus({preventScroll:true});
 }
 reset(){if(this.busy){this.selection?.engine.endFairySelection();this.getMap()?.setFairySelection(null);}this.mode='idle';this.selection=null;this.flight=null;this.root.hidden=true;this.container.removeAttribute('data-fairy-mode');}
 refresh(){
  const visible=this.isVisible();if(!visible){this.reset();return;}
  this.root.hidden=false;this.container.dataset.fairyMode=this.mode;const engine=this.readEngine(),state=engine?.state,can=this.canRequest();
  for(const [kind,fairy]of Object.entries(CAMP_FAIRIES)){
   const stock=state?.fairyRequests?.[kind]??0,button=this.buttons[kind];button.disabled=this.busy||!can||!engine?.fairyRequestOptions(kind);button.setAttribute('aria-label',fairy.name+'、残り'+stock+'回');
   setPaintedText(this.root.querySelector('[data-camp-fairy-stock="'+kind+'"]'),stock+' / '+fairy.maxRequests+'回',{background:'#fffaf2',fitText:true,immutableImage:true});
  }
  this.choices.hidden=this.busy;this.heading.hidden=!this.busy;this.cancel.hidden=this.mode!=='select';this.cancel.disabled=!can;
  if(this.busy)setPaintedText(this.heading,this.mode==='select'?CAMP_FAIRIES[this.selection.kind].name+'にお願い':'妖精が向かっています',{background:'#f4f4e4',fitText:true,immutableImage:true});
  const message=this.mode==='select'?'探索を一時停止中。地図の番号が付いた地点を選んでください。道具や残り時間によっては、お願いどおりに進めません。':this.mode==='flight'?'この分かれ道で1回だけ、進路をお願いしています。':state?.phase==='night'?'夜営中は、妖精もひと休み。':!Object.values(state?.fairyRequests||{}).some(Boolean)?'今回のお願いは、ここまで。':engine?.pendingFairy?'もう一方の妖精には、その後の分かれ道でお願いできます。':'それぞれ1回。向かっている分かれ道の、その先をお願いできます。';
  if(this.hint.textContent!==message)this.hint.textContent=message;
  this.container.querySelector(':scope > button').disabled=this.busy;
 }
 destroy(){this.reset();document.removeEventListener('keydown',this.keyDown);this.root.removeEventListener('click',this.click);releasePaintedLabels(this.root);this.root.remove();}
}
