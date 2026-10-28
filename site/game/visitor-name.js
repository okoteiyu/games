import {tryOpenModal,releaseModal} from './modal-layer.js';
import {normalizeVisitorName} from './visitor-profile.js';

/** Required registration; no cancel, backdrop, or keyboard dismissal. */
export class VisitorNamePopup{
 constructor({game,onRegister}){
  this.dialog=document.createElement('dialog');this.dialog.id='visitorNameDialog';this.dialog.className='visitor-name';
  this.dialog.setAttribute('aria-labelledby','visitorNameTitle');this.dialog.setAttribute('aria-describedby','visitorNameDescription');this.dialog.setAttribute('aria-modal','true');
  this.dialog.innerHTML='<form class="visitor-name__form"><span class="visitor-name__eyebrow">WELCOME</span><h2 id="visitorNameTitle">あなたの名前</h2><p id="visitorNameDescription">おこていゆハウスを訪れる、あなたの名前を教えてください。</p><label for="visitorNameInput">名前</label><input id="visitorNameInput" name="visitorName" type="text" required autocomplete="off" spellcheck="false" enterkeyhint="go" data-game-text-input><p class="visitor-name__note">名前はヒーロー会会員証に記載されます。</p><p class="visitor-name__error" role="status" aria-live="polite"></p><button type="submit" disabled>この名前ではじめる</button></form>';
  document.body.append(this.dialog);this.form=this.dialog.querySelector('form');this.input=this.form.elements.visitorName;this.submit=this.form.querySelector('button');this.error=this.form.querySelector('[role=status]');
  this.dialog.addEventListener('cancel',event=>event.preventDefault());
  this.dialog.addEventListener('close',()=>releaseModal(this.dialog));
  this.input.addEventListener('input',()=>{this.error.textContent='';this.submit.disabled=!this.input.value.trim();});
  this.form.addEventListener('submit',event=>{
   event.preventDefault();
   try{const name=normalizeVisitorName(this.input.value);if(!name)throw new Error('名前を入力してください。');if(onRegister(name)!==true)throw new Error('名前を登録できませんでした。もう一度お試しください。');this.dialog.close('registered');}
   catch(error){this.error.textContent=error.message;this.input.focus({preventScroll:true});}
  });
  const resize=()=>this.dialog.style.setProperty('--visitor-width',Math.max(1,Math.min(380,game.getBoundingClientRect().width-24))+'px');new ResizeObserver(resize).observe(game);resize();
 }
 open(){if(this.dialog.open)return true;if(!tryOpenModal(this.dialog))return false;this.input.value='';this.error.textContent='';this.submit.disabled=true;return true;}
}
