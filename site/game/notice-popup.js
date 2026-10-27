import { isModalBlocked, tryOpenModal, releaseModal } from './modal-layer.js';
const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
export const STARTUP_NOTICE={title:'珍生物「おこていゆ」',message:'このゲームは、ベータ版かつLite版です。プレイ前に、以下をご確認ください。',sections:[
  {title:'ベータ版について',text:'ベータ版はWebブラウザでのみプレイ可能です。動作確認を主な用途としているため、グラフィックス・アニメーション・UIのクオリティは保証しません。'},
  {title:'Web版の収録内容',text:'Web公開のベータ版・Lite版には、ストーリーとヒーロー会のサービスは含まれていません。会員証の活動記録は確認できます。ストーリーとサービスはiOSのLite版・フル版で解放されます。'},
  {title:'製品版の配信予定',text:'製品版は、まずiOSのApp Storeで配信し、その後Google Playストアで配信する予定です。'},
  {title:'iOSのLite版とフル版について',text:'iOS版では、Lite版・フル版ともにストーリーとヒーロー会が解放され、キャラクターとアイテムのバリエーションが増えます。フル版はさらに内容が充実し、声・アニメーション付き追加ストーリー・全クリア後のアフターストーリーが付きます。フル版は少額の有料買い切りを予定しています。詳しくはオプションの「iOSのLite版・フル版のご案内」をご覧ください。'}
 ]};
export class NoticePopup {
 constructor({game}) {
  this.game=game;this.dialog=make('dialog','notice-popup');this.dialog.id='noticePopup';this.dialog.setAttribute('aria-labelledby','noticeTitle');this.dialog.setAttribute('aria-describedby','noticeBody');this.dialog.setAttribute('aria-modal','true');
  this.dialog.innerHTML='<header class="notice-heading"><span class="notice-icon" aria-hidden="true"></span><div><span class="notice-eyebrow"></span><h2 id="noticeTitle" tabindex="-1" autofocus></h2></div></header><div class="notice-body" id="noticeBody" tabindex="0"></div><footer class="notice-footer"><button type="button" class="notice-confirm"></button></footer>';
  document.body.append(this.dialog);this.body=this.dialog.querySelector('.notice-body');this.confirm=this.dialog.querySelector('.notice-confirm');
  this.confirm.addEventListener('click',()=>this.dialog.close('confirmed'));
  this.dialog.addEventListener('cancel',event=>{if(this.startup)event.preventDefault();});
  this.dialog.addEventListener('close',()=>{releaseModal(this.dialog);if(this.opener?.isConnected&&!isModalBlocked())this.opener.focus({preventScroll:true});});
  new ResizeObserver(()=>this.resize()).observe(game);this.resize();
 }
 resize(){this.dialog.style.setProperty('--notice-width',Math.max(1,Math.min(380,this.game.getBoundingClientRect().width-24))+'px');}
 open({type='warning',title,message,sections=[],startup=false,opener=document.activeElement}={}) {
  if(isModalBlocked())return false;
  this.startup=startup;this.opener=opener;this.dialog.dataset.type=type==='error'?'error':'warning';
  this.dialog.querySelector('.notice-icon').textContent=type==='error'?'×':'!';
  this.dialog.querySelector('.notice-eyebrow').textContent=type==='error'?'ERROR / エラー':'NOTICE / ご案内';
  this.dialog.querySelector('#noticeTitle').textContent=title||(type==='error'?'操作を完了できませんでした':'ご確認ください');
  this.body.replaceChildren();
  if(startup){const badges=make('div','notice-badges');badges.append(make('span','','WEB BETA'),make('span','','LITE'));this.body.append(badges);}
  if(message)this.body.append(make('p','notice-intro',message));
  for(const [index,item] of sections.entries()){
   const section=make('section','notice-section'),heading=make('h3');heading.append(make('span','notice-number',String(index+1).padStart(2,'0')),document.createTextNode(item.title));section.append(heading,make('p','',item.text));this.body.append(section);
  }
  this.confirm.textContent=startup?'確認してはじめる':'閉じる';this.body.scrollTop=0;return tryOpenModal(this.dialog);
 }
 showStartup(){return this.open({startup:true,...STARTUP_NOTICE});}
}
