/** Portrait dialogue stays over the current 3D scene. Story events can supply
 * their own ordered lines without changing the room renderer or game state. */
export const STAFF_SILHOUETTE_URL='assets/facility/staff-silhouette.svg';

export class SceneConversation {
 constructor({view,showMessage,onComplete=()=>{},canStart=()=>true}={}){
  Object.assign(this,{view,showMessage,onComplete,canStart});this.current=null;this.presenting=false;
  this.portrait=document.createElement('div');this.portrait.className='scene-conversation';this.portrait.hidden=true;
  this.portrait.innerHTML='<img class="scene-conversation__portrait" alt="暫定のシルエット立ち絵"><span class="scene-conversation__name"></span>';
  this.image=this.portrait.querySelector('img');this.name=this.portrait.querySelector('span');view.element.append(this.portrait);
 }
 get active(){return this.current!==null;}
 play({id='',sceneId='',lines=[],opener=null}={}){
  if(this.active||!this.canStart()||!Array.isArray(lines)||!lines.length)return false;
  if(lines.some(line=>!line||typeof line.text!=='string'||typeof line.speaker!=='string'))return false;
  this.current={id,sceneId,lines:lines.map(line=>({...line})),index:0,opener};
  this.view.element.dataset.conversationActive='true';this.paint();return true;
 }
 paint(){
  if(!this.current)return;const line=this.current.lines[this.current.index];
  this.image.src=line.portrait||STAFF_SILHOUETTE_URL;this.image.alt=line.portraitAlt||line.speaker+'の暫定シルエット立ち絵';
  this.name.textContent=line.speaker;this.portrait.hidden=false;
  this.portrait.dataset.speaker=line.speaker;this.portrait.dataset.conversationId=this.current.id;
  this.presenting=true;
  try{this.showMessage({speaker:line.speaker,text:line.text,kind:line.kind||'speech',category:line.category||(line.kind==='narration'?'narration':'conversation')});}finally{this.presenting=false;}
 }
 advance(){
  if(!this.current)return false;
  if(++this.current.index<this.current.lines.length)this.paint();else this.close();return true;
 }
 close({notify=true,restoreFocus=true}={}){
  if(!this.current)return false;const previous=this.current;this.current=null;
  this.portrait.hidden=true;this.image.removeAttribute('src');this.name.textContent='';
  delete this.portrait.dataset.speaker;delete this.portrait.dataset.conversationId;
  delete this.view.element.dataset.conversationActive;
  if(notify)this.onComplete(previous);
  if(restoreFocus&&previous.opener?.isConnected&&!previous.opener.disabled)previous.opener.focus({preventScroll:true});
  return true;
 }
 destroy(){this.close({notify:false,restoreFocus:false});this.portrait.remove();}
}
