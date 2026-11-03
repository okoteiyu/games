import {tryOpenModal,releaseModal,isModalBlocked} from './modal-layer.js';
import {trainingMapDrawing,BASEMENT_MAP_VIEWBOX,basementFloorDrawing,basementUpperToiletDrawing,basementWashroomDrawing,basementCoreDrawing,basementFreightDrawing} from './training-map.js';
import {outdoorMapDrawing,OUTDOOR_MAP_VIEWBOX} from './outdoor-map.js';
import {analysisMapDrawing} from './analysis-map.js';
import {interiorMapDrawing,staffCountDrawing} from './interior-map.js';
import {getFacilityStaffCounts} from './facility-staff.js';
import {INTERIOR_ROOMS} from './interior-rules.js';
import {INTERIOR_LAYOUTS} from './interior-layouts.js';

export const BUILDING_FLOORS=Object.freeze([
 {id:'b2',label:'B2',name:'地下の訓練場',areas:[
  {id:'training',name:'訓練所',text:'招待した珍生物と訓練する施設。'},
  {id:'guest-lounge',name:'休憩室',text:'招待した珍生物と施設作業員が自由にくつろぐための休憩室。'},
  {id:'control',name:'管理室',text:'管理人が住み込み、2人ほどで使う管理室。'},
  {id:'washrooms',name:'トイレ・シャワー・脱衣所',mapOnly:true,text:''},
  {id:'toilet-upper',name:'トイレ（EV上）',mapOnly:true,text:''},
  {id:'freight',name:'屋外につながる大型EV',mapOnly:true,text:'大きな珍生物を迎えるための搬入設備。'},
  {id:'core',name:'階段・エレベーター',text:''}]},
 {id:'b1',label:'B1',name:'研究と支援',areas:[
  {id:'research',name:'研究所',text:'おこていゆの研究を支える施設。'},
  {id:'analysis',name:'コンピュータ室',text:''},
  {id:'production',name:'生産施設',text:'植物を育てる区画と、液体を扱うバイオプラント。'},
  {id:'washrooms',name:'トイレ・シャワー・脱衣所',mapOnly:true,text:''},
  {id:'toilet-upper',name:'トイレ（EV上）',mapOnly:true,text:''},
  {id:'freight',name:'屋外につながる大型EV',mapOnly:true,text:'大きな珍生物を迎えるための搬入設備。'},
  {id:'maintenance',name:'整備施設',text:'研究と支援を支える整備エリア。'}]},
 {id:'1f',label:'F1',name:'おこていゆの暮らし',areas:[
  {id:'home',name:'おこていゆの部屋',text:'ホーム画面。おこていゆが暮らす部屋。'},
  {id:'hall',name:'共用廊下',text:''},
  {id:'entrance',name:'建物の入り口',text:''},
  {id:'core',name:'階段・エレベーター',text:''}]},
 {id:'2f',label:'F2',name:'あなたの暮らし',areas:[
  {id:'player',name:'あなたの部屋',text:''},
  {id:'core',name:'階段・エレベーター',text:''}]},
 {id:'outdoor',label:'屋外',name:'おこていゆハウス周辺',areas:[
  {id:'grounds',name:'拠点の屋外',text:''},
  {id:'building',name:'おこていゆハウスの建物',mapOnly:true,text:'F1におこていゆ、F2にあなたが暮らす建物。'},
  {id:'entrance',name:'建物入口',mapOnly:true,text:''},
  {id:'warehouse',name:'倉庫',text:'食材や資材、作業道具を保管する倉庫。'},
  {id:'freight',name:'大型搬入口・EV',mapOnly:true,text:'通常のエレベーターに収まらない、大きな珍生物を迎える設備。'}]}
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

/** Kitchen art coordinates are shared with the F2 authored model. */
function apartmentKitchenDrawing(){
 const a=INTERIOR_LAYOUTS['player-room'].apartmentPlan,[x,y,w,h]=a.kitchenCounter,sink=a.kitchenFixtures.sink,stove=a.kitchenFixtures.stove;
 return rect(x,y,w,h,'#e5d6b9','data-apartment-kitchen="true" data-kitchen-counter="true" data-kitchen-layout="wall-southwest" stroke="#c8b493" stroke-width="1.5"')+
  rect(...sink,'#faf6ec','data-kitchen-fixture="sink" stroke="#c8b99f" stroke-width="1"')+
  rect(...stove,'#f8f3e7','data-kitchen-fixture="stove" stroke="#c8b99f" stroke-width="1"')+
  `<g fill="none" stroke="#ab987b" stroke-width="1.2"><circle cx="${stove[0]+6}" cy="${stove[1]+6}" r="2.5"/><circle cx="${stove[0]+stove[2]-6}" cy="${stove[1]+stove[3]-6}" r="2.5"/></g>`+
  text(260,400,'台所',21);
}

/** A schematic, not a finalized architectural plan or a game destination picker. */
export function buildingFloorSvg(floorId,selected){
 const floor=BUILDING_FLOORS.find(f=>f.id===floorId)||BUILDING_FLOORS.find(f=>f.id==='1f');
 let drawing,viewBox;
 if(floor.id==='1f'||floor.id==='2f'){
  const home=floor.id==='1f';viewBox='60 10 580 530';
  drawing=rect(100,25,520,500,'#e9eddc','stroke="#b6bc9e" stroke-width="2"')+
   zone(home?'home':'player',selected,154,42,420,370,'#faf2e1')+
   rect(287,56,272,278,'#f1ead6','data-living-room="true" stroke="#c4b493" stroke-width="2"')+
   '<g data-living-contents="true" transform="translate(118 0)">'+
   (home?'<svg class="building-live-room" x="171" y="58" width="268" height="274" viewBox="7 7 226 248"></svg>':
    '<g transform="translate(169 56)">'+interiorMapDrawing('player-room',{livingOnly:true})+'</g>')+
   '</g>'+
   rect(...INTERIOR_LAYOUTS['player-room'].apartmentPlan.wetPassageRect,'#fffbf1','data-apartment-passage="wet"')+
   rect(...INTERIOR_LAYOUTS['player-room'].apartmentPlan.entryPassageRect,'#fffbf1','data-apartment-passage="entry-crossing"')+
   `<path data-apartment-route="entry-living-wet" d="M460 398V359H261V88M426 334V359M261 100H235M261 192H235" stroke="#c3cbae" stroke-width="2" stroke-dasharray="5 5" fill="none" aria-hidden="true"/>`+
   toiletRoom()+washBathRoom()+
   apartmentKitchenDrawing()+text(514,378,'玄関',23)+
   rect(402,331,48,8,'#faf2e1')+`<path data-door="living" d="M405 338h42m-42 4h20" stroke="#b09774" stroke-width="2"/>`+
   zone('hall',selected,119,430,486,75,'#eee6d5')+
   (home?zone('entrance',selected,119,430,126,75,'#e8dbc2')+text(182,475,'入口',24):'')+
   text(362,475,home?'共用廊下':'共用通路',23)+zone('core',selected,481,430,124,75,'#d4dfd0')+stairs(492,443)+rect(549,442,44,49,'#f5f7ed','stroke="#a7b59c" stroke-width="2"')+text(571,474,'EV',18)+
   rect(440,409,40,26,'#faf2e1','data-apartment-entry="true"')+
   `<path data-door="apartment" d="M442 412v-36M478 412A36 36 0 0 0 442 376" fill="none" stroke="#b09774" stroke-width="2"/>`;
 }else if(floor.id==='outdoor'){
  viewBox=OUTDOOR_MAP_VIEWBOX;drawing=outdoorMapDrawing({selected});
 }else{
  viewBox=BASEMENT_MAP_VIEWBOX;
  drawing=basementFloorDrawing();
  if(floor.id==='b1'){
   drawing+='<path data-basement-access="freight" d="M10 374H42V270H65M42 374V552H65" fill="none" stroke="#e2d9c4" stroke-width="24" stroke-linejoin="round"/>'+
    '<path data-basement-access="core" d="M282 340V410M762 340V410M42 374H1102" fill="none" stroke="#e2d9c4" stroke-width="44" stroke-linejoin="round"/>'+
    rect(65,190,435,150,'#e1ead7','data-building-zone="research" data-map-marker-x="180" data-map-marker-y="90" data-map-marker-unit="1.2"')+
    '<g transform="translate(65 190)">'+interiorMapDrawing('research-room',{selected:selected==='research'})+'</g>'+
    rect(545,190,435,150,'#e8eee5','data-building-zone="analysis" data-map-marker-x="905" data-map-marker-y="90" data-map-marker-unit="1.25"')+
    '<g transform="translate(545 190)">'+analysisMapDrawing({selected:selected==='analysis'})+'</g>'+
    rect(65,410,435,285,'#eee1c6','data-building-zone="production" data-map-marker-x="282" data-map-marker-y="365" data-map-marker-unit="1.2"')+'<g transform="translate(65 410)">'+interiorMapDrawing('production-room',{selected:selected==='production'})+'</g>'+
    rect(545,410,435,285,'#e8dfd5','data-building-zone="maintenance" data-map-marker-x="762" data-map-marker-y="345" data-map-marker-unit="1"')+'<g transform="translate(545 410)">'+interiorMapDrawing('maintenance-room',{selected:selected==='maintenance'})+'</g>'+
    '<path data-basement-access="room-doors" d="M260 410h44M65 536v32" fill="none" stroke="#e2d9c4" stroke-width="8"/>'+
    text(400,175,'研究所',28)+text(658,175,'コンピュータ室',28)+text(282,720,'生産施設',28)+text(762,720,'整備施設',28)+
    text(550,125,'研究・支援エリア',35)+basementUpperToiletDrawing({selected})+basementWashroomDrawing({selected})+basementCoreDrawing({selected})+basementFreightDrawing({selected});
  }else{
   drawing=trainingMapDrawing({selected});
  }
 }
 return `<svg class="building-plan" viewBox="${viewBox}" role="img" aria-label="${floor.label} ${floor.name}の概略マップ。${floor.areas.find(a=>a.id===selected)?.name||''}を選択中"><g fill="#645b49" font-family="system-ui, sans-serif">${drawing}</g></svg>`;
}

export class BuildingMapDialog{
 constructor({canOpen=()=>true,getRoomSvg=()=>null,getCurrentArea=()=>({floorId:'1f',areaId:'home'}),canTravel=()=>false,onTravel=()=>false,readStaff=()=>null}={}){
  Object.assign(this,{canOpen,getRoomSvg,getCurrentArea,canTravel,onTravel,readStaff});this.floorId='1f';this.areaId='home';this.opener=null;
  const dialog=this.dialog=document.createElement('dialog');dialog.id='buildingMapDialog';dialog.className='building-map-dialog';dialog.setAttribute('aria-labelledby','buildingMapTitle');dialog.setAttribute('aria-modal','true');
  dialog.innerHTML=`<header class="building-map__header"><h2 id="buildingMapTitle">建物マップ</h2><button type="button" class="building-map__close" aria-label="建物マップを閉じる">×</button></header><div class="building-map__floors" role="tablist" aria-label="表示する階・屋外" style="--building-floor-count:${BUILDING_FLOORS.length}">${BUILDING_FLOORS.map(f=>`<button type="button" role="tab" id="buildingFloor-${f.id}" data-building-floor="${f.id}" aria-controls="buildingMapPanel">${f.label}</button>`).join('')}</div><div class="building-map__body" id="buildingMapPanel" role="tabpanel"><figure class="building-map__figure"><div class="building-map__drawing"></div></figure><section class="building-map__description" aria-live="polite" aria-atomic="true"></section></div>`;
  document.body.append(dialog);
  this.confirmation=null;
  this.confirmOverlay=document.createElement('div');this.confirmOverlay.className='building-map-confirm';this.confirmOverlay.hidden=true;
  this.confirmOverlay.innerHTML='<section class="building-map-confirm__card"><h3 id="buildingTravelTitle">ここへ移動しますか？</h3><p class="building-map-confirm__destination" id="buildingTravelBody"></p><div class="building-map-confirm__actions"><button type="button" data-building-confirm="cancel">地図に戻る</button><button type="button" data-building-confirm="move">移動する<span aria-hidden="true"> ↗</span></button></div></section>';dialog.append(this.confirmOverlay);
  this.mapParts=[dialog.querySelector('.building-map__header'),dialog.querySelector('.building-map__floors'),dialog.querySelector('.building-map__body')];
  dialog.querySelector('.building-map__close').addEventListener('click',()=>this.close());
  dialog.addEventListener('cancel',event=>{if(this.confirmation){event.preventDefault();this.cancelTravel();}});
  dialog.addEventListener('close',()=>{if(dialog.open)return;this.hideConfirmation(false);releaseModal(dialog);this.opener?.setAttribute('aria-expanded','false');if(this.canOpen()&&!isModalBlocked()&&this.opener?.isConnected)this.opener.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{
   if(this.confirmation){const action=event.target.closest('[data-building-confirm]')?.dataset.buildingConfirm;if(action==='cancel')this.cancelTravel();else if(action==='move')this.confirmTravel();return;}
   const region=event.target.closest('[data-building-map-area]');if(region){this.activateMapArea(region.dataset.buildingMapArea);return;}
   const floor=event.target.closest('[data-building-floor]');
   if(floor)this.selectFloor(floor.dataset.buildingFloor);
   else if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)this.close();}
  });
  dialog.addEventListener('keydown',event=>{
   if(this.confirmation){if(event.key==='Tab'){event.preventDefault();const buttons=[...this.confirmOverlay.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus({preventScroll:true});}return;}
   const region=event.target.closest('[data-building-map-area]');if(region&&['Enter',' '].includes(event.key)){event.preventDefault();if(!event.repeat)this.activateMapArea(region.dataset.buildingMapArea);}
  });
  dialog.querySelector('[role=tablist]').addEventListener('keydown',event=>{
   const count=BUILDING_FLOORS.length,index=BUILDING_FLOORS.findIndex(f=>f.id===this.floorId),next=event.key==='Home'?0:event.key==='End'?count-1:['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%count:['ArrowLeft','ArrowUp'].includes(event.key)?(index+count-1)%count:null;
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
  return this.requestTravel();
 }
 requestTravel(){
  if(!this.dialog.open||this.confirmation||!this.canOpen())return false;
  const destination={floorId:this.floorId,areaId:this.areaId},current=this.getCurrentArea();
  if(!this.canTravel(destination)||(current.floorId===destination.floorId&&current.areaId===destination.areaId))return false;
  const floor=BUILDING_FLOORS.find(f=>f.id===destination.floorId),area=floor?.areas.find(a=>a.id===destination.areaId);if(!area||area.mapOnly)return false;
  this.confirmation={...destination,scroll:this.dialog.querySelector('.building-map__body').scrollTop,submitted:false};
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
  if(pending&&restoreFocus&&this.dialog.open){this.dialog.querySelector('.building-map__body').scrollTop=pending.scroll;this.dialog.querySelector('[data-building-map-area="'+pending.areaId+'"]')?.focus({preventScroll:true});}
  return pending;
 }
 cancelTravel(){if(!this.confirmation)return false;this.hideConfirmation();return true;}
 confirmTravel(){
  const pending=this.confirmation;if(!this.dialog.open||!pending||pending.submitted)return false;
  const destination={floorId:pending.floorId,areaId:pending.areaId},current=this.getCurrentArea();
  if(!this.canOpen()||!this.canTravel(destination)||this.floorId!==pending.floorId||this.areaId!==pending.areaId||(current.floorId===pending.floorId&&current.areaId===pending.areaId)){
   this.hideConfirmation(false);this.selectArea(this.areaId);const status=document.createElement('p');status.setAttribute('role','status');status.tabIndex=-1;status.textContent='いまは移動できません。もう一度、地図をご確認ください。';this.dialog.querySelector('.building-map__description').append(status);
   const trigger=this.dialog.querySelector('[data-building-map-area="'+pending.areaId+'"]');(trigger&&!trigger.disabled?trigger:status).focus({preventScroll:true});this.dialog.querySelector('.building-map__body').scrollTop=pending.scroll;return false;
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
  this.dialog.querySelector('.building-map__body').scrollTop=0;this.selectArea(this.areaId);return true;
 }
 selectArea(id){
  if(this.confirmation)return false;
  const floor=BUILDING_FLOORS.find(f=>f.id===this.floorId),area=floor.areas.find(a=>a.id===id);if(!area)return false;
  this.areaId=id;this.dialog.querySelector('.building-map__drawing').innerHTML=buildingFloorSvg(this.floorId,id);
  const description=this.dialog.querySelector('.building-map__description'),current=this.getCurrentArea(),here=current.floorId===this.floorId&&current.areaId===id,available=!area.mapOnly&&this.canTravel({floorId:this.floorId,areaId:id});description.replaceChildren();
  const heading=document.createElement('h3'),name=document.createElement('span'),status=document.createElement('small');name.textContent=area.name;status.textContent=here?'現在地':area.mapOnly?'マップのみ':available?'移動できます':'準備中';status.dataset.state=here?'current':available?'available':'unavailable';heading.append(name,status);description.append(heading);
  if(area.text?.trim()){const copy=document.createElement('p');copy.textContent=area.text;description.append(copy);}
  this.mountRoomMap();this.decorateMap();this.refreshStaff();return true;
 }
 decorateMap(){
  const svg=this.dialog.querySelector('.building-plan'),floor=BUILDING_FLOORS.find(f=>f.id===this.floorId),current=this.getCurrentArea(),unit=this.floorId.startsWith('b')?2:1;
  this.dialog.querySelector('.building-map__drawing').style.setProperty('--building-map-aspect',svg.viewBox.baseVal.width+'/'+svg.viewBox.baseVal.height);
  svg.setAttribute('role','group');svg.firstElementChild.setAttribute('aria-hidden','true');
  const overlay=svgNode('g',{'class':'building-map-targets'});svg.append(overlay);
  for(const area of floor.areas){
   const rect=svg.querySelector('[data-building-zone="'+area.id+'"]');if(!rect)continue;
   const [x,y,w,h]=['x','y','width','height'].map(k=>Number(rect.getAttribute(k))),here=current.floorId===this.floorId&&current.areaId===area.id,available=!area.mapOnly&&!here&&this.canTravel({floorId:this.floorId,areaId:area.id});
   const target=svgNode('g',{'class':'building-map-region '+(available?'is-travelable':here?'is-current':'is-unavailable'),'data-building-map-area':area.id,'data-travel-available':String(available),role:'button',tabindex:0,'aria-label':area.name+'。'+(available?'タップして移動を確認':here?'現在地。情報を見る':area.mapOnly?'マップにのみ表示。情報を見る':'3Dエリアは準備中。情報を見る')});
   target.append(svgNode('rect',{x,y,width:w,height:h,rx:8,'class':'building-map-region__hit','vector-effect':'non-scaling-stroke'}));
   if(available){
    const cx=Number(rect.getAttribute('data-map-marker-x')??x+w/2),cy=Number(rect.getAttribute('data-map-marker-y')??y+24*unit),markerUnit=Number(rect.getAttribute('data-map-marker-unit')??unit),badge=svgNode('g',{transform:'translate('+cx+' '+cy+') scale('+markerUnit+')','class':'building-map-region__badge','aria-hidden':'true'});
    if(this.floorId==='b2'&&['guest-lounge','control'].includes(area.id))badge.style.pointerEvents='auto';
    badge.append(svgNode('path',{d:'M0-20c-12 0-20 8-20 19 0 14 20 30 20 30S20 13 20-1C20-12 12-20 0-20Z',fill:'#6e8652',stroke:'#fffdf2','stroke-width':2}));
    badge.append(svgNode('path',{d:'M-7 3 7-9M-5-9H7V3',fill:'none',stroke:'#fffdf2','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
    badge.append(svgNode('rect',{x:-92,y:32,width:184,height:40,rx:18,fill:'#fffdf2',stroke:'#99ac78','stroke-width':2}));
    const label=svgNode('text',{x:0,y:60,'font-size':24,'font-weight':600,'text-anchor':'middle',fill:'#5e7447'});label.textContent='タップで移動';badge.append(label);target.append(badge);
   }else if(here){
    const anchored=(this.floorId==='b1'||this.floorId==='b2'&&['guest-lounge','control'].includes(area.id))&&rect.hasAttribute('data-map-marker-y'),tagUnit=anchored?Number(rect.getAttribute('data-map-marker-unit')??unit):unit,cx=anchored?Number(rect.getAttribute('data-map-marker-x')??x+w/2):x+w/2,cy=anchored?Number(rect.getAttribute('data-map-marker-y'))+52*tagUnit:Math.max(svg.viewBox.baseVal.y+18*unit,y-18*unit);
    const tag=svgNode('g',{'class':'building-map-region__badge','aria-hidden':'true'});tag.append(svgNode('rect',{x:cx-64*tagUnit,y:cy-16*tagUnit,width:128*tagUnit,height:32*tagUnit,rx:14*tagUnit,fill:'#8c7451',stroke:'#fffdf2','stroke-width':tagUnit}));
    const label=svgNode('text',{x:cx,y:cy+7*tagUnit,'font-size':21*tagUnit,'text-anchor':'middle',fill:'#fffdf2'});label.textContent='● 現在地';tag.append(label);target.append(tag);
   }
   overlay.append(target);
  }
 }
 refreshStaff(){
  const svg=this.dialog.querySelector('.building-plan');if(!svg)return false;
  const state=this.readStaff(),counts=state?getFacilityStaffCounts(state):{};
  const key=JSON.stringify([this.floorId,counts]);if(this.staffKey===key&&this.staffSvg===svg)return false;
  // Update only the occupancy decorations, keeping the floor, focus and scroll intact.
  svg.querySelector('[data-building-staff-counts]')?.remove();
  const overlay=svgNode('g',{'data-building-staff-counts':'true','class':'building-map-staff-counts','pointer-events':'none'});
  for(const room of Object.values(INTERIOR_ROOMS)){
   if(room.floorId!==this.floorId)continue;
   const count=counts[room.id]||0,zone=svg.querySelector('[data-building-zone="'+room.areaId+'"]');
   if(!zone)continue;
   const target=svg.querySelector('[data-building-map-area="'+room.areaId+'"]');
   if(target){
    const base=target.getAttribute('data-label-without-staff')||target.getAttribute('aria-label');target.setAttribute('data-label-without-staff',base);target.setAttribute('aria-label',base+(count?'。従業員'+count+'人がいます':''));
   }
   if(!count)continue;
   const [x,y,w,h]=['x','y','width','height'].map(name=>Number(zone.getAttribute(name))),scale=this.floorId.startsWith('b')?1.65:1.4;
   overlay.insertAdjacentHTML('beforeend',staffCountDrawing(room.id,count,{x:x+w-80*scale-10,y:y+h-34*scale-8,scale}));
  }
  svg.append(overlay);this.staffKey=key;this.staffSvg=svg;return true;
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
