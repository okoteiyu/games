import {tryOpenModal,releaseModal,isModalBlocked} from './modal-layer.js';

export const BUILDING_FLOORS=Object.freeze([
 {id:'1f',label:'1F',name:'おこていゆの暮らし',summary:'おこていゆの1Kと、建物の共用スペース。',areas:[
  {id:'home',name:'おこていゆの部屋',tag:'HOME · 1K',text:'ホーム画面のリビングは、この1Kの一室です。窓は右側の外壁に面しています。玄関脇には広めの台所があり、左側の通路からトイレと洗面・浴室へつながります。洗面台と浴室は一つの部屋で、中に仕切りがあります。',note:'台所と水回りは間取りの表示のみです。個別の移動先にはなりません。'},
  {id:'hall',name:'共用廊下',tag:'PASSAGE',text:'部屋の外にある短い廊下。片方は建物の入り口、もう片方は階段とエレベーターにつながっています。'},
  {id:'entrance',name:'建物の入り口',tag:'SECURITY',text:'建物の外と共用廊下をつなぐ入り口。セキュリティのロックがかかっています。',note:'解錠方法などの詳細は、これから決まります。'},
  {id:'core',name:'階段・エレベーター',tag:'FLOOR ACCESS',text:'地上の住居と地下の研究・支援エリアをつなぐ、上下移動のためのスペースです。'}]},
 {id:'2f',label:'2F',name:'あなたの暮らし',summary:'人間である「あなた」の居住スペース。',areas:[
  {id:'player',name:'あなたの部屋',tag:'YOUR ROOM · 1K',text:'人間である「あなた」が暮らす部屋。おこていゆの部屋と同じ間取りですが、リビングのアイテムの配置が違います。',note:'家具の種類や詳しい配置は未定です。図の家具はイメージです。'},
  {id:'core',name:'階段・エレベーター',tag:'FLOOR ACCESS',text:'1Fや地下エリアとつながるスペースです。'}]},
 {id:'b1',label:'B1',name:'研究と支援',summary:'ヒーロー会でのおこていゆの後援者が管理。広さは、おこていゆの部屋の約6室分です。',areas:[
  {id:'research',name:'研究所',tag:'RESEARCH',text:'おこていゆの研究を支える研究所。地下1階には、研究と支援のための施設が集まっています。'},
  {id:'analysis',name:'珍生物分析室',tag:'ANALYSIS',text:'珍生物の分析を行うためのエリア。詳しい設備や使い方は、これから決まります。'},
  {id:'production',name:'生産施設',tag:'PRODUCTION',text:'生産のための施設があるエリア。何をどのように生産するかは未定です。'},
  {id:'maintenance',name:'整備施設',tag:'MAINTENANCE',text:'整備を行うためのエリア。設備や対応する機能の詳細は、これから決まります。'}]},
 {id:'b2',label:'B2',name:'地下の訓練場',summary:'地上より広く、天井も高い地下2階。',areas:[
  {id:'training',name:'訓練所',tag:'TRAINING',text:'地下2階にある、天井の高い訓練所。入口から広い室内を見渡しながら、訓練の難易度を選べます。おこていゆは入口を入ってすぐの場所で待っています。',note:'訓練所への移動ではポイントを使いません。訓練を始めると、穏やかポイントを1使います。'},
  {id:'core',name:'階段・エレベーター',tag:'FLOOR ACCESS',text:'研究・支援エリアや地上の住居につながるスペースです。'}]}
]);
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" ${extra}/>`;
const text=(x,y,value,size=24,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" ${extra}>${value}</text>`;
const stairs=(x,y)=>`<g stroke="#9e8a69" stroke-width="3">${Array.from({length:6},(_,i)=>`<path d="M${x} ${y+i*8}h42"/>`).join('')}</g>`;
const zone=(id,selected,x,y,w,h,fill)=>rect(x,y,w,h,fill,`data-building-zone="${id}" stroke="${selected===id?'#936843':'#bcad91'}" stroke-width="${selected===id?5:2}"`);
const svgNode=(tag,attributes={})=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [name,value]of Object.entries(attributes))node.setAttribute(name,String(value));return node;};

/** Service-room doors face the left passage, away from the living window. */
function toiletRoom(){
 return '<g data-apartment-room="toilet">'+
  rect(169,56,66,79,'#edf2e8','data-room-floor="toilet"')+
  '<path data-room-wall="toilet" d="M235 84V56H169V135H235V116" fill="none" stroke="#b7c7b9" stroke-width="2" stroke-linejoin="round"/>'+
  rect(191,64,20,16,'#fbfcf7','data-room-fixture="toilet" stroke="#bdc8b4"')+
  '<path data-door="toilet" d="M235 84h-32M235 116A32 32 0 0 1 203 84" fill="none" stroke="#a3af96" stroke-width="1.5"/>'+
  text(202,123,'トイレ',20)+'</g>';
}

/** One exterior room; the internal sliding partition keeps a clear way to the bath. */
function washBathRoom(){
 return '<g data-apartment-room="wash-bath">'+
  rect(169,147,66,187,'#e7efeb','data-room-floor="wash-bath"')+
  '<path data-room-wall="wash-bath" d="M235 176V147H169V334H235V208" fill="none" stroke="#b7c7b9" stroke-width="2" stroke-linejoin="round"/>'+
  rect(177,154,50,18,'#fbfcf7','data-room-fixture="basin" stroke="#bdc8b4"')+text(202,208,'洗面台',20)+
  '<path data-door="wash-bath" d="M235 176h-32M235 208A32 32 0 0 1 203 176" fill="none" stroke="#a3af96" stroke-width="1.5"/>'+
  '<path data-room-partition="bath" d="M169 224H203" fill="none" stroke="#b7c7b9" stroke-width="2"/>'+
  '<path data-door="bath-partition" d="M204 227h30m-30 4h14" fill="none" stroke="#a3af96" stroke-width="1.5"/>'+
  rect(177,242,24,48,'#f8fcfa','data-room-fixture="bathtub" stroke="#a8bfbc" stroke-width="2"')+
  rect(181,248,16,35,'#e1eeec','stroke="#c7dad6" stroke-width="1"')+text(202,322,'浴室',22)+'</g>';
}

/** A schematic, not a finalized architectural plan or a game destination picker. */
export function buildingFloorSvg(floorId,selected){
 const floor=BUILDING_FLOORS.find(f=>f.id===floorId)||BUILDING_FLOORS[0];
 let drawing,viewBox;
 if(floor.id==='1f'||floor.id==='2f'){
  const home=floor.id==='1f';viewBox='60 10 580 550';
  drawing=rect(100,25,520,500,'#e9eddc','stroke="#b6bc9e" stroke-width="2"')+
   zone(home?'home':'player',selected,154,42,420,370,'#faf2e1')+
   rect(287,56,272,278,'#f1ead6','data-living-room="true" stroke="#c4b493" stroke-width="2"')+
   '<g data-living-contents="true" transform="translate(118 0)">'+
   (home?'<svg class="building-live-room" x="171" y="58" width="268" height="274" viewBox="7 7 226 248"></svg>':
    rect(170,57,270,78,'#e6e8d9')+rect(182,137,47,48,'#e4d0ae')+stairs(185,139)+rect(324,73,101,55,'#c9d7cc','stroke="#abbcaf"')+rect(396,77,24,47,'#f8faf5')+rect(184,282,100,34,'#dccbad')+rect(202,208,115,48,'#d5c7b6')+rect(236,185,48,22,'#d5c7b6')+rect(355,232,64,62,'#e8ddc5'))+
   text(305,home?171:164,home?'':'リビング',26)+'</g>'+
   rect(241,56,40,340,'#fffbf1','data-apartment-passage="wet"')+
   `<path d="M460 398V350H261V88M261 100H235M261 192H235" stroke="#c3cbae" stroke-width="2" stroke-dasharray="5 5" fill="none" aria-hidden="true"/>`+
   toiletRoom()+washBathRoom()+
   rect(287,365,138,31,'#e5d6b9','data-apartment-kitchen="true" data-kitchen-counter="true" stroke="#c8b493" stroke-width="1.5"')+
   rect(296,371,34,18,'#faf6ec','data-kitchen-fixture="sink" stroke="#c8b99f" stroke-width="1"')+
   rect(397,371,20,18,'#f8f3e7','data-kitchen-fixture="stove" stroke="#c8b99f" stroke-width="1"')+
   '<g fill="none" stroke="#ab987b" stroke-width="1.2"><circle cx="403" cy="377" r="2.5"/><circle cx="411" cy="384" r="2.5"/></g>'+
   text(363,387,'台所',21)+text(514,378,'玄関',23)+
   rect(402,331,48,8,'#faf2e1')+`<path data-door="living" d="M405 338h42m-42 4h20" stroke="#b09774" stroke-width="2"/>`+
   zone('hall',selected,119,430,486,75,'#eee6d5')+
   (home?zone('entrance',selected,119,430,126,75,'#e8dbc2')+text(182,461,'入口',24)+text(182,486,'ロック',19)+`<rect x="157" y="436" width="12" height="10" rx="2" fill="#a38051"/><path d="M159 437v-5a4 4 0 0 1 8 0v5" stroke="#a38051" fill="none" stroke-width="2"/>`:'')+
   text(362,475,home?'共用廊下':'共用通路',23)+zone('core',selected,481,430,124,75,'#d4dfd0')+stairs(492,443)+rect(549,442,44,49,'#f5f7ed','stroke="#a7b59c" stroke-width="2"')+text(571,474,'EV',18)+
   rect(440,409,40,26,'#faf2e1','data-apartment-entry="true"')+
   `<path data-door="apartment" d="M442 412v-36M478 412A36 36 0 0 0 442 376" fill="none" stroke="#b09774" stroke-width="2"/>`+
   text(363,548,home?'おこていゆの部屋 · 1K':'あなたの部屋 · 同じ1Kの間取り',24);
 }else{
  viewBox='0 0 1200 920';
  drawing=rect(30,30,1140,810,'#edf0e0','stroke="#b2bc9e" stroke-width="4"')+
   text(600,885,'破線：地上の建物の範囲（概略）',36);
  if(floor.id==='b1'){
   drawing+=zone('research',selected,65,70,480,280,'#e1ead7')+zone('analysis',selected,655,70,480,280,'#dfecea')+
    zone('production',selected,65,475,480,280,'#eee1c6')+zone('maintenance',selected,655,475,480,280,'#e8dfd5')+
    text(305,205,'研究所',46)+text(895,205,'珍生物分析室',46)+text(305,615,'生産施設',46)+text(895,615,'整備施設',46)+
    text(600,401,'研究・支援エリア',35)+text(600,445,'おこていゆの部屋 約6室分',29)+
    rect(530,760,140,60,'#d4dfd0')+text(600,800,'階段・EV',24);
  }else{
   drawing+=zone('training',selected,85,95,1030,560,'#e3e9d0')+rect(275,208,650,320,'#edf0df','stroke="#b6c19f" stroke-width="3" stroke-dasharray="13 10"')+
    text(600,350,'訓練所',64)+text(600,415,'天井の高い、大きな地下空間',40)+
    zone('core',selected,440,715,320,90,'#d4dfd0')+text(600,770,'階段・エレベーター',27);
  }
  drawing+=rect(340,180,520,500,'none','stroke="#9aa788" stroke-width="3" stroke-dasharray="12 9" opacity=".85"');
 }
 return `<svg class="building-plan" viewBox="${viewBox}" role="img" aria-label="${floor.label} ${floor.name}の概略マップ。${floor.areas.find(a=>a.id===selected)?.name||''}を選択中"><g fill="#645b49" font-family="system-ui, sans-serif">${drawing}</g></svg>`;
}

export class BuildingMapDialog{
 constructor({canOpen=()=>true,getRoomSvg=()=>null,getCurrentArea=()=>({floorId:'1f',areaId:'home'}),canTravel=()=>false,onTravel=()=>false}={}){
  Object.assign(this,{canOpen,getRoomSvg,getCurrentArea,canTravel,onTravel});this.floorId='1f';this.areaId='home';this.opener=null;
  const dialog=this.dialog=document.createElement('dialog');dialog.id='buildingMapDialog';dialog.className='building-map-dialog';dialog.setAttribute('aria-labelledby','buildingMapTitle');dialog.setAttribute('aria-modal','true');
  dialog.innerHTML=`<header class="building-map__header"><div><span class="building-map__eyebrow">OKOTEIYU HOUSE</span><h2 id="buildingMapTitle">建物マップ</h2></div><button type="button" class="building-map__close" aria-label="建物マップを閉じる">×</button></header><div class="building-map__floors" role="tablist" aria-label="表示する階">${BUILDING_FLOORS.map(f=>`<button type="button" role="tab" id="buildingFloor-${f.id}" data-building-floor="${f.id}" aria-controls="buildingMapPanel">${f.label}</button>`).join('')}</div><div class="building-map__body" id="buildingMapPanel" role="tabpanel"><div class="building-map__intro"><h3></h3><p></p></div><div class="building-map__layout"><figure class="building-map__figure"><div class="building-map__drawing"></div><figcaption>各階を見やすい大きさで表示しています。<br>区画・家具の配置は概略です。</figcaption></figure><div class="building-map__information"><div class="building-map__areas" role="group" aria-label="表示するエリア"></div><section class="building-map__description" aria-live="polite" aria-atomic="true"></section></div></div><p class="building-map__note">この画面では建物の案内を見られます。<br>ホーム画面は1F・おこていゆの部屋です。</p></div>`;
  document.body.append(dialog);
  dialog.querySelector('.building-map__note').textContent='「タップで移動」の目印がある場所は、地図から直接選べます。移動前に確認します。';
  this.confirmation=null;
  this.confirmOverlay=document.createElement('div');this.confirmOverlay.className='building-map-confirm';this.confirmOverlay.hidden=true;
  this.confirmOverlay.innerHTML='<section class="building-map-confirm__card"><span class="building-map-confirm__eyebrow">MOVE / 移動の確認</span><h3 id="buildingTravelTitle">ここへ移動しますか？</h3><p class="building-map-confirm__destination"></p><p id="buildingTravelBody">地図を閉じて、選んだ場所へ移動します。</p><div class="building-map-confirm__actions"><button type="button" data-building-confirm="cancel">地図に戻る</button><button type="button" data-building-confirm="move">移動する<span aria-hidden="true"> ↗</span></button></div></section>';dialog.append(this.confirmOverlay);
  this.mapParts=[dialog.querySelector('.building-map__header'),dialog.querySelector('.building-map__floors'),dialog.querySelector('.building-map__body')];
  dialog.querySelector('.building-map__close').addEventListener('click',()=>this.close());
  dialog.addEventListener('cancel',event=>{if(this.confirmation){event.preventDefault();this.cancelTravel();}});
  dialog.addEventListener('close',()=>{if(dialog.open)return;this.hideConfirmation(false);releaseModal(dialog);this.opener?.setAttribute('aria-expanded','false');if(this.canOpen()&&!isModalBlocked()&&this.opener?.isConnected)this.opener.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{
   if(this.confirmation){const action=event.target.closest('[data-building-confirm]')?.dataset.buildingConfirm;if(action==='cancel')this.cancelTravel();else if(action==='move')this.confirmTravel();return;}
   const region=event.target.closest('[data-building-map-area]');if(region){this.activateMapArea(region.dataset.buildingMapArea);return;}
   const travel=event.target.closest('[data-building-travel]');
   if(travel){if(!travel.disabled)this.requestTravel('button');return;}
   const floor=event.target.closest('[data-building-floor]'),area=event.target.closest('[data-building-area]');
   if(floor)this.selectFloor(floor.dataset.buildingFloor);
   else if(area)this.selectArea(area.dataset.buildingArea);
   else if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)this.close();}
  });
  dialog.addEventListener('keydown',event=>{
   if(this.confirmation){if(event.key==='Tab'){event.preventDefault();const buttons=[...this.confirmOverlay.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus({preventScroll:true});}return;}
   const region=event.target.closest('[data-building-map-area]');if(region&&['Enter',' '].includes(event.key)){event.preventDefault();if(!event.repeat)this.activateMapArea(region.dataset.buildingMapArea);}
  });
  dialog.querySelector('[role=tablist]').addEventListener('keydown',event=>{
   const index=BUILDING_FLOORS.findIndex(f=>f.id===this.floorId),next=event.key==='Home'?0:event.key==='End'?3:['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%4:['ArrowLeft','ArrowUp'].includes(event.key)?(index+3)%4:null;
   if(next===null)return;event.preventDefault();this.selectFloor(BUILDING_FLOORS[next].id);dialog.querySelector('[data-building-floor="'+this.floorId+'"]').focus();
  });
 }
 open(opener){
  if(!this.canOpen()||isModalBlocked())return false;
  this.opener=opener||document.activeElement;const current=this.getCurrentArea();this.selectFloor(current.floorId||'1f');if(current.areaId)this.selectArea(current.areaId);
  if(!tryOpenModal(this.dialog))return false;
  this.opener?.setAttribute('aria-expanded','true');return true;
 }
 close(){if(this.dialog.open)this.dialog.close();}
 activateMapArea(id){
  if(!this.dialog.open||this.confirmation)return false;
  const scroll=this.dialog.querySelector('.building-map__body').scrollTop;
  if(!this.selectArea(id))return false;
  this.dialog.querySelector('.building-map__body').scrollTop=scroll;
  const target=this.dialog.querySelector('[data-building-map-area="'+id+'"]');target?.focus({preventScroll:true});
  return this.requestTravel('map');
 }
 requestTravel(source='button'){
  if(!this.dialog.open||this.confirmation||!this.canOpen())return false;
  const destination={floorId:this.floorId,areaId:this.areaId},current=this.getCurrentArea();
  if(!this.canTravel(destination)||(current.floorId===destination.floorId&&current.areaId===destination.areaId))return false;
  const floor=BUILDING_FLOORS.find(f=>f.id===destination.floorId),area=floor?.areas.find(a=>a.id===destination.areaId);if(!area)return false;
  this.confirmation={...destination,source,scroll:this.dialog.querySelector('.building-map__body').scrollTop,submitted:false};
  this.confirmOverlay.querySelector('.building-map-confirm__destination').textContent=floor.label+' · '+area.name;
  for(const part of this.mapParts){part.inert=true;part.setAttribute('aria-hidden','true');}
  this.dialog.setAttribute('aria-labelledby','buildingTravelTitle');this.dialog.setAttribute('aria-describedby','buildingTravelBody');this.confirmOverlay.hidden=false;
  for(const button of this.confirmOverlay.querySelectorAll('button'))button.disabled=false;
  this.confirmOverlay.querySelector('[data-building-confirm="cancel"]').focus({preventScroll:true});return true;
 }
 hideConfirmation(restoreFocus=true){
  const pending=this.confirmation;this.confirmation=null;this.confirmOverlay.hidden=true;
  for(const part of this.mapParts){part.inert=false;part.removeAttribute('aria-hidden');}
  this.dialog.setAttribute('aria-labelledby','buildingMapTitle');this.dialog.removeAttribute('aria-describedby');
  if(pending&&restoreFocus&&this.dialog.open){this.dialog.querySelector('.building-map__body').scrollTop=pending.scroll;this.dialog.querySelector(pending.source==='map'?'[data-building-map-area="'+pending.areaId+'"]':'[data-building-travel]')?.focus({preventScroll:true});}
  return pending;
 }
 cancelTravel(){if(!this.confirmation)return false;this.hideConfirmation();return true;}
 confirmTravel(){
  const pending=this.confirmation;if(!this.dialog.open||!pending||pending.submitted)return false;
  const destination={floorId:pending.floorId,areaId:pending.areaId},current=this.getCurrentArea();
  if(!this.canOpen()||!this.canTravel(destination)||this.floorId!==pending.floorId||this.areaId!==pending.areaId||(current.floorId===pending.floorId&&current.areaId===pending.areaId)){
   this.hideConfirmation(false);this.selectArea(this.areaId);const status=document.createElement('p');status.setAttribute('role','status');status.tabIndex=-1;status.textContent='いまは移動できません。もう一度、地図をご確認ください。';this.dialog.querySelector('.building-map__description').append(status);
   const trigger=this.dialog.querySelector(pending.source==='map'?'[data-building-map-area="'+pending.areaId+'"]':'[data-building-travel]');(trigger&&!trigger.disabled?trigger:status).focus({preventScroll:true});this.dialog.querySelector('.building-map__body').scrollTop=pending.scroll;return false;
  }
  pending.submitted=true;for(const button of this.confirmOverlay.querySelectorAll('button'))button.disabled=true;
  this.hideConfirmation(false);this.dialog.addEventListener('close',()=>{const now=this.getCurrentArea();if(this.canOpen()&&this.canTravel(destination)&&(now.floorId!==destination.floorId||now.areaId!==destination.areaId))this.onTravel(destination);},{once:true});this.close();return true;
 }
 selectFloor(id){
  if(this.confirmation)return false;
  const floor=BUILDING_FLOORS.find(f=>f.id===id);if(!floor)return false;
  this.floorId=id;this.areaId=floor.areas[0].id;
  for(const button of this.dialog.querySelectorAll('[data-building-floor]')){const active=button.dataset.buildingFloor===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  this.dialog.querySelector('[role=tabpanel]').setAttribute('aria-labelledby','buildingFloor-'+id);
  this.dialog.querySelector('.building-map__intro h3').textContent=floor.label+' · '+floor.name;
  this.dialog.querySelector('.building-map__intro p').textContent=floor.summary;
  this.dialog.querySelector('figcaption').textContent='色付きの枠と「タップで移動」の目印がある場所を選べます。区画・家具の配置は概略です。';
  this.dialog.querySelector('.building-map__areas').innerHTML=floor.areas.map(area=>`<button type="button" data-building-area="${area.id}" aria-pressed="false">${area.name}</button>`).join('');
  this.dialog.querySelector('.building-map__body').scrollTop=0;this.selectArea(this.areaId);return true;
 }
 selectArea(id){
  if(this.confirmation)return false;
  const floor=BUILDING_FLOORS.find(f=>f.id===this.floorId),area=floor.areas.find(a=>a.id===id);if(!area)return false;
  this.areaId=id;for(const b of this.dialog.querySelectorAll('[data-building-area]'))b.setAttribute('aria-pressed',String(b.dataset.buildingArea===id));
  this.dialog.querySelector('.building-map__drawing').innerHTML=buildingFloorSvg(this.floorId,id);
  const description=this.dialog.querySelector('.building-map__description');description.replaceChildren();
  for(const [tag,content]of [['span',area.tag],['h4',area.name],['p',area.text],...(area.note?[['p',area.note]]:[])]){const node=document.createElement(tag);node.textContent=content;description.append(node);}
  const current=this.getCurrentArea(),here=current.floorId===this.floorId&&current.areaId===id,destination={floorId:this.floorId,areaId:id},available=this.canTravel(destination);
  const travel=document.createElement('button');travel.type='button';travel.className='building-map__travel';travel.dataset.buildingTravel='';travel.disabled=here||!available;travel.textContent=here?'現在地':available?'ここへ移動する':'3Dエリアは準備中';description.append(travel);
  this.mountRoomMap();this.decorateMap();return true;
 }
 decorateMap(){
  const svg=this.dialog.querySelector('.building-plan'),floor=BUILDING_FLOORS.find(f=>f.id===this.floorId),current=this.getCurrentArea(),unit=this.floorId.startsWith('b')?2:1;
  svg.setAttribute('role','group');svg.firstElementChild.setAttribute('aria-hidden','true');
  const overlay=svgNode('g',{'class':'building-map-targets'});svg.append(overlay);
  for(const area of floor.areas){
   const rect=svg.querySelector('[data-building-zone="'+area.id+'"]');if(!rect)continue;
   const [x,y,w,h]=['x','y','width','height'].map(k=>Number(rect.getAttribute(k))),here=current.floorId===this.floorId&&current.areaId===area.id,available=!here&&this.canTravel({floorId:this.floorId,areaId:area.id});
   const target=svgNode('g',{'class':'building-map-region '+(available?'is-travelable':here?'is-current':'is-unavailable'),'data-building-map-area':area.id,'data-travel-available':String(available),role:'button',tabindex:0,'aria-label':area.name+'。'+(available?'タップして移動を確認':here?'現在地。説明を見る':'3Dエリアは準備中。説明を見る')});
   target.append(svgNode('rect',{x,y,width:w,height:h,rx:8,'class':'building-map-region__hit','vector-effect':'non-scaling-stroke'}));
   if(available){
    const cx=x+w/2,cy=y+24*unit,badge=svgNode('g',{transform:'translate('+cx+' '+cy+') scale('+unit+')','class':'building-map-region__badge','aria-hidden':'true'});
    badge.append(svgNode('path',{d:'M0-20c-12 0-20 8-20 19 0 14 20 30 20 30S20 13 20-1C20-12 12-20 0-20Z',fill:'#6e8652',stroke:'#fffdf2','stroke-width':2}));
    badge.append(svgNode('path',{d:'M-7 3 7-9M-5-9H7V3',fill:'none',stroke:'#fffdf2','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
    badge.append(svgNode('rect',{x:-92,y:32,width:184,height:40,rx:18,fill:'#fffdf2',stroke:'#99ac78','stroke-width':2}));
    const label=svgNode('text',{x:0,y:60,'font-size':24,'font-weight':600,'text-anchor':'middle',fill:'#5e7447'});label.textContent='タップで移動';badge.append(label);target.append(badge);
   }else if(here){
    const tag=svgNode('g',{'class':'building-map-region__badge','aria-hidden':'true'}),cy=Math.max(svg.viewBox.baseVal.y+18*unit,y-18*unit);tag.append(svgNode('rect',{x:x+w/2-64*unit,y:cy-16*unit,width:128*unit,height:32*unit,rx:14*unit,fill:'#8c7451',stroke:'#fffdf2','stroke-width':unit}));
    const label=svgNode('text',{x:x+w/2,y:cy+7*unit,'font-size':21*unit,'text-anchor':'middle',fill:'#fffdf2'});label.textContent='● 現在地';tag.append(label);target.append(tag);
   }
   overlay.append(target);
  }
 }
 mountRoomMap(){
  const target=this.dialog.querySelector('.building-live-room'),source=this.getRoomSvg();if(!target||!source)return;
  const clone=source.cloneNode(true);
  for(const node of clone.querySelectorAll('[id]'))node.id='building-'+node.id;
  for(const node of clone.querySelectorAll('[fill]')){const fill=node.getAttribute('fill');if(fill?.startsWith('url(#'))node.setAttribute('fill',fill.replace('url(#','url(#building-'));}
  target.replaceChildren(...clone.childNodes);
 }
 updateRoomMarkers(source){
  if(!this.dialog.open||this.floorId!=='1f'||!source)return;
  for(const id of ['roomMapOkoteiyu','roomMapMoai']){const from=source.querySelector('#'+id),to=this.dialog.querySelector('#building-'+id);if(from&&to)to.setAttribute('transform',from.getAttribute('transform')||'');}
 }
}
