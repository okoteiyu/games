import {tryOpenModal,releaseModal,isModalBlocked} from './modal-layer.js';

/** One scoped confirmation, shared by establishment and frontier withdrawal. */
export class CampBaseActions{
 constructor(){
  this.dialog=document.createElement('dialog');this.dialog.className='camp-base-confirm';this.dialog.setAttribute('aria-labelledby','campBaseConfirmTitle');this.dialog.setAttribute('aria-modal','true');
  this.dialog.innerHTML='<div class="camp-base-confirm__mark" aria-hidden="true">⌂</div><h2 id="campBaseConfirmTitle"></h2><p></p><footer><button type="button" data-camp-base-cancel></button><button type="button" data-camp-base-confirm></button></footer>';document.body.append(this.dialog);
  this.cancel=this.dialog.querySelector('[data-camp-base-cancel]');this.confirm=this.dialog.querySelector('[data-camp-base-confirm]');
  this.cancel.addEventListener('click',()=>this.dialog.close('cancel'));this.confirm.addEventListener('click',()=>this.dialog.close('confirm'));
  this.closed=()=>{releaseModal(this.dialog);const resolve=this.resolve;this.resolve=null;resolve?.(this.dialog.returnValue==='confirm');};this.dialog.addEventListener('close',this.closed);
 }
 open({title,text,confirm='設営する',cancel='設営せずに戻る'}={}){
  if(this.destroyed||this.resolve||isModalBlocked())return Promise.resolve(null);
  this.dialog.querySelector('h2').textContent=title;this.dialog.querySelector('p').textContent=text;this.confirm.textContent=confirm;this.cancel.textContent=cancel;this.dialog.returnValue='';
  return new Promise(resolve=>{this.resolve=resolve;if(!tryOpenModal(this.dialog)){this.resolve=null;resolve(null);}});
 }
 destroy(){this.destroyed=true;const resolve=this.resolve;this.resolve=null;if(this.dialog.open)this.dialog.close('cancel');releaseModal(this.dialog);resolve?.(null);this.dialog.removeEventListener('close',this.closed);this.dialog.remove();}
}
