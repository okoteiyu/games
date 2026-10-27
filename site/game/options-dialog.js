import {TIME_LABELS} from './world-time.js';
import {TRAINING_COURSES,eligibleTrainingCreatures} from './game-session.js';
import {REGION_LABELS} from './patrol-map.js';
import {availableTechniqueIds,TECHNIQUES} from './technique-rules.js';
import {techniquePageMarkup,repertoireMarkup,superDetailsMarkup,profileStats} from './technique-ui.js';
import {STARTUP_NOTICE} from './notice-popup.js';
import {COLLECTION_KINDS,collectionThumbnail,CREATURE_NOTES} from './collection-data.js';
import {CREATURES,CREATURE_CATEGORIES,SUPPORT_ITEMS,DEFENSE_ITEMS} from './game-session.js';
import { encodeSave, decodeSave, validatePreviewState } from './save-data.js';
import {describeSaveProgress} from './save-preview.js';
import { isModalBlocked, tryOpenModal, releaseModal } from './modal-layer.js';

export const OPTION_ITEMS = [
 {id:'journal',label:'珍生物記録帳',description:'出会った珍生物の記録を読む',icon:'book'},
 {id:'catalog',label:'ヒーロー会ショップカタログ',description:'ヒーロー会の通販で、持ち物を注文',icon:'bag'},
 {id:'membership',label:'ヒーロー会会員証',description:'階級・撃退数・強さを確認',icon:'badge'},
 {id:'save',label:'セーブデータ読み書き',description:'暗号化したファイルの読み込み・書き出し',icon:'save'},
 {id:'settings',label:'設定',description:'音声・色・着せ替えの設定',icon:'settings'},
 {id:'credits',label:'クレジット, ライセンス, 著作権',description:'制作・ライセンス・著作者の情報',icon:'credits'},
 {id:'policies',label:'ポリシー, ガイドライン',description:'ゲームを楽しむためのご案内',icon:'policy'},
 {id:'ios-editions',label:'iOSのLite版・フル版のご案内',description:'広がる物語と、2つのiOS版について',icon:'phone'}
];
const ICONS={
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',
 book:'<path d="M12 6C8 3 4 5 3 6v13c3-2 6-2 9 0 3-2 6-2 9 0V6c-3-2-6-2-9 0Zm0 0v13"/>',
 bag:'<path d="M5 7h14l1 13H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
 badge:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M9 5V3h6v2M13 11h5m-5 4h5"/><circle cx="8" cy="11" r="2"/><path d="M5.5 17c0-3 5-3 5 0"/>',
 save:'<path d="M5 3h12l3 3v14H4V4l1-1Z"/><path d="M8 3v6h8V3M8 20v-7h8v7"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5"/><circle cx="15" cy="17" r="2.5"/>',
 credits:'<path d="m5 20 3-3L19 6l-3-3L5 14l-1 6 4-1M13 6l4 4"/><path d="M12 20h8"/>',
 moai:'<path d="M8 3h8l2 3v13l-3 2H9l-3-2V6l2-3Z"/><path d="M7 8h10M9 9v1m6-1v1M12 9l-2 6h5m-5 3h5"/>',
 aura:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="m19 3 1 2 2 1M3 19l1 2 2 1"/>',
 shield:'<path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z"/><path d="M8 12h8"/>',
 house:'<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h4v7M9 9h6"/>',
 phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/><path d="m10 10 2-2 2 2-2 4-2-4Z"/>',
 policy:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>'
};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[name]+'</svg>';
const empty=(symbol,title,text)=>'<div class="option-empty-state"><span class="option-empty-state__icon">'+icon(symbol)+'</span><h3>'+title+'</h3><p>'+text+'</p></div>';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
const titles=Object.fromEntries(OPTION_ITEMS.map(x=>[x.id,x.label]));
titles.main='オプション';titles.policy='ポリシー';titles.guideline='ガイドライン';titles.collection='コレクション';titles.maps='マップ';titles.trainings='訓練';
titles['confirm-patrol-return']='パトロールを中断しますか？';
titles['ios-editions']='iOS版のご案内';titles.techniques='技';
for(const [kind,label]of Object.entries(COLLECTION_KINDS))titles['collection-'+kind]=label;
const hasRoute=id=>Object.prototype.hasOwnProperty.call(titles,id);

export class OptionsDialog {
 constructor({dialog,trigger,game,readState,readGame=()=>null,applyState,onSelectMap=()=>{},onEquipAura=()=>false,onEquipItem=()=>false,onAssignTechnique=()=>false,onSuperConfiguration=()=>false,validateTransfer=()=>{}}) {
  this.dialog=dialog;this.trigger=trigger;this.game=game;this.readState=readState;this.readGame=readGame;this.applyState=applyState;this.onSelectMap=onSelectMap;this.onEquipAura=onEquipAura;this.onEquipItem=onEquipItem;this.onAssignTechnique=onAssignTechnique;this.onSuperConfiguration=onSuperConfiguration;this.activeTechniqueSlot=0;this.selectedTechnique='punch';this.selectedCollection={};this.selectedJournal=null;this.validateTransfer=validateTransfer;this.opener=trigger;
  this.body=dialog.querySelector('#optionsBody');this.title=dialog.querySelector('#optionsTitle');this.back=dialog.querySelector('#optionsBack');
  this.route='main';this.history=[];this.generation=0;this.pending=null;
  trigger.setAttribute('aria-expanded','false');
  trigger.addEventListener('click',()=>this.open());
  dialog.querySelector('#optionsClose').addEventListener('click',()=>dialog.close());
  this.back.addEventListener('click',()=>this.goBack());
  this.body.addEventListener('click',async event=>{
   const techSlot=event.target.closest('[data-technique-slot]');if(techSlot){this.activeTechniqueSlot=Number(techSlot.dataset.techniqueSlot);this.renderTechniques();return;}
   const tech=event.target.closest('[data-technique-select]');if(tech){this.selectedTechnique=tech.dataset.techniqueSelect;this.renderTechniques();return;}
   const assign=event.target.closest('[data-technique-assign]');if(assign){if(assign.disabled)return;const accepted=await this.onAssignTechnique(Number(assign.dataset.slot),assign.dataset.techniqueAssign||null);this.renderTechniques();if(!accepted)this.body.querySelector('[data-technique-status]').textContent='技を設定できませんでした。';return;}
   const tab=event.target.closest('[data-guide-tab]');if(tab){this.editionTab=tab.dataset.guideTab;this.renderIosGuide();this.body.querySelector('[data-guide-tab="'+this.editionTab+'"]')?.focus({preventScroll:true});return;}
   const selected=event.target.closest('[data-collection-select]');
   if(selected){this.selectedCollection[selected.dataset.kind]=selected.dataset.collectionSelect;this.renderCollectionCategory(selected.dataset.kind);this.body.querySelector('[data-collection-select="'+CSS.escape(selected.dataset.collectionSelect)+'"]')?.focus({preventScroll:true});return;}
   const recorded=event.target.closest('[data-journal-select]');
   if(recorded){this.selectedJournal=recorded.dataset.journalSelect;this.renderJournal();this.body.querySelector('[data-journal-select="'+CSS.escape(this.selectedJournal)+'"]')?.focus({preventScroll:true});return;}
   const equip=event.target.closest('[data-collection-equip]');
   if(equip){
    const snapshot=this.readGame(),kind=equip.dataset.kind,id=equip.dataset.collectionEquip||null;
    if(equip.disabled||snapshot?.location!=='home'||snapshot.pendingAngerEvent)return;
    const generation=this.generation;equip.disabled=true;
    try{const accepted=await(kind==='aura'?this.onEquipAura(id):this.onEquipItem(kind,id));if(!accepted)throw new Error('装備を変更できませんでした。');if(dialog.open&&generation===this.generation)this.renderCollectionCategory(kind);}
    catch(error){if(dialog.open&&generation===this.generation){equip.disabled=false;this.body.querySelector('[data-collection-status]').textContent=error.message||'装備を変更できませんでした。';}}return;
   }
   const map=event.target.closest('[data-map]');
   if(map&&['house','patrol','training'].includes(map.dataset.map)){
    const destination=map.dataset.map,tier=map.dataset.trainingTier||'easy';
    if(map.disabled||!(destination==='patrol'?this.canRequestPatrol():destination==='training'?this.canRequestTraining(this.readGame(),tier):this.canSelectMap()))return;
    if(destination==='house'&&this.readGame()?.scene==='patrol'){this.navigate('confirm-patrol-return');return;}
    dialog.addEventListener('close',()=>this.onSelectMap(destination,tier),{once:true});dialog.close();return;
   }
   const confirmReturn=event.target.closest('[data-patrol-return]');if(confirmReturn){if(confirmReturn.dataset.patrolReturn==='cancel'){this.goBack();return;}if(!this.canSelectMap()||this.readGame()?.scene!=='patrol')return;dialog.addEventListener('close',()=>this.onSelectMap('house'),{once:true});dialog.close();return;}
   const button=event.target.closest('[data-panel]');if(button)this.navigate(button.dataset.panel);
  });
  this.body.addEventListener('change',async event=>{if(!event.target.matches('[data-super-configuration]'))return;await this.onSuperConfiguration(event.target.value);this.renderTechniques();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;releaseModal(dialog);trigger.setAttribute('aria-expanded','false');this.opener?.setAttribute('aria-expanded','false');this.generation++;this.pending=null;this.body.replaceChildren();if(!isModalBlocked()&&this.opener?.isConnected)this.opener.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  this.resize=new ResizeObserver(()=>this.updateWidth());this.resize.observe(game);this.updateWidth();
 }
 updateWidth(){this.dialog.style.setProperty('--options-width',Math.max(1,Math.min(440,window.innerWidth-12,Math.max(this.game.getBoundingClientRect().width-12,Math.min(340,window.innerWidth-12))))+'px');}
 open(route='main',opener=this.trigger){if(isModalBlocked())return false;if(!hasRoute(route))throw new RangeError('表示先が正しくありません。');this.opener?.setAttribute('aria-expanded','false');this.opener=opener?.focus?opener:this.trigger;this.history=[];this.render(route);if(!tryOpenModal(this.dialog))return false;this.opener.setAttribute('aria-expanded','true');return true;}
 navigate(id){if(!hasRoute(id))return;this.history.push({id:this.route,focus:id});this.render(id);this.title.focus();}
 goBack(){const last=this.history.pop();if(!last)return;this.render(last.id);this.body.querySelector('[data-panel="'+last.focus+'"]')?.focus();}
 refreshGameView(){
  if(!this.dialog.open||!['maps','trainings','membership','collection','journal','techniques',...Object.keys(COLLECTION_KINDS).map(k=>'collection-'+k)].includes(this.route)){this.liveStateKey=null;return;}
  const state=this.readGame(),key=JSON.stringify([this.route,state?.location,state?.scene,state?.homeCommands,state?.pendingAngerEvent,state?.player,state?.patrolCount,state?.angerEvents,this.game.querySelector('#rankValue')?.textContent]);
  if(!this.liveStateKey){this.liveStateKey=key;return;}if(key===this.liveStateKey)return;this.liveStateKey=key;
  const scroll=this.body.scrollTop,active=document.activeElement,data=this.body.contains(active)&&active?.dataset&&Object.keys(active.dataset).length?{...active.dataset}:null;this.render(this.route);this.body.scrollTop=scroll;
  if(data){const focus=[...this.body.querySelectorAll('button')].find(b=>Object.entries(data).every(([k,v])=>b.dataset[k]===v));focus?.focus({preventScroll:true});}
 }
 canSelectMap(snapshot=this.readGame()){return !snapshot||((snapshot.location==='home'||snapshot.location==='patrol')&&!snapshot.pendingAngerEvent&&!['scene-cutin','cutin'].includes(snapshot.scene));}
 canRequestPatrol(snapshot=this.readGame()){return snapshot?.scene==='house'&&!snapshot.messageVisible&&Boolean(snapshot.homeCommands?.patrol);}
 canRequestTraining(snapshot=this.readGame(),tier='easy'){return snapshot?.scene==='house'&&!snapshot.messageVisible&&Boolean(snapshot.homeCommands?.trainings?.[tier]??(tier==='easy'&&snapshot.homeCommands?.training));}
 render(id){
  this.route=id;this.generation++;this.pending=null;this.title.textContent=titles[id];this.back.hidden=!this.history.length;this.dialog.dataset.route=id;
  this.body.scrollTop=0;
  if(id==='main'){
   this.body.innerHTML='<nav class="options-menu" aria-label="オプションの項目">'+OPTION_ITEMS.map((item,index)=>'<button type="button" class="option-item" data-panel="'+item.id+'"><span class="option-icon">'+icon(item.icon)+'</span><span class="option-copy"><span class="option-label">'+item.label+'</span><span class="option-description">'+item.description+'</span></span><span class="option-chevron" aria-hidden="true">›</span></button>').join('')+'<a class="option-item" href="../guide/"><span class="option-icon">'+icon('book')+'</span><span class="option-copy"><span class="option-label">攻略サイト</span><span class="option-description">遊び方や珍生物の情報を見る</span></span><span class="option-chevron" aria-hidden="true">›</span></a></nav>';
  }else if(id==='collection'){
   this.renderCollection();
  }else if(id.startsWith('collection-')){
   this.renderCollectionCategory(id.slice(11));
  }else if(id==='techniques'){
   this.renderTechniques();
  }else if(id==='maps'){
   const snapshot=this.readGame(),current=!snapshot||snapshot.location==='home',allowed=this.canSelectMap(snapshot);
   const patrolAllowed=this.canRequestPatrol(snapshot),player=snapshot?.player;
   const patrolDetail=snapshot?.location==='patrol'?'いま、道中をパトロールしています。':snapshot?.homeCommands?.patrolAvailable===false?'今の条件で出会える珍生物はいません。':!patrolAllowed?'ひと息つくのを、もう少し待ちましょう。':'道中へ出かけます。';
   this.body.innerHTML='<button class="map-card" type="button" data-map="house" aria-label="おこていゆハウスに切り替える"'+(allowed?'':' disabled aria-describedby="mapRestriction"')+'><span class="map-card__icon">'+icon('house')+'</span><span class="map-card__copy"><small class="map-card__eyebrow">HOME</small><strong class="map-card__name">おこていゆハウス</strong><span class="map-card__description">ホーム画面 · 研究と暮らし</span></span>'+(current?'<span class="option-tag">現在地</span>':'')+'<span class="map-card__arrow" aria-hidden="true">›</span></button><button class="map-card" type="button" data-map="patrol"'+(patrolAllowed?'':' disabled')+'><span class="map-card__icon">'+icon('map')+'</span><span class="map-card__copy"><small class="map-card__eyebrow">PATROL</small><strong class="map-card__name">パトロールに出る</strong><span class="map-card__description">'+patrolDetail+'</span></span><span class="map-card__arrow" aria-hidden="true">›</span></button>'+'<button class="map-card" type="button" data-panel="trainings"'+(current&&allowed?'':' disabled')+'><span class="map-card__icon">'+icon('shield')+'</span><span class="map-card__copy"><small class="map-card__eyebrow">TRAINING</small><strong class="map-card__name">訓練</strong><span class="map-card__description">難易度を選んで、腕を磨きます。</span></span><span class="map-card__arrow" aria-hidden="true">›</span></button>'+(allowed?'':'<p class="option-note" id="mapRestriction">戦闘中とカットイン中は、マップを移動できません。</p>');
  }else if(id==='confirm-patrol-return'){
   this.body.innerHTML='<section class="patrol-return-confirm"><p>今回のパトロールを中断して、おこていゆハウスに戻りますか？</p><p class="option-note">道中の移動は、ここで終わりになります。</p><div><button class="option-action" type="button" data-patrol-return="cancel">パトロールを続ける</button><button class="option-action" type="button" data-patrol-return="confirm">中断して帰る</button></div></section>';
  }else if(id==='trainings'){
   const snapshot=this.readGame(),player=snapshot?.player;
   const courses=Object.values(TRAINING_COURSES).map(course=>{
    const possible=player&&eligibleTrainingCreatures(player,course.id).length>0,enabled=this.canRequestTraining(snapshot,course.id);
    const range=course.id==='infinity'?'95〜':course.min+'〜'+course.max;
    const categories=course.categories.includes('threat')?'通常・脅威':'通常';
    const detail=possible?'穏やかポイントを1消費します。':'現在の条件に合う珍生物がいません。';
    return '<button class="map-card" type="button" data-map="training" data-training-tier="'+course.id+'"'+(enabled?'':' disabled')+'><span class="map-card__icon">'+icon('shield')+'</span><span class="map-card__copy"><small class="map-card__eyebrow">TRAINING · Lv.'+range+' · '+categories+'</small><strong class="map-card__name">'+course.label+'</strong><span class="map-card__description">'+detail+'</span></span><span class="map-card__arrow" aria-hidden="true">›</span></button>';
   }).join('');
   this.body.innerHTML='<p class="option-section-intro">難易度を選んでください。パトロールで勝った珍生物が相手をします。</p>'+courses;
  }else if(id==='journal'){
   this.renderJournal();
  }else if(id==='catalog'){
   this.body.innerHTML=empty('bag','通販サービスはiOS版で解放されます。','Web版では会員証の活動記録を確認できます。通販などのヒーロー会サービスはiOSのLite版・フル版で解放されます。');
  }else if(id==='membership'){
   this.renderMembership();
  }else if(id==='save'){
   this.renderSave();
  }else if(id==='settings'){
   this.body.innerHTML='<div class="option-section-intro">設定できる項目を、少しずつ追加していきます。</div><ul class="upcoming-settings">'+['音声設定','色の設定','着せ替え設定'].map(x=>'<li><span>'+x+'</span><span class="option-tag">今後対応</span></li>').join('')+'</ul>';
  }else if(id==='credits'){
   this.body.innerHTML='<div class="option-articles"><section><h3>クレジット</h3><p>制作：okoteiyu</p></section><section><h3>ライセンス</h3><p>Three.js r180（MIT License）を使用しています。<a href="vendor/three/LICENSE.txt" target="_blank" rel="noopener">著作権表示とライセンス全文</a></p></section><section><h3>著作権・著作者</h3><p>© okoteiyu</p></section></div>';
  }else if(id==='policies'){
   this.body.innerHTML='<nav class="options-menu" aria-label="ポリシーとガイドライン"><button class="option-item" type="button" data-panel="policy"><span class="option-icon">'+icon('policy')+'</span><span class="option-copy"><span class="option-label">ポリシー</span></span><span class="option-chevron" aria-hidden="true">›</span></button><button class="option-item" type="button" data-panel="guideline"><span class="option-icon">'+icon('book')+'</span><span class="option-copy"><span class="option-label">ガイドライン</span></span><span class="option-chevron" aria-hidden="true">›</span></button></nav>';
  }else if(id==='ios-editions'){
   this.renderIosGuide();
  }else{
   this.body.innerHTML=empty('policy','内容は、今後掲載します。','');
  }
 }
 collectionPlayer(){return this.readGame()?.player||{equippedAura:'okoteiyu',auras:{okoteiyu:{name:'おこていゆのオーラ',level:1,copies:1,progress:0}},ownedItems:{support:['moai_kun'],defense:['acrylic_shield']},equipment:{support:'moai_kun',defense:'acrylic_shield'},techniqueSlots:['punch',null,null],punchLevel:1,energyRayLevel:1,energyRayUnlocked:false,superLevel:1,superConfiguration:'none'};}
 thumbnail(kind,id,name,classes=''){return '<img class="collection-photo '+classes+'" src="'+collectionThumbnail(kind,id)+'" alt="'+escapeHtml(name)+'の3Dモデル" width="320" height="320" decoding="async">';}
 renderCollection(){
  const player=this.collectionPlayer();
  this.body.innerHTML='<nav class="collection-categories" aria-label="持ち物の種類">'+Object.entries(COLLECTION_KINDS).map(([kind,label])=>{
   const id=kind==='aura'?player.equippedAura:player.equipment?.[kind],name=kind==='aura'?player.auras?.[id]?.name:(kind==='defense'?DEFENSE_ITEMS:SUPPORT_ITEMS)[id]?.name;
   return '<button class="collection-category" type="button" data-panel="collection-'+kind+'">'+(id?this.thumbnail(kind,id,name):'<span class="collection-category__empty">'+icon(kind==='defense'?'shield':kind==='aura'?'aura':'moai')+'</span>')+'<span><strong>'+label+'</strong><small>装備中</small><b>'+escapeHtml(name||'なし')+'</b></span><span class="option-chevron" aria-hidden="true">›</span></button>';
  }).join('')+'<button class="collection-category" type="button" data-panel="techniques">'+this.thumbnail('technique',player.techniqueSlots?.find(Boolean)||'punch','技')+'<span><strong>技</strong><small>3スロット</small><b>'+escapeHtml((player.techniqueSlots||['punch']).filter(Boolean).map(id=>TECHNIQUES[id]?.name).join('・'))+'</b></span><span class="option-chevron" aria-hidden="true">›</span></button></nav>';
 }
 renderCollectionCategory(kind){
  if(!Object.hasOwn(COLLECTION_KINDS,kind))return;
  const snapshot=this.readGame(),player=this.collectionPlayer(),canEquip=snapshot?.location==='home'&&!snapshot.pendingAngerEvent;
  const entries=kind==='aura'?Object.entries(player.auras||{}).map(([id,value])=>({id,...value})):((player.ownedItems?.[kind])||[]).map(id=>(kind==='defense'?DEFENSE_ITEMS:SUPPORT_ITEMS)[id]).filter(Boolean);
  const equipped=kind==='aura'?player.equippedAura:player.equipment?.[kind];
  let selected=this.selectedCollection[kind];if(!entries.some(e=>e.id===selected))selected=entries.some(e=>e.id===equipped)?equipped:entries[0]?.id;this.selectedCollection[kind]=selected;
  const item=entries.find(e=>e.id===selected),isEquipped=Boolean(item&&equipped===item.id);
  const grid=entries.map(entry=>'<button type="button" class="collection-tile" data-collection-select="'+escapeHtml(entry.id)+'" data-kind="'+kind+'" aria-pressed="'+String(selected===entry.id)+'">'+this.thumbnail(kind,entry.id,entry.name)+'<span class="collection-tile__name">'+escapeHtml(entry.name)+'</span>'+(entry.id===equipped?'<span class="collection-equipped">装備中</span>':'')+'</button>').join('');
  let detail='<div class="collection-detail collection-detail--empty"><p>まだ'+COLLECTION_KINDS[kind]+'を持っていません。</p></div>';
  if(item){
   const auraDetail=kind==='aura'?(item.id==='okoteiyu'?'全パラメータが1.2倍になります。レベル1で固定です。':'元の珍生物のパラメータランクとオーラレベルに応じて、能力値が加算されます。'):'',progress=kind==='aura'?'<p class="collection-detail__meta">Lv.'+count(item.level)+' · '+(item.id==='okoteiyu'?'固定':item.level>=30?'最大レベル':'次のレベルまで '+count(item.progress)+'/3')+'</p>':'';
   detail='<section class="collection-detail" aria-label="選択した持ち物の詳細">'+this.thumbnail(kind,item.id,item.name,'collection-detail__photo')+'<div class="collection-detail__copy"><h3>'+escapeHtml(item.name)+'</h3>'+progress+'<p>'+escapeHtml(kind==='aura'?auraDetail:item.description)+'</p><button class="option-action collection-equip" type="button" data-collection-equip="'+(isEquipped?'':escapeHtml(item.id))+'" data-kind="'+kind+'"'+(canEquip?'':' disabled')+'>'+(isEquipped?'外す':'装備する')+'</button></div></section>';
  }
  this.body.innerHTML='<div class="collection-browser"><div class="collection-tiles" aria-label="'+COLLECTION_KINDS[kind]+'の一覧">'+grid+'</div>'+detail+'</div>'+(!canEquip&&snapshot?'<p class="option-note">装備はホーム画面にいる時に変更できます。</p>':'')+'<p class="save-status" role="status" aria-live="polite" data-collection-status></p>';
 }
 renderMembership(){
  const snapshot=this.readGame(),player=this.collectionPlayer(),stats=profileStats(player),defeats=Object.values(player.journal||{}).reduce((sum,e)=>sum+BigInt(count(e.defeats)),0n),rank=this.game.querySelector('#rankValue')?.textContent||'C';
  const rows=[['撃退数',defeats.toLocaleString('ja-JP')+'体'],['勝利した戦闘',count(player.battlesWon)+'回'],['敗北した戦闘',count(player.battlesLost)+'回'],['パトロール',count(snapshot?.patrolCount)+'回'],['おこていゆイベント',count(snapshot?.angerEvents)+'回'],['キャラレベル',player.level||1],...Object.entries(stats).map(([key,value])=>[({hp:'HP',attack:'攻撃力',ki:'気',speed:'速さ'})[key],Number(value).toLocaleString('ja-JP',{maximumFractionDigits:1})])];
  this.body.innerHTML='<p class="option-section-intro">これまでの活動を記録しています。Web版では記録の確認ができ、ヒーロー会のサービスはiOS版で解放されます。</p><section class="membership-card"><span class="membership-card__overline">珍生物ヒーロー会 · 活動記録</span><div class="membership-card__name">おこていゆ</div><div class="membership-card__rank"><span>HERO RANK</span><strong>'+escapeHtml(rank)+'</strong></div></section><dl class="option-data">'+rows.map(([label,value])=>'<div><dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(value)+'</dd></div>').join('')+'</dl>';
 }
 renderTechniques(){const snapshot=this.readGame();this.body.innerHTML=techniquePageMarkup(this.collectionPlayer(),{slot:this.activeTechniqueSlot,selected:this.selectedTechnique,canEdit:snapshot?.location==='home'&&!snapshot.pendingAngerEvent,attackMultiplier:snapshot?.battle?.super?.active?snapshot.battle.super.multiplier:1});}
 renderJournal(){
  const player=this.collectionPlayer(),journal=player.journal||{},entries=Object.entries(CREATURES).filter(([id,creature])=>id==='okoteiyu'||Object.hasOwn(CREATURE_CATEGORIES,creature.category)&&count(journal[id]?.encounters)>0).map(([id,creature])=>({...journal[id],id,name:creature.name,creature,self:id==='okoteiyu'}));
  if(!entries.some(e=>e.id===this.selectedJournal))this.selectedJournal=entries[0].id;const selected=entries.find(e=>e.id===this.selectedJournal);
  const facts=selected.self?[['レベル',player.level],...Object.entries(player.stats||{}).map(([key,value])=>[({hp:'HP',attack:'攻撃力',ki:'気',speed:'速さ'})[key],value])]:[['固有レベル帯','Lv.'+selected.creature.levelBand.min+(selected.creature.levelBand.min===selected.creature.levelBand.max?'のみ':'〜'+selected.creature.levelBand.max)],['出現エリア',selected.creature.spawnRegions.map(id=>REGION_LABELS[id]).join('・')],['出現時間帯',(selected.creature.spawnTimes||['day','night']).map(id=>TIME_LABELS[id]).join('・')],['遭遇',count(selected.encounters)+'回'],['撃退',count(selected.defeats)+'回']];
  this.body.innerHTML='<div class="collection-browser journal-browser"><div class="collection-tiles" aria-label="珍生物の一覧">'+entries.map(entry=>'<button class="collection-tile" type="button" data-journal-select="'+entry.id+'" aria-pressed="'+String(entry.id===selected.id)+'">'+this.thumbnail('creature',entry.id,entry.name)+'<span class="collection-tile__name">'+escapeHtml(entry.name)+'</span></button>').join('')+'</div><section class="collection-detail" aria-label="選択した珍生物の詳細">'+this.thumbnail('creature',selected.id,selected.name,'collection-detail__photo')+'<div class="collection-detail__copy"><span class="option-tag">'+escapeHtml(selected.self?'自分自身':CREATURE_CATEGORIES[selected.creature.category]?.label||'')+'</span><h3>'+escapeHtml(selected.name)+'</h3><p>'+escapeHtml(CREATURE_NOTES[selected.id]||'')+'</p><dl class="collection-facts"><div><dt>身長</dt><dd>'+(Number.isFinite(selected.creature.height)?Number((selected.creature.height*100).toFixed(1))+'cm':'未設定')+'</dd></div>'+facts.map(([name,value])=>'<div><dt>'+name+'</dt><dd>'+escapeHtml(value)+'</dd></div>').join('')+'</dl>'+repertoireMarkup(selected.self?availableTechniqueIds(player):selected.creature.techniques,{player:selected.self?player:null,enemyLevel:selected.lastLevel||1})+(selected.self?superDetailsMarkup(player):'')+'</div></section></div>';
 }
 renderIosGuide(){
  const tab=this.editionTab||'ios',tabs='<nav class="edition-tabs" role="tablist" aria-label="配信版のご案内">'+[['ios','iOS版'],['web','Web版の注意事項']].map(([id,label])=>'<button type="button" role="tab" id="edition-tab-'+id+'" aria-controls="editionPanel" aria-selected="'+String(tab===id)+'" data-guide-tab="'+id+'">'+label+'</button>').join('')+'</nav>';
  if(tab==='web'){this.body.innerHTML=tabs+'<section id="editionPanel" role="tabpanel" aria-labelledby="edition-tab-web" class="edition-web-notice"><h3>'+escapeHtml(STARTUP_NOTICE.title)+'</h3><p>'+escapeHtml(STARTUP_NOTICE.message)+'</p>'+STARTUP_NOTICE.sections.map(item=>'<section><h4>'+escapeHtml(item.title)+'</h4><p>'+escapeHtml(item.text)+'</p></section>').join('')+'</section>';return;}
  const mysteries=['おこていゆの誕生','モアイの謎','密かに迫り来る危機','おこていゆの秘められた力','惑星より大きな心','限界を越える6つの試練'];
  const common=['ストーリーが解放される','ヒーロー会の要素が解放される','Web版よりキャラクターとアイテムのバリエーションが増える'];
  const full=['キャラクターとアイテムが、さらに増える','声が付く','アニメーション付きの追加ストーリー','全クリア後も続くアフターストーリー'];
  this.body.innerHTML=tabs+'<article id="editionPanel" role="tabpanel" aria-labelledby="edition-tab-ios" class="ios-guide"><section class="ios-mysteries" aria-labelledby="iosMysteryTitle"><div class="ios-mysteries__heading"><img class="ios-guide__app-icon" src="assets/icons/app-icon-192.png" width="64" height="64" alt="スーパーおこていゆとモアイくん" decoding="async"><div><span class="ios-guide__eyebrow">BEYOND THE WEB</span><h3 id="iosMysteryTitle">Web版で明かされなかった謎</h3></div></div><ol class="ios-mysteries__list">'+mysteries.map(x=>'<li>'+x+'</li>').join('')+'</ol></section><section class="ios-edition ios-edition--common" aria-labelledby="iosCommonTitle"><div class="ios-edition__heading"><span class="ios-edition__symbol" aria-hidden="true">'+icon('phone')+'</span><div><span class="ios-guide__eyebrow">LITE & FULL</span><h3 id="iosCommonTitle">どちらのiOS版でも</h3></div></div><p class="ios-edition__intro">Lite版もフル版も、物語とヒーロー会が解放されます。</p><ul class="ios-feature-list">'+common.map(x=>'<li>'+x+'</li>').join('')+'</ul></section><section class="ios-edition ios-edition--full" aria-labelledby="iosFullTitle"><div class="ios-edition__heading"><span class="ios-edition__symbol" aria-hidden="true">'+icon('aura')+'</span><div><span class="ios-guide__eyebrow">FULL EDITION</span><h3 id="iosFullTitle">フル版では、さらに</h3></div></div><p class="ios-edition__intro">共通の内容に加えて、もっと広いおこていゆの世界へ。</p><ul class="ios-feature-list">'+full.map(x=>'<li>'+x+'</li>').join('')+'</ul></section><p class="ios-guide__availability">iOS版は配信予定です。配信日・価格・ストアリンクは、今後ご案内します。</p></article>';
 }
 renderSave(){
  this.body.innerHTML='<p class="option-section-intro">セーブデータを、暗号化したテキストファイルで持ち運べます。</p><p class="option-note">キャラクターの成長や所持品など、現在の進行状況を保存します。</p><form class="save-form" id="saveForm"><p class="browser-save-note">Web版はブラウザに自動保存されます。パスワードは不要です。以下はファイルで持ち出すための操作です。</p><label for="savePassword">暗号化パスワード</label><input id="savePassword" type="password" autocomplete="off" spellcheck="false" maxlength="1024"><p class="option-note">ファイルを開くときにも、同じパスワードを使います。パスワードは保管されません。</p><button type="button" class="option-action option-action--primary" id="exportSave">現在のデータを書き出す<span aria-hidden="true">↓</span></button><div class="save-divider"><span>読み込み</span></div><label class="save-file-picker"><input id="saveFile" type="file" accept=".txt,text/plain,application/json"><span>ファイルを選ぶ</span><small id="saveFileName">未選択</small></label><button type="button" class="option-action" id="inspectSave">内容を確認する<span aria-hidden="true">→</span></button></form><p class="save-status" id="saveStatus" role="status" aria-live="polite"></p><section class="save-preview" id="restorePreview" hidden><h3>読み込むデータ</h3><dl class="option-data" id="restoreValues"></dl><button type="button" class="option-action option-action--primary" id="applySave">このデータを読み込む</button></section>';
  const form=this.body.querySelector('#saveForm'),password=this.body.querySelector('#savePassword'),fileInput=this.body.querySelector('#saveFile'),status=this.body.querySelector('#saveStatus'),preview=this.body.querySelector('#restorePreview');
  const notify=(text,error=false)=>{status.textContent=text;status.dataset.error=String(error);};
  const busy=active=>{form.setAttribute('aria-busy',String(active));form.querySelectorAll('button,input').forEach(x=>x.disabled=active);};
  form.addEventListener('submit',event=>event.preventDefault());
  fileInput.addEventListener('change',()=>{this.pending=null;preview.hidden=true;this.body.querySelector('#saveFileName').textContent=fileInput.files[0]?.name||'未選択';notify('');});
  password.addEventListener('input',()=>{this.pending=null;preview.hidden=true;notify('');});
  this.body.querySelector('#exportSave').addEventListener('click',async()=>{
   const generation=this.generation;busy(true);notify('暗号化しています…');
   try{
    const state=this.readState();this.validateTransfer(state);const text=await encodeSave(state,password.value);if(generation!==this.generation)return;
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='okoteiyu-save-'+new Date().toISOString().replace(/[:.]/g,'-')+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('セーブデータを書き出しました。');
   }catch(error){if(generation===this.generation)notify(error.message,true);}
   finally{if(generation===this.generation)busy(false);}
  });
  this.body.querySelector('#inspectSave').addEventListener('click',async()=>{
   const generation=this.generation;this.pending=null;preview.hidden=true;
   const file=fileInput.files[0];if(!file){notify('読み込むファイルを選んでください。',true);return;}
   busy(true);notify('データを確認しています…');
   try{
    if(file.size>1024*1024)throw new Error('ファイルが大きすぎます。');
    const state=await decodeSave(await file.text(),password.value);if(generation!==this.generation)return;this.validateTransfer(state);
    this.pending=state;const values=this.body.querySelector('#restoreValues'),summary=describeSaveProgress(state);values.replaceChildren();
    preview.querySelector('.save-inventory')?.remove();preview.querySelector('.save-legacy-note')?.remove();
    const rows=[...summary.rows,['ランク',state.rank],['現在位置',state.location],['ランクポイント',state.rankPoints==null?(/^S(?:\d+)?$/.test(state.rank)?'記録なし':'なし'):state.rankPoints+' pt'],['経験値',Math.round(state.gauges.experience*100)+'%']];
    for(const [label,value] of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);values.append(row);}
    if(summary.missingGameData){const note=document.createElement('p');note.className='option-note save-legacy-note';note.textContent='この古いセーブデータには、レベル・所持品・記録帳の情報が含まれていません。';values.after(note);}
    else{
     const details=document.createElement('details'),heading=document.createElement('summary');details.className='save-inventory';heading.textContent='もちものの内訳';details.append(heading);
     for(const group of summary.inventory){const section=document.createElement('section'),title=document.createElement('h4'),list=document.createElement('ul');title.textContent=group.label;section.append(title,list);
      for(const item of group.items){const row=document.createElement('li'),name=document.createElement('span'),quantity=document.createElement('span');name.textContent=item.name;quantity.textContent=item.quantity;row.append(name,quantity);list.append(row);}
      if(!group.items.length){const empty=document.createElement('li');empty.textContent='なし';list.append(empty);}details.append(section);
     }
     const note=document.createElement('p');note.className='option-note';note.textContent='オーラの個数は、レベルアップに使った分も含む累計取得数です。';details.append(note);values.after(details);
    }
    preview.hidden=false;notify('内容を確認してから、読み込んでください。');preview.scrollIntoView({block:'nearest'});
   }catch(error){if(generation===this.generation)notify(error.message,true);}
   finally{if(generation===this.generation)busy(false);}
  });
  this.body.querySelector('#applySave').addEventListener('click',()=>{
   if(!this.pending)return;this.applyState(validatePreviewState(this.pending));this.pending=null;preview.hidden=true;password.value='';fileInput.value='';this.body.querySelector('#saveFileName').textContent='未選択';notify('セーブデータを読み込みました。');
  });
 }
}
